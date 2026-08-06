/**
 * The first-run walkthrough — a prompt, then five cards over the real app.
 *
 * Jovan owns every component in src/components/. This one is new rather than a
 * change to an existing one, which is the point: the walkthrough deliberately
 * touches none of the components it talks about (§13.3 names this file tree as
 * where merge conflicts happen, and it is polish week).
 *
 * ── What it draws over ────────────────────────────────────────────────────
 * Whatever is underneath. It mounts from the root layout beside the `Stack`,
 * so the app renders normally behind a scrim and the cards sit on top. Tapping
 * "Take me there" navigates the app under the overlay and the card follows —
 * which is why the copy can say "here is Discover" and then show it.
 *
 * ── Dismissal ─────────────────────────────────────────────────────────────
 * Every exit is the same exit: the scrim, the close control, "Maybe later",
 * and finishing the last card all call `completeTour`. There is no partial
 * state to be in, and nothing re-opens it for the rest of the session.
 */

import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOUR_STOPS } from '@/domain/tour';
import * as haptics from '@/lib/haptics';
import { colors, interaction, radius, scrim, spacing, typography } from '@/theme/theme';

export function TourOverlay({ onDone }: { onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  /* -1 is the "would you like a tour?" prompt. Folding it into the same
     component rather than making it a separate popup keeps one exit path:
     declining and finishing both land on `onDone` and neither can leave the
     other showing. */
  const [index, setIndex] = useState(-1);

  const finish = useCallback(() => {
    haptics.tap();
    onDone();
  }, [onDone]);

  const stop = TOUR_STOPS[index];
  /* Hoisted out of `stop` so the null check narrows inside the onPress closure.
     Narrowing on a property access does not survive into a deferred callback. */
  const href = stop?.href ?? null;

  return (
    /* A Modal rather than an absolutely-positioned View: on native this is the
       only way to get above the stack header and the tab bar, and on web it
       still renders a fixed full-viewport layer. */
    <Modal transparent animationType="fade" visible onRequestClose={finish}>
      {/* The scrim dismisses. An overlay you cannot get out of by tapping away
          is the thing everyone hates about tours, and the demo is being driven
          by someone who may want it gone immediately. */}
      <Pressable style={styles.scrim} onPress={finish} accessibilityLabel="Dismiss tour">
        {/* Stops the card from inheriting the scrim's dismiss. */}
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xl }]}
          onPress={() => {}}
          accessibilityViewIsModal
        >
          {index === -1 ? (
            <View style={styles.body}>
              <Text style={styles.title}>Take a 30-second tour?</Text>
              <Text style={styles.text}>
                Five stops, and you can leave at any point. It will not ask again.
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
                  onPress={() => {
                    haptics.tap();
                    setIndex(0);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryLabel}>Show me</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {stop ? (
            <View style={styles.body}>
              <View style={styles.topRow}>
                <Text style={styles.count}>
                  {index + 1} of {TOUR_STOPS.length}
                </Text>
                <Pressable
                  onPress={finish}
                  hitSlop={interaction.hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel="Close tour"
                >
                  <Text style={styles.close}>Skip tour</Text>
                </Pressable>
              </View>

              <View style={styles.pips}>
                {TOUR_STOPS.map((s, i) => (
                  <View key={s.title} style={[styles.pip, i <= index && styles.pipDone]} />
                ))}
              </View>

              <Text style={styles.title}>{stop.title}</Text>
              <Text style={styles.text}>{stop.body}</Text>

              <View style={styles.row}>
                {href ? (
                  <Pressable
                    onPress={() => {
                      haptics.tap();
                      /* Navigates the app UNDER the overlay — the card stays up
                         and the next tap on Next moves on with the new screen
                         already behind it. */
                      router.push(href);
                    }}
                    hitSlop={interaction.hitSlop}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.ghost, pressed && styles.pressed]}
                  >
                    <Text style={styles.ghostLabel}>{stop.action}</Text>
                  </Pressable>
                ) : (
                  <View />
                )}
                <Pressable
                  onPress={() => {
                    haptics.tap();
                    if (index === TOUR_STOPS.length - 1) finish();
                    else setIndex(index + 1);
                  }}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
                >
                  <Text style={styles.primaryLabel}>
                    {index === TOUR_STOPS.length - 1 ? 'Done' : 'Next'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: scrim.medium, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    /* Matches the other centred columns in the first run, so the sheet does not
       run the full width of a desktop browser. */
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
  },
  body: { gap: spacing.md },

  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { ...typography.meta, color: colors.textTertiary },
  close: { ...typography.meta, color: colors.textSecondary },

  pips: { flexDirection: 'row', gap: spacing.xs },
  pip: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.border },
  pipDone: { backgroundColor: colors.accent },

  title: { ...typography.sectionHeader, fontSize: 20, color: colors.textPrimary },
  text: { ...typography.body, color: colors.textSecondary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  ghost: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  ghostLabel: { ...typography.cardTitle, color: colors.accent },
  primary: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  primaryLabel: { ...typography.cardTitle, color: colors.textOnAccent },
  pressed: { opacity: interaction.pressedOpacity },
});
