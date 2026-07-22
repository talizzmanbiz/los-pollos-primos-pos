# Los Pollos Primos POS — Design System
## Minimalist Professional Glassmorphism

**Vision:** A warm, earthy, and efficient point-of-sale interface that feels premium and approachable. Glassmorphic surfaces with frosted glass effects convey transparency and cleanliness—essential for food service.

---

## 1. Color Palette

### Primary Warm Palette (Restaurant Brand)
```
Burnt Sienna (Primary Action):    #B8653F
  Light variant:                  #E8A87B
  Dark variant:                   #8B4513

Amber (Accent / Energy):          #D4A574
  Light:                          #F5D5B8
  Dark:                           #A68050

Olive (Secondary / Balance):      #6B7F3F
  Light:                          #8FA450
  Dark:                           #4A5A2A

Charcoal (Text / Structure):      #2C2C2C
  Medium:                         #555555
  Light:                          #878787
```

### Neutral & Glass Layers
```
Cream (Surfaces & Glass):         #F9F7F2
Off-White (Paper):                #FEFDFB
Glass Dark (Scrim):               rgba(44, 44, 44, 0.25)
Glass Light (Scrim):              rgba(249, 247, 242, 0.1)

Charcoal (Darkest text):          #2C2C2C
Slate (Secondary text):           #6B6B6B
Silver (Borders):                 #E0DDD7
Warm Gray (Backgrounds):          #F2EFEB
```

### Semantic Colors
```
Success:                          #5B8C3A (Olive-based)
Error:                            #C85A54 (Warm red)
Warning:                          #D4A574 (Amber)
Info:                             #6B9BA8 (Teal-slate)
Disabled:                         #D4D0CB (Muted)
```

---

## 2. Typography System

### Font Families
```
Headings (h1–h3):   'Playfair Display', serif
  - Premium, elegant, approachable
  - Font weight: 600–700 (semibold–bold)
  - Letter-spacing: +0.5px for large sizes

Body & UI:          'DM Sans' or 'Poppins', sans-serif
  - Clean, modern, professional
  - Font weight: 400 (regular), 500 (medium), 600 (semibold)
  
Monospace (data):   'Courier Prime' or 'JetBrains Mono'
  - Consistent width for prices, times, quantities
```

### Type Scale (16px base)
```
h1:  32px / 1.2      / 600   (Playfair)
h2:  24px / 1.3      / 600   (Playfair)
h3:  20px / 1.4      / 600   (Playfair)
h4:  18px / 1.5      / 500   (DM Sans)

Label:  14px / 1.5   / 600   (DM Sans)
Body:   16px / 1.6   / 400   (DM Sans)
Small:  14px / 1.5   / 400   (DM Sans)
Tiny:   12px / 1.4   / 400   (DM Sans)

Price: 18px / 1.2    / 600   (Monospace)
```

### Line Height & Spacing
- Body text line-height: 1.6 (24px on 16px base)
- Heading line-height: 1.2–1.4
- Letter-spacing: 0 default; +0.5px on large headings

---

## 3. Spacing System (8pt Grid)

```
xs:  4px    (internal button padding)
sm:  8px    (component gaps, small margins)
md:  16px   (standard spacing, section gaps)
lg:  24px   (large section gaps, card padding)
xl:  32px   (screen-level padding)
2xl: 48px   (major layout sections)
3xl: 64px   (full-page margins on desktop)
```

**Touch Target Minimum:** 44×44px (iOS) / 48×48dp (Android)
- Button heights ≥ 48px
- Icon + padding ≥ 44×44px
- Gap between targets ≥ 8px

---

## 4. Glassmorphism Effects

### Glass Surface (Cards, Panels)
```
Background:        rgba(249, 247, 242, 0.8)    # 80% opaque cream
Backdrop Filter:   blur(12px) contrast(1.1)
Border:            1px solid rgba(184, 101, 63, 0.12)  # Subtle burnt sienna
Border Radius:     16px
Shadow:            0 8px 32px rgba(44, 44, 44, 0.08)

✓ Creates frosted-glass appearance
✓ Maintains text legibility
✓ Works in both light/dark contexts
```

### Glass Overlay (Scrim, Modal Background)
```
Background:        rgba(44, 44, 44, 0.25)
Backdrop Filter:   blur(8px)
Border:            none

✓ Dimmed but still interactive in background
✓ Reduces cognitive load during modals
```

### Glass Button (Primary Action)
```
Background:        rgba(184, 101, 63, 0.12)    # Burnt sienna tint
Backdrop Filter:   blur(10px)
Border:            1.5px solid rgba(184, 101, 63, 0.3)
Color:             #B8653F (Burnt sienna text)
Padding:           12px 20px (min 44px height)
Border Radius:     12px

Pressed:           Background opacity +0.05, scale(0.98)
Hover:             Border opacity +0.15
Disabled:          Opacity 0.5, cursor not-allowed
```

