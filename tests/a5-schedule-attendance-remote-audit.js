import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const phase = process.argv[2]
assert(['before', 'after'].includes(phase))
const folder = 'artifacts/a5-schedule-attendance-ui'
fs.mkdirSync(folder, { recursive: true })
const password = fs.readFileSync('matkhausupabase.txt', 'utf8').trim()
const url = new URL(fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim())
assert(!url.password)
const tables = [
  'centers', 'center_members', 'center_cloud_entities', 'center_schedule_occurrences',
  'center_class_teacher_assignments', 'center_tuition_package_cycles',
  'center_tuition_attendance_contributions', 'finance_transaction',
  'center_tuition_receipts', 'center_tuition_receipt_payment_links',
]
const entries = tables.map(table => `'${table}',(select jsonb_build_object(
  'count',count(*),'hash',md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),''))) from public.${table} t)`)
const sql = `begin read only;
select jsonb_build_object(
  'snapshots',jsonb_build_object(${entries.join(',')}),
  'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations where version>='202609270006'),
  'attendance',(select count(*) from public.center_cloud_entities where entity_type='attendance_record' and deleted_at is null and payload->>'attendanceAuthority'='v2.3-occurrence-v1'),
  'contributions',(select count(*) from public.center_tuition_attendance_contributions where ended_at is null),
  'units',(select coalesce(sum(contribution_units),0) from public.center_tuition_attendance_contributions where ended_at is null),
  'occurrences',(select count(*) from public.center_schedule_occurrences),
  'qaCleanup',jsonb_build_object(
    'centers',(select count(*) from public.centers where id in ('a2_qa_occurrence_2709','a3_qa_teacher_2709','a4_qa_makeup_2709')),
    'entities',(select count(*) from public.center_cloud_entities where center_id in ('a2_qa_occurrence_2709','a3_qa_teacher_2709','a4_qa_makeup_2709')),
    'occurrences',(select count(*) from public.center_schedule_occurrences where center_id in ('a2_qa_occurrence_2709','a3_qa_teacher_2709','a4_qa_makeup_2709')),
    'contributions',(select count(*) from public.center_tuition_attendance_contributions where center_id in ('a2_qa_occurrence_2709','a3_qa_teacher_2709','a4_qa_makeup_2709')),
    'cycles',(select count(*) from public.center_tuition_package_cycles where center_id in ('a2_qa_occurrence_2709','a3_qa_teacher_2709','a4_qa_makeup_2709')),
    'teachers',(select count(*) from public.canonical_teacher_registry where id in ('a3000000-0000-4000-8000-000000000101','a3000000-0000-4000-8000-000000000102','a3000000-0000-4000-8000-000000000103'))),
  'functions',(select jsonb_object_agg(proname,pg_get_functiondef(oid)) from pg_proc where pronamespace='public'::regnamespace
    and proname in ('v2_3_mutate_occurrence_attendance','a4_list_eligible_missed_occurrences','a3_list_schedule_teacher_context'))
); rollback;`
const result = spawnSync('docker', ['exec', '-i', '-e', 'PGPASSWORD', 'supabase_db_ichess-center-os',
  'psql', '-X', '--no-psqlrc', '-v', 'ON_ERROR_STOP=1', '-d', url.href, '-q', '-A', '-t'], {
  env: { ...process.env, PGPASSWORD: password }, input: sql, encoding: 'utf8', windowsHide: true, timeout: 30000,
})
assert.equal(result.status, 0, 'Remote read-only audit failed; credentials are not logged')
const data = JSON.parse(result.stdout.trim())
const target = `${folder}/remote-${phase}.json`
assert(!fs.existsSync(target), 'Do not overwrite remote QA evidence')
if (phase === 'after') {
  const before = JSON.parse(fs.readFileSync(`${folder}/remote-before.json`, 'utf8'))
  assert.deepEqual(data.snapshots, before.snapshots, 'Remote business rows changed')
  assert(Object.values(data.qaCleanup).every(count => count === 0), 'Temporary QA records remain')
}
fs.writeFileSync(target, JSON.stringify(data, null, 2))
console.log(JSON.stringify({ phase, readOnly: true, migrations: data.migrations,
  attendance: data.attendance, contributions: data.contributions, units: data.units,
  occurrences: data.occurrences, qaCleanup: data.qaCleanup, unchanged: phase === 'after' }))
