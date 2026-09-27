-- F5B-B2A: extend the canonical V2.4 package-cycle authority with one
-- prepared-but-inactive next cycle. Receipt persistence remains out of scope.

do $f5b_b2a_prerequisites$
begin
  if pg_catalog.to_regclass('public.center_tuition_package_cycles') is null
     or pg_catalog.to_regclass('public.center_tuition_package_cycle_projection') is null
     or pg_catalog.to_regclass('public.finance_transaction') is null
     or pg_catalog.to_regprocedure('public.v2_4_internal_reconcile_student(text,text,uuid)') is null
     or pg_catalog.to_regprocedure('public.v2_4_list_package_cycle_state(text)') is null
     or pg_catalog.to_regprocedure('public.v2_4_mutate_package_cycle(text,jsonb,uuid)') is null
     or pg_catalog.to_regprocedure('public.c5_4_mutate_finance_shared_truth(text,jsonb,uuid)') is null then
    raise exception 'f5b_b2a_prerequisites_missing';
  end if;
end
$f5b_b2a_prerequisites$;

alter table public.center_tuition_package_cycles
  drop constraint center_tuition_package_cycles_lifecycle_status_check,
  add constraint center_tuition_package_cycles_lifecycle_status_check
    check (lifecycle_status in (
      'ACTIVE', 'PROVISIONAL_UNPAID', 'NEEDS_PACKAGE_SELECTION',
      'PREPARED', 'COMPLETED', 'SUPERSEDED'
    )),
  drop constraint center_tuition_package_cycles_origin_check,
  add constraint center_tuition_package_cycles_origin_check
    check (origin in ('OPERATOR_BASELINE', 'OPERATOR_PREPARED', 'AUTOMATIC_ROLLOVER')),
  drop constraint center_tuition_package_cycles_baseline_evidence_check,
  add constraint center_tuition_package_cycles_baseline_evidence_check check (
    (origin = 'OPERATOR_BASELINE'
      and char_length(btrim(baseline_review_note)) between 1 and 2000)
    or (origin in ('OPERATOR_PREPARED', 'AUTOMATIC_ROLLOVER')
      and baseline_review_note = '')
  );

create unique index center_tuition_package_cycles_one_prepared_next_idx
  on public.center_tuition_package_cycles(center_id, student_local_id)
  where lifecycle_status = 'PREPARED';

