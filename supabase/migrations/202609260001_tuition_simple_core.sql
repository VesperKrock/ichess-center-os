begin;

-- TUITION SIMPLE CORE
--
-- TBHP is a read-only projection of the currently authoritative learning
-- package.  Only applied Attendance contributions that have already occurred
-- may populate date/teacher cells.  Unknown historical rows and every future
-- slot stay blank.
create or replace function public.tbhp_internal_schedule_rows(
  p_center_id text,
  p_cycle_id uuid,
  p_student_local_id text,
  p_total_sessions integer,
  p_predecessor_cycle_id uuid
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
  ),
  actual_base as (
    select contribution.occurrence_date as session_date,
      coalesce(
        nullif(pg_catalog.btrim(attendance.payload->>'teacherName'), ''),
        nullif(pg_catalog.btrim(report.payload->>'teacherName'), ''),
        nullif(pg_catalog.btrim(schedule.payload->>'teacherName'), ''),
        nullif(pg_catalog.btrim(class_session.payload->>'instructorName'), ''),
        ''
      ) as teacher_name,
      contribution.schedule_session_local_id,
      contribution.id
    from public.center_tuition_attendance_contributions contribution
    left join public.center_cloud_entities attendance
      on attendance.center_id = contribution.center_id
     and attendance.entity_type = 'attendance_record'
     and attendance.local_id = contribution.attendance_entity_local_id
     and attendance.deleted_at is null
    left join public.center_cloud_entities schedule
      on schedule.center_id = contribution.center_id
     and schedule.entity_type = 'schedule_session'
     and schedule.local_id = contribution.schedule_session_local_id
     and schedule.deleted_at is null
    left join public.center_cloud_entities class_session
      on class_session.center_id = schedule.center_id
     and class_session.entity_type = 'class_session'
     and class_session.local_id = schedule.payload->>'classSessionId'
     and class_session.deleted_at is null
    left join lateral (
      select entity.payload
      from public.center_cloud_entities entity
      where entity.center_id = contribution.center_id
        and entity.entity_type = 'session_report'
        and entity.deleted_at is null
        and coalesce(entity.payload->>'scheduleSessionId', entity.payload->>'sessionId')
          = contribution.schedule_session_local_id
        and coalesce(entity.payload->>'date', entity.payload->>'sessionDate')
          = contribution.occurrence_date::text
      order by entity.entity_version desc
      limit 1
    ) report on true
    where contribution.center_id = p_center_id
      and contribution.cycle_id = p_cycle_id
      and contribution.student_local_id = p_student_local_id
      and contribution.ended_at is null
      and contribution.allocation_state = 'APPLIED'
      and contribution.contribution_units = 1
      and contribution.occurrence_date <= current_date
  ),
  actual as (
    select cycle_baseline.used_sessions + pg_catalog.row_number() over (
        order by actual_base.session_date, actual_base.schedule_session_local_id, actual_base.id
      )::integer as ordinal,
      actual_base.session_date,
      actual_base.teacher_name
    from actual_base
    cross join cycle_baseline
  ),
  completed as (
    select series.ordinal,
      actual.session_date,
      coalesce(actual.teacher_name, '') as teacher_name,
      case when actual.ordinal is null then 'UNRESOLVED' else 'ACTUAL' end as source
    from pg_catalog.generate_series(1, greatest(coalesce(p_total_sessions, 0), 0)) series(ordinal)
    left join actual on actual.ordinal = series.ordinal
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'sessionNumber', completed.ordinal,
    'date', completed.session_date,
    'teacherName', completed.teacher_name,
    'source', completed.source
  ) order by completed.ordinal), '[]'::jsonb)
  from completed
$function$;

