import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import {
  mutateAuthoritativeCoreEntity,
  projectAuthoritativeCoreRecord,
} from '../src/cloud-authoritative-core.js'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const expectedGatewayContainerName = 'supabase_kong_ichess-center-os'
const expectedRealtimeContainerName = 'supabase_realtime_ichess-center-os'
const consentFlag = 'ICHESS_C5_1_LOCAL_QA_ALLOW_RESET'
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
const localStatus = JSON.parse(requireSuccess(run(cliCommand, cliArgs('status -o json')), 'local status'))
for (const key of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) assert.equal(typeof localStatus[key], 'string')
assertLoopback(new URL(localStatus.DB_URL).hostname, 'local DB')
assertLoopback(new URL(localStatus.API_URL).hostname, 'local API')

const discoverContainer = () => {
  const output = requireSuccess(run('docker', [
    'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
    '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
  ]), 'Docker discovery')
  const rows = output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
    .filter(([, name]) => name === expectedContainerName)
  assert.equal(rows.length, 1, 'Expected exactly one local DB container')
  assert(/supabase\/postgres/i.test(rows[0][2]))
  const inspect = requireSuccess(run('docker', [
    'inspect', rows[0][0], '--format', '{{json .Config.Labels}}|{{.State.Running}}|{{.Name}}',
  ]), 'Docker inspection').trim()
  const match = inspect.match(/^(\{.*\})\|(true|false)\|(.*)$/)
  assert(match)
  const labels = JSON.parse(match[1])
  assert.equal(match[2], 'true')
  assert.equal(match[3], `/${expectedContainerName}`)
  assert.equal(labels['com.supabase.cli.project'], projectSlug)
  assert.equal(labels['com.docker.compose.project'], projectSlug)
  return rows[0][0]
}

const restartLocalGatewayForRealtime = () => {
  const output = requireSuccess(run('docker', [
    'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
    '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
  ]), 'local gateway discovery')
  const rows = output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
    .filter(([, name]) => name === expectedGatewayContainerName)
  assert.equal(rows.length, 1, 'Expected exactly one local Kong gateway')
  assert(/supabase\/kong/i.test(rows[0][2]))
  const inspect = requireSuccess(run('docker', [
    'inspect', rows[0][0], '--format', '{{json .Config.Labels}}|{{.State.Running}}|{{.Name}}',
  ]), 'local gateway inspection').trim()
  const match = inspect.match(/^(\{.*\})\|(true|false)\|(.*)$/)
  assert(match)
  const labels = JSON.parse(match[1])
  assert.equal(match[2], 'true')
  assert.equal(match[3], `/${expectedGatewayContainerName}`)
  assert.equal(labels['com.supabase.cli.project'], projectSlug)
  assert.equal(labels['com.docker.compose.project'], projectSlug)
  requireSuccess(run('docker', ['restart', rows[0][0]], { timeout: 30_000 }), 'restart local gateway')
}

const waitForLocalRealtimeContainer = async () => {
  const deadline = Date.now() + 60_000
  let stableStartedAt = ''
  let stableChecks = 0
  let lastState = ''
  while (Date.now() < deadline) {
    const result = run('docker', [
      'inspect', expectedRealtimeContainerName,
      '--format', '{{.State.Running}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.State.StartedAt}}|{{index .Config.Labels "com.supabase.cli.project"}}|{{index .Config.Labels "com.docker.compose.project"}}',
    ])
    if (result.status === 0) {
      lastState = result.stdout.trim()
      const [running, health, startedAt, projectLabel, composeLabel] = lastState.split('|')
      if (running === 'true' && health === 'healthy' && projectLabel === projectSlug && composeLabel === projectSlug) {
        if (startedAt === stableStartedAt) stableChecks += 1
        else { stableStartedAt = startedAt; stableChecks = 1 }
        if (stableChecks >= 4) return
      } else {
        stableChecks = 0
      }
    } else {
      lastState = result.stderr.trim()
      stableChecks = 0
    }
    await sleep(500)
  }
  assert.fail(`Local Realtime container did not stabilize: ${lastState}`)
}

