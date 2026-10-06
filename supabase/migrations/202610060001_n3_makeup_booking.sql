-- N3.2: a planned, single-occurrence participant; never Attendance or Tuition.
create table public.center_makeup_bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  center_id text not null references public.centers(id),
  student_local_id text not null,
  source_attendance_local_id text not null,
  destination_schedule_local_id text not null,
  destination_date date not null,
  state text not null default 'PLANNED' check (state in ('PLANNED','CANCELLED')),
  version bigint not null default 1 check (version>0),
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (center_id,destination_schedule_local_id,destination_date)
    references public.center_schedule_occurrences(center_id,schedule_session_local_id,occurrence_date)
);
create unique index n3_makeup_source_active on public.center_makeup_bookings(center_id,source_attendance_local_id)
  where state='PLANNED';
create unique index n3_makeup_destination_student_active
  on public.center_makeup_bookings(center_id,destination_schedule_local_id,destination_date,student_local_id)
  where state='PLANNED';
alter table public.center_makeup_bookings enable row level security;
alter table public.center_makeup_bookings force row level security;
revoke all on public.center_makeup_bookings from public,anon,authenticated,service_role;

-- Completion is derived from the exact committed B. No second lifecycle write,
-- and no COMPLETED state can survive a failed Attendance/Audit transaction.
create function public.n3_internal_booking_completed(p_booking public.center_makeup_bookings)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.center_cloud_entities e
    where e.center_id=p_booking.center_id and e.entity_type='attendance_record' and e.deleted_at is null
      and e.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
      and e.payload->>'source' in ('admin','teacher','correction')
      and e.payload->>'studentId'=p_booking.student_local_id
      and e.payload->>'makeupForAttendanceLocalId'=p_booking.source_attendance_local_id
      and e.payload->>'scheduleSessionId'=p_booking.destination_schedule_local_id
      and e.payload->>'date'=p_booking.destination_date::text
      and e.payload->>'attendanceStatus'='makeup')
$$;

create function public.n3_internal_admit_booked_makeup(
  p_center text,p_student text,p_schedule text,p_date date,p_source text)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if nullif(p_source,'') is null then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('a4.missed|'||p_center||'|'||p_source,0));
  return exists(select 1 from public.center_makeup_bookings b
    join public.center_cloud_entities e on e.center_id=b.center_id and e.local_id=b.source_attendance_local_id
      and e.entity_type='attendance_record' and e.deleted_at is null
    where b.center_id=p_center and b.student_local_id=p_student and b.source_attendance_local_id=p_source
      and b.destination_schedule_local_id=p_schedule and b.destination_date=p_date and b.state='PLANNED'
      and e.payload->>'studentId'=p_student and e.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
      and e.payload->>'source' in ('admin','teacher','correction')
      and e.payload->>'attendanceStatus' in ('absent','excused','excusedAbsent','unexcusedAbsent'));
end $$;

