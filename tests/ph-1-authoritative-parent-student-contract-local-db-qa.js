import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainer = 'supabase_db_ichess-center-os'
const consentFlag = 'ICHESS_PH_1_LOCAL_QA_ALLOW_MUTATION'
const migrationPath = 'supabase/migrations/202608250001_ph_1_authoritative_parent_student_link_and_contact_identity_update.sql'
const migrationBytes = readFileSync(migrationPath)
const migrationHash = createHash('sha256').update(migrationBytes).digest('hex').toUpperCase()

assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
assert.equal(process.env[consentFlag], 'YES', `${consentFlag}=YES is required`)
assert(!process.env.SUPABASE_PROJECT_REF, 'Linked Supabase project references are forbidden')

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(), encoding: 'utf8', windowsHide: true,
    maxBuffer: 48 * 1024 * 1024, ...options,
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
for (const value of [localStatus.DB_URL, localStatus.API_URL]) {
  assert(['127.0.0.1', 'localhost', '::1'].includes(new URL(value).hostname), 'Local QA must stay loopback-only')
}

const rows = requireSuccess(run('docker', [
  'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
  '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
]), 'Docker discovery').trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
  .filter(([, name]) => name === expectedContainer)
assert.equal(rows.length, 1, 'Expected exactly one local DB container')
assert(/supabase\/postgres/i.test(rows[0][2]))
const containerId = rows[0][0]
const psqlArgs = (user = 'postgres') => [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', user,
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql, user = 'postgres') => requireSuccess(
  run('docker', psqlArgs(user), { input: sql }), 'local psql',
)
const scalar = (sql) => psql(sql).trim()
const q = (value) => `'${String(value).replaceAll("'", "''")}'`
const u = (value) => `${q(value)}::uuid`

if (scalar("select to_regprocedure('public.ph_1_list_parent_student_links(text,boolean)') is not null;") !== 't') {
  psql(migrationBytes.toString('utf8'))
}

assert.equal(scalar("select (relrowsecurity and relforcerowsecurity)::text from pg_class where oid='public.crm_contact_student_operational_link'::regclass;"), 'true')
assert.equal(scalar("select count(*) from pg_policies where schemaname='public' and tablename='crm_contact_student_operational_link';"), '0')
for (const role of ['anon', 'authenticated', 'service_role']) {
  assert.equal(scalar(`select has_table_privilege(${q(role)},'public.crm_contact_student_operational_link','SELECT,INSERT,UPDATE,DELETE');`), 'f')
  assert.equal(scalar(`select has_table_privilege(${q(role)},'public.crm_contact','INSERT,UPDATE,DELETE');`), 'f')
}
for (const signature of [
  'public.ph_1_list_parent_student_links(text,boolean)',
  'public.ph_1_create_parent_student_link(text,uuid,uuid,text,text,boolean,text,text,uuid)',
  'public.ph_1_update_parent_student_link(text,uuid,integer,text,boolean,text,text,uuid)',
  'public.ph_1_end_parent_student_link(text,uuid,integer,text,uuid)',
  'public.ph_1_update_crm_contact_identity(text,uuid,integer,text,text[],text[],uuid)',
]) {
  assert.equal(scalar(`select has_function_privilege('authenticated',${q(signature)},'EXECUTE');`), 't')
  assert.equal(scalar(`select has_function_privilege('anon',${q(signature)},'EXECUTE');`), 'f')
  assert.equal(scalar(`select has_function_privilege('service_role',${q(signature)},'EXECUTE');`), 'f')
}
assert.equal(scalar(`select count(*) from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='crm_contact_student_operational_link';`), '0')

