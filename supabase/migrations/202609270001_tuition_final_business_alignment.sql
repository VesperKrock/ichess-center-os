begin;

-- Final Tuition business alignment. This migration is additive/forward-only:
-- it preserves every Finance row, Receipt, TBHP artifact, Attendance fact and
-- historical cycle while making each cycle own its opening and commercial
-- truth.
do $tuition_final_prerequisites$
begin
  if pg_catalog.to_regclass('public.center_tuition_package_cycles') is null
     or pg_catalog.to_regclass('public.center_tuition_attendance_contributions') is null
     or pg_catalog.to_regprocedure('public.v2_4_list_package_cycle_state(text)') is null
     or pg_catalog.to_regprocedure('public.v2_4_mutate_package_cycle(text,jsonb,uuid)') is null
     or pg_catalog.to_regprocedure('public.f5b_mutate_tuition_receipt(text,jsonb,uuid)') is null
     or pg_catalog.to_regprocedure('public.tbhp_get_printable_document(text,uuid)') is null then
    raise exception 'tuition_final_business_alignment_prerequisite_missing';
  end if;
end
$tuition_final_prerequisites$;

alter table public.center_operational_profiles
  add column initial_student_setup_enabled boolean not null default false;

alter table public.center_tuition_package_cycles
  add column opening_context text not null default 'NEW_ICHESS',
  add column opening_payment_state text not null default 'UNPAID',
  add column discount_amount_snapshot bigint not null default 0,
  add column discount_type_snapshot text not null default 'none',
  add column discount_value_snapshot numeric not null default 0,
  add column material_fee_snapshot bigint not null default 0,
  add column max_completion_weeks_snapshot integer,
  add column manually_ended_at timestamptz,
  add column manually_ended_by uuid references auth.users(id) on delete restrict,
  add column expired_sessions_snapshot integer;

-- Existing opening progress is the only reliable legacy marker available for
-- old rows. Never infer an old payment from the absence/presence of Finance.
update public.center_tuition_package_cycles cycle
set opening_context = case when cycle.cycle_number = 1
      and cycle.baseline_used_sessions > 0 then 'LEGACY_BEFORE_ICHESS'
    else 'NEW_ICHESS' end,
    opening_payment_state = 'UNPAID';

