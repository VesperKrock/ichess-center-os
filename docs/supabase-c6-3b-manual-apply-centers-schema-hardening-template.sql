-- MANUAL APPLY TEMPLATE ONLY
-- DO NOT RUN IN C6.3B.
-- Review and run only in a later confirmed apply phase such as C6.3C.
-- Purpose: harden public.centers metadata for multi-center foundation.
-- This does not delete data.
-- This does not rename dreamhome.
-- This does not touch Angel Wings.
-- This does not create govap_prod.
-- This does not create quan12_prod.

begin;

alter table public.centers
  add column if not exists slug text,
  add column if not exists environment text,
  add column if not exists status text,
  add column if not exists updated_at timestamptz;

update public.centers
set
  name = coalesce(nullif(name, ''), 'DreamHome'),
  slug = 'dreamhome',
  environment = 'staging',
  status = coalesce(status, 'active'),
  updated_at = coalesce(updated_at, now())
where id = 'dreamhome';

update public.centers
set
  name = coalesce(nullif(name, ''), 'DreamHome'),
  slug = 'dreamhome',
  environment = 'production',
  status = coalesce(status, 'active'),
  updated_at = coalesce(updated_at, now())
where id = 'dreamhome_prod';

alter table public.centers
  alter column environment set default 'production',
  alter column status set default 'active',
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'centers_environment_check'
      and conrelid = 'public.centers'::regclass
  ) then
    alter table public.centers
      add constraint centers_environment_check
      check (environment in ('production', 'staging', 'test', 'development'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'centers_status_check'
      and conrelid = 'public.centers'::regclass
  ) then
    alter table public.centers
      add constraint centers_status_check
      check (status in ('active', 'paused', 'archived'));
  end if;
end $$;

create unique index if not exists centers_slug_environment_unique_idx
on public.centers (slug, environment)
where slug is not null and environment is not null;

create index if not exists centers_environment_idx
on public.centers (environment);

create index if not exists centers_status_idx
on public.centers (status);

select
  id,
  name,
  slug,
  environment,
  status,
  created_at,
  updated_at
from public.centers
where id in ('dreamhome', 'dreamhome_prod')
order by id;

commit;
