import { supabase } from '../../lib/supabase';
import { queueOrder } from '../../lib/offlineQueue';
import type { CatalogProduct } from '../../hooks/useCatalog';
import type { TablesInsert } from '../../types/database';

export interface CartLine {
  product: CatalogProduct;
  quantity: number;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  /** Con NIT se emite CCF; sin NIT, factura de consumidor final. */
  nit: string;
  /**
   * Cliente ya en el registro. Lo pone el panel de caja al reconocerlo o al
   * guardarlo; sin esto el trigger crearia otra ficha y el credito fiscal se
   * quedaria sin los datos que exige el MH.
   */
  customerId?: string | null;
}

interface CreateOrderArgs {
  locationId: string;
  /** Production hub (Central) routes orders through the kitchen; sales-only
   * locations (Mercado) hand product over immediately. */
  isProductionLocation: boolean;
  cashierId: string;
  cart: CartLine[];
  customer: CustomerInfo;
  subtotal: number;
  /**
   * Efectivo cierra la venta pagada en el acto. Con tarjeta la orden nace
   * PENDIENTE: la plata todavia no entro y solo el webhook de Wompi puede
   * decir que si. Marcarla pagada aca seria entregar producto contra un cobro
   * que puede no aprobarse.
   */
  paymentMethod?: 'cash' | 'payment_link';
}

export type CreateOrderResult =
  | { orderId: string; orderNumber: string }
  | { queued: true; localRef: string }
  | { error: string };

function isNetworkError(message: string | undefined): boolean {
  if (!navigator.onLine) return true;
  return /fetch|network|conexión/i.test(message ?? '');
}

/**
 * Creates a POS cash sale: order + items. The database assigns the
 * PP-X-XXXX number, decrements inventory (expanding combos) and stamps
 * FIFO production batches via triggers.
 */
export async function createOrder(args: CreateOrderArgs): Promise<CreateOrderResult> {
  const { locationId, isProductionLocation, cashierId, cart, customer, subtotal } = args;
  const conTarjeta = args.paymentMethod === 'payment_link';

  const orderRow: TablesInsert<'orders'> = {
    location_id: locationId,
    source: 'pos',
    order_type: 'walk_in',
    // Con tarjeta nunca se marca entregada de entrada, ni en las sucursales
    // que despachan al instante: no se entrega hasta que Wompi confirme.
    status: conTarjeta || isProductionLocation ? 'received' : 'completed',
    subtotal,
    delivery_fee: 0,
    total: subtotal,
    payment_method: conTarjeta ? 'payment_link' : 'cash',
    payment_status: conTarjeta ? 'pending' : 'paid',
    paid_at: conTarjeta ? null : new Date().toISOString(),
    cashier_id: cashierId,
    customer_name: customer.name.trim() || null,
    customer_phone: customer.phone.trim() || null,
    customer_email: customer.email.trim() || null,
    customer_nit: customer.nit.trim() || null,
    customer_id: customer.customerId ?? null,
  };
  const itemRows = cart.map((l) => ({
    product_id: l.product.id,
    quantity: l.quantity,
    unit_price: l.product.price,
  }));

  // offline-first: don't even try the network when the terminal knows it's off
  if (!navigator.onLine) {
    const localRef = await queueOrder(orderRow, itemRows);
    return { queued: true, localRef };
  }

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert(orderRow)
    .select('id, order_number')
    .single();

  if (orderError || !order) {
    if (isNetworkError(orderError?.message)) {
      const localRef = await queueOrder(orderRow, itemRows);
      return { queued: true, localRef };
    }
    return { error: orderError?.message ?? 'Error desconocido' };
  }

  const { error: itemsError } = await supabase.from('order_items').insert(
    itemRows.map((i) => ({ ...i, order_id: order.id })),
  );

  if (itemsError) {
    // undo the half-created order so the queue never shows an empty ticket
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
    return { error: itemsError.message };
  }

  return { orderId: order.id, orderNumber: order.order_number };
}
