begin;

-- F2A keeps the operator-entered birth year in the existing authoritative
-- CRM safe state. It remains distinct from the protected full birth-date
-- evidence used by the Candidate/Student conversion boundary.
create or replace function public.c5_3_is_safe_case_state(p_state jsonb)
returns boolean
language plpgsql
stable
set search_path = ''
as $function$
declare
  v_key text;
  v_enrollment jsonb;
  v_birth_year text;
begin
  if p_state is null
     or pg_catalog.jsonb_typeof(p_state) <> 'object'
     or pg_catalog.octet_length(pg_catalog.convert_to(p_state::text, 'UTF8')) > 32768
     or public.c5_3_contains_protected_identity(p_state::text) then
    return false;
  end if;

  for v_key in select key from pg_catalog.jsonb_each(p_state)
  loop
    if v_key not in (
      'contactType', 'customerStage', 'consultationStatus', 'source',
      'interestedProgram', 'preferredSchedule', 'locationArea',
      'consultedAt', 'registeredAt', 'nextAction', 'nextFollowUpAt',
      'potentialLevel', 'parentFeedbackAboutChild', 'studentBirthYear',
      'enrollmentDraft'
    ) then
      return false;
    end if;
  end loop;

  if p_state ? 'studentBirthYear' then
    if pg_catalog.jsonb_typeof(p_state->'studentBirthYear') <> 'string' then
      return false;
    end if;
    v_birth_year := p_state->>'studentBirthYear';
    if v_birth_year <> '' then
      if v_birth_year !~ '^[0-9]{4}$' then
        return false;
      end if;
      if v_birth_year::integer < 1900
         or v_birth_year::integer > pg_catalog.date_part('year', current_date)::integer then
        return false;
      end if;
    end if;
  end if;

  v_enrollment := p_state->'enrollmentDraft';
  if v_enrollment is not null then
    if pg_catalog.jsonb_typeof(v_enrollment) <> 'object' then return false; end if;
    for v_key in select key from pg_catalog.jsonb_each(v_enrollment)
    loop
      if v_key not in (
        'isReady', 'interestedProgram', 'preferredSchedule', 'learningGoal',
        'expectedStartDate', 'expectedTrialDate', 'childChessLevel',
        'trialDraftId', 'trialAppointmentId', 'trialScheduledAt', 'note',
        'advisorName', 'readyAt', 'createdAt', 'updatedAt'
      ) then
        return false;
      end if;
    end loop;
  end if;

  return true;
end;
$function$;

