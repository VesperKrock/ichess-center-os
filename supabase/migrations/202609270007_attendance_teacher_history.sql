-- A3: effective-dated class teacher and one-occurrence actual teacher.
do $$ begin
  if pg_catalog.to_regclass('public.center_schedule_occurrences') is null
     or pg_catalog.to_regclass('public.canonical_teacher_registry') is null
     or pg_catalog.to_regclass('public.teacher_center_assignments') is null
     or pg_catalog.to_regprocedure('public.a2_internal_resolve_occurrence(text,text,date,uuid)') is null then
    raise exception 'a3_required_authority_missing';
  end if;
end $$;

create table public.center_class_teacher_assignments (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null references public.centers(id) on delete restrict,
  class_session_local_id text not null,
  teacher_id uuid references public.canonical_teacher_registry(id) on delete restrict,
  teacher_name text not null default '' check (pg_catalog.char_length(teacher_name) <= 160),
  effective_from date not null,
  effective_to date,
  source text not null check (source in ('LEGACY_OPENING','A3_COMMAND')),
  version bigint not null default 1 check (version >= 1),
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique(center_id,class_session_local_id,effective_from),
  check(effective_to is null or effective_to >= effective_from),
  check(source <> 'A3_COMMAND' or (teacher_id is not null and pg_catalog.btrim(teacher_name) <> ''))
);
create index center_class_teacher_assignments_lookup_idx
  on public.center_class_teacher_assignments(center_id,class_session_local_id,effective_from desc);
alter table public.center_class_teacher_assignments enable row level security;
alter table public.center_class_teacher_assignments force row level security;
revoke all on public.center_class_teacher_assignments from public,anon,authenticated,service_role;
grant all on public.center_class_teacher_assignments to service_role;

-- A row lock is not sufficient for empty ranges. The advisory lock also
-- protects direct service-role writes from overlapping concurrent inserts.
create function public.a3_internal_guard_teacher_range()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'a3.teacher|'||new.center_id||'|'||new.class_session_local_id,0));
  if exists (select 1 from public.center_class_teacher_assignments x
    where x.center_id=new.center_id and x.class_session_local_id=new.class_session_local_id
      and x.id<>new.id and x.effective_from<=coalesce(new.effective_to,'infinity'::date)
      and new.effective_from<=coalesce(x.effective_to,'infinity'::date)) then
    raise exception 'a3_teacher_range_overlap';
  end if;
  return new;
end $$;
create trigger a3_guard_teacher_range before insert or update
  on public.center_class_teacher_assignments for each row
  execute function public.a3_internal_guard_teacher_range();

-- The mutable class field is legacy evidence only. A3 commands never update it.
create function public.a3_internal_guard_legacy_class_teacher()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.entity_type='class_session' and (
    (tg_op='INSERT' and pg_catalog.btrim(coalesce(new.payload->>'instructorName',''))<>'')
    or (tg_op='UPDATE' and coalesce(new.payload->>'instructorName','')
      is distinct from coalesce(old.payload->>'instructorName',''))
  ) then raise exception 'a3_use_dated_teacher_change'; end if;
  return new;
end $$;
create trigger a3_guard_legacy_class_teacher before insert or update
  on public.center_cloud_entities for each row
  execute function public.a3_internal_guard_legacy_class_teacher();

-- Opening evidence starts today. No pre-A3 change date is invented.
insert into public.center_class_teacher_assignments(
  center_id,class_session_local_id,teacher_name,effective_from,source,created_by,updated_by)
