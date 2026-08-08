/**
 * Owned items — the inventory every flow reads from.
 *
 * This is the shared surface §12.3 warns about: "All flows read the same
 * `OwnedItem` and `Collection` shapes. If each person invents their own fixture
 * structure, merge day becomes a rewrite."
 *
 * Import writes here. Collections, Rooms, Discover and FYP all read from here.
 */

import { OWNED_BY_USER, OWNED_ITEMS } from '@/fixtures/owned-items';
import { ITEMS_BY_ID } from '@/fixtures/catalogue';
import { GAME_ACCOUNTS } from '@/fixtures/users';
import { byRarityDesc, groupByRarity, rarityBreakdown } from '@/domain/rarity';
import type { GameAccount, GameTitle, Item, LinkStatus, OwnedItem, RarityTier } from '@/types';
import { LATENCY_FETCH, LATENCY_GENERATE, LATENCY_INSTANT, delay, delayWithProgress } from './latency';

/** Session-scoped imports layered over the seeded inventories (§12.1 — no backend). */
const imported: OwnedItem[] = [];
let nextId = 1;

/**
 * Items promoted to verified by a (mocked) account link this session, keyed by
 * OwnedItem id.
 *
 * An overlay rather than a mutation: the seeded fixtures are `as const` and must
 * stay the source of truth, and keeping promotions separate means `unlinkAccount`
 * can put the demo back exactly where it started for the next rehearsal run.
 */
const promoted = new Map<string, OwnedItem>();

/** Session link state, layered over the seeded GAME_ACCOUNTS records. */
const linkStatuses = new Map<string, LinkStatus>();

const linkKey = (userId: string, title: GameTitle) => `${userId}:${title}`;

function withPromotions(items: readonly OwnedItem[]): OwnedItem[] {
  return items.map((owned) => promoted.get(owned.id) ?? owned);
}

function allFor(userId: string): OwnedItem[] {
  return withPromotions([
    ...(OWNED_BY_USER.get(userId) ?? []),
    ...imported.filter((o) => o.userId === userId),
  ]);
}

function everyOwnedItem(): OwnedItem[] {
  return withPromotions([...OWNED_ITEMS, ...imported]);
}

export interface OwnedItemView {
  owned: OwnedItem;
  item: Item;
}

