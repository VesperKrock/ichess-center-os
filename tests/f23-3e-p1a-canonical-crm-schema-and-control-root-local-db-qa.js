import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainerName = `supabase_db_${projectSlug}`
const expectedTables = [
  'center_crm_control',
  'crm_contact',
  'consultation_case',
  'consultation_case_candidate_student',
  'consultation_case_assignment',
  'crm_care_log',
  'crm_conversion_request',
  'crm_idempotency_registry',
  'crm_audit_event',
  'crm_outbox_event',
]

const fail = (message) => {
  throw new Error(message)
}

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  })
  if (result.error) throw result.error
  return result
}

const requireSuccess = (result, label) => {
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(`${label} failed with exit ${result.status}${detail ? `:\n${detail}` : ''}`)
  }
  return result.stdout
}

const assertLocalLocator = (value, label) => {
  if (!value) return
  let host = value
  try {
    host = new URL(value).hostname
  } catch {
    host = value.split(':')[0]
  }
  assert(
    new Set(['127.0.0.1', 'localhost', '::1']).has(host.toLowerCase()),
    `${label} must be local; received host ${host}`,
  )
}

assertLocalLocator(process.env.PGHOST, 'PGHOST')
for (const name of ['DATABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_URL']) {
  assertLocalLocator(process.env[name], name)
}
assert(!process.env.SUPABASE_PROJECT_REF, 'A project ref is not accepted by this local-only runner')
const linkedFlag = ['--', 'linked'].join('')
assert(!process.argv.slice(2).includes(linkedFlag), 'Linked-project mode is forbidden')
assert.equal(process.argv.length, 2, 'This runner accepts no project, URL, credential, or mode arguments')

const statusCommand = process.platform === 'win32' ? process.env.ComSpec : 'npx'
const statusArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npx --no-install supabase status -o json']
  : ['--no-install', 'supabase', 'status', '-o', 'json']
assert(statusCommand, 'Could not resolve the local command interpreter')
const localStatusResult = run(statusCommand, statusArgs)
assert.equal(localStatusResult.status, 0, 'Local Supabase status failed; no fallback is permitted')
let localStatus
try {
  localStatus = JSON.parse(localStatusResult.stdout)
} catch {
  fail('Local Supabase status did not return valid JSON')
}
assert.equal(typeof localStatus.DB_URL, 'string', 'Local Supabase status omitted its database locator')
const databaseHost = new URL(localStatus.DB_URL).hostname
assertLocalLocator(databaseHost, 'Local Supabase database host')

const ps = requireSuccess(
  run('docker', [
    'ps',
    '--filter',
    `label=com.supabase.cli.project=${projectSlug}`,
    '--filter',
    'status=running',
    '--format',
    '{{.ID}}|{{.Names}}|{{.Image}}',
  ]),
  'Local Docker discovery',
)
const databaseContainers = ps
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.split('|'))
  .filter(([, name]) => name === expectedContainerName)

assert.equal(databaseContainers.length, 1, `Expected exactly one running ${expectedContainerName} container`)
const [containerId, containerName, containerImage] = databaseContainers[0]
assert.equal(containerName, expectedContainerName)
assert(/supabase\/postgres/i.test(containerImage), `Unexpected local database image: ${containerImage}`)

const inspectOutput = requireSuccess(
  run('docker', ['inspect', containerId, '--format', '{{json .Config.Labels}}|{{.State.Running}}|{{.Name}}']),
  'Local Docker inspection',
).trim()
const inspectMatch = inspectOutput.match(/^(\{.*\})\|(true|false)\|(.*)$/)
assert(inspectMatch, 'Could not parse local database container inspection')
const labels = JSON.parse(inspectMatch[1])
assert.equal(inspectMatch[2], 'true', 'Local database container is not running')
assert.equal(inspectMatch[3], `/${expectedContainerName}`, 'Database container name drift')
assert.equal(labels['com.supabase.cli.project'], projectSlug, 'Supabase project label drift')
assert.equal(labels['com.docker.compose.project'], projectSlug, 'Docker Compose project label drift')
console.log('P1A_QA_LOCAL_SAFETY_GUARD: PASS')

const psql = (sql, { expectFailure = false } = {}) => {
  const result = run(
    'docker',
    [
      'exec',
      '-i',
      containerId,
      'psql',
      '-X',
      '--no-psqlrc',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
      '-A',
      '-t',
    ],
    { input: sql },
  )
  if (!expectFailure) requireSuccess(result, 'Local container psql')
  return result
}

const tableValues = expectedTables.map((name) => `('${name}')`).join(',\n      ')
const catalogSql = String.raw`
do $qa$
declare
  v_expected_count integer;
  v_actual_count integer;
begin
  select pg_catalog.count(*) into v_expected_count
  from (values
      ${tableValues}
  ) expected(table_name);

  select pg_catalog.count(*) into v_actual_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname in (${expectedTables.map((name) => `'${name}'`).join(', ')});

  if v_expected_count <> 10 or v_actual_count <> v_expected_count then
    raise exception 'qa_schema_inventory_expected_10_actual_%', v_actual_count;
  end if;

  if not exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '202607310001'
      and name = 'f23_3e_p1a_canonical_crm_schema_and_control_root'
  ) then
    raise exception 'qa_local_migration_history_missing_p1a';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (${expectedTables.map((name) => `'${name}'`).join(', ')})
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ) then
    raise exception 'qa_rls_not_enabled_and_forced_on_every_p1a_table';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policy p
    join pg_catalog.pg_class c on c.oid = p.polrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (${expectedTables.map((name) => `'${name}'`).join(', ')})
  ) then
    raise exception 'qa_p1a_browser_policy_count_is_not_zero';
  end if;

  if exists (
    select 1
    from (values ('anon'), ('authenticated')) roles(role_name)
    cross join (values ${tableValues}) tables(table_name)
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) privileges(privilege_name)
    where pg_catalog.has_table_privilege(
      roles.role_name,
      pg_catalog.format('public.%I', tables.table_name),
      privileges.privilege_name
    )
  ) or exists (
    select 1
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))
    ) acl
    where n.nspname = 'public'
      and c.relname in (${expectedTables.map((name) => `'${name}'`).join(', ')})
      and acl.grantee = 0
      and acl.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  ) then
    raise exception 'qa_browser_table_crud_privilege_detected';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join (values ('anon'), ('authenticated')) roles(role_name)
    where n.nspname = 'public'
      and p.proname like 'f23_3e_p1a_%'
      and pg_catalog.has_function_privilege(roles.role_name, p.oid, 'EXECUTE')
  ) or exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where n.nspname = 'public'
      and p.proname like 'f23_3e_p1a_%'
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ) then
    raise exception 'qa_browser_function_execute_privilege_detected';
  end if;

  if not pg_catalog.has_function_privilege(
    'service_role',
    'public.f23_3e_p1a_is_safe_outbox_payload(jsonb)',
    'EXECUTE'
  ) then
    raise exception 'qa_service_role_outbox_validator_execute_missing';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like 'f23_3e_p1a_%'
      and p.proname <> 'f23_3e_p1a_is_safe_outbox_payload'
      and pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE')
  ) then
    raise exception 'qa_service_role_received_trigger_function_execute';
  end if;

  if (select pg_catalog.count(*) from public.centers)
     <> (select pg_catalog.count(*) from public.center_crm_control)
     or exists (
       select 1
       from public.centers c
       left join public.center_crm_control r on r.center_id = c.id
       group by c.id
       having pg_catalog.count(r.center_id) <> 1
     ) then
    raise exception 'qa_existing_center_root_backfill_not_exactly_one';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'crm_audit_event'
      and column_name in ('payload', 'before_state', 'after_state', 'phone', 'email', 'birth')
  ) then
    raise exception 'qa_audit_has_raw_or_arbitrary_payload_column';
  end if;
end
$qa$;
\echo P1A_QA_DYNAMIC_SCHEMA_INVENTORY: PASS
\echo P1A_QA_LOCAL_MIGRATION_HISTORY: PASS
\echo P1A_QA_EXISTING_CENTER_ROOT_BACKFILL: PASS
\echo P1A_QA_RLS_ENABLED_AND_FORCED: PASS
\echo P1A_QA_ZERO_BROWSER_POLICIES: PASS
\echo P1A_QA_AUDIT_HAS_NO_RAW_PAYLOAD_COLUMN: PASS
`
process.stdout.write(psql(catalogSql).stdout)

