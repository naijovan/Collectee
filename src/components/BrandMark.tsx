/**
 * The Collectee mark — the stacked-cards glyph, top-left of a screen header.
 *
 * ── Why a component rather than an `<Image>` per header ───────────────────
 * It appears on every header in the app, and the two things that must not
 * drift are its SIZE and the gap between it and the words beside it. A shared
 * component makes both a single edit; inlining the image would make "the icon
 * is slightly bigger on Explore" a bug waiting to happen.
 *
 * ── It is decoration, not a control ──────────────────────────────────────
 * `accessibilityElementsHidden` and an empty `alt` on purpose. The mark carries
 * no information a screen reader user needs — the screen title right beside it
 * says where they are — and announcing "Collectee logo" before every single
 * heading is noise on every page of the app. It is also NOT a home button:
 * a logo that navigates is a convention from the web, and here the tab bar
 * already owns that job.
 *
 * The source is the transparent 1254px master. React Native picks the mip it
 * needs, and the file is small enough that a resized export per density would
 * be three more assets to keep in sync for no visible gain.
 */

import { Image, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

const MARK = require('../../assets/collectee/brand/collectee-mark.png');

/**
 * Default edge length — matched to `typography.screenTitle`'s LINE, not its
 * cap height.
 *
 * Every header that takes the default sets its title in `screenTitle`, which is
 * 34px on a 41px line. 40 makes the mark read as the same weight as the words
 * beside it, which is the point: the two are one lockup, and a mark noticeably
 * smaller than its wordmark looks like an afterthought pinned to the corner.
 *
 * The artwork does not fill its own square — the card stack is inset with a
 * glow around it — so the drawn glyph lands a little under 40 and sits level
 * with the cap height rather than towering over it.
 *
 * Headers with smaller titles pass `size` explicitly: the import flow's nav row
 * is `sectionHeader` (18/24) and takes 24, on the same reasoning.
 */
const DEFAULT_SIZE = 40;

export function BrandMark({
  size = DEFAULT_SIZE,
  style,
}: {
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <Image
        source={MARK}
        style={styles.image}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
        /* Decorative — see the header note above. */
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        alt=""
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /* Fixed box, so a header row's height never depends on how the artwork
     happens to letterbox inside it. */
  wrap: { alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
});
