import assert from 'node:assert/strict'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const consentFlag = 'ICHESS_P4B_LOCAL_QA_ALLOW_RESET'
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
  assert.equal(rows.length, 1)
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

let containerId = discoverContainer()
const runReset = () => requireSuccess(run(cliCommand, cliArgs('db reset'), { timeout: 300_000 }), 'db reset')
const psqlArgs = (user = 'postgres') => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', user,
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql, { expectFailure = false, user = 'postgres' } = {}) => {
  const result = run('docker', psqlArgs(user), { input: sql })
  if (!expectFailure) requireSuccess(result, 'psql')
  return result
}
const scalar = (sql) => psql(sql).stdout.trim()
const q = (value) => value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`
const expectSqlFailure = (sql, pattern) => {
  const result = psql(sql, { expectFailure: true })
  assert.notEqual(result.status, 0)
  assert(new RegExp(pattern, 'i').test(`${result.stdout}\n${result.stderr}`), `${pattern}: ${result.stderr}`)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const sha = (value) => createHash('sha256').update(value).digest('hex')
const base32Decode = (value) => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const character of value.replace(/=+$/, '').toUpperCase()) {
    const index = alphabet.indexOf(character)
    assert(index >= 0)
    bits += index.toString(2).padStart(5, '0')
  }
  return Buffer.from((bits.match(/.{8}/g) || []).map((byte) => Number.parseInt(byte, 2)))
}
const totp = (secret, timestamp = Date.now()) => {
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30_000)))
  const digest = createHmac('sha1', base32Decode(secret)).update(counter).digest()
  const offset = digest.at(-1) & 0x0f
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}
const waitForNextTotpWindow = async () => {
  if (Date.now() % 30_000 > 27_000) await sleep(3_500)
}
const postEdge = async (token, body, apikey = localStatus.ANON_KEY) => {
  const response = await fetch(`${localStatus.API_URL}/functions/v1/crm-conversion-bridge`, {
    method: 'POST',
    headers: {
      apikey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  let json = null
  try { json = await response.json() } catch { /* finite assertion below */ }
  return { status: response.status, json }
}
const expectEdgeFailure = async (token, body, status, code) => {
  const response = await postEdge(token, body)
  assert.equal(response.status, status, JSON.stringify(response.json))
  assert.equal(response.json?.code, code)
  return response
}

const ids = {
  center: `p4b-${randomUUID()}`,
  otherCenter: `p4b-${randomUUID()}`,
  consultantMembership: randomUUID(), ownerMembership: randomUUID(), outsiderMembership: randomUUID(),
}
const suffix = randomUUID()
const password = `P4b!${randomUUID()}aA1`
const emails = {
  consultant: `p4b.consultant.${suffix}@example.invalid`,
  owner: `p4b.owner.${suffix}@example.invalid`,
  outsider: `p4b.outsider.${suffix}@example.invalid`,
}
let fixtureCreated = false
let finalResetVerified = false

const admin = createClient(localStatus.API_URL, localStatus.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const makeUser = async (email) => {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return data.user
}
const makeClient = () => createClient(localStatus.API_URL, localStatus.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const signIn = async (email) => {
  const client = makeClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return { client, token: data.session.access_token }
}
const enrollTotp = async (client, friendlyName) => {
  await waitForNextTotpWindow()
  const { data: enrolled, error: enrollError } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName })
  if (enrollError) throw enrollError
  const { data, error } = await client.auth.mfa.challengeAndVerify({
    factorId: enrolled.id,
    code: totp(enrolled.totp.secret),
  })
  if (error) throw error
  const claims = JSON.parse(Buffer.from(data.access_token.split('.')[1], 'base64url').toString('utf8'))
  assert.equal(claims.aal, 'aal2')
  assert(claims.amr.some((entry) => entry.method === 'totp' && Number.isFinite(entry.timestamp)))
  return { factorId: enrolled.id, secret: enrolled.totp.secret, token: data.access_token, claims }
}
const freshTotp = async (client, factorId, secret) => {
  await waitForNextTotpWindow()
  const { data, error } = await client.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) })
  if (error) throw error
  return data.access_token
}
const prepareBody = (sourceRecordId, overrides = {}) => ({
  operation: 'prepare', center_id: ids.center, idempotency_key: `prepare-${sourceRecordId}-${suffix}`,
  source_record_id: sourceRecordId, guardian_display_name: 'P4B Synthetic Guardian',
  phones: ['0900000091'], emails: ['p4b.synthetic@example.invalid'],
  student_display_name: 'P4B Synthetic Student', student_birth_date: '2014-04-03',
  learning_need_summary: 'P4B synthetic learning need', preferred_schedule_summary: 'P4B synthetic schedule',
  ...overrides,
})
const reviewBody = (prepared, sourceRecordId, overrides = {}) => ({
  operation: 'review', center_id: ids.center, idempotency_key: `review-${sourceRecordId}-${suffix}`,
  bridge_session_id: prepared.bridge_session_id, expected_bridge_version: prepared.bridge_version,
  student_decision: 'CREATE_NEW', student_opaque_target_id: null, student_expected_target_version: null,
  guardian_decision: 'CREATE_NEW', guardian_opaque_target_id: null, guardian_expected_target_version: null,
  relationship_decision: 'CREATE_RELATIONSHIP', ...overrides,
})
const executeBody = (reviewed, sourceRecordId) => ({
  operation: 'approve_execute', center_id: ids.center, idempotency_key: `execute-${sourceRecordId}-${suffix}`,
  bridge_session_id: reviewed.bridge_session_id, expected_bridge_version: reviewed.bridge_version,
})

console.log('P4B_QA_LOCAL_SAFETY_GUARD: PASS')
try {
  runReset()
  containerId = discoverContainer()
  fixtureCreated = true
  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608130002' and name='f23_3e_p4b_safe_server_bridge_auth_step_up_conversion_ui_legacy_projection';`), '1')
  assert.equal(scalar('select count(*) from auth.users;'), '0')
  assert.equal(scalar('select count(*) from vault.secrets;'), '0')

  psql(`grant execute on function vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
grant execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
grant execute on function vault._crypto_aead_det_noncegen() to postgres;`, { user: 'supabase_admin' })
  psql(`select vault.create_secret(pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),'f23_3e_p4a_contact_lookup_epoch_1','P4B synthetic local QA');
select vault.create_secret(pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),'f23_3e_p2b_identity_digest_epoch_1','P4B synthetic local QA');`)

  const consultant = await makeUser(emails.consultant)
  const owner = await makeUser(emails.owner)
  const outsider = await makeUser(emails.outsider)
  psql(`insert into public.centers(id,name) values (${q(ids.center)},'P4B synthetic center'),(${q(ids.otherCenter)},'P4B synthetic other center');
update public.center_crm_control set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=2 where center_id in (${q(ids.center)},${q(ids.otherCenter)});
insert into public.center_members(id,center_id,user_id,role,status) values
 (${u(ids.consultantMembership)},${q(ids.center)},${u(consultant.id)},'consultant','active'),
 (${u(ids.ownerMembership)},${q(ids.center)},${u(owner.id)},'owner','active'),
 (${u(ids.outsiderMembership)},${q(ids.otherCenter)},${u(outsider.id)},'owner','active');
insert into public.crm_identity_policy_registry(identity_policy_registry_id,environment_fingerprint,center_id,identity_kind,center_identity_policy_version,normalization_algorithm,normalization_version,digest_key_epoch,match_policy_version,minimum_evidence_policy_version)
values
 (${u(randomUUID())},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.center)},'STUDENT',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1),
 (${u(randomUUID())},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.center)},'GUARDIAN',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1),
 (${u(randomUUID())},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.otherCenter)},'STUDENT',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1),
 (${u(randomUUID())},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.otherCenter)},'GUARDIAN',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1);
update public.crm_identity_policy_registry set status='CURRENT',policy_registry_version=2 where center_id in (${q(ids.center)},${q(ids.otherCenter)});`)

  for (const table of ['crm_conversion_bridge_session']) {
    assert.equal(scalar(`select (c.relrowsecurity and c.relforcerowsecurity)::text from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=${q(table)};`), 'true')
    assert.equal(scalar(`select count(*) from pg_catalog.pg_policies where schemaname='public' and tablename=${q(table)};`), '0')
    assert.equal(scalar(`select count(*) from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=${q(table)};`), '0')
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal(scalar(`select has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT,INSERT,UPDATE,DELETE');`), 'f')
    }
  }
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'f23_3e_p4b_internal_%'
      and (has_function_privilege('public',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE')
        or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'));`), '0')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'f23_3e_p4b_%' and p.proname not like 'f23_3e_p4b_internal_%'
      and p.prosecdef and p.proconfig @> array['search_path=""'] and has_function_privilege('service_role',p.oid,'EXECUTE')
      and not has_function_privilege('public',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('authenticated',p.oid,'EXECUTE');`), '4')
  console.log('P4B_QA_RLS_GRANTS_REALTIME: PASS')

  const consultantLogin = await signIn(emails.consultant)
  const ownerLogin = await signIn(emails.owner)
  const outsiderLogin = await signIn(emails.outsider)
  await expectEdgeFailure('', { operation: 'status', center_id: ids.center, bridge_session_id: randomUUID() }, 401, 'AUTH_REQUIRED')
  const invalidJwt = await postEdge('invalid.jwt.value', { operation: 'status', center_id: ids.center, bridge_session_id: randomUUID() })
  assert.equal(invalidJwt.status, 401)
  await expectEdgeFailure(outsiderLogin.token, prepareBody('wrong-center'), 403, 'CENTER_ACCESS_DENIED')
  await expectEdgeFailure(ownerLogin.token, prepareBody('wrong-role'), 403, 'ROLE_NOT_ALLOWED')
  await expectEdgeFailure(consultantLogin.token, { ...prepareBody('forbidden'), environment_fingerprint: 'browser' }, 400, 'INVALID_REQUEST')
  const directAnon = await fetch(`${localStatus.API_URL}/rest/v1/rpc/f23_3e_p4b_prepare_conversion`, {
    method: 'POST', headers: { apikey: localStatus.ANON_KEY, Authorization: `Bearer ${consultantLogin.token}`, 'Content-Type': 'application/json' }, body: '{}',
  })
  assert([401, 403, 404].includes(directAnon.status), `direct RPC ${directAnon.status}`)
  console.log('P4B_QA_EDGE_AUTHORIZATION_BOUNDARY: PASS')

  const preparedAResponse = await postEdge(consultantLogin.token, prepareBody('source-a'))
  assert.equal(preparedAResponse.status, 200, JSON.stringify(preparedAResponse.json))
  const preparedA = preparedAResponse.json
  assert.equal(preparedA.status, 'PREPARED')
  assert.equal(preparedA.student_search.outcome_code, 'NO_MATCH')
  assert.equal(preparedA.guardian_search.outcome_code, 'NO_MATCH')
  const replayPrepareA = await postEdge(consultantLogin.token, prepareBody('source-a'))
  assert.equal(replayPrepareA.json.replayed, true)
  await expectEdgeFailure(consultantLogin.token, prepareBody('source-a', { student_display_name: 'Changed semantic' }), 409, 'P4B_IDEMPOTENCY_CONFLICT')
  const reviewedAResponse = await postEdge(consultantLogin.token, reviewBody(preparedA, 'source-a'))
  assert.equal(reviewedAResponse.status, 200, JSON.stringify(reviewedAResponse.json))
  const reviewedA = reviewedAResponse.json
  assert.equal(reviewedA.status, 'REVIEWED')
  await expectEdgeFailure(ownerLogin.token, executeBody(reviewedA, 'source-a'), 401, 'STEP_UP_REQUIRED')

  psql(`update public.center_members set role='owner',membership_version=membership_version+1 where id=${u(ids.consultantMembership)};`)
  const consultantTotp = await enrollTotp(consultantLogin.client, 'P4B actor separation QA')
  await expectEdgeFailure(consultantTotp.token, executeBody(reviewedA, 'source-a'), 403, 'P4B_ACTOR_SEPARATION_REQUIRED')
  psql(`update public.center_members set role='consultant',membership_version=membership_version+1 where id=${u(ids.consultantMembership)};`)

  const ownerTotp = await enrollTotp(ownerLogin.client, 'P4B owner QA')
  const executedAResponse = await postEdge(ownerTotp.token, executeBody(reviewedA, 'source-a'))
  assert.equal(executedAResponse.status, 200, JSON.stringify(executedAResponse.json))
  const executedA = executedAResponse.json
  assert.equal(executedA.status, 'COMPLETED')
  assert.equal(executedA.projection.student.read_only, true)
  assert.equal(executedA.projection.guardian.read_only, true)
  assert.equal(executedA.projection.relationship.read_only, true)
  const projectionText = JSON.stringify(executedA.projection)
  assert(!/(0900000091|p4b\.synthetic@example|2014-04-03|digest|cipher|mutex)/i.test(projectionText))
  console.log('P4B_QA_PROVIDER_AAL2_CREATE_PROJECTION: PASS')

  const preparedBResponse = await postEdge(consultantLogin.token, prepareBody('source-b'))
  assert.equal(preparedBResponse.status, 200, JSON.stringify(preparedBResponse.json))
  const preparedB = preparedBResponse.json
  assert.equal(preparedB.student_search.outcome_code, 'MATCH_REVIEW_REQUIRED')
  assert.equal(preparedB.guardian_search.outcome_code, 'MATCH_REVIEW_REQUIRED')
  const studentCandidate = preparedB.student_search.candidates[0]
  const guardianCandidate = preparedB.guardian_search.candidates[0]
  assert.equal(studentCandidate.opaque_target_id, executedA.projection.student.canonical_id)
  assert.equal(guardianCandidate.opaque_target_id, executedA.projection.guardian.canonical_id)
  const reviewedBResponse = await postEdge(consultantLogin.token, reviewBody(preparedB, 'source-b', {
    student_decision: 'REUSE_EXISTING', student_opaque_target_id: studentCandidate.opaque_target_id,
    student_expected_target_version: studentCandidate.target_version,
    guardian_decision: 'REUSE_EXISTING', guardian_opaque_target_id: guardianCandidate.opaque_target_id,
    guardian_expected_target_version: guardianCandidate.target_version,
    relationship_decision: 'REUSE_EXISTING_RELATIONSHIP',
  }))
  assert.equal(reviewedBResponse.status, 200, JSON.stringify(reviewedBResponse.json))
  const reviewedB = reviewedBResponse.json
  const ownerTokenB = await freshTotp(ownerLogin.client, ownerTotp.factorId, ownerTotp.secret)
  const [executeB1, executeB2] = await Promise.all([
    postEdge(ownerTokenB, executeBody(reviewedB, 'source-b')),
    postEdge(ownerTokenB, executeBody(reviewedB, 'source-b')),
  ])
  assert.equal(executeB1.status, 200, JSON.stringify(executeB1.json))
  assert.equal(executeB2.status, 200, JSON.stringify(executeB2.json))
  assert.equal(executeB1.json.projection.student.canonical_id, executedA.projection.student.canonical_id)
  assert.equal(executeB2.json.projection.guardian.canonical_id, executedA.projection.guardian.canonical_id)
  assert.equal(new Set([executeB1.json.replayed, executeB2.json.replayed]).size, 2)
  assert.equal(scalar(`select count(*) from public.student_profile where center_id=${q(ids.center)};`), '1')
  assert.equal(scalar(`select count(*) from public.guardian_profile where center_id=${q(ids.center)};`), '1')
  assert.equal(scalar(`select count(*) from public.guardian_student_relationship where center_id=${q(ids.center)} and status='ACTIVE';`), '1')
  assert.equal(scalar(`select count(*) from public.crm_identity_target_binding where center_id=${q(ids.center)} and binding_status='ACTIVE';`), '4')
  assert.equal(scalar(`select count(*) from public.crm_conversion_request where center_id=${q(ids.center)} and status='COMPLETED';`), '2')
  console.log('P4B_QA_GENUINE_REVIEWED_REUSE_RAPID_RETRY: PASS')

  const preparedNoneResponse = await postEdge(consultantLogin.token, prepareBody('source-none', {
    phones: ['0900000092'], emails: ['p4b.none@example.invalid'],
    student_display_name: 'P4B Explicit No Target', student_birth_date: '2013-03-02',
  }))
  assert.equal(preparedNoneResponse.status, 200)
  const noTargetStudentCandidate = preparedNoneResponse.json.student_search.candidates[0] || null
  const noTargetGuardianCandidate = preparedNoneResponse.json.guardian_search.candidates[0] || null
  const reviewedNoneResponse = await postEdge(consultantLogin.token, reviewBody(preparedNoneResponse.json, 'source-none', {
    student_decision: 'DO_NOT_CREATE',
    student_opaque_target_id: noTargetStudentCandidate?.opaque_target_id || null,
    student_expected_target_version: noTargetStudentCandidate?.target_version || null,
    guardian_decision: 'DO_NOT_CREATE',
    guardian_opaque_target_id: noTargetGuardianCandidate?.opaque_target_id || null,
    guardian_expected_target_version: noTargetGuardianCandidate?.target_version || null,
    relationship_decision: 'DO_NOT_CREATE_RELATIONSHIP',
  }))
  assert.equal(reviewedNoneResponse.status, 200, JSON.stringify(reviewedNoneResponse.json))
  const ownerTokenNone = await freshTotp(ownerLogin.client, ownerTotp.factorId, ownerTotp.secret)
  const executedNone = await postEdge(ownerTokenNone, executeBody(reviewedNoneResponse.json, 'source-none'))
  assert.equal(executedNone.status, 200, JSON.stringify(executedNone.json))
  assert.equal(executedNone.json.projection.student, null)
  assert.equal(executedNone.json.projection.guardian, null)
  assert.equal(executedNone.json.projection.relationship, null)
  console.log('P4B_QA_EXPLICIT_NO_TARGET: PASS')

  const preparedFaultResponse = await postEdge(consultantLogin.token, prepareBody('source-fault', {
    phones: ['0900000093'], emails: ['p4b.fault@example.invalid'],
    guardian_display_name: 'P4B Fault Guardian', student_display_name: 'P4B Fault Student', student_birth_date: '2012-02-01',
  }))
  assert.equal(preparedFaultResponse.status, 200, JSON.stringify(preparedFaultResponse.json))
  const preparedFault = preparedFaultResponse.json
  const reviewedFaultResponse = await postEdge(consultantLogin.token, reviewBody(preparedFault, 'source-fault'))
  assert.equal(reviewedFaultResponse.status, 200, JSON.stringify(reviewedFaultResponse.json))
  const reviewedFault = reviewedFaultResponse.json
  const beforeFault = scalar(`select concat((select count(*) from public.student_profile),'|',(select count(*) from public.guardian_profile),'|',(select count(*) from public.crm_conversion_authority),'|',(select count(*) from public.crm_audit_event),'|',(select count(*) from public.crm_outbox_event));`)
  psql(`create function public.p4b_qa_fail_bridge_outbox() returns trigger language plpgsql set search_path='' as $$begin if new.event_type='crm.conversion.bridge_completed' then raise exception 'P4B_QA_OUTBOX_FAULT'; end if; return new; end$$;
create trigger p4b_qa_fail_bridge_outbox before insert on public.crm_outbox_event for each row execute function public.p4b_qa_fail_bridge_outbox();`)
  const faultToken = await freshTotp(ownerLogin.client, ownerTotp.factorId, ownerTotp.secret)
  const faultResponse = await postEdge(faultToken, executeBody(reviewedFault, 'source-fault'))
  assert.equal(faultResponse.status, 422)
  assert.equal(scalar(`select concat((select count(*) from public.student_profile),'|',(select count(*) from public.guardian_profile),'|',(select count(*) from public.crm_conversion_authority),'|',(select count(*) from public.crm_audit_event),'|',(select count(*) from public.crm_outbox_event));`), beforeFault)
  assert.equal(scalar(`select status from public.crm_conversion_bridge_session where bridge_session_id=${u(reviewedFault.bridge_session_id)};`), 'REVIEWED')
  psql('drop trigger p4b_qa_fail_bridge_outbox on public.crm_outbox_event; drop function public.p4b_qa_fail_bridge_outbox();')
  console.log('P4B_QA_FAULT_ATOMIC_ROLLBACK: PASS')

  const statusA = await postEdge(ownerTotp.token, {
    operation: 'status', center_id: ids.center, bridge_session_id: executedA.bridge_session_id,
  })
  assert.equal(statusA.status, 200)
  assert.equal(statusA.json.status, 'COMPLETED')
  assert.deepEqual(statusA.json.result.projection, executedA.projection)
  assert.equal(scalar(`select count(*) from public.crm_audit_event where row_to_json(crm_audit_event)::text ~* '(0900000091|p4b.synthetic@example.invalid|2014-04-03|IC4CPV01|IC3CBE01)';`), '0')
  assert.equal(scalar(`select count(*) from public.crm_outbox_event where row_to_json(crm_outbox_event)::text ~* '(0900000091|p4b.synthetic@example.invalid|2014-04-03|IC4CPV01|IC3CBE01)';`), '0')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'p4b_qa_%';`), '0')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_trigger where not tgisinternal and tgname like 'p4b_qa_%';`), '0')
  console.log('P4B_QA_STATUS_PRIVACY_CLEAN_TEMP: PASS')

  // A stale provider timestamp is rejected before any authority mutation. The
  // successful Edge paths above use real local Auth-issued AAL2/TOTP evidence.
  expectSqlFailure(`set role service_role; select public.f23_3e_p4b_approve_execute_conversion(
    ${u(reviewedFault.bridge_session_id)},${u(owner.id)},2,${u(randomUUID())},'AAL2_TOTP','supabase.auth.totp.v1',
    extensions.digest('stale-ref','sha256'),now()-interval '3 minutes',extensions.digest('account','sha256'),
    extensions.digest('env','sha256'),extensions.digest('key','sha256'),now()+interval '1 hour');`, 'P4B_STEP_UP_REQUIRED')
  console.log('P4B_QA_STALE_STEP_UP_FAIL_CLOSED: PASS')
} finally {
  if (fixtureCreated) {
    psql(`revoke execute on function vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea) from postgres;
