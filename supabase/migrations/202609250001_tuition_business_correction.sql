-- Tuition business correction (forward-only).
--
-- TBHP is an immutable renewal notice created before payment and never writes
-- Finance.  A Receipt is created only in the same transaction as a canonical
-- posted Tuition income transaction.  Historical pre-payment receipt rows are
-- retained for audit, but invalidated and excluded from the product read model.

do $tbc_prerequisites$
begin
  if pg_catalog.to_regclass('public.center_tuition_receipts') is null
     or pg_catalog.to_regclass('public.center_tuition_package_cycles') is null
     or pg_catalog.to_regclass('public.center_tuition_package_catalog') is null
     or pg_catalog.to_regclass('public.finance_transaction') is null
     or pg_catalog.to_regclass('public.transaction_attachments') is null
     or pg_catalog.to_regprocedure('public.f5b_list_tuition_receipts(text)') is null
     or pg_catalog.to_regprocedure('public.f5b_mutate_tuition_receipt(text,jsonb,uuid)') is null
     or pg_catalog.to_regprocedure('public.v2_1_list_center_settings(text)') is null
     or pg_catalog.to_regprocedure('public.v2_1_mutate_center_settings(text,jsonb,uuid)') is null then
    raise exception 'tuition_business_correction_prerequisites_missing';
  end if;
end
$tbc_prerequisites$;

-- The replacement PL/pgSQL bodies are declared before the additive columns
-- below so the old RPC names can be retired once. They are first callable only
-- after this migration completes and all referenced schema is present.
set check_function_bodies = off;

create function public.tbc_internal_default_receipt_prefix(p_name text, p_center_id text)
returns text
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_spaced text;
  v_prefix text;
begin
  v_spaced := pg_catalog.regexp_replace(
    pg_catalog.btrim(coalesce(p_name, '')),
    '([a-z0-9])([A-Z])',
    '\1 \2',
    'g'
  );
  select pg_catalog.left(
    pg_catalog.string_agg(pg_catalog.upper(pg_catalog.left(token, 1)), '' order by ordinal),
    6
  ) into v_prefix
  from pg_catalog.unnest(pg_catalog.regexp_split_to_array(v_spaced, '[^[:alnum:]]+'))
    with ordinality as part(token, ordinal)
  where token <> '';
  v_prefix := pg_catalog.regexp_replace(coalesce(v_prefix, ''), '[^A-Z0-9]', '', 'g');
  if pg_catalog.length(v_prefix) < 2 then
    v_prefix := pg_catalog.left(pg_catalog.upper(pg_catalog.regexp_replace(
      coalesce(nullif(v_spaced, ''), p_center_id, 'CT'), '[^A-Za-z0-9]', '', 'g'
    )), 2);
  end if;
  return pg_catalog.rpad(pg_catalog.left(coalesce(nullif(v_prefix, ''), 'CT'), 6), 2, 'X');
end
$function$;

-- The product read model contains issued/voided receipts only. The latest
-- append-only revision is the default reprint snapshot.
alter function public.f5b_list_tuition_receipts(text)
  rename to f5b_list_tuition_receipts_pre_tuition_business_correction;
revoke all on function public.f5b_list_tuition_receipts_pre_tuition_business_correction(text)
  from public, anon, authenticated, service_role;

create function public.f5b_list_tuition_receipts(p_center_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_membership public.center_members;
begin
  if v_actor is null then raise exception 'f5b_not_authenticated'; end if;
  select * into v_membership
  from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'f5b_center_access_denied'; end if;
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'AUTHORITATIVE_SNAPSHOT',
    'center_id', p_center_id,
    'can_write', public.c5_4_internal_has_finance_access(p_center_id),
    'receipts', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', receipt.id,
        'receipt_number', receipt.receipt_number,
        'business_date', receipt.business_date,
        'student_id', receipt.student_local_id,
        'tuition_local_id', receipt.tuition_local_id,
        'target_cycle_id', receipt.target_cycle_id,
        'target_period_id', receipt.target_period_id,
        'target_term_number', receipt.target_term_number,
        'finance_transaction_id', receipt.finance_transaction_id,
        'customer_contact_id', receipt.customer_contact_id,
        'registration_classification', receipt.registration_classification,
        'amount_received_minor', receipt.amount_received_minor,
        'tuition_allocation_minor', receipt.tuition_allocation_minor,
        'snapshot', revision.snapshot,
        'status', case when transaction.status = 'POSTED' then 'ISSUED' else 'VOIDED' end,
        'version', receipt.version,
        'revision_number', revision.revision_number,
        'revision_reason', revision.correction_reason,
        'issued_at', receipt.issued_at,
        'updated_at', receipt.updated_at,
        'payments', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
          'transaction_id', transaction.id,
          'transaction_code', transaction.transaction_code,
          'transaction_date', transaction.transaction_date,
          'method', transaction.method,
          'amount_minor', transaction.amount_minor,
          'tuition_allocation_minor', coalesce(transaction.tuition_allocation_minor, transaction.amount_minor),
          'status', pg_catalog.lower(transaction.status),
          'version', transaction.version,
          'voided_at', transaction.voided_at
        ))
      ) order by receipt.business_date desc, receipt.daily_sequence desc, receipt.id)
      from public.center_tuition_receipts receipt
      join public.finance_transaction transaction
        on transaction.center_id = receipt.center_id
       and transaction.id = receipt.finance_transaction_id
      join lateral (
        select item.snapshot, item.revision_number, item.correction_reason
        from public.center_tuition_receipt_revisions item
        where item.center_id = receipt.center_id and item.receipt_id = receipt.id
        order by item.revision_number desc
        limit 1
      ) revision on true
      where receipt.center_id = p_center_id
        and receipt.invalidated_at is null
    ), '[]'::jsonb)
  );
end
$function$;

alter function public.f5b_mutate_tuition_receipt(text,jsonb,uuid)
  rename to f5b_mutate_tuition_receipt_pre_tuition_business_correction;
revoke all on function public.f5b_mutate_tuition_receipt_pre_tuition_business_correction(text,jsonb,uuid)
  from public, anon, authenticated, service_role;

