import assert from 'node:assert/strict'
import { createHash, randomUUID, webcrypto } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import {
  buildC57SaveCalendarItemCommand,
  buildC57SaveCalendarTagCommand,
  buildC57UpsertAdvisoryNoteCommand,
  canWriteC57SharedTruth,
  createC57RetryFingerprint,
  mutateC57CalendarNotesSharedTruth,
  pullC57CalendarNotesSharedTruth,
} from '../src/cloud-authoritative-calendar-notes.js'
import {
  getC57LegacyManifestKey,
  inspectAndQuarantineC57LegacyState,
} from '../src/legacy-calendar-notes-quarantine.js'
import {
  createEditCenterCalendarItemFormState,
  createEditCenterCalendarTagFormState,
} from '../src/schedule-module.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const root = process.cwd()
const paths = {
  migration: 'supabase/migrations/202608140010_c5_7_calendar_operational_notes_authoritative_shared_truth.sql',
  hardeningMigration: 'supabase/migrations/202608140011_c5_7_independent_review_recurrence_reference_hardening.sql',
  adapter: 'src/cloud-authoritative-calendar-notes.js',
  legacy: 'src/legacy-calendar-notes-quarantine.js',
  main: 'src/main.js',
  schedule: 'src/schedule-module.js',
  tuition: 'src/tuition-module.js',
  attendanceBoard: 'src/attendance-board-module.js',
  reportModule: 'src/report-module.js',
  report: 'docs/c5-7-calendar-operational-notes-authoritative-shared-truth.md',
  dbQa: 'tests/c5-7-calendar-operational-notes-authoritative-shared-truth-local-db-qa.js',
}
for (const path of Object.values(paths)) assert(existsSync(join(root, path)), `Missing C5.7 artifact: ${path}`)
const read = (path) => readFileSync(join(root, path), 'utf8')
const content = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, read(path)]))
const sha256 = (path) => createHash('sha256').update(readFileSync(join(root, path))).digest('hex').toUpperCase()
const includesAll = (source, tokens, label) => tokens.forEach((token) =>
  assert(source.includes(token), `${label}: missing ${token}`))
const excludesAll = (source, tokens, label) => tokens.forEach((token) =>
  assert(!source.includes(token), `${label}: forbidden ${token}`))

const inheritedMigrations = readdirSync(join(root, 'supabase/migrations'))
  .filter((name) => name.endsWith('.sql') && name < '202608140010_c5_7_calendar_operational_notes_authoritative_shared_truth.sql')
assert.equal(inheritedMigrations.length, 29)
const trackedMigrationStatus = spawnSync(
  'git', ['status', '--porcelain', '--untracked-files=no', '--', 'supabase/migrations'],
  { cwd: root, encoding: 'utf8' },
)
assert.equal(trackedMigrationStatus.status, 0)
assert.equal(trackedMigrationStatus.stdout.trim(), '', 'Tracked inherited migrations must remain unchanged')
assert.equal(
  sha256('supabase/migrations/202608140009_c5_6_inventory_authoritative_shared_truth.sql'),
  '4D7BD90677E3B3237514A1D684C472ECEEF22F9BCCE562E5B90082D9E92B24B1',
  'Accepted C5.6 migration identity changed',
)

includesAll(content.migration, [
  'create table public.center_calendar_tags_authoritative',
  'create table public.center_calendar_items_authoritative',
  'create table public.center_operational_attendance_notes',
  'create table public.center_calendar_notes_audit_events',
  'create table public.center_calendar_notes_command_results',
  'force row level security',
  'revoke all on table public.center_calendar_items_authoritative from public, anon, authenticated, service_role',
  'create or replace function public.c5_7_list_calendar_notes_shared_truth',
  'create or replace function public.c5_7_mutate_calendar_notes_shared_truth',
  "v_role not in ('owner','admin','center_admin','qtv')",
  "'VERSION_STALE'", "'IDEMPOTENCY_CONFLICT'", "'STUDENT_REFERENCE_DENIED'",
  "p_command->>'item_type' not in ('MEETING','EVENT','TOURNAMENT','OTHER')",
  "e.entity_type='student'", 'note_sha256', 'actor_membership_id',
  'grant execute on function public.c5_7_list_calendar_notes_shared_truth(text) to authenticated',
], 'C5.7 SQL contract')
excludesAll(content.migration, [
  'insert into public.center_cloud_entities', 'insert into public.schedule_sessions',
  'insert into public.class_sessions', 'alter publication supabase_realtime',
  'dreamhome', 'student_name', 'student_phone', 'linked_session_id', 'linked_class_session_id',
], 'C5.7 SQL authority boundaries')
includesAll(content.hardeningMigration, [
  'create or replace function public.c5_7_valid_recurrence_rule',
  'v_occurrence_count between 1 and 52',
  'center_calendar_items_c57_review_recurrence_check',
  "'outcome_code', 'INVALID_SERVER_STATE'",
  "'student_reference_verified', true",
], 'C5.7 independent-review SQL hardening')

