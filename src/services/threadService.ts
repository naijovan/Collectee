/**
 * Community threads — PRD §11 F5. Flow owner: Marcus (J4).
 *
 * Screens read from here, never from `@/fixtures/threads` (§12.1). Every method
 * returns a Promise even though the data is local, so phase 2 swaps a fixture
 * for a fetch inside this file and nothing else moves.
 *
 * What this service does NOT own:
 *
 *   - **Replies.** A reply is a `Comment` with `targetType: 'thread'`, stored
 *     and read through `socialService`. That is what gives threads
 *     blocked-author filtering and reporting into the §9.2 review queue for
 *     free. `getThreadView` composes the two rather than duplicating either.
 *   - **Moderation rules.** Thresholds and visibility live in `domain/trust.ts`
 *     and `domain/threads.ts`. This file asks; it does not decide.
 *
 * §14 rung 3: posting is gated behind `FEATURES.communityPosting`. Reading
 * never is — a descoped build still shows seeded conversations, which is the
 * difference between a quiet community and a broken one.
 */

import { REPLIES_BY_THREAD, THREADS, THREADS_BY_ID } from '@/fixtures/threads';
import { FEATURES } from '@/config/features';
import {
  assembleReplies,
  canPost,
  lastActivityAt,
  nextVote,
  orderThreads,
  postingBlockedReason,
  rankReplies,
  validateThread,
  visibleReplies,
} from '@/domain/threads';
import type { RankedReply, ThreadValidation, VoteDirection } from '@/domain/threads';
import type { Comment, CommunityThread } from '@/types';
import { socialService } from './socialService';
import { LATENCY_FETCH, LATENCY_INSTANT, delay } from './latency';

/** Session-scoped threads, layered over the seeds (§12.1 — no backend). */
const created: CommunityThread[] = [];
let nextId = 1;

/**
 * Who voted what, this session only.
 *
 * Keyed `userId::commentId` so one viewer holds at most one vote per reply by
 * construction — the "no double-counting" rule is the shape of the store rather
 * than something the callers have to remember. The seeded tallies on the
 * fixture are never touched (§12.1): a displayed score is always the seed plus
 * whatever this map holds, recomputed on read.
 *
 * Cleared by nothing but a reload, like every other session overlay here.
 */
const replyVotes = new Map<string, Exclude<VoteDirection, null>>();

const voteKey = (userId: string, commentId: string) => `${userId}::${commentId}`;

function allThreads(): CommunityThread[] {
  return [...THREADS, ...created];
}

/** A thread card: the thread plus the numbers a list needs. */
export interface ThreadSummary {
  thread: CommunityThread;
  author: { id: string; displayName: string; handle: string } | null;
  replyCount: number;
  lastActivityAt: string;
}

/** A thread page: everything resolved, with what was hidden accounted for. */
export interface ThreadView {
  thread: CommunityThread;
  /**
   * Replies already ordered and scored — roots by Wilson bound, children in
   * time order, buried ones last. See `domain/threads.rankReplies`.
   *
   * Ranked here rather than in the screen so the ordering is one pure function
   * with the rest of the app's ranking, and so a screen cannot accidentally
   * render an order the domain did not choose.
   */
  ranked: RankedReply[];
  /** Replies withheld pending review — surfaced, never silently dropped (§9.2). */
  withheldCount: number;
  /** Replies hidden by this viewer's own block list. */
  blockedCount: number;
  canReply: boolean;
  postingBlockedReason: string | null;
}

/**
 * Every reply on a thread, UNFILTERED.
 *
 * Deliberately no `viewerId`: `socialService.getComments` would strip blocked
 * authors here, and then `visibleReplies` — the one place that is supposed to
 * decide what a viewer sees — would count zero blocked replies while replies
 * were quietly missing. One filter, in the domain, where the counts are
 * reported from.
 */
async function repliesFor(threadId: string): Promise<Comment[]> {
  const fromStore = await socialService.getComments('thread', threadId);
  return fromStore.length > 0 ? fromStore : [...(REPLIES_BY_THREAD.get(threadId) ?? [])];
}