select c.center_id,c.local_id,pg_catalog.btrim(c.payload->>'instructorName'),
  (pg_catalog.clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date,
  'LEGACY_OPENING',c.updated_by,c.updated_by
from public.center_cloud_entities c
where c.entity_type='class_session' and c.deleted_at is null
  and pg_catalog.btrim(coalesce(c.payload->>'instructorName',''))<>'';

alter table public.center_schedule_occurrences
  add column actual_teacher_id uuid references public.canonical_teacher_registry(id) on delete restrict,
  add column actual_teacher_name text not null default '' check(pg_catalog.char_length(actual_teacher_name)<=160),
  add column actual_teacher_override boolean not null default false,
  add column actual_teacher_set_by uuid references auth.users(id) on delete restrict,
  add column actual_teacher_set_at timestamptz,
  add constraint a3_actual_teacher_consistency check (
    (actual_teacher_override and actual_teacher_id is not null
      and pg_catalog.btrim(actual_teacher_name)<>'' and actual_teacher_set_by is not null
      and actual_teacher_set_at is not null)
    or (not actual_teacher_override and actual_teacher_id is null
      and actual_teacher_name='' and actual_teacher_set_by is null
      and actual_teacher_set_at is null));

create table public.a3_teacher_command_results (
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  intent jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key(center_id,actor_user_id,idempotency_key)
);
create table public.a3_teacher_events (
  id bigint generated always as identity primary key,
  center_id text not null references public.centers(id) on delete restrict,
  class_session_local_id text,
  schedule_session_local_id text,
  occurrence_date date,
  event_type text not null check(event_type in ('CLASS_CHANGE','OCCURRENCE_SET','OCCURRENCE_CLEAR')),
  before_state jsonb,
  after_state jsonb,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  unique(center_id,actor_user_id,idempotency_key)
);
alter table public.a3_teacher_command_results enable row level security;
alter table public.a3_teacher_command_results force row level security;
alter table public.a3_teacher_events enable row level security;
alter table public.a3_teacher_events force row level security;
revoke all on public.a3_teacher_command_results,public.a3_teacher_events from public,anon,authenticated,service_role;
grant all on public.a3_teacher_command_results,public.a3_teacher_events to service_role;
grant usage,select on sequence public.a3_teacher_events_id_seq to service_role;

create function public.a3_internal_teacher_on_date(
  p_center_id text,p_class_id text,p_date date)
returns table(teacher_id uuid,teacher_name text)
language sql stable security definer set search_path = '' as $$
  select a.teacher_id,a.teacher_name
  from public.center_class_teacher_assignments a
  where a.center_id=p_center_id and a.class_session_local_id=p_class_id
    and a.effective_from<=p_date and (a.effective_to is null or a.effective_to>=p_date)
  order by a.effective_from desc limit 1
$$;

create function public.a3_change_class_teacher(
  p_center_id text,p_class_id text,p_teacher_id uuid,p_effective_from date,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_intent jsonb := pg_catalog.jsonb_build_object('kind','CLASS_CHANGE','class',p_class_id,
    'teacher',p_teacher_id,'from',p_effective_from);
  v_prior public.a3_teacher_command_results;
  v_class public.center_cloud_entities;
  v_teacher public.canonical_teacher_registry;
  v_current public.center_class_teacher_assignments;
  v_next date;
  v_saved public.center_class_teacher_assignments;
  v_before jsonb;
  v_result jsonb;
begin
  if v_actor is null or p_idempotency_key is null or p_teacher_id is null
     or p_effective_from is null or p_effective_from <
       (pg_catalog.clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date then
    raise exception 'a3_invalid_class_teacher_change';
  end if;
  if not exists(select 1 from public.center_members m join public.centers c on c.id=m.center_id
    where m.center_id=p_center_id and m.user_id=v_actor and m.status='active'
      and c.status='active' and pg_catalog.lower(m.role) in ('owner','qtv','center_admin','admin')) then
    raise exception 'a3_center_access_denied';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'a3.teacher|'||p_center_id||'|'||p_class_id,0));
  select * into v_prior from public.a3_teacher_command_results
  where center_id=p_center_id and actor_user_id=v_actor and idempotency_key=p_idempotency_key for update;
  if found then
    if v_prior.intent<>v_intent then raise exception 'a3_idempotency_conflict'; end if;
    return v_prior.result||pg_catalog.jsonb_build_object('replayed',true);
  end if;
  select * into v_class from public.center_cloud_entities c
  where c.center_id=p_center_id and c.entity_type='class_session'
    and c.local_id=p_class_id and c.deleted_at is null for update;
  if v_class.id is null then raise exception 'a3_class_not_found'; end if;
  if p_effective_from=(pg_catalog.clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date
     and exists(select 1 from public.center_schedule_occurrences o
       where o.center_id=p_center_id and o.class_session_local_id=p_class_id
         and o.occurrence_date=p_effective_from) then
    raise exception 'a3_today_occurrence_already_materialized';
  end if;
  select t.* into v_teacher from public.canonical_teacher_registry t
  join public.teacher_center_assignments a on a.teacher_id=t.id
  where t.id=p_teacher_id and t.status='active' and a.center_id=p_center_id
    and a.status='assigned' for share of t,a;
  if v_teacher.id is null then raise exception 'a3_teacher_not_assigned_to_center'; end if;
  select * into v_current from public.center_class_teacher_assignments a
  where a.center_id=p_center_id and a.class_session_local_id=p_class_id
    and a.effective_from<=p_effective_from
    and (a.effective_to is null or a.effective_to>=p_effective_from)
  for update;
  if v_current.id is not null and v_current.teacher_id=p_teacher_id then
    v_result:=pg_catalog.jsonb_build_object('ok',true,'assignment',pg_catalog.to_jsonb(v_current),'changed',false);
  else
    v_before:=case when v_current.id is null then null else pg_catalog.to_jsonb(v_current) end;
    if v_current.id is not null and v_current.effective_from=p_effective_from then
      update public.center_class_teacher_assignments
      set teacher_id=p_teacher_id,teacher_name=v_teacher.display_name,source='A3_COMMAND',
        version=version+1,updated_by=v_actor,updated_at=pg_catalog.clock_timestamp()
      where id=v_current.id returning * into v_saved;
    else
      if v_current.id is not null then
        update public.center_class_teacher_assignments
        set effective_to=p_effective_from-1,version=version+1,
          updated_by=v_actor,updated_at=pg_catalog.clock_timestamp()
        where id=v_current.id;
        v_next:=v_current.effective_to;
      else
        select min(a.effective_from)-1 into v_next
        from public.center_class_teacher_assignments a
        where a.center_id=p_center_id and a.class_session_local_id=p_class_id
          and a.effective_from>p_effective_from;
      end if;
      insert into public.center_class_teacher_assignments(
        center_id,class_session_local_id,teacher_id,teacher_name,effective_from,effective_to,
        source,created_by,updated_by)
      values(p_center_id,p_class_id,p_teacher_id,v_teacher.display_name,p_effective_from,
        v_next,'A3_COMMAND',v_actor,v_actor) returning * into v_saved;
    end if;
    insert into public.a3_teacher_events(center_id,class_session_local_id,event_type,
      before_state,after_state,actor_user_id,idempotency_key)
    values(p_center_id,p_class_id,'CLASS_CHANGE',v_before,pg_catalog.to_jsonb(v_saved),v_actor,p_idempotency_key);
    -- A dated plan that is still in the future follows a corrected future
    -- assignment. Held dates and all past facts remain frozen.
    update public.center_schedule_occurrences o
    set planned_teacher_id=(select teacher_id::text from public.a3_internal_teacher_on_date(
          p_center_id,p_class_id,o.occurrence_date)),
        planned_teacher_name=coalesce((select teacher_name from public.a3_internal_teacher_on_date(
          p_center_id,p_class_id,o.occurrence_date)),''),
        version=o.version+1,updated_by=v_actor,updated_at=pg_catalog.clock_timestamp()
    where o.center_id=p_center_id and o.class_session_local_id=p_class_id
      and o.occurrence_date>=p_effective_from
      and o.occurrence_date>(pg_catalog.clock_timestamp() at time zone 'Asia/Ho_Chi_Minh')::date
      and o.lifecycle_state='PLANNED'
      and (o.planned_teacher_id,o.planned_teacher_name) is distinct from (
        (select teacher_id::text from public.a3_internal_teacher_on_date(
          p_center_id,p_class_id,o.occurrence_date)),
        coalesce((select teacher_name from public.a3_internal_teacher_on_date(
          p_center_id,p_class_id,o.occurrence_date)),''));
    v_result:=pg_catalog.jsonb_build_object('ok',true,'assignment',pg_catalog.to_jsonb(v_saved),'changed',true);
  end if;
  insert into public.a3_teacher_command_results(center_id,actor_user_id,idempotency_key,intent,result)
  values(p_center_id,v_actor,p_idempotency_key,v_intent,v_result);
  return v_result;
end $$;

create function public.a3_set_occurrence_actual_teacher(
  p_center_id text,p_schedule_session_id text,p_occurrence_date date,
  p_action text,p_teacher_id uuid,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_action text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_action,'')));
  v_intent jsonb := pg_catalog.jsonb_build_object('kind','OCCURRENCE_TEACHER',
    'schedule',p_schedule_session_id,'date',p_occurrence_date,'action',p_action,'teacher',p_teacher_id);
  v_prior public.a3_teacher_command_results;
  v_fact public.center_schedule_occurrences;
  v_teacher public.canonical_teacher_registry;
  v_before jsonb;
  v_result jsonb;
  v_name text;
  v_id text;
