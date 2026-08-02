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
import { isDiscoverable, setsInProgress, suggestCollections } from '@/domain/collections';
import type { CollectionSuggestion, SetProgress } from '@/domain/collections';
import type { Collection, OwnedItem, Visibility } from '@/types';
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
let nextId = 1;

export const collectionService = {
  async getPublicCollections(): Promise<Collection[]> {
    const all = [...COLLECTIONS, ...created].filter(isDiscoverable);
    return delay(all, LATENCY_FETCH);
  },

  async getCollectionsByUser(userId: string, includePrivate = false): Promise<Collection[]> {
    const all = [...COLLECTIONS, ...created]
      .filter((c) => c.userId === userId)
      .filter((c) => includePrivate || isDiscoverable(c));
    return delay(all, LATENCY_FETCH);
  },

  async getCollection(id: string): Promise<Collection | null> {
    const found = COLLECTIONS_BY_ID.get(id) ?? created.find((c) => c.id === id) ?? null;
    return delay(found, LATENCY_INSTANT);
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
    if (index === -1) return delay(null, LATENCY_INSTANT);
    const updated = { ...created[index]!, ...patch, id };
    created[index] = updated;
    return delay(updated, LATENCY_INSTANT);
  },

  /**
   * The "AI assists" half of F3 — suggested groupings and titles. Deterministic
   * because the demo is mocked; the interface is what a model call would fill.
   */
  async suggest(owned: readonly OwnedItem[]): Promise<CollectionSuggestion[]> {
    return delay(suggestCollections(owned, ITEMS_BY_ID, ALL_SETS), LATENCY_GENERATE);
  },

  /** Set-completion progress for the Completionist persona (§4). */
  async setProgressFor(owned: readonly OwnedItem[]): Promise<SetProgress[]> {
    const ownedIds = new Set(owned.map((o) => o.itemId));
    return delay(setsInProgress(ALL_SETS, ownedIds), LATENCY_INSTANT);
  },
};

export type CollectionService = typeof collectionService;
