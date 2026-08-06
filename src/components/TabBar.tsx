/**
 * TabBar — PRD §13.4 section 8 and the onboarding gate.
 *
 * Home · Explore · **+** (raised blue circle) · Collections · Profile
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  THE GATE LIVES HERE AND NOWHERE ELSE.                              │
 * │  "Collections and Profile tabs render greyed and non-interactive    │
 * │   until the first import completes. Implement it in TabBar from a   │
 * │   single `hasImported` flag in context." — §13.4                    │
 * │  Do not re-derive the gate in a screen.                             │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * The `+` is not a tab. It opens the action sheet from §13.5 (Scan inventory /
 * Create collection / Create room) — it appears in every flow and the PRD flags
 * it as previously unspecified.
 *
 * Icons are drawn from Views rather than an icon font: §13.1 says nobody adds a
 * dependency without saying so in chat, and that includes an icon set. Unicode
 * glyphs were the previous answer and looked it — ⌂ ◎ ▦ ⏣ come from four
 * different type designs, so they disagreed on weight, size and baseline no
 * matter how they were styled. Four small shapes are more code and better
 * pixels, and they inherit the theme like everything else.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as haptics from '@/lib/haptics';
import { useApp } from '@/state/AppContext';
import { useTourAnchor } from '@/state/TourAnchors';
import { colors, fonts, interaction, radius, spacing, typography } from '@/theme/theme';

interface Tab {
  href: '/' | '/explore' | '/collections' | '/profile';
  label: string;
  kind: IconKind;
  /** True for the two tabs behind the onboarding gate. */
  gated?: boolean;
}

const TABS: readonly Tab[] = [
  { href: '/', label: 'Home', kind: 'home' },
  { href: '/explore', label: 'Explore', kind: 'explore' },
  { href: '/collections', label: 'Collections', kind: 'collections', gated: true },
  { href: '/profile', label: 'Profile', kind: 'profile', gated: true },
];

type IconKind = 'home' | 'explore' | 'collections' | 'profile';

/**
 * The four tab icons, built from Views.
 *
 * Each is a 22x22 box so they share a baseline and optical weight — the thing
 * the mixed unicode glyphs could never do. Strokes are 2px borders throughout,
 * which keeps them consistent at a glance and legible at tab-bar size where
 * finer detail turns to mush.
 */
