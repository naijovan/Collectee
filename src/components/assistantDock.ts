/**
 * Assistant launcher geometry and identity, in one place.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 * `AssistantButton` imports `AssistantPanel`, so the panel cannot import back
 * from the button without a cycle. The panel needs two things the button owns:
 * how tall the launcher stack is, so it can sit above it, and what the
 * assistant is called, for its header.
 *
 * Before this, the height was simply duplicated — `LAUNCHER_CLEARANCE = 152` in
 * the panel with a comment reading "If the launcher moves, move this too". That
 * is a hand-maintained copy of a number, and the launcher has now moved. A leaf
 * module with no imports of its own breaks the cycle and deletes the copy.
 *
 * Everything here is derived from `BUBBLE` and `BUBBLE_BOTTOM`, so resizing the
 * launcher updates the screens that pad around it and the panel that sits above
 * it, without anyone remembering to.
 */

import { spacing } from '@/theme/theme';

/** Diameter of the launcher bubble. */
export const BUBBLE = 56;

/** Distance from the bottom edge. The tab bar owns everything below this. */
export const BUBBLE_BOTTOM = 92;

/**
 * Vertical space a scrolling screen must leave at its end so the last row is
 * not trapped under the launcher. Screens pad by this rather than each guessing
 * at a spacer — the collision it prevents is a CTA the user can see but cannot
 * tap.
 */
export const ASSISTANT_CLEARANCE = BUBBLE_BOTTOM + BUBBLE + spacing.md;

/**
 * Where the panel's bottom edge stops, so it sits above the launcher instead of
 * on it. A little more than the launcher's own footprint, so the two are not
 * flush.
 */
export const PANEL_CLEARANCE = ASSISTANT_CLEARANCE + spacing.sm;

/**
 * What the assistant is called, in one place — the greeting pill, the panel
 * header and the tour guide all read it, so renaming is one edit.
 *
 * Was "Miya" until 8 Aug, which was a shipped Mobile Legends hero name and one
 * this app already uses for a Moonton character (`avatar-mlbb-miya` in the
 * avatar roster, `mlbb-miya-modena-butterfly` in the catalogue). One word
 * meaning two different things in one product, with the second meaning being
 * someone else's IP (§15). "Colly" is ours.
 *
 * The rename is scoped to the PERSONA. The avatar roster still says Miya,
 * because that entry IS the Moonton hero, and the pose files are still called
 * `miya-tour-*.png` because they are internal wired paths.
 */
export const ASSISTANT_NAME = 'Colly';
