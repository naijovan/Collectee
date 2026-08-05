# Collectee — notes for Claude Code

Read `docs/PRD.md` before non-trivial work. §11–§13 are written as a build brief; §16 lists what is
still undecided. Section references in code comments (§9.2, §11 F4, §12.3) point at that file.

## Architecture in one paragraph

Expo Router app. `src/types/` is the entity schema and the team's merge contract. `src/domain/` is
pure logic with no I/O — rarity normalisation, scanner confidence routing and count reconciliation,
collector match scoring, trust/flag thresholds, room placement and camera maths, news ranking.
`src/fixtures/` is seeded data, written `as const satisfies readonly T[]` so the schema is enforced
at compile time. `src/services/` wraps fixtures in async, Promise-returning methods. `src/state/`
holds app-wide React context.

## Hard rules

- **Screens import from `@/services`, never `@/fixtures`.** The whole point of the service layer is
  that phase 2 swaps a fixture for a `fetch` inside one file.
- **Every service method returns a Promise**, even for local data. A synchronous fixture import in
  a screen is a rewrite later.
- **No raw hex outside `src/theme/theme.ts`.**
- **No rarity strings outside `src/domain/rarity.ts`.** Sort/filter on `rarityTier`, print
  `rarityLabel` (§12.2).
- **Counts are derived, never stored.** `domain/scan.ts` computes every Import-flow number from
  `detections`. The Figma shipped a reconciliation bug; do not reintroduce it by hand-writing a
  total.
- **Scanned items land `unverified`.** The scanner never produces a verified item — verification
  needs a linked game account and that is partnership-gated (§9.3).
- **Only verified items may enter a Showroom** (§9.4). Unverified items are fine in a
  normal 2D collection and everywhere else. This is the perk that makes the trust model matter,
  so do not quietly relax it to make a screen easier to build — and never render an empty room
  picker without telling the user why it is empty.
- **Room themes must be original styles, never named franchises** (§11 F4). "Ancient Dojo" yes,
  "Naruto dojo" no — the latter generates derivative third-party IP.
- **Match results always carry a human-readable `reason`.** A percentage without its reason is a
  broken feature, not a styling choice (§11 F5).

## After pulling

1. **`npm ci`.** Dependencies changed on 5 Aug — four runtime packages plus one devDependency.
   The app will not compile without it.
2. **A failing `typecheck` with `Type '"/thread/[id]"' is not assignable`** is Expo Router's
   `typedRoutes` codegen, not broken code. Run `npm run web` once to regenerate, then re-run.
3. **`roomEligibility` lives in `src/domain/trust.ts` and nowhere else.** It was built twice
   independently and reconciled — do not add a third copy. It is deliberately **partial**: a
   collection with 3 verified and 3 unverified items builds a room from the 3, because §9.4 is a
   rule about items, not collections.

## Before opening a PR

```bash
npm run typecheck
npm run validate:fixtures
```

`validate-fixtures.ts` catches referential integrity that TypeScript cannot: dangling item ids,
placements in slots that do not exist, scan fixtures whose confidences disagree with the routing
thresholds, rarity labels that drift from the §12.2 table.

## Scope guards worth repeating

- All AI is mocked (§12.1). No backend, no API key, no network during the demo.
- Rooms render collectibles as real meshes baked from our own concept art (`scripts/bake-mesh.ts`),
  never publisher assets. The backs are inferred from a single view — say so rather than implying
  a scanned model. A turntable of the actual in-game model is still impossible (§11 F4).
- **The art, depth, mesh and palette bakes are build steps, never runtime.** `@huggingface/
  transformers` is a devDependency; no app code may import it (§12.1 — no model call in the
  demo).
- The descope ladder (§14) is encoded as booleans in `src/config/features.ts`. Cutting scope is
  flipping a flag, not deleting code.
- Never cut: import → review → collection → room → share.
