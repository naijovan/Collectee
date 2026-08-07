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
 * Not used by detail screens (`/room/[id]`, `/collection/[id]`): those are
 * pushed routes with a stack header and their own scroll behaviour.
 */

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme/theme';

export function PinnedHeader({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
    /**
     * `surface`, not `background`. The content scrolling underneath sits on
     * `background`, so a header sharing that colour has only its 1px rule to
     * separate them and rows appear to slide out of nothing. A step up in
     * elevation is what makes the boundary read without a heavier border.
     */
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    /** Above the scroller, so nothing shows through during momentum. */
    zIndex: 10,
  },
});
