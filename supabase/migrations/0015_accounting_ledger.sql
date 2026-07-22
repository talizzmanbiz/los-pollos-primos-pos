-- ============================================================
-- Los Pollos Primos — 0015 Libro Mayor (general ledger) function
-- Per-account opening/period/closing balances for [p_start, p_end).
-- SECURITY INVOKER: relies on the accounting RLS (admin-only) of the
-- underlying tables, so a non-admin caller simply gets no rows.
-- Lives in public so supabase.rpc() reaches it directly.
-- ============================================================

create or replace function public.accounting_ledger(p_start date, p_end date)
returns table (
  account_code text,
  account_name text,
  account_type accounting_account_type,
  opening_balance numeric,
  period_debits numeric,
  period_credits numeric,
  closing_balance numeric
)
language sql
stable
set search_path = public, pg_temp
as $$
  select
    c.account_code,
    c.account_name,
    c.account_type,
    coalesce(sum(j.debit_amount - j.credit_amount)
             filter (where j.journal_date < p_start), 0)                                   as opening_balance,
    coalesce(sum(j.debit_amount)
             filter (where j.journal_date >= p_start and j.journal_date < p_end), 0)        as period_debits,
    coalesce(sum(j.credit_amount)
             filter (where j.journal_date >= p_start and j.journal_date < p_end), 0)        as period_credits,
    coalesce(sum(j.debit_amount - j.credit_amount)
             filter (where j.journal_date < p_end), 0)                                      as closing_balance
  from accounting_chart_of_accounts c
  left join accounting_journal j on j.account_code = c.account_code
  group by c.account_code, c.account_name, c.account_type
  having coalesce(sum(j.debit_amount - j.credit_amount) filter (where j.journal_date < p_end), 0) <> 0
      or coalesce(sum(j.debit_amount)  filter (where j.journal_date >= p_start and j.journal_date < p_end), 0) <> 0
      or coalesce(sum(j.credit_amount) filter (where j.journal_date >= p_start and j.journal_date < p_end), 0) <> 0
  order by c.account_code
$$;

revoke all on function public.accounting_ledger(date, date) from public;
grant execute on function public.accounting_ledger(date, date) to authenticated;