create function public.f5b_mutate_tuition_receipt(
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
  v_actor uuid := auth.uid();
  v_membership public.center_members;
  v_existing public.center_tuition_receipt_command_results;
  v_intent bytea;
  v_operation text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', '')));
  v_finance_command jsonb;
  v_cycle public.center_tuition_package_cycles;
  v_tuition public.center_cloud_entities;
  v_student public.center_cloud_entities;
  v_center public.centers;
  v_profile public.center_operational_profiles;
  v_contact public.crm_contact;
  v_contact_id uuid;
  v_email text := '';
  v_payer_name text := '';
  v_schedule_lines jsonb := '[]'::jsonb;
  v_receipt public.center_tuition_receipts;
  v_receipt_id uuid;
  v_cycle_id uuid;
  v_expected_cycle_version bigint;
  v_expected_receipt_version bigint;
  v_transaction public.finance_transaction;
  v_transaction_id uuid;
  v_transaction_date date;
  v_category public.finance_category;
  v_attachment public.transaction_attachments;
  v_attachment_id uuid;
  v_amount bigint;
  v_prior_received bigint;
  v_prior_tuition bigint;
  v_tuition_outstanding bigint;
  v_tuition_allocation bigint;
  v_base bigint;
  v_discount bigint := 0;
  v_discount_type text := 'none';
  v_discount_value numeric := 0;
  v_material bigint;
  v_total_due bigint;
  v_registration text;
  v_registration_label text;
  v_daily_sequence integer;
  v_receipt_number text;
  v_transaction_sequence bigint;
  v_transaction_code text;
  v_snapshot jsonb;
  v_corrections jsonb;
  v_reason text;
  v_revision_number integer;
  v_response jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_actor is null then raise exception 'f5b_not_authenticated'; end if;
  if p_idempotency_key is null or p_command is null
     or pg_catalog.jsonb_typeof(p_command) <> 'object' then
    raise exception 'f5b_invalid_command';
  end if;
  select * into v_membership
  from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'f5b_center_access_denied'; end if;
  if not public.c5_4_internal_has_finance_access(p_center_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'WRITE_ROLE_REQUIRED');
  end if;

  v_intent := extensions.digest(pg_catalog.convert_to(p_command::text, 'UTF8'), 'sha256');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'f5b.receipt.command|' || p_center_id || '|' || v_actor::text || '|' || p_idempotency_key::text, 0
  ));
  select * into v_existing from public.center_tuition_receipt_command_results result
  where result.center_id = p_center_id and result.actor_user_id = v_actor
    and result.idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.intent_digest <> v_intent then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return v_existing.result_snapshot || pg_catalog.jsonb_build_object('replayed', true);
  end if;

  if v_operation = 'RECORD_PAYMENT' then
    if coalesce(p_command->>'receipt_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(p_command->>'target_cycle_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(p_command->>'expected_cycle_version', '') !~ '^[1-9][0-9]*$'
       or pg_catalog.jsonb_typeof(p_command->'finance_command') <> 'object' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_receipt_id := (p_command->>'receipt_id')::uuid;
    v_cycle_id := (p_command->>'target_cycle_id')::uuid;
    v_expected_cycle_version := (p_command->>'expected_cycle_version')::bigint;
    v_finance_command := p_command->'finance_command';
    if pg_catalog.upper(coalesce(v_finance_command->>'operation', '')) <> 'CREATE_TRANSACTION'
       or pg_catalog.upper(coalesce(v_finance_command->>'cashflow_type', '')) <> 'INCOME'
       or coalesce(v_finance_command->>'source_module', '') <> 'hoc-phi'
       or coalesce(v_finance_command->>'source_type', '') <> 'tuition-payment'
       or coalesce(v_finance_command->>'expected_version', '') <> '0'
       or coalesce(v_finance_command->>'transaction_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(v_finance_command->>'category_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(v_finance_command->>'amount_minor', '') !~ '^[1-9][0-9]*$'
       or coalesce(v_finance_command->>'transaction_date', '') !~ '^\d{4}-\d{2}-\d{2}$'
       or pg_catalog.btrim(coalesce(v_finance_command->>'source_payment_id', '')) = '' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    begin
      v_transaction_date := (v_finance_command->>'transaction_date')::date;
      v_amount := (v_finance_command->>'amount_minor')::bigint;
    exception when others then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end;
    if v_amount not between 1 and 9007199254740991
       or pg_catalog.length(pg_catalog.btrim(coalesce(v_finance_command->>'method', ''))) not between 1 and 80
       or pg_catalog.length(coalesce(v_finance_command->>'note', '')) > 4000
       or pg_catalog.length(coalesce(v_finance_command->>'source_payment_id', '')) > 240 then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'f5b.receipt.cycle|' || p_center_id || '|' || v_cycle_id::text, 0
    ));
    select * into v_cycle from public.center_tuition_package_cycles cycle
    where cycle.center_id = p_center_id and cycle.id = v_cycle_id for update;
    if v_cycle.id is null then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_FOUND');
    end if;
    if v_cycle.version <> v_expected_cycle_version then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    if v_cycle.lifecycle_status not in ('ACTIVE', 'PREPARED', 'PROVISIONAL_UNPAID')
       or v_cycle.package_catalog_id is null or v_cycle.price_snapshot is null then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_ELIGIBLE');
    end if;
    if coalesce(v_finance_command->>'source_tuition_id', '') <> v_cycle.tuition_local_id
       or coalesce(v_finance_command->>'source_student_id', '') <> v_cycle.student_local_id
       or coalesce(v_finance_command->>'source_period_id', '') <> v_cycle.payment_period_id then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_PERIOD_STALE');
    end if;
    if exists (select 1 from public.finance_transaction transaction
      where transaction.center_id = p_center_id
        and (transaction.id = (v_finance_command->>'transaction_id')::uuid
          or (transaction.source_module = 'hoc-phi'
            and transaction.source_type = 'tuition-payment'
            and transaction.source_payment_id = v_finance_command->>'source_payment_id'))) then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_PAYMENT_CONFLICT');
    end if;
    if exists (select 1 from public.finance_reconciliation reconciliation
      where reconciliation.center_id = p_center_id and reconciliation.status = 'CLOSED'
        and reconciliation.reconciliation_date >= v_transaction_date) then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CLOSED_PERIOD');
    end if;
    select * into v_category from public.finance_category category
    where category.center_id = p_center_id
      and category.id = (v_finance_command->>'category_id')::uuid for share;
    if v_category.id is null or v_category.is_archived
       or v_category.category_type not in ('INCOME', 'BOTH') then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CATEGORY_ARCHIVED');
    end if;

    select * into v_tuition from public.center_cloud_entities entity
    where entity.center_id = p_center_id and entity.entity_type = 'tuition_record_package'
      and entity.local_id = v_cycle.tuition_local_id and entity.deleted_at is null for share;
    select * into v_student from public.center_cloud_entities entity
    where entity.center_id = p_center_id and entity.entity_type = 'student'
      and entity.local_id = v_cycle.student_local_id and entity.deleted_at is null for share;
    select * into v_profile from public.center_operational_profiles profile
      where profile.center_id = p_center_id;
    select * into v_center from public.centers center_row where center_row.id = p_center_id;
    if v_tuition.id is null or v_student.id is null or v_profile.center_id is null
       or coalesce(v_tuition.payload->>'studentId', '') <> v_cycle.student_local_id then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'AUTHORITATIVE_SOURCE_MISSING');
    end if;

    v_registration := case when v_cycle.cycle_number = 1 then 'NEW_REGISTRATION' else 'RENEWAL' end;
    v_registration_label := case when v_registration = 'NEW_REGISTRATION'
      then 'Đăng ký mới' else 'Tái đăng ký' end;
    if v_registration = 'NEW_REGISTRATION' then
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
    end if;
    v_total_due := v_base - v_discount + v_material;
    select coalesce(pg_catalog.sum(transaction.amount_minor), 0),
      coalesce(pg_catalog.sum(coalesce(transaction.tuition_allocation_minor, transaction.amount_minor)), 0)
      into v_prior_received, v_prior_tuition
    from public.finance_transaction transaction
    where transaction.center_id = p_center_id and transaction.status = 'POSTED'
      and transaction.source_module = 'hoc-phi' and transaction.source_type = 'tuition-payment'
      and transaction.source_tuition_id = v_cycle.tuition_local_id
      and transaction.source_period_id = v_cycle.payment_period_id;
    if v_prior_received + v_amount > v_total_due then
      return pg_catalog.jsonb_build_object(
        'ok', false, 'outcome_code', 'TUITION_PAYMENT_EXCEEDS_OUTSTANDING',
        'outstanding_minor', greatest(v_total_due - v_prior_received, 0)
      );
    end if;
    v_tuition_outstanding := greatest(v_base - v_discount - v_prior_tuition, 0);
    v_tuition_allocation := least(v_amount, v_tuition_outstanding);

    if pg_catalog.upper(coalesce(v_finance_command->>'attachment_action', 'KEEP')) = 'BIND' then
      if coalesce(v_finance_command->>'attachment_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;
      v_attachment_id := (v_finance_command->>'attachment_id')::uuid;
      select * into v_attachment from public.transaction_attachments attachment
      where attachment.center_id = p_center_id and attachment.id = v_attachment_id
        and attachment.uploaded_by = v_actor
        and attachment.storage_bucket = 'transaction-images'
        and public.is_valid_transaction_attachment_path(attachment.center_id, attachment.storage_path)
      for update;
      if v_attachment.id is null then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'ATTACHMENT_NOT_FOUND_OR_DENIED');
      end if;
      if exists (select 1 from public.finance_transaction_attachment_binding binding
        where binding.center_id = p_center_id and binding.attachment_id = v_attachment_id
          and binding.unbound_at is null) then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'ATTACHMENT_ALREADY_BOUND');
      end if;
    elsif pg_catalog.upper(coalesce(v_finance_command->>'attachment_action', 'KEEP')) <> 'KEEP' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'c5.4.cashbook|' || p_center_id, 0
    ));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'c5.4.transaction-code|' || p_center_id || '|' || v_transaction_date::text, 0
    ));
    select coalesce(pg_catalog.max(pg_catalog.split_part(transaction.transaction_code, '-', 3)::bigint), 0) + 1
      into v_transaction_sequence
    from public.finance_transaction transaction
    where transaction.center_id = p_center_id and transaction.transaction_date = v_transaction_date;
    v_transaction_code := 'TC-' || pg_catalog.to_char(v_transaction_date, 'YYYYMMDD') || '-'
      || pg_catalog.lpad(v_transaction_sequence::text, 4, '0');
    v_transaction_id := (v_finance_command->>'transaction_id')::uuid;
    insert into public.finance_transaction(
      id, center_id, transaction_code, local_source_id, cashflow_type,
      category_id, category_name_snapshot, amount_minor, tuition_allocation_minor,
      transaction_date, method, person_name, recorded_by_name, note,
      source_module, source_type, source_payment_id, source_tuition_id,
      source_student_id, source_parent_id, source_period_id, created_by, updated_by
    ) values (
      v_transaction_id, p_center_id, v_transaction_code,
      coalesce(v_finance_command->>'local_source_id', ''), 'INCOME',
      v_category.id, v_category.name, v_amount, v_tuition_allocation,
      v_transaction_date, pg_catalog.btrim(v_finance_command->>'method'),
      coalesce(v_finance_command->>'person_name', ''),
      coalesce(v_finance_command->>'recorded_by_name', ''),
      coalesce(v_finance_command->>'note', ''),
      'hoc-phi', 'tuition-payment', v_finance_command->>'source_payment_id',
      v_cycle.tuition_local_id, v_cycle.student_local_id,
      coalesce(v_finance_command->>'source_parent_id', ''), v_cycle.payment_period_id,
      v_actor, v_actor
    ) returning * into v_transaction;
    insert into public.finance_audit_event(
      center_id, actor_user_id, action, entity_type, entity_id,
      before_state, after_state, command_idempotency_key
    ) values (
      p_center_id, v_actor, 'CREATE_TRANSACTION', 'TRANSACTION', v_transaction.id,
      null, pg_catalog.to_jsonb(v_transaction), p_idempotency_key
    );
    if v_attachment_id is not null then
      perform pg_catalog.set_config('ichess.c5_4_attachment_write', 'on', true);
      update public.transaction_attachments attachment
      set transaction_code = v_transaction.transaction_code,
          transaction_date = v_transaction.transaction_date,
          month_key = pg_catalog.to_char(v_transaction.transaction_date, 'YYYY-MM'),
          amount = v_transaction.amount_minor,
          cashflow_type = 'income',
          note = v_transaction.note
      where attachment.center_id = p_center_id and attachment.id = v_attachment_id;
      insert into public.finance_transaction_attachment_binding(
        center_id, transaction_id, attachment_id, bound_by
      ) values (p_center_id, v_transaction.id, v_attachment_id, v_actor);
    end if;

    -- Allocate the public number only after the Finance row exists. Advisory
    -- lock plus unique indexes makes the center/day sequence concurrency-safe.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'tbc.receipt-number|' || p_center_id || '|' || v_transaction_date::text, 0
    ));
    select coalesce(pg_catalog.max(receipt.daily_sequence), 0) + 1
      into v_daily_sequence
    from public.center_tuition_receipts receipt
    where receipt.center_id = p_center_id and receipt.business_date = v_transaction_date
      and receipt.invalidated_at is null;
    v_receipt_number := v_profile.receipt_prefix || '-'
      || pg_catalog.to_char(v_transaction_date, 'DDMMYY') || '-'
      || pg_catalog.lpad(v_daily_sequence::text, 3, '0');

    select link.crm_contact_id into v_contact_id
    from public.crm_contact_student_operational_link link
    where link.center_id = p_center_id
      and link.student_local_id = v_cycle.student_local_id and link.link_status = 'ACTIVE'
    order by case link.financial_contact_role when 'PRIMARY' then 0 when 'SECONDARY' then 1 else 2 end,
      link.is_primary_contact desc, link.updated_at desc, link.link_id limit 1;
    if v_contact_id is not null then
      select * into v_contact from public.crm_contact contact
      where contact.center_id = p_center_id and contact.crm_contact_id = v_contact_id
        and contact.contact_status <> 'ARCHIVED';
      if v_contact.crm_contact_id is not null then
        select coalesce(identity_data.canonical_emails[1], '') into v_email
        from public.f23_3e_p4a_internal_parse_payload_v1(
          public.f23_3e_p3c_internal_unwrap_contact_source_evidence(
            p_center_id, v_contact.crm_contact_id, v_contact.contact_version
          )
        ) identity_data;
        v_payer_name := v_contact.display_name;
      else
        v_contact_id := null;
      end if;
    end if;
    v_payer_name := coalesce(nullif(pg_catalog.btrim(v_finance_command->>'person_name'), ''),
      nullif(pg_catalog.btrim(v_payer_name), ''),
      nullif(pg_catalog.btrim(coalesce(v_student.payload->>'parentName', '')), ''),
      pg_catalog.btrim(coalesce(v_student.payload->>'fullName', '')));
    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(item.label) order by item.label), '[]'::jsonb)
      into v_schedule_lines
    from (select distinct coalesce(
      nullif(pg_catalog.btrim(class_session.payload->>'displayLabel'), ''),
      nullif(pg_catalog.btrim(class_session.payload->>'name'), ''),
      enrollment.class_session_local_id
    ) as label
    from public.center_student_recurring_enrollments enrollment
    join public.center_cloud_entities class_session
      on class_session.center_id = enrollment.center_id
     and class_session.entity_type = 'class_session'
     and class_session.local_id = enrollment.class_session_local_id
     and class_session.deleted_at is null
    where enrollment.center_id = p_center_id
      and enrollment.student_local_id = v_cycle.student_local_id
      and enrollment.ended_at is null) item;

    v_snapshot := pg_catalog.jsonb_build_object(
      'documentType', 'TUITION_RECEIPT',
      'receiptId', v_receipt_id,
      'receiptNumber', v_receipt_number,
      'statusAtIssuance', 'ISSUED',
      'versionAtIssuance', 1,
      'issuedAt', v_now,
      'businessDate', v_transaction_date,
      'financeTransactionId', v_transaction.id,
      'center', pg_catalog.jsonb_build_object(
        'id', p_center_id, 'name', coalesce(v_profile.display_name, v_center.name, p_center_id),
        'address', v_profile.address, 'phone', v_profile.phone
      ),
      'student', pg_catalog.jsonb_build_object(
        'id', v_cycle.student_local_id,
        'name', pg_catalog.btrim(coalesce(v_student.payload->>'fullName', ''))
      ),
      'customer', pg_catalog.jsonb_build_object(
        'id', v_contact_id, 'payerName', v_payer_name, 'email', v_email,
        'receiptAddress', coalesce(v_contact.receipt_address, ''),
        'cccd', coalesce(v_contact.cccd, '')
      ),
      'registration', pg_catalog.jsonb_build_object('code', v_registration, 'label', v_registration_label),
      'scheduleLines', v_schedule_lines,
      'tuition', pg_catalog.jsonb_build_object(
        'tuitionLocalId', v_cycle.tuition_local_id, 'targetCycleId', v_cycle.id,
        'targetPeriodId', v_cycle.payment_period_id, 'termNumber', v_cycle.cycle_number,
        'packageCatalogId', v_cycle.package_catalog_id,
        'packageName', v_cycle.package_name_snapshot,
        'programName', coalesce(v_cycle.program_name_snapshot, ''),
        'totalSessions', v_cycle.total_sessions_snapshot
      ),
      'payment', pg_catalog.jsonb_build_object(
        'transactionId', v_transaction.id, 'transactionCode', v_transaction.transaction_code,
        'transactionDate', v_transaction.transaction_date, 'method', v_transaction.method
      ),
      'money', pg_catalog.jsonb_build_object(
        'tuitionBaseAmount', v_base,
        'discount', pg_catalog.jsonb_build_object(
          'type', v_discount_type, 'value', v_discount_value, 'amount', v_discount
        ),
        'materialFee', v_material, 'totalAmountDue', v_total_due,
        'amountReceived', v_amount,
        'tuitionAllocation', v_tuition_allocation,
        'remainingAfterPayment', greatest(v_total_due - v_prior_received - v_amount, 0)
      )
    );
    insert into public.center_tuition_receipts(
      id, center_id, student_local_id, tuition_local_id, target_cycle_id,
      target_period_id, target_term_number, customer_contact_id,
      registration_classification, tuition_amount_minor, discount_amount_minor,
      material_fee_minor, total_amount_due_minor, snapshot, version,
      issued_by, issued_at, updated_at, receipt_number, business_date,
      daily_sequence, finance_transaction_id, amount_received_minor,
      tuition_allocation_minor
    ) values (
      v_receipt_id, p_center_id, v_cycle.student_local_id, v_cycle.tuition_local_id,
      v_cycle.id, v_cycle.payment_period_id, v_cycle.cycle_number, v_contact_id,
      v_registration, v_base, v_discount, v_material, v_total_due, v_snapshot, 1,
      v_actor, v_now, v_now, v_receipt_number, v_transaction_date,
      v_daily_sequence, v_transaction.id, v_amount, v_tuition_allocation
    ) returning * into v_receipt;
    insert into public.center_tuition_receipt_payment_links(
      center_id, receipt_id, finance_transaction_id, attempt_number, linked_by
    ) values (p_center_id, v_receipt.id, v_transaction.id, 1, v_actor);
    insert into public.center_tuition_receipt_revisions(
      center_id, receipt_id, revision_number, snapshot, corrected_by, created_at
    ) values (p_center_id, v_receipt.id, 1, v_snapshot, v_actor, v_now);

    if v_cycle.lifecycle_status = 'PROVISIONAL_UNPAID'
       and v_prior_tuition + v_tuition_allocation >= v_cycle.price_snapshot then
      update public.center_tuition_package_cycles cycle
      set lifecycle_status = 'ACTIVE', version = cycle.version + 1,
          updated_by = v_actor, updated_at = v_now
      where cycle.center_id = p_center_id and cycle.id = v_cycle.id;
      insert into public.center_tuition_cycle_audit_events(
        center_id, actor_user_id, action, entity_type, entity_id,
        before_state, after_state, command_idempotency_key
      ) select p_center_id, v_actor, 'PROVISIONAL_CYCLE_PAID', 'PACKAGE_CYCLE', cycle.id,
        pg_catalog.to_jsonb(v_cycle), pg_catalog.to_jsonb(cycle), p_idempotency_key
      from public.center_tuition_package_cycles cycle where cycle.id = v_cycle.id;
    end if;

  elsif v_operation = 'REVISE_RECEIPT' then
    if coalesce(p_command->>'receipt_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(p_command->>'expected_version', '') !~ '^[1-9][0-9]*$'
       or pg_catalog.jsonb_typeof(p_command->'corrections') <> 'object' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_receipt_id := (p_command->>'receipt_id')::uuid;
    v_expected_receipt_version := (p_command->>'expected_version')::bigint;
    v_reason := pg_catalog.btrim(coalesce(p_command->>'correction_reason', ''));
    v_corrections := p_command->'corrections';
    if pg_catalog.length(v_reason) not between 3 and 500 or v_reason ~ '[[:cntrl:]]'
       or exists (select 1 from pg_catalog.jsonb_object_keys(v_corrections) key
         where key not in ('centerName','centerAddress','centerPhone','payerName','email','receiptAddress','cccd'))
       or v_corrections = '{}'::jsonb then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CORRECTION_INVALID');
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'f5b.receipt|' || p_center_id || '|' || v_receipt_id::text, 0
    ));
    select * into v_receipt from public.center_tuition_receipts receipt
    where receipt.center_id = p_center_id and receipt.id = v_receipt_id for update;
    if v_receipt.id is null or v_receipt.invalidated_at is not null then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RECEIPT_NOT_FOUND');
    end if;
    if v_receipt.version <> v_expected_receipt_version then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    select * into v_transaction from public.finance_transaction transaction
    where transaction.center_id = p_center_id and transaction.id = v_receipt.finance_transaction_id for share;
    if v_transaction.status <> 'POSTED' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RECEIPT_VOIDED');
    end if;
    select revision.snapshot, revision.revision_number into v_snapshot, v_revision_number
    from public.center_tuition_receipt_revisions revision
    where revision.center_id = p_center_id and revision.receipt_id = v_receipt.id
    order by revision.revision_number desc limit 1;
    if v_corrections ? 'centerName' then
      v_snapshot := pg_catalog.jsonb_set(v_snapshot, '{center,name}', pg_catalog.to_jsonb(pg_catalog.btrim(v_corrections->>'centerName')), true);
    end if;
    if v_corrections ? 'centerAddress' then
      v_snapshot := pg_catalog.jsonb_set(v_snapshot, '{center,address}', pg_catalog.to_jsonb(pg_catalog.btrim(v_corrections->>'centerAddress')), true);
    end if;
    if v_corrections ? 'centerPhone' then
      v_snapshot := pg_catalog.jsonb_set(v_snapshot, '{center,phone}', pg_catalog.to_jsonb(pg_catalog.btrim(v_corrections->>'centerPhone')), true);
    end if;
    if v_corrections ? 'payerName' then
      v_snapshot := pg_catalog.jsonb_set(v_snapshot, '{customer,payerName}', pg_catalog.to_jsonb(pg_catalog.btrim(v_corrections->>'payerName')), true);
    end if;
    if v_corrections ? 'email' then
      v_snapshot := pg_catalog.jsonb_set(v_snapshot, '{customer,email}', pg_catalog.to_jsonb(pg_catalog.btrim(v_corrections->>'email')), true);
    end if;
    if v_corrections ? 'receiptAddress' then
      v_snapshot := pg_catalog.jsonb_set(v_snapshot, '{customer,receiptAddress}', pg_catalog.to_jsonb(pg_catalog.btrim(v_corrections->>'receiptAddress')), true);
    end if;
    if v_corrections ? 'cccd' then
      v_snapshot := pg_catalog.jsonb_set(v_snapshot, '{customer,cccd}', pg_catalog.to_jsonb(pg_catalog.btrim(v_corrections->>'cccd')), true);
    end if;
    if pg_catalog.length(v_snapshot#>>'{center,name}') not between 1 and 120
       or pg_catalog.length(v_snapshot#>>'{center,address}') > 300
       or pg_catalog.length(v_snapshot#>>'{center,phone}') > 40
       or pg_catalog.length(v_snapshot#>>'{customer,payerName}') > 300
       or pg_catalog.length(v_snapshot#>>'{customer,email}') > 320
       or pg_catalog.length(v_snapshot#>>'{customer,receiptAddress}') > 500
       or pg_catalog.length(v_snapshot#>>'{customer,cccd}') > 40 then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CORRECTION_INVALID');
    end if;
    v_revision_number := v_revision_number + 1;
    insert into public.center_tuition_receipt_revisions(
      center_id, receipt_id, revision_number, snapshot,
      correction_reason, corrected_by, created_at
    ) values (
      p_center_id, v_receipt.id, v_revision_number, v_snapshot,
      v_reason, v_actor, v_now
    );
    update public.center_tuition_receipts receipt
    set version = receipt.version + 1, updated_at = v_now
    where receipt.center_id = p_center_id and receipt.id = v_receipt.id
    returning * into v_receipt;
  else
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code',
      case when v_operation in ('CREATE_RECEIPT', 'CONFIRM_PAID')
        then 'OBSOLETE_PRE_PAYMENT_OPERATION' else 'INVALID_OPERATION' end);
  end if;

  insert into public.center_tuition_receipt_audit_events(
    center_id, actor_user_id, receipt_id, operation, receipt_version,
    finance_transaction_id, command_idempotency_key
  ) values (
    p_center_id, v_actor, v_receipt.id, v_operation, v_receipt.version,
    v_receipt.finance_transaction_id, p_idempotency_key
  );
  v_response := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED', 'center_id', p_center_id,
    'receipt_id', v_receipt.id, 'receipt_version', v_receipt.version,
    'receipt_status', 'ISSUED', 'receipt_number', v_receipt.receipt_number,
    'finance_transaction_id', v_receipt.finance_transaction_id,
    'replayed', false
  );
  insert into public.center_tuition_receipt_command_results(
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (p_center_id, v_actor, p_idempotency_key, v_intent, v_response);
  return v_response;
exception when unique_violation then
  return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CONCURRENT_CONFLICT');
end
$function$;

alter function public.tbc_internal_default_receipt_prefix(text,text) owner to postgres;
alter function public.f5b_list_tuition_receipts(text) owner to postgres;
alter function public.f5b_mutate_tuition_receipt(text,jsonb,uuid) owner to postgres;
alter function public.f5b_internal_guard_receipt_immutable() owner to postgres;

revoke all on function public.tbc_internal_default_receipt_prefix(text,text),
  public.f5b_list_tuition_receipts(text),
  public.f5b_mutate_tuition_receipt(text,jsonb,uuid),
  public.f5b_internal_guard_receipt_immutable()
  from public, anon, authenticated, service_role;
grant execute on function public.f5b_list_tuition_receipts(text),
  public.f5b_mutate_tuition_receipt(text,jsonb,uuid)
  to authenticated;

alter table public.center_operational_profiles
  add column receipt_prefix text;

update public.center_operational_profiles profile
set receipt_prefix = public.tbc_internal_default_receipt_prefix(
  profile.display_name,
  profile.center_id
)
where profile.receipt_prefix is null;

alter table public.center_operational_profiles
  alter column receipt_prefix set not null,
  add constraint center_operational_profiles_receipt_prefix_check
    check (receipt_prefix ~ '^[A-Z0-9]{2,6}$');

alter table public.center_tuition_package_catalog
  add column max_completion_weeks integer,
  add constraint center_tuition_package_catalog_max_completion_weeks_check
    check (max_completion_weeks is null or max_completion_weeks between 1 and 5200);

comment on column public.center_operational_profiles.receipt_prefix is
  'Center-scoped printed Receipt prefix. Daily sequence allocation is server-side.';
comment on column public.center_tuition_package_catalog.max_completion_weeks is
  'Optional display-only course completion limit. It does not forfeit sessions.';

-- Extend Settings without rewriting the historical wrappers.
alter function public.v2_1_list_center_settings(text)
  rename to v2_1_list_center_settings_pre_tuition_business_correction;
revoke all on function public.v2_1_list_center_settings_pre_tuition_business_correction(text)
  from public, anon, authenticated, service_role;

create function public.v2_1_list_center_settings(p_center_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_packages jsonb;
begin
  v_result := public.v2_1_list_center_settings_pre_tuition_business_correction(p_center_id);
  if coalesce(v_result->>'ok', 'false') <> 'true' then return v_result; end if;
  v_result := pg_catalog.jsonb_set(
    v_result,
    '{center,receipt_prefix}',
    pg_catalog.to_jsonb((select profile.receipt_prefix
      from public.center_operational_profiles profile
      where profile.center_id = p_center_id)),
    true
  );
  select coalesce(pg_catalog.jsonb_agg(
    item.value || pg_catalog.jsonb_build_object(
      'max_completion_weeks', package.max_completion_weeks
    ) order by item.ordinality
  ), '[]'::jsonb)
  into v_packages
  from pg_catalog.jsonb_array_elements(v_result->'tuition_packages')
    with ordinality as item(value, ordinality)
  join public.center_tuition_package_catalog package
    on package.center_id = p_center_id
   and package.id = (item.value->>'id')::uuid;
  return pg_catalog.jsonb_set(v_result, '{tuition_packages}', v_packages, true);
end
$function$;

alter function public.v2_1_mutate_center_settings(text,jsonb,uuid)
  rename to v2_1_mutate_center_settings_pre_tuition_business_correction;
revoke all on function public.v2_1_mutate_center_settings_pre_tuition_business_correction(text,jsonb,uuid)
  from public, anon, authenticated, service_role;

create function public.v2_1_mutate_center_settings(
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
  v_operation text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', '')));
  v_result jsonb;
  v_prefix text;
  v_weeks integer;
  v_version integer;
begin
  if v_operation = 'UPDATE_CENTER_PROFILE' then
    v_prefix := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'receipt_prefix', '')));
    if v_prefix !~ '^[A-Z0-9]{2,6}$' then raise exception 'v2_1_invalid_center_profile'; end if;
  elsif v_operation in ('CREATE_TUITION_PACKAGE', 'UPDATE_TUITION_PACKAGE')
      and p_command ? 'max_completion_weeks'
      and p_command->'max_completion_weeks' <> 'null'::jsonb then
    if coalesce(p_command->>'max_completion_weeks', '') !~ '^[1-9][0-9]*$' then
      raise exception 'v2_1_invalid_tuition_package';
    end if;
    v_weeks := (p_command->>'max_completion_weeks')::integer;
    if v_weeks not between 1 and 5200 then raise exception 'v2_1_invalid_tuition_package'; end if;
  end if;

  v_result := public.v2_1_mutate_center_settings_pre_tuition_business_correction(
    p_center_id, p_command, p_idempotency_key
  );
  if coalesce(v_result->>'ok', 'false') <> 'true' then return v_result; end if;
  v_version := (v_result->>'entity_version')::integer;

  if v_operation = 'UPDATE_CENTER_PROFILE' then
    update public.center_operational_profiles profile
    set receipt_prefix = v_prefix
    where profile.center_id = p_center_id and profile.version = v_version;
  elsif v_operation in ('CREATE_TUITION_PACKAGE', 'UPDATE_TUITION_PACKAGE') then
    update public.center_tuition_package_catalog package
    set max_completion_weeks = case
      when p_command ? 'max_completion_weeks' then v_weeks else null end
    where package.center_id = p_center_id
      and package.id = (v_result->>'entity_id')::uuid
      and package.version = v_version;
  end if;
  return v_result;
end
$function$;

alter function public.v2_1_list_center_settings(text) owner to postgres;
alter function public.v2_1_mutate_center_settings(text,jsonb,uuid) owner to postgres;
grant execute on function public.v2_1_list_center_settings(text),
  public.v2_1_mutate_center_settings(text,jsonb,uuid) to authenticated, service_role;

-- Forward-correct the Receipt authority. Pre-payment artifacts stay in audit
-- storage but are explicitly invalid and never appear in the canonical list.
alter table public.center_tuition_receipts
  drop constraint center_tuition_receipts_target_unique,
  add column receipt_number text,
  add column business_date date,
  add column daily_sequence integer,
  add column finance_transaction_id uuid,
  add column amount_received_minor bigint,
  add column tuition_allocation_minor bigint,
  add column invalidated_at timestamptz,
  add column invalidation_reason text,
  add constraint center_tuition_receipts_finance_fkey
    foreign key(center_id, finance_transaction_id)
    references public.finance_transaction(center_id, id) on delete restrict,
  add constraint center_tuition_receipts_daily_sequence_check
    check (daily_sequence is null or daily_sequence >= 1),
  add constraint center_tuition_receipts_received_check check (
    amount_received_minor is null or amount_received_minor between 1 and 9007199254740991
  ),
  add constraint center_tuition_receipts_allocation_check check (
    tuition_allocation_minor is null
    or tuition_allocation_minor between 0 and amount_received_minor
  ),
  add constraint center_tuition_receipts_invalidation_check check (
    (invalidated_at is null and invalidation_reason is null)
    or (invalidated_at is not null and pg_catalog.length(pg_catalog.btrim(invalidation_reason)) between 3 and 500)
  );

drop trigger if exists center_tuition_receipts_immutable_guard
  on public.center_tuition_receipts;

update public.center_tuition_receipts receipt
set finance_transaction_id = linked.finance_transaction_id,
    business_date = linked.transaction_date,
    amount_received_minor = linked.amount_minor,
    tuition_allocation_minor = linked.tuition_allocation_minor
from (
  select distinct on (link.center_id, link.receipt_id)
    link.center_id, link.receipt_id, transaction.id as finance_transaction_id,
    transaction.transaction_date, transaction.amount_minor,
    coalesce(transaction.tuition_allocation_minor, transaction.amount_minor) as tuition_allocation_minor
  from public.center_tuition_receipt_payment_links link
  join public.finance_transaction transaction
    on transaction.center_id = link.center_id
   and transaction.id = link.finance_transaction_id
  order by link.center_id, link.receipt_id,
    case transaction.status when 'POSTED' then 0 else 1 end,
    link.attempt_number desc
) linked
where receipt.center_id = linked.center_id and receipt.id = linked.receipt_id;

update public.center_tuition_receipts receipt
set invalidated_at = coalesce(receipt.updated_at, receipt.issued_at),
    invalidation_reason = 'LEGACY_PRE_PAYMENT_RECEIPT'
where receipt.finance_transaction_id is null;

with numbered as (
  select receipt.id,
    pg_catalog.row_number() over (
      partition by receipt.center_id, receipt.business_date
      order by receipt.issued_at, receipt.id
    )::integer as sequence
  from public.center_tuition_receipts receipt
  where receipt.finance_transaction_id is not null
)
update public.center_tuition_receipts receipt
set daily_sequence = numbered.sequence,
    receipt_number = profile.receipt_prefix || '-'
      || pg_catalog.to_char(receipt.business_date, 'DDMMYY') || '-'
      || pg_catalog.lpad(numbered.sequence::text, 3, '0')
from numbered
join public.center_operational_profiles profile on true
where receipt.id = numbered.id and profile.center_id = receipt.center_id;

create unique index center_tuition_receipts_finance_unique
  on public.center_tuition_receipts(center_id, finance_transaction_id)
  where finance_transaction_id is not null;
create unique index center_tuition_receipts_daily_number_unique
  on public.center_tuition_receipts(center_id, business_date, daily_sequence)
  where invalidated_at is null;
create unique index center_tuition_receipts_printed_number_unique
  on public.center_tuition_receipts(center_id, receipt_number)
  where invalidated_at is null;

create table public.center_tuition_receipt_revisions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null references public.centers(id) on delete restrict,
  receipt_id uuid not null,
  revision_number integer not null check (revision_number >= 1),
  snapshot jsonb not null check (pg_catalog.jsonb_typeof(snapshot) = 'object'),
  correction_reason text,
  corrected_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  foreign key(center_id, receipt_id)
    references public.center_tuition_receipts(center_id, id) on delete restrict,
  unique(center_id, receipt_id, revision_number),
  check (
    (revision_number = 1 and correction_reason is null)
    or (revision_number > 1 and pg_catalog.length(pg_catalog.btrim(correction_reason)) between 3 and 500)
  )
);

insert into public.center_tuition_receipt_revisions(
  center_id, receipt_id, revision_number, snapshot, corrected_by, created_at
)
select receipt.center_id, receipt.id, 1,
  receipt.snapshot
    || pg_catalog.jsonb_build_object(
      'receiptId', receipt.id,
      'receiptNumber', receipt.receipt_number,
      'statusAtIssuance', 'ISSUED',
      'issuedAt', receipt.issued_at,
      'businessDate', receipt.business_date,
      'financeTransactionId', receipt.finance_transaction_id
    )
    || pg_catalog.jsonb_build_object(
      'money', coalesce(receipt.snapshot->'money', '{}'::jsonb)
        || pg_catalog.jsonb_build_object('amountReceived', receipt.amount_received_minor)
    ),
  receipt.issued_by, receipt.issued_at
from public.center_tuition_receipts receipt
where receipt.finance_transaction_id is not null;

alter table public.center_tuition_receipt_revisions enable row level security;
alter table public.center_tuition_receipt_revisions force row level security;
revoke all on table public.center_tuition_receipt_revisions from public, anon, authenticated, service_role;
grant all on table public.center_tuition_receipt_revisions to service_role;

alter table public.center_tuition_receipt_audit_events
  drop constraint center_tuition_receipt_audit_events_operation_check,
  add constraint center_tuition_receipt_audit_events_operation_check
    check (operation in ('CREATE_RECEIPT', 'CONFIRM_PAID', 'RECORD_PAYMENT', 'REVISE_RECEIPT'));

drop trigger if exists center_tuition_receipts_immutable_guard
  on public.center_tuition_receipts;
create or replace function public.f5b_internal_guard_receipt_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (pg_catalog.to_jsonb(new) - array['version', 'updated_at'])
     is distinct from (pg_catalog.to_jsonb(old) - array['version', 'updated_at']) then
    raise exception 'f5b_receipt_identity_immutable';
  end if;
  if new.version <> old.version + 1 or new.updated_at < old.updated_at then
    raise exception 'f5b_receipt_version_invalid';
  end if;
  return new;
end
$function$;
create trigger center_tuition_receipts_immutable_guard
before update on public.center_tuition_receipts
for each row execute function public.f5b_internal_guard_receipt_immutable();

-- TBHP: one immutable, reprintable renewal notice snapshot per target cycle.
create table public.center_tuition_notices (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null references public.centers(id) on delete restrict,
  student_local_id text not null,
  tuition_local_id text not null,
  target_cycle_id uuid not null,
  target_period_id text not null,
  target_term_number integer not null check (target_term_number >= 2),
  total_sessions integer not null check (total_sessions between 1 and 1000),
  snapshot jsonb not null check (pg_catalog.jsonb_typeof(snapshot) = 'object'),
  version bigint not null default 1 check (version >= 1),
  issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint center_tuition_notices_center_id_id_unique unique(center_id, id),
  constraint center_tuition_notices_cycle_unique unique(center_id, target_cycle_id),
  constraint center_tuition_notices_cycle_fkey foreign key(center_id, target_cycle_id)
    references public.center_tuition_package_cycles(center_id, id) on delete restrict
);
create index center_tuition_notices_student_history_idx
  on public.center_tuition_notices(center_id, student_local_id, issued_at desc);

create table public.center_tuition_notice_command_results (
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  intent_digest bytea not null check (pg_catalog.octet_length(intent_digest) = 32),
  result_snapshot jsonb not null check (pg_catalog.jsonb_typeof(result_snapshot) = 'object'),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key(center_id, actor_user_id, idempotency_key)
);

create table public.center_tuition_notice_audit_events (
  id bigint generated always as identity primary key,
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  notice_id uuid not null,
  operation text not null check (operation = 'CREATE_NOTICE'),
  command_idempotency_key uuid not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  foreign key(center_id, notice_id)
    references public.center_tuition_notices(center_id, id) on delete restrict
);

alter table public.center_tuition_notices enable row level security;
alter table public.center_tuition_notices force row level security;
alter table public.center_tuition_notice_command_results enable row level security;
alter table public.center_tuition_notice_command_results force row level security;
alter table public.center_tuition_notice_audit_events enable row level security;
alter table public.center_tuition_notice_audit_events force row level security;
revoke all on table public.center_tuition_notices,
  public.center_tuition_notice_command_results,
  public.center_tuition_notice_audit_events from public, anon, authenticated, service_role;
grant all on table public.center_tuition_notices,
  public.center_tuition_notice_command_results,
  public.center_tuition_notice_audit_events to service_role;
grant usage, select on sequence public.center_tuition_notice_audit_events_id_seq to service_role;

create function public.tbhp_internal_schedule_rows(
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
  with actual_base as (
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
  ),
  actual as (
    select actual_base.*,
      pg_catalog.row_number() over (
        order by session_date, schedule_session_local_id, id
      )::integer as ordinal
    from actual_base
  ),
  predecessor as (
    select greatest(coalesce(cycle.total_sessions_snapshot, 0)
      - cycle.baseline_used_sessions
      - coalesce((select pg_catalog.count(*)::integer
          from public.center_tuition_attendance_contributions contribution
          where contribution.center_id = cycle.center_id
            and contribution.cycle_id = cycle.id
            and contribution.ended_at is null
            and contribution.allocation_state = 'APPLIED'
            and contribution.contribution_units = 1), 0), 0)::integer as remaining
    from public.center_tuition_package_cycles cycle
    where cycle.center_id = p_center_id and cycle.id = p_predecessor_cycle_id
  ),
  planning as (
    select greatest(
      coalesce((select pg_catalog.max(session_date) + 1 from actual), pg_catalog.current_date),
      pg_catalog.current_date
    ) as starts_on,
    coalesce((select remaining from predecessor), 0) as skip_count,
    (select pg_catalog.count(*)::integer from actual) as actual_count
  ),
  recurring_candidates as (
    select calendar.day::date as session_date,
      coalesce(nullif(pg_catalog.btrim(class_session.payload->>'instructorName'), ''), '') as teacher_name,
      enrollment.class_session_local_id as schedule_identity
    from planning
    cross join lateral pg_catalog.generate_series(
      planning.starts_on::timestamp,
      (planning.starts_on + 25 * 365)::timestamp,
      interval '1 day'
    ) calendar(day)
    join public.center_student_recurring_enrollments enrollment
      on enrollment.center_id = p_center_id
     and enrollment.student_local_id = p_student_local_id
     and enrollment.ended_at is null
     and (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from calendar.day)::integer + 1]
       = any(enrollment.weekdays)
    join public.center_cloud_entities class_session
      on class_session.center_id = enrollment.center_id
     and class_session.entity_type = 'class_session'
     and class_session.local_id = enrollment.class_session_local_id
     and class_session.deleted_at is null
     and pg_catalog.lower(coalesce(class_session.payload->>'isDeleted', 'false')) <> 'true'
  ),
  oneoff_candidates as (
    select (schedule.payload->>'date')::date as session_date,
      coalesce(nullif(pg_catalog.btrim(schedule.payload->>'teacherName'), ''), '') as teacher_name,
      schedule.local_id as schedule_identity
    from planning
    join public.center_cloud_entities schedule
      on schedule.center_id = p_center_id
     and schedule.entity_type = 'schedule_session'
     and schedule.deleted_at is null
     and pg_catalog.lower(coalesce(schedule.payload->>'scheduleType', '')) in ('oneoff', 'one-off')
     and coalesce(schedule.payload->>'date', '') ~ '^\d{4}-\d{2}-\d{2}$'
     and (schedule.payload->>'date')::date >= planning.starts_on
     and coalesce(schedule.payload->'studentIds', '[]'::jsonb) ? p_student_local_id
  ),
  planned_ranked as (
    select candidate.*,
      pg_catalog.row_number() over (
        order by candidate.session_date, candidate.schedule_identity
      )::integer as plan_ordinal
    from (
      select * from recurring_candidates
      union all
      select * from oneoff_candidates
    ) candidate
  ),
  planned as (
    select planned_ranked.session_date, planned_ranked.teacher_name,
      planning.actual_count + planned_ranked.plan_ordinal - planning.skip_count as ordinal
    from planned_ranked
    cross join planning
    where planned_ranked.plan_ordinal > planning.skip_count
      and planned_ranked.plan_ordinal <= planning.skip_count
        + greatest(p_total_sessions - planning.actual_count, 0)
  ),
  resolved as (
    select actual.ordinal, actual.session_date, actual.teacher_name, 'ACTUAL'::text as source
    from actual
    where actual.ordinal <= p_total_sessions
    union all
    select planned.ordinal, planned.session_date, planned.teacher_name, 'PLANNED'::text
    from planned
  ),
  completed as (
    select series.ordinal,
      resolved.session_date,
      coalesce(resolved.teacher_name, '') as teacher_name,
      coalesce(resolved.source, 'UNRESOLVED') as source
    from pg_catalog.generate_series(1, p_total_sessions) series(ordinal)
    left join resolved on resolved.ordinal = series.ordinal
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'sessionNumber', completed.ordinal,
    'date', completed.session_date,
    'teacherName', completed.teacher_name,
    'source', completed.source
  ) order by completed.ordinal), '[]'::jsonb)
  from completed
$function$;

create function public.tbhp_list_tuition_notices(p_center_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_membership public.center_members;
begin
  if v_actor is null then raise exception 'tbhp_not_authenticated'; end if;
  select * into v_membership
  from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'tbhp_center_access_denied'; end if;
  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'AUTHORITATIVE_SNAPSHOT',
    'center_id', p_center_id,
    'can_write', public.c5_4_internal_has_finance_access(p_center_id),
    'notices', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id', notice.id,
      'student_id', notice.student_local_id,
      'tuition_local_id', notice.tuition_local_id,
      'target_cycle_id', notice.target_cycle_id,
      'target_period_id', notice.target_period_id,
      'target_term_number', notice.target_term_number,
      'total_sessions', notice.total_sessions,
      'snapshot', notice.snapshot,
      'version', notice.version,
      'issued_at', notice.issued_at
    ) order by notice.issued_at desc, notice.id)
    from public.center_tuition_notices notice
    where notice.center_id = p_center_id), '[]'::jsonb)
  );
