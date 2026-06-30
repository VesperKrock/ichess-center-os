-- C6.6D CONTROLLED CREATE CENTER RPC TEMPLATE
-- DO NOT RUN UNLESS USER CONFIRMS THE TARGET CENTER NAME.
-- This SQL will create a real production center and owner membership if executed by an authenticated owner context where auth.uid() is available.
-- This must be run only after read-only verification confirms the target center does not exist.
-- This must be run only once per target center.
-- This does not clone DreamHome.
-- This does not copy Angel Wings.

-- Important limitation:
-- Supabase SQL Editor usually runs as role postgres, so auth.uid() can be null.
-- The RPC is designed for an authenticated app/session owner context.
-- If this returns unauthenticated in SQL Editor, do not remove the auth.uid() guard.
-- Use an authenticated Supabase client/app session path in a later phase instead.

-- Do not use a fake/test center unless there is a cleanup/archive plan.
-- C6.6D.1 changes the controlled test target to Phòng Trống / phongtrong_prod.
-- Do not use Gò Vấp / govap_prod for test because it may become a real future center.

-- Target test center chosen by user to avoid future real-branch conflicts:
-- select public.provision_center_for_owner('Phòng Trống');

-- Target option B: only if user intentionally wants another real center.
-- select public.provision_center_for_owner('Gò Vấp');
-- select public.provision_center_for_owner('Phú Nhuận');
-- select public.provision_center_for_owner('Thủ Đức');
-- select public.provision_center_for_owner('Quận 12');

-- Expected possible SQL Editor error:
-- not_authenticated or owner_membership_required can mean the SQL Editor context is not an authenticated owner app session.
-- That is not a reason to weaken the RPC guard.
