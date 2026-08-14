begin;

-- C5.5 independent-review hardening. The accepted 202608140007 migration is
-- immutable; this additive patch closes browser-reuse, access-audit and
-- authoritative attachment-parent gaps found by adversarial review.

create or replace function public.c5_5_guard_staff_document_attachment_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.center_staff_documents d
    where d.center_id = new.center_id
      and d.staff_member_id = new.staff_member_id
      and d.administrative_profile_id = new.administrative_profile_id
      and d.id = new.document_id
  ) then
    raise exception 'staff_document_attachment_authoritative_parent_invalid'
      using errcode = '23503';
  end if;
  return new;
end
$function$;

revoke all on function public.c5_5_guard_staff_document_attachment_parent()
  from public, anon, authenticated, service_role;

drop trigger if exists c5_5_guard_staff_document_attachment_parent
  on public.center_staff_document_attachments;
create trigger c5_5_guard_staff_document_attachment_parent
before insert or update of center_id, staff_member_id, administrative_profile_id, document_id
on public.center_staff_document_attachments
for each row execute function public.c5_5_guard_staff_document_attachment_parent();

-- Preserve the accepted snapshot implementation as a non-client-callable
-- base, then wrap it to include server-authored protected-access evidence.
alter function public.c5_5_list_staff_hr_shared_truth(text)
  rename to c5_5_list_staff_hr_shared_truth_v1;

revoke all on function public.c5_5_list_staff_hr_shared_truth_v1(text)
  from public, anon, authenticated, service_role;

