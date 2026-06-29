-- C6.1C DreamHome production preflight
-- READ ONLY PREFLIGHT ONLY
-- Do not modify data.
-- Target production center_id: dreamhome_prod
-- Staging/test sandbox center_id: dreamhome

with target as (
  select 'dreamhome_prod'::text as production_center_id, 'dreamhome'::text as staging_center_id
)
select
  'center_members.table_exists' as check_name,
  to_regclass('public.center_members') is not null as ok,
  coalesce(to_regclass('public.center_members')::text, 'missing') as details
from target;

select
  'center_members.column.' || required.column_name as check_name,
  c.column_name is not null as ok,
  coalesce(c.data_type || coalesce(' default=' || c.column_default, ''), 'missing') as details
from (
  values
    ('id'),
    ('user_id'),
    ('center_id'),
    ('role'),
    ('status'),
    ('created_at'),
    ('updated_at')
) as required(column_name)
left join information_schema.columns c
  on c.table_schema = 'public'
  and c.table_name = 'center_members'
  and c.column_name = required.column_name
order by required.column_name;

select
  'center_members.constraint_or_index' as check_name,
  true as ok,
  coalesce(string_agg(item.details, ' | ' order by item.details), 'none found') as details
from (
  select 'constraint ' || con.conname || ': ' || pg_get_constraintdef(con.oid) as details
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'center_members'
  union all
  select 'index ' || idx.indexname || ': ' || idx.indexdef as details
  from pg_indexes idx
  where idx.schemaname = 'public'
    and idx.tablename = 'center_members'
) item;

with target as (
  select 'dreamhome_prod'::text as production_center_id
)
select
  'center_members.current_rows_dreamhome_prod' as check_name,
  true as ok,
  count(*)::text || ' rows for dreamhome_prod' as details
from public.center_members cm
join target on cm.center_id = target.production_center_id;

select
  'center_members.placeholder_user_id_note' as check_name,
  true as ok,
  '<BICH_AUTH_USER_ID> is a placeholder and cannot be verified until user creates/copies the real auth.users.id.' as details;

with target as (
  select 'dreamhome_prod'::text as production_center_id
)
select
  'center_cloud_entities.dreamhome_prod_count' as check_name,
  count(cce.*) = 0 as ok,
  count(cce.*)::text || ' records for dreamhome_prod' as details
from target
left join public.center_cloud_entities cce
  on cce.center_id = target.production_center_id;

with target as (
  select 'dreamhome_prod'::text as production_center_id
)
select
  'center_cloud_entities.dreamhome_prod_angel_wings_count' as check_name,
  count(cce.*) = 0 as ok,
  count(cce.*)::text || ' Angel Wings/staging-like records for dreamhome_prod' as details
from target
left join public.center_cloud_entities cce
  on cce.center_id = target.production_center_id
  and (
    cce.payload::text ilike '%Angel Wings%'
    or cce.local_id ilike '%angel%'
    or cce.payload::text ilike '%staging%'
    or cce.local_id ilike '%staging%'
  );

with target as (
  select 'dreamhome'::text as staging_center_id
)
select
  'center_cloud_entities.dreamhome_staging_count_note' as check_name,
  true as ok,
  count(cce.*)::text || ' records for dreamhome staging/test sandbox' as details
from target
left join public.center_cloud_entities cce
  on cce.center_id = target.staging_center_id;

with target as (
  select 'dreamhome'::text as staging_center_id
)
select
  'center_cloud_entities.dreamhome_staging_angel_wings_note' as check_name,
  true as ok,
  count(cce.*)::text || ' Angel Wings/staging-like records kept in dreamhome sandbox' as details
from target
left join public.center_cloud_entities cce
  on cce.center_id = target.staging_center_id
  and (
    cce.payload::text ilike '%Angel Wings%'
    or cce.local_id ilike '%angel%'
    or cce.payload::text ilike '%staging%'
    or cce.local_id ilike '%staging%'
  );

with required_helpers(function_name) as (
  values
    ('can_write_center'),
    ('is_center_member')
)
select
  'helper_function.' || required_helpers.function_name as check_name,
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
  'auth_users.manual_note' as check_name,
  true as ok,
  'Create Bich Auth user manually, then copy auth.users.id into <BICH_AUTH_USER_ID>. This preflight does not query auth.users.' as details;
