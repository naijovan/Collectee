/**
 * Real item art, keyed by catalogue `Item.id`.
 *
 * `ItemArt` (src/components/primitives.tsx) asks this module for a bitmap and
 * falls back to its deterministic colour block when there isn't one, so the app
 * renders whether or not a given item has a render yet.
 *
 * ── Layout on disk ────────────────────────────────────────────────────────
 *   assets/collectee/subjects/<itemId>.png    660x440 characters, `cover`
 *   assets/collectee/items/<itemId>.png       620x620 objects,    `contain`
 *   assets/collectee/backdrops/<themeId>.png  1920x1080 rooms,    `cover`
 *
 * **The filename IS the id.** Every render is named for the catalogue item (or
 * room theme) it belongs to, which is what makes this map generatable and
 * `scripts/audit-art.ts` a set comparison instead of a judgement call. The art
 * packs ship their own naming, so files are renamed on the way in — the two
 * systematic differences were `valorant-*` (catalogue uses `val-*`) and
 * `codm-mace-blackout` (catalogue calls it `codm-mansk-blackout`).
 *
 * ── Why the map is written out ────────────────────────────────────────────
 * Metro resolves `require()` at BUILD time, so `require(someVariable)` does not
 * work in React Native and every path must appear as a literal exactly once.
 * A line pointing at a file that is not on disk is a build error, not a runtime
 * fallback. Regenerate rather than hand-edit when a pack lands.
 *
 * ── Art policy (asset-manifest.json, and PRD §15 IP row) ──────────────────
 * ORIGINAL prototype concept art. The packs' game names are metadata mappings
 * only. This is not publisher artwork and must never be presented as such.
 *
 * Coverage at generation: 93/93 catalogue items, 6 room backdrops.
 */

import type { ImageSourcePropType } from 'react-native';

import type { GameTitle } from '@/types';

/**
 * A render plus how it should sit in its box.
 *
 * `fit` is per-asset because the packs ship two shapes: 3:2 character portraits
 * that should fill the frame, and 1:1 objects on empty backgrounds that must
 * not be cropped. One rule for both either letterboxes every portrait or slices
 * the ends off every blade.
 */
export interface ArtEntry {
  source: ImageSourcePropType;
  fit: 'cover' | 'contain';
  /** Art description. Screen readers get this, not the filename. */
  alt: string;
}

const portrait = (source: ImageSourcePropType, alt: string): ArtEntry => ({
  source,
  fit: 'cover',
  alt,
});

/** `contain`, per each manifest's object rule — never crop an object. */
const object = (source: ImageSourcePropType, alt: string): ArtEntry => ({
  source,
  fit: 'contain',
  alt,
});

