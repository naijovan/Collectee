/**
 * Haptic feedback — one seam, so no screen imports `expo-haptics` directly.
 *
 * Why a wrapper rather than calling the module inline:
 *
 *   1. `expo-haptics` is a no-op on web but still resolves a promise. Every
 *      call site would otherwise need its own `.catch()`, and a rejected
 *      promise from a *decoration* must never surface as an error.
 *   2. Haptics are a §14 descope candidate. Turning them off should be one
 *      flag here, not a sweep through twenty screens.
 *   3. It keeps the vocabulary small. Three verbs, matched to three moments —
 *      if a fourth is ever needed, the argument happens in this file.
 *
 * Everything here is fire-and-forget: never `await` a haptic, it is feedback
 * on an interaction that has already happened.
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Web has no haptic engine, and iOS Simulator silently ignores these. */
const ENABLED = Platform.OS === 'ios' || Platform.OS === 'android';

function fire(run: () => Promise<void>): void {
  if (!ENABLED) return;
  run().catch(() => {
    /* A device with no taptic engine, or the OS refusing under low power.
       Feedback failing to fire is not something the user needs told about. */
  });
}

/**
 * A value changed: filter chips, tabs, toggles, selecting an item in the J2
 * picker. The lightest tick available — this fires often, so it must not
 * accumulate into something annoying.
 */
export function selection(): void {
  fire(() => Haptics.selectionAsync());
}

/**
 * Something was committed or opened: a card tap that navigates, confirming a
 * scan match, placing an item in a room slot.
 */
export function tap(): void {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/**
 * A journey finished. Reserved for exactly three moments in the app — import
 * complete, collection published, room published (§14's never-cut chain).
 * If this fires anywhere else it stops meaning "you finished something".
 */
export function success(): void {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/**
 * A blocked action: submitting with a validation error, picking a file that is
 * too large, tapping a gated tab.
 */
export function warn(): void {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
