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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton, SectionHeader } from '@/components';
import { FEATURES } from '@/config/features';
import { socialService } from '@/services';
import { useApp } from '@/state/AppContext';
import { useThemeMode } from '@/theme/ThemeMode';
import { colors, radius, spacing, typography } from '@/theme/theme';

const NAME_LIMIT = 32;
const BIO_LIMIT = 140;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { viewer, viewerId, accountDetails, setAccountDetails, replayTour } = useApp();
  const { mode, toggle, supported } = useThemeMode();

  const [displayName, setDisplayName] = useState(viewer?.displayName ?? '');
  const [handle, setHandle] = useState(viewer?.handle ?? '');
  const [bio, setBio] = useState(viewer?.bio ?? '');
  /* Seeded from what sign-up collected, since neither lives on `User` — see
     `AccountDetails`. Empty when sign-up was skipped, which is fine: both are
     optional here too. */
  const [age, setAge] = useState(accountDetails?.age ?? '');
  const [email, setEmail] = useState(accountDetails?.email ?? '');
  const [saved, setSaved] = useState(false);

  /**
   * The same uniqueness rule sign-up enforces, from the same service — so the
   * two screens cannot disagree about whether a handle is free. `viewerId` is
   * excluded, or leaving your own handle untouched would report it as taken.
   */
  const handleTaken = socialService.isHandleTaken(handle, viewerId);
  const canSave = displayName.trim().length > 0 && handle.trim().length > 0 && !handleTaken;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
    >
      <SectionHeader title="Your Details" />
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
          error={handleTaken ? 'That handle belongs to another collector.' : undefined}
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
        {/* Age sits here rather than as a picker like sign-up's: this is an
            edit, not a gate, and someone changing one field should not have to
            scroll a list of forty-eight to leave the rest alone. */}
        <Field
          label="Age"
          value={age}
          onChange={(next) => {
            setAge(next.replace(/[^0-9]/g, ''));
            setSaved(false);
          }}
          limit={3}
        />
        <Field
          label="Email"
          value={email}
          onChange={(next) => {
            setEmail(next.trim());
            setSaved(false);
          }}
          limit={64}
        />
        <PrimaryButton
          label={saved ? '✓ Saved for this session' : 'Save details'}
          disabled={!canSave}
          onPress={() => {
            /*
              This used to set a flag and nothing else — the form looked like it
              saved and the profile never changed. It now writes through the
              same `setAccountDetails` the sign-up step uses, so there is one
              path that can change an identity and the two screens cannot drift.
            */
            void setAccountDetails({ displayName, handle, age, email, bio });
            setSaved(true);
          }}
        />
        {handleTaken ? (
          <Text style={styles.footnote}>Pick a free handle to save.</Text>
        ) : null}
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
                : /* Locked for the demo — see the header of theme/ThemeMode.
                     The row stays visible rather than disappearing, because a
                     missing control reads as a missing feature; a disabled one
                     that says why reads as a decision. */
                  'Dark, locked. The art, scrims and rarity colours are all authored dark-first.'}
            </Text>
          </View>
          <View style={[styles.pill, !supported && styles.pillDisabled]}>
            <Text style={styles.pillText}>{mode === 'dark' ? '☾ Dark' : '☀ Light'}</Text>
          </View>
        </Pressable>
      </View>

      {/* Settings is where help naturally lives on this app — there is no help
          screen, and Profile → gear is one tap from anywhere. Hidden entirely
          when the tour is cut (§14), rather than left as a row that opens
          nothing. */}
      {FEATURES.firstRunTour ? (
        <>
          <SectionHeader title="Help" />
          <View style={styles.card}>
            <Pressable
              onPress={() => {
                replayTour();
                /* Back to the app: the walkthrough draws over whatever is
                   underneath, and its first stop is about the tab bar, which
                   this screen covers. */
                router.back();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>Replay tour</Text>
                <Text style={styles.muted}>
                  The five-stop walkthrough from your first run. It never shows itself again on
                  its own.
                </Text>
              </View>
              <View style={styles.pill}>
                <Text style={styles.pillText}>Start</Text>
              </View>
            </Pressable>
          </View>
        </>
      ) : null}
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
  error,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  limit: number;
  prefix?: string;
  multiline?: boolean;
  /** Shown under the field, and the box borders red. */
  error?: string;
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
      <View style={[styles.inputWrap, multiline && styles.inputWrapTall, error ? styles.inputWrapError : null]}>
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
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, gap: spacing.md },

  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  inputWrapError: { borderColor: colors.danger },
  fieldError: { ...typography.meta, color: colors.danger },
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
