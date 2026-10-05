-- N2: one Attendance command, with transaction-bound, append-only evidence.
begin;

do $$ begin
  if pg_catalog.to_regprocedure('public.c5_2_mutate_attendance_tuition_entities(text,jsonb,uuid)') is null
     or pg_catalog.to_regprocedure('public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)') is null
     or pg_catalog.to_regprocedure('public.a2_internal_ensure_held_occurrence(text,text,date,uuid)') is null
     or pg_catalog.to_regprocedure('public.v2_4_internal_reconcile_student(text,text,uuid)') is null then
    raise exception 'n2_required_authority_missing';
  end if;
end $$;

-- Preserve C5.2's mature optimistic storage and V2.4 trigger path as a
-- private primitive. Its old public name becomes a narrow compatibility API.
alter function public.c5_2_mutate_attendance_tuition_entities(text,jsonb,uuid)
  rename to n2_internal_mutate_attendance_tuition_entities;
revoke all on function public.n2_internal_mutate_attendance_tuition_entities(text,jsonb,uuid)
  from public,anon,authenticated,service_role;

create function public.c5_2_mutate_attendance_tuition_entities(
  p_center_id text,p_mutations jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_item jsonb; v_type text;
begin
  if pg_catalog.jsonb_typeof(p_mutations) <> 'array' then
    return pg_catalog.jsonb_build_object('ok',false,'outcome_code','INVALID_COMMAND');
  end if;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_mutations) loop
    if pg_catalog.jsonb_typeof(v_item) <> 'object' then
      return pg_catalog.jsonb_build_object('ok',false,'outcome_code','INVALID_COMMAND');
    end if;
    v_type:=pg_catalog.lower(pg_catalog.btrim(coalesce(v_item->>'entity_type','')));
    if v_type='attendance_record' then
      return pg_catalog.jsonb_build_object('ok',false,'outcome_code','ATTENDANCE_TYPED_COMMAND_REQUIRED');
    end if;
    if v_type not in ('attendance_baseline_state','session_report','tuition_record_package') then
      return pg_catalog.jsonb_build_object('ok',false,'outcome_code','INVALID_ENTITY_TYPE');
    end if;
  end loop;
  return public.n2_internal_mutate_attendance_tuition_entities(p_center_id,p_mutations,p_idempotency_key);
