# Collectee — Product Requirements Document

**Version** 0.5 · **Date** 2 August 2026
**Submission** Garena AI Build Challenge (Singapore) — theme: *Reimagine Digital Entertainment Experiences with AI*
**Prototype** Figma — `Collectee` (6 flow groups, ~50 screens)
**Team** Bernard, Marcus, Jovan, Ray
**Status** Build spec — approved direction, open questions in §16

---

## 0. How to use this document

This PRD has two audiences:

1. **Claude Code**, which will build the foundational base (navigation, home screen, design tokens, mock data layer) from this document before feature work is branched out. §11–§13 are written to be read as a build brief.
2. **The pitch**, where §1–§7 supply the narrative and §9 supplies the answer to the question judges will ask.

Anything marked **[DEMO]** is what ships for the hackathon. Anything marked **[ROADMAP]** is stated on slides but not built.

---

## 1. Summary

Collectee is a mobile social platform where gamers turn their in-game skins and cosmetics into a public, cross-game **collection identity**. Players import inventories by uploading screenshots or screen recordings; AI recognises the items and populates their account; players curate those items into published collections and into **Collection Rooms** — themed spaces that replace the standard grid. A recommendation layer connects collectors with similar taste, and an AI-curated news feed keeps players current on releases, patches and meta.

**Pitch line:** your skins represent hundreds of hours and hundreds of dollars, and they live in a menu no one else ever sees. Collectee is the room you put them in.

---

## 2. Problem

1. **Cosmetics are invisible.** A player's collection sits in a per-game inventory screen with no shareable surface. Identity built over years is visible only mid-match, for seconds.
2. **Collections are fragmented.** Items across Mobile Legends, Call of Duty: Mobile and Valorant are three unrelated inventories and no single identity.
3. **Manual cataloguing is dead on arrival.** Any product that asks a player to add 200 items by hand will not be used. This is the reason showcase products have failed outside Steam-native trading tools.
4. **Discovery is a Discord problem.** Finding collectors with genuinely overlapping taste currently means joining servers and scrolling.

## 3. Why now

- Multimodal vision models can identify game cosmetics from a screenshot without per-game integration work. This is the unlock that turns import from an afternoon into 30 seconds, and it is the reason this product is buildable in 2026 and was not in 2020.
- Generative image models make bespoke themed room backdrops economically viable per user.
- Cosmetic spend remains the dominant monetisation model across the top mobile and PC titles, so the underlying asset base keeps growing.

---

## 4. Target users

| Persona | Description | Primary need |
|---|---|---|
| **The Showcase Collector** (primary) | Owns 50–500 cosmetics in 1–3 titles, posts clips to TikTok/Instagram, cares about being seen | A public profile worth linking in a bio |
| **The Completionist** (primary) | Chases full sets, event exclusives, limited-time skins | Knowing what's missing and what's rare |
| **The News Reader** (secondary) | Light collection, opens the app for patch notes and meta | Fast, filtered updates |

Not targeting: traders, resellers, or skin-market investors. See §7.

---

## 5. Competitive landscape and wedge

| Existing | What it does | Gap |
|---|---|---|
| Steam Community / Inventory | Native, verified, Steam-only | No curation, no cross-game, no social graph |
| CSFloat, Buff163, Skinport | Trading and pricing | Transactional, not identity |
| Tracker.gg, Leetify, OP.GG | Performance stats | Stats, not cosmetics |
| Reddit, YouTube, patch sites | News | Unfiltered, not personalised by what you own |

**The wedge:** nobody serves *cosmetic identity as a social object*, and nobody serves it cross-game. The defensibility is not the scanner (replicable) or the news feed (commoditised) — it is the **published Collection Room plus the social graph built on item overlap**. Priorities in this document follow that.

---

## 6. Goals and success metrics

**North star:** published collections per weekly active user.

| Goal | Metric | Directional target |
|---|---|---|
| Import must be effortless | % of new users completing an import in first session | ≥ 60% |
| Scanner must be trusted | Item recognition precision / recall on a labelled test set | ≥ 92% precision, ≥ 85% recall |
| Curation must happen | % of importers publishing ≥ 1 collection within 48h | ≥ 40% |
| Rooms drive sharing | % of published rooms shared externally | ≥ 25% |
| Retention | D7 / D30 | 25% / 10% |
| Social graph forms | % of users following ≥ 3 collectors or joining ≥ 1 community in week 1 | ≥ 50% |
| News is the return trigger | Feed sessions per WAU per week | ≥ 3 |

