begin;

-- V2-7A adds a blind cycle-count workflow around the existing C5.6
-- Inventory authority. Expected quantity/version evidence stays server-side
-- until submission. Reconciliation writes the existing immutable movement
-- ledger and the paired item quantity/version update in one transaction.

create table public.center_inventory_cycle_counts (
  center_id text not null references public.centers(id) on delete cascade,
  id uuid not null,
  count_code text not null,
  due_date date not null,
  status text not null default 'DRAFT',
  item_count integer not null,
  version bigint not null default 1,
  created_by_user_id uuid not null references auth.users(id),
  created_by_membership_id uuid not null references public.center_members(id),
  created_by_role text not null,
  updated_by_user_id uuid not null references auth.users(id),
  updated_by_membership_id uuid not null references public.center_members(id),
  updated_by_role text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  submitted_at timestamptz,
  reconciled_at timestamptz,
  cancelled_at timestamptz,
  primary key (center_id, id),
  constraint center_inventory_cycle_counts_code_check
    check (count_code ~ '^KKK-[0-9]{8}-[0-9]{4,}$'),
  constraint center_inventory_cycle_counts_status_check
    check (status in ('DRAFT', 'SUBMITTED', 'RECONCILED', 'CANCELLED')),
  constraint center_inventory_cycle_counts_item_count_check check (item_count > 0),
  constraint center_inventory_cycle_counts_version_check check (version >= 1),
  constraint center_inventory_cycle_counts_actor_role_check
    check (length(btrim(created_by_role)) between 1 and 80
      and length(btrim(updated_by_role)) between 1 and 80),
  constraint center_inventory_cycle_counts_lifecycle_time_check check (
    (status = 'DRAFT' and submitted_at is null and reconciled_at is null and cancelled_at is null)
    or (status = 'SUBMITTED' and submitted_at is not null and reconciled_at is null and cancelled_at is null)
    or (status = 'RECONCILED' and submitted_at is not null and reconciled_at is not null and cancelled_at is null)
    or (status = 'CANCELLED' and reconciled_at is null and cancelled_at is not null)
  )
);

create unique index center_inventory_cycle_counts_code_unique
  on public.center_inventory_cycle_counts (center_id, count_code);
create unique index center_inventory_cycle_counts_one_open_unique
  on public.center_inventory_cycle_counts (center_id)
  where status in ('DRAFT', 'SUBMITTED');
create index center_inventory_cycle_counts_due_idx
  on public.center_inventory_cycle_counts (center_id, status, due_date, created_at desc);

create table public.center_inventory_cycle_count_lines (
  center_id text not null,
  count_id uuid not null,
  id uuid not null,
  item_id uuid not null,
  item_name text not null,
  item_category text not null,
  item_unit text not null,
  item_location text not null default '',
  expected_quantity_snapshot integer not null,
  expected_item_version bigint not null,
  observed_quantity integer,
  explanation text not null default '',
  reconciliation_movement_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (center_id, count_id, id),
  foreign key (center_id, count_id)
    references public.center_inventory_cycle_counts(center_id, id) on delete restrict,
  foreign key (center_id, item_id)
    references public.center_inventory_items(center_id, id) on delete restrict,
  foreign key (center_id, reconciliation_movement_id)
    references public.center_inventory_movements(center_id, id) on delete restrict,
  constraint center_inventory_cycle_count_lines_item_unique
    unique (center_id, count_id, item_id),
  constraint center_inventory_cycle_count_lines_name_check
    check (length(btrim(item_name)) between 1 and 240),
  constraint center_inventory_cycle_count_lines_category_check
    check (length(btrim(item_category)) between 1 and 160),
  constraint center_inventory_cycle_count_lines_unit_check
    check (length(btrim(item_unit)) between 1 and 80),
  constraint center_inventory_cycle_count_lines_location_check
    check (length(item_location) <= 500),
  constraint center_inventory_cycle_count_lines_expected_quantity_check
    check (expected_quantity_snapshot >= 0),
  constraint center_inventory_cycle_count_lines_expected_version_check
    check (expected_item_version >= 1),
  constraint center_inventory_cycle_count_lines_observed_check
    check (observed_quantity is null or observed_quantity >= 0),
  constraint center_inventory_cycle_count_lines_explanation_check
    check (length(explanation) <= 2000)
);

