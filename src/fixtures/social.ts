/**
 * Social graph, communities, moderation and notifications.
 *
 * The flag fixtures below are shaped to demonstrate BOTH sides of the §9.2
 * threshold guard, because that guard is the answer to the hardest Q&A question
 * and "safer communities" is an explicit judging theme (§8.2):
 *
 *   - `own-danish-mlbb-lancelot-royal-matador` has 3 countable flags → crosses
 *     FLAG_THRESHOLD, loses discovery ranking, enters the review queue.
 *   - `own-kai-val-prime-vandal` has 2 countable flags plus one from an
 *     ineligible reporter → stays visible. This is the case that proves an
 *     unguarded flag button would otherwise be a weapon.
 */

import type {
  Comment,
  Community,
  CommunityMembership,
  Flag,
  Follow,
  FollowedTopic,
  Notification,
  SavedArticle,
} from '@/types';

export const FOLLOWS = [
  { followerId: 'user-jovan', followeeId: 'user-rei', createdAt: '2026-06-22T10:00:00.000Z' },
  { followerId: 'user-jovan', followeeId: 'user-mei', createdAt: '2026-06-22T10:02:00.000Z' },
  { followerId: 'user-jovan', followeeId: 'user-arya', createdAt: '2026-07-01T14:20:00.000Z' },
  { followerId: 'user-rei', followeeId: 'user-jovan', createdAt: '2026-06-23T08:11:00.000Z' },
  { followerId: 'user-arya', followeeId: 'user-jovan', createdAt: '2026-07-01T15:00:00.000Z' },
  { followerId: 'user-syafiq', followeeId: 'user-jovan', createdAt: '2026-07-05T19:30:00.000Z' },
  { followerId: 'user-nadia', followeeId: 'user-mei', createdAt: '2026-07-12T09:45:00.000Z' },
  { followerId: 'user-kai', followeeId: 'user-syafiq', createdAt: '2026-07-14T11:05:00.000Z' },

  /* ── The six added collectors, wired into the graph ──────────────────────
     Three followers and three following was a symmetry nobody chose — it was
     just what the original eight users produced, and it made the Profile's two
     stats look like one number printed twice.

     Deliberately lopsided now: 8 followers, 5 following. Followers outnumbering
     following is the normal shape for an account worth looking at, and the two
     tiles finally say different things.

     Everyone here is a real seeded user, so tapping either stat opens a list of
     faces rather than a count that leads nowhere. */

  // Following — the collectors Jovan chose, weighted to his high matches.
  { followerId: 'user-jovan', followeeId: 'user-zennx', createdAt: '2026-07-16T09:10:00.000Z' },
  { followerId: 'user-jovan', followeeId: 'user-nova', createdAt: '2026-07-18T13:35:00.000Z' },

  // Followers — a spread across the match range, not only the near-twins. An
  // account is followed by people it does not match, and a list that was only
  // 80%+ collectors would read as a filtered view rather than a follower list.
  { followerId: 'user-zennx', followeeId: 'user-jovan', createdAt: '2026-07-16T09:12:00.000Z' },
  { followerId: 'user-nova', followeeId: 'user-jovan', createdAt: '2026-07-18T13:40:00.000Z' },
  { followerId: 'user-tarek', followeeId: 'user-jovan', createdAt: '2026-07-21T17:22:00.000Z' },
  { followerId: 'user-priya', followeeId: 'user-jovan', createdAt: '2026-07-26T08:04:00.000Z' },
  { followerId: 'user-iman', followeeId: 'user-jovan', createdAt: '2026-07-29T21:48:00.000Z' },

  // Between the new collectors, so the graph is not a star with Jovan at the
  // centre — Discover reads as a community rather than one account and its fans.
  { followerId: 'user-bo', followeeId: 'user-nova', createdAt: '2026-07-22T12:00:00.000Z' },
  { followerId: 'user-priya', followeeId: 'user-danish', createdAt: '2026-07-27T10:30:00.000Z' },
] as const satisfies readonly Follow[];

