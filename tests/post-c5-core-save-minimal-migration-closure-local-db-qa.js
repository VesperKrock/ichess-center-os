import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { mutateAuthoritativeCoreEntity } from '../src/cloud-authoritative-core.js'
import {
  buildC54SaveTransactionCommand,
  mutateC54FinanceSharedTruth,
  pullC54FinanceSharedTruth,
} from '../src/cloud-authoritative-finance.js'

const consentFlag = 'ICHESS_POST_C5_MINIMAL_CLOSURE_QA_ALLOW_RESET'
const projectSlug = 'ichess-center-os'
const expectedDbContainer = 'supabase_db_ichess-center-os'
const allowlist = [
  'supabase/migrations/202608130003_c5_1_authoritative_core_contract_and_multi_account_harness.sql',
  'supabase/migrations/202608140005_c5_4_finance_cashbook_authoritative_shared_truth.sql',
  'supabase/migrations/202608140006_c5_4_reconciliation_currentness_hardening.sql',
]

assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
assert.equal(process.env[consentFlag], 'YES', `${consentFlag}=YES is required`)
assert(!process.env.SUPABASE_PROJECT_REF, 'Linked project references are forbidden')

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
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    ...options,
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
const localStatus = JSON.parse(requireSuccess(
  run(cliCommand, cliArgs('status -o json')),
  'local status',
))
for (const key of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
  assert.equal(typeof localStatus[key], 'string')
}
assertLoopback(new URL(localStatus.DB_URL).hostname, 'local DB')
assertLoopback(new URL(localStatus.API_URL).hostname, 'local API')