create index center_inventory_cycle_count_lines_item_idx
  on public.center_inventory_cycle_count_lines (center_id, item_id, created_at desc);

create table public.center_inventory_cycle_count_audit_events (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  count_id uuid not null,
  actor_user_id uuid not null references auth.users(id),
  actor_membership_id uuid not null references public.center_members(id),
  actor_role text not null,
  operation text not null,
  idempotency_key uuid not null,
  before_state jsonb,
  after_state jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (center_id, count_id)
    references public.center_inventory_cycle_counts(center_id, id) on delete restrict,
  constraint center_inventory_cycle_count_audit_operation_check
    check (operation in ('START_COUNT', 'SUBMIT_COUNT', 'RECONCILE_COUNT', 'CANCEL_COUNT')),
  constraint center_inventory_cycle_count_audit_role_check
    check (length(btrim(actor_role)) between 1 and 80),
  constraint center_inventory_cycle_count_audit_state_check check (
    (before_state is null or jsonb_typeof(before_state) = 'object')
    and jsonb_typeof(after_state) = 'object'
  )
);

create index center_inventory_cycle_count_audit_count_idx
  on public.center_inventory_cycle_count_audit_events (center_id, count_id, created_at desc);

create table public.center_inventory_cycle_count_command_results (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  idempotency_key uuid not null,
  intent_digest bytea not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint center_inventory_cycle_count_results_scope_unique
    unique (center_id, actor_user_id, idempotency_key),
  constraint center_inventory_cycle_count_results_digest_check
    check (octet_length(intent_digest) = 32),
  constraint center_inventory_cycle_count_results_snapshot_check check (
    jsonb_typeof(result_snapshot) = 'object'
    and result_snapshot->>'outcome_code' = 'COMMITTED'
  )
);

alter table public.center_inventory_cycle_counts enable row level security;
alter table public.center_inventory_cycle_counts force row level security;
alter table public.center_inventory_cycle_count_lines enable row level security;
alter table public.center_inventory_cycle_count_lines force row level security;
alter table public.center_inventory_cycle_count_audit_events enable row level security;
alter table public.center_inventory_cycle_count_audit_events force row level security;
alter table public.center_inventory_cycle_count_command_results enable row level security;
alter table public.center_inventory_cycle_count_command_results force row level security;

revoke all on table public.center_inventory_cycle_counts from public, anon, authenticated, service_role;
revoke all on table public.center_inventory_cycle_count_lines from public, anon, authenticated, service_role;
revoke all on table public.center_inventory_cycle_count_audit_events from public, anon, authenticated, service_role;
revoke all on table public.center_inventory_cycle_count_command_results from public, anon, authenticated, service_role;

