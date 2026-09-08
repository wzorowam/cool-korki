# Round 1 — Audit + crashers

## Tested
- Full static tree: `index.html`, `css/main.css`, `js/main.js`, `js/lab3d.js`, `vercel.json`, `assets/`
- Live site `https://cool-korki.vercel.app` HTTP 200
- Asset HEAD checks against production

## Bugs found
- **Crasher / broken CTA:** `assets/hello-portal.mp4` 404 on live and missing in repo. Hello portal could not play.
- Skip link missing; keyboard users land in the decorative world layer first.
- Menu button ~40px, no `aria-controls`, Escape did not close the drawer.
- Form: empty/invalid submit only used native `reportValidity`; no visible error region; localStorage failure silent.
- `--text-dim` (#6e668f on #0c0a1a) below readable contrast for small labels.
- Viewport missing `viewport-fit=cover` (browser chrome / notches).
- Favicon was a data-URI only; `/favicon.ico` 404. No `apple-touch-icon`.
- No `:focus-visible` styles (`outline: none` implicit via custom controls).

## Files changed
- `assets/hello-portal.mp4` — generated looping mascot clip so the portal CTA works
- `assets/favicon.svg`
- `index.html` — skip link, viewport-fit, video error node, form errors, mailto fallback, a11y attrs
- `css/main.css` — skip/focus styles, contrast, 44px menu, form/portal error UI
- `js/main.js` — video error → fallback CTA, Escape menu/portal, field validation + storage fail state

## Remaining
- WebGL load/resize/offscreen pause and live `prefers-reduced-motion` (Round 2)
- Mobile 375/390 overflow, orbit labels, HUD overlap (Round 3)
- Dual hero CTAs + salesy path mix (Round 4)
- OG/meta, FOUT, safe-area polish (Round 5)
- Full keyboard tab-order proof + `ROUNDS.md` (Round 6)
