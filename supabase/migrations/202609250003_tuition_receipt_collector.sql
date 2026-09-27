begin;

-- A center-wide suggestion for future payment forms, never a live source for
-- historical Receipt reprints. Older clients that omit it preserve the value.
alter table public.center_operational_profiles
  add column default_receipt_collector_name text not null default '';
alter table public.center_operational_profiles
  add constraint center_operational_profiles_default_collector_check
  check (pg_catalog.length(default_receipt_collector_name) <= 120
    and default_receipt_collector_name !~ '[[:cntrl:]]');

alter function public.v2_1_list_center_settings(text)
  rename to v2_1_list_center_settings_pre_receipt_collector;
revoke all on function public.v2_1_list_center_settings_pre_receipt_collector(text)
  from public, anon, authenticated, service_role;

create function public.v2_1_list_center_settings(p_center_id text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare v_result jsonb;
begin
  v_result := public.v2_1_list_center_settings_pre_receipt_collector(p_center_id);
  if coalesce(v_result->>'ok', 'false') <> 'true' then return v_result; end if;
  return pg_catalog.jsonb_set(v_result, '{center,default_receipt_collector_name}',
    pg_catalog.to_jsonb((select profile.default_receipt_collector_name
      from public.center_operational_profiles profile
      where profile.center_id = p_center_id)), true);
end
$function$;

alter function public.v2_1_mutate_center_settings(text,jsonb,uuid)
  rename to v2_1_mutate_center_settings_pre_receipt_collector;
revoke all on function public.v2_1_mutate_center_settings_pre_receipt_collector(text,jsonb,uuid)
  from public, anon, authenticated, service_role;

create function public.v2_1_mutate_center_settings(
  p_center_id text, p_command jsonb, p_idempotency_key uuid
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_result jsonb;
  v_collector text;
begin
  if pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', '')))
      = 'UPDATE_CENTER_PROFILE' and p_command ? 'default_receipt_collector_name' then
    v_collector := pg_catalog.btrim(coalesce(p_command->>'default_receipt_collector_name', ''));
    if pg_catalog.length(v_collector) > 120 or v_collector ~ '[[:cntrl:]]' then
      raise exception 'v2_1_invalid_center_profile';
    end if;
  end if;
  v_result := public.v2_1_mutate_center_settings_pre_receipt_collector(
    p_center_id, p_command, p_idempotency_key);
  if coalesce(v_result->>'ok', 'false') = 'true' and v_collector is not null then
    update public.center_operational_profiles profile
      set default_receipt_collector_name = v_collector
      where profile.center_id = p_center_id
        and profile.version = (v_result->>'entity_version')::integer;
  end if;
  return v_result;
end
$function$;

-- The original atomic RECORD_PAYMENT RPC inserts the Finance row and then
-- the Receipt/revision in one transaction. These triggers copy the posted
-- Finance collector into both immutable issuance snapshots in that boundary.
create function public.tbc_internal_snapshot_receipt_collector()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare v_collector text;
begin
  if new.finance_transaction_id is null then return new; end if;
  select pg_catalog.btrim(transaction.recorded_by_name) into v_collector
  from public.finance_transaction transaction
  where transaction.center_id = new.center_id
    and transaction.id = new.finance_transaction_id
    and transaction.status = 'POSTED';
  if coalesce(v_collector, '') = '' then
    raise exception 'tbc_receipt_collector_required';
  end if;
  new.snapshot := pg_catalog.jsonb_set(new.snapshot, '{payment,collectorName}',
    pg_catalog.to_jsonb(v_collector), true);
  return new;
end
$function$;

create trigger tbc_snapshot_receipt_collector_before_insert
  before insert on public.center_tuition_receipts
  for each row execute function public.tbc_internal_snapshot_receipt_collector();

create function public.tbc_internal_snapshot_receipt_revision_collector()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare v_collector text;
begin
  if coalesce(new.snapshot#>>'{payment,collectorName}', '') <> '' then return new; end if;
  select receipt.snapshot#>>'{payment,collectorName}' into v_collector
  from public.center_tuition_receipts receipt
  where receipt.center_id = new.center_id and receipt.id = new.receipt_id;
  if coalesce(v_collector, '') <> '' then
    new.snapshot := pg_catalog.jsonb_set(new.snapshot, '{payment,collectorName}',
      pg_catalog.to_jsonb(v_collector), true);
  end if;
  return new;
end
$function$;

create trigger tbc_snapshot_receipt_revision_collector_before_insert
  before insert on public.center_tuition_receipt_revisions
  for each row execute function public.tbc_internal_snapshot_receipt_revision_collector();

alter function public.v2_1_list_center_settings(text) owner to postgres;
alter function public.v2_1_mutate_center_settings(text,jsonb,uuid) owner to postgres;
alter function public.tbc_internal_snapshot_receipt_collector() owner to postgres;
alter function public.tbc_internal_snapshot_receipt_revision_collector() owner to postgres;
revoke all on function public.tbc_internal_snapshot_receipt_collector(),
  public.tbc_internal_snapshot_receipt_revision_collector()
  from public, anon, authenticated, service_role;
grant execute on function public.v2_1_list_center_settings(text),
  public.v2_1_mutate_center_settings(text,jsonb,uuid) to authenticated, service_role;

commit;
