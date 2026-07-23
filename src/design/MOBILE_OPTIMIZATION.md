# Los Pollos Primos POS — Mobile Android Optimization Guide

## 📱 Device Profile
- **Primary:** Android smartphones (375–412px width)
- **Secondary:** Tablets (768px+)
- **Use Case:** Point-of-sale terminal (not cashier workstation)
- **Screen:** Always landscape for better product visibility
- **Touch:** No mouse/hover — all interactions via tap

---

## 🎯 Optimization Principles

### 1. **Space Efficiency**
- Minimal chrome (header as compact as possible)
- Product grid takes up maximum visible area
- Cart displays at bottom (sticky) not sidebar
- No unused whitespace

### 2. **Tap-Friendly Design**
- All buttons ≥48×48px (Android standard)
- Gaps between targets ≥8px
- No hover-only interactions
- Quantity controls are large (±/− buttons)

### 3. **Input Optimization**
- Numeric input uses `inputMode="decimal"` to show number keyboard
- Quantity spinners are touch-friendly
- Payment input auto-focuses (ready to tap)
- No text input needed for basic sale (optional customer capture)

### 4. **Performance**
- No unnecessary animations on low-end devices
- Images lazy-loaded
- Minimal re-renders via React optimization
- Smooth 60fps interactions

---

## 📐 Layout Changes by Breakpoint

### Mobile (375–639px)
```
┌─ Header (compact) ─────────────┐
├─ Product Grid (3 cols × N rows) ├─── scrollable
├─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
└─ Cart (sticky bottom) ───────────┘
  • Total + Cobrar button (48px)
```

**Key features:**
- 3-column product grid (3 cols fit 375px with 8px gaps)
- Product cards: 110×110px (fit 3 across + padding)
- Cart is full-width at bottom (not sidebar)
- Quantity controls: ±/− buttons 44×44px each
- Payment modal: bottom sheet (slides up)

### Tablet (640–1023px)
```
┌─────────────┬────────────┐
│ Products    │   Cart     │
│ (4-5 cols)  │  (Sidebar) │
├─────────────┤────────────┤
│ (scrollable)│(sticky top)│
└─────────────┴────────────┘
```

**Key features:**
- 4-column grid
- Cart becomes fixed sidebar (380px)
- Navigation visible

### Desktop (1024px+)
```
┌────────────────────────┬──────────┐
│ Products (4-5 cols)    │  Cart    │
│ with larger cards      │ (Sidebar)│
├────────────────────────┤──────────┤
│ (scrollable)           │(sticky)  │
└────────────────────────┴──────────┘
```

---

## 🎮 Touch Interaction Patterns

### Product Selection
```
Tap product card
  ↓
Add to cart (haptic feedback on iOS)
  ↓
Update quantity in cart sidebar
```
**Responsiveness:** <100ms visual feedback (scale 0.95)

### Quantity Control
```
Tap − button (smaller target can expand hit area)
  ↓
Quantity decreases
  ↓
Total updates (real-time)
```
**Hit area:** 48×48px min, actual icon smaller (hit area extends beyond visual)

### Payment Flow
```
Tap "Cobrar" button
  ↓
Payment modal opens (bottom sheet on mobile)
  ↓
Numeric keyboard appears
  ↓
Enter amount or tap quick buttons
  ↓
Tap "Confirmar" (48px button)
```

---

## 💾 CSS Mobile-First Approach

### Tailwind Responsive Prefixes

**Mobile base (no prefix):**
```html
<div class="p-3 text-sm grid grid-cols-3">
  Mobile: 3 columns, 12px padding, 14px text
</div>
```

**Tablet override (sm: ~640px):**
```html
<div class="p-3 sm:p-4 text-sm sm:text-base grid grid-cols-3 sm:grid-cols-4">
  Tablet: 4 columns, 16px padding, 16px text
</div>
```

**Desktop override (lg: ~1024px):**
```html
<div class="p-3 sm:p-4 lg:p-6 text-sm sm:text-base lg:text-lg">
  Desktop: more padding, larger text
</div>
```

### Example: Product Grid

```jsx
<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5">
  {/* Mobile: 3 columns, 8px gap
      Tablet: 4 columns, 8px gap
      Desktop: 4-5 columns, 12px gap (via parent spacing) */}
  {products.map(p => (
    <button className="p-2 lg:p-4 text-xs lg:text-base">
      {/* Mobile: 8px padding, 12px text
          Desktop: 16px padding, 16px text */}
    </button>
  ))}
</div>
```

---

## 🎯 Key Component Optimizations

### 1. **PosPage**
```
Mobile Layout:
┌─────────────────────────┐
│ Warning banner (3px p)  │
├─────────────────────────┤
│ Product Grid (3 cols)   │
│ • Cards: 110×110px      │
│ • Text: 12px (mobile)   │
│ • Gap: 8px              │
│ • Scrollable            │
├─────────────────────────┤
│ Cart (sticky bottom)    │
│ • Items condensed       │
│ • Qty controls: 44×44px │
│ • Total + Cobrar: 48px  │
└─────────────────────────┘

Desktop Layout:
┌───────────────────────┬─────────┐
│ Products (4-5 cols)   │  Cart   │
│ Cards: 140×160px      │ Sidebar │
│ Text: 16px (base)     │ 380px w │
│ Gap: 12px             │ Sticky  │
├───────────────────────┤─────────┤
│ Scrollable            │ Sticky  │
└───────────────────────┴─────────┘
```

