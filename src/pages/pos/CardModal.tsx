import { useState } from 'react';
import { money } from '../../lib/format';

interface Props {
  orderNumber: string;
  total: number;
  url: string;
  onClose: () => void;
}

/**
 * Enlace de pago de Wompi para un cobro con tarjeta en el mostrador.
 *
 * La orden ya existe y está PENDIENTE. No se marca pagada acá por mucho que el
 * cliente diga que pagó: el único que lo sabe es el webhook de Wompi, y hasta
 * que llegue el pedido no aparece en cocina.
 */
export default function CardModal({ orderNumber, total, url, onClose }: Props) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard bloqueado (http, permisos): el enlace está a la vista para
      // seleccionarlo a mano, que es justo para lo que se muestra completo.
      setCopiado(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center glass-overlay p-0 lg:p-4">
      <div className="w-full lg:max-w-md glass-lg p-4 lg:p-8 rounded-t-3xl lg:rounded-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl lg:text-3xl font-semibold text-brand-700">💳 Cobro con tarjeta</h3>
        <p className="mt-2 lg:mt-3 text-3xl lg:text-4xl font-bold text-brand-700 font-mono">{money(total)}</p>
        <p className="mt-1 text-sm text-charcoal-800">Pedido {orderNumber}</p>

        <div className="mt-5 lg:mt-6 glass-sm p-3 border border-brand-200 rounded-lg">
          <p className="text-xs lg:text-sm text-charcoal-800 mb-1">Enlace de pago</p>
          <p className="break-all font-mono text-xs text-brand-700 select-all">{url}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={copiar}
            className="glass-sm py-3 lg:py-4 text-base font-semibold text-charcoal-800 hover:border-brand-400 transition-all active:scale-95 min-h-12 lg:min-h-14"
            aria-label="Copiar el enlace de pago"
          >
            {copiado ? '✓ Copiado' : '📋 Copiar'}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-xl bg-brand-600 py-3 lg:py-4 text-base font-bold text-white shadow-lg shadow-brand-600/25 transition-colors hover:bg-brand-700 active:bg-brand-800 min-h-12 lg:min-h-14"
            aria-label="Abrir el formulario de pago"
          >
            Abrir pago
          </a>
        </div>

        <p className="mt-4 text-xs lg:text-sm text-charcoal-800">
          El pedido entra a cocina cuando Wompi confirme el pago. Si la tarjeta no
          pasa, la orden queda pendiente y se puede cobrar en efectivo.
        </p>

        <button
          onClick={onClose}
          className="mt-5 lg:mt-6 w-full glass-sm py-3 lg:py-4 text-base font-semibold text-charcoal-800 hover:border-brand-300 transition-all active:scale-95 min-h-12 lg:min-h-14"
          aria-label="Cerrar"
        >
          Listo
        </button>
      </div>
    </div>
  );
}
