# Design system — Los Pollos Primos

The source of truth is **`src/index.css`**. This file explains how it is organised
and records the traps that have broken this app more than once. If the two ever
disagree, the CSS wins.

---

## 1. Palette

The accent is **`brand-*` (orange, `brand-600` = `#ee6206`)**, used by the POS, the
accounting pages and the public storefront alike. Usage counts across `src/**/*.tsx`:

| Scale | Uses | Role |
|---|---:|---|
| `brand-*` | 368 | accent — CTAs, active nav, focus rings, headings |
| `charcoal-*` | 182 | text and dark surfaces |
| `cream-*` | 25 | warm neutral surfaces, input borders |
| `accent-*` | 9 | amber highlights, accounting only |
| `olive-*` | 7 | positive/success accents |
| `gold-*` | 7 | warm callouts (`.btn-warm`) |
| `chili-*` | 3 | destructive (`.btn-danger`) |

There is no brown/burnt-sienna `primary-*` scale. It existed briefly, was reverted,
and was deleted once it reached 0 usages. **Do not reintroduce it** — the owner
rejected that direction twice.

Fonts: **Poppins** (`font-display`, headings and the wordmark) + **Inter**
(`font-sans`, body), both loaded from `index.html`. `font-mono` (JetBrains Mono) is
for prices, quantities and ticket ages so columns don't jitter.

---

## 2. Component classes

Compose these instead of hand-rolling padding/colour combinations. Before they
existed the app had ~14 ad-hoc button recipes and adjacent buttons rendered at
different heights.

**Buttons** — `btn` plus one colour and optionally one size:

```html
<button class="btn btn-primary">Cobrar</button>
<button class="btn btn-secondary btn-sm">Ajustar</button>
<button class="btn btn-danger btn-lg btn-block">Cerrar caja</button>
```

| Colour | Use for |
|---|---|
| `btn-primary` | the one action that advances the workflow |
| `btn-secondary` | supporting actions (Ajustar, Volver, Editar) |
| `btn-subtle` | low-emphasis actions on a white card |
| `btn-danger` | destructive |
| `btn-warm` | warm/stateful accent (Al horno) |
| `btn-dark` | heavy, rare actions (Cerrar caja) |

Sizes: `btn-sm` 40px · default 44px · `btn-lg` 52px. `btn-block` for full width.

**Tabs** — `tab` + `tab-on` / `tab-off`. Always inside a single-line horizontal
scroller: `no-scrollbar flex gap-2 overflow-x-auto`. A wrapping tab row forced
828px of width on a 400px phone.

**Inputs** — `input`. Font size is 16px on purpose: anything smaller makes
Android and iOS zoom the viewport on focus.

**Headings** — `page-title` (18px → 24px) and `section-title` (16px → 18px). A
fixed `text-2xl` wrapped onto three lines at 375px.

**Surfaces** — `glass`, `glass-sm`, `glass-lg`, `glass-overlay`, `elevation-1..5`.

---

## 3. Traps

### Tailwind v4 layering — this has broken the app three times

Un-layered CSS **beats** `@layer utilities`, so any bare rule silently overrides
every Tailwind class on the same element. Every custom rule here belongs in
`@layer base` (element defaults) or `@layer components` (`.btn`, `.tab`, `.glass`).

Real damage caused: `.glass-button` swallowed `bg-brand-600 text-white` and the POS
"Cobrar" CTA rendered as a pale ghost; `button { min-height: 3rem }` outranked
`.btn-sm` so every small button stayed inflated; un-layered `body`/`h1..h5` rules
overrode the storefront's hero utilities.

### Named `--spacing-*` tokens hijack `max-w-*`

Declaring `--spacing-md` and friends in `@theme` makes `max-w-md` / `max-w-xl`
resolve to those values instead of container widths, which collapsed the storefront
hero to 32px. Use numeric spacing utilities.

### `main` must not be a flex container

`AppLayout`'s `<main>` is a **block** with `overflow-auto`. As a flex column its
line grows to `max-content` when a wide table overflows and **stretches** the page
root — `/batches` measured 860px on a 375px screen. `min-w-0` does not help,
because the child is being stretched rather than min-sized.

Page roots therefore use `h-full`, never a hardcoded header offset like
`h-[calc(100vh-3.5rem)]`. The real header is ~175px on a phone and ~121px on
desktop, so that calc pushed the POS "Cobrar" button off-screen with no way to
scroll to it.

### Rings get clipped inside scrollers

`ring-*` paints outside the element box, and `overflow-y-auto` clips the other axis
too, so a ringed card inside a scrolling queue renders with broken edges. Use
`border-2` with `border-transparent` in the inactive state so every card keeps the
same box size.

### Wide tables

Wrap them in `overflow-x-auto` and let cells use `whitespace-nowrap` + `tabular-nums`.
An order number like `PP-C-0028` wrapped onto three lines in a narrow column.

---

## 4. Touch and layout targets

- Interactive elements ≥ 44×44px, ≥ 8px apart. `button` has a 2.75rem floor in
  `@layer base`.
- Mobile-first: base styles target ~375px, then `sm:` (640px) and `lg:` (1024px).
- No horizontal page scroll at any width; wide content scrolls inside its own
  container.
- Kitchen and Delivery are one column on a phone and two from 640px up, so the
  large kitchen display keeps both queues side by side.

The POS is a PWA with `registerType: 'autoUpdate'`. A phone keeps serving the
cached build until it reloads, so verify production in a fresh context before
concluding a fix did not ship.
