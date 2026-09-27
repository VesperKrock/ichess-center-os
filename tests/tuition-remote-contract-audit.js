import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

// Read-only remote schema/data audit. No migrations or business commands.
const before = JSON.parse(fs.readFileSync('artifacts/tuition-real-remote/remote-contract-before.json', 'utf8'))
const connection = new URL(fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim())
const password = fs.readFileSync('matkhausupabase.txt', 'utf8').trim()
assert(!connection.password && password)
const tables = { entities: 'center_cloud_entities', cycles: 'center_tuition_package_cycles', finance: 'finance_transaction', receipts: 'center_tuition_receipts' }
const aggregations = Object.entries(tables).map(([key, table]) => `'${key}',(select jsonb_build_object(
  'count',count(*),
  'fingerprint',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by ${key === 'entities' ? 'entity_type,local_id' : 'id'}),''))
) from public.${table} t where center_id='dreamhome')`).join(',')
const sql = `begin read only;
  select jsonb_build_object(
    'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations where version between '202609260001' and '202609270004'),
    'cycleHelper',(select prosrc from pg_proc where oid='public.tuition_final_cycle_json(text,uuid,jsonb)'::regprocedure),
    'cycleRead',pg_get_functiondef('public.v2_4_list_package_cycle_state(text)'::regprocedure),
    'readDelegates',(select jsonb_object_agg(proname,pg_get_functiondef(oid)) from pg_proc where pronamespace='public'::regnamespace and (proname like 'v2_4_list_package_cycle_state%' or proname='v2_4_can_read_center')),
    'cycleProjection',pg_get_viewdef('public.center_tuition_package_cycle_projection'::regclass,true),
    'snapshot',jsonb_build_object(${aggregations})
  ); rollback;`
const command = spawnSync('docker', ['exec', '-i', '-e', 'PGPASSWORD', 'supabase_db_ichess-center-os',
  'psql', '-X', '--no-psqlrc', '-v', 'ON_ERROR_STOP=1', '-d', connection.href, '-q', '-A', '-t'],
{ env: { ...process.env, PGPASSWORD: password }, input: sql, encoding: 'utf8', windowsHide: true, timeout: 30000 })
assert.equal(command.status, 0, command.stderr?.replaceAll(password, '[REDACTED]'))
const after = JSON.parse(command.stdout.trim())
const whitespace = text => text.replace(/\s+/g, ' ').trim()
assert.equal(whitespace(after.cycleHelper), whitespace(before.cycleHelper))
assert.equal(whitespace(after.cycleRead), whitespace(before.cycleRead))
assert.deepEqual(after.migrations, before.migrations)
const helperExpected = fs.readFileSync('supabase/migrations/202609270004_tuition_payment_snapshot_identity.sql', 'utf8').match(/as \$function\$([\s\S]*?)\$function\$/i)[1]
assert.equal(whitespace(after.cycleHelper), whitespace(helperExpected))
const wrapperExpected = fs.readFileSync('supabase/migrations/202609270001_tuition_final_business_alignment.sql', 'utf8')
  .match(/create function public\.v2_4_list_package_cycle_state\([\s\S]*?as \$function\$([\s\S]*?)\$function\$/i)[1]
assert.equal(whitespace(after.cycleRead.match(/AS \$function\$([\s\S]*?)\$function\$/i)[1]), whitespace(wrapperExpected))
after.fingerprintsUnchanged = {}
for (const key of Object.keys(tables)) {
  assert.equal(after.snapshot[key].count, before.counts[key])
  assert.equal(after.snapshot[key].fingerprint, before.fingerprints[key], `Remote ${key} changed during QA`)
  after.fingerprintsUnchanged[key] = true
}
after.helperMatchesExpected = true
after.readWrapperMatchesExpected = true
after.migrationApplied = false
fs.writeFileSync('artifacts/tuition-real-remote/remote-contract-after.json', JSON.stringify(after, null, 2))
console.log(JSON.stringify({ migrationApplied: false, migrationsUnchanged: true, definitionsMatchLocal: true,
  businessFingerprintsUnchanged: after.fingerprintsUnchanged,
  counts: Object.fromEntries(Object.entries(after.snapshot).map(([key, value]) => [key, value.count])) }, null, 2))