alter function public.c5_3_is_safe_case_state(jsonb) owner to postgres;
revoke all on function public.c5_3_is_safe_case_state(jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.c5_3_list_crm_shared_truth(p_center_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_role text;
  v_records jsonb;
  v_consultants jsonb;
begin
  v_role := public.c5_3_internal_assert_access(v_center_id, false, false);

  select coalesce(pg_catalog.jsonb_agg(projected.record order by projected.updated_at desc), '[]'::jsonb)
    into v_records
  from (
    select
      greatest(c.updated_at, coalesce(s.updated_at, c.updated_at)) as updated_at,
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'id', coalesce(s.local_source_id, c.consultation_case_id::text),
        'contactType', coalesce(s.safe_state->>'contactType', 'consultingLead'),
        'parentName', coalesce(ct.display_name, 'Khach tu van'),
        'phone', '',
        'secondaryPhone', '',
        'email', '',
        'contactMethodsVisibility', 'MASKED_PROTECTED',
        'identityReadOnly', true,
        'studentName', '',
        'studentId', '',
        'leadStudentName', candidate.display_name_evidence,
        'studentBirthYear', coalesce(s.safe_state->>'studentBirthYear', ''),
        'leadStudentAge', '',
        'leadNeed', coalesce(c.interest_summary, ''),
        'parentFeedbackAboutChild', coalesce(s.safe_state->>'parentFeedbackAboutChild', c.safe_case_summary, ''),
        'consultationStatus', coalesce(s.safe_state->>'consultationStatus', case c.status
          when 'OPEN' then 'newLead' when 'CONSULTING' then 'activeCare'
          when 'PAUSED' then 'paused' when 'READY_FOR_CONVERSION' then 'pendingEnrollment'
          when 'CONVERTED' then 'converted' else 'closed' end),
        'source', coalesce(s.safe_state->>'source', 'unknown'),
        'interestedProgram', coalesce(s.safe_state->>'interestedProgram', ''),
        'preferredSchedule', coalesce(s.safe_state->>'preferredSchedule', ''),
        'locationArea', coalesce(s.safe_state->>'locationArea', ct.safe_location_area, ''),
        'consultedAt', coalesce(s.safe_state->>'consultedAt', ''),
        'registeredAt', coalesce(s.safe_state->>'registeredAt', ''),
        'lastContactAt', latest_care.created_at,
        'lastNote', coalesce(latest_care.payload->>'content', ''),
        'nextAction', coalesce(latest_care.payload->>'nextAction', s.safe_state->>'nextAction', ''),
        'customerStage', coalesce(s.safe_state->>'customerStage', case
          when c.status in ('CONVERTED') then 'converted'
          when c.status = 'OPEN' then 'lead' else 'consulting' end),
        'consultantId', assignment.assigned_consultant_user_id,
        'consultantName', assignment.assigned_consultant_user_id::text,
        'nextFollowUpAt', coalesce(s.safe_state->>'nextFollowUpAt', ''),
        'potentialLevel', coalesce(s.safe_state->>'potentialLevel', ''),
        'careLogs', coalesce(care.logs, '[]'::jsonb),
        'appointments', coalesce(appointment.items, '[]'::jsonb),
        'enrollmentDraft', coalesce(s.safe_state->'enrollmentDraft', '{}'::jsonb)
          || pg_catalog.jsonb_build_object(
            'studentName', coalesce(candidate.display_name_evidence, ''),
            'studentBirthYear', coalesce(s.safe_state->>'studentBirthYear', ''),
            'studentAge', '',
            'parentName', coalesce(ct.display_name, ''),
            'phone', ''
          ),
        'canonicalContactId', ct.crm_contact_id,
        'canonicalCaseId', c.consultation_case_id,
        'canonicalCandidateId', candidate.candidate_student_id,
        'cloudContactVersion', ct.contact_version,
        'cloudCaseVersion', c.case_version,
        'cloudStateVersion', coalesce(s.state_version, 0),
        'cloudCandidateVersion', coalesce(candidate.candidate_version, 0),
        'cloudAssignmentVersion', coalesce(assignment.assignment_version, 0),
        'cloudUpdatedAt', greatest(c.updated_at, coalesce(s.updated_at, c.updated_at)),
        'createdAt', ct.created_at,
        'updatedAt', greatest(c.updated_at, coalesce(s.updated_at, c.updated_at))
      )) as record
    from public.consultation_case c
    join public.crm_contact ct
      on ct.center_id = c.center_id and ct.crm_contact_id = c.primary_contact_id
    left join public.crm_case_shared_state s
      on s.center_id = c.center_id and s.consultation_case_id = c.consultation_case_id
    left join lateral (
      select cs.*
      from public.consultation_case_candidate_student cs
      where cs.center_id = c.center_id and cs.consultation_case_id = c.consultation_case_id
        and cs.candidate_status <> 'DISCARDED'
      order by cs.created_at asc, cs.candidate_student_id asc limit 1
    ) candidate on true
    left join lateral (
      select a.assigned_consultant_user_id, a.assignment_version
      from public.consultation_case_assignment a
      where a.center_id = c.center_id and a.consultation_case_id = c.consultation_case_id
        and a.assignment_id = c.active_assignment_id and a.assignment_status = 'ACTIVE'
      limit 1
    ) assignment on true
    left join lateral (
      select pg_catalog.jsonb_agg(
        public.c5_3_internal_parse_care_log(l.safe_content)
          || pg_catalog.jsonb_build_object(
            'id', l.care_log_id, 'canonicalCareLogId', l.care_log_id,
            'cloudVersion', l.care_log_version, 'createdAt', l.created_at,
            'contactedAt', coalesce(
              public.c5_3_internal_parse_care_log(l.safe_content)->>'contactedAt',
              l.created_at::text
            )
          ) order by l.created_at desc, l.care_log_id desc
      ) as logs
      from public.crm_care_log l
      where l.center_id = c.center_id and l.consultation_case_id = c.consultation_case_id
    ) care on true
    left join lateral (
      select public.c5_3_internal_parse_care_log(l.safe_content) payload, l.created_at
      from public.crm_care_log l
      where l.center_id = c.center_id and l.consultation_case_id = c.consultation_case_id
      order by l.created_at desc, l.care_log_id desc limit 1
    ) latest_care on true
    left join lateral (
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', a.client_appointment_id,
        'canonicalAppointmentId', a.appointment_id,
        'appointmentType', case a.appointment_type
          when 'TRIAL_LESSON' then 'trialLesson' when 'CALLBACK' then 'callback'
          when 'FOLLOW_UP' then 'followUp' when 'OTHER' then 'consultation' end,
        'scheduledAt', a.scheduled_at,
        'channel', pg_catalog.lower(a.channel),
        'location', a.safe_location,
        'status', pg_catalog.lower(a.appointment_status),
        'note', a.safe_note,
        'sourceType', a.source_type,
        'sourceDraftId', a.source_draft_id,
        'cloudVersion', a.appointment_version,
        'createdAt', a.created_at,
        'updatedAt', a.updated_at
      ) order by a.scheduled_at asc, a.appointment_id asc) items
      from public.crm_case_appointment a
      where a.center_id = c.center_id and a.consultation_case_id = c.consultation_case_id
    ) appointment on true
    where c.center_id = v_center_id
      and c.status not in ('ARCHIVED', 'CANCELLED')
      and (
        v_role <> 'consultant'
        or assignment.assigned_consultant_user_id = v_actor_user_id
      )
  ) projected;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'userId', cm.user_id,
    'label', 'Consultant ' || pg_catalog.left(cm.user_id::text, 8)
  ) order by cm.user_id), '[]'::jsonb)
    into v_consultants
  from public.center_members cm
  where cm.center_id = v_center_id
    and cm.status = 'active'
    and pg_catalog.lower(cm.role) = 'consultant'
    and (v_role <> 'consultant' or cm.user_id = v_actor_user_id);

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'CRM_SHARED_TRUTH_READ',
    'center_id', v_center_id,
    'projection_cache_policy', 'MASKED_CACHE_ONLY',
    'records', v_records,
    'eligible_consultants', v_consultants
  );
exception
  when others then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'outcome_code', case
        when sqlerrm in ('CENTER_ACCESS_DENIED', 'CRM_READ_NOT_ACTIVE') then sqlerrm
        else 'CRM_SHARED_TRUTH_READ_FAILED' end
    );
end;
$function$;

alter function public.c5_3_list_crm_shared_truth(text) owner to postgres;
revoke all on function public.c5_3_list_crm_shared_truth(text)
  from public, anon, service_role;
grant execute on function public.c5_3_list_crm_shared_truth(text)
  to authenticated;

commit;
