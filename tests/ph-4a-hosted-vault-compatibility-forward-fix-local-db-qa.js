import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainer = 'supabase_db_ichess-center-os'
const consentFlag = 'ICHESS_PH_4A_LOCAL_QA_ALLOW_MUTATION'
const migrationPath = 'supabase/migrations/202608250002_ph_4a_hosted_vault_compatibility_forward_fix.sql'
const migrationBytes = readFileSync(migrationPath)
const migrationHash = createHash('sha256').update(migrationBytes).digest('hex').toUpperCase()

assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
assert.equal(process.env[consentFlag], 'YES', `${consentFlag}=YES is required`)
assert(!process.env.SUPABASE_PROJECT_REF, 'Linked Supabase project references are forbidden')

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
for (const value of [localStatus.DB_URL, localStatus.API_URL]) {
  assert(['127.0.0.1', 'localhost', '::1'].includes(new URL(value).hostname),
    'Local QA must stay loopback-only')
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

if (scalar("select to_regprocedure('public.ph_4a_internal_encrypt_contact_source(text,uuid,integer,bytea)') is not null;") !== 't') {
  assert.equal(scalar('select count(*) from public.crm_contact;'), '0',
    'PH-4A migration apply requires zero Contact residue')
  psql(migrationBytes.toString('utf8'))
}

assert.equal(scalar("select has_function_privilege('postgres','vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea)','EXECUTE');"), 'f')
assert.equal(scalar("select has_function_privilege('postgres','vault._crypto_aead_det_noncegen()','EXECUTE');"), 'f')
for (const role of ['anon', 'authenticated', 'service_role']) {
  assert.equal(scalar(`select has_function_privilege(${q(role)},'public.ph_4a_internal_encrypt_contact_source(text,uuid,integer,bytea)','EXECUTE');`), 'f')
  assert.equal(scalar(`select has_function_privilege(${q(role)},'public.ph_4a_internal_decrypt_contact_source(text,uuid,bytea)','EXECUTE');`), 'f')
  assert.equal(scalar(`select has_table_privilege(${q(role)},'public.crm_contact','INSERT,UPDATE,DELETE');`), 'f')
}
assert.equal(scalar("select has_function_privilege('authenticated','public.ph_1_update_crm_contact_identity(text,uuid,integer,text,text[],text[],uuid)','EXECUTE');"), 't')

const ids = {
  owner: randomUUID(),
  admin: randomUUID(),
  otherOwner: randomUUID(),
  center: `ph-4a-${randomUUID()}`,
  otherCenter: `ph-4a-other-${randomUUID()}`,
  sourceA: `ph-4a-source-a-${randomUUID()}`,
  sourceB: `ph-4a-source-b-${randomUUID()}`,
  sourceOther: `ph-4a-source-other-${randomUUID()}`,
  caseA: randomUUID(),
  createKey: randomUUID(),
  updateKey: randomUUID(),
  changedIntentKey: randomUUID(),
  staleKey: randomUUID(),
}
const createCommand = JSON.stringify({
  operation: 'CREATE_LEAD',
  local_source_id: ids.sourceA,
  case_id: ids.caseA,
  contact: {
    display_name: 'PH-4A Synthetic Parent A',
    phones: ['0904000001'],
    emails: ['ph4a.parent.a@example.invalid'],
  },
  safe_state: {
    contactType: 'consultingLead',
    customerStage: 'lead',
    consultationStatus: 'newLead',
    source: 'local-qa',
  },
})

const qaSql = `
begin;

do $qa$
declare
  v_secret_id uuid;
  v_count integer;
begin
  select count(*)::integer into v_count
  from vault.secrets where name='f23_3e_p4a_contact_lookup_epoch_1';
  if v_count = 0 then
    perform vault.create_secret(
      pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
      'f23_3e_p4a_contact_lookup_epoch_1',
      'PH-4A transaction-scoped local QA'
    );
  elsif v_count = 1 then
    select id into strict v_secret_id from vault.secrets
    where name='f23_3e_p4a_contact_lookup_epoch_1';
    perform vault.update_secret(
      v_secret_id,
      pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
      'f23_3e_p4a_contact_lookup_epoch_1',
      'PH-4A transaction-scoped local QA'
    );
  else
    raise exception 'duplicate local lookup-key secret';
  end if;
end
$qa$;

select pg_catalog.set_config(
  'qa.ph4a.core_digest',
  (select pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(coalesce(pg_catalog.string_agg(
      pg_catalog.to_jsonb(e)::text, '|' order by e.center_id,e.entity_type,e.local_id
    ), 'EMPTY'), 'UTF8'), 'sha256'), 'hex') from public.center_cloud_entities e), true
);
select pg_catalog.set_config(
  'qa.ph4a.finance_digest',
  (select pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(coalesce(pg_catalog.string_agg(
      pg_catalog.to_jsonb(t)::text, '|' order by t.center_id,t.id
    ), 'EMPTY'), 'UTF8'), 'sha256'), 'hex') from public.finance_transaction t), true
);
select pg_catalog.set_config(
  'qa.ph4a.operational_digest',
  (select pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(coalesce(pg_catalog.string_agg(
      pg_catalog.to_jsonb(r)::text, '|' order by r.center_id,r.id
    ), 'EMPTY'), 'UTF8'), 'sha256'), 'hex') from public.center_operational_command_result r), true
);

insert into auth.users(id,aud,role,created_at,updated_at) values
  (${u(ids.owner)}, 'authenticated', 'authenticated', now(), now()),
  (${u(ids.admin)}, 'authenticated', 'authenticated', now(), now()),
  (${u(ids.otherOwner)}, 'authenticated', 'authenticated', now(), now());
insert into public.centers(id,name,status) values
  (${q(ids.center)}, 'PH-4A local QA', 'active'),
  (${q(ids.otherCenter)}, 'PH-4A other local QA', 'active');
update public.center_crm_control
set crm_state='ACTIVE', feature_flag_state='ENABLED', control_version=control_version+1
where center_id in (${q(ids.center)}, ${q(ids.otherCenter)});
insert into public.center_members(center_id,user_id,role,status) values
  (${q(ids.center)}, ${u(ids.owner)}, 'owner', 'active'),
  (${q(ids.center)}, ${u(ids.admin)}, 'center_admin', 'active'),
  (${q(ids.otherCenter)}, ${u(ids.otherOwner)}, 'owner', 'active');

select pg_catalog.set_config('request.jwt.claim.sub', ${q(ids.owner)}, true);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;
select pg_catalog.set_config(
  'qa.ph4a.create_result',
  public.c5_3_mutate_crm_shared_truth(
    ${q(ids.center)}, ${q(createCommand)}::jsonb, ${u(ids.createKey)}
  )::text,
  true
);
do $qa$
declare v_result jsonb := current_setting('qa.ph4a.create_result')::jsonb;
begin
  if not coalesce((v_result->>'ok')::boolean,false)
     or v_result->>'outcome_code' <> 'COMMITTED' then
    raise exception 'C5.3 Contact create failed: %', v_result;
  end if;
end
$qa$;
reset role;

select pg_catalog.set_config(
  'qa.ph4a.contact_a',
  (select crm_contact_id::text from public.crm_contact
   where center_id=${q(ids.center)} and legacy_source_id=${q(ids.sourceA)}), true
);
select pg_catalog.set_config(
  'qa.ph4a.contact_b',
  (select crm_contact_id::text from public.f23_3e_p4a_ingress_canonical_contact(
    ${q(ids.center)}, ${u(ids.owner)}, ${q(ids.sourceB)},
    'PH-4A Synthetic Parent B', array['0904000002'], array['ph4a.parent.b@example.invalid']
  )), true
);
select pg_catalog.set_config(
  'qa.ph4a.contact_other',
  (select crm_contact_id::text from public.f23_3e_p4a_ingress_canonical_contact(
    ${q(ids.otherCenter)}, ${u(ids.otherOwner)}, ${q(ids.sourceOther)},
    'PH-4A Synthetic Other Center', array['0904999999'], array['ph4a.other@example.invalid']
  )), true
);

do $qa$
declare
  v_contact public.crm_contact%rowtype;
  v_payload bytea;
  v_parsed record;
  v_envelope record;
begin
  select * into strict v_contact from public.crm_contact
  where crm_contact_id=current_setting('qa.ph4a.contact_a')::uuid;
  if v_contact.contact_version <> 2 or v_contact.contact_methods_crypto_version <> 3
     or pg_catalog.substr(v_contact.protected_contact_methods_ciphertext,1,8)
        <> pg_catalog.convert_to('IP4ACSE1','UTF8') then
    raise exception 'Contact create did not commit protected v3 evidence';
  end if;
  v_payload := public.f23_3e_p3c_internal_unwrap_contact_source_evidence(
    v_contact.center_id,v_contact.crm_contact_id,v_contact.contact_version
  );
  select * into strict v_parsed from public.f23_3e_p4a_internal_parse_payload_v1(v_payload);
  if v_parsed.canonical_phones is distinct from array['+84904000001']::text[]
     or v_parsed.canonical_emails is distinct from array['ph4a.parent.a@example.invalid']::text[] then
    raise exception 'protect -> unwrap roundtrip mismatch';
  end if;
  select * into strict v_envelope from public.ph_4a_internal_parse_source_envelope(
    v_contact.protected_contact_methods_ciphertext
  );
  if pg_catalog.strpos(
       pg_catalog.encode(v_envelope.cipher_bytes,'hex'), pg_catalog.encode(v_payload,'hex')
     ) <> 0 then
    raise exception 'plaintext payload was embedded in ciphertext';
  end if;
end
$qa$;

select pg_catalog.set_config('request.jwt.claim.sub', ${q(ids.admin)}, true);
set local role authenticated;
select pg_catalog.set_config(
  'qa.ph4a.update_result',
  public.ph_1_update_crm_contact_identity(
    ${q(ids.center)}, current_setting('qa.ph4a.contact_a')::uuid, 2,
    'PH-4A Synthetic Parent A Updated',
    array['0904000011'], array['ph4a.parent.a.updated@example.invalid'], ${u(ids.updateKey)}
  )::text,
  true
);
do $qa$
declare v_result jsonb := current_setting('qa.ph4a.update_result')::jsonb;
begin
  if v_result->>'outcome_code' <> 'COMMITTED'
     or (v_result->>'replayed')::boolean
     or (v_result->>'contact_version')::integer <> 3 then
    raise exception 'Admin protected Contact update failed: %', v_result;
  end if;
  v_result := public.ph_1_update_crm_contact_identity(
    ${q(ids.center)}, current_setting('qa.ph4a.contact_a')::uuid, 2,
    'PH-4A Synthetic Parent A Updated',
    array['0904000011'], array['ph4a.parent.a.updated@example.invalid'], ${u(ids.updateKey)}
  );
  if not (v_result->>'replayed')::boolean or (v_result->>'contact_version')::integer <> 3 then
    raise exception 'exact idempotent retry failed: %', v_result;
  end if;
  begin
    perform public.ph_1_update_crm_contact_identity(
      ${q(ids.center)}, current_setting('qa.ph4a.contact_a')::uuid, 2,
      'Changed Intent', array['0904000012'], array[]::text[], ${u(ids.updateKey)}
    );
    raise exception 'changed-intent retry was accepted';
  exception when others then
    if sqlerrm <> 'IDEMPOTENCY_KEY_REUSED_WITH_CHANGED_INTENT' then raise; end if;
  end;
  begin
    perform public.ph_1_update_crm_contact_identity(
      ${q(ids.center)}, current_setting('qa.ph4a.contact_a')::uuid, 2,
      'Stale Attempt', array['0904000013'], array[]::text[], ${u(ids.staleKey)}
    );
    raise exception 'stale update was accepted';
  exception when others then
    if sqlerrm <> 'CONTACT_VERSION_STALE' then raise; end if;
  end;
end
$qa$;
reset role;

select pg_catalog.set_config('request.jwt.claim.sub', ${q(ids.owner)}, true);
set local role authenticated;
do $qa$
declare v_snapshot jsonb;
begin
  v_snapshot := public.c5_3_list_crm_shared_truth(${q(ids.center)});
  if not coalesce((v_snapshot->>'ok')::boolean,false)
     or v_snapshot#>>'{records,0,parentName}' <> 'PH-4A Synthetic Parent A Updated' then
    raise exception 'Owner did not converge after Admin update: %', v_snapshot;
  end if;
  begin
    update public.crm_contact set display_name='DIRECT DML MUST FAIL'
    where crm_contact_id=current_setting('qa.ph4a.contact_a')::uuid;
    raise exception 'authenticated direct DML was accepted';
  exception when insufficient_privilege then
    null;
  end;
end
$qa$;
reset role;

select pg_catalog.set_config('request.jwt.claim.sub', ${q(ids.otherOwner)}, true);
set local role authenticated;
do $qa$
declare v_snapshot jsonb;
begin
  v_snapshot := public.c5_3_list_crm_shared_truth(${q(ids.center)});
  if v_snapshot->>'outcome_code' <> 'CENTER_ACCESS_DENIED' then
    raise exception 'cross-center read did not fail closed: %', v_snapshot;
  end if;
  begin
    perform public.ph_1_update_crm_contact_identity(
      ${q(ids.center)}, current_setting('qa.ph4a.contact_a')::uuid, 3,
      'Cross Center Attempt', array['0904999998'], array[]::text[], gen_random_uuid()
    );
    raise exception 'cross-center protected update was accepted';
  exception when others then
    if sqlerrm <> 'CENTER_ACCESS_DENIED' then raise; end if;
  end;
end
$qa$;
reset role;

do $qa$
declare
  v_a public.crm_contact%rowtype;
  v_b public.crm_contact%rowtype;
  v_failed boolean;
  v_tampered bytea;
begin
  select * into strict v_a from public.crm_contact
  where crm_contact_id=current_setting('qa.ph4a.contact_a')::uuid;
  select * into strict v_b from public.crm_contact
  where crm_contact_id=current_setting('qa.ph4a.contact_b')::uuid;

  v_failed := false;
  begin
    perform public.ph_4a_internal_decrypt_contact_source(
      v_b.center_id, v_b.crm_contact_id, v_a.protected_contact_methods_ciphertext
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'same-center Contact rebind was accepted'; end if;

  v_failed := false;
  begin
    perform public.ph_4a_internal_decrypt_contact_source(
      ${q(ids.otherCenter)}, v_a.crm_contact_id, v_a.protected_contact_methods_ciphertext
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'wrong-center rebind was accepted'; end if;

  v_tampered := pg_catalog.set_byte(
    v_a.protected_contact_methods_ciphertext,
    pg_catalog.octet_length(v_a.protected_contact_methods_ciphertext)-3,
    pg_catalog.get_byte(
      v_a.protected_contact_methods_ciphertext,
      pg_catalog.octet_length(v_a.protected_contact_methods_ciphertext)-3
    ) # 1
  );
  v_failed := false;
  begin
    perform public.ph_4a_internal_decrypt_contact_source(
      v_a.center_id, v_a.crm_contact_id, v_tampered
    );
  exception when others then v_failed := true;
  end;
  if not v_failed then raise exception 'tampered source evidence was accepted'; end if;
end
$qa$;

do $qa$
declare
  v_core text;
  v_finance text;
  v_operational text;
begin
  select pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(coalesce(pg_catalog.string_agg(
      pg_catalog.to_jsonb(e)::text, '|' order by e.center_id,e.entity_type,e.local_id
    ), 'EMPTY'), 'UTF8'), 'sha256'), 'hex') into v_core from public.center_cloud_entities e;
  select pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(coalesce(pg_catalog.string_agg(
      pg_catalog.to_jsonb(t)::text, '|' order by t.center_id,t.id
    ), 'EMPTY'), 'UTF8'), 'sha256'), 'hex') into v_finance from public.finance_transaction t;
  select pg_catalog.encode(extensions.digest(
    pg_catalog.convert_to(coalesce(pg_catalog.string_agg(
      pg_catalog.to_jsonb(r)::text, '|' order by r.center_id,r.id
    ), 'EMPTY'), 'UTF8'), 'sha256'), 'hex') into v_operational from public.center_operational_command_result r;
  if v_core is distinct from current_setting('qa.ph4a.core_digest')
     or v_finance is distinct from current_setting('qa.ph4a.finance_digest')
     or v_operational is distinct from current_setting('qa.ph4a.operational_digest') then
    raise exception 'Student/Tuition/Finance authority changed';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'f23_3e_p3c_internal_protect_contact_source_evidence',
        'f23_3e_p3c_internal_unwrap_contact_source_evidence',
        'ph_1_internal_assert_mutable_contact',
        'ph_1_update_crm_contact_identity'
      )
      and pg_get_functiondef(p.oid) ~ 'vault\\._crypto_aead_det_'
  ) then
    raise exception 'private Vault call remains in active Parent path';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'ph_4a_internal_%'
      and (
        has_function_privilege('anon',p.oid,'EXECUTE')
        or has_function_privilege('authenticated',p.oid,'EXECUTE')
        or has_function_privilege('service_role',p.oid,'EXECUTE')
      )
  ) then
    raise exception 'PH-4A internal helper privilege leaked';
  end if;
end
$qa$;

rollback;
`

psql(qaSql)

assert.equal(scalar(`select count(*) from public.centers where id in (${q(ids.center)},${q(ids.otherCenter)});`), '0')
assert.equal(scalar(`select count(*) from auth.users where id in (${u(ids.owner)},${u(ids.admin)},${u(ids.otherOwner)});`), '0')
assert.equal(scalar(`select count(*) from public.crm_contact where legacy_source_id in (${q(ids.sourceA)},${q(ids.sourceB)},${q(ids.sourceOther)});`), '0')

console.log(`PH_4A_LOCAL_DB_MIGRATION: PASS (${migrationHash})`)
console.log('PH_4A_LOCAL_CONTACT_CREATE_WITH_PRIVATE_VAULT_ACL_0: PASS')
console.log('PH_4A_LOCAL_PROTECT_UNWRAP_WRONG_CONTEXT_TAMPER: PASS')
console.log('PH_4A_LOCAL_OWNER_ADMIN_STALE_IDEMPOTENCY: PASS')
console.log('PH_4A_LOCAL_CROSS_CENTER_READ_0_WRITE_DENIED: PASS')
console.log('PH_4A_LOCAL_DIRECT_DML_AND_INTERNAL_HELPER_ACL_DENIED: PASS')
console.log('PH_4A_LOCAL_STUDENT_TUITION_FINANCE_DIGESTS_UNCHANGED: PASS')
console.log('PH_4A_LOCAL_ACTIVE_PARENT_PRIVATE_VAULT_FUNCTION_CALLS_0: PASS')
console.log('PH_4A_LOCAL_DB_ACTIVE_FIXTURE_RESIDUE_0: PASS')
console.log('PH_4A_HOSTED_VAULT_COMPATIBILITY_FORWARD_FIX_LOCAL_DB_QA: PASS')
