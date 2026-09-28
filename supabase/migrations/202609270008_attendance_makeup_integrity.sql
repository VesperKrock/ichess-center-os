-- A4: one canonical makeup attendance compensates one canonical absence.
-- The link lives on the V2.3 attendance payload; it has no Tuition value itself.
do $$ begin
  if pg_catalog.to_regclass('public.center_schedule_occurrences') is null
     or pg_catalog.to_regclass('public.center_class_teacher_assignments') is null
     or pg_catalog.to_regprocedure('public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)') is null then
    raise exception 'a4_required_authority_missing';
  end if;
end $$;

-- Historical unlinked makeup rows, if any, do not enter this index. They retain
-- their existing contribution; their next operational makeup edit needs a link.
create unique index center_cloud_entities_a4_makeup_target_unique
  on public.center_cloud_entities(center_id,(payload->>'makeupForAttendanceLocalId'))
  where entity_type='attendance_record' and deleted_at is null
    and payload->>'attendanceAuthority'='v2.3-occurrence-v1'
    and payload->>'attendanceStatus'='makeup'
    and nullif(payload->>'makeupForAttendanceLocalId','') is not null;

create function public.a4_internal_guard_makeup_integrity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_target_id text;
  v_target public.center_cloud_entities;
  v_target_fact public.center_schedule_occurrences;
  v_makeup_fact public.center_schedule_occurrences;
  v_target_date date;
  v_makeup_date date;
  v_today date := (pg_catalog.clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if tg_op='DELETE' then
    if old.entity_type='attendance_record' and old.deleted_at is null
       and old.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
       and old.payload->>'attendanceStatus' in
         ('absent','excused','excusedAbsent','unexcusedAbsent') then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'a4.missed|'||old.center_id||'|'||old.local_id,0));
      if exists(select 1 from public.center_cloud_entities m
        where m.center_id=old.center_id and m.entity_type='attendance_record'
          and m.deleted_at is null and m.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
          and m.payload->>'attendanceStatus'='makeup'
          and m.payload->>'makeupForAttendanceLocalId'=old.local_id) then
        raise exception 'a4_compensated_absence_locked';
      end if;
    end if;
    return old;
  end if;
  if tg_op='UPDATE' and old.entity_type='attendance_record' and old.deleted_at is null
     and old.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
     and old.payload->>'attendanceStatus' in
       ('absent','excused','excusedAbsent','unexcusedAbsent')
     and (new.deleted_at is not null or new.entity_type is distinct from old.entity_type
       or new.center_id is distinct from old.center_id
       or new.local_id is distinct from old.local_id
       or new.payload->>'studentId' is distinct from old.payload->>'studentId'
       or new.payload->>'source'='initialBaseline'
       or new.payload->>'scheduleSessionId' is distinct from old.payload->>'scheduleSessionId'
       or new.payload->>'date' is distinct from old.payload->>'date'
       or new.payload->>'attendanceAuthority' is distinct from old.payload->>'attendanceAuthority'
       or new.payload->>'attendanceStatus' not in
         ('absent','excused','excusedAbsent','unexcusedAbsent')) then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'a4.missed|'||old.center_id||'|'||old.local_id,0));
    if exists(select 1 from public.center_cloud_entities m
      where m.center_id=old.center_id and m.entity_type='attendance_record'
        and m.deleted_at is null and m.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
        and m.payload->>'attendanceStatus'='makeup'
        and m.payload->>'makeupForAttendanceLocalId'=old.local_id) then
      raise exception 'a4_compensated_absence_locked';
    end if;
  end if;

  if new.entity_type<>'attendance_record' then return new; end if;

  if new.deleted_at is not null then return new; end if;
  if new.payload->>'source'='initialBaseline'
     and new.payload->>'attendanceAuthority'='v2.3-occurrence-v1' then
    raise exception 'a4_invalid_canonical_source';
  end if;
  if new.payload->>'source'='initialBaseline'
     or new.payload->>'attendanceAuthority' is distinct from 'v2.3-occurrence-v1' then
    return new;
  end if;
  v_target_id:=pg_catalog.btrim(coalesce(new.payload->>'makeupForAttendanceLocalId',''));
  if new.payload->>'attendanceStatus'<>'makeup' then
    if v_target_id<>'' then raise exception 'a4_target_only_for_makeup'; end if;
    return new;
  end if;
  if v_target_id='' then
    -- A3 may refresh the teacher snapshot on a pre-A4 unlinked makeup. Any
    -- attendance edit, including a same-status save, must supply a target.
    if tg_op='UPDATE' and old.deleted_at is null
       and old.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
       and old.payload->>'attendanceStatus'='makeup'
       and pg_catalog.btrim(coalesce(old.payload->>'makeupForAttendanceLocalId',''))=''
       and (new.payload-'teacherId'-'teacherName')=(old.payload-'teacherId'-'teacherName') then
      return new;
    end if;
    raise exception 'a4_makeup_target_required';
  end if;
  if v_target_id=new.local_id then raise exception 'a4_makeup_same_occurrence'; end if;
  begin
    v_target_date:=(new.payload->>'date')::date;
    v_makeup_date:=v_target_date;
  exception when others then raise exception 'a4_invalid_makeup_date'; end;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'a4.missed|'||new.center_id||'|'||v_target_id,0));
  select * into v_target from public.center_cloud_entities e
  where e.center_id=new.center_id and e.entity_type='attendance_record'
    and e.local_id=v_target_id and e.deleted_at is null
    and e.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
    and e.payload->>'source' in ('admin','teacher','correction');
  if v_target.id is null then raise exception 'a4_makeup_target_not_found'; end if;
  if v_target.payload->>'studentId' is distinct from new.payload->>'studentId' then
    raise exception 'a4_makeup_wrong_student';
  end if;
  if v_target.payload->>'attendanceStatus' not in
     ('absent','excused','excusedAbsent','unexcusedAbsent') then
    raise exception 'a4_makeup_target_not_absent';
  end if;
  begin v_target_date:=(v_target.payload->>'date')::date;
  exception when others then raise exception 'a4_invalid_target_date'; end;
  if v_target_date>=v_makeup_date or v_target_date>v_today then
    raise exception 'a4_makeup_target_future';
  end if;
  select * into v_makeup_fact from public.center_schedule_occurrences o
  where o.center_id=new.center_id
    and o.schedule_session_local_id=new.payload->>'scheduleSessionId'
    and o.occurrence_date=v_makeup_date;
  if v_makeup_fact.center_id is null or v_makeup_fact.lifecycle_state<>'HELD'
     or v_makeup_date>v_today or (v_makeup_date=v_today
       and v_makeup_fact.planned_end_time is not null
       and ((v_makeup_date+v_makeup_fact.planned_end_time) at time zone 'Asia/Ho_Chi_Minh')
         >pg_catalog.clock_timestamp()) then
    raise exception 'a4_makeup_occurrence_not_held';
  end if;
  -- An active canonical absence is stronger historical evidence than mutable
  -- current Schedule. A2 labels such a newly resolved fact EXISTING_ATTENDANCE.
  v_target_fact:=public.a2_internal_resolve_occurrence(new.center_id,
    v_target.payload->>'scheduleSessionId',v_target_date,new.updated_by);
  if v_target_fact.lifecycle_state='CANCELLED' then raise exception 'a4_makeup_target_cancelled'; end if;
  if v_target_fact.lifecycle_state<>'HELD' then raise exception 'a4_makeup_target_not_held'; end if;
  if exists(select 1 from public.center_cloud_entities m
    where m.center_id=new.center_id and m.entity_type='attendance_record'
      and m.deleted_at is null and m.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
      and m.payload->>'attendanceStatus'='makeup'
      and m.payload->>'makeupForAttendanceLocalId'=v_target_id
      and m.id<>new.id) then
    raise exception 'a4_makeup_already_compensated';
  end if;
  return new;
