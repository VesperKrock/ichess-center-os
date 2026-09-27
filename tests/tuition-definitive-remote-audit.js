import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const phase = process.argv[2] || 'before'
assert(['before', 'after'].includes(phase))
const artifacts = 'artifacts/tuition-definitive'
fs.mkdirSync(artifacts, { recursive: true })
const url = new URL(fs.readFileSync('supabase/.temp/pooler-url', 'utf8').trim())
const password = fs.readFileSync('matkhausupabase.txt', 'utf8').trim()
const lines = fs.readFileSync('testgmailtk.txt', 'utf8').split(/\r?\n/)
const accounts = lines.filter(line => /^Gmail\s*:/i.test(line)).map(line => line.slice(line.indexOf(':') + 1).trim())
const literal = value => `'${value.replaceAll("'", "''")}'`
const sql = `begin read only;
select jsonb_build_object(
  'center', (select to_jsonb(c) from public.centers c where id='phongtrong_prod'),
  'memberships',(select jsonb_agg(jsonb_build_object('accountIndex',a.ordinality-1,'centerId',m.center_id,'role',m.role,'status',m.status))
    from unnest(array[${accounts.map(literal).join(',')}]) with ordinality a(email,ordinality)
    join auth.users u on lower(u.email)=lower(a.email) join public.center_members m on m.user_id=u.id),
  'migrations',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations where version>='202609260001'),
  'functions',(select jsonb_object_agg(proname,pg_get_functiondef(oid)) from pg_proc where pronamespace='public'::regnamespace
    and proname in ('v2_4_list_package_cycle_state','v2_4_mutate_package_cycle','tuition_final_cycle_json','f5b_mutate_tuition_receipt','v2_3_mutate_occurrence_attendance','tuition_operator_read')),
  'snapshots',(select jsonb_object_agg(key,value) from (
    select 'entities' key,jsonb_object_agg(center_id,jsonb_build_object('count',n,'hash',hash)) value from
      (select center_id,count(*) n,md5(string_agg(to_jsonb(t)::text,'' order by entity_type,local_id)) hash from public.center_cloud_entities t group by center_id) s
    union all select 'cycles',jsonb_object_agg(center_id,jsonb_build_object('count',n,'hash',hash)) from
      (select center_id,count(*) n,md5(string_agg(to_jsonb(t)::text,'' order by id)) hash from public.center_tuition_package_cycles t group by center_id) s
    union all select 'finance',jsonb_object_agg(center_id,jsonb_build_object('count',n,'hash',hash)) from
      (select center_id,count(*) n,md5(string_agg(to_jsonb(t)::text,'' order by id)) hash from public.finance_transaction t group by center_id) s
    union all select 'receipts',jsonb_object_agg(center_id,jsonb_build_object('count',n,'hash',hash)) from
      (select center_id,count(*) n,md5(string_agg(to_jsonb(t)::text,'' order by id)) hash from public.center_tuition_receipts t group by center_id) s
    union all select 'contributions',jsonb_object_agg(center_id,jsonb_build_object('count',n,'hash',hash)) from
      (select center_id,count(*) n,md5(string_agg(to_jsonb(t)::text,'' order by id)) hash from public.center_tuition_attendance_contributions t group by center_id) s
  ) x),
  'demoIntegrity',jsonb_build_object(
    'financeCount',(select count(*) from public.finance_transaction where center_id='phongtrong_prod'),
    'receiptCount',(select count(*) from public.center_tuition_receipts where center_id='phongtrong_prod'),
    'paymentLinks',(select count(*) from public.center_tuition_receipt_payment_links where center_id='phongtrong_prod'),
    'boundedSourceIds',(select bool_and(length(local_source_id)<=200) from public.finance_transaction where center_id='phongtrong_prod'),
    'cycles',(select jsonb_agg(jsonb_build_object('student',student_local_id,'cycle',cycle_number,'used',used_sessions,'N',total_sessions_snapshot,'paid',payment_status,'expired',expired_sessions_snapshot,'ended',manually_ended_at) order by student_local_id,cycle_number) from public.center_tuition_package_cycle_projection projection join public.center_tuition_package_cycles cycle using(id,center_id,student_local_id,cycle_number,total_sessions_snapshot) where center_id='phongtrong_prod'),
    'setupCommits',(select count(*) from public.center_tuition_cycle_command_results where center_id='phongtrong_prod' and result_snapshot->>'cycle_number'='1' and result_snapshot->>'outcome_code'='COMMITTED')
  ),
  'demoActiveEntities',(select coalesce(jsonb_object_agg(entity_type,n),'{}') from (select entity_type,count(*) n from public.center_cloud_entities where center_id='phongtrong_prod' and deleted_at is null group by entity_type) x),
  'demoPackages',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.center_tuition_package_catalog p where center_id='phongtrong_prod'),
  'demoProfile',(select to_jsonb(p) from public.center_operational_profiles p where center_id='phongtrong_prod')
); rollback;`
const result = spawnSync('docker', ['exec', '-i', '-e', 'PGPASSWORD', 'supabase_db_ichess-center-os', 'psql', '-X', '--no-psqlrc', '-v', 'ON_ERROR_STOP=1', '-d', url.href, '-q', '-A', '-t'],
  { env: { ...process.env, PGPASSWORD: password }, input: sql, encoding: 'utf8', windowsHide: true, timeout: 30000 })