/** Catalogue item id → bundled render. Generated; see the header. */
const ART = {
  // ── Call of Duty: Mobile ──────────────────────────────────────
  'codm-dlq33-lightbringer': object(
    require('../../assets/collectee/items/codm-dlq33-lightbringer.png'),
    'Original prototype concept art — DL Q33 — Lightbringer',
  ),
  'codm-fennec-ascended': object(
    require('../../assets/collectee/items/codm-fennec-ascended.png'),
    'Original prototype concept art — Fennec — Ascended',
  ),
  'codm-ak117-cordite-storm': object(
    require('../../assets/collectee/items/codm-ak117-cordite-storm.png'),
    'Original prototype concept art — AK117 — Cordite Storm',
  ),
  'codm-drh-cerberus': object(
    require('../../assets/collectee/items/codm-drh-cerberus.png'),
    'Original prototype concept art — DR-H — Cerberus',
  ),
  'codm-qq9-diavolo': object(
    require('../../assets/collectee/items/codm-qq9-diavolo.png'),
    'Original prototype concept art — QQ9 — Diavolo',
  ),
  'codm-ghost-nightfall': portrait(
    require('../../assets/collectee/subjects/codm-ghost-nightfall.png'),
    'Original prototype concept art — Ghost — Nightfall',
  ),
  'codm-kilo141-glacier': object(
    require('../../assets/collectee/items/codm-kilo141-glacier.png'),
    'Original prototype concept art — KILO 141 — Glacier',
  ),
  'codm-m4-arctic-hunter': object(
    require('../../assets/collectee/items/codm-m4-arctic-hunter.png'),
    'Original prototype concept art — M4 — Arctic Hunter',
  ),
  'codm-alias-frostbite': portrait(
    require('../../assets/collectee/subjects/codm-alias-frostbite.png'),
    'Original prototype concept art — Alias — Frostbite',
  ),
  'codm-rus79u-molten': object(
    require('../../assets/collectee/items/codm-rus79u-molten.png'),
    'Original prototype concept art — RUS-79U — Molten Core',
  ),
  'codm-hbra3-tidal': object(
    require('../../assets/collectee/items/codm-hbra3-tidal.png'),
    'Original prototype concept art — HBRa3 — Tidal Wave',
  ),
  'codm-pdw57-abyss': object(
    require('../../assets/collectee/items/codm-pdw57-abyss.png'),
    'Original prototype concept art — PDW-57 — Abyssal',
  ),
  'codm-mac10-riptide': object(
    require('../../assets/collectee/items/codm-mac10-riptide.png'),
    'Original prototype concept art — MAC-10 — Riptide',
  ),
  'codm-price-monsoon': portrait(
    require('../../assets/collectee/subjects/codm-price-monsoon.png'),
    'Original prototype concept art — Price — Monsoon',
  ),
  'codm-locus-ironclad': object(
    require('../../assets/collectee/items/codm-locus-ironclad.png'),
    'Original prototype concept art — Locus — Ironclad',
  ),
  'codm-charm-golden-skull': object(
    require('../../assets/collectee/items/codm-charm-golden-skull.png'),
    'Original prototype concept art — Charm — Golden Skull',
  ),
  'codm-mansk-blackout': portrait(
    require('../../assets/collectee/subjects/codm-mansk-blackout.png'),
    'Original prototype concept art — Mace — Blackout',
  ),
  'codm-camo-urban-splinter': object(
    require('../../assets/collectee/items/codm-camo-urban-splinter.png'),
    'Original prototype concept art — Camo — Urban Splinter',
  ),
  'codm-camo-desert-strata': object(
    require('../../assets/collectee/items/codm-camo-desert-strata.png'),
    'Original prototype concept art — Camo — Desert Strata',
  ),
  'codm-asm10-sandstorm': object(
    require('../../assets/collectee/items/codm-asm10-sandstorm.png'),
    'Original prototype concept art — ASM10 — Sandstorm',
  ),
  'codm-charm-dog-tag': object(
    require('../../assets/collectee/items/codm-charm-dog-tag.png'),
    'Original prototype concept art — Charm — Dog Tag',
  ),
  'codm-camo-olive-standard': object(
    require('../../assets/collectee/items/codm-camo-olive-standard.png'),
    'Original prototype concept art — Camo — Olive Standard',
  ),
  'codm-soap-recruit': portrait(
    require('../../assets/collectee/subjects/codm-soap-recruit.png'),
    'Original prototype concept art — Soap — Recruit',
  ),
  'codm-charm-brass-shell': object(
    require('../../assets/collectee/items/codm-charm-brass-shell.png'),
    'Original prototype concept art — Charm — Brass Shell',
  ),
  'codm-charm-chronoseal': object(
    require('../../assets/collectee/items/codm-charm-chronoseal.png'),
    'Original bronze and violet magical time relic',
  ),
  'codm-charm-sweetheart-prism': object(
    require('../../assets/collectee/items/codm-charm-sweetheart-prism.png'),
    'Original pink heart-crystal collectible charm',
  ),

  // ── Valorant ──────────────────────────────────────────────────
  'val-elderflame-vandal': object(
    require('../../assets/collectee/items/val-elderflame-vandal.png'),
    'Original prototype concept art — Elderflame Vandal',
  ),
  'val-elderflame-operator': object(
    require('../../assets/collectee/items/val-elderflame-operator.png'),
    'Original prototype concept art — Elderflame Operator',
  ),
  'val-elderflame-dagger': object(
    require('../../assets/collectee/items/val-elderflame-dagger.png'),
    'Original prototype concept art — Elderflame Dagger',
  ),
  'val-singularity-phantom': object(
    require('../../assets/collectee/items/val-singularity-phantom.png'),
    'Original prototype concept art — Singularity Phantom',
  ),
  'val-singularity-knife': object(
    require('../../assets/collectee/items/val-singularity-knife.png'),
    'Original prototype concept art — Singularity Knife',
  ),
  'val-spectrum-phantom': object(
    require('../../assets/collectee/items/val-spectrum-phantom.png'),
    'Original prototype concept art — Spectrum Phantom',
  ),
  'val-spectrum-waveform': object(
    require('../../assets/collectee/items/val-spectrum-waveform.png'),
    'Original prototype concept art — Spectrum Waveform',
  ),
  'val-araxys-vandal': object(
    require('../../assets/collectee/items/val-araxys-vandal.png'),
    'Original prototype concept art — Araxys Vandal',
  ),
  'val-ruination-sword': object(
    require('../../assets/collectee/items/val-ruination-sword.png'),
    'Original prototype concept art — Ruination Sword',
  ),
  'val-champions-2022-phantom': object(
    require('../../assets/collectee/items/val-champions-2022-phantom.png'),
    'Original prototype concept art — Champions 2022 Phantom',
  ),
  'val-prime-vandal': object(
    require('../../assets/collectee/items/val-prime-vandal.png'),
    'Original prototype concept art — Prime Vandal',
  ),
  'val-prime-karambit': object(
    require('../../assets/collectee/items/val-prime-karambit.png'),
    'Original prototype concept art — Prime Karambit',
  ),
  'val-prime-spectre': object(
    require('../../assets/collectee/items/val-prime-spectre.png'),
    'Original prototype concept art — Prime Spectre',
  ),
  'val-reaver-vandal': object(
    require('../../assets/collectee/items/val-reaver-vandal.png'),
    'Original prototype concept art — Reaver Vandal',
  ),
  'val-reaver-sheriff': object(
    require('../../assets/collectee/items/val-reaver-sheriff.png'),
    'Original prototype concept art — Reaver Sheriff',
  ),
  'val-reaver-knife': object(
    require('../../assets/collectee/items/val-reaver-knife.png'),
    'Original prototype concept art — Reaver Knife',
  ),
  'val-oni-phantom': object(
    require('../../assets/collectee/items/val-oni-phantom.png'),
    'Original prototype concept art — Oni Phantom',
  ),
  'val-ion-operator': object(
    require('../../assets/collectee/items/val-ion-operator.png'),
    'Original prototype concept art — Ion Operator',
  ),
  'val-glitchpop-vandal': object(
    require('../../assets/collectee/items/val-glitchpop-vandal.png'),
    'Original prototype concept art — Glitchpop Vandal',
  ),
  'val-sovereign-ghost': object(
    require('../../assets/collectee/items/val-sovereign-ghost.png'),
    'Original prototype concept art — Sovereign Ghost',
  ),
  'val-origin-vandal': object(
    require('../../assets/collectee/items/val-origin-vandal.png'),
    'Original prototype concept art — Origin Vandal',
  ),
  'val-origin-phantom': object(
    require('../../assets/collectee/items/val-origin-phantom.png'),
    'Original prototype concept art — Origin Phantom',
  ),
  'val-nebula-sheriff': object(
    require('../../assets/collectee/items/val-nebula-sheriff.png'),
    'Original prototype concept art — Nebula Sheriff',
  ),
  'val-sarmad-guardian': object(
    require('../../assets/collectee/items/val-sarmad-guardian.png'),
    'Original prototype concept art — Sarmad Guardian',
  ),
  'val-prism-spectre': object(
    require('../../assets/collectee/items/val-prism-spectre.png'),
    'Original prototype concept art — Prism Spectre',
  ),
  'val-luxe-classic': object(
    require('../../assets/collectee/items/val-luxe-classic.png'),
    'Original prototype concept art — Luxe Classic',
  ),
  'val-infantry-bulldog': object(
    require('../../assets/collectee/items/val-infantry-bulldog.png'),
    'Original prototype concept art — Infantry Bulldog',
  ),
  'val-voidglass-blade': object(
    require('../../assets/collectee/items/val-voidglass-blade.png'),
    'Original black-crystal violet fantasy short blade cosmetic',
  ),
  'val-riftblade-katana': object(
    require('../../assets/collectee/items/val-riftblade-katana.png'),
    'Original violet crystal fantasy katana cosmetic',
  ),

  // ── Mobile Legends: Bang Bang ─────────────────────────────────
  'mlbb-gusion-cyber-faust': portrait(
    require('../../assets/collectee/subjects/mlbb-gusion-cyber-faust.png'),
    'Original prototype concept art — Gusion — Cyber Faust',
  ),
  'mlbb-lancelot-royal-matador': portrait(
    require('../../assets/collectee/subjects/mlbb-lancelot-royal-matador.png'),
    'Original prototype concept art — Lancelot — Royal Matador',
  ),
  'mlbb-kagura-feathery-wonderland': portrait(
    require('../../assets/collectee/subjects/mlbb-kagura-feathery-wonderland.png'),
    'Original prototype concept art — Kagura — Feathery Wonderland',
  ),
  'mlbb-ling-serpent-lord': portrait(
    require('../../assets/collectee/subjects/mlbb-ling-serpent-lord.png'),
    'Original prototype concept art — Ling — Serpent Lord',
  ),
  'mlbb-miya-modena-butterfly': portrait(
    require('../../assets/collectee/subjects/mlbb-miya-modena-butterfly.png'),
    'Original prototype concept art — Miya — Modena Butterfly',
  ),
  'mlbb-alucard-obsidian-blade': portrait(
    require('../../assets/collectee/subjects/mlbb-alucard-obsidian-blade.png'),
    'Original prototype concept art — Alucard — Obsidian Blade',
  ),
  'mlbb-gord-conqueror': portrait(
    require('../../assets/collectee/subjects/mlbb-gord-conqueror.png'),
    'Original prototype concept art — Gord — Conqueror',
  ),
  'mlbb-selena-virulent-nightmare': portrait(
    require('../../assets/collectee/subjects/mlbb-selena-virulent-nightmare.png'),
    'Original prototype concept art — Selena — Virulent Nightmare',
  ),
  'mlbb-gusion-cyber-ops': portrait(
    require('../../assets/collectee/subjects/mlbb-gusion-cyber-ops.png'),
    'Original prototype concept art — Gusion — Cyber Ops',
  ),
  'mlbb-granger-starfall-knight': portrait(
    require('../../assets/collectee/subjects/mlbb-granger-starfall-knight.png'),
    'Original prototype concept art — Granger — Starfall Knight',
  ),
  'mlbb-kagura-cherry-witch': portrait(
    require('../../assets/collectee/subjects/mlbb-kagura-cherry-witch.png'),
    'Original prototype concept art — Kagura — Cherry Witch',
  ),
  'mlbb-hayabusa-shadow-vanguard': portrait(
    require('../../assets/collectee/subjects/mlbb-hayabusa-shadow-vanguard.png'),
    'Original prototype concept art — Hayabusa — Shadow Vanguard',
  ),
  'mlbb-fanny-skylark': portrait(
    require('../../assets/collectee/subjects/mlbb-fanny-skylark.png'),
    'Original prototype concept art — Fanny — Lightborn Skylark',
  ),
  'mlbb-chou-dragon-boy': portrait(
    require('../../assets/collectee/subjects/mlbb-chou-dragon-boy.png'),
    'Original prototype concept art — Chou — Dragon Boy',
  ),
  'mlbb-lesley-cyber-blossom': portrait(
    require('../../assets/collectee/subjects/mlbb-lesley-cyber-blossom.png'),
    'Original prototype concept art — Lesley — Cyber Blossom',
  ),
  'mlbb-tigreal-lightborn-paladin': portrait(
    require('../../assets/collectee/subjects/mlbb-tigreal-lightborn-paladin.png'),
    'Original prototype concept art — Tigreal — Lightborn Paladin',
  ),
  'mlbb-layla-malefic-gunner': portrait(
    require('../../assets/collectee/subjects/mlbb-layla-malefic-gunner.png'),
    'Original prototype concept art — Layla — Malefic Gunner',
  ),
  'mlbb-zilong-eastern-warrior': portrait(
    require('../../assets/collectee/subjects/mlbb-zilong-eastern-warrior.png'),
    'Original prototype concept art — Zilong — Eastern Warrior',
  ),
  'mlbb-akai-panda-warrior': portrait(
    require('../../assets/collectee/subjects/mlbb-akai-panda-warrior.png'),
    'Original prototype concept art — Akai — Panda Warrior',
  ),
  'mlbb-balmond-frostmoon': portrait(
    require('../../assets/collectee/subjects/mlbb-balmond-frostmoon.png'),
    'Original prototype concept art — Balmond — Frostmoon Dominator',
  ),
  'mlbb-eudora-royal-sorcerer': portrait(
    require('../../assets/collectee/subjects/mlbb-eudora-royal-sorcerer.png'),
    'Original prototype concept art — Eudora — Royal Sorcerer',
  ),
  'mlbb-nana-cat-fairy': portrait(
    require('../../assets/collectee/subjects/mlbb-nana-cat-fairy.png'),
    'Original prototype concept art — Nana — Cat Fairy',
  ),
  'mlbb-manifold-rift': portrait(
    require('../../assets/collectee/subjects/mlbb-manifold-rift.png'),
    'Original faceless cosmic time-guardian skin concept',
  ),
  'mlbb-emberfall-warlord': portrait(
    require('../../assets/collectee/subjects/mlbb-emberfall-warlord.png'),
    'Original black volcanic ember-warlord skin concept',
  ),
  'mlbb-void-empress': portrait(
    require('../../assets/collectee/subjects/mlbb-void-empress.png'),
    'Original crowned violet void-empress skin concept',
  ),
  'mlbb-frost-sentinel': portrait(
    require('../../assets/collectee/subjects/mlbb-frost-sentinel.png'),
    'Original crystalline frost-sentinel hero skin concept',
  ),
  'mlbb-radiant-huntress': portrait(
    require('../../assets/collectee/subjects/mlbb-radiant-huntress.png'),
    'Original ivory and rose-gold celestial huntress skin concept',
  ),
  'mlbb-cyber-breacher': portrait(
    require('../../assets/collectee/subjects/mlbb-cyber-breacher.png'),
    'Original cyan and violet cyber breacher skin concept',
  ),
  'mlbb-lightborn-defender': portrait(
    require('../../assets/collectee/subjects/mlbb-lightborn-defender.png'),
    'Original gold and blue celestial guardian skin concept',
  ),
  'mlbb-shadow-protocol': portrait(
    require('../../assets/collectee/subjects/mlbb-shadow-protocol.png'),
    'Original black, magenta and cyan cyber-assassin skin concept',
  ),
  'mlbb-slipstream-pilot': portrait(
    require('../../assets/collectee/subjects/mlbb-slipstream-pilot.png'),
    'Original orange and blue time-runner pilot skin concept',
  ),
  'mlbb-solar-paladin': portrait(
    require('../../assets/collectee/subjects/mlbb-solar-paladin.png'),
    'Original gold and white solar-paladin hero skin concept',
  ),
  'mlbb-voidstorm-spirit': portrait(
    require('../../assets/collectee/subjects/mlbb-voidstorm-spirit.png'),
    'Original violet lightning storm-spirit skin concept',
  ),
  'mlbb-arcane-revenant': portrait(
    require('../../assets/collectee/subjects/mlbb-arcane-revenant.png'),
    'Original teal and violet spectral-scholar skin concept',
  ),
  'mlbb-neon-ronin': portrait(
    require('../../assets/collectee/subjects/mlbb-neon-ronin.png'),
    'Original masked purple cyber-ronin skin concept',
  ),
  'mlbb-valentine-sweetheart': portrait(
    require('../../assets/collectee/subjects/mlbb-valentine-sweetheart.png'),
    'Original pink Valentine-themed hero skin concept',
  ),
  'mlbb-zodiac-aquarius': portrait(
    require('../../assets/collectee/subjects/mlbb-zodiac-aquarius.png'),
    'Original blue Aquarius water-mage skin concept',
  ),
  'mlbb-neon-encore': portrait(
    require('../../assets/collectee/subjects/mlbb-neon-encore.png'),
    'Original violet and cyan neon-popstar skin concept',
  ),
} satisfies Record<string, ArtEntry>;

