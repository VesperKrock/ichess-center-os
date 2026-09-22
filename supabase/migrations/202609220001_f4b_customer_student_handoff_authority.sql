begin;

-- F4B keeps CRM Case, C5.1 Student, PH-1 Contact linkage, and the F3B
-- package catalog as the existing authorities.  This migration adds only
-- the relationship metadata and atomic command required to connect them.
do $f4b_prerequisites$
begin
  if pg_catalog.to_regclass('public.crm_contact_student_operational_link') is null
     or pg_catalog.to_regclass('public.crm_shared_command_result') is null
     or pg_catalog.to_regclass('public.crm_case_shared_state') is null
     or pg_catalog.to_regclass('public.center_tuition_package_catalog') is null
     or pg_catalog.to_regclass('public.center_tuition_package_cycles') is null
     or pg_catalog.to_regprocedure('public.c5_1_mutate_core_entity(text,text,text,bigint,jsonb,uuid,text)') is null
     or pg_catalog.to_regprocedure('public.c5_3_internal_assert_access(text,boolean,boolean)') is null
     or pg_catalog.to_regprocedure('public.ph_1_internal_begin_command(text,uuid,text,jsonb)') is null
     or pg_catalog.to_regprocedure('public.ph_1_internal_store_command(text,uuid,uuid,bytea,jsonb)') is null then
    raise exception 'f4b_missing_reviewed_prerequisite';
  end if;
  if pg_catalog.to_regprocedure('public.f4b_convert_crm_case_to_student(text,uuid,uuid,integer,integer,text,text,bigint,jsonb,text,text,uuid)') is not null
     or exists (
       select 1 from pg_catalog.pg_attribute a
       where a.attrelid = 'public.crm_contact_student_operational_link'::pg_catalog.regclass
         and a.attname in ('origin_consultation_case_id', 'origin_candidate_student_id', 'guardian_role', 'occupation')
         and not a.attisdropped
     ) then
    raise exception 'f4b_contract_already_exists';
  end if;
end;
$f4b_prerequisites$;

-- The linked production schema still reserves CONVERTED for a protected
-- executor. Keep every existing transition and open only the transaction-local
-- F4B transition required by the approved conversion command.
create or replace function public.f23_3e_p1a_guard_case_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'OPEN' or new.conversion_state <> 'NOT_STARTED' or new.case_version <> 1 then
      raise exception 'f23_3e_p1a_case_must_start_open_not_started_at_version_one';
    end if;
    return new;
  end if;
  if old.status in ('CONVERTED', 'LOST', 'CANCELLED', 'ARCHIVED') then
    raise exception 'f23_3e_p1a_terminal_case_is_immutable_without_future_protected_flow';
  end if;
  if old.status = 'READY_FOR_CONVERSION' and old.conversion_state = 'REVIEW_PENDING'
     and new.status = 'CONVERTED' and new.conversion_state = 'COMPLETED'
     and pg_catalog.current_setting('ichess.f4b_conversion', true) = 'on'
     and new.case_version = old.case_version + 1
     and new.active_assignment_id is null and new.closed_at is not null then
    return new;
  end if;
  if new.status = 'CONVERTED' then
    raise exception 'f23_3e_p1a_case_converted_reserved_for_future_executor';
  end if;
  if new.status <> old.status and not (
    (old.status = 'OPEN' and new.status in ('CONSULTING', 'PAUSED', 'LOST', 'CANCELLED', 'ARCHIVED'))
    or (old.status = 'CONSULTING' and new.status in ('PAUSED', 'READY_FOR_CONVERSION', 'LOST', 'CANCELLED', 'ARCHIVED'))
    or (old.status = 'PAUSED' and new.status in ('CONSULTING', 'LOST', 'CANCELLED', 'ARCHIVED'))
    or (old.status = 'READY_FOR_CONVERSION' and new.status in ('CONSULTING', 'LOST', 'CANCELLED'))
  ) then
    raise exception 'f23_3e_p1a_invalid_case_transition: % -> %', old.status, new.status;
  end if;
  return new;
end;
$function$;

create or replace function public.f23_3e_p1a_guard_candidate_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.candidate_status <> 'DRAFT' or new.candidate_version <> 1 then
      raise exception 'f23_3e_p1a_candidate_must_start_draft_at_version_one';
    end if;
    return new;
  end if;
  if old.candidate_status in ('CONVERTED', 'DISCARDED') then
    raise exception 'f23_3e_p1a_terminal_candidate_is_immutable';
  end if;
  if old.candidate_status in ('ACTIVE', 'REVIEW_REQUIRED')
     and new.candidate_status = 'CONVERTED'
     and pg_catalog.current_setting('ichess.f4b_conversion', true) = 'on'
     and new.candidate_version = old.candidate_version + 1 then
    return new;
  end if;
  if new.candidate_status = 'CONVERTED' then
    raise exception 'f23_3e_p1a_candidate_converted_reserved_for_future_executor';
  end if;
  if new.candidate_status <> old.candidate_status and not (
    (old.candidate_status = 'DRAFT' and new.candidate_status in ('ACTIVE', 'REVIEW_REQUIRED', 'DISCARDED'))
    or (old.candidate_status = 'ACTIVE' and new.candidate_status in ('REVIEW_REQUIRED', 'DISCARDED'))
    or (old.candidate_status = 'REVIEW_REQUIRED' and new.candidate_status in ('ACTIVE', 'DISCARDED'))
  ) then
    raise exception 'f23_3e_p1a_invalid_candidate_transition: % -> %', old.candidate_status, new.candidate_status;
  end if;
  return new;
end;
$function$;

alter table public.crm_contact_student_operational_link
  add column origin_consultation_case_id uuid,
  add column origin_candidate_student_id uuid,
  add column guardian_role text not null default 'UNSPECIFIED',
  add column occupation text not null default '',
  add constraint crm_contact_student_operational_link_origin_shape_check
    check ((origin_consultation_case_id is null) = (origin_candidate_student_id is null)),
  add constraint crm_contact_student_operational_link_origin_case_fkey
    foreign key (center_id, origin_consultation_case_id)
    references public.consultation_case(center_id, consultation_case_id) on delete restrict,
  add constraint crm_contact_student_operational_link_origin_candidate_fkey
    foreign key (center_id, origin_consultation_case_id, origin_candidate_student_id)
    references public.consultation_case_candidate_student(
      center_id, consultation_case_id, candidate_student_id
    ) on delete restrict,
  add constraint crm_contact_student_operational_link_guardian_role_check
    check (guardian_role in ('FATHER', 'MOTHER', 'OTHER', 'UNSPECIFIED')),
  add constraint crm_contact_student_operational_link_occupation_check
    check (
      pg_catalog.length(occupation) <= 160
      and occupation = pg_catalog.btrim(occupation)
      and occupation !~ '[[:cntrl:]]'
    );

