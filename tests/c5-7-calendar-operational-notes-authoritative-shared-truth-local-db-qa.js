import assert from 'node:assert/strict'
import { randomUUID, webcrypto } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import {
  buildC57ArchiveCalendarItemCommand,
  buildC57SaveCalendarItemCommand,
  buildC57SaveCalendarTagCommand,
  buildC57SetCalendarTagActiveCommand,
  buildC57UpsertAdvisoryNoteCommand,
  buildC57UpsertBoardNoteCommand,
  mutateC57CalendarNotesSharedTruth,
  pullC57CalendarNotesSharedTruth,
} from '../src/cloud-authoritative-calendar-notes.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const projectSlug = 'ichess-center-os'
const expectedContainer = 'supabase_db_ichess-center-os'
const consentFlag = 'ICHESS_C5_7_LOCAL_QA_ALLOW_RESET'
assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
assert.equal(process.env[consentFlag], 'YES', `${consentFlag}=YES is required`)
assert(!process.env.SUPABASE_PROJECT_REF, 'Linked Supabase project references are forbidden')

const assertLoopback = (value, label) => {
  if (!value) return
  let host = value
  try { host = new URL(value).hostname } catch { host = value.split(':')[0] }
  assert(new Set(['127.0.0.1', 'localhost', '::1']).has(host.toLowerCase()), `${label} must be loopback`)
}
for (const name of ['PGHOST', 'DATABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_URL', 'API_URL']) {
  assertLoopback(process.env[name], name)
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(), encoding: 'utf8', windowsHide: true,
    maxBuffer: 64 * 1024 * 1024, ...options,
  })
  if (result.error) throw result.error
  return result
}
const requireSuccess = (result, label) => {
  if (result.status !== 0) throw new Error(`${label}: ${result.stdout}\n${result.stderr}`)
  return result.stdout
}
const cliCommand = process.platform === 'win32' ? process.env.ComSpec : 'npx'
const cliArgs = (tail) => process.platform === 'win32'
  ? ['/d', '/s', '/c', `npx --no-install supabase ${tail}`]
  : ['--no-install', 'supabase', ...tail.split(' ')]
const getLocalStatus = () => JSON.parse(requireSuccess(run(cliCommand, cliArgs('status -o json')), 'local status'))
let localStatus = getLocalStatus()
for (const key of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) assert.equal(typeof localStatus[key], 'string')
assertLoopback(new URL(localStatus.DB_URL).hostname, 'local DB')
assertLoopback(new URL(localStatus.API_URL).hostname, 'local API')

