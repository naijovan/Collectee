/**
 * Fixture and source-tree integrity check. Run with `npm run validate:fixtures`.
 *
 * TypeScript catches shape errors at compile time (every fixture is written
 * `as const satisfies readonly T[]`). What it cannot catch is REFERENTIAL
 * integrity — a collection pointing at an item id that does not exist, a room
 * placing an item in a slot the theme does not have, a scan fixture whose
 * confidence values disagree with the routing thresholds.
 *
 * It also cannot catch a file that should not be there at all. See the
 * stray-file section at the bottom.
 *
 * Those are exactly the bugs that surface at 2am on the 6th, so they get a
 * script. Run it before every merge to main.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { assertRoomValid, placeWithNearestDisplacement } from '../src/domain/room';
import { assertScanConsistent, countScan } from '../src/domain/scan';
import { RARITY_LABELS } from '../src/domain/rarity';
import { CONTENT_REPORT_THRESHOLD } from '../src/domain/trust';
import { THREADS, THREAD_REPLIES } from '../src/fixtures/threads';
import type { Flag, Placement, Slot } from '../src/types';
import { GAME_TITLES } from '../src/types';
import { GAME_DIGESTS } from '../src/fixtures/digests';
import { ALL_ITEMS, ALL_SETS, ITEMS_BY_ID } from '../src/fixtures/catalogue';
import { COLLECTIONS, ROOMS, POSTS } from '../src/fixtures/collections';
import { OWNED_ITEMS } from '../src/fixtures/owned-items';
import { ROOM_THEMES } from '../src/fixtures/room-themes';
import { SCAN_RESULTS } from '../src/fixtures/scan-results';
import { ARTICLES } from '../src/fixtures/articles';
import { COMMENTS, COMMUNITIES, FLAGS, FOLLOWS, NOTIFICATIONS, SAVED_ARTICLES } from '../src/fixtures/social';
import { USERS, USERS_BY_ID, GAME_ACCOUNTS } from '../src/fixtures/users';

const errors: string[] = [];
const warnings: string[] = [];

function check(condition: boolean, message: string): void {
  if (!condition) errors.push(message);
}

function warn(condition: boolean, message: string): void {
  if (!condition) warnings.push(message);
}

// ── Items ──────────────────────────────────────────────────────────────
const itemIds = new Set<string>(ALL_ITEMS.map((i) => i.id));
check(itemIds.size === ALL_ITEMS.length, 'Duplicate item id in the catalogue');

for (const item of ALL_ITEMS) {
  check(
    item.popularityScore > 0 && item.popularityScore <= 1,
    `Item ${item.id}: popularityScore must be in (0, 1]`,
  );
  // §12.2 — the native label must match the rarity table for that title.
  const expected = RARITY_LABELS[item.rarityTier][item.title];
  check(
    expected === null || item.rarityLabel === expected || item.rarityLabel === 'Exclusive',
    `Item ${item.id}: rarityLabel "${item.rarityLabel}" does not match the §12.2 table (expected "${expected}")`,
  );
  check(
    item.setId === null || ALL_SETS.some((s) => s.id === item.setId),
    `Item ${item.id}: setId "${item.setId}" does not exist`,
  );
}

// ── Sets ───────────────────────────────────────────────────────────────
for (const set of ALL_SETS) {
  for (const id of set.itemIds) {
    check(itemIds.has(id), `Set ${set.id}: unknown item "${id}"`);
  }
  check(
    set.totalCount >= set.itemIds.length,
    `Set ${set.id}: totalCount (${set.totalCount}) is less than the ids it lists (${set.itemIds.length})`,
  );
}

// ── Users and ownership ────────────────────────────────────────────────
const userIds = new Set<string>(USERS.map((u) => u.id));
const ownedIds = new Set<string>();
for (const owned of OWNED_ITEMS) {
  check(userIds.has(owned.userId), `OwnedItem ${owned.id}: unknown user "${owned.userId}"`);
  check(itemIds.has(owned.itemId), `OwnedItem ${owned.id}: unknown item "${owned.itemId}"`);
  check(!ownedIds.has(owned.id), `Duplicate OwnedItem id "${owned.id}"`);
  ownedIds.add(owned.id);
  // §11 F1 step 6 — scanned items land unverified. Verified requires a linked account.
  check(
    !(owned.source === 'scan' && owned.trustLevel === 'verified'),
    `OwnedItem ${owned.id}: a scanned item cannot be verified (§9.2)`,
  );
}

for (const account of GAME_ACCOUNTS) {
  check(userIds.has(account.userId), `GameAccount: unknown user "${account.userId}"`);
}

// §9.3 — seeded data must contain a realistic mix of trust levels.
const verifiedCount = OWNED_ITEMS.filter((o) => o.trustLevel === 'verified').length;
warn(
  verifiedCount > 0 && verifiedCount < OWNED_ITEMS.length,
  '§9.3: seeded data should mix verified and unverified items',
);

// ── Collections, rooms, posts ──────────────────────────────────────────
const collectionIds = new Set<string>(COLLECTIONS.map((c) => c.id));
for (const collection of COLLECTIONS) {
  check(userIds.has(collection.userId), `Collection ${collection.id}: unknown user`);
  for (const id of collection.itemIds) {
    check(itemIds.has(id), `Collection ${collection.id}: unknown item "${id}"`);
  }
}

const themeIds = new Set<string>(ROOM_THEMES.map((t) => t.id));
for (const theme of ROOM_THEMES) {
  const slotIds = new Set(theme.slots.map((s) => s.id));
  check(slotIds.size === theme.slots.length, `Theme ${theme.id}: duplicate slot id`);
  for (const slot of theme.slots) {
    check(
      [slot.x, slot.y, slot.w, slot.h].every((n) => n >= 0 && n <= 1),
      `Theme ${theme.id}, slot ${slot.id}: coordinates must be fractional 0–1`,
    );
  }
}

for (const room of ROOMS) {
  check(collectionIds.has(room.collectionId), `Room ${room.id}: unknown collection`);
  check(themeIds.has(room.themeId), `Room ${room.id}: unknown theme "${room.themeId}"`);
  for (const placement of room.placements) {
    check(
      ownedIds.has(placement.ownedItemId),
      `Room ${room.id}: placement references unknown OwnedItem "${placement.ownedItemId}"`,
    );
  }
  try {
    assertRoomValid({ ...room, slots: [...room.slots], placements: [...room.placements] });
  } catch (error) {
    errors.push((error as Error).message);
  }
}

// An occupied drag target must keep both items and use the nearest vacancy.
const dragSlots = [
  { id: 'source', kind: 'wall', x: 0, y: 0, w: 0.1, h: 0.1, depth: 0 },
  { id: 'target', kind: 'wall', x: 0.5, y: 0, w: 0.1, h: 0.1, depth: 0 },
  { id: 'near', kind: 'wall', x: 0.62, y: 0, w: 0.1, h: 0.1, depth: 0 },
  { id: 'far', kind: 'wall', x: 0.9, y: 0, w: 0.1, h: 0.1, depth: 0 },
] satisfies readonly Slot[];
const dragPlacements = [
  { slotId: 'source', ownedItemId: 'dragged', rotation: 15 },
  { slotId: 'target', ownedItemId: 'displaced', rotation: 30 },
  { slotId: 'far', ownedItemId: 'stationary', rotation: 45 },
] satisfies readonly Placement[];
const dragResult = placeWithNearestDisplacement(
  dragPlacements,
  dragSlots,
  'dragged',
  'target',
);
check(
  dragResult.some(
    (placement) =>
      placement.ownedItemId === 'dragged' &&
      placement.slotId === 'target' &&
      placement.rotation === 15,
  ),
  'Room drag: dragged item did not take the occupied target',
);
check(
  dragResult.some(
    (placement) =>
      placement.ownedItemId === 'displaced' &&
      placement.slotId === 'near' &&
      placement.rotation === 30,
  ),
  'Room drag: displaced item did not move to the nearest empty slot',
);

for (const post of POSTS) {
  check(userIds.has(post.userId), `Post ${post.id}: unknown user`);
  const exists =
    post.type === 'collection'
      ? collectionIds.has(post.targetId)
      : ROOMS.some((r) => r.id === post.targetId);
  check(exists, `Post ${post.id}: target "${post.targetId}" does not exist`);
}

// ── Scans — the reconciliation the PRD demands ─────────────────────────
for (const scan of SCAN_RESULTS) {
  try {
    assertScanConsistent({ ...scan, detections: [...scan.detections] });
  } catch (error) {
    errors.push((error as Error).message);
  }
  for (const detection of scan.detections) {
    if (detection.itemId !== null) {
      check(
        itemIds.has(detection.itemId),
        `Scan ${scan.id}, detection ${detection.id}: unknown item "${detection.itemId}"`,
      );
    }
    for (const candidate of detection.candidateItemIds) {
      check(
        itemIds.has(candidate),
        `Scan ${scan.id}, detection ${detection.id}: unknown candidate "${candidate}"`,
      );
    }
  }
  const counts = countScan([...scan.detections]);
  check(
    counts.needsReview > 0,
    `Scan ${scan.id}: must demonstrate the Needs Review branch (§11 F1)`,
  );
}

// ── News and social ────────────────────────────────────────────────────
const articleIds = new Set<string>(ARTICLES.map((a) => a.id));
for (const article of ARTICLES) {
  for (const id of article.relatedItemIds) {
    check(itemIds.has(id), `Article ${article.id}: unknown related item "${id}"`);
  }
  check(article.url.startsWith('http'), `Article ${article.id}: must link out to the source (§11 F6)`);
}

/**
 * Digests (§11 F6). The seeded digest is what the news screen shows whenever
 * the live path does not run, which today is always — so "every game has a full
 * one, drawn from that game's own articles" is a correctness property, not a
 * content preference. TypeScript cannot check any of it.
 */
