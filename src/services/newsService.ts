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

import { DEMO_NOW, FEATURES } from '@/config/features';
import { ARTICLES, ARTICLES_BY_ID } from '@/fixtures/articles';
import { DIGESTS_BY_GAME } from '@/fixtures/digests';
import { FOLLOWED_TOPICS, SAVED_ARTICLES } from '@/fixtures/social';
import { USERS_BY_ID } from '@/fixtures/users';
import { inventoryService } from './inventoryService';
import { rankDiscover, rankFyp, rankGameFeed } from '@/domain/news';
import { GAME_LABELS } from '@/types';
import type { FollowedTopic, GameTitle, TopicKind } from '@/types';
import type { RankedArticle } from '@/domain/news';
import type { Article } from '@/types';
import { LATENCY_GENERATE, LATENCY_INSTANT, delay } from './latency';

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

/**
 * The deployed `/api/assistant` endpoint (§12.1). Blank = the feature is off,
 * whatever `FEATURES.liveSummarisation` says.
 *
 * The Anthropic key is NOT here and must never be: `EXPO_PUBLIC_*` values are
 * bundled into the shipped JavaScript, the key is billed, and the repo's own
 * env template says not to. The key lives in the serverless function's
 * environment — see `api/assistant.ts`.
 */
const AI_PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL ?? '';

/**
 * Abandon the call after this long.
 *
 * The demo runs in four minutes on conference wifi. A summariser that hangs is
 * worse than one that never ran — the prepared summary is one render away, so
 * waiting past a few seconds buys nothing.
 */
const SUMMARY_TIMEOUT_MS = 5_000;

/**
 * Bullets plus where they came from. Both AI surfaces return this shape,
 * because both do the same thing with it: render the bullets, label the source.
 */
export interface SummaryResult {
  bullets: string[];
  /** True only when a model actually produced these. Drives the on-screen label. */
  live: boolean;
}

export type DigestResult = SummaryResult;

/** The seeded fallback: the prepared summary, split into bullets. */
function preparedBullets(article: Article): string[] {
  return article.summary
    .split('. ')
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter(Boolean);
}

/**
 * Call the proxy. Returns null on ANY failure — timeout, network, non-200,
 * malformed body, empty result.
 *
 * Null is not an error path bolted on; it is the contract. Nothing about this
 * feature may put the demo in a broken state (§12.1 — the whole reason the rest
 * of the AI layer is mocked is that a live call that fails on stage is a worse
 * demo than a deterministic one). Every caller substitutes seeded copy and the
 * screen says which it is showing.
 */
