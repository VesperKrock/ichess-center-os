begin;

-- ARG-2: zero-lockout Owner/Admin lifecycle governance.
-- Additive only. No Auth identity is created, changed, or deleted by this migration.

do $arg2_prerequisites$
begin
  if pg_catalog.to_regclass('public.centers') is null
     or pg_catalog.to_regclass('public.center_members') is null
     or pg_catalog.to_regclass('public.account_audit_logs') is null then
    raise exception 'arg2_prerequisite_tables_missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.center_members'::pg_catalog.regclass
      and a.attname = 'membership_version'
      and not a.attisdropped
  ) then
    raise exception 'arg2_membership_version_prerequisite_missing';
  end if;
end;
$arg2_prerequisites$;

create unique index if not exists center_members_center_id_id_key
  on public.center_members (center_id, id);

create table public.center_access_governance (
  center_id text primary key references public.centers(id) on delete restrict,
  status text not null default 'disabled'
    check (status in ('disabled', 'active', 'suspended')),
  canonical_owner_membership_id uuid not null,
  canonical_admin_membership_id uuid,
  governance_version bigint not null default 1
    check (governance_version >= 1),
  activated_at timestamptz,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint center_access_governance_owner_membership_fk
    foreign key (center_id, canonical_owner_membership_id)
    references public.center_members(center_id, id) on delete restrict,
  constraint center_access_governance_admin_membership_fk
    foreign key (center_id, canonical_admin_membership_id)
    references public.center_members(center_id, id) on delete restrict
);

create table public.account_governance_subjects (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  first_center_id text not null references public.centers(id) on delete restrict,
  subject_version bigint not null default 1 check (subject_version >= 1),
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp()
);

