import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import {
  mutateAuthoritativeCoreEntity,
  projectAuthoritativeCoreRecord,
} from '../src/cloud-authoritative-core.js'
import {
  mergeRealtimeClassSessionIntoList,
  subscribeToClassSessionCloudRealtime,
} from '../src/cloud-realtime-class-sessions.js'
import { inspectAuthoritativeClassSessionDependencies } from '../src/class-session-lifecycle.js'

const consentFlag = 'ICHESS_CLASS_SESSION_LOCAL_QA'
assert.equal(process.argv.length, 2, 'This local QA runner accepts no arguments')
assert.equal(process.env[consentFlag], 'YES', `${consentFlag}=YES is required`)
assert(!process.env.SUPABASE_PROJECT_REF, 'A remote project reference environment variable is forbidden')

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
const cli = process.platform === 'win32' ? process.env.ComSpec : 'npx'
const cliArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npx --no-install supabase status -o json']
  : ['--no-install', 'supabase', 'status', '-o', 'json']
const status = JSON.parse(requireSuccess(run(cli, cliArgs), 'local Supabase status'))
for (const key of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
  assert.equal(typeof status[key], 'string')
}
for (const [label, value] of [['DB', status.DB_URL], ['API', status.API_URL]]) {
  assert(new Set(['127.0.0.1', 'localhost', '::1']).has(new URL(value).hostname.toLowerCase()),
    `${label} endpoint must be loopback`)
}

const discovery = requireSuccess(run('docker', [
  'ps', '--filter', 'label=com.supabase.cli.project=ichess-center-os',
  '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
]), 'local Docker discovery').trim().split(/\r?\n/).filter(Boolean)
  .map((line) => line.split('|')).filter(([, name]) => name === 'supabase_db_ichess-center-os')
assert.equal(discovery.length, 1, 'Expected exactly one guarded local DB container')
assert(/supabase\/postgres/i.test(discovery[0][2]))
const psqlArgs = [
  'exec', '-i', discovery[0][0], 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql, label = 'local psql') => requireSuccess(
  run('docker', psqlArgs, { input: sql }), label,
).trim()
assert.equal(psql("select to_regprocedure('public.class_session_safe_delete_guard()') is not null;"), 't')
assert.equal(psql("select to_regprocedure('public.v2_2_list_student_enrollments(text)') is not null;"), 't')

