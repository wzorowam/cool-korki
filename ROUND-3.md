# Round 3 — Mobile

## Tested
- CSS at 640 / 390 / 375 breakpoints (sticky pin, hero, orbit, HUD, quests)
- JS quest/why scrub skipped when `max-width: 640px`
- Touch: world/canvas `pointer-events: none` + `touch-action: pan-y` on body; quest track `pan-x`

## Bugs found
- Sticky `100dvh` + `overflow: hidden` clipped the gateway hero (portal + CTAs + cue) on 375/390.
- Lab orbit used polar `transform` — pills overlapped the core and each other.
- Why panels were `position: absolute` stacked — only one readable, numbers collided with copy.
- Quest tunnel still used scroll-driven `translate3d` on a 260vh pin — fought finger scroll.
- Tap targets: rail/sound/portal/nav links under 44px.
- HUD, sound, and Korki stacked on the same bottom-right corner without safe-area insets.

## Files changed
- `css/main.css` — unstick pins on small screens, wrap orbit, stack why cards, swipeable quests, 44px targets, safe-area HUD
- `js/main.js` — do not apply why/quest transforms on `max-width: 640px`

## Remaining
- One primary CTA + tighter PL/EN (Round 4)
- OG / font FOUT / remaining visual overlap (Round 5)
- Keyboard proof + `ROUNDS.md` (Round 6)
