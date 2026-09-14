begin;

-- V2-8A keeps V2-3 attendance, V2-4 package/Finance semantics, C5.7
-- review completion, and V2-2 schedules authoritative. This migration adds
-- only the two missing exact-center facts: a per-cycle TBHP-sent checkpoint
-- and a note attached to one concrete attendance occurrence.

do $$
begin
  if pg_catalog.to_regclass('public.center_cloud_entities') is null
     or pg_catalog.to_regclass('public.center_operational_attendance_notes') is null
     or pg_catalog.to_regclass('public.center_tuition_package_cycles') is null
     or pg_catalog.to_regclass('public.center_tuition_package_cycle_projection') is null
     or pg_catalog.to_regclass('public.center_tuition_attendance_contributions') is null
     or pg_catalog.to_regprocedure('public.v2_3_internal_occurrence_attendance_local_id(text,text,date,text)') is null
     or pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'v2_8a_missing_prerequisite';
  end if;
end
$$;

create table public.center_attendance_cycle_checkpoints (
  center_id text not null references public.centers(id) on delete restrict,
  cycle_id uuid not null,
  student_local_id text not null,
  tbhp_sent_at timestamptz not null,
  tbhp_sent_by_user_id uuid not null references auth.users(id) on delete restrict,
  tbhp_sent_by_membership_id uuid not null references public.center_members(id) on delete restrict,
  tbhp_sent_by_role text not null,
  version bigint not null default 1 check (version >= 1),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (center_id, cycle_id),
  foreign key (center_id, cycle_id)
    references public.center_tuition_package_cycles(center_id, id) on delete restrict,
  constraint center_attendance_cycle_checkpoints_student_check
    check (char_length(btrim(student_local_id)) between 1 and 200),
  constraint center_attendance_cycle_checkpoints_role_check
    check (char_length(btrim(tbhp_sent_by_role)) between 1 and 80)
);

create index center_attendance_cycle_checkpoints_student_idx
  on public.center_attendance_cycle_checkpoints(center_id, student_local_id, updated_at desc);

create table public.center_attendance_occurrence_notes (
  center_id text not null references public.centers(id) on delete restrict,
  id uuid not null default gen_random_uuid(),
  student_local_id text not null,
  schedule_session_local_id text not null,
  occurrence_date date not null,
  note text not null default '',
  version bigint not null default 1 check (version >= 1),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_by_membership_id uuid not null references public.center_members(id) on delete restrict,
  created_by_role text not null,
  updated_by_user_id uuid not null references auth.users(id) on delete restrict,
  updated_by_membership_id uuid not null references public.center_members(id) on delete restrict,
  updated_by_role text not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (center_id, id),
  unique (center_id, student_local_id, schedule_session_local_id, occurrence_date),
  constraint center_attendance_occurrence_notes_student_check
    check (char_length(btrim(student_local_id)) between 1 and 200),
  constraint center_attendance_occurrence_notes_session_check
    check (char_length(btrim(schedule_session_local_id)) between 1 and 240),
  constraint center_attendance_occurrence_notes_note_check
    check (char_length(note) <= 4000),
  constraint center_attendance_occurrence_notes_role_check
    check (char_length(btrim(created_by_role)) between 1 and 80
      and char_length(btrim(updated_by_role)) between 1 and 80)
);

create index center_attendance_occurrence_notes_date_idx
  on public.center_attendance_occurrence_notes(center_id, occurrence_date desc, student_local_id);

