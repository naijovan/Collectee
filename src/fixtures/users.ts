/**
 * Seeded users — the demo account plus the collectors Discover recommends.
 *
 * §15 risk "seeded data looks fake": keep item counts in the HUNDREDS and like
 * counts in the thousands. No collector card should ever read "12.4K items".
 *
 * `isAccountVerified` is the blue tick on a COLLECTOR — account-level identity.
 * It is a different concept from an item's `trustLevel` (§9.3). Do not conflate
 * them in UI copy.
 */

import type { GameAccount, User } from '@/types';

/**
 * `User.avatar` holds an AVATAR ROSTER ID (`config/avatarRegistry`), not a path.
 *
 * It used to hold `avatars/<name>.png` — a path to a file that never existed
 * and that nothing ever read, because `Avatar` drew initials from the display
 * name. Now that there is a real roster the field points into it, which is what
 * makes "no duplicate faces" a property this file can guarantee rather than
 * hope for: `validate-fixtures` fails on a repeat or an unknown id.
 *
 * Assignments are by game affinity — someone who only plays Valorant gets a
 * Valorant face. `User` is unchanged, so this is a fixture edit and not a §12.3
 * merge-contract change.
 */

/** The signed-in demo account. §16 Q8: the demo opens logged-in; auth is skipped. */
export const VIEWER_ID = 'user-jovan';

