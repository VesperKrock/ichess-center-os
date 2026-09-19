-- New-center control-plane bootstrap forward fix.
--
-- Records the already-live ARG-2 trigger security-context correction without
-- replacing its body, then makes the canonical Owner provisioning RPC leave a
-- newly-created center governed and CRM-ready in the same transaction.

begin;

set local check_function_bodies = true;

do $new_center_control_plane_prerequisites$
begin
  if pg_catalog.to_regprocedure(
       'public.arg2_internal_enforce_governed_membership()'
     ) is null
     or pg_catalog.to_regprocedure(
       'public.provision_center_for_owner(text)'
     ) is null
     or pg_catalog.to_regclass('public.centers') is null
     or pg_catalog.to_regclass('public.center_members') is null
     or pg_catalog.to_regclass('public.center_access_governance') is null
     or pg_catalog.to_regclass('public.account_governance_subjects') is null
     or pg_catalog.to_regclass('public.account_credential_gates') is null
     or pg_catalog.to_regclass('public.center_crm_control') is null
     or pg_catalog.to_regclass('public.crm_contact_lookup_control') is null then
    raise exception 'new_center_control_plane_prerequisite_missing';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_roles
    where rolname = 'postgres'
  ) then
    raise exception 'new_center_control_plane_postgres_owner_missing';
  end if;
end;
$new_center_control_plane_prerequisites$;

-- The production incident was caused by this deferred constraint trigger
-- running as its invoker. ALTER FUNCTION changes only catalog attributes; the
-- reviewed trigger body remains unchanged.
alter function public.arg2_internal_enforce_governed_membership()
  security definer;
alter function public.arg2_internal_enforce_governed_membership()
  owner to postgres;
alter function public.arg2_internal_enforce_governed_membership()
  set search_path to '';