create unique index crm_contact_student_operational_link_origin_candidate_unique
  on public.crm_contact_student_operational_link(
    center_id, origin_consultation_case_id, origin_candidate_student_id
  ) where origin_candidate_student_id is not null;

alter table public.center_tuition_package_catalog
  add column program_name text,
  add constraint center_tuition_package_catalog_program_name_check
    check (
      program_name is null
      or (
        pg_catalog.length(program_name) between 1 and 120
        and program_name = pg_catalog.btrim(program_name)
        and program_name !~ '[[:cntrl:]]'
      )
    );

alter table public.center_tuition_package_cycles
  add column program_name_snapshot text,
  add constraint center_tuition_package_cycles_program_name_snapshot_check
    check (
      program_name_snapshot is null
      or (
        pg_catalog.length(program_name_snapshot) between 1 and 120
        and program_name_snapshot = pg_catalog.btrim(program_name_snapshot)
        and program_name_snapshot !~ '[[:cntrl:]]'
      )
    );

create or replace function public.f4b_internal_snapshot_package_program()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.package_catalog_id is null then
    new.program_name_snapshot := null;
  elsif tg_op = 'INSERT'
     or old.package_catalog_id is distinct from new.package_catalog_id
     or (
       old.package_catalog_id is null
       and new.package_catalog_id is not null
     ) then
    select p.program_name into new.program_name_snapshot
    from public.center_tuition_package_catalog p
    where p.center_id = new.center_id and p.id = new.package_catalog_id;
    if not found then
      raise exception 'f4b_package_not_available_for_center';
    end if;
  end if;
  return new;
end;
$function$;

create trigger f4b_snapshot_package_program
before insert or update of package_catalog_id
on public.center_tuition_package_cycles
for each row execute function public.f4b_internal_snapshot_package_program();

create or replace function public.ph_1_internal_guard_parent_student_link()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_f4b_binding boolean := coalesce(
    pg_catalog.current_setting('ichess.f4b_conversion', true), ''
  ) = 'on';
begin
  if pg_catalog.current_setting('ichess.ph_1_link_write', true) is distinct from 'on' then
    raise exception using errcode = '42501', message = 'PARENT_STUDENT_LINK_DIRECT_WRITE_DENIED';
  end if;

  if tg_op = 'DELETE' then
    raise exception using errcode = '42501', message = 'PARENT_STUDENT_LINK_DELETE_DENIED';
  end if;

  if tg_op = 'INSERT' then
    if new.link_status <> 'ACTIVE' or new.link_version <> 1
       or new.ended_at is not null or new.ended_reason_code is not null then
      raise exception 'PARENT_STUDENT_LINK_INITIAL_STATE_INVALID';
    end if;
    return new;
  end if;

  if new.link_id is distinct from old.link_id
     or new.center_id is distinct from old.center_id
     or new.crm_contact_id is distinct from old.crm_contact_id
     or new.student_entity_type is distinct from old.student_entity_type
     or new.student_local_id is distinct from old.student_local_id
     or new.created_by_user_id is distinct from old.created_by_user_id
     or new.created_at is distinct from old.created_at
     or new.link_version <> old.link_version + 1
     or old.link_status <> 'ACTIVE'
     or new.link_status not in ('ACTIVE', 'ENDED') then
    raise exception 'PARENT_STUDENT_LINK_IMMUTABLE_OR_VERSION_INVALID';
  end if;

  if (
    new.origin_consultation_case_id is distinct from old.origin_consultation_case_id
    or new.origin_candidate_student_id is distinct from old.origin_candidate_student_id
  ) and not (
    v_f4b_binding
    and old.origin_consultation_case_id is null
    and old.origin_candidate_student_id is null
    and new.origin_consultation_case_id is not null
    and new.origin_candidate_student_id is not null
  ) then
    raise exception 'PARENT_STUDENT_LINK_ORIGIN_IMMUTABLE';
  end if;

  new.updated_at := pg_catalog.transaction_timestamp();
  if new.link_status = 'ACTIVE' then
    new.ended_at := null;
    new.ended_reason_code := null;
  else
    new.ended_at := pg_catalog.transaction_timestamp();
  end if;
  return new;
end;
$function$;

create or replace function public.f4b_internal_snapshot_result(
  p_link public.crm_contact_student_operational_link,
  p_case public.consultation_case,
  p_candidate public.consultation_case_candidate_student,
  p_student public.center_cloud_entities,
  p_mode text,
  p_business_replayed boolean,
  p_correlation_id uuid
)
returns jsonb
language sql
stable
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'COMMITTED',
    'operation', 'CONVERT_CRM_CASE_TO_STUDENT',
    'mode', p_mode,
    'business_replayed', p_business_replayed,
    'replayed', false,
    'center_id', p_case.center_id,
    'case_id', p_case.consultation_case_id,
    'case_version', p_case.case_version,
    'candidate_id', p_candidate.candidate_student_id,
    'candidate_version', p_candidate.candidate_version,
    'student_id', p_student.local_id,
    'student_entity_version', p_student.entity_version,
    'link_id', p_link.link_id,
    'link_version', p_link.link_version,
    'guardian_role', p_link.guardian_role,
    'correlation_id', p_correlation_id
  );
$function$;

create function public.f4b_convert_crm_case_to_student(
  p_center_id text,
  p_case_id uuid,
  p_candidate_id uuid,
  p_expected_case_version integer,
  p_expected_candidate_version integer,
  p_mode text,
  p_student_local_id text,
  p_expected_student_version bigint,
  p_student_payload jsonb,
  p_guardian_role text,
  p_guardian_occupation text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_mode text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_mode, '')));
  v_student_id text := pg_catalog.btrim(coalesce(p_student_local_id, ''));
  v_guardian_role text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_guardian_role, 'UNSPECIFIED')));
  v_occupation text := pg_catalog.btrim(coalesce(p_guardian_occupation, ''));
  v_command record;
  v_case public.consultation_case%rowtype;
  v_candidate public.consultation_case_candidate_student%rowtype;
  v_contact public.crm_contact%rowtype;
  v_state public.crm_case_shared_state%rowtype;
  v_assignment public.consultation_case_assignment%rowtype;
  v_student public.center_cloud_entities%rowtype;
  v_link public.crm_contact_student_operational_link%rowtype;
  v_c5_result jsonb;
  v_payload jsonb;
  v_birth_date date;
  v_birth_year text;
  v_result jsonb;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_previous_case_version integer;
  v_existing_equivalent_link boolean := false;
  v_error text;
