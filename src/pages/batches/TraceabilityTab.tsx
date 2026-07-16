import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fmtDateTime, fmtDate } from '../../lib/format';

interface SaleTrace {
  orderNumber: string;
  createdAt: string;
  items: {
    product: string;
    quantity: number;
    batches: {
      productionBatchId: string;
      roastEndAt: string | null;
      chickenQty: number;
      purchases: { supplier: string; date: string; consumed: number }[];
    }[];
  }[];
}

interface PurchaseTrace {
  supplier: string;
  date: string;
  productionBatches: {
    id: string;
    roastEndAt: string | null;
    consumed: number;
    orders: { orderNumber: string; createdAt: string; chickenQty: number }[];
  }[];
}

export default function TraceabilityTab() {
  const [orderNumber, setOrderNumber] = useState('');
  const [saleTrace, setSaleTrace] = useState<SaleTrace | null>(null);
  const [purchaseTrace, setPurchaseTrace] = useState<PurchaseTrace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function traceSale() {
    setBusy(true);
    setError(null);
    setSaleTrace(null);
    setPurchaseTrace(null);

    const { data: order } = await supabase
      .from('orders')
      .select('id, order_number, created_at, order_items(id, quantity, product:products(name))')
      .eq('order_number', orderNumber.trim().toUpperCase())
      .maybeSingle();

    if (!order) {
      setError('Pedido no encontrado');
      setBusy(false);
      return;
    }

    const itemIds = order.order_items.map((i) => i.id);
    const { data: consumption } = await supabase
      .from('order_item_batch_consumption')
      .select('order_item_id, quantity, production_batch:production_batches(id, roast_end_at)')
      .in('order_item_id', itemIds.length ? itemIds : ['00000000-0000-0000-0000-000000000000']);

    const batchIds = [...new Set((consumption ?? []).map((c) => c.production_batch!.id))];
    const { data: inputs } = batchIds.length
      ? await supabase
          .from('production_batch_inputs')
          .select('production_batch_id, quantity_consumed, purchase_batch:purchase_batches(supplier_name, purchase_date)')
          .in('production_batch_id', batchIds)
      : { data: [] };

    setSaleTrace({
      orderNumber: order.order_number,
      createdAt: order.created_at,
      items: order.order_items.map((item) => ({
        product: (item.product as { name: string } | null)?.name ?? '?',
        quantity: item.quantity,
        batches: (consumption ?? [])
          .filter((c) => c.order_item_id === item.id)
          .map((c) => ({
            productionBatchId: c.production_batch!.id,
            roastEndAt: c.production_batch!.roast_end_at,
            chickenQty: c.quantity,
            purchases: (inputs ?? [])
              .filter((i) => i.production_batch_id === c.production_batch!.id)
              .map((i) => ({
                supplier: i.purchase_batch!.supplier_name,
                date: i.purchase_batch!.purchase_date,
                consumed: i.quantity_consumed,
              })),
          })),
      })),
    });
    setBusy(false);
  }

  const [purchaseList, setPurchaseList] = useState<
    { id: string; supplier_name: string; purchase_date: string }[]
  >([]);
  const [selectedPurchase, setSelectedPurchase] = useState('');

  async function loadPurchases() {
    const { data } = await supabase
      .from('purchase_batches')
      .select('id, supplier_name, purchase_date')
      .order('purchase_date', { ascending: false })
      .limit(100);
    setPurchaseList(data ?? []);
  }

  async function tracePurchase() {
    if (!selectedPurchase) return;
    setBusy(true);
    setError(null);
    setSaleTrace(null);
    setPurchaseTrace(null);

    const purchase = purchaseList.find((p) => p.id === selectedPurchase)!;
    const { data: inputs } = await supabase
      .from('production_batch_inputs')
      .select('quantity_consumed, production_batch:production_batches(id, roast_end_at)')
      .eq('purchase_batch_id', selectedPurchase);

    const batchIds = (inputs ?? []).map((i) => i.production_batch!.id);
    const { data: consumption } = batchIds.length
      ? await supabase
          .from('order_item_batch_consumption')
          .select('production_batch_id, quantity, order_item:order_items(order:orders(order_number, created_at))')
          .in('production_batch_id', batchIds)
      : { data: [] };

    setPurchaseTrace({
      supplier: purchase.supplier_name,
      date: purchase.purchase_date,
      productionBatches: (inputs ?? []).map((i) => ({
        id: i.production_batch!.id,
        roastEndAt: i.production_batch!.roast_end_at,
        consumed: i.quantity_consumed,
        orders: (consumption ?? [])
          .filter((c) => c.production_batch_id === i.production_batch!.id)
          .map((c) => {
            const ord = (c.order_item as { order: { order_number: string; created_at: string } | null } | null)?.order;
            return {
              orderNumber: ord?.order_number ?? '?',
              createdAt: ord?.created_at ?? '',
              chickenQty: c.quantity,
            };
          }),
      })),
    });
    setBusy(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Venta → origen del pollo</h2>
        <div className="flex gap-3">
          <input
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="PP-C-0001"
            className="w-56 rounded-lg border border-gray-300 px-4 py-3"
          />
          <button
            onClick={traceSale}
            disabled={busy || !orderNumber.trim()}
            className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white disabled:opacity-40"
          >
            Rastrear
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Lote de compra → ventas</h2>
        <div className="flex gap-3">
          <select
            value={selectedPurchase}
            onFocus={() => purchaseList.length === 0 && loadPurchases()}
            onChange={(e) => setSelectedPurchase(e.target.value)}
            className="w-72 rounded-lg border border-gray-300 px-4 py-3"
          >
            <option value="">Elegir lote de compra…</option>
            {purchaseList.map((p) => (
              <option key={p.id} value={p.id}>
                {fmtDate(p.purchase_date)} — {p.supplier_name}
              </option>
            ))}
          </select>
          <button
            onClick={tracePurchase}
            disabled={busy || !selectedPurchase}
            className="rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white disabled:opacity-40"
          >
            Rastrear
          </button>
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {saleTrace && (
        <div className="rounded-2xl bg-white p-6 shadow">
          <h3 className="text-xl font-bold text-gray-900">
            {saleTrace.orderNumber}{' '}
            <span className="text-sm font-normal text-gray-400">{fmtDateTime(saleTrace.createdAt)}</span>
          </h3>
          {saleTrace.items.map((item, i) => (
            <div key={i} className="mt-4 border-l-4 border-brand-300 pl-4">
              <p className="font-semibold text-gray-800">{item.quantity} × {item.product}</p>
              {item.batches.length === 0 && (
                <p className="text-sm text-gray-400">Sin pollo (o sin lote registrado)</p>
              )}
              {item.batches.map((b) => (
                <div key={b.productionBatchId} className="mt-2 text-sm text-gray-600">
                  <p>
                    🔥 Lote de producción {b.productionBatchId.slice(0, 8)} — {b.chickenQty} pollo(s),
                    horneado {b.roastEndAt ? fmtDateTime(b.roastEndAt) : '—'}
                  </p>
                  <ul className="ml-6 list-disc">
                    {b.purchases.map((p, j) => (
                      <li key={j}>
                        🛒 {p.supplier} ({fmtDate(p.date)}) — consumió {p.consumed} del lote
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {purchaseTrace && (
        <div className="rounded-2xl bg-white p-6 shadow">
          <h3 className="text-xl font-bold text-gray-900">
            🛒 {purchaseTrace.supplier} — {fmtDate(purchaseTrace.date)}
          </h3>
          {purchaseTrace.productionBatches.length === 0 && (
            <p className="mt-2 text-gray-400">Este lote todavía no se ha usado en producción.</p>
          )}
          {purchaseTrace.productionBatches.map((b) => (
            <div key={b.id} className="mt-4 border-l-4 border-brand-300 pl-4">
              <p className="font-semibold text-gray-800">
                🔥 Lote de producción {b.id.slice(0, 8)} — consumió {b.consumed} unidades
                {b.roastEndAt ? `, horneado ${fmtDateTime(b.roastEndAt)}` : ''}
              </p>
              {b.orders.length === 0 ? (
                <p className="text-sm text-gray-400">Sin ventas todavía</p>
              ) : (
                <ul className="ml-6 list-disc text-sm text-gray-600">
                  {b.orders.map((o, j) => (
                    <li key={j}>
                      {o.orderNumber} — {o.chickenQty} pollo(s), {o.createdAt ? fmtDateTime(o.createdAt) : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
