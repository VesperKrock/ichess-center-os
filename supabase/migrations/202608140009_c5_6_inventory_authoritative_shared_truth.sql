begin;

-- C5.6 makes catalog, stored stock + its immutable movement evidence, and the
-- request workflow exact-center server truth. Inventory requests remain a
-- descriptive workflow and do not silently mutate stock or Finance.

create or replace function public.c5_6_inventory_access_role(p_center_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.lower(pg_catalog.replace(pg_catalog.replace(
    pg_catalog.btrim(coalesce(cm.role::text, '')), '-', '_'), ' ', '_'))
  from public.center_members cm
  join public.centers c on c.id = cm.center_id
  where cm.center_id = pg_catalog.btrim(coalesce(p_center_id, ''))
    and cm.user_id = auth.uid()
    and pg_catalog.lower(pg_catalog.btrim(coalesce(cm.status::text, ''))) = 'active'
    and pg_catalog.lower(pg_catalog.btrim(coalesce(c.status::text, ''))) = 'active'
    and pg_catalog.lower(pg_catalog.replace(pg_catalog.replace(
      pg_catalog.btrim(coalesce(cm.role::text, '')), '-', '_'), ' ', '_'))
      in ('owner', 'admin', 'center_admin', 'qtv', 'teacher', 'consultant', 'viewer')
  limit 1
$function$;

revoke all on function public.c5_6_inventory_access_role(text)
  from public, anon, authenticated;

create table public.center_inventory_items (
  center_id text not null references public.centers(id) on delete cascade,
  id uuid not null,
  name text not null,
  category text not null,
  unit text not null,
  quantity integer not null default 0,
  low_stock_threshold integer not null default 0,
  condition text not null,
  location text not null default '',
  note text not null default '',
  status text not null default 'active',
  version bigint not null default 1,
  created_by_user_id uuid not null references auth.users(id),
  created_by_membership_id uuid not null references public.center_members(id),
  updated_by_user_id uuid not null references auth.users(id),
  updated_by_membership_id uuid not null references public.center_members(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  archived_at timestamptz,
  primary key (center_id, id),
  constraint center_inventory_items_name_check check (length(btrim(name)) between 1 and 240),
  constraint center_inventory_items_category_check check (length(btrim(category)) between 1 and 160),
  constraint center_inventory_items_unit_check check (length(btrim(unit)) between 1 and 80),
  constraint center_inventory_items_quantity_check check (quantity >= 0),
  constraint center_inventory_items_threshold_check check (low_stock_threshold >= 0),
  constraint center_inventory_items_condition_check check (length(btrim(condition)) between 1 and 160),
  constraint center_inventory_items_location_check check (length(location) <= 500),
  constraint center_inventory_items_note_check check (length(note) <= 4000),
  constraint center_inventory_items_status_check check (status in ('active', 'archived')),
  constraint center_inventory_items_archive_check check (
    (status = 'active' and archived_at is null)
    or (status = 'archived' and archived_at is not null)
  ),
  constraint center_inventory_items_version_check check (version >= 1)
);

create unique index center_inventory_items_active_name_unique
  on public.center_inventory_items (center_id, lower(btrim(name)))
  where status = 'active';

create table public.center_inventory_movements (
  center_id text not null,
  id uuid not null,
  item_id uuid not null,
  item_name text not null,
  movement_type text not null,
  quantity integer not null,
  movement_date date not null,
  reason text not null,
  note text not null default '',
  cost_amount_minor bigint not null default 0,
  cost_method text not null default '',
  supplier_name text not null default '',
  before_quantity integer not null,
  after_quantity integer not null,
  item_version_before bigint not null,
  item_version_after bigint not null,
  actor_user_id uuid not null references auth.users(id),
  actor_membership_id uuid not null references public.center_members(id),
  actor_role text not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key (center_id, id),
  foreign key (center_id, item_id)
    references public.center_inventory_items(center_id, id) on delete restrict,
  constraint center_inventory_movements_type_check check (movement_type in ('IN', 'OUT')),
  constraint center_inventory_movements_quantity_check check (quantity > 0),
  constraint center_inventory_movements_stock_check check (
    before_quantity >= 0 and after_quantity >= 0
    and (
      (movement_type = 'IN' and after_quantity = before_quantity + quantity)
      or (movement_type = 'OUT' and after_quantity = before_quantity - quantity)
    )
  ),
  constraint center_inventory_movements_item_name_check check (length(btrim(item_name)) between 1 and 240),
  constraint center_inventory_movements_reason_check check (length(btrim(reason)) between 1 and 300),
  constraint center_inventory_movements_note_check check (length(note) <= 4000),
  constraint center_inventory_movements_cost_check check (
    cost_amount_minor between 0 and 9007199254740991
  ),
  constraint center_inventory_movements_cost_method_check check (length(cost_method) <= 160),
  constraint center_inventory_movements_supplier_check check (length(supplier_name) <= 300),
  constraint center_inventory_movements_version_check check (
    item_version_before >= 0 and item_version_after = item_version_before + 1
  )
);

create index center_inventory_movements_item_time_idx
  on public.center_inventory_movements (center_id, item_id, created_at desc);
create index center_inventory_movements_date_idx
  on public.center_inventory_movements (center_id, movement_date desc, created_at desc);

create table public.center_inventory_requests (
  center_id text not null references public.centers(id) on delete cascade,
  id uuid not null,
  request_code text not null,
  requester_display_name text not null,
  requester_role_label text not null default '',
  linked_student_id text,
  student_display_name text not null,
  item_types text[] not null,
  other_item_text text not null default '',
  item_details text not null,
  usage_modes text[] not null,
  other_usage_text text not null default '',
  usage_location_detail text not null,
  needed_date date not null,
  priority text not null default 'NORMAL',
  status text not null default 'NEW',
  admin_note text not null default '',
  created_by_user_id uuid not null references auth.users(id),
  created_by_membership_id uuid not null references public.center_members(id),
  created_by_role text not null,
  handled_by_user_id uuid references auth.users(id),
  handled_by_membership_id uuid references public.center_members(id),
  handled_by_role text,
  handled_at timestamptz,
  version bigint not null default 1,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (center_id, id),
  constraint center_inventory_requests_code_check check (request_code ~ '^DXK-[0-9]{8}-[0-9]{4,}$'),
  constraint center_inventory_requests_requester_check check (length(btrim(requester_display_name)) between 1 and 240),
  constraint center_inventory_requests_requester_role_check check (length(requester_role_label) <= 160),
  constraint center_inventory_requests_linked_student_check check (
    linked_student_id is null or (
      length(linked_student_id) between 1 and 200 and linked_student_id !~ '[[:cntrl:]]'
    )
  ),
  constraint center_inventory_requests_student_label_check check (length(btrim(student_display_name)) between 1 and 240),
  constraint center_inventory_requests_item_types_check check (
    cardinality(item_types) between 1 and 20
    and item_types <@ array[
      'book', 'pencil', 'eraser', 'test', 'standardChessSet',
      'chessClock', 'scoreSheet', 'other'
    ]::text[]
  ),
  constraint center_inventory_requests_item_text_check check (
    length(other_item_text) <= 500 and length(btrim(item_details)) between 1 and 4000
  ),
  constraint center_inventory_requests_usage_modes_check check (
    cardinality(usage_modes) between 1 and 20
    and usage_modes <@ array[
      'homeTutoring', 'onlinePrivate', 'onlineGroup', 'centerClass', 'clubPartner', 'other'
    ]::text[]
  ),
  constraint center_inventory_requests_usage_text_check check (
    length(other_usage_text) <= 500
    and length(btrim(usage_location_detail)) between 1 and 1000
  ),
  constraint center_inventory_requests_priority_check check (priority in ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  constraint center_inventory_requests_status_check check (
    status in ('NEW', 'PENDING', 'PREPARING', 'FULFILLED', 'REJECTED', 'CANCELLED')
  ),
  constraint center_inventory_requests_admin_note_check check (length(admin_note) <= 4000),
  constraint center_inventory_requests_handler_check check (
    (handled_by_user_id is null and handled_by_membership_id is null and handled_by_role is null)
    or (handled_by_user_id is not null and handled_by_membership_id is not null
      and length(btrim(handled_by_role)) between 1 and 80)
  ),
  constraint center_inventory_requests_terminal_time_check check (
    (status in ('FULFILLED', 'REJECTED', 'CANCELLED') and handled_at is not null)
    or (status not in ('FULFILLED', 'REJECTED', 'CANCELLED') and handled_at is null)
  ),
  constraint center_inventory_requests_version_check check (version >= 1)
);

create unique index center_inventory_requests_code_unique
  on public.center_inventory_requests (center_id, request_code);
create index center_inventory_requests_status_date_idx
  on public.center_inventory_requests (center_id, status, needed_date, created_at desc);

create table public.center_inventory_audit_events (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  actor_membership_id uuid not null references public.center_members(id),
  actor_role text not null,
  operation text not null,
  entity_type text not null,
  entity_id uuid not null,
  idempotency_key uuid not null,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default clock_timestamp(),
  constraint center_inventory_audit_operation_check check (
    operation in (
      'CREATE_ITEM', 'UPDATE_ITEM', 'ARCHIVE_ITEM', 'POST_MOVEMENT',
      'CREATE_REQUEST', 'UPDATE_REQUEST_STATUS'
    )
  ),
  constraint center_inventory_audit_entity_type_check check (
    entity_type in ('inventory_item', 'inventory_movement', 'inventory_request')
  ),
  constraint center_inventory_audit_state_check check (
    (before_state is null or jsonb_typeof(before_state) = 'object')
    and (after_state is null or jsonb_typeof(after_state) = 'object')
  )
);

create index center_inventory_audit_entity_idx
  on public.center_inventory_audit_events (center_id, entity_type, entity_id, created_at desc);

create table public.center_inventory_command_results (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  idempotency_key uuid not null,
  intent_digest bytea not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint center_inventory_command_results_scope_unique
    unique (center_id, actor_user_id, idempotency_key),
  constraint center_inventory_command_results_digest_check check (octet_length(intent_digest) = 32),
  constraint center_inventory_command_results_snapshot_check check (
    jsonb_typeof(result_snapshot) = 'object'
    and result_snapshot->>'outcome_code' = 'COMMITTED'
  )
);

alter table public.center_inventory_items enable row level security;
alter table public.center_inventory_items force row level security;
alter table public.center_inventory_movements enable row level security;
alter table public.center_inventory_movements force row level security;
alter table public.center_inventory_requests enable row level security;
alter table public.center_inventory_requests force row level security;
alter table public.center_inventory_audit_events enable row level security;
alter table public.center_inventory_audit_events force row level security;
alter table public.center_inventory_command_results enable row level security;
alter table public.center_inventory_command_results force row level security;

revoke all on table public.center_inventory_items from public, anon, authenticated, service_role;
revoke all on table public.center_inventory_movements from public, anon, authenticated, service_role;
revoke all on table public.center_inventory_requests from public, anon, authenticated, service_role;
revoke all on table public.center_inventory_audit_events from public, anon, authenticated, service_role;
revoke all on table public.center_inventory_command_results from public, anon, authenticated, service_role;

create or replace function public.c5_6_list_inventory_shared_truth(p_center_id text)
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
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'center_id', i.center_id, 'id', i.id, 'name', i.name,
        'category', i.category, 'unit', i.unit, 'quantity', i.quantity,
        'low_stock_threshold', i.low_stock_threshold, 'condition', i.condition,
        'location', i.location, 'note', i.note, 'status', i.status,
        'version', i.version, 'created_at', i.created_at, 'updated_at', i.updated_at,
        'archived_at', coalesce(i.archived_at::text, '')
      ) order by i.created_at desc, i.id)
      from public.center_inventory_items i where i.center_id = v_center_id
    ), '[]'::jsonb),
    'movements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'center_id', m.center_id, 'id', m.id, 'item_id', m.item_id,
        'item_name', m.item_name, 'movement_type', m.movement_type,
        'quantity', m.quantity, 'movement_date', m.movement_date,
        'reason', m.reason, 'note', m.note, 'cost_amount_minor', m.cost_amount_minor,
        'cost_method', m.cost_method, 'supplier_name', m.supplier_name,
        'before_quantity', m.before_quantity, 'after_quantity', m.after_quantity,
        'item_version_before', m.item_version_before,
        'item_version_after', m.item_version_after,
        'actor_user_id', m.actor_user_id,
        'actor_membership_id', m.actor_membership_id,
        'actor_role', m.actor_role, 'created_at', m.created_at
      ) order by m.created_at desc, m.id desc)
      from public.center_inventory_movements m where m.center_id = v_center_id
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
        'center_id', r.center_id, 'id', r.id, 'request_code', r.request_code,
        'requester_display_name', r.requester_display_name,
        'requester_role_label', r.requester_role_label,
        'linked_student_id', coalesce(r.linked_student_id, ''),
        'student_display_name', r.student_display_name,
        'item_types', r.item_types, 'other_item_text', r.other_item_text,
        'item_details', r.item_details, 'usage_modes', r.usage_modes,
        'other_usage_text', r.other_usage_text,
        'usage_location_detail', r.usage_location_detail,
        'needed_date', r.needed_date, 'priority', r.priority, 'status', r.status,
        'admin_note', r.admin_note,
        'created_by_user_id', r.created_by_user_id,
        'created_by_membership_id', r.created_by_membership_id,
        'created_by_role', r.created_by_role,
        'handled_by_user_id', coalesce(r.handled_by_user_id::text, ''),
        'handled_by_membership_id', coalesce(r.handled_by_membership_id::text, ''),
        'handled_by_role', coalesce(r.handled_by_role, ''),
        'handled_at', coalesce(r.handled_at::text, ''),
        'version', r.version, 'created_at', r.created_at, 'updated_at', r.updated_at
      ) order by r.created_at desc, r.id desc)
      from public.center_inventory_requests r where r.center_id = v_center_id
    ), '[]'::jsonb)
  );
