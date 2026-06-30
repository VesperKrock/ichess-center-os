-- C6.3C READ ONLY VERIFY ONLY
-- Purpose: verify centers schema hardening after user manual apply.
-- Do not modify data. This file only uses SELECT statements.

select
  'required_centers_columns' as check_name,
  count(*) filter (where column_name = 'slug') > 0 as has_slug,
  count(*) filter (where column_name = 'environment') > 0 as has_environment,
  count(*) filter (where column_name = 'status') > 0 as has_status,
  count(*) filter (where column_name = 'updated_at') > 0 as has_updated_at
from information_schema.columns
where table_schema = 'public'
  and table_name = 'centers'
  and column_name in ('slug', 'environment', 'status', 'updated_at');

select
  'dreamhome_metadata' as check_name,
  id,
  name,
  slug,
  environment,
  status,
  (slug = 'dreamhome' and environment = 'staging' and status = 'active') as ok
from public.centers
where id = 'dreamhome';

select
  'dreamhome_prod_metadata' as check_name,
  id,
  name,
  slug,
  environment,
  status,
  (slug = 'dreamhome' and environment = 'production' and status = 'active') as ok
from public.centers
where id = 'dreamhome_prod';

select
  'centers_constraints' as check_name,
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as constraint_definition
from pg_constraint con
join pg_class cls on cls.oid = con.conrelid
join pg_namespace nsp on nsp.oid = cls.relnamespace
where nsp.nspname = 'public'
  and cls.relname = 'centers'
  and con.conname in (
    'centers_environment_check',
    'centers_status_check'
  )
order by con.conname;

select
  'centers_indexes' as check_name,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'centers'
  and indexname in (
    'centers_environment_idx',
    'centers_slug_environment_unique_idx',
    'centers_status_idx'
  )
order by indexname;

select
  'future_centers_not_created' as check_name,
  count(*) filter (where id = 'govap_prod') = 0 as govap_not_created,
  count(*) filter (where id = 'quan12_prod') = 0 as quan12_not_created
from public.centers
where id in ('govap_prod', 'quan12_prod');
