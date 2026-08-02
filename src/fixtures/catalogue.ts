/**
 * The merged item catalogue across all three demo titles.
 *
 * Screens must NOT import this. Go through `catalogueService` (§12.1) — the
 * whole point of the service layer is that swapping a fixture for a fetch is a
 * one-line change in one file.
 */

import type { GameTitle, Item, ItemSet } from '@/types';
import { CODM_ITEMS } from './items-codm';
import { MLBB_ITEMS } from './items-mlbb';
import { VALORANT_ITEMS } from './items-valorant';
import { ITEM_SETS } from './sets';

export const ALL_ITEMS: readonly Item[] = [...CODM_ITEMS, ...VALORANT_ITEMS, ...MLBB_ITEMS];

export const ALL_SETS: readonly ItemSet[] = ITEM_SETS;

/** id → Item. Built once at module load; matching and room placement both need it. */
export const ITEMS_BY_ID: ReadonlyMap<string, Item> = new Map(
  ALL_ITEMS.map((item) => [item.id, item]),
);

export const ITEMS_BY_TITLE: Readonly<Record<GameTitle, readonly Item[]>> = {
  codm: CODM_ITEMS,
  valorant: VALORANT_ITEMS,
  mlbb: MLBB_ITEMS,
};

export const SETS_BY_ID: ReadonlyMap<string, ItemSet> = new Map(
  ALL_SETS.map((set) => [set.id, set]),
);