> These are directional targets set by the team, not benchmarked figures. If a judge asks for provenance, say that — do not defend a number we cannot source.

## 7. Non-goals

- **No trading, buying, selling, or price/valuation display.** Deliberate: it invites skin-gambling-adjacent regulatory exposure and reframes Collectee from fan tool to commercial derivative in the eyes of publishers.
- No in-game overlay or game-client integration.
- No desktop app. Mobile-first, matching the Figma.
- No user-uploaded custom item artwork.
- No live voice or DMs. Comments only.

---

## 8. Launch scope and challenge alignment

### 8.1 Games

**[DEMO] Three titles — confirmed:**

| Title | Publisher | Why it's in |
|---|---|---|
| **Call of Duty: Mobile (Garena SEA)** — hero title | Activision / TiMi, **published by Garena in Southeast Asia** | Garena-published, mobile-first, deep cosmetics economy (weapon blueprints, operator skins, camos, charms, crates) |
| **Valorant** | Riot Games | Premium skin bundles with variants and finishers; the strongest "collection as status" culture of the three |
| **Mobile Legends: Bang Bang** | Moonton | Largest SEA mobile cosmetics base; the team plays it, so seeded data will look authentic |

Between them these cover mobile FPS, PC tactical FPS and mobile MOBA — three different inventory UI shapes, which is the right stress test for the scanner (F1) and makes the cross-game thesis visible rather than asserted.

**On the Garena angle.** Call of Duty: Mobile is published by Garena across Singapore, Malaysia, Indonesia, Thailand, the Philippines and Taiwan. Pitching it as the hero title puts a Garena-published game at the centre of the demo, in front of a Garena panel, without the team having to build on a title they don't play. Use the Garena SEA version specifically in all copy, screenshots and seeded data — not console or PC Call of Duty. It is a different client with a different cosmetics system and the distinction will be obvious to anyone in that room.

Mobile Legends is Moonton's, and Moonton is Garena's most direct competitor in SEA mobile. That is worth being aware of but is not a reason to cut it: it is the team's own game, it demonstrates the platform is genuinely cross-publisher, and a showcase product that only worked on the host's titles would be a weaker cross-game argument, not a stronger one. Do not *lead* with MLBB in the demo — lead with CODM, and let MLBB be the second inventory that proves the point.

**Known trade-off — read this before §9.** None of the three titles exposes a public authenticated cosmetic-inventory API. Steam's Web API would have given one title a real implementation path for the Verified tier; without a Steam-backed title, verified ownership is **entirely partnership-gated**. §9.3 has been updated to state this plainly. This is a defensible position — the trust model in §9.2 was never dependent on the API, and social proof carries the demo — but do not claim on stage that Verified is a build-it-next-sprint item. It is not. It requires a publisher conversation.

**Note on the Figma:** the prototype frames were mocked with Mobile Legends, Overwatch 2, Dota 2 and League of Legends. Treat the Figma as the source of truth for **layout only** — all item art, names, game badges, communities and news content in the built app use the three titles above.

Adding a title requires a new item catalogue, not a new code path — the flows are title-agnostic. Slides should say so: the demo covers three, the architecture supports many, and the rest of Garena's portfolio (Free Fire, Delta Force, Arena of Valor) is the natural next set. **Free Fire is the obvious phase-2 addition** and is worth naming out loud as such — it is Garena's self-developed flagship with an enormous cosmetics economy, and saying "Free Fire is next" costs nothing on 9 August and lands well.

### 8.2 Mapping to the challenge brief

The brief asks for prototypes that use AI to enable new possibilities for users, creators and communities. Collectee should be presented against those exact words:

| Brief theme | Collectee feature |
|---|---|
| New ways for users to engage with content | Collection Rooms (F4) — cosmetics become a navigable, shareable space instead of a menu |
| Safer and more inclusive communities | Trust levels, community flagging and the review queue (§9), plus moderation in F5 |
| More personalised experiences | Item-overlap collector matching with visible reasons (F5); owned-item-driven news FYP (F6) |
| Intelligent tools | AI Inventory Scanner (F1) — removes the manual cataloguing barrier entirely |
| Reimagining interaction with entertainment | The whole thesis: cosmetic ownership as a social identity across games |

Note the second row especially. "Safer communities" is an explicit judging theme, and the trust model in §9 answers it directly. Do not bury it as a technical footnote — it is a headline.

### 8.3 Tooling

