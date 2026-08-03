# Prompt for the VS Code coding agent

Copy everything below into the coding agent that has the Collectee app repository open.

---

You are editing the existing **Collectee** mobile app. Integrate the supplied image asset pack into the current screens without redesigning the app or changing its navigation.

## Source files

- Image directory: `collectee-app-ready/images/`
- Metadata and placement rules: `collectee-app-ready/asset-manifest.json`
- Portraits are already card-cropped to 660x440; objects are already fitted to 620x620.

Inspect the repository first and identify the framework, existing asset directory, image component, data/seed files, and all current placeholder or remote image URLs. Do not create a new app.

## Non-negotiable image rule

Every supplied PNG represents exactly **one** hero/skin, item, or weapon. Keep that one-to-one relationship. Do not flatten several supplied files into a new baked image.

When a screen needs a collection cover or homepage banner containing several characters, compose it in code from multiple individual image elements using a grid, clipped columns, or layered cards. This preserves reusability and lets the app animate/focus each collectible separately.

## Implementation steps

1. Copy the `images/` directory into the app's normal static asset location while preserving the `subjects/` and `items/` subfolders.
   - Web/Next/Vite: prefer `public/assets/collectee/` or the repository's existing equivalent.
   - React Native/Expo: prefer `src/assets/collectee/` or the existing equivalent.
2. Import `asset-manifest.json` into the existing data layer. Create one centralized asset resolver keyed by `asset.id`; do not scatter raw file paths throughout components.
3. If this is React Native/Expo, create an explicit static `require()` map for all 20 files because dynamic `require(variable)` is unsupported. If this is web, use the repository's existing static import/public URL convention.
4. Replace placeholder/remote art across these flows using `screenAssignments`, `appPlacements`, and `collectionCompositions` from the manifest:
   - Homepage
   - Import Inventory: scan, matched review, needs review, completion
   - Create & Publish: select items, AI theme suggestion, arrange, preview, public collection
   - Discover: collector matches, shared items, trending collections, community featured collections
   - Collection Room: featured item and item cards
   - Gaming Updates: MLBB, Overwatch 2, Dota 2, and League thumbnails/article heroes
5. Preserve all existing labels, counts, badges, buttons, routes, and interaction logic unless a label directly conflicts with the manifest metadata.
6. Use metadata fields instead of duplicating values:
   - `game`, `gameCode`
   - `entityName`, `cosmeticName`
   - `assetType`, `rarity`, `verificationStatus`
   - `tags`, `collectionIds`
   - `matchConfidence`, `importState`
   - `alt`, `focalPoint`
7. Image styling:
   - Hero/skin portraits: `object-fit: cover`; use the manifest `focalPoint` as `object-position`. The 3:2 files are already face-led for short, wide cards.
   - Items/weapons: `object-fit: contain`; never cover-crop them. Use a dark card background and at most 0–4% extra CSS padding because safe margin is already baked into the files.
   - Keep the existing rounded corners and dark neon visual system.
   - Add lazy loading where supported and prevent layout shift with fixed aspect-ratio containers.
8. Build or reuse a `CollectionCoverMosaic` component that takes 3–4 asset IDs and composes individual images in code. Use it for:
   - `neon-legends`
   - `mlbb-collector-skins`
   - `dota2-arcana-vault`
   - `league-prestige-picks`
   - `overwatch-mythic-skins`
9. The Homepage hero mosaic must use the four IDs in `screenAssignments["home.heroMosaic"]` as four clipped panels. Keep heading/button overlays as live UI text, not embedded in an image.
10. For Import Inventory:
    - Matched list: `screenAssignments["import.matched"]`
    - Needs Review: `screenAssignments["import.needsReview"]`
    - Display `matchConfidence` from metadata.
    - Keep every imported item `unverified` unless the existing app separately confirms linked-account ownership.
11. For Gaming Updates, use `screenAssignments.news.featured` to map each game to its thumbnail/hero art. Reuse the same single-subject image with responsive cropping instead of making duplicate files.
12. Do not present these as official publisher images. They are original prototype concept art categorized by game for demo purposes.

## Suggested data API

Create helpers equivalent to:

```ts
getAssetById(id)
getAssetsByGame(gameCode)
getAssetsForCollection(collectionId)
getAssetsForPlacement(placement)
```

Use the existing project's language and conventions. Do not introduce a new state-management library.

## Verification

After implementation:

1. Search the repository for broken placeholder URLs and remove only those replaced by this pack.
2. Run the existing formatter, type-checker, tests, and production build.
3. Manually verify every referenced manifest file exists.
4. Check that no card displays the wrong game's asset.
5. Check portrait cropping on narrow mobile widths and ensure faces/primary objects remain visible.
6. Confirm no collection cover is a pre-baked collage; each visible subject must remain its own image element.
7. Report the exact files changed, any unresolved placeholders, and the commands/results used to verify the app.

---