export const USERS = [
  {
    id: 'user-jovan',
    handle: 'jovan',
    displayName: 'Jovan',
    avatar: 'avatar-codm-ghost', // viewer; follows all three, CODM is the hero title
    bio: 'Cross-game collector. CODM blueprints and Valorant knives mostly.',
    followedGames: ['codm', 'valorant', 'mlbb'],
    isAccountVerified: true,
  },
  {
    id: 'user-rei',
    handle: 'reiplays',
    displayName: 'Rei',
    avatar: 'avatar-codm-price', // codm + mlbb
    bio: 'Mythic hunter. If it glows, I want it.',
    followedGames: ['codm', 'mlbb'],
    isAccountVerified: true,
  },
  {
    id: 'user-syafiq',
    handle: 'syafiqq',
    displayName: 'Syafiq',
    avatar: 'avatar-codm-soap', // codm only
    bio: 'CODM since season 1. Blueprint completionist.',
    followedGames: ['codm'],
    isAccountVerified: true,
  },
  {
    id: 'user-mei',
    handle: 'meilin',
    displayName: 'Mei Lin',
    avatar: 'avatar-val-jett', // valorant only
    bio: 'Valorant knives and nothing else. Ask me about Elderflame.',
    followedGames: ['valorant'],
    isAccountVerified: true,
  },
  {
    id: 'user-danish',
    handle: 'danish.exe',
    displayName: 'Danish',
    avatar: 'avatar-mlbb-gusion', // mlbb only
    bio: 'MLBB Collector skins. Land of Dawn since 2018.',
    followedGames: ['mlbb'],
    isAccountVerified: false,
  },
  {
    id: 'user-arya',
    handle: 'aryaaa',
    displayName: 'Arya',
    avatar: 'avatar-val-reyna', // follows all three
    bio: 'Three games, one shelf. Building the cross-game room.',
    followedGames: ['codm', 'valorant', 'mlbb'],
    isAccountVerified: true,
  },
  {
    id: 'user-kai',
    handle: 'kaizen',
    displayName: 'Kai',
    avatar: 'avatar-val-neon', // valorant + codm
    bio: 'Set completion or nothing.',
    followedGames: ['valorant', 'codm'],
    isAccountVerified: false,
  },
  {
    id: 'user-nadia',
    handle: 'nadiaaa',
    displayName: 'Nadia',
    avatar: 'avatar-mlbb-fanny', // mlbb + valorant
    bio: 'Here for the patch notes, staying for the rooms.',
    followedGames: ['mlbb', 'valorant'],
    isAccountVerified: false,
  },

  /* ── Added to give Discover a real spread ─────────────────────────────────
     Eight collectors meant "Collectors you may like" was showing most of the
     app's population, and the scores clustered because the inventories were
     built for other purposes.

     These six are seeded deliberately across the range — see the ownership
     blocks in owned-items.ts, which are what the percentages actually come
     from. Matching counts VERIFIED items only (team decision, 3 Aug), so a
     collector's score is set by how much of their *verified* set overlaps
     Jovan's, not by how much they own.

     Every avatar here was previously unused; none is shared with a seeded
     collector, so nobody has a twin in a list of faces. */
  {
    id: 'user-zennx',
    handle: 'zennx',
    displayName: 'Zennx',
    avatar: 'avatar-mlbb-lancelot', // follows all three — the near-twin match
    bio: 'Mythics across all three. If you own it, I probably want it.',
    followedGames: ['codm', 'valorant', 'mlbb'],
    isAccountVerified: true,
  },
  {
    id: 'user-nova',
    handle: 'novaaim',
    displayName: 'Nova',
    avatar: 'avatar-val-sage', // valorant + mlbb
    bio: 'Knives first, everything else second.',
    followedGames: ['valorant', 'mlbb'],
    isAccountVerified: true,
  },
  {
    id: 'user-tarek',
    handle: 'tarek.hq',
    displayName: 'Tarek',
    avatar: 'avatar-codm-scylla', // codm only
    bio: 'Snipers and nothing but. Lightbringer is the ceiling.',
    followedGames: ['codm'],
    isAccountVerified: true,
  },
  {
    id: 'user-priya',
    handle: 'priyaaa',
    displayName: 'Priya',
    avatar: 'avatar-mlbb-ling', // mlbb + codm
    bio: 'Land of Dawn first. Slowly getting talked into CODM.',
    followedGames: ['mlbb', 'codm'],
    isAccountVerified: true,
  },
  {
    id: 'user-bo',
    handle: 'bo.wav',
    displayName: 'Bo',
    avatar: 'avatar-val-clove', // valorant only
    bio: 'Reaver line completionist. Not interested in anything else.',
    followedGames: ['valorant'],
    isAccountVerified: false,
  },
  {
    /* Owns plenty, has verified almost none — the "verify your stuff" case.
       Distinct from Nadia, who is the true zero. He scores low despite a large
       inventory, which is the argument the Verify step makes. */
    id: 'user-iman',
    handle: 'imanx',
    displayName: 'Iman',
    avatar: 'avatar-codm-urban-tracker',
    bio: 'Scanned everything, linked nothing. Will get to it.',
    followedGames: ['codm', 'valorant'],
    isAccountVerified: false,
  },
] as const satisfies readonly User[];

export const USERS_BY_ID: ReadonlyMap<string, User> = new Map(USERS.map((u) => [u.id, u]));

/**
 * §9.3 [ROADMAP] — real account linking is PARTNERSHIP-gated, not
 * engineering-gated. None of the three launch titles exposes a public
 * cosmetic-inventory API. These records exist so the mocked OAuth screen has
 * something to read; `linked` here means "we pretended", and the pitch must say
 * so if asked.
 */
export const GAME_ACCOUNTS = [
  { userId: 'user-jovan', title: 'codm', externalHandle: 'JovanSG#4471', linkStatus: 'linked' },
  { userId: 'user-jovan', title: 'valorant', externalHandle: 'jovan#SG1', linkStatus: 'linked' },
  { userId: 'user-jovan', title: 'mlbb', externalHandle: '82910334', linkStatus: 'unlinked' },
  { userId: 'user-rei', title: 'codm', externalHandle: 'ReiPlays#1120', linkStatus: 'linked' },
  { userId: 'user-mei', title: 'valorant', externalHandle: 'meilin#APAC', linkStatus: 'linked' },
  { userId: 'user-danish', title: 'mlbb', externalHandle: '11284477', linkStatus: 'unlinked' },
] as const satisfies readonly GameAccount[];
