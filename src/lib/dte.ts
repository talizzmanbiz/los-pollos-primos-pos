// Disparo de la emisión del DTE desde el POS.
//
// La venta ya está cerrada y cobrada cuando esto corre: si el MH o el firmador
// no responden a tiempo, el documento queda en cola y el ticket sale con el
// número de control y el código de generación, que es lo que Hacienda acepta
// como contingencia. Cobrar nunca depende de que el MH esté arriba.
import { supabase } from './supabase';

export interface DteResultado {
  estado: 'procesado' | 'pendiente' | 'contingencia' | 'rechazado' | 'firmado' | 'anulado';
  numero_control?: string;
  codigo_generacion?: string;
  sello_recibido?: string | null;
  error?: string | null;
}

/** Más de esto y el cajero siente que la caja se colgó. */
const TIMEOUT_MS = 4000;

export async function emitirDte(orderId: string): Promise<DteResultado | null> {
  try {
    const carrera = supabase.functions.invoke('emit-dte', { body: { order_id: orderId } });
    const conLimite = await Promise.race([
      carrera,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    // Timeout: la Edge Function sigue corriendo del lado del servidor y el
    // documento se guarda igual; sólo no alcanzamos a mostrarlo en el ticket.
    if (!conLimite) return null;
    if (conLimite.error) return null;
    return conLimite.data as DteResultado;
  } catch {
    return null;
  }
}
