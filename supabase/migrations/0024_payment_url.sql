-- ============================================================
-- Los Pollos Primos — 0024 Guardar el enlace de pago de Wompi
--
-- Hasta ahora el `urlEnlace` que devuelve Wompi se le pasaba al cliente y se
-- perdía. Eso trae dos problemas:
--   · si el cliente pierde el mensaje, no hay forma de reenviarle el mismo link
--   · pedir el link otra vez generaría un SEGUNDO enlace para la misma orden,
--     y si paga los dos, cobramos dos veces
-- Guardarlo hace la operación idempotente: se crea una sola vez por orden.
-- ============================================================

alter table orders add column payment_url text;

comment on column orders.payment_url is
  'urlEnlace devuelto por Wompi. Se crea una sola vez por orden y se reutiliza.';
