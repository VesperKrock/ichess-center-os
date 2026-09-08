-- V2-1 Center Settings foundation.
-- Additive only: exact-center operational profile and tuition package catalog,
-- plus one installation-wide, Owner-controlled shared wallpaper pointer.

do $$
begin
  if pg_catalog.to_regclass('public.centers') is null
     or pg_catalog.to_regclass('public.center_members') is null
     or pg_catalog.to_regclass('storage.objects') is null
     or pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'v2_1_missing_prerequisite';
  end if;
end
$$;

create table public.center_operational_profiles (
  center_id text primary key references public.centers(id) on delete restrict,
  display_name text not null check (char_length(display_name) between 1 and 120),
  address text not null default '' check (char_length(address) <= 300),
  phone text not null default '' check (char_length(phone) <= 40),
  note text not null default '' check (char_length(note) <= 500),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_membership_id uuid references public.center_members(id) on delete restrict,
  updated_by_membership_id uuid references public.center_members(id) on delete restrict
);

create table public.center_tuition_package_catalog (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete restrict,
  package_name text not null check (char_length(package_name) between 1 and 120),
  total_sessions integer not null check (total_sessions between 1 and 1000),
  default_amount bigint not null default 0 check (default_amount between 0 and 9000000000000000),
  is_active boolean not null default true,
  note text not null default '' check (char_length(note) <= 500),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by_membership_id uuid not null references public.center_members(id) on delete restrict,
  updated_by_membership_id uuid not null references public.center_members(id) on delete restrict
);

create unique index center_tuition_package_catalog_center_name_unique
  on public.center_tuition_package_catalog (
    center_id,
    lower(regexp_replace(btrim(package_name), '\s+', ' ', 'g'))
  );
create index center_tuition_package_catalog_center_active_idx
  on public.center_tuition_package_catalog(center_id, is_active, package_name);

create table public.installation_shared_presentation (
  singleton boolean primary key default true check (singleton),
  storage_bucket text,
  storage_path text,
  mime_type text,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid not null references auth.users(id) on delete restrict,
  check (
    (storage_bucket is null and storage_path is null and mime_type is null)
    or (
      storage_bucket = 'ichess-os-wallpapers'
      and storage_path ~ '^shared/[0-9a-fA-F-]{36}\.webp$'
      and mime_type = 'image/webp'
    )
  )
);

create table public.center_settings_command_results (
  center_id text not null references public.centers(id) on delete restrict,
  idempotency_key uuid not null,
  command_hash bytea not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key(center_id, idempotency_key)
);

create table public.center_settings_audit_events (
  id bigint generated always as identity primary key,
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_membership_id uuid not null references public.center_members(id) on delete restrict,
  idempotency_key uuid not null,
  operation text not null,
  entity_type text not null,
  entity_id text not null,
  entity_version integer not null check (entity_version >= 1),
  created_at timestamptz not null default now()
);

create unique index center_settings_audit_events_command_unique
  on public.center_settings_audit_events(center_id, idempotency_key);

alter table public.center_operational_profiles enable row level security;
alter table public.center_operational_profiles force row level security;
alter table public.center_tuition_package_catalog enable row level security;
alter table public.center_tuition_package_catalog force row level security;
alter table public.installation_shared_presentation enable row level security;
alter table public.installation_shared_presentation force row level security;
alter table public.center_settings_command_results enable row level security;
alter table public.center_settings_command_results force row level security;
alter table public.center_settings_audit_events enable row level security;
alter table public.center_settings_audit_events force row level security;

