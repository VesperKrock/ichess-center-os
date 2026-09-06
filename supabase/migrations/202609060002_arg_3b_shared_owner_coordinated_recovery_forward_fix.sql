begin;

-- ARG-3B FIX2: one emergency recovery command covers the complete server-derived
-- set of governed centers owned by the same canonical Owner. The frozen ARG-2
-- and two-custodian migrations remain unchanged.

do $arg3b_fix2_prerequisites$
begin
  if pg_catalog.to_regclass('public.center_access_governance') is null
     or pg_catalog.to_regclass('public.account_governance_commands') is null
     or pg_catalog.to_regclass('public.account_recovery_custodians') is null
     or pg_catalog.to_regprocedure(
       'public.arg2_prepare_owner_recovery(text,text,text,uuid,bigint,text,text,text,timestamp with time zone)'
     ) is null
     or pg_catalog.to_regprocedure('public.arg2_approve_owner_recovery(uuid,uuid,bigint)') is null
     or pg_catalog.to_regprocedure('public.arg2_register_created_identity(uuid,uuid,text,text)') is null
     or pg_catalog.to_regprocedure('public.arg2_complete_credential_change(uuid,uuid,text)') is null
     or pg_catalog.to_regprocedure('public.arg2_execute_owner_swap(uuid,uuid)') is null
     or pg_catalog.to_regprocedure('public.arg2_cancel_pending_command(uuid,uuid,text)') is null
     or pg_catalog.to_regprocedure('public.arg2_get_command_execution_context(uuid,uuid)') is null
     or pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'arg3b_fix2_prerequisite_contract_missing';
  end if;

  if pg_catalog.obj_description(
    'public.arg2_prepare_owner_recovery(text,text,text,uuid,bigint,text,text,text,timestamp with time zone)'::pg_catalog.regprocedure,
    'pg_proc'
  ) not like 'ARG-3B:%' then
    raise exception 'arg3b_fix2_two_custodian_forward_fix_required';
  end if;

  if exists (
    select 1 from public.account_governance_commands where action = 'owner_recovery'
  ) or exists (select 1 from public.account_recovery_approvals) then
    raise exception 'arg3b_fix2_existing_recovery_state_requires_separate_review';
  end if;
end;
$arg3b_fix2_prerequisites$;

create table public.account_owner_recovery_scopes (
  command_id uuid not null
    references public.account_governance_commands(id) on delete restrict,
  center_id text not null references public.centers(id) on delete restrict,
  scope_ordinal integer not null check (scope_ordinal >= 1),
  predecessor_user_id uuid not null references auth.users(id) on delete restrict,
  predecessor_membership_id uuid not null,
  expected_governance_version bigint not null check (expected_governance_version >= 1),
  expected_membership_version integer not null check (expected_membership_version >= 1),
  target_membership_id uuid,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  primary key (command_id, center_id),
  unique (command_id, scope_ordinal),
  unique (command_id, predecessor_membership_id),
  unique (command_id, target_membership_id),
  constraint account_owner_recovery_scopes_predecessor_fk
    foreign key (center_id, predecessor_membership_id)
    references public.center_members(center_id, id) on delete restrict,
  constraint account_owner_recovery_scopes_target_fk
    foreign key (center_id, target_membership_id)
    references public.center_members(center_id, id) on delete restrict,
  constraint account_owner_recovery_scopes_distinct_memberships
    check (target_membership_id is null or target_membership_id <> predecessor_membership_id)
);

create unique index account_governance_open_owner_recovery_predecessor_key
  on public.account_governance_commands(predecessor_user_id)
  where action = 'owner_recovery' and state in ('prepared', 'repair_required');

alter table public.account_owner_recovery_scopes enable row level security;
alter table public.account_owner_recovery_scopes force row level security;
revoke all on public.account_owner_recovery_scopes from public, anon, authenticated, service_role;

create function public.arg3b_internal_guard_recovery_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $arg3b_internal_guard_recovery_scope$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'arg3b_recovery_scope_history_immutable';
  end if;
  if old.command_id is distinct from new.command_id
     or old.center_id is distinct from new.center_id
     or old.scope_ordinal is distinct from new.scope_ordinal
     or old.predecessor_user_id is distinct from new.predecessor_user_id
     or old.predecessor_membership_id is distinct from new.predecessor_membership_id
     or old.expected_governance_version is distinct from new.expected_governance_version
     or old.expected_membership_version is distinct from new.expected_membership_version
     or old.created_at is distinct from new.created_at
     or (old.target_membership_id is not null
         and old.target_membership_id is distinct from new.target_membership_id) then
    raise exception 'arg3b_recovery_scope_frozen';
  end if;
  return new;
end;
$arg3b_internal_guard_recovery_scope$;

create trigger arg3b_recovery_scope_frozen_row
before update or delete on public.account_owner_recovery_scopes
for each row execute function public.arg3b_internal_guard_recovery_scope();

create trigger arg3b_recovery_scope_frozen_truncate
before truncate on public.account_owner_recovery_scopes
for each statement execute function public.arg3b_internal_guard_recovery_scope();

revoke all on function public.arg3b_internal_guard_recovery_scope()
  from public, anon, authenticated, service_role;

create function public.arg3b_internal_recovery_scope_snapshot(p_command_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $arg3b_internal_recovery_scope_snapshot$
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'center_id', scope.center_id,
        'scope_ordinal', scope.scope_ordinal,
        'predecessor_user_id', scope.predecessor_user_id,
        'predecessor_membership_id', scope.predecessor_membership_id,
        'expected_governance_version', scope.expected_governance_version,
        'expected_membership_version', scope.expected_membership_version
      ) order by scope.scope_ordinal
    ),
    '[]'::jsonb
  )
  from public.account_owner_recovery_scopes scope
  where scope.command_id = p_command_id;
$arg3b_internal_recovery_scope_snapshot$;

