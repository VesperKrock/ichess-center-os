-- C6.6C POST-APPLY VERIFY SQL
-- Read-only verification after manual apply.
-- This file must not create centers.
-- This file must not create memberships.
-- This file must not call provision_center_for_owner with a real center name.

select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
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
  has_function_privilege('authenticated', 'public.provision_center_for_owner(text)', 'execute') as authenticated_can_execute_provision_rpc,
  has_function_privilege('public', 'public.provision_center_for_owner(text)', 'execute') as public_can_execute_provision_rpc;

select
  public.ichess_slugify_center_name_compact('Gò Vấp') as govap,
  public.ichess_slugify_center_name_compact('Phú Nhuận') as phunhuan,
  public.ichess_slugify_center_name_compact('Thủ Đức') as thuduc,
  public.ichess_slugify_center_name_compact('Quận 12') as quan12,
  public.ichess_slugify_center_name_compact('Bình Thạnh') as binhthanh,
  public.ichess_slugify_center_name_compact('iChess Gò Vấp 2') as ichessgovap2;

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
  'govap_prod',
  'phunhuan_prod',
  'thuduc_prod',
  'quan12_prod',
  'binhthanh_prod'
)
order by id;

select
  cm.center_id,
  cm.role,
  cm.status,
  count(*) as membership_count
from public.center_members cm
where cm.center_id in (
  'govap_prod',
  'phunhuan_prod',
  'thuduc_prod',
  'quan12_prod',
  'binhthanh_prod'
)
group by cm.center_id, cm.role, cm.status
order by cm.center_id, cm.role, cm.status;
