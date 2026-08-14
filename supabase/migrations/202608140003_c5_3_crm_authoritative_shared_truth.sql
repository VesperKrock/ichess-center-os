begin;

-- C5.3 extends the existing P1-P4A CRM aggregate.  It does not create a
-- second Contact/Case model and does not change the frozen P4B conversion
-- bridge.  Browser callers can only use the authenticated RPCs at the end of
-- this migration; every new table remains service-internal.

create function public.c5_3_contains_protected_identity(p_value text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select coalesce(p_value, '') ~* '[[:alnum:]._%+-]+@[[:alnum:].-]+\.[[:alpha:]]{2,}'
    or coalesce(p_value, '') ~ '(^|[^0-9])((\+?84)|0)[0-9]{8,10}([^0-9]|$)';
$function$;

create function public.c5_3_is_safe_case_state(p_state jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_key text;
  v_enrollment jsonb;
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
      'potentialLevel', 'parentFeedbackAboutChild', 'enrollmentDraft'
    ) then
      return false;
    end if;
  end loop;

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

create table public.crm_case_shared_state (
  center_id text not null,
  consultation_case_id uuid not null,
  local_source_id text not null,
  safe_state jsonb not null default '{}'::jsonb,
  state_version integer not null default 1,
  creation_intent_digest bytea not null,
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint crm_case_shared_state_pkey
    primary key (center_id, consultation_case_id),
  constraint crm_case_shared_state_case_fkey
    foreign key (center_id, consultation_case_id)
    references public.consultation_case(center_id, consultation_case_id) on delete restrict,
  constraint crm_case_shared_state_created_by_fkey
    foreign key (created_by_user_id) references auth.users(id) on delete restrict,
  constraint crm_case_shared_state_updated_by_fkey
    foreign key (updated_by_user_id) references auth.users(id) on delete restrict,
  constraint crm_case_shared_state_source_unique
    unique (center_id, local_source_id),
  constraint crm_case_shared_state_source_check
    check (
      pg_catalog.length(pg_catalog.btrim(local_source_id)) between 1 and 200
      and local_source_id !~ '[[:cntrl:]]'
      and not public.c5_3_contains_protected_identity(local_source_id)
    ),
  constraint crm_case_shared_state_payload_check
    check (public.c5_3_is_safe_case_state(safe_state)),
  constraint crm_case_shared_state_version_check check (state_version >= 1),
  constraint crm_case_shared_state_digest_check
    check (pg_catalog.octet_length(creation_intent_digest) = 32),
  constraint crm_case_shared_state_timestamp_check check (updated_at >= created_at)
);

create table public.crm_case_appointment (
  appointment_id uuid primary key,
  center_id text not null,
  consultation_case_id uuid not null,
  client_appointment_id text not null,
  appointment_type text not null,
  scheduled_at timestamptz not null,
  channel text not null,
  safe_location text not null default '',
  appointment_status text not null default 'SCHEDULED',
  safe_note text not null default '',
  source_type text,
  source_draft_id text,
  appointment_version integer not null default 1,
  created_by_user_id uuid not null,
  updated_by_user_id uuid not null,
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint crm_case_appointment_case_fkey
    foreign key (center_id, consultation_case_id)
    references public.consultation_case(center_id, consultation_case_id) on delete restrict,
  constraint crm_case_appointment_created_by_fkey
    foreign key (created_by_user_id) references auth.users(id) on delete restrict,
  constraint crm_case_appointment_updated_by_fkey
    foreign key (updated_by_user_id) references auth.users(id) on delete restrict,
  constraint crm_case_appointment_center_id_key
    unique (center_id, appointment_id),
  constraint crm_case_appointment_client_id_key
    unique (center_id, consultation_case_id, client_appointment_id),
  constraint crm_case_appointment_client_id_check
    check (
      pg_catalog.length(pg_catalog.btrim(client_appointment_id)) between 1 and 200
      and client_appointment_id !~ '[[:cntrl:]]'
      and not public.c5_3_contains_protected_identity(client_appointment_id)
    ),
  constraint crm_case_appointment_type_check
    check (appointment_type in ('CONSULTATION', 'TRIAL_LESSON', 'CALLBACK', 'FOLLOW_UP', 'OTHER')),
  constraint crm_case_appointment_channel_check
    check (channel in ('PHONE', 'ZALO', 'FACEBOOK', 'DIRECT', 'EMAIL', 'NOTE', 'OTHER')),
  constraint crm_case_appointment_status_check
    check (appointment_status in ('SCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED', 'RESCHEDULED')),
  constraint crm_case_appointment_safe_text_check
    check (
      pg_catalog.length(safe_location) <= 500
      and pg_catalog.length(safe_note) <= 2000
      and not public.c5_3_contains_protected_identity(safe_location)
      and not public.c5_3_contains_protected_identity(safe_note)
    ),
  constraint crm_case_appointment_source_shape_check
    check (
      (source_type is null and source_draft_id is null)
      or (
        source_type is not null and source_draft_id is not null
        and pg_catalog.length(pg_catalog.btrim(source_type)) between 1 and 80
        and pg_catalog.length(pg_catalog.btrim(source_draft_id)) between 1 and 200
        and source_type !~ '[[:cntrl:]]' and source_draft_id !~ '[[:cntrl:]]'
        and not public.c5_3_contains_protected_identity(source_type)
        and not public.c5_3_contains_protected_identity(source_draft_id)
      )
    ),
  constraint crm_case_appointment_version_check check (appointment_version >= 1),
  constraint crm_case_appointment_timestamp_check check (updated_at >= created_at)
);

create unique index crm_case_appointment_source_unique_idx
  on public.crm_case_appointment (center_id, consultation_case_id, source_type, source_draft_id)
  where source_type is not null and source_draft_id is not null;
create index crm_case_appointment_case_scheduled_idx
  on public.crm_case_appointment (center_id, consultation_case_id, scheduled_at, appointment_id);

create table public.crm_shared_command_result (
  command_result_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  intent_digest bytea not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint crm_shared_command_result_scope_unique
    unique (center_id, actor_user_id, idempotency_key),
  constraint crm_shared_command_result_digest_check
    check (pg_catalog.octet_length(intent_digest) = 32),
  constraint crm_shared_command_result_snapshot_check
    check (
      pg_catalog.jsonb_typeof(result_snapshot) = 'object'
      and result_snapshot->>'outcome_code' = 'COMMITTED'
    )
);

alter table public.crm_case_shared_state enable row level security;
alter table public.crm_case_shared_state force row level security;
alter table public.crm_case_appointment enable row level security;
alter table public.crm_case_appointment force row level security;
alter table public.crm_shared_command_result enable row level security;
alter table public.crm_shared_command_result force row level security;

revoke all on table public.crm_case_shared_state from public, anon, authenticated, service_role;
revoke all on table public.crm_case_appointment from public, anon, authenticated, service_role;
revoke all on table public.crm_shared_command_result from public, anon, authenticated, service_role;

create function public.c5_3_internal_assert_access(
  p_center_id text,
  p_write_required boolean,
  p_admin_required boolean default false
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_role text;
  v_root public.center_crm_control%rowtype;
begin
  if v_actor_user_id is null
     or p_center_id is null
     or p_center_id = ''
     or p_center_id <> pg_catalog.btrim(p_center_id)
     or pg_catalog.length(p_center_id) > 160 then
    raise exception using errcode = '42501', message = 'CENTER_ACCESS_DENIED';
  end if;

  select r.* into v_root
  from public.center_crm_control r
  join public.centers c on c.id = r.center_id and pg_catalog.lower(c.status) = 'active'
  where r.center_id = p_center_id
  for share of r, c;
  if not found then
    raise exception using errcode = '42501', message = 'CENTER_ACCESS_DENIED';
  end if;

  select pg_catalog.lower(cm.role) into v_role
  from public.center_members cm
  where cm.center_id = p_center_id
    and cm.user_id = v_actor_user_id
    and cm.status = 'active'
  for share of cm;

  if not found or v_role not in ('owner', 'admin', 'center_admin', 'qtv', 'consultant') then
    raise exception using errcode = '42501', message = 'CENTER_ACCESS_DENIED';
  end if;

  if p_write_required then
    if v_root.crm_state <> 'ACTIVE' or v_root.feature_flag_state <> 'ENABLED' then
      raise exception using errcode = '42501', message = 'CRM_RUNTIME_NOT_ACTIVE';
    end if;
  elsif v_root.crm_state not in ('READ_ONLY', 'ACTIVE')
     or v_root.feature_flag_state not in ('READ_ONLY', 'ENABLED') then
    raise exception using errcode = '42501', message = 'CRM_READ_NOT_ACTIVE';
  end if;

  if p_admin_required and v_role not in ('owner', 'admin', 'center_admin', 'qtv') then
    raise exception using errcode = '42501', message = 'WRITE_ROLE_REQUIRED';
  end if;

  return v_role;
end;
$function$;

create function public.c5_3_internal_case_status(p_workflow_status text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case p_workflow_status
    when 'newLead' then 'OPEN'
    when 'activeCare' then 'CONSULTING'
    when 'waitingResponse' then 'CONSULTING'
    when 'trialScheduled' then 'CONSULTING'
    when 'pendingEnrollment' then 'READY_FOR_CONVERSION'
    when 'paused' then 'PAUSED'
    when 'closed' then 'LOST'
    else null
  end;
$function$;

create function public.c5_3_internal_parse_care_log(p_safe_content text)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $function$
declare v_value jsonb;
begin
  begin
    v_value := p_safe_content::jsonb;
    if pg_catalog.jsonb_typeof(v_value) = 'object' then return v_value; end if;
  exception when others then
    null;
  end;
  return pg_catalog.jsonb_build_object('content', p_safe_content);
end;
$function$;

create function public.c5_3_internal_assert_case_scope(
  p_center_id text,
  p_case_id uuid,
  p_role text,
  p_actor_user_id uuid
)
returns public.consultation_case
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_case public.consultation_case%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
begin
  select c.* into v_case
  from public.consultation_case c
  where c.center_id = p_center_id and c.consultation_case_id = p_case_id
  for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND_OR_DENIED'; end if;

  if p_role = 'consultant' then
    select a.* into v_assignment
    from public.consultation_case_assignment a
    where a.center_id = p_center_id
      and a.consultation_case_id = p_case_id
      and a.assignment_id = v_case.active_assignment_id
      and a.assignment_status = 'ACTIVE'
      and a.assigned_consultant_user_id = p_actor_user_id
    for share;
    if not found then raise exception 'RESOURCE_NOT_FOUND_OR_DENIED'; end if;
  end if;

  return v_case;
end;
$function$;

create function public.c5_3_internal_upsert_appointment(
  p_center_id text,
  p_case_id uuid,
  p_actor_user_id uuid,
  p_appointment jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row public.crm_case_appointment%rowtype;
  v_appointment_id uuid;
  v_client_id text;
  v_expected integer;
  v_type text;
  v_channel text;
  v_status text;
  v_scheduled_at timestamptz;
  v_location text;
  v_note text;
  v_source_type text;
  v_source_draft_id text;
  v_previous integer;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
begin
  if p_appointment is null or pg_catalog.jsonb_typeof(p_appointment) <> 'object'
     or coalesce(p_appointment->>'appointment_id', '') !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
     or coalesce(p_appointment->>'expected_version', '') !~ '^[0-9]+$' then
    raise exception 'INVALID_APPOINTMENT';
  end if;

  v_appointment_id := (p_appointment->>'appointment_id')::uuid;
  v_client_id := pg_catalog.btrim(coalesce(p_appointment->>'client_appointment_id', ''));
  v_expected := (p_appointment->>'expected_version')::integer;
  v_type := pg_catalog.upper(pg_catalog.btrim(coalesce(p_appointment->>'appointment_type', '')));
  v_channel := pg_catalog.upper(pg_catalog.btrim(coalesce(p_appointment->>'channel', '')));
  v_status := pg_catalog.upper(pg_catalog.btrim(coalesce(p_appointment->>'status', 'SCHEDULED')));
  v_location := pg_catalog.btrim(coalesce(p_appointment->>'location', ''));
  v_note := pg_catalog.btrim(coalesce(p_appointment->>'note', ''));
  v_source_type := nullif(pg_catalog.btrim(coalesce(p_appointment->>'source_type', '')), '');
  v_source_draft_id := nullif(pg_catalog.btrim(coalesce(p_appointment->>'source_draft_id', '')), '');
  begin v_scheduled_at := (p_appointment->>'scheduled_at')::timestamptz;
  exception when others then raise exception 'INVALID_APPOINTMENT'; end;

  if v_client_id = '' or pg_catalog.length(v_client_id) > 200
     or public.c5_3_contains_protected_identity(v_client_id)
     or v_type not in ('CONSULTATION', 'TRIAL_LESSON', 'CALLBACK', 'FOLLOW_UP', 'OTHER')
     or v_channel not in ('PHONE', 'ZALO', 'FACEBOOK', 'DIRECT', 'EMAIL', 'NOTE', 'OTHER')
     or v_status not in ('SCHEDULED', 'COMPLETED', 'MISSED', 'CANCELLED', 'RESCHEDULED')
     or pg_catalog.length(v_location) > 500 or pg_catalog.length(v_note) > 2000
     or public.c5_3_contains_protected_identity(v_location)
     or public.c5_3_contains_protected_identity(v_note)
     or public.c5_3_contains_protected_identity(coalesce(v_source_type, ''))
     or public.c5_3_contains_protected_identity(coalesce(v_source_draft_id, ''))
     or ((v_source_type is null) <> (v_source_draft_id is null)) then
    raise exception 'INVALID_APPOINTMENT';
  end if;

  select a.* into v_row
  from public.crm_case_appointment a
  where a.center_id = p_center_id
    and a.consultation_case_id = p_case_id
    and (a.appointment_id = v_appointment_id or a.client_appointment_id = v_client_id)
  order by case when a.appointment_id = v_appointment_id then 0 else 1 end
  limit 1
  for update;

  if not found then
    if v_expected <> 0 then raise exception 'APPOINTMENT_VERSION_STALE'; end if;
    insert into public.crm_case_appointment (
      appointment_id, center_id, consultation_case_id, client_appointment_id,
      appointment_type, scheduled_at, channel, safe_location,
      appointment_status, safe_note, source_type, source_draft_id,
      created_by_user_id, updated_by_user_id
    ) values (
      v_appointment_id, p_center_id, p_case_id, v_client_id,
      v_type, v_scheduled_at, v_channel, v_location,
      v_status, v_note, v_source_type, v_source_draft_id,
      p_actor_user_id, p_actor_user_id
    ) returning * into v_row;
    perform public.f23_3e_p1d_internal_append_audit_outbox(
      p_center_id, 'crm.appointment.created', p_actor_user_id,
      'crm_case_appointment', v_row.appointment_id, null, null, 1,
      v_row.appointment_status, null, 'APPOINTMENT_CREATED', v_correlation_id
    );
  else
    if v_row.appointment_version <> v_expected then
      raise exception 'APPOINTMENT_VERSION_STALE';
    end if;
    v_previous := v_row.appointment_version;
    update public.crm_case_appointment a
    set appointment_type = v_type,
        scheduled_at = v_scheduled_at,
        channel = v_channel,
        safe_location = v_location,
        appointment_status = v_status,
        safe_note = v_note,
        source_type = v_source_type,
        source_draft_id = v_source_draft_id,
        appointment_version = a.appointment_version + 1,
        updated_by_user_id = p_actor_user_id,
        updated_at = pg_catalog.transaction_timestamp()
    where a.appointment_id = v_row.appointment_id
    returning * into v_row;
    perform public.f23_3e_p1d_internal_append_audit_outbox(
      p_center_id, 'crm.appointment.updated', p_actor_user_id,
      'crm_case_appointment', v_row.appointment_id, null, v_previous,
      v_row.appointment_version, v_row.appointment_status, null,
      'APPOINTMENT_UPDATED', v_correlation_id
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'appointment_id', v_row.appointment_id,
    'appointment_version', v_row.appointment_version
  );
end;
$function$;

create function public.c5_3_list_crm_shared_truth(p_center_id text)
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
        'studentBirthYear', '',
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
            'studentBirthYear', '',
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
          when 'FOLLOW_UP' then 'followUp' when 'OTHER' then 'other' else 'consultation' end,
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

create function public.c5_3_mutate_crm_shared_truth(
  p_center_id text,
  p_command jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_role text;
  v_operation text;
  v_intent_digest bytea;
  v_business_digest bytea;
  v_existing_result public.crm_shared_command_result%rowtype;
  v_result jsonb;
  v_failure text;
  v_contact_result record;
  v_service_result record;
  v_contact public.crm_contact%rowtype;
  v_case public.consultation_case%rowtype;
  v_state public.crm_case_shared_state%rowtype;
  v_candidate public.consultation_case_candidate_student%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_case_id uuid;
  v_contact_id uuid;
  v_candidate_id uuid;
  v_expected_case integer;
  v_expected_state integer;
  v_expected_candidate integer;
  v_target_status text;
  v_safe_state jsonb;
  v_local_source_id text;
  v_display_name text;
  v_lead_student_name text;
  v_interest_summary text;
  v_safe_summary text;
  v_previous integer;
  v_correlation_id uuid;
  v_item jsonb;
  v_appointment_result jsonb;
  v_care_payload jsonb;
  v_care_id uuid;
  v_care_kind text;
begin
  if v_actor_user_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED');
  end if;
  if p_idempotency_key is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_IDEMPOTENCY_KEY');
  end if;
  if p_command is null or pg_catalog.jsonb_typeof(p_command) <> 'object'
     or pg_catalog.octet_length(pg_catalog.convert_to(p_command::text, 'UTF8')) > 262144 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;

  v_operation := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', '')));
  if v_operation not in (
    'CREATE_LEAD', 'SAVE_CASE', 'APPEND_CARE_LOG',
    'UPSERT_APPOINTMENT', 'ASSIGN_CASE', 'ARCHIVE_CASE'
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_OPERATION');
  end if;

  begin
    v_role := public.c5_3_internal_assert_access(
      v_center_id,
      true,
      v_operation in ('CREATE_LEAD', 'SAVE_CASE', 'ASSIGN_CASE', 'ARCHIVE_CASE')
    );
  exception when others then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', sqlerrm);
  end;

  v_intent_digest := extensions.digest(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'contract_version', 1, 'center_id', v_center_id, 'command', p_command
    )::text, 'UTF8'), 'sha256'
  );

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'c5.3.crm.command|' || v_center_id || '|' || v_actor_user_id::text || '|' || p_idempotency_key::text,
    0
  ));
  select r.* into v_existing_result
  from public.crm_shared_command_result r
  where r.center_id = v_center_id
    and r.actor_user_id = v_actor_user_id
    and r.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing_result.intent_digest <> v_intent_digest then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return v_existing_result.result_snapshot || pg_catalog.jsonb_build_object('replayed', true);
  end if;

  begin
    if v_operation = 'CREATE_LEAD' then
      v_local_source_id := pg_catalog.btrim(coalesce(p_command->>'local_source_id', ''));
      v_display_name := pg_catalog.btrim(coalesce(p_command#>>'{contact,display_name}', ''));
      v_safe_state := coalesce(p_command->'safe_state', '{}'::jsonb);
      v_lead_student_name := nullif(pg_catalog.btrim(coalesce(p_command->>'lead_student_name', '')), '');
      v_interest_summary := nullif(pg_catalog.btrim(coalesce(p_command->>'interest_summary', '')), '');
      v_safe_summary := nullif(pg_catalog.btrim(coalesce(p_command->>'safe_summary', '')), '');
      if v_local_source_id = '' or pg_catalog.length(v_local_source_id) > 200
         or public.c5_3_contains_protected_identity(v_local_source_id)
         or v_display_name = '' or pg_catalog.length(v_display_name) > 240
         or not public.c5_3_is_safe_case_state(v_safe_state)
         or public.c5_3_contains_protected_identity(coalesce(v_interest_summary, ''))
         or public.c5_3_contains_protected_identity(coalesce(v_safe_summary, ''))
         or (v_lead_student_name is not null and pg_catalog.length(v_lead_student_name) > 240) then
        raise exception 'C5_3_ABORT:INVALID_PAYLOAD';
      end if;
      if pg_catalog.jsonb_typeof(p_command#>'{contact,phones}') <> 'array'
         or pg_catalog.jsonb_typeof(p_command#>'{contact,emails}') <> 'array'
         or (
           pg_catalog.jsonb_array_length(p_command#>'{contact,phones}') = 0
           and pg_catalog.jsonb_array_length(p_command#>'{contact,emails}') = 0
         ) then
        raise exception 'C5_3_ABORT:CONTACT_METHOD_REQUIRED';
      end if;

      v_business_digest := extensions.digest(pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'local_source_id', v_local_source_id,
          'contact', p_command->'contact',
          'safe_state', v_safe_state,
          'lead_student_name', v_lead_student_name,
          'interest_summary', v_interest_summary,
          'safe_summary', v_safe_summary
        )::text, 'UTF8'), 'sha256');

      select s.* into v_state
      from public.crm_case_shared_state s
      where s.center_id = v_center_id and s.local_source_id = v_local_source_id
      for update;
      if found then
        if v_state.creation_intent_digest <> v_business_digest then
          raise exception 'C5_3_ABORT:SOURCE_IDENTITY_CONFLICT';
        end if;
        v_result := pg_catalog.jsonb_build_object(
          'ok', true, 'outcome_code', 'COMMITTED', 'business_replayed', true,
          'case_id', v_state.consultation_case_id,
          'state_version', v_state.state_version
        );
      else
        select * into v_contact_result
        from public.f23_3e_p4a_ingress_canonical_contact(
          v_center_id,
          v_actor_user_id,
          v_local_source_id,
          v_display_name,
          array(select pg_catalog.jsonb_array_elements_text(p_command#>'{contact,phones}')),
          array(select pg_catalog.jsonb_array_elements_text(p_command#>'{contact,emails}'))
        );
        if not coalesce(v_contact_result.ok, false) then
          raise exception 'C5_3_ABORT:%', coalesce(v_contact_result.outcome_code, 'CONTACT_INGRESS_FAILED');
        end if;
        v_contact_id := v_contact_result.crm_contact_id;
        if coalesce(p_command->>'case_id', '') !~
          '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
          raise exception 'C5_3_ABORT:INVALID_CASE_ID';
        end if;
        v_case_id := (p_command->>'case_id')::uuid;
        select * into v_service_result
        from public.f23_3e_p1d_create_consultation_case(
          v_case_id, v_contact_id, v_actor_user_id, v_contact_result.contact_version
        );
        if not coalesce(v_service_result.ok, false) then
          raise exception 'C5_3_ABORT:CASE_CREATE_%', coalesce(v_service_result.outcome_code, 'FAILED');
        end if;

        v_target_status := public.c5_3_internal_case_status(v_safe_state->>'consultationStatus');
        if v_target_status is null then raise exception 'C5_3_ABORT:INVALID_WORKFLOW_STATUS'; end if;
        if v_target_status = 'READY_FOR_CONVERSION' then
          select * into v_service_result
          from public.f23_3e_p1d_transition_consultation_case_status(
            v_case_id, v_actor_user_id, v_service_result.case_version,
            'CONSULTING', 'c5_3_shared_truth_create'
          );
          if not v_service_result.ok then raise exception 'C5_3_ABORT:%', v_service_result.outcome_code; end if;
        end if;
        if v_target_status <> 'OPEN' then
          select * into v_service_result
          from public.f23_3e_p1d_transition_consultation_case_status(
            v_case_id, v_actor_user_id, v_service_result.case_version,
            v_target_status, 'c5_3_shared_truth_create'
          );
          if not v_service_result.ok then raise exception 'C5_3_ABORT:%', v_service_result.outcome_code; end if;
        end if;

        select c.* into strict v_case from public.consultation_case c
        where c.center_id = v_center_id and c.consultation_case_id = v_case_id for update;
        if v_interest_summary is not null or v_safe_summary is not null then
          v_previous := v_case.case_version;
          update public.consultation_case c
          set interest_summary = v_interest_summary,
              safe_case_summary = v_safe_summary,
              case_version = c.case_version + 1
          where c.consultation_case_id = v_case_id returning c.* into v_case;
          v_correlation_id := pg_catalog.gen_random_uuid();
          perform public.f23_3e_p1d_internal_append_audit_outbox(
            v_center_id, 'crm.case.shared_state_created', v_actor_user_id,
            'consultation_case', v_case_id, null, v_previous, v_case.case_version,
            v_case.status, null, 'CRM_SHARED_STATE_CREATED', v_correlation_id
          );
        end if;

        insert into public.crm_case_shared_state (
          center_id, consultation_case_id, local_source_id, safe_state,
          creation_intent_digest, created_by_user_id, updated_by_user_id
        ) values (
          v_center_id, v_case_id, v_local_source_id, v_safe_state,
          v_business_digest, v_actor_user_id, v_actor_user_id
        ) returning * into v_state;

        if v_lead_student_name is not null then
          v_candidate_id := coalesce(
            case when coalesce(p_command->>'candidate_id', '') ~
              '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
              then (p_command->>'candidate_id')::uuid end,
            pg_catalog.gen_random_uuid()
          );
          insert into public.consultation_case_candidate_student (
            candidate_student_id, center_id, consultation_case_id,
            display_name_evidence, learning_need_summary, preferred_schedule_summary
          ) values (
            v_candidate_id, v_center_id, v_case_id, v_lead_student_name,
            v_interest_summary, nullif(v_safe_state->>'preferredSchedule', '')
          );
        end if;

        if pg_catalog.jsonb_typeof(p_command->'initial_care_log') = 'object' then
          v_care_payload := p_command->'initial_care_log';
          v_care_id := (v_care_payload->>'care_log_id')::uuid;
          v_care_kind := pg_catalog.upper(coalesce(v_care_payload->>'entry_type', 'NOTE'));
          select * into v_service_result
          from public.f23_3e_p1d_append_crm_care_log(
            v_care_id, v_case_id, v_actor_user_id, v_care_kind,
            (v_care_payload->'payload')::text
          );
          if not v_service_result.ok then raise exception 'C5_3_ABORT:%', v_service_result.outcome_code; end if;
        end if;

        if p_command ? 'appointments' then
          if pg_catalog.jsonb_typeof(p_command->'appointments') <> 'array'
             or pg_catalog.jsonb_array_length(p_command->'appointments') > 20 then
            raise exception 'C5_3_ABORT:INVALID_APPOINTMENT';
          end if;
          for v_item in select value from pg_catalog.jsonb_array_elements(p_command->'appointments')
          loop
            v_appointment_result := public.c5_3_internal_upsert_appointment(
              v_center_id, v_case_id, v_actor_user_id, v_item
            );
          end loop;
        end if;

        v_result := pg_catalog.jsonb_build_object(
          'ok', true, 'outcome_code', 'COMMITTED', 'business_replayed', false,
          'contact_id', v_contact_id, 'case_id', v_case_id,
          'case_version', v_case.case_version, 'state_version', v_state.state_version
        );
      end if;

    elsif v_operation = 'SAVE_CASE' then
      v_case_id := (p_command->>'case_id')::uuid;
      v_expected_case := (p_command->>'expected_case_version')::integer;
      v_expected_state := (p_command->>'expected_state_version')::integer;
      v_expected_candidate := (p_command->>'expected_candidate_version')::integer;
      v_local_source_id := pg_catalog.btrim(coalesce(
        nullif(p_command->>'local_source_id', ''), v_case_id::text
      ));
      v_safe_state := coalesce(p_command->'safe_state', '{}'::jsonb);
      v_lead_student_name := nullif(pg_catalog.btrim(coalesce(p_command->>'lead_student_name', '')), '');
      v_interest_summary := nullif(pg_catalog.btrim(coalesce(p_command->>'interest_summary', '')), '');
      v_safe_summary := nullif(pg_catalog.btrim(coalesce(p_command->>'safe_summary', '')), '');
      if v_expected_case < 1 or v_expected_state < 0 or v_expected_candidate < 0
         or pg_catalog.length(v_local_source_id) > 200
         or public.c5_3_contains_protected_identity(v_local_source_id)
         or not public.c5_3_is_safe_case_state(v_safe_state)
         or public.c5_3_contains_protected_identity(coalesce(v_interest_summary, ''))
         or public.c5_3_contains_protected_identity(coalesce(v_safe_summary, '')) then
        raise exception 'C5_3_ABORT:INVALID_PAYLOAD';
      end if;
      v_case := public.c5_3_internal_assert_case_scope(v_center_id, v_case_id, v_role, v_actor_user_id);
      if v_case.case_version <> v_expected_case then raise exception 'C5_3_ABORT:CASE_VERSION_STALE'; end if;
      if v_case.status in ('CONVERTED', 'LOST', 'CANCELLED', 'ARCHIVED') then
        raise exception 'C5_3_ABORT:RESOURCE_STATE_CONFLICT';
      end if;
      v_target_status := public.c5_3_internal_case_status(v_safe_state->>'consultationStatus');
      if v_target_status is null then raise exception 'C5_3_ABORT:INVALID_WORKFLOW_STATUS'; end if;

      select s.* into v_state from public.crm_case_shared_state s
      where s.center_id = v_center_id and s.consultation_case_id = v_case_id for update;
      if found and v_state.state_version <> v_expected_state then
        raise exception 'C5_3_ABORT:STATE_VERSION_STALE';
      elsif not found and v_expected_state <> 0 then
        raise exception 'C5_3_ABORT:STATE_VERSION_STALE';
      end if;

      select cs.* into v_candidate
      from public.consultation_case_candidate_student cs
      where cs.center_id = v_center_id and cs.consultation_case_id = v_case_id
        and cs.candidate_status <> 'DISCARDED'
      order by cs.created_at asc, cs.candidate_student_id asc limit 1 for update;
      if found and v_candidate.candidate_version <> v_expected_candidate then
        raise exception 'C5_3_ABORT:CANDIDATE_VERSION_STALE';
      elsif not found and v_expected_candidate <> 0 then
        raise exception 'C5_3_ABORT:CANDIDATE_VERSION_STALE';
      end if;

      -- Preserve the canonical P1D state machine.  C5.3 owns the shared
      -- projection fields, but it must not invent a second Case transition
      -- path or bypass active-assignment/final-state guards.
      if v_case.status <> v_target_status then
        select * into v_service_result
        from public.f23_3e_p1d_transition_consultation_case_status(
          v_case_id, v_actor_user_id, v_case.case_version,
          v_target_status, 'c5_3_shared_truth_save'
        );
        if not v_service_result.ok then
          raise exception 'C5_3_ABORT:%', v_service_result.outcome_code;
        end if;
        select c.* into strict v_case
        from public.consultation_case c
        where c.center_id = v_center_id and c.consultation_case_id = v_case_id
        for update;
      end if;

      v_previous := v_case.case_version;
      update public.consultation_case c
      set interest_summary = v_interest_summary,
          safe_case_summary = v_safe_summary,
          case_version = c.case_version + 1
      where c.center_id = v_center_id and c.consultation_case_id = v_case_id
      returning c.* into v_case;
      v_correlation_id := pg_catalog.gen_random_uuid();
      perform public.f23_3e_p1d_internal_append_audit_outbox(
        v_center_id, 'crm.case.shared_state_updated', v_actor_user_id,
        'consultation_case', v_case_id, v_case.active_assignment_id,
        v_previous, v_case.case_version, v_case.status, null,
        'CRM_SHARED_STATE_UPDATED', v_correlation_id
      );

      if v_state.consultation_case_id is null then
        insert into public.crm_case_shared_state (
          center_id, consultation_case_id, local_source_id, safe_state,
          creation_intent_digest, created_by_user_id, updated_by_user_id
        ) values (
          v_center_id, v_case_id, v_local_source_id,
          v_safe_state, v_intent_digest, v_actor_user_id, v_actor_user_id
        ) returning * into v_state;
      else
        update public.crm_case_shared_state s
        set safe_state = v_safe_state,
            state_version = s.state_version + 1,
            updated_by_user_id = v_actor_user_id,
            updated_at = pg_catalog.transaction_timestamp()
        where s.center_id = v_center_id and s.consultation_case_id = v_case_id
        returning * into v_state;
      end if;

      if v_lead_student_name is not null then
        if v_candidate.candidate_student_id is null then
          v_candidate_id := coalesce(
            case when coalesce(p_command->>'candidate_id', '') ~
              '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
              then (p_command->>'candidate_id')::uuid end,
            pg_catalog.gen_random_uuid()
          );
          insert into public.consultation_case_candidate_student (
            candidate_student_id, center_id, consultation_case_id,
            display_name_evidence, learning_need_summary, preferred_schedule_summary
          ) values (
            v_candidate_id, v_center_id, v_case_id, v_lead_student_name,
            v_interest_summary, nullif(v_safe_state->>'preferredSchedule', '')
          ) returning * into v_candidate;
        else
          update public.consultation_case_candidate_student cs
          set display_name_evidence = v_lead_student_name,
              learning_need_summary = v_interest_summary,
              preferred_schedule_summary = nullif(v_safe_state->>'preferredSchedule', ''),
              candidate_version = cs.candidate_version + 1
          where cs.candidate_student_id = v_candidate.candidate_student_id
          returning * into v_candidate;
        end if;
      end if;

      if p_command ? 'appointment' then
        v_appointment_result := public.c5_3_internal_upsert_appointment(
          v_center_id, v_case_id, v_actor_user_id, p_command->'appointment'
        );
      end if;
      v_result := pg_catalog.jsonb_build_object(
        'ok', true, 'outcome_code', 'COMMITTED', 'case_id', v_case_id,
        'case_version', v_case.case_version, 'state_version', v_state.state_version,
        'candidate_version', coalesce(v_candidate.candidate_version, 0),
        'appointment', v_appointment_result
      );

    elsif v_operation = 'APPEND_CARE_LOG' then
      v_case_id := (p_command->>'case_id')::uuid;
      v_expected_case := (p_command->>'expected_case_version')::integer;
      v_case := public.c5_3_internal_assert_case_scope(v_center_id, v_case_id, v_role, v_actor_user_id);
      if v_case.case_version <> v_expected_case then raise exception 'C5_3_ABORT:CASE_VERSION_STALE'; end if;
      if v_case.status in ('CONVERTED', 'LOST', 'CANCELLED', 'ARCHIVED') then
        raise exception 'C5_3_ABORT:RESOURCE_STATE_CONFLICT';
      end if;
      v_care_payload := p_command->'care_log';
      v_care_id := (v_care_payload->>'care_log_id')::uuid;
      v_care_kind := pg_catalog.upper(coalesce(v_care_payload->>'entry_type', 'NOTE'));
      if pg_catalog.jsonb_typeof(v_care_payload->'payload') <> 'object' then
        raise exception 'C5_3_ABORT:INVALID_CARE_LOG';
      end if;
      select * into v_service_result
      from public.f23_3e_p1d_append_crm_care_log(
        v_care_id, v_case_id, v_actor_user_id, v_care_kind,
        (v_care_payload->'payload')::text
      );
      if not v_service_result.ok then raise exception 'C5_3_ABORT:%', v_service_result.outcome_code; end if;
      v_result := pg_catalog.jsonb_build_object(
        'ok', true, 'outcome_code', 'COMMITTED', 'case_id', v_case_id,
        'case_version', v_case.case_version, 'care_log_id', v_care_id
      );

    elsif v_operation = 'UPSERT_APPOINTMENT' then
      v_case_id := (p_command->>'case_id')::uuid;
      v_expected_case := (p_command->>'expected_case_version')::integer;
      v_case := public.c5_3_internal_assert_case_scope(v_center_id, v_case_id, v_role, v_actor_user_id);
      if v_case.case_version <> v_expected_case then raise exception 'C5_3_ABORT:CASE_VERSION_STALE'; end if;
      if v_case.status in ('CONVERTED', 'LOST', 'CANCELLED', 'ARCHIVED') then
        raise exception 'C5_3_ABORT:RESOURCE_STATE_CONFLICT';
      end if;
      v_appointment_result := public.c5_3_internal_upsert_appointment(
        v_center_id, v_case_id, v_actor_user_id, p_command->'appointment'
      );
      v_result := pg_catalog.jsonb_build_object(
        'ok', true, 'outcome_code', 'COMMITTED', 'case_id', v_case_id,
        'case_version', v_case.case_version, 'appointment', v_appointment_result
      );

    elsif v_operation = 'ASSIGN_CASE' then
      v_case_id := (p_command->>'case_id')::uuid;
      v_expected_case := (p_command->>'expected_case_version')::integer;
      v_case := public.c5_3_internal_assert_case_scope(v_center_id, v_case_id, v_role, v_actor_user_id);
      if v_case.case_version <> v_expected_case then raise exception 'C5_3_ABORT:CASE_VERSION_STALE'; end if;
      if v_case.active_assignment_id is null then
        select * into v_service_result
        from public.f23_3e_p1d_assign_consultation_case(
          (p_command->>'new_assignment_id')::uuid, v_case_id, v_actor_user_id,
          (p_command->>'target_consultant_user_id')::uuid, v_expected_case
        );
      else
        select a.* into strict v_assignment from public.consultation_case_assignment a
        where a.center_id = v_center_id and a.consultation_case_id = v_case_id
          and a.assignment_id = v_case.active_assignment_id for update;
        if v_assignment.assignment_version <> (p_command->>'expected_assignment_version')::integer then
          raise exception 'C5_3_ABORT:ASSIGNMENT_VERSION_STALE';
        end if;
        select * into v_service_result
        from public.f23_3e_p1d_reassign_consultation_case(
          (p_command->>'new_assignment_id')::uuid, v_case_id, v_actor_user_id,
          (p_command->>'target_consultant_user_id')::uuid, v_expected_case,
          v_assignment.assignment_id, v_assignment.assignment_version,
          'c5_3_shared_truth_reassign'
        );
      end if;
      if not v_service_result.ok then raise exception 'C5_3_ABORT:%', v_service_result.outcome_code; end if;
      v_result := pg_catalog.jsonb_build_object(
        'ok', true, 'outcome_code', 'COMMITTED', 'case_id', v_case_id,
        'case_version', v_service_result.case_version,
        'assignment_id', v_service_result.assignment_id,
        'assignment_version', v_service_result.assignment_version
      );

    elsif v_operation = 'ARCHIVE_CASE' then
      v_case_id := (p_command->>'case_id')::uuid;
      v_expected_case := (p_command->>'expected_case_version')::integer;
      v_case := public.c5_3_internal_assert_case_scope(v_center_id, v_case_id, v_role, v_actor_user_id);
      if v_case.case_version <> v_expected_case then raise exception 'C5_3_ABORT:CASE_VERSION_STALE'; end if;
      if v_case.status in ('CONVERTED', 'LOST', 'CANCELLED', 'ARCHIVED') then
        raise exception 'C5_3_ABORT:RESOURCE_STATE_CONFLICT';
      end if;
      select * into v_service_result
      from public.f23_3e_p1d_transition_consultation_case_status(
        v_case_id, v_actor_user_id, v_expected_case,
        case when v_case.status = 'READY_FOR_CONVERSION' then 'CANCELLED' else 'ARCHIVED' end,
        'c5_3_user_archive'
      );
      if not v_service_result.ok then raise exception 'C5_3_ABORT:%', v_service_result.outcome_code; end if;
      v_result := pg_catalog.jsonb_build_object(
        'ok', true, 'outcome_code', 'COMMITTED', 'case_id', v_case_id,
        'case_version', v_service_result.case_version, 'archived', true
      );
    end if;
  exception
    when others then
      v_failure := case
        when sqlerrm like 'C5_3_ABORT:%' then pg_catalog.substr(sqlerrm, 12)
        when sqlerrm in (
          'INVALID_INPUT', 'RESOURCE_NOT_AVAILABLE', 'LOOKUP_CONTROL_UNAVAILABLE',
          'INGRESS_CONFLICT', 'CONTACT_VERSION_STALE', 'INVALID_APPOINTMENT',
          'APPOINTMENT_VERSION_STALE', 'RESOURCE_NOT_FOUND_OR_DENIED'
        ) then sqlerrm
        when sqlerrm like 'f23_3e_p1a_invalid_case_transition:%' then 'INVALID_STATE_TRANSITION'
        else 'CRM_COMMAND_FAILED'
      end;
  end;

  if v_failure is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', v_failure);
  end if;

  insert into public.crm_shared_command_result (
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (
    v_center_id, v_actor_user_id, p_idempotency_key, v_intent_digest, v_result
  );
  return v_result || pg_catalog.jsonb_build_object('replayed', false);
exception
  when unique_violation then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CONCURRENT_CONFLICT');
  when others then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CRM_COMMAND_FAILED');
end;
$function$;

revoke all on function public.c5_3_contains_protected_identity(text)
  from public, anon, authenticated, service_role;
revoke all on function public.c5_3_is_safe_case_state(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.c5_3_internal_assert_access(text, boolean, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.c5_3_internal_case_status(text)
  from public, anon, authenticated, service_role;
revoke all on function public.c5_3_internal_parse_care_log(text)
  from public, anon, authenticated, service_role;
revoke all on function public.c5_3_internal_assert_case_scope(text, uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.c5_3_internal_upsert_appointment(text, uuid, uuid, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.c5_3_list_crm_shared_truth(text)
  from public, anon, service_role;
revoke all on function public.c5_3_mutate_crm_shared_truth(text, jsonb, uuid)
  from public, anon, service_role;
grant execute on function public.c5_3_list_crm_shared_truth(text) to authenticated;
grant execute on function public.c5_3_mutate_crm_shared_truth(text, jsonb, uuid) to authenticated;

commit;
