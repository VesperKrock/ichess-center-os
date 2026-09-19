import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { pullC53CrmSharedTruth } from '../src/cloud-authoritative-crm.js'

const consentFlag = 'ICHESS_NEW_CENTER_LOCAL_QA_ALLOW_MUTATION'
const projectSlug = 'ichess-center-os'
const expectedDbContainer = 'supabase_db_ichess-center-os'

assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
assert.equal(process.env[consentFlag], 'YES', `${consentFlag}=YES is required`)
assert(!process.env.SUPABASE_PROJECT_REF, 'Linked Supabase project references are forbidden')

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
  'local Supabase status',
))

for (const key of ['DB_URL', 'API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
  assert.equal(typeof localStatus[key], 'string', `Missing local ${key}`)
}
assert(new Set(['127.0.0.1', 'localhost', '::1']).has(new URL(localStatus.API_URL).hostname))
assert(new Set(['127.0.0.1', 'localhost', '::1']).has(new URL(localStatus.DB_URL).hostname))

const dbRows = requireSuccess(run('docker', [
  'ps',
  '--filter', `label=com.supabase.cli.project=${projectSlug}`,
  '--filter', 'status=running',
  '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
]), 'local DB discovery').trim().split(/\r?\n/).filter(Boolean)
  .map((row) => row.split('|'))
  .filter(([, name]) => name === expectedDbContainer)
assert.equal(dbRows.length, 1, 'Expected exactly one guarded local DB container')
assert(/supabase\/postgres/i.test(dbRows[0][2]))
const dbContainerId = dbRows[0][0]

const psql = (sql) => requireSuccess(run('docker', [
  'exec', '-i', dbContainerId,
  'psql', '-X', '--no-psqlrc', '-U', 'postgres', '-d', 'postgres',
  '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
], { input: sql }), 'local psql').trim()
const q = (value) => `'${String(value).replaceAll("'", "''")}'`

const suffix = randomUUID()
const ownerEmail = `new-center-owner-${suffix}@example.invalid`
const outsiderEmail = `new-center-outsider-${suffix}@example.invalid`
const password = `NewCenter!${randomUUID()}aA1`
const sourceCenterId = `new-center-source-${suffix}`
const targetName = `Control Plane ${suffix}`
const targetSlug = `controlplane${suffix.replaceAll('-', '')}`
const targetCenterId = `${targetSlug}_prod`

const adminClient = createClient(localStatus.API_URL, localStatus.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const makeClient = () => createClient(localStatus.API_URL, localStatus.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

const createUser = async (email) => {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  assert.equal(error, null, `create local user ${email}: ${error?.message}`)
  assert(data.user?.id)
  return data.user
}
const signIn = async (email) => {
  const client = makeClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  assert.equal(error, null, `sign in local user ${email}: ${error?.message}`)
  assert(data.session?.access_token)
  return client
}

const owner = await createUser(ownerEmail)
await createUser(outsiderEmail)

const sourceSnapshot = psql(`
  insert into public.centers(id,name,slug,environment,status)
  values (${q(sourceCenterId)},'New Center QA Authority',${q(sourceCenterId)},'test','active');

  with inserted as (
    insert into public.center_members(center_id,user_id,role,status)
    values (${q(sourceCenterId)},${q(owner.id)}::uuid,'owner','active')
    returning id
  )
  select pg_catalog.set_config(
    'new_center.qa_owner_membership_id',
    (select id::text from inserted),
    false
  );

  select pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object('role','service_role')::text,
    false
  );
  select public.arg2_activate_center_governance(
    ${q(sourceCenterId)},
    pg_catalog.current_setting('new_center.qa_owner_membership_id')::uuid,
    ${q(owner.id)}::uuid,
    null
  );

  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        (select pg_catalog.jsonb_build_object(
          'center', pg_catalog.to_jsonb(center_record),
          'governance', pg_catalog.to_jsonb(governance_record),
          'membership', pg_catalog.to_jsonb(membership_record),
          'crm', pg_catalog.to_jsonb(crm_record),
          'lookup', pg_catalog.to_jsonb(lookup_record)
        )::text
        from public.centers center_record
        join public.center_access_governance governance_record
          on governance_record.center_id = center_record.id
        join public.center_members membership_record
          on membership_record.id = governance_record.canonical_owner_membership_id
        join public.center_crm_control crm_record
          on crm_record.center_id = center_record.id
        join public.crm_contact_lookup_control lookup_record
          on lookup_record.center_id = center_record.id
        where center_record.id = ${q(sourceCenterId)}),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
`).split(/\r?\n/).filter(Boolean).at(-1)
assert.match(sourceSnapshot, /^[0-9a-f]{64}$/)

const ownerClient = await signIn(ownerEmail)
const { data: provisionRows, error: provisionError } = await ownerClient.rpc(
  'provision_center_for_owner',
  { p_center_name: targetName },
)
assert.equal(provisionError, null, `provision local center: ${provisionError?.message}`)
assert.equal(provisionRows?.length, 1)
assert.equal(provisionRows[0].id, targetCenterId)
assert.equal(provisionRows[0].environment, 'production')
assert.equal(provisionRows[0].status, 'active')

const controlPlane = JSON.parse(psql(`
  select pg_catalog.json_build_object(
    'center_count', (select pg_catalog.count(*) from public.centers where id=${q(targetCenterId)}),
    'membership_count', (select pg_catalog.count(*) from public.center_members where center_id=${q(targetCenterId)}),
    'owner_count', (select pg_catalog.count(*) from public.center_members where center_id=${q(targetCenterId)} and role='owner' and status='active'),
    'admin_count', (select pg_catalog.count(*) from public.center_members where center_id=${q(targetCenterId)} and role in ('admin','center_admin') and status='active'),
    'canonical_owner_ok', exists (
      select 1 from public.center_access_governance governance_record
      join public.center_members membership_record
        on membership_record.id=governance_record.canonical_owner_membership_id
       and membership_record.center_id=governance_record.center_id
      where governance_record.center_id=${q(targetCenterId)}
        and governance_record.status='active'
        and governance_record.canonical_admin_membership_id is null
        and membership_record.user_id=${q(owner.id)}::uuid
        and membership_record.role='owner'
        and membership_record.status='active'
    ),
    'owner_gate_ready', exists (
      select 1 from public.account_credential_gates gate_record
      join public.center_members membership_record on membership_record.id=gate_record.membership_id
      where gate_record.center_id=${q(targetCenterId)}
        and gate_record.user_id=${q(owner.id)}::uuid
        and gate_record.credential_state='ready'
        and membership_record.role='owner'
        and membership_record.status='active'
    ),
    'crm_ready', exists (
      select 1 from public.center_crm_control
      where center_id=${q(targetCenterId)}
        and crm_state='ACTIVE'
        and feature_flag_state='ENABLED'
        and control_version=2
    ),
    'lookup_ready', exists (
      select 1 from public.crm_contact_lookup_control
      where center_id=${q(targetCenterId)}
        and rotation_state='ACTIVE'
        and current_key_epoch=1
        and previous_key_epoch is null
        and pending_key_epoch is null
        and control_version=1
    ),
    'trigger_definer', (
      select procedure_record.prosecdef
      from pg_catalog.pg_proc procedure_record
      where procedure_record.oid='public.arg2_internal_enforce_governed_membership()'::regprocedure
    ),
    'trigger_owner', (
      select pg_catalog.pg_get_userbyid(procedure_record.proowner)
      from pg_catalog.pg_proc procedure_record
      where procedure_record.oid='public.arg2_internal_enforce_governed_membership()'::regprocedure
    ),
    'trigger_config', (
      select procedure_record.proconfig
      from pg_catalog.pg_proc procedure_record
      where procedure_record.oid='public.arg2_internal_enforce_governed_membership()'::regprocedure
    ),
    'service_role_governance_select', pg_catalog.has_table_privilege(
      'service_role','public.center_access_governance','select'
    ),
    'governance_force_rls', (
      select class_record.relrowsecurity and class_record.relforcerowsecurity
      from pg_catalog.pg_class class_record
      where class_record.oid='public.center_access_governance'::regclass
    ),
    'crm_force_rls', (
      select class_record.relrowsecurity and class_record.relforcerowsecurity
      from pg_catalog.pg_class class_record
      where class_record.oid='public.center_crm_control'::regclass
    ),
    'lookup_force_rls', (
      select class_record.relrowsecurity and class_record.relforcerowsecurity
      from pg_catalog.pg_class class_record
      where class_record.oid='public.crm_contact_lookup_control'::regclass
    )
  );
`))

assert.equal(controlPlane.center_count, 1)
assert.equal(controlPlane.membership_count, 1)
assert.equal(controlPlane.owner_count, 1)
assert.equal(controlPlane.admin_count, 0)
assert.equal(controlPlane.canonical_owner_ok, true)
assert.equal(controlPlane.owner_gate_ready, true)
assert.equal(controlPlane.crm_ready, true)
assert.equal(controlPlane.lookup_ready, true)
assert.equal(controlPlane.trigger_definer, true)
assert.equal(controlPlane.trigger_owner, 'postgres')
assert.deepEqual(controlPlane.trigger_config, ['search_path=""'])
assert.equal(controlPlane.service_role_governance_select, false)
assert.equal(controlPlane.governance_force_rls, true)
assert.equal(controlPlane.crm_force_rls, true)
assert.equal(controlPlane.lookup_force_rls, true)

const crmResult = await pullC53CrmSharedTruth({
  supabase: ownerClient,
  centerId: targetCenterId,
})
assert.equal(crmResult.ok, true, `Customer/CRM empty load failed: ${crmResult.error}`)
assert.deepEqual(crmResult.records, [])

const outsiderClient = await signIn(outsiderEmail)
const outsiderResult = await pullC53CrmSharedTruth({
  supabase: outsiderClient,
  centerId: targetCenterId,
})
assert.equal(outsiderResult.ok, false, 'Unrelated account crossed the exact-center CRM boundary')

const sourceSnapshotAfter = psql(`
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(
        (select pg_catalog.jsonb_build_object(
          'center', pg_catalog.to_jsonb(center_record),
          'governance', pg_catalog.to_jsonb(governance_record),
          'membership', pg_catalog.to_jsonb(membership_record),
          'crm', pg_catalog.to_jsonb(crm_record),
          'lookup', pg_catalog.to_jsonb(lookup_record)
        )::text
        from public.centers center_record
        join public.center_access_governance governance_record
          on governance_record.center_id = center_record.id
        join public.center_members membership_record
          on membership_record.id = governance_record.canonical_owner_membership_id
        join public.center_crm_control crm_record
          on crm_record.center_id = center_record.id
        join public.crm_contact_lookup_control lookup_record
          on lookup_record.center_id = center_record.id
        where center_record.id = ${q(sourceCenterId)}),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
`)
assert.equal(sourceSnapshotAfter, sourceSnapshot, 'Existing center control-plane state changed')

console.log('NEW_CENTER_CONTROL_PLANE_LOCAL_DB_QA: PASS')
