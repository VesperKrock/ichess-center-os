-- Complete the existing cycle read projection. No lifecycle or money changes.
-- History rows previously omitted payment identity, making a newly opened
-- historical payment form fall back to the current tuition period.
begin;

create or replace function public.tuition_final_cycle_json(
  p_center_id text, p_cycle_id uuid, p_base jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
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
  from public.center_tuition_package_cycles cycle
  join public.center_tuition_package_cycle_projection projection
    on projection.center_id = cycle.center_id and projection.id = cycle.id
  where cycle.center_id = p_center_id and cycle.id = p_cycle_id
$function$;

alter function public.tuition_final_cycle_json(text,uuid,jsonb) owner to postgres;
revoke all on function public.tuition_final_cycle_json(text,uuid,jsonb)
  from public, anon, authenticated, service_role;

commit;
