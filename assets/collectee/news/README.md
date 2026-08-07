# News hero banners — art brief

Three slim banners, one per game tab on `/news`. Drop the PNGs in **this directory**.

Wiring is already built and waiting. When the files land, open
`src/config/newsBanners.ts` and replace the empty map with the block quoted in its header
comment — three `require()` lines. Nothing else changes.

> **Do not add the `require()` lines before the files exist.** Metro resolves `require()` at
> build time, so a line pointing at a missing file is a **build error**, not a missing image.
> That is why the map ships empty.

## The order

| Slot id | File (exact) | Dimensions | Aspect | Fit |
| --- | --- | --- | --- | --- |
| `news-codm` | `news-codm.png` | 1200×400 | 3:1 | `cover` |
| `news-val` | `news-val.png` | 1200×400 | 3:1 | `cover` |
| `news-mlbb` | `news-mlbb.png` | 1200×400 | 3:1 | `cover` |

**Single file per slot — no `@2x` / `@3x`.** Same convention as `avatars/` (512×512) and
`communities/` (1200×800): one oversized asset, Metro scales it. 1200px wide is ~3.6× the
~328pt slot on a phone.

Note `news-val`, not `news-valorant`. The filename is the agreed slot id and the code maps
`valorant → news-val.png` explicitly.

## Constraints that apply to all three

These render **112pt tall** behind a heading. That drives everything below.

- **No text baked into the image.** The screen draws "Latest in <game>" itself. Baked copy
  would be wrong the moment the wording changes, and wrong in a different language.
- **No publisher logos, no invented game marks, no recognisable characters or named skins**
  (§15). These are original prototype scenes.
- **Wide establishing shots, no single subject.** At 112pt tall anything face-sized becomes a
  smudge. Think environment, not portrait.
- **Keep the lower-left quiet and low-value.** A bottom-up scrim carries white heading text
  across the full width; busy or bright pixels there fight it. The scrim guarantees legibility,
  but it cannot rescue a bright subject sitting under the title.
- **Composition survives a centre crop.** `cover` at 3:1 into a wider or narrower box trims the
  sides first — keep anything load-bearing away from the left and right edges.

## The three

**`news-codm.png`** — ember / warm amber
Original concept art, wide cinematic banner, modern military staging area at dusk, crates and
antenna masts in silhouette, haze and dust, ember orange and warm amber key light from a low
sun, deep near-black sky, no figures, no text, no logos, 3:1

**`news-val.png`** — crimson / teal
Original concept art, wide cinematic banner, stylised competitive arena corridor, clean
hard-edged architecture and painted floor markings, crimson red and bright teal accent lighting
on neutral concrete, sharp graphic shapes, no figures, no text, no logos, 3:1

**`news-mlbb.png`** — violet / gold
Original concept art, wide cinematic banner, high-fantasy battlefield ridge at night, distant
spires and banners, drifting embers, violet and gold magical light against deep indigo,
painterly, no figures, no text, no logos, 3:1

## Palettes these must sit with

Each tab already tints its chip, digest edge and tags with the game's accent. The banner should
belong to the same family — matching is not required, clashing is.

| Game | base | secondary |
| --- | --- | --- |
| CODM | `#FF7A29` | `#FFB347` |
| VALORANT | `#FF4655` | `#22D3C5` |
| MLBB | `#8B5CF6` | `#FFC53D` |

Until the art lands each tab draws a `base → secondary` diagonal gradient in that slot, so you
can see the target on `/news` today.

## Checking your work

`/diagnostics` → **Art coverage** → **News banners** reads `0/3` now and `3/3` when the three
files are in and the requires are pasted.