create or replace function public.v2_7a_list_inventory_cycle_counts(p_center_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_role text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED');
  end if;
  if v_center_id = '' or length(v_center_id) > 160 then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_CENTER');
  end if;

  v_role := public.c5_6_inventory_access_role(v_center_id);
  if v_role is null then
    return jsonb_build_object('ok', false, 'outcome_code', 'CENTER_ACCESS_DENIED');
  end if;

  return jsonb_build_object(
    'ok', true,
    'outcome_code', 'AUTHORITATIVE_SNAPSHOT',
    'center_id', v_center_id,
    'counts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'center_id', c.center_id,
        'id', c.id,
        'count_code', c.count_code,
        'due_date', c.due_date,
        'due_state', case
          when c.status not in ('DRAFT', 'SUBMITTED') then ''
          when c.due_date < current_date then 'OVERDUE'
          when c.due_date = current_date then 'DUE'
          else 'UPCOMING'
        end,
        'status', c.status,
        'item_count', c.item_count,
        'version', c.version,
        'created_at', c.created_at,
        'updated_at', c.updated_at,
        'submitted_at', coalesce(c.submitted_at::text, ''),
        'reconciled_at', coalesce(c.reconciled_at::text, ''),
        'cancelled_at', coalesce(c.cancelled_at::text, ''),
        'lines', coalesce((
          select jsonb_agg(
            case when c.status = 'DRAFT' or (c.status = 'CANCELLED' and c.submitted_at is null) then
              jsonb_build_object(
                'center_id', l.center_id,
                'id', l.id,
                'item_id', l.item_id,
                'item_name', l.item_name,
                'item_category', l.item_category,
                'item_unit', l.item_unit,
                'item_location', l.item_location
              )
            else
              jsonb_build_object(
                'center_id', l.center_id,
                'id', l.id,
                'item_id', l.item_id,
                'item_name', l.item_name,
                'item_category', l.item_category,
                'item_unit', l.item_unit,
                'item_location', l.item_location,
                'expected_quantity', l.expected_quantity_snapshot,
                'observed_quantity', l.observed_quantity,
                'variance', l.observed_quantity - l.expected_quantity_snapshot,
                'explanation', l.explanation,
                'reconciliation_movement_id', coalesce(l.reconciliation_movement_id::text, '')
              )
            end
            order by lower(l.item_name), l.item_id
          )
          from public.center_inventory_cycle_count_lines l
          where l.center_id = c.center_id and l.count_id = c.id
        ), '[]'::jsonb)
      ) order by c.created_at desc, c.id desc)
      from public.center_inventory_cycle_counts c
      where c.center_id = v_center_id
    ), '[]'::jsonb)
  );
end
$function$;

