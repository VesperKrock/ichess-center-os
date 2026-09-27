import assert from 'node:assert/strict'
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
const center='phongtrong_prod',student='tuition-demo-20260927-practice-pay'
const email=fs.readFileSync('testgmailtk.txt','utf8').split(/\r?\n/).filter(s=>/^Gmail\s*:/i.test(s))[2].split(':').slice(1).join(':').trim()
const password=fs.readFileSync('matkhausupabase.txt','utf8').trim(),url=fs.readFileSync('supabase/.temp/pooler-url','utf8').trim()
const q=s=>`'${String(s).replaceAll("'","''")}'`
const sql=`begin;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',u.id,'role','authenticated')::text from auth.users u join public.center_members m on m.user_id=u.id and m.center_id='${center}' and m.status='active' and m.role='owner' where lower(u.email)=lower(${q(email)})),true);
do $qa$ declare c public.center_tuition_package_cycles;r jsonb;money bigint;begin
  select * into strict c from public.center_tuition_package_cycles where center_id='${center}' and student_local_id='${student}' and cycle_number=1;
  if (select used_sessions from public.center_tuition_package_cycle_projection where id=c.id)<>0 or c.lifecycle_status not in ('ACTIVE','PROVISIONAL_UNPAID') then raise exception 'stale QA requires unused unpaid practice cycle';end if;
  select count(*) into money from public.finance_transaction where center_id='${center}';
  r:=public.v2_4_mutate_package_cycle('${center}',jsonb_build_object('operation','SELECT_PROVISIONAL_PACKAGE','student_id','${student}','cycle_id',c.id,'package_catalog_id',c.package_catalog_id,'expected_version',c.version),${q(randomUUID())});
  if r->>'ok'<>'true' or (select version from public.center_tuition_package_cycles where id=c.id)<=c.version then raise exception 'authoritative change failed %',r;end if;
  if (select count(*) from public.finance_transaction where center_id='${center}')<>money then raise exception 'unexpected money';end if;
end $qa$;
select jsonb_build_object('center','${center}','student','${student}','samePackageReselected',true,'authoritativeVersionChanged',true,'moneyWrite',false);
commit;`
const result=spawnSync('docker',['exec','-i','-e','PGPASSWORD','supabase_db_ichess-center-os','psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-d',url,'-q','-A','-t'],{env:{...process.env,PGPASSWORD:password},input:sql,encoding:'utf8',windowsHide:true,timeout:30000})
assert.equal(result.status,0,result.stderr.replaceAll(password,'[REDACTED]').replaceAll(email,'[QA account]'))
const report=result.stdout.trim().split(/\r?\n/).map(line=>{try{return JSON.parse(line)}catch{return null}}).find(x=>x?.samePackageReselected)
assert(report);fs.writeFileSync('artifacts/tuition-definitive/demo-stale-change.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
