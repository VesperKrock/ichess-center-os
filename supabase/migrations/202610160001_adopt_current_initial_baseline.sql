-- LOCAL DRAFT. Separate Owner approval is required before production apply.
-- Same V2.4/RPC/Attendance/TBHP authorities. No new public writer or importer UI.
begin;
do $adoption_guard$ begin
if encode(sha256(convert_to(pg_get_functiondef('public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure),'UTF8')),'hex')<>'c18d7af6b6569cc0341a9d4f1feddccd0af631667a482c321cfb05ec9b96b205' then raise exception 'ADOPTION_FUNCTION_DRIFT: v2_4_mutate_package_cycle'; end if;
if encode(sha256(convert_to(pg_get_functiondef('public.tuition_final_cycle_json(text,uuid,jsonb)'::regprocedure),'UTF8')),'hex')<>'58cb1d4ec4a13616708250589616cd2cdce7c9c9a6c6a1fcd1d70348debc0047' then raise exception 'ADOPTION_FUNCTION_DRIFT: tuition_final_cycle_json'; end if;
if encode(sha256(convert_to(pg_get_functiondef('public.tbhp_get_printable_document(text,uuid)'::regprocedure),'UTF8')),'hex')<>'effcef202b0c46be5288d97ab33b3596018d32601daf29a56122b5851b63a6d3' then raise exception 'ADOPTION_FUNCTION_DRIFT: tbhp_get_printable_document'; end if;
if encode(sha256(convert_to(pg_get_functiondef('public.f5b_mutate_tuition_receipt(text,jsonb,uuid)'::regprocedure),'UTF8')),'hex')<>'f48964058d26618ec5a5c262ba11eddd668acc0889d3041df68a1719da33f4f7' then raise exception 'ADOPTION_FUNCTION_DRIFT: f5b_mutate_tuition_receipt'; end if;
end $adoption_guard$;
alter table public.center_tuition_package_cycles
  add column initial_import_baseline_id uuid references public.center_tuition_initial_import_baselines(id),
  add column opening_payment_complete boolean,
  alter column discount_amount_snapshot drop not null,
  alter column discount_type_snapshot drop not null,
  alter column discount_value_snapshot drop not null;
create unique index center_tuition_cycles_initial_baseline_unique
  on public.center_tuition_package_cycles(initial_import_baseline_id) where initial_import_baseline_id is not null;
-- Normal cycles retain their NOT NULL behavior; only verified source-backed
-- cycles may retain unknown financial input as NULL, never a made-up zero.
alter table public.center_tuition_package_cycles add constraint center_tuition_cycles_financial_snapshot_presence check
 (initial_import_baseline_id is not null or (discount_amount_snapshot is not null and discount_type_snapshot is not null and discount_value_snapshot is not null));
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
CREATE OR REPLACE FUNCTION public.tuition_final_cycle_json(p_center_id text, p_cycle_id uuid, p_base jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_base || pg_catalog.jsonb_build_object(
    'tuition_local_id', cycle.tuition_local_id,
    'payment_period_id', cycle.payment_period_id,
    'version', cycle.version,
    'package_catalog_id', cycle.package_catalog_id,
    'price', cycle.price_snapshot,
    'discount_amount', cycle.discount_amount_snapshot,
    'discount_type', cycle.discount_type_snapshot,
    'discount_value', cycle.discount_value_snapshot,
    'material_fee', cycle.material_fee_snapshot,
    'amount_due', case when cycle.price_snapshot is null then null else
      cycle.price_snapshot - cycle.discount_amount_snapshot + cycle.material_fee_snapshot end,
    'opening_context', cycle.opening_context,
    'opening_payment_state', cycle.opening_payment_state,
    'manually_ended_at', cycle.manually_ended_at,
    'expired_sessions', cycle.expired_sessions_snapshot,
    'baseline_used', cycle.baseline_used_sessions,
    'contributed_sessions', projection.contributed_sessions,
    'used_sessions', projection.used_sessions,
    'remaining_sessions', projection.remaining_sessions,
    'paid_amount', projection.paid_amount,
    'payment_status', projection.payment_status
  )
 || case when cycle.initial_import_baseline_id is null then '{}'::jsonb else jsonb_build_object(
    'initial_import', jsonb_build_object('baseline_id',baseline.id,'financial_facts',baseline.financial_facts,
      'payment_complete',cycle.opening_payment_complete,'review_note',cycle.baseline_review_note),
    'payment_status',case when cycle.opening_payment_complete or projection.payment_status='PAID' then 'PAID'
      when cycle.opening_payment_complete=false then 'UNPAID' else null end,
    'paid_amount',case when baseline.financial_facts->>'collectedMinor' is null then null
      else (baseline.financial_facts->>'collectedMinor')::bigint + projection.paid_amount end,
    'amount_outstanding',case when cycle.opening_payment_complete or projection.payment_status='PAID' then 0
      when baseline.financial_facts->>'remainingMinor' is null then null
      else greatest((baseline.financial_facts->>'remainingMinor')::bigint-projection.paid_amount,0) end,
    'amount_due',case when baseline.financial_facts->>'sourceDueMinor' is null then null
      else (baseline.financial_facts->>'sourceDueMinor')::bigint end) end
  from public.center_tuition_package_cycles cycle
  join public.center_tuition_package_cycle_projection projection
    on projection.center_id = cycle.center_id and projection.id = cycle.id
  left join public.center_tuition_initial_import_baselines baseline
    on baseline.center_id=cycle.center_id and baseline.id=cycle.initial_import_baseline_id
  where cycle.center_id = p_center_id and cycle.id = p_cycle_id
$function$
;
CREATE OR REPLACE FUNCTION public.tbhp_get_printable_document(p_center_id text, p_cycle_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_membership public.center_members;
  v_cycle public.center_tuition_package_cycles;
  v_package public.center_tuition_package_catalog;
  v_profile public.center_operational_profiles;
  v_center public.centers;
  v_student public.center_cloud_entities;
  v_tuition public.center_cloud_entities;
  v_projection public.center_tuition_package_cycle_projection;
  v_schedule_rows jsonb;
  v_material bigint := 0;
  v_base bigint := 0;
  v_discount bigint := 0;
  v_discount_type text := 'none';
  v_due_date text := '';
  v_registration text;
  v_registration_label text;
  v_transfer_content text;
  v_issued_at timestamptz := pg_catalog.clock_timestamp();
  v_snapshot jsonb;
begin
  if v_actor is null then raise exception 'tbhp_not_authenticated'; end if;
  if p_cycle_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_FOUND');
  end if;
  select * into v_membership
  from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'tbhp_center_access_denied'; end if;

  select * into v_cycle
  from public.center_tuition_package_cycles cycle
  where cycle.center_id = p_center_id and cycle.id = p_cycle_id;
  if v_cycle.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_FOUND');
  end if;
  if v_cycle.initial_import_baseline_id is not null and v_cycle.discount_amount_snapshot is null then
    return jsonb_build_object('ok',false,'outcome_code','SOURCE_FINANCIAL_DETAILS_MISSING');
  end if;
  if v_cycle.package_catalog_id is null
     or v_cycle.total_sessions_snapshot is null
     or v_cycle.total_sessions_snapshot < 1
     or v_cycle.price_snapshot is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'PACKAGE_NOT_DEFINED');
  end if;

  select * into v_student from public.center_cloud_entities entity
  where entity.center_id = p_center_id and entity.entity_type = 'student'
    and entity.local_id = v_cycle.student_local_id and entity.deleted_at is null;
  select * into v_tuition from public.center_cloud_entities entity
  where entity.center_id = p_center_id and entity.entity_type = 'tuition_record_package'
    and entity.local_id = v_cycle.tuition_local_id and entity.deleted_at is null;
  select * into v_profile from public.center_operational_profiles profile
  where profile.center_id = p_center_id;
  select * into v_center from public.centers center_row where center_row.id = p_center_id;
  select * into v_package from public.center_tuition_package_catalog package
  where package.center_id = p_center_id and package.id = v_cycle.package_catalog_id;
  select * into v_projection from public.center_tuition_package_cycle_projection projection
  where projection.center_id = p_center_id and projection.id = v_cycle.id;
  if v_student.id is null or v_tuition.id is null or v_profile.center_id is null
     or v_package.id is null or v_projection.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'AUTHORITATIVE_SOURCE_MISSING');
  end if;

  v_registration := case when v_cycle.cycle_number = 1 then 'NEW_REGISTRATION' else 'RENEWAL' end;
  v_registration_label := case when v_cycle.cycle_number = 1 then 'Đăng ký mới' else 'Tái đăng ký' end;
  v_base := v_cycle.price_snapshot;
  v_discount := v_cycle.discount_amount_snapshot;
  v_discount_type := v_cycle.discount_type_snapshot;
  v_material := v_cycle.material_fee_snapshot;
  if coalesce(v_tuition.payload->>'dueDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_due_date := v_tuition.payload->>'dueDate';
  end if;
  v_schedule_rows := public.tbhp_internal_schedule_rows(
    p_center_id, v_cycle.id, v_cycle.student_local_id,
    v_cycle.total_sessions_snapshot, v_cycle.predecessor_cycle_id
  );
  v_transfer_content := pg_catalog.left(pg_catalog.regexp_replace(
    pg_catalog.btrim(coalesce(v_student.payload->>'fullName', 'Hoc vien'))
      || ' HP K' || v_cycle.cycle_number::text,
    '[^[:alnum:] ]', '', 'g'
  ), 120);
  v_snapshot := pg_catalog.jsonb_build_object(
    'documentType', 'TUITION_NOTICE',
    'noticeId', v_cycle.id,
    'issuedAt', v_issued_at,
    'registration', pg_catalog.jsonb_build_object(
      'code', v_registration, 'label', v_registration_label
    ),
    'center', pg_catalog.jsonb_build_object(
      'id', p_center_id,
      'name', coalesce(v_profile.display_name, v_center.name, p_center_id),
      'address', v_profile.address,
      'phone', v_profile.phone,
      'website', 'www.ichess.edu.vn'
    ),
    'student', pg_catalog.jsonb_build_object(
      'id', v_cycle.student_local_id,
      'name', pg_catalog.btrim(coalesce(v_student.payload->>'fullName', ''))
    ),
    'tuition', pg_catalog.jsonb_build_object(
      'tuitionLocalId', v_cycle.tuition_local_id,
      'targetCycleId', v_cycle.id,
      'targetPeriodId', v_cycle.payment_period_id,
      'termNumber', v_cycle.cycle_number,
      'packageCatalogId', v_cycle.package_catalog_id,
      'packageName', v_cycle.package_name_snapshot,
      'programName', coalesce(v_cycle.program_name_snapshot, ''),
      'learningForm', v_registration_label,
      'totalSessions', v_cycle.total_sessions_snapshot,
      'maxCompletionWeeks', v_cycle.max_completion_weeks_snapshot
    ),
    'currentProgress', pg_catalog.jsonb_build_object(
      'usedSessions', v_projection.used_sessions,
      'totalSessions', v_cycle.total_sessions_snapshot
    ),
    'paymentWindow', pg_catalog.jsonb_build_object(
      'from', current_date,
      'to', nullif(v_due_date, '')
    ),
    'money', pg_catalog.jsonb_build_object(
      'tuitionAmount', v_base,
      'discountAmount', v_discount,
      'materialFee', v_material,
      'totalAmount', v_base - v_discount + v_material,
      'discountExplanation', case when v_discount > 0 then v_discount_type else '' end
    ),
    'notes', case when v_cycle.max_completion_weeks_snapshot is null then '[]'::jsonb else
      pg_catalog.jsonb_build_array(
        'Thời gian tối đa hoàn thành khóa: ' || v_cycle.max_completion_weeks_snapshot || ' tuần.'
      ) end,
    'transfer', pg_catalog.jsonb_build_object(
      'accountNumber', '442228866',
      'beneficiary', 'CÔNG TY TNHH ICHESS VIET NAM',
      'bank', 'Ngân hàng TMCP Á Châu (ACB)',
      'content', v_transfer_content
    ),
    'scheduleRows', v_schedule_rows
  );
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'PRINTABLE_DOCUMENT',
    'center_id', p_center_id,
    'document', pg_catalog.jsonb_build_object(
      'id', v_cycle.id,
      'student_id', v_cycle.student_local_id,
      'tuition_local_id', v_cycle.tuition_local_id,
      'target_cycle_id', v_cycle.id,
      'target_period_id', v_cycle.payment_period_id,
      'target_term_number', v_cycle.cycle_number,
      'total_sessions', v_cycle.total_sessions_snapshot,
      'snapshot', v_snapshot,
      'version', v_cycle.version,
      'issued_at', v_issued_at
    )
  );
end
$function$
;
CREATE OR REPLACE FUNCTION public.f5b_mutate_tuition_receipt(p_center_id text, p_command jsonb, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid := auth.uid();
  v_membership public.center_members;
  v_existing public.center_tuition_receipt_command_results;
  v_cycle public.center_tuition_package_cycles;
  v_cycle_id uuid;
  v_amount bigint;
  v_prior bigint;
  v_required bigint;
begin
  if pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', ''))) <> 'RECORD_PAYMENT' then
    return public.f5b_mutate_tuition_receipt_pre_final_business_alignment(
      p_center_id, p_command, p_idempotency_key);
  end if;
  if v_actor is null then raise exception 'f5b_not_authenticated'; end if;
  select * into v_membership from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'f5b_center_access_denied'; end if;
  select * into v_existing from public.center_tuition_receipt_command_results result
  where result.center_id = p_center_id and result.actor_user_id = v_actor
    and result.idempotency_key = p_idempotency_key;
  if v_existing.idempotency_key is not null then
    return public.f5b_mutate_tuition_receipt_pre_final_business_alignment(
      p_center_id, p_command, p_idempotency_key);
  end if;
  begin
    v_cycle_id := (p_command->>'target_cycle_id')::uuid;
    v_amount := (p_command#>>'{finance_command,amount_minor}')::bigint;
  exception when others then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
  end;
  select * into v_cycle from public.center_tuition_package_cycles cycle
  where cycle.center_id = p_center_id and cycle.id = v_cycle_id for update;
  if v_cycle.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_FOUND');
  end if;
  if v_cycle.opening_payment_state = 'PAID_BEFORE_ICHESS' then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CYCLE_ALREADY_PAID');
  end if;
  if v_cycle.initial_import_baseline_id is not null then
    if v_cycle.opening_payment_complete is null or v_cycle.discount_amount_snapshot is null
      or exists(select 1 from public.center_tuition_initial_import_baselines b where b.center_id=p_center_id
        and b.id=v_cycle.initial_import_baseline_id
        and (b.financial_facts->>'collectedMinor' is null or b.financial_facts->>'remainingMinor' is null)) then
      return jsonb_build_object('ok',false,'outcome_code','SOURCE_FINANCIAL_DETAILS_MISSING');
    end if;
    if exists(select 1 from public.center_tuition_initial_import_baselines b
      where b.center_id=p_center_id and b.id=v_cycle.initial_import_baseline_id
        and (b.financial_facts->>'collectedMinor')::bigint>0) then
      return jsonb_build_object('ok',false,'outcome_code','HISTORICAL_OPENING_CREDIT_REQUIRED');
    end if;
  end if;
  v_required := v_cycle.price_snapshot - v_cycle.discount_amount_snapshot
    + v_cycle.material_fee_snapshot;
  select coalesce(pg_catalog.sum(transaction.amount_minor), 0) into v_prior
  from public.finance_transaction transaction
  where transaction.center_id = p_center_id and transaction.status = 'POSTED'
    and transaction.source_module = 'hoc-phi' and transaction.source_type = 'tuition-payment'
    and transaction.source_tuition_id = v_cycle.tuition_local_id
    and transaction.source_period_id = v_cycle.payment_period_id;
  if v_prior <> 0 then
    return pg_catalog.jsonb_build_object('ok', false,
      'outcome_code', 'EXISTING_PARTIAL_PAYMENT_REVIEW_REQUIRED');
  end if;
  if v_amount <> v_required then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'FULL_PAYMENT_REQUIRED',
      'required_amount_minor', v_required);
  end if;
  return public.f5b_mutate_tuition_receipt_pre_final_business_alignment(
    p_center_id, p_command, p_idempotency_key);
end
$function$
;
notify pgrst, 'reload schema';
commit;