end $$;
revoke all on function public.c5_2_mutate_attendance_tuition_entities(text,jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.c5_2_mutate_attendance_tuition_entities(text,jsonb,uuid)
  to authenticated;

create table public.center_business_audit_events (
  id bigint generated always as identity primary key,
  center_id text not null references public.centers(id) on delete restrict,
  domain text not null check (domain ~ '^[A-Z_]{2,40}$'),
  batch_action text not null check (batch_action ~ '^[A-Z_]{2,60}$'),
  action_type text not null check (action_type ~ '^[A-Z_]{2,60}$'),
  entity_type text not null check (pg_catalog.length(entity_type) between 1 and 80),
  entity_identity text not null check (pg_catalog.length(entity_identity) between 1 and 200 and entity_identity !~ '[[:cntrl:]]'),
  audit_batch_id uuid not null,
  command_idempotency_key uuid not null,
  batch_ordinal integer not null check (batch_ordinal between 1 and 500),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_membership_id uuid not null,
  actor_role text not null check (pg_catalog.length(actor_role) between 1 and 40),
  student_local_id text check (student_local_id is null or pg_catalog.length(student_local_id) between 1 and 200),
  schedule_session_local_id text check (schedule_session_local_id is null or pg_catalog.length(schedule_session_local_id) between 1 and 200),
  occurrence_date date,
  before_state jsonb check (before_state is null or pg_catalog.jsonb_typeof(before_state)='object'),
  after_state jsonb check (after_state is null or pg_catalog.jsonb_typeof(after_state)='object'),
  absence_reason_before text check (absence_reason_before is null or pg_catalog.length(absence_reason_before) between 1 and 1000),
  absence_reason_after text check (absence_reason_after is null or pg_catalog.length(absence_reason_after) between 1 and 1000),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint center_business_audit_events_membership_center_fk
    foreign key (center_id,actor_membership_id) references public.center_members(center_id,id) on delete restrict,
  constraint center_business_audit_events_attendance_identity check (
    domain <> 'ATTENDANCE' or (student_local_id is not null and schedule_session_local_id is not null
      and occurrence_date is not null and entity_type='attendance_record'
      and batch_action='SAVE_ATTENDANCE'
      and (before_state is not null or after_state is not null))),
  constraint center_business_audit_events_distinct_states check (before_state is distinct from after_state),
  constraint center_business_audit_events_batch_ordinal_unique
    unique(center_id,audit_batch_id,batch_ordinal)
);
create index center_business_audit_events_domain_created_idx
  on public.center_business_audit_events(center_id,domain,created_at desc,id desc);
create index center_business_audit_events_batch_idx
  on public.center_business_audit_events(center_id,audit_batch_id,batch_ordinal);
create index center_business_audit_events_student_idx
  on public.center_business_audit_events(center_id,student_local_id,created_at desc);
create index center_business_audit_events_occurrence_idx
  on public.center_business_audit_events(center_id,schedule_session_local_id,occurrence_date,created_at desc);
alter table public.center_business_audit_events enable row level security;
alter table public.center_business_audit_events force row level security;
revoke all on public.center_business_audit_events from public,anon,authenticated,service_role;
revoke all on sequence public.center_business_audit_events_id_seq from public,anon,authenticated,service_role;

create function public.n2_internal_guard_audit_immutable()
returns trigger language plpgsql security definer set search_path = '' as $$
begin raise exception 'n2_audit_immutable'; end $$;
create trigger n2_guard_business_audit_update_delete
  before update or delete on public.center_business_audit_events
  for each row execute function public.n2_internal_guard_audit_immutable();
create trigger n2_guard_business_audit_truncate
  before truncate on public.center_business_audit_events
  for each statement execute function public.n2_internal_guard_audit_immutable();
revoke all on function public.n2_internal_guard_audit_immutable()
  from public,anon,authenticated,service_role;

create table public.n2_attendance_command_results (
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  intent_digest bytea not null check (pg_catalog.octet_length(intent_digest)=32),
  audit_batch_id uuid not null unique,
  result_snapshot jsonb not null check (pg_catalog.jsonb_typeof(result_snapshot)='object'
    and result_snapshot->>'outcome_code'='COMMITTED'),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key(center_id,actor_user_id,idempotency_key)
);
alter table public.n2_attendance_command_results enable row level security;
alter table public.n2_attendance_command_results force row level security;
revoke all on public.n2_attendance_command_results from public,anon,authenticated,service_role;

create function public.n2_internal_append_business_audit_event(p_event jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_membership public.center_members; v_id bigint;
begin
  if v_actor is null or pg_catalog.jsonb_typeof(p_event)<>'object' then
    raise exception 'n2_audit_context_invalid';
  end if;
  select m.* into v_membership from public.center_members m
  join public.centers c on c.id=m.center_id
  where m.center_id=p_event->>'center_id' and m.user_id=v_actor
    and m.status='active' and c.status='active'
  for share of m,c;
  if v_membership.id is null or pg_catalog.lower(v_membership.role) not in
    ('owner','qtv','center_admin','admin') then
    raise exception 'n2_audit_actor_denied';
  end if;
  insert into public.center_business_audit_events(
    center_id,domain,batch_action,action_type,entity_type,entity_identity,
    audit_batch_id,command_idempotency_key,batch_ordinal,
    actor_user_id,actor_membership_id,actor_role,
    student_local_id,schedule_session_local_id,occurrence_date,
    before_state,after_state,absence_reason_before,absence_reason_after)
  values(
    v_membership.center_id,p_event->>'domain',p_event->>'batch_action',p_event->>'action_type',
    p_event->>'entity_type',p_event->>'entity_identity',
    (p_event->>'audit_batch_id')::uuid,(p_event->>'command_idempotency_key')::uuid,
    (p_event->>'batch_ordinal')::integer,
    v_actor,v_membership.id,public.v2_4_internal_normalize_role(v_membership.role),
    p_event->>'student_local_id',p_event->>'schedule_session_local_id',
    (p_event->>'occurrence_date')::date,
    nullif(p_event->'before_state','null'::jsonb),
    nullif(p_event->'after_state','null'::jsonb),
    p_event->>'absence_reason_before',p_event->>'absence_reason_after')
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.n2_internal_append_business_audit_event(jsonb)
  from public,anon,authenticated,service_role;

-- An A3 teacher override changes the authoritative occurrence. Attendance
-- state and storage version now remain untouched; ledger/PDF read the fact.
do $patch$
declare v_def text; v_start integer; v_end integer;
begin
  v_def:=pg_catalog.pg_get_functiondef(
    'public.a3_set_occurrence_actual_teacher(text,text,date,text,uuid,uuid)'::pg_catalog.regprocedure);
  v_start:=pg_catalog.strpos(v_def,'    update public.center_cloud_entities e');
  v_end:=v_start+pg_catalog.strpos(pg_catalog.substr(v_def,v_start),
    '    insert into public.a3_teacher_events')-1;
  if v_start<1 or v_end<=v_start then raise exception 'n2_a3_teacher_patch_contract_mismatch'; end if;
  v_def:=pg_catalog.substr(v_def,1,v_start-1)||pg_catalog.substr(v_def,v_end);
  execute v_def;
end $patch$;

-- The old writer has no SQL-level callers after A2/A3/A4 were installed.
revoke all on function public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)
  from public,anon,authenticated,service_role;
drop function public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid);