let containerId = discoverContainer()
const runReset = () => requireSuccess(run(cliCommand, cliArgs('db reset'), { timeout: 300_000 }), 'db reset')
const waitForRealtimeHealth = async () => {
  // `supabase db reset` restarts Realtime after Postgres migrations. Docker
  // Desktop can need more than 30 seconds before Kong sees the new upstream.
  const deadline = Date.now() + 60_000
  let lastError = ''
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${localStatus.API_URL}/realtime/v1/api/ping`, {
        headers: { apikey: localStatus.ANON_KEY },
      })
      if (response.ok) return
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = String(error?.message || error)
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  assert.fail(`Local Realtime did not become healthy: ${lastError}`)
}
const psqlArgs = () => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql) => requireSuccess(run('docker', psqlArgs(), { input: sql }), 'psql')
const scalar = (sql) => psql(sql).trim()
const q = (value) => value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class MemoryStorage {
  #items = new Map()
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null }
  setItem(key, value) { this.#items.set(String(key), String(value)) }
  removeItem(key) { this.#items.delete(String(key)) }
  clear() { this.#items.clear() }
  snapshot() { return Object.fromEntries(this.#items) }
}

const suffix = randomUUID()
const password = `C5.1!${randomUUID()}aA1`
const ids = {
  center: `c5-1-${randomUUID()}`,
  otherCenter: `c5-1-${randomUUID()}`,
}
const emails = {
  a: `c5.1.a.${suffix}@example.invalid`,
  b: `c5.1.b.${suffix}@example.invalid`,
  c: `c5.1.c.${suffix}@example.invalid`,
  limited: `c5.1.limited.${suffix}@example.invalid`,
}
const entityTypes = ['student', 'teacher', 'class_session', 'schedule_session']
const realtimeTypes = new Set(['student', 'teacher', 'schedule_session'])
const localIds = Object.fromEntries(entityTypes.map((type) => [type, `${type}-${suffix}`]))
const admin = createClient(localStatus.API_URL, localStatus.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
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
  client.realtime.setAuth(data.session.access_token)
  return client
}
const mutate = async (
  client,
  entityType,
  payload,
  expectedVersion,
  idempotencyKey = randomUUID(),
  centerId = ids.center,
) => {
  const result = await mutateAuthoritativeCoreEntity({
    supabase: client,
    centerId,
    entityType,
    entity: payload,
    expectedVersion,
    idempotencyKey,
  })
  return result
}
const listCore = async (client, centerId = ids.center) => {
  const { data, error } = await client
    .from('center_cloud_entities')
    .select('center_id,entity_type,local_id,payload,entity_version,updated_at,deleted_at')
    .eq('center_id', centerId)
    .in('entity_type', entityTypes)
    .is('deleted_at', null)
    .order('entity_type')
  if (error) throw error
  return data || []
}
const bootstrapContext = async (client, storage, centerId = ids.center) => {
  const records = await listCore(client, centerId)
  storage.clear()
  for (const type of entityTypes) {
    const projected = records.filter((record) => record.entity_type === type)
      .map((record) => projectAuthoritativeCoreRecord(record)).filter(Boolean)
    storage.setItem(`ichessCenterOS.${type}.${centerId}`, JSON.stringify(projected))
  }
  return records
}
const subscribe = async (client, label, sink, centerId = ids.center) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`${label} realtime subscribe timeout`)), 15_000)
  const channel = client.channel(`c5-1-${label}-${randomUUID()}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'center_cloud_entities', filter: `center_id=eq.${centerId}`,
    }, (event) => {
      const record = event.new || event.old
      if (realtimeTypes.has(record?.entity_type)) sink.push({ type: record.entity_type, event })
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        setTimeout(() => resolve(channel), 3_000)
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer)
        reject(new Error(`${label} realtime ${status}`))
      }
    })
})
const waitForRealtimeTypes = async (sink, label) => {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const found = new Set(sink.map((item) => item.type))
    if ([...realtimeTypes].every((type) => found.has(type))) return
    await sleep(100)
  }
  assert.fail(`${label}: missing realtime types; got ${JSON.stringify(sink.map((item) => item.type))}`)
}
const waitForRealtimeCount = async (sink, expectedCount, label) => {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (sink.length >= expectedCount) return
    await sleep(100)
  }
  assert.fail(`${label}: expected ${expectedCount} event(s), got ${sink.length}`)
}

