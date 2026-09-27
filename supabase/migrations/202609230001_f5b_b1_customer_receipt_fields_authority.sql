begin;

-- F5B-B1 keeps the two optional future-receipt facts on the canonical
-- Customer/Contact aggregate. They are deliberately separate from CRM
-- safe_state, contact-method encryption, Student, Tuition and Finance.
do $f5b_b1_preflight$
begin
  if pg_catalog.to_regclass('public.crm_contact') is null
     or pg_catalog.to_regprocedure('public.c5_3_list_crm_shared_truth(text)') is null
     or pg_catalog.to_regprocedure('public.c5_3_mutate_crm_shared_truth(text,jsonb,uuid)') is null then
    raise exception 'F5B_B1_CANONICAL_CRM_PREREQUISITE_MISSING';
  end if;
end;
$f5b_b1_preflight$;

alter table public.crm_contact
  add column receipt_address text,
  add column cccd text,
  add constraint crm_contact_receipt_address_check check (
    receipt_address is null
    or (
      receipt_address = pg_catalog.btrim(receipt_address)
      and pg_catalog.length(receipt_address) between 1 and 500
      and receipt_address !~ '[[:cntrl:]]'
    )
  ),
  add constraint crm_contact_cccd_check check (
    cccd is null
    or (
      cccd = pg_catalog.btrim(cccd)
      and pg_catalog.length(cccd) between 1 and 64
      and cccd !~ '[[:cntrl:]]'
    )
  );

comment on column public.crm_contact.receipt_address is
  'Optional Customer receipt/permanent address; distinct from CRM safe_location_area.';
comment on column public.crm_contact.cccd is
  'Optional Customer CCCD value stored as text so leading zeroes are preserved.';

-- Preserve the established read access decision and enrich only its existing
-- exact-center projection with the two canonical Contact columns.
alter function public.c5_3_list_crm_shared_truth(text)
  rename to c5_3_list_crm_shared_truth_pre_f5b_b1;
alter function public.c5_3_list_crm_shared_truth_pre_f5b_b1(text) owner to postgres;
revoke all on function public.c5_3_list_crm_shared_truth_pre_f5b_b1(text)
  from public, anon, authenticated, service_role;

create function public.c5_3_list_crm_shared_truth(p_center_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_records jsonb := '[]'::jsonb;
  v_record jsonb;
  v_contact_id uuid;
  v_receipt_address text;
  v_cccd text;
begin
  v_result := public.c5_3_list_crm_shared_truth_pre_f5b_b1(p_center_id);
  if coalesce(v_result->>'ok', 'false') <> 'true'
     or pg_catalog.jsonb_typeof(v_result->'records') <> 'array' then
    return v_result;
  end if;

  for v_record in
    select item.value
    from pg_catalog.jsonb_array_elements(v_result->'records') with ordinality as item(value, position)
    order by item.position
  loop
    v_contact_id := (v_record->>'canonicalContactId')::uuid;
    v_receipt_address := null;
    v_cccd := null;

    select c.receipt_address, c.cccd
      into v_receipt_address, v_cccd
    from public.crm_contact c
    where c.center_id = pg_catalog.btrim(coalesce(p_center_id, ''))
      and c.crm_contact_id = v_contact_id;

    v_records := v_records || pg_catalog.jsonb_build_array(
      v_record || pg_catalog.jsonb_build_object(
        'receiptAddress', coalesce(v_receipt_address, ''),
        'cccd', coalesce(v_cccd, '')
      )
    );
  end loop;

  return pg_catalog.jsonb_set(v_result, '{records}', v_records, true);
exception
  when others then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'outcome_code', 'CRM_SHARED_TRUTH_READ_FAILED'
    );
end;
$function$;

alter function public.c5_3_list_crm_shared_truth(text) owner to postgres;
revoke all on function public.c5_3_list_crm_shared_truth(text)
  from public, anon, service_role;
grant execute on function public.c5_3_list_crm_shared_truth(text)
  to authenticated;

comment on function public.c5_3_list_crm_shared_truth(text) is
  'Existing C5.3 exact-center projection enriched with optional canonical Customer receipt address and CCCD.';

-- Wrap the established command authority instead of duplicating its Case
-- state machine. The inner command and Contact update share one transaction;
-- any Contact-version or validation failure rolls the inner mutation back.
alter function public.c5_3_mutate_crm_shared_truth(text, jsonb, uuid)
  rename to c5_3_mutate_crm_shared_truth_pre_f5b_b1;
alter function public.c5_3_mutate_crm_shared_truth_pre_f5b_b1(text, jsonb, uuid) owner to postgres;
revoke all on function public.c5_3_mutate_crm_shared_truth_pre_f5b_b1(text, jsonb, uuid)
  from public, anon, authenticated, service_role;