create function public.v2_9_mutate_attendance_batch(
  p_center_id text,p_command jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid:=auth.uid();
  v_center text:=pg_catalog.btrim(coalesce(p_center_id,''));
  v_membership public.center_members;
  v_changes jsonb;
  v_change jsonb;
  v_count integer;
  v_ordinal integer:=0;
  v_student text;
  v_schedule text;
  v_date date;
  v_action text;
  v_status text;
  v_reason text;
  v_target text;
  v_local_id text;
  v_expected jsonb;
  v_current jsonb;
  v_expected_item jsonb;
  v_fact public.center_schedule_occurrences;
  v_row public.center_cloud_entities;
  v_before_row public.center_cloud_entities;
  v_after_row public.center_cloud_entities;
  v_before jsonb;
  v_after jsonb;
  v_payload jsonb;
  v_mutations jsonb:='[]'::jsonb;
  v_chunk jsonb;
  v_storage_results jsonb:='[]'::jsonb;
  v_events jsonb:='[]'::jsonb;
  v_result jsonb;
  v_snapshot jsonb;
  v_digest bytea;
  v_prior public.n2_attendance_command_results;
  v_batch uuid;
  v_duplicate_count integer;
begin
  if v_actor is null then raise exception 'n2_not_authenticated'; end if;
  if v_center='' or pg_catalog.length(v_center)>160 or p_idempotency_key is null then
    raise exception 'n2_invalid_command';
  end if;
  select m.* into v_membership from public.center_members m
  join public.centers c on c.id=m.center_id
  where m.center_id=v_center and m.user_id=v_actor and m.status='active' and c.status='active'
  for share of m,c;
  if v_membership.id is null or pg_catalog.lower(v_membership.role) not in
    ('owner','qtv','center_admin','admin') then
    raise exception 'n2_write_role_required';
  end if;
  if pg_catalog.jsonb_typeof(p_command) is distinct from 'object'
     or p_command->>'operation' is distinct from 'SAVE_ATTENDANCE'
     or pg_catalog.jsonb_typeof(p_command->'changes') is distinct from 'array' then
    raise exception 'n2_invalid_command';
  end if;
  v_changes:=p_command->'changes';
  v_count:=pg_catalog.jsonb_array_length(v_changes);
  if v_count<1 or v_count>500 or
     pg_catalog.octet_length(pg_catalog.convert_to(p_command::text,'UTF8'))>2097152 then
    raise exception 'n2_invalid_command';
  end if;
  v_digest:=extensions.digest(pg_catalog.convert_to(
    pg_catalog.jsonb_build_object('contract',1,'center_id',v_center,'command',p_command)::text,
    'UTF8'),'sha256');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'n2.attendance.command|'||v_center||'|'||v_actor::text||'|'||p_idempotency_key::text,0));
  select * into v_prior from public.n2_attendance_command_results r
  where r.center_id=v_center and r.actor_user_id=v_actor and r.idempotency_key=p_idempotency_key
  for update;
  if found then
    if v_prior.intent_digest<>v_digest then raise exception 'n2_idempotency_conflict'; end if;
    return v_prior.result_snapshot||pg_catalog.jsonb_build_object('replayed',true);
  end if;

  -- Natural-key locks serialize first creates as well as edits. All validation
  -- finishes before the private C5.2 mutation is invoked.
  for v_change in select value from pg_catalog.jsonb_array_elements(v_changes)
    order by value->>'scheduleSessionId',value->>'occurrenceDate',value->>'studentId'
  loop
    if pg_catalog.jsonb_typeof(v_change)<>'object' then raise exception 'n2_invalid_change'; end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'n2.attendance.entity|'||v_center||'|'||coalesce(v_change->>'scheduleSessionId','')||'|'||
      coalesce(v_change->>'occurrenceDate','')||'|'||coalesce(v_change->>'studentId',''),0));
  end loop;
  select pg_catalog.count(*) into v_duplicate_count from (
    select value->>'scheduleSessionId',value->>'occurrenceDate',value->>'studentId'
    from pg_catalog.jsonb_array_elements(v_changes) group by 1,2,3 having pg_catalog.count(*)>1
  ) duplicates;
  if v_duplicate_count>0 then raise exception 'n2_duplicate_attendance_identity'; end if;

  for v_change in select value from pg_catalog.jsonb_array_elements(v_changes) loop
    v_ordinal:=v_ordinal+1;
    if pg_catalog.jsonb_typeof(v_change)<>'object' then raise exception 'n2_invalid_change'; end if;
    v_student:=pg_catalog.btrim(coalesce(v_change->>'studentId',''));
    v_schedule:=pg_catalog.btrim(coalesce(v_change->>'scheduleSessionId',''));
    v_action:=pg_catalog.upper(pg_catalog.btrim(coalesce(v_change->>'action','')));
    v_status:=pg_catalog.btrim(coalesce(v_change->>'attendanceStatus',''));
    if v_student='' or pg_catalog.length(v_student)>200 or v_student~'[[:cntrl:]]'
       or v_schedule='' or pg_catalog.length(v_schedule)>200 or v_schedule~'[[:cntrl:]]'
       or coalesce(v_change->>'occurrenceDate','')!~'^\d{4}-\d{2}-\d{2}$'
       or v_action not in ('SET','UNMARK')
       or pg_catalog.jsonb_typeof(v_change->'expectedRecords') is distinct from 'array' then
      raise exception 'n2_invalid_change';
    end if;
    begin v_date:=(v_change->>'occurrenceDate')::date;
    exception when others then raise exception 'n2_invalid_occurrence_date'; end;
    if v_date::text<>v_change->>'occurrenceDate' then raise exception 'n2_invalid_occurrence_date'; end if;
    if v_action='SET' and v_status not in ('present','absent','makeup') then
      raise exception 'n2_unsupported_attendance_status';
    end if;
    if v_action='UNMARK' and (v_status<>'' or v_change ? 'absenceReason'
      or v_change ? 'makeupForAttendanceLocalId') then
      raise exception 'n2_invalid_unmark';
    end if;
    v_reason:=null;
    v_target:=null;
    if v_action='SET' and v_status='absent' then
      if v_change ? 'absenceReason' and v_change->'absenceReason'<>'null'::jsonb then
        if pg_catalog.jsonb_typeof(v_change->'absenceReason')<>'string' then
          raise exception 'n2_invalid_absence_reason';
        end if;
        v_reason:=pg_catalog.btrim(v_change->>'absenceReason');
        if v_reason='' or pg_catalog.length(v_reason)>1000
           or v_reason~'[[:cntrl:]]' or v_reason='Chưa có lý do' then
          raise exception 'n2_invalid_absence_reason';
        end if;
      end if;
    end if;
    if v_action='SET' and v_status='makeup' then
      v_target:=pg_catalog.btrim(coalesce(v_change->>'makeupForAttendanceLocalId',''));
      if v_target='' or pg_catalog.length(v_target)>200 or v_target~'[[:cntrl:]]' then
        raise exception 'n2_makeup_target_required';
      end if;
    end if;

    v_fact:=public.a2_internal_ensure_held_occurrence(v_center,v_schedule,v_date,v_actor);
    if v_fact.center_id is null or v_fact.lifecycle_state<>'HELD'
       or not (v_student=any(v_fact.roster_student_ids)) then
      raise exception 'n2_student_not_in_occurrence_roster';
    end if;
    if not exists(select 1 from public.center_cloud_entities e
      where e.center_id=v_center and e.entity_type='student'
        and e.local_id=v_student and e.deleted_at is null) then
      raise exception 'n2_student_not_found';
    end if;

    v_expected:='[]'::jsonb;
    for v_expected_item in select value from pg_catalog.jsonb_array_elements(v_change->'expectedRecords') loop
      if pg_catalog.jsonb_typeof(v_expected_item)<>'object'
         or pg_catalog.btrim(coalesce(v_expected_item->>'localId',''))=''
         or coalesce(v_expected_item->>'version','')!~'^[1-9][0-9]*$' then
        raise exception 'n2_invalid_expected_records';
      end if;
      v_expected:=v_expected||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'localId',v_expected_item->>'localId','version',(v_expected_item->>'version')::bigint));
    end loop;
    select coalesce(pg_catalog.jsonb_agg(value order by value->>'localId'),'[]'::jsonb)
      into v_expected from pg_catalog.jsonb_array_elements(v_expected);

    perform 1 from public.center_cloud_entities e
    where e.center_id=v_center and e.entity_type='attendance_record' and e.deleted_at is null
      and e.payload->>'source'<>'initialBaseline' and e.payload->>'studentId'=v_student
      and e.payload->>'date'=v_date::text
      and coalesce(nullif(e.payload->>'scheduleSessionId',''),e.payload->>'sessionId')=v_schedule
    order by e.local_id for update;
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'localId',e.local_id,'version',e.entity_version) order by e.local_id),'[]'::jsonb)
      into v_current from public.center_cloud_entities e
    where e.center_id=v_center and e.entity_type='attendance_record' and e.deleted_at is null
      and e.payload->>'source'<>'initialBaseline' and e.payload->>'studentId'=v_student
      and e.payload->>'date'=v_date::text
      and coalesce(nullif(e.payload->>'scheduleSessionId',''),e.payload->>'sessionId')=v_schedule;
    if v_current<>v_expected then raise exception 'n2_attendance_version_conflict'; end if;

    v_local_id:=public.v2_3_internal_occurrence_attendance_local_id(v_center,v_schedule,v_date,v_student);
    select * into v_row from public.center_cloud_entities e
    where e.center_id=v_center and e.entity_type='attendance_record' and e.local_id=v_local_id
    for update;
    select * into v_before_row from public.center_cloud_entities e
    where e.center_id=v_center and e.entity_type='attendance_record' and e.deleted_at is null
      and e.payload->>'source'<>'initialBaseline' and e.payload->>'studentId'=v_student
      and e.payload->>'date'=v_date::text
      and coalesce(nullif(e.payload->>'scheduleSessionId',''),e.payload->>'sessionId')=v_schedule
    order by case when e.local_id=v_local_id then 0 else 1 end,e.local_id limit 1;
    v_before:=case when v_before_row.id is null then null else pg_catalog.jsonb_build_object(
      'attendanceStatus',v_before_row.payload->>'attendanceStatus',
      'absenceReason',v_before_row.payload->>'absenceReason',
      'makeupForAttendanceLocalId',v_before_row.payload->>'makeupForAttendanceLocalId',
      'entityVersion',v_before_row.entity_version,'current',true,'deleted',false,
      'storageLocalId',v_before_row.local_id) end;
    if v_action='UNMARK' and pg_catalog.jsonb_array_length(v_current)=0 then
      raise exception 'n2_attendance_not_marked';
    end if;
    if v_action='SET' and pg_catalog.jsonb_array_length(v_current)=1
       and v_before_row.local_id=v_local_id
       and v_before_row.payload->>'attendanceStatus'=v_status
       and nullif(v_before_row.payload->>'absenceReason','') is not distinct from v_reason
       and nullif(v_before_row.payload->>'makeupForAttendanceLocalId','') is not distinct from v_target then
      raise exception 'n2_attendance_no_change';
    end if;

    if v_action='SET' then
      v_payload:=(case when v_row.id is not null then v_row.payload else '{}'::jsonb end)
        - 'absenceReason' - 'makeupForAttendanceLocalId' - 'teacherId' - 'teacherName'
        ||pg_catalog.jsonb_build_object(
          'id',v_local_id,'authorityLocalId',v_local_id,
          'attendanceAuthority','v2.3-occurrence-v1',
          'studentId',v_student,'date',v_date::text,
          'scheduleSessionId',v_schedule,'sessionId',v_schedule,
          'classSessionId',coalesce(v_fact.class_session_local_id,''),
          'teacherId',case when v_fact.actual_teacher_override then v_fact.actual_teacher_id::text
            else v_fact.planned_teacher_id end,
          'teacherName',case when v_fact.actual_teacher_override then v_fact.actual_teacher_name
            else v_fact.planned_teacher_name end,
          'source','admin','status',v_status,'attendanceStatus',v_status,
          'absenceReason',v_reason,'makeupForAttendanceLocalId',v_target,
          'counted',false,'countsTowardTuition',false,'creditValue',0,
          'tuitionPolicyDefined',false,'tuitionAutoUpdateEnabled',false,
          'tuitionConsumptionApplied',false);
      v_mutations:=v_mutations||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'entity_type','attendance_record','local_id',v_local_id,
        'expected_version',coalesce(v_row.entity_version,0),
        'operation','UPSERT','payload',v_payload));
    end if;
    for v_expected_item in select value from pg_catalog.jsonb_array_elements(v_current) loop
      if v_action='UNMARK' or v_expected_item->>'localId'<>v_local_id then
        v_mutations:=v_mutations||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'entity_type','attendance_record','local_id',v_expected_item->>'localId',
          'expected_version',(v_expected_item->>'version')::bigint,
          'operation','DELETE','payload','{}'::jsonb));
      end if;
    end loop;
    v_events:=v_events||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'ordinal',v_ordinal,'action',v_action,'identity',v_local_id,
      'student',v_student,'schedule',v_schedule,'date',v_date::text,
      'before',v_before,'reasonBefore',v_before_row.payload->>'absenceReason'));
  end loop;

  v_batch:=pg_catalog.gen_random_uuid();
  -- One natural Attendance change can retire historical storage rows as well
  -- as upsert its canonical row. Chunk only the private storage primitive;
  -- every chunk, Tuition trigger and audit append still share this transaction.
  for v_chunk in
    select pg_catalog.jsonb_agg(item.value order by item.ordinality)
    from pg_catalog.jsonb_array_elements(v_mutations) with ordinality item(value,ordinality)
    group by (item.ordinality-1)/500 order by (item.ordinality-1)/500
  loop
    v_result:=public.n2_internal_mutate_attendance_tuition_entities(
      v_center,v_chunk,pg_catalog.gen_random_uuid());
    if coalesce((v_result->>'ok')::boolean,false) is not true then
      raise exception 'n2_storage_mutation_failed:%',coalesce(v_result->>'outcome_code','UNKNOWN');
    end if;
    v_storage_results:=v_storage_results||(v_result->'results');
  end loop;
  for v_change in select value from pg_catalog.jsonb_array_elements(v_events) loop
    select * into v_after_row from public.center_cloud_entities e
    where e.center_id=v_center and e.entity_type='attendance_record'
      and e.local_id=v_change->>'identity';
    v_after:=case when v_after_row.id is null then null else pg_catalog.jsonb_build_object(
      'attendanceStatus',case when v_after_row.deleted_at is null then v_after_row.payload->>'attendanceStatus' else null end,
      'absenceReason',case when v_after_row.deleted_at is null then v_after_row.payload->>'absenceReason' else null end,
      'makeupForAttendanceLocalId',case when v_after_row.deleted_at is null then v_after_row.payload->>'makeupForAttendanceLocalId' else null end,
      'entityVersion',v_after_row.entity_version,'current',v_after_row.deleted_at is null,
      'deleted',v_after_row.deleted_at is not null,'storageLocalId',v_after_row.local_id) end;
    perform public.n2_internal_append_business_audit_event(pg_catalog.jsonb_build_object(
      'center_id',v_center,'domain','ATTENDANCE','batch_action','SAVE_ATTENDANCE',
      'action_type',case when v_change->>'action'='UNMARK' then 'UNMARK'
        when v_change->'before'='null'::jsonb then 'CREATE' else 'UPDATE' end,
      'entity_type','attendance_record','entity_identity',v_change->>'identity',
      'audit_batch_id',v_batch,'command_idempotency_key',p_idempotency_key,
      'batch_ordinal',(v_change->>'ordinal')::integer,
      'student_local_id',v_change->>'student',
      'schedule_session_local_id',v_change->>'schedule',
      'occurrence_date',v_change->>'date','before_state',v_change->'before',
      'after_state',v_after,'absence_reason_before',v_change->>'reasonBefore',
      'absence_reason_after',case when v_after_row.deleted_at is null then v_after_row.payload->>'absenceReason' else null end));
  end loop;
  v_snapshot:=pg_catalog.jsonb_build_object('ok',true,'outcome_code','COMMITTED',
    'center_id',v_center,'audit_batch_id',v_batch,'change_count',v_count,
    'results',v_storage_results,'replayed',false);
  insert into public.n2_attendance_command_results(
    center_id,actor_user_id,idempotency_key,intent_digest,audit_batch_id,result_snapshot)
  values(v_center,v_actor,p_idempotency_key,v_digest,v_batch,v_snapshot);
  return v_snapshot;
