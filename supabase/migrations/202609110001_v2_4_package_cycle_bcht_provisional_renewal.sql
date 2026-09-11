begin;

-- V2-4 owns package-cycle usage and renewal state. V2-3 attendance payloads
-- remain tuition-neutral; their canonical occurrence identity is only input
-- evidence for the derived contribution ledger below.
do $$
begin
  if pg_catalog.to_regclass('public.centers') is null
     or pg_catalog.to_regclass('public.center_members') is null
     or pg_catalog.to_regclass('public.center_cloud_entities') is null
     or pg_catalog.to_regclass('public.center_tuition_package_catalog') is null
     or pg_catalog.to_regclass('public.finance_transaction') is null
     or pg_catalog.to_regprocedure('public.v2_3_get_attendance_capability(text)') is null
     or pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'v2_4_missing_prerequisite';
  end if;
end
$$;

create table public.center_tuition_package_cycles (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete restrict,
  student_local_id text not null,
  tuition_local_id text not null,
  cycle_number integer not null check (cycle_number >= 1),
  predecessor_cycle_id uuid references public.center_tuition_package_cycles(id) on delete restrict,
  package_catalog_id uuid references public.center_tuition_package_catalog(id) on delete restrict,
  package_name_snapshot text,
  total_sessions_snapshot integer check (total_sessions_snapshot between 1 and 1000),
  price_snapshot bigint check (price_snapshot between 0 and 9000000000000000),
  payment_period_id text not null check (char_length(payment_period_id) between 1 and 240),
  baseline_used_sessions integer not null default 0 check (baseline_used_sessions >= 0),
  baseline_cutoff_date date not null,
  baseline_review_note text not null default '' check (char_length(baseline_review_note) <= 2000),
  lifecycle_status text not null check (lifecycle_status in (
    'ACTIVE', 'PROVISIONAL_UNPAID', 'NEEDS_PACKAGE_SELECTION', 'SUPERSEDED'
  )),
  origin text not null check (origin in ('OPERATOR_BASELINE', 'AUTOMATIC_ROLLOVER')),
  bcht_status text not null default 'NOT_STARTED' check (bcht_status in (
    'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'
  )),
  bcht_note text not null default '' check (char_length(bcht_note) <= 2000),
  bcht_completed_at timestamptz,
  bcht_completed_by uuid references auth.users(id) on delete restrict,
  version bigint not null default 1 check (version >= 1),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint center_tuition_package_cycles_center_id_id_unique unique(center_id, id),
  constraint center_tuition_package_cycles_student_number_unique unique(center_id, student_local_id, cycle_number),
  constraint center_tuition_package_cycles_predecessor_unique unique(center_id, predecessor_cycle_id),
  constraint center_tuition_package_cycles_snapshot_check check (
    (lifecycle_status = 'NEEDS_PACKAGE_SELECTION'
      and package_catalog_id is null and package_name_snapshot is null
      and total_sessions_snapshot is null and price_snapshot is null)
    or
    (lifecycle_status <> 'NEEDS_PACKAGE_SELECTION'
      and package_catalog_id is not null and char_length(btrim(package_name_snapshot)) between 1 and 120
      and total_sessions_snapshot is not null and price_snapshot is not null
      and baseline_used_sessions <= total_sessions_snapshot)
  ),
  constraint center_tuition_package_cycles_baseline_evidence_check check (
    (origin = 'OPERATOR_BASELINE' and char_length(btrim(baseline_review_note)) between 1 and 2000)
    or (origin = 'AUTOMATIC_ROLLOVER' and baseline_review_note = '')
  ),
  constraint center_tuition_package_cycles_bcht_completion_check check (
    (bcht_status = 'COMPLETED' and bcht_completed_at is not null and bcht_completed_by is not null)
    or
    (bcht_status <> 'COMPLETED' and bcht_completed_at is null and bcht_completed_by is null)
  )
);

create index center_tuition_package_cycles_student_idx
  on public.center_tuition_package_cycles(center_id, student_local_id, cycle_number desc);

create table public.center_tuition_attendance_contributions (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete restrict,
  student_local_id text not null,
  schedule_session_local_id text not null,
  occurrence_date date not null,
  attendance_entity_local_id text not null,
  attendance_entity_version bigint not null check (attendance_entity_version >= 1),
  attendance_status text not null check (lower(attendance_status) in (
    'present', 'absent', 'unexcusedabsent', 'excused', 'excusedabsent', 'makeup', 'trial'
  )),
  contribution_units smallint not null check (contribution_units in (0, 1)),
  allocation_state text not null check (allocation_state in ('APPLIED', 'PENDING_PACKAGE_SELECTION')),
  cycle_id uuid not null,
  makeup_reason_snapshot text not null default '' check (char_length(makeup_reason_snapshot) <= 2000),
  version bigint not null default 1 check (version >= 1),
  ended_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint center_tuition_attendance_contributions_cycle_fkey
    foreign key(center_id, cycle_id)
    references public.center_tuition_package_cycles(center_id, id) on delete restrict,
  constraint center_tuition_attendance_contributions_occurrence_unique unique(
    center_id, student_local_id, schedule_session_local_id, occurrence_date
  )
);