create function public.arg3b_internal_recovery_scope_digest(p_command_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $arg3b_internal_recovery_scope_digest$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.convert_to(public.arg3b_internal_recovery_scope_snapshot(p_command_id)::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  );
$arg3b_internal_recovery_scope_digest$;

create function public.arg3b_internal_recovery_scope_centers(p_command_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $arg3b_internal_recovery_scope_centers$
  select coalesce(pg_catalog.jsonb_agg(scope.center_id order by scope.scope_ordinal), '[]'::jsonb)
  from public.account_owner_recovery_scopes scope
  where scope.command_id = p_command_id;
$arg3b_internal_recovery_scope_centers$;

revoke all on function public.arg3b_internal_recovery_scope_snapshot(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.arg3b_internal_recovery_scope_digest(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.arg3b_internal_recovery_scope_centers(uuid)
  from public, anon, authenticated, service_role;

create function public.arg3b_internal_lock_governance_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $arg3b_internal_lock_governance_owner$
declare
  v_old_owner_user_id uuid;
  v_owner_user_id uuid;
  v_old_lock_key bigint;
  v_new_lock_key bigint;
begin
  if tg_op = 'UPDATE' then
    select user_id into v_old_owner_user_id
    from public.center_members
    where id = old.canonical_owner_membership_id
      and center_id = old.center_id;
  end if;
  select user_id into v_owner_user_id
  from public.center_members
  where id = new.canonical_owner_membership_id
    and center_id = new.center_id;
  if v_owner_user_id is null then
    raise exception 'arg3b_canonical_owner_membership_missing';
  end if;

  v_new_lock_key := pg_catalog.hashtextextended(v_owner_user_id::text, 730320260906);
  v_old_lock_key := case when v_old_owner_user_id is null then v_new_lock_key
    else pg_catalog.hashtextextended(v_old_owner_user_id::text, 730320260906) end;
  if v_old_lock_key <= v_new_lock_key then
    perform pg_catalog.pg_advisory_xact_lock(v_old_lock_key);
    if v_old_lock_key <> v_new_lock_key then
      perform pg_catalog.pg_advisory_xact_lock(v_new_lock_key);
    end if;
  else
    perform pg_catalog.pg_advisory_xact_lock(v_new_lock_key);
    perform pg_catalog.pg_advisory_xact_lock(v_old_lock_key);
  end if;

  if exists (
    select 1
    from public.account_governance_commands command
    where command.action = 'owner_recovery'
      and command.state in ('prepared', 'repair_required')
      and command.predecessor_user_id = v_owner_user_id
  ) then
    raise exception 'arg3b_owner_has_open_coordinated_recovery';
  end if;
  if tg_op = 'UPDATE' and v_old_owner_user_id is distinct from v_owner_user_id
     and exists (
       select 1
       from public.account_governance_commands command
       where command.action = 'owner_recovery'
         and command.state in ('prepared', 'repair_required')
         and command.predecessor_user_id = v_old_owner_user_id
         and not (
           command.state = 'prepared'
           and command.stage = 'target_ready'
           and command.target_user_id = v_owner_user_id
           and exists (
             select 1 from public.account_owner_recovery_scopes scope
             where scope.command_id = command.id
               and scope.center_id = new.center_id
               and scope.target_membership_id = new.canonical_owner_membership_id
           )
         )
     ) then
    raise exception 'arg3b_owner_has_open_coordinated_recovery';
  end if;
  return new;
end;
$arg3b_internal_lock_governance_owner$;

create trigger arg3b_center_governance_owner_recovery_mutex
before insert or update of canonical_owner_membership_id, status
on public.center_access_governance
for each row execute function public.arg3b_internal_lock_governance_owner();

revoke all on function public.arg3b_internal_lock_governance_owner()
  from public, anon, authenticated, service_role;

create or replace function public.arg2_prepare_owner_recovery(
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
  v_initial_predecessor_user_id uuid;
  v_predecessor_user_id uuid;
  v_predecessor_membership_version integer;
  v_command_id uuid;
  v_active_custodian_count integer;
  v_approval_count integer;
  v_scope_count integer;
  v_scope_digest text;
begin
  perform public.arg2_internal_require_service_role();

  select * into v_custodian
  from public.account_recovery_custodians
  where auth_user_id = p_requester_user_id and status = 'active'
  for share;
  if not found then raise exception 'arg2_active_recovery_custodian_required'; end if;

  select pg_catalog.count(*)::integer into v_active_custodian_count
  from public.account_recovery_custodians where status = 'active';
  if v_active_custodian_count <> 2 then
    raise exception 'arg3b_exactly_two_active_recovery_custodians_required';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_request_id, ''))) < 8 then
    raise exception 'arg2_invalid_request_identity';
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

  select * into v_existing
  from public.account_governance_commands
  where center_id = p_center_id and request_id = pg_catalog.btrim(p_request_id)
  for update;
  if found then
    if v_existing.action <> 'owner_recovery' or v_existing.intent_hash <> p_intent_hash then
      raise exception 'arg2_idempotency_intent_conflict';
    end if;
    if v_existing.actor_user_id <> p_requester_user_id then
      raise exception 'arg2_command_actor_mismatch';
    end if;
    if public.arg3b_internal_recovery_scope_digest(v_existing.id)
       is distinct from v_existing.safe_context ->> 'recovery_scope_digest' then
      raise exception 'arg3b_recovery_scope_integrity_failed';
    end if;
    if not exists (
      select 1
      from public.account_recovery_approvals approvals
      join public.account_recovery_custodians custodians
        on custodians.auth_user_id = approvals.custodian_user_id
       and custodians.status = 'active'
       and custodians.authority_version = approvals.authority_version
      where approvals.command_id = v_existing.id
        and approvals.custodian_user_id = v_existing.actor_user_id
    ) then
      raise exception 'arg3b_requester_attestation_stale_or_missing';
    end if;
    select pg_catalog.count(*)::integer into v_approval_count
    from public.account_recovery_approvals approvals
    join public.account_recovery_custodians custodians
      on custodians.auth_user_id = approvals.custodian_user_id
     and custodians.status = 'active'
     and custodians.authority_version = approvals.authority_version
    where approvals.command_id = v_existing.id
      and approvals.custodian_user_id is distinct from v_existing.target_user_id;
    select pg_catalog.count(*)::integer into v_scope_count
    from public.account_owner_recovery_scopes where command_id = v_existing.id;
    return pg_catalog.jsonb_build_object(
      'ok', true, 'replayed', true, 'command_id', v_existing.id,
      'state', v_existing.state, 'stage', v_existing.stage,
      'approval_count', v_approval_count, 'threshold_met', v_approval_count = 2,
      'affected_center_count', v_scope_count,
      'affected_centers', public.arg3b_internal_recovery_scope_centers(v_existing.id),
      'recovery_scope_digest', v_existing.safe_context ->> 'recovery_scope_digest'
    );
  end if;

  select * into v_control
  from public.center_access_governance
  where center_id = p_center_id and status = 'active';
  if not found then raise exception 'arg2_governance_not_ready'; end if;

  select user_id into v_initial_predecessor_user_id
  from public.center_members
  where id = v_control.canonical_owner_membership_id
    and center_id = p_center_id
    and role = 'owner'
    and status = 'active';
  if not found then raise exception 'arg2_owner_predecessor_stale'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_initial_predecessor_user_id::text, 730320260906)
  );

  select * into v_control
  from public.center_access_governance
  where center_id = p_center_id and status = 'active'
  for update;
  if not found or v_control.governance_version <> p_expected_governance_version then
    raise exception 'arg2_governance_version_stale';
  end if;
  select user_id, membership_version
    into v_predecessor_user_id, v_predecessor_membership_version
  from public.center_members
  where id = v_control.canonical_owner_membership_id
    and center_id = p_center_id
    and role = 'owner'
    and status = 'active'
  for update;
  if not found or v_predecessor_user_id <> v_initial_predecessor_user_id then
    raise exception 'arg2_owner_predecessor_stale';
  end if;

  perform control.center_id
  from public.center_access_governance control
  join public.center_members owner_membership
    on owner_membership.id = control.canonical_owner_membership_id
   and owner_membership.center_id = control.center_id
  where control.status = 'active'
    and owner_membership.user_id = v_predecessor_user_id
    and owner_membership.role = 'owner'
    and owner_membership.status = 'active'
  order by control.center_id
  for update of control, owner_membership;

  if exists (
    select 1 from public.account_governance_commands command
    where command.action = 'owner_recovery'
      and command.state in ('prepared', 'repair_required')
      and command.predecessor_user_id = v_predecessor_user_id
  ) then
    raise exception 'arg3b_owner_recovery_already_open';
  end if;
  if exists (
    select 1
    from public.account_owner_recovery_scopes existing_scope
    join public.account_governance_commands existing_command
      on existing_command.id = existing_scope.command_id
     and existing_command.action = 'owner_recovery'
     and existing_command.state in ('prepared', 'repair_required')
    join public.center_access_governance current_control
      on current_control.center_id = existing_scope.center_id
     and current_control.status = 'active'
    join public.center_members current_owner
      on current_owner.id = current_control.canonical_owner_membership_id
     and current_owner.center_id = current_control.center_id
     and current_owner.user_id = v_predecessor_user_id
     and current_owner.role = 'owner'
     and current_owner.status = 'active'
  ) then
    raise exception 'arg3b_recovery_scope_already_open';
  end if;

  select pg_catalog.count(*)::integer into v_scope_count
  from public.center_access_governance control
  join public.center_members owner_membership
    on owner_membership.id = control.canonical_owner_membership_id
   and owner_membership.center_id = control.center_id
  where control.status = 'active'
    and owner_membership.user_id = v_predecessor_user_id
    and owner_membership.role = 'owner'
    and owner_membership.status = 'active';

  if v_scope_count < 1
     or not exists (
       select 1
       from public.center_access_governance control
       join public.center_members owner_membership
         on owner_membership.id = control.canonical_owner_membership_id
        and owner_membership.center_id = control.center_id
       where control.center_id = p_center_id
         and control.status = 'active'
         and owner_membership.user_id = v_predecessor_user_id
         and owner_membership.role = 'owner'
         and owner_membership.status = 'active'
     ) then
    raise exception 'arg3b_recovery_scope_derivation_failed';
  end if;
  insert into public.account_governance_commands(
    center_id, request_id, action, intent_hash, actor_user_id,
    predecessor_user_id, predecessor_membership_id,
    target_email_hash, target_email_masked,
    expected_governance_version, expected_membership_version, expires_at, safe_context
  ) values (
    p_center_id, pg_catalog.btrim(p_request_id), 'owner_recovery', p_intent_hash,
    p_requester_user_id, v_predecessor_user_id, v_control.canonical_owner_membership_id,
    p_target_email_hash, pg_catalog.btrim(p_target_email_masked),
    p_expected_governance_version, v_predecessor_membership_version, p_expires_at,
    pg_catalog.jsonb_build_object('evidence_digest', p_evidence_digest)
  ) returning id into v_command_id;

  insert into public.account_owner_recovery_scopes(
    command_id, center_id, scope_ordinal,
    predecessor_user_id, predecessor_membership_id,
    expected_governance_version, expected_membership_version
  )
  select v_command_id, control.center_id,
         pg_catalog.row_number() over (order by control.center_id)::integer,
         owner_membership.user_id, owner_membership.id,
         control.governance_version, owner_membership.membership_version
  from public.center_access_governance control
  join public.center_members owner_membership
    on owner_membership.id = control.canonical_owner_membership_id
   and owner_membership.center_id = control.center_id
  where control.status = 'active'
    and owner_membership.user_id = v_predecessor_user_id
    and owner_membership.role = 'owner'
    and owner_membership.status = 'active'
  order by control.center_id;

  select pg_catalog.count(*)::integer into v_scope_count
  from public.account_owner_recovery_scopes where command_id = v_command_id;
  v_scope_digest := public.arg3b_internal_recovery_scope_digest(v_command_id);
  if v_scope_count < 1 or v_scope_digest is null then
    raise exception 'arg3b_recovery_scope_derivation_failed';
  end if;

  update public.account_governance_commands
  set safe_context = safe_context || pg_catalog.jsonb_build_object(
        'recovery_scope_digest', v_scope_digest,
        'affected_center_count', v_scope_count
      )
  where id = v_command_id;

  insert into public.account_recovery_approvals(
    command_id, custodian_user_id, authority_version, decision
  ) values (v_command_id, p_requester_user_id, v_custodian.authority_version, 'approve');

  perform public.arg2_internal_append_event(
    v_command_id, 'RECOVERY_REQUESTED', p_requester_user_id, null,
    pg_catalog.jsonb_build_object(
      'evidence_digest', p_evidence_digest,
      'expires_at', p_expires_at,
      'requester_attestation', true,
      'attestation_count', 1,
      'required_attestations', 2,
      'affected_center_count', v_scope_count,
      'recovery_scope_digest', v_scope_digest
    )
  );

  return pg_catalog.jsonb_build_object(
    'ok', true, 'replayed', false, 'command_id', v_command_id,
    'state', 'prepared', 'stage', 'prepared',
    'approval_count', 1, 'threshold_met', false,
    'affected_center_count', v_scope_count,
    'affected_centers', public.arg3b_internal_recovery_scope_centers(v_command_id),
    'recovery_scope_digest', v_scope_digest
  );
