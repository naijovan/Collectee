/**
 * Click-and-drag panning for horizontal rails, on web.
 *
 * A `FlatList horizontal` renders as an `overflow-x` container in the browser.
 * That gives wheel and trackpad scrolling, and nothing at all for a mouse drag
 * — browsers do not pan overflow containers by dragging. On a laptop trackpad
 * the rails feel fine; on a desktop with a mouse they look stuck, because the
 * obvious gesture does nothing.
 *
 * Native needs none of this: touch already pans a ScrollView, and the callback
 * bails on the first line.
 *
 * ── Returns a CALLBACK ref, and that is the whole fix ─────────────────────
 * This used to hand back an object ref and read `ref.current` from an effect
 * with a stable dependency. Every rail in the app is written as
 *
 *     {busy ? <LoadingState /> : <FlatList ref={rail} … />}
 *
 * so on mount the list does not exist, `ref.current` is null, and the effect
 * returns early — and because its dependency never changed, it never ran again
 * once the data arrived and the list finally mounted. The hook was attaching to
 * nothing, on every rail, which is exactly as useful as not having it.
 *
 * A callback ref fires when the node attaches and again with null when it
 * detaches, so it cannot miss a late mount, a remount, or a list that swaps
 * places with a loading state.
 */

import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Pixels of movement before a press becomes a drag.
 *
 * Load-bearing. Every card in these rails is pressable, and without a
 * threshold the tiny movement in an ordinary click would swallow the tap — the
 * rail would scroll by two pixels and the card would never open. Past 4px the
 * user is clearly dragging and the click is suppressed on purpose.
 */
const DRAG_THRESHOLD = 4;

interface Scrollable {
  getScrollableNode?: () => unknown;
}

/** Wire one DOM node for dragging. Returns the teardown. */
function attach(node: HTMLElement): () => void {
  let down = false;
  let dragged = false;
  let startX = 0;
  let startScroll = 0;

  const onPointerDown = (event: PointerEvent) => {
    /* Primary button only. A right-click or a middle-click drag is the
       browser's to handle, not ours. */
    if (event.button !== 0) return;
    down = true;
    dragged = false;
    startX = event.clientX;
    startScroll = node.scrollLeft;
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!down) return;
    const delta = event.clientX - startX;
    if (!dragged && Math.abs(delta) < DRAG_THRESHOLD) return;

    if (!dragged) {
      dragged = true;
      /* Captured only once the gesture is definitely a drag, so a plain click
         never has its target stolen. */
      node.setPointerCapture?.(event.pointerId);
      node.style.cursor = 'grabbing';
      /* Stops the browser turning the drag into a text or image selection
         halfway through. */
      node.style.userSelect = 'none';
    }
    node.scrollLeft = startScroll - delta;
  };

  const end = (event: PointerEvent) => {
    if (!down) return;
    down = false;
    node.releasePointerCapture?.(event.pointerId);
    node.style.cursor = 'grab';
    node.style.userSelect = '';
    /* Cleared on the next frame, not here: the click event fires after
       pointerup, and the suppressor below has to still see the flag. */
    if (dragged) requestAnimationFrame(() => (dragged = false));
  };

  /** Swallow the click that ends a drag, so panning never opens a card. */
  const onClick = (event: MouseEvent) => {
    if (!dragged) return;
    event.stopPropagation();
    event.preventDefault();
  };

  node.style.cursor = 'grab';
  node.addEventListener('pointerdown', onPointerDown);
  node.addEventListener('pointermove', onPointerMove);
  node.addEventListener('pointerup', end);
  node.addEventListener('pointercancel', end);
  /* Capture phase: the card's own handler is on a descendant, so this has to
     run on the way DOWN to stop it. */
  node.addEventListener('click', onClick, true);

  return () => {
    node.removeEventListener('pointerdown', onPointerDown);
    node.removeEventListener('pointermove', onPointerMove);
    node.removeEventListener('pointerup', end);
    node.removeEventListener('pointercancel', end);
    node.removeEventListener('click', onClick, true);
    node.style.cursor = '';
    node.style.userSelect = '';
  };
}

/**
 * Spread onto a horizontal list: `ref={useDragScroll<FlatList>()}` — or hold it
 * in a variable if the same rail is referenced twice.
 */
export function useDragScroll<T extends Scrollable>() {
  /** Teardown for the node currently wired, so a remount cannot leak listeners. */
  const detach = useRef<(() => void) | null>(null);

  return useCallback((instance: T | null) => {
    detach.current?.();
    detach.current = null;

    if (Platform.OS !== 'web' || instance === null) return;

    const node = instance.getScrollableNode?.() as HTMLElement | undefined;
    if (!node?.addEventListener) return;

    detach.current = attach(node);
  }, []);
}
