/**
 * Seeded collections and the rooms built from them.
 *
 * §15 risk: like counts in the thousands, item counts in the hundreds. Nothing
 * here should read as inflated.
 */

import type { Collection, Post, Room } from '@/types';
import { ROOM_THEMES } from './room-themes';

export const COLLECTIONS = [
  {
    id: 'col-jovan-crown-jewels',
    userId: 'user-jovan',
    name: 'Crown Jewels',
    description: 'The three things I would not trade. One from each game.',
    coverUrl: 'covers/crown-jewels.png',
    themeTags: ['cross-game', 'mythic'],
    itemIds: [
      'codm-dlq33-lightbringer',
      'val-elderflame-vandal',
      'mlbb-gusion-cyber-faust',
      'codm-fennec-ascended',
      'val-prime-karambit',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 2841,
    createdAt: '2026-06-20T14:12:00.000Z',
  },
  {
    id: 'col-jovan-hellhound',
    userId: 'user-jovan',
    name: 'Hellhound Run',
    description: 'Chasing the full Hellhound set. Two to go.',
    coverUrl: 'covers/hellhound.png',
    themeTags: ['codm', 'set-completion'],
    itemIds: ['codm-drh-cerberus', 'codm-qq9-diavolo', 'codm-ghost-nightfall'],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 934,
    createdAt: '2026-07-02T09:44:00.000Z',
  },
  {
    id: 'col-jovan-drafts',
    userId: 'user-jovan',
    name: 'Valorant Knives',
    description: 'Work in progress.',
    coverUrl: 'covers/val-knives.png',
    themeTags: ['valorant'],
    itemIds: ['val-prime-karambit'],
    visibility: 'private',
    allowComments: false,
    showOnProfile: false,
    likeCount: 0,
    createdAt: '2026-07-28T21:03:00.000Z',
  },
  {
    id: 'col-rei-mythic-only',
    userId: 'user-rei',
    name: 'Mythic Only',
    description: 'If it is not Mythic it does not go on the shelf.',
    coverUrl: 'covers/mythic-only.png',
    themeTags: ['mythic', 'cross-game'],
    itemIds: [
      'codm-dlq33-lightbringer',
      'codm-fennec-ascended',
      'codm-ak117-cordite-storm',
      'mlbb-gusion-cyber-faust',
      'mlbb-ling-serpent-lord',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 5127,
    createdAt: '2026-05-11T16:30:00.000Z',
  },
  {
    id: 'col-mei-elderflame',
    userId: 'user-mei',
    name: 'The Dragon Set',
    description: 'Full Elderflame. Took two years.',
    coverUrl: 'covers/elderflame.png',
    themeTags: ['valorant', 'set-completion'],
    itemIds: ['val-elderflame-vandal', 'val-elderflame-operator', 'val-elderflame-dagger'],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 7402,
    createdAt: '2026-03-30T11:15:00.000Z',
  },
  {
    id: 'col-danish-collector',
    userId: 'user-danish',
    name: 'Land of Dawn Collectors',
    description: 'Every Collector skin I own, oldest first.',
    coverUrl: 'covers/land-of-dawn.png',
    themeTags: ['mlbb', 'collector'],
    itemIds: [
      'mlbb-gusion-cyber-faust',
      'mlbb-lancelot-royal-matador',
      'mlbb-kagura-feathery-wonderland',
      'mlbb-ling-serpent-lord',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 3288,
    createdAt: '2026-04-18T13:50:00.000Z',
  },
  {
    id: 'col-syafiq-blueprints',
    userId: 'user-syafiq',
    name: 'Blueprint Vault',
    description: 'Season 1 to now. CODM only.',
    coverUrl: 'covers/blueprint-vault.png',
    themeTags: ['codm'],
    itemIds: [
      'codm-drh-cerberus',
      'codm-qq9-diavolo',
      'codm-ghost-nightfall',
      'codm-m4-arctic-hunter',
      'codm-alias-frostbite',
      'codm-rus79u-molten',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 1615,
    createdAt: '2026-05-25T08:22:00.000Z',
  },
  {
    id: 'col-arya-cross-game',
    userId: 'user-arya',
    name: 'One Shelf, Three Games',
    description: 'The whole point of this app, in one collection.',
    coverUrl: 'covers/one-shelf.png',
    themeTags: ['cross-game'],
    itemIds: [
      'codm-fennec-ascended',
      'val-elderflame-vandal',
      'mlbb-gusion-cyber-ops',
      'val-reaver-vandal',
      'codm-hbra3-tidal',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 4056,
    createdAt: '2026-06-07T19:05:00.000Z',
  },
] as const satisfies readonly Collection[];

export const COLLECTIONS_BY_ID: ReadonlyMap<string, Collection> = new Map(
  COLLECTIONS.map((c) => [c.id, c]),
);

/**
 * Seeded rooms. `slots` are copied from the theme at creation time so a later
 * theme edit cannot silently invalidate an existing room's placements.
 */
const weaponVault = ROOM_THEMES[0];
const fantasyArmoury = ROOM_THEMES[2];
const collectorsStudy = ROOM_THEMES[5];

export const ROOMS = [
  {
    id: 'room-jovan-crown-jewels',
    collectionId: 'col-jovan-crown-jewels',
    themeId: weaponVault.id,
    // The room is its own object: "Crown Jewels" the collection becomes
    // "The Vault" the room, with its own title, description and cover.
    title: 'The Vault',
    description: 'Five items I would not trade, one wall each. Built from Crown Jewels.',
    coverUrl: 'room-covers/jovan-the-vault.png',
    backdropUrl: weaponVault.backdropUrl,
    slots: [...weaponVault.slots],
    placements: [
      { slotId: 'vault-pedestal-hero', ownedItemId: 'own-jovan-codm-dlq33-lightbringer', rotation: 0 },
      { slotId: 'vault-pedestal-left', ownedItemId: 'own-jovan-val-elderflame-vandal', rotation: 0 },
      { slotId: 'vault-pedestal-right', ownedItemId: 'own-jovan-mlbb-gusion-cyber-faust', rotation: 0 },
      { slotId: 'vault-wall-1', ownedItemId: 'own-jovan-codm-fennec-ascended', rotation: 0 },
      { slotId: 'vault-wall-2', ownedItemId: 'own-jovan-val-prime-karambit', rotation: 0 },
    ],
    settings: {
      parallaxEnabled: true,
      focusedSlotId: 'vault-pedestal-hero',
      lightingPreset: 'cool-blue',
      brightness: 0.68,
      animatedLighting: true,
      displayStyle: 'hologram',
    },
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    publishedAt: '2026-06-21T10:00:00.000Z',
    createdAt: '2026-06-20T15:40:00.000Z',
  },
  {
    id: 'room-mei-elderflame',
    collectionId: 'col-mei-elderflame',
    themeId: fantasyArmoury.id,
    title: 'Elderflame Hall',
    description: 'The full Elderflame set under torchlight.',
    coverUrl: 'room-covers/mei-elderflame-hall.png',
    backdropUrl: fantasyArmoury.backdropUrl,
    slots: [...fantasyArmoury.slots],
    placements: [
      { slotId: 'armoury-pedestal-hero', ownedItemId: 'own-mei-val-elderflame-vandal', rotation: 0 },
      { slotId: 'armoury-case-left', ownedItemId: 'own-mei-val-elderflame-operator', rotation: 0 },
      { slotId: 'armoury-case-right', ownedItemId: 'own-mei-val-elderflame-dagger', rotation: 0 },
    ],
    settings: {
      parallaxEnabled: true,
      focusedSlotId: null,
      lightingPreset: 'warm-gold',
      brightness: 0.6,
      animatedLighting: false,
      displayStyle: 'framed',
    },
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    publishedAt: '2026-04-01T09:30:00.000Z',
    createdAt: '2026-03-30T12:00:00.000Z',
  },
  {
    id: 'room-danish-collectors',
    collectionId: 'col-danish-collector',
    themeId: collectorsStudy.id,
    title: "The Collector's Table",
    description: 'Four MLBB pieces I chased for two years.',
    coverUrl: 'room-covers/danish-collectors-table.png',
    backdropUrl: collectorsStudy.backdropUrl,
    slots: [...collectorsStudy.slots],
    placements: [
      { slotId: 'study-pedestal-hero', ownedItemId: 'own-danish-mlbb-ling-serpent-lord', rotation: 0 },
      { slotId: 'study-case-left', ownedItemId: 'own-danish-mlbb-gusion-cyber-faust', rotation: 0 },
      { slotId: 'study-case-right', ownedItemId: 'own-danish-mlbb-lancelot-royal-matador', rotation: 0 },
      { slotId: 'study-wall-1', ownedItemId: 'own-danish-mlbb-kagura-feathery-wonderland', rotation: 0 },
    ],
    settings: {
      parallaxEnabled: true,
      focusedSlotId: null,
      lightingPreset: 'dark-cinematic',
      brightness: 0.52,
      animatedLighting: false,
      displayStyle: 'card',
    },
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    publishedAt: '2026-04-19T08:00:00.000Z',
    createdAt: '2026-04-18T14:20:00.000Z',
  },
] as const satisfies readonly Room[];

export const ROOMS_BY_ID: ReadonlyMap<string, Room> = new Map(ROOMS.map((r) => [r.id, r]));

/**
 * §11 F5 — the Home feed is SEEDED AND STATIC for the demo. There is no ranking
 * algorithm. Say "ranked by recency and match score" only if asked; do not
 * claim a live feed.
 */
export const POSTS = [
  {
    id: 'post-1',
    userId: 'user-mei',
    type: 'room',
    targetId: 'room-mei-elderflame',
    caption: 'Finally finished the armoury. Two years for this shelf.',
    createdAt: '2026-07-30T12:15:00.000Z',
  },
  {
    id: 'post-2',
    userId: 'user-rei',
    type: 'collection',
    targetId: 'col-rei-mythic-only',
    caption: 'Added the Cordite Storm. Mythic only, still.',
    createdAt: '2026-07-29T18:40:00.000Z',
  },
  {
    id: 'post-3',
    userId: 'user-arya',
    type: 'collection',
    targetId: 'col-arya-cross-game',
    caption: 'Three games on one shelf. This is the whole idea.',
    createdAt: '2026-07-28T09:05:00.000Z',
  },
  {
    id: 'post-4',
    userId: 'user-danish',
    type: 'room',
    targetId: 'room-danish-collectors',
    caption: 'Redid the study. Collector skins deserve the good lighting.',
    createdAt: '2026-07-26T20:22:00.000Z',
  },
] as const satisfies readonly Post[];
