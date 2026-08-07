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
 * ── Adding a banner is adding a file, then a line ─────────────────────────
 * In that order, and never the reverse. Metro resolves `require()` at BUILD
 * time, so a line pointing at a file that is not on disk is a build error — it
 * does not degrade to a fallback, it stops the bundler. This map shipped empty
 * for exactly as long as the art was outstanding; all three landed 7 Aug.
 *
 * The colour-block fallback in `NewsBanner` stays anyway. A fourth title could
 * be seeded and browsed before its banner is drawn, and the tab's layout is
 * identical either way.
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
  codm: require('../../assets/collectee/news/news-codm.png'),
  /* KEY AND FILENAME DIFFER, deliberately. The title is `valorant` but the
     agreed slot id — and therefore the filename — is `news-val`. This is the
     one line here that cannot be derived from the title, exactly like
     `comm-cross-game` in `communityArt`, and renaming either side to make them
     match would silently un-wire the banner. */
  valorant: require('../../assets/collectee/news/news-val.png'),
  mlbb: require('../../assets/collectee/news/news-mlbb.png'),
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
