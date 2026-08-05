/**
 * The in-app assistant — context building, guardrails and deterministic answers.
 *
 * Pure logic, no I/O, per the architecture note in CLAUDE.md. The service layer
 * decides whether an answer comes from here or from a model; this file decides
 * WHAT the assistant is allowed to know and say.
 *
 * ── Why there is a deterministic answerer at all ──────────────────────────
 * §12.1: the demo runs on conference wifi in four minutes with no network. An
 * assistant that needs a model call to answer "how many items do I own" is a
 * worse demo than one that answers instantly and offline — and every question
 * about the user's own app state is arithmetic over data already in memory.
 *
 * So the model is the fallback, not the engine. It handles phrasing the local
 * answers cannot, and it is optional.
 *
 * ── The context is a snapshot, not a database handle ──────────────────────
 * `buildContext` produces a small, flat, already-redacted object. Whatever goes
 * in it is what leaves the device if a proxy is configured, so the shape is the
 * privacy boundary and it is deliberately narrow: counts, names the user
 * already published, and nothing else. No emails, no ids, no tokens.
 */

import type { Collection, Item, OwnedItem, RoomTheme, User } from '@/types';
import { RARITY_RANK } from './rarity';

/** Hard cap on a question. Longer inputs are prompt-stuffing, not questions. */
export const MAX_QUESTION_LENGTH = 400;

/**
 * What the assistant is allowed to know. Everything here may leave the device.
 *
 * ── Read this before adding a field ───────────────────────────────────────
 * Two budgets, and they pull in opposite directions.
 *
 * PRIVACY. This object is the boundary. No ids, no emails, no tokens, no
 * acquisition dates, and nothing about another user beyond what they already
 * published — a handle, a display name, a member count. If an answer needs more,
 * add the one field, never the whole record.
 *
 * PRECISION. Roughly 3 KB of JSON. Not a context limit — Haiku holds 200K — but
 * every irrelevant field is one more thing for the model to confuse with the one
 * fact the question needed. The catalogue, individual owned-item rows, thread
 * bodies and article bodies are all deliberately absent; counts and titles carry
 * every question we have seen asked.
 *
 * ⚠️ Some of these strings were typed by other people — collection and community
 * names, thread and article titles. The proxy treats the whole snapshot as
 * untrusted content for that reason (see CHAT_SYSTEM_PROMPT).
 */
export interface AssistantContext {
  handle: string;
  displayName: string;

  // ── Inventory ──────────────────────────────────────────────────────────
  itemCount: number;
  verifiedCount: number;
  unverifiedCount: number;
  /** Per game: what is owned, what is verified, and whether an account is linked. */
  titles: {
    title: string;
    label: string;
    count: number;
    verifiedCount: number;
    accountLinked: boolean;
  }[];
  rarity: { tier: string; count: number }[];
  topItems: string[];

  // ── Collections and rooms ──────────────────────────────────────────────
  collections: { name: string; itemCount: number; visibility: string; hasRoom: boolean }[];
  showroomCount: number;
  /** Collections holding enough verified items to build a Showroom (§9.4). */
  roomEligibleCollections: number;
  themes: string[];

  // ── Social ─────────────────────────────────────────────────────────────
  followerCount: number;
  followingCount: number;

  // ── Matching (§11 F5) ──────────────────────────────────────────────────
  /** Why matching is in the state it is. 'unverified-only' is not a cold start. */
  matchState: 'cold-start' | 'unverified-only' | 'ready';
  /**
   * The reason carried WITH the score, every time.
   *
   * §11 F5 is explicit that a percentage without its reason is a broken
   * feature. The assistant is the one surface where a user asks the question
   * outright — "why is Arya my top match?" — so the reason has to be in the
   * snapshot, or the assistant either says nothing or makes one up.
   */
  matches: {
    handle: string;
    displayName: string;
    percent: number;
    reason: string;
    sharedItemCount: number;
  }[];

  // ── Communities and threads ────────────────────────────────────────────
  communities: { name: string; memberCount: number; joined: boolean }[];
  /** Titles only. Bodies are user-authored prose and stay on the device. */
  threads: { title: string; community: string; replyCount: number }[];

  // ── News (§11 F6) ──────────────────────────────────────────────────────
  digests: { game: string; bullets: string[] }[];
  headlines: { title: string; game: string; reason: string | null }[];
  savedArticleCount: number;

  // ── Notifications ──────────────────────────────────────────────────────
  unreadNotificationCount: number;
}

/** Caps on the list fields. Enough to answer with; short enough to stay legible. */
const MAX_MATCHES = 5;
const MAX_COMMUNITIES = 5;
const MAX_THREADS = 5;
const MAX_HEADLINES = 5;
const MAX_TOP_ITEMS = 5;

