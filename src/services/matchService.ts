/**
 * Collector and community matching — PRD §11 F5. Flow owner: Marcus (J4).
 *
 * Every result carries its `reason`. If a screen renders a match percentage
 * without the reason next to it, that screen is wrong — §11 F5 makes the
 * explanation part of the feature, not a tooltip.
 */

import { ITEMS_BY_ID } from '@/fixtures/catalogue';
import { OWNED_BY_USER } from '@/fixtures/owned-items';
import { USERS, USERS_BY_ID } from '@/fixtures/users';
import { COMMUNITIES } from '@/fixtures/social';
import { matchPercent, rankCollectors } from '@/domain/matching';
import type { MatchResult } from '@/domain/matching';
import type { Community, GameTitle, Item, User } from '@/types';
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

function itemIdsFor(userId: string): string[] {
  return (OWNED_BY_USER.get(userId) ?? []).map((o) => o.itemId);
}

export const matchService = {
  /** Ranked collectors for the Discover tab and the "Collectors you may like" rail. */
  async getRecommendedCollectors(
    viewerId: string,
    limit = 10,
  ): Promise<CollectorRecommendation[]> {
    const viewer = USERS_BY_ID.get(viewerId);
    if (!viewer) return delay([], LATENCY_INSTANT);

    const candidates = USERS.map((user) => ({ user, itemIds: itemIdsFor(user.id) }));
    const ranked = rankCollectors(
      { userId: viewerId, itemIds: itemIdsFor(viewerId), followedGames: viewer.followedGames },
      candidates,
      ITEMS_BY_ID,
      limit,
    );

    return delay(ranked.map(toRecommendation), LATENCY_FETCH);
  },

  /** The Collection Match screen — one pairwise result with its shared items. */
  async getMatch(viewerId: string, otherId: string): Promise<CollectorRecommendation | null> {
    const all = await this.getRecommendedCollectors(viewerId, USERS.length);
    return all.find((r) => r.user.id === otherId) ?? null;
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
    const owned = itemIdsFor(viewerId);
    const titles = new Set<GameTitle>();
    for (const id of owned) {
      const item = ITEMS_BY_ID.get(id);
      if (item) titles.add(item.title);
    }

    const alreadyIn = new Set(
      COMMUNITIES.filter((c) => c.memberIds.some((m) => m === viewerId)).map((c) => c.id),
    );

    const recommendations = COMMUNITIES.filter((c) => !alreadyIn.has(c.id))
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
