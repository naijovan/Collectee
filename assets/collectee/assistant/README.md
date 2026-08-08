# Assistant mascot — art brief

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

## ⚠️ Naming, before you draw

The mascot is currently called **"Miya"** (`ASSISTANT_NAME` in
`src/components/assistantDock.ts`). That is a shipped Mobile Legends hero name, and this app
already uses it for a Moonton character — `avatar-mlbb-miya` in the avatar roster,
`mlbb-miya-modena-butterfly` in the catalogue.

**Do not draw the MLBB Miya.** Whatever the name settles on, the art must be an original
character that does not resemble any publisher's. If the name changes to something original,
nothing about this brief changes.
