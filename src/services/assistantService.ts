/**
 * The assistant's service seam — PRD §12.1.
 *
 * Two modes:
 *
 *   offline  the default and what the demo runs on. Answers come from
 *            `domain/assistant` alone: instant, deterministic, no network.
 *   live     `FEATURES.assistantChat` is on AND the proxy URL is set. Questions
 *            the snapshot cannot answer go to the model; everything else is
 *            still answered locally.
 *
 * ── There is no key in this file, and there must never be ─────────────────
 * The Gemini path this replaced read `EXPO_PUBLIC_GEMINI_API_KEY`, and every
 * `EXPO_PUBLIC_*` value is inlined into the shipped JavaScript where anyone with
 * the app can read it. That was an accepted trade for a free-tier key; it is not
 * one for a billed Anthropic key. The key lives in the serverless function's
 * environment and the client only ever knows a URL — see `api/assistant.ts`.
 *
 * ── Local answers are tried FIRST, in both modes ──────────────────────────
 * Most questions about the user's own account are arithmetic over data already
 * in memory. Answering those from a model would be slower, less reliable and
 * pointless — and it is why the flag being off is a complete feature rather
 * than a broken one.
 *
 * ── Rate limiting ─────────────────────────────────────────────────────────
 * Client-side limiting is not a security control — anyone can edit the client —
 * but it is the control that matters for the failure this app will actually
 * hit: a demo tapping Send repeatedly, or a render loop, burning quota in a
 * minute. It applies only to calls that reach the model.
 */

import {
  answerLocally,
  buildContext,
  guardrail,
  MAX_QUESTION_LENGTH,
} from '@/domain/assistant';
import type { AssistantAnswer, AssistantContext } from '@/domain/assistant';
import { MIN_ROOM_ITEMS } from '@/domain/trust';
import { DEMO_NOW, FEATURES } from '@/config/features';
import { GAME_LABELS, GAME_TITLES } from '@/types';
import { catalogueService } from './catalogueService';
import { collectionService } from './collectionService';
import { inventoryService } from './inventoryService';
import { matchService } from './matchService';
import { newsService } from './newsService';
import { roomService } from './roomService';
import { socialService } from './socialService';
import { threadService } from './threadService';
import { delay, LATENCY_FETCH } from './latency';

export type AssistantMode = 'offline' | 'live';

/**
 * The deployed proxy — the SAME endpoint the summariser and the news digest
 * use, because it is the same function with a different `mode`. One URL to
 * configure, one deploy to get right.
 */
const AI_PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL ?? '';

/** Requests allowed per rolling window, and the window. Deliberately tight. */
const RATE_LIMIT = { requests: 8, windowMs: 60_000 };

/** Minimum gap between calls — catches a double-tap or a render loop. */
const MIN_INTERVAL_MS = 1_500;

/**
 * Model calls are abandoned rather than left hanging behind a spinner.
 *
 * Longer than the summariser's 5s because a chat answer is worth a little more
 * waiting than four bullets are, and shorter than the 12s this replaced because
 * the thing on the other side of the wait is a sentence, not a page.
 */
const TIMEOUT_MS = 8_000;

const recentCalls: number[] = [];
let lastCallAt = 0;

/** A turn of the session's conversation. Held by the panel, never persisted. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * What the assistant says when the model did not answer — flag off, no
 * endpoint, timeout, refusal, or a malformed reply. One message for all of
 * them, because the user's next move is the same in every case.
 *
 * It names what the assistant CAN do rather than what failed. "I can't answer
 * right now" with no route forward is a dead end; this is a redirect.
 */
const OFFLINE_FALLBACK: AssistantAnswer = {
  text:
    'I cannot answer that one right now. Ask me about your items, verification, collections, ' +
    'Showrooms, matches, communities or the latest news and I can answer straight away.',
  source: 'local',
};

export function assistantMode(): AssistantMode {
  return FEATURES.assistantChat && AI_PROXY_URL.length > 0 ? 'live' : 'offline';
}

