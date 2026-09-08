# Round 2 — Motion + WebGL

## Tested
- `js/lab3d.js` camera path, resize, visibility, particle count
- `js/main.js` boot sequence, rAF loop, hash-link scroll (no wheel `preventDefault`)
- CSS fallback when `data-webgl=off` / `prefers-reduced-motion`

## Bugs found
- Three.js booted immediately, competing with first paint and CSS fallback.
- Main rAF + starfield kept running on hidden tabs.
- No live reaction if the user toggles reduced-motion after load.
- Resize used `innerWidth/Height` only — mobile URL-bar / visualViewport ignored.
- Particle count / DPR too high on small screens.
- World layer had no explicit `touch-action` (finger could theoretically fight the canvas).

## Files changed
- `js/main.js` — idle-deferred WebGL boot, tear-down + re-boot on motion preference, pause rAF when hidden
- `js/lab3d.js` — `setPaused`, IntersectionObserver + visibility pause, visualViewport resize, mobile DPR/particle caps
- `css/main.css` — `touch-action: pan-y` on body; canvas/world never capture pointers

## Remaining
- Mobile 375/390 hero clip, orbit overlap, 44px targets (Round 3)
- Copy / single primary CTA (Round 4)
- OG, fonts, safe-area HUD (Round 5–6)