const ids = {
  owner: randomUUID(),
  admin: randomUUID(),
  other: randomUUID(),
  center: `ph-1-${randomUUID()}`,
  otherCenter: `ph-1-other-${randomUUID()}`,
  student: `ph-1-student-${randomUUID()}`,
  otherStudent: `ph-1-other-student-${randomUUID()}`,
  link: randomUUID(),
  missingLink: randomUUID(),
  createKey: randomUUID(),
  updateKey: randomUUID(),
  contactUpdateKey: randomUUID(),
  endKey: randomUUID(),
}
const studentPayload = JSON.stringify({
  id: ids.student,
  fullName: 'PH-1 Synthetic Existing Student',
  parentName: 'Legacy Student Parent Must Stay Untouched',
  fatherPhone: '0901111111',
  motherPhone: '0902222222',
})
const otherStudentPayload = JSON.stringify({ id: ids.otherStudent, fullName: 'PH-1 Other Center Student' })

const vaultGrants = `grant execute on function vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
grant execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
grant execute on function vault._crypto_aead_det_noncegen() to postgres;`
const vaultRevokes = `revoke execute on function vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea) from postgres;
revoke execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) from postgres;
revoke execute on function vault._crypto_aead_det_noncegen() from postgres;`
psql(vaultGrants, 'supabase_admin')

