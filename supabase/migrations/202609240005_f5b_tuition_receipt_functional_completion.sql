begin;

-- F5B functional completion: one canonical pre-payment Tuition Receipt,
-- immutable issuance snapshot and exactly-once linkage to the existing Finance
-- ledger. Printed receipt numbering and all PDF/A5 concerns remain deferred.
do $f5b_receipt_prerequisites$
begin
  if pg_catalog.to_regclass('public.center_tuition_package_cycles') is null
     or pg_catalog.to_regclass('public.finance_transaction') is null
     or pg_catalog.to_regclass('public.crm_contact') is null
     or pg_catalog.to_regclass('public.center_student_recurring_enrollments') is null
     or pg_catalog.to_regprocedure('public.v2_1_list_center_settings(text)') is null
     or pg_catalog.to_regprocedure('public.v2_1_mutate_center_settings(text,jsonb,uuid)') is null
     or pg_catalog.to_regprocedure('public.c5_4_list_finance_shared_truth(text)') is null
     or pg_catalog.to_regprocedure('public.c5_4_void_tuition_payment(text,uuid,text,text,bigint,text,uuid)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p3c_internal_unwrap_contact_source_evidence(text,uuid,integer)') is null
     or pg_catalog.to_regprocedure('public.f23_3e_p4a_internal_parse_payload_v1(bytea)') is null then
    raise exception 'f5b_receipt_prerequisites_missing';
  end if;
end
$f5b_receipt_prerequisites$;

alter table public.center_operational_profiles
  add column renewal_material_fee_minor bigint not null default 80000,
  add constraint center_operational_profiles_renewal_material_fee_check
    check (renewal_material_fee_minor between 0 and 9007199254740991);

comment on column public.center_operational_profiles.renewal_material_fee_minor is
  'Canonical Center Setting: textbook/material fee for renewal receipts. New registration remains zero.';

-- Materialize the schema default for every existing center so Receipt logic
-- always reads canonical Settings authority rather than substituting a local
-- default during issuance.
insert into public.center_operational_profiles(center_id, display_name)
select center_row.id, pg_catalog.left(
  coalesce(nullif(pg_catalog.btrim(center_row.name), ''), center_row.id),
  120
)
from public.centers center_row
on conflict (center_id) do nothing;

create function public.f5b_internal_provision_center_receipt_setting()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.center_operational_profiles(center_id, display_name)
  values (
    new.id,
    pg_catalog.left(
      coalesce(nullif(pg_catalog.btrim(new.name), ''), new.id),
      120
    )
  )
  on conflict (center_id) do nothing;
  return new;
end;
$function$;

create trigger f5b_provision_center_receipt_setting
after insert on public.centers
for each row execute function public.f5b_internal_provision_center_receipt_setting();

-- A receipt Finance row contains the full cash amount. This allocation keeps
-- Tuition progress/debt scoped to tuition only, without creating another row.
alter table public.finance_transaction
  add column tuition_allocation_minor bigint,
  add constraint finance_transaction_tuition_allocation_check check (
    tuition_allocation_minor is null
    or (
      source_module = 'hoc-phi'
      and source_type = 'tuition-payment'
      and tuition_allocation_minor between 0 and amount_minor
    )
  );

comment on column public.finance_transaction.tuition_allocation_minor is
  'Tuition portion of a full receipt collection; NULL means the whole transaction amount is tuition.';

create table public.center_tuition_receipts (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  center_id text not null references public.centers(id) on delete restrict,
  student_local_id text not null,
  tuition_local_id text not null,
  target_cycle_id uuid not null,
  target_period_id text not null,
  target_term_number integer not null check (target_term_number >= 1),
  customer_contact_id uuid,
  registration_classification text not null
    check (registration_classification in ('NEW_REGISTRATION', 'RENEWAL')),
  tuition_amount_minor bigint not null check (tuition_amount_minor between 0 and 9007199254740991),
  discount_amount_minor bigint not null check (
    discount_amount_minor between 0 and tuition_amount_minor
  ),
  material_fee_minor bigint not null check (material_fee_minor between 0 and 9007199254740991),
  total_amount_due_minor bigint not null check (
    total_amount_due_minor between 0 and 9007199254740991
    and total_amount_due_minor = tuition_amount_minor - discount_amount_minor + material_fee_minor
  ),
  snapshot jsonb not null check (pg_catalog.jsonb_typeof(snapshot) = 'object'),
  version bigint not null default 1 check (version >= 1),
  issued_by uuid not null references auth.users(id) on delete restrict,
  issued_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint center_tuition_receipts_center_id_id_unique unique(center_id, id),
  constraint center_tuition_receipts_target_unique unique(center_id, target_cycle_id),
  constraint center_tuition_receipts_cycle_fkey foreign key(center_id, target_cycle_id)
    references public.center_tuition_package_cycles(center_id, id) on delete restrict,
  constraint center_tuition_receipts_contact_fkey foreign key(center_id, customer_contact_id)
    references public.crm_contact(center_id, crm_contact_id) on delete restrict,
  constraint center_tuition_receipts_target_period_check check (
    pg_catalog.length(pg_catalog.btrim(target_period_id)) between 1 and 240
    and target_period_id !~ '[[:cntrl:]]'
  )
);

create index center_tuition_receipts_student_history_idx
  on public.center_tuition_receipts(center_id, student_local_id, target_term_number desc, issued_at desc);

