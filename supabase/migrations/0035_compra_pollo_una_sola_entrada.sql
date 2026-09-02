-- ============================================================
-- Los Pollos Primos — 0035 La compra de pollo se registra una sola vez
--
-- Registrar una compra de pollo creaba un gasto contable incompleto: sin NIT
-- del proveedor, sin número de documento y con IVA en cero. Como el anexo F-07
-- exige todo eso, la compra había que volver a capturarla en la pestaña de
-- Compras — la entrada duplicada que se reportó.
--
-- Peor que la molestia: con `iva_amount_usd = 0` no se estaba reclamando el
-- crédito fiscal. En las 6 compras registradas hasta hoy son unos $21 sobre
-- $184.74 de pollo.
--
-- La compra pasa a capturar los datos fiscales, y el trigger arma el gasto
-- completo. Una entrada, todos los campos que pide Hacienda.
-- ============================================================

alter table purchase_batches
  add column if not exists supplier_nit     text,
  add column if not exists document_type    accounting_doc_type not null default 'ccf',
  add column if not exists document_number  text,
  add column if not exists codigo_generacion text,
  -- Si el proveedor cotiza con IVA incluido, la base hay que despejarla; si
  -- cotiza sin IVA (lo normal en un CCF entre contribuyentes), se suma.
  add column if not exists precio_con_iva   boolean not null default false;

comment on column purchase_batches.precio_con_iva is
  'El unit_cost pactado ya trae IVA. Con CCF normalmente es false: el '
  'proveedor cotiza la base y el IVA va aparte en el documento.';

-- ---------- el gasto contable, completo ----------

-- El gasto del F-07 tiene un origen propio para distinguir en el libro lo que
-- ya vino completo desde inventario de lo que se captura a mano.
alter table accounting_transactions_expense
  drop constraint if exists accounting_transactions_expense_source_check;
alter table accounting_transactions_expense
  add constraint accounting_transactions_expense_source_check
  check (source = any (array['manual','email','pos','compra_pollo']));

create or replace function app.purchase_batch_after_insert()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_base numeric;
  v_iva  numeric;
  -- Sin documento fiscal no hay credito que reclamar por mucho que el gasto
  -- sea deducible: un recibo o un sujeto excluido no dan IVA acreditable.
  v_acreditable boolean := new.document_type in ('ccf', 'dte');
  v_tipo_mh text;
  v_es_dte boolean := new.document_type = 'dte'
                      or new.codigo_generacion is not null
                      or coalesce(new.document_number, '') like 'DTE-%';
begin
  if not v_acreditable then
    -- Un sujeto excluido no cobra IVA: desglosarlo inventaria un impuesto que
    -- nadie pago y descuadraria el gasto contra el recibo.
    v_base := new.total_cost;
    v_iva  := 0;
  elsif new.precio_con_iva then
    v_base := round(new.total_cost / 1.13, 2);
    v_iva  := round(new.total_cost - v_base, 2);
  else
    v_base := new.total_cost;
    v_iva  := round(new.total_cost * 0.13, 2);
  end if;

  -- CAT "tipos de documento" del anexo F-07. Es NOT NULL, asi que una compra
  -- sin documento se declara como sujeto excluido (14), que es lo que es.
  v_tipo_mh := case new.document_type
                 when 'ccf'     then '03'
                 when 'dte'     then '03'
                 when 'factura' then '01'
                 when 'ticket'  then '10'
                 else '14'
               end;

  insert into accounting_transactions_expense (
    transaction_date, expense_type, location_id,
    base_amount_usd, iva_amount_usd, total_amount_usd,
    is_deductible, iva_creditable, document_type, document_number,
    supplier_name, supplier_nit, codigo_generacion,
    clase_documento, tipo_documento_mh,
    description, created_by, source
  ) values (
    new.purchase_date, 'ingredientes', new.location_id,
    v_base, v_iva, v_base + v_iva,
    true, v_acreditable, new.document_type, new.document_number,
    new.supplier_name, new.supplier_nit, new.codigo_generacion,
    case when v_es_dte then '4' else '1' end,
    v_tipo_mh,
    'Compra de pollo — ' || new.supplier_name,
    new.created_by, 'compra_pollo'
  );
  return new;
end $$;

comment on function app.purchase_batch_after_insert() is
  'Arma el gasto del F-07 desde la compra de pollo, con IVA acreditable y '
  'datos del documento. Antes lo dejaba a medias y habia que recapturarlo.';
