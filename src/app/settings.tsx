/**
 * Settings — personal details and app preferences.
 *
 * Reached from the gear in the Profile header. Profile is the identity surface,
 * so the controls that change that identity belong one tap from it rather than
 * floating over every screen — which is where the theme toggle used to live.
 *
 * ── On persistence ────────────────────────────────────────────────────────
 * Display name, handle and bio edit the in-memory viewer for the session. There
 * is no backend (§12.1), so "Save" is honest about what it does rather than
 * implying a write that never happens — the note under the form says so.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, SectionHeader } from '@/components';
import { useApp } from '@/state/AppContext';
import { useThemeMode } from '@/theme/ThemeMode';
import { colors, radius, spacing, typography } from '@/theme/theme';

const NAME_LIMIT = 32;
const BIO_LIMIT = 140;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { viewer } = useApp();
  const { mode, toggle, supported } = useThemeMode();

  const [displayName, setDisplayName] = useState(viewer?.displayName ?? '');
  const [handle, setHandle] = useState(viewer?.handle ?? '');
  const [bio, setBio] = useState(viewer?.bio ?? '');
  const [saved, setSaved] = useState(false);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
    >
      <SectionHeader title="Your details" />
      <View style={styles.card}>
        <Field
          label="Display name"
          value={displayName}
          onChange={(next) => {
            setDisplayName(next);
            setSaved(false);
          }}
          limit={NAME_LIMIT}
        />
        <Field
          label="Handle"
          value={handle}
          onChange={(next) => {
            // Handles are lowercase and unspaced everywhere they are rendered,
            // so they are normalised on the way in rather than at every use.
            setHandle(next.replace(/\s+/g, '').toLowerCase());
            setSaved(false);
          }}
          limit={NAME_LIMIT}
          prefix="@"
        />
        <Field
          label="Bio"
          value={bio}
          onChange={(next) => {
            setBio(next);
            setSaved(false);
          }}
          limit={BIO_LIMIT}
          multiline
        />
        <PrimaryButton
          label={saved ? '✓ Saved for this session' : 'Save details'}
          onPress={() => setSaved(true)}
        />
        <Text style={styles.footnote}>
          Saved in the app for this session. There is no backend in the demo build (§12.1), so
          nothing leaves the device and a reload restores the seeded profile.
        </Text>
      </View>

      <SectionHeader title="Appearance" />
      <View style={styles.card}>
        <Pressable
          onPress={toggle}
          disabled={!supported}
          accessibilityRole="switch"
          accessibilityState={{ checked: mode === 'light', disabled: !supported }}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Theme</Text>
            <Text style={styles.muted}>
              {supported
                ? mode === 'dark'
                  ? 'Dark — tap to switch to light'
                  : 'Light — tap to switch to dark'
                : 'Dark. Light mode is web-only in this build.'}
            </Text>
          </View>
          <View style={[styles.pill, !supported && styles.pillDisabled]}>
            <Text style={styles.pillText}>{mode === 'dark' ? '☾ Dark' : '☀ Light'}</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChange,
  limit,
  prefix,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  limit: number;
  prefix?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {/* The counter is always visible, not just at the limit — a field that
            only tells you the cap once you hit it has already wasted the typing. */}
        <Text style={styles.counter}>
          {value.length}/{limit}
        </Text>
      </View>
      <View style={[styles.inputWrap, multiline && styles.inputWrapTall]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          maxLength={limit}
          multiline={multiline}
          style={[styles.input, multiline && styles.inputTall]}
          placeholderTextColor={colors.textTertiary}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },

  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  field: { gap: spacing.xs },
  fieldHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { ...typography.meta, color: colors.textTertiary },
  counter: { ...typography.meta, color: colors.textTertiary },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  inputWrapTall: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  prefix: { ...typography.body, color: colors.textTertiary },
  input: { flex: 1, paddingVertical: spacing.md, color: colors.textPrimary, ...typography.body },
  inputTall: { minHeight: 72, paddingVertical: 0, textAlignVertical: 'top' },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },

  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  pillDisabled: { borderColor: colors.border, backgroundColor: 'transparent' },
  pillText: { ...typography.meta, color: colors.accent },
  pressed: { opacity: 0.75 },
});
