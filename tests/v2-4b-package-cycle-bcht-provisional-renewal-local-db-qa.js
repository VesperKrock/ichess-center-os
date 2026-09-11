import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

assert.equal(process.argv.length, 2, 'This local QA runner accepts no arguments')
assert(!process.env.SUPABASE_PROJECT_REF, 'A linked/remote project reference is forbidden')

const migrationPath = 'supabase/migrations/202609110001_v2_4_package_cycle_bcht_provisional_renewal.sql'
const qaPath = 'tests/v2-4b-package-cycle-bcht-provisional-renewal-local-db-qa.sql'
const migration = readFileSync(migrationPath)
const qa = readFileSync(qaPath)
const migrationHash = createHash('sha256').update(migration).digest('hex').toUpperCase()

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
const cliArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npx --no-install supabase status -o json']
  : ['--no-install', 'supabase', 'status', '-o', 'json']
const localStatus = JSON.parse(requireSuccess(run(cliCommand, cliArgs), 'local Supabase status'))
for (const url of [localStatus.DB_URL, localStatus.API_URL]) {
  assert(new Set(['127.0.0.1', 'localhost', '::1']).has(new URL(url).hostname.toLowerCase()),
    'V2-4 QA endpoint must be loopback')
}

const expectedContainer = 'supabase_db_ichess-center-os'
const discovery = requireSuccess(run('docker', [
  'ps', '--filter', 'label=com.supabase.cli.project=ichess-center-os',
  '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
]), 'local Docker discovery').trim().split(/\r?\n/).filter(Boolean)
  .map((line) => line.split('|')).filter(([, name]) => name === expectedContainer)
assert.equal(discovery.length, 1, 'Expected exactly one guarded local database container')
assert(/supabase\/postgres/i.test(discovery[0][2]))
const psqlArgs = [
  'exec', '-i', discovery[0][0], 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql, label = 'local psql') => requireSuccess(
  run('docker', psqlArgs, { input: sql }), label,
).trim()

const prerequisites = JSON.parse(psql(`select jsonb_build_object(
  'v21',to_regclass('public.center_tuition_package_catalog') is not null,
  'v22',to_regprocedure('public.v2_2_list_student_enrollments(text)') is not null,
  'v23',to_regprocedure('public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)') is not null,
  'users',(select count(*) from auth.users)
);`))
assert.deepEqual({ v21: prerequisites.v21, v22: prerequisites.v22, v23: prerequisites.v23 },
  { v21: true, v22: true, v23: true })
assert(prerequisites.users >= 4)

if (psql("select to_regprocedure('public.v2_4_list_package_cycle_state(text)') is not null;") !== 't') {
  psql(migration, 'apply V2-4 migration to local DB')
}

const protectedDigestSql = `select encode(extensions.digest(convert_to(coalesce(string_agg(
  jsonb_build_object('center',center_id,'type',entity_type,'local',local_id,'payload',payload,
    'version',entity_version,'deleted',deleted_at)::text, '' order by center_id,entity_type,local_id), ''),
  'UTF8'), 'sha256'), 'hex') from public.center_cloud_entities
  where center_id not like 'v24_qa_%' and entity_type in
    ('student','teacher','class_session','schedule_session','attendance_record',
     'attendance_baseline_state','session_report','tuition_record_package');`
const financeDigestSql = `select encode(extensions.digest(convert_to(coalesce(string_agg(
  to_jsonb(f)::text, '' order by f.id), ''), 'UTF8'), 'sha256'), 'hex')
  from public.finance_transaction f where center_id not like 'v24_qa_%';`
const before = { core: psql(protectedDigestSql), finance: psql(financeDigestSql) }
psql(qa, 'transactional V2-4 local DB QA')
const after = { core: psql(protectedDigestSql), finance: psql(financeDigestSql) }
assert.deepEqual(after, before, 'V2-4 QA changed pre-existing business truth')

const residue = JSON.parse(psql(`select jsonb_build_object(
  'centers',(select count(*) from public.centers where id like 'v24_qa_%'),
  'members',(select count(*) from public.center_members where center_id like 'v24_qa_%'),
  'entities',(select count(*) from public.center_cloud_entities where center_id like 'v24_qa_%'),
  'catalog',(select count(*) from public.center_tuition_package_catalog where center_id like 'v24_qa_%'),
  'cycles',(select count(*) from public.center_tuition_package_cycles where center_id like 'v24_qa_%'),
  'contributions',(select count(*) from public.center_tuition_attendance_contributions where center_id like 'v24_qa_%'),
  'commands',(select count(*) from public.center_tuition_cycle_command_results where center_id like 'v24_qa_%'),
  'audit',(select count(*) from public.center_tuition_cycle_audit_events where center_id like 'v24_qa_%'),
  'finance',(select count(*) from public.finance_transaction where center_id like 'v24_qa_%')
);`))
assert.deepEqual(residue, {
  centers: 0, members: 0, entities: 0, catalog: 0, cycles: 0,
  contributions: 0, commands: 0, audit: 0, finance: 0,
})

console.log(`V2_4B_PACKAGE_CYCLE_LOCAL_DB_QA: PASS (${migrationHash}, residue=0)`)