includesAll(content.main, [
  "from './cloud-authoritative-calendar-notes.js'",
  "from './legacy-calendar-notes-quarantine.js'",
  'refreshC57CalendarNotesSharedTruth', "reason: 'module-open'", "reason: 'module-reopen'",
  "reason: 'manual-refresh'", "reason: 'attendance-advisory-surface-open'",
  "reason: 'attendance-board-note-surface-open'", 'writeC57CalendarNotesCommand',
  "reason: 'after-server-commit'", 'clearC57CalendarNotesProjection()',
  'centerCalendarItems = result.calendarItems.filter((item) => !item.isArchived)',
  'attendanceAdvisoryNotes = result.advisoryNotes',
  'attendanceBoardNotes = result.boardNotes',
  "resetC57CalendarNotesRuntimeForAccessBoundary('')",
  'cloudVersion: baseVersion',
  'baseVersion: Number(existingNote?.cloudVersion) || 0',
], 'C5.7 runtime')
excludesAll(content.main, [
  'loadStoredCenterCalendarItems(', 'saveStoredCenterCalendarItems(',
  'loadStoredCenterCalendarTags(', 'saveStoredCenterCalendarTags(',
  'getStoredAttendanceAdvisoryNotes(', 'saveStoredAttendanceAdvisoryNotes(',
  'getStoredAttendanceBoardNotes(', 'saveStoredAttendanceBoardNotes(',
], 'C5.7 no active browser authority')
for (const moduleSource of [content.schedule, content.tuition, content.attendanceBoard]) {
  includesAll(moduleSource, ['data-module-authoritative-refresh', 'Làm mới'], 'C5.7 refresh UX')
}
assert(content.main.includes('const result = await commitStudentProjection({'),
  'Tuition care note must remain on canonical C5.1 Student authority')
assert(content.main.includes('draft: reportState.draft'), 'Unsaved Report editor draft remains an in-memory draft')
assert(!content.reportModule.includes('data-report-action="save"'), 'Report draft must not gain a second saved authority')

