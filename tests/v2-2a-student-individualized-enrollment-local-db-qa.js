import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

assert.equal(process.argv.length, 2, 'This local QA runner accepts no arguments')
assert(!process.env.SUPABASE_PROJECT_REF, 'A linked/remote project reference is forbidden')

const migrationPath = 'supabase/migrations/202609090001_v2_2_student_individualized_recurring_enrollment.sql'
const qaPath = 'tests/v2-2a-student-individualized-enrollment-local-db-qa.sql'
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
const cliArgs = (tail) => process.platform === 'win32'
  ? ['/d', '/s', '/c', `npx --no-install supabase ${tail}`]
  : ['--no-install', 'supabase', ...tail.split(' ')]

const localStatus = JSON.parse(requireSuccess(
  run(cliCommand, cliArgs('status -o json')),
  'local Supabase status',
))
for (const key of ['DB_URL', 'API_URL']) assert.equal(typeof localStatus[key], 'string')
for (const [label, url] of [['DB', localStatus.DB_URL], ['API', localStatus.API_URL]]) {
  assert(new Set(['127.0.0.1', 'localhost', '::1']).has(new URL(url).hostname.toLowerCase()),
    `${label} endpoint must be loopback`)
}

const projectSlug = 'ichess-center-os'
const expectedContainer = 'supabase_db_ichess-center-os'
const discovery = requireSuccess(run('docker', [
  'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
  '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
]), 'local Docker discovery')
const rows = discovery.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
  .filter(([, name]) => name === expectedContainer)
assert.equal(rows.length, 1, 'Expected exactly one running local ichess-center-os DB container')
assert(/supabase\/postgres/i.test(rows[0][2]))
const containerId = rows[0][0]
const psqlArgs = [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql, label = 'local psql') => requireSuccess(
  run('docker', psqlArgs, { input: sql }), label,
).trim()

const prerequisite = psql(`
select jsonb_build_object(
  'database', current_database(),
  'local_socket', inet_server_addr() is null,
  'core', to_regclass('public.center_cloud_entities') is not null,
  'c5_rpc', to_regprocedure('public.c5_1_mutate_core_entity(text,text,text,bigint,jsonb,uuid,text)') is not null,
  'auth_users', (select count(*) from auth.users)
);`)
const prerequisiteResult = JSON.parse(prerequisite)
assert.equal(prerequisiteResult.database, 'postgres')
assert.equal(prerequisiteResult.local_socket, true)
assert.equal(prerequisiteResult.core, true)
assert.equal(prerequisiteResult.c5_rpc, true)
assert(prerequisiteResult.auth_users >= 4)

const migrationPresent = psql(
  "select to_regprocedure('public.v2_2_list_student_enrollments(text)') is not null;",
) === 't'
if (!migrationPresent) psql(migration, 'apply V2-2 migration to local DB')

const storageBefore = psql("select count(*) from storage.objects;")
const attendanceHistoryDigestSql = `
select jsonb_build_object(
  'entity_count', count(*),
  'entity_digest', encode(extensions.digest(convert_to(
    coalesce(string_agg(to_jsonb(e)::text, '' order by e.id), ''), 'UTF8'
  ), 'sha256'), 'hex'),
  'note_count', (select count(*) from public.center_operational_attendance_notes),
  'note_digest', (select encode(extensions.digest(convert_to(
    coalesce(string_agg(to_jsonb(n)::text, '' order by n.id), ''), 'UTF8'
  ), 'sha256'), 'hex') from public.center_operational_attendance_notes n)
)
from public.center_cloud_entities e
where e.entity_type in ('attendance_record', 'attendance_baseline_state', 'session_report', 'tuition_record_package');`
const attendanceHistoryBefore = psql(attendanceHistoryDigestSql)
psql(qa, 'transactional V2-2 local DB QA')
const residue = JSON.parse(psql(`
select jsonb_build_object(
  'centers', (select count(*) from public.centers where id like 'v22_qa_%'),
  'members', (select count(*) from public.center_members where center_id like 'v22_qa_%'),
  'core', (select count(*) from public.center_cloud_entities where center_id like 'v22_qa_%'),
  'sets', (select count(*) from public.center_student_enrollment_sets where center_id like 'v22_qa_%'),
  'rows', (select count(*) from public.center_student_recurring_enrollments where center_id like 'v22_qa_%'),
  'commands', (select count(*) from public.center_student_enrollment_command_results where center_id like 'v22_qa_%'),
  'audit', (select count(*) from public.center_student_enrollment_audit_events where center_id like 'v22_qa_%'),
  'fault_function', to_regprocedure('public.v2_2_qa_force_audit_failure()') is not null
);`))
assert.deepEqual(residue, {
  centers: 0, members: 0, core: 0, sets: 0, rows: 0, commands: 0, audit: 0,
  fault_function: false,
})
assert.equal(psql('select count(*) from storage.objects;'), storageBefore,
  'V2-2 QA changed local Storage objects')
assert.equal(psql(attendanceHistoryDigestSql), attendanceHistoryBefore,
  'V2-2 QA changed past Attendance/Tuition/history truth')

console.log(`V2_2A_STUDENT_INDIVIDUALIZED_ENROLLMENT_LOCAL_DB_QA: PASS (${migrationHash}, residue=0)`)