const suffix = randomUUID()
const ids = {
  centerOne: `class_qa_one_${suffix}`,
  centerTwo: `class_qa_two_${suffix}`,
  classX: `class-x-${suffix}`,
  classY: `class-y-${suffix}`,
  scheduleY: `schedule-y-${suffix}`,
}
const password = `Class!${randomUUID()}aA1`
const emails = Object.fromEntries(['a', 'b', 'c', 'd']
  .map((key) => [key, `class.qa.${key}.${suffix}@example.invalid`]))
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const makeClient = () => createClient(status.API_URL, status.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const users = {}
const channels = []
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const q = (value) => `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`

const makeUser = async (key) => {
  const { data, error } = await admin.auth.admin.createUser({
    email: emails[key], password, email_confirm: true,
  })
  if (error) throw error
  users[key] = data.user
}
const signIn = async (key) => {
  const client = makeClient()
  const { data, error } = await client.auth.signInWithPassword({ email: emails[key], password })
  if (error) throw error
  client.realtime.setAuth(data.session.access_token)
  return client
}
const mutate = (client, entityType, entity, centerId = ids.centerOne, operation = 'UPSERT') => (
  mutateAuthoritativeCoreEntity({
    supabase: client,
    centerId,
    entityType,
    entity,
    expectedVersion: Number(entity?.cloudVersion) || 0,
    idempotencyKey: randomUUID(),
    operation,
  })
)
const listClasses = async (client, centerId = ids.centerOne) => {
  const { data, error } = await client.from('center_cloud_entities')
    .select('center_id,entity_type,local_id,payload,entity_version,updated_at,deleted_at')
    .eq('center_id', centerId)
    .eq('entity_type', 'class_session')
    .is('deleted_at', null)
    .order('local_id')
  if (error) throw error
  return (data || []).map(projectAuthoritativeCoreRecord).filter(Boolean)
}
const access = (key, centerId, role) => ({
  isSupabaseConfigured: true,
  isSignedIn: true,
  user: { id: users[key].id },
  centerId,
  membership: { center_id: centerId, role, status: 'active' },
  role,
  cloudReady: true,
})
const subscribe = async ({ client, key, centerId, role, state, label }) => {
  let subscription
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} subscription timeout`)), 20_000)
    subscription = subscribeToClassSessionCloudRealtime({
      supabase: client,
      centerId,
      accessState: access(key, centerId, role),
      onClassSessionRecord: (record) => {
        const merged = mergeRealtimeClassSessionIntoList(state.items, record)
        if (merged.ok && merged.changed) {
          state.items = merged.classSessions
          state.events.push({ localId: record.local_id, version: record.entity_version, deleted: Boolean(record.deleted_at) })
        }
      },
      onStatusChange: (realtimeStatus) => {
        if (realtimeStatus.status === 'SUBSCRIBED') {
          clearTimeout(timer)
          resolve()
        } else if (realtimeStatus.status === 'CHANNEL_ERROR' || realtimeStatus.status === 'TIMED_OUT') {
          clearTimeout(timer)
          reject(new Error(`${label} ${realtimeStatus.status}`))
        }
      },
    })
    if (!subscription.ok) {
      clearTimeout(timer)
      reject(new Error(subscription.message))
    }
  })
  channels.push(subscription)
  await sleep(750)
  return subscription
}
const waitFor = async (predicate, label) => {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    if (predicate()) return
    await sleep(100)
  }
  assert.fail(label)
}

let residue = null
try {
  await Promise.all(['a', 'b', 'c', 'd'].map(makeUser))
  psql(`
    insert into public.centers(id,name,status) values
      (${q(ids.centerOne)},'Class QA Center One','active'),
      (${q(ids.centerTwo)},'Class QA Center Two','active');
    insert into public.center_members(center_id,user_id,role,status) values
      (${q(ids.centerOne)},${u(users.a.id)},'owner','active'),
      (${q(ids.centerTwo)},${u(users.a.id)},'owner','active'),
      (${q(ids.centerOne)},${u(users.b.id)},'center_admin','active'),
      (${q(ids.centerTwo)},${u(users.c.id)},'center_admin','active'),
      (${q(ids.centerOne)},${u(users.d.id)},'center_admin','active');
  `)

  const [clientA, clientB, clientC, clientD] = await Promise.all(['a', 'b', 'c', 'd'].map(signIn))
  const stateA = { items: [], events: [] }
  const stateB = { items: [], events: [] }
  await subscribe({ client: clientA, key: 'a', centerId: ids.centerOne, role: 'owner', state: stateA, label: 'A' })
  await subscribe({ client: clientB, key: 'b', centerId: ids.centerOne, role: 'center_admin', state: stateB, label: 'B' })

  const classX = {
    id: ids.classX, name: 'Class X', displayLabel: 'Class X', daysOfWeek: ['mon'],
    daysLabel: 'T2', startTime: '18:00', endTime: '19:00', status: 'active',
  }
  const createdX = await mutate(clientA, 'class_session', classX)
  assert.equal(createdX.ok, true)
  stateA.items = [createdX.entity]
  await waitFor(() => stateB.items.some((item) => item.id === ids.classX), 'B did not see A create X')

  const freshD = await listClasses(clientD)
  assert.deepEqual(freshD.map((item) => item.id), [ids.classX])

  const editedX = await mutate(clientB, 'class_session', {
    ...stateB.items.find((item) => item.id === ids.classX),
    name: 'Class X edited', displayLabel: 'Class X edited',
  })
  assert.equal(editedX.ok, true)
  stateB.items = [editedX.entity]
  await waitFor(
    () => stateA.items.some((item) => item.id === ids.classX && item.cloudVersion === 2 && item.name === 'Class X edited'),
    'A did not see B edit X',
  )

  const deletedX = await mutate(
    clientA,
    'class_session',
    stateA.items.find((item) => item.id === ids.classX),
    ids.centerOne,
    'DELETE',
  )
  assert.equal(deletedX.ok, true)
  stateA.items = []
  await waitFor(() => !stateB.items.some((item) => item.id === ids.classX), 'B did not lose deleted X')

  const classY = {
    id: ids.classY, name: 'Class Y', displayLabel: 'Class Y', daysOfWeek: ['mon'],
    daysLabel: 'T2', startTime: '19:00', endTime: '20:00', status: 'active',
  }
  const createdY = await mutate(clientA, 'class_session', classY)
  assert.equal(createdY.ok, true)
  await waitFor(() => stateB.items.some((item) => item.id === ids.classY), 'B did not see Class Y')
  const scheduleY = await mutate(clientA, 'schedule_session', {
    id: ids.scheduleY,
    classSessionId: ids.classY,
    scheduleType: 'recurring',
    dayOfWeek: 'mon',
    startTime: '19:00',
    endTime: '20:00',
  })
  assert.equal(scheduleY.ok, true)

  const dependency = await inspectAuthoritativeClassSessionDependencies({
    supabase: clientA,
    centerId: ids.centerOne,
    classSessionId: ids.classY,
    enrollmentSets: [],
  })
  assert.equal(dependency.ok, true)
  assert.equal(dependency.dependencyState.canDelete, false)
  assert.equal(dependency.dependencyState.counts.scheduleSessions, 1)
  const deniedDelete = await mutate(clientA, 'class_session', createdY.entity, ids.centerOne, 'DELETE')
  assert.equal(deniedDelete.ok, false)
  assert.equal(deniedDelete.outcome_code, 'CLASS_SESSION_REFERENCED')

  const deactivatedY = await mutate(clientA, 'class_session', {
    ...createdY.entity,
    status: 'inactive',
  })
  assert.equal(deactivatedY.ok, true)
  assert.equal(deactivatedY.entity.status, 'inactive')

  const centerOneFromC = await listClasses(clientC, ids.centerOne)
  assert.deepEqual(centerOneFromC, [], 'Center TWO user leaked Center ONE classes')

  const stale = mergeRealtimeClassSessionIntoList(
    [deactivatedY.entity],
    {
      center_id: ids.centerOne,
      entity_type: 'class_session',
      local_id: ids.classY,
      entity_version: 1,
      payload: classY,
      updated_at: '2026-09-16T00:00:00.000Z',
      deleted_at: null,
    },
  )
  assert.equal(stale.changed, false)
  assert.equal(stale.classSessions[0].status, 'inactive')

  let clearedCache = []
  clearedCache = await listClasses(clientD)
  assert.deepEqual(clearedCache.map((item) => [item.id, item.cloudVersion, item.status]), [
    [ids.classY, 2, 'inactive'],
  ])

  const oldCenterEventCount = stateA.events.length
  const aCenterOneSubscription = channels[0]
  aCenterOneSubscription.cleanup()
  channels.splice(channels.indexOf(aCenterOneSubscription), 1)
  const stateACenterTwo = { items: [], events: [] }
  await subscribe({
    client: clientA, key: 'a', centerId: ids.centerTwo, role: 'owner',
    state: stateACenterTwo, label: 'A-center-two',
  })
  const reactivatedY = await mutate(clientB, 'class_session', {
    ...deactivatedY.entity,
    status: 'active',
  })
  assert.equal(reactivatedY.ok, true)
  await sleep(1_500)
  assert.equal(stateA.events.length, oldCenterEventCount, 'Old-center event reached A after unsubscribe')
  assert.deepEqual(stateACenterTwo.items, [], 'Center ONE event leaked into Center TWO subscription')

  console.log('CLASS_SESSION_A_B_CREATE_EDIT_DELETE_REALTIME: PASS')
  console.log('CLASS_SESSION_D_FRESH_BOOTSTRAP: PASS')
  console.log('CLASS_SESSION_REFERENCED_DELETE_DENIED_DEACTIVATE_ALLOWED: PASS')
  console.log('CLASS_SESSION_CROSS_CENTER_AND_SWITCH_ISOLATION: PASS')
  console.log('CLASS_SESSION_STALE_EVENT_AND_CACHE_RECONSTRUCTION: PASS')
} finally {
  for (const channel of channels.splice(0)) channel.cleanup?.()
  await sleep(250)
  if (Object.keys(users).length) {
    psql(`
      delete from public.center_student_recurring_enrollments
        where center_id in (${q(ids.centerOne)},${q(ids.centerTwo)});
      delete from public.center_student_enrollment_sets
        where center_id in (${q(ids.centerOne)},${q(ids.centerTwo)});
      delete from public.center_student_enrollment_command_results
        where center_id in (${q(ids.centerOne)},${q(ids.centerTwo)});
      delete from public.center_student_enrollment_audit_events
        where center_id in (${q(ids.centerOne)},${q(ids.centerTwo)});
      delete from public.center_core_command_result
        where center_id in (${q(ids.centerOne)},${q(ids.centerTwo)});
      delete from public.center_cloud_entities
        where center_id in (${q(ids.centerOne)},${q(ids.centerTwo)});
      delete from public.center_members
        where center_id in (${q(ids.centerOne)},${q(ids.centerTwo)});
      alter table public.crm_contact_lookup_control
        disable trigger f23_3e_p4a_lookup_control_guard;
      alter table public.crm_contact_lookup_evidence
        disable trigger f23_3e_p4a_lookup_evidence_guard;
      delete from public.centers
        where id in (${q(ids.centerOne)},${q(ids.centerTwo)});
      alter table public.crm_contact_lookup_evidence
        enable trigger f23_3e_p4a_lookup_evidence_guard;
      alter table public.crm_contact_lookup_control
        enable trigger f23_3e_p4a_lookup_control_guard;
    `, 'Class Session QA cleanup')
    await Promise.all(Object.values(users).map((user) => admin.auth.admin.deleteUser(user.id)))
  }
  residue = JSON.parse(psql(`select jsonb_build_object(
    'centers',(select count(*) from public.centers where id in (${q(ids.centerOne)},${q(ids.centerTwo)})),
    'members',(select count(*) from public.center_members where center_id in (${q(ids.centerOne)},${q(ids.centerTwo)})),
    'entities',(select count(*) from public.center_cloud_entities where center_id in (${q(ids.centerOne)},${q(ids.centerTwo)})),
    'core_commands',(select count(*) from public.center_core_command_result where center_id in (${q(ids.centerOne)},${q(ids.centerTwo)})),
    'auth_users',(select count(*) from auth.users where email like 'class.qa.%${suffix}@example.invalid')
  );`))
  assert.deepEqual(residue, { centers: 0, members: 0, entities: 0, core_commands: 0, auth_users: 0 })
}

console.log('CLASS_SESSION_SYNTHETIC_RESIDUE: PASS 0')
console.log('CLASS_SESSION_INTEGRITY_LOCAL_DB_QA: PASS')