revoke all on table public.center_operational_profiles from public, anon, authenticated, service_role;
revoke all on table public.center_tuition_package_catalog from public, anon, authenticated, service_role;
revoke all on table public.installation_shared_presentation from public, anon, authenticated, service_role;
revoke all on table public.center_settings_command_results from public, anon, authenticated, service_role;
revoke all on table public.center_settings_audit_events from public, anon, authenticated, service_role;
grant all on table public.center_operational_profiles to service_role;
grant all on table public.center_tuition_package_catalog to service_role;
grant all on table public.installation_shared_presentation to service_role;
grant all on table public.center_settings_command_results to service_role;
grant all on table public.center_settings_audit_events to service_role;
grant usage, select on sequence public.center_settings_audit_events_id_seq to service_role;

create function public.v2_1_internal_normalize_role(p_role text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(btrim(coalesce(p_role, '')))
    when 'admin' then 'center_admin'
    when 'qtv' then 'center_admin'
    else lower(btrim(coalesce(p_role, '')))
  end
$$;

create function public.v2_1_internal_active_membership(
  p_center_id text,
  p_user_id uuid
)
returns public.center_members
language sql
stable
security definer
set search_path = ''
as $$
  select m.*
  from public.center_members m
  join public.centers c on c.id = m.center_id
  where m.center_id = p_center_id
    and m.user_id = p_user_id
    and m.status = 'active'
    and c.status = 'active'
    and public.v2_1_internal_normalize_role(m.role) in ('owner', 'center_admin')
  limit 1
$$;

create function public.v2_1_can_manage_shared_wallpaper(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id is not null
    and p_user_id = auth.uid()
    and exists (
      select 1
      from public.center_members own
      join public.centers c on c.id = own.center_id
      where own.user_id = p_user_id
        and own.status = 'active'
        and c.status = 'active'
        and public.v2_1_internal_normalize_role(own.role) = 'owner'
    )
    and not exists (
      select 1
      from public.centers active_center
      where active_center.status = 'active'
        and not exists (
          select 1
          from public.center_members owner_membership
          where owner_membership.center_id = active_center.id
            and owner_membership.user_id = p_user_id
            and owner_membership.status = 'active'
            and public.v2_1_internal_normalize_role(owner_membership.role) = 'owner'
        )
    )
$$;

create function public.v2_1_list_center_settings(p_center_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership public.center_members;
  v_center public.centers;
  v_profile public.center_operational_profiles;
  v_wallpaper public.installation_shared_presentation;
begin
  if v_user_id is null then
    raise exception 'v2_1_not_authenticated';
  end if;
  select * into v_membership
  from public.v2_1_internal_active_membership(p_center_id, v_user_id);
  if v_membership.id is null then
    raise exception 'v2_1_center_access_denied';
  end if;
  select * into strict v_center from public.centers where id = p_center_id;
  select * into v_profile from public.center_operational_profiles where center_id = p_center_id;
  select * into v_wallpaper from public.installation_shared_presentation where singleton;

  return jsonb_build_object(
    'ok', true,
    'outcome_code', 'AUTHORITATIVE_SNAPSHOT',
    'center_id', p_center_id,
    'center', jsonb_build_object(
      'center_id', p_center_id,
      'center_code', v_center.id,
      'display_name', coalesce(v_profile.display_name, v_center.name),
      'address', coalesce(v_profile.address, ''),
      'phone', coalesce(v_profile.phone, ''),
      'note', coalesce(v_profile.note, ''),
      'environment', coalesce(v_center.environment, ''),
      'status', coalesce(v_center.status, ''),
      'version', coalesce(v_profile.version, 0)
    ),
    'tuition_packages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'center_id', p.center_id,
        'package_name', p.package_name,
        'total_sessions', p.total_sessions,
        'default_amount', p.default_amount,
        'is_active', p.is_active,
        'note', p.note,
        'version', p.version,
        'updated_at', p.updated_at
      ) order by p.is_active desc, lower(p.package_name), p.id)
      from public.center_tuition_package_catalog p
      where p.center_id = p_center_id
    ), '[]'::jsonb),
    'shared_wallpaper', case when v_wallpaper.storage_path is null then null else jsonb_build_object(
      'storage_bucket', v_wallpaper.storage_bucket,
      'storage_path', v_wallpaper.storage_path,
      'mime_type', v_wallpaper.mime_type,
      'version', v_wallpaper.version,
      'updated_at', v_wallpaper.updated_at
    ) end,
    'shared_wallpaper_version', coalesce(v_wallpaper.version, 0),
    'can_manage_shared_wallpaper', public.v2_1_can_manage_shared_wallpaper(v_user_id)
  );
