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
    // The two art-pack blades sit here as well as in Neon Legends — the one
    // place the seeded data demonstrates §11 F3's "an item can belong to more
    // than one collection", which the Select-items screen claims in copy.
    itemIds: ['val-prime-karambit', 'val-riftblade-katana', 'val-voidglass-blade'],
    visibility: 'private',
    allowComments: false,
    showOnProfile: false,
    likeCount: 0,
    createdAt: '2026-07-28T21:03:00.000Z',
  },
  {
    /**
     * Membership is the art pack's own `collectionCompositions['neon-legends']`,
     * re-mapped onto our item ids. It exists so a real cover mosaic is on screen
     * from a cold start: every other seeded collection predates the pack and
     * holds items with no render, so their covers still fall back to a block.
     */
    id: 'col-jovan-neon-legends',
    userId: 'user-jovan',
    name: 'Neon Legends',
    description: 'Everything that glows. Two games, one palette.',
    coverUrl: 'covers/neon-legends.png',
    themeTags: ['cross-game', 'collector'],
    itemIds: [
      'mlbb-neon-ronin',
      'mlbb-cyber-breacher',
      'mlbb-neon-encore',
      'mlbb-shadow-protocol',
      'val-riftblade-katana',
      'val-voidglass-blade',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 412,
    createdAt: '2026-07-30T18:26:00.000Z',
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

/**
 * Seeded rooms — deliberately empty.
 *
 * Rooms are the flow the demo walks through (§14: "never cut import → review →
 * collection → room → share"), so shipping pre-built ones means the most
 * important surface is something the audience watches rather than something
 * they see built. Every collection instead carries an AI-suggested room concept
 * (`domain/roomSuggestion.ts`) waiting to be generated.
 *
 * Rooms created at runtime live in `roomService`'s in-memory store, which is
 * what the build flow writes to.
 */
// Explicitly typed rather than `as const satisfies` — an empty literal narrows
// to never[], and every `.map(r => r.id)` downstream stops compiling.
export const ROOMS: readonly Room[] = [];

export const ROOMS_BY_ID: ReadonlyMap<string, Room> = new Map(ROOMS.map((r) => [r.id, r]));

/**
 * §11 F5 — the Home feed is SEEDED AND STATIC for the demo. There is no ranking
 * algorithm. Say "ranked by recency and match score" only if asked; do not
 * claim a live feed.
 */
export const POSTS = [
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
] as const satisfies readonly Post[];
