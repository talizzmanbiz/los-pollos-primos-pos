-- ============================================================
-- Los Pollos Primos — 0016 Month-close locking (fiscal integrity)
-- A period (year_month) can be abierto → revisado → cerrado.
-- Once 'cerrado', no income/expense may be inserted/updated/deleted
-- for that month. Journal/audit rows were already immutable.
-- ============================================================

create type accounting_period_status as enum ('abierto', 'revisado', 'cerrado');

create table accounting_periods (
  year_month date primary key,          -- first day of the month
  status accounting_period_status not null default 'abierto',
  notes text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  closed_by uuid references profiles(id),
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table accounting_periods enable row level security;
create policy periods_read on accounting_periods
  for select to authenticated using (app.is_superadmin() or app.has_role('admin'));

-- ---------- write lock: block changes in a closed month ----------
create or replace function app.accounting_period_lock() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare
  v_date date;
  v_status accounting_period_status;
begin
  v_date := case tg_op when 'DELETE' then old.transaction_date else new.transaction_date end;
  select status into v_status from accounting_periods
   where year_month = date_trunc('month', v_date)::date;
  if v_status = 'cerrado' then
    raise exception 'El período % está cerrado; no se permiten cambios contables', to_char(v_date, 'YYYY-MM');
  end if;
  return case tg_op when 'DELETE' then old else new end;
end $$;

create trigger accounting_income_period_lock
  before insert or update or delete on accounting_transactions_income
  for each row execute function app.accounting_period_lock();
create trigger accounting_expense_period_lock
  before insert or update or delete on accounting_transactions_expense
  for each row execute function app.accounting_period_lock();

-- ---------- set a period's status (admin) ----------
create or replace function app.accounting_set_period(
  p_month date, p_status accounting_period_status, p_notes text default null
) returns accounting_periods
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row accounting_periods%rowtype;
  v_ym date := date_trunc('month', p_month)::date;
begin
  if not (app.is_superadmin() or app.has_role('admin')) then
    raise exception 'No autorizado';
  end if;

  insert into accounting_periods (year_month, status, notes, reviewed_by, reviewed_at, closed_by, closed_at)
  values (
    v_ym, p_status, p_notes,
    case when p_status <> 'abierto' then auth.uid() end,
    case when p_status <> 'abierto' then now() end,
    case when p_status = 'cerrado' then auth.uid() end,
    case when p_status = 'cerrado' then now() end)
  on conflict (year_month) do update set
    status = excluded.status,
    notes = coalesce(excluded.notes, accounting_periods.notes),
    reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at,
    closed_by = excluded.closed_by,
    closed_at = excluded.closed_at
  returning * into v_row;

  perform app.accounting_log('accounting_periods', 'period_' || p_status, null, null, to_jsonb(v_row), auth.uid(), p_notes);
  return v_row;
end $$;

-- public wrapper for supabase.rpc()
create or replace function public.accounting_set_period(
  p_month date, p_status accounting_period_status, p_notes text default null
) returns accounting_periods
language sql
set search_path to 'public', 'app', 'pg_temp'
as $$
  select app.accounting_set_period(p_month, p_status, p_notes)
$$;

revoke all on function app.accounting_set_period(date, accounting_period_status, text) from public;
revoke all on function public.accounting_set_period(date, accounting_period_status, text) from public;
grant execute on function public.accounting_set_period(date, accounting_period_status, text) to authenticated;
