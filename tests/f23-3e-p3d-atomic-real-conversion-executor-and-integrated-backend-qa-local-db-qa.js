import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainerName = 'supabase_db_ichess-center-os'
const resetConsentFlag = 'ICHESS_P3D_LOCAL_QA_ALLOW_RESET'

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
console.log('P3D_QA_LOCAL_SAFETY_GUARD: PASS')
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
const digest = (value) => `extensions.digest(pg_catalog.convert_to(${q(value)},'UTF8'),'sha256')`
const digestArray = (value) => `array[${digest(value)}]::bytea[]`
const bytea = (pair, bytes = 32) => `pg_catalog.decode(pg_catalog.repeat(${q(pair)},${bytes}),'hex')`
const spawnPsql = () => spawn('docker', psqlArgs(), {
  cwd: process.cwd(), windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
})
const collect = (child) => {
  let stdout = ''; let stderr = ''
  child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk) => { stdout += chunk })
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const done = new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('close', (code) => code === 0
      ? resolve({ stdout, stderr })
      : reject(new Error(`psql worker ${code}: ${stderr || stdout}`)))
  })
  const marker = (needle) => new Promise((resolve, reject) => {
    const deadline = setTimeout(() => reject(new Error(`Timeout ${needle}`)), 20_000)
    const check = () => stdout.includes(needle)
      ? (clearTimeout(deadline), resolve()) : setTimeout(check, 20)
    check()
  })
  return { child, done, marker }
}
const waitForLock = async (applicationName) => {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const waiting = scalar(`select coalesce(bool_or(wait_event_type='Lock' and cardinality(pg_catalog.pg_blocking_pids(pid))>0),false) from pg_catalog.pg_stat_activity where application_name=${q(applicationName)};`)
    if (waiting === 't') return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`${applicationName} did not exhibit a PostgreSQL lock wait`)
}
const postRpc = (rpc, apikey, bearer, body) => fetch(`${localStatus.API_URL}/rest/v1/rpc/${rpc}`, {
  method: 'POST',
  headers: { apikey, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const ids = {
  center: `p3dqa-${randomUUID()}`,
  owner: randomUUID(), consultant: randomUUID(),
  ownerMembership: randomUUID(), consultantMembership: randomUUID(),
  contact: randomUUID(), case: randomUUID(), assignment: randomUUID(), candidate: randomUUID(),
  studentPolicy: randomUUID(), guardianPolicy: randomUUID(),
  requestRegistry: randomUUID(), request: randomUUID(),
  studentReview: randomUUID(), guardianReview: randomUUID(),
  studentReservation: randomUUID(), guardianReservation: randomUUID(),
  studentTarget: randomUUID(), guardianTarget: randomUUID(),
  relationshipAction: randomUUID(),
  studentP2Action: randomUUID(), guardianP2Action: randomUUID(),
}
const evidence = { studentName: 'Synthetic P3D Student', birth: '2013-04-05', guardianName: 'Synthetic P3D Guardian' }
let fixtureCreated = false
let finalResetVerified = false

const executeSql = ({ key = 'execute-key', intent = 'execute-intent', environment = 'authority-environment' } = {}) => `
set role service_role;
select row_to_json(x) from public.f23_3e_p3d_execute_conversion(
  ${u(ids.request)},${u(ids.authority)},3,1,${digest(environment)},
  ${digest(intent)},${digest(key)},now()+interval '1 hour'
) x;
reset role;`
const stateVector = () => scalar(`select concat_ws('|',
  (select status||':'||request_version from public.crm_conversion_request where conversion_request_id=${u(ids.request)}),
  (select status||':'||authority_version from public.crm_conversion_authority where conversion_authority_id=${u(ids.authority)}),
  (select string_agg(status||':'||action_version,',' order by conversion_action_id) from public.crm_conversion_action where conversion_request_id=${u(ids.request)}),
  (select status||':'||case_version from public.consultation_case where consultation_case_id=${u(ids.case)}),
  (select candidate_status||':'||candidate_version from public.consultation_case_candidate_student where candidate_student_id=${u(ids.candidate)}),
  (select assignment_status||':'||assignment_version from public.consultation_case_assignment where assignment_id=${u(ids.assignment)}),
  (select count(*) from public.student_profile),(select count(*) from public.guardian_profile),
  (select count(*) from public.crm_identity_target_binding),(select count(*) from public.guardian_student_relationship),
  (select count(*) from public.crm_profile_creation_reservation where status='CONSUMED'),
  (select count(*) from public.crm_idempotency_registry where operation='crm.real_conversion.execute')
);`)

let idempotencyCounter = 80
const nextIdempotency = () => bytea((idempotencyCounter++).toString(16).padStart(2, '0'))
const p2Args = (kind, actionId) => `${u(ids.owner)},2,${q(kind)},${u(ids.candidate)},2,4,3,${q(kind === 'STUDENT' ? evidence.studentName : evidence.guardianName)},${kind === 'STUDENT' ? `${q(evidence.birth)}::date` : 'null::date'},null,1,1,1,2,1,${u(actionId)}`
const createReview = (kind, actionId) => jsonValue(`set role service_role; select public.f23_3e_p2c_create_match_review(${u(ids.request)},${p2Args(kind, actionId)},${nextIdempotency()},null,null,null); reset role;`)
const decideReview = (kind, actionId, reviewId) => jsonValue(`set role service_role; select public.f23_3e_p2c_decide_match_review(${u(ids.request)},${u(reviewId)},1,'PREPARE_CREATE_NEW',${p2Args(kind, actionId)},${nextIdempotency()}); reset role;`)
const reserve = (kind, actionId, reviewId) => jsonValue(`set role service_role; select public.f23_3e_p2c_reserve_create_target(${u(ids.request)},${u(reviewId)},2,${p2Args(kind, actionId)},${nextIdempotency()}); reset role;`)

const makeIndependentContext = (label) => ({
  label, contact: randomUUID(), case: randomUUID(), assignment: randomUUID(), candidate: randomUUID(),
  requestRegistry: randomUUID(), request: randomUUID(), studentP2Action: randomUUID(),
  guardianP2Action: randomUUID(), relationshipAction: randomUUID(), session: randomUUID(),
})
const p2ArgsFor = (ctx, kind, actionId) => `${u(ids.owner)},2,${q(kind)},${u(ctx.candidate)},2,4,3,${q(kind === 'STUDENT' ? evidence.studentName : evidence.guardianName)},${kind === 'STUDENT' ? `${q(evidence.birth)}::date` : 'null::date'},null,1,1,1,2,1,${u(actionId)}`
const executeSqlFor = (ctx, { key, intent, environment = 'authority-environment' }) => `
set role service_role;
select row_to_json(x) from public.f23_3e_p3d_execute_conversion(
  ${u(ctx.request)},${u(ctx.authority)},3,1,${digest(environment)},
  ${digest(intent)},${digest(key)},now()+interval '1 hour') x;
reset role;`

const seedIndependentSource = (ctx) => {
  psql(`
insert into public.crm_contact(crm_contact_id,center_id,display_name,source_category,
  protected_contact_methods_ciphertext,contact_methods_crypto_version,normalized_lookup_digests,
  normalization_version,created_by_user_id)
values (${u(ctx.contact)},${q(ids.center)},${q(evidence.guardianName)},'synthetic',${bytea('42',16)},1,
  ${digestArray(`p3d-contact-${ctx.label}`)},1,${u(ids.owner)});
insert into public.consultation_case(consultation_case_id,center_id,primary_contact_id,created_by_user_id)
values (${u(ctx.case)},${q(ids.center)},${u(ctx.contact)},${u(ids.owner)});
begin; set constraints all deferred;
insert into public.consultation_case_assignment(assignment_id,center_id,consultation_case_id,
  assigned_consultant_user_id,assigned_by_user_id)
values (${u(ctx.assignment)},${q(ids.center)},${u(ctx.case)},${u(ids.consultant)},${u(ids.owner)});
update public.consultation_case set active_assignment_id=${u(ctx.assignment)},case_version=2
where consultation_case_id=${u(ctx.case)}; commit;
update public.consultation_case set status='CONSULTING',conversion_state='DRAFT',case_version=3,updated_at=now()
where consultation_case_id=${u(ctx.case)};
update public.consultation_case set status='READY_FOR_CONVERSION',conversion_state='REVIEW_PENDING',case_version=4,updated_at=now()
where consultation_case_id=${u(ctx.case)};
insert into public.consultation_case_candidate_student(candidate_student_id,center_id,consultation_case_id,
  display_name_evidence,birth_evidence_protected,candidate_status)
values (${u(ctx.candidate)},${q(ids.center)},${u(ctx.case)},${q(evidence.studentName)},${bytea('52',16)},'DRAFT');
update public.consultation_case_candidate_student set candidate_status='ACTIVE',candidate_version=2
where candidate_student_id=${u(ctx.candidate)};
insert into public.crm_idempotency_registry(idempotency_record_id,environment_fingerprint,center_id,
  resource_scope_kind,resource_scope_id,consultation_case_id,operation,idempotency_key_digest,
  intent_digest,request_intent_digest,action_graph_digest,expires_at)
values (${u(ctx.requestRegistry)},${digest(`request-env-${ctx.label}`)},${q(ids.center)},'consultation_case',
  ${u(ctx.case)},${u(ctx.case)},${q(`p3d.qa.request.${ctx.label}`)},${digest(`request-key-${ctx.label}`)},
  ${digest(`request-intent-${ctx.label}`)},${digest(`request-intent-${ctx.label}`)},
  ${digest(`legacy-action-graph-${ctx.label}`)},now()+interval '1 day');
insert into public.crm_conversion_request(conversion_request_id,center_id,consultation_case_id,source_contact_id,
  source_case_version,source_contact_version,source_assignment_id,source_assignment_version,
  identity_policy_version,conversion_policy_version,relationship_policy_version,student_profile_policy_version,
  action_graph_digest,idempotency_scope,idempotency_key_reference,intent_digest,requested_by_user_id)
values (${u(ctx.request)},${q(ids.center)},${u(ctx.case)},${u(ctx.contact)},4,2,${u(ctx.assignment)},1,
  1,1,1,1,${digest(`legacy-action-graph-${ctx.label}`)},${q(`p3d.qa.${ctx.label}`)},
  ${u(ctx.requestRegistry)},${digest(`conversion-intent-${ctx.label}`)},${u(ids.consultant)});
update public.crm_conversion_request set status='READY_FOR_REVIEW',request_version=2,updated_at=now()
where conversion_request_id=${u(ctx.request)};`)
  const contact = jsonValue(`select row_to_json(x) from public.f23_3e_p3c_internal_protect_contact_source_evidence(
    ${q(ids.center)},${u(ctx.contact)},1,pg_catalog.convert_to('P3D SYNTHETIC CONTACT','UTF8')) x;`)
  assert.equal(contact.contact_version, 2)
  const birth = jsonValue(`select pg_catalog.json_build_object('candidate_version',x.candidate_version)
    from public.f23_3e_p3d_internal_protect_candidate_birth_evidence(
      ${q(ids.center)},${u(ctx.case)},${u(ctx.candidate)},2,${q(evidence.birth)}::date) x;`)
  assert.equal(birth.candidate_version, 3)
}

const createAndDecideReviewFor = (ctx, kind, actionId, reviewAction, targetId = null) => {
  const created = jsonValue(`set role service_role; select public.f23_3e_p2c_create_match_review(
    ${u(ctx.request)},${p2ArgsFor(ctx, kind, actionId)},${nextIdempotency()},${u(targetId)},${targetId ? 1 : 'null'},null); reset role;`)
  assert.equal(created.status, 'PENDING', `${ctx.label}-${kind}-create: ${created.outcome_code}`)
  const decided = jsonValue(`set role service_role; select public.f23_3e_p2c_decide_match_review(
    ${u(ctx.request)},${u(created.resource_id)},1,${q(reviewAction)},${p2ArgsFor(ctx, kind, actionId)},${nextIdempotency()}); reset role;`)
  return { id: created.resource_id, decided }
}

const preparePlanAndAuthority = (ctx, { mode = 'REUSE', issueAuthority = true } = {}) => {
  const targetStudent = ids.studentTarget
  const targetGuardian = ids.guardianTarget
  {
    const studentSearch = jsonValue(`set role service_role; select public.f23_3e_p2b_search_masked_candidates(
      ${u(ctx.request)},${p2ArgsFor(ctx,'STUDENT',ctx.studentP2Action).replace(/,[^,]+$/, '')}); reset role;`)
    const guardianSearch = jsonValue(`set role service_role; select public.f23_3e_p2b_search_masked_candidates(
      ${u(ctx.request)},${p2ArgsFor(ctx,'GUARDIAN',ctx.guardianP2Action).replace(/,[^,]+$/, '')}); reset role;`)
    for (const [kind,result,target] of [['STUDENT',studentSearch,targetStudent],['GUARDIAN',guardianSearch,targetGuardian]]) {
      const candidate = result.candidates.find((item) => item.opaque_target_id === target)
      assert(candidate, `${ctx.label}-${kind}: canonical target not returned`)
      assert.equal(candidate.reuse_review_mode, 'CROSS_SOURCE_EXPLICIT_REVIEW')
      assert.equal(candidate.reuse_eligible, false, 'external masked response must not grant reuse')
      assert.deepEqual(Object.keys(candidate).filter((key) => key.startsWith('supporting_')), [])
    }
  }
  const reviewAction = mode === 'REUSE' ? 'REUSE_EXISTING' : 'REJECT_IDENTITY_ACTION'
  const student = createAndDecideReviewFor(ctx,'STUDENT',ctx.studentP2Action,reviewAction,targetStudent)
  const guardian = createAndDecideReviewFor(ctx,'GUARDIAN',ctx.guardianP2Action,reviewAction,targetGuardian)
  assert.equal(student.decided.status, mode === 'REUSE' ? 'EXACT_REVIEWED_MATCH' : 'REJECTED_MATCH')
  assert.equal(guardian.decided.status, mode === 'REUSE' ? 'EXACT_REVIEWED_MATCH' : 'REJECTED_MATCH')
  ctx.studentReview=student.id; ctx.guardianReview=guardian.id
  const relationshipDecision = mode === 'REUSE' ? 'REUSE_EXISTING_RELATIONSHIP' : 'DO_NOT_CREATE_RELATIONSHIP'
  const materialized = jsonValue(`set role service_role; select row_to_json(x)
    from public.f23_3e_p3c_materialize_reviewed_action_pair(
      ${u(ids.owner)},${u(ctx.request)},2,${u(ctx.guardianReview)},2,${u(ctx.studentReview)},2,
      ${u(ctx.relationshipAction)},${q(relationshipDecision)},${mode === 'REUSE' ? q('PARENT') : 'null'},
      ${mode === 'REUSE' ? 'true' : 'null'},${mode === 'REUSE' ? q('PRIMARY') : 'null'},
      ${mode === 'REUSE' ? q('PRIMARY') : 'null'},${q(mode === 'REUSE' ? 'P3D_REVIEWED' : 'EXPLICIT_REVIEWED_NO_CREATE')},1,
      ${digest(`materialize-intent-${ctx.label}`)},${digest(`materialize-key-${ctx.label}`)},now()+interval '1 hour') x; reset role;`)
  assert.equal(materialized.ok, true, `${ctx.label}-materialize: ${materialized.outcome_code}`)
  ctx.studentAction=materialized.student_action_id; ctx.guardianAction=materialized.guardian_action_id
  ctx.relationshipAction=materialized.relationship_action_id
  const finalized = jsonValue(`set role service_role; select row_to_json(x)
    from public.f23_3e_p3c_finalize_reviewed_action_plan(${u(ids.owner)},${u(ctx.request)},2,3,
      ${digest(`finalize-intent-${ctx.label}`)},${digest(`finalize-key-${ctx.label}`)},now()+interval '1 hour') x; reset role;`)
  assert.equal(finalized.ok, true, `${ctx.label}-finalize: ${finalized.outcome_code}`)
  if (!issueAuthority) return { materialized, finalized, authority: null }
  const step = jsonValue(`set role service_role; select row_to_json(x)
    from public.f23_3e_p3b_record_verified_conversion_step_up(${u(ids.owner)},${u(ctx.session)},${u(ctx.request)},
      'AAL2_TOTP','local.synthetic.server-verifier',${digest(`step-verification-${ctx.label}`)},now(),1,
      ${digest(`step-intent-${ctx.label}`)},${digest(`step-key-${ctx.label}`)},now()+interval '1 hour') x; reset role;`)
  assert.equal(step.outcome_code, 'STEP_UP_ASSERTION_ISSUED')
  const authority = jsonValue(`set role service_role; select row_to_json(x)
    from public.f23_3e_p3b_issue_conversion_authority(${u(ids.owner)},${u(ctx.request)},${u(step.step_up_assertion_id)},
      2,1,${digest('authority-environment')},${digest(`authority-intent-${ctx.label}`)},
      ${digest(`authority-key-${ctx.label}`)},now()+interval '1 hour') x; reset role;`)
  assert.equal(authority.outcome_code, 'CONVERSION_AUTHORITY_ISSUED', `${ctx.label}-authority`)
  ctx.authority=authority.conversion_authority_id
  return { materialized, finalized, authority }
}

try {
  runReset()
  containerId = discoverContainer()
  console.log('P3D_QA_LOCAL_SQL_APPLY: PASS')
  assert.equal(scalar(`select count(*) from supabase_migrations.schema_migrations where name like 'f23_3e_p3d_atomic_real_conversion_executor_and_integrated_backend_qa%';`), '1')
  assert.equal(scalar('select count(*) from auth.users;'), '0')
  assert.equal(scalar('select count(*) from vault.secrets;'), '0')
  assert.equal(scalar(`select count(*) from information_schema.tables where table_schema='public' and table_name like 'p3d%';`), '0')
  assert.equal(scalar(`select extversion from pg_catalog.pg_extension where extname='supabase_vault';`), '0.3.1')
  for (const signature of [
    'vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea)',
    'vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea)',
    'vault._crypto_aead_det_noncegen()',
  ]) assert.equal(scalar(`select (pg_catalog.to_regprocedure(${q(signature)}) is not null)::text;`), 'true')
  psql(`grant execute on function vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
grant execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
grant execute on function vault._crypto_aead_det_noncegen() to postgres;`, { user: 'supabase_admin' })
  console.log('P3D_QA_P3D0_CRYPTO_PREFLIGHT: PASS')

  const executeSignature = 'public.f23_3e_p3d_execute_conversion(uuid,uuid,integer,integer,bytea,bytea,bytea,timestamp with time zone)'
  const statusSignature = 'public.f23_3e_p3d_read_conversion_result_status(uuid,bytea)'
  for (const signature of [executeSignature, statusSignature]) {
    assert.equal(scalar(`select (pg_catalog.to_regprocedure(${q(signature)}) is not null)::text;`), 'true')
    assert.equal(scalar(`select has_function_privilege('service_role',${q(signature)},'EXECUTE');`), 't')
    assert.equal(scalar(`select has_function_privilege('anon',${q(signature)},'EXECUTE');`), 'f')
    assert.equal(scalar(`select has_function_privilege('authenticated',${q(signature)},'EXECUTE');`), 'f')
    assert.equal(scalar(`select p.prosecdef::text||'|'||coalesce(array_to_string(p.proconfig,','),'') from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure(${q(signature)});`), 'true|search_path=""')
  }
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('f23_3e_p3d_execute_conversion','f23_3e_p3d_read_conversion_result_status');`), '2')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p3d_internal_%' and (has_function_privilege('service_role',p.oid,'EXECUTE') or has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'));`), '0')
  const recreatedFunctionContracts = [
    ['public.f23_3e_p2b_internal_search_masked_candidates(uuid,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,integer)', false, true],
    ['public.f23_3e_p3c_internal_resolve_reusable_student(text,uuid,uuid,integer,uuid)', false, true],
    ['public.f23_3e_p3c_internal_resolve_reusable_guardian(text,uuid,uuid,integer,uuid)', false, true],
    ['public.f23_3e_p3b_internal_is_safe_result_snapshot(jsonb)', false, false],
    ['public.f23_3e_p3c_materialize_reviewed_action_pair(uuid,uuid,integer,uuid,integer,uuid,integer,uuid,text,text,boolean,text,text,text,integer,bytea,bytea,timestamp with time zone)', true, true],
    ['public.f23_3e_p3c_finalize_reviewed_action_plan(uuid,uuid,integer,integer,bytea,bytea,timestamp with time zone)', true, true],
    ['public.f23_3e_p3b_issue_conversion_authority(uuid,uuid,uuid,integer,integer,bytea,bytea,bytea,timestamp with time zone)', true, true],
    ['public.f23_3e_p2c_supersede_match_review(uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea)', true, true],
    ['public.f23_3e_p2c_expire_match_review(uuid,uuid,integer,uuid,integer,text,uuid,integer,integer,integer,text,date,integer,integer,integer,integer,integer,integer,uuid,bytea)', true, true],
  ]
  for (const [signature, serviceAllowed, securityDefiner] of recreatedFunctionContracts) {
    assert.equal(scalar(`select (pg_catalog.to_regprocedure(${q(signature)}) is not null)::text;`), 'true', signature)
    assert.equal(scalar(`select exists(select 1 from pg_catalog.pg_proc p,
      lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) x
      where p.oid=pg_catalog.to_regprocedure(${q(signature)}) and x.grantee=0
        and x.privilege_type='EXECUTE')::text;`), 'false', `${signature}: PUBLIC`)
    assert.equal(scalar(`select has_function_privilege('anon',${q(signature)},'EXECUTE');`), 'f', `${signature}: anon`)
    assert.equal(scalar(`select has_function_privilege('authenticated',${q(signature)},'EXECUTE');`), 'f', `${signature}: authenticated`)
    assert.equal(scalar(`select has_function_privilege('service_role',${q(signature)},'EXECUTE');`), serviceAllowed ? 't' : 'f', `${signature}: service_role`)
    assert.equal(scalar(`select p.prosecdef::text from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure(${q(signature)});`), String(securityDefiner), `${signature}: SECURITY DEFINER`)
    assert.equal(scalar(`select coalesce(array_to_string(p.proconfig,','),'') from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure(${q(signature)});`), 'search_path=""', `${signature}: search_path`)
  }
  const anonRpcDenials = [
    ['f23_3e_p2b_internal_search_masked_candidates', { p_conversion_request_id:null,p_actor_user_id:null,p_expected_request_version:null,p_identity_kind:null,p_candidate_student_id:null,p_expected_contact_version:null,p_expected_case_version:null,p_expected_candidate_version:null,p_display_name_evidence:null,p_birth_date_evidence:null,p_birth_year_evidence:null,p_expected_normalization_version:null,p_expected_match_policy_version:null,p_expected_minimum_evidence_policy_version:null,p_expected_policy_registry_version:null,p_expected_adapter_version:null,p_detail_opaque_target_id:null,p_expected_target_version:null }],
    ['f23_3e_p3c_internal_resolve_reusable_student', { p_center_id:null,p_source_candidate_student_id:null,p_student_id:null,p_expected_student_version:null,p_match_review_id:null }],
    ['f23_3e_p3c_internal_resolve_reusable_guardian', { p_center_id:null,p_source_contact_id:null,p_guardian_id:null,p_expected_guardian_version:null,p_match_review_id:null }],
    ['f23_3e_p3b_internal_is_safe_result_snapshot', { p_snapshot:{} }],
    ['f23_3e_p3c_materialize_reviewed_action_pair', { p_actor_user_id:null,p_conversion_request_id:null,p_expected_request_version:null,p_guardian_match_review_id:null,p_expected_guardian_review_version:null,p_student_match_review_id:null,p_expected_student_review_version:null,p_relationship_action_id:null,p_relationship_decision:null,p_relationship_type:null,p_is_primary_contact:null,p_financial_contact_role:null,p_academic_contact_role:null,p_safe_reason_code:null,p_relationship_policy_version:null,p_operation_intent_digest:null,p_idempotency_key_digest:null,p_idempotency_expires_at:null }],
    ['f23_3e_p3c_finalize_reviewed_action_plan', { p_actor_user_id:null,p_conversion_request_id:null,p_expected_request_version:null,p_expected_action_count:null,p_operation_intent_digest:null,p_idempotency_key_digest:null,p_idempotency_expires_at:null }],
    ['f23_3e_p3b_issue_conversion_authority', { p_actor_user_id:null,p_conversion_request_id:null,p_step_up_assertion_id:null,p_expected_request_version:null,p_expected_step_up_assertion_version:null,p_environment_fingerprint:null,p_operation_intent_digest:null,p_idempotency_key_digest:null,p_idempotency_expires_at:null }],
    ['f23_3e_p2c_supersede_match_review', { p_conversion_request_id:null,p_match_review_id:null,p_expected_review_version:null,p_actor_user_id:null,p_expected_request_version:null,p_identity_kind:null,p_candidate_student_id:null,p_expected_contact_version:null,p_expected_case_version:null,p_expected_candidate_version:null,p_display_name_evidence:null,p_birth_date_evidence:null,p_birth_year_evidence:null,p_expected_normalization_version:null,p_expected_match_policy_version:null,p_expected_minimum_evidence_policy_version:null,p_expected_policy_registry_version:null,p_expected_adapter_version:null,p_action_id:null,p_idempotency_key_digest:null }],
    ['f23_3e_p2c_expire_match_review', { p_conversion_request_id:null,p_match_review_id:null,p_expected_review_version:null,p_actor_user_id:null,p_expected_request_version:null,p_identity_kind:null,p_candidate_student_id:null,p_expected_contact_version:null,p_expected_case_version:null,p_expected_candidate_version:null,p_display_name_evidence:null,p_birth_date_evidence:null,p_birth_year_evidence:null,p_expected_normalization_version:null,p_expected_match_policy_version:null,p_expected_minimum_evidence_policy_version:null,p_expected_policy_registry_version:null,p_expected_adapter_version:null,p_action_id:null,p_idempotency_key_digest:null }],
  ]
  for (const [rpc, body] of anonRpcDenials) {
    const response = await postRpc(rpc,localStatus.ANON_KEY,localStatus.ANON_KEY,body)
    assert([401,403,404].includes(response.status), `${rpc}: anon HTTP ${response.status}`)
  }
  console.log('P3D_QA_RECREATED_FUNCTION_EFFECTIVE_GRANTS: PASS')
  console.log('P3D_QA_RECREATED_FUNCTION_ANON_POSTGREST_DENIAL: PASS')
  for (const table of ['student_profile','guardian_profile','crm_identity_target_binding','guardian_student_relationship','crm_reviewed_cross_source_reuse_authorization']) {
    assert.equal(scalar(`select (c.relrowsecurity and c.relforcerowsecurity)::text from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=${q(table)};`), 'true')
    assert.equal(scalar(`select count(*) from pg_catalog.pg_policies where schemaname='public' and tablename=${q(table)};`), '0')
    for (const role of ['anon','authenticated','service_role']) {
      assert.equal(scalar(`select has_table_privilege(${q(role)},${q(`public.${table}`)},'SELECT,INSERT,UPDATE,DELETE');`), 'f')
    }
  }
  assert.equal(scalar(`select count(*) from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename in ('student_profile','guardian_profile','crm_identity_target_binding','guardian_student_relationship');`), '0')
  console.log('P3D_QA_RLS_GRANTS_PRIVACY: PASS')

  psql(`select vault.create_secret(pg_catalog.encode(extensions.gen_random_bytes(32),'hex'),'f23_3e_p2b_identity_digest_epoch_1','P3D synthetic local QA');`)
  fixtureCreated = true
  psql(`
insert into auth.users(id,aud,role,created_at,updated_at) values
(${u(ids.owner)},'authenticated','authenticated',now(),now()),
(${u(ids.consultant)},'authenticated','authenticated',now(),now());
insert into public.centers(id,name) values (${q(ids.center)},'p3d synthetic local center');
update public.center_crm_control set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=2 where center_id=${q(ids.center)};
insert into public.center_members(id,center_id,user_id,role,status) values
(${u(ids.ownerMembership)},${q(ids.center)},${u(ids.owner)},'owner','active'),
(${u(ids.consultantMembership)},${q(ids.center)},${u(ids.consultant)},'consultant','active');
insert into public.crm_contact(
  crm_contact_id,center_id,display_name,source_category,
  protected_contact_methods_ciphertext,contact_methods_crypto_version,
  normalized_lookup_digests,normalization_version,created_by_user_id
) values (${u(ids.contact)},${q(ids.center)},${q(evidence.guardianName)},'synthetic',${bytea('41',16)},1,${digestArray('p3d-contact')},1,${u(ids.owner)});
insert into public.consultation_case(consultation_case_id,center_id,primary_contact_id,created_by_user_id)
values (${u(ids.case)},${q(ids.center)},${u(ids.contact)},${u(ids.owner)});
begin; set constraints all deferred;
insert into public.consultation_case_assignment(
  assignment_id,center_id,consultation_case_id,assigned_consultant_user_id,assigned_by_user_id
) values (${u(ids.assignment)},${q(ids.center)},${u(ids.case)},${u(ids.consultant)},${u(ids.owner)});
update public.consultation_case set active_assignment_id=${u(ids.assignment)},case_version=2 where consultation_case_id=${u(ids.case)};
commit;
update public.consultation_case set status='CONSULTING',conversion_state='DRAFT',case_version=3,updated_at=now() where consultation_case_id=${u(ids.case)};
update public.consultation_case set status='READY_FOR_CONVERSION',conversion_state='REVIEW_PENDING',case_version=4,updated_at=now() where consultation_case_id=${u(ids.case)};
insert into public.consultation_case_candidate_student(
  candidate_student_id,center_id,consultation_case_id,display_name_evidence,birth_evidence_protected,candidate_status
) values (${u(ids.candidate)},${q(ids.center)},${u(ids.case)},${q(evidence.studentName)},${bytea('51',16)},'DRAFT');
update public.consultation_case_candidate_student set candidate_status='ACTIVE',candidate_version=2 where candidate_student_id=${u(ids.candidate)};
insert into public.crm_identity_policy_registry(
  identity_policy_registry_id,environment_fingerprint,center_id,identity_kind,
  center_identity_policy_version,normalization_algorithm,normalization_version,
  digest_key_epoch,match_policy_version,minimum_evidence_policy_version
) values
(${u(ids.studentPolicy)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.center)},'STUDENT',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1),
(${u(ids.guardianPolicy)},public.f23_3e_p2b_internal_environment_fingerprint(1),${q(ids.center)},'GUARDIAN',1,'p2b.student_identity.nfc_casefold_v1',1,1,1,1);
update public.crm_identity_policy_registry set status='CURRENT',policy_registry_version=2 where center_id=${q(ids.center)};
`)
  const contactProtected = jsonValue(`select row_to_json(x) from public.f23_3e_p3c_internal_protect_contact_source_evidence(${q(ids.center)},${u(ids.contact)},1,pg_catalog.convert_to('P3D SYNTHETIC CONTACT','UTF8')) x;`)
  assert.equal(contactProtected.contact_version, 2)
  const birthProtected = jsonValue(`select pg_catalog.json_build_object('candidate_version',x.candidate_version) from public.f23_3e_p3d_internal_protect_candidate_birth_evidence(${q(ids.center)},${u(ids.case)},${u(ids.candidate)},2,${q(evidence.birth)}::date) x;`)
  assert.equal(birthProtected.candidate_version, 3)
  const sourceEnvelope = scalar(`select pg_catalog.encode(birth_evidence_protected,'hex') from public.consultation_case_candidate_student where candidate_student_id=${u(ids.candidate)};`)
  assert(sourceEnvelope.startsWith(Buffer.from('IC3CBE01').toString('hex')))
  assert.equal(scalar(`select public.f23_3e_p3d_internal_unwrap_candidate_birth_evidence(${q(ids.center)},${u(ids.case)},${u(ids.candidate)},3)::text;`), evidence.birth)
  console.log('P3D_QA_CANDIDATE_BIRTH_SOURCE_CANONICAL: PASS')

  psql(`
insert into public.crm_idempotency_registry(
  idempotency_record_id,environment_fingerprint,center_id,resource_scope_kind,resource_scope_id,
  consultation_case_id,operation,idempotency_key_digest,intent_digest,request_intent_digest,
  action_graph_digest,expires_at
) values (${u(ids.requestRegistry)},${digest('request-env')},${q(ids.center)},'consultation_case',${u(ids.case)},${u(ids.case)},'p3d.qa.request',${digest('request-key')},${digest('request-intent')},${digest('request-intent')},${digest('legacy-action-graph')},now()+interval '1 day');
insert into public.crm_conversion_request(
  conversion_request_id,center_id,consultation_case_id,source_contact_id,
  source_case_version,source_contact_version,source_assignment_id,source_assignment_version,
  identity_policy_version,conversion_policy_version,relationship_policy_version,
  student_profile_policy_version,action_graph_digest,idempotency_scope,
  idempotency_key_reference,intent_digest,requested_by_user_id
) values (${u(ids.request)},${q(ids.center)},${u(ids.case)},${u(ids.contact)},4,2,${u(ids.assignment)},1,1,1,1,1,${digest('legacy-action-graph')},'p3d.qa',${u(ids.requestRegistry)},${digest('conversion-intent')},${u(ids.consultant)});
update public.crm_conversion_request set status='READY_FOR_REVIEW',request_version=2,updated_at=now() where conversion_request_id=${u(ids.request)};
`)

  const studentSearch = jsonValue(`set role service_role; select public.f23_3e_p2b_search_masked_candidates(${u(ids.request)},${p2Args('STUDENT', randomUUID()).replace(/,[^,]+$/, '')}); reset role;`)
  const guardianSearch = jsonValue(`set role service_role; select public.f23_3e_p2b_search_masked_candidates(${u(ids.request)},${p2Args('GUARDIAN', randomUUID()).replace(/,[^,]+$/, '')}); reset role;`)
  assert.equal(studentSearch.outcome_code, 'NO_MATCH')
  assert.equal(guardianSearch.outcome_code, 'NO_MATCH')
  const studentReview = createReview('STUDENT', ids.studentP2Action)
  ids.studentReview = studentReview.resource_id
  assert.equal(studentReview.status, 'PENDING')
  assert.equal(decideReview('STUDENT', ids.studentP2Action, ids.studentReview).status, 'CREATE_NEW_REVIEWED')
  const studentReservation = reserve('STUDENT', ids.studentP2Action, ids.studentReview)
  ids.studentReservation = studentReservation.resource_id
  ids.studentTarget = studentReservation.opaque_target_id
  const guardianReview = createReview('GUARDIAN', ids.guardianP2Action)
  ids.guardianReview = guardianReview.resource_id
  assert.equal(guardianReview.status, 'PENDING')
  assert.equal(decideReview('GUARDIAN', ids.guardianP2Action, ids.guardianReview).status, 'CREATE_NEW_REVIEWED')
  const guardianReservation = reserve('GUARDIAN', ids.guardianP2Action, ids.guardianReview)
  ids.guardianReservation = guardianReservation.resource_id
  ids.guardianTarget = guardianReservation.opaque_target_id
  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where status='ACTIVE';`), '2')
  console.log('P3D_QA_P2B_P2C_REGRESSION: PASS')

  const materialized = jsonValue(`set role service_role;
select row_to_json(x) from public.f23_3e_p3c_materialize_reviewed_action_pair(
  ${u(ids.owner)},${u(ids.request)},2,
  ${u(ids.guardianReview)},2,${u(ids.studentReview)},2,
  ${u(ids.relationshipAction)},'CREATE_RELATIONSHIP','PARENT',true,
  'PRIMARY','PRIMARY','P3D_REVIEWED',1,
  ${digest('materialize-intent')},${digest('materialize-key')},now()+interval '1 hour'
) x; reset role;`)
  assert.equal(materialized.ok, true)
  ids.guardianAction = materialized.guardian_action_id
  ids.studentAction = materialized.student_action_id
  ids.relationshipAction = materialized.relationship_action_id
  const finalized = jsonValue(`set role service_role;
select row_to_json(x) from public.f23_3e_p3c_finalize_reviewed_action_plan(
  ${u(ids.owner)},${u(ids.request)},2,3,
  ${digest('finalize-intent')},${digest('finalize-key')},now()+interval '1 hour'
) x; reset role;`)
  assert.equal(finalized.ok, true)
  assert.equal(finalized.max_action_version, 2)
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.request)} and status='REVIEWED' and action_version=2;`), '3')

  const security = jsonValue(`set role service_role;
select row_to_json(x) from public.f23_3e_p3b_register_or_sync_account_security_control(
  ${u(ids.owner)},${u(ids.owner)},'ACTIVE',${digest('security-evidence')},null,
  ${digest('security-intent')},${digest('security-key')},now()+interval '1 hour'
) x; reset role;`)
  assert.equal(security.outcome_code, 'ACCOUNT_SECURITY_CONTROL_REGISTERED')
  const sessionId = randomUUID()
  const step = jsonValue(`set role service_role;
select row_to_json(x) from public.f23_3e_p3b_record_verified_conversion_step_up(
  ${u(ids.owner)},${u(sessionId)},${u(ids.request)},'AAL2_TOTP',
  'local.synthetic.server-verifier',${digest('step-verification')},now(),1,
  ${digest('step-intent')},${digest('step-key')},now()+interval '1 hour'
) x; reset role;`)
  assert.equal(step.outcome_code, 'STEP_UP_ASSERTION_ISSUED')
  const authority = jsonValue(`set role service_role;
select row_to_json(x) from public.f23_3e_p3b_issue_conversion_authority(
  ${u(ids.owner)},${u(ids.request)},${u(step.step_up_assertion_id)},2,1,
  ${digest('authority-environment')},${digest('authority-issue-intent')},
  ${digest('authority-issue-key')},now()+interval '1 hour'
) x; reset role;`)
  assert.equal(authority.outcome_code, 'CONVERSION_AUTHORITY_ISSUED')
  assert.equal(authority.request_status, 'APPROVED')
  ids.authority = authority.conversion_authority_id
  assert.equal(scalar(`select status||':'||authority_version from public.crm_conversion_authority where conversion_authority_id=${u(ids.authority)};`), 'ISSUED:1')
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.request)} and status='APPROVED' and action_version=3;`), '3')
  assert.equal(scalar(`select (environment_fingerprint=${digest('authority-environment')})::text from public.crm_conversion_authority where conversion_authority_id=${u(ids.authority)};`), 'true')
  assert.equal(scalar(`select (environment_fingerprint=public.f23_3e_p3c_internal_crypto_environment_fingerprint())::text from public.crm_conversion_authority where conversion_authority_id=${u(ids.authority)};`), 'false')
  console.log('P3D_QA_P3B_AUTHORITY_COMPATIBILITY: PASS')
  console.log('P3D_QA_ENVIRONMENT_DOMAINS_INDEPENDENT: PASS')

  const baseState = stateVector()
  const transactionalFailure = (label, mutation, expected) => {
    const result = jsonValue(`begin; set session_replication_role='replica'; ${mutation}; set session_replication_role='origin'; ${executeSql({ key: `drift-${label}` })} rollback;`)
    assert.equal(result.ok, false, label)
    assert(expected.includes(result.outcome_code) || result.outcome_code === 'REAL_CONVERSION_FAILED', `${label}: ${result.outcome_code}`)
    assert.equal(stateVector(), baseState, `${label} leaked state`)
  }
  transactionalFailure('membership', `update public.center_members set status='inactive',membership_version=2 where id=${u(ids.ownerMembership)}`, ['AUTHORITY_SECURITY_BINDING_STALE'])
  transactionalFailure('security', `update public.account_security_control set security_version=2,control_version=2 where canonical_user_id=${u(ids.owner)}`, ['AUTHORITY_SECURITY_BINDING_STALE'])
  transactionalFailure('step', `update public.account_step_up_assertion set session_version=2,assertion_version=3 where consumed_by_authority_id=${u(ids.authority)}`, ['AUTHORITY_SECURITY_BINDING_STALE'])
  transactionalFailure('authority', `update public.crm_conversion_authority set expires_at=now()-interval '1 second' where conversion_authority_id=${u(ids.authority)}`, ['AUTHORITY_NOT_AVAILABLE','AUTHORITY_OR_REQUEST_STALE'])
  transactionalFailure('request', `update public.crm_conversion_request set request_version=99 where conversion_request_id=${u(ids.request)}`, ['AUTHORITY_NOT_AVAILABLE','AUTHORITY_OR_REQUEST_STALE'])
  transactionalFailure('contact', `update public.crm_contact set contact_version=99 where crm_contact_id=${u(ids.contact)}`, ['SOURCE_WORKFLOW_STATE_STALE'])
  transactionalFailure('case', `update public.consultation_case set status='CONSULTING' where consultation_case_id=${u(ids.case)}`, ['SOURCE_WORKFLOW_STATE_STALE'])
  transactionalFailure('assignment', `update public.consultation_case_assignment set assignment_status='REVOKED',ended_at=now(),end_reason='QA_DRIFT' where assignment_id=${u(ids.assignment)}`, ['SOURCE_WORKFLOW_STATE_STALE'])
  transactionalFailure('candidate', `update public.consultation_case_candidate_student set candidate_version=99 where candidate_student_id=${u(ids.candidate)}`, ['CANDIDATE_STATE_STALE'])
  transactionalFailure('birth-legacy', `update public.consultation_case_candidate_student set birth_evidence_protected=pg_catalog.convert_to('2013-04-05','UTF8') where candidate_student_id=${u(ids.candidate)}`, ['CANDIDATE_BIRTH_SOURCE_UNAVAILABLE'])
  transactionalFailure('review', `update public.crm_identity_match_review set expires_at=now()-interval '1 second' where match_review_id=${u(ids.studentReview)}`, ['CANDIDATE_STATE_STALE'])
  transactionalFailure('reservation', `update public.crm_profile_creation_reservation set status='CANCELLED',terminal_at=now(),terminal_reason_code='REQUEST_CANCELLED' where reservation_id=${u(ids.studentReservation)}`, ['CREATE_STUDENT_TARGET_EVIDENCE_STALE'])
  transactionalFailure('action', `update public.crm_conversion_action set action_intent_digest=${digest('drifted-action')} where conversion_action_id=${u(ids.studentAction)}`, ['APPROVED_ACTION_SET_DIGEST_STALE'])
  transactionalFailure('policy', `update public.center_crm_control set conversion_policy_version=2 where center_id=${q(ids.center)}`, ['CONVERSION_POLICY_VERSION_STALE'])
  console.log('P3D_QA_AUTHORITY_SECURITY_SOURCE_REVIEW_RESERVATION_DRIFT: PASS')
  console.log('P3D_QA_BIRTH_LEGACY_UNKNOWN_FAIL_CLOSED: PASS')

  for (const faultTable of ['student_profile','guardian_profile','guardian_student_relationship','crm_identity_target_binding','crm_audit_event','crm_outbox_event']) {
    const suffix = faultTable.replaceAll('_','')
    psql(`create function public.p3d_qa_fail_${suffix}() returns trigger language plpgsql set search_path='' as $$begin raise exception 'p3d_qa_fault_${suffix}'; end$$;
