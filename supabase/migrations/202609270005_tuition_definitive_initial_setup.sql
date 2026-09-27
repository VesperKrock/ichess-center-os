begin;

-- Compose derived record creation and the frozen START_CYCLE authority in one
-- transaction. Existing records, Finance, receipts and attendance are retained.
do $guard$
begin
  if pg_catalog.to_regprocedure('public.v2_4_mutate_package_cycle_pre_definitive_initial_setup(text,jsonb,uuid)') is not null
     or pg_catalog.to_regprocedure('public.tuition_final_cycle_json(text,uuid,jsonb)') is null
     or pg_catalog.to_regprocedure('public.f5b_mutate_tuition_receipt(text,jsonb,uuid)') is null then
    raise exception 'tuition_definitive_unexpected_contract';
  end if;
  if position('opening_payment_state' in pg_catalog.pg_get_functiondef(
    'public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure)) = 0 then
    raise exception 'tuition_definitive_frozen_contract_missing';
  end if;
end
$guard$;

alter function public.v2_4_mutate_package_cycle(text,jsonb,uuid)
  rename to v2_4_mutate_package_cycle_pre_definitive_initial_setup;
revoke all on function public.v2_4_mutate_package_cycle_pre_definitive_initial_setup(text,jsonb,uuid)
  from public, anon, authenticated, service_role;

create function public.v2_4_mutate_package_cycle(p_center_id text, p_command jsonb, p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_member public.center_members;
  v_package public.center_tuition_package_catalog;
  v_previous public.center_tuition_cycle_command_results;
  v_student text := pg_catalog.btrim(coalesce(p_command->>'student_id',''));
  v_context text := pg_catalog.upper(coalesce(p_command->>'opening_context',''));
  v_payment text := pg_catalog.upper(coalesce(p_command->>'opening_payment_state',''));
  v_used integer;
  v_intent bytea;
  v_record_id text := 'tuition-initial:' || p_idempotency_key::text;
  v_local_id text := 'tuition_record_package::tuition-initial:' || p_idempotency_key::text;
  v_period text := 'tuition-period:' || p_idempotency_key::text;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_cutoff date := (pg_catalog.timezone('Asia/Ho_Chi_Minh', pg_catalog.now()))::date - 1;
  v_result jsonb;
begin
  if pg_catalog.upper(coalesce(p_command->>'operation','')) <> 'SETUP_INITIAL_CYCLE' then
    return public.v2_4_mutate_package_cycle_pre_definitive_initial_setup(p_center_id,p_command,p_idempotency_key);
  end if;
  if v_actor is null then raise exception 'v2_4_not_authenticated'; end if;
  if p_idempotency_key is null or pg_catalog.jsonb_typeof(p_command) <> 'object' or v_student='' then
    raise exception 'v2_4_invalid_command';
  end if;
  select * into v_member from public.v2_4_internal_active_membership(p_center_id,v_actor);
  if v_member.id is null then raise exception 'v2_4_center_access_denied'; end if;
  v_intent := extensions.digest(pg_catalog.convert_to(p_command::text,'UTF8'),'sha256');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'v2.4.command|' || p_center_id || '|' || v_actor::text || '|' || p_idempotency_key::text,0));
  select * into v_previous from public.center_tuition_cycle_command_results
    where center_id=p_center_id and actor_user_id=v_actor and idempotency_key=p_idempotency_key for update;
  if found then
    if v_previous.intent_digest<>v_intent then raise exception 'v2_4_idempotency_conflict'; end if;
    return v_previous.result_snapshot || pg_catalog.jsonb_build_object('replayed',true);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('v2.4.student|' || p_center_id || '|' || v_student,0));
  if not exists(select 1 from public.center_cloud_entities where center_id=p_center_id
    and entity_type='student' and local_id=v_student and deleted_at is null) then
    raise exception 'v2_4_student_not_found';
  end if;
  if exists(select 1 from public.center_tuition_package_cycles where center_id=p_center_id and student_local_id=v_student) then
    return pg_catalog.jsonb_build_object('ok',false,'outcome_code','CYCLE_ALREADY_STARTED');
  end if;
  if v_context not in ('NEW_ICHESS','LEGACY_BEFORE_ICHESS')
     or v_payment not in ('UNPAID','PAID_BEFORE_ICHESS')
     or coalesce(p_command->>'opening_pre_ichess_sessions','') !~ '^[0-9]+$' then
    raise exception 'v2_4_invalid_baseline';
  end if;
  v_used := (p_command->>'opening_pre_ichess_sessions')::integer;
  if (v_context='NEW_ICHESS' and (v_used<>0 or v_payment<>'UNPAID')) then
    raise exception 'v2_4_invalid_baseline';
  end if;
  if v_context='LEGACY_BEFORE_ICHESS' and not exists(select 1 from public.center_operational_profiles
    where center_id=p_center_id and initial_student_setup_enabled) then
    return pg_catalog.jsonb_build_object('ok',false,'outcome_code','INITIAL_SETUP_DISABLED');
  end if;
  select * into v_package from public.center_tuition_package_catalog
    where center_id=p_center_id and id=(p_command->>'package_catalog_id')::uuid and is_active for share;
  if v_package.id is null or v_used>v_package.total_sessions or v_package.default_amount is null then
    raise exception 'v2_4_package_not_available';
  end if;
  -- New derived record: never overwrite a source record that may have financial
  -- links. Its old identity/period, package facts and payment history stay intact.
  insert into public.center_cloud_entities(center_id,entity_type,local_id,payload,
    source_module,source_version,entity_version,created_by,updated_by)
  values(p_center_id,'tuition_record_package',v_local_id,pg_catalog.jsonb_build_object(
    'id',v_record_id,'studentId',v_student,'packageCatalogId',v_package.id,
    'packageName',v_package.package_name,'programName',v_package.program_name,
    'totalSessions',v_package.total_sessions,'usedSessions',v_used,
    'totalAmount',v_package.default_amount,'discountAmount',0,'discountType','none','discountValue',0,
    'paidAmount',0,'payments','[]'::jsonb,'termHistory','[]'::jsonb,
    'currentTermId',v_period,'currentTermNumber',1,'note','',
    'createdAt',v_now,'updatedAt',v_now,'initialSetupConfirmed',true),
    'hoc-phi','tuition-definitive-v1',1,v_actor,v_actor);
  v_result := public.v2_4_mutate_package_cycle_pre_definitive_initial_setup(p_center_id,
    pg_catalog.jsonb_build_object('operation','START_CYCLE','student_id',v_student,
      'tuition_local_id',v_local_id,'package_catalog_id',v_package.id,
      'baseline_used_sessions',v_used,'baseline_cutoff_date',v_cutoff,
      'baseline_review_note','Admin xác nhận thiết lập học phí ban đầu.',
      'opening_context',v_context,'opening_payment_state',v_payment),p_idempotency_key);
  if coalesce(v_result->>'ok','false')<>'true' then
    raise exception 'tuition_definitive_initial_setup_failed';
  end if;
  update public.center_tuition_cycle_command_results set intent_digest=v_intent
    where center_id=p_center_id and actor_user_id=v_actor and idempotency_key=p_idempotency_key;
  return v_result;
