-- F1: actual PRESENT may be outside the frozen recurring occurrence roster.
-- Patch only the two existing admission expressions. N3/A4 makeup, UNMARK,
-- identity, timing, locks, versions, Audit, ACLs and reconciliation stay intact.
begin;

do $patch$
declare
  v_writer text;
  v_guard text;
  v_old text;
  v_new text;
begin
  v_writer := pg_catalog.pg_get_functiondef(
    'public.v2_9_mutate_attendance_batch(text,jsonb,uuid)'::pg_catalog.regprocedure);
  v_guard := pg_catalog.pg_get_functiondef(
    'public.v2_3_internal_guard_occurrence_attendance()'::pg_catalog.regprocedure);

  v_old := $old$(v_action='SET' and v_status='makeup' and public.n3_internal_admit_booked_makeup(v_center,v_student,v_schedule,v_date,v_target))$old$;
  v_new := $new$(v_action='SET' and v_status='present')
         or (v_action='SET' and v_status='makeup' and public.n3_internal_admit_booked_makeup(v_center,v_student,v_schedule,v_date,v_target))$new$;
  if (pg_catalog.length(v_writer) - pg_catalog.length(pg_catalog.replace(v_writer,v_old,'')))
       <> pg_catalog.length(v_old)
     or pg_catalog.strpos(v_writer,v_new)>0 then
    raise exception 'f1_writer_admission_contract_mismatch';
  end if;
  v_writer := pg_catalog.replace(v_writer,v_old,v_new);

  v_old := $old$  if not (v_student_id = any(v_occurrence.roster_student_ids)) and not (
    new.payload->>'attendanceStatus'='makeup' and public.n3_internal_admit_booked_makeup(
      new.center_id,v_student_id,v_schedule_id,v_date,new.payload->>'makeupForAttendanceLocalId')) then$old$;
  v_new := $new$  if not (v_student_id = any(v_occurrence.roster_student_ids)) and not (
    new.payload->>'attendanceStatus'='present'
    or (new.payload->>'attendanceStatus'='makeup' and public.n3_internal_admit_booked_makeup(
      new.center_id,v_student_id,v_schedule_id,v_date,new.payload->>'makeupForAttendanceLocalId'))) then$new$;
  if (pg_catalog.length(v_guard) - pg_catalog.length(pg_catalog.replace(v_guard,v_old,'')))
       <> pg_catalog.length(v_old)
     or pg_catalog.strpos(v_guard,v_new)>0 then
    raise exception 'f1_guard_admission_contract_mismatch';
  end if;
  v_guard := pg_catalog.replace(v_guard,v_old,v_new);

  execute v_writer;
  execute v_guard;
end $patch$;

commit;
