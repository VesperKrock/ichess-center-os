begin;

create table public.finance_category (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  name text not null,
  category_type text not null,
  is_archived boolean not null default false,
  version bigint not null default 1,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint finance_category_name_check check (
    pg_catalog.length(pg_catalog.btrim(name)) between 1 and 120
    and name !~ '[[:cntrl:]]'
  ),
  constraint finance_category_type_check check (category_type in ('INCOME', 'EXPENSE', 'BOTH')),
  constraint finance_category_version_check check (version >= 1),
  constraint finance_category_center_id_id_unique unique (center_id, id)
);

create unique index finance_category_center_name_unique_idx
  on public.finance_category (center_id, pg_catalog.lower(pg_catalog.btrim(name)));

create table public.finance_transaction (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  transaction_code text not null,
  local_source_id text not null default '',
  cashflow_type text not null,
  category_id uuid not null,
  category_name_snapshot text not null,
  amount_minor bigint not null,
  transaction_date date not null,
  method text not null,
  person_name text not null default '',
  recorded_by_name text not null default '',
  note text not null default '',
  source_module text not null default 'manual',
  source_type text not null default '',
  source_payment_id text not null default '',
  source_tuition_id text not null default '',
  source_student_id text not null default '',
  source_parent_id text not null default '',
  source_period_id text not null default '',
  status text not null default 'POSTED',
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  voided_by uuid references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  voided_at timestamptz,
  constraint finance_transaction_category_fkey
    foreign key (center_id, category_id)
    references public.finance_category(center_id, id),
  constraint finance_transaction_center_id_id_unique unique (center_id, id),
  constraint finance_transaction_code_unique unique (center_id, transaction_code),
  constraint finance_transaction_code_check check (transaction_code ~ '^TC-[0-9]{8}-[0-9]{4,}$'),
  constraint finance_transaction_local_source_id_check check (
    pg_catalog.length(local_source_id) <= 200 and local_source_id !~ '[[:cntrl:]]'
  ),
  constraint finance_transaction_cashflow_type_check check (cashflow_type in ('INCOME', 'EXPENSE')),
  constraint finance_transaction_amount_minor_check check (
    amount_minor between 1 and 9007199254740991
  ),
  constraint finance_transaction_method_check check (
    pg_catalog.length(pg_catalog.btrim(method)) between 1 and 80 and method !~ '[[:cntrl:]]'
  ),
  constraint finance_transaction_text_size_check check (
    pg_catalog.length(person_name) <= 300
    and pg_catalog.length(recorded_by_name) <= 300
    and pg_catalog.length(note) <= 4000
    and pg_catalog.length(source_module) <= 80
    and pg_catalog.length(source_type) <= 120
    and pg_catalog.length(source_payment_id) <= 240
    and pg_catalog.length(source_tuition_id) <= 240
    and pg_catalog.length(source_student_id) <= 240
    and pg_catalog.length(source_parent_id) <= 240
    and pg_catalog.length(source_period_id) <= 240
  ),
  constraint finance_transaction_status_check check (status in ('POSTED', 'VOIDED')),
  constraint finance_transaction_version_check check (version >= 1),
  constraint finance_transaction_void_check check (
    (status = 'POSTED' and voided_at is null and voided_by is null)
    or (status = 'VOIDED' and voided_at is not null and voided_by is not null)
  )
);

create index finance_transaction_center_date_idx
  on public.finance_transaction (center_id, transaction_date desc, created_at desc);
create unique index finance_transaction_tuition_payment_unique_idx
  on public.finance_transaction (center_id, source_module, source_type, source_payment_id)
  where source_module = 'hoc-phi'
    and source_type = 'tuition-payment'
    and source_payment_id <> '';

create table public.finance_cashbook_settings (
  center_id text primary key references public.centers(id) on delete cascade,
  opening_balance_minor bigint not null,
  opening_date date not null,
  is_configured boolean not null default true,
  updated_by_name text not null default '',
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint finance_cashbook_settings_balance_check check (
    opening_balance_minor between 0 and 9007199254740991
  ),
  constraint finance_cashbook_settings_name_check check (
    pg_catalog.length(updated_by_name) <= 300
  ),
  constraint finance_cashbook_settings_version_check check (version >= 1)
);

create table public.finance_reconciliation (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  reconciliation_date date not null,
  system_closing_balance_minor bigint not null,
  actual_cash_minor bigint not null,
  difference_minor bigint not null,
  status text not null default 'OPEN',
  checked_by_name text not null,
  note text not null default '',
  version bigint not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  closed_by uuid references auth.users(id),
  closed_by_name text,
  checked_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  closed_at timestamptz,
  constraint finance_reconciliation_center_id_id_unique unique (center_id, id),
  constraint finance_reconciliation_center_date_unique unique (center_id, reconciliation_date),
  constraint finance_reconciliation_money_check check (
    actual_cash_minor between 0 and 9007199254740991
    and system_closing_balance_minor between -9007199254740991 and 9007199254740991
    and difference_minor between -9007199254740991 and 9007199254740991
  ),
  constraint finance_reconciliation_status_check check (status in ('OPEN', 'CLOSED')),
  constraint finance_reconciliation_checked_by_check check (
    pg_catalog.length(pg_catalog.btrim(checked_by_name)) between 1 and 300
  ),
  constraint finance_reconciliation_note_check check (pg_catalog.length(note) <= 4000),
  constraint finance_reconciliation_version_check check (version >= 1),
  constraint finance_reconciliation_close_check check (
    (status = 'OPEN' and closed_at is null and closed_by is null)
    or (status = 'CLOSED' and closed_at is not null and closed_by is not null)
  )
);

