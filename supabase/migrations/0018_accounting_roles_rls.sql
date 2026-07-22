-- ============================================================
-- Los Pollos Primos — 0018 wire contador + auditor into accounting RLS
-- Read access to all accounting data for admin/contador/auditor;
-- writes stay admin-only; contador may additionally mark 'revisado'.
-- ============================================================

alter policy coa_read     on accounting_chart_of_accounts   using (app.is_superadmin() or app.has_role('admin','contador','auditor'));
alter policy income_read  on accounting_transactions_income  using (app.is_superadmin() or app.has_role('admin','contador','auditor'));
alter policy expense_read on accounting_transactions_expense using (app.is_superadmin() or app.has_role('admin','contador','auditor'));
alter policy journal_read  on accounting_journal   using (app.is_superadmin() or app.has_role('admin','contador','auditor'));
alter policy audit_read    on accounting_audit_log  using (app.is_superadmin() or app.has_role('admin','contador','auditor'));
alter policy periods_read  on accounting_periods    using (app.is_superadmin() or app.has_role('admin','contador','auditor'));

-- contador can mark a period 'revisado'; closing/reopening stays admin-only
create or replace function app.accounting_set_period(
  p_month date, p_status accounting_period_status, p_notes text default null
) returns accounting_periods
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_row accounting_periods%rowtype;
  v_ym date := date_trunc('month', p_month)::date;
begin
  if p_status = 'revisado' then
    if not (app.is_superadmin() or app.has_role('admin','contador')) then
      raise exception 'No autorizado';
    end if;
  else
    if not (app.is_superadmin() or app.has_role('admin')) then
      raise exception 'No autorizado';
    end if;
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
