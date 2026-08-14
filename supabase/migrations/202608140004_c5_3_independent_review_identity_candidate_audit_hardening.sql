begin;

-- Independent review hardening for C5.3.  Keep the reviewed 140003 bytes
-- immutable while placing a narrow authenticated wrapper around its command
-- runtime.  The wrapper closes protected-identity aliases in display-name
-- fields and marks only C5.3 Candidate writes for canonical audit/outbox.

alter function public.c5_3_mutate_crm_shared_truth(text, jsonb, uuid)
  rename to c5_3_mutate_crm_shared_truth_v1_internal;

revoke all on function public.c5_3_mutate_crm_shared_truth_v1_internal(text, jsonb, uuid)
  from public, anon, authenticated, service_role;

create function public.c5_3_audit_candidate_shared_truth_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := auth.uid();
  v_correlation_id uuid := pg_catalog.gen_random_uuid();
  v_event_type text;
  v_outcome_code text;
  v_previous_version integer;
begin
  if coalesce(pg_catalog.current_setting('ichess.c5_3_candidate_write', true), '') <> 'on' then
    return new;
  end if;
  if v_actor_user_id is null then
    raise exception using errcode = '42501', message = 'NOT_AUTHENTICATED';
  end if;

  if tg_op = 'INSERT' then
    v_event_type := 'crm.candidate.shared_state_created';
    v_outcome_code := 'CANDIDATE_SHARED_STATE_CREATED';
    v_previous_version := null;
  else
    v_event_type := 'crm.candidate.shared_state_updated';
    v_outcome_code := 'CANDIDATE_SHARED_STATE_UPDATED';
    v_previous_version := old.candidate_version;
  end if;

  perform public.f23_3e_p1d_internal_append_audit_outbox(
    new.center_id,
    v_event_type,
    v_actor_user_id,
    'consultation_case_candidate_student',
    new.candidate_student_id,
    null,
    v_previous_version,
    new.candidate_version,
    new.candidate_status,
    null,
    v_outcome_code,
    v_correlation_id
  );
  return new;
end;
$function$;

create trigger c5_3_candidate_shared_truth_audit_outbox
after insert or update on public.consultation_case_candidate_student
for each row execute function public.c5_3_audit_candidate_shared_truth_write();

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
  v_operation text;
  v_result jsonb;
begin
  if p_command is not null and pg_catalog.jsonb_typeof(p_command) = 'object' then
    v_operation := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', '')));
    if (
      v_operation = 'CREATE_LEAD'
      and public.c5_3_contains_protected_identity(p_command#>>'{contact,display_name}')
    ) or (
      v_operation in ('CREATE_LEAD', 'SAVE_CASE')
      and public.c5_3_contains_protected_identity(p_command->>'lead_student_name')
    ) then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
  end if;

  perform pg_catalog.set_config('ichess.c5_3_candidate_write', 'on', true);
  v_result := public.c5_3_mutate_crm_shared_truth_v1_internal(
    p_center_id,
    p_command,
    p_idempotency_key
  );
  perform pg_catalog.set_config('ichess.c5_3_candidate_write', 'off', true);
  return v_result;
end;
$function$;

revoke all on function public.c5_3_audit_candidate_shared_truth_write()
  from public, anon, authenticated, service_role;
revoke all on function public.c5_3_mutate_crm_shared_truth(text, jsonb, uuid)
  from public, anon, service_role;
grant execute on function public.c5_3_mutate_crm_shared_truth(text, jsonb, uuid)
  to authenticated;

commit;
