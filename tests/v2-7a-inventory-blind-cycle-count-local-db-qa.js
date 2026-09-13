import assert from 'node:assert/strict'
import fs from 'node:fs'
import { randomUUID, webcrypto } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import {
  buildC56ArchiveItemCommand,
  buildC56PostMovementCommand,
  buildC56SaveItemCommand,
  mutateC56InventorySharedTruth,
  pullC56InventorySharedTruth,
} from '../src/cloud-authoritative-inventory.js'
import {
  buildV27ACancelCycleCountCommand,
  buildV27AReconcileCycleCountCommand,
  buildV27AStartCycleCountCommand,
  buildV27ASubmitCycleCountCommand,
  mutateV27AInventoryCycleCount,
  pullV27AInventoryCycleCounts,
} from '../src/cloud-authoritative-inventory-cycle-count.js'
import { buildInventoryDueNotificationCandidates } from '../src/notification-center.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const projectSlug = 'ichess-center-os'
const expectedContainer = 'supabase_db_ichess-center-os'
const consentFlag = 'ICHESS_V2_7A_LOCAL_QA_ALLOW_RESET'
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
const psqlArgs = () => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql) => requireSuccess(run('docker', psqlArgs(), { input: sql }), 'psql')
const scalar = (sql) => psql(sql).trim()
const runReset = () => {
  const reset = run(cliCommand, cliArgs('db reset'), { timeout: 300_000 })
  if (reset.status === 0) return reset.stdout
  const resetOutput = `${reset.stdout}\n${reset.stderr}`
  if (!resetOutput.includes('DROP EXTENSION pg_net')) {
    throw new Error(`local db reset: ${resetOutput}`)
  }
  // The current local CLI image no longer pre-installs pg_net before the
  // frozen baseline migration drops it. Seed only this disposable local DB,
  // then resume the unchanged repository migration chain.
  containerId = discoverContainer()
  psql('create extension if not exists pg_net;')
  const resume = run(cliCommand, cliArgs('migration up --local --include-all'), { timeout: 300_000 })
  if (resume.status === 0) return resume.stdout
  const resumeOutput = `${resume.stdout}\n${resume.stderr}`
  if (!resumeOutput.includes('C5.1 DreamHome repair stopped: active Schedule count is 0, expected 9')) {
    throw new Error(`local migration resume after frozen pg_net baseline mismatch: ${resumeOutput}`)
  }
  const migrationSource = fs.readFileSync(
    new URL('../supabase/migrations/202609130001_v2_7a_inventory_blind_cycle_count.sql', import.meta.url),
    'utf8',
  )
  psql(migrationSource)
  psql(`insert into supabase_migrations.schema_migrations(version,statements,name)
    values ('202609130001',array['targeted local V2-7A QA application'],'v2_7a_inventory_blind_cycle_count')
    on conflict (version) do nothing;
  notify pgrst, 'reload schema';`)
  return resumeOutput
}
const q = (value) => value === null || value === undefined
  ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`

const suffix = randomUUID()
const password = `V2.7A!${randomUUID()}aA1`
const ids = {
  center: `v2-7a-${randomUUID()}`,
  otherCenter: `v2-7a-${randomUUID()}`,
}
const emails = Object.fromEntries(['owner', 'admin', 'teacher', 'outsider']
  .map((key) => [key, `v2.7a.${key}.${suffix}@example.invalid`]))
let adminClient
let fixtureCreated = false
let finalResetVerified = false

const makeClient = () => createClient(localStatus.API_URL, localStatus.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const makeUser = async (email) => {
  const { data, error } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true })
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
const pullInventory = (client, centerId = ids.center) =>
  pullC56InventorySharedTruth({ supabase: client, centerId })
const mutateInventory = (client, command, idempotencyKey = randomUUID(), centerId = ids.center) =>
  mutateC56InventorySharedTruth({ supabase: client, centerId, command, idempotencyKey })
const pullCounts = (client, centerId = ids.center) =>
  pullV27AInventoryCycleCounts({ supabase: client, centerId })
const mutateCount = (client, command, idempotencyKey = randomUUID(), centerId = ids.center) =>
  mutateV27AInventoryCycleCount({ supabase: client, centerId, command, idempotencyKey })
const itemDraft = (name, quantity) => ({
  name, category: 'Bàn cờ / quân cờ', unit: 'Bộ', quantity,
  lowStockThreshold: 1, condition: 'Đang dùng', location: 'Kho QA', note: 'V2-7A QA',
})

console.log('V2_7A_QA_LOCAL_SAFETY_GUARD: PASS')

try {
  runReset()
  containerId = discoverContainer()
  localStatus = getLocalStatus()
  fixtureCreated = true

  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202609130001' and name='v2_7a_inventory_blind_cycle_count';`), '1')
  for (const table of [
    'center_inventory_cycle_counts', 'center_inventory_cycle_count_lines',
    'center_inventory_cycle_count_audit_events', 'center_inventory_cycle_count_command_results',
  ]) {
    assert.equal(scalar(`select (c.relrowsecurity and c.relforcerowsecurity)::text from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=${q(table)};`), 'true')
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal(scalar(`select has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT,INSERT,UPDATE,DELETE');`), 'f')
    }
  }
  assert.equal(scalar(`select has_function_privilege('authenticated','public.v2_7a_list_inventory_cycle_counts(text)','EXECUTE')::text;`), 'true')
  assert.equal(scalar(`select has_function_privilege('anon','public.v2_7a_list_inventory_cycle_counts(text)','EXECUTE')::text;`), 'false')
  assert.equal(scalar(`select has_function_privilege('authenticated','public.v2_7a_mutate_inventory_cycle_count(text,jsonb,uuid)','EXECUTE')::text;`), 'true')
  console.log('V2_7A_QA_SCHEMA_RLS_ACL: PASS')

  adminClient = createClient(localStatus.API_URL, localStatus.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const users = {
    owner: await makeUser(emails.owner),
    admin: await makeUser(emails.admin),
    teacher: await makeUser(emails.teacher),
    outsider: await makeUser(emails.outsider),
  }
  psql(`insert into public.centers(id,name,status) values
    (${q(ids.center)},'V2-7A primary','active'),
    (${q(ids.otherCenter)},'V2-7A other','active');
  insert into public.center_members(center_id,user_id,role,status) values
    (${q(ids.center)},${u(users.owner.id)},'owner','active'),
    (${q(ids.center)},${u(users.admin.id)},'center_admin','active'),
    (${q(ids.center)},${u(users.teacher.id)},'teacher','active'),
    (${q(ids.otherCenter)},${u(users.owner.id)},'owner','active'),
    (${q(ids.otherCenter)},${u(users.outsider.id)},'center_admin','active');`)
  const owner = await signIn(emails.owner)
  const centerAdmin = await signIn(emails.admin)
  const teacher = await signIn(emails.teacher)
  const outsider = await signIn(emails.outsider)

  const itemOneResult = await mutateInventory(owner, buildC56SaveItemCommand(itemDraft('Bộ cờ V2-7A', 10)))
  const itemTwoResult = await mutateInventory(centerAdmin, buildC56SaveItemCommand(itemDraft('Đồng hồ V2-7A', 5)))
  const archivedResult = await mutateInventory(owner, buildC56SaveItemCommand(itemDraft('Vật tư lưu trữ', 3)))
  assert(itemOneResult.ok && itemTwoResult.ok && archivedResult.ok)
  const inventoryBeforeArchive = await pullInventory(owner)
  const archivedItem = inventoryBeforeArchive.items.find((item) => item.id === archivedResult.entity_id)
  assert.equal((await mutateInventory(owner, buildC56ArchiveItemCommand(archivedItem))).ok, true)
  const financeBefore = scalar(`select count(*) from public.finance_transaction where center_id=${q(ids.center)};`)

  const yesterday = scalar(`select (current_date - 1)::text;`)
  const firstStartCommand = buildV27AStartCycleCountCommand(yesterday)
  const firstStartKey = randomUUID()
  const firstStart = await mutateCount(owner, firstStartCommand, firstStartKey)
  assert.equal(firstStart.ok, true, JSON.stringify(firstStart))
  assert.deepEqual(await mutateCount(owner, firstStartCommand, firstStartKey), firstStart)
  const changedStart = { ...firstStartCommand, due_date: '2999-01-01' }
  assert.equal((await mutateCount(owner, changedStart, firstStartKey)).outcome_code, 'IDEMPOTENCY_CONFLICT')

  let firstCount = (await pullCounts(centerAdmin)).counts.find((count) => count.id === firstStart.entity_id)
  assert(firstCount)
  assert.equal(firstCount.isBlind, true)
  assert.equal(firstCount.dueState, 'overdue')
  assert.equal(firstCount.lines.length, 2, 'Only active exact-center items belong to the count')
  assert(!JSON.stringify(firstCount).includes('expectedQuantity'))
  assert(!JSON.stringify(firstCount).includes('variance'))
  assert(firstCount.lines.every((line) => line.observedQuantity === undefined))
  const overdueSignal = buildInventoryDueNotificationCandidates([firstCount], {
    centerId: ids.center, today: yesterday,
  })
  assert.equal(overdueSignal.length, 1)
  assert.equal(overdueSignal[0].severity, 'danger')
  console.log('V2_7A_QA_ACTIVE_SCOPE_BLIND_PROJECTION_OVERDUE_SIGNAL: PASS')

  const missingSubmit = {
    operation: 'SUBMIT_COUNT', count_id: firstCount.id,
    expected_version: firstCount.cloudVersion, lines: [],
  }
  assert.equal((await mutateCount(owner, missingSubmit)).outcome_code, 'COUNT_SCOPE_MISMATCH')
  assert.equal((await mutateCount(owner, {
    operation: 'SUBMIT_COUNT', count_id: firstCount.id,
    expected_version: firstCount.cloudVersion,
  })).outcome_code, 'INVALID_PAYLOAD')
  const observedByLine = Object.fromEntries(firstCount.lines.map((line) => [
    line.id,
    line.itemId === itemOneResult.entity_id ? 10 : 7,
  ]))
  const submitCommand = buildV27ASubmitCycleCountCommand(firstCount, observedByLine)
  const submitKey = randomUUID()
  const submitResult = await mutateCount(centerAdmin, submitCommand, submitKey)
  assert.equal(submitResult.ok, true, JSON.stringify(submitResult))
  assert.deepEqual(await mutateCount(centerAdmin, submitCommand, submitKey), submitResult)
  const changedSubmit = structuredClone(submitCommand)
  changedSubmit.lines[0].observed_quantity += 1
  assert.equal((await mutateCount(centerAdmin, changedSubmit, submitKey)).outcome_code, 'IDEMPOTENCY_CONFLICT')

  firstCount = (await pullCounts(owner)).counts.find((count) => count.id === firstCount.id)
  assert.equal(firstCount.status, 'submitted')
  assert.equal(firstCount.isBlind, false)
  assert(firstCount.lines.every((line) => Number.isSafeInteger(line.expectedQuantity)))
  assert.equal(firstCount.lines.filter((line) => line.variance !== 0).length, 1)
  let inventoryAfterSubmit = await pullInventory(owner)
  assert.equal(inventoryAfterSubmit.items.find((item) => item.id === itemOneResult.entity_id).quantity, 10)
  assert.equal(inventoryAfterSubmit.items.find((item) => item.id === itemTwoResult.entity_id).quantity, 5)
  console.log('V2_7A_QA_SUBMIT_FREEZES_AND_REVEALS_WITHOUT_STOCK_MUTATION: PASS')

  const movementCountBeforeReconcile = Number(scalar(`select count(*) from public.center_inventory_movements where center_id=${q(ids.center)};`))
  assert.equal((await mutateCount(owner, {
    operation: 'RECONCILE_COUNT', count_id: firstCount.id,
    expected_version: firstCount.cloudVersion, explanations: [],
  })).outcome_code, 'EXPLANATION_REQUIRED')
  assert.equal((await mutateCount(owner, {
    operation: 'RECONCILE_COUNT', count_id: firstCount.id,
    expected_version: firstCount.cloudVersion,
  })).outcome_code, 'INVALID_PAYLOAD')
  const discrepancyLine = firstCount.lines.find((line) => line.variance !== 0)
  const reconcileCommand = buildV27AReconcileCycleCountCommand(firstCount, {
    [discrepancyLine.id]: 'Phát hiện thêm hai đơn vị tại khu thi đấu.',
  })
  const reconcileKey = randomUUID()
  const reconcileResult = await mutateCount(owner, reconcileCommand, reconcileKey)
  assert.equal(reconcileResult.ok, true, JSON.stringify(reconcileResult))
  assert.equal(reconcileResult.adjustment_count, 1)
  assert.deepEqual(await mutateCount(owner, reconcileCommand, reconcileKey), reconcileResult)
  const changedReconcile = structuredClone(reconcileCommand)
  changedReconcile.explanations[0].explanation = 'Nội dung khác'
  assert.equal((await mutateCount(owner, changedReconcile, reconcileKey)).outcome_code, 'IDEMPOTENCY_CONFLICT')

  const reconciledInventory = await pullInventory(centerAdmin)
  assert.equal(reconciledInventory.items.find((item) => item.id === itemTwoResult.entity_id).quantity, 7)
  assert.equal(reconciledInventory.movements.length, movementCountBeforeReconcile + 1)
  const adjustment = reconciledInventory.movements.find(
    (movement) => movement.itemId === itemTwoResult.entity_id && movement.note.includes('Phát hiện thêm'),
  )
  assert(adjustment)
  assert.equal(adjustment.type, 'in')
  assert.equal(adjustment.beforeQuantity, 5)
  assert.equal(adjustment.afterQuantity, 7)
  assert.equal(adjustment.actorUserId, users.owner.id)
  firstCount = (await pullCounts(owner)).counts.find((count) => count.id === firstCount.id)
  assert.equal(firstCount.status, 'reconciled')
  assert.equal(firstCount.lines.find((line) => line.variance !== 0).reconciliationMovementId, adjustment.id)
  assert.equal(buildInventoryDueNotificationCandidates([firstCount], { centerId: ids.center }).length, 0)
  assert.equal((await mutateCount(owner, {
    operation: 'CANCEL_COUNT', count_id: firstCount.id, expected_version: firstCount.cloudVersion,
  })).outcome_code, 'INVALID_WORKFLOW_TRANSITION')
  assert.equal(scalar(`select count(*) from public.finance_transaction where center_id=${q(ids.center)};`), financeBefore)
  console.log('V2_7A_QA_EXPLANATION_MOVEMENT_IDEMPOTENCY_FINANCE_ZERO: PASS')

  const today = scalar('select current_date::text;')
  const cancelStart = await mutateCount(centerAdmin, buildV27AStartCycleCountCommand(today))
  assert.equal(cancelStart.ok, true)
  let cancelCount = (await pullCounts(owner)).counts.find((count) => count.id === cancelStart.entity_id)
  assert.equal(cancelCount.dueState, 'due')
  assert.equal(buildInventoryDueNotificationCandidates([cancelCount], { centerId: ids.center }).length, 1)
  const stockBeforeCancel = JSON.stringify((await pullInventory(owner)).items.map((item) => [item.id, item.quantity]))
  const movementsBeforeCancel = scalar(`select count(*) from public.center_inventory_movements where center_id=${q(ids.center)};`)
  assert.equal((await mutateCount(centerAdmin, buildV27ACancelCycleCountCommand(cancelCount))).ok, true)
  cancelCount = (await pullCounts(owner)).counts.find((count) => count.id === cancelCount.id)
  assert.equal(cancelCount.status, 'cancelled')
  assert.equal(cancelCount.isBlind, true)
  assert(!JSON.stringify(cancelCount).includes('expectedQuantity'))
  assert.equal(buildInventoryDueNotificationCandidates([cancelCount], { centerId: ids.center }).length, 0)
  assert.equal(JSON.stringify((await pullInventory(owner)).items.map((item) => [item.id, item.quantity])), stockBeforeCancel)
  assert.equal(scalar(`select count(*) from public.center_inventory_movements where center_id=${q(ids.center)};`), movementsBeforeCancel)
  console.log('V2_7A_QA_DUE_SIGNAL_CANCEL_NO_STOCK_AND_SIGNAL_RESOLVES: PASS')

  const staleStart = await mutateCount(owner, buildV27AStartCycleCountCommand(today))
  assert.equal(staleStart.ok, true)
  let staleCount = (await pullCounts(owner)).counts.find((count) => count.id === staleStart.entity_id)
  const currentInventory = await pullInventory(owner)
  const observedCurrent = Object.fromEntries(staleCount.lines.map((line) => [
    line.id,
    currentInventory.items.find((item) => item.id === line.itemId).quantity,
  ]))
  assert.equal((await mutateCount(owner, buildV27ASubmitCycleCountCommand(staleCount, observedCurrent))).ok, true)
  staleCount = (await pullCounts(owner)).counts.find((count) => count.id === staleCount.id)
  const itemOne = (await pullInventory(owner)).items.find((item) => item.id === itemOneResult.entity_id)
  const intervening = await mutateInventory(centerAdmin, buildC56PostMovementCommand({
    type: 'in', quantity: 1, movementDate: today,
    reason: 'Chuyển kho hợp lệ trong lúc kiểm kê', note: 'V2-7A stale race', costAmount: 0,
  }, itemOne))
  assert.equal(intervening.ok, true)
  const staleReconcile = await mutateCount(owner, buildV27AReconcileCycleCountCommand(staleCount, {}))
  assert.equal(staleReconcile.ok, false)
  assert.equal(staleReconcile.outcome_code, 'VERSION_STALE')
  const afterStale = await pullInventory(owner)
  assert.equal(afterStale.items.find((item) => item.id === itemOne.id).quantity, itemOne.quantity + 1)
  assert.equal((await mutateCount(owner, buildV27ACancelCycleCountCommand(staleCount))).ok, true)
  console.log('V2_7A_QA_INTERVENING_MOVEMENT_STALE_RECONCILE_NO_LOST_UPDATE: PASS')

  const balancedStart = await mutateCount(owner, buildV27AStartCycleCountCommand(today))
  assert.equal(balancedStart.ok, true)
  let balancedCount = (await pullCounts(centerAdmin)).counts.find(
    (count) => count.id === balancedStart.entity_id,
  )
  const balancedInventory = await pullInventory(owner)
  const balancedObserved = Object.fromEntries(balancedCount.lines.map((line) => [
    line.id,
    balancedInventory.items.find((item) => item.id === line.itemId).quantity,
  ]))
  assert.equal((await mutateCount(centerAdmin,
    buildV27ASubmitCycleCountCommand(balancedCount, balancedObserved))).ok, true)
  balancedCount = (await pullCounts(owner)).counts.find((count) => count.id === balancedCount.id)
  assert(balancedCount.lines.every((line) => line.variance === 0))
  const movementCountBeforeBalanced = scalar(`select count(*) from public.center_inventory_movements where center_id=${q(ids.center)};`)
  const balancedResult = await mutateCount(owner,
    buildV27AReconcileCycleCountCommand(balancedCount, {}))
  assert.equal(balancedResult.ok, true)
  assert.equal(balancedResult.adjustment_count, 0)
  assert.equal(scalar(`select count(*) from public.center_inventory_movements where center_id=${q(ids.center)};`), movementCountBeforeBalanced)
  assert.equal((await pullCounts(owner)).counts.find(
    (count) => count.id === balancedCount.id,
  ).status, 'reconciled')
  console.log('V2_7A_QA_ZERO_VARIANCE_COMPLETES_WITHOUT_MOVEMENT: PASS')

  assert.equal((await pullCounts(teacher)).ok, true)
  assert.equal((await mutateCount(teacher, buildV27AStartCycleCountCommand(today))).outcome_code, 'WRITE_ROLE_REQUIRED')
  assert.equal((await pullCounts(outsider)).outcome_code, 'CENTER_ACCESS_DENIED')
  assert.equal((await mutateCount(outsider, buildV27AStartCycleCountCommand(today))).outcome_code, 'CENTER_ACCESS_DENIED')
  const directRead = await owner.from('center_inventory_cycle_counts').select('*')
  const directWrite = await owner.from('center_inventory_cycle_counts').insert({
    center_id: ids.center, id: randomUUID(), count_code: 'KKK-20990101-9999',
    due_date: today, status: 'DRAFT', item_count: 1,
  })
  assert(directRead.error)
  assert(directWrite.error)
  const otherCenterProjection = await pullCounts(owner, ids.otherCenter)
  assert.equal(otherCenterProjection.ok, true)
  assert.deepEqual(otherCenterProjection.counts, [])
  const backToPrimary = await pullCounts(owner, ids.center)
  assert(backToPrimary.counts.length >= 3)
  assert(backToPrimary.counts.every((count) => count.centerId === ids.center))
  assert.equal(scalar(`select count(*) from public.center_inventory_cycle_count_audit_events where center_id=${q(ids.center)};`), '11')
  assert.equal(scalar(`select count(*) from public.finance_transaction where center_id=${q(ids.center)};`), financeBefore)
  console.log('V2_7A_QA_ROLE_DIRECT_TABLE_CROSS_CENTER_AUDIT_FINANCE_BOUNDARY: PASS')
} finally {
  if (fixtureCreated) {
    runReset()
    containerId = discoverContainer()
    finalResetVerified = true
  }
}

assert.equal(finalResetVerified, true)
console.log('V2_7A_QA_FINAL_LOCAL_RESET_RESIDUE_ZERO: PASS')
console.log('V2_7A_INVENTORY_BLIND_CYCLE_COUNT_LOCAL_DB_QA: PASS')
