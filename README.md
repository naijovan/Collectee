# Collectee

Garena AI Build Challenge (Singapore) — *Reimagine Digital Entertainment Experiences with AI*

Mobile social platform where gamers turn in-game skins and cosmetics into a public, cross-game
collection identity. Built with Expo + React Native + TypeScript.

**Team:** Bernard · Marcus · Jovan · Ray
**Spec:** [docs/PRD.md](docs/PRD.md) — v0.5, the build brief. Read §11–§13 before writing code.
**Deadline:** proposal submission 9 August 2026.

---

## Status

The **foundational base** is merged: schema, domain logic, fixtures, service layer and app state.
UI is deliberately deferred — the team agreed to settle the data and feature layer first, so flows
can be built against a stable contract rather than against each other.

What exists:

| Layer | Location | Notes |
|---|---|---|
| Entity schema (§12.3) | `src/types/` | The merge contract. Change via PR announced in chat. |
| Domain logic | `src/domain/` | Pure functions, no I/O. Rarity, scan routing, matching, trust, rooms, news. |
| Fixtures | `src/fixtures/` | Three catalogues, users, inventories, collections, rooms, articles, social, scans. |
| Service layer (§12.1) | `src/services/` | All async. **Screens import from here, never from fixtures.** |
| App state | `src/state/AppContext.tsx` | Viewer, inventory, onboarding gate, notifications. |
| Feature flags (§14) | `src/config/features.ts` | The descope ladder, as booleans. |
| Art, depth and mesh bakes | `scripts/bake-*.ts` | Offline build steps. `@huggingface/transformers` is a **devDependency** — no app code imports it and nothing ships in the bundle. |
| Design tokens (§13.2) | `src/theme/theme.ts` | No raw hex anywhere else. |
| Shared components (§13.3) | `src/components/` | All 14, plus `RoomScene`. **Jovan owns these — change via PR announced in chat.** |
| Navigation + screens | `src/app/` | Tab group, Home in full (§13.4), and a walkable screen for every journey. |

### Routes

`src/app/(tabs)/` is the app; everything else is a stack screen pushed over it, one route group per
journey in §10. Each flow screen is **working, on-spec and deliberately thin** — enough to walk the
whole product end to end. The flow owner expands theirs; the shell underneath does not move.

| Route | Flow | Owner |
|---|---|---|
| `(tabs)/index` | Home — all eight sections of §13.4 | Jovan |
| `(tabs)/explore` · `collector/[id]` | J4 Discover collectors & communities | Marcus |
| `(tabs)/collections` · `(tabs)/profile` | Behind the §13.4 onboarding gate | — |
| `create` | The `+` action sheet (§13.5) | — |
| `import` | J1 Upload → Scan → Review → Needs Review → Done | Bernard |
| `collection/new` · `collection/[id]` | J2 Create & publish | Bernard |
| `room/new` · `room/[id]` | J3 Collection Room — 2.5D parallax, look-at focus | Jovan |
| `news` · `article/[id]` | J5 News & updates (behind `FEATURES.news`) | Marcus |
| `diagnostics` | Every service called the way a screen calls it | Jovan |

Three things in here are the PRD's explicit fixes to Figma bugs — do not undo them by hand:

- **Import counts are derived**, never written. `24 detected = 18 matched + 4 needs review + 2
  duplicates`, the CTA count rises live as Needs Review items are resolved, and the completion
  screen reconciles against the same numbers (§11 F1).
- **Steppers read `COLLECTION_STEPS` / `ROOM_STEPS`** from `domain/collections.ts`, so the count on
  screen cannot drift from the count in code (§11 F3). Preview stays outside the numbered bar.
- **The onboarding gate lives only in `TabBar`**, from `hasImported` (§13.4). Do not re-derive it.

The §9.3 trust UI ships behind `FEATURES.trustUi`: an item-trust badge on `ItemCard` and a Flag
entry in the item `⋮` menu with a confirmation state, on the collection page. That was the open
4 Aug decision — the logic and the UI both exist now, so the call is a flag flip either way.

---

## Setup

```bash
npm ci          # use ci, not install — the lockfile is the contract
npm start       # then scan the QR with Expo Go
npm run web     # or http://localhost:8081 in a browser
```

### ⚠️ After you pull — read this first

Two things will look like broken code and are not. Both are one command.

**1. Install. Dependencies changed.** Four runtime packages landed with the
J1/J2 merge (`expo-haptics`, `expo-linear-gradient`, and two `@expo-google-fonts`
packages), plus one devDependency for the art pipeline
(`@huggingface/transformers`). Without this the app will not compile:

```bash
npm ci
```

**2. `npm run typecheck` may fail with route errors until you start the app once.**

```
Type '"/thread/[id]"' is not assignable to type '"/" | "/explore" | …'
```

