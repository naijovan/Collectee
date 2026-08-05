/**
 * Showrooms — PRD §11 F4. Flow owner: Jovan (J3). THE DIFFERENTIATOR.
 *
 * §16 Q6 is still open: room backdrops pre-generated and bundled, or generated
 * live? This service implements the RECOMMENDED answer — bundled, consistent
 * with §12.1 — behind a `generateBackdrop` call that a live generator could
 * replace without touching a screen.
 *
 * Generation only ever produces the BACKDROP. Slot geometry comes from the
 * theme and never changes. Backdrops are cached by (themeId, palette) so the
 * same theme is never "generated" twice — §11 F4 cost control, and it also
 * means the second demo run is instant.
 */

import { ROOMS, ROOMS_BY_ID } from '@/fixtures/collections';
import { ROOM_THEMES, THEMES_BY_ID } from '@/fixtures/room-themes';
import { suggestRoom, suggestRooms } from '@/domain/roomSuggestion';
import type { RoomSuggestion } from '@/domain/roomSuggestion';
import { ITEMS_BY_ID } from '@/fixtures/catalogue';
import {
  assertRoomValid,
  autoPlace,
  cameraTargetFor,
  focusedPlacement,
  movePlacement,
  overflowItemIds,
  rotatePlacement,
  slotsByProminence,
  suggestRoomTitle,
  swapPlacements,
} from '@/domain/room';
import type { CameraTarget } from '@/domain/room';
import type { Collection, OwnedItem, Placement, Room, RoomSettings, RoomTheme, Slot, Visibility } from '@/types';
import { LATENCY_FETCH, LATENCY_GENERATE, LATENCY_INSTANT, delay, delayWithProgress } from './latency';
import { collectionService } from './collectionService';

/** §11 F4 acceptance criterion: generation completes in under 20s. */
const GENERATION_MS = LATENCY_GENERATE * 4;

const created: Room[] = [];
let nextId = 1;

/** Backdrop cache — reused across users on the same theme and palette (§11 F4). */
const backdropCache = new Map<string, string>();

/** Undo/redo stacks, keyed by room id. Session-scoped like everything else. */
const history = new Map<string, { past: Room[]; future: Room[] }>();

/** Depth cap so a long editing session cannot grow without bound. */
const HISTORY_LIMIT = 30;

function pushHistory(roomId: string, before: Room): void {
  const entry = history.get(roomId) ?? { past: [], future: [] };
  entry.past.push(before);
  if (entry.past.length > HISTORY_LIMIT) entry.past.shift();
  // Any new edit invalidates the redo branch.
  entry.future = [];
  history.set(roomId, entry);
}

/**
 * Generation stages — PRD §11 F4 asks for a progress state, the design frames
 * name four of them and show each one's status. The labels are the user-facing
 * account of what the pipeline in §12.1 *would* do, so keep them honest: this
 * is a timed mock, and every one of these steps is local.
 */
export const ROOM_STAGES = [
  { label: 'Analysing collection theme', detail: 'Understanding your theme and preferences.' },
  { label: 'Selecting featured items', detail: 'Picking the best items to showcase.' },
  { label: 'Arranging displays', detail: 'Placing items in the perfect layout.' },
  { label: 'Matching lighting and background', detail: 'Setting the mood and final details.' },
] as const;

export type RoomStage = (typeof ROOM_STAGES)[number];

/** A collection's room and whether it has gone live. Drives the card CTAs. */
export interface RoomStatus {
  room: Room;
  published: boolean;
}

/** OwnedItem rows resolved to catalogue items, dropping anything unknown. */
function itemsFor(ownedItems: readonly OwnedItem[]) {
  return ownedItems
    .map((owned) => ITEMS_BY_ID.get(owned.itemId))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);
}