/**
 * §16 Q5 is still open — are communities user-creatable in the demo, or
 * seeded-only? These are seeded. The descope ladder (§14 step 3) says
 * join/view only, no posting, if time runs short.
 */
export const COMMUNITIES = [
  {
    id: 'comm-blueprint-vault',
    name: 'Blueprint Vault',
    description: 'CODM weapon blueprints. Post your pulls, not your K/D.',
    avatarUrl: 'communities/blueprint-vault.png',
    tags: ['CODM', 'blueprints'],
    memberIds: ['user-jovan', 'user-rei', 'user-syafiq', 'user-kai'],
    memberCount: 4218,
  },
  {
    id: 'comm-knife-collectors',
    name: 'Knife Collectors',
    description: 'Valorant melee only. Ultra tier welcome, Select tier respected.',
    avatarUrl: 'communities/knife-collectors.png',
    tags: ['Valorant', 'melee'],
    memberIds: ['user-mei', 'user-jovan', 'user-kai'],
    memberCount: 2967,
  },
  {
    id: 'comm-land-of-dawn',
    name: 'Land of Dawn Collectors',
    description: 'MLBB Collector and Legend skins. SEA-first.',
    avatarUrl: 'communities/land-of-dawn.png',
    tags: ['MLBB', 'Collector'],
    memberIds: ['user-danish', 'user-rei', 'user-nadia'],
    memberCount: 6104,
  },
  {
    id: 'comm-cross-game',
    name: 'One Shelf',
    description: 'Cross-game collectors. Rooms, not grids.',
    avatarUrl: 'communities/one-shelf.png',
    tags: ['cross-game', 'rooms'],
    memberIds: ['user-arya', 'user-jovan'],
    memberCount: 1487,
  },

  /*
   * ── Added 8 Aug, to fill out both Explore sections ──────────────────────
   * The first two carry `user-jovan`, so they land in "Your Communities"; the
   * last three deliberately do not, so they have somewhere to be recommended
   * FROM. `getRecommendedCommunities` filters on live membership, so a join
   * during the demo moves a card from the second list to the first.
   *
   * The leading tag is what the card prints, and `getRecommendedCommunities`
   * matches it against the titles the viewer owns verified items in — so a tag
   * of 'MLBB' is load-bearing, not decoration, and the spread across the three
   * games is what makes the recommendation reasons differ from each other.
   *
   * No art yet: `communityArtFor` returns null for these ids and the card draws
   * its deterministic tinted block instead, which is exactly what that fallback
   * is for. Dropping five 1200x800 files into assets/collectee/communities/
   * named for these ids is the only step to art, per `config/communityArt`.
   */
  {
    id: 'comm-mythic-drop',
    name: 'Mythic Drop',
    description: 'CODM Mythic and Legendary pulls. Screenshots or it did not happen.',
    avatarUrl: 'communities/mythic-drop.png',
    tags: ['CODM', 'Mythic'],
    memberIds: ['user-jovan', 'user-zennx', 'user-syafiq', 'user-bo'],
    memberCount: 3345,
  },
  {
    id: 'comm-hero-skins',
    name: 'Hero Skins SEA',
    description: 'MLBB Collector, Legend and Epic skins, from the SEA servers out.',
    avatarUrl: 'communities/hero-skins.png',
    tags: ['MLBB', 'Epic'],
    memberIds: ['user-jovan', 'user-danish', 'user-nadia', 'user-priya'],
    memberCount: 5290,
  },
  {
    id: 'comm-vandal-club',
    name: 'Vandal Club',
    description: 'Every Valorant Vandal line, ranked and argued about.',
    avatarUrl: 'communities/vandal-club.png',
    tags: ['Valorant', 'rifles'],
    memberIds: ['user-mei', 'user-tarek', 'user-arya'],
    memberCount: 2154,
  },
  {
    id: 'comm-epic-nights',
    name: 'Epic Nights',
    description: 'MLBB Epic and Special skins. Squad-ups optional, screenshots not.',
    avatarUrl: 'communities/epic-nights.png',
    tags: ['MLBB', 'Special'],
    memberIds: ['user-nadia', 'user-iman', 'user-rei'],
    memberCount: 1876,
  },
  {
    id: 'comm-shelf-tours',
    name: 'Shelf Tours',
    description: 'Showroom walkthroughs from every game. Post yours, tour theirs.',
    avatarUrl: 'communities/shelf-tours.png',
    tags: ['cross-game', 'showrooms'],
    memberIds: ['user-nova', 'user-kai', 'user-arya', 'user-iman'],
    memberCount: 998,
  },
] as const satisfies readonly Community[];

