-- C1 Cloud DB foundation for iChess Center OS.
-- Run manually in Supabase SQL Editor. The app never runs this SQL automatically.

create extension if not exists pgcrypto;

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
  updated_at timestamptz not null default now(),
  constraint center_cloud_entities_entity_type_check
    check (entity_type in ('student', 'teacher', 'class_session')),
  constraint center_cloud_entities_unique_entity
    unique (center_id, entity_type, local_id)
);

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

alter table public.center_cloud_entities enable row level security;

drop policy if exists "center members can select cloud entities" on public.center_cloud_entities;
drop policy if exists "center members can insert cloud entities" on public.center_cloud_entities;
drop policy if exists "center members can update cloud entities" on public.center_cloud_entities;
drop policy if exists "center members can delete cloud entities" on public.center_cloud_entities;

create policy "center members can select cloud entities"
on public.center_cloud_entities
for select
to authenticated
using (
  exists (
    select 1
    from public.center_members cm
    where cm.center_id = center_cloud_entities.center_id
      and cm.user_id = auth.uid()
  )
);

create policy "center members can insert cloud entities"
on public.center_cloud_entities
for insert
to authenticated
with check (
  exists (
    select 1
    from public.center_members cm
    where cm.center_id = center_cloud_entities.center_id
      and cm.user_id = auth.uid()
  )
);

create policy "center members can update cloud entities"
on public.center_cloud_entities
for update
to authenticated
using (
  exists (
    select 1
    from public.center_members cm
    where cm.center_id = center_cloud_entities.center_id
      and cm.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.center_members cm
    where cm.center_id = center_cloud_entities.center_id
      and cm.user_id = auth.uid()
  )
);

create policy "center members can delete cloud entities"
on public.center_cloud_entities
for delete
to authenticated
using (
  exists (
    select 1
    from public.center_members cm
    where cm.center_id = center_cloud_entities.center_id
      and cm.user_id = auth.uid()
  )
);