end;
$arg2_prepare_owner_recovery$;

revoke all on function public.arg2_prepare_owner_recovery(
  text, text, text, uuid, bigint, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.arg2_prepare_owner_recovery(
  text, text, text, uuid, bigint, text, text, text, timestamptz
) to service_role;

create or replace function public.arg2_approve_owner_recovery(
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
  v_active_custodian_count integer;
  v_inserted_count integer;
  v_scope_count integer;
begin
  perform public.arg2_internal_require_service_role();
  select * into v_command from public.account_governance_commands
  where id = p_command_id for update;
  if not found or v_command.action <> 'owner_recovery' then raise exception 'arg2_recovery_not_found'; end if;
  if v_command.state <> 'prepared' or v_command.stage <> 'prepared'
     or v_command.expires_at <= pg_catalog.transaction_timestamp() then
    raise exception 'arg2_recovery_not_approvable';
  end if;
  if public.arg3b_internal_recovery_scope_digest(v_command.id)
     is distinct from v_command.safe_context ->> 'recovery_scope_digest' then
    raise exception 'arg3b_recovery_scope_integrity_failed';
  end if;

  select pg_catalog.count(*)::integer into v_active_custodian_count
  from public.account_recovery_custodians where status = 'active';
  if v_active_custodian_count <> 2 then
    raise exception 'arg3b_exactly_two_active_recovery_custodians_required';
  end if;
  if not exists (
    select 1 from public.account_recovery_approvals approvals
    join public.account_recovery_custodians custodians
      on custodians.auth_user_id = approvals.custodian_user_id
     and custodians.status = 'active'
     and custodians.authority_version = approvals.authority_version
    where approvals.command_id = v_command.id
      and approvals.custodian_user_id = v_command.actor_user_id
  ) then raise exception 'arg3b_requester_attestation_stale_or_missing'; end if;

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
  where approvals.command_id = v_command.id
    and approvals.custodian_user_id is distinct from v_command.target_user_id;
  select pg_catalog.count(*)::integer into v_scope_count
  from public.account_owner_recovery_scopes where command_id = v_command.id;

  if v_inserted_count = 1 then
    perform public.arg2_internal_append_event(
      v_command.id, 'RECOVERY_APPROVED', p_custodian_user_id, v_command.target_user_id,
      pg_catalog.jsonb_build_object(
        'approval_count', v_approval_count,
        'attestation_count', v_approval_count,
        'affected_center_count', v_scope_count,
        'recovery_scope_digest', v_command.safe_context ->> 'recovery_scope_digest'
      )
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true, 'replayed', v_inserted_count = 0,
    'approval_count', v_approval_count, 'threshold_met', v_approval_count = 2,
    'affected_center_count', v_scope_count,
    'affected_centers', public.arg3b_internal_recovery_scope_centers(v_command.id),
    'recovery_scope_digest', v_command.safe_context ->> 'recovery_scope_digest'
  );
end;
$arg2_approve_owner_recovery$;

revoke all on function public.arg2_approve_owner_recovery(uuid, uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.arg2_approve_owner_recovery(uuid, uuid, bigint)
  to service_role;

create or replace function public.arg2_register_created_identity(
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
  v_scope public.account_owner_recovery_scopes%rowtype;
  v_membership_id uuid;
  v_anchor_membership_id uuid;
  v_role text;
  v_scope_count integer;
  v_bound_count integer;
begin
  perform public.arg2_internal_require_service_role();
  select * into v_command from public.account_governance_commands
  where id = p_command_id for update;
  if not found then raise exception 'arg2_command_not_found'; end if;
  if v_command.action not in ('provision_admin', 'replace_admin', 'owner_handoff', 'owner_recovery') then
    raise exception 'arg2_created_identity_not_expected';
  end if;
  if v_command.state = 'cancelled'
     or v_command.stage not in ('prepared', 'awaiting_credential') then
    raise exception 'arg2_created_identity_command_not_open';
  end if;
  if p_external_receipt_hash !~ '^[0-9a-f]{64}$' then raise exception 'arg2_invalid_external_receipt'; end if;
  if p_target_email_hash <> v_command.target_email_hash then raise exception 'arg2_target_email_intent_mismatch'; end if;

  if v_command.action = 'owner_recovery' then
    if public.arg3b_internal_recovery_scope_digest(v_command.id)
       is distinct from v_command.safe_context ->> 'recovery_scope_digest' then
      raise exception 'arg3b_recovery_scope_integrity_failed';
    end if;
    if v_command.expires_at <= pg_catalog.transaction_timestamp()
       or p_target_user_id = v_command.actor_user_id
       or (select pg_catalog.count(*) from public.account_recovery_custodians where status = 'active') <> 2
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
           and approvals.custodian_user_id is distinct from p_target_user_id
       ) <> 2
       or not exists (
         select 1 from public.account_recovery_approvals approvals
         join public.account_recovery_custodians custodians
           on custodians.auth_user_id = approvals.custodian_user_id
          and custodians.status = 'active'
          and custodians.authority_version = approvals.authority_version
         where approvals.command_id = v_command.id
           and approvals.custodian_user_id = v_command.actor_user_id
       ) then
      raise exception 'arg2_recovery_identity_or_approval_boundary_failed';
    end if;

    select pg_catalog.count(*)::integer into v_scope_count
    from public.account_owner_recovery_scopes where command_id = v_command.id;
    if v_scope_count < 1 then raise exception 'arg3b_recovery_scope_missing'; end if;

    if v_command.target_user_id is not null then
      if v_command.target_user_id <> p_target_user_id then raise exception 'arg2_external_result_conflict'; end if;
      select pg_catalog.count(*)::integer into v_bound_count
      from public.account_owner_recovery_scopes scope
      join public.center_members target
        on target.id = scope.target_membership_id
       and target.center_id = scope.center_id
       and target.user_id = p_target_user_id
       and target.role = 'owner_candidate'
       and target.status = 'pending_credential'
      join public.account_credential_gates gate
        on gate.membership_id = target.id
       and gate.center_id = target.center_id
       and gate.user_id = target.user_id
       and gate.command_id = v_command.id
      where scope.command_id = v_command.id;
      if v_bound_count <> v_scope_count then raise exception 'arg3b_recovery_candidate_scope_incomplete'; end if;
      if v_command.state = 'repair_required' and v_command.stage = 'awaiting_credential' then
        update public.account_governance_commands
        set external_attempt_count = external_attempt_count + 1,
            external_receipt_hash = p_external_receipt_hash,
            state = 'prepared', repair_code = null,
            updated_at = pg_catalog.transaction_timestamp()
        where id = v_command.id;
        perform public.arg2_internal_append_event(
          v_command.id, 'CANDIDATE_CREDENTIAL_REISSUED', v_command.actor_user_id, p_target_user_id,
          pg_catalog.jsonb_build_object(
            'receipt_hash', p_external_receipt_hash,
            'affected_center_count', v_scope_count
          )
        );
        return pg_catalog.jsonb_build_object(
          'ok', true, 'replayed', false, 'reissued', true, 'command_id', v_command.id,
          'membership_id', v_command.target_membership_id, 'stage', 'awaiting_credential',
          'affected_center_count', v_scope_count,
          'affected_centers', public.arg3b_internal_recovery_scope_centers(v_command.id)
        );
      end if;
      if v_command.external_receipt_hash <> p_external_receipt_hash then
        raise exception 'arg2_external_result_conflict';
      end if;
      return pg_catalog.jsonb_build_object(
        'ok', true, 'replayed', true, 'command_id', v_command.id,
        'membership_id', v_command.target_membership_id, 'stage', v_command.stage,
        'affected_center_count', v_scope_count,
        'affected_centers', public.arg3b_internal_recovery_scope_centers(v_command.id)
      );
    end if;

    if exists (select 1 from public.account_governance_subjects where auth_user_id = p_target_user_id)
       or exists (select 1 from public.center_members where user_id = p_target_user_id) then
      raise exception 'arg2_new_identity_required';
    end if;

    insert into public.account_governance_subjects(auth_user_id, first_center_id)
    values (p_target_user_id, v_command.center_id);

    for v_scope in
      select * from public.account_owner_recovery_scopes
      where command_id = v_command.id order by scope_ordinal for update
    loop
      insert into public.center_members(center_id, user_id, role, status)
      values (v_scope.center_id, p_target_user_id, 'owner_candidate', 'pending_credential')
      returning id into v_membership_id;

      insert into public.account_credential_gates(
        membership_id, center_id, user_id, credential_state, command_id
      ) values (v_membership_id, v_scope.center_id, p_target_user_id, 'temporary', v_command.id);

      update public.account_owner_recovery_scopes
      set target_membership_id = v_membership_id
      where command_id = v_command.id and center_id = v_scope.center_id;

      if v_scope.center_id = v_command.center_id then
        v_anchor_membership_id := v_membership_id;
      end if;
    end loop;

    if v_anchor_membership_id is null then raise exception 'arg3b_recovery_anchor_scope_missing'; end if;
    update public.account_governance_commands
    set target_user_id = p_target_user_id,
        target_membership_id = v_anchor_membership_id,
        external_attempt_count = external_attempt_count + 1,
        external_receipt_hash = p_external_receipt_hash,
        state = 'prepared', stage = 'awaiting_credential', repair_code = null,
        updated_at = pg_catalog.transaction_timestamp()
    where id = v_command.id;

    perform public.arg2_internal_append_event(
      v_command.id, 'EXTERNAL_IDENTITY_CREATED', v_command.actor_user_id, p_target_user_id,
      pg_catalog.jsonb_build_object(
        'receipt_hash', p_external_receipt_hash,
        'affected_center_count', v_scope_count,
        'recovery_scope_digest', v_command.safe_context ->> 'recovery_scope_digest'
      )
    );
    return pg_catalog.jsonb_build_object(
      'ok', true, 'replayed', false, 'command_id', v_command.id,
      'membership_id', v_anchor_membership_id, 'stage', 'awaiting_credential',
      'affected_center_count', v_scope_count,
      'affected_centers', public.arg3b_internal_recovery_scope_centers(v_command.id)
    );
  end if;

  -- Non-recovery account creation retains the frozen ARG-2/ARG-3B behavior.
  if v_command.target_user_id is not null then
    if v_command.target_user_id <> p_target_user_id then raise exception 'arg2_external_result_conflict'; end if;
    if v_command.state = 'repair_required' and v_command.stage = 'awaiting_credential' then
      update public.account_governance_commands
      set external_attempt_count = external_attempt_count + 1,
          external_receipt_hash = p_external_receipt_hash,
          state = 'prepared', repair_code = null,
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
    if v_command.external_receipt_hash <> p_external_receipt_hash then raise exception 'arg2_external_result_conflict'; end if;
    return pg_catalog.jsonb_build_object(
      'ok', true, 'replayed', true, 'command_id', v_command.id,
      'membership_id', v_command.target_membership_id, 'stage', v_command.stage
    );
  end if;

  if exists (select 1 from public.account_governance_subjects where auth_user_id = p_target_user_id)
     or exists (select 1 from public.center_members where user_id = p_target_user_id) then
    raise exception 'arg2_new_identity_required';
  end if;
  v_role := case when v_command.action = 'owner_handoff' then 'owner_candidate' else 'center_admin' end;
  insert into public.account_governance_subjects(auth_user_id, first_center_id)
  values (p_target_user_id, v_command.center_id);
  insert into public.center_members(center_id, user_id, role, status)
  values (v_command.center_id, p_target_user_id, v_role, 'pending_credential')
  returning id into v_membership_id;
  insert into public.account_credential_gates(
    membership_id, center_id, user_id, credential_state, command_id
  ) values (v_membership_id, v_command.center_id, p_target_user_id, 'temporary', v_command.id);
  update public.account_governance_commands
  set target_user_id = p_target_user_id,
      target_membership_id = v_membership_id,
      external_attempt_count = external_attempt_count + 1,
      external_receipt_hash = p_external_receipt_hash,
      state = 'prepared', stage = 'awaiting_credential', repair_code = null,
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

create function public.arg3b_internal_sync_recovery_credential_gates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $arg3b_internal_sync_recovery_credential_gates$
begin
  if pg_catalog.pg_trigger_depth() > 1
     or new.command_id is null
     or new.credential_state <> 'ready'
     or old.credential_state = 'ready'
     or not exists (
       select 1 from public.account_governance_commands command
       where command.id = new.command_id and command.action = 'owner_recovery'
     ) then
    return new;
  end if;

  update public.account_credential_gates gate
  set credential_state = 'ready',
      credential_version = credential_version + 1,
      updated_at = pg_catalog.transaction_timestamp()
  from public.account_owner_recovery_scopes scope
  where scope.command_id = new.command_id
    and gate.membership_id = scope.target_membership_id
    and gate.command_id = new.command_id
    and gate.credential_state <> 'ready';
  return new;
end;
$arg3b_internal_sync_recovery_credential_gates$;

create trigger arg3b_sync_recovery_credential_gates
after update of credential_state on public.account_credential_gates
for each row execute function public.arg3b_internal_sync_recovery_credential_gates();

revoke all on function public.arg3b_internal_sync_recovery_credential_gates()
  from public, anon, authenticated, service_role;

create or replace function public.arg2_execute_owner_swap(
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
  v_predecessor public.center_members%rowtype;
  v_scope public.account_owner_recovery_scopes%rowtype;
  v_approval_count integer;
  v_scope_count integer;
  v_current_scope_count integer;
  v_changed_count integer;
begin
  perform public.arg2_internal_require_service_role();
  select * into v_command from public.account_governance_commands
  where id = p_command_id for update;
  if not found or v_command.action not in ('owner_handoff', 'owner_recovery') then
    raise exception 'arg2_owner_swap_command_not_found';
  end if;
  if v_command.state = 'finalized' and v_command.stage = 'complete' then
    return pg_catalog.jsonb_build_object(
      'ok', true, 'replayed', true, 'state', 'finalized', 'stage', 'complete',
      'affected_center_count', case when v_command.action = 'owner_recovery'
        then (v_command.safe_context ->> 'affected_center_count')::integer else 1 end,
      'affected_centers', case when v_command.action = 'owner_recovery'
        then public.arg3b_internal_recovery_scope_centers(v_command.id)
        else pg_catalog.jsonb_build_array(v_command.center_id) end
    );
  end if;
  if v_command.state <> 'prepared' or v_command.stage <> 'target_ready'
     or v_command.expires_at <= pg_catalog.transaction_timestamp() then
    raise exception 'arg2_owner_swap_not_ready';
  end if;

  if v_command.action = 'owner_handoff' then
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
    ) then raise exception 'arg2_owner_predecessor_stale'; end if;
    if p_executor_user_id <> v_command.actor_user_id
       or p_executor_user_id = v_command.target_user_id then
      raise exception 'arg2_current_owner_must_finalize_handoff';
    end if;
    select * into v_target from public.center_members
    where id = v_command.target_membership_id
      and center_id = v_command.center_id
      and user_id = v_command.target_user_id
      and role = 'owner_candidate' and status = 'pending_credential'
    for update;
    if not found then raise exception 'arg2_owner_candidate_mismatch'; end if;
    update public.center_members set role = 'former_owner', status = 'revoked'
    where id = v_command.predecessor_membership_id;
    update public.center_members set role = 'owner', status = 'active'
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
  end if;

  if not exists (
    select 1 from public.account_recovery_custodians
    where auth_user_id = p_executor_user_id and status = 'active'
  ) or p_executor_user_id = v_command.target_user_id then
    raise exception 'arg2_active_recovery_custodian_required';
  end if;
  if (select pg_catalog.count(*) from public.account_recovery_custodians where status = 'active') <> 2 then
    raise exception 'arg3b_exactly_two_active_recovery_custodians_required';
  end if;
  select pg_catalog.count(*)::integer into v_approval_count
  from public.account_recovery_approvals approvals
  join public.account_recovery_custodians custodians
    on custodians.auth_user_id = approvals.custodian_user_id
   and custodians.status = 'active'
   and custodians.authority_version = approvals.authority_version
  where approvals.command_id = v_command.id
    and approvals.custodian_user_id is distinct from v_command.target_user_id;
  if v_approval_count <> 2 or not exists (
    select 1 from public.account_recovery_approvals approvals
    join public.account_recovery_custodians custodians
      on custodians.auth_user_id = approvals.custodian_user_id
     and custodians.status = 'active'
     and custodians.authority_version = approvals.authority_version
    where approvals.command_id = v_command.id
      and approvals.custodian_user_id = v_command.actor_user_id
  ) then raise exception 'arg2_two_custodian_approvals_required'; end if;
  if public.arg3b_internal_recovery_scope_digest(v_command.id)
     is distinct from v_command.safe_context ->> 'recovery_scope_digest' then
    raise exception 'arg3b_recovery_scope_integrity_failed';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_command.predecessor_user_id::text, 730320260906)
  );
  select pg_catalog.count(*)::integer into v_scope_count
  from public.account_owner_recovery_scopes where command_id = v_command.id;
  select pg_catalog.count(*)::integer into v_current_scope_count
  from public.center_access_governance control
  join public.center_members owner_membership
    on owner_membership.id = control.canonical_owner_membership_id
   and owner_membership.center_id = control.center_id
  where control.status = 'active'
    and owner_membership.user_id = v_command.predecessor_user_id
    and owner_membership.role = 'owner'
    and owner_membership.status = 'active';
  if v_scope_count < 1 or v_scope_count <> v_current_scope_count
     or exists (
       select 1
       from public.center_access_governance control
       join public.center_members owner_membership
         on owner_membership.id = control.canonical_owner_membership_id
        and owner_membership.center_id = control.center_id
       where control.status = 'active'
         and owner_membership.user_id = v_command.predecessor_user_id
         and owner_membership.role = 'owner'
         and owner_membership.status = 'active'
         and not exists (
           select 1 from public.account_owner_recovery_scopes scope
           where scope.command_id = v_command.id and scope.center_id = control.center_id
         )
     ) then
    raise exception 'arg3b_recovery_scope_changed';
  end if;

  for v_scope in
    select * from public.account_owner_recovery_scopes
    where command_id = v_command.id order by scope_ordinal for update
  loop
    select * into v_control from public.center_access_governance
    where center_id = v_scope.center_id for update;
    if not found or v_control.status <> 'active'
       or v_control.governance_version <> v_scope.expected_governance_version
       or v_control.canonical_owner_membership_id <> v_scope.predecessor_membership_id then
      raise exception 'arg3b_recovery_scope_governance_stale';
    end if;
    select * into v_predecessor from public.center_members
    where id = v_scope.predecessor_membership_id and center_id = v_scope.center_id for update;
    if not found or v_predecessor.user_id <> v_command.predecessor_user_id
       or v_predecessor.role <> 'owner' or v_predecessor.status <> 'active'
       or v_predecessor.membership_version <> v_scope.expected_membership_version then
      raise exception 'arg3b_recovery_scope_predecessor_stale';
    end if;
    select * into v_target from public.center_members
    where id = v_scope.target_membership_id and center_id = v_scope.center_id for update;
    if not found or v_target.user_id <> v_command.target_user_id
       or v_target.role <> 'owner_candidate' or v_target.status <> 'pending_credential' then
      raise exception 'arg3b_recovery_scope_candidate_stale';
    end if;
    if not exists (
      select 1 from public.account_credential_gates gate
      where gate.membership_id = v_target.id
        and gate.center_id = v_scope.center_id
        and gate.user_id = v_command.target_user_id
        and gate.command_id = v_command.id
        and gate.credential_state = 'ready'
    ) then raise exception 'arg3b_recovery_scope_credential_not_ready'; end if;
  end loop;

  update public.center_members membership
  set role = 'former_owner', status = 'revoked'
  from public.account_owner_recovery_scopes scope
  where scope.command_id = v_command.id
    and membership.id = scope.predecessor_membership_id
    and membership.center_id = scope.center_id;
  get diagnostics v_changed_count = row_count;
  if v_changed_count <> v_scope_count then raise exception 'arg3b_recovery_predecessor_swap_incomplete'; end if;

  update public.center_members membership
  set role = 'owner', status = 'active'
  from public.account_owner_recovery_scopes scope
  where scope.command_id = v_command.id
    and membership.id = scope.target_membership_id
    and membership.center_id = scope.center_id;
  get diagnostics v_changed_count = row_count;
  if v_changed_count <> v_scope_count then raise exception 'arg3b_recovery_target_swap_incomplete'; end if;

  update public.center_access_governance control
  set canonical_owner_membership_id = scope.target_membership_id,
      governance_version = control.governance_version + 1,
      updated_at = pg_catalog.transaction_timestamp()
  from public.account_owner_recovery_scopes scope
  where scope.command_id = v_command.id and control.center_id = scope.center_id;
  get diagnostics v_changed_count = row_count;
  if v_changed_count <> v_scope_count then raise exception 'arg3b_recovery_governance_swap_incomplete'; end if;

  if exists (
    select 1 from public.account_owner_recovery_scopes scope
    where scope.command_id = v_command.id
      and (
        (select pg_catalog.count(*) from public.center_members membership
         where membership.center_id = scope.center_id
           and membership.role = 'owner' and membership.status = 'active') <> 1
        or not exists (
          select 1 from public.center_access_governance control
          join public.center_members owner_membership
            on owner_membership.id = control.canonical_owner_membership_id
           and owner_membership.center_id = control.center_id
          where control.center_id = scope.center_id
            and control.status = 'active'
            and owner_membership.user_id = v_command.target_user_id
            and owner_membership.role = 'owner'
            and owner_membership.status = 'active'
        )
      )
  ) then raise exception 'arg3b_exactly_one_owner_postcondition_failed'; end if;

  update public.account_governance_commands
  set stage = 'authority_swapped', state = 'repair_required',
      repair_code = 'predecessor_session_invalidation_required',
      updated_at = pg_catalog.transaction_timestamp()
  where id = v_command.id;
  perform public.arg2_internal_append_event(
    v_command.id, 'AUTHORITY_SWAPPED', p_executor_user_id, v_command.target_user_id,
    pg_catalog.jsonb_build_object(
      'affected_center_count', v_scope_count,
      'recovery_scope_digest', v_command.safe_context ->> 'recovery_scope_digest',
      'session_invalidation_required', true,
      'atomic_scope_swap', true
    )
  );
  return pg_catalog.jsonb_build_object(
    'ok', true, 'state', 'repair_required', 'stage', 'authority_swapped',
    'predecessor_user_id', v_command.predecessor_user_id,
    'affected_center_count', v_scope_count,
    'affected_centers', public.arg3b_internal_recovery_scope_centers(v_command.id),
    'recovery_scope_digest', v_command.safe_context ->> 'recovery_scope_digest'
  );
end;
$arg2_execute_owner_swap$;

revoke all on function public.arg2_execute_owner_swap(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.arg2_execute_owner_swap(uuid, uuid)
  to service_role;

create or replace function public.arg2_cancel_pending_command(
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
  v_scope_count integer;
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
  ) then raise exception 'arg2_active_recovery_custodian_required'; end if;
  if v_command.target_user_id is not null
     and p_session_invalidation_receipt_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'arg2_session_invalidation_required_before_cancel';
  end if;

  if v_command.action = 'owner_recovery' then
    if public.arg3b_internal_recovery_scope_digest(v_command.id)
       is distinct from v_command.safe_context ->> 'recovery_scope_digest' then
      raise exception 'arg3b_recovery_scope_integrity_failed';
    end if;
    select pg_catalog.count(*)::integer into v_scope_count
    from public.account_owner_recovery_scopes where command_id = v_command.id;
    update public.center_members membership
    set status = 'revoked'
    from public.account_owner_recovery_scopes scope
    where scope.command_id = v_command.id
      and scope.target_membership_id is not null
      and membership.id = scope.target_membership_id
      and membership.center_id = scope.center_id;
    update public.account_credential_gates gate
    set credential_state = 'locked', credential_version = credential_version + 1,
        updated_at = pg_catalog.transaction_timestamp()
    from public.account_owner_recovery_scopes scope
    where scope.command_id = v_command.id
      and scope.target_membership_id is not null
      and gate.membership_id = scope.target_membership_id;
  else
    v_scope_count := 1;
    if v_command.target_membership_id is not null then
      update public.center_members set status = 'revoked'
      where id = v_command.target_membership_id;
      update public.account_credential_gates
      set credential_state = 'locked', credential_version = credential_version + 1,
          updated_at = pg_catalog.transaction_timestamp()
      where membership_id = v_command.target_membership_id;
    end if;
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
      'receipt_hash', p_session_invalidation_receipt_hash,
      'affected_center_count', v_scope_count
    )
  );
  return pg_catalog.jsonb_build_object(
    'ok', true, 'state', 'cancelled', 'stage', v_command.stage,
    'affected_center_count', v_scope_count,
    'affected_centers', case when v_command.action = 'owner_recovery'
      then public.arg3b_internal_recovery_scope_centers(v_command.id)
      else pg_catalog.jsonb_build_array(v_command.center_id) end
  );
