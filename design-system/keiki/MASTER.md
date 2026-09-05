# Keiki Design System — MASTER (D2, locked)

Source of truth for the reskin. Seeded from `BRAND-EXTRACT.md` (real keikicoders.com tokens).
Implementation target: `app/globals.css` (CSS custom properties + component classes), fonts self-hosted or via `next/font`. **Logic layer is frozen** — this changes tokens/markup classes only.

## 1. Color tokens (CSS variables)

```css
:root {
  /* brand */
  --kc-ink:        #0F2931;
  --kc-emerald:    #197A5A;   /* primary */
  --kc-emerald-700:#0F5740;   /* hover/pressed */
  --kc-deep-green: #0A4D37;   /* dark sections, announcement */
  --kc-aqua:       #92D4E2;   /* soft accent */
  --kc-gold:       #FFCF33;   /* sparing pop */
  /* surfaces */
  --kc-white:      #FFFFFF;
  --kc-off-white:  #F8F9FA;
  --kc-cream:      #F7EFE0;
  /* text */
  --kc-text:       #0F2931;
  --kc-muted:      #4A5551;
  --kc-on-emerald: #FFFFFF;
  /* semantic */
  --kc-success:    #197A5A;
  --kc-danger:     #C0492B;   /* warm brick, harmonizes w/ palette (not stock red) */
  --kc-focus:      #197A5A;
  /* tints */
  --kc-emerald-tint: #E7F1EC;
  --kc-aqua-tint:    #EAF6F9;
  --kc-danger-tint:  #F7E9E4;
}
```

Status → color: pending `--kc-muted`/cream · active `--kc-emerald` on tint · cancel_requested `--kc-gold` deepened · canceled/expired `--kc-muted` · dropped `--kc-danger`.

## 2. Type scale

- Families: `--kc-display: "Fredoka"`, `--kc-body: "Poppins"` (self-host via next/font).
- Body base 16px, **Poppins 300** default, line-height 1.7; emphasis 500/600.
- Headings **Fredoka 600–700**, ink, tight leading (1.05–1.15).

| Token | size / weight / family |
|---|---|
| display-xl | clamp(2.75rem, 6vw, 5rem) / 700 / Fredoka |
| h1 | clamp(2rem, 4vw, 3rem) / 700 / Fredoka |
| h2 | 1.75rem / 600 / Fredoka |
| h3 | 1.25rem / 600 / Fredoka |
| body | 1rem / 300 / Poppins |
| body-strong | 1rem / 500 / Poppins |
| eyebrow | 0.8125rem / 600 / Poppins, uppercase, +0.08em, emerald |
| small | 0.8125rem / 400 / Poppins, muted |

## 3. Spacing / radii / shadow / motion

```css
:root {
  --kc-space-1:4px; --kc-space-2:8px; --kc-space-3:12px; --kc-space-4:16px;
  --kc-space-5:24px; --kc-space-6:32px; --kc-space-8:48px; --kc-space-10:64px;
  --kc-r-pill:999px; --kc-r-card:20px; --kc-r-input:12px; --kc-r-sm:8px;
  --kc-shadow-sm:0 2px 8px rgba(15,41,49,.05);
  --kc-shadow:   0 6px 20px rgba(15,41,49,.07);
  --kc-shadow-lg:0 14px 40px rgba(15,41,49,.10);
  --kc-ease: cubic-bezier(0.16,1,0.3,1);   /* grafted signature (expo-out) */
  --kc-dur: .7s; --kc-dur-fast: .28s;
}
```

## 4. Component specs

- **Button / primary:** emerald bg, white Fredoka 600, pill radius, padding `14px 28px`, hover → emerald-700 + `translateY(-2px)` + shadow, active reset, focus-visible 3px emerald ring (offset 2px). Disabled → 55% opacity, no lift.
- **Button / secondary:** transparent, emerald text, 1.5px emerald border, pill. Hover → emerald-tint fill.
- **Input / select:** white, 1.5px `#DDE5E2` border, radius-input, padding `12px 14px`, Poppins. Focus → emerald border + 3px emerald-tint ring. Label: eyebrow style.
- **Card:** white, radius-card, `--kc-shadow-sm`, padding `24px`. Hover (interactive) → `--kc-shadow` + `translateY(-4px)` on `--kc-dur-fast`.
- **Eyebrow badge (pill):** emerald-tint bg, emerald label, honu/emoji icon left, pill, padding `6px 14px`.
- **Highlight marker:** inline-block, emerald bg, white text, radius `10px`, padding `.05em .35em`, `transform: rotate(-1.5deg)` — for one key word per heading.
- **Status pill:** pill, tint bg + matching text per §1 status map, Poppins 600 12px, padding `4px 12px`.
- **Table (staff):** header row cream bg, ink Fredoka 600 small; rows white with `1px #EEF1F0` divider; row hover cream tint; actions right-aligned. Zebra off (use dividers).
- **Nav / header:** white, wordmark left, links Poppins 500 ink w/ animated underline (emerald, scale-x origin-left) on hover/active; primary "Register" as pill button right.
- **Announcement bar:** deep-green bg, white Poppins 500, centered, dismissible visual (static ok).

## 5. Motion (motion.dev / CSS), reduced-motion-safe

- **Reveal:** `.kc-reveal { opacity:0; transform:translateY(16px); filter:blur(2px); transition: all var(--kc-dur) var(--kc-ease); } .is-visible { opacity:1; transform:none; filter:none; }` via IntersectionObserver (threshold .12).
- **Stagger:** children `--kc-reveal-item` with `transition-delay` 0/70/140/210ms…
- **Hover-lift** on cards/buttons (translateY) + **animated underline** on links.
- Guard: `@media (prefers-reduced-motion: reduce){ * { animation:none!important; transition:none!important } .kc-reveal{opacity:1;transform:none;filter:none} }`.

## 6. Accessibility gates
- Body text ink `#0F2931` on white = 13.6:1 ✓. White on emerald `#197A5A` = 4.6:1 ✓ (AA for ≥16px/bold). Gold `#FFCF33` **never** as text on white (fails) — accent/fills only, or ink text on gold.
- All interactive: visible focus ring (emerald), ≥44px hit target, `:focus-visible`.
- Motion respects reduced-motion. Forms keep native labels/validation (logic frozen).

## 7. Reskin rules (logic freeze)
Change only: className/style, wrapping markup, globals.css, font loading. **Do NOT touch:** submission-UUID generation, fetch calls, Stripe redirect, server actions, auth cookies, zod, DB. Each screen re-verified (D6) to behave identically at 1440px + 375px.