alter table public.transaction_attachments
  add constraint transaction_attachments_center_id_id_unique unique (center_id, id);

create table public.finance_transaction_attachment_binding (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  transaction_id uuid not null,
  attachment_id uuid not null,
  version bigint not null default 1,
  bound_by uuid not null references auth.users(id),
  unbound_by uuid references auth.users(id),
  bound_at timestamptz not null default clock_timestamp(),
  unbound_at timestamptz,
  constraint finance_transaction_attachment_transaction_fkey
    foreign key (center_id, transaction_id)
    references public.finance_transaction(center_id, id),
  constraint finance_transaction_attachment_attachment_fkey
    foreign key (center_id, attachment_id)
    references public.transaction_attachments(center_id, id),
  constraint finance_transaction_attachment_version_check check (version >= 1),
  constraint finance_transaction_attachment_unbound_check check (
    (unbound_at is null and unbound_by is null)
    or (unbound_at is not null and unbound_by is not null)
  )
);

create unique index finance_transaction_attachment_active_transaction_idx
  on public.finance_transaction_attachment_binding (center_id, transaction_id)
  where unbound_at is null;
create unique index finance_transaction_attachment_active_attachment_idx
  on public.finance_transaction_attachment_binding (center_id, attachment_id)
  where unbound_at is null;

create table public.finance_audit_event (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  command_idempotency_key uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint finance_audit_event_action_check check (
    pg_catalog.length(action) between 1 and 100
  ),
  constraint finance_audit_event_entity_type_check check (
    entity_type in ('CATEGORY', 'TRANSACTION', 'SETTINGS', 'RECONCILIATION', 'ATTACHMENT_BINDING')
  )
);

create index finance_audit_event_center_created_idx
  on public.finance_audit_event (center_id, created_at desc);

