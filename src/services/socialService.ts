/**
 * Social graph, comments, moderation and notifications.
 *
 * The moderation half is REQUIRED, not optional (§11 F5): comment reporting,
 * block/mute, slur filtering and an impersonation takedown path, all feeding
 * the same review queue as the ownership flags in §9.2.
 *
 * §8.2 lists "safer and more inclusive communities" as an explicit judging
 * theme. Do not treat this file as plumbing.
 */

import {
  COMMENTS,
  COMMUNITIES,
  COMMUNITY_MEMBERSHIPS,
  FLAGS,
  FOLLOWS,
  NOTIFICATIONS,
} from '@/fixtures/social';
import { USERS, USERS_BY_ID } from '@/fixtures/users';
import {
  countableFlags,
  deriveTrust,
  discoveryWeight,
  isUnderReview,
  rankByTrust,
  reviewStateFor,
} from '@/domain/trust';
import type { DerivedTrust, ReviewState } from '@/domain/trust';
import { catalogueService } from './catalogueService';
import type {
  Comment,
  Community,
  CommunityNotificationPref,
  Flag,
  FlagReason,
  Follow,
  Notification,
  OwnedItem,
  TargetType,
  TrustLevel,
  User,
} from '@/types';
import { inventoryService } from './inventoryService';
import { LATENCY_FETCH, LATENCY_INSTANT, delay } from './latency';

const follows: Follow[] = [...FOLLOWS];
const comments: Comment[] = [...COMMENTS];
const flags: Flag[] = [...FLAGS];
const notifications: Notification[] = [...NOTIFICATIONS];
const communityMembers = new Map<string, Set<string>>(
  COMMUNITIES.map((c) => [c.id, new Set<string>(c.memberIds)]),
);
const blocked = new Map<string, Set<string>>();
/** §12.3 `CommunityMembership.notificationPref`, keyed `userId:communityId`. */
const membershipPrefs = new Map<string, CommunityNotificationPref>(
  COMMUNITY_MEMBERSHIPS.map((m) => [`${m.userId}:${m.communityId}`, m.notificationPref]),
);
let nextId = 1;

const DEFAULT_NOTIFICATION_PREF: CommunityNotificationPref = 'all';

function prefKey(userId: string, communityId: string): string {
  return `${userId}:${communityId}`;
}

/** What a moderator is being asked to judge, resolved once by the service. */
export interface ReviewPreview {
  title: string;
  body: string | null;
  authorId: string | null;
  authorName: string | null;
}

export interface ReviewQueueEntry {
  targetId: string;
  targetType: TargetType;
  flags: Flag[];
  state: ReviewState;
  preview: ReviewPreview;
}

function oldestReport(entryFlags: readonly Flag[]): string {
  return entryFlags.reduce(
    (oldest, flag) => (Date.parse(flag.createdAt) < Date.parse(oldest) ? flag.createdAt : oldest),
    entryFlags[0]!.createdAt,
  );
}

/**
 * Resolve a flag target into something a human can judge.
 *
 * An `item` target is an OwnedItem id, so this reads the claim (whose it is) and
 * the catalogue entry (what it is) — a moderator needs both. A `comment` target
 * reads the body. Anything else degrades to the raw id rather than guessing;
 * `thread` lands here when community threads arrive.
 */
async function previewFor(targetType: TargetType, targetId: string): Promise<ReviewPreview> {
  if (targetType === 'item') {
    const owned = await inventoryService.getOwnedItem(targetId);
    const item = owned ? await catalogueService.getItem(owned.itemId) : null;
    const owner = owned ? USERS_BY_ID.get(owned.userId) : undefined;
    return {
      title: item?.name ?? targetId,
      body: owned ? `Claimed as ${owned.trustLevel}, added by ${owned.source}` : null,
      authorId: owned?.userId ?? null,
      authorName: owner?.displayName ?? null,
    };
  }

  if (targetType === 'comment') {
    const comment = comments.find((c) => c.id === targetId);
    const author = comment ? USERS_BY_ID.get(comment.userId) : undefined;
    return {
      title: author ? `Reply by ${author.displayName}` : 'Reply',
      body: comment?.body ?? null,
      authorId: comment?.userId ?? null,
      authorName: author?.displayName ?? null,
    };
  }

  if (targetType === 'user') {
    // §11 F5 names an impersonation takedown path; a reported account is the
    // one queue entry where the target and the author are the same person.
    const user = USERS_BY_ID.get(targetId);
    return {
      title: user ? `@${user.handle}` : targetId,
      body: user?.bio ?? null,
      authorId: user?.id ?? null,
      authorName: user?.displayName ?? null,
    };
  }

  return { title: targetId, body: null, authorId: null, authorName: null };
}

