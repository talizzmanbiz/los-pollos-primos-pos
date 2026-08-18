-- ============================================================
-- Los Pollos Primos — 0022 Registro detallado de compras (Anexo F-07 #3)
--
-- accounting_transactions_expense ya guarda base/IVA/total, pero el "ANEXO DE
-- COMPRAS" del Ministerio de Hacienda pide 21 columnas: el desglose entre
-- compras internas / internaciones / importaciones (exentas y gravadas), el DUI
-- del proveedor y los cuatro códigos de renta (tipo de operación, clasificación,
-- sector y tipo de costo/gasto) que entraron en vigencia en febrero 2024.
--
-- Se extiende la tabla existente en vez de crear un registro paralelo: el F-07
-- debe salir de una sola fuente de verdad, si no las cifras se desincronizan.
-- ============================================================

-- Códigos del anexo (ver hoja PARAMETROS de la plantilla oficial).
-- Se guardan como el código puro ('1', '03', '4'); el CSV los emite tal cual.
alter table accounting_transactions_expense
  -- Columna 2: 1=impreso por imprenta, 2=formulario único, 4=DTE
  add column clase_documento text not null default '4'
    check (clase_documento in ('1','2','3','4')),
  -- Columna 3: 03=CCF, 01=factura, 05=nota de crédito, 14=factura sujeto excluido…
  add column tipo_documento_mh text not null default '03'
    check (tipo_documento_mh ~ '^[0-9]{2}$'),

  -- Columnas 7-9: operaciones exentas
  add column compras_exentas numeric(12,2) not null default 0,
  add column internaciones_exentas numeric(12,2) not null default 0,
  add column importaciones_exentas numeric(12,2) not null default 0,
  -- Columnas 11-13: gravadas que NO son compra interna local
  add column internaciones_gravadas numeric(12,2) not null default 0,
  add column importaciones_gravadas_bienes numeric(12,2) not null default 0,
  add column importaciones_gravadas_servicios numeric(12,2) not null default 0,

  -- Columna 16: DUI cuando el proveedor es persona natural sin NIT
  add column supplier_dui text,

  -- Columnas 17-20: códigos de renta
  add column renta_tipo_operacion text not null default '1'
    check (renta_tipo_operacion in ('0','1','2','3','4','8','9')),
  add column renta_clasificacion text not null default '1'
    check (renta_clasificacion in ('0','1','2','8','9')),
  add column renta_sector text not null default '2'
    check (renta_sector in ('0','1','2','3','4','8','9')),
  add column renta_tipo_costo_gasto text not null default '5'
    check (renta_tipo_costo_gasto in ('0','1','2','3','4','5','6','7','8','9')),

  -- Trazabilidad del DTE del proveedor. El código de generación es el UUID que
  -- asigna Hacienda: es único por documento, así que sirve de llave de
  -- idempotencia para la importación automática desde el correo.
  add column codigo_generacion text,
  add column sello_recibido text,
  add column source text not null default 'manual'
    check (source in ('manual','email','pos')),
  add column raw_dte jsonb;

-- Una compra no puede entrar dos veces aunque el correo se escanee varias veces.
create unique index accounting_expense_codgen_idx
  on accounting_transactions_expense (codigo_generacion)
  where codigo_generacion is not null;

comment on column accounting_transactions_expense.base_amount_usd is
  'Compras internas gravadas (columna 10 del anexo). Los demás desgloses van en sus propias columnas.';
comment on column accounting_transactions_expense.codigo_generacion is
  'UUID del DTE del proveedor. Llave de idempotencia del importador de correo.';

-- ---------- proveedores (autocompletar y no re-tipear NIT/códigos) ----------
create table accounting_suppliers (
  id uuid primary key default gen_random_uuid(),
  nit text,
  nrc text,
  dui text,
  name text not null,
  -- valores por defecto que hereda cada compra de este proveedor
  renta_clasificacion text not null default '1',
  renta_sector text not null default '2',
  renta_tipo_costo_gasto text not null default '5',
  expense_type accounting_expense_type not null default 'ingredientes',
  created_at timestamptz not null default now()
);
create unique index accounting_suppliers_nit_idx on accounting_suppliers (nit) where nit is not null;
create index accounting_suppliers_name_idx on accounting_suppliers (lower(name));

alter table accounting_suppliers enable row level security;
create policy suppliers_read on accounting_suppliers
  for select to authenticated using (app.is_superadmin() or app.has_role('admin'));
create policy suppliers_write on accounting_suppliers
  for all to authenticated
  using (app.is_superadmin() or app.has_role('admin'))
  with check (app.is_superadmin() or app.has_role('admin'));
