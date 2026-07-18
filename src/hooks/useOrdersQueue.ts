import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Order, OrderItem, OrderStatus, Product } from '../types/database';

export interface QueueItem extends OrderItem {
  product: Product;
}

export interface QueueOrder extends Order {
  order_items: QueueItem[];
}

/**
 * Live order queue for a location. Subscribes to realtime changes on
 * `orders` and refetches, so POS, online and WhatsApp orders all appear
 * the moment they land.
 */
export function useOrdersQueue(locationId: string | undefined, statuses: OrderStatus[]) {
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!locationId) return;
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*, product:products(*))')
      .eq('location_id', locationId)
      .in('status', statuses)
      // Hide online orders that require payment but aren't paid yet, so the
      // kitchen never starts a pedido web hasta que Wompi lo confirma. Cash /
      // POS orders (payment_method cash or null) always show.
      .or('payment_method.is.null,payment_method.neq.payment_link,payment_status.eq.paid')
      .order('created_at');
    setOrders((data as QueueOrder[] | null) ?? []);
    setLoading(false);
    // statuses array identity changes per render; content is stable per page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, JSON.stringify(statuses)]);

  useEffect(() => {
    refetch();
    if (!locationId) return;
    const channel = supabase
      .channel(`orders-${locationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `location_id=eq.${locationId}` },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [locationId, refetch]);

  return { orders, loading, refetch };
}

export async function setOrderStatus(orderId: string, status: OrderStatus) {
  return supabase.from('orders').update({ status }).eq('id', orderId);
}
