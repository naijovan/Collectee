/**
 * Colly's tour poses — the guide who walks the first run.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  THIS IS THE SEAM FOR TOUR GUIDE ART. Adding a pose is adding a     │
 * │  file and one line below. No component changes.                     │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ── Layout on disk ────────────────────────────────────────────────────────
 *   assets/collectee/assistant/miya-tour-<pose>.png   768x1024 (3:4), `contain`
 *
 * ── Three poses, one of them mirrored ─────────────────────────────────────
 * `pointing` is drawn ONCE, gesturing toward the character's own left. When the
 * guide stands to the right of a highlighted region she is flipped in code with
 * `scaleX: -1`, so one file covers both directions.
 *
 * That works because the brief forbids baked text and asymmetric readable
 * detail on the costume — a mirrored image with a logo or a handed prop in it
 * reads as a mistake. If a later pose needs asymmetry, it needs a second file,
 * not a flip.
 *
 * ── Adding art is a file, THEN a line ─────────────────────────────────────
 * In that order. Metro resolves `require()` at build time, so a line pointing
 * at a file that is not on disk is a build error, not a missing image.
 *
 * ── The flag is what actually gates this ──────────────────────────────────
 * `FEATURES.tourGuideColly` gates this. With it off the
 * walkthrough renders exactly as it does today — the guide is additive, not a
 * rewrite of the tour. `guidePosesReady()` exists so the flag cannot be flipped
 * on against a half-delivered pack: the overlay checks it and falls back.
 *
 * ── Art policy (PRD §15 IP row) ───────────────────────────────────────────
 * ORIGINAL character art. Not a publisher character and not a lookalike — see
 * the naming note on `ASSISTANT_NAME` in `components/assistantDock`.
 */

import type { ImageSourcePropType } from 'react-native';

/** Which pose a stop asks for. */
export type GuidePose = 'talking' | 'pointing' | 'happy';

/**
 * Pose → bundled art, or null while it has not landed.
 *
 * All three landed 8 Aug at 768x1024 RGBA. The filenames keep the `miya-`
 * prefix even though the persona is now called Colly — they are internal wired
 * paths, and renaming a bundled asset buys nothing but a chance to break the
 * require.
 */
export const GUIDE_POSES: Record<GuidePose, ImageSourcePropType | null> = {
  talking: require('../../assets/collectee/assistant/miya-tour-talking.png'),
  pointing: require('../../assets/collectee/assistant/miya-tour-pointing.png'),
  happy: require('../../assets/collectee/assistant/miya-tour-happy.png'),
};

/** The art for a pose, or null when it has not landed. */
export function guidePose(pose: GuidePose): ImageSourcePropType | null {
  return GUIDE_POSES[pose] ?? null;
}

/**
 * Are ALL three poses present?
 *
 * The guided tour is all-or-nothing on purpose. A run that shows a character
 * for two stops and a blank space for the third is worse than the card tour it
 * replaced, so the overlay checks this and stays on the card path until the
 * pack is complete.
 */
export function guidePosesReady(): boolean {
  return (Object.keys(GUIDE_POSES) as GuidePose[]).every((p) => guidePose(p) !== null);
}

/** How many poses have landed. Surfaced in /diagnostics. */
export function guidePoseCoverage(): { covered: number; total: number } {
  const all = Object.keys(GUIDE_POSES) as GuidePose[];
  return { covered: all.filter((p) => guidePose(p) !== null).length, total: all.length };
}
