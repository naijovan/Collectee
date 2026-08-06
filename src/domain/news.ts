/**
 * News curation — PRD §11 F6.
 *
 * Relevance is personalised by followed games, franchises, characters AND owned
 * items — a player who owns a skin for a champion being reworked should see
 * that patch note first.
 *
 * Three rankings, one scoring function:
 *   rankGameFeed  one game's news, same relevance, what the news screen shows
 *   rankFyp       cross-game personalised feed
 *   rankDiscover  everything, newest first, no personalisation
 *
 * `rankFyp` and `rankDiscover` are §11 F6's two named feeds and both still
 * work; the news screen went to per-game tabs because three games as peers
 * reads better in a four-minute demo than three chips that each mix them.
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
export interface NewsViewer {
  ownedItemIds: readonly string[];
  followedGames: readonly GameTitle[];
  followedTopics: readonly FollowedTopic[];
}

/** The reason a game tab must not print: the tab already says it. */
const REASON_FOLLOWED_GAME = 'From a game you follow';

/**
 * Score one article against one viewer. The single definition of relevance —
 * both feeds below call it, so a game tab and the cross-game feed can never
 * disagree about why an article matters or how much.
 */
function scoreArticle(
  article: Article,
  sets: { owned: Set<string>; games: Set<GameTitle>; topics: Set<string> },
  now: number,
): RankedArticle {
  let score = recencyBoost(article.publishedAt, now);
  let reason: string | null = null;

  const ownedHit = article.relatedItemIds.some((id) => sets.owned.has(id));
  if (ownedHit) {
    score += WEIGHT_OWNED_ITEM;
    reason = 'Affects an item you own';
  }

  const gameHit = article.relatedGames.find((g) => sets.games.has(g));
  if (gameHit) {
    score += WEIGHT_FOLLOWED_GAME;
    reason ??= REASON_FOLLOWED_GAME;
  }

  const topicHit = article.tags.find((tag) => sets.topics.has(tag.toLowerCase()));
  if (topicHit) {
    score += WEIGHT_FOLLOWED_TOPIC;
    reason ??= `You follow ${topicHit}`;
  }

  return { article, score, reason };
}

function viewerSets(viewer: NewsViewer) {
  return {
    owned: new Set(viewer.ownedItemIds),
    games: new Set(viewer.followedGames),
    topics: new Set(viewer.followedTopics.map((t) => t.value.toLowerCase())),
  };
}

function byScore(a: RankedArticle, b: RankedArticle): number {
  return b.score - a.score || a.article.id.localeCompare(b.article.id);
}

export function rankFyp(
  articles: readonly Article[],
  viewer: NewsViewer,
  now: number,
  limit = 20,
): RankedArticle[] {
  const sets = viewerSets(viewer);

  return articles
    .map((article) => scoreArticle(article, sets, now))
    .filter((r) => r.reason !== null)
    .sort(byScore)
    .slice(0, limit);
}

/**
 * One game's feed: the SAME relevance as the FYP, restricted to that game.
 *
 * Two deliberate differences from `rankFyp`, both because the tab itself is
 * context the cross-game feed does not have:
 *
 * 1. Articles with no reason are KEPT, sorted last. In the FYP a reasonless
 *    article is noise; in a game tab it is that game's news, and hiding it
 *    would mean unfollowing a game emptied its own tab.
 * 2. "From a game you follow" is not printed. It is true, it still scores, and
 *    it is the one thing the tab already told the user (§11 F5 asks for a
 *    reason that explains the placement, and a tautology explains nothing).
 *    Ownership and topic reasons still print — those are the ones that earn it.
 */
export function rankGameFeed(
  articles: readonly Article[],
  viewer: NewsViewer,
  title: GameTitle,
  now: number,
  limit = 20,
): RankedArticle[] {
  const sets = viewerSets(viewer);

  return articles
    .filter((article) => article.relatedGames.includes(title))
    .map((article) => scoreArticle(article, sets, now))
    .map((ranked) =>
      ranked.reason === REASON_FOLLOWED_GAME ? { ...ranked, reason: null } : ranked,
    )
    .sort(byScore)
    .slice(0, limit);
}

/** Discover: everything, newest first. No personalisation, no ranking model. */
export function rankDiscover(articles: readonly Article[], limit = 20): Article[] {
  return [...articles]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, limit);
}