-- Existing issued Receipts are the strongest historical commercial snapshot.
update public.center_tuition_package_cycles cycle
set price_snapshot = receipt.tuition_amount_minor,
    discount_amount_snapshot = receipt.discount_amount_minor,
    discount_type_snapshot = coalesce(nullif(receipt.snapshot#>>'{money,discount,type}', ''), 'none'),
    discount_value_snapshot = case
      when coalesce(receipt.snapshot#>>'{money,discount,value}', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (receipt.snapshot#>>'{money,discount,value}')::numeric
      else 0 end,
    material_fee_snapshot = receipt.material_fee_minor
from public.center_tuition_receipts receipt
where receipt.center_id = cycle.center_id
  and receipt.target_cycle_id = cycle.id
  and receipt.invalidated_at is null;

-- For the still-current first cycle, freeze the already-authoritative Tuition
-- terms when no issued Receipt snapshot exists yet.
update public.center_tuition_package_cycles cycle
set price_snapshot = case
      when coalesce(tuition.payload->>'totalAmount', '') ~ '^[0-9]+$'
        then (tuition.payload->>'totalAmount')::bigint
      else cycle.price_snapshot end,
    discount_amount_snapshot = case
      when coalesce(tuition.payload->>'discountAmount', '0') ~ '^[0-9]+$'
        then least((tuition.payload->>'discountAmount')::bigint,
          case when coalesce(tuition.payload->>'totalAmount', '') ~ '^[0-9]+$'
            then (tuition.payload->>'totalAmount')::bigint else cycle.price_snapshot end)
      else 0 end,
    discount_type_snapshot = coalesce(nullif(tuition.payload->>'discountType', ''), 'none'),
    discount_value_snapshot = case
      when coalesce(tuition.payload->>'discountValue', '0') ~ '^[0-9]+([.][0-9]+)?$'
        then (tuition.payload->>'discountValue')::numeric else 0 end
from public.center_cloud_entities tuition
where cycle.cycle_number = 1
  and tuition.center_id = cycle.center_id
  and tuition.entity_type = 'tuition_record_package'
  and tuition.local_id = cycle.tuition_local_id
  and tuition.deleted_at is null
  and tuition.payload->>'currentTermId' = cycle.payment_period_id
  and not exists (
    select 1 from public.center_tuition_receipts receipt
    where receipt.center_id = cycle.center_id
      and receipt.target_cycle_id = cycle.id
      and receipt.invalidated_at is null
  );

update public.center_tuition_package_cycles cycle
set material_fee_snapshot = profile.renewal_material_fee_minor
from public.center_operational_profiles profile
where profile.center_id = cycle.center_id
  and cycle.cycle_number > 1
  and not exists (
    select 1 from public.center_tuition_receipts receipt
    where receipt.center_id = cycle.center_id
      and receipt.target_cycle_id = cycle.id
      and receipt.invalidated_at is null
  );

update public.center_tuition_package_cycles cycle
set max_completion_weeks_snapshot = package.max_completion_weeks
from public.center_tuition_package_catalog package
where package.center_id = cycle.center_id and package.id = cycle.package_catalog_id;

alter table public.center_tuition_package_cycles
  add constraint center_tuition_cycles_opening_context_check
    check (opening_context in ('NEW_ICHESS', 'LEGACY_BEFORE_ICHESS')),
  add constraint center_tuition_cycles_opening_payment_check
    check (opening_payment_state in ('UNPAID', 'PAID_BEFORE_ICHESS')),
  add constraint center_tuition_cycles_discount_amount_check
    check (discount_amount_snapshot between 0 and coalesce(price_snapshot, 9007199254740991)),
  add constraint center_tuition_cycles_discount_type_check
    check (char_length(discount_type_snapshot) between 1 and 80
      and discount_type_snapshot !~ '[[:cntrl:]]'),
  add constraint center_tuition_cycles_discount_value_check
    check (discount_value_snapshot between 0 and 9007199254740991),
  add constraint center_tuition_cycles_material_fee_check
    check (material_fee_snapshot between 0 and 9007199254740991),
  add constraint center_tuition_cycles_max_weeks_check
    check (max_completion_weeks_snapshot is null
      or max_completion_weeks_snapshot between 1 and 5200),
  add constraint center_tuition_cycles_manual_end_check check (
    (manually_ended_at is null and manually_ended_by is null
      and expired_sessions_snapshot is null)
    or
    (manually_ended_at is not null and manually_ended_by is not null
      and expired_sessions_snapshot is not null and expired_sessions_snapshot >= 0
      and lifecycle_status = 'COMPLETED')
  );

alter table public.center_tuition_attendance_contributions
  add column teacher_name_snapshot text not null default '';
alter table public.center_tuition_attendance_contributions
  add constraint center_tuition_contribution_teacher_snapshot_check
    check (char_length(teacher_name_snapshot) <= 240
      and teacher_name_snapshot !~ '[[:cntrl:]]');

update public.center_tuition_attendance_contributions contribution
set teacher_name_snapshot = coalesce((
  select pg_catalog.left(pg_catalog.btrim(attendance.payload->>'teacherName'), 240)
  from public.center_cloud_entities attendance
  where attendance.center_id = contribution.center_id
    and attendance.entity_type = 'attendance_record'
    and attendance.local_id = contribution.attendance_entity_local_id
    and attendance.deleted_at is null
    and pg_catalog.btrim(coalesce(attendance.payload->>'teacherName', '')) <> ''
  limit 1
), (
  select pg_catalog.left(pg_catalog.btrim(report.payload->>'teacherName'), 240)
  from public.center_cloud_entities report
  where report.center_id = contribution.center_id
    and report.entity_type = 'session_report'
    and report.deleted_at is null
    and coalesce(report.payload->>'scheduleSessionId', report.payload->>'sessionId')
      = contribution.schedule_session_local_id
    and coalesce(report.payload->>'date', report.payload->>'sessionDate', report.payload->>'occurrenceDate')
      = contribution.occurrence_date::text
    and pg_catalog.btrim(coalesce(report.payload->>'teacherName', '')) <> ''
  order by report.entity_version desc
  limit 1
), '');

create function public.tuition_final_snapshot_contribution_teacher()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare v_teacher text;
begin
  if tg_op = 'UPDATE'
     and new.attendance_entity_local_id = old.attendance_entity_local_id
     and new.attendance_entity_version = old.attendance_entity_version then
    return new;
  end if;
  select pg_catalog.btrim(coalesce(attendance.payload->>'teacherName', ''))
    into v_teacher
  from public.center_cloud_entities attendance
  where attendance.center_id = new.center_id
    and attendance.entity_type = 'attendance_record'
    and attendance.local_id = new.attendance_entity_local_id
    and attendance.deleted_at is null;
  new.teacher_name_snapshot := pg_catalog.left(coalesce(v_teacher, ''), 240);
  return new;
end
$function$;

create trigger tuition_final_contribution_teacher_snapshot
before insert or update of attendance_entity_local_id, attendance_entity_version
on public.center_tuition_attendance_contributions
for each row execute function public.tuition_final_snapshot_contribution_teacher();

create function public.tuition_final_guard_cycle_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_package public.center_tuition_package_catalog;
  v_tuition public.center_cloud_entities;
  v_profile public.center_operational_profiles;
begin
  if tg_op = 'UPDATE' and (
    new.package_catalog_id is distinct from old.package_catalog_id
    or new.package_name_snapshot is distinct from old.package_name_snapshot
    or new.program_name_snapshot is distinct from old.program_name_snapshot
    or new.total_sessions_snapshot is distinct from old.total_sessions_snapshot
    or new.price_snapshot is distinct from old.price_snapshot
    or new.discount_amount_snapshot is distinct from old.discount_amount_snapshot
    or new.discount_type_snapshot is distinct from old.discount_type_snapshot
    or new.discount_value_snapshot is distinct from old.discount_value_snapshot
    or new.material_fee_snapshot is distinct from old.material_fee_snapshot
  ) and exists (
    select 1 from public.center_tuition_attendance_contributions contribution
    where contribution.center_id = old.center_id and contribution.cycle_id = old.id
      and contribution.ended_at is null and contribution.allocation_state = 'APPLIED'
      and contribution.contribution_units = 1
  ) then
    raise exception 'tuition_final_package_terms_locked';
  end if;

  if tg_op = 'INSERT' or new.package_catalog_id is distinct from old.package_catalog_id then
    if new.package_catalog_id is not null then
      select * into v_package from public.center_tuition_package_catalog package
      where package.center_id = new.center_id and package.id = new.package_catalog_id;
      if v_package.id is null then raise exception 'v2_4_package_not_available'; end if;
      new.package_name_snapshot := v_package.package_name;
      new.program_name_snapshot := v_package.program_name;
      new.total_sessions_snapshot := v_package.total_sessions;
      new.price_snapshot := v_package.default_amount;
      new.max_completion_weeks_snapshot := v_package.max_completion_weeks;
    end if;
    new.discount_amount_snapshot := 0;
    new.discount_type_snapshot := 'none';
    new.discount_value_snapshot := 0;
    new.material_fee_snapshot := 0;
    if new.cycle_number = 1 then
      select * into v_tuition from public.center_cloud_entities tuition
      where tuition.center_id = new.center_id
        and tuition.entity_type = 'tuition_record_package'
        and tuition.local_id = new.tuition_local_id
        and tuition.deleted_at is null;
      if v_tuition.id is not null
         and v_tuition.payload->>'currentTermId' = new.payment_period_id then
        if coalesce(v_tuition.payload->>'totalAmount', '') ~ '^[0-9]+$' then
          new.price_snapshot := (v_tuition.payload->>'totalAmount')::bigint;
        end if;
        if coalesce(v_tuition.payload->>'discountAmount', '0') ~ '^[0-9]+$' then
          new.discount_amount_snapshot := least(
            (v_tuition.payload->>'discountAmount')::bigint,
            coalesce(new.price_snapshot, 0));
        end if;
        new.discount_type_snapshot := coalesce(nullif(v_tuition.payload->>'discountType', ''), 'none');
        if coalesce(v_tuition.payload->>'discountValue', '0') ~ '^[0-9]+([.][0-9]+)?$' then
          new.discount_value_snapshot := (v_tuition.payload->>'discountValue')::numeric;
        end if;
      end if;
    elsif new.package_catalog_id is not null then
      select * into v_profile from public.center_operational_profiles profile
      where profile.center_id = new.center_id;
      new.material_fee_snapshot := coalesce(v_profile.renewal_material_fee_minor, 0);
    end if;
  end if;
  return new;
end
$function$;

create trigger tuition_final_guard_cycle_terms
before insert or update on public.center_tuition_package_cycles
for each row execute function public.tuition_final_guard_cycle_terms();

-- Keep the projection binary: a cycle is unpaid or fully paid. An explicit
-- pre-iChess paid opening is paid without manufacturing a Finance row.
create or replace view public.center_tuition_package_cycle_projection
with (security_invoker = false)
as
select
  cycle.id, cycle.center_id, cycle.student_local_id, cycle.tuition_local_id,
  cycle.cycle_number, cycle.predecessor_cycle_id, cycle.package_catalog_id,
  cycle.package_name_snapshot, cycle.total_sessions_snapshot,
  cycle.price_snapshot, cycle.payment_period_id, cycle.baseline_used_sessions,
  cycle.baseline_cutoff_date, cycle.baseline_review_note,
  cycle.lifecycle_status, cycle.origin, cycle.bcht_status, cycle.bcht_note,
  cycle.bcht_completed_at, cycle.bcht_completed_by, cycle.version,
  cycle.created_by, cycle.updated_by, cycle.created_at, cycle.updated_at,
  coalesce(contribution.applied_sessions, 0)::integer as contributed_sessions,
  coalesce(contribution.pending_sessions, 0)::integer as pending_sessions,
  (cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer)::integer as used_sessions,
  case when cycle.total_sessions_snapshot is null then null
    else greatest(cycle.total_sessions_snapshot - cycle.baseline_used_sessions
      - coalesce(contribution.applied_sessions, 0)::integer, 0)::integer end as remaining_sessions,
  coalesce(payment.paid_tuition, 0)::bigint as paid_amount,
  case
    when cycle.price_snapshot is null then 'NEEDS_PACKAGE_SELECTION'
    when cycle.opening_payment_state = 'PAID_BEFORE_ICHESS' then 'PAID'
    when coalesce(payment.paid_cash, 0) >= cycle.price_snapshot
        - cycle.discount_amount_snapshot + cycle.material_fee_snapshot
      and coalesce(payment.paid_tuition, 0) >= cycle.price_snapshot
        - cycle.discount_amount_snapshot then 'PAID'
    else 'UNPAID' end as payment_status,
  case
    when cycle.lifecycle_status = 'PREPARED' then 'PENDING_ACTIVATION'
    when cycle.lifecycle_status = 'PROVISIONAL_UNPAID'
      and not (coalesce(payment.paid_cash, 0) >= coalesce(cycle.price_snapshot, 0)
        - cycle.discount_amount_snapshot + cycle.material_fee_snapshot)
      then 'PROVISIONAL_UNPAID'
    when cycle.total_sessions_snapshot is null then 'PACKAGE_SELECTION_REQUIRED'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer
      >= cycle.total_sessions_snapshot and cycle.bcht_status <> 'COMPLETED'
      then 'PACKAGE_EXHAUSTED_BCHT_DUE'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer
      >= cycle.total_sessions_snapshot then 'PACKAGE_EXHAUSTED'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer
      >= cycle.total_sessions_snapshot - 2 and cycle.bcht_status <> 'COMPLETED'
      then 'BCHT_AND_RENEWAL_DUE'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer
      >= cycle.total_sessions_snapshot - 2 then 'RENEWAL_DUE'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer
      >= cycle.total_sessions_snapshot - 4 and cycle.bcht_status <> 'COMPLETED'
      then 'BCHT_DUE'
    else 'NORMAL' end as reminder_state,
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
    pg_catalog.count(*) filter (where item.allocation_state = 'APPLIED'
      and item.contribution_units = 1) as applied_sessions,
    pg_catalog.count(*) filter (where item.allocation_state = 'PENDING_PACKAGE_SELECTION'
      and item.contribution_units = 1) as pending_sessions
  from public.center_tuition_attendance_contributions item
  where item.center_id = cycle.center_id and item.cycle_id = cycle.id
    and item.ended_at is null
) contribution on true
left join lateral (
  select coalesce(pg_catalog.sum(transaction.amount_minor), 0) as paid_cash,
    coalesce(pg_catalog.sum(coalesce(transaction.tuition_allocation_minor,
      transaction.amount_minor)), 0) as paid_tuition
  from public.finance_transaction transaction
  where transaction.center_id = cycle.center_id and transaction.status = 'POSTED'
    and transaction.source_module = 'hoc-phi'
    and transaction.source_type = 'tuition-payment'
    and transaction.source_tuition_id = cycle.tuition_local_id
    and transaction.source_period_id = cycle.payment_period_id
) payment on true;

create function public.tuition_final_cycle_json(
  p_center_id text, p_cycle_id uuid, p_base jsonb
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select p_base || pg_catalog.jsonb_build_object(
    'package_catalog_id', cycle.package_catalog_id,
    'price', cycle.price_snapshot,
    'discount_amount', cycle.discount_amount_snapshot,
    'discount_type', cycle.discount_type_snapshot,
    'discount_value', cycle.discount_value_snapshot,
    'material_fee', cycle.material_fee_snapshot,
    'amount_due', case when cycle.price_snapshot is null then null else
      cycle.price_snapshot - cycle.discount_amount_snapshot + cycle.material_fee_snapshot end,
    'opening_context', cycle.opening_context,
    'opening_payment_state', cycle.opening_payment_state,
    'manually_ended_at', cycle.manually_ended_at,
    'expired_sessions', cycle.expired_sessions_snapshot,
    'baseline_used', cycle.baseline_used_sessions,
    'contributed_sessions', projection.contributed_sessions,
    'used_sessions', projection.used_sessions,
    'remaining_sessions', projection.remaining_sessions,
    'paid_amount', projection.paid_amount,
    'payment_status', projection.payment_status
  )
  from public.center_tuition_package_cycles cycle
  join public.center_tuition_package_cycle_projection projection
    on projection.center_id = cycle.center_id and projection.id = cycle.id
  where cycle.center_id = p_center_id and cycle.id = p_cycle_id
$function$;

alter function public.v2_4_list_package_cycle_state(text)
  rename to v2_4_list_package_cycle_state_pre_final_business_alignment;
revoke all on function public.v2_4_list_package_cycle_state_pre_final_business_alignment(text)
  from public, anon, authenticated, service_role;

create function public.v2_4_list_package_cycle_state(p_center_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_students jsonb := '[]'::jsonb;
  v_student jsonb;
  v_cycles jsonb;
begin
  v_result := public.v2_4_list_package_cycle_state_pre_final_business_alignment(p_center_id);
  if coalesce(v_result->>'ok', 'false') <> 'true' then return v_result; end if;
  for v_student in select value from pg_catalog.jsonb_array_elements(v_result->'students')
  loop
    select coalesce(pg_catalog.jsonb_agg(
      public.tuition_final_cycle_json(p_center_id, (item.value->>'id')::uuid, item.value)
      order by item.ordinality), '[]'::jsonb)
      into v_cycles
    from pg_catalog.jsonb_array_elements(v_student->'cycles')
      with ordinality as item(value, ordinality);
    v_student := pg_catalog.jsonb_set(v_student, '{cycles}', v_cycles, true);
    if v_student->'current_cycle' <> 'null'::jsonb then
      v_student := pg_catalog.jsonb_set(v_student, '{current_cycle}',
        public.tuition_final_cycle_json(p_center_id,
          (v_student#>>'{current_cycle,id}')::uuid, v_student->'current_cycle'), true);
    end if;
    if v_student->'prepared_next_cycle' <> 'null'::jsonb then
      v_student := pg_catalog.jsonb_set(v_student, '{prepared_next_cycle}',
        public.tuition_final_cycle_json(p_center_id,
          (v_student#>>'{prepared_next_cycle,id}')::uuid,
          v_student->'prepared_next_cycle'), true);
    end if;
    v_students := v_students || pg_catalog.jsonb_build_array(v_student);
  end loop;
  return pg_catalog.jsonb_set(v_result, '{students}', v_students, true);
end
$function$;

alter function public.v2_4_mutate_package_cycle(text,jsonb,uuid)
  rename to v2_4_mutate_package_cycle_pre_final_business_alignment;
revoke all on function public.v2_4_mutate_package_cycle_pre_final_business_alignment(text,jsonb,uuid)
  from public, anon, authenticated, service_role;

create function public.v2_4_mutate_package_cycle(
  p_center_id text, p_command jsonb, p_idempotency_key uuid
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
  v_context text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'opening_context', '')));
  v_opening_payment text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'opening_payment_state', '')));
  v_cycle public.center_tuition_package_cycles;
  v_next public.center_tuition_package_cycles;
  v_tuition public.center_cloud_entities;
  v_cycle_id uuid;
  v_expected_version bigint;
  v_used integer;
  v_expired integer;
  v_paid bigint;
  v_next_paid bigint;
  v_next_status text;
  v_before jsonb;
  v_next_before jsonb;
  v_result jsonb;
  v_term_history jsonb;
  v_previous_term jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_actor is null then raise exception 'v2_4_not_authenticated'; end if;
  if p_idempotency_key is null or p_command is null
     or pg_catalog.jsonb_typeof(p_command) <> 'object' or v_student_id = '' then
    raise exception 'v2_4_invalid_command';
  end if;
  select * into v_membership from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'v2_4_center_access_denied'; end if;

  if v_operation = 'START_CYCLE' then
    if v_context not in ('NEW_ICHESS', 'LEGACY_BEFORE_ICHESS')
       or v_opening_payment not in ('UNPAID', 'PAID_BEFORE_ICHESS')
       or (v_context = 'NEW_ICHESS' and (
         coalesce(p_command->>'baseline_used_sessions', '') <> '0'
         or v_opening_payment <> 'UNPAID')) then
      raise exception 'v2_4_invalid_baseline';
    end if;
    v_result := public.v2_4_mutate_package_cycle_pre_final_business_alignment(
      p_center_id, p_command, p_idempotency_key);
    if coalesce(v_result->>'ok', 'false') = 'true' then
      update public.center_tuition_package_cycles cycle
      set opening_context = v_context, opening_payment_state = v_opening_payment
      where cycle.center_id = p_center_id and cycle.id = (v_result->>'cycle_id')::uuid
        and (cycle.opening_context is distinct from v_context
          or cycle.opening_payment_state is distinct from v_opening_payment);
    end if;
    return v_result;
  end if;

  if v_operation = 'SELECT_PROVISIONAL_PACKAGE' then
    v_cycle_id := (p_command->>'cycle_id')::uuid;
    if exists (
      select 1 from public.center_tuition_attendance_contributions contribution
      where contribution.center_id = p_center_id and contribution.cycle_id = v_cycle_id
        and contribution.ended_at is null and contribution.allocation_state = 'APPLIED'
        and contribution.contribution_units = 1
    ) then
      raise exception 'tuition_final_package_terms_locked';
    end if;
    return public.v2_4_mutate_package_cycle_pre_final_business_alignment(
      p_center_id, p_command, p_idempotency_key);
  end if;

  if v_operation <> 'END_CYCLE' then
    return public.v2_4_mutate_package_cycle_pre_final_business_alignment(
      p_center_id, p_command, p_idempotency_key);
  end if;

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
  v_cycle_id := (p_command->>'cycle_id')::uuid;
  v_expected_version := (p_command->>'expected_version')::bigint;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'v2.4.student|' || p_center_id || '|' || v_student_id, 0));
  select * into v_cycle from public.center_tuition_package_cycles cycle
  where cycle.center_id = p_center_id and cycle.id = v_cycle_id
    and cycle.student_local_id = v_student_id for update;
  if v_cycle.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_FOUND');
  end if;
  if v_cycle.version <> v_expected_version
     or v_cycle.lifecycle_status not in ('ACTIVE', 'PROVISIONAL_UNPAID') then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'STALE_VERSION');
  end if;
  if v_cycle.manually_ended_at is not null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CYCLE_ALREADY_ENDED');
  end if;
  select projection.used_sessions into v_used
  from public.center_tuition_package_cycle_projection projection
  where projection.center_id = p_center_id and projection.id = v_cycle.id;
  if v_cycle.total_sessions_snapshot is null or v_used >= v_cycle.total_sessions_snapshot then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CYCLE_ALREADY_ENDED');
  end if;
  v_expired := v_cycle.total_sessions_snapshot - v_used;
  select coalesce(pg_catalog.sum(transaction.amount_minor), 0) into v_paid
  from public.finance_transaction transaction
  where transaction.center_id = p_center_id and transaction.status = 'POSTED'
    and transaction.source_module = 'hoc-phi' and transaction.source_type = 'tuition-payment'
    and transaction.source_tuition_id = v_cycle.tuition_local_id
    and transaction.source_period_id = v_cycle.payment_period_id;
  select * into v_tuition from public.center_cloud_entities tuition
  where tuition.center_id = p_center_id and tuition.entity_type = 'tuition_record_package'
    and tuition.local_id = v_cycle.tuition_local_id and tuition.deleted_at is null for update;
  if v_tuition.id is null or v_tuition.payload->>'studentId' <> v_student_id
     or v_tuition.payload->>'currentTermId' <> v_cycle.payment_period_id then
    raise exception 'v2_4_tuition_period_stale';
  end if;

  select * into v_next from public.center_tuition_package_cycles next_cycle
  where next_cycle.center_id = p_center_id and next_cycle.student_local_id = v_student_id
    and next_cycle.cycle_number = v_cycle.cycle_number + 1 for update;
  if v_next.id is null then
    insert into public.center_tuition_package_cycles(
      center_id, student_local_id, tuition_local_id, cycle_number,
      predecessor_cycle_id, package_catalog_id, package_name_snapshot,
      program_name_snapshot, total_sessions_snapshot, price_snapshot,
      payment_period_id, baseline_used_sessions, baseline_cutoff_date,
      lifecycle_status, origin, created_by, updated_by
    ) values (
      p_center_id, v_student_id, v_cycle.tuition_local_id, v_cycle.cycle_number + 1,
      v_cycle.id, v_cycle.package_catalog_id, v_cycle.package_name_snapshot,
      v_cycle.program_name_snapshot, v_cycle.total_sessions_snapshot, v_cycle.price_snapshot,
      pg_catalog.gen_random_uuid()::text, 0, v_cycle.baseline_cutoff_date,
      'PROVISIONAL_UNPAID', 'OPERATOR_PREPARED', v_actor, v_actor
    ) returning * into v_next;
    v_next_before := null;
  elsif v_next.lifecycle_status = 'PREPARED' then
    v_next_before := pg_catalog.to_jsonb(v_next);
  else
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_STATE_CONFLICT');
  end if;
  select coalesce(pg_catalog.sum(transaction.amount_minor), 0) into v_next_paid
  from public.finance_transaction transaction
  where transaction.center_id = p_center_id and transaction.status = 'POSTED'
    and transaction.source_module = 'hoc-phi' and transaction.source_type = 'tuition-payment'
    and transaction.source_tuition_id = v_next.tuition_local_id
    and transaction.source_period_id = v_next.payment_period_id;
  v_next_status := case when v_next.opening_payment_state = 'PAID_BEFORE_ICHESS'
      or v_next_paid >= v_next.price_snapshot - v_next.discount_amount_snapshot
        + v_next.material_fee_snapshot then 'ACTIVE' else 'PROVISIONAL_UNPAID' end;

  v_before := pg_catalog.to_jsonb(v_cycle);
  update public.center_tuition_package_cycles cycle
  set lifecycle_status = 'COMPLETED', manually_ended_at = v_now,
      manually_ended_by = v_actor, expired_sessions_snapshot = v_expired,
      version = cycle.version + 1, updated_by = v_actor, updated_at = v_now
  where cycle.id = v_cycle.id returning * into v_cycle;
  update public.center_tuition_package_cycles cycle
  set lifecycle_status = v_next_status, version = cycle.version + 1,
      updated_by = v_actor, updated_at = v_now
  where cycle.id = v_next.id returning * into v_next;

  v_term_history := case when pg_catalog.jsonb_typeof(v_tuition.payload->'termHistory') = 'array'
    then v_tuition.payload->'termHistory' else '[]'::jsonb end;
  v_previous_term := pg_catalog.jsonb_build_object(
    'id', v_cycle.payment_period_id, 'termNumber', v_cycle.cycle_number,
    'packageCatalogId', v_cycle.package_catalog_id,
    'packageName', v_cycle.package_name_snapshot,
    'programName', coalesce(v_cycle.program_name_snapshot, ''),
    'totalSessions', v_cycle.total_sessions_snapshot, 'usedSessions', v_used,
    'expiredSessions', v_expired, 'totalAmount', v_cycle.price_snapshot,
    'discountType', v_cycle.discount_type_snapshot,
    'discountValue', v_cycle.discount_value_snapshot,
    'discountAmount', v_cycle.discount_amount_snapshot,
    'paidAmount', v_paid, 'status', 'ended', 'endedAt', v_now,
    'payments', case when pg_catalog.jsonb_typeof(v_tuition.payload->'payments') = 'array'
      then v_tuition.payload->'payments' else '[]'::jsonb end
  );
  update public.center_cloud_entities tuition
  set payload = tuition.payload || pg_catalog.jsonb_build_object(
      'packageCatalogId', v_next.package_catalog_id,
      'packageName', v_next.package_name_snapshot,
      'programName', coalesce(v_next.program_name_snapshot, ''),
      'totalSessions', v_next.total_sessions_snapshot, 'usedSessions', 0,
      'totalAmount', v_next.price_snapshot,
      'discountType', v_next.discount_type_snapshot,
      'discountValue', v_next.discount_value_snapshot,
      'discountAmount', v_next.discount_amount_snapshot,
      'paidAmount', v_next_paid, 'currentTermNumber', v_next.cycle_number,
      'currentTermId', v_next.payment_period_id, 'startedAt', v_now,
      'payments', '[]'::jsonb,
      'termHistory', v_term_history || pg_catalog.jsonb_build_array(v_previous_term),
      'updatedAt', v_now),
      source_module = 'tuition', source_version = 'tuition-final-business-alignment-v1',
      entity_version = tuition.entity_version + 1,
      updated_by = v_actor, updated_at = v_now
  where tuition.id = v_tuition.id;

  insert into public.center_tuition_cycle_audit_events(
    center_id, actor_user_id, action, entity_type, entity_id,
    before_state, after_state, command_idempotency_key
  ) values (p_center_id, v_actor, 'CYCLE_ENDED_EARLY', 'PACKAGE_CYCLE',
    v_cycle.id, v_before, pg_catalog.to_jsonb(v_cycle), p_idempotency_key);
  insert into public.center_tuition_cycle_audit_events(
    center_id, actor_user_id, action, entity_type, entity_id,
    before_state, after_state, command_idempotency_key
  ) values (p_center_id, v_actor, 'SUCCESSOR_DEFINED', 'PACKAGE_CYCLE',
    v_next.id, v_next_before, pg_catalog.to_jsonb(v_next), p_idempotency_key);
  v_result := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED', 'center_id', p_center_id,
    'student_id', v_student_id, 'cycle_id', v_cycle.id,
    'cycle_number', v_cycle.cycle_number, 'version', v_cycle.version,
    'used_sessions', v_used, 'expired_sessions', v_expired,
    'next_cycle_id', v_next.id, 'replayed', false);
  insert into public.center_tuition_cycle_command_results(
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (p_center_id, v_actor, p_idempotency_key, v_intent, v_result);
  return v_result;
end
$function$;

-- Inactive catalog entries remain valid historical/default terms. A manual
-- end is also a real boundary for all attendance recorded after it.
do $tuition_final_patch_reconcile$
declare
  v_definition text;
  v_active_search constant text := $search$and package.center_id = p_center_id
            and package.is_active$search$;
  v_active_replacement constant text := $replacement$and package.center_id = p_center_id$replacement$;
  v_boundary_search constant text := $search$    if v_units = 1 and v_cycle.total_sessions_snapshot is not null
       and v_used >= v_cycle.total_sessions_snapshot$search$;
  v_boundary_replacement constant text := $replacement$    while v_cycle.manually_ended_at is not null
      and (v_attendance.created_at > v_cycle.manually_ended_at
        or (v_attendance.payload->>'date')::date > v_cycle.manually_ended_at::date)
    loop
      v_cycle_number := v_cycle.cycle_number + 1;
      select * into v_next from public.center_tuition_package_cycles cycle
      where cycle.center_id = p_center_id
        and cycle.student_local_id = p_student_local_id
        and cycle.cycle_number = v_cycle_number
        and cycle.lifecycle_status <> 'SUPERSEDED'
      for update;
      if v_next.id is null then raise exception 'tuition_final_successor_missing'; end if;
      v_cycle := v_next;
      v_used := v_cycle.baseline_used_sessions;
    end loop;

    if v_units = 1 and v_cycle.total_sessions_snapshot is not null
       and v_used >= v_cycle.total_sessions_snapshot$replacement$;
  v_defined_search constant text := $search$    v_max_cycle_number := greatest(v_max_cycle_number, v_cycle.cycle_number);
    v_state := case when v_cycle.total_sessions_snapshot is null$search$;
  v_defined_replacement constant text := $replacement$    v_max_cycle_number := greatest(v_max_cycle_number, v_cycle.cycle_number);
    if v_units = 1 and v_cycle.total_sessions_snapshot is null then
      raise exception 'tuition_final_package_required_before_attendance';
    end if;
    v_state := case when v_cycle.total_sessions_snapshot is null$replacement$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.v2_4_internal_reconcile_student(text,text,uuid)'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(v_definition, v_active_search) = 0
     or pg_catalog.strpos(v_definition, v_boundary_search) = 0
     or pg_catalog.strpos(v_definition, v_defined_search) = 0 then
    raise exception 'tuition_final_reconcile_contract_drift';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_active_search, v_active_replacement);
  v_definition := pg_catalog.replace(v_definition, v_boundary_search, v_boundary_replacement);
  v_definition := pg_catalog.replace(v_definition, v_defined_search, v_defined_replacement);
  execute v_definition;
