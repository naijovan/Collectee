/**
 * The first-run walkthrough: drives the app, and cuts a hole in the dim.
 *
 * Jovan owns src/components/. This one is new rather than a change to an
 * existing component — but it is no longer true that the tour touches nothing
 * else: five targets now carry a `useTourAnchor` ref, two of them in this
 * directory. Those are one prop each and change no layout (see `TourAnchors`).
 *
 * ── Why an absolute View and not a Modal ──────────────────────────────────
 * The earlier card version used `Modal`. A cutout cannot. On native a Modal is
 * a separate window with its own coordinate space, while `measureInWindow`
 * reports coordinates in the app's window — align those wrong and the hole sits
 * next to the target instead of on it, which is the exact failure this whole
 * rework exists to avoid. An absolutely-positioned sibling of the `Stack`
 * shares one coordinate space with everything it measures. `AssistantButton`
 * already floats this way, so it is a proven position in this tree.
 *
 * ── The hole is four rectangles, not a mask ───────────────────────────────
 * Masking would mean `react-native-svg`, which is not a dependency and §13.1
 * says nobody adds one without saying so. Four scrim panels around a gap give a
 * genuinely transparent hole on both platforms with no dependency. Rounded
 * corners come from a ring drawn on the boundary, which is also what pulses.
 *
 * Nothing underneath is brightened — it cannot be. The target reads as bright
 * because it is the only thing NOT dimmed, which is what a spotlight is.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FEATURES } from '@/config/features';
import { buildTourStops } from '@/domain/tour';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import * as haptics from '@/lib/haptics';
import { newsService } from '@/services';
import { useTourAnchors } from '@/state/TourAnchors';
import type { AnchorRect } from '@/state/TourAnchors';
import { colors, interaction, motion, radius, scrim, spacing, typography } from '@/theme/theme';
import { GAME_TITLES } from '@/types';

/**
 * How long to let a screen settle after navigating before measuring it.
 *
 * This is the "brief beat on arrival" — it is not only cosmetic. A rect
 * measured on the frame a screen mounts is frequently zero or mid-transition,
 * and the retry loop below exists because even this is not always enough.
 */
const SETTLE_MS = 380;

/** Retry budget for a target that is not laid out yet. */
const MEASURE_RETRIES = 8;
const MEASURE_RETRY_MS = 90;

/**
 * Re-measure cadence while a stop is displayed.
 *
 * The digest resolves asynchronously and grows the box it lives in; without
 * this the hole would keep the loading placeholder's height and clip the thing
 * it is pointing at. Cheap — one `measureInWindow` on one node, and the state
 * only updates when the rect actually moves.
 */
const REMEASURE_MS = 500;

/** Breathing room between the target's box and the edge of the hole. */
const HOLE_PAD = 8;
/** Gap between the hole and the card beside it. */
const CARD_GAP = spacing.md;

/* Web has no native animated module, so asking for one only prints a warning
 * and falls back anyway. Same expression `primitives` and `import` already use. */
const NATIVE_DRIVER = Platform.OS !== 'web';

type Phase = 'moving' | 'shown';