create index center_tuition_attendance_contributions_cycle_idx
  on public.center_tuition_attendance_contributions(center_id, cycle_id, ended_at);

create table public.center_tuition_cycle_command_results (
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  intent_digest bytea not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  primary key(center_id, actor_user_id, idempotency_key)
);

create table public.center_tuition_cycle_audit_events (
  id bigint generated always as identity primary key,
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  action text not null check (char_length(action) between 1 and 100),
  entity_type text not null check (entity_type in ('PACKAGE_CYCLE', 'ATTENDANCE_CONTRIBUTION')),
  entity_id uuid not null,
  before_state jsonb,
  after_state jsonb,
  command_idempotency_key uuid,
  created_at timestamptz not null default clock_timestamp()
);

create index center_tuition_cycle_audit_events_center_created_idx
  on public.center_tuition_cycle_audit_events(center_id, created_at desc, id desc);

alter table public.center_tuition_package_cycles enable row level security;
alter table public.center_tuition_package_cycles force row level security;
alter table public.center_tuition_attendance_contributions enable row level security;
alter table public.center_tuition_attendance_contributions force row level security;
alter table public.center_tuition_cycle_command_results enable row level security;
alter table public.center_tuition_cycle_command_results force row level security;
alter table public.center_tuition_cycle_audit_events enable row level security;
alter table public.center_tuition_cycle_audit_events force row level security;

revoke all on table public.center_tuition_package_cycles from public, anon, authenticated, service_role;
revoke all on table public.center_tuition_attendance_contributions from public, anon, authenticated, service_role;
revoke all on table public.center_tuition_cycle_command_results from public, anon, authenticated, service_role;
revoke all on table public.center_tuition_cycle_audit_events from public, anon, authenticated, service_role;
revoke all on sequence public.center_tuition_cycle_audit_events_id_seq from public, anon, authenticated, service_role;
grant all on table public.center_tuition_package_cycles to service_role;
grant all on table public.center_tuition_attendance_contributions to service_role;
grant all on table public.center_tuition_cycle_command_results to service_role;
grant select, insert on table public.center_tuition_cycle_audit_events to service_role;
grant usage, select on sequence public.center_tuition_cycle_audit_events_id_seq to service_role;

create function public.v2_4_internal_normalize_role(p_role text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_role, '')))
    when 'admin' then 'center_admin'
    when 'qtv' then 'center_admin'
    else pg_catalog.lower(pg_catalog.btrim(coalesce(p_role, '')))
  end
$$;

create function public.v2_4_internal_active_membership(p_center_id text, p_user_id uuid)
returns public.center_members
language sql
stable
security definer
set search_path = ''
as $$
  select m.*
  from public.center_members m
  join public.centers c on c.id = m.center_id
  where m.center_id = p_center_id
    and m.user_id = p_user_id
    and m.status = 'active'
    and c.status = 'active'
    and public.v2_4_internal_normalize_role(m.role) in ('owner', 'center_admin')
  limit 1
$$;

create function public.v2_4_internal_consumption_units(p_status text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_status, '')))
    when 'present' then 1::smallint
    when 'makeup' then 1::smallint
    when 'absent' then 0::smallint
    when 'unexcusedabsent' then 0::smallint
    when 'excused' then 0::smallint
    when 'excusedabsent' then 0::smallint
    when 'trial' then 0::smallint
    else null::smallint
  end
$$;

comment on function public.v2_4_internal_consumption_units(text) is
  'Frozen V2-4 attendance policy. It derives 0/1 from canonical status and never trusts V2-3 tuition flags.';