OpenAI is the sponsor and the prize is OpenAI API credits. Build the AI layer on OpenAI models: multimodal vision for item recognition (F1), image generation for room backdrops (F4), and text models for news summarisation (F6). This is both practical and a small alignment signal.

---

## 9. Trust and verification model

This is the question the pitch will be attacked on. The answer below is the team's agreed position.

### 9.1 What we are not doing, and why

The original concept proposed SHA-256 hashing of uploaded screenshots to verify ownership. **This does not work and has been dropped.** A cryptographic hash proves a file has not been altered; it says nothing about who owns the item the file depicts. Any publicly available screenshot passes. Stating this openly in the pitch is a strength, not a weakness — it shows the team stress-tested its own idea.

### 9.2 What we are doing: trust levels plus social proof

Every user may post any item. Each item carries a **trust level** based on how it was established:

| Trust level | How | Treatment |
|---|---|---|
| **Verified** | Item read from a connected game account | Badge on item; ranked higher in Explore and feed; eligible for verified-only perks (profile frames, priority in Collectors You May Like, verified-only communities) |
| **Unverified** | Self-reported via scan or manual add | No badge; allowed and fully usable; ranked lower in discovery surfaces; community-flaggable |

**Second layer — social proof.** Unverified items can be flagged by other users for:
- **False ownership** — a claimed item the flagger has reason to dispute
- **Duplicate uniqueness** — a genuinely unique or one-of-a-kind item claimed by more than one account
- **Identity impersonation** — someone using another player's in-game name

Flags do not auto-remove. Threshold behaviour: `n ≥ 3` distinct flags from accounts with their own verified items → item loses discovery ranking and enters a review queue. This threshold guard matters, because an unguarded flag button in a competitive community becomes a weapon.

**Why this is the right answer for the product, not just the deadline:** Collectee is a social app. Making trust a visible social attribute rather than a hidden cryptographic one is consistent with the whole thesis, and it converts verification from a blocking technical dependency into an engagement mechanic.

### 9.3 Implementation staging

- **⚠️ [DEMO] — NOT IN THE FIGMA.** Trust level is specified here but **no screen shows it**. There is no verified badge on any item card, no flag action, no flag confirmation, no review queue. The blue ticks in the prototype are on *collectors* (account verification), which is a different concept. Since §8.2 names safer communities as a judging theme and §9 is the prepared answer to the hardest Q&A question, this needs either two small design additions — a badge slot on `ItemCard`, a Flag entry in the item `⋮` menu with a confirmation state — or the claim comes out of the pitch. **Decide by 4 Aug.** Trust level is a field on every item (`trustLevel: verified | unverified`) with full UI treatment. Account connection is a mocked OAuth screen; seeded data ships with a realistic mix of both levels.
- **[ROADMAP]** Authenticated account linking for the Verified tier. **None of the three launch titles (§8.1) exposes a public cosmetic-inventory API** — Riot Sign-On can confirm a Valorant account identity but not its skin inventory, and neither Activision/Garena nor Moonton publishes an inventory read endpoint. Verified is therefore **partnership-gated, not engineering-gated**: it needs a publisher agreement, not a sprint. State it that way if asked; a title with an open inventory API (e.g. any Steam-backed game) would be the fastest route to a working Verified tier if one is added later.
- **[ROADMAP]** Perceptual hashing (pHash/dHash — *not* SHA-256) across uploads to detect near-duplicate screenshots reused across accounts. This is the technically honest version of the original hashing instinct and is worth one slide as future work.

---

## 10. Flow map

| # | Flow | Figma group | Screens | Owner |
|---|---|---|---|---|
| J1 | Import inventory | Import Inventory Flow | Upload → Scan → Review → Needs Review → Completion | Bernard |
| J2 | Create & publish collection | Create & Publish Flow | Details → Select items → Theme → Arrange → Preview details → Preview → Posted → Public page | Bernard |
| J3 | Collection Room | Collection Room Flow | Select collection → Style → Generate → Edit/adjust → Final preview → Publish details → Room live → Room on profile | Jovan |
| J4 | Discover collectors & communities | Discover Flow | Recommendations → Collection match → Public profile → Featured collection → Comment → Communities → Join | Marcus |
| J5 | News & gaming updates | News Flow | Updates home → Discover → FYP → Article → AI summary → Following/notifications → Saved | Marcus |

**Onboarding gate (from the prototype, keep it):** Collections and Profile tabs are greyed out until the first import completes. This forces the activation event and prevents an empty-profile first impression.

---

## 11. Feature specifications

