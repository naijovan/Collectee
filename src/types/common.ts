/**
 * Shared primitives and unions.
 *
 * PRD §12.2 (rarity), §9.2 (trust), §8.1 (titles).
 * Every string union in the app lives here — no ad-hoc string literals in
 * fixtures, services or screens.
 */

/** PRD §8.1 — the three demo titles. Adding a title = a new catalogue, not a new code path. */
export type GameTitle = 'codm' | 'valorant' | 'mlbb';

export const GAME_TITLES: readonly GameTitle[] = ['codm', 'valorant', 'mlbb'] as const;

/** Display names. Use the Garena SEA wording for CODM (PRD §8.1). */
export const GAME_LABELS: Record<GameTitle, string> = {
  codm: 'Call of Duty: Mobile',
  valorant: 'Valorant',
  mlbb: 'Mobile Legends: Bang Bang',
};

/** Short badge text for dense cards. */
export const GAME_SHORT_LABELS: Record<GameTitle, string> = {
  codm: 'CODM',
  valorant: 'VALORANT',
  mlbb: 'MLBB',
};

export const GAME_PUBLISHERS: Record<GameTitle, string> = {
  codm: 'Activision / TiMi — published by Garena in SEA',
  valorant: 'Riot Games',
  mlbb: 'Moonton',
};

/**
 * PRD §12.2 — normalised internally, native label displayed.
 * Sorting, filtering, grouping and colour tokens use `rarityTier`;
 * the UI prints `rarityLabel`. No other rarity strings anywhere in the codebase.
 */
export type RarityTier = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITY_TIERS: readonly RarityTier[] = [
  'common',
  'rare',
  'epic',
  'legendary',
  'mythic',
] as const;

/** PRD §9.2 — trust is a visible social attribute, not a hidden cryptographic one. */
export type TrustLevel = 'verified' | 'unverified';

/** How an OwnedItem entered the account. */
export type OwnershipSource = 'scan' | 'manual' | 'linked-account';

/** PRD §12.3 — Collection.visibility */
export type Visibility = 'public' | 'unlisted' | 'private';

/** PRD §12.3 — GameAccount.linkStatus. Verified tier is partnership-gated (§9.3). */
export type LinkStatus = 'unlinked' | 'pending' | 'linked' | 'failed';

/** Anything that can be commented on or flagged. */
export type TargetType = 'item' | 'collection' | 'room' | 'comment' | 'user' | 'post';

/** PRD §9.2 — the three ownership flag reasons, plus moderation reasons from F5. */
export type FlagReason =
  | 'false_ownership'
  | 'duplicate_uniqueness'
  | 'identity_impersonation'
  | 'abusive_content'
  | 'spam';

export type FlagStatus = 'open' | 'under_review' | 'upheld' | 'dismissed';

/** PRD §12.3 — Post.type */
export type PostType = 'collection' | 'room';

/** PRD §12.3 — FollowedTopic.kind */
export type TopicKind = 'game' | 'franchise' | 'character';

export type NotificationKind =
  | 'follow'
  | 'comment'
  | 'like'
  | 'community_post'
  | 'news'
  | 'flag_resolved';

export type CommunityNotificationPref = 'all' | 'highlights' | 'none';

/** ISO-8601 timestamp. Fixtures use absolute dates so nothing drifts at demo time. */
export type IsoDateString = string;

/** Confidence in [0, 1]. Routed per PRD §11 F1 step 4. */
export type Confidence = number;
