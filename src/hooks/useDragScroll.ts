/**
 * Click-and-drag panning for horizontal rails, on web.
 *
 * A `FlatList horizontal` renders as an `overflow-x` container in the browser.
 * That gives wheel and trackpad scrolling, and nothing at all for a mouse drag
 * — browsers do not pan overflow containers by dragging. On a laptop trackpad
 * the rails feel fine; on a desktop with a mouse they look stuck, because the
 * obvious gesture does nothing.
 *
 * Native needs none of this: touch already pans a ScrollView, and the effect
 * bails on the first line.
 *
 * Returns a ref to spread onto the list.
 */

import { useCallback, useEffect, useRef } from 'react';
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

export function useDragScroll<T extends Scrollable>() {
  const ref = useRef<T | null>(null);
  /** Set while a drag is in flight, read by the click suppressor. */
  const dragged = useRef(false);

  const attach = useCallback((node: HTMLElement) => {
    let down = false;
    let startX = 0;
    let startScroll = 0;

    const onPointerDown = (event: PointerEvent) => {
      /* Primary button only. A right-click or a middle-click drag is the
         browser's to handle, not ours. */
      if (event.button !== 0) return;
      down = true;
      dragged.current = false;
      startX = event.clientX;
      startScroll = node.scrollLeft;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!down) return;
      const delta = event.clientX - startX;
      if (!dragged.current && Math.abs(delta) < DRAG_THRESHOLD) return;

      if (!dragged.current) {
        dragged.current = true;
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
      node.style.cursor = '';
      node.style.userSelect = '';
      /* Cleared on the next frame, not here: the click event fires after
         pointerup, and the suppressor below has to still see the flag. */
      if (dragged.current) requestAnimationFrame(() => (dragged.current = false));
    };

    /** Swallow the click that ends a drag, so panning never opens a card. */
    const onClick = (event: MouseEvent) => {
      if (!dragged.current) return;
      event.stopPropagation();
      event.preventDefault();
    };

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
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = ref.current?.getScrollableNode?.() as HTMLElement | undefined;
    if (!node?.addEventListener) return;

    node.style.cursor = 'grab';
    const detach = attach(node);
    return () => {
      detach();
      node.style.cursor = '';
    };
  }, [attach]);

  return ref;
}
