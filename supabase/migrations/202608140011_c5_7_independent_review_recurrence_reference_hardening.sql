begin;

-- Independent-review hardening. The accepted 202608140010 migration remains
-- byte-frozen; this additive migration closes recurrence and Student-reference
-- validation gaps found during the C5.7 adversarial review.

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
  v_start date;
  v_cursor date;
  v_day text;
  v_occurrence_count integer := 0;
begin
  if p_rule is null or p_rule = 'null'::jsonb then return true; end if;
  if p_start_at is null or pg_catalog.jsonb_typeof(p_rule) <> 'object'
     or exists (
       select 1 from pg_catalog.jsonb_object_keys(p_rule) keys(key)
       where key not in ('frequency','interval','daysOfWeek','endMode','untilDate','count','timezone')
     )
     or pg_catalog.jsonb_typeof(p_rule->'frequency') <> 'string'
     or pg_catalog.jsonb_typeof(p_rule->'interval') <> 'number'
     or pg_catalog.jsonb_typeof(p_rule->'daysOfWeek') <> 'array'
     or pg_catalog.jsonb_typeof(p_rule->'endMode') <> 'string'
     or pg_catalog.jsonb_typeof(p_rule->'timezone') <> 'string'
     or p_rule->>'frequency' <> 'weekly'
     or (p_rule->>'interval')::integer <> 1
     or p_rule->>'timezone' <> 'Asia/Ho_Chi_Minh' then
    return false;
  end if;

  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_rule->'daysOfWeek') entries(entry)
    where pg_catalog.jsonb_typeof(entry) <> 'string'
  ) then return false; end if;
  select pg_catalog.array_agg(value order by value) into v_days
  from (select distinct value from pg_catalog.jsonb_array_elements_text(p_rule->'daysOfWeek') entries(value)) d;
  if coalesce(pg_catalog.array_length(v_days, 1), 0) < 1
     or pg_catalog.array_length(v_days, 1) > 7
     or exists (select 1 from pg_catalog.unnest(v_days) weekdays(day) where day not in ('mon','tue','wed','thu','fri','sat','sun'))
     or pg_catalog.jsonb_array_length(p_rule->'daysOfWeek') <> pg_catalog.array_length(v_days, 1) then
    return false;
  end if;

  v_end_mode := p_rule->>'endMode';
  if v_end_mode = 'until' then
    if pg_catalog.jsonb_typeof(p_rule->'untilDate') <> 'string'
       or coalesce(p_rule->>'untilDate', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or coalesce(p_rule->'count', 'null'::jsonb) <> 'null'::jsonb then return false; end if;
    v_until := (p_rule->>'untilDate')::date;
    v_start := (p_start_at at time zone 'Asia/Ho_Chi_Minh')::date;
    if v_until < v_start or v_until > v_start + 370 then return false; end if;

    v_cursor := v_start;
    while v_cursor <= v_until loop
      v_day := (array['mon','tue','wed','thu','fri','sat','sun'])[pg_catalog.date_part('isodow', v_cursor)::integer];
      if v_day = any(v_days) then
        v_occurrence_count := v_occurrence_count + 1;
        if v_occurrence_count > 52 then return false; end if;
      end if;
      v_cursor := v_cursor + 1;
    end loop;
    return v_occurrence_count between 1 and 52;
  elsif v_end_mode = 'count' then
    if pg_catalog.jsonb_typeof(p_rule->'count') <> 'number'
       or coalesce(p_rule->'untilDate', 'null'::jsonb) <> 'null'::jsonb then return false; end if;
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

alter table public.center_calendar_items_authoritative
  add constraint center_calendar_items_c57_review_recurrence_check
  check (public.c5_7_valid_recurrence_rule(recurrence_rule, start_at)) not valid;
alter table public.center_calendar_items_authoritative
  validate constraint center_calendar_items_c57_review_recurrence_check;

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
  if exists (
    select 1
    from public.center_operational_attendance_notes n
    where n.center_id = v_center_id
      and not exists (
        select 1 from public.center_cloud_entities e
        where e.center_id = n.center_id and e.entity_type = 'student'
          and e.local_id = n.student_local_id and e.deleted_at is null
      )
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_SERVER_STATE');
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
        'student_local_id', n.student_local_id, 'student_reference_verified', true,
        'month_key', n.month_key, 'care_status', n.care_status, 'note', n.note, 'version', n.version,
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

revoke all on function public.c5_7_list_calendar_notes_shared_truth(text)
  from public, anon, authenticated;
grant execute on function public.c5_7_list_calendar_notes_shared_truth(text) to authenticated;

commit;
