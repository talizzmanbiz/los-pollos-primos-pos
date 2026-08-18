-- ============================================================
-- Los Pollos Primos — 0025 Cerrar el correlativo de DTE al exterior
--
-- siguiente_numero_control es SECURITY DEFINER y vive en `public`, así que
-- PostgREST la exponía en /rest/v1/rpc/. Cualquiera con la anon key podía
-- llamarla y consumir correlativos: cada llamada incrementa el contador, y un
-- salto en la numeración de los DTE es justo lo que el MH observa en una
-- fiscalización.
--
-- El único llamador legítimo es la Edge Function emit-dte, que usa el service
-- role y no pasa por estos grants.
-- ============================================================

revoke execute on function public.siguiente_numero_control(text) from anon, authenticated, public;
