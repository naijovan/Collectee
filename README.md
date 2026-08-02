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
| Design tokens (§13.2) | `src/theme/theme.ts` | No raw hex anywhere else. |

What does not exist yet: the tab bar, the Home screen (§13.4), the 14 shared components (§13.3),
and every flow screen. Those are next.

`src/app/index.tsx` is a **diagnostics screen**, not Home. It calls every service the way a real
screen would and shows what came back. Delete it when the real `(tabs)` group lands.

---

## Setup

```bash
npm ci          # use ci, not install — the lockfile is the contract
npm start       # then scan the QR with Expo Go
```

Built and verified on **Node 26.4.0**. The PRD says Node 20 LTS; nobody on this machine has a
version manager installed, so the committed `package-lock.json` is what keeps everyone identical.
Run `npm ci`, not `npm install`, and a lockfile conflict on the 6th costs nobody an evening.

```bash
npm run typecheck          # tsc --noEmit, strict
npm run validate:fixtures  # referential integrity across every fixture
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
- **No 3D turntable** (§11 F4). Rooms are a 2.5D parallax scene with look-at focus. A real
  turntable needs publisher game assets we do not have.
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