-- Read-only TBHP projection.  It has no INSERT/UPDATE side effect and is not
-- gated by N-2, payment state, Finance state, or previous document history.
create or replace function public.tbhp_get_printable_document(
  p_center_id text,
  p_cycle_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_membership public.center_members;
  v_cycle public.center_tuition_package_cycles;
  v_package public.center_tuition_package_catalog;
  v_profile public.center_operational_profiles;
  v_center public.centers;
  v_student public.center_cloud_entities;
  v_tuition public.center_cloud_entities;
  v_projection public.center_tuition_package_cycle_projection;
  v_schedule_rows jsonb;
  v_material bigint := 0;
  v_base bigint := 0;
  v_discount bigint := 0;
  v_discount_type text := 'none';
  v_due_date text := '';
  v_registration text;
  v_registration_label text;
  v_transfer_content text;
  v_issued_at timestamptz := pg_catalog.clock_timestamp();
  v_snapshot jsonb;
begin
  if v_actor is null then raise exception 'tbhp_not_authenticated'; end if;
  if p_cycle_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_FOUND');
  end if;
  select * into v_membership
  from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'tbhp_center_access_denied'; end if;

  select * into v_cycle
  from public.center_tuition_package_cycles cycle
  where cycle.center_id = p_center_id and cycle.id = p_cycle_id;
  if v_cycle.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_FOUND');
  end if;
  if v_cycle.package_catalog_id is null
     or v_cycle.total_sessions_snapshot is null
     or v_cycle.total_sessions_snapshot < 1
     or v_cycle.price_snapshot is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'PACKAGE_NOT_DEFINED');
  end if;

  select * into v_student from public.center_cloud_entities entity
  where entity.center_id = p_center_id and entity.entity_type = 'student'
    and entity.local_id = v_cycle.student_local_id and entity.deleted_at is null;
  select * into v_tuition from public.center_cloud_entities entity
  where entity.center_id = p_center_id and entity.entity_type = 'tuition_record_package'
    and entity.local_id = v_cycle.tuition_local_id and entity.deleted_at is null;
  select * into v_profile from public.center_operational_profiles profile
  where profile.center_id = p_center_id;
  select * into v_center from public.centers center_row where center_row.id = p_center_id;
  select * into v_package from public.center_tuition_package_catalog package
  where package.center_id = p_center_id and package.id = v_cycle.package_catalog_id;
  select * into v_projection from public.center_tuition_package_cycle_projection projection
  where projection.center_id = p_center_id and projection.id = v_cycle.id;
  if v_student.id is null or v_tuition.id is null or v_profile.center_id is null
     or v_package.id is null or v_projection.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'AUTHORITATIVE_SOURCE_MISSING');
  end if;

  v_registration := case when v_cycle.cycle_number = 1 then 'NEW_REGISTRATION' else 'RENEWAL' end;
  v_registration_label := case when v_cycle.cycle_number = 1 then 'Đăng ký mới' else 'Tái đăng ký' end;
  if v_registration = 'NEW_REGISTRATION' then
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
  end if;
  if coalesce(v_tuition.payload->>'dueDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_due_date := v_tuition.payload->>'dueDate';
  end if;
  v_schedule_rows := public.tbhp_internal_schedule_rows(
    p_center_id, v_cycle.id, v_cycle.student_local_id,
    v_cycle.total_sessions_snapshot, v_cycle.predecessor_cycle_id
  );
  v_transfer_content := pg_catalog.left(pg_catalog.regexp_replace(
    pg_catalog.btrim(coalesce(v_student.payload->>'fullName', 'Hoc vien'))
      || ' HP K' || v_cycle.cycle_number::text,
    '[^[:alnum:] ]', '', 'g'
  ), 120);
  v_snapshot := pg_catalog.jsonb_build_object(
    'documentType', 'TUITION_NOTICE',
    'noticeId', v_cycle.id,
    'issuedAt', v_issued_at,
    'registration', pg_catalog.jsonb_build_object(
      'code', v_registration, 'label', v_registration_label
    ),
    'center', pg_catalog.jsonb_build_object(
      'id', p_center_id,
      'name', coalesce(v_profile.display_name, v_center.name, p_center_id),
      'address', v_profile.address,
      'phone', v_profile.phone,
      'website', 'www.ichess.edu.vn'
    ),
    'student', pg_catalog.jsonb_build_object(
      'id', v_cycle.student_local_id,
      'name', pg_catalog.btrim(coalesce(v_student.payload->>'fullName', ''))
    ),
    'tuition', pg_catalog.jsonb_build_object(
      'tuitionLocalId', v_cycle.tuition_local_id,
      'targetCycleId', v_cycle.id,
      'targetPeriodId', v_cycle.payment_period_id,
      'termNumber', v_cycle.cycle_number,
      'packageCatalogId', v_cycle.package_catalog_id,
      'packageName', v_cycle.package_name_snapshot,
      'programName', coalesce(v_cycle.program_name_snapshot, ''),
      'learningForm', v_registration_label,
      'totalSessions', v_cycle.total_sessions_snapshot,
      'maxCompletionWeeks', v_package.max_completion_weeks
    ),
    'currentProgress', pg_catalog.jsonb_build_object(
      'usedSessions', v_projection.used_sessions,
      'totalSessions', v_cycle.total_sessions_snapshot
    ),
    'paymentWindow', pg_catalog.jsonb_build_object(
      'from', current_date,
      'to', nullif(v_due_date, '')
    ),
    'money', pg_catalog.jsonb_build_object(
      'tuitionAmount', v_base,
      'discountAmount', v_discount,
      'materialFee', v_material,
      'totalAmount', v_base - v_discount + v_material,
      'discountExplanation', case when v_discount > 0 then v_discount_type else '' end
    ),
    'notes', case when v_package.max_completion_weeks is null then '[]'::jsonb else
      pg_catalog.jsonb_build_array(
        'Thời gian tối đa hoàn thành khóa: ' || v_package.max_completion_weeks || ' tuần.'
      ) end,
    'transfer', pg_catalog.jsonb_build_object(
      'accountNumber', '442228866',
      'beneficiary', 'CÔNG TY TNHH ICHESS VIET NAM',
      'bank', 'Ngân hàng TMCP Á Châu (ACB)',
      'content', v_transfer_content
    ),
    'scheduleRows', v_schedule_rows
  );
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'PRINTABLE_DOCUMENT',
    'center_id', p_center_id,
    'document', pg_catalog.jsonb_build_object(
      'id', v_cycle.id,
      'student_id', v_cycle.student_local_id,
      'tuition_local_id', v_cycle.tuition_local_id,
      'target_cycle_id', v_cycle.id,
      'target_period_id', v_cycle.payment_period_id,
      'target_term_number', v_cycle.cycle_number,
      'total_sessions', v_cycle.total_sessions_snapshot,
      'snapshot', v_snapshot,
      'version', v_cycle.version,
      'issued_at', v_issued_at
    )
  );