const discoverDbContainer = () => {
  const output = requireSuccess(run('docker', [
    'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
    '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
  ]), 'local DB discovery')
  const rows = output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
    .filter(([, name]) => name === expectedDbContainer)
  assert.equal(rows.length, 1, 'Expected exactly one guarded local DB container')
  assert(/supabase\/postgres/i.test(rows[0][2]))
  return rows[0][0]
}
const resetLocal = (version = '') => requireSuccess(
  run(cliCommand, cliArgs(`db reset --local --no-seed${version ? ` --version ${version}` : ''}`), {
    timeout: 300_000,
  }),
  version ? `local reset through ${version}` : 'final full local reset',
)
const psqlArgs = (containerId) => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (containerId, sql, label = 'psql') => requireSuccess(
  run('docker', psqlArgs(containerId), { input: sql }),
  label,
).trim()
const scalar = (containerId, sql) => psql(containerId, sql).trim()
const quoteSql = (value) => `'${String(value).replaceAll("'", "''")}'`
const applyMigration = (containerId, path) => {
  const sql = readFileSync(path, 'utf8')
  requireSuccess(run('docker', psqlArgs(containerId), { input: sql }), `apply allowlisted ${path}`)
}
const waitForRest = async () => {
  const deadline = Date.now() + 60_000
  let lastError = ''
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${localStatus.API_URL}/rest/v1/`, {
        headers: { apikey: localStatus.ANON_KEY },
      })
      if (response.ok) return
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = String(error?.message || error)
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  assert.fail(`Local PostgREST did not become ready: ${lastError}`)
}
const requireOk = (result, label) => {
  assert.equal(result?.ok, true, `${label}: ${result?.error || result?.outcome_code || 'failed'}`)
  return result
}
const signIn = async (email, password) => {
  const client = createClient(localStatus.API_URL, localStatus.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  assert.equal(error, null, `sign in ${email}: ${error?.message}`)
  return client
}

let baselineResetStarted = false
try {
  baselineResetStarted = true
  resetLocal('202607280003')
  let dbContainerId = discoverDbContainer()
  assert.equal(
    scalar(dbContainerId, "select count(*) from supabase_migrations.schema_migrations where version > '202607280003';"),
    '0',
  )
  assert.equal(scalar(dbContainerId, "select to_regclass('public.crm_conversion_bridge_session') is null;"), 't')
  assert.equal(scalar(dbContainerId, "select to_regclass('public.center_core_command_result') is null;"), 't')
  assert.equal(scalar(dbContainerId, "select to_regclass('public.finance_transaction') is null;"), 't')

  for (const migration of allowlist) applyMigration(dbContainerId, migration)
  psql(dbContainerId, "notify pgrst, 'reload schema';", 'reload local PostgREST schema')
  await waitForRest()

  assert.equal(scalar(dbContainerId, `
    select count(*) from information_schema.columns
    where table_schema='public' and table_name='center_cloud_entities'
      and column_name='entity_version' and data_type='bigint';
  `), '1')
  assert.equal(scalar(dbContainerId, "select to_regclass('public.center_core_command_result') is not null;"), 't')
  assert.equal(scalar(dbContainerId, "select to_regprocedure('public.c5_1_mutate_core_entity(text,text,text,bigint,jsonb,uuid,text)') is not null;"), 't')
  assert.equal(scalar(dbContainerId, "select to_regclass('public.finance_transaction') is not null;"), 't')
  assert.equal(scalar(dbContainerId, "select to_regprocedure('public.c5_4_list_finance_shared_truth(text)') is not null;"), 't')
  assert.equal(scalar(dbContainerId, "select to_regprocedure('public.c5_4_mutate_finance_shared_truth(text,jsonb,uuid)') is not null;"), 't')
  assert.equal(scalar(dbContainerId, "select to_regprocedure('public.c5_4_guard_reconciliation_currentness()') is not null;"), 't')
  assert.equal(scalar(dbContainerId, "select to_regclass('public.crm_conversion_bridge_session') is null;"), 't')
  console.log('POST_C5_MINIMAL_CLOSURE_DEPENDENCY_AND_P4B_EXCLUSION: PASS')

  const service = createClient(localStatus.API_URL, localStatus.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const suffix = randomUUID().slice(0, 8)
  const centerA = `post-c5-a-${suffix}`
  const centerC = `post-c5-c-${suffix}`
  const password = `Local-${randomUUID()}-Aa1!`
  const accounts = [
    { key: 'owner', email: `post-c5-owner-${suffix}@example.test`, role: 'owner', centerId: centerA },
    { key: 'admin', email: `post-c5-admin-${suffix}@example.test`, role: 'center_admin', centerId: centerA },
    { key: 'cross', email: `post-c5-cross-${suffix}@example.test`, role: 'center_admin', centerId: centerC },
  ]
  for (const account of accounts) {
    const { data, error } = await service.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
    })
    assert.equal(error, null, `create ${account.key}: ${error?.message}`)
    account.userId = data.user.id
  }
  psql(dbContainerId, `
    insert into public.centers (id, name, status) values
      (${quoteSql(centerA)}, 'Post C5 Center A', 'active'),
      (${quoteSql(centerC)}, 'Post C5 Center C', 'active');
    insert into public.center_members (center_id, user_id, role, status) values
      ${accounts.map((account) => `(
        ${quoteSql(account.centerId)},
        ${quoteSql(account.userId)}::uuid,
        ${quoteSql(account.role)},
        'active'
      )`).join(',')};
  `, 'create guarded local center memberships')

  const owner = await signIn(accounts[0].email, password)
  const admin = await signIn(accounts[1].email, password)
  const cross = await signIn(accounts[2].email, password)
  const entityTypes = ['student', 'class_session', 'schedule_session']
  for (const entityType of entityTypes) {
    const ownerEntityId = `${entityType}-owner-${suffix}`
    const createKey = randomUUID()
    const ownerPayload = {
      id: ownerEntityId,
      title: `${entityType} owner create`,
      createdAt: '2026-08-20T00:00:00.000Z',
    }
    const created = requireOk(await mutateAuthoritativeCoreEntity({
      supabase: owner,
      centerId: centerA,
      entityType,
      entity: ownerPayload,
      idempotencyKey: createKey,
    }), `${entityType} owner create`)
    const replay = requireOk(await mutateAuthoritativeCoreEntity({
      supabase: owner,
      centerId: centerA,
      entityType,
      entity: ownerPayload,
      idempotencyKey: createKey,
    }), `${entityType} replay`)
    assert.equal(replay.replayed, true)

    const { data: adminRows, error: adminReadError } = await admin
      .from('center_cloud_entities')
      .select('center_id,entity_type,local_id,payload,entity_version')
      .eq('center_id', centerA)
      .eq('entity_type', entityType)
      .eq('local_id', ownerEntityId)
    assert.equal(adminReadError, null)
    assert.equal(adminRows.length, 1)
    assert.equal(adminRows[0].entity_version, 1)

    const edited = requireOk(await mutateAuthoritativeCoreEntity({
      supabase: admin,
      centerId: centerA,
      entityType,
      entity: { ...created.entity, title: `${entityType} admin edit` },
      idempotencyKey: randomUUID(),
    }), `${entityType} admin edit`)
    assert.equal(edited.entity.cloudVersion, 2)
    const stale = await mutateAuthoritativeCoreEntity({
      supabase: owner,
      centerId: centerA,
      entityType,
      entity: { ...created.entity, title: `${entityType} stale edit` },
      idempotencyKey: randomUUID(),
    })
    assert.equal(stale.ok, false)
    assert.equal(stale.outcome_code, 'VERSION_CONFLICT')

    const adminEntityId = `${entityType}-admin-${suffix}`
    requireOk(await mutateAuthoritativeCoreEntity({
      supabase: admin,
      centerId: centerA,
      entityType,
      entity: { id: adminEntityId, title: `${entityType} admin create` },
      idempotencyKey: randomUUID(),
    }), `${entityType} admin create`)
    const { count: authoritativeCount, error: countError } = await owner
      .from('center_cloud_entities')
      .select('id', { count: 'exact', head: true })
      .eq('center_id', centerA)
      .eq('entity_type', entityType)
    assert.equal(countError, null)
    assert.equal(authoritativeCount, 2)

    const crossWrite = await mutateAuthoritativeCoreEntity({
      supabase: cross,
      centerId: centerA,
      entityType,
      entity: { id: `${entityType}-cross-${suffix}` },
      idempotencyKey: randomUUID(),
    })
    assert.equal(crossWrite.ok, false)
    assert.equal(crossWrite.outcome_code, 'CENTER_ACCESS_DENIED')
    const { data: crossRows, error: crossReadError } = await cross
      .from('center_cloud_entities')
      .select('id')
      .eq('center_id', centerA)
      .eq('entity_type', entityType)
    assert.equal(crossReadError, null)
    assert.equal(crossRows.length, 0)
  }

  const directCoreWrite = await admin.from('center_cloud_entities').insert({
    center_id: centerA,
    entity_type: 'student',
    local_id: `direct-denied-${suffix}`,
    payload: { id: `direct-denied-${suffix}` },
  })
  assert(directCoreWrite.error)
  assert.equal(directCoreWrite.error.code, '42501')

  const freshAdmin = await signIn(accounts[1].email, password)
  const { count: freshCount, error: freshError } = await freshAdmin
    .from('center_cloud_entities')
    .select('id', { count: 'exact', head: true })
    .eq('center_id', centerA)
    .in('entity_type', entityTypes)
  assert.equal(freshError, null)
  assert.equal(freshCount, 6)
  console.log('POST_C5_MINIMAL_CLOSURE_CORE_MULTI_ACCOUNT: PASS')

  const ownerFinance = requireOk(await pullC54FinanceSharedTruth({ supabase: owner, centerId: centerA }), 'owner Finance read')
  const adminFinance = requireOk(await pullC54FinanceSharedTruth({ supabase: admin, centerId: centerA }), 'admin Finance read')
  assert(ownerFinance.categories.length > 0)
  assert.equal(adminFinance.categories.length, ownerFinance.categories.length)
  const incomeCategory = adminFinance.categories.find((category) => (
    !category.isArchived && ['income', 'both'].includes(category.type)
  ))
  assert(incomeCategory)
  const financeCommand = buildC54SaveTransactionCommand({
    id: `finance-${suffix}`,
    type: 'income',
    amount: 125000,
    transactionDate: '2026-08-20',
    method: 'Tiền mặt',
    personName: 'Targeted QA',
    recordedBy: 'Admin B',
    note: 'Minimal closure acceptance',
    sourceModule: 'manual',
  }, { category: incomeCategory })
  const financeKey = randomUUID()
  requireOk(await mutateC54FinanceSharedTruth({
    supabase: admin,
    centerId: centerA,
    command: financeCommand,
    idempotencyKey: financeKey,
  }), 'admin Finance create')
  const financeReplay = requireOk(await mutateC54FinanceSharedTruth({
    supabase: admin,
    centerId: centerA,
    command: financeCommand,
    idempotencyKey: financeKey,
  }), 'admin Finance replay')
  assert.equal(financeReplay.replayed, true)
  const ownerFinanceAfter = requireOk(await pullC54FinanceSharedTruth({ supabase: owner, centerId: centerA }), 'owner Finance observe')
  assert.equal(ownerFinanceAfter.transactions.length, 1)
  const crossFinance = await pullC54FinanceSharedTruth({ supabase: cross, centerId: centerA })
  assert.equal(crossFinance.ok, false)
  assert.equal(crossFinance.outcome_code, 'CENTER_ACCESS_DENIED')
  console.log('POST_C5_MINIMAL_CLOSURE_FINANCE_CASHBOOK: PASS')
} finally {
  if (baselineResetStarted) {
    resetLocal()
    console.log('POST_C5_MINIMAL_CLOSURE_FINAL_LOCAL_RESET: PASS')
  }
}

console.log('POST_C5_CORE_SAVE_MINIMAL_MIGRATION_CLOSURE_LOCAL_DB_QA: PASS')
