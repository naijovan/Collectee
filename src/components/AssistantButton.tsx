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
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';

import { useAssistantDock } from '@/state/AssistantDock';
import { useTourAnchor } from '@/state/TourAnchors';
import { colors, interaction, radius, spacing, typography } from '@/theme/theme';

import { AssistantPanel } from './AssistantPanel';
import { useHoverLift } from './primitives';

/**
 * Routes that own their whole viewport and must stay unobstructed.
 *
 * Jovan's list, deliberately unchanged. `/assistant` was on it and has gone —
 * the panel replaced that route, and a launcher cannot obstruct a screen that
 * no longer exists.
 */
const HIDDEN_ON = ['/room/immersive'];

/**
 * Vertical space a scrolling screen must leave at its end so the last row is
 * not trapped under the button. Exported so screens use the real number rather
 * than each guessing at a spacer — the collision this prevents is a CTA the
 * user can see but cannot tap.
 */
export const ASSISTANT_CLEARANCE = 150;

export function AssistantButton() {
  const pathname = usePathname();
  const hover = useHoverLift();
  const { open, openPanel, closePanel } = useAssistantDock();
  /* Final stop of the first-run walkthrough. Inert without the tour mounted. */
  const tourAnchor = useTourAnchor('assistant-button');

  if (HIDDEN_ON.some((route) => pathname.startsWith(route))) return null;

  return (
    <>
      {open ? <AssistantPanel /> : null}
      <Pressable
        ref={tourAnchor}
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Close the assistant' : 'Ask the assistant about your collection'}
        onPress={open ? closePanel : openPanel}
        {...hover.hoverProps}
        style={({ pressed }) => [styles.button, hover.hoverStyle, pressed && styles.pressed]}
      >
        <View style={styles.inner}>
          {/* PLACEHOLDER — Marcus is generating a logo; drop the image in here
              and keep the 52×52 frame so the clearance constant stays true. */}
          <Text style={styles.glyph}>{open ? '✕' : '✦'}</Text>
        </View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: spacing.lg,
    // Clear of the tab bar, which owns the bottom edge.
    bottom: 92,
    // Above the panel's overlay, so the launcher stays tappable as the close
    // control while the panel is open.
    zIndex: 60,
  },
  inner: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accentPressed,
  },
  glyph: { ...typography.cardTitle, fontSize: 22, lineHeight: 26, color: colors.textOnAccent },
  pressed: { opacity: interaction.pressedOpacity },
});