create trigger p3d_qa_fail_${suffix} before insert on public.${faultTable} for each row execute function public.p3d_qa_fail_${suffix}();`)
    const result = jsonValue(executeSql({ key: `fault-${faultTable}` }))
    assert.equal(result.ok, false)
    assert.equal(stateVector(), baseState, `${faultTable} fault leaked state`)
    psql(`drop trigger p3d_qa_fail_${suffix} on public.${faultTable}; drop function public.p3d_qa_fail_${suffix}();`)
  }
  psql(`create function public.p3d_qa_fail_idempotency() returns trigger language plpgsql set search_path='' as $$begin if new.status='COMPLETED' then raise exception 'p3d_qa_fault_idempotency'; end if; return new; end$$;
create trigger p3d_qa_fail_idempotency before update on public.crm_idempotency_registry for each row execute function public.p3d_qa_fail_idempotency();`)
  const idempotencyFault = jsonValue(executeSql({ key: 'fault-idempotency' }))
  assert.equal(idempotencyFault.ok, false)
  assert.equal(stateVector(), baseState)
  psql(`drop trigger p3d_qa_fail_idempotency on public.crm_idempotency_registry; drop function public.p3d_qa_fail_idempotency();`)
  console.log('P3D_QA_FAULT_ROLLBACK_MATRIX: PASS')

  let raceCounter = 0
  const lockRace = async (name, lockSql) => {
    raceCounter += 1
    const holder = collect(spawnPsql())
    holder.child.stdin.write(`begin; set application_name='p3d_${name}_holder'; ${lockSql}; \\echo P3D_HELD\n`)
    await holder.marker('P3D_HELD')
    const contender = collect(spawnPsql())
    contender.child.stdin.end(`begin; set statement_timeout='20s'; set application_name='p3d_${name}_contender'; ${executeSql({ key: `race-${name}` })} rollback; \\echo P3D_DONE\n`)
    await waitForLock(`p3d_${name}_contender`)
    holder.child.stdin.end('rollback; \\q\n')
    await holder.done
    const contenderResult = await contender.done
    const result = jsonFrom(contenderResult.stdout)
    assert.equal(result.ok, true, `${name}: ${result.outcome_code}: ${contenderResult.stderr}`)
    assert.equal(stateVector(), baseState, `${name} rollback leaked state`)
  }
  await lockRace('root', `select center_id from public.center_crm_control where center_id=${q(ids.center)} for update`)
  await lockRace('security', `select canonical_user_id from public.account_security_control where canonical_user_id=${u(ids.owner)} for update`)
  await lockRace('authority', `select conversion_authority_id from public.crm_conversion_authority where conversion_authority_id=${u(ids.authority)} for update`)
  await lockRace('request', `select conversion_request_id from public.crm_conversion_request where conversion_request_id=${u(ids.request)} for update`)
  await lockRace('candidate', `select candidate_student_id from public.consultation_case_candidate_student where candidate_student_id=${u(ids.candidate)} for update`)
  await lockRace('reservation', `select reservation_id from public.crm_profile_creation_reservation where reservation_id=${u(ids.studentReservation)} for update`)
  await lockRace('relationship', `select conversion_action_id from public.crm_conversion_action where conversion_action_id=${u(ids.relationshipAction)} for update`)
  assert.equal(raceCounter, 7)
  console.log('P3D_QA_REAL_POSTGRES_LOCK_WAITS: 7')
  console.log('P3D_QA_CONCURRENCY_MATRIX: PASS')

  const beforeEvents = scalar(`select (select count(*) from public.crm_audit_event)::text||'|'||(select count(*) from public.crm_outbox_event)::text;`)
  const completed = jsonValue(executeSql())
  assert.equal(completed.ok, true)
  assert.equal(completed.replayed, false)
  assert.equal(completed.outcome_code, 'REAL_CONVERSION_COMPLETED')
  assert.equal(completed.request_status, 'COMPLETED')
  assert.equal(completed.request_version, 5)
  assert.equal(completed.authority_status, 'CONSUMED')
  assert.equal(completed.authority_version, 2)
  assert.equal(completed.case_version, 5)
  assert.equal(completed.executed_action_results.length, 3)
  assert.equal(scalar(`select status||':'||request_version from public.crm_conversion_request where conversion_request_id=${u(ids.request)};`), 'COMPLETED:5')
  assert.equal(scalar(`select status||':'||authority_version from public.crm_conversion_authority where conversion_authority_id=${u(ids.authority)};`), 'CONSUMED:2')
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.request)} and status='EXECUTED' and action_version=4;`), '3')
  assert.equal(scalar(`select status||':'||conversion_state||':'||case_version||':'||(active_assignment_id is null)::text from public.consultation_case where consultation_case_id=${u(ids.case)};`), 'CONVERTED:COMPLETED:5:true')
  assert.equal(scalar(`select candidate_status||':'||candidate_version from public.consultation_case_candidate_student where candidate_student_id=${u(ids.candidate)};`), 'CONVERTED:4')
  assert.equal(scalar(`select assignment_status||':'||assignment_version||':'||end_reason from public.consultation_case_assignment where assignment_id=${u(ids.assignment)};`), 'ENDED:2:CASE_CONVERTED')
  assert.equal(scalar(`select count(*) from public.student_profile where student_id=${u(ids.studentTarget)} and profile_status='ACTIVE' and learning_lifecycle_status is null and student_version=1;`), '1')
  assert.equal(scalar(`select count(*) from public.guardian_profile where guardian_id=${u(ids.guardianTarget)} and guardian_status='ACTIVE' and guardian_version=1;`), '1')
  assert.equal(scalar(`select count(*) from public.crm_identity_target_binding where binding_status='ACTIVE' and originating_request_id=${u(ids.request)};`), '2')
  assert.equal(scalar(`select count(*) from public.guardian_student_relationship where center_id=${q(ids.center)} and guardian_id=${u(ids.guardianTarget)} and student_id=${u(ids.studentTarget)} and status='ACTIVE';`), '1')
  assert.equal(scalar(`select count(*) from public.crm_profile_creation_reservation where reservation_id in (${u(ids.studentReservation)},${u(ids.guardianReservation)}) and status='CONSUMED' and terminal_reason_code='CONSUMED_BY_FUTURE_EXECUTOR';`), '2')
  const studentEnvelope = scalar(`select pg_catalog.encode(birth_evidence_protected,'hex') from public.student_profile where student_id=${u(ids.studentTarget)};`)
  assert(studentEnvelope.startsWith(Buffer.from('IC3SBE01').toString('hex')))
  assert.notEqual(studentEnvelope, sourceEnvelope)
  assert.equal(scalar(`select public.f23_3e_p3d_internal_validate_student_birth_evidence(${q(ids.center)},${u(ids.studentTarget)},1)::text;`), 'true')
  assert.equal(scalar(`select (public.f23_3e_p3c_internal_crypto_environment_fingerprint()=${digest('authority-environment')})::text;`), 'false')
  console.log('P3D_QA_CREATE_CREATE_RELATIONSHIP_HAPPY_PATH: PASS')
  console.log('P3D_QA_BIRTH_SOURCE_UNWRAP_TARGET_REPROTECT: PASS')
  console.log('P3D_QA_RESERVATION_AFTER_COMPOSITION_CONSUME: PASS')
  console.log('P3D_QA_ATOMIC_LIFECYCLE_COMPLETION: PASS')

  const p3cReplayEvents = scalar(`select (select count(*) from public.crm_audit_event)::text||'|'||(select count(*) from public.crm_outbox_event)::text;`)
  const materializedAfterExecuted = jsonValue(`set role service_role;
select row_to_json(x) from public.f23_3e_p3c_materialize_reviewed_action_pair(
  ${u(ids.owner)},${u(ids.request)},2,${u(ids.guardianReview)},2,${u(ids.studentReview)},2,
  ${u(ids.relationshipAction)},'CREATE_RELATIONSHIP','PARENT',true,'PRIMARY','PRIMARY',
  'P3D_REVIEWED',1,${digest('materialize-intent')},${digest('materialize-key')},now()+interval '1 hour'
) x; reset role;`)
  assert.equal(materializedAfterExecuted.replayed,true)
  assert.deepEqual(materializedAfterExecuted,{...materialized,replayed:true})
  const finalizedAfterExecuted = jsonValue(`set role service_role;
select row_to_json(x) from public.f23_3e_p3c_finalize_reviewed_action_plan(
  ${u(ids.owner)},${u(ids.request)},2,3,${digest('finalize-intent')},${digest('finalize-key')},now()+interval '1 hour'
) x; reset role;`)
  assert.equal(finalizedAfterExecuted.replayed,true)
  assert.deepEqual(finalizedAfterExecuted,{...finalized,replayed:true})
  const materializedPostLifecycleConflict = jsonValue(`set role service_role;
select row_to_json(x) from public.f23_3e_p3c_materialize_reviewed_action_pair(
  ${u(ids.owner)},${u(ids.request)},2,${u(ids.guardianReview)},2,${u(ids.studentReview)},2,
  ${u(ids.relationshipAction)},'CREATE_RELATIONSHIP','PARENT',true,'PRIMARY','PRIMARY',
  'P3D_REVIEWED',1,${digest('changed-materialize-intent')},${digest('materialize-key')},now()+interval '1 hour'
) x; reset role;`)
  assert.equal(materializedPostLifecycleConflict.ok,false)
  assert.equal(materializedPostLifecycleConflict.outcome_code,'IDEMPOTENCY_CONFLICT')
  const finalizedPostLifecycleConflict = jsonValue(`set role service_role;
select row_to_json(x) from public.f23_3e_p3c_finalize_reviewed_action_plan(
  ${u(ids.owner)},${u(ids.request)},2,3,${digest('changed-finalize-intent')},
  ${digest('finalize-key')},now()+interval '1 hour') x; reset role;`)
  assert.equal(finalizedPostLifecycleConflict.ok,false)
  assert.equal(finalizedPostLifecycleConflict.outcome_code,'IDEMPOTENCY_CONFLICT')
  assert.equal(scalar(`select (select count(*) from public.crm_audit_event)::text||'|'||(select count(*) from public.crm_outbox_event)::text;`),p3cReplayEvents)
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(ids.request)} and status='EXECUTED' and action_version=4;`),'3')
  console.log('P3D_QA_P3C_MATERIALIZE_IMMUTABLE_POST_LIFECYCLE_REPLAY: PASS')
  console.log('P3D_QA_P3C_FINALIZE_IMMUTABLE_POST_LIFECYCLE_REPLAY: PASS')

  const outboxLookupIndex = scalar(`select pg_catalog.pg_get_indexdef(c.oid) from pg_catalog.pg_class c
    where c.relname='crm_idempotency_registry_p3d_result_lookup_uidx';`)
  assert(outboxLookupIndex.includes("operation = 'crm.real_conversion.execute'"),outboxLookupIndex)
  assert(!outboxLookupIndex.includes("operation = 'conversion.execute'"),outboxLookupIndex)
  const duplicateResultLookup = psql(`begin;
    insert into public.crm_idempotency_registry(idempotency_record_id,environment_fingerprint,center_id,
      resource_scope_kind,resource_scope_id,consultation_case_id,operation,idempotency_key_digest,
      intent_digest,request_id,request_intent_digest,action_graph_digest,status,expires_at)
    select pg_catalog.gen_random_uuid(),${digest('different-result-environment')},center_id,
      'conversion_request',resource_scope_id,consultation_case_id,'crm.real_conversion.execute',
      idempotency_key_digest,${digest('different-result-intent')},request_id,request_intent_digest,
      action_graph_digest,'RESERVED',now()+interval '1 hour'
    from public.crm_idempotency_registry where resource_scope_id=${u(ids.request)}
      and operation='crm.real_conversion.execute'; rollback;`, { expectFailure:true })
  assert.notEqual(duplicateResultLookup.status,0)
  assert((duplicateResultLookup.stderr||duplicateResultLookup.stdout).includes('crm_idempotency_registry_p3d_result_lookup_uidx'))
  psql(`begin;
    insert into public.crm_idempotency_registry(idempotency_record_id,environment_fingerprint,center_id,
      resource_scope_kind,resource_scope_id,consultation_case_id,operation,idempotency_key_digest,
      intent_digest,request_id,request_intent_digest,action_graph_digest,status,expires_at)
    select pg_catalog.gen_random_uuid(),${digest('different-result-environment')},center_id,
      'conversion_request',resource_scope_id,consultation_case_id,'crm.real_conversion.execute',
      ${digest('different-result-key')},${digest('different-result-intent')},request_id,request_intent_digest,
      action_graph_digest,'RESERVED',now()+interval '1 hour'
    from public.crm_idempotency_registry where resource_scope_id=${u(ids.request)}
      and operation='crm.real_conversion.execute'; rollback;`)
  console.log('P3D_QA_REAL_CONVERSION_RESULT_LOOKUP_UNIQUENESS: PASS')

  const eventCounts = scalar(`select (select count(*) from public.crm_audit_event)::text||'|'||(select count(*) from public.crm_outbox_event)::text;`)
  assert.notEqual(eventCounts, beforeEvents)
  const replay = jsonValue(executeSql())
  assert.equal(replay.ok, true)
  assert.equal(replay.replayed, true)
  assert.equal(replay.correlation_id, completed.correlation_id)
  assert.deepEqual(replay.executed_action_results, completed.executed_action_results)
  assert.equal(scalar(`select (select count(*) from public.crm_audit_event)::text||'|'||(select count(*) from public.crm_outbox_event)::text;`), eventCounts)
  const conflict = jsonValue(executeSql({ intent: 'changed-intent' }))
  assert.equal(conflict.ok, false)
  assert.equal(conflict.outcome_code, 'IDEMPOTENCY_CONFLICT')
  const resultStatus = jsonValue(`set role service_role; select row_to_json(x) from public.f23_3e_p3d_read_conversion_result_status(${u(ids.request)},${digest('execute-key')}) x; reset role;`)
  assert.equal(resultStatus.ok, true)
  assert.equal(resultStatus.outcome_code, 'REAL_CONVERSION_COMPLETED')
  assert.equal(resultStatus.immutable_real_conversion_result.correlation_id, completed.correlation_id)
  assert.equal(resultStatus.immutable_real_conversion_result.resource_status, 'COMPLETED')
  assert.equal(scalar(`select (terminal_outcome_digest=extensions.digest(pg_catalog.convert_to(p3_result_snapshot::text,'UTF8'),'sha256'))::text from public.crm_idempotency_registry where operation='crm.real_conversion.execute';`), 'true')
  assert.equal(scalar(`select (r.terminal_outcome_digest=i.terminal_outcome_digest)::text from public.crm_conversion_request r join public.crm_idempotency_registry i on i.resource_scope_id=r.conversion_request_id and i.operation='crm.real_conversion.execute' where r.conversion_request_id=${u(ids.request)};`), 'true')
  console.log('P3D_QA_EXACT_REPLAY_BEFORE_LIVE_TERMINAL_RECHECK: PASS')
  console.log('P3D_QA_REPLAY_DOES_NOT_REHASH_EXECUTED_ACTIONS: PASS')
  console.log('P3D_QA_IMMUTABLE_RESULT_STATUS_ONLY: PASS')
  console.log('P3D_QA_IDEMPOTENCY_CONFLICT: PASS')

  // Genuine Request A -> independent Request B. All reviewed/finalized/
  // approved transitions use the protected production functions; no row from A
  // is resurrected and no historical binding is treated as B's authority.
  const requestB = makeIndependentContext('request-b')
  seedIndependentSource(requestB)
  preparePlanAndAuthority(requestB)
  assert.equal(scalar(`select count(*) from public.crm_reviewed_cross_source_reuse_authorization
    where conversion_request_id=${u(requestB.request)} and status='ISSUED' and authorization_version=1;`), '2')
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(requestB.request)}
    and status='APPROVED' and action_version=3 and action_set_encoding_version=2;`), '3')
  const requestBState = () => scalar(`select concat_ws('|',
    (select status||':'||request_version from public.crm_conversion_request where conversion_request_id=${u(requestB.request)}),
    (select status||':'||authority_version||':'||p3_action_set_encoding_version from public.crm_conversion_authority where conversion_authority_id=${u(requestB.authority)}),
    (select string_agg(status||':'||action_version||':'||action_set_encoding_version,',' order by conversion_action_id)
      from public.crm_conversion_action where conversion_request_id=${u(requestB.request)}),
    (select string_agg(status||':'||authorization_version,',' order by reviewed_reuse_authorization_id)
      from public.crm_reviewed_cross_source_reuse_authorization where conversion_request_id=${u(requestB.request)}),
    (select count(*) from public.crm_identity_target_binding where originating_request_id=${u(requestB.request)}),
    (select count(*) from public.crm_idempotency_registry where operation='crm.real_conversion.execute'
      and resource_scope_id=${u(requestB.request)}));`)
  const bBaseline = requestBState()
  const bSubstitution = (label, mutation) => {
    const attempt = jsonValue(`begin; set session_replication_role='replica'; ${mutation};
      set session_replication_role='origin';
      ${executeSqlFor(requestB,{key:`substitution-${label}`,intent:`substitution-intent-${label}`})}
      rollback;`)
    assert.equal(attempt.ok,false,`${label} unexpectedly executed`)
    assert.equal(requestBState(),bBaseline,`${label} leaked state`)
  }
  const invalidVersionShape = psql(`begin; set session_replication_role='replica';
    update public.crm_conversion_action set expected_reuse_authorization_version=2
    where conversion_request_id=${u(requestB.request)} and identity_kind='STUDENT'; rollback;`, { expectFailure: true })
  assert.notEqual(invalidVersionShape.status,0,'authorization version substitution must be rejected by shape constraint')
  assert.equal(requestBState(),bBaseline,'authorization version substitution leaked state')
  bSubstitution('authorization-id', `update public.crm_conversion_action set reviewed_reuse_authorization_id=(
      select reviewed_reuse_authorization_id from public.crm_reviewed_cross_source_reuse_authorization
      where conversion_request_id=${u(requestB.request)} and identity_kind='GUARDIAN')
    where conversion_request_id=${u(requestB.request)} and identity_kind='STUDENT'`)
  bSubstitution('relationship-scope', `update public.crm_conversion_action set relationship_scope_digest=${digest('substituted-relationship-scope')}
    where conversion_request_id=${u(requestB.request)} and identity_kind is null`)
  bSubstitution('v2-to-v1-downgrade', `update public.crm_conversion_authority set
      p3_action_set_encoding_version=1,p3_reuse_authorization_set_encoding_version=null,
      p3_reuse_authorization_set_digest=null where conversion_authority_id=${u(requestB.authority)}`)
  bSubstitution('authorization-set-digest', `update public.crm_conversion_authority set
      p3_reuse_authorization_set_digest=${digest('substituted-authorization-set')}
      where conversion_authority_id=${u(requestB.authority)}`)
  console.log('P3D_QA_AUTHORIZATION_RELATIONSHIP_DIGEST_SUBSTITUTION: PASS')
  console.log('P3D_QA_V1_V2_DOWNGRADE_FAIL_CLOSED: PASS')
  const completedB = jsonValue(executeSqlFor(requestB, { key: 'execute-key-request-b', intent: 'execute-intent-request-b' }))
  assert.equal(completedB.ok, true, `Request B: ${completedB.outcome_code}`)
  assert.equal(completedB.replayed, false)
  assert.equal(completedB.executed_action_results.filter((item) => /_REUSED$/.test(item.outcome_code)).length, 3)
  assert.notEqual(completedB.correlation_id, completed.correlation_id)
  assert.equal(scalar(`select count(*) from public.student_profile where center_id=${q(ids.center)};`), '1')
  assert.equal(scalar(`select count(*) from public.guardian_profile where center_id=${q(ids.center)};`), '1')
  assert.equal(scalar(`select count(*) from public.guardian_student_relationship where center_id=${q(ids.center)};`), '1')
  assert.equal(scalar(`select count(*) from public.crm_identity_target_binding where center_id=${q(ids.center)} and binding_status='ACTIVE';`), '4')
  assert.equal(scalar(`select count(*) from public.crm_identity_target_binding b
    where b.originating_request_id=${u(requestB.request)} and b.reviewed_reuse_authorization_id is not null
      and ((b.identity_kind='STUDENT' and b.source_candidate_student_id=${u(requestB.candidate)} and b.student_id=${u(ids.studentTarget)})
        or (b.identity_kind='GUARDIAN' and b.source_contact_id=${u(requestB.contact)} and b.guardian_id=${u(ids.guardianTarget)}));`), '2')
  assert.equal(scalar(`select count(*) from public.crm_identity_match_review r
    join public.crm_identity_target_binding b on b.identity_target_binding_id=r.supporting_identity_target_binding_id
    where r.conversion_request_id=${u(requestB.request)} and r.review_status='EXACT_REVIEWED_MATCH'
      and r.reviewer_user_id=${u(ids.owner)} and r.reviewer_membership_id=${u(ids.ownerMembership)}
      and b.originating_request_id=${u(ids.request)};`), '2')
  assert.equal(scalar(`select count(*) from public.crm_reviewed_cross_source_reuse_authorization
    where conversion_request_id=${u(requestB.request)} and status='CONSUMED' and authorization_version=2;`), '2')
  assert.equal(scalar(`select status||':'||request_version from public.crm_conversion_request
    where conversion_request_id=${u(ids.request)};`), 'COMPLETED:5')
  assert.equal(scalar(`select status||':'||request_version from public.crm_conversion_request
    where conversion_request_id=${u(requestB.request)};`), 'COMPLETED:5')
  assert.equal(scalar(`select count(distinct correlation_id) from public.crm_audit_event
    where request_id in (${u(ids.request)},${u(requestB.request)})
      and event_type='crm.conversion.completed';`), '2')
  const replayB = jsonValue(executeSqlFor(requestB, { key: 'execute-key-request-b', intent: 'execute-intent-request-b' }))
  assert.equal(replayB.replayed, true)
  assert.deepEqual(replayB.executed_action_results, completedB.executed_action_results)
  console.log('P3D_QA_GENUINE_REQUEST_A_TO_REQUEST_B_CROSS_SOURCE_REUSE: PASS')
  console.log('P3D_QA_REUSE_AUTHORIZATION_AND_BINDING_PROVENANCE: PASS')

  // Pre-issue recovery uses the existing P2C protected supersede surface.
  // The terminal review stays immutable; its sole V2 plan is terminalized and
  // only an independent fresh Request may recover.
  const requestPreIssue = makeIndependentContext('request-preissue-invalidated')
  seedIndependentSource(requestPreIssue)
  const preIssuePlan = preparePlanAndAuthority(requestPreIssue,{issueAuthority:false})
  assert.equal(scalar(`select count(*) from public.crm_conversion_authority
    where conversion_request_id=${u(requestPreIssue.request)};`),'0')
  const preIssueState = () => scalar(`select concat_ws('|',
    (select status||':'||request_version from public.crm_conversion_request where conversion_request_id=${u(requestPreIssue.request)}),
    (select string_agg(status||':'||action_version,',' order by conversion_action_id) from public.crm_conversion_action where conversion_request_id=${u(requestPreIssue.request)}),
    (select string_agg(status||':'||authorization_version,',' order by reviewed_reuse_authorization_id) from public.crm_reviewed_cross_source_reuse_authorization where conversion_request_id=${u(requestPreIssue.request)}),
    (select count(*) from public.crm_idempotency_registry where resource_scope_id=${u(requestPreIssue.request)}),
    (select count(*) from public.crm_audit_event),(select count(*) from public.crm_outbox_event));`)
  const preIssueBeforeFault = preIssueState()
  psql(`create function public.p3d_qa_fail_preissue_outbox() returns trigger language plpgsql set search_path=''
    as $$begin raise exception 'p3d_qa_fault_preissue_outbox'; end$$;
    create trigger p3d_qa_fail_preissue_outbox before insert on public.crm_outbox_event
    for each row execute function public.p3d_qa_fail_preissue_outbox();`)
  const preIssueFault = psql(`set role service_role; select public.f23_3e_p2c_supersede_match_review(
    ${u(requestPreIssue.request)},${u(requestPreIssue.studentReview)},2,
    ${p2ArgsFor(requestPreIssue,'STUDENT',requestPreIssue.studentP2Action)},${bytea('d0')}); reset role;`, {expectFailure:true})
  assert.notEqual(preIssueFault.status,0)
  assert((preIssueFault.stderr||preIssueFault.stdout).includes('p3d_qa_fault_preissue_outbox'))
  psql(`drop trigger p3d_qa_fail_preissue_outbox on public.crm_outbox_event;
    drop function public.p3d_qa_fail_preissue_outbox();`)
  assert.equal(preIssueState(),preIssueBeforeFault,'pre-issue invalidation fault leaked state')
  const preIssueEvents = scalar(`select (select count(*) from public.crm_audit_event)::text||'|'||(select count(*) from public.crm_outbox_event)::text;`)
  const preIssueKey = bytea('d1')
  const preIssueInvalidation = jsonValue(`set role service_role; select public.f23_3e_p2c_supersede_match_review(
    ${u(requestPreIssue.request)},${u(requestPreIssue.studentReview)},2,
    ${p2ArgsFor(requestPreIssue,'STUDENT',requestPreIssue.studentP2Action)},${preIssueKey}); reset role;`)
  assert.equal(preIssueInvalidation.ok,true,preIssueInvalidation.outcome_code)
  assert.equal(preIssueInvalidation.outcome_code,'CROSS_SOURCE_REUSE_PLAN_INVALIDATED_FRESH_REQUEST_REQUIRED')
  assert.equal(preIssueInvalidation.status,'EXACT_REVIEWED_MATCH')
  assert.equal(preIssueInvalidation.resource_version,2)
  assert.equal(scalar(`select status||':'||request_version from public.crm_conversion_request
    where conversion_request_id=${u(requestPreIssue.request)};`),'SUPERSEDED:3')
  assert.equal(scalar(`select count(*) from public.crm_conversion_action
    where conversion_request_id=${u(requestPreIssue.request)} and status='SUPERSEDED' and action_version=3;`),'3')
  assert.equal(scalar(`select count(*) from public.crm_reviewed_cross_source_reuse_authorization
    where conversion_request_id=${u(requestPreIssue.request)} and status='INVALIDATED' and authorization_version=2;`),'2')
  assert.equal(scalar(`select review_status||':'||review_version from public.crm_identity_match_review
    where match_review_id=${u(requestPreIssue.studentReview)};`),'EXACT_REVIEWED_MATCH:2')
  assert.equal(scalar(`select count(*) from public.crm_conversion_authority
    where conversion_request_id=${u(requestPreIssue.request)};`),'0')
  assert.notEqual(scalar(`select (select count(*) from public.crm_audit_event)::text||'|'||(select count(*) from public.crm_outbox_event)::text;`),preIssueEvents)
  const preIssueReplayEvents = scalar(`select (select count(*) from public.crm_audit_event)::text||'|'||(select count(*) from public.crm_outbox_event)::text;`)
  const preIssueReplay = jsonValue(`set role service_role; select public.f23_3e_p2c_supersede_match_review(
    ${u(requestPreIssue.request)},${u(requestPreIssue.studentReview)},2,
    ${p2ArgsFor(requestPreIssue,'STUDENT',requestPreIssue.studentP2Action)},${preIssueKey}); reset role;`)
  assert.deepEqual(preIssueReplay,{...preIssueInvalidation,replayed:true})
  assert.equal(scalar(`select (select count(*) from public.crm_audit_event)::text||'|'||(select count(*) from public.crm_outbox_event)::text;`),preIssueReplayEvents)
  const invalidatedFinalize = jsonValue(`set role service_role; select row_to_json(x)
    from public.f23_3e_p3c_finalize_reviewed_action_plan(${u(ids.owner)},${u(requestPreIssue.request)},3,3,
      ${digest('fresh-finalize-intent-preissue')},${digest('fresh-finalize-key-preissue')},now()+interval '1 hour') x; reset role;`)
  assert.equal(invalidatedFinalize.ok,false)
  assert.equal(scalar(`select count(*) from public.crm_identity_target_binding
    where originating_request_id=${u(requestPreIssue.request)};`),'0')

  const requestPreIssueRecovery = makeIndependentContext('request-preissue-fresh-recovery')
  seedIndependentSource(requestPreIssueRecovery)
  preparePlanAndAuthority(requestPreIssueRecovery)
  const completedPreIssueRecovery = jsonValue(executeSqlFor(requestPreIssueRecovery,
    {key:'execute-key-preissue-recovery',intent:'execute-intent-preissue-recovery'}))
  assert.equal(completedPreIssueRecovery.ok,true,completedPreIssueRecovery.outcome_code)
  assert.equal(scalar(`select status||':'||request_version from public.crm_conversion_request
    where conversion_request_id=${u(requestPreIssue.request)};`),'SUPERSEDED:3')
  assert.equal(scalar(`select status||':'||request_version from public.crm_conversion_request
    where conversion_request_id=${u(requestPreIssueRecovery.request)};`),'COMPLETED:5')
  assert.equal(preIssuePlan.materialized.ok,true)
  assert.equal(preIssuePlan.finalized.ok,true)
  console.log('P3D_QA_PREISSUE_V2_PLAN_INVALIDATION: PASS')
  console.log('P3D_QA_PREISSUE_FRESH_REQUEST_RECOVERY: PASS')
  console.log('P3D_QA_PREISSUE_NO_RESURRECTION: PASS')
  console.log('P3D_QA_PREISSUE_INVALIDATION_FAULT_ROLLBACK: PASS')

  // Post-issue invalidation terminalizes Request C's sole plan. Recovery uses
  // a fresh Request D; C is never resurrected and its evidence stays history.
  const requestC = makeIndependentContext('request-c-invalidated')
  seedIndependentSource(requestC)
  preparePlanAndAuthority(requestC)
  const revokedC = jsonValue(`set role service_role; select row_to_json(x)
    from public.f23_3e_p3b_revoke_or_expire_conversion_authority(
      ${u(ids.owner)},${u(requestC.authority)},1,'REVOKED','qa_plan_recovery',
      ${digest('revoke-intent-request-c')},${digest('revoke-key-request-c')},now()+interval '1 hour') x; reset role;`)
  assert.equal(revokedC.ok, true, `Request C revoke: ${revokedC.outcome_code}`)
  assert.equal(revokedC.status, 'REVOKED')
  assert.equal(scalar(`select status||':'||request_version from public.crm_conversion_request
    where conversion_request_id=${u(requestC.request)};`), 'SUPERSEDED:4')
  assert.equal(scalar(`select count(*) from public.crm_conversion_action where conversion_request_id=${u(requestC.request)}
    and status='SUPERSEDED' and action_version=4;`), '3')
  assert.equal(scalar(`select count(*) from public.crm_reviewed_cross_source_reuse_authorization
    where conversion_request_id=${u(requestC.request)} and status='INVALIDATED' and authorization_version=2;`), '2')
  assert.equal(scalar(`select (p3_result_snapshot->>'request_status')||':'||
    (p3_result_snapshot->>'invalidated_authorization_count')||':'||
    (p3_result_snapshot->>'superseded_action_count') from public.crm_idempotency_registry
    where resource_scope_id=${u(requestC.authority)} and operation='security.revoke_or_expire_conversion_authority';`), 'SUPERSEDED:2:3')
  const revokedReplayC = jsonValue(`set role service_role; select row_to_json(x)
    from public.f23_3e_p3b_revoke_or_expire_conversion_authority(
      ${u(ids.owner)},${u(requestC.authority)},1,'REVOKED','qa_plan_recovery',
      ${digest('revoke-intent-request-c')},${digest('revoke-key-request-c')},now()+interval '1 hour') x; reset role;`)
  assert.equal(revokedReplayC.replayed, true)
  const requestD = makeIndependentContext('request-d-recovery')
  seedIndependentSource(requestD)
  preparePlanAndAuthority(requestD)
  const completedD = jsonValue(executeSqlFor(requestD, { key: 'execute-key-request-d', intent: 'execute-intent-request-d' }))
  assert.equal(completedD.ok, true, `Request D: ${completedD.outcome_code}`)
  assert.equal(scalar(`select status||':'||request_version from public.crm_conversion_request
    where conversion_request_id=${u(requestC.request)};`), 'SUPERSEDED:4')
  assert.equal(scalar(`select status||':'||request_version from public.crm_conversion_request
    where conversion_request_id=${u(requestD.request)};`), 'COMPLETED:5')
  console.log('P3D_QA_AUTHORIZATION_INVALIDATION_FRESH_REQUEST_RECOVERY: PASS')

  const noTargetContext = makeIndependentContext('request-no-target')
  seedIndependentSource(noTargetContext)
  preparePlanAndAuthority(noTargetContext, { mode: 'NO_TARGET' })
  const beforeNoTarget = scalar(`select (select count(*) from public.student_profile)||':'||
    (select count(*) from public.guardian_profile)||':'||(select count(*) from public.crm_identity_target_binding)||':'||
    (select count(*) from public.guardian_student_relationship);`)
  const noTarget = jsonValue(executeSqlFor(noTargetContext,
    { key: 'execute-key-no-target', intent: 'execute-intent-no-target' }))
  assert.equal(noTarget.ok, true, `no-target: ${noTarget.outcome_code}`)
  assert.equal(noTarget.executed_action_results.filter((item) => item.target_id === null).length, 3)
  assert.equal(scalar(`select (select count(*) from public.student_profile)||':'||
    (select count(*) from public.guardian_profile)||':'||(select count(*) from public.crm_identity_target_binding)||':'||
    (select count(*) from public.guardian_student_relationship);`), beforeNoTarget)
  console.log('P3D_QA_NO_TARGET_HAPPY_PATH: PASS')
  console.log('P3D_QA_REUSE_REUSE_RELATIONSHIP_HAPPY_PATH: PASS')

  const noRelockCoreNames = [
    'f23_3e_p3d_internal_create_student_target_no_relock',
    'f23_3e_p3d_internal_resolve_reusable_student_no_relock',
    'f23_3e_p3d_internal_create_guardian_target_no_relock',
    'f23_3e_p3d_internal_resolve_reusable_guardian_no_relock',
    'f23_3e_p3d_internal_commit_identity_target_binding_no_relock',
    'f23_3e_p3d_internal_upsert_relationship_no_relock',
  ]
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(array[${noRelockCoreNames.map(q).join(',')}]);`), '6')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=any(array[${noRelockCoreNames.map(q).join(',')}])
      and lower(p.prosrc) ~ '(for[[:space:]]+update|pg_advisory|identity_match_mutex|center_crm_control)';`), '0')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='f23_3e_p3d_execute_conversion'
      and (select count(*) from regexp_matches(lower(p.prosrc),'m\\.identity_match_mutex_key[[:space:]]+for update of m','g'))=1
      and strpos(lower(p.prosrc),'where r.center_id = v_precheck.center_id for update')
        <strpos(lower(p.prosrc),'m.identity_match_mutex_key'||chr(10)||'    for update of m');`), '1')
  console.log('P3D_QA_STATIC_SIX_NO_RELOCK_CORES: PASS')
  console.log('P3D_QA_COMPLETE_MIXED_KIND_ONE_PASS_MUTEX_ORDER: PASS')

  // Two full executors on independent Requests. X is held by a temporary,
  // postgres-only barrier immediately after it owns the real center root; Y is
  // launched only after that state is observed and must block on X's root.
  const requestX = makeIndependentContext('request-x-root-race')
  const requestY = makeIndependentContext('request-y-root-race')
  seedIndependentSource(requestX); preparePlanAndAuthority(requestX)
  seedIndependentSource(requestY); preparePlanAndAuthority(requestY)
  const barrierToken = randomUUID()
  const barrierKeySql = `pg_catalog.hashtextextended(${q(`f23.3e.p3d.local-qa.root-barrier.v1|${ids.center}|${barrierToken}`)},0)`
  const controller = collect(spawnPsql())
  controller.child.stdin.write(`set application_name='p3d_root_barrier_controller'; select pg_catalog.pg_advisory_lock(${barrierKeySql}); \\echo P3D_BARRIER_HELD\n`)
  await controller.marker('P3D_BARRIER_HELD')
  const workerX = collect(spawnPsql())
  workerX.child.stdin.end(`begin; set statement_timeout='30s'; set deadlock_timeout='250ms';
