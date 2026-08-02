/**
 * Item catalogue access — PRD §12.1 `catalogueService`.
 *
 * Owner: shared. Change via PR announced in chat.
 *
 * Screens NEVER import fixtures directly (§13.1). Everything goes through here,
 * so phase 2 replaces the fixture import with a fetch and nothing else moves.
 */

import { ALL_ITEMS, ALL_SETS, ITEMS_BY_ID, ITEMS_BY_TITLE, SETS_BY_ID } from '@/fixtures/catalogue';
import { byRarityDesc } from '@/domain/rarity';
import type { GameTitle, Item, ItemSet } from '@/types';
import { LATENCY_INSTANT, delay } from './latency';

export const catalogueService = {
  async getAllItems(): Promise<Item[]> {
    return delay([...ALL_ITEMS], LATENCY_INSTANT);
  },

  async getItemsByTitle(title: GameTitle): Promise<Item[]> {
    return delay([...ITEMS_BY_TITLE[title]], LATENCY_INSTANT);
  },

  async getItem(id: string): Promise<Item | null> {
    return delay(ITEMS_BY_ID.get(id) ?? null, LATENCY_INSTANT);
  },

  async getItems(ids: readonly string[]): Promise<Item[]> {
    const items = ids
      .map((id) => ITEMS_BY_ID.get(id))
      .filter((i): i is Item => i !== undefined);
    return delay(items, LATENCY_INSTANT);
  },

  /** Rarest first. The default ordering for any item grid. */
  async getItemsSorted(ids: readonly string[]): Promise<Item[]> {
    const items = await this.getItems(ids);
    return items.sort(byRarityDesc);
  },

  async getSets(title?: GameTitle): Promise<ItemSet[]> {
    const sets = title ? ALL_SETS.filter((s) => s.title === title) : ALL_SETS;
    return delay([...sets], LATENCY_INSTANT);
  },

  async getSet(id: string): Promise<ItemSet | null> {
    return delay(SETS_BY_ID.get(id) ?? null, LATENCY_INSTANT);
  },

  /**
   * Synchronous lookup map for hot paths (match scoring, room placement) that
   * would otherwise await inside a loop. Still sourced from one place.
   */
  getCatalogueMap(): ReadonlyMap<string, Item> {
    return ITEMS_BY_ID;
  },
};

export type CatalogueService = typeof catalogueService;
