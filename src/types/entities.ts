/**
 * Core entities — PRD §12.3.
 *
 * "Agree this schema before anyone branches. All flows read the same
 *  `OwnedItem` and `Collection` shapes." — PRD §12.3
 *
 * This file is the merge contract. Changing a field here is a PR announced in
 * chat, not a local edit.
 */

import type {
  CommunityNotificationPref,
  Confidence,
  FlagReason,
  FlagStatus,
  GameTitle,
  IsoDateString,
  LinkStatus,
  NotificationKind,
  OwnershipSource,
  PostType,
  RarityTier,
  TargetType,
  TopicKind,
  TrustLevel,
  Visibility,
} from './common';

export interface User {
  id: string;
  handle: string;
  displayName: string;
  avatar: string;
  bio: string;
  followedGames: GameTitle[];
  /** Account-level blue tick. NOT the same concept as item trust level (PRD §9.3). */
  isAccountVerified: boolean;
}

export interface GameAccount {
  userId: string;
  title: GameTitle;
  externalHandle: string;
  /** [ROADMAP] Real linking is partnership-gated — no launch title has a public inventory API (§9.3). */
  linkStatus: LinkStatus;
}

/** A catalogue entry: the item as it exists in the game, independent of who owns it. */
export interface Item {
  id: string;
  title: GameTitle;
  name: string;
  /** Normalised tier — drives sorting, filtering and colour tokens (§12.2). */
  rarityTier: RarityTier;
  /** Native in-game label — this is what the UI prints (§12.2). */
  rarityLabel: string;
  /** Null when the item does not belong to a set. */
  setId: string | null;
  renderUrl: string;
  /**
   * 0–1, share of players who own it. Drives inverse-popularity weighting in
   * match scoring (§11 F5) — a common battle-pass skin says little, a limited
   * exclusive says a lot.
   */
  popularityScore: number;
}

export interface ItemSet {
  id: string;
  title: GameTitle;
  name: string;
  itemIds: string[];
  /** Full set size — may exceed itemIds.length when the catalogue is partial. */
  totalCount: number;
}

/** An item in a specific user's inventory. */
export interface OwnedItem {
  id: string;
  userId: string;
  itemId: string;
  trustLevel: TrustLevel;
  source: OwnershipSource;
  /** Scanner confidence when source === 'scan'; null for manual/linked. */
  confidence: Confidence | null;
  quantity: number;
  acquiredAt: IsoDateString;
}

export interface Collection {
  id: string;
  userId: string;
  name: string;
  description: string;
  coverUrl: string;
  themeTags: string[];
  /** References Item.id — an item can belong to multiple collections (§11 F3). */
  itemIds: string[];
  visibility: Visibility;
  allowComments: boolean;
  showOnProfile: boolean;
  likeCount: number;
  createdAt: IsoDateString;
}

export interface Post {
  id: string;
  userId: string;
  type: PostType;
  /** Collection.id or Room.id depending on `type`. */
  targetId: string;
  caption: string;
  createdAt: IsoDateString;
}

export interface Follow {
  followerId: string;
  followeeId: string;
  createdAt: IsoDateString;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  avatarUrl: string;
  tags: string[];
  memberIds: string[];
  memberCount: number;
}

export interface CommunityMembership {
  userId: string;
  communityId: string;
  notificationPref: CommunityNotificationPref;
}

/**
 * A discussion inside a community (§11 F5).
 *
 * Threads are where the social half of communities actually happens — showing
 * off a pull, arguing about a patch, finding people to play with. §14 rung 3
 * gates POSTING behind `FEATURES.communityPosting`; reading is never gated, so
 * a descoped build still shows seeded conversations.
 *
 * Replies are NOT modelled here. A reply is a `Comment` with
 * `targetType: 'thread'` and `targetId` set to the thread — see `TargetType`
 * for why.
 */
export interface CommunityThread {
  id: string;
  communityId: string;
  /** Author. */
  userId: string;
  title: string;
  body: string;
  /** Pinned threads sort above everything else — rules, welcomes, event posts. */
  pinned: boolean;
  createdAt: IsoDateString;
}

export interface Comment {
  id: string;
  /** `'thread'` when this is a reply in a community discussion. */
  targetType: TargetType;
  targetId: string;
  userId: string;
  body: string;
  /**
   * Null for a top-level comment — or, on a thread, for a direct reply to the
   * thread itself. One level of nesting only (§11 F5 scope): a reply may point
   * at another reply, but nothing points at that.
   */
  parentId: string | null;
  likeCount: number;
  /**
   * Seeded vote tallies, for thread replies (§11 F5 discussion).
   *
   * OPTIONAL, and that is the contract point: `Comment` is also a collection
   * comment and a room comment, and neither of those is voted on. Absent means
   * "not a voted surface", which reads as zero everywhere it is summed, so no
   * existing fixture had to change.
   *
   * These are the SEED only. A viewer's own vote is session state in
   * `threadService` and is never written back here — see the note there. The
   * score a reply displays is this pair plus that overlay.
   *
   * Voting is deliberately separate from `likeCount`, which predates it and
   * means something else: a like is an endorsement with no opposite, and it is
   * shown on collection comments too. Folding the two together would have made
   * every existing like a vote in a ranking it was never cast for.
   */
  upvotes?: number;
  downvotes?: number;
  createdAt: IsoDateString;
}

/**
 * PRD §9.2 — flags do not auto-remove. Threshold behaviour lives in
 * `domain/trust.ts`, not here.
 */
export interface Flag {
  id: string;
  targetType: TargetType;
  targetId: string;
  reporterId: string;
  reason: FlagReason;
  status: FlagStatus;
  createdAt: IsoDateString;
}

export interface Article {
  id: string;
  source: string;
  sourceTitle: string;
  title: string;
  url: string;
  imageUrl: string;
  /** AI summary — the one place a real model call may run (§12.1). */
  summary: string;
  tags: string[];
  /** Games this article is about — drives FYP relevance against owned items (§11 F6). */
  relatedGames: GameTitle[];
  /** Item ids the article concerns, e.g. a skin whose champion is being reworked. */
  relatedItemIds: string[];
  publishedAt: IsoDateString;
}

/**
 * The seeded "What's happening in <game>" digest (§11 F6).
 *
 * Every game has one, always. When the live digest runs it replaces these
 * bullets for that render; when it does not — flag off, no endpoint, timeout,
 * refusal — these are what the card shows, and the label says which it is.
 * The card is never empty and never lies about where its text came from.
 *
 * `sourceArticleIds` is not decoration: it is the claim that these bullets are
 * supported by seeded articles, and `validate-fixtures` enforces it.
 */
export interface GameDigest {
  title: GameTitle;
  bullets: string[];
  /** Articles these bullets are drawn from. Must be that game's articles. */
  sourceArticleIds: string[];
}

export interface SavedArticle {
  userId: string;
  articleId: string;
  savedAt: IsoDateString;
}

export interface FollowedTopic {
  userId: string;
  kind: TopicKind;
  value: string;
}

export interface Notification {
  id: string;
  userId: string;
  kind: NotificationKind;
  targetId: string;
  body: string;
  read: boolean;
  createdAt: IsoDateString;
}