/**
 * Everything the snapshot is built from, already read through the service
 * seams by `assistantService.snapshot`.
 *
 * The mapping lives there and the shaping lives here: this file stays pure, and
 * a field that must never leave the device cannot leave by accident, because
 * there is no service handle in scope to reach it with.
 */
export interface AssistantContextInput {
  viewer: User | null;
  owned: readonly OwnedItem[];
  catalogue: ReadonlyMap<string, Item>;
  collections: readonly Collection[];
  /** Collection ids that already have a room, so the snapshot can say which. */
  collectionIdsWithRooms: readonly string[];
  roomEligibleCollections: number;
  showroomCount: number;
  followerCount: number;
  followingCount: number;
  themes: readonly RoomTheme[];
  linkedTitles: readonly string[];
  titleLabels: Readonly<Record<string, string>>;
  matchState: AssistantContext['matchState'];
  matches: AssistantContext['matches'];
  communities: AssistantContext['communities'];
  threads: AssistantContext['threads'];
  digests: AssistantContext['digests'];
  headlines: AssistantContext['headlines'];
  savedArticleCount: number;
  unreadNotificationCount: number;
}

/**
 * Builds the snapshot.
 *
 * Note what is absent: `User.id`, any `OwnedItem.id`, emails, tokens, exact
 * acquisition dates, thread bodies, article bodies, the item catalogue. A
 * question like "how many Mythics do I own" needs a count, not a row — so it
 * gets a count. If a future answer needs more, add the one field, not the whole
 * record.
 */
export function buildContext(input: AssistantContextInput): AssistantContext {
  const items = input.owned
    .map((entry) => input.catalogue.get(entry.itemId))
    .filter((item): item is Item => item !== undefined);

  const byTitle = new Map<string, { count: number; verifiedCount: number }>();
  const byRarity = new Map<string, number>();
  for (const owned of input.owned) {
    const item = input.catalogue.get(owned.itemId);
    if (!item) continue;
    const entry = byTitle.get(item.title) ?? { count: 0, verifiedCount: 0 };
    entry.count += 1;
    if (owned.trustLevel === 'verified') entry.verifiedCount += 1;
    byTitle.set(item.title, entry);
    byRarity.set(item.rarityTier, (byRarity.get(item.rarityTier) ?? 0) + 1);
  }

  const verified = input.owned.filter((entry) => entry.trustLevel === 'verified').length;
  const linked = new Set(input.linkedTitles);
  const withRooms = new Set(input.collectionIdsWithRooms);

  return {
    handle: input.viewer?.handle ?? 'you',
    displayName: input.viewer?.displayName ?? 'Collector',

    itemCount: input.owned.length,
    verifiedCount: verified,
    unverifiedCount: input.owned.length - verified,
    titles: [...byTitle.entries()]
      .map(([title, entry]) => ({
        title,
        label: input.titleLabels[title] ?? title,
        count: entry.count,
        verifiedCount: entry.verifiedCount,
        accountLinked: linked.has(title),
      }))
      .sort((a, b) => b.count - a.count),
    rarity: [...byRarity.entries()]
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => (RARITY_RANK[b.tier as keyof typeof RARITY_RANK] ?? 0) -
        (RARITY_RANK[a.tier as keyof typeof RARITY_RANK] ?? 0)),
    topItems: [...items]
      .sort((a, b) => RARITY_RANK[b.rarityTier] - RARITY_RANK[a.rarityTier])
      .slice(0, MAX_TOP_ITEMS)
      .map((item) => item.name),

    collections: input.collections.map((collection) => ({
      name: collection.name,
      itemCount: collection.itemIds.length,
      visibility: collection.visibility,
      hasRoom: withRooms.has(collection.id),
    })),
    showroomCount: input.showroomCount,
    roomEligibleCollections: input.roomEligibleCollections,
    themes: input.themes.map((theme) => theme.name),

    followerCount: input.followerCount,
    followingCount: input.followingCount,

    matchState: input.matchState,
    matches: input.matches.slice(0, MAX_MATCHES),

    communities: input.communities.slice(0, MAX_COMMUNITIES),
    threads: input.threads.slice(0, MAX_THREADS),

    digests: input.digests,
    headlines: input.headlines.slice(0, MAX_HEADLINES),
    savedArticleCount: input.savedArticleCount,

    unreadNotificationCount: input.unreadNotificationCount,
  };
}

export interface AssistantAnswer {
  text: string;
  /** Where it came from, shown in the UI. Never imply a model ran when none did. */
  source: 'local' | 'model';
}

