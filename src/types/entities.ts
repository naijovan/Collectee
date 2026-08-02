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

export interface Comment {
  id: string;
  targetType: TargetType;
  targetId: string;
  userId: string;
  body: string;
  /** Null for a top-level comment. */
  parentId: string | null;
  likeCount: number;
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
