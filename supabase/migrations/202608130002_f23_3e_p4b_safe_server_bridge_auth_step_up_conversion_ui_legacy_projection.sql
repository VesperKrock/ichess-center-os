begin;

-- F23.3E-P4B: protected product orchestration for the browser -> Edge ->
-- canonical CRM conversion path.  Browser roles retain no direct access.

create table public.crm_conversion_bridge_session (
  bridge_session_id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null references public.center_crm_control(center_id) on delete restrict,
  source_record_id text not null,
  requester_user_id uuid not null references auth.users(id) on delete restrict,
  authority_environment_fingerprint bytea not null check (pg_catalog.octet_length(authority_environment_fingerprint)=32),
  prepare_idempotency_key_digest bytea not null check (pg_catalog.octet_length(prepare_idempotency_key_digest)=32),
  prepare_intent_digest bytea not null check (pg_catalog.octet_length(prepare_intent_digest)=32),
  contact_id uuid not null,
  contact_version integer not null check (contact_version>=1),
  consultation_case_id uuid not null,
  case_version integer not null check (case_version>=1),
  assignment_id uuid not null,
  assignment_version integer not null check (assignment_version>=1),
  candidate_student_id uuid not null,
  candidate_version integer not null check (candidate_version>=1),
  conversion_request_id uuid not null,
  request_version integer not null check (request_version>=1),
  student_p2_action_id uuid not null,
  guardian_p2_action_id uuid not null,
  relationship_action_id uuid not null,
  student_search_snapshot jsonb not null,
  guardian_search_snapshot jsonb not null,
  student_match_review_id uuid,
  student_review_version integer,
  guardian_match_review_id uuid,
  guardian_review_version integer,
  review_idempotency_key_digest bytea,
  review_intent_digest bytea,
  review_snapshot jsonb,
  execute_idempotency_key_digest bytea,
  execute_intent_digest bytea,
  p3d_execute_idempotency_key_digest bytea,
  safe_result_snapshot jsonb,
  status text not null default 'PREPARED'
    check (status in ('PREPARED','REVIEWED','COMPLETED','STALE')),
  bridge_version integer not null default 1 check (bridge_version>=1),
  created_at timestamptz not null default pg_catalog.transaction_timestamp(),
  updated_at timestamptz not null default pg_catalog.transaction_timestamp(),
  constraint crm_conversion_bridge_session_source_key unique(center_id,source_record_id),
  constraint crm_conversion_bridge_session_request_key unique(center_id,conversion_request_id),
  constraint crm_conversion_bridge_session_source_shape check (
    pg_catalog.length(pg_catalog.btrim(source_record_id)) between 1 and 200
    and source_record_id !~ '[[:cntrl:]]'
  ),
  constraint crm_conversion_bridge_session_review_shape check (
    (status='PREPARED' and student_match_review_id is null and guardian_match_review_id is null
      and review_idempotency_key_digest is null and review_intent_digest is null and review_snapshot is null)
    or
    (status in ('REVIEWED','COMPLETED','STALE') and student_match_review_id is not null
      and guardian_match_review_id is not null and student_review_version>=1 and guardian_review_version>=1
      and pg_catalog.octet_length(review_idempotency_key_digest)=32
      and pg_catalog.octet_length(review_intent_digest)=32 and review_snapshot is not null)
  ),
  constraint crm_conversion_bridge_session_result_shape check (
    (status<>'COMPLETED' and safe_result_snapshot is null)
    or
    (status='COMPLETED' and safe_result_snapshot is not null
      and pg_catalog.octet_length(execute_idempotency_key_digest)=32
      and pg_catalog.octet_length(execute_intent_digest)=32
      and pg_catalog.octet_length(p3d_execute_idempotency_key_digest)=32)
  ),
  constraint crm_conversion_bridge_session_contact_fkey foreign key(center_id,contact_id)
    references public.crm_contact(center_id,crm_contact_id) on delete restrict,
  constraint crm_conversion_bridge_session_case_fkey foreign key(center_id,consultation_case_id,contact_id)
    references public.consultation_case(center_id,consultation_case_id,primary_contact_id) on delete restrict,
  constraint crm_conversion_bridge_session_assignment_fkey foreign key(center_id,consultation_case_id,assignment_id)
    references public.consultation_case_assignment(center_id,consultation_case_id,assignment_id) on delete restrict,
  constraint crm_conversion_bridge_session_candidate_fkey foreign key(center_id,consultation_case_id,candidate_student_id)
    references public.consultation_case_candidate_student(center_id,consultation_case_id,candidate_student_id) on delete restrict,
  constraint crm_conversion_bridge_session_request_fkey foreign key(center_id,conversion_request_id)
    references public.crm_conversion_request(center_id,conversion_request_id) on delete restrict
);

alter table public.crm_conversion_bridge_session enable row level security;
alter table public.crm_conversion_bridge_session force row level security;
revoke all on table public.crm_conversion_bridge_session from public,anon,authenticated,service_role;

create function public.f23_3e_p4b_internal_guard_bridge_session()
returns trigger language plpgsql set search_path=''
as $f23_3e_p4b_internal_guard_bridge_session$
begin
  if pg_catalog.current_setting('ichess.p4b_bridge_write',true)<>'on' then
    raise exception 'P4B_BRIDGE_WRITE_FORBIDDEN';
  end if;
  if tg_op='UPDATE' then
    if new.bridge_session_id<>old.bridge_session_id or new.center_id<>old.center_id
       or new.source_record_id<>old.source_record_id or new.requester_user_id<>old.requester_user_id
       or new.authority_environment_fingerprint<>old.authority_environment_fingerprint
       or new.prepare_idempotency_key_digest<>old.prepare_idempotency_key_digest
       or new.prepare_intent_digest<>old.prepare_intent_digest
       or new.contact_id<>old.contact_id or new.consultation_case_id<>old.consultation_case_id
       or new.assignment_id<>old.assignment_id or new.candidate_student_id<>old.candidate_student_id
       or new.conversion_request_id<>old.conversion_request_id
       or new.student_p2_action_id<>old.student_p2_action_id
       or new.guardian_p2_action_id<>old.guardian_p2_action_id
       or new.relationship_action_id<>old.relationship_action_id
       or new.student_search_snapshot<>old.student_search_snapshot
       or new.guardian_search_snapshot<>old.guardian_search_snapshot
       or new.bridge_version<>old.bridge_version+1 then
      raise exception 'P4B_BRIDGE_BINDING_IMMUTABLE';
    end if;
    if old.status='COMPLETED' then raise exception 'P4B_BRIDGE_TERMINAL_IMMUTABLE'; end if;
  end if;
  return new;
