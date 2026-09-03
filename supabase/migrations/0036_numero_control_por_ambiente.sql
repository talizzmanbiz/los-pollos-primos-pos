-- ============================================================
-- Los Pollos Primos — 0036 El número de control es único POR AMBIENTE
--
-- La 0029 separó los correlativos por ambiente pero dejó la restricción de
-- unicidad global sobre `numero_control`. El resultado no se vio hasta el
-- primer día de producción: los 97 documentos de la certificación ocupan
-- DTE-01-M001P001-...001 a ...097 —ese `01` es el tipo de documento, no el
-- ambiente— así que producción, que arranca en 1, chocaba contra ellos.
--
-- Ocho ventas fallaron con "duplicate key" antes de que se notara.
--
-- Un número de control identifica un documento DENTRO de un ambiente. El de
-- pruebas y el de producción son universos separados: el mismo número en los
-- dos no es un duplicado, es la numeración correcta de cada uno.
-- ============================================================

alter table dte_documents add column if not exists ambiente text;

-- El ambiente ya viaja dentro del documento firmado; para los que aún no se
-- construyeron se toma el de la configuración vigente al crearlos.
update dte_documents
   set ambiente = coalesce(
     json_dte -> 'identificacion' ->> 'ambiente',
     (select ambiente from fiscal_settings),
     '00')
 where ambiente is null;

alter table dte_documents alter column ambiente set not null;
alter table dte_documents alter column ambiente set default '00';

comment on column dte_documents.ambiente is
  'Ambiente del MH en que vive el documento. Necesario porque el numero de '
  'control solo es unico dentro de su ambiente, no entre ambientes.';

alter table dte_documents drop constraint if exists dte_documents_numero_control_key;
alter table dte_documents
  add constraint dte_documents_numero_control_ambiente_key
  unique (ambiente, numero_control);

-- Los intentos fallidos consumieron correlativos: el contador quedó en 17 sin
-- que existiera ningún documento del 2 al 17. Se devuelve al último realmente
-- emitido para que la numeración de producción no arranque con un hueco, que
-- es justo lo que el MH observa.
update dte_correlativos c
   set ultimo = coalesce((
     select max(substring(d.numero_control from '[0-9]{15}$')::bigint)
       from dte_documents d
      where d.ambiente = c.ambiente
        and d.numero_control like 'DTE-' || c.tipo_dte || '-%'
   ), 0)
 where c.ambiente = '01';

-- El ambiente no es un default fijo: es el que estaba vigente al crear el
-- documento. Va en trigger y no en emit-dte para que valga por cualquier
-- camino que inserte, sin redesplegar la función de emisión.
create or replace function app.dte_ambiente_vigente()
returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.ambiente is null or new.ambiente = '00' then
    new.ambiente := coalesce((select ambiente from fiscal_settings), '00');
  end if;
  return new;
end $$;

drop trigger if exists dte_documents_ambiente on dte_documents;
create trigger dte_documents_ambiente
  before insert on dte_documents
  for each row execute function app.dte_ambiente_vigente();
