import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import PurchaseBatchesTab from './PurchaseBatchesTab';
import ProductionBatchesTab from './ProductionBatchesTab';
import TraceabilityTab from './TraceabilityTab';
import PurchasesTab from './PurchasesTab';

// El orden importa y por eso va numerado: cerrar un lote de produccion sin
// haber registrado la compra falla con "stock de lotes de compra
// insuficiente". Antes la pestaña de produccion abria primero y no habia nada
// que dijera que el paso 1 existia.
const TABS = [
  { id: 'purchase', label: '1 · Compra de pollo' },
  { id: 'production', label: '2 · Producción' },
  { id: 'trace', label: 'Trazabilidad' },
  { id: 'compras', label: 'Compras y gastos (F-07)' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function BatchesPage() {
  const { location, profile } = useAuth();
  const [tab, setTab] = useState<TabId>('purchase');

  if (!profile) return null;
  // superadmin picks Central implicitly: batches live at the production hub
  const locationId = location?.id;
  if (!locationId && profile.role !== 'superadmin') {
    return <p className="p-6 text-lg text-gray-600">Iniciá sesión con una cuenta de sucursal.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <h1 className="page-title mb-3">Lotes y Compras</h1>

      {/* El pollo pasa por dos estados y el sistema los cuenta por separado.
          Confundirlos es el error natural: uno asume que comprar sube el
          inventario, y no es asi. */}
      <div className="ayuda mb-5">
        <p className="ayuda-titulo">Cómo se mueve el pollo</p>
        <p>
          <strong>1. Comprás pollo crudo.</strong> Queda guardado como pollo crudo
          disponible y se registra el gasto. <strong>El inventario de venta no
          cambia todavía.</strong>
        </p>
        <p>
          <strong>2. Marinás, horneás y cerrás el lote.</strong> Ahí sí: el pollo
          crudo se descuenta y los pollos horneados <strong>entran al inventario</strong>,
          listos para vender en el POS.
        </p>
        <p>
          O sea que comprar y tener para vender son dos cosas distintas. Mientras
          no cierres el lote de producción, el POS no sabe que hay pollo.
        </p>
      </div>

      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`tab ${
              tab === t.id ? 'tab-on' : 'tab-off'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'purchase' && <PurchaseBatchesTab />}
      {tab === 'production' && <ProductionBatchesTab />}
      {tab === 'trace' && <TraceabilityTab />}
      {tab === 'compras' && <PurchasesTab />}
    </div>
  );
}
