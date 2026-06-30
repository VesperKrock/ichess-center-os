-- C6.3B READ ONLY INSPECTION ONLY
-- Purpose: inspect centers metadata readiness for multi-center foundation.
-- Run manually only for review. This file only uses SELECT statements.

select
  'centers_table_exists' as check_name,
  exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'centers'
  ) as ok,
  'public.centers presence' as details;

select
  'centers_columns' as check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'centers'
order by ordinal_position;

select
  'centers_constraints' as check_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid) as constraint_definition
from pg_constraint con
join pg_class cls on cls.oid = con.conrelid
join pg_namespace nsp on nsp.oid = cls.relnamespace
where nsp.nspname = 'public'
  and cls.relname = 'centers'
order by con.conname;

select
  'centers_indexes' as check_name,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'centers'
order by indexname;

select
  'centers_current_rows' as check_name,
  c.*
from public.centers c
order by c.id;

select
  'center_members_columns' as check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'center_members'
order by ordinal_position;

select
  'membership_count_by_center_role_status' as check_name,
  center_id,
  role,
  status,
  count(*) as row_count
from public.center_members
group by center_id, role, status
order by center_id, role, status;

select
  'center_cloud_entities_count_by_center_entity' as check_name,
  center_id,
  entity_type,
  count(*) as row_count
from public.center_cloud_entities
group by center_id, entity_type
order by center_id, entity_type;

select
  'dreamhome_metadata_readiness' as check_name,
  c.id,
  c.name,
  to_jsonb(c)->>'slug' as slug,
  to_jsonb(c)->>'environment' as environment,
  to_jsonb(c)->>'status' as status
from public.centers c
where c.id in ('dreamhome', 'dreamhome_prod')
order by c.id;