const articlesById = new Map(ARTICLES.map((a) => [a.id, a]));
for (const title of GAME_TITLES) {
  const digest = GAME_DIGESTS.filter((d) => d.title === title);
  check(digest.length === 1, `Digest: ${title} needs exactly one digest, found ${digest.length}`);
}
for (const digest of GAME_DIGESTS) {
  check(
    digest.bullets.length >= 3 && digest.bullets.length <= 4,
    `Digest ${digest.title}: needs 3-4 bullets, has ${digest.bullets.length}`,
  );
  for (const bullet of digest.bullets) {
    check(bullet.trim().length > 0, `Digest ${digest.title}: empty bullet`);
    // The card is a fixed-height header on the news screen; long bullets push
    // the articles below the fold.
    check(bullet.length <= 130, `Digest ${digest.title}: bullet over 130 chars — "${bullet.slice(0, 40)}…"`);
  }
  check(digest.sourceArticleIds.length > 0, `Digest ${digest.title}: cites no articles`);
  for (const id of digest.sourceArticleIds) {
    const article = articlesById.get(id);
    check(article !== undefined, `Digest ${digest.title}: unknown source article "${id}"`);
    check(
      article === undefined || (article.relatedGames as readonly string[]).includes(digest.title),
      `Digest ${digest.title}: source article "${id}" is not about ${digest.title}`,
    );
  }
}

