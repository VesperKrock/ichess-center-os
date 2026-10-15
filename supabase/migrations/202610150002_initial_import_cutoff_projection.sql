begin;
-- Add authoritative server date to the existing read contract. No business writer.
do $guard$ begin
 if to_regclass('public.center_tuition_initial_import_baselines') is null
    or to_regprocedure('public.v2_4_list_package_cycle_state_pre_cutoff_metadata(text)') is not null then
   raise exception 'INITIAL_IMPORT_CUTOFF_UNEXPECTED_CONTRACT';
 end if;
end $guard$;
alter function public.v2_4_list_package_cycle_state(text) rename to v2_4_list_package_cycle_state_pre_cutoff_metadata;
revoke all on function public.v2_4_list_package_cycle_state_pre_cutoff_metadata(text) from public,anon,authenticated,service_role;
create function public.v2_4_list_package_cycle_state(p_center_id text)
returns jsonb language plpgsql stable security definer set search_path = '' as $fn$
declare snapshot jsonb;
begin
 snapshot := public.v2_4_list_package_cycle_state_pre_cutoff_metadata(p_center_id);
 if coalesce(snapshot->>'ok','false')<>'true' then return snapshot; end if;
 return snapshot || jsonb_build_object('initial_import_server_cutoff_date',((statement_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date-1)::text,'observed_server_at',statement_timestamp());
end $fn$;
revoke all on function public.v2_4_list_package_cycle_state(text) from public,anon,authenticated,service_role;
grant execute on function public.v2_4_list_package_cycle_state(text) to authenticated;
-- Recompile the existing operator read: warm cached plans must bind the public
-- reader after its rename, rather than retain a private pre-import OID.
CREATE OR REPLACE FUNCTION public.tuition_operator_read(p_center_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
notify pgrst, 'reload schema';
commit;