end $$;

create trigger a4_guard_makeup_integrity
before insert or update of entity_type,center_id,local_id,payload,deleted_at or delete
on public.center_cloud_entities for each row
execute function public.a4_internal_guard_makeup_integrity();

-- Read-only candidate list. Historical V2.3 absence is valid A2 resolution
-- evidence even when its durable fact has not yet been lazily materialized.
create function public.a4_list_eligible_missed_occurrences(
  p_center_id text,p_student_id text,p_makeup_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_today date:=(pg_catalog.clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
  if v_actor is null or pg_catalog.btrim(coalesce(p_student_id,''))=''
     or p_makeup_date is null then raise exception 'a4_invalid_candidate_request'; end if;
  if not exists(select 1 from public.center_members m join public.centers c on c.id=m.center_id
    where m.center_id=p_center_id and m.user_id=v_actor and m.status='active'
      and c.status='active' and pg_catalog.lower(m.role) in ('owner','qtv','center_admin','admin')) then
    raise exception 'a4_center_access_denied';
  end if;
  return pg_catalog.jsonb_build_object('ok',true,'center_id',p_center_id,
    'student_id',p_student_id,'candidates',coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'attendance_local_id',e.local_id,'schedule_session_id',e.payload->>'scheduleSessionId',
        'occurrence_date',e.payload->>'date',
        'class_session_id',coalesce(o.class_session_local_id,e.payload->>'classSessionId'),
        'start_time',o.planned_start_time,
        'teacher_name',case when o.center_id is null then e.payload->>'teacherName'
          when o.actual_teacher_override then o.actual_teacher_name else o.planned_teacher_name end)
      order by e.payload->>'date' desc,e.local_id)
      from public.center_cloud_entities e
      left join public.center_schedule_occurrences o on o.center_id=e.center_id
        and o.schedule_session_local_id=e.payload->>'scheduleSessionId'
        and o.occurrence_date=(e.payload->>'date')::date
      where e.center_id=p_center_id and e.entity_type='attendance_record' and e.deleted_at is null
        and e.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
        and e.payload->>'source' in ('admin','teacher','correction')
        and e.payload->>'studentId'=p_student_id
        and e.payload->>'attendanceStatus' in ('absent','excused','excusedAbsent','unexcusedAbsent')
        and (e.payload->>'date')::date<p_makeup_date
        and ((o.center_id is null and (e.payload->>'date')::date<v_today)
          or (o.lifecycle_state='HELD' and o.occurrence_date<=v_today))
        and not exists(select 1 from public.center_cloud_entities m
          where m.center_id=p_center_id and m.entity_type='attendance_record' and m.deleted_at is null
            and m.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
            and m.payload->>'attendanceStatus'='makeup'
            and m.payload->>'makeupForAttendanceLocalId'=e.local_id)),'[]'::jsonb));
