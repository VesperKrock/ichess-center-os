-- F5B-B2A: a newly activated unpaid provisional cycle is already due at N.
-- Keep the established V2.8 attendance reminder projection as the sole
-- PAYMENT_CHECK_DUE authority, but make it visible before the first session
-- of the new cycle is attended.

do $f5b_b2a_patch_provisional_due_at_activation$
declare
  v_definition text;
  v_patched text;
  v_search constant text := 'AND cycle.used_sessions >= 1';
  v_replacement constant text := 'AND cycle.used_sessions >= 0';
  v_origin_search constant text := 'cycle.origin = ''AUTOMATIC_ROLLOVER''::text';
  v_origin_replacement constant text :=
    'cycle.origin = ANY (ARRAY[''AUTOMATIC_ROLLOVER''::text, ''OPERATOR_PREPARED''::text])';
  v_match_count integer;
  v_replacement_count integer;
  v_changed boolean := false;
begin
  select pg_catalog.pg_get_viewdef(
    'public.center_attendance_operational_reminder_projection'::regclass, true
  ) into v_definition;

  v_match_count := (
    pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_search, ''))
  ) / pg_catalog.length(v_search);

  if v_match_count = 1 then
    v_definition := pg_catalog.replace(v_definition, v_search, v_replacement);
    v_changed := true;
  else
    v_replacement_count := (
      pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_replacement, ''))
    ) / pg_catalog.length(v_replacement);
  end if;

  if v_match_count <> 1 and (v_match_count <> 0 or v_replacement_count <> 1) then
    raise exception 'f5b_b2a_provisional_due_projection_drift:%', v_match_count;
  end if;

  v_match_count := (
    pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_origin_search, ''))
  ) / pg_catalog.length(v_origin_search);
  if v_match_count = 1 then
    v_definition := pg_catalog.replace(v_definition, v_origin_search, v_origin_replacement);
    v_changed := true;
  else
    v_replacement_count := (
      pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_origin_replacement, ''))
    ) / pg_catalog.length(v_origin_replacement);
  end if;
  if v_match_count <> 1 and (v_match_count <> 0 or v_replacement_count <> 1) then
    raise exception 'f5b_b2a_provisional_due_origin_projection_drift:%', v_match_count;
  end if;

  if v_changed then
    v_patched := v_definition;
    execute 'create or replace view public.center_attendance_operational_reminder_projection '
      || 'with (security_invoker = false) as ' || v_patched;
  end if;
end
$f5b_b2a_patch_provisional_due_at_activation$;

comment on view public.center_attendance_operational_reminder_projection is
  'Canonical V2.8 operational reminders; F5B-B2A surfaces unpaid provisional Tuition immediately at activation.';