assert.equal(canWriteC57SharedTruth({ role: 'owner' }).ok, true)
assert.equal(canWriteC57SharedTruth({ role: 'center_admin' }).ok, true)
assert.equal(canWriteC57SharedTruth({ role: 'teacher' }).ok, false)
const tagDraft = { label: 'C5.7', colorKey: 'blue', customColor: '', defaultItemType: 'meeting', description: '' }
const tagOne = buildC57SaveCalendarTagCommand(tagDraft)
const tagTwo = buildC57SaveCalendarTagCommand(tagDraft)
assert.equal(createC57RetryFingerprint(tagOne), createC57RetryFingerprint(tagTwo))
const itemDraft = {
  itemType: 'meeting', itemSubtype: '', title: 'C5.7 meeting', description: '',
  startAt: '2026-08-17T02:00:00.000Z', endAt: '2026-08-17T03:00:00.000Z',
  allDay: false, location: '', roomId: '', colorKey: 'blue', customColor: '', tagId: '',
  participantIds: [], teacherIds: [], staffIds: [], linkedSessionId: '', linkedClassSessionId: '',
  recurrenceRule: null, isCancelled: false,
}
assert.doesNotThrow(() => buildC57SaveCalendarItemCommand(itemDraft))
assert.doesNotThrow(() => buildC57SaveCalendarItemCommand({
  ...itemDraft,
  recurrenceRule: {
    frequency: 'weekly', interval: 1, daysOfWeek: ['mon'], endMode: 'until',
    untilDate: '2027-08-09', count: null, timezone: 'Asia/Ho_Chi_Minh',
  },
}))
assert.throws(() => buildC57SaveCalendarItemCommand({
  ...itemDraft,
  recurrenceRule: {
    frequency: 'weekly', interval: 1, daysOfWeek: ['mon'], endMode: 'until',
    untilDate: '2027-08-16', count: null, timezone: 'Asia/Ho_Chi_Minh',
  },
}))
assert.throws(() => buildC57SaveCalendarItemCommand({
  ...itemDraft,
  recurrenceRule: {
    frequency: 'weekly', interval: 1, daysOfWeek: ['tue'], endMode: 'until',
    untilDate: '2026-08-17', count: null, timezone: 'Asia/Ho_Chi_Minh',
  },
}))
assert.throws(() => buildC57SaveCalendarItemCommand({
  ...itemDraft,
  recurrenceRule: {
    frequency: 'weekly', interval: 1, daysOfWeek: ['mon'], endMode: 'count',
    untilDate: null, count: 53, timezone: 'Asia/Ho_Chi_Minh',
  },
}))
for (const itemType of ['fixedClass', 'classSession', 'scheduleSession']) {
  assert.throws(() => buildC57SaveCalendarItemCommand({ ...itemDraft, itemType }))
}
assert.throws(() => buildC57SaveCalendarItemCommand({ ...itemDraft, teacherIds: ['teacher-1'] }))
assert.throws(() => buildC57UpsertAdvisoryNoteCommand({ studentId: '', monthKey: '2026-08' }))
assert.equal(createEditCenterCalendarItemFormState({
  id: randomUUID(), centerId: 'center-a', cloudVersion: 7,
}).baseVersion, 7)
assert.equal(createEditCenterCalendarTagFormState({
  id: randomUUID(), centerId: 'center-a', cloudVersion: 9,
}).baseVersion, 9)

const emptyPull = await pullC57CalendarNotesSharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: 'center-a',
    calendar_items: [], calendar_tags: [], operational_notes: [],
  }, error: null }) },
})
assert.equal(emptyPull.ok, true)
assert.deepEqual(emptyPull.calendarItems, [])
assert.equal((await pullC57CalendarNotesSharedTruth({ centerId: '', supabase: { rpc: async () => assert.fail() } })).outcome_code, 'INVALID_CENTER')
const actor = { actor_user_id: randomUUID(), actor_membership_id: randomUUID(), actor_role: 'owner' }
const malformedPull = await pullC57CalendarNotesSharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: 'center-a', calendar_tags: [],
    calendar_items: [{
      center_id: 'center-b', id: randomUUID(), version: 1, item_type: 'MEETING', title: 'Wrong center',
      start_at: '2026-08-17T02:00:00.000Z', end_at: '2026-08-17T03:00:00.000Z',
      color_key: 'blue', custom_color: '', status: 'ACTIVE', recurrence_rule: null,
      created_at: '2026-08-14T00:00:00.000Z', updated_at: '2026-08-14T00:00:00.000Z', ...actor,
    }], operational_notes: [],
  }, error: null }) },
})
assert.equal(malformedPull.outcome_code, 'INVALID_SERVER_RESULT')
assert.equal(Object.hasOwn(malformedPull, 'calendarItems'), false)
const malformedNotePull = await pullC57CalendarNotesSharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: 'center-a',
    calendar_tags: [], calendar_items: [], operational_notes: [{
      center_id: 'center-a', id: randomUUID(), version: 1, note_kind: 'ATTENDANCE_BOARD',
      student_local_id: 'student-1', month_key: 'bad-month', care_status: '', note: 'Malformed',
      created_at: '2026-08-14T00:00:00.000Z', updated_at: '2026-08-14T00:00:00.000Z', ...actor,
    }],
  }, error: null }) },
})
assert.equal(malformedNotePull.outcome_code, 'INVALID_SERVER_RESULT')
assert.equal(Object.hasOwn(malformedNotePull, 'boardNotes'), false)
const wrongStudentNotePull = await pullC57CalendarNotesSharedTruth({
  centerId: 'center-a',
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: 'center-a',
    calendar_tags: [], calendar_items: [], operational_notes: [{
      center_id: 'center-a', id: randomUUID(), version: 1, note_kind: 'ATTENDANCE_ADVISORY',
      student_local_id: 'wrong-center-student', student_reference_verified: false,
      month_key: '2026-08', care_status: 'auto', note: 'Wrong center',
      created_at: '2026-08-14T00:00:00.000Z', updated_at: '2026-08-14T00:00:00.000Z', ...actor,
    }],
  }, error: null }) },
})
assert.equal(wrongStudentNotePull.outcome_code, 'INVALID_SERVER_RESULT')
const failedMutation = await mutateC57CalendarNotesSharedTruth({
  centerId: 'center-a', command: tagOne, idempotencyKey: randomUUID(),
  supabase: { rpc: async () => ({ data: null, error: { message: 'offline' } }) },
})
assert.equal(failedMutation.ok, false)
assert.equal(failedMutation.outcome_code, 'SERVER_COMMAND_FAILED')