create function public.v2_4_internal_reconcile_student(
  p_center_id text,
  p_student_local_id text,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first public.center_tuition_package_cycles;
  v_cycle public.center_tuition_package_cycles;
  v_next public.center_tuition_package_cycles;
  v_attendance public.center_cloud_entities;
  v_existing public.center_tuition_attendance_contributions;
  v_units smallint;
  v_used integer;
  v_cycle_number integer;
  v_max_cycle_number integer := 0;
  v_state text;
  v_reason text;
  v_before jsonb;
  v_contribution_id uuid;
begin
  if pg_catalog.btrim(coalesce(p_center_id, '')) = ''
     or pg_catalog.btrim(coalesce(p_student_local_id, '')) = '' then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'v2.4.student|' || p_center_id || '|' || p_student_local_id, 0));

  select * into v_first
  from public.center_tuition_package_cycles c
  where c.center_id = p_center_id
    and c.student_local_id = p_student_local_id
    and c.cycle_number = 1
    and c.lifecycle_status <> 'SUPERSEDED'
  for update;
  if v_first.id is null then return; end if;

  v_cycle := v_first;
  v_cycle_number := 1;
  v_used := v_cycle.baseline_used_sessions;

  for v_attendance in
    select e.*
    from public.center_cloud_entities e
    where e.center_id = p_center_id
      and e.entity_type = 'attendance_record'
      and e.deleted_at is null
      and e.payload->>'attendanceAuthority' = 'v2.3-occurrence-v1'
      and e.payload->>'studentId' = p_student_local_id
      and coalesce(e.payload->>'date', '') ~ '^\d{4}-\d{2}-\d{2}$'
      and (e.payload->>'date')::date > v_first.baseline_cutoff_date
    order by (e.payload->>'date')::date,
      coalesce(e.payload->>'scheduleSessionId', e.payload->>'sessionId'), e.local_id
  loop
    v_units := public.v2_4_internal_consumption_units(v_attendance.payload->>'attendanceStatus');
    if v_units is null then raise exception 'v2_4_unknown_attendance_status'; end if;

    if v_units = 1 and v_cycle.total_sessions_snapshot is not null
       and v_used >= v_cycle.total_sessions_snapshot then
      v_cycle_number := v_cycle_number + 1;
      select * into v_next
      from public.center_tuition_package_cycles c
      where c.center_id = p_center_id
        and c.student_local_id = p_student_local_id
        and c.cycle_number = v_cycle_number
      for update;
      if v_next.id is null then
        if v_cycle.package_catalog_id is not null and exists (
          select 1 from public.center_tuition_package_catalog p
          where p.id = v_cycle.package_catalog_id
            and p.center_id = p_center_id and p.is_active
        ) then
          insert into public.center_tuition_package_cycles(
            center_id, student_local_id, tuition_local_id, cycle_number,
            predecessor_cycle_id, package_catalog_id, package_name_snapshot,
            total_sessions_snapshot, price_snapshot, payment_period_id,
            baseline_used_sessions, baseline_cutoff_date, lifecycle_status, origin,
            created_by, updated_by
          ) values (
            p_center_id, p_student_local_id, v_cycle.tuition_local_id, v_cycle_number,
            v_cycle.id, v_cycle.package_catalog_id, v_cycle.package_name_snapshot,
            v_cycle.total_sessions_snapshot, v_cycle.price_snapshot, gen_random_uuid()::text,
            0, v_first.baseline_cutoff_date, 'PROVISIONAL_UNPAID', 'AUTOMATIC_ROLLOVER',
            p_actor_user_id, p_actor_user_id
          ) returning * into v_next;
        else
          insert into public.center_tuition_package_cycles(
            center_id, student_local_id, tuition_local_id, cycle_number,
            predecessor_cycle_id, payment_period_id, baseline_used_sessions,
            baseline_cutoff_date, lifecycle_status, origin, created_by, updated_by
          ) values (
            p_center_id, p_student_local_id, v_cycle.tuition_local_id, v_cycle_number,
            v_cycle.id, gen_random_uuid()::text, 0, v_first.baseline_cutoff_date,
            'NEEDS_PACKAGE_SELECTION', 'AUTOMATIC_ROLLOVER', p_actor_user_id, p_actor_user_id
          ) returning * into v_next;
        end if;
        insert into public.center_tuition_cycle_audit_events(
          center_id, actor_user_id, action, entity_type, entity_id, after_state
        ) values (
          p_center_id, p_actor_user_id, 'AUTOMATIC_ROLLOVER_CREATED', 'PACKAGE_CYCLE',
          v_next.id, pg_catalog.to_jsonb(v_next)
        );
      elsif v_next.lifecycle_status = 'SUPERSEDED' then
        v_before := pg_catalog.to_jsonb(v_next);
        update public.center_tuition_package_cycles
        set lifecycle_status = case when package_catalog_id is null
              then 'NEEDS_PACKAGE_SELECTION' else 'PROVISIONAL_UNPAID' end,
            version = version + 1, updated_by = p_actor_user_id,
            updated_at = clock_timestamp()
        where id = v_next.id returning * into v_next;
        insert into public.center_tuition_cycle_audit_events(
          center_id, actor_user_id, action, entity_type, entity_id, before_state, after_state
        ) values (
          p_center_id, p_actor_user_id, 'AUTOMATIC_ROLLOVER_REACTIVATED',
          'PACKAGE_CYCLE', v_next.id, v_before, pg_catalog.to_jsonb(v_next)
        );
      end if;
      v_cycle := v_next;
      v_used := v_cycle.baseline_used_sessions;
    end if;

    v_max_cycle_number := greatest(v_max_cycle_number, v_cycle.cycle_number);
    v_state := case when v_cycle.total_sessions_snapshot is null
      then 'PENDING_PACKAGE_SELECTION' else 'APPLIED' end;
    v_reason := case when pg_catalog.lower(v_attendance.payload->>'attendanceStatus') = 'makeup'
      then pg_catalog.left(pg_catalog.btrim(coalesce(
        nullif(v_attendance.payload->>'makeupReason', ''),
        nullif(v_attendance.payload->>'correctionReason', ''),
        v_attendance.payload->>'note', ''
      )), 2000) else '' end;

    select * into v_existing
    from public.center_tuition_attendance_contributions x
    where x.center_id = p_center_id
      and x.student_local_id = p_student_local_id
      and x.schedule_session_local_id = coalesce(
        nullif(v_attendance.payload->>'scheduleSessionId', ''), v_attendance.payload->>'sessionId')
      and x.occurrence_date = (v_attendance.payload->>'date')::date
    for update;
    if v_existing.id is null then
      insert into public.center_tuition_attendance_contributions(
        center_id, student_local_id, schedule_session_local_id, occurrence_date,
        attendance_entity_local_id, attendance_entity_version, attendance_status,
        contribution_units, allocation_state, cycle_id, makeup_reason_snapshot
      ) values (
        p_center_id, p_student_local_id,
        coalesce(nullif(v_attendance.payload->>'scheduleSessionId', ''), v_attendance.payload->>'sessionId'),
        (v_attendance.payload->>'date')::date, v_attendance.local_id,
        v_attendance.entity_version, v_attendance.payload->>'attendanceStatus',
        v_units, v_state, v_cycle.id, v_reason
      ) returning id into v_contribution_id;
      insert into public.center_tuition_cycle_audit_events(
        center_id, actor_user_id, action, entity_type, entity_id, after_state
      ) select p_center_id, p_actor_user_id, 'CONTRIBUTION_RECONCILED',
        'ATTENDANCE_CONTRIBUTION', x.id, pg_catalog.to_jsonb(x)
      from public.center_tuition_attendance_contributions x where x.id = v_contribution_id;
    elsif v_existing.attendance_entity_local_id is distinct from v_attendance.local_id
       or v_existing.attendance_entity_version is distinct from v_attendance.entity_version
       or v_existing.attendance_status is distinct from v_attendance.payload->>'attendanceStatus'
       or v_existing.contribution_units is distinct from v_units
       or v_existing.allocation_state is distinct from v_state
       or v_existing.cycle_id is distinct from v_cycle.id
       or v_existing.makeup_reason_snapshot is distinct from v_reason
       or v_existing.ended_at is not null then
      v_before := pg_catalog.to_jsonb(v_existing);
      update public.center_tuition_attendance_contributions
      set attendance_entity_local_id = v_attendance.local_id,
          attendance_entity_version = v_attendance.entity_version,
          attendance_status = v_attendance.payload->>'attendanceStatus',
          contribution_units = v_units, allocation_state = v_state,
          cycle_id = v_cycle.id, makeup_reason_snapshot = v_reason,
          version = version + 1, ended_at = null, updated_at = clock_timestamp()
      where id = v_existing.id returning id into v_contribution_id;
      insert into public.center_tuition_cycle_audit_events(
        center_id, actor_user_id, action, entity_type, entity_id, before_state, after_state
      ) select p_center_id, p_actor_user_id, 'CONTRIBUTION_RECONCILED',
        'ATTENDANCE_CONTRIBUTION', x.id, v_before, pg_catalog.to_jsonb(x)
      from public.center_tuition_attendance_contributions x where x.id = v_contribution_id;
    end if;
    if v_units = 1 and v_cycle.total_sessions_snapshot is not null then
      v_used := v_used + 1;
    end if;
  end loop;

  with ended as (
    update public.center_tuition_attendance_contributions x
    set ended_at = clock_timestamp(), version = version + 1, updated_at = clock_timestamp()
    where x.center_id = p_center_id and x.student_local_id = p_student_local_id
      and x.ended_at is null
      and not exists (
        select 1 from public.center_cloud_entities e
        where e.center_id = p_center_id and e.entity_type = 'attendance_record'
          and e.deleted_at is null and e.payload->>'attendanceAuthority' = 'v2.3-occurrence-v1'
          and e.payload->>'studentId' = p_student_local_id
          and coalesce(nullif(e.payload->>'scheduleSessionId', ''), e.payload->>'sessionId') = x.schedule_session_local_id
          and e.payload->>'date' = x.occurrence_date::text
          and x.occurrence_date > v_first.baseline_cutoff_date
      )
    returning x.*
  )
  insert into public.center_tuition_cycle_audit_events(
    center_id, actor_user_id, action, entity_type, entity_id, after_state
  )
  select p_center_id, p_actor_user_id, 'CONTRIBUTION_ENDED',
    'ATTENDANCE_CONTRIBUTION', ended.id, pg_catalog.to_jsonb(ended)
  from ended;

  -- Correction can make a never-paid automatic tail unnecessary. Preserve it
  -- as history rather than deleting it; a later rollover may reactivate it.
  with candidates as (
    select c.id, pg_catalog.to_jsonb(c) as before_state
    from public.center_tuition_package_cycles c
    where c.center_id = p_center_id and c.student_local_id = p_student_local_id
      and c.origin = 'AUTOMATIC_ROLLOVER' and c.cycle_number > v_max_cycle_number
      and c.lifecycle_status <> 'SUPERSEDED'
      and not exists (
        select 1 from public.finance_transaction t
        where t.center_id = c.center_id and t.status = 'POSTED'
          and t.source_module = 'hoc-phi' and t.source_type = 'tuition-payment'
          and t.source_tuition_id = c.tuition_local_id and t.source_period_id = c.payment_period_id
      )
    for update
  ), superseded as (
    update public.center_tuition_package_cycles c
    set lifecycle_status = 'SUPERSEDED', version = c.version + 1,
        updated_by = p_actor_user_id, updated_at = clock_timestamp()
    from candidates old
    where c.id = old.id
    returning c.*, old.before_state
  )
  insert into public.center_tuition_cycle_audit_events(
    center_id, actor_user_id, action, entity_type, entity_id, before_state, after_state
  )
  select p_center_id, p_actor_user_id, 'AUTOMATIC_ROLLOVER_SUPERSEDED',
    'PACKAGE_CYCLE', superseded.id, superseded.before_state,
    pg_catalog.to_jsonb(superseded) - 'before_state'
  from superseded;