/**
 * §9.2 — only accounts with their own verified items can move the needle.
 *
 * Read through `inventoryService`, not the fixture: linking an account promotes
 * items to verified during the session, and that is exactly what should make an
 * account an eligible flagger. Reading the seeded data would freeze eligibility
 * at app start and quietly contradict the trust model it implements.
 */
function reporterIsEligible(reporterId: string): boolean {
  const verified = inventoryService.getVerifiedItemIdsByUser().get(reporterId) ?? [];
  return verified.length > 0;
}

export const socialService = {
  // ── Follows ──────────────────────────────────────────────────────────
  async getFollowing(userId: string): Promise<User[]> {
    const ids = follows.filter((f) => f.followerId === userId).map((f) => f.followeeId);
    return delay(ids.map((id) => USERS_BY_ID.get(id)).filter((u): u is User => !!u), LATENCY_FETCH);
  },

  async getFollowers(userId: string): Promise<User[]> {
    const ids = follows.filter((f) => f.followeeId === userId).map((f) => f.followerId);
    return delay(ids.map((id) => USERS_BY_ID.get(id)).filter((u): u is User => !!u), LATENCY_FETCH);
  },

  isFollowing(followerId: string, followeeId: string): boolean {
    return follows.some((f) => f.followerId === followerId && f.followeeId === followeeId);
  },

  async toggleFollow(followerId: string, followeeId: string): Promise<boolean> {
    const index = follows.findIndex(
      (f) => f.followerId === followerId && f.followeeId === followeeId,
    );
    if (index === -1) {
      follows.push({ followerId, followeeId, createdAt: new Date().toISOString() });
      return delay(true, LATENCY_INSTANT);
    }
    follows.splice(index, 1);
    return delay(false, LATENCY_INSTANT);
  },

  async getUser(id: string): Promise<User | null> {
    return delay(USERS_BY_ID.get(id) ?? null, LATENCY_INSTANT);
  },

  async getUsers(): Promise<User[]> {
    return delay([...USERS], LATENCY_FETCH);
  },

  // ── Communities ──────────────────────────────────────────────────────
  async getCommunity(id: string): Promise<Community | null> {
    return delay(COMMUNITIES.find((c) => c.id === id) ?? null, LATENCY_INSTANT);
  },

  isMember(userId: string, communityId: string): boolean {
    return communityMembers.get(communityId)?.has(userId) ?? false;
  },

  async toggleMembership(userId: string, communityId: string): Promise<boolean> {
    const members = communityMembers.get(communityId);
    if (!members) return delay(false, LATENCY_INSTANT);
    const joined = !members.has(userId);
    if (joined) members.add(userId);
    else members.delete(userId);
    // The notification pref deliberately survives a leave, so re-joining
    // restores what the user last chose rather than silently resetting them
    // to the default.
    return delay(joined, LATENCY_INSTANT);
  },

  /**
   * Members as `User`s, read from the live membership map rather than the
   * frozen `Community.memberIds` fixture — otherwise anyone who joins during
   * the session is absent from the list they just joined.
   */
  async getCommunityMembers(communityId: string): Promise<User[]> {
    const ids = communityMembers.get(communityId) ?? new Set<string>();
    return delay(
      [...ids].map((id) => USERS_BY_ID.get(id)).filter((u): u is User => u !== undefined),
      LATENCY_FETCH,
    );
  },

  /**
   * Display member count.
   *
   * `Community.memberCount` is the real-world-scale figure (§15 wants counts
   * that read as plausible — thousands, not the handful of seeded accounts), so
   * a session join has to move it by the delta against the seeded roster rather
   * than replace it with the size of the live set.
   */
  memberCountFor(community: Community): number {
    const live = communityMembers.get(community.id)?.size ?? 0;
    return community.memberCount + (live - community.memberIds.length);
  },

  /** §12.3 `CommunityMembership.notificationPref`. */
  membershipPrefFor(userId: string, communityId: string): CommunityNotificationPref {
    return membershipPrefs.get(prefKey(userId, communityId)) ?? DEFAULT_NOTIFICATION_PREF;
  },

  async setMembershipPref(
    userId: string,
    communityId: string,
    pref: CommunityNotificationPref,
  ): Promise<CommunityNotificationPref> {
    membershipPrefs.set(prefKey(userId, communityId), pref);
    return delay(pref, LATENCY_INSTANT);
  },

  // ── Comments ─────────────────────────────────────────────────────────
  /** Blocked users' comments are filtered out for the viewer (§11 F5 moderation). */
  async getComments(
    targetType: TargetType,
    targetId: string,
    viewerId?: string,
  ): Promise<Comment[]> {
    const blockList = viewerId ? (blocked.get(viewerId) ?? new Set<string>()) : new Set<string>();
    const visible = comments
      .filter((c) => c.targetType === targetType && c.targetId === targetId)
      .filter((c) => !blockList.has(c.userId))
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    return delay(visible, LATENCY_FETCH);
  },

  async addComment(params: {
    targetType: TargetType;
    targetId: string;
    userId: string;
    body: string;
    parentId?: string | null;
  }): Promise<Comment> {
    const comment: Comment = {
      id: `cmt-new-${nextId++}`,
      targetType: params.targetType,
      targetId: params.targetId,
      userId: params.userId,
      body: params.body,
      parentId: params.parentId ?? null,
      likeCount: 0,
      createdAt: new Date().toISOString(),
    };
    comments.push(comment);
    return delay(comment, LATENCY_INSTANT);
  },

  /**
   * Block someone (§11 F5 moderation).
   *
   * Blocking is one-directional and private to the viewer — it is not a report
   * and it does not touch the review queue. Nobody is told, and the blocked
   * account keeps working normally for everyone else. That separation matters:
   * §9.2's queue is for community judgement, blocking is for one person wanting
   * a quieter feed, and conflating them turns a personal preference into a
   * moderation signal other people's rankings depend on.
   */
  async blockUser(viewerId: string, targetId: string): Promise<void> {
    const set = blocked.get(viewerId) ?? new Set<string>();
    set.add(targetId);
    blocked.set(viewerId, set);
    await delay(null, LATENCY_INSTANT);
  },

  async unblockUser(viewerId: string, targetId: string): Promise<void> {
    blocked.get(viewerId)?.delete(targetId);
    await delay(null, LATENCY_INSTANT);
  },

  isBlocked(viewerId: string, targetId: string): boolean {
    return blocked.get(viewerId)?.has(targetId) ?? false;
  },

  /** Everyone this viewer has blocked. Discovery surfaces filter against it. */
  blockedBy(viewerId: string): ReadonlySet<string> {
    return blocked.get(viewerId) ?? new Set<string>();
  },

  // ── Flags and the review queue (§9.2) ────────────────────────────────
  /**
   * Raise a flag. Flags NEVER auto-remove — crossing the threshold moves the
   * target into the review queue and drops its discovery ranking, nothing more.
   */
  async raiseFlag(params: {
    targetType: TargetType;
    targetId: string;
    reporterId: string;
    reason: FlagReason;
  }): Promise<Flag> {
    const flag: Flag = {
      id: `flag-new-${nextId++}`,
      targetType: params.targetType,
      targetId: params.targetId,
      reporterId: params.reporterId,
      reason: params.reason,
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    flags.push(flag);
    return delay(flag, LATENCY_INSTANT);
  },

  flagsFor(targetId: string): Flag[] {
    return flags.filter((f) => f.targetId === targetId);
  },

  /** Distinct eligible reporters — what actually counts toward the threshold. */
  countableFlagsFor(targetId: string): number {
    return countableFlags(this.flagsFor(targetId), reporterIsEligible);
  },

  /** Has this target crossed `FLAG_THRESHOLD`? */
  isUnderReview(targetId: string): boolean {
    return isUnderReview(this.flagsFor(targetId), reporterIsEligible);
  },

  /** Full review state for a target — both thresholds, evaluated separately. */
  reviewStateFor(targetId: string): ReviewState {
    return reviewStateFor(this.flagsFor(targetId), reporterIsEligible);
  },

  /**
   * Resolve every open report on a target.
   *
   * `upheld` keeps the target suppressed — `reviewStateFor` treats an upheld
   * decision as outliving the live count, because resolving the flags otherwise
   * drops the count to zero and hands discovery ranking straight back to
   * something a moderator just judged. `dismissed` releases it.
   *
   * Flags still never auto-remove anything (§9.2). This records a human
   * decision; it does not delete the item, the comment or the account.
   */
  async resolveReports(targetId: string, status: 'upheld' | 'dismissed'): Promise<number> {
    let resolved = 0;
    for (const flag of flags) {
      if (flag.targetId !== targetId) continue;
      if (flag.status !== 'open' && flag.status !== 'under_review') continue;
      flag.status = status;
      resolved += 1;
    }
    return delay(resolved, LATENCY_INSTANT);
  },

  /**
   * The moderation queue — §8.2's "safer communities" made visible.
   *
   * One queue, mixed target types: an ownership claim and a reported reply sit
   * side by side, each judged against its own threshold. Entries carry a
   * resolved `preview` so the screen never has to reach past the service to work
   * out what it is looking at.
   */
  async getReviewQueue(): Promise<ReviewQueueEntry[]> {
    const byTarget = new Map<string, Flag[]>();
    for (const flag of flags) {
      byTarget.set(flag.targetId, [...(byTarget.get(flag.targetId) ?? []), flag]);
    }

    const queue: ReviewQueueEntry[] = [];
    for (const [targetId, targetFlags] of byTarget) {
      const state = reviewStateFor(targetFlags, reporterIsEligible);
      if (!state.underReview) continue;
      const targetType = targetFlags[0]!.targetType;
      queue.push({
        targetId,
        targetType,
        flags: targetFlags,
        state,
        preview: await previewFor(targetType, targetId),
      });
    }

    // Oldest report first: a queue that surfaces the newest thing buries
    // whatever has been waiting longest, which is the opposite of a queue.
    queue.sort(
      (a, b) => Date.parse(oldestReport(a.flags)) - Date.parse(oldestReport(b.flags)),
    );
    return delay(queue, LATENCY_FETCH);
  },

  /** @deprecated Kept for the diagnostics screen; use getReviewQueue. */
  async getReviewQueueRaw(): Promise<{ targetId: string; flags: Flag[] }[]> {
    const byTarget = new Map<string, Flag[]>();
    for (const flag of flags) {
      byTarget.set(flag.targetId, [...(byTarget.get(flag.targetId) ?? []), flag]);
    }
    const queue = [...byTarget.entries()]
      .filter(([, targetFlags]) => isUnderReview(targetFlags, reporterIsEligible))
      .map(([targetId, targetFlags]) => ({ targetId, flags: targetFlags }));
    return delay(queue, LATENCY_FETCH);
  },

  /** Ranking multiplier for a specific owned item, trust + flags combined. */
  discoveryWeightFor(ownedItemId: string, trustLevel: TrustLevel): number {
    return discoveryWeight(trustLevel, this.isUnderReview(ownedItemId));
  },

  /**
   * Item-level discovery ranking (§9.2): verified first, unverified after,
   * anything past the flag threshold dropped entirely.
   *
   * Keyed on `OwnedItem.id` — see `FLAG_TARGET_ID_SPACE` in domain/trust.ts for
   * why a flag can only ever target an ownership claim, and for the outstanding
   * TODO(Bernard) on the collection screen.
   */
  rankOwnedItemsForDiscovery(ownedItems: readonly OwnedItem[]): OwnedItem[] {
    return rankByTrust(ownedItems, (owned) => ({
      trustLevel: owned.trustLevel,
      underReview: this.isUnderReview(owned.id),
    }));
  },

  /**
   * Derived trust for a set of owned items — a collection, a room, a profile
   * section. Nothing stores this (§12.3 gives Collection no trust field, and it
   * should not get one); it is computed so it cannot drift from the items.
   */
  derivedTrustFor(ownedItems: readonly OwnedItem[]): DerivedTrust {
    return deriveTrust(ownedItems, (ownedItemId) => this.isUnderReview(ownedItemId));
  },

  // ── Notifications ────────────────────────────────────────────────────
  async getNotifications(userId: string): Promise<Notification[]> {
    const mine = notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    return delay(mine, LATENCY_FETCH);
  },

  /** Drives the unread dot on the Home header (§13.4). */
  async getUnreadCount(userId: string): Promise<number> {
    return delay(
      notifications.filter((n) => n.userId === userId && !n.read).length,
      LATENCY_INSTANT,
    );
  },

  async markAllRead(userId: string): Promise<void> {
    for (const n of notifications) {
      if (n.userId === userId) n.read = true;
    }
    await delay(null, LATENCY_INSTANT);
  },
};

export type SocialService = typeof socialService;
