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

import { colors, radius, spacing, typography, accentLink } from '@/theme/theme';

import { BrandMark } from './BrandMark';

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
      {/* Row rather than a prepended sibling, for the same reason as
          `PinnedHeader`: the block below owns a `space-between` top row and a
          full-width progress bar, and both assume they have the whole width. */}
      <View style={styles.brandRow}>
        <BrandMark style={styles.mark} />
        <View style={styles.brandBody}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, paddingBottom: spacing.md },
  brandRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  /* The stepper's first row is the Back link (`body`, 20px line), which is
     much shorter than the mark — centring the mark against the whole block
     would drag it below the row it introduces, so it stays top-aligned. */
  mark: {},
  /* The stepper's own vertical rhythm, now that the row owns the horizontal. */
  brandBody: { flex: 1, gap: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { ...typography.body, color: accentLink },
  count: { ...typography.meta, color: colors.textSecondary },
  bar: { flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  segmentDone: { backgroundColor: colors.accentMuted },
  segmentActive: { backgroundColor: colors.accent },
  label: { ...typography.screenTitle, color: colors.textPrimary, marginTop: spacing.xs },
});
