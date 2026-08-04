/**
 * Trust and verification — PRD §9.
 *
 * This is the model the pitch will be attacked on, and §8.2 names "safer and
 * more inclusive communities" as an explicit judging theme. It is a headline,
 * not a technical footnote.
 *
 * What we are NOT doing (§9.1): SHA-256 hashing of uploaded screenshots. A
 * cryptographic hash proves a file has not been altered; it says nothing about
 * who owns the item the file depicts. Any publicly available screenshot passes.
 * That approach was stress-tested and dropped.
 */

import type { Flag, FlagReason, OwnedItem, TrustLevel } from '@/types';

/**
 * §9.2 — `n ≥ 3` distinct flags from accounts with their own verified items.
 *
 * Both halves of that sentence matter. The threshold guard exists because an
 * unguarded flag button in a competitive community becomes a weapon, and the
 * verified-flagger requirement stops a throwaway-account brigade.
 */
export const FLAG_THRESHOLD = 3;

/**
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  A FLAG TARGETS AN `OwnedItem.id`, NEVER AN `Item.id`.              │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * A flag disputes *a specific person's ownership claim*, not a catalogue entry:
 * flagging "Prime Vandal" as a concept would be meaningless, and the same skin
 * is a legitimate claim for one collector and a disputed one for another. The
 * fixtures already document this (`src/fixtures/social.ts`) and every seeded
 * flag follows it.
 *
 * TODO(Bernard): `src/app/collection/[id].tsx` (currently line 103, inside
 * `raiseFlag`) passes `targetId: item.id`, a catalogue id, so those flags can
 * never match a target here and never reach the review queue at
 * `/moderation`. It needs the `OwnedItem.id` of the claim being disputed —
 * i.e. the collection owner's ownership record for that item, not the
 * catalogue entry. Until then the flag path works on seeded data only, and
 * every flag raised through the UI is silently inert.
 */
export const FLAG_TARGET_ID_SPACE = 'OwnedItem.id' as const;

/** The three ownership-dispute reasons from §9.2, separate from content moderation. */
export const OWNERSHIP_FLAG_REASONS: readonly FlagReason[] = [
  'false_ownership',
  'duplicate_uniqueness',
  'identity_impersonation',
] as const;

/** Content-moderation reasons from §11 F5 — harassment and spam, not ownership. */
export const CONTENT_FLAG_REASONS: readonly FlagReason[] = ['abusive_content', 'spam'] as const;

/**
 * ONE QUEUE, TWO THRESHOLDS (team decision, 4 Aug — provisional).
 *
 * §9.2's guard — three reports, all from accounts owning verified items — is
 * built for OWNERSHIP disputes, where an unguarded button in a competitive
 * community becomes a weapon and a throwaway-account brigade is the threat.
 *
 * Applying that same rule to harassment would mean a new account cannot report
 * abuse until it owns a verified item, and verification is partnership-gated
 * (§9.3) — so in practice, never. That would actively damage the "safer and more
 * inclusive communities" theme §8.2 names as a judging criterion, using a rule
 * written to protect something else entirely.
 *
 * So content reports need fewer reporters and no eligibility test. Both kinds
 * still land in the same review queue and still never auto-remove.
 */
export const CONTENT_REPORT_THRESHOLD = 2;

export function isOwnershipReason(reason: FlagReason): boolean {
  return OWNERSHIP_FLAG_REASONS.includes(reason);
}

/** Ownership disputes require a reporter with skin in the game; abuse reports do not. */
export function requiresEligibleReporter(reason: FlagReason): boolean {
  return isOwnershipReason(reason);
}

export function thresholdFor(reason: FlagReason): number {
  return isOwnershipReason(reason) ? FLAG_THRESHOLD : CONTENT_REPORT_THRESHOLD;
}

export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  false_ownership: 'False ownership',
  duplicate_uniqueness: 'Duplicate of a unique item',
  identity_impersonation: 'Identity impersonation',
  abusive_content: 'Abusive content',
  spam: 'Spam',
};

export const FLAG_REASON_DESCRIPTIONS: Record<FlagReason, string> = {
  false_ownership: 'A claimed item the flagger has reason to dispute',
  duplicate_uniqueness: 'A genuinely unique item claimed by more than one account',
  identity_impersonation: "Someone using another player's in-game name",
  abusive_content: 'Harassment, slurs or targeted abuse',
  spam: 'Repetitive or promotional content',
};

/** A user is an eligible flagger only if they own at least one verified item (§9.2). */
export function isEligibleFlagger(flaggerOwnedItems: readonly OwnedItem[]): boolean {
  return flaggerOwnedItems.some((i) => i.trustLevel === 'verified');
}

/**
 * Count flags that actually count toward the threshold: open or under review,
 * distinct reporters, each reporter eligible.
 */
export function countableFlags(
  flags: readonly Flag[],
  isReporterEligible: (reporterId: string) => boolean,
): number {
  const reporters = new Set<string>();
  for (const flag of flags) {
    if (flag.status !== 'open' && flag.status !== 'under_review') continue;
    if (!isReporterEligible(flag.reporterId)) continue;
    reporters.add(flag.reporterId);
  }
  return reporters.size;
}

