# Cool Korki — 6 test + improve rounds

Night-lab discovery site for Polish adults. Work landed on `cursor/cool-korki-6-rounds-f8d1` (no `vercel --prod`).

| Round | Focus | Outcome |
| --- | --- | --- |
| 1 | Audit + crashers | Restored missing `hello-portal.mp4`, skip/focus, form errors |
| 2 | Motion + WebGL | Idle boot, hide-tab pause, live reduced-motion, mobile DPR cap |
| 3 | Mobile 375/390 | Unstuck pins, wrap orbit, swipe quests, 44px + safe-area |
| 4 | Copy + IA | One CTA **Zostaw sygnał**; who/what/next; quieter paths |
| 5 | Visual QC | OG/Twitter, dark color-scheme, rail-safe wrap |
| 6 | Polish + prove | Tab order, menu trap, this roll-up |

## What stayed
- Vanilla HTML/CSS/JS + Three.js 0.170 import map
- CSS starfield fallback when WebGL / reduced-motion
- Corky mascot, dark lab, PL-first, zero salesy
- No backend, auth, payments, WhatsApp, or Vercel CLI

## Risks still open
- Preview/prod deploy is Hermes (El) — Git merge, not this agent
- Form does not email anyone until n8n/inbox is wired
- unpkg Three.js is a single network dependency