const denied = psql('set role authenticated; select pg_catalog.count(*) from public.center_crm_control;\n', {
  expectFailure: true,
})
assert.notEqual(denied.status, 0, 'authenticated direct table query unexpectedly succeeded')
assert.match(
  `${denied.stdout}\n${denied.stderr}`,
  /permission denied for table center_crm_control/i,
  'authenticated query failed for an unexpected reason',
)
console.log('P1A_QA_BROWSER_DIRECT_ACCESS_DENIED: PASS')

const ids = Object.fromEntries(
  [
    'centerA', 'centerB', 'userA', 'userB', 'contactA', 'contactB',
    'caseA', 'caseB', 'caseTerminal', 'candidateA', 'assignmentA1',
    'assignmentA2', 'assignmentB', 'careA', 'careCorrection', 'requestA',
    'idempotencyA', 'auditA', 'outboxA', 'outboxB', 'claimA', 'claimB',
  ].map((name) => [name, randomUUID()]),
)
for (const [name, value] of Object.entries(ids)) {
  assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/, `${name} is not opaque UUIDv4`)
}

const q = (value) => `'${value}'`
const businessSql = String.raw`
begin;
set local client_min_messages = warning;

create function pg_temp.qa_assert(p_condition boolean, p_label text)
returns void language plpgsql set search_path = '' as $qa$
begin
  if p_condition is not true then
    raise exception 'qa_assertion_failed: %', p_label;
  end if;
end
$qa$;

create function pg_temp.qa_expect_failure(p_sql text, p_states text[], p_label text)
returns void language plpgsql set search_path = '' as $qa$
declare
  v_state text;
  v_message text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    if v_state = any(p_states) then
      return;
    end if;
    raise exception 'qa_unexpected_failure: %, SQLSTATE %, message %', p_label, v_state, v_message;
  end;
  raise exception 'qa_expected_database_rejection_missing: %', p_label;
end
$qa$;

insert into auth.users (id, aud, role, created_at, updated_at) values
  (${q(ids.userA)}::uuid, 'authenticated', 'authenticated', pg_catalog.transaction_timestamp(), pg_catalog.transaction_timestamp()),
  (${q(ids.userB)}::uuid, 'authenticated', 'authenticated', pg_catalog.transaction_timestamp(), pg_catalog.transaction_timestamp());

insert into public.centers (id, name) values
  (${q(ids.centerA)}, 'qa_center_a'),
  (${q(ids.centerB)}, 'qa_center_b');

select pg_temp.qa_assert(
  (select pg_catalog.count(*) = 2 from public.center_crm_control where center_id in (${q(ids.centerA)}, ${q(ids.centerB)})),
  'future centers did not provision exactly one root each'
);
select pg_temp.qa_assert(
  (select pg_catalog.bool_and(crm_state = 'PLANNED' and feature_flag_state = 'DISABLED' and control_version = 1)
   from public.center_crm_control where center_id in (${q(ids.centerA)}, ${q(ids.centerB)})),
  'root defaults are not PLANNED/DISABLED/version one'
);
select pg_temp.qa_expect_failure(
  $sql$insert into public.center_crm_control (center_id) values ('${ids.centerA}')$sql$,
  array['23505'],
  'duplicate center root'
);
\echo P1A_QA_FUTURE_CENTER_ROOT_PROVISIONING: PASS
\echo P1A_QA_ROOT_DEFAULT_DISABLED: PASS

select pg_temp.qa_expect_failure(
  $sql$insert into public.crm_contact (
    crm_contact_id, center_id, contact_status, source_category,
    protected_contact_methods_ciphertext, contact_methods_crypto_version,
    normalized_lookup_digests, normalization_version, created_by_user_id
  ) values (
    '${randomUUID()}', ${q(ids.centerA)}, 'CONTACTED', 'qa_source',
    decode('01', 'hex'), 1, array[decode(repeat('11', 32), 'hex')], 1, '${ids.userA}'
  )$sql$,
  array['P0001'],
  'contact non-NEW insert'
);

insert into public.crm_contact (
  crm_contact_id, center_id, source_category, protected_contact_methods_ciphertext,
  contact_methods_crypto_version, normalized_lookup_digests, normalization_version, created_by_user_id
) values
  (${q(ids.contactA)}::uuid, ${q(ids.centerA)}, 'qa_source', decode('01', 'hex'), 1, array[decode(repeat('11', 32), 'hex')], 1, ${q(ids.userA)}::uuid),
  (${q(ids.contactB)}::uuid, ${q(ids.centerB)}, 'qa_source', decode('02', 'hex'), 1, array[decode(repeat('22', 32), 'hex')], 1, ${q(ids.userB)}::uuid);

select pg_temp.qa_expect_failure(
  $sql$insert into public.consultation_case (
    consultation_case_id, center_id, primary_contact_id, created_by_user_id
  ) values ('${randomUUID()}', ${q(ids.centerB)}, '${ids.contactA}', '${ids.userB}')$sql$,
  array['23503'],
  'Case B with Contact A'
);

insert into public.consultation_case (
  consultation_case_id, center_id, primary_contact_id, created_by_user_id
) values
  (${q(ids.caseA)}::uuid, ${q(ids.centerA)}, ${q(ids.contactA)}::uuid, ${q(ids.userA)}::uuid),
  (${q(ids.caseB)}::uuid, ${q(ids.centerB)}, ${q(ids.contactB)}::uuid, ${q(ids.userB)}::uuid),
  (${q(ids.caseTerminal)}::uuid, ${q(ids.centerA)}, ${q(ids.contactA)}::uuid, ${q(ids.userA)}::uuid);
-- Resolve the valid no-assignment Case state before exercising a later atomic assign.
set constraints all immediate;
set constraints all deferred;

select pg_temp.qa_expect_failure(
  $sql$insert into public.consultation_case_candidate_student (
    candidate_student_id, center_id, consultation_case_id, display_name_evidence
  ) values ('${randomUUID()}', ${q(ids.centerB)}, '${ids.caseA}', 'qa_candidate')$sql$,
  array['23503'],
  'Candidate B with Case A'
);
insert into public.consultation_case_candidate_student (
  candidate_student_id, center_id, consultation_case_id, display_name_evidence
) values (${q(ids.candidateA)}::uuid, ${q(ids.centerA)}, ${q(ids.caseA)}::uuid, 'qa_candidate');

select pg_temp.qa_expect_failure(
  $sql$insert into public.consultation_case_assignment (
    assignment_id, center_id, consultation_case_id, assigned_consultant_user_id, assigned_by_user_id
  ) values ('${randomUUID()}', ${q(ids.centerB)}, '${ids.caseA}', '${ids.userB}', '${ids.userB}')$sql$,
  array['23503'],
  'Assignment B with Case A'
);

do $qa$
declare v_rejected boolean := false;
begin
  begin
    insert into public.consultation_case_assignment (
      assignment_id, center_id, consultation_case_id, assigned_consultant_user_id, assigned_by_user_id
    ) values (${q(ids.assignmentA1)}::uuid, ${q(ids.centerA)}, ${q(ids.caseA)}::uuid, ${q(ids.userA)}::uuid, ${q(ids.userA)}::uuid);
    set constraints all immediate;
  exception when raise_exception then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'qa_active_assignment_without_pointer_was_accepted'; end if;
  set constraints all deferred;
end
$qa$;

insert into public.consultation_case_assignment (
  assignment_id, center_id, consultation_case_id, assigned_consultant_user_id, assigned_by_user_id
) values (${q(ids.assignmentA1)}::uuid, ${q(ids.centerA)}, ${q(ids.caseA)}::uuid, ${q(ids.userA)}::uuid, ${q(ids.userA)}::uuid);
update public.consultation_case
set active_assignment_id = ${q(ids.assignmentA1)}::uuid, case_version = case_version + 1
where consultation_case_id = ${q(ids.caseA)}::uuid;
set constraints all immediate;
set constraints all deferred;

select pg_temp.qa_expect_failure(
  $sql$insert into public.consultation_case_assignment (
    assignment_id, center_id, consultation_case_id, assigned_consultant_user_id, assigned_by_user_id
  ) values ('${ids.assignmentA2}', ${q(ids.centerA)}, '${ids.caseA}', '${ids.userB}', '${ids.userA}')$sql$,
  array['23505'],
  'second active assignment'
);

insert into public.consultation_case_assignment (
  assignment_id, center_id, consultation_case_id, assigned_consultant_user_id, assigned_by_user_id
) values (${q(ids.assignmentB)}::uuid, ${q(ids.centerB)}, ${q(ids.caseB)}::uuid, ${q(ids.userB)}::uuid, ${q(ids.userB)}::uuid);
update public.consultation_case
set active_assignment_id = ${q(ids.assignmentB)}::uuid, case_version = case_version + 1
where consultation_case_id = ${q(ids.caseB)}::uuid;
set constraints all immediate;
set constraints all deferred;

do $qa$
declare v_rejected boolean := false;
begin
  begin
    update public.consultation_case
    set active_assignment_id = ${q(ids.assignmentB)}::uuid, case_version = case_version + 1
    where consultation_case_id = ${q(ids.caseA)}::uuid;
    set constraints all immediate;
  exception when foreign_key_violation or raise_exception then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'qa_cross_case_assignment_pointer_was_accepted'; end if;
  set constraints all deferred;
end
$qa$;

update public.consultation_case_assignment
set assignment_status = 'SUPERSEDED', assignment_version = assignment_version + 1,
    ended_at = pg_catalog.transaction_timestamp(), end_reason = 'qa_reassigned'
where assignment_id = ${q(ids.assignmentA1)}::uuid;
insert into public.consultation_case_assignment (
  assignment_id, center_id, consultation_case_id, assigned_consultant_user_id, assigned_by_user_id
) values (${q(ids.assignmentA2)}::uuid, ${q(ids.centerA)}, ${q(ids.caseA)}::uuid, ${q(ids.userB)}::uuid, ${q(ids.userA)}::uuid);
update public.consultation_case
set active_assignment_id = ${q(ids.assignmentA2)}::uuid, case_version = case_version + 1
where consultation_case_id = ${q(ids.caseA)}::uuid;
set constraints all immediate;
set constraints all deferred;
select pg_temp.qa_assert(
  (select assignment_status = 'SUPERSEDED' and assignment_version = 2 from public.consultation_case_assignment where assignment_id = ${q(ids.assignmentA1)}::uuid)
  and (select assignment_status = 'ACTIVE' from public.consultation_case_assignment where assignment_id = ${q(ids.assignmentA2)}::uuid)
  and (select active_assignment_id = ${q(ids.assignmentA2)}::uuid from public.consultation_case where consultation_case_id = ${q(ids.caseA)}::uuid),
  'atomic reassignment did not preserve history/pointer'
);
select pg_temp.qa_expect_failure(
  $sql$update public.consultation_case_assignment
        set assignment_status = 'ACTIVE', assignment_version = assignment_version + 1,
            ended_at = null, end_reason = null
        where assignment_id = '${ids.assignmentA1}'$sql$,
  array['P0001'],
  'terminal assignment reopen'
);
select pg_temp.qa_expect_failure(
  $sql$delete from public.consultation_case_assignment where assignment_id = '${ids.assignmentA1}'$sql$,
  array['P0001'],
  'assignment history delete'
);
\echo P1A_QA_ONE_ACTIVE_ASSIGNMENT: PASS
\echo P1A_QA_DEFERRED_CASE_ASSIGNMENT_POINTER: PASS
\echo P1A_QA_ASSIGNMENT_HISTORY_IMMUTABLE: PASS

select pg_temp.qa_expect_failure(
  $sql$update public.center_crm_control set crm_state = 'MIGRATING' where center_id = ${q(ids.centerA)}$sql$,
  array['P0001'], 'control version unchanged'
);
select pg_temp.qa_expect_failure(
  $sql$update public.center_crm_control set crm_state = 'MIGRATING', control_version = control_version + 2 where center_id = ${q(ids.centerA)}$sql$,
  array['P0001'], 'control version skipped'
);
update public.center_crm_control
set crm_state = 'MIGRATING', control_version = control_version + 1,
    updated_at = pg_catalog.transaction_timestamp() - interval '100 years'
where center_id = ${q(ids.centerA)};
select pg_temp.qa_assert(
  (select control_version = 2 and updated_at = pg_catalog.transaction_timestamp() from public.center_crm_control where center_id = ${q(ids.centerA)}),
  'control +1 version or database timestamp stamp'
);

select pg_temp.qa_expect_failure(
  $sql$update public.crm_contact set initial_interest = 'qa' where crm_contact_id = '${ids.contactA}'$sql$,
  array['P0001'], 'contact version unchanged'
);
select pg_temp.qa_expect_failure(
  $sql$update public.crm_contact set initial_interest = 'qa', contact_version = contact_version + 2 where crm_contact_id = '${ids.contactA}'$sql$,
  array['P0001'], 'contact version skipped'
);
update public.crm_contact
set contact_status = 'CONTACTED', contact_version = contact_version + 1,
    updated_at = pg_catalog.transaction_timestamp() - interval '100 years'
where crm_contact_id = ${q(ids.contactA)}::uuid;
select pg_temp.qa_assert(
  (select contact_version = 2 and updated_at = pg_catalog.transaction_timestamp() from public.crm_contact where crm_contact_id = ${q(ids.contactA)}::uuid),
  'contact valid transition/version/timestamp'
);
update public.crm_contact
set contact_status = 'ARCHIVED', archived_at = pg_catalog.transaction_timestamp(), contact_version = contact_version + 1
where crm_contact_id = ${q(ids.contactA)}::uuid;
select pg_temp.qa_expect_failure(
  $sql$update public.crm_contact
        set contact_status = 'CONTACTED', archived_at = null, contact_version = contact_version + 1
        where crm_contact_id = '${ids.contactA}'$sql$,
  array['P0001'], 'archived Contact restore'
);
\echo P1A_QA_CONTACT_LIFECYCLE: PASS

select pg_temp.qa_expect_failure(
  $sql$insert into public.consultation_case (
    consultation_case_id, center_id, primary_contact_id, status, created_by_user_id
  ) values ('${randomUUID()}', ${q(ids.centerA)}, '${ids.contactA}', 'CONSULTING', '${ids.userA}')$sql$,
  array['P0001'], 'Case non-OPEN insert'
);
select pg_temp.qa_expect_failure(
  $sql$update public.consultation_case set safe_case_summary = 'qa' where consultation_case_id = '${ids.caseA}'$sql$,
  array['P0001'], 'Case version unchanged'
);
select pg_temp.qa_expect_failure(
  $sql$update public.consultation_case set safe_case_summary = 'qa', case_version = case_version + 2 where consultation_case_id = '${ids.caseA}'$sql$,
  array['P0001'], 'Case version skipped'
);
update public.consultation_case
set status = 'CONSULTING', case_version = case_version + 1,
    updated_at = pg_catalog.transaction_timestamp() - interval '100 years'
where consultation_case_id = ${q(ids.caseA)}::uuid;
select pg_temp.qa_assert(
  (select case_version = 4 and updated_at = pg_catalog.transaction_timestamp() from public.consultation_case where consultation_case_id = ${q(ids.caseA)}::uuid),
  'Case valid transition/version/timestamp'
);
select pg_temp.qa_expect_failure(
  $sql$update public.consultation_case
        set status = 'CONVERTED', conversion_state = 'COMPLETED', closed_at = pg_catalog.transaction_timestamp(), case_version = case_version + 1
        where consultation_case_id = '${ids.caseA}'$sql$,
  array['P0001'], 'Case direct CONVERTED transition'
);
update public.consultation_case
set status = 'LOST', closed_at = pg_catalog.transaction_timestamp(), case_version = case_version + 1
where consultation_case_id = ${q(ids.caseTerminal)}::uuid;
select pg_temp.qa_expect_failure(
  $sql$update public.consultation_case
        set status = 'OPEN', closed_at = null, case_version = case_version + 1
        where consultation_case_id = '${ids.caseTerminal}'$sql$,
  array['P0001'], 'terminal Case reopen'
);
update public.consultation_case_candidate_student
set candidate_status = 'ACTIVE', candidate_version = candidate_version + 1
where candidate_student_id = ${q(ids.candidateA)}::uuid;
select pg_temp.qa_expect_failure(
  $sql$update public.consultation_case_candidate_student
        set candidate_status = 'CONVERTED', candidate_version = candidate_version + 1
        where candidate_student_id = '${ids.candidateA}'$sql$,
  array['P0001'], 'candidate direct CONVERTED transition'
);
\echo P1A_QA_CASE_CANDIDATE_LIFECYCLE: PASS

select pg_temp.qa_expect_failure(
  $sql$update public.consultation_case_assignment
        set assignment_status = 'ENDED', ended_at = pg_catalog.transaction_timestamp(), end_reason = 'qa_end'
        where assignment_id = '${ids.assignmentA2}'$sql$,
  array['P0001'], 'assignment version unchanged'
);
select pg_temp.qa_expect_failure(
  $sql$update public.consultation_case_assignment
        set assignment_status = 'ENDED', assignment_version = assignment_version + 2,
            ended_at = pg_catalog.transaction_timestamp(), end_reason = 'qa_end'
        where assignment_id = '${ids.assignmentA2}'$sql$,
  array['P0001'], 'assignment version skipped'
);

select pg_temp.qa_expect_failure(
  $sql$insert into public.crm_care_log (
    care_log_id, center_id, consultation_case_id, author_user_id, entry_type, safe_content
  ) values ('${randomUUID()}', ${q(ids.centerB)}, '${ids.caseA}', '${ids.userB}', 'NOTE', 'qa_safe_note')$sql$,
  array['23503'], 'Care Log B with Case A'
);
insert into public.crm_care_log (
  care_log_id, center_id, consultation_case_id, author_user_id, entry_type, safe_content
) values (${q(ids.careA)}::uuid, ${q(ids.centerA)}, ${q(ids.caseA)}::uuid, ${q(ids.userA)}::uuid, 'NOTE', 'qa_safe_note');
select pg_temp.qa_expect_failure(
  $sql$update public.crm_care_log set safe_content = 'qa_rewrite' where care_log_id = '${ids.careA}'$sql$,
  array['P0001'], 'Care Log update'
);
select pg_temp.qa_expect_failure(
  $sql$delete from public.crm_care_log where care_log_id = '${ids.careA}'$sql$,
  array['P0001'], 'Care Log delete'
);
insert into public.crm_care_log (
  care_log_id, center_id, consultation_case_id, author_user_id, entry_type, safe_content, correction_of_care_log_id
) values (${q(ids.careCorrection)}::uuid, ${q(ids.centerA)}, ${q(ids.caseA)}::uuid, ${q(ids.userA)}::uuid, 'CORRECTION', 'qa_safe_correction', ${q(ids.careA)}::uuid);
select pg_temp.qa_expect_failure(
  $sql$insert into public.crm_care_log (
    care_log_id, center_id, consultation_case_id, author_user_id, entry_type, safe_content, correction_of_care_log_id
  ) values ('${randomUUID()}', ${q(ids.centerA)}, '${ids.caseTerminal}', '${ids.userA}', 'CORRECTION', 'qa_safe_correction', '${ids.careA}')$sql$,
  array['23503'], 'Care Log cross-Case correction'
);
select pg_temp.qa_expect_failure(
  $sql$insert into public.crm_care_log (
    care_log_id, center_id, consultation_case_id, author_user_id, entry_type, safe_content, correction_of_care_log_id
  ) values ('${randomUUID()}', ${q(ids.centerB)}, '${ids.caseB}', '${ids.userB}', 'CORRECTION', 'qa_safe_correction', '${ids.careA}')$sql$,
  array['23503'], 'Care Log cross-center correction'
);
\echo P1A_QA_CARE_LOG_APPEND_ONLY: PASS

insert into public.crm_idempotency_registry (
  idempotency_record_id, environment_fingerprint, center_id, resource_scope_kind,
  resource_scope_id, consultation_case_id, operation, idempotency_key_digest,
  intent_digest, action_graph_digest, request_id, expires_at
) values (
  ${q(ids.idempotencyA)}::uuid, decode(repeat('31', 32), 'hex'), ${q(ids.centerA)}, 'consultation_case',
  ${q(ids.caseA)}::uuid, ${q(ids.caseA)}::uuid, 'convert_case', decode(repeat('32', 32), 'hex'),
  decode(repeat('33', 32), 'hex'), decode(repeat('34', 32), 'hex'), ${q(ids.requestA)}::uuid,
  pg_catalog.transaction_timestamp() + interval '1 hour'
);
insert into public.crm_conversion_request (
  conversion_request_id, center_id, consultation_case_id, source_contact_id,
  source_case_version, source_contact_version, source_assignment_version,
  identity_policy_version, conversion_policy_version, relationship_policy_version,
  student_profile_policy_version, action_graph_digest, idempotency_scope,
  idempotency_key_reference, intent_digest, requested_by_user_id
) values (
  ${q(ids.requestA)}::uuid, ${q(ids.centerA)}, ${q(ids.caseA)}::uuid, ${q(ids.contactA)}::uuid,
  4, 3, 1, 1, 1, 1, 1, decode(repeat('34', 32), 'hex'), 'qa_scope',
  ${q(ids.idempotencyA)}::uuid, decode(repeat('33', 32), 'hex'), ${q(ids.userA)}::uuid
);
set constraints all immediate;
set constraints all deferred;

do $qa$
declare
  v_idempotency uuid := ${q(randomUUID())}::uuid;
  v_request uuid := ${q(randomUUID())}::uuid;
  v_rejected boolean := false;
begin
  begin
    insert into public.crm_idempotency_registry (
      idempotency_record_id, environment_fingerprint, center_id, resource_scope_kind,
      resource_scope_id, consultation_case_id, operation, idempotency_key_digest,
      intent_digest, action_graph_digest, request_id, expires_at
    ) values (
      v_idempotency, decode(repeat('41', 32), 'hex'), ${q(ids.centerA)}, 'consultation_case',
      ${q(ids.caseA)}::uuid, ${q(ids.caseA)}::uuid, 'convert_case', decode(repeat('42', 32), 'hex'),
      decode(repeat('43', 32), 'hex'), decode(repeat('44', 32), 'hex'), v_request,
      pg_catalog.transaction_timestamp() + interval '1 hour'
    );
    insert into public.crm_conversion_request (
      conversion_request_id, center_id, consultation_case_id, source_contact_id,
      source_case_version, source_contact_version, source_assignment_version,
      identity_policy_version, conversion_policy_version, relationship_policy_version,
      student_profile_policy_version, action_graph_digest, idempotency_scope,
      idempotency_key_reference, intent_digest, requested_by_user_id
    ) values (
      v_request, ${q(ids.centerA)}, ${q(ids.caseA)}::uuid, ${q(ids.contactA)}::uuid,
      4, 3, 1, 1, 1, 1, 1, decode(repeat('44', 32), 'hex'), 'qa_scope_second',
      v_idempotency, decode(repeat('43', 32), 'hex'), ${q(ids.userA)}::uuid
    );
  exception when unique_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'qa_second_active_request_was_accepted'; end if;
end
$qa$;
\echo P1A_QA_ONE_ACTIVE_REQUEST: PASS

select pg_temp.qa_expect_failure(
  $sql$insert into public.crm_idempotency_registry (
    idempotency_record_id, environment_fingerprint, center_id, resource_scope_kind,
    resource_scope_id, consultation_case_id, operation, idempotency_key_digest,
    intent_digest, expires_at
  ) values (
    '${randomUUID()}', decode(repeat('31', 32), 'hex'), ${q(ids.centerA)}, 'consultation_case',
    '${ids.caseA}', '${ids.caseA}', 'convert_case', decode(repeat('32', 32), 'hex'),
    decode(repeat('35', 32), 'hex'), pg_catalog.transaction_timestamp() + interval '1 hour'
  )$sql$,
  array['23505'], 'duplicate scoped idempotency tuple'
);
insert into public.crm_idempotency_registry (
  idempotency_record_id, environment_fingerprint, center_id, resource_scope_kind,
  resource_scope_id, consultation_case_id, operation, idempotency_key_digest,
  intent_digest, expires_at
) values
  (${q(randomUUID())}::uuid, decode(repeat('31', 32), 'hex'), ${q(ids.centerA)}, 'consultation_case', ${q(ids.caseA)}::uuid, ${q(ids.caseA)}::uuid, 'review_case', decode(repeat('32', 32), 'hex'), decode(repeat('36', 32), 'hex'), pg_catalog.transaction_timestamp() + interval '1 hour'),
  (${q(randomUUID())}::uuid, decode(repeat('31', 32), 'hex'), ${q(ids.centerA)}, 'consultation_case', ${q(ids.caseTerminal)}::uuid, ${q(ids.caseTerminal)}::uuid, 'convert_case', decode(repeat('32', 32), 'hex'), decode(repeat('37', 32), 'hex'), pg_catalog.transaction_timestamp() + interval '1 hour');
\echo P1A_QA_SCOPED_IDEMPOTENCY_UNIQUENESS: PASS

do $qa$
declare v_rejected boolean := false;
begin
  begin
    insert into public.crm_idempotency_registry (
      idempotency_record_id, environment_fingerprint, center_id, resource_scope_kind,
      resource_scope_id, consultation_case_id, operation, idempotency_key_digest,
      intent_digest, request_id, expires_at
    ) values (
      ${q(randomUUID())}::uuid, decode(repeat('51', 32), 'hex'), ${q(ids.centerB)}, 'consultation_case',
      ${q(ids.caseB)}::uuid, ${q(ids.caseB)}::uuid, 'bind_request', decode(repeat('52', 32), 'hex'),
      decode(repeat('53', 32), 'hex'), ${q(ids.requestA)}::uuid, pg_catalog.transaction_timestamp() + interval '1 hour'
    );
    set constraints all immediate;
  exception when foreign_key_violation then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'qa_cross_center_request_registry_binding_was_accepted'; end if;
  set constraints all deferred;
end
$qa$;
select pg_temp.qa_expect_failure(
  $sql$update public.crm_idempotency_registry
        set operation = 'rewritten_operation', idempotency_version = idempotency_version + 1
        where idempotency_record_id = '${ids.idempotencyA}'$sql$,
  array['P0001'], 'idempotency scope rewrite'
);
select pg_temp.qa_expect_failure(
  $sql$update public.crm_idempotency_registry
        set request_id = null, idempotency_version = idempotency_version + 1
        where idempotency_record_id = '${ids.idempotencyA}'$sql$,
  array['P0001'], 'idempotency request binding rewrite'
);
\echo P1A_QA_REQUEST_IDEMPOTENCY_BINDING: PASS

select pg_temp.qa_expect_failure(
  $sql$insert into public.crm_idempotency_registry (
    idempotency_record_id, environment_fingerprint, center_id, resource_scope_kind,
    resource_scope_id, consultation_case_id, operation, idempotency_key_digest,
    intent_digest, expires_at
  ) values (
    '${randomUUID()}', decode(repeat('61', 32), 'hex'), ${q(ids.centerB)}, 'consultation_case',
    '${ids.caseA}', '${ids.caseA}', 'cross_center', decode(repeat('62', 32), 'hex'),
    decode(repeat('63', 32), 'hex'), pg_catalog.transaction_timestamp() + interval '1 hour'
  )$sql$,
  array['23503'], 'Idempotency B with Case A'
);
select pg_temp.qa_expect_failure(
  $sql$insert into public.crm_conversion_request (
    conversion_request_id, center_id, consultation_case_id, source_contact_id,
    source_case_version, source_contact_version, source_assignment_version,
    identity_policy_version, conversion_policy_version, relationship_policy_version,
    student_profile_policy_version, action_graph_digest, idempotency_scope,
    idempotency_key_reference, intent_digest, requested_by_user_id
  ) values (
    '${randomUUID()}', ${q(ids.centerB)}, '${ids.caseA}', '${ids.contactA}',
    1, 1, 1, 1, 1, 1, 1, decode(repeat('64', 32), 'hex'), 'cross_center',
    '${randomUUID()}', decode(repeat('65', 32), 'hex'), '${ids.userB}'
  )$sql$,
  array['23503'], 'Request B with Case/Contact A'
);

select pg_temp.qa_expect_failure(
  $sql$update public.crm_conversion_request set idempotency_scope = 'qa_scope' where conversion_request_id = '${ids.requestA}'$sql$,
  array['P0001'], 'request version unchanged'
);
select pg_temp.qa_expect_failure(
  $sql$update public.crm_conversion_request set idempotency_scope = 'qa_scope', request_version = request_version + 2 where conversion_request_id = '${ids.requestA}'$sql$,
  array['P0001'], 'request version skipped'
);
update public.crm_conversion_request
set status = 'READY_FOR_REVIEW', request_version = request_version + 1,
    updated_at = pg_catalog.transaction_timestamp() - interval '100 years'
where conversion_request_id = ${q(ids.requestA)}::uuid;
select pg_temp.qa_assert(
  (select request_version = 2 and updated_at = pg_catalog.transaction_timestamp() from public.crm_conversion_request where conversion_request_id = ${q(ids.requestA)}::uuid),
  'request valid transition/version/timestamp'
);
select pg_temp.qa_expect_failure(
  $sql$update public.crm_conversion_request set status = 'APPROVED', request_version = request_version + 1 where conversion_request_id = '${ids.requestA}'$sql$,
  array['P0001'], 'request protected APPROVED status'
);
update public.crm_conversion_request
set status = 'REJECTED', request_version = request_version + 1
where conversion_request_id = ${q(ids.requestA)}::uuid;
select pg_temp.qa_expect_failure(
  $sql$update public.crm_conversion_request set status = 'DRAFT', request_version = request_version + 1 where conversion_request_id = '${ids.requestA}'$sql$,
  array['P0001'], 'terminal request reopen'
);
do $qa$
declare
  v_idempotency uuid := ${q(randomUUID())}::uuid;
  v_request uuid := ${q(randomUUID())}::uuid;
  v_rejected boolean := false;
begin
  begin
    insert into public.crm_idempotency_registry (
      idempotency_record_id, environment_fingerprint, center_id, resource_scope_kind,
      resource_scope_id, consultation_case_id, operation, idempotency_key_digest,
      intent_digest, request_id, expires_at
    ) values (
      v_idempotency, decode(repeat('66', 32), 'hex'), ${q(ids.centerA)}, 'consultation_case',
      ${q(ids.caseTerminal)}::uuid, ${q(ids.caseTerminal)}::uuid, 'bad_initial_request', decode(repeat('67', 32), 'hex'),
      decode(repeat('68', 32), 'hex'), v_request, pg_catalog.transaction_timestamp() + interval '1 hour'
    );
    insert into public.crm_conversion_request (
      conversion_request_id, center_id, consultation_case_id, source_contact_id,
      source_case_version, source_contact_version, source_assignment_version,
      identity_policy_version, conversion_policy_version, relationship_policy_version,
      student_profile_policy_version, action_graph_digest, idempotency_scope,
      idempotency_key_reference, intent_digest, status, requested_by_user_id
    ) values (
      v_request, ${q(ids.centerA)}, ${q(ids.caseTerminal)}::uuid, ${q(ids.contactA)}::uuid,
      2, 3, 1, 1, 1, 1, 1, decode(repeat('69', 32), 'hex'), 'bad_initial_request',
      v_idempotency, decode(repeat('68', 32), 'hex'), 'READY_FOR_REVIEW', ${q(ids.userA)}::uuid
    );
  exception when raise_exception then
    v_rejected := true;
  end;
  if not v_rejected then raise exception 'qa_non_draft_request_insert_was_accepted'; end if;
end
$qa$;
\echo P1A_QA_REQUEST_RESERVED_STATUS_GUARD: PASS

select pg_temp.qa_expect_failure(
  $sql$update public.crm_idempotency_registry set status = 'IN_PROGRESS' where idempotency_record_id = '${ids.idempotencyA}'$sql$,
  array['P0001'], 'idempotency version unchanged'
);
select pg_temp.qa_expect_failure(
  $sql$update public.crm_idempotency_registry set status = 'IN_PROGRESS', idempotency_version = idempotency_version + 2 where idempotency_record_id = '${ids.idempotencyA}'$sql$,
  array['P0001'], 'idempotency version skipped'
);
update public.crm_idempotency_registry
set status = 'IN_PROGRESS', idempotency_version = idempotency_version + 1
where idempotency_record_id = ${q(ids.idempotencyA)}::uuid;
update public.crm_idempotency_registry
set status = 'COMPLETED', idempotency_version = idempotency_version + 1,
    completed_at = pg_catalog.transaction_timestamp(), terminal_outcome_digest = decode(repeat('71', 32), 'hex')
where idempotency_record_id = ${q(ids.idempotencyA)}::uuid;
select pg_temp.qa_expect_failure(
  $sql$update public.crm_idempotency_registry
        set status = 'RESERVED', idempotency_version = idempotency_version + 1,
            completed_at = null, terminal_outcome_digest = null
        where idempotency_record_id = '${ids.idempotencyA}'$sql$,
  array['P0001'], 'terminal idempotency reopen'
);

insert into public.crm_audit_event (
  audit_event_id, center_id, event_type, actor_user_id, resource_kind, resource_id,
  request_id, assignment_id, previous_version, new_version, safe_reason_code, correlation_id
) values (
  ${q(ids.auditA)}::uuid, ${q(ids.centerA)}, 'crm.case.checked', ${q(ids.userA)}::uuid,
  'consultation_case', ${q(ids.caseA)}::uuid, ${q(ids.requestA)}::uuid,
  ${q(ids.assignmentA2)}::uuid, null, 1, 'qa_verified', ${q(randomUUID())}::uuid
);
select pg_temp.qa_expect_failure(
  $sql$update public.crm_audit_event set safe_reason_code = 'qa_rewrite' where audit_event_id = '${ids.auditA}'$sql$,
  array['P0001'], 'audit update'
);
select pg_temp.qa_expect_failure(
  $sql$delete from public.crm_audit_event where audit_event_id = '${ids.auditA}'$sql$,
  array['P0001'], 'audit delete'
);
select pg_temp.qa_expect_failure(
  $sql$insert into public.crm_audit_event (
    audit_event_id, center_id, event_type, resource_kind, resource_id,
    request_id, assignment_id, correlation_id
  ) values (
    '${randomUUID()}', ${q(ids.centerB)}, 'crm.cross.checked', 'consultation_case', '${ids.caseB}',
    '${ids.requestA}', '${ids.assignmentA2}', '${randomUUID()}'
  )$sql$,
  array['23503'], 'Audit B with Request/Assignment A'
);
\echo P1A_QA_AUDIT_IMMUTABLE: PASS
\echo P1A_QA_EXACT_CENTER_FOREIGN_KEYS: PASS

insert into public.crm_outbox_event (
  outbox_event_id, center_id, aggregate_kind, aggregate_id, event_type, safe_payload
) values (
  ${q(ids.outboxA)}::uuid, ${q(ids.centerA)}, 'consultation_case', ${q(ids.caseA)}::uuid,
  'crm.case.checked', pg_catalog.jsonb_build_object(
    'event_schema_version', 1, 'resource_kind', 'consultation_case',
    'resource_id', ${q(ids.caseA)}, 'status', 'planned'
  )
);
select pg_temp.qa_assert(
  (select delivery_status = 'PENDING' and event_version = 1 and attempt_count = 0
   from public.crm_outbox_event where outbox_event_id = ${q(ids.outboxA)}::uuid),
  'outbox initial state'
);
select pg_temp.qa_expect_failure(
  $sql$insert into public.crm_outbox_event (
    outbox_event_id, center_id, aggregate_kind, aggregate_id, event_type, safe_payload
  ) values (
    '${randomUUID()}', ${q(ids.centerA)}, 'consultation_case', '${ids.caseA}', 'crm.payload.nested',
    pg_catalog.jsonb_build_object('status', pg_catalog.jsonb_build_object('code', 'safe'))
  )$sql$,
  array['23514'], 'nested outbox payload'
);
select pg_temp.qa_expect_failure(
  $sql$insert into public.crm_outbox_event (
    outbox_event_id, center_id, aggregate_kind, aggregate_id, event_type, safe_payload
  ) values (
    '${randomUUID()}', ${q(ids.centerA)}, 'consultation_case', '${ids.caseA}', 'crm.payload.unknown',
    pg_catalog.jsonb_build_object('unknown_key', 'safe')
  )$sql$,
  array['23514'], 'unknown outbox payload key'
);
select pg_temp.qa_expect_failure(
  $sql$insert into public.crm_outbox_event (
    outbox_event_id, center_id, aggregate_kind, aggregate_id, event_type, safe_payload
  ) values (
    '${randomUUID()}', ${q(ids.centerA)}, 'consultation_case', '${ids.caseA}', 'crm.payload.contact_like',
    pg_catalog.jsonb_build_object('status', pg_catalog.concat('0', pg_catalog.repeat('7', 9)))
  )$sql$,
  array['23514'], 'phone-like outbox payload'
);
select pg_temp.qa_expect_failure(
  $sql$insert into public.crm_outbox_event (
    outbox_event_id, center_id, aggregate_kind, aggregate_id, event_type, safe_payload
  ) values (
    '${randomUUID()}', ${q(ids.centerA)}, 'consultation_case', '${ids.caseA}', 'crm.payload.contact_like',
    pg_catalog.jsonb_build_object('status', pg_catalog.concat('qa', '@', 'example', '.', 'invalid'))
  )$sql$,
  array['23514'], 'email-like outbox payload'
);
\echo P1A_QA_OUTBOX_SAFE_PAYLOAD: PASS

select pg_temp.qa_expect_failure(
  $sql$update public.crm_outbox_event
        set delivery_status = 'CLAIMED', event_version = event_version + 1, attempt_count = attempt_count + 1
        where outbox_event_id = '${ids.outboxA}'$sql$,
  array['23514'], 'outbox claim without lease metadata'
);
select pg_temp.qa_expect_failure(
  $sql$update public.crm_outbox_event
        set delivery_status = 'CLAIMED', attempt_count = attempt_count + 1,
            claim_id = '${ids.claimA}', claimed_by = 'qa_worker',
            claim_expires_at = pg_catalog.transaction_timestamp() + interval '5 minutes'
        where outbox_event_id = '${ids.outboxA}'$sql$,
  array['P0001'], 'outbox version unchanged'
);
update public.crm_outbox_event
set delivery_status = 'CLAIMED', event_version = event_version + 1,
    attempt_count = attempt_count + 1, claim_id = ${q(ids.claimA)}::uuid,
    claimed_by = 'qa_worker', claim_expires_at = pg_catalog.transaction_timestamp() + interval '5 minutes',
    updated_at = pg_catalog.transaction_timestamp() - interval '100 years'
where outbox_event_id = ${q(ids.outboxA)}::uuid;
select pg_temp.qa_assert(
  (select delivery_status = 'CLAIMED' and event_version = 2 and attempt_count = 1
          and updated_at = pg_catalog.transaction_timestamp()
   from public.crm_outbox_event where outbox_event_id = ${q(ids.outboxA)}::uuid),
  'valid outbox claim/version/timestamp'
);
update public.crm_outbox_event
set delivery_status = 'RETRY', event_version = event_version + 1,
    claim_id = null, claimed_by = null, claim_expires_at = null,
    available_at = pg_catalog.transaction_timestamp() + interval '1 minute'
where outbox_event_id = ${q(ids.outboxA)}::uuid;
update public.crm_outbox_event
set delivery_status = 'CLAIMED', event_version = event_version + 1,
    attempt_count = attempt_count + 1, claim_id = ${q(ids.claimB)}::uuid,
    claimed_by = 'qa_worker', claim_expires_at = pg_catalog.transaction_timestamp() + interval '5 minutes'
where outbox_event_id = ${q(ids.outboxA)}::uuid;
update public.crm_outbox_event
set delivery_status = 'DELIVERED', event_version = event_version + 1,
    delivered_at = pg_catalog.transaction_timestamp()
where outbox_event_id = ${q(ids.outboxA)}::uuid;
select pg_temp.qa_expect_failure(
  $sql$update public.crm_outbox_event
        set delivery_status = 'PENDING', event_version = event_version + 1,
            claim_id = null, claimed_by = null, claim_expires_at = null,
            delivered_at = null
        where outbox_event_id = '${ids.outboxA}'$sql$,
  array['P0001'], 'terminal outbox reopen'
);
insert into public.crm_outbox_event (
  outbox_event_id, center_id, aggregate_kind, aggregate_id, event_type, safe_payload
) values (${q(ids.outboxB)}::uuid, ${q(ids.centerA)}, 'consultation_case', ${q(ids.caseTerminal)}::uuid, 'crm.case.pending', '{}'::jsonb);
select pg_temp.qa_expect_failure(
  $sql$update public.crm_outbox_event
        set aggregate_id = '${ids.caseA}', delivery_status = 'CANCELLED', event_version = event_version + 1
        where outbox_event_id = '${ids.outboxB}'$sql$,
  array['P0001'], 'outbox identity rewrite'
);
\echo P1A_QA_OUTBOX_LEASE_AND_TRANSITIONS: PASS

select pg_temp.qa_assert(
  (select control_version = 2 from public.center_crm_control where center_id = ${q(ids.centerA)})
  and (select contact_version = 3 from public.crm_contact where crm_contact_id = ${q(ids.contactA)}::uuid)
  and (select case_version = 4 from public.consultation_case where consultation_case_id = ${q(ids.caseA)}::uuid)
  and (select assignment_version = 2 from public.consultation_case_assignment where assignment_id = ${q(ids.assignmentA1)}::uuid)
  and (select request_version = 3 from public.crm_conversion_request where conversion_request_id = ${q(ids.requestA)}::uuid)
  and (select idempotency_version = 3 from public.crm_idempotency_registry where idempotency_record_id = ${q(ids.idempotencyA)}::uuid)
  and (select event_version = 5 from public.crm_outbox_event where outbox_event_id = ${q(ids.outboxA)}::uuid),
  'monotonic +1 version outcomes'
);
\echo P1A_QA_MONOTONIC_VERSION_PLUS_ONE: PASS

set constraints all immediate;
rollback;
`
process.stdout.write(psql(businessSql).stdout)

