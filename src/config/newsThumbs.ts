/**
 * Generic per-game news thumbnails — the article-row image when an article has
 * no related item to borrow art from.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  THIS IS THE SEAM FOR GENERIC NEWS THUMBNAILS. Adding one is adding │
 * │  a file and one line in `NEWS_THUMBS`. No component changes.        │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ── Layout on disk ────────────────────────────────────────────────────────
 *   assets/collectee/news/<slotId>.png    512x512 (1:1), `cover`
 *
 * Square, because the slot is an 88x88 tile beside the headline. The banners in
 * `newsBanners` share this directory but are 3:1 — the `news-thumb-` prefix is
 * what keeps the two sets apart in a folder listing.
 *
 * ── Why a separate seam from the item art ─────────────────────────────────
 * Most articles borrow the render of an item they are about, which is better
 * than any generic image: a piece about the Elderflame Vandal shows the
 * Elderflame Vandal. These are for the articles that are about no single item —
 * the cross-game spend piece is the seeded example — where the honest picture
 * is "this is a story about MLBB", not a weapon it never mentions.
 *
 * For a multi-game article the FIRST tag wins. Arbitrary between equals, but
 * deterministic, and the tag chips beside it already show the full set.
 *
 * ── The slot ids are NOT derivable ────────────────────────────────────────
 * `news-thumb-val`, not `news-thumb-valorant` — the same agreed shorthand the
 * banners use, and the same reason this map is written out rather than built
 * from the title. See the comment on the valorant line.
 *
 * ── Adding art is a file, THEN a line ─────────────────────────────────────
 * In that order. Metro resolves `require()` at build time, so a line pointing
 * at a file that is not on disk is a build error, not a missing image. The map
 * ships null until the art lands; `ArticleThumb` draws the game's accent block
 * in the meantime, which is the same fallback the banner uses.
 *
 * ── Art policy (PRD §15 IP row) ───────────────────────────────────────────
 * ORIGINAL prototype art. No publisher logos, no invented game marks, no
 * recognisable characters, and no text baked into the image.
 */

import type { ImageSourcePropType } from 'react-native';

import type { GameTitle } from '@/types';

/**
 * Game title → generic thumbnail, or null while it is still a colour block.
 *
 * Typed `Record<GameTitle, …>` so a fourth title fails at compile time rather
 * than silently rendering a block forever.
 */
export const NEWS_THUMBS: Record<GameTitle, ImageSourcePropType | null> = {
  codm: null,
  /* KEY AND FILENAME WILL DIFFER, deliberately — `news-thumb-val.png`, matching
     the banner slot naming. Do not "fix" this to news-thumb-valorant. */
  valorant: null,
  mlbb: null,
};

/** The generic thumbnail for a game, or null when it has none yet. */
export function newsThumbFor(title: GameTitle): ImageSourcePropType | null {
  return NEWS_THUMBS[title] ?? null;
}

/** How many of the three have art. Surfaced in /diagnostics. */
export function newsThumbCoverage(): { covered: number; total: number } {
  const all = Object.keys(NEWS_THUMBS) as GameTitle[];
  return {
    covered: all.filter((title) => newsThumbFor(title) !== null).length,
    total: all.length,
  };
}