### F1 — AI Inventory Scanner **[DEMO]**

**User story:** as a new player, I upload a screen recording of my skin list and my items appear in Collectee without typing anything.

**Pipeline**

1. **Ingest** — image or video. Video sampled at ~2 fps with a frame-difference filter to drop near-identical scroll frames.
2. **Detect** — segment the inventory grid into individual item tiles.
3. **Identify** (two fused signals):
   - **OCR** on tile labels and tooltips → candidate names, fuzzy-matched against the per-title item catalogue.
   - **Visual embedding** (CLIP-style) of each tile, nearest-neighbour against pre-embedded catalogue renders. Carries the load where labels are absent, truncated or localised.
4. **Route by confidence:**
   - `≥ 0.90` → auto-accepted, shown in Review
   - `0.60–0.90` → **Needs Review** screen; user confirms or corrects
   - `< 0.60` → discarded, surfaced as "N items we couldn't read"
5. **Deduplicate** across frames by item ID.
6. **Confirm** — Review screen groups detected items by rarity; user confirms; items land as `unverified`.

**[DEMO] implementation note (v0.5):** the pipeline above is **specified, not built**. The demo serves canned results from `fixtures/scan-results.json` behind timed loading states, for a fixed set of prepared inventory recordings (§12.1). Confidence values in the fixtures must be internally consistent with the routing thresholds above. The Needs Review branch must be demonstrated, not skipped — it is the screen that proves the system knows what it doesn't know, and it is more convincing than a clean 100% result.

**Acceptance criteria**
- A 30-second recording of 100+ items completes end-to-end in under 60 seconds with visible progress states.
- **The counts reconcile.** The Figma currently shows 42 detected = 34 matched + 5 needs review + 3 duplicates, a CTA reading "Import 39 confirmed items" *before* the 5 are resolved, and a completion screen totalling 44. Fix in design and fixtures: detected = matched + needs-review + duplicates; the CTA count updates live as the user resolves items; completion totals equal detected.
- Every auto-accepted item is reversible in Review.
- No ambiguous item enters a collection silently.

---

### F2 — AI Collection Insights **[ROADMAP — v1.1]**

Rarity breakdown (10% Epic / 20% Legendary), set-completion progress, one-sentence collecting-pattern summary, and recommendations for items that would complete or extend a set.

**Deprioritised deliberately.** It is the least differentiated of the five features and adds nothing to a live demo that a slide cannot convey. Statistics need no model call; only the natural-language summary does. Build it only if all four demo flows land early.

---

### F3 — Collections: create & publish **[DEMO]**

Named, described collections built from owned items; cover art; theme selection; drag-to-arrange; preview; publish public / unlisted / private.

**This flow is not one of the five "AI features" but it is where value is actually created** — the moment an inventory dump becomes an identity. Pitch it as a headline, not plumbing: *AI does the tedious part, the player does the expressive part.* AI assists with suggested groupings and titles; the curation is human and that is the point.

**Stepper numbering — fix before building `StepperHeader`.** The Figma shows a 4-step bar but labels three screens Step 3 (Select Theme, Arrange, Preview Details "3.5"). Canonical: **Details → Select items → Theme → Arrange → Publish**, with Preview Details and Preview as modal/confirm screens outside the numbered bar. The Room flow has the same problem: two screens labelled Step 3 in a 5-step bar. Pick canonical counts once, in code, and let both flows import them.

**Acceptance criteria**
- Publish in under 90 seconds from the Collections tab.
- Items can belong to multiple collections.
- Public collection pages are link-shareable and render a preview card on Discord / X / Instagram.

---

### F4 — Collection Rooms **[DEMO — the differentiator]**

Items are placed as cards, statues or wall art inside a themed space rather than a grid. Flow: select collection → choose style → generate → manual adjust → preview → publish → live room.

**Interaction model (team decision).** A true turntable of the actual in-game 3D model is **not possible** — it requires direct access to publisher game assets, which we do not have and will not have. Do not promise it. What we build instead, entirely within the app:

- **A themed room rendered as a 2.5D parallax scene** — AI-generated backdrop, fixed placement slots (pedestals, wall panels, display cases), items composited into slots as collectible cards or framed artwork.
- **Look-at focus:** the room has a current focal item — e.g. a sword on a central pedestal. Tapping a different item **transitions the camera**, zooming and re-centring on it. This transition is the immersion, and it costs a fraction of a navigable 3D environment.
- **Card interaction:** the focused item's card can be rotated/flipped in place to show reverse-side detail and metadata. This reads as "spin" without needing a 3D model.
- **Parallax** on device tilt or drag, plus pinch-zoom.

