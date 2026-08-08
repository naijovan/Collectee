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

/* ────────────────────────────────────────────────────────────────────────────
 * Reply voting (§11 F5 discussion)
 *
 * ── Voting is not moderation, and this file keeps them apart ──────────────
 * A downvote is a preference; a report is a moderation signal. They travel
 * through different code and must not be made to approximate each other:
 * `visibleReplies` above decides what a viewer may SEE, from blocks and the
 * report threshold, and nothing below changes that. The functions here only
 * decide what ORDER the already-visible replies appear in and which of them are
 * de-emphasised. A reply buried by votes is still rendered, still readable
 * behind one tap, and still not reported; a reply withheld by reports never
 * reaches this code at all, whatever its score.
 * ──────────────────────────────────────────────────────────────────────────*/

/** A viewer's own vote on one reply. `null` is "has not voted". */
export type VoteDirection = 'up' | 'down' | null;

/**
 * Net score at or below which a reply is folded away behind a "show" control.
 *
 * -3 rather than -1: a single downvote is one person disagreeing, and hiding a
 * reply for that would let one tap silence someone, which is the thing
 * moderation is for and voting is not. Three net down is a small crowd.
 */
export const BURY_AT = -3;

/**
 * The next vote state, given what the viewer has and what they just pressed.
 *
 * Pressing the side you already hold clears it — that is the toggle. Pressing
 * the other side moves straight to it rather than clearing first, so a switch
 * is one tap and cannot leave a stale half-state. Returning a direction rather
 * than mutating a tally is what makes double-counting impossible: the score is
 * always recomputed from the seed plus exactly one direction.
 */
export function nextVote(current: VoteDirection, pressed: 'up' | 'down'): VoteDirection {
  return current === pressed ? null : pressed;
}

/** Seeded tallies, defaulted. Absent means an unvoted surface — see `Comment`. */
function seeded(reply: Comment): { up: number; down: number } {
  return { up: reply.upvotes ?? 0, down: reply.downvotes ?? 0 };
}

/**
 * The score to display: the seed, plus this viewer's own vote.
 *
 * Derived on every read rather than stored, for the same reason the Import
 * counts are: a stored total is a second source of truth that can drift from
 * the votes it claims to summarise.
 */
export function replyScore(reply: Comment, vote: VoteDirection): number {
  const { up, down } = seeded(reply);
  return up - down + (vote === 'up' ? 1 : vote === 'down' ? -1 : 0);
}

/** Totals including the viewer's vote — what the Wilson bound is computed over. */
function tallies(reply: Comment, vote: VoteDirection): { up: number; down: number } {
  const { up, down } = seeded(reply);
  return {
    up: up + (vote === 'up' ? 1 : 0),
    down: down + (vote === 'down' ? 1 : 0),
  };
}

/**
 * Wilson lower bound on the proportion of upvotes, at 95% confidence.
 *
 * ── Why this and not net score, and not a recency decay ───────────────────
 * Net score alone lets +3/-0 outrank +40/-8, which is the wrong way round: the
 * second reply has forty people behind it and the first has three. Wilson asks
 * a better question — "given this many votes, what is the lowest share of
 * approval consistent with the evidence?" — so a small unanimous score is
 * treated as promising but unproven, and it is precisely the SMALL-n case it
 * exists to handle, which is the case a seeded demo thread is made of.
 *
 * A Hacker-News-style recency decay was the other candidate and is wrong here
 * for two reasons. It would reorder a conversation as the clock moved, so a
 * rehearsal and the live run would not match — the same objection that put
 * `DEMO_NOW` in `config/features`. And a thread is not a front page: replies
 * answer each other, so "newest floats up" actively damages readability.
 *
 * Chronology is not discarded, it is scoped: ROOTS sort by this, and children
 * stay in time order underneath their parent. That is what keeps a reply and
 * the answer to it adjacent, and it is the same split Reddit settled on.
 */
export function wilsonLowerBound(up: number, down: number): number {
  const n = up + down;
  if (n === 0) return 0;
  const z = 1.96;
  const p = up / n;
  const denominator = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);
  return (centre - margin) / denominator;
}

/** A reply with everything the row needs, already decided. */
export interface RankedReply {
  reply: Comment;
  /** This viewer's vote, for the pressed state on the arrows. */
  vote: VoteDirection;
  score: number;
  /** True once `score <= BURY_AT`. De-emphasised, never removed. */
  buried: boolean;
  children: RankedReply[];
}

/**
 * Order a thread's assembled replies for display.
 *
 * Roots by Wilson bound, descending, with two deliberate overrides:
 *
 *  - Buried roots sink below every unburied one regardless of bound. A reply on
 *    -6 should not sit mid-list because its handful of votes happen to give it
 *    a middling interval.
 *  - Ties break OLDEST first, not newest. Two replies with no votes are the
 *    common case in a fresh thread, and chronological is the only order that
 *    reads as a conversation.
 *
 * Children keep their time order untouched.
 */
export function rankReplies(
  nodes: readonly ThreadReplyNode[],
  voteFor: (commentId: string) => VoteDirection,
): RankedReply[] {
  const decorate = (reply: Comment): Omit<RankedReply, 'children'> => {
    const vote = voteFor(reply.id);
    const score = replyScore(reply, vote);
    return { reply, vote, score, buried: score <= BURY_AT };
  };

  return nodes
    .map((node) => ({
      ...decorate(node.reply),
      children: node.children.map((child) => ({ ...decorate(child), children: [] })),
    }))
    .sort((a, b) => {
      if (a.buried !== b.buried) return a.buried ? 1 : -1;
      const at = tallies(a.reply, a.vote);
      const bt = tallies(b.reply, b.vote);
      const delta = wilsonLowerBound(bt.up, bt.down) - wilsonLowerBound(at.up, at.down);
      if (delta !== 0) return delta;
      return Date.parse(a.reply.createdAt) - Date.parse(b.reply.createdAt);
    });
}
