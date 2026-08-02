/**
 * Feature flags — PRD §13.4 and the §14 descope ladder.
 *
 * The descope ladder is agreed IN ADVANCE so the call on the 6th is a choice,
 * not panic. Each rung below maps to a flag, so cutting scope is flipping a
 * boolean rather than deleting code the night before a deadline.
 *
 *   1. News flow (J5)            → FEATURES.news
 *   2. Room manual-adjust steps  → FEATURES.roomTwoAdjustSteps
 *   3. Communities posting       → FEATURES.communityPosting
 *   4. Scanner video input       → FEATURES.scanVideoInput
 *   5. Third game                → FEATURES.thirdTitle
 *
 * NEVER CUT: import → review → collection → room → share. That single chain is
 * the demo, and no flag here can disable it.
 */

export const FEATURES = {
  /**
   * §13.4 canonical Home variant is the one WITH the Gaming updates rail.
   * If J5 is cut, flip this and the rail disappears cleanly rather than
   * leaving a hole.
   */
  news: true,

  /** §11 F4: the Figma has two adjust steps; keep both unless descoping. */
  roomTwoAdjustSteps: true,

  /** §14 rung 3: join/view only when false. */
  communityPosting: true,

  /** §14 rung 4: screenshots only when false. */
  scanVideoInput: true,

  /** §14 rung 5: MLBB shown as "coming soon" when false. */
  thirdTitle: true,

  /**
   * §9.3 — trust UI is specified but NOT IN THE FIGMA. There is no verified
   * badge, no flag action, no review queue screen. Either two small design
   * additions land (a badge slot on ItemCard, a Flag entry in the item ⋮ menu
   * with a confirmation state) or the claim comes out of the pitch.
   * DECIDE BY 4 AUG. The logic is built either way — this flag controls whether
   * it is visible.
   */
  trustUi: true,

  /**
   * §12.1 — the one real model call under consideration: F6 article
   * summarisation behind a serverless function, ~2 hours. It is the only thing
   * that makes "there is a real model call in this build" a true statement.
   * DECIDE BY 5 AUG. False = seeded summaries, and the pitch says so plainly.
   */
  liveSummarisation: false,

  /** [ROADMAP] §11 F2 — Collection Insights. Build only if all four flows land early. */
  collectionInsights: false,

  /** [ROADMAP] §11 F4 — brightness slider and animated lighting. Not for the demo. */
  roomLightingControls: false,
} as const;

export type FeatureFlag = keyof typeof FEATURES;

/**
 * §16 Q8 — onboarding/signup screens do not exist in the Figma and have no
 * owner. Recommended answer, implemented here: the demo opens on a logged-in
 * state and auth is skipped entirely.
 */
export const SKIP_AUTH = true;
