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
import { byRarityDesc, groupByRarity, rarityBreakdown } from '@/domain/rarity';
import type { Item, OwnedItem, RarityTier } from '@/types';
import { LATENCY_FETCH, LATENCY_INSTANT, delay } from './latency';

/** Session-scoped imports layered over the seeded inventories (§12.1 — no backend). */
const imported: OwnedItem[] = [];
let nextId = 1;

function allFor(userId: string): OwnedItem[] {
  return [...(OWNED_BY_USER.get(userId) ?? []), ...imported.filter((o) => o.userId === userId)];
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
    const found =
      imported.find((o) => o.id === id) ?? OWNED_ITEMS.find((o) => o.id === id) ?? null;
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
    for (const owned of [...OWNED_ITEMS, ...imported]) {
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
    return delay(true, LATENCY_INSTANT);
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
