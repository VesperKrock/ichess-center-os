begin;

-- CHB-1: one-time tester-installation handoff janitor and first-Owner bootstrap.
-- Additive and fail-closed. Applying this migration never starts, arms, or executes a reset.

do $chb1_prerequisites$
begin
  if pg_catalog.to_regclass('public.centers') is null
     or pg_catalog.to_regclass('public.center_members') is null
     or pg_catalog.to_regclass('public.center_access_governance') is null
     or pg_catalog.to_regclass('public.account_credential_gates') is null
     or pg_catalog.to_regclass('public.account_governance_commands') is null
     or pg_catalog.to_regclass('public.account_governance_events') is null
     or pg_catalog.to_regclass('public.account_recovery_custodians') is null
     or pg_catalog.to_regprocedure('public.arg2_activate_center_governance(text,uuid,uuid,uuid)') is null
     or pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'chb1_prerequisite_contract_missing';
  end if;
end;
$chb1_prerequisites$;

-- The physical schema dump qualifies COALESCE in the inherited ARG-2 helper as
-- pg_catalog.coalesce(), which is not callable. Preserve the exact service-role
-- boundary with a hosted/replay-safe boolean comparison; do not edit ARG-2 bytes.
create or replace function public.arg2_internal_require_service_role()
returns void
language plpgsql
security definer
set search_path = ''
as $chb1_arg2_service_role_replay_fix$
begin
  if (auth.jwt() ->> 'role') is distinct from 'service_role' then
    raise exception 'arg2_service_role_required';
  end if;
end;
$chb1_arg2_service_role_replay_fix$;

revoke all on function public.arg2_internal_require_service_role()
  from public, anon, authenticated, service_role;

create table public.installation_handoff_control (
  singleton_id smallint primary key default 1 check (singleton_id = 1),
  installation_state text not null check (installation_state in (
    'TESTER_ACTIVE', 'RESET_PREPARED', 'RESET_ARMED', 'RESET_EXECUTING',
    'HISTORY_SEALED', 'SESSION_DRAINING', 'UNINITIALIZED_NEXT_EPOCH',
    'FRESH_UNINITIALIZED', 'BOOTSTRAP_CLAIMED', 'OPERATIONAL_LOCKED',
    'RESET_REPAIR_REQUIRED', 'LOCKED_EXISTING'
  )),
  janitor_state text not null check (janitor_state in (
    'AVAILABLE', 'PREPARED', 'ARMED', 'CONSUMED', 'LOCKED', 'NOT_APPLICABLE'
  )),
  bootstrap_state text not null check (bootstrap_state in (
    'UNCONFIGURED', 'READY', 'CLAIMED', 'LOCKED_EXISTING', 'SUSPENDED'
  )),
  installation_epoch bigint not null default 1 check (installation_epoch >= 1),
  control_version bigint not null default 1 check (control_version >= 1),
  active_reset_command_id uuid,
  bootstrap_target_user_id uuid references auth.users(id) on delete restrict,
  bootstrap_token_digest text check (
    bootstrap_token_digest is null or bootstrap_token_digest ~ '^[0-9a-f]{64}$'
  ),
  bootstrap_token_expires_at timestamptz,
  history_sealed_at timestamptz,
  session_drain_until timestamptz,
  max_private_url_seconds integer not null default 3600
    check (max_private_url_seconds between 3600 and 86400),
  reset_consumed_at timestamptz,
  bootstrap_claimed_at timestamptz,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  check (
    (bootstrap_state = 'READY' and bootstrap_target_user_id is not null
      and bootstrap_token_digest is not null and bootstrap_token_expires_at is not null)
    or bootstrap_state <> 'READY'
  )
);

create table public.installation_restore_verifications (
  verification_id uuid primary key default gen_random_uuid(),
  manifest_id text not null check (pg_catalog.length(pg_catalog.btrim(manifest_id)) between 8 and 160),
  manifest_digest text not null check (manifest_digest ~ '^[0-9a-f]{64}$'),
  backup_completed_at timestamptz not null,
  restore_verified_at timestamptz not null,
  verified_by text not null check (verified_by ~ '^[a-z][a-z0-9_-]{2,79}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  unique (manifest_id, manifest_digest),
  check (restore_verified_at >= backup_completed_at),
  check (expires_at > restore_verified_at)
);

create table public.installation_handoff_commands (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('RESET', 'BOOTSTRAP')),
  request_id text not null check (pg_catalog.length(pg_catalog.btrim(request_id)) between 8 and 160),
  state text not null check (state in (
    'PREPARED', 'ARMED', 'EXECUTING', 'SESSION_DRAINING', 'FINALIZED',
    'REPAIR_REQUIRED', 'CANCELLED', 'EXPIRED'
  )),
  stage text not null check (stage in (
    'PREPARED', 'ARMED', 'HISTORY_SEALED', 'SESSIONS_PENDING',
    'UNINITIALIZED', 'CENTER_OWNER_CREATED', 'COMPLETE'
  )),
  intent_hash text not null check (intent_hash ~ '^[0-9a-f]{64}$'),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  target_user_id uuid not null references auth.users(id) on delete restrict,
  expected_control_version bigint not null check (expected_control_version >= 1),
  restore_verification_id uuid references public.installation_restore_verifications(verification_id) on delete restrict,
  scope_digest text check (scope_digest is null or scope_digest ~ '^[0-9a-f]{64}$'),
  data_manifest_digest text check (data_manifest_digest is null or data_manifest_digest ~ '^[0-9a-f]{64}$'),
  center_count integer not null default 0 check (center_count >= 0),
  auth_user_count integer not null default 0 check (auth_user_count >= 0),
  storage_object_count bigint not null default 0 check (storage_object_count >= 0),
  confirmation_challenge_digest text check (
    confirmation_challenge_digest is null or confirmation_challenge_digest ~ '^[0-9a-f]{64}$'
  ),
  reauthentication_receipt_hash text check (
    reauthentication_receipt_hash is null or reauthentication_receipt_hash ~ '^[0-9a-f]{64}$'
  ),
  cooling_until timestamptz,
  expires_at timestamptz,
  repair_code text check (repair_code is null or repair_code ~ '^[a-z][a-z0-9_]{2,79}$'),
  safe_result jsonb not null default '{}'::jsonb,
  prepared_at timestamptz not null default pg_catalog.transaction_timestamp(),
  armed_at timestamptz,
  executed_at timestamptz,
  finalized_at timestamptz,
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  unique (action, request_id),
  check (
    pg_catalog.lower(safe_result::text) !~
      '"(password|token|access_token|refresh_token|jwt|secret|confirmation_phrase)"[[:space:]]*:'
  )
);

alter table public.installation_handoff_control
  add constraint installation_handoff_control_active_command_fk
  foreign key (active_reset_command_id)
  references public.installation_handoff_commands(id) on delete restrict;

create table public.installation_handoff_scopes (
  command_id uuid not null references public.installation_handoff_commands(id) on delete restrict,
  center_id text not null references public.centers(id) on delete restrict,
  center_status text not null,
  center_updated_at timestamptz not null,
  owner_membership_id uuid not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  owner_membership_version integer not null check (owner_membership_version >= 1),
  governance_version bigint not null check (governance_version >= 1),
  governance_status text not null,
  primary key (command_id, center_id),
  foreign key (center_id, owner_membership_id)
    references public.center_members(center_id, id) on delete restrict
);

create table public.installation_center_epochs (
  center_id text primary key references public.centers(id) on delete restrict,
  installation_epoch bigint not null check (installation_epoch >= 1),
  epoch_status text not null check (epoch_status in ('CURRENT', 'SEALED')),
  bound_at timestamptz not null default pg_catalog.transaction_timestamp(),
  sealed_at timestamptz
);

