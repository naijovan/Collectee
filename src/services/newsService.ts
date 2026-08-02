/**
 * News — PRD §11 F6. Flow owner: Marcus (J5). FIRST DESCOPE CANDIDATE (§14).
 *
 * If this flow is cut, flip `FEATURES.news` off rather than deleting code — the
 * Home rail disappears cleanly instead of leaving a hole (§13.4).
 *
 * §12.1 [OPTIONAL, ~2h, decide by 5 Aug]: `summarise()` is the ONE place a real
 * model call was proposed — article text in, four-bullet summary out, behind a
 * serverless function. It is the only thing that would make "there is a real
 * model call in this build" a true statement. Right now it returns the seeded
 * summary; swapping in a real call touches this function and nothing else.
 */

import { ARTICLES, ARTICLES_BY_ID } from '@/fixtures/articles';
import { FOLLOWED_TOPICS, SAVED_ARTICLES } from '@/fixtures/social';
import { OWNED_BY_USER } from '@/fixtures/owned-items';
import { USERS_BY_ID } from '@/fixtures/users';
import { rankDiscover, rankFyp } from '@/domain/news';
import type { RankedArticle } from '@/domain/news';
import type { Article } from '@/types';
import { LATENCY_FETCH, LATENCY_GENERATE, LATENCY_INSTANT, delay } from './latency';

const savedByUser = new Map<string, Set<string>>(
  SAVED_ARTICLES.reduce((map, saved) => {
    const set = map.get(saved.userId) ?? new Set<string>();
    set.add(saved.articleId);
    map.set(saved.userId, set);
    return map;
  }, new Map<string, Set<string>>()),
);

export const newsService = {
  /** Discover: general news, newest first. No personalisation. */
  async getDiscover(limit = 20): Promise<Article[]> {
    return delay(rankDiscover(ARTICLES, limit), LATENCY_FETCH);
  },

  /**
   * FYP: personalised by followed games, topics AND owned items.
   * `now` is injected so ranking cannot silently reorder between rehearsal and
   * the live run.
   */
  async getFyp(userId: string, now: number = Date.now(), limit = 20): Promise<RankedArticle[]> {
    const user = USERS_BY_ID.get(userId);
    if (!user) return delay([], LATENCY_INSTANT);

    const ownedItemIds = (OWNED_BY_USER.get(userId) ?? []).map((o) => o.itemId);
    const followedTopics = FOLLOWED_TOPICS.filter((t) => t.userId === userId);

    return delay(
      rankFyp(ARTICLES, { ownedItemIds, followedGames: user.followedGames, followedTopics }, now, limit),
      LATENCY_FETCH,
    );
  },

  async getArticle(id: string): Promise<Article | null> {
    return delay(ARTICLES_BY_ID.get(id) ?? null, LATENCY_INSTANT);
  },

  /**
   * The AI summary toggle on the article screen.
   *
   * ⚠️ Collectee never reproduces article bodies (§11 F6). A real implementation
   * summarises from the source and links out; it does not mirror the text.
   */
  async summarise(articleId: string): Promise<string[]> {
    const article = ARTICLES_BY_ID.get(articleId);
    if (!article) return delay([], LATENCY_INSTANT);
    const bullets = article.summary
      .split('. ')
      .map((s) => s.trim().replace(/\.$/, ''))
      .filter(Boolean);
    return delay(bullets, LATENCY_GENERATE);
  },

  async getSaved(userId: string): Promise<Article[]> {
    const ids = savedByUser.get(userId) ?? new Set<string>();
    const articles = [...ids]
      .map((id) => ARTICLES_BY_ID.get(id))
      .filter((a): a is Article => a !== undefined);
    return delay(articles, LATENCY_FETCH);
  },

  async toggleSaved(userId: string, articleId: string): Promise<boolean> {
    const set = savedByUser.get(userId) ?? new Set<string>();
    const nowSaved = !set.has(articleId);
    if (nowSaved) set.add(articleId);
    else set.delete(articleId);
    savedByUser.set(userId, set);
    return delay(nowSaved, LATENCY_INSTANT);
  },
};

export type NewsService = typeof newsService;