end
$$;

create function public.v2_1_mutate_center_settings(
  p_center_id text,
  p_command jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_membership public.center_members;
  v_existing public.center_settings_command_results;
  v_hash bytea;
  v_operation text := upper(btrim(coalesce(p_command->>'operation', '')));
  v_response jsonb;
  v_entity_type text;
  v_entity_id text;
  v_entity_version integer;
  v_expected_version integer;
  v_profile public.center_operational_profiles;
  v_package public.center_tuition_package_catalog;
  v_wallpaper public.installation_shared_presentation;
  v_package_id uuid;
  v_name text;
  v_address text;
  v_phone text;
  v_note text;
  v_total_sessions integer;
  v_default_amount bigint;
  v_is_active boolean;
  v_storage_path text;
begin
  if v_user_id is null then raise exception 'v2_1_not_authenticated'; end if;
  if p_idempotency_key is null or p_command is null or jsonb_typeof(p_command) <> 'object' then
    raise exception 'v2_1_invalid_command';
  end if;
  select * into v_membership
  from public.v2_1_internal_active_membership(p_center_id, v_user_id);
  if v_membership.id is null then raise exception 'v2_1_center_access_denied'; end if;

  -- Serialize one logical command before reading its durable result. This makes
  -- simultaneous exact retries converge instead of racing into a stale write.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_center_id || ':' || p_idempotency_key::text, 0)
  );
  v_hash := extensions.digest(convert_to(p_command::text, 'UTF8'), 'sha256');
  select * into v_existing
  from public.center_settings_command_results
  where center_id = p_center_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.command_hash <> v_hash then raise exception 'v2_1_idempotency_conflict'; end if;
    return v_existing.response;
  end if;

  v_expected_version := coalesce((p_command->>'expected_version')::integer, -1);

  if v_operation = 'UPDATE_CENTER_PROFILE' then
    v_name := regexp_replace(btrim(coalesce(p_command->>'display_name', '')), '\s+', ' ', 'g');
    v_address := btrim(coalesce(p_command->>'address', ''));
    v_phone := btrim(coalesce(p_command->>'phone', ''));
    v_note := btrim(coalesce(p_command->>'note', ''));
    if char_length(v_name) not between 1 and 120 or char_length(v_address) > 300
       or char_length(v_phone) > 40 or char_length(v_note) > 500 then
      raise exception 'v2_1_invalid_center_profile';
    end if;
    select * into v_profile from public.center_operational_profiles
      where center_id = p_center_id for update;
    if found then
      if v_profile.version <> v_expected_version then raise exception 'v2_1_stale_version'; end if;
      update public.center_operational_profiles
      set display_name = v_name, address = v_address, phone = v_phone, note = v_note,
          version = version + 1, updated_at = now(), updated_by_membership_id = v_membership.id
      where center_id = p_center_id returning * into v_profile;
    else
      if v_expected_version <> 0 then raise exception 'v2_1_stale_version'; end if;
      insert into public.center_operational_profiles(
        center_id, display_name, address, phone, note,
        created_by_membership_id, updated_by_membership_id
      ) values (
        p_center_id, v_name, v_address, v_phone, v_note,
        v_membership.id, v_membership.id
      ) returning * into v_profile;
    end if;
    v_entity_type := 'CENTER_PROFILE';
    v_entity_id := p_center_id;
    v_entity_version := v_profile.version;

  elsif v_operation in ('CREATE_TUITION_PACKAGE', 'UPDATE_TUITION_PACKAGE') then
    v_package_id := (p_command->>'package_id')::uuid;
    v_name := regexp_replace(btrim(coalesce(p_command->>'package_name', '')), '\s+', ' ', 'g');
    v_total_sessions := (p_command->>'total_sessions')::integer;
    v_default_amount := (p_command->>'default_amount')::bigint;
    v_is_active := coalesce((p_command->>'is_active')::boolean, true);
    v_note := btrim(coalesce(p_command->>'note', ''));
    if char_length(v_name) not between 1 and 120 or v_total_sessions not between 1 and 1000
       or v_default_amount not between 0 and 9000000000000000 or char_length(v_note) > 500 then
      raise exception 'v2_1_invalid_tuition_package';
    end if;
    select * into v_package from public.center_tuition_package_catalog
      where id = v_package_id for update;
    if v_operation = 'CREATE_TUITION_PACKAGE' then
      if found or v_expected_version <> 0 then raise exception 'v2_1_package_identity_conflict'; end if;
      begin
        insert into public.center_tuition_package_catalog(
          id, center_id, package_name, total_sessions, default_amount, is_active, note,
          created_by_membership_id, updated_by_membership_id
        ) values (
          v_package_id, p_center_id, v_name, v_total_sessions, v_default_amount, v_is_active, v_note,
          v_membership.id, v_membership.id
        ) returning * into v_package;
      exception when unique_violation then
        raise exception 'v2_1_package_name_conflict';
      end;
    else
      if not found or v_package.center_id <> p_center_id or v_package.version <> v_expected_version then
        raise exception 'v2_1_stale_version';
      end if;
      begin
        update public.center_tuition_package_catalog
        set package_name = v_name, total_sessions = v_total_sessions,
            default_amount = v_default_amount, is_active = v_is_active, note = v_note,
            version = version + 1, updated_at = now(), updated_by_membership_id = v_membership.id
        where id = v_package_id returning * into v_package;
      exception when unique_violation then
        raise exception 'v2_1_package_name_conflict';
      end;
    end if;
    v_entity_type := 'TUITION_PACKAGE';
    v_entity_id := v_package.id::text;
    v_entity_version := v_package.version;

  elsif v_operation = 'SET_TUITION_PACKAGE_STATUS' then
    v_package_id := (p_command->>'package_id')::uuid;
    v_is_active := (p_command->>'is_active')::boolean;
    select * into v_package from public.center_tuition_package_catalog
      where id = v_package_id and center_id = p_center_id for update;
    if not found or v_package.version <> v_expected_version then raise exception 'v2_1_stale_version'; end if;
    update public.center_tuition_package_catalog
    set is_active = v_is_active, version = version + 1, updated_at = now(),
        updated_by_membership_id = v_membership.id
    where id = v_package_id returning * into v_package;
    v_entity_type := 'TUITION_PACKAGE';
    v_entity_id := v_package.id::text;
    v_entity_version := v_package.version;

  elsif v_operation in ('SET_SHARED_WALLPAPER', 'CLEAR_SHARED_WALLPAPER') then
    if public.v2_1_internal_normalize_role(v_membership.role) <> 'owner'
       or not public.v2_1_can_manage_shared_wallpaper(v_user_id) then
      raise exception 'v2_1_owner_required';
    end if;
    select * into v_wallpaper from public.installation_shared_presentation
      where singleton for update;
    if found and v_wallpaper.version <> v_expected_version then raise exception 'v2_1_stale_version'; end if;
    if not found and v_expected_version <> 0 then raise exception 'v2_1_stale_version'; end if;
    if v_operation = 'SET_SHARED_WALLPAPER' then
      v_storage_path := btrim(coalesce(p_command->>'storage_path', ''));
      if p_command->>'storage_bucket' <> 'ichess-os-wallpapers'
         or p_command->>'mime_type' <> 'image/webp'
         or v_storage_path !~ '^shared/[0-9a-fA-F-]{36}\.webp$' then
        raise exception 'v2_1_invalid_wallpaper';
      end if;
      if not exists (
        select 1
        from storage.objects object_row
        where object_row.bucket_id = 'ichess-os-wallpapers'
          and object_row.name = v_storage_path
      ) then
        raise exception 'v2_1_wallpaper_object_missing';
      end if;
    else
      v_storage_path := null;
    end if;
    if found then
      update public.installation_shared_presentation
      set storage_bucket = case when v_storage_path is null then null else 'ichess-os-wallpapers' end,
          storage_path = v_storage_path,
          mime_type = case when v_storage_path is null then null else 'image/webp' end,
          version = version + 1, updated_at = now(), updated_by_user_id = v_user_id
      where singleton returning * into v_wallpaper;
    else
      insert into public.installation_shared_presentation(
        storage_bucket, storage_path, mime_type, updated_by_user_id
      ) values (
        case when v_storage_path is null then null else 'ichess-os-wallpapers' end,
        v_storage_path,
        case when v_storage_path is null then null else 'image/webp' end,
        v_user_id
      ) returning * into v_wallpaper;
    end if;
    v_entity_type := 'SHARED_WALLPAPER';
    v_entity_id := 'installation';
    v_entity_version := v_wallpaper.version;
  else
    raise exception 'v2_1_invalid_operation';
  end if;

  v_response := jsonb_build_object(
    'ok', true,
    'outcome_code', 'COMMITTED',
    'center_id', p_center_id,
    'entity_type', v_entity_type,
    'entity_id', v_entity_id,
    'entity_version', v_entity_version
  );
  insert into public.center_settings_audit_events(
    center_id, actor_user_id, actor_membership_id, idempotency_key,
    operation, entity_type, entity_id, entity_version
  ) values (
    p_center_id, v_user_id, v_membership.id, p_idempotency_key,
    v_operation, v_entity_type, v_entity_id, v_entity_version
  );
  insert into public.center_settings_command_results(center_id, idempotency_key, command_hash, response)
  values (p_center_id, p_idempotency_key, v_hash, v_response);
  return v_response;