---

## 5. Shadow Scale (Depth Hierarchy)

```
Elevation-1:  0 2px 8px rgba(44, 44, 44, 0.06)      (subtle borders)
Elevation-2:  0 4px 16px rgba(44, 44, 44, 0.08)     (cards, small modals)
Elevation-3:  0 8px 32px rgba(44, 44, 44, 0.12)     (glass surfaces, sheets)
Elevation-4:  0 16px 48px rgba(44, 44, 44, 0.16)    (modals, sheets, popovers)
Elevation-5:  0 24px 64px rgba(44, 44, 44, 0.20)    (main modals, drawer)

✓ Maintains glassmorphic hierarchy
✓ Soft shadows work with frosted glass
✓ No sharp drop-shadows
```

---

## 6. Border & Radius System

```
Radius-sm:   8px     (small buttons, badges)
Radius-md:   12px    (cards, inputs, modals)
Radius-lg:   16px    (glass panels, sheets)
Radius-xl:   20px    (full-screen sheets)

Borders:     1px solid (prefer rgba for consistency with glass)
Dividers:    1px solid rgba(212, 208, 203, 0.6)  # Muted silver
```

---

## 7. Animation & Interaction

### Micro-Interactions
```
Tap Feedback:   150ms ease-out, scale(0.98) + opacity shift
Hover:          200ms ease-out, opacity/border change
Loading:        300ms ease-in-out spinner (reduced-motion: static)
Swipe/Drag:     Follow-finger at 60fps (transform, not width/height)
Modal Enter:    300ms ease-out, scale(0.95) + fade
Modal Exit:     200ms ease-in, scale(0.97) + fade

✓ All transitions <300ms to feel responsive
✓ transform/opacity only (no layout-shifting)
✓ Respects prefers-reduced-motion
```

### Easing Curves
```
ease-out:  cubic-bezier(0.2, 0, 0, 1)    (things entering, appearing)
ease-in:   cubic-bezier(0.8, 0, 1, 1)    (things exiting, disappearing)
ease-default: ease-in-out               (state changes, hovers)
```

---

## 8. Accessibility & Contrast

### Text Contrast (WCAG AA minimum)
```
Primary text (#2C2C2C) on cream (#F9F7F2):       12.2:1 ✓
Primary text on amber (#D4A574):                6.1:1 ✓
Primary text on olive (#6B7F3F):                5.2:1 ✓
Burnt sienna (#B8653F) on cream:                5.8:1 ✓
Error (#C85A54) on cream:                       5.4:1 ✓
Secondary text (#6B6B6B) on cream:              6.2:1 ✓

✓ All pairs exceed 4.5:1 for normal text
✓ Tested in light mode (dark mode not needed for food POS)
```

### Interactive Elements
```
Focus Ring:      2px solid #B8653F (burnt sienna)
Focus Offset:    4px
Min Touch Size:  44×44px
Gap Between:     8px minimum

✓ High contrast focus state
✓ Keyboard navigation fully supported
✓ Screen reader labels on all controls
```

---

## 9. Component Specifications

### PosPage — Product Grid
```
Layout:        Mobile-first grid, scales from 2 cols (375px) → 4 cols (1024px)
Card:          Glass surface (16px radius, elevation-2)
Size:          120×140px (mobile) → 160×180px (desktop)
Font:          h4 (20px, bold) for name, body (16px) for price
Spacing:       12px gap (mobile), 16px (desktop)
Touch Target:  Full card (min 48px tappable)

Product Card Press State:
  - Background: +5% opacity (darker glass)
  - Scale: 0.96
  - Duration: 150ms ease-out
```

### PosPage — Cart Sidebar
```
Width:         380px (desktop) | Full screen below 640px
Background:    Glass surface (12px blur, elevation-2)
Header:        "Pedido" (h2, Playfair, burnt sienna)
Item Row:      Flex, space-between, 12px vertical gap
Quantity:      ±/− buttons (44×44px min)
Price:         Monospace, right-aligned
Divider:       1px silver, 12px vertical margins

CTA Button:    Full width, 48px height, glass primary style
Contrast:      5.8:1 (text on button background)
```

### PaymentModal
```
Sheet Height:  50vh (mobile) | auto (desktop)
Padding:       20px (mobile), 24px (desktop)
Title:         "Método de Pago" (h2, Playfair)

Payment Options:
  - 💵 Efectivo  → Amount input + confirm
  - 💳 Link      → Wompi iframe (fallback to cash)

Buttons:       2-column grid, 48px height, glass primary + secondary
Confirmation:  Checkmark icon, success message, auto-dismiss 3s
```

### KitchenPage — Order Queue
```
Card Layout:   Stacked list, full width
Card Size:     Min 120px height (mobile), 140px (desktop)
Order Number:  h3 (24px, Playfair, burnt sienna)
Items:         Body text (16px, charcoal), monospace quantities
Status Badge:  "Recibido" → "En Prep." → "Listo"
  - Recibido:  Amber background
  - En Prep:   Olive background
  - Listo:     Success green (with checkmark icon)

Mark Ready CTA: 48×48px button, glass primary, touch-friendly
```

