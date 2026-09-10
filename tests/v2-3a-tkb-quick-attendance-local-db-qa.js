import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainer = 'supabase_db_ichess-center-os'
assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
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
const cli = process.platform === 'win32' ? process.env.ComSpec : 'npx'
const cliArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npx --no-install supabase status -o json']
  : ['--no-install', 'supabase', 'status', '-o', 'json']
const status = JSON.parse(requireSuccess(run(cli, cliArgs), 'local Supabase status'))
assertLoopback(status.DB_URL, 'local DB')
assertLoopback(status.API_URL, 'local API')

const discovery = requireSuccess(run('docker', [
  'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
  '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
]), 'Docker discovery').trim().split(/\r?\n/).filter(Boolean)
  .map((line) => line.split('|')).filter(([, name]) => name === expectedContainer)
assert.equal(discovery.length, 1, 'Expected exactly one guarded local DB container')
assert(/supabase\/postgres/i.test(discovery[0][2]))
const containerId = discovery[0][0]
const psql = (sql, label = 'psql') => requireSuccess(run('docker', [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
], { input: sql }), label).trim()

assert.equal(psql("select to_regprocedure('public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)') is not null;"), 't',
  'V2-3 migration must be applied to local DB before QA')
assert.equal(psql("select to_regprocedure('public.v2_2_list_student_enrollments(text)') is not null;"), 't')

const migrationPath = 'supabase/migrations/202609100001_v2_3_schedule_occurrence_attendance_authority.sql'
const migrationHash = createHash('sha256').update(readFileSync(migrationPath)).digest('hex').toUpperCase()
const qa = readFileSync('tests/v2-3a-tkb-quick-attendance-local-db-qa.sql', 'utf8')
const protectedDigestSql = `select encode(extensions.digest(convert_to(coalesce(string_agg(
  jsonb_build_object('center',center_id,'type',entity_type,'local',local_id,'payload',payload,
    'version',entity_version,'deleted',deleted_at)::text, '' order by center_id,entity_type,local_id), ''),
  'UTF8'), 'sha256'), 'hex') from public.center_cloud_entities
  where center_id not like 'v23_qa_%' and entity_type in
    ('student','teacher','class_session','schedule_session','attendance_record','attendance_baseline_state',
     'session_report','tuition_record_package');`
const before = psql(protectedDigestSql)
psql(qa, 'transactional V2-3 local DB QA')
const after = psql(protectedDigestSql)
assert.equal(after, before, 'V2-3 QA changed pre-existing Student/Schedule/Attendance/Tuition history')

const residue = JSON.parse(psql(`select jsonb_build_object(
  'centers',(select count(*) from public.centers where id like 'v23_qa_%'),
  'members',(select count(*) from public.center_members where center_id like 'v23_qa_%'),
  'entities',(select count(*) from public.center_cloud_entities where center_id like 'v23_qa_%'),
  'commands',(select count(*) from public.center_occurrence_attendance_command_results where center_id like 'v23_qa_%'),
  'c52_commands',(select count(*) from public.center_operational_command_result where center_id like 'v23_qa_%'),
  'fault_function',to_regprocedure('public.v2_3_qa_force_finalize_failure()') is not null
);`))
assert.deepEqual(residue, {
  centers: 0, members: 0, entities: 0, commands: 0, c52_commands: 0, fault_function: false,
})

console.log(`V2_3A_TKB_QUICK_ATTENDANCE_LOCAL_DB_QA: PASS (${migrationHash}, residue=0)`)