end
$tuition_final_patch_reconcile$;

-- Actual occurrence teacher is captured at attendance time. Legacy opening
-- rows are explicitly writable blanks; future rows remain empty.
create or replace function public.tbhp_internal_schedule_rows(
  p_center_id text, p_cycle_id uuid, p_student_local_id text,
  p_total_sessions integer, p_predecessor_cycle_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with cycle_baseline as (
    select greatest(coalesce(cycle.baseline_used_sessions, 0), 0)::integer as used_sessions
    from public.center_tuition_package_cycles cycle
    where cycle.center_id = p_center_id and cycle.id = p_cycle_id
  ), actual_base as (
    select contribution.occurrence_date as session_date,
      contribution.teacher_name_snapshot as teacher_name,
      contribution.schedule_session_local_id, contribution.id
    from public.center_tuition_attendance_contributions contribution
    where contribution.center_id = p_center_id and contribution.cycle_id = p_cycle_id
      and contribution.student_local_id = p_student_local_id
      and contribution.ended_at is null and contribution.allocation_state = 'APPLIED'
      and contribution.contribution_units = 1
      and contribution.occurrence_date <= current_date
  ), actual as (
    select cycle_baseline.used_sessions + pg_catalog.row_number() over (
        order by actual_base.session_date, actual_base.schedule_session_local_id, actual_base.id
      )::integer as ordinal,
      actual_base.session_date, actual_base.teacher_name
    from actual_base cross join cycle_baseline
  ), completed as (
    select series.ordinal, actual.session_date,
      coalesce(actual.teacher_name, '') as teacher_name,
      case when actual.ordinal is not null then 'ACTUAL'
        when series.ordinal <= cycle_baseline.used_sessions then 'LEGACY_UNKNOWN'
        else 'UNRESOLVED' end as source
    from pg_catalog.generate_series(1, greatest(coalesce(p_total_sessions, 0), 0)) series(ordinal)
    cross join cycle_baseline
    left join actual on actual.ordinal = series.ordinal
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'sessionNumber', completed.ordinal, 'date', completed.session_date,
    'teacherName', completed.teacher_name, 'source', completed.source
  ) order by completed.ordinal), '[]'::jsonb)
  from completed