const qaSql = `
begin;

select vault.create_secret(
  pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
  'f23_3e_p4a_contact_lookup_epoch_1',
  'PH-1 transaction-scoped local QA'
);

insert into auth.users(id,aud,role,created_at,updated_at) values
  (${u(ids.owner)}, 'authenticated', 'authenticated', now(), now()),
  (${u(ids.admin)}, 'authenticated', 'authenticated', now(), now()),
  (${u(ids.other)}, 'authenticated', 'authenticated', now(), now());
insert into public.centers(id,name,status) values
  (${q(ids.center)}, 'PH-1 local QA', 'active'),
  (${q(ids.otherCenter)}, 'PH-1 other local QA', 'active');
update public.center_crm_control
set crm_state='ACTIVE', feature_flag_state='ENABLED', control_version=control_version+1
where center_id in (${q(ids.center)}, ${q(ids.otherCenter)});
insert into public.center_members(center_id,user_id,role,status) values
  (${q(ids.center)}, ${u(ids.owner)}, 'owner', 'active'),
  (${q(ids.center)}, ${u(ids.admin)}, 'center_admin', 'active'),
  (${q(ids.otherCenter)}, ${u(ids.other)}, 'owner', 'active');
insert into public.center_cloud_entities(
  center_id,entity_type,local_id,payload,source_module,source_version,
  entity_version,created_by,updated_by
) values
  (${q(ids.center)},'student',${q(ids.student)},${q(studentPayload)}::jsonb,
   'hoc-vien','c5.1-authoritative-core-v1',1,${u(ids.owner)},${u(ids.owner)}),
  (${q(ids.otherCenter)},'student',${q(ids.otherStudent)},${q(otherStudentPayload)}::jsonb,
   'hoc-vien','c5.1-authoritative-core-v1',1,${u(ids.other)},${u(ids.other)});

do $qa$
begin
  if (select count(*) from public.crm_contact) <> 0
     or (select count(*) from public.crm_contact_student_operational_link) <> 0 then
    raise exception 'silent Contact/link creation detected';
  end if;
end
$qa$;

select pg_catalog.set_config(
  'qa.ph1.contact_a',
  (select crm_contact_id::text from public.f23_3e_p4a_ingress_canonical_contact(
    ${q(ids.center)}, ${u(ids.owner)}, ${q(`ph-1-contact-a-${ids.link}`)},
    'PH-1 Parent A', array['0903000001'], array['parent.a@example.invalid']
  )), true
);
select pg_catalog.set_config(
  'qa.ph1.contact_b',
  (select crm_contact_id::text from public.f23_3e_p4a_ingress_canonical_contact(
    ${q(ids.center)}, ${u(ids.owner)}, ${q(`ph-1-contact-b-${ids.link}`)},
    'PH-1 Parent B', array['0903000002'], array['parent.b@example.invalid']
  )), true
);
select pg_catalog.set_config(
  'qa.ph1.contact_duplicate',
  (select crm_contact_id::text from public.f23_3e_p4a_ingress_canonical_contact(
    ${q(ids.center)}, ${u(ids.owner)}, ${q(`ph-1-contact-duplicate-${ids.link}`)},
    'PH-1 Parent Duplicate Candidate', array['0903000002'], array['duplicate@example.invalid']
  )), true
);
select pg_catalog.set_config(
  'qa.ph1.contact_other',
  (select crm_contact_id::text from public.f23_3e_p4a_ingress_canonical_contact(
    ${q(ids.otherCenter)}, ${u(ids.other)}, ${q(`ph-1-contact-other-${ids.link}`)},
    'PH-1 Other Center Parent', array['0903999999'], array['other.parent@example.invalid']
  )), true
);

do $qa$
begin
  if (select count(*) from public.crm_contact_student_operational_link) <> 0 then
    raise exception 'Contact ingress silently linked Student';
  end if;
end
$qa$;

select pg_catalog.set_config('request.jwt.claim.sub', ${q(ids.owner)}, true);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
do $qa$
declare v_result jsonb;
begin
  v_result := public.ph_1_create_parent_student_link(
    ${q(ids.center)}, ${u(ids.link)}, current_setting('qa.ph1.contact_a')::uuid,
    ${q(ids.student)}, 'PARENT', true, 'PRIMARY', 'PRIMARY', ${u(ids.createKey)}
  );
  if v_result->>'outcome_code' <> 'COMMITTED' or (v_result->>'replayed')::boolean
     or (v_result->>'link_version')::integer <> 1 then
    raise exception 'Owner create failed: %', v_result;
  end if;
  v_result := public.ph_1_create_parent_student_link(
    ${q(ids.center)}, ${u(ids.link)}, current_setting('qa.ph1.contact_a')::uuid,
    ${q(ids.student)}, 'PARENT', true, 'PRIMARY', 'PRIMARY', ${u(ids.createKey)}
  );
  if not (v_result->>'replayed')::boolean then raise exception 'Create replay failed: %', v_result; end if;

  begin
    perform public.ph_1_create_parent_student_link(
      ${q(ids.center)}, ${u(ids.link)}, current_setting('qa.ph1.contact_a')::uuid,
      ${q(ids.student)}, 'CAREGIVER', true, 'PRIMARY', 'PRIMARY', ${u(ids.createKey)}
    );
    raise exception 'changed-intent retry was accepted';
  exception when others then
    if sqlerrm <> 'IDEMPOTENCY_KEY_REUSED_WITH_CHANGED_INTENT' then raise; end if;
  end;

  begin
    perform public.ph_1_create_parent_student_link(
      ${q(ids.center)}, ${u(ids.missingLink)}, current_setting('qa.ph1.contact_a')::uuid,
      'missing-student', 'PARENT', false, 'NONE', 'NONE', gen_random_uuid()
    );
    raise exception 'missing Student was accepted';
  exception when others then
    if sqlerrm <> 'STUDENT_NOT_CURRENT_OR_NOT_FOUND' then raise; end if;
  end;
  begin
    perform public.ph_1_create_parent_student_link(
      ${q(ids.center)}, ${u(ids.missingLink)}, gen_random_uuid(),
      ${q(ids.student)}, 'PARENT', false, 'NONE', 'NONE', gen_random_uuid()
    );
    raise exception 'missing Contact was accepted';
  exception when others then
    if sqlerrm <> 'CONTACT_NOT_FOUND' then raise; end if;
  end;
  begin
    perform public.ph_1_create_parent_student_link(
      ${q(ids.center)}, ${u(ids.missingLink)}, current_setting('qa.ph1.contact_other')::uuid,
      ${q(ids.student)}, 'PARENT', false, 'NONE', 'NONE', gen_random_uuid()
    );
    raise exception 'wrong-center Contact was accepted';
  exception when others then
    if sqlerrm <> 'CONTACT_NOT_FOUND' then raise; end if;
  end;
  begin
    perform public.ph_1_update_parent_student_link(
      ${q(ids.center)}, ${u(ids.link)}, 2, 'PARENT', true, 'PRIMARY', 'PRIMARY', gen_random_uuid()
    );
    raise exception 'stale Link version was accepted';
  exception when others then
    if sqlerrm <> 'LINK_VERSION_STALE' then raise; end if;
  end;
end
$qa$;

do $qa$
begin
  begin
    insert into public.crm_contact_student_operational_link(
      link_id,center_id,crm_contact_id,student_local_id,relationship_type,
      created_by_user_id,updated_by_user_id
    ) values (
      gen_random_uuid(),${q(ids.center)},current_setting('qa.ph1.contact_a')::uuid,
      ${q(ids.student)},'PARENT',${u(ids.owner)},${u(ids.owner)}
    );
    raise exception 'authenticated direct DML was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.crm_contact set display_name='Direct DML denied'
    where crm_contact_id=current_setting('qa.ph1.contact_a')::uuid;
    raise exception 'authenticated direct Contact update was accepted';
  exception when insufficient_privilege then null;
  end;
end
$qa$;
reset role;

select pg_catalog.set_config('request.jwt.claim.sub', ${q(ids.admin)}, true);
set local role authenticated;
do $qa$
declare v_result jsonb;
begin
  v_result := public.ph_1_list_parent_student_links(${q(ids.center)}, false);
  if pg_catalog.jsonb_array_length(v_result->'links') <> 1
     or v_result#>>'{links,0,student_local_id}' <> ${q(ids.student)}
     or v_result#>>'{links,0,contact_phones,0}' <> '+84903000001' then
    raise exception 'Admin convergence read failed: %', v_result;
  end if;

  v_result := public.ph_1_update_parent_student_link(
    ${q(ids.center)}, ${u(ids.link)}, 1, 'LEGAL_GUARDIAN', true,
    'PRIMARY', 'SECONDARY', ${u(ids.updateKey)}
  );
  if (v_result->>'link_version')::integer <> 2 or not (v_result->>'changed')::boolean then
    raise exception 'Admin Link update failed: %', v_result;
  end if;
  v_result := public.ph_1_update_parent_student_link(
    ${q(ids.center)}, ${u(ids.link)}, 1, 'LEGAL_GUARDIAN', true,
    'PRIMARY', 'SECONDARY', ${u(ids.updateKey)}
  );
  if not (v_result->>'replayed')::boolean or (v_result->>'link_version')::integer <> 2 then
    raise exception 'Link update replay failed: %', v_result;
  end if;

  begin
    perform public.ph_1_update_crm_contact_identity(
      ${q(ids.center)}, current_setting('qa.ph1.contact_b')::uuid, 2,
      'PH-1 Parent B', array['0903000002'], array['parent.b@example.invalid'], gen_random_uuid()
    );
    raise exception 'unchanged duplicate Contact identity was accepted';
  exception when others then
    if sqlerrm <> 'CONTACT_IDENTITY_COLLISION_REVIEW_REQUIRED' then raise; end if;
  end;

  begin
    perform public.ph_1_update_crm_contact_identity(
      ${q(ids.center)}, current_setting('qa.ph1.contact_a')::uuid, 2,
      'PH-1 Parent Collision', array['0903000002'], array['parent.a@example.invalid'], gen_random_uuid()
    );
    raise exception 'Contact identity collision was accepted';
  exception when others then
    if sqlerrm <> 'CONTACT_IDENTITY_COLLISION_REVIEW_REQUIRED' then raise; end if;
  end;

  v_result := public.ph_1_update_crm_contact_identity(
    ${q(ids.center)}, current_setting('qa.ph1.contact_a')::uuid, 2,
    'PH-1 Parent A Updated', array['0903000011'], array['parent.a.updated@example.invalid'],
    ${u(ids.contactUpdateKey)}
  );
  if (v_result->>'contact_version')::integer <> 3 or not (v_result->>'changed')::boolean then
    raise exception 'Contact identity update failed: %', v_result;
  end if;
  v_result := public.ph_1_update_crm_contact_identity(
    ${q(ids.center)}, current_setting('qa.ph1.contact_a')::uuid, 2,
    'PH-1 Parent A Updated', array['0903000011'], array['parent.a.updated@example.invalid'],
    ${u(ids.contactUpdateKey)}
  );
  if not (v_result->>'replayed')::boolean or (v_result->>'contact_version')::integer <> 3 then
    raise exception 'Contact identity replay failed: %', v_result;
  end if;
  begin
    perform public.ph_1_update_crm_contact_identity(
      ${q(ids.center)}, current_setting('qa.ph1.contact_a')::uuid, 2,
      'PH-1 Stale', array['0903000012'], array[]::text[], gen_random_uuid()
    );
    raise exception 'stale Contact version was accepted';
  exception when others then
    if sqlerrm <> 'CONTACT_VERSION_STALE' then raise; end if;
  end;
end
$qa$;
reset role;

select pg_catalog.set_config('request.jwt.claim.sub', ${q(ids.owner)}, true);
set local role authenticated;
do $qa$
declare v_result jsonb;
begin
  v_result := public.ph_1_list_parent_student_links(${q(ids.center)}, false);
  if v_result#>>'{links,0,relationship_type}' <> 'LEGAL_GUARDIAN'
     or v_result#>>'{links,0,academic_contact_role}' <> 'SECONDARY'
     or v_result#>>'{links,0,contact_display_name}' <> 'PH-1 Parent A Updated'
     or v_result#>>'{links,0,contact_phones,0}' <> '+84903000011'
     or v_result#>>'{links,0,contact_emails,0}' <> 'parent.a.updated@example.invalid' then
    raise exception 'Owner convergence after Admin updates failed: %', v_result;
  end if;

  v_result := public.ph_1_end_parent_student_link(
    ${q(ids.center)}, ${u(ids.link)}, 2, 'OPERATOR_UNLINKED', ${u(ids.endKey)}
  );
  if v_result->>'link_status' <> 'ENDED' or (v_result->>'link_version')::integer <> 3 then
    raise exception 'End Link failed: %', v_result;
  end if;
  v_result := public.ph_1_end_parent_student_link(
    ${q(ids.center)}, ${u(ids.link)}, 2, 'OPERATOR_UNLINKED', ${u(ids.endKey)}
  );
  if not (v_result->>'replayed')::boolean then raise exception 'End Link replay failed: %', v_result; end if;
  if pg_catalog.jsonb_array_length(public.ph_1_list_parent_student_links(${q(ids.center)}, false)->'links') <> 0
     or public.ph_1_list_parent_student_links(${q(ids.center)}, true)#>>'{links,0,link_status}' <> 'ENDED' then
    raise exception 'Ended Link visibility failed';
  end if;
end
$qa$;
reset role;

select pg_catalog.set_config('request.jwt.claim.sub', ${q(ids.other)}, true);
set local role authenticated;
do $qa$
declare v_result jsonb;
begin
  begin
    perform public.ph_1_list_parent_student_links(${q(ids.center)}, false);
    raise exception 'cross-center read was accepted';
  exception when others then
    if sqlerrm <> 'CENTER_ACCESS_DENIED' then raise; end if;
  end;
  begin
    perform public.ph_1_create_parent_student_link(
      ${q(ids.center)}, gen_random_uuid(), current_setting('qa.ph1.contact_a')::uuid,
      ${q(ids.student)}, 'PARENT', false, 'NONE', 'NONE', gen_random_uuid()
    );
    raise exception 'cross-center write was accepted';
  exception when others then
    if sqlerrm <> 'CENTER_ACCESS_DENIED' then raise; end if;
  end;
  v_result := public.ph_1_list_parent_student_links(${q(ids.otherCenter)}, false);
  if pg_catalog.jsonb_array_length(v_result->'links') <> 0 then
    raise exception 'different-center leak detected: %', v_result;
  end if;
end
$qa$;
reset role;

do $qa$
begin
  if (select entity_version from public.center_cloud_entities
      where center_id=${q(ids.center)} and entity_type='student' and local_id=${q(ids.student)}) <> 1
     or (select payload from public.center_cloud_entities
      where center_id=${q(ids.center)} and entity_type='student' and local_id=${q(ids.student)})
        is distinct from ${q(studentPayload)}::jsonb then
    raise exception 'Student payload/version changed';
  end if;
  if (select contact_version from public.crm_contact
      where crm_contact_id=current_setting('qa.ph1.contact_b')::uuid) <> 2 then
    raise exception 'collision target Contact changed';
  end if;
  if (select count(*) from public.crm_audit_event
      where center_id=${q(ids.center)} and event_type in (
        'crm.parent_student_link.created','crm.parent_student_link.updated',
        'crm.parent_student_link.ended','crm.contact.identity_updated'
      )) <> 4 then
    raise exception 'audit evidence count mismatch';
  end if;
  if (select count(*) from public.crm_outbox_event
      where center_id=${q(ids.center)} and event_type in (
        'crm.parent_student_link.created','crm.parent_student_link.updated',
        'crm.parent_student_link.ended','crm.contact.identity_updated'
      )) <> 4 then
    raise exception 'outbox evidence count mismatch';
  end if;
  if (select count(*) from public.crm_shared_command_result
      where center_id=${q(ids.center)} and idempotency_key in (
        ${u(ids.createKey)},${u(ids.updateKey)},${u(ids.contactUpdateKey)},${u(ids.endKey)}
      )) <> 4 then
    raise exception 'idempotency registry count mismatch';
  end if;
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'ph_1_%'
      and (pg_get_functiondef(p.oid) ~ 'f23_3e_p3d_|f23_3e_p4b_|crm_conversion_|guardian_profile|student_profile')
  ) then
    raise exception 'P3D/P4B/conversion dependency detected';
  end if;
end
$qa$;

rollback;
`