create table public.account_governance_commands (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete restrict,
  request_id text not null,
  action text not null check (action in (
    'provision_admin',
    'reset_admin',
    'revoke_admin',
    'restore_admin',
    'replace_admin',
    'owner_handoff',
    'owner_recovery'
  )),
  state text not null default 'prepared'
    check (state in ('prepared', 'finalized', 'repair_required', 'cancelled')),
  stage text not null default 'prepared'
    check (stage in (
      'prepared',
      'external_applied',
      'awaiting_credential',
      'target_ready',
      'authority_swapped',
      'session_invalidated',
      'complete'
    )),
  intent_hash text not null check (intent_hash ~ '^[0-9a-f]{64}$'),
  actor_user_id uuid not null,
  actor_membership_id uuid,
  target_user_id uuid,
  target_membership_id uuid,
  predecessor_user_id uuid,
  predecessor_membership_id uuid,
  target_email_hash text check (target_email_hash is null or target_email_hash ~ '^[0-9a-f]{64}$'),
  target_email_masked text,
  expected_governance_version bigint not null check (expected_governance_version >= 1),
  expected_membership_version integer check (expected_membership_version is null or expected_membership_version >= 1),
  external_attempt_count integer not null default 0 check (external_attempt_count >= 0),
  external_receipt_hash text check (external_receipt_hash is null or external_receipt_hash ~ '^[0-9a-f]{64}$'),
  session_invalidation_receipt_hash text check (
    session_invalidation_receipt_hash is null or session_invalidation_receipt_hash ~ '^[0-9a-f]{64}$'
  ),
  repair_code text,
  expires_at timestamptz,
  safe_context jsonb not null default '{}'::jsonb,
  prepared_at timestamptz not null default pg_catalog.transaction_timestamp(),
  finalized_at timestamptz,
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  unique (center_id, request_id),
  constraint account_governance_commands_repair_code_safe
    check (repair_code is null or repair_code ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint account_governance_commands_actor_membership_fk
    foreign key (center_id, actor_membership_id)
    references public.center_members(center_id, id) on delete restrict,
  constraint account_governance_commands_target_membership_fk
    foreign key (center_id, target_membership_id)
    references public.center_members(center_id, id) on delete restrict,
  constraint account_governance_commands_predecessor_membership_fk
    foreign key (center_id, predecessor_membership_id)
    references public.center_members(center_id, id) on delete restrict,
  constraint account_governance_commands_safe_context_no_secrets
    check (
      pg_catalog.lower(safe_context::text) !~
      '"(password|temporary_password|plaintext_password|access_token|refresh_token|jwt|secret)"[[:space:]]*:'
    )
);

create index account_governance_commands_center_state_idx
  on public.account_governance_commands (center_id, state, updated_at desc);
create index account_governance_commands_target_idx
  on public.account_governance_commands (target_user_id, state, updated_at desc);

create table public.account_governance_events (
  id uuid primary key default gen_random_uuid(),
  command_id uuid not null references public.account_governance_commands(id) on delete restrict,
  event_sequence integer not null check (event_sequence >= 1),
  center_id text not null references public.centers(id) on delete restrict,
  event_type text not null check (pg_catalog.length(pg_catalog.btrim(event_type)) > 0),
  actor_user_id uuid,
  target_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  unique (command_id, event_sequence),
  constraint account_governance_events_metadata_no_secrets
    check (
      pg_catalog.lower(metadata::text) !~
      '"(password|temporary_password|plaintext_password|access_token|refresh_token|jwt|secret)"[[:space:]]*:'
    )
);

create index account_governance_events_center_created_idx
  on public.account_governance_events (center_id, created_at desc);

create table public.account_credential_gates (
  membership_id uuid primary key,
  center_id text not null,
  user_id uuid not null references auth.users(id) on delete restrict,
  credential_state text not null
    check (credential_state in ('temporary', 'reset_required', 'ready', 'locked')),
  credential_version bigint not null default 1 check (credential_version >= 1),
  command_id uuid references public.account_governance_commands(id) on delete restrict,
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint account_credential_gates_membership_fk
    foreign key (center_id, membership_id)
    references public.center_members(center_id, id) on delete restrict,
  unique (center_id, user_id)
);

create table public.account_recovery_custodians (
  auth_user_id uuid primary key references auth.users(id) on delete restrict,
  status text not null default 'disabled' check (status in ('active', 'disabled', 'revoked')),
  authority_version bigint not null default 1 check (authority_version >= 1),
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp()
);

create table public.account_recovery_approvals (
  command_id uuid not null references public.account_governance_commands(id) on delete restrict,
  custodian_user_id uuid not null references public.account_recovery_custodians(auth_user_id) on delete restrict,
  authority_version bigint not null check (authority_version >= 1),
  decision text not null check (decision = 'approve'),
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  primary key (command_id, custodian_user_id)
);

alter table public.center_access_governance enable row level security;
alter table public.center_access_governance force row level security;
alter table public.account_governance_subjects enable row level security;
alter table public.account_governance_subjects force row level security;
alter table public.account_governance_commands enable row level security;
alter table public.account_governance_commands force row level security;
alter table public.account_governance_events enable row level security;
alter table public.account_governance_events force row level security;
alter table public.account_credential_gates enable row level security;
alter table public.account_credential_gates force row level security;
alter table public.account_recovery_custodians enable row level security;
alter table public.account_recovery_custodians force row level security;
alter table public.account_recovery_approvals enable row level security;
alter table public.account_recovery_approvals force row level security;

revoke all on public.center_access_governance from public, anon, authenticated, service_role;
revoke all on public.account_governance_subjects from public, anon, authenticated, service_role;
revoke all on public.account_governance_commands from public, anon, authenticated, service_role;
revoke all on public.account_governance_events from public, anon, authenticated, service_role;
revoke all on public.account_credential_gates from public, anon, authenticated, service_role;
revoke all on public.account_recovery_custodians from public, anon, authenticated, service_role;
revoke all on public.account_recovery_approvals from public, anon, authenticated, service_role;

revoke insert, update, delete, truncate on public.center_members from anon, authenticated;
revoke insert, update, delete, truncate on public.center_members from service_role;
grant select on public.center_members to service_role;

revoke maintain, references, trigger, truncate, update, delete
  on public.account_audit_logs from anon, authenticated, service_role;
grant insert, select on public.account_audit_logs to service_role;

create function public.arg2_internal_require_service_role()
returns void
language plpgsql
security definer
set search_path = ''
as $arg2_internal_require_service_role$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'arg2_service_role_required';
  end if;
end;
$arg2_internal_require_service_role$;

revoke all on function public.arg2_internal_require_service_role() from public, anon, authenticated, service_role;

create function public.arg2_internal_append_event(
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
as $arg2_internal_append_event$
declare
  v_command public.account_governance_commands%rowtype;
  v_sequence integer;
  v_event_id uuid;
begin
  select * into v_command
  from public.account_governance_commands
  where id = p_command_id
  for update;

  if not found then
    raise exception 'arg2_command_not_found';
  end if;

  select coalesce(pg_catalog.max(event_sequence), 0) + 1
    into v_sequence
  from public.account_governance_events
  where command_id = p_command_id;

  insert into public.account_governance_events (
    command_id,
    event_sequence,
    center_id,
    event_type,
    actor_user_id,
    target_user_id,
    metadata
  ) values (
    p_command_id,
    v_sequence,
    v_command.center_id,
    pg_catalog.btrim(p_event_type),
    p_actor_user_id,
    p_target_user_id,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_event_id;

  return v_event_id;
end;
$arg2_internal_append_event$;

revoke all on function public.arg2_internal_append_event(uuid, text, uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;

create function public.arg2_internal_assert_owner(
  p_center_id text,
  p_actor_user_id uuid
)
returns public.center_access_governance
language plpgsql
security definer
set search_path = ''
as $arg2_internal_assert_owner$
declare
  v_control public.center_access_governance%rowtype;
  v_membership public.center_members%rowtype;
begin
  select * into v_control
  from public.center_access_governance
  where center_id = p_center_id
  for update;

  if not found or v_control.status <> 'active' then
    raise exception 'arg2_governance_not_ready';
  end if;

  select * into v_membership
  from public.center_members
  where id = v_control.canonical_owner_membership_id
    and center_id = p_center_id
    and user_id = p_actor_user_id
    and role = 'owner'
    and status = 'active'
  for update;

  if not found then
    raise exception 'arg2_owner_required';
  end if;

  return v_control;
end;
$arg2_internal_assert_owner$;

revoke all on function public.arg2_internal_assert_owner(text, uuid)
  from public, anon, authenticated, service_role;

create function public.arg2_internal_guard_audit_immutable()
returns trigger
language plpgsql
set search_path = ''
as $arg2_internal_guard_audit_immutable$
begin
  raise exception 'arg2_governance_audit_is_append_only';
end;
$arg2_internal_guard_audit_immutable$;

create trigger arg2_account_governance_events_immutable_row
before update or delete on public.account_governance_events
for each row execute function public.arg2_internal_guard_audit_immutable();

create trigger arg2_account_governance_events_immutable_truncate
before truncate on public.account_governance_events
for each statement execute function public.arg2_internal_guard_audit_immutable();

create trigger arg2_account_audit_logs_immutable_row
before update or delete on public.account_audit_logs
for each row execute function public.arg2_internal_guard_audit_immutable();

create trigger arg2_account_audit_logs_immutable_truncate
before truncate on public.account_audit_logs
for each statement execute function public.arg2_internal_guard_audit_immutable();

revoke all on function public.arg2_internal_guard_audit_immutable()
  from public, anon, authenticated, service_role;

create function public.arg2_internal_enforce_governed_membership()
returns trigger
language plpgsql
set search_path = ''
as $arg2_internal_enforce_governed_membership$
declare
  v_center_id text;
  v_control public.center_access_governance%rowtype;
  v_owner_count integer;
  v_admin_count integer;
  v_raw_admin_count integer;
begin
  if tg_op = 'DELETE' then
    v_center_id := old.center_id;
  else
    v_center_id := new.center_id;
  end if;

  select * into v_control
  from public.center_access_governance
  where center_id = v_center_id
    and status = 'active';

  if not found then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select pg_catalog.count(*)::integer into v_owner_count
  from public.center_members
  where center_id = v_center_id and role = 'owner' and status = 'active';

  select pg_catalog.count(*)::integer into v_admin_count
  from public.center_members
  where center_id = v_center_id and role = 'center_admin' and status = 'active';

  select pg_catalog.count(*)::integer into v_raw_admin_count
  from public.center_members
  where center_id = v_center_id and role = 'admin' and status = 'active';

  if v_owner_count <> 1 then
    raise exception 'arg2_exactly_one_active_owner_required';
  end if;
  if v_admin_count > 1 then
    raise exception 'arg2_at_most_one_active_admin_required';
  end if;
  if v_raw_admin_count <> 0 then
    raise exception 'arg2_raw_admin_not_allowed';
  end if;
  if not exists (
    select 1 from public.center_members
    where id = v_control.canonical_owner_membership_id
      and center_id = v_center_id and role = 'owner' and status = 'active'
  ) then
    raise exception 'arg2_canonical_owner_mismatch';
  end if;
  if v_control.canonical_admin_membership_id is null and v_admin_count <> 0 then
    raise exception 'arg2_canonical_admin_pointer_missing';
  end if;
  if v_control.canonical_admin_membership_id is not null and not exists (
    select 1 from public.center_members
    where id = v_control.canonical_admin_membership_id
      and center_id = v_center_id
      and role = 'center_admin'
      and status in ('active', 'reset_required', 'revoke_pending', 'revoked', 'restore_pending')
  ) then
    raise exception 'arg2_canonical_admin_mismatch';
  end if;
  if v_admin_count = 1 and not exists (
    select 1 from public.center_members
    where id = v_control.canonical_admin_membership_id
      and center_id = v_center_id and role = 'center_admin' and status = 'active'
  ) then
    raise exception 'arg2_active_admin_not_canonical';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$arg2_internal_enforce_governed_membership$;

create constraint trigger arg2_center_members_governance_invariant
after insert or update or delete on public.center_members
deferrable initially deferred
for each row execute function public.arg2_internal_enforce_governed_membership();

revoke all on function public.arg2_internal_enforce_governed_membership()
  from public, anon, authenticated, service_role;

create function public.arg2_activate_center_governance(
  p_center_id text,
  p_owner_membership_id uuid,
  p_expected_owner_user_id uuid,
  p_expected_admin_membership_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_activate_center_governance$
declare
  v_owner public.center_members%rowtype;
  v_admin public.center_members%rowtype;
  v_owner_count integer;
  v_admin_count integer;
begin
  perform public.arg2_internal_require_service_role();

  if exists (select 1 from public.center_access_governance where center_id = p_center_id) then
    raise exception 'arg2_center_governance_already_exists';
  end if;

  perform 1 from public.centers where id = p_center_id for update;
  if not found then
    raise exception 'arg2_center_not_found';
  end if;

  select pg_catalog.count(*)::integer into v_owner_count
  from public.center_members
  where center_id = p_center_id and role = 'owner' and status = 'active';

  select pg_catalog.count(*)::integer into v_admin_count
  from public.center_members
  where center_id = p_center_id and role in ('center_admin', 'admin') and status = 'active';

  if v_owner_count <> 1 then
    raise exception 'arg2_activation_requires_exactly_one_owner';
  end if;
  if v_admin_count > 1 then
    raise exception 'arg2_activation_requires_at_most_one_admin';
  end if;

  select * into v_owner
  from public.center_members
  where id = p_owner_membership_id
    and center_id = p_center_id
    and user_id = p_expected_owner_user_id
    and role = 'owner'
    and status = 'active'
  for update;
  if not found then
    raise exception 'arg2_activation_owner_mismatch';
  end if;

  if v_admin_count = 1 then
    select * into v_admin
    from public.center_members
    where center_id = p_center_id
      and role in ('center_admin', 'admin')
      and status = 'active'
    for update;

    if p_expected_admin_membership_id is null or v_admin.id <> p_expected_admin_membership_id then
      raise exception 'arg2_activation_admin_mismatch';
    end if;

    if v_admin.user_id = v_owner.user_id then
      raise exception 'arg2_owner_admin_identity_must_be_distinct';
    end if;

    if exists (
      select 1 from public.center_members
      where user_id = v_admin.user_id and id <> v_admin.id
    ) then
      raise exception 'arg2_managed_admin_must_be_single_center';
    end if;

    if v_admin.role = 'admin' then
      update public.center_members set role = 'center_admin' where id = v_admin.id;
      select * into v_admin from public.center_members where id = v_admin.id;
    end if;
  elsif p_expected_admin_membership_id is not null then
    raise exception 'arg2_activation_unexpected_admin_pointer';
  end if;

  insert into public.account_governance_subjects(auth_user_id, first_center_id)
  values (v_owner.user_id, p_center_id)
  on conflict (auth_user_id) do nothing;

  insert into public.account_credential_gates(
    membership_id, center_id, user_id, credential_state
  ) values (v_owner.id, p_center_id, v_owner.user_id, 'ready');

  if v_admin.id is not null then
    insert into public.account_governance_subjects(auth_user_id, first_center_id)
    values (v_admin.user_id, p_center_id)
    on conflict (auth_user_id) do nothing;

    insert into public.account_credential_gates(
      membership_id, center_id, user_id, credential_state
    ) values (v_admin.id, p_center_id, v_admin.user_id, 'ready');
  end if;

  insert into public.center_access_governance(
    center_id,
    status,
    canonical_owner_membership_id,
    canonical_admin_membership_id,
    activated_at
  ) values (
    p_center_id,
    'active',
    v_owner.id,
    v_admin.id,
    pg_catalog.transaction_timestamp()
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'center_id', p_center_id,
    'governance_version', 1,
    'has_admin', v_admin.id is not null
  );
end;
$arg2_activate_center_governance$;

revoke all on function public.arg2_activate_center_governance(text, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.arg2_activate_center_governance(text, uuid, uuid, uuid)
  to service_role;

create function public.arg2_list_center_account_lifecycle(
  p_center_ids text[],
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_list_center_account_lifecycle$
declare
  v_result jsonb;
begin
  perform public.arg2_internal_require_service_role();

  if p_center_ids is null or pg_catalog.cardinality(p_center_ids) > 100 then
    raise exception 'arg2_invalid_center_list';
  end if;

  -- Capability discovery is still exact-center authorization. A caller may
  -- learn READY/UNAVAILABLE only for centers where they are the active Owner;
  -- guessed or altered center IDs fail the whole request closed.
  if exists (
    select 1
    from pg_catalog.unnest(p_center_ids) requested(center_id)
    where not exists (
      select 1
      from public.center_members actor_membership
      where actor_membership.center_id = requested.center_id
        and actor_membership.user_id = p_actor_user_id
        and actor_membership.role = 'owner'
        and actor_membership.status = 'active'
    )
  ) then
    raise exception 'arg2_owner_required';
  end if;

  select coalesce(pg_catalog.jsonb_agg(item order by item ->> 'center_id'), '[]'::jsonb)
    into v_result
  from (
    select pg_catalog.jsonb_build_object(
      'center_id', requested.center_id,
      'capability', case
        when g.center_id is null or g.status <> 'active' then 'unavailable'
        when owner_membership.user_id = p_actor_user_id
          and owner_membership.role = 'owner' and owner_membership.status = 'active' then 'ready'
        else 'denied'
      end,
      'governance_version', case when owner_membership.user_id = p_actor_user_id then g.governance_version else null end,
      'owner_membership_id', case when owner_membership.user_id = p_actor_user_id then g.canonical_owner_membership_id else null end,
      'owner_membership_version', case when owner_membership.user_id = p_actor_user_id then owner_membership.membership_version else null end,
      'owner_handoff', case when owner_membership.user_id = p_actor_user_id
        then coalesce(owner_handoff.command, 'null'::jsonb) else 'null'::jsonb end,
      'admin', case when owner_membership.user_id <> p_actor_user_id or admin_membership.id is null then
        pg_catalog.jsonb_build_object('exists', false, 'state', 'none')
      else
        pg_catalog.jsonb_build_object(
          'exists', true,
          'user_id', admin_membership.user_id,
          'membership_id', admin_membership.id,
          'membership_version', admin_membership.membership_version,
          'membership_status', admin_membership.status,
          'credential_state', admin_gate.credential_state,
          'command_id', admin_gate.command_id,
          'command_state', admin_command.state,
          'command_stage', admin_command.stage,
          'command_action', admin_command.action,
          'state', case
            when admin_membership.status = 'active' and admin_gate.credential_state = 'ready' then 'active'
            else admin_membership.status
          end
        )
      end
    ) item
    from pg_catalog.unnest(p_center_ids) requested(center_id)
    left join public.center_access_governance g
      on g.center_id = requested.center_id
    left join public.center_members owner_membership
      on owner_membership.id = g.canonical_owner_membership_id
     and owner_membership.center_id = g.center_id
    left join public.center_members admin_membership
      on admin_membership.id = g.canonical_admin_membership_id
     and admin_membership.center_id = g.center_id
    left join public.account_credential_gates admin_gate
      on admin_gate.membership_id = admin_membership.id
    left join public.account_governance_commands admin_command
      on admin_command.id = admin_gate.command_id
    left join lateral (
      select pg_catalog.jsonb_build_object(
        'command_id', command.id,
        'state', command.state,
        'stage', command.stage,
        'target_email_masked', command.target_email_masked,
        'expires_at', command.expires_at
      ) command
      from public.account_governance_commands command
      where command.center_id = g.center_id
        and command.action = 'owner_handoff'
        and command.state in ('prepared', 'repair_required')
      order by command.prepared_at desc
      limit 1
    ) owner_handoff on true
  ) result_rows;

  return pg_catalog.jsonb_build_object('ok', true, 'centers', v_result);
end;
$arg2_list_center_account_lifecycle$;

revoke all on function public.arg2_list_center_account_lifecycle(text[], uuid)
  from public, anon, authenticated;
grant execute on function public.arg2_list_center_account_lifecycle(text[], uuid)
  to service_role;

create function public.arg2_get_my_credential_gate()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_get_my_credential_gate$
declare
  v_user_id uuid := auth.uid();
  v_rows jsonb;
begin
  if v_user_id is null then
    raise exception 'arg2_authentication_required';
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'center_id', g.center_id,
      'membership_id', g.membership_id,
      'credential_state', g.credential_state,
      'credential_version', g.credential_version,
      'command_id', g.command_id
    ) order by g.center_id
  ), '[]'::jsonb)
  into v_rows
  from public.account_credential_gates g
  where g.user_id = v_user_id
    and g.credential_state <> 'ready';

  return pg_catalog.jsonb_build_object('ok', true, 'gates', v_rows);
end;
$arg2_get_my_credential_gate$;

revoke all on function public.arg2_get_my_credential_gate() from public, anon, service_role;
grant execute on function public.arg2_get_my_credential_gate() to authenticated;

create function public.arg2_prepare_lifecycle_command(
  p_center_id text,
  p_request_id text,
  p_action text,
  p_intent_hash text,
  p_actor_user_id uuid,
  p_expected_governance_version bigint,
  p_target_membership_id uuid default null,
  p_expected_membership_version integer default null,
  p_target_email_hash text default null,
  p_target_email_masked text default null,
  p_expires_at timestamptz default null,
  p_safe_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_prepare_lifecycle_command$
declare
  v_control public.center_access_governance%rowtype;
  v_existing public.account_governance_commands%rowtype;
  v_target public.center_members%rowtype;
  v_command_id uuid;
begin
  perform public.arg2_internal_require_service_role();

  if p_action not in (
    'provision_admin', 'reset_admin', 'revoke_admin', 'restore_admin',
    'replace_admin', 'owner_handoff'
  ) then
    raise exception 'arg2_unsupported_owner_action';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_request_id, ''))) < 8
     or p_intent_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'arg2_invalid_request_identity';
  end if;

  select * into v_existing
  from public.account_governance_commands
  where center_id = p_center_id and request_id = pg_catalog.btrim(p_request_id)
  for update;

  if found then
    if v_existing.action <> p_action or v_existing.intent_hash <> p_intent_hash then
      raise exception 'arg2_idempotency_intent_conflict';
    end if;
    if v_existing.actor_user_id <> p_actor_user_id then
      raise exception 'arg2_command_actor_mismatch';
    end if;
    perform public.arg2_internal_assert_owner(p_center_id, p_actor_user_id);
    return pg_catalog.jsonb_build_object(
      'ok', true,
      'replayed', true,
      'command_id', v_existing.id,
      'state', v_existing.state,
      'stage', v_existing.stage,
      'target_user_id', v_existing.target_user_id,
      'target_membership_id', v_existing.target_membership_id,
      'external_attempt_count', v_existing.external_attempt_count
    );
  end if;

  v_control := public.arg2_internal_assert_owner(p_center_id, p_actor_user_id);
  if v_control.governance_version <> p_expected_governance_version then
    raise exception 'arg2_governance_version_stale';
  end if;

  if p_action in ('reset_admin', 'revoke_admin', 'restore_admin') then
    if p_target_membership_id is null or p_expected_membership_version is null then
      raise exception 'arg2_target_version_required';
    end if;

    select * into v_target
    from public.center_members
    where id = p_target_membership_id
      and center_id = p_center_id
      and role = 'center_admin'
    for update;

    if not found or v_control.canonical_admin_membership_id <> v_target.id then
      raise exception 'arg2_canonical_admin_target_required';
    end if;
    if v_target.membership_version <> p_expected_membership_version then
      raise exception 'arg2_membership_version_stale';
    end if;
    if p_action in ('reset_admin', 'revoke_admin') and v_target.status <> 'active' then
      raise exception 'arg2_active_admin_required';
    end if;
    if p_action = 'restore_admin' and v_target.status <> 'revoked' then
      raise exception 'arg2_revoked_admin_required';
    end if;
  elsif p_action = 'replace_admin' then
    if p_target_membership_id is null or p_expected_membership_version is null
       or p_target_membership_id <> v_control.canonical_admin_membership_id then
      raise exception 'arg2_replacement_predecessor_version_required';
    end if;
    select * into v_target from public.center_members
    where id = p_target_membership_id
      and center_id = p_center_id and role = 'center_admin' and status = 'active'
    for update;
    if not found or v_target.membership_version <> p_expected_membership_version then
      raise exception 'arg2_membership_version_stale';
    end if;
  elsif p_action = 'owner_handoff' then
    if p_target_membership_id is null or p_expected_membership_version is null
       or p_target_membership_id <> v_control.canonical_owner_membership_id then
      raise exception 'arg2_owner_predecessor_version_required';
    end if;
    select * into v_target from public.center_members
    where id = p_target_membership_id
      and center_id = p_center_id and role = 'owner' and status = 'active'
    for update;
    if not found or v_target.membership_version <> p_expected_membership_version then
      raise exception 'arg2_membership_version_stale';
    end if;
  elsif p_target_membership_id is not null or p_expected_membership_version is not null then
    raise exception 'arg2_unexpected_existing_target';
  end if;

  if p_action = 'provision_admin' and v_control.canonical_admin_membership_id is not null then
    raise exception 'arg2_admin_already_exists_use_replacement';
  end if;
  if p_action = 'replace_admin' and v_control.canonical_admin_membership_id is null then
    raise exception 'arg2_replacement_requires_admin';
  end if;
  if p_action in ('provision_admin', 'replace_admin', 'owner_handoff') then
    if p_target_email_hash !~ '^[0-9a-f]{64}$'
       or pg_catalog.length(pg_catalog.btrim(coalesce(p_target_email_masked, ''))) < 3 then
      raise exception 'arg2_reviewed_target_email_required';
    end if;
  end if;
  if p_action = 'owner_handoff'
     and (p_expires_at is null or p_expires_at <= pg_catalog.transaction_timestamp()
          or p_expires_at > pg_catalog.transaction_timestamp() + interval '7 days') then
    raise exception 'arg2_valid_handoff_expiry_required';
  end if;

  insert into public.account_governance_commands(
    center_id, request_id, action, intent_hash, actor_user_id,
    actor_membership_id, target_user_id, target_membership_id,
    predecessor_user_id, predecessor_membership_id,
    expected_governance_version, expected_membership_version,
    target_email_hash, target_email_masked, expires_at, safe_context
  ) values (
    p_center_id, pg_catalog.btrim(p_request_id), p_action, p_intent_hash, p_actor_user_id,
    v_control.canonical_owner_membership_id,
    case when p_action in ('reset_admin', 'revoke_admin', 'restore_admin') then v_target.user_id else null end,
    case when p_action in ('reset_admin', 'revoke_admin', 'restore_admin') then v_target.id else null end,
    case
      when p_action = 'replace_admin' then v_target.user_id
      when p_action = 'owner_handoff' then p_actor_user_id
      else null
    end,
    case
      when p_action = 'replace_admin' then v_control.canonical_admin_membership_id
      when p_action = 'owner_handoff' then v_control.canonical_owner_membership_id
      else null
    end,
    p_expected_governance_version, p_expected_membership_version,
    p_target_email_hash, pg_catalog.btrim(p_target_email_masked), p_expires_at,
    coalesce(p_safe_context, '{}'::jsonb)
  ) returning id into v_command_id;

  perform public.arg2_internal_append_event(
    v_command_id, 'PREPARED', p_actor_user_id, v_target.user_id,
    pg_catalog.jsonb_build_object(
      'action', p_action,
      'expected_governance_version', p_expected_governance_version,
      'expected_membership_version', p_expected_membership_version
    )
  );

  if p_action = 'reset_admin' then
    update public.center_members set status = 'reset_required' where id = v_target.id;
    update public.account_credential_gates
      set credential_state = 'reset_required', credential_version = credential_version + 1,
          command_id = v_command_id, updated_at = pg_catalog.transaction_timestamp()
      where membership_id = v_target.id;
  elsif p_action = 'revoke_admin' then
    update public.center_members set status = 'revoke_pending' where id = v_target.id;
    update public.account_credential_gates
      set credential_state = 'locked', credential_version = credential_version + 1,
          command_id = v_command_id, updated_at = pg_catalog.transaction_timestamp()
      where membership_id = v_target.id;
  elsif p_action = 'restore_admin' then
    update public.center_members set status = 'restore_pending' where id = v_target.id;
    update public.account_credential_gates
      set credential_state = 'temporary', credential_version = credential_version + 1,
          command_id = v_command_id, updated_at = pg_catalog.transaction_timestamp()
      where membership_id = v_target.id;
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'replayed', false,
    'command_id', v_command_id,
    'target_user_id', case when p_action in ('reset_admin', 'revoke_admin', 'restore_admin') then v_target.user_id else null end,
    'target_membership_id', case when p_action in ('reset_admin', 'revoke_admin', 'restore_admin') then v_target.id else null end,
    'state', 'prepared',
    'stage', 'prepared'
  );
end;
$arg2_prepare_lifecycle_command$;

revoke all on function public.arg2_prepare_lifecycle_command(
  text, text, text, text, uuid, bigint, uuid, integer, text, text, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.arg2_prepare_lifecycle_command(
  text, text, text, text, uuid, bigint, uuid, integer, text, text, timestamptz, jsonb
) to service_role;

create function public.arg2_register_created_identity(
  p_command_id uuid,
  p_target_user_id uuid,
  p_target_email_hash text,
  p_external_receipt_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_register_created_identity$
declare
  v_command public.account_governance_commands%rowtype;
  v_membership_id uuid;
  v_role text;
begin
  perform public.arg2_internal_require_service_role();

  select * into v_command
  from public.account_governance_commands
  where id = p_command_id
  for update;

  if not found then raise exception 'arg2_command_not_found'; end if;
  if v_command.action not in ('provision_admin', 'replace_admin', 'owner_handoff', 'owner_recovery') then
    raise exception 'arg2_created_identity_not_expected';
  end if;
  if v_command.state = 'cancelled'
     or v_command.stage not in ('prepared', 'awaiting_credential') then
    raise exception 'arg2_created_identity_command_not_open';
  end if;
  if p_external_receipt_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'arg2_invalid_external_receipt';
  end if;
  if p_target_email_hash <> v_command.target_email_hash then
    raise exception 'arg2_target_email_intent_mismatch';
  end if;

  if v_command.target_user_id is not null then
    if v_command.target_user_id <> p_target_user_id then
      raise exception 'arg2_external_result_conflict';
    end if;
    if v_command.state = 'repair_required'
       and v_command.stage = 'awaiting_credential' then
      update public.account_governance_commands
      set external_attempt_count = external_attempt_count + 1,
          external_receipt_hash = p_external_receipt_hash,
          state = 'prepared',
          repair_code = null,
          updated_at = pg_catalog.transaction_timestamp()
      where id = v_command.id;
      perform public.arg2_internal_append_event(
        v_command.id, 'CANDIDATE_CREDENTIAL_REISSUED', v_command.actor_user_id, p_target_user_id,
        pg_catalog.jsonb_build_object('receipt_hash', p_external_receipt_hash)
      );
      return pg_catalog.jsonb_build_object(
        'ok', true, 'replayed', false, 'reissued', true, 'command_id', v_command.id,
        'membership_id', v_command.target_membership_id, 'stage', 'awaiting_credential'
      );
    end if;
    if v_command.external_receipt_hash <> p_external_receipt_hash then
      raise exception 'arg2_external_result_conflict';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true, 'replayed', true, 'command_id', v_command.id,
      'membership_id', v_command.target_membership_id, 'stage', v_command.stage
    );
  end if;

  if exists (select 1 from public.account_governance_subjects where auth_user_id = p_target_user_id)
     or exists (select 1 from public.center_members where user_id = p_target_user_id) then
    raise exception 'arg2_new_identity_required';
  end if;

  if v_command.action = 'owner_recovery' then
    if v_command.expires_at <= pg_catalog.transaction_timestamp()
       or p_target_user_id = v_command.actor_user_id
       or exists (
         select 1 from public.account_recovery_approvals
         where command_id = v_command.id and custodian_user_id = p_target_user_id
       )
       or (
         select pg_catalog.count(*)
         from public.account_recovery_approvals approvals
         join public.account_recovery_custodians custodians
           on custodians.auth_user_id = approvals.custodian_user_id
          and custodians.status = 'active'
          and custodians.authority_version = approvals.authority_version
         where approvals.command_id = v_command.id
           and approvals.custodian_user_id <> v_command.actor_user_id
           and approvals.custodian_user_id <> p_target_user_id
       ) < 2 then
      raise exception 'arg2_recovery_identity_or_approval_boundary_failed';
    end if;
  end if;

  v_role := case when v_command.action in ('owner_handoff', 'owner_recovery') then 'owner_candidate' else 'center_admin' end;

  insert into public.account_governance_subjects(auth_user_id, first_center_id)
  values (p_target_user_id, v_command.center_id);

  insert into public.center_members(center_id, user_id, role, status)
  values (v_command.center_id, p_target_user_id, v_role, 'pending_credential')
  returning id into v_membership_id;

  insert into public.account_credential_gates(
    membership_id, center_id, user_id, credential_state, command_id
  ) values (
    v_membership_id, v_command.center_id, p_target_user_id, 'temporary', v_command.id
  );

  update public.account_governance_commands
  set target_user_id = p_target_user_id,
      target_membership_id = v_membership_id,
      external_attempt_count = external_attempt_count + 1,
      external_receipt_hash = p_external_receipt_hash,
      state = 'prepared',
      stage = 'awaiting_credential',
      repair_code = null,
      updated_at = pg_catalog.transaction_timestamp()
  where id = v_command.id;

  perform public.arg2_internal_append_event(
    v_command.id, 'EXTERNAL_IDENTITY_CREATED', v_command.actor_user_id, p_target_user_id,
    pg_catalog.jsonb_build_object('receipt_hash', p_external_receipt_hash)
  );

  return pg_catalog.jsonb_build_object(
    'ok', true, 'replayed', false, 'command_id', v_command.id,
    'membership_id', v_membership_id, 'stage', 'awaiting_credential'
  );
end;
$arg2_register_created_identity$;

revoke all on function public.arg2_register_created_identity(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.arg2_register_created_identity(uuid, uuid, text, text)
  to service_role;

create function public.arg2_record_external_credential_result(
  p_command_id uuid,
  p_target_user_id uuid,
  p_external_receipt_hash text,
  p_succeeded boolean,
  p_repair_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_record_external_credential_result$
declare
  v_command public.account_governance_commands%rowtype;
begin
  perform public.arg2_internal_require_service_role();

  select * into v_command
  from public.account_governance_commands
  where id = p_command_id
  for update;
  if not found then raise exception 'arg2_command_not_found'; end if;
  if v_command.action not in ('reset_admin', 'revoke_admin', 'restore_admin') then
    raise exception 'arg2_external_credential_result_not_expected';
  end if;
  if v_command.target_user_id <> p_target_user_id then
    raise exception 'arg2_external_target_mismatch';
  end if;
  if p_external_receipt_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'arg2_invalid_external_receipt';
  end if;

  if v_command.external_receipt_hash is not null then
    if v_command.external_receipt_hash = p_external_receipt_hash then
      return pg_catalog.jsonb_build_object(
        'ok', v_command.state <> 'repair_required', 'replayed', true,
        'command_id', v_command.id, 'state', v_command.state, 'stage', v_command.stage
      );
    end if;
    if v_command.state <> 'repair_required' then
      raise exception 'arg2_external_result_conflict';
    end if;
  end if;

  if not p_succeeded then
    update public.account_governance_commands
    set state = 'repair_required', repair_code = coalesce(nullif(p_repair_code, ''), 'auth_mutation_failed'),
        external_attempt_count = external_attempt_count + 1,
        external_receipt_hash = p_external_receipt_hash,
        updated_at = pg_catalog.transaction_timestamp()
    where id = v_command.id;
    perform public.arg2_internal_append_event(
      v_command.id, 'EXTERNAL_MUTATION_FAILED', v_command.actor_user_id,
      v_command.target_user_id,
      pg_catalog.jsonb_build_object('receipt_hash', p_external_receipt_hash, 'repair_required', true)
    );
    return pg_catalog.jsonb_build_object(
      'ok', false, 'command_id', v_command.id, 'state', 'repair_required', 'stage', v_command.stage
    );
  end if;

  update public.account_governance_commands
  set external_attempt_count = external_attempt_count + 1,
      external_receipt_hash = p_external_receipt_hash,
      state = 'prepared', repair_code = null,
      stage = case when action = 'revoke_admin' then 'session_invalidated' else 'awaiting_credential' end,
      updated_at = pg_catalog.transaction_timestamp()
  where id = v_command.id;

  perform public.arg2_internal_append_event(
    v_command.id, 'EXTERNAL_CREDENTIAL_ROTATED', v_command.actor_user_id,
    v_command.target_user_id,
    pg_catalog.jsonb_build_object('receipt_hash', p_external_receipt_hash, 'sessions_revoked', true)
  );

  if v_command.action = 'revoke_admin' then
    update public.center_members set status = 'revoked' where id = v_command.target_membership_id;
    update public.account_governance_commands
    set state = 'finalized', stage = 'complete', finalized_at = pg_catalog.transaction_timestamp(),
        updated_at = pg_catalog.transaction_timestamp()
    where id = v_command.id;
    perform public.arg2_internal_append_event(
      v_command.id, 'FINALIZED', v_command.actor_user_id, v_command.target_user_id,
      pg_catalog.jsonb_build_object('membership_status', 'revoked')
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true, 'replayed', false, 'command_id', v_command.id,
    'state', case when v_command.action = 'revoke_admin' then 'finalized' else 'prepared' end,
    'stage', case when v_command.action = 'revoke_admin' then 'complete' else 'awaiting_credential' end
  );
end;
$arg2_record_external_credential_result$;

revoke all on function public.arg2_record_external_credential_result(uuid, uuid, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.arg2_record_external_credential_result(uuid, uuid, text, boolean, text)
  to service_role;

create function public.arg2_validate_credential_change(
  p_command_id uuid,
  p_target_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_validate_credential_change$
declare
  v_command public.account_governance_commands%rowtype;
  v_operation text;
begin
  perform public.arg2_internal_require_service_role();
  select * into v_command from public.account_governance_commands
  where id = p_command_id for share;
  if not found or v_command.target_user_id <> p_target_user_id then
    raise exception 'arg2_credential_change_not_allowed';
  end if;
  if v_command.expires_at is not null
     and v_command.expires_at <= pg_catalog.transaction_timestamp()
     and not (
       (v_command.state = 'finalized' and v_command.stage = 'complete')
       or (v_command.state = 'repair_required' and v_command.stage = 'authority_swapped')
     ) then
    raise exception 'arg2_credential_change_not_allowed';
  end if;

  if v_command.state = 'finalized' and v_command.stage = 'complete' then
    v_operation := 'already_complete';
  elsif v_command.state = 'prepared' and v_command.stage = 'awaiting_credential' then
    v_operation := 'change_credential';
  elsif v_command.state = 'repair_required'
        and v_command.stage = 'awaiting_credential'
        and v_command.repair_code = 'credential_changed_database_finalize_failed' then
    v_operation := 'resume_database_finalize';
  elsif v_command.state = 'repair_required'
        and v_command.stage = 'awaiting_credential'
        and v_command.repair_code in ('target_password_change_failed', 'target_auth_state_unknown') then
    v_operation := 'change_credential';
  elsif v_command.action in ('owner_handoff', 'owner_recovery')
        and v_command.state in ('prepared', 'repair_required')
        and v_command.stage = 'target_ready'
        and (v_command.state = 'prepared'
             or v_command.repair_code = 'credential_changed_database_finalize_failed') then
    -- The target credential and its gate were already durably recorded. This is
    -- reconciliation after an unknown/timeout response, not another Auth change.
    v_operation := 'resume_database_finalize';
  elsif v_command.state = 'repair_required'
        and v_command.stage = 'authority_swapped'
        and v_command.repair_code in (
          'predecessor_session_invalidation_required',
          'predecessor_session_invalidation_failed'
        ) then
    v_operation := 'resume_session_invalidation';
  else
    raise exception 'arg2_credential_change_not_allowed';
  end if;

  if v_operation not in ('already_complete', 'resume_session_invalidation')
     and v_command.stage <> 'target_ready'
     and not exists (
       select 1 from public.account_credential_gates
       where command_id = v_command.id and user_id = p_target_user_id
         and credential_state in ('temporary', 'reset_required')
     ) then
    raise exception 'arg2_credential_change_not_allowed';
  end if;
  return pg_catalog.jsonb_build_object(
    'ok', true, 'action', v_command.action, 'center_id', v_command.center_id,
    'operation', v_operation,
    'predecessor_user_id', case when v_operation = 'resume_session_invalidation'
      then v_command.predecessor_user_id else null end
  );
end;
$arg2_validate_credential_change$;

revoke all on function public.arg2_validate_credential_change(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.arg2_validate_credential_change(uuid, uuid)
  to service_role;

create function public.arg2_complete_credential_change(
  p_command_id uuid,
  p_target_user_id uuid,
  p_external_receipt_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_complete_credential_change$
declare
  v_command public.account_governance_commands%rowtype;
  v_control public.center_access_governance%rowtype;
  v_target public.center_members%rowtype;
begin
  perform public.arg2_internal_require_service_role();

  select * into v_command
  from public.account_governance_commands
  where id = p_command_id
  for update;
  if not found then raise exception 'arg2_command_not_found'; end if;
  if v_command.target_user_id <> p_target_user_id then raise exception 'arg2_target_mismatch'; end if;
  if p_external_receipt_hash !~ '^[0-9a-f]{64}$' then raise exception 'arg2_invalid_external_receipt'; end if;

  if v_command.state = 'finalized' then
    return pg_catalog.jsonb_build_object('ok', true, 'replayed', true, 'state', 'finalized', 'stage', 'complete');
  end if;
  if v_command.action in ('owner_handoff', 'owner_recovery')
     and v_command.stage = 'target_ready'
     and v_command.state in ('prepared', 'repair_required') then
    if v_command.external_receipt_hash <> p_external_receipt_hash then
      raise exception 'arg2_external_result_conflict';
    end if;
    if v_command.state = 'repair_required' then
      update public.account_governance_commands
      set state = 'prepared', repair_code = null,
          updated_at = pg_catalog.transaction_timestamp()
      where id = v_command.id;
      perform public.arg2_internal_append_event(
        v_command.id, 'TARGET_CREDENTIAL_READY_RECONCILED', p_target_user_id, p_target_user_id,
        pg_catalog.jsonb_build_object('receipt_hash', p_external_receipt_hash)
      );
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true, 'replayed', true, 'state', 'prepared', 'stage', 'target_ready',
      'predecessor_user_id', v_command.predecessor_user_id
    );
  end if;
  if v_command.stage <> 'awaiting_credential'
     or (v_command.state = 'repair_required'
         and v_command.repair_code not in (
           'credential_changed_database_finalize_failed',
           'target_password_change_failed',
           'target_auth_state_unknown'
         ))
     or v_command.state not in ('prepared', 'repair_required') then
    raise exception 'arg2_command_not_ready_for_credential_completion';
  end if;

  select * into v_target
  from public.center_members
  where id = v_command.target_membership_id
    and center_id = v_command.center_id
    and user_id = p_target_user_id
  for update;
  if not found then raise exception 'arg2_target_membership_missing'; end if;

  select * into v_control
  from public.center_access_governance
  where center_id = v_command.center_id and status = 'active'
  for update;
  if not found or v_control.governance_version <> v_command.expected_governance_version then
    raise exception 'arg2_governance_version_stale';
  end if;

  if v_command.action = 'provision_admin' then
    if v_control.canonical_admin_membership_id is not null
       or exists (
         select 1 from public.center_members
         where center_id = v_command.center_id and role = 'center_admin' and status = 'active'
       ) then
      raise exception 'arg2_admin_activation_conflict';
    end if;
    update public.center_members set status = 'active' where id = v_target.id;
    update public.center_access_governance
    set canonical_admin_membership_id = v_target.id,
        governance_version = governance_version + 1,
        updated_at = pg_catalog.transaction_timestamp()
    where center_id = v_command.center_id;
  elsif v_command.action in ('reset_admin', 'restore_admin') then
    if v_control.canonical_admin_membership_id <> v_target.id then
      raise exception 'arg2_canonical_admin_target_required';
    end if;
    update public.center_members set status = 'active' where id = v_target.id;
  elsif v_command.action = 'replace_admin' then
    if not exists (
      select 1 from public.center_members
      where id = v_command.predecessor_membership_id
        and center_id = v_command.center_id
        and role = 'center_admin' and status = 'active'
        and membership_version = v_command.expected_membership_version
    ) then
      raise exception 'arg2_replacement_predecessor_stale';
    end if;
    update public.center_members set status = 'revoked' where id = v_command.predecessor_membership_id;
    update public.center_members set status = 'active' where id = v_target.id;
    update public.center_access_governance
    set canonical_admin_membership_id = v_target.id,
        governance_version = governance_version + 1,
        updated_at = pg_catalog.transaction_timestamp()
    where center_id = v_command.center_id;
  elsif v_command.action in ('owner_handoff', 'owner_recovery') then
    update public.account_credential_gates
    set credential_state = 'ready', credential_version = credential_version + 1,
        updated_at = pg_catalog.transaction_timestamp()
    where membership_id = v_target.id;
    update public.account_governance_commands
    set stage = 'target_ready', external_receipt_hash = p_external_receipt_hash,
        updated_at = pg_catalog.transaction_timestamp()
    where id = v_command.id;
    perform public.arg2_internal_append_event(
      v_command.id, 'TARGET_CREDENTIAL_READY', p_target_user_id, p_target_user_id,
      pg_catalog.jsonb_build_object('receipt_hash', p_external_receipt_hash)
    );
    return pg_catalog.jsonb_build_object('ok', true, 'replayed', false, 'state', 'prepared', 'stage', 'target_ready');
  else
    raise exception 'arg2_credential_completion_action_invalid';
  end if;

  update public.account_credential_gates
  set credential_state = 'ready', credential_version = credential_version + 1,
      updated_at = pg_catalog.transaction_timestamp()
  where membership_id = v_target.id;

  if v_command.action = 'replace_admin' then
    update public.account_governance_commands
    set stage = 'authority_swapped', state = 'repair_required',
        repair_code = 'predecessor_session_invalidation_required',
        external_receipt_hash = p_external_receipt_hash,
        updated_at = pg_catalog.transaction_timestamp()
    where id = v_command.id;
  else
    update public.account_governance_commands
    set stage = 'complete', state = 'finalized',
        external_receipt_hash = p_external_receipt_hash,
        finalized_at = pg_catalog.transaction_timestamp(),
        updated_at = pg_catalog.transaction_timestamp()
    where id = v_command.id;
  end if;

  perform public.arg2_internal_append_event(
    v_command.id,
    case when v_command.action = 'replace_admin' then 'AUTHORITY_SWAPPED' else 'FINALIZED' end,
    p_target_user_id, p_target_user_id,
    pg_catalog.jsonb_build_object(
      'credential_ready', true,
      'predecessor_session_invalidation_required', v_command.action = 'replace_admin'
    )
  );

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'replayed', false,
    'state', case when v_command.action = 'replace_admin' then 'repair_required' else 'finalized' end,
    'stage', case when v_command.action = 'replace_admin' then 'authority_swapped' else 'complete' end,
    'predecessor_user_id', v_command.predecessor_user_id
  );
end;
$arg2_complete_credential_change$;

revoke all on function public.arg2_complete_credential_change(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.arg2_complete_credential_change(uuid, uuid, text)
  to service_role;

create function public.arg2_prepare_owner_recovery(
  p_center_id text,
  p_request_id text,
  p_intent_hash text,
  p_requester_user_id uuid,
  p_expected_governance_version bigint,
  p_target_email_hash text,
  p_target_email_masked text,
  p_evidence_digest text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_prepare_owner_recovery$
declare
  v_control public.center_access_governance%rowtype;
  v_custodian public.account_recovery_custodians%rowtype;
  v_existing public.account_governance_commands%rowtype;
  v_command_id uuid;
  v_independent_custodian_count integer;
begin
  perform public.arg2_internal_require_service_role();

  select * into v_custodian
  from public.account_recovery_custodians
  where auth_user_id = p_requester_user_id and status = 'active'
  for share;
  if not found then raise exception 'arg2_active_recovery_custodian_required'; end if;
  select pg_catalog.count(*)::integer into v_independent_custodian_count
  from public.account_recovery_custodians
  where status = 'active' and auth_user_id <> p_requester_user_id;
  if v_independent_custodian_count < 2 then
    raise exception 'arg2_two_independent_recovery_custodians_required';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_request_id, ''))) < 8 then
    raise exception 'arg2_invalid_request_identity';
  end if;

  select * into v_existing from public.account_governance_commands
  where center_id = p_center_id and request_id = pg_catalog.btrim(p_request_id)
  for update;
  if found then
    if v_existing.action <> 'owner_recovery' or v_existing.intent_hash <> p_intent_hash then
      raise exception 'arg2_idempotency_intent_conflict';
    end if;
    if v_existing.actor_user_id <> p_requester_user_id then
      raise exception 'arg2_command_actor_mismatch';
    end if;
    return pg_catalog.jsonb_build_object(
      'ok', true, 'replayed', true, 'command_id', v_existing.id,
      'state', v_existing.state, 'stage', v_existing.stage
    );
  end if;

  select * into v_control from public.center_access_governance
  where center_id = p_center_id and status = 'active' for update;
  if not found then raise exception 'arg2_governance_not_ready'; end if;
  if v_control.governance_version <> p_expected_governance_version then
    raise exception 'arg2_governance_version_stale';
  end if;
  if p_intent_hash !~ '^[0-9a-f]{64}$'
     or p_target_email_hash !~ '^[0-9a-f]{64}$'
     or p_evidence_digest !~ '^[0-9a-f]{64}$'
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_target_email_masked, ''))) < 3 then
    raise exception 'arg2_invalid_recovery_evidence';
  end if;
  if p_expires_at <= pg_catalog.transaction_timestamp()
     or p_expires_at > pg_catalog.transaction_timestamp() + interval '24 hours' then
    raise exception 'arg2_invalid_recovery_expiry';
  end if;

  insert into public.account_governance_commands(
    center_id, request_id, action, intent_hash, actor_user_id,
    predecessor_user_id, predecessor_membership_id,
    target_email_hash, target_email_masked,
    expected_governance_version, expected_membership_version, expires_at, safe_context
  ) values (
    p_center_id, pg_catalog.btrim(p_request_id), 'owner_recovery', p_intent_hash,
    p_requester_user_id,
    (select user_id from public.center_members where id = v_control.canonical_owner_membership_id),
    v_control.canonical_owner_membership_id,
    p_target_email_hash, pg_catalog.btrim(p_target_email_masked),
    p_expected_governance_version,
    (select membership_version from public.center_members where id = v_control.canonical_owner_membership_id),
    p_expires_at,
    pg_catalog.jsonb_build_object('evidence_digest', p_evidence_digest)
  ) returning id into v_command_id;

  perform public.arg2_internal_append_event(
    v_command_id, 'RECOVERY_REQUESTED', p_requester_user_id, null,
    pg_catalog.jsonb_build_object(
      'evidence_digest', p_evidence_digest,
      'expires_at', p_expires_at,
      'required_approvals', 2
    )
  );

  return pg_catalog.jsonb_build_object(
    'ok', true, 'replayed', false, 'command_id', v_command_id,
    'state', 'prepared', 'stage', 'prepared'
  );
end;
$arg2_prepare_owner_recovery$;

revoke all on function public.arg2_prepare_owner_recovery(
  text, text, text, uuid, bigint, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.arg2_prepare_owner_recovery(
  text, text, text, uuid, bigint, text, text, text, timestamptz
) to service_role;

create function public.arg2_approve_owner_recovery(
  p_command_id uuid,
  p_custodian_user_id uuid,
  p_expected_authority_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_approve_owner_recovery$
declare
  v_command public.account_governance_commands%rowtype;
  v_custodian public.account_recovery_custodians%rowtype;
  v_approval_count integer;
  v_inserted_count integer;
begin
  perform public.arg2_internal_require_service_role();
  select * into v_command from public.account_governance_commands
  where id = p_command_id for update;
  if not found or v_command.action <> 'owner_recovery' then raise exception 'arg2_recovery_not_found'; end if;
  if v_command.state <> 'prepared' or v_command.stage <> 'prepared'
     or v_command.expires_at <= pg_catalog.transaction_timestamp() then
    raise exception 'arg2_recovery_not_approvable';
  end if;

  select * into v_custodian from public.account_recovery_custodians
  where auth_user_id = p_custodian_user_id and status = 'active' for share;
  if not found or v_custodian.authority_version <> p_expected_authority_version then
    raise exception 'arg2_recovery_custodian_stale_or_inactive';
  end if;
  if p_custodian_user_id = v_command.actor_user_id
     or p_custodian_user_id = v_command.target_user_id then
    raise exception 'arg2_recovery_identity_separation_required';
  end if;

  insert into public.account_recovery_approvals(
    command_id, custodian_user_id, authority_version, decision
  ) values (v_command.id, p_custodian_user_id, p_expected_authority_version, 'approve')
  on conflict (command_id, custodian_user_id) do nothing;
  get diagnostics v_inserted_count = row_count;

  select pg_catalog.count(*)::integer into v_approval_count
  from public.account_recovery_approvals approvals
  join public.account_recovery_custodians custodians
    on custodians.auth_user_id = approvals.custodian_user_id
   and custodians.status = 'active'
   and custodians.authority_version = approvals.authority_version
  where approvals.command_id = v_command.id;

  if v_inserted_count = 1 then
    perform public.arg2_internal_append_event(
      v_command.id, 'RECOVERY_APPROVED', p_custodian_user_id, v_command.target_user_id,
      pg_catalog.jsonb_build_object('approval_count', v_approval_count)
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true, 'replayed', v_inserted_count = 0,
    'approval_count', v_approval_count, 'threshold_met', v_approval_count >= 2
  );
end;
$arg2_approve_owner_recovery$;

revoke all on function public.arg2_approve_owner_recovery(uuid, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.arg2_approve_owner_recovery(uuid, uuid, bigint)
  to service_role;

create function public.arg2_execute_owner_swap(
  p_command_id uuid,
  p_executor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_execute_owner_swap$
declare
  v_command public.account_governance_commands%rowtype;
  v_control public.center_access_governance%rowtype;
  v_target public.center_members%rowtype;
  v_approval_count integer;
begin
  perform public.arg2_internal_require_service_role();
  select * into v_command from public.account_governance_commands
  where id = p_command_id for update;
  if not found or v_command.action not in ('owner_handoff', 'owner_recovery') then
    raise exception 'arg2_owner_swap_command_not_found';
  end if;
  if v_command.state <> 'prepared' or v_command.stage <> 'target_ready'
     or v_command.expires_at <= pg_catalog.transaction_timestamp() then
    raise exception 'arg2_owner_swap_not_ready';
  end if;

  select * into v_control from public.center_access_governance
  where center_id = v_command.center_id and status = 'active' for update;
  if not found or v_control.governance_version <> v_command.expected_governance_version
     or v_control.canonical_owner_membership_id <> v_command.predecessor_membership_id then
    raise exception 'arg2_owner_swap_stale';
  end if;
  if not exists (
    select 1 from public.center_members
    where id = v_command.predecessor_membership_id
      and center_id = v_command.center_id
      and role = 'owner' and status = 'active'
      and membership_version = v_command.expected_membership_version
  ) then
    raise exception 'arg2_owner_predecessor_stale';
  end if;

  if v_command.action = 'owner_handoff' then
    if p_executor_user_id <> v_command.actor_user_id
       or p_executor_user_id = v_command.target_user_id then
      raise exception 'arg2_current_owner_must_finalize_handoff';
    end if;
  else
    if not exists (
      select 1
      from public.account_recovery_custodians
      where auth_user_id = p_executor_user_id and status = 'active'
    ) or p_executor_user_id = v_command.target_user_id then
      raise exception 'arg2_active_recovery_custodian_required';
    end if;
    select pg_catalog.count(*)::integer into v_approval_count
    from public.account_recovery_approvals approvals
    join public.account_recovery_custodians custodians
      on custodians.auth_user_id = approvals.custodian_user_id
     and custodians.status = 'active'
     and custodians.authority_version = approvals.authority_version
    where approvals.command_id = v_command.id
      and approvals.custodian_user_id <> v_command.actor_user_id
      and approvals.custodian_user_id <> v_command.target_user_id;
    if v_approval_count < 2 then raise exception 'arg2_two_custodian_approvals_required'; end if;

    if exists (
      select 1
      from public.center_access_governance other_control
      join public.center_members other_owner
        on other_owner.id = other_control.canonical_owner_membership_id
       and other_owner.center_id = other_control.center_id
      where other_control.status = 'active'
        and other_control.center_id <> v_command.center_id
        and other_owner.user_id = v_command.predecessor_user_id
        and other_owner.role = 'owner'
        and other_owner.status = 'active'
    ) then
      raise exception 'arg2_shared_owner_recovery_requires_coordinated_plan';
    end if;
  end if;

  select * into v_target from public.center_members
  where id = v_command.target_membership_id
    and center_id = v_command.center_id
    and user_id = v_command.target_user_id
    and role = 'owner_candidate'
    and status = 'pending_credential'
  for update;
  if not found then raise exception 'arg2_owner_candidate_mismatch'; end if;

  update public.center_members
  set role = 'former_owner', status = 'revoked'
  where id = v_command.predecessor_membership_id;
  update public.center_members
  set role = 'owner', status = 'active'
  where id = v_target.id;
  update public.center_access_governance
  set canonical_owner_membership_id = v_target.id,
      governance_version = governance_version + 1,
      updated_at = pg_catalog.transaction_timestamp()
  where center_id = v_command.center_id;
  update public.account_governance_commands
  set stage = 'authority_swapped', state = 'repair_required',
      repair_code = 'predecessor_session_invalidation_required',
      updated_at = pg_catalog.transaction_timestamp()
  where id = v_command.id;

  perform public.arg2_internal_append_event(
    v_command.id, 'AUTHORITY_SWAPPED', p_executor_user_id, v_command.target_user_id,
    pg_catalog.jsonb_build_object(
      'former_owner_membership_id', v_command.predecessor_membership_id,
      'new_owner_membership_id', v_command.target_membership_id,
      'session_invalidation_required', true
    )
  );

  return pg_catalog.jsonb_build_object(
    'ok', true, 'state', 'repair_required', 'stage', 'authority_swapped',
    'predecessor_user_id', v_command.predecessor_user_id
  );
end;
$arg2_execute_owner_swap$;

revoke all on function public.arg2_execute_owner_swap(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.arg2_execute_owner_swap(uuid, uuid)
  to service_role;

create function public.arg2_finalize_session_invalidation(
  p_command_id uuid,
  p_actor_user_id uuid,
  p_session_invalidation_receipt_hash text,
  p_succeeded boolean,
  p_repair_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_finalize_session_invalidation$
declare
  v_command public.account_governance_commands%rowtype;
begin
  perform public.arg2_internal_require_service_role();
  select * into v_command from public.account_governance_commands
  where id = p_command_id for update;
  if not found then raise exception 'arg2_command_not_found'; end if;
  if v_command.action not in ('replace_admin', 'owner_handoff', 'owner_recovery')
     or v_command.stage <> 'authority_swapped' then
    raise exception 'arg2_session_invalidation_not_expected';
  end if;
  if not (
    p_actor_user_id = v_command.actor_user_id
    or p_actor_user_id = v_command.target_user_id
    or (
      v_command.action = 'replace_admin'
      and exists (
        select 1
        from public.center_access_governance control
        join public.center_members owner_membership
          on owner_membership.id = control.canonical_owner_membership_id
         and owner_membership.center_id = control.center_id
        where control.center_id = v_command.center_id
          and control.status = 'active'
          and owner_membership.user_id = p_actor_user_id
          and owner_membership.role = 'owner'
          and owner_membership.status = 'active'
      )
    )
    or (
      v_command.action = 'owner_recovery'
      and exists (
        select 1 from public.account_recovery_custodians
        where auth_user_id = p_actor_user_id and status = 'active'
      )
    )
  ) then
    raise exception 'arg2_session_invalidation_actor_denied';
  end if;
  if p_session_invalidation_receipt_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'arg2_invalid_session_invalidation_receipt';
  end if;

  if v_command.session_invalidation_receipt_hash is not null then
    if v_command.session_invalidation_receipt_hash = p_session_invalidation_receipt_hash then
      return pg_catalog.jsonb_build_object(
        'ok', v_command.state = 'finalized', 'replayed', true,
        'state', v_command.state, 'stage', v_command.stage
      );
    end if;
    if v_command.state <> 'repair_required' then
      raise exception 'arg2_session_invalidation_result_conflict';
    end if;
  end if;

  update public.account_governance_commands
  set session_invalidation_receipt_hash = p_session_invalidation_receipt_hash,
      state = case when p_succeeded then 'finalized' else 'repair_required' end,
      stage = case when p_succeeded then 'complete' else 'authority_swapped' end,
      repair_code = case when p_succeeded then null
        else coalesce(nullif(p_repair_code, ''), 'session_invalidation_failed') end,
      finalized_at = case when p_succeeded then pg_catalog.transaction_timestamp() else null end,
      updated_at = pg_catalog.transaction_timestamp()
  where id = v_command.id;

  perform public.arg2_internal_append_event(
    v_command.id,
    case when p_succeeded then 'FINALIZED' else 'SESSION_INVALIDATION_FAILED' end,
    p_actor_user_id,
    v_command.predecessor_user_id,
    pg_catalog.jsonb_build_object(
      'receipt_hash', p_session_invalidation_receipt_hash,
      'sessions_revoked', p_succeeded,
      'repair_required', not p_succeeded
    )
  );

  return pg_catalog.jsonb_build_object(
    'ok', p_succeeded,
    'replayed', false,
    'state', case when p_succeeded then 'finalized' else 'repair_required' end,
    'stage', case when p_succeeded then 'complete' else 'authority_swapped' end
  );
end;
$arg2_finalize_session_invalidation$;

revoke all on function public.arg2_finalize_session_invalidation(uuid, uuid, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.arg2_finalize_session_invalidation(uuid, uuid, text, boolean, text)
  to service_role;

create function public.arg2_mark_command_repair_required(
  p_command_id uuid,
  p_actor_user_id uuid,
  p_repair_code text,
  p_receipt_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_mark_command_repair_required$
declare
  v_command public.account_governance_commands%rowtype;
begin
  perform public.arg2_internal_require_service_role();
  if p_receipt_hash !~ '^[0-9a-f]{64}$'
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_repair_code, ''))) < 3 then
    raise exception 'arg2_invalid_repair_evidence';
  end if;

  select * into v_command from public.account_governance_commands
  where id = p_command_id for update;
  if not found then raise exception 'arg2_command_not_found'; end if;
  if v_command.state in ('finalized', 'cancelled') then
    raise exception 'arg2_closed_command_immutable';
  end if;
  if not (
    p_actor_user_id = v_command.actor_user_id
    or p_actor_user_id = v_command.target_user_id
    or (
      v_command.action = 'owner_recovery'
      and exists (
        select 1 from public.account_recovery_custodians
        where auth_user_id = p_actor_user_id and status = 'active'
      )
    )
  ) then
    raise exception 'arg2_repair_actor_denied';
  end if;

  update public.account_governance_commands
  set state = 'repair_required', repair_code = pg_catalog.btrim(p_repair_code),
      external_attempt_count = external_attempt_count + 1,
      external_receipt_hash = coalesce(external_receipt_hash, p_receipt_hash),
      updated_at = pg_catalog.transaction_timestamp()
  where id = v_command.id;

  perform public.arg2_internal_append_event(
    v_command.id, 'REPAIR_REQUIRED', p_actor_user_id, v_command.target_user_id,
    pg_catalog.jsonb_build_object('receipt_hash', p_receipt_hash, 'repair_code', pg_catalog.btrim(p_repair_code))
  );

  return pg_catalog.jsonb_build_object('ok', false, 'state', 'repair_required', 'stage', v_command.stage);
end;
$arg2_mark_command_repair_required$;

revoke all on function public.arg2_mark_command_repair_required(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.arg2_mark_command_repair_required(uuid, uuid, text, text)
  to service_role;

create function public.arg2_cancel_pending_command(
  p_command_id uuid,
  p_actor_user_id uuid,
  p_session_invalidation_receipt_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_cancel_pending_command$
declare
  v_command public.account_governance_commands%rowtype;
begin
  perform public.arg2_internal_require_service_role();
  select * into v_command from public.account_governance_commands
  where id = p_command_id for update;
  if not found then raise exception 'arg2_command_not_found'; end if;
  if v_command.action not in ('provision_admin', 'replace_admin', 'owner_handoff', 'owner_recovery')
     or v_command.state not in ('prepared', 'repair_required')
     or v_command.stage = 'authority_swapped' then
    raise exception 'arg2_command_not_cancellable';
  end if;
  if v_command.action <> 'owner_recovery' then
    perform public.arg2_internal_assert_owner(v_command.center_id, p_actor_user_id);
  elsif not exists (
    select 1 from public.account_recovery_custodians
    where auth_user_id = p_actor_user_id and status = 'active'
  ) then
    raise exception 'arg2_active_recovery_custodian_required';
  end if;
  if v_command.target_user_id is not null
     and p_session_invalidation_receipt_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'arg2_session_invalidation_required_before_cancel';
  end if;

  if v_command.target_membership_id is not null then
    update public.center_members set status = 'revoked' where id = v_command.target_membership_id;
    update public.account_credential_gates
    set credential_state = 'locked', credential_version = credential_version + 1,
        updated_at = pg_catalog.transaction_timestamp()
    where membership_id = v_command.target_membership_id;
  end if;

  update public.account_governance_commands
  set state = 'cancelled',
      session_invalidation_receipt_hash = p_session_invalidation_receipt_hash,
      external_attempt_count = external_attempt_count + 1,
      repair_code = null,
      finalized_at = pg_catalog.transaction_timestamp(),
      updated_at = pg_catalog.transaction_timestamp()
  where id = v_command.id;

  perform public.arg2_internal_append_event(
    v_command.id, 'CANCELLED', p_actor_user_id, v_command.target_user_id,
    pg_catalog.jsonb_build_object(
      'candidate_session_invalidated', v_command.target_user_id is not null,
      'receipt_hash', p_session_invalidation_receipt_hash
    )
  );

  return pg_catalog.jsonb_build_object('ok', true, 'state', 'cancelled', 'stage', v_command.stage);
end;
$arg2_cancel_pending_command$;

revoke all on function public.arg2_cancel_pending_command(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.arg2_cancel_pending_command(uuid, uuid, text)
  to service_role;

create function public.arg2_get_command_execution_context(
  p_command_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $arg2_get_command_execution_context$
declare
  v_command public.account_governance_commands%rowtype;
begin
  perform public.arg2_internal_require_service_role();
  select * into v_command from public.account_governance_commands where id = p_command_id for share;
  if not found then raise exception 'arg2_command_not_found'; end if;
  if v_command.action <> 'owner_recovery' then
    perform public.arg2_internal_assert_owner(v_command.center_id, p_actor_user_id);
  elsif not exists (
    select 1 from public.account_recovery_custodians
    where auth_user_id = p_actor_user_id and status = 'active'
  ) then
    raise exception 'arg2_active_recovery_custodian_required';
  end if;
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'command_id', v_command.id,
    'center_id', v_command.center_id,
    'action', v_command.action,
    'state', v_command.state,
    'stage', v_command.stage,
    'target_user_id', v_command.target_user_id,
    'target_email_hash', v_command.target_email_hash,
    'predecessor_user_id', v_command.predecessor_user_id,
    'expires_at', v_command.expires_at,
    'recovery_approval_count', case when v_command.action = 'owner_recovery' then (
      select pg_catalog.count(*)
      from public.account_recovery_approvals approvals
      join public.account_recovery_custodians custodians
        on custodians.auth_user_id = approvals.custodian_user_id
       and custodians.status = 'active'
       and custodians.authority_version = approvals.authority_version
      where approvals.command_id = v_command.id
        and approvals.custodian_user_id <> v_command.actor_user_id
        and approvals.custodian_user_id <> v_command.target_user_id
    ) else null end
  );
end;
$arg2_get_command_execution_context$;

revoke all on function public.arg2_get_command_execution_context(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.arg2_get_command_execution_context(uuid, uuid)
  to service_role;

comment on table public.center_access_governance is
  'ARG-2 explicit per-center lifecycle capability and canonical Owner/Admin pointers.';
comment on table public.account_governance_commands is
  'Durable PREPARED-to-FINALIZED/REPAIR_REQUIRED Auth/Postgres saga; contains no credentials or tokens.';
comment on table public.account_governance_events is
  'Append-only immutable governance events.';
comment on function public.arg2_get_my_credential_gate() is
  'Minimal caller-only credential gate. It grants no center business authority.';

commit;
