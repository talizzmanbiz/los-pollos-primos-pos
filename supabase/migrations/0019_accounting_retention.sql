-- ============================================================
-- Los Pollos Primos — 0019 IVA retention (1%) for Grandes Contribuyentes
-- When the business (as GC) retains 1% IVA from a supplier, it pays the
-- supplier (total − retención) and owes the retención to Hacienda (F-14).
-- Opt-in per expense; retention_amount defaults to 0 (no effect).
-- ============================================================

insert into accounting_chart_of_accounts (account_code, account_name, account_type)
values ('2103', 'IVA Retenido por Pagar', 'pasivo')
on conflict (account_code) do nothing;

alter table accounting_transactions_expense
  add column retention_amount numeric(12,2) not null default 0;

-- Expense posting now splits the credit: Caja for cash paid, 2103 for retención.
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

  -- debit: expense base
  v_lines := jsonb_build_array(
    jsonb_build_object('account_code', v_acct, 'debit', new.base_amount_usd, 'credit', 0));

  -- debit: IVA (crédito fiscal if recoverable, else absorbed into the expense)
  if new.iva_creditable and new.iva_amount_usd > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', '1201', 'debit', new.iva_amount_usd, 'credit', 0));
  elsif new.iva_amount_usd > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', v_acct, 'debit', new.iva_amount_usd, 'credit', 0));
  end if;

  -- credit: cash actually paid to supplier (total − retención)
  v_lines := v_lines || jsonb_build_array(
    jsonb_build_object('account_code', '1101', 'debit', 0,
                       'credit', new.total_amount_usd - new.retention_amount));

  -- credit: 1% IVA withheld, owed to Hacienda (F-14)
  if new.retention_amount > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_code', '2103', 'debit', 0, 'credit', new.retention_amount));
  end if;

  perform app.accounting_post_entry(
    new.transaction_date,
    'Gasto ' || new.expense_type::text || coalesce(' - ' || new.supplier_name, ''),
    'expense', new.id, v_lines);
  perform app.accounting_log(
    'accounting_transactions_expense', 'insert', new.id, null, to_jsonb(new), new.created_by);
  return new;
end $$;
