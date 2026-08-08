/**
 * The sticky header every main tab wears.
 *
 * One component rather than three copies, because three copies is exactly how
 * they drifted: Home was pinned on `surface` with 16px of bottom padding,
 * Collections was pinned on `background` with 8px and a gap, and Explore was
 * not pinned at all. Nothing chose those differences — they accumulated.
 *
 * ── Why the tabs share one ────────────────────────────────────────────────
 * Home, Explore and Collections are siblings in a tab bar. A user moves between
 * them constantly, and a header that changes height, colour or stickiness on
 * each one reads as three apps rather than three views of one. It is also the
 * surface that owns the top safe-area inset, which is a thing worth doing in a
 * single place.
 *
 * ── The backdrop fades in on scroll ───────────────────────────────────────
 * Ported from careerlingo's `.top-bar` / `.top-bar.scrolled::before`, which is
 * the reference Jovan asked for. At the top of a page the header is
 * transparent and its controls float over the content; once the page moves, a
 * frosted panel fades in behind them over 260ms.
 *
 * The reason it is worth the wiring: a permanent opaque bar spends a strip of
 * every screen on chrome even when there is nothing underneath to separate
 * from. Fading it in means the first thing a user sees is content, and the
 * divider only appears at the moment it starts doing a job.
 *
 * Screens drive it by passing `scrolled` — see `useScrolledPast`.
 *
 * Not used by detail screens (`/room/[id]`, `/collection/[id]`): those are
 * pushed routes with a stack header and their own scroll behaviour.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, ViewStyle } from 'react-native';
import { useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { colors, headerGlass, motion, spacing } from '@/theme/theme';

/**
 * How far the page must move before the backdrop appears.
 *
 * Not zero: a one-pixel scroll, or the bounce at the top of an iOS list, should
 * not flash the panel on and off. 12 is past both and still feels immediate.
 */
const SCROLL_THRESHOLD = 12;

/**
 * Wire a ScrollView to the header's backdrop.
 *
 * Returns the props to spread onto the scroller and the flag to hand
 * `PinnedHeader`. A hook rather than three copies of the same six lines, and it
 * keeps the threshold in one place.
 *
 * `scrollEventThrottle: 16` is one event per frame — enough for a boolean that
 * only flips once, and low enough not to spam the JS bridge on native.
 */
export function useScrolledPast() {
  const [scrolled, setScrolled] = useState(false);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = event.nativeEvent.contentOffset.y > SCROLL_THRESHOLD;
    /* Set only on a change. Assigning the same boolean every frame would
       re-render the whole screen sixty times a second while scrolling. */
    setScrolled((current) => (current === past ? current : past));
  }, []);

  return { scrolled, scrollProps: { onScroll, scrollEventThrottle: 16 } };
}

export function PinnedHeader({
  children,
  scrolled = true,
}: {
  children: ReactNode;
  /**
   * Whether the page has moved. Defaults TRUE so a screen that has not adopted
   * `useScrolledPast` keeps the solid header it has always had rather than
   * silently losing its divider.
   */
  scrolled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const opacity = useRef(new Animated.Value(scrolled ? 1 : 0)).current;

  useEffect(() => {
    const to = scrolled ? 1 : 0;
    if (reduceMotion) {
      opacity.setValue(to);
      return;
    }
    Animated.timing(opacity, {
      toValue: to,
      duration: motion.base,
      /* Opacity is the one property the native driver handles everywhere, and
         this runs on every scroll past the threshold. */
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [scrolled, reduceMotion, opacity]);

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      {/*
        The backdrop is a sibling behind the content, not a background ON the
        header — a background colour cannot be animated by the native driver,
        and the whole point is that this fades rather than snaps.
      */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.backdrop,
          { opacity },
          Platform.OS === 'web'
            ? ({ backdropFilter: headerGlass.blur } as unknown as ViewStyle)
            : null,
        ]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
    /** Above the scroller, so nothing shows through during momentum. */
    zIndex: 10,
  },
  /**
   * Frosted, not solid.
   *
   * `surface` at 78% with a blur behind it — careerlingo's `--glass` and its
   * `backdrop-filter: blur(18px) saturate(1.2)`. Slightly more opaque than the
   * tab bar's 72% because text sits directly on this one and has to stay
   * legible over whatever scrolls underneath.
   */
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: headerGlass.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