begin
  if v_actor is null
     or v_center_id = ''
     or p_case_id is null
     or p_candidate_id is null
     or p_expected_case_version is null or p_expected_case_version < 1
     or p_expected_candidate_version is null or p_expected_candidate_version < 1
     or p_expected_student_version is null or p_expected_student_version < 0
     or p_idempotency_key is null
     or v_mode not in ('CREATE_NEW', 'LINK_EXISTING')
     or v_guardian_role not in ('FATHER', 'MOTHER', 'OTHER', 'UNSPECIFIED')
     or pg_catalog.length(v_occupation) > 160
     or v_occupation ~ '[[:cntrl:]]'
     or public.c5_3_contains_protected_identity(v_occupation) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;

  if v_mode = 'CREATE_NEW' then
    v_student_id := 'student-crm-' || p_candidate_id::text;
    if p_expected_student_version <> 0
       or p_student_payload is null
       or pg_catalog.jsonb_typeof(p_student_payload) <> 'object'
       or pg_catalog.octet_length(pg_catalog.convert_to(p_student_payload::text, 'UTF8')) > 262144 then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_STUDENT_PAYLOAD');
    end if;
  elsif v_student_id = '' or pg_catalog.length(v_student_id) > 200
     or v_student_id ~ '[[:cntrl:]]' or p_expected_student_version < 1 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_STUDENT_TARGET');
  end if;

  select * into strict v_command
  from public.ph_1_internal_begin_command(
    v_center_id,
    p_idempotency_key,
    'F4B_CONVERT_CRM_CASE_TO_STUDENT',
    pg_catalog.jsonb_build_object(
      'case_id', p_case_id,
      'candidate_id', p_candidate_id,
      'expected_case_version', p_expected_case_version,
      'expected_candidate_version', p_expected_candidate_version,
      'mode', v_mode,
      'student_local_id', v_student_id,
      'expected_student_version', p_expected_student_version,
      'student_payload', coalesce(p_student_payload, 'null'::jsonb),
      'guardian_role', v_guardian_role,
      'guardian_occupation', v_occupation
    )
  );
  if v_command.replay_snapshot is not null then
    return v_command.replay_snapshot;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      v_center_id || ':f4b-candidate:' || p_candidate_id::text,
      220926
    )
  );

  select c.* into v_case
  from public.consultation_case c
  where c.center_id = v_center_id and c.consultation_case_id = p_case_id
  for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND_OR_DENIED'; end if;

  select cs.* into v_candidate
  from public.consultation_case_candidate_student cs
  where cs.center_id = v_center_id
    and cs.consultation_case_id = p_case_id
    and cs.candidate_student_id = p_candidate_id
  for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND_OR_DENIED'; end if;

  select ct.* into strict v_contact
  from public.crm_contact ct
  where ct.center_id = v_center_id and ct.crm_contact_id = v_case.primary_contact_id
  for share;

  select s.* into v_state
  from public.crm_case_shared_state s
  where s.center_id = v_center_id and s.consultation_case_id = p_case_id
  for update;
  if not found then raise exception 'CRM_SHARED_STATE_REQUIRED'; end if;

  select l.* into v_link
  from public.crm_contact_student_operational_link l
  where l.center_id = v_center_id
    and l.origin_consultation_case_id = p_case_id
    and l.origin_candidate_student_id = p_candidate_id
  for update;

  if found then
    if v_mode = 'LINK_EXISTING' and v_link.student_local_id <> v_student_id then
      raise exception 'CONVERSION_TARGET_CONFLICT';
    end if;
    select e.* into strict v_student
    from public.center_cloud_entities e
    where e.center_id = v_center_id
      and e.entity_type = 'student'
      and e.local_id = v_link.student_local_id
      and e.deleted_at is null;
    v_result := public.f4b_internal_snapshot_result(
      v_link, v_case, v_candidate, v_student, v_mode, true, null
    );
    return public.ph_1_internal_store_command(
      v_center_id, v_command.actor_user_id, p_idempotency_key,
      v_command.intent_digest, v_result
    );
  end if;

  if v_case.case_version <> p_expected_case_version then raise exception 'CASE_VERSION_STALE'; end if;
  if v_candidate.candidate_version <> p_expected_candidate_version then raise exception 'CANDIDATE_VERSION_STALE'; end if;
  if v_case.status <> 'READY_FOR_CONVERSION'
     or v_candidate.candidate_status not in ('DRAFT', 'ACTIVE', 'REVIEW_REQUIRED') then
    raise exception 'CONVERSION_NOT_ELIGIBLE';
  end if;

  -- C5.3 creates its canonical candidate as DRAFT even when the case is saved
  -- directly as READY_FOR_CONVERSION. Promote that same candidate inside this
  -- transaction; a later Student/link failure rolls the promotion back.
  if v_candidate.candidate_status = 'DRAFT' then
    perform pg_catalog.set_config('ichess.c5_3_candidate_write', 'on', true);
    update public.consultation_case_candidate_student cs set
      candidate_status = 'ACTIVE',
      candidate_version = cs.candidate_version + 1,
      updated_at = pg_catalog.transaction_timestamp()
    where cs.center_id = v_center_id and cs.candidate_student_id = p_candidate_id
    returning * into v_candidate;
  end if;

  -- Preserve the existing deferred Case/assignment verifier by ensuring every
  -- queued F4B Case row already carries the final null assignment pointer.
  -- The captured assignment is then ended inside the same transaction.
  if v_case.active_assignment_id is not null then
    select a.* into strict v_assignment
    from public.consultation_case_assignment a
    where a.center_id = v_center_id
      and a.consultation_case_id = p_case_id
      and a.assignment_id = v_case.active_assignment_id
    for update;
  end if;

  update public.consultation_case c set
    conversion_state = 'REVIEW_PENDING',
    active_assignment_id = null,
    case_version = c.case_version + 1,
    updated_at = pg_catalog.transaction_timestamp()
  where c.center_id = v_center_id and c.consultation_case_id = p_case_id
  returning * into v_case;

  if v_assignment.assignment_id is not null then
    update public.consultation_case_assignment a set
      assignment_status = 'ENDED',
      assignment_version = a.assignment_version + 1,
      ended_at = pg_catalog.transaction_timestamp(),
      end_reason = 'CASE_CONVERTED_F4B'
    where a.assignment_id = v_assignment.assignment_id;
  end if;

  if v_mode = 'CREATE_NEW' then
    if pg_catalog.btrim(coalesce(v_candidate.display_name_evidence, '')) = '' then
      raise exception 'STUDENT_NAME_REQUIRED';
    end if;
    if coalesce(p_student_payload->>'birthDate', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'STUDENT_BIRTH_DATE_REQUIRED';
    end if;
    begin
      v_birth_date := (p_student_payload->>'birthDate')::date;
    exception when others then
      raise exception 'STUDENT_BIRTH_DATE_INVALID';
    end;
    if v_birth_date >= current_date then raise exception 'STUDENT_BIRTH_DATE_INVALID'; end if;
    v_birth_year := pg_catalog.btrim(coalesce(v_state.safe_state->>'studentBirthYear', ''));
    if v_birth_year <> '' and pg_catalog.date_part('year', v_birth_date)::integer <> v_birth_year::integer then
      raise exception 'STUDENT_BIRTH_YEAR_MISMATCH';
    end if;
    if pg_catalog.btrim(coalesce(p_student_payload->>'schoolName', '')) = '' then
      raise exception 'STUDENT_SCHOOL_REQUIRED';
    end if;
    if pg_catalog.btrim(coalesce(p_student_payload->>'level', '')) = '' then
      raise exception 'STUDENT_LEVEL_REQUIRED';
    end if;

    v_payload := p_student_payload
      - 'cloudVersion' - 'cloudUpdatedAt' - 'cloudDeletedAt' - 'updatedAt'
      - 'assignedTeacherId' - 'mainTeacherName'
      - 'fatherPhone' - 'motherPhone' - 'parentPhone'
      || pg_catalog.jsonb_build_object(
        'id', v_student_id,
        'fullName', pg_catalog.btrim(v_candidate.display_name_evidence),
        'birthDate', v_birth_date::text,
        'parentName', coalesce(v_contact.display_name, ''),
        'parentArea', coalesce(v_state.safe_state->>'locationArea', ''),
        'currentStatus', coalesce(nullif(p_student_payload->>'currentStatus', ''), 'Đang theo học'),
        'classSessionIds', coalesce(p_student_payload->'classSessionIds', '[]'::jsonb),
        'recurringEnrollments', coalesce(p_student_payload->'recurringEnrollments', '[]'::jsonb)
      );

    v_c5_result := public.c5_1_mutate_core_entity(
      v_center_id, 'student', v_student_id, 0, v_payload,
      p_idempotency_key, 'UPSERT'
    );
    if coalesce((v_c5_result->>'ok')::boolean, false) is not true
       or v_c5_result->>'outcome_code' <> 'COMMITTED' then
      raise exception 'STUDENT_CREATE_%', coalesce(v_c5_result->>'outcome_code', 'FAILED');
    end if;
    select e.* into strict v_student
    from public.center_cloud_entities e
    where e.center_id = v_center_id and e.entity_type = 'student' and e.local_id = v_student_id
    for update;
  else
    select e.* into v_student
    from public.center_cloud_entities e
    where e.center_id = v_center_id
      and e.entity_type = 'student'
      and e.local_id = v_student_id
      and e.deleted_at is null
    for update;
    if not found then raise exception 'STUDENT_NOT_CURRENT_OR_NOT_FOUND'; end if;
    if v_student.entity_version <> p_expected_student_version then raise exception 'STUDENT_VERSION_STALE'; end if;
  end if;

  select l.* into v_link
  from public.crm_contact_student_operational_link l
  where l.center_id = v_center_id
    and l.crm_contact_id = v_case.primary_contact_id
    and l.student_local_id = v_student_id
    and l.link_status = 'ACTIVE'
  order by l.created_at, l.link_id
  limit 1
  for update;
  v_existing_equivalent_link := found;

  if not v_existing_equivalent_link and exists (
    select 1 from public.crm_contact_student_operational_link l
    where l.center_id = v_center_id
      and l.student_local_id = v_student_id
      and l.link_status = 'ACTIVE'
      and l.is_primary_contact
  ) then
    raise exception 'LINK_COLLISION_REVIEW_REQUIRED';
  end if;

  perform pg_catalog.set_config('ichess.ph_1_link_write', 'on', true);
  perform pg_catalog.set_config('ichess.f4b_conversion', 'on', true);
  if v_existing_equivalent_link then
    update public.crm_contact_student_operational_link l set
      origin_consultation_case_id = p_case_id,
      origin_candidate_student_id = p_candidate_id,
      guardian_role = v_guardian_role,
      occupation = v_occupation,
      link_version = l.link_version + 1,
      updated_by_user_id = v_actor
    where l.center_id = v_center_id and l.link_id = v_link.link_id
    returning * into v_link;
  else
    insert into public.crm_contact_student_operational_link(
      link_id, center_id, crm_contact_id, student_local_id,
      relationship_type, is_primary_contact, financial_contact_role, academic_contact_role,
      origin_consultation_case_id, origin_candidate_student_id,
      guardian_role, occupation, created_by_user_id, updated_by_user_id
    ) values (
      pg_catalog.gen_random_uuid(), v_center_id, v_case.primary_contact_id, v_student_id,
      'PARENT', true, 'PRIMARY', 'PRIMARY',
      p_case_id, p_candidate_id,
      v_guardian_role, v_occupation, v_actor, v_actor
    ) returning * into v_link;
  end if;

  -- REVIEW_PENDING and the F4B context are transaction-local execution state;
  -- neither can leak if Student/link/terminal conversion fails.
  perform pg_catalog.set_config('ichess.c5_3_candidate_write', 'on', true);
  update public.consultation_case_candidate_student cs set
    candidate_status = 'CONVERTED',
    candidate_version = cs.candidate_version + 1,
    updated_at = pg_catalog.transaction_timestamp()
  where cs.center_id = v_center_id and cs.candidate_student_id = p_candidate_id
  returning * into v_candidate;

  v_previous_case_version := v_case.case_version;
  update public.consultation_case c set
    status = 'CONVERTED',
    conversion_state = 'COMPLETED',
    case_version = c.case_version + 1,
    active_assignment_id = null,
    closed_at = pg_catalog.transaction_timestamp(),
    updated_at = pg_catalog.transaction_timestamp()
  where c.center_id = v_center_id and c.consultation_case_id = p_case_id
  returning * into v_case;

  update public.crm_case_shared_state s set
    safe_state = pg_catalog.jsonb_set(
      pg_catalog.jsonb_set(s.safe_state, '{customerStage}', '"converted"'::jsonb, true),
      '{consultationStatus}', '"converted"'::jsonb, true
    ),
    state_version = s.state_version + 1,
    updated_by_user_id = v_actor,
    updated_at = pg_catalog.transaction_timestamp()
  where s.center_id = v_center_id and s.consultation_case_id = p_case_id;

  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.case.operational_student_converted', v_actor,
    'consultation_case', p_case_id, v_assignment.assignment_id,
    v_previous_case_version, v_case.case_version, v_case.status,
    'f4b-operational-student-linked', 'F4B_OPERATIONAL_STUDENT_CONVERTED', v_correlation_id
  );

  v_result := public.f4b_internal_snapshot_result(
    v_link, v_case, v_candidate, v_student, v_mode, false, v_correlation_id
  );
  return public.ph_1_internal_store_command(
    v_center_id, v_command.actor_user_id, p_idempotency_key,
    v_command.intent_digest, v_result
  );
