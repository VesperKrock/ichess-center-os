import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const resetConsentFlag = 'ICHESS_P4A_LOCAL_QA_ALLOW_RESET'

assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
assert.equal(process.env[resetConsentFlag], 'YES', `${resetConsentFlag}=YES is required`)
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
const localCommand = process.platform === 'win32' ? process.env.ComSpec : 'npx'
const localArgs = (tail) => process.platform === 'win32'
  ? ['/d', '/s', '/c', `npx --no-install supabase ${tail}`]
  : ['--no-install', 'supabase', ...tail.split(' ')]

const statusResult = run(localCommand, localArgs('status -o json'))
assert.equal(statusResult.status, 0, 'Local Supabase status must succeed; no fallback')
const localStatus = JSON.parse(statusResult.stdout)
for (const key of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
  assert.equal(typeof localStatus[key], 'string', `Local status omitted ${key}`)
}
assertLoopback(new URL(localStatus.DB_URL).hostname, 'local DB')
assertLoopback(new URL(localStatus.API_URL).hostname, 'local API')

const discoverContainer = () => {
  const output = requireSuccess(run('docker', [
    'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
    '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
  ]), 'Docker discovery')
  const rows = output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
    .filter(([, name]) => name === expectedContainerName)
  assert.equal(rows.length, 1, `Expected exactly one ${expectedContainerName}`)
  assert(/supabase\/postgres/i.test(rows[0][2]), 'Unexpected database image')
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
console.log('P4A_QA_LOCAL_SAFETY_GUARD: PASS')
const runReset = () => requireSuccess(run(localCommand, localArgs('db reset'), { timeout: 300_000 }), 'db reset')
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
const jsonFrom = (output) => {
  const line = [...output.trim().split(/\r?\n/)].reverse()
    .map((value) => value.trim()).find((value) => value.startsWith('{') || value.startsWith('['))
  assert(line, `Expected JSON: ${output}`)
  return JSON.parse(line)
}
const jsonValue = (sql) => jsonFrom(psql(sql).stdout)
const q = (value) => value === null || value === undefined
  ? 'null' : `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`
const expectFailure = (sql, pattern) => {
  const result = psql(sql, { expectFailure: true })
  assert.notEqual(result.status, 0, `Expected SQL failure: ${pattern}`)
  assert(new RegExp(pattern, 'i').test(`${result.stdout}\n${result.stderr}`), `${pattern}: ${result.stdout}\n${result.stderr}`)
}
const postRpc = (rpc, apikey, bearer, body) => fetch(`${localStatus.API_URL}/rest/v1/rpc/${rpc}`, {
  method: 'POST',
  headers: { apikey, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const ids = {
  center: `p4a-${randomUUID()}`,
  otherCenter: `p4a-${randomUUID()}`,
  owner: randomUUID(), consultant: randomUUID(), outsider: randomUUID(),
  ownerMembership: randomUUID(), consultantMembership: randomUUID(), outsiderMembership: randomUUID(),
  guardian: randomUUID(),
}
let fixtureCreated = false
let finalResetVerified = false

const ingressSql = ({ source = 'local-source-1', name = 'Synthetic Guardian',
  phones = ['090 000 0001'], emails = ['Case@Test.Invalid'], actor = ids.consultant,
  center = ids.center } = {}) => `set role service_role;
select row_to_json(x) from public.f23_3e_p4a_ingress_canonical_contact(
  ${q(center)},${u(actor)},${q(source)},${q(name)},
  array[${phones.map(q).join(',')}]::text[],array[${emails.map(q).join(',')}]::text[]
) x; reset role;`

try {
  runReset()
  containerId = discoverContainer()
  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where version='202608130001' and name='f23_3e_p4a_canonical_contact_ingress_lookup_normalization_foundation';`), '1')
  assert.equal(scalar('select count(*) from auth.users;'), '0')
  assert.equal(scalar('select count(*) from vault.secrets;'), '0')
  assert.equal(scalar('select count(*) from public.crm_contact_lookup_evidence;'), '0')

  for (const table of ['crm_contact_lookup_control', 'crm_contact_lookup_evidence']) {
    assert.equal(scalar(`select (c.relrowsecurity and c.relforcerowsecurity)::text from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=${q(table)};`), 'true')
    assert.equal(scalar(`select count(*) from pg_catalog.pg_policies where schemaname='public' and tablename=${q(table)};`), '0')
    assert.equal(scalar(`select count(*) from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=${q(table)};`), '0')
    for (const role of ['anon', 'authenticated', 'service_role']) {
      assert.equal(scalar(`select has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT,INSERT,UPDATE,DELETE');`), 'f')
    }
  }
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'f23_3e_p4a_internal_%'
      and (has_function_privilege('public',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE')
        or has_function_privilege('authenticated',p.oid,'EXECUTE') or has_function_privilege('service_role',p.oid,'EXECUTE'));`), '0')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'f23_3e_p4a_%' and p.proname not like 'f23_3e_p4a_internal_%'
      and p.prosecdef and p.proconfig @> array['search_path=""']
      and has_function_privilege('service_role',p.oid,'EXECUTE')
      and not has_function_privilege('anon',p.oid,'EXECUTE')
      and not has_function_privilege('authenticated',p.oid,'EXECUTE');`), '4')

  // Repair only the local test ACL baseline in case an interrupted prior QA
  // run left its temporary grant behind; no production object owns this grant.
  psql(`revoke execute on function vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea) from postgres;
revoke execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) from postgres;
revoke execute on function vault._crypto_aead_det_noncegen() from postgres;`, { user: 'supabase_admin' })
  for (const signature of [
    'vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea)',
    'vault._crypto_aead_det_noncegen()',
  ]) assert.equal(scalar(`select has_function_privilege('postgres',${q(signature)},'EXECUTE');`), 'f')
  // Local-only P3C0 crypto bridge fixture. Reset removes these grants; the
  // production migration neither grants Vault primitives nor embeds a secret.
  psql(`grant execute on function vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
grant execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
grant execute on function vault._crypto_aead_det_noncegen() to postgres;`, { user: 'supabase_admin' })
  fixtureCreated = true

  psql(`select vault.create_secret(pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),'f23_3e_p4a_contact_lookup_epoch_1','P4A synthetic local QA');
select vault.create_secret(pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),'f23_3e_p4a_contact_lookup_epoch_2','P4A synthetic local QA');
select vault.create_secret(pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),'f23_3e_p2b_identity_digest_epoch_1','P4A synthetic Guardian mutex QA');`)
  psql(`insert into auth.users(id,aud,role,created_at,updated_at) values
    (${u(ids.owner)},'authenticated','authenticated',now(),now()),
    (${u(ids.consultant)},'authenticated','authenticated',now(),now()),
    (${u(ids.outsider)},'authenticated','authenticated',now(),now());
insert into public.centers(id,name) values (${q(ids.center)},'P4A synthetic center'),(${q(ids.otherCenter)},'P4A synthetic other center');
update public.center_crm_control set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=2 where center_id in (${q(ids.center)},${q(ids.otherCenter)});
insert into public.center_members(id,center_id,user_id,role,status) values
  (${u(ids.ownerMembership)},${q(ids.center)},${u(ids.owner)},'owner','active'),
  (${u(ids.consultantMembership)},${q(ids.center)},${u(ids.consultant)},'consultant','active'),
  (${u(ids.outsiderMembership)},${q(ids.otherCenter)},${u(ids.outsider)},'owner','active');`)
  assert.equal(scalar(`select count(*) from public.crm_contact_lookup_control where center_id in (${q(ids.center)},${q(ids.otherCenter)}) and rotation_state='ACTIVE' and current_key_epoch=1 and control_version=1;`), '2')

  const phoneCases = [
    ['090 000 0001', '+84900000001'], ['090.000.0001', '+84900000001'],
    ['84 90 000 0001', '+84900000001'], ['+84 (90) 000-0001', '+84900000001'],
  ]
  for (const [input, expected] of phoneCases) {
    assert.equal(scalar(`select public.f23_3e_p4a_internal_normalize_phone_v1(${q(input)});`), expected)
  }
  for (const invalid of ['+1 202 555 0100', '090000001', '09000000001', '++84900000001', '09O0000001', '０９０００００００１', '0900000001 ext 2']) {
    expectFailure(`select public.f23_3e_p4a_internal_normalize_phone_v1(${q(invalid)});`, 'CONTACT_PHONE_INVALID')
  }
  assert.equal(scalar(`select public.f23_3e_p4a_internal_normalize_email_v1('Case@Test.Invalid');`), 'Case@test.invalid')
  assert.equal(scalar(`select public.f23_3e_p4a_internal_normalize_email_v1(' case@test.invalid ');`), 'case@test.invalid')
  for (const invalid of ['bad', '.a@test.invalid', 'a..b@test.invalid', 'a@-test.invalid', 'a@test', 'a@tést.invalid']) {
    expectFailure(`select public.f23_3e_p4a_internal_normalize_email_v1(${q(invalid)});`, 'CONTACT_EMAIL_INVALID')
  }
  const payloadA = scalar(`select pg_catalog.encode(payload,'hex') from public.f23_3e_p4a_internal_canonical_payload(array['0900000001','+84 90 000 0001'],array['B@Test.Invalid','a@test.invalid']);`)
  const payloadB = scalar(`select pg_catalog.encode(payload,'hex') from public.f23_3e_p4a_internal_canonical_payload(array['+84900000001'],array['a@test.invalid','B@test.invalid','a@test.invalid']);`)
  assert.equal(payloadA, payloadB)
  assert(payloadA.startsWith(Buffer.from('IC4CPV01').toString('hex')))
  assert.equal(scalar(`select pg_catalog.encode(x.payload,'hex')=pg_catalog.encode(${q(`\\x${payloadA}`)}::bytea,'hex') from public.f23_3e_p4a_internal_canonical_payload((select canonical_phones from public.f23_3e_p4a_internal_parse_payload_v1(${q(`\\x${payloadA}`)}::bytea)),(select canonical_emails from public.f23_3e_p4a_internal_parse_payload_v1(${q(`\\x${payloadA}`)}::bytea)))x;`), 't')
  expectFailure(`select * from public.f23_3e_p4a_internal_parse_payload_v1(pg_catalog.convert_to('raw phone','UTF8'));`, 'CONTACT_PAYLOAD_UNSUPPORTED')
  console.log('P4A_QA_NORMALIZATION_PAYLOAD: PASS')

  assert.equal(scalar(`with k as(select public.f23_3e_p4a_internal_lookup_key(1) v)
select (public.f23_3e_p4a_internal_lookup_digest(v,${q(ids.center)},'PHONE','+84900000001',1)
 <>public.f23_3e_p4a_internal_lookup_digest(v,${q(ids.center)},'EMAIL','+84900000001',1)
 and public.f23_3e_p4a_internal_lookup_digest(v,${q(ids.center)},'PHONE','+84900000001',1)
 <>public.f23_3e_p4a_internal_lookup_digest(v,${q(ids.otherCenter)},'PHONE','+84900000001',1))::text from k;`), 'true')
  assert.equal(scalar(`select (public.f23_3e_p4a_internal_lookup_digest(public.f23_3e_p4a_internal_lookup_key(1),${q(ids.center)},'PHONE','+84900000001',1)
 <>public.f23_3e_p4a_internal_lookup_digest(public.f23_3e_p4a_internal_lookup_key(2),${q(ids.center)},'PHONE','+84900000001',2))::text;`), 'true')
  console.log('P4A_QA_LOOKUP_DIGEST_DOMAINS: PASS')

  const ingress = jsonValue(ingressSql())
  assert.equal(ingress.ok, true)
  assert.equal(ingress.replayed, false)
  assert.equal(ingress.contact_version, 2)
  const replay = jsonValue(ingressSql({ phones: ['+84900000001', '090.000.0001'], emails: ['Case@test.invalid'] }))
  assert.equal(replay.replayed, true)
  assert.equal(replay.crm_contact_id, ingress.crm_contact_id)
  assert.equal(replay.contact_version, 2)
  expectFailure(ingressSql({ name: 'Semantic drift' }), 'INGRESS_CONFLICT')
  expectFailure(ingressSql({ source: 'foreign-actor', actor: ids.outsider }), 'RESOURCE_NOT_AVAILABLE')
  assert.equal(scalar(`select contact_methods_crypto_version||':'||normalization_version||':'||contact_version from public.crm_contact where crm_contact_id=${u(ingress.crm_contact_id)};`), '2:1:2')
  assert.equal(scalar(`select pg_catalog.convert_from(pg_catalog.substr(protected_contact_methods_ciphertext,1,8),'UTF8') from public.crm_contact where crm_contact_id=${u(ingress.crm_contact_id)};`), 'IC3CSE01')
  assert.equal(scalar(`select count(*) from public.crm_contact_lookup_evidence where crm_contact_id=${u(ingress.crm_contact_id)} and evidence_status='ACTIVE' and key_epoch=1;`), '2')
  assert.equal(scalar(`select count(*) from public.crm_audit_event where resource_id=${u(ingress.crm_contact_id)} and event_type='crm.contact.canonical_ingressed';`), '1')
  assert.equal(scalar(`select count(*) from public.crm_outbox_event where aggregate_id=${u(ingress.crm_contact_id)} and event_type='crm.contact.canonical_ingressed';`), '1')
  assert.equal(scalar(`select count(*) from public.crm_contact c where c.crm_contact_id=${u(ingress.crm_contact_id)} and c.normalized_lookup_digests=(select array_agg(e.lookup_digest order by e.lookup_digest) from public.crm_contact_lookup_evidence e where e.crm_contact_id=c.crm_contact_id and e.evidence_status='ACTIVE');`), '1')

  for (const rpc of ['f23_3e_p4a_ingress_canonical_contact', 'f23_3e_p4a_reingest_canonical_contact', 'f23_3e_p4a_transition_lookup_key_epoch', 'f23_3e_p4a_read_contact_ingress_status']) {
    const response = await postRpc(rpc, localStatus.ANON_KEY, localStatus.ANON_KEY, {})
    assert([401, 403, 404].includes(response.status), `${rpc}: anon HTTP ${response.status}`)
  }
  const tableResponse = await fetch(`${localStatus.API_URL}/rest/v1/crm_contact_lookup_evidence?select=*`, {
    headers: { apikey: localStatus.SERVICE_ROLE_KEY, Authorization: `Bearer ${localStatus.SERVICE_ROLE_KEY}` },
  })
  assert([401, 403, 404].includes(tableResponse.status), `service table HTTP ${tableResponse.status}`)
  assert.equal(scalar(`select count(*) from public.crm_audit_event where row_to_json(crm_audit_event)::text ~* '(0900000001|Case@Test.Invalid|IC4CPV01)';`), '0')
  assert.equal(scalar(`select count(*) from public.crm_outbox_event where row_to_json(crm_outbox_event)::text ~* '(0900000001|Case@Test.Invalid|IC4CPV01)';`), '0')
  console.log('P4A_QA_INGRESS_REPLAY_SECURITY: PASS')

  const beginRotation = jsonValue(`set role service_role; select row_to_json(x) from public.f23_3e_p4a_transition_lookup_key_epoch(${q(ids.center)},${u(ids.owner)},1,'BEGIN_ROTATION',2)x; reset role;`)
  assert.equal(beginRotation.rotation_state, 'PREPARING')
  const reingestDual = jsonValue(`set role service_role; select row_to_json(x) from public.f23_3e_p4a_reingest_canonical_contact(${q(ids.center)},${u(ids.owner)},${u(ingress.crm_contact_id)},2)x; reset role;`)
  assert.equal(reingestDual.replayed, false)
  assert.equal(reingestDual.contact_version, 3)
  assert.equal(scalar(`select count(distinct key_epoch) from public.crm_contact_lookup_evidence where crm_contact_id=${u(ingress.crm_contact_id)} and evidence_status='ACTIVE';`), '2')
  const activate = jsonValue(`set role service_role; select row_to_json(x) from public.f23_3e_p4a_transition_lookup_key_epoch(${q(ids.center)},${u(ids.owner)},2,'ACTIVATE_ROTATION',2)x; reset role;`)
  assert.equal(activate.rotation_state, 'DUAL_READ')

  psql(`insert into public.crm_identity_policy_registry(identity_policy_registry_id,environment_fingerprint,center_id,identity_kind,center_identity_policy_version,normalization_algorithm,normalization_version,digest_key_epoch,match_policy_version,minimum_evidence_policy_version)
values (${u(randomUUID())},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.center)},'GUARDIAN',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1);
update public.crm_identity_policy_registry set status='CURRENT',policy_registry_version=2 where center_id=${q(ids.center)} and identity_kind='GUARDIAN';`)
  assert(Number(scalar(`select cardinality(public.f23_3e_p3c_internal_identity_mutex_keys(${q(ids.center)},'GUARDIAN',(select identity_policy_registry_id from public.crm_identity_policy_registry where center_id=${q(ids.center)} and identity_kind='GUARDIAN' and status='CURRENT'),'Synthetic Guardian',null,${u(ingress.crm_contact_id)}));`)) >= 6)

  // Test-only Guardian fixture proves the physical retirement dependency. It
  // does not claim a production Guardian transition and is removed immediately.
  psql(`set session_replication_role='replica';
insert into public.guardian_profile(guardian_id,center_id,display_name,protected_contact_methods_ciphertext,contact_methods_crypto_version,normalized_lookup_digests,normalization_version,identity_evidence_digest,created_from_contact_id,created_from_case_id,created_from_request_id,created_from_action_id,created_by_user_id)
values(${u(ids.guardian)},${q(ids.center)},'Synthetic dependency',pg_catalog.decode(pg_catalog.repeat('11',68),'hex'),1,
array[(select lookup_digest from public.crm_contact_lookup_evidence where crm_contact_id=${u(ingress.crm_contact_id)} and key_epoch=1 limit 1)]::bytea[],1,extensions.digest(pg_catalog.convert_to('guardian-dependency','UTF8'),'sha256'),${u(ingress.crm_contact_id)},${u(randomUUID())},${u(randomUUID())},${u(randomUUID())},${u(ids.owner)});
set session_replication_role='origin';`)
  expectFailure(`set role service_role; select * from public.f23_3e_p4a_transition_lookup_key_epoch(${q(ids.center)},${u(ids.owner)},3,'BEGIN_RETIREMENT',2);`, 'LOOKUP_EPOCH_DEPENDENCY_ACTIVE')
  psql(`set session_replication_role='replica'; delete from public.guardian_profile where guardian_id=${u(ids.guardian)}; set session_replication_role='origin';`)
  const retire = jsonValue(`set role service_role; select row_to_json(x) from public.f23_3e_p4a_transition_lookup_key_epoch(${q(ids.center)},${u(ids.owner)},3,'BEGIN_RETIREMENT',2)x; reset role;`)
  assert.equal(retire.rotation_state, 'RETIRING')
  const reingestCurrent = jsonValue(`set role service_role; select row_to_json(x) from public.f23_3e_p4a_reingest_canonical_contact(${q(ids.center)},${u(ids.owner)},${u(ingress.crm_contact_id)},3)x; reset role;`)
  assert.equal(reingestCurrent.contact_version, 4)
  assert.equal(scalar(`select count(distinct key_epoch) from public.crm_contact_lookup_evidence where crm_contact_id=${u(ingress.crm_contact_id)} and evidence_status='ACTIVE';`), '1')
  psql(`set session_replication_role='replica';
insert into public.guardian_profile(guardian_id,center_id,display_name,protected_contact_methods_ciphertext,contact_methods_crypto_version,normalized_lookup_digests,normalization_version,identity_evidence_digest,created_from_contact_id,created_from_case_id,created_from_request_id,created_from_action_id,created_by_user_id)
values(${u(ids.guardian)},${q(ids.center)},'Synthetic late dependency',pg_catalog.decode(pg_catalog.repeat('12',68),'hex'),1,
array[(select lookup_digest from public.crm_contact_lookup_evidence where crm_contact_id=${u(ingress.crm_contact_id)} and key_epoch=1 limit 1)]::bytea[],1,extensions.digest(pg_catalog.convert_to('guardian-late-dependency','UTF8'),'sha256'),${u(ingress.crm_contact_id)},${u(randomUUID())},${u(randomUUID())},${u(randomUUID())},${u(ids.owner)});
set session_replication_role='origin';`)
  expectFailure(`set role service_role; select * from public.f23_3e_p4a_transition_lookup_key_epoch(${q(ids.center)},${u(ids.owner)},4,'COMPLETE_RETIREMENT',2);`, 'LOOKUP_EPOCH_DEPENDENCY_ACTIVE')
  psql(`set session_replication_role='replica'; delete from public.guardian_profile where guardian_id=${u(ids.guardian)}; set session_replication_role='origin';`)
  const complete = jsonValue(`set role service_role; select row_to_json(x) from public.f23_3e_p4a_transition_lookup_key_epoch(${q(ids.center)},${u(ids.owner)},4,'COMPLETE_RETIREMENT',2)x; reset role;`)
  assert.equal(complete.rotation_state, 'ACTIVE')
  assert.equal(complete.current_key_epoch, 2)
  console.log('P4A_QA_ROTATION_GUARDIAN_COMPATIBILITY: PASS')

  for (const table of ['crm_audit_event', 'crm_outbox_event']) {
    const suffix = table.replaceAll('_', '')
    psql(`create function public.p4a_qa_fail_${suffix}() returns trigger language plpgsql set search_path='' as $$begin raise exception 'p4a_qa_fault_${suffix}'; end$$;
create trigger p4a_qa_fail_${suffix} before insert on public.${table} for each row execute function public.p4a_qa_fail_${suffix}();`)
    const contactsBefore = scalar('select count(*) from public.crm_contact;')
    const evidenceBefore = scalar('select count(*) from public.crm_contact_lookup_evidence;')
    expectFailure(ingressSql({ source: `fault-${table}`, phones: ['0910000002'], emails: [] }), `p4a_qa_fault_${suffix}`)
    assert.equal(scalar('select count(*) from public.crm_contact;'), contactsBefore)
    assert.equal(scalar('select count(*) from public.crm_contact_lookup_evidence;'), evidenceBefore)
    psql(`drop trigger p4a_qa_fail_${suffix} on public.${table}; drop function public.p4a_qa_fail_${suffix}();`)
  }
  console.log('P4A_QA_FAULT_ROLLBACK: PASS')

  assert.equal(scalar(`select count(*) from public.crm_contact_lookup_evidence e join public.crm_contact c using(center_id,crm_contact_id) where e.evidence_status='ACTIVE' and not e.lookup_digest=any(c.normalized_lookup_digests);`), '0')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'p4a_qa_%';`), '0')
  console.log('P4A_LOCAL_DOCKER_QA: PASS')
} finally {
  if (fixtureCreated) {
    psql(`revoke execute on function vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea) from postgres;
revoke execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) from postgres;
revoke execute on function vault._crypto_aead_det_noncegen() from postgres;`, { user: 'supabase_admin' })
    runReset()
    containerId = discoverContainer()
    assert.equal(scalar('select count(*) from auth.users;'), '0')
    assert.equal(scalar('select count(*) from vault.secrets;'), '0')
    assert.equal(scalar('select count(*) from public.crm_contact_lookup_evidence;'), '0')
    assert.equal(scalar(`select count(*) from public.crm_contact where legacy_source_kind='local.parent_consultation.v1';`), '0')
    assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'p4a_qa_%';`), '0')
    assert.equal(scalar(`select count(*) from pg_catalog.pg_trigger where not tgisinternal and tgname like 'p4a_qa_%';`), '0')
    assert.equal(scalar(`select has_function_privilege('postgres','vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea)','EXECUTE');`), 'f')
    assert.equal(scalar(`select has_function_privilege('postgres','vault._crypto_aead_det_noncegen()','EXECUTE');`), 'f')
    finalResetVerified = true
    fixtureCreated = false
    console.log('P4A_QA_FINAL_RESET: PASS')
  }
  assert(finalResetVerified || !fixtureCreated, 'Final reset was not verified')
}
