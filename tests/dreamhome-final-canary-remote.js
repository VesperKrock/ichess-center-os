import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {spawnSync} from 'node:child_process'

export const folder='artifacts/dreamhome-final-canary'
export const centerId='dreamhome_prod'
export const studentId='stu-1783341134938'
export const read=name=>JSON.parse(fs.readFileSync(`${folder}/${name}.json`,'utf8'))
export const save=(name,data)=>fs.writeFileSync(`${folder}/${name}.json`,JSON.stringify(data,null,2))
export const literal=value=>`'${String(value).replaceAll("'","''")}'`
export function sqlQuery(sql){
  const password=fs.readFileSync('matkhausupabase.txt','utf8').trim()
  const url=new URL(fs.readFileSync('supabase/.temp/pooler-url','utf8').trim())
  assert(!url.password)
  const r=spawnSync('docker',['exec','-i','-e','PGPASSWORD','supabase_db_ichess-center-os','psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-d',url.href,'-q','-A','-t'],{
    env:{...process.env,PGPASSWORD:password},input:sql,encoding:'utf8',windowsHide:true,timeout:45000,
  })
  assert.equal(r.status,0,r.stderr.replaceAll(password,'[REDACTED]'))
  return r.stdout.trim()?JSON.parse(r.stdout.trim()):null
}
async function rpc(name,args){
  assert.equal(name,'c5_1_mutate_core_entity')
  assert.equal(args.p_center_id,centerId)
  assert.equal(args.p_entity_type,'class_session')
  const env=fs.readFileSync('.env.local','utf8')
  const url=env.match(/^VITE_SUPABASE_URL\s*=\s*["']?([^\s"']+)/m)[1]
  const key=env.match(/^VITE_SUPABASE_(?:PUBLISHABLE|ANON)_KEY\s*=\s*["']?([^\s"']+)/m)[1]
  const lines=fs.readFileSync('testgmailtk.txt','utf8').split(/\r?\n/)
  const index=lines.map((line,i)=>/^Gmail\s*:/i.test(line)?i:-1).filter(i=>i>=0)[2]
  const email=lines[index].slice(lines[index].indexOf(':')+1).trim()
  const password=lines[index+1].slice(lines[index+1].indexOf(':')+1).trim()
  const authResponse=await fetch(`${url}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password})})
  assert.equal(authResponse.status,200,'Normal owner authentication must succeed')
  const auth=await authResponse.json()
  const response=await fetch(`${url}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${auth.access_token}`,'Content-Type':'application/json'},body:JSON.stringify(args)})
  const body=await response.json()
  assert.equal(response.status,200,JSON.stringify(body))
  assert.equal(body.ok,true,JSON.stringify(body))
  return {status:response.status,args,body,actorId:auth.user.id}
}

const mode=process.argv[2]
if(mode==='safety-before'||mode==='safety-after'){
  assert(!fs.existsSync(`${folder}/${mode}.json`),'Preserve safety evidence')
  const tables=sqlQuery(`begin transaction read only;select jsonb_agg(table_name order by table_name) from information_schema.columns where table_schema='public' and column_name='center_id';rollback;`)
  const union=tables.map(table=>`select ${literal(table)} tab,coalesce(jsonb_agg(to_jsonb(s) order by center_id),'[]') value from (select center_id,count(*) n,md5(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text)) hash from public."${table}" t group by center_id) s`).join(' union all ')
  const hashes=sqlQuery(`begin transaction read only;select jsonb_object_agg(tab,value) from (${union}) h;rollback;`)
  save(mode,{capturedAt:new Date().toISOString(),hashes})
  console.log(JSON.stringify({phase:mode,centerScopedTables:tables.length}))
}
if(mode==='audit'){
  const schema=sqlQuery(`begin transaction read only; select jsonb_build_object(
    'triggers',(select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'trigger',pg_get_triggerdef(t.oid),'function',pg_get_functiondef(p.oid))),'[]') from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_proc p on p.oid=t.tgfoid where not t.tgisinternal and c.relname in ('center_cloud_entities','center_tuition_package_cycles','center_student_enrollment_sets','center_student_recurring_enrollments')),
    'foreignKeys',(select jsonb_agg(jsonb_build_object('table',conrelid::regclass::text,'parent',confrelid::regclass::text,'definition',pg_get_constraintdef(oid))) from pg_constraint where contype='f' and (conrelid::regclass::text ~ '(cycle|enrollment)' or confrelid::regclass::text ~ '(cycle|enrollment)')),
    'coreFunction',pg_get_functiondef('public.c5_1_mutate_core_entity(text,text,text,bigint,jsonb,uuid,text)'::regprocedure)
  );rollback;`)
  save('remote-cleanup-contract-audit',schema)
  const before=read('before-raw')
  console.log(JSON.stringify({classes:before.entities.filter(e=>e.entity_type==='class_session').slice(0,2),triggers:schema.triggers.map(t=>({table:t.table,trigger:t.trigger})),foreignKeys:schema.foreignKeys},null,2))
}
if(mode==='create-class'){
  assert(!fs.existsSync(`${folder}/qa-created.json`),'Create exactly one QA teaching setup')
  const before=read('before')
  assert.equal(before.centerId,centerId)
  assert.deepEqual(before.cycles,[])
  assert.deepEqual(before.enrollmentSets,[])
  const id=`qa-dreamhome-canary-${crypto.randomUUID()}`
  const payload={id,name:'QA - Nguyễn Tùng Lâm',displayLabel:'QA - Nguyễn Tùng Lâm',daysOfWeek:['mon'],daysLabel:'T2',startTime:'10:15',endTime:'10:45',instructorName:'Nguyễn Trường Thịnh',status:'active',note:'QA tạm thời — DreamHome final canary 27/09/2026. Chỉ Nguyễn Tùng Lâm; không ghi điểm danh hoặc thu tiền.'}
  const state=sqlQuery(`begin transaction read only;select jsonb_build_object('student',(select to_jsonb(e) from public.center_cloud_entities e where center_id=${literal(centerId)} and entity_type='student' and local_id=${literal(studentId)}),'cycles',(select count(*) from public.center_tuition_package_cycles where center_id=${literal(centerId)} and student_local_id=${literal(studentId)}),'enrollments',(select count(*) from public.center_student_recurring_enrollments where center_id=${literal(centerId)} and student_local_id=${literal(studentId)}));rollback;`)
  assert.deepEqual(state.student,before.student,'Canary must still match immutable baseline before setup')
  assert.equal(state.cycles,0);assert.equal(state.enrollments,0)
  const result=await rpc('c5_1_mutate_core_entity',{p_center_id:centerId,p_entity_type:'class_session',p_local_id:id,p_expected_version:0,p_payload:payload,p_idempotency_key:crypto.randomUUID(),p_operation:'UPSERT'})
  save('qa-created',{centerId,studentId,classId:id,className:payload.name,weekday:'mon',scheduleId:null,teachingSetup:'One canonical recurring Class Session; no separate schedule occurrence or attendance',createdAt:new Date().toISOString(),classCreate:result})
  console.log(JSON.stringify({created:true,classId:id,name:payload.name,version:result.body.entity_version,status:result.status}))
}
if(mode==='cleanup'){
  assert(!fs.existsSync(`${folder}/cleanup-result.json`),'Cleanup runs once, with recorded identities')
  const before=read('before'),temporary=read('temporary-raw'),qa=read('qa-created')
  const reports=['operator-attempt-1-ui','operator-ui'].filter(name=>fs.existsSync(`${folder}/${name}.json`)).map(read)
  const setup=reports.flatMap(r=>r.requests).find(r=>r.method==='POST' && r.arguments?.p_command?.operation==='SETUP_INITIAL_CYCLE' && r.arguments.p_command.student_id===studentId && r.body?.ok)
  assert(setup,'Must prove this task created the cycle through the actual package-assignment UI')
  const cycle=temporary.cycles[0]
  assert.equal(temporary.cycles.length,1)
  assert.equal(cycle.id,setup.body.cycle_id)
  assert.equal(cycle.tuition_local_id,`tuition_record_package::tuition-initial:${setup.arguments.p_idempotency_key}`)
  assert.equal(cycle.created_by,qa.classCreate.actorId)
  assert.equal(cycle.cycle_number,1)
  assert.equal(cycle.total_sessions_snapshot,16)
  assert.equal(cycle.price_snapshot,2400000)
  assert.equal(temporary.cycleProjection[0].used_sessions,0)
  const record=temporary.entities.find(e=>e.local_id===cycle.tuition_local_id && e.entity_type==='tuition_record_package')
  const student=temporary.canary[0]
  const classRow=temporary.entities.find(e=>e.local_id===qa.classId && e.entity_type==='class_session')
  assert.equal(classRow.entity_version,1)
  assert.equal(classRow.created_by,qa.classCreate.actorId)
  assert.equal(student.entity_version,before.student.entity_version+1,'Exactly one authorized enrollment edit, no intervening operator edit')
  assert.equal(temporary.enrollmentSets.length,1)
  assert.equal(temporary.enrollmentSets[0].version,1)
  assert.equal(temporary.enrollments.length,1)
  assert.equal(temporary.enrollments[0].class_session_local_id,qa.classId)
  assert.equal(temporary.enrollments[0].enrollment_set_version,1)
  for(const table of ['finance','receipts','paymentLinks'])assert.deepEqual(temporary[table],read('before-raw')[table],`${table}: zero persistent money changes`)
  qa.cycleId=cycle.id;qa.tuitionLocalId=cycle.tuition_local_id;qa.setupIdempotencyKey=setup.arguments.p_idempotency_key
  qa.enrollmentIds=temporary.enrollments.map(e=>e.id)
  save('qa-created',qa)
  const asJson=value=>`${literal(JSON.stringify(value))}::jsonb`
  const c=literal(centerId),s=literal(studentId),cycleId=literal(cycle.id),classId=literal(qa.classId),recordId=literal(record.local_id)
  const cleanupStudentKey=crypto.randomUUID(),cleanupClassKey=crypto.randomUUID()
  // This is a one-off user-authorized reset of identified, unused QA records.
  // No production function/schema is installed or changed. Canonical audited
  // commands restore Student facts and delete the class. Concurrency versions
  // advance normally; command/audit history is intentionally retained.
  const sql=`begin;
    set local lock_timeout='5s';set local statement_timeout='20s';
    do $guard$ declare current_row jsonb; result jsonb; deleted_count integer; begin
      perform pg_catalog.set_config('request.jwt.claim.sub',${literal(qa.classCreate.actorId)},true);
      perform pg_advisory_xact_lock(hashtextextended('v2.4.student|'||${c}||'|'||${s},0));
      perform pg_advisory_xact_lock(hashtextextended('v2.2.student|'||${c}||'|'||${s},0));
      select to_jsonb(e) into current_row from public.center_cloud_entities e where center_id=${c} and entity_type='student' and local_id=${s} for update;
      if current_row is distinct from ${asJson(student)} then raise exception 'QA reset refused: Student changed after snapshot';end if;
      select to_jsonb(e) into current_row from public.center_cloud_entities e where center_id=${c} and entity_type='class_session' and local_id=${classId} for update;
      if current_row is distinct from ${asJson(classRow)} then raise exception 'QA reset refused: class changed';end if;
      select to_jsonb(e) into current_row from public.center_cloud_entities e where center_id=${c} and entity_type='tuition_record_package' and local_id=${recordId} for update;
      if current_row is distinct from ${asJson(record)} or coalesce((current_row#>>'{payload,paidAmount}')::bigint,0)<>0 or current_row#>'{payload,payments}'<>'[]'::jsonb then raise exception 'QA reset refused: derived record changed or paid';end if;
      select to_jsonb(e) into current_row from public.center_tuition_package_cycles e where center_id=${c} and id=${cycleId}::uuid for update;
      if current_row is distinct from ${asJson(cycle)} then raise exception 'QA reset refused: cycle changed';end if;
      if (select count(*) from public.center_tuition_package_cycles where center_id=${c} and student_local_id=${s})<>1
       or exists(select 1 from public.center_tuition_package_cycles where predecessor_cycle_id=${cycleId}::uuid)
       or exists(select 1 from public.center_tuition_attendance_contributions where center_id=${c} and cycle_id=${cycleId}::uuid)
       or exists(select 1 from public.center_attendance_cycle_checkpoints where center_id=${c} and cycle_id=${cycleId}::uuid)
       or exists(select 1 from public.center_tuition_receipts where center_id=${c} and target_cycle_id=${cycleId}::uuid)
       or exists(select 1 from public.center_tuition_notices where center_id=${c} and target_cycle_id=${cycleId}::uuid)
       or exists(select 1 from public.finance_transaction f where center_id=${c} and (to_jsonb(f)::text like '%'||${s}||'%' or to_jsonb(f)::text like '%'||${cycleId}||'%'))
       or exists(select 1 from public.center_cloud_entities e where center_id=${c} and entity_type in ('schedule_session','attendance_record','session_report') and to_jsonb(e.payload)::text like '%'||${classId}||'%')
       or exists(select 1 from public.center_student_recurring_enrollments where center_id=${c} and class_session_local_id=${classId} and student_local_id<>${s})
      then raise exception 'QA reset refused: legitimate or financial dependencies exist';end if;
      select to_jsonb(e) into current_row from public.center_student_enrollment_sets e where center_id=${c} and student_local_id=${s} for update;
      if current_row is distinct from ${asJson(temporary.enrollmentSets[0])} then raise exception 'QA reset refused: enrollment set changed';end if;
      select to_jsonb(e) into current_row from public.center_student_recurring_enrollments e where id=${literal(temporary.enrollments[0].id)}::uuid for update;
      if current_row is distinct from ${asJson(temporary.enrollments[0])} or (select count(*) from public.center_student_recurring_enrollments where center_id=${c} and student_local_id=${s})<>1 then raise exception 'QA reset refused: enrollments changed';end if;
      result:=public.c5_1_mutate_core_entity(${c},'student',${s},${student.entity_version},${asJson(before.student.payload)},${literal(cleanupStudentKey)}::uuid,'UPSERT');
      if coalesce(result->>'ok','false')<>'true' then raise exception 'QA reset refused: canonical Student restore failed';end if;
      delete from public.center_student_recurring_enrollments where center_id=${c} and student_local_id=${s} and class_session_local_id=${classId} and id=${literal(temporary.enrollments[0].id)}::uuid;
      get diagnostics deleted_count=row_count;if deleted_count<>1 then raise exception 'QA enrollment delete count mismatch';end if;
      delete from public.center_student_enrollment_sets where center_id=${c} and student_local_id=${s} and version=1;
      get diagnostics deleted_count=row_count;if deleted_count<>1 then raise exception 'QA enrollment set delete count mismatch';end if;
      delete from public.center_tuition_package_cycles where center_id=${c} and student_local_id=${s} and id=${cycleId}::uuid;
      get diagnostics deleted_count=row_count;if deleted_count<>1 then raise exception 'QA cycle delete count mismatch';end if;
      delete from public.center_cloud_entities where center_id=${c} and entity_type='tuition_record_package' and local_id=${recordId} and id=${literal(record.id)}::uuid;
      get diagnostics deleted_count=row_count;if deleted_count<>1 then raise exception 'QA derived record delete count mismatch';end if;
      result:=public.c5_1_mutate_core_entity(${c},'class_session',${classId},1,'{}'::jsonb,${literal(cleanupClassKey)}::uuid,'DELETE');
      if result->>'outcome_code'<>'DELETED' then raise exception 'QA reset refused: canonical class deletion failed';end if;
    end $guard$;
    select jsonb_build_object('cleaned',true,'centerId',${c},'studentId',${s},'classId',${classId},'cycleId',${cycleId},'restoredStudentCommand',${literal(cleanupStudentKey)},'deletedClassCommand',${literal(cleanupClassKey)},'moneyWrites',0,'auditsRetained',true,'classRemoval','Canonical soft deletion; QA tombstone retained');commit;`
  fs.writeFileSync(`${folder}/cleanup.sql`,sql)
  const result=sqlQuery(sql)
  save('cleanup-result',{...result,cleanedAt:new Date().toISOString()})
  console.log(JSON.stringify(result))
}