$function$;

do $tuition_final_patch_tbhp$
declare
  v_definition text;
  v_money_search constant text := $search$  if v_registration = 'NEW_REGISTRATION' then
    if coalesce(v_tuition.payload->>'totalAmount', '') ~ '^[0-9]+$' then
      v_base := (v_tuition.payload->>'totalAmount')::bigint;
    else
      v_base := v_cycle.price_snapshot;
    end if;
    if coalesce(v_tuition.payload->>'discountAmount', '0') ~ '^[0-9]+$' then
      v_discount := least((v_tuition.payload->>'discountAmount')::bigint, v_base);
    end if;
    v_discount_type := coalesce(nullif(v_tuition.payload->>'discountType', ''), 'none');
  else
    v_base := v_cycle.price_snapshot;
    v_material := v_profile.renewal_material_fee_minor;
  end if;$search$;
  v_money_replacement constant text := $replacement$  v_base := v_cycle.price_snapshot;
  v_discount := v_cycle.discount_amount_snapshot;
  v_discount_type := v_cycle.discount_type_snapshot;
  v_material := v_cycle.material_fee_snapshot;$replacement$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.tbhp_get_printable_document(text,uuid)'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(v_definition, v_money_search) = 0
     or pg_catalog.strpos(v_definition, 'v_package.max_completion_weeks') = 0 then
    raise exception 'tuition_final_tbhp_contract_drift';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_money_search, v_money_replacement);
  v_definition := pg_catalog.replace(v_definition,
    'v_package.max_completion_weeks', 'v_cycle.max_completion_weeks_snapshot');
  execute v_definition;
