import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

assert.equal(process.argv.length, 2, 'This local QA runner accepts no arguments')
assert(!process.env.SUPABASE_PROJECT_REF, 'A linked/remote project reference is forbidden')

const migrationPath = 'supabase/migrations/202609120001_v2_6_teacher_registry_multicenter_authority.sql'
const qaPath = 'tests/v2-6a-teacher-registry-multicenter-local-db-qa.sql'
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
    'V2-6 QA endpoint must be loopback')
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
  'centers',to_regclass('public.centers') is not null,
  'members',to_regclass('public.center_members') is not null,
  'core',to_regclass('public.center_cloud_entities') is not null,
  'users',(select count(*) from auth.users)
);`))
assert.deepEqual(
  { centers: prerequisites.centers, members: prerequisites.members, core: prerequisites.core },
  { centers: true, members: true, core: true },
)
assert(prerequisites.users >= 4)

if (psql("select to_regprocedure('public.v2_6_list_teacher_registry(text)') is not null;") !== 't') {
  psql(migration, 'apply V2-6 migration to local DB')
}

const protectedDigestSql = `select encode(extensions.digest(convert_to(coalesce(string_agg(
  jsonb_build_object('center',center_id,'type',entity_type,'local',local_id,'payload',payload,
    'version',entity_version,'deleted',deleted_at)::text, '' order by center_id,entity_type,local_id), ''),
  'UTF8'), 'sha256'), 'hex') from public.center_cloud_entities
  where center_id not like 'v26_qa_%';`
const before = psql(protectedDigestSql)
psql(qa, 'transactional V2-6 local DB QA')
const after = psql(protectedDigestSql)
assert.equal(after, before, 'V2-6 QA changed pre-existing center business truth')

const residue = JSON.parse(psql(`select jsonb_build_object(
  'centers',(select count(*) from public.centers where id like 'v26_qa_%'),
  'members',(select count(*) from public.center_members where center_id like 'v26_qa_%'),
  'entities',(select count(*) from public.center_cloud_entities where center_id like 'v26_qa_%'),
  'teachers',(select count(*) from public.canonical_teacher_registry
    where email like '%@example.test'),
  'assignments',(select count(*) from public.teacher_center_assignments a
    join public.centers c on c.id=a.center_id where c.id like 'v26_qa_%'),
  'events',(select count(*) from public.teacher_registry_events e
    where e.from_center_id like 'v26_qa_%' or e.to_center_id like 'v26_qa_%'),
  'commands',(select count(*) from public.teacher_registry_command_results
    where context_center_id like 'v26_qa_%')
);`))
assert.deepEqual(residue, {
  centers: 0, members: 0, entities: 0, teachers: 0,
  assignments: 0, events: 0, commands: 0,
})

const security = JSON.parse(psql(`select jsonb_build_object(
  'rls',(select count(*) from pg_class where oid in (
    'public.canonical_teacher_registry'::regclass,
    'public.teacher_center_assignments'::regclass,
    'public.teacher_registry_events'::regclass,
    'public.teacher_registry_command_results'::regclass
  ) and relrowsecurity and relforcerowsecurity),
  'browser_table_privileges',(select count(*) from information_schema.role_table_grants
    where grantee in ('anon','authenticated') and table_schema='public'
      and table_name in ('canonical_teacher_registry','teacher_center_assignments',
        'teacher_registry_events','teacher_registry_command_results')),
  'public_helper_execute',(select count(*) from information_schema.routine_privileges
    where grantee in ('PUBLIC','anon','authenticated') and routine_schema='public'
      and routine_name like 'v2_6_internal_%'),
  'legacy_teacher_bypass_execute',(select count(*) from information_schema.routine_privileges
    where grantee in ('PUBLIC','anon','authenticated','service_role') and routine_schema='public'
      and routine_name='c5_1_internal_mutate_core_entity_pre_v26')
);`))
assert.deepEqual(security, {
  rls: 4, browser_table_privileges: 0, public_helper_execute: 0,
  legacy_teacher_bypass_execute: 0,
})

console.log(`V2_6A_TEACHER_REGISTRY_LOCAL_DB_QA: PASS (${migrationHash}, residue=0)`)
