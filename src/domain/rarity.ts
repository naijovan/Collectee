/**
 * Rarity model — PRD §12.2.
 *
 * Normalised internally, native label displayed. Sorting, filtering, grouping
 * and colour tokens use `rarityTier`; the UI prints `rarityLabel`.
 *
 * ⚠️ PRD action item: "Have a player of each title sanity-check the mapping —
 * the Valorant Exclusive placement is the least certain." Until that happens,
 * this table is the single source of truth and no other rarity strings may
 * appear anywhere in the codebase.
 */

import type { GameTitle, RarityTier } from '@/types';
import { RARITY_TIERS } from '@/types';

/**
 * Native in-game label per title. `null` means the title has no tier at that
 * level — Valorant has no "common" equivalent.
 */
export const RARITY_LABELS: Record<RarityTier, Record<GameTitle, string | null>> = {
  common: { codm: 'Common', valorant: null, mlbb: 'Elite' },
  rare: { codm: 'Rare', valorant: 'Select', mlbb: 'Special' },
  epic: { codm: 'Epic', valorant: 'Deluxe', mlbb: 'Epic' },
  legendary: { codm: 'Legendary', valorant: 'Premium', mlbb: 'Legend' },
  mythic: { codm: 'Mythic', valorant: 'Ultra', mlbb: 'Collector' },
};

/** Ascending rank. Higher number = rarer. */
export const RARITY_RANK: Record<RarityTier, number> = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
  mythic: 4,
};

/**
 * The native label for a tier in a given title.
 * Falls back to the capitalised tier name when the title has no native
 * equivalent, so the UI never renders an empty badge.
 */
export function rarityLabelFor(tier: RarityTier, title: GameTitle): string {
  const label = RARITY_LABELS[tier][title];
  if (label !== null) return label;
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

/** Sort comparator: rarest first. Ties broken by name for stable ordering. */
export function byRarityDesc<T extends { rarityTier: RarityTier; name: string }>(
  a: T,
  b: T,
): number {
  const diff = RARITY_RANK[b.rarityTier] - RARITY_RANK[a.rarityTier];
  return diff !== 0 ? diff : a.name.localeCompare(b.name);
}

/** Group items by tier, rarest tier first. Used by the Review screen (§11 F1). */
export function groupByRarity<T extends { rarityTier: RarityTier }>(
  items: T[],
): { tier: RarityTier; items: T[] }[] {
  return [...RARITY_TIERS]
    .reverse()
    .map((tier) => ({ tier, items: items.filter((i) => i.rarityTier === tier) }))
    .filter((group) => group.items.length > 0);
}

/** Percentage breakdown by tier. Feeds Collection Insights (§11 F2, [ROADMAP]). */
export function rarityBreakdown<T extends { rarityTier: RarityTier }>(
  items: T[],
): Record<RarityTier, number> {
  const counts = Object.fromEntries(RARITY_TIERS.map((t) => [t, 0])) as Record<RarityTier, number>;
  for (const item of items) counts[item.rarityTier] += 1;
  return counts;
}
