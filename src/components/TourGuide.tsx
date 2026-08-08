/**
 * Colly, the walkthrough's guide — the figure, her speech bubble, and the
 * controls that live with it.
 *
 * ── This wraps the tour, it does not replace it ───────────────────────────
 * `TourOverlay` still owns everything that was hard: navigation, the settle
 * beat, the measure/retry loop, the four-panel cutout and the pulse. This
 * component is presentation. It receives a measured rect and a stop and decides
 * where a character can stand without covering either.
 *
 * ── Where she stands ──────────────────────────────────────────────────────
 * Centre-lower when there is no highlighted region. When there is one, she
 * takes whichever side has more room beside it and gestures inward — flipped
 * horizontally when she is on the right, which is why `pointing` ships as one
 * file (see `config/tourGuideArt`).
 *
 * She is always FULLY visible. Her height is clamped so the bubble and the
 * controls still fit under her on a short viewport, and her horizontal position
 * is clamped to the safe area so an edge never crops her.
 *
 * ── Every animation driver is local to this component ─────────────────────
 * Which means they mount when the tour mounts and unmount when it finishes.
 * Nothing here runs while the app is idle — the lesson from the assistant
 * launcher, where a always-mounted loop would have burned frames on every
 * screen for a flourish nobody was looking at.
 *
 * Under Reduce Motion the entrance, the bob and the celebration all stop dead
 * and the figure is placed at its resting values. The tour still works; it just
 * does not perform.
 */

import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { LayoutRectangle } from 'react-native';

import { guidePose } from '@/config/tourGuideArt';
import type { GuidePose } from '@/config/tourGuideArt';
import { placeGuide } from '@/domain/tourGuidePlacement';
import type { GuidePlacement } from '@/domain/tourGuidePlacement';

/* Re-exported so `TourOverlay` keeps importing both from one place. The maths
   lives in the domain layer; this file renders it. */
export { placeGuide };
export type { GuidePlacement };
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { colors, interaction, motion, radius, spacing, typography } from '@/theme/theme';

import { ASSISTANT_NAME } from './assistantDock';

const NATIVE_DRIVER = Platform.OS !== 'web';

/** Reserved under her for the bubble and controls, so both always fit. */
const BUBBLE_RESERVE = 260;
/** Idle bob travel. Small enough to read as breathing, not floating. */
const BOB_PX = 4;

