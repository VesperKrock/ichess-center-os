import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const projectSlug = 'ichess-center-os'
const expectedContainer = 'supabase_db_ichess-center-os'
const migrationPath = 'supabase/migrations/202608210004_c5_1_dreamhome_prod_schedule_identity_normalization.sql'
const migration = readFileSync(migrationPath, 'utf8')

assert.equal(process.argv.length, 2, 'This runner accepts no arguments')
assert(!process.env.SUPABASE_PROJECT_REF, 'Linked Supabase project references are forbidden')

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(), encoding: 'utf8', windowsHide: true,
    maxBuffer: 32 * 1024 * 1024, ...options,
  })
  if (result.error) throw result.error
  return result
}
const requireSuccess = (result, label) => {
  if (result.status !== 0) throw new Error(`${label}: ${result.stdout}\n${result.stderr}`)
  return result.stdout
}
const containerRows = requireSuccess(run('docker', [
  'ps', '--filter', `label=com.supabase.cli.project=${projectSlug}`,
  '--filter', 'status=running', '--format', '{{.ID}}|{{.Names}}|{{.Image}}',
]), 'Docker discovery').trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('|'))
  .filter(([, name]) => name === expectedContainer)
assert.equal(containerRows.length, 1, 'Expected exactly one local DB container')
assert(/supabase\/postgres/i.test(containerRows[0][2]))
const containerId = containerRows[0][0]
const psqlArgs = [
  'exec', '-i', containerId, 'psql', '-X', '--no-psqlrc', '-U', 'postgres',
  '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t',
]
const psql = (sql) => run('docker', psqlArgs, { input: sql })
const scalar = (sql) => requireSuccess(psql(sql), 'local psql').trim()

const beforeCenterCount = scalar("select count(*) from public.centers where id='dreamhome_prod';")
const beforeScheduleCount = scalar("select count(*) from public.center_cloud_entities where center_id='dreamhome_prod' and entity_type='schedule_session';")
const beforeCommandCount = scalar("select count(*) from public.center_core_command_result where center_id='dreamhome_prod' and entity_type='schedule_session';")

const dynamicAllowlist = `insert into ov1_4_dreamhome_prod_schedule_allowlist (
    row_fingerprint,
    expected_updated_at
  )
  select
    pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          pg_catalog.jsonb_build_object(
            'center_id', e.center_id,
            'entity_type', e.entity_type,
            'local_id', e.local_id,
            'payload', e.payload,
            'source_module', e.source_module,
            'source_version', e.source_version,
            'entity_version', e.entity_version,
            'created_at', e.created_at,
            'updated_at', e.updated_at,
            'deleted_at', e.deleted_at
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ),
    e.updated_at
  from public.center_cloud_entities e
  where e.center_id = 'dreamhome_prod'
    and e.entity_type = 'schedule_session'
    and e.deleted_at is null`

const migrationBody = migration
  .replace(/^begin;\s*/, '')
  .replace(/\s*commit;\s*$/, '')
  .replace(
    /insert into ov1_4_dreamhome_prod_schedule_allowlist \([\s\S]*?\) values[\s\S]*?;(?=\s*if \(select pg_catalog\.count\(\*\) from ov1_4_dreamhome_prod_schedule_allowlist\))/,
    `${dynamicAllowlist};\n\n  `,
  )
assert(!migrationBody.startsWith('begin;'))
assert(!migrationBody.endsWith('commit;'))
assert(migrationBody.includes('select\n    pg_catalog.encode('), 'Dynamic local-QA allowlist replacement failed')
assert(!migrationBody.includes('d8f954450feae470534cfcf2b3c91487afe483951ffab2546e0e4dd007ff93dc'))

const fixtureRows = (count = 4, versionDrift = false) => Array.from({ length: count }, (_, index) => {
  const id = `ov1-4-local-schedule-${index + 1}`
  const scheduleType = index === 3 ? 'oneOff' : 'recurring'
  const dateFields = scheduleType === 'oneOff'
    ? `'date', '2026-08-21', 'dayOfWeek', 'friday'`
    : `'date', null, 'dayOfWeek', '${['monday', 'tuesday', 'wednesday'][index]}'`
  const version = versionDrift && index === 0 ? 2 : 1
  return `(
    gen_random_uuid(), 'dreamhome_prod', 'schedule_session', 'schedule-session::${id}',
    jsonb_build_object(
      'id', '${id}', 'scheduleType', '${scheduleType}', ${dateFields},
      'startTime', '18:00', 'endTime', '19:00', 'title', 'OV1.4 local QA',
      'studentIds', jsonb_build_array(), 'isControlledFixture', true
    ),
    'schedule', 'f19h-schedule-session-alpha-v1', ${version},
    '2026-08-21 00:0${index}:00+00', '2026-08-21 00:0${index}:00+00'
  )`
}).join(',\n')

