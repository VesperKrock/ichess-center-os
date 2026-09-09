-- V2-2 individualized recurring Student enrollment.
-- Additive only. Existing classSessionIds remain untouched until an operator
-- explicitly saves that Student through the V2-2 command.

begin;

do $$
begin
  if pg_catalog.to_regclass('public.center_cloud_entities') is null
     or pg_catalog.to_regclass('public.center_core_command_result') is null
     or pg_catalog.to_regprocedure('public.c5_1_mutate_core_entity(text,text,text,bigint,jsonb,uuid,text)') is null
     or pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'v2_2_missing_prerequisite';
  end if;
end
$$;

create table public.center_student_enrollment_sets (
  center_id text not null references public.centers(id) on delete restrict,
  student_local_id text not null,
  version bigint not null default 1 check (version >= 1),
  ended_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  created_by_membership_id uuid not null references public.center_members(id) on delete restrict,
  updated_by_membership_id uuid not null references public.center_members(id) on delete restrict,
  primary key (center_id, student_local_id),
  check (char_length(btrim(student_local_id)) between 1 and 200)
);

create table public.center_student_recurring_enrollments (
  id uuid primary key default gen_random_uuid(),
  center_id text not null,
  student_local_id text not null,
  class_session_local_id text not null,
  weekdays text[] not null,
  enrollment_set_version bigint not null check (enrollment_set_version >= 1),
  created_at timestamptz not null default clock_timestamp(),
  ended_at timestamptz,
  created_by_membership_id uuid not null references public.center_members(id) on delete restrict,
  ended_by_membership_id uuid references public.center_members(id) on delete restrict,
  foreign key (center_id, student_local_id)
    references public.center_student_enrollment_sets(center_id, student_local_id)
    on delete restrict,
  check (char_length(btrim(class_session_local_id)) between 1 and 200),
  check (
    cardinality(weekdays) between 1 and 7
    and weekdays <@ array['mon','tue','wed','thu','fri','sat','sun']::text[]
  )
);

create unique index center_student_recurring_enrollments_active_class_unique
  on public.center_student_recurring_enrollments(center_id, student_local_id, class_session_local_id)
  where ended_at is null;
create index center_student_recurring_enrollments_roster_idx
  on public.center_student_recurring_enrollments(center_id, class_session_local_id)
  where ended_at is null;