/** Remaining calls in the current window. Shown in the UI so limits are visible. */
export function remainingCalls(): number {
  prune();
  return Math.max(0, RATE_LIMIT.requests - recentCalls.length);
}

function prune() {
  const cutoff = Date.now() - RATE_LIMIT.windowMs;
  while (recentCalls.length > 0 && recentCalls[0]! < cutoff) recentCalls.shift();
}

/** Null when allowed; otherwise the reason, ready to show the user. */
function rateLimit(): string | null {
  prune();
  const now = Date.now();

  if (now - lastCallAt < MIN_INTERVAL_MS) {
    return 'One moment — give it a second between questions.';
  }
  if (recentCalls.length >= RATE_LIMIT.requests) {
    const oldest = recentCalls[0]!;
    const waitS = Math.ceil((RATE_LIMIT.windowMs - (now - oldest)) / 1000);
    return `That is ${RATE_LIMIT.requests} questions in a minute — give it ${waitS}s.`;
  }
  return null;
}

/**
 * Assemble the snapshot from the app's own service seams.
 *
 * Everything here goes through a service, never a fixture — the house rule, and
 * for the usual reason: the demo's most interesting minute is the one where
 * items are imported and an account is linked, and a fixture read makes all of
 * it invisible. An assistant that says "you own 12 items" straight after the
 * user imported three more is worse than one that says nothing.
 *
 * One pass, everything in parallel, then shaped by `domain/assistant`. Reads
 * that fail are not caught individually: `snapshot` is called before the panel
 * opens, and a caller with no snapshot shows the offline answerer.
 */
async function snapshot(viewerId: string): Promise<AssistantContext> {
  const [
    viewer,
    owned,
    catalogue,
    collections,
    themes,
    followers,
    following,
    matchState,
    recommendations,
    communities,
    saved,
    unreadNotificationCount,
    headlineFeed,
  ] = await Promise.all([
    socialService.getUser(viewerId),
    inventoryService.getOwnedItems(viewerId),
    catalogueService.getCatalogueMap(),
    collectionService.getCollectionsByUser(viewerId, true),
    roomService.getThemes(),
    socialService.getFollowers(viewerId),
    socialService.getFollowing(viewerId),
    matchService.getViewerMatchState(viewerId),
    matchService.getRecommendedCollectors(viewerId),
    matchService.getCommunities(),
    newsService.getSaved(viewerId),
    socialService.getUnreadCount(viewerId),
    newsService.getFyp(viewerId, DEMO_NOW, 5),
  ]);

  // Keyed by collection across ALL users, so it is filtered to the viewer's own
  // collections before anything is counted from it. `roomStatus.size` would be
  // every room in the app, and the assistant would tell the user they have
  // showrooms belonging to other people.
  const roomStatus = await roomService.statusByCollection();
  const collectionIdsWithRooms = collections
    .filter((collection) => roomStatus.get(collection.id) !== undefined)
    .map((collection) => collection.id);

  /* Room eligibility used to be counted here. It now lives in
     `buildAssistantContext`, which has both the collections and the owned items
     and so can mark each collection eligible AND total them from the same pass.
     Counting it here as well meant §9.4's threshold was applied in two places
     against two different reads of "verified". */

  // Threads from the communities the viewer is actually in — the ones they
  // might ask about. Titles only; bodies stay on the device.
  const joined = communities.filter((community) => socialService.isMember(viewerId, community.id));
  const threadLists = await Promise.all(
    joined.map(async (community) => {
      const threads = await threadService.getThreads(community.id);
      return threads.map((summary) => ({
        title: summary.thread.title,
        community: community.name,
        replyCount: summary.replyCount,
        lastActivityAt: summary.lastActivityAt,
      }));
    }),
  );
  const threads = threadLists
    .flat()
    .sort((a, b) => Date.parse(b.lastActivityAt) - Date.parse(a.lastActivityAt))
    .map(({ title, community, replyCount }) => ({ title, community, replyCount }));

  const digests = await Promise.all(
    GAME_TITLES.map(async (title) => ({
      game: GAME_LABELS[title],
      bullets: (await newsService.getDigest(title)).bullets,
    })),
  );

  return buildContext({
    viewer,
    owned,
    catalogue,
    collections,
    collectionIdsWithRooms,
    showroomCount: collectionIdsWithRooms.length,
    followerCount: followers.length,
    followingCount: following.length,
    themes,
    linkedTitles: GAME_TITLES.filter(
      (title) => inventoryService.getLinkStatus(viewerId, title) === 'linked',
    ),
    titleLabels: GAME_LABELS,
    matchState,
    // The reason travels with the score, always (§11 F5). This is the surface
    // where someone asks "why is Arya my top match?" in as many words.
    matches: recommendations.map((entry) => ({
      handle: entry.user.handle,
      displayName: entry.user.displayName,
      percent: entry.percent,
      reason: entry.reason,
      sharedItemCount: entry.sharedItems.length,
    })),
    communities: communities.map((community) => ({
      name: community.name,
      memberCount: socialService.memberCountFor(community),
      joined: socialService.isMember(viewerId, community.id),
    })),
    threads,
    digests,
    headlines: headlineFeed.map((entry) => ({
      title: entry.article.title,
      game: entry.article.relatedGames.map((g) => GAME_LABELS[g]).join(', '),
      reason: entry.reason,
    })),
    savedArticleCount: saved.length,
    unreadNotificationCount,
  });
}

