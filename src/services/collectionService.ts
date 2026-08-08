/**
 * Collections — PRD §11 F3. Flow owner: Bernard (J2).
 *
 * "This flow is not one of the five AI features but it is where value is
 *  actually created — the moment an inventory dump becomes an identity."
 *
 * Acceptance criteria: publish in under 90 seconds from the Collections tab;
 * items can belong to multiple collections; public pages are link-shareable.
 */

import { COLLECTIONS, COLLECTIONS_BY_ID } from '@/fixtures/collections';
import { ALL_SETS, ITEMS_BY_ID } from '@/fixtures/catalogue';
import {
  isDiscoverable,
  rankByVerification,
  setsInProgress,
  suggestCollections,
  suggestItemsThatFit,
  suggestTheme,
} from '@/domain/collections';
import type {
  CollectionSuggestion,
  ItemFit,
  SetProgress,
  ThemeSuggestion,
} from '@/domain/collections';
import type { Item } from '@/types';
import type { Collection, OwnedItem, Visibility } from '@/types';
/**
 * For feed ranking only. Safe from a cycle: `inventoryService` reads fixtures
 * and `domain/rarity`, and imports nothing from this file.
 */
import { inventoryService } from './inventoryService';
import { LATENCY_FETCH, LATENCY_GENERATE, LATENCY_INSTANT, delay } from './latency';

export interface CreateCollectionInput {
  userId: string;
  name: string;
  description: string;
  coverUrl: string;
  themeTags: string[];
  itemIds: string[];
  visibility: Visibility;
  allowComments: boolean;
  showOnProfile: boolean;
}

/**
 * Mutable in-memory store layered over the fixtures. The demo has no backend
 * (§12.1), so writes live here for the session. Reads always merge the two.
 */
const created: Collection[] = [];
const updated = new Map<string, Collection>();
let nextId = 1;

function allCollections(): Collection[] {
  return [
    ...COLLECTIONS.map((collection) => updated.get(collection.id) ?? collection),
    ...created,
  ];
}

export const collectionService = {
  /**
   * The public feed, verified collections first.
   *
   * The ordering is not decoration. The Import flow's Verify step tells people
   * that skipping verification ranks their collection below verified ones in
   * other collectors' feeds, and this is the code that makes that true. If the
   * ranking is ever removed, that copy has to go with it.
   *
   * Ownership is read here rather than in the domain function because
   * `domain/` takes no I/O (CLAUDE.md) — the service is where the two fixtures
   * meet.
   */
  async getPublicCollections(): Promise<Collection[]> {
    const all = allCollections().filter(isDiscoverable);
    const ranked = rankByVerification(all, inventoryService.getVerifiedItemIdsByUser());
    return delay(ranked, LATENCY_FETCH);
  },

  async getCollectionsByUser(userId: string, includePrivate = false): Promise<Collection[]> {
    const all = allCollections()
      .filter((c) => c.userId === userId)
      .filter((c) => includePrivate || isDiscoverable(c));
    return delay(all, LATENCY_FETCH);
  },

  async getCollection(id: string): Promise<Collection | null> {
    const found =
      updated.get(id) ?? created.find((c) => c.id === id) ?? COLLECTIONS_BY_ID.get(id) ?? null;
    return delay(found, LATENCY_INSTANT);
  },

  /**
   * Delete a collection the viewer created this session.
   *
   * Seeded fixtures are not deletable: they are a frozen `as const` array and
   * the demo depends on them existing. Returns whether anything was removed, so
   * a screen can say "this one cannot be deleted" rather than appearing to
   * succeed and leaving the row on screen.
   */
  async deleteCollection(id: string): Promise<boolean> {
    const index = created.findIndex((collection) => collection.id === id);
    if (index < 0) return delay(false, LATENCY_INSTANT);
    created.splice(index, 1);
    return delay(true, LATENCY_INSTANT);
  },

  /** Whether this collection can be deleted — false for the seeded ones. */
  isDeletable(id: string): boolean {
    return created.some((collection) => collection.id === id);
  },

  async createCollection(input: CreateCollectionInput): Promise<Collection> {
    const collection: Collection = {
      id: `col-new-${nextId++}`,
      ...input,
      likeCount: 0,
      // Injected rather than read from the clock inside a pure store so tests
      // and the demo stay deterministic where it matters.
      createdAt: new Date().toISOString(),
    };
    created.push(collection);
    return delay(collection, LATENCY_FETCH);
  },

  async updateCollection(id: string, patch: Partial<Collection>): Promise<Collection | null> {
    const index = created.findIndex((c) => c.id === id);
    if (index !== -1) {
      const next = { ...created[index]!, ...patch, id };
      created[index] = next;
      return delay(next, LATENCY_INSTANT);
    }

    const base = updated.get(id) ?? COLLECTIONS_BY_ID.get(id);
    if (!base) return delay(null, LATENCY_INSTANT);
    const next = { ...base, ...patch, id };
    updated.set(id, next);
    return delay(next, LATENCY_INSTANT);
  },

  /**
   * The "AI assists" half of F3 — suggested groupings and titles. Deterministic
   * because the demo is mocked; the interface is what a model call would fill.
   */
  async suggest(owned: readonly OwnedItem[]): Promise<CollectionSuggestion[]> {
    return delay(suggestCollections(owned, ITEMS_BY_ID, ALL_SETS), LATENCY_GENERATE);
  },

  /**
   * Step 3 of J2 — a theme for what the user has picked so far, plus owned
   * items that would extend it. Each fit carries its reason (§11 F5).
   *
   * Takes the user's owned items rather than reading a fixture directly so the
   * phase-2 swap to a model call is a change inside this method only.
   */
  async suggestForSelection(
    selectedItemIds: readonly string[],
    owned: readonly OwnedItem[],
  ): Promise<{ theme: ThemeSuggestion | null; fits: ItemFit[] }> {
    const selectedIds = new Set(selectedItemIds);
    const resolve = (id: string): Item | undefined => ITEMS_BY_ID.get(id);

    const selected = selectedItemIds
      .map(resolve)
      .filter((i): i is Item => i !== undefined);

    // Candidates are what the user owns but has not already put in.
    const candidates = owned
      .filter((o) => !selectedIds.has(o.itemId))
      .map((o) => resolve(o.itemId))
      .filter((i): i is Item => i !== undefined);

    return delay(
      { theme: suggestTheme(selected), fits: suggestItemsThatFit(selected, candidates) },
      LATENCY_GENERATE,
    );
  },

  /** Set-completion progress for the Completionist persona (§4). */
  async setProgressFor(owned: readonly OwnedItem[]): Promise<SetProgress[]> {
    const ownedIds = new Set(owned.map((o) => o.itemId));
    return delay(setsInProgress(ALL_SETS, ownedIds), LATENCY_INSTANT);
  },
};

export type CollectionService = typeof collectionService;