end;
$f23_3e_p4b_internal_guard_bridge_session$;

create trigger crm_conversion_bridge_session_guard
before insert or update or delete on public.crm_conversion_bridge_session
for each row execute function public.f23_3e_p4b_internal_guard_bridge_session();

create function public.f23_3e_p4b_internal_digest(p_domain text,p_payload jsonb)
returns bytea language sql immutable strict set search_path=''
as $f23_3e_p4b_internal_digest$
  select extensions.digest(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object('domain',p_domain,'payload',p_payload)::text,'UTF8'),
    'sha256'
  )
$f23_3e_p4b_internal_digest$;

create function public.f23_3e_p4b_internal_child_digest(p_parent bytea,p_operation text)
returns bytea language sql immutable strict set search_path=''
as $f23_3e_p4b_internal_child_digest$
  select extensions.digest(p_parent||pg_catalog.convert_to('|'||p_operation,'UTF8'),'sha256')
$f23_3e_p4b_internal_child_digest$;

create function public.f23_3e_p4b_internal_assert_membership(
  p_center_id text,p_actor_user_id uuid,p_allowed_roles text[]
) returns public.center_members
language plpgsql stable security definer set search_path=''
as $f23_3e_p4b_internal_assert_membership$
declare v_member public.center_members%rowtype;
begin
  select m.* into v_member from public.center_members m
  where m.center_id=p_center_id and m.user_id=p_actor_user_id and m.status='active';
  if not found or not (v_member.role=any(p_allowed_roles)) then
    raise exception 'P4B_ACCESS_DENIED';
  end if;
  return v_member;
end;
$f23_3e_p4b_internal_assert_membership$;

create function public.f23_3e_p4b_internal_safe_projection(
  p_center_id text,p_conversion_request_id uuid,p_execution jsonb
) returns jsonb language plpgsql stable security definer set search_path=''
as $f23_3e_p4b_internal_safe_projection$
declare v_student_item jsonb; v_guardian_item jsonb; v_relationship_item jsonb;
  v_student public.student_profile%rowtype; v_guardian public.guardian_profile%rowtype;
  v_relationship public.guardian_student_relationship%rowtype;
begin
  if p_execution->>'outcome_code'<>'REAL_CONVERSION_COMPLETED'
     or p_execution->>'request_status'<>'COMPLETED' then raise exception 'P4B_RESULT_UNAVAILABLE'; end if;
  select e.value into v_student_item from pg_catalog.jsonb_array_elements(p_execution->'executed_action_results') e
    where e.value->>'action_kind' like '%STUDENT' limit 1;
  select e.value into v_guardian_item from pg_catalog.jsonb_array_elements(p_execution->'executed_action_results') e
    where e.value->>'action_kind' like '%GUARDIAN' limit 1;
  select e.value into v_relationship_item from pg_catalog.jsonb_array_elements(p_execution->'executed_action_results') e
    where e.value->>'action_kind' not like '%STUDENT' and e.value->>'action_kind' not like '%GUARDIAN' limit 1;
  if v_student_item->>'target_id' is not null then
    select s.* into v_student from public.student_profile s where s.center_id=p_center_id
      and s.student_id=(v_student_item->>'target_id')::uuid and s.profile_status='ACTIVE';
    if not found then raise exception 'P4B_RESULT_UNAVAILABLE'; end if;
  end if;
  if v_guardian_item->>'target_id' is not null then
    select g.* into v_guardian from public.guardian_profile g where g.center_id=p_center_id
      and g.guardian_id=(v_guardian_item->>'target_id')::uuid and g.guardian_status='ACTIVE';
    if not found then raise exception 'P4B_RESULT_UNAVAILABLE'; end if;
  end if;
  if v_relationship_item->>'target_id' is not null then
    select r.* into v_relationship from public.guardian_student_relationship r where r.center_id=p_center_id
      and r.relationship_id=(v_relationship_item->>'target_id')::uuid
      and r.status='ACTIVE';
    if not found then raise exception 'P4B_RESULT_UNAVAILABLE'; end if;
  end if;
  return pg_catalog.jsonb_build_object(
    'result_schema_version',1,'status','COMPLETED','conversion_request_id',p_conversion_request_id,
    'request_version',(p_execution->>'request_version')::integer,
    'correlation_id',p_execution->>'correlation_id',
    'student',case when v_student.student_id is null then null else pg_catalog.jsonb_build_object(
      'canonical_id',v_student.student_id,'version',v_student.student_version,
      'display_name',v_student.display_name,'status',v_student.profile_status,
      'projection_kind','canonical_student_v1','read_only',true) end,
    'guardian',case when v_guardian.guardian_id is null then null else pg_catalog.jsonb_build_object(
      'canonical_id',v_guardian.guardian_id,'version',v_guardian.guardian_version,
      'display_name',v_guardian.display_name,'status',v_guardian.guardian_status,
      'projection_kind','canonical_guardian_v1','read_only',true) end,
    'relationship',case when v_relationship.relationship_id is null then null else pg_catalog.jsonb_build_object(
      'canonical_id',v_relationship.relationship_id,'version',v_relationship.relationship_version,
      'relationship_type',v_relationship.relationship_type,'is_primary_contact',v_relationship.is_primary_contact,
      'financial_contact_role',v_relationship.financial_contact_role,
      'academic_contact_role',v_relationship.academic_contact_role,'status',v_relationship.status,
      'projection_kind','canonical_guardian_student_relationship_v1','read_only',true) end
  );
end;
$f23_3e_p4b_internal_safe_projection$;