end
$function$;
revoke all on function public.v2_4_mutate_package_cycle(text,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.v2_4_mutate_package_cycle(text,jsonb,uuid) to authenticated;
comment on function public.v2_4_mutate_package_cycle(text,jsonb,uuid) is
  'Frozen Tuition command boundary. Atomic initial setup composes a new derived record and canonical Kỳ 1; old facts and all financial history are preserved.';

-- One statement-level read snapshot for all Tuition operator sections. Reuse
-- canonical authority projections and their membership checks; no second counter.
create function public.tuition_operator_read(p_center_id text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_cycles jsonb;
  v_receipts jsonb;
  v_settings jsonb;
begin
  v_cycles := public.v2_4_list_package_cycle_state(p_center_id);
  v_receipts := public.f5b_list_tuition_receipts(p_center_id);
  v_settings := public.v2_1_list_center_settings(p_center_id);
  if coalesce(v_cycles->>'ok','false')<>'true' or coalesce(v_receipts->>'ok','false')<>'true'
    or coalesce(v_settings->>'ok','false')<>'true' then
    return pg_catalog.jsonb_build_object('ok',false,'center_id',p_center_id);
  end if;
  return pg_catalog.jsonb_build_object('ok',true,'center_id',p_center_id,'contract','tuition-operator-v1',
    'cycle_state',v_cycles,'receipt_state',v_receipts,
    'initial_student_setup_enabled',v_settings#>'{center,initial_student_setup_enabled}',
    'default_collector_name',v_settings#>'{center,default_receipt_collector_name}',
    'students',(select coalesce(pg_catalog.jsonb_agg(e.payload || pg_catalog.jsonb_build_object('id',e.local_id)
      order by pg_catalog.lower(coalesce(e.payload->>'fullName','')),e.local_id),'[]'::jsonb)
      from public.center_cloud_entities e where e.center_id=p_center_id and e.entity_type='student' and e.deleted_at is null),
    'payment_category',(select pg_catalog.jsonb_build_object('id',c.id,'name',c.name)
      from public.finance_category c where c.center_id=p_center_id and c.name='Học phí' and not c.is_archived
      and c.category_type in ('INCOME','BOTH') order by c.created_at,c.id limit 1));
end
$function$;
revoke all on function public.tuition_operator_read(text) from public,anon,authenticated,service_role;
grant execute on function public.tuition_operator_read(text) to authenticated;

commit;
