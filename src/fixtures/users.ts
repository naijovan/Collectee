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

/** The signed-in demo account. §16 Q8: the demo opens logged-in; auth is skipped. */
export const VIEWER_ID = 'user-jovan';

export const USERS = [
  {
    id: 'user-jovan',
    handle: 'jovan',
    displayName: 'Jovan',
    avatar: 'avatars/jovan.png',
    bio: 'Cross-game collector. CODM blueprints and Valorant knives mostly.',
    followedGames: ['codm', 'valorant', 'mlbb'],
    isAccountVerified: true,
  },
  {
    id: 'user-rei',
    handle: 'reiplays',
    displayName: 'Rei',
    avatar: 'avatars/rei.png',
    bio: 'Mythic hunter. If it glows, I want it.',
    followedGames: ['codm', 'mlbb'],
    isAccountVerified: true,
  },
  {
    id: 'user-syafiq',
    handle: 'syafiqq',
    displayName: 'Syafiq',
    avatar: 'avatars/syafiq.png',
    bio: 'CODM since season 1. Blueprint completionist.',
    followedGames: ['codm'],
    isAccountVerified: true,
  },
  {
    id: 'user-mei',
    handle: 'meilin',
    displayName: 'Mei Lin',
    avatar: 'avatars/mei.png',
    bio: 'Valorant knives and nothing else. Ask me about Elderflame.',
    followedGames: ['valorant'],
    isAccountVerified: true,
  },
  {
    id: 'user-danish',
    handle: 'danish.exe',
    displayName: 'Danish',
    avatar: 'avatars/danish.png',
    bio: 'MLBB Collector skins. Land of Dawn since 2018.',
    followedGames: ['mlbb'],
    isAccountVerified: false,
  },
  {
    id: 'user-arya',
    handle: 'aryaaa',
    displayName: 'Arya',
    avatar: 'avatars/arya.png',
    bio: 'Three games, one shelf. Building the cross-game room.',
    followedGames: ['codm', 'valorant', 'mlbb'],
    isAccountVerified: true,
  },
  {
    id: 'user-kai',
    handle: 'kaizen',
    displayName: 'Kai',
    avatar: 'avatars/kai.png',
    bio: 'Set completion or nothing.',
    followedGames: ['valorant', 'codm'],
    isAccountVerified: false,
  },
  {
    id: 'user-nadia',
    handle: 'nadiaaa',
    displayName: 'Nadia',
    avatar: 'avatars/nadia.png',
    bio: 'Here for the patch notes, staying for the rooms.',
    followedGames: ['mlbb', 'valorant'],
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