create function public.n3_mutate_makeup_booking(p_center_id text,p_command jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_actor uuid:=auth.uid(); v_role public.center_members; v_operation text:=p_command->>'operation';
  v_student text:=p_command->>'studentId'; v_source text:=p_command->>'sourceAttendanceLocalId';
  v_schedule text:=p_command->>'destinationScheduleId'; v_date date;
  v_booking public.center_makeup_bookings; v_source_row public.center_cloud_entities;
  v_fact public.center_schedule_occurrences; v_source_fact public.center_schedule_occurrences;
  v_prior public.center_operational_command_result; v_digest bytea; v_result jsonb;
begin
  if v_actor is null or p_idempotency_key is null or pg_catalog.jsonb_typeof(p_command) is distinct from 'object'
    or v_operation is null or v_operation not in ('BOOK','CANCEL','RESCHEDULE')
    or coalesce(v_student,'')='' or coalesce(v_source,'')='' then raise exception 'n3_invalid_booking_command'; end if;
  select m.* into v_role from public.center_members m join public.centers c on c.id=m.center_id
    where m.center_id=p_center_id and m.user_id=v_actor and m.status='active' and c.status='active' for share of m,c;
  if v_role.id is null or pg_catalog.lower(v_role.role) not in ('owner','qtv','center_admin','admin') then
    raise exception 'n3_booking_access_denied'; end if;
  v_digest:=extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'contract','n3-makeup-booking-v1','center_id',p_center_id,'command',p_command)::text,'UTF8'),'sha256');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'n3.booking.command|'||p_center_id||'|'||v_actor::text||'|'||p_idempotency_key::text,0));
  select * into v_prior from public.center_operational_command_result
    where center_id=p_center_id and actor_user_id=v_actor and idempotency_key=p_idempotency_key;
  if found then
    if v_prior.intent_digest<>v_digest then raise exception 'n3_booking_idempotency_conflict'; end if;
    return v_prior.result_snapshot||pg_catalog.jsonb_build_object('replayed',true);
  end if;
  -- Same lock as A4, so cancellation/rescheduling and actual B serialize.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('a4.missed|'||p_center_id||'|'||v_source,0));
  if not exists(select 1 from public.center_cloud_entities where center_id=p_center_id
    and entity_type='student' and local_id=v_student and deleted_at is null) then raise exception 'n3_booking_student_missing'; end if;
  select * into v_booking from public.center_makeup_bookings where center_id=p_center_id
    and source_attendance_local_id=v_source and state='PLANNED';
  if v_operation='BOOK' then
    if v_booking.id is not null then raise exception 'n3_booking_already_planned'; end if;
  else
    if v_booking.id is null or v_booking.student_local_id<>v_student or
      v_booking.id::text is distinct from p_command->>'bookingId' or
      v_booking.version::text is distinct from p_command->>'expectedVersion' then
      raise exception 'n3_booking_version_conflict'; end if;
  end if;
  if exists(select 1 from public.center_cloud_entities e where e.center_id=p_center_id and e.entity_type='attendance_record'
    and e.deleted_at is null and e.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
    and e.payload->>'attendanceStatus'='makeup' and e.payload->>'makeupForAttendanceLocalId'=v_source) then
    raise exception 'n3_booking_already_completed'; end if;
  if v_operation<>'CANCEL' then
    select * into v_source_row from public.center_cloud_entities where center_id=p_center_id
      and entity_type='attendance_record' and local_id=v_source and deleted_at is null;
    if v_source_row.id is null or v_source_row.payload->>'studentId' is distinct from v_student
      or v_source_row.payload->>'attendanceAuthority' is distinct from 'v2.3-occurrence-v1'
      or coalesce(v_source_row.payload->>'source','') not in ('admin','teacher','correction')
      or coalesce(v_source_row.payload->>'attendanceStatus','') not in ('absent','excused','excusedAbsent','unexcusedAbsent') then
      raise exception 'n3_booking_source_not_absent'; end if;
    begin v_date:=(p_command->>'destinationDate')::date;
    exception when others then raise exception 'n3_booking_destination_invalid'; end;
    if v_date is null or v_date::text is distinct from p_command->>'destinationDate' then raise exception 'n3_booking_destination_invalid'; end if;
    select * into v_source_fact from public.center_schedule_occurrences where center_id=p_center_id
      and schedule_session_local_id=v_source_row.payload->>'scheduleSessionId'
      and occurrence_date=(v_source_row.payload->>'date')::date;
    if v_source_fact.center_id is null or v_source_fact.lifecycle_state<>'HELD'
      or v_source_fact.occurrence_date>(pg_catalog.clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date
      or v_date<=v_source_fact.occurrence_date then raise exception 'n3_booking_source_ineligible'; end if;
    select * into v_fact from public.center_schedule_occurrences where center_id=p_center_id
      and schedule_session_local_id=v_schedule and occurrence_date=v_date;
    if v_fact.center_id is null or v_fact.lifecycle_state='CANCELLED' then raise exception 'n3_booking_destination_invalid'; end if;
    if exists(select 1 from public.center_cloud_entities e where e.center_id=p_center_id
      and e.entity_type='attendance_record' and e.deleted_at is null and e.payload->>'source'<>'initialBaseline'
      and e.payload->>'studentId'=v_student and e.payload->>'scheduleSessionId'=v_schedule
      and e.payload->>'date'=v_date::text) then raise exception 'n3_booking_destination_already_marked'; end if;
  end if;
  if v_operation='BOOK' then
    insert into public.center_makeup_bookings(center_id,student_local_id,source_attendance_local_id,
      destination_schedule_local_id,destination_date,created_by,updated_by)
    values(p_center_id,v_student,v_source,v_schedule,v_date,v_actor,v_actor) returning * into v_booking;
  else
    update public.center_makeup_bookings set state=case when v_operation='CANCEL' then 'CANCELLED' else 'PLANNED' end,
      destination_schedule_local_id=case when v_operation='RESCHEDULE' then v_schedule else destination_schedule_local_id end,
      destination_date=case when v_operation='RESCHEDULE' then v_date else destination_date end,
      version=version+1,updated_by=v_actor,updated_at=pg_catalog.clock_timestamp()
      where id=v_booking.id returning * into v_booking;
  end if;
  v_result:=pg_catalog.jsonb_build_object('ok',true,'outcome_code','COMMITTED','center_id',p_center_id,
    'results',pg_catalog.jsonb_build_array(pg_catalog.to_jsonb(v_booking)),'replayed',false);
  insert into public.center_operational_command_result(id,center_id,actor_user_id,idempotency_key,intent_digest,mutation_count,result_snapshot)
    values(extensions.gen_random_uuid(),p_center_id,v_actor,p_idempotency_key,v_digest,1,v_result);
  return v_result;
end $$;

-- One read projection: current bookings and a bounded picker of existing facts.
create function public.n3_list_makeup_booking_context(p_center_id text,p_from_date date,p_to_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.center_members m join public.centers c on c.id=m.center_id
    where m.center_id=p_center_id and m.user_id=auth.uid() and m.status='active' and c.status='active'
      and pg_catalog.lower(m.role) in ('owner','qtv','center_admin','admin')) then raise exception 'n3_booking_access_denied'; end if;
  if p_from_date is null or p_to_date is null or p_to_date<p_from_date or p_to_date-p_from_date>365 then
    raise exception 'n3_booking_read_range_invalid'; end if;
  return pg_catalog.jsonb_build_object('ok',true,'center_id',p_center_id,
    'bookings',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(b)||pg_catalog.jsonb_build_object(
      'state',case when public.n3_internal_booking_completed(b) then 'COMPLETED' else b.state end,
      'source_date',e.payload->>'date','source_schedule_local_id',e.payload->>'scheduleSessionId','source_class_local_id',e.payload->>'classSessionId',
      'destination_class_local_id',o.class_session_local_id,'destination_start_time',o.planned_start_time))
      from public.center_makeup_bookings b join public.center_cloud_entities e
        on e.center_id=b.center_id and e.entity_type='attendance_record' and e.local_id=b.source_attendance_local_id
      join public.center_schedule_occurrences o on o.center_id=b.center_id
        and o.schedule_session_local_id=b.destination_schedule_local_id and o.occurrence_date=b.destination_date
      where b.center_id=p_center_id and b.state='PLANNED'
        and (b.destination_date between p_from_date and p_to_date
          or (e.payload->>'date')::date between p_from_date and p_to_date)),'[]'::jsonb),
    'destinations',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(o) order by o.occurrence_date,o.planned_start_time)
      from public.center_schedule_occurrences o where o.center_id=p_center_id and o.lifecycle_state<>'CANCELLED'
        and o.occurrence_date between p_from_date and p_to_date),'[]'::jsonb));
