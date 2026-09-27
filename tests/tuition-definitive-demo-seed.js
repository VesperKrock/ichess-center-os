import assert from 'node:assert/strict'
import fs from 'node:fs'
import {spawnSync} from 'node:child_process'
import {randomUUID} from 'node:crypto'
const phase=process.argv[2]||'base'
assert(['base','attendance'].includes(phase))
const center='phongtrong_prod',dir='artifacts/tuition-definitive'
assert(JSON.parse(fs.readFileSync(`${dir}/dreamhome-real-app-report.json`)).passed,'Real remote read-only UI gate must pass first')
const email=fs.readFileSync('testgmailtk.txt','utf8').split(/\r?\n/).filter(s=>/^Gmail\s*:/i.test(s))[2].split(':').slice(1).join(':').trim()
const password=fs.readFileSync('matkhausupabase.txt','utf8').trim(),url=fs.readFileSync('supabase/.temp/pooler-url','utf8').trim()
const q=v=>`'${String(v).replaceAll("'","''")}'`
const records=[['a','DEMO - Legacy 6/16'],['b','DEMO - Legacy + iChess'],['c','DEMO - New Student'],['d','DEMO - N-2'],['e','DEMO - Học nợ'],['f','DEMO - Hết hiệu lực'],['practice-legacy','DEMO - Tự thiết lập legacy'],['practice-new','DEMO - Tự gán gói'],['practice-pay','DEMO - Tự thanh toán'],['practice-end','DEMO - Tự kết thúc kỳ'],['practice-debt','DEMO - Học nợ chưa thanh toán']].map(([key,name])=>({key,id:`tuition-demo-20260927-${key}`,name}))
const packageId='27092700-0000-4000-8000-000000001016'
let work=''
if(phase==='base'){
  assert(!fs.existsSync(`${dir}/demo-base.json`),'Base is single-use; no reset/reseed')
  work=`do $guard$ begin
    if exists(select 1 from public.center_cloud_entities where center_id='${center}' and entity_type='student' and deleted_at is null)
      or exists(select 1 from public.center_tuition_package_cycles where center_id='${center}')
      or exists(select 1 from public.finance_transaction where center_id='${center}')
      or exists(select 1 from public.center_tuition_receipts where center_id='${center}')
      or exists(select 1 from public.center_tuition_package_catalog where center_id='${center}') then raise exception 'demo center no longer empty';end if;
  end $guard$;
  do $config$ declare r jsonb;v bigint;begin
    select version into v from public.center_operational_profiles where center_id='${center}';
    r:=public.v2_1_mutate_center_settings('${center}',jsonb_build_object('operation','UPDATE_CENTER_PROFILE','expected_version',v,'display_name','Phòng Trống','address','','phone','','note','Dữ liệu DEMO giả lập để kiểm tra vận hành học phí.','receipt_prefix','PT','renewal_material_fee_minor',0,'initial_student_setup_enabled',true,'default_receipt_collector_name','Admin DEMO'),${q(randomUUID())});
    if r->>'ok'<>'true' then raise exception 'demo profile failed %',r;end if;
    r:=public.v2_1_mutate_center_settings('${center}',jsonb_build_object('operation','CREATE_TUITION_PACKAGE','package_id','${packageId}','expected_version',0,'package_name','Gói 16 buổi','program_name','Cờ vua DEMO','total_sessions',16,'default_amount',1600000,'max_completion_weeks',null,'is_active',true,'note','Gói giả lập phục vụ kiểm tra vận hành.'),${q(randomUUID())});
    if r->>'ok'<>'true' then raise exception 'demo package failed %',r;end if;
  end $config$;
  ${records.map(r=>`insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,entity_version,created_by,updated_by)
  values('${center}','student',${q(r.id)},${q(JSON.stringify({id:r.id,fullName:r.name,parentName:`Phụ huynh DEMO ${r.key}`,parentPhone:'',status:'active',centerId:center,note:'Học viên giả lập. Các buổi DEMO là dữ liệu minh họa kiểm thử.'}))}::jsonb,'tuition-demo','v1',1,auth.uid(),auth.uid());`).join('\n')}
  insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,entity_version,created_by,updated_by)
  values('${center}','tuition_record_package','tuition-demo-legacy-pending',jsonb_build_object('id','tuition-demo-legacy-pending','studentId','tuition-demo-20260927-practice-legacy','centerId','${center}'),'tuition-demo','v1',1,auth.uid(),auth.uid());
  select jsonb_build_object('center','${center}','phase','base','students',${records.length},'packageId','${packageId}','businessMoneyWrites',0);`
}else{
  assert(fs.existsSync(`${dir}/demo-base.json`))
  assert(!fs.existsSync(`${dir}/demo-attendance.json`),'Occurrence population is single-use')
  const plan=[['b',2],['e',2],['f',13],['practice-end',13],['practice-debt',2]]
  work=`do $guard$ begin if (select count(*) from public.center_cloud_entities where center_id='${center}' and entity_type='student' and deleted_at is null)<>${records.length} then raise exception 'demo roster mismatch';end if;end $guard$;
  do $attendance$ declare r jsonb;today date:=(timezone('Asia/Ho_Chi_Minh',now()))::date;begin
  ${plan.flatMap(([key,n])=>Array.from({length:n},(_,i)=>{
    const student=`tuition-demo-20260927-${key}`,session=`tuition-demo-occurrence-${key}-${i+1}`,teacher=`GV DEMO ${i%2?'Bình':'An'}`
    return `if not exists(select 1 from public.center_tuition_package_cycles where center_id='${center}' and student_local_id='${student}') then raise exception 'demo cycle must be set up through UI first';end if;
    insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,entity_version,created_by,updated_by)
      values('${center}','schedule_session','${session}',jsonb_build_object('id','${session}','date',today,'scheduleType','oneOff','studentIds',jsonb_build_array('${student}'),'teacherName',${q(teacher)},'startTime','${String(8+Math.floor(i/2)).padStart(2,'0')}:${i%2?'30':'00'}','endTime','${String(8+Math.floor((i+1)/2)).padStart(2,'0')}:${(i+1)%2?'30':'00'}','note','Buổi DEMO giả lập; không phải lịch học thực.'),'tuition-demo','v1',1,auth.uid(),auth.uid());
    r:=public.v2_3_mutate_occurrence_attendance('${center}','${session}',today,jsonb_build_array(jsonb_build_object('student_id','${student}','source','admin','attendance_status','present','expected_records','[]'::jsonb,'payload',jsonb_build_object('studentId','${student}','date',today,'scheduleSessionId','${session}','sessionId','${session}','teacherName',${q(teacher)},'source','admin','attendanceStatus','present','status','present','tuitionPolicyDefined',false,'tuitionAutoUpdateEnabled',false,'tuitionConsumptionApplied',false,'countsTowardTuition',false,'counted',false,'creditValue',0))),null,${q(randomUUID())});
    if r->>'ok'<>'true' then raise exception 'demo occurrence failed %',r;end if;`
  })).join('\n')}
  end $attendance$;
  select jsonb_build_object('center','${center}','phase','attendance','canonicalOccurrences',32,'finance',(select count(*) from public.finance_transaction where center_id='${center}'),'students',(select jsonb_agg(jsonb_build_object('student',student_local_id,'cycle',cycle_number,'used',used_sessions,'N',total_sessions_snapshot,'paid',payment_status)) from public.center_tuition_package_cycle_projection where center_id='${center}'));`
}
const sql=`begin;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',u.id,'role','authenticated')::text from auth.users u join public.center_members m on m.user_id=u.id and m.center_id='${center}' and m.status='active' and m.role='owner' where lower(u.email)=lower(${q(email)})),true);
${work}
commit;`
const result=spawnSync('docker',['exec','-i','-e','PGPASSWORD','supabase_db_ichess-center-os','psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-d',url,'-q','-A','-t'],{env:{...process.env,PGPASSWORD:password},input:sql,encoding:'utf8',windowsHide:true,timeout:60000})
assert.equal(result.status,0,result.stderr.replaceAll(password,'[REDACTED]').replaceAll(email,'[QA account]'))
const outputs=result.stdout.trim().split(/\r?\n/).map(s=>{try{return JSON.parse(s)}catch{return null}}).filter(x=>x?.phase)
assert.equal(outputs.length,1)
const report={...outputs[0],records,fictional:true,onlyCenter:center}
fs.writeFileSync(`${dir}/demo-${phase}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report))
