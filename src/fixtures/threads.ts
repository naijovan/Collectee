/**
 * Seeded community threads — PRD §11 F5.
 *
 * Screens must NOT import this. Go through `threadService` (§12.1).
 *
 * Three conversations, one per community the demo visits, chosen so the
 * threads tab is never empty on stage and so each one shows a different reason
 * communities exist:
 *
 *   Blueprint Vault      — showing off a pull (the collector identity thesis)
 *   Knife Collectors     — finding people to play with (the social point)
 *   Land of Dawn         — a thread carrying a REPORTED reply (§8.2)
 *
 * ⚠️ The reported reply is seeded past the threshold on purpose. `cmt-thr-lod-3`
 * has two content reports from `FLAGS` in `./social`, and content reports need
 * two reporters with no eligibility test (`CONTENT_REPORT_THRESHOLD`), so it is
 * withheld and sitting in the review queue from first launch. The alternative —
 * seeding it below the threshold and flipping it during the demo — depends on
 * somebody remembering to flip it.
 *
 * Replies are `Comment`s with `targetType: 'thread'`, not a separate type. See
 * `domain/threads.ts` for why.
 */

import type { Comment, CommunityThread } from '@/types';

export const THREADS = [
  // ── Blueprint Vault: the show-off thread ────────────────────────────
  {
    id: 'thr-bv-pulls',
    communityId: 'comm-blueprint-vault',
    userId: 'user-rei',
    title: 'Best blueprint you pulled this season?',
    body: "Post the pull and what it cost you. Crate luck only — no 'I bought the bundle' answers.",
    pinned: false,
    createdAt: '2026-07-28T12:40:00.000Z',
  },
  {
    id: 'thr-bv-rules',
    communityId: 'comm-blueprint-vault',
    userId: 'user-syafiq',
    title: 'Read first: what belongs here',
    body: 'Blueprints and camos. Screenshots welcome, K/D arguments are not. Report anything that looks like an account sale.',
    pinned: true,
    createdAt: '2026-06-02T09:00:00.000Z',
  },

  // ── Knife Collectors: finding people to play with ───────────────────
  {
    id: 'thr-kc-squad',
    communityId: 'comm-knife-collectors',
    userId: 'user-mei',
    title: 'Anyone in SG want to squad up tonight?',
    body: 'Two of us on around 9pm, looking for a third. Not fussed about rank, just want people who talk.',
    pinned: false,
    createdAt: '2026-08-02T14:15:00.000Z',
  },

  // ── Land of Dawn: the moderation case ───────────────────────────────
  {
    id: 'thr-lod-collector',
    communityId: 'comm-land-of-dawn',
    userId: 'user-danish',
    title: 'Which Collector skin is actually worth chasing in 2026?',
    body: 'I have most of the older ones. Trying to work out whether the newer releases hold up or whether I am just chasing the event.',
    pinned: false,
    createdAt: '2026-07-30T18:05:00.000Z',
  },
  {
    id: 'thr-os-rules',
    communityId: 'comm-cross-game',
    userId: 'user-arya',
    title: 'What counts as cross-game here',
    body: 'Two titles minimum in one collection, or it belongs in a game-specific community. Screenshots of the room, not the inventory list — we are here for how it looks, not what it cost.',
    pinned: true,
    createdAt: '2026-05-14T09:00:00.000Z',
  },
  {
    id: 'thr-os-pairings',
    communityId: 'comm-cross-game',
    userId: 'user-zennx',
    title: 'Best pairing across two games you have found?',
    body: 'Elderflame next to a CODM ember blueprint works far better than it should. Post pairings that share a palette but not a franchise.',
    pinned: false,
    createdAt: '2026-07-26T20:15:00.000Z',
  },
  {
    id: 'thr-md-rules',
    communityId: 'comm-mythic-drop',
    userId: 'user-zennx',
    title: 'Post the pull, not the receipt',
    body: 'Mythic and Legendary only. Show what dropped and how many crates it took. No account sales, no trading — both get you removed.',
    pinned: true,
    createdAt: '2026-05-20T08:30:00.000Z',
  },
  {
    id: 'thr-md-luck',
    communityId: 'comm-mythic-drop',
    userId: 'user-syafiq',
    title: 'How deep did you go for your first Mythic?',
    body: 'Took me most of a season to see one. Curious whether that is normal or whether I am just unlucky — post your crate count.',
    pinned: false,
    createdAt: '2026-07-30T19:05:00.000Z',
  },
  {
    id: 'thr-hs-rules',
    communityId: 'comm-hero-skins',
    userId: 'user-priya',
    title: 'Collector, Legend and Epic — that is the scope',
    body: 'Anything below Epic is welcome in the comments but not as a thread. SEA server first, though nobody is checking your region.',
    pinned: true,
    createdAt: '2026-06-01T10:00:00.000Z',
  },
  {
    id: 'thr-hs-worth',
    communityId: 'comm-hero-skins',
    userId: 'user-danish',
    title: 'Which Collector skin actually held its value?',
    body: 'Not asking about resale — asking which ones you still use a year later. Mine is Cyber Faust and it is not close.',
    pinned: false,
    createdAt: '2026-08-01T21:40:00.000Z',
  },
  {
    id: 'thr-vc-rules',
    communityId: 'comm-vandal-club',
    userId: 'user-bo',
    title: 'Vandal lines only',
    body: 'Every Vandal skin line is on topic. Phantom arguments belong in the comments of whichever thread started them, not in a new one.',
    pinned: true,
    createdAt: '2026-05-06T11:20:00.000Z',
  },
  {
    id: 'thr-vc-ranking',
    communityId: 'comm-vandal-club',
    userId: 'user-mei',
    title: 'Rank the Vandal lines, no hedging',
    body: 'One list, top to bottom, no ties. Sound design counts as much as the finish — half the reason to own one is what it does when you fire it.',
    pinned: false,
    createdAt: '2026-07-19T18:55:00.000Z',
  },
  {
    id: 'thr-en-rules',
    communityId: 'comm-epic-nights',
    userId: 'user-nadia',
    title: 'Epics and Specials, nothing rarer',
    body: 'This is the community for the tier everybody actually owns. Collector skins have their own place — post them there.',
    pinned: true,
    createdAt: '2026-06-18T09:45:00.000Z',
  },
  {
    id: 'thr-en-underrated',
    communityId: 'comm-epic-nights',
    userId: 'user-iman',
    title: 'Most underrated Epic in the game?',
    body: 'Looking for the ones that never trend. Bonus points if it is on a hero nobody picks.',
    pinned: false,
    createdAt: '2026-08-03T22:10:00.000Z',
  },
  {
    id: 'thr-st-rules',
    communityId: 'comm-shelf-tours',
    userId: 'user-nova',
    title: 'Post a room, tour two',
    body: 'The deal: share your showroom and visit two others before you post again. A community of people showing and nobody looking is just a gallery with no visitors.',
    pinned: true,
    createdAt: '2026-05-02T08:00:00.000Z',
  },
  {
    id: 'thr-st-lighting',
    communityId: 'comm-shelf-tours',
    userId: 'user-kai',
    title: 'Lighting preset that made your room work?',
    body: 'Same items, different preset, completely different room. Dark cinematic flattered my blades far more than warm gold did — curious what worked for other people.',
    pinned: false,
    createdAt: '2026-07-28T17:30:00.000Z',
  },
  {
    id: 'thr-kc-display',
    communityId: 'comm-knife-collectors',
    userId: 'user-bo',
    title: 'Do you display knives or actually use them?',
    body: 'Mine sit in a room and never leave it. Wondering how many people here equip the thing versus keep it behind glass.',
    pinned: false,
    createdAt: '2026-07-31T20:25:00.000Z',
  },
  {
    id: 'thr-lod-sets',
    communityId: 'comm-land-of-dawn',
    userId: 'user-priya',
    title: 'Which set are you closest to finishing?',
    body: 'Two off a full Collector set and both are from events that have not come back. Post what you are chasing and how close you are.',
    pinned: false,
    createdAt: '2026-08-02T13:15:00.000Z',
  },
] as const satisfies readonly CommunityThread[];