end
$function$;

create or replace function public.c5_6_mutate_inventory_shared_truth(
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
  v_center_id text := btrim(coalesce(p_center_id, ''));
  v_role text;
  v_membership_id uuid;
  v_operation text := upper(btrim(coalesce(p_command->>'operation', '')));
  v_expected_version bigint;
  v_digest bytea;
  v_existing_result public.center_inventory_command_results%rowtype;
  v_item public.center_inventory_items%rowtype;
  v_request public.center_inventory_requests%rowtype;
  v_item_id uuid;
  v_movement_id uuid;
  v_request_id uuid;
  v_current_version bigint;
  v_new_version bigint;
  v_quantity integer;
  v_threshold integer;
  v_after_quantity bigint;
  v_cost_amount bigint;
  v_movement_date date;
  v_needed_date date;
  v_type text;
  v_status text;
  v_priority text;
  v_linked_student_id text;
  v_item_types text[];
  v_usage_modes text[];
  v_request_no bigint;
  v_request_code text;
  v_now timestamptz := clock_timestamp();
  v_before jsonb;
  v_after jsonb;
  v_entity_type text;
  v_entity_id uuid;
  v_result jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED');
  end if;
  if v_center_id = '' or length(v_center_id) > 160 then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_CENTER');
  end if;
  if p_idempotency_key is null or jsonb_typeof(p_command) <> 'object' then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;
  if v_operation not in (
    'CREATE_ITEM', 'UPDATE_ITEM', 'ARCHIVE_ITEM', 'POST_MOVEMENT',
    'CREATE_REQUEST', 'UPDATE_REQUEST_STATUS'
  ) then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_OPERATION');
  end if;
  begin
    v_expected_version := (p_command->>'expected_version')::bigint;
  exception when others then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end;
  if v_expected_version < 0
    or octet_length(convert_to(p_command::text, 'UTF8')) > 65536 then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;

  select lower(replace(replace(btrim(cm.role::text), '-', '_'), ' ', '_')), cm.id
    into v_role, v_membership_id
  from public.center_members cm
  join public.centers c on c.id = cm.center_id
  where cm.center_id = v_center_id and cm.user_id = v_actor
    and lower(btrim(coalesce(cm.status::text, ''))) = 'active'
    and lower(btrim(coalesce(c.status::text, ''))) = 'active'
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
  from public.center_inventory_command_results r
  where r.center_id = v_center_id and r.actor_user_id = v_actor
    and r.idempotency_key = p_idempotency_key;
  if found then
    if v_existing_result.intent_digest <> v_digest then
      return jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return v_existing_result.result_snapshot;
  end if;

  if v_operation in ('CREATE_ITEM', 'UPDATE_ITEM', 'ARCHIVE_ITEM', 'POST_MOVEMENT') then
    begin v_item_id := (p_command->>'item_id')::uuid;
    exception when others then return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD'); end;
    perform pg_advisory_xact_lock(hashtextextended(v_center_id || ':inventory-item:' || v_item_id::text, 0));
  end if;
  if v_operation in ('CREATE_REQUEST', 'UPDATE_REQUEST_STATUS') then
    begin v_request_id := (p_command->>'request_id')::uuid;
    exception when others then return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD'); end;
    perform pg_advisory_xact_lock(hashtextextended(v_center_id || ':inventory-request:' || v_request_id::text, 0));
  end if;

  if v_operation = 'CREATE_ITEM' then
    if v_expected_version <> 0 then
      return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    begin
      v_quantity := (p_command->>'initial_quantity')::integer;
      v_threshold := (p_command->>'low_stock_threshold')::integer;
    exception when others then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end;
    if v_quantity < 0 or v_threshold < 0
      or length(btrim(coalesce(p_command->>'name', ''))) not between 1 and 240
      or length(btrim(coalesce(p_command->>'category', ''))) not between 1 and 160
      or length(btrim(coalesce(p_command->>'unit', ''))) not between 1 and 80
      or length(btrim(coalesce(p_command->>'condition', ''))) not between 1 and 160
      or length(coalesce(p_command->>'location', '')) > 500
      or length(coalesce(p_command->>'note', '')) > 4000 then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    if exists (select 1 from public.center_inventory_items i
      where i.center_id = v_center_id and i.id = v_item_id) then
      return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    insert into public.center_inventory_items (
      center_id, id, name, category, unit, quantity, low_stock_threshold,
      condition, location, note, status, version,
      created_by_user_id, created_by_membership_id,
      updated_by_user_id, updated_by_membership_id, created_at, updated_at
    ) values (
      v_center_id, v_item_id, btrim(p_command->>'name'), btrim(p_command->>'category'),
      btrim(p_command->>'unit'), v_quantity, v_threshold,
      btrim(p_command->>'condition'), btrim(coalesce(p_command->>'location', '')),
      btrim(coalesce(p_command->>'note', '')), 'active', 1,
      v_actor, v_membership_id, v_actor, v_membership_id, v_now, v_now
    );
    if v_quantity > 0 then
      v_movement_id := gen_random_uuid();
      insert into public.center_inventory_movements (
        center_id, id, item_id, item_name, movement_type, quantity,
        movement_date, reason, before_quantity, after_quantity,
        item_version_before, item_version_after, actor_user_id,
        actor_membership_id, actor_role, created_at
      ) values (
        v_center_id, v_movement_id, v_item_id, btrim(p_command->>'name'), 'IN',
        v_quantity, v_now::date, 'Tồn đầu kỳ khi tạo vật tư', 0, v_quantity,
        0, 1, v_actor, v_membership_id, v_role, v_now
      );
    end if;
    v_entity_type := 'inventory_item'; v_entity_id := v_item_id; v_new_version := 1;
    v_after := jsonb_build_object('id', v_item_id, 'quantity', v_quantity, 'status', 'active');

  elsif v_operation = 'UPDATE_ITEM' then
    select * into v_item from public.center_inventory_items i
      where i.center_id = v_center_id and i.id = v_item_id for update;
    if not found then return jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_NOT_FOUND_OR_DENIED'); end if;
    if v_item.version <> v_expected_version then return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE'); end if;
    if v_item.status <> 'active' then return jsonb_build_object('ok', false, 'outcome_code', 'ITEM_ARCHIVED'); end if;
    begin v_threshold := (p_command->>'low_stock_threshold')::integer;
    exception when others then return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD'); end;
    if v_threshold < 0
      or length(btrim(coalesce(p_command->>'name', ''))) not between 1 and 240
      or length(btrim(coalesce(p_command->>'category', ''))) not between 1 and 160
      or length(btrim(coalesce(p_command->>'unit', ''))) not between 1 and 80
      or length(btrim(coalesce(p_command->>'condition', ''))) not between 1 and 160
      or length(coalesce(p_command->>'location', '')) > 500
      or length(coalesce(p_command->>'note', '')) > 4000 then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_before := jsonb_build_object('name', v_item.name, 'category', v_item.category,
      'unit', v_item.unit, 'quantity', v_item.quantity, 'condition', v_item.condition,
      'location', v_item.location, 'note', v_item.note, 'version', v_item.version);
    v_new_version := v_item.version + 1;
    update public.center_inventory_items set
      name = btrim(p_command->>'name'), category = btrim(p_command->>'category'),
      unit = btrim(p_command->>'unit'), low_stock_threshold = v_threshold,
      condition = btrim(p_command->>'condition'),
      location = btrim(coalesce(p_command->>'location', '')),
      note = btrim(coalesce(p_command->>'note', '')), version = v_new_version,
      updated_by_user_id = v_actor, updated_by_membership_id = v_membership_id,
      updated_at = v_now
    where center_id = v_center_id and id = v_item_id;
    v_entity_type := 'inventory_item'; v_entity_id := v_item_id;
    v_after := jsonb_build_object('id', v_item_id, 'quantity', v_item.quantity,
      'status', 'active', 'version', v_new_version);

  elsif v_operation = 'ARCHIVE_ITEM' then
    select * into v_item from public.center_inventory_items i
      where i.center_id = v_center_id and i.id = v_item_id for update;
    if not found then return jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_NOT_FOUND_OR_DENIED'); end if;
    if v_item.version <> v_expected_version then return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE'); end if;
    if v_item.status <> 'active' then return jsonb_build_object('ok', false, 'outcome_code', 'ITEM_ARCHIVED'); end if;
    v_before := jsonb_build_object('id', v_item.id, 'quantity', v_item.quantity,
      'status', v_item.status, 'version', v_item.version);
    v_new_version := v_item.version + 1;
    update public.center_inventory_items set status = 'archived', archived_at = v_now,
      version = v_new_version, updated_by_user_id = v_actor,
      updated_by_membership_id = v_membership_id, updated_at = v_now
    where center_id = v_center_id and id = v_item_id;
    v_entity_type := 'inventory_item'; v_entity_id := v_item_id;
    v_after := jsonb_build_object('id', v_item_id, 'quantity', v_item.quantity,
      'status', 'archived', 'version', v_new_version);

  elsif v_operation = 'POST_MOVEMENT' then
    begin
      v_movement_id := (p_command->>'movement_id')::uuid;
      v_quantity := (p_command->>'quantity')::integer;
      v_cost_amount := (p_command->>'cost_amount_minor')::bigint;
      v_movement_date := (p_command->>'movement_date')::date;
    exception when others then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end;
    v_type := upper(btrim(coalesce(p_command->>'movement_type', '')));
    if v_quantity < 1 or v_cost_amount not between 0 and 9007199254740991
      or v_type not in ('IN', 'OUT')
      or length(btrim(coalesce(p_command->>'reason', ''))) not between 1 and 300
      or length(coalesce(p_command->>'note', '')) > 4000
      or length(coalesce(p_command->>'cost_method', '')) > 160
      or length(coalesce(p_command->>'supplier_name', '')) > 300 then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    select * into v_item from public.center_inventory_items i
      where i.center_id = v_center_id and i.id = v_item_id for update;
    if not found then return jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_NOT_FOUND_OR_DENIED'); end if;
    if v_item.version <> v_expected_version then return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE'); end if;
    if v_item.status <> 'active' then return jsonb_build_object('ok', false, 'outcome_code', 'ITEM_ARCHIVED'); end if;
    v_after_quantity := case when v_type = 'OUT'
      then v_item.quantity::bigint - v_quantity else v_item.quantity::bigint + v_quantity end;
    if v_after_quantity < 0 then return jsonb_build_object('ok', false, 'outcome_code', 'NEGATIVE_STOCK'); end if;
    if v_after_quantity > 2147483647 then return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD'); end if;
    v_new_version := v_item.version + 1;
    insert into public.center_inventory_movements (
      center_id, id, item_id, item_name, movement_type, quantity, movement_date,
      reason, note, cost_amount_minor, cost_method, supplier_name,
      before_quantity, after_quantity, item_version_before, item_version_after,
      actor_user_id, actor_membership_id, actor_role, created_at
    ) values (
      v_center_id, v_movement_id, v_item_id, v_item.name, v_type, v_quantity,
      v_movement_date, btrim(p_command->>'reason'), btrim(coalesce(p_command->>'note', '')),
      case when v_type = 'IN' then v_cost_amount else 0 end,
      case when v_type = 'IN' then btrim(coalesce(p_command->>'cost_method', '')) else '' end,
      case when v_type = 'IN' then btrim(coalesce(p_command->>'supplier_name', '')) else '' end,
      v_item.quantity, v_after_quantity::integer, v_item.version, v_new_version,
      v_actor, v_membership_id, v_role, v_now
    );
    update public.center_inventory_items set quantity = v_after_quantity::integer,
      version = v_new_version, updated_by_user_id = v_actor,
      updated_by_membership_id = v_membership_id, updated_at = v_now
    where center_id = v_center_id and id = v_item_id;
    v_entity_type := 'inventory_movement'; v_entity_id := v_movement_id;
    v_before := jsonb_build_object('item_id', v_item_id, 'quantity', v_item.quantity,
      'item_version', v_item.version);
    v_after := jsonb_build_object('item_id', v_item_id, 'quantity', v_after_quantity,
      'item_version', v_new_version, 'movement_id', v_movement_id, 'movement_type', v_type);

  elsif v_operation = 'CREATE_REQUEST' then
    if v_expected_version <> 0 then return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE'); end if;
    begin
      v_needed_date := (p_command->>'needed_date')::date;
      select coalesce(array_agg(x), array[]::text[]) into v_item_types
        from jsonb_array_elements_text(p_command->'item_types') x;
      select coalesce(array_agg(x), array[]::text[]) into v_usage_modes
        from jsonb_array_elements_text(p_command->'usage_modes') x;
    exception when others then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end;
    v_priority := upper(btrim(coalesce(p_command->>'priority', '')));
    v_linked_student_id := nullif(btrim(coalesce(p_command->>'linked_student_id', '')), '');
    if cardinality(v_item_types) not between 1 and 20
      or cardinality(v_item_types) <> (select count(distinct x) from unnest(v_item_types) x)
      or not (v_item_types <@ array['book','pencil','eraser','test','standardChessSet','chessClock','scoreSheet','other']::text[])
      or cardinality(v_usage_modes) not between 1 and 20
      or cardinality(v_usage_modes) <> (select count(distinct x) from unnest(v_usage_modes) x)
      or not (v_usage_modes <@ array['homeTutoring','onlinePrivate','onlineGroup','centerClass','clubPartner','other']::text[])
      or v_priority not in ('LOW', 'NORMAL', 'HIGH', 'URGENT')
      or length(btrim(coalesce(p_command->>'requester_display_name', ''))) not between 1 and 240
      or length(coalesce(p_command->>'requester_role_label', '')) > 160
      or length(btrim(coalesce(p_command->>'student_display_name', ''))) not between 1 and 240
      or length(coalesce(p_command->>'other_item_text', '')) > 500
      or length(btrim(coalesce(p_command->>'item_details', ''))) not between 1 and 4000
      or length(coalesce(p_command->>'other_usage_text', '')) > 500
      or length(btrim(coalesce(p_command->>'usage_location_detail', ''))) not between 1 and 1000
      or length(coalesce(p_command->>'admin_note', '')) > 4000 then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    if v_linked_student_id is not null and (
      length(v_linked_student_id) > 200 or v_linked_student_id ~ '[[:cntrl:]]'
      or not exists (
        select 1 from public.center_cloud_entities e
        where e.center_id = v_center_id and e.entity_type = 'student'
          and e.local_id = v_linked_student_id and e.deleted_at is null
      )
    ) then
      return jsonb_build_object('ok', false, 'outcome_code', 'STUDENT_REFERENCE_DENIED');
    end if;
    if exists (select 1 from public.center_inventory_requests r
      where r.center_id = v_center_id and r.id = v_request_id) then
      return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    perform pg_advisory_xact_lock(hashtextextended(v_center_id || ':inventory-request-code:' || v_now::date::text, 0));
    select coalesce(max((substring(r.request_code from '([0-9]+)$'))::bigint), 0) + 1
      into v_request_no
    from public.center_inventory_requests r
    where r.center_id = v_center_id and r.request_code like 'DXK-' || to_char(v_now, 'YYYYMMDD') || '-%';
    v_request_code := 'DXK-' || to_char(v_now, 'YYYYMMDD') || '-' || lpad(v_request_no::text, 4, '0');
    insert into public.center_inventory_requests (
      center_id, id, request_code, requester_display_name, requester_role_label,
      linked_student_id, student_display_name, item_types, other_item_text,
      item_details, usage_modes, other_usage_text, usage_location_detail,
      needed_date, priority, status, admin_note,
      created_by_user_id, created_by_membership_id, created_by_role,
      version, created_at, updated_at
    ) values (
      v_center_id, v_request_id, v_request_code,
      btrim(p_command->>'requester_display_name'), btrim(coalesce(p_command->>'requester_role_label', '')),
      v_linked_student_id, btrim(p_command->>'student_display_name'), v_item_types,
      btrim(coalesce(p_command->>'other_item_text', '')), btrim(p_command->>'item_details'),
      v_usage_modes, btrim(coalesce(p_command->>'other_usage_text', '')),
      btrim(p_command->>'usage_location_detail'), v_needed_date, v_priority, 'NEW',
      btrim(coalesce(p_command->>'admin_note', '')), v_actor, v_membership_id, v_role,
      1, v_now, v_now
    );
    v_entity_type := 'inventory_request'; v_entity_id := v_request_id; v_new_version := 1;
    v_after := jsonb_build_object('id', v_request_id, 'request_code', v_request_code,
      'status', 'NEW', 'version', 1, 'created_by_user_id', v_actor,
      'created_by_membership_id', v_membership_id);

  elsif v_operation = 'UPDATE_REQUEST_STATUS' then
    v_status := upper(btrim(coalesce(p_command->>'status', '')));
    if v_status not in ('NEW', 'PENDING', 'PREPARING', 'FULFILLED', 'REJECTED', 'CANCELLED')
      or length(coalesce(p_command->>'admin_note', '')) > 4000 then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    select * into v_request from public.center_inventory_requests r
      where r.center_id = v_center_id and r.id = v_request_id for update;
    if not found then return jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_NOT_FOUND_OR_DENIED'); end if;
    if v_request.version <> v_expected_version then return jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE'); end if;
    if v_status <> v_request.status and not (
      (v_request.status = 'NEW' and v_status in ('PENDING', 'REJECTED', 'CANCELLED'))
      or (v_request.status = 'PENDING' and v_status in ('PREPARING', 'REJECTED', 'CANCELLED'))
      or (v_request.status = 'PREPARING' and v_status in ('FULFILLED', 'REJECTED', 'CANCELLED'))
    ) then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_WORKFLOW_TRANSITION');
    end if;
    v_before := jsonb_build_object('id', v_request.id, 'status', v_request.status,
      'admin_note', v_request.admin_note, 'version', v_request.version);
    v_new_version := v_request.version + 1;
    update public.center_inventory_requests set status = v_status,
      admin_note = btrim(coalesce(p_command->>'admin_note', '')),
      handled_by_user_id = v_actor, handled_by_membership_id = v_membership_id,
      handled_by_role = v_role,
      handled_at = case when v_status in ('FULFILLED', 'REJECTED', 'CANCELLED') then v_now else null end,
      version = v_new_version, updated_at = v_now
    where center_id = v_center_id and id = v_request_id;
    v_entity_type := 'inventory_request'; v_entity_id := v_request_id;
    v_after := jsonb_build_object('id', v_request_id, 'status', v_status,
      'admin_note', btrim(coalesce(p_command->>'admin_note', '')), 'version', v_new_version,
      'handled_by_user_id', v_actor, 'handled_by_membership_id', v_membership_id,
      'handled_by_role', v_role);
  end if;

  insert into public.center_inventory_audit_events (
    center_id, actor_user_id, actor_membership_id, actor_role, operation,
    entity_type, entity_id, idempotency_key, before_state, after_state, created_at
  ) values (
    v_center_id, v_actor, v_membership_id, v_role, v_operation,
    v_entity_type, v_entity_id, p_idempotency_key, v_before, v_after, v_now
  );

  v_result := jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED', 'center_id', v_center_id,
    'entity_type', v_entity_type, 'entity_id', v_entity_id,
    'entity_version', v_new_version, 'committed_at', v_now
  );
  insert into public.center_inventory_command_results (
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (v_center_id, v_actor, p_idempotency_key, v_digest, v_result);
  return v_result;
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'outcome_code', 'CONCURRENT_CONFLICT');
  when check_violation or string_data_right_truncation or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
end
$function$;

revoke all on function public.c5_6_list_inventory_shared_truth(text)
  from public, anon, authenticated;
revoke all on function public.c5_6_mutate_inventory_shared_truth(text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.c5_6_list_inventory_shared_truth(text) to authenticated;
grant execute on function public.c5_6_mutate_inventory_shared_truth(text, jsonb, uuid) to authenticated;

comment on table public.center_inventory_items is
  'C5.6 exact-center Inventory catalog and atomically maintained current stock.';
comment on table public.center_inventory_movements is
  'C5.6 immutable stock evidence; browser cannot author actor, timestamp, before, after, or resulting quantity.';
comment on table public.center_inventory_requests is
  'C5.6 descriptive request workflow. Fulfillment intentionally does not mutate stock or Finance.';

commit;
