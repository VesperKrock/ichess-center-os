begin;

-- ARG-3B forward-fix: emergency Owner recovery has exactly two custodians total.
-- The requester is attestation #1; one other active custodian is attestation #2.

do $arg3b_prerequisites$
begin
  if pg_catalog.to_regclass('public.account_recovery_custodians') is null
     or pg_catalog.to_regclass('public.account_recovery_approvals') is null
     or pg_catalog.to_regprocedure(
       'public.arg2_prepare_owner_recovery(text,text,text,uuid,bigint,text,text,text,timestamp with time zone)'
     ) is null
     or pg_catalog.to_regprocedure('public.arg2_approve_owner_recovery(uuid,uuid,bigint)') is null
     or pg_catalog.to_regprocedure('public.arg2_register_created_identity(uuid,uuid,text,text)') is null
     or pg_catalog.to_regprocedure('public.arg2_execute_owner_swap(uuid,uuid)') is null
     or pg_catalog.to_regprocedure('public.arg2_get_command_execution_context(uuid,uuid)') is null then
    raise exception 'arg3b_arg2_recovery_contract_missing';
  end if;

  if exists (
    select 1 from public.account_governance_commands where action = 'owner_recovery'
  ) or exists (select 1 from public.account_recovery_approvals) then
    raise exception 'arg3b_existing_recovery_state_requires_separate_review';
  end if;
end;
$arg3b_prerequisites$;

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
  v_command_id uuid;
  v_active_custodian_count integer;
  v_approval_count integer;
begin
  perform public.arg2_internal_require_service_role();

  select * into v_custodian
  from public.account_recovery_custodians
  where auth_user_id = p_requester_user_id and status = 'active'
  for share;
  if not found then raise exception 'arg2_active_recovery_custodian_required'; end if;

  select pg_catalog.count(*)::integer into v_active_custodian_count
  from public.account_recovery_custodians
  where status = 'active';
  if v_active_custodian_count <> 2 then
    raise exception 'arg3b_exactly_two_active_recovery_custodians_required';
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
    return pg_catalog.jsonb_build_object(
      'ok', true, 'replayed', true, 'command_id', v_existing.id,
      'state', v_existing.state, 'stage', v_existing.stage,
      'approval_count', v_approval_count, 'threshold_met', v_approval_count = 2
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

  insert into public.account_recovery_approvals(
    command_id, custodian_user_id, authority_version, decision
  ) values (
    v_command_id, p_requester_user_id, v_custodian.authority_version, 'approve'
  );

  perform public.arg2_internal_append_event(
    v_command_id, 'RECOVERY_REQUESTED', p_requester_user_id, null,
    pg_catalog.jsonb_build_object(
      'evidence_digest', p_evidence_digest,
      'expires_at', p_expires_at,
      'requester_attestation', true,
      'attestation_count', 1,
      'required_attestations', 2
    )
  );

  return pg_catalog.jsonb_build_object(
    'ok', true, 'replayed', false, 'command_id', v_command_id,
    'state', 'prepared', 'stage', 'prepared',
    'approval_count', 1, 'threshold_met', false
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
begin
  perform public.arg2_internal_require_service_role();
  select * into v_command from public.account_governance_commands
  where id = p_command_id for update;
  if not found or v_command.action <> 'owner_recovery' then raise exception 'arg2_recovery_not_found'; end if;
  if v_command.state <> 'prepared' or v_command.stage <> 'prepared'
     or v_command.expires_at <= pg_catalog.transaction_timestamp() then
    raise exception 'arg2_recovery_not_approvable';
  end if;

  select pg_catalog.count(*)::integer into v_active_custodian_count
  from public.account_recovery_custodians where status = 'active';
  if v_active_custodian_count <> 2 then
    raise exception 'arg3b_exactly_two_active_recovery_custodians_required';
  end if;

  if not exists (
    select 1
    from public.account_recovery_approvals approvals
    join public.account_recovery_custodians custodians
      on custodians.auth_user_id = approvals.custodian_user_id
     and custodians.status = 'active'
     and custodians.authority_version = approvals.authority_version
    where approvals.command_id = v_command.id
      and approvals.custodian_user_id = v_command.actor_user_id
  ) then
    raise exception 'arg3b_requester_attestation_stale_or_missing';
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
  where approvals.command_id = v_command.id
    and approvals.custodian_user_id is distinct from v_command.target_user_id;

  if v_inserted_count = 1 then
    perform public.arg2_internal_append_event(
      v_command.id, 'RECOVERY_APPROVED', p_custodian_user_id, v_command.target_user_id,
      pg_catalog.jsonb_build_object(
        'approval_count', v_approval_count,
        'attestation_count', v_approval_count
      )
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true, 'replayed', v_inserted_count = 0,
    'approval_count', v_approval_count, 'threshold_met', v_approval_count = 2
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

  if v_command.action = 'owner_recovery' and (
    v_command.expires_at <= pg_catalog.transaction_timestamp()
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
      select 1
      from public.account_recovery_approvals approvals
      join public.account_recovery_custodians custodians
        on custodians.auth_user_id = approvals.custodian_user_id
       and custodians.status = 'active'
       and custodians.authority_version = approvals.authority_version
      where approvals.command_id = v_command.id
        and approvals.custodian_user_id = v_command.actor_user_id
    )
  ) then
    raise exception 'arg2_recovery_identity_or_approval_boundary_failed';
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
      select 1
      from public.account_recovery_approvals approvals
      join public.account_recovery_custodians custodians
        on custodians.auth_user_id = approvals.custodian_user_id
       and custodians.status = 'active'
       and custodians.authority_version = approvals.authority_version
      where approvals.command_id = v_command.id
        and approvals.custodian_user_id = v_command.actor_user_id
    ) then
      raise exception 'arg2_two_custodian_approvals_required';
    end if;

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
    'recovery_approval_count', case when v_command.action = 'owner_recovery' then case
      when (select pg_catalog.count(*) from public.account_recovery_custodians where status = 'active') = 2
       and exists (
         select 1
         from public.account_recovery_approvals requester_approval
         join public.account_recovery_custodians requester
           on requester.auth_user_id = requester_approval.custodian_user_id
          and requester.status = 'active'
          and requester.authority_version = requester_approval.authority_version
         where requester_approval.command_id = v_command.id
           and requester_approval.custodian_user_id = v_command.actor_user_id
       ) then (
        select pg_catalog.count(*)
        from public.account_recovery_approvals approvals
        join public.account_recovery_custodians custodians
          on custodians.auth_user_id = approvals.custodian_user_id
         and custodians.status = 'active'
         and custodians.authority_version = approvals.authority_version
        where approvals.command_id = v_command.id
          and approvals.custodian_user_id is distinct from v_command.target_user_id
      )
      else 0
    end else null end
  );
end;
$arg2_get_command_execution_context$;

revoke all on function public.arg2_get_command_execution_context(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.arg2_get_command_execution_context(uuid, uuid)
  to service_role;

comment on function public.arg2_prepare_owner_recovery(
  text, text, text, uuid, bigint, text, text, text, timestamptz
) is 'ARG-3B: requester is attestation one; exactly one other active custodian supplies attestation two.';

commit;
