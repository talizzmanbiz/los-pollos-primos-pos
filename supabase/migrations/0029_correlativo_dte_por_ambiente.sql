-- ============================================================
-- Los Pollos Primos — 0029 El correlativo del DTE es por ambiente
--
-- dte_correlativos se indexaba sólo por tipo_dte, así que pruebas y producción
-- compartían la misma numeración. Las ~90 facturas que exige el ambiente de
-- pruebas se habrían comido los correlativos 1..90 y la primera factura REAL
-- habría salido con el número 91.
--
-- El MH espera que producción arranque en 1, y los saltos de numeración los
-- observa. El bug sólo se manifestaría el día de salir a producción, que es
-- el peor momento posible para descubrirlo.
--
-- Se corrige ahora que la tabla está vacía: la llave pasa a ser
-- (ambiente, tipo_dte), y el ambiente sale de fiscal_settings, que es la
-- misma fuente que usa el DTE al construirse. Así las dos numeraciones
-- avanzan por separado y cambiar de ambiente no arrastra nada.
-- ============================================================

alter table dte_correlativos
  add column if not exists ambiente text not null default '00'
    check (ambiente in ('00','01'));

alter table dte_correlativos drop constraint dte_correlativos_pkey;
alter table dte_correlativos add primary key (ambiente, tipo_dte);

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
  v_ambiente text;
begin
  select ambiente, coalesce(cod_estable_mh, '0000'), coalesce(cod_punto_venta_mh, '0000')
    into v_ambiente, v_estable, v_punto
    from fiscal_settings where id;

  if v_ambiente is null then
    raise exception 'fiscal_settings sin configurar: no se puede emitir DTE';
  end if;

  -- El UPDATE toma un row lock: dos cajas vendiendo a la vez no pueden
  -- obtener el mismo correlativo (el número de control es único ante el MH).
  insert into dte_correlativos (ambiente, tipo_dte, ultimo)
    values (v_ambiente, p_tipo, 0)
    on conflict (ambiente, tipo_dte) do nothing;

  update dte_correlativos set ultimo = ultimo + 1
   where ambiente = v_ambiente and tipo_dte = p_tipo
  returning ultimo into v_next;

  return 'DTE-' || p_tipo || '-'
      || lpad(v_estable, 4, '0') || lpad(v_punto, 4, '0') || '-'
      || lpad(v_next::text, 15, '0');
end;
$$;