create table public.center_student_enrollment_command_results (
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  intent_digest bytea not null check (octet_length(intent_digest) = 32),
  result_snapshot jsonb not null check (jsonb_typeof(result_snapshot) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (center_id, actor_user_id, idempotency_key)
);

create table public.center_student_enrollment_audit_events (
  id bigint generated always as identity primary key,
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_membership_id uuid not null references public.center_members(id) on delete restrict,
  idempotency_key uuid not null,
  operation text not null check (operation in ('UPSERT', 'DELETE')),
  student_local_id text not null,
  student_version bigint not null check (student_version >= 1),
  enrollment_version bigint not null check (enrollment_version >= 1),
  enrollment_count integer not null check (enrollment_count >= 0),
  created_at timestamptz not null default clock_timestamp(),
  unique (center_id, actor_user_id, idempotency_key)
);

alter table public.center_student_enrollment_sets enable row level security;
alter table public.center_student_enrollment_sets force row level security;
alter table public.center_student_recurring_enrollments enable row level security;
alter table public.center_student_recurring_enrollments force row level security;
alter table public.center_student_enrollment_command_results enable row level security;
alter table public.center_student_enrollment_command_results force row level security;
alter table public.center_student_enrollment_audit_events enable row level security;
alter table public.center_student_enrollment_audit_events force row level security;

revoke all on table public.center_student_enrollment_sets from public, anon, authenticated, service_role;
revoke all on table public.center_student_recurring_enrollments from public, anon, authenticated, service_role;
revoke all on table public.center_student_enrollment_command_results from public, anon, authenticated, service_role;
revoke all on table public.center_student_enrollment_audit_events from public, anon, authenticated, service_role;
revoke all on sequence public.center_student_enrollment_audit_events_id_seq from public, anon, authenticated, service_role;
grant all on table public.center_student_enrollment_sets to service_role;
grant all on table public.center_student_recurring_enrollments to service_role;
grant all on table public.center_student_enrollment_command_results to service_role;
grant all on table public.center_student_enrollment_audit_events to service_role;
grant usage, select on sequence public.center_student_enrollment_audit_events_id_seq to service_role;

create function public.v2_2_internal_normalize_weekday(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case pg_catalog.lower(pg_catalog.btrim(coalesce(p_value, '')))
    when 'mon' then 'mon' when 'monday' then 'mon' when 't2' then 'mon'
    when 'tue' then 'tue' when 'tuesday' then 'tue' when 't3' then 'tue'
    when 'wed' then 'wed' when 'wednesday' then 'wed' when 't4' then 'wed'
    when 'thu' then 'thu' when 'thursday' then 'thu' when 't5' then 'thu'
    when 'fri' then 'fri' when 'friday' then 'fri' when 't6' then 'fri'
    when 'sat' then 'sat' when 'saturday' then 'sat' when 't7' then 'sat'
    when 'sun' then 'sun' when 'sunday' then 'sun' when 'cn' then 'sun'
    else null
  end
$$;

create function public.v2_2_internal_class_weekdays(p_payload jsonb)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_days text[];
begin
  if pg_catalog.jsonb_typeof(p_payload->'daysOfWeek') = 'array' then
    select pg_catalog.array_agg(day order by ord)
      into v_days
    from (
      select distinct public.v2_2_internal_normalize_weekday(value) as day,
        case public.v2_2_internal_normalize_weekday(value)
          when 'mon' then 1 when 'tue' then 2 when 'wed' then 3 when 'thu' then 4
          when 'fri' then 5 when 'sat' then 6 when 'sun' then 7 else 99 end as ord
      from pg_catalog.jsonb_array_elements_text(p_payload->'daysOfWeek')
    ) normalized
    where day is not null;
  else
    select pg_catalog.array_agg(day order by ord)
      into v_days
    from (
      select distinct public.v2_2_internal_normalize_weekday(value) as day,
        case public.v2_2_internal_normalize_weekday(value)
          when 'mon' then 1 when 'tue' then 2 when 'wed' then 3 when 'thu' then 4
          when 'fri' then 5 when 'sat' then 6 when 'sun' then 7 else 99 end as ord
      from pg_catalog.regexp_split_to_table(
        coalesce(p_payload->>'daysLabel', p_payload->>'dayLabel', ''),
        '[^[:alnum:]]+'
      ) value
    ) normalized
    where day is not null;
  end if;
  return coalesce(v_days, '{}'::text[]);
end
$$;

create function public.v2_2_internal_active_membership(p_center_id text, p_user_id uuid)
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
    and pg_catalog.lower(m.role) in ('owner', 'qtv', 'center_admin', 'admin')
  limit 1
$$;

create function public.v2_2_list_student_enrollments(p_center_id text)
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
  if v_actor is null then raise exception 'v2_2_not_authenticated'; end if;
  select * into v_membership
  from public.v2_2_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'v2_2_center_access_denied'; end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'AUTHORITATIVE_SNAPSHOT',
    'center_id', p_center_id,
    'enrollment_sets', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'student_id', s.student_local_id,
        'version', s.version,
        'enrollments', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'class_session_id', e.class_session_local_id,
            'weekdays', e.weekdays
          ) order by e.class_session_local_id)
          from public.center_student_recurring_enrollments e
          where e.center_id = s.center_id
            and e.student_local_id = s.student_local_id
            and e.ended_at is null
        ), '[]'::jsonb)
      ) order by s.student_local_id)
      from public.center_student_enrollment_sets s
      where s.center_id = p_center_id and s.ended_at is null
    ), '[]'::jsonb)
  );
