-- ============================================================
-- Los Pollos Primos — 0021 historial de conversaciones de WhatsApp
--
-- Hasta ahora los mensajes del chatbot no se guardaban en ninguna parte:
-- vivían en la memoria RAM de n8n (últimos 10 intercambios, se pierden al
-- reiniciar) y en los logs de ejecución, que se purgan solos. Esta migración
-- crea el almacén para que el POS pueda mostrarlos en /conversaciones.
--
-- Escribe únicamente la edge function `wa-log` (service role). El POS solo
-- lee: no hay políticas de insert/update/delete para `authenticated`, así que
-- nadie puede alterar el historial desde el navegador.
-- ============================================================

create table whatsapp_conversations (
  id                   uuid primary key default gen_random_uuid(),
  -- Teléfono tal como lo manda Meta (dígitos, con código de país): 50370001111
  phone                text not null unique,
  customer_name        text,
  ghl_contact_id       text,
  message_count        integer not null default 0,
  last_message_at      timestamptz not null default now(),
  last_message_preview text,
  last_direction       text check (last_direction in ('in', 'out')),
  created_at           timestamptz not null default now()
);

create table whatsapp_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references whatsapp_conversations (id) on delete cascade,
  direction       text not null check (direction in ('in', 'out')),
  body            text not null,
  -- wamid de Meta. Solo viene en los entrantes; sirve para que un reintento
  -- del webhook no duplique el mensaje.
  wa_message_id   text,
  created_at      timestamptz not null default now()
);

-- Lista de chats ordenada por actividad reciente
create index whatsapp_conversations_recent_idx
  on whatsapp_conversations (last_message_at desc);

-- Hilo de una conversación
create index whatsapp_messages_thread_idx
  on whatsapp_messages (conversation_id, created_at);

-- Deduplicación de entrantes (los salientes no traen wamid propio)
create unique index whatsapp_messages_wamid_idx
  on whatsapp_messages (wa_message_id) where wa_message_id is not null;

alter table whatsapp_conversations enable row level security;
alter table whatsapp_messages      enable row level security;

-- Solo lectura, y solo para quien administra. Las conversaciones traen datos
-- personales de clientes (nombre, dirección, teléfono), así que no se abren
-- al resto de roles.
create policy wa_conversations_read on whatsapp_conversations
  for select to authenticated using (app.is_superadmin() or app.has_role('admin'));

create policy wa_messages_read on whatsapp_messages
  for select to authenticated using (app.is_superadmin() or app.has_role('admin'));

grant select on whatsapp_conversations to authenticated;
grant select on whatsapp_messages      to authenticated;

-- Para que /conversaciones se actualice sola mientras el cliente escribe
alter publication supabase_realtime add table whatsapp_conversations;
alter publication supabase_realtime add table whatsapp_messages;
