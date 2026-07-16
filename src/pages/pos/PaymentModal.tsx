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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-xl font-bold text-gray-900">Cobro en efectivo</h3>
        <p className="mt-1 text-3xl font-bold text-brand-600">{money(total)}</p>

        <label className="mt-4 mb-1 block text-gray-600">Efectivo recibido</label>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={received}
          onChange={(e) => setReceived(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-2xl focus:border-brand-500 focus:outline-none"
          autoFocus
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setReceived(total.toFixed(2))}
            className="flex-1 rounded-lg bg-gray-100 py-3 font-semibold active:bg-gray-200"
          >
            Exacto
          </button>
          {QUICK_AMOUNTS.filter((a) => a >= total).slice(0, 3).map((a) => (
            <button
              key={a}
              onClick={() => setReceived(a.toFixed(2))}
              className="flex-1 rounded-lg bg-gray-100 py-3 font-semibold active:bg-gray-200"
            >
              ${a}
            </button>
          ))}
        </div>

        {receivedNum >= total && (
          <p className="mt-4 text-center text-xl">
            Cambio: <span className="font-bold text-green-700">{money(change)}</span>
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-gray-300 py-3 text-lg text-gray-600 active:bg-gray-100"
          >
            Volver
          </button>
          <button
            onClick={confirm}
            disabled={busy || receivedNum < total}
            className="flex-1 rounded-xl bg-brand-600 py-3 text-lg font-bold text-white active:bg-brand-700 disabled:opacity-40"
          >
            {busy ? 'Cobrando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