create or replace function public.c5_5_list_staff_hr_shared_truth(p_center_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_snapshot jsonb;
  v_audit_events jsonb;
begin
  v_snapshot := public.c5_5_list_staff_hr_shared_truth_v1(p_center_id);
  if coalesce((v_snapshot->>'ok')::boolean, false) is not true then
    return v_snapshot;
  end if;

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

  return jsonb_set(v_snapshot, '{audit_events}', v_audit_events, true);
end
$function$;

revoke all on function public.c5_5_list_staff_hr_shared_truth(text)
  from public, anon, authenticated, service_role;
grant execute on function public.c5_5_list_staff_hr_shared_truth(text)
  to authenticated;

create or replace function public.c5_5_record_staff_hr_access_audit(
  p_center_id text,
  p_action text,
  p_staff_member_id text,
  p_administrative_profile_id text,
  p_note_summary text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_center_id text := btrim(coalesce(p_center_id, ''));
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_staff_member_id text := btrim(coalesce(p_staff_member_id, ''));
  v_profile_id text := nullif(btrim(coalesce(p_administrative_profile_id, '')), '');
  v_note_summary text := lower(btrim(coalesce(p_note_summary, '')));
  v_role text;
  v_membership_id uuid;
  v_existing public.center_staff_hr_audit_events%rowtype;
  v_event public.center_staff_hr_audit_events%rowtype;
  v_target_type text;
  v_target_id text;
  v_event_json jsonb;
begin
  if v_actor is null then
    return jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED');
  end if;
  if v_center_id = '' or length(v_center_id) > 160
    or v_staff_member_id !~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$'
    or p_idempotency_key is null
    or v_action not in (
      'administrative-profile.open',
      'administrative-profile.reveal-sensitive'
    ) then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;

  select lower(btrim(cm.role)), cm.id into v_role, v_membership_id
  from public.center_members cm
  join public.centers c on c.id = cm.center_id
  where cm.center_id = v_center_id
    and cm.user_id = v_actor
    and lower(btrim(coalesce(cm.status, ''))) = 'active'
    and lower(btrim(coalesce(c.status, ''))) = 'active'
  for share of cm, c;
  if v_role is null then
    return jsonb_build_object('ok', false, 'outcome_code', 'CENTER_ACCESS_DENIED');
  end if;
  if v_role not in ('owner', 'center_admin') then
    return jsonb_build_object('ok', false, 'outcome_code', 'WRITE_ROLE_REQUIRED');
  end if;

  if not exists (
    select 1 from public.center_staff_hr_members s
    where s.center_id = v_center_id and s.id = v_staff_member_id
  ) then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_REFERENCE');
  end if;
  if v_profile_id is not null and not exists (
    select 1 from public.center_staff_administrative_profiles p
    where p.center_id = v_center_id
      and p.id = v_profile_id
      and p.staff_member_id = v_staff_member_id
  ) then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_REFERENCE');
  end if;

  if v_action = 'administrative-profile.reveal-sensitive' then
    if v_profile_id is null or v_note_summary not in (
      'identitydocument.number',
      'taxinformation.taxnumber',
      'insuranceinformation.socialinsurancenumber',
      'insuranceinformation.healthinsurancenumber',
      'bankinformation.accountnumber',
      'employmentadministration.contractnumber'
    ) then
      return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
  elsif v_note_summary not in ('', 'explicit-open') then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
  else
    v_note_summary := 'explicit-open';
  end if;

  v_target_type := case when v_profile_id is null then 'staff_member'
    else 'administrative_profile' end;
  v_target_id := coalesce(v_profile_id, v_staff_member_id);

  perform pg_advisory_xact_lock(hashtextextended(
    'c5.5-access-audit:' || p_idempotency_key::text, 0
  ));
  select * into v_existing
  from public.center_staff_hr_audit_events a
  where a.id = p_idempotency_key;
  if found then
    if v_existing.center_id <> v_center_id
      or v_existing.actor_user_id <> v_actor
      or v_existing.actor_membership_id <> v_membership_id
      or v_existing.action <> v_action
      or v_existing.entity_type <> v_target_type
      or v_existing.entity_id <> v_target_id
      or v_existing.staff_member_id is distinct from v_staff_member_id
      or v_existing.administrative_profile_id is distinct from v_profile_id
      or v_existing.note_summary <> v_note_summary then
      return jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
    end if;
    v_event := v_existing;
  else
    insert into public.center_staff_hr_audit_events (
      id, center_id, actor_user_id, actor_membership_id, actor_role,
      operation, action, entity_type, entity_id, staff_member_id,
      administrative_profile_id, outcome, reason_code, note_summary
    ) values (
      p_idempotency_key, v_center_id, v_actor, v_membership_id, v_role,
      'READ', v_action, v_target_type, v_target_id, v_staff_member_id,
      v_profile_id, 'success', 'server-access-audit', v_note_summary
    ) returning * into v_event;
  end if;

  v_event_json := jsonb_build_object(
    'id', v_event.id, 'schemaVersion', 1, 'centerId', v_event.center_id,
    'actorUserId', v_event.actor_user_id,
    'actorMembershipId', v_event.actor_membership_id,
    'actorRole', v_event.actor_role, 'action', v_event.action,
    'targetType', replace(v_event.entity_type, '_', '-'),
    'targetId', v_event.entity_id,
    'staffMemberId', coalesce(v_event.staff_member_id, ''),
    'administrativeProfileId', coalesce(v_event.administrative_profile_id, ''),
    'documentId', '', 'attachmentId', '', 'requestId', '',
    'outcome', v_event.outcome, 'reasonCode', v_event.reason_code,
    'noteSummary', v_event.note_summary, 'createdAt', v_event.created_at
  );
  return jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED',
    'center_id', v_center_id, 'audit_event', v_event_json
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
  when foreign_key_violation then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_REFERENCE');
  when check_violation or invalid_text_representation then
    return jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
end
$function$;

revoke all on function public.c5_5_record_staff_hr_access_audit(
  text, text, text, text, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.c5_5_record_staff_hr_access_audit(
  text, text, text, text, text, uuid
) to authenticated;

comment on function public.c5_5_record_staff_hr_access_audit(
  text, text, text, text, text, uuid
) is 'Server-authored, idempotent audit gate for opening or revealing protected C5.5 HR data.';

commit;
