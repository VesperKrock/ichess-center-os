import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
const file='supabase/migrations/202609270005_tuition_definitive_initial_setup.sql'
const before=JSON.parse(fs.readFileSync('artifacts/tuition-definitive/remote-before.json','utf8'))
assert(!before.migrations.includes('202609270005'))
assert(!/SETUP_INITIAL_CYCLE/.test(before.functions.v2_4_mutate_package_cycle))
const sql=fs.readFileSync(file,'utf8'),hash=createHash('sha256').update(sql).digest('hex')
const literal=s=>`'${s.replaceAll("'","''")}'`
const definitionHash=createHash('md5').update(before.functions.v2_4_mutate_package_cycle).digest('hex')
const guarded=`begin;
do $guard$ begin
  if exists(select 1 from supabase_migrations.schema_migrations where version='202609270005')
    or md5(pg_get_functiondef('public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure))<>${literal(definitionHash)} then
    raise exception 'Remote contract changed: stop';
  end if;
end $guard$;
${sql.replace(/^begin;\s*$/gmi,'').replace(/^commit;\s*$/gmi,'')}
insert into supabase_migrations.schema_migrations(version,name,statements)
values('202609270005','tuition_definitive_initial_setup',array[${literal(sql)}]);
commit;
begin read only;
select jsonb_build_object('version','202609270005','migrationRecorded',exists(select 1 from supabase_migrations.schema_migrations where version='202609270005'),
  'setupInstalled',position('SETUP_INITIAL_CYCLE' in pg_get_functiondef('public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure))>0,
  'readInstalled',to_regprocedure('public.tuition_operator_read(text)') is not null,
  'cycleWrapper',pg_get_functiondef('public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure),
  'operatorRead',pg_get_functiondef('public.tuition_operator_read(text)'::regprocedure));rollback;`
const url=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim())
assert(url.username.includes('zahcfnpaprbnuqpegdmo'))
const password=fs.readFileSync('matkhausupabase.txt','utf8').trim()
const r=spawnSync('docker',['exec','-i','-e','PGPASSWORD','supabase_db_ichess-center-os','psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-d',url.href,'-q','-A','-t'],
  {env:{...process.env,PGPASSWORD:password},input:guarded,encoding:'utf8',windowsHide:true,timeout:30000})
assert.equal(r.status,0,r.stderr.replaceAll(password,'[REDACTED]'))
const report={...JSON.parse(r.stdout.trim()),file,sha256:hash,businessDmlExecuted:false}
assert(report.setupInstalled&&report.readInstalled&&report.migrationRecorded)
fs.writeFileSync('artifacts/tuition-definitive/migration-verification.json',JSON.stringify(report,null,2))
console.log(JSON.stringify({version:report.version,setupInstalled:report.setupInstalled,readInstalled:report.readInstalled,migrationRecorded:report.migrationRecorded,businessDmlExecuted:false,sha256:hash},null,2))
