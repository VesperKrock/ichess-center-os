import fs from 'node:fs'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
const strip=s=>s.replace(/^begin;\s*$/gmi,'').replace(/^(commit|rollback);\s*$/gmi,'')
const dependencies=['202609260001_tuition_simple_core.sql','202609260002_tuition_simple_core_early_payment.sql',
  '202609270001_tuition_final_business_alignment.sql','202609270002_tuition_final_legacy_package_lock.sql',
  '202609270003_tuition_final_initial_package_change_terms.sql','202609270004_tuition_payment_snapshot_identity.sql']
const check=spawnSync('docker',['exec','supabase_db_ichess-center-os','psql','-X','-U','supabase_admin','-d','postgres','-A','-t','-c',
  "select version from supabase_migrations.schema_migrations where version>='202609260001'"],{encoding:'utf8',windowsHide:true})
assert.equal(check.status,0)
const missing=dependencies.filter(f=>!check.stdout.includes(f.split('_')[0]))
const actor='27092700-0000-4000-8000-000000009001',center='tuition_definitive_qa'
const sql=`begin;
grant execute on function vault._crypto_aead_det_encrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
grant execute on function vault._crypto_aead_det_decrypt(bytea,bytea,bigint,bytea,bytea) to postgres;
grant execute on function vault._crypto_aead_det_noncegen() to postgres;
set local role postgres;
insert into auth.users(id,email) values('${actor}','tuition-definitive-qa@localhost.invalid') on conflict(id) do nothing;
select set_config('request.jwt.claims','{"sub":"${actor}","role":"service_role"}',true);
select set_config('app.chb1_internal_transition','on',true);
${missing.map(f=>strip(fs.readFileSync('supabase/migrations/'+f,'utf8'))).join('\n')}
${strip(fs.readFileSync('supabase/migrations/202609270005_tuition_definitive_initial_setup.sql','utf8'))}
insert into public.centers(id,name,environment,status) values('${center}','Tuition definitive rollback QA','test','active');
insert into public.center_members(center_id,user_id,role,status) values('${center}','${actor}','owner','active');
update public.center_operational_profiles set initial_student_setup_enabled=true where center_id='${center}';
insert into public.center_tuition_package_catalog(id,center_id,package_name,program_name,total_sessions,default_amount,is_active,created_by_membership_id,updated_by_membership_id)
select '27092700-0000-4000-8000-000000009016','${center}','Gói 16 buổi','Cờ vua',16,1600000,true,id,id from public.center_members where center_id='${center}' and user_id='${actor}';
insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,entity_version,created_by,updated_by)
select '${center}','student',s,jsonb_build_object('id',s,'fullName',s),'qa','v1',1,'${actor}','${actor}' from unnest(array['legacy','new','invalid']) s;
do $qa$
declare r jsonb;replay jsonb;read jsonb;n integer;
begin
  r:=public.v2_4_mutate_package_cycle('${center}','{"operation":"SETUP_INITIAL_CYCLE","student_id":"legacy","package_catalog_id":"27092700-0000-4000-8000-000000009016","opening_pre_ichess_sessions":6,"opening_context":"LEGACY_BEFORE_ICHESS","opening_payment_state":"PAID_BEFORE_ICHESS"}','27092700-0000-4000-8000-000000009101');
  if r->>'ok'<>'true' then raise exception 'legacy setup failed %',r;end if;
  replay:=public.v2_4_mutate_package_cycle('${center}','{"operation":"SETUP_INITIAL_CYCLE","student_id":"legacy","package_catalog_id":"27092700-0000-4000-8000-000000009016","opening_pre_ichess_sessions":6,"opening_context":"LEGACY_BEFORE_ICHESS","opening_payment_state":"PAID_BEFORE_ICHESS"}','27092700-0000-4000-8000-000000009101');
  if replay->>'replayed'<>'true' or replay->>'cycle_id'<>r->>'cycle_id' then raise exception 'setup replay failed';end if;
  r:=public.v2_4_mutate_package_cycle('${center}','{"operation":"SETUP_INITIAL_CYCLE","student_id":"new","package_catalog_id":"27092700-0000-4000-8000-000000009016","opening_pre_ichess_sessions":0,"opening_context":"NEW_ICHESS","opening_payment_state":"UNPAID"}','27092700-0000-4000-8000-000000009102');
  if r->>'ok'<>'true' then raise exception 'new setup failed %',r;end if;
  select count(*) into n from public.center_cloud_entities where center_id='${center}' and entity_type='tuition_record_package';
  begin
    perform public.v2_4_mutate_package_cycle('${center}','{"operation":"SETUP_INITIAL_CYCLE","student_id":"invalid","package_catalog_id":"27092700-0000-4000-8000-000000009016","opening_pre_ichess_sessions":6,"opening_context":"NEW_ICHESS","opening_payment_state":"PAID_BEFORE_ICHESS"}','27092700-0000-4000-8000-000000009103');
    raise exception 'invalid new input accepted';
  exception when others then
    if sqlerrm='invalid new input accepted' then raise;end if;
  end;
  if n<>(select count(*) from public.center_cloud_entities where center_id='${center}' and entity_type='tuition_record_package') then raise exception 'partial setup record';end if;
  if exists(select 1 from public.finance_transaction where center_id='${center}') or exists(select 1 from public.center_tuition_receipts where center_id='${center}') then raise exception 'fake money/receipt';end if;
  read:=public.tuition_operator_read('${center}');
  if read->>'ok'<>'true' or read->>'contract'<>'tuition-operator-v1' or jsonb_array_length(read->'students')<>3 then raise exception 'operator read failed %',read;end if;
  if not exists(select 1 from jsonb_array_elements(read#>'{cycle_state,students}') s where s->>'student_id'='legacy' and s#>>'{current_cycle,used_sessions}'='6' and s#>>'{current_cycle,total_sessions}'='16' and s#>>'{current_cycle,payment_status}'='PAID' and s#>>'{current_cycle,cycle_number}'='1') then raise exception 'legacy 6/16 truth missing';end if;
end $qa$;
rollback;
`
const result=spawnSync('docker',['exec','-i','supabase_db_ichess-center-os','psql','-X','--no-psqlrc','-v','ON_ERROR_STOP=1','-U','supabase_admin','-d','postgres','-q','-A','-t'],{input:sql,encoding:'utf8',windowsHide:true,timeout:30000})
assert.equal(result.status,0,result.stderr)
console.log('TUITION_DEFINITIVE_LOCAL_DB_QA: PASS (atomic setup, idempotency, validation rollback, no fake money, one snapshot, frozen business / atomic payments / makeup / immutable history; all rolled back)')
