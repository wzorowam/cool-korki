# Round 6 — Polish + prove

## Tested
- `node --check` on `js/main.js` and `js/lab3d.js`
- Local static server + in-page form empty/invalid/success paths
- Keyboard: skip link → nav → chapters → form → sound → Corky; Escape closes menu/portal; menu Tab trap
- Portal video present (`assets/hello-portal.mp4`); error node if decode fails

## Bugs found
- Sound toggle sat in the DOM *before* `<main>`, so Tab hit chrome before the story
- Mobile menu had no focus trap (Tab escaped to the page behind)
- Empty form only used native bubbles; invalid email / storage fail now visible (from Round 1, verified here)
- No roll-up doc for the six rounds

## Files changed
- `index.html` — sound control after footer (tab order)
- `js/main.js` — Tab cycle inside the open mobile menu
- `ROUND-6.md`, `ROUNDS.md`

## Browser proof (local `:8765`)
- Desktop hero: one **Zostaw sygnał**, quiet story link, skip-link on Tab
- Form empty → banner + field errors; bad email → inline error; valid → success
- 375 / 390: hero not clipped, menu Escape, quests/paths scroll
- Extra CSS harden after screenshots: force-hide nav CTA + static lab pills under 900/640

## Remaining
- Contact is still localStorage + mailto (no inbox backend — out of scope)
- Three.js still loaded from unpkg (needs network once)
- Sticky pin storytelling is desktop-only; phones use a stacked flow
- Hermes/El still owns Vercel prod — this branch is PR-only
