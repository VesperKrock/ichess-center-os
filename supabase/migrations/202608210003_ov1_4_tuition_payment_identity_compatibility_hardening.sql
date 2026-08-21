-- OV1.4 hardening: C5.2 stores tuition authority under a canonical prefixed
-- local_id while payload.id remains the user-facing tuition id. Keep the
-- Finance source bound to local_id and validate payload identity separately.

begin;

create or replace function public.c5_4_void_tuition_payment(
  p_center_id text,
  p_transaction_id uuid,
  p_source_payment_id text,
  p_source_tuition_id text,
  p_expected_version bigint,
  p_reason text,
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
  v_source_payment_id text := pg_catalog.btrim(coalesce(p_source_payment_id, ''));
  v_source_tuition_id text := pg_catalog.btrim(coalesce(p_source_tuition_id, ''));
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_intent_digest bytea;
  v_existing_result public.finance_command_result%rowtype;
  v_transaction public.finance_transaction%rowtype;
  v_tuition_entity public.center_cloud_entities%rowtype;
  v_tuition_match_count bigint;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if v_actor_user_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED');
  end if;
  if v_center_id = '' or pg_catalog.length(v_center_id) > 160 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_CENTER');
  end if;
  if p_transaction_id is null or p_idempotency_key is null
     or p_expected_version is null or p_expected_version < 1
     or pg_catalog.length(v_source_payment_id) not between 1 and 240
     or pg_catalog.length(v_source_tuition_id) not between 1 and 240
     or pg_catalog.length(v_reason) not between 3 and 500
     or v_source_payment_id ~ '[[:cntrl:]]'
     or v_source_tuition_id ~ '[[:cntrl:]]'
     or v_reason ~ '[[:cntrl:]]' then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
  end if;
  if not public.c5_4_internal_has_finance_access(v_center_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'WRITE_ROLE_REQUIRED');
  end if;

  v_intent_digest := extensions.digest(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'contract_version', 1,
      'operation', 'VOID_TUITION_PAYMENT',
      'center_id', v_center_id,
      'transaction_id', p_transaction_id,
      'source_payment_id', v_source_payment_id,
      'source_tuition_id', v_source_tuition_id,
      'expected_version', p_expected_version,
      'reason', v_reason
    )::text, 'UTF8'),
    'sha256'
  );

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'c5.4.command|' || v_center_id || '|' || v_actor_user_id::text || '|' || p_idempotency_key::text,
    0
  ));
  select * into v_existing_result
  from public.finance_command_result r
  where r.center_id = v_center_id
    and r.actor_user_id = v_actor_user_id
    and r.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing_result.intent_digest <> v_intent_digest then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return v_existing_result.result_snapshot || pg_catalog.jsonb_build_object('replayed', true);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'c5.4.cashbook|' || v_center_id, 0
  ));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'c5.4.transaction|' || v_center_id || '|' || p_transaction_id::text, 0
  ));

  select * into v_transaction
  from public.finance_transaction t
  where t.center_id = v_center_id
    and t.id = p_transaction_id
  for update;
  if not found then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_NOT_FOUND_OR_DENIED');
  end if;
  if v_transaction.version <> p_expected_version then
    return pg_catalog.jsonb_build_object(
      'ok', false,
      'outcome_code', 'VERSION_STALE',
      'current_version', v_transaction.version
    );
  end if;
  if v_transaction.status <> 'POSTED' then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_STATE_CONFLICT');
  end if;
  if v_transaction.source_module <> 'hoc-phi'
     or v_transaction.source_type <> 'tuition-payment'
     or v_transaction.source_payment_id <> v_source_payment_id
     or v_transaction.source_tuition_id <> v_source_tuition_id
     or pg_catalog.btrim(v_transaction.source_student_id) = ''
     or pg_catalog.btrim(v_transaction.source_period_id) = '' then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'PROTECTED_TRANSACTION');
  end if;
  if exists (
    select 1
    from public.finance_reconciliation r
    where r.center_id = v_center_id
      and r.status = 'CLOSED'
      and r.reconciliation_date >= v_transaction.transaction_date
  ) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CLOSED_PERIOD');
  end if;

  select pg_catalog.count(*) into v_tuition_match_count
  from public.center_cloud_entities e
  where e.center_id = v_center_id
    and e.entity_type = 'tuition_record_package'
    and (
      e.local_id = v_source_tuition_id
      or pg_catalog.btrim(coalesce(e.payload->>'id', '')) = v_source_tuition_id
    )
    and e.deleted_at is null;
  if v_tuition_match_count <> 1 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_SOURCE_NOT_FOUND');
  end if;

  select * into v_tuition_entity
  from public.center_cloud_entities e
  where e.center_id = v_center_id
    and e.entity_type = 'tuition_record_package'
    and (
      e.local_id = v_source_tuition_id
      or pg_catalog.btrim(coalesce(e.payload->>'id', '')) = v_source_tuition_id
    )
    and e.deleted_at is null
  for share;
  if not found
     or pg_catalog.btrim(coalesce(v_tuition_entity.payload->>'id', '')) = ''
     or pg_catalog.btrim(coalesce(v_tuition_entity.payload->>'studentId', ''))
       <> v_transaction.source_student_id then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_SOURCE_NOT_FOUND');
  end if;
  if pg_catalog.btrim(coalesce(v_tuition_entity.payload->>'currentTermId', ''))
     <> v_transaction.source_period_id then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_PERIOD_STALE');
  end if;

  v_before := pg_catalog.to_jsonb(v_transaction);
  update public.finance_transaction t
  set status = 'VOIDED',
      voided_at = v_now,
      voided_by = v_actor_user_id,
      version = t.version + 1,
      updated_at = v_now,
      updated_by = v_actor_user_id
  where t.center_id = v_center_id
    and t.id = p_transaction_id
  returning * into v_transaction;
  v_after := pg_catalog.to_jsonb(v_transaction)
    || pg_catalog.jsonb_build_object('_void_reason', v_reason);

  insert into public.finance_audit_event (
    center_id, actor_user_id, action, entity_type, entity_id,
    before_state, after_state, command_idempotency_key
  ) values (
    v_center_id, v_actor_user_id, 'VOID_TUITION_PAYMENT', 'TRANSACTION',
    p_transaction_id, v_before, v_after, p_idempotency_key
  );

  v_result := pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'COMMITTED',
    'center_id', v_center_id,
    'entity_type', 'TRANSACTION',
    'entity_id', p_transaction_id,
    'entity_version', v_transaction.version,
    'source_payment_id', v_source_payment_id,
    'source_tuition_id', v_source_tuition_id,
    'replayed', false
  );
  insert into public.finance_command_result (
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (
    v_center_id, v_actor_user_id, p_idempotency_key, v_intent_digest, v_result
  );
  return v_result;
exception
  when unique_violation then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CONCURRENT_CONFLICT');
end
$function$;

revoke all on function public.c5_4_void_tuition_payment(
  text, uuid, text, text, bigint, text, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.c5_4_void_tuition_payment(
  text, uuid, text, text, bigint, text, uuid
) to authenticated;

comment on function public.c5_4_void_tuition_payment(
  text, uuid, text, text, bigint, text, uuid
) is 'OV1.4 exact-center audited tuition payment void using canonical C5.2 local identity.';

commit;
