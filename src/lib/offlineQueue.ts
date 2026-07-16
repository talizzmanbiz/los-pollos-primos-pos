// Offline support for POS terminals (PWA + IndexedDB).
// When the terminal loses connectivity, cash sales are queued locally and
// replayed automatically when the connection returns. Order numbers are
// assigned by the server at sync time, so the local ticket shows a temporary
// reference. The public storefront does NOT use this — POS only.
import { openDB, type IDBPDatabase } from 'idb';
import { supabase } from './supabase';
import type { TablesInsert } from '../types/database';

interface PendingOrder {
  localId: string;
  createdAt: string;
  order: TablesInsert<'orders'>;
  items: { product_id: string; quantity: number; unit_price: number }[];
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB('pp-pos', 1, {
      upgrade(database) {
        database.createObjectStore('pendingOrders', { keyPath: 'localId' });
        database.createObjectStore('catalog');
      },
    });
  }
  return dbPromise;
}

// ---------- catalog cache (so the POS grid loads offline) ----------

export async function cacheCatalog<T>(products: T[]): Promise<void> {
  const d = await db();
  await d.put('catalog', products, 'products');
}

export async function loadCachedCatalog<T>(): Promise<T[] | null> {
  const d = await db();
  return ((await d.get('catalog', 'products')) as T[] | undefined) ?? null;
}

// ---------- pending order queue ----------

export async function queueOrder(
  order: TablesInsert<'orders'>,
  items: PendingOrder['items'],
): Promise<string> {
  const d = await db();
  const localId = `LOCAL-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const pending: PendingOrder = { localId, createdAt: new Date().toISOString(), order, items };
  await d.put('pendingOrders', pending);
  return localId;
}

export async function pendingCount(): Promise<number> {
  const d = await db();
  return d.count('pendingOrders');
}

/** Replays queued orders. Returns how many synced. */
export async function syncPendingOrders(): Promise<number> {
  const d = await db();
  const all = (await d.getAll('pendingOrders')) as PendingOrder[];
  let synced = 0;
  for (const pending of all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({ ...pending.order, notes: appendOfflineNote(pending.order.notes, pending.createdAt) })
      .select('id')
      .single();
    if (orderError || !order) break; // still offline (or server error) — retry later

    const { error: itemsError } = await supabase.from('order_items').insert(
      pending.items.map((i) => ({ ...i, order_id: order.id })),
    );
    if (itemsError) {
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
      // malformed queue entry would loop forever — drop it and continue
      await d.delete('pendingOrders', pending.localId);
      continue;
    }
    await d.delete('pendingOrders', pending.localId);
    synced += 1;
  }
  return synced;
}

function appendOfflineNote(notes: string | null | undefined, createdAt: string): string {
  const stamp = `venta offline ${createdAt}`;
  return notes ? `${notes} · ${stamp}` : stamp;
}

/** Wire the auto-sync: on reconnect and every 60s as a safety net. */
export function startOfflineSync(onSync?: (count: number) => void): () => void {
  const run = async () => {
    if (!navigator.onLine) return;
    const count = await syncPendingOrders();
    if (count > 0) onSync?.(count);
  };
  const interval = setInterval(run, 60_000);
  window.addEventListener('online', run);
  run();
  return () => {
    clearInterval(interval);
    window.removeEventListener('online', run);
  };
}
