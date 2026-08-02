/**
 * Collection and set logic — PRD §11 F2/F3.
 *
 * F3 is where value is actually created: the moment an inventory dump becomes
 * an identity. AI does the tedious part, the player does the expressive part.
 */

import type { Collection, Item, ItemSet, OwnedItem, Visibility } from '@/types';
import { RARITY_RANK } from './rarity';

/**
 * Canonical stepper counts — PRD §11 F3.
 *
 * The Figma shows a 4-step bar but labels three screens Step 3 (Select Theme,
 * Arrange, Preview Details "3.5"), and the Room flow has the same problem with
 * two screens labelled Step 3 in a 5-step bar. "Pick canonical counts once, in
 * code, and let both flows import them." This is that place.
 *
 * Preview Details and Preview are modal/confirm screens OUTSIDE the numbered bar.
 */
export const COLLECTION_STEPS = ['Details', 'Select items', 'Theme', 'Arrange', 'Publish'] as const;

export const ROOM_STEPS = ['Collection', 'Style', 'Generate', 'Adjust', 'Publish'] as const;

export type CollectionStep = (typeof COLLECTION_STEPS)[number];
export type RoomStep = (typeof ROOM_STEPS)[number];

/** Set-completion progress for the Completionist persona (§4). */
export interface SetProgress {
  setId: string;
  setName: string;
  owned: number;
  total: number;
  /** 0–1. */
  ratio: number;
  missingItemIds: string[];
}

export function setProgress(
  set: ItemSet,
  ownedItemIds: ReadonlySet<string>,
): SetProgress {
  const owned = set.itemIds.filter((id) => ownedItemIds.has(id));
  const missing = set.itemIds.filter((id) => !ownedItemIds.has(id));
  return {
    setId: set.id,
    setName: set.name,
    owned: owned.length,
    total: set.totalCount,
    ratio: set.totalCount === 0 ? 0 : owned.length / set.totalCount,
    missingItemIds: missing,
  };
}

/** Sets ordered by how close the user is to completing them, excluding untouched sets. */
export function setsInProgress(
  sets: readonly ItemSet[],
  ownedItemIds: ReadonlySet<string>,
): SetProgress[] {
  return sets
    .map((set) => setProgress(set, ownedItemIds))
    .filter((p) => p.owned > 0 && p.owned < p.total)
    .sort((a, b) => b.ratio - a.ratio);
}

/** Only public collections are link-shareable and appear in Explore (§11 F3). */
export function isDiscoverable(collection: Collection): boolean {
  return collection.visibility === 'public';
}

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: 'Public',
  unlisted: 'Unlisted',
  private: 'Private',
};

export const VISIBILITY_DESCRIPTIONS: Record<Visibility, string> = {
  public: 'Anyone can find and view this collection',
  unlisted: 'Only people with the link can view it',
  private: 'Only you can view it',
};

/**
 * A collection's headline item — the rarest thing in it. Drives cover art
 * suggestions and the room's default focal item.
 */
export function headlineItem(items: readonly Item[]): Item | null {
  if (items.length === 0) return null;
  return [...items].sort(
    (a, b) => RARITY_RANK[b.rarityTier] - RARITY_RANK[a.rarityTier] || a.popularityScore - b.popularityScore,
  )[0]!;
}

/**
 * Suggested groupings — the "AI assists" half of F3. Deterministic here because
 * the demo is mocked (§12.1); the interface is what a model call would fill.
 */
export interface CollectionSuggestion {
  name: string;
  reason: string;
  itemIds: string[];
}

export function suggestCollections(
  owned: readonly OwnedItem[],
  catalogue: ReadonlyMap<string, Item>,
  sets: readonly ItemSet[],
): CollectionSuggestion[] {
  const ownedIds = new Set(owned.map((o) => o.itemId));
  const suggestions: CollectionSuggestion[] = [];

  // 1. Near-complete sets are the most compelling grouping.
  for (const progress of setsInProgress(sets, ownedIds).slice(0, 2)) {
    const set = sets.find((s) => s.id === progress.setId)!;
    suggestions.push({
      name: set.name,
      reason: `You own ${progress.owned} of ${progress.total} in this set`,
      itemIds: set.itemIds.filter((id) => ownedIds.has(id)),
    });
  }

  // 2. Rarest items across every title — the cross-game identity thesis, visible.
  const rarest = [...ownedIds]
    .map((id) => catalogue.get(id))
    .filter((i): i is Item => i !== undefined)
    .sort((a, b) => RARITY_RANK[b.rarityTier] - RARITY_RANK[a.rarityTier])
    .slice(0, 8);
  if (rarest.length >= 3) {
    suggestions.push({
      name: 'Crown Jewels',
      reason: 'Your rarest items across every game',
      itemIds: rarest.map((i) => i.id),
    });
  }

  return suggestions;
}
