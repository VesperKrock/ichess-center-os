-- C3.2.1 Membership / Realtime readiness patch plan for iChess Center OS.
-- STATUS: PLAN ONLY. DO NOT APPLY UNTIL REVIEWED IN SUPABASE DASHBOARD.
-- This file was not run by Codex.
-- Goals:
-- - Verify/create membership foundation for C3.2 student realtime.
-- - Verify center-scoped RLS for center_cloud_entities.
-- - Enable Supabase Realtime publication for center_cloud_entities if missing.
-- Safety:
-- - No data reset.
-- - No production center creation.
-- - No personal email hardcoding.
-- - No destructive table operations.

-- TODO(confirm-live): Check whether public.center_members already exists and whether
-- existing column names/types match this plan before applying.
create table if not exists public.center_members (
  id uuid primary key default gen_random_uuid(),
  center_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint center_members_unique_user_center unique (center_id, user_id),
  constraint center_members_role_check
    check (role in ('owner', 'qtv', 'center_admin', 'teacher', 'consultant', 'viewer')),
  constraint center_members_status_check
    check (status in ('active', 'inactive', 'suspended'))
);

alter table public.center_members
  add column if not exists status text not null default 'active',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists center_members_user_idx
on public.center_members (user_id);

create index if not exists center_members_center_role_idx
on public.center_members (center_id, role);

create index if not exists center_members_center_user_status_idx
on public.center_members (center_id, user_id, status);

create or replace function public.set_center_members_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- TODO(confirm-live): Create trigger only if it does not already exist.
do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_center_members_updated_at'
      and tgrelid = 'public.center_members'::regclass
  ) then
    create trigger set_center_members_updated_at
    before update on public.center_members
    for each row
    execute function public.set_center_members_updated_at();
  end if;
end
$$;

alter table public.center_members enable row level security;

grant usage on schema public to authenticated;
grant select on public.center_members to authenticated;
grant select, insert, update, delete on public.center_cloud_entities to authenticated;

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
      and status = 'active'
  );
$$;

create or replace function public.can_write_center(requested_center_id text)
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
      and status = 'active'
      and role in ('owner', 'qtv', 'center_admin')
  );
$$;

revoke all on function public.is_center_member(text) from public;
revoke all on function public.can_write_center(text) from public;
grant execute on function public.is_center_member(text) to authenticated;
grant execute on function public.can_write_center(text) to authenticated;

-- TODO(confirm-live): If these policies already exist with different names,
-- review and align manually in Supabase before applying.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'center_members'
      and policyname = 'members can read own center memberships'
  ) then
    create policy "members can read own center memberships"
    on public.center_members
    for select
    to authenticated
    using (user_id = auth.uid());
  end if;
end
$$;

alter table public.center_cloud_entities enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'center_cloud_entities'
      and policyname = 'active center members can read cloud entities'
  ) then
    create policy "active center members can read cloud entities"
    on public.center_cloud_entities
    for select
    to authenticated
    using (public.is_center_member(center_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'center_cloud_entities'
      and policyname = 'center admins can insert cloud entities'
  ) then
    create policy "center admins can insert cloud entities"
    on public.center_cloud_entities
    for insert
    to authenticated
    with check (public.can_write_center(center_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'center_cloud_entities'
      and policyname = 'center admins can update cloud entities'
  ) then
    create policy "center admins can update cloud entities"
    on public.center_cloud_entities
    for update
    to authenticated
    using (public.can_write_center(center_id))
    with check (public.can_write_center(center_id));
  end if;
end
$$;

-- Entity allowlist check. C1/C2.2 already include student.
-- TODO(confirm-live): Verify center_cloud_entities_entity_type_check contains 'student'
-- before applying any allowlist change. C3.2.1 does not add new entity types.

-- Realtime readiness.
-- TODO(confirm-live): Enable Realtime for this table in Supabase Dashboard or apply
-- an equivalent reviewed publication change.
alter table public.center_cloud_entities replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'center_cloud_entities'
  ) then
    alter publication supabase_realtime add table public.center_cloud_entities;
  end if;
end
$$;

notify pgrst, 'reload schema';
