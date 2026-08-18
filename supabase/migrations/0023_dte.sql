-- ============================================================
-- Los Pollos Primos — 0023 Facturación electrónica (DTE)
--
-- Todas las ventas emiten Documento Tributario Electrónico. El flujo es:
--   POS crea la orden  →  fila en dte_documents (estado 'pendiente')
--   edge fn emit-dte   →  arma el JSON, lo firma en el firmador MH, lo
--                         transmite a api.dtes.mh.gob.sv y guarda el sello
--   n8n                →  envía el PDF/JSON al correo del cliente si lo dio
--
-- La venta NUNCA se bloquea por el MH: si la transmisión falla el documento
-- queda 'pendiente' y se reintenta. Hacienda contempla esto como contingencia.
-- ============================================================

-- ---------- identidad fiscal del emisor (fila única) ----------
create table fiscal_settings (
  id boolean primary key default true check (id),          -- singleton
  ambiente text not null default '00' check (ambiente in ('00','01')), -- 00=prueba, 01=producción
  nit text not null,
  nrc text not null,
  nombre text not null,                    -- razón social
  nombre_comercial text,
  cod_actividad text not null,             -- código CIIU del giro
  desc_actividad text not null,
  tipo_establecimiento text not null default '01',
  departamento text not null,              -- código MH (ej. '02' Santa Ana)
  municipio text not null,
  complemento text not null,               -- dirección literal
  telefono text,
  correo text not null,
  cod_estable_mh text,                     -- 4 chars, asignado por el MH
  cod_estable text,
  cod_punto_venta_mh text,
  cod_punto_venta text,
  -- Resolución/serie de los documentos preimpresos, para los anexos F-07.
  num_resolucion text,
  serie_documento text,
  updated_at timestamptz not null default now()
);

create type dte_estado as enum
  ('pendiente','firmado','procesado','rechazado','contingencia','anulado');

create table dte_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references orders(id) on delete set null,
  tipo_dte text not null default '01' check (tipo_dte ~ '^[0-9]{2}$'), -- 01=factura, 03=CCF
  codigo_generacion uuid not null default gen_random_uuid(),
  numero_control text not null unique,
  fecha_emision date not null,
  hora_emision time not null,

  -- receptor (nulo o parcial en consumidor final)
  receptor_nombre text,
  receptor_nit text,
  receptor_nrc text,
  receptor_correo text,

  total_gravado numeric(12,2) not null default 0,
  total_exento numeric(12,2) not null default 0,
  total_iva numeric(12,2) not null default 0,
  total_pagar numeric(12,2) not null default 0,

  estado dte_estado not null default 'pendiente',
  sello_recibido text,
  json_dte jsonb,                 -- documento tal cual se firmó
  json_respuesta jsonb,           -- respuesta cruda del MH (observaciones incluidas)
  intentos int not null default 0,
  ultimo_error text,
  email_enviado_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index dte_estado_idx on dte_documents (estado, created_at)
  where estado in ('pendiente','contingencia');
create index dte_fecha_idx on dte_documents (fecha_emision, tipo_dte);
-- cola de correos pendientes para n8n
create index dte_email_pendiente_idx on dte_documents (created_at)
  where receptor_correo is not null and email_enviado_at is null and estado = 'procesado';

-- El cliente que pide crédito fiscal da su NIT en caja; sin NIT se le emite
-- factura de consumidor final.
alter table orders add column customer_nit text;

-- ---------- correlativo del número de control ----------
-- Formato MH: DTE-{tipo}-{codEstableMH}{codPuntoVentaMH}-{15 dígitos}
-- El correlativo es continuo por tipo de documento; nunca se reinicia.
create table dte_correlativos (
  tipo_dte text primary key,
  ultimo bigint not null default 0
);

create or replace function siguiente_numero_control(p_tipo text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next bigint;
  v_estable text;
  v_punto text;
begin
  -- El UPDATE toma un row lock: dos cajas vendiendo a la vez no pueden
  -- obtener el mismo correlativo (el número de control es único ante el MH).
  insert into dte_correlativos (tipo_dte, ultimo) values (p_tipo, 0)
    on conflict (tipo_dte) do nothing;
  update dte_correlativos set ultimo = ultimo + 1
   where tipo_dte = p_tipo
  returning ultimo into v_next;

  select coalesce(cod_estable_mh, '0000'), coalesce(cod_punto_venta_mh, '0000')
    into v_estable, v_punto
    from fiscal_settings where id;

  if v_estable is null then
    raise exception 'fiscal_settings sin configurar: no se puede emitir DTE';
  end if;

  return 'DTE-' || p_tipo || '-'
      || lpad(v_estable, 4, '0') || lpad(v_punto, 4, '0') || '-'
      || lpad(v_next::text, 15, '0');
end;
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table fiscal_settings enable row level security;
alter table dte_documents enable row level security;
alter table dte_correlativos enable row level security;

create policy fiscal_read on fiscal_settings
  for select to authenticated using (app.is_superadmin() or app.has_role('admin'));
create policy fiscal_write on fiscal_settings
  for all to authenticated
  using (app.is_superadmin() or app.has_role('admin'))
  with check (app.is_superadmin() or app.has_role('admin'));

-- Cajeros necesitan ver el DTE de la venta que acaban de hacer (para el ticket),
-- pero sólo admin puede corregirlo; la escritura real va por SECURITY DEFINER.
create policy dte_read on dte_documents
  for select to authenticated using (true);
create policy dte_admin_write on dte_documents
  for all to authenticated
  using (app.is_superadmin() or app.has_role('admin'))
  with check (app.is_superadmin() or app.has_role('admin'));

create policy correlativo_read on dte_correlativos
  for select to authenticated using (app.is_superadmin() or app.has_role('admin'));
