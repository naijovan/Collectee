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
] as const satisfies readonly Community[];

export const COMMUNITY_MEMBERSHIPS = [
  { userId: 'user-jovan', communityId: 'comm-blueprint-vault', notificationPref: 'all' },
  { userId: 'user-jovan', communityId: 'comm-knife-collectors', notificationPref: 'highlights' },
  { userId: 'user-jovan', communityId: 'comm-cross-game', notificationPref: 'all' },
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