for (const saved of SAVED_ARTICLES) {
  check(userIds.has(saved.userId), 'SavedArticle: unknown user');
  check(articleIds.has(saved.articleId), `SavedArticle: unknown article "${saved.articleId}"`);
}

for (const follow of FOLLOWS) {
  check(userIds.has(follow.followerId), `Follow: unknown follower "${follow.followerId}"`);
  check(userIds.has(follow.followeeId), `Follow: unknown followee "${follow.followeeId}"`);
  check(follow.followerId !== follow.followeeId, 'Follow: a user cannot follow themselves');
}

for (const community of COMMUNITIES) {
  for (const id of community.memberIds) {
    check(userIds.has(id), `Community ${community.id}: unknown member "${id}"`);
  }
  check(
    community.memberCount >= community.memberIds.length,
    `Community ${community.id}: memberCount is below the seeded member list`,
  );
}

for (const comment of COMMENTS) {
  check(userIds.has(comment.userId), `Comment ${comment.id}: unknown user`);
  if (comment.parentId !== null) {
    check(
      COMMENTS.some((c) => c.id === comment.parentId),
      `Comment ${comment.id}: unknown parent "${comment.parentId}"`,
    );
  }
}

/**
 * Widened deliberately. `as const satisfies` narrows FLAGS to the target types
 * that happen to be seeded today, which makes a check for any other kind look
 * unreachable to the compiler. These checks exist for the fixture someone adds
 * tomorrow, so they are written against the full `Flag` shape.
 */
