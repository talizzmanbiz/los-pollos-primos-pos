-- ============================================================
-- Los Pollos Primos — 0026 Correlativo de órdenes a prueba de desfase
--
-- Síntoma: "duplicate key value violates unique constraint
-- orders_order_number_key" al cobrar. La caja queda muerta.
--
-- Causa: order_counters.last_number puede quedar ATRÁS del número más alto que
-- ya existe en orders. Pasó con dos órdenes huérfanas de una etapa anterior
-- (PP-C-0022 del 19-jul y PP-C-0042 del 09-ago) que sobrevivieron con números
-- mayores que toda la secuencia actual. El contador iba en 21, pidió el 22, y
-- el 22 ya existía.
--
-- La función original confiaba ciegamente en el contador. El UPDATE ... RETURNING
-- es atómico y resuelve bien la concurrencia, pero no protege contra un contador
-- que arranca desfasado: datos migrados, un wipe parcial, o una orden insertada
-- con order_number explícito (el trigger sólo lo asigna si viene nulo).
--
-- Arreglo: antes de devolver el número, verificar que esté libre; si no, seguir
-- avanzando el contador. Un desfase deja de ser una caída de caja y pasa a ser
-- un salto en la numeración que se corrige solo y de forma permanente, porque el
-- contador queda adelantado al salir del loop.
--
-- Costo: un EXISTS por venta contra el índice único de order_number. En el caso
-- normal es una sola lectura indexada y sale de inmediato.
-- ============================================================

create or replace function app.next_order_number(p_location uuid) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_n integer;
  v_code text;
  v_num text;
begin
  select code into v_code from locations where id = p_location;

  loop
    update order_counters set last_number = last_number + 1
      where location_id = p_location returning last_number into v_n;

    -- Primera venta de la sucursal: crear el contador y reintentar.
    if not found then
      insert into order_counters (location_id, last_number) values (p_location, 0)
        on conflict (location_id) do nothing;
      continue;
    end if;

    v_num := 'PP-' || v_code || '-' || lpad(v_n::text, 4, '0');

    -- security definer a propósito: la verificación tiene que ver TODAS las
    -- órdenes, no sólo las que deja pasar RLS. Con RLS filtrando, un número
    -- ocupado por otra sucursal o por una orden vieja se vería libre y el
    -- INSERT volvería a reventar.
    exit when not exists (select 1 from orders where order_number = v_num);
  end loop;

  return v_num;
end $$;