### 2. **PaymentModal**
```
Mobile:
- Bottom sheet (slides up from bottom)
- Full width, max 90vh height
- Compact input: 16px text, 16px padding
- Quick amount buttons: 12×12px grid
- Action buttons: 48px height

Desktop:
- Centered modal (max-w-md)
- Medium input: 24px text
- Quick amounts: larger buttons
- Action buttons: 52px height
```

### 3. **Cart Sidebar**
```
Mobile:
- Full width at bottom
- Sticky/floating above products
- Compact items (text: 12px)
- Quantity controls: 36×36px
- Total: 24px text

Desktop:
- Fixed 380px sidebar (right)
- Sticky scrolling
- Larger items (text: 16px)
- Quantity controls: 40×40px
- Total: 28px text
```

---

## ⌨️ Mobile Input Handling

### Numeric Input
```jsx
<input
  type="number"
  inputMode="decimal"           // Shows decimal keyboard
  step="0.01"                   // Currency precision
  min="0"
  value={amount}
  onChange={handleChange}
  className="text-2xl lg:text-3xl"  // Large on mobile
  autoFocus                     // Focus when modal opens
/>
```

### Telephone Input
```jsx
<input
  type="tel"
  inputMode="tel"               // Shows phone keyboard
  placeholder="WhatsApp"
  value={phone}
  onChange={handleChange}
/>
```

### Text Input
```jsx
<input
  type="text"
  inputMode="text"              // Shows standard keyboard
  placeholder="Nombre"
  value={name}
  onChange={handleChange}
/>
```

---

## 🎨 Touch Feedback

### Visual Feedback (CSS)
```css
/* Press feedback */
.button:active {
  transform: scale(0.98);       /* Slight shrink */
  opacity: 0.9;                 /* Slight fade */
  transition: transform 80ms ease-out;
}

/* Hover feedback (desktop) */
@media (hover: hover) {
  .button:hover {
    background-color: rgba(..., 0.15);
    border-color: rgba(..., 0.5);
  }
}
```

### Haptic Feedback (Future)
```javascript
// On payment confirmation (iOS/Android)
if (navigator.vibrate) {
  navigator.vibrate(200);  // 200ms buzz
}
```

---

## 📋 Mobile Testing Checklist

- [ ] **Viewport:** Test at 375px, 412px (common Android), 768px (tablet)
- [ ] **Orientation:** Portrait + Landscape (both supported)
- [ ] **Touch:** All buttons ≥48px, gaps ≥8px
- [ ] **Input:** Keyboard appears when expected (number, tel, text)
- [ ] **Scroll:** Smooth, no jank, no horizontal scroll
- [ ] **Performance:** <100ms tap feedback, 60fps scrolling
- [ ] **Readability:** Text ≥14px on mobile, ≥16px body
- [ ] **Contrast:** 4.5:1 min (WCAG AA)
- [ ] **Offline:** App still usable if connection drops
- [ ] **Safe areas:** Buttons not hidden behind notch/gesture bar
- [ ] **Landscape:** All content visible when rotated
- [ ] **Long lists:** Cart scroll doesn't bounce out of view
- [ ] **Modal:** Payment sheet slides up smoothly, swipe-to-dismiss works

---

## 🚀 Performance Optimization

### Code Splitting
```javascript
// Load heavy components only when needed
const InventoryPage = lazy(() => import('./pages/inventory/InventoryPage'));
```

### Image Optimization
```jsx
<img
  src="product.webp"
  alt="Product name"
  className="object-cover"
  loading="lazy"              // Don't load off-screen
  width={110}                 // Avoid layout shift
  height={110}
/>
```

### React Optimization
```jsx
// Prevent unnecessary re-renders
const MemoizedProductCard = memo(ProductCard);

// Efficient state updates
const addToCart = useCallback((product) => {
  setCart(prev => [...prev, product]);
}, []);
```

### CSS Optimization
```css
/* Use CSS variables for efficient theming */
.button {
  color: var(--color-primary-600);
  background: var(--color-primary-50);
}

/* Avoid expensive properties */
.card {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);  /* ✓ OK */
  /* NOT: filter: drop-shadow(...); (expensive) */
}
```

---

## 📱 Device-Specific Optimization

### Android-Specific
```css
/* Android font rendering */
body {
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: 100%;  /* No zoom on font resize */
}

/* Prevent overscroll bounce (Android 5+) */
body {
  overscroll-behavior: none;
}
```

### iOS-Specific
```css
/* Prevent zoom on input focus */
input, select, textarea {
  font-size: 16px;  /* Minimum to prevent auto-zoom */
}

/* Safe area support for notched devices */
header {
  padding-top: max(1rem, env(safe-area-inset-top));
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
```

---

## 🎯 Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| **First Tap to Add Item** | <100ms | - |
| **Cart Update** | Real-time | - |
| **Payment Modal Open** | <300ms | - |
| **Scroll Smoothness** | 60fps | - |
| **Tap Success Rate** | >98% (no mis-taps) | - |
| **Visible Content** | ≥90% of screen used | - |
| **Largest Input** | ≥16px (prevent zoom) | - |

---

## 🔄 Continuous Improvement

1. **Gather Feedback**
   - Ask cashiers about pain points
   - Track time-per-sale
   - Log mis-tap events (JavaScript)

2. **A/B Test**
   - Button sizes (48px vs 52px vs 56px)
   - Grid layouts (2, 3, 4 cols)
   - Cart position (bottom sheet vs sidebar toggle)

3. **Monitor**
   - Performance metrics (Core Web Vitals)
   - Error logs
   - User session recordings (privacy-compliant)

---

**Last Updated:** July 20, 2026
**Status:** ✅ Implementation In Progress