begin
  if v_actor is null or p_idempotency_key is null or p_occurrence_date is null
     or v_action not in ('SET','CLEAR') or (v_action='SET' and p_teacher_id is null)
     or (v_action='CLEAR' and p_teacher_id is not null) then
    raise exception 'a3_invalid_occurrence_teacher_change';
  end if;
  if not exists(select 1 from public.center_members m join public.centers c on c.id=m.center_id
    where m.center_id=p_center_id and m.user_id=v_actor and m.status='active'
      and c.status='active' and pg_catalog.lower(m.role) in ('owner','qtv','center_admin','admin')) then
    raise exception 'a3_center_access_denied';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'a2.occurrence|'||p_center_id||'|'||p_schedule_session_id||'|'||p_occurrence_date::text,0));
  select * into v_prior from public.a3_teacher_command_results
  where center_id=p_center_id and actor_user_id=v_actor and idempotency_key=p_idempotency_key for update;
  if found then
    if v_prior.intent<>v_intent then raise exception 'a3_idempotency_conflict'; end if;
    return v_prior.result||pg_catalog.jsonb_build_object('replayed',true);
  end if;
  select * into v_fact from public.center_schedule_occurrences o
  where o.center_id=p_center_id and o.schedule_session_local_id=p_schedule_session_id
    and o.occurrence_date=p_occurrence_date for update;
  if v_fact.center_id is null then raise exception 'a3_occurrence_fact_required'; end if;
  if v_fact.lifecycle_state='CANCELLED' then raise exception 'a3_cancelled_occurrence'; end if;
  if v_action='SET' then
    select t.* into v_teacher from public.canonical_teacher_registry t
    join public.teacher_center_assignments a on a.teacher_id=t.id
    where t.id=p_teacher_id and t.status='active' and a.center_id=p_center_id
      and a.status='assigned' for share of t,a;
    if v_teacher.id is null then raise exception 'a3_teacher_not_assigned_to_center'; end if;
    v_name:=v_teacher.display_name;
    v_id:=p_teacher_id::text;
  else
    if v_fact.planned_teacher_name='' and exists(select 1 from public.center_cloud_entities e
      where e.center_id=p_center_id and e.entity_type='attendance_record' and e.deleted_at is null
        and e.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
        and e.payload->>'scheduleSessionId'=p_schedule_session_id
        and e.payload->>'date'=p_occurrence_date::text) then
      raise exception 'a3_clear_without_planned_teacher';
    end if;
    v_name:=v_fact.planned_teacher_name;
    v_id:=v_fact.planned_teacher_id;
  end if;
  if (v_action='SET' and v_fact.actual_teacher_override
        and v_fact.actual_teacher_id=p_teacher_id)
     or (v_action='CLEAR' and not v_fact.actual_teacher_override) then
    v_result:=pg_catalog.jsonb_build_object('ok',true,'occurrence',pg_catalog.to_jsonb(v_fact),'changed',false);
  else
    v_before:=pg_catalog.to_jsonb(v_fact);
    update public.center_schedule_occurrences
    set actual_teacher_override=(v_action='SET'),
      actual_teacher_id=case when v_action='SET' then p_teacher_id else null end,
      actual_teacher_name=case when v_action='SET' then v_name else '' end,
      actual_teacher_set_by=case when v_action='SET' then v_actor else null end,
      actual_teacher_set_at=case when v_action='SET' then pg_catalog.clock_timestamp() else null end,
      version=version+1,updated_by=v_actor,updated_at=pg_catalog.clock_timestamp()
    where center_id=p_center_id and schedule_session_local_id=p_schedule_session_id
      and occurrence_date=p_occurrence_date returning * into v_fact;
    -- Teacher metadata follows the explicit actual teacher. Attendance status,
    -- canonical identity and Tuition consumption units remain unchanged.
    update public.center_cloud_entities e
    set payload=e.payload||pg_catalog.jsonb_build_object('teacherId',v_id,'teacherName',v_name),
      entity_version=e.entity_version+1,updated_by=v_actor,updated_at=pg_catalog.clock_timestamp()
    where e.center_id=p_center_id and e.entity_type='attendance_record' and e.deleted_at is null
      and e.payload->>'attendanceAuthority'='v2.3-occurrence-v1'
      and e.payload->>'scheduleSessionId'=p_schedule_session_id
      and e.payload->>'date'=p_occurrence_date::text;
    insert into public.a3_teacher_events(center_id,class_session_local_id,
      schedule_session_local_id,occurrence_date,event_type,before_state,after_state,
      actor_user_id,idempotency_key)
    values(p_center_id,v_fact.class_session_local_id,p_schedule_session_id,p_occurrence_date,
      case when v_action='SET' then 'OCCURRENCE_SET' else 'OCCURRENCE_CLEAR' end,
      v_before,pg_catalog.to_jsonb(v_fact),v_actor,p_idempotency_key);
    v_result:=pg_catalog.jsonb_build_object('ok',true,'occurrence',pg_catalog.to_jsonb(v_fact),'changed',true);
  end if;
  insert into public.a3_teacher_command_results(center_id,actor_user_id,idempotency_key,intent,result)
  values(p_center_id,v_actor,p_idempotency_key,v_intent,v_result);
  return v_result;
