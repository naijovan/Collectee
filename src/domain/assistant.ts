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

/** What the assistant is allowed to know. Everything here may leave the device. */
export interface AssistantContext {
  handle: string;
  displayName: string;
  itemCount: number;
  verifiedCount: number;
  unverifiedCount: number;
  titles: { title: string; count: number }[];
  rarity: { tier: string; count: number }[];
  topItems: string[];
  collections: { name: string; itemCount: number; visibility: string }[];
  showroomCount: number;
  followerCount: number;
  followingCount: number;
  themes: string[];
}

/**
 * Builds the snapshot.
 *
 * Note what is absent: `User.id`, any `OwnedItem.id`, emails, tokens, exact
 * acquisition dates. A question like "how many Mythics do I own" needs a count,
 * not a row — so it gets a count. If a future answer needs more, add the one
 * field, not the whole record.
 */
export function buildContext(input: {
  viewer: User | null;
  owned: readonly OwnedItem[];
  catalogue: ReadonlyMap<string, Item>;
  collections: readonly Collection[];
  showroomCount: number;
  followerCount: number;
  followingCount: number;
  themes: readonly RoomTheme[];
}): AssistantContext {
  const items = input.owned
    .map((entry) => input.catalogue.get(entry.itemId))
    .filter((item): item is Item => item !== undefined);

  const byTitle = new Map<string, number>();
  const byRarity = new Map<string, number>();
  for (const item of items) {
    byTitle.set(item.title, (byTitle.get(item.title) ?? 0) + 1);
    byRarity.set(item.rarityTier, (byRarity.get(item.rarityTier) ?? 0) + 1);
  }

  const verified = input.owned.filter((entry) => entry.trustLevel === 'verified').length;

  return {
    handle: input.viewer?.handle ?? 'you',
    displayName: input.viewer?.displayName ?? 'Collector',
    itemCount: input.owned.length,
    verifiedCount: verified,
    unverifiedCount: input.owned.length - verified,
    titles: [...byTitle.entries()]
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count),
    rarity: [...byRarity.entries()]
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => (RARITY_RANK[b.tier as keyof typeof RARITY_RANK] ?? 0) -
        (RARITY_RANK[a.tier as keyof typeof RARITY_RANK] ?? 0)),
    topItems: [...items]
      .sort((a, b) => RARITY_RANK[b.rarityTier] - RARITY_RANK[a.rarityTier])
      .slice(0, 5)
      .map((item) => item.name),
    collections: input.collections.map((collection) => ({
      name: collection.name,
      itemCount: collection.itemIds.length,
      visibility: collection.visibility,
    })),
    showroomCount: input.showroomCount,
    followerCount: input.followerCount,
    followingCount: input.followingCount,
    themes: input.themes.map((theme) => theme.name),
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
