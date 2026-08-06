/**
 * The avatar roster — fifteen faces, five per launch title.
 *
 * ── Why this is separate from `avatarRegistry` ────────────────────────────
 * PURE DATA, NO `require()`. That is the entire reason this file exists.
 * `avatarRegistry` requires PNGs, and only Metro can resolve those — importing
 * it from Node crashes on the first byte of the first image, which is exactly
 * how `validate-fixtures` broke the moment the art landed.
 * `scripts/audit-art.ts` dodges the same hazard by reading its registry as text
 * and regexing the keys out; a typed import beats a regex, so the data moved
 * instead of the reader getting cleverer.
 *
 * Anything that needs to know WHICH avatars exist imports this. Anything that
 * needs their bitmaps imports `avatarRegistry`, which re-exports everything
 * here so no call site has to know about the split.
 *
 * ── Art policy (PRD §15 IP row) ───────────────────────────────────────────
 * ORIGINAL prototype character art. ROLE-INSPIRED archetypes named for
 * recognisable roster slots so the demo reads as game-adjacent — not publisher
 * character art, never traced from it, never presented as official. The same
 * rule §11 F4 sets for room themes: "Ancient Dojo" yes, a named franchise no.
 */

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
