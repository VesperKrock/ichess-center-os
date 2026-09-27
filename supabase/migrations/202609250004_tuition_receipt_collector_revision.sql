begin;

-- Extend the already-audited Receipt revision path by one output field.
-- Historical revision 1 remains untouched; a correction needs a reason and
-- produces revision N+1 under the original Receipt number.
do $collector_revision$
declare
  v_definition text;
  v_keys_old constant text := $keys$where key not in ('centerName','centerAddress','centerPhone','payerName','email','receiptAddress','cccd')$keys$;
  v_keys_new constant text := $keys$where key not in ('centerName','centerAddress','centerPhone','payerName','email','receiptAddress','cccd','collectorName')$keys$;
  v_insert_before constant text := $line$    if pg_catalog.length(v_snapshot#>>'{center,name}') not between 1 and 120$line$;
  v_check_old constant text := $line$or pg_catalog.length(v_snapshot#>>'{customer,cccd}') > 40 then$line$;
begin
  select pg_catalog.pg_get_functiondef(
    'public.f5b_mutate_tuition_receipt(text,jsonb,uuid)'::regprocedure
  ) into v_definition;
  if pg_catalog.strpos(v_definition, v_keys_old) = 0
     or pg_catalog.strpos(v_definition, v_insert_before) = 0
     or pg_catalog.strpos(v_definition, v_check_old) = 0
     or pg_catalog.strpos(v_definition, v_keys_new) > 0 then
    raise exception 'tbc_collector_revision_contract_drift';
  end if;
  v_definition := pg_catalog.replace(v_definition, v_keys_old, v_keys_new);
  v_definition := pg_catalog.replace(v_definition, v_insert_before,
    $revision$    if v_corrections ? 'collectorName' then
      v_snapshot := pg_catalog.jsonb_set(v_snapshot, '{payment,collectorName}',
        pg_catalog.to_jsonb(pg_catalog.btrim(v_corrections->>'collectorName')), true);
    end if;
    $revision$ || v_insert_before);
  v_definition := pg_catalog.replace(v_definition, v_check_old,
    $line$or pg_catalog.length(v_snapshot#>>'{customer,cccd}') > 40
       or pg_catalog.length(v_snapshot#>>'{payment,collectorName}') not between 1 and 120 then$line$);
  execute v_definition;
end
$collector_revision$;

commit;