create table public.center_tuition_receipt_payment_links (
  id bigint generated always as identity primary key,
  center_id text not null references public.centers(id) on delete restrict,
  receipt_id uuid not null,
  finance_transaction_id uuid not null,
  attempt_number integer not null check (attempt_number >= 1),
  linked_by uuid not null references auth.users(id) on delete restrict,
  linked_at timestamptz not null default pg_catalog.clock_timestamp(),
  constraint center_tuition_receipt_payment_links_receipt_fkey
    foreign key(center_id, receipt_id)
    references public.center_tuition_receipts(center_id, id) on delete restrict,
  constraint center_tuition_receipt_payment_links_transaction_fkey
    foreign key(center_id, finance_transaction_id)
    references public.finance_transaction(center_id, id) on delete restrict,
  constraint center_tuition_receipt_payment_links_attempt_unique
    unique(center_id, receipt_id, attempt_number),
  constraint center_tuition_receipt_payment_links_transaction_unique
    unique(center_id, finance_transaction_id)
);

create table public.center_tuition_receipt_command_results (
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  idempotency_key uuid not null,
  intent_digest bytea not null check (pg_catalog.octet_length(intent_digest) = 32),
  result_snapshot jsonb not null check (pg_catalog.jsonb_typeof(result_snapshot) = 'object'),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key(center_id, actor_user_id, idempotency_key)
);

