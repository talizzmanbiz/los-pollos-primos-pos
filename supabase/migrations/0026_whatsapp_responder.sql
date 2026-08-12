-- ============================================================
-- Los Pollos Primos — 0022 responder WhatsApp desde el POS
--
-- Al contestarle a un cliente desde /conversaciones hay que callar al bot,
-- si no el cliente recibe dos respuestas a la misma pregunta.
--
-- `human_until` es una ventana deslizante: cada mensaje del equipo la empuja
-- 30 minutos hacia adelante y el bot se reactiva solo al vencer. Se eligió eso
-- y no un botón de "pausar/reanudar" porque nadie se acuerda de reanudarlo, y
-- un bot apagado para siempre en un cliente es peor que uno que vuelve a los
-- 30 minutos.
-- ============================================================

alter table whatsapp_conversations
  add column human_until timestamptz;

-- null = lo mandó el bot. Sirve para pintar distinto en el hilo.
alter table whatsapp_messages
  add column sent_by uuid references profiles (id);