export const threadService = {
  /** Threads in a community, pinned first then newest (`domain/threads`). */
  async getThreads(communityId: string): Promise<ThreadSummary[]> {
    const inCommunity = allThreads().filter((thread) => thread.communityId === communityId);

    const summaries = await Promise.all(
      orderThreads(inCommunity).map(async (thread) => {
        const replies = await repliesFor(thread.id);
        const author = await socialService.getUser(thread.userId);
        return {
          thread,
          author: author
            ? { id: author.id, displayName: author.displayName, handle: author.handle }
            : null,
          // Counts everything including withheld replies: hiding the count as
          // well as the content tells the reader less than the truth.
          replyCount: replies.length,
          lastActivityAt: lastActivityAt(thread, replies),
        };
      }),
    );

    return delay(summaries, LATENCY_FETCH);
  },

  async getThread(threadId: string): Promise<CommunityThread | null> {
    const found =
      created.find((thread) => thread.id === threadId) ?? THREADS_BY_ID.get(threadId) ?? null;
    return delay(found, LATENCY_INSTANT);
  },

  /**
   * A thread with its replies, assembled and filtered for one viewer.
   *
   * Moderation is applied here rather than left to the screen: `visibleReplies`
   * needs the block list and the review queue, and a screen that had to
   * assemble those itself would eventually render a thread without them.
   */
  async getThreadView(threadId: string, viewerId: string): Promise<ThreadView | null> {
    const thread = await this.getThread(threadId);
    if (!thread) return delay(null, LATENCY_INSTANT);

    const replies = await repliesFor(threadId);
    const { visible, withheldCount, blockedCount } = visibleReplies(replies, {
      blockedUserIds: socialService.blockedBy(viewerId),
      isUnderReview: (commentId) => socialService.isUnderReview(commentId),
    });

    const isMember = socialService.isMember(viewerId, thread.communityId);
    const gate = { isMember, postingEnabled: FEATURES.communityPosting };

    return delay(
      {
        thread,
        /* `visible` first, then rank. Order matters and not only for tidiness:
           ranking never sees a withheld or blocked reply, so a vote score can
           never bring one back into the thread. */
        ranked: rankReplies(assembleReplies(visible), (commentId) =>
          replyVotes.get(voteKey(viewerId, commentId)) ?? null,
        ),
        withheldCount,
        blockedCount,
        canReply: canPost(gate),
        postingBlockedReason: postingBlockedReason(gate),
      },
      LATENCY_FETCH,
    );
  },

  /**
   * Cast, clear or switch this viewer's vote on one reply.
   *
   * Takes the direction PRESSED, not the direction wanted — `nextVote` in the
   * domain decides what that means against what is already held, so the toggle
   * and the switch rules live with the rest of the vote logic instead of in a
   * screen. Returns the resulting direction so the caller can render the
   * pressed state without a refetch.
   *
   * Deliberately does nothing about reports. A downvote is a preference; if the
   * viewer wants this reply looked at, that is `report` below, and the two
   * never touch.
   */
  async voteOnReply(
    viewerId: string,
    commentId: string,
    pressed: 'up' | 'down',
  ): Promise<VoteDirection> {
    const key = voteKey(viewerId, commentId);
    const next = nextVote(replyVotes.get(key) ?? null, pressed);
    if (next === null) replyVotes.delete(key);
    else replyVotes.set(key, next);
    return delay(next, LATENCY_INSTANT);
  },

  /** Whether this viewer may start a thread here, and why not if not. */
  canPostIn(viewerId: string, communityId: string): { allowed: boolean; reason: string | null } {
    const gate = {
      isMember: socialService.isMember(viewerId, communityId),
      postingEnabled: FEATURES.communityPosting,
    };
    return { allowed: canPost(gate), reason: postingBlockedReason(gate) };
  },

  validate(input: { title: string; body: string }): ThreadValidation {
    return validateThread(input);
  },

  /**
   * Start a thread. Rejects rather than silently trimming: a caller that
   * ignored `validate` should find out, and §14 rung 3 means a non-member
   * reaching this point is a bug in the screen, not a case to absorb.
   */
  async createThread(params: {
    communityId: string;
    userId: string;
    title: string;
    body: string;
  }): Promise<CommunityThread> {
    const gate = this.canPostIn(params.userId, params.communityId);
    if (!gate.allowed) throw new Error(gate.reason ?? 'Posting is not available here.');

    const validation = validateThread(params);
    if (!validation.valid) throw new Error(validation.errors.join(' '));

    const thread: CommunityThread = {
      id: `thr-new-${nextId++}`,
      communityId: params.communityId,
      userId: params.userId,
      title: params.title.trim(),
      body: params.body.trim(),
      pinned: false,
      createdAt: new Date().toISOString(),
    };
    created.push(thread);
    return delay(thread, LATENCY_FETCH);
  },

  /**
   * Reply to a thread, or to a reply.
   *
   * `parentId` is passed through to `socialService`; `domain/threads` caps the
   * rendered depth at one level, so a reply to a reply-of-a-reply is stored
   * honestly and displayed against its grandparent rather than being rejected
   * at write time.
   */
  async addReply(params: {
    threadId: string;
    userId: string;
    body: string;
    parentId?: string | null;
  }): Promise<Comment> {
    const thread = await this.getThread(params.threadId);
    if (!thread) throw new Error(`Unknown thread "${params.threadId}"`);

    const gate = this.canPostIn(params.userId, thread.communityId);
    if (!gate.allowed) throw new Error(gate.reason ?? 'Posting is not available here.');
    if (params.body.trim().length === 0) throw new Error('A reply needs a body.');

    return socialService.addComment({
      targetType: 'thread',
      targetId: params.threadId,
      userId: params.userId,
      body: params.body.trim(),
      parentId: params.parentId ?? null,
    });
  },

  /** Report a thread or a reply into the §9.2 queue. Content reasons, content threshold. */
  async report(params: {
    targetType: 'thread' | 'comment';
    targetId: string;
    reporterId: string;
    reason: 'abusive_content' | 'spam';
  }): Promise<void> {
    await socialService.raiseFlag(params);
  },
};

export type ThreadService = typeof threadService;
