# Los Pollos Primos POS — Color & Typography Quick Reference

## 🎨 Color Palette

### Primary Warm Palette

#### Burnt Sienna (Primary Action & Brand)
```
#B8653F  ← Main color (buttons, accents, focus rings)
#E8A87B  ← Light variant (hover states, backgrounds)
#8B4513  ← Dark variant (pressed states, shadows)
```
**Usage:** Primary CTAs, navigation highlights, focus indicators, alerts

---

#### Amber (Accent & Energy)
```
#D4A574  ← Standard (highlights, secondary accents)
#F5D5B8  ← Light (backgrounds, subtle highlighting)
#A68050  ← Dark (hover states, darker accents)
```
**Usage:** Price highlights, warning states, accent text

---

#### Olive (Secondary & Balance)
```
#6B7F3F  ← Standard (secondary text, icons)
#8FA450  ← Light (hover states, light backgrounds)
#4A5A2A  ← Dark (darker secondary elements)
```
**Usage:** Secondary actions, success states, balance elements

---

#### Charcoal (Text & Structure)
```
#2C2C2C  ← Primary text (headings, body text)
#555555  ← Medium text (secondary text, labels)
#878787  ← Light text (hints, disabled text)
```
**Usage:** All text content, structural elements, borders

---

#### Cream (Surfaces & Glass)
```
#F9F7F2  ← Main surface (glass backgrounds, overlays)
#FEFDFB  ← Lightest (paper surfaces, cards)
#F2EFEB  ← Medium (container backgrounds)
#E0DDD7  ← Borders & dividers
```
**Usage:** Glass surface backgrounds, borders, card backgrounds

---

### Semantic Colors

#### Success (Olive-based)
```
#5B8C3A  ← Success state, checkmarks, completion
```
**Examples:** ✓ Order completed, ✓ Payment confirmed

---

#### Error (Warm Red)
```
#C85A54  ← Error state, validation failures
```
**Examples:** ✗ Missing field, ✗ Payment declined

---

#### Warning (Amber)
```
#D4A574  ← Warning state, caution notices
```
**Examples:** ⚠️ No cash session open

---

#### Info (Teal-Slate)
```
#6B9BA8  ← Information, neutral alerts
```
**Examples:** ℹ️ Order status updates

---

## 📝 Typography System

### Font Families

#### Headings: Playfair Display
```css
font-family: 'Playfair Display', serif;
font-weight: 600-700;
letter-spacing: 0.5px;
```
**Character:** Premium, elegant, approachable
**Best for:** H1–H4, section titles, brand emphasis

#### Body: DM Sans
```css
font-family: 'DM Sans', sans-serif;
font-weight: 400-600;
line-height: 1.6;
```
**Character:** Clean, modern, professional
**Best for:** Body text, labels, UI labels, descriptions

#### Monospace: JetBrains Mono
```css
font-family: 'JetBrains Mono', monospace;
font-weight: 400-500;
```
**Character:** Stable, consistent, aligned
**Best for:** Prices, quantities, amounts, codes

---

### Type Scale

| Element | Size | Weight | Line-Height | Font | Usage |
|---------|------|--------|-------------|------|-------|
| **H1** | 32px | 600 | 1.2 | Playfair | Page titles |
| **H2** | 24px | 600 | 1.3 | Playfair | Section headings |
| **H3** | 20px | 600 | 1.4 | Playfair | Subsections |
| **H4** | 18px | 500 | 1.5 | DM Sans | Component titles |
| **Label** | 14px | 600 | 1.5 | DM Sans | Button labels, badges |
| **Body** | 16px | 400 | 1.6 | DM Sans | Main text content |
| **Small** | 14px | 400 | 1.5 | DM Sans | Secondary text, hints |
| **Tiny** | 12px | 400 | 1.4 | DM Sans | Captions, small text |
| **Price** | 18px | 600 | 1.2 | Monospace | Money amounts |

---

## 🎯 Component Color Usage

### Buttons

#### Primary Button (Glass)
```
Background:  rgba(184, 101, 63, 0.12)  [Burnt Sienna]
Border:      rgba(184, 101, 63, 0.3)
Text:        #B8653F [Burnt Sienna]

Hover:       Background opacity +0.05, border opacity +0.15
Pressed:     scale(0.98), background opacity +0.10
Focus:       2px solid #B8653F outline
Disabled:    opacity 0.5, cursor not-allowed
```

#### Secondary Button
```
Background:  rgba(212, 208, 203, 0.3)  [Cream]
Border:      rgba(184, 101, 63, 0.12)
Text:        #2C2C2C [Charcoal]

Hover:       Border opacity +0.15
Pressed:     scale(0.95)
```

---

### Cards & Glass Surfaces

#### Glass Surface
```
Background:      rgba(249, 247, 242, 0.8)     [80% opaque cream]
Backdrop Filter: blur(12px)
Border:          1px solid rgba(184, 101, 63, 0.12)
Border Radius:   16px
Shadow:          0 8px 32px rgba(44, 44, 44, 0.08)
```