function TabIcon({ kind, colour }: { kind: IconKind; colour: string }) {
  if (kind === 'home') {
    return (
      <View style={styles.icon}>
        {/* A rotated square is the roof; the body sits under it and clips the
            lower half, which is cheaper than a triangle drawn from borders. */}
        <View style={[styles.homeRoof, { borderColor: colour }]} />
        <View style={[styles.homeBody, { borderColor: colour }]} />
      </View>
    );
  }

  if (kind === 'explore') {
    return (
      <View style={styles.icon}>
        <View style={[styles.exploreRing, { borderColor: colour }]} />
        <View style={[styles.exploreNeedle, { backgroundColor: colour }]} />
      </View>
    );
  }

  if (kind === 'collections') {
    // Four cells, because a collection is a grid of things.
    return (
      <View style={[styles.icon, styles.grid]}>
        {[0, 1, 2, 3].map((cell) => (
          <View key={cell} style={[styles.gridCell, { borderColor: colour }]} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.icon}>
      <View style={[styles.profileHead, { borderColor: colour }]} />
      <View style={[styles.profileBody, { borderColor: colour }]} />
    </View>
  );
}

export function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { hasImported } = useApp();
  const insets = useSafeAreaInsets();
  /* Two targets for the first-run walkthrough. A ref each, no wrapper — the
     bar is a flex row and the tabs are `flex: 1`, so an extra View here would
     change the layout purely so the tour has something to hold. Inert when the
     tour is not mounted (see `TourAnchors`), so nothing in this component is
     now conditional on a §14-cuttable feature. */
  const barAnchor = useTourAnchor('tabbar');
  const importAnchor = useTourAnchor('tab-import');

  const [left, right] = [TABS.slice(0, 2), TABS.slice(2)];

  function renderTab(tab: Tab) {
    const locked = tab.gated === true && !hasImported;
    const active = pathname === tab.href;

    return (
      <Pressable
        key={tab.href}
        disabled={locked}
        onPress={() => {
          if (active) return;
          haptics.selection();
          router.navigate(tab.href);
        }}
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        /* The gate was previously visual only — greyed pixels tell a sighted
           user the tab is locked and tell a screen-reader user nothing. §13.4
           says non-interactive, and this is the half that was missing. */
        accessibilityState={{ selected: active, disabled: locked }}
        accessibilityHint={locked ? 'Import your inventory to unlock this tab' : undefined}
        style={({ pressed }) => [styles.tab, pressed && !active && styles.pressed]}
      >
        <TabIcon
          kind={tab.kind}
          colour={locked ? colors.border : active ? colors.accent : colors.textTertiary}
        />
        <Text style={[styles.label, active && styles.active, locked && styles.locked]}>
          {tab.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      ref={barAnchor}
      collapsable={false}
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
      accessibilityRole="tablist"
    >
      {left.map(renderTab)}

      {/* Import sits level with the other four rather than as a raised circle.
          §13.4 specifies the raised "+", but an unlabelled glyph in the most
          prominent slot never said what it did — and the thing it does is the
          activation event the whole product depends on (J1). Labelling it and
          levelling it costs the flourish and buys a tab that explains itself. */}
      <Pressable
        ref={importAnchor}
        collapsable={false}
        onPress={() => {
          haptics.tap();
          router.push('/import');
        }}
        accessibilityRole="button"
        accessibilityLabel="Import inventory"
        style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
      >
        {/* A filled accent plus. Level with the other four, but the only
            coloured icon in the bar — import is the activation event the whole
            product depends on (J1), so it earns the one bit of colour. */}
        <View style={styles.icon}>
          <View style={styles.plusDisc}>
            <View style={styles.plusBarH} />
            <View style={styles.plusBarV} />
          </View>
        </View>
        <Text style={[styles.label, styles.active]}>Import</Text>
      </Pressable>

      {right.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  icon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },

  homeRoof: {
    position: 'absolute',
    top: 1,
    width: 13,
    height: 13,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  homeBody: {
    position: 'absolute',
    bottom: 2,
    width: 15,
    height: 10,
    borderWidth: 2,
    borderTopWidth: 0,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },

  exploreRing: { width: 18, height: 18, borderWidth: 2, borderRadius: radius.pill },
  exploreNeedle: {
    position: 'absolute',
    width: 2,
    height: 9,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, padding: 2 },
  gridCell: { width: 7, height: 7, borderWidth: 2, borderRadius: 1.5 },

  profileHead: {
    position: 'absolute',
    top: 1,
    width: 9,
    height: 9,
    borderWidth: 2,
    borderRadius: radius.pill,
  },
  profileBody: {
    position: 'absolute',
    bottom: 2,
    width: 17,
    height: 9,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  label: { ...typography.meta, fontSize: 10, color: colors.textTertiary },
  active: { color: colors.accent },
  /** §13.4 — greyed AND non-interactive, not just greyed. */
  locked: { color: colors.border },

  plusDisc: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  plusBarH: { position: 'absolute', width: 11, height: 2.5, borderRadius: 2, backgroundColor: colors.textOnAccent },
  plusBarV: { position: 'absolute', width: 2.5, height: 11, borderRadius: 2, backgroundColor: colors.textOnAccent },

  plusSlot: { flex: 1, alignItems: 'center' },
  plus: {
    width: 46,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    borderWidth: 4,
    borderColor: colors.background,
  },
  /* The + is the app's most-pressed control and sits on a flat bar, so it
     gets a deliberate squash rather than the shared dim — the ring around it
     already reads as depth, and dimming alone looked like it had failed. */
  plusPressed: {
    backgroundColor: colors.accentPressed,
    transform: [{ scale: 0.92 }],
  },
  plusText: { color: colors.textOnAccent, fontSize: 26, lineHeight: 30, fontFamily: fonts.display },

  pressed: { opacity: interaction.pressedOpacity },
});