This gives the immersive, non-grid feel the concept calls for while staying honest about asset access. Full 3D with free movement is **[ROADMAP]**.

**Theme library [DEMO]:** 6–8 original-style themes — Neon Vault, Fantasy Armoury, Esports Locker Room, Ancient Dojo, Cyber Shrine, Collector's Study.

**Critical constraint:** themes must be **original styles, not named franchises**. "Naruto dojo" generates derivative work of third-party IP; "Ancient Dojo" does not. Generation is template-conditioned (fixed layout scaffold + style prompt) so slot geometry is predictable and cost is bounded. Cache and reuse backdrops across users on the same theme and palette.

**⚠️ Scope guard.** The Figma room frames render richer than the 2.5D parallax spec above, and the customise panel adds a brightness slider and an animated-lighting toggle. **Build to this spec, not to the frames.** Rooms are the hardest flow and its owner also owns the foundational base. Lighting controls are [ROADMAP].

**Acceptance criteria**
- Generation completes in under 20s with a progress state.
- Every AI placement is manually overridable — the Figma has two adjust steps; keep both.
- Smooth focus transitions on a mid-tier Android device.
- One-tap export of a room still or short video for sharing off-platform.

---

### F5 — Profiles & AI Community Matching **[DEMO]**

Recommends collectors with overlapping taste and surfaces the *reason* ("92% match — you both collect Mythic MLBB skins"). Recommends communities. Public profiles, featured collections, comments, join/leave.

**Approach:** match score is item-overlap based, not a black box. User–item matrix; similarity over co-owned items weighted by inverse item popularity — owning a common battle-pass skin says little, owning the same limited exclusive says a lot. Content-based cold start from games and franchises selected at signup. **Always display the human-readable reason**; the explanation is what makes a recommendation feel earned.

**Feed and posts — specified in v0.5.** The Figma includes "Publish a showcase post" and "Share to Home feed", implying a `Post` entity (§12.3) and a Home feed mixing collections, rooms, collectors and news. For the demo, Home is **seeded and static** — no ranking algorithm. Say "ranked by recency and match score" only if asked; do not claim a live feed.

**Moderation (required, not optional):** comment reporting, block/mute, automated slur filtering, impersonation takedown path. This ties into the flagging system in §9.2 — same review queue.

---

### F6 — AI News Curator **[DEMO — first descope candidate]**

Two feeds: **Discover** (general news, releases, meta) and **FYP** (personalised by followed games, franchises, characters and *owned items* — a player who owns a skin for a champion being reworked should see that patch note first). Article view with an AI summary toggle. Following management, notifications, saved articles.

**Sourcing:** official publisher channels and permitted RSS only. Summaries link out; Collectee never reproduces article bodies. This is both a legal requirement and the difference between a partner and a scraper.

**Positioning:** this is the weakest moat of the five. Pitch it as the **retention loop** — the reason to open the app between collection updates — not as a headline feature. It is also the flow explicitly designated as droppable if other work needs help (§14).

---
## 12. Architecture

### 12.1 Demo architecture — decided (v0.5)

**The 9 August build is a client-only app with no backend.** All AI is mocked: canned responses served from local fixture files behind realistic timed loading states. There is no server, no API key, no network dependency during the demo.

```
Mobile client (Expo / React Native / TypeScript)
        │
   Service layer (interface-stable, swappable)
        ├── scanService      → fixtures/scan-results.json    [mocked]
        ├── catalogueService → fixtures/items-{title}.json   [static]
        ├── roomService      → fixtures/rooms.json + bundled backdrops [mocked]
        ├── matchService     → fixtures/collectors.json      [mocked]
        └── newsService      → fixtures/articles.json        [mocked]
```

**Write every service behind an async interface that returns a Promise**, even though the data is local. `await scanService.scan(files)` with an artificial delay is one line away from a real fetch later; a synchronous import of a JSON file is a rewrite. This is the single cheapest thing you can do now to make phase 2 possible.

**Why mocked (the honest pitch answer):** the demo runs on a stage, on conference wifi, in four minutes. A live vision call that takes 40 seconds or fails is a worse demo than a deterministic one. The pipeline in §11 F1 is specified in full and is the phase-2 build. Say this plainly if asked — do not imply a model is running when it is not.