end $$;

create function public.a3_list_teacher_context(p_center_id text,p_from_date date,p_to_date date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or p_from_date is null or p_to_date is null
     or p_to_date<p_from_date or p_to_date-p_from_date>62 then
    raise exception 'a3_invalid_read_range';
  end if;
  if not exists(select 1 from public.center_members m join public.centers c on c.id=m.center_id
    where m.center_id=p_center_id and m.user_id=v_actor and m.status='active'
      and c.status='active' and pg_catalog.lower(m.role) in ('owner','qtv','center_admin','admin')) then
    raise exception 'a3_center_access_denied';
  end if;
  return pg_catalog.jsonb_build_object('ok',true,'center_id',p_center_id,
    'assignments',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(a)
      order by a.class_session_local_id,a.effective_from)
      from public.center_class_teacher_assignments a where a.center_id=p_center_id),'[]'::jsonb),
    'occurrences',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(o)
      order by o.occurrence_date,o.schedule_session_local_id)
      from public.center_schedule_occurrences o where o.center_id=p_center_id
        and o.occurrence_date between p_from_date and p_to_date),'[]'::jsonb));
end $$;

revoke all on function public.a3_internal_guard_teacher_range(),
  public.a3_internal_guard_legacy_class_teacher(),
  public.a3_internal_teacher_on_date(text,text,date),
  public.a3_change_class_teacher(text,text,uuid,date,uuid),
  public.a3_set_occurrence_actual_teacher(text,text,date,text,uuid,uuid),
  public.a3_list_teacher_context(text,date,date)
  from public,anon,authenticated,service_role;
