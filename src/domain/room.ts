/**
 * Collection Room logic — PRD §11 F4. Owner: Jovan.
 *
 * Interaction model, decided by the team and NOT negotiable against the Figma
 * frames (§11 F4 scope guard):
 *   - A themed room rendered as a 2.5D parallax scene, not navigable 3D.
 *   - Items composited into FIXED slots as cards / framed artwork.
 *   - Look-at focus: tapping an item transitions the camera to it.
 *   - Card flip for reverse-side detail — reads as "spin" without a 3D model.
 *
 * A true turntable of the actual in-game 3D model is not possible: it requires
 * direct access to publisher game assets we do not have and will not have.
 * Do not promise it.
 *
 * Generation only ever produces the BACKDROP IMAGE, never the geometry. Every
 * theme ships a fixed slot map. That is what "template-conditioned" means.
 */

import type { Item, OwnedItem, Placement, Room, RoomTheme, Slot } from '@/types';
import { RARITY_RANK } from './rarity';

/** Slot kinds ordered by prominence — a pedestal is the hero position. */
const SLOT_PROMINENCE: Record<Slot['kind'], number> = {
  pedestal: 2,
  case: 1,
  wall: 0,
};

/**
 * Prominence-ordered slots: front layers and pedestals first.
 * Auto-placement fills these in order so the rarest item lands in the hero spot.
 */
export function slotsByProminence(slots: readonly Slot[]): Slot[] {
  return [...slots].sort(
    (a, b) =>
      SLOT_PROMINENCE[b.kind] - SLOT_PROMINENCE[a.kind] ||
      b.depth - a.depth ||
      // Larger slots read as more important at equal kind/depth.
      b.w * b.h - a.w * a.h ||
      a.id.localeCompare(b.id),
  );
}

/**
 * AI auto-placement: rarest item into the most prominent slot, and so on.
 *
 * §11 F4 acceptance criteria: "Every AI placement is manually overridable."
 * This produces a starting arrangement, never a locked one — `movePlacement`
 * and `swapPlacements` are the override path.
 */
export function autoPlace(
  ownedItems: readonly OwnedItem[],
  catalogue: ReadonlyMap<string, Item>,
  slots: readonly Slot[],
): Placement[] {
  const ranked = [...ownedItems]
    .map((owned) => ({ owned, item: catalogue.get(owned.itemId) }))
    .filter((e): e is { owned: OwnedItem; item: Item } => e.item !== undefined)
    .sort(
      (a, b) =>
        RARITY_RANK[b.item.rarityTier] - RARITY_RANK[a.item.rarityTier] ||
        a.item.popularityScore - b.item.popularityScore ||
        a.item.name.localeCompare(b.item.name),
    );

  const ordered = slotsByProminence(slots);
  return ranked.slice(0, ordered.length).map((entry, i) => ({
    slotId: ordered[i]!.id,
    ownedItemId: entry.owned.id,
    rotation: 0,
  }));
}

/** How many items a theme can display. Collections larger than this overflow. */
export function roomCapacity(theme: RoomTheme): number {
  return theme.slots.length;
}

/** Items that did not fit — surfaced so the user can choose what to swap in. */
export function overflowItemIds(
  ownedItemIds: readonly string[],
  placements: readonly Placement[],
): string[] {
  const placed = new Set(placements.map((p) => p.ownedItemId));
  return ownedItemIds.filter((id) => !placed.has(id));
}

/** Move an item to a different slot, evicting whatever was there. */
export function movePlacement(
  placements: readonly Placement[],
  ownedItemId: string,
  toSlotId: string,
): Placement[] {
  const next = placements.filter((p) => p.ownedItemId !== ownedItemId && p.slotId !== toSlotId);
  const existing = placements.find((p) => p.ownedItemId === ownedItemId);
  next.push({ slotId: toSlotId, ownedItemId, rotation: existing?.rotation ?? 0 });
  return next;
}

/** Swap two occupied slots — the common manual-adjust gesture. */
export function swapPlacements(
  placements: readonly Placement[],
  slotIdA: string,
  slotIdB: string,
): Placement[] {
  return placements.map((p) => {
    if (p.slotId === slotIdA) return { ...p, slotId: slotIdB };
    if (p.slotId === slotIdB) return { ...p, slotId: slotIdA };
    return p;
  });
}

export function rotatePlacement(
  placements: readonly Placement[],
  slotId: string,
  degrees: number,
): Placement[] {
  return placements.map((p) =>
    p.slotId === slotId ? { ...p, rotation: (p.rotation + degrees) % 360 } : p,
  );
}

/** The item currently in focus — the sword on the central pedestal, by default. */
export function focusedPlacement(room: Room): Placement | null {
  const focusedId = room.settings.focusedSlotId;
  if (focusedId === null) {
    const ordered = slotsByProminence(room.slots);
    const heroSlot = ordered[0];
    return heroSlot ? (room.placements.find((p) => p.slotId === heroSlot.id) ?? null) : null;
  }
  return room.placements.find((p) => p.slotId === focusedId) ?? null;
}

/**
 * Camera target for the look-at transition. Returns the slot centre in
 * fractional coordinates plus a zoom scale derived from slot size, so a small
 * wall piece zooms in further than a large pedestal display.
 */
export interface CameraTarget {
  /** 0–1 fractional centre of the focused slot. */
  x: number;
  y: number;
  scale: number;
}

export function cameraTargetFor(slot: Slot): CameraTarget {
  const longestEdge = Math.max(slot.w, slot.h);
  // Aim to have the focused item fill ~55% of the viewport.
  const scale = Math.min(3, Math.max(1.2, 0.55 / Math.max(longestEdge, 0.05)));
  return { x: slot.x + slot.w / 2, y: slot.y + slot.h / 2, scale };
}

/** Parallax offset for a layer. depth 0 = back (moves least), 2 = front (moves most). */
export function parallaxOffset(depth: Slot['depth'], tiltX: number, tiltY: number): {
  dx: number;
  dy: number;
} {
  const factor = depth * 0.5;
  return { dx: tiltX * factor, dy: tiltY * factor };
}

/**
 * Dev-time guard: every placement must reference a slot that exists on the room,
 * and no two placements may share a slot.
 */
export function assertRoomValid(room: Room): void {
  const slotIds = new Set(room.slots.map((s) => s.id));
  const used = new Set<string>();
  for (const placement of room.placements) {
    if (!slotIds.has(placement.slotId)) {
      throw new Error(`Room "${room.id}" places an item in unknown slot "${placement.slotId}"`);
    }
    if (used.has(placement.slotId)) {
      throw new Error(`Room "${room.id}" has two items in slot "${placement.slotId}"`);
    }
    used.add(placement.slotId);
  }
  for (const slot of room.slots) {
    const inRange = [slot.x, slot.y, slot.w, slot.h].every((n) => n >= 0 && n <= 1);
    if (!inRange) {
      throw new Error(`Room "${room.id}" slot "${slot.id}" has non-fractional coordinates`);
    }
  }
}
