/**
 * "Every page should start at the top."
 *
 * Two things break that on their own, and neither is a bug in a screen:
 *
 *   1. Tab screens stay mounted. React Navigation keeps Home, Explore,
 *      Collections and Profile alive so switching back is instant — which also
 *      means switching back restores wherever you had scrolled to. Same when a
 *      pushed screen pops.
 *   2. The multi-step flows are one route. Import and Create & Publish advance
 *      by changing state, not by navigating, so the ScrollView never unmounts and
 *      step 2 opens at step 1's scroll offset — halfway down the page.
 *
 * So the reset has to fire on focus AND on whatever value identifies the current
 * step. Attach the returned ref to the screen's top-level ScrollView:
 *
 *   const scrollRef = useTopOnFocus(stage);
 *   <ScrollView ref={scrollRef} …>
 *
 * `key` is a single scalar rather than a dependency array so that callers cannot
 * accidentally pass a fresh object every render and re-scroll on every keystroke.
 * Screens with two pieces of step state pass a template string.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Platform, type ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';

export function useTopOnFocus(key?: string | number | boolean | null) {
  const ref = useRef<ScrollView>(null);

  const toTop = useCallback(() => {
    ref.current?.scrollTo({ y: 0, animated: false });
    // On web the document itself can be the scroller when content overflows the
    // viewport, and that offset survives navigation because the document never
    // unmounts. The ScrollView reset above cannot see it.
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.scrollTo(0, 0);
  }, []);

  // Fires on mount and every time the screen regains focus — tab switch, or a
  // pushed screen popping back to this one.
  useFocusEffect(toTop);

  useEffect(toTop, [toTop, key]);

  return ref;
}
