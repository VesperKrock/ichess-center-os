import fs from 'node:fs'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

// A pinned local Docker container only. No URL, production key or remote client.
const container = 'supabase_db_ichess-center-os'
const inspect = spawnSync('docker', ['inspect', container], { encoding: 'utf8', windowsHide: true })
assert.equal(inspect.status, 0, inspect.stderr)
const info = JSON.parse(inspect.stdout)[0]
assert.equal(info.Name, '/' + container)
assert(info.NetworkSettings.Ports['5432/tcp'].some(p => p.HostPort === '54322'))
const psql = sql => spawnSync('docker', ['exec', '-i', container, 'psql', '-X', '--no-psqlrc',
  '-v', 'ON_ERROR_STOP=1', '-U', 'supabase_admin', '-d', 'postgres', '-q', '-A', '-t'],
{ input: sql, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
const restorationQuery = "select (select installation_state from public.installation_handoff_control where singleton_id=1), to_regclass('public.center_tuition_initial_import_baselines'), (select count(*) from public.centers where id in ('recurring_local_qa','recurring_other_qa')), exists(select 1 from pg_attribute where attrelid='public.center_tuition_package_cycles'::regclass and attname='recurring_discount_policy' and not attisdropped);"
const beforeRestoration = psql(restorationQuery)
assert.equal(beforeRestoration.status, 0, beforeRestoration.stderr)
const strip = sql => sql.replace(/\r\n/g, '\n').replace(/^(begin|commit|rollback);\s*$/gmi, '')
const dependencies = [
  '202609260001_tuition_simple_core.sql',
  '202609260002_tuition_simple_core_early_payment.sql',
  '202609270001_tuition_final_business_alignment.sql',
  '202609270002_tuition_final_legacy_package_lock.sql',
  '202609270003_tuition_final_initial_package_change_terms.sql',
  '202609270004_tuition_payment_snapshot_identity.sql',
  '202609270005_tuition_definitive_initial_setup.sql',
  '202610150001_verified_initial_import_baseline.sql',
  '202610150002_initial_import_cutoff_projection.sql',
  '202610160001_adopt_current_initial_baseline.sql',
]
const versions = psql('select version from supabase_migrations.schema_migrations;')
assert.equal(versions.status, 0, versions.stderr)
const installed = new Set(versions.stdout.trim().split(/\s+/))
const fixtureSource = fs.readFileSync('tests/tuition-recurring-discount-policy-local-db-qa.sql', 'utf8')
const preimageFixture = fixtureSource.match(/-- PREIMAGE_FIXTURE_BEGIN\r?\n([\s\S]*?)\r?\n-- PREIMAGE_FIXTURE_END\r?\n/)
assert(preimageFixture, 'Pinned previously released preimage must be bundled in the local test')
const bootstrap = dependencies.filter(f => !installed.has(f.split('_')[0]))
  .map(f => strip(fs.readFileSync('supabase/migrations/' + f, 'utf8'))).join('\n')
  + (installed.has('202610160002') ? '' : '\n' + strip(preimageFixture[1]))
const migration = strip(fs.readFileSync('supabase/migrations/202610170001_recurring_discount_policy.sql', 'utf8'))
const fixture = fixtureSource.slice(preimageFixture.index + preimageFixture[0].length)
const prelude = [
  'begin;',
  'grant execute on function vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea) to postgres;',
  'grant execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) to postgres;',
  'grant execute on function vault._crypto_aead_det_noncegen() to postgres;',
  'set local role postgres;',
  // Local fixture provisioning follows the existing installation transition.
  // All business RPC tests below switch to the authenticated center Admin.
  "select set_config('request.jwt.claims','{\"sub\":\"17101700-0000-4000-8000-000000009001\",\"role\":\"service_role\"}',true);",
  "select set_config('app.chb1_internal_transition','on',true);",
  bootstrap,
  'create temp table recurring_function_contract_before as select oid,proargtypes,prorettype,proowner,proacl,prosecdef,proconfig from pg_proc where oid in (',
  "'public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure, 'public.tuition_final_guard_cycle_terms()'::regprocedure, 'public.tuition_final_cycle_json(text,uuid,jsonb)'::regprocedure);",
].join('\n')
export const recurringLocalQaSetup = [
  prelude,
  migration,
  fixture,
].join('\n')
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const setup = recurringLocalQaSetup + '\nrollback;'
const result = psql(setup)
assert.equal(result.status, 0, result.stderr + '\n' + result.stdout)
assert(fixture, 'Integration fixture is required before this test can PASS')
assert.match(result.stdout, /RECURRING_POLICY_DB_QA_PASS/)
assert.match(result.stdout, /AUTHENTICATED_WRITE_PASS/)
const evidenceLine = result.stdout.split('\n').find(line => line.startsWith('{"students":') || line.startsWith('{"post_functions":') || line.startsWith('{"canonical_snapshot":'))
assert(evidenceLine, 'Native local snapshot required')
const nativeEvidence = JSON.parse(evidenceLine)
assert(nativeEvidence.canonical_snapshot.ok && nativeEvidence.post_functions.length === 4)
const evidenceDirectory = 'artifacts/R3A/tanbinh-partial-plan-1d9cd1cd/R3B/Batch-B/B2/R2/implementation/evidence'
fs.mkdirSync(evidenceDirectory, { recursive: true })
fs.writeFileSync(evidenceDirectory + '/local-native-snapshot.json', JSON.stringify(nativeEvidence, null, 2) + '\n')
const drift = psql([prelude,
  "do $drift$ declare d text; begin d:=pg_get_functiondef('public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure); execute replace(d,'student text:=','student text :='); end $drift$;",
  migration, 'rollback;'].join('\n'))
assert.notEqual(drift.status, 0, 'Changed preimage must stop migration')
assert.match(drift.stderr, /RECURRING_POLICY_PREIMAGE_DRIFT/)
const restored = psql(restorationQuery)
assert.equal(restored.status, 0, restored.stderr)
assert.equal(restored.stdout, beforeRestoration.stdout)
console.log(result.stdout.split('\n').filter(line => /_PASS/.test(line)).join('\n'))
console.log('PREIMAGE_DRIFT_REJECTED_PASS; LOCAL_SCHEMA_FIXTURES_AND_INSTALLATION_RESTORED_PASS')
console.log('LOCAL_RECURRING_POLICY_INTEGRATION_PASS: pinned local DB; schema/fixtures rolled back; production operations=0')
}