/** Distinct reporters of content abuse. No eligibility test — see CONTENT_REPORT_THRESHOLD. */
export function countableContentReports(flags: readonly Flag[]): number {
  const reporters = new Set<string>();
  for (const flag of flags) {
    if (flag.status !== 'open' && flag.status !== 'under_review') continue;
    if (isOwnershipReason(flag.reason)) continue;
    reporters.add(flag.reporterId);
  }
  return reporters.size;
}

/** Both halves of the queue, evaluated independently against their own rule. */
export interface ReviewState {
  underReview: boolean;
  /** Set when a moderator upheld the reports — suppression outlives the count. */
  upheld: boolean;
  ownership: { countable: number; threshold: number; crossed: boolean };
  content: { countable: number; threshold: number; crossed: boolean };
}

export function reviewStateFor(
  flags: readonly Flag[],
  isReporterEligible: (reporterId: string) => boolean,
): ReviewState {
  const ownershipCount = countableFlags(flags, isReporterEligible);
  const contentCount = countableContentReports(flags);
  const ownershipCrossed = ownershipCount >= FLAG_THRESHOLD;
  const contentCrossed = contentCount >= CONTENT_REPORT_THRESHOLD;
  // An upheld decision keeps the target suppressed even though resolving the
  // flags drops the live count to zero. Without this, upholding a report would
  // hand the target its discovery ranking straight back.
  const upheld = flags.some((flag) => flag.status === 'upheld');

  return {
    underReview: upheld || ownershipCrossed || contentCrossed,
    upheld,
    ownership: { countable: ownershipCount, threshold: FLAG_THRESHOLD, crossed: ownershipCrossed },
    content: {
      countable: contentCount,
      threshold: CONTENT_REPORT_THRESHOLD,
      crossed: contentCrossed,
    },
  };
}

/**
 * Flags never auto-remove (§9.2). Crossing a threshold does two things:
 * the target loses discovery ranking, and it enters the review queue.
 */
export function isUnderReview(
  flags: readonly Flag[],
  isReporterEligible: (reporterId: string) => boolean,
): boolean {
  return reviewStateFor(flags, isReporterEligible).underReview;
}

/**
 * Discovery ranking multiplier — the concrete difference verification makes.
 *
 * §9.2: verified items rank higher in Explore and feed; unverified items are
 * allowed and fully usable but rank lower; flagged-past-threshold items lose
 * discovery ranking entirely.
 */
export function discoveryWeight(trustLevel: TrustLevel, underReview: boolean): number {
  if (underReview) return 0;
  return trustLevel === 'verified' ? 1 : 0.6;
}

/**
 * Trust for a SET of owned items — a collection, a room, a profile section.
 *
 * Derived, never stored. §12.3 gives `Collection` no trust field and it should
 * not get one: a stored flag would drift the moment an item in the collection
 * was flagged or an account was linked, and there is no way to notice. Deriving
 * it means the answer is always current by construction.
 *
 * `verified` only when EVERY item is verified — a collection is not "verified"
 * because most of it is, and claiming otherwise is the kind of overstatement
 * §9.2's whole trust model exists to avoid.
 */
export interface DerivedTrust {
  trustLevel: TrustLevel;
  /** True when any item in the set has crossed `FLAG_THRESHOLD`. */
  underReview: boolean;
  verifiedCount: number;
  totalCount: number;
}

export function deriveTrust(
  ownedItems: readonly OwnedItem[],
  isTargetUnderReview: (ownedItemId: string) => boolean,
): DerivedTrust {
  const verifiedCount = ownedItems.filter((o) => o.trustLevel === 'verified').length;
  return {
    trustLevel:
      ownedItems.length > 0 && verifiedCount === ownedItems.length ? 'verified' : 'unverified',
    underReview: ownedItems.some((o) => isTargetUnderReview(o.id)),
    verifiedCount,
    totalCount: ownedItems.length,
  };
}

/**
 * Ordering for SETS — collections, rooms, profile sections.
 *
 * Under-review sets are demoted, not removed. §9.2 takes discovery ranking away
 * from the disputed *item*; making an entire collection disappear because one of
 * its four items is disputed punishes far more than the claim in question, and
 * flags explicitly "do not auto-remove". `rankByTrust` below is the stricter
 * item-level rule and still drops them outright.
 */
export function compareByDerivedTrust(a: DerivedTrust, b: DerivedTrust): number {
  if (a.underReview !== b.underReview) return a.underReview ? 1 : -1;
  return discoveryWeight(b.trustLevel, false) - discoveryWeight(a.trustLevel, false);
}

/**
 * Rank a list by trust, preserving the caller's ordering within a trust band.
 * Used by Explore and the Home feed.
 */
export function rankByTrust<T>(
  entries: readonly T[],
  getTrust: (entry: T) => { trustLevel: TrustLevel; underReview: boolean },
): T[] {
  return entries
    .map((entry, index) => ({ entry, index, ...getTrust(entry) }))
    .map((e) => ({ ...e, weight: discoveryWeight(e.trustLevel, e.underReview) }))
    .filter((e) => e.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map((e) => e.entry);
}