revoke execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) from postgres;
revoke execute on function vault._crypto_aead_det_noncegen() from postgres;`, { user: 'supabase_admin' })
    runReset()
    containerId = discoverContainer()
    assert.equal(scalar('select count(*) from auth.users;'), '0')
    assert.equal(scalar('select count(*) from vault.secrets;'), '0')
    assert.equal(scalar('select count(*) from public.crm_conversion_bridge_session;'), '0')
    assert.equal(scalar('select count(*) from public.student_profile;'), '0')
    assert.equal(scalar('select count(*) from public.guardian_profile;'), '0')
    assert.equal(scalar('select count(*) from public.guardian_student_relationship;'), '0')
    assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'p4b_qa_%';`), '0')
    assert.equal(scalar(`select count(*) from pg_catalog.pg_trigger where not tgisinternal and tgname like 'p4b_qa_%';`), '0')
    assert.equal(scalar(`select has_function_privilege('postgres','vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea)','EXECUTE');`), 'f')
    finalResetVerified = true
    fixtureCreated = false
    console.log('P4B_QA_FINAL_RESET: PASS')
  }
  assert(finalResetVerified || !fixtureCreated)
}

console.log(`P4B_QA_EVIDENCE_DIGEST: ${sha('auth-provider-aal2|create|reuse|no-target|fault|privacy|cleanup')}`)
console.log('F23_3E_P4B_LOCAL_DOCKER_QA: PASS')
