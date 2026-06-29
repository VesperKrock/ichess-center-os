-- C6.1B DreamHome production empty center verification pack
-- READ ONLY VERIFY ONLY
-- Do not modify data.
-- Run manually in Supabase SQL Editor, then copy the result back to chat.

with target_center as (
  select 'dreamhome'::text as center_id
)
select
  'A.core_table.center_cloud_entities_exists' as check_name,
  to_regclass('public.center_cloud_entities') is not null as ok,
  coalesce(to_regclass('public.center_cloud_entities')::text, 'missing') as details;

select
  'A.core_column.' || required.column_name as check_name,
  c.column_name is not null as ok,
  coalesce(c.data_type, 'missing') as details
from (
  values
    ('center_id'),
    ('entity_type'),
    ('local_id'),
    ('payload'),
    ('created_at'),
    ('updated_at'),
    ('deleted_at')
) as required(column_name)
left join information_schema.columns c
  on c.table_schema = 'public'
  and c.table_name = 'center_cloud_entities'
  and c.column_name = required.column_name
order by required.column_name;

select
  'A.core_column.centerId_payload_runtime_note' as check_name,
  true as ok,
  'Runtime/payload centerId must map to the same production center_id before any write path is enabled.' as details;

with required_entities(entity_type) as (
  values
    ('student'),
    ('teacher'),
    ('class_session'),
    ('schedule_session'),
    ('attendance_record'),
    ('attendance_baseline_state'),
    ('session_report'),
    ('tuition_record_package'),
    ('audit_log_entry')
),
constraint_defs as (
  select
    con.conname,
    pg_get_constraintdef(con.oid) as constraint_def
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'center_cloud_entities'
)
select
  'B.entity_allowlist.' || required_entities.entity_type as check_name,
  exists (
    select 1
    from constraint_defs
    where constraint_def ilike '%' || required_entities.entity_type || '%'
  ) as ok,
  coalesce(
    (
      select string_agg(conname || ': ' || constraint_def, ' | ')
      from constraint_defs
      where constraint_def ilike '%' || required_entities.entity_type || '%'
    ),
    'not found in metadata constraint definitions; check app-side allowlist/docs if schema uses another mechanism'
  ) as details
from required_entities
order by required_entities.entity_type;

select
  'C.realtime.publication.center_cloud_entities' as check_name,
  exists (
    select 1
    from pg_publication_tables
    where schemaname = 'public'
      and tablename = 'center_cloud_entities'
  ) as ok,
  coalesce(
    (
      select string_agg(pubname, ', ')
      from pg_publication_tables
      where schemaname = 'public'
        and tablename = 'center_cloud_entities'
    ),
    'not found in publication'
  ) as details;

select
  'C.realtime.replica_identity_full' as check_name,
  rel.relreplident = 'f' as ok,
  'replica identity = ' || case rel.relreplident
    when 'f' then 'full'
    when 'd' then 'default'
    when 'n' then 'nothing'
    when 'i' then 'index'
    else coalesce(rel.relreplident::text, 'missing')
  end as details
from pg_class rel
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'center_cloud_entities';

with required_helpers(function_name) as (
  values
    ('can_write_center'),
    ('is_center_member')
)
select
  'D.helper_function.' || required_helpers.function_name as check_name,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = required_helpers.function_name
  ) as ok,
  coalesce(
    (
      select string_agg(p.oid::regprocedure::text, ', ')
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = required_helpers.function_name
    ),
    'missing'
  ) as details
from required_helpers
order by required_helpers.function_name;

select
  'E.membership_role.table_candidate.' || candidate.table_name as check_name,
  exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = candidate.table_name
  ) as ok,
  coalesce(t.table_type, 'missing') as details
from (
  values
    ('center_members'),
    ('memberships'),
    ('center_memberships'),
    ('profiles'),
    ('user_profiles')
) as candidate(table_name)
left join information_schema.tables t
  on t.table_schema = 'public'
  and t.table_name = candidate.table_name
order by candidate.table_name;

select
  'E.membership_role.routine_candidate' as check_name,
  count(*) > 0 as ok,
  coalesce(string_agg(n.nspname || '.' || p.proname, ', ' order by p.proname), 'none') as details
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    p.proname ilike '%member%'
    or p.proname ilike '%role%'
    or p.proname ilike '%center%'
  );

-- count by center_id
select
  'F.center_counts.by_center_id' as check_name,
  true as ok,
  center_id || ' = ' || count(*)::text as details
from public.center_cloud_entities
group by center_id
order by center_id;

-- count by center_id + entity_type
select
  'F.center_counts.by_center_id_entity_type' as check_name,
  true as ok,
  center_id || ' / ' || entity_type || ' = ' || count(*)::text as details
from public.center_cloud_entities
group by center_id, entity_type
order by center_id, entity_type;

with target_center as (
  select 'dreamhome'::text as center_id
)
select
  'F.center_counts.target_dreamhome_total' as check_name,
  true as ok,
  target_center.center_id || ' = ' || count(cce.*)::text as details
from target_center
left join public.center_cloud_entities cce
  on cce.center_id = target_center.center_id
group by target_center.center_id;

select
  'F.center_counts.center_id_looks_like_dreamhome' as check_name,
  true as ok,
  coalesce(center_id, '<null>') || ' = ' || count(*)::text as details
from public.center_cloud_entities
where center_id ilike '%dreamhome%'
group by center_id
order by center_id;

with target_center as (
  select 'dreamhome'::text as center_id
)
select
  'G.staging_detection.target_angel_wings_payload_or_local_id' as check_name,
  count(*) = 0 as ok,
  count(*)::text || ' matching records in target center' as details
from public.center_cloud_entities cce
join target_center on target_center.center_id = cce.center_id
where cce.payload::text ilike '%Angel Wings%'
  or cce.local_id ilike '%angel%';

with target_center as (
  select 'dreamhome'::text as center_id
)
select
  'G.staging_detection.target_staging_payload_or_local_id' as check_name,
  count(*) = 0 as ok,
  count(*)::text || ' matching records in target center' as details
from public.center_cloud_entities cce
join target_center on target_center.center_id = cce.center_id
where cce.payload::text ilike '%staging%'
  or cce.local_id ilike '%staging%';

select
  'G.staging_detection.all_centers_angel_wings_payload_or_local_id' as check_name,
  true as ok,
  coalesce(center_id, '<null>') || ' = ' || count(*)::text as details
from public.center_cloud_entities
where payload::text ilike '%Angel Wings%'
  or local_id ilike '%angel%'
group by center_id
order by center_id;

select
  'H.auth_users.manual_note' as check_name,
  true as ok,
  'Auth users need manual dashboard check or a separate read-only query if policy allows. Supabase Auth user <> app permission; membership/role is required.' as details;