create table public.center_tuition_receipt_audit_events (
  id bigint generated always as identity primary key,
  center_id text not null references public.centers(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  receipt_id uuid not null,
  operation text not null check (operation in ('CREATE_RECEIPT', 'CONFIRM_PAID')),
  receipt_version bigint not null check (receipt_version >= 1),
  finance_transaction_id uuid,
  command_idempotency_key uuid not null,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  foreign key(center_id, receipt_id)
    references public.center_tuition_receipts(center_id, id) on delete restrict,
  foreign key(center_id, finance_transaction_id)
    references public.finance_transaction(center_id, id) on delete restrict
);

alter table public.center_tuition_receipts enable row level security;
alter table public.center_tuition_receipts force row level security;
alter table public.center_tuition_receipt_payment_links enable row level security;
alter table public.center_tuition_receipt_payment_links force row level security;
alter table public.center_tuition_receipt_command_results enable row level security;
alter table public.center_tuition_receipt_command_results force row level security;
alter table public.center_tuition_receipt_audit_events enable row level security;
alter table public.center_tuition_receipt_audit_events force row level security;

revoke all on table public.center_tuition_receipts,
  public.center_tuition_receipt_payment_links,
  public.center_tuition_receipt_command_results,
  public.center_tuition_receipt_audit_events
  from public, anon, authenticated, service_role;
grant all on table public.center_tuition_receipts,
  public.center_tuition_receipt_payment_links,
  public.center_tuition_receipt_command_results,
  public.center_tuition_receipt_audit_events to service_role;
grant usage, select on sequence public.center_tuition_receipt_payment_links_id_seq,
  public.center_tuition_receipt_audit_events_id_seq to service_role;

create function public.f5b_internal_guard_receipt_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (pg_catalog.to_jsonb(new) - array['version', 'updated_at'])
     is distinct from (pg_catalog.to_jsonb(old) - array['version', 'updated_at']) then
    raise exception 'f5b_receipt_snapshot_immutable';
  end if;
  if new.version <> old.version + 1 or new.updated_at < old.updated_at then
    raise exception 'f5b_receipt_version_invalid';
  end if;
  return new;
end;
$function$;

create trigger center_tuition_receipts_immutable_guard
before update on public.center_tuition_receipts
for each row execute function public.f5b_internal_guard_receipt_immutable();

create function public.f5b_internal_bump_receipt_on_finance_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status is distinct from old.status then
    update public.center_tuition_receipts receipt
    set version = receipt.version + 1,
        updated_at = pg_catalog.clock_timestamp()
    from public.center_tuition_receipt_payment_links link
    where link.center_id = new.center_id
      and link.finance_transaction_id = new.id
      and receipt.center_id = link.center_id
      and receipt.id = link.receipt_id;
  end if;
  return new;
end;
$function$;

create trigger finance_transaction_receipt_status_sync
after update of status on public.finance_transaction
for each row execute function public.f5b_internal_bump_receipt_on_finance_status();

-- Center Settings retains its existing RPC and idempotency model. The wrapper
-- adds one field to the established profile command/snapshot.
alter function public.v2_1_list_center_settings(text)
  rename to v2_1_list_center_settings_pre_f5b_receipt;
revoke all on function public.v2_1_list_center_settings_pre_f5b_receipt(text)
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
  v_fee bigint;
begin
  v_result := public.v2_1_list_center_settings_pre_f5b_receipt(p_center_id);
  if coalesce(v_result->>'ok', 'false') <> 'true' then return v_result; end if;
  select profile.renewal_material_fee_minor into v_fee
  from public.center_operational_profiles profile
  where profile.center_id = p_center_id;
  return pg_catalog.jsonb_set(
    v_result,
    '{center,renewal_material_fee_minor}',
    pg_catalog.to_jsonb(v_fee),
    true
  );
end;
$function$;

alter function public.v2_1_mutate_center_settings(text,jsonb,uuid)
  rename to v2_1_mutate_center_settings_pre_f5b_receipt;
revoke all on function public.v2_1_mutate_center_settings_pre_f5b_receipt(text,jsonb,uuid)
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
  v_fee bigint;
  v_result jsonb;
  v_result_version integer;
  v_profile public.center_operational_profiles;
begin
  if v_operation = 'UPDATE_CENTER_PROFILE' and p_command ? 'renewal_material_fee_minor' then
    if coalesce(p_command->>'renewal_material_fee_minor', '') !~ '^[0-9]{1,16}$' then
      raise exception 'v2_1_invalid_center_profile';
    end if;
    v_fee := (p_command->>'renewal_material_fee_minor')::bigint;
    if v_fee not between 0 and 9007199254740991 then
      raise exception 'v2_1_invalid_center_profile';
    end if;
  end if;

  v_result := public.v2_1_mutate_center_settings_pre_f5b_receipt(
    p_center_id, p_command, p_idempotency_key
  );
  if coalesce(v_result->>'ok', 'false') <> 'true'
     or v_operation <> 'UPDATE_CENTER_PROFILE'
     or not (p_command ? 'renewal_material_fee_minor') then
    return v_result;
  end if;

  v_result_version := (v_result->>'entity_version')::integer;
  select * into v_profile
  from public.center_operational_profiles profile
  where profile.center_id = p_center_id
  for update;
  -- Initial execution sees the version just committed by the wrapped command.
  -- An exact old replay after later writes must never restore an older fee.
  if v_profile.version = v_result_version then
    update public.center_operational_profiles profile
    set renewal_material_fee_minor = v_fee
    where profile.center_id = p_center_id;
  end if;
  return v_result;
end;
$function$;

alter function public.v2_1_list_center_settings(text) owner to postgres;
alter function public.v2_1_mutate_center_settings(text,jsonb,uuid) owner to postgres;
grant execute on function public.v2_1_list_center_settings(text) to authenticated, service_role;
grant execute on function public.v2_1_mutate_center_settings(text,jsonb,uuid) to authenticated, service_role;

-- Finance reads expose the allocation while preserving the established list
-- contract and exact-center access checks.
alter function public.c5_4_list_finance_shared_truth(text)
  rename to c5_4_list_finance_shared_truth_pre_f5b_receipt;
revoke all on function public.c5_4_list_finance_shared_truth_pre_f5b_receipt(text)
  from public, anon, authenticated, service_role;

create function public.c5_4_list_finance_shared_truth(p_center_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_transactions jsonb;
begin
  v_result := public.c5_4_list_finance_shared_truth_pre_f5b_receipt(p_center_id);
  if coalesce(v_result->>'ok', 'false') <> 'true'
     or pg_catalog.jsonb_typeof(v_result->'transactions') <> 'array' then
    return v_result;
  end if;
  select coalesce(pg_catalog.jsonb_agg(
    item.value || pg_catalog.jsonb_build_object(
      'tuition_allocation_minor', transaction.tuition_allocation_minor
    ) order by item.position
  ), '[]'::jsonb)
  into v_transactions
  from pg_catalog.jsonb_array_elements(v_result->'transactions')
    with ordinality as item(value, position)
  join public.finance_transaction transaction
    on transaction.center_id = p_center_id
   and transaction.id = (item.value->>'id')::uuid;
  return pg_catalog.jsonb_set(v_result, '{transactions}', v_transactions, true);
end;
$function$;

alter function public.c5_4_list_finance_shared_truth(text) owner to postgres;
grant execute on function public.c5_4_list_finance_shared_truth(text) to authenticated;

-- Package-cycle payment progress uses only the tuition allocation; the full
-- cash amount, including materials, remains visible in Finance.
create or replace view public.center_tuition_package_cycle_projection
with (security_invoker = false)
as
select
  cycle.id,
  cycle.center_id,
  cycle.student_local_id,
  cycle.tuition_local_id,
  cycle.cycle_number,
  cycle.predecessor_cycle_id,
  cycle.package_catalog_id,
  cycle.package_name_snapshot,
  cycle.total_sessions_snapshot,
  cycle.price_snapshot,
  cycle.payment_period_id,
  cycle.baseline_used_sessions,
  cycle.baseline_cutoff_date,
  cycle.baseline_review_note,
  cycle.lifecycle_status,
  cycle.origin,
  cycle.bcht_status,
  cycle.bcht_note,
  cycle.bcht_completed_at,
  cycle.bcht_completed_by,
  cycle.version,
  cycle.created_by,
  cycle.updated_by,
  cycle.created_at,
  cycle.updated_at,
  coalesce(contribution.applied_sessions, 0)::integer as contributed_sessions,
  coalesce(contribution.pending_sessions, 0)::integer as pending_sessions,
  (cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer)::integer as used_sessions,
  case when cycle.total_sessions_snapshot is null then null
    else greatest(cycle.total_sessions_snapshot - cycle.baseline_used_sessions
      - coalesce(contribution.applied_sessions, 0)::integer, 0)::integer end as remaining_sessions,
  coalesce(payment.paid_amount, 0)::bigint as paid_amount,
  case when cycle.price_snapshot is null then 'NEEDS_PACKAGE_SELECTION'
    when coalesce(payment.paid_amount, 0) <= 0 then 'UNPAID'
    when coalesce(payment.paid_amount, 0) < cycle.price_snapshot then 'PARTIAL'
    else 'PAID' end as payment_status,
  case
    when cycle.lifecycle_status = 'PREPARED' then 'PENDING_ACTIVATION'
    when cycle.lifecycle_status = 'PROVISIONAL_UNPAID'
      and coalesce(payment.paid_amount, 0) < coalesce(cycle.price_snapshot, 0) then 'PROVISIONAL_UNPAID'
    when cycle.total_sessions_snapshot is null then 'PACKAGE_SELECTION_REQUIRED'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= cycle.total_sessions_snapshot
      and cycle.bcht_status <> 'COMPLETED' then 'PACKAGE_EXHAUSTED_BCHT_DUE'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= cycle.total_sessions_snapshot then 'PACKAGE_EXHAUSTED'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= cycle.total_sessions_snapshot - 2
      and cycle.bcht_status <> 'COMPLETED' then 'BCHT_AND_RENEWAL_DUE'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= cycle.total_sessions_snapshot - 2 then 'RENEWAL_DUE'
    when cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer >= cycle.total_sessions_snapshot - 4
      and cycle.bcht_status <> 'COMPLETED' then 'BCHT_DUE'
    else 'NORMAL'
  end as reminder_state,
  (cycle.bcht_status <> 'COMPLETED' and cycle.total_sessions_snapshot is not null
    and cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer
      >= cycle.total_sessions_snapshot - 4) as bcht_reminder,
  (cycle.total_sessions_snapshot is not null
    and cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer
      >= cycle.total_sessions_snapshot - 2) as renewal_reminder,
  (cycle.total_sessions_snapshot is not null
    and cycle.baseline_used_sessions + coalesce(contribution.applied_sessions, 0)::integer
      >= cycle.total_sessions_snapshot) as urgent_renewal,
  cycle.program_name_snapshot
from public.center_tuition_package_cycles cycle
left join lateral (
  select
    pg_catalog.count(*) filter (where item.allocation_state = 'APPLIED' and item.contribution_units = 1) as applied_sessions,
    pg_catalog.count(*) filter (where item.allocation_state = 'PENDING_PACKAGE_SELECTION' and item.contribution_units = 1) as pending_sessions
  from public.center_tuition_attendance_contributions item
  where item.center_id = cycle.center_id and item.cycle_id = cycle.id and item.ended_at is null
) contribution on true
left join lateral (
  select coalesce(pg_catalog.sum(coalesce(
    transaction.tuition_allocation_minor, transaction.amount_minor
  )), 0) as paid_amount
  from public.finance_transaction transaction
  where transaction.center_id = cycle.center_id and transaction.status = 'POSTED'
    and transaction.source_module = 'hoc-phi' and transaction.source_type = 'tuition-payment'
    and transaction.source_tuition_id = cycle.tuition_local_id
    and transaction.source_period_id = cycle.payment_period_id
) payment on true;

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
  v_fee bigint;
begin
  if v_actor is null then raise exception 'f5b_not_authenticated'; end if;
  select * into v_membership
  from public.v2_4_internal_active_membership(p_center_id, v_actor);
  if v_membership.id is null then raise exception 'f5b_center_access_denied'; end if;
  select profile.renewal_material_fee_minor into v_fee
  from public.center_operational_profiles profile where profile.center_id = p_center_id;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'AUTHORITATIVE_SNAPSHOT',
    'center_id', p_center_id,
    'renewal_material_fee_minor', v_fee,
    'can_write', public.c5_4_internal_has_finance_access(p_center_id),
    'receipts', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', receipt.id,
        'student_id', receipt.student_local_id,
        'tuition_local_id', receipt.tuition_local_id,
        'target_cycle_id', receipt.target_cycle_id,
        'target_period_id', receipt.target_period_id,
        'target_term_number', receipt.target_term_number,
        'customer_contact_id', receipt.customer_contact_id,
        'registration_classification', receipt.registration_classification,
        'tuition_amount_minor', receipt.tuition_amount_minor,
        'discount_amount_minor', receipt.discount_amount_minor,
        'material_fee_minor', receipt.material_fee_minor,
        'total_amount_due_minor', receipt.total_amount_due_minor,
        'snapshot', receipt.snapshot,
        'status', case when exists (
          select 1 from public.center_tuition_receipt_payment_links active_link
          join public.finance_transaction active_transaction
            on active_transaction.center_id = active_link.center_id
           and active_transaction.id = active_link.finance_transaction_id
          where active_link.center_id = receipt.center_id
            and active_link.receipt_id = receipt.id
            and active_transaction.status = 'POSTED'
        ) then 'PAID' else 'WAITING_PAYMENT' end,
        'version', receipt.version,
        'issued_at', receipt.issued_at,
        'updated_at', receipt.updated_at,
        'payments', coalesce((
          select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'attempt_number', link.attempt_number,
            'linked_at', link.linked_at,
            'transaction_id', transaction.id,
            'transaction_code', transaction.transaction_code,
            'transaction_date', transaction.transaction_date,
            'method', transaction.method,
            'amount_minor', transaction.amount_minor,
            'tuition_allocation_minor', coalesce(transaction.tuition_allocation_minor, transaction.amount_minor),
            'status', transaction.status,
            'version', transaction.version,
            'voided_at', transaction.voided_at
          ) order by link.attempt_number desc)
          from public.center_tuition_receipt_payment_links link
          join public.finance_transaction transaction
            on transaction.center_id = link.center_id
           and transaction.id = link.finance_transaction_id
          where link.center_id = receipt.center_id and link.receipt_id = receipt.id
        ), '[]'::jsonb)
      ) order by receipt.issued_at desc, receipt.id)
      from public.center_tuition_receipts receipt
      where receipt.center_id = p_center_id
    ), '[]'::jsonb)
  );
