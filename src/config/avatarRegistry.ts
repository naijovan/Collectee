/**
 * Avatar portraits — the bundled bitmap for each roster face.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  THIS IS THE SEAM FOR AVATAR ART. Adding a portrait is adding a     │
 * │  file and one line in `AVATAR_ART`. No component changes.           │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ── Layout on disk ────────────────────────────────────────────────────────
 *   assets/collectee/avatars/<avatarId>.png    512x512, square, `cover`
 *
 * **The filename IS the id**, the same rule `config/artRegistry` runs on, which
 * is what keeps this map generatable and auditable as a set comparison rather
 * than a judgement call.
 *
 * ── This file cannot be imported from Node ────────────────────────────────
 * It `require()`s PNGs, and only Metro resolves those. A script that imports it
 * crashes on the first byte of the first image — which is what happened to
 * `validate-fixtures` the moment the art landed. The roster itself therefore
 * lives in `avatarRoster.ts`, which is pure data, and everything there is
 * re-exported below so no call site has to know about the split.
 *
 * ── The fallback stays ────────────────────────────────────────────────────
 * All fifteen have portraits now. `Avatar`'s initials-over-a-hue path is kept
 * anyway: Metro resolves `require()` at BUILD time, so an id added here before
 * its file exists is a build error rather than a graceful degrade, and the
 * fallback is what lets a sixteenth face be declared and picked before its
 * portrait is drawn.
 *
 * ── Art policy (PRD §15 IP row) ───────────────────────────────────────────
 * ORIGINAL prototype character art. Role-inspired archetypes, not publisher
 * character art, and never presented as such. See `avatarRoster.ts`.
 */

import type { ImageSourcePropType } from 'react-native';

import { AVATARS } from './avatarRoster';

/* Re-exported so nothing has to know the roster moved out. The split exists
   only because this file requires PNGs — see the header. */
export type { AvatarOption } from './avatarRoster';
export { AVATARS, avatarOption, avatarsForGames } from './avatarRoster';

/**
 * Avatar id → bundled portrait.
 *
 * All fifteen landed 7 Aug at 512x512. To add a sixteenth:
 *   1. Drop `assets/collectee/avatars/<avatarId>.png` (512x512).
 *   2. Add it to `AVATARS` in `avatarRoster.ts`, and one line here keyed by
 *      that exact id.
 *   3. Nothing else changes. Every avatar in the app picks it up at once.
 */
export const AVATAR_ART: Record<string, ImageSourcePropType> = {
  // ── Call of Duty: Mobile ───────────────────────────────────────
  'avatar-codm-ghost': require('../../assets/collectee/avatars/avatar-codm-ghost.png'),
  'avatar-codm-price': require('../../assets/collectee/avatars/avatar-codm-price.png'),
  'avatar-codm-soap': require('../../assets/collectee/avatars/avatar-codm-soap.png'),
  'avatar-codm-urban-tracker': require('../../assets/collectee/avatars/avatar-codm-urban-tracker.png'),
  'avatar-codm-scylla': require('../../assets/collectee/avatars/avatar-codm-scylla.png'),

  // ── VALORANT ───────────────────────────────────────────────────
  'avatar-val-jett': require('../../assets/collectee/avatars/avatar-val-jett.png'),
  'avatar-val-clove': require('../../assets/collectee/avatars/avatar-val-clove.png'),
  'avatar-val-reyna': require('../../assets/collectee/avatars/avatar-val-reyna.png'),
  'avatar-val-neon': require('../../assets/collectee/avatars/avatar-val-neon.png'),
  'avatar-val-sage': require('../../assets/collectee/avatars/avatar-val-sage.png'),

  // ── Mobile Legends: Bang Bang ──────────────────────────────────
  'avatar-mlbb-gusion': require('../../assets/collectee/avatars/avatar-mlbb-gusion.png'),
  'avatar-mlbb-ling': require('../../assets/collectee/avatars/avatar-mlbb-ling.png'),
  'avatar-mlbb-lancelot': require('../../assets/collectee/avatars/avatar-mlbb-lancelot.png'),
  'avatar-mlbb-fanny': require('../../assets/collectee/avatars/avatar-mlbb-fanny.png'),
  'avatar-mlbb-miya': require('../../assets/collectee/avatars/avatar-mlbb-miya.png'),
};

/** The bundled portrait for an avatar id, or null when it has none. */
export function avatarArtFor(avatarId: string | null | undefined): ImageSourcePropType | null {
  if (!avatarId) return null;
  return AVATAR_ART[avatarId] ?? null;
}

/** How many of the fifteen have art. Surfaced in /diagnostics. */
export function avatarArtCoverage(): { covered: number; total: number } {
  return {
    covered: AVATARS.filter((option) => avatarArtFor(option.id) !== null).length,
    total: AVATARS.length,
  };
}
