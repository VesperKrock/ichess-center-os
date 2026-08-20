begin;

-- C5.7 owns only custom center activities/tags and human-entered operational
-- attendance notes. C5.1 Schedule/Class remains the only class-time authority;
-- conflicts, warnings and report dashboard metrics remain derived.

create or replace function public.c5_7_calendar_notes_access_role(p_center_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select pg_catalog.lower(pg_catalog.replace(pg_catalog.replace(
    pg_catalog.btrim(coalesce(cm.role::text, '')), '-', '_'), ' ', '_'))
  from public.center_members cm
  join public.centers c on c.id = cm.center_id
  where cm.center_id = pg_catalog.btrim(coalesce(p_center_id, ''))
    and cm.user_id = auth.uid()
    and pg_catalog.lower(pg_catalog.btrim(coalesce(cm.status::text, ''))) = 'active'
    and pg_catalog.lower(pg_catalog.btrim(coalesce(c.status::text, ''))) = 'active'
    and pg_catalog.lower(pg_catalog.replace(pg_catalog.replace(
      pg_catalog.btrim(coalesce(cm.role::text, '')), '-', '_'), ' ', '_'))
      in ('owner', 'admin', 'center_admin', 'qtv', 'teacher', 'consultant', 'viewer')
  limit 1
$function$;

revoke all on function public.c5_7_calendar_notes_access_role(text)
  from public, anon, authenticated;

create or replace function public.c5_7_valid_recurrence_rule(
  p_rule jsonb,
  p_start_at timestamptz
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_end_mode text;
  v_days text[];
  v_until date;
  v_count integer;
begin
  if p_rule is null or p_rule = 'null'::jsonb then return true; end if;
  if pg_catalog.jsonb_typeof(p_rule) <> 'object'
     or p_rule->>'frequency' <> 'weekly'
     or (p_rule->>'interval')::integer <> 1
     or p_rule->>'timezone' <> 'Asia/Ho_Chi_Minh'
     or pg_catalog.jsonb_typeof(p_rule->'daysOfWeek') <> 'array' then
    return false;
  end if;

  select pg_catalog.array_agg(value order by value) into v_days
  from (select distinct value from pg_catalog.jsonb_array_elements_text(p_rule->'daysOfWeek')) d;
  if pg_catalog.coalesce(pg_catalog.array_length(v_days, 1), 0) < 1
     or pg_catalog.array_length(v_days, 1) > 7
     or exists (select 1 from pg_catalog.unnest(v_days) day where day not in ('mon','tue','wed','thu','fri','sat','sun'))
     or pg_catalog.jsonb_array_length(p_rule->'daysOfWeek') <> pg_catalog.array_length(v_days, 1) then
    return false;
  end if;

  v_end_mode := p_rule->>'endMode';
  if v_end_mode = 'until' then
    if coalesce(p_rule->>'untilDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or coalesce(p_rule->'count', 'null'::jsonb) <> 'null'::jsonb then return false; end if;
    v_until := (p_rule->>'untilDate')::date;
    return v_until >= (p_start_at at time zone 'Asia/Ho_Chi_Minh')::date;
  elsif v_end_mode = 'count' then
    if coalesce(p_rule->'untilDate', 'null'::jsonb) <> 'null'::jsonb then return false; end if;
    v_count := (p_rule->>'count')::integer;
    return v_count between 1 and 52;
  end if;
  return false;
exception when others then
  return false;
end
$function$;

revoke all on function public.c5_7_valid_recurrence_rule(jsonb, timestamptz)
  from public, anon, authenticated;

create table public.center_calendar_tags_authoritative (
  center_id text not null references public.centers(id) on delete cascade,
  id uuid not null,
  label text not null,
  color_key text not null,
  custom_color text not null default '',
  default_item_type text not null default '',
  description text not null default '',
  status text not null default 'ACTIVE',
  version bigint not null default 1,
  created_by_user_id uuid not null references auth.users(id),
  created_by_membership_id uuid not null references public.center_members(id),
  created_by_role text not null,
  updated_by_user_id uuid not null references auth.users(id),
  updated_by_membership_id uuid not null references public.center_members(id),
  updated_by_role text not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  archived_at timestamptz,
  primary key (center_id, id),
  constraint center_calendar_tags_auth_label_check check (pg_catalog.length(pg_catalog.btrim(label)) between 1 and 50),
  constraint center_calendar_tags_auth_color_check check (color_key in ('blue','green','yellow','orange','red','purple','pink','gray','emerald')),
  constraint center_calendar_tags_auth_custom_color_check check (custom_color = '' or custom_color ~ '^#[0-9a-f]{6}$'),
  constraint center_calendar_tags_auth_default_type_check check (default_item_type in ('','meeting','event','tournament','other')),
  constraint center_calendar_tags_auth_description_check check (pg_catalog.length(description) <= 2000),
  constraint center_calendar_tags_auth_status_check check (status in ('ACTIVE','ARCHIVED')),
  constraint center_calendar_tags_auth_version_check check (version >= 1),
  constraint center_calendar_tags_auth_archived_check check ((status = 'ACTIVE' and archived_at is null) or (status = 'ARCHIVED' and archived_at is not null))
);

create unique index center_calendar_tags_auth_active_label_unique
  on public.center_calendar_tags_authoritative (center_id, pg_catalog.lower(pg_catalog.btrim(label)))
  where status = 'ACTIVE';

create table public.center_calendar_items_authoritative (
  center_id text not null references public.centers(id) on delete cascade,
  id uuid not null,
  item_type text not null,
  item_subtype text not null default '',
  title text not null,
  description text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  location text not null default '',
  room_id text not null default '',
  color_key text not null,
  custom_color text not null default '',
  tag_id uuid,
  recurrence_rule jsonb,
  is_cancelled boolean not null default false,
  status text not null default 'ACTIVE',
  version bigint not null default 1,
  created_by_user_id uuid not null references auth.users(id),
  created_by_membership_id uuid not null references public.center_members(id),
  created_by_role text not null,
  updated_by_user_id uuid not null references auth.users(id),
  updated_by_membership_id uuid not null references public.center_members(id),
  updated_by_role text not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  archived_at timestamptz,
  primary key (center_id, id),
  foreign key (center_id, tag_id) references public.center_calendar_tags_authoritative(center_id, id),
  constraint center_calendar_items_auth_type_check check (item_type in ('MEETING','EVENT','TOURNAMENT','OTHER')),
  constraint center_calendar_items_auth_title_check check (pg_catalog.length(pg_catalog.btrim(title)) between 1 and 200),
  constraint center_calendar_items_auth_text_check check (pg_catalog.length(item_subtype) <= 120 and pg_catalog.length(description) <= 8000 and pg_catalog.length(location) <= 500 and pg_catalog.length(room_id) <= 200),
  constraint center_calendar_items_auth_time_check check (end_at >= start_at),
  constraint center_calendar_items_auth_color_check check (color_key in ('blue','green','yellow','orange','red','purple','pink','gray','emerald')),
  constraint center_calendar_items_auth_custom_color_check check (custom_color = '' or custom_color ~ '^#[0-9a-f]{6}$'),
  constraint center_calendar_items_auth_recurrence_check check (public.c5_7_valid_recurrence_rule(recurrence_rule, start_at)),
  constraint center_calendar_items_auth_status_check check (status in ('ACTIVE','ARCHIVED')),
  constraint center_calendar_items_auth_version_check check (version >= 1),
  constraint center_calendar_items_auth_archived_check check ((status = 'ACTIVE' and archived_at is null) or (status = 'ARCHIVED' and archived_at is not null))
);

create index center_calendar_items_auth_range_idx
  on public.center_calendar_items_authoritative(center_id, start_at, end_at);

create table public.center_operational_attendance_notes (
  center_id text not null references public.centers(id) on delete cascade,
  id uuid not null,
  note_kind text not null,
  student_local_id text not null,
  month_key text not null,
  care_status text not null default '',
  note text not null default '',
  version bigint not null default 1,
  created_by_user_id uuid not null references auth.users(id),
  created_by_membership_id uuid not null references public.center_members(id),
  created_by_role text not null,
  updated_by_user_id uuid not null references auth.users(id),
  updated_by_membership_id uuid not null references public.center_members(id),
  updated_by_role text not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (center_id, id),
  unique (center_id, note_kind, student_local_id, month_key),
  constraint center_operational_attendance_notes_kind_check check (note_kind in ('ATTENDANCE_ADVISORY','ATTENDANCE_BOARD')),
  constraint center_operational_attendance_notes_student_check check (pg_catalog.length(pg_catalog.btrim(student_local_id)) between 1 and 200 and student_local_id !~ '[[:cntrl:]]'),
  constraint center_operational_attendance_notes_month_check check (month_key ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  constraint center_operational_attendance_notes_care_check check ((note_kind = 'ATTENDANCE_ADVISORY' and care_status in ('auto','needReview','sentComment','contactedParent','waitingParent','completed')) or (note_kind = 'ATTENDANCE_BOARD' and care_status = '')),
  constraint center_operational_attendance_notes_note_check check (pg_catalog.length(note) <= 8000),
  constraint center_operational_attendance_notes_version_check check (version >= 1)
);

create index center_operational_attendance_notes_student_idx
  on public.center_operational_attendance_notes(center_id, student_local_id, month_key desc);

create table public.center_calendar_notes_audit_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  actor_membership_id uuid not null references public.center_members(id),
  actor_role text not null,
  operation text not null,
  entity_type text not null,
  entity_id uuid not null,
  entity_version bigint not null,
  before_state jsonb,
  after_state jsonb not null,
  command_idempotency_key uuid not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint center_calendar_notes_audit_version_check check (entity_version >= 1),
  constraint center_calendar_notes_audit_entity_check check (entity_type in ('CALENDAR_TAG','CALENDAR_ITEM','ATTENDANCE_ADVISORY_NOTE','ATTENDANCE_BOARD_NOTE')),
  unique (center_id, actor_user_id, command_idempotency_key)
);

create table public.center_calendar_notes_command_results (
  center_id text not null references public.centers(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  idempotency_key uuid not null,
  intent_digest bytea not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key (center_id, actor_user_id, idempotency_key),
  constraint center_calendar_notes_command_digest_check check (pg_catalog.octet_length(intent_digest) = 32),
  constraint center_calendar_notes_command_result_check check (pg_catalog.jsonb_typeof(result_snapshot) = 'object' and result_snapshot->>'outcome_code' = 'COMMITTED')
);

alter table public.center_calendar_tags_authoritative enable row level security;
alter table public.center_calendar_tags_authoritative force row level security;
alter table public.center_calendar_items_authoritative enable row level security;
alter table public.center_calendar_items_authoritative force row level security;
alter table public.center_operational_attendance_notes enable row level security;
alter table public.center_operational_attendance_notes force row level security;
alter table public.center_calendar_notes_audit_events enable row level security;
alter table public.center_calendar_notes_audit_events force row level security;
alter table public.center_calendar_notes_command_results enable row level security;
alter table public.center_calendar_notes_command_results force row level security;

revoke all on table public.center_calendar_tags_authoritative from public, anon, authenticated, service_role;
revoke all on table public.center_calendar_items_authoritative from public, anon, authenticated, service_role;
revoke all on table public.center_operational_attendance_notes from public, anon, authenticated, service_role;
revoke all on table public.center_calendar_notes_audit_events from public, anon, authenticated, service_role;
revoke all on table public.center_calendar_notes_command_results from public, anon, authenticated, service_role;

create or replace function public.c5_7_list_calendar_notes_shared_truth(p_center_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
begin
  if auth.uid() is null then return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED'); end if;
  if v_center_id = '' or pg_catalog.length(v_center_id) > 160 or v_center_id !~ '^[A-Za-z0-9_-]+$' then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_CENTER');
  end if;
  if public.c5_7_calendar_notes_access_role(v_center_id) is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CENTER_ACCESS_DENIED');
  end if;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'AUTHORITATIVE_SNAPSHOT',
    'center_id', v_center_id,
    'calendar_tags', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'center_id', t.center_id, 'id', t.id, 'label', t.label,
        'color_key', t.color_key, 'custom_color', t.custom_color,
        'default_item_type', t.default_item_type, 'description', t.description,
        'status', t.status, 'version', t.version,
        'actor_user_id', t.updated_by_user_id,
        'actor_membership_id', t.updated_by_membership_id,
        'actor_role', t.updated_by_role,
        'created_at', t.created_at, 'updated_at', t.updated_at
      ) order by pg_catalog.lower(t.label), t.id)
      from public.center_calendar_tags_authoritative t where t.center_id = v_center_id
    ), '[]'::jsonb),
    'calendar_items', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'center_id', i.center_id, 'id', i.id, 'item_type', i.item_type,
        'item_subtype', i.item_subtype, 'title', i.title, 'description', i.description,
        'start_at', i.start_at, 'end_at', i.end_at, 'all_day', i.all_day,
        'location', i.location, 'room_id', i.room_id, 'color_key', i.color_key,
        'custom_color', i.custom_color, 'tag_id', coalesce(i.tag_id::text, ''),
        'tag_label', coalesce(t.label, ''), 'recurrence_rule', i.recurrence_rule,
        'is_cancelled', i.is_cancelled, 'status', i.status, 'version', i.version,
        'actor_user_id', i.updated_by_user_id,
        'actor_membership_id', i.updated_by_membership_id,
        'actor_role', i.updated_by_role,
        'created_at', i.created_at, 'updated_at', i.updated_at
      ) order by i.start_at, i.id)
      from public.center_calendar_items_authoritative i
      left join public.center_calendar_tags_authoritative t
        on t.center_id = i.center_id and t.id = i.tag_id
      where i.center_id = v_center_id
    ), '[]'::jsonb),
    'operational_notes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'center_id', n.center_id, 'id', n.id, 'note_kind', n.note_kind,
        'student_local_id', n.student_local_id, 'month_key', n.month_key,
        'care_status', n.care_status, 'note', n.note, 'version', n.version,
        'actor_user_id', n.updated_by_user_id,
        'actor_membership_id', n.updated_by_membership_id,
        'actor_role', n.updated_by_role,
        'created_at', n.created_at, 'updated_at', n.updated_at
      ) order by n.month_key desc, n.note_kind, n.student_local_id)
      from public.center_operational_attendance_notes n where n.center_id = v_center_id
    ), '[]'::jsonb)
  );
