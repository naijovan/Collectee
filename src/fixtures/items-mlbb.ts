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
] as const satisfies readonly Item[];