end
$function$;

-- The old browser-facing local id embedded tuition + period ids and could be
-- longer than Finance's protected 200-character contract.  source_payment_id
-- remains the idempotency/business link; local_source_id becomes a bounded,
-- deterministic digest for every new canonical tuition payment.
create or replace function public.tuition_simple_core_finance_local_source()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.source_module = 'hoc-phi' and new.source_type = 'tuition-payment' then
    if pg_catalog.btrim(coalesce(new.source_payment_id, '')) = '' then
      raise exception 'tuition_payment_source_id_required';
    end if;
    new.local_source_id := 'tuition-payment:' || pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(new.source_payment_id, 'UTF8'), 'sha256'),
      'hex'
    );
  end if;
  return new;
end
$function$;

drop trigger if exists tuition_simple_core_finance_local_source_trigger
  on public.finance_transaction;
create trigger tuition_simple_core_finance_local_source_trigger
before insert on public.finance_transaction
for each row execute function public.tuition_simple_core_finance_local_source();

alter function public.tbhp_internal_schedule_rows(text,uuid,text,integer,uuid) owner to postgres;
alter function public.tbhp_get_printable_document(text,uuid) owner to postgres;
alter function public.tuition_simple_core_finance_local_source() owner to postgres;
revoke all on function public.tbhp_get_printable_document(text,uuid) from public, anon;
grant execute on function public.tbhp_get_printable_document(text,uuid) to authenticated;

comment on function public.tbhp_get_printable_document(text,uuid) is
  'Read-only, always-available TBHP projection for a defined learning package; actual Attendance rows only.';
comment on function public.tuition_simple_core_finance_local_source() is
  'Canonical bounded Finance local_source_id for atomic tuition Payment -> Finance -> Receipt writes.';

commit;
