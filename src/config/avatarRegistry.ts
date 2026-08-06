/**
 * The avatar roster — fifteen faces, five per launch title.
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
 * ── Why `AVATAR_ART` is empty right now ───────────────────────────────────
 * Metro resolves `require()` at BUILD time. A line pointing at a file that is
 * not on disk is a build error, not a runtime fallback — so the map cannot be
 * pre-filled ahead of the art landing. `components/item-art.ts` and
 * `components/backdrops.ts` ship the same way and for the same reason.
 *
 * Until an id is present here, `Avatar` draws initials over a hue derived from
 * the avatar id, so the roster is fully usable today: every user has a distinct,
 * stable face and the picker works. Art turns that from a colour into a
 * portrait with no other change.
 *
 * ── Art policy (PRD §15 IP row) ───────────────────────────────────────────
 * ORIGINAL prototype character art. These are ROLE-INSPIRED archetypes named
 * for recognisable roster slots so the demo reads as game-adjacent — they are
 * not publisher character art, must not be traced from it, and must never be
 * presented as official. Same rule §11 F4 applies to room themes: "Ancient
 * Dojo" yes, a named franchise no.
 */

import type { ImageSourcePropType } from 'react-native';

import type { GameTitle } from '@/types';

export interface AvatarOption {
  /** `avatar-<title>-<slug>`. Also the filename on disk. */
  id: string;
  /** What the picker prints under the face. */
  label: string;
  /** Which roster it belongs to. Drives the game-matched ordering in the picker. */
  title: GameTitle;
}

/**
 * Five per title. `val-` rather than `valorant-` deliberately: the catalogue
 * uses `val-*` for every Valorant id and `artRegistry` records renaming the art
 * packs to match, so a second convention here would be the one thing the audit
 * cannot see.
 */
export const AVATARS: readonly AvatarOption[] = [
  // ── Call of Duty: Mobile ───────────────────────────────────────
  { id: 'avatar-codm-ghost', label: 'Ghost', title: 'codm' },
  { id: 'avatar-codm-price', label: 'Price', title: 'codm' },
  { id: 'avatar-codm-soap', label: 'Soap', title: 'codm' },
  { id: 'avatar-codm-urban-tracker', label: 'Urban Tracker', title: 'codm' },
  { id: 'avatar-codm-scylla', label: 'Scylla', title: 'codm' },

  // ── VALORANT ───────────────────────────────────────────────────
  { id: 'avatar-val-jett', label: 'Jett', title: 'valorant' },
  { id: 'avatar-val-clove', label: 'Clove', title: 'valorant' },
  { id: 'avatar-val-reyna', label: 'Reyna', title: 'valorant' },
  { id: 'avatar-val-neon', label: 'Neon', title: 'valorant' },
  { id: 'avatar-val-sage', label: 'Sage', title: 'valorant' },

  // ── Mobile Legends: Bang Bang ──────────────────────────────────
  { id: 'avatar-mlbb-gusion', label: 'Gusion', title: 'mlbb' },
  { id: 'avatar-mlbb-ling', label: 'Ling', title: 'mlbb' },
  { id: 'avatar-mlbb-lancelot', label: 'Lancelot', title: 'mlbb' },
  { id: 'avatar-mlbb-fanny', label: 'Fanny', title: 'mlbb' },
  { id: 'avatar-mlbb-miya', label: 'Miya', title: 'mlbb' },
] as const;

const AVATARS_BY_ID = new Map(AVATARS.map((option) => [option.id, option]));

/**
 * Avatar id → bundled portrait.
 *
 * EMPTY UNTIL THE ART LANDS — see the header for why it cannot be pre-filled.
 * To wire a portrait up:
 *   1. Drop `assets/collectee/avatars/<avatarId>.png` (512x512).
 *   2. Add one line here, keyed by that exact id.
 *   3. Nothing else changes. Every avatar in the app picks it up at once.
 *
 * Example, once the file exists:
 *   'avatar-codm-ghost': require('../../assets/collectee/avatars/avatar-codm-ghost.png'),
 */
export const AVATAR_ART: Record<string, ImageSourcePropType> = {};

/** The bundled portrait for an avatar id, or null while it is still a colour. */
export function avatarArtFor(avatarId: string | null | undefined): ImageSourcePropType | null {
  if (!avatarId) return null;
  return AVATAR_ART[avatarId] ?? null;
}

/** Roster metadata for an id, or null if it is not one of the fifteen. */
export function avatarOption(avatarId: string | null | undefined): AvatarOption | null {
  if (!avatarId) return null;
  return AVATARS_BY_ID.get(avatarId) ?? null;
}

/**
 * The roster, with the games the viewer plays first.
 *
 * The first-run quiz asks which titles someone plays one step before it offers
 * a face, so opening on their own roster is the whole reason that ordering
 * exists. Every avatar stays browsable — this is a sort, never a filter, so no
 * answer to the quiz can hide ten of the fifteen.
 */
export function avatarsForGames(games: readonly GameTitle[]): AvatarOption[] {
  if (games.length === 0) return [...AVATARS];
  const preferred = new Set(games);
  return [...AVATARS].sort((a, b) => {
    const aMatch = preferred.has(a.title) ? 0 : 1;
    const bMatch = preferred.has(b.title) ? 0 : 1;
    return aMatch - bMatch;
  });
}

/** How many of the fifteen have art. Surfaced in /diagnostics. */
export function avatarArtCoverage(): { covered: number; total: number } {
  return {
    covered: AVATARS.filter((option) => avatarArtFor(option.id) !== null).length,
    total: AVATARS.length,
  };
}
