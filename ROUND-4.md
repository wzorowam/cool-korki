# Round 4 — Copy + IA

## Tested
- Hero, nav, mobile menu, paths, hello, Corky tip strings
- No testimonials block existed (nothing fake to remove)

## Bugs found
- Two equal hero CTAs (“Wejdź do story” + “Skip to quests”) — no single next step
- PL/EN mash without a who/what/next line; “certified chaos manager” + “C00l K0RKI” read as student-bot, not adult lab
- Paths used three primary-ish buttons + team CTA (sales sludge)
- “cool shit” / “forms of doom” / “MVP form — n8n” noise

## Files changed
- `index.html` — one primary CTA **Zostaw sygnał** (#hello); quiet story link; who/what/next; softer paths
- `css/main.css` — `.hero-who`, `.hero-quiet`; badge “lekki start”
- `js/main.js` — tip copy aligned with the single next step

## Remaining
- OG/twitter, font preload, HUD overlap QC (Round 5)
- Keyboard tab order proof, empty states polish, `ROUNDS.md` (Round 6)
