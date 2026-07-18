// Per-device order history for guest checkout, persisted to localStorage.
// We intentionally do NOT expose order history by phone number server-side
// (that would let anyone enumerate a stranger's orders). Instead each device
// remembers the orders placed on it, which is enough to re-order and to deep
// link into the status tracker. Cross-device lookup stays available via the
// phone + order-number form on the status page.
import type { StoreCartLine } from './storeCart';

export interface PastOrder {
  order_number: string;
  placed_at: string; // ISO timestamp
  total: number;
  phone: string;
  name: string;
  mode: 'pickup' | 'delivery';
  lines: StoreCartLine[]; // for "repeat order"
}

const KEY = 'pp-order-history';
const MAX = 25;

export function loadHistory(): PastOrder[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PastOrder[]) : [];
  } catch {
    return [];
  }
}

/** Prepend a newly placed order (most recent first), de-duped by order_number. */
export function addToHistory(order: PastOrder): void {
  const existing = loadHistory().filter((o) => o.order_number !== order.order_number);
  const next = [order, ...existing].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
}
