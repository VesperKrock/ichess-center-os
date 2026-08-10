-- F23.3E-P1C: service-role-only Audit read and durable Outbox delivery state.
-- This migration adds database primitives only. It performs no external delivery,
-- browser wiring, Auth change, Edge Function change, worker deployment, or remote apply.

begin;

set local check_function_bodies = true;

do $f23_3e_p1c_prerequisites$
begin
  if pg_catalog.to_regclass('public.center_crm_control') is null
     or pg_catalog.to_regclass('public.crm_audit_event') is null
     or pg_catalog.to_regclass('public.crm_outbox_event') is null then
    raise exception 'f23_3e_p1c_missing_p1a_prerequisite';
  end if;

  if pg_catalog.to_regprocedure('pg_catalog.gen_random_uuid()') is null then
    raise exception 'f23_3e_p1c_missing_prerequisite: pg_catalog.gen_random_uuid()';
  end if;

  if pg_catalog.to_regprocedure('public.f23_3e_p1b_internal_enforce_outbox_delivery_version()') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p1b_internal_guard_outbox_lifecycle()') is null then
    raise exception 'f23_3e_p1c_missing_p1b_outbox_prerequisite';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute a
    where a.attrelid = 'public.crm_outbox_event'::regclass
      and a.attname = 'delivery_version'
      and a.atttypid = 'integer'::regtype
      and a.attnotnull
      and not a.attisdropped
  ) then
    raise exception 'f23_3e_p1c_prerequisite_drift: crm_outbox_event.delivery_version';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_roles r where r.rolname = 'service_role'
  ) then
    raise exception 'f23_3e_p1c_missing_prerequisite: service_role';
  end if;
end;
$f23_3e_p1c_prerequisites$;

alter table public.crm_outbox_event
  add column last_attempt_at timestamptz,
  add column last_failure_code text,
  add column dead_lettered_at timestamptz,
  add constraint crm_outbox_event_attempt_ceiling_check
    check (attempt_count <= 5),
  add constraint crm_outbox_event_attempt_timestamp_check
    check (
      (attempt_count = 0 and last_attempt_at is null)
      or (attempt_count > 0 and last_attempt_at is not null)
    ),
  add constraint crm_outbox_event_last_failure_code_check
    check (
      last_failure_code is null
      or (
        attempt_count > 0
        and last_failure_code ~ '^[a-z0-9][a-z0-9._-]{0,63}$'
      )
    ),
  add constraint crm_outbox_event_dead_letter_timestamp_check
    check ((delivery_status = 'DEAD_LETTER') = (dead_lettered_at is not null)),
  add constraint crm_outbox_event_operational_timestamp_order_check
    check (
      (last_attempt_at is null or last_attempt_at >= created_at)
      and (dead_lettered_at is null or dead_lettered_at >= created_at)
    );

create index crm_audit_event_center_keyset_idx
  on public.crm_audit_event (center_id, created_at, audit_event_id);

create index crm_outbox_event_center_delivery_queue_idx
  on public.crm_outbox_event (center_id, available_at, created_at, outbox_event_id)
  where delivery_status in ('PENDING', 'RETRY');

create index crm_outbox_event_center_expired_claim_idx
  on public.crm_outbox_event (center_id, claim_expires_at, available_at, created_at, outbox_event_id)
  where delivery_status = 'CLAIMED';

drop trigger f23_3e_p1b_outbox_delivery_version on public.crm_outbox_event;
drop trigger f23_3e_p1b_outbox_lifecycle on public.crm_outbox_event;

create function public.f23_3e_p1c_internal_enforce_outbox_delivery_version()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1c_internal_enforce_outbox_delivery_version$
begin
  if new.delivery_version <> old.delivery_version + 1 then
    raise exception 'f23_3e_p1c_outbox_delivery_version_must_increment_by_one';
  end if;

  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$f23_3e_p1c_internal_enforce_outbox_delivery_version$;

