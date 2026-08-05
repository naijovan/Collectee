/**
 * The floating assistant launcher.
 *
 * Fixed bottom-right on every screen, because the assistant answers questions
 * *about* whatever the user is currently looking at — a launcher that only
 * exists on Home would be useless at the moment someone actually has a question.
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
import { usePathname, useRouter } from 'expo-router';

import { colors, interaction, radius, spacing, typography } from '@/theme/theme';

import { useHoverLift } from './primitives';

/** Routes that own their whole viewport and must stay unobstructed. */
const HIDDEN_ON = ['/room/immersive', '/assistant'];

/**
 * Vertical space a scrolling screen must leave at its end so the last row is
 * not trapped under the button. Exported so screens use the real number rather
 * than each guessing at a spacer — the collision this prevents is a CTA the
 * user can see but cannot tap.
 */
export const ASSISTANT_CLEARANCE = 150;

export function AssistantButton() {
  const router = useRouter();
  const pathname = usePathname();
  const hover = useHoverLift();

  if (HIDDEN_ON.some((route) => pathname.startsWith(route))) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ask the assistant about your collection"
      onPress={() => router.push('/assistant')}
      {...hover.hoverProps}
      style={({ pressed }) => [styles.button, hover.hoverStyle, pressed && styles.pressed]}
    >
      <View style={styles.inner}>
        <Text style={styles.glyph}>✦</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: spacing.lg,
    // Clear of the tab bar, which owns the bottom edge.
    bottom: 92,
    zIndex: 40,
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
