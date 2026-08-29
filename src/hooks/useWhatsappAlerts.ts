import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Avisa en el POS cuando un cliente escribe por WhatsApp.
 *
 * El "ya lo vi" se guarda en localStorage y no en la base: cada terminal del
 * negocio lleva su propia cuenta, que es justo lo que se quiere — que en caja
 * se apague el aviso cuando en caja lo atendieron, sin apagárselo al dueño en
 * su teléfono. Si hiciera falta compartirlo entre dispositivos del mismo
 * usuario, ahí sí toca una tabla de lecturas.
 */
const CLAVE = 'wa_visto_at';
const EVENTO = 'wa-visto';

export interface AvisoWhatsapp {
  phone: string;
  nombre: string;
  texto: string;
}

/**
 * La primera vez arranca en "ahora", no en 1970: si no, un POS recién abierto
 * mostraría un contador con todo el historial de mensajes que ya fueron
 * atendidos. Se cuenta desde que esta terminal empezó a mirar.
 */
function visto(): string {
  const guardado = localStorage.getItem(CLAVE);
  if (guardado) return guardado;
  const ahora = new Date().toISOString();
  localStorage.setItem(CLAVE, ahora);
  return ahora;
}

/** Marca los mensajes como vistos y apaga el contador en toda la app. */
export function marcarWhatsappVisto() {
  localStorage.setItem(CLAVE, new Date().toISOString());
  window.dispatchEvent(new Event(EVENTO));
}

export function useWhatsappAlerts(activo: boolean) {
  const [sinLeer, setSinLeer] = useState(0);
  const [ultimo, setUltimo] = useState<AvisoWhatsapp | null>(null);

  const contar = useCallback(async () => {
    if (!activo) return;
    const { count } = await supabase
      .from('whatsapp_messages')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'in')
      .gt('created_at', visto());
    setSinLeer(count ?? 0);
  }, [activo]);

  useEffect(() => {
    if (!activo) return;
    contar();

    const alVer = () => {
      setSinLeer(0);
      setUltimo(null);
    };
    window.addEventListener(EVENTO, alVer);

    const canal = supabase
      .channel('wa-alertas')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: 'direction=eq.in',
        },
        async (payload) => {
          setSinLeer((n) => n + 1);
          // El mensaje no trae el teléfono ni el nombre: viven en la conversación.
          const { data } = await supabase
            .from('whatsapp_conversations')
            .select('phone, customer_name')
            .eq('id', (payload.new as { conversation_id: string }).conversation_id)
            .maybeSingle();
          setUltimo({
            phone: data?.phone ?? '',
            nombre: data?.customer_name || data?.phone || 'Cliente',
            texto: (payload.new as { body: string }).body,
          });
        },
      )
      .subscribe();

    return () => {
      window.removeEventListener(EVENTO, alVer);
      supabase.removeChannel(canal);
    };
  }, [activo, contar]);

  return { sinLeer, ultimo, descartar: () => setUltimo(null) };
}