create table public.finance_command_result (
  id uuid primary key default gen_random_uuid(),
  center_id text not null references public.centers(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  idempotency_key uuid not null,
  intent_digest bytea not null,
  result_snapshot jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint finance_command_result_scope_unique unique (center_id, actor_user_id, idempotency_key),
  constraint finance_command_result_digest_check check (pg_catalog.octet_length(intent_digest) = 32),
  constraint finance_command_result_snapshot_check check (
    pg_catalog.jsonb_typeof(result_snapshot) = 'object'
    and result_snapshot->>'outcome_code' = 'COMMITTED'
  )
);

do $block$
declare
  v_table text;
begin
  foreach v_table in array array[
    'finance_category',
    'finance_transaction',
    'finance_cashbook_settings',
    'finance_reconciliation',
    'finance_transaction_attachment_binding',
    'finance_audit_event',
    'finance_command_result'
  ] loop
    execute pg_catalog.format('alter table public.%I enable row level security', v_table);
    execute pg_catalog.format('alter table public.%I force row level security', v_table);
    execute pg_catalog.format(
      'revoke all on table public.%I from public, anon, authenticated, service_role',
      v_table
    );
  end loop;
end
$block$;

create function public.c5_4_internal_seed_finance_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.finance_category (center_id, name, category_type)
  values
    (new.id, 'Học phí', 'INCOME'),
    (new.id, 'Sách/tài liệu', 'BOTH'),
    (new.id, 'Lương giáo viên', 'EXPENSE'),
    (new.id, 'Văn phòng phẩm', 'EXPENSE'),
    (new.id, 'Mua vật tư / Kho hàng', 'EXPENSE'),
    (new.id, 'Thuê phòng', 'EXPENSE'),
    (new.id, 'Marketing', 'EXPENSE'),
    (new.id, 'Mua dụng cụ', 'EXPENSE'),
    (new.id, 'Lệ phí giải đấu', 'INCOME'),
    (new.id, 'Khác', 'BOTH')
  on conflict do nothing;
  return new;
end
$function$;

revoke all on function public.c5_4_internal_seed_finance_categories()
  from public, anon, authenticated, service_role;

drop trigger if exists c5_4_seed_finance_categories on public.centers;
create trigger c5_4_seed_finance_categories
after insert on public.centers
for each row execute function public.c5_4_internal_seed_finance_categories();

insert into public.finance_category (center_id, name, category_type)
select c.id, seed.name, seed.category_type
from public.centers c
cross join (values
  ('Học phí', 'INCOME'),
  ('Sách/tài liệu', 'BOTH'),
  ('Lương giáo viên', 'EXPENSE'),
  ('Văn phòng phẩm', 'EXPENSE'),
  ('Mua vật tư / Kho hàng', 'EXPENSE'),
  ('Thuê phòng', 'EXPENSE'),
  ('Marketing', 'EXPENSE'),
  ('Mua dụng cụ', 'EXPENSE'),
  ('Lệ phí giải đấu', 'INCOME'),
  ('Khác', 'BOTH')
) as seed(name, category_type)
on conflict do nothing;

create or replace function public.can_manage_transaction_attachments(requested_center_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select auth.uid() is not null
    and nullif(pg_catalog.btrim(requested_center_id), '') is not null
    and exists (
      select 1
      from public.center_members cm
      join public.centers c on c.id = cm.center_id
      where cm.center_id = requested_center_id
        and cm.user_id = auth.uid()
        and pg_catalog.lower(coalesce(cm.status, 'active')) = 'active'
        and pg_catalog.lower(c.status) = 'active'
        and pg_catalog.lower(pg_catalog.replace(pg_catalog.replace(
          pg_catalog.btrim(coalesce(cm.role, '')), '-', '_'
        ), ' ', '_')) in ('owner', 'admin', 'center_admin', 'qtv')
    );
$function$;

revoke all on function public.can_manage_transaction_attachments(text)
  from public, anon, service_role;
grant execute on function public.can_manage_transaction_attachments(text) to authenticated;

create function public.c5_4_internal_has_finance_access(p_center_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select auth.uid() is not null
    and exists (
      select 1
      from public.center_members cm
      join public.centers c on c.id = cm.center_id
      where cm.center_id = p_center_id
        and cm.user_id = auth.uid()
        and pg_catalog.lower(coalesce(cm.status, 'active')) = 'active'
        and pg_catalog.lower(c.status) = 'active'
        and pg_catalog.lower(cm.role) in ('owner', 'admin', 'center_admin', 'qtv')
    );
$function$;

revoke all on function public.c5_4_internal_has_finance_access(text)
  from public, anon, authenticated, service_role;

create function public.c5_4_guard_bound_attachment_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.finance_transaction_attachment_binding b
    where b.center_id = old.center_id
      and b.attachment_id = old.id
      and b.unbound_at is null
  ) then
    if tg_op = 'DELETE' then
      raise exception 'c5_4_bound_attachment_delete_denied';
    end if;
    if pg_catalog.current_setting('ichess.c5_4_attachment_write', true) <> 'on'
       and row(
         new.transaction_code, new.transaction_date, new.month_key,
         new.amount, new.cashflow_type, new.note
       ) is distinct from row(
         old.transaction_code, old.transaction_date, old.month_key,
         old.amount, old.cashflow_type, old.note
       ) then
      raise exception 'c5_4_bound_attachment_metadata_immutable';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$function$;

revoke all on function public.c5_4_guard_bound_attachment_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists c5_4_guard_bound_attachment_mutation on public.transaction_attachments;
create trigger c5_4_guard_bound_attachment_mutation
before update or delete on public.transaction_attachments
for each row execute function public.c5_4_guard_bound_attachment_mutation();

create function public.c5_4_list_finance_shared_truth(p_center_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_center_id text := pg_catalog.btrim(coalesce(p_center_id, ''));
  v_transactions jsonb;
  v_categories jsonb;
  v_settings jsonb;
  v_reconciliations jsonb;
begin
  if auth.uid() is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED');
  end if;
  if v_center_id = '' or pg_catalog.length(v_center_id) > 160 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_CENTER');
  end if;
  if not public.c5_4_internal_has_finance_access(v_center_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CENTER_ACCESS_DENIED');
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'category_type', c.category_type,
    'is_archived', c.is_archived,
    'version', c.version,
    'created_at', c.created_at,
    'updated_at', c.updated_at
  ) order by c.is_archived, pg_catalog.lower(c.name)), '[]'::jsonb)
  into v_categories
  from public.finance_category c
  where c.center_id = v_center_id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', t.id,
    'local_source_id', t.local_source_id,
    'transaction_code', t.transaction_code,
    'cashflow_type', t.cashflow_type,
    'category_id', t.category_id,
    'category_name', t.category_name_snapshot,
    'amount_minor', t.amount_minor,
    'transaction_date', t.transaction_date,
    'method', t.method,
    'person_name', t.person_name,
    'recorded_by_name', t.recorded_by_name,
    'note', t.note,
    'source_module', t.source_module,
    'source_type', t.source_type,
    'source_payment_id', t.source_payment_id,
    'source_tuition_id', t.source_tuition_id,
    'source_student_id', t.source_student_id,
    'source_parent_id', t.source_parent_id,
    'source_period_id', t.source_period_id,
    'status', t.status,
    'version', t.version,
    'created_at', t.created_at,
    'updated_at', t.updated_at,
    'voided_at', t.voided_at,
    'attachments', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'id', a.id,
        'transaction_code', a.transaction_code,
        'transaction_date', a.transaction_date,
        'amount', a.amount,
        'cashflow_type', a.cashflow_type,
        'note', a.note,
        'original_name', a.original_name,
        'file_name', a.file_name,
        'mime_type', a.mime_type,
        'size_bytes', a.size_bytes,
        'storage_bucket', a.storage_bucket,
        'storage_path', a.storage_path,
        'uploaded_by', a.uploaded_by,
        'uploaded_by_name', a.uploaded_by_name,
        'created_at', a.created_at
      ) order by b.bound_at)
      from public.finance_transaction_attachment_binding b
      join public.transaction_attachments a
        on a.center_id = b.center_id and a.id = b.attachment_id
      where b.center_id = t.center_id
        and b.transaction_id = t.id
        and b.unbound_at is null
    ), '[]'::jsonb)
  ) order by t.transaction_date desc, t.created_at desc), '[]'::jsonb)
  into v_transactions
  from public.finance_transaction t
  where t.center_id = v_center_id
    and t.status = 'POSTED';

  select case when s.center_id is null then null else pg_catalog.jsonb_build_object(
    'opening_balance_minor', s.opening_balance_minor,
    'opening_date', s.opening_date,
    'is_configured', s.is_configured,
    'updated_by_name', s.updated_by_name,
    'version', s.version,
    'created_at', s.created_at,
    'updated_at', s.updated_at
  ) end
  into v_settings
  from (select 1) anchor
  left join public.finance_cashbook_settings s on s.center_id = v_center_id;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id', r.id,
    'reconciliation_date', r.reconciliation_date,
    'system_closing_balance_minor', r.system_closing_balance_minor,
    'actual_cash_minor', r.actual_cash_minor,
    'difference_minor', r.difference_minor,
    'status', r.status,
    'checked_by_name', r.checked_by_name,
    'note', r.note,
    'version', r.version,
    'checked_at', r.checked_at,
    'created_at', r.created_at,
    'updated_at', r.updated_at,
    'closed_at', r.closed_at,
    'closed_by_name', r.closed_by_name
  ) order by r.reconciliation_date desc), '[]'::jsonb)
  into v_reconciliations
  from public.finance_reconciliation r
  where r.center_id = v_center_id;

  return pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'READ_OK',
    'center_id', v_center_id,
    'transactions', v_transactions,
    'categories', v_categories,
    'settings', v_settings,
    'reconciliations', v_reconciliations
  );
