# Round 5 — Visual QC

## Tested
- Head meta / share tags, favicon, theme-color, color-scheme
- Desktop wrap vs journey rail
- Safe-area on nav, XP bar, HUD (from Round 3)
- Font stack + `display=swap` already on Google CSS

## Bugs found
- No `og:*` / Twitter card — shares would be title-only
- No `color-scheme: dark` — form controls / UA chrome could flash light
- Desktop `.wrap` sat under the left journey rail on ~900–1100px
- Nav height ignored `safe-area-inset-top` on notched devices
- Chapter HUD still said “Gateway” after copy renamed the opening to Night lab

## Files changed
- `index.html` — canonical, OG/Twitter, dark color-scheme, mascot preload, Night lab title
- `css/main.css` — html background, desktop wrap inset, safe-area nav/XP

## Remaining
- Keyboard tab-order (sound moved after main in Round 6)
- `ROUNDS.md` + browser proof (Round 6)