/** Every id that has a render. Placement lists below are checked against it. */
export type ArtItemId = keyof typeof ART;

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
 * Title → its cover image, for the Import landing cards.
 *
 * Supplied cover art rather than anything from the generated packs, so unlike
 * everything else in this file these are NOT original prototype renders — they
 * are the real games' artwork, used to identify the title being imported from.
 * Keep that distinction in mind if the deck or the build is ever published; the
 * art policy above covers `ART` and `ROOM_BACKDROPS`, not this map.
 *
 * Square sources, drawn into a square thumb, so `cover` never crops anything.
 *
 * ⚠️ Hand-written. The `ART` map above is generated; this and `ART_PLACEMENTS`
 * are not, so preserve them if the generator is ever re-run.
 */
export const GAME_COVERS: Record<GameTitle, ImageSourcePropType> = {
  codm: require('../../assets/collectee/games/codm.webp'),
  valorant: require('../../assets/collectee/games/valorant.webp'),
  mlbb: require('../../assets/collectee/games/mlbb.png'),
};

/**
 * Room theme id → backdrop. J3's `RoomScene` is Jovan's file, so these are
 * exported for the Room flow to pick up rather than wired in from here.
 * Backdrops are `cover` at 50% 50%; item slots stay a separate runtime overlay.
 */