end
$tuition_final_patch_tbhp$;

-- Patch the established atomic payment body only where it still reads live
-- Tuition terms. The bounded local_source_id trigger is intentionally left
-- untouched.
alter function public.f5b_mutate_tuition_receipt(text,jsonb,uuid)
  rename to f5b_mutate_tuition_receipt_pre_final_business_alignment;
revoke all on function public.f5b_mutate_tuition_receipt_pre_final_business_alignment(text,jsonb,uuid)
  from public, anon, authenticated, service_role;

do $tuition_final_patch_payment_body$
declare
  v_definition text;
  v_terms_search constant text := $search$    if v_registration = 'NEW_REGISTRATION' then
      if coalesce(v_tuition.payload->>'currentTermId', '') <> v_cycle.payment_period_id then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_PERIOD_STALE');
      end if;
      if coalesce(v_tuition.payload->>'totalAmount', '') !~ '^[0-9]+$'
         or coalesce(v_tuition.payload->>'discountAmount', '0') !~ '^[0-9]+$' then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_SOURCE_INVALID');
      end if;
      v_base := (v_tuition.payload->>'totalAmount')::bigint;
      v_discount := least((coalesce(v_tuition.payload->>'discountAmount', '0'))::bigint, v_base);
      v_discount_type := coalesce(nullif(v_tuition.payload->>'discountType', ''), 'none');
      if coalesce(v_tuition.payload->>'discountValue', '0') ~ '^[0-9]+([.][0-9]+)?$' then
        v_discount_value := (v_tuition.payload->>'discountValue')::numeric;
      end if;
      v_material := 0;
    else
      v_base := v_cycle.price_snapshot;
      v_material := v_profile.renewal_material_fee_minor;
    end if;$search$;
  v_terms_replacement constant text := $replacement$    v_base := v_cycle.price_snapshot;
    v_discount := v_cycle.discount_amount_snapshot;
    v_discount_type := v_cycle.discount_type_snapshot;
    v_discount_value := v_cycle.discount_value_snapshot;
    v_material := v_cycle.material_fee_snapshot;$replacement$;
  v_eligibility_search constant text :=
    $eligibility$v_cycle.lifecycle_status not in ('ACTIVE', 'PREPARED', 'PROVISIONAL_UNPAID')$eligibility$;
  v_eligibility_replacement constant text :=
    $eligibility$v_cycle.lifecycle_status not in ('ACTIVE', 'PREPARED', 'PROVISIONAL_UNPAID', 'COMPLETED')$eligibility$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.f5b_mutate_tuition_receipt_pre_final_business_alignment(text,jsonb,uuid)'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(v_definition, v_terms_search) = 0
     or pg_catalog.strpos(v_definition, v_eligibility_search) = 0 then
    raise exception 'tuition_final_payment_contract_drift';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_terms_search, v_terms_replacement);
  v_definition := pg_catalog.replace(v_definition,
    v_eligibility_search, v_eligibility_replacement);
  v_definition := pg_catalog.replace(v_definition,
    'v_prior_tuition + v_tuition_allocation >= v_cycle.price_snapshot',
    'v_prior_tuition + v_tuition_allocation >= v_cycle.price_snapshot - v_cycle.discount_amount_snapshot');
  execute v_definition;