That is Expo Router's `typedRoutes` codegen, not your code. The route union is
regenerated when the bundler runs, and your local copy predates whatever routes
came in with the pull. Run `npm run web` once, then re-run typecheck. Nobody
should lose an hour to this.

**3. The room gate is partial, not all-or-nothing.** `roomEligibility` in
`domain/trust.ts` is the one implementation — it was built twice independently
and reconciled on 5 Aug. A collection with 3 verified and 3 unverified items
*does* build a room, from the 3. §9.4 is a rule about items, not collections.
Do not add a second copy of this function; three surfaces already call it.

Built and verified on **Node 26.4.0**. The PRD says Node 20 LTS; nobody on this machine has a
version manager installed, so the committed `package-lock.json` is what keeps everyone identical.
Run `npm ci`, not `npm install`, and a lockfile conflict on the 6th costs nobody an evening.

```bash
npm run typecheck          # tsc --noEmit, strict
npm run validate:fixtures  # referential integrity across every fixture
npm run audit:art          # art, depth and backdrop coverage vs the catalogue
```

Regenerating art is a separate, slower path and only needed when renders change:

```bash
npm run bake:depth    # depth maps  (first run downloads ~50MB of model)
npm run bake:mesh     # .glb meshes from depth + silhouette
npm run bake:palette  # dominant colour per item, feeds room suggestions
```

Run both before you open a PR.

---

## The rules that stop merge day becoming a rewrite

1. **Screens never import from `@/fixtures`.** Go through `@/services`. Every service method returns
   a Promise even though the data is local, so phase 2 replaces a fixture with a `fetch` inside one
   file and nothing else moves.
2. **No raw hex outside `src/theme/theme.ts`.**
3. **No rarity strings outside `src/domain/rarity.ts`.** Sort and filter on `rarityTier`, print
   `rarityLabel`.
4. **Types live in `src/types/`.** If you need a new shape, add it there via a PR — do not define a
   local interface inside your flow.
5. **Never commit to `main`.** Branch per flow; PR at the end of each session.

## Ownership

| Person | Flow | Files |
|---|---|---|
| Bernard | J1 Import, J2 Create & Publish | `services/scanService.ts`, `services/collectionService.ts` |
| Jovan | J3 Collection Room + foundation | `services/roomService.ts`, `domain/room.ts`, `theme/`, `types/` |
| Marcus | J4 Discover, J5 News | `services/matchService.ts`, `services/newsService.ts` |
| Ray | Slides, demo video | — |

Shared (`catalogueService`, `inventoryService`, `socialService`, `types/`, `theme/`) changes via PR
announced in chat.

---

## Honest-pitch notes

These are in the PRD but easy to lose. Do not contradict them on stage.

- **All AI is mocked** (§12.1). There is no backend, no API key, no network call during the demo.
  The vision pipeline in §11 F1 is specified in full and is the phase-2 build. Say so plainly if
  asked — do not imply a model is running when it is not.
- **Verified ownership is partnership-gated, not engineering-gated** (§9.3). None of the three
  launch titles exposes a public cosmetic-inventory API. It needs a publisher conversation, not a
  sprint.
- **SHA-256 screenshot hashing was considered and dropped** (§9.1). A hash proves a file is
  unaltered; it says nothing about who owns the item depicted. Leading with why it was rejected is
  a strength.
- **Interactive Collection Rooms are verified-only** (§9.4). An unverified item can live in a
  normal 2D collection; it cannot go in a room. That is deliberate — it gives the trust model
  teeth and makes account linking the second activation event. Say the dependency out loud
  before a judge finds it: rooms are what connecting an inventory buys, which is the reason a
  publisher would integrate, not a hole in the product.
- **Rooms render real geometry now, and it is ours** (§11 F4, §15). Collectibles are meshes
  baked from our own concept art by a local pass — `bake:depth` then `bake:mesh`. They are not
  publisher assets, we do not have those, and the backs are inferred from a single view. A
  turntable of the actual in-game model remains impossible; do not promise it.
- **No trading, pricing or valuation** (§7). Deliberate — it invites skin-gambling-adjacent
  regulatory exposure.

## Open items that block work

Tracked in PRD §16. The ones that touch this codebase:

- **Item names and rarity tiers need a player of each title to verify.** The catalogues in
  `src/fixtures/items-*.ts` follow real naming patterns but are unverified. §15 lists "seeded data
  looks fake" as a risk and a Garena panel will spot a wrong blueprint name instantly.
- **Item art, room backdrops and avatars are not in the repo.** Fixtures reference
  `item-art/<title>/<id>.png`, `room-backdrops/<theme>.png` and `avatars/<user>.png`. Add the files
  under `assets/` and switch the fields to `require()` when UI work starts.
- **Trust UI decision, due 4 Aug** (§9.3) — the logic is built and flagged behind `FEATURES.trustUi`.
- **Real F6 summarisation call, due 5 Aug** (§12.1) — flagged behind `FEATURES.liveSummarisation`.