end
$$;

create function public.v2_4_internal_reconcile_attendance_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_center_id text;
  v_student_id text;
  v_actor uuid;
begin
  if coalesce(new.entity_type, old.entity_type) <> 'attendance_record' then return null; end if;
  if coalesce(new.payload->>'attendanceAuthority', old.payload->>'attendanceAuthority', '') <> 'v2.3-occurrence-v1' then
    return null;
  end if;
  v_center_id := coalesce(new.center_id, old.center_id);
  v_student_id := coalesce(new.payload->>'studentId', old.payload->>'studentId');
  v_actor := coalesce(auth.uid(), new.updated_by, old.updated_by);
  perform public.v2_4_internal_reconcile_student(v_center_id, v_student_id, v_actor);
  return null;
end
$$;

create trigger v2_4_reconcile_occurrence_attendance
after insert or update or delete
on public.center_cloud_entities
for each row execute function public.v2_4_internal_reconcile_attendance_trigger();

create view public.center_tuition_package_cycle_projection
with (security_invoker = false)
as
select
  c.*,
  coalesce(contribution.applied_sessions, 0)::integer as contributed_sessions,
  coalesce(contribution.pending_sessions, 0)::integer as pending_sessions,
  (c.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer)::integer as used_sessions,
  case when c.total_sessions_snapshot is null then null
    else greatest(c.total_sessions_snapshot - c.baseline_used_sessions
      - coalesce(contribution.applied_sessions, 0)::integer, 0)::integer end as remaining_sessions,
  coalesce(payment.paid_amount, 0)::bigint as paid_amount,
  case
    when c.price_snapshot is null then 'NEEDS_PACKAGE_SELECTION'
    when coalesce(payment.paid_amount, 0) <= 0 then 'UNPAID'
    when coalesce(payment.paid_amount, 0) < c.price_snapshot then 'PARTIAL'
    else 'PAID'
  end as payment_status,
  case
    when c.total_sessions_snapshot is null then 'PACKAGE_SELECTION_REQUIRED'
    when c.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= c.total_sessions_snapshot
      and c.bcht_status <> 'COMPLETED' then 'PACKAGE_EXHAUSTED_BCHT_DUE'
    when c.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= c.total_sessions_snapshot then 'PACKAGE_EXHAUSTED'
    when c.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer = c.total_sessions_snapshot - 1
      and c.bcht_status <> 'COMPLETED' then 'BCHT_AND_RENEWAL_DUE'
    when c.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer = c.total_sessions_snapshot - 1 then 'RENEWAL_DUE'
    when c.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer = c.total_sessions_snapshot - 2
      and c.bcht_status <> 'COMPLETED' then 'BCHT_DUE'
    when c.lifecycle_status = 'PROVISIONAL_UNPAID' then 'PROVISIONAL_UNPAID'
    else 'NORMAL'
  end as reminder_state,
  (c.bcht_status <> 'COMPLETED' and c.total_sessions_snapshot is not null
    and c.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= c.total_sessions_snapshot - 2) as bcht_reminder,
  (c.total_sessions_snapshot is not null
    and c.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= c.total_sessions_snapshot - 1) as renewal_reminder,
  (c.total_sessions_snapshot is not null
    and c.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= c.total_sessions_snapshot) as urgent_renewal
