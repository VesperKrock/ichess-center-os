-- C2.2 Cloud DB permissions/readiness fix for iChess Center OS.
-- Run manually in Supabase SQL Editor. The frontend never runs this SQL.
-- Safe/idempotent: authenticated-only grants, no public access.

create extension if not exists pgcrypto;

grant usage on schema public to authenticated;

create table if not exists public.center_cloud_entities (
  id uuid primary key default gen_random_uuid(),
  center_id text not null,
  entity_type text not null,
  local_id text not null,
  payload jsonb not null default '{}'::jsonb,
  source_module text,
  source_version text,
  deleted_at timestamptz,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.center_cloud_entities
  add column if not exists source_module text,
  add column if not exists source_version text,
  add column if not exists deleted_at timestamptz,
  add column if not exists created_by uuid references auth.users(id),
  add column if not exists updated_by uuid references auth.users(id),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'center_cloud_entities_entity_type_check'
      and conrelid = 'public.center_cloud_entities'::regclass
  ) then
    alter table public.center_cloud_entities
      add constraint center_cloud_entities_entity_type_check
      check (entity_type in ('student', 'teacher', 'class_session'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'center_cloud_entities_unique_entity'
      and conrelid = 'public.center_cloud_entities'::regclass
  ) then
    alter table public.center_cloud_entities
      add constraint center_cloud_entities_unique_entity
      unique (center_id, entity_type, local_id);
  end if;
end
$$;

create index if not exists center_cloud_entities_center_type_idx
on public.center_cloud_entities (center_id, entity_type);

create index if not exists center_cloud_entities_updated_at_idx
on public.center_cloud_entities (updated_at desc);

create or replace function public.set_center_cloud_entities_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_center_cloud_entities_updated_at on public.center_cloud_entities;

create trigger set_center_cloud_entities_updated_at
before update on public.center_cloud_entities
for each row
execute function public.set_center_cloud_entities_updated_at();

-- Reuse/create a security-definer helper so Cloud DB policies do not depend
-- on recursive RLS evaluation of center_members.
create or replace function public.is_center_member(requested_center_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.center_members
    where center_id = requested_center_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_center_member(text) from public;
grant execute on function public.is_center_member(text) to authenticated;

grant select on public.center_members to authenticated;
grant select, insert, update, delete on public.center_cloud_entities to authenticated;

alter table public.center_cloud_entities enable row level security;

drop policy if exists "center members can select cloud entities" on public.center_cloud_entities;
drop policy if exists "center members can insert cloud entities" on public.center_cloud_entities;
drop policy if exists "center members can update cloud entities" on public.center_cloud_entities;
drop policy if exists "center members can delete cloud entities" on public.center_cloud_entities;

create policy "center members can select cloud entities"
on public.center_cloud_entities
for select
to authenticated
using (public.is_center_member(center_id));

create policy "center members can insert cloud entities"
on public.center_cloud_entities
for insert
to authenticated
with check (public.is_center_member(center_id));

create policy "center members can update cloud entities"
on public.center_cloud_entities
for update
to authenticated
using (public.is_center_member(center_id))
with check (public.is_center_member(center_id));

create policy "center members can delete cloud entities"
on public.center_cloud_entities
for delete
to authenticated
using (public.is_center_member(center_id));

notify pgrst, 'reload schema';