end $$;
revoke all on function public.v2_9_mutate_attendance_batch(text,jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.v2_9_mutate_attendance_batch(text,jsonb,uuid) to authenticated;

create function public.v2_9_list_attendance_audit_events(
  p_center_id text,p_year integer default null,p_student_local_id text default null,
  p_schedule_session_local_id text default null,p_audit_batch_id uuid default null,
  p_limit integer default 100,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_year integer; v_rows jsonb;
begin
  if v_actor is null then raise exception 'n2_not_authenticated'; end if;
  if not exists(select 1 from public.center_members m join public.centers c on c.id=m.center_id
    where m.center_id=p_center_id and m.user_id=v_actor and m.status='active'
      and c.status='active' and pg_catalog.lower(pg_catalog.btrim(m.role))='owner') then
    raise exception 'n2_audit_owner_required';
  end if;
  v_year:=coalesce(p_year,extract(year from pg_catalog.clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::integer);
  if v_year<2000 or v_year>9999 or p_limit not between 1 and 200 or p_offset<0 or p_offset>1000000 then
    raise exception 'n2_invalid_audit_filter';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e) order by e.created_at desc,e.id desc),'[]'::jsonb)
    into v_rows from (
      select a.* from public.center_business_audit_events a
      where a.center_id=p_center_id and a.domain='ATTENDANCE'
        and a.created_at>=make_timestamptz(v_year,1,1,0,0,0,'Asia/Ho_Chi_Minh')
        and a.created_at<make_timestamptz(v_year+1,1,1,0,0,0,'Asia/Ho_Chi_Minh')
        and (p_student_local_id is null or a.student_local_id=p_student_local_id)
        and (p_schedule_session_local_id is null or a.schedule_session_local_id=p_schedule_session_local_id)
        and (p_audit_batch_id is null or a.audit_batch_id=p_audit_batch_id)
      order by a.created_at desc,a.id desc limit p_limit offset p_offset
    ) e;
  return pg_catalog.jsonb_build_object('ok',true,'center_id',p_center_id,'year',v_year,
    'limit',p_limit,'offset',p_offset,'events',v_rows);
end $$;
revoke all on function public.v2_9_list_attendance_audit_events(text,integer,text,text,uuid,integer,integer)
  from public,anon,authenticated,service_role;
grant execute on function public.v2_9_list_attendance_audit_events(text,integer,text,text,uuid,integer,integer)
  to authenticated;

commit;
