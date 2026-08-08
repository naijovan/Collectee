/**
 * News tab audit — one row per article per game tab, with the thumbnail each
 * one would actually resolve to.
 *
 * Written for this round's News work (jobs 3–5) and kept because it answers the
 * two questions the seed can silently get wrong: whether any tab shows the same
 * picture twice, and whether any article still carries more than one game chip.
 * Both are invisible in TypeScript and both look like a bug on screen.
 *
 * Not wired into the gates — `validate:fixtures` owns referential integrity.
 * Run it directly: `npx tsx scripts/check-news-tabs.ts`
 */
import { ARTICLES } from '../src/fixtures/articles';
import { pickThumbnailIds, rankGameFeed } from '../src/domain/news';
import { OWNED_ITEMS } from '../src/fixtures/owned-items';
import { FOLLOWED_TOPICS } from '../src/fixtures/social';
import { USERS_BY_ID, VIEWER_ID } from '../src/fixtures/users';
import { DEMO_NOW } from '../src/config/features';
import { GAME_TITLES, GAME_LABELS } from '../src/types';
import type { GameTitle } from '../src/types';

/* The viewer the tab is ranked for. Not a detail: `rankGameFeed` is
   personalised, so "the order the tab renders in" is per user. */
const viewer = USERS_BY_ID.get(VIEWER_ID)!;
const feedViewer = {
  ownedItemIds: OWNED_ITEMS.filter((o) => o.userId === VIEWER_ID).map((o) => o.itemId),
  followedGames: viewer.followedGames,
  followedTopics: FOLLOWED_TOPICS.filter((t) => t.userId === VIEWER_ID),
};

let problems = 0;

console.log(`${ARTICLES.length} articles\n`);

/* A card renders one chip per relatedGames entry, so anything above 1 puts two
   differently coloured chips on one card — the thing Job 4 removed. */
const multiGame = ARTICLES.filter((a) => a.relatedGames.length > 1);
if (multiGame.length > 0) {
  problems += multiGame.length;
  console.log('MULTI-GAME ARTICLES (two chips on one card):');
  for (const a of multiGame) console.log(`  ${a.id}  [${a.relatedGames.join(', ')}]`);
  console.log('');
} else {
  console.log('No multi-game articles — every card carries exactly one game chip.\n');
}

const itemless = ARTICLES.filter((a) => a.relatedItemIds.length === 0);
console.log(
  itemless.length === 0
    ? 'NO item-less article — the generic emblem thumbnail is now unreachable.'
    : `Item-less (these demo the generic emblem): ${itemless.map((a) => a.id).join(', ')}`,
);
if (itemless.length === 0) problems += 1;
console.log('');

for (const title of GAME_TITLES as readonly GameTitle[]) {
  /*
   * `rankGameFeed`, NOT newest-first.
   *
   * This sorted by publishedAt and called it "the order the tab renders in".
   * It is not: the News tab is personalised, so chronological is a made-up
   * order. That matters more than tidiness, because `pickThumbnailIds` walks
   * the list in order and hands each article the first of its ids not already
   * taken — a collision that exists in the real order can be invisible in a
   * fabricated one, and the other way round. Auditing the wrong order audits
   * nothing.
   */
  const tab = rankGameFeed(ARTICLES as never, feedViewer as never, title, DEMO_NOW, 50).map(
    (entry) => entry.article,
  );
  const thumbs = pickThumbnailIds(tab);

  console.log(`── ${GAME_LABELS[title]} — ${tab.length} articles`);
  const seen = new Map<string, string>();
  tab.forEach((a, i) => {
    /* null means no related item, so the card falls back to the per-game
       emblem. Two nulls in ONE tab would both draw that same emblem, which is a
       duplicate on screen even though the ids differ. */
    const key = thumbs[i] ?? `emblem:${title}`;
    const clash = seen.get(key);
    if (clash) {
      problems += 1;
      console.log(`   DUPLICATE  ${a.id} shares "${key}" with ${clash}`);
    }
    seen.set(key, a.id);
    console.log(`   ${(thumbs[i] ?? `(emblem: ${title})`).padEnd(34)} ${a.title.slice(0, 46)}`);
  });
  console.log('');
}

console.log(problems === 0 ? 'OK — no duplicate thumbnails, no multi-game cards.' : `${problems} problem(s).`);
process.exitCode = problems === 0 ? 0 : 1;