end $$;

revoke all on function public.a4_internal_guard_makeup_integrity(),
  public.a4_list_eligible_missed_occurrences(text,text,date)
  from public,anon,authenticated,service_role;
grant execute on function public.a4_list_eligible_missed_occurrences(text,text,date) to authenticated;

-- Extend the V2.3 command item, preserving its signature, identity, optimistic
-- versions, idempotency, A2 held check, A3 teacher and V2.4 reconciliation.
do $patch$
declare v_def text; v_next text;
begin
  v_def:=pg_catalog.pg_get_functiondef(
    'public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)'::pg_catalog.regprocedure);
  if pg_catalog.strpos(v_def,'makeup_for_attendance_local_id')>0
     or pg_catalog.strpos(v_def,'    v_seen_students := pg_catalog.array_append(v_seen_students, v_student_id);')=0
     or pg_catalog.strpos(v_def,'    v_payload := (v_item->''payload'')')=0
     or pg_catalog.strpos(v_def,'''attendanceStatus'', v_status,')=0 then
    raise exception 'a4_v23_command_contract_mismatch';
  end if;
  v_next:=pg_catalog.replace(v_def,
    '    v_seen_students := pg_catalog.array_append(v_seen_students, v_student_id);',
    $insert$    if (v_status='makeup' and pg_catalog.btrim(coalesce(v_item->>'makeup_for_attendance_local_id',''))='')
       or (v_status<>'makeup' and pg_catalog.btrim(coalesce(v_item->>'makeup_for_attendance_local_id',''))<>'') then
      raise exception 'a4_makeup_target_required';
    end if;
    v_seen_students := pg_catalog.array_append(v_seen_students, v_student_id);$insert$);
  v_next:=pg_catalog.replace(v_next,
    '    v_payload := (v_item->''payload'')',
    '    v_payload := ((v_item->''payload'') - ''makeupForAttendanceLocalId'')');
  v_next:=pg_catalog.replace(v_next,
    '''attendanceStatus'', v_status,',
    '''attendanceStatus'', v_status,'||chr(10)||
    '        ''makeupForAttendanceLocalId'', nullif(pg_catalog.btrim(coalesce(v_item->>''makeup_for_attendance_local_id'','''')),''''),');
  execute v_next;
end $patch$;
