-- LOCAL TEST PREIMAGE ONLY: known previously released NULL preservation; never apply this fixture remotely.
-- PREIMAGE_FIXTURE_BEGIN
-- PROPOSED ONLY. Not included in the approved nine-file release.
-- Requires separate Owner schema approval and one additional canonical repair command.
begin;
do $guard$ begin
if encode(sha256(convert_to(pg_get_functiondef('public.tuition_final_guard_cycle_terms()'::regprocedure),'UTF8')),'hex')<>'3e2016a7c9683bd348f154969d851b9845e9199c0810f9035e3a8c029b7c8304' then raise exception 'NULL_SNAPSHOT_TRIGGER_PREIMAGE_DRIFT'; end if;
if encode(sha256(convert_to(pg_get_functiondef('public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure),'UTF8')),'hex')<>'9d09fa28b89dd518c19109849385bd6c134c3357651da22651bb01a31395fce4' then raise exception 'NULL_SNAPSHOT_WRITER_PREIMAGE_DRIFT'; end if;
end $guard$;
CREATE OR REPLACE FUNCTION public.tuition_final_guard_cycle_terms()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_package public.center_tuition_package_catalog;
  v_tuition public.center_cloud_entities;
  v_profile public.center_operational_profiles;
begin
  if tg_op = 'UPDATE' and (
    new.package_catalog_id is distinct from old.package_catalog_id
    or new.package_name_snapshot is distinct from old.package_name_snapshot
    or new.program_name_snapshot is distinct from old.program_name_snapshot
    or new.total_sessions_snapshot is distinct from old.total_sessions_snapshot
    or new.price_snapshot is distinct from old.price_snapshot
    or new.discount_amount_snapshot is distinct from old.discount_amount_snapshot
    or new.discount_type_snapshot is distinct from old.discount_type_snapshot
    or new.discount_value_snapshot is distinct from old.discount_value_snapshot
    or new.material_fee_snapshot is distinct from old.material_fee_snapshot
  ) and not (
    -- Only restoration of the exact NULL-source corruption produced by the
    -- previous trigger. Normal package/price locks remain unchanged.
    new.initial_import_baseline_id is not null
    and new.initial_import_baseline_id = old.initial_import_baseline_id
    and new.package_catalog_id is not distinct from old.package_catalog_id
    and new.package_name_snapshot is not distinct from old.package_name_snapshot
    and new.program_name_snapshot is not distinct from old.program_name_snapshot
    and new.total_sessions_snapshot is not distinct from old.total_sessions_snapshot
    and new.price_snapshot is not distinct from old.price_snapshot
    and new.material_fee_snapshot is not distinct from old.material_fee_snapshot
    and old.discount_amount_snapshot = old.price_snapshot
    and old.discount_type_snapshot = 'none' and old.discount_value_snapshot is null
    and new.discount_amount_snapshot is null and new.discount_type_snapshot is null
    and new.discount_value_snapshot is null
    and exists(select 1 from public.center_tuition_initial_import_baselines b
      where b.id=new.initial_import_baseline_id and b.center_id=new.center_id
        and b.student_local_id=new.student_local_id and b.package_catalog_id=new.package_catalog_id
        and b.financial_facts->>'discountKind'='UNKNOWN')
    and not exists(select 1 from public.finance_transaction t where t.center_id=old.center_id and t.source_period_id=old.payment_period_id)
    and not exists(select 1 from public.center_tuition_receipts r where r.center_id=old.center_id and r.target_cycle_id=old.id)
  ) and (
    old.baseline_used_sessions > 0
    or exists (
      select 1 from public.center_tuition_attendance_contributions contribution
      where contribution.center_id = old.center_id and contribution.cycle_id = old.id
        and contribution.ended_at is null and contribution.allocation_state = 'APPLIED'
        and contribution.contribution_units = 1
    )
  ) then
    raise exception 'tuition_final_package_terms_locked';
  end if;

  if tg_op = 'INSERT' or new.package_catalog_id is distinct from old.package_catalog_id then
    if new.package_catalog_id is not null then
      select * into v_package from public.center_tuition_package_catalog package
      where package.center_id = new.center_id and package.id = new.package_catalog_id;
      if v_package.id is null then raise exception 'v2_4_package_not_available'; end if;
      new.package_name_snapshot := v_package.package_name;
      new.program_name_snapshot := v_package.program_name;
      new.total_sessions_snapshot := v_package.total_sessions;
      new.price_snapshot := v_package.default_amount;
      new.max_completion_weeks_snapshot := v_package.max_completion_weeks;
    end if;
    new.discount_amount_snapshot := 0;
    new.discount_type_snapshot := 'none';
    new.discount_value_snapshot := 0;
    new.material_fee_snapshot := 0;
    if new.cycle_number = 1 and tg_op = 'INSERT' then
      select * into v_tuition from public.center_cloud_entities tuition
      where tuition.center_id = new.center_id
        and tuition.entity_type = 'tuition_record_package'
        and tuition.local_id = new.tuition_local_id
        and tuition.deleted_at is null;
      if v_tuition.id is not null
         and v_tuition.payload->>'currentTermId' = new.payment_period_id then
        if coalesce(v_tuition.payload->>'totalAmount', '') ~ '^[0-9]+$' then
          new.price_snapshot := (v_tuition.payload->>'totalAmount')::bigint;
        end if;
        if coalesce(v_tuition.payload->>'discountAmount', '0') ~ '^[0-9]+$' then
          new.discount_amount_snapshot := least(
            (v_tuition.payload->>'discountAmount')::bigint,
            coalesce(new.price_snapshot, 0));
        end if;
        new.discount_type_snapshot := coalesce(nullif(v_tuition.payload->>'discountType', ''), 'none');
        if coalesce(v_tuition.payload->>'discountValue', '0') ~ '^[0-9]+([.][0-9]+)?$' then
          new.discount_value_snapshot := (v_tuition.payload->>'discountValue')::numeric;
        end if;
      end if;
    elsif new.package_catalog_id is not null then
      select * into v_profile from public.center_operational_profiles profile
      where profile.center_id = new.center_id;
      new.material_fee_snapshot := coalesce(v_profile.renewal_material_fee_minor, 0);
    end if;
  end if;
  if tg_op='INSERT' and new.initial_import_baseline_id is not null and exists(
    select 1 from public.center_tuition_initial_import_baselines b
    where b.id=new.initial_import_baseline_id and b.center_id=new.center_id
      and b.student_local_id=new.student_local_id and b.package_catalog_id=new.package_catalog_id
      and b.financial_facts->>'discountKind'='UNKNOWN'
  ) then
    new.discount_amount_snapshot := null;
    new.discount_type_snapshot := null;
    new.discount_value_snapshot := null;
  end if;
  return new;
end
$function$
;
CREATE OR REPLACE FUNCTION public.v2_4_mutate_package_cycle(p_center_id text, p_command jsonb, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid:=auth.uid(); member public.center_members; package public.center_tuition_package_catalog;
  existing public.center_tuition_initial_import_baselines; command public.center_tuition_cycle_command_results;
  student text:=btrim(coalesce(p_command->>'student_id','')); cutoff date; used integer; intent bytea; result jsonb;
begin
  if actor is null then raise exception 'v2_4_not_authenticated'; end if;
  select * into member from public.v2_4_internal_active_membership(p_center_id,actor);
  if member.id is null then raise exception 'v2_4_center_access_denied'; end if;
-- Spliced into the existing canonical V2.4 function, after membership validation.
if coalesce(p_command->>'operation','') = 'ADOPT_INITIAL_BASELINE' then
  declare
    b public.center_tuition_initial_import_baselines;
    c public.center_tuition_package_cycles;
    pkg public.center_tuition_package_catalog;
    prior public.center_tuition_cycle_command_results;
    digest bytea; answer jsonb; complete boolean; discount bigint;
    local_key text; period_key text; facts jsonb;
  begin
    if p_idempotency_key is null or jsonb_typeof(p_command)<>'object'
      or student='' or coalesce(p_command->>'expected_baseline_version','') !~ '^[1-9][0-9]*$'
      or coalesce(p_command->>'expected_package_version','') !~ '^[1-9][0-9]*$'
      or length(btrim(coalesce(p_command->>'review_note',''))) not between 8 and 1000
      or (p_command ? 'confirmed_payment_complete' and jsonb_typeof(p_command->'confirmed_payment_complete')<>'boolean')
    then raise exception 'INVALID_INITIAL_ADOPTION'; end if;
    perform pg_advisory_xact_lock(hashtextextended('v2.4.command|'||p_center_id||'|'||actor::text||'|'||p_idempotency_key::text,0));
    perform pg_advisory_xact_lock(hashtextextended('v2.4.student|'||p_center_id||'|'||student,0));
    digest:=extensions.digest(convert_to(p_command::text,'UTF8'),'sha256');
    select * into prior from public.center_tuition_cycle_command_results r
      where r.center_id=p_center_id and r.actor_user_id=actor and r.idempotency_key=p_idempotency_key for update;
    if found then
      if prior.intent_digest<>digest then raise exception 'v2_4_idempotency_conflict'; end if;
      return prior.result_snapshot||jsonb_build_object('replayed',true);
    end if;
    select * into b from public.center_tuition_initial_import_baselines x
      where x.center_id=p_center_id and x.student_local_id=student and x.id=(p_command->>'baseline_id')::uuid for update;
    if b.id is null then raise exception 'INITIAL_BASELINE_NOT_FOUND'; end if;
    if b.version<>(p_command->>'expected_baseline_version')::integer then raise exception 'INITIAL_BASELINE_VERSION_CONFLICT'; end if;
    if not exists(select 1 from public.center_cloud_entities s where s.center_id=p_center_id
      and s.entity_type='student' and s.local_id=student and s.deleted_at is null) then raise exception 'v2_4_student_not_found'; end if;
    facts:=b.financial_facts;
    if not public.v2_4_internal_validate_import_financial(facts,b.listed_price_minor_snapshot) then raise exception 'INITIAL_IMPORT_FINANCIAL_FACT_CONFLICT'; end if;
    complete:=case facts->>'paymentState' when 'PAID_BEFORE_ICHESS' then true
      when 'PARTIAL' then false when 'UNPAID' then false else null end;
    if p_command ? 'confirmed_payment_complete' then
      if complete is not null and complete<>(p_command->>'confirmed_payment_complete')::boolean then raise exception 'INITIAL_PAYMENT_CONFIRMATION_CONFLICT'; end if;
      complete:=(p_command->>'confirmed_payment_complete')::boolean;
    end if;
    select * into c from public.center_tuition_package_cycles x
      where x.center_id=p_center_id and x.student_local_id=student order by x.cycle_number limit 1 for update;
    if c.id is not null then
      if c.initial_import_baseline_id is distinct from b.id then raise exception 'INITIAL_ADOPTION_RECONCILIATION_REQUIRED'; end if;
      -- A new, explicitly approved command key may repair the verified old
      -- trigger defect on the SAME cycle. Same-key replay remains read-only.
      if facts->>'discountKind'='UNKNOWN' and c.discount_amount_snapshot is not null then
        if c.discount_amount_snapshot<>c.price_snapshot or c.discount_type_snapshot<>'none'
          or c.discount_value_snapshot is not null
          or exists(select 1 from public.finance_transaction t where t.center_id=p_center_id and t.source_period_id=c.payment_period_id)
          or exists(select 1 from public.center_tuition_receipts r where r.center_id=p_center_id and r.target_cycle_id=c.id)
        then raise exception 'INITIAL_ADOPTION_RECONCILIATION_REQUIRED'; end if;
        update public.center_tuition_package_cycles set discount_amount_snapshot=null,
          discount_type_snapshot=null,discount_value_snapshot=null,version=version+1,
          updated_by=actor,updated_at=clock_timestamp() where id=c.id returning * into c;
        insert into public.center_tuition_cycle_audit_events(center_id,actor_user_id,action,entity_type,entity_id,after_state,command_idempotency_key)
        values(p_center_id,actor,'INITIAL_FINANCIAL_SNAPSHOT_REPAIRED','PACKAGE_CYCLE',c.id,
          jsonb_build_object('cycle',to_jsonb(c),'baseline_id',b.id,'source_financial_facts',facts,
            'reason','Restore unknown source discount as NULL; no financial transaction'),p_idempotency_key);
      end if;
      if c.opening_payment_complete is distinct from complete then
        if c.opening_payment_complete is not null or complete is null or facts->>'paymentState'<>'UNKNOWN'
          or exists(select 1 from public.finance_transaction t where t.center_id=p_center_id and t.source_period_id=c.payment_period_id)
          or exists(select 1 from public.center_tuition_receipts r where r.center_id=p_center_id and r.target_cycle_id=c.id)
        then raise exception 'INITIAL_ADOPTION_RECONCILIATION_REQUIRED'; end if;
        update public.center_tuition_package_cycles set opening_payment_complete=complete,
          opening_payment_state=case when complete then 'PAID_BEFORE_ICHESS' else 'UNPAID' end,
          baseline_review_note=p_command->>'review_note',version=version+1,updated_by=actor,updated_at=clock_timestamp()
          where id=c.id returning * into c;
        insert into public.center_tuition_cycle_audit_events(center_id,actor_user_id,action,entity_type,entity_id,after_state,command_idempotency_key)
        values(p_center_id,actor,'INITIAL_PAYMENT_INPUT_CONFIRMED','PACKAGE_CYCLE',c.id,to_jsonb(c),p_idempotency_key);
      end if;
      answer:=jsonb_build_object('ok',true,'outcome_code','ALREADY_ADOPTED','center_id',p_center_id,'student_id',student,'cycle_id',c.id,'baseline_id',b.id,'reused',true);
    else
      select * into pkg from public.center_tuition_package_catalog p where p.center_id=p_center_id and p.id=b.package_catalog_id for share;
      if pkg.id is null or pkg.version<>(p_command->>'expected_package_version')::integer then raise exception 'INITIAL_IMPORT_PACKAGE_VERSION_CONFLICT'; end if;
      if pkg.total_sessions<>b.total_sessions_snapshot or pkg.default_amount<>b.listed_price_minor_snapshot then raise exception 'INITIAL_IMPORT_PACKAGE_FACT_CONFLICT'; end if;
      if b.baseline_cutoff_date>((clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date-1) then raise exception 'INITIAL_IMPORT_CUTOFF_REVIEW_REQUIRED'; end if;
      discount:=case when facts->>'sourceDueMinor' is null then null else b.listed_price_minor_snapshot-(facts->>'sourceDueMinor')::bigint end;
      local_key:='tuition_record_package::initial-import:'||b.id::text;
      period_key:='initial-import:'||b.id::text;
      -- Derived current-term record, owned by V2.4. No Finance/payment/history is invented.
      insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,entity_version,created_by,updated_by)
      values(p_center_id,'tuition_record_package',local_key,jsonb_build_object(
        'id',local_key,'studentId',student,'packageCatalogId',pkg.id,'packageName',b.package_name_snapshot,
        'programName',pkg.program_name,'totalSessions',b.total_sessions_snapshot,'usedSessions',b.baseline_used_sessions,
        'totalAmount',b.listed_price_minor_snapshot,'discountAmount',discount,
        'discountType',case when discount is null then null else facts->>'discountKind' end,
        'discountValue',case when discount is null then null else discount end,
        'currentTermId',period_key,'currentTermNumber',1,'payments','[]'::jsonb,'termHistory','[]'::jsonb,
        'sourceInitialBaselineId',b.id,'initialSetupConfirmed',true,'createdAt',clock_timestamp(),'updatedAt',clock_timestamp()),
        'hoc-phi','v2.4-adopt-current-v1',1,actor,actor);
      insert into public.center_tuition_package_cycles(center_id,student_local_id,tuition_local_id,cycle_number,
        package_catalog_id,package_name_snapshot,program_name_snapshot,total_sessions_snapshot,price_snapshot,
        payment_period_id,baseline_used_sessions,baseline_cutoff_date,baseline_review_note,lifecycle_status,origin,
        opening_context,opening_payment_state,discount_amount_snapshot,discount_type_snapshot,discount_value_snapshot,
        initial_import_baseline_id,opening_payment_complete,created_by,updated_by)
      values(p_center_id,student,local_key,1,pkg.id,b.package_name_snapshot,pkg.program_name,b.total_sessions_snapshot,
        b.listed_price_minor_snapshot,period_key,b.baseline_used_sessions,b.baseline_cutoff_date,p_command->>'review_note','ACTIVE','OPERATOR_BASELINE',
        'LEGACY_BEFORE_ICHESS',case when complete then 'PAID_BEFORE_ICHESS' else 'UNPAID' end,
        discount,case when discount is null then null else facts->>'discountKind' end,discount,b.id,complete,actor,actor) returning * into c;
      perform public.v2_4_internal_reconcile_student(p_center_id,student,actor);
      insert into public.center_tuition_cycle_audit_events(center_id,actor_user_id,action,entity_type,entity_id,after_state,command_idempotency_key)
      values(p_center_id,actor,'INITIAL_CURRENT_CYCLE_ADOPTED','PACKAGE_CYCLE',c.id,
        jsonb_build_object('cycle',to_jsonb(c),'baseline_id',b.id,'source_financial_facts',facts,
          'confirmed_payment_complete',complete,'review_note',p_command->>'review_note'),p_idempotency_key);
      answer:=jsonb_build_object('ok',true,'outcome_code','COMMITTED','center_id',p_center_id,'student_id',student,
        'cycle_id',c.id,'baseline_id',b.id,'cycle_number',1,'replayed',false);
    end if;
    insert into public.center_tuition_cycle_command_results(center_id,actor_user_id,idempotency_key,intent_digest,result_snapshot)
    values(p_center_id,actor,p_idempotency_key,digest,answer);
    return answer;
  end;
end if;

  if coalesce(p_command->>'operation','')<>'IMPORT_INITIAL_BASELINE' then
    -- Serialize the guard with the original opener's student lock. An opener
    -- waiting behind an import must observe the committed pending baseline.
    if student<>'' then
      perform pg_advisory_xact_lock(hashtextextended('v2.4.student|'||p_center_id||'|'||student,0));
    end if;
    if exists(select 1 from public.center_tuition_initial_import_baselines b where b.center_id=p_center_id and b.student_local_id=student)
       and not exists(select 1 from public.center_tuition_package_cycles c where c.center_id=p_center_id and c.student_local_id=student) then
      raise exception 'INITIAL_IMPORT_FINANCIAL_REVIEW_REQUIRED';
    end if;
    return public.v2_4_mutate_package_cycle_pre_initial_import(p_center_id,p_command,p_idempotency_key);
  end if;
  if p_idempotency_key is null or student='' or jsonb_typeof(p_command)<>'object'
     or not (p_command ?& array['package_catalog_id','expected_package_version','total_sessions','baseline_used_sessions','baseline_cutoff_date','listed_price_minor','financial_facts'])
     or coalesce(p_command->>'expected_package_version','') !~ '^[1-9][0-9]*$'
     or coalesce(p_command->>'total_sessions','') !~ '^[1-9][0-9]*$'
     or coalesce(p_command->>'baseline_used_sessions','') !~ '^[0-9]+$'
     or coalesce(p_command->>'listed_price_minor','') !~ '^[0-9]+$'
     or coalesce(p_command->>'baseline_cutoff_date','') !~ '^\d{4}-\d{2}-\d{2}$'
     or coalesce(p_command->>'source_sha256','') !~ '^[0-9a-f]{64}$'
     or coalesce(p_command->>'source_key','') !~ '^[0-9a-f]{64}$'
     or length(btrim(coalesce(p_command->>'review_note',''))) not between 8 and 1000 then raise exception 'INVALID_INITIAL_IMPORT'; end if;
  perform pg_advisory_xact_lock(hashtextextended('v2.4.initialimport.command|'||p_center_id||'|'||actor::text||'|'||p_idempotency_key::text,0));
  perform pg_advisory_xact_lock(hashtextextended('v2.4.student|'||p_center_id||'|'||student,0));
  intent:=extensions.digest(convert_to(p_command::text,'UTF8'),'sha256');
  select * into command from public.center_tuition_cycle_command_results r
    where r.center_id=p_center_id and r.actor_user_id=actor and r.idempotency_key=p_idempotency_key for update;
  if found then
    if command.intent_digest<>intent then raise exception 'v2_4_idempotency_conflict'; end if;
    return command.result_snapshot || jsonb_build_object('replayed',true);
  end if;
  if not exists(select 1 from public.center_cloud_entities s where s.center_id=p_center_id and s.entity_type='student' and s.local_id=student and s.deleted_at is null) then raise exception 'v2_4_student_not_found'; end if;
  select * into existing from public.center_tuition_initial_import_baselines b where b.center_id=p_center_id and b.student_local_id=student for update;
  if existing.id is not null then raise exception 'INITIAL_IMPORT_ALREADY_EXISTS_RECONCILE'; end if;
  if exists(select 1 from public.center_tuition_package_cycles c where c.center_id=p_center_id and c.student_local_id=student)
    or exists(select 1 from public.center_cloud_entities t where t.center_id=p_center_id and t.entity_type='tuition_record_package' and t.deleted_at is null and t.payload->>'studentId'=student) then raise exception 'v2_4_cycle_already_started'; end if;
  select * into package from public.center_tuition_package_catalog c where c.center_id=p_center_id and c.id=(p_command->>'package_catalog_id')::uuid and c.is_active for share;
  if package.id is null or package.version<>(p_command->>'expected_package_version')::integer then raise exception 'INITIAL_IMPORT_PACKAGE_VERSION_CONFLICT'; end if;
  if package.total_sessions<>(p_command->>'total_sessions')::integer or package.default_amount<>(p_command->>'listed_price_minor')::bigint then raise exception 'INITIAL_IMPORT_PACKAGE_FACT_CONFLICT'; end if;
  used:=(p_command->>'baseline_used_sessions')::integer; cutoff:=(p_command->>'baseline_cutoff_date')::date;
  if used is null or used not between 0 and package.total_sessions or cutoff is null
     or cutoff>((clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date-1) then raise exception 'INITIAL_IMPORT_CUTOFF_REVIEW_REQUIRED'; end if;
  if not coalesce(public.v2_4_internal_validate_import_financial(p_command->'financial_facts',package.default_amount),false) then raise exception 'INITIAL_IMPORT_FINANCIAL_FACT_CONFLICT'; end if;
  insert into public.center_tuition_initial_import_baselines(center_id,student_local_id,package_catalog_id,package_name_snapshot,total_sessions_snapshot,listed_price_minor_snapshot,baseline_used_sessions,baseline_cutoff_date,source_sha256,source_key,financial_facts,review_note,created_by)
  values(p_center_id,student,package.id,package.package_name,package.total_sessions,package.default_amount,used,cutoff,p_command->>'source_sha256',p_command->>'source_key',p_command->'financial_facts',p_command->>'review_note',actor) returning * into existing;
  result:=jsonb_build_object('ok',true,'outcome_code','COMMITTED','center_id',p_center_id,'student_id',student,'baseline_id',existing.id,'financial_state',existing.financial_state,'fully_configured',false,'replayed',false);
  insert into public.center_tuition_cycle_command_results(center_id,actor_user_id,idempotency_key,intent_digest,result_snapshot) values(p_center_id,actor,p_idempotency_key,intent,result);
  insert into public.center_tuition_cycle_audit_events(center_id,actor_user_id,action,entity_type,entity_id,after_state) values(p_center_id,actor,'INITIAL_IMPORT_BASELINE_SAVED','INITIAL_IMPORT_BASELINE',existing.id,to_jsonb(existing));
  return result;
end $function$
;
commit;

-- PREIMAGE_FIXTURE_END
-- Synthetic fixtures in the runner's rollback-only LOCAL transaction.
insert into auth.users(id,email) values
 ('17101700-0000-4000-8000-000000009001','recurring-local@localhost.invalid'),
 ('17101700-0000-4000-8000-000000009002','recurring-other@localhost.invalid');
insert into public.centers(id,name,environment,status) values
 ('recurring_local_qa','Recurring policy LOCAL','test','active'),
 ('recurring_other_qa','Other LOCAL fixture','test','active');
insert into public.center_members(center_id,user_id,role,status) values
 ('recurring_local_qa','17101700-0000-4000-8000-000000009001','center_admin','active'),
 ('recurring_other_qa','17101700-0000-4000-8000-000000009002','center_admin','active');
update public.center_operational_profiles set renewal_material_fee_minor=80000 where center_id='recurring_local_qa';
update public.center_crm_control set crm_state='ACTIVE',feature_flag_state='ENABLED',control_version=control_version+1
 where center_id='recurring_local_qa';
insert into public.center_tuition_package_catalog(id,center_id,package_name,total_sessions,default_amount,is_active,
 created_by_membership_id,updated_by_membership_id)
 select ('17101700-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'recurring_local_qa',
 'Local package '||n,n,price,true,m.id,m.id
 from (values(8,1375000),(16,2750000),(24,4125000),(48,8250000),(32,5000000)) p(n,price)
 join public.center_members m on m.center_id='recurring_local_qa';
insert into public.center_tuition_package_catalog(id,center_id,package_name,total_sessions,default_amount,is_active,
 created_by_membership_id,updated_by_membership_id)
 select '17101700-0000-4000-8000-000000000116','recurring_other_qa','Other local package',16,1600000,true,id,id
 from public.center_members where center_id='recurring_other_qa';
insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,created_by,updated_by)
 select 'recurring_local_qa','student',s,jsonb_build_object('id',s,'fullName','Local fixture '||s,
   'birthYear',2018,'birthDate','','birthDatePrecision','YEAR_ONLY'),'qa','local-rollback',
 '17101700-0000-4000-8000-000000009001','17101700-0000-4000-8000-000000009001'
 from unnest(array['b2-5','b2-6','b2-7','b2-8','b2-12','b2-14','b2-15','b2-16','b2-18',
   'legacy','unknown','mixed','mismatch','automatic','early-end','policy-lock','one-off-local']) s;
insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,created_by,updated_by)
 values('recurring_other_qa','student','other-student','{"id":"other-student","fullName":"Other local fixture","birthYear":2018}',
 'qa','local-rollback','17101700-0000-4000-8000-000000009002','17101700-0000-4000-8000-000000009002');
create temp table original_students as select local_id,payload,entity_version from public.center_cloud_entities
 where center_id='recurring_local_qa' and entity_type='student';
-- Operational-installation fixture visible only in this rollback transaction.
-- No reset/bootstrap command is invoked; the original local state is restored.
update public.installation_handoff_control set installation_state='TESTER_ACTIVE' where singleton_id=1;
insert into public.installation_center_epochs(center_id,installation_epoch,epoch_status)
 select c,installation_epoch,'CURRENT' from public.installation_handoff_control,
 unnest(array['recurring_local_qa','recurring_other_qa']) c;
select set_config('request.jwt.claims','{"sub":"17101700-0000-4000-8000-000000009002","role":"authenticated"}',true);
select public.v2_4_mutate_package_cycle('recurring_other_qa',
 '{"operation":"SETUP_INITIAL_CYCLE","student_id":"other-student","package_catalog_id":"17101700-0000-4000-8000-000000000116","opening_pre_ichess_sessions":0,"opening_context":"NEW_ICHESS","opening_payment_state":"UNPAID"}',
 '17101700-0000-4000-8000-000000008002');
create temp table other_cycle_before as select id,to_jsonb(c) snapshot from public.center_tuition_package_cycles c
 where center_id='recurring_other_qa';
select set_config('request.jwt.claims','{"sub":"17101700-0000-4000-8000-000000009001","role":"authenticated"}',true);

create function pg_temp.check_ok(ok boolean,label text) returns void language plpgsql as $f$
begin if ok is distinct from true then raise exception 'QA_ASSERT: %',label; end if; end $f$;
create function pg_temp.expect_error(statement text,message text) returns void language plpgsql as $f$
begin
  begin execute statement; raise exception 'QA_ERROR_NOT_RAISED';
  exception when others then if strpos(sqlerrm,message)=0 then raise; end if; end;
end $f$;
create function pg_temp.adopt(s text,n integer,a integer,kind text,pct integer,fixed bigint,voucher bigint,policy jsonb)
returns uuid language plpgsql as $f$
declare price bigint; due bigint; facts jsonb; r jsonb; command jsonb; b uuid; package uuid;
begin
  package:=('17101700-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
  select default_amount into price from public.center_tuition_package_catalog where id=package;
  due:=case when kind='UNKNOWN' then null else price*(100-pct)/100-fixed-voucher end;
  facts:=jsonb_build_object('discountKind',kind,'percent',case when kind='UNKNOWN' then null else pct end,
    'fixedMinor',case when kind='UNKNOWN' then null else fixed end,
    'siblingVoucherMinor',case when kind='UNKNOWN' then null else voucher end,
    'paymentState',case when kind='UNKNOWN' then 'UNKNOWN' else 'PAID_BEFORE_ICHESS' end,
    'sourceDueMinor',due,'collectedMinor',due,'remainingMinor',case when kind='UNKNOWN' then null else 0 end);
  r:=public.v2_4_mutate_package_cycle('recurring_local_qa',jsonb_build_object(
    'operation','IMPORT_INITIAL_BASELINE','student_id',s,'package_catalog_id',package,'expected_package_version',1,
    'total_sessions',n,'baseline_used_sessions',a,
    'baseline_cutoff_date',((clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date-1)::text,
    'listed_price_minor',price,'source_sha256',repeat('1',64),'source_key',encode(extensions.digest(s,'sha256'),'hex'),
    'review_note','Local source fixture, no historical financial transaction','financial_facts',facts),md5(s||':import')::uuid);
  b:=(r->>'baseline_id')::uuid;
  command:=jsonb_build_object('operation','ADOPT_INITIAL_BASELINE','student_id',s,'baseline_id',b,
    'expected_baseline_version',1,'expected_package_version',1,'review_note','Local current term, not an issued receipt');
  if policy is not null then command:=command||jsonb_build_object('recurring_discount_policy',policy); end if;
  r:=public.v2_4_mutate_package_cycle('recurring_local_qa',command,md5(s||':adopt')::uuid);
  perform pg_temp.check_ok(r->>'outcome_code'='COMMITTED','adoption committed '||s);
  perform pg_temp.check_ok(public.v2_4_mutate_package_cycle('recurring_local_qa',command,md5(s||':adopt')::uuid)->>'replayed'='true','adoption replay');
  return (r->>'cycle_id')::uuid;
end $f$;

do $qa$
declare row record; policy jsonb; c uuid; next_id uuid; after_next uuid; r jsonb; doc jsonb;
  current_row public.center_tuition_package_cycles; next_row public.center_tuition_package_cycles;
  before_money jsonb; command jsonb; key uuid; before_count integer; snap jsonb;
  finance_command jsonb; payment_command jsonb; category uuid; i integer; attendance_id text;
  fixture_date date:=(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  for row in select * from (values
    ('b2-5',8,6,'FIXED',0,100000),('b2-6',8,5,'FIXED',0,100000),
    ('b2-7',8,7,'FIXED',0,100000),('b2-8',8,7,'FIXED',0,100000),
    ('b2-12',16,1,'PERCENT',5,0),('b2-14',24,2,'PERCENT',10,0),
    ('b2-15',16,15,'PERCENT',5,0),('b2-16',48,3,'PERCENT',10,0),('b2-18',24,14,'PERCENT',10,0)
  ) f(s,n,a,kind,pct,fixed) loop
    policy:=jsonb_build_object('schemaVersion',1,'discountKind',row.kind,'percent',row.pct,'fixedMinor',row.fixed,'siblingVoucherMinor',0);
    c:=pg_temp.adopt(row.s,row.n,row.a,row.kind,row.pct,row.fixed,0,policy);
    snap:=public.v2_4_list_package_cycle_state('recurring_local_qa');
    perform pg_temp.check_ok(exists(select 1 from jsonb_array_elements(snap->'students') s
      where s->>'student_id'=row.s and s#>>'{current_cycle,used_sessions}'=row.a::text
      and s#>>'{current_cycle,remaining_sessions}'=(row.n-row.a)::text
      and s#>'{current_cycle,recurring_discount_policy}'=policy and s#>>'{current_cycle,initial_import,payment_complete}'='true'),
      'B2 progress/policy/payment '||row.s);
  end loop;
  perform pg_temp.check_ok((select count(*)=9 from public.center_tuition_package_cycles where center_id='recurring_local_qa'),'exactly9 B2 current terms');

  -- NULL-policy legacy and unknown source remain untouched.
  c:=pg_temp.adopt('legacy',16,16,'EXPLICIT_NONE',0,0,0,null);
  perform pg_temp.check_ok((select recurring_discount_policy is null and baseline_used_sessions=16 from public.center_tuition_package_cycles where id=c),'legacy exhausted remains unchanged');
  c:=pg_temp.adopt('unknown',16,5,'UNKNOWN',0,0,0,null);
  perform pg_temp.check_ok((select discount_amount_snapshot is null and recurring_discount_policy is null from public.center_tuition_package_cycles where id=c),'UNKNOWN NULL not0');

  -- A nonzero one-off discount is current money, not a future entitlement.
  c:=pg_temp.adopt('one-off-local',16,2,'PERCENT',5,0,0,null);
  select * into current_row from public.center_tuition_package_cycles where id=c;
  perform pg_temp.check_ok(current_row.recurring_discount_policy is null and current_row.discount_amount_snapshot=137500,'one-off current discount retained');
  perform pg_temp.check_ok(not exists(select 1 from public.center_tuition_package_cycles where predecessor_cycle_id=c),'adoption does not pre-open a successor');
  r:=public.v2_4_mutate_package_cycle('recurring_local_qa',jsonb_build_object('operation','PREPARE_NEXT_CYCLE',
    'student_id','one-off-local','current_cycle_id',c,'expected_version',current_row.version,
    'package_catalog_id',current_row.package_catalog_id),md5('one-off-local:prepare')::uuid);
  perform pg_temp.check_ok(r->>'outcome_code'='COMMITTED','explicit preparation of one-off successor');
  perform pg_temp.check_ok(exists(select 1 from public.center_tuition_package_cycles where predecessor_cycle_id=c
    and recurring_discount_policy is null and discount_amount_snapshot=0),'ONE_OFF5PERCENT_NOT_REPEATED');

  -- Policy must agree with the verified source, atomically.
  policy:='{"schemaVersion":1,"discountKind":"PERCENT","percent":10,"fixedMinor":0,"siblingVoucherMinor":0}';
  perform pg_temp.expect_error(format('select pg_temp.adopt(%L,16,2,%L,5,0,0,%L::jsonb)','mismatch','PERCENT',policy::text),'RECURRING_POLICY_SOURCE_FACT_CONFLICT');
  perform pg_temp.check_ok(not exists(select 1 from public.center_tuition_initial_import_baselines where student_local_id='mismatch' and center_id='recurring_local_qa'),'mismatch whole subtransaction rolled back');

  -- Prepare early, change package price, and preserve source-paid money.
  select * into current_row from public.center_tuition_package_cycles where center_id='recurring_local_qa' and student_local_id='b2-12';
  before_money:=to_jsonb(current_row)-array['recurring_discount_policy','version','updated_at','updated_by'];
  r:=public.v2_4_mutate_package_cycle('recurring_local_qa',jsonb_build_object('operation','PREPARE_NEXT_CYCLE',
    'student_id','b2-12','current_cycle_id',current_row.id,'expected_version',current_row.version,
    'package_catalog_id',current_row.package_catalog_id),md5('prepare-early')::uuid);
  next_id:=(r->>'cycle_id')::uuid;
  select * into next_row from public.center_tuition_package_cycles where id=next_id;
  perform pg_temp.check_ok(next_row.recurring_discount_policy=current_row.recurring_discount_policy and next_row.discount_amount_snapshot=137500,'prepare inherits5percent');
  perform pg_temp.check_ok(next_row.opening_payment_state='UNPAID' and next_row.opening_payment_complete is null,'never carry source paid truth');
  perform pg_temp.check_ok(next_row.baseline_used_sessions=0 and next_row.material_fee_snapshot=80000,'new progress and material fee unchanged');
  r:=public.v2_4_mutate_package_cycle('recurring_local_qa',jsonb_build_object('operation','SELECT_PROVISIONAL_PACKAGE',
    'student_id','b2-12','cycle_id',next_id,'expected_version',next_row.version,
    'package_catalog_id','17101700-0000-4000-8000-000000000032'),md5('change-package')::uuid);
  select * into next_row from public.center_tuition_package_cycles where id=next_id;
  perform pg_temp.check_ok(next_row.price_snapshot=5000000 and next_row.discount_amount_snapshot=250000,'recalculate5percent on NEW price');
  doc:=public.tbhp_get_printable_document('recurring_local_qa',next_id);
  perform pg_temp.check_ok(doc->>'ok'='true','TBHP successor preview ready');
  perform pg_temp.check_ok((doc#>>'{document,snapshot,money,totalAmount}')::bigint=4830000,'TBHP amount includes discount then material fee');

  -- Future changes require both versions; current price/discount/payment stay frozen.
  select * into current_row from public.center_tuition_package_cycles where id=current_row.id;
  policy:='{"schemaVersion":1,"discountKind":"PERCENT","percent":10,"fixedMinor":0,"siblingVoucherMinor":0}';
  command:=jsonb_build_object('operation','SET_RECURRING_DISCOUNT_POLICY','student_id','b2-12','cycle_id',current_row.id,
    'expected_version',current_row.version,'recurring_discount_policy',policy);
  perform pg_temp.expect_error(format('select public.v2_4_mutate_package_cycle(%L,%L::jsonb,%L::uuid)','recurring_local_qa',command::text,md5('missing-successor-version')),'RECURRING_POLICY_SUCCESSOR_VERSION_CONFLICT');
  command:=command||jsonb_build_object('successor_cycle_id',next_id,'expected_successor_version',next_row.version);
  key:=md5('change-future-rule')::uuid;
  r:=public.v2_4_mutate_package_cycle('recurring_local_qa',command,key);
  perform pg_temp.check_ok(r->>'ok'='true','SET policy committed');
  perform pg_temp.check_ok(public.v2_4_mutate_package_cycle('recurring_local_qa',command,key)->>'replayed'='true','SET policy replay');
  select * into current_row from public.center_tuition_package_cycles where id=current_row.id;
  perform pg_temp.check_ok(to_jsonb(current_row)-array['recurring_discount_policy','version','updated_at','updated_by']=before_money,'current money/progress frozen after policy change');
  select * into next_row from public.center_tuition_package_cycles where id=next_id;
  perform pg_temp.check_ok(next_row.discount_amount_snapshot=500000,'unlocked successor repriced10percent');
  command:=command||jsonb_build_object('expected_version',current_row.version,'expected_successor_version',next_row.version,'recurring_discount_policy',null);
  r:=public.v2_4_mutate_package_cycle('recurring_local_qa',command,md5('cancel-future-rule')::uuid);
  perform pg_temp.check_ok((select recurring_discount_policy is null and discount_amount_snapshot=0 from public.center_tuition_package_cycles where id=next_id),'explicit cancel future-only');

  -- Manual early END_CYCLE creates the same policy-bearing successor.
  policy:='{"schemaVersion":1,"discountKind":"FIXED","percent":0,"fixedMinor":100000,"siblingVoucherMinor":0}';
  c:=pg_temp.adopt('early-end',8,2,'FIXED',0,100000,0,policy);
  select * into current_row from public.center_tuition_package_cycles where id=c;
  r:=public.v2_4_mutate_package_cycle('recurring_local_qa',jsonb_build_object('operation','END_CYCLE','student_id','early-end','cycle_id',c,'expected_version',current_row.version),md5('early-end')::uuid);
  perform pg_temp.check_ok(exists(select 1 from public.center_tuition_package_cycles where predecessor_cycle_id=c and recurring_discount_policy=policy and discount_amount_snapshot=100000),'END_CYCLE carries FIXED');
  perform pg_temp.check_ok((select discount_amount_snapshot=100000 and baseline_used_sessions=2 from public.center_tuition_package_cycles where id=c),'END does not change current history');

  -- Percent before sibling voucher, still a typed recurring expression.
  policy:='{"schemaVersion":1,"discountKind":"PERCENT_THEN_SIBLING_VOUCHER","percent":20,"fixedMinor":0,"siblingVoucherMinor":100000}';
  c:=pg_temp.adopt('mixed',16,2,'PERCENT_THEN_SIBLING_VOUCHER',20,0,100000,policy);
  perform pg_temp.check_ok((select price_snapshot-discount_amount_snapshot=2100000 from public.center_tuition_package_cycles where id=c),'percent BEFORE voucher');

  perform pg_temp.expect_error($q$select public.v2_4_internal_recurring_discount_amount('{"schemaVersion":1,"discountKind":"FIXED","percent":0,"fixedMinor":100000,"siblingVoucherMinor":0}',50000)$q$,'RECURRING_DISCOUNT_AMOUNT_INVALID');
  perform pg_temp.expect_error($q$select public.v2_4_internal_recurring_discount_amount('{"schemaVersion":1,"discountKind":"PERCENT","percent":5,"fixedMinor":0,"siblingVoucherMinor":0}',10001)$q$,'RECURRING_DISCOUNT_AMOUNT_INVALID');
  perform pg_temp.expect_error($q$select public.v2_4_internal_recurring_discount_amount('{"schemaVersion":1,"discountKind":"PERCENT","percent":101,"fixedMinor":0,"siblingVoucherMinor":0}',1000000)$q$,'INVALID_RECURRING_DISCOUNT_POLICY');
  perform pg_temp.expect_error($q$select public.v2_4_internal_recurring_discount_amount('{"schemaVersion":1,"discountKind":"FIXED","percent":0,"fixedMinor":-1,"siblingVoucherMinor":0}',1000000)$q$,'INVALID_RECURRING_DISCOUNT_POLICY');
  perform pg_temp.check_ok(not exists(select 1 from public.finance_transaction where center_id='recurring_local_qa'),'preview/policy/adoption no Finance');
  perform pg_temp.check_ok(not exists(select 1 from public.center_tuition_receipts where center_id='recurring_local_qa'),'preview/policy/adoption no Receipt');

  -- Local Attendance INPUT fixtures exercise the unchanged reconcile authority.
  -- They exist only inside this rollback transaction, never in production.
  policy:='{"schemaVersion":1,"discountKind":"FIXED","percent":0,"fixedMinor":100000,"siblingVoucherMinor":0}';
  c:=pg_temp.adopt('automatic',8,8,'FIXED',0,100000,0,policy);
  for i in 1..9 loop
    insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,created_by,updated_by)
    values('recurring_local_qa','schedule_session','local-session-'||i,jsonb_build_object('id','local-session-'||i,
      'date',fixture_date,'scheduleType','oneOff','studentIds',jsonb_build_array('automatic')),
      'qa','local-rollback','17101700-0000-4000-8000-000000009001','17101700-0000-4000-8000-000000009001');
    attendance_id:=public.v2_3_internal_occurrence_attendance_local_id('recurring_local_qa','local-session-'||i,fixture_date,'automatic');
    insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,source_module,source_version,created_by,updated_by)
    values('recurring_local_qa','attendance_record',attendance_id,jsonb_build_object('id',attendance_id,'authorityLocalId',attendance_id,
      'studentId','automatic','attendanceAuthority','v2.3-occurrence-v1','attendanceStatus','present',
      'source','admin','status','present','date',fixture_date::text,'scheduleSessionId','local-session-'||i,'sessionId','local-session-'||i,
      'tuitionPolicyDefined',false,'tuitionAutoUpdateEnabled',false,'tuitionConsumptionApplied',false,
      'countsTowardTuition',false,'counted',false,'creditValue',0),
      'qa','local-rollback','17101700-0000-4000-8000-000000009001','17101700-0000-4000-8000-000000009001');
  end loop;
  perform public.v2_4_internal_reconcile_student('recurring_local_qa','automatic','17101700-0000-4000-8000-000000009001');
  perform pg_temp.check_ok((select count(*)=3 and bool_and(recurring_discount_policy=policy) and bool_and(discount_amount_snapshot=100000)
    from public.center_tuition_package_cycles where center_id='recurring_local_qa' and student_local_id='automatic'),'automatic carry through TWO successors');
  perform pg_temp.check_ok((select count(*)=9 from public.center_tuition_attendance_contributions where center_id='recurring_local_qa' and student_local_id='automatic' and ended_at is null),'canonical contributions counted ONCE');
  select * into current_row from public.center_tuition_package_cycles where id=c;
  select * into next_row from public.center_tuition_package_cycles where predecessor_cycle_id=c;
  command:=jsonb_build_object('operation','SET_RECURRING_DISCOUNT_POLICY','student_id','automatic','cycle_id',c,
    'expected_version',current_row.version,'successor_cycle_id',next_row.id,'expected_successor_version',next_row.version,
    'recurring_discount_policy',null);
  perform pg_temp.expect_error(format('select public.v2_4_mutate_package_cycle(%L,%L::jsonb,%L::uuid)',
    'recurring_local_qa',command::text,md5('closed-attendance-history')),'v2_4_stale_version');
  update public.center_cloud_entities set deleted_at=clock_timestamp() where center_id='recurring_local_qa' and entity_type='attendance_record' and payload->>'studentId'='automatic';
  perform public.v2_4_internal_reconcile_student('recurring_local_qa','automatic','17101700-0000-4000-8000-000000009001');
  perform pg_temp.check_ok((select count(*)=2 from public.center_tuition_package_cycles where center_id='recurring_local_qa' and student_local_id='automatic' and lifecycle_status='SUPERSEDED'),'unused rollover superseded');
  update public.center_cloud_entities set deleted_at=null where center_id='recurring_local_qa' and entity_type='attendance_record' and payload->>'studentId'='automatic';
  perform public.v2_4_internal_reconcile_student('recurring_local_qa','automatic','17101700-0000-4000-8000-000000009001');
  perform pg_temp.check_ok((select count(*)=3 and bool_and(recurring_discount_policy=policy) from public.center_tuition_package_cycles where center_id='recurring_local_qa' and student_local_id='automatic'),'reactivation does not duplicate or lose policy');

  -- Canonical F5B payment/Receipt for synthetic LOCAL money only, rolled back.
  policy:='{"schemaVersion":1,"discountKind":"PERCENT","percent":5,"fixedMinor":0,"siblingVoucherMinor":0}';
  c:=pg_temp.adopt('policy-lock',16,1,'PERCENT',5,0,0,policy);
  select * into current_row from public.center_tuition_package_cycles where id=c;
  r:=public.v2_4_mutate_package_cycle('recurring_local_qa',jsonb_build_object('operation','PREPARE_NEXT_CYCLE',
    'student_id','policy-lock','current_cycle_id',c,'expected_version',current_row.version,
    'package_catalog_id',current_row.package_catalog_id),md5('prepare-lock')::uuid);
  next_id:=(r->>'cycle_id')::uuid;
  select * into next_row from public.center_tuition_package_cycles where id=next_id;
  select id into category from public.finance_category where center_id='recurring_local_qa' and name='Học phí' and not is_archived;
  finance_command:=jsonb_build_object('operation','CREATE_TRANSACTION','transaction_id','17101700-0000-4000-8000-000000007001',
    'expected_version',0,'local_source_id','local-recurring-payment','cashflow_type','INCOME','category_id',category,
    'amount_minor',2692500,'transaction_date',(clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date::text,
    'method','transfer','person_name','LOCAL synthetic payer','recorded_by_name','LOCAL collector','note','LOCAL rollback fixture',
    'source_module','hoc-phi','source_type','tuition-payment','source_payment_id','local-recurring-payment',
    'source_tuition_id',next_row.tuition_local_id,'source_student_id','policy-lock','source_parent_id','',
    'source_period_id',next_row.payment_period_id,'attachment_action','KEEP');
  payment_command:=jsonb_build_object('operation','RECORD_PAYMENT','receipt_id','17101700-0000-4000-8000-000000007002',
    'target_cycle_id',next_id,'expected_cycle_version',next_row.version,'finance_command',finance_command);
  r:=public.f5b_mutate_tuition_receipt('recurring_local_qa',payment_command,'17101700-0000-4000-8000-000000007003');
  perform pg_temp.check_ok(r->>'outcome_code'='COMMITTED','F5B paid exactly discounted tuition + material fee');
  perform pg_temp.check_ok(public.f5b_mutate_tuition_receipt('recurring_local_qa',payment_command,'17101700-0000-4000-8000-000000007003')->>'replayed'='true','F5B retry no second receipt');
  select * into next_row from public.center_tuition_package_cycles where id=next_id;
  before_money:=to_jsonb(next_row);
  command:=jsonb_build_object('operation','SET_RECURRING_DISCOUNT_POLICY','student_id','policy-lock','cycle_id',c,
    'expected_version',current_row.version,'successor_cycle_id',next_id,'expected_successor_version',next_row.version,
    'recurring_discount_policy',jsonb_build_object('schemaVersion',1,'discountKind','PERCENT','percent',10,'fixedMinor',0,'siblingVoucherMinor',0));
  perform pg_temp.expect_error(format('select public.v2_4_mutate_package_cycle(%L,%L::jsonb,%L::uuid)',
    'recurring_local_qa',command::text,md5('locked-policy')),'RECURRING_POLICY_SUCCESSOR_LOCKED');
  perform pg_temp.check_ok((select to_jsonb(x)=before_money from public.center_tuition_package_cycles x where id=next_id),'paid successor NOT repriced');
  perform public.f5b_list_tuition_receipts('recurring_local_qa');
  perform public.f5b_list_tuition_receipts('recurring_local_qa');
  perform pg_temp.check_ok((select count(*)=1 from public.finance_transaction where center_id='recurring_local_qa'),'exactly one synthetic LOCAL payment');
  perform pg_temp.check_ok((select count(*)=1 from public.center_tuition_receipts where center_id='recurring_local_qa'),'exactly one synthetic LOCAL receipt');
  perform pg_temp.check_ok((select (snapshot#>>'{money,totalAmountDue}')::bigint=2692500
    and (snapshot#>>'{money,amountReceived}')::bigint=2692500
    and (snapshot#>>'{money,remainingAfterPayment}')::bigint=0
    from public.center_tuition_receipts where id='17101700-0000-4000-8000-000000007002'),'Receipt amount uses canonical discount');
  perform pg_temp.check_ok(not exists(select 1 from original_students o join public.center_cloud_entities s on s.center_id='recurring_local_qa' and s.entity_type='student' and s.local_id=o.local_id where s.payload<>o.payload or s.entity_version<>o.entity_version),'all Student YEAR_ONLY payloads unchanged');
  perform pg_temp.check_ok((select count(*)=1 and bool_and(to_jsonb(other_cycle)=b.snapshot) from other_cycle_before b
    join public.center_tuition_package_cycles other_cycle on other_cycle.id=b.id),'other-center NULL-policy cycle unchanged');
  perform pg_temp.check_ok(has_function_privilege('authenticated','public.v2_4_mutate_package_cycle(text,jsonb,uuid)','execute'),'canonical Auth execute');
  perform pg_temp.check_ok(not has_function_privilege('authenticated','public.v2_4_internal_recurring_discount_amount(jsonb,bigint)','execute'),'helper not public RPC');
  perform pg_temp.check_ok(not has_table_privilege('authenticated','public.center_tuition_package_cycles','insert'),'no raw cycle INSERT grant');
  perform pg_temp.check_ok(not exists(select 1 from recurring_function_contract_before b join pg_proc p on p.oid=b.oid
    where (p.proargtypes,p.prorettype,p.proowner,p.proacl,p.prosecdef,p.proconfig) is distinct from
      (b.proargtypes,b.prorettype,b.proowner,b.proacl,b.prosecdef,b.proconfig)),'three function signatures/owners/ACL/security unchanged');
  select * into current_row from public.center_tuition_package_cycles where center_id='recurring_local_qa' and student_local_id='legacy' and cycle_number=1;
  perform pg_temp.expect_error(format(
    'insert into public.center_tuition_package_cycles(center_id,student_local_id,tuition_local_id,cycle_number,predecessor_cycle_id,payment_period_id,baseline_cutoff_date,lifecycle_status,origin,created_by,updated_by) values(%L,%L,%L,2,%L::uuid,%L,current_date,%L,%L,%L::uuid,%L::uuid)',
    'recurring_other_qa','legacy',current_row.tuition_local_id,current_row.id,'invalid-cross-center','NEEDS_PACKAGE_SELECTION','AUTOMATIC_ROLLOVER',
    auth.uid(),auth.uid()),'RECURRING_POLICY_PREDECESSOR_SCOPE_CONFLICT');
end $qa$;

-- Actual authenticated role can read, but the actor cannot cross centers.
create temp table recurring_auth_command as
 select jsonb_build_object('operation','SET_RECURRING_DISCOUNT_POLICY','student_id',student_local_id,
   'cycle_id',id,'expected_version',version,'recurring_discount_policy',null) command
 from public.center_tuition_package_cycles where center_id='recurring_local_qa' and student_local_id='b2-16';
grant select on recurring_auth_command to authenticated;
set local role authenticated;
select case when public.v2_4_list_package_cycle_state('recurring_local_qa')->>'ok'='true' then 'AUTHENTICATED_READ_PASS' else 'FAIL' end;
select case when public.v2_4_mutate_package_cycle('recurring_local_qa',(select command from pg_temp.recurring_auth_command),
 '17101700-0000-4000-8000-000000008001')->>'ok'='true' then 'AUTHENTICATED_WRITE_PASS' else 'FAIL' end;
reset role;
select pg_temp.expect_error($q$select public.v2_4_mutate_package_cycle('recurring_other_qa',
 '{"operation":"SET_RECURRING_DISCOUNT_POLICY","student_id":"b2-5","cycle_id":"17101700-0000-4000-8000-000000000099","expected_version":1,"recurring_discount_policy":null}',
 '17101700-0000-4000-8000-000000000999')$q$,'v2_4_center_access_denied');
select jsonb_build_object('canonical_snapshot',public.v2_4_list_package_cycle_state('recurring_local_qa'),
 'students',(select jsonb_agg(payload) from public.center_cloud_entities where center_id='recurring_local_qa' and entity_type='student'),
 'post_functions',(select jsonb_agg(jsonb_build_object('name',proname,'sha256',encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex'),
   'owner',pg_get_userbyid(proowner),'acl',proacl,'security_definer',prosecdef)) from pg_proc
   where oid in ('public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure,
     'public.tuition_final_guard_cycle_terms()'::regprocedure,'public.tuition_final_cycle_json(text,uuid,jsonb)'::regprocedure,
     'public.v2_4_internal_recurring_discount_amount(jsonb,bigint)'::regprocedure)));
select 'RECURRING_POLICY_DB_QA_PASS';
