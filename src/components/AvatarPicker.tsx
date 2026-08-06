/**
 * The avatar picker — fifteen faces, game-matched first.
 *
 * Jovan owns src/components/. New file rather than a change to an existing one.
 *
 * Used twice: as a skippable step in the first run, and from Profile. Both need
 * the same grid and the same ordering rule, and a second copy would be the one
 * that drifts.
 *
 * ── Presentational on purpose ─────────────────────────────────────────────
 * It takes a value and reports a choice; it does not know about the session
 * overlay, the viewer, or a service. The quiz holds its answer as a draft until
 * the run finishes (nothing is written per tap — see the header on
 * `app/onboarding/quiz.tsx`), while Profile writes immediately. One component
 * cannot own both policies, so it owns neither.
 */

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { avatarsForGames } from '@/config/avatarRegistry';
import * as haptics from '@/lib/haptics';
import { colors, interaction, radius, spacing, typography } from '@/theme/theme';
import { GAME_SHORT_LABELS } from '@/types';
import type { GameTitle } from '@/types';

import { Avatar } from './primitives';

export function AvatarPicker({
  value,
  onChange,
  /** Games to surface first. Empty shows the roster in its declared order. */
  preferredGames = [],
  size = 64,
  /** Wraps into rows when false — Profile wants a grid, the quiz a single row. */
  horizontal = false,
}: {
  value: string | null;
  onChange: (avatarId: string) => void;
  preferredGames?: readonly GameTitle[];
  size?: number;
  horizontal?: boolean;
}) {
  const options = avatarsForGames(preferredGames);

  const faces = options.map((option) => {
    const active = option.id === value;
    return (
      <Pressable
        key={option.id}
        onPress={() => {
          haptics.selection();
          onChange(option.id);
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${option.label}, ${GAME_SHORT_LABELS[option.title]}`}
        style={({ pressed }) => [
          styles.cell,
          { width: size + spacing.md },
          pressed && !active && styles.pressed,
        ]}
      >
        <View style={[styles.ring, active && styles.ringActive, { borderRadius: (size + 8) / 2 }]}>
          <Avatar name={option.label} avatarId={option.id} size={size} />
        </View>
        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
          {option.label}
        </Text>
        <Text style={styles.game}>{GAME_SHORT_LABELS[option.title]}</Text>
      </Pressable>
    );
  });

  if (horizontal) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        /* The picker sits inside a vertical ScrollView in both hosts; without
           this the horizontal drag is swallowed by the parent on Android. */
        nestedScrollEnabled
      >
        {faces}
      </ScrollView>
    );
  }

  return <View style={styles.grid}>{faces}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { gap: spacing.sm, paddingVertical: spacing.xs },
  cell: { alignItems: 'center', gap: 2 },
  ring: {
    padding: 3,
    borderWidth: 2,
    // Transparent rather than absent, so selecting does not move the grid by 2px.
    borderColor: 'transparent',
  },
  ringActive: { borderColor: colors.accent },
  label: { ...typography.meta, color: colors.textSecondary },
  labelActive: { color: colors.textPrimary },
  game: { ...typography.meta, fontSize: 10, color: colors.textTertiary },
  pressed: { opacity: interaction.pressedOpacity },
});