from public.center_tuition_package_cycles c
left join lateral (
  select
    count(*) filter (where x.allocation_state = 'APPLIED' and x.contribution_units = 1) as applied_sessions,
    count(*) filter (where x.allocation_state = 'PENDING_PACKAGE_SELECTION' and x.contribution_units = 1) as pending_sessions
  from public.center_tuition_attendance_contributions x
  where x.center_id = c.center_id and x.cycle_id = c.id and x.ended_at is null
) contribution on true
left join lateral (
  select coalesce(sum(t.amount_minor), 0) as paid_amount
  from public.finance_transaction t
  where t.center_id = c.center_id and t.status = 'POSTED'
    and t.source_module = 'hoc-phi' and t.source_type = 'tuition-payment'
    and t.source_tuition_id = c.tuition_local_id
    and t.source_period_id = c.payment_period_id
) payment on true;

revoke all on table public.center_tuition_package_cycle_projection from public, anon, authenticated, service_role;
grant select on table public.center_tuition_package_cycle_projection to service_role;

create function public.v2_4_list_package_cycle_state(p_center_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_membership public.center_members;
begin
  if v_actor is null then raise exception 'v2_4_not_authenticated'; end if;
  select * into v_membership from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'v2_4_center_access_denied'; end if;
  return pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'AUTHORITATIVE_SNAPSHOT',
    'status', 'READY', 'contract', 'v2.4-package-cycle-v1', 'center_id', p_center_id,
    'students', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'student_id', student.local_id,
        'readiness', case
          when current_cycle.id is not null then 'READY'
          when tuition.id is not null then 'LEGACY_REVIEW_REQUIRED'
          else 'NO_TUITION_PACKAGE'
        end,
        'current_cycle', case when current_cycle.id is null then null else pg_catalog.jsonb_build_object(
          'id', current_cycle.id, 'cycle_number', current_cycle.cycle_number,
          'tuition_local_id', current_cycle.tuition_local_id,
          'package_catalog_id', current_cycle.package_catalog_id,
          'package_name', current_cycle.package_name_snapshot,
          'total_sessions', current_cycle.total_sessions_snapshot,
          'price', current_cycle.price_snapshot,
          'baseline_used', current_cycle.baseline_used_sessions,
          'baseline_cutoff_date', current_cycle.baseline_cutoff_date,
          'baseline_review_note', current_cycle.baseline_review_note,
          'contributed_sessions', current_cycle.contributed_sessions,
          'pending_sessions', current_cycle.pending_sessions,
          'used_sessions', current_cycle.used_sessions,
          'remaining_sessions', current_cycle.remaining_sessions,
          'lifecycle_status', current_cycle.lifecycle_status,
          'payment_period_id', current_cycle.payment_period_id,
          'payment_status', current_cycle.payment_status,
          'paid_amount', current_cycle.paid_amount,
          'bcht_status', current_cycle.bcht_status,
          'bcht_note', current_cycle.bcht_note,
          'reminder_state', current_cycle.reminder_state,
          'bcht_reminder', current_cycle.bcht_reminder,
          'renewal_reminder', current_cycle.renewal_reminder,
          'urgent_renewal', current_cycle.urgent_renewal,
          'version', current_cycle.version
        ) end,
        'cycles', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', history.id, 'cycle_number', history.cycle_number,
          'package_name', history.package_name_snapshot,
          'total_sessions', history.total_sessions_snapshot,
          'used_sessions', history.used_sessions, 'lifecycle_status', history.lifecycle_status,
          'payment_status', history.payment_status, 'bcht_status', history.bcht_status,
          'version', history.version
        ) order by history.cycle_number desc)
          from public.center_tuition_package_cycle_projection history
          where history.center_id = p_center_id and history.student_local_id = student.local_id), '[]'::jsonb)
      ) order by pg_catalog.lower(coalesce(student.payload->>'fullName', '')), student.local_id)
      from public.center_cloud_entities student
      left join lateral (
        select e.* from public.center_cloud_entities e
        where e.center_id = p_center_id and e.entity_type = 'tuition_record_package'
          and e.deleted_at is null and e.payload->>'studentId' = student.local_id
        order by e.entity_version desc, e.local_id limit 1
      ) tuition on true
      left join lateral (
        select p.* from public.center_tuition_package_cycle_projection p
        where p.center_id = p_center_id and p.student_local_id = student.local_id
          and p.lifecycle_status <> 'SUPERSEDED'
        order by p.cycle_number desc limit 1
      ) current_cycle on true
      where student.center_id = p_center_id and student.entity_type = 'student'
        and student.deleted_at is null
    ), '[]'::jsonb),
    'package_catalog', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', p.id, 'package_name', p.package_name, 'total_sessions', p.total_sessions,
      'default_amount', p.default_amount, 'is_active', p.is_active, 'version', p.version
    ) order by p.is_active desc, pg_catalog.lower(p.package_name), p.id)
      from public.center_tuition_package_catalog p where p.center_id = p_center_id), '[]'::jsonb),
    'contributions', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'student_id', item.student_local_id,
      'schedule_session_id', item.schedule_session_local_id,
      'occurrence_date', item.occurrence_date,
      'attendance_status', item.attendance_status,
      'contribution_units', item.contribution_units,
      'allocation_state', item.allocation_state,
      'makeup_reason', item.makeup_reason_snapshot,
      'cycle_id', item.cycle_id,
      'cycle_number', item.cycle_number,
      'package_name', item.package_name_snapshot,
      'total_sessions', item.total_sessions_snapshot,
      'session_number', case when item.allocation_state = 'APPLIED'
        then item.running_session_number else null end,
      'remaining_sessions', case when item.allocation_state = 'APPLIED'
          and item.total_sessions_snapshot is not null
        then greatest(item.total_sessions_snapshot - item.running_session_number, 0) else null end,
      'cycle_lifecycle_status', item.lifecycle_status,
      'payment_status', item.payment_status
    ) order by item.occurrence_date, item.schedule_session_local_id, item.student_local_id)
      from (
        select x.*, cycle.cycle_number, cycle.package_name_snapshot,
          cycle.total_sessions_snapshot, cycle.baseline_used_sessions,
          cycle.lifecycle_status, cycle.payment_status,
          cycle.baseline_used_sessions + sum(x.contribution_units) over (
            partition by x.cycle_id order by x.occurrence_date,
              x.schedule_session_local_id, x.id rows unbounded preceding
          )::integer as running_session_number
        from public.center_tuition_attendance_contributions x
        join public.center_tuition_package_cycle_projection cycle
          on cycle.center_id = x.center_id and cycle.id = x.cycle_id
        where x.center_id = p_center_id and x.ended_at is null
      ) item), '[]'::jsonb)
  );