create function public.f23_3e_p1c_internal_guard_outbox_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $f23_3e_p1c_internal_guard_outbox_lifecycle$
begin
  if tg_op = 'INSERT' then
    if new.event_version < 1
       or new.delivery_version <> 1
       or new.delivery_status <> 'PENDING'
       or new.attempt_count <> 0
       or new.claim_id is not null
       or new.claimed_by is not null
       or new.claim_expires_at is not null
       or new.delivered_at is not null
       or new.last_attempt_at is not null
       or new.last_failure_code is not null
       or new.dead_lettered_at is not null then
      raise exception 'f23_3e_p1c_outbox_must_start_pending_at_delivery_version_one';
    end if;
    return new;
  end if;

  if new.outbox_event_id is distinct from old.outbox_event_id
     or new.center_id is distinct from old.center_id
     or new.aggregate_kind is distinct from old.aggregate_kind
     or new.aggregate_id is distinct from old.aggregate_id
     or new.event_type is distinct from old.event_type
     or new.event_version is distinct from old.event_version
     or new.safe_payload is distinct from old.safe_payload
     or new.created_at is distinct from old.created_at then
    raise exception 'f23_3e_p1c_outbox_event_identity_version_and_payload_are_immutable';
  end if;

  if old.delivery_status in ('DELIVERED', 'DEAD_LETTER', 'CANCELLED') then
    raise exception 'f23_3e_p1c_terminal_outbox_event_is_immutable';
  end if;

  if not (
    (
      old.delivery_status in ('PENDING', 'RETRY')
      and new.delivery_status = 'CLAIMED'
      and new.attempt_count = old.attempt_count + 1
      and new.attempt_count <= 5
    )
    or (
      old.delivery_status = 'CLAIMED'
      and new.delivery_status = 'CLAIMED'
      and old.claim_expires_at <= pg_catalog.clock_timestamp()
      and new.claim_id is distinct from old.claim_id
      and new.attempt_count = old.attempt_count + 1
      and new.attempt_count <= 5
    )
    or (
      old.delivery_status = 'CLAIMED'
      and new.delivery_status in ('DELIVERED', 'RETRY', 'DEAD_LETTER', 'CANCELLED')
      and new.attempt_count = old.attempt_count
    )
    or (
      old.delivery_status in ('PENDING', 'RETRY')
      and new.delivery_status = 'CANCELLED'
      and new.attempt_count = old.attempt_count
    )
  ) then
    raise exception 'f23_3e_p1c_invalid_outbox_transition: % -> %', old.delivery_status, new.delivery_status;
  end if;

  return new;
end;
$f23_3e_p1c_internal_guard_outbox_lifecycle$;

create trigger f23_3e_p1c_outbox_delivery_version
before update on public.crm_outbox_event
for each row execute function public.f23_3e_p1c_internal_enforce_outbox_delivery_version();

create trigger f23_3e_p1c_outbox_lifecycle
before insert or update on public.crm_outbox_event
for each row execute function public.f23_3e_p1c_internal_guard_outbox_lifecycle();

