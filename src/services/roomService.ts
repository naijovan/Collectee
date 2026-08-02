/**
 * Collection Rooms — PRD §11 F4. Flow owner: Jovan (J3). THE DIFFERENTIATOR.
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
  swapPlacements,
} from '@/domain/room';
import type { CameraTarget } from '@/domain/room';
import type { OwnedItem, Placement, Room, RoomTheme, Slot, Visibility } from '@/types';
import { LATENCY_FETCH, LATENCY_GENERATE, LATENCY_INSTANT, delay, delayWithProgress } from './latency';

/** §11 F4 acceptance criterion: generation completes in under 20s. */
const GENERATION_MS = LATENCY_GENERATE * 4;

const created: Room[] = [];
let nextId = 1;

/** Backdrop cache — reused across users on the same theme and palette (§11 F4). */
const backdropCache = new Map<string, string>();

export const roomService = {
  async getThemes(): Promise<RoomTheme[]> {
    return delay([...ROOM_THEMES], LATENCY_INSTANT);
  },

  async getTheme(id: string): Promise<RoomTheme | null> {
    return delay(THEMES_BY_ID.get(id) ?? null, LATENCY_INSTANT);
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
    if (cached) return delay(cached, LATENCY_INSTANT);

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
    themeId: string;
    ownedItems: readonly OwnedItem[];
    onProgress?: (fraction: number) => void;
  }): Promise<Room> {
    const theme = THEMES_BY_ID.get(params.themeId);
    if (!theme) throw new Error(`Unknown room theme "${params.themeId}"`);

    const backdropUrl = await this.generateBackdrop(params.themeId, params.onProgress);
    const slots: Slot[] = [...theme.slots];
    const placements = autoPlace(params.ownedItems, ITEMS_BY_ID, slots);

    const room: Room = {
      id: `room-new-${nextId++}`,
      collectionId: params.collectionId,
      themeId: theme.id,
      backdropUrl,
      slots,
      placements,
      settings: { parallaxEnabled: true, focusedSlotId: null },
      visibility: 'private',
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

  async publish(roomId: string, visibility: Visibility): Promise<Room | null> {
    return this.mutate(roomId, (room) => ({
      ...room,
      visibility,
      publishedAt: new Date().toISOString(),
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
      const copy = fn({ ...seeded, slots: [...seeded.slots], placements: [...seeded.placements] });
      assertRoomValid(copy);
      created.push(copy);
      return delay(copy, LATENCY_INSTANT);
    }
    const updated = fn(created[index]!);
    assertRoomValid(updated);
    created[index] = updated;
    return delay(updated, LATENCY_INSTANT);
  },
};

export type RoomService = typeof roomService;
