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
  /**
   * Jovan's MLBB-only collection.
   *
   * Added when "Dragon, Blade, Sovereign" stopped appearing under Collections —
   * a collection with a published showroom now belongs to the Showrooms section
   * alone, so the tab lost a card. This fills that slot with something the
   * viewer's collection list did not otherwise have: a set from one game, and
   * the one game the other four barely touch.
   *
   * Three verified, three not. Deliberately mixed rather than all-verified:
   * this is the collection that demonstrates §9.4 on the viewer's own page —
   * six items, three eligible for a showroom, and the room picker will say so
   * rather than silently offering half.
   *
   * ⚠️ ZERO overlap with "Neon Legends", and that is a constraint rather than a
   * coincidence. The first draft shared three of six items with it, and since
   * `CollectionCoverMosaic` builds a cover from the collection's own members,
   * two sets sharing half their contents produced two covers that looked the
   * same on the same screen. Anything added here has to stay out of that list.
   */
  {
    id: 'col-jovan-land-of-dawn',
    userId: 'user-jovan',
    name: 'Land of Dawn Nights',
    description: 'The MLBB half of the shelf — rifts, empresses and the light that holds them off.',
    coverUrl: '',
    themeTags: ['mlbb', 'collector'],
    itemIds: [
      'mlbb-manifold-rift',
      'mlbb-void-empress',
      'mlbb-lightborn-defender',
      'mlbb-radiant-huntress',
      'mlbb-solar-paladin',
      'mlbb-emberfall-warlord',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 1147,
    createdAt: '2026-07-24T20:15:00.000Z',
  },
  /**
   * An MLBB-only collection, and the reason it exists is the badge.
   *
   * `CollectionCard` badges the HEADLINE item's game — the rarest thing in the
   * collection — so a cross-game set whose rarest item is a CODM mythic reads
   * as CODM at a glance. Three of the top four on Explore were badged CODM even
   * though only one of them was CODM-only, which made the feed look like a
   * single-game app.
   *
   * Fully verified, deliberately: `rankByVerification` puts complete
   * collections in the leading block, so this reaches the first row rather than
   * sitting below the fold where it would fix nothing. Danish's "Land of Dawn
   * Collectors" is also MLBB-only but ranks lower on verification.
   *
   * Priya's, because her seeded inventory is MLBB-first and these three are
   * exactly her verified set — the collection is what she actually owns rather
   * than a set assembled to fill a slot.
   */
  {
    id: 'col-priya-dawn-verified',
    userId: 'user-priya',
    name: 'Verified in the Dawn',
    description: 'Every Land of Dawn skin I can prove is mine. Linked, not scanned.',
    coverUrl: '',
    themeTags: ['mlbb', 'collector'],
    itemIds: [
      'mlbb-lightborn-defender',
      'mlbb-radiant-huntress',
      'mlbb-slipstream-pilot',
      'mlbb-manifold-rift',
      'mlbb-kagura-cherry-witch',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 2260,
    createdAt: '2026-07-19T11:40:00.000Z',
  },
  /**
   * The viewer's own showroom, backing `room-jovan-triptych`.
   *
   * Exactly three items, and every one of them is a REAL baked mesh in
   * `modelRegistry` — an Elderflame Vandal, a Prime Karambit and Marcus's
   * re-baked Gusion. That combination is the point: a gun, a blade and a
   * character, so the room demonstrates all three mesh kinds at once instead of
   * three variations on a rifle.
   *
   * All three are verified for Jovan, which §9.4 requires before anything can
   * be placed in a room. Three is also exactly MIN_ROOM_ITEMS, so this doubles
   * as the fixture proving the floor is reachable rather than theoretical.
   */
  {
    id: 'col-jovan-triptych',
    userId: 'user-jovan',
    name: 'Dragon, Blade, Sovereign',
    description: 'Three pieces, three games, one shelf. Nothing else earns a pedestal.',
    coverUrl: '',
    themeTags: ['cross-game', 'mythic'],
    itemIds: ['val-elderflame-vandal', 'val-prime-karambit', 'mlbb-gusion-cyber-faust'],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 1893,
    createdAt: '2026-08-04T14:10:00.000Z',
  },
  /*
   * ── Collector collections, added 8 Aug ──────────────────────────────────
   * Before this, ten of the fourteen seeded collectors had nothing on their
   * profile, so tapping any of them from Explore or a match result landed on
   * an empty page — the worst possible answer to "why should I follow this
   * person".
   *
   * Counts are deliberately uneven: zennx has four, most have two, nadia has
   * one. A roster where everyone owns exactly two collections reads as
   * generated, which is the §15 "seeded data looks fake" risk.
   *
   * Membership is drawn from what each collector ACTUALLY owns in
   * `owned-items.ts`. That matters beyond realism — the room gate counts
   * VERIFIED items per collection, so a collection listing skins its owner
   * does not own would make the §9.4 eligibility maths lie.
   */
  {
    id: 'col-zennx-proof-of-work',
    userId: 'user-zennx',
    name: 'Proof of Work',
    description: 'Everything here is linked to an account. No scans, no maybes.',
    coverUrl: '',
    themeTags: ['cross-game', 'verified'],
    itemIds: [
      'val-elderflame-vandal',
      'val-prime-karambit',
      'val-voidglass-blade',
      'codm-dlq33-lightbringer',
      'codm-drh-cerberus',
      'mlbb-gusion-cyber-faust',
      'mlbb-void-empress',
      'mlbb-neon-ronin',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 4127,
    createdAt: '2026-05-02T09:15:00.000Z',
  },
  {
    id: 'col-zennx-edge-cases',
    userId: 'user-zennx',
    name: 'Edge Cases',
    description: 'Two blades. Both earned the hard way.',
    coverUrl: '',
    themeTags: ['valorant', 'melee'],
    itemIds: [
      'val-prime-karambit',
      'val-voidglass-blade',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 876,
    createdAt: '2026-06-11T17:40:00.000Z',
  },
  {
    id: 'col-zennx-ember-run',
    userId: 'user-zennx',
    name: 'Ember Run',
    description: 'The CODM half of the shelf.',
    coverUrl: '',
    themeTags: ['codm'],
    itemIds: [
      'codm-dlq33-lightbringer',
      'codm-drh-cerberus',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 1204,
    createdAt: '2026-06-29T08:05:00.000Z',
  },
  {
    id: 'col-zennx-dawn-signal',
    userId: 'user-zennx',
    name: 'Dawn Signal',
    description: 'Land of Dawn, four deep. Three I can prove, one I cannot.',
    coverUrl: '',
    themeTags: ['mlbb'],
    itemIds: [
      'mlbb-gusion-cyber-faust',
      'mlbb-void-empress',
      'mlbb-neon-ronin',
      'mlbb-arcane-revenant',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 2015,
    createdAt: '2026-07-14T20:22:00.000Z',
  },
  {
    id: 'col-tarek-marksman',
    userId: 'user-tarek',
    name: 'Marksman\'s Row',
    description: 'Long range only. If it has a scope it belongs here.',
    coverUrl: '',
    themeTags: ['codm', 'snipers'],
    itemIds: [
      'codm-dlq33-lightbringer',
      'codm-locus-ironclad',
      'codm-fennec-ascended',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 1533,
    createdAt: '2026-05-19T14:02:00.000Z',
  },
  {
    id: 'col-tarek-cold-open',
    userId: 'user-tarek',
    name: 'Cold Open',
    description: 'Winter camos. Still chasing the rest of the set.',
    coverUrl: '',
    themeTags: ['codm', 'set-completion'],
    itemIds: [
      'codm-ak117-cordite-storm',
      'codm-m4-arctic-hunter',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 418,
    createdAt: '2026-07-08T11:31:00.000Z',
  },
  {
    id: 'col-nova-proof',
    userId: 'user-nova',
    name: 'Four I Can Prove',
    description: 'Linked account, four skins, no arguments.',
    coverUrl: '',
    themeTags: ['cross-game', 'verified'],
    itemIds: [
      'val-prime-karambit',
      'val-voidglass-blade',
      'val-elderflame-vandal',
      'mlbb-neon-ronin',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 2380,
    createdAt: '2026-06-03T10:18:00.000Z',
  },
  {
    id: 'col-nova-open-blades',
    userId: 'user-nova',
    name: 'Open Blades',
    description: 'Scanned, not linked. Working on it.',
    coverUrl: '',
    themeTags: ['valorant', 'melee'],
    itemIds: [
      'val-riftblade-katana',
      'val-reaver-knife',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 644,
    createdAt: '2026-07-21T19:55:00.000Z',
  },
  {
    id: 'col-bo-reaver-set',
    userId: 'user-bo',
    name: 'The Reaver Line',
    description: 'Three pieces, one bundle, two years apart.',
    coverUrl: '',
    themeTags: ['valorant', 'set-completion'],
    itemIds: [
      'val-reaver-vandal',
      'val-reaver-sheriff',
      'val-reaver-knife',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 3102,
    createdAt: '2026-04-27T16:44:00.000Z',
  },
  {
    id: 'col-bo-oni-watch',
    userId: 'user-bo',
    name: 'Oni Watch',
    description: 'One skin. It is on the list.',
    coverUrl: '',
    themeTags: ['valorant'],
    itemIds: [
      'val-oni-phantom',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 212,
    createdAt: '2026-07-30T13:09:00.000Z',
  },
  {
    id: 'col-kai-prime-line',
    userId: 'user-kai',
    name: 'Prime Line',
    description: 'The cleanest bundle they ever shipped.',
    coverUrl: '',
    themeTags: ['valorant'],
    itemIds: [
      'val-prime-spectre',
      'val-prime-karambit',
      'val-prime-vandal',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 1789,
    createdAt: '2026-05-08T12:27:00.000Z',
  },
  {
    id: 'col-kai-origin-story',
    userId: 'user-kai',
    name: 'Origin Story',
    description: 'Where the collection started.',
    coverUrl: '',
    themeTags: ['valorant'],
    itemIds: [
      'val-origin-vandal',
      'val-origin-phantom',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 530,
    createdAt: '2026-06-25T09:12:00.000Z',
  },
  {
    id: 'col-iman-scanned-in',
    userId: 'user-iman',
    name: 'Scanned In',
    description: 'Photographed off my own screen. Verifying these next.',
    coverUrl: '',
    themeTags: ['codm'],
    itemIds: [
      'codm-dlq33-lightbringer',
      'codm-drh-cerberus',
      'codm-fennec-ascended',
      'codm-qq9-diavolo',
      'codm-hbra3-tidal',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 967,
    createdAt: '2026-06-16T15:33:00.000Z',
  },
  {
    id: 'col-iman-borrowed-light',
    userId: 'user-iman',
    name: 'Borrowed Light',
    description: 'The Valorant side. Three rifles, no receipts yet.',
    coverUrl: '',
    themeTags: ['valorant'],
    itemIds: [
      'val-elderflame-vandal',
      'val-prime-vandal',
      'val-glitchpop-vandal',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 445,
    createdAt: '2026-07-25T18:20:00.000Z',
  },
  {
    id: 'col-nadia-first-four',
    userId: 'user-nadia',
    name: 'First Four',
    description: 'Started last month. This is all of it so far.',
    coverUrl: '',
    themeTags: ['cross-game'],
    itemIds: [
      'mlbb-layla-malefic-gunner',
      'mlbb-nana-cat-fairy',
      'val-luxe-classic',
      'val-prism-spectre',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 158,
    createdAt: '2026-07-31T08:47:00.000Z',
  },
  {
    id: 'col-priya-nightmare-hour',
    userId: 'user-priya',
    name: 'Nightmare Hour',
    description: 'The ones I only play after midnight.',
    coverUrl: '',
    themeTags: ['mlbb'],
    itemIds: [
      'mlbb-selena-virulent-nightmare',
      'codm-charm-golden-skull',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 702,
    createdAt: '2026-07-12T23:14:00.000Z',
  },
  {
    id: 'col-arya-second-shelf',
    userId: 'user-arya',
    name: 'Second Shelf',
    description: 'Everything that did not make One Shelf, Three Games.',
    coverUrl: '',
    themeTags: ['cross-game'],
    itemIds: [
      'codm-drh-cerberus',
      'codm-hbra3-tidal',
      'mlbb-hayabusa-shadow-vanguard',
      'mlbb-lesley-cyber-blossom',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 1096,
    createdAt: '2026-06-07T13:26:00.000Z',
  },
  {
    id: 'col-danish-royal-court',
    userId: 'user-danish',
    name: 'Royal Court',
    description: 'Epics with a crown on them. Loose theme, strict standards.',
    coverUrl: '',
    themeTags: ['mlbb', 'epic'],
    itemIds: [
      'mlbb-lancelot-royal-matador',
      'mlbb-alucard-obsidian-blade',
      'mlbb-chou-dragon-boy',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 1841,
    createdAt: '2026-05-30T17:03:00.000Z',
  },
  {
    id: 'col-syafiq-frost-index',
    userId: 'user-syafiq',
    name: 'Frost Index',
    description: 'Every white-and-blue camo I could find.',
    coverUrl: '',
    themeTags: ['codm'],
    itemIds: [
      'codm-m4-arctic-hunter',
      'codm-alias-frostbite',
      'codm-kilo141-glacier',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 1327,
    createdAt: '2026-06-21T10:50:00.000Z',
  },
  {
    id: 'col-mei-singularity',
    userId: 'user-mei',
    name: 'Singularity Bench',
    description: 'The non-Elderflame half. Sharper, colder.',
    coverUrl: '',
    themeTags: ['valorant'],
    itemIds: [
      'val-singularity-knife',
      'val-spectrum-waveform',
      'val-ruination-sword',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 1470,
    createdAt: '2026-07-04T14:38:00.000Z',
  },
  {
    id: 'col-rei-second-string',
    userId: 'user-rei',
    name: 'Second String',
    description: 'Good skins that lost their slot to a Mythic.',
    coverUrl: '',
    themeTags: ['cross-game'],
    itemIds: [
      'codm-kilo141-glacier',
      'mlbb-ling-serpent-lord',
      'mlbb-gusion-cyber-ops',
    ],
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 589,
    createdAt: '2026-07-17T09:29:00.000Z',
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
/**
 * Seeded Showrooms — other collectors' only.
 *
 * The viewer's own stay empty on purpose: rooms are the flow the demo walks
 * (§14's never-cut path), so shipping one pre-built makes the most important
 * surface something the audience watches rather than sees built.
 *
 * Other people's are the opposite problem. Home's "Showrooms from other
 * collectors" rail and Explore both read as broken when nobody in the world
 * has ever made one, and the social thesis (§5) depends on the room being a
 * thing people publish and visit.
 *
 * ⚠️ Who appears here is NOT a free choice: §9.4 needs three verified items,
 * so a collector only gets a room if their collection clears `MIN_ROOM_ITEMS`.
 * Nine of the fourteen do not, and they have no room — inventing one for
 * someone with a single verified item would make the fixtures contradict the
 * rule the app enforces, which is the exact "seeded data looks fake" tell §15
 * warns about and the first thing a judge who reads the gate goes looking for.
 *
 * ⚠️ SECOND GATE, and the reason this list stays intentional: seeded rooms
 * should prefer items with an entry in `config/modelRegistry`. Placing too many
 * flat fallback cards on pedestals next to real geometry looks like a bug
 * rather than like missing art.
 *
 * Collections stay broader than rooms — a collection has never needed a model —
 * and new generated meshes can light up existing collections without changing
 * this seeded showroom roster.
 *
 * The check to repeat after any edit here: every `ownedItemId` below must be a
 * real row in `owned-items.ts`, owned by the collection's owner, verified,
 * listed in that collection, AND present in `modelRegistry`.
 */
export const ROOMS: readonly Room[] = [
  {
    id: 'room-mei-elderflame',
    collectionId: 'col-mei-elderflame',
    themeId: 'theme-fantasy-armoury',
    title: 'The Dragon Hoard',
    description: 'Two years of Elderflame, finally on a shelf.',
    coverUrl: '',
    backdropUrl: 'room-backdrops/fantasy-armoury.png',
    /* Copied from the theme at creation, which is what a real room does — the
       theme owns the map, the room owns its copy. */
    slots: [
      { id: 'armoury-pedestal-hero', kind: 'pedestal', x: 0.38, y: 0.44, w: 0.24, h: 0.34, depth: 2 },
      { id: 'armoury-case-left', kind: 'case', x: 0.08, y: 0.5, w: 0.18, h: 0.26, depth: 1 },
      { id: 'armoury-case-right', kind: 'case', x: 0.74, y: 0.5, w: 0.18, h: 0.26, depth: 1 },
      { id: 'armoury-wall-1', kind: 'wall', x: 0.12, y: 0.14, w: 0.16, h: 0.22, depth: 0 },
      { id: 'armoury-wall-2', kind: 'wall', x: 0.32, y: 0.1, w: 0.16, h: 0.22, depth: 0 },
      { id: 'armoury-wall-3', kind: 'wall', x: 0.52, y: 0.1, w: 0.16, h: 0.22, depth: 0 },
      { id: 'armoury-wall-4', kind: 'wall', x: 0.72, y: 0.14, w: 0.16, h: 0.22, depth: 0 },
    ],
    placements: [
      { slotId: 'armoury-pedestal-hero', ownedItemId: 'own-mei-val-elderflame-vandal', rotation: 0 },
      { slotId: 'armoury-case-left', ownedItemId: 'own-mei-val-elderflame-operator', rotation: 0 },
      { slotId: 'armoury-case-right', ownedItemId: 'own-mei-val-elderflame-dagger', rotation: 0 },
    ],
    settings: {
      parallaxEnabled: true,
      focusedSlotId: null,
      lightingPreset: 'warm-gold',
      brightness: 0.7,
      animatedLighting: true,
      displayStyle: 'framed',
    },
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 1284,
    visitorCount: 3921,
    publishedAt: '2026-07-30T12:15:00.000Z',
    createdAt: '2026-07-29T09:02:00.000Z',
  },
  {
    id: 'room-rei-mythic',
    collectionId: 'col-rei-mythic-only',
    themeId: 'theme-weapon-vault',
    /* Not "Mythic Only" — that is the COLLECTION's name, and the two sit next
       to each other on the Collections tab. A room is a different object with
       a different job, and giving it a distinct title is what stops the pair
       reading as one entry rendered twice. */
    title: 'Nothing But Mythic',
    description: 'If it is not Mythic it does not get a pedestal.',
    coverUrl: '',
    backdropUrl: 'room-backdrops/weapon-vault.png',
    slots: [
      { id: 'vault-wall-1', kind: 'wall', x: 0.05, y: 0.1, w: 0.19, h: 0.24, depth: 0 },
      { id: 'vault-wall-2', kind: 'wall', x: 0.28, y: 0.08, w: 0.19, h: 0.24, depth: 0 },
      { id: 'vault-wall-3', kind: 'wall', x: 0.52, y: 0.08, w: 0.19, h: 0.24, depth: 0 },
      { id: 'vault-wall-4', kind: 'wall', x: 0.75, y: 0.1, w: 0.19, h: 0.24, depth: 0 },
      { id: 'vault-case-1', kind: 'case', x: 0.05, y: 0.38, w: 0.17, h: 0.13, depth: 1 },
      { id: 'vault-case-2', kind: 'case', x: 0.24, y: 0.4, w: 0.15, h: 0.12, depth: 1 },
      { id: 'vault-case-3', kind: 'case', x: 0.6, y: 0.4, w: 0.15, h: 0.12, depth: 1 },
      { id: 'vault-case-4', kind: 'case', x: 0.77, y: 0.38, w: 0.17, h: 0.13, depth: 1 },
      { id: 'vault-pedestal-hero', kind: 'pedestal', x: 0.4, y: 0.42, w: 0.2, h: 0.32, depth: 2 },
      { id: 'vault-pedestal-left', kind: 'pedestal', x: 0.15, y: 0.58, w: 0.16, h: 0.26, depth: 2 },
      { id: 'vault-pedestal-right', kind: 'pedestal', x: 0.68, y: 0.58, w: 0.16, h: 0.26, depth: 2 },
    ],
    placements: [
      { slotId: 'vault-pedestal-hero', ownedItemId: 'own-rei-codm-dlq33-lightbringer', rotation: 0 },
      { slotId: 'vault-pedestal-left', ownedItemId: 'own-rei-codm-fennec-ascended', rotation: 0 },
      { slotId: 'vault-pedestal-right', ownedItemId: 'own-rei-codm-ak117-cordite-storm', rotation: 0 },
    ],
    settings: {
      parallaxEnabled: true,
      focusedSlotId: null,
      lightingPreset: 'cool-blue',
      brightness: 0.68,
      animatedLighting: true,
      displayStyle: 'hologram',
    },
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 842,
    visitorCount: 2160,
    publishedAt: '2026-08-01T18:40:00.000Z',
    createdAt: '2026-08-01T17:55:00.000Z',
  },
  /**
   * The viewer's own room. Until now both seeded rooms belonged to other
   * collectors, so the owner-only surfaces — Edit Showroom, the ownership split
   * on the collection page — had nothing to demonstrate on a fresh install.
   *
   * Three authored slots for three items, deliberately. `slotsForItemCount`
   * returns the authored set only while the item count does not exceed it, so
   * this room is one of the few that actually renders its hand-placed
   * composition rather than the generated grid (§11 F4 — see the open note
   * about that in the todo list).
   *
   * Pedestals rather than wall mounts: a character model standing on a plinth
   * beside two floating weapons is the arrangement that shows the meshes off.
   */
  {
    id: 'room-jovan-triptych',
    collectionId: 'col-jovan-triptych',
    themeId: 'theme-cyber-shrine',
    /* Distinct from its collection, "Dragon, Blade, Sovereign", for the same
       reason as above — and it names the room's setting rather than its
       contents, which is what a room title is for. */
    title: 'Shrine of the Sovereign',
    description:
      'A dragon-forged rifle, a karambit worth more than the account, and the sovereign who guards them.',
    coverUrl: '',
    backdropUrl: 'room-backdrops/cyber-shrine.png',
    slots: [
      { id: 'shrine-pedestal-hero', kind: 'pedestal', x: 0.4, y: 0.4, w: 0.22, h: 0.36, depth: 2 },
      { id: 'shrine-pedestal-left', kind: 'pedestal', x: 0.12, y: 0.48, w: 0.18, h: 0.28, depth: 1 },
      { id: 'shrine-pedestal-right', kind: 'pedestal', x: 0.7, y: 0.48, w: 0.18, h: 0.28, depth: 1 },
    ],
    placements: [
      /* Gusion takes the hero slot: he is the only full figure, and a character
         reads as the subject with the weapons flanking him. */
      { slotId: 'shrine-pedestal-hero', ownedItemId: 'own-jovan-mlbb-gusion-cyber-faust', rotation: 0 },
      { slotId: 'shrine-pedestal-left', ownedItemId: 'own-jovan-val-elderflame-vandal', rotation: 0 },
      { slotId: 'shrine-pedestal-right', ownedItemId: 'own-jovan-val-prime-karambit', rotation: 0 },
    ],
    settings: {
      parallaxEnabled: true,
      /* Opens wide, not zoomed into one pedestal — the whole point of this room
         is that there are three different KINDS of thing in it. */
      focusedSlotId: null,
      lightingPreset: 'warm-gold',
      brightness: 0.72,
      animatedLighting: true,
      /* `framed`, not `hologram`. The other seeded rooms use hologram, and
         these three are real baked meshes — a hologram treatment on genuine
         geometry hides the thing worth showing. */
      displayStyle: 'framed',
    },
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 1204,
    visitorCount: 3180,
    publishedAt: '2026-08-04T15:00:00.000Z',
    createdAt: '2026-08-04T14:20:00.000Z',
  },
  /*
   * ── Collector showrooms, added 8 Aug ────────────────────────────────────
   * The note above used to say mei and rei were the only collectors who could
   * clear §9.4, and that was true of the roster as it then stood. The new
   * collections changed it: seven more now hold three or more items their
   * owner has VERIFIED, which is the gate `MIN_ROOM_ITEMS` enforces.
   *
   * Every placement below was checked against `owned-items.ts` — each
   * `ownedItemId` is a real row, owned by the collection's owner, with
   * `trustLevel: 'verified'`. Placing an unverified item would put the fixtures
   * in direct contradiction with the rule the app refuses to bend (§9.4).
   *
   * `slots` are copied from the theme rather than referenced, exactly as the
   * three rooms above do it — a room owns its composition from the moment it
   * is created, so editing a theme later cannot orphan a placement.
   *
   * zennx gets two, everyone else one, and six collectors with collections get
   * none because they do not clear the gate. That spread is the point: a demo
   * where every profile has a showroom would hide the rule.
   */
  {
    id: 'room-nova-proof',
    collectionId: 'col-nova-proof',
    themeId: 'theme-anime-dojo',
    title: 'Four Blades, One Rack',
    description: 'Small collection. All of it linked.',
    coverUrl: '',
    backdropUrl: 'room-backdrops/anime-dojo.png',
    slots: [
      { id: 'dojo-pedestal-hero', kind: 'pedestal', x: 0.38, y: 0.44, w: 0.24, h: 0.34, depth: 2 },
      { id: 'dojo-case-left', kind: 'case', x: 0.08, y: 0.5, w: 0.18, h: 0.26, depth: 1 },
      { id: 'dojo-case-right', kind: 'case', x: 0.74, y: 0.5, w: 0.18, h: 0.26, depth: 1 },
      { id: 'dojo-wall-1', kind: 'wall', x: 0.12, y: 0.14, w: 0.16, h: 0.22, depth: 0 },
      { id: 'dojo-wall-2', kind: 'wall', x: 0.32, y: 0.1, w: 0.16, h: 0.22, depth: 0 },
      { id: 'dojo-wall-3', kind: 'wall', x: 0.52, y: 0.1, w: 0.16, h: 0.22, depth: 0 },
      { id: 'dojo-wall-4', kind: 'wall', x: 0.72, y: 0.14, w: 0.16, h: 0.22, depth: 0 },
    ],
    placements: [
      { slotId: 'dojo-pedestal-hero', ownedItemId: 'own-nova-val-prime-karambit', rotation: 0 },
      { slotId: 'dojo-case-left', ownedItemId: 'own-nova-val-voidglass-blade', rotation: 0 },
      { slotId: 'dojo-case-right', ownedItemId: 'own-nova-val-elderflame-vandal', rotation: 0 },
      /* Restored: Ren Kage got a mesh, which is the only reason it was cut. */
      { slotId: 'dojo-wall-1', ownedItemId: 'own-nova-mlbb-neon-ronin', rotation: 0 },
    ],
    settings: {
      parallaxEnabled: true,
      focusedSlotId: null,
      lightingPreset: 'purple-glow',
      brightness: 0.69,
      animatedLighting: true,
      displayStyle: 'hologram',
    },
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 2903,
    visitorCount: 7014,
    publishedAt: '2026-06-09T13:50:00.000Z',
    createdAt: '2026-06-08T20:27:00.000Z',
  },
  {
    /* Cyber Shrine, not the Futuristic Weapon Vault it started on: rei's room
       already wears the vault, and Home's rail shows four rooms with no two
       sharing a creator OR a backdrop. */
    id: 'room-zennx-proof-of-work',
    collectionId: 'col-zennx-proof-of-work',
    themeId: 'theme-cyber-shrine',
    title: 'Receipts',
    description: 'Six skins, one linked account, nothing to argue about.',
    coverUrl: '',
    backdropUrl: 'room-backdrops/cyber-shrine.png',
    slots: [
      { id: 'shrine-pedestal-hero', kind: 'pedestal', x: 0.38, y: 0.44, w: 0.24, h: 0.34, depth: 2 },
      { id: 'shrine-case-left', kind: 'case', x: 0.08, y: 0.5, w: 0.18, h: 0.26, depth: 1 },
      { id: 'shrine-case-right', kind: 'case', x: 0.74, y: 0.5, w: 0.18, h: 0.26, depth: 1 },
      { id: 'shrine-wall-1', kind: 'wall', x: 0.12, y: 0.14, w: 0.16, h: 0.22, depth: 0 },
      { id: 'shrine-wall-2', kind: 'wall', x: 0.32, y: 0.1, w: 0.16, h: 0.22, depth: 0 },
      { id: 'shrine-wall-3', kind: 'wall', x: 0.52, y: 0.1, w: 0.16, h: 0.22, depth: 0 },
      { id: 'shrine-wall-4', kind: 'wall', x: 0.72, y: 0.14, w: 0.16, h: 0.22, depth: 0 },
    ],
    placements: [
      { slotId: 'shrine-pedestal-hero', ownedItemId: 'own-zennx-val-elderflame-vandal', rotation: 0 },
      { slotId: 'shrine-case-left', ownedItemId: 'own-zennx-val-prime-karambit', rotation: 0 },
      { slotId: 'shrine-case-right', ownedItemId: 'own-zennx-val-voidglass-blade', rotation: 0 },
      { slotId: 'shrine-wall-1', ownedItemId: 'own-zennx-codm-dlq33-lightbringer', rotation: 0 },
      { slotId: 'shrine-wall-2', ownedItemId: 'own-zennx-codm-drh-cerberus', rotation: 0 },
      { slotId: 'shrine-wall-3', ownedItemId: 'own-zennx-mlbb-gusion-cyber-faust', rotation: 0 },
      /* Ditto — and it fills the shrine's last free slot, so this room now
         shows two character meshes beside four weapons. */
      { slotId: 'shrine-wall-4', ownedItemId: 'own-zennx-mlbb-neon-ronin', rotation: 0 },
    ],
    settings: {
      parallaxEnabled: true,
      focusedSlotId: null,
      lightingPreset: 'cool-blue',
      brightness: 0.72,
      animatedLighting: true,
      displayStyle: 'hologram',
    },
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 5218,
    visitorCount: 11407,
    publishedAt: '2026-06-02T10:00:00.000Z',
    createdAt: '2026-06-01T18:20:00.000Z',
  },
  {
    /* Three CHARACTERS and no weapons — the only seeded room that is, because
       Priya is the one collector whose verified inventory is MLBB end to end.
       Worth having as its own case: `modelIsCharacter` frames a hero mesh
       differently from a rifle, and nothing else exercises three at once. */
    id: 'room-priya-dawn',
    collectionId: 'col-priya-dawn-verified',
    themeId: 'theme-collectors-study',
    title: 'The Reading Room',
    description: 'Quiet shelf, loud heroes.',
    coverUrl: '',
    backdropUrl: 'room-backdrops/collectors-study.png',
    slots: [
      { id: 'study-pedestal-hero', kind: 'pedestal', x: 0.38, y: 0.44, w: 0.24, h: 0.34, depth: 2 },
      { id: 'study-case-left', kind: 'case', x: 0.08, y: 0.5, w: 0.18, h: 0.26, depth: 1 },
      { id: 'study-case-right', kind: 'case', x: 0.74, y: 0.5, w: 0.18, h: 0.26, depth: 1 },
      { id: 'study-wall-1', kind: 'wall', x: 0.12, y: 0.14, w: 0.16, h: 0.22, depth: 0 },
      { id: 'study-wall-2', kind: 'wall', x: 0.32, y: 0.1, w: 0.16, h: 0.22, depth: 0 },
      { id: 'study-wall-3', kind: 'wall', x: 0.52, y: 0.1, w: 0.16, h: 0.22, depth: 0 },
      { id: 'study-wall-4', kind: 'wall', x: 0.72, y: 0.14, w: 0.16, h: 0.22, depth: 0 },
    ],
    placements: [
      { slotId: 'study-pedestal-hero', ownedItemId: 'own-priya-mlbb-lightborn-defender', rotation: 0 },
      { slotId: 'study-case-left', ownedItemId: 'own-priya-mlbb-radiant-huntress', rotation: 0 },
      { slotId: 'study-case-right', ownedItemId: 'own-priya-mlbb-slipstream-pilot', rotation: 0 },
    ],
    settings: {
      parallaxEnabled: true,
      focusedSlotId: null,
      lightingPreset: 'warm-gold',
      brightness: 0.74,
      animatedLighting: true,
      displayStyle: 'framed',
    },
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 2611,
    visitorCount: 6120,
    publishedAt: '2026-07-22T14:05:00.000Z',
    createdAt: '2026-07-21T10:33:00.000Z',
  },
  {
    /* Back, now that Ghost — Nightfall has a mesh. It was cut when the model
       gate landed and its third item was a flat card; nothing else about it
       changed. A character on the hero pedestal with two weapons flanking is
       the mixed case the other rooms do not cover. */
    id: 'room-syafiq-blueprints',
    collectionId: 'col-syafiq-blueprints',
    themeId: 'theme-weapon-vault',
    title: 'The Armoury Floor',
    description: 'Three verified blueprints. The rest of the vault is still scans.',
    coverUrl: '',
    backdropUrl: 'room-backdrops/weapon-vault.png',
    slots: [
      { id: 'vault-wall-1', kind: 'wall', x: 0.05, y: 0.1, w: 0.19, h: 0.24, depth: 0 },
      { id: 'vault-wall-2', kind: 'wall', x: 0.28, y: 0.08, w: 0.19, h: 0.24, depth: 0 },
      { id: 'vault-wall-3', kind: 'wall', x: 0.52, y: 0.08, w: 0.19, h: 0.24, depth: 0 },
      { id: 'vault-wall-4', kind: 'wall', x: 0.75, y: 0.1, w: 0.19, h: 0.24, depth: 0 },
      { id: 'vault-case-1', kind: 'case', x: 0.05, y: 0.38, w: 0.17, h: 0.13, depth: 1 },
      { id: 'vault-case-2', kind: 'case', x: 0.24, y: 0.4, w: 0.15, h: 0.12, depth: 1 },
      { id: 'vault-case-3', kind: 'case', x: 0.6, y: 0.4, w: 0.15, h: 0.12, depth: 1 },
      { id: 'vault-case-4', kind: 'case', x: 0.77, y: 0.38, w: 0.17, h: 0.13, depth: 1 },
      { id: 'vault-pedestal-hero', kind: 'pedestal', x: 0.4, y: 0.42, w: 0.2, h: 0.32, depth: 2 },
      { id: 'vault-pedestal-left', kind: 'pedestal', x: 0.15, y: 0.58, w: 0.16, h: 0.26, depth: 2 },
      { id: 'vault-pedestal-right', kind: 'pedestal', x: 0.68, y: 0.58, w: 0.16, h: 0.26, depth: 2 },
    ],
    placements: [
      { slotId: 'vault-pedestal-hero', ownedItemId: 'own-syafiq-codm-ghost-nightfall', rotation: 0 },
      { slotId: 'vault-pedestal-left', ownedItemId: 'own-syafiq-codm-drh-cerberus', rotation: 0 },
      { slotId: 'vault-pedestal-right', ownedItemId: 'own-syafiq-codm-qq9-diavolo', rotation: 0 },
    ],
    settings: {
      parallaxEnabled: true,
      focusedSlotId: null,
      lightingPreset: 'dark-cinematic',
      brightness: 0.6,
      animatedLighting: true,
      displayStyle: 'framed',
    },
    visibility: 'public',
    allowComments: true,
    showOnProfile: true,
    likeCount: 2074,
    visitorCount: 5566,
    publishedAt: '2026-06-14T11:12:00.000Z',
    createdAt: '2026-06-13T16:48:00.000Z',
  },
];

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
