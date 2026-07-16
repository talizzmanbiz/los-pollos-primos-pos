// Storefront cart, persisted to localStorage (guest checkout, no account).
import type { Product } from '../../types/database';

export interface StoreCartLine {
  sku: string;
  name: string;
  price: number;
  quantity: number;
}

const KEY = 'pp-store-cart';

export function loadCart(): StoreCartLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoreCartLine[]) : [];
  } catch {
    return [];
  }
}

export function saveCart(cart: StoreCartLine[]) {
  localStorage.setItem(KEY, JSON.stringify(cart));
}

export function clearCart() {
  localStorage.removeItem(KEY);
}

export function addLine(cart: StoreCartLine[], product: Product): StoreCartLine[] {
  const existing = cart.find((l) => l.sku === product.sku);
  if (existing) {
    return cart.map((l) => (l.sku === product.sku ? { ...l, quantity: l.quantity + 1 } : l));
  }
  return [...cart, { sku: product.sku, name: product.name, price: product.price, quantity: 1 }];
}

export function changeLineQty(cart: StoreCartLine[], sku: string, delta: number): StoreCartLine[] {
  return cart
    .map((l) => (l.sku === sku ? { ...l, quantity: l.quantity + delta } : l))
    .filter((l) => l.quantity > 0);
}

export function cartSubtotal(cart: StoreCartLine[]): number {
  return Math.round(cart.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100;
}