/** Rejected input, with the reason. Null when the question is acceptable. */
export function guardrail(question: string): string | null {
  const trimmed = question.trim();
  if (trimmed.length === 0) return 'Ask me something about your collection.';
  if (trimmed.length > MAX_QUESTION_LENGTH) {
    return `Questions are capped at ${MAX_QUESTION_LENGTH} characters.`;
  }

  // Prompt-injection and credential fishing. Not a security boundary on its own
  // — the proxy enforces the real one — but it stops the obvious attempts
  // before they cost a request, and it keeps the assistant on topic.
  const hostile =
    /\b(ignore|disregard|forget)\b.{0,20}\b(previous|prior|above|earlier)\b|\bsystem prompt\b|\bapi[ _-]?key\b|\bsecret\b|\btoken\b|\bpassword\b|\bcredential/i;
  if (hostile.test(trimmed)) {
    return "I can only answer questions about your Collectee account and how the app works.";
  }

  return null;
}

/**
 * Answers from the snapshot alone.
 *
 * Returns null when nothing local matches, which is the signal for the service
 * to try a model — or, when no proxy is configured, to say plainly that it does
 * not know. Guessing is the one thing it must not do: an assistant that invents
 * a follower count is worse than one that admits the gap.
 */
export function answerLocally(
  question: string,
  context: AssistantContext,
): AssistantAnswer | null {
  const q = question.toLowerCase();
  const has = (...terms: string[]) => terms.some((term) => q.includes(term));

  if (has('how many', 'count', 'number of') && has('item', 'skin')) {
    if (has('verified')) {
      return local(
        `${context.verifiedCount} of your ${context.itemCount} items are verified, and ${context.unverifiedCount} are not. Only verified items can go in a Showroom — unverified ones live in 2D collections.`,
      );
    }
    return local(
      `You own ${context.itemCount} items — ${context.verifiedCount} verified, ${context.unverifiedCount} unverified.`,
    );
  }

  if (has('verified', 'unverified') && has('what', 'mean', 'why', 'difference')) {
    return local(
      'A verified item was read from a connected game account; an unverified one was self-reported by a scan. Both are fully usable, but only verified items can be placed in a Showroom. Connecting a game account is what verifies them.',
    );
  }

  if (has('showroom', 'room')) {
    if (has('what is', "what's", 'explain', 'mean')) {
      return local(
        `A Showroom is the interactive version of a collection — your items placed in a themed 3D space instead of a grid. There are ${context.themes.length} styles: ${context.themes.join(', ')}. It needs at least 3 verified items.`,
      );
    }
    return local(
      context.showroomCount > 0
        ? `You have ${context.showroomCount} Showroom${context.showroomCount === 1 ? '' : 's'}.`
        : `You have no Showrooms yet. You have ${context.verifiedCount} verified items, so you can build one from any collection with 3 or more of them.`,
    );
  }

  if (has('collection')) {
    if (context.collections.length === 0) return local('You have no collections yet.');
    const list = context.collections
      .map((c) => `${c.name} (${c.itemCount} items, ${c.visibility})`)
      .join(', ');
    return local(`You have ${context.collections.length} collections: ${list}.`);
  }

  if (has('follower', 'following')) {
    return local(
      `You have ${context.followerCount} followers and are following ${context.followingCount} collectors.`,
    );
  }

  if (has('rarest', 'best', 'top', 'valuable')) {
    return local(`Your rarest items are: ${context.topItems.join(', ')}.`);
  }

  if (has('game', 'title') && has('how many', 'which', 'what')) {
    const list = context.titles.map((t) => `${t.count} in ${t.title.toUpperCase()}`).join(', ');
    return local(`Across ${context.titles.length} titles: ${list}.`);
  }

  if (has('rarity', 'mythic', 'legendary', 'epic', 'rare', 'common')) {
    const list = context.rarity.map((r) => `${r.count} ${r.tier}`).join(', ');
    return local(`By rarity: ${list}.`);
  }

  if (has('who am i', 'my name', 'my handle', 'my profile', 'my account')) {
    return local(
      `You are ${context.displayName} (@${context.handle}) — ${context.itemCount} items, ${context.collections.length} collections, ${context.followerCount} followers.`,
    );
  }

  if (has('import', 'scan', 'add item', 'add skin')) {
    return local(
      'Tap Import in the tab bar and upload a screenshot or recording of your in-game inventory. Items are recognised, you confirm them, and they land as unverified until you connect a game account.',
    );
  }

  return null;
}

function local(text: string): AssistantAnswer {
  return { text, source: 'local' };
}

/** Starter prompts. Every one is answerable offline, so the demo cannot stall. */
export const SUGGESTED_QUESTIONS = [
  'How many items do I own?',
  'What can go in a Showroom?',
  'What are my rarest items?',
  'How many are verified?',
] as const;
