import assert from 'node:assert/strict'
import { randomUUID, webcrypto } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import {
  buildC54ArchiveCategoryCommand,
  buildC54CloseReconciliationCommand,
  buildC54SaveCategoryCommand,
  buildC54SaveSettingsCommand,
  buildC54SaveTransactionCommand,
  buildC54UpsertReconciliationCommand,
  buildC54VoidTransactionCommand,
  mutateC54FinanceSharedTruth,
  pullC54FinanceSharedTruth,
} from '../src/cloud-authoritative-finance.js'

if (!globalThis.crypto) globalThis.crypto = webcrypto

const projectSlug = 'ichess-center-os'
const expectedContainer = 'supabase_db_ichess-center-os'
const consentFlag = 'ICHESS_C5_4_LOCAL_QA_ALLOW_RESET'
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
  assert.equal(rows.length, 1, 'Expected exactly one local DB container')
  assert(/supabase\/postgres/i.test(rows[0][2]))
  return rows[0][0]
}
let containerId = discoverContainer()
const runReset = () => requireSuccess(run(cliCommand, cliArgs('db reset'), { timeout: 300_000 }), 'local db reset')
const psqlArgs = (user = 'postgres') => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', user,
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql, user = 'postgres') => requireSuccess(run('docker', psqlArgs(user), { input: sql }), 'psql')
const scalar = (sql, user = 'postgres') => psql(sql, user).trim()
const q = (value) => value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`

const suffix = randomUUID()
const password = `C5.4!${randomUUID()}aA1`
const ids = {
  center: `c5-4-${randomUUID()}`,
  otherCenter: `c5-4-${randomUUID()}`,
}
const emails = Object.fromEntries(['a', 'b', 'c', 'teacher']
  .map((key) => [key, `c5.4.${key}.${suffix}@example.invalid`]))
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
const mutate = (client, command, idempotencyKey = randomUUID(), centerId = ids.center) =>
  mutateC54FinanceSharedTruth({ supabase: client, centerId, command, idempotencyKey })
const manualTransaction = (overrides = {}) => ({
  id: `local-${randomUUID()}`,
  type: 'income',
  category: 'Khác',
  amount: 125000,
  transactionDate: '2026-08-14',
  method: 'Tiền mặt',
  personName: 'Synthetic payer',
  recordedBy: 'Owner A',
  note: 'C5.4 synthetic transaction',
  sourceModule: 'manual',
  ...overrides,
})

console.log('C5_4_QA_LOCAL_SAFETY_GUARD: PASS')

try {
  runReset()
  containerId = discoverContainer()
  localStatus = getLocalStatus()
  fixtureCreated = true

  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608140005' and name='c5_4_finance_cashbook_authoritative_shared_truth';`), '1')
  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608140006' and name='c5_4_reconciliation_currentness_hardening';`), '1')
  const financeTables = [
    'finance_category', 'finance_transaction', 'finance_cashbook_settings',
    'finance_reconciliation', 'finance_transaction_attachment_binding',
    'finance_audit_event', 'finance_command_result',
  ]
  for (const table of financeTables) {
    assert.equal(scalar(`select (c.relrowsecurity and c.relforcerowsecurity)::text from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=${q(table)};`), 'true')
    assert.equal(scalar(`select count(*) from pg_catalog.pg_policies where schemaname='public' and tablename=${q(table)};`), '0')
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal(scalar(`select has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT,INSERT,UPDATE,DELETE');`), 'f')
    }
  }
  assert.equal(scalar(`select has_function_privilege('authenticated','public.c5_4_list_finance_shared_truth(text)','EXECUTE')::text;`), 'true')
  assert.equal(scalar(`select has_function_privilege('anon','public.c5_4_list_finance_shared_truth(text)','EXECUTE')::text;`), 'false')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename like 'finance_%';`), '0')
  console.log('C5_4_QA_SCHEMA_RLS_ACL_REFRESH_ONLY: PASS')

  admin = createClient(localStatus.API_URL, localStatus.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const users = {
    a: await makeUser(emails.a),
    b: await makeUser(emails.b),
    c: await makeUser(emails.c),
    teacher: await makeUser(emails.teacher),
  }
  psql(`insert into public.centers(id,name,status) values
    (${q(ids.center)},'C5.4 primary','active'),
    (${q(ids.otherCenter)},'C5.4 other','active');
