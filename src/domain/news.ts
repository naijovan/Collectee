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

/**
 * Which item supplies each article's thumbnail, chosen so a list does not show
 * the same picture twice.
 *
 * ── Why this is not `relatedItemIds[0]` ───────────────────────────────────
 * That was the first implementation and it produced a visible bug: MLBB's two
 * articles both list `mlbb-gusion-cyber-faust` FIRST — one is about the
 * Collector rotation, the other about Gusion's rework, and Gusion's Cyber Faust
 * is legitimately the lead item for both — so two adjacent rows rendered the
 * identical portrait. The ids are not wrong and the art is not shared; twelve
 * ids resolve to twelve distinct files. The list simply asked the wrong
 * question.
 *
 * ── Why it lives here and not in the card ─────────────────────────────────
 * "Do not repeat the row above" is a property of the LIST, and `ArticleCard`
 * renders one article with no knowledge of its siblings. Pushing it into the
 * component would mean either a module-level mutable set — which breaks on a
 * re-render and leaks between screens — or threading an index that still could
 * not see what the other rows chose. It is pure list-in, list-out, so it lives
 * in the domain layer with the rest of the ranking.
 *
 * ── Why not reorder the fixture instead ───────────────────────────────────
 * Swapping the two ids in `fixtures/articles.ts` would fix today's collision in
 * one line. It would also make ARRAY ORDER silently mean "this one is the
 * thumbnail", a rule written down nowhere, enforced by nothing, and undone the
 * next time someone reorders those ids for an editorial reason. Order stays a
 * preference here — first choice, not a promise.
 *
 * Greedy and order-dependent by design: earlier rows get their preferred item,
 * later rows take the first of theirs nobody upstream has used. Deterministic
 * for a given list, and the feed order is itself deterministic (`DEMO_NOW`).
 * When every candidate is taken it falls back to the preferred one — a repeat
 * beats an empty slot — and an article with no related items returns null and
 * gets the generic per-game thumbnail.
 */
export function pickThumbnailIds(articles: readonly Article[]): (string | null)[] {
  const used = new Set<string>();
  return articles.map((article) => {
    const unused = article.relatedItemIds.find((id) => !used.has(id));
    const chosen = unused ?? article.relatedItemIds[0] ?? null;
    if (chosen !== null) used.add(chosen);
    return chosen;
  });
}
