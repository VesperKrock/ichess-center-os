-- iCHESS final local product closure
-- Finance remains the sole ledger. Physical drawer verification compares only
-- canonical POSTED cash transactions; transfer/other methods remain in the
-- system ledger but cannot inflate the expected notes/coins in the drawer.

create or replace function public.f5b_final_expected_physical_cash(
  p_center_id text,
  p_reconciliation_date date
)
returns bigint
language sql
stable
security definer
set search_path = ''
as $function$
  with authority as (
    select coalesce(settings.opening_balance_minor, 0)::bigint as opening_balance_minor,
      coalesce(settings.opening_date, (
        select pg_catalog.min(transaction.transaction_date)
        from public.finance_transaction transaction
        where transaction.center_id = p_center_id
          and transaction.status = 'POSTED'
          and pg_catalog.lower(pg_catalog.btrim(transaction.method)) = 'tiền mặt'
      ), p_reconciliation_date) as opening_date
    from (select 1) anchor
    left join public.finance_cashbook_settings settings
      on settings.center_id = p_center_id
  )
  select (authority.opening_balance_minor + coalesce(pg_catalog.sum(
    case when transaction.cashflow_type = 'INCOME'
      then transaction.amount_minor else -transaction.amount_minor end
  ), 0))::bigint
  from authority
  left join public.finance_transaction transaction
    on transaction.center_id = p_center_id
   and transaction.status = 'POSTED'
   and pg_catalog.lower(pg_catalog.btrim(transaction.method)) = 'tiền mặt'
   and transaction.transaction_date between authority.opening_date and p_reconciliation_date
  group by authority.opening_balance_minor;
$function$;

alter function public.f5b_final_expected_physical_cash(text,date) owner to postgres;
revoke all on function public.f5b_final_expected_physical_cash(text,date) from public;
revoke all on function public.f5b_final_expected_physical_cash(text,date) from anon;
revoke all on function public.f5b_final_expected_physical_cash(text,date) from authenticated;

create or replace function public.f5b_final_scope_physical_cash_reconciliation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_expected_cash_minor bigint;
begin
  v_expected_cash_minor := public.f5b_final_expected_physical_cash(
    new.center_id,
    new.reconciliation_date
  );

  new.system_closing_balance_minor := v_expected_cash_minor;
  new.difference_minor := new.actual_cash_minor - v_expected_cash_minor;
  return new;
end;
$function$;

alter function public.f5b_final_scope_physical_cash_reconciliation() owner to postgres;
revoke all on function public.f5b_final_scope_physical_cash_reconciliation() from public;
revoke all on function public.f5b_final_scope_physical_cash_reconciliation() from anon;
revoke all on function public.f5b_final_scope_physical_cash_reconciliation() from authenticated;

drop trigger if exists f5b_final_scope_physical_cash_reconciliation
  on public.finance_reconciliation;
create trigger f5b_final_scope_physical_cash_reconciliation
before insert or update of reconciliation_date, actual_cash_minor, status
on public.finance_reconciliation
for each row execute function public.f5b_final_scope_physical_cash_reconciliation();

comment on function public.f5b_final_scope_physical_cash_reconciliation() is
  'Canonical physical cash verification scope: opening cash plus POSTED Tiền mặt transactions only; non-cash remains in the system ledger.';
