/**
 * Real item art, keyed by catalogue `Item.id`.
 *
 * `ItemArt` (src/components/primitives.tsx) asks this module for a bitmap and
 * falls back to its deterministic colour block when there isn't one, so the app
 * renders correctly whether or not the art pack is installed. That fallback is
 * the reason this can ship before every item has a render.
 *
 * ── Where the files go ────────────────────────────────────────────────────
 *   assets/collectee/subjects/*.png   660x440 hero skins, cropped to the face
 *   assets/collectee/items/*.png      620x620 weapons and charms, full object
 * These are the pack's `app-ready` variant: the crop is already baked in from
 * each asset's `focalPoint`, so nothing here re-frames anything. The pack's own
 * filenames are preserved so a regenerated pack drops straight in. Only the
 * KEYS below are ours.
 *
 * ── Why the map is written out by hand ────────────────────────────────────
 * Metro resolves `require()` at BUILD time. `require(someVariable)` does not
 * work in React Native, so every file has to appear as a literal path exactly
 * once. That also means a line pointing at a file that is not on disk is a
 * build error, not a runtime fallback.
 *
 * ── Art policy (asset-manifest.json, and PRD §15 IP row) ──────────────────
 * This is ORIGINAL prototype concept art. Game names in the pack are metadata
 * categories only. It is not publisher artwork and must never be presented as
 * such. The `alt` strings come from the manifest and say so.
 */

import type { ImageSourcePropType } from 'react-native';

/**
 * A render plus how it should sit in its box.
 *
 * `fit` is per-asset rather than global because the pack ships two shapes:
 * 3:2 character portraits, which should fill the frame, and 1:1 objects on
 * empty backgrounds, which must not be cropped. Using one rule for both either
 * letterboxes every portrait or slices the ends off every blade.
 */
export interface ArtEntry {
  source: ImageSourcePropType;
  fit: 'cover' | 'contain';
  /** Manifest `alt`. Screen readers get the art description, not the filename. */
  alt: string;
}

const portrait = (source: ImageSourcePropType, alt: string): ArtEntry => ({
  source,
  fit: 'cover',
  alt,
});

/** `contain`, per the manifest's `defaults.itemObjectFit` — never crop an object. */
const object = (source: ImageSourcePropType, alt: string): ArtEntry => ({
  source,
  fit: 'contain',
  alt,
});

/**
 * Catalogue item id → bundled image.
 *
 * Keys are OUR ids (`<title>-<slug>`, §12.2); the paths keep the pack's shipped
 * filenames, which is why the two sides do not always read the same — the pack
 * was authored against the Figma's title list (Overwatch 2 / Dota 2 / League),
 * and those subjects are re-mapped onto the three confirmed titles in §8.1.
 *
 * ⚠️ The pack's first delivery arrived with sequential export names, and files
 * 14–17 were NOT in manifest order (shadow-assassin, void-empress,
 * winged-huntress, popstar, where the manifest reads huntress, empress,
 * popstar, assassin). Every file was identified by eye before being renamed.
 * If the pack is regenerated, re-check rather than trusting the numbering.
 */
