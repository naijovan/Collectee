/**
 * Collector matching — PRD §11 F5.
 *
 * "Match score is item-overlap based, not a black box." Similarity is a
 * weighted Jaccard over co-owned items, where each item's weight is its inverse
 * popularity — owning a common battle-pass skin says little, owning the same
 * limited exclusive says a lot.
 *
 * The reason string is not decoration. §11 F5: "Always display the
 * human-readable reason; the explanation is what makes a recommendation feel
 * earned." `explainMatch` is therefore part of the scoring contract, not a
 * presentation concern bolted on afterwards.
 */

import type { GameTitle, Item, RarityTier, User } from '@/types';
import { GAME_SHORT_LABELS } from '@/types';
import { RARITY_RANK, rarityLabelFor } from './rarity';

/** Floor for popularity so a zero can't produce an infinite weight. */
const MIN_POPULARITY = 0.001;

/**
 * IDF-style weight. An item owned by 1% of players is worth far more signal
 * than one owned by 80%.
 */
export function itemWeight(item: Item): number {
  return Math.log(1 / Math.max(item.popularityScore, MIN_POPULARITY));
}

export interface MatchResult {
  userId: string;
  /** 0–1. Multiply by 100 for the percentage the UI prints. */
  score: number;
  /** Item ids both collectors own, ordered by descending weight. */
  sharedItemIds: string[];
  /** Human-readable, always shown alongside the score. */
  reason: string;
}

/**
 * Weighted Jaccard similarity between two item-id sets.
 *
 * intersectionWeight / unionWeight, so a collector who owns everything you own
 * plus 500 more does not automatically score 100%.
 */
export function similarity(
  aItemIds: readonly string[],
  bItemIds: readonly string[],
  catalogue: ReadonlyMap<string, Item>,
): { score: number; sharedItemIds: string[] } {
  const a = new Set(aItemIds);
  const b = new Set(bItemIds);

  let intersectionWeight = 0;
  let unionWeight = 0;
  const shared: { id: string; weight: number }[] = [];

  const union = new Set([...a, ...b]);
  for (const id of union) {
    const item = catalogue.get(id);
    if (!item) continue;
    const weight = itemWeight(item);
    unionWeight += weight;
    if (a.has(id) && b.has(id)) {
      intersectionWeight += weight;
      shared.push({ id, weight });
    }
  }

  shared.sort((x, y) => y.weight - x.weight);
  return {
    score: unionWeight === 0 ? 0 : intersectionWeight / unionWeight,
    sharedItemIds: shared.map((s) => s.id),
  };
}

/**
 * Build the reason string from the highest-signal shared items.
 *
 * Picks the (rarity, game) pair that dominates the top of the shared list —
 * that produces "you both collect Mythic MLBB skins" rather than a generic
 * "you have items in common".
 */
export function explainMatch(
  sharedItemIds: readonly string[],
  catalogue: ReadonlyMap<string, Item>,
  fallbackGames: readonly GameTitle[] = [],
): string {
  const items = sharedItemIds
    .map((id) => catalogue.get(id))
    .filter((i): i is Item => i !== undefined);

  if (items.length === 0) {
    if (fallbackGames.length > 0) {
      return `You both play ${fallbackGames.map((g) => GAME_SHORT_LABELS[g]).join(' and ')}`;
    }
    return 'Suggested from the games you follow';
  }

  // Weight each (tier, game) bucket by signal, not raw count, so one shared
  // Mythic outranks five shared Commons.
  const buckets = new Map<string, { tier: RarityTier; title: GameTitle; weight: number }>();
  for (const item of items) {
    const key = `${item.rarityTier}:${item.title}`;
    const existing = buckets.get(key);
    const weight = itemWeight(item);
    if (existing) existing.weight += weight;
    else buckets.set(key, { tier: item.rarityTier, title: item.title, weight });
  }

  const top = [...buckets.values()].sort(
    (a, b) => b.weight - a.weight || RARITY_RANK[b.tier] - RARITY_RANK[a.tier],
  )[0]!;

  const label = rarityLabelFor(top.tier, top.title);
  const game = GAME_SHORT_LABELS[top.title];
  return `You both collect ${label} ${game} skins`;
}

/**
 * Rank candidate collectors against a viewer.
 *
 * Cold start (§11 F5): a viewer with no items falls back to content-based
 * matching on followed games, so the Discover tab is never empty for a new
 * account that hasn't imported yet.
 */
export function rankCollectors(
  viewer: { userId: string; itemIds: readonly string[]; followedGames: readonly GameTitle[] },
  candidates: readonly { user: User; itemIds: readonly string[] }[],
  catalogue: ReadonlyMap<string, Item>,
  limit = 10,
): MatchResult[] {
  const results = candidates
    .filter((c) => c.user.id !== viewer.userId)
    .map(({ user, itemIds }) => {
      if (viewer.itemIds.length === 0) {
        const overlap = viewer.followedGames.filter((g) => user.followedGames.includes(g));
        // Cold-start scores are capped below real overlap scores so they are
        // never presented as if they were earned by item data.
        const score = viewer.followedGames.length
          ? (overlap.length / viewer.followedGames.length) * 0.5
          : 0;
        return {
          userId: user.id,
          score,
          sharedItemIds: [],
          reason: explainMatch([], catalogue, overlap),
        };
      }

      const { score, sharedItemIds } = similarity(viewer.itemIds, itemIds, catalogue);
      return {
        userId: user.id,
        score,
        sharedItemIds,
        reason: explainMatch(sharedItemIds, catalogue, user.followedGames),
      };
    })
    .filter((r) => r.score > 0);

  results.sort((a, b) => b.score - a.score || a.userId.localeCompare(b.userId));
  return results.slice(0, limit);
}

/** The percentage the UI prints, e.g. 92 for "92% match". */
export function matchPercent(score: number): number {
  return Math.round(score * 100);
}