export const roomService = {
  async getThemes(): Promise<RoomTheme[]> {
    return delay([...ROOM_THEMES], LATENCY_INSTANT);
  },

  async getTheme(id: string): Promise<RoomTheme | null> {
    return delay(THEMES_BY_ID.get(id) ?? null, LATENCY_INSTANT);
  },

  /**
   * The "✦ Best match" recommendation on the Style step.
   *
   * Matched on the rarity mix of the collection, not a model call — the same
   * "make the reason legible" principle as §11 F5. The reason is returned with
   * the theme so the card can print why it was picked.
   */
  /**
   * The best room for a set of owned items, with the reason that drove it.
   *
   * Delegates to `domain/roomSuggestion`, which scores every theme on colour,
   * rarity, title mix and item form. The previous implementation branched on
   * cross-game alone and could only ever return two of the six themes.
   */
  async recommendTheme(
    ownedItems: readonly OwnedItem[],
  ): Promise<{ theme: RoomTheme; reason: string }> {
    const best = suggestRoom(itemsFor(ownedItems), ROOM_THEMES);
    const fallback = { theme: ROOM_THEMES[0]!, reason: 'A neutral starting point' };
    return delay(best ?? fallback, LATENCY_FETCH);
  },

  /**
   * Create a Showroom in one step — the user-facing object (§9.4, F3/F4).
   *
   * A "Showroom" is one thing to the person using the app: a named,
   * themed, interactive space built from items they own. Underneath it is still
   * a `Collection` plus a `Room` pointing at it, because those shapes are the
   * merge contract three other flows read (`src/types/`, CLAUDE.md). This
   * method is the seam that hides that split: one call, one publish, both
   * records.
   *
   * Collapsing the two records is a phase-2 refactor with no user-visible
   * effect. Do NOT scatter this pairing across screens in the meantime — if a
   * screen ever writes a Collection and a Room separately, the split leaks back
   * into the product and this seam stops being worth having.
   *
   * §9.4 is enforced here rather than trusted from the caller: only verified
   * items are placed. Unverified ones stay in the collection, which is exactly
   * the rule — they are listed, just not in the room.
   */
  async createCollectionRoom(params: {
    userId: string;
    name: string;
    description?: string;
    itemIds: readonly string[];
    themeId: string;
    ownedItems: readonly OwnedItem[];
    visibility?: Visibility;
    onProgress?: (fraction: number) => void;
  }): Promise<{ collection: Collection; room: Room }> {
    const visibility = params.visibility ?? 'private';

    const collection = await collectionService.createCollection({
      userId: params.userId,
      name: params.name,
      description: params.description ?? '',
      coverUrl: '',
      themeTags: [],
      itemIds: [...params.itemIds],
      visibility,
      allowComments: true,
      showOnProfile: true,
    });

    // Verified only — the collection keeps everything, the room takes what it
    // is allowed to (§9.4).
    const placeable = params.ownedItems.filter(
      (entry) => entry.trustLevel === 'verified' && params.itemIds.includes(entry.itemId),
    );

    const room = await this.createRoom({
      collectionId: collection.id,
      collectionName: params.name,
      themeId: params.themeId,
      ownedItems: placeable,
      onProgress: params.onProgress,
    });

    return { collection, room };
  },

  /** Every theme ranked for these items — the picker orders itself by this. */
  async rankThemes(ownedItems: readonly OwnedItem[]): Promise<RoomSuggestion[]> {
    return delay(suggestRooms(itemsFor(ownedItems), ROOM_THEMES), LATENCY_FETCH);
  },

  /** Which named stage a 0–1 progress fraction is in. Drives the frame-5 checklist. */
  stageIndexFor(fraction: number): number {
    return Math.min(ROOM_STAGES.length - 1, Math.floor(fraction * ROOM_STAGES.length));
  },

  /**
   * Seeded rooms merged with session rooms, where a session room WINS on id.
   * `mutate` copy-on-writes a seeded room under its original id, so reading
   * fixtures first would hand back the stale pre-edit copy.
   */
  allRooms(): Room[] {
    const byId = new Map<string, Room>(ROOMS.map((r) => [r.id, r]));
    for (const room of created) byId.set(room.id, room);
    return [...byId.values()];
  },

  async getRoom(id: string): Promise<Room | null> {
    const live = created.find((r) => r.id === id) ?? ROOMS_BY_ID.get(id) ?? null;
    return delay(live, LATENCY_INSTANT);
  },

  async getRoomsByCollection(collectionId: string): Promise<Room[]> {
    return delay(
      this.allRooms().filter((r) => r.collectionId === collectionId),
      LATENCY_FETCH,
    );
  },

  /**
   * Room state per collection — what the Collections cards key off.
   *
   * The frames give every collection card one of three CTAs: View room, Room in
   * progress, Create room. Deriving that per card meant a fetch per card, so it
   * is one pass here instead. Newest room wins when a collection has several.
   */
  async statusByCollection(): Promise<ReadonlyMap<string, RoomStatus>> {
    const byCollection = new Map<string, RoomStatus>();
    for (const room of this.allRooms()) {
      const existing = byCollection.get(room.collectionId);
      const newer =
        !existing || Date.parse(room.createdAt) > Date.parse(existing.room.createdAt);
      if (newer) byCollection.set(room.collectionId, { room, published: room.publishedAt !== null });
    }
    return delay(byCollection, LATENCY_FETCH);
  },

  /** Rooms to show on a profile — published, and not opted out (§12.3 showOnProfile). */
  async getRoomsOnProfile(collectionIds: readonly string[]): Promise<Room[]> {
    const ids = new Set(collectionIds);
    return delay(
      this.allRooms().filter(
        (room) => ids.has(room.collectionId) && room.publishedAt !== null && room.showOnProfile,
      ),
      LATENCY_FETCH,
    );
  },

  async getPublishedRooms(): Promise<Room[]> {
    return delay(
      this.allRooms().filter((r) => r.visibility === 'public' && r.publishedAt !== null),
      LATENCY_FETCH,
    );
  },

  /**
   * "Generate" a backdrop. Bundled for the demo; cached so a repeat is instant.
   * Phase 2 replaces the body with an image-model call and keeps the signature.
   */
  async generateBackdrop(
    themeId: string,
    onProgress?: (fraction: number) => void,
  ): Promise<string> {
    const theme = THEMES_BY_ID.get(themeId);
    if (!theme) throw new Error(`Unknown room theme "${themeId}"`);

    const cacheKey = `${theme.id}:${theme.palette.join(',')}`;
    const cached = backdropCache.get(cacheKey);
    if (cached) {
      // A cache hit still has to drive the progress callback to 1. Returning
      // early without it left the caller's bar frozen at 0% while the room
      // built behind it — the screen said nothing was happening when it was
      // already done. Cheap, because a cached backdrop needs no wait.
      onProgress?.(1);
      return delay(cached, LATENCY_INSTANT);
    }

    backdropCache.set(cacheKey, theme.backdropUrl);
    return delayWithProgress(theme.backdropUrl, GENERATION_MS, onProgress);
  },

  /**
   * Build a room from a collection: generate the backdrop, then auto-place the
   * owner's items rarest-into-most-prominent.
   *
   * Every placement here is a STARTING POINT. §11 F4 acceptance criteria:
   * "Every AI placement is manually overridable."
   */
  async createRoom(params: {
    collectionId: string;
    /** Used only to seed the suggested title; the user edits it at publish. */
    collectionName?: string;
    themeId: string;
    ownedItems: readonly OwnedItem[];
    onProgress?: (fraction: number) => void;
  }): Promise<Room> {
    const theme = THEMES_BY_ID.get(params.themeId);
    if (!theme) throw new Error(`Unknown room theme "${params.themeId}"`);

    const backdropUrl = await this.generateBackdrop(params.themeId, params.onProgress);
    const slots: Slot[] = [...theme.slots];
    const placements = autoPlace(params.ownedItems, ITEMS_BY_ID, slots);
    const hero = slotsByProminence(slots)[0];

    const room: Room = {
      id: `room-new-${nextId++}`,
      collectionId: params.collectionId,
      themeId: theme.id,
      title: suggestRoomTitle(params.collectionName ?? 'My collection', theme.name),
      description: '',
      coverUrl: theme.backdropUrl,
      backdropUrl,
      slots,
      placements,
      settings: {
        // The room opens on its focal item, which is what makes the look-at
        // transition visible on arrival rather than only after a tap (§11 F4).
        parallaxEnabled: true,
        focusedSlotId: hero?.id ?? null,
        lightingPreset: 'cool-blue',
        brightness: 0.68,
        animatedLighting: true,
        displayStyle: 'hologram',
      },
      visibility: 'private',
      allowComments: true,
      showOnProfile: true,
      // A new room has no audience yet. Never seed these with flattering numbers.
      likeCount: 0,
      visitorCount: 0,
      publishedAt: null,
      createdAt: new Date().toISOString(),
    };
    assertRoomValid(room);
    created.push(room);
    return room;
  },

  /** Manual override: move one item to a different slot. */
  async moveItem(roomId: string, ownedItemId: string, toSlotId: string): Promise<Room | null> {
    return this.mutate(roomId, (room) => ({
      ...room,
      placements: movePlacement(room.placements, ownedItemId, toSlotId),
    }));
  },

  async swapSlots(roomId: string, slotIdA: string, slotIdB: string): Promise<Room | null> {
    return this.mutate(roomId, (room) => ({
      ...room,
      placements: swapPlacements(room.placements, slotIdA, slotIdB),
    }));
  },

  async rotateItem(roomId: string, slotId: string, degrees: number): Promise<Room | null> {
    return this.mutate(roomId, (room) => ({
      ...room,
      placements: rotatePlacement(room.placements, slotId, degrees),
    }));
  },

  /** Look-at focus: tapping an item transitions the camera to it. */
  async focusSlot(roomId: string, slotId: string | null): Promise<Room | null> {
    return this.mutate(roomId, (room) => ({
      ...room,
      settings: { ...room.settings, focusedSlotId: slotId },
    }));
  },

  /** Customise step — lighting, brightness, animated lighting, display style. */
  async updateSettings(roomId: string, patch: Partial<RoomSettings>): Promise<Room | null> {
    return this.mutate(roomId, (room) => ({
      ...room,
      settings: { ...room.settings, ...patch },
    }));
  },

  /** Publish step — the room's own identity, edited before it goes live. */
  async updateDetails(
    roomId: string,
    patch: Partial<Pick<Room, 'title' | 'description' | 'coverUrl' | 'allowComments' | 'showOnProfile'>>,
  ): Promise<Room | null> {
    return this.mutate(roomId, (room) => ({ ...room, ...patch }));
  },

  async publish(roomId: string, visibility: Visibility): Promise<Room | null> {
    return this.mutate(roomId, (room) => ({
      ...room,
      visibility,
      publishedAt: new Date().toISOString(),
    }));
  },

  /**
   * Undo / redo for the Edit step.
   *
   * Every `mutate` pushes the pre-edit room onto the past stack, so this covers
   * placement, rotation, focus and lighting alike — one history, not one per
   * control. Redo is cleared by any new edit, which is the behaviour anyone who
   * has used an editor expects.
   */
  async undo(roomId: string): Promise<Room | null> {
    const entry = history.get(roomId);
    const previous = entry?.past.pop();
    if (!entry || !previous) return delay(null, LATENCY_INSTANT);

    const index = created.findIndex((r) => r.id === roomId);
    if (index !== -1) entry.future.push(created[index]!);
    if (index === -1) created.push(previous);
    else created[index] = previous;
    return delay(previous, LATENCY_INSTANT);
  },

  async redo(roomId: string): Promise<Room | null> {
    const entry = history.get(roomId);
    const next = entry?.future.pop();
    if (!entry || !next) return delay(null, LATENCY_INSTANT);

    const index = created.findIndex((r) => r.id === roomId);
    if (index !== -1) entry.past.push(created[index]!);
    if (index === -1) created.push(next);
    else created[index] = next;
    return delay(next, LATENCY_INSTANT);
  },

  canUndo(roomId: string): boolean {
    return (history.get(roomId)?.past.length ?? 0) > 0;
  },

  canRedo(roomId: string): boolean {
    return (history.get(roomId)?.future.length ?? 0) > 0;
  },

  /** Re-run the auto-placement pass. The "✦ Auto-arrange" button in the frames. */
  async autoArrange(roomId: string, ownedItems: readonly OwnedItem[]): Promise<Room | null> {
    return this.mutate(roomId, (room) => ({
      ...room,
      placements: autoPlace(ownedItems, ITEMS_BY_ID, room.slots),
    }));
  },

  /** Camera target for the current focal item, for the look-at transition. */
  cameraTarget(room: Room): CameraTarget | null {
    const placement = focusedPlacement(room);
    if (!placement) return null;
    const slot = room.slots.find((s) => s.id === placement.slotId);
    return slot ? cameraTargetFor(slot) : null;
  },

  /** Items that did not fit the theme's slot map — the user picks what to swap in. */
  overflow(room: Room, ownedItemIds: readonly string[]): string[] {
    return overflowItemIds(ownedItemIds, room.placements);
  },

  slotsByProminence(slots: readonly Slot[]): Slot[] {
    return slotsByProminence(slots);
  },

  placementFor(room: Room, slotId: string): Placement | undefined {
    return room.placements.find((p) => p.slotId === slotId);
  },

  /** Shared write path — seeded rooms are immutable, session rooms are not. */
  async mutate(roomId: string, fn: (room: Room) => Room): Promise<Room | null> {
    const index = created.findIndex((r) => r.id === roomId);
    if (index === -1) {
      const seeded = ROOMS_BY_ID.get(roomId);
      if (!seeded) return delay(null, LATENCY_INSTANT);
      // Copy-on-write so a demo edit to a seeded room does not mutate a fixture.
      const before: Room = {
        ...seeded,
        slots: [...seeded.slots],
        placements: [...seeded.placements],
      };
      const copy = fn(before);
      assertRoomValid(copy);
      pushHistory(roomId, before);
      created.push(copy);
      return delay(copy, LATENCY_INSTANT);
    }
    const before = created[index]!;
    const updated = fn(before);
    assertRoomValid(updated);
    pushHistory(roomId, before);
    created[index] = updated;
    return delay(updated, LATENCY_INSTANT);
  },
};

export type RoomService = typeof roomService;
