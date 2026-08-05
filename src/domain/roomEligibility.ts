/**
 * Who may enter a Collection Room — PRD §9.4.
 *
 * The rule, in one line: **only verified items may be placed in a room.**
 * Unverified items remain fully usable everywhere else — they list in a normal
 * 2D collection, they are shareable, they count toward set completion. They
 * just cannot stand on a pedestal.
 *
 * ── Why this lives in domain/ and not in the screens ──────────────────────
 * Three surfaces ask this question: the Collections tab (which CTA to show),
 * the room intro (whether to start), and the build flow (which items to offer).
 * If each derives it separately they will drift, and the one that drifts will
 * be the one that lets an unverified item through — a gate that fails open is
 * not a gate. One function, three callers.
 *
 * ── Why the reason is mandatory ───────────────────────────────────────────
 * §11 F4: "the room picker must show the user's verified count, and say what to
 * do about it when the count is too low — an empty picker with no explanation
 * is the worst version of this rule." So eligibility never returns a bare
 * false; it returns why, and what would fix it.
 *
 * Pure logic, no I/O.
 */

import type { Item, OwnedItem } from '@/types';

/** A room needs enough to look like a room, not one item on a shelf. */
export const MIN_ROOM_ITEMS = 3;

export interface RoomEligibility {
  /** Whether a room can be built from this inventory at all. */
  eligible: boolean;
  /** Owned items that may be placed — always verified-only. */
  eligibleItems: OwnedItem[];
  /** Owned items excluded by the gate. Drives the upgrade prompt. */
  blockedItems: OwnedItem[];
  /**
   * Human-readable, always populated — for the eligible case too, because the
   * picker shows the count either way.
   */
  reason: string;
  /** What the user would do next. Null when they are already eligible. */
  action: 'link-account' | 'add-items' | null;
}

/** The gate. Everything else in this module is presentation over it. */
export function roomEligibility(owned: readonly OwnedItem[]): RoomEligibility {
  const eligibleItems = owned.filter((entry) => entry.trustLevel === 'verified');
  const blockedItems = owned.filter((entry) => entry.trustLevel !== 'verified');

  if (eligibleItems.length >= MIN_ROOM_ITEMS) {
    return {
      eligible: true,
      eligibleItems,
      blockedItems,
      reason:
        blockedItems.length > 0
          ? `${eligibleItems.length} verified items can go in a room · ${blockedItems.length} unverified stay in the 2D collection`
          : `${eligibleItems.length} verified items ready to place`,
      action: null,
    };
  }

  // Nothing verified at all is a different problem from "not quite enough",
  // and lumping them together would tell half the users the wrong next step.
  if (eligibleItems.length === 0) {
    return {
      eligible: false,
      eligibleItems,
      blockedItems,
      reason:
        blockedItems.length > 0
          ? `Rooms need verified items. Connect a game account to verify the ${blockedItems.length} you own.`
          : 'Rooms need verified items. Connect a game account to get started.',
      action: 'link-account',
    };
  }

  const short = MIN_ROOM_ITEMS - eligibleItems.length;
  return {
    eligible: false,
    eligibleItems,
    blockedItems,
    reason: `A room needs ${MIN_ROOM_ITEMS} verified items — you have ${eligibleItems.length}. Verify ${short} more to unlock it.`,
    action: 'link-account',
  };
}

/**
 * The same gate, narrowed to one collection's contents.
 *
 * A collection is room-eligible on its own verified items, not on the owner's
 * whole inventory — otherwise every collection would claim eligibility on the
 * strength of items that are not in it.
 */
export function roomEligibilityFor(
  collectionItemIds: readonly string[],
  owned: readonly OwnedItem[],
): RoomEligibility {
  const wanted = new Set(collectionItemIds);
  return roomEligibility(owned.filter((entry) => wanted.has(entry.itemId)));
}

/**
 * Catalogue items that may be placed, given the owner's inventory.
 *
 * The room build flow renders `Item`s, not `OwnedItem`s, so this is the shape
 * it actually wants — and going through here means the flow cannot accidentally
 * offer an item it has no verified ownership record for.
 */
export function roomPlaceableItems(
  items: readonly Item[],
  owned: readonly OwnedItem[],
): Item[] {
  const verified = new Set(
    owned.filter((entry) => entry.trustLevel === 'verified').map((entry) => entry.itemId),
  );
  return items.filter((item) => verified.has(item.id));
}

/**
 * Short label for a card, where the full reason will not fit.
 *
 * Deliberately never just "Locked" — a lock with no cause is the thing §11 F4
 * calls the worst version of this rule.
 */
export function shortEligibilityLabel(eligibility: RoomEligibility): string {
  if (eligibility.eligible) return `${eligibility.eligibleItems.length} verified`;
  if (eligibility.eligibleItems.length === 0) return 'Verify to unlock rooms';
  return `${eligibility.eligibleItems.length}/${MIN_ROOM_ITEMS} verified`;
}
