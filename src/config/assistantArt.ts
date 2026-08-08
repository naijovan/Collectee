/**
 * The assistant mascot — the face in the floating launcher and the panel header.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  THIS IS THE SEAM FOR MASCOT ART. Adding it is adding a file and    │
 * │  one line below. No component changes.                              │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ── Layout on disk ────────────────────────────────────────────────────────
 *   assets/collectee/assistant/assistant-mascot.png   512x512 (1:1), `cover`
 *
 * Square, because both call sites crop it to a circle — 56pt in the launcher
 * bubble and 28pt in the panel header. 512 is the same size the avatar roster
 * uses and leaves headroom well past @3x on the larger of the two.
 *
 * ── Adding art is a file, THEN a line ─────────────────────────────────────
 * In that order. Metro resolves `require()` at build time, so a line pointing
 * at a file that is not on disk is a build error, not a missing image. This map
 * ships null until the art lands.
 *
 * ── The fallback is the current launcher, unchanged ───────────────────────
 * With no mascot, `AssistantButton` draws the sparkle glyph it has always
 * drawn, in the same accent circle. The greeting pill and the wiggle work
 * either way — they are not waiting on art. That means this branch is
 * reviewable before the mascot exists, and the mascot drops in without
 * touching a component.
 *
 * ── Art policy (PRD §15 IP row) ───────────────────────────────────────────
 * ORIGINAL character art. Not a publisher mascot, not a recognisable game
 * character, and not a lookalike of one. See the note on `ASSISTANT_NAME` in
 * `components/AssistantButton` about the naming risk.
 */

import type { ImageSourcePropType } from 'react-native';

/**
 * The mascot bitmap, or null while the launcher is still a sparkle.
 *
 * When the art lands, replace null with exactly:
 *   require('../../assets/collectee/assistant/assistant-mascot.png')
 */
export const ASSISTANT_MASCOT: ImageSourcePropType | null = null;

/** The mascot image, or null when it has not landed. */
export function assistantMascot(): ImageSourcePropType | null {
  return ASSISTANT_MASCOT;
}

/** Whether the mascot art is present. Surfaced in /diagnostics. */
export function assistantMascotCoverage(): { covered: number; total: number } {
  return { covered: ASSISTANT_MASCOT === null ? 0 : 1, total: 1 };
}
