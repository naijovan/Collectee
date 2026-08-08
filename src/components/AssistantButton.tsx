/**
 * The floating assistant launcher, and the panel it opens.
 *
 * Fixed bottom-right on every screen, because the assistant answers questions
 * *about* whatever the user is currently looking at — a launcher that only
 * exists on Home would be useless at the moment someone actually has a question.
 * For the same reason it opens a panel over the current screen rather than
 * pushing a route: navigating away replaces the thing being asked about.
 *
 * ── Except in the showroom ────────────────────────────────────────────────
 * The immersive showroom is the one full-bleed surface in the app: it fills the
 * viewport, it is dragged and pinched across its whole area, and it is the
 * screen the demo lingers on. A floating button there would sit on the scene,
 * intercept gestures near the corner, and appear in every screenshot of the
 * feature the product is built around. So it hides on that route.
 *
 * Mounted once in the root layout rather than per screen — one instance, one
 * position, and no screen can forget it.
 *
 * ── The pill and the bubble are SIBLINGS, never nested ────────────────────
 * Both are pressables. `react-native-web` renders `accessibilityRole="button"`
 * as a real `<button>`, and a button inside a button is invalid markup that
 * React logs as an error overlay — the exact regression the community card hit
 * (see `CommunityCard` in `cards.tsx`). They sit side by side in a row that is
 * `pointerEvents="box-none"`, so the gap between them stays click-through and
 * neither contains the other.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';

import { assistantMascot } from '@/config/assistantArt';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useAssistantDock } from '@/state/AssistantDock';
import { useTourAnchor } from '@/state/TourAnchors';
import { colors, interaction, motion, radius, spacing, typography } from '@/theme/theme';

import { AssistantPanel } from './AssistantPanel';
import { ASSISTANT_CLEARANCE, ASSISTANT_NAME, BUBBLE, BUBBLE_BOTTOM } from './assistantDock';

/* Re-exported so `components/index.ts` and the three screens that pad by the
   clearance keep importing it from here, where it has always lived. */
export { ASSISTANT_CLEARANCE, ASSISTANT_NAME };

/**
 * Routes that own their whole viewport and must stay unobstructed.
 *
 * Jovan's list, deliberately unchanged. `/assistant` was on it and has gone —
 * the panel replaced that route, and a launcher cannot obstruct a screen that
 * no longer exists.
 */
const HIDDEN_ON = ['/room/immersive'];

/** How long the greeting shows itself on first mount, before retreating. */
const GREETING_MS = 4000;

/** One greeting per session, not per mount. Tab screens stay mounted and
 *  remount on navigation; without this the pill would pop on every return. */
let greetedThisSession = false;

/**
 * The only route the pill introduces itself on, uninvited.
 *
 * Everywhere else it waits to be hovered. The dock floats over a full-bleed
 * layout, so an unrequested pill is ~190px of content covered on whatever
 * screen the user happens to be looking at — over News media cards and Explore
 * grids that reads as breakage, and over the sign-in form it is simply wrong.
 * Home is the ground state and where the first run lands, so a greeting there
 * is a greeting on arrival.
 *
 * Hover is exempt because the user asked for it.
 */
const GREETS_ON = '/';