const setupSql = ({ count = 4, versionDrift = false, collision = false, history = false } = {}) => `
begin;
delete from public.center_core_command_result
where center_id = 'dreamhome_prod' and entity_type = 'schedule_session';
delete from public.center_cloud_entities
where center_id = 'dreamhome_prod' and entity_type = 'schedule_session';
insert into public.centers (id, name, slug, environment, status)
values ('dreamhome_prod', 'OV1.4 local QA', 'dreamhome', 'production', 'active')
on conflict (id) do nothing;
insert into public.center_cloud_entities (
  id, center_id, entity_type, local_id, payload,
  source_module, source_version, entity_version, created_at, updated_at
) values
${fixtureRows(count, versionDrift)};
${collision ? `insert into public.center_cloud_entities (
  id, center_id, entity_type, local_id, payload,
  source_module, source_version, entity_version, created_at, updated_at, deleted_at
) values (
  gen_random_uuid(), 'dreamhome_prod', 'schedule_session', 'ov1-4-local-schedule-1',
  jsonb_build_object('id', 'collision-tombstone'), 'schedule',
  'f19h-schedule-session-alpha-v1', 1, now(), now(), now()
);` : ''}
${history ? `insert into auth.users (id, aud, role, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000041', 'authenticated', 'authenticated', now(), now())
on conflict (id) do nothing;
insert into public.center_core_command_result (
  center_id, actor_user_id, idempotency_key, operation, entity_type,
  local_id, expected_version, intent_digest, result_snapshot
) values (
  'dreamhome_prod', '00000000-0000-4000-8000-000000000041',
  '00000000-0000-4000-8000-000000000042', 'UPSERT', 'schedule_session',
  'schedule-session::ov1-4-local-schedule-1', 0,
  digest('ov1-4-local-history', 'sha256'),
  jsonb_build_object('outcome_code', 'COMMITTED', 'entity_version', 1)
);` : ''}
`

const successSql = `${setupSql()}
${migrationBody}
do $qa$
begin
  if (select count(*) from public.center_cloud_entities
      where center_id='dreamhome_prod' and entity_type='schedule_session'
        and deleted_at is null and local_id=payload->>'id' and entity_version=2) <> 4 then
    raise exception 'local success invariant failed';
  end if;
end
$qa$;
rollback;
`
requireSuccess(psql(successSql), 'success-path migration QA')

const expectFailure = (label, setup, expectedText) => {
  const result = psql(`${setup}\n${migrationBody}\nrollback;`)
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`)
  assert(`${result.stdout}\n${result.stderr}`.includes(expectedText), `${label} did not fail at expected guard`)
}
expectFailure('count drift', setupSql({ count: 3 }), 'allowlist count is not 4')
expectFailure('version drift', setupSql({ versionDrift: true }), 'exact guarded target count is 3, expected 4')
expectFailure('collision', setupSql({ collision: true }), 'normalized local_id collision detected')
expectFailure('command history', setupSql({ history: true }), 'related C5.1 command history exists')

assert.equal(scalar("select count(*) from public.centers where id='dreamhome_prod';"), beforeCenterCount)
assert.equal(scalar("select count(*) from public.center_cloud_entities where center_id='dreamhome_prod' and entity_type='schedule_session';"), beforeScheduleCount)
assert.equal(scalar("select count(*) from public.center_core_command_result where center_id='dreamhome_prod' and entity_type='schedule_session';"), beforeCommandCount)

console.log('OV1_4_LOCAL_SUCCESS_ONLY_APPROVED_FIELDS_AND_ROLLBACK: PASS')
console.log('OV1_4_LOCAL_COUNT_VERSION_COLLISION_HISTORY_FAIL_CLOSED: PASS')
console.log('OV1_4_LOCAL_ACTIVE_FIXTURE_RESIDUE_0: PASS')
console.log('OV1_4_DREAMHOME_PROD_SCHEDULE_IDENTITY_NORMALIZATION_LOCAL_DB_QA: PASS')