export const inventoryService = {
  async getOwnedItems(userId: string): Promise<OwnedItem[]> {
    return delay(allFor(userId), LATENCY_FETCH);
  },

  /** Owned items joined to their catalogue entries, rarest first. */
  async getInventory(userId: string): Promise<OwnedItemView[]> {
    const views = allFor(userId)
      .map((owned) => ({ owned, item: ITEMS_BY_ID.get(owned.itemId) }))
      .filter((v): v is OwnedItemView => v.item !== undefined)
      .sort((a, b) => byRarityDesc(a.item, b.item));
    return delay(views, LATENCY_FETCH);
  },

  async getOwnedItem(id: string): Promise<OwnedItem | null> {
    const found = everyOwnedItem().find((o) => o.id === id) ?? null;
    return delay(found, LATENCY_INSTANT);
  },

  /**
   * userId → the item ids that user owns, seeded inventories and session
   * imports merged.
   *
   * Synchronous on purpose, mirroring `catalogueService.getCatalogueMap()`:
   * collector matching (§11 F5) and FYP ranking (§11 F6) score every candidate
   * in one pass, so a per-user `await` would put N × LATENCY_FETCH on a screen
   * mount for data already in memory.
   *
   * This exists so no sibling service reaches into `@/fixtures/owned-items`
   * directly. A service that reads the fixture sees the seeded data only, and
   * everything a user imports during the demo is invisible to it — which is
   * exactly the bug this method removes from Discover and the FYP.
   */
  getItemIdsByUser(): ReadonlyMap<string, readonly string[]> {
    const byUser = new Map<string, string[]>();
    for (const owned of everyOwnedItem()) {
      const existing = byUser.get(owned.userId);
      if (existing) existing.push(owned.itemId);
      else byUser.set(owned.userId, [owned.itemId]);
    }
    return byUser;
  },

  /**
   * The same map, restricted to items whose ownership is VERIFIED.
   *
   * Team decision (3 Aug): collector and community matching counts verified
   * items only — verification is the incentive, so an unverified item
   * contributes nothing to a match score.
   *
   * Kept separate from `getItemIdsByUser` rather than folded into it, because
   * matching needs both: the verified set to score with, and the full set to
   * tell "owns nothing yet" apart from "owns plenty, has verified none". Those
   * two states get different answers and conflating them prints a plausible
   * percentage built on nothing (§11 F5).
   */
  getVerifiedItemIdsByUser(): ReadonlyMap<string, readonly string[]> {
    const byUser = new Map<string, string[]>();
    for (const owned of everyOwnedItem()) {
      if (owned.trustLevel !== 'verified') continue;
      const existing = byUser.get(owned.userId);
      if (existing) existing.push(owned.itemId);
      else byUser.set(owned.userId, [owned.itemId]);
    }
    return byUser;
  },

  /**
   * Import scanner results.
   *
   * §11 F1 step 6: items land as `unverified`. The scanner NEVER produces a
   * verified item — verification requires a connected game account, and that is
   * partnership-gated (§9.3). Do not add a code path that sets `verified` here.
   */
  async importFromScan(
    userId: string,
    itemIds: readonly string[],
    confidenceByItemId: ReadonlyMap<string, number> = new Map(),
  ): Promise<OwnedItem[]> {
    const existing = new Set(allFor(userId).map((o) => o.itemId));
    const acquiredAt = new Date().toISOString();

    const added = itemIds
      .filter((itemId) => !existing.has(itemId) && ITEMS_BY_ID.has(itemId))
      .map<OwnedItem>((itemId) => ({
        id: `own-imported-${nextId++}`,
        userId,
        itemId,
        trustLevel: 'unverified',
        source: 'scan',
        confidence: confidenceByItemId.get(itemId) ?? null,
        quantity: 1,
        acquiredAt,
      }));

    imported.push(...added);
    return delay(added, LATENCY_FETCH);
  },

  // ── Account linking — the only path to verified (§9.2, §9.3) ─────────

  /**
   * Seeded link records with any session change applied.
   *
   * ⚠️ `linked` here means "we pretended". §9.3: real account linking is
   * PARTNERSHIP-gated, not engineering-gated — none of the three launch titles
   * exposes a public cosmetic-inventory API. The pitch must say so if asked.
   */
  getGameAccounts(userId: string): GameAccount[] {
    return GAME_ACCOUNTS.filter((account) => account.userId === userId).map((account) => ({
      ...account,
      linkStatus: linkStatuses.get(linkKey(userId, account.title)) ?? account.linkStatus,
    }));
  },

  getLinkStatus(userId: string, title: GameTitle): LinkStatus {
    return (
      linkStatuses.get(linkKey(userId, title)) ??
      GAME_ACCOUNTS.find((a) => a.userId === userId && a.title === title)?.linkStatus ??
      'unlinked'
    );
  },

  /** Owned items for one title, so a screen can show what a link would confirm. */
  itemsForTitle(userId: string, title: GameTitle): OwnedItem[] {
    return allFor(userId).filter((owned) => ITEMS_BY_ID.get(owned.itemId)?.title === title);
  },

  /**
   * Link (or re-sync) a game account, promoting that title's items to verified.
   *
   * This is the ONLY way an item becomes verified. A scan never produces one
   * (§11 F1 step 6) — the scanner reads a screenshot, which says nothing about
   * who owns the item, and §9.1 is the record of that argument being settled.
   * Promoted items also take `source: 'linked-account'`, because that is now how
   * the claim is established and `validate-fixtures.ts` rejects a verified scan.
   *
   * Re-sync exists because linking is not once-and-for-all: items acquired after
   * the last read stay unverified until the account is read again, which is
   * exactly the seeded state of the viewer's CODM account.
   *
   * ── `onlyItemIds` ────────────────────────────────────────────────────────
   * Narrows the promotion to specific items without changing what linking
   * means. The Import flow's Verify step passes the items that import just
   * wrote, so confirming a batch of new skins does not silently sweep up every
   * other unverified item on the account — a user who imports three skins
   * expects three to change, and watching their whole inventory flip is both
   * surprising and impossible to undo per item.
   *
   * The account still ends up `linked`, which is not a contradiction: this
   * model already separates the link from what it has confirmed, which is the
   * same reason re-sync exists at all. Omit it and the behaviour is unchanged —
   * the link-account screen still promotes everything, because there the user
   * asked about the account rather than about a handful of items.
   *
   * Everything here is mocked (§12.1). It is a timed loading state over a local
   * map, and the screen says so.
   */
  async linkAccount(
    userId: string,
    title: GameTitle,
    onProgress?: (fraction: number) => void,
    onlyItemIds?: readonly string[],
  ): Promise<{ verified: OwnedItem[]; alreadyVerified: number }> {
    const mine = this.itemsForTitle(userId, title);
    const scope = onlyItemIds === undefined ? null : new Set(onlyItemIds);
    const inScope = scope === null ? mine : mine.filter((owned) => scope.has(owned.itemId));
    const toPromote = inScope.filter((owned) => owned.trustLevel !== 'verified');

    for (const owned of toPromote) {
      promoted.set(owned.id, {
        ...owned,
        trustLevel: 'verified',
        source: 'linked-account',
        // Scanner confidence is meaningless once an account has confirmed the
        // item — keeping it would imply the vision model did the verifying.
        confidence: null,
      });
    }
    linkStatuses.set(linkKey(userId, title), 'linked');

    return delayWithProgress(
      // Counted against what was in scope, not the whole account — otherwise a
      // three-item import would report every other verified item on the
      // account as "already verified" and the two numbers would not add up to
      // anything the user recognises.
      { verified: toPromote, alreadyVerified: inScope.length - toPromote.length },
      LATENCY_GENERATE,
      onProgress,
    );
  },

  /**
   * Undo a session link. Rehearsal affordance: it puts the demo back to the
   * seeded state so the same beat can be run again without restarting the app.
   */
  async unlinkAccount(userId: string, title: GameTitle): Promise<void> {
    for (const owned of this.itemsForTitle(userId, title)) promoted.delete(owned.id);
    linkStatuses.set(linkKey(userId, title), 'unlinked');
    await delay(null, LATENCY_INSTANT);
  },

  /** Manual add — the fallback when the scanner misses something. */
  async addManual(userId: string, itemId: string): Promise<OwnedItem | null> {
    if (!ITEMS_BY_ID.has(itemId)) return delay(null, LATENCY_INSTANT);
    const owned: OwnedItem = {
      id: `own-manual-${nextId++}`,
      userId,
      itemId,
      trustLevel: 'unverified',
      source: 'manual',
      confidence: null,
      quantity: 1,
      acquiredAt: new Date().toISOString(),
    };
    imported.push(owned);
    return delay(owned, LATENCY_INSTANT);
  },

  /** "Every auto-accepted item is reversible in Review." (§11 F1) */
  async remove(ownedItemId: string): Promise<boolean> {
    const index = imported.findIndex((o) => o.id === ownedItemId);
    if (index === -1) return delay(false, LATENCY_INSTANT);
    imported.splice(index, 1);
    // A removed item must not leave a promotion behind: the overlay is keyed by
    // OwnedItem id, and a stale entry outlives the item it describes.
    promoted.delete(ownedItemId);
    return delay(true, LATENCY_INSTANT);
  },

  /**
   * Drop everything this session imported or added by hand, restoring the
   * seeded inventory. Returns how many records went.
   *
   * Rehearsal affordance, the sibling of `unlinkAccount`. With no persistence
   * (§12.1) the import can only be demonstrated ONCE per app launch: the second
   * run of the same screenshot re-detects the same items, every one of them is
   * filtered here as already owned, and the completion screen correctly reports
   * that nothing new was added. That is the right answer to the wrong question
   * when you are trying to show the flow — this is the way back.
   *
   * Only session records go. The seeded fixtures are `as const` and stay the
   * source of truth, so an inventory can never be emptied past what it shipped
   * with, and nothing another flow reads can be deleted out from under it.
   */
  async clearSessionImports(userId: string): Promise<number> {
    let removed = 0;
    for (let index = imported.length - 1; index >= 0; index -= 1) {
      const owned = imported[index]!;
      if (owned.userId !== userId) continue;
      promoted.delete(owned.id);
      imported.splice(index, 1);
      removed += 1;
    }
    return delay(removed, LATENCY_INSTANT);
  },

  async getRarityBreakdown(userId: string): Promise<Record<RarityTier, number>> {
    const items = allFor(userId)
      .map((o) => ITEMS_BY_ID.get(o.itemId))
      .filter((i): i is Item => i !== undefined);
    return delay(rarityBreakdown(items), LATENCY_INSTANT);
  },

  /** Grouped by tier, rarest first — the Review screen's layout (§11 F1 step 6). */
  async getGroupedByRarity(userId: string): Promise<{ tier: RarityTier; items: Item[] }[]> {
    const items = allFor(userId)
      .map((o) => ITEMS_BY_ID.get(o.itemId))
      .filter((i): i is Item => i !== undefined);
    return delay(groupByRarity(items), LATENCY_INSTANT);
  },

  /** Total item count. Keep this in the hundreds in seeded data (§15). */
  async getItemCount(userId: string): Promise<number> {
    return delay(allFor(userId).length, LATENCY_INSTANT);
  },
};

export type InventoryService = typeof inventoryService;