exception when others then
  v_error := sqlerrm;
  return pg_catalog.jsonb_build_object(
    'ok', false,
    'outcome_code', case
      when v_error in (
        'CENTER_ACCESS_DENIED', 'WRITE_ROLE_REQUIRED', 'CRM_RUNTIME_NOT_ACTIVE',
        'RESOURCE_NOT_FOUND_OR_DENIED', 'CRM_SHARED_STATE_REQUIRED',
        'CASE_VERSION_STALE', 'CANDIDATE_VERSION_STALE', 'CONVERSION_NOT_ELIGIBLE',
        'CONVERSION_TARGET_CONFLICT', 'STUDENT_NAME_REQUIRED',
        'STUDENT_BIRTH_DATE_REQUIRED', 'STUDENT_BIRTH_DATE_INVALID',
        'STUDENT_BIRTH_YEAR_MISMATCH', 'STUDENT_SCHOOL_REQUIRED',
        'STUDENT_LEVEL_REQUIRED', 'STUDENT_NOT_CURRENT_OR_NOT_FOUND',
        'STUDENT_VERSION_STALE', 'LINK_COLLISION_REVIEW_REQUIRED',
        'IDEMPOTENCY_KEY_REUSED_WITH_CHANGED_INTENT'
      ) then v_error
      when v_error like 'STUDENT_CREATE_%' then v_error
      else 'F4B_CONVERSION_FAILED'
    end
  );