create function public.f23_3e_p4b_prepare_conversion(
  p_center_id text,p_actor_user_id uuid,p_source_record_id text,p_guardian_display_name text,
  p_phones text[],p_emails text[],p_student_display_name text,p_student_birth_date date,
  p_learning_need_summary text,p_preferred_schedule_summary text,
  p_authority_environment_fingerprint bytea,p_idempotency_key_digest bytea,p_idempotency_expires_at timestamptz
) returns jsonb language plpgsql volatile security definer set search_path=''
as $f23_3e_p4b_prepare_conversion$
declare v_member public.center_members%rowtype; v_root public.center_crm_control%rowtype;
  v_existing public.crm_conversion_bridge_session%rowtype; v_contact record; v_case record; v_assignment record;
  v_case_consulting record; v_case_ready record; v_draft record; v_submit record; v_birth record;
  v_candidate uuid:=pg_catalog.gen_random_uuid(); v_case_id uuid:=pg_catalog.gen_random_uuid();
  v_assignment_id uuid:=pg_catalog.gen_random_uuid(); v_bridge uuid:=pg_catalog.gen_random_uuid();
  v_student_action uuid:=pg_catalog.gen_random_uuid(); v_guardian_action uuid:=pg_catalog.gen_random_uuid();
  v_relationship_action uuid:=pg_catalog.gen_random_uuid(); v_intent bytea; v_action_graph bytea;
  v_student_policy public.crm_identity_policy_registry%rowtype;
  v_guardian_policy public.crm_identity_policy_registry%rowtype;
  v_student_search jsonb; v_guardian_search jsonb; v_result jsonb; v_corr uuid:=pg_catalog.gen_random_uuid();