grant execute on function public.a3_change_class_teacher(text,text,uuid,date,uuid),
  public.a3_set_occurrence_actual_teacher(text,text,date,text,uuid,uuid),
  public.a3_list_teacher_context(text,date,date) to authenticated;

-- Extend A2's resolver and V2.3's existing command/guard without replacing
-- their natural keys, version handling, retirement, or Tuition trigger.
do $patch$
declare v_def text;
begin
  v_def:=pg_catalog.pg_get_functiondef(
    'public.a2_internal_resolve_occurrence(text,text,date,uuid)'::pg_catalog.regprocedure);
  if pg_catalog.strpos(v_def,'v_teacher_name := pg_catalog.btrim(coalesce(v_class.payload->>''instructorName'',''''));')<1 then
    raise exception 'a3_a2_resolver_contract_mismatch';
  end if;
  v_def:=pg_catalog.replace(v_def,
    'v_teacher_id := null;'||chr(10)||'      v_teacher_name := pg_catalog.btrim(coalesce(v_class.payload->>''instructorName'',''''));',
    'select teacher_id::text,teacher_name into v_teacher_id,v_teacher_name'||chr(10)||
    '      from public.a3_internal_teacher_on_date(p_center_id,v_class_id,p_occurrence_date);');
  execute v_def;

  v_def:=pg_catalog.pg_get_functiondef(
    'public.v2_3_internal_guard_occurrence_attendance()'::pg_catalog.regprocedure);
  if pg_catalog.strpos(v_def,'v_occurrence.planned_teacher_name')<1 then
    raise exception 'a3_v23_guard_contract_mismatch';
  end if;
  v_def:=pg_catalog.replace(v_def,'coalesce(new.payload->>''teacherName'','''') <> v_occurrence.planned_teacher_name',
    'coalesce(new.payload->>''teacherName'','''') <> (case when v_occurrence.actual_teacher_override'||chr(10)||
    '       then v_occurrence.actual_teacher_name else v_occurrence.planned_teacher_name end)');
  execute v_def;

  v_def:=pg_catalog.pg_get_functiondef(
    'public.v2_3_mutate_occurrence_attendance(text,text,date,jsonb,jsonb,uuid)'::pg_catalog.regprocedure);
  if pg_catalog.strpos(v_def,'''teacherName'', v_occurrence.planned_teacher_name')<1 then
    raise exception 'a3_v23_command_contract_mismatch';
  end if;
  v_def:=pg_catalog.replace(v_def,'''teacherId'', v_occurrence.planned_teacher_id',
    '''teacherId'', case when v_occurrence.actual_teacher_override then v_occurrence.actual_teacher_id::text else v_occurrence.planned_teacher_id end');
  v_def:=pg_catalog.replace(v_def,'''teacherName'', v_occurrence.planned_teacher_name',
    '''teacherName'', case when v_occurrence.actual_teacher_override then v_occurrence.actual_teacher_name else v_occurrence.planned_teacher_name end');
  execute v_def;
end $patch$;