end;
$function$;

-- Function projections and settings mutations are replaced below after the
-- new nullable columns exist.


drop function public.ph_1_create_parent_student_link(
  text, uuid, uuid, text, text, boolean, text, text, uuid
);
drop function public.ph_1_update_parent_student_link(
  text, uuid, integer, text, boolean, text, text, uuid
);

create or replace function public.ph_1_list_parent_student_links(
  p_center_id text,
  p_include_ended boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_links jsonb;
begin
  perform public.c5_3_internal_assert_access(v_center_id, false, true);

  select coalesce(pg_catalog.jsonb_agg(projected.item order by projected.created_at, projected.link_id), '[]'::jsonb)
    into v_links
  from (
    select l.created_at, l.link_id,
      pg_catalog.jsonb_build_object(
        'link_id', l.link_id,
        'link_version', l.link_version,
        'link_status', l.link_status,
        'relationship_type', l.relationship_type,
        'is_primary_contact', l.is_primary_contact,
        'financial_contact_role', l.financial_contact_role,
        'academic_contact_role', l.academic_contact_role,
        'guardian_role', l.guardian_role,
        'occupation', l.occupation,
        'origin_consultation_case_id', l.origin_consultation_case_id,
        'origin_candidate_student_id', l.origin_candidate_student_id,
        'ended_reason_code', l.ended_reason_code,
        'ended_at', l.ended_at,
        'crm_contact_id', c.crm_contact_id,
        'contact_version', c.contact_version,
        'contact_status', c.contact_status,
        'contact_display_name', c.display_name,
        'contact_phones', coalesce(identity_data.canonical_phones, array[]::text[]),
        'contact_emails', coalesce(identity_data.canonical_emails, array[]::text[]),
        'contact_identity_available', c.contact_status <> 'ARCHIVED',
        'student_local_id', l.student_local_id,
        'student_available', (
          s.deleted_at is null
          and pg_catalog.jsonb_typeof(s.payload) = 'object'
          and pg_catalog.btrim(coalesce(s.payload->>'id', '')) = l.student_local_id
        ),
        'student_entity_version', s.entity_version,
        'student_updated_at', s.updated_at,
        'created_at', l.created_at,
        'updated_at', l.updated_at
      ) as item
    from public.crm_contact_student_operational_link l
    join public.crm_contact c
      on c.center_id = l.center_id and c.crm_contact_id = l.crm_contact_id
    join public.center_cloud_entities s
      on s.center_id = l.center_id and s.entity_type = l.student_entity_type
      and s.local_id = l.student_local_id
    left join lateral (
      select parsed.canonical_phones, parsed.canonical_emails
      from public.f23_3e_p4a_internal_parse_payload_v1(
        public.f23_3e_p3c_internal_unwrap_contact_source_evidence(
          c.center_id, c.crm_contact_id, c.contact_version
        )
      ) parsed
      where c.contact_status <> 'ARCHIVED'
    ) identity_data on true
    where l.center_id = v_center_id
      and (coalesce(p_include_ended, false) or l.link_status = 'ACTIVE')
  ) projected;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'PARENT_STUDENT_LINKS_READ',
    'center_id', v_center_id,
    'links', v_links,
    'read_at', pg_catalog.clock_timestamp()
  );
end;
$function$;

create function public.ph_1_create_parent_student_link(
  p_center_id text,
  p_link_id uuid,
  p_crm_contact_id uuid,
  p_student_local_id text,
  p_relationship_type text,
  p_is_primary_contact boolean,
  p_financial_contact_role text,
  p_academic_contact_role text,
  p_idempotency_key uuid,
  p_guardian_role text default 'UNSPECIFIED',
  p_occupation text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_student_local_id text := pg_catalog.btrim(coalesce(p_student_local_id, ''));
  v_relationship_type text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_relationship_type, '')));
  v_financial_role text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_financial_contact_role, '')));
  v_academic_role text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_academic_contact_role, '')));
  v_guardian_role text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_guardian_role, 'UNSPECIFIED')));
  v_occupation text := pg_catalog.btrim(coalesce(p_occupation, ''));
  v_command record;
  v_student public.center_cloud_entities%rowtype;
  v_contact public.crm_contact%rowtype;
  v_link public.crm_contact_student_operational_link%rowtype;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_result jsonb;