const ALL_FLAGS: readonly Flag[] = FLAGS;

for (const flag of ALL_FLAGS) {
  check(userIds.has(flag.reporterId), `Flag ${flag.id}: unknown reporter`);
  if (flag.targetType === 'item') {
    check(ownedIds.has(flag.targetId), `Flag ${flag.id}: unknown OwnedItem "${flag.targetId}"`);
  }
  if (flag.targetType === 'comment') {
    const known =
      COMMENTS.some((c) => c.id === flag.targetId) ||
      THREAD_REPLIES.some((r) => r.id === flag.targetId);
    check(known, `Flag ${flag.id}: unknown comment "${flag.targetId}"`);
  }
  if (flag.targetType === 'user') {
    check(userIds.has(flag.targetId), `Flag ${flag.id}: unknown user "${flag.targetId}"`);
  }
}

// ── Community threads (§11 F5) ─────────────────────────────────────────
const communityIds = new Set<string>(COMMUNITIES.map((c) => c.id));
const threadIds = new Set<string>(THREADS.map((t) => t.id));
check(threadIds.size === THREADS.length, 'Duplicate thread id');

for (const thread of THREADS) {
  check(communityIds.has(thread.communityId), `Thread ${thread.id}: unknown community`);
  check(userIds.has(thread.userId), `Thread ${thread.id}: unknown author`);
  check(thread.title.trim().length > 0, `Thread ${thread.id}: empty title`);
}

const replyIds = new Set<string>(THREAD_REPLIES.map((r) => r.id));
for (const reply of THREAD_REPLIES) {
  check(reply.targetType === 'thread', `Reply ${reply.id}: targetType must be 'thread'`);
  check(threadIds.has(reply.targetId), `Reply ${reply.id}: unknown thread "${reply.targetId}"`);
  check(userIds.has(reply.userId), `Reply ${reply.id}: unknown author`);
  if (reply.parentId !== null) {
    check(replyIds.has(reply.parentId), `Reply ${reply.id}: unknown parent "${reply.parentId}"`);
    // domain/threads flattens depth > 1 rather than rendering it, but a fixture
    // that seeds depth 2 is a mistake, not a case to exercise.
    const parent = THREAD_REPLIES.find((r) => r.id === reply.parentId);
    check(
      parent?.parentId === null,
      `Reply ${reply.id}: nests two levels deep under "${reply.parentId}" — one level only (§11 F5)`,
    );
  }
}