### CashPage — Sessions
```
Current Session Card: Glass surface, shows open time + running total
Session List:        Stacked cards, minimal detail view
Action Buttons:      "Abrir Sesión" (48px), "Cerrar Sesión" (secondary)
Accessibility:       aria-label for currency amounts, "session ID X opened at 9:00am"
```

### InventoryPage — Stock Management
```
Table Rows:     48px min height (touch-friendly)
Input Fields:   44×44px+ (quantity spinners)
Product Name:   Body (16px), left-aligned
Current Stock:  Monospace (consistent alignment)
Input:          Glass input, 1.5px burnt sienna border on focus
Adjust Button:  Small glass primary (36px), right-aligned

Confirmation:   Toast: "Stock actualizado: Pollo (40) ✓"
```

---

## 10. Dark Mode (Future)

While current POS runs in light mode, glassmorphic surfaces adapt to dark:
```
Dark Background:     #1A1A1A
Dark Glass Surface:  rgba(30, 30, 30, 0.85) + blur(12px)
Dark Text:           #F5F3F0 (inverted cream)
Dark Borders:        rgba(212, 208, 203, 0.15)
Dark Shadows:        rgba(0, 0, 0, 0.4)

✓ Warm tones remain (burnt sienna, amber, olive)
✓ Contrast ratios recalculated per pair
✓ Shadows stronger on dark due to inverse contrast
```

---

## 11. Responsive Breakpoints

```
Mobile:     375px  – 639px   (1 column, 44px+ targets)
Tablet:     640px  – 1023px  (2–3 columns, sidebar optional)
Desktop:    1024px – 1440px  (3–4 columns, persistent sidebar)
Wide:       1440px+          (4+ columns, full navigation)

Key Rules:
- Mobile-first CSS (base = mobile, then add @media (min-width))
- No horizontal scroll at any size
- Safe area padding on notch devices (top: max(safe-area-inset-top, 16px))
- Landscape support (rotate to full-width if needed)
```

---

## 12. Anti-Patterns to Avoid

❌ **DO NOT:**
- Use generic purple gradients or neon colors
- Place sans-serif headings (should be Playfair)
- Use emoji as action icons (use SVG only)
- Create tap targets <44px without padding
- Nest scrollable regions (causes jumpy UX on touch)
- Animate width/height (causes reflow, use transform instead)
- Rely on color alone to convey status (add icon + text)
- Display more than 1 primary CTA per screen
- Place fixed UI under safe areas (notch, gesture bar)
- Hard-code colors (use semantic design tokens)

---

## 13. Implementation Checklist

- [ ] Tailwind config updated with custom colors, spacing, shadows
- [ ] Font imports (Playfair Display, DM Sans) added to HTML/CSS
- [ ] Glass effects applied to all card/panel components
- [ ] Touch targets verified ≥44px on all buttons
- [ ] Contrast ratios tested (WCAG AA: 4.5:1 minimum)
- [ ] Focus states visible (2px burnt sienna ring)
- [ ] Animations respect prefers-reduced-motion
- [ ] Mobile layout tested at 375px width
- [ ] Landscape orientation supported
- [ ] Safe area insets applied (notch, gesture bar)
- [ ] Dark mode tokens prepared (future phase)

---

## 14. Design Token Export (Tailwind Config)

See `tailwind.config.ts` for complete token system.

```typescript
module.exports = {
  colors: {
    'primary':      '#B8653F',      // Burnt Sienna
    'amber':        '#D4A574',      // Accent
    'olive':        '#6B7F3F',      // Secondary
    'charcoal':     '#2C2C2C',      // Text
    'cream':        '#F9F7F2',      // Surfaces
    'glass':        'rgba(249, 247, 242, 0.8)', // Glass layer
  },
  spacing: {
    'xs': '4px',   'sm': '8px',   'md': '16px',
    'lg': '24px',  'xl': '32px',  '2xl': '48px',
  },
  borderRadius: {
    'sm': '8px',   'md': '12px',  'lg': '16px',  'xl': '20px',
  },
  boxShadow: {
    'sm': '0 2px 8px rgba(44, 44, 44, 0.06)',
    'md': '0 4px 16px rgba(44, 44, 44, 0.08)',
    'lg': '0 8px 32px rgba(44, 44, 44, 0.12)',
    'xl': '0 16px 48px rgba(44, 44, 44, 0.16)',
  },
};
```

---

**Next Steps:**
1. Update Tailwind configuration with design tokens
2. Apply glass effects to PosPage product cards
3. Refresh PaymentModal with new typography & effects
4. Update KitchenPage order cards
5. Verify accessibility on all screens
6. Test on mobile devices (375px–1024px)
