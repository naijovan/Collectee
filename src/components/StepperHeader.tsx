/**
 * StepperHeader — PRD §13.3, and the fix for the numbering bug in §11 F3.
 *
 * "The Figma shows a 4-step bar but labels three screens Step 3 (Select Theme,
 *  Arrange, Preview Details '3.5'). The Room flow has the same problem: two
 *  screens labelled Step 3 in a 5-step bar. Pick canonical counts once, in code,
 *  and let both flows import them."
 *
 * The canonical arrays are `COLLECTION_STEPS` and `ROOM_STEPS` in
 * `domain/collections.ts`. This component takes one of them and renders the bar
 * from its length — so the count on screen cannot drift from the count in code,
 * and Preview / Preview Details stay outside the numbered bar as §11 F3 requires.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/theme';

export function StepperHeader({
  steps,
  current,
  onBack,
}: {
  steps: readonly string[];
  /** 0-based index into `steps`. */
  current: number;
  onBack?: () => void;
}) {
  const label = steps[current];

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Text style={styles.count}>
          Step {current + 1} of {steps.length}
        </Text>
      </View>

      <View style={styles.bar}>
        {steps.map((step, index) => (
          <View
            key={step}
            style={[
              styles.segment,
              index < current && styles.segmentDone,
              index === current && styles.segmentActive,
            ]}
          />
        ))}
      </View>

      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, paddingBottom: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { ...typography.body, color: colors.accent },
  count: { ...typography.meta, color: colors.textSecondary },
  bar: { flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  segmentDone: { backgroundColor: colors.accentMuted },
  segmentActive: { backgroundColor: colors.accent },
  label: { ...typography.screenTitle, color: colors.textPrimary, marginTop: spacing.xs },
});