end
$function$;

create or replace function public.c5_7_mutate_calendar_notes_shared_truth(
  p_center_id text,
  p_command jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_role text;
  v_membership_id uuid;
  v_operation text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', '')));
  v_expected_version bigint;
  v_digest bytea;
  v_existing_result public.center_calendar_notes_command_results%rowtype;
  v_tag public.center_calendar_tags_authoritative%rowtype;
  v_item public.center_calendar_items_authoritative%rowtype;
  v_note public.center_operational_attendance_notes%rowtype;
  v_tag_id uuid;
  v_item_id uuid;
  v_note_id uuid;
  v_tag_ref uuid;
  v_entity_type text;
  v_entity_id uuid;
  v_entity_version bigint;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_note_kind text;
  v_student_local_id text;
  v_month_key text;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_actor is null then return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED'); end if;
  if v_center_id = '' or pg_catalog.length(v_center_id) > 160 or v_center_id !~ '^[A-Za-z0-9_-]+$' then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_CENTER');
  end if;
  if p_command is null or pg_catalog.jsonb_typeof(p_command) <> 'object'
     or pg_catalog.octet_length(pg_catalog.convert_to(p_command::text, 'UTF8')) > 65536
     or p_idempotency_key is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;

  v_role := public.c5_7_calendar_notes_access_role(v_center_id);
  if v_role is null then return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CENTER_ACCESS_DENIED'); end if;
  if v_role not in ('owner','admin','center_admin','qtv') then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'WRITE_ROLE_REQUIRED');
  end if;
  select cm.id into v_membership_id
  from public.center_members cm
  where cm.center_id = v_center_id and cm.user_id = v_actor
    and pg_catalog.lower(pg_catalog.btrim(coalesce(cm.status::text, ''))) = 'active'
  limit 1;
  if v_membership_id is null then return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CENTER_ACCESS_DENIED'); end if;

  begin v_expected_version := (p_command->>'expected_version')::bigint;
  exception when others then return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND'); end;
  if v_expected_version < 0 then return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND'); end if;

  v_digest := extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'center_id', v_center_id, 'command', p_command
  )::text, 'UTF8'), 'sha256');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_center_id || ':c5.7-command:' || v_actor::text || ':' || p_idempotency_key::text, 0));
  select * into v_existing_result from public.center_calendar_notes_command_results
  where center_id = v_center_id and actor_user_id = v_actor and idempotency_key = p_idempotency_key;
  if found then
    if v_existing_result.intent_digest <> v_digest then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return v_existing_result.result_snapshot;
  end if;

  if v_operation in ('CREATE_CALENDAR_TAG','UPDATE_CALENDAR_TAG','SET_CALENDAR_TAG_ACTIVE') then
    if coalesce(p_command->>'tag_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_tag_id := (p_command->>'tag_id')::uuid;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_center_id || ':c5.7-tag:' || v_tag_id::text, 0));

    if v_operation = 'CREATE_CALENDAR_TAG' then
      if v_expected_version <> 0
         or pg_catalog.length(pg_catalog.btrim(coalesce(p_command->>'label',''))) not between 1 and 50
         or p_command->>'color_key' not in ('blue','green','yellow','orange','red','purple','pink','gray','emerald')
         or coalesce(p_command->>'custom_color','') !~ '^(|#[0-9a-f]{6})$'
         or coalesce(p_command->>'default_item_type','') not in ('','meeting','event','tournament','other')
         or pg_catalog.length(coalesce(p_command->>'description','')) > 2000 then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        v_center_id || ':c5.7-tag-label:' || pg_catalog.lower(pg_catalog.btrim(p_command->>'label')), 0));
      if exists (select 1 from public.center_calendar_tags_authoritative t where t.center_id = v_center_id and t.id = v_tag_id) then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
      end if;
      if exists (select 1 from public.center_calendar_tags_authoritative t where t.center_id = v_center_id and t.status = 'ACTIVE' and pg_catalog.lower(pg_catalog.btrim(t.label)) = pg_catalog.lower(pg_catalog.btrim(p_command->>'label'))) then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'DUPLICATE_ACTIVE_TAG');
      end if;
      insert into public.center_calendar_tags_authoritative(
        center_id,id,label,color_key,custom_color,default_item_type,description,status,version,
        created_by_user_id,created_by_membership_id,created_by_role,
        updated_by_user_id,updated_by_membership_id,updated_by_role,created_at,updated_at
      ) values (
        v_center_id,v_tag_id,pg_catalog.btrim(p_command->>'label'),p_command->>'color_key',
        coalesce(p_command->>'custom_color',''),coalesce(p_command->>'default_item_type',''),
        coalesce(p_command->>'description',''),'ACTIVE',1,
        v_actor,v_membership_id,v_role,v_actor,v_membership_id,v_role,v_now,v_now
      ) returning * into v_tag;
      v_before := null;
    else
      select * into v_tag from public.center_calendar_tags_authoritative
      where center_id = v_center_id and id = v_tag_id for update;
      if not found then return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_NOT_FOUND_OR_DENIED'); end if;
      if v_tag.version <> v_expected_version then return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE'); end if;
      v_before := pg_catalog.to_jsonb(v_tag);

      if v_operation = 'UPDATE_CALENDAR_TAG' then
        if pg_catalog.length(pg_catalog.btrim(coalesce(p_command->>'label',''))) not between 1 and 50
           or p_command->>'color_key' not in ('blue','green','yellow','orange','red','purple','pink','gray','emerald')
           or coalesce(p_command->>'custom_color','') !~ '^(|#[0-9a-f]{6})$'
           or coalesce(p_command->>'default_item_type','') not in ('','meeting','event','tournament','other')
           or pg_catalog.length(coalesce(p_command->>'description','')) > 2000 then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
        end if;
        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
          v_center_id || ':c5.7-tag-label:' || pg_catalog.lower(pg_catalog.btrim(p_command->>'label')), 0));
        if v_tag.status = 'ACTIVE' and exists (
          select 1 from public.center_calendar_tags_authoritative t
          where t.center_id = v_center_id and t.id <> v_tag.id and t.status = 'ACTIVE'
            and pg_catalog.lower(pg_catalog.btrim(t.label)) = pg_catalog.lower(pg_catalog.btrim(p_command->>'label'))
        ) then return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'DUPLICATE_ACTIVE_TAG'); end if;
        update public.center_calendar_tags_authoritative set
          label=pg_catalog.btrim(p_command->>'label'), color_key=p_command->>'color_key',
          custom_color=coalesce(p_command->>'custom_color',''),
          default_item_type=coalesce(p_command->>'default_item_type',''),
          description=coalesce(p_command->>'description',''), version=version+1,
          updated_by_user_id=v_actor,updated_by_membership_id=v_membership_id,updated_by_role=v_role,updated_at=v_now
        where center_id=v_center_id and id=v_tag_id returning * into v_tag;
      else
        if pg_catalog.jsonb_typeof(p_command->'is_active') <> 'boolean' then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
        end if;
        if (p_command->>'is_active')::boolean then
          perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
            v_center_id || ':c5.7-tag-label:' || pg_catalog.lower(pg_catalog.btrim(v_tag.label)), 0));
          if exists (select 1 from public.center_calendar_tags_authoritative t
            where t.center_id=v_center_id and t.id<>v_tag.id and t.status='ACTIVE'
              and pg_catalog.lower(pg_catalog.btrim(t.label))=pg_catalog.lower(pg_catalog.btrim(v_tag.label))) then
            return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'DUPLICATE_ACTIVE_TAG');
          end if;
        end if;
        update public.center_calendar_tags_authoritative set
          status=case when (p_command->>'is_active')::boolean then 'ACTIVE' else 'ARCHIVED' end,
          archived_at=case when (p_command->>'is_active')::boolean then null else v_now end,
          version=version+1,updated_by_user_id=v_actor,updated_by_membership_id=v_membership_id,
          updated_by_role=v_role,updated_at=v_now
        where center_id=v_center_id and id=v_tag_id returning * into v_tag;
      end if;
    end if;
    v_entity_type := 'CALENDAR_TAG'; v_entity_id := v_tag.id; v_entity_version := v_tag.version; v_after := pg_catalog.to_jsonb(v_tag);

  elsif v_operation in ('CREATE_CALENDAR_ITEM','UPDATE_CALENDAR_ITEM','ARCHIVE_CALENDAR_ITEM') then
    if coalesce(p_command->>'item_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_item_id := (p_command->>'item_id')::uuid;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_center_id || ':c5.7-item:' || v_item_id::text, 0));
    if v_operation <> 'CREATE_CALENDAR_ITEM' then
      select * into v_item from public.center_calendar_items_authoritative
      where center_id=v_center_id and id=v_item_id for update;
      if not found then return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_NOT_FOUND_OR_DENIED'); end if;
      if v_item.version <> v_expected_version then return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE'); end if;
      v_before := pg_catalog.to_jsonb(v_item);
    elsif v_expected_version <> 0 or exists (select 1 from public.center_calendar_items_authoritative i where i.center_id=v_center_id and i.id=v_item_id) then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    else v_before := null;
    end if;

    if v_operation = 'ARCHIVE_CALENDAR_ITEM' then
      update public.center_calendar_items_authoritative set status='ARCHIVED',archived_at=v_now,
        version=version+1,updated_by_user_id=v_actor,updated_by_membership_id=v_membership_id,
        updated_by_role=v_role,updated_at=v_now
      where center_id=v_center_id and id=v_item_id returning * into v_item;
    else
      if p_command->>'item_type' not in ('MEETING','EVENT','TOURNAMENT','OTHER')
         or pg_catalog.length(pg_catalog.btrim(coalesce(p_command->>'title',''))) not between 1 and 200
         or pg_catalog.length(coalesce(p_command->>'item_subtype','')) > 120
         or pg_catalog.length(coalesce(p_command->>'description','')) > 8000
         or pg_catalog.length(coalesce(p_command->>'location','')) > 500
         or pg_catalog.length(coalesce(p_command->>'room_id','')) > 200
         or p_command->>'color_key' not in ('blue','green','yellow','orange','red','purple','pink','gray','emerald')
         or coalesce(p_command->>'custom_color','') !~ '^(|#[0-9a-f]{6})$'
         or pg_catalog.jsonb_typeof(p_command->'all_day') <> 'boolean'
         or pg_catalog.jsonb_typeof(p_command->'is_cancelled') <> 'boolean' then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;
      begin
        if (p_command->>'end_at')::timestamptz < (p_command->>'start_at')::timestamptz
           or not public.c5_7_valid_recurrence_rule(p_command->'recurrence_rule', (p_command->>'start_at')::timestamptz) then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
        end if;
      exception when others then return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD'); end;

      v_tag_ref := null;
      if p_command->'tag_id' is not null and p_command->>'tag_id' <> '' then
        if p_command->>'tag_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TAG_REFERENCE_DENIED');
        end if;
        v_tag_ref := (p_command->>'tag_id')::uuid;
        if not exists (select 1 from public.center_calendar_tags_authoritative t
          where t.center_id=v_center_id and t.id=v_tag_ref
            and (t.status='ACTIVE' or (v_item.id is not null and v_item.tag_id=v_tag_ref))) then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TAG_REFERENCE_DENIED');
        end if;
      end if;

      if v_operation = 'CREATE_CALENDAR_ITEM' then
        insert into public.center_calendar_items_authoritative(
          center_id,id,item_type,item_subtype,title,description,start_at,end_at,all_day,
          location,room_id,color_key,custom_color,tag_id,recurrence_rule,is_cancelled,status,version,
          created_by_user_id,created_by_membership_id,created_by_role,
          updated_by_user_id,updated_by_membership_id,updated_by_role,created_at,updated_at
        ) values (
          v_center_id,v_item_id,p_command->>'item_type',coalesce(p_command->>'item_subtype',''),
          pg_catalog.btrim(p_command->>'title'),coalesce(p_command->>'description',''),
          (p_command->>'start_at')::timestamptz,(p_command->>'end_at')::timestamptz,
          (p_command->>'all_day')::boolean,coalesce(p_command->>'location',''),coalesce(p_command->>'room_id',''),
          p_command->>'color_key',coalesce(p_command->>'custom_color',''),v_tag_ref,p_command->'recurrence_rule',
          (p_command->>'is_cancelled')::boolean,'ACTIVE',1,
          v_actor,v_membership_id,v_role,v_actor,v_membership_id,v_role,v_now,v_now
        ) returning * into v_item;
      else
        update public.center_calendar_items_authoritative set
          item_type=p_command->>'item_type',item_subtype=coalesce(p_command->>'item_subtype',''),
          title=pg_catalog.btrim(p_command->>'title'),description=coalesce(p_command->>'description',''),
          start_at=(p_command->>'start_at')::timestamptz,end_at=(p_command->>'end_at')::timestamptz,
          all_day=(p_command->>'all_day')::boolean,location=coalesce(p_command->>'location',''),
          room_id=coalesce(p_command->>'room_id',''),color_key=p_command->>'color_key',
          custom_color=coalesce(p_command->>'custom_color',''),tag_id=v_tag_ref,
          recurrence_rule=p_command->'recurrence_rule',is_cancelled=(p_command->>'is_cancelled')::boolean,
          version=version+1,updated_by_user_id=v_actor,updated_by_membership_id=v_membership_id,
          updated_by_role=v_role,updated_at=v_now
        where center_id=v_center_id and id=v_item_id returning * into v_item;
      end if;
    end if;
    v_entity_type := 'CALENDAR_ITEM'; v_entity_id := v_item.id; v_entity_version := v_item.version; v_after := pg_catalog.to_jsonb(v_item);

  elsif v_operation in ('UPSERT_ATTENDANCE_ADVISORY_NOTE','UPSERT_ATTENDANCE_BOARD_NOTE') then
    if coalesce(p_command->>'note_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or pg_catalog.length(pg_catalog.btrim(coalesce(p_command->>'student_local_id',''))) not between 1 and 200
       or p_command->>'student_local_id' ~ '[[:cntrl:]]'
       or coalesce(p_command->>'month_key','') !~ '^\d{4}-(0[1-9]|1[0-2])$'
       or pg_catalog.length(coalesce(p_command->>'note','')) > 8000 then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_note_id := (p_command->>'note_id')::uuid;
    v_student_local_id := pg_catalog.btrim(p_command->>'student_local_id');
    v_month_key := p_command->>'month_key';
    v_note_kind := case when v_operation='UPSERT_ATTENDANCE_ADVISORY_NOTE' then 'ATTENDANCE_ADVISORY' else 'ATTENDANCE_BOARD' end;
    if (v_note_kind='ATTENDANCE_ADVISORY' and coalesce(p_command->>'care_status','') not in ('auto','needReview','sentComment','contactedParent','waitingParent','completed'))
       or (v_note_kind='ATTENDANCE_BOARD' and coalesce(p_command->>'care_status','') <> '') then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    if not exists (select 1 from public.center_cloud_entities e
      where e.center_id=v_center_id and e.entity_type='student'
        and e.local_id=v_student_local_id and e.deleted_at is null) then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'STUDENT_REFERENCE_DENIED');
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      v_center_id || ':c5.7-note:' || v_note_kind || ':' || v_student_local_id || ':' || v_month_key, 0));

    if v_expected_version = 0 then
      if exists (select 1 from public.center_operational_attendance_notes n
        where n.center_id=v_center_id and (n.id=v_note_id or (n.note_kind=v_note_kind and n.student_local_id=v_student_local_id and n.month_key=v_month_key))) then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
      end if;
      insert into public.center_operational_attendance_notes(
        center_id,id,note_kind,student_local_id,month_key,care_status,note,version,
        created_by_user_id,created_by_membership_id,created_by_role,
        updated_by_user_id,updated_by_membership_id,updated_by_role,created_at,updated_at
      ) values (
        v_center_id,v_note_id,v_note_kind,v_student_local_id,v_month_key,
        case when v_note_kind='ATTENDANCE_ADVISORY' then p_command->>'care_status' else '' end,
        coalesce(p_command->>'note',''),1,v_actor,v_membership_id,v_role,
        v_actor,v_membership_id,v_role,v_now,v_now
      ) returning * into v_note;
      v_before := null;
    else
      select * into v_note from public.center_operational_attendance_notes
      where center_id=v_center_id and id=v_note_id for update;
      if not found then return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_NOT_FOUND_OR_DENIED'); end if;
      if v_note.version <> v_expected_version then return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE'); end if;
      if v_note.note_kind<>v_note_kind or v_note.student_local_id<>v_student_local_id or v_note.month_key<>v_month_key then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;
      v_before := pg_catalog.to_jsonb(v_note);
      update public.center_operational_attendance_notes set
        care_status=case when v_note_kind='ATTENDANCE_ADVISORY' then p_command->>'care_status' else '' end,
        note=coalesce(p_command->>'note',''),version=version+1,
        updated_by_user_id=v_actor,updated_by_membership_id=v_membership_id,
        updated_by_role=v_role,updated_at=v_now
      where center_id=v_center_id and id=v_note_id returning * into v_note;
    end if;
    v_entity_type := case when v_note_kind='ATTENDANCE_ADVISORY' then 'ATTENDANCE_ADVISORY_NOTE' else 'ATTENDANCE_BOARD_NOTE' end;
    v_entity_id := v_note.id; v_entity_version := v_note.version; v_after := pg_catalog.to_jsonb(v_note);
  else
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_OPERATION');
  end if;

  if v_entity_type in ('ATTENDANCE_ADVISORY_NOTE','ATTENDANCE_BOARD_NOTE') then
    if v_before is not null then
      v_before := (v_before - 'note') || pg_catalog.jsonb_build_object(
        'note_length', pg_catalog.length(coalesce(v_before->>'note','')),
        'note_sha256', pg_catalog.encode(extensions.digest(
          pg_catalog.convert_to(coalesce(v_before->>'note',''), 'UTF8'), 'sha256'), 'hex'));
    end if;
    v_after := (v_after - 'note') || pg_catalog.jsonb_build_object(
      'note_length', pg_catalog.length(v_note.note),
      'note_sha256', pg_catalog.encode(extensions.digest(
        pg_catalog.convert_to(v_note.note, 'UTF8'), 'sha256'), 'hex'));
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED', 'center_id', v_center_id,
    'entity_type', v_entity_type, 'entity_id', v_entity_id,
    'entity_version', v_entity_version, 'committed_at', v_now,
    'actor_user_id', v_actor, 'actor_membership_id', v_membership_id, 'actor_role', v_role
  );
  insert into public.center_calendar_notes_audit_events(
    center_id,actor_user_id,actor_membership_id,actor_role,operation,entity_type,
    entity_id,entity_version,before_state,after_state,command_idempotency_key,created_at
  ) values (
    v_center_id,v_actor,v_membership_id,v_role,v_operation,v_entity_type,
    v_entity_id,v_entity_version,v_before,v_after,p_idempotency_key,v_now
  );
  insert into public.center_calendar_notes_command_results(
    center_id,actor_user_id,idempotency_key,intent_digest,result_snapshot,created_at
  ) values (v_center_id,v_actor,p_idempotency_key,v_digest,v_result,v_now);
  return v_result;
exception
  when unique_violation then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CONCURRENT_CONFLICT');
end
$function$;

revoke all on function public.c5_7_list_calendar_notes_shared_truth(text)
  from public, anon, authenticated;
revoke all on function public.c5_7_mutate_calendar_notes_shared_truth(text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.c5_7_list_calendar_notes_shared_truth(text) to authenticated;
grant execute on function public.c5_7_mutate_calendar_notes_shared_truth(text, jsonb, uuid) to authenticated;

commit;