begin
  if p_link_id is null or p_crm_contact_id is null
     or v_student_local_id = '' or pg_catalog.length(v_student_local_id) > 200
     or v_student_local_id ~ '[[:cntrl:]]'
     or v_relationship_type not in ('PARENT', 'LEGAL_GUARDIAN', 'CAREGIVER', 'EMERGENCY_CONTACT', 'OTHER_REVIEWED')
     or v_financial_role not in ('NONE', 'PRIMARY', 'SECONDARY')
     or v_academic_role not in ('NONE', 'PRIMARY', 'SECONDARY')
     or v_guardian_role not in ('FATHER', 'MOTHER', 'OTHER', 'UNSPECIFIED')
     or pg_catalog.length(v_occupation) > 160
     or v_occupation ~ '[[:cntrl:]]'
     or public.c5_3_contains_protected_identity(v_occupation) then
    raise exception 'INVALID_COMMAND';
  end if;

  select * into strict v_command
  from public.ph_1_internal_begin_command(
    v_center_id,
    p_idempotency_key,
    'CREATE_LINK',
    pg_catalog.jsonb_build_object(
      'link_id', p_link_id,
      'crm_contact_id', p_crm_contact_id,
      'student_local_id', v_student_local_id,
      'relationship_type', v_relationship_type,
      'is_primary_contact', coalesce(p_is_primary_contact, false),
      'financial_contact_role', v_financial_role,
      'academic_contact_role', v_academic_role,
      'guardian_role', v_guardian_role,
      'occupation', v_occupation
    )
  );
  if v_command.replay_snapshot is not null then return v_command.replay_snapshot; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_center_id || ':student:' || v_student_local_id, 250802)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_center_id || ':contact:' || p_crm_contact_id::text, 250803)
  );
  v_student := public.ph_1_internal_assert_current_student(v_center_id, v_student_local_id);
  v_contact := public.ph_1_internal_assert_mutable_contact(v_center_id, p_crm_contact_id);

  if exists (
    select 1 from public.crm_contact_student_operational_link l
    where l.link_id = p_link_id
  ) or exists (
    select 1 from public.crm_contact_student_operational_link l
    where l.center_id = v_center_id
      and l.crm_contact_id = p_crm_contact_id
      and l.student_local_id = v_student_local_id
      and l.relationship_type = v_relationship_type
      and l.link_status = 'ACTIVE'
  ) or (
    coalesce(p_is_primary_contact, false) and exists (
      select 1 from public.crm_contact_student_operational_link l
      where l.center_id = v_center_id
        and l.student_local_id = v_student_local_id
        and l.is_primary_contact
        and l.link_status = 'ACTIVE'
    )
  ) then
    raise exception using errcode = 'P0001', message = 'LINK_COLLISION_REVIEW_REQUIRED';
  end if;

  perform pg_catalog.set_config('ichess.ph_1_link_write', 'on', true);
  insert into public.crm_contact_student_operational_link(
    link_id, center_id, crm_contact_id, student_local_id,
    relationship_type, is_primary_contact, financial_contact_role,
    academic_contact_role, guardian_role, occupation, created_by_user_id, updated_by_user_id
  ) values (
    p_link_id, v_center_id, p_crm_contact_id, v_student_local_id,
    v_relationship_type, coalesce(p_is_primary_contact, false), v_financial_role,
    v_academic_role, v_guardian_role, v_occupation, v_command.actor_user_id, v_command.actor_user_id
  ) returning * into v_link;

  perform public.f23_3e_p1d_internal_append_audit_outbox(
    v_center_id, 'crm.parent_student_link.created', v_command.actor_user_id,
    'crm_contact_student_operational_link', v_link.link_id, null,
    null, v_link.link_version, v_link.link_status, null,
    'PARENT_STUDENT_LINK_CREATED', v_correlation_id
  );

  v_result := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED', 'operation', 'CREATE_LINK',
    'replayed', false, 'changed', true, 'link_id', v_link.link_id,
    'link_version', v_link.link_version, 'contact_version', v_contact.contact_version,
    'student_entity_version', v_student.entity_version,
    'correlation_id', v_correlation_id
  );
  return public.ph_1_internal_store_command(
    v_center_id, v_command.actor_user_id, p_idempotency_key,
    v_command.intent_digest, v_result
  );
end;
$function$;

create function public.ph_1_update_parent_student_link(
  p_center_id text,
  p_link_id uuid,
  p_expected_link_version integer,
  p_relationship_type text,
  p_is_primary_contact boolean,
  p_financial_contact_role text,
  p_academic_contact_role text,
  p_idempotency_key uuid,
  p_guardian_role text default 'UNSPECIFIED',
  p_occupation text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_relationship_type text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_relationship_type, '')));
  v_financial_role text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_financial_contact_role, '')));
  v_academic_role text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_academic_contact_role, '')));
  v_guardian_role text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_guardian_role, 'UNSPECIFIED')));
  v_occupation text := pg_catalog.btrim(coalesce(p_occupation, ''));
  v_command record;
  v_link public.crm_contact_student_operational_link%rowtype;
  v_previous_version integer;
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_result jsonb;
begin
  if p_link_id is null or p_expected_link_version is null or p_expected_link_version < 1
     or v_relationship_type not in ('PARENT', 'LEGAL_GUARDIAN', 'CAREGIVER', 'EMERGENCY_CONTACT', 'OTHER_REVIEWED')
     or v_financial_role not in ('NONE', 'PRIMARY', 'SECONDARY')
     or v_academic_role not in ('NONE', 'PRIMARY', 'SECONDARY')
     or v_guardian_role not in ('FATHER', 'MOTHER', 'OTHER', 'UNSPECIFIED')
     or pg_catalog.length(v_occupation) > 160
     or v_occupation ~ '[[:cntrl:]]'
     or public.c5_3_contains_protected_identity(v_occupation) then
    raise exception 'INVALID_COMMAND';
  end if;

  select * into strict v_command
  from public.ph_1_internal_begin_command(
    v_center_id,
    p_idempotency_key,
    'UPDATE_LINK',
    pg_catalog.jsonb_build_object(
      'link_id', p_link_id,
      'expected_link_version', p_expected_link_version,
      'relationship_type', v_relationship_type,
      'is_primary_contact', coalesce(p_is_primary_contact, false),
      'financial_contact_role', v_financial_role,
      'academic_contact_role', v_academic_role,
      'guardian_role', v_guardian_role,
      'occupation', v_occupation
    )
  );
  if v_command.replay_snapshot is not null then return v_command.replay_snapshot; end if;

  select l.* into v_link
  from public.crm_contact_student_operational_link l
  where l.center_id = v_center_id and l.link_id = p_link_id
  for update;
  if not found or v_link.link_status <> 'ACTIVE' then
    raise exception using errcode = 'P0001', message = 'LINK_NOT_FOUND_OR_ENDED';
  end if;
  if v_link.link_version <> p_expected_link_version then
    raise exception using errcode = 'P0001', message = 'LINK_VERSION_STALE';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_center_id || ':student:' || v_link.student_local_id, 250802)
  );
  perform public.ph_1_internal_assert_current_student(v_center_id, v_link.student_local_id);
  perform public.ph_1_internal_assert_mutable_contact(v_center_id, v_link.crm_contact_id);

  if coalesce(p_is_primary_contact, false) and exists (
    select 1 from public.crm_contact_student_operational_link l
    where l.center_id = v_center_id
      and l.student_local_id = v_link.student_local_id
      and l.link_id <> v_link.link_id
      and l.is_primary_contact
      and l.link_status = 'ACTIVE'
  ) then
    raise exception using errcode = 'P0001', message = 'LINK_COLLISION_REVIEW_REQUIRED';
  end if;

  if exists (
    select 1 from public.crm_contact_student_operational_link l
    where l.center_id = v_center_id
      and l.crm_contact_id = v_link.crm_contact_id
      and l.student_local_id = v_link.student_local_id
      and l.relationship_type = v_relationship_type
      and l.link_id <> v_link.link_id
      and l.link_status = 'ACTIVE'
  ) then
    raise exception using errcode = 'P0001', message = 'LINK_COLLISION_REVIEW_REQUIRED';
  end if;

  if v_link.relationship_type = v_relationship_type
     and v_link.is_primary_contact = coalesce(p_is_primary_contact, false)
     and v_link.financial_contact_role = v_financial_role
     and v_link.academic_contact_role = v_academic_role
     and v_link.guardian_role = v_guardian_role
     and v_link.occupation = v_occupation then
    v_result := pg_catalog.jsonb_build_object(
      'ok', true, 'outcome_code', 'COMMITTED', 'operation', 'UPDATE_LINK',
      'replayed', false, 'changed', false, 'link_id', v_link.link_id,
      'link_version', v_link.link_version, 'correlation_id', null
    );
  else
    v_previous_version := v_link.link_version;
    perform pg_catalog.set_config('ichess.ph_1_link_write', 'on', true);
    update public.crm_contact_student_operational_link l set
      relationship_type = v_relationship_type,
      is_primary_contact = coalesce(p_is_primary_contact, false),
      financial_contact_role = v_financial_role,
      academic_contact_role = v_academic_role,
      guardian_role = v_guardian_role,
      occupation = v_occupation,
      link_version = l.link_version + 1,
      updated_by_user_id = v_command.actor_user_id
    where l.center_id = v_center_id and l.link_id = p_link_id
    returning * into v_link;

    perform public.f23_3e_p1d_internal_append_audit_outbox(
      v_center_id, 'crm.parent_student_link.updated', v_command.actor_user_id,
      'crm_contact_student_operational_link', v_link.link_id, null,
      v_previous_version, v_link.link_version, v_link.link_status, null,
      'PARENT_STUDENT_LINK_UPDATED', v_correlation_id
    );
    v_result := pg_catalog.jsonb_build_object(
      'ok', true, 'outcome_code', 'COMMITTED', 'operation', 'UPDATE_LINK',
      'replayed', false, 'changed', true, 'link_id', v_link.link_id,
      'link_version', v_link.link_version, 'correlation_id', v_correlation_id
    );
  end if;

  return public.ph_1_internal_store_command(
    v_center_id, v_command.actor_user_id, p_idempotency_key,
    v_command.intent_digest, v_result
  );
