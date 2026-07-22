-- ============================================================
-- Los Pollos Primos — 0014 Accounting functions + triggers (P0)
-- Auto-posts balanced Libro Diario entries + audit log on every
-- income/expense, and syncs sales from the live POS orders.
-- ============================================================

-- ---------- audit log helper ----------
create or replace function app.accounting_log(
  p_table text, p_action text, p_record_id uuid,
  p_old jsonb, p_new jsonb, p_user uuid default null, p_reason text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into accounting_audit_log (table_name, action, record_id, old_values, new_values, user_id, reason)
  values (p_table, p_action, p_record_id, p_old, p_new, coalesce(p_user, auth.uid()), p_reason);
end $$;

-- ---------- core double-entry posting primitive ----------
-- p_lines = [{account_code, debit, credit}, ...]; raises unless Σdebit = Σcredit.
create or replace function app.accounting_post_entry(
  p_date date, p_description text, p_source_type text, p_source_id uuid, p_lines jsonb
) returns bigint
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_entry bigint;
  v_line int := 0;
  v_debit numeric(12,2);
  v_credit numeric(12,2);
  v_l jsonb;
  v_name text;
begin
  select coalesce(sum(round((e->>'debit')::numeric, 2)), 0),
         coalesce(sum(round((e->>'credit')::numeric, 2)), 0)
    into v_debit, v_credit
    from jsonb_array_elements(p_lines) e;

  if v_debit <> v_credit then
    raise exception 'Asiento descuadrado: débitos % <> créditos %', v_debit, v_credit;
  end if;

  v_entry := nextval('accounting_journal_entry_seq');

  for v_l in select value from jsonb_array_elements(p_lines) loop
    v_line := v_line + 1;
    select account_name into v_name
      from accounting_chart_of_accounts where account_code = v_l->>'account_code';
    if v_name is null then
      raise exception 'Cuenta contable inexistente: %', v_l->>'account_code';
    end if;
    insert into accounting_journal (
      entry_number, line_number, journal_date, account_code, account_name,
      debit_amount, credit_amount, description, source_type, source_id)
    values (
      v_entry, v_line, p_date, v_l->>'account_code', v_name,
      round(coalesce((v_l->>'debit')::numeric, 0), 2),
      round(coalesce((v_l->>'credit')::numeric, 0), 2),
      p_description, p_source_type, p_source_id);
  end loop;

  return v_entry;
end $$;

-- ---------- income → journal + audit ----------
create or replace function app.accounting_income_after_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_cash text := case when new.payment_method = 'wompi' then '1102' else '1101' end;
  v_lines jsonb;
begin
  v_lines := jsonb_build_array(
    jsonb_build_object('account_code', v_cash, 'debit', new.total_amount_usd, 'credit', 0),
    jsonb_build_object('account_code', '4101', 'debit', 0, 'credit', new.base_amount_usd)
  );
  if new.iva_amount_usd > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', '2101', 'debit', 0, 'credit', new.iva_amount_usd));
  end if;

  perform app.accounting_post_entry(
    new.transaction_date,
    'Venta ' || coalesce(new.document_number, new.transaction_type),
    'income', new.id, v_lines);
  perform app.accounting_log(
    'accounting_transactions_income', 'insert', new.id, null, to_jsonb(new), new.created_by);
  return new;
end $$;

create trigger accounting_income_post after insert on accounting_transactions_income
  for each row execute function app.accounting_income_after_insert();

-- ---------- expense → journal + audit ----------
create or replace function app.accounting_expense_after_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_acct text;
  v_lines jsonb;
begin
  v_acct := coalesce(new.account_code, case new.expense_type
    when 'ingredientes' then '5101'
    when 'empaques'     then '5103'
    when 'gas'          then '6101'
    when 'luz'          then '6102'
    when 'agua'         then '6103'
    when 'mod'          then '6104'
    when 'alquiler'     then '6105'
    when 'servicios'    then '6106'
    else '6199' end);

  v_lines := jsonb_build_array(
    jsonb_build_object('account_code', v_acct, 'debit', new.base_amount_usd, 'credit', 0));

  if new.iva_creditable and new.iva_amount_usd > 0 then
    -- recoverable IVA → IVA Crédito Fiscal
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', '1201', 'debit', new.iva_amount_usd, 'credit', 0));
  elsif new.iva_amount_usd > 0 then
    -- non-creditable IVA is absorbed into the expense
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', v_acct, 'debit', new.iva_amount_usd, 'credit', 0));
  end if;

  -- assumed paid from cash (P0 simplification)
  v_lines := v_lines || jsonb_build_array(
    jsonb_build_object('account_code', '1101', 'debit', 0, 'credit', new.total_amount_usd));

  perform app.accounting_post_entry(
    new.transaction_date,
    'Gasto ' || new.expense_type::text || coalesce(' - ' || new.supplier_name, ''),
    'expense', new.id, v_lines);
  perform app.accounting_log(
    'accounting_transactions_expense', 'insert', new.id, null, to_jsonb(new), new.created_by);
  return new;
end $$;

create trigger accounting_expense_post after insert on accounting_transactions_expense
  for each row execute function app.accounting_expense_after_insert();

-- ---------- fiscal immutability: POS-synced income cannot be edited/deleted ----------
create or replace function app.accounting_income_guard() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  if tg_op in ('UPDATE','DELETE') and old.synced_from_pos then
    raise exception 'No se puede modificar un ingreso sincronizado del POS (inmutabilidad fiscal)';
  end if;
  return case tg_op when 'DELETE' then old else new end;
end $$;

create trigger accounting_income_guard before update or delete on accounting_transactions_income
  for each row execute function app.accounting_income_guard();

-- ---------- sync sales from the live POS ----------
-- Idempotent via source_order_id unique; the AFTER INSERT trigger posts each asiento.
create or replace function app.accounting_sync_from_pos(p_since date default null)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_since date := coalesce(p_since, (now() at time zone 'America/El_Salvador')::date - 90);
  v_count int := 0;
  v_o record;
  v_base numeric(12,2);
  v_iva numeric(12,2);
begin
  if not (app.is_superadmin() or app.has_role('admin')) then
    raise exception 'No autorizado';
  end if;

  for v_o in
    select o.* from orders o
     where o.status <> 'cancelled'
       and (o.status = 'completed' or o.payment_status = 'paid')
       and o.total > 0
       and (o.created_at at time zone 'America/El_Salvador')::date >= v_since
       and not exists (
         select 1 from accounting_transactions_income i where i.source_order_id = o.id)
     order by o.created_at
  loop
    v_base := round(v_o.total / 1.13, 2);
    v_iva  := v_o.total - v_base;
    insert into accounting_transactions_income (
      transaction_date, transaction_type, location_id,
      base_amount_usd, iva_amount_usd, total_amount_usd,
      payment_method, customer_name, document_number,
      source_order_id, synced_from_pos, created_by)
    values (
      (v_o.created_at at time zone 'America/El_Salvador')::date, 'venta_pos', v_o.location_id,
      v_base, v_iva, v_o.total,
      case when v_o.payment_method = 'payment_link' then 'wompi' else 'efectivo' end,
      v_o.customer_name, v_o.order_number,
      v_o.id, true, auth.uid());
    v_count := v_count + 1;
  end loop;

  return v_count;
end $$;

-- ---------- grants ----------
revoke all on function app.accounting_log(text, text, uuid, jsonb, jsonb, uuid, text) from public;
revoke all on function app.accounting_post_entry(date, text, text, uuid, jsonb) from public;
revoke all on function app.accounting_sync_from_pos(date) from public;
grant execute on function app.accounting_sync_from_pos(date) to authenticated;

-- Public wrapper exposed to PostgREST (matches close_cash_session/create_transfer pattern):
-- supabase.rpc() targets the public schema; the wrapper delegates to the app.* core.
create or replace function public.accounting_sync_from_pos(p_since date default null)
returns integer
language sql
set search_path to 'public', 'app', 'pg_temp'
as $$
  select app.accounting_sync_from_pos(p_since)
$$;
revoke all on function public.accounting_sync_from_pos(date) from public;
grant execute on function public.accounting_sync_from_pos(date) to authenticated;