begin
  if p_center_id is null or pg_catalog.btrim(p_center_id)='' or p_actor_user_id is null
     or p_source_record_id is null or pg_catalog.length(pg_catalog.btrim(p_source_record_id)) not between 1 and 200
     or p_guardian_display_name is null or pg_catalog.length(pg_catalog.btrim(p_guardian_display_name)) not between 1 and 240
     or p_student_display_name is null or pg_catalog.length(pg_catalog.btrim(p_student_display_name)) not between 1 and 240
     or p_student_birth_date is null or p_student_birth_date>=pg_catalog.transaction_timestamp()::date
     or p_authority_environment_fingerprint is null or pg_catalog.octet_length(p_authority_environment_fingerprint)<>32
     or p_idempotency_key_digest is null or pg_catalog.octet_length(p_idempotency_key_digest)<>32
     or p_idempotency_expires_at<=pg_catalog.transaction_timestamp()
     or p_idempotency_expires_at>pg_catalog.transaction_timestamp()+interval '24 hours' then
    raise exception 'P4B_INVALID_INPUT';
  end if;
  v_intent:=public.f23_3e_p4b_internal_digest('ichess.crm.p4b.prepare.v1',pg_catalog.jsonb_build_object(
    'center_id',p_center_id,'source_record_id',p_source_record_id,'guardian_display_name',pg_catalog.btrim(p_guardian_display_name),
    'phones',p_phones,'emails',p_emails,'student_display_name',pg_catalog.btrim(p_student_display_name),
    'student_birth_date',p_student_birth_date,'learning_need_summary',p_learning_need_summary,
    'preferred_schedule_summary',p_preferred_schedule_summary));
  select r.center_id into strict p_center_id from public.center_crm_control r where r.center_id=p_center_id;
  select * into v_root from public.center_crm_control r where r.center_id=p_center_id for update;
  if v_root.crm_state<>'ACTIVE' or v_root.feature_flag_state<>'ENABLED' then raise exception 'P4B_RESOURCE_NOT_AVAILABLE'; end if;
  v_member:=public.f23_3e_p4b_internal_assert_membership(p_center_id,p_actor_user_id,array['consultant']::text[]);
  select s.* into v_existing from public.crm_conversion_bridge_session s
    where s.center_id=p_center_id and s.source_record_id=p_source_record_id for update;
  if found then
    if v_existing.prepare_idempotency_key_digest is distinct from p_idempotency_key_digest
       or v_existing.prepare_intent_digest is distinct from v_intent
       or v_existing.requester_user_id<>p_actor_user_id
       or v_existing.authority_environment_fingerprint is distinct from p_authority_environment_fingerprint then
      raise exception 'P4B_IDEMPOTENCY_CONFLICT';
    end if;
    return pg_catalog.jsonb_build_object('ok',true,'outcome_code','P4B_PREPARED','replayed',true,
      'bridge_session_id',v_existing.bridge_session_id,'bridge_version',v_existing.bridge_version,
      'status',v_existing.status,'conversion_request_id',v_existing.conversion_request_id,
      'student_search',v_existing.student_search_snapshot,'guardian_search',v_existing.guardian_search_snapshot,
      'review',v_existing.review_snapshot,'result',v_existing.safe_result_snapshot);
  end if;
  select * into strict v_contact from public.f23_3e_p4a_ingress_canonical_contact(
    p_center_id,p_actor_user_id,p_source_record_id,p_guardian_display_name,p_phones,p_emails);
  if not v_contact.ok then raise exception 'P4B_CONTACT_INGRESS_FAILED'; end if;
  select * into strict v_case from public.f23_3e_p1d_create_consultation_case(
    v_case_id,v_contact.crm_contact_id,p_actor_user_id,v_contact.contact_version);
  if not v_case.ok then raise exception 'P4B_CASE_CREATE_FAILED'; end if;
  -- P1A's deferred circular Case/Assignment assertions retain the NEW image
  -- of each statement.  Validate the legitimate zero-assignment state before
  -- adding the assignment, then defer the next complete pointer transition.
  execute 'set constraints all immediate';
  execute 'set constraints all deferred';
  select * into strict v_assignment from public.f23_3e_p1d_assign_consultation_case(
    v_assignment_id,v_case_id,p_actor_user_id,p_actor_user_id,v_case.case_version);
  if not v_assignment.ok then raise exception 'P4B_ASSIGNMENT_FAILED'; end if;
  execute 'set constraints all immediate';
  execute 'set constraints all deferred';
  perform pg_catalog.set_config('ichess.p4b_candidate_write','on',true);
  insert into public.consultation_case_candidate_student(
    candidate_student_id,center_id,consultation_case_id,display_name_evidence,
    learning_need_summary,preferred_schedule_summary,candidate_status,candidate_version
  ) values(v_candidate,p_center_id,v_case_id,pg_catalog.btrim(p_student_display_name),
    nullif(pg_catalog.btrim(p_learning_need_summary),''),nullif(pg_catalog.btrim(p_preferred_schedule_summary),''),'DRAFT',1);
  update public.consultation_case_candidate_student set candidate_status='ACTIVE',candidate_version=2,
    updated_at=pg_catalog.transaction_timestamp() where candidate_student_id=v_candidate;
  select * into strict v_birth from public.f23_3e_p3d_internal_protect_candidate_birth_evidence(
    p_center_id,v_case_id,v_candidate,2,p_student_birth_date);
  perform public.f23_3e_p3b_internal_append_audit_outbox(p_center_id,'crm.candidate.protected_ingressed',
    p_actor_user_id,'consultation_case_candidate_student',v_candidate,null,v_assignment_id,null,
    v_birth.candidate_version,'ACTIVE','protected_candidate_ingressed','crm.p4b.prepare','CANDIDATE_INGRESSED',v_corr);
  select * into strict v_case_consulting from public.f23_3e_p1d_transition_consultation_case_status(
    v_case_id,p_actor_user_id,v_assignment.case_version,'CONSULTING','p4b_consultation_started');
  if not v_case_consulting.ok then raise exception 'P4B_CASE_STATE_FAILED'; end if;
  select * into strict v_case_ready from public.f23_3e_p1d_transition_consultation_case_status(
    v_case_id,p_actor_user_id,v_case_consulting.case_version,'READY_FOR_CONVERSION','p4b_conversion_prepared');
  if not v_case_ready.ok then raise exception 'P4B_CASE_STATE_FAILED'; end if;
  v_action_graph:=public.f23_3e_p4b_internal_digest('ichess.crm.p4b.legacy-action-graph.v1',
    pg_catalog.jsonb_build_object('bridge_session_id',v_bridge,'student_action_id',v_student_action,
      'guardian_action_id',v_guardian_action,'relationship_action_id',v_relationship_action));
  select * into strict v_draft from public.f23_3e_p1b_create_conversion_draft(
    v_case_id,p_actor_user_id,v_case_ready.case_version,v_contact.contact_version,v_assignment.assignment_version,
    p_authority_environment_fingerprint,public.f23_3e_p4b_internal_child_digest(p_idempotency_key_digest,'draft'),
    v_intent,v_action_graph,p_idempotency_expires_at);
  if not v_draft.ok then raise exception 'P4B_DRAFT_FAILED'; end if;
  select * into strict v_submit from public.f23_3e_p1b_submit_conversion_draft(
    v_draft.conversion_request_id,p_actor_user_id,v_draft.request_version,v_draft.case_version,
    v_contact.contact_version,v_assignment.assignment_version,v_intent,v_action_graph,
    p_authority_environment_fingerprint,public.f23_3e_p4b_internal_child_digest(p_idempotency_key_digest,'submit'),
    public.f23_3e_p4b_internal_child_digest(v_intent,'submit'),p_idempotency_expires_at);
  if not v_submit.ok then raise exception 'P4B_SUBMIT_FAILED'; end if;
  select p.* into strict v_student_policy from public.crm_identity_policy_registry p
    where p.center_id=p_center_id and p.identity_kind='STUDENT' and p.status='CURRENT';
  select p.* into strict v_guardian_policy from public.crm_identity_policy_registry p
    where p.center_id=p_center_id and p.identity_kind='GUARDIAN' and p.status='CURRENT';
  v_student_search:=public.f23_3e_p2b_search_masked_candidates(v_draft.conversion_request_id,p_actor_user_id,
    v_submit.request_version,'STUDENT',v_candidate,v_contact.contact_version,v_submit.case_version,
    v_birth.candidate_version,p_student_display_name,p_student_birth_date,null,
    v_student_policy.normalization_version,v_student_policy.match_policy_version,
    v_student_policy.minimum_evidence_policy_version,v_student_policy.policy_registry_version,1);
  v_guardian_search:=public.f23_3e_p2b_search_masked_candidates(v_draft.conversion_request_id,p_actor_user_id,
    v_submit.request_version,'GUARDIAN',v_candidate,v_contact.contact_version,v_submit.case_version,
    v_birth.candidate_version,p_guardian_display_name,null,null,
    v_guardian_policy.normalization_version,v_guardian_policy.match_policy_version,
    v_guardian_policy.minimum_evidence_policy_version,v_guardian_policy.policy_registry_version,1);
  if coalesce((v_student_search->>'ok')::boolean,false) is not true
     or coalesce((v_guardian_search->>'ok')::boolean,false) is not true then raise exception 'P4B_MATCH_SEARCH_UNAVAILABLE'; end if;
  perform pg_catalog.set_config('ichess.p4b_bridge_write','on',true);
  insert into public.crm_conversion_bridge_session(
    bridge_session_id,center_id,source_record_id,requester_user_id,authority_environment_fingerprint,
    prepare_idempotency_key_digest,prepare_intent_digest,contact_id,contact_version,
    consultation_case_id,case_version,assignment_id,assignment_version,candidate_student_id,candidate_version,
    conversion_request_id,request_version,student_p2_action_id,guardian_p2_action_id,relationship_action_id,
    student_search_snapshot,guardian_search_snapshot
  ) values(v_bridge,p_center_id,p_source_record_id,p_actor_user_id,p_authority_environment_fingerprint,
    p_idempotency_key_digest,v_intent,v_contact.crm_contact_id,v_contact.contact_version,v_case_id,v_submit.case_version,
    v_assignment_id,v_assignment.assignment_version,v_candidate,v_birth.candidate_version,v_draft.conversion_request_id,
    v_submit.request_version,v_student_action,v_guardian_action,v_relationship_action,v_student_search,v_guardian_search);
  v_result:=pg_catalog.jsonb_build_object('ok',true,'outcome_code','P4B_PREPARED','replayed',false,
    'bridge_session_id',v_bridge,'bridge_version',1,'status','PREPARED',
    'conversion_request_id',v_draft.conversion_request_id,'student_search',v_student_search,
    'guardian_search',v_guardian_search,'review',null,'result',null);
  return v_result;
exception when no_data_found then raise exception 'P4B_RESOURCE_NOT_AVAILABLE';
end;
$f23_3e_p4b_prepare_conversion$;

