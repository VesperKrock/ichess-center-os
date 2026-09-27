import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const phase = process.argv[2] || 'before'
assert(['before', 'temporary', 'after-cleanup'].includes(phase))
const folder = 'artifacts/dreamhome-final-canary'
fs.mkdirSync(folder, { recursive: true })
if (phase === 'before') assert(!fs.existsSync(`${folder}/before.json`), 'Preserve the original safety baseline')
const password = fs.readFileSync('matkhausupabase.txt', 'utf8').trim()
const url = new URL(fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim())
assert(!url.password)
const sql = `begin transaction read only;
select jsonb_build_object(
 'centerCandidates',(select jsonb_agg(to_jsonb(c)) from public.centers c where name ilike '%dream%'),
 'canaryCandidates',(select jsonb_agg(jsonb_build_object('centerId',center_id,'studentId',local_id,'payload',payload,'deletedAt',deleted_at)) from public.center_cloud_entities where entity_type='student' and coalesce(payload->>'fullName',payload->>'name') ilike '%Tùng%'),
 'center',(select to_jsonb(c) from public.centers c where id='dreamhome'),
 'profile',(select to_jsonb(p) from public.center_operational_profiles p where center_id='dreamhome'),
 'canary',(select jsonb_agg(to_jsonb(s)) from public.center_cloud_entities s where center_id='dreamhome' and entity_type='student' and deleted_at is null and coalesce(payload->>'fullName',payload->>'name')='Nguyễn Tùng Lâm'),
 'entities',(select coalesce(jsonb_agg(to_jsonb(e) order by entity_type,local_id),'[]') from public.center_cloud_entities e where center_id='dreamhome'),
 'packages',(select coalesce(jsonb_agg(to_jsonb(p) order by id),'[]') from public.center_tuition_package_catalog p where center_id='dreamhome'),
 'cycles',(select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.center_tuition_package_cycles c where center_id='dreamhome' and student_local_id='stu-1783341134938'),
 'cycleProjection',(select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.center_tuition_package_cycle_projection c where center_id='dreamhome' and student_local_id='stu-1783341134938'),
 'enrollmentSets',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from public.center_student_enrollment_sets e where center_id='dreamhome' and student_local_id='stu-1783341134938'),
 'enrollments',(select coalesce(jsonb_agg(to_jsonb(e) order by id),'[]') from public.center_student_recurring_enrollments e where center_id='dreamhome' and student_local_id='stu-1783341134938'),
 'finance',(select coalesce(jsonb_agg(to_jsonb(f) order by id),'[]') from public.finance_transaction f where center_id='dreamhome'),
 'receipts',(select coalesce(jsonb_agg(to_jsonb(r) order by id),'[]') from public.center_tuition_receipts r where center_id='dreamhome'),
 'paymentLinks',(select coalesce(jsonb_agg(to_jsonb(p) order by to_jsonb(p)::text),'[]') from public.center_tuition_receipt_payment_links p where center_id='dreamhome'),
 'tables',(select jsonb_agg(jsonb_build_object('table',table_name,'columns',columns) order by table_name) from
  (select table_name,jsonb_agg(column_name order by ordinal_position) columns from information_schema.columns where table_schema='public' and table_name ~ '(tuition|enrollment|class_session|schedule)' group by table_name) t),
 'foreignKeys',(select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'definition',pg_get_constraintdef(oid))) from pg_constraint where contype='f' and (conrelid::regclass::text ~ '(tuition|enrollment)' or confrelid::regclass::text ~ '(tuition|enrollment)')),
 'functions',(select jsonb_object_agg(proname,pg_get_functiondef(oid)) from pg_proc where pronamespace='public'::regnamespace and proname in ('tuition_operator_read','v2_4_mutate_package_cycle','v2_2_mutate_student_with_enrollments','v2_1_mutate_center_settings','v2_2_validate_class_session_enrollments','f5b_mutate_tuition_receipt')),
 'businessHashes',(select jsonb_object_agg(tab,value) from (
  ${['center_cloud_entities','center_tuition_package_cycles','finance_transaction','center_tuition_receipts','center_tuition_receipt_payment_links','center_tuition_attendance_contributions','center_tuition_package_catalog','center_operational_profiles','center_student_enrollment_sets'].map(table => `select '${table}' tab,coalesce(jsonb_agg(to_jsonb(s) order by center_id),'[]') value from (select center_id,count(*) n,md5(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text)) hash from public.${table} t group by center_id) s`).join(' union all ')}
 ) x)
); rollback;`.replaceAll("='dreamhome'", "='dreamhome_prod'")
const r = spawnSync('docker', ['exec','-i','-e','PGPASSWORD','supabase_db_ichess-center-os','psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-d',url.href,'-q','-A','-t'], {
  env: { ...process.env, PGPASSWORD: password }, input: sql, encoding:'utf8', windowsHide:true, timeout:30000,
})
assert.equal(r.status, 0, r.stderr.replaceAll(password, '[REDACTED]'))
const result = JSON.parse(r.stdout.trim())
const normalizeName = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()
const candidates = result.entities.filter(e => e.entity_type === 'student' && !e.deleted_at && normalizeName(e.payload.fullName || e.payload.name) === 'nguyen tung lam')
if (!result.canary && candidates.length === 1) result.canary = candidates
if (result.canary?.length !== 1) {
  fs.writeFileSync(`${folder}/unverified-read.json`,JSON.stringify(result,null,2))
  console.log(JSON.stringify({centerCandidates:result.centerCandidates,canaryCandidates:result.canaryCandidates,center:result.center,studentCount:result.entities.filter(e=>e.entity_type==='student').length,candidates}))
}
assert.equal(result.canary?.length, 1, 'Exactly one active matching real Student is required')
result.studentId = result.canary[0].local_id
result.capturedAt = new Date().toISOString()
fs.writeFileSync(`${folder}/${phase}-raw.json`, JSON.stringify(result,null,2))
const profile = result.canary[0].payload
const businessState = {
  centerId: result.center.id, centerName: result.center.name, environment: result.center.environment,
  studentId: result.studentId, name: profile.fullName, status: profile.currentStatus || profile.status,
  student: result.canary[0], classSessionIds: profile.classSessionIds || [],
  relatedEntities: result.entities.filter(e => JSON.stringify(e.payload).includes(result.studentId) && e.entity_type !== 'student'),
  enrollmentSets: result.enrollmentSets, enrollments: result.enrollments, cycles: result.cycles, cycleProjection: result.cycleProjection,
  finance: result.finance.filter(f => JSON.stringify(f).includes(result.studentId)),
  receipts: result.receipts.filter(r => JSON.stringify(r).includes(result.studentId)),
  paymentLinks: result.paymentLinks.filter(p => JSON.stringify(p).includes(result.studentId)),
  notes: { careNotes: profile.careNotes, latestCareNote: profile.latestCareNote, parentNotes: profile.parentNotes },
  capturedAt: result.capturedAt,
}
fs.writeFileSync(`${folder}/${phase}.json`,JSON.stringify(businessState,null,2))
console.log(JSON.stringify({ phase, studentId:result.studentId, status:businessState.status, cycles:result.cycles.length, enrollments:result.enrollments.length,
  packages:result.packages.map(p=>({id:p.id,name:p.package_name,N:p.total_sessions,amount:p.default_amount,active:p.is_active})),
  tables:result.tables.map(t=>t.table), profile:{prefix:result.profile.receipt_prefix,collector:result.profile.default_receipt_collector_name} },null,2))