end
$$;

create function public.v2_4_mutate_package_cycle(
  p_center_id text,
  p_command jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_membership public.center_members;
  v_existing public.center_tuition_cycle_command_results;
  v_intent bytea;
  v_operation text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', '')));
  v_student_id text := pg_catalog.btrim(coalesce(p_command->>'student_id', ''));
  v_tuition_local_id text := pg_catalog.btrim(coalesce(p_command->>'tuition_local_id', ''));
  v_cycle public.center_tuition_package_cycles;
  v_package public.center_tuition_package_catalog;
  v_tuition public.center_cloud_entities;
  v_cycle_id uuid;
  v_package_id uuid;
  v_expected_version bigint;
  v_baseline integer;
  v_cutoff date;
  v_bcht_status text;
  v_bcht_note text;
  v_baseline_review_note text;
  v_period_id text;
  v_response jsonb;
  v_before jsonb;
begin
  if v_actor is null then raise exception 'v2_4_not_authenticated'; end if;
  if p_idempotency_key is null or p_command is null or pg_catalog.jsonb_typeof(p_command) <> 'object'
     or v_student_id = '' then raise exception 'v2_4_invalid_command'; end if;
  select * into v_membership from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'v2_4_center_access_denied'; end if;

  v_intent := extensions.digest(pg_catalog.convert_to(p_command::text, 'UTF8'), 'sha256');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'v2.4.command|' || p_center_id || '|' || v_actor::text || '|' || p_idempotency_key::text, 0));
  select * into v_existing from public.center_tuition_cycle_command_results r
  where r.center_id = p_center_id and r.actor_user_id = v_actor
    and r.idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.intent_digest <> v_intent then raise exception 'v2_4_idempotency_conflict'; end if;
    return v_existing.result_snapshot || pg_catalog.jsonb_build_object('replayed', true);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'v2.4.student|' || p_center_id || '|' || v_student_id, 0));
  if not exists (select 1 from public.center_cloud_entities s
    where s.center_id = p_center_id and s.entity_type = 'student'
      and s.local_id = v_student_id and s.deleted_at is null) then
    raise exception 'v2_4_student_not_found';
  end if;

  if v_operation = 'START_CYCLE' then
    if exists (select 1 from public.center_tuition_package_cycles c
      where c.center_id = p_center_id and c.student_local_id = v_student_id) then
      raise exception 'v2_4_cycle_already_started';
    end if;
    v_package_id := (p_command->>'package_catalog_id')::uuid;
    v_baseline := (p_command->>'baseline_used_sessions')::integer;
    v_cutoff := (p_command->>'baseline_cutoff_date')::date;
    v_baseline_review_note := pg_catalog.left(pg_catalog.btrim(coalesce(
      p_command->>'baseline_review_note', '')), 2000);
    if v_tuition_local_id = '' or v_baseline < 0 or v_cutoff is null or v_cutoff > current_date
       or v_baseline_review_note = '' then
      raise exception 'v2_4_invalid_baseline';
    end if;
    select * into v_tuition from public.center_cloud_entities e
    where e.center_id = p_center_id and e.entity_type = 'tuition_record_package'
      and e.local_id = v_tuition_local_id and e.deleted_at is null for share;
    if v_tuition.id is null or v_tuition.payload->>'studentId' <> v_student_id then
      raise exception 'v2_4_tuition_not_found';
    end if;
    select * into v_package from public.center_tuition_package_catalog p
    where p.id = v_package_id and p.center_id = p_center_id and p.is_active for share;
    if v_package.id is null or v_baseline > v_package.total_sessions then
      raise exception 'v2_4_package_not_available';
    end if;
    v_period_id := pg_catalog.btrim(coalesce(v_tuition.payload->>'currentTermId', ''));
    if v_period_id = '' then
      v_period_id := 'term-' || coalesce(nullif(v_tuition.payload->>'id', ''), v_tuition.local_id)
        || '-' || coalesce(nullif(v_tuition.payload->>'currentTermNumber', ''), '1');
    end if;
    insert into public.center_tuition_package_cycles(
      center_id, student_local_id, tuition_local_id, cycle_number,
      package_catalog_id, package_name_snapshot, total_sessions_snapshot,
      price_snapshot, payment_period_id, baseline_used_sessions,
      baseline_cutoff_date, baseline_review_note, lifecycle_status, origin, created_by, updated_by
    ) values (
      p_center_id, v_student_id, v_tuition_local_id, 1,
      v_package.id, v_package.package_name, v_package.total_sessions,
      v_package.default_amount, v_period_id, v_baseline,
      v_cutoff, v_baseline_review_note, 'ACTIVE', 'OPERATOR_BASELINE', v_actor, v_actor
    ) returning * into v_cycle;

  elsif v_operation = 'UPDATE_BCHT' then
    v_cycle_id := (p_command->>'cycle_id')::uuid;
    v_expected_version := (p_command->>'expected_version')::bigint;
    v_bcht_status := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'bcht_status', '')));
    v_bcht_note := pg_catalog.left(pg_catalog.btrim(coalesce(p_command->>'bcht_note', '')), 2000);
    if v_bcht_status not in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED') then
      raise exception 'v2_4_invalid_bcht_status';
    end if;
    select * into v_cycle from public.center_tuition_package_cycles c
    where c.id = v_cycle_id and c.center_id = p_center_id
      and c.student_local_id = v_student_id for update;
    if v_cycle.id is null or v_cycle.version <> v_expected_version then raise exception 'v2_4_stale_version'; end if;
    v_before := pg_catalog.to_jsonb(v_cycle);
    update public.center_tuition_package_cycles
    set bcht_status = v_bcht_status, bcht_note = v_bcht_note,
        bcht_completed_at = case when v_bcht_status = 'COMPLETED' then clock_timestamp() else null end,
        bcht_completed_by = case when v_bcht_status = 'COMPLETED' then v_actor else null end,
        version = version + 1, updated_by = v_actor, updated_at = clock_timestamp()
    where id = v_cycle.id returning * into v_cycle;

  elsif v_operation = 'SELECT_PROVISIONAL_PACKAGE' then
    v_cycle_id := (p_command->>'cycle_id')::uuid;
    v_package_id := (p_command->>'package_catalog_id')::uuid;
    v_expected_version := (p_command->>'expected_version')::bigint;
    select * into v_cycle from public.center_tuition_package_cycles c
    where c.id = v_cycle_id and c.center_id = p_center_id
      and c.student_local_id = v_student_id for update;
    if v_cycle.id is null or v_cycle.version <> v_expected_version
       or v_cycle.lifecycle_status not in ('NEEDS_PACKAGE_SELECTION', 'PROVISIONAL_UNPAID') then
      raise exception 'v2_4_stale_version';
    end if;
    if exists (select 1 from public.finance_transaction t
      where t.center_id = v_cycle.center_id and t.status = 'POSTED'
        and t.source_module = 'hoc-phi' and t.source_type = 'tuition-payment'
        and t.source_tuition_id = v_cycle.tuition_local_id
        and t.source_period_id = v_cycle.payment_period_id) then
      raise exception 'v2_4_provisional_package_locked_by_payment';
    end if;
    select * into v_package from public.center_tuition_package_catalog p
    where p.id = v_package_id and p.center_id = p_center_id and p.is_active for share;
    if v_package.id is null then raise exception 'v2_4_package_not_available'; end if;
    v_before := pg_catalog.to_jsonb(v_cycle);
    update public.center_tuition_package_cycles
    set package_catalog_id = v_package.id, package_name_snapshot = v_package.package_name,
        total_sessions_snapshot = v_package.total_sessions, price_snapshot = v_package.default_amount,
        lifecycle_status = 'PROVISIONAL_UNPAID', version = version + 1,
        updated_by = v_actor, updated_at = clock_timestamp()
    where id = v_cycle.id returning * into v_cycle;
  else
    raise exception 'v2_4_invalid_operation';
  end if;

  insert into public.center_tuition_cycle_audit_events(
    center_id, actor_user_id, action, entity_type, entity_id,
    before_state, after_state, command_idempotency_key
  ) values (
    p_center_id, v_actor, v_operation, 'PACKAGE_CYCLE', v_cycle.id,
    v_before, pg_catalog.to_jsonb(v_cycle), p_idempotency_key
  );
  perform public.v2_4_internal_reconcile_student(p_center_id, v_student_id, v_actor);
  select * into v_cycle from public.center_tuition_package_cycles where id = v_cycle.id;
  v_response := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED', 'center_id', p_center_id,
    'student_id', v_student_id, 'cycle_id', v_cycle.id,
    'cycle_number', v_cycle.cycle_number, 'version', v_cycle.version
  );
  insert into public.center_tuition_cycle_command_results(
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (p_center_id, v_actor, p_idempotency_key, v_intent, v_response);
  return v_response;
end
$$;

revoke all on function public.v2_4_internal_normalize_role(text) from public, anon, authenticated, service_role;
revoke all on function public.v2_4_internal_active_membership(text,uuid) from public, anon, authenticated, service_role;
revoke all on function public.v2_4_internal_consumption_units(text) from public, anon, authenticated, service_role;
revoke all on function public.v2_4_internal_reconcile_student(text,text,uuid) from public, anon, authenticated, service_role;
revoke all on function public.v2_4_internal_reconcile_attendance_trigger() from public, anon, authenticated, service_role;
revoke all on function public.v2_4_list_package_cycle_state(text) from public, anon, authenticated, service_role;
revoke all on function public.v2_4_mutate_package_cycle(text,jsonb,uuid) from public, anon, authenticated, service_role;
grant execute on function public.v2_4_list_package_cycle_state(text) to authenticated;
grant execute on function public.v2_4_mutate_package_cycle(text,jsonb,uuid) to authenticated;

comment on table public.center_tuition_package_cycles is
  'V2-4 exact-center, versioned package-cycle authority. Catalog and price terms are frozen per cycle.';
comment on table public.center_tuition_attendance_contributions is
  'V2-4 derived 0/1 contribution ledger keyed by the canonical V2-3 occurrence; corrections converge in place.';
comment on function public.v2_4_mutate_package_cycle(text,jsonb,uuid) is
  'Owner/Admin exact-center mutation boundary for explicit baseline, BCHT, and provisional package selection. It never creates Finance transactions.';

commit;
