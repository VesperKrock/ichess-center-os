-- MANUAL APPLY TEMPLATE ONLY
-- DO NOT RUN IN C6.6B.
-- Review and run only in a later confirmed apply phase such as C6.6C.
-- Purpose: create guarded RPC for owner to provision an empty production center from one visible field: center name.
-- This does not create centers when applied; it only creates helper/RPC functions.
-- This does not create Auth users.
-- This does not clone DreamHome.
-- This does not touch Angel Wings.

-- Compact slug examples expected by C6.6:
-- Gò Vấp -> govap
-- Phú Nhuận -> phunhuan
-- Thủ Đức -> thuduc
-- Quận 12 -> quan12
-- Bình Thạnh -> binhthanh
-- iChess Gò Vấp 2 -> ichessgovap2

create or replace function public.ichess_slugify_center_name_compact(input text)
returns text
language plpgsql
immutable
set search_path = public, extensions
as $$
declare
  normalized text;
begin
  normalized := lower(trim(coalesce(input, '')));
  normalized := replace(normalized, 'đ', 'd');
  normalized := replace(normalized, 'Đ', 'd');
  normalized := translate(
    normalized,
    'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ',
    'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyy'
  );
  normalized := regexp_replace(normalized, '[^a-z0-9]+', '', 'g');
  return normalized;
end;
$$;

create or replace function public.provision_center_for_owner(p_center_name text)
returns table (
  id text,
  name text,
  slug text,
  environment text,
  status text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  current_user_id uuid;
  normalized_name text;
  generated_slug text;
  generated_center_id text;
  created_center public.centers%rowtype;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.center_members cm
    where cm.user_id = current_user_id
      and cm.role = 'owner'
      and cm.status = 'active'
  ) then
    raise exception 'owner_membership_required';
  end if;

  normalized_name := trim(coalesce(p_center_name, ''));

  if length(normalized_name) < 2 then
    raise exception 'center_name_too_short';
  end if;

  generated_slug := public.ichess_slugify_center_name_compact(normalized_name);

  if generated_slug = '' then
    raise exception 'center_slug_empty';
  end if;

  generated_center_id := generated_slug || '_prod';

  if exists (
    select 1
    from public.centers c
    where c.id = generated_center_id
  ) then
    raise exception 'center_id_already_exists';
  end if;

  if exists (
    select 1
    from public.centers c
    where c.slug = generated_slug
      and c.environment = 'production'
  ) then
    raise exception 'center_slug_environment_already_exists';
  end if;

  insert into public.centers (
    id,
    name,
    slug,
    environment,
    status
  )
  values (
    generated_center_id,
    normalized_name,
    generated_slug,
    'production',
    'active'
  )
  returning * into created_center;

  insert into public.center_members (
    user_id,
    center_id,
    role,
    status
  )
  select
    current_user_id,
    generated_center_id,
    'owner',
    'active'
  where not exists (
    select 1
    from public.center_members cm
    where cm.user_id = current_user_id
      and cm.center_id = generated_center_id
  );

  return query
  select
    created_center.id,
    created_center.name,
    created_center.slug,
    created_center.environment,
    created_center.status,
    created_center.created_at,
    created_center.updated_at;
end;
$$;

comment on function public.ichess_slugify_center_name_compact(text)
is 'C6.6 helper template: compact Vietnamese center slug, no accents, no hyphen.';

comment on function public.provision_center_for_owner(text)
is 'C6.6 guarded RPC template: one visible input p_center_name, creates empty production center metadata and owner membership when run in a confirmed apply phase.';