create function public.f5b_b2a_internal_prepared_payment_amount(
  p_center_id text,
  p_tuition_local_id text,
  p_student_local_id text,
  p_payment_period_id text
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $function$
  select cycle.price_snapshot
  from public.center_tuition_package_cycles cycle
  where cycle.center_id = p_center_id
    and cycle.tuition_local_id = p_tuition_local_id
    and cycle.student_local_id = p_student_local_id
    and cycle.payment_period_id = p_payment_period_id
    and cycle.lifecycle_status = 'PREPARED'
  limit 1
$function$;

revoke all on function public.f5b_b2a_internal_prepared_payment_amount(text,text,text,text)
  from public, anon, authenticated, service_role;

-- Preserve the generic C5.4 validator and alter only its exact current-term
-- gate. A non-current term is accepted only when V2.4 proves it is PREPARED.
do $f5b_b2a_patch_finance$
declare
  v_signature regprocedure :=
    'public.c5_4_mutate_finance_shared_truth(text,jsonb,uuid)'::regprocedure;
  v_definition text;
  v_patched text;
  v_guard_search constant text := $search$
        if coalesce(v_tuition_entity.payload->>'currentTermId', '') <> p_command->>'source_period_id' then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_PERIOD_STALE');
        end if;
        if coalesce(v_tuition_entity.payload->>'totalAmount', '') !~ '^[0-9]+([.][0-9]+)?$'$search$;
  v_guard_replacement constant text := $replacement$
        if coalesce(v_tuition_entity.payload->>'currentTermId', '') <> p_command->>'source_period_id' then
          v_tuition_total := public.f5b_b2a_internal_prepared_payment_amount(
            v_center_id,
            p_command->>'source_tuition_id',
            p_command->>'source_student_id',
            p_command->>'source_period_id'
          );
          if v_tuition_total is null then
            return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_PERIOD_STALE');
          end if;
          v_tuition_legacy_paid := 0;
          v_tuition_discount := 0;
        else
        if coalesce(v_tuition_entity.payload->>'totalAmount', '') !~ '^[0-9]+([.][0-9]+)?$'$replacement$;
  v_close_search constant text := $search$
        else
          v_tuition_discount := 0;
        end if;
        v_tuition_payable := greatest($search$;
  v_close_replacement constant text := $replacement$
        else
          v_tuition_discount := 0;
        end if;
        end if;
        v_tuition_payable := greatest($replacement$;
  v_guard_count integer;
  v_close_count integer;
begin
  select pg_catalog.pg_get_functiondef(v_signature) into v_definition;
  v_guard_count := (
    pg_catalog.length(v_definition)
      - pg_catalog.length(pg_catalog.replace(v_definition, v_guard_search, ''))
  ) / pg_catalog.length(v_guard_search);
  v_close_count := (
    pg_catalog.length(v_definition)
      - pg_catalog.length(pg_catalog.replace(v_definition, v_close_search, ''))
  ) / pg_catalog.length(v_close_search);
  if v_guard_count <> 1 or v_close_count <> 1 then
    raise exception 'f5b_b2a_finance_validator_drift:%:%', v_guard_count, v_close_count;
  end if;
  v_patched := pg_catalog.replace(v_definition, v_guard_search, v_guard_replacement);
  v_patched := pg_catalog.replace(v_patched, v_close_search, v_close_replacement);
  execute v_patched;
end
$f5b_b2a_patch_finance$;

create function public.f5b_b2a_internal_activate_prepared_cycle(
  p_current_cycle_id uuid,
  p_prepared_cycle_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_current public.center_tuition_package_cycles;
  v_prepared public.center_tuition_package_cycles;
  v_tuition public.center_cloud_entities;
  v_paid_amount bigint;
  v_next_status text;
  v_current_before jsonb;
  v_prepared_before jsonb;
  v_term_history jsonb;
  v_previous_term jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  select * into v_current
  from public.center_tuition_package_cycles cycle
  where cycle.id = p_current_cycle_id
  for update;
  select * into v_prepared
  from public.center_tuition_package_cycles cycle
  where cycle.id = p_prepared_cycle_id
    and cycle.center_id = v_current.center_id
    and cycle.student_local_id = v_current.student_local_id
  for update;
  if v_current.id is null or v_prepared.id is null
     or v_prepared.lifecycle_status <> 'PREPARED'
     or v_prepared.predecessor_cycle_id is distinct from v_current.id
     or v_prepared.cycle_number <> v_current.cycle_number + 1 then
    raise exception 'f5b_b2a_invalid_prepared_activation';
  end if;

  select coalesce(pg_catalog.sum(transaction.amount_minor), 0)::bigint
    into v_paid_amount
  from public.finance_transaction transaction
  where transaction.center_id = v_prepared.center_id
    and transaction.status = 'POSTED'
    and transaction.source_module = 'hoc-phi'
    and transaction.source_type = 'tuition-payment'
    and transaction.source_tuition_id = v_prepared.tuition_local_id
    and transaction.source_period_id = v_prepared.payment_period_id;
  v_next_status := case
    when v_paid_amount >= v_prepared.price_snapshot then 'ACTIVE'
    else 'PROVISIONAL_UNPAID'
  end;

  select * into v_tuition
  from public.center_cloud_entities entity
  where entity.center_id = v_current.center_id
    and entity.entity_type = 'tuition_record_package'
    and entity.local_id = v_current.tuition_local_id
    and entity.deleted_at is null
  for update;
  if v_tuition.id is null
     or coalesce(v_tuition.payload->>'studentId', '') <> v_current.student_local_id
     or coalesce(v_tuition.payload->>'currentTermId', '') <> v_current.payment_period_id then
    raise exception 'f5b_b2a_tuition_term_drift';
  end if;

  v_current_before := pg_catalog.to_jsonb(v_current);
  v_prepared_before := pg_catalog.to_jsonb(v_prepared);

  if v_current.lifecycle_status <> 'COMPLETED' then
    update public.center_tuition_package_cycles cycle
    set lifecycle_status = 'COMPLETED',
        version = cycle.version + 1,
        updated_by = p_actor_user_id,
        updated_at = v_now
    where cycle.id = v_current.id;
    insert into public.center_tuition_cycle_audit_events(
      center_id, actor_user_id, action, entity_type, entity_id,
      before_state, after_state
    )
    select v_current.center_id, p_actor_user_id, 'CURRENT_CYCLE_COMPLETED',
      'PACKAGE_CYCLE', cycle.id, v_current_before, pg_catalog.to_jsonb(cycle)
    from public.center_tuition_package_cycles cycle where cycle.id = v_current.id;
  end if;

  update public.center_tuition_package_cycles cycle
  set lifecycle_status = v_next_status,
      version = cycle.version + 1,
      updated_by = p_actor_user_id,
      updated_at = v_now
  where cycle.id = v_prepared.id;
  insert into public.center_tuition_cycle_audit_events(
    center_id, actor_user_id, action, entity_type, entity_id,
    before_state, after_state
  )
  select v_prepared.center_id, p_actor_user_id,
    case when v_next_status = 'ACTIVE'
      then 'PREPARED_CYCLE_ACTIVATED_PAID'
      else 'PREPARED_CYCLE_ACTIVATED_UNPAID' end,
    'PACKAGE_CYCLE', cycle.id, v_prepared_before, pg_catalog.to_jsonb(cycle)
  from public.center_tuition_package_cycles cycle where cycle.id = v_prepared.id;

  v_term_history := case
    when pg_catalog.jsonb_typeof(v_tuition.payload->'termHistory') = 'array'
      then v_tuition.payload->'termHistory'
    else '[]'::jsonb
  end;
  v_previous_term := pg_catalog.jsonb_build_object(
    'id', v_current.payment_period_id,
    'termNumber', v_current.cycle_number,
    'packageCatalogId', coalesce(v_tuition.payload->>'packageCatalogId', ''),
    'packageName', coalesce(v_tuition.payload->>'packageName', v_current.package_name_snapshot, ''),
    'totalSessions', v_current.total_sessions_snapshot,
    'usedSessions', v_current.total_sessions_snapshot,
    'totalAmount', coalesce((v_tuition.payload->>'totalAmount')::numeric, v_current.price_snapshot),
    'discountType', coalesce(v_tuition.payload->>'discountType', 'none'),
    'discountValue', coalesce((v_tuition.payload->>'discountValue')::numeric, 0),
    'discountAmount', coalesce((v_tuition.payload->>'discountAmount')::numeric, 0),
    'paidAmount', coalesce((v_tuition.payload->>'paidAmount')::numeric, 0),
    'dueDate', coalesce(v_tuition.payload->>'dueDate', ''),
    'note', coalesce(v_tuition.payload->>'note', ''),
    'status', 'completed',
    'startedAt', coalesce(v_tuition.payload->>'startedAt', ''),
    'endedAt', v_now,
    'payments', case when pg_catalog.jsonb_typeof(v_tuition.payload->'payments') = 'array'
      then v_tuition.payload->'payments' else '[]'::jsonb end
  );
  update public.center_cloud_entities entity
  set payload = entity.payload || pg_catalog.jsonb_build_object(
        'packageCatalogId', v_prepared.package_catalog_id,
        'packageName', v_prepared.package_name_snapshot,
        'programName', coalesce(v_prepared.program_name_snapshot, ''),
        'totalSessions', v_prepared.total_sessions_snapshot,
        'usedSessions', 0,
        'totalAmount', v_prepared.price_snapshot,
        'discountType', 'none',
        'discountValue', 0,
        'discountAmount', 0,
        'paidAmount', 0,
        'currentTermNumber', v_prepared.cycle_number,
        'currentTermId', v_prepared.payment_period_id,
        'startedAt', v_now,
        'payments', '[]'::jsonb,
        'termHistory', v_term_history || pg_catalog.jsonb_build_array(v_previous_term),
        'updatedAt', v_now
      ),
      source_module = 'tuition',
      source_version = 'f5b-b2a-prepared-cycle-v1',
      entity_version = entity.entity_version + 1,
      updated_by = p_actor_user_id,
      updated_at = v_now
  where entity.id = v_tuition.id;
end
$function$;

revoke all on function public.f5b_b2a_internal_activate_prepared_cycle(uuid,uuid,uuid)
  from public, anon, authenticated, service_role;

create or replace function public.v2_4_internal_reconcile_student(
  p_center_id text,
  p_student_local_id text,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_first public.center_tuition_package_cycles;
  v_cycle public.center_tuition_package_cycles;
  v_next public.center_tuition_package_cycles;
  v_attendance public.center_cloud_entities;
  v_existing public.center_tuition_attendance_contributions;
  v_units smallint;
  v_used integer;
  v_cycle_number integer;
  v_max_cycle_number integer := 0;
  v_state text;
  v_reason text;
  v_before jsonb;
  v_contribution_id uuid;
begin
  if pg_catalog.btrim(coalesce(p_center_id, '')) = ''
     or pg_catalog.btrim(coalesce(p_student_local_id, '')) = '' then return; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'v2.4.student|' || p_center_id || '|' || p_student_local_id, 0));

  select * into v_first from public.center_tuition_package_cycles cycle
  where cycle.center_id = p_center_id and cycle.student_local_id = p_student_local_id
    and cycle.cycle_number = 1 and cycle.lifecycle_status <> 'SUPERSEDED'
  for update;
  if v_first.id is null then return; end if;
  v_cycle := v_first;
  v_cycle_number := 1;
  v_used := v_cycle.baseline_used_sessions;

  for v_attendance in
    select entity.* from public.center_cloud_entities entity
    where entity.center_id = p_center_id and entity.entity_type = 'attendance_record'
      and entity.deleted_at is null
      and entity.payload->>'attendanceAuthority' = 'v2.3-occurrence-v1'
      and entity.payload->>'studentId' = p_student_local_id
      and coalesce(entity.payload->>'date', '') ~ '^\d{4}-\d{2}-\d{2}$'
      and (entity.payload->>'date')::date > v_first.baseline_cutoff_date
    order by (entity.payload->>'date')::date,
      coalesce(entity.payload->>'scheduleSessionId', entity.payload->>'sessionId'), entity.local_id
  loop
    v_units := public.v2_4_internal_consumption_units(v_attendance.payload->>'attendanceStatus');
    if v_units is null then raise exception 'v2_4_unknown_attendance_status'; end if;

    if v_units = 1 and v_cycle.total_sessions_snapshot is not null
       and v_used >= v_cycle.total_sessions_snapshot then
      v_cycle_number := v_cycle_number + 1;
      select * into v_next from public.center_tuition_package_cycles cycle
      where cycle.center_id = p_center_id and cycle.student_local_id = p_student_local_id
        and cycle.cycle_number = v_cycle_number
      for update;
      if v_next.id is null then
        if v_cycle.package_catalog_id is not null and exists (
          select 1 from public.center_tuition_package_catalog package
          where package.id = v_cycle.package_catalog_id and package.center_id = p_center_id
            and package.is_active
        ) then
          insert into public.center_tuition_package_cycles(
            center_id, student_local_id, tuition_local_id, cycle_number,
            predecessor_cycle_id, package_catalog_id, package_name_snapshot,
            total_sessions_snapshot, price_snapshot, payment_period_id,
            baseline_used_sessions, baseline_cutoff_date, lifecycle_status, origin,
            created_by, updated_by
          ) values (
            p_center_id, p_student_local_id, v_cycle.tuition_local_id, v_cycle_number,
            v_cycle.id, v_cycle.package_catalog_id, v_cycle.package_name_snapshot,
            v_cycle.total_sessions_snapshot, v_cycle.price_snapshot, pg_catalog.gen_random_uuid()::text,
            0, v_first.baseline_cutoff_date, 'PROVISIONAL_UNPAID', 'AUTOMATIC_ROLLOVER',
            p_actor_user_id, p_actor_user_id
          ) returning * into v_next;
        else
          insert into public.center_tuition_package_cycles(
            center_id, student_local_id, tuition_local_id, cycle_number,
            predecessor_cycle_id, payment_period_id, baseline_used_sessions,
            baseline_cutoff_date, lifecycle_status, origin, created_by, updated_by
          ) values (
            p_center_id, p_student_local_id, v_cycle.tuition_local_id, v_cycle_number,
            v_cycle.id, pg_catalog.gen_random_uuid()::text, 0, v_first.baseline_cutoff_date,
            'NEEDS_PACKAGE_SELECTION', 'AUTOMATIC_ROLLOVER', p_actor_user_id, p_actor_user_id
          ) returning * into v_next;
        end if;
        insert into public.center_tuition_cycle_audit_events(
          center_id, actor_user_id, action, entity_type, entity_id, after_state
        ) values (p_center_id, p_actor_user_id, 'AUTOMATIC_ROLLOVER_CREATED',
          'PACKAGE_CYCLE', v_next.id, pg_catalog.to_jsonb(v_next));
      elsif v_next.lifecycle_status = 'SUPERSEDED' then
        v_before := pg_catalog.to_jsonb(v_next);
        update public.center_tuition_package_cycles cycle
        set lifecycle_status = case when package_catalog_id is null
              then 'NEEDS_PACKAGE_SELECTION' else 'PROVISIONAL_UNPAID' end,
            version = cycle.version + 1, updated_by = p_actor_user_id,
            updated_at = pg_catalog.clock_timestamp()
        where cycle.id = v_next.id returning * into v_next;
        insert into public.center_tuition_cycle_audit_events(
          center_id, actor_user_id, action, entity_type, entity_id, before_state, after_state
        ) values (p_center_id, p_actor_user_id, 'AUTOMATIC_ROLLOVER_REACTIVATED',
          'PACKAGE_CYCLE', v_next.id, v_before, pg_catalog.to_jsonb(v_next));
      end if;

      if v_next.lifecycle_status = 'PREPARED' then
        perform public.f5b_b2a_internal_activate_prepared_cycle(
          v_cycle.id, v_next.id, p_actor_user_id);
        select * into v_next from public.center_tuition_package_cycles cycle
        where cycle.id = v_next.id;
      elsif v_cycle.lifecycle_status <> 'COMPLETED' then
        v_before := pg_catalog.to_jsonb(v_cycle);
        update public.center_tuition_package_cycles cycle
        set lifecycle_status = 'COMPLETED', version = cycle.version + 1,
            updated_by = p_actor_user_id, updated_at = pg_catalog.clock_timestamp()
        where cycle.id = v_cycle.id returning * into v_cycle;
        insert into public.center_tuition_cycle_audit_events(
          center_id, actor_user_id, action, entity_type, entity_id, before_state, after_state
        ) values (p_center_id, p_actor_user_id, 'CURRENT_CYCLE_COMPLETED',
          'PACKAGE_CYCLE', v_cycle.id, v_before, pg_catalog.to_jsonb(v_cycle));
      end if;
      v_cycle := v_next;
      v_used := v_cycle.baseline_used_sessions;
    end if;

    v_max_cycle_number := greatest(v_max_cycle_number, v_cycle.cycle_number);
    v_state := case when v_cycle.total_sessions_snapshot is null
      then 'PENDING_PACKAGE_SELECTION' else 'APPLIED' end;
    v_reason := case when pg_catalog.lower(v_attendance.payload->>'attendanceStatus') = 'makeup'
      then pg_catalog.left(pg_catalog.btrim(coalesce(
        nullif(v_attendance.payload->>'makeupReason', ''),
        nullif(v_attendance.payload->>'correctionReason', ''),
        v_attendance.payload->>'note', ''
      )), 2000) else '' end;
    select * into v_existing from public.center_tuition_attendance_contributions contribution
    where contribution.center_id = p_center_id
      and contribution.student_local_id = p_student_local_id
      and contribution.schedule_session_local_id = coalesce(
        nullif(v_attendance.payload->>'scheduleSessionId', ''), v_attendance.payload->>'sessionId')
      and contribution.occurrence_date = (v_attendance.payload->>'date')::date
    for update;
    if v_existing.id is null then
      insert into public.center_tuition_attendance_contributions(
        center_id, student_local_id, schedule_session_local_id, occurrence_date,
        attendance_entity_local_id, attendance_entity_version, attendance_status,
        contribution_units, allocation_state, cycle_id, makeup_reason_snapshot
      ) values (
        p_center_id, p_student_local_id,
        coalesce(nullif(v_attendance.payload->>'scheduleSessionId', ''), v_attendance.payload->>'sessionId'),
        (v_attendance.payload->>'date')::date, v_attendance.local_id,
        v_attendance.entity_version, v_attendance.payload->>'attendanceStatus',
        v_units, v_state, v_cycle.id, v_reason
      ) returning id into v_contribution_id;
      insert into public.center_tuition_cycle_audit_events(
        center_id, actor_user_id, action, entity_type, entity_id, after_state
      ) select p_center_id, p_actor_user_id, 'CONTRIBUTION_RECONCILED',
        'ATTENDANCE_CONTRIBUTION', contribution.id, pg_catalog.to_jsonb(contribution)
      from public.center_tuition_attendance_contributions contribution
      where contribution.id = v_contribution_id;
    elsif v_existing.attendance_entity_local_id is distinct from v_attendance.local_id
       or v_existing.attendance_entity_version is distinct from v_attendance.entity_version
       or v_existing.attendance_status is distinct from v_attendance.payload->>'attendanceStatus'
       or v_existing.contribution_units is distinct from v_units
       or v_existing.allocation_state is distinct from v_state
       or v_existing.cycle_id is distinct from v_cycle.id
       or v_existing.makeup_reason_snapshot is distinct from v_reason
       or v_existing.ended_at is not null then
      v_before := pg_catalog.to_jsonb(v_existing);
      update public.center_tuition_attendance_contributions contribution
      set attendance_entity_local_id = v_attendance.local_id,
          attendance_entity_version = v_attendance.entity_version,
          attendance_status = v_attendance.payload->>'attendanceStatus',
          contribution_units = v_units, allocation_state = v_state,
          cycle_id = v_cycle.id, makeup_reason_snapshot = v_reason,
          version = contribution.version + 1, ended_at = null,
          updated_at = pg_catalog.clock_timestamp()
      where contribution.id = v_existing.id returning id into v_contribution_id;
      insert into public.center_tuition_cycle_audit_events(
        center_id, actor_user_id, action, entity_type, entity_id, before_state, after_state
      ) select p_center_id, p_actor_user_id, 'CONTRIBUTION_RECONCILED',
        'ATTENDANCE_CONTRIBUTION', contribution.id, v_before, pg_catalog.to_jsonb(contribution)
      from public.center_tuition_attendance_contributions contribution
      where contribution.id = v_contribution_id;
    end if;
    if v_units = 1 and v_cycle.total_sessions_snapshot is not null then
      v_used := v_used + 1;
    end if;
  end loop;

  with ended as (
    update public.center_tuition_attendance_contributions contribution
    set ended_at = pg_catalog.clock_timestamp(), version = contribution.version + 1,
        updated_at = pg_catalog.clock_timestamp()
    where contribution.center_id = p_center_id
      and contribution.student_local_id = p_student_local_id
      and contribution.ended_at is null
      and not exists (
        select 1 from public.center_cloud_entities entity
        where entity.center_id = p_center_id and entity.entity_type = 'attendance_record'
          and entity.deleted_at is null and entity.payload->>'attendanceAuthority' = 'v2.3-occurrence-v1'
          and entity.payload->>'studentId' = p_student_local_id
          and coalesce(nullif(entity.payload->>'scheduleSessionId', ''), entity.payload->>'sessionId')
            = contribution.schedule_session_local_id
          and entity.payload->>'date' = contribution.occurrence_date::text
          and contribution.occurrence_date > v_first.baseline_cutoff_date
      ) returning contribution.*
  )
  insert into public.center_tuition_cycle_audit_events(
    center_id, actor_user_id, action, entity_type, entity_id, after_state
  ) select p_center_id, p_actor_user_id, 'CONTRIBUTION_ENDED',
    'ATTENDANCE_CONTRIBUTION', ended.id, pg_catalog.to_jsonb(ended) from ended;

  -- Exact N activates a prepared successor even before another attendance row exists.
  if v_cycle.total_sessions_snapshot is not null and v_used >= v_cycle.total_sessions_snapshot then
    select * into v_next from public.center_tuition_package_cycles cycle
    where cycle.center_id = p_center_id and cycle.student_local_id = p_student_local_id
      and cycle.cycle_number = v_cycle.cycle_number + 1
      and cycle.lifecycle_status = 'PREPARED'
    for update;
    if v_next.id is not null then
      perform public.f5b_b2a_internal_activate_prepared_cycle(
        v_cycle.id, v_next.id, p_actor_user_id);
    end if;
  end if;

  with candidates as (
    select cycle.id, pg_catalog.to_jsonb(cycle) as before_state
    from public.center_tuition_package_cycles cycle
    where cycle.center_id = p_center_id and cycle.student_local_id = p_student_local_id
      and cycle.origin = 'AUTOMATIC_ROLLOVER' and cycle.cycle_number > v_max_cycle_number
      and cycle.lifecycle_status <> 'SUPERSEDED'
      and not exists (
        select 1 from public.finance_transaction transaction
        where transaction.center_id = cycle.center_id and transaction.status = 'POSTED'
          and transaction.source_module = 'hoc-phi' and transaction.source_type = 'tuition-payment'
          and transaction.source_tuition_id = cycle.tuition_local_id
          and transaction.source_period_id = cycle.payment_period_id
      ) for update
  ), superseded as (
    update public.center_tuition_package_cycles cycle
    set lifecycle_status = 'SUPERSEDED', version = cycle.version + 1,
        updated_by = p_actor_user_id, updated_at = pg_catalog.clock_timestamp()
    from candidates old where cycle.id = old.id
    returning cycle.*, old.before_state
  )
  insert into public.center_tuition_cycle_audit_events(
    center_id, actor_user_id, action, entity_type, entity_id, before_state, after_state
  ) select p_center_id, p_actor_user_id, 'AUTOMATIC_ROLLOVER_SUPERSEDED',
    'PACKAGE_CYCLE', superseded.id, superseded.before_state,
    pg_catalog.to_jsonb(superseded) - 'before_state' from superseded;
end
$function$;

create or replace view public.center_tuition_package_cycle_projection
with (security_invoker = false)
as
select
  cycle.id,
  cycle.center_id,
  cycle.student_local_id,
  cycle.tuition_local_id,
  cycle.cycle_number,
  cycle.predecessor_cycle_id,
  cycle.package_catalog_id,
  cycle.package_name_snapshot,
  cycle.total_sessions_snapshot,
  cycle.price_snapshot,
  cycle.payment_period_id,
  cycle.baseline_used_sessions,
  cycle.baseline_cutoff_date,
  cycle.baseline_review_note,
  cycle.lifecycle_status,
  cycle.origin,
  cycle.bcht_status,
  cycle.bcht_note,
  cycle.bcht_completed_at,
  cycle.bcht_completed_by,
  cycle.version,
  cycle.created_by,
  cycle.updated_by,
  cycle.created_at,
  cycle.updated_at,
  coalesce(contribution.applied_sessions, 0)::integer as contributed_sessions,
  coalesce(contribution.pending_sessions, 0)::integer as pending_sessions,
  (cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer)::integer as used_sessions,
  case when cycle.total_sessions_snapshot is null then null
    else greatest(cycle.total_sessions_snapshot - cycle.baseline_used_sessions
      - coalesce(contribution.applied_sessions, 0)::integer, 0)::integer end as remaining_sessions,
  coalesce(payment.paid_amount, 0)::bigint as paid_amount,
  case when cycle.price_snapshot is null then 'NEEDS_PACKAGE_SELECTION'
    when coalesce(payment.paid_amount, 0) <= 0 then 'UNPAID'
    when coalesce(payment.paid_amount, 0) < cycle.price_snapshot then 'PARTIAL'
    else 'PAID' end as payment_status,
  case
    when cycle.lifecycle_status = 'PREPARED' then 'PENDING_ACTIVATION'
    when cycle.lifecycle_status = 'PROVISIONAL_UNPAID'
      and coalesce(payment.paid_amount, 0) < coalesce(cycle.price_snapshot, 0) then 'PROVISIONAL_UNPAID'
    when cycle.total_sessions_snapshot is null then 'PACKAGE_SELECTION_REQUIRED'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= cycle.total_sessions_snapshot
      and cycle.bcht_status <> 'COMPLETED' then 'PACKAGE_EXHAUSTED_BCHT_DUE'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= cycle.total_sessions_snapshot then 'PACKAGE_EXHAUSTED'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= cycle.total_sessions_snapshot - 2
      and cycle.bcht_status <> 'COMPLETED' then 'BCHT_AND_RENEWAL_DUE'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= cycle.total_sessions_snapshot - 2 then 'RENEWAL_DUE'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= cycle.total_sessions_snapshot - 4
      and cycle.bcht_status <> 'COMPLETED' then 'BCHT_DUE'
    else 'NORMAL'
  end as reminder_state,
  (cycle.bcht_status <> 'COMPLETED' and cycle.total_sessions_snapshot is not null
    and cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer
      >= cycle.total_sessions_snapshot - 4) as bcht_reminder,
  (cycle.total_sessions_snapshot is not null
    and cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer
      >= cycle.total_sessions_snapshot - 2) as renewal_reminder,
  (cycle.total_sessions_snapshot is not null
    and cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer
      >= cycle.total_sessions_snapshot) as urgent_renewal,
  cycle.program_name_snapshot
from public.center_tuition_package_cycles cycle
left join lateral (
  select
    count(*) filter (where item.allocation_state = 'APPLIED' and item.contribution_units = 1) as applied_sessions,
    count(*) filter (where item.allocation_state = 'PENDING_PACKAGE_SELECTION' and item.contribution_units = 1) as pending_sessions
  from public.center_tuition_attendance_contributions item
  where item.center_id = cycle.center_id and item.cycle_id = cycle.id and item.ended_at is null
) contribution on true
left join lateral (
  select coalesce(pg_catalog.sum(transaction.amount_minor), 0) as paid_amount
  from public.finance_transaction transaction
  where transaction.center_id = cycle.center_id and transaction.status = 'POSTED'
    and transaction.source_module = 'hoc-phi' and transaction.source_type = 'tuition-payment'
    and transaction.source_tuition_id = cycle.tuition_local_id
    and transaction.source_period_id = cycle.payment_period_id
) payment on true;

create or replace function public.v2_4_list_package_cycle_state(p_center_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
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
        'readiness', case when current_cycle.id is not null then 'READY'
          when tuition.id is not null then 'LEGACY_REVIEW_REQUIRED' else 'NO_TUITION_PACKAGE' end,
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
        'prepared_next_cycle', case when prepared_cycle.id is null then null else pg_catalog.jsonb_build_object(
          'id', prepared_cycle.id, 'cycle_number', prepared_cycle.cycle_number,
          'tuition_local_id', prepared_cycle.tuition_local_id,
          'package_catalog_id', prepared_cycle.package_catalog_id,
          'package_name', prepared_cycle.package_name_snapshot,
          'program_name', prepared_cycle.program_name_snapshot,
          'total_sessions', prepared_cycle.total_sessions_snapshot,
          'price', prepared_cycle.price_snapshot,
          'baseline_used', prepared_cycle.baseline_used_sessions,
          'baseline_cutoff_date', prepared_cycle.baseline_cutoff_date,
          'baseline_review_note', prepared_cycle.baseline_review_note,
          'contributed_sessions', prepared_cycle.contributed_sessions,
          'pending_sessions', prepared_cycle.pending_sessions,
          'used_sessions', prepared_cycle.used_sessions,
          'remaining_sessions', prepared_cycle.remaining_sessions,
          'lifecycle_status', prepared_cycle.lifecycle_status,
          'payment_period_id', prepared_cycle.payment_period_id,
          'payment_status', prepared_cycle.payment_status,
          'paid_amount', prepared_cycle.paid_amount,
          'bcht_status', prepared_cycle.bcht_status,
          'bcht_note', prepared_cycle.bcht_note,
          'reminder_state', prepared_cycle.reminder_state,
          'bcht_reminder', prepared_cycle.bcht_reminder,
          'renewal_reminder', prepared_cycle.renewal_reminder,
          'urgent_renewal', prepared_cycle.urgent_renewal,
          'version', prepared_cycle.version
        ) end,
        'cycles', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', history.id, 'cycle_number', history.cycle_number,
          'package_name', history.package_name_snapshot,
          'program_name', history.program_name_snapshot,
          'total_sessions', history.total_sessions_snapshot,
          'used_sessions', history.used_sessions,
          'remaining_sessions', history.remaining_sessions,
          'lifecycle_status', history.lifecycle_status,
          'payment_status', history.payment_status,
          'bcht_status', history.bcht_status,
          'bcht_note', history.bcht_note,
          'bcht_reminder', history.bcht_reminder,
          'renewal_reminder', history.renewal_reminder,
          'urgent_renewal', history.urgent_renewal,
          'version', history.version
        ) order by history.cycle_number desc)
          from public.center_tuition_package_cycle_projection history
          where history.center_id = p_center_id and history.student_local_id = student.local_id), '[]'::jsonb)
      ) order by pg_catalog.lower(coalesce(student.payload->>'fullName', '')), student.local_id)
      from public.center_cloud_entities student
      left join lateral (
        select entity.* from public.center_cloud_entities entity
        where entity.center_id = p_center_id and entity.entity_type = 'tuition_record_package'
          and entity.deleted_at is null and entity.payload->>'studentId' = student.local_id
        order by entity.entity_version desc, entity.local_id limit 1
      ) tuition on true
      left join lateral (
        select projection.* from public.center_tuition_package_cycle_projection projection
        where projection.center_id = p_center_id and projection.student_local_id = student.local_id
          and projection.lifecycle_status in ('ACTIVE', 'PROVISIONAL_UNPAID', 'NEEDS_PACKAGE_SELECTION')
        order by projection.cycle_number desc limit 1
      ) current_cycle on true
      left join lateral (
        select projection.* from public.center_tuition_package_cycle_projection projection
        where projection.center_id = p_center_id and projection.student_local_id = student.local_id
          and projection.lifecycle_status = 'PREPARED'
        order by projection.cycle_number desc limit 1
      ) prepared_cycle on true
      where student.center_id = p_center_id and student.entity_type = 'student'
        and student.deleted_at is null
    ), '[]'::jsonb),
    'package_catalog', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', package.id, 'package_name', package.package_name,
      'program_name', package.program_name,
      'total_sessions', package.total_sessions,
      'default_amount', package.default_amount,
      'is_active', package.is_active, 'version', package.version
    ) order by package.is_active desc, pg_catalog.lower(package.package_name), package.id)
      from public.center_tuition_package_catalog package where package.center_id = p_center_id), '[]'::jsonb),
    'contributions', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'student_id', item.student_local_id,
      'schedule_session_id', item.schedule_session_local_id,
      'occurrence_date', item.occurrence_date,
      'attendance_status', item.attendance_status,
      'contribution_units', item.contribution_units,
      'allocation_state', item.allocation_state,
      'makeup_reason', item.makeup_reason_snapshot,
      'cycle_id', item.cycle_id, 'cycle_number', item.cycle_number,
      'package_name', item.package_name_snapshot,
      'program_name', item.program_name_snapshot,
      'total_sessions', item.total_sessions_snapshot,
      'session_number', case when item.allocation_state = 'APPLIED' then item.running_session_number else null end,
      'remaining_sessions', case when item.allocation_state = 'APPLIED'
          and item.total_sessions_snapshot is not null
        then greatest(item.total_sessions_snapshot - item.running_session_number, 0) else null end,
      'cycle_lifecycle_status', item.lifecycle_status,
      'payment_status', item.payment_status
    ) order by item.occurrence_date, item.schedule_session_local_id, item.student_local_id)
      from (
        select contribution.*, cycle.cycle_number, cycle.package_name_snapshot,
          cycle.program_name_snapshot, cycle.total_sessions_snapshot,
          cycle.baseline_used_sessions, cycle.lifecycle_status, cycle.payment_status,
          cycle.baseline_used_sessions + pg_catalog.sum(contribution.contribution_units) over (
            partition by contribution.cycle_id order by contribution.occurrence_date,
              contribution.schedule_session_local_id, contribution.id rows unbounded preceding
          )::integer as running_session_number
        from public.center_tuition_attendance_contributions contribution
        join public.center_tuition_package_cycle_projection cycle
          on cycle.center_id = contribution.center_id and cycle.id = contribution.cycle_id
        where contribution.center_id = p_center_id and contribution.ended_at is null
      ) item), '[]'::jsonb)
  );
