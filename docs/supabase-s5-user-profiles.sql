-- S5 - User display profiles for iChess Center OS
-- Run manually in the Supabase SQL Editor. Do not run from the frontend.

alter table public.center_members
  add column if not exists display_name text,
  add column if not exists member_label text,
  add column if not exists email_snapshot text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.transaction_attachments
  add column if not exists uploaded_by_name text;

-- This security-definer helper avoids recursive RLS evaluation when a policy
-- checks whether the current user belongs to the requested center.
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

drop policy if exists "members can view own memberships" on public.center_members;
drop policy if exists "members can view center memberships" on public.center_members;

create policy "members can view center memberships"
on public.center_members
for select
to authenticated
using (public.is_center_member(center_id));

-- Remove any broad UPDATE grant left by earlier setup before granting only
-- the profile fields used by the frontend.
revoke update on table public.center_members from authenticated;
revoke update (center_id, user_id, role)
on public.center_members
from authenticated;

grant update (display_name, member_label, email_snapshot, updated_at)
on public.center_members
to authenticated;

drop policy if exists "members can update own display profile" on public.center_members;

create policy "members can update own display profile"
on public.center_members
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_center_member(center_id)
);

notify pgrst, 'reload schema';