export const assistantService = {
  buildContext,
  snapshot,
  mode: assistantMode,
  remainingCalls,
  maxQuestionLength: MAX_QUESTION_LENGTH,

  /**
   * Ask a question.
   *
   * Order is deliberate: guardrail, then local answer, then rate limit, then
   * model. Rate limiting sits AFTER the local attempt so the limit only ever
   * applies to calls that actually cost something — a user asking "how many
   * items do I own" ten times in a row is not rate limited, because none of
   * those touched a model.
   */
  async ask(
    question: string,
    context: AssistantContext,
    history: readonly ChatTurn[] = [],
  ): Promise<AssistantAnswer> {
    const rejected = guardrail(question);
    if (rejected) return delay({ text: rejected, source: 'local' }, LATENCY_FETCH);

    const local = answerLocally(question, context);
    if (local) return delay(local, LATENCY_FETCH);

    if (assistantMode() === 'offline') return delay(OFFLINE_FALLBACK, LATENCY_FETCH);

    const limited = rateLimit();
    if (limited) return { text: limited, source: 'local' };

    recentCalls.push(Date.now());
    lastCallAt = Date.now();

    // Null on ANY failure — timeout, network, non-200, refusal, malformed body.
    // The panel must never show a broken state because of this feature (§12.1),
    // so there is exactly one thing to do when the model does not answer, and
    // it is the same thing the flag being off does.
    const answer = await callChat(question, context, history);
    return answer ? { text: answer, source: 'model' } : OFFLINE_FALLBACK;
  },
};

/**
 * Call the proxy. Returns null on ANY failure.
 *
 * No error detail reaches the caller. A raw network error can carry the
 * endpoint, and there is nothing a user can do with "502" that they cannot do
 * with a sentence telling them what the assistant CAN answer.
 *
 * The prompt, the grounding rule and the injection fencing all live on the
 * server (`api/assistant.ts`), where a client edit cannot reach them.
 */
async function callChat(
  question: string,
  context: AssistantContext,
  history: readonly ChatTurn[],
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        mode: 'chat',
        question: question.slice(0, MAX_QUESTION_LENGTH),
        snapshot: context,
        history,
      }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { text?: unknown };
    if (typeof payload.text !== 'string') return null;

    const text = payload.text.trim();
    return text.length > 0 ? text : null;
  } catch {
    // Includes the abort. Deliberately swallowed — see the doc comment.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
