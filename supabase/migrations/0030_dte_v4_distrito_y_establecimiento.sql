-- ============================================================
-- Los Pollos Primos — 0030 Ajustes a los esquemas reales del MH
--
-- Al validar contra los .json oficiales aparecieron dos cosas que rechazaban
-- el 100% de los documentos:
--
-- 1. `emisor.direccion.distrito` es OBLIGATORIO en fe-f-v2 y fe-ccf-v4. La
--    reorganización territorial de 2023 metió el distrito entre municipio y
--    dirección literal, y fiscal_settings no lo tenía.
--
-- 2. El numeroControl debe calzar con:
--        DTE-0X-(M|B|S|P)###P###-{15 dígitos}
--    Los ocho ceros que generábamos con cod_estable_mh/cod_punto_venta_mh en
--    null NO pasan: el bloque exige una letra. Antes se creía que '0000' valía
--    para quien tiene un solo establecimiento; el esquema dice que no.
--
-- M001/P001 es lo que corresponde a un único local que es la casa matriz
-- (M = matriz). Si el MH asignó otros códigos, se cambian acá y el correlativo
-- los toma sin tocar código.
-- ============================================================

alter table fiscal_settings
  add column if not exists distrito text not null default '00';

comment on column fiscal_settings.distrito is
  'Código de distrito (CAT-013 tras la reorganización de 2023). Obligatorio en el DTE.';

-- Un solo establecimiento, casa matriz. Confirmar contra el portal del MH.
update fiscal_settings set
  cod_estable_mh      = coalesce(cod_estable_mh, 'M001'),
  cod_punto_venta_mh  = coalesce(cod_punto_venta_mh, 'P001'),
  cod_estable         = coalesce(cod_estable, 'M001'),
  cod_punto_venta     = coalesce(cod_punto_venta, 'P001')
where id;

-- El correlativo ahora falla RUIDOSAMENTE si los códigos no arman un número de
-- control válido. Antes devolvía uno inválido y el rechazo aparecía recién en
-- el MH, con un mensaje que no apunta a la causa.
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
  v_num text;
begin
  select ambiente, cod_estable_mh, cod_punto_venta_mh
    into v_ambiente, v_estable, v_punto
    from fiscal_settings where id;

  if v_ambiente is null then
    raise exception 'fiscal_settings sin configurar: no se puede emitir DTE';
  end if;

  if v_estable !~ '^[MBSP][0-9]{3}$' or v_punto !~ '^P[0-9]{3}$' then
    raise exception
      'cod_estable_mh (%) o cod_punto_venta_mh (%) no calzan con el formato del MH: el establecimiento va (M|B|S|P) + 3 dígitos y el punto de venta P + 3 dígitos',
      v_estable, v_punto;
  end if;

  -- El UPDATE toma un row lock: dos cajas vendiendo a la vez no pueden
  -- obtener el mismo correlativo (el número de control es único ante el MH).
  insert into dte_correlativos (ambiente, tipo_dte, ultimo)
    values (v_ambiente, p_tipo, 0)
    on conflict (ambiente, tipo_dte) do nothing;

  update dte_correlativos set ultimo = ultimo + 1
   where ambiente = v_ambiente and tipo_dte = p_tipo
  returning ultimo into v_next;

  v_num := 'DTE-' || p_tipo || '-' || v_estable || v_punto || '-'
        || lpad(v_next::text, 15, '0');

  -- Cinturón y tirantes: el patrón completo del esquema, por si algún día
  -- cambia el formato de los códigos.
  if v_num !~ '^DTE-[0-9]{2}-[MBSP][0-9]{3}P[0-9]{3}-[0-9]{15}$' then
    raise exception 'numero de control invalido: %', v_num;
  end if;

  return v_num;
end;
$$;