const discoverContainer = () => {
  const output = requireSuccess(run('docker', [
    'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
    '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
  ]), 'Docker discovery')
  const rows = output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
    .filter(([, name]) => name === expectedContainer)
  assert.equal(rows.length, 1, 'Expected exactly one guarded local DB container')
  assert(/supabase\/postgres/i.test(rows[0][2]))
  return rows[0][0]
}
let containerId = discoverContainer()
const runReset = () => requireSuccess(run(cliCommand, cliArgs('db reset'), { timeout: 300_000 }), 'local db reset')
const psqlArgs = () => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql) => requireSuccess(run('docker', psqlArgs(), { input: sql }), 'psql')
const scalar = (sql) => psql(sql).trim()
const q = (value) => value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`

const suffix = randomUUID()
const password = `C5.7!${randomUUID()}aA1`
const ids = {
  center: `c5-7-${randomUUID()}`,
  otherCenter: `c5-7-${randomUUID()}`,
  student: `student-${randomUUID()}`,
  otherStudent: `student-${randomUUID()}`,
}
const emails = Object.fromEntries(['a', 'b', 'c', 'teacher']
  .map((key) => [key, `c5.7.${key}.${suffix}@example.invalid`]))
let admin
let fixtureCreated = false
let finalResetVerified = false

const makeClient = () => createClient(localStatus.API_URL, localStatus.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const makeUser = async (email) => {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return data.user
}
const signIn = async (email) => {
  const client = makeClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  assert(data.session?.access_token)
  return client
}
const pull = (client, centerId = ids.center) =>
  pullC57CalendarNotesSharedTruth({ supabase: client, centerId })
const mutate = (client, command, idempotencyKey = randomUUID(), centerId = ids.center) =>
  mutateC57CalendarNotesSharedTruth({ supabase: client, centerId, command, idempotencyKey })
const tagDraft = (overrides = {}) => ({
  label: 'Nội bộ C5.7', colorKey: 'blue', customColor: '', defaultItemType: 'meeting',
  description: 'Synthetic QA', ...overrides,
})
const itemDraft = (overrides = {}) => ({
  itemType: 'meeting', itemSubtype: '', title: 'Họp vận hành C5.7', description: 'Synthetic QA',
  startAt: '2026-08-17T02:00:00.000Z', endAt: '2026-08-17T03:00:00.000Z', allDay: false,
  location: 'Phòng họp', roomId: '', colorKey: 'blue', customColor: '', tagId: '',
  participantIds: [], teacherIds: [], staffIds: [], recurrenceRule: null,
  linkedSessionId: '', linkedClassSessionId: '', isCancelled: false, ...overrides,
})

console.log('C5_7_QA_LOCAL_SAFETY_GUARD: PASS')

try {
  runReset()
  containerId = discoverContainer()
  localStatus = getLocalStatus()
  fixtureCreated = true

  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608140010' and name='c5_7_calendar_operational_notes_authoritative_shared_truth';`), '1')
  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608140011' and name='c5_7_independent_review_recurrence_reference_hardening';`), '1')
  for (const table of [
    'center_calendar_tags_authoritative', 'center_calendar_items_authoritative',
    'center_operational_attendance_notes', 'center_calendar_notes_audit_events',
    'center_calendar_notes_command_results',
  ]) {
    assert.equal(scalar(`select (c.relrowsecurity and c.relforcerowsecurity)::text from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=${q(table)};`), 'true')
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal(scalar(`select has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT,INSERT,UPDATE,DELETE');`), 'f')
    }
  }
  assert.equal(scalar(`select has_function_privilege('authenticated','public.c5_7_list_calendar_notes_shared_truth(text)','EXECUTE')::text;`), 'true')
  assert.equal(scalar(`select has_function_privilege('anon','public.c5_7_list_calendar_notes_shared_truth(text)','EXECUTE')::text;`), 'false')
  assert.equal(scalar(`select count(*) from information_schema.columns where table_schema='public' and table_name in ('center_calendar_items_authoritative','center_operational_attendance_notes') and column_name in ('linked_session_id','linked_class_session_id','student_name','student_phone','phone');`), '0')
  console.log('C5_7_QA_SCHEMA_FORCED_RLS_RPC_ONLY_NO_DUPLICATE_IDENTITY: PASS')

  admin = createClient(localStatus.API_URL, localStatus.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const users = {
    a: await makeUser(emails.a), b: await makeUser(emails.b),
    c: await makeUser(emails.c), teacher: await makeUser(emails.teacher),
  }
  psql(`insert into public.centers(id,name,status) values
    (${q(ids.center)},'C5.7 primary','active'),
    (${q(ids.otherCenter)},'C5.7 other','active');
insert into public.center_members(center_id,user_id,role,status) values
    (${q(ids.center)},${u(users.a.id)},'owner','active'),
    (${q(ids.center)},${u(users.b.id)},'center_admin','active'),
    (${q(ids.center)},${u(users.teacher.id)},'teacher','active'),
    (${q(ids.otherCenter)},${u(users.a.id)},'owner','active'),
    (${q(ids.otherCenter)},${u(users.c.id)},'center_admin','active');
insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,created_by,updated_by)
values
    (${q(ids.center)},'student',${q(ids.student)},jsonb_build_object('id',${q(ids.student)}),'qa','c5.7',${u(users.a.id)},${u(users.a.id)}),
    (${q(ids.otherCenter)},'student',${q(ids.otherStudent)},jsonb_build_object('id',${q(ids.otherStudent)}),'qa','c5.7',${u(users.a.id)},${u(users.a.id)});`)
  const clientA = await signIn(emails.a)
  const clientB = await signIn(emails.b)
  const clientC = await signIn(emails.c)
  const clientTeacher = await signIn(emails.teacher)
  const freshClientB = await signIn(emails.b)

  const empty = await pull(clientA)
  assert.equal(empty.ok, true)
  assert.deepEqual(empty.calendarItems, [])
  assert.deepEqual(empty.calendarTags, [])
  assert.deepEqual(empty.advisoryNotes, [])
  assert.deepEqual(empty.boardNotes, [])
  assert.equal(scalar(`select count(*) from public.center_calendar_items_authoritative where center_id in ('dreamhome','dreamhome_prod');`), '0')
  assert.equal((await pull(clientA, '')).outcome_code, 'INVALID_CENTER')
  console.log('C5_7_QA_EMPTY_SERVER_NO_DEFAULT_DREAMHOME_OR_SAMPLE_SEED: PASS')

  const tagCommand = buildC57SaveCalendarTagCommand(tagDraft())
  const tagRetryKey = randomUUID()
  const tagCreate = await mutate(clientA, tagCommand, tagRetryKey)
  assert.equal(tagCreate.ok, true, JSON.stringify(tagCreate))
  assert.deepEqual(await mutate(clientA, tagCommand, tagRetryKey), tagCreate)
  const changedTagIntent = structuredClone(tagCommand)
  changedTagIntent.label = 'Changed retry intent'
  assert.equal((await mutate(clientA, changedTagIntent, tagRetryKey)).outcome_code, 'IDEMPOTENCY_CONFLICT')
  let atB = await pull(clientB)
  const tag = atB.calendarTags.find((row) => row.id === tagCreate.entity_id)
  assert(tag)
  assert.equal(tag.createdAt.length > 0, true)

  const itemCreate = await mutate(clientA, buildC57SaveCalendarItemCommand(itemDraft({ tagId: tag.id })))
  assert.equal(itemCreate.ok, true, JSON.stringify(itemCreate))
  atB = await pull(clientB)
  let itemAtB = atB.calendarItems.find((row) => row.id === itemCreate.entity_id)
  assert(itemAtB)
  assert.equal(itemAtB.tagLabel, tag.label)
  assert.equal(itemAtB.linkedSessionId, '')
  assert.deepEqual(itemAtB.teacherIds, [])
  assert.throws(() => buildC57SaveCalendarItemCommand(itemDraft({ itemType: 'fixedClass' })))
  const invalidClass = await mutate(clientA, {
    ...buildC57SaveCalendarItemCommand(itemDraft()), item_type: 'CLASS_SESSION',
  })
  assert.equal(invalidClass.outcome_code, 'INVALID_PAYLOAD')
  const boundaryRecurrence = await mutate(clientA, buildC57SaveCalendarItemCommand(itemDraft({
    title: '52 occurrences accepted',
    recurrenceRule: {
      frequency: 'weekly', interval: 1, daysOfWeek: ['mon'], endMode: 'until',
      untilDate: '2027-08-09', count: null, timezone: 'Asia/Ho_Chi_Minh',
    },
  })))
  assert.equal(boundaryRecurrence.ok, true, JSON.stringify(boundaryRecurrence))
  const tooLongRecurrence = {
    ...buildC57SaveCalendarItemCommand(itemDraft({ title: '53 occurrences rejected' })),
    recurrence_rule: {
      frequency: 'weekly', interval: 1, daysOfWeek: ['mon'], endMode: 'until',
      untilDate: '2027-08-16', count: null, timezone: 'Asia/Ho_Chi_Minh',
    },
  }
  assert.equal((await mutate(clientA, tooLongRecurrence)).outcome_code, 'INVALID_PAYLOAD')
  const zeroOccurrenceRecurrence = {
    ...buildC57SaveCalendarItemCommand(itemDraft({ title: 'Zero occurrences rejected' })),
    recurrence_rule: {
      frequency: 'weekly', interval: 1, daysOfWeek: ['tue'], endMode: 'until',
      untilDate: '2026-08-17', count: null, timezone: 'Asia/Ho_Chi_Minh',
    },
  }
  assert.equal((await mutate(clientA, zeroOccurrenceRecurrence)).outcome_code, 'INVALID_PAYLOAD')
  const malformedRecurrence = {
    ...buildC57SaveCalendarItemCommand(itemDraft({ title: 'Malformed recurrence rejected' })),
    recurrence_rule: {
      frequency: 'weekly', interval: '1', daysOfWeek: ['mon'], endMode: 'count',
      untilDate: null, count: 4, timezone: 'Asia/Ho_Chi_Minh',
    },
  }
  assert.equal((await mutate(clientA, malformedRecurrence)).outcome_code, 'INVALID_PAYLOAD')
  assert.equal(scalar(`select count(*) from public.center_cloud_entities where center_id=${q(ids.center)} and entity_type in ('class_session','schedule_session');`), '0')
  console.log('C5_7_QA_CALENDAR_TAG_ITEM_RECURRENCE_BOUNDARY_NO_SCHEDULE_DUPLICATE: PASS')

  const staleItem = structuredClone(itemAtB)
  const edit = await mutate(clientB, buildC57SaveCalendarItemCommand({ ...itemAtB, title: 'B cập nhật Calendar' }))
  assert.equal(edit.ok, true, JSON.stringify(edit))
  let atA = await pull(clientA)
  assert.equal(atA.calendarItems.find((row) => row.id === itemAtB.id).title, 'B cập nhật Calendar')
  assert.equal((await mutate(clientA, buildC57SaveCalendarItemCommand({ ...staleItem, title: 'Stale A' }))).outcome_code, 'VERSION_STALE')

  const currentItem = atA.calendarItems.find((row) => row.id === itemAtB.id)
  const concurrent = await Promise.all([
    mutate(clientA, buildC57SaveCalendarItemCommand({ ...currentItem, description: 'A race' })),
    mutate(clientB, buildC57SaveCalendarItemCommand({ ...currentItem, description: 'B race' })),
  ])
  assert.equal(concurrent.filter((result) => result.ok).length, 1)
  assert.equal(concurrent.filter((result) => result.outcome_code === 'VERSION_STALE').length, 1)
  console.log('C5_7_QA_CALENDAR_SAME_CENTER_STALE_CONCURRENT_CURRENTNESS: PASS')

  const advisoryCreate = await mutate(clientA, buildC57UpsertAdvisoryNoteCommand({
    studentId: ids.student, monthKey: '2026-08', careStatus: 'contactedParent', note: 'Đã gọi phụ huynh C5.7',
  }))
  assert.equal(advisoryCreate.ok, true, JSON.stringify(advisoryCreate))
  const boardCommand = buildC57UpsertBoardNoteCommand({
    studentId: ids.student, month: '2026-08', note: 'Theo dõi chuyên cần C5.7',
  })
  const boardRetry = randomUUID()
  const boardCreate = await mutate(clientB, boardCommand, boardRetry)
  assert.equal(boardCreate.ok, true, JSON.stringify(boardCreate))
  assert.deepEqual(await mutate(clientB, boardCommand, boardRetry), boardCreate)
  atA = await pull(clientA)
  assert.equal(atA.advisoryNotes[0].careStatus, 'contactedParent')
  assert.equal(atA.boardNotes[0].note, 'Theo dõi chuyên cần C5.7')
  assert.equal((await mutate(clientA, buildC57UpsertAdvisoryNoteCommand({
    studentId: ids.otherStudent, monthKey: '2026-08', careStatus: 'auto', note: 'Cross center',
  }))).outcome_code, 'STUDENT_REFERENCE_DENIED')

  const currentAdvisory = (await pull(clientB)).advisoryNotes[0]
  const noteRace = await Promise.all([
    mutate(clientA, buildC57UpsertAdvisoryNoteCommand({ ...currentAdvisory, note: 'A note race' })),
    mutate(clientB, buildC57UpsertAdvisoryNoteCommand({ ...currentAdvisory, note: 'B note race' })),
  ])
  assert.equal(noteRace.filter((result) => result.ok).length, 1)
  assert.equal(noteRace.filter((result) => result.outcome_code === 'VERSION_STALE').length, 1)
  psql(`update public.center_cloud_entities set deleted_at=pg_catalog.clock_timestamp()
    where center_id=${q(ids.center)} and entity_type='student' and local_id=${q(ids.student)};`)
  assert.equal((await pull(clientA)).outcome_code, 'INVALID_SERVER_STATE', 'dangling Student note must fail the whole pull')
  psql(`update public.center_cloud_entities set deleted_at=null
    where center_id=${q(ids.center)} and entity_type='student' and local_id=${q(ids.student)};`)
  assert.equal((await pull(clientA)).ok, true)
  assert.equal(scalar(`select count(*) from public.center_calendar_notes_audit_events where center_id=${q(ids.center)} and (after_state ? 'note' or before_state ? 'note');`), '0')
  assert.equal(scalar(`select count(*) from public.center_calendar_notes_audit_events where center_id=${q(ids.center)} and entity_type like '%NOTE' and length(after_state->>'note_sha256')=64 and actor_user_id is not null and actor_membership_id is not null;`), '3')
  console.log('C5_7_QA_OPERATIONAL_NOTES_STUDENT_REFERENCE_RETRY_RACE_SAFE_AUDIT: PASS')

  const directRead = await clientA.from('center_calendar_items_authoritative').select('*')
  assert(directRead.error)
  assert.equal((await pull(clientC, ids.center)).outcome_code, 'CENTER_ACCESS_DENIED')
  assert.equal((await mutate(clientC, buildC57SaveCalendarTagCommand(tagDraft({ label: 'Leak' })))).outcome_code, 'CENTER_ACCESS_DENIED')
  assert.equal((await mutate(clientTeacher, buildC57SaveCalendarTagCommand(tagDraft({ label: 'Teacher write' })))).outcome_code, 'WRITE_ROLE_REQUIRED')
  assert.equal((await pull(clientTeacher)).ok, true)
  const ownerOther = await pull(clientA, ids.otherCenter)
  assert.equal(ownerOther.ok, true)
  assert.deepEqual(ownerOther.calendarItems, [])
  assert.deepEqual(ownerOther.advisoryNotes, [])
  const ownerBack = await pull(clientA, ids.center)
  assert(ownerBack.calendarItems.some((row) => row.id === itemCreate.entity_id))
  const fresh = await pull(freshClientB)
  assert(fresh.calendarItems.some((row) => row.id === itemCreate.entity_id))
  assert.equal(fresh.advisoryNotes.length, 1)
  assert.equal(fresh.boardNotes.length, 1)
  console.log('C5_7_QA_FRESH_SAME_CENTER_CROSS_CENTER_OWNER_SWITCH_ROLE_DIRECT_TABLE: PASS')

  const archiveTarget = fresh.calendarItems.find((row) => row.id === itemCreate.entity_id)
  const archive = await mutate(clientA, buildC57ArchiveCalendarItemCommand(archiveTarget))
  assert.equal(archive.ok, true, JSON.stringify(archive))
  const afterArchive = await pull(clientB)
  assert.equal(afterArchive.calendarItems.find((row) => row.id === archiveTarget.id).isArchived, true)
  assert.equal(afterArchive.advisoryNotes.length, 1)
  assert.equal(afterArchive.boardNotes.length, 1)
  assert.equal(scalar(`select count(*) from public.center_calendar_items_authoritative where center_id=${q(ids.center)} and id=${u(archiveTarget.id)};`), '1')
  const updatedTag = await mutate(clientB, buildC57SaveCalendarTagCommand({
    ...tag,
    description: 'B updated before A stale archive',
  }))
  assert.equal(updatedTag.ok, true, JSON.stringify(updatedTag))
  const staleTagArchive = await mutate(clientA, buildC57SetCalendarTagActiveCommand(tag, false))
  assert.equal(staleTagArchive.outcome_code, 'VERSION_STALE', 'stale tag projection must fail closed')
  const currentTag = (await pull(clientA)).calendarTags.find((row) => row.id === tag.id)
  assert.equal((await mutate(clientA, buildC57SetCalendarTagActiveCommand(currentTag, false))).ok, true)
  console.log('C5_7_QA_ARCHIVE_PRESERVES_CALENDAR_AND_NOTES_HISTORY: PASS')
} finally {
  if (fixtureCreated) {
    runReset()
    containerId = discoverContainer()
    finalResetVerified = true
  }
}

assert.equal(finalResetVerified, true)
console.log('C5_7_QA_FINAL_LOCAL_RESET: PASS')
console.log('C5_7_CALENDAR_OPERATIONAL_NOTES_AUTHORITATIVE_SHARED_TRUTH_LOCAL_DB_QA: PASS')