export const COMMUNITY_MEMBERSHIPS = [
  { userId: 'user-jovan', communityId: 'comm-blueprint-vault', notificationPref: 'all' },
  { userId: 'user-jovan', communityId: 'comm-knife-collectors', notificationPref: 'highlights' },
  { userId: 'user-jovan', communityId: 'comm-cross-game', notificationPref: 'all' },
  { userId: 'user-jovan', communityId: 'comm-mythic-drop', notificationPref: 'all' },
  { userId: 'user-jovan', communityId: 'comm-hero-skins', notificationPref: 'highlights' },
] as const satisfies readonly CommunityMembership[];

export const COMMENTS = [
  {
    id: 'cmt-1',
    targetType: 'collection',
    targetId: 'col-jovan-crown-jewels',
    userId: 'user-rei',
    body: 'The Lightbringer on a pedestal is the correct call.',
    parentId: null,
    likeCount: 128,
    createdAt: '2026-06-21T11:30:00.000Z',
  },
  {
    id: 'cmt-2',
    targetType: 'collection',
    targetId: 'col-jovan-crown-jewels',
    userId: 'user-jovan',
    body: 'It took long enough to pull, it earned the spot.',
    parentId: 'cmt-1',
    likeCount: 44,
    createdAt: '2026-06-21T12:02:00.000Z',
  },
  {
    id: 'cmt-4',
    targetType: 'collection',
    targetId: 'col-rei-mythic-only',
    userId: 'user-syafiq',
    body: 'Respect for holding the line on Mythic only.',
    parentId: null,
    likeCount: 96,
    createdAt: '2026-05-12T20:40:00.000Z',
  },
  /* ── Showrooms ──────────────────────────────────────────────────────────
     A room is a thing people visit, and an empty comment thread under one
     makes it look like nobody did. Written specific rather than complimentary:
     every one names an item, a placement or a set, because generic praise is
     the tell §15 warns about — it reads as filler on a slide. */
  {
    id: 'cmt-room-mei-1',
    targetType: 'room',
    targetId: 'room-mei-elderflame',
    userId: 'user-arya',
    body: 'Putting the Operator in the side case instead of the centre was brave and it works.',
    parentId: null,
    likeCount: 214,
    createdAt: '2026-07-30T14:02:00.000Z',
  },
  {
    id: 'cmt-room-mei-2',
    targetType: 'room',
    targetId: 'room-mei-elderflame',
    userId: 'user-kai',
    body: 'Two years for three skins. That is the whole hobby in one shelf.',
    parentId: null,
    likeCount: 167,
    createdAt: '2026-07-31T09:18:00.000Z',
  },
  {
    id: 'cmt-room-mei-3',
    targetType: 'room',
    targetId: 'room-mei-elderflame',
    userId: 'user-mei',
    body: 'The dagger nearly did not make it in. Glad I waited for the full set.',
    parentId: 'cmt-room-mei-2',
    likeCount: 41,
    createdAt: '2026-07-31T10:05:00.000Z',
  },
  {
    id: 'cmt-room-rei-1',
    targetType: 'room',
    targetId: 'room-rei-mythic',
    userId: 'user-syafiq',
    body: 'Cordite Storm holds up next to the Lightbringer, which I did not expect.',
    parentId: null,
    likeCount: 88,
    createdAt: '2026-08-02T08:44:00.000Z',
  },
  {
    id: 'cmt-room-rei-2',
    targetType: 'room',
    targetId: 'room-rei-mythic',
    userId: 'user-nadia',
    body: 'Three pedestals, no wall panels. Restraint is underrated.',
    parentId: null,
    likeCount: 62,
    createdAt: '2026-08-02T19:11:00.000Z',
  },

  /* ── Collections ────────────────────────────────────────────────────────
     One or two each. A thread of six under every collection would read as
     astroturf, and §15 asks for plausible numbers rather than flattering ones. */
  {
    id: 'cmt-col-hellhound-1',
    targetType: 'collection',
    targetId: 'col-jovan-hellhound',
    userId: 'user-syafiq',
    body: 'Cerberus and Diavolo in the same set is a specific kind of taste. Respect.',
    parentId: null,
    likeCount: 54,
    createdAt: '2026-07-11T13:20:00.000Z',
  },
  {
    id: 'cmt-col-hellhound-2',
    targetType: 'collection',
    targetId: 'col-jovan-hellhound',
    userId: 'user-kai',
    body: 'Missing two for the full set though. Are you going for it?',
    parentId: null,
    likeCount: 19,
    createdAt: '2026-07-12T07:55:00.000Z',
  },
  {
    id: 'cmt-col-neon-1',
    targetType: 'collection',
    targetId: 'col-jovan-neon-legends',
    userId: 'user-danish',
    body: 'Neon Ronin next to Shadow Protocol is the best pairing on this app.',
    parentId: null,
    likeCount: 131,
    createdAt: '2026-07-19T21:04:00.000Z',
  },
  {
    id: 'cmt-col-neon-2',
    targetType: 'collection',
    targetId: 'col-jovan-neon-legends',
    userId: 'user-nadia',
    body: 'Six items and not one of them out of place on the palette.',
    parentId: null,
    likeCount: 77,
    createdAt: '2026-07-20T12:30:00.000Z',
  },
  {
    id: 'cmt-col-mei-1',
    targetType: 'collection',
    targetId: 'col-mei-elderflame',
    userId: 'user-jovan',
    body: 'Full Elderflame. I have been chasing the Operator for a year.',
    parentId: null,
    likeCount: 203,
    createdAt: '2026-07-28T16:40:00.000Z',
  },
  {
    id: 'cmt-col-danish-1',
    targetType: 'collection',
    targetId: 'col-danish-collector',
    userId: 'user-mei',
    body: 'Feathery Wonderland is still the best Kagura and nobody can tell me otherwise.',
    parentId: null,
    likeCount: 145,
    createdAt: '2026-07-24T10:12:00.000Z',
  },
  {
    id: 'cmt-col-syafiq-1',
    targetType: 'collection',
    targetId: 'col-syafiq-blueprints',
    userId: 'user-rei',
    body: 'Six blueprints and every one a different camo family. That is the flex.',
    parentId: null,
    likeCount: 91,
    createdAt: '2026-07-16T18:25:00.000Z',
  },
  {
    id: 'cmt-col-arya-1',
    targetType: 'collection',
    targetId: 'col-arya-cross-game',
    userId: 'user-kai',
    body: 'Three games on one shelf and it still reads as one collection. Hard to do.',
    parentId: null,
    likeCount: 118,
    createdAt: '2026-07-22T14:48:00.000Z',
  },
] as const satisfies readonly Comment[];

