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
import { gameAccents, letterSpacing, radius, scrim, spacing, typography } from '@/theme/theme';
import { colors } from '@/theme/theme';
import { GAME_LABELS } from '@/types';
import type { GameTitle } from '@/types';

/**
 * Fixed, and read by the News screen's layout maths. 112 is tall enough to read
 * as art rather than a rule, and short enough that the digest below it stays
 * above the fold on a small phone — see the measurement note in `news.tsx`.
 */
export const BANNER_HEIGHT = 112;

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
    height: BANNER_HEIGHT,
    borderRadius: radius.card,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: colors.surface,
  },
  /* Absolute rather than flex: the heading sits on top of it, and the box must
     keep BANNER_HEIGHT whether or not the image has decoded. */
  image: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  eyebrow: {
    ...typography.meta,
    color: colors.textSecondary,
    letterSpacing: letterSpacing.wider,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.md,
  },
  title: {
    ...typography.sectionHeader,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
