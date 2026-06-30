-- C6.6D READ-ONLY VERIFY RPC APPLIED
-- This file must not create centers.
-- This file must not create memberships.
-- This file must not call provision_center_for_owner.
-- Safe to run after C6.6C apply.

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  array_to_string(p.proconfig, ',') as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'ichess_slugify_center_name_compact',
    'provision_center_for_owner'
  )
order by p.proname;

select
  public.ichess_slugify_center_name_compact('Phòng Trống') as phongtrong,
  public.ichess_slugify_center_name_compact('Gò Vấp') as govap,
  public.ichess_slugify_center_name_compact('Phú Nhuận') as phunhuan,
  public.ichess_slugify_center_name_compact('Thủ Đức') as thuduc,
  public.ichess_slugify_center_name_compact('Quận 12') as quan12,
  public.ichess_slugify_center_name_compact('Bình Thạnh') as binhthanh,
  public.ichess_slugify_center_name_compact('iChess Gò Vấp 2') as ichessgovap2;

select
  cm.user_id,
  u.email,
  cm.center_id,
  c.name as center_name,
  c.environment,
  cm.role,
  cm.status
from public.center_members cm
left join auth.users u on u.id = cm.user_id
left join public.centers c on c.id = cm.center_id
where lower(u.email) = lower('owner.duchai@ichess.vn')
order by cm.center_id;

select
  id,
  name,
  slug,
  environment,
  status,
  created_at,
  updated_at
from public.centers
where id in (
  'phongtrong_prod',
  'govap_prod',
  'phunhuan_prod',
  'thuduc_prod',
  'quan12_prod',
  'binhthanh_prod'
)
or slug in (
  'phongtrong',
  'govap',
  'phunhuan',
  'thuduc',
  'quan12',
  'binhthanh'
)
order by id;
