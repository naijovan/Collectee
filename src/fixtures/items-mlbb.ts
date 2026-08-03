/**
 * Mobile Legends: Bang Bang item catalogue (PRD §8.1).
 *
 * ⚠️ VERIFY BEFORE THE DEMO (PRD §16 open question 1 + §12.2).
 * The team plays this title, so this is the catalogue most likely to be caught
 * out by a wrong tier. Names and tiers below need a pass from an MLBB player.
 *
 * Positioning reminder (§8.1): do NOT lead the demo with MLBB. Lead with CODM
 * — a Garena-published title — and let MLBB be the second inventory that proves
 * the cross-publisher point.
 *
 * Native rarity ladder: Elite → Special → Epic → Legend → Collector.
 */

import type { Item } from '@/types';

export const MLBB_ITEMS = [
  // ── Mythic (native: Collector) ─────────────────────────────────────────
  {
    id: 'mlbb-gusion-cyber-faust',
    title: 'mlbb',
    name: 'Gusion — Cyber Faust',
    rarityTier: 'mythic',
    rarityLabel: 'Collector',
    setId: 'mlbb-set-cyber-ops',
    renderUrl: 'item-art/mlbb/gusion-cyber-faust.png',
    popularityScore: 0.024,
  },
  {
    id: 'mlbb-lancelot-royal-matador',
    title: 'mlbb',
    name: 'Lancelot — Royal Matador',
    rarityTier: 'mythic',
    rarityLabel: 'Collector',
    setId: null,
    renderUrl: 'item-art/mlbb/lancelot-royal-matador.png',
    popularityScore: 0.031,
  },
  {
    id: 'mlbb-kagura-feathery-wonderland',
    title: 'mlbb',
    name: 'Kagura — Feathery Wonderland',
    rarityTier: 'mythic',
    rarityLabel: 'Collector',
    setId: null,
    renderUrl: 'item-art/mlbb/kagura-feathery-wonderland.png',
    popularityScore: 0.028,
  },
  {
    id: 'mlbb-ling-serpent-lord',
    title: 'mlbb',
    name: 'Ling — Serpent Lord',
    rarityTier: 'mythic',
    rarityLabel: 'Collector',
    setId: null,
    renderUrl: 'item-art/mlbb/ling-serpent-lord.png',
    popularityScore: 0.019,
  },

  // ── Legendary (native: Legend) ─────────────────────────────────────────
  {
    id: 'mlbb-miya-modena-butterfly',
    title: 'mlbb',
    name: 'Miya — Modena Butterfly',
    rarityTier: 'legendary',
    rarityLabel: 'Legend',
    setId: null,
    renderUrl: 'item-art/mlbb/miya-modena-butterfly.png',
    popularityScore: 0.072,
  },
  {
    id: 'mlbb-alucard-obsidian-blade',
    title: 'mlbb',
    name: 'Alucard — Obsidian Blade',
    rarityTier: 'legendary',
    rarityLabel: 'Legend',
    setId: null,
    renderUrl: 'item-art/mlbb/alucard-obsidian-blade.png',
    popularityScore: 0.081,
  },
  {
    id: 'mlbb-gord-conqueror',
    title: 'mlbb',
    name: 'Gord — Conqueror',
    rarityTier: 'legendary',
    rarityLabel: 'Legend',
    setId: null,
    renderUrl: 'item-art/mlbb/gord-conqueror.png',
    popularityScore: 0.069,
  },
  {
    id: 'mlbb-selena-virulent-nightmare',
    title: 'mlbb',
    name: 'Selena — Virulent Nightmare',
    rarityTier: 'legendary',
    rarityLabel: 'Legend',
    setId: null,
    renderUrl: 'item-art/mlbb/selena-virulent-nightmare.png',
    popularityScore: 0.064,
  },
  {
    id: 'mlbb-gusion-cyber-ops',
    title: 'mlbb',
    name: 'Gusion — Cyber Ops',
    rarityTier: 'legendary',
    rarityLabel: 'Legend',
    setId: 'mlbb-set-cyber-ops',
    renderUrl: 'item-art/mlbb/gusion-cyber-ops.png',
    popularityScore: 0.094,
  },
  {
    id: 'mlbb-granger-starfall-knight',
    title: 'mlbb',
    name: 'Granger — Starfall Knight',
    rarityTier: 'legendary',
    rarityLabel: 'Legend',
    setId: null,
    renderUrl: 'item-art/mlbb/granger-starfall-knight.png',
    popularityScore: 0.087,
  },

  // ── Epic ───────────────────────────────────────────────────────────────
  {
    id: 'mlbb-kagura-cherry-witch',
    title: 'mlbb',
    name: 'Kagura — Cherry Witch',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: 'mlbb-set-spring-festival',
    renderUrl: 'item-art/mlbb/kagura-cherry-witch.png',
    popularityScore: 0.198,
  },
  {
    id: 'mlbb-hayabusa-shadow-vanguard',
    title: 'mlbb',
    name: 'Hayabusa — Shadow Vanguard',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: 'mlbb-set-cyber-ops',
    renderUrl: 'item-art/mlbb/hayabusa-shadow-vanguard.png',
    popularityScore: 0.214,
  },
  {
    id: 'mlbb-fanny-skylark',
    title: 'mlbb',
    name: 'Fanny — Lightborn Skylark',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: null,
    renderUrl: 'item-art/mlbb/fanny-skylark.png',
    popularityScore: 0.187,
  },
  {
    id: 'mlbb-chou-dragon-boy',
    title: 'mlbb',
    name: 'Chou — Dragon Boy',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: 'mlbb-set-spring-festival',
    renderUrl: 'item-art/mlbb/chou-dragon-boy.png',
    popularityScore: 0.231,
  },
  {
    id: 'mlbb-lesley-cyber-blossom',
    title: 'mlbb',
    name: 'Lesley — Cyber Blossom',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: 'mlbb-set-cyber-ops',
    renderUrl: 'item-art/mlbb/lesley-cyber-blossom.png',
    popularityScore: 0.245,
  },
  {
    id: 'mlbb-tigreal-lightborn-paladin',
    title: 'mlbb',
    name: 'Tigreal — Lightborn Paladin',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: null,
    renderUrl: 'item-art/mlbb/tigreal-lightborn-paladin.png',
    popularityScore: 0.272,
  },

  // ── Rare (native: Special) ─────────────────────────────────────────────
  {
    id: 'mlbb-layla-malefic-gunner',
    title: 'mlbb',
    name: 'Layla — Malefic Gunner',
    rarityTier: 'rare',
    rarityLabel: 'Special',
    setId: null,
    renderUrl: 'item-art/mlbb/layla-malefic-gunner.png',
    popularityScore: 0.418,
  },
  {
    id: 'mlbb-zilong-eastern-warrior',
    title: 'mlbb',
    name: 'Zilong — Eastern Warrior',
    rarityTier: 'rare',
    rarityLabel: 'Special',
    setId: 'mlbb-set-spring-festival',
    renderUrl: 'item-art/mlbb/zilong-eastern-warrior.png',
    popularityScore: 0.447,
  },
  {
    id: 'mlbb-akai-panda-warrior',
    title: 'mlbb',
    name: 'Akai — Panda Warrior',
    rarityTier: 'rare',
    rarityLabel: 'Special',
    setId: null,
    renderUrl: 'item-art/mlbb/akai-panda-warrior.png',
    popularityScore: 0.462,
  },

  // ── Common (native: Elite) ─────────────────────────────────────────────
  {
    id: 'mlbb-balmond-frostmoon',
    title: 'mlbb',
    name: 'Balmond — Frostmoon Dominator',
    rarityTier: 'common',
    rarityLabel: 'Elite',
    setId: null,
    renderUrl: 'item-art/mlbb/balmond-frostmoon.png',
    popularityScore: 0.688,
  },
  {
    id: 'mlbb-eudora-royal-sorcerer',
    title: 'mlbb',
    name: 'Eudora — Royal Sorcerer',
    rarityTier: 'common',
    rarityLabel: 'Elite',
    setId: null,
    renderUrl: 'item-art/mlbb/eudora-royal-sorcerer.png',
    popularityScore: 0.734,
  },
  {
    id: 'mlbb-nana-cat-fairy',
    title: 'mlbb',
    name: 'Nana — Cat Fairy',
    rarityTier: 'common',
    rarityLabel: 'Elite',
    setId: null,
    renderUrl: 'item-art/mlbb/nana-cat-fairy.png',
    popularityScore: 0.701,
  },

  // ══ Art-pack cosmetics ═══════════════════════════════════════════════════
  // Original prototype concept characters shipped with real renders in
  // `assets/collectee/subjects/` and wired through `config/artRegistry.ts`.
  //
  // These are invented heroes, NOT real MLBB ones, and that is deliberate:
  // the pack's art is original, so hanging it on a real hero (Gusion, Kagura)
  // would show a face no MLBB player recognises under a name they do. §8.1
  // warns judges spot that instantly. Inventing the hero keeps art and name
  // honest with each other.
  //
  // The pack tagged 11 of these Overwatch 2 / Dota 2 / League. Those titles are
  // not in `GameTitle` (§8.1) and adding them is a schema change nobody owns
  // alone, so they are re-mapped here. `renderUrl` keeps the catalogue-wide
  // convention; the registry is what actually resolves the bitmap.

  // ── Mythic (native: Collector) ─────────────────────────────────────────
  {
    id: 'mlbb-manifold-rift',
    title: 'mlbb',
    name: 'Aeon Null — Manifold Rift',
    rarityTier: 'mythic',
    rarityLabel: 'Collector',
    setId: null,
    renderUrl: 'item-art/mlbb/manifold-rift.png',
    popularityScore: 0.015,
  },
  {
    id: 'mlbb-emberfall-warlord',
    title: 'mlbb',
    name: 'Kaelgor — Emberfall',
    rarityTier: 'mythic',
    rarityLabel: 'Collector',
    setId: null,
    renderUrl: 'item-art/mlbb/emberfall-warlord.png',
    popularityScore: 0.017,
  },
  {
    id: 'mlbb-void-empress',
    title: 'mlbb',
    name: 'Vaelith — Void Empress',
    rarityTier: 'mythic',
    rarityLabel: 'Collector',
    setId: null,
    renderUrl: 'item-art/mlbb/void-empress.png',
    popularityScore: 0.021,
  },
  {
    id: 'mlbb-frost-sentinel',
    title: 'mlbb',
    name: 'Nivara — Winter Vault',
    rarityTier: 'mythic',
    rarityLabel: 'Collector',
    setId: null,
    renderUrl: 'item-art/mlbb/frost-sentinel.png',
    popularityScore: 0.022,
  },
  {
    id: 'mlbb-radiant-huntress',
    title: 'mlbb',
    name: 'Elyra — Radiant Huntress',
    rarityTier: 'mythic',
    rarityLabel: 'Collector',
    setId: null,
    renderUrl: 'item-art/mlbb/radiant-huntress.png',
    popularityScore: 0.026,
  },

  // ── Legendary (native: Legend) ─────────────────────────────────────────
  {
    id: 'mlbb-cyber-breacher',
    title: 'mlbb',
    name: 'Kairo — Cyber Breacher',
    rarityTier: 'legendary',
    rarityLabel: 'Legend',
    setId: 'mlbb-set-cyber-ops',
    renderUrl: 'item-art/mlbb/cyber-breacher.png',
    popularityScore: 0.058,
  },
  {
    id: 'mlbb-lightborn-defender',
    title: 'mlbb',
    name: 'Aurelian Guard — Lightborn Defender',
    rarityTier: 'legendary',
    rarityLabel: 'Legend',
    setId: null,
    renderUrl: 'item-art/mlbb/lightborn-defender.png',
    popularityScore: 0.061,
  },
  {
    id: 'mlbb-shadow-protocol',
    title: 'mlbb',
    name: 'Kade Zero — Shadow Protocol',
    rarityTier: 'legendary',
    rarityLabel: 'Legend',
    setId: 'mlbb-set-cyber-ops',
    renderUrl: 'item-art/mlbb/shadow-protocol.png',
    popularityScore: 0.074,
  },
  {
    id: 'mlbb-slipstream-pilot',
    title: 'mlbb',
    name: 'Aria Flux — Slipstream Pilot',
    rarityTier: 'legendary',
    rarityLabel: 'Legend',
    setId: null,
    renderUrl: 'item-art/mlbb/slipstream-pilot.png',
    popularityScore: 0.077,
  },
  {
    id: 'mlbb-solar-paladin',
    title: 'mlbb',
    name: 'Solenne — Helios Guard',
    rarityTier: 'legendary',
    rarityLabel: 'Legend',
    setId: null,
    renderUrl: 'item-art/mlbb/solar-paladin.png',
    popularityScore: 0.083,
  },
  {
    id: 'mlbb-voidstorm-spirit',
    title: 'mlbb',
    name: 'Zethra — Voidstorm Spirit',
    rarityTier: 'legendary',
    rarityLabel: 'Legend',
    setId: null,
    renderUrl: 'item-art/mlbb/voidstorm-spirit.png',
    popularityScore: 0.088,
  },
  {
    id: 'mlbb-arcane-revenant',
    title: 'mlbb',
    name: 'Orivane — Arcane Revenant',
    rarityTier: 'legendary',
    rarityLabel: 'Legend',
    setId: null,
    renderUrl: 'item-art/mlbb/arcane-revenant.png',
    popularityScore: 0.091,
  },

  // ── Epic ───────────────────────────────────────────────────────────────
  {
    id: 'mlbb-neon-ronin',
    title: 'mlbb',
    name: 'Ren Kage — Neon Ronin',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: 'mlbb-set-cyber-ops',
    renderUrl: 'item-art/mlbb/neon-ronin.png',
    popularityScore: 0.166,
  },
  {
    id: 'mlbb-valentine-sweetheart',
    title: 'mlbb',
    name: 'Roselle — Valentine Sweetheart',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: null,
    renderUrl: 'item-art/mlbb/valentine-sweetheart.png',
    popularityScore: 0.203,
  },
  {
    id: 'mlbb-zodiac-aquarius',
    title: 'mlbb',
    name: 'Nerissa — Zodiac Aquarius',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: null,
    renderUrl: 'item-art/mlbb/zodiac-aquarius.png',
    popularityScore: 0.221,
  },
  {
    id: 'mlbb-neon-encore',
    title: 'mlbb',
    name: 'Lyric Nova — Neon Encore',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: null,
    renderUrl: 'item-art/mlbb/neon-encore.png',
    popularityScore: 0.238,
  },
] as const satisfies readonly Item[];
