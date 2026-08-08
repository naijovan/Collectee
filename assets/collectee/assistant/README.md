# Assistant art — brief

Two sets live here: the **launcher mascot** (square, circle-cropped) and the **tour guide
poses** (tall, full-figure). Different shapes, different backgrounds — read both sections.

---

## 1. Launcher mascot

One image. Drop it in **this directory**.

Wiring is built and waiting. When the file lands, open `src/config/assistantArt.ts` and
replace the `null` with:

```ts
export const ASSISTANT_MASCOT: ImageSourcePropType | null =
  require('../../assets/collectee/assistant/assistant-mascot.png');
```

Nothing else changes. Until then the launcher draws its sparkle glyph, which is the
current shipped look — the greeting pill and the wave animation already work without art.

> **File first, then the line.** Metro resolves `require()` at build time, so a line
> pointing at a missing file is a **build error**, not a missing image.

## The slot

| Slot id | Path | Dimensions | Aspect | Fit |
| --- | --- | --- | --- | --- |
| `assistant-mascot` | `assets/collectee/assistant/assistant-mascot.png` | **512×512** | 1:1 | `cover` |

Single file, no `@2x`/`@3x` — same convention as `avatars/` and `news/`. Metro scales one
oversized asset.

**Why 512.** It renders at two sizes: **56pt** in the launcher bubble and **28pt** in the
panel header. 512 is ~9× the larger of those, so it stays crisp well past @3x on both, and
matches the avatar roster so the packs stay consistent.

## Composition — it is circle-cropped at both sizes

Both call sites clip to a circle with `overflow: hidden`. Nothing outside the inscribed
circle survives.

- **Head-and-shoulders, centred, filling the frame.** Not a full body — at 28pt a whole
  figure is a smudge. Think avatar, not illustration.
- **Keep the face inside the middle ~70%.** The corners are cropped away entirely, and the
  bubble has a 2px ring that eats a little more.
- **Readable at 28pt.** One clear silhouette, strong value contrast between the character
  and its background. If it does not survive being squinted at, it is too detailed.
- **Warm, friendly, forward-facing.** This is a greeting mascot — it sits next to
  "Ask … 👋". Eyes toward camera.

## Palette

Sits on `colors.accent` (`#2F6BFF`) with an `accentPressed` (`#2454CC`) ring, on the dark
theme. Give it a background that reads against that blue — a **warm or light** subject works
best; a mid-blue character will disappear into the ring.

## Rules

- **No text, no logos, no watermark.**
- **No publisher characters and no lookalikes** (§15). This is ORIGINAL character art.
  Specifically **do not draw a Mobile Legends hero** — see the naming note below.
- Solid or simple background. No transparency needed; the circle crop handles the shape.

## Naming — settled

The assistant persona is called **Colly** (`ASSISTANT_NAME` in
`src/components/assistantDock.ts`). It was "Miya" until 8 Aug, which was a shipped Mobile
Legends hero name that this app already uses for a Moonton character.

**The art must be an original character that does not resemble any publisher's** (§15). That
was true under the old name and is still true.

The pose files are still named `miya-tour-*.png`. That is deliberate — they are internal
wired paths in `tourGuideArt.ts` and `validate-fixtures.ts`, and renaming a bundled asset
buys nothing but a chance to break a `require()`. The filename is not a label anyone sees.


---

## 2. Tour guide poses — OUTSTANDING

Three full-figure poses of the same character as the launcher mascot. She guides the
first-run walkthrough: she stands large on screen, the world dims behind her, and she
gestures at whatever is being highlighted.

Wiring is built and waiting in `src/config/tourGuideArt.ts`. When all three land, replace
the nulls with requires and flip `FEATURES.tourGuideColly` to `true`:

```ts
export const GUIDE_POSES: Record<GuidePose, ImageSourcePropType | null> = {
  talking: require('../../assets/collectee/assistant/miya-tour-talking.png'),
  pointing: require('../../assets/collectee/assistant/miya-tour-pointing.png'),
  happy: require('../../assets/collectee/assistant/miya-tour-happy.png'),
};
```

> **All three or none.** The overlay checks `guidePosesReady()` and stays on the old card
> tour until the pack is complete — a run that shows a character for two stops and a gap
> for the third is worse than no character. **File first, then the line**; a `require()` at
> a missing path is a build error.

| Slot | File (exact) | Dimensions | Aspect | Background |
| --- | --- | --- | --- | --- |
| `talking` | `miya-tour-talking.png` | **768×1024** | 3:4 | **transparent** |
| `pointing` | `miya-tour-pointing.png` | **768×1024** | 3:4 | **transparent** |
| `happy` | `miya-tour-happy.png` | **768×1024** | 3:4 | **transparent** |

### Background must be transparent — not a gradient

These composite over a live app screen behind a dark scrim, and the scrim's colour changes
across the viewport. Any baked background would show as a rectangle floating over the app.
**True alpha, cleanly cut, no matte halo, no drop shadow baked in.**

This is the opposite of the launcher mascot in section 1, which is circle-cropped and wants
a solid background. Do not copy that rule across.

### Why 768×1024

She renders at ~40% of viewport height — about 320–420px tall on a phone, up to ~700px on a
desktop window. 1024 tall covers the largest of those at better than 1:1 and stays crisp at
@2x on a phone. 3:4 is the frame; she is scaled by height with `contain`, so the width is
free as long as the aspect holds.

### Composition — all three

- **Full figure, head to feet, inside the frame.** She is never cropped by a screen edge —
  the layout guarantees it — so nothing may be cropped by the canvas either. Leave ~4%
  padding on every side.
- **Feet toward the bottom of the frame**, standing. She is anchored to a screen edge.
- **Consistent scale and eyeline across all three.** They swap between stops with only a
  small settle; if her head jumps size or height between poses, the swap reads as a glitch.
- **Same character, costume and palette as the launcher mascot.** Same person, further away.
- **No baked text, no logos, no watermark, no speech bubble** — the app draws the bubble.
- **No baked shadow or glow.**

### `pointing` is drawn ONCE and mirrored in code

She points toward **her own left** (the viewer's right as drawn). When she stands to the
right of a highlighted region the app flips her horizontally with `scaleX: -1`.

That only works if she is **horizontally mirror-safe**: no text anywhere, no asymmetric
readable prop, no hair parting or costume detail that would read as wrong reversed. If the
design genuinely needs asymmetry, say so and we will order a second file instead of
flipping — do not solve it by making the pose ambiguous.

### Per-pose notes

**`miya-tour-talking.png`** — Neutral presenting stance, weight settled, facing the viewer.
One hand open at about waist height in a light explanatory gesture, the other relaxed. Warm,
attentive expression, mouth slightly open as if mid-sentence. This is the default pose and
the one seen most, so it must be comfortable to look at for several seconds at a time.

**`miya-tour-pointing.png`** — Same character, turned about 20° toward her own left, arm
extended in a clear point in that direction — **arm fully clear of the torso silhouette** so
the gesture reads at small size against a dark scrim. Head turned slightly back toward the
viewer so she is still addressing them while indicating something else. Bright, inviting
expression. This is the workhorse pose: four of the five stops use it.

**`miya-tour-happy.png`** — Celebration beat, used once at the final stop. Both hands raised
or one in a small triumphant gesture, big genuine smile, chin up, weight light. The app adds
a small scale pulse on top, so the pose should read as joyful while still standing — not a
jump, and nothing that would look odd being gently scaled.