end;
$function$;

create or replace function public.v2_1_list_center_settings(p_center_id text)
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
        'program_name', p.program_name,
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

create or replace function public.v2_1_mutate_center_settings(
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
  v_program_name text;
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
    v_program_name := nullif(regexp_replace(btrim(coalesce(p_command->>'program_name', '')), '\s+', ' ', 'g'), '');
    v_total_sessions := (p_command->>'total_sessions')::integer;
    v_default_amount := (p_command->>'default_amount')::bigint;
    v_is_active := coalesce((p_command->>'is_active')::boolean, true);
    v_note := btrim(coalesce(p_command->>'note', ''));
    if char_length(v_name) not between 1 and 120 or v_total_sessions not between 1 and 1000
       or v_default_amount not between 0 and 9000000000000000 or char_length(v_note) > 500
       or coalesce(char_length(v_program_name), 0) > 120
       or public.c5_3_contains_protected_identity(coalesce(v_program_name, '')) then
      raise exception 'v2_1_invalid_tuition_package';
    end if;
    select * into v_package from public.center_tuition_package_catalog
      where id = v_package_id for update;
    if v_operation = 'CREATE_TUITION_PACKAGE' then
      if found or v_expected_version <> 0 then raise exception 'v2_1_package_identity_conflict'; end if;
      begin
        insert into public.center_tuition_package_catalog(
          id, center_id, package_name, program_name, total_sessions, default_amount, is_active, note,
          created_by_membership_id, updated_by_membership_id
        ) values (
          v_package_id, p_center_id, v_name, v_program_name, v_total_sessions, v_default_amount, v_is_active, v_note,
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
        set package_name = v_name, program_name = v_program_name, total_sessions = v_total_sessions,
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

create or replace function public.v2_4_list_package_cycle_state(p_center_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_membership public.center_members;
begin
  if v_actor is null then raise exception 'v2_4_not_authenticated'; end if;
  select * into v_membership from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'v2_4_center_access_denied'; end if;
  return pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'AUTHORITATIVE_SNAPSHOT',
    'status', 'READY', 'contract', 'v2.4-package-cycle-v1', 'center_id', p_center_id,
    'students', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'student_id', student.local_id,
        'readiness', case
          when current_cycle.id is not null then 'READY'
          when tuition.id is not null then 'LEGACY_REVIEW_REQUIRED'
          else 'NO_TUITION_PACKAGE'
        end,
        'current_cycle', case when current_cycle.id is null then null else pg_catalog.jsonb_build_object(
          'id', current_cycle.id, 'cycle_number', current_cycle.cycle_number,
          'tuition_local_id', current_cycle.tuition_local_id,
          'package_catalog_id', current_cycle.package_catalog_id,
          'package_name', current_cycle.package_name_snapshot,
          'program_name', current_cycle.program_name_snapshot,
          'total_sessions', current_cycle.total_sessions_snapshot,
          'price', current_cycle.price_snapshot,
          'baseline_used', current_cycle.baseline_used_sessions,
          'baseline_cutoff_date', current_cycle.baseline_cutoff_date,
          'baseline_review_note', current_cycle.baseline_review_note,
          'contributed_sessions', current_cycle.contributed_sessions,
          'pending_sessions', current_cycle.pending_sessions,
          'used_sessions', current_cycle.used_sessions,
          'remaining_sessions', current_cycle.remaining_sessions,
          'lifecycle_status', current_cycle.lifecycle_status,
          'payment_period_id', current_cycle.payment_period_id,
          'payment_status', current_cycle.payment_status,
          'paid_amount', current_cycle.paid_amount,
          'bcht_status', current_cycle.bcht_status,
          'bcht_note', current_cycle.bcht_note,
          'reminder_state', current_cycle.reminder_state,
          'bcht_reminder', current_cycle.bcht_reminder,
          'renewal_reminder', current_cycle.renewal_reminder,
          'urgent_renewal', current_cycle.urgent_renewal,
          'version', current_cycle.version
        ) end,
        'cycles', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', history.id, 'cycle_number', history.cycle_number,
          'package_name', history.package_name_snapshot,
          'program_name', history_base.program_name_snapshot,
          'total_sessions', history.total_sessions_snapshot,
          'used_sessions', history.used_sessions, 'lifecycle_status', history.lifecycle_status,
          'payment_status', history.payment_status, 'bcht_status', history.bcht_status,
          'version', history.version
        ) order by history.cycle_number desc)
          from public.center_tuition_package_cycle_projection history
          join public.center_tuition_package_cycles history_base
            on history_base.center_id = history.center_id and history_base.id = history.id
          where history.center_id = p_center_id and history.student_local_id = student.local_id), '[]'::jsonb)
      ) order by pg_catalog.lower(coalesce(student.payload->>'fullName', '')), student.local_id)
      from public.center_cloud_entities student
      left join lateral (
        select e.* from public.center_cloud_entities e
        where e.center_id = p_center_id and e.entity_type = 'tuition_record_package'
          and e.deleted_at is null and e.payload->>'studentId' = student.local_id
        order by e.entity_version desc, e.local_id limit 1
      ) tuition on true
      left join lateral (
        select p.*, cycle_base.program_name_snapshot
        from public.center_tuition_package_cycle_projection p
        join public.center_tuition_package_cycles cycle_base
          on cycle_base.center_id = p.center_id and cycle_base.id = p.id
        where p.center_id = p_center_id and p.student_local_id = student.local_id
          and p.lifecycle_status <> 'SUPERSEDED'
        order by p.cycle_number desc limit 1
      ) current_cycle on true
      where student.center_id = p_center_id and student.entity_type = 'student'
        and student.deleted_at is null
    ), '[]'::jsonb),
    'package_catalog', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', p.id, 'package_name', p.package_name, 'program_name', p.program_name, 'total_sessions', p.total_sessions,
      'default_amount', p.default_amount, 'is_active', p.is_active, 'version', p.version
    ) order by p.is_active desc, pg_catalog.lower(p.package_name), p.id)
      from public.center_tuition_package_catalog p where p.center_id = p_center_id), '[]'::jsonb),
    'contributions', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'student_id', item.student_local_id,
      'schedule_session_id', item.schedule_session_local_id,
      'occurrence_date', item.occurrence_date,
      'attendance_status', item.attendance_status,
      'contribution_units', item.contribution_units,
      'allocation_state', item.allocation_state,
      'makeup_reason', item.makeup_reason_snapshot,
      'cycle_id', item.cycle_id,
      'cycle_number', item.cycle_number,
      'package_name', item.package_name_snapshot,
      'program_name', item.program_name_snapshot,
      'total_sessions', item.total_sessions_snapshot,
      'session_number', case when item.allocation_state = 'APPLIED'
        then item.running_session_number else null end,
      'remaining_sessions', case when item.allocation_state = 'APPLIED'
          and item.total_sessions_snapshot is not null
        then greatest(item.total_sessions_snapshot - item.running_session_number, 0) else null end,
      'cycle_lifecycle_status', item.lifecycle_status,
      'payment_status', item.payment_status
    ) order by item.occurrence_date, item.schedule_session_local_id, item.student_local_id)
      from (
        select x.*, cycle.cycle_number, cycle.package_name_snapshot, cycle_base.program_name_snapshot,
          cycle.total_sessions_snapshot, cycle.baseline_used_sessions,
          cycle.lifecycle_status, cycle.payment_status,
          cycle.baseline_used_sessions + sum(x.contribution_units) over (
            partition by x.cycle_id order by x.occurrence_date,
              x.schedule_session_local_id, x.id rows unbounded preceding
          )::integer as running_session_number
        from public.center_tuition_attendance_contributions x
        join public.center_tuition_package_cycle_projection cycle
          on cycle.center_id = x.center_id and cycle.id = x.cycle_id
        join public.center_tuition_package_cycles cycle_base
          on cycle_base.center_id = cycle.center_id and cycle_base.id = cycle.id
        where x.center_id = p_center_id and x.ended_at is null
      ) item), '[]'::jsonb)
  );