try {
  psql(qaSql)
} finally {
  psql(vaultRevokes, 'supabase_admin')
}
assert.equal(scalar(`select count(*) from public.centers where id in (${q(ids.center)},${q(ids.otherCenter)});`), '0')
assert.equal(scalar(`select count(*) from auth.users where id in (${u(ids.owner)},${u(ids.admin)},${u(ids.other)});`), '0')
assert.equal(scalar(`select count(*) from public.crm_contact_student_operational_link where center_id in (${q(ids.center)},${q(ids.otherCenter)});`), '0')

console.log(`PH_1_LOCAL_DB_MIGRATION_TRANSACTION: PASS (${migrationHash})`)
console.log('PH_1_LOCAL_OWNER_ADMIN_LINK_CONVERGENCE_STALE_IDEMPOTENCY: PASS')
console.log('PH_1_LOCAL_CONTACT_IDENTITY_COLLISION_PROTECTION: PASS')
console.log('PH_1_LOCAL_CROSS_CENTER_READ_0_WRITE_DENIED: PASS')
console.log('PH_1_LOCAL_STUDENT_PAYLOAD_UNCHANGED_SILENT_IMPORT_0: PASS')
console.log('PH_1_LOCAL_AUDIT_OUTBOX_DIRECT_DML_RLS: PASS')
console.log('PH_1_LOCAL_P3D_P4B_DEPENDENCY_0: PASS')
console.log('PH_1_LOCAL_DB_ACTIVE_FIXTURE_RESIDUE_0: PASS')
console.log('PH_1_AUTHORITATIVE_PARENT_STUDENT_CONTRACT_LOCAL_DB_QA: PASS')
