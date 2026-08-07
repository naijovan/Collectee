/**
 * Showroom logic — PRD §11 F4. Owner: Jovan.
 *
 * Slots remain the durable arrangement contract for both renderers: the 2.5D
 * editor maps them to precise drag/drop regions, while the immersive renderer
 * maps the same placements onto procedural 3D displays. Exact publisher models
 * still require licensed glTF assets; the current geometry is original concept
 * art and can be swapped without changing this domain layer.
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

/** Number of authored anchors before generation switches to a larger pedestal grid. */
export function roomCapacity(theme: RoomTheme): number {
  return theme.slots.length;
}

/**
 * Resolve the anchors used by a newly generated room.
 *
 * A theme's authored slots remain the preferred composition while the
 * selection fits. Larger selections switch to a deterministic, staggered
 * pedestal gallery rather than dropping items as overflow. The rows run from
 * back to front so both the 2.5D editor and the 3D renderer keep meaningful
 * depth ordering.
 */
export function slotsForItemCount(theme: RoomTheme, itemCount: number): Slot[] {
  const count = Math.max(0, Math.floor(itemCount));
  if (count <= theme.slots.length) return [...theme.slots];

  const rows = Math.min(3, Math.max(1, Math.ceil(count / 5)));
  const rowTops = rows === 1 ? [0.38] : rows === 2 ? [0.22, 0.55] : [0.12, 0.36, 0.6];
  const rowHeights = rows === 1 ? [0.28] : rows === 2 ? [0.22, 0.22] : [0.18, 0.18, 0.18];
  const depths: Slot['depth'][] = rows === 1 ? [2] : rows === 2 ? [0, 2] : [0, 1, 2];
  const prefix = theme.id.replace(/^theme-/, '');
  const generated: Slot[] = [];
  let remaining = count;
  let itemIndex = 0;

  for (let row = 0; row < rows; row += 1) {
    const inRow = Math.ceil(remaining / (rows - row));
    const gap = inRow <= 5 ? 0.035 : 0.018;
    const slotWidth = Math.min(0.17, (0.9 - gap * (inRow - 1)) / inRow);
    const rowWidth = inRow * slotWidth + (inRow - 1) * gap;
    const startX = (1 - rowWidth) / 2;

    for (let column = 0; column < inRow; column += 1) {
      generated.push({
        id: `${prefix}-generated-pedestal-${itemIndex + 1}`,
        kind: 'pedestal',
        x: startX + column * (slotWidth + gap),
        y: rowTops[row]!,
        w: slotWidth,
        h: rowHeights[row]!,
        depth: depths[row]!,
      });
      itemIndex += 1;
    }
    remaining -= inRow;
  }

  return generated;
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

/**
 * Place an item in a slot without stacking or silently evicting another item.
 *
 * When the target is occupied, the dragged item takes that position and the
 * displaced item moves to the closest empty slot. The source slot becomes a
 * valid empty candidate after a drag, but a nearer existing gap wins.
 */
export function placeWithNearestDisplacement(
  placements: readonly Placement[],
  slots: readonly Slot[],
  ownedItemId: string,
  toSlotId: string,
): Placement[] {
  const source = placements.find((placement) => placement.ownedItemId === ownedItemId);
  const target = placements.find((placement) => placement.slotId === toSlotId);
  if (source?.slotId === toSlotId) return [...placements];

  const targetSlot = slots.find((slot) => slot.id === toSlotId);
  if (!targetSlot) return [...placements];

  if (!target) return movePlacement(placements, ownedItemId, toSlotId);

  const occupiedAfterPickup = new Set(
    placements
      .filter(
        (placement) =>
          placement.ownedItemId !== ownedItemId && placement.slotId !== target.slotId,
      )
      .map((placement) => placement.slotId),
  );
  const nearestEmpty = slots
    .filter((slot) => slot.id !== toSlotId && !occupiedAfterPickup.has(slot.id))
    .sort(
      (a, b) =>
        slotDistanceSquared(a, targetSlot) - slotDistanceSquared(b, targetSlot) ||
        a.id.localeCompare(b.id),
    )[0];

  // A full room cannot accept a new tray item because there is nowhere to
  // relocate the displaced item. A drag from inside the room always has its
  // newly-vacated source slot available.
  if (!nearestEmpty) return [...placements];

  const next = placements.filter(
    (placement) =>
      placement.ownedItemId !== ownedItemId && placement.ownedItemId !== target.ownedItemId,
  );
  next.push({
    ...target,
    slotId: nearestEmpty.id,
  });
  next.push({
    slotId: toSlotId,
    ownedItemId,
    rotation: source?.rotation ?? 0,
  });
  return next;
}

function slotDistanceSquared(a: Slot, b: Slot): number {
  const ax = a.x + a.w / 2;
  const ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2;
  const by = b.y + b.h / 2;
  return (ax - bx) ** 2 + (ay - by) ** 2;
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

/**
 * The title an assistant would suggest for a room, without a model call.
 *
 * Deterministic because the demo is mocked (§12.1) — same pattern as
 * `suggestCollections` in `domain/collections.ts`. "Neon Legends" built in the
 * "Futuristic Weapon Vault" style suggests "Neon Vault", which is exactly the
 * naming the design frames show. The user can always overwrite it at publish.
 */
export function suggestRoomTitle(collectionName: string, themeName: string): string {
  const head = collectionName.trim().split(/\s+/)[0];
  const tail = themeName.trim().split(/\s+/).at(-1);
  if (!head || !tail) return collectionName.trim() || 'My room';
  return head === tail ? head : `${head} ${tail}`;
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