end
$$;

alter function public.ph_1_internal_guard_parent_student_link() owner to postgres;
alter function public.f23_3e_p1a_guard_case_lifecycle() owner to postgres;
alter function public.f23_3e_p1a_guard_candidate_lifecycle() owner to postgres;
alter function public.f4b_internal_snapshot_package_program() owner to postgres;
alter function public.f4b_internal_snapshot_result(
  public.crm_contact_student_operational_link,
  public.consultation_case,
  public.consultation_case_candidate_student,
  public.center_cloud_entities,
  text, boolean, uuid
) owner to postgres;
alter function public.f4b_convert_crm_case_to_student(
  text, uuid, uuid, integer, integer, text, text, bigint, jsonb, text, text, uuid
) owner to postgres;
alter function public.ph_1_list_parent_student_links(text, boolean) owner to postgres;
alter function public.ph_1_create_parent_student_link(
  text, uuid, uuid, text, text, boolean, text, text, uuid, text, text
) owner to postgres;
alter function public.ph_1_update_parent_student_link(
  text, uuid, integer, text, boolean, text, text, uuid, text, text
) owner to postgres;
alter function public.v2_1_list_center_settings(text) owner to postgres;
alter function public.v2_1_mutate_center_settings(text, jsonb, uuid) owner to postgres;
alter function public.v2_4_list_package_cycle_state(text) owner to postgres;

revoke all on function public.f4b_internal_snapshot_package_program()
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1a_guard_case_lifecycle()
  from public, anon, authenticated, service_role;
revoke all on function public.f23_3e_p1a_guard_candidate_lifecycle()
  from public, anon, authenticated, service_role;
revoke all on function public.f4b_internal_snapshot_result(
  public.crm_contact_student_operational_link,
  public.consultation_case,
  public.consultation_case_candidate_student,
  public.center_cloud_entities,
  text, boolean, uuid
) from public, anon, authenticated, service_role;
revoke all on function public.f4b_convert_crm_case_to_student(
  text, uuid, uuid, integer, integer, text, text, bigint, jsonb, text, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.f4b_convert_crm_case_to_student(
  text, uuid, uuid, integer, integer, text, text, bigint, jsonb, text, text, uuid
) to authenticated;

revoke all on function public.ph_1_list_parent_student_links(text, boolean)
  from public, anon, service_role;
grant execute on function public.ph_1_list_parent_student_links(text, boolean)
  to authenticated;
revoke all on function public.ph_1_create_parent_student_link(
  text, uuid, uuid, text, text, boolean, text, text, uuid, text, text
) from public, anon, service_role;
grant execute on function public.ph_1_create_parent_student_link(
  text, uuid, uuid, text, text, boolean, text, text, uuid, text, text
) to authenticated;
revoke all on function public.ph_1_update_parent_student_link(
  text, uuid, integer, text, boolean, text, text, uuid, text, text
) from public, anon, service_role;
grant execute on function public.ph_1_update_parent_student_link(
  text, uuid, integer, text, boolean, text, text, uuid, text, text
) to authenticated;

revoke all on table public.crm_contact_student_operational_link
  from public, anon, authenticated, service_role;
revoke all on table public.center_tuition_package_catalog
  from public, anon, authenticated, service_role;
revoke all on table public.center_tuition_package_cycles
  from public, anon, authenticated, service_role;

comment on function public.f4b_convert_crm_case_to_student(
  text, uuid, uuid, integer, integer, text, text, bigint, jsonb, text, text, uuid
) is
  'F4B exact-center Owner/Admin atomic and idempotent conversion of the existing C5.3 Case/Candidate into one operational C5.1 Student plus PH-1 protected Contact link.';

commit;