create function public.f23_3e_p1c_list_crm_audit_events(
  p_center_id text,
  p_after_created_at timestamptz default null,
  p_after_audit_event_id uuid default null,
  p_limit integer default 50
)
returns table (
  audit_event_id uuid,
  center_id text,
  event_type text,
  actor_user_id uuid,
  resource_kind text,
  resource_id uuid,
  request_id uuid,
  assignment_id uuid,
  previous_version integer,
  new_version integer,
  safe_reason_code text,
  correlation_id uuid,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $f23_3e_p1c_list_crm_audit_events$
begin
  if p_center_id is null or pg_catalog.btrim(p_center_id) = ''
     or p_limit is null or p_limit < 1 or p_limit > 100 then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;

  if (p_after_created_at is null) <> (p_after_audit_event_id is null) then
    raise exception using message = 'INVALID_CURSOR', errcode = 'P0001';
  end if;

  return query
  select
    a.audit_event_id,
    a.center_id,
    a.event_type,
    a.actor_user_id,
    a.resource_kind,
    a.resource_id,
    a.request_id,
    a.assignment_id,
    a.previous_version,
    a.new_version,
    a.safe_reason_code,
    a.correlation_id,
    a.created_at
  from public.crm_audit_event a
  where a.center_id = p_center_id
    and (
      p_after_created_at is null
      or a.created_at > p_after_created_at
      or (
        a.created_at = p_after_created_at
        and a.audit_event_id > p_after_audit_event_id
      )
    )
  order by a.created_at asc, a.audit_event_id asc
  limit p_limit;
end;
$f23_3e_p1c_list_crm_audit_events$;

create function public.f23_3e_p1c_claim_outbox_batch(
  p_center_id text,
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer
)
returns table (
  outbox_event_id uuid,
  center_id text,
  aggregate_kind text,
  aggregate_id uuid,
  event_type text,
  event_version integer,
  safe_payload jsonb,
  claim_id uuid,
  claimed_by text,
  claim_expires_at timestamptz,
  attempt_count integer,
  delivery_version integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $f23_3e_p1c_claim_outbox_batch$
declare
  v_root public.center_crm_control%rowtype;
  v_now timestamptz;
begin
  if p_center_id is null or pg_catalog.btrim(p_center_id) = ''
     or p_worker_id is null or p_worker_id !~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$'
     or p_limit is null or p_limit < 1 or p_limit > 100
     or p_lease_seconds is null or p_lease_seconds < 5 or p_lease_seconds > 300 then
    raise exception using message = 'INVALID_INPUT', errcode = 'P0001';
  end if;

  select r.* into v_root
  from public.center_crm_control r
  where r.center_id = p_center_id
  for share;

  if not found
     or v_root.crm_state <> 'ACTIVE'
     or v_root.feature_flag_state <> 'ENABLED' then
    raise exception using message = 'CRM_RUNTIME_NOT_ACTIVE', errcode = 'P0001';
  end if;

  v_now := pg_catalog.clock_timestamp();

  -- Expired fifth attempts cannot become a sixth attempt. The current call
  -- deterministically terminalizes them before selecting a new batch.
  with expired_at_ceiling as (
    select o.outbox_event_id
    from public.crm_outbox_event o
    where o.center_id = p_center_id
      and o.delivery_status = 'CLAIMED'
      and o.claim_expires_at <= v_now
      and o.attempt_count >= 5
    order by o.claim_expires_at asc, o.outbox_event_id asc
    for update skip locked
  )
  update public.crm_outbox_event o
  set delivery_status = 'DEAD_LETTER',
      claim_id = null,
      claimed_by = null,
      claim_expires_at = null,
      dead_lettered_at = v_now,
      last_failure_code = 'lease_expired_after_max_attempts',
      delivery_version = o.delivery_version + 1
  from expired_at_ceiling e
  where o.outbox_event_id = e.outbox_event_id;

  return query
  with eligible as (
    select o.outbox_event_id
    from public.crm_outbox_event o
    where o.center_id = p_center_id
      and o.attempt_count < 5
      and (
        (
          o.delivery_status in ('PENDING', 'RETRY')
          and o.available_at <= v_now
        )
        or (
          o.delivery_status = 'CLAIMED'
          and o.claim_expires_at <= v_now
        )
      )
    order by o.available_at asc, o.created_at asc, o.outbox_event_id asc
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.crm_outbox_event o
    set delivery_status = 'CLAIMED',
        claim_id = pg_catalog.gen_random_uuid(),
        claimed_by = p_worker_id,
        claim_expires_at = v_now + (p_lease_seconds * interval '1 second'),
        attempt_count = o.attempt_count + 1,
        last_attempt_at = v_now,
        last_failure_code = null,
        dead_lettered_at = null,
        delivery_version = o.delivery_version + 1
    from eligible e
    where o.outbox_event_id = e.outbox_event_id
    returning o.*
  )
  select
    c.outbox_event_id,
    c.center_id,
    c.aggregate_kind,
    c.aggregate_id,
    c.event_type,
    c.event_version,
    c.safe_payload,
    c.claim_id,
    c.claimed_by,
    c.claim_expires_at,
    c.attempt_count,
    c.delivery_version
  from claimed c
  order by c.available_at asc, c.created_at asc, c.outbox_event_id asc;
end;
$f23_3e_p1c_claim_outbox_batch$;

-- ACK_OUTBOX_RUNTIME_ATOMIC_BEGIN
-- 0. CENTER_CRM_CONTROL_ROW
-- 1. OUTBOX_EVENT_ROW
-- 2. COMMIT_ATOMIC
-- ACK_OUTBOX_RUNTIME_ATOMIC_END
create function public.f23_3e_p1c_ack_outbox_delivered(
  p_outbox_event_id uuid,
  p_claim_id uuid,
  p_worker_id text,
  p_expected_delivery_version integer
)
returns table (
  ok boolean,
  outcome_code text,
  outbox_event_id uuid,
  delivery_status text,
  attempt_count integer,
  delivery_version integer,
  available_at timestamptz,
  delivered_at timestamptz,
  dead_lettered_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $f23_3e_p1c_ack_outbox_delivered$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_event public.crm_outbox_event%rowtype;
  v_now timestamptz;
begin
  if p_outbox_event_id is null
     or p_claim_id is null
     or p_worker_id is null or p_worker_id !~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$'
     or p_expected_delivery_version is null or p_expected_delivery_version < 1 then
    return query select false, 'INVALID_INPUT'::text, p_outbox_event_id,
      null::text, null::integer, null::integer, null::timestamptz,
      null::timestamptz, null::timestamptz;
    return;
  end if;

  select o.center_id into v_center_id
  from public.crm_outbox_event o
  where o.outbox_event_id = p_outbox_event_id;

  if not found then
    return query select false, 'RESOURCE_NOT_FOUND'::text, p_outbox_event_id,
      null::text, null::integer, null::integer, null::timestamptz,
      null::timestamptz, null::timestamptz;
    return;
  end if;

  select r.* into v_root
  from public.center_crm_control r
  where r.center_id = v_center_id
  for share;

  if not found
     or v_root.crm_state <> 'ACTIVE'
     or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE'::text, p_outbox_event_id,
      null::text, null::integer, null::integer, null::timestamptz,
      null::timestamptz, null::timestamptz;
    return;
  end if;

  select o.* into v_event
  from public.crm_outbox_event o
  where o.outbox_event_id = p_outbox_event_id
  for update;

  if not found then
    return query select false, 'RESOURCE_NOT_FOUND'::text, p_outbox_event_id,
      null::text, null::integer, null::integer, null::timestamptz,
      null::timestamptz, null::timestamptz;
    return;
  end if;

  v_now := pg_catalog.clock_timestamp();

  if v_event.center_id <> v_center_id then
    return query select false, 'OUTBOX_STATE_CONFLICT'::text, p_outbox_event_id,
      v_event.delivery_status, v_event.attempt_count, v_event.delivery_version,
      v_event.available_at, v_event.delivered_at, v_event.dead_lettered_at;
    return;
  end if;

  if v_event.delivery_version <> p_expected_delivery_version then
    return query select false, 'DELIVERY_VERSION_STALE'::text, p_outbox_event_id,
      v_event.delivery_status, v_event.attempt_count, v_event.delivery_version,
      v_event.available_at, v_event.delivered_at, v_event.dead_lettered_at;
    return;
  end if;

  if v_event.delivery_status <> 'CLAIMED' then
    return query select false, 'OUTBOX_STATE_CONFLICT'::text, p_outbox_event_id,
      v_event.delivery_status, v_event.attempt_count, v_event.delivery_version,
      v_event.available_at, v_event.delivered_at, v_event.dead_lettered_at;
    return;
  end if;

  if v_event.claim_id is distinct from p_claim_id
     or v_event.claimed_by is distinct from p_worker_id then
    return query select false, 'CLAIM_MISMATCH'::text, p_outbox_event_id,
      v_event.delivery_status, v_event.attempt_count, v_event.delivery_version,
      v_event.available_at, v_event.delivered_at, v_event.dead_lettered_at;
    return;
  end if;

  if v_event.claim_expires_at <= v_now then
    return query select false, 'CLAIM_EXPIRED'::text, p_outbox_event_id,
      v_event.delivery_status, v_event.attempt_count, v_event.delivery_version,
      v_event.available_at, v_event.delivered_at, v_event.dead_lettered_at;
    return;
  end if;

  update public.crm_outbox_event o
  set delivery_status = 'DELIVERED',
      delivered_at = v_now,
      delivery_version = o.delivery_version + 1
  where o.outbox_event_id = p_outbox_event_id
  returning o.* into v_event;

  return query select true, 'DELIVERED'::text, v_event.outbox_event_id,
    v_event.delivery_status, v_event.attempt_count, v_event.delivery_version,
    v_event.available_at, v_event.delivered_at, v_event.dead_lettered_at;
end;
$f23_3e_p1c_ack_outbox_delivered$;

-- FAIL_OUTBOX_RUNTIME_ATOMIC_BEGIN
-- 0. CENTER_CRM_CONTROL_ROW
-- 1. OUTBOX_EVENT_ROW
-- 2. COMMIT_ATOMIC
-- FAIL_OUTBOX_RUNTIME_ATOMIC_END
create function public.f23_3e_p1c_fail_outbox_delivery(
  p_outbox_event_id uuid,
  p_claim_id uuid,
  p_worker_id text,
  p_expected_delivery_version integer,
  p_failure_code text,
  p_retry_after_seconds integer
)
returns table (
  ok boolean,
  outcome_code text,
  outbox_event_id uuid,
  delivery_status text,
  attempt_count integer,
  delivery_version integer,
  available_at timestamptz,
  delivered_at timestamptz,
  dead_lettered_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $f23_3e_p1c_fail_outbox_delivery$
declare
  v_center_id text;
  v_root public.center_crm_control%rowtype;
  v_event public.crm_outbox_event%rowtype;
  v_now timestamptz;
begin
  if p_outbox_event_id is null
     or p_claim_id is null
     or p_worker_id is null or p_worker_id !~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$'
     or p_expected_delivery_version is null or p_expected_delivery_version < 1
     or p_failure_code is null or p_failure_code !~ '^[a-z0-9][a-z0-9._-]{0,63}$'
     or p_retry_after_seconds is null or p_retry_after_seconds < 1 or p_retry_after_seconds > 86400 then
    return query select false, 'INVALID_INPUT'::text, p_outbox_event_id,
      null::text, null::integer, null::integer, null::timestamptz,
      null::timestamptz, null::timestamptz;
    return;
  end if;

  select o.center_id into v_center_id
  from public.crm_outbox_event o
  where o.outbox_event_id = p_outbox_event_id;

  if not found then
    return query select false, 'RESOURCE_NOT_FOUND'::text, p_outbox_event_id,
      null::text, null::integer, null::integer, null::timestamptz,
      null::timestamptz, null::timestamptz;
    return;
  end if;

  select r.* into v_root
  from public.center_crm_control r
  where r.center_id = v_center_id
  for share;

  if not found
     or v_root.crm_state <> 'ACTIVE'
     or v_root.feature_flag_state <> 'ENABLED' then
    return query select false, 'CRM_RUNTIME_NOT_ACTIVE'::text, p_outbox_event_id,
      null::text, null::integer, null::integer, null::timestamptz,
      null::timestamptz, null::timestamptz;
    return;
  end if;

  select o.* into v_event
  from public.crm_outbox_event o
  where o.outbox_event_id = p_outbox_event_id
  for update;

  if not found then
    return query select false, 'RESOURCE_NOT_FOUND'::text, p_outbox_event_id,
      null::text, null::integer, null::integer, null::timestamptz,
      null::timestamptz, null::timestamptz;
    return;
  end if;

  v_now := pg_catalog.clock_timestamp();

  if v_event.center_id <> v_center_id then
    return query select false, 'OUTBOX_STATE_CONFLICT'::text, p_outbox_event_id,
      v_event.delivery_status, v_event.attempt_count, v_event.delivery_version,
      v_event.available_at, v_event.delivered_at, v_event.dead_lettered_at;
    return;
  end if;

  if v_event.delivery_version <> p_expected_delivery_version then
    return query select false, 'DELIVERY_VERSION_STALE'::text, p_outbox_event_id,
      v_event.delivery_status, v_event.attempt_count, v_event.delivery_version,
      v_event.available_at, v_event.delivered_at, v_event.dead_lettered_at;
    return;
  end if;

  if v_event.delivery_status <> 'CLAIMED' then
    return query select false, 'OUTBOX_STATE_CONFLICT'::text, p_outbox_event_id,
      v_event.delivery_status, v_event.attempt_count, v_event.delivery_version,
      v_event.available_at, v_event.delivered_at, v_event.dead_lettered_at;
    return;
  end if;

  if v_event.claim_id is distinct from p_claim_id
     or v_event.claimed_by is distinct from p_worker_id then
    return query select false, 'CLAIM_MISMATCH'::text, p_outbox_event_id,
      v_event.delivery_status, v_event.attempt_count, v_event.delivery_version,
      v_event.available_at, v_event.delivered_at, v_event.dead_lettered_at;
    return;
  end if;

  if v_event.claim_expires_at <= v_now then
    return query select false, 'CLAIM_EXPIRED'::text, p_outbox_event_id,
      v_event.delivery_status, v_event.attempt_count, v_event.delivery_version,
      v_event.available_at, v_event.delivered_at, v_event.dead_lettered_at;
    return;
  end if;

  if v_event.attempt_count < 5 then
    update public.crm_outbox_event o
    set delivery_status = 'RETRY',
        available_at = v_now + (p_retry_after_seconds * interval '1 second'),
        claim_id = null,
        claimed_by = null,
        claim_expires_at = null,
        last_failure_code = p_failure_code,
        delivery_version = o.delivery_version + 1
    where o.outbox_event_id = p_outbox_event_id
    returning o.* into v_event;

    return query select true, 'RETRY_SCHEDULED'::text, v_event.outbox_event_id,
      v_event.delivery_status, v_event.attempt_count, v_event.delivery_version,
      v_event.available_at, v_event.delivered_at, v_event.dead_lettered_at;
    return;
  end if;

  if v_event.attempt_count = 5 then
    update public.crm_outbox_event o
    set delivery_status = 'DEAD_LETTER',
        claim_id = null,
        claimed_by = null,
        claim_expires_at = null,
        dead_lettered_at = v_now,
        last_failure_code = p_failure_code,
        delivery_version = o.delivery_version + 1
    where o.outbox_event_id = p_outbox_event_id
    returning o.* into v_event;

    return query select true, 'DEAD_LETTERED'::text, v_event.outbox_event_id,
      v_event.delivery_status, v_event.attempt_count, v_event.delivery_version,
      v_event.available_at, v_event.delivered_at, v_event.dead_lettered_at;
    return;
  end if;

  return query select false, 'OUTBOX_STATE_CONFLICT'::text, p_outbox_event_id,
    v_event.delivery_status, v_event.attempt_count, v_event.delivery_version,
    v_event.available_at, v_event.delivered_at, v_event.dead_lettered_at;
end;
$f23_3e_p1c_fail_outbox_delivery$;

revoke all on function public.f23_3e_p1c_internal_enforce_outbox_delivery_version()
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1c_internal_guard_outbox_lifecycle()
  from public, anon, authenticated, service_role;

revoke all on function public.f23_3e_p1c_list_crm_audit_events(text, timestamptz, uuid, integer)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1c_claim_outbox_batch(text, text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1c_ack_outbox_delivered(uuid, uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.f23_3e_p1c_fail_outbox_delivery(uuid, uuid, text, integer, text, integer)
  from public, anon, authenticated;

grant execute on function public.f23_3e_p1c_list_crm_audit_events(text, timestamptz, uuid, integer)
  to service_role;
grant execute on function public.f23_3e_p1c_claim_outbox_batch(text, text, integer, integer)
  to service_role;
grant execute on function public.f23_3e_p1c_ack_outbox_delivered(uuid, uuid, text, integer)
  to service_role;
grant execute on function public.f23_3e_p1c_fail_outbox_delivery(uuid, uuid, text, integer, text, integer)
  to service_role;

comment on function public.f23_3e_p1c_list_crm_audit_events(text, timestamptz, uuid, integer) is
  'F23.3E-P1C exact-center typed immutable Audit projection with stable keyset pagination; protected service use only.';
comment on function public.f23_3e_p1c_claim_outbox_batch(text, text, integer, integer) is
  'F23.3E-P1C server-timed durable Outbox lease claim with bounded attempts and skip-locked multi-worker safety.';
comment on function public.f23_3e_p1c_ack_outbox_delivered(uuid, uuid, text, integer) is
  'F23.3E-P1C claim-bound delivered acknowledgement using delivery-version compare-and-set.';
comment on function public.f23_3e_p1c_fail_outbox_delivery(uuid, uuid, text, integer, text, integer) is
  'F23.3E-P1C claim-bound safe failure recording, relative retry scheduling, and fifth-attempt dead letter.';

-- P1C_OUTBOX_DATABASE_CLAIM_AT_MOST_ONE_ACTIVE_LEASE_PER_EVENT: YES
-- P1C_NETWORK_DELIVERY_EXACTLY_ONCE: NO
-- P1C_DELIVERY_MODEL: AT_LEAST_ONCE
-- P1C_CONSUMER_MUST_BE_IDEMPOTENT: YES

commit;