let fixtureCreated = false
let finalResetVerified = false
const channels = []
console.log('C5_1_QA_LOCAL_SAFETY_GUARD: PASS')

try {
  runReset()
  containerId = discoverContainer()
  await waitForLocalRealtimeContainer()
  restartLocalGatewayForRealtime()
  await waitForRealtimeHealth()
  fixtureCreated = true
  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608130003' and name='c5_1_authoritative_core_contract_and_multi_account_harness';`), '1')
  assert.equal(scalar('select count(*) from auth.users;'), '0')
  assert.equal(scalar('select count(*) from public.center_cloud_entities;'), '0')
  assert.equal(scalar('select count(*) from public.center_core_command_result;'), '0')

  const users = {
    a: await makeUser(emails.a),
    b: await makeUser(emails.b),
    c: await makeUser(emails.c),
    limited: await makeUser(emails.limited),
  }
  psql(`insert into public.centers(id,name,status) values
    (${q(ids.center)},'C5.1 primary center','active'),
    (${q(ids.otherCenter)},'C5.1 other center','active');
  insert into public.center_members(center_id,user_id,role,status) values
    (${q(ids.center)},${u(users.a.id)},'owner','active'),
    (${q(ids.otherCenter)},${u(users.a.id)},'owner','active'),
    (${q(ids.center)},${u(users.b.id)},'center_admin','active'),
    (${q(ids.otherCenter)},${u(users.c.id)},'owner','active'),
    (${q(ids.center)},${u(users.limited.id)},'teacher','active');`)

  const [clientA, clientB, clientC, clientLimited, freshClient] = await Promise.all([
    signIn(emails.a), signIn(emails.b), signIn(emails.c), signIn(emails.limited), signIn(emails.a),
  ])
  const storageA = new MemoryStorage()
  const storageB = new MemoryStorage()
  const storageC = new MemoryStorage()
  const freshStorage = new MemoryStorage()
  assert.notEqual(storageA, storageB)
  assert.notEqual(storageB, storageC)

  const bRealtime = []
  channels.push({ client: clientB, channel: await subscribe(clientB, 'b-create', bRealtime) })
  const created = {}
  const createKeys = {}
  for (const type of entityTypes) {
    const payload = { id: localIds[type], label: `A created ${type}`, updatedAt: '2026-08-13T00:00:00.000Z' }
    createKeys[type] = randomUUID()
    const result = await mutate(clientA, type, payload, 0, createKeys[type])
    assert.equal(result.ok, true, `${type}: ${JSON.stringify(result)}`)
    assert.equal(result.entity.cloudVersion, 1)
    created[type] = result.entity
  }
  await waitForRealtimeTypes(bRealtime, 'A create -> B realtime')
  const bCreateRows = await bootstrapContext(clientB, storageB)
  assert.equal(bCreateRows.length, 4)
  assert.equal(Object.keys(storageB.snapshot()).length, 4)
  console.log('C5_1_A_CREATE_B_SEES_MATRIX: PASS 4/4')

  for (const type of entityTypes) {
    const replay = await mutate(clientA, type, {
      // A real browser retry rebuilds transient timestamps.  They must not
      // change the semantic idempotency binding owned by the server.
      id: localIds[type], label: `A created ${type}`, updatedAt: '2026-08-13T00:05:00.000Z',
    }, 0, createKeys[type])
    assert.equal(replay.ok, true)
    assert.equal(replay.replayed, true)
    assert.equal(replay.entity_version, 1)

    const conflict = await mutate(clientA, type, {
      id: localIds[type], label: `changed semantic ${type}`, updatedAt: '2026-08-13T00:00:00.000Z',
    }, 0, createKeys[type])
    assert.equal(conflict.ok, false)
    assert.equal(conflict.outcome_code, 'IDEMPOTENCY_CONFLICT')
  }
  console.log('C5_1_RETRY_IDEMPOTENCY_MATRIX: PASS 4/4')

  const aRealtime = []
  channels.push({ client: clientA, channel: await subscribe(clientA, 'a-edit', aRealtime) })
  const updated = {}
  for (const type of entityTypes) {
    const result = await mutate(clientB, type, {
      ...created[type], label: `B edited ${type}`, updatedAt: '2026-08-13T01:00:00.000Z',
    }, 1)
    assert.equal(result.ok, true, `${type}: ${JSON.stringify(result)}`)
    assert.equal(result.entity.cloudVersion, 2)
    updated[type] = result.entity
  }
  await waitForRealtimeTypes(aRealtime, 'B edit -> A realtime')
  const aEditRows = await bootstrapContext(clientA, storageA)
  assert.equal(aEditRows.length, 4)
  assert(aEditRows.every((record) => record.entity_version === 2))
  console.log('C5_1_B_EDIT_A_SEES_MATRIX: PASS 4/4')

  const stalePayload = { ...created.student, label: 'stale A overwrite' }
  const stale = await mutate(clientA, 'student', stalePayload, 1)
  assert.equal(stale.ok, false)
  assert.equal(stale.outcome_code, 'VERSION_CONFLICT')
  assert.equal(stale.current_version, 2)
  assert.equal((await listCore(clientA)).find((row) => row.entity_type === 'student').payload.label, 'B edited student')
  console.log('C5_1_CONCURRENT_STALE_EDIT: PASS')

  freshStorage.setItem('stale-local-only', JSON.stringify([{ id: 'must-disappear' }]))
  const freshRows = await bootstrapContext(freshClient, freshStorage)
  assert.equal(freshRows.length, 4)
  assert.equal(freshStorage.getItem('stale-local-only'), null)
  assert.deepEqual(
    freshRows.map((row) => row.payload.label).sort(),
    entityTypes.map((type) => `B edited ${type}`).sort(),
  )
  console.log('C5_1_EMPTY_STORAGE_NEW_CONTEXT_BOOTSTRAP: PASS')

  const cRows = await bootstrapContext(clientC, storageC)
  assert.equal(cRows.length, 0)
  const crossWrite = await mutate(clientC, 'student', {
    id: `cross-${suffix}`, label: 'forbidden', updatedAt: '2026-08-13T02:00:00.000Z',
  }, 0)
  assert.equal(crossWrite.ok, false)
  assert.equal(crossWrite.outcome_code, 'CENTER_ACCESS_DENIED')
  const limitedWrite = await mutate(clientLimited, 'teacher', {
    id: `limited-${suffix}`, label: 'forbidden', updatedAt: '2026-08-13T02:00:00.000Z',
  }, 0)
  assert.equal(limitedWrite.ok, false)
  assert.equal(limitedWrite.outcome_code, 'WRITE_ROLE_REQUIRED')
  console.log('C5_1_CROSS_CENTER_AND_WRONG_ROLE: PASS')

  const primaryRealtime = []
  const otherCenterRealtime = []
  channels.push({
    client: clientB,
    channel: await subscribe(clientB, 'primary-isolation', primaryRealtime, ids.center),
  })
  channels.push({
    client: clientA,
    channel: await subscribe(clientA, 'other-isolation', otherCenterRealtime, ids.otherCenter),
  })
  const ownerPrimaryId = `owner-primary-${suffix}`
  const ownerOtherId = `owner-other-${suffix}`
  const ownerOther = await mutate(clientA, 'student', {
    id: ownerOtherId,
    label: 'Owner Center B only',
    updatedAt: '2026-08-13T02:10:00.000Z',
  }, 0, randomUUID(), ids.otherCenter)
  assert.equal(ownerOther.ok, true, JSON.stringify(ownerOther))
  await waitForRealtimeCount(otherCenterRealtime, 1, 'Center B event -> Center B subscription')
  otherCenterRealtime.length = 0
  const ownerPrimary = await mutate(clientA, 'student', {
    id: ownerPrimaryId,
    label: 'Owner Center A only',
    updatedAt: '2026-08-13T02:11:00.000Z',
  }, 0, randomUUID(), ids.center)
  assert.equal(ownerPrimary.ok, true, JSON.stringify(ownerPrimary))
  await waitForRealtimeCount(primaryRealtime, 1, 'Center A event -> Center A subscriber')
  await sleep(750)
  assert.equal(otherCenterRealtime.length, 0, 'Center A realtime must not reach Center B subscription')
  console.log('C5_1_REALTIME_CROSS_CENTER_ISOLATION: PASS')

  const ownerSwitchStorage = new MemoryStorage()
  const ownerCenterARows = await bootstrapContext(clientA, ownerSwitchStorage, ids.center)
  assert(ownerCenterARows.some((row) => row.local_id === ownerPrimaryId))
  assert(!ownerCenterARows.some((row) => row.local_id === ownerOtherId))
  assert(Object.keys(ownerSwitchStorage.snapshot()).every((key) => key.endsWith(`.${ids.center}`)))

  const ownerCenterBRows = await bootstrapContext(clientA, ownerSwitchStorage, ids.otherCenter)
  assert(ownerCenterBRows.some((row) => row.local_id === ownerOtherId))
  assert(!ownerCenterBRows.some((row) => row.local_id === ownerPrimaryId))
  assert(Object.keys(ownerSwitchStorage.snapshot()).every((key) => key.endsWith(`.${ids.otherCenter}`)))

  const ownerCenterAReturnRows = await bootstrapContext(clientA, ownerSwitchStorage, ids.center)
  assert(ownerCenterAReturnRows.some((row) => row.local_id === ownerPrimaryId))
  assert(!ownerCenterAReturnRows.some((row) => row.local_id === ownerOtherId))
  assert(Object.keys(ownerSwitchStorage.snapshot()).every((key) => key.endsWith(`.${ids.center}`)))
  console.log('C5_1_OWNER_CENTER_SWITCH_ISOLATION: PASS')

  psql(`update public.center_members set status='inactive'
    where center_id=${q(ids.center)} and user_id=${u(users.b.id)};`)
  assert.equal((await listCore(clientB)).length, 0, 'Inactive membership must lose center reads')
  const inactiveWrite = await mutate(clientB, 'student', {
    ...updated.student, label: 'inactive member must not write',
  }, 2)
  assert.equal(inactiveWrite.ok, false)
  assert.equal(inactiveWrite.outcome_code, 'CENTER_ACCESS_DENIED')
  psql(`update public.center_members set status='active'
    where center_id=${q(ids.center)} and user_id=${u(users.b.id)};`)
  console.log('C5_1_MEMBERSHIP_CURRENTNESS_READ_WRITE: PASS')

  const { error: directCoreWriteError } = await clientA.from('center_cloud_entities').insert({
    center_id: ids.center, entity_type: 'student', local_id: `direct-${suffix}`,
    payload: { id: `direct-${suffix}` }, source_version: 'forbidden-direct-write',
  })
  assert(directCoreWriteError, 'Authenticated direct core table write must fail RLS')
  const { error: nonCoreWriteError } = await clientA.from('center_cloud_entities').insert({
    center_id: ids.center, entity_type: 'attendance_record', local_id: `regression-${suffix}`,
    payload: { id: `regression-${suffix}` }, source_version: 'c5.1-regression-only',
  })
  assert.equal(nonCoreWriteError, null, `Existing intended admin non-core write regressed: ${nonCoreWriteError?.message}`)
  console.log('C5_1_RLS_DIRECT_CORE_DENY_NONCORE_REGRESSION: PASS')

  const anonResponse = await fetch(`${localStatus.API_URL}/rest/v1/rpc/c5_1_mutate_core_entity`, {
    method: 'POST',
    headers: { apikey: localStatus.ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_center_id: ids.center, p_entity_type: 'student', p_local_id: `anon-${suffix}`,
      p_expected_version: 0, p_payload: { id: `anon-${suffix}` },
      p_idempotency_key: randomUUID(), p_operation: 'UPSERT',
    }),
  })
  assert([401, 403, 404].includes(anonResponse.status), `Anon RPC should fail closed: ${anonResponse.status}`)
  assert.equal(scalar(`select has_function_privilege('anon','public.c5_1_mutate_core_entity(text,text,text,bigint,jsonb,uuid,text)','EXECUTE')::text;`), 'false')
  assert.equal(scalar(`select has_function_privilege('authenticated','public.c5_1_mutate_core_entity(text,text,text,bigint,jsonb,uuid,text)','EXECUTE')::text;`), 'true')
  assert.equal(scalar(`select has_function_privilege('service_role','public.c5_1_mutate_core_entity(text,text,text,bigint,jsonb,uuid,text)','EXECUTE')::text;`), 'false')
  assert.equal(scalar(`select count(*) from pg_policies where tablename='center_cloud_entities' and cmd in ('INSERT','UPDATE','DELETE') and (qual ilike '%is_center_member%' or with_check ilike '%is_center_member%');`), '0')
  console.log('C5_1_ACL_POSTGREST_POLICY_CATALOG: PASS')

  const isolatedCache = new MemoryStorage()
  isolatedCache.setItem('core', JSON.stringify(updated.student))
  const beforeFailure = isolatedCache.snapshot()
  const networkFailure = await mutateAuthoritativeCoreEntity({
    supabase: { rpc: async () => ({ data: null, error: { message: 'synthetic network outage' } }) },
    centerId: ids.center,
    entityType: 'student',
    entity: { ...updated.student, label: 'must not persist' },
  })
  assert.equal(networkFailure.ok, false)
  assert.deepEqual(isolatedCache.snapshot(), beforeFailure)
  console.log('C5_1_CLOUD_FAILURE_NO_FALSE_LOCAL_SUCCESS: PASS')

  assert.equal(scalar(`select count(*) from public.center_cloud_entities where center_id=${q(ids.center)} and entity_type in ('student','teacher','class_session','schedule_session') and deleted_at is null;`), '5')
  assert.equal(scalar(`select count(*) from public.center_cloud_entities where center_id=${q(ids.otherCenter)} and entity_type in ('student','teacher','class_session','schedule_session') and deleted_at is null;`), '1')
  assert.equal(scalar(`select count(*) from public.center_cloud_entities where center_id=${q(ids.center)} and entity_type in ('student','teacher','class_session','schedule_session') and entity_version=2;`), '4')
  assert.equal(scalar(`select count(*) from public.center_core_command_result where center_id=${q(ids.center)};`), '9')
  assert.equal(scalar(`select count(*) from public.center_core_command_result where center_id=${q(ids.otherCenter)};`), '1')
  console.log('C5_1_AUTHORITATIVE_FINAL_STATE: PASS')
  console.log('C5_1_REALTIME_STUDENT_TEACHER_SCHEDULE: PASS')
  console.log('C5_1_RELOAD_CLASS_SESSION: PASS')
} finally {
  for (const { client, channel } of channels) {
    try { await client.removeChannel(channel) } catch { /* reset remains authoritative cleanup */ }
  }
  if (fixtureCreated) {
    runReset()
    containerId = discoverContainer()
    await waitForLocalRealtimeContainer()
    restartLocalGatewayForRealtime()
    await waitForRealtimeHealth()
    assert.equal(scalar('select count(*) from auth.users;'), '0')
    assert.equal(scalar('select count(*) from public.center_cloud_entities;'), '0')
    assert.equal(scalar('select count(*) from public.center_core_command_result;'), '0')
    assert.equal(scalar('select count(*) from public.centers;'), '0')
    finalResetVerified = true
  }
}

assert.equal(finalResetVerified, true)
console.log('C5_1_FINAL_RESET_AUTH_CORE_RESULT_BASELINE_ZERO: PASS')
console.log('C5.1 authoritative core + multi-account local DB QA: PASS')