const centerList = [ids.centerA, ids.centerB].map(q).join(', ')
const userList = [ids.userA, ids.userB].map((id) => `${q(id)}::uuid`).join(', ')
const leftoverSql = `
select
  (select pg_catalog.count(*) from public.centers where id in (${centerList}))
  + (select pg_catalog.count(*) from auth.users where id in (${userList}))
  + (select pg_catalog.count(*) from public.center_crm_control where center_id in (${centerList}))
  + (select pg_catalog.count(*) from public.crm_contact where center_id in (${centerList}))
  + (select pg_catalog.count(*) from public.consultation_case where center_id in (${centerList}))
  + (select pg_catalog.count(*) from public.consultation_case_candidate_student where center_id in (${centerList}))
  + (select pg_catalog.count(*) from public.consultation_case_assignment where center_id in (${centerList}))
  + (select pg_catalog.count(*) from public.crm_care_log where center_id in (${centerList}))
  + (select pg_catalog.count(*) from public.crm_conversion_request where center_id in (${centerList}))
  + (select pg_catalog.count(*) from public.crm_idempotency_registry where center_id in (${centerList}))
  + (select pg_catalog.count(*) from public.crm_audit_event where center_id in (${centerList}))
  + (select pg_catalog.count(*) from public.crm_outbox_event where center_id in (${centerList}));
`
const leftoverOutput = psql(leftoverSql).stdout.trim()
assert.match(leftoverOutput, /^0$/, `QA fixture rollback left ${leftoverOutput || 'unknown'} rows`)
console.log('P1A_QA_LEFTOVER_FIXTURE_COUNT: 0')
console.log('F23_3E_P1A_LOCAL_DB_BEHAVIOR_QA: PASS')