end
$function$;

create function public.c5_4_mutate_finance_shared_truth(
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
  v_expected_version bigint;
  v_intent_digest bytea;
  v_existing_result public.finance_command_result%rowtype;
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_id uuid;
  v_category_id uuid;
  v_attachment_id uuid;
  v_category public.finance_category%rowtype;
  v_transaction public.finance_transaction%rowtype;
  v_settings public.finance_cashbook_settings%rowtype;
  v_reconciliation public.finance_reconciliation%rowtype;
  v_attachment public.transaction_attachments%rowtype;
  v_tuition_entity public.center_cloud_entities%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_result jsonb;
  v_name text;
  v_category_type text;
  v_cashflow_type text;
  v_amount_minor bigint;
  v_actual_cash_minor bigint;
  v_system_closing_balance_minor bigint;
  v_transaction_date date;
  v_reconciliation_date date;
  v_opening_date date;
  v_opening_balance_minor bigint;
  v_transaction_code text;
  v_sequence bigint;
  v_attachment_action text;
  v_reconciliation_exists boolean := false;
  v_tuition_total numeric;
  v_tuition_discount numeric;
  v_tuition_payable numeric;
  v_tuition_ledger_paid numeric;
  v_tuition_legacy_paid numeric;
begin
  if v_actor_user_id is null then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'NOT_AUTHENTICATED');
  end if;
  if v_center_id = '' or pg_catalog.length(v_center_id) > 160 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_CENTER');
  end if;
  if p_idempotency_key is null or p_command is null
     or pg_catalog.jsonb_typeof(p_command) <> 'object'
     or pg_catalog.octet_length(pg_catalog.convert_to(p_command::text, 'UTF8')) > 131072 then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_COMMAND');
  end if;
  if not public.c5_4_internal_has_finance_access(v_center_id) then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'WRITE_ROLE_REQUIRED');
  end if;
  if v_operation not in (
    'CREATE_CATEGORY', 'UPDATE_CATEGORY', 'ARCHIVE_CATEGORY',
    'CREATE_TRANSACTION', 'UPDATE_TRANSACTION', 'VOID_TRANSACTION',
    'UPSERT_SETTINGS', 'UPSERT_RECONCILIATION', 'CLOSE_RECONCILIATION'
  ) or coalesce(p_command->>'expected_version', '') !~ '^[0-9]+$' then
    return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_OPERATION');
  end if;
  v_expected_version := (p_command->>'expected_version')::bigint;

  v_intent_digest := extensions.digest(
    pg_catalog.convert_to(pg_catalog.jsonb_build_object(
      'contract_version', 1,
      'center_id', v_center_id,
      'command', p_command
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

  -- One exact-center cashbook lock makes close/reconcile/settings/transaction
  -- decisions serializable without relying on browser timing.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'c5.4.cashbook|' || v_center_id, 0
  ));

  if v_operation in ('CREATE_CATEGORY', 'UPDATE_CATEGORY', 'ARCHIVE_CATEGORY') then
    if coalesce(p_command->>'category_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_id := (p_command->>'category_id')::uuid;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'c5.4.category|' || v_center_id || '|' || v_id::text, 0
    ));

    if v_operation = 'CREATE_CATEGORY' then
      v_name := pg_catalog.btrim(coalesce(p_command->>'name', ''));
      v_category_type := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'category_type', '')));
      if v_expected_version <> 0 or pg_catalog.length(v_name) not between 1 and 120
         or v_name ~ '[[:cntrl:]]' or v_category_type not in ('INCOME', 'EXPENSE', 'BOTH') then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
        'c5.4.category-name|' || v_center_id || '|' || pg_catalog.lower(v_name), 0
      ));
      if exists (select 1 from public.finance_category c where c.center_id = v_center_id
        and pg_catalog.lower(pg_catalog.btrim(c.name)) = pg_catalog.lower(v_name)) then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CATEGORY_NAME_CONFLICT');
      end if;
      if exists (select 1 from public.finance_category c where c.id = v_id) then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CONCURRENT_CONFLICT');
      end if;
      insert into public.finance_category (
        id, center_id, name, category_type, created_by, updated_by
      ) values (
        v_id, v_center_id, v_name, v_category_type, v_actor_user_id, v_actor_user_id
      ) returning * into v_category;
      v_before := null;
    else
      select * into v_category
      from public.finance_category c
      where c.center_id = v_center_id and c.id = v_id
      for update;
      if not found then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_NOT_FOUND_OR_DENIED');
      end if;
      if v_category.version <> v_expected_version then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE', 'current_version', v_category.version);
      end if;
      v_before := pg_catalog.to_jsonb(v_category);
      if v_operation = 'ARCHIVE_CATEGORY' then
        if v_category.is_archived then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_STATE_CONFLICT');
        end if;
        update public.finance_category c
        set is_archived = true, version = c.version + 1,
            updated_by = v_actor_user_id, updated_at = v_now
        where c.id = v_id returning * into v_category;
      else
        v_name := pg_catalog.btrim(coalesce(p_command->>'name', ''));
        v_category_type := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'category_type', '')));
        if v_category.is_archived or pg_catalog.length(v_name) not between 1 and 120
           or v_name ~ '[[:cntrl:]]' or v_category_type not in ('INCOME', 'EXPENSE', 'BOTH') then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
        end if;
        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
          'c5.4.category-name|' || v_center_id || '|' || pg_catalog.lower(v_name), 0
        ));
        if exists (select 1 from public.finance_category c where c.center_id = v_center_id
          and c.id <> v_id and pg_catalog.lower(pg_catalog.btrim(c.name)) = pg_catalog.lower(v_name)) then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CATEGORY_NAME_CONFLICT');
        end if;
        update public.finance_category c
        set name = v_name, category_type = v_category_type, version = c.version + 1,
            updated_by = v_actor_user_id, updated_at = v_now
        where c.id = v_id returning * into v_category;
      end if;
    end if;
    v_after := pg_catalog.to_jsonb(v_category);

  elsif v_operation in ('CREATE_TRANSACTION', 'UPDATE_TRANSACTION', 'VOID_TRANSACTION') then
    if coalesce(p_command->>'transaction_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_id := (p_command->>'transaction_id')::uuid;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'c5.4.transaction|' || v_center_id || '|' || v_id::text, 0
    ));

    if v_operation = 'CREATE_TRANSACTION' then
      if v_expected_version <> 0 or exists (select 1 from public.finance_transaction t where t.id = v_id) then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CONCURRENT_CONFLICT');
      end if;
      v_before := null;
    else
      select * into v_transaction
      from public.finance_transaction t
      where t.center_id = v_center_id and t.id = v_id
      for update;
      if not found then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_NOT_FOUND_OR_DENIED');
      end if;
      if v_transaction.version <> v_expected_version then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE', 'current_version', v_transaction.version);
      end if;
      if v_transaction.status <> 'POSTED' then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_STATE_CONFLICT');
      end if;
      if v_transaction.source_module = 'hoc-phi' then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'PROTECTED_TRANSACTION');
      end if;
      if exists (select 1 from public.finance_reconciliation r where r.center_id = v_center_id
        and r.status = 'CLOSED' and r.reconciliation_date >= v_transaction.transaction_date) then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CLOSED_PERIOD');
      end if;
      v_before := pg_catalog.to_jsonb(v_transaction);
    end if;

    if v_operation = 'VOID_TRANSACTION' then
      update public.finance_transaction t
      set status = 'VOIDED', voided_at = v_now, voided_by = v_actor_user_id,
          version = t.version + 1, updated_at = v_now, updated_by = v_actor_user_id
      where t.center_id = v_center_id and t.id = v_id
      returning * into v_transaction;
    else
      if coalesce(p_command->>'category_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         or coalesce(p_command->>'amount_minor', '') !~ '^[0-9]+$'
         or coalesce(p_command->>'transaction_date', '') !~ '^\d{4}-\d{2}-\d{2}$' then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;
      v_category_id := (p_command->>'category_id')::uuid;
      v_cashflow_type := pg_catalog.upper(pg_catalog.btrim(coalesce(p_command->>'cashflow_type', '')));
      v_amount_minor := (p_command->>'amount_minor')::bigint;
      begin
        v_transaction_date := (p_command->>'transaction_date')::date;
      exception when others then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end;
      if v_cashflow_type not in ('INCOME', 'EXPENSE')
         or v_amount_minor not between 1 and 9007199254740991
         or pg_catalog.length(pg_catalog.btrim(coalesce(p_command->>'method', ''))) not between 1 and 80
         or pg_catalog.length(coalesce(p_command->>'note', '')) > 4000
         or pg_catalog.length(coalesce(p_command->>'local_source_id', '')) > 200 then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;
      select * into v_category
      from public.finance_category c
      where c.center_id = v_center_id and c.id = v_category_id
      for share;
      if not found or v_category.is_archived
         or (v_category.category_type <> 'BOTH' and v_category.category_type <> v_cashflow_type) then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CATEGORY_ARCHIVED');
      end if;
      if exists (select 1 from public.finance_reconciliation r where r.center_id = v_center_id
        and r.status = 'CLOSED' and r.reconciliation_date >= v_transaction_date) then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CLOSED_PERIOD');
      end if;
      if coalesce(p_command->>'source_module', 'manual') = 'hoc-phi'
         and (coalesce(p_command->>'source_type', '') <> 'tuition-payment'
           or pg_catalog.btrim(coalesce(p_command->>'source_payment_id', '')) = ''
           or pg_catalog.btrim(coalesce(p_command->>'source_tuition_id', '')) = ''
           or pg_catalog.btrim(coalesce(p_command->>'source_student_id', '')) = ''
           or pg_catalog.btrim(coalesce(p_command->>'source_period_id', '')) = '') then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;
      if coalesce(p_command->>'source_module', 'manual') = 'hoc-phi' then
        select * into v_tuition_entity
        from public.center_cloud_entities e
        where e.center_id = v_center_id
          and e.entity_type = 'tuition_record_package'
          and e.local_id = p_command->>'source_tuition_id'
          and e.deleted_at is null
        for share;
        if not found
           or coalesce(v_tuition_entity.payload->>'studentId', '') <> p_command->>'source_student_id' then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_SOURCE_NOT_FOUND');
        end if;
        if coalesce(v_tuition_entity.payload->>'currentTermId', '') <> p_command->>'source_period_id' then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_PERIOD_STALE');
        end if;
        if coalesce(v_tuition_entity.payload->>'totalAmount', '') !~ '^[0-9]+([.][0-9]+)?$'
           or coalesce(v_tuition_entity.payload->>'paidAmount', '0') !~ '^[0-9]+([.][0-9]+)?$' then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_SOURCE_INVALID');
        end if;
        v_tuition_total := (v_tuition_entity.payload->>'totalAmount')::numeric;
        v_tuition_legacy_paid := coalesce((v_tuition_entity.payload->>'paidAmount')::numeric, 0);
        if coalesce(v_tuition_entity.payload->>'discountType', 'none') = 'percent' then
          if coalesce(v_tuition_entity.payload->>'discountValue', '0') !~ '^[0-9]+([.][0-9]+)?$' then
            return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_SOURCE_INVALID');
          end if;
          v_tuition_discount := pg_catalog.round(
            v_tuition_total * least(
              greatest((v_tuition_entity.payload->>'discountValue')::numeric, 0::numeric),
              100::numeric
            ) / 100
          );
        elsif coalesce(v_tuition_entity.payload->>'discountType', 'none') = 'amount' then
          if coalesce(v_tuition_entity.payload->>'discountValue', v_tuition_entity.payload->>'discountAmount', '0')
             !~ '^[0-9]+([.][0-9]+)?$' then
            return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_SOURCE_INVALID');
          end if;
          v_tuition_discount := coalesce(
            (v_tuition_entity.payload->>'discountValue')::numeric,
            (v_tuition_entity.payload->>'discountAmount')::numeric,
            0
          );
        else
          v_tuition_discount := 0;
        end if;
        v_tuition_payable := greatest(
          v_tuition_total - least(
            greatest(v_tuition_discount, 0::numeric), v_tuition_total
          ),
          0::numeric
        );
        select coalesce(pg_catalog.sum(t.amount_minor), 0)
          into v_tuition_ledger_paid
        from public.finance_transaction t
        where t.center_id = v_center_id
          and t.status = 'POSTED'
          and t.source_module = 'hoc-phi'
          and t.source_type = 'tuition-payment'
          and t.source_tuition_id = p_command->>'source_tuition_id'
          and t.source_period_id = p_command->>'source_period_id';
        if v_tuition_legacy_paid > v_tuition_ledger_paid then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'TUITION_LEGACY_PAYMENT_UNRECONCILED');
        end if;
        if v_tuition_ledger_paid + v_amount_minor > v_tuition_payable then
          return pg_catalog.jsonb_build_object(
            'ok', false,
            'outcome_code', 'TUITION_PAYMENT_EXCEEDS_OUTSTANDING',
            'outstanding_minor', greatest(
              v_tuition_payable - v_tuition_ledger_paid, 0::numeric
            )
          );
        end if;
      end if;
      if coalesce(p_command->>'source_module', 'manual') = 'hoc-phi'
         and exists (select 1 from public.finance_transaction t
          where t.center_id = v_center_id
            and t.source_module = 'hoc-phi'
            and t.source_type = 'tuition-payment'
            and t.source_payment_id = p_command->>'source_payment_id'
            and t.id <> v_id) then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'SOURCE_TRANSACTION_CONFLICT');
      end if;

      v_attachment_action := pg_catalog.upper(coalesce(p_command->>'attachment_action', 'KEEP'));
      if v_attachment_action not in ('KEEP', 'BIND', 'UNBIND') then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;
      if v_attachment_action = 'BIND' then
        if coalesce(p_command->>'attachment_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
        end if;
        v_attachment_id := (p_command->>'attachment_id')::uuid;
        select * into v_attachment
        from public.transaction_attachments a
        where a.center_id = v_center_id and a.id = v_attachment_id
          and a.uploaded_by = v_actor_user_id
          and a.storage_bucket = 'transaction-images'
          and public.is_valid_transaction_attachment_path(a.center_id, a.storage_path)
        for update;
        if not found then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'ATTACHMENT_NOT_FOUND_OR_DENIED');
        end if;
        if exists (select 1 from public.finance_transaction_attachment_binding b
          where b.center_id = v_center_id and b.attachment_id = v_attachment_id
            and b.transaction_id <> v_id and b.unbound_at is null) then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'ATTACHMENT_ALREADY_BOUND');
        end if;
      end if;

      if v_operation = 'CREATE_TRANSACTION' then
        perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
          'c5.4.transaction-code|' || v_center_id || '|' || v_transaction_date::text, 0
        ));
        select coalesce(pg_catalog.max(pg_catalog.split_part(t.transaction_code, '-', 3)::bigint), 0) + 1
          into v_sequence
        from public.finance_transaction t
        where t.center_id = v_center_id and t.transaction_date = v_transaction_date;
        v_transaction_code := 'TC-' || pg_catalog.to_char(v_transaction_date, 'YYYYMMDD') || '-'
          || pg_catalog.lpad(v_sequence::text, 4, '0');
        insert into public.finance_transaction (
          id, center_id, transaction_code, local_source_id, cashflow_type,
          category_id, category_name_snapshot, amount_minor, transaction_date,
          method, person_name, recorded_by_name, note, source_module, source_type,
          source_payment_id, source_tuition_id, source_student_id, source_parent_id,
          source_period_id, created_by, updated_by
        ) values (
          v_id, v_center_id, v_transaction_code, coalesce(p_command->>'local_source_id', ''),
          v_cashflow_type, v_category_id, v_category.name, v_amount_minor, v_transaction_date,
          pg_catalog.btrim(p_command->>'method'), coalesce(p_command->>'person_name', ''),
          coalesce(p_command->>'recorded_by_name', ''), coalesce(p_command->>'note', ''),
          coalesce(nullif(p_command->>'source_module', ''), 'manual'), coalesce(p_command->>'source_type', ''),
          coalesce(p_command->>'source_payment_id', ''), coalesce(p_command->>'source_tuition_id', ''),
          coalesce(p_command->>'source_student_id', ''), coalesce(p_command->>'source_parent_id', ''),
          coalesce(p_command->>'source_period_id', ''), v_actor_user_id, v_actor_user_id
        ) returning * into v_transaction;
      else
        update public.finance_transaction t
        set cashflow_type = v_cashflow_type,
            category_id = v_category_id,
            category_name_snapshot = v_category.name,
            amount_minor = v_amount_minor,
            transaction_date = v_transaction_date,
            method = pg_catalog.btrim(p_command->>'method'),
            person_name = coalesce(p_command->>'person_name', ''),
            recorded_by_name = coalesce(p_command->>'recorded_by_name', ''),
            note = coalesce(p_command->>'note', ''),
            version = t.version + 1,
            updated_by = v_actor_user_id,
            updated_at = v_now
        where t.center_id = v_center_id and t.id = v_id
        returning * into v_transaction;
      end if;

      if v_attachment_action in ('BIND', 'UNBIND') then
        update public.finance_transaction_attachment_binding b
        set unbound_at = v_now, unbound_by = v_actor_user_id, version = b.version + 1
        where b.center_id = v_center_id and b.transaction_id = v_id and b.unbound_at is null
          and (v_attachment_action = 'UNBIND' or b.attachment_id <> v_attachment_id);
      end if;
      if v_attachment_action = 'BIND' then
        perform pg_catalog.set_config('ichess.c5_4_attachment_write', 'on', true);
        update public.transaction_attachments a
        set transaction_code = v_transaction.transaction_code,
            transaction_date = v_transaction.transaction_date,
            month_key = pg_catalog.to_char(v_transaction.transaction_date, 'YYYY-MM'),
            amount = v_transaction.amount_minor,
            cashflow_type = pg_catalog.lower(v_transaction.cashflow_type),
            note = v_transaction.note
        where a.center_id = v_center_id and a.id = v_attachment_id;
        if not exists (select 1 from public.finance_transaction_attachment_binding b
          where b.center_id = v_center_id and b.transaction_id = v_id
            and b.attachment_id = v_attachment_id and b.unbound_at is null) then
          insert into public.finance_transaction_attachment_binding (
            center_id, transaction_id, attachment_id, bound_by
          ) values (v_center_id, v_id, v_attachment_id, v_actor_user_id);
        end if;
      elsif v_attachment_action = 'KEEP' then
        perform pg_catalog.set_config('ichess.c5_4_attachment_write', 'on', true);
        update public.transaction_attachments a
        set transaction_code = v_transaction.transaction_code,
            transaction_date = v_transaction.transaction_date,
            month_key = pg_catalog.to_char(v_transaction.transaction_date, 'YYYY-MM'),
            amount = v_transaction.amount_minor,
            cashflow_type = pg_catalog.lower(v_transaction.cashflow_type),
            note = v_transaction.note
        from public.finance_transaction_attachment_binding b
        where b.center_id = v_center_id and b.transaction_id = v_id and b.unbound_at is null
          and a.center_id = b.center_id and a.id = b.attachment_id;
      end if;
    end if;
    v_after := pg_catalog.to_jsonb(v_transaction);

  elsif v_operation = 'UPSERT_SETTINGS' then
    if coalesce(p_command->>'opening_balance_minor', '') !~ '^[0-9]+$'
       or coalesce(p_command->>'opening_date', '') !~ '^\d{4}-\d{2}-\d{2}$' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_opening_balance_minor := (p_command->>'opening_balance_minor')::bigint;
    begin
      v_opening_date := (p_command->>'opening_date')::date;
    exception when others then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end;
    if v_opening_balance_minor not between 0 and 9007199254740991
       or pg_catalog.length(coalesce(p_command->>'updated_by_name', '')) > 300 then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    if exists (select 1 from public.finance_reconciliation r
      where r.center_id = v_center_id and r.status = 'CLOSED') then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CLOSED_PERIOD');
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'c5.4.settings|' || v_center_id, 0
    ));
    select * into v_settings from public.finance_cashbook_settings s
    where s.center_id = v_center_id for update;
    if not found then
      if v_expected_version <> 0 then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE', 'current_version', 0);
      end if;
      v_before := null;
      insert into public.finance_cashbook_settings (
        center_id, opening_balance_minor, opening_date, is_configured,
        updated_by_name, created_by, updated_by
      ) values (
        v_center_id, v_opening_balance_minor, v_opening_date, true,
        coalesce(p_command->>'updated_by_name', ''), v_actor_user_id, v_actor_user_id
      ) returning * into v_settings;
    else
      if v_settings.version <> v_expected_version then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE', 'current_version', v_settings.version);
      end if;
      v_before := pg_catalog.to_jsonb(v_settings);
      update public.finance_cashbook_settings s
      set opening_balance_minor = v_opening_balance_minor,
          opening_date = v_opening_date,
          is_configured = true,
          updated_by_name = coalesce(p_command->>'updated_by_name', ''),
          version = s.version + 1,
          updated_by = v_actor_user_id,
          updated_at = v_now
      where s.center_id = v_center_id returning * into v_settings;
    end if;
    v_id := null;
    v_after := pg_catalog.to_jsonb(v_settings);

  elsif v_operation in ('UPSERT_RECONCILIATION', 'CLOSE_RECONCILIATION') then
    if coalesce(p_command->>'reconciliation_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
    end if;
    v_id := (p_command->>'reconciliation_id')::uuid;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
      'c5.4.reconciliation|' || v_center_id || '|' || v_id::text, 0
    ));
    select * into v_reconciliation from public.finance_reconciliation r
    where r.center_id = v_center_id and r.id = v_id for update;
    v_reconciliation_exists := found;

    if v_operation = 'CLOSE_RECONCILIATION' then
      if not v_reconciliation_exists then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RESOURCE_NOT_FOUND_OR_DENIED');
      end if;
      if v_reconciliation.version <> v_expected_version then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE', 'current_version', v_reconciliation.version);
      end if;
      if v_reconciliation.status = 'CLOSED' then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RECONCILIATION_CLOSED');
      end if;
      v_before := pg_catalog.to_jsonb(v_reconciliation);
      update public.finance_reconciliation r
      set status = 'CLOSED', closed_at = v_now, closed_by = v_actor_user_id,
          closed_by_name = r.checked_by_name, version = r.version + 1,
          updated_by = v_actor_user_id, updated_at = v_now
      where r.center_id = v_center_id and r.id = v_id
      returning * into v_reconciliation;
    else
      if coalesce(p_command->>'actual_cash_minor', '') !~ '^[0-9]+$'
         or coalesce(p_command->>'reconciliation_date', '') !~ '^\d{4}-\d{2}-\d{2}$'
         or pg_catalog.length(pg_catalog.btrim(coalesce(p_command->>'checked_by_name', ''))) not between 1 and 300
         or pg_catalog.length(coalesce(p_command->>'note', '')) > 4000 then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end if;
      v_actual_cash_minor := (p_command->>'actual_cash_minor')::bigint;
      begin
        v_reconciliation_date := (p_command->>'reconciliation_date')::date;
      exception when others then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
      end;
      if v_actual_cash_minor not between 0 and 9007199254740991 then
        return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_MONEY');
      end if;
      if v_reconciliation_exists then
        if v_reconciliation.version <> v_expected_version then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'VERSION_STALE', 'current_version', v_reconciliation.version);
        end if;
        if v_reconciliation.status = 'CLOSED' then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'RECONCILIATION_CLOSED');
        end if;
        if v_reconciliation.reconciliation_date <> v_reconciliation_date then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'INVALID_PAYLOAD');
        end if;
        v_before := pg_catalog.to_jsonb(v_reconciliation);
      else
        if v_expected_version <> 0 or exists (select 1 from public.finance_reconciliation r
          where r.center_id = v_center_id and r.reconciliation_date = v_reconciliation_date) then
          return pg_catalog.jsonb_build_object('ok', false, 'outcome_code', 'CONCURRENT_CONFLICT');
        end if;
        v_before := null;
      end if;
      select coalesce(s.opening_balance_minor, 0),
        coalesce(s.opening_date, (
          select pg_catalog.min(t.transaction_date) from public.finance_transaction t
          where t.center_id = v_center_id and t.status = 'POSTED'
        ), v_reconciliation_date)
      into v_opening_balance_minor, v_opening_date
      from (select 1) anchor
      left join public.finance_cashbook_settings s on s.center_id = v_center_id;
      select v_opening_balance_minor + coalesce(pg_catalog.sum(
        case when t.cashflow_type = 'INCOME' then t.amount_minor else -t.amount_minor end
      ), 0)
      into v_system_closing_balance_minor
      from public.finance_transaction t
      where t.center_id = v_center_id and t.status = 'POSTED'
        and t.transaction_date between v_opening_date and v_reconciliation_date;
      if not v_reconciliation_exists then
        insert into public.finance_reconciliation (
          id, center_id, reconciliation_date, system_closing_balance_minor,
          actual_cash_minor, difference_minor, checked_by_name, note,
          created_by, updated_by
        ) values (
          v_id, v_center_id, v_reconciliation_date, v_system_closing_balance_minor,
          v_actual_cash_minor, v_actual_cash_minor - v_system_closing_balance_minor,
          pg_catalog.btrim(p_command->>'checked_by_name'), coalesce(p_command->>'note', ''),
          v_actor_user_id, v_actor_user_id
        ) returning * into v_reconciliation;
      else
        update public.finance_reconciliation r
        set system_closing_balance_minor = v_system_closing_balance_minor,
            actual_cash_minor = v_actual_cash_minor,
            difference_minor = v_actual_cash_minor - v_system_closing_balance_minor,
            checked_by_name = pg_catalog.btrim(p_command->>'checked_by_name'),
            note = coalesce(p_command->>'note', ''),
            checked_at = v_now,
            version = r.version + 1,
            updated_by = v_actor_user_id,
            updated_at = v_now
        where r.center_id = v_center_id and r.id = v_id
        returning * into v_reconciliation;
      end if;
    end if;
    v_after := pg_catalog.to_jsonb(v_reconciliation);
  end if;

  insert into public.finance_audit_event (
    center_id, actor_user_id, action, entity_type, entity_id,
    before_state, after_state, command_idempotency_key
  ) values (
    v_center_id, v_actor_user_id, v_operation,
    case
      when v_operation like '%CATEGORY' then 'CATEGORY'
      when v_operation like '%TRANSACTION' then 'TRANSACTION'
      when v_operation = 'UPSERT_SETTINGS' then 'SETTINGS'
      else 'RECONCILIATION'
    end,
    v_id, v_before, v_after, p_idempotency_key
  );

  v_result := pg_catalog.jsonb_build_object(
    'ok', true,
    'outcome_code', 'COMMITTED',
    'center_id', v_center_id,
    'entity_type', case
      when v_operation like '%CATEGORY' then 'CATEGORY'
      when v_operation like '%TRANSACTION' then 'TRANSACTION'
      when v_operation = 'UPSERT_SETTINGS' then 'SETTINGS'
      else 'RECONCILIATION'
    end,
    'entity_id', coalesce(v_id::text, v_center_id),
    'entity_version', coalesce(
      v_category.version, v_transaction.version, v_settings.version, v_reconciliation.version
    ),
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

revoke all on function public.c5_4_list_finance_shared_truth(text)
  from public, anon, authenticated, service_role;
revoke all on function public.c5_4_mutate_finance_shared_truth(text, jsonb, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.c5_4_list_finance_shared_truth(text) to authenticated;
grant execute on function public.c5_4_mutate_finance_shared_truth(text, jsonb, uuid) to authenticated;

commit;
