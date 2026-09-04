begin;

-- HR-1 is an additive compatibility/privacy boundary over the immutable
-- C5.5 contract.  It does not widen Staff/HR beyond an active exact-center
-- Owner or Admin membership, and it deliberately leaves Owner-only
-- retention/deletion governance unchanged.

do $preflight$
begin
  if to_regprocedure('public.c5_5_list_staff_hr_shared_truth(text)') is null
    or to_regprocedure('public.c5_5_list_staff_hr_shared_truth_v1(text)') is null
    or to_regprocedure('public.c5_5_mutate_staff_hr_shared_truth(text,jsonb,uuid)') is null
    or to_regprocedure('public.c5_5_record_staff_hr_access_audit(text,text,text,text,text,uuid)') is null then
    raise exception 'HR_1_C5_5_PREREQUISITE_MISSING';
  end if;
end
$preflight$;

create or replace function public.c5_5_staff_hr_access_role(p_center_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when pg_catalog.lower(pg_catalog.btrim(cm.role)) = 'admin' then 'center_admin'
    else pg_catalog.lower(pg_catalog.btrim(cm.role))
  end
  from public.center_members cm
  join public.centers c on c.id = cm.center_id
  where cm.center_id = pg_catalog.btrim(coalesce(p_center_id, ''))
    and cm.user_id = auth.uid()
    and pg_catalog.lower(pg_catalog.btrim(coalesce(cm.status, ''))) = 'active'
    and pg_catalog.lower(pg_catalog.btrim(coalesce(c.status, ''))) = 'active'
    and pg_catalog.lower(pg_catalog.btrim(cm.role)) in ('owner', 'center_admin', 'admin')
  limit 1
$function$;

revoke all on function public.c5_5_staff_hr_access_role(text)
  from public, anon, authenticated, service_role;

create or replace function public.can_manage_staff_document_attachments(requested_center_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select auth.uid() is not null
    and nullif(pg_catalog.btrim(requested_center_id), '') is not null
    and exists (
      select 1
      from public.center_members cm
      join public.centers c on c.id = cm.center_id
      where cm.center_id = requested_center_id
        and cm.user_id = auth.uid()
        and pg_catalog.lower(pg_catalog.btrim(coalesce(cm.status::text, ''))) = 'active'
        and pg_catalog.lower(pg_catalog.btrim(coalesce(c.status::text, ''))) = 'active'
        and pg_catalog.lower(pg_catalog.replace(pg_catalog.replace(
          pg_catalog.btrim(coalesce(cm.role::text, '')), '-', '_'), ' ', '_'))
          in ('owner', 'center_admin', 'admin')
    )
$function$;

revoke all on function public.can_manage_staff_document_attachments(text)
  from public, anon, authenticated, service_role;
grant execute on function public.can_manage_staff_document_attachments(text)
  to authenticated;

-- The immutable C5.5 mutation and access-audit functions contained one raw
-- membership-role comparison. Patch exactly that reviewed statement and stop
-- fail-closed if the inherited function body has drifted. All downstream
-- Owner-only comparisons still receive only canonical 'owner' or
-- 'center_admin', so 'admin' gains no governance authority.
do $patch_role_alias$
declare
  v_signature regprocedure;
  v_definition text;
  v_patched text;
  v_search constant text :=
    'select lower(btrim(cm.role)), cm.id into v_role, v_membership_id';
  v_replacement constant text :=
    'select case when lower(btrim(cm.role)) = ''admin'' then ''center_admin'' else lower(btrim(cm.role)) end, cm.id into v_role, v_membership_id';
  v_match_count integer;
  v_replacement_count integer;
begin
  foreach v_signature in array array[
    'public.c5_5_mutate_staff_hr_shared_truth(text,jsonb,uuid)'::regprocedure,
    'public.c5_5_record_staff_hr_access_audit(text,text,text,text,text,uuid)'::regprocedure
  ] loop
    select pg_get_functiondef(v_signature) into v_definition;
    v_match_count := (
      length(v_definition) - length(replace(v_definition, v_search, ''))
    ) / length(v_search);
    v_replacement_count := (
      length(v_definition) - length(replace(v_definition, v_replacement, ''))
    ) / length(v_replacement);
    if v_match_count = 1 and v_replacement_count = 0 then
      v_patched := replace(v_definition, v_search, v_replacement);
      execute v_patched;
    elsif v_match_count = 0 and v_replacement_count = 1 then
      continue;
    else
      raise exception 'HR_1_INHERITED_ROLE_GUARD_DRIFT:%:%', v_signature, v_match_count;
    end if;
  end loop;
end
$patch_role_alias$;

-- Keep the ordinary Staff snapshot useful for roster/status screens while
-- withholding all administrative PII.  The exact profile is available only
-- from the audited RPC below.
create or replace function public.c5_5_list_staff_hr_shared_truth(p_center_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_snapshot jsonb;
  v_profile_summaries jsonb;
  v_audit_events jsonb;
begin
  v_snapshot := public.c5_5_list_staff_hr_shared_truth_v1(p_center_id);
  if coalesce((v_snapshot->>'ok')::boolean, false) is not true then
    return v_snapshot;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p->>'id', 'schemaVersion', coalesce((p->>'schemaVersion')::integer, 1),
    'centerId', p->>'centerId', 'staffMemberId', p->>'staffMemberId',
    'legalFullName', '', 'dateOfBirth', '', 'gender', '', 'nationality', '',
    'permanentAddress', jsonb_build_object(
      'addressLine', '', 'wardOrCommune', '', 'district', '',
      'provinceOrCity', '', 'country', ''),
    'currentAddress', jsonb_build_object(
      'addressLine', '', 'wardOrCommune', '', 'district', '',
      'provinceOrCity', '', 'country', ''),
    'emergencyContact', jsonb_build_object('name', '', 'phone', '', 'relationship', ''),
    'identityDocument', jsonb_build_object(
      'type', '', 'number', '', 'issuedDate', '', 'issuedPlace', '', 'expiryDate', ''),
    'taxInformation', jsonb_build_object(
      'taxNumber', '', 'registeredDate', '', 'registeredPlace', ''),
    'insuranceInformation', jsonb_build_object(
      'socialInsuranceNumber', '', 'healthInsuranceNumber', ''),
    'bankInformation', jsonb_build_object(
      'bankName', '', 'accountNumber', '', 'accountHolderName', '', 'branch', ''),
    'employmentAdministration', jsonb_build_object(
      'contractNumber', '', 'contractType', '', 'signedDate', '',
      'effectiveDate', '', 'expiryDate', '', 'signingEntity', '', 'note', ''),
    'note', '', 'completionStatus', p->>'completionStatus',
    'completionReview', jsonb_build_object(
      'reviewedAt', '', 'reviewedBy', '', 'reviewedByLabel', '',
      'checklistVersion', ''),
    'revision', (p->>'revision')::bigint,
    'createdAt', p->>'createdAt', 'updatedAt', p->>'updatedAt',
    'archivedAt', coalesce(p->>'archivedAt', ''),
    'cloudVersion', (p->>'cloudVersion')::bigint,
    'sensitiveFieldsWithheld', true
  ) order by p->>'createdAt' desc, p->>'id'), '[]'::jsonb)
  into v_profile_summaries
  from jsonb_array_elements(coalesce(v_snapshot->'administrative_profiles', '[]'::jsonb)) p;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'schemaVersion', 1, 'centerId', a.center_id,
    'actorUserId', a.actor_user_id, 'actorMembershipId', a.actor_membership_id,
    'actorRole', a.actor_role, 'action', a.action,
    'targetType', replace(a.entity_type, '_', '-'), 'targetId', a.entity_id,
    'staffMemberId', coalesce(a.staff_member_id, ''),
    'administrativeProfileId', coalesce(a.administrative_profile_id, ''),
    'documentId', coalesce(a.document_id, ''), 'attachmentId', '',
    'outcome', a.outcome, 'reasonCode', a.reason_code,
    'noteSummary', a.note_summary, 'requestId', coalesce(a.request_id, ''),
    'createdAt', a.created_at
  ) order by a.created_at desc, a.id desc), '[]'::jsonb)
  into v_audit_events
  from public.center_staff_hr_audit_events a
  where a.center_id = btrim(coalesce(p_center_id, ''))
    and a.action in (
      'administrative-profile.open', 'administrative-profile.reveal-sensitive',
      'administrative-profile.create', 'administrative-profile.edit',
      'staff-document.create', 'staff-document.edit',
      'staff-document.archive', 'staff-document.restore',
      'retention-policy.update', 'deletion-request.create',
      'deletion-request.cancel', 'deletion-request.approve', 'deletion-request.deny'
    );

  v_snapshot := jsonb_set(v_snapshot, '{administrative_profiles}', v_profile_summaries, true);
  v_snapshot := jsonb_set(v_snapshot, '{documents}', '[]'::jsonb, true);
  return jsonb_set(v_snapshot, '{audit_events}', v_audit_events, true);