class MemoryStorage {
  constructor(entries = {}) { this.map = new Map(Object.entries(entries)) }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null }
  setItem(key, value) { this.map.set(key, String(value)) }
  removeItem(key) { this.map.delete(key) }
}
const centerId = 'legacy-center'
const secret = 'PRIVATE-C5.7-NOTE'
const itemKey = `ichessCenterOS.centerCalendarItems.${centerId}`
const noteKey = `ichessCenterOS.attendanceAdvisoryNotes.${centerId}`
const otherCenterKey = 'ichessCenterOS.attendanceBoardNotes.other-center'
const storage = new MemoryStorage({
  [itemKey]: JSON.stringify([{ id: 'real-calendar', title: 'Real local calendar' }]),
  [noteKey]: JSON.stringify([{ studentId: 'student-private', note: secret }]),
  [otherCenterKey]: JSON.stringify([{ studentId: 'other-student', note: 'OTHER-CENTER-PRIVATE' }]),
})
const quarantine = await inspectAndQuarantineC57LegacyState({
  storage, centerId, now: () => '2026-08-14T00:00:00.000Z',
})
assert.equal(quarantine.ok, true)
assert.equal(quarantine.migrationRequired, true)
assert.equal(quarantine.classifications.centerCalendarItems.classification, 'REAL_LOCAL_ONLY')
assert.equal(quarantine.classifications.attendanceAdvisoryNotes.classification, 'REAL_LOCAL_ONLY')
const manifest = storage.getItem(getC57LegacyManifestKey(centerId))
assert(manifest && !manifest.includes(secret) && !manifest.includes('student-private'))
assert.equal(JSON.parse(manifest).containsRawCalendarOrNotesPayload, false)
assert(storage.getItem(itemKey).includes('Real local calendar'))
assert(storage.getItem(noteKey).includes(secret))
assert(storage.getItem(otherCenterKey).includes('OTHER-CENTER-PRIVATE'))
assert(!content.legacy.includes('removeItem('), 'C5.7 quarantine must not delete recoverable legacy data')
const emptyServerWithLegacy = await pullC57CalendarNotesSharedTruth({
  centerId,
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: centerId,
    calendar_items: [], calendar_tags: [], operational_notes: [],
  }, error: null }) },
})
assert.deepEqual(emptyServerWithLegacy.calendarItems, [])
assert(storage.getItem(noteKey).includes(secret), 'Empty server must not import or delete local legacy')
const nonemptyServerWithLegacy = await pullC57CalendarNotesSharedTruth({
  centerId,
  supabase: { rpc: async () => ({ data: {
    ok: true, outcome_code: 'AUTHORITATIVE_SNAPSHOT', center_id: centerId,
    calendar_items: [], calendar_tags: [], operational_notes: [{
      center_id: centerId, id: randomUUID(), version: 1, note_kind: 'ATTENDANCE_BOARD',
      student_local_id: 'server-student', student_reference_verified: true,
      month_key: '2026-08', care_status: '', note: 'Server only',
      created_at: '2026-08-14T00:00:00.000Z', updated_at: '2026-08-14T00:00:00.000Z', ...actor,
    }],
  }, error: null }) },
})
assert.deepEqual(nonemptyServerWithLegacy.boardNotes.map((note) => note.note), ['Server only'])
assert(storage.getItem(noteKey).includes(secret), 'Nonempty server must not merge or delete local legacy')

console.log(`C5_7_MIGRATION_SHA256: ${sha256(paths.migration)}`)
console.log('C5_7_CALENDAR_OPERATIONAL_NOTES_AUTHORITATIVE_SHARED_TRUTH_SMOKE: PASS')