end
$function$;

create or replace function public.v2_4_mutate_package_cycle(
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
  v_actor uuid := auth.uid();
  v_membership public.center_members;
  v_existing public.center_tuition_cycle_command_results;
  v_intent bytea;
  v_operation text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', '')));
  v_student_id text := pg_catalog.btrim(coalesce(p_command->>'student_id', ''));
  v_tuition_local_id text := pg_catalog.btrim(coalesce(p_command->>'tuition_local_id', ''));
  v_cycle public.center_tuition_package_cycles;
  v_current public.center_tuition_package_cycles;
  v_package public.center_tuition_package_catalog;
  v_tuition public.center_cloud_entities;
  v_cycle_id uuid;
  v_package_id uuid;
  v_expected_version bigint;
  v_baseline integer;
  v_cutoff date;
  v_bcht_status text;
  v_bcht_note text;
  v_baseline_review_note text;
  v_period_id text;
  v_remaining integer;
  v_response jsonb;
  v_before jsonb;
begin
  if v_actor is null then raise exception 'v2_4_not_authenticated'; end if;
  if p_idempotency_key is null or p_command is null or pg_catalog.jsonb_typeof(p_command) <> 'object'
     or v_student_id = '' then raise exception 'v2_4_invalid_command'; end if;
  select * into v_membership from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'v2_4_center_access_denied'; end if;
  v_intent := extensions.digest(pg_catalog.convert_to(p_command::text, 'UTF8'), 'sha256');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'v2.4.command|' || p_center_id || '|' || v_actor::text || '|' || p_idempotency_key::text, 0));
  select * into v_existing from public.center_tuition_cycle_command_results result
  where result.center_id = p_center_id and result.actor_user_id = v_actor
    and result.idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.intent_digest <> v_intent then raise exception 'v2_4_idempotency_conflict'; end if;
    return v_existing.result_snapshot || pg_catalog.jsonb_build_object('replayed', true);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'v2.4.student|' || p_center_id || '|' || v_student_id, 0));
  if not exists (select 1 from public.center_cloud_entities student
    where student.center_id = p_center_id and student.entity_type = 'student'
      and student.local_id = v_student_id and student.deleted_at is null) then
    raise exception 'v2_4_student_not_found';
  end if;

  if v_operation = 'START_CYCLE' then
    if exists (select 1 from public.center_tuition_package_cycles cycle
      where cycle.center_id = p_center_id and cycle.student_local_id = v_student_id) then
      raise exception 'v2_4_cycle_already_started';
    end if;
    v_package_id := (p_command->>'package_catalog_id')::uuid;
    v_baseline := (p_command->>'baseline_used_sessions')::integer;
    v_cutoff := (p_command->>'baseline_cutoff_date')::date;
    v_baseline_review_note := pg_catalog.left(pg_catalog.btrim(coalesce(
      p_command->>'baseline_review_note', '')), 2000);
    if v_tuition_local_id = '' or v_baseline < 0 or v_cutoff is null or v_cutoff > current_date
       or v_baseline_review_note = '' then raise exception 'v2_4_invalid_baseline'; end if;
    select * into v_tuition from public.center_cloud_entities entity
    where entity.center_id = p_center_id and entity.entity_type = 'tuition_record_package'
      and entity.local_id = v_tuition_local_id and entity.deleted_at is null for share;
    if v_tuition.id is null or v_tuition.payload->>'studentId' <> v_student_id then
      raise exception 'v2_4_tuition_not_found'; end if;
    select * into v_package from public.center_tuition_package_catalog package
    where package.id = v_package_id and package.center_id = p_center_id and package.is_active for share;
    if v_package.id is null or v_baseline > v_package.total_sessions then
      raise exception 'v2_4_package_not_available'; end if;
    v_period_id := pg_catalog.btrim(coalesce(v_tuition.payload->>'currentTermId', ''));
    if v_period_id = '' then v_period_id := 'term-' || coalesce(nullif(v_tuition.payload->>'id', ''), v_tuition.local_id)
      || '-' || coalesce(nullif(v_tuition.payload->>'currentTermNumber', ''), '1'); end if;
    insert into public.center_tuition_package_cycles(
      center_id, student_local_id, tuition_local_id, cycle_number,
      package_catalog_id, package_name_snapshot, total_sessions_snapshot,
      price_snapshot, payment_period_id, baseline_used_sessions,
      baseline_cutoff_date, baseline_review_note, lifecycle_status, origin, created_by, updated_by
    ) values (p_center_id, v_student_id, v_tuition_local_id, 1,
      v_package.id, v_package.package_name, v_package.total_sessions, v_package.default_amount,
      v_period_id, v_baseline, v_cutoff, v_baseline_review_note,
      'ACTIVE', 'OPERATOR_BASELINE', v_actor, v_actor) returning * into v_cycle;

  elsif v_operation = 'PREPARE_NEXT_CYCLE' then
    v_cycle_id := (p_command->>'current_cycle_id')::uuid;
    v_package_id := (p_command->>'package_catalog_id')::uuid;
    v_expected_version := (p_command->>'expected_version')::bigint;
    select * into v_current from public.center_tuition_package_cycles cycle
    where cycle.id = v_cycle_id and cycle.center_id = p_center_id
      and cycle.student_local_id = v_student_id for update;
    if v_current.id is null or v_current.version <> v_expected_version
       or v_current.lifecycle_status not in ('ACTIVE', 'PROVISIONAL_UNPAID') then
      raise exception 'v2_4_stale_version'; end if;
    select projection.remaining_sessions into v_remaining
    from public.center_tuition_package_cycle_projection projection
    where projection.center_id = p_center_id and projection.id = v_current.id;
    if v_remaining is null or v_remaining > 2 then raise exception 'v2_4_prepare_not_due'; end if;
    select * into v_tuition from public.center_cloud_entities entity
    where entity.center_id = p_center_id and entity.entity_type = 'tuition_record_package'
      and entity.local_id = v_current.tuition_local_id and entity.deleted_at is null for share;
    if v_tuition.id is null or v_tuition.payload->>'studentId' <> v_student_id
       or coalesce(v_tuition.payload->>'currentTermId', '') <> v_current.payment_period_id then
      raise exception 'v2_4_tuition_period_stale'; end if;
    select * into v_package from public.center_tuition_package_catalog package
    where package.id = v_package_id and package.center_id = p_center_id and package.is_active for share;
    if v_package.id is null then raise exception 'v2_4_package_not_available'; end if;
    select * into v_cycle from public.center_tuition_package_cycles cycle
    where cycle.center_id = p_center_id and cycle.student_local_id = v_student_id
      and cycle.cycle_number = v_current.cycle_number + 1 for update;
    if v_cycle.id is not null then
      if v_cycle.lifecycle_status <> 'PREPARED' or v_cycle.package_catalog_id <> v_package.id then
        raise exception 'v2_4_prepared_cycle_exists'; end if;
      v_before := pg_catalog.to_jsonb(v_cycle);
    else
      insert into public.center_tuition_package_cycles(
        center_id, student_local_id, tuition_local_id, cycle_number,
        predecessor_cycle_id, package_catalog_id, package_name_snapshot,
        total_sessions_snapshot, price_snapshot, payment_period_id,
        baseline_used_sessions, baseline_cutoff_date, lifecycle_status, origin,
        created_by, updated_by
      ) values (
        p_center_id, v_student_id, v_current.tuition_local_id, v_current.cycle_number + 1,
        v_current.id, v_package.id, v_package.package_name, v_package.total_sessions,
        v_package.default_amount, pg_catalog.gen_random_uuid()::text,
        0, v_current.baseline_cutoff_date, 'PREPARED', 'OPERATOR_PREPARED', v_actor, v_actor
      ) returning * into v_cycle;
      v_before := null;
    end if;

  elsif v_operation = 'UPDATE_BCHT' then
    v_cycle_id := (p_command->>'cycle_id')::uuid;
    v_expected_version := (p_command->>'expected_version')::bigint;
    v_bcht_status := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'bcht_status', '')));
    v_bcht_note := pg_catalog.left(pg_catalog.btrim(coalesce(p_command->>'bcht_note', '')), 2000);
    if v_bcht_status not in ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED') then
      raise exception 'v2_4_invalid_bcht_status'; end if;
    select * into v_cycle from public.center_tuition_package_cycles cycle
    where cycle.id = v_cycle_id and cycle.center_id = p_center_id
      and cycle.student_local_id = v_student_id for update;
    if v_cycle.id is null or v_cycle.version <> v_expected_version
       or v_cycle.lifecycle_status in ('PREPARED', 'SUPERSEDED') then
      raise exception 'v2_4_stale_version'; end if;
    v_before := pg_catalog.to_jsonb(v_cycle);
    update public.center_tuition_package_cycles cycle
    set bcht_status = v_bcht_status, bcht_note = v_bcht_note,
        bcht_completed_at = case when v_bcht_status = 'COMPLETED' then pg_catalog.clock_timestamp() else null end,
        bcht_completed_by = case when v_bcht_status = 'COMPLETED' then v_actor else null end,
        version = cycle.version + 1, updated_by = v_actor, updated_at = pg_catalog.clock_timestamp()
    where cycle.id = v_cycle.id returning * into v_cycle;

  elsif v_operation = 'SELECT_PROVISIONAL_PACKAGE' then
    v_cycle_id := (p_command->>'cycle_id')::uuid;
    v_package_id := (p_command->>'package_catalog_id')::uuid;
    v_expected_version := (p_command->>'expected_version')::bigint;
    select * into v_cycle from public.center_tuition_package_cycles cycle
    where cycle.id = v_cycle_id and cycle.center_id = p_center_id
      and cycle.student_local_id = v_student_id for update;
    if v_cycle.id is null or v_cycle.version <> v_expected_version
       or v_cycle.lifecycle_status not in ('NEEDS_PACKAGE_SELECTION', 'PROVISIONAL_UNPAID', 'PREPARED') then
      raise exception 'v2_4_stale_version'; end if;
    if exists (select 1 from public.finance_transaction transaction
      where transaction.center_id = v_cycle.center_id and transaction.status = 'POSTED'
        and transaction.source_module = 'hoc-phi' and transaction.source_type = 'tuition-payment'
        and transaction.source_tuition_id = v_cycle.tuition_local_id
        and transaction.source_period_id = v_cycle.payment_period_id) then
      raise exception 'v2_4_provisional_package_locked_by_payment'; end if;
    select * into v_package from public.center_tuition_package_catalog package
    where package.id = v_package_id and package.center_id = p_center_id and package.is_active for share;
    if v_package.id is null then raise exception 'v2_4_package_not_available'; end if;
    v_before := pg_catalog.to_jsonb(v_cycle);
    update public.center_tuition_package_cycles cycle
    set package_catalog_id = v_package.id, package_name_snapshot = v_package.package_name,
        total_sessions_snapshot = v_package.total_sessions, price_snapshot = v_package.default_amount,
        lifecycle_status = case when cycle.lifecycle_status = 'PREPARED'
          then 'PREPARED' else 'PROVISIONAL_UNPAID' end,
        version = cycle.version + 1, updated_by = v_actor,
        updated_at = pg_catalog.clock_timestamp()
    where cycle.id = v_cycle.id returning * into v_cycle;
  else
    raise exception 'v2_4_invalid_operation';
  end if;

  insert into public.center_tuition_cycle_audit_events(
    center_id, actor_user_id, action, entity_type, entity_id,
    before_state, after_state, command_idempotency_key
  ) values (p_center_id, v_actor, v_operation, 'PACKAGE_CYCLE', v_cycle.id,
    v_before, pg_catalog.to_jsonb(v_cycle), p_idempotency_key);
  v_response := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED', 'center_id', p_center_id,
    'student_id', v_student_id, 'cycle_id', v_cycle.id,
    'cycle_number', v_cycle.cycle_number, 'version', v_cycle.version,
    'replayed', false
  );
  insert into public.center_tuition_cycle_command_results(
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (p_center_id, v_actor, p_idempotency_key, v_intent, v_response);
  return v_response;
exception
  when unique_violation then raise exception 'v2_4_prepared_cycle_exists';
end
$function$;

-- Prepared/completed cycles are not operational attendance reminder targets.
do $f5b_b2a_patch_attendance_reminder$
declare
  v_definition text;
  v_patched text;
  v_search constant text := 'WHERE c.lifecycle_status <> ''SUPERSEDED''::text';
  v_replacement constant text :=
    'WHERE c.lifecycle_status = ANY (ARRAY[''ACTIVE''::text, ''PROVISIONAL_UNPAID''::text, ''NEEDS_PACKAGE_SELECTION''::text])';
  v_payment_search constant text := 'AND cycle.used_sessions >= 1';
  v_payment_replacement constant text := 'AND cycle.used_sessions >= 0';
  v_origin_search constant text := 'cycle.origin = ''AUTOMATIC_ROLLOVER''::text';
  v_origin_replacement constant text :=
    'cycle.origin = ANY (ARRAY[''AUTOMATIC_ROLLOVER''::text, ''OPERATOR_PREPARED''::text])';
  v_match_count integer;
begin
  select pg_catalog.pg_get_viewdef(
    'public.center_attendance_operational_reminder_projection'::regclass, true
  ) into v_definition;
  v_match_count := (
    pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_search, ''))
  ) / pg_catalog.length(v_search);
  if v_match_count <> 1 then
    raise exception 'f5b_b2a_attendance_reminder_projection_drift:%', v_match_count;
  end if;
  v_patched := pg_catalog.replace(v_definition, v_search, v_replacement);
  v_match_count := (
    pg_catalog.length(v_patched) - pg_catalog.length(pg_catalog.replace(v_patched, v_payment_search, ''))
  ) / pg_catalog.length(v_payment_search);
  if v_match_count <> 1 then
    raise exception 'f5b_b2a_attendance_payment_due_projection_drift:%', v_match_count;
  end if;
  v_patched := pg_catalog.replace(v_patched, v_payment_search, v_payment_replacement);
  v_match_count := (
    pg_catalog.length(v_patched) - pg_catalog.length(pg_catalog.replace(v_patched, v_origin_search, ''))
  ) / pg_catalog.length(v_origin_search);
  if v_match_count <> 1 then
    raise exception 'f5b_b2a_attendance_payment_origin_projection_drift:%', v_match_count;
  end if;
  v_patched := pg_catalog.replace(v_patched, v_origin_search, v_origin_replacement);
  execute 'create or replace view public.center_attendance_operational_reminder_projection '
    || 'with (security_invoker = false) as ' || v_patched;
