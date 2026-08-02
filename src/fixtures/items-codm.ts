/**
 * Call of Duty: Mobile (Garena SEA) item catalogue — the HERO title (PRD §8.1).
 *
 * ⚠️ VERIFY BEFORE THE DEMO (PRD §16 open question 1 + §12.2).
 * These entries follow real CODM naming patterns — weapon blueprints, operator
 * skins, camos and charms — but a player of this title must sanity-check the
 * names and rarity placements. §15 lists "seeded data looks fake" as a risk and
 * a Garena panel will spot a wrong blueprint name instantly.
 *
 * Use the GARENA SEA version specifically — not console or PC Call of Duty.
 * It is a different client with a different cosmetics system.
 *
 * `renderUrl` uses the bundled-asset convention `item-art/<title>/<id>.png`.
 * Art is not in the repo yet; see docs/CONTRIBUTING.md.
 */

import type { Item } from '@/types';

export const CODM_ITEMS = [
  // ── Mythic ─────────────────────────────────────────────────────────────
  {
    id: 'codm-dlq33-lightbringer',
    title: 'codm',
    name: 'DL Q33 — Lightbringer',
    rarityTier: 'mythic',
    rarityLabel: 'Mythic',
    setId: 'codm-set-lightbringer',
    renderUrl: 'item-art/codm/dlq33-lightbringer.png',
    popularityScore: 0.014,
  },
  {
    id: 'codm-fennec-ascended',
    title: 'codm',
    name: 'Fennec — Ascended',
    rarityTier: 'mythic',
    rarityLabel: 'Mythic',
    setId: null,
    renderUrl: 'item-art/codm/fennec-ascended.png',
    popularityScore: 0.021,
  },
  {
    id: 'codm-ak117-cordite-storm',
    title: 'codm',
    name: 'AK117 — Cordite Storm',
    rarityTier: 'mythic',
    rarityLabel: 'Mythic',
    setId: null,
    renderUrl: 'item-art/codm/ak117-cordite-storm.png',
    popularityScore: 0.018,
  },

  // ── Legendary ──────────────────────────────────────────────────────────
  {
    id: 'codm-drh-cerberus',
    title: 'codm',
    name: 'DR-H — Cerberus',
    rarityTier: 'legendary',
    rarityLabel: 'Legendary',
    setId: 'codm-set-hellhound',
    renderUrl: 'item-art/codm/drh-cerberus.png',
    popularityScore: 0.061,
  },
  {
    id: 'codm-qq9-diavolo',
    title: 'codm',
    name: 'QQ9 — Diavolo',
    rarityTier: 'legendary',
    rarityLabel: 'Legendary',
    setId: 'codm-set-hellhound',
    renderUrl: 'item-art/codm/qq9-diavolo.png',
    popularityScore: 0.074,
  },
  {
    id: 'codm-ghost-nightfall',
    title: 'codm',
    name: 'Ghost — Nightfall',
    rarityTier: 'legendary',
    rarityLabel: 'Legendary',
    setId: 'codm-set-hellhound',
    renderUrl: 'item-art/codm/ghost-nightfall.png',
    popularityScore: 0.052,
  },
  {
    id: 'codm-kilo141-glacier',
    title: 'codm',
    name: 'KILO 141 — Glacier',
    rarityTier: 'legendary',
    rarityLabel: 'Legendary',
    setId: 'codm-set-permafrost',
    renderUrl: 'item-art/codm/kilo141-glacier.png',
    popularityScore: 0.088,
  },
  {
    id: 'codm-m4-arctic-hunter',
    title: 'codm',
    name: 'M4 — Arctic Hunter',
    rarityTier: 'legendary',
    rarityLabel: 'Legendary',
    setId: 'codm-set-permafrost',
    renderUrl: 'item-art/codm/m4-arctic-hunter.png',
    popularityScore: 0.096,
  },
  {
    id: 'codm-alias-frostbite',
    title: 'codm',
    name: 'Alias — Frostbite',
    rarityTier: 'legendary',
    rarityLabel: 'Legendary',
    setId: 'codm-set-permafrost',
    renderUrl: 'item-art/codm/alias-frostbite.png',
    popularityScore: 0.103,
  },
  {
    id: 'codm-rus79u-molten',
    title: 'codm',
    name: 'RUS-79U — Molten Core',
    rarityTier: 'legendary',
    rarityLabel: 'Legendary',
    setId: null,
    renderUrl: 'item-art/codm/rus79u-molten.png',
    popularityScore: 0.117,
  },

  // ── Epic ───────────────────────────────────────────────────────────────
  {
    id: 'codm-hbra3-tidal',
    title: 'codm',
    name: 'HBRa3 — Tidal Wave',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: 'codm-set-deep-current',
    renderUrl: 'item-art/codm/hbra3-tidal.png',
    popularityScore: 0.184,
  },
  {
    id: 'codm-pdw57-abyss',
    title: 'codm',
    name: 'PDW-57 — Abyssal',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: 'codm-set-deep-current',
    renderUrl: 'item-art/codm/pdw57-abyss.png',
    popularityScore: 0.201,
  },
  {
    id: 'codm-mac10-riptide',
    title: 'codm',
    name: 'MAC-10 — Riptide',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: 'codm-set-deep-current',
    renderUrl: 'item-art/codm/mac10-riptide.png',
    popularityScore: 0.223,
  },
  {
    id: 'codm-price-monsoon',
    title: 'codm',
    name: 'Price — Monsoon',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: 'codm-set-deep-current',
    renderUrl: 'item-art/codm/price-monsoon.png',
    popularityScore: 0.176,
  },
  {
    id: 'codm-locus-ironclad',
    title: 'codm',
    name: 'Locus — Ironclad',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: null,
    renderUrl: 'item-art/codm/locus-ironclad.png',
    popularityScore: 0.244,
  },
  {
    id: 'codm-charm-golden-skull',
    title: 'codm',
    name: 'Charm — Golden Skull',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: null,
    renderUrl: 'item-art/codm/charm-golden-skull.png',
    popularityScore: 0.268,
  },
  {
    id: 'codm-mansk-blackout',
    title: 'codm',
    name: 'Mace — Blackout',
    rarityTier: 'epic',
    rarityLabel: 'Epic',
    setId: null,
    renderUrl: 'item-art/codm/mace-blackout.png',
    popularityScore: 0.259,
  },

  // ── Rare ───────────────────────────────────────────────────────────────
  {
    id: 'codm-camo-urban-splinter',
    title: 'codm',
    name: 'Camo — Urban Splinter',
    rarityTier: 'rare',
    rarityLabel: 'Rare',
    setId: 'codm-set-field-kit',
    renderUrl: 'item-art/codm/camo-urban-splinter.png',
    popularityScore: 0.412,
  },
  {
    id: 'codm-camo-desert-strata',
    title: 'codm',
    name: 'Camo — Desert Strata',
    rarityTier: 'rare',
    rarityLabel: 'Rare',
    setId: 'codm-set-field-kit',
    renderUrl: 'item-art/codm/camo-desert-strata.png',
    popularityScore: 0.437,
  },
  {
    id: 'codm-asm10-sandstorm',
    title: 'codm',
    name: 'ASM10 — Sandstorm',
    rarityTier: 'rare',
    rarityLabel: 'Rare',
    setId: 'codm-set-field-kit',
    renderUrl: 'item-art/codm/asm10-sandstorm.png',
    popularityScore: 0.389,
  },
  {
    id: 'codm-charm-dog-tag',
    title: 'codm',
    name: 'Charm — Dog Tag',
    rarityTier: 'rare',
    rarityLabel: 'Rare',
    setId: null,
    renderUrl: 'item-art/codm/charm-dog-tag.png',
    popularityScore: 0.463,
  },

  // ── Common ─────────────────────────────────────────────────────────────
  {
    id: 'codm-camo-olive-standard',
    title: 'codm',
    name: 'Camo — Olive Standard',
    rarityTier: 'common',
    rarityLabel: 'Common',
    setId: null,
    renderUrl: 'item-art/codm/camo-olive-standard.png',
    popularityScore: 0.712,
  },
  {
    id: 'codm-soap-recruit',
    title: 'codm',
    name: 'Soap — Recruit',
    rarityTier: 'common',
    rarityLabel: 'Common',
    setId: null,
    renderUrl: 'item-art/codm/soap-recruit.png',
    popularityScore: 0.784,
  },
  {
    id: 'codm-charm-brass-shell',
    title: 'codm',
    name: 'Charm — Brass Shell',
    rarityTier: 'common',
    rarityLabel: 'Common',
    setId: null,
    renderUrl: 'item-art/codm/charm-brass-shell.png',
    popularityScore: 0.669,
  },
] as const satisfies readonly Item[];
