/**
 * Community threads — PRD §11 F5. Flow owner: Marcus (J4).
 *
 * Threads are the social heart of a community: a place to show off a pull,
 * argue about a patch, or find people to play with. Everything here is pure —
 * no I/O, no fixtures, no service calls (see CLAUDE.md).
 *
 * Two structural decisions live in this file and nowhere else:
 *
 *   1. **A reply is a `Comment`,** with `targetType: 'thread'`. There is no
 *      `ThreadReply` type. That means blocked-author filtering, reporting into
 *      the §9.2 review queue and `parentId` nesting are the same code paths
 *      threads share with collection comments.
 *   2. **One level of nesting.** A reply may point at another reply; nothing
 *      points at that. Full Reddit trees cost fixture and layout complexity a
 *      four-minute demo cannot spend, and depth beyond one adds no legibility.
 *
 * Moderation is not an afterthought here (§8.2): `visibleReplies` takes the
 * viewer's block list and the review queue as inputs, so a screen cannot render
 * a thread without deciding what it hides.
 */

import type { Comment, CommunityThread, IsoDateString } from '@/types';

/** Longest a title may be. Long enough for a real question, short enough to scan. */
export const THREAD_TITLE_MAX = 120;
export const THREAD_BODY_MAX = 2000;

export interface ThreadValidation {
  valid: boolean;
  /** Field-level messages, empty when valid. */
  errors: string[];
}

export function validateThread(input: { title: string; body: string }): ThreadValidation {
  const errors: string[] = [];
  const title = input.title.trim();
  const body = input.body.trim();

  if (title.length === 0) errors.push('A thread needs a title.');
  if (title.length > THREAD_TITLE_MAX) {
    errors.push(`Title is ${title.length} characters; the limit is ${THREAD_TITLE_MAX}.`);
  }
  if (body.length > THREAD_BODY_MAX) {
    errors.push(`Body is ${body.length} characters; the limit is ${THREAD_BODY_MAX}.`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Thread ordering: pinned first, then newest.
 *
 * Deliberately NOT ranked by replies or likes. §11 F5 says Home is seeded and
 * static with no ranking algorithm, and inventing engagement ranking for
 * threads would be the same overclaim in a smaller box — recency is honest and
 * needs no explanation on stage.
 */
export function orderThreads(threads: readonly CommunityThread[]): CommunityThread[] {
  return [...threads].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

/** A reply plus the replies to it. One level, by construction. */
export interface ThreadReplyNode {
  reply: Comment;
  children: Comment[];
}

/**
 * Assemble a flat comment list into the one-level shape a thread renders.
 *
 * Anything whose parent is missing — hidden by a block, removed, or pointing at
 * a reply that was itself nested — is promoted to top level rather than
 * dropped. Losing a reply because its parent is invisible to *this* viewer
 * would silently delete half a conversation.
 */
export function assembleReplies(replies: readonly Comment[]): ThreadReplyNode[] {
  const byId = new Map(replies.map((reply) => [reply.id, reply]));
  const roots: Comment[] = [];
  const childrenOf = new Map<string, Comment[]>();

  for (const reply of replies) {
    const parent = reply.parentId ? byId.get(reply.parentId) : undefined;
    if (!parent) {
      roots.push(reply);
      continue;
    }
    // A parent that is itself a child would make depth 2 — flatten it up.
    const grandparent = parent.parentId ? byId.get(parent.parentId) : undefined;
    const anchorId = grandparent ? parent.parentId! : parent.id;
    childrenOf.set(anchorId, [...(childrenOf.get(anchorId) ?? []), reply]);
  }

  const byOldest = (a: Comment, b: Comment) => Date.parse(a.createdAt) - Date.parse(b.createdAt);

  return roots.sort(byOldest).map((reply) => ({
    reply,
    children: (childrenOf.get(reply.id) ?? []).sort(byOldest),
  }));
}

/**
 * What this viewer may see (§11 F5 moderation, §8.2).
 *
 * Blocked authors disappear for the blocker alone. Content past the report
 * threshold is WITHHELD, not deleted — §9.2 is explicit that flags never
 * auto-remove, so the reply stays in the data and the thread says something is
 * missing rather than pretending it never existed.
 */
export interface ReplyVisibility {
  visible: Comment[];
  /** Count withheld pending review, so the UI can say so out loud. */
  withheldCount: number;
  /** Count hidden by this viewer's own block list. */
  blockedCount: number;
}

export function visibleReplies(
  replies: readonly Comment[],
  options: {
    blockedUserIds: ReadonlySet<string>;
    isUnderReview: (commentId: string) => boolean;
  },
): ReplyVisibility {
  let withheldCount = 0;
  let blockedCount = 0;
  const visible: Comment[] = [];

  for (const reply of replies) {
    if (options.blockedUserIds.has(reply.userId)) {
      blockedCount += 1;
      continue;
    }
    if (options.isUnderReview(reply.id)) {
      withheldCount += 1;
      continue;
    }
    visible.push(reply);
  }

  return { visible, withheldCount, blockedCount };
}

/**
 * Who may post (§14 rung 3: "join/view only, no posting" when descoped).
 *
 * Reading is never gated — a descoped build still shows seeded conversations,
 * which is the difference between a quiet community and a broken one.
 */
export function canPost(options: { isMember: boolean; postingEnabled: boolean }): boolean {
  return options.isMember && options.postingEnabled;
}

/** Why posting is unavailable, for a UI that has to say something truthful. */
export function postingBlockedReason(options: {
  isMember: boolean;
  postingEnabled: boolean;
}): string | null {
  if (!options.postingEnabled) return 'Posting is turned off for this build.';
  if (!options.isMember) return 'Join this community to start a thread or reply.';
  return null;
}

/** Reply count for a thread card. Counts everything, including withheld. */
export function replyCount(replies: readonly Comment[]): number {
  return replies.length;
}

/** Most recent activity — the thread's own creation, or its newest reply. */
export function lastActivityAt(
  thread: CommunityThread,
  replies: readonly Comment[],
): IsoDateString {
  return replies.reduce(
    (latest, reply) => (Date.parse(reply.createdAt) > Date.parse(latest) ? reply.createdAt : latest),
    thread.createdAt,
  );
}
