import { useState } from 'react';
import { money } from '../../lib/format';

interface Props {
  total: number;
  onConfirm: (cashReceived: number) => Promise<void>;
  onClose: () => void;
}

const QUICK_AMOUNTS = [1, 5, 10, 20];

export default function PaymentModal({ total, onConfirm, onClose }: Props) {
  const [received, setReceived] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const receivedNum = parseFloat(received) || 0;
  const change = receivedNum - total;

  async function confirm() {
    setBusy(true);
    await onConfirm(receivedNum);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center glass-overlay p-0 lg:p-4">
      {/* Sheet on mobile, modal on desktop */}
      <div className="w-full lg:max-w-md glass-lg p-4 lg:p-8 rounded-t-3xl lg:rounded-2xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl lg:text-3xl font-semibold text-brand-700">💵 Cobro</h3>
        <p className="mt-2 lg:mt-3 text-3xl lg:text-4xl font-bold text-brand-700 font-mono">{money(total)}</p>

        <label className="mt-5 lg:mt-6 mb-2 block text-sm lg:text-base font-medium text-charcoal-800">
          Efectivo recibido
        </label>
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={received}
            onChange={(e) => setReceived(e.target.value)}
            className="w-full glass-sm px-4 py-4 lg:py-5 text-2xl lg:text-3xl font-mono text-brand-700 placeholder:text-gray-500 border border-brand-200 focus:border-brand-500 transition-colors"
            placeholder="0.00"
            autoFocus
            aria-label="Cantidad de efectivo recibido"
          />
        </div>

        {/* Quick amount buttons — large tap targets */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          <button
            onClick={() => setReceived(total.toFixed(2))}
            className="glass-sm py-3 lg:py-4 text-xs lg:text-sm font-semibold text-charcoal-800 hover:border-brand-400 transition-all active:scale-95 min-h-12"
            title="Cobrar el monto exacto"
          >
            Exacto
          </button>
          {QUICK_AMOUNTS.filter((a) => a >= total).slice(0, 3).map((a) => (
            <button
              key={a}
              onClick={() => setReceived(a.toFixed(2))}
              className="glass-sm py-3 lg:py-4 text-xs lg:text-sm font-semibold text-charcoal-800 hover:border-brand-400 transition-all active:scale-95 min-h-12"
              title={`Recibir $${a}`}
            >
              ${a}
            </button>
          ))}
        </div>

        {/* Change display */}
        {receivedNum > 0 && (
          <div className={`mt-4 glass-sm p-4 border rounded-lg ${receivedNum >= total ? 'border-green-200' : 'border-chili-600/30'}`}>
            <p className="text-xs lg:text-sm text-charcoal-800">Cambio</p>
            <p className={`text-2xl lg:text-3xl font-bold font-mono mt-2 ${receivedNum >= total ? 'text-green-700' : 'text-chili-600'}`}>
              {receivedNum >= total ? '✓' : '✗'} {money(Math.max(0, change))}
            </p>
          </div>
        )}

        {/* Action buttons — large touch targets */}
        <div className="mt-6 lg:mt-8 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="glass-sm py-3 lg:py-4 text-base font-semibold text-charcoal-800 hover:border-brand-300 transition-all active:scale-95 disabled:opacity-50 min-h-12 lg:min-h-14"
            aria-label="Volver atrás"
          >
            Volver
          </button>
          <button
            onClick={confirm}
            disabled={busy || receivedNum < total}
            className="rounded-xl bg-brand-600 py-3 lg:py-4 text-base font-bold text-white shadow-lg shadow-brand-600/25 transition-colors hover:bg-brand-700 active:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none min-h-12 lg:min-h-14"
            aria-label={busy ? 'Cobrando' : `Confirmar pago de ${money(total)}`}
          >
            {busy ? '⏳ …' : '✓ Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
