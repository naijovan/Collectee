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
   * §12.1 — the real model call. DECIDED 6 AUG: it ships.
   *
   * Article summaries AND the per-game news digests, both through the deployed
   * `/api/assistant` proxy. "There is a real model call in this build" is now a
   * true statement, which was the whole point of building it.
   *
   * Turning this off is still the safe move if anything goes wrong on the day:
   * every surface falls back to seeded copy with an honest label, which is what
   * it did for the first five days of this flag's life.
   */
  liveSummarisation: true,

  /**
   * §12.1 — the in-app assistant's model path, on the same proxy as
   * `liveSummarisation` and the same key.
   *
   * DECIDED 6 AUG: it ships, alongside `liveSummarisation`.
   *
   * FALSE REMAINS A COMPLETE FEATURE, not a disabled one — which is why turning
   * it off is a safe response to trouble rather than a retreat. The assistant
   * answers from `domain/assistant` either way, and most questions about your
   * own account are arithmetic over data already in memory: 25 of 27 test
   * questions never touch a model. This flag only decides whether the questions
   * the snapshot cannot answer get phrased by a model or answered with an
   * honest "I don't have that".
   *
   * Nothing AI-powered ships unflagged, and the reply says which path answered.
   */
  assistantChat: true,

  /** [ROADMAP] §11 F2 — Collection Insights. Build only if all four flows land early. */
  collectionInsights: false,

  /**
   * §11 F4 lists the brightness slider and animated-lighting toggle as
   * [ROADMAP] and tells us to build to the spec rather than the richer Figma
   * frames. **The team overrode that on 3 Aug** and took lighting into demo
   * scope.
   *
   * It stays a flag rather than becoming unconditional, which is the whole
   * point of §14: if the 5 Aug checkpoint gets tight, lighting is the honest
   * first cut on this flow and switching it off here degrades the Customise tab
   * cleanly instead of breaking a screen.
   */
  roomLightingControls: true,
} as const;

export type FeatureFlag = keyof typeof FEATURES;

/**
 * The clock the News feed ranks against — PRD §11 F6.
 *
 * `domain/news.rankFyp` takes `now` as a parameter precisely so ranking is
 * deterministic, and then the screen handed it `Date.now()`, which threw that
 * away: recency decays over a fortnight, so the same feed drifts and eventually
 * reorders between a rehearsal and the live run. Fixtures already use absolute
 * dates "so nothing drifts at demo time" (§12.3) — this is the same decision
 * applied to the clock reading them.
 *
 * Set to the morning of the submission deadline, which keeps every seeded
 * article inside the recency window without making any of them look stale.
 *
 * Phase 2 deletes this and passes the real clock; nothing else changes, because
 * `now` was always an argument.
 */
export const DEMO_NOW = Date.parse('2026-08-09T09:00:00.000Z');

/**
 * §16 Q8 — onboarding/signup screens do not exist in the Figma and have no
 * owner. Recommended answer, implemented here: the demo opens on a logged-in
 * state and auth is skipped entirely.
 */
export const SKIP_AUTH = true;