export const ROOM_BACKDROPS: Record<string, ImageSourcePropType> = {
  'theme-anime-dojo': require('../../assets/collectee/backdrops/theme-anime-dojo.png'),
  'theme-collectors-study': require('../../assets/collectee/backdrops/theme-collectors-study.png'),
  'theme-cyber-shrine': require('../../assets/collectee/backdrops/theme-cyber-shrine.png'),
  'theme-esports-locker': require('../../assets/collectee/backdrops/theme-esports-locker.png'),
  'theme-fantasy-armoury': require('../../assets/collectee/backdrops/theme-fantasy-armoury.png'),
  'theme-weapon-vault': require('../../assets/collectee/backdrops/theme-weapon-vault.png'),
};

/** The bundled render for an item, or null when it has none yet. */
export function artFor(itemId: string): ArtEntry | null {
  return (ART as Record<string, ArtEntry>)[itemId] ?? null;
}

/** Whether an item has a render. Lets a cover skip items that would be blocks. */
export function hasArt(itemId: string): boolean {
  return artFor(itemId) !== null;
}

/** The backdrop for a room theme, or null when the theme has none. */
export function backdropFor(themeId: string): ImageSourcePropType | null {
  return ROOM_BACKDROPS[themeId] ?? null;
}

/** How many items currently have real art. Used by scripts/audit-art.ts. */
export function artCoverage(): number {
  return Object.keys(ART).length;
}

/** Every id with a render — the audit compares this against the catalogue. */
export function artIds(): string[] {
  return Object.keys(ART);
}
