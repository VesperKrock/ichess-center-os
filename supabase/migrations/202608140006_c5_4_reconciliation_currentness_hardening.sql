begin;

-- A reconciliation can remain OPEN while later ledger commands are committed.
-- Recompute from the serialized authoritative ledger at the exact CLOSE edge so
-- a stale preview can never become the durable closed balance.
create function public.c5_4_guard_reconciliation_currentness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_opening_balance_minor bigint;
  v_opening_date date;
  v_system_closing_balance numeric;
  v_difference numeric;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'c5.4.cashbook|' || new.center_id, 0
  ));

  if exists (
    select 1
    from public.finance_reconciliation r
    where r.center_id = new.center_id
      and r.id <> new.id
      and r.status = 'CLOSED'
      and r.reconciliation_date >= new.reconciliation_date
  ) then
    raise exception using
      errcode = '23514',
      message = 'c5_4_closed_period_reconciliation_denied';
  end if;

  if tg_op = 'UPDATE' then
    if old.status = 'OPEN' and new.status = 'CLOSED' then
      select coalesce(s.opening_balance_minor, 0),
        coalesce(s.opening_date, (
          select pg_catalog.min(t.transaction_date)
          from public.finance_transaction t
          where t.center_id = new.center_id
            and t.status = 'POSTED'
        ), new.reconciliation_date)
      into v_opening_balance_minor, v_opening_date
      from (select 1) anchor
      left join public.finance_cashbook_settings s
        on s.center_id = new.center_id;

      select v_opening_balance_minor + coalesce(pg_catalog.sum(
        case when t.cashflow_type = 'INCOME' then t.amount_minor else -t.amount_minor end
      ), 0)
      into v_system_closing_balance
      from public.finance_transaction t
      where t.center_id = new.center_id
        and t.status = 'POSTED'
        and t.transaction_date between v_opening_date and new.reconciliation_date;

      v_difference := new.actual_cash_minor - v_system_closing_balance;
      if v_system_closing_balance not between -9007199254740991 and 9007199254740991
         or v_difference not between -9007199254740991 and 9007199254740991 then
        raise exception using
          errcode = '22003',
          message = 'c5_4_reconciliation_money_out_of_safe_range';
      end if;

      new.system_closing_balance_minor := v_system_closing_balance::bigint;
      new.difference_minor := v_difference::bigint;
      new.checked_at := pg_catalog.clock_timestamp();
    end if;
  end if;

  return new;
end
$function$;

revoke all on function public.c5_4_guard_reconciliation_currentness()
  from public, anon, authenticated, service_role;

drop trigger if exists c5_4_guard_reconciliation_currentness
  on public.finance_reconciliation;
create trigger c5_4_guard_reconciliation_currentness
before insert or update on public.finance_reconciliation
for each row execute function public.c5_4_guard_reconciliation_currentness();

commit;
