begin;

-- Add a verified package/baseline pending financial review to the existing
-- V2.4 boundary. No cycles, Attendance, Finance, receipts or CRM events are
-- fabricated. Existing writer signatures and read contract remain unchanged.
do $guard$
begin
  if to_regprocedure('public.v2_4_mutate_package_cycle(text,jsonb,uuid)') is null
     or to_regprocedure('public.v2_4_list_package_cycle_state(text)') is null
     or to_regprocedure('public.v2_4_internal_consumption_units(text)') is null
     or to_regprocedure('public.v2_4_mutate_package_cycle_pre_initial_import(text,jsonb,uuid)') is not null then
    raise exception 'INITIAL_IMPORT_UNEXPECTED_CONTRACT';
  end if;
end $guard$;

create table public.center_tuition_initial_import_baselines (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null references public.centers(id),
  student_local_id text not null,
  package_catalog_id uuid not null references public.center_tuition_package_catalog(id),
  package_name_snapshot text not null,
  total_sessions_snapshot integer not null check (total_sessions_snapshot > 0),
  listed_price_minor_snapshot bigint not null check (listed_price_minor_snapshot >= 0),
  baseline_used_sessions integer not null check (baseline_used_sessions between 0 and total_sessions_snapshot),
  baseline_cutoff_date date not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_key text not null check (source_key ~ '^[0-9a-f]{64}$'),
  financial_facts jsonb not null check (jsonb_typeof(financial_facts) = 'object'),
  review_note text not null check (length(btrim(review_note)) between 8 and 1000),
  financial_state text not null default 'PENDING_FINANCIAL_REVIEW' check (financial_state = 'PENDING_FINANCIAL_REVIEW'),
  version integer not null default 1 check (version > 0),
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (center_id,student_local_id), unique (center_id,source_key)
);
alter table public.center_tuition_initial_import_baselines enable row level security;
alter table public.center_tuition_initial_import_baselines force row level security;
revoke all on public.center_tuition_initial_import_baselines from public,anon,authenticated,service_role;
do $audit_contract$
declare prior_expression text;
begin
  select pg_get_expr(conbin,conrelid) into strict prior_expression
  from pg_constraint where conrelid='public.center_tuition_cycle_audit_events'::regclass
    and conname='center_tuition_cycle_audit_events_entity_type_check' and contype='c';
  alter table public.center_tuition_cycle_audit_events drop constraint center_tuition_cycle_audit_events_entity_type_check;
  execute format('alter table public.center_tuition_cycle_audit_events add constraint center_tuition_cycle_audit_events_entity_type_check check ((%s) or entity_type = %L)',prior_expression,'INITIAL_IMPORT_BASELINE');
end $audit_contract$;

create function public.v2_4_internal_validate_import_financial(p jsonb, price bigint)
returns boolean language plpgsql immutable set search_path = '' as $fn$
declare kind text := p->>'discountKind'; state text := p->>'paymentState';
  pct integer; fixed bigint; voucher bigint; due bigint; collected bigint; remaining bigint; k text;
begin
  if jsonb_typeof(p)<>'object' or price is null or price<0 or kind is null or state is null
     or not (p ?& array['discountKind','percent','fixedMinor','siblingVoucherMinor','paymentState','sourceDueMinor','collectedMinor','remainingMinor'])
     or kind not in ('EXPLICIT_NONE','PERCENT','FIXED','PERCENT_THEN_SIBLING_VOUCHER','UNKNOWN')
     or state not in ('PAID_BEFORE_ICHESS','UNPAID','PARTIAL','UNKNOWN') then return false; end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('discountKind','percent','fixedMinor','siblingVoucherMinor','paymentState','sourceDueMinor','collectedMinor','remainingMinor') then return false; end if;
  end loop;
  foreach k in array array['percent','fixedMinor','siblingVoucherMinor','sourceDueMinor','collectedMinor','remainingMinor'] loop
    if jsonb_typeof(p->k) not in ('number','null') or (p->>k is not null and p->>k !~ '^[0-9]+$') then return false; end if;
  end loop;
  if kind='UNKNOWN' then
    if p->>'percent' is not null or p->>'fixedMinor' is not null or p->>'siblingVoucherMinor' is not null or p->>'sourceDueMinor' is not null then return false; end if;
  else
    pct:=(p->>'percent')::integer; fixed:=(p->>'fixedMinor')::bigint; voucher:=(p->>'siblingVoucherMinor')::bigint;
    if pct is null or fixed is null or voucher is null or pct not between 0 and 100 then return false; end if;
    if (kind='EXPLICIT_NONE' and (pct<>0 or fixed<>0 or voucher<>0))
      or (kind='PERCENT' and (fixed<>0 or voucher<>0))
      or (kind='FIXED' and (pct<>0 or voucher<>0))
      or (kind='PERCENT_THEN_SIBLING_VOUCHER' and (fixed<>0 or voucher<>100000)) then return false; end if;
    if mod(price::numeric*(100-pct),100)<>0 then return false; end if;
    due:=(price::numeric*(100-pct)/100-fixed-voucher)::bigint;
    if due<0 or (p->>'sourceDueMinor')::bigint is distinct from due then return false; end if;
  end if;
  collected:=(p->>'collectedMinor')::bigint; remaining:=(p->>'remainingMinor')::bigint;
  if state='UNKNOWN' then return collected is null and remaining is null;
  elsif state='PARTIAL' then return due is not null and collected>0 and remaining>0 and collected+remaining=due;
  elsif state='PAID_BEFORE_ICHESS' then return due is not null and collected=due and remaining=0;
  else return collected=0 and remaining is not distinct from due; end if;