async function callProxy(body: unknown): Promise<string[] | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SUMMARY_TIMEOUT_MS);

  try {
    const response = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { bullets?: unknown };
    if (!Array.isArray(payload.bullets)) return null;

    const bullets = payload.bullets.filter(
      (bullet): bullet is string => typeof bullet === 'string' && bullet.trim().length > 0,
    );
    return bullets.length > 0 ? bullets : null;
  } catch {
    // Includes the abort. Deliberately swallowed — see the doc comment.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** True when the live path is both switched on and pointed somewhere. */
function liveEnabled(): boolean {
  return FEATURES.liveSummarisation && AI_PROXY_URL.length > 0;
}

// Only the title and the seeded summary are sent. Collectee never holds full
// article bodies (§11 F6 — summaries link out, we do not reproduce the
// article), so there is nothing else to send.
function callSummariser(article: Article): Promise<string[] | null> {
  return callProxy({ mode: 'summary', title: article.title, body: article.summary });
}

function callDigester(title: GameTitle, articles: readonly Article[]): Promise<string[] | null> {
  return callProxy({
    mode: 'digest',
    game: GAME_LABELS[title],
    articles: articles.map((a) => ({ title: a.title, summary: a.summary })),
  });
}

/**
 * The prepared bullets for a title. A game with no digest fixture cannot happen
 * — `validate-fixtures` requires one per title — but if one ever did, this
 * returns no bullets rather than inventing any, and the card hides itself.
 */
function seededDigest(title: GameTitle): DigestResult {
  const seeded = DIGESTS_BY_GAME.get(title);
  return { bullets: seeded ? [...seeded.bullets] : [], live: false };
}

function followedGamesFor(userId: string): GameTitle[] {
  const seeded = USERS_BY_ID.get(userId)?.followedGames ?? [];
  const dropped = unfollowedGames.get(userId) ?? new Set<GameTitle>();
  const extra = followedGameAdds.get(userId) ?? new Set<GameTitle>();
  return [...new Set([...seeded, ...extra])].filter((g) => !dropped.has(g));
}

/**
 * ── ON LATENCY TIERS IN THIS FILE ─────────────────────────────────────────
 * Every article list resolves at `LATENCY_INSTANT`, not `LATENCY_FETCH`.
 *
 * `LATENCY_FETCH` exists to keep a screen honest about a request that will be
 * a real one in phase 2 — it stops a missing loading state hiding until the
 * day a network call appears. These reads will not become network calls: they
 * are a filter and a sort over eight seeded articles held in memory, and
 * `rankGameFeed` is pure arithmetic. Charging them 320ms bought a loading
 * state nothing will ever need and made the feed look like it was fetching
 * when it had already finished.
 *
 * `getDigest` KEEPS `LATENCY_GENERATE`, and that distinction is the point: it
 * is the one call here that really does hit a model. Its slot showing a
 * placeholder while the articles below it are already readable is the correct
 * behaviour, not the bug — see the progressive render in `app/news.tsx`.
 */
export const newsService = {
  /** Discover: general news, newest first. No personalisation. */
  async getDiscover(limit = 20): Promise<Article[]> {
    return delay(rankDiscover(ARTICLES, limit), LATENCY_INSTANT);
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
      LATENCY_INSTANT,
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
  async summarise(articleId: string): Promise<SummaryResult> {
    const article = ARTICLES_BY_ID.get(articleId);
    if (!article) return delay({ bullets: [], live: false }, LATENCY_INSTANT);

    if (liveEnabled()) {
      const live = await callSummariser(article);
      if (live) return { bullets: live, live: true };
      // Fell through: timed out, unreachable, refused, or unparseable. The
      // prepared summary below is the answer, and the label stays honest.
    }

    return delay({ bullets: preparedBullets(article), live: false }, LATENCY_GENERATE);
  },

  /**
   * One game's news, ranked exactly as the FYP ranks it (§11 F6).
   *
   * Same ownership, following and recency signals as `getFyp` — the tab is a
   * filter on relevance, not a different idea of what is relevant.
   */
  async getGameFeed(
    userId: string,
    title: GameTitle,
    now: number = DEMO_NOW,
    limit = 20,
  ): Promise<RankedArticle[]> {
    const user = USERS_BY_ID.get(userId);
    if (!user) return delay([], LATENCY_INSTANT);

    const ownedItemIds = inventoryService.getItemIdsByUser().get(userId) ?? [];
    const followedTopics = followedTopicsFor(userId);
    const followedGames = followedGamesFor(userId);

    return delay(
      rankGameFeed(
        ARTICLES,
        { ownedItemIds, followedGames, followedTopics },
        title,
        now,
        limit,
      ),
      LATENCY_INSTANT,
    );
  },

  /**
   * "What's happening in <game>" — the digest card above each game's feed.
   *
   * The seeded digest in `@/fixtures/digests` is the DEFAULT, not a degraded
   * state: with `liveSummarisation` off or no endpoint configured, which is the
   * build as it stands, it is what every render shows. The live call replaces
   * its bullets when it succeeds and `live` tells the screen which to label.
   *
   * A game with no digest fixture cannot happen — `validate-fixtures` requires
   * one per title — but if one ever did, this returns no bullets rather than
   * inventing any, and the card hides itself.
   */
  /**
   * The prepared digest, with no model call — the first half of the card's
   * two-stage load.
   *
   * Exists so the slot is never empty while the live call is in flight.
   * Measured against the deployed proxy, that call takes 1.1-1.5s; the screen
   * used to hold a grey rectangle for all of it, and under the first-run
   * spotlight that rectangle was the thing being pointed at.
   *
   * This is not a second-class result. `liveSummarisation` off means these
   * bullets ARE the digest, which is what they were for the first five days of
   * that flag's life — so showing them first and upgrading is the same content
   * in a better order, not a placeholder pretending to be an answer.
   */
  async getSeededDigest(title: GameTitle): Promise<DigestResult> {
    return delay(seededDigest(title), LATENCY_INSTANT);
  },

  async getDigest(title: GameTitle): Promise<DigestResult> {
    // Widened deliberately: `ARTICLES` is `as const`, so `relatedGames` is a
    // tuple of literals and `.includes` narrows its argument to `never`.
    const all: readonly Article[] = ARTICLES;
    const articles = all.filter((a) => a.relatedGames.includes(title));

    const fallback: DigestResult = seededDigest(title);

    if (liveEnabled() && articles.length > 0) {
      // Grounded in the same articles the tab below is showing, so the digest
      // cannot describe news the user then fails to find (§11 F6).
      const live = await callDigester(title, articles);
      if (live) return { bullets: live, live: true };

      // No mock latency on this path. `LATENCY_GENERATE` exists to make mocked
      // generation feel like generation; adding it AFTER a real 5s timeout just
      // makes the card empty for nearly seven seconds. Measured: 6.8s with the
      // delay, 5.0s without. The article screen keeps its delay because opening
      // a summary is a deliberate action where a wait reads as work — this is a
      // header the user did not ask for.
      return fallback;
    }

    return delay(fallback, LATENCY_GENERATE);
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

  /**
   * Follow a topic, idempotently. Already following it is success, not a
   * toggle.
   *
   * The same trap as `setFollowedGames`, one layer along, and it bites harder
   * because the collision is invisible: the viewer is seeded following
   * `franchise: Elderflame` and `character: Gusion`, and both are among the
   * chips the first-run quiz derives from the catalogue. Picking either through
   * `toggleFollowedTopic` would have UNFOLLOWED it — the user selects Gusion
   * and the feed loses the two Gusion articles.
   *
   * A screen that means "make this followed" should say so rather than ask for
   * a toggle and hope the seeded state agrees.
   */
  async followTopic(userId: string, kind: TopicKind, value: string): Promise<void> {
    const alreadyFollowed = followedTopicsFor(userId).some(
      (t) => t.kind === kind && t.value.toLowerCase() === value.toLowerCase(),
    );
    if (alreadyFollowed) return delay(undefined, LATENCY_INSTANT);

    const key = topicKey(userId, kind, value);
    const removed = removedTopics.get(userId) ?? new Set<string>();
    const added = addedTopics.get(userId) ?? [];

    // Clearing the tombstone matters: following something that was unfollowed
    // earlier this session has to bring it back, not add a second entry that
    // `followedTopicsFor` then filters straight out again.
    removed.delete(key);
    added.push({ userId, kind, value });
    removedTopics.set(userId, removed);
    addedTopics.set(userId, added);

    return delay(undefined, LATENCY_INSTANT);
  },

  /**
   * Replace the followed-game set outright.
   *
   * Exists because the first-run quiz asks "which of these do you play?" and
   * that is an ASSIGNMENT, not a series of toggles. The viewer is seeded
   * following all three titles (§12.3), so a quiz answer of "just CODM" run
   * through `toggleFollowedGame` for each pick would unfollow CODM and leave
   * Valorant and MLBB followed — the exact inverse of the answer. The bug is
   * invisible in a screen that toggles one chip at a time, which is why the
   * fix belongs here rather than in a loop at the call site.
   *
   * Writes the same two overlays as the toggle, so seeded data stays untouched
   * (§12.1) and `resetSessionFollowing` still undoes it.
   */
  async setFollowedGames(userId: string, titles: readonly GameTitle[]): Promise<GameTitle[]> {
    const seeded = USERS_BY_ID.get(userId)?.followedGames ?? [];
    const wanted = new Set(titles);

    // Adds are what the seed does not already give us; drops are what the seed
    // gives us and the answer did not ask for. Expressed against the seed
    // rather than the current overlay so calling this twice is idempotent.
    followedGameAdds.set(userId, new Set(titles.filter((t) => !seeded.includes(t))));
    unfollowedGames.set(userId, new Set(seeded.filter((t) => !wanted.has(t))));

    return delay(followedGamesFor(userId), LATENCY_INSTANT);
  },

  /**
   * Drop every session change to following, back to the seeded state.
   *
   * The first run is the one flow that cannot be rehearsed twice without this.
   * Everything the quiz writes lands in the four overlays above, and there is
   * no persistence layer to clear instead (§12.1) — so without a reset the
   * second take through the quiz starts with the first take's answers already
   * applied, and picking "just VALORANT" after picking "just CODM" produces a
   * feed that matches neither.
   *
   * A Promise like every other service method, even though the work is four
   * `Map.delete` calls — the caller is a synchronous state reset and voids it.
   * Phase 2 makes this a real request, and the alternative is that this is the
   * one method that has to change shape when it does.
   */
  async resetSessionFollowing(userId: string): Promise<void> {
    addedTopics.delete(userId);
    removedTopics.delete(userId);
    followedGameAdds.delete(userId);
    unfollowedGames.delete(userId);
    return delay(undefined, LATENCY_INSTANT);
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
    return delay(articles, LATENCY_INSTANT);
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