// §8.2 — the seeded moderation case must actually be over its threshold, or the
// review queue is empty on the one screen that answers the judging theme.
const reportedReplies = ALL_FLAGS.filter(
  (f) => f.targetType === 'comment' && replyIds.has(f.targetId),
);
const reportedReplyIds = new Set(reportedReplies.map((f) => f.targetId));
check(
  reportedReplyIds.size > 0,
  '§8.2: seed at least one reported thread reply so the review queue is not empty',
);
for (const targetId of reportedReplyIds) {
  const reporters = new Set(
    reportedReplies.filter((f) => f.targetId === targetId).map((f) => f.reporterId),
  );
  check(
    reporters.size >= CONTENT_REPORT_THRESHOLD,
    `Reported reply "${targetId}" has ${reporters.size} distinct reporters; CONTENT_REPORT_THRESHOLD is ${CONTENT_REPORT_THRESHOLD} — it would sit below the threshold and never reach the queue`,
  );
}

for (const notification of NOTIFICATIONS) {
  check(userIds.has(notification.userId), `Notification ${notification.id}: unknown user`);
}

// §15 — implausible seeded numbers read as fake to anyone who plays these games.
for (const user of USERS) {
  const count = OWNED_ITEMS.filter((o) => o.userId === user.id).length;
  warn(count < 1000, `§15: ${user.displayName} owns ${count} items — keep counts plausible`);
}
check(USERS_BY_ID.size === USERS.length, 'Duplicate user id');
check(ITEMS_BY_ID.size === ALL_ITEMS.length, 'Duplicate item id in ITEMS_BY_ID');

// ── Stray files ────────────────────────────────────────────────────────
/**
 * File-sync services fork a file they see changing under them, keeping the
 * original and writing a sibling called "name 2.ext", then "name 3.ext".
 * iCloud does this, and on 5 Aug it did it to five files in this repo while
 * they were being edited — including `src/app/assistant 2.tsx`.
 *
 * ⚠️ ANYTHING under `src/app/` IS A ROUTE. A stray `news 2.tsx` is not clutter,
 * it is a second live screen serving whatever that file contained when the
 * fork happened — a dead route with stale code, reachable in the demo, and
 * invisible in `git status` if it is untracked or gitignored.
 *
 * Cheap to detect, so it is checked here rather than hoped about: the codebase
 * has no legitimate filename containing a space.
 */
const SCANNED_DIRS = ['src', 'api', 'scripts'];
const DUPLICATE_SUFFIX = / \d+\.[A-Za-z0-9]+$/;

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walk(path));
    else found.push(path);
  }
  return found;
}

for (const dir of SCANNED_DIRS) {
  for (const path of walk(dir)) {
    const name = path.split('/').pop() ?? path;
    if (!name.includes(' ')) continue;

    const isRoute = path.startsWith('src/app/');
    const looksForked = DUPLICATE_SUFFIX.test(name);

    check(
      false,
      isRoute && looksForked
        ? `GHOST ROUTE: "${path}" is a sync-service duplicate inside src/app/ — Expo Router will serve it. Delete it, and see the stray-file note in this script.`
        : looksForked
          ? `Stray duplicate "${path}" — a sync service forked this file. Delete it.`
          : `Filename contains a space: "${path}". No source file in this repo should.`,
    );
  }
}

// ── Report ─────────────────────────────────────────────────────────────
for (const warning of warnings) console.warn(`warn  ${warning}`);

if (errors.length > 0) {
  for (const error of errors) console.error(`error ${error}`);
  console.error(`\n${errors.length} fixture error(s).`);
  process.exit(1);
}

console.log(
  `Fixtures OK — ${ALL_ITEMS.length} items, ${ALL_SETS.length} sets, ${USERS.length} users, ` +
    `${OWNED_ITEMS.length} owned, ${COLLECTIONS.length} collections, ${ROOMS.length} rooms, ` +
    `${ROOM_THEMES.length} themes, ${ARTICLES.length} articles, ${GAME_DIGESTS.length} digests, ` +
    `${SCAN_RESULTS.length} scans, ${THREADS.length} threads, ${THREAD_REPLIES.length} replies.`,
);
