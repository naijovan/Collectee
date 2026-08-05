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

import { DEMO_NOW } from '@/config/features';
import { ARTICLES, ARTICLES_BY_ID } from '@/fixtures/articles';
import { FOLLOWED_TOPICS, SAVED_ARTICLES } from '@/fixtures/social';
import { USERS_BY_ID } from '@/fixtures/users';
import { inventoryService } from './inventoryService';
import { rankDiscover, rankFyp } from '@/domain/news';
import type { FollowedTopic, GameTitle, TopicKind } from '@/types';
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

/**
 * Session overlays for following (§11 F6).
 *
 * Seeded state stays in the fixtures; what the user changes this session lives
 * here, exactly like `created[]` in collectionService and `imported[]` in
 * inventoryService (§12.1 — no backend). Nothing mutates `User` or
 * `FOLLOWED_TOPICS`: those are the merge contract and the seed, and a toggle is
 * neither.
 */
const addedTopics = new Map<string, FollowedTopic[]>();
const removedTopics = new Map<string, Set<string>>();
const followedGameAdds = new Map<string, Set<GameTitle>>();
const unfollowedGames = new Map<string, Set<GameTitle>>();

function topicKey(userId: string, kind: TopicKind, value: string): string {
  return `${userId}:${kind}:${value.toLowerCase()}`;
}

function followedTopicsFor(userId: string): FollowedTopic[] {
  const removed = removedTopics.get(userId) ?? new Set<string>();
  const seeded = FOLLOWED_TOPICS.filter((t) => t.userId === userId);
  const session = addedTopics.get(userId) ?? [];

  // Deduplicated by key: unfollowing a seeded topic leaves a tombstone, and
  // re-following it clears the tombstone. Without this, a seeded topic that was
  // removed and re-added would appear twice — once from the seed and once from
  // the session list.
  const byKey = new Map<string, FollowedTopic>();
  for (const topic of [...seeded, ...session]) {
    const key = topicKey(userId, topic.kind, topic.value);
    if (removed.has(key)) continue;
    byKey.set(key, topic);
  }
  return [...byKey.values()];
}

function followedGamesFor(userId: string): GameTitle[] {
  const seeded = USERS_BY_ID.get(userId)?.followedGames ?? [];
  const dropped = unfollowedGames.get(userId) ?? new Set<GameTitle>();
  const extra = followedGameAdds.get(userId) ?? new Set<GameTitle>();
  return [...new Set([...seeded, ...extra])].filter((g) => !dropped.has(g));
}

export const newsService = {
  /** Discover: general news, newest first. No personalisation. */
  async getDiscover(limit = 20): Promise<Article[]> {
    return delay(rankDiscover(ARTICLES, limit), LATENCY_FETCH);
  },

  /**
   * FYP: personalised by followed games, topics AND owned items.
   * `now` is injected so ranking cannot silently reorder between rehearsal and
   * the live run.
   *
   * Ownership is read through `inventoryService`, never from
   * `@/fixtures/owned-items`. §11 F6's whole premise is that "a player who owns
   * a skin for a champion being reworked should see that patch note first" — and
   * a fixture read makes that false for every item imported or verified during
   * the session, which is exactly the run where a judge is watching.
   *
   * Unlike matching, this counts ALL owned items rather than verified ones:
   * relevance is about what you own, not what you can prove. The 3 Aug decision
   * scoped verified-only to matching, where verification is the incentive.
   */
  async getFyp(userId: string, now: number = DEMO_NOW, limit = 20): Promise<RankedArticle[]> {
    const user = USERS_BY_ID.get(userId);
    if (!user) return delay([], LATENCY_INSTANT);

    const ownedItemIds = inventoryService.getItemIdsByUser().get(userId) ?? [];
    // Overlaid, not seeded: unfollowing a game in Following management has to
    // change this feed on the next read, or the screen is decorative.
    const followedTopics = followedTopicsFor(userId);
    const followedGames = followedGamesFor(userId);

    return delay(
      rankFyp(ARTICLES, { ownedItemIds, followedGames, followedTopics }, now, limit),
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

  // ── Following management (§11 F6) ────────────────────────────────────
  /**
   * Topics this user follows, seeded plus anything changed this session.
   *
   * `FOLLOWED_TOPICS` is a fixture and stays one: session changes live in an
   * overlay here, the same shape as every other write in this build (§12.1 — no
   * backend). Followed GAMES are a field on `User` and are handled the same way
   * rather than mutating the entity, because `User` is the merge contract
   * (§12.3) and a session toggle is not a schema change.
   */
  async getFollowedTopics(userId: string): Promise<FollowedTopic[]> {
    return delay(followedTopicsFor(userId), LATENCY_INSTANT);
  },

  /** Add or remove a followed topic. Returns true when it is now followed. */
  async toggleFollowedTopic(
    userId: string,
    kind: TopicKind,
    value: string,
  ): Promise<boolean> {
    const key = topicKey(userId, kind, value);
    const removed = removedTopics.get(userId) ?? new Set<string>();
    const added = addedTopics.get(userId) ?? [];
    const isFollowed = followedTopicsFor(userId).some(
      (t) => t.kind === kind && t.value.toLowerCase() === value.toLowerCase(),
    );

    if (isFollowed) {
      removed.add(key);
      removedTopics.set(userId, removed);
      addedTopics.set(
        userId,
        added.filter((t) => topicKey(userId, t.kind, t.value) !== key),
      );
      return delay(false, LATENCY_INSTANT);
    }

    removed.delete(key);
    added.push({ userId, kind, value });
    addedTopics.set(userId, added);
    return delay(true, LATENCY_INSTANT);
  },

  /**
   * Followed games, as the FYP sees them: the seeded `User.followedGames` with
   * this session's toggles applied.
   */
  followedGamesFor(userId: string): GameTitle[] {
    return followedGamesFor(userId);
  },

  async toggleFollowedGame(userId: string, title: GameTitle): Promise<boolean> {
    const dropped = unfollowedGames.get(userId) ?? new Set<GameTitle>();
    const extra = followedGameAdds.get(userId) ?? new Set<GameTitle>();

    if (followedGamesFor(userId).includes(title)) {
      dropped.add(title);
      extra.delete(title);
      unfollowedGames.set(userId, dropped);
      followedGameAdds.set(userId, extra);
      return delay(false, LATENCY_INSTANT);
    }

    dropped.delete(title);
    extra.add(title);
    unfollowedGames.set(userId, dropped);
    followedGameAdds.set(userId, extra);
    return delay(true, LATENCY_INSTANT);
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
