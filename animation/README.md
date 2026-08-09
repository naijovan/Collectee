# Collectee — motion handoff pack

Everything an animator needs to move Collectee's UI around, exported from the
real build rather than mocked up. **Read the gaps section** — three of the
requested items could not be produced from this repo and are named there rather
than quietly missing.

---

## What's here

```
animation/
  logo/        the mark: layered SVG, transparent PNG, light and dark
  colly/       the assistant mascot, four poses
  screens/     nine full screens, captured from the actual app
  elements/    transparent PNGs: artwork, backdrops, avatars, covers
  brand/       brand-sheet.pdf — colours, type, radius, shadows, logo rules
```

---

## logo/

| File | What it is |
| --- | --- |
| `collectee-mark.svg` | **Layered vector redraw.** Four named groups — `#card-back`, `#card-mid`, `#card-front`, `#sparkle` — each card split into `-fill` and `-rim`. This is the one to animate. |
| `collectee-mark-transparent.png` | 1024², trimmed, alpha. The exact shipped artwork. |
| `collectee-mark-on-dark.png` | On `#0B0D10`, the app's own background. |
| `collectee-mark-on-light.png` | On white, for light backgrounds and print. |
| `collectee-mark-master-1254.png` | Untrimmed original, 1254², in case you want the authored margin. |
| `collectee-mark-key.png` | Keyed variant from the art pass. |

**The SVG is a redraw, not a trace.** The shipped mark is a raster render with a
soft volumetric glow that has no faithful vector equivalent. The SVG reproduces
its *geometry* so the shapes move independently; use the PNG when the exact look
matters. The file's header comment suggests a fan-out build.

---

## colly/

The in-app assistant. `assistant-mascot.png` is the panel figure; the three
`miya-tour-*` files are the tour poses — **happy**, **pointing**, **talking**.

These are **separate poses, not separate layers.** They are flat renders, so an
arm cannot be moved independently. Pose-to-pose is the animation this supports;
rigging would need the character redrawn in parts.

---

## screens/

Captured from a real production build at 1440px wide, signed in as the demo
account, with the first run already complete.

| File | Route |
| --- | --- |
| `01-home.png` | Home — hero, gaming updates, Explore Collections |
| `02-explore-collectors.png` | Explore — collector matching |
| `03-collections.png` | Collections — grid plus suggestions |
| `04-profile-inventory.png` | Profile — identity, stats, inventory rail |
| `05-import.png` | Import — upload step |
| `06-showroom.png` | Showroom detail |
| `07-inventory-verification.png` | **Verification state** — verified vs unverified badges |
| `08-collection-detail.png` | A single collection |
| `09-community.png` | A community — leadership, discussions |

These are **flattened screenshots**, which is what a running app can give. See
the gaps section for why they are not Figma frames.

### Re-capturing them

The recipe, if you change a screen and want fresh shots:

```bash
EXPO_PUBLIC_SKIP_FIRST_RUN=1 npx expo export --platform web --output-dir /tmp/shots
# serve /tmp/shots with an SPA fallback (a plain static server 404s on /room/<id>)
# then, per route:
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars \
  --window-size=1440,1600 --virtual-time-budget=25000 \
  --screenshot=out.png "http://localhost:8900/boot.html?to=/collections"
```

Three things that will bite you, all learned the hard way:

- **The virtual-time budget must be ~25s.** At 9s the services have not resolved
  and you capture a loading skeleton that looks plausible at thumbnail size.
- **The showroom needs `--use-gl=swiftshader --enable-unsafe-swiftshader`,**
  or the 3D canvas renders black.
- **A plain static server 404s on dynamic routes** like `/room/<id>` — it needs
  the SPA fallback that `vercel.json` provides in production.

`boot.html` is a one-line page that writes the first-run keys to `localStorage`
and then redirects, because the app reads them on mount and there is no way to
inject them into a headless screenshot after load.

---

## elements/

Transparent PNGs, ready to move independently.

| Folder | Count | What |
| --- | --- | --- |
| `artwork/` | 12 | Collectible renders — a representative spread across the three games, including every character with a 3D mesh |
| `backgrounds/` | 6 | Room backdrops, one per showroom theme |
| `game-covers/` | 4 | Game tiles used in the import picker |
| `avatars/` | 15 | The full avatar roster |
| `communities/` | 9 | Community header art |

### The UI pieces you asked for that are NOT files

These are **drawn in code**, so there is no asset to export. Their exact specs
are in `brand/brand-sheet.pdf`, which is enough to rebuild them in After Effects
or Figma in a few minutes each:

- **Collectible cards** — a container (14px radius, `#141821`, 1px `#252B38`)
  with artwork filling it and a gradient scrim carrying the text. The *artwork*
  is in `elements/artwork/`; the frame is CSS.
- **Verified badge** — a pill, 1px border, transparent fill. Verified `#31C48D`,
  unverified `#6B7484`. Never a solid block.
- **Game selector** — the three cards in `elements/game-covers/`, each with its
  game accent on the border.
- **Pedestal** — part of the room backdrop, not a separate object. The item is
  composited over it at runtime from a fractional slot map.
- **Collection cards** — composed live from up to three member artworks in
  slanted panels. Not a baked image, by design: a baked collage would lie the
  moment someone adds an item.
- **Icons** — drawn line icons, not an icon font.

---

## brand/

`brand-sheet.pdf` — one page covering colours with hex codes, the single brand
gradient, per-game accents, the rarity scale, type, radius and spacing tokens,
shadows and the two distinct hover treatments, the overlay/scrim rule, icon
treatment, and logo rules.

**Every value is read from `src/theme/theme.ts`,** not sampled from a
screenshot. If the sheet and the app ever disagree, the app is right and the
sheet is stale — regenerate with:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --no-pdf-header-footer \
  --print-to-pdf=animation/brand/brand-sheet.pdf \
  "file://$PWD/animation/brand/brand-sheet.html"
```

---

## Gaps — what could not be produced here

**1. Figma frames.** There is no Figma file. This app was built directly in
React Native; the layouts exist as code and as the screenshots above, and
nothing would be gained by me hand-rebuilding them in a design tool from the
same source I already have. If a designer needs editable frames, the fastest
route is importing the PNGs and rebuilding the few components that matter using
the brand sheet's tokens.

**2. Colly as separate character layers.** The four poses are flat renders. Only
whoever generated them can produce a layered version.

**3. SVG for anything except the logo.** The item artwork, backdrops, avatars
and community art are all raster renders. They cannot be vectorised without
being redrawn, and tracing them would produce something both worse-looking and
larger than the PNG.

## One constraint worth carrying into the animation

All artwork here is **original prototype work**. There are no publisher assets,
no game logos and no real character likenesses anywhere in this pack (§15). If
the animation needs a game's mark, it has to be cleared — do not source one.