assert.equal(result.status, 0, result.stderr.replaceAll(password, '[REDACTED]'))
const report = JSON.parse(result.stdout.trim())
assert(report.center?.id === 'phongtrong_prod')
if (phase === 'after') {
  const before = JSON.parse(fs.readFileSync(`${artifacts}/remote-before.json`, 'utf8'))
  for (const [table, centers] of Object.entries(before.snapshots)) for (const [center, snapshot] of Object.entries(centers || {})) {
    if (center !== 'phongtrong_prod') assert.deepEqual(report.snapshots[table]?.[center], snapshot, `${center} ${table} changed`)
  }
  for(const [table,centers]of Object.entries(report.snapshots))for(const center of Object.keys(centers||{}))if(center!=='phongtrong_prod')assert.deepEqual(centers[center],before.snapshots[table]?.[center],center+' unexpected business data')
  assert.equal(report.demoIntegrity.financeCount,2);assert.equal(report.demoIntegrity.receiptCount,2);assert.equal(report.demoIntegrity.paymentLinks,2);assert(report.demoIntegrity.boundedSourceIds)
  const debt=report.demoIntegrity.cycles.find(c=>c.student==='tuition-demo-20260927-e'&&c.cycle===2);assert(debt.used===2&&debt.paid==='PAID')
  const ended=report.demoIntegrity.cycles.find(c=>c.student==='tuition-demo-20260927-f'&&c.cycle===1);assert(ended.used===13&&ended.expired===3&&ended.ended)
  for(const key of ['a','b','d'])assert.equal(report.demoIntegrity.cycles.find(c=>c.student==='tuition-demo-20260927-'+key)?.paid,'PAID')
  report.unrelatedBusinessDataUnchanged = true
} else {
  assert(!fs.existsSync(`${artifacts}/remote-before.json`), 'Do not overwrite the safety baseline')
  for (const table of ['cycles','finance','receipts','contributions']) assert(!(report.snapshots[table]?.phongtrong_prod?.count > 0), `Demo center already has ${table}`)
  assert(!(report.demoActiveEntities.student > 0), 'Demo center is not empty')
}
fs.writeFileSync(`${artifacts}/remote-${phase}.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ phase, center: report.center.id, memberships: report.memberships, demoActiveEntities: report.demoActiveEntities,
  demoPackages: report.demoPackages.map(p=>({id:p.id,name:p.package_name,N:p.total_sessions})),
  initialSetup: report.demoProfile?.initial_student_setup_enabled, unrelatedBusinessDataUnchanged: report.unrelatedBusinessDataUnchanged,
  setupAtomicOperationPresent: /SETUP_INITIAL_CYCLE/.test(report.functions.v2_4_mutate_package_cycle) }, null, 2))
