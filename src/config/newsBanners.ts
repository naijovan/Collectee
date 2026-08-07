/**
 * News hero banners — the slim image at the top of each game tab.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  THIS IS THE SEAM FOR NEWS BANNER ART. Adding one is adding a file  │
 * │  and one line in `NEWS_BANNERS`. No component changes.              │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ── Layout on disk ────────────────────────────────────────────────────────
 *   assets/collectee/news/<slotId>.png    1200x400 (3:1), `cover`
 *
 * ── The slot id is NOT derivable from the GameTitle ───────────────────────
 * The titles are `codm` / `valorant` / `mlbb`, but the agreed slot names are
 * `news-codm` / `news-val` / `news-mlbb`. `news-${title}` would therefore give
 * `news-valorant`, which is not the filename. The map below is written out for
 * exactly that reason — the same deliberate mismatch `communityArt` carries for
 * `comm-cross-game`, and the same rule applies: the code must follow the agreed
 * name, not the convenient one.
 *
 * ── Why this map is EMPTY ─────────────────────────────────────────────────
 * Metro resolves `require()` at BUILD time. A line pointing at a file that is
 * not on disk is a build error, not a graceful fallback — it does not degrade,
 * it stops the bundler. So the requires land in the same commit as the art, not
 * before it. Until then every tab draws the colour block in `NewsBanner`, which
 * is a designed state rather than a hole.
 *
 * ── When the art lands, paste this in ─────────────────────────────────────
 * Drop the three PNGs in `assets/collectee/news/`, then replace the empty
 * object below with exactly this:
 *
 *   export const NEWS_BANNERS: Record<GameTitle, ImageSourcePropType | null> = {
 *     codm: require('../../assets/collectee/news/news-codm.png'),
 *     valorant: require('../../assets/collectee/news/news-val.png'),
 *     mlbb: require('../../assets/collectee/news/news-mlbb.png'),
 *   };
 *
 * Nothing else changes. The banner, the scrim and the heading already work.
 *
 * ── Art policy (PRD §15 IP row) ───────────────────────────────────────────
 * ORIGINAL prototype art. No publisher logos, no invented game marks, and NO
 * TEXT baked into the image — the screen draws the heading, and baked-in copy
 * would be wrong the moment the wording changes.
 */

import type { ImageSourcePropType } from 'react-native';

import type { GameTitle } from '@/types';

/**
 * Game title → bundled banner, or null while it is still a colour block.
 *
 * Typed `Record<GameTitle, …>` rather than a partial map so a fourth title
 * fails at compile time instead of silently rendering a block forever.
 */
export const NEWS_BANNERS: Record<GameTitle, ImageSourcePropType | null> = {
  codm: null,
  valorant: null,
  mlbb: null,
};

/** The agreed slot id for a title. Used by the art list and /diagnostics. */
export const NEWS_BANNER_SLOTS: Record<GameTitle, string> = {
  codm: 'news-codm',
  valorant: 'news-val',
  mlbb: 'news-mlbb',
};

/** The bundled banner for a game, or null when it has none yet. */
export function newsBannerFor(title: GameTitle): ImageSourcePropType | null {
  return NEWS_BANNERS[title] ?? null;
}

/** How many of the three have art. Surfaced in /diagnostics. */
export function newsBannerCoverage(): { covered: number; total: number } {
  const all = Object.keys(NEWS_BANNERS) as GameTitle[];
  return {
    covered: all.filter((title) => newsBannerFor(title) !== null).length,
    total: all.length,
  };
}
