begin;

-- The forward Receipt correction makes receipt_prefix required. Preserve the
-- existing center-provisioning trigger and supply its new canonical field.
create or replace function public.f5b_internal_provision_center_receipt_setting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.center_operational_profiles(center_id, display_name, receipt_prefix)
  values (
    new.id,
    pg_catalog.left(coalesce(nullif(pg_catalog.btrim(new.name), ''), new.id), 120),
    public.tbc_internal_default_receipt_prefix(new.name, new.id)
  )
  on conflict (center_id) do nothing;
  return new;
end
$function$;

alter function public.f5b_internal_provision_center_receipt_setting() owner to postgres;
revoke all on function public.f5b_internal_provision_center_receipt_setting()
  from public, anon, authenticated, service_role;

-- `current_date` is a SQL value expression, not a pg_catalog function.
-- The first forward migration intentionally deferred function-body checks;
-- normalize those two bodies before the notice RPC is called.
do $fix_notice_date_expression$
declare
  v_signature regprocedure;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.tbhp_internal_schedule_rows(text,uuid,text,integer,uuid)'::regprocedure,
    'public.tbhp_mutate_tuition_notice(text,jsonb,uuid)'::regprocedure
  ] loop
    select pg_catalog.pg_get_functiondef(v_signature) into v_definition;
    if pg_catalog.strpos(v_definition, 'pg_catalog.current_date') > 0 then
      execute pg_catalog.replace(v_definition, 'pg_catalog.current_date', 'current_date');
    end if;
  end loop;
end
$fix_notice_date_expression$;

-- A TBHP is a pre-payment notice. A posted payment for the target term makes
-- a new notice issuance ineligible, even if the cycle is still PREPARED.
do $guard_paid_notice$
declare
  v_definition text;
  v_search constant text := '  if exists (select 1 from public.center_tuition_notices notice';
  v_replacement constant text := $replacement$
  if exists (select 1 from public.finance_transaction transaction
    where transaction.center_id = p_center_id and transaction.status = 'POSTED'
      and transaction.source_module = 'hoc-phi'
      and transaction.source_type = 'tuition-payment'
      and transaction.source_period_id = v_cycle.payment_period_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'PAYMENT_ALREADY_RECEIVED');
  end if;
  if exists (select 1 from public.center_tuition_notices notice$replacement$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.tbhp_mutate_tuition_notice(text,jsonb,uuid)'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(v_definition, 'PAYMENT_ALREADY_RECEIVED') = 0 then
    if (pg_catalog.length(v_definition)
      - pg_catalog.length(pg_catalog.replace(v_definition, v_search, '')))
      / pg_catalog.length(v_search) <> 1 then
      raise exception 'tbc_notice_payment_guard_drift';
    end if;
    execute pg_catalog.replace(v_definition, v_search, v_replacement);
  end if;
end
$guard_paid_notice$;

-- At N, prepared-cycle activation must compare Tuition allocation, not the
-- full money-in amount that also includes the one-time material fee.
do $fix_prepared_tuition_allocation$
declare
  v_definition text;
  v_search constant text := 'pg_catalog.sum(transaction.amount_minor)';
  v_replacement constant text := 'pg_catalog.sum(coalesce(transaction.tuition_allocation_minor, transaction.amount_minor))';
begin
  select pg_catalog.pg_get_functiondef(
    'public.f5b_b2a_internal_activate_prepared_cycle(uuid,uuid,uuid)'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(v_definition, v_replacement) = 0 then
    if (pg_catalog.length(v_definition)
      - pg_catalog.length(pg_catalog.replace(v_definition, v_search, '')))
      / pg_catalog.length(v_search) <> 1 then
      raise exception 'tbc_prepared_allocation_guard_drift';
    end if;
    execute pg_catalog.replace(v_definition, v_search, v_replacement);
  end if;
end
$fix_prepared_tuition_allocation$;

-- A legacy Settings writer that omits the new fields must not silently erase
-- an existing Receipt prefix or package completion policy.
create or replace function public.v2_1_mutate_center_settings(
  p_center_id text,
  p_command jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', '')));
  v_result jsonb;
  v_prefix text;
  v_weeks integer;
  v_version integer;
begin
  if v_operation = 'UPDATE_CENTER_PROFILE' then
    v_prefix := pg_catalog.upper(pg_catalog.btrim(coalesce(
      p_command->>'receipt_prefix',
      (select profile.receipt_prefix from public.center_operational_profiles profile
        where profile.center_id = p_center_id),
      ''
    )));
    if v_prefix !~ '^[A-Z0-9]{2,6}$' then raise exception 'v2_1_invalid_center_profile'; end if;
  elsif v_operation in ('CREATE_TUITION_PACKAGE', 'UPDATE_TUITION_PACKAGE')
      and p_command ? 'max_completion_weeks'
      and p_command->'max_completion_weeks' <> 'null'::jsonb then
    if coalesce(p_command->>'max_completion_weeks', '') !~ '^[1-9][0-9]*$' then
      raise exception 'v2_1_invalid_tuition_package';
    end if;
    v_weeks := (p_command->>'max_completion_weeks')::integer;
    if v_weeks not between 1 and 5200 then raise exception 'v2_1_invalid_tuition_package'; end if;
  end if;

  v_result := public.v2_1_mutate_center_settings_pre_tuition_business_correction(
    p_center_id, p_command, p_idempotency_key
  );
  if coalesce(v_result->>'ok', 'false') <> 'true' then return v_result; end if;
  v_version := (v_result->>'entity_version')::integer;
  if v_operation = 'UPDATE_CENTER_PROFILE' then
    update public.center_operational_profiles profile
    set receipt_prefix = v_prefix
    where profile.center_id = p_center_id and profile.version = v_version;
  elsif v_operation in ('CREATE_TUITION_PACKAGE', 'UPDATE_TUITION_PACKAGE') then
    update public.center_tuition_package_catalog package
    set max_completion_weeks = case when p_command ? 'max_completion_weeks'
      then v_weeks else package.max_completion_weeks end
    where package.center_id = p_center_id
      and package.id = (v_result->>'entity_id')::uuid
      and package.version = v_version;
  end if;
  return v_result;
end
$function$;

alter function public.v2_1_mutate_center_settings(text,jsonb,uuid) owner to postgres;
revoke all on function public.v2_1_mutate_center_settings(text,jsonb,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.v2_1_mutate_center_settings(text,jsonb,uuid)
  to authenticated, service_role;

commit;