/**
 * Flags target an OwnedItem id — a specific person's ownership claim, not the
 * catalogue entry. Flagging "Prime Vandal" as a concept would be meaningless.
 */
export const FLAGS = [
  // Crosses the threshold: 3 distinct eligible reporters.
  {
    id: 'flag-1',
    targetType: 'item',
    targetId: 'own-danish-mlbb-lancelot-royal-matador',
    reporterId: 'user-rei',
    reason: 'duplicate_uniqueness',
    status: 'open',
    createdAt: '2026-07-20T09:00:00.000Z',
  },
  {
    id: 'flag-2',
    targetType: 'item',
    targetId: 'own-danish-mlbb-lancelot-royal-matador',
    reporterId: 'user-mei',
    reason: 'false_ownership',
    status: 'open',
    createdAt: '2026-07-20T14:25:00.000Z',
  },
  {
    id: 'flag-3',
    targetType: 'item',
    targetId: 'own-danish-mlbb-lancelot-royal-matador',
    reporterId: 'user-syafiq',
    reason: 'false_ownership',
    status: 'under_review',
    createdAt: '2026-07-21T07:40:00.000Z',
  },
  // Below the threshold: 2 eligible reporters, plus one from an account with no
  // verified items of its own — which does not count (§9.2).
  {
    id: 'flag-4',
    targetType: 'item',
    targetId: 'own-kai-val-prime-vandal',
    reporterId: 'user-mei',
    reason: 'false_ownership',
    status: 'open',
    createdAt: '2026-07-23T11:15:00.000Z',
  },
  {
    id: 'flag-5',
    targetType: 'item',
    targetId: 'own-kai-val-prime-vandal',
    reporterId: 'user-rei',
    reason: 'false_ownership',
    status: 'open',
    createdAt: '2026-07-23T12:00:00.000Z',
  },
  {
    id: 'flag-6',
    targetType: 'item',
    targetId: 'own-kai-val-prime-vandal',
    reporterId: 'user-nadia',
    reason: 'false_ownership',
    status: 'open',
    createdAt: '2026-07-23T12:30:00.000Z',
  },

  /**
   * Content reports on a thread reply (§11 F5, §8.2). Two reporters, which
   * crosses CONTENT_REPORT_THRESHOLD — content reports need fewer reporters and
   * no eligibility test, because requiring verified items to report harassment
   * would gate safety behind a partnership that does not exist (§9.3).
   *
   * Note the second reporter: Nadia owns nothing verified, so her ownership
   * flags do not count at all (see flag-6 above, which is why that item stays
   * below its threshold). Here she counts. That contrast IS the two-tier rule,
   * demonstrable in the seeded data without touching anything.
   */
  {
    id: 'flag-7',
    targetType: 'comment',
    targetId: 'cmt-thr-lod-3',
    reporterId: 'user-danish',
    reason: 'spam',
    status: 'open',
    createdAt: '2026-08-01T06:40:00.000Z',
  },
  {
    id: 'flag-8',
    targetType: 'comment',
    targetId: 'cmt-thr-lod-3',
    reporterId: 'user-nadia',
    reason: 'abusive_content',
    status: 'open',
    createdAt: '2026-08-01T07:15:00.000Z',
  },
] as const satisfies readonly Flag[];

