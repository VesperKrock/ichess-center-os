begin;

-- A legacy opening such as 6/16 already represents countable attendance.
-- Freeze its captured package terms immediately, just like an iChess cycle
-- after its first countable occurrence.
create or replace function public.tuition_final_guard_cycle_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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
    if new.cycle_number = 1 then
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
  return new;
end
$function$;

-- The established selector already owns idempotency, membership, catalog and
-- payment locks. Extend it only so an ACTIVE cycle with zero consumed sessions
-- can change package while preserving its ACTIVE lifecycle.
do $tuition_final_allow_pre_attendance_active_package_change$
declare
  v_definition text;
  v_status_search constant text :=
    $search$v_cycle.lifecycle_status not in ('NEEDS_PACKAGE_SELECTION', 'PROVISIONAL_UNPAID', 'PREPARED')$search$;
  v_status_replacement constant text :=
    $replacement$v_cycle.lifecycle_status not in ('ACTIVE', 'NEEDS_PACKAGE_SELECTION', 'PROVISIONAL_UNPAID', 'PREPARED')$replacement$;
  v_lifecycle_search constant text := $search$lifecycle_status = case when cycle.lifecycle_status = 'PREPARED'
          then 'PREPARED' else 'PROVISIONAL_UNPAID' end,$search$;
  v_lifecycle_replacement constant text := $replacement$lifecycle_status = case
          when cycle.lifecycle_status in ('ACTIVE', 'PREPARED') then cycle.lifecycle_status
          else 'PROVISIONAL_UNPAID' end,$replacement$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.v2_4_mutate_package_cycle_pre_final_business_alignment(text,jsonb,uuid)'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(v_definition, v_status_search) = 0
     or pg_catalog.strpos(v_definition, v_lifecycle_search) = 0 then
    raise exception 'tuition_final_active_package_change_contract_drift';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_status_search, v_status_replacement);
  v_definition := pg_catalog.replace(v_definition, v_lifecycle_search, v_lifecycle_replacement);
  execute v_definition;
end
$tuition_final_allow_pre_attendance_active_package_change$;

alter function public.tuition_final_guard_cycle_terms() owner to postgres;
revoke all on function public.tuition_final_guard_cycle_terms()
  from public, anon, authenticated, service_role;

comment on function public.tuition_final_guard_cycle_terms() is
  'Freezes cycle package terms after legacy opening progress or the first countable iChess attendance.';

commit;
