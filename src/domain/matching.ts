/**
 * Collector matching — PRD §11 F5.
 *
 * "Match score is item-overlap based, not a black box." Similarity is a
 * weighted Jaccard over co-owned items, where each item's weight is its inverse
 * popularity — owning a common battle-pass skin says little, owning the same
 * limited exclusive says a lot.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  VERIFIED ITEMS ONLY (team decision, 3 Aug).                        │
 * │  Matching counts items whose ownership is verified. An unverified   │
 * │  item contributes nothing — not a reduced weight, nothing — because │
 * │  verification is the incentive: verify your collection, become      │
 * │  discoverable (§9.2 "priority in Collectors You May Like").         │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * The consequence to keep in mind: an account with no verified items cannot be
 * matched in either direction. It is absent from Discover, not ranked low. That
 * is deliberate, and `viewerMatchState` exists so callers can say so out loud
 * rather than rendering an empty list with no explanation.
 *
 * The reason string is not decoration. §11 F5: "Always display the
 * human-readable reason; the explanation is what makes a recommendation feel
 * earned." `explainMatch` is therefore part of the scoring contract, not a
 * presentation concern bolted on afterwards — and now that only verified items
 * score, the reason has to say so.
 */

import type { Community, GameTitle, Item, RarityTier, User } from '@/types';
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

/**
 * What a score is actually built on. Lets a screen pick the right empty state
 * and the right call to action without re-deriving the rule.
 */
export type MatchBasis =
  /** Verified items in common — the real thing. */
  | 'verified-overlap'
  /** Both collectors have verified items; none of them are shared. */
  | 'no-verified-overlap'
  /** The viewer owns items but has verified none, so nothing can score. */
  | 'viewer-unverified'
  /** The viewer owns nothing at all — content-based fallback on followed games. */
  | 'cold-start';

export interface MatchResult {
  userId: string;
  /** 0–1. Multiply by 100 for the percentage the UI prints. */
  score: number;
  /** VERIFIED item ids both collectors own, ordered by descending weight. */
  sharedItemIds: string[];
  /** Human-readable, always shown alongside the score. */
  reason: string;
  basis: MatchBasis;
}

/** A collector's inventory as matching sees it. */
export interface MatchInventory {
  /** Everything owned, whatever its trust level. */
  itemIds: readonly string[];
  /** The subset whose ownership is verified — the only items that score. */
  verifiedItemIds: readonly string[];
}

/**
 * Which of the three viewer states applies.
 *
 * The middle one is the trap this function exists to prevent: a viewer with 20
 * scanned items and none verified is NOT a cold start. Treating it as one falls
 * through to content-based scoring and prints a confident-looking percentage
 * built on no verified data at all, which is exactly the black box §11 F5
 * forbids.
 */
export function viewerMatchState(
  inventory: MatchInventory,
): 'cold-start' | 'unverified-only' | 'ready' {
  if (inventory.itemIds.length === 0) return 'cold-start';
  if (inventory.verifiedItemIds.length === 0) return 'unverified-only';
  return 'ready';
}

/** Shown when the viewer owns items but has verified none. States the rule and the fix. */
export const VIEWER_UNVERIFIED_REASON =
  'Matches are built from verified items — link a game account to see collectors like you';

/**
 * Denominator smoothing, in the same units as `itemWeight` (natural log of
 * inverse popularity).
 *
 * Roughly the weight of one item owned by ~5% of players, so a collector who
 * has verified two items and shares both cannot read 100%. Without it the
 * overlap coefficient maxes out on any fully-contained collection, however
 * small, and "100% match" would mean "this person has verified almost nothing".
 */
export const SIMILARITY_SMOOTHING = 3;