create table public.installation_session_drain_targets (
  command_id uuid not null references public.installation_handoff_commands(id) on delete restrict,
  auth_user_id uuid not null references auth.users(id) on delete restrict,
  drain_method text not null check (drain_method in ('SERVER_CREDENTIAL_ROTATION', 'TARGET_GLOBAL_SIGNOUT')),
  drain_state text not null default 'PENDING'
    check (drain_state in ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED')),
  attempt_id uuid,
  lease_until timestamptz,
  receipt_hash text check (receipt_hash is null or receipt_hash ~ '^[0-9a-f]{64}$'),
  attempted_at timestamptz,
  completed_at timestamptz,
  primary key (command_id, auth_user_id),
  check (drain_state <> 'PROCESSING' or (attempt_id is not null and lease_until is not null))
);

create table public.installation_handoff_events (
  id uuid primary key default gen_random_uuid(),
  command_id uuid references public.installation_handoff_commands(id) on delete restrict,
  event_sequence integer not null check (event_sequence >= 1),
  event_type text not null check (pg_catalog.length(pg_catalog.btrim(event_type)) > 0),
  actor_user_id uuid references auth.users(id) on delete restrict,
  target_user_id uuid references auth.users(id) on delete restrict,
  installation_epoch bigint not null check (installation_epoch >= 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  unique nulls not distinct (command_id, event_sequence),
  check (
    pg_catalog.lower(metadata::text) !~
      '"(password|token|access_token|refresh_token|jwt|secret|confirmation_phrase)"[[:space:]]*:'
  )
);

create index installation_handoff_commands_state_idx
  on public.installation_handoff_commands(state, updated_at desc);
create index installation_handoff_events_created_idx
  on public.installation_handoff_events(created_at desc);

alter table public.installation_handoff_control enable row level security;
alter table public.installation_handoff_control force row level security;
alter table public.installation_restore_verifications enable row level security;
alter table public.installation_restore_verifications force row level security;
alter table public.installation_handoff_commands enable row level security;
alter table public.installation_handoff_commands force row level security;
alter table public.installation_handoff_scopes enable row level security;
alter table public.installation_handoff_scopes force row level security;
alter table public.installation_center_epochs enable row level security;
alter table public.installation_center_epochs force row level security;
alter table public.installation_session_drain_targets enable row level security;
alter table public.installation_session_drain_targets force row level security;
alter table public.installation_handoff_events enable row level security;
alter table public.installation_handoff_events force row level security;

revoke all on public.installation_handoff_control from public, anon, authenticated, service_role;
revoke all on public.installation_restore_verifications from public, anon, authenticated, service_role;
revoke all on public.installation_handoff_commands from public, anon, authenticated, service_role;
revoke all on public.installation_handoff_scopes from public, anon, authenticated, service_role;
revoke all on public.installation_center_epochs from public, anon, authenticated, service_role;
revoke all on public.installation_session_drain_targets from public, anon, authenticated, service_role;
revoke all on public.installation_handoff_events from public, anon, authenticated, service_role;

create function public.chb1_internal_require_service_role()
returns void
language plpgsql
security definer
set search_path = ''
as $chb1_internal_require_service_role$
begin
  if (auth.jwt() ->> 'role') is distinct from 'service_role' then
    raise exception 'chb1_service_role_required';
  end if;
end;
$chb1_internal_require_service_role$;

revoke all on function public.chb1_internal_require_service_role()
  from public, anon, authenticated, service_role;

create function public.chb1_internal_digest(p_value text)
returns text
language sql
immutable
set search_path = ''
as $chb1_internal_digest$
  select pg_catalog.encode(extensions.digest(pg_catalog.convert_to(p_value, 'utf8'), 'sha256'), 'hex');
$chb1_internal_digest$;

revoke all on function public.chb1_internal_digest(text)
  from public, anon, authenticated, service_role;

create function public.chb1_internal_append_event(
  p_command_id uuid,
  p_event_type text,
  p_actor_user_id uuid,
  p_target_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $chb1_internal_append_event$
declare
  v_sequence integer;
  v_epoch bigint;
  v_event_id uuid;
begin
  select installation_epoch into v_epoch
  from public.installation_handoff_control where singleton_id = 1;

  select coalesce(pg_catalog.max(event_sequence), 0) + 1 into v_sequence
  from public.installation_handoff_events
  where command_id is not distinct from p_command_id;

  insert into public.installation_handoff_events(
    command_id, event_sequence, event_type, actor_user_id,
    target_user_id, installation_epoch, metadata
  ) values (
    p_command_id, v_sequence, pg_catalog.btrim(p_event_type), p_actor_user_id,
    p_target_user_id, v_epoch, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_event_id;
  return v_event_id;
end;
$chb1_internal_append_event$;

revoke all on function public.chb1_internal_append_event(uuid,text,uuid,uuid,jsonb)
  from public, anon, authenticated, service_role;

create function public.chb1_internal_guard_event_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $chb1_internal_guard_event_immutable$
begin
  raise exception 'chb1_handoff_event_is_immutable';
end;
$chb1_internal_guard_event_immutable$;

create trigger chb1_handoff_event_immutable
before update or delete on public.installation_handoff_events
for each row execute function public.chb1_internal_guard_event_immutable();

revoke all on function public.chb1_internal_guard_event_immutable()
  from public, anon, authenticated, service_role;
revoke update, delete, truncate on public.installation_handoff_events
  from public, anon, authenticated, service_role;

create function public.chb1_internal_active_command_count()
returns integer
language plpgsql
security definer
set search_path = ''
as $chb1_internal_active_command_count$
declare
  v_count bigint := 0;
  v_delta bigint := 0;
begin
  select pg_catalog.count(*) into v_delta
  from public.account_governance_commands
  where state in ('prepared', 'repair_required');
  v_count := v_count + v_delta;

  if pg_catalog.to_regclass('public.center_staff_deletion_requests') is not null then
    execute 'select count(*) from public.center_staff_deletion_requests where status in (''pending-review'',''execution-pending'') or execution_state = ''waiting-backend'''
      into v_delta;
    v_count := v_count + v_delta;
  end if;

  if pg_catalog.to_regclass('public.center_staff_document_attachment_deletion_requests') is not null then
    execute 'select count(*) from public.center_staff_document_attachment_deletion_requests where status in (''requested'',''approved'',''executing'')'
      into v_delta;
    v_count := v_count + v_delta;
  end if;

  if pg_catalog.to_regclass('public.crm_outbox_event') is not null then
    execute 'select count(*) from public.crm_outbox_event where delivery_status in (''PENDING'',''RETRY'',''CLAIMED'')'
      into v_delta;
    v_count := v_count + v_delta;
  end if;

  return v_count::integer;
end;
$chb1_internal_active_command_count$;

revoke all on function public.chb1_internal_active_command_count()
  from public, anon, authenticated, service_role;

create function public.chb1_internal_manifest()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $chb1_internal_manifest$
declare
  v_centers text[];
  v_rows jsonb := '[]'::jsonb;
  v_record record;
  v_count bigint;
  v_auth_count integer;
  v_storage_count bigint := 0;
  v_global_business_count bigint := 0;
  v_scope_digest text;
  v_data_digest text;
begin
  select coalesce(pg_catalog.array_agg(id order by id), '{}'::text[]) into v_centers
  from public.centers where status <> 'archived';

  for v_record in
    select n.nspname as schema_name, c.relname as table_name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public' and c.relkind in ('r','p')
      and a.attname = 'center_id' and not a.attisdropped
      and c.relname not like 'installation_%'
    order by c.relname
  loop
    execute pg_catalog.format(
      'select count(*) from %I.%I where center_id = any ($1)',
      v_record.schema_name, v_record.table_name
    ) into v_count using v_centers;
    v_rows := v_rows || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('table', v_record.table_name, 'count', v_count)
    );
    execute pg_catalog.format('select count(*) from %I.%I',
      v_record.schema_name, v_record.table_name) into v_count;
    v_global_business_count := v_global_business_count + v_count;
  end loop;

  select pg_catalog.count(*)::integer into v_auth_count from auth.users;
  if pg_catalog.to_regclass('storage.objects') is not null then
    execute 'select count(*) from storage.objects' into v_storage_count;
  end if;

  select public.chb1_internal_digest(coalesce(pg_catalog.string_agg(
    pg_catalog.concat_ws('|', c.id, c.status, c.updated_at::text,
      g.status, g.governance_version::text, g.canonical_owner_membership_id::text,
      m.user_id::text, m.membership_version::text), E'\n' order by c.id), ''))
  into v_scope_digest
  from public.centers c
  join public.center_access_governance g on g.center_id = c.id
  join public.center_members m on m.id = g.canonical_owner_membership_id
  where c.status <> 'archived';

  v_data_digest := public.chb1_internal_digest(
    pg_catalog.jsonb_build_object(
      'centers', v_centers, 'rows', v_rows,
      'auth_users', v_auth_count, 'storage_objects', v_storage_count
    )::text
  );

  return pg_catalog.jsonb_build_object(
    'center_ids', pg_catalog.to_jsonb(v_centers),
    'center_count', pg_catalog.cardinality(v_centers),
    'auth_user_count', v_auth_count,
    'storage_object_count', v_storage_count,
    'global_center_row_count', v_global_business_count,
    'scope_digest', v_scope_digest,
    'data_manifest_digest', v_data_digest,
    'active_command_count', public.chb1_internal_active_command_count(),
    'table_counts', v_rows
  );
end;
$chb1_internal_manifest$;

revoke all on function public.chb1_internal_manifest()
  from public, anon, authenticated, service_role;

create function public.chb1_internal_actor_owns_complete_scope(p_actor_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $chb1_internal_actor_owns_complete_scope$
  select exists (select 1 from public.centers where status <> 'archived')
     and not exists (
       select 1
       from public.centers c
       left join public.center_access_governance g
         on g.center_id = c.id and g.status = 'active'
       left join public.center_members m
         on m.id = g.canonical_owner_membership_id
        and m.center_id = c.id and m.role = 'owner' and m.status = 'active'
       where c.status <> 'archived'
         and (m.id is null or m.user_id <> p_actor_user_id)
     );
$chb1_internal_actor_owns_complete_scope$;

revoke all on function public.chb1_internal_actor_owns_complete_scope(uuid)
  from public, anon, authenticated, service_role;

create function public.chb1_get_handoff_capability()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $chb1_get_handoff_capability$
declare
  v_control public.installation_handoff_control%rowtype;
  v_uid uuid := auth.uid();
  v_is_owner boolean := false;
begin
  select * into v_control from public.installation_handoff_control where singleton_id = 1;
  if not found then
    return pg_catalog.jsonb_build_object('state', 'UNAVAILABLE');
  end if;

  if v_uid is not null then
    v_is_owner := public.chb1_internal_actor_owns_complete_scope(v_uid);
  end if;

  return pg_catalog.jsonb_build_object(
    'state', v_control.installation_state,
    'control_version', v_control.control_version,
    'janitor_available', v_is_owner and v_control.installation_state = 'TESTER_ACTIVE'
      and v_control.janitor_state = 'AVAILABLE',
    'janitor_in_progress', v_is_owner and v_control.installation_state in (
      'RESET_PREPARED','RESET_ARMED','RESET_REPAIR_REQUIRED'
    ),
    'bootstrap_available', v_uid is not null
      and v_uid = v_control.bootstrap_target_user_id
      and v_control.installation_state in ('UNINITIALIZED_NEXT_EPOCH','FRESH_UNINITIALIZED')
      and v_control.bootstrap_state = 'READY',
    'target_session_drain_required', v_uid is not null
      and v_uid = v_control.bootstrap_target_user_id
      and v_control.installation_state in ('SESSION_DRAINING','RESET_REPAIR_REQUIRED'),
    'target_session_drain_completed', v_uid is not null
      and v_uid = v_control.bootstrap_target_user_id
      and v_control.installation_state in ('SESSION_DRAINING','RESET_REPAIR_REQUIRED')
      and exists (
        select 1 from public.installation_session_drain_targets d
        where d.command_id = v_control.active_reset_command_id
          and d.auth_user_id = v_uid and d.drain_state = 'SUCCEEDED'
      ),
    'session_drain_until', case
      when v_uid = v_control.bootstrap_target_user_id then v_control.session_drain_until
      else null end,
    'installation_epoch', v_control.installation_epoch
  );
end;
$chb1_get_handoff_capability$;

revoke all on function public.chb1_get_handoff_capability() from public;
grant execute on function public.chb1_get_handoff_capability() to anon, authenticated, service_role;

create function public.chb1_inspect_installation_handoff(p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $chb1_inspect_installation_handoff$
declare
  v_control public.installation_handoff_control%rowtype;
  v_manifest jsonb;
begin
  perform public.chb1_internal_require_service_role();
  select * into v_control from public.installation_handoff_control where singleton_id = 1;
  if not public.chb1_internal_actor_owns_complete_scope(p_actor_user_id) then
    raise exception 'chb1_complete_scope_owner_required';
  end if;
  v_manifest := public.chb1_internal_manifest();
  return pg_catalog.jsonb_build_object(
    'state', v_control.installation_state,
    'janitor_state', v_control.janitor_state,
    'control_version', v_control.control_version,
    'active_command_id', v_control.active_reset_command_id,
    'manifest', v_manifest,
    'cooling_until', (select cooling_until from public.installation_handoff_commands
      where id = v_control.active_reset_command_id),
    'expires_at', (select expires_at from public.installation_handoff_commands
      where id = v_control.active_reset_command_id)
  );
end;
$chb1_inspect_installation_handoff$;

revoke all on function public.chb1_inspect_installation_handoff(uuid)
  from public, anon, authenticated;
grant execute on function public.chb1_inspect_installation_handoff(uuid) to service_role;

create function public.chb1_register_restore_verification(
  p_manifest_id text,
  p_manifest_digest text,
  p_backup_completed_at timestamptz,
  p_restore_verified_at timestamptz,
  p_verified_by text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $chb1_register_restore_verification$
declare v_id uuid;
begin
  perform public.chb1_internal_require_service_role();
  if p_restore_verified_at > pg_catalog.clock_timestamp()
     or p_restore_verified_at < pg_catalog.clock_timestamp() - interval '24 hours'
     or p_expires_at <= pg_catalog.clock_timestamp() then
    raise exception 'chb1_recent_restore_verification_required';
  end if;
  insert into public.installation_restore_verifications(
    manifest_id, manifest_digest, backup_completed_at, restore_verified_at, verified_by, expires_at
  ) values (
    pg_catalog.btrim(p_manifest_id), pg_catalog.lower(p_manifest_digest), p_backup_completed_at,
    p_restore_verified_at, pg_catalog.lower(pg_catalog.btrim(p_verified_by)), p_expires_at
  ) returning verification_id into v_id;
  return v_id;
end;
$chb1_register_restore_verification$;

revoke all on function public.chb1_register_restore_verification(text,text,timestamptz,timestamptz,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.chb1_register_restore_verification(text,text,timestamptz,timestamptz,text,timestamptz)
  to service_role;

create function public.chb1_prepare_handoff_reset(
  p_request_id text,
  p_intent_hash text,
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_expected_control_version bigint,
  p_restore_verification_id uuid,
  p_challenge_digest text,
  p_bootstrap_token_digest text,
  p_bootstrap_token_expires_at timestamptz,
  p_reauthentication_receipt_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $chb1_prepare_handoff_reset$
declare
  v_control public.installation_handoff_control%rowtype;
  v_existing public.installation_handoff_commands%rowtype;
  v_verification public.installation_restore_verifications%rowtype;
  v_manifest jsonb;
  v_command_id uuid;
begin
  perform public.chb1_internal_require_service_role();
  perform pg_catalog.pg_advisory_xact_lock(20871001);

  select * into v_control from public.installation_handoff_control where singleton_id = 1 for update;
  select * into v_existing from public.installation_handoff_commands
    where action = 'RESET' and request_id = pg_catalog.btrim(p_request_id);
  if found then
    if v_existing.intent_hash <> pg_catalog.lower(p_intent_hash) then
      raise exception 'chb1_changed_intent_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true, 'command_id', v_existing.id, 'state', v_existing.state,
      'cooling_until', v_existing.cooling_until, 'expires_at', v_existing.expires_at,
      'exact_retry', true
    );
  end if;

  if v_control.installation_state <> 'TESTER_ACTIVE'
     or v_control.janitor_state <> 'AVAILABLE'
     or v_control.control_version <> p_expected_control_version then
    raise exception 'chb1_reset_not_available_or_stale';
  end if;
  if p_actor_user_id = p_target_user_id then
    raise exception 'chb1_reset_owner_and_bootstrap_target_must_differ';
  end if;
  if not public.chb1_internal_actor_owns_complete_scope(p_actor_user_id) then
    raise exception 'chb1_complete_scope_owner_required';
  end if;
  if not exists (select 1 from auth.users where id = p_target_user_id and email_confirmed_at is not null) then
    raise exception 'chb1_confirmed_bootstrap_target_required';
  end if;
  if public.chb1_internal_active_command_count() <> 0 then
    raise exception 'chb1_active_governance_or_business_command';
  end if;
  select * into v_verification from public.installation_restore_verifications
    where verification_id = p_restore_verification_id
      and restore_verified_at >= pg_catalog.clock_timestamp() - interval '24 hours'
      and expires_at > pg_catalog.clock_timestamp();
  if not found then raise exception 'chb1_restore_verified_backup_required'; end if;

  v_manifest := public.chb1_internal_manifest();
  if (v_manifest->>'center_count')::integer < 1 then raise exception 'chb1_reset_scope_empty'; end if;

  insert into public.installation_handoff_commands(
    action, request_id, state, stage, intent_hash, actor_user_id, target_user_id,
    expected_control_version, restore_verification_id, scope_digest, data_manifest_digest,
    center_count, auth_user_count, storage_object_count, confirmation_challenge_digest,
    reauthentication_receipt_hash, cooling_until, expires_at
  ) values (
    'RESET', pg_catalog.btrim(p_request_id), 'PREPARED', 'PREPARED', pg_catalog.lower(p_intent_hash),
    p_actor_user_id, p_target_user_id, p_expected_control_version, p_restore_verification_id,
    v_manifest->>'scope_digest', v_manifest->>'data_manifest_digest',
    (v_manifest->>'center_count')::integer, (v_manifest->>'auth_user_count')::integer,
    (v_manifest->>'storage_object_count')::bigint, pg_catalog.lower(p_challenge_digest),
    pg_catalog.lower(p_reauthentication_receipt_hash),
    pg_catalog.clock_timestamp() + interval '24 hours', pg_catalog.clock_timestamp() + interval '7 days'
  ) returning id into v_command_id;

  insert into public.installation_handoff_scopes(
    command_id, center_id, center_status, center_updated_at, owner_membership_id,
    owner_user_id, owner_membership_version, governance_version, governance_status
  )
  select v_command_id, c.id, c.status, c.updated_at, g.canonical_owner_membership_id,
    m.user_id, m.membership_version, g.governance_version, g.status
  from public.centers c
  join public.center_access_governance g on g.center_id = c.id
  join public.center_members m on m.id = g.canonical_owner_membership_id
  where c.status <> 'archived'
  order by c.id;

  update public.installation_handoff_control
  set installation_state = 'RESET_PREPARED', janitor_state = 'PREPARED',
      active_reset_command_id = v_command_id, bootstrap_target_user_id = p_target_user_id,
      bootstrap_token_digest = pg_catalog.lower(p_bootstrap_token_digest),
      bootstrap_token_expires_at = p_bootstrap_token_expires_at,
      control_version = control_version + 1, updated_at = pg_catalog.transaction_timestamp()
  where singleton_id = 1;

  perform public.chb1_internal_append_event(v_command_id, 'RESET_PREPARED', p_actor_user_id,
    p_target_user_id, pg_catalog.jsonb_build_object(
      'center_count', v_manifest->>'center_count',
      'scope_digest', v_manifest->>'scope_digest',
      'data_manifest_digest', v_manifest->>'data_manifest_digest',
      'restore_verification_id', p_restore_verification_id
    ));

  return pg_catalog.jsonb_build_object(
    'ok', true, 'command_id', v_command_id,
    'state', 'PREPARED', 'center_count', (v_manifest->>'center_count')::integer,
    'cooling_until', pg_catalog.clock_timestamp() + interval '24 hours',
    'expires_at', pg_catalog.clock_timestamp() + interval '7 days', 'exact_retry', false
  );
end;
$chb1_prepare_handoff_reset$;

revoke all on function public.chb1_prepare_handoff_reset(text,text,uuid,uuid,bigint,uuid,text,text,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.chb1_prepare_handoff_reset(text,text,uuid,uuid,bigint,uuid,text,text,timestamptz,text)
  to service_role;

create function public.chb1_internal_assert_frozen_reset(p_command_id uuid, p_actor_user_id uuid)
returns public.installation_handoff_commands
language plpgsql
security definer
set search_path = ''
as $chb1_internal_assert_frozen_reset$
declare
  v_command public.installation_handoff_commands%rowtype;
  v_manifest jsonb;
begin
  select * into v_command from public.installation_handoff_commands
  where id = p_command_id and action = 'RESET' for update;
  if not found then raise exception 'chb1_reset_command_not_found'; end if;
  if v_command.actor_user_id <> p_actor_user_id
     or not public.chb1_internal_actor_owns_complete_scope(p_actor_user_id) then
    raise exception 'chb1_complete_scope_owner_required';
  end if;
  if v_command.expires_at <= pg_catalog.clock_timestamp() then raise exception 'chb1_reset_command_expired'; end if;
  if public.chb1_internal_active_command_count() <> 0 then raise exception 'chb1_active_governance_or_business_command'; end if;
  v_manifest := public.chb1_internal_manifest();
  if v_command.scope_digest <> v_manifest->>'scope_digest'
     or v_command.data_manifest_digest <> v_manifest->>'data_manifest_digest'
     or v_command.center_count <> (v_manifest->>'center_count')::integer
     or v_command.auth_user_count <> (v_manifest->>'auth_user_count')::integer
     or v_command.storage_object_count <> (v_manifest->>'storage_object_count')::bigint then
    raise exception 'chb1_frozen_manifest_drift';
  end if;
  if exists (
    select 1 from public.installation_handoff_scopes s
    left join public.centers c on c.id = s.center_id
    left join public.center_members m on m.id = s.owner_membership_id and m.center_id = s.center_id
    left join public.center_access_governance g on g.center_id = s.center_id
    where s.command_id = p_command_id and (
      c.status is distinct from s.center_status or c.updated_at is distinct from s.center_updated_at
      or m.user_id is distinct from s.owner_user_id
      or m.membership_version is distinct from s.owner_membership_version
      or m.role <> 'owner' or m.status <> 'active'
      or g.governance_version is distinct from s.governance_version
      or g.status is distinct from s.governance_status
      or g.canonical_owner_membership_id is distinct from s.owner_membership_id
    )
  ) then raise exception 'chb1_frozen_scope_drift'; end if;
  return v_command;
end;
$chb1_internal_assert_frozen_reset$;

revoke all on function public.chb1_internal_assert_frozen_reset(uuid,uuid)
  from public, anon, authenticated, service_role;

create function public.chb1_arm_handoff_reset(
  p_command_id uuid,
  p_actor_user_id uuid,
  p_challenge_digest text,
  p_confirmation_phrase text,
  p_reauthentication_receipt_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $chb1_arm_handoff_reset$
declare v_command public.installation_handoff_commands%rowtype;
begin
  perform public.chb1_internal_require_service_role();
  perform pg_catalog.pg_advisory_xact_lock(20871001);
  v_command := public.chb1_internal_assert_frozen_reset(p_command_id, p_actor_user_id);
  if v_command.state = 'ARMED' then
    return pg_catalog.jsonb_build_object('ok', true, 'state', 'ARMED', 'exact_retry', true);
  end if;
  if v_command.state <> 'PREPARED' then raise exception 'chb1_reset_not_prepared'; end if;
  if v_command.cooling_until > pg_catalog.clock_timestamp() then raise exception 'chb1_cooling_period_not_complete'; end if;
  if v_command.confirmation_challenge_digest <> pg_catalog.lower(p_challenge_digest)
     or p_confirmation_phrase <> 'CHUẨN BỊ BÀN GIAO HỆ THỐNG' then
    raise exception 'chb1_exact_confirmation_required';
  end if;
  update public.installation_handoff_commands
    set state = 'ARMED', stage = 'ARMED', armed_at = pg_catalog.transaction_timestamp(),
        reauthentication_receipt_hash = pg_catalog.lower(p_reauthentication_receipt_hash),
        updated_at = pg_catalog.transaction_timestamp()
    where id = p_command_id;
  update public.installation_handoff_control
    set installation_state = 'RESET_ARMED', janitor_state = 'ARMED',
        control_version = control_version + 1, updated_at = pg_catalog.transaction_timestamp()
    where singleton_id = 1 and active_reset_command_id = p_command_id;
  perform public.chb1_internal_append_event(p_command_id, 'RESET_ARMED', p_actor_user_id,
    v_command.target_user_id, pg_catalog.jsonb_build_object('cooling_complete', true));
  return pg_catalog.jsonb_build_object('ok', true, 'state', 'ARMED', 'exact_retry', false);
end;
$chb1_arm_handoff_reset$;

revoke all on function public.chb1_arm_handoff_reset(uuid,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.chb1_arm_handoff_reset(uuid,uuid,text,text,text) to service_role;

create function public.chb1_cancel_handoff_reset(p_command_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $chb1_cancel_handoff_reset$
declare v_command public.installation_handoff_commands%rowtype;
begin
  perform public.chb1_internal_require_service_role();
  perform pg_catalog.pg_advisory_xact_lock(20871001);
  select * into v_command from public.installation_handoff_commands where id = p_command_id for update;
  if not found or v_command.actor_user_id <> p_actor_user_id
     or not public.chb1_internal_actor_owns_complete_scope(p_actor_user_id) then
    raise exception 'chb1_reset_cancel_denied';
  end if;
  if v_command.state = 'CANCELLED' then
    return pg_catalog.jsonb_build_object('ok', true, 'state', 'CANCELLED', 'exact_retry', true);
  end if;
  if v_command.state not in ('PREPARED','ARMED') then raise exception 'chb1_reset_cannot_be_cancelled'; end if;
  update public.installation_handoff_commands set state = 'CANCELLED', updated_at = pg_catalog.transaction_timestamp()
    where id = p_command_id;
  update public.installation_handoff_control
    set installation_state = 'TESTER_ACTIVE', janitor_state = 'AVAILABLE', active_reset_command_id = null,
        bootstrap_target_user_id = null, bootstrap_token_digest = null,
        bootstrap_token_expires_at = null, control_version = control_version + 1,
        updated_at = pg_catalog.transaction_timestamp()
    where singleton_id = 1 and active_reset_command_id = p_command_id;
  perform public.chb1_internal_append_event(p_command_id, 'RESET_CANCELLED', p_actor_user_id,
    v_command.target_user_id, '{}'::jsonb);
  return pg_catalog.jsonb_build_object('ok', true, 'state', 'CANCELLED', 'exact_retry', false);
end;
$chb1_cancel_handoff_reset$;

revoke all on function public.chb1_cancel_handoff_reset(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.chb1_cancel_handoff_reset(uuid,uuid) to service_role;

create function public.chb1_execute_handoff_reset(p_command_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $chb1_execute_handoff_reset$
declare
  v_command public.installation_handoff_commands%rowtype;
  v_control public.installation_handoff_control%rowtype;
  v_user_ids jsonb;
begin
  perform public.chb1_internal_require_service_role();
  perform pg_catalog.pg_advisory_xact_lock(20871001);
  select * into v_command from public.installation_handoff_commands where id = p_command_id for update;
  select * into v_control from public.installation_handoff_control where singleton_id = 1 for update;

  if v_command.id is null or v_command.action <> 'RESET' then
    raise exception 'chb1_reset_command_not_found';
  end if;
  if v_command.actor_user_id is distinct from p_actor_user_id then
    raise exception 'chb1_reset_owner_required';
  end if;

  if v_command.state in ('SESSION_DRAINING','REPAIR_REQUIRED','FINALIZED') then
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'user_id', d.auth_user_id, 'method', d.drain_method, 'state', d.drain_state
    ) order by d.auth_user_id), '[]'::jsonb) into v_user_ids
    from public.installation_session_drain_targets d where d.command_id = p_command_id;
    return pg_catalog.jsonb_build_object('ok', v_command.state <> 'REPAIR_REQUIRED',
      'state', v_command.state, 'drain_targets', v_user_ids, 'exact_retry', true);
  end if;
  if v_command.state <> 'ARMED' or v_control.installation_state <> 'RESET_ARMED'
     or v_control.active_reset_command_id <> p_command_id then
    raise exception 'chb1_reset_not_armed';
  end if;
  v_command := public.chb1_internal_assert_frozen_reset(p_command_id, p_actor_user_id);

  perform pg_catalog.set_config('app.chb1_internal_transition', 'on', true);
  update public.installation_handoff_control
    set installation_state = 'RESET_EXECUTING', control_version = control_version + 1,
        updated_at = pg_catalog.transaction_timestamp() where singleton_id = 1;
  update public.installation_handoff_commands
    set state = 'EXECUTING', updated_at = pg_catalog.transaction_timestamp() where id = p_command_id;
  perform public.chb1_internal_append_event(p_command_id, 'RESET_EXECUTING', p_actor_user_id,
    v_command.target_user_id, '{}'::jsonb);

  update public.center_access_governance g
    set status = 'disabled', governance_version = g.governance_version + 1,
        updated_at = pg_catalog.transaction_timestamp()
    from public.installation_handoff_scopes s
    where s.command_id = p_command_id and s.center_id = g.center_id;

  update public.account_credential_gates gate
    set credential_state = 'locked', credential_version = credential_version + 1,
        updated_at = pg_catalog.transaction_timestamp()
    where exists (select 1 from public.installation_handoff_scopes s
      where s.command_id = p_command_id and s.center_id = gate.center_id)
      and credential_state <> 'locked';

  update public.center_members m
    set status = 'revoked', membership_version = membership_version + 1,
        updated_at = pg_catalog.transaction_timestamp()
    where exists (select 1 from public.installation_handoff_scopes s
      where s.command_id = p_command_id and s.center_id = m.center_id)
      and m.status <> 'revoked';

  update public.account_recovery_custodians
    set status = 'revoked', authority_version = authority_version + 1,
        updated_at = pg_catalog.transaction_timestamp()
    where status <> 'revoked';

  update public.centers c
    set status = 'archived', updated_at = pg_catalog.transaction_timestamp()
    where exists (select 1 from public.installation_handoff_scopes s
      where s.command_id = p_command_id and s.center_id = c.id);

  update public.installation_center_epochs e
    set epoch_status = 'SEALED', sealed_at = pg_catalog.transaction_timestamp()
    where exists (select 1 from public.installation_handoff_scopes s
      where s.command_id = p_command_id and s.center_id = e.center_id);

  insert into public.installation_session_drain_targets(command_id, auth_user_id, drain_method)
  select p_command_id, u.id,
    case when u.id = v_command.target_user_id then 'TARGET_GLOBAL_SIGNOUT'
         else 'SERVER_CREDENTIAL_ROTATION' end
  from auth.users u
  on conflict (command_id, auth_user_id) do nothing;

  update public.installation_handoff_control
    set installation_state = 'HISTORY_SEALED', janitor_state = 'CONSUMED',
        history_sealed_at = pg_catalog.transaction_timestamp(), reset_consumed_at = pg_catalog.transaction_timestamp(),
        control_version = control_version + 1, updated_at = pg_catalog.transaction_timestamp()
    where singleton_id = 1;
  perform public.chb1_internal_append_event(p_command_id, 'HISTORY_SEALED', p_actor_user_id,
    v_command.target_user_id, pg_catalog.jsonb_build_object('center_count', v_command.center_count));

  update public.installation_handoff_control
    set installation_state = 'SESSION_DRAINING',
        session_drain_until = pg_catalog.clock_timestamp() +
          pg_catalog.make_interval(secs => max_private_url_seconds + 300),
        control_version = control_version + 1, updated_at = pg_catalog.transaction_timestamp()
    where singleton_id = 1;
  update public.installation_handoff_commands
    set state = 'SESSION_DRAINING', stage = 'SESSIONS_PENDING',
        executed_at = pg_catalog.transaction_timestamp(), updated_at = pg_catalog.transaction_timestamp()
    where id = p_command_id;
  perform public.chb1_internal_append_event(p_command_id, 'SESSION_DRAINING', p_actor_user_id,
    v_command.target_user_id, pg_catalog.jsonb_build_object(
      'private_url_quarantine_seconds', v_control.max_private_url_seconds + 300
    ));

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'user_id', d.auth_user_id, 'method', d.drain_method, 'state', d.drain_state
  ) order by d.auth_user_id), '[]'::jsonb) into v_user_ids
  from public.installation_session_drain_targets d where d.command_id = p_command_id;

  return pg_catalog.jsonb_build_object('ok', true, 'state', 'SESSION_DRAINING',
    'drain_targets', v_user_ids, 'session_drain_until',
    (select session_drain_until from public.installation_handoff_control where singleton_id = 1),
    'exact_retry', false);
end;
$chb1_execute_handoff_reset$;

revoke all on function public.chb1_execute_handoff_reset(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.chb1_execute_handoff_reset(uuid,uuid) to service_role;

create function public.chb1_claim_session_drain(
  p_command_id uuid,
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $chb1_claim_session_drain$
declare
  v_command public.installation_handoff_commands%rowtype;
  v_target public.installation_session_drain_targets%rowtype;
begin
  perform public.chb1_internal_require_service_role();
  select * into v_command from public.installation_handoff_commands
    where id = p_command_id for update;
  if not found or v_command.state not in ('SESSION_DRAINING','REPAIR_REQUIRED') then
    raise exception 'chb1_session_drain_command_not_active';
  end if;
  select * into v_target from public.installation_session_drain_targets
    where command_id = p_command_id and auth_user_id = p_target_user_id for update;
  if not found then raise exception 'chb1_session_drain_target_not_found'; end if;
  if v_target.drain_method = 'TARGET_GLOBAL_SIGNOUT'
     and p_actor_user_id is distinct from p_target_user_id then
    raise exception 'chb1_target_self_drain_required';
  end if;
  if v_target.drain_method = 'SERVER_CREDENTIAL_ROTATION'
     and p_actor_user_id is distinct from v_command.actor_user_id
     and p_actor_user_id is distinct from v_command.target_user_id then
    raise exception 'chb1_reset_actor_or_target_drain_required';
  end if;
  if v_target.drain_state = 'SUCCEEDED' then
    return pg_catalog.jsonb_build_object(
      'ok', true, 'claimed', false, 'already_succeeded', true, 'state', 'SUCCEEDED'
    );
  end if;
  if v_target.drain_state = 'PROCESSING'
     and v_target.lease_until > pg_catalog.clock_timestamp() then
    return pg_catalog.jsonb_build_object(
      'ok', v_target.attempt_id = p_attempt_id,
      'claimed', v_target.attempt_id = p_attempt_id,
      'already_succeeded', false, 'state', 'PROCESSING',
      'exact_retry', v_target.attempt_id = p_attempt_id,
      'lease_until', v_target.lease_until
    );
  end if;
  update public.installation_session_drain_targets
    set drain_state = 'PROCESSING', attempt_id = p_attempt_id,
        lease_until = pg_catalog.clock_timestamp() + interval '2 minutes',
        attempted_at = pg_catalog.transaction_timestamp()
    where command_id = p_command_id and auth_user_id = p_target_user_id;
  return pg_catalog.jsonb_build_object(
    'ok', true, 'claimed', true, 'already_succeeded', false,
    'state', 'PROCESSING', 'exact_retry', false
  );
end;
$chb1_claim_session_drain$;

revoke all on function public.chb1_claim_session_drain(uuid,uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.chb1_claim_session_drain(uuid,uuid,uuid,uuid)
  to service_role;

create function public.chb1_record_session_drain(
  p_command_id uuid,
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_attempt_id uuid,
  p_receipt_hash text,
  p_succeeded boolean,
  p_repair_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $chb1_record_session_drain$
declare
  v_command public.installation_handoff_commands%rowtype;
  v_target public.installation_session_drain_targets%rowtype;
  v_pending integer;
begin
  perform public.chb1_internal_require_service_role();
  select * into v_command from public.installation_handoff_commands where id = p_command_id for update;
  if not found or v_command.state not in ('SESSION_DRAINING','REPAIR_REQUIRED') then
    raise exception 'chb1_session_drain_command_not_active';
  end if;
  select * into v_target from public.installation_session_drain_targets
    where command_id = p_command_id and auth_user_id = p_target_user_id for update;
  if not found then raise exception 'chb1_session_drain_target_not_found'; end if;
  if v_target.drain_method = 'TARGET_GLOBAL_SIGNOUT' and p_actor_user_id <> p_target_user_id then
    raise exception 'chb1_target_self_drain_required';
  end if;
  if v_target.drain_method = 'SERVER_CREDENTIAL_ROTATION'
     and p_actor_user_id is distinct from v_command.actor_user_id
     and p_actor_user_id is distinct from v_command.target_user_id then
    raise exception 'chb1_reset_actor_or_target_drain_required';
  end if;
  if v_target.drain_state = 'SUCCEEDED' then
    if v_target.receipt_hash <> pg_catalog.lower(p_receipt_hash) then
      raise exception 'chb1_session_drain_receipt_conflict';
    end if;
    return pg_catalog.jsonb_build_object('ok', true, 'exact_retry', true, 'state', 'SUCCEEDED');
  end if;
  if v_target.drain_state <> 'PROCESSING' or v_target.attempt_id is distinct from p_attempt_id then
    raise exception 'chb1_session_drain_claim_required';
  end if;
  update public.installation_session_drain_targets
    set drain_state = case when p_succeeded then 'SUCCEEDED' else 'FAILED' end,
        receipt_hash = pg_catalog.lower(p_receipt_hash), attempted_at = pg_catalog.transaction_timestamp(),
        completed_at = case when p_succeeded then pg_catalog.transaction_timestamp() else null end,
        attempt_id = null, lease_until = null
    where command_id = p_command_id and auth_user_id = p_target_user_id;
  if not p_succeeded then
    update public.installation_handoff_commands set state = 'REPAIR_REQUIRED',
      repair_code = coalesce(pg_catalog.lower(p_repair_code), 'session_invalidation_failed'),
      updated_at = pg_catalog.transaction_timestamp() where id = p_command_id;
    update public.installation_handoff_control set installation_state = 'RESET_REPAIR_REQUIRED',
      control_version = control_version + 1, updated_at = pg_catalog.transaction_timestamp()
      where singleton_id = 1;
  end if;
  perform public.chb1_internal_append_event(p_command_id,
    case when p_succeeded then 'SESSION_INVALIDATED' else 'SESSION_INVALIDATION_REPAIR_REQUIRED' end,
    p_actor_user_id, p_target_user_id,
    pg_catalog.jsonb_build_object('method', v_target.drain_method, 'succeeded', p_succeeded));
  select pg_catalog.count(*)::integer into v_pending
    from public.installation_session_drain_targets
    where command_id = p_command_id and drain_state <> 'SUCCEEDED';
  return pg_catalog.jsonb_build_object('ok', p_succeeded, 'exact_retry', false,
    'pending_count', v_pending,
    'state', case when p_succeeded then 'SUCCEEDED' else 'REPAIR_REQUIRED' end);
end;
$chb1_record_session_drain$;

revoke all on function public.chb1_record_session_drain(uuid,uuid,uuid,uuid,text,boolean,text)
  from public, anon, authenticated;
grant execute on function public.chb1_record_session_drain(uuid,uuid,uuid,uuid,text,boolean,text)
  to service_role;

create function public.chb1_promote_uninitialized_if_drained(p_command_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $chb1_promote_uninitialized_if_drained$
declare
  v_control public.installation_handoff_control%rowtype;
  v_command public.installation_handoff_commands%rowtype;
begin
  perform public.chb1_internal_require_service_role();
  perform pg_catalog.pg_advisory_xact_lock(20871001);
  select * into v_control from public.installation_handoff_control where singleton_id = 1 for update;
  select * into v_command from public.installation_handoff_commands where id = p_command_id for update;
  if v_command.state = 'FINALIZED' and v_control.installation_state = 'UNINITIALIZED_NEXT_EPOCH' then
    return pg_catalog.jsonb_build_object('ok', true, 'state', 'UNINITIALIZED_NEXT_EPOCH', 'exact_retry', true);
  end if;
  if v_control.active_reset_command_id <> p_command_id
     or v_control.installation_state not in ('SESSION_DRAINING','RESET_REPAIR_REQUIRED') then
    raise exception 'chb1_session_drain_not_active';
  end if;
  if exists (select 1 from public.installation_session_drain_targets
    where command_id = p_command_id and drain_state <> 'SUCCEEDED') then
    raise exception 'chb1_session_drain_incomplete';
  end if;
  if v_control.session_drain_until > pg_catalog.clock_timestamp() then
    raise exception 'chb1_private_url_quarantine_incomplete';
  end if;
  update public.installation_handoff_control
    set installation_state = 'UNINITIALIZED_NEXT_EPOCH', janitor_state = 'LOCKED',
        bootstrap_state = 'READY', installation_epoch = installation_epoch + 1,
        control_version = control_version + 1, updated_at = pg_catalog.transaction_timestamp()
    where singleton_id = 1;
  update public.installation_handoff_commands
    set state = 'FINALIZED', stage = 'UNINITIALIZED', repair_code = null,
        finalized_at = pg_catalog.transaction_timestamp(), updated_at = pg_catalog.transaction_timestamp()
    where id = p_command_id;
  perform public.chb1_internal_append_event(p_command_id, 'UNINITIALIZED_NEXT_EPOCH',
    v_command.actor_user_id, v_command.target_user_id,
    pg_catalog.jsonb_build_object('business_clean', true, 'fresh_instance_clean', false));
  return pg_catalog.jsonb_build_object('ok', true, 'state', 'UNINITIALIZED_NEXT_EPOCH', 'exact_retry', false);
end;
$chb1_promote_uninitialized_if_drained$;

revoke all on function public.chb1_promote_uninitialized_if_drained(uuid)
  from public, anon, authenticated;
grant execute on function public.chb1_promote_uninitialized_if_drained(uuid) to service_role;

create function public.chb1_get_bootstrap_context(p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $chb1_get_bootstrap_context$
declare v_control public.installation_handoff_control%rowtype;
begin
  perform public.chb1_internal_require_service_role();
  select * into v_control from public.installation_handoff_control where singleton_id = 1;
  if v_control.bootstrap_target_user_id is distinct from p_actor_user_id then
    raise exception 'chb1_bootstrap_target_required';
  end if;
  return pg_catalog.jsonb_build_object(
    'state', v_control.installation_state,
    'bootstrap_state', v_control.bootstrap_state,
    'command_id', v_control.active_reset_command_id,
    'session_drain_until', v_control.session_drain_until,
    'target_drain_state', (select drain_state
      from public.installation_session_drain_targets
      where command_id = v_control.active_reset_command_id and auth_user_id = p_actor_user_id),
    'server_drain_targets', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'user_id', d.auth_user_id, 'state', d.drain_state
      ) order by d.auth_user_id), '[]'::jsonb)
      from public.installation_session_drain_targets d
      where d.command_id = v_control.active_reset_command_id
        and d.drain_method = 'SERVER_CREDENTIAL_ROTATION'),
    'installation_epoch', v_control.installation_epoch
  );
end;
$chb1_get_bootstrap_context$;

revoke all on function public.chb1_get_bootstrap_context(uuid)
  from public, anon, authenticated;
grant execute on function public.chb1_get_bootstrap_context(uuid) to service_role;

create function public.chb1_configure_fresh_bootstrap(
  p_target_user_id uuid,
  p_token_digest text,
  p_token_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $chb1_configure_fresh_bootstrap$
declare v_control public.installation_handoff_control%rowtype;
begin
  perform public.chb1_internal_require_service_role();
  perform pg_catalog.pg_advisory_xact_lock(20871001);
  select * into v_control from public.installation_handoff_control where singleton_id = 1 for update;
  if v_control.installation_state <> 'FRESH_UNINITIALIZED'
     or v_control.bootstrap_state <> 'UNCONFIGURED'
     or exists (select 1 from public.centers)
     or exists (select 1 from public.center_members)
     or exists (select 1 from storage.objects)
     or (public.chb1_internal_manifest()->>'global_center_row_count')::bigint <> 0 then
    raise exception 'chb1_fresh_bootstrap_configuration_denied';
  end if;
  if not exists (select 1 from auth.users where id = p_target_user_id and email_confirmed_at is not null) then
    raise exception 'chb1_confirmed_bootstrap_target_required';
  end if;
  update public.installation_handoff_control
    set bootstrap_target_user_id = p_target_user_id, bootstrap_token_digest = pg_catalog.lower(p_token_digest),
        bootstrap_token_expires_at = p_token_expires_at, bootstrap_state = 'READY',
        control_version = control_version + 1, updated_at = pg_catalog.transaction_timestamp()
    where singleton_id = 1;
  perform public.chb1_internal_append_event(null, 'FRESH_BOOTSTRAP_CONFIGURED', null,
    p_target_user_id, '{}'::jsonb);
  return pg_catalog.jsonb_build_object('ok', true, 'state', 'FRESH_UNINITIALIZED');
end;
$chb1_configure_fresh_bootstrap$;

revoke all on function public.chb1_configure_fresh_bootstrap(uuid,text,timestamptz)
  from public, anon, authenticated;
grant execute on function public.chb1_configure_fresh_bootstrap(uuid,text,timestamptz)
  to service_role;

create function public.chb1_claim_first_owner(
  p_request_id text,
  p_intent_hash text,
  p_actor_user_id uuid,
  p_token_digest text,
  p_center_name text,
  p_center_slug text,
  p_reauthentication_receipt_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $chb1_claim_first_owner$
declare
  v_control public.installation_handoff_control%rowtype;
  v_existing public.installation_handoff_commands%rowtype;
  v_center_id text;
  v_center_name text := pg_catalog.btrim(p_center_name);
  v_center_slug text := pg_catalog.lower(pg_catalog.btrim(p_center_slug));
  v_membership_id uuid;
  v_command_id uuid;
begin
  perform public.chb1_internal_require_service_role();
  perform pg_catalog.pg_advisory_xact_lock(20871001);
  select * into v_control from public.installation_handoff_control where singleton_id = 1 for update;
  select * into v_existing from public.installation_handoff_commands
    where action = 'BOOTSTRAP' and request_id = pg_catalog.btrim(p_request_id);
  if found then
    if v_existing.intent_hash <> pg_catalog.lower(p_intent_hash)
       or v_existing.actor_user_id <> p_actor_user_id then
      raise exception 'chb1_changed_intent_conflict';
    end if;
    return pg_catalog.jsonb_build_object('ok', v_existing.state = 'FINALIZED',
      'state', v_existing.state, 'center_id', v_existing.safe_result->>'center_id',
      'exact_retry', true);
  end if;

  if v_control.installation_state not in ('UNINITIALIZED_NEXT_EPOCH','FRESH_UNINITIALIZED')
     or v_control.bootstrap_state <> 'READY'
     or v_control.bootstrap_target_user_id <> p_actor_user_id
     or v_control.bootstrap_token_expires_at <= pg_catalog.clock_timestamp()
     or v_control.bootstrap_token_digest <> pg_catalog.lower(p_token_digest) then
    raise exception 'chb1_bootstrap_claim_denied';
  end if;
  if not exists (select 1 from auth.users where id = p_actor_user_id and email_confirmed_at is not null) then
    raise exception 'chb1_confirmed_bootstrap_target_required';
  end if;
  if exists (select 1 from public.center_members where user_id = p_actor_user_id and status = 'active')
     or exists (select 1 from public.account_recovery_custodians
       where auth_user_id = p_actor_user_id and status = 'active') then
    raise exception 'chb1_bootstrap_target_must_have_zero_authority';
  end if;
  if exists (select 1 from public.centers where status <> 'archived')
     or exists (select 1 from public.center_members where status = 'active')
     or exists (select 1 from public.account_recovery_custodians where status = 'active') then
    raise exception 'chb1_uninitialized_residue_detected';
  end if;
  if pg_catalog.length(v_center_name) not between 2 and 100
     or v_center_slug !~ '^[a-z0-9][a-z0-9-]{1,62}$' then
    raise exception 'chb1_center_identity_invalid';
  end if;
  if exists (select 1 from public.centers where slug = v_center_slug) then
    raise exception 'chb1_center_slug_collision';
  end if;

  v_center_id := gen_random_uuid()::text;
  v_membership_id := gen_random_uuid();
  insert into public.installation_handoff_commands(
    action, request_id, state, stage, intent_hash, actor_user_id, target_user_id,
    expected_control_version, reauthentication_receipt_hash
  ) values (
    'BOOTSTRAP', pg_catalog.btrim(p_request_id), 'EXECUTING', 'PREPARED',
    pg_catalog.lower(p_intent_hash), p_actor_user_id, p_actor_user_id,
    v_control.control_version, pg_catalog.lower(p_reauthentication_receipt_hash)
  ) returning id into v_command_id;

  perform pg_catalog.set_config('app.chb1_internal_transition', 'on', true);
  update public.installation_handoff_control
    set installation_state = 'BOOTSTRAP_CLAIMED', control_version = control_version + 1,
        updated_at = pg_catalog.transaction_timestamp() where singleton_id = 1;

  insert into public.centers(id, name, slug, environment, status)
    values (v_center_id, v_center_name, v_center_slug, 'production', 'active');
  insert into public.center_members(id, center_id, user_id, role, status)
    values (v_membership_id, v_center_id, p_actor_user_id, 'owner', 'active');
  perform public.arg2_activate_center_governance(v_center_id, v_membership_id, p_actor_user_id, null);
  insert into public.installation_center_epochs(center_id, installation_epoch, epoch_status)
    values (v_center_id, v_control.installation_epoch, 'CURRENT');

  update public.installation_handoff_commands
    set state = 'FINALIZED', stage = 'COMPLETE',
        safe_result = pg_catalog.jsonb_build_object('center_id', v_center_id, 'installation_epoch', v_control.installation_epoch),
        finalized_at = pg_catalog.transaction_timestamp(), updated_at = pg_catalog.transaction_timestamp()
    where id = v_command_id;
  update public.installation_handoff_control
    set installation_state = 'OPERATIONAL_LOCKED', janitor_state = 'LOCKED',
        bootstrap_state = 'CLAIMED', bootstrap_token_digest = null,
        bootstrap_token_expires_at = null, bootstrap_claimed_at = pg_catalog.transaction_timestamp(),
        active_reset_command_id = null, control_version = control_version + 1,
        updated_at = pg_catalog.transaction_timestamp()
    where singleton_id = 1;
  perform public.chb1_internal_append_event(v_command_id, 'FIRST_OWNER_BOOTSTRAP_COMPLETE',
    p_actor_user_id, p_actor_user_id,
    pg_catalog.jsonb_build_object('center_id', v_center_id, 'installation_epoch', v_control.installation_epoch));
  return pg_catalog.jsonb_build_object('ok', true, 'state', 'OPERATIONAL_LOCKED',
    'center_id', v_center_id, 'membership_id', v_membership_id, 'exact_retry', false);
end;
$chb1_claim_first_owner$;

revoke all on function public.chb1_claim_first_owner(text,text,uuid,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.chb1_claim_first_owner(text,text,uuid,text,text,text,text)
  to service_role;

-- Business writes are allowed only in the current epoch. RESET_ARMED is deliberately read-only.
create or replace function public.is_center_member(requested_center_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $chb1_is_center_member$
  select exists (
    select 1
    from public.center_members m
    join public.installation_center_epochs e on e.center_id = m.center_id
    join public.installation_handoff_control c on c.singleton_id = 1
    where m.center_id = requested_center_id and m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
      and e.installation_epoch = c.installation_epoch and e.epoch_status = 'CURRENT'
      and c.installation_state in ('TESTER_ACTIVE','RESET_PREPARED','RESET_ARMED','OPERATIONAL_LOCKED')
  );
$chb1_is_center_member$;

create or replace function public.can_write_center(requested_center_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $chb1_can_write_center$
  select exists (
    select 1
    from public.center_members m
    join public.installation_center_epochs e on e.center_id = m.center_id
    join public.installation_handoff_control c on c.singleton_id = 1
    where m.center_id = requested_center_id and m.user_id = auth.uid()
      and coalesce(m.status, 'active') = 'active'
      and pg_catalog.lower(m.role) in ('owner','qtv','center_admin','admin')
      and e.installation_epoch = c.installation_epoch and e.epoch_status = 'CURRENT'
      and c.installation_state in ('TESTER_ACTIVE','RESET_PREPARED','OPERATIONAL_LOCKED')
  );
$chb1_can_write_center$;

create function public.chb1_internal_guard_center_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $chb1_internal_guard_center_write$
declare
  v_center_id text := case when tg_op = 'DELETE' then old.center_id else new.center_id end;
begin
  if pg_catalog.current_setting('app.chb1_internal_transition', true) = 'on'
     and (auth.jwt() ->> 'role') = 'service_role' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if not exists (
    select 1 from public.installation_center_epochs e
    join public.installation_handoff_control c on c.singleton_id = 1
    where e.center_id = v_center_id and e.installation_epoch = c.installation_epoch
      and e.epoch_status = 'CURRENT'
      and c.installation_state in ('TESTER_ACTIVE','RESET_PREPARED','OPERATIONAL_LOCKED')
  ) then raise exception 'chb1_installation_write_fenced'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$chb1_internal_guard_center_write$;

revoke all on function public.chb1_internal_guard_center_write()
  from public, anon, authenticated, service_role;

insert into public.installation_handoff_control(
  singleton_id, installation_state, janitor_state, bootstrap_state
)
select 1,
  case when exists (select 1 from public.centers) then 'TESTER_ACTIVE' else 'FRESH_UNINITIALIZED' end,
  case when exists (select 1 from public.centers) then 'AVAILABLE' else 'NOT_APPLICABLE' end,
  case when exists (select 1 from public.centers) then 'LOCKED_EXISTING' else 'UNCONFIGURED' end;

insert into public.installation_center_epochs(center_id, installation_epoch, epoch_status)
select id, 1, case when status = 'archived' then 'SEALED' else 'CURRENT' end
from public.centers;

do $chb1_write_fences$
declare v_record record;
begin
  for v_record in
    select c.oid::pg_catalog.regclass as relation_name, c.relname as table_name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public' and c.relkind in ('r','p')
      and a.attname = 'center_id' and not a.attisdropped
      and c.relname not like 'installation_%'
      and c.relname not in ('centers','center_members')
    order by c.relname
  loop
    execute pg_catalog.format(
      'create trigger %I before insert or update or delete on %s for each row execute function public.chb1_internal_guard_center_write()',
      'chb1_epoch_write_fence_' || pg_catalog.substr(public.chb1_internal_digest(v_record.table_name), 1, 16),
      v_record.relation_name
    );
  end loop;
end;
$chb1_write_fences$;

-- Supabase Storage is platform infrastructure. CHB-1 provisions only the two
-- empty application buckets and application policies; it never recreates
-- Supabase-owned Storage types, tables, functions, or objects.
do $chb1_storage_platform$
begin
  if pg_catalog.to_regclass('storage.buckets') is null
     or pg_catalog.to_regclass('storage.objects') is null then
    raise exception 'chb1_supabase_storage_platform_required';
  end if;
end;
$chb1_storage_platform$;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('staff-administrative-documents', 'staff-administrative-documents', false, 10485760,
    array['application/pdf','image/jpeg','image/png','image/webp']::text[]),
  ('transaction-images', 'transaction-images', false, null, null)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "f23_11e insert staff document objects by pending metadata" on storage.objects;
create policy "f23_11e insert staff document objects by pending metadata"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'staff-administrative-documents'
  and exists (
    select 1
    from public.center_staff_document_attachments a
    where a.bucket_id = objects.bucket_id
      and a.object_path = objects.name
      and a.state = 'pending'
      and a.archived_at is null
      and a.uploaded_by_user_id = auth.uid()
      and public.can_manage_staff_document_attachments(a.center_id)
  )
);

drop policy if exists "f23_11e read staff document objects by center role" on storage.objects;
create policy "f23_11e read staff document objects by center role"
on storage.objects for select to authenticated
using (
  bucket_id = 'staff-administrative-documents'
  and exists (
    select 1
    from public.center_staff_document_attachments a
    where a.bucket_id = objects.bucket_id
      and a.object_path = objects.name
      and public.can_manage_staff_document_attachments(a.center_id)
      and (
        (a.state = 'available' and a.is_primary and a.archived_at is null)
        or (a.state = 'archived' and not a.is_primary and a.archived_at is not null)
        or (a.state = 'pending' and a.archived_at is null and a.uploaded_by_user_id = auth.uid())
      )
  )
);

-- These legacy Storage policies authorized by user_id alone. Because RLS
-- policies are OR-composed, retaining them would bypass revoked membership,
-- archived-center and installation-epoch isolation after a handoff reset.
drop policy if exists "members can delete transaction attachments" on public.transaction_attachments;
drop policy if exists "members can insert transaction attachments" on public.transaction_attachments;
drop policy if exists "members can update transaction attachments" on public.transaction_attachments;
drop policy if exists "members can view transaction attachments" on public.transaction_attachments;
drop policy if exists "members can delete transaction images" on storage.objects;
drop policy if exists "members can update transaction images" on storage.objects;
drop policy if exists "members can upload transaction images" on storage.objects;
drop policy if exists "members can view transaction images" on storage.objects;

drop policy if exists "sup_cf_1 delete transaction image objects by center role" on storage.objects;
create policy "sup_cf_1 delete transaction image objects by center role"
on storage.objects for delete to authenticated
using (
  bucket_id = 'transaction-images'
  and public.is_valid_transaction_attachment_path((storage.foldername(name))[1], name)
  and public.can_manage_transaction_attachments((storage.foldername(name))[1])
);

drop policy if exists "sup_cf_1 insert transaction image objects by center role" on storage.objects;
create policy "sup_cf_1 insert transaction image objects by center role"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'transaction-images'
  and public.is_valid_transaction_attachment_path((storage.foldername(name))[1], name)
  and public.can_manage_transaction_attachments((storage.foldername(name))[1])
);

drop policy if exists "sup_cf_1 read transaction image objects by center role" on storage.objects;
create policy "sup_cf_1 read transaction image objects by center role"
on storage.objects for select to authenticated
using (
  bucket_id = 'transaction-images'
  and public.is_valid_transaction_attachment_path((storage.foldername(name))[1], name)
  and public.can_manage_transaction_attachments((storage.foldername(name))[1])
);

drop policy if exists "sup_cf_1 update transaction image objects by center role" on storage.objects;
create policy "sup_cf_1 update transaction image objects by center role"
on storage.objects for update to authenticated
using (
  bucket_id = 'transaction-images'
  and public.is_valid_transaction_attachment_path((storage.foldername(name))[1], name)
  and public.can_manage_transaction_attachments((storage.foldername(name))[1])
)
with check (
  bucket_id = 'transaction-images'
  and public.is_valid_transaction_attachment_path((storage.foldername(name))[1], name)
  and public.can_manage_transaction_attachments((storage.foldername(name))[1])
);

comment on table public.installation_handoff_control is
  'CHB-1 one-time installation epoch/reset/bootstrap singleton. Existing installations start TESTER_ACTIVE; no reset is automatic.';
comment on table public.installation_handoff_events is
  'Append-only non-secret handoff/reset/bootstrap evidence retained across installation epochs.';
comment on function public.chb1_claim_first_owner(text,text,uuid,text,text,text,text) is
  'Service-only atomic one-winner center plus first Owner bootstrap; exact retry is idempotent.';

commit;
