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
 * Icons are unicode glyphs: §13.1 says nobody adds a dependency without saying
 * so in chat, and that includes an icon font.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';

interface Tab {
  href: '/' | '/explore' | '/collections' | '/profile';
  label: string;
  glyph: string;
  /** True for the two tabs behind the onboarding gate. */
  gated?: boolean;
}

const TABS: readonly Tab[] = [
  { href: '/', label: 'Home', glyph: '⌂' },
  { href: '/explore', label: 'Explore', glyph: '◎' },
  { href: '/collections', label: 'Collections', glyph: '▦', gated: true },
  { href: '/profile', label: 'Profile', glyph: '⏣', gated: true },
];

export function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { hasImported } = useApp();
  const insets = useSafeAreaInsets();

  const [left, right] = [TABS.slice(0, 2), TABS.slice(2)];

  function renderTab(tab: Tab) {
    const locked = tab.gated === true && !hasImported;
    const active = pathname === tab.href;

    return (
      <Pressable
        key={tab.href}
        disabled={locked}
        onPress={() => router.navigate(tab.href)}
        style={styles.tab}
      >
        <Text style={[styles.glyph, active && styles.active, locked && styles.locked]}>
          {tab.glyph}
        </Text>
        <Text style={[styles.label, active && styles.active, locked && styles.locked]}>
          {tab.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {left.map(renderTab)}

      <Pressable onPress={() => router.push('/create')} style={styles.plusSlot}>
        <View style={styles.plus}>
          <Text style={styles.plusText}>+</Text>
        </View>
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
  glyph: { fontSize: 20, color: colors.textTertiary, lineHeight: 24 },
  label: { ...typography.meta, fontSize: 10, color: colors.textTertiary },
  active: { color: colors.accent },
  /** §13.4 — greyed AND non-interactive, not just greyed. */
  locked: { color: colors.border },

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
  plusText: { color: colors.textOnAccent, fontSize: 26, lineHeight: 30, fontWeight: '600' },
});