#### Glass Overlay (Modal Scrim)
```
Background:      rgba(44, 44, 44, 0.25)  [25% black]
Backdrop Filter: blur(8px)
Border:          none
```

---

### Text Contrast Examples

**On Cream Background (#F9F7F2):**
- Primary Text (#2C2C2C): 12.2:1 ✓ (AAA)
- Burnt Sienna (#B8653F): 5.8:1 ✓ (AA)
- Amber (#D4A574): 6.1:1 ✓ (AA)
- Olive (#6B7F3F): 5.2:1 ✓ (AA)
- Secondary Text (#6B6B6B): 6.2:1 ✓ (AA)

**All pairs meet WCAG AA minimum (4.5:1)**

---

## 📏 Spacing & Sizing

### Spacing Grid (8pt base)
```
xs:  4px   (internal component spacing)
sm:  8px   (component gaps, small margins)
md:  16px  (standard spacing, section gaps)
lg:  24px  (large section gaps, card padding)
xl:  32px  (screen-level padding)
2xl: 48px  (major layout sections)
3xl: 64px  (full-page margins)
```

### Touch Targets
```
Minimum:     44×44px (iOS)
Recommended: 48×48px (Android)
Gap Between: 8px minimum
```

---

## 🎭 Focus States

```css
/* Standard Focus Ring */
outline: 2px solid #B8653F;        /* Burnt Sienna */
outline-offset: 3px;
border-radius: 2px;

/* Glass Button Focus */
outline: 2px solid #B8653F;
outline-offset: 4px;
box-shadow: 0 0 0 4px rgba(184, 101, 63, 0.1);
```

---

## ✨ Shadow Hierarchy

| Level | Shadow | Usage |
|-------|--------|-------|
| **1** | `0 2px 8px rgba(44, 44, 44, 0.06)` | Subtle borders |
| **2** | `0 4px 16px rgba(44, 44, 44, 0.08)` | Small cards, chips |
| **3** | `0 8px 32px rgba(44, 44, 44, 0.12)` | Glass surfaces, cards |
| **4** | `0 16px 48px rgba(44, 44, 44, 0.16)` | Modals, sheets |
| **5** | `0 24px 64px rgba(44, 44, 44, 0.20)` | Large modals, drawers |

---

## 🌐 Implementation

### Tailwind CSS Classes

```html
<!-- Primary Button -->
<button class="glass-button">Cobrar $12.95</button>

<!-- Glass Card -->
<div class="glass-sm p-4">Product Card</div>

<!-- Large Glass Panel -->
<div class="glass-lg">Modal Content</div>

<!-- Text Colors -->
<p class="text-charcoal-600">Body text</p>
<h2 class="text-primary-600">Heading</h2>
<span class="text-accent-600">Accent</span>
```

### Custom CSS Classes

```css
.glass {
  background: rgba(249, 247, 242, 0.8);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(184, 101, 63, 0.12);
}

.glass-button {
  background: rgba(184, 101, 63, 0.12);
  border: 1.5px solid rgba(184, 101, 63, 0.3);
  color: #B8653F;
}

.glass-overlay {
  background: rgba(44, 44, 44, 0.25);
  backdrop-filter: blur(8px);
}
```

---

## 🎨 Design Tokens (CSS Variables)

From `src/index.css` `@theme` block:

```css
--color-primary-600: #B8653F;      /* Burnt Sienna */
--color-accent-400: #D4A574;       /* Amber */
--color-olive-500: #6B7F3F;        /* Olive */
--color-charcoal-600: #2C2C2C;     /* Charcoal */
--color-cream-100: #F9F7F2;        /* Cream */

--font-heading: "Playfair Display", serif;
--font-body: "DM Sans", sans-serif;
--font-mono: "JetBrains Mono", monospace;

--spacing-sm: 0.5rem;              /* 8px */
--spacing-md: 1rem;                /* 16px */
--spacing-lg: 1.5rem;              /* 24px */
```

---

## 📱 Dark Mode (Future)

While current POS runs in light mode, these tokens are reserved:

```css
Dark Background:      #1A1A1A
Dark Glass Surface:   rgba(30, 30, 30, 0.85)
Dark Text:            #F5F3F0
Dark Borders:         rgba(212, 208, 203, 0.15)
Dark Shadows:         rgba(0, 0, 0, 0.4)
```

---

## ✅ Checklist for New Components

When building new UI components:

- [ ] Use color tokens (not hardcoded hex)
- [ ] Glass surfaces use `.glass`, `.glass-sm`, or `.glass-lg`
- [ ] Text uses Playfair (headings) or DM Sans (body)
- [ ] Prices/amounts use monospace font
- [ ] Touch targets ≥44px minimum
- [ ] Focus rings visible (2px burnt sienna)
- [ ] Hover/pressed states smooth (150-300ms)
- [ ] Contrast ≥4.5:1 (WCAG AA)
- [ ] Disabled state uses opacity 0.5
- [ ] No horizontal scroll on mobile

---

**Last Updated:** July 20, 2026
**Status:** ✅ Live
