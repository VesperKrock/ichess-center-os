-- Local-forward correction for installations where 202609240003 was already
-- applied: a prepared cycle retains OPERATOR_PREPARED as its origin after it
-- activates as PROVISIONAL_UNPAID, so V2.8 must recognize that canonical path.

do $f5b_b2a_patch_prepared_provisional_origin$
declare
  v_definition text;
  v_search constant text := 'cycle.origin = ''AUTOMATIC_ROLLOVER''::text';
  v_replacement constant text :=
    'cycle.origin = ANY (ARRAY[''AUTOMATIC_ROLLOVER''::text, ''OPERATOR_PREPARED''::text])';
  v_match_count integer;
  v_replacement_count integer;
begin
  select pg_catalog.pg_get_viewdef(
    'public.center_attendance_operational_reminder_projection'::regclass, true
  ) into v_definition;

  v_match_count := (
    pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_search, ''))
  ) / pg_catalog.length(v_search);
  if v_match_count = 1 then
    v_definition := pg_catalog.replace(v_definition, v_search, v_replacement);
    execute 'create or replace view public.center_attendance_operational_reminder_projection '
      || 'with (security_invoker = false) as ' || v_definition;
    return;
  end if;

  v_replacement_count := (
    pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_replacement, ''))
  ) / pg_catalog.length(v_replacement);
  if v_match_count <> 0 or v_replacement_count <> 1 then
    raise exception 'f5b_b2a_prepared_provisional_origin_drift:%', v_match_count;
  end if;
end
$f5b_b2a_patch_prepared_provisional_origin$;

comment on view public.center_attendance_operational_reminder_projection is
  'Canonical V2.8 operational reminders; F5B-B2A recognizes unpaid provisional cycles from automatic and operator-prepared rollover paths.';
