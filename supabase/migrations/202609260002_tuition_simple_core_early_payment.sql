begin;

-- N-2 is a reminder, never a permission gate. Keep every existing package,
-- version, student, and tuition-period integrity check in the canonical cycle
-- command; remove only the remaining-session threshold from PREPARE_NEXT_CYCLE.
do $tuition_simple_early_payment$
declare
  v_definition text;
  v_search constant text :=
    'if v_remaining is null or v_remaining > 2 then raise exception ''v2_4_prepare_not_due''; end if;';
  v_replacement constant text :=
    'if v_remaining is null then raise exception ''v2_4_prepare_not_due''; end if;';
begin
  select pg_catalog.pg_get_functiondef(
    'public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(v_definition, v_search) = 0 then
    raise exception 'tuition_simple_early_payment_contract_drift';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_search, v_replacement);
  execute v_definition;
end
$tuition_simple_early_payment$;

comment on function public.v2_4_mutate_package_cycle(text,jsonb,uuid) is
  'Canonical package-cycle mutation; PREPARE_NEXT_CYCLE is allowed before N-2 so early payment can target the defined next cycle.';

commit;