end $$;

-- Keep an active booked V historical; changing its reason remains allowed.
-- A regular-roster B must also honor an existing booking's exact destination.
create function public.n3_internal_guard_booking_attendance()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_source text; v_booking public.center_makeup_bookings;
begin
  if tg_op in ('UPDATE','DELETE') and old.entity_type='attendance_record'
    and old.deleted_at is null and old.payload->>'attendanceAuthority'='v2.3-occurrence-v1' then
    v_source:=case when old.payload->>'attendanceStatus'='makeup' then old.payload->>'makeupForAttendanceLocalId' else old.local_id end;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('a4.missed|'||old.center_id||'|'||v_source,0));
    if old.payload->>'attendanceStatus' in ('absent','excused','excusedAbsent','unexcusedAbsent')
      and exists(select 1 from public.center_makeup_bookings b where b.center_id=old.center_id
        and b.source_attendance_local_id=old.local_id and b.state='PLANNED') then
      if tg_op='DELETE' then raise exception 'n3_booked_absence_locked'; end if;
      if new.deleted_at is not null or new.center_id is distinct from old.center_id
        or new.entity_type is distinct from old.entity_type or new.local_id is distinct from old.local_id
        or new.payload->>'studentId' is distinct from old.payload->>'studentId'
        or new.payload->>'scheduleSessionId' is distinct from old.payload->>'scheduleSessionId'
        or new.payload->>'date' is distinct from old.payload->>'date'
        or new.payload->>'attendanceAuthority' is distinct from old.payload->>'attendanceAuthority'
        or coalesce(new.payload->>'source','') not in ('admin','teacher','correction')
        or coalesce(new.payload->>'attendanceStatus','') not in ('absent','excused','excusedAbsent','unexcusedAbsent')
        then raise exception 'n3_booked_absence_locked'; end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  if new.entity_type='attendance_record' and new.deleted_at is null
    and new.payload->>'attendanceAuthority'='v2.3-occurrence-v1' and new.payload->>'attendanceStatus'='makeup' then
    v_source:=new.payload->>'makeupForAttendanceLocalId';
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('a4.missed|'||new.center_id||'|'||v_source,0));
    select * into v_booking from public.center_makeup_bookings where center_id=new.center_id
      and source_attendance_local_id=v_source and state='PLANNED';
    if v_booking.id is not null and (v_booking.student_local_id is distinct from new.payload->>'studentId'
      or v_booking.destination_schedule_local_id is distinct from new.payload->>'scheduleSessionId'
      or v_booking.destination_date::text is distinct from new.payload->>'date') then raise exception 'n3_booking_destination_mismatch'; end if;
  end if;
  return new;
