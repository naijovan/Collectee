/**
 * Collection and set logic — PRD §11 F2/F3.
 *
 * F3 is where value is actually created: the moment an inventory dump becomes
 * an identity. AI does the tedious part, the player does the expressive part.
 */

import type { Collection, GameTitle, Item, ItemSet, OwnedItem, RarityTier, Visibility } from '@/types';
import { GAME_LABELS } from '@/types';
import { RARITY_RANK } from './rarity';

/**
 * Canonical stepper counts — PRD §11 F3.
 *
 * "Pick canonical counts once, in code, and let both flows import them." This
 * is that place, so the count on screen cannot drift from the count in code.
 *
 * These four match the bar drawn on every Create & Publish frame in the Figma
 * (Details · Select items · Arrange · Publish). The Figma's problem was never
 * the bar — it was that three *screens* were labelled Step 3 (Select Theme,
 * Arrange, Preview Details "3.5"). The fix is to keep the four-step bar and be
 * explicit about where those screens sit:
 *   - Select Theme and Arrange are two sub-views of the SAME step 3. The bar
 *     reads "3 of 4" on both, which is what the Figma actually draws.
 *   - Preview Details and Preview are confirm screens OUTSIDE the numbered bar.
 */
export const COLLECTION_STEPS = ['Details', 'Select items', 'Arrange', 'Publish'] as const;

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

/* ────────────────────────────────────────────────────────────────────────────
 * Step 3 of J2 — "Suggestions for your collection".
 *
 * Reads the items the user has already picked and proposes (a) a theme and
 * (b) further owned items that fit it. Deterministic, because the demo is
 * mocked (§12.1); the shape is what a model call would fill.
 *
 * Every fit carries a human-readable `reason`. §11 F5: "a percentage without
 * its reason is a broken feature, not a styling choice" — the same standard
 * applies here, which is why `reason` is non-optional and the scorer refuses
 * to emit a fit it cannot explain.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface ThemeSuggestion {
  name: string;
  description: string;
  tags: string[];
}

export interface ItemFit {
  item: Item;
  reason: string;
}

/** Signal weights, strongest first. Named so the ordering is arguable in review. */
const FIT_SAME_SET = 4;
const FIT_SAME_TITLE = 2;
const FIT_SAME_TIER = 2;
const FIT_SCARCE = 1;

/** Below this share of players, an item is worth calling out on its own (§11 F5). */
const SCARCE_POPULARITY = 0.15;

/** The tier the user is leaning towards. Ties break towards the rarer tier. */
function dominantTier(items: readonly Item[]): RarityTier | null {
  if (items.length === 0) return null;
  const counts = new Map<RarityTier, number>();
  for (const item of items) {
    counts.set(item.rarityTier, (counts.get(item.rarityTier) ?? 0) + 1);
  }
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || RARITY_RANK[b[0]] - RARITY_RANK[a[0]],
  )[0]![0];
}

/** Distinct titles in selection order — drives the cross-game framing. */
function titlesIn(items: readonly Item[]): GameTitle[] {
  return [...new Set(items.map((i) => i.title))];
}

/**
 * A theme for the current selection: a name the user can accept as-is, a
 * one-line description, and tags drawn from the vocabulary the seeded
 * collections already use, so generated and seeded data stay consistent.
 */
export function suggestTheme(selected: readonly Item[]): ThemeSuggestion | null {
  if (selected.length === 0) return null;

  const tier = dominantTier(selected)!;
  const titles = titlesIn(selected);
  const crossGame = titles.length > 1;

  // Print the native in-game label, never a normalised tier string (§12.2).
  const label = selected.find((i) => i.rarityTier === tier)!.rarityLabel;

  const sharedSetId = mostCommonSetId(selected);
  const tags: string[] = [];
  if (crossGame) tags.push('cross-game');
  for (const title of titles) tags.push(title);
  if (RARITY_RANK[tier] === RARITY_RANK.mythic) tags.push(tier);
  if (sharedSetId !== null) tags.push('set-completion');

  const name = crossGame ? `${label} Across Games` : `${GAME_LABELS[titles[0]!]} ${label}`;

  const description = crossGame
    ? `Your ${label} items from ${titles.map((t) => GAME_LABELS[t]).join(' and ')}.`
    : `A ${label} run through your ${GAME_LABELS[titles[0]!]} inventory.`;

  return { name, description, tags };
}

/** The set id shared by the most selected items, or null if none repeats. */
function mostCommonSetId(items: readonly Item[]): string | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    if (item.setId === null) continue;
    counts.set(item.setId, (counts.get(item.setId) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= 2 ? best[0] : null;
}

/**
 * Owned items that would extend the current selection, each with the reason it
 * was chosen. Candidates already selected are excluded by the caller passing a
 * filtered list; anything scoring zero is dropped rather than shown unexplained.
 */
export function suggestItemsThatFit(
  selected: readonly Item[],
  candidates: readonly Item[],
  limit = 6,
): ItemFit[] {
  if (selected.length === 0) return [];

  const tier = dominantTier(selected)!;
  const titles = new Set(titlesIn(selected));
  const setIds = new Set(selected.map((i) => i.setId).filter((id): id is string => id !== null));
  const tierLabel = selected.find((i) => i.rarityTier === tier)!.rarityLabel;

  const scored = candidates
    .map((item) => {
      let score = 0;
      let reason = '';

      // Strongest signal first — whichever fires highest owns the explanation.
      if (item.setId !== null && setIds.has(item.setId)) {
        score += FIT_SAME_SET;
        reason = 'Completes a set you have already started';
      }
      if (titles.has(item.title)) {
        score += FIT_SAME_TITLE;
        if (reason === '') reason = `Another ${GAME_LABELS[item.title]} pick`;
      }
      if (item.rarityTier === tier) {
        score += FIT_SAME_TIER;
        if (reason === '') reason = `Matches the ${tierLabel} tier you are collecting`;
      }
      if (item.popularityScore <= SCARCE_POPULARITY) {
        score += FIT_SCARCE;
        if (reason === '') {
          reason = `Only ${Math.round(item.popularityScore * 100)}% of players own it`;
        }
      }

      return { item, reason, score };
    })
    .filter((entry) => entry.score > 0 && entry.reason !== '');

  return scored
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.item.popularityScore - b.item.popularityScore ||
        a.item.name.localeCompare(b.item.name),
    )
    .slice(0, limit)
    .map(({ item, reason }) => ({ item, reason }));
}