end;
$function$;

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
  v_cycle public.center_tuition_package_cycles;
  v_tuition public.center_cloud_entities;
  v_student public.center_cloud_entities;
  v_center public.centers;
  v_profile public.center_operational_profiles;
  v_contact public.crm_contact;
  v_receipt public.center_tuition_receipts;
  v_receipt_id uuid;
  v_target_cycle_id uuid;
  v_expected_cycle_version bigint;
  v_expected_receipt_version bigint;
  v_contact_id uuid;
  v_email text := '';
  v_payer_name text := '';
  v_schedule_lines jsonb := '[]'::jsonb;
  v_registration text;
  v_registration_label text;
  v_base bigint;
  v_discount_type text := 'none';
  v_discount_value numeric := 0;
  v_discount bigint := 0;
  v_material bigint := 0;
  v_total bigint;
  v_issued_at timestamptz := pg_catalog.clock_timestamp();
  v_snapshot jsonb;
  v_response jsonb;
  v_category public.finance_category;
  v_transaction public.finance_transaction;
  v_transaction_id uuid;
  v_transaction_date date;
  v_method text;
  v_recorded_by text;
  v_attempt integer;
  v_source_payment_id text;
  v_sequence bigint;
  v_transaction_code text;
  v_before jsonb;
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
  select * into v_existing
  from public.center_tuition_receipt_command_results result
  where result.center_id = p_center_id
    and result.actor_user_id = v_actor
    and result.idempotency_key = p_idempotency_key
  for update;
  if found then
    if v_existing.intent_digest <> v_intent then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return v_existing.result_snapshot || pg_catalog.jsonb_build_object('replayed', true);
  end if;

  if v_operation = 'CREATE_RECEIPT' then
    if coalesce(p_command->>'receipt_id', '') !~*
         '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(p_command->>'target_cycle_id', '') !~*
         '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(p_command->>'expected_cycle_version', '') !~ '^[1-9][0-9]*$' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_receipt_id := (p_command->>'receipt_id')::uuid;
    v_target_cycle_id := (p_command->>'target_cycle_id')::uuid;
    v_expected_cycle_version := (p_command->>'expected_cycle_version')::bigint;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'f5b.receipt.cycle|' || p_center_id || '|' || v_target_cycle_id::text, 0
    ));
    select * into v_cycle
    from public.center_tuition_package_cycles cycle
    where cycle.center_id = p_center_id and cycle.id = v_target_cycle_id
    for share;
    if v_cycle.id is null then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_FOUND');
    end if;
    if v_cycle.version <> v_expected_cycle_version then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    if v_cycle.package_catalog_id is null or v_cycle.price_snapshot is null
       or v_cycle.lifecycle_status not in ('ACTIVE', 'PROVISIONAL_UNPAID', 'PREPARED') then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_ELIGIBLE');
    end if;
    if v_cycle.lifecycle_status = 'ACTIVE' and v_cycle.cycle_number > 1 then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_CYCLE_NOT_ELIGIBLE');
    end if;
    if exists (select 1 from public.center_tuition_receipts receipt
      where receipt.center_id = p_center_id and receipt.target_cycle_id = v_cycle.id) then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RECEIPT_ALREADY_EXISTS');
    end if;
    if exists (select 1 from public.finance_transaction transaction
      where transaction.center_id = p_center_id and transaction.status = 'POSTED'
        and transaction.source_module = 'hoc-phi' and transaction.source_type = 'tuition-payment'
        and transaction.source_tuition_id = v_cycle.tuition_local_id
        and transaction.source_period_id = v_cycle.payment_period_id) then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_ALREADY_PAID');
    end if;

    select * into v_tuition from public.center_cloud_entities entity
    where entity.center_id = p_center_id and entity.entity_type = 'tuition_record_package'
      and entity.local_id = v_cycle.tuition_local_id and entity.deleted_at is null
    for share;
    select * into v_student from public.center_cloud_entities entity
    where entity.center_id = p_center_id and entity.entity_type = 'student'
      and entity.local_id = v_cycle.student_local_id and entity.deleted_at is null
    for share;
    if v_tuition.id is null or v_student.id is null
       or coalesce(v_tuition.payload->>'studentId', '') <> v_cycle.student_local_id then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'AUTHORITATIVE_SOURCE_MISSING');
    end if;
    if v_cycle.lifecycle_status <> 'PREPARED'
       and coalesce(v_tuition.payload->>'currentTermId', '') <> v_cycle.payment_period_id then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_PERIOD_STALE');
    end if;

    select * into v_center from public.centers center_row where center_row.id = p_center_id;
    select * into v_profile from public.center_operational_profiles profile
      where profile.center_id = p_center_id;

    select link.crm_contact_id into v_contact_id
    from public.crm_contact_student_operational_link link
    where link.center_id = p_center_id
      and link.student_local_id = v_cycle.student_local_id
      and link.link_status = 'ACTIVE'
    order by case link.financial_contact_role when 'PRIMARY' then 0 when 'SECONDARY' then 1 else 2 end,
      link.is_primary_contact desc, link.updated_at desc, link.link_id
    limit 1;
    if v_contact_id is not null then
      select * into v_contact from public.crm_contact contact
      where contact.center_id = p_center_id
        and contact.crm_contact_id = v_contact_id
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
    v_payer_name := coalesce(nullif(pg_catalog.btrim(v_payer_name), ''),
      nullif(pg_catalog.btrim(coalesce(v_student.payload->>'parentName', '')), ''),
      pg_catalog.btrim(coalesce(v_student.payload->>'fullName', '')));

    select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(schedule_line.label)
      order by schedule_line.label), '[]'::jsonb)
    into v_schedule_lines
    from (
      select distinct coalesce(
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
        and enrollment.ended_at is null
    ) schedule_line;

    v_registration := case when v_cycle.cycle_number = 1
      then 'NEW_REGISTRATION' else 'RENEWAL' end;
    v_registration_label := case when v_registration = 'NEW_REGISTRATION'
      then 'Đăng ký mới' else 'Tái đăng ký' end;
    if coalesce(v_tuition.payload->>'currentTermId', '') = v_cycle.payment_period_id then
      if coalesce(v_tuition.payload->>'totalAmount', '') !~ '^[0-9]+$'
         or coalesce(v_tuition.payload->>'discountAmount', '0') !~ '^[0-9]+$' then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_SOURCE_INVALID');
      end if;
      v_base := (v_tuition.payload->>'totalAmount')::bigint;
      v_discount := least((coalesce(v_tuition.payload->>'discountAmount', '0'))::bigint, v_base);
      v_discount_type := coalesce(nullif(v_tuition.payload->>'discountType', ''), 'none');
      if coalesce(v_tuition.payload->>'discountValue', '0') ~ '^[0-9]+([.][0-9]+)?$' then
        v_discount_value := (coalesce(v_tuition.payload->>'discountValue', '0'))::numeric;
      end if;
    else
      v_base := v_cycle.price_snapshot;
      v_discount := 0;
      v_discount_type := 'none';
      v_discount_value := 0;
    end if;
    if v_registration = 'RENEWAL' and v_profile.center_id is null then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CENTER_SETTINGS_REQUIRED');
    end if;
    v_material := case when v_registration = 'NEW_REGISTRATION' then 0
      else v_profile.renewal_material_fee_minor end;
    v_total := v_base - v_discount + v_material;
    if v_total not between 0 and 9007199254740991 then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RECEIPT_AMOUNT_INVALID');
    end if;

    v_snapshot := pg_catalog.jsonb_build_object(
      'receiptId', v_receipt_id,
      'statusAtIssuance', 'WAITING_PAYMENT',
      'versionAtIssuance', 1,
      'issuedAt', v_issued_at,
      'center', pg_catalog.jsonb_build_object(
        'id', p_center_id,
        'name', coalesce(v_profile.display_name, v_center.name, p_center_id),
        'address', coalesce(v_profile.address, ''),
        'phone', coalesce(v_profile.phone, '')
      ),
      'student', pg_catalog.jsonb_build_object(
        'id', v_cycle.student_local_id,
        'name', pg_catalog.btrim(coalesce(v_student.payload->>'fullName', ''))
      ),
      'customer', pg_catalog.jsonb_build_object(
        'id', v_contact_id,
        'payerName', coalesce(v_payer_name, ''),
        'email', coalesce(v_email, ''),
        'receiptAddress', coalesce(v_contact.receipt_address, ''),
        'cccd', coalesce(v_contact.cccd, '')
      ),
      'registration', pg_catalog.jsonb_build_object(
        'code', v_registration, 'label', v_registration_label
      ),
      'scheduleLines', v_schedule_lines,
      'tuition', pg_catalog.jsonb_build_object(
        'tuitionLocalId', v_cycle.tuition_local_id,
        'targetCycleId', v_cycle.id,
        'targetPeriodId', v_cycle.payment_period_id,
        'termNumber', v_cycle.cycle_number,
        'packageCatalogId', v_cycle.package_catalog_id,
        'packageName', v_cycle.package_name_snapshot,
        'totalSessions', v_cycle.total_sessions_snapshot
      ),
      'money', pg_catalog.jsonb_build_object(
        'tuitionBaseAmount', v_base,
        'discount', pg_catalog.jsonb_build_object(
          'type', v_discount_type,
          'value', v_discount_value,
          'amount', v_discount
        ),
        'materialFee', v_material,
        'totalAmountDue', v_total
      )
    );
    insert into public.center_tuition_receipts(
      id, center_id, student_local_id, tuition_local_id, target_cycle_id,
      target_period_id, target_term_number, customer_contact_id,
      registration_classification, tuition_amount_minor, discount_amount_minor,
      material_fee_minor, total_amount_due_minor, snapshot, version,
      issued_by, issued_at, updated_at
    ) values (
      v_receipt_id, p_center_id, v_cycle.student_local_id, v_cycle.tuition_local_id,
      v_cycle.id, v_cycle.payment_period_id, v_cycle.cycle_number, v_contact_id,
      v_registration, v_base, v_discount, v_material, v_total, v_snapshot, 1,
      v_actor, v_issued_at, v_issued_at
    ) returning * into v_receipt;

  elsif v_operation = 'CONFIRM_PAID' then
    if coalesce(p_command->>'receipt_id', '') !~*
         '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
       or coalesce(p_command->>'expected_version', '') !~ '^[1-9][0-9]*$'
       or coalesce(p_command->>'transaction_date', '') !~ '^\d{4}-\d{2}-\d{2}$' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_receipt_id := (p_command->>'receipt_id')::uuid;
    v_expected_receipt_version := (p_command->>'expected_version')::bigint;
    v_method := pg_catalog.btrim(coalesce(p_command->>'method', ''));
    v_recorded_by := pg_catalog.btrim(coalesce(p_command->>'recorded_by_name', ''));
    begin v_transaction_date := (p_command->>'transaction_date')::date;
    exception when others then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end;
    if pg_catalog.length(v_method) not between 1 and 80
       or pg_catalog.length(v_recorded_by) not between 1 and 300
       or v_method ~ '[[:cntrl:]]' or v_recorded_by ~ '[[:cntrl:]]' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'f5b.receipt|' || p_center_id || '|' || v_receipt_id::text, 0
    ));
    select * into v_receipt from public.center_tuition_receipts receipt
    where receipt.center_id = p_center_id and receipt.id = v_receipt_id
    for update;
    if v_receipt.id is null then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RECEIPT_NOT_FOUND');
    end if;
    if v_receipt.version <> v_expected_receipt_version then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE');
    end if;
    if exists (
      select 1 from public.center_tuition_receipt_payment_links link
      join public.finance_transaction transaction
        on transaction.center_id = link.center_id and transaction.id = link.finance_transaction_id
      where link.center_id = p_center_id and link.receipt_id = v_receipt.id
        and transaction.status = 'POSTED'
    ) then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RECEIPT_ALREADY_PAID');
    end if;
    if v_receipt.total_amount_due_minor < 1 then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'ZERO_AMOUNT_NOT_PAYABLE');
    end if;
    if exists (select 1 from public.finance_transaction transaction
      where transaction.center_id = p_center_id and transaction.status = 'POSTED'
        and transaction.source_module = 'hoc-phi' and transaction.source_type = 'tuition-payment'
        and transaction.source_tuition_id = v_receipt.tuition_local_id
        and transaction.source_period_id = v_receipt.target_period_id) then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TARGET_PAYMENT_CONFLICT');
    end if;
    if exists (select 1 from public.finance_reconciliation reconciliation
      where reconciliation.center_id = p_center_id and reconciliation.status = 'CLOSED'
        and reconciliation.reconciliation_date >= v_transaction_date) then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CLOSED_PERIOD');
    end if;
    select * into v_category from public.finance_category category
    where category.center_id = p_center_id
      and pg_catalog.lower(pg_catalog.btrim(category.name)) = pg_catalog.lower('Học phí')
      and category.category_type in ('INCOME', 'BOTH') and not category.is_archived
    order by category.created_at, category.id limit 1 for share;
    if v_category.id is null then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_CATEGORY_MISSING');
    end if;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'c5.4.cashbook|' || p_center_id, 0
    ));
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'c5.4.transaction-code|' || p_center_id || '|' || v_transaction_date::text, 0
    ));
    select coalesce(pg_catalog.max(pg_catalog.split_part(transaction.transaction_code, '-', 3)::bigint), 0) + 1
      into v_sequence
    from public.finance_transaction transaction
    where transaction.center_id = p_center_id and transaction.transaction_date = v_transaction_date;
    v_transaction_code := 'TC-' || pg_catalog.to_char(v_transaction_date, 'YYYYMMDD') || '-'
      || pg_catalog.lpad(v_sequence::text, 4, '0');
    select coalesce(pg_catalog.max(link.attempt_number), 0) + 1 into v_attempt
    from public.center_tuition_receipt_payment_links link
    where link.center_id = p_center_id and link.receipt_id = v_receipt.id;
    v_transaction_id := pg_catalog.gen_random_uuid();
    v_source_payment_id := 'tuition-receipt:' || v_receipt.id::text || ':' || v_attempt::text;

    insert into public.finance_transaction(
      id, center_id, transaction_code, local_source_id, cashflow_type,
      category_id, category_name_snapshot, amount_minor, tuition_allocation_minor,
      transaction_date, method, person_name, recorded_by_name, note,
      source_module, source_type, source_payment_id, source_tuition_id,
      source_student_id, source_parent_id, source_period_id, created_by, updated_by
    ) values (
      v_transaction_id, p_center_id, v_transaction_code, v_source_payment_id, 'INCOME',
      v_category.id, v_category.name, v_receipt.total_amount_due_minor,
      v_receipt.tuition_amount_minor - v_receipt.discount_amount_minor,
      v_transaction_date, v_method, coalesce(v_receipt.snapshot#>>'{customer,payerName}', ''),
      v_recorded_by, 'Phiếu thu học phí · Kỳ ' || v_receipt.target_term_number,
      'hoc-phi', 'tuition-payment', v_source_payment_id, v_receipt.tuition_local_id,
      v_receipt.student_local_id, coalesce(v_receipt.customer_contact_id::text, ''),
      v_receipt.target_period_id, v_actor, v_actor
    ) returning * into v_transaction;

    insert into public.finance_audit_event(
      center_id, actor_user_id, action, entity_type, entity_id,
      before_state, after_state, command_idempotency_key
    ) values (
      p_center_id, v_actor, 'CREATE_TRANSACTION', 'TRANSACTION', v_transaction.id,
      null, pg_catalog.to_jsonb(v_transaction), p_idempotency_key
    );
    insert into public.center_tuition_receipt_payment_links(
      center_id, receipt_id, finance_transaction_id, attempt_number, linked_by
    ) values (p_center_id, v_receipt.id, v_transaction.id, v_attempt, v_actor);
    update public.center_tuition_receipts receipt
    set version = receipt.version + 1, updated_at = pg_catalog.clock_timestamp()
    where receipt.center_id = p_center_id and receipt.id = v_receipt.id
    returning * into v_receipt;
  else
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_OPERATION');
  end if;

  insert into public.center_tuition_receipt_audit_events(
    center_id, actor_user_id, receipt_id, operation, receipt_version,
    finance_transaction_id, command_idempotency_key
  ) values (
    p_center_id, v_actor, v_receipt.id, v_operation, v_receipt.version,
    case when v_operation = 'CONFIRM_PAID' then v_transaction.id else null end,
    p_idempotency_key
  );
  v_response := pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'COMMITTED',
    'center_id', p_center_id,
    'receipt_id', v_receipt.id,
    'receipt_version', v_receipt.version,
    'receipt_status', case when v_operation = 'CONFIRM_PAID' then 'PAID' else 'WAITING_PAYMENT' end,
    'finance_transaction_id', case when v_operation = 'CONFIRM_PAID' then v_transaction.id else null end,
    'replayed', false
  );
  insert into public.center_tuition_receipt_command_results(
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (p_center_id, v_actor, p_idempotency_key, v_intent, v_response);
  return v_response;
exception
  when unique_violation then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CONCURRENT_CONFLICT');
end;
$function$;

-- Preserve the canonical Finance void function. Its exact receipt-linked
-- fallback permits reversal of a prepared or historical target without
-- opening arbitrary future Tuition periods.
alter function public.c5_4_void_tuition_payment(text,uuid,text,text,bigint,text,uuid)
  rename to c5_4_void_tuition_payment_pre_f5b_receipt;
revoke all on function public.c5_4_void_tuition_payment_pre_f5b_receipt(
  text,uuid,text,text,bigint,text,uuid
) from public, anon, authenticated, service_role;

create function public.c5_4_void_tuition_payment(
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
  v_result jsonb;
  v_actor uuid := auth.uid();
  v_transaction public.finance_transaction;
  v_existing public.finance_command_result;
  v_intent bytea;
  v_before jsonb;
  v_after jsonb;
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_now timestamptz := pg_catalog.clock_timestamp();
begin
  v_result := public.c5_4_void_tuition_payment_pre_f5b_receipt(
    p_center_id, p_transaction_id, p_source_payment_id, p_source_tuition_id,
    p_expected_version, p_reason, p_idempotency_key
  );
  if coalesce(v_result->>'outcome_code', '') <> 'TUITION_PERIOD_STALE' then
    return v_result;
  end if;
  if v_actor is null or p_idempotency_key is null
     or pg_catalog.length(v_reason) not between 3 and 500
     or v_reason ~ '[[:cntrl:]]'
     or not public.c5_4_internal_has_finance_access(p_center_id) then
    return v_result;
  end if;

  v_intent := extensions.digest(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'contract_version', 1, 'operation', 'VOID_TUITION_PAYMENT',
    'center_id', pg_catalog.btrim(coalesce(p_center_id, '')),
    'transaction_id', p_transaction_id,
    'source_payment_id', pg_catalog.btrim(coalesce(p_source_payment_id, '')),
    'source_tuition_id', pg_catalog.btrim(coalesce(p_source_tuition_id, '')),
    'expected_version', p_expected_version, 'reason', v_reason
  )::text, 'UTF8'), 'sha256');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'c5.4.command|' || p_center_id || '|' || v_actor::text || '|' || p_idempotency_key::text, 0
  ));
  select * into v_existing from public.finance_command_result result
  where result.center_id = p_center_id and result.actor_user_id = v_actor
    and result.idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.intent_digest <> v_intent then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'IDEMPOTENCY_CONFLICT');
    end if;
    return v_existing.result_snapshot || pg_catalog.jsonb_build_object('replayed', true);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'c5.4.cashbook|' || p_center_id, 0
  ));
  select * into v_transaction from public.finance_transaction transaction
  where transaction.center_id = p_center_id and transaction.id = p_transaction_id
  for update;
  if v_transaction.id is null or v_transaction.version <> p_expected_version
     or v_transaction.status <> 'POSTED'
     or v_transaction.source_module <> 'hoc-phi'
     or v_transaction.source_type <> 'tuition-payment'
     or v_transaction.source_payment_id <> p_source_payment_id
     or v_transaction.source_tuition_id <> p_source_tuition_id
     or not exists (
       select 1 from public.center_tuition_receipt_payment_links link
       join public.center_tuition_receipts receipt
         on receipt.center_id = link.center_id and receipt.id = link.receipt_id
       where link.center_id = p_center_id
         and link.finance_transaction_id = v_transaction.id
         and receipt.tuition_local_id = v_transaction.source_tuition_id
         and receipt.student_local_id = v_transaction.source_student_id
         and receipt.target_period_id = v_transaction.source_period_id
     ) then
    return v_result;
  end if;
  if exists (select 1 from public.finance_reconciliation reconciliation
    where reconciliation.center_id = p_center_id and reconciliation.status = 'CLOSED'
      and reconciliation.reconciliation_date >= v_transaction.transaction_date) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CLOSED_PERIOD');
  end if;
  v_before := pg_catalog.to_jsonb(v_transaction);
  update public.finance_transaction transaction
  set status = 'VOIDED', voided_at = v_now, voided_by = v_actor,
      version = transaction.version + 1, updated_at = v_now, updated_by = v_actor
  where transaction.center_id = p_center_id and transaction.id = p_transaction_id
  returning * into v_transaction;
  v_after := pg_catalog.to_jsonb(v_transaction)
    || pg_catalog.jsonb_build_object('_void_reason', v_reason);
  insert into public.finance_audit_event(
    center_id, actor_user_id, action, entity_type, entity_id,
    before_state, after_state, command_idempotency_key
  ) values (
    p_center_id, v_actor, 'VOID_TUITION_PAYMENT', 'TRANSACTION',
    p_transaction_id, v_before, v_after, p_idempotency_key
  );
  v_result := pg_catalog.jsonb_build_object(
    'ok', true, 'outcome_code', 'COMMITTED', 'center_id', p_center_id,
    'entity_type', 'TRANSACTION', 'entity_id', p_transaction_id,
    'entity_version', v_transaction.version,
    'source_payment_id', p_source_payment_id,
    'source_tuition_id', p_source_tuition_id,
    'replayed', false
  );
  insert into public.finance_command_result(
    center_id, actor_user_id, idempotency_key, intent_digest, result_snapshot
  ) values (p_center_id, v_actor, p_idempotency_key, v_intent, v_result);
  return v_result;
