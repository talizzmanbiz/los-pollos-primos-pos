-- ============================================================
-- Los Pollos Primos — 0013 Accounting schema (P0)
-- Ministerio de Hacienda (El Salvador) fiscal layer, additive.
-- Prices are IVA-INCLUSIVE: base = round(total/1.13,2), iva = total-base.
-- Accounting is admin/superadmin only, reusing app.* RLS helpers.
-- Functions + triggers live in 0014.
-- ============================================================

create type accounting_account_type as enum ('activo','pasivo','capital','ingreso','gasto');
create type accounting_expense_type as enum
  ('ingredientes','gas','luz','agua','mod','alquiler','empaques','servicios','otros');
create type accounting_doc_type as enum ('ccf','dte','factura','recibo','ticket','ninguno');

-- ---------- chart of accounts ----------
create table accounting_chart_of_accounts (
  account_code text primary key,
  account_name text not null,
  account_type accounting_account_type not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into accounting_chart_of_accounts (account_code, account_name, account_type) values
  ('1101','Caja y Efectivo','activo'),
  ('1102','Bancos','activo'),
  ('1201','IVA Crédito Fiscal','activo'),
  ('2101','IVA Débito Fiscal','pasivo'),
  ('3101','Capital','capital'),
  ('4101','Ventas de Productos','ingreso'),
  ('4102','Ventas de Chimichurri','ingreso'),
  ('5101','Costo de Ingredientes','gasto'),
  ('5102','Costo de Pollo Crudo','gasto'),
  ('5103','Costo de Empaques','gasto'),
  ('6101','Gasto Gas','gasto'),
  ('6102','Gasto Energía Eléctrica','gasto'),
  ('6103','Gasto Agua','gasto'),
  ('6104','Gasto Mano de Obra','gasto'),
  ('6105','Gasto Alquiler','gasto'),
  ('6106','Gasto Servicios','gasto'),
  ('6199','Otros Gastos','gasto');

-- ---------- income (ventas) ----------
create table accounting_transactions_income (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null default (now() at time zone 'America/El_Salvador')::date,
  transaction_type text not null default 'venta',
  location_id uuid references locations(id),
  base_amount_usd numeric(12,2) not null,
  iva_amount_usd numeric(12,2) not null default 0,
  total_amount_usd numeric(12,2) not null,
  quantity numeric(12,3),
  payment_method text not null default 'efectivo',   -- efectivo | wompi
  customer_name text,
  customer_nit text,
  document_number text,
  source_order_id uuid unique references orders(id),
  synced_from_pos boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint income_totals_balance check (total_amount_usd = base_amount_usd + iva_amount_usd)
);
create index accounting_income_date_idx on accounting_transactions_income (transaction_date);

-- ---------- expense (gastos / compras) ----------
create table accounting_transactions_expense (
  id uuid primary key default gen_random_uuid(),
  transaction_date date not null default (now() at time zone 'America/El_Salvador')::date,
  expense_type accounting_expense_type not null,
  location_id uuid references locations(id),
  base_amount_usd numeric(12,2) not null,
  iva_rate numeric(5,4),
  iva_amount_usd numeric(12,2) not null default 0,
  total_amount_usd numeric(12,2) not null,
  is_deductible boolean not null default true,
  iva_creditable boolean not null default false,
  document_type accounting_doc_type not null default 'ninguno',
  document_number text,
  supplier_name text,
  supplier_nit text,
  description text,
  account_code text references accounting_chart_of_accounts(account_code),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint expense_totals_balance check (total_amount_usd = base_amount_usd + iva_amount_usd)
);
create index accounting_expense_date_idx on accounting_transactions_expense (transaction_date, expense_type);

-- ---------- libro diario (multi-line double-entry) ----------
create sequence accounting_journal_entry_seq;
create table accounting_journal (
  id uuid primary key default gen_random_uuid(),
  entry_number bigint not null,
  line_number int not null,
  journal_date date not null,
  account_code text not null references accounting_chart_of_accounts(account_code),
  account_name text not null,
  debit_amount numeric(12,2) not null default 0,
  credit_amount numeric(12,2) not null default 0,
  description text,
  source_type text,
  source_id uuid,
  created_at timestamptz not null default now()
);
create index accounting_journal_date_idx on accounting_journal (journal_date, entry_number);
create index accounting_journal_entry_idx on accounting_journal (entry_number);

-- ---------- audit log ----------
create table accounting_audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  action text not null,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  user_id uuid,
  reason text,
  created_at timestamptz not null default now()
);
create index accounting_audit_idx on accounting_audit_log (table_name, created_at);

-- ---------- IVA mensual (view, F-07 figures) ----------
create view accounting_iva_monthly with (security_invoker = true) as
with inc as (
  select date_trunc('month', transaction_date)::date as year_month,
         sum(base_amount_usd) as total_sales_base,
         sum(iva_amount_usd)  as iva_debito
    from accounting_transactions_income
   group by 1
),
exp as (
  select date_trunc('month', transaction_date)::date as year_month,
         sum(base_amount_usd) filter (where iva_creditable) as total_purchases_base,
         sum(iva_amount_usd)  filter (where iva_creditable) as iva_credito
    from accounting_transactions_expense
   group by 1
)
select
  coalesce(inc.year_month, exp.year_month)          as year_month,
  coalesce(inc.total_sales_base, 0)                 as total_sales_base,
  coalesce(inc.iva_debito, 0)                       as iva_debito,
  coalesce(exp.total_purchases_base, 0)             as total_purchases_base,
  coalesce(exp.iva_credito, 0)                      as iva_credito,
  coalesce(inc.iva_debito, 0) - coalesce(exp.iva_credito, 0) as iva_neto
from inc
full outer join exp on inc.year_month = exp.year_month;

-- ============================================================
-- RLS — accounting is admin + superadmin only
-- ============================================================
alter table accounting_chart_of_accounts enable row level security;
alter table accounting_transactions_income enable row level security;
alter table accounting_transactions_expense enable row level security;
alter table accounting_journal enable row level security;
alter table accounting_audit_log enable row level security;

-- chart of accounts
create policy coa_read on accounting_chart_of_accounts
  for select to authenticated using (app.is_superadmin() or app.has_role('admin'));
create policy coa_write on accounting_chart_of_accounts
  for all to authenticated
  using (app.is_superadmin() or app.has_role('admin'))
  with check (app.is_superadmin() or app.has_role('admin'));

-- income
create policy income_read on accounting_transactions_income
  for select to authenticated using (app.is_superadmin() or app.has_role('admin'));
create policy income_insert on accounting_transactions_income
  for insert to authenticated with check (app.is_superadmin() or app.has_role('admin'));
create policy income_update on accounting_transactions_income
  for update to authenticated
  using (app.is_superadmin() or app.has_role('admin'))
  with check (app.is_superadmin() or app.has_role('admin'));

-- expense
create policy expense_read on accounting_transactions_expense
  for select to authenticated using (app.is_superadmin() or app.has_role('admin'));
create policy expense_insert on accounting_transactions_expense
  for insert to authenticated with check (app.is_superadmin() or app.has_role('admin'));
create policy expense_update on accounting_transactions_expense
  for update to authenticated
  using (app.is_superadmin() or app.has_role('admin'))
  with check (app.is_superadmin() or app.has_role('admin'));

-- journal + audit: read-only for admins; writes only via SECURITY DEFINER funcs (bypass RLS)
create policy journal_read on accounting_journal
  for select to authenticated using (app.is_superadmin() or app.has_role('admin'));
create policy audit_read on accounting_audit_log
  for select to authenticated using (app.is_superadmin() or app.has_role('admin'));