end
$$;

create function public.v2_2_internal_guard_core_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_class public.center_cloud_entities;
  v_class_id text;
  v_day text;
  v_class_days text[];
begin
  if new.entity_type = 'class_session' then
    v_class_days := public.v2_2_internal_class_weekdays(new.payload);
    if exists (
      select 1
      from public.center_student_recurring_enrollments e
      where e.center_id = new.center_id
        and e.class_session_local_id = new.local_id
        and e.ended_at is null
        and (new.deleted_at is not null or not (e.weekdays <@ v_class_days))
    ) then
      raise exception 'v2_2_class_weekday_in_use';
    end if;
  elsif new.entity_type = 'schedule_session'
      and new.deleted_at is null
      and pg_catalog.lower(coalesce(new.payload->>'scheduleType', 'recurring')) <> 'oneoff' then
    v_class_id := pg_catalog.btrim(coalesce(new.payload->>'classSessionId', ''));
    v_day := public.v2_2_internal_normalize_weekday(new.payload->>'dayOfWeek');
    if v_class_id = '' or v_day is null then
      raise exception 'v2_2_schedule_class_link_required';
    end if;
    select * into v_class
    from public.center_cloud_entities e
    where e.center_id = new.center_id
      and e.entity_type = 'class_session'
      and e.local_id = v_class_id
      and e.deleted_at is null;
    if v_class.id is null or not (v_day = any(public.v2_2_internal_class_weekdays(v_class.payload))) then
      raise exception 'v2_2_schedule_class_link_required';
    end if;
  end if;
  return new;
end
$$;

create trigger v2_2_guard_core_identity
before insert or update on public.center_cloud_entities
for each row execute function public.v2_2_internal_guard_core_identity();

