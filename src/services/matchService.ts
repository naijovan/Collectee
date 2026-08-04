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
import {
  matchPercent,
  rankCollectors,
  viewerMatchState,
  VIEWER_UNVERIFIED_REASON,
} from '@/domain/matching';
import type { MatchBasis, MatchInventory, MatchResult } from '@/domain/matching';
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
  /** The VERIFIED items behind the score — the receipts. */
  sharedItems: Item[];
  /** What the score is built on, so a screen can pick the right empty state. */
  basis: MatchBasis;
}

/** Viewer states a screen has to render differently. Mirrors `viewerMatchState`. */
export type ViewerMatchState = 'cold-start' | 'unverified-only' | 'ready';

export interface CommunityRecommendation {
  community: Community;
  reason: string;
}

/**
 * Ownership read seam.
 *
 * Read through `inventoryService`, never from `@/fixtures/owned-items`: the
 * fixture is the seeded state only, so a fixture read makes everything the
 * viewer imports during the session invisible to matching.
 *
 * Both maps are taken together, once per call, so every candidate is scored
 * against the same snapshot. Scoring uses the verified set; the full set only
 * tells "owns nothing" apart from "owns plenty, verified none" (§11 F5).
 *
 * Since the 3 Aug decision the demo chain reads import → **verify** → Discover
 * moves: a scan alone changes no score, because a scanned item is never
 * verified (§11 F1 step 6).
 */
function ownershipSnapshot(): {
  inventoryFor: (userId: string) => MatchInventory;
} {
  const all = inventoryService.getItemIdsByUser();
  const verified = inventoryService.getVerifiedItemIdsByUser();
  return {
    inventoryFor: (userId) => ({
      itemIds: all.get(userId) ?? [],
      verifiedItemIds: verified.get(userId) ?? [],
    }),
  };
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
    // Blocking is private to the viewer (§11 F5), so it filters here rather than
    // affecting anyone's score: a blocked collector stops being recommended TO
    // this viewer, and is unaffected everywhere else.
    const blockedByViewer = socialService.blockedBy(viewerId);
    const candidates = USERS.filter((user) => !blockedByViewer.has(user.id)).map((user) => ({
      user,
      inventory: ownership.inventoryFor(user.id),
    }));
    const ranked = rankCollectors(
      {
        userId: viewerId,
        inventory: ownership.inventoryFor(viewerId),
        followedGames: viewer.followedGames,
      },
      candidates,
      ITEMS_BY_ID,
      limit,
    );

    return delay(ranked.map(toRecommendation), LATENCY_FETCH);
  },

  /**
   * Which viewer state applies, so a screen can render the right empty state.
   *
   * `getRecommendedCollectors` returns an empty list both when the viewer has
   * verified nothing and when nobody matches. Those need different copy and a
   * different call to action, and a screen must not have to guess which it got.
   */
  async getViewerMatchState(viewerId: string): Promise<ViewerMatchState> {
    return delay(viewerMatchState(ownershipSnapshot().inventoryFor(viewerId)), LATENCY_INSTANT);
  },

  /**
   * The Collection Match screen — one pairwise result with its shared items.
   *
   * `rankCollectors` drops zero-score candidates, which is right for a ranked
   * rail and wrong for a profile you navigated to directly: the card would
   * silently vanish. §11 F5 makes the reason part of the feature, so a genuine
   * no-overlap pair gets an honest 0% and an honest reason rather than nothing.
   *
   * Under verified-only matching this is the common case, not the edge case, and
   * the two zero reasons are different: the viewer has verified nothing, or they
   * have and this pair shares none.
   */
  async getMatch(viewerId: string, otherId: string): Promise<CollectorRecommendation | null> {
    const all = await this.getRecommendedCollectors(viewerId, USERS.length);
    const ranked = all.find((r) => r.user.id === otherId);
    if (ranked) return ranked;

    const viewer = USERS_BY_ID.get(viewerId);
    const other = USERS_BY_ID.get(otherId);
    if (!viewer || !other || viewer.id === other.id) return delay(null, LATENCY_INSTANT);

    const state = viewerMatchState(ownershipSnapshot().inventoryFor(viewerId));
    return delay(
      {
        user: other,
        percent: 0,
        reason:
          state === 'unverified-only'
            ? VIEWER_UNVERIFIED_REASON
            : explainNoVerifiedOverlap(viewer, other),
        sharedItems: [],
        basis: state === 'unverified-only' ? 'viewer-unverified' : 'no-verified-overlap',
      },
      LATENCY_INSTANT,
    );
  },

  /**
   * Communities to join, matched on the titles the viewer owns VERIFIED items
   * in — the same 3 Aug rule as collector matching, and the same "reason must be
   * legible" principle (§11 F5).
   *
   * A viewer who has verified nothing gets the generic reason on every
   * community rather than a claim about items we cannot stand behind.
   */
  async getRecommendedCommunities(
    viewerId: string,
    limit = 5,
  ): Promise<CommunityRecommendation[]> {
    const verified = ownershipSnapshot().inventoryFor(viewerId).verifiedItemIds;
    const titles = new Set<GameTitle>();
    for (const id of verified) {
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
            ? `You own verified ${tagHit} items`
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
 * The reason string for a pair with no VERIFIED items in common.
 *
 * Says what is true and nothing more. Naming the shared games explains why the
 * collector is worth a look without dressing a zero up as a match — §11 F5's
 * whole point is that the explanation is what makes a number feel earned, and
 * that cuts both ways. The word "verified" matters here too: they may well own
 * plenty of the same items, just none either of them has verified.
 */
function explainNoVerifiedOverlap(viewer: User, other: User): string {
  const shared = viewer.followedGames.filter((game) => other.followedGames.includes(game));
  if (shared.length === 0) return 'No verified items in common yet';
  return `No verified items in common yet — you both play ${shared
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
    basis: result.basis,
  };
}

export type MatchService = typeof matchService;