**⚠️ Submission risk — decide by 5 Aug.** §14 states the 9 August proposal requires *a working AI prototype and proof of concept*. A fully mocked build contains no model call. Cheapest mitigation, and the only one recommended:

> **[OPTIONAL — ~2 hours] One real call: F6 article summarisation.** A single text-model call (article text in, 4-bullet summary out) behind a serverless function. No vision, no images, no pipeline. It makes "there is a real model call in this build" a true statement. Everything else stays mocked. If it isn't done by 5 Aug, drop it and pitch the mock honestly.

### 12.2 Rarity model — decided (v0.5)

**Normalised internally, native label displayed.** `Item` carries both. Sorting, filtering, grouping and colour tokens use `rarityTier`; the UI prints `rarityLabel`.

| `rarityTier` | Token | CODM | Valorant | MLBB |
|---|---|---|---|---|
| `common` | `--rarity-common` | Common | — | Elite |
| `rare` | `--rarity-rare` | Rare | Select | Special |
| `epic` | `--rarity-epic` | Epic | Deluxe | Epic |
| `legendary` | `--rarity-legendary` | Legendary | Premium / Exclusive | Legend |
| `mythic` | `--rarity-mythic` | Mythic | Ultra | Collector |

Five tiers, five colour tokens, one `<RarityBadge tier label />` component. **Have a player of each title sanity-check the mapping** — the Valorant Exclusive placement is the least certain and the Figma currently shows inconsistent labels (LEGEND vs LEGENDARY, plus IMMORTAL from a title no longer in scope). Normalise all seeded data to this table; no other rarity strings anywhere in the codebase.

### 12.3 Core entities

Additions in v0.5 marked **†**.

| Entity | Key fields |
|---|---|
| `User` | id, handle, displayName, avatar, bio, followedGames[], isAccountVerified |
| `GameAccount` | userId, title, externalHandle, linkStatus |
| `Item` | id, title, name, **†**`rarityTier`, **†**`rarityLabel`, setId, renderUrl, popularityScore |
| **†**`ItemSet` | id, title, name, itemIds[], totalCount |
| `OwnedItem` | **†**id, userId, itemId, trustLevel, source, confidence, **†**quantity, acquiredAt |
| `Collection` | id, userId, name, description, coverUrl, themeTags[], itemIds[], **†**`visibility: public\|unlisted\|private`, **†**allowComments, **†**showOnProfile |
| `Room` | id, collectionId, themeId, backdropUrl, **†**`slots[]`, **†**`placements[]`, **†**settings |
| **†**`Post` | id, userId, type: `collection\|room`, targetId, caption, createdAt |
| **†**`Follow` | followerId, followeeId, createdAt |
| `Community` | id, name, avatarUrl, tags[], memberIds[], **†**memberCount |
| **†**`CommunityMembership` | userId, communityId, notificationPref |
| `Comment` | id, targetType, targetId, userId, body, parentId, likeCount, createdAt |
| `Flag` | id, targetType, targetId, reporterId, reason, status |
| `Article` | id, source, sourceTitle, title, url, imageUrl, summary, tags[], publishedAt |
| **†**`SavedArticle` | userId, articleId, savedAt |
| **†**`FollowedTopic` | userId, kind: `game\|franchise\|character`, value |
| **†**`Notification` | id, userId, kind, targetId, read, createdAt |

**`Room.slots[]` / `placements[]` — the shape Jovan is blocked on:**

```ts
type Slot = {
  id: string;
  kind: 'pedestal' | 'wall' | 'case';
  x: number; y: number;        // 0–1, fraction of backdrop dimensions
  w: number; h: number;        // 0–1
  depth: 0 | 1 | 2;            // parallax layer: 0 = back, 2 = front
};
type Placement = { slotId: string; ownedItemId: string; rotation: number };
```

Coordinates are **fractional, not pixel**, so the same slot map works at any backdrop resolution and across devices. Each theme ships a fixed slot map; generation only ever produces the backdrop image, never the geometry. This is what "template-conditioned" in §11 F4 means concretely.

**Agree this schema before anyone branches.** All flows read the same `OwnedItem` and `Collection` shapes. If each person invents their own fixture structure, merge day becomes a rewrite. Highest-value thing to lock on day one.

---

## 13. Build brief for the foundational base

One person (Jovan) runs this with Claude Code from this document **before** feature branches are cut. Nothing below is optional.

### 13.1 Stack — decided (v0.5)

