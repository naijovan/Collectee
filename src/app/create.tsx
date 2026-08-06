/**
 * The `+` action sheet — PRD §13.5.
 *
 * "A `+` tab action sheet (Scan inventory / Create collection / Create room) —
 *  it appears in every flow and is currently unspecified."
 *
 * Specified here, once: three entries, each the head of a journey from §10.
 * Create collection and Create room need items, so before the first import they
 * route to the scanner rather than into an empty flow — the same activation
 * logic as the §13.4 tab gate, read from the same `hasImported` flag.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { FEATURES } from '@/config/features';
import { useApp } from '@/state/AppContext';
import { colors, radius, scrim, spacing, typography } from '@/theme/theme';

interface Action {
  label: string;
  detail: string;
  glyph: string;
  href: '/import' | '/collection/new' | '/room/new';
  /** Needs items to exist first. */
  needsInventory?: boolean;
}

const ACTIONS: readonly Action[] = [
  {
    label: 'Scan inventory',
    detail: 'Upload a screenshot or recording — AI reads your items (J1)',
    glyph: '⛶',
    href: '/import',
  },
  {
    label: 'Create collection',
    detail: 'Curate owned items into a named, publishable set (J2)',
    glyph: '▦',
    href: '/collection/new',
    needsInventory: true,
  },
  {
    label: 'Create room',
    detail: 'Place a collection into a themed 2.5D space (J3)',
    glyph: '⌘',
    href: '/room/new',
    needsInventory: true,
  },
];

export default function CreateSheet() {
  const router = useRouter();
  const { hasImported } = useApp();

  function go(action: Action) {
    const target = FEATURES.onboardingGate && action.needsInventory && !hasImported ? '/import' : action.href;
    // Replace rather than push: the sheet should not sit under the flow it opened.
    router.replace(target);
  }

  return (
    <Pressable style={styles.backdrop} onPress={() => router.back()}>
      <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
        <View style={styles.grabber} />
        <Text style={styles.title}>Create</Text>

        {ACTIONS.map((action) => {
          const locked = FEATURES.onboardingGate && action.needsInventory === true && !hasImported;
          return (
            <Pressable
              key={action.href}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => go(action)}
            >
              <View style={styles.iconWrap}>
                <Text style={styles.glyph}>{action.glyph}</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{action.label}</Text>
                <Text style={styles.muted}>
                  {locked ? 'Import your inventory first' : action.detail}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}

        <Pressable onPress={() => router.back()} style={styles.cancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: scrim.medium },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  title: { ...typography.sectionHeader, color: colors.textPrimary, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  pressed: { opacity: 0.7 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.accentMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { fontSize: 18, color: colors.accent },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },
  muted: { ...typography.meta, color: colors.textSecondary },
  chevron: { fontSize: 22, color: colors.textTertiary },
  cancel: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  cancelText: { ...typography.cardTitle, color: colors.textSecondary },
});