create function public.v2_2_mutate_student_with_enrollments(
  p_center_id text,
  p_student_local_id text,
  p_expected_student_version bigint,
  p_student_payload jsonb,
  p_expected_enrollment_version bigint,
  p_enrollments jsonb,
  p_idempotency_key uuid,
  p_operation text default 'UPSERT'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_membership public.center_members;
  v_operation text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_operation, '')));
  v_student_id text := pg_catalog.btrim(coalesce(p_student_local_id, ''));
  v_student_payload jsonb;
  v_item jsonb;
  v_class_id text;
  v_weekday_value text;
  v_weekday text;
  v_weekdays text[];
  v_class public.center_cloud_entities;
  v_seen_classes text[] := '{}'::text[];
  v_normalized jsonb := '[]'::jsonb;
  v_intent bytea;
  v_existing_command public.center_student_enrollment_command_results;
  v_set public.center_student_enrollment_sets;
  v_core jsonb;
  v_result jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_actor is null then raise exception 'v2_2_not_authenticated'; end if;
  if pg_catalog.btrim(coalesce(p_center_id, '')) = '' or v_student_id = ''
     or p_idempotency_key is null or v_operation not in ('UPSERT', 'DELETE')
     or p_expected_student_version is null or p_expected_student_version < 0
     or p_expected_enrollment_version is null or p_expected_enrollment_version < 0 then
    raise exception 'v2_2_invalid_command';
  end if;
  select * into v_membership
  from public.v2_2_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'v2_2_center_access_denied'; end if;
  if pg_catalog.lower(v_membership.role) not in ('owner', 'qtv', 'center_admin', 'admin') then
    raise exception 'v2_2_write_role_required';
  end if;

  if v_operation = 'UPSERT' then
    if p_student_payload is null or pg_catalog.jsonb_typeof(p_student_payload) <> 'object'
       or pg_catalog.btrim(coalesce(p_student_payload->>'id', '')) <> v_student_id
       or pg_catalog.jsonb_typeof(p_enrollments) <> 'array'
       or pg_catalog.jsonb_array_length(p_enrollments) > 100 then
      raise exception 'v2_2_invalid_command';
    end if;
    v_student_payload := p_student_payload
      - 'cloudVersion' - 'cloudUpdatedAt' - 'cloudDeletedAt' - 'updatedAt'
      - 'classSessionIds' - 'recurringEnrollments' - 'enrollmentVersion'
      - 'enrollmentAuthority' - 'enrollmentReview' - 'useAuthoritativeEnrollment';

    for v_item in select value from pg_catalog.jsonb_array_elements(p_enrollments)
    loop
      if pg_catalog.jsonb_typeof(v_item) <> 'object'
         or pg_catalog.jsonb_typeof(v_item->'weekdays') <> 'array' then
        raise exception 'v2_2_invalid_command';
      end if;
      v_class_id := pg_catalog.btrim(coalesce(v_item->>'class_session_id', ''));
      if v_class_id = '' or v_class_id = any(v_seen_classes) then
        raise exception 'v2_2_duplicate_student_class';
      end if;
      v_seen_classes := pg_catalog.array_append(v_seen_classes, v_class_id);
      v_weekdays := '{}'::text[];
      for v_weekday_value in select value from pg_catalog.jsonb_array_elements_text(v_item->'weekdays')
      loop
        v_weekday := public.v2_2_internal_normalize_weekday(v_weekday_value);
        if v_weekday is null or v_weekday = any(v_weekdays) then
          raise exception 'v2_2_invalid_weekday';
        end if;
        v_weekdays := pg_catalog.array_append(v_weekdays, v_weekday);
      end loop;
      if cardinality(v_weekdays) = 0 then raise exception 'v2_2_weekday_required'; end if;
      select * into v_class
      from public.center_cloud_entities e
      where e.center_id = p_center_id and e.entity_type = 'class_session'
        and e.local_id = v_class_id and e.deleted_at is null
      for share;
      if v_class.id is null then raise exception 'v2_2_class_session_not_found'; end if;
      if not (v_weekdays <@ public.v2_2_internal_class_weekdays(v_class.payload)) then
        raise exception 'v2_2_weekday_not_in_class';
      end if;
      v_normalized := v_normalized || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'class_session_id', v_class_id,
        'weekdays', v_weekdays
      ));
    end loop;
    select coalesce(pg_catalog.jsonb_agg(value order by value->>'class_session_id'), '[]'::jsonb)
      into v_normalized from pg_catalog.jsonb_array_elements(v_normalized);
  else
    v_student_payload := '{}'::jsonb;
    v_normalized := '[]'::jsonb;
  end if;

  v_intent := extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'contract', 1, 'center_id', p_center_id, 'student_id', v_student_id,
    'student_version', p_expected_student_version,
    'enrollment_version', p_expected_enrollment_version,
    'operation', v_operation, 'student_payload', v_student_payload,
    'enrollments', v_normalized
  )::text, 'UTF8'), 'sha256');

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'v2.2.student.command|' || p_center_id || '|' || v_actor::text || '|' || p_idempotency_key::text, 0));
  select * into v_existing_command
  from public.center_student_enrollment_command_results r
  where r.center_id = p_center_id and r.actor_user_id = v_actor
    and r.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing_command.intent_digest <> v_intent then raise exception 'v2_2_idempotency_conflict'; end if;
    return v_existing_command.result_snapshot || pg_catalog.jsonb_build_object('replayed', true);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'v2.2.student|' || p_center_id || '|' || v_student_id, 0));
  select * into v_set
  from public.center_student_enrollment_sets s
  where s.center_id = p_center_id and s.student_local_id = v_student_id
  for update;
  if (v_set.student_local_id is null and p_expected_enrollment_version <> 0)
     or (v_set.student_local_id is not null and v_set.version <> p_expected_enrollment_version) then
    raise exception 'v2_2_enrollment_version_conflict';
  end if;

  v_core := public.c5_1_mutate_core_entity(
    p_center_id, 'student', v_student_id, p_expected_student_version,
    v_student_payload, p_idempotency_key, v_operation);
  if coalesce((v_core->>'ok')::boolean, false) is not true then return v_core; end if;

  if v_set.student_local_id is null then
    insert into public.center_student_enrollment_sets(
      center_id, student_local_id, version, ended_at,
      created_by_membership_id, updated_by_membership_id
    ) values (p_center_id, v_student_id, 1,
      case when v_operation = 'DELETE' then v_now else null end,
      v_membership.id, v_membership.id)
    returning * into v_set;
  else
    update public.center_student_enrollment_sets s
    set version = s.version + 1,
        ended_at = case when v_operation = 'DELETE' then v_now else null end,
        updated_at = v_now,
        updated_by_membership_id = v_membership.id
    where s.center_id = p_center_id and s.student_local_id = v_student_id
    returning * into v_set;
  end if;

  update public.center_student_recurring_enrollments e
  set ended_at = v_now, ended_by_membership_id = v_membership.id
  where e.center_id = p_center_id and e.student_local_id = v_student_id and e.ended_at is null;
  if v_operation = 'UPSERT' then
    insert into public.center_student_recurring_enrollments(
      center_id, student_local_id, class_session_local_id, weekdays,
      enrollment_set_version, created_by_membership_id
    )
    select p_center_id, v_student_id, item->>'class_session_id',
      array(select value from pg_catalog.jsonb_array_elements_text(item->'weekdays')),
      v_set.version, v_membership.id
    from pg_catalog.jsonb_array_elements(v_normalized) item;
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', case when v_operation = 'DELETE' then 'DELETED' else 'COMMITTED' end,
    'center_id', p_center_id,
    'student_local_id', v_student_id,
    'student_version', (v_core->>'entity_version')::bigint,
    'student_updated_at', v_core->>'updated_at',
    'student_payload', v_core->'payload',
    'enrollment_set', case when v_operation = 'DELETE' then null else pg_catalog.jsonb_build_object(
      'student_id', v_student_id, 'version', v_set.version, 'enrollments', v_normalized
    ) end,
    'replayed', false
  );
  insert into public.center_student_enrollment_command_results(
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (p_center_id, v_actor, p_idempotency_key, v_intent, v_result);
  insert into public.center_student_enrollment_audit_events(
    center_id, actor_user_id, actor_membership_id, idempotency_key, operation,
    student_local_id, student_version, enrollment_version, enrollment_count
  ) values (
    p_center_id, v_actor, v_membership.id, p_idempotency_key, v_operation,
    v_student_id, (v_core->>'entity_version')::bigint, v_set.version,
    pg_catalog.jsonb_array_length(v_normalized)
  );
  return v_result;
end
$$;

revoke all on function public.v2_2_internal_normalize_weekday(text) from public, anon, authenticated, service_role;
revoke all on function public.v2_2_internal_class_weekdays(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.v2_2_internal_active_membership(text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.v2_2_internal_guard_core_identity() from public, anon, authenticated, service_role;
revoke all on function public.v2_2_list_student_enrollments(text) from public, anon, authenticated, service_role;
revoke all on function public.v2_2_mutate_student_with_enrollments(text,text,bigint,jsonb,bigint,jsonb,uuid,text)
  from public, anon, authenticated, service_role;
grant execute on function public.v2_2_list_student_enrollments(text) to authenticated;
grant execute on function public.v2_2_mutate_student_with_enrollments(text,text,bigint,jsonb,bigint,jsonb,uuid,text)
  to authenticated;

comment on table public.center_student_enrollment_sets is
  'Versioned per-Student authoritative recurring enrollment snapshot. A missing row means legacy/unreviewed, not an empty authoritative enrollment.';
comment on table public.center_student_recurring_enrollments is
  'Append-preserved Student to class-session recurring weekday selections. One-off participation is intentionally excluded.';
comment on function public.v2_2_mutate_student_with_enrollments(text,text,bigint,jsonb,bigint,jsonb,uuid,text) is
  'Atomic exact-center Student plus individualized recurring enrollment command with optimistic versions and idempotent retry.';

commit;