create function public.f23_3e_p4b_review_conversion(
  p_bridge_session_id uuid,p_actor_user_id uuid,p_expected_bridge_version integer,
  p_student_decision text,p_student_opaque_target_id uuid,p_student_expected_target_version integer,
  p_guardian_decision text,p_guardian_opaque_target_id uuid,p_guardian_expected_target_version integer,
  p_relationship_decision text,p_idempotency_key_digest bytea,p_idempotency_expires_at timestamptz
) returns jsonb language plpgsql volatile security definer set search_path=''
as $f23_3e_p4b_review_conversion$
declare v_center text; v_session public.crm_conversion_bridge_session%rowtype; v_member public.center_members%rowtype;
  v_request public.crm_conversion_request%rowtype; v_contact public.crm_contact%rowtype;
  v_candidate public.consultation_case_candidate_student%rowtype;
  v_student_policy public.crm_identity_policy_registry%rowtype; v_guardian_policy public.crm_identity_policy_registry%rowtype;
  v_birth date; v_intent bytea; v_kind text; v_decision text; v_action uuid; v_target uuid; v_target_version integer;
  v_display text; v_birth_arg date; v_policy public.crm_identity_policy_registry%rowtype;
  v_created jsonb; v_decided jsonb; v_reserved jsonb; v_student_review uuid; v_guardian_review uuid;
  v_materialized record; v_finalized record; v_result jsonb; v_relationship text; v_reason text;
