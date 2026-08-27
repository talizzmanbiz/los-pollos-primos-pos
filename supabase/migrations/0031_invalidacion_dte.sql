-- ============================================================
-- Los Pollos Primos — 0031 Registro de invalidaciones de DTE
--
-- Un DTE sellado por el MH no se borra ni se edita: se invalida con un evento
-- aparte, que también se firma y se transmite. El evento es un documento con
-- vida propia (tiene su propio código de generación y su propio sello), así
-- que va en su tabla y no como columnas de dte_documents.
--
-- Se guarda el JSON enviado y la respuesta cruda del MH: cuando Hacienda
-- observa algo meses después, lo único que sirve es el documento tal como se
-- transmitió, no una reconstrucción.
-- ============================================================

create table dte_invalidaciones (
  id uuid primary key default gen_random_uuid(),

  -- El DTE que se está invalidando.
  dte_document_id uuid not null references dte_documents(id) on delete restrict,

  -- Código de generación DEL EVENTO, distinto al del documento invalidado.
  codigo_generacion uuid not null default gen_random_uuid(),

  -- CAT-024: 1 error en la información · 2 rescindir operación · 3 otro
  tipo_anulacion smallint not null check (tipo_anulacion in (1, 2, 3)),
  motivo text,

  -- Sólo para tipo 1: el DTE que reemplaza al invalidado.
  codigo_generacion_reemplazo uuid,

  estado dte_estado not null default 'pendiente',
  sello_recibido text,
  json_evento jsonb,
  json_respuesta jsonb,
  intentos int not null default 0,
  ultimo_error text,

  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un DTE se invalida una sola vez. El índice es parcial porque un intento
-- rechazado debe poder reintentarse con otro evento.
create unique index dte_invalidaciones_documento_uniq
  on dte_invalidaciones (dte_document_id)
  where estado in ('pendiente', 'contingencia', 'procesado');

create index dte_invalidaciones_estado_idx on dte_invalidaciones (estado, created_at);

-- El tipo 1 obliga a informar el documento que reemplaza al invalidado, y los
-- otros dos prohíben informarlo. Se cierra en la base para que no dependa de
-- que quien llame se acuerde.
alter table dte_invalidaciones add constraint dte_invalidaciones_reemplazo_coherente
  check (
    (tipo_anulacion = 1 and codigo_generacion_reemplazo is not null)
    or (tipo_anulacion <> 1 and codigo_generacion_reemplazo is null)
  );

alter table dte_invalidaciones enable row level security;

create policy dte_invalidaciones_lectura on dte_invalidaciones
  for select using (app.is_superadmin() or app.has_role('admin', 'cajero', 'contador', 'auditor'));

create policy dte_invalidaciones_escritura on dte_invalidaciones
  for all using (app.is_superadmin() or app.has_role('admin'))
  with check (app.is_superadmin() or app.has_role('admin'));
