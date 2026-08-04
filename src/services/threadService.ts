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
  orderThreads,
  postingBlockedReason,
  validateThread,
  visibleReplies,
} from '@/domain/threads';
import type { ThreadReplyNode, ThreadValidation } from '@/domain/threads';
import type { Comment, CommunityThread } from '@/types';
import { socialService } from './socialService';
import { LATENCY_FETCH, LATENCY_INSTANT, delay } from './latency';

/** Session-scoped threads, layered over the seeds (§12.1 — no backend). */
const created: CommunityThread[] = [];
let nextId = 1;

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
  nodes: ThreadReplyNode[];
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
        nodes: assembleReplies(visible),
        withheldCount,
        blockedCount,
        canReply: canPost(gate),
        postingBlockedReason: postingBlockedReason(gate),
      },
      LATENCY_FETCH,
    );
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
