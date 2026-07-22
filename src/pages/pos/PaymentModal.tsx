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
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-overlay p-4">
      <div className="w-full max-w-md glass-lg p-6 sm:p-8">
        <h3 className="text-2xl font-semibold text-primary-600">💵 Cobro en efectivo</h3>
        <p className="mt-3 text-4xl font-bold text-primary-600 font-mono">{money(total)}</p>

        <label className="mt-6 mb-2 block text-sm font-medium text-charcoal-600">
          Efectivo recibido
        </label>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={received}
          onChange={(e) => setReceived(e.target.value)}
          className="w-full glass-sm px-4 py-4 text-2xl font-mono text-primary-600 placeholder:text-charcoal-400 border-primary-300/40 focus:border-primary-500 transition-colors font-mono"
          placeholder="0.00"
          autoFocus
          aria-label="Cantidad de efectivo recibido"
        />
        <div className="mt-4 grid grid-cols-4 gap-2">
          <button
            onClick={() => setReceived(total.toFixed(2))}
            className="glass-sm py-3 text-sm font-semibold text-charcoal-600 hover:border-primary-300 transition-all active:scale-95"
            title="Cobrar el monto exacto"
          >
            Exacto
          </button>
          {QUICK_AMOUNTS.filter((a) => a >= total).slice(0, 3).map((a) => (
            <button
              key={a}
              onClick={() => setReceived(a.toFixed(2))}
              className="glass-sm py-3 text-sm font-semibold text-charcoal-600 hover:border-primary-300 transition-all active:scale-95"
              title={`Recibir $${a}`}
            >
              ${a}
            </button>
          ))}
        </div>

        {receivedNum > 0 && (
          <div className="mt-6 glass-sm p-4 border border-olive-300/30 rounded-lg">
            <p className="text-sm text-charcoal-600">Cambio</p>
            <p className={`text-2xl font-bold font-mono mt-1 ${receivedNum >= total ? 'text-olive-600' : 'text-error-500'}`}>
              {receivedNum >= total ? '✓' : '✗'} {money(Math.max(0, change))}
            </p>
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="glass-sm py-4 text-base font-semibold text-charcoal-600 hover:border-charcoal-400 transition-all active:scale-95 disabled:opacity-50"
            aria-label="Volver atrás"
          >
            Volver
          </button>
          <button
            onClick={confirm}
            disabled={busy || receivedNum < total}
            className="glass-button py-4 text-base font-semibold text-white bg-primary-600 border-primary-600 hover:bg-primary-700 hover:border-primary-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={busy ? 'Cobrando' : `Confirmar pago de ${money(total)}`}
          >
            {busy ? '⏳ Cobrando…' : '✓ Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
