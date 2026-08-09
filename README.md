# Collectee

**Live: [collectee.vercel.app](https://collectee.vercel.app)** — open in a private/incognito window; normal tabs often serve a cached build.

Collectee is a mobile-first app for people who collect in-game cosmetics across **Call of Duty: Mobile**, **VALORANT** and **Mobile Legends: Bang Bang**. You import what you own by uploading a screenshot of your in-game inventory, the app reads it and matches it against a catalogue, and from there you can group items into collections, place the verified ones in a 3D Showroom, find collectors with overlapping taste, and follow per-game news that ranks around what you actually own.

The through-line is **provenance**: two identical skins are identical in game, so the interesting facts — when you got it, whether it is verified against a linked account, what it sits beside — only exist outside the client. That is what this app is for.

---

## Contents

1. [Setup](#1-setup)
2. [Architecture](#2-architecture)
3. [How AI contributes](#3-how-ai-contributes)
4. [Prompts and agent configuration](#4-prompts-and-agent-configuration)
5. [Third-party disclosure](#5-third-party-disclosure)
6. [Scope and known limitations](#6-scope-and-known-limitations)
7. [Validation gates](#7-validation-gates)

---

## 1. Setup

Assumes a clean machine with nothing installed.

### Prerequisites

| | version | why |
|---|---|---|
| **Node.js** | 20 LTS or newer (developed on 24.18) | Expo SDK 57 tooling |
| **npm** | ships with Node (developed on 11.16) | no other package manager is required |
| **Expo CLI** | none to install | invoked via `npx expo`, already a dependency |

For a phone or simulator you additionally need the **Expo Go** app (iOS/Android), or Xcode / Android Studio for a simulator. **The web build needs none of that** and is the fastest way to review.

### Clone, install, run

```bash
git clone https://github.com/naijovan/Collectee.git
cd Collectee
npm ci
cp .env.example .env      # optional — see below
npm run web               # → http://localhost:8081
```

`npm ci` rather than `npm install`: it installs exactly the lockfile.

Other run targets, all real scripts from `package.json`:

```bash
npm run web        # expo start --web    — browser
npm start          # expo start          — QR code for Expo Go
npm run ios        # expo start --ios    — iOS simulator
npm run android    # expo start --android
```

### Running without credentials — what a judge sees

**You do not need any API key to run, browse or evaluate this app.** A fresh clone with an empty `.env` is a complete, working build. This is deliberate, not a fallback bolted on afterwards.

Set `ANTHROPIC_API_KEY` (server-side, in your Vercel project) and point `EXPO_PUBLIC_AI_PROXY_URL` at your deployment to enable live model calls. With neither:

| surface | with a key | without |
|---|---|---|
| Colly assistant | answers free-form questions via Claude | answers from on-device logic over your own data; labels itself **"Answers computed on-device"** |
| News digest cards | a generated "What's happening in \<game\>" | seeded bullets, labelled **"Prepared digest — no model call ran"** |
| Article summaries | generated bullets | prepared bullets, labelled **"Prepared summary"** |
| Screenshot import | Claude reads the uploaded screenshot | a prepared scan result for the demo images |

Every AI surface **states which path produced the answer**. Nothing silently pretends a model ran.

`EXPO_PUBLIC_SKIP_FIRST_RUN=1` skips the first-run flow (sign-in → 4-step quiz → guided tour) and drops you on Home. Useful when reloading repeatedly — but **leave it unset the first time**: the first-run flow is a real part of the product, the quiz answers feed the news and community ranking, and the guided tour walks the five main surfaces.

⚠️ `ANTHROPIC_API_KEY` must **never** be given an `EXPO_PUBLIC_` prefix. Anything so prefixed is inlined into the shipped JavaScript and readable by anyone with the app.

---

## 2. Architecture

An **Expo (SDK 57) / React Native app using Expo Router**, running on iOS, Android and web from one codebase. The deployed build is the web export, hosted on Vercel alongside one serverless function.

### Layering

The rule the codebase is organised around: **screens never read fixtures directly.**

```
src/app/        Expo Router screens — file-based routing
src/components/ shared UI (cards, primitives, tour overlay, 3D room)
src/services/   async API surface; every method returns a Promise
src/domain/     pure logic, no I/O — ranking, trust, scan reconciliation, placement
src/fixtures/   seeded data, `as const satisfies readonly T[]`
src/config/     feature flags, art registries
src/state/      React context (app state, assistant dock, tour anchors)
src/theme/      design tokens; all colour lives here
src/types/      the entity schema
```

`services/` wraps fixtures in Promise-returning methods so that swapping a fixture for a `fetch` is a change inside one file. `domain/` is pure and therefore directly testable — the ranking, the §9.4 trust rules and the tour's placement solver are all exercised by scripts without a running app.

### Surfaces

| area | route(s) | what it does |
|---|---|---|
| **Home** | `/` | greeting, filter chips (All / Collections / Collectors / Rooms / Communities), hero, Gaming Updates rail, collections, collectors, showrooms, communities |
| **Explore** | `/explore` | Collectors tab (match % with a stated reason) and Communities tab (joined, plus a grouped browse-all). `?tab=Communities` opens it directly |
| **Gaming Updates** | `/news`, `/article/[id]` | per-game tabs, an AI digest card, image-led article cards, and a full in-app article reader |
| **Collections** | `/collections`, `/collection/[id]`, `/collection/new` | your collections; `?browse=all` is a trending-first browse of every public one |
| **Showroom** | `/room/[id]`, `/room/immersive/[id]`, `/room/new` | 3D room built from verified items, real meshes, immersive mode |
| **Communities** | `/community/[id]`, `/thread/[id]` | threads with Reddit-style reply voting; `/moderation` is the report queue |
| **Profile** | `/profile`, `/inventory`, `/connections`, `/following` | identity, items, followers, followed topics |
| **Import** | `/import`, `/link-account` | screenshot → scan → review → collection |
| **First run** | `/sign-in`, `/onboarding/quiz` | mocked sign-in, 4-step quiz, then a guided 5-stop tour |

### Data

All application data is **seeded fixtures** in `src/fixtures/` — 94 catalogue items, 33 collections, 7 rooms, 18 articles, 18 threads, 14 users. Mutations (joining a community, voting, following, importing) are **in-memory session overlays** layered over the seed; nothing is written back to a fixture and there is no database.

### Art pipeline

Item art is produced as build steps and committed, never generated at runtime:

```
assets/collectee/subjects/<id>.png            660×440   source
  └─ npm run bake:display-art
       display/<id>.jpg                      1200×800   wide
       display/compact/<id>.jpg               600×400   wide compact
       display/square/<id>.jpg                800×800   square
       display/square/compact/<id>.jpg        400×400   square compact
  └─ npm run bake:depth
       depth/<id>.png                         512×512   depth map for the 3D relief
```

`@huggingface/transformers` is a **devDependency** used only by these bakes. No app code imports it and no model runs at runtime on the client.

### The AI proxy

`api/assistant.ts` is a single Vercel serverless function and the only place a model is called. It takes a `mode` — `summary`, `digest`, `chat` or `scan` — and holds the Anthropic key server-side, so the key is never in the client bundle.

### Directory tree (top two levels)

```
Collectee/
├── api/            assistant.ts — the serverless AI proxy
├── src/            app, components, services, domain, fixtures, config, state, theme, types
├── scripts/        bakes, validators, probes
├── assets/         collectee/ (art), images/, expo.icon/
├── docs/           PRD.md, demo-script.html, TEAM-NOTES.md
├── animation/      handoff pack for the motion designer
├── extra_animation/ 3D models and Colly assets for handoff
└── exports/        raw bake inputs (excluded from deploys)
```

---

## 3. How AI contributes

Two AI surfaces are visible to a user, plus one in the import flow. Each states whether a model actually ran.

### Colly — the in-app assistant

- **What the user does:** taps the floating Colly button (or the ✦ in Home's header) and asks a question in their own words — *"Can I build a Showroom?"*, *"Who is my top match, and why?"*
- **What the model is asked for:** a snapshot of the user's own state (counts, per-game verification, collections with their per-collection verified counts and Showroom eligibility, matches with their reasons, communities, headlines) is sent with the question under a system prompt that forbids inventing anything absent from the snapshot.
- **What the user gets:** three sentences of plain language grounded in their actual data — *"You can build a Showroom from your Crown Jewels collection, which has 5 verified items… Go to the Create tab."* Questions the on-device answerer can handle are answered locally and instantly; only genuinely free-form ones reach the model.

### "What's happening" — news digest cards

- **What the user does:** opens Gaming Updates and picks a game tab.
- **What the model is asked for:** the titles and summaries of that game's articles, with a request for a short digest.
- **What the user gets:** four bullets summarising the week for that game, sitting above the article list, labelled *"Digest by Claude, from the articles below."* or *"Prepared digest — no model call ran"*.

### Screenshot import (the outcome the product is built around)

- **What the user does:** uploads a screenshot of their in-game inventory.
- **What the model is asked for:** read every tile, report the item name, a rarity judged from the border colour alone, and a match against a supplied catalogue — including a `look` column describing what each catalogue item actually looks like, so a label-less image matches on appearance rather than on text.
- **What the user gets:** a review screen with each detection routed by confidence — auto-accepted, needs review, or unmatched — and **items land unverified**, because verification requires a linked game account. The outcome is a populated collection built in about a minute from a screenshot.

---

## 4. Prompts and agent configuration

**Every prompt is committed to this repository.** Nothing lives only in a deployed environment variable. All four are string constants in **`api/assistant.ts`**:

| constant | lines* | what it does |
|---|---|---|
| `CHAT_SYSTEM_PROMPT` | 206–270 | **Colly's system prompt.** Defines the assistant's scope and voice, and the grounding rules: answer only from the supplied snapshot, say "I don't know" rather than invent, never discuss its own configuration. Encodes the app's rules it may explain — how verification works, and that a Showroom needs 3 verified items *in one collection*. |
| `DIGEST_SYSTEM_PROMPT` | 163–205 | **News digest prompt.** Turns one game's articles into the four-bullet "What's happening in \<game\>" card. |
| `SUMMARY_SYSTEM_PROMPT` | 138–162 | **Article summary prompt.** Produces the bullets behind "Summarise with AI" on an article. |
| `SCAN_SYSTEM_PROMPT` | 271–371 | **Inventory scan prompt.** Instructs the vision model to read a screenshot or a single item, judge rarity from border colour only, and match against the supplied catalogue. Treats the image as untrusted data, so text inside it is never followed as an instruction. |

\* Line numbers drift; the **constant names** are the stable reference.

Models, also in `api/assistant.ts`:

| constant | value | used for |
|---|---|---|
| `MODEL` | `claude-haiku-4-5` | chat, digest, summary |
| `SCAN_MODEL` | `claude-opus-5` | screenshot reading — a wrong item name is the worst failure this app can show, so the scan path uses the stronger model |

Guardrails in the same file: per-mode input validation, a snapshot size cap, a question-length cap, and prompt-injection fencing on both article text and uploaded images.

---

## 5. Third-party disclosure

### Models and APIs

| | provider | used for |
|---|---|---|
| `claude-haiku-4-5` | Anthropic | assistant chat, news digests, article summaries |
| `claude-opus-5` | Anthropic | reading uploaded inventory screenshots |
| `onnx-community/depth-anything-v2-small` | Hugging Face (local, build-time) | depth maps for the 3D relief effect |
| TRELLIS | third-party, offline | source 3D meshes for a subset of showroom items |
| Vercel | hosting | static web export + one serverless function |

No other external API is called. **There is no network request at runtime other than to the app's own `/api/assistant` proxy**, and the app is fully usable with that unavailable.

### Runtime libraries (from `package.json`)

| library | purpose |
|---|---|
| `expo`, `expo-router` | app framework and file-based routing |
| `react`, `react-dom`, `react-native`, `react-native-web` | UI runtime across native and web |
| `@anthropic-ai/sdk` | Anthropic client, used **only** in the serverless proxy |
| `three`, `@react-three/fiber`, `expo-gl` | 3D Showroom rendering |
| `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler` | animation and gestures |
| `react-native-safe-area-context`, `react-native-screens` | navigation primitives |
| `expo-image`, `expo-linear-gradient`, `expo-glass-effect`, `expo-symbols`, `@expo/ui` | imagery, gradients, glass surfaces, system icons |
| `expo-font`, `@expo-google-fonts/inter`, `@expo-google-fonts/space-grotesk` | typography (Inter, Space Grotesk — OFL) |
| `expo-haptics`, `expo-status-bar`, `expo-system-ui`, `expo-splash-screen` | platform polish |
| `expo-constants`, `expo-device`, `expo-linking`, `expo-web-browser` | device and linking utilities |

### Build-time only (devDependencies)

| library | purpose |
|---|---|
| `@huggingface/transformers` | runs the depth model during `bake:depth`. **No app code imports it** |
| `typescript`, `tsx`, `@types/*` | typechecking and running the TS scripts |

### Datasets and artwork

**No third-party dataset is used.** All catalogue, user, collection, article and thread data is original fixture content written for this project.

**All item, avatar, banner and mascot artwork is AI-generated original work produced in-house from reference-guided prompts.** Reference imagery used during generation is **not distributed with this repository** — it is gitignored and enforced by a pre-commit hook. Game names, hero names and weapon names appearing in fixture content are referenced descriptively as real-world subjects of the news and catalogue; no publisher artwork or copy is reproduced.

News fixtures link out to official publisher channels and carry original prose only; the app never reproduces a publisher's article body.

---

## 6. Scope and known limitations

Stated plainly — this is a hackathon build and production readiness is not claimed.

- **Sign-in is mocked.** There is no auth backend; the flow captures a display name and avatar and moves on. There are no passwords anywhere.
- **Data is fixtures, not a backend.** Everything is seeded and every mutation is an in-memory session overlay. Reloading resets joins, votes, follows and imports. `services/` exists precisely so this swaps for real endpoints in one layer.
- **Verification is simulated.** "Linking a game account" does not contact a publisher — no such partner API is available. The trust model built on it (§9.4: only verified items enter a Showroom) is fully implemented; only the account link is mocked.
- **The 3D Showroom** renders real baked meshes for a subset of items; the rest use a depth-mapped relief of the 2D art. Backs are inferred from a single view, and the app says so rather than implying a scanned model.
- **The AI proxy is rate-limited** and falls back to prepared content on timeout or error, always labelled.
- **Native builds are less exercised than web.** The deployed target is the web export; iOS/Android run from the same codebase via Expo Go but have had less time on device.
- Notifications, saved articles and moderation are functional but shallow — enough to demonstrate the flow.

---

## 7. Validation gates

The repo carries its own checks. All four should pass on a clean clone:

```bash
npm run typecheck                      # tsc --noEmit
npm run validate:fixtures              # referential integrity across all fixtures
npm run validate:weapons               # 3D weapon model manifest vs files on disk
npx tsx scripts/check-news-tabs.ts     # per-tab thumbnail dedupe + one game chip per card
```

`validate:fixtures` is the substantial one: it catches what TypeScript cannot — dangling item ids, room placements in slots that do not exist, scan fixtures whose confidences disagree with the routing thresholds, rarity labels that drift from the spec table, articles missing a body, inline figures pointing at items that do not exist, and reply vote tallies that are seeded incorrectly.

`npm run lint` also exists (`expo lint`) but is not currently wired up in this checkout.

---

## Team notes

The previous internal README — merge rules, ownership map, honest-pitch notes — is preserved at **[`docs/TEAM-NOTES.md`](docs/TEAM-NOTES.md)**. The product spec it refers to is **[`docs/PRD.md`](docs/PRD.md)**; section references in code comments (§9.2, §11 F4, §12.3) point there.