begin
  if p_bridge_session_id is null or p_actor_user_id is null or p_expected_bridge_version<1
     or p_student_decision not in ('CREATE_NEW','REUSE_EXISTING','DO_NOT_CREATE')
     or p_guardian_decision not in ('CREATE_NEW','REUSE_EXISTING','DO_NOT_CREATE')
     or p_relationship_decision not in ('CREATE_RELATIONSHIP','REUSE_EXISTING_RELATIONSHIP','DO_NOT_CREATE_RELATIONSHIP')
     or p_idempotency_key_digest is null or pg_catalog.octet_length(p_idempotency_key_digest)<>32
     or p_idempotency_expires_at<=pg_catalog.transaction_timestamp()
     or p_idempotency_expires_at>pg_catalog.transaction_timestamp()+interval '24 hours' then raise exception 'P4B_INVALID_INPUT'; end if;
  if (p_student_opaque_target_id is null)<>(p_student_expected_target_version is null)
     or (p_guardian_opaque_target_id is null)<>(p_guardian_expected_target_version is null)
     or (p_student_decision='REUSE_EXISTING' and p_student_opaque_target_id is null)
     or (p_guardian_decision='REUSE_EXISTING' and p_guardian_opaque_target_id is null)
     or (p_student_decision='CREATE_NEW' and p_student_opaque_target_id is not null)
     or (p_guardian_decision='CREATE_NEW' and p_guardian_opaque_target_id is not null) then
    raise exception 'P4B_INVALID_INPUT';
  end if;
  select s.center_id into v_center from public.crm_conversion_bridge_session s where s.bridge_session_id=p_bridge_session_id;
  if not found then raise exception 'P4B_RESOURCE_NOT_AVAILABLE'; end if;
  perform r.center_id from public.center_crm_control r where r.center_id=v_center for update;
  select s.* into v_session from public.crm_conversion_bridge_session s where s.bridge_session_id=p_bridge_session_id for update;
  v_member:=public.f23_3e_p4b_internal_assert_membership(v_center,p_actor_user_id,array['consultant']::text[]);
  if v_session.requester_user_id<>p_actor_user_id then raise exception 'P4B_ACTOR_SEPARATION_REQUIRED'; end if;
  v_intent:=public.f23_3e_p4b_internal_digest('ichess.crm.p4b.review.v1',pg_catalog.jsonb_build_object(
    'bridge_session_id',p_bridge_session_id,'student_decision',p_student_decision,
    'student_target_id',p_student_opaque_target_id,'student_target_version',p_student_expected_target_version,
    'guardian_decision',p_guardian_decision,'guardian_target_id',p_guardian_opaque_target_id,
    'guardian_target_version',p_guardian_expected_target_version,'relationship_decision',p_relationship_decision));
  if v_session.status in ('REVIEWED','COMPLETED') then
    if v_session.review_idempotency_key_digest is distinct from p_idempotency_key_digest
       or v_session.review_intent_digest is distinct from v_intent then raise exception 'P4B_IDEMPOTENCY_CONFLICT'; end if;
    return v_session.review_snapshot||pg_catalog.jsonb_build_object('replayed',true,'status',v_session.status,
      'bridge_version',v_session.bridge_version,'result',v_session.safe_result_snapshot);
  end if;
  if v_session.status<>'PREPARED' or v_session.bridge_version<>p_expected_bridge_version then raise exception 'P4B_STATE_STALE'; end if;
  select r.* into v_request from public.crm_conversion_request r where r.conversion_request_id=v_session.conversion_request_id for update;
  select c.* into v_contact from public.crm_contact c where c.crm_contact_id=v_session.contact_id for update;
  select c.* into v_candidate from public.consultation_case_candidate_student c where c.candidate_student_id=v_session.candidate_student_id for update;
  if v_request.status<>'READY_FOR_REVIEW' or v_request.request_version<>v_session.request_version
     or v_contact.contact_version<>v_session.contact_version or v_candidate.candidate_version<>v_session.candidate_version then
    raise exception 'P4B_SOURCE_STALE';
  end if;
  v_birth:=public.f23_3e_p3d_internal_unwrap_candidate_birth_evidence(v_center,v_session.consultation_case_id,
    v_session.candidate_student_id,v_session.candidate_version);
  select p.* into strict v_student_policy from public.crm_identity_policy_registry p
    where p.center_id=v_center and p.identity_kind='STUDENT' and p.status='CURRENT';
  select p.* into strict v_guardian_policy from public.crm_identity_policy_registry p
    where p.center_id=v_center and p.identity_kind='GUARDIAN' and p.status='CURRENT';
  for v_kind in select pg_catalog.unnest(array['STUDENT','GUARDIAN']::text[]) loop
    if v_kind='STUDENT' then v_decision:=p_student_decision;v_action:=v_session.student_p2_action_id;
      v_target:=p_student_opaque_target_id;v_target_version:=p_student_expected_target_version;
      v_display:=v_candidate.display_name_evidence;v_birth_arg:=v_birth;v_policy:=v_student_policy;
    else v_decision:=p_guardian_decision;v_action:=v_session.guardian_p2_action_id;
      v_target:=p_guardian_opaque_target_id;v_target_version:=p_guardian_expected_target_version;
      v_display:=v_contact.display_name;v_birth_arg:=null;v_policy:=v_guardian_policy;
    end if;
    v_created:=public.f23_3e_p2c_create_match_review(v_session.conversion_request_id,p_actor_user_id,
      v_session.request_version,v_kind,v_session.candidate_student_id,v_session.contact_version,v_session.case_version,
      v_session.candidate_version,v_display,v_birth_arg,null,v_policy.normalization_version,v_policy.match_policy_version,
      v_policy.minimum_evidence_policy_version,v_policy.policy_registry_version,1,v_action,
      public.f23_3e_p4b_internal_child_digest(p_idempotency_key_digest,pg_catalog.lower(v_kind)||'-review'),
      v_target,v_target_version,null);
    if coalesce((v_created->>'ok')::boolean,false) is not true then
      raise exception 'P4B_REVIEW_CREATE_FAILED_%',coalesce(v_created->>'outcome_code','UNKNOWN');
    end if;
    v_decided:=public.f23_3e_p2c_decide_match_review(v_session.conversion_request_id,(v_created->>'resource_id')::uuid,
      (v_created->>'resource_version')::integer,
      case v_decision when 'CREATE_NEW' then 'PREPARE_CREATE_NEW' when 'REUSE_EXISTING' then 'REUSE_EXISTING' else 'REJECT_IDENTITY_ACTION' end,
      p_actor_user_id,v_session.request_version,v_kind,v_session.candidate_student_id,v_session.contact_version,
      v_session.case_version,v_session.candidate_version,v_display,v_birth_arg,null,v_policy.normalization_version,
      v_policy.match_policy_version,v_policy.minimum_evidence_policy_version,v_policy.policy_registry_version,1,v_action,
      public.f23_3e_p4b_internal_child_digest(p_idempotency_key_digest,pg_catalog.lower(v_kind)||'-decision'));
    if coalesce((v_decided->>'ok')::boolean,false) is not true then
      raise exception 'P4B_REVIEW_DECISION_FAILED_%',coalesce(v_decided->>'outcome_code','UNKNOWN');
    end if;
    if v_decision='CREATE_NEW' then
      v_reserved:=public.f23_3e_p2c_reserve_create_target(v_session.conversion_request_id,
        (v_created->>'resource_id')::uuid,(v_decided->>'resource_version')::integer,p_actor_user_id,
        v_session.request_version,v_kind,v_session.candidate_student_id,v_session.contact_version,v_session.case_version,
        v_session.candidate_version,v_display,v_birth_arg,null,v_policy.normalization_version,v_policy.match_policy_version,
        v_policy.minimum_evidence_policy_version,v_policy.policy_registry_version,1,v_action,
        public.f23_3e_p4b_internal_child_digest(p_idempotency_key_digest,pg_catalog.lower(v_kind)||'-reservation'));
      if coalesce((v_reserved->>'ok')::boolean,false) is not true then
        raise exception 'P4B_RESERVATION_FAILED_%',coalesce(v_reserved->>'outcome_code','UNKNOWN');
      end if;
    end if;
    if v_kind='STUDENT' then v_student_review:=(v_created->>'resource_id')::uuid;
    else v_guardian_review:=(v_created->>'resource_id')::uuid; end if;
  end loop;
  if p_student_decision='DO_NOT_CREATE' or p_guardian_decision='DO_NOT_CREATE' then
    if p_relationship_decision<>'DO_NOT_CREATE_RELATIONSHIP' then raise exception 'P4B_RELATIONSHIP_DECISION_INVALID'; end if;
    v_relationship:='DO_NOT_CREATE_RELATIONSHIP';v_reason:='EXPLICIT_REVIEWED_NO_CREATE';
  else v_relationship:=p_relationship_decision;v_reason:='P4B_HUMAN_REVIEWED'; end if;
  select * into strict v_materialized from public.f23_3e_p3c_materialize_reviewed_action_pair(
    p_actor_user_id,v_session.conversion_request_id,v_session.request_version,v_guardian_review,2,v_student_review,2,
    v_session.relationship_action_id,v_relationship,
    case when v_relationship='DO_NOT_CREATE_RELATIONSHIP' then null else 'PARENT' end,
    case when v_relationship='DO_NOT_CREATE_RELATIONSHIP' then null else true end,
    case when v_relationship='DO_NOT_CREATE_RELATIONSHIP' then null else 'PRIMARY' end,
    case when v_relationship='DO_NOT_CREATE_RELATIONSHIP' then null else 'PRIMARY' end,
    v_reason,v_request.relationship_policy_version,public.f23_3e_p4b_internal_child_digest(v_intent,'materialize'),
    public.f23_3e_p4b_internal_child_digest(p_idempotency_key_digest,'materialize'),p_idempotency_expires_at);
  if not v_materialized.ok then raise exception 'P4B_PLAN_MATERIALIZE_FAILED_%',v_materialized.outcome_code; end if;
  select * into strict v_finalized from public.f23_3e_p3c_finalize_reviewed_action_plan(
    p_actor_user_id,v_session.conversion_request_id,v_session.request_version,3,
    public.f23_3e_p4b_internal_child_digest(v_intent,'finalize'),
    public.f23_3e_p4b_internal_child_digest(p_idempotency_key_digest,'finalize'),p_idempotency_expires_at);
  if not v_finalized.ok then raise exception 'P4B_PLAN_FINALIZE_FAILED_%',v_finalized.outcome_code; end if;
  v_result:=pg_catalog.jsonb_build_object('ok',true,'outcome_code','P4B_REVIEWED_PLAN_READY','replayed',false,
    'bridge_session_id',p_bridge_session_id,'bridge_version',v_session.bridge_version+1,'status','REVIEWED',
    'conversion_request_id',v_session.conversion_request_id,
    'student_review',pg_catalog.jsonb_build_object('review_id',v_student_review,'version',2,'decision',p_student_decision),
    'guardian_review',pg_catalog.jsonb_build_object('review_id',v_guardian_review,'version',2,'decision',p_guardian_decision),
    'relationship_decision',v_relationship,'action_set_encoding_version',v_finalized.action_set_encoding_version,
    'result',null);
  perform pg_catalog.set_config('ichess.p4b_bridge_write','on',true);
  update public.crm_conversion_bridge_session set student_match_review_id=v_student_review,student_review_version=2,
    guardian_match_review_id=v_guardian_review,guardian_review_version=2,review_idempotency_key_digest=p_idempotency_key_digest,
    review_intent_digest=v_intent,review_snapshot=v_result,status='REVIEWED',bridge_version=bridge_version+1,
    updated_at=pg_catalog.transaction_timestamp() where bridge_session_id=p_bridge_session_id;
  return v_result;
