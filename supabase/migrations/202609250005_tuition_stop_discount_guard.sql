begin;

-- A package's list price is not proof of the payable per-session amount when
-- the current term has a discount or a mismatched Tuition amount. Preserve
-- attended debt sessions, but withhold an unproven settlement figure.
do $stop_discount_guard$
declare
  v_definition text;
  v_search constant text := '  elsif mod(v_cycle.price_snapshot, v_cycle.total_sessions_snapshot) <> 0 then';
  v_replacement constant text := $guard$  elsif not exists (
    select 1 from public.center_cloud_entities tuition
    where tuition.center_id = p_center_id
      and tuition.local_id = v_cycle.tuition_local_id
      and tuition.entity_type = 'tuition_record_package'
      and tuition.payload->>'currentTermId' = v_cycle.payment_period_id
      and coalesce(tuition.payload->>'discountType', 'none') = 'none'
      and coalesce(tuition.payload->>'discountAmount', '0') ~ '^[0-9]+([.][0-9]+)?$'
      and (tuition.payload->>'discountAmount')::numeric = 0
      and coalesce(tuition.payload->>'totalAmount', '') ~ '^[0-9]+([.][0-9]+)?$'
      and (tuition.payload->>'totalAmount')::numeric = v_cycle.price_snapshot
  ) then
    v_gap := 'CYCLE_TUITION_DISCOUNT_OR_TERM_NOT_PROVEN';
    v_debt := null;
  elsif mod(v_cycle.price_snapshot, v_cycle.total_sessions_snapshot) <> 0 then$guard$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.tbc_stop_tuition_continuation(text,jsonb,uuid)'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(v_definition, 'CYCLE_TUITION_DISCOUNT_OR_TERM_NOT_PROVEN') > 0
     or (pg_catalog.length(v_definition)
       - pg_catalog.length(pg_catalog.replace(v_definition, v_search, '')))
       / pg_catalog.length(v_search) <> 1 then
    raise exception 'tbc_stop_discount_guard_drift';
  end if;
  execute pg_catalog.replace(v_definition, v_search, v_replacement);
end
$stop_discount_guard$;

commit;