end
$f5b_b2a_patch_attendance_reminder$;

alter function public.f5b_b2a_internal_prepared_payment_amount(text,text,text,text) owner to postgres;
alter function public.f5b_b2a_internal_activate_prepared_cycle(uuid,uuid,uuid) owner to postgres;
alter function public.v2_4_internal_reconcile_student(text,text,uuid) owner to postgres;
alter function public.v2_4_list_package_cycle_state(text) owner to postgres;
alter function public.v2_4_mutate_package_cycle(text,jsonb,uuid) owner to postgres;
alter function public.c5_4_mutate_finance_shared_truth(text,jsonb,uuid) owner to postgres;

revoke all on function public.v2_4_list_package_cycle_state(text)
  from public, anon, authenticated, service_role;
revoke all on function public.v2_4_mutate_package_cycle(text,jsonb,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.v2_4_list_package_cycle_state(text) to authenticated;
grant execute on function public.v2_4_mutate_package_cycle(text,jsonb,uuid) to authenticated;

comment on function public.f5b_b2a_internal_prepared_payment_amount(text,text,text,text) is
  'Exact prepared-cycle Finance authority; arbitrary future Tuition periods return NULL.';
comment on function public.f5b_b2a_internal_activate_prepared_cycle(uuid,uuid,uuid) is
  'Promotes one canonical PREPARED successor at the attendance completion boundary and advances Tuition currentTerm atomically.';
comment on index public.center_tuition_package_cycles_one_prepared_next_idx is
  'At most one prepared-but-inactive next cycle per Student and center.';
