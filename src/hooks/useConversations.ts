import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Order, WhatsappConversation, WhatsappMessage } from '../types/database';

/**
 * Lista de conversaciones de WhatsApp, ordenada por actividad reciente y
 * suscrita a cambios: cuando un cliente escribe, el chat sube solo.
 */
export function useConversations() {
  const [conversations, setConversations] = useState<WhatsappConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .order('last_message_at', { ascending: false })
      .limit(200);
    setConversations(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    refetch();
    const channel = supabase
      .channel('wa-conversations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_conversations' },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return { conversations, loading, refetch };
}

/** Hilo completo de una conversación, en vivo mientras está abierta. */
export function useThread(conversationId: string | null) {
  const [messages, setMessages] = useState<WhatsappMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    const { data } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at');
    setMessages(data ?? []);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    refetch();
    const channel = supabase
      .channel(`wa-thread-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, refetch]);

  return { messages, loading, refetch };
}

/**
 * Pedidos del cliente, para ver el chat junto a lo que realmente compró.
 * El teléfono se guarda igual en ambas tablas (dígitos, como lo manda Meta).
 */
export function useCustomerOrders(phone: string | null) {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!phone) {
      setOrders([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_phone', phone)
        .order('created_at', { ascending: false })
        .limit(10);
      if (!cancelled) setOrders(data ?? []);
    })();
    return () => {
      cancelled = true;
    };
  }, [phone]);

  return orders;
}