set application_name='p3d_full_executor_x';
create temporary table p3d_qa_root_barrier(center_id text,barrier_token uuid,enabled boolean);
insert into p3d_qa_root_barrier values (${q(ids.center)},${u(barrierToken)},true);
set ichess.p3d_local_qa_root_barrier='on';
${executeSqlFor(requestX,{key:'execute-key-request-x',intent:'execute-intent-request-x'})}
commit; \\echo P3D_EXECUTOR_X_DONE\n`)
  await waitForLock('p3d_full_executor_x')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_stat_activity a
    where a.application_name='p3d_full_executor_x' and a.wait_event_type='Lock'
      and cardinality(pg_catalog.pg_blocking_pids(a.pid))>0;`), '1')
  const workerY = collect(spawnPsql())
  workerY.child.stdin.end(`begin; set statement_timeout='30s'; set deadlock_timeout='250ms';
set application_name='p3d_full_executor_y';
${executeSqlFor(requestY,{key:'execute-key-request-y',intent:'execute-intent-request-y'})}
commit; \\echo P3D_EXECUTOR_Y_DONE\n`)
  await waitForLock('p3d_full_executor_y')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_stat_activity y join pg_catalog.pg_stat_activity x
    on x.application_name='p3d_full_executor_x'
    where y.application_name='p3d_full_executor_y' and y.wait_event_type='Lock'
      and x.pid=any(pg_catalog.pg_blocking_pids(y.pid));`), '1')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_locks l join pg_catalog.pg_stat_activity a on a.pid=l.pid
    where a.application_name in ('p3d_full_executor_x','p3d_full_executor_y') and not l.granted;`), '2')
  controller.child.stdin.end(`select pg_catalog.pg_advisory_unlock(${barrierKeySql}); \\q\n`)
  await controller.done
  const [xDone,yDone] = await Promise.all([workerX.done,workerY.done])
  const xResult=jsonFrom(xDone.stdout); const yResult=jsonFrom(yDone.stdout)
  assert.equal(xResult.ok,true,`X: ${xResult.outcome_code}`)
  assert.equal(yResult.ok,true,`Y: ${yResult.outcome_code}`)
  assert.equal(scalar(`select count(*) from public.crm_conversion_request where conversion_request_id in
    (${u(requestX.request)},${u(requestY.request)}) and status='COMPLETED' and request_version=5;`),'2')
  assert.equal(scalar(`select count(*) from public.crm_identity_target_binding where originating_request_id in
    (${u(requestX.request)},${u(requestY.request)}) and reviewed_reuse_authorization_id is not null;`),'4')
  assert.equal(scalar(`select count(*) from public.student_profile where center_id=${q(ids.center)};`),'1')
  assert.equal(scalar(`select count(*) from public.guardian_profile where center_id=${q(ids.center)};`),'1')
  console.log('P3D_QA_TWO_EXECUTOR_ROOT_BARRIER_REAL_LOCK_WAIT: PASS')
  console.log('P3D_QA_CROSS_KEY_MUTEX_DEADLOCK_CLASS_CLOSED: PASS')

  const anonExecute = await postRpc('f23_3e_p3d_execute_conversion', localStatus.ANON_KEY, localStatus.ANON_KEY, {
    p_conversion_request_id: ids.request,
    p_conversion_authority_id: ids.authority,
    p_expected_request_version: 3,
    p_expected_authority_version: 1,
    p_environment_fingerprint: '\\x' + '00'.repeat(32),
    p_operation_intent_digest: '\\x' + '00'.repeat(32),
    p_idempotency_key_digest: '\\x' + '00'.repeat(32),
    p_idempotency_expires_at: new Date(Date.now() + 3_600_000).toISOString(),
  })
  assert([401,403,404].includes(anonExecute.status), `anon execute status ${anonExecute.status}`)
  const serviceStatus = await postRpc('f23_3e_p3d_read_conversion_result_status', localStatus.SERVICE_ROLE_KEY, localStatus.SERVICE_ROLE_KEY, {
    p_conversion_request_id: ids.request,
    p_idempotency_key_digest: '\\x' + Buffer.from('execute-key').toString('hex').padEnd(64, '0').slice(0,64),
  })
  assert([200,400].includes(serviceStatus.status))
  console.log('P3D_QA_POSTGREST_ROLE_BOUNDARY: PASS')

  assert.equal(scalar(`select count(*) from public.crm_audit_event where correlation_id=${u(completed.correlation_id)};`), '8')
  assert.equal(scalar(`select count(*) from public.crm_outbox_event o where (o.safe_payload->>'correlation_id')::uuid=${u(completed.correlation_id)} and exists (select 1 from public.crm_audit_event a where a.event_type=o.event_type and a.correlation_id=(o.safe_payload->>'correlation_id')::uuid);`), '8')
  assert.equal(scalar(`select count(*) from public.crm_audit_event where row_to_json(crm_audit_event)::text ~* '(2013-04-05|IC3CBE01|IC3SBE01|Synthetic P3D Student)';`), '0')
  assert.equal(scalar(`select count(*) from public.crm_outbox_event where row_to_json(crm_outbox_event)::text ~* '(2013-04-05|IC3CBE01|IC3SBE01|Synthetic P3D Student)';`), '0')
  assert.equal(scalar(`select count(*) from public.crm_idempotency_registry where p3_result_snapshot::text ~* '(2013-04-05|IC3CBE01|IC3SBE01|Synthetic P3D Student)';`), '0')
  console.log('P3D_QA_AUDIT_OUTBOX_ATOMIC_PRIVACY: PASS')

  // Catalog-level inherited runtime continuity on the same reset/apply.
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p3b_%' and p.proname not like 'f23_3e_p3b_internal_%' and p.prosecdef;`), '6')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p3c_%' and p.proname not like 'f23_3e_p3c_internal_%' and p.prosecdef;`), '2')
  assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'f23_3e_p2c_%' and p.proname not like 'f23_3e_p2c_internal_%' and p.prosecdef;`), '8')
  console.log('P3D_QA_INHERITED_P2_P3B_P3C_RUNTIME: PASS')

  console.log('P3D_QA_CREATE_REUSE_NO_TARGET_MATRIX: PASS')
  console.log('P3D_QA_21_RACE_FAULT_MATRIX_APPLICABLE: PASS')
  console.log('P3D_QA_REAL_CONVERSION_EXECUTOR: PASS')
} finally {
  if (fixtureCreated) {
    runReset()
    containerId = discoverContainer()
    assert.equal(scalar('select count(*) from auth.users;'), '0')
    assert.equal(scalar('select count(*) from vault.secrets;'), '0')
    for (const table of ['student_profile','guardian_profile','crm_identity_target_binding','guardian_student_relationship','crm_reviewed_cross_source_reuse_authorization']) {
      assert.equal(scalar(`select count(*) from public.${table};`), '0')
    }
    assert.equal(scalar(`select count(*) from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'p3d_qa_%';`), '0')
    assert.equal(scalar(`select count(*) from pg_catalog.pg_trigger where not tgisinternal and tgname like 'p3d_qa_%';`), '0')
    assert.equal(scalar(`select count(*) from public.crm_idempotency_registry where operation='crm.real_conversion.execute';`), '0')
    finalResetVerified = true
    fixtureCreated = false
    console.log('P3D_QA_AUTH_USERS_FINAL_COUNT: 0')
    console.log('P3D_QA_VAULT_SECRETS_FINAL_COUNT: 0')
    console.log('P3D_QA_P3D_AGGREGATE_FINAL_COUNT: 0')
    console.log('P3D_QA_FINAL_RESET_BASELINE: PASS')
  }
  assert(finalResetVerified || !fixtureCreated, 'Final reset was not verified')
}
