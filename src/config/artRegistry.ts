/**
 * Real item art, keyed by catalogue `Item.id`.
 *
 * `ItemArt` (src/components/primitives.tsx) asks this module for a bitmap and
 * falls back to its deterministic colour block when there isn't one, so the app
 * renders correctly whether or not the art pack is installed. That fallback is
 * the reason this can ship before every item has a render.
 *
 * ── Where the files go ────────────────────────────────────────────────────
 *   assets/collectee/subjects/*.png   portrait 4:5 hero skins
 *   assets/collectee/items/*.png      square 1:1 weapons and charms
 * The pack's own filenames are preserved, so re-running the generator drops
 * straight in. Only the KEYS below are ours.
 *
 * ── Why the map is written out by hand ────────────────────────────────────
 * Metro resolves `require()` at BUILD time. `require(someVariable)` does not
 * work in React Native, so every file has to appear as a literal path exactly
 * once. That also means a line pointing at a file that is not on disk is a
 * build error, not a runtime fallback — uncomment a line only when its PNG is
 * actually there.
 *
 * ── Art policy (asset-manifest.json, and PRD §15 IP row) ──────────────────
 * This is ORIGINAL prototype concept art. Game names are metadata categories
 * only. It is not publisher artwork and must never be presented as such.
 */

import type { ImageSourcePropType } from 'react-native';

/**
 * A render plus how it should sit in its box.
 *
 * `fit` is per-asset rather than global because the pack ships two shapes:
 * 4:5 character portraits, which should fill the frame, and 1:1 objects on
 * empty backgrounds, which must not be cropped. Using one rule for both either
 * letterboxes every portrait or slices the ends off every blade.
 */
export interface ArtEntry {
  source: ImageSourcePropType;
  fit: 'cover' | 'contain';
}

/**
 * Catalogue item id → bundled image.
 *
 * Keys are OUR ids (`<title>-<slug>`, §12.2); the paths keep the pack's shipped
 * filenames, which is why the two sides do not always read the same — the pack
 * was authored against the Figma's title list (Overwatch 2 / Dota 2 / League),
 * and those subjects are re-mapped onto the three confirmed titles in §8.1.
 *
 * ⚠️ The pack's PNGs arrived with sequential export names, and files 14–17 were
 * NOT in manifest order (shadow-assassin, void-empress, winged-huntress,
 * popstar, where the manifest reads huntress, empress, popstar, assassin).
 * Every file was identified by eye before being renamed. If the pack is
 * regenerated, re-check rather than trusting the numbering.
 */
const ART: Record<string, ArtEntry> = {
  // ── Hero skins → mlbb. 4:5 portraits, framed chest-up, so they fill the box.
  'mlbb-lightborn-defender': { source: require('../../assets/collectee/subjects/mlbb-lightborn-defender.png'), fit: 'cover' },
  'mlbb-valentine-sweetheart': { source: require('../../assets/collectee/subjects/mlbb-valentine-sweetheart.png'), fit: 'cover' },
  'mlbb-cyber-breacher': { source: require('../../assets/collectee/subjects/mlbb-saber-breacher.png'), fit: 'cover' },
  'mlbb-zodiac-aquarius': { source: require('../../assets/collectee/subjects/mlbb-zodiac-aquarius.png'), fit: 'cover' },
  'mlbb-neon-ronin': { source: require('../../assets/collectee/subjects/mlbb-neon-ronin.png'), fit: 'cover' },
  'mlbb-slipstream-pilot': { source: require('../../assets/collectee/subjects/ow2-slipstream-pilot.png'), fit: 'cover' },
  'mlbb-frost-sentinel': { source: require('../../assets/collectee/subjects/ow2-frost-sentinel.png'), fit: 'cover' },
  'mlbb-solar-paladin': { source: require('../../assets/collectee/subjects/ow2-solar-paladin.png'), fit: 'cover' },
  'mlbb-emberfall-warlord': { source: require('../../assets/collectee/subjects/dota2-ember-warlord.png'), fit: 'cover' },
  'mlbb-manifold-rift': { source: require('../../assets/collectee/subjects/dota2-faceless-paradox.png'), fit: 'cover' },
  'mlbb-arcane-revenant': { source: require('../../assets/collectee/subjects/dota2-arcane-revenant.png'), fit: 'cover' },
  'mlbb-voidstorm-spirit': { source: require('../../assets/collectee/subjects/dota2-voidstorm-spirit.png'), fit: 'cover' },
  'mlbb-radiant-huntress': { source: require('../../assets/collectee/subjects/lol-prestige-winged-huntress.png'), fit: 'cover' },
  'mlbb-void-empress': { source: require('../../assets/collectee/subjects/lol-void-empress.png'), fit: 'cover' },
  'mlbb-neon-encore': { source: require('../../assets/collectee/subjects/lol-neon-popstar.png'), fit: 'cover' },
  'mlbb-shadow-protocol': { source: require('../../assets/collectee/subjects/lol-project-shadow-assassin.png'), fit: 'cover' },

  // ── Melee → valorant. 1:1 objects on empty space: `contain`, never `cover`,
  //    or the blade tips get cropped off (asset-manifest defaults.itemObjectFit).
  'valorant-riftblade-katana': { source: require('../../assets/collectee/items/mlbb-neon-katana.png'), fit: 'contain' },
  'valorant-voidglass-blade': { source: require('../../assets/collectee/items/lol-voidblade.png'), fit: 'contain' },

  // ── Charms → codm ───────────────────────────────────────────────────────
  'codm-charm-sweetheart-prism': { source: require('../../assets/collectee/items/mlbb-rose-crystal-charm.png'), fit: 'contain' },
  'codm-charm-chronoseal': { source: require('../../assets/collectee/items/dota2-arcana-relic.png'), fit: 'contain' },
};

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
  return ART[itemId] ?? null;
}

/** How many items currently have real art. Surfaced on the diagnostics screen. */
export function artCoverage(): number {
  return Object.keys(ART).length;
}
