/**
 * Collector and community matching — PRD §11 F5. Flow owner: Marcus (J4).
 *
 * Every result carries its `reason`. If a screen renders a match percentage
 * without the reason next to it, that screen is wrong — §11 F5 makes the
 * explanation part of the feature, not a tooltip.
 */

import { ITEMS_BY_ID } from '@/fixtures/catalogue';
import { USERS, USERS_BY_ID } from '@/fixtures/users';
import { COMMUNITIES } from '@/fixtures/social';
import { matchPercent, rankCollectors } from '@/domain/matching';
import type { MatchResult } from '@/domain/matching';
import { GAME_SHORT_LABELS } from '@/types';
import type { Community, GameTitle, Item, User } from '@/types';
import { inventoryService } from './inventoryService';
import { socialService } from './socialService';
import { LATENCY_FETCH, LATENCY_INSTANT, delay } from './latency';

export interface CollectorRecommendation {
  user: User;
  /** 0–100, what the card prints. */
  percent: number;
  /** Always displayed alongside the percentage. */
  reason: string;
  sharedItems: Item[];
}

export interface CommunityRecommendation {
  community: Community;
  reason: string;
}

/**
 * Ownership read seam.
 *
 * Read through `inventoryService`, never from `@/fixtures/owned-items`: the
 * fixture is the seeded state only, so a fixture read makes everything the
 * viewer imports during the session invisible to matching. Import → Discover is
 * on the never-cut demo chain (§14) and a scan that does not move a single match
 * score is the failure this seam exists to prevent.
 */
function ownershipSnapshot(): ReadonlyMap<string, readonly string[]> {
  return inventoryService.getItemIdsByUser();
}

export const matchService = {
  /** Ranked collectors for the Discover tab and the "Collectors you may like" rail. */
  async getRecommendedCollectors(
    viewerId: string,
    limit = 10,
  ): Promise<CollectorRecommendation[]> {
    const viewer = USERS_BY_ID.get(viewerId);
    if (!viewer) return delay([], LATENCY_INSTANT);

    // Taken once per call: every candidate is scored against the same snapshot,
    // so an import landing mid-pass cannot produce an inconsistent ranking.
    const ownership = ownershipSnapshot();
    const candidates = USERS.map((user) => ({
      user,
      itemIds: ownership.get(user.id) ?? [],
    }));
    const ranked = rankCollectors(
      {
        userId: viewerId,
        itemIds: ownership.get(viewerId) ?? [],
        followedGames: viewer.followedGames,
      },
      candidates,
      ITEMS_BY_ID,
      limit,
    );

    return delay(ranked.map(toRecommendation), LATENCY_FETCH);
  },

  /**
   * The Collection Match screen — one pairwise result with its shared items.
   *
   * `rankCollectors` drops zero-score candidates, which is right for a ranked
   * rail and wrong for a profile you navigated to directly: the card would
   * silently vanish. §11 F5 makes the reason part of the feature, so a genuine
   * no-overlap pair gets an honest 0% and an honest reason rather than nothing.
   */
  async getMatch(viewerId: string, otherId: string): Promise<CollectorRecommendation | null> {
    const all = await this.getRecommendedCollectors(viewerId, USERS.length);
    const ranked = all.find((r) => r.user.id === otherId);
    if (ranked) return ranked;

    const viewer = USERS_BY_ID.get(viewerId);
    const other = USERS_BY_ID.get(otherId);
    if (!viewer || !other || viewer.id === other.id) return delay(null, LATENCY_INSTANT);

    return delay(
      {
        user: other,
        percent: 0,
        reason: explainNoOverlap(viewer, other),
        sharedItems: [],
      },
      LATENCY_INSTANT,
    );
  },

  /**
   * Communities to join. Matched on the games the viewer actually owns items
   * in, not just the ones they ticked at signup — the same "reason must be
   * legible" principle.
   */
  async getRecommendedCommunities(
    viewerId: string,
    limit = 5,
  ): Promise<CommunityRecommendation[]> {
    const owned = ownershipSnapshot().get(viewerId) ?? [];
    const titles = new Set<GameTitle>();
    for (const id of owned) {
      const item = ITEMS_BY_ID.get(id);
      if (item) titles.add(item.title);
    }

    // Live membership, not the seeded `memberIds`: a community the viewer joins
    // during the session must stop being recommended back to them.
    const recommendations = COMMUNITIES.filter(
      (community) => !socialService.isMember(viewerId, community.id),
    )
      .map((community) => {
        const tagHit = community.tags.find((tag) =>
          [...titles].some((t) => tag.toLowerCase().includes(t.toLowerCase())),
        );
        return {
          community,
          reason: tagHit
            ? `You own ${tagHit} items`
            : 'Popular with collectors like you',
        };
      })
      .slice(0, limit);

    return delay(recommendations, LATENCY_FETCH);
  },

  async getCommunities(): Promise<Community[]> {
    return delay([...COMMUNITIES], LATENCY_FETCH);
  },
};

/**
 * The reason string for a pair with no co-owned items.
 *
 * Says what is true and nothing more. Naming the shared games explains why the
 * collector is worth a look without dressing a zero up as a match — §11 F5's
 * whole point is that the explanation is what makes a number feel earned, and
 * that cuts both ways.
 */
function explainNoOverlap(viewer: User, other: User): string {
  const shared = viewer.followedGames.filter((game) => other.followedGames.includes(game));
  if (shared.length === 0) return 'No items in common yet';
  return `No items in common yet — you both play ${shared
    .map((game) => GAME_SHORT_LABELS[game])
    .join(' and ')}`;
}

function toRecommendation(result: MatchResult): CollectorRecommendation {
  return {
    user: USERS_BY_ID.get(result.userId)!,
    percent: matchPercent(result.score),
    reason: result.reason,
    sharedItems: result.sharedItemIds
      .map((id) => ITEMS_BY_ID.get(id))
      .filter((i): i is Item => i !== undefined),
  };
}

export type MatchService = typeof matchService;
