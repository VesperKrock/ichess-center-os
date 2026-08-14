import assert from 'node:assert/strict'
import { randomUUID, webcrypto } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import {
  buildC56CreateRequestCommand,
  buildC56PostMovementCommand,
  buildC56SaveItemCommand,
  buildC56UpdateRequestStatusCommand,
  mutateC56InventorySharedTruth,
  pullC56InventorySharedTruth,
} from '../src/cloud-authoritative-inventory.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const projectSlug = 'ichess-center-os'
const expectedContainer = 'supabase_db_ichess-center-os'
const consentFlag = 'ICHESS_C5_6_LOCAL_QA_ALLOW_RESET'
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
const getLocalStatus = () => JSON.parse(requireSuccess(
  run(cliCommand, cliArgs('status -o json')), 'local status',
))
let localStatus = getLocalStatus()
for (const key of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
  assert.equal(typeof localStatus[key], 'string')
}
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
const runReset = () => requireSuccess(
  run(cliCommand, cliArgs('db reset'), { timeout: 300_000 }), 'local db reset',
)
const psqlArgs = () => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql) => requireSuccess(run('docker', psqlArgs(), { input: sql }), 'psql')
const scalar = (sql) => psql(sql).trim()
const q = (value) => value === null || value === undefined
  ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`

const suffix = randomUUID()
const password = `C5.6!${randomUUID()}aA1`
const ids = {
  center: `c5-6-${randomUUID()}`,
  otherCenter: `c5-6-${randomUUID()}`,
  student: `student-${randomUUID()}`,
  otherStudent: `student-${randomUUID()}`,
}
const emails = Object.fromEntries(['a', 'b', 'c', 'teacher']
  .map((key) => [key, `c5.6.${key}.${suffix}@example.invalid`]))
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
  pullC56InventorySharedTruth({ supabase: client, centerId })
const mutate = (client, command, idempotencyKey = randomUUID(), centerId = ids.center) =>
  mutateC56InventorySharedTruth({ supabase: client, centerId, command, idempotencyKey })
const itemDraft = (overrides = {}) => ({
  name: 'Bộ cờ C5.6', category: 'Bàn cờ / quân cờ', unit: 'Bộ', quantity: 10,
  lowStockThreshold: 2, condition: 'Đang dùng', location: 'Kho A', note: 'Synthetic QA',
  ...overrides,
})
const requestDraft = (overrides = {}) => ({
  requestedByName: 'Người đề xuất C5.6', requestedByRole: 'Giáo viên',
  requestedByPhone: '090-SHOULD-NOT-PERSIST', studentName: 'Học viên C5.6',
  linkedStudentId: ids.student, itemTypes: ['book'], otherItemText: '',
  itemDetails: 'Cần 2 sách', usageModes: ['centerClass'], otherUsageText: '',
  usageLocationDetail: 'Phòng C5.6', neededDate: '2026-08-20', priority: 'normal',
  adminNote: '', ...overrides,
})

console.log('C5_6_QA_LOCAL_SAFETY_GUARD: PASS')

try {
  runReset()
  containerId = discoverContainer()
  localStatus = getLocalStatus()
  fixtureCreated = true

  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608140009' and name='c5_6_inventory_authoritative_shared_truth';`), '1')
  for (const table of [
    'center_inventory_items', 'center_inventory_movements', 'center_inventory_requests',
    'center_inventory_audit_events', 'center_inventory_command_results',
  ]) {
    assert.equal(scalar(`select (c.relrowsecurity and c.relforcerowsecurity)::text from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=${q(table)};`), 'true')
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal(scalar(`select has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT,INSERT,UPDATE,DELETE');`), 'f')
    }
  }
  assert.equal(scalar(`select has_function_privilege('authenticated','public.c5_6_list_inventory_shared_truth(text)','EXECUTE')::text;`), 'true')
  assert.equal(scalar(`select has_function_privilege('anon','public.c5_6_list_inventory_shared_truth(text)','EXECUTE')::text;`), 'false')
  assert.equal(scalar(`select has_function_privilege('authenticated','public.c5_6_mutate_inventory_shared_truth(text,jsonb,uuid)','EXECUTE')::text;`), 'true')
  assert.equal(scalar(`select count(*) from information_schema.columns where table_schema='public' and table_name='center_inventory_requests' and column_name like '%phone%';`), '0')
  console.log('C5_6_QA_SCHEMA_RLS_ACL_NO_PHONE_AUTHORITY: PASS')

  admin = createClient(localStatus.API_URL, localStatus.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const users = {
    a: await makeUser(emails.a), b: await makeUser(emails.b),
    c: await makeUser(emails.c), teacher: await makeUser(emails.teacher),
  }
  psql(`insert into public.centers(id,name,status) values
    (${q(ids.center)},'C5.6 primary','active'),
    (${q(ids.otherCenter)},'C5.6 other','active');
insert into public.center_members(center_id,user_id,role,status) values
    (${q(ids.center)},${u(users.a.id)},'owner','active'),
    (${q(ids.center)},${u(users.b.id)},'center_admin','active'),
    (${q(ids.center)},${u(users.teacher.id)},'teacher','active'),
    (${q(ids.otherCenter)},${u(users.a.id)},'owner','active'),
    (${q(ids.otherCenter)},${u(users.c.id)},'center_admin','active');
insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,created_by,updated_by)
values
    (${q(ids.center)},'student',${q(ids.student)},jsonb_build_object('id',${q(ids.student)}),'qa','c5.6',${u(users.a.id)},${u(users.a.id)}),
    (${q(ids.otherCenter)},'student',${q(ids.otherStudent)},jsonb_build_object('id',${q(ids.otherStudent)}),'qa','c5.6',${u(users.a.id)},${u(users.a.id)});`)
  const clientA = await signIn(emails.a)
  const clientB = await signIn(emails.b)
  const clientC = await signIn(emails.c)
  const clientTeacher = await signIn(emails.teacher)
  const freshClientB = await signIn(emails.b)

  const authoritativeEmpty = await pull(clientB)
  assert.equal(authoritativeEmpty.ok, true)
  assert.deepEqual(authoritativeEmpty.items, [])
  assert.deepEqual(authoritativeEmpty.movements, [])
  assert.deepEqual(authoritativeEmpty.requests, [])
  assert.equal(scalar(`select count(*) from public.center_inventory_items;`), '0')
  assert.equal(scalar(`select count(*) from public.center_inventory_requests;`), '0')
  console.log('C5_6_QA_EMPTY_SERVER_SAMPLE_FIXTURES_NOT_SEEDED: PASS')

  const createItemCommand = buildC56SaveItemCommand(itemDraft())
  const createItem = await mutate(clientA, createItemCommand)
  assert.equal(createItem.ok, true, JSON.stringify(createItem))
  const itemId = createItem.entity_id
  let atB = await pull(clientB)
  assert.equal(atB.ok, true)
  assert.equal(atB.items.length, 1)
  assert.equal(atB.items[0].id, itemId)
  assert.equal(atB.items[0].quantity, 10)
  assert.equal(atB.movements.length, 1)
  assert.equal(atB.movements[0].beforeQuantity, 0)
  assert.equal(atB.movements[0].afterQuantity, 10)
  assert.equal(atB.movements[0].actorUserId, users.a.id)

  const staleItem = structuredClone(atB.items[0])
  const editItem = await mutate(clientB, buildC56SaveItemCommand({
    ...atB.items[0], name: 'Bộ cờ C5.6 cập nhật', location: 'Kho B', quantity: 999,
  }))
  assert.equal(editItem.ok, true, JSON.stringify(editItem))
  const atAAfterEdit = await pull(clientA)
  assert.equal(atAAfterEdit.items[0].name, 'Bộ cờ C5.6 cập nhật')
  assert.equal(atAAfterEdit.items[0].quantity, 10, 'Metadata update must not edit stock')
  const staleEdit = await mutate(clientA, buildC56SaveItemCommand({ ...staleItem, note: 'stale' }))
  assert.equal(staleEdit.ok, false)
  assert.equal(staleEdit.outcome_code, 'VERSION_STALE')
  console.log('C5_6_QA_ITEM_A_TO_B_B_TO_A_STALE_QUANTITY_GUARD: PASS')

  let currentItem = atAAfterEdit.items[0]
  const outCommand = buildC56PostMovementCommand({
    type: 'out', quantity: 3, movementDate: '2026-08-14', reason: 'Cấp lớp', note: 'QA',
  }, currentItem)
  const retryKey = randomUUID()
  const outFirst = await mutate(clientB, outCommand, retryKey)
  const outReplay = await mutate(clientB, outCommand, retryKey)
  assert.deepEqual(outReplay, outFirst)
  assert.equal(outFirst.ok, true)
  const changedIntent = structuredClone(outCommand)
  changedIntent.quantity = 2
  const retryConflict = await mutate(clientB, changedIntent, retryKey)
  assert.equal(retryConflict.ok, false)
  assert.equal(retryConflict.outcome_code, 'IDEMPOTENCY_CONFLICT')
  let afterOut = await pull(clientA)
  assert.equal(afterOut.items[0].quantity, 7)
  assert.equal(afterOut.movements.filter((movement) => movement.id === outCommand.movement_id).length, 1)

  currentItem = afterOut.items[0]
  const raceCommands = [2, 3].map((quantity) => buildC56PostMovementCommand({
    type: 'in', quantity, movementDate: '2026-08-14', reason: 'Concurrent QA', note: '', costAmount: 0,
  }, currentItem))
  const race = await Promise.all([
    mutate(clientA, raceCommands[0]), mutate(clientB, raceCommands[1]),
  ])
  assert.equal(race.filter((result) => result.ok).length, 1)
  assert.equal(race.filter((result) => result.outcome_code === 'VERSION_STALE').length, 1)
  const afterRace = await pull(clientA)
  assert([9, 10].includes(afterRace.items[0].quantity))
  assert.equal(afterRace.movements.filter((row) => raceCommands.some((command) => command.movement_id === row.id)).length, 1)
  currentItem = afterRace.items[0]
  const beforeNegativeMovementCount = afterRace.movements.length
  const negative = await mutate(clientA, buildC56PostMovementCommand({
    type: 'out', quantity: currentItem.quantity + 1, movementDate: '2026-08-14',
    reason: 'Negative guard', note: '',
  }, currentItem))
  assert.equal(negative.ok, false)
  assert.equal(negative.outcome_code, 'NEGATIVE_STOCK')
  const afterNegative = await pull(clientB)
  assert.equal(afterNegative.items[0].quantity, currentItem.quantity)
  assert.equal(afterNegative.movements.length, beforeNegativeMovementCount)
  assert.equal(scalar(`select count(*) from public.center_inventory_movements where center_id=${q(ids.center)} and actor_user_id is null;`), '0')
  console.log('C5_6_QA_ATOMIC_MOVEMENT_CONCURRENCY_NEGATIVE_IDEMPOTENCY_AUDIT: PASS')

  const lastUnitCreate = await mutate(clientA, buildC56SaveItemCommand(itemDraft({
    name: 'Vật tư stock cuối C5.6', quantity: 1, lowStockThreshold: 0,
  })))
  assert.equal(lastUnitCreate.ok, true, JSON.stringify(lastUnitCreate))
  const lastUnitId = lastUnitCreate.entity_id
  const lastUnit = (await pull(clientA)).items.find((row) => row.id === lastUnitId)
  const lastUnitCommands = [clientA, clientB].map(() => buildC56PostMovementCommand({
    type: 'out', quantity: 1, movementDate: '2026-08-14',
    reason: 'Concurrent last-unit QA', note: '',
  }, lastUnit))
  const lastUnitRace = await Promise.all([
    mutate(clientA, lastUnitCommands[0]),
    mutate(clientB, lastUnitCommands[1]),
  ])
  assert.equal(lastUnitRace.filter((result) => result.ok).length, 1)
  assert.equal(lastUnitRace.filter((result) => result.outcome_code === 'VERSION_STALE').length, 1)
  const lastUnitAfter = await pull(clientB)
  assert.equal(lastUnitAfter.items.find((row) => row.id === lastUnitId).quantity, 0)
  assert.equal(lastUnitAfter.movements.filter((row) =>
    lastUnitCommands.some((command) => command.movement_id === row.id)).length, 1)
  const beforeFulfillmentMovementCount = lastUnitAfter.movements.length
  console.log('C5_6_QA_TWO_ACCOUNTS_DEDUCT_FINAL_UNIT_EXACTLY_ONCE: PASS')

  const requestCommand = buildC56CreateRequestCommand(requestDraft())
  const requestKey = randomUUID()
  const requestCreate = await mutate(clientB, requestCommand, requestKey)
  assert.equal(requestCreate.ok, true, JSON.stringify(requestCreate))
  assert.deepEqual(await mutate(clientB, requestCommand, requestKey), requestCreate)
  const changedRequest = structuredClone(requestCommand)
  changedRequest.item_details = 'Changed intent'
  assert.equal((await mutate(clientB, changedRequest, requestKey)).outcome_code, 'IDEMPOTENCY_CONFLICT')
  let requestAtA = (await pull(clientA)).requests[0]
  assert.match(requestAtA.requestCode, /^DXK-\d{8}-\d{4,}$/)
  assert.equal(requestAtA.requestedByPhone, '')
  assert.equal(requestAtA.createdByUserId, users.b.id)
  assert.equal(requestAtA.linkedStudentId, ids.student)
  assert.equal(scalar(`select count(*) from public.center_inventory_requests where center_id=${q(ids.center)};`), '1')

  const crossStudentCommand = buildC56CreateRequestCommand(requestDraft({
    linkedStudentId: ids.otherStudent, itemDetails: 'Wrong-center student',
  }))
  const crossStudent = await mutate(clientA, crossStudentCommand)
  assert.equal(crossStudent.ok, false)
  assert.equal(crossStudent.outcome_code, 'STUDENT_REFERENCE_DENIED')
  const invalidJump = await mutate(clientA, buildC56UpdateRequestStatusCommand(requestAtA, {
    status: 'fulfilled', adminNote: 'Không được nhảy cóc',
  }))
  assert.equal(invalidJump.ok, false)
  assert.equal(invalidJump.outcome_code, 'INVALID_WORKFLOW_TRANSITION')
  assert.equal((await pull(clientA)).requests[0].status, 'new')

  for (const status of ['pending', 'preparing', 'fulfilled']) {
    requestAtA = (await pull(clientA)).requests[0]
    const result = await mutate(clientA, buildC56UpdateRequestStatusCommand(requestAtA, {
      status, adminNote: `C5.6 ${status}`,
    }))
    assert.equal(result.ok, true, JSON.stringify(result))
  }
  const beforeFulfillmentStock = currentItem.quantity
  const fulfilled = (await pull(clientB)).requests[0]
  assert.equal(fulfilled.status, 'fulfilled')
  assert.equal(fulfilled.handledBy, 'owner')
  assert(fulfilled.handledAt)
  const afterFulfillment = await pull(clientA)
  assert.equal(afterFulfillment.items.find((row) => row.id === currentItem.id).quantity, beforeFulfillmentStock)
  assert.equal(afterFulfillment.movements.length, beforeFulfillmentMovementCount)
  assert.equal(scalar(`select count(*) from public.finance_transaction where center_id=${q(ids.center)};`), '0')
  console.log('C5_6_QA_REQUEST_ACTOR_STUDENT_WORKFLOW_FULFILLMENT_STOCK_FINANCE_BOUNDARY: PASS')

  const concurrentRequestCreate = await mutate(clientA, buildC56CreateRequestCommand(requestDraft({
    linkedStudentId: '', itemDetails: 'Concurrent transition request',
  })))
  assert.equal(concurrentRequestCreate.ok, true)
  let concurrentRequest = (await pull(clientA)).requests.find((row) => row.id === concurrentRequestCreate.entity_id)
  assert.equal((await mutate(clientA, buildC56UpdateRequestStatusCommand(concurrentRequest, {
    status: 'pending', adminNote: '',
  }))).ok, true)
  concurrentRequest = (await pull(clientA)).requests.find((row) => row.id === concurrentRequestCreate.entity_id)
  const concurrentTransitions = await Promise.all([
    mutate(clientA, buildC56UpdateRequestStatusCommand(concurrentRequest, { status: 'preparing', adminNote: 'A' })),
    mutate(clientB, buildC56UpdateRequestStatusCommand(concurrentRequest, { status: 'cancelled', adminNote: 'B' })),
  ])
  assert.equal(concurrentTransitions.filter((result) => result.ok).length, 1)
  assert.equal(concurrentTransitions.filter((result) => result.outcome_code === 'VERSION_STALE').length, 1)
  console.log('C5_6_QA_CONCURRENT_REQUEST_TRANSITION_NO_LOST_UPDATE: PASS')

  const directRead = await clientA.from('center_inventory_items').select('*')
  assert(directRead.error)
  const crossRead = await pull(clientC, ids.center)
  assert.equal(crossRead.ok, false)
  assert.equal(crossRead.outcome_code, 'CENTER_ACCESS_DENIED')
  const crossWrite = await mutate(clientC, buildC56SaveItemCommand(itemDraft({ name: 'Leak attempt' })))
  assert.equal(crossWrite.ok, false)
  assert.equal(crossWrite.outcome_code, 'CENTER_ACCESS_DENIED')
  const teacherRead = await pull(clientTeacher)
  assert.equal(teacherRead.ok, true)
  const teacherWrite = await mutate(clientTeacher, buildC56SaveItemCommand(itemDraft({ name: 'Teacher write' })))
  assert.equal(teacherWrite.ok, false)
  assert.equal(teacherWrite.outcome_code, 'WRITE_ROLE_REQUIRED')
  const ownerOther = await pull(clientA, ids.otherCenter)
  assert.equal(ownerOther.ok, true)
  assert.equal(ownerOther.items.length, 0)
  assert.equal(ownerOther.requests.length, 0)
  const ownerBack = await pull(clientA, ids.center)
  assert(ownerBack.items.some((row) => row.id === itemId))
  const fresh = await pull(freshClientB)
  assert.equal(fresh.items.find((row) => row.id === itemId).quantity, beforeFulfillmentStock)
  assert(fresh.requests.some((row) => row.status === 'fulfilled'))
  assert.equal(scalar(`select count(*) from public.center_inventory_items where center_id=${q(ids.otherCenter)};`), '0')
  console.log('C5_6_QA_FRESH_SAME_CENTER_CROSS_CENTER_OWNER_SWITCH_ROLE_DIRECT_TABLE: PASS')

  const archiveTarget = fresh.items.find((row) => row.id === itemId)
  const archiveTargetMovementIds = fresh.movements
    .filter((row) => row.itemId === archiveTarget.id)
    .map((row) => row.id)
    .sort()
  assert(archiveTargetMovementIds.length > 0)
  const archive = await mutate(clientA, {
    operation: 'ARCHIVE_ITEM', item_id: archiveTarget.id,
    expected_version: archiveTarget.cloudVersion,
  })
  assert.equal(archive.ok, true)
  const afterArchive = await pull(clientB)
  assert.equal(afterArchive.items.find((row) => row.id === archiveTarget.id).isArchived, true)
  assert.deepEqual(afterArchive.movements
    .filter((row) => row.itemId === archiveTarget.id)
    .map((row) => row.id)
    .sort(), archiveTargetMovementIds)
  assert(afterArchive.requests.some((row) => row.status === 'fulfilled'))
  assert.equal(scalar(`select count(*) from public.center_inventory_items where center_id=${q(ids.center)} and id=${u(archiveTarget.id)};`), '1')
  console.log('C5_6_QA_ARCHIVE_PRESERVES_ITEM_AND_MOVEMENT_HISTORY: PASS')
} finally {
  if (fixtureCreated) {
    runReset()
    containerId = discoverContainer()
    finalResetVerified = true
  }
}

assert.equal(finalResetVerified, true)
console.log('C5_6_QA_FINAL_LOCAL_RESET: PASS')
console.log('C5_6_INVENTORY_AUTHORITATIVE_SHARED_TRUTH_LOCAL_DB_QA: PASS')