end;
$function$;

alter function public.f5b_internal_guard_receipt_immutable() owner to postgres;
alter function public.f5b_internal_bump_receipt_on_finance_status() owner to postgres;
alter function public.f5b_internal_provision_center_receipt_setting() owner to postgres;
alter function public.f5b_list_tuition_receipts(text) owner to postgres;
alter function public.f5b_mutate_tuition_receipt(text,jsonb,uuid) owner to postgres;
alter function public.c5_4_void_tuition_payment(text,uuid,text,text,bigint,text,uuid) owner to postgres;

revoke all on function public.f5b_internal_guard_receipt_immutable(),
  public.f5b_internal_bump_receipt_on_finance_status(),
  public.f5b_internal_provision_center_receipt_setting(),
  public.f5b_list_tuition_receipts(text),
  public.f5b_mutate_tuition_receipt(text,jsonb,uuid),
  public.c5_4_void_tuition_payment(text,uuid,text,text,bigint,text,uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.f5b_list_tuition_receipts(text),
  public.f5b_mutate_tuition_receipt(text,jsonb,uuid),
  public.c5_4_void_tuition_payment(text,uuid,text,text,bigint,text,uuid)
  to authenticated;

comment on table public.center_tuition_receipts is
  'Canonical pre-payment Tuition Receipt authority with immutable issuance snapshot; status is derived from linked Finance truth.';
comment on table public.center_tuition_receipt_payment_links is
  'Append-only Receipt-to-Finance linkage history. Voided transactions remain for audit and no longer imply PAID.';
comment on function public.f5b_mutate_tuition_receipt(text,jsonb,uuid) is
  'Center-scoped idempotent CREATE_RECEIPT and full-amount CONFIRM_PAID authority; no PDF or printed numbering semantics.';

commit;