/**
 * Replies. `targetType: 'thread'`, `targetId` is the thread id, and `parentId`
 * is another reply for the single permitted level of nesting.
 */
export const THREAD_REPLIES = [
  // Blueprint Vault — a healthy chain, including one nested reply.
  {
    id: 'cmt-thr-bv-1',
    targetType: 'thread',
    targetId: 'thr-bv-pulls',
    userId: 'user-jovan',
    body: 'Lightbringer, about forty crates in. Still the best thing I own.',
    parentId: null,
    likeCount: 47,
    upvotes: 52,
    downvotes: 3,
    createdAt: '2026-07-28T13:02:00.000Z',
  },
  {
    id: 'cmt-thr-bv-2',
    targetType: 'thread',
    targetId: 'thr-bv-pulls',
    userId: 'user-syafiq',
    body: 'Forty is nothing. I was ninety deep before Cerberus dropped.',
    parentId: 'cmt-thr-bv-1',
    likeCount: 23,
    upvotes: 18,
    downvotes: 6,
    createdAt: '2026-07-28T13:20:00.000Z',
  },
  {
    id: 'cmt-thr-bv-3',
    targetType: 'thread',
    targetId: 'thr-bv-pulls',
    userId: 'user-kai',
    body: 'Ascended, first ten pulls. I have not been that lucky since and I never will be again.',
    parentId: null,
    likeCount: 61,
    upvotes: 74,
    downvotes: 2,
    createdAt: '2026-07-29T08:44:00.000Z',
  },

  // Knife Collectors — the squad-up thread.
  {
    id: 'cmt-thr-kc-1',
    targetType: 'thread',
    targetId: 'thr-kc-squad',
    userId: 'user-kai',
    body: 'I am around after 9. Fair warning, I only play knife-out.',
    parentId: null,
    likeCount: 12,
    upvotes: 14,
    downvotes: 1,
    createdAt: '2026-08-02T15:01:00.000Z',
  },
  {
    id: 'cmt-thr-kc-2',
    targetType: 'thread',
    targetId: 'thr-kc-squad',
    userId: 'user-jovan',
    body: 'Add me, same timezone. I will bring someone who actually aims.',
    parentId: 'cmt-thr-kc-1',
    likeCount: 8,
    upvotes: 9,
    downvotes: 0,
    createdAt: '2026-08-02T15:30:00.000Z',
  },

  // Land of Dawn — a normal reply, then the reported one.
  {
    id: 'cmt-thr-lod-1',
    targetType: 'thread',
    targetId: 'thr-lod-collector',
    userId: 'user-rei',
    body: 'The older ones hold up better. Newer Collector releases lean on the event and the event is over in a fortnight.',
    parentId: null,
    likeCount: 34,
    upvotes: 41,
    downvotes: 4,
    createdAt: '2026-07-30T19:10:00.000Z',
  },
  {
    id: 'cmt-thr-lod-2',
    targetType: 'thread',
    targetId: 'thr-lod-collector',
    userId: 'user-nadia',
    body: 'Agreed, and the older ones show up less in match so they still feel rare.',
    parentId: 'cmt-thr-lod-1',
    likeCount: 15,
    upvotes: 17,
    downvotes: 1,
    createdAt: '2026-07-30T20:02:00.000Z',
  },
  /**
   * ⚠️ THE §8.2 CASE. Reported by two accounts in `FLAGS` (spam + abusive
   * content), which crosses `CONTENT_REPORT_THRESHOLD`. It is withheld from the
   * thread and visible in the review queue at `/moderation` from first launch.
   *
   * Kept mild on purpose: it needs to be obviously rule-breaking without
   * putting real abuse in a fixture anyone might screenshot.
   *
   * Its 1/9 vote tally is deliberate and it does NOT withhold it — the reports
   * do that, on their own, exactly as before. The tally is here so the two
   * mechanisms are visibly independent in the seed: this reply would be buried
   * by votes if it were visible, and it is invisible for a reason that has
   * nothing to do with them. Clear the reports in `/moderation` and it returns
   * to the thread collapsed behind "show", not gone.
   */
  {
    id: 'cmt-thr-lod-3',
    targetType: 'thread',
    targetId: 'thr-lod-collector',
    userId: 'user-arya',
    body: 'Half the collections in here are bought accounts anyway. Come to my server instead, link in my bio, free skins every week.',
    parentId: null,
    likeCount: 0,
    upvotes: 1,
    downvotes: 9,
    createdAt: '2026-08-01T03:22:00.000Z',
  },
] as const satisfies readonly Comment[];

export const THREADS_BY_ID: ReadonlyMap<string, CommunityThread> = new Map(
  THREADS.map((thread) => [thread.id, thread]),
);

/** threadId → its replies, in seeded order. */
export const REPLIES_BY_THREAD: ReadonlyMap<string, readonly Comment[]> = THREAD_REPLIES.reduce(
  (map, reply) => {
    const existing = map.get(reply.targetId);
    if (existing) existing.push(reply);
    else map.set(reply.targetId, [reply]);
    return map;
  },
  new Map<string, Comment[]>(),
);