create function public.c5_3_mutate_crm_shared_truth(
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
  v_actor_user_id uuid := auth.uid();
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_operation text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', '')));
  v_receipt jsonb;
  v_receipt_address text;
  v_cccd text;
  v_expected_contact_version integer;
  v_result jsonb;
  v_case_id uuid;
  v_contact public.crm_contact%rowtype;
  v_previous_version integer;
  v_correlation_id uuid;
  v_changed boolean := false;
  v_failure text;
begin
  if p_command ? 'contact_receipt' then
    if v_operation not in ('CREATE_LEAD', 'SAVE_CASE') then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
    end if;

    v_receipt := p_command->'contact_receipt';
    if pg_catalog.jsonb_typeof(v_receipt) <> 'object'
       or exists (
         select 1
         from pg_catalog.jsonb_object_keys(v_receipt) as receipt_key(key)
         where receipt_key.key not in ('receipt_address', 'cccd')
       )
       or (v_receipt ? 'receipt_address' and pg_catalog.jsonb_typeof(v_receipt->'receipt_address') <> 'string')
       or (v_receipt ? 'cccd' and pg_catalog.jsonb_typeof(v_receipt->'cccd') <> 'string') then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;

    v_receipt_address := nullif(pg_catalog.btrim(coalesce(v_receipt->>'receipt_address', '')), '');
    v_cccd := nullif(pg_catalog.btrim(coalesce(v_receipt->>'cccd', '')), '');
    if (v_receipt_address is not null and (
          pg_catalog.length(v_receipt_address) > 500
          or v_receipt_address ~ '[[:cntrl:]]'
       ))
       or (v_cccd is not null and (
          pg_catalog.length(v_cccd) > 64
          or v_cccd ~ '[[:cntrl:]]'
       )) then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;

    if v_operation = 'SAVE_CASE' then
      if coalesce(p_command->>'expected_contact_version', '') !~ '^[1-9][0-9]{0,9}$' then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;
      v_expected_contact_version := (p_command->>'expected_contact_version')::integer;
    end if;
  end if;

  begin
    v_result := public.c5_3_mutate_crm_shared_truth_pre_f5b_b1(
      v_center_id,
      p_command,
      p_idempotency_key
    );
    if coalesce(v_result->>'ok', 'false') <> 'true'
       or not (p_command ? 'contact_receipt') then
      return v_result;
    end if;

    if coalesce(v_result->>'case_id', '') !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
      raise exception 'F5B_B1_ABORT:INVALID_SERVER_RESULT';
    end if;
    v_case_id := (v_result->>'case_id')::uuid;

    select contact.* into v_contact
    from public.consultation_case crm_case
    join public.crm_contact contact
      on contact.center_id = crm_case.center_id
     and contact.crm_contact_id = crm_case.primary_contact_id
    where crm_case.center_id = v_center_id
      and crm_case.consultation_case_id = v_case_id
    for update of contact;
    if not found or v_contact.contact_status = 'ARCHIVED' then
      raise exception 'F5B_B1_ABORT:RESOURCE_NOT_FOUND_OR_DENIED';
    end if;

    -- Exact command replay must remain a no-op even if a later command has
    -- since advanced the Contact version.
    if coalesce(v_result->>'replayed', 'false') = 'true' then
      return v_result || pg_catalog.jsonb_build_object(
        'contact_version', v_contact.contact_version,
        'contact_receipt_changed', false
      );
    end if;

    -- CREATE_LEAD may resolve an already-canonical Contact through the
    -- established ingress deduplication. Blank optional fields on a new Case
    -- must not erase receipt facts already owned by that Contact.
    if v_operation = 'CREATE_LEAD' then
      v_receipt_address := coalesce(v_receipt_address, v_contact.receipt_address);
      v_cccd := coalesce(v_cccd, v_contact.cccd);
    end if;

    if v_operation = 'SAVE_CASE'
       and v_contact.contact_version <> v_expected_contact_version then
      raise exception 'F5B_B1_ABORT:CONTACT_VERSION_STALE';
    end if;

    if v_contact.receipt_address is distinct from v_receipt_address
       or v_contact.cccd is distinct from v_cccd then
      v_previous_version := v_contact.contact_version;
      update public.crm_contact contact set
        receipt_address = v_receipt_address,
        cccd = v_cccd,
        contact_version = contact.contact_version + 1
      where contact.center_id = v_center_id
        and contact.crm_contact_id = v_contact.crm_contact_id
      returning contact.* into v_contact;

      v_correlation_id := pg_catalog.gen_random_uuid();
      perform public.f23_3e_p1d_internal_append_audit_outbox(
        v_center_id,
        'crm.contact.receipt_fields_updated',
        v_actor_user_id,
        'crm_contact',
        v_contact.crm_contact_id,
        null,
        v_previous_version,
        v_contact.contact_version,
        v_contact.contact_status,
        'customer-receipt-fields-updated',
        'CONTACT_RECEIPT_FIELDS_UPDATED',
        v_correlation_id
      );
      v_changed := true;
    end if;

    return v_result || pg_catalog.jsonb_build_object(
      'contact_version', v_contact.contact_version,
      'contact_receipt_changed', v_changed
    );
  exception
    when others then
      v_failure := case
        when sqlerrm like 'F5B_B1_ABORT:%'
          then pg_catalog.replace(sqlerrm, 'F5B_B1_ABORT:', '')
        else 'CRM_COMMAND_FAILED'
      end;
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', v_failure);
  end;
end;
$function$;

alter function public.c5_3_mutate_crm_shared_truth(text, jsonb, uuid) owner to postgres;
revoke all on function public.c5_3_mutate_crm_shared_truth(text, jsonb, uuid)
  from public, anon, service_role;
grant execute on function public.c5_3_mutate_crm_shared_truth(text, jsonb, uuid)
  to authenticated;

comment on function public.c5_3_mutate_crm_shared_truth(text, jsonb, uuid) is
  'Existing C5.3 command authority plus atomic optional canonical Customer receipt address/CCCD persistence.';

commit;