end;
$arg2_cancel_pending_command$;

revoke all on function public.arg2_cancel_pending_command(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.arg2_cancel_pending_command(uuid, uuid, text)
  to service_role;

create or replace function public.arg2_get_command_execution_context(
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
  v_scope_count integer;
begin
  perform public.arg2_internal_require_service_role();
  select * into v_command from public.account_governance_commands
  where id = p_command_id for share;
  if not found then raise exception 'arg2_command_not_found'; end if;
  if v_command.action <> 'owner_recovery' then
    perform public.arg2_internal_assert_owner(v_command.center_id, p_actor_user_id);
  elsif not exists (
    select 1 from public.account_recovery_custodians
    where auth_user_id = p_actor_user_id and status = 'active'
  ) then raise exception 'arg2_active_recovery_custodian_required'; end if;

  if v_command.action = 'owner_recovery' then
    if public.arg3b_internal_recovery_scope_digest(v_command.id)
       is distinct from v_command.safe_context ->> 'recovery_scope_digest' then
      raise exception 'arg3b_recovery_scope_integrity_failed';
    end if;
    select pg_catalog.count(*)::integer into v_scope_count
    from public.account_owner_recovery_scopes where command_id = v_command.id;
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
    'recovery_approval_count', case when v_command.action = 'owner_recovery' then case
      when (select pg_catalog.count(*) from public.account_recovery_custodians where status = 'active') = 2
       and exists (
         select 1 from public.account_recovery_approvals requester_approval
         join public.account_recovery_custodians requester
           on requester.auth_user_id = requester_approval.custodian_user_id
          and requester.status = 'active'
          and requester.authority_version = requester_approval.authority_version
         where requester_approval.command_id = v_command.id
           and requester_approval.custodian_user_id = v_command.actor_user_id
       ) then (
        select pg_catalog.count(*) from public.account_recovery_approvals approvals
        join public.account_recovery_custodians custodians
          on custodians.auth_user_id = approvals.custodian_user_id
         and custodians.status = 'active'
         and custodians.authority_version = approvals.authority_version
        where approvals.command_id = v_command.id
          and approvals.custodian_user_id is distinct from v_command.target_user_id
      ) else 0 end else null end,
    'affected_center_count', case when v_command.action = 'owner_recovery' then v_scope_count else 1 end,
    'affected_centers', case when v_command.action = 'owner_recovery'
      then public.arg3b_internal_recovery_scope_centers(v_command.id)
      else pg_catalog.jsonb_build_array(v_command.center_id) end,
    'recovery_scope_digest', case when v_command.action = 'owner_recovery'
      then v_command.safe_context ->> 'recovery_scope_digest' else null end
  );
end;
$arg2_get_command_execution_context$;

revoke all on function public.arg2_get_command_execution_context(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.arg2_get_command_execution_context(uuid, uuid)
  to service_role;

comment on table public.account_owner_recovery_scopes is
  'ARG-3B FIX2 frozen complete governed-center scope for one coordinated shared-Owner recovery command.';
comment on function public.arg2_prepare_owner_recovery(
  text, text, text, uuid, bigint, text, text, text, timestamptz
) is 'ARG-3B: FIX2 exactly two custodians attest one server-derived complete shared-Owner center scope.';
comment on function public.arg2_execute_owner_swap(uuid, uuid) is
  'ARG-3B: FIX2 emergency recovery swaps every frozen shared-Owner center atomically; single-center recovery remains supported.';

commit;
