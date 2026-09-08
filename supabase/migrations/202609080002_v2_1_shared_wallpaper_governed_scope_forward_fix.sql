begin;

-- V2-1A2: align installation-wide wallpaper authority with the existing
-- ARG-governed production scope. Active staging/test centers without active
-- ARG governance must not expand the canonical Owner quorum.

do $v2_1a2_prerequisites$
begin
  if pg_catalog.to_regclass('public.center_access_governance') is null
     or pg_catalog.to_regclass('public.center_members') is null
     or pg_catalog.to_regclass('public.centers') is null
     or pg_catalog.to_regprocedure('public.v2_1_can_manage_shared_wallpaper(uuid)') is null then
    raise exception 'v2_1a2_missing_prerequisite';
  end if;
end;
$v2_1a2_prerequisites$;

create or replace function public.v2_1_can_manage_shared_wallpaper(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $v2_1_can_manage_shared_wallpaper$
  select p_user_id is not null
    and p_user_id = auth.uid()
    and exists (
      select 1
      from public.center_access_governance governed
      join public.centers governed_center
        on governed_center.id = governed.center_id
       and governed_center.status = 'active'
      where governed.status = 'active'
    )
    and not exists (
      select 1
      from public.center_access_governance governed
      join public.centers governed_center
        on governed_center.id = governed.center_id
       and governed_center.status = 'active'
      where governed.status = 'active'
        and not exists (
          select 1
          from public.center_members canonical_owner
          where canonical_owner.id = governed.canonical_owner_membership_id
            and canonical_owner.center_id = governed.center_id
            and canonical_owner.user_id = p_user_id
            and canonical_owner.role = 'owner'
            and canonical_owner.status = 'active'
        )
    )
$v2_1_can_manage_shared_wallpaper$;

revoke all on function public.v2_1_can_manage_shared_wallpaper(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.v2_1_can_manage_shared_wallpaper(uuid)
  to authenticated, service_role;

comment on function public.v2_1_can_manage_shared_wallpaper(uuid) is
  'True only for the authenticated canonical active Owner of every active ARG-governed center; ungoverned active staging centers do not expand the scope.';

commit;