/**
 * Similarity between two VERIFIED item sets: a weighted overlap coefficient.
 *
 *   intersectionWeight / (min(weightA, weightB) + SIMILARITY_SMOOTHING)
 *
 * **What the number means:** the share of the smaller collection that the two
 * collectors have in common, weighted by inverse item popularity — owning the
 * same limited exclusive counts for far more than the same battle-pass skin.
 * That is still "similarity over co-owned items weighted by inverse item
 * popularity" (§11 F5); the PRD never named a specific normalisation.
 *
 * **Why not Jaccard** (decided 5 Aug, see the commit): dividing by the UNION
 * makes every score a function of how much unrelated stuff either side owns.
 * Verifying items nobody else has verified grew the union without growing the
 * intersection, so the act the product rewards pushed scores DOWN — and worse,
 * an unrelated art-pack merge that added twenty items to one seeded inventory
 * halved every score in the demo overnight. A headline number that drifts
 * whenever somebody else touches a fixture cannot be trusted on stage.
 *
 * Dividing by the SMALLER side removes that coupling: adding items to the
 * larger collection cannot move the score at all.
 *
 * Callers pass verified ids only. This function does not filter — keeping the
 * trust rule in `rankCollectors` means there is exactly one place it can be got
 * wrong.
 */
export function similarity(
  aItemIds: readonly string[],
  bItemIds: readonly string[],
  catalogue: ReadonlyMap<string, Item>,
): { score: number; sharedItemIds: string[] } {
  const a = new Set(aItemIds);
  const b = new Set(bItemIds);

  let intersectionWeight = 0;
  let weightA = 0;
  let weightB = 0;
  const shared: { id: string; weight: number }[] = [];

  for (const id of new Set([...a, ...b])) {
    const item = catalogue.get(id);
    if (!item) continue;
    const weight = itemWeight(item);
    if (a.has(id)) weightA += weight;
    if (b.has(id)) weightB += weight;
    if (a.has(id) && b.has(id)) {
      intersectionWeight += weight;
      shared.push({ id, weight });
    }
  }

  shared.sort((x, y) => y.weight - x.weight);
  const denominator = Math.min(weightA, weightB) + SIMILARITY_SMOOTHING;
  return {
    score: intersectionWeight === 0 ? 0 : intersectionWeight / denominator,
    sharedItemIds: shared.map((s) => s.id),
  };
}

/**
 * Build the reason string from the highest-signal shared items.
 *
 * Picks the (rarity, game) pair that dominates the top of the shared list —
 * that produces "you both collect verified Mythic MLBB skins" rather than a
 * generic "you have items in common". The word "verified" is load-bearing: only
 * verified items score, so a reason that omitted it would misdescribe what the
 * percentage measured.
 *
 * The empty-shared branch is reached only on cold start, where the honest
 * explanation is the games in common rather than any item.
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
  return `You both collect verified ${label} ${game} skins`;
}

/**
 * Rank candidate collectors against a viewer, on verified items only.
 *
 * Three states, deliberately distinct:
 *
 *   cold-start      — the viewer owns nothing. Content-based fallback on
 *                     followed games (§11 F5), capped below real overlap scores
 *                     so it is never presented as if item data earned it.
 *   unverified-only — the viewer owns items but has verified none. Returns
 *                     EMPTY. There is no honest ranking to produce: falling
 *                     through to cold start here would print a percentage built
 *                     on nothing, and scoring unverified items would ignore the
 *                     rule. The caller shows `VIEWER_UNVERIFIED_REASON` and a
 *                     route to verification instead.
 *   ready           — score on verified overlap.
 */
