-- Local-forward correction for 202609240001: GREATEST is an SQL expression
-- and must not be schema-qualified inside the inherited V2.4 reconciler.

do $f5b_b2a_patch_reconcile_greatest$
declare
  v_signature regprocedure :=
    'public.v2_4_internal_reconcile_student(text,text,uuid)'::regprocedure;
  v_definition text;
  v_patched text;
  v_search constant text :=
    'v_max_cycle_number := pg_catalog.greatest(v_max_cycle_number, v_cycle.cycle_number);';
  v_replacement constant text :=
    'v_max_cycle_number := greatest(v_max_cycle_number, v_cycle.cycle_number);';
  v_match_count integer;
  v_replacement_count integer;
begin
  select pg_catalog.pg_get_functiondef(v_signature) into v_definition;
  v_match_count := (
    pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_search, ''))
  ) / pg_catalog.length(v_search);
  if v_match_count = 1 then
    v_patched := pg_catalog.replace(v_definition, v_search, v_replacement);
    execute v_patched;
    return;
  end if;
  v_replacement_count := (
    pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_replacement, ''))
  ) / pg_catalog.length(v_replacement);
  if v_match_count <> 0 or v_replacement_count <> 1 then
    raise exception 'f5b_b2a_reconcile_greatest_drift:%', v_match_count;
  end if;
end
$f5b_b2a_patch_reconcile_greatest$;

alter function public.v2_4_internal_reconcile_student(text,text,uuid) owner to postgres;