| Choice | Decision | Why |
|---|---|---|
| Framework | **Expo (managed) + React Native** | Runs on a phone via Expo Go with no native build; demo on real hardware in seconds |
| Language | **TypeScript, strict** | The schema in §12.3 becomes compile-time enforcement of the merge contract |
| Navigation | **Expo Router** (file-based) | Tab bar + stacks map directly to the flow map; less shared config to conflict on |
| Styling | **StyleSheet + a central `theme.ts`** | No extra dependency; tokens in one file that only Jovan edits |
| State | **React Context + hooks** | Four days. Redux is not worth the setup |
| Lists | `FlatList` everywhere | Horizontal rails on Home are all `FlatList horizontal` |
| Fixtures | `/fixtures/*.json`, typed, imported via service layer (§12.1) | Never import a JSON file directly in a screen |

Node 20 LTS. One `npm install` at the start; **nobody adds a dependency without saying so in chat** — a lockfile conflict on the 6th costs an evening.

### 13.2 Design tokens

Extracted from the Figma: dark near-black background, elevated card surface, single blue accent (buttons, active tab, links, "See all"), five rarity colours per §12.2, white primary / muted grey secondary text, ~12–16px card radius, pill-shaped filter chips. Type scale: screen title, section header, card title, meta. Put all of it in `theme.ts`; **no raw hex anywhere else in the codebase.**

### 13.3 Shared components

`ItemCard` · `CollectionCard` · `CollectorCard` · `ArticleCard` · `RarityBadge` · `GameBadge` · `SectionHeader` (title + "See all") · `FilterChips` · `StepperHeader` · `PrimaryButton` / `SecondaryButton` · `Avatar` (with verified tick) · `EmptyState` · `LoadingState` · `TabBar`.

**Jovan owns all of these.** Changes go via PR announced in chat. This is where merge conflicts will otherwise happen.

### 13.4 Home screen — full spec

Built completely, from the Figma landing frame. Top to bottom:

1. **Header** — "Good evening" + display name; bell icon with unread dot; avatar (tap → Profile)
2. **Filter chips** — All / Collections / Collectors / Rooms; All active by default
3. **Hero banner** — art collage, sparkle eyebrow "Collections made for you", headline, `Explore` button, row of game logos
4. **Gaming updates** — horizontal rail of article cards (game tag, headline, blurb, timestamp) + "See all"
5. **Explore collectibles** — 2×2 grid; each card: game badge top-left, art, collector avatar + name + tick, collection name, heart + like count; + "See all"
6. **Recently added** — horizontal rail of 4 compact item cards (art, item name, game label) + "See all"
7. **Collectors you may like** — horizontal rail of 4 cards (avatar, name + tick, tagline, item count) + "See all"
8. **Tab bar** — Home · Explore · **+** (raised blue circle) · Collections · Profile

**Canonical variant:** build the version *with* the Gaming updates rail (section 4), behind `FEATURES.news`. J5 is the first descope candidate (§14) — if it's cut, flip the flag and the rail disappears cleanly rather than leaving a hole.

**Onboarding gate:** Collections and Profile tabs render greyed and non-interactive until the first import completes (per the Figma comments). Implement it in `TabBar` from a single `hasImported` flag in context.

### 13.5 Also in the base

- Fixtures for all three titles (§8.1) with a realistic verified/unverified mix — **catalogue data is on the critical path and needs an owner today** (§16)
- `EmptyState` and error variants for: no items detected, unsupported screenshot, empty collection, empty Explore
- A `+` tab action sheet (Scan inventory / Create collection / Create room) — it appears in every flow and is currently unspecified

Only after this merges to `main` does feature work branch out.
## 14. Team, timeline and workflow

### Ownership

| Person | Scope |
|---|---|
| **Bernard** | Import Inventory flow (J1), Create & Publish flow (J2), PRD, AI voiceover for the demo video |
| **Jovan** | Collection Room flow (J3), foundational base build |
| **Marcus** | Discover Collectors & Communities flow (J4), News flow (J5 — droppable) |
| **Ray** | Pitch slides, demo video animation |

### Timeline

**Phase 1 — proposal submission (hard deadline 9 August)**

| Date | Milestone |
|---|---|
| 2 Aug | PRD finalised; data schema locked; foundational base started |
| 3–5 Aug | Feature flows built on branches |
| 5 Aug | Descope decision point (§14 ladder) — decided by choice, not panic |
| 6–7 Aug | App working end-to-end; UI polish together |
| 7–8 Aug | Demo video, slides, rehearsal |
| **9 Aug** | **Proposal submitted — requires a working AI prototype and proof of concept** |

