begin;

-- START_CYCLE may carry an explicitly entered opening price/discount from the
-- Tuition record. A later package selection before first attendance must use
-- the newly selected catalog package as one coherent set of terms instead of
-- combining its N with the previous package's opening price.
do $tuition_final_initial_package_change_terms$
declare
  v_definition text;
  v_search constant text := 'if new.cycle_number = 1 then';
  v_replacement constant text := 'if new.cycle_number = 1 and tg_op = ''INSERT'' then';
begin
  select pg_catalog.pg_get_functiondef(
    'public.tuition_final_guard_cycle_terms()'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(v_definition, v_search) = 0 then
    raise exception 'tuition_final_initial_package_terms_contract_drift';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_search, v_replacement);
  execute v_definition;
end
$tuition_final_initial_package_change_terms$;

alter function public.tuition_final_guard_cycle_terms() owner to postgres;
revoke all on function public.tuition_final_guard_cycle_terms()
  from public, anon, authenticated, service_role;

comment on function public.tuition_final_guard_cycle_terms() is
  'Captures coherent selected-package terms and freezes them after legacy opening progress or the first countable iChess attendance.';

commit;
