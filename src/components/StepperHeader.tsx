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
  large = false,
}: {
  steps: readonly string[];
  /** 0-based index into `steps`. */
  current: number;
  onBack?: () => void;
  /**
   * Bigger Back link, step counter and title.
   *
   * Opt-in, and default `false`, because this component is shared with the Room
   * flow and that flow was not part of the review this answers. Ray's note —
   * "Back and the step indicator are far too small" — is about first-run, where
   * the counter was `meta` at 12px and the Back link `body` at 14. Those are
   * genuinely under-sized for a primary navigation control, but growing them
   * everywhere would restyle a flow nobody asked about, so the quiz opts in and
   * `room/new` keeps exactly what it renders today.
   *
   * If the Room flow is ever reviewed and wants the same, pass `large` there
   * too rather than changing the defaults — that keeps the diff a call-site
   * decision instead of a silent global one.
   */
  large?: boolean;
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
          /* `hitSlop` alone was doing the work of making a 14px link tappable.
             It still helps, but the padding now gives the control a real box,
             so the target is visible as well as present. */
          <Pressable onPress={onBack} hitSlop={8} style={large ? styles.backTapLarge : undefined}>
            <Text style={[styles.back, large && styles.backLarge]}>‹ Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {/* `numberOfLines` and `flexShrink: 0`: this is the label Ray saw
            clipped. It is the right-hand item in a `space-between` row, so a
            long Back link on a narrow screen was squeezing it — it can no
            longer be compressed, and it cannot wrap into the bar below. */}
        <Text
          style={[styles.count, large && styles.countLarge]}
          numberOfLines={1}
        >
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

      <Text style={[styles.label, large && styles.labelLarge]}>{label}</Text>
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    /* The row can no longer collapse its right-hand child. Without this the
       counter shrank before the Back link did, which is how "Step 3 of 4"
       ended up cut. */
    gap: spacing.md,
  },
  back: { ...typography.body, color: accentLink },
  count: { ...typography.meta, color: colors.textSecondary, flexShrink: 0 },
  bar: { flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  segmentDone: { backgroundColor: colors.accentMuted },
  segmentActive: { backgroundColor: colors.accent },
  label: { ...typography.screenTitle, color: colors.textPrimary, marginTop: spacing.xs },

  /* ── `large` ─────────────────────────────────────────────────────────────
     Opt-in overrides. See the prop's note for why they are not the defaults. */
  backLarge: { ...typography.cardTitle, fontSize: 17, color: accentLink },
  /* A visible box around the link, not just hitSlop, so the target is where it
     looks like it is. Negative left margin keeps the TEXT aligned to the column
     edge while the padding grows outward. */
  backTapLarge: { paddingVertical: spacing.sm, paddingRight: spacing.md, marginLeft: -2 },
  countLarge: { ...typography.body, fontSize: 15, color: colors.textSecondary },
  /* `lineHeight` explicitly above the font size and real space under the bar.
     Ray's "titles render clipped against the progress bar" was 34px of display
     type sitting 4px below a 4px rule — the ascenders read as touching it. */
  labelLarge: { lineHeight: 44, marginTop: spacing.md },
});
