/**
 * The slim hero banner at the top of a News game tab.
 *
 * Sits ABOVE the digest card, not behind it. Behind would mean making the
 * digest translucent, and that card carries four lines of body text and is the
 * first-run walkthrough's measured target — neither survives a busy image
 * underneath.
 *
 * ── The height is fixed, on purpose ───────────────────────────────────────
 * `BANNER_HEIGHT` is a constant and the box is that tall whether the bitmap has
 * decoded, is still decoding, or does not exist at all. The tour spotlights the
 * digest below this, measuring it ~380ms after arrival with one re-measure at
 * 500ms. An image that resized this box after that would leave the cutout in
 * the wrong place — a self-sizing banner is the one version of this component
 * that breaks the walkthrough.
 *
 * ── The colour block is a state, not a hole ───────────────────────────────
 * Until the art lands (`config/newsBanners`), the banner draws the game's own
 * accent as a gradient. It is the same shape, the same height and the same
 * heading — the tab looks finished, just flatter.
 */

import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { newsBannerFor } from '@/config/newsBanners';
import {
  colors,
  gameAccents,
  letterSpacing,
  radius,
  scrim,
  spacing,
  typography,
} from '@/theme/theme';
import { GAME_LABELS } from '@/types';
import type { GameTitle } from '@/types';

/**
 * 3:1 — the source art's own aspect, so nothing is cropped.
 *
 * ── Why a ratio replaced the fixed 112 ────────────────────────────────────
 * The banner was 112pt tall at any width. Once the article cards below it
 * became full-width 3:2 images, a 112pt strip above them read as a rule rather
 * than a hero — which is the report this answers. On a desktop column that
 * strip was 688x112, a 6.1:1 box holding 3:1 art, so `cover` was also throwing
 * away about half the picture's height.
 *
 * The art is 1200x400. A 3:1 box shows all of it and crops nothing, in either
 * direction. Anything TALLER than 3:1 does not gain detail — there is none
 * below or above the frame — it starts cropping the SIDES instead, and the art
 * brief deliberately keeps the left side quiet for the heading, so trimming
 * width is the one crop that costs something.
 *
 * ── This does not break the walkthrough, and that was checked ─────────────
 * The note in `news.tsx` says the banner "cannot grow past ~112px" or the
 * digest crowds the fold on a 667-tall phone. That reasoning assumed a FIXED
 * height. A ratio is width-driven, and on a phone the column is narrow: at
 * 375pt the banner is 343x114, two points taller than before, so the fold
 * arithmetic is untouched. It is the desktop column that grows — 688x229 —
 * which is exactly where the banner looked undersized.
 *
 * The original reason the height was a constant also still holds: this box is
 * resolved at layout time from its own width, never from the bitmap, so a slow
 * or missing image cannot resize it under the tour's measured target.
 */
export const BANNER_ASPECT = 3;

export function NewsBanner({ title }: { title: GameTitle }) {
  const art = newsBannerFor(title);
  const accent = gameAccents[title];

  return (
    <View style={styles.banner}>
      {art ? (
        <Image
          source={art}
          style={styles.image}
          resizeMode="cover"
          accessible
          accessibilityLabel={`${GAME_LABELS[title]} news`}
          accessibilityIgnoresInvertColors
        />
      ) : (
        /* base → secondary on the diagonal. Deterministic per game, so the
           block a reviewer sees today is the block they saw yesterday. */
        <LinearGradient
          colors={[accent.base, accent.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.image}
        />
      )}

      {/* Bottom-up scrim so the heading holds on any artwork. The art brief
          asks for a quiet, low-value left side; this is what guarantees the
          text regardless of whether it arrives that way. */}
      <LinearGradient
        colors={[scrim.clear, scrim.heavy]}
        style={styles.scrim}
        pointerEvents="none"
      />

      {/* Drawn here rather than baked into the PNG — copy changes, art does
          not, and a renamed game would strand a title inside a bitmap. */}
      <Text style={styles.eyebrow} numberOfLines={1}>
        Latest in
      </Text>
      <Text style={styles.title} numberOfLines={1}>
        {GAME_LABELS[title]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    aspectRatio: BANNER_ASPECT,
    borderRadius: radius.card,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.surface,
  },
  /* Absolute rather than flex: the heading sits on top of it, and the box must
     keep its ratio whether or not the image has decoded. */
  image: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  eyebrow: {
    ...typography.meta,
    color: colors.textSecondary,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
  },
  /* Up from `sectionHeader`'s 18. The box more than doubled on a desktop
     column, and the old size read as a caption on it. 22 still clears the
     narrow case comfortably: at 375pt the banner is 114 tall and the eyebrow,
     title and padding come to ~76. */
  title: {
    ...typography.sectionHeader,
    fontSize: 22,
    lineHeight: 28,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
