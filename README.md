# Cool Korki

Static marketing site for **Cool Korki** — fun English learning with AI, neuroscience, and zero salesy vibes.

Built from brand notes in Notion:

- Minimal, funny, concise, cool
- Scroll = story (adventure, not brochure)
- Cool Korki character navigates the page
- 3 whys / how different
- Adventures, lab tools, soft offer paths

## Run locally

Double-click `START-SITE.bat`, or:

```powershell
cd cool-korki
node serve.js
```

Then open **http://localhost:8765**

## Experience features

- **WebGL lab room** (Three.js) — real 3D corridor; scroll walks the camera through zones
- **Scroll-story engine** — sticky chapters, lerped progress, UI overlay on top of WebGL
- **Hello video portal** — gateway ring + `assets/hello-portal.mp4` (syncs with 3D portal light)
- **Sound lab** — Web Audio ambient + chapter stingers (opt-in)
- **Fallback** — CSS starfield world if WebGL fails or `prefers-reduced-motion`
- **Journey rail** — chapter map + Korki guide

Needs **network once** to load Three.js from unpkg (import map). Offline after cache.

## Structure

```
cool-korki/
  index.html
  css/main.css
  js/main.js          # scrub + sound + portal + lab3d bridge
  js/lab3d.js         # Three.js room, path, particles, Korki
  assets/
    korki-character.jpg
    hero-bg.jpg
    hello-portal.mp4
  serve.js
```

## Next steps (when you want)

- Wire contact form to email / n8n / Notion
- Swap portal video for a real "hello" recording
- PL/EN toggle
- Deploy to Vercel
- Optional: full WebGL room (heavier path)