create table public.center_attendance_operation_command_results (
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  intent_digest bytea not null check (octet_length(intent_digest) = 32),
  result_snapshot jsonb not null check (jsonb_typeof(result_snapshot) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  primary key (center_id, actor_user_id, idempotency_key)
);

create table public.center_attendance_operation_audit_events (
  id bigint generated always as identity primary key,
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_membership_id uuid not null references public.center_members(id) on delete restrict,
  actor_role text not null,
  operation text not null check (operation in ('MARK_TBHP_SENT', 'UPSERT_CELL_NOTE')),
  entity_type text not null check (entity_type in ('TBHP_CHECKPOINT', 'CELL_NOTE')),
  entity_identity text not null,
  idempotency_key uuid not null,
  before_state jsonb,
  after_state jsonb not null check (jsonb_typeof(after_state) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  constraint center_attendance_operation_audit_role_check
    check (char_length(btrim(actor_role)) between 1 and 80),
  constraint center_attendance_operation_audit_identity_check
    check (char_length(btrim(entity_identity)) between 1 and 700)
);

create index center_attendance_operation_audit_center_idx
  on public.center_attendance_operation_audit_events(center_id, created_at desc, id desc);

alter table public.center_attendance_cycle_checkpoints enable row level security;
alter table public.center_attendance_cycle_checkpoints force row level security;
alter table public.center_attendance_occurrence_notes enable row level security;
alter table public.center_attendance_occurrence_notes force row level security;
alter table public.center_attendance_operation_command_results enable row level security;
alter table public.center_attendance_operation_command_results force row level security;
alter table public.center_attendance_operation_audit_events enable row level security;
alter table public.center_attendance_operation_audit_events force row level security;

revoke all on table public.center_attendance_cycle_checkpoints
  from public, anon, authenticated, service_role;
revoke all on table public.center_attendance_occurrence_notes
  from public, anon, authenticated, service_role;
revoke all on table public.center_attendance_operation_command_results
  from public, anon, authenticated, service_role;
revoke all on table public.center_attendance_operation_audit_events
  from public, anon, authenticated, service_role;
revoke all on sequence public.center_attendance_operation_audit_events_id_seq
  from public, anon, authenticated, service_role;

grant all on table public.center_attendance_cycle_checkpoints to service_role;
grant all on table public.center_attendance_occurrence_notes to service_role;
grant all on table public.center_attendance_operation_command_results to service_role;
grant select, insert on table public.center_attendance_operation_audit_events to service_role;
grant usage, select on sequence public.center_attendance_operation_audit_events_id_seq to service_role;

create view public.center_attendance_operational_reminder_projection
with (security_invoker = false)
as
with cycle_scope as (
  select
    c.center_id,
    c.id as cycle_id,
    c.student_local_id,
    c.cycle_number,
    c.origin,
    c.lifecycle_status,
    c.baseline_cutoff_date,
    c.baseline_used_sessions,
    c.total_sessions_snapshot,
    p.used_sessions,
    p.remaining_sessions,
    p.payment_status,
    case
      when c.total_sessions_snapshot is null then null
      when c.baseline_used_sessions >= greatest(c.total_sessions_snapshot - 4, 0)
        then c.baseline_cutoff_date
      else (
        select min(reached.occurrence_date)
        from (
          select
            contribution.occurrence_date,
            c.baseline_used_sessions + sum(contribution.contribution_units) over (
              order by contribution.occurrence_date, contribution.schedule_session_local_id, contribution.id
            ) as used_after
          from public.center_tuition_attendance_contributions contribution
          where contribution.center_id = c.center_id
            and contribution.cycle_id = c.id
            and contribution.ended_at is null
            and contribution.allocation_state = 'APPLIED'
        ) reached
        where reached.used_after >= greatest(c.total_sessions_snapshot - 4, 0)
      )
    end as review_trigger_date
    ,case
      when c.total_sessions_snapshot is null then null
      when c.baseline_used_sessions >= greatest(c.total_sessions_snapshot - 2, 0)
        then c.baseline_cutoff_date
      else (
        select min(reached.occurrence_date)
        from (
          select
            contribution.occurrence_date,
            c.baseline_used_sessions + sum(contribution.contribution_units) over (
              order by contribution.occurrence_date, contribution.schedule_session_local_id, contribution.id
            ) as used_after
          from public.center_tuition_attendance_contributions contribution
          where contribution.center_id = c.center_id
            and contribution.cycle_id = c.id
            and contribution.ended_at is null
            and contribution.allocation_state = 'APPLIED'
        ) reached
        where reached.used_after >= greatest(c.total_sessions_snapshot - 2, 0)
      )
    end as tbhp_trigger_date
  from public.center_tuition_package_cycles c
  join public.center_tuition_package_cycle_projection p
    on p.center_id = c.center_id and p.id = c.id
  where c.lifecycle_status <> 'SUPERSEDED'
    and exists (
      select 1
      from public.center_cloud_entities student
      where student.center_id = c.center_id
        and student.entity_type = 'student'
        and student.local_id = c.student_local_id
        and student.deleted_at is null
    )
), reminder_rows as (
  select
    cycle.center_id,
    cycle.student_local_id,
    cycle.cycle_id,
    cycle.cycle_number,
    'REVIEW_UPDATE_DUE'::text as signal,
    'Cập nhật nhận xét'::text as label,
    case when cycle.remaining_sessions = 0 then 'danger' else 'warning' end::text as severity,
    cycle.remaining_sessions,
    cycle.review_trigger_date as trigger_date,
    0::bigint as checkpoint_version
  from cycle_scope cycle
  where cycle.total_sessions_snapshot is not null
    and cycle.remaining_sessions <= 4
    and cycle.review_trigger_date is not null
    and not exists (
      select 1
      from public.center_operational_attendance_notes review_note
      where review_note.center_id = cycle.center_id
        and review_note.note_kind = 'ATTENDANCE_ADVISORY'
        and review_note.student_local_id = cycle.student_local_id
        and review_note.care_status = 'sentComment'
        and review_note.updated_at::date >= cycle.review_trigger_date
    )

  union all

  select
    cycle.center_id,
    cycle.student_local_id,
    cycle.cycle_id,
    cycle.cycle_number,
    'TBHP_SEND_DUE'::text,
    'Cần gửi TBHP'::text,
    case when cycle.remaining_sessions = 0 then 'danger' else 'warning' end::text,
    cycle.remaining_sessions,
    cycle.tbhp_trigger_date,
    coalesce(checkpoint.version, 0)
  from cycle_scope cycle
  left join public.center_attendance_cycle_checkpoints checkpoint
    on checkpoint.center_id = cycle.center_id and checkpoint.cycle_id = cycle.cycle_id
  where cycle.total_sessions_snapshot is not null
    and cycle.remaining_sessions <= 2
    and cycle.tbhp_trigger_date is not null
    and checkpoint.tbhp_sent_at is null

  union all

  select
    cycle.center_id,
    cycle.student_local_id,
    cycle.cycle_id,
    cycle.cycle_number,
    'PAYMENT_CHECK_DUE'::text,
    'Kiểm tra đã hoàn tất thu chưa'::text,
    'danger'::text,
    cycle.remaining_sessions,
    coalesce((
      select min(contribution.occurrence_date)
      from public.center_tuition_attendance_contributions contribution
      where contribution.center_id = cycle.center_id
        and contribution.cycle_id = cycle.cycle_id
        and contribution.ended_at is null
        and contribution.allocation_state = 'APPLIED'
        and contribution.contribution_units = 1
    ), cycle.baseline_cutoff_date),
    0::bigint
  from cycle_scope cycle
  where cycle.origin = 'AUTOMATIC_ROLLOVER'
    and cycle.lifecycle_status = 'PROVISIONAL_UNPAID'
    and cycle.used_sessions >= 1
    and cycle.payment_status <> 'PAID'
)
select * from reminder_rows;

revoke all on table public.center_attendance_operational_reminder_projection
  from public, anon, authenticated, service_role;
grant select on table public.center_attendance_operational_reminder_projection to service_role;

create function public.v2_8a_list_attendance_operations(p_center_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_role text;
begin
  if v_actor is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED');
  end if;
  if v_center_id = '' or pg_catalog.length(v_center_id) > 160 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_CENTER');
  end if;
  select pg_catalog.lower(pg_catalog.replace(pg_catalog.replace(
      pg_catalog.btrim(member.role::text), '-', '_'), ' ', '_'))
    into v_role
  from public.center_members member
  join public.centers center_row on center_row.id = member.center_id
  where member.center_id = v_center_id
    and member.user_id = v_actor
    and pg_catalog.lower(pg_catalog.btrim(coalesce(member.status::text, ''))) = 'active'
    and pg_catalog.lower(pg_catalog.btrim(coalesce(center_row.status::text, ''))) = 'active'
  limit 1;
  if v_role is null or v_role not in ('owner', 'admin', 'center_admin', 'qtv') then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CENTER_ACCESS_DENIED');
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'AUTHORITATIVE_SNAPSHOT',
    'status', 'READY',
    'contract', 'v2.8a-attendance-operations-v1',
    'center_id', v_center_id,
    'reminders', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'center_id', reminder.center_id,
        'student_id', reminder.student_local_id,
        'cycle_id', reminder.cycle_id,
        'cycle_number', reminder.cycle_number,
        'signal', reminder.signal,
        'label', reminder.label,
        'severity', reminder.severity,
        'remaining_sessions', reminder.remaining_sessions,
        'trigger_date', reminder.trigger_date,
        'checkpoint_version', reminder.checkpoint_version
      ) order by reminder.student_local_id, reminder.cycle_number, reminder.signal)
      from public.center_attendance_operational_reminder_projection reminder
      where reminder.center_id = v_center_id
    ), '[]'::jsonb),
    'tbhp_checkpoints', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'center_id', checkpoint.center_id,
        'cycle_id', checkpoint.cycle_id,
        'student_id', checkpoint.student_local_id,
        'tbhp_sent_at', checkpoint.tbhp_sent_at,
        'tbhp_sent_by_user_id', checkpoint.tbhp_sent_by_user_id,
        'version', checkpoint.version,
        'created_at', checkpoint.created_at,
        'updated_at', checkpoint.updated_at
      ) order by checkpoint.updated_at desc, checkpoint.cycle_id)
      from public.center_attendance_cycle_checkpoints checkpoint
      where checkpoint.center_id = v_center_id
    ), '[]'::jsonb),
    'cell_notes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'center_id', occurrence_note.center_id,
        'id', occurrence_note.id,
        'student_id', occurrence_note.student_local_id,
        'schedule_session_id', occurrence_note.schedule_session_local_id,
        'occurrence_date', occurrence_note.occurrence_date,
        'note', occurrence_note.note,
        'version', occurrence_note.version,
        'created_by_user_id', occurrence_note.created_by_user_id,
        'updated_by_user_id', occurrence_note.updated_by_user_id,
        'created_at', occurrence_note.created_at,
        'updated_at', occurrence_note.updated_at
      ) order by occurrence_note.occurrence_date desc, occurrence_note.student_local_id, occurrence_note.schedule_session_local_id)
      from public.center_attendance_occurrence_notes occurrence_note
      where occurrence_note.center_id = v_center_id
    ), '[]'::jsonb)
  );
