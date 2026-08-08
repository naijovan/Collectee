/**
 * The Collectee mark — the stacked-cards glyph, top-left of a screen header.
 *
 * ── Why a component rather than an `<Image>` per header ───────────────────
 * It appears on every header in the app, and the two things that must not
 * drift are its SIZE and the gap between it and the words beside it. A shared
 * component makes both a single edit; inlining the image would make "the icon
 * is slightly bigger on Explore" a bug waiting to happen.
 *
 * ── It IS a home button ──────────────────────────────────────────────────
 * This was decorative at first, on the reasoning that a clickable logo is a web
 * convention the tab bar already covers. That was overruled, and the reasoning
 * was thin anyway: people arrive at this app from the web, they try the logo,
 * and a mark that does nothing when tapped reads as broken rather than as
 * restrained.
 *
 * Being a control changes two things beyond the tap. It takes a real
 * accessibility role and label, so a screen reader announces it as the button
 * it now is — the earlier `accessibilityElementsHidden` would have made it a
 * control nobody could reach. And it takes `useHoverPop`, the same spring the
 * chips and pill CTAs use, so it responds to a pointer like everything else
 * that can be clicked.
 *
 * `navigate` rather than `push`: Home is a tab, and pushing would stack another
 * copy of it on top of wherever you were instead of returning to it.
 *
 * The source is the transparent 1254px master. React Native picks the mip it
 * needs, and the file is small enough that a resized export per density would
 * be three more assets to keep in sync for no visible gain.
 */

import { useRouter } from 'expo-router';
import { Animated, Image, Pressable, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import * as haptics from '@/lib/haptics';

import { useHoverPop } from './primitives';

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
  const router = useRouter();
  const pop = useHoverPop();

  return (
    <Animated.View style={[pop.popStyle, style]}>
      <Pressable
        {...pop.hoverProps}
        onPress={() => {
          haptics.tap();
          router.navigate('/');
        }}
        accessibilityRole="button"
        accessibilityLabel="Collectee — go to Home"
        /* The artwork is small; the tap target should not be. */
        hitSlop={8}
        style={({ pressed }) => [
          styles.wrap,
          { width: size, height: size },
          pressed && styles.pressed,
        ]}
      >
        <Image
          source={MARK}
          style={styles.image}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          /* The Pressable above carries the label — leaving one here too would
             have a screen reader announce the mark twice. */
          alt=""
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* Fixed box, so a header row's height never depends on how the artwork
     happens to letterbox inside it. */
  wrap: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.7 },
  image: { width: '100%', height: '100%' },
});
