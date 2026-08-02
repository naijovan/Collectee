/**
 * News curation — PRD §11 F6.
 *
 * Two feeds: Discover (general) and FYP (personalised by followed games,
 * franchises, characters AND owned items — a player who owns a skin for a
 * champion being reworked should see that patch note first).
 *
 * Positioning (§11 F6): this is the weakest moat of the five features. It is
 * the RETENTION LOOP — the reason to open the app between collection updates —
 * not a headline. It is also the first descope candidate (§14).
 *
 * Sourcing constraint: official publisher channels and permitted RSS only.
 * Summaries link out; Collectee never reproduces article bodies. This is both a
 * legal requirement and the difference between a partner and a scraper.
 */

import type { Article, FollowedTopic, GameTitle } from '@/types';

export interface RankedArticle {
  article: Article;
  score: number;
  /** Why this surfaced. Shown on FYP cards so personalisation is legible. */
  reason: string | null;
}

const WEIGHT_OWNED_ITEM = 3;
const WEIGHT_FOLLOWED_GAME = 1.5;
const WEIGHT_FOLLOWED_TOPIC = 1;

/** Newer articles win ties; decays over roughly a fortnight. */
function recencyBoost(publishedAt: string, now: number): number {
  const ageMs = now - Date.parse(publishedAt);
  const ageDays = ageMs / 86_400_000;
  if (!Number.isFinite(ageDays)) return 0;
  return Math.max(0, 1 - ageDays / 14);
}

/**
 * Rank the FYP.
 *
 * `now` is injected rather than read from the clock so ranking is deterministic
 * in tests and on stage — a demo that reorders itself between rehearsal and the
 * real run is a demo that surprises you.
 */
export function rankFyp(
  articles: readonly Article[],
  viewer: {
    ownedItemIds: readonly string[];
    followedGames: readonly GameTitle[];
    followedTopics: readonly FollowedTopic[];
  },
  now: number,
  limit = 20,
): RankedArticle[] {
  const owned = new Set(viewer.ownedItemIds);
  const games = new Set(viewer.followedGames);
  const topics = new Set(viewer.followedTopics.map((t) => t.value.toLowerCase()));

  return articles
    .map((article) => {
      let score = recencyBoost(article.publishedAt, now);
      let reason: string | null = null;

      const ownedHit = article.relatedItemIds.some((id) => owned.has(id));
      if (ownedHit) {
        score += WEIGHT_OWNED_ITEM;
        reason = 'Affects an item you own';
      }

      const gameHit = article.relatedGames.find((g) => games.has(g));
      if (gameHit) {
        score += WEIGHT_FOLLOWED_GAME;
        reason ??= 'From a game you follow';
      }

      const topicHit = article.tags.find((tag) => topics.has(tag.toLowerCase()));
      if (topicHit) {
        score += WEIGHT_FOLLOWED_TOPIC;
        reason ??= `You follow ${topicHit}`;
      }

      return { article, score, reason };
    })
    .filter((r) => r.reason !== null)
    .sort((a, b) => b.score - a.score || a.article.id.localeCompare(b.article.id))
    .slice(0, limit);
}

/** Discover: everything, newest first. No personalisation, no ranking model. */
export function rankDiscover(articles: readonly Article[], limit = 20): Article[] {
  return [...articles]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, limit);
}
