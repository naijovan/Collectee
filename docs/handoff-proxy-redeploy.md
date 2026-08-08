# For Marcus — the `collectee` proxy needs a redeploy

**TL;DR:** `api/assistant.ts` changed on `main`. Redeploy the `collectee` Vercel
project from latest `main`. No config changes, no new env vars. Until you do,
the import scanner runs at roughly a fifth of its accuracy.

---

## Why it matters right now

I measured the scanner against all 54 files in `demo/` — the real thing, same
model and prompt as production, not a mock.

- **Before:** 9 of 54 matched. CODM 5/15, Valorant 4/21, **MLBB 0/18**.
- **After:** of the 41 that completed, **36 matched, none unmatched**.
  CODM 12/15, Valorant 20/21.

(The other 13 stopped on an API credit error, so they are untested rather than
failed.)

Jovan hit this as "This one is not in our Call of Duty: Mobile catalogue" on
items that are very much in the catalogue.

## What was wrong

`scanService` sent each catalogue row as **id, name, rarity, game**.

That is fine for an inventory *screenshot* — every tile has a printed label, so
the match is text against text. It falls apart on a **single-item upload**
(§11 F1's "kind B", and the common case), where there is no label at all. The
model then has to compare what it can *see* against a list of *names*, and
nothing about "Ironclad" predicts a desert-tan camo.

The nine that worked before the fix give it away: Arctic Hunter, Molten Core,
Sandstorm, Frostbite, Nebula Sheriff — every one an item whose **name already
describes its own picture**. MLBB names are hero-plus-epithet almost throughout
("Cherry Witch", "Serpent Lord"), which is why it scored zero.

## What changed

A fifth column, `look` — one short visual description per item.

- `scripts/bake-item-looks.ts` → `src/config/itemLooks.ts` (94 entries).
  A **build step**, like the art and palette bakes. No runtime model call is
  added, so §12.1 still holds.
- The describer is deliberately **not** told the item's name. Given the name it
  describes the *name* ("Ironclad" → "armoured plating") and the column collapses
  back into the thing it exists to replace.

### Changes inside `api/assistant.ts`

1. `CatalogueRow` gained an optional `look?: unknown`.
2. It is validated like the others, defaulting to `''`:
   ```ts
   look: typeof row.look === 'string' ? row.look.trim() : '',
   ```
3. `scanContent()` appends it as a fifth tab-separated column and the fence now
   reads `id, name, rarity, game, look`, with a line explaining what `look` is
   for and to fall back to the name when it is empty.
4. `SCAN_SYSTEM_PROMPT` gained a paragraph: prefer `look` for a label-less
   image, but a **printed label still wins** over a resemblance, because a read
   label is stronger evidence.

Nothing else moved. Same endpoint, same `mode` values, same response schema,
same model (`claude-opus-5` for scan), same env var (`ANTHROPIC_API_KEY`).

## Backward and forward compatibility

- **Old client → new proxy:** fine. No `look` sent, the column is `''`, the
  prompt says to use the name for those rows. Behaves as it does today.
- **New client → old proxy:** this is the situation right now. The client sends
  `look`, the deployed function ignores it, and accuracy stays at 9/54. Nothing
  errors, which is exactly why it needs saying out loud — it fails quietly.

So the redeploy is what turns the fix on. There is no partial state to worry
about and no ordering requirement.

## What to do

1. Redeploy the `collectee` project from latest `main` (`7c41283` or later).
2. Confirm `ANTHROPIC_API_KEY` is still set on that project. Unchanged, but the
   scan is the only thing that spends real money, so it is worth eyeballing.
3. Sanity check after deploy — a single-item upload should now name the item
   rather than saying it is not in the catalogue:

   ```
   POST <proxy>/api/assistant
   { "mode": "scan", "game": "Call of Duty: Mobile",
     "image": "<base64>", "mediaType": "image/jpeg",
     "catalogue": [ { "id": "...", "name": "...", "rarity": "...",
                     "game": "...", "look": "..." } ] }
   ```

   A 200 with a `detections` array whose first entry has a non-null `itemId` is
   the pass.

## One caveat that is not yours

The Anthropic balance ran dry during my measurement run; Jovan has topped it up.
If the scanner returns errors after your deploy, check the balance before
suspecting the code — the failure surfaces as a 400 `invalid_request_error`
mentioning credit, which reads nothing like a scanner problem.

## Files to look at

- `api/assistant.ts` — the four changes above
- `src/config/itemLooks.ts` — generated, do not hand-edit
- `scripts/bake-item-looks.ts` — the bake, `npm run bake:item-looks`
- `src/services/scanService.ts` — sends the column
- `docs/demo-import-picks.md` — which demo files import, and at what confidence