export const FOLLOWED_TOPICS = [
  { userId: 'user-jovan', kind: 'game', value: 'CODM' },
  { userId: 'user-jovan', kind: 'game', value: 'Valorant' },
  { userId: 'user-jovan', kind: 'franchise', value: 'Elderflame' },
  { userId: 'user-jovan', kind: 'character', value: 'Gusion' },
] as const satisfies readonly FollowedTopic[];

export const SAVED_ARTICLES = [
  { userId: 'user-jovan', articleId: 'art-codm-s6-patch', savedAt: '2026-07-31T09:12:00.000Z' },
  { userId: 'user-jovan', articleId: 'art-val-knife-economy', savedAt: '2026-07-28T08:03:00.000Z' },
] as const satisfies readonly SavedArticle[];

export const NOTIFICATIONS = [
  {
    id: 'notif-1',
    userId: 'user-jovan',
    kind: 'follow',
    targetId: 'user-syafiq',
    body: 'Syafiq started following you',
    read: false,
    createdAt: '2026-08-01T18:20:00.000Z',
  },
  {
    id: 'notif-2',
    userId: 'user-jovan',
    kind: 'news',
    targetId: 'art-codm-s6-patch',
    body: 'A weapon you own was changed in the Season 6 patch',
    read: false,
    createdAt: '2026-07-31T08:05:00.000Z',
  },
  {
    id: 'notif-3',
    userId: 'user-jovan',
    kind: 'comment',
    targetId: 'col-jovan-crown-jewels',
    body: 'Rei commented on Crown Jewels',
    read: true,
    createdAt: '2026-06-21T11:31:00.000Z',
  },
] as const satisfies readonly Notification[];