end $$;
create trigger n3_guard_booking_attendance before insert or update or delete on public.center_cloud_entities
  for each row execute function public.n3_internal_guard_booking_attendance();

-- Strictly patch only the two frozen roster checks. All N2 version checks,
-- private mutation, Tuition reconciliation, Audit and A4 checks stay intact.
do $patch$
declare v_def text; v_old text; v_new text;
begin
  v_def:=pg_catalog.pg_get_functiondef('public.v2_9_mutate_attendance_batch(text,jsonb,uuid)'::regprocedure);
  v_old:=$old$       or not (v_student=any(v_fact.roster_student_ids)) then$old$;
  v_new:=$new$       or (not (v_student=any(v_fact.roster_student_ids)) and not (
         (v_action='SET' and v_status='makeup' and public.n3_internal_admit_booked_makeup(v_center,v_student,v_schedule,v_date,v_target))
         or (v_action='UNMARK' and exists(select 1 from public.center_cloud_entities e
           where e.center_id=v_center and e.entity_type='attendance_record' and e.deleted_at is null
             and e.payload->>'attendanceAuthority'='v2.3-occurrence-v1' and e.payload->>'attendanceStatus'='makeup'
             and e.payload->>'studentId'=v_student and e.payload->>'scheduleSessionId'=v_schedule
             and e.payload->>'date'=v_date::text and public.n3_internal_admit_booked_makeup(
               v_center,v_student,v_schedule,v_date,e.payload->>'makeupForAttendanceLocalId'))))) then$new$;
  if pg_catalog.strpos(v_def,v_old)=0 or pg_catalog.strpos(v_def,'n3_internal_')>0 then raise exception 'n3_n2_roster_contract_mismatch'; end if;
  execute pg_catalog.replace(v_def,v_old,v_new);
  v_def:=pg_catalog.pg_get_functiondef('public.v2_3_internal_guard_occurrence_attendance()'::regprocedure);
  v_old:=$old$  if not (v_student_id = any(v_occurrence.roster_student_ids)) then$old$;
  v_new:=$new$  if not (v_student_id = any(v_occurrence.roster_student_ids)) and not (
    new.payload->>'attendanceStatus'='makeup' and public.n3_internal_admit_booked_makeup(
      new.center_id,v_student_id,v_schedule_id,v_date,new.payload->>'makeupForAttendanceLocalId')) then$new$;
  if pg_catalog.strpos(v_def,v_old)=0 or pg_catalog.strpos(v_def,'n3_internal_')>0 then raise exception 'n3_trigger_roster_contract_mismatch'; end if;
  execute pg_catalog.replace(v_def,v_old,v_new);
end $patch$;

revoke all on function public.n3_internal_booking_completed(public.center_makeup_bookings),
  public.n3_internal_admit_booked_makeup(text,text,text,date,text),public.n3_internal_guard_booking_attendance(),
  public.n3_mutate_makeup_booking(text,jsonb,uuid),public.n3_list_makeup_booking_context(text,date,date)
  from public,anon,authenticated,service_role;
grant execute on function public.n3_mutate_makeup_booking(text,jsonb,uuid),
  public.n3_list_makeup_booking_context(text,date,date) to authenticated;
