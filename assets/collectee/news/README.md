# News art — brief

Two sets live in this directory: the **hero banners** (3:1, top of each game tab) and the
**generic article thumbnails** (1:1, used only when an article has no related item). The
`news-thumb-` prefix keeps them apart in a listing.

---

## Hero banners

Three slim banners, one per game tab on `/news`. Drop the PNGs in **this directory**.

**All three landed 7 Aug and are wired up.** `src/config/newsBanners.ts` requires them and
`/diagnostics` → Art coverage → News banners reads 3/3.

> **To replace or add one: file first, then the line.** Metro resolves `require()` at build
> time, so a line pointing at a missing file is a **build error**, not a missing image.

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

`/diagnostics` → **Art coverage** → **News banners** reads **3/3**. If it ever drops, a require
is missing or a filename changed.


---

## Generic article thumbnails — OUTSTANDING

Three square tiles, one per game. **These are not yet drawn** — `/diagnostics` reads 0/3 and
the slot currently falls back to a flat accent gradient.

Wiring is built and waiting in `src/config/newsThumbs.ts`. When the files land, replace the
three `null`s with requires, keeping the `news-thumb-val` filename on the `valorant` key:

```ts
export const NEWS_THUMBS: Record<GameTitle, ImageSourcePropType | null> = {
  codm: require('../../assets/collectee/news/news-thumb-codm.png'),
  valorant: require('../../assets/collectee/news/news-thumb-val.png'),
  mlbb: require('../../assets/collectee/news/news-thumb-mlbb.png'),
};
```

> **File first, then the line.** A `require()` at a path with no file is a build error.

| Slot id | File (exact) | Dimensions | Aspect | Fit |
| --- | --- | --- | --- | --- |
| `news-thumb-codm` | `news-thumb-codm.png` | 512×512 | 1:1 | `cover` |
| `news-thumb-val` | `news-thumb-val.png` | 512×512 | 1:1 | `cover` |
| `news-thumb-mlbb` | `news-thumb-mlbb.png` | 512×512 | 1:1 | `cover` |

Single file per slot, no `@2x`/`@3x` — same convention as the banners and `avatars/`.

### Where these appear

An 88×88 tile at the left of an article row, sitting beside rows that show **real item
renders**. They only appear for articles about no single item — one seeded article today. They
must look deliberate next to a weapon render, not like a placeholder.

- **Square, centre-weighted.** Displayed small and cropped square; nothing load-bearing near an
  edge.
- **Readable at 88px.** One clear shape or motif. No scenes, no crowds, no fine detail — it all
  disappears. These are emblems, not illustrations.
- **Same palette family as that game's banner and accent** (table above), so a row reads as
  belonging to its tab.
- **No text, no logos, no invented game marks, no recognisable characters** (§15).
- **Distinct from the banner** — a downscaled crop of the banner would read as a mistake.

**`news-thumb-codm.png`** — Original concept art, square emblem tile, single stylised
military dog-tag and ammunition-crate motif, centred, ember orange and warm amber on deep
charcoal, dramatic side light, simple silhouette readable at small size, no text, no logos, 1:1

**`news-thumb-val.png`** — Original concept art, square emblem tile, single stylised angular
tactical-visor motif, centred, crimson red and bright teal on neutral dark concrete, hard-edged
graphic shapes, readable at small size, no text, no logos, 1:1

**`news-thumb-mlbb.png`** — Original concept art, square emblem tile, single stylised faceted
gemstone-and-crown motif, centred, violet and gold on deep indigo, soft magical glow, readable
at small size, no text, no logos, 1:1