const ART = {
  // ── Hero skins → mlbb. 3:2 portraits, already framed on the face.
  'mlbb-lightborn-defender': portrait(
    require('../../assets/collectee/subjects/mlbb-lightborn-defender.png'),
    'Original gold and blue celestial guardian skin concept',
  ),
  'mlbb-valentine-sweetheart': portrait(
    require('../../assets/collectee/subjects/mlbb-valentine-sweetheart.png'),
    'Original pink Valentine-themed hero skin concept',
  ),
  'mlbb-cyber-breacher': portrait(
    require('../../assets/collectee/subjects/mlbb-saber-breacher.png'),
    'Original cyan and violet cyber breacher skin concept',
  ),
  'mlbb-zodiac-aquarius': portrait(
    require('../../assets/collectee/subjects/mlbb-zodiac-aquarius.png'),
    'Original blue Aquarius water-mage skin concept',
  ),
  'mlbb-neon-ronin': portrait(
    require('../../assets/collectee/subjects/mlbb-neon-ronin.png'),
    'Original masked purple cyber-ronin skin concept',
  ),
  'mlbb-slipstream-pilot': portrait(
    require('../../assets/collectee/subjects/ow2-slipstream-pilot.png'),
    'Original orange and blue time-runner pilot skin concept',
  ),
  'mlbb-frost-sentinel': portrait(
    require('../../assets/collectee/subjects/ow2-frost-sentinel.png'),
    'Original crystalline frost-sentinel hero skin concept',
  ),
  'mlbb-solar-paladin': portrait(
    require('../../assets/collectee/subjects/ow2-solar-paladin.png'),
    'Original gold and white solar-paladin hero skin concept',
  ),
  'mlbb-emberfall-warlord': portrait(
    require('../../assets/collectee/subjects/dota2-ember-warlord.png'),
    'Original black volcanic ember-warlord skin concept',
  ),
  'mlbb-manifold-rift': portrait(
    require('../../assets/collectee/subjects/dota2-faceless-paradox.png'),
    'Original faceless cosmic time-guardian skin concept',
  ),
  'mlbb-arcane-revenant': portrait(
    require('../../assets/collectee/subjects/dota2-arcane-revenant.png'),
    'Original teal and violet spectral-scholar skin concept',
  ),
  'mlbb-voidstorm-spirit': portrait(
    require('../../assets/collectee/subjects/dota2-voidstorm-spirit.png'),
    'Original violet lightning storm-spirit skin concept',
  ),
  'mlbb-radiant-huntress': portrait(
    require('../../assets/collectee/subjects/lol-prestige-winged-huntress.png'),
    'Original ivory and rose-gold celestial huntress skin concept',
  ),
  'mlbb-void-empress': portrait(
    require('../../assets/collectee/subjects/lol-void-empress.png'),
    'Original crowned violet void-empress skin concept',
  ),
  'mlbb-neon-encore': portrait(
    require('../../assets/collectee/subjects/lol-neon-popstar.png'),
    'Original violet and cyan neon-popstar skin concept',
  ),
  'mlbb-shadow-protocol': portrait(
    require('../../assets/collectee/subjects/lol-project-shadow-assassin.png'),
    'Original black, magenta and cyan cyber-assassin skin concept',
  ),

  // ── Melee → valorant ────────────────────────────────────────────────────
  'valorant-riftblade-katana': object(
    require('../../assets/collectee/items/mlbb-neon-katana.png'),
    'Original violet crystal fantasy katana cosmetic',
  ),
  'valorant-voidglass-blade': object(
    require('../../assets/collectee/items/lol-voidblade.png'),
    'Original black-crystal violet fantasy short blade cosmetic',
  ),

  // ── Charms → codm ───────────────────────────────────────────────────────
  'codm-charm-sweetheart-prism': object(
    require('../../assets/collectee/items/mlbb-rose-crystal-charm.png'),
    'Original pink heart-crystal collectible charm',
  ),
  'codm-charm-chronoseal': object(
    require('../../assets/collectee/items/dota2-arcana-relic.png'),
    'Original bronze and violet magical time relic',
  ),
} satisfies Record<string, ArtEntry>;

/** Every id that has a render. Placement lists below are checked against it. */
export type ArtItemId = keyof typeof ART;

/**
 * The manifest's `screenAssignments`, translated to our item ids.
 *
 * Only the placements the catalogue cannot already satisfy are listed. Most of
 * the manifest's placements need no table: the viewer owns all 20 of these
 * items and `ItemArt` resolves by item id, so Select items, Arrange, the
 * collection screens, Rooms and the repointed scan fixtures pick the renders up
 * on their own. Home's hero banner is different — its tiles are decorative and
 * are not backed by any item, so the ids have to come from somewhere.
 *
 * Typed against `ArtItemId`, so a placement pointing at an id with no render is
 * a compile error rather than a silent colour block.
 */
export const ART_PLACEMENTS = {
  'home.heroMosaic': [
    'mlbb-zodiac-aquarius',
    'mlbb-slipstream-pilot',
    'mlbb-emberfall-warlord',
    'mlbb-shadow-protocol',
  ],
  /**
   * The mock inventory screenshots the Scan screen sweeps its beam across. Also
   * decorative, and deliberately NOT the scan's own detections — those arrive
   * with the result, and drawing them mid-scan would show the user items the
   * screen is still pretending to identify.
   */
  'import.scanPreview': [
    'mlbb-neon-ronin',
    'mlbb-void-empress',
    'mlbb-arcane-revenant',
    'mlbb-radiant-huntress',
    'mlbb-frost-sentinel',
    'mlbb-valentine-sweetheart',
    'mlbb-voidstorm-spirit',
    'mlbb-solar-paladin',
    'mlbb-neon-encore',
  ],
} as const satisfies Record<string, readonly ArtItemId[]>;

/**
 * The room backdrop that shipped with the pack but is not in the manifest —
 * a neon display vault. J3's `RoomScene` is Jovan's, so it is exported rather
 * than wired in here; the Room flow can pick it up when he wants it.
 */
export const ROOM_BACKDROPS: Record<string, ImageSourcePropType> = {
  'neon-vault': require('../../assets/collectee/rooms/neon-vault.png'),
};

/** The bundled render for an item, or null when it has none yet. */
export function artFor(itemId: string): ArtEntry | null {
  return (ART as Record<string, ArtEntry>)[itemId] ?? null;
}

/** Whether an item has a render. Lets a cover skip items that would be blocks. */
export function hasArt(itemId: string): boolean {
  return artFor(itemId) !== null;
}

/** How many items currently have real art. Surfaced on the diagnostics screen. */
export function artCoverage(): number {
  return Object.keys(ART).length;
}