exception when others then return false;
end $fn$;
revoke all on function public.v2_4_internal_validate_import_financial(jsonb,bigint) from public,anon,authenticated,service_role;

alter function public.v2_4_mutate_package_cycle(text,jsonb,uuid) rename to v2_4_mutate_package_cycle_pre_initial_import;
revoke all on function public.v2_4_mutate_package_cycle_pre_initial_import(text,jsonb,uuid) from public,anon,authenticated,service_role;
create function public.v2_4_mutate_package_cycle(p_center_id text,p_command jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $fn$
declare actor uuid:=auth.uid(); member public.center_members; package public.center_tuition_package_catalog;
  existing public.center_tuition_initial_import_baselines; command public.center_tuition_cycle_command_results;
  student text:=btrim(coalesce(p_command->>'student_id','')); cutoff date; used integer; intent bytea; result jsonb;
begin
  if actor is null then raise exception 'v2_4_not_authenticated'; end if;
  select * into member from public.v2_4_internal_active_membership(p_center_id,actor);
  if member.id is null then raise exception 'v2_4_center_access_denied'; end if;
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
end $fn$;
revoke all on function public.v2_4_mutate_package_cycle(text,jsonb,uuid) from public,anon,authenticated,service_role;
grant execute on function public.v2_4_mutate_package_cycle(text,jsonb,uuid) to authenticated;

alter function public.v2_4_list_package_cycle_state(text) rename to v2_4_list_package_cycle_state_pre_initial_import;
revoke all on function public.v2_4_list_package_cycle_state_pre_initial_import(text) from public,anon,authenticated,service_role;
create function public.v2_4_list_package_cycle_state(p_center_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare snapshot jsonb; student jsonb; baseline public.center_tuition_initial_import_baselines; result jsonb:='[]'; units integer;
begin
  snapshot:=public.v2_4_list_package_cycle_state_pre_initial_import(p_center_id);
  if coalesce(snapshot->>'ok','false')<>'true' then return snapshot; end if;
  for student in select value from jsonb_array_elements(snapshot->'students') loop
    select * into baseline from public.center_tuition_initial_import_baselines b where b.center_id=p_center_id and b.student_local_id=student->>'student_id';
    if baseline.id is not null and (student->'current_cycle' is null or student->'current_cycle'='null'::jsonb) and jsonb_array_length(student->'cycles')=0 then
      -- Reuse the existing canonical units definition, read genuine current
      -- Attendance strictly after cutoff; never write or invent Attendance.
      select coalesce(sum(public.v2_4_internal_consumption_units(e.payload->>'attendanceStatus')),0)::integer into units
      from public.center_cloud_entities e where e.center_id=p_center_id and e.entity_type='attendance_record' and e.deleted_at is null
        and e.payload->>'attendanceAuthority'='v2.3-occurrence-v1' and e.payload->>'studentId'=baseline.student_local_id
        and e.payload->>'date' ~ '^\d{4}-\d{2}-\d{2}$' and (e.payload->>'date')::date>baseline.baseline_cutoff_date;
      student:=student || jsonb_build_object('initial_import_baseline',jsonb_build_object(
        'id',baseline.id,'state',baseline.financial_state,'version',baseline.version,'package_catalog_id',baseline.package_catalog_id,'package_name',baseline.package_name_snapshot,
        'total_sessions',baseline.total_sessions_snapshot,'baseline_used_sessions',baseline.baseline_used_sessions,'baseline_cutoff_date',baseline.baseline_cutoff_date,
        'contributed_sessions',units,'used_sessions',baseline.baseline_used_sessions+units,'remaining_sessions',greatest(baseline.total_sessions_snapshot-baseline.baseline_used_sessions-units,0),
        'listed_price_minor',baseline.listed_price_minor_snapshot,'financial_facts',baseline.financial_facts,'source_key',baseline.source_key));
    end if;
    result:=result||jsonb_build_array(student);
  end loop;
  return snapshot||jsonb_build_object('students',result,'initial_import_capability','verified-initial-baseline-v1');
end $fn$;
revoke all on function public.v2_4_list_package_cycle_state(text) from public,anon,authenticated,service_role;
grant execute on function public.v2_4_list_package_cycle_state(text) to authenticated;

-- The operator calls the same public V2.4 reader; no separate counters/writer.
notify pgrst, 'reload schema';
commit;