function sameRect(a: AnchorRect | null, b: AnchorRect | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function TourOverlay({ onDone }: { onDone: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { measureUnion } = useTourAnchors();
  const reduceMotion = useReduceMotion();

  const stops = useMemo(() => buildTourStops({ news: FEATURES.news }), []);

  /**
   * Start the digests resolving the moment the tour appears.
   *
   * The News stop is roughly ten seconds away — the prompt, then four stops —
   * and the live call takes 1.1-1.5s against the deployed proxy. Starting it
   * here means the stop renders the model's bullets on its first frame instead
   * of a shimmer, which is the difference between the spotlight landing on an
   * answer and landing on a grey rectangle.
   *
   * All three titles, not just the one the stop opens on: the tabs are right
   * there under the spotlight and whoever is driving may well tap one. Three
   * calls once per session, deduplicated and cached by the service, and a
   * failure is already the prepared fallback.
   */
  useEffect(() => {
    if (!FEATURES.news) return;
    for (const title of GAME_TITLES) void newsService.prefetchDigest(title);
  }, []);

  /* -1 is the "would you like a tour?" prompt. Same component as the stops so
     there is one exit path — two components would be two ways to be half
     dismissed. */
  const [index, setIndex] = useState(-1);
  const [phase, setPhase] = useState<Phase>('shown');
  const [hole, setHole] = useState<AnchorRect | null>(null);

  const stop = index >= 0 ? stops[index] : undefined;

  /* Guards against a slow measure from a step the user has already left
     landing on top of the current one. */
  const runId = useRef(0);
  /* The settle timer, so a fast Next-Next-Next cannot leave three of them
     queued — the runId check would no-op the measures, but the timers would
     still fire and the last one to land would win a race it should not be in. */
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  const fade = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  /**
   * Move the app to a stop's route.
   *
   * `/news` is a stack route; the tabs are not. Popping explicitly rather than
   * relying on `navigate` to find its way back means the stack cannot silently
   * grow across a Back/Next/Back sequence, and the last stop lands on Home
   * rather than on Home pushed over Gaming updates.
   */
  const goToRoute = useCallback(
    (route: Parameters<typeof router.navigate>[0]) => {
      if (route === '/news') {
        router.navigate(route);
        return;
      }
      if (router.canDismiss()) router.dismissAll();
      router.navigate(route);
    },
    [router],
  );

  const finish = useCallback(() => {
    haptics.tap();
    /* Home, not wherever they happened to be. The tour moved them without being
       asked, so leaving them on Gaming updates mid-first-run strands them on a
       screen they never chose with no idea how they got there. Home is the
       app's ground state and where the run ends anyway. */
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/');
    onDone();
  }, [onDone, router]);

  /** The whole transition: fade out, navigate, settle, measure, fade in. */
  const goToStop = useCallback(
    (next: number) => {
      if (next >= stops.length) {
        finish();
        return;
      }

      const target = stops[next];
      if (!target) return;

      const id = ++runId.current;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      haptics.tap();
      setPhase('moving');
      setIndex(next);
      /* Drop the previous hole immediately. Keeping it while the app navigates
         would leave a lit window over whatever slid in underneath it. */
      setHole(null);

      Animated.timing(fade, {
        toValue: 0,
        duration: motion.fast,
        easing: Easing.out(Easing.quad),
        useNativeDriver: NATIVE_DRIVER,
      }).start();

      goToRoute(target.route);

      settleTimer.current = setTimeout(() => {
        let attempt = 0;

        const attemptMeasure = async () => {
          if (runId.current !== id) return;

          let rect = await measureUnion(target.targetIds);
          if (!rect && target.fallbackTargetIds) {
            rect = await measureUnion(target.fallbackTargetIds);
          }
          if (runId.current !== id) return;

          if (!rect && attempt < MEASURE_RETRIES) {
            attempt += 1;
            setTimeout(attemptMeasure, MEASURE_RETRY_MS);
            return;
          }

          /* `rect` may still be null here, and that is a supported outcome: the
             card shows centred with no cutout rather than a hole in the wrong
             place. A misaligned spotlight is worse than none — it points
             confidently at nothing. */
          setHole(rect);
          setPhase('shown');
          Animated.timing(fade, {
            toValue: 1,
            duration: motion.base,
            easing: Easing.out(Easing.quad),
            useNativeDriver: NATIVE_DRIVER,
          }).start();
        };

        void attemptMeasure();
      }, SETTLE_MS);
    },
    [fade, finish, goToRoute, measureUnion, stops],
  );

  /* Keep the hole on the target while a stop is up: the digest grows when it
     resolves, and a rotation or a font settling moves everything. */
  useEffect(() => {
    if (phase !== 'shown' || !stop || !hole) return;

    const timer = setInterval(async () => {
      let rect = await measureUnion(stop.targetIds);
      if (!rect && stop.fallbackTargetIds) rect = await measureUnion(stop.fallbackTargetIds);
      // Only when it actually moved, so this is not a 2Hz re-render.
      setHole((current) => (sameRect(current, rect) ? current : rect));
    }, REMEASURE_MS);

    return () => clearInterval(timer);
  }, [phase, stop, hole, measureUnion]);

  /* Reduce Motion means reduce, not remove: the ring still marks the target,
     it just stops repeating. The pulse is pure decoration — removing it loses
     nothing, which is this codebase's test for what stops dead. */
  useEffect(() => {
    if (reduceMotion || phase !== 'shown' || !hole) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion, phase, hole]);

  const total = stops.length;

  // ── The prompt ──────────────────────────────────────────────────────────
  if (index === -1) {
    return (
      <View style={styles.root} pointerEvents="box-none">
        <View style={[StyleSheet.absoluteFill, styles.fullScrim]} pointerEvents="auto" />
        <View style={[styles.cardWrap, { bottom: insets.bottom + spacing.xl }]} pointerEvents="box-none">
          <View style={styles.card}>
            <Text style={styles.title}>Take a 30-second tour?</Text>
            <Text style={styles.text}>
              Five stops. It drives itself, you can leave at any point, and it will not ask again.
            </Text>
            <View style={styles.row}>
              <Pressable
                onPress={finish}
                hitSlop={interaction.hitSlop}
                accessibilityRole="button"
                style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
              >
                <Text style={styles.ghostLabel}>Maybe later</Text>
              </Pressable>
              <Pressable
                onPress={() => goToStop(0)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
              >
                <Text style={styles.primaryLabel}>Show me</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (!stop) return null;

  const ringRadius = stop.shape === 'pill' ? radius.pill : radius.card;

  /* Card goes on whichever side of the hole has more room, so it is adjacent
     and never covering. With no hole it centres. */
  const spaceAbove = hole ? hole.y - insets.top : 0;
  const spaceBelow = hole ? screenH - (hole.y + hole.height) - insets.bottom : 0;
  const cardBelow = hole ? spaceBelow >= spaceAbove : false;

  const cardPosition = !hole
    ? { top: 0, bottom: 0, justifyContent: 'center' as const }
    : cardBelow
      ? { top: hole.y + hole.height + HOLE_PAD + CARD_GAP, bottom: insets.bottom + spacing.md }
      : { top: insets.top + spacing.md, bottom: screenH - hole.y + HOLE_PAD + CARD_GAP };

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Four panels around the hole. During 'moving' there is no hole, so the
          whole screen dims — that is the beat before the spotlight lands. */}
      {phase === 'shown' && hole ? (
        <>
          <View
            style={[styles.dim, { top: 0, left: 0, right: 0, height: Math.max(0, hole.y - HOLE_PAD) }]}
            pointerEvents="auto"
          />
          <View
            style={[styles.dim, { top: hole.y + hole.height + HOLE_PAD, left: 0, right: 0, bottom: 0 }]}
            pointerEvents="auto"
          />
          <View
            style={[
              styles.dim,
              {
                top: hole.y - HOLE_PAD,
                left: 0,
                width: Math.max(0, hole.x - HOLE_PAD),
                height: hole.height + HOLE_PAD * 2,
              },
            ]}
            pointerEvents="auto"
          />
          <View
            style={[
              styles.dim,
              {
                top: hole.y - HOLE_PAD,
                left: hole.x + hole.width + HOLE_PAD,
                right: 0,
                height: hole.height + HOLE_PAD * 2,
              },
            ]}
            pointerEvents="auto"
          />

          {/* Transparent, but it swallows touches. The hole is a real gap, so
              without this the highlighted control is live — and tapping the
              Import tab mid-tour would navigate out from under the overlay. */}
          <View
            style={{
              position: 'absolute',
              top: hole.y - HOLE_PAD,
              left: hole.x - HOLE_PAD,
              width: hole.width + HOLE_PAD * 2,
              height: hole.height + HOLE_PAD * 2,
            }}
            pointerEvents="auto"
          />

          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              {
                top: hole.y - HOLE_PAD,
                left: hole.x - HOLE_PAD,
                width: hole.width + HOLE_PAD * 2,
                height: hole.height + HOLE_PAD * 2,
                borderRadius: ringRadius,
                opacity: fade,
              },
            ]}
          />
          {/* A second ring outside the first, scaling and fading — the glow.
              Separate node so the solid edge stays crisp while this breathes. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glow,
              {
                top: hole.y - HOLE_PAD,
                left: hole.x - HOLE_PAD,
                width: hole.width + HOLE_PAD * 2,
                height: hole.height + HOLE_PAD * 2,
                borderRadius: ringRadius,
                opacity: Animated.multiply(
                  fade,
                  pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.12] }),
                ),
                transform: [
                  { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
                ],
              },
            ]}
          />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fullScrim]} pointerEvents="auto" />
      )}

      <Animated.View
        style={[styles.cardWrap, cardPosition, { opacity: fade }]}
        pointerEvents={phase === 'shown' ? 'box-none' : 'none'}
      >
        <View style={styles.card}>
          <View style={styles.topRow}>
            <Text style={styles.count}>
              {index + 1} of {total}
            </Text>
            <Pressable
              onPress={finish}
              hitSlop={interaction.hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Close tour"
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.pips}>
            {stops.map((s, i) => (
              <View key={s.id} style={[styles.pip, i <= index && styles.pipDone]} />
            ))}
          </View>

          <Text style={styles.title}>{stop.title}</Text>
          <Text style={styles.text}>{stop.body}</Text>

          {/* Only when the target could not be found. Saying so beats a card
              that describes something the user cannot see highlighted. */}
          {!hole && phase === 'shown' ? (
            <Text style={styles.note}>Look for this on the screen behind.</Text>
          ) : null}

          <View style={styles.row}>
            <Pressable
              onPress={() => (index === 0 ? finish() : goToStop(index - 1))}
              hitSlop={interaction.hitSlop}
              accessibilityRole="button"
              style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
            >
              <Text style={styles.ghostLabel}>{index === 0 ? 'Skip tour' : 'Back'}</Text>
            </Pressable>
            <Pressable
              onPress={() => goToStop(index + 1)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryLabel}>
                {index === total - 1 ? 'Done' : 'Next'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  /* Above AssistantButton's zIndex 60 — the last stop points at that button and
     must draw over it, not under. */
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  fullScrim: { backgroundColor: scrim.medium },
  dim: { position: 'absolute', backgroundColor: scrim.medium },

  ring: { position: 'absolute', borderWidth: 2, borderColor: colors.accent },
  glow: { position: 'absolute', borderWidth: 6, borderColor: colors.accent },

  cardWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  card: {
    width: '100%',
    maxWidth: 460,
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { ...typography.meta, color: colors.textTertiary },
  close: { ...typography.cardTitle, fontSize: 16, color: colors.textSecondary },

  pips: { flexDirection: 'row', gap: spacing.xs },
  pip: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border },
  pipDone: { backgroundColor: colors.accent },

  title: { ...typography.sectionHeader, fontSize: 20, color: colors.textPrimary },
  text: { ...typography.body, color: colors.textSecondary },
  note: { ...typography.meta, color: colors.textTertiary },

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
