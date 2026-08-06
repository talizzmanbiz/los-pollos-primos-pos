import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, MessageSquare, Search } from 'lucide-react';
import { useConversations, useCustomerOrders, useThread } from '../../hooks/useConversations';
import { fmtDateTime, fmtTime, money } from '../../lib/format';
import type { WhatsappConversation, WhatsappMessage } from '../../types/database';

/**
 * WhatsApp usa *un* asterisco para negrita. El bot escribe así, y sin esto la
 * pantalla mostraría los asteriscos crudos en vez de lo que ve el cliente.
 */
function withBold(text: string): ReactNode[] {
  return text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
    part.startsWith('*') && part.endsWith('*') && part.length > 2 ? (
      <strong key={i}>{part.slice(1, -1)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/** 50370001111 → +503 7000 1111 */
function fmtPhone(phone: string): string {
  const m = phone.match(/^503(\d{4})(\d{4})$/);
  return m ? `+503 ${m[1]} ${m[2]}` : `+${phone}`;
}

function relative(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return fmtDateTime(iso).slice(0, 10);
}

function ChatListItem({
  conv,
  active,
  onSelect,
}: {
  conv: WhatsappConversation;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full border-b border-gray-100 px-3 py-2.5 text-left transition-colors sm:px-4 sm:py-3 ${
        active ? 'bg-brand-50' : 'bg-white hover:bg-gray-50'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-semibold text-gray-900 sm:text-base">
          {conv.customer_name || fmtPhone(conv.phone)}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
          {relative(conv.last_message_at)}
        </span>
      </div>
      <p className="mt-0.5 truncate text-[12px] text-gray-500 sm:text-sm">
        {conv.last_direction === 'out' && <span className="text-gray-400">Bot: </span>}
        {conv.last_message_preview}
      </p>
      {conv.customer_name && (
        <p className="mt-0.5 text-[11px] tabular-nums text-gray-400">{fmtPhone(conv.phone)}</p>
      )}
    </button>
  );
}

function Bubble({ msg }: { msg: WhatsappMessage }) {
  const fromBot = msg.direction === 'out';
  return (
    <div className={`mb-2 flex ${fromBot ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 sm:max-w-[70%] ${
          fromBot ? 'bg-brand-600 text-white' : 'bg-white text-gray-900 shadow-sm'
        }`}
      >
        <p className="whitespace-pre-wrap break-words text-[13px] leading-snug sm:text-sm">
          {withBold(msg.body)}
        </p>
        <p
          className={`mt-1 text-right text-[10px] tabular-nums ${
            fromBot ? 'text-brand-100' : 'text-gray-400'
          }`}
        >
          {fmtTime(msg.created_at)}
        </p>
      </div>
    </div>
  );
}

function Thread({ conv, onBack }: { conv: WhatsappConversation; onBack: () => void }) {
  const { messages, loading } = useThread(conv.id);
  const orders = useCustomerOrders(conv.phone);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, conv.id]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-brand-50">
      <header className="flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2.5 sm:px-4">
        <button
          onClick={onBack}
          className="-ml-1 rounded p-1 text-gray-500 hover:bg-gray-100 sm:hidden"
          aria-label="Volver a la lista"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-gray-900 sm:text-base">
            {conv.customer_name || fmtPhone(conv.phone)}
          </p>
          <p className="text-[11px] tabular-nums text-gray-500">{fmtPhone(conv.phone)}</p>
        </div>
        <a
          href={`https://wa.me/${conv.phone}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-lg border border-brand-600 px-2.5 py-1.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-50 sm:text-xs"
        >
          Abrir en WhatsApp
        </a>
      </header>

      {orders.length > 0 && (
        <div className="border-b border-gray-200 bg-white px-3 py-2 sm:px-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Pedidos de este cliente
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {orders.map((o) => (
              <div
                key={o.id}
                className="shrink-0 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] sm:text-xs"
              >
                <span className="font-bold tabular-nums text-gray-900">{o.order_number}</span>
                <span className="ml-2 tabular-nums text-gray-600">{money(o.total)}</span>
                <span className="ml-2 text-gray-400">{fmtDateTime(o.created_at).slice(0, 10)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        {loading && <p className="text-sm text-gray-400">Cargando…</p>}
        {messages.map((m) => (
          <Bubble key={m.id} msg={m} />
        ))}
        <div ref={bottom} />
      </div>
    </div>
  );
}

export default function ConversationsPage() {
  const { conversations, loading } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.phone.includes(q.replace(/\D/g, '')) ||
        (c.customer_name ?? '').toLowerCase().includes(q) ||
        (c.last_message_preview ?? '').toLowerCase().includes(q),
    );
  }, [conversations, query]);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-0 bg-white">
      {/* Lista — en móvil se oculta cuando hay un chat abierto */}
      <aside
        className={`flex min-h-0 w-full flex-col border-r border-gray-200 sm:flex sm:w-80 sm:shrink-0 ${
          selected ? 'hidden sm:flex' : 'flex'
        }`}
      >
        <div className="border-b border-gray-200 p-2 sm:p-3">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o teléfono"
              className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-brand-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <p className="p-4 text-sm text-gray-400">Cargando…</p>}
          {!loading && filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-gray-400">
              {conversations.length === 0 ? (
                <>
                  <MessageSquare size={28} className="mx-auto mb-2 opacity-40" />
                  Todavía no hay conversaciones.
                  <br />
                  Aparecerán aquí en cuanto un cliente le escriba al bot.
                </>
              ) : (
                'Sin resultados'
              )}
            </div>
          )}
          {filtered.map((c) => (
            <ChatListItem
              key={c.id}
              conv={c}
              active={c.id === selectedId}
              onSelect={() => setSelectedId(c.id)}
            />
          ))}
        </div>
      </aside>

      {selected ? (
        <Thread conv={selected} onBack={() => setSelectedId(null)} />
      ) : (
        <div className="hidden flex-1 items-center justify-center text-sm text-gray-400 sm:flex">
          Elegí una conversación para verla
        </div>
      )}
    </div>
  );
}
