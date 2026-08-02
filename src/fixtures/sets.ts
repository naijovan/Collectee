/**
 * Item sets — PRD §12.3 `ItemSet`.
 *
 * `totalCount` is the FULL in-game set size and may exceed `itemIds.length`,
 * because our catalogues are deliberately partial (§16 suggests ~60 items per
 * title, not exhaustive). That gap is what makes set-completion progress
 * meaningful for the Completionist persona (§4) — you can own 3 of 7.
 */

import type { ItemSet } from '@/types';

export const ITEM_SETS = [
  // ── CODM ───────────────────────────────────────────────────────────────
  {
    id: 'codm-set-lightbringer',
    title: 'codm',
    name: 'Lightbringer',
    itemIds: ['codm-dlq33-lightbringer'],
    totalCount: 4,
  },
  {
    id: 'codm-set-hellhound',
    title: 'codm',
    name: 'Hellhound',
    itemIds: ['codm-drh-cerberus', 'codm-qq9-diavolo', 'codm-ghost-nightfall'],
    totalCount: 5,
  },
  {
    id: 'codm-set-permafrost',
    title: 'codm',
    name: 'Permafrost',
    itemIds: ['codm-kilo141-glacier', 'codm-m4-arctic-hunter', 'codm-alias-frostbite'],
    totalCount: 6,
  },
  {
    id: 'codm-set-deep-current',
    title: 'codm',
    name: 'Deep Current',
    itemIds: [
      'codm-hbra3-tidal',
      'codm-pdw57-abyss',
      'codm-mac10-riptide',
      'codm-price-monsoon',
    ],
    totalCount: 6,
  },
  {
    id: 'codm-set-field-kit',
    title: 'codm',
    name: 'Field Kit',
    itemIds: [
      'codm-camo-urban-splinter',
      'codm-camo-desert-strata',
      'codm-asm10-sandstorm',
    ],
    totalCount: 8,
  },

  // ── Valorant ───────────────────────────────────────────────────────────
  {
    id: 'val-set-elderflame',
    title: 'valorant',
    name: 'Elderflame',
    itemIds: ['val-elderflame-vandal', 'val-elderflame-operator', 'val-elderflame-dagger'],
    totalCount: 5,
  },
  {
    id: 'val-set-singularity',
    title: 'valorant',
    name: 'Singularity',
    itemIds: ['val-singularity-phantom', 'val-singularity-knife'],
    totalCount: 5,
  },
  {
    id: 'val-set-spectrum',
    title: 'valorant',
    name: 'Spectrum',
    itemIds: ['val-spectrum-phantom', 'val-spectrum-waveform'],
    totalCount: 5,
  },
  {
    id: 'val-set-prime',
    title: 'valorant',
    name: 'Prime',
    itemIds: ['val-prime-vandal', 'val-prime-karambit', 'val-prime-spectre'],
    totalCount: 5,
  },
  {
    id: 'val-set-reaver',
    title: 'valorant',
    name: 'Reaver',
    itemIds: ['val-reaver-vandal', 'val-reaver-sheriff', 'val-reaver-knife'],
    totalCount: 5,
  },
  {
    id: 'val-set-origin',
    title: 'valorant',
    name: 'Origin',
    itemIds: ['val-origin-vandal', 'val-origin-phantom'],
    totalCount: 5,
  },

  // ── MLBB ───────────────────────────────────────────────────────────────
  {
    id: 'mlbb-set-cyber-ops',
    title: 'mlbb',
    name: 'Cyber Ops',
    itemIds: [
      'mlbb-gusion-cyber-faust',
      'mlbb-gusion-cyber-ops',
      'mlbb-hayabusa-shadow-vanguard',
      'mlbb-lesley-cyber-blossom',
    ],
    totalCount: 6,
  },
  {
    id: 'mlbb-set-spring-festival',
    title: 'mlbb',
    name: 'Spring Festival',
    itemIds: [
      'mlbb-kagura-cherry-witch',
      'mlbb-chou-dragon-boy',
      'mlbb-zilong-eastern-warrior',
    ],
    totalCount: 7,
  },
] as const satisfies readonly ItemSet[];