export function rankCollectors(
  viewer: {
    userId: string;
    inventory: MatchInventory;
    followedGames: readonly GameTitle[];
  },
  candidates: readonly { user: User; inventory: MatchInventory }[],
  catalogue: ReadonlyMap<string, Item>,
  limit = 10,
): MatchResult[] {
  const state = viewerMatchState(viewer.inventory);
  if (state === 'unverified-only') return [];

  const results = candidates
    .filter((c) => c.user.id !== viewer.userId)
    .map<MatchResult>(({ user, inventory }) => {
      if (state === 'cold-start') {
        const overlap = viewer.followedGames.filter((g) => user.followedGames.includes(g));
        const score = viewer.followedGames.length
          ? (overlap.length / viewer.followedGames.length) * 0.5
          : 0;
        return {
          userId: user.id,
          score,
          sharedItemIds: [],
          reason: explainMatch([], catalogue, overlap),
          basis: 'cold-start',
        };
      }

      const { score, sharedItemIds } = similarity(
        viewer.inventory.verifiedItemIds,
        inventory.verifiedItemIds,
        catalogue,
      );
      return {
        userId: user.id,
        score,
        sharedItemIds,
        reason: explainMatch(sharedItemIds, catalogue, user.followedGames),
        basis: sharedItemIds.length > 0 ? 'verified-overlap' : 'no-verified-overlap',
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

/* ────────────────────────────────────────────────────────────────────────────
 * Community ordering (Home's Communities rail, and Explore's browse-all)
 * ──────────────────────────────────────────────────────────────────────────*/

/** A community with the group it landed in and why. */
export interface RankedCommunity {
  community: Community;
  /** 'forYou' when a followed game matched; 'trending' otherwise. */
  group: 'forYou' | 'trending';
  /** §11 F5 — the reason travels with the placement, never a bare score. */
  reason: string;
}

/**
 * Split communities into "For you" and "Trending", both by member count.
 *
 * ── The affinity signal is followed GAMES, and it is a real one ───────────
 * Every community's first tag is a game — 'MLBB', 'CODM', 'Valorant' or
 * 'cross-game' — so a followed game joins directly onto it. That list comes
 * from `newsService.followedGamesFor`, which the first-run quiz writes in step
 * 2 and which already drives `rankFyp`. Nothing here is derived from a score
 * this file invented.
 *
 * What is NOT used: the quiz's intensity answer. It is captured and readable,
 * but there is no honest mapping from "how hard do you collect" to which
 * community you want, and a plausible-looking one would be a fabricated
 * signal wearing a real field's name.
 *
 * ── Trending is `memberCount` ─────────────────────────────────────────────
 * `Community` has no trending or featured flag; `memberCount` is the only
 * ranking-shaped number on it, and it is what the cards already print. Both
 * groups sort by it, so within a group the order is never arbitrary.
 *
 * ── Joined communities are excluded, not marked ───────────────────────────
 * Callers pass `isMember`. Both surfaces show joined communities separately
 * — Explore under "Your Communities", Home not at all — so including them
 * here would put the same card on one screen twice under two headings. That
 * is the duplicate this split exists to avoid, and it is what
 * `matchService.getRecommendedCommunities` already does.
 *
 * Pure: no service, no fixture, no clock. The caller supplies the world.
 */
export function rankCommunities(
  communities: readonly Community[],
  options: {
    followedGames: readonly string[];
    isMember: (communityId: string) => boolean;
  },
): RankedCommunity[] {
  const followed = options.followedGames.map((game) => game.toLowerCase());

  /* A community matches when any tag names a followed game. Substring both
     ways because the tag is a short label ('MLBB') and the followed value may
     be the title key ('mlbb') — neither is reliably a prefix of the other. */
  const matchedGame = (community: Community): string | null => {
    for (const tag of community.tags) {
      const lower = tag.toLowerCase();
      const hit = followed.find((game) => lower.includes(game) || game.includes(lower));
      if (hit) return tag;
    }
    return null;
  };

  const byMembers = (a: Community, b: Community) => b.memberCount - a.memberCount;

  const open = communities.filter((community) => !options.isMember(community.id));
  const forYou: RankedCommunity[] = [];
  const trending: RankedCommunity[] = [];

  for (const community of [...open].sort(byMembers)) {
    const tag = matchedGame(community);
    if (tag) {
      forYou.push({ community, group: 'forYou', reason: `You follow ${tag}` });
    } else {
      trending.push({
        community,
        group: 'trending',
        reason: `${community.memberCount.toLocaleString()} members`,
      });
    }
  }

  // Concatenated, not interleaved: a caller taking the first N gets the most
  // relevant ones first, and a caller rendering groups can split on `group`.
  return [...forYou, ...trending];
}