end
$function$;

revoke all on function public.c5_5_list_staff_hr_shared_truth(text)
  from public, anon, authenticated, service_role;
grant execute on function public.c5_5_list_staff_hr_shared_truth(text)
  to authenticated;

create or replace function public.hr_1_read_staff_administrative_profile(
  p_center_id text,
  p_staff_member_id text,
  p_administrative_profile_id text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center_id text := btrim(coalesce(p_center_id, ''));
  v_staff_member_id text := btrim(coalesce(p_staff_member_id, ''));
  v_profile_id text := btrim(coalesce(p_administrative_profile_id, ''));
  v_audit jsonb;
  v_profile jsonb;
  v_documents jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED');
  end if;
  if v_center_id = '' or length(v_center_id) > 160
    or v_staff_member_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
    or v_profile_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
    or p_idempotency_key is null then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;
  if public.c5_5_staff_hr_access_role(v_center_id) is null then
    return jsonb_build_object('ok', false, 'outcome_code', 'CENTER_ACCESS_DENIED');
  end if;
  if not exists (
    select 1
    from public.center_staff_administrative_profiles p
    where p.center_id = v_center_id
      and p.id = v_profile_id
      and p.staff_member_id = v_staff_member_id
    for share
  ) then
    return jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_NOT_FOUND_OR_DENIED');
  end if;

  -- This insert/replay is the audit gate. No protected field is selected into
  -- the response until it has committed successfully in this transaction.
  v_audit := public.c5_5_record_staff_hr_access_audit(
    v_center_id,
    'administrative-profile.open',
    v_staff_member_id,
    v_profile_id,
    'explicit-open',
    p_idempotency_key
  );
  if coalesce((v_audit->>'ok')::boolean, false) is not true
    or v_audit->>'outcome_code' <> 'COMMITTED' then
    return jsonb_build_object(
      'ok', false,
      'outcome_code', coalesce(v_audit->>'outcome_code', 'ACCESS_AUDIT_FAILED')
    );
  end if;

  select jsonb_build_object(
    'id', p.id, 'schemaVersion', p.schema_version, 'centerId', p.center_id,
    'staffMemberId', p.staff_member_id, 'legalFullName', p.legal_full_name,
    'dateOfBirth', coalesce(p.date_of_birth::text, ''), 'gender', p.gender,
    'nationality', p.nationality,
    'permanentAddress', jsonb_build_object(
      'addressLine', p.permanent_address_line,
      'wardOrCommune', p.permanent_ward_or_commune,
      'district', p.permanent_district,
      'provinceOrCity', p.permanent_province_or_city,
      'country', p.permanent_country),
    'currentAddress', jsonb_build_object(
      'addressLine', p.current_address_line,
      'wardOrCommune', p.current_ward_or_commune,
      'district', p.current_district,
      'provinceOrCity', p.current_province_or_city,
      'country', p.current_country),
    'emergencyContact', jsonb_build_object(
      'name', p.emergency_name, 'phone', p.emergency_phone,
      'relationship', p.emergency_relationship),
    'identityDocument', jsonb_build_object(
      'type', p.identity_type, 'number', p.identity_number,
      'issuedDate', coalesce(p.identity_issued_date::text, ''),
      'issuedPlace', p.identity_issued_place,
      'expiryDate', coalesce(p.identity_expiry_date::text, '')),
    'taxInformation', jsonb_build_object(
      'taxNumber', p.tax_number,
      'registeredDate', coalesce(p.tax_registered_date::text, ''),
      'registeredPlace', p.tax_registered_place),
    'insuranceInformation', jsonb_build_object(
      'socialInsuranceNumber', p.social_insurance_number,
      'healthInsuranceNumber', p.health_insurance_number),
    'bankInformation', jsonb_build_object(
      'bankName', p.bank_name, 'accountNumber', p.bank_account_number,
      'accountHolderName', p.bank_account_holder_name, 'branch', p.bank_branch),
    'employmentAdministration', jsonb_build_object(
      'contractNumber', p.contract_number, 'contractType', p.contract_type,
      'signedDate', coalesce(p.contract_signed_date::text, ''),
      'effectiveDate', coalesce(p.contract_effective_date::text, ''),
      'expiryDate', coalesce(p.contract_expiry_date::text, ''),
      'signingEntity', p.contract_signing_entity, 'note', p.contract_note),
    'note', p.note, 'completionStatus', p.completion_status,
    'completionReview', jsonb_build_object(
      'reviewedAt', coalesce(p.reviewed_at::text, ''),
      'reviewedBy', coalesce(p.reviewed_by::text, ''),
      'reviewedByLabel', p.reviewed_by_label,
      'checklistVersion', p.checklist_version),
    'revision', p.version, 'createdAt', p.created_at, 'updatedAt', p.updated_at,
    'archivedAt', coalesce(p.archived_at::text, ''), 'cloudVersion', p.version,
    'sensitiveFieldsWithheld', false
  ) into v_profile
  from public.center_staff_administrative_profiles p
  where p.center_id = v_center_id
    and p.id = v_profile_id
    and p.staff_member_id = v_staff_member_id;

  if v_profile is null then
    raise exception 'HR_1_PROFILE_CHANGED_AFTER_ACCESS_AUDIT';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', d.id, 'schemaVersion', d.schema_version, 'centerId', d.center_id,
    'staffMemberId', d.staff_member_id,
    'administrativeProfileId', d.administrative_profile_id,
    'category', d.category, 'title', d.title, 'documentNumber', d.document_number,
    'issuedDate', coalesce(d.issued_date::text, ''),
    'effectiveDate', coalesce(d.effective_date::text, ''),
    'expiryDate', coalesce(d.expiry_date::text, ''), 'note', d.note,
    'attachmentIds', coalesce((select jsonb_agg(a.id::text order by a.version desc)
      from public.center_staff_document_attachments a
      where a.center_id = d.center_id and a.staff_member_id = d.staff_member_id
        and a.administrative_profile_id = d.administrative_profile_id
        and a.document_id = d.id and a.state = 'available'
        and a.deleted_at is null), '[]'::jsonb),
    'revision', d.version, 'createdAt', d.created_at, 'updatedAt', d.updated_at,
    'archivedAt', coalesce(d.archived_at::text, ''), 'cloudVersion', d.version
  ) order by d.created_at desc, d.id), '[]'::jsonb)
  into v_documents
  from public.center_staff_documents d
  where d.center_id = v_center_id
    and d.staff_member_id = v_staff_member_id
    and d.administrative_profile_id = v_profile_id;

  return jsonb_build_object(
    'ok', true, 'outcome_code', 'SENSITIVE_PROFILE_READ',
    'center_id', v_center_id, 'profile', v_profile,
    'documents', v_documents,
    'audit_event', v_audit->'audit_event'
  );
end
$function$;

revoke all on function public.hr_1_read_staff_administrative_profile(text, text, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.hr_1_read_staff_administrative_profile(text, text, text, uuid)
  to authenticated;

comment on function public.hr_1_read_staff_administrative_profile(text, text, text, uuid) is
  'Exact-center audited gate that returns one protected Staff administrative profile only after durable access evidence succeeds.';

commit;