end
$$;

revoke all on function public.v2_1_internal_normalize_role(text) from public, anon, authenticated, service_role;
revoke all on function public.v2_1_internal_active_membership(text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.v2_1_can_manage_shared_wallpaper(uuid) from public, anon, authenticated, service_role;
revoke all on function public.v2_1_list_center_settings(text) from public, anon, authenticated, service_role;
revoke all on function public.v2_1_mutate_center_settings(text, jsonb, uuid) from public, anon, authenticated, service_role;
grant execute on function public.v2_1_can_manage_shared_wallpaper(uuid) to authenticated, service_role;
grant execute on function public.v2_1_list_center_settings(text) to authenticated, service_role;
grant execute on function public.v2_1_mutate_center_settings(text, jsonb, uuid) to authenticated, service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('ichess-os-wallpapers', 'ichess-os-wallpapers', false, 4194304, array['image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "v2_1 signed in users read shared wallpaper" on storage.objects;
create policy "v2_1 signed in users read shared wallpaper"
on storage.objects for select to authenticated
using (bucket_id = 'ichess-os-wallpapers');

drop policy if exists "v2_1 full owner uploads shared wallpaper" on storage.objects;
create policy "v2_1 full owner uploads shared wallpaper"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ichess-os-wallpapers'
  and name ~ '^shared/[0-9a-fA-F-]{36}\.webp$'
  and public.v2_1_can_manage_shared_wallpaper(auth.uid())
);

comment on table public.center_tuition_package_catalog is
  'Independent exact-center package definitions. Student tuition records never create catalog rows implicitly.';
comment on table public.installation_shared_presentation is
  'Installation-wide presentation pointer. Personal wallpaper overrides remain browser/device-local and never enter this table.';