export function AssistantButton() {
  const pathname = usePathname();
  const reduceMotion = useReduceMotion();
  const { open, openPanel, closePanel } = useAssistantDock();
  /* Final stop of the first-run walkthrough. Inert without the tour mounted.
     Anchored on the BUBBLE, not the row — the spotlight should ring the face,
     not a wide invisible strip with the pill in it. */
  const tourAnchor = useTourAnchor('assistant-button');

  const [hovered, setHovered] = useState(false);
  const [greeting, setGreeting] = useState(!greetedThisSession);
  const wiggle = useRef(new Animated.Value(0)).current;
  const mascot = assistantMascot();

  /* First-render greeting, then it retreats. Runs once per session. */
  useEffect(() => {
    if (greetedThisSession) return;
    if (pathname !== GREETS_ON) {
      /* Not the ground state — say nothing, and leave the one greeting
         unspent so it still happens when they reach Home. */
      setGreeting(false);
      return;
    }
    greetedThisSession = true;
    const t = setTimeout(() => setGreeting(false), GREETING_MS);
    return () => clearTimeout(t);
  }, [pathname]);

  /**
   * The wave. A short rotate out-and-back that settles, not a loop.
   *
   * Reduce Motion kills it outright rather than shortening it: this is
   * decoration by the codebase's own test — remove it and nothing is lost, the
   * launcher still says what it is. Same call `LoadingState` makes, and the
   * value is pinned to rest so nothing is left mid-rotation.
   */
  const wave = useCallback(() => {
    if (reduceMotion) {
      wiggle.setValue(0);
      return;
    }
    wiggle.setValue(0);
    Animated.sequence([
      Animated.timing(wiggle, {
        toValue: 1,
        duration: motion.fast,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.timing(wiggle, {
        toValue: -1,
        duration: motion.base,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(wiggle, {
        toValue: 0,
        friction: motion.spring.friction,
        tension: motion.spring.tension,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [reduceMotion, wiggle]);

  const onHoverIn = useCallback(() => {
    setHovered(true);
    setGreeting(true);
    wave();
  }, [wave]);

  const onHoverOut = useCallback(() => {
    setHovered(false);
    setGreeting(false);
  }, []);

  if (HIDDEN_ON.some((route) => pathname.startsWith(route))) return null;

  const rotate = wiggle.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-8deg', '8deg'],
  });

  /* The pill is hidden while the panel is open: the launcher is a close button
     at that point, and "Ask Colly" beside an open panel is an invitation to do
     the thing already being done. */
  const showPill = greeting && !open;

  return (
    <>
      {open ? <AssistantPanel /> : null}

      {/* box-none so the gap between pill and bubble stays click-through and
          this row never swallows a tap meant for the screen underneath. */}
      <View style={styles.dock} pointerEvents="box-none">
        {showPill ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ask ${ASSISTANT_NAME} about your collection`}
            onPress={openPanel}
            onHoverIn={onHoverIn}
            onHoverOut={onHoverOut}
            style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
          >
            <Text style={styles.pillText} numberOfLines={1}>
              Ask {ASSISTANT_NAME} 👋
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          ref={tourAnchor}
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={
            open ? 'Close the assistant' : `Ask ${ASSISTANT_NAME} about your collection`
          }
          onPress={open ? closePanel : openPanel}
          onHoverIn={onHoverIn}
          onHoverOut={onHoverOut}
          onFocus={onHoverIn}
          onBlur={onHoverOut}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          {/* Animated wrapper INSIDE the pressable: rotating the pressable
              itself would rotate its hit box with it. */}
          <Animated.View
            style={[
              styles.bubble,
              hovered && styles.bubbleHovered,
              { transform: [{ rotate }] },
            ]}
          >
            {open ? (
              <Text style={styles.glyph}>✕</Text>
            ) : mascot ? (
              <Image
                source={mascot}
                style={styles.mascot}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              /* The seam is empty until the art lands — same sparkle as before. */
              <Text style={styles.glyph}>✦</Text>
            )}
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    /* lg, not xl. The screens are full-bleed — there is no gutter to move
       into — so every extra pixel of right margin pushes the bubble further
       ACROSS the content rather than away from it. xl was tried and put the
       bubble on top of article media cards. */
    right: spacing.lg,
    bottom: BUBBLE_BOTTOM,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // Above the panel's overlay, so the launcher stays tappable as the close
    // control while the panel is open.
    zIndex: 60,
  },
  bubble: {
    width: BUBBLE,
    height: BUBBLE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.accentPressed,
    shadowColor: colors.accent,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  bubbleHovered: { borderColor: colors.textOnAccent },
  mascot: { width: '100%', height: '100%' },
  glyph: { ...typography.cardTitle, fontSize: 22, lineHeight: 26, color: colors.textOnAccent },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    /* The near-black surface token, not a raw hex — no hex outside theme.ts.
       Same choice `import.tsx` makes for a neutral drop shadow. */
    shadowColor: colors.background,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pillText: { ...typography.meta, color: colors.textPrimary },
  pressed: { opacity: interaction.pressedOpacity },
});
