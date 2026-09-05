# Keiki Coders — Brand Extract (D1)

**Source of truth:** https://www.keikicoders.com/ (Squarespace, server-rendered).
Extracted via Playwright computed-styles + screenshots — **not invented**. Raw dump: `scratchpad/keiki-tokens.json`.

## Archetype & emotion
Caregiver + Sage, island-warm. **Playful · trustworthy · sunny.** Rounded, friendly, high-whitespace, credible-not-corporate. Hawaiian cultural cues (keiki, honu/sea-turtle, ʻokina).

## Palette (exact, from computed styles)

| Token | Hex | Source (rgb / hsla) | Role |
|---|---|---|---|
| Ink | `#0F2931` | rgb(15,41,49) / hsla(194,53%,12.5%) | Primary text, display headings |
| Emerald (brand) | `#197A5A` | rgb(25,122,90) | Primary buttons, highlight marker, links |
| Deep green | `#0A4D37` | rgb(10,77,55) | Announcement bar, dark sections |
| Green-700 | `#0F5740` | rgb(15,87,64) | Hover/pressed on emerald |
| Aqua | `#92D4E2` | rgb(146,212,226) / hsla(190.5,58%,73%) | Soft accent, honu-shell, info tints |
| Sun gold | `#FFCF33` | rgb(255,207,51) | Sparing pop — highlights, success sparkle |
| Cream | `#F7EFE0` | hsla(41,61%,94%) | Warm surface / cards on white |
| Off-white | `#F8F9FA` | rgb(248,249,250) | Page alt background |
| Muted | `#4A5551` | rgb(74,85,81) | Secondary text |
| White | `#FFFFFF` | — | Base background, on-emerald text |

## Typography
- **Display / headings:** **Fredoka** (rounded, playful). Weights 600–700. Seen at 88px/700, 54px, big and confident. Google Font.
- **Body / UI:** **Poppins**. Body 16px weight **300** (light), line-height ~1.8; emphasis 500/600. Google Font.
- Eyebrows: Poppins 600, uppercase, letter-spaced, emerald.

## Signature brand devices (must reproduce)
1. **Highlight marker** — key words sit on a rounded emerald block (white text), slight tilt (~-2°), like a hand-drawn highlighter. *The* Keiki motif.
2. **Pill buttons** — fully rounded (`border-radius: 999px`), solid emerald, white Fredoka, generous padding.
3. **Eyebrow badge pill** — mint/aqua-tint background, honu icon, uppercase emerald label.
4. Big rounded display + airy whitespace + white surfaces. Soft/near-zero shadows.

## Shape & depth
- Radii: pills `999px` (buttons, badges, status); cards `16–20px`; inputs `12px`.
- Shadows: minimal — soft ambient only (`0 4px 16px rgba(15,41,49,.06)`), no harsh drops.

## Imagery
Documentary candid photos of real keiki coding / building / VR — diverse, indoors, authentic. (We have none of these assets — see "Assets still needed".)

## Grafted portfolio signatures (subordinate to Keiki)
From `MYPORTFOLIO` (React + framer-motion + IntersectionObserver):
1. **Scroll-reveal** — easing `cubic-bezier(0.16,1,0.3,1)`, ~0.8s, opacity+translateY(8–16px)+slight blur.
2. **Stagger** — `.reveal-item` 70ms nth-child cascade for lists/cards.
3. **Micro-interactions** — animated underline (scale-x, origin-bottom-right) on links; card hover-lift `translateY(-4px)`.
All gated behind `prefers-reduced-motion`.

## Assets still needed from client
- **Logo files** (honu mark + wordmark, SVG/PNG, on-light + on-dark). Site logo is a Squarespace-CDN raster; we don't have the source.
- **Brand photography** (or permission to use kid photos). Without them, v1 uses brand-colored illustrative shapes/patterns, not stock.
- **Exact font licensing confirmation** (Fredoka + Poppins are open-source Google Fonts — fine to self-host).
- Confirmation of the gold `#FFCF33` usage rules (accent only vs. brand secondary).
