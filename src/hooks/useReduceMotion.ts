/**
 * Is the OS "Reduce Motion" setting on?
 *
 * Extracted from the copy that already lived inside `import.tsx`'s scan hero —
 * once more than one surface animates, every one of them needs this answer and
 * none of them should re-implement the listener.
 *
 * It subscribes as well as reads: the user can flip the setting from Control
 * Centre without leaving the app, and an animation that keeps running after
 * they asked it to stop is worse than one that never started.
 *
 * Reduce Motion means *reduce*, not *remove*. The rule this codebase follows is
 * that a motion is decoration if removing it loses nothing — those stop dead.
 * Motion that carries meaning (scan progress, a room's parallax) keeps its
 * composition and drops only the repetition. See `ScanPreview` in `import.tsx`
 * for the worked example.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (mounted) setReduceMotion(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduceMotion;
}