end
$$;

create function public.v2_8a_mutate_attendance_operation(
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
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_role text;
  v_membership_id uuid;
  v_operation text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', '')));
  v_expected_version bigint;
  v_digest bytea;
  v_existing_result public.center_attendance_operation_command_results%rowtype;
  v_cycle public.center_tuition_package_cycles%rowtype;
  v_checkpoint public.center_attendance_cycle_checkpoints%rowtype;
  v_occurrence_note public.center_attendance_occurrence_notes%rowtype;
  v_cycle_id uuid;
  v_note_id uuid;
  v_student_id text;
  v_schedule_session_id text;
  v_occurrence_date date;
  v_note text;
  v_remaining_sessions integer;
  v_now timestamptz := clock_timestamp();
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_entity_type text;
  v_entity_identity text;
begin
  if v_actor is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED');
  end if;
  if v_center_id = '' or pg_catalog.length(v_center_id) > 160 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_CENTER');
  end if;
  if p_idempotency_key is null or p_command is null
     or pg_catalog.jsonb_typeof(p_command) <> 'object'
     or pg_catalog.octet_length(pg_catalog.convert_to(p_command::text, 'UTF8')) > 65536
     or v_operation not in ('MARK_TBHP_SENT', 'UPSERT_CELL_NOTE') then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;
  begin
    v_expected_version := (p_command->>'expected_version')::bigint;
  exception when others then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end;
  if v_expected_version is null or v_expected_version < 0 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;

  select pg_catalog.lower(pg_catalog.replace(pg_catalog.replace(
      pg_catalog.btrim(member.role::text), '-', '_'), ' ', '_')), member.id
    into v_role, v_membership_id
  from public.center_members member
  join public.centers center_row on center_row.id = member.center_id
  where member.center_id = v_center_id
    and member.user_id = v_actor
    and pg_catalog.lower(pg_catalog.btrim(coalesce(member.status::text, ''))) = 'active'
    and pg_catalog.lower(pg_catalog.btrim(coalesce(center_row.status::text, ''))) = 'active'
  limit 1
  for share of member, center_row;
  if v_role is null or v_membership_id is null
     or v_role not in ('owner', 'admin', 'center_admin', 'qtv') then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CENTER_ACCESS_DENIED');
  end if;

  v_digest := extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'contract_version', 1,
    'center_id', v_center_id,
    'command', p_command
  )::text, 'UTF8'), 'sha256');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'v2.8a.attendance.operation|' || v_center_id || '|' || v_actor::text || '|' || p_idempotency_key::text,
    0
  ));
  select * into v_existing_result
  from public.center_attendance_operation_command_results result_row
  where result_row.center_id = v_center_id
    and result_row.actor_user_id = v_actor
    and result_row.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing_result.intent_digest <> v_digest then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return v_existing_result.result_snapshot || pg_catalog.jsonb_build_object('replayed', true);
  end if;

  if v_operation = 'MARK_TBHP_SENT' then
    begin
      v_cycle_id := (p_command->>'cycle_id')::uuid;
    exception when others then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end;
    select cycle.* into v_cycle
    from public.center_tuition_package_cycles cycle
    where cycle.center_id = v_center_id and cycle.id = v_cycle_id
    for update;
    if not found or v_cycle.lifecycle_status = 'SUPERSEDED' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_NOT_FOUND_OR_DENIED');
    end if;
    select projection.remaining_sessions into v_remaining_sessions
    from public.center_tuition_package_cycle_projection projection
    where projection.center_id = v_center_id and projection.id = v_cycle_id;
    if v_remaining_sessions is null or v_remaining_sessions > 2 then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'REMINDER_NOT_DUE');
    end if;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'v2.8a.tbhp|' || v_center_id || '|' || v_cycle_id::text, 0));
    select * into v_checkpoint
    from public.center_attendance_cycle_checkpoints checkpoint
    where checkpoint.center_id = v_center_id and checkpoint.cycle_id = v_cycle_id
    for update;
    if found or v_expected_version <> 0 then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    insert into public.center_attendance_cycle_checkpoints(
      center_id, cycle_id, student_local_id, tbhp_sent_at,
      tbhp_sent_by_user_id, tbhp_sent_by_membership_id, tbhp_sent_by_role,
      version, created_at, updated_at
    ) values (
      v_center_id, v_cycle_id, v_cycle.student_local_id, v_now,
      v_actor, v_membership_id, v_role, 1, v_now, v_now
    ) returning * into v_checkpoint;
    v_before := null;
    v_after := pg_catalog.jsonb_build_object(
      'cycle_id', v_checkpoint.cycle_id,
      'student_id', v_checkpoint.student_local_id,
      'tbhp_sent_at', v_checkpoint.tbhp_sent_at,
      'version', v_checkpoint.version
    );
    v_entity_type := 'TBHP_CHECKPOINT';
    v_entity_identity := v_cycle_id::text;

  else
    v_student_id := pg_catalog.btrim(coalesce(p_command->>'student_id', ''));
    v_schedule_session_id := pg_catalog.btrim(coalesce(p_command->>'schedule_session_id', ''));
    v_note := coalesce(p_command->>'note', '');
    begin
      v_occurrence_date := (p_command->>'occurrence_date')::date;
      v_note_id := nullif(p_command->>'note_id', '')::uuid;
    exception when others then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end;
    if v_student_id = '' or pg_catalog.length(v_student_id) > 200
       or v_schedule_session_id = '' or pg_catalog.length(v_schedule_session_id) > 240
       or coalesce(p_command->>'occurrence_date', '') <> v_occurrence_date::text
       or pg_catalog.length(v_note) > 4000
       or v_student_id ~ '[[:cntrl:]]'
       or v_schedule_session_id ~ '[[:cntrl:]]' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    if not exists (
      select 1
      from public.center_cloud_entities attendance
      where attendance.center_id = v_center_id
        and attendance.entity_type = 'attendance_record'
        and attendance.deleted_at is null
        and attendance.payload->>'studentId' = v_student_id
        and attendance.payload->>'scheduleSessionId' = v_schedule_session_id
        and attendance.payload->>'date' = v_occurrence_date::text
    ) then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'OCCURRENCE_NOT_FOUND_OR_DENIED');
    end if;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'v2.8a.cell-note|' || v_center_id || '|' || v_student_id || '|'
        || v_schedule_session_id || '|' || v_occurrence_date::text,
      0
    ));
    select * into v_occurrence_note
    from public.center_attendance_occurrence_notes occurrence_note
    where occurrence_note.center_id = v_center_id
      and occurrence_note.student_local_id = v_student_id
      and occurrence_note.schedule_session_local_id = v_schedule_session_id
      and occurrence_note.occurrence_date = v_occurrence_date
    for update;
    if found then
      if v_note_id is null or v_note_id <> v_occurrence_note.id
         or v_expected_version <> v_occurrence_note.version then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
      end if;
      v_before := pg_catalog.jsonb_build_object(
        'id', v_occurrence_note.id,
        'note', v_occurrence_note.note,
        'version', v_occurrence_note.version
      );
      update public.center_attendance_occurrence_notes
      set note = v_note,
          version = v_occurrence_note.version + 1,
          updated_by_user_id = v_actor,
          updated_by_membership_id = v_membership_id,
          updated_by_role = v_role,
          updated_at = v_now
      where center_id = v_center_id and id = v_occurrence_note.id
      returning * into v_occurrence_note;
    else
      if v_note_id is not null or v_expected_version <> 0 then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
      end if;
      insert into public.center_attendance_occurrence_notes(
        center_id, student_local_id, schedule_session_local_id, occurrence_date,
        note, version, created_by_user_id, created_by_membership_id, created_by_role,
        updated_by_user_id, updated_by_membership_id, updated_by_role,
        created_at, updated_at
      ) values (
        v_center_id, v_student_id, v_schedule_session_id, v_occurrence_date,
        v_note, 1, v_actor, v_membership_id, v_role,
        v_actor, v_membership_id, v_role, v_now, v_now
      ) returning * into v_occurrence_note;
      v_before := null;
    end if;
    v_after := pg_catalog.jsonb_build_object(
      'id', v_occurrence_note.id,
      'student_id', v_occurrence_note.student_local_id,
      'schedule_session_id', v_occurrence_note.schedule_session_local_id,
      'occurrence_date', v_occurrence_note.occurrence_date,
      'note', v_occurrence_note.note,
      'version', v_occurrence_note.version
    );
    v_entity_type := 'CELL_NOTE';
    v_entity_identity := v_student_id || '|' || v_schedule_session_id || '|' || v_occurrence_date::text;
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'COMMITTED',
    'center_id', v_center_id,
    'operation', v_operation,
    'entity_type', v_entity_type,
    'entity', v_after
  );
  insert into public.center_attendance_operation_audit_events(
    center_id, actor_user_id, actor_membership_id, actor_role, operation,
    entity_type, entity_identity, idempotency_key, before_state, after_state, created_at
  ) values (
    v_center_id, v_actor, v_membership_id, v_role, v_operation,
    v_entity_type, v_entity_identity, p_idempotency_key, v_before, v_after, v_now
  );
  insert into public.center_attendance_operation_command_results(
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot, created_at
  ) values (v_center_id, v_actor, p_idempotency_key, v_digest, v_result, v_now);
  return v_result;
end
$$;

revoke all on function public.v2_8a_list_attendance_operations(text)
  from public, anon, authenticated, service_role;
revoke all on function public.v2_8a_mutate_attendance_operation(text, jsonb, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.v2_8a_list_attendance_operations(text) to authenticated;
grant execute on function public.v2_8a_mutate_attendance_operation(text, jsonb, uuid) to authenticated;

comment on table public.center_attendance_cycle_checkpoints is
  'V2-8A exact-center, cycle-scoped evidence that TBHP was sent. Notification read state never writes this table.';
comment on table public.center_attendance_occurrence_notes is
  'V2-8A note evidence for one exact attendance occurrence; saving never changes attendance state.';
comment on view public.center_attendance_operational_reminder_projection is
  'V2-8A shared authoritative reminder derivation consumed by Attendance Board and Notification Center.';
comment on function public.v2_8a_mutate_attendance_operation(text, jsonb, uuid) is
  'Owner/Admin ordinary-operation boundary for TBHP completion and exact-occurrence notes; no schedule, attendance-state, package, or Finance mutation.';

commit;
