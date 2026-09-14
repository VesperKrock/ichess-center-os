import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

assert.equal(process.argv.length, 2, 'This local QA runner accepts no arguments')
assert(!process.env.SUPABASE_PROJECT_REF, 'A linked/remote project reference is forbidden')

const migrationPath = 'supabase/migrations/202609140001_v2_8a_attendance_operational_hardening.sql'
const qaPath = 'tests/v2-8a-attendance-operational-hardening-local-db-qa.sql'
const migration = readFileSync(migrationPath)
const qa = readFileSync(qaPath)
const migrationHash = createHash('sha256').update(migration).digest('hex').toUpperCase()

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
const cliArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npx --no-install supabase status -o json']
  : ['--no-install', 'supabase', 'status', '-o', 'json']
const localStatus = JSON.parse(requireSuccess(run(cliCommand, cliArgs), 'local Supabase status'))
for (const endpoint of [localStatus.DB_URL, localStatus.API_URL]) {
  assert(new Set(['127.0.0.1', 'localhost', '::1']).has(new URL(endpoint).hostname.toLowerCase()),
    'V2-8A QA endpoint must be loopback')
}

const discovery = requireSuccess(run('docker', [
  'ps', '--filter', 'label=com.supabase.cli.project=ichess-center-os',
  '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
]), 'local Docker discovery').trim().split(/\r?\n/).filter(Boolean)
  .map((line) => line.split('|'))
  .filter(([, name]) => name === 'supabase_db_ichess-center-os')
assert.equal(discovery.length, 1, 'Expected exactly one guarded local database container')
assert(/supabase\/postgres/i.test(discovery[0][2]))

const psqlArgs = [
  'exec', '-i', discovery[0][0], 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql, label = 'local psql') => requireSuccess(
  run('docker', psqlArgs, { input: sql }), label,
).trim()

const prerequisiteMigrations = [
  {
    probe: "select to_regclass('public.center_tuition_package_catalog') is not null;",
    path: 'supabase/migrations/202609080001_v2_1_center_settings_foundation.sql',
  },
  {
    probe: "select to_regprocedure('public.v2_2_list_student_enrollments(text)') is not null;",
    path: 'supabase/migrations/202609090001_v2_2_student_individualized_recurring_enrollment.sql',
  },
  {
    probe: "select to_regprocedure('public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)') is not null;",
    path: 'supabase/migrations/202609100001_v2_3_schedule_occurrence_attendance_authority.sql',
  },
  {
    probe: "select to_regprocedure('public.v2_4_list_package_cycle_state(text)') is not null;",
    path: 'supabase/migrations/202609110001_v2_4_package_cycle_bcht_provisional_renewal.sql',
  },
]
for (const prerequisite of prerequisiteMigrations) {
  if (psql(prerequisite.probe) !== 't') {
    psql(readFileSync(prerequisite.path), `apply local prerequisite ${prerequisite.path}`)
  }
}
if (psql("select to_regprocedure('public.v2_8a_list_attendance_operations(text)') is not null;") !== 't') {
  psql(migration, 'apply V2-8A migration to local DB')
}
psql("notify pgrst, 'reload schema';")

const protectedDigestSql = `select encode(extensions.digest(convert_to(jsonb_build_object(
  'entities',coalesce((select jsonb_agg(to_jsonb(e) order by e.center_id,e.entity_type,e.local_id)
    from public.center_cloud_entities e where e.center_id not like 'v28a_qa_%'),'[]'::jsonb),
  'cycles',coalesce((select jsonb_agg(to_jsonb(c) order by c.center_id,c.student_local_id,c.cycle_number)
    from public.center_tuition_package_cycles c where c.center_id not like 'v28a_qa_%'),'[]'::jsonb),
  'contributions',coalesce((select jsonb_agg(to_jsonb(x) order by x.center_id,x.id)
    from public.center_tuition_attendance_contributions x where x.center_id not like 'v28a_qa_%'),'[]'::jsonb),
  'finance',coalesce((select jsonb_agg(to_jsonb(f) order by f.center_id,f.id)
    from public.finance_transaction f where f.center_id not like 'v28a_qa_%'),'[]'::jsonb),
  'calendar_notes',coalesce((select jsonb_agg(to_jsonb(n) order by n.center_id,n.id)
    from public.center_operational_attendance_notes n where n.center_id not like 'v28a_qa_%'),'[]'::jsonb)
)::text,'UTF8'),'sha256'),'hex');`
const before = psql(protectedDigestSql)
const qaOutput = psql(qa, 'transactional V2-8A local DB QA')
assert(qaOutput.includes('V2_8A_LOCAL_DB_TRANSACTIONAL_QA: PASS'))
const after = psql(protectedDigestSql)
assert.equal(after, before, 'V2-8A QA changed pre-existing business truth')

const residue = JSON.parse(psql(`select jsonb_build_object(
  'centers',(select count(*) from public.centers where id like 'v28a_qa_%'),
  'members',(select count(*) from public.center_members where center_id like 'v28a_qa_%'),
  'entities',(select count(*) from public.center_cloud_entities where center_id like 'v28a_qa_%'),
  'cycles',(select count(*) from public.center_tuition_package_cycles where center_id like 'v28a_qa_%'),
  'contributions',(select count(*) from public.center_tuition_attendance_contributions where center_id like 'v28a_qa_%'),
  'checkpoints',(select count(*) from public.center_attendance_cycle_checkpoints where center_id like 'v28a_qa_%'),
  'notes',(select count(*) from public.center_attendance_occurrence_notes where center_id like 'v28a_qa_%'),
  'commands',(select count(*) from public.center_attendance_operation_command_results where center_id like 'v28a_qa_%'),
  'audit',(select count(*) from public.center_attendance_operation_audit_events where center_id like 'v28a_qa_%'),
  'finance',(select count(*) from public.finance_transaction where center_id like 'v28a_qa_%'),
  'users',(select count(*) from auth.users where id::text like '28000000-0000-4000-8000-00000000000%')
);`))
assert.deepEqual(residue, {
  centers: 0,
  members: 0,
  entities: 0,
  cycles: 0,
  contributions: 0,
  checkpoints: 0,
  notes: 0,
  commands: 0,
  audit: 0,
  finance: 0,
  users: 0,
})

console.log(`V2_8A_ATTENDANCE_OPERATIONAL_HARDENING_LOCAL_DB_QA: PASS (${migrationHash}, residue=0)`)