end
$tuition_final_patch_payment_body$;

create function public.f5b_mutate_tuition_receipt(
  p_center_id text, p_command jsonb, p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_membership public.center_members;
  v_existing public.center_tuition_receipt_command_results;
  v_cycle public.center_tuition_package_cycles;
  v_cycle_id uuid;
  v_amount bigint;
  v_prior bigint;
  v_required bigint;
begin
  if pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', ''))) <> 'RECORD_PAYMENT' then
    return public.f5b_mutate_tuition_receipt_pre_final_business_alignment(
      p_center_id, p_command, p_idempotency_key);
  end if;
  if v_actor is null then raise exception 'f5b_not_authenticated'; end if;
  select * into v_membership from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'f5b_center_access_denied'; end if;
  select * into v_existing from public.center_tuition_receipt_command_results result
  where result.center_id = p_center_id and result.actor_user_id = v_actor
    and result.idempotency_key = p_idempotency_key;
  if v_existing.idempotency_key is not null then
    return public.f5b_mutate_tuition_receipt_pre_final_business_alignment(
      p_center_id, p_command, p_idempotency_key);
  end if;
  begin
    v_cycle_id := (p_command->>'target_cycle_id')::uuid;
    v_amount := (p_command#>>'{finance_command,amount_minor}')::bigint;
  exception when others then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
  end;
  select * into v_cycle from public.center_tuition_package_cycles cycle
  where cycle.center_id = p_center_id and cycle.id = v_cycle_id for update;
  if v_cycle.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_FOUND');
  end if;
  if v_cycle.opening_payment_state = 'PAID_BEFORE_ICHESS' then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CYCLE_ALREADY_PAID');
  end if;
  v_required := v_cycle.price_snapshot - v_cycle.discount_amount_snapshot
    + v_cycle.material_fee_snapshot;
  select coalesce(pg_catalog.sum(transaction.amount_minor), 0) into v_prior
  from public.finance_transaction transaction
  where transaction.center_id = p_center_id and transaction.status = 'POSTED'
    and transaction.source_module = 'hoc-phi' and transaction.source_type = 'tuition-payment'
    and transaction.source_tuition_id = v_cycle.tuition_local_id
    and transaction.source_period_id = v_cycle.payment_period_id;
  if v_prior <> 0 then
    return pg_catalog.jsonb_build_object('ok', false,
      'outcome_code', 'EXISTING_PARTIAL_PAYMENT_REVIEW_REQUIRED');
  end if;
  if v_amount <> v_required then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'FULL_PAYMENT_REQUIRED',
      'required_amount_minor', v_required);
  end if;
  return public.f5b_mutate_tuition_receipt_pre_final_business_alignment(
    p_center_id, p_command, p_idempotency_key);
end
$function$;

-- Center setup mode is presentation control; per-Student opening truth remains
-- on the cycle.
alter function public.v2_1_list_center_settings(text)
  rename to v2_1_list_center_settings_pre_final_business_alignment;
revoke all on function public.v2_1_list_center_settings_pre_final_business_alignment(text)
  from public, anon, authenticated, service_role;

create function public.v2_1_list_center_settings(p_center_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_result jsonb;
begin
  v_result := public.v2_1_list_center_settings_pre_final_business_alignment(p_center_id);
  if coalesce(v_result->>'ok', 'false') <> 'true' then return v_result; end if;
  return pg_catalog.jsonb_set(v_result, '{center,initial_student_setup_enabled}',
    pg_catalog.to_jsonb((select profile.initial_student_setup_enabled
      from public.center_operational_profiles profile
      where profile.center_id = p_center_id)), true);
end
$function$;

alter function public.v2_1_mutate_center_settings(text,jsonb,uuid)
  rename to v2_1_mutate_center_settings_pre_final_business_alignment;
revoke all on function public.v2_1_mutate_center_settings_pre_final_business_alignment(text,jsonb,uuid)
  from public, anon, authenticated, service_role;

create function public.v2_1_mutate_center_settings(
  p_center_id text, p_command jsonb, p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_enabled boolean;
begin
  if pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', '')))
      = 'UPDATE_CENTER_PROFILE' and p_command ? 'initial_student_setup_enabled' then
    if pg_catalog.jsonb_typeof(p_command->'initial_student_setup_enabled') <> 'boolean' then
      raise exception 'v2_1_invalid_center_profile';
    end if;
    v_enabled := (p_command->>'initial_student_setup_enabled')::boolean;
  end if;
  v_result := public.v2_1_mutate_center_settings_pre_final_business_alignment(
    p_center_id, p_command, p_idempotency_key);
  if coalesce(v_result->>'ok', 'false') = 'true' and v_enabled is not null then
    update public.center_operational_profiles profile
    set initial_student_setup_enabled = v_enabled
    where profile.center_id = p_center_id
      and profile.version = (v_result->>'entity_version')::integer;
  end if;
  return v_result;
end
$function$;

alter function public.tuition_final_snapshot_contribution_teacher() owner to postgres;
alter function public.tuition_final_guard_cycle_terms() owner to postgres;
alter function public.tuition_final_cycle_json(text,uuid,jsonb) owner to postgres;
alter function public.v2_4_list_package_cycle_state(text) owner to postgres;
alter function public.v2_4_mutate_package_cycle(text,jsonb,uuid) owner to postgres;
alter function public.v2_4_internal_reconcile_student(text,text,uuid) owner to postgres;
alter function public.tbhp_internal_schedule_rows(text,uuid,text,integer,uuid) owner to postgres;
alter function public.tbhp_get_printable_document(text,uuid) owner to postgres;
alter function public.f5b_mutate_tuition_receipt(text,jsonb,uuid) owner to postgres;
alter function public.v2_1_list_center_settings(text) owner to postgres;
alter function public.v2_1_mutate_center_settings(text,jsonb,uuid) owner to postgres;

revoke all on function public.tuition_final_snapshot_contribution_teacher(),
  public.tuition_final_guard_cycle_terms(),
  public.tuition_final_cycle_json(text,uuid,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.v2_4_list_package_cycle_state(text),
  public.v2_4_mutate_package_cycle(text,jsonb,uuid),
  public.tbhp_get_printable_document(text,uuid),
  public.f5b_mutate_tuition_receipt(text,jsonb,uuid),
  public.v2_1_list_center_settings(text),
  public.v2_1_mutate_center_settings(text,jsonb,uuid)
  to authenticated, service_role;

comment on column public.center_operational_profiles.initial_student_setup_enabled is
  'Temporary UI exposure switch for legacy Student onboarding; not Student truth.';
comment on column public.center_tuition_package_cycles.opening_payment_state is
  'Explicit opening state. PAID_BEFORE_ICHESS never creates Finance or Receipt rows.';
comment on column public.center_tuition_attendance_contributions.teacher_name_snapshot is
  'Actual occurrence teacher captured with canonical attendance; never current class metadata.';
comment on function public.f5b_mutate_tuition_receipt(text,jsonb,uuid) is
  'Atomic cycle-specific full payment -> Finance -> Receipt; bounded local_source_id trigger preserved.';

commit;