create or replace function public.v2_7a_mutate_inventory_cycle_count(
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
  v_actor uuid := auth.uid();
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_role text;
  v_membership_id uuid;
  v_operation text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', '')));
  v_expected_version bigint;
  v_digest bytea;
  v_existing_result public.center_inventory_cycle_count_command_results%rowtype;
  v_count public.center_inventory_cycle_counts%rowtype;
  v_line public.center_inventory_cycle_count_lines%rowtype;
  v_item public.center_inventory_items%rowtype;
  v_count_id uuid;
  v_line_id uuid;
  v_due_date date;
  v_observed bigint;
  v_item_count integer;
  v_payload_count integer;
  v_discrepancy_count integer;
  v_count_no bigint;
  v_count_code text;
  v_explanation text;
  v_movement_id uuid;
  v_movement_type text;
  v_adjustment_quantity integer;
  v_adjustment_count integer := 0;
  v_now timestamptz := clock_timestamp();
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_payload_line jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED');
  end if;
  if v_center_id = '' or length(v_center_id) > 160 then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_CENTER');
  end if;
  if p_idempotency_key is null or p_command is null or jsonb_typeof(p_command) <> 'object' then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;
  if v_operation not in ('START_COUNT', 'SUBMIT_COUNT', 'RECONCILE_COUNT', 'CANCEL_COUNT') then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_OPERATION');
  end if;
  begin
    v_expected_version := (p_command->>'expected_version')::bigint;
  exception when others then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end;
  if v_expected_version is null or v_expected_version < 0
    or octet_length(convert_to(p_command::text, 'UTF8')) > 1048576 then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;

  select pg_catalog.lower(pg_catalog.replace(pg_catalog.replace(
      pg_catalog.btrim(cm.role::text), '-', '_'), ' ', '_')), cm.id
    into v_role, v_membership_id
  from public.center_members cm
  join public.centers c on c.id = cm.center_id
  where cm.center_id = v_center_id and cm.user_id = v_actor
    and pg_catalog.lower(pg_catalog.btrim(coalesce(cm.status::text, ''))) = 'active'
    and pg_catalog.lower(pg_catalog.btrim(coalesce(c.status::text, ''))) = 'active'
  limit 1
  for share of cm, c;
  if v_role is null then
    return jsonb_build_object('ok', false, 'outcome_code', 'CENTER_ACCESS_DENIED');
  end if;
  if v_role not in ('owner', 'admin', 'center_admin', 'qtv') then
    return jsonb_build_object('ok', false, 'outcome_code', 'WRITE_ROLE_REQUIRED');
  end if;

  v_digest := extensions.digest(convert_to(jsonb_build_object(
    'contract_version', 1, 'center_id', v_center_id, 'command', p_command
  )::text, 'UTF8'), 'sha256');
  perform pg_advisory_xact_lock(hashtextextended(
    v_center_id || ':' || v_actor::text || ':' || p_idempotency_key::text, 0));
  select * into v_existing_result
  from public.center_inventory_cycle_count_command_results r
  where r.center_id = v_center_id and r.actor_user_id = v_actor
    and r.idempotency_key = p_idempotency_key;
  if found then
    if v_existing_result.intent_digest <> v_digest then
      return jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return v_existing_result.result_snapshot;
  end if;

  begin
    v_count_id := (p_command->>'count_id')::uuid;
  exception when others then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
  end;
  if v_count_id is null then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    v_center_id || ':inventory-cycle-count:' || v_count_id::text, 0));

  if v_operation = 'START_COUNT' then
    if v_expected_version <> 0 then
      return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    begin
      v_due_date := (p_command->>'due_date')::date;
    exception when others then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end;
    if coalesce(p_command->>'due_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_center_id || ':inventory-cycle-count:open', 0));
    if exists (
      select 1 from public.center_inventory_cycle_counts c
      where c.center_id = v_center_id and c.status in ('DRAFT', 'SUBMITTED')
    ) then
      return jsonb_build_object('ok', false, 'outcome_code', 'ACTIVE_COUNT_EXISTS');
    end if;
    if exists (
      select 1 from public.center_inventory_cycle_counts c
      where c.center_id = v_center_id and c.id = v_count_id
    ) then
      return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;

    -- Keep the active-item scope, quantity, and version snapshot coherent with
    -- concurrent C5.6 item/movement writes while this short snapshot is taken.
    lock table public.center_inventory_items in share mode;
    select count(*)::integer into v_item_count
    from public.center_inventory_items i
    where i.center_id = v_center_id and i.status = 'active';
    if v_item_count < 1 then
      return jsonb_build_object('ok', false, 'outcome_code', 'EMPTY_COUNT_SCOPE');
    end if;

    perform pg_advisory_xact_lock(hashtextextended(
      v_center_id || ':inventory-cycle-count-code:' || v_now::date::text, 0));
    select coalesce(max((substring(c.count_code from '([0-9]+)$'))::bigint), 0) + 1
      into v_count_no
    from public.center_inventory_cycle_counts c
    where c.center_id = v_center_id
      and c.count_code like 'KKK-' || to_char(v_now, 'YYYYMMDD') || '-%';
    v_count_code := 'KKK-' || to_char(v_now, 'YYYYMMDD') || '-' || lpad(v_count_no::text, 4, '0');

    insert into public.center_inventory_cycle_counts (
      center_id, id, count_code, due_date, status, item_count, version,
      created_by_user_id, created_by_membership_id, created_by_role,
      updated_by_user_id, updated_by_membership_id, updated_by_role,
      created_at, updated_at
    ) values (
      v_center_id, v_count_id, v_count_code, v_due_date, 'DRAFT', v_item_count, 1,
      v_actor, v_membership_id, v_role, v_actor, v_membership_id, v_role, v_now, v_now
    );
    insert into public.center_inventory_cycle_count_lines (
      center_id, count_id, id, item_id, item_name, item_category, item_unit,
      item_location, expected_quantity_snapshot, expected_item_version,
      created_at, updated_at
    )
    select i.center_id, v_count_id, gen_random_uuid(), i.id, i.name, i.category,
      i.unit, i.location, i.quantity, i.version, v_now, v_now
    from public.center_inventory_items i
    where i.center_id = v_center_id and i.status = 'active'
    order by i.id;

    v_before := null;
    v_after := jsonb_build_object(
      'id', v_count_id, 'count_code', v_count_code, 'due_date', v_due_date,
      'status', 'DRAFT', 'item_count', v_item_count, 'version', 1
    );
    v_count.version := 1;

  else
    select * into v_count
    from public.center_inventory_cycle_counts c
    where c.center_id = v_center_id and c.id = v_count_id
    for update;
    if not found then
      return jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_NOT_FOUND_OR_DENIED');
    end if;
    if v_count.version <> v_expected_version then
      return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    v_before := jsonb_build_object(
      'id', v_count.id, 'status', v_count.status, 'version', v_count.version
    );

    if v_operation = 'SUBMIT_COUNT' then
      if v_count.status <> 'DRAFT' then
        return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_WORKFLOW_TRANSITION');
      end if;
      if p_command->'lines' is null or jsonb_typeof(p_command->'lines') <> 'array' then
        return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;
      v_payload_count := jsonb_array_length(p_command->'lines');
      if v_payload_count <> v_count.item_count or v_payload_count > 10000 then
        return jsonb_build_object('ok', false, 'outcome_code', 'COUNT_SCOPE_MISMATCH');
      end if;
      for v_payload_line in select value from jsonb_array_elements(p_command->'lines') loop
        if jsonb_typeof(v_payload_line) <> 'object'
          or coalesce(v_payload_line->>'line_id', '') = ''
          or coalesce(v_payload_line->>'observed_quantity', '') !~ '^[0-9]+$' then
          return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
        end if;
        begin
          v_line_id := (v_payload_line->>'line_id')::uuid;
          v_observed := (v_payload_line->>'observed_quantity')::bigint;
        exception when others then
          return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
        end;
        if v_observed > 2147483647 then
          return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
        end if;
        if not exists (
          select 1 from public.center_inventory_cycle_count_lines l
          where l.center_id = v_center_id and l.count_id = v_count_id and l.id = v_line_id
        ) then
          return jsonb_build_object('ok', false, 'outcome_code', 'COUNT_SCOPE_MISMATCH');
        end if;
      end loop;
      if (
        select count(distinct (entry->>'line_id'))
        from jsonb_array_elements(p_command->'lines') entry
      ) <> v_payload_count then
        return jsonb_build_object('ok', false, 'outcome_code', 'COUNT_SCOPE_MISMATCH');
      end if;

      perform i.id
      from public.center_inventory_items i
      join public.center_inventory_cycle_count_lines l
        on l.center_id = i.center_id and l.item_id = i.id
      where l.center_id = v_center_id and l.count_id = v_count_id
      order by i.id
      for update of i;
      if exists (
        select 1
        from public.center_inventory_cycle_count_lines l
        left join public.center_inventory_items i
          on i.center_id = l.center_id and i.id = l.item_id
        where l.center_id = v_center_id and l.count_id = v_count_id
          and (i.id is null or i.status <> 'active'
            or i.version <> l.expected_item_version
            or i.quantity <> l.expected_quantity_snapshot)
      ) then
        return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
      end if;

      update public.center_inventory_cycle_count_lines l
      set observed_quantity = (
          select (entry->>'observed_quantity')::integer
          from jsonb_array_elements(p_command->'lines') entry
          where (entry->>'line_id')::uuid = l.id
        ),
        updated_at = v_now
      where l.center_id = v_center_id and l.count_id = v_count_id;
      update public.center_inventory_cycle_counts
      set status = 'SUBMITTED', submitted_at = v_now, version = v_count.version + 1,
        updated_by_user_id = v_actor, updated_by_membership_id = v_membership_id,
        updated_by_role = v_role, updated_at = v_now
      where center_id = v_center_id and id = v_count_id;
      v_count.version := v_count.version + 1;
      v_after := jsonb_build_object(
        'id', v_count_id, 'status', 'SUBMITTED', 'version', v_count.version,
        'item_count', v_count.item_count
      );

    elsif v_operation = 'RECONCILE_COUNT' then
      if v_count.status <> 'SUBMITTED' then
        return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_WORKFLOW_TRANSITION');
      end if;
      if p_command->'explanations' is null
        or jsonb_typeof(p_command->'explanations') <> 'array' then
        return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;
      select count(*)::integer into v_discrepancy_count
      from public.center_inventory_cycle_count_lines l
      where l.center_id = v_center_id and l.count_id = v_count_id
        and l.observed_quantity <> l.expected_quantity_snapshot;
      v_payload_count := jsonb_array_length(p_command->'explanations');
      if v_payload_count <> v_discrepancy_count or v_payload_count > 10000 then
        return jsonb_build_object('ok', false, 'outcome_code', 'EXPLANATION_REQUIRED');
      end if;
      for v_payload_line in select value from jsonb_array_elements(p_command->'explanations') loop
        v_explanation := pg_catalog.btrim(coalesce(v_payload_line->>'explanation', ''));
        if jsonb_typeof(v_payload_line) <> 'object'
          or coalesce(v_payload_line->>'line_id', '') = ''
          or length(v_explanation) not between 1 and 2000 then
          return jsonb_build_object('ok', false, 'outcome_code', 'EXPLANATION_REQUIRED');
        end if;
        begin
          v_line_id := (v_payload_line->>'line_id')::uuid;
        exception when others then
          return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
        end;
        if not exists (
          select 1 from public.center_inventory_cycle_count_lines l
          where l.center_id = v_center_id and l.count_id = v_count_id and l.id = v_line_id
            and l.observed_quantity <> l.expected_quantity_snapshot
        ) then
          return jsonb_build_object('ok', false, 'outcome_code', 'EXPLANATION_REQUIRED');
        end if;
      end loop;
      if (
        select count(distinct (entry->>'line_id'))
        from jsonb_array_elements(p_command->'explanations') entry
      ) <> v_payload_count then
        return jsonb_build_object('ok', false, 'outcome_code', 'EXPLANATION_REQUIRED');
      end if;

      perform i.id
      from public.center_inventory_items i
      join public.center_inventory_cycle_count_lines l
        on l.center_id = i.center_id and l.item_id = i.id
      where l.center_id = v_center_id and l.count_id = v_count_id
      order by i.id
      for update of i;
      if exists (
        select 1
        from public.center_inventory_cycle_count_lines l
        left join public.center_inventory_items i
          on i.center_id = l.center_id and i.id = l.item_id
        where l.center_id = v_center_id and l.count_id = v_count_id
          and (i.id is null or i.status <> 'active'
            or i.version <> l.expected_item_version
            or i.quantity <> l.expected_quantity_snapshot)
      ) then
        return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
      end if;

      for v_line in
        select * from public.center_inventory_cycle_count_lines l
        where l.center_id = v_center_id and l.count_id = v_count_id
          and l.observed_quantity <> l.expected_quantity_snapshot
        order by l.item_id
        for update
      loop
        select pg_catalog.btrim(entry->>'explanation') into v_explanation
        from jsonb_array_elements(p_command->'explanations') entry
        where (entry->>'line_id')::uuid = v_line.id;
        select * into v_item
        from public.center_inventory_items i
        where i.center_id = v_center_id and i.id = v_line.item_id;
        v_movement_id := gen_random_uuid();
        v_movement_type := case
          when v_line.observed_quantity > v_line.expected_quantity_snapshot then 'IN'
          else 'OUT'
        end;
        v_adjustment_quantity := abs(v_line.observed_quantity - v_line.expected_quantity_snapshot);

        insert into public.center_inventory_movements (
          center_id, id, item_id, item_name, movement_type, quantity,
          movement_date, reason, note, cost_amount_minor, cost_method, supplier_name,
          before_quantity, after_quantity, item_version_before, item_version_after,
          actor_user_id, actor_membership_id, actor_role, created_at
        ) values (
          v_center_id, v_movement_id, v_line.item_id, v_item.name,
          v_movement_type, v_adjustment_quantity, v_now::date,
          'Đối soát kiểm kê ' || v_count.count_code, v_explanation, 0, '', '',
          v_item.quantity, v_line.observed_quantity, v_item.version, v_item.version + 1,
          v_actor, v_membership_id, v_role, v_now
        );
        update public.center_inventory_items
        set quantity = v_line.observed_quantity, version = v_item.version + 1,
          updated_by_user_id = v_actor, updated_by_membership_id = v_membership_id,
          updated_at = v_now
        where center_id = v_center_id and id = v_line.item_id;
        update public.center_inventory_cycle_count_lines
        set explanation = v_explanation, reconciliation_movement_id = v_movement_id,
          updated_at = v_now
        where center_id = v_center_id and count_id = v_count_id and id = v_line.id;
        v_adjustment_count := v_adjustment_count + 1;
      end loop;

      update public.center_inventory_cycle_counts
      set status = 'RECONCILED', reconciled_at = v_now, version = v_count.version + 1,
        updated_by_user_id = v_actor, updated_by_membership_id = v_membership_id,
        updated_by_role = v_role, updated_at = v_now
      where center_id = v_center_id and id = v_count_id;
      v_count.version := v_count.version + 1;
      v_after := jsonb_build_object(
        'id', v_count_id, 'status', 'RECONCILED', 'version', v_count.version,
        'adjustment_count', v_adjustment_count
      );

    else
      if v_count.status not in ('DRAFT', 'SUBMITTED') then
        return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_WORKFLOW_TRANSITION');
      end if;
      update public.center_inventory_cycle_counts
      set status = 'CANCELLED', cancelled_at = v_now, version = v_count.version + 1,
        updated_by_user_id = v_actor, updated_by_membership_id = v_membership_id,
        updated_by_role = v_role, updated_at = v_now
      where center_id = v_center_id and id = v_count_id;
      v_count.version := v_count.version + 1;
      v_after := jsonb_build_object(
        'id', v_count_id, 'status', 'CANCELLED', 'version', v_count.version
      );
    end if;
  end if;

  insert into public.center_inventory_cycle_count_audit_events (
    center_id, count_id, actor_user_id, actor_membership_id, actor_role,
    operation, idempotency_key, before_state, after_state, created_at
  ) values (
    v_center_id, v_count_id, v_actor, v_membership_id, v_role,
    v_operation, p_idempotency_key, v_before, v_after, v_now
  );
  v_result := jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED', 'center_id', v_center_id,
    'entity_type', 'inventory_cycle_count', 'entity_id', v_count_id,
    'entity_version', v_count.version, 'adjustment_count', v_adjustment_count,
    'committed_at', v_now
  );
  insert into public.center_inventory_cycle_count_command_results (
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (v_center_id, v_actor, p_idempotency_key, v_digest, v_result);
  return v_result;
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'outcome_code', 'CONCURRENT_CONFLICT');
  when check_violation or foreign_key_violation or string_data_right_truncation
    or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
end
$function$;

revoke all on function public.v2_7a_list_inventory_cycle_counts(text)
  from public, anon, authenticated;
revoke all on function public.v2_7a_mutate_inventory_cycle_count(text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.v2_7a_list_inventory_cycle_counts(text) to authenticated;
grant execute on function public.v2_7a_mutate_inventory_cycle_count(text, jsonb, uuid) to authenticated;

comment on table public.center_inventory_cycle_counts is
  'V2-7A exact-center blind cycle-count lifecycle and due-state authority.';
comment on table public.center_inventory_cycle_count_lines is
  'V2-7A private count snapshot; expected quantity/version is omitted from DRAFT RPC projections.';
comment on function public.v2_7a_list_inventory_cycle_counts(text) is
  'Exact-center projection; DRAFT lines intentionally contain no expected quantity, item version, observed quantity, or variance.';

commit;
