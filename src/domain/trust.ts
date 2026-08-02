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

/** The three ownership-dispute reasons from §9.2, separate from content moderation. */
export const OWNERSHIP_FLAG_REASONS: readonly FlagReason[] = [
  'false_ownership',
  'duplicate_uniqueness',
  'identity_impersonation',
] as const;

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

/**
 * Flags never auto-remove (§9.2). Crossing the threshold does two things:
 * the item loses discovery ranking, and it enters the review queue.
 */
export function isUnderReview(
  flags: readonly Flag[],
  isReporterEligible: (reporterId: string) => boolean,
): boolean {
  return countableFlags(flags, isReporterEligible) >= FLAG_THRESHOLD;
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
