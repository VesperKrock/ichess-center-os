-- LOCAL RELEASE CANDIDATE. Production apply requires separate Owner approval.
-- One nullable cycle policy; existing V2.4 and cycle trigger remain the writers.
begin;

do $preimage$
begin
  if encode(sha256(convert_to(pg_get_functiondef('public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure),'UTF8')),'hex')
       <> 'f865f1b90cfad269bcab0a14af33307f8ea711204c7a6e79ad6783abc8f1e751'
    or encode(sha256(convert_to(pg_get_functiondef('public.tuition_final_guard_cycle_terms()'::regprocedure),'UTF8')),'hex')
       <> '7869085db24bdad0617f75aa61ca226682032f955f21aa6162cfcd48abc97233'
    or encode(sha256(convert_to(pg_get_functiondef('public.tuition_final_cycle_json(text,uuid,jsonb)'::regprocedure),'UTF8')),'hex')
       <> 'e901c0fe50d2b350d9c3db35cad1f7c7f08fa509d3c6c0d345747a6f4880f7ec'
  then raise exception 'RECURRING_POLICY_PREIMAGE_DRIFT'; end if;
  if exists(select 1 from pg_attribute where attrelid='public.center_tuition_package_cycles'::regclass
      and attname='recurring_discount_policy' and not attisdropped)
    or to_regprocedure('public.v2_4_internal_recurring_discount_amount(jsonb,bigint)') is not null
  then raise exception 'RECURRING_POLICY_SCHEMA_DRIFT'; end if;
end $preimage$;

-- Validates even without a price. NULL price defers quoting, never invents money.
create function public.v2_4_internal_recurring_discount_amount(p jsonb, price bigint)
returns bigint language plpgsql immutable set search_path='' as $policy$
declare k text; kind text; pct integer; fixed bigint; voucher bigint; amount numeric;
begin
  if p is null then return null; end if;
  if jsonb_typeof(p)<>'object' or not(p ?& array['schemaVersion','discountKind','percent','fixedMinor','siblingVoucherMinor'])
    or jsonb_typeof(p->'schemaVersion')<>'number' or p->>'schemaVersion'<>'1'
    or jsonb_typeof(p->'discountKind')<>'string'
    or (select count(*) from jsonb_object_keys(p))<>5
  then raise exception 'INVALID_RECURRING_DISCOUNT_POLICY'; end if;
  foreach k in array array['percent','fixedMinor','siblingVoucherMinor'] loop
    if jsonb_typeof(p->k)<>'number' or p->>k !~ '^[0-9]+$'
      or (p->>k)::numeric>9007199254740991
    then raise exception 'INVALID_RECURRING_DISCOUNT_POLICY'; end if;
  end loop;
  if (p->>'percent')::numeric>100 then raise exception 'INVALID_RECURRING_DISCOUNT_POLICY'; end if;
  kind:=p->>'discountKind'; pct:=(p->>'percent')::integer;
  fixed:=(p->>'fixedMinor')::bigint; voucher:=(p->>'siblingVoucherMinor')::bigint;
  if kind not in ('PERCENT','FIXED','PERCENT_THEN_SIBLING_VOUCHER')
    or (kind='PERCENT' and (fixed<>0 or voucher<>0))
    or (kind='FIXED' and (pct<>0 or voucher<>0))
    or (kind='PERCENT_THEN_SIBLING_VOUCHER' and (fixed<>0 or voucher<>100000))
  then raise exception 'INVALID_RECURRING_DISCOUNT_POLICY'; end if;
  if price is null then return null; end if;
  amount:=price::numeric*pct/100+fixed+voucher;
  if price not between 0 and 9007199254740991 or amount<>trunc(amount) or amount>price
  then raise exception 'RECURRING_DISCOUNT_AMOUNT_INVALID'; end if;
  return amount::bigint;
end $policy$;
revoke all on function public.v2_4_internal_recurring_discount_amount(jsonb,bigint)
  from public,anon,authenticated,service_role;

alter table public.center_tuition_package_cycles add column recurring_discount_policy jsonb;
alter table public.center_tuition_package_cycles add constraint center_tuition_cycle_recurring_policy_shape check
  (recurring_discount_policy is null
    or public.v2_4_internal_recurring_discount_amount(recurring_discount_policy,null) is null);

do $patch$
declare d text; previous_acl text; previous_owner oid;
begin
  select proacl::text,proowner into previous_acl,previous_owner from pg_proc
    where oid='public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure;
  d:=pg_get_functiondef('public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure);
  d:=replace(d,
    '-- Spliced into the existing canonical V2.4 function, after membership validation.',
    $set_policy$
if coalesce(p_command->>'operation','')='SET_RECURRING_DISCOUNT_POLICY' then
  declare
    c public.center_tuition_package_cycles; successor public.center_tuition_package_cycles;
    prior public.center_tuition_cycle_command_results; policy jsonb; discount bigint;
    digest bytea; answer jsonb; before_cycle jsonb; before_successor jsonb;
  begin
    if member.role not in ('owner','center_admin') then raise exception 'v2_4_center_access_denied'; end if;
    if p_idempotency_key is null or jsonb_typeof(p_command)<>'object' or student=''
      or not(p_command ? 'recurring_discount_policy')
      or coalesce(p_command->>'expected_version','') !~ '^[1-9][0-9]*$'
    then raise exception 'INVALID_RECURRING_POLICY_COMMAND'; end if;
    policy:=nullif(p_command->'recurring_discount_policy','null'::jsonb);
    perform public.v2_4_internal_recurring_discount_amount(policy,null);
    perform pg_advisory_xact_lock(hashtextextended('v2.4.command|'||p_center_id||'|'||actor::text||'|'||p_idempotency_key::text,0));
    perform pg_advisory_xact_lock(hashtextextended('v2.4.student|'||p_center_id||'|'||student,0));
    digest:=extensions.digest(convert_to(p_command::text,'UTF8'),'sha256');
    select * into prior from public.center_tuition_cycle_command_results r
      where r.center_id=p_center_id and r.actor_user_id=actor and r.idempotency_key=p_idempotency_key for update;
    if found then
      if prior.intent_digest<>digest then raise exception 'v2_4_idempotency_conflict'; end if;
      return prior.result_snapshot||jsonb_build_object('replayed',true);
    end if;
    select * into c from public.center_tuition_package_cycles x
      where x.center_id=p_center_id and x.student_local_id=student and x.id=(p_command->>'cycle_id')::uuid for update;
    if c.id is null then raise exception 'RECURRING_POLICY_CYCLE_NOT_FOUND'; end if;
    if c.version<>(p_command->>'expected_version')::bigint
      or c.lifecycle_status not in ('ACTIVE','PROVISIONAL_UNPAID') or c.manually_ended_at is not null
    then raise exception 'v2_4_stale_version'; end if;
    select * into successor from public.center_tuition_package_cycles x
      where x.center_id=p_center_id and x.student_local_id=student and x.predecessor_cycle_id=c.id for update;
    if successor.id is not null then
      if coalesce(p_command->>'expected_successor_version','') !~ '^[1-9][0-9]*$'
        or (p_command->>'successor_cycle_id')::uuid is distinct from successor.id
        or successor.version<>(p_command->>'expected_successor_version')::bigint
      then raise exception 'RECURRING_POLICY_SUCCESSOR_VERSION_CONFLICT'; end if;
      if successor.lifecycle_status not in ('PREPARED','PROVISIONAL_UNPAID','NEEDS_PACKAGE_SELECTION','SUPERSEDED')
        or successor.baseline_used_sessions<>0
        or exists(select 1 from public.finance_transaction t where t.center_id=p_center_id and t.source_period_id=successor.payment_period_id)
        or exists(select 1 from public.center_tuition_receipts r where r.center_id=p_center_id and r.target_cycle_id=successor.id)
        or exists(select 1 from public.center_tuition_attendance_contributions a where a.center_id=p_center_id and a.cycle_id=successor.id)
      then raise exception 'RECURRING_POLICY_SUCCESSOR_LOCKED'; end if;
    elsif p_command ? 'successor_cycle_id' or p_command ? 'expected_successor_version' then
      raise exception 'RECURRING_POLICY_SUCCESSOR_VERSION_CONFLICT';
    end if;
    before_cycle:=to_jsonb(c);
    -- Policy changes concern future terms; current money/progress remain frozen.
    update public.center_tuition_package_cycles set recurring_discount_policy=policy,
      version=version+1,updated_by=actor,updated_at=clock_timestamp() where id=c.id returning * into c;
    if successor.id is not null then
      before_successor:=to_jsonb(successor);
      discount:=case when policy is null then 0
        else public.v2_4_internal_recurring_discount_amount(policy,successor.price_snapshot) end;
      update public.center_tuition_package_cycles set recurring_discount_policy=policy,
        discount_amount_snapshot=case when price_snapshot is null then discount_amount_snapshot else discount end,
        discount_type_snapshot=case when price_snapshot is null then discount_type_snapshot
          when policy is null then 'none' else policy->>'discountKind' end,
        discount_value_snapshot=case when price_snapshot is null then discount_value_snapshot else discount end,
        version=version+1,updated_by=actor,updated_at=clock_timestamp()
      where id=successor.id returning * into successor;
    end if;
    insert into public.center_tuition_cycle_audit_events(center_id,actor_user_id,action,entity_type,entity_id,before_state,after_state,command_idempotency_key)
      values(p_center_id,actor,'RECURRING_DISCOUNT_POLICY_SET','PACKAGE_CYCLE',c.id,before_cycle,to_jsonb(c),p_idempotency_key);
    if successor.id is not null then
      insert into public.center_tuition_cycle_audit_events(center_id,actor_user_id,action,entity_type,entity_id,before_state,after_state,command_idempotency_key)
        values(p_center_id,actor,'RECURRING_DISCOUNT_SUCCESSOR_UPDATED','PACKAGE_CYCLE',successor.id,before_successor,to_jsonb(successor),p_idempotency_key);
    end if;
    answer:=jsonb_build_object('ok',true,'outcome_code','COMMITTED','center_id',p_center_id,'student_id',student,'cycle_id',c.id,
      'successor_cycle_id',successor.id,'recurring_discount_policy',policy,'replayed',false);
    insert into public.center_tuition_cycle_command_results(center_id,actor_user_id,idempotency_key,intent_digest,result_snapshot)
      values(p_center_id,actor,p_idempotency_key,digest,answer);
    return answer;
  end;
end if;
-- Spliced into the existing canonical V2.4 function, after membership validation.
$set_policy$);
  d:=replace(d,'local_key text; period_key text; facts jsonb;','local_key text; period_key text; facts jsonb; policy jsonb;');
  d:=replace(d,'    facts:=b.financial_facts;',$adopt$
    facts:=b.financial_facts;
    policy:=nullif(p_command->'recurring_discount_policy','null'::jsonb);
    if policy is not null then
      if member.role not in ('owner','center_admin') then raise exception 'v2_4_center_access_denied'; end if;
      perform public.v2_4_internal_recurring_discount_amount(policy,b.listed_price_minor_snapshot);
      if policy-'schemaVersion' <> jsonb_build_object('discountKind',facts->'discountKind','percent',facts->'percent',
        'fixedMinor',facts->'fixedMinor','siblingVoucherMinor',facts->'siblingVoucherMinor')
      then raise exception 'RECURRING_POLICY_SOURCE_FACT_CONFLICT'; end if;
    end if;$adopt$);
  d:=replace(d,'      if c.initial_import_baseline_id is distinct from b.id then',$existing$
      if p_command ? 'recurring_discount_policy' and c.recurring_discount_policy is distinct from policy
      then raise exception 'INITIAL_ADOPTION_RECONCILIATION_REQUIRED'; end if;
      if c.initial_import_baseline_id is distinct from b.id then$existing$);
  d:=replace(d,'initial_import_baseline_id,opening_payment_complete,created_by,updated_by)',
    'initial_import_baseline_id,opening_payment_complete,recurring_discount_policy,created_by,updated_by)');
  d:=replace(d,'discount,b.id,complete,actor,actor) returning * into c;',
    'discount,b.id,complete,policy,actor,actor) returning * into c;');
  execute d;
  if (select proacl::text is distinct from previous_acl or proowner<>previous_owner from pg_proc
      where oid='public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure)
  then raise exception 'RECURRING_POLICY_AUTH_CONTRACT_DRIFT'; end if;

  d:=pg_get_functiondef('public.tuition_final_guard_cycle_terms()'::regprocedure);
  d:=replace(d,'  return new;',$inherit$
  declare predecessor public.center_tuition_package_cycles; amount bigint;
  begin
    if tg_op='INSERT' and new.predecessor_cycle_id is not null then
      select * into predecessor from public.center_tuition_package_cycles where id=new.predecessor_cycle_id;
      if predecessor.id is null or predecessor.center_id<>new.center_id
        or predecessor.student_local_id<>new.student_local_id or predecessor.tuition_local_id<>new.tuition_local_id
        or predecessor.cycle_number+1<>new.cycle_number
      then raise exception 'RECURRING_POLICY_PREDECESSOR_SCOPE_CONFLICT'; end if;
      if new.recurring_discount_policy is null then
        new.recurring_discount_policy:=predecessor.recurring_discount_policy;
      elsif new.recurring_discount_policy is distinct from predecessor.recurring_discount_policy then
        raise exception 'RECURRING_POLICY_PREDECESSOR_CONFLICT';
      end if;
    end if;
    if new.recurring_discount_policy is not null then
      perform public.v2_4_internal_recurring_discount_amount(new.recurring_discount_policy,null);
      if tg_op='INSERT' or new.package_catalog_id is distinct from old.package_catalog_id then
        amount:=public.v2_4_internal_recurring_discount_amount(new.recurring_discount_policy,new.price_snapshot);
        if amount is not null then
          new.discount_amount_snapshot:=amount;
          new.discount_type_snapshot:=new.recurring_discount_policy->>'discountKind';
          new.discount_value_snapshot:=amount;
        end if;
      end if;
    end if;
  end;
  return new;$inherit$);
  execute d;

  d:=pg_get_functiondef('public.tuition_final_cycle_json(text,uuid,jsonb)'::regprocedure);
  d:=replace(d,'''discount_amount'', cycle.discount_amount_snapshot,',
    '''recurring_discount_policy'', cycle.recurring_discount_policy, ''discount_amount'', cycle.discount_amount_snapshot,');
  execute d;
end $patch$;

comment on column public.center_tuition_package_cycles.recurring_discount_policy is
  'Typed future entitlement, inherited within a center/student cycle lineage. NULL preserves legacy behavior. Not payment truth.';
notify pgrst,'reload schema';
commit;