**Phase 2 — finals (if shortlisted)**

| Date | Milestone |
|---|---|
| 13 Aug | Finalist announcement (top 10); Garena mentor assigned |
| 13–22 Aug | Mentor sessions; convert [ROADMAP] items into build work; harden the demo |
| **23 Aug** | **Final presentation onsite at Garena HQ** |

Phase 2 changes how to treat this document's scope markers. Anything marked **[ROADMAP]** is a *phase-2 candidate*, not a permanent exclusion — Collection Insights (F2) and perceptual hashing are both buildable in the ten days between shortlisting and finals. Say "next" on 9 August, not "never".

### Git workflow

- Feature branches per flow, never commit to `main` directly.
- Push and open a PR at the end of each working session; whoever else is free reviews for conflicts before merge.
- Merge to `main` on feature completion so the next person branches from current code.
- Nightly text check-in — anyone blocked says so that night, not the next morning.
- Do not work on the same files simultaneously. Shared components change via PR, announced in chat.
- Figma MCP is connected to Claude via the plugin, so screens can be pulled directly during implementation.

### Descope ladder — agree this now, not at 2am on the 6th

1. News flow (J5) → static seeded articles, AI summary on one article only
2. Collection Room manual-adjust steps → one adjust step instead of two
3. Communities → join/view only, no posting
4. Scanner video input → screenshots only
5. Third game → two titles with the third shown as "coming soon"

Never cut: the import → review → collection → room → share path. That single chain is the demo.

---

## 15. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Timeline** — four flows in four days | High | Foundational base merged before branching; descope ladder agreed in advance (§14); nightly check-ins |
| **Merge conflicts** on shared components and mock data | High | Schema locked day one; shared components owned by one person; PR before merge |
| **IP** — item art and generated rooms derive from publisher IP | High | Original-style themes only; no monetisation of asset display; DMCA process; no commercial step without publisher outreach |
| **Verification credibility** in Q&A | Medium | §9 is the prepared answer; lead with why SHA-256 was rejected. Note that no launch title has a public inventory API (§8.1), so Verified is partnership-gated — say so rather than implying it ships next sprint |
| **Fake collections** undermine the social layer | Medium | Trust levels, ranking difference, community flagging with a threshold guard |
| **Recognition accuracy** below tolerance | Medium | Confidence routing with Needs Review; three curated catalogues rather than ten scraped ones |
| **Retention** — import is one-off | Medium | News feed as the weekly loop; owned-item-triggered notifications |
| **Submission criteria** — proposal requires a "working AI prototype"; build is fully mocked | High | Decide the F6 real-summary call by 5 Aug (§12.1); otherwise state the mock plainly rather than implying a live model |
| **Seeded data looks fake** — implausible counts (a collector card reading "12.4K items") | Low | One pass over all fixture numbers before rehearsal; item counts in the hundreds, like counts in the thousands |
| **Generation cost** | Low (demo) | Template-conditioned generation, cached backdrops, per-user regeneration cap |

---

## 16. Open questions

**Resolved in v0.5:** demo titles (§8.1) · stack (§13.1) · mocked-vs-real AI (§12.1) · rarity model (§12.2) · room slot geometry (§12.3) · Home screen spec (§13.4) · stepper numbering (F3) · canonical Home variant (§13.4).

**Still open — in order of urgency:**

1. **Who owns item catalogue and fixture data, and by when?** Unowned, on the critical path, and everything reads from it. Needs a name today and a scope (suggest ~60 items per title, not exhaustive). §16.5 flags spare capacity.
2. **Trust/verification UI** — design the badge and flag states, or cut the claim from the pitch (§9.3). Decide by 4 Aug.
3. **The F6 real-summary call** — build it or drop it, decided by 5 Aug, not on the 8th (§12.1).
4. **Does anyone actually own enough cosmetics in all three titles** to record convincing inventory footage? If not, that's a borrowed-account or staged-capture problem to solve this week, not on the 7th.
5. Are communities user-creatable in the demo, or seeded-only?
6. Room backdrops: pre-generated and bundled (recommended, and consistent with §12.1) or generated live? Decide before rehearsal.
7. Monetisation thesis for the pitch — premium themes, profile customisation, or explicitly deferred?
8. Onboarding/signup screens do not exist in the Figma and have no owner. Does the demo open on a logged-in state? (Recommended: yes, skip auth entirely.)
9. The Figma header says 6 flow groups; §10 maps 5. Confirm what the sixth is.