end
$function$;

create function public.tbhp_mutate_tuition_notice(
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
  v_actor uuid := auth.uid();
  v_membership public.center_members;
  v_existing public.center_tuition_notice_command_results;
  v_intent bytea;
  v_notice_id uuid;
  v_cycle_id uuid;
  v_expected_version bigint;
  v_cycle public.center_tuition_package_cycles;
  v_previous public.center_tuition_package_cycles;
  v_package public.center_tuition_package_catalog;
  v_profile public.center_operational_profiles;
  v_center public.centers;
  v_student public.center_cloud_entities;
  v_tuition public.center_cloud_entities;
  v_schedule_rows jsonb;
  v_material bigint;
  v_discount bigint := 0;
  v_due_date text := '';
  v_transfer_content text;
  v_snapshot jsonb;
  v_response jsonb;
begin
  if v_actor is null then raise exception 'tbhp_not_authenticated'; end if;
  if p_idempotency_key is null or p_command is null
     or pg_catalog.jsonb_typeof(p_command) <> 'object' then
    raise exception 'tbhp_invalid_command';
  end if;
  select * into v_membership
  from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'tbhp_center_access_denied'; end if;
  if not public.c5_4_internal_has_finance_access(p_center_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'WRITE_ROLE_REQUIRED');
  end if;
  if pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'operation', ''))) <> 'CREATE_NOTICE'
     or coalesce(p_command->>'notice_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or coalesce(p_command->>'target_cycle_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or coalesce(p_command->>'expected_cycle_version', '') !~ '^[1-9][0-9]*$' then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
  end if;

  v_intent := extensions.digest(pg_catalog.convert_to(p_command::text, 'UTF8'), 'sha256');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'tbhp.command|' || p_center_id || '|' || v_actor::text || '|' || p_idempotency_key::text, 0
  ));
  select * into v_existing from public.center_tuition_notice_command_results result
  where result.center_id = p_center_id and result.actor_user_id = v_actor
    and result.idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.intent_digest <> v_intent then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return v_existing.result_snapshot || pg_catalog.jsonb_build_object('replayed', true);
  end if;

  v_notice_id := (p_command->>'notice_id')::uuid;
  v_cycle_id := (p_command->>'target_cycle_id')::uuid;
  v_expected_version := (p_command->>'expected_cycle_version')::bigint;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'tbhp.cycle|' || p_center_id || '|' || v_cycle_id::text, 0
  ));
  select * into v_cycle from public.center_tuition_package_cycles cycle
  where cycle.center_id = p_center_id and cycle.id = v_cycle_id for share;
  if v_cycle.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_FOUND');
  end if;
  if v_cycle.version <> v_expected_version then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
  end if;
  if v_cycle.cycle_number < 2 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RENEWAL_ONLY');
  end if;
  if v_cycle.lifecycle_status not in ('PREPARED', 'PROVISIONAL_UNPAID', 'ACTIVE')
     or v_cycle.package_catalog_id is null or v_cycle.total_sessions_snapshot is null
     or v_cycle.price_snapshot is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_ELIGIBLE');
  end if;
  if exists (select 1 from public.center_tuition_notices notice
    where notice.center_id = p_center_id and notice.target_cycle_id = v_cycle.id) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'NOTICE_ALREADY_EXISTS');
  end if;

  select * into v_student from public.center_cloud_entities entity
  where entity.center_id = p_center_id and entity.entity_type = 'student'
    and entity.local_id = v_cycle.student_local_id and entity.deleted_at is null for share;
  select * into v_tuition from public.center_cloud_entities entity
  where entity.center_id = p_center_id and entity.entity_type = 'tuition_record_package'
    and entity.local_id = v_cycle.tuition_local_id and entity.deleted_at is null for share;
  select * into v_profile from public.center_operational_profiles profile
  where profile.center_id = p_center_id;
  select * into v_center from public.centers center_row where center_row.id = p_center_id;
  select * into v_package from public.center_tuition_package_catalog package
  where package.center_id = p_center_id and package.id = v_cycle.package_catalog_id;
  if v_student.id is null or v_tuition.id is null or v_profile.center_id is null
     or v_package.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'AUTHORITATIVE_SOURCE_MISSING');
  end if;
  if v_cycle.predecessor_cycle_id is not null then
    select * into v_previous from public.center_tuition_package_cycles cycle
    where cycle.center_id = p_center_id and cycle.id = v_cycle.predecessor_cycle_id;
  end if;
  if coalesce(v_tuition.payload->>'dueDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    v_due_date := v_tuition.payload->>'dueDate';
  end if;
  v_material := v_profile.renewal_material_fee_minor;
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
    'noticeId', v_notice_id,
    'issuedAt', pg_catalog.clock_timestamp(),
    'registration', pg_catalog.jsonb_build_object('code', 'RENEWAL', 'label', 'Tái đăng ký'),
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
      'learningForm', 'Tái đăng ký',
      'totalSessions', v_cycle.total_sessions_snapshot,
      'maxCompletionWeeks', v_package.max_completion_weeks
    ),
    'currentProgress', pg_catalog.jsonb_build_object(
      'usedSessions', coalesce((select projection.used_sessions
        from public.center_tuition_package_cycle_projection projection
        where projection.center_id = p_center_id and projection.id = v_cycle.predecessor_cycle_id), 0),
      'totalSessions', coalesce(v_previous.total_sessions_snapshot, v_cycle.total_sessions_snapshot)
    ),
    'paymentWindow', pg_catalog.jsonb_build_object(
      'from', pg_catalog.current_date,
      'to', nullif(v_due_date, '')
    ),
    'money', pg_catalog.jsonb_build_object(
      'tuitionAmount', v_cycle.price_snapshot,
      'discountAmount', v_discount,
      'materialFee', v_material,
      'totalAmount', v_cycle.price_snapshot - v_discount + v_material,
      'discountExplanation', ''
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
  insert into public.center_tuition_notices(
    id, center_id, student_local_id, tuition_local_id, target_cycle_id,
    target_period_id, target_term_number, total_sessions, snapshot, issued_by
  ) values (
    v_notice_id, p_center_id, v_cycle.student_local_id, v_cycle.tuition_local_id,
    v_cycle.id, v_cycle.payment_period_id, v_cycle.cycle_number,
    v_cycle.total_sessions_snapshot, v_snapshot, v_actor
  );
  insert into public.center_tuition_notice_audit_events(
    center_id, actor_user_id, notice_id, operation, command_idempotency_key
  ) values (p_center_id, v_actor, v_notice_id, 'CREATE_NOTICE', p_idempotency_key);
  v_response := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED', 'center_id', p_center_id,
    'notice_id', v_notice_id, 'notice_version', 1, 'replayed', false
  );
  insert into public.center_tuition_notice_command_results(
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (p_center_id, v_actor, p_idempotency_key, v_intent, v_response);
  return v_response;
exception when unique_violation then
  return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CONCURRENT_CONFLICT');
end
$function$;

-- Explicit Admin stop. This is not inferred from lateness and does not
-- forfeit unused sessions. Only attended, unpaid sessions are exposed as debt.
alter table public.center_tuition_package_cycles
  add column continuation_stopped_at timestamptz,
  add column continuation_stopped_by uuid references auth.users(id) on delete restrict,
  add column continuation_stop_reason text,
  add column settlement_debt_sessions integer,
  add column settlement_debt_amount_minor bigint,
  add column settlement_authority_gap text,
  add constraint center_tuition_cycle_stop_check check (
    (continuation_stopped_at is null and continuation_stopped_by is null
      and continuation_stop_reason is null and settlement_debt_sessions is null
      and settlement_debt_amount_minor is null and settlement_authority_gap is null)
    or (continuation_stopped_at is not null and continuation_stopped_by is not null
      and pg_catalog.length(pg_catalog.btrim(continuation_stop_reason)) between 3 and 500
      and settlement_debt_sessions >= 0
      and (settlement_debt_amount_minor is not null or settlement_authority_gap is not null))
  );

do $tbc_patch_prepare_after_stop$
declare
  v_signature regprocedure := 'public.v2_4_mutate_package_cycle(text,jsonb,uuid)'::regprocedure;
  v_definition text;
  v_search constant text := $search$
    if v_current.id is null or v_current.version <> v_expected_version
       or v_current.lifecycle_status not in ('ACTIVE', 'PROVISIONAL_UNPAID') then$search$;
  v_replacement constant text := $replacement$
    if v_current.id is null or v_current.version <> v_expected_version
       or v_current.continuation_stopped_at is not null
       or v_current.lifecycle_status not in ('ACTIVE', 'PROVISIONAL_UNPAID') then$replacement$;
begin
  select pg_catalog.pg_get_functiondef(v_signature) into v_definition;
  if (pg_catalog.length(v_definition)
      - pg_catalog.length(pg_catalog.replace(v_definition, v_search, '')))
      / pg_catalog.length(v_search) <> 1 then
    raise exception 'tbc_prepare_stop_guard_drift';
  end if;
  execute pg_catalog.replace(v_definition, v_search, v_replacement);
end
$tbc_patch_prepare_after_stop$;

alter function public.v2_4_list_package_cycle_state(text)
  rename to v2_4_list_package_cycle_state_pre_tuition_business_correction;
revoke all on function public.v2_4_list_package_cycle_state_pre_tuition_business_correction(text)
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
  v_students jsonb;
begin
  v_result := public.v2_4_list_package_cycle_state_pre_tuition_business_correction(p_center_id);
  if coalesce(v_result->>'ok', 'false') <> 'true' then return v_result; end if;
  select coalesce(pg_catalog.jsonb_agg(
    student.value || pg_catalog.jsonb_build_object(
      'current_cycle', case when student.value->'current_cycle' = 'null'::jsonb
        then null else student.value->'current_cycle' || pg_catalog.jsonb_build_object(
          'continuation_stopped_at', cycle.continuation_stopped_at,
          'continuation_stop_reason', cycle.continuation_stop_reason,
          'settlement_debt_sessions', cycle.settlement_debt_sessions,
          'settlement_debt_amount_minor', cycle.settlement_debt_amount_minor,
          'settlement_authority_gap', cycle.settlement_authority_gap
        ) end
    ) order by student.ordinality
  ), '[]'::jsonb) into v_students
  from pg_catalog.jsonb_array_elements(v_result->'students')
    with ordinality as student(value, ordinality)
  left join public.center_tuition_package_cycles cycle
    on cycle.center_id = p_center_id
   and cycle.id = case when student.value->'current_cycle' = 'null'::jsonb then null
     else (student.value#>>'{current_cycle,id}')::uuid end;
  return pg_catalog.jsonb_set(v_result, '{students}', v_students, true);
end
$function$;

alter function public.v2_4_list_package_cycle_state(text) owner to postgres;
grant execute on function public.v2_4_list_package_cycle_state(text) to authenticated;

do $tbc_patch_rollover_after_stop$
declare
  v_signature regprocedure :=
    'public.v2_4_internal_reconcile_student(text,text,uuid)'::regprocedure;
  v_definition text;
  v_search constant text := 'and v_used >= v_cycle.total_sessions_snapshot then';
  v_replacement constant text := 'and v_used >= v_cycle.total_sessions_snapshot'
    || pg_catalog.chr(10) || '       and v_cycle.continuation_stopped_at is null then';
  v_count integer;
begin
  select pg_catalog.pg_get_functiondef(v_signature) into v_definition;
  v_count := (pg_catalog.length(v_definition)
    - pg_catalog.length(pg_catalog.replace(v_definition, v_search, '')))
    / pg_catalog.length(v_search);
  if v_count <> 2 then raise exception 'tbc_rollover_guard_drift:%', v_count; end if;
  execute pg_catalog.replace(v_definition, v_search, v_replacement);
end
$tbc_patch_rollover_after_stop$;

create function public.tbc_stop_tuition_continuation(
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
  v_actor uuid := auth.uid();
  v_membership public.center_members;
  v_existing public.center_tuition_cycle_command_results;
  v_intent bytea;
  v_cycle public.center_tuition_package_cycles;
  v_prepared public.center_tuition_package_cycles;
  v_cycle_id uuid;
  v_expected_version bigint;
  v_reason text;
  v_used integer;
  v_paid bigint;
  v_unallocated_payments integer;
  v_debt_sessions integer;
  v_debt bigint;
  v_gap text;
  v_before jsonb;
  v_response jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_actor is null then raise exception 'tbc_not_authenticated'; end if;
  if p_idempotency_key is null or p_command is null
     or pg_catalog.jsonb_typeof(p_command) <> 'object' then
    raise exception 'tbc_invalid_command';
  end if;
  select * into v_membership
  from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'tbc_center_access_denied'; end if;
  if not public.c5_4_internal_has_finance_access(p_center_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'WRITE_ROLE_REQUIRED');
  end if;
  if pg_catalog.upper(coalesce(p_command->>'operation', '')) <> 'STOP_CONTINUATION'
     or coalesce(p_command->>'cycle_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
     or coalesce(p_command->>'expected_version', '') !~ '^[1-9][0-9]*$' then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
  end if;
  v_cycle_id := (p_command->>'cycle_id')::uuid;
  v_expected_version := (p_command->>'expected_version')::bigint;
  v_reason := pg_catalog.btrim(coalesce(p_command->>'reason', ''));
  if pg_catalog.length(v_reason) not between 3 and 500 or v_reason ~ '[[:cntrl:]]' then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
  end if;
  v_intent := extensions.digest(pg_catalog.convert_to(p_command::text, 'UTF8'), 'sha256');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'tbc.stop|' || p_center_id || '|' || v_actor::text || '|' || p_idempotency_key::text, 0
  ));
  select * into v_existing from public.center_tuition_cycle_command_results result
  where result.center_id = p_center_id and result.actor_user_id = v_actor
    and result.idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.intent_digest <> v_intent then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return v_existing.result_snapshot || pg_catalog.jsonb_build_object('replayed', true);
  end if;
  select * into v_cycle from public.center_tuition_package_cycles cycle
  where cycle.center_id = p_center_id and cycle.id = v_cycle_id;
  if v_cycle.id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_FOUND');
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'v2.4.student|' || p_center_id || '|' || v_cycle.student_local_id, 0
  ));
  select * into v_cycle from public.center_tuition_package_cycles cycle
  where cycle.center_id = p_center_id and cycle.id = v_cycle_id for update;
  if v_cycle.version <> v_expected_version then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
  end if;
  if v_cycle.continuation_stopped_at is not null
     or v_cycle.lifecycle_status not in ('ACTIVE', 'PROVISIONAL_UNPAID') then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_STATE_CONFLICT');
  end if;
  select * into v_prepared from public.center_tuition_package_cycles cycle
  where cycle.center_id = p_center_id
    and cycle.predecessor_cycle_id = v_cycle.id
    and cycle.lifecycle_status = 'PREPARED' for update;
  if v_prepared.id is not null and exists (
    select 1 from public.finance_transaction transaction
    where transaction.center_id = p_center_id and transaction.status = 'POSTED'
      and transaction.source_module = 'hoc-phi'
      and transaction.source_type = 'tuition-payment'
      and transaction.source_period_id = v_prepared.payment_period_id
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'PAID_PREPARED_CYCLE_REQUIRES_SETTLEMENT');
  end if;
  select coalesce(pg_catalog.sum(contribution.contribution_units), 0)::integer
    into v_used
  from public.center_tuition_attendance_contributions contribution
  where contribution.center_id = p_center_id and contribution.cycle_id = v_cycle.id
    and contribution.ended_at is null and contribution.allocation_state = 'APPLIED'
    and contribution.contribution_units = 1;
  select coalesce(pg_catalog.sum(transaction.tuition_allocation_minor), 0)::bigint,
    pg_catalog.count(*) filter (where transaction.tuition_allocation_minor is null)::integer
    into v_paid, v_unallocated_payments
  from public.finance_transaction transaction
  where transaction.center_id = p_center_id and transaction.status = 'POSTED'
    and transaction.source_module = 'hoc-phi'
    and transaction.source_type = 'tuition-payment'
    and transaction.source_period_id = v_cycle.payment_period_id;
  v_debt_sessions := case when v_cycle.lifecycle_status = 'PROVISIONAL_UNPAID'
    then greatest(coalesce(v_used, 0), 0) else 0 end;
  if v_debt_sessions = 0 then
    v_debt := 0;
    v_gap := null;
  elsif v_unallocated_payments > 0 then
    v_gap := 'HISTORICAL_TUITION_ALLOCATION_NOT_PROVEN';
    v_debt := null;
  elsif v_cycle.price_snapshot is null or v_cycle.total_sessions_snapshot is null then
    v_gap := 'CYCLE_PRICE_OR_SESSION_COUNT_MISSING';
    v_debt := null;
  elsif mod(v_cycle.price_snapshot, v_cycle.total_sessions_snapshot) <> 0 then
    v_gap := 'CYCLE_TUITION_NOT_EVENLY_DIVISIBLE_BY_SESSION';
    v_debt := null;
  else
    v_debt := greatest(
      v_debt_sessions * (v_cycle.price_snapshot / v_cycle.total_sessions_snapshot) - coalesce(v_paid, 0),
      0
    );
    v_gap := null;
  end if;
  v_before := pg_catalog.to_jsonb(v_cycle);
  update public.center_tuition_package_cycles cycle
  set continuation_stopped_at = v_now,
      continuation_stopped_by = v_actor,
      continuation_stop_reason = v_reason,
      settlement_debt_sessions = v_debt_sessions,
      settlement_debt_amount_minor = v_debt,
      settlement_authority_gap = v_gap,
      version = cycle.version + 1,
      updated_by = v_actor,
      updated_at = v_now
  where cycle.center_id = p_center_id and cycle.id = v_cycle.id
  returning * into v_cycle;
  if v_prepared.id is not null then
    update public.center_tuition_package_cycles cycle
    set lifecycle_status = 'SUPERSEDED', version = cycle.version + 1,
        updated_by = v_actor, updated_at = v_now
    where cycle.id = v_prepared.id;
  end if;
  insert into public.center_tuition_cycle_audit_events(
    center_id, actor_user_id, action, entity_type, entity_id,
    before_state, after_state, command_idempotency_key
  ) values (
    p_center_id, v_actor, 'CONTINUATION_STOPPED', 'PACKAGE_CYCLE', v_cycle.id,
    v_before, pg_catalog.to_jsonb(v_cycle), p_idempotency_key
  );
  v_response := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED', 'center_id', p_center_id,
    'cycle_id', v_cycle.id, 'cycle_version', v_cycle.version,
    'debt_sessions', v_debt_sessions, 'debt_amount_minor', v_debt,
    'authority_gap', v_gap, 'replayed', false
  );
  insert into public.center_tuition_cycle_command_results(
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (p_center_id, v_actor, p_idempotency_key, v_intent, v_response);
  return v_response;
end
$function$;

alter function public.tbc_stop_tuition_continuation(text,jsonb,uuid) owner to postgres;
revoke all on function public.tbc_stop_tuition_continuation(text,jsonb,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.tbc_stop_tuition_continuation(text,jsonb,uuid) to authenticated;

comment on function public.tbc_stop_tuition_continuation(text,jsonb,uuid) is
  'Explicit Admin stop: suppresses future rollover and exposes attended-session debt without charging material fee.';

alter function public.tbhp_internal_schedule_rows(text,uuid,text,integer,uuid) owner to postgres;
alter function public.tbhp_list_tuition_notices(text) owner to postgres;
alter function public.tbhp_mutate_tuition_notice(text,jsonb,uuid) owner to postgres;
revoke all on function public.tbhp_internal_schedule_rows(text,uuid,text,integer,uuid),
  public.tbhp_list_tuition_notices(text),
  public.tbhp_mutate_tuition_notice(text,jsonb,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.tbhp_list_tuition_notices(text),
  public.tbhp_mutate_tuition_notice(text,jsonb,uuid) to authenticated;

comment on table public.center_tuition_notices is
  'Canonical renewal-only, pre-payment TBHP snapshot history. It has no money-received semantics.';
comment on table public.center_tuition_receipts is
  'Canonical post-payment Receipt identity. Every valid row links exactly one actual Finance income.';
comment on table public.center_tuition_receipt_revisions is
  'Append-only historical Receipt output corrections; revision 1 is the issuance snapshot.';
comment on function public.f5b_mutate_tuition_receipt(text,jsonb,uuid) is
  'Atomic RECORD_PAYMENT creates Finance income, evidence binding, Receipt number, snapshot, and revision 1; REVISE_RECEIPT appends an audited snapshot.';
comment on function public.tbhp_mutate_tuition_notice(text,jsonb,uuid) is
  'Creates one renewal-only TBHP snapshot with zero Finance writes.';

set check_function_bodies = on;