insert into public.center_members(center_id,user_id,role,status) values
    (${q(ids.center)},${u(users.a.id)},'owner','active'),
    (${q(ids.otherCenter)},${u(users.a.id)},'owner','active'),
    (${q(ids.center)},${u(users.b.id)},'center_admin','active'),
    (${q(ids.otherCenter)},${u(users.c.id)},'owner','active'),
    (${q(ids.center)},${u(users.teacher.id)},'teacher','active');`)

  const [clientA, clientB, clientC, clientTeacher, freshClientA] = await Promise.all([
    signIn(emails.a), signIn(emails.b), signIn(emails.c), signIn(emails.teacher), signIn(emails.a),
  ])
  const initialA = await pullC54FinanceSharedTruth({ supabase: clientA, centerId: ids.center })
  assert.equal(initialA.ok, true, JSON.stringify(initialA))
  assert.equal(initialA.transactions.length, 0)
  assert.equal(initialA.categories.length, 10)
  const otherCategory = initialA.categories.find((category) => category.name === 'Khác')
  const tuitionCategory = initialA.categories.find((category) => category.name === 'Học phí')
  assert(otherCategory && tuitionCategory)

  const createCommand = buildC54SaveTransactionCommand(manualTransaction(), { category: otherCategory })
  const createKey = randomUUID()
  const created = await mutate(clientA, createCommand, createKey)
  assert.equal(created.ok, true, JSON.stringify(created))
  assert.equal(created.replayed, false)
  const replayed = await mutate(clientA, createCommand, createKey)
  assert.equal(replayed.ok, true)
  assert.equal(replayed.replayed, true)
  const idempotencyConflict = await mutate(clientA, { ...createCommand, amount_minor: 125001 }, createKey)
  assert.equal(idempotencyConflict.ok, false)
  assert.equal(idempotencyConflict.outcome_code, 'IDEMPOTENCY_CONFLICT')

  const readB = await pullC54FinanceSharedTruth({ supabase: clientB, centerId: ids.center })
  assert.equal(readB.ok, true)
  assert.equal(readB.transactions.length, 1)
  assert.equal(readB.transactions[0].amount, 125000)
  assert.equal(readB.transactions[0].cloudVersion, 1)
  const staleA = readB.transactions[0]
  const editedB = await mutate(clientB, buildC54SaveTransactionCommand({
    ...readB.transactions[0], note: 'B authoritative edit', amount: 150000,
  }, { category: otherCategory }))
  assert.equal(editedB.ok, true, JSON.stringify(editedB))
  const staleEditA = await mutate(clientA, buildC54SaveTransactionCommand({
    ...staleA, note: 'A stale overwrite',
  }, { category: otherCategory }))
  assert.equal(staleEditA.ok, false)
  assert.equal(staleEditA.outcome_code, 'VERSION_STALE')
  const afterEditA = await pullC54FinanceSharedTruth({ supabase: clientA, centerId: ids.center })
  assert.equal(afterEditA.transactions[0].note, 'B authoritative edit')
  assert.equal(afterEditA.transactions[0].amount, 150000)
  console.log('C5_4_QA_A_CREATE_B_SEES_B_EDIT_A_SEES_STALE_FAIL: PASS')

  const fresh = await pullC54FinanceSharedTruth({ supabase: freshClientA, centerId: ids.center })
  const otherC = await pullC54FinanceSharedTruth({ supabase: clientC, centerId: ids.otherCenter })
  const ownerSwitchOther = await pullC54FinanceSharedTruth({ supabase: clientA, centerId: ids.otherCenter })
  const ownerSwitchBack = await pullC54FinanceSharedTruth({ supabase: clientA, centerId: ids.center })
  assert.equal(fresh.transactions.length, 1)
  assert.equal(otherC.transactions.length, 0)
  assert.equal(ownerSwitchOther.transactions.length, 0)
  assert.equal(ownerSwitchBack.transactions.length, 1)
  const deniedCrossCenter = await pullC54FinanceSharedTruth({ supabase: clientB, centerId: ids.otherCenter })
  assert.equal(deniedCrossCenter.ok, false)
  assert.equal(deniedCrossCenter.outcome_code, 'CENTER_ACCESS_DENIED')
  console.log('C5_4_QA_FRESH_DIFFERENT_CENTER_OWNER_SWITCH: PASS')

  const settingsCreated = await mutate(clientA, buildC54SaveSettingsCommand({
    openingBalance: 500000, openingDate: '2026-08-01', updatedBy: 'Owner A', cloudVersion: 0,
  }))
  assert.equal(settingsCreated.ok, true, JSON.stringify(settingsCreated))
  const settingsReadB = await pullC54FinanceSharedTruth({ supabase: clientB, centerId: ids.center })
  assert.equal(settingsReadB.settings.openingBalance, 500000)
  assert.equal(settingsReadB.settings.cloudVersion, 1)
  const reconciliationCreated = await mutate(clientB, buildC54UpsertReconciliationCommand({
    id: `local-rec-${suffix}`, date: '2026-08-14', actualCash: 650000,
    checkedBy: 'Admin B', note: 'Matched server balance', cloudVersion: 0,
  }))
  assert.equal(reconciliationCreated.ok, true, JSON.stringify(reconciliationCreated))
  const reconciliationRead = await pullC54FinanceSharedTruth({ supabase: clientA, centerId: ids.center })
  assert.equal(reconciliationRead.reconciliations[0].systemClosingBalance, 650000)
  assert.equal(reconciliationRead.reconciliations[0].difference, 0)
  const interveningTransaction = await mutate(clientB, buildC54SaveTransactionCommand(
    manualTransaction({ amount: 25000, note: 'Committed after reconciliation preview' }),
    { category: otherCategory },
  ))
  assert.equal(interveningTransaction.ok, true, JSON.stringify(interveningTransaction))
  const closed = await mutate(clientA, buildC54CloseReconciliationCommand(reconciliationRead.reconciliations[0]))
  assert.equal(closed.ok, true, JSON.stringify(closed))
  const afterClose = await pullC54FinanceSharedTruth({ supabase: clientA, centerId: ids.center })
  assert.equal(afterClose.reconciliations[0].systemClosingBalance, 675000)
  assert.equal(afterClose.reconciliations[0].difference, -25000)
  assert.equal(afterClose.reconciliations[0].isClosed, true)
  const backdatedReconciliation = await mutate(clientA, buildC54UpsertReconciliationCommand({
    id: `local-backdated-rec-${suffix}`, date: '2026-08-13', actualCash: 0,
    checkedBy: 'Owner A', note: 'Must fail closed period', cloudVersion: 0,
  }))
  assert.equal(backdatedReconciliation.ok, false)
  assert.equal(backdatedReconciliation.outcome_code, 'SERVER_COMMAND_FAILED')
  const closedEdit = await mutate(clientA, buildC54SaveTransactionCommand({
    ...afterClose.transactions[0], note: 'Must fail closed period',
  }, { category: otherCategory }))
  assert.equal(closedEdit.ok, false)
  assert.equal(closedEdit.outcome_code, 'CLOSED_PERIOD')
  const closedSettings = await mutate(clientA, buildC54SaveSettingsCommand({
    ...afterClose.settings, openingBalance: 600000,
  }))
  assert.equal(closedSettings.ok, false)
  assert.equal(closedSettings.outcome_code, 'CLOSED_PERIOD')
  console.log('C5_4_QA_SETTINGS_RECONCILIATION_CLOSE_INTEGRITY: PASS')

  const newCategoryCommand = buildC54SaveCategoryCommand({ name: 'C5.4 Temp', type: 'expense' })
  const newCategoryResult = await mutate(clientA, newCategoryCommand)
  assert.equal(newCategoryResult.ok, true)
  const categoriesAfterCreate = await pullC54FinanceSharedTruth({ supabase: clientA, centerId: ids.center })
  const tempCategory = categoriesAfterCreate.categories.find((item) => item.name === 'C5.4 Temp')
  assert(tempCategory)
  const archivedCategory = await mutate(clientA, buildC54ArchiveCategoryCommand(tempCategory))
  assert.equal(archivedCategory.ok, true)
  const archivedRead = await pullC54FinanceSharedTruth({ supabase: clientA, centerId: ids.center })
  const archived = archivedRead.categories.find((item) => item.id === tempCategory.id)
  assert.equal(archived.isArchived, true)
  const archivedUse = await mutate(clientA, buildC54SaveTransactionCommand(
    manualTransaction({ type: 'expense', category: archived.name, transactionDate: '2026-08-15' }),
    { category: archived },
  ))
  assert.equal(archivedUse.ok, false)
  assert.equal(archivedUse.outcome_code, 'CATEGORY_ARCHIVED')
  console.log('C5_4_QA_CATEGORY_ARCHIVE_FAIL_CLOSED: PASS')

  psql(`insert into public.center_cloud_entities (
    center_id, entity_type, local_id, payload, source_module, source_version,
    entity_version, created_by, updated_by
  ) values (
    ${q(ids.center)}, 'tuition_record_package', ${q(`tuition-${suffix}`)},
    ${q(JSON.stringify({
      id: `tuition-${suffix}`,
      studentId: `student-${suffix}`,
      currentTermId: `period-${suffix}`,
      totalSessions: 10,
      usedSessions: 0,
      totalAmount: 1000000,
      paidAmount: 0,
      discountType: 'none',
      discountValue: 0,
      payments: [],
      termHistory: [],
    }))}::jsonb,
    'tuition', 'c5.2-authoritative-attendance-tuition-v1', 1,
    ${u(users.a.id)}, ${u(users.a.id)}
  );`)
  const payment = manualTransaction({
    type: 'income', category: 'Học phí', amount: 300000, transactionDate: '2026-08-15',
    sourceModule: 'hoc-phi', sourceType: 'tuition-payment',
    sourcePaymentId: `payment-${suffix}`, sourceTuitionId: `tuition-${suffix}`,
    sourceStudentId: `student-${suffix}`, sourcePeriodId: `period-${suffix}`,
  })
  const paymentCreated = await mutate(clientA, buildC54SaveTransactionCommand(payment, { category: tuitionCategory }))
  assert.equal(paymentCreated.ok, true, JSON.stringify(paymentCreated))
  const paymentRead = await pullC54FinanceSharedTruth({ supabase: clientB, centerId: ids.center })
  const protectedPayment = paymentRead.transactions.find((item) => item.sourcePaymentId === payment.sourcePaymentId)
  assert(protectedPayment)
  const protectedEdit = await mutate(clientB, buildC54SaveTransactionCommand({
    ...protectedPayment, amount: 300001,
  }, { category: tuitionCategory }))
  assert.equal(protectedEdit.ok, false)
  assert.equal(protectedEdit.outcome_code, 'PROTECTED_TRANSACTION')
  const protectedVoid = await mutate(clientB, buildC54VoidTransactionCommand(protectedPayment))
  assert.equal(protectedVoid.ok, false)
  assert.equal(protectedVoid.outcome_code, 'PROTECTED_TRANSACTION')
  const duplicatePayment = await mutate(clientA, buildC54SaveTransactionCommand({ ...payment, id: `retry-${suffix}` }, { category: tuitionCategory }))
  assert.equal(duplicatePayment.ok, false)
  assert.equal(duplicatePayment.outcome_code, 'SOURCE_TRANSACTION_CONFLICT')
  const concurrentOverpayment = await mutate(clientB, buildC54SaveTransactionCommand({
    ...payment,
    id: `concurrent-${suffix}`,
    amount: 800000,
    sourcePaymentId: `payment-concurrent-${suffix}`,
  }, { category: tuitionCategory }))
  assert.equal(concurrentOverpayment.ok, false)
  assert.equal(concurrentOverpayment.outcome_code, 'TUITION_PAYMENT_EXCEEDS_OUTSTANDING')
  console.log('C5_4_QA_TUITION_PAYMENT_AUTHORITATIVE_PROTECTED_IDEMPOTENT_SOURCE: PASS')

  const attachmentId = randomUUID()
  const path = `${ids.center}/transaction-images/2026/08/TC-C54-${suffix}.jpg`
  const { error: attachmentInsertError } = await clientA.from('transaction_attachments').insert({
    id: attachmentId, center_id: ids.center, transaction_code: `DRAFT-${suffix}`,
    transaction_date: '2026-08-16', month_key: '2026-08', amount: 225000,
    cashflow_type: 'expense', note: 'unbound draft', original_name: 'receipt.jpg',
    file_name: `TC-C54-${suffix}.jpg`, mime_type: 'image/jpeg', size_bytes: 1234,
    storage_bucket: 'transaction-images', storage_path: path, uploaded_by: users.a.id,
    uploaded_by_name: 'Owner A',
  })
  assert.equal(attachmentInsertError, null, attachmentInsertError?.message)
  const attachmentTransaction = manualTransaction({
    type: 'expense', category: 'Khác', amount: 225000, transactionDate: '2026-08-16',
  })
  const bound = await mutate(clientA, buildC54SaveTransactionCommand(attachmentTransaction, {
    category: otherCategory, attachmentAction: 'BIND', attachmentId,
  }))
  assert.equal(bound.ok, true, JSON.stringify(bound))
  const boundReadB = await pullC54FinanceSharedTruth({ supabase: clientB, centerId: ids.center })
  const boundTransaction = boundReadB.transactions.find((item) => item.attachments.some((attachment) => attachment.id === attachmentId))
  assert(boundTransaction)
  assert.equal(boundTransaction.attachments.length, 1)
  const { error: boundMetadataUpdateError } = await clientA.from('transaction_attachments')
    .update({ amount: 1 }).eq('id', attachmentId).eq('center_id', ids.center)
  assert(boundMetadataUpdateError)
  const { error: boundMetadataDeleteError } = await clientA.from('transaction_attachments')
    .delete().eq('id', attachmentId).eq('center_id', ids.center)
  assert(boundMetadataDeleteError)

  const wrongCenterAttachmentId = randomUUID()
  const { error: wrongCenterInsertError } = await clientA.from('transaction_attachments').insert({
    id: wrongCenterAttachmentId, center_id: ids.otherCenter, transaction_code: `DRAFT-OTHER-${suffix}`,
    transaction_date: '2026-08-16', month_key: '2026-08', amount: 1000,
    cashflow_type: 'income', note: '', original_name: 'other.jpg', file_name: `other-${suffix}.jpg`,
    mime_type: 'image/jpeg', size_bytes: 10, storage_bucket: 'transaction-images',
    storage_path: `${ids.otherCenter}/transaction-images/2026/08/other-${suffix}.jpg`, uploaded_by: users.a.id,
  })
  assert.equal(wrongCenterInsertError, null, wrongCenterInsertError?.message)
  const countBeforeWrongBind = boundReadB.transactions.length
  const wrongBind = await mutate(clientA, buildC54SaveTransactionCommand(
    manualTransaction({ transactionDate: '2026-08-17' }),
    { category: otherCategory, attachmentAction: 'BIND', attachmentId: wrongCenterAttachmentId },
  ))
  assert.equal(wrongBind.ok, false)
  assert.equal(wrongBind.outcome_code, 'ATTACHMENT_NOT_FOUND_OR_DENIED')
  const afterWrongBind = await pullC54FinanceSharedTruth({ supabase: clientA, centerId: ids.center })
  assert.equal(afterWrongBind.transactions.length, countBeforeWrongBind)
  console.log('C5_4_QA_ATTACHMENT_EXACT_CENTER_BINDING_ORPHAN_SWAP_GUARD: PASS')

  const teacherRead = await pullC54FinanceSharedTruth({ supabase: clientTeacher, centerId: ids.center })
  assert.equal(teacherRead.ok, false)
  assert.equal(teacherRead.outcome_code, 'CENTER_ACCESS_DENIED')
  const teacherWrite = await mutate(clientTeacher, buildC54SaveSettingsCommand({
    openingBalance: 0, openingDate: '2026-08-01', cloudVersion: 0,
  }))
  assert.equal(teacherWrite.ok, false)
  assert.equal(teacherWrite.outcome_code, 'WRITE_ROLE_REQUIRED')
  const { data: directRows, error: directReadError } = await clientA.from('finance_transaction').select('*')
  assert.equal(directRows, null)
  assert(directReadError)
  assert.equal(scalar(`select count(*) from public.finance_audit_event where center_id=${q(ids.center)};`) >= 8, true)
  console.log('C5_4_QA_ROLE_DIRECT_TABLE_AUDIT_FAIL_CLOSED: PASS')

  await Promise.all([clientA.auth.signOut(), clientB.auth.signOut(), clientC.auth.signOut(), clientTeacher.auth.signOut(), freshClientA.auth.signOut()])
} finally {
  if (fixtureCreated) {
    runReset()
    containerId = discoverContainer()
    const remainingUsers = Number(scalar(`select count(*) from auth.users where email like 'c5.4.%@example.invalid';`))
    const remainingCenters = Number(scalar(`select count(*) from public.centers where id like 'c5-4-%';`))
    assert.equal(remainingUsers, 0)
    assert.equal(remainingCenters, 0)
    finalResetVerified = true
  }
}

assert.equal(finalResetVerified, true)
console.log('C5_4_QA_FINAL_RESET_CLEAN: PASS')
console.log('C5_4_FINANCE_CASHBOOK_LOCAL_DB_QA: PASS')