export function TourGuide({
  pose,
  line,
  index,
  total,
  placement,
  onNext,
  onBack,
  onClose,
  backLabel,
  nextLabel,
}: {
  pose: GuidePose;
  line: string;
  index: number;
  total: number;
  placement: GuidePlacement;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  backLabel: string;
  nextLabel: string;
}) {
  const reduceMotion = useReduceMotion();
  const art = guidePose(pose);

  /* All three drivers are refs on this component, so they exist only while the
     tour is mounted. */
  const enter = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const cheer = useRef(new Animated.Value(0)).current;

  /* Entrance: spring in, once per mount. Re-run on a pose change so a stop
     transition gets its small settle rather than a hard cut. */
  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0.82);
    const anim = Animated.spring(enter, {
      toValue: 1,
      friction: motion.spring.friction,
      tension: motion.spring.tension,
      useNativeDriver: NATIVE_DRIVER,
    });
    anim.start();
    return () => anim.stop();
  }, [enter, reduceMotion, pose]);

  /* Idle bob. The only loop here, and it dies with the component. */
  useEffect(() => {
    if (reduceMotion) {
      bob.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, reduceMotion]);

  /* The celebration beat, on the happy pose only. One pulse, not a loop —
     a repeating celebration stops reading as one. */
  useEffect(() => {
    if (reduceMotion || pose !== 'happy') {
      cheer.setValue(0);
      return;
    }
    cheer.setValue(0);
    const anim = Animated.sequence([
      Animated.timing(cheer, {
        toValue: 1,
        duration: motion.base,
        easing: Easing.out(Easing.back(2)),
        useNativeDriver: NATIVE_DRIVER,
      }),
      Animated.spring(cheer, {
        toValue: 0,
        friction: motion.spring.friction,
        tension: motion.spring.tension,
        useNativeDriver: NATIVE_DRIVER,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [cheer, reduceMotion, pose]);

  /* Solved in `placeGuide` against the target's position — see the note on
     `flipped` there for which way the unflipped art points. */
  const flipped = placement.flipped;

  const scale = Animated.add(
    enter,
    cheer.interpolate({ inputRange: [0, 1], outputRange: [0, 0.06] }),
  );

  const { figure, bubble } = placement;

  return (
    /* A full-screen box the two children position themselves inside, so both
       read from the same solved geometry and neither can drift onto the
       target. `box-none` keeps the empty space click-through. */
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Figure. Never interactive — a tap on her falls through to the scrim
          rather than doing nothing. Dropped entirely on the bubbleOnly rung. */}
      {figure ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: figure.x,
            top: figure.y,
            width: figure.width,
            height: figure.height,
            opacity: enter,
            transform: [
              { scale },
              { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -BOB_PX] }) },
              ...(flipped ? [{ scaleX: -1 }] : []),
            ],
          }}
        >
          {art ? (
            <Image
              source={art}
              style={{ width: '100%', height: '100%' }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </Animated.View>
      ) : null}

      {/* Bubble and controls. One card, so the buttons never separate from the
          voice that is asking you to press them. */}
      <View
        style={[
          styles.bubble,
          { position: 'absolute', left: bubble.x, top: bubble.y, width: bubble.width },
        ]}
      >
        {/* Tail points up at her. Rotated square rather than a triangle glyph,
            so it takes the bubble's own border and background. */}
        {/* Points up at her. She is directly above the bubble by construction,
            so the tail is centred rather than guessing a side. */}
        <View style={[styles.tail, styles.tailCentre]} />

        <View style={styles.topRow}>
          <View style={styles.nameChip}>
            <Text style={styles.nameChipText}>{ASSISTANT_NAME}</Text>
          </View>
          <Text style={styles.count}>
            {index + 1} of {total}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={interaction.hitSlop}
            accessibilityRole="button"
            accessibilityLabel="Close tour"
            style={({ pressed }) => [pressed && styles.pressed]}
          >
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <Text style={styles.line}>{line}</Text>

        {/* Siblings, never nested — the cards.tsx lesson. */}
        <View style={styles.row}>
          <Pressable
            onPress={onBack}
            hitSlop={interaction.hitSlop}
            accessibilityRole="button"
            style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
          >
            <Text style={styles.ghostLabel}>{backLabel}</Text>
          </Pressable>
          <Pressable
            onPress={onNext}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryLabel}>{nextLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  /* A rotated square poking out of the top edge, clipped by nothing — it sits
     above the bubble and shares its fill, so the seam disappears. */
  tail: {
    position: 'absolute',
    top: -6,
    left: spacing.xl,
    width: 12,
    height: 12,
    transform: [{ rotate: '45deg' }],
    backgroundColor: colors.surfaceElevated,
    borderLeftWidth: 1,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  tailCentre: { left: '50%', marginLeft: -6 },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentMuted,
  },
  nameChipText: { ...typography.meta, color: colors.accent },
  count: { ...typography.meta, color: colors.textTertiary, flex: 1 },
  close: { ...typography.cardTitle, fontSize: 16, color: colors.textSecondary },

  line: { ...typography.body, fontSize: 15, lineHeight: 22, color: colors.textPrimary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  ghost: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  ghostLabel: { ...typography.cardTitle, color: colors.accent },
  primary: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  primaryLabel: { ...typography.cardTitle, color: colors.textOnAccent },
  pressed: { opacity: interaction.pressedOpacity },
});
