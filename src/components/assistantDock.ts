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
 * What the assistant is called, in one place — the greeting pill and the panel
 * header both read it, so renaming is one edit rather than a search.
 *
 * ⚠️ NAMING RISK (§15). "Miya" is a shipped Mobile Legends hero, and this app
 * already uses that name for a Moonton character: `avatar-mlbb-miya` is in the
 * avatar roster and `mlbb-miya-modena-butterfly` is in the catalogue. Naming
 * OUR mascot the same thing makes one word mean two different things inside one
 * product, and reads as a publisher character fronting it. An original name
 * costs exactly this line. Flagged, not decided.
 */
export const ASSISTANT_NAME = 'Miya';