create or replace function public.provision_center_for_owner(
  p_center_name text
)
returns table (
  id text,
  name text,
  slug text,
  environment text,
  status text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
language plpgsql
security definer
set search_path = ''
as $provision_center_for_owner$
declare
  current_user_id uuid;
  normalized_name text;
  generated_slug text;
  generated_center_id text;
  created_center public.centers%rowtype;
  created_owner public.center_members%rowtype;
  crm_control public.center_crm_control%rowtype;
  lookup_control public.crm_contact_lookup_control%rowtype;
  owner_count integer;
  admin_count integer;
  membership_count integer;
begin
  current_user_id := auth.uid();

  if current_user_id is null then
    raise exception 'not_authenticated';
  end if;

  -- Existing-center authority is the canonical active Owner pointer. A stale,
  -- duplicate, suspended, or pre-governance membership cannot create centers.
  perform 1
  from public.center_access_governance governance
  join public.center_members owner_membership
    on owner_membership.id = governance.canonical_owner_membership_id
   and owner_membership.center_id = governance.center_id
   and owner_membership.user_id = current_user_id
   and owner_membership.role = 'owner'
   and owner_membership.status = 'active'
  join public.centers authorizing_center
    on authorizing_center.id = governance.center_id
   and authorizing_center.status = 'active'
  where governance.status = 'active'
  limit 1;

  if not found then
    raise exception 'owner_membership_required';
  end if;

  normalized_name := pg_catalog.btrim(coalesce(p_center_name, ''));

  if pg_catalog.length(normalized_name) < 2 then
    raise exception 'center_name_too_short';
  end if;

  generated_slug := public.ichess_slugify_center_name_compact(normalized_name);

  if generated_slug = '' then
    raise exception 'center_slug_empty';
  end if;

  generated_center_id := generated_slug || '_prod';

  if exists (
    select 1
    from public.centers center_record
    where center_record.id = generated_center_id
  ) then
    raise exception 'center_id_already_exists';
  end if;

  if exists (
    select 1
    from public.centers center_record
    where center_record.slug = generated_slug
      and center_record.environment = 'production'
  ) then
    raise exception 'center_slug_environment_already_exists';
  end if;

  insert into public.centers (
    id,
    name,
    slug,
    environment,
    status
  ) values (
    generated_center_id,
    normalized_name,
    generated_slug,
    'production',
    'active'
  )
  returning * into created_center;

  -- The existing center triggers must have provisioned both protected roots.
  -- Lock and validate their frozen initial shape before any activation.
  select * into crm_control
  from public.center_crm_control crm_record
  where crm_record.center_id = generated_center_id
  for update;

  if not found
     or crm_control.crm_schema_version <> 1
     or crm_control.identity_policy_version <> 1
     or crm_control.conversion_policy_version <> 1
     or crm_control.relationship_policy_version <> 1
     or crm_control.student_profile_policy_version <> 1
     or crm_control.crm_state <> 'PLANNED'
     or crm_control.feature_flag_state <> 'DISABLED'
     or crm_control.control_version <> 1 then
    raise exception 'new_center_crm_control_prerequisite_invalid';
  end if;

  select * into lookup_control
  from public.crm_contact_lookup_control lookup_record
  where lookup_record.center_id = generated_center_id
  for share;

  if not found
     or lookup_control.payload_schema_version <> 1
     or lookup_control.phone_normalization_version <> 1
     or lookup_control.email_normalization_version <> 1
     or lookup_control.digest_contract_version <> 1
     or lookup_control.current_key_epoch <> 1
     or lookup_control.previous_key_epoch is not null
     or lookup_control.pending_key_epoch is not null
     or lookup_control.rotation_state <> 'ACTIVE'
     or lookup_control.control_version <> 1 then
    raise exception 'new_center_lookup_control_prerequisite_invalid';
  end if;

  insert into public.center_members (
    user_id,
    center_id,
    role,
    status
  ) values (
    current_user_id,
    generated_center_id,
    'owner',
    'active'
  )
  returning * into created_owner;

  select pg_catalog.count(*)::integer into owner_count
  from public.center_members membership_record
  where membership_record.center_id = generated_center_id
    and membership_record.role = 'owner'
    and membership_record.status = 'active';

  select pg_catalog.count(*)::integer into admin_count
  from public.center_members membership_record
  where membership_record.center_id = generated_center_id
    and membership_record.role in ('center_admin', 'admin')
    and membership_record.status = 'active';

  select pg_catalog.count(*)::integer into membership_count
  from public.center_members membership_record
  where membership_record.center_id = generated_center_id;

  if owner_count <> 1 then
    raise exception 'new_center_exactly_one_active_owner_required';
  end if;
  if admin_count <> 0 then
    raise exception 'new_center_admin_must_not_be_bootstrapped';
  end if;
  if membership_count <> 1 then
    raise exception 'new_center_unexpected_membership';
  end if;

  insert into public.account_governance_subjects (
    auth_user_id,
    first_center_id
  ) values (
    current_user_id,
    generated_center_id
  )
  on conflict (auth_user_id) do nothing;

  insert into public.account_credential_gates (
    membership_id,
    center_id,
    user_id,
    credential_state
  ) values (
    created_owner.id,
    generated_center_id,
    current_user_id,
    'ready'
  );

  insert into public.center_access_governance (
    center_id,
    status,
    canonical_owner_membership_id,
    canonical_admin_membership_id,
    activated_at
  ) values (
    generated_center_id,
    'active',
    created_owner.id,
    null,
    pg_catalog.transaction_timestamp()
  );

  update public.center_crm_control crm_record
  set crm_state = 'ACTIVE',
      feature_flag_state = 'ENABLED',
      control_version = control_version + 1,
      updated_at = pg_catalog.transaction_timestamp()
  where crm_record.center_id = generated_center_id
    and crm_record.crm_state = 'PLANNED'
    and crm_record.feature_flag_state = 'DISABLED'
    and crm_record.control_version = 1;

  if not found then
    raise exception 'new_center_crm_activation_failed';
  end if;

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
$provision_center_for_owner$;

alter function public.provision_center_for_owner(text)
  owner to postgres;
revoke all on function public.provision_center_for_owner(text)
  from public, anon, service_role;
grant execute on function public.provision_center_for_owner(text)
  to authenticated;

comment on function public.provision_center_for_owner(text) is
  'Canonical Owner-only new-center transaction: creates one Owner, activates ARG-2 governance, validates lookup control, and enables CRM runtime.';

do $new_center_control_plane_verify$
declare
  trigger_function pg_catalog.pg_proc%rowtype;
  provision_function pg_catalog.pg_proc%rowtype;
begin
  select procedure_record.* into strict trigger_function
  from pg_catalog.pg_proc procedure_record
  join pg_catalog.pg_namespace namespace_record
    on namespace_record.oid = procedure_record.pronamespace
  where namespace_record.nspname = 'public'
    and procedure_record.proname = 'arg2_internal_enforce_governed_membership'
    and procedure_record.pronargs = 0;

  if not trigger_function.prosecdef
     or trigger_function.proowner <> (
       select role_record.oid
       from pg_catalog.pg_roles role_record
       where role_record.rolname = 'postgres'
     )
     or not ('search_path=""' = any(trigger_function.proconfig)) then
    raise exception 'new_center_arg2_trigger_security_context_invalid';
  end if;

  select procedure_record.* into strict provision_function
  from pg_catalog.pg_proc procedure_record
  join pg_catalog.pg_namespace namespace_record
    on namespace_record.oid = procedure_record.pronamespace
  where namespace_record.nspname = 'public'
    and procedure_record.proname = 'provision_center_for_owner'
    and procedure_record.pronargs = 1;

  if not provision_function.prosecdef
     or provision_function.proowner <> (
       select role_record.oid
       from pg_catalog.pg_roles role_record
       where role_record.rolname = 'postgres'
     )
     or not ('search_path=""' = any(provision_function.proconfig)) then
    raise exception 'new_center_provision_rpc_security_context_invalid';
  end if;
end;
$new_center_control_plane_verify$;

commit;