exception when no_data_found then raise exception 'P4B_RESOURCE_NOT_AVAILABLE';
end;
$f23_3e_p4b_review_conversion$;

create function public.f23_3e_p4b_approve_execute_conversion(
  p_bridge_session_id uuid,p_actor_user_id uuid,p_expected_bridge_version integer,
  p_logical_security_session_id uuid,p_assurance_level text,p_verification_provider_namespace text,
  p_verification_reference_digest bytea,p_server_verified_at timestamptz,p_account_evidence_digest bytea,
  p_authority_environment_fingerprint bytea,p_idempotency_key_digest bytea,p_idempotency_expires_at timestamptz
) returns jsonb language plpgsql volatile security definer set search_path=''
as $f23_3e_p4b_approve_execute_conversion$
declare v_center text; v_session public.crm_conversion_bridge_session%rowtype; v_member public.center_members%rowtype;
  v_assignment public.consultation_case_assignment%rowtype; v_active_count integer; v_control_version integer;
  v_intent bytea; v_security record; v_step record; v_authority record; v_execution record;
  v_execution_json jsonb; v_projection jsonb; v_result jsonb; v_corr uuid:=pg_catalog.gen_random_uuid();
begin
  if p_bridge_session_id is null or p_actor_user_id is null or p_expected_bridge_version<1
     or p_logical_security_session_id is null or p_assurance_level<>'AAL2_TOTP'
     or p_verification_provider_namespace<>'supabase.auth.totp.v1'
     or p_verification_reference_digest is null or pg_catalog.octet_length(p_verification_reference_digest)<>32
     or p_account_evidence_digest is null or pg_catalog.octet_length(p_account_evidence_digest)<>32
     or p_authority_environment_fingerprint is null or pg_catalog.octet_length(p_authority_environment_fingerprint)<>32
     or p_idempotency_key_digest is null or pg_catalog.octet_length(p_idempotency_key_digest)<>32
     or p_server_verified_at<pg_catalog.transaction_timestamp()-interval '2 minutes'
     or p_server_verified_at>pg_catalog.transaction_timestamp()+interval '30 seconds'
     or p_idempotency_expires_at<=pg_catalog.transaction_timestamp()
     or p_idempotency_expires_at>pg_catalog.transaction_timestamp()+interval '24 hours' then raise exception 'P4B_STEP_UP_REQUIRED'; end if;
  select s.center_id into v_center from public.crm_conversion_bridge_session s where s.bridge_session_id=p_bridge_session_id;
  if not found then raise exception 'P4B_RESOURCE_NOT_AVAILABLE'; end if;
  perform r.center_id from public.center_crm_control r where r.center_id=v_center for update;
  select s.* into v_session from public.crm_conversion_bridge_session s where s.bridge_session_id=p_bridge_session_id for update;
  v_intent:=public.f23_3e_p4b_internal_digest('ichess.crm.p4b.approve-execute.v1',pg_catalog.jsonb_build_object(
    'bridge_session_id',p_bridge_session_id,'actor_user_id',p_actor_user_id,
    'logical_security_session_id',p_logical_security_session_id,'assurance_level',p_assurance_level,
    'verification_provider_namespace',p_verification_provider_namespace,
    'verification_reference_digest',pg_catalog.encode(p_verification_reference_digest,'hex'),
    'authority_environment_fingerprint',pg_catalog.encode(p_authority_environment_fingerprint,'hex')));
  if v_session.status='COMPLETED' then
    if v_session.execute_idempotency_key_digest is distinct from p_idempotency_key_digest
       or v_session.execute_intent_digest is distinct from v_intent then raise exception 'P4B_IDEMPOTENCY_CONFLICT'; end if;
    return v_session.safe_result_snapshot||pg_catalog.jsonb_build_object('replayed',true,
      'bridge_session_id',p_bridge_session_id,'bridge_version',v_session.bridge_version);
  end if;
  if v_session.status<>'REVIEWED' or v_session.bridge_version<>p_expected_bridge_version then raise exception 'P4B_STATE_STALE'; end if;
  if v_session.authority_environment_fingerprint is distinct from p_authority_environment_fingerprint then
    raise exception 'P4B_ENVIRONMENT_MISMATCH';
  end if;
  v_member:=public.f23_3e_p4b_internal_assert_membership(v_center,p_actor_user_id,array['owner','center_admin']::text[]);
  select pg_catalog.count(*) into v_active_count from public.center_members m
    where m.user_id=p_actor_user_id and m.status='active';
  if v_active_count<>1 then raise exception 'P4B_EXACT_CENTER_AMBIGUOUS'; end if;
  select a.* into v_assignment from public.consultation_case_assignment a where a.assignment_id=v_session.assignment_id;
  if p_actor_user_id=v_session.requester_user_id or p_actor_user_id=v_assignment.assigned_consultant_user_id then
    raise exception 'P4B_ACTOR_SEPARATION_REQUIRED';
  end if;
  select c.control_version into v_control_version from public.account_security_control c
    where c.canonical_user_id=p_actor_user_id;
  select * into strict v_security from public.f23_3e_p3b_register_or_sync_account_security_control(
    p_actor_user_id,p_actor_user_id,'ACTIVE',p_account_evidence_digest,v_control_version,
    public.f23_3e_p4b_internal_child_digest(v_intent,'security-sync'),
    public.f23_3e_p4b_internal_child_digest(p_idempotency_key_digest,'security-sync'),p_idempotency_expires_at);
  if not v_security.ok then raise exception 'P4B_ACCOUNT_SECURITY_STALE'; end if;
  select * into strict v_step from public.f23_3e_p3b_record_verified_conversion_step_up(
    p_actor_user_id,p_logical_security_session_id,v_session.conversion_request_id,p_assurance_level,
    p_verification_provider_namespace,p_verification_reference_digest,p_server_verified_at,v_security.control_version,
    public.f23_3e_p4b_internal_child_digest(v_intent,'step-up'),
    public.f23_3e_p4b_internal_child_digest(p_idempotency_key_digest,'step-up'),p_idempotency_expires_at);
  if not v_step.ok then raise exception 'P4B_STEP_UP_REQUIRED'; end if;
  select * into strict v_authority from public.f23_3e_p3b_issue_conversion_authority(
    p_actor_user_id,v_session.conversion_request_id,v_step.step_up_assertion_id,v_session.request_version,
    v_step.assertion_version,p_authority_environment_fingerprint,
    public.f23_3e_p4b_internal_child_digest(v_intent,'authority'),
    public.f23_3e_p4b_internal_child_digest(p_idempotency_key_digest,'authority'),p_idempotency_expires_at);
  if not v_authority.ok then raise exception 'P4B_AUTHORITY_NOT_AVAILABLE'; end if;
  select * into strict v_execution from public.f23_3e_p3d_execute_conversion(
    v_session.conversion_request_id,v_authority.conversion_authority_id,v_authority.request_version,
    v_authority.authority_version,p_authority_environment_fingerprint,
    public.f23_3e_p4b_internal_child_digest(v_intent,'execute'),
    public.f23_3e_p4b_internal_child_digest(p_idempotency_key_digest,'execute'),p_idempotency_expires_at);
  if not v_execution.ok then raise exception 'P4B_EXECUTION_FAILED'; end if;
  v_execution_json:=pg_catalog.to_jsonb(v_execution);
  v_projection:=public.f23_3e_p4b_internal_safe_projection(v_center,v_session.conversion_request_id,v_execution_json);
  v_result:=pg_catalog.jsonb_build_object('ok',true,'outcome_code','P4B_CONVERSION_COMPLETED','replayed',false,
    'bridge_session_id',p_bridge_session_id,'bridge_version',v_session.bridge_version+1,
    'status','COMPLETED','projection',v_projection);
  perform public.f23_3e_p3b_internal_append_audit_outbox(v_center,'crm.conversion.bridge_completed',p_actor_user_id,
    'crm_conversion_bridge_session',p_bridge_session_id,v_session.conversion_request_id,v_session.assignment_id,
    v_session.bridge_version,v_session.bridge_version+1,'COMPLETED','protected_projection_ready',
    'crm.p4b.approve_execute','P4B_CONVERSION_COMPLETED',v_corr);
  perform pg_catalog.set_config('ichess.p4b_bridge_write','on',true);
  update public.crm_conversion_bridge_session set execute_idempotency_key_digest=p_idempotency_key_digest,
    execute_intent_digest=v_intent,
    p3d_execute_idempotency_key_digest=public.f23_3e_p4b_internal_child_digest(p_idempotency_key_digest,'execute'),
    safe_result_snapshot=v_result,status='COMPLETED',request_version=v_execution.request_version,
    case_version=v_execution.case_version,bridge_version=bridge_version+1,updated_at=pg_catalog.transaction_timestamp()
    where bridge_session_id=p_bridge_session_id;
  return v_result;
end;
$f23_3e_p4b_approve_execute_conversion$;

create function public.f23_3e_p4b_read_conversion_status(
  p_bridge_session_id uuid,p_actor_user_id uuid
) returns jsonb language plpgsql stable security definer set search_path=''
as $f23_3e_p4b_read_conversion_status$
declare v_session public.crm_conversion_bridge_session%rowtype; v_member public.center_members%rowtype;
begin
  if p_bridge_session_id is null or p_actor_user_id is null then raise exception 'P4B_INVALID_INPUT'; end if;
  select s.* into v_session from public.crm_conversion_bridge_session s where s.bridge_session_id=p_bridge_session_id;
  if not found then raise exception 'P4B_RESOURCE_NOT_AVAILABLE'; end if;
  v_member:=public.f23_3e_p4b_internal_assert_membership(v_session.center_id,p_actor_user_id,
    array['consultant','owner','center_admin']::text[]);
  if v_member.role='consultant' and p_actor_user_id<>v_session.requester_user_id then raise exception 'P4B_ACCESS_DENIED'; end if;
  return pg_catalog.jsonb_build_object('ok',true,'outcome_code','P4B_STATUS_AVAILABLE','replayed',true,
    'bridge_session_id',v_session.bridge_session_id,'bridge_version',v_session.bridge_version,
    'status',v_session.status,'conversion_request_id',v_session.conversion_request_id,
    'student_search',case when v_session.status='PREPARED' then v_session.student_search_snapshot else null end,
    'guardian_search',case when v_session.status='PREPARED' then v_session.guardian_search_snapshot else null end,
    'review',v_session.review_snapshot,'result',v_session.safe_result_snapshot);
end;
$f23_3e_p4b_read_conversion_status$;

do $f23_3e_p4b_acl$
declare r record;
begin
  for r in select p.oid::pg_catalog.regprocedure signature from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'f23_3e_p4b_%'
  loop
    execute pg_catalog.format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);
  end loop;
end;
$f23_3e_p4b_acl$;

grant execute on function public.f23_3e_p4b_prepare_conversion(
  text,uuid,text,text,text[],text[],text,date,text,text,bytea,bytea,timestamptz
) to service_role;
grant execute on function public.f23_3e_p4b_review_conversion(
  uuid,uuid,integer,text,uuid,integer,text,uuid,integer,text,bytea,timestamptz
) to service_role;
grant execute on function public.f23_3e_p4b_approve_execute_conversion(
  uuid,uuid,integer,uuid,text,text,bytea,timestamptz,bytea,bytea,bytea,timestamptz
) to service_role;
grant execute on function public.f23_3e_p4b_read_conversion_status(uuid,uuid) to service_role;

comment on table public.crm_conversion_bridge_session is
  'F23.3E-P4B protected product orchestration and immutable safe-result snapshot; never a browser authority or canonical identity.';
comment on function public.f23_3e_p4b_approve_execute_conversion(
  uuid,uuid,integer,uuid,text,text,bytea,timestamptz,bytea,bytea,bytea,timestamptz
) is 'Service-role-only P4B bridge RPC. Auth-provider evidence is accepted only from the verified Edge boundary.';

commit;
