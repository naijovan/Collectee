/**
 * Where the tour's targets are on screen.
 *
 * The walkthrough needs a rect for each thing it points at, and only the
 * component that renders a thing knows where it ended up. This is the register
 * they report to: a component calls `useTourAnchor('tab-import')`, gets a ref
 * callback, and puts it on the element it already renders.
 *
 * ── Why a ref callback and not a <TourTarget> wrapper ─────────────────────
 * A wrapper is an extra View in someone else's layout, and these targets live
 * inside flex rows with `flex: 1` children and gap-based columns — a wrapper
 * silently changes spacing or collapses a flex context. A ref costs the host
 * component one prop and changes no layout at all. That matters more than
 * usual here: two of the five targets are in components §13.3 puts under one
 * owner, during polish week.
 *
 * ── Why the hook no-ops without a provider ────────────────────────────────
 * `TabBar` and `AssistantButton` must not acquire a hard dependency on the
 * tour. Rendered outside the provider they get an inert ref callback and
 * behave exactly as before, so nothing about them is now conditional on a
 * §14-cuttable feature being mounted.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { View } from 'react-native';

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TourAnchorsValue {
  register: (id: string, node: View | null) => void;
  /**
   * The anchor the tour is currently presenting by LIFTING it, or null.
   *
   * Most targets are spotlighted by cutting a hole around them, which works
   * because they sit under the overlay. The assistant launcher does not: it
   * floats over the app, so a hole around it also reveals whatever content it
   * happens to be sitting on — at the last stop that was a bright item card
   * showing through the same lit window, and the launcher read as overlapping
   * rather than presented.
   *
   * Lifting solves it the other way round. The whole screen dims with no
   * cutout, and the target raises its own z-index above the overlay so it
   * floats alone on the scrim. Only the tour writes this; only a lifted target
   * reads it.
   */
  lifted: string | null;
  setLifted: (id: string | null) => void;
  /** Null when the id is unregistered or the node has no laid-out box yet. */
  measure: (id: string) => Promise<AnchorRect | null>;
  /** The union of several anchors, for a target that is more than one element. */
  measureUnion: (ids: readonly string[]) => Promise<AnchorRect | null>;
}

const TourAnchorsContext = createContext<TourAnchorsValue | null>(null);

export function TourAnchorsProvider({ children }: { children: ReactNode }) {
  /* A ref, not state: registering a node must not re-render the tree that just
     rendered it, and nothing reads this during render — only the overlay, and
     only inside an effect. */
  const nodes = useRef(new Map<string, View>());

  const [lifted, setLifted] = useState<string | null>(null);

  const register = useCallback((id: string, node: View | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);

  const measure = useCallback(
    (id: string) =>
      new Promise<AnchorRect | null>((resolve) => {
        const node = nodes.current.get(id);
        if (!node) return resolve(null);

        /* `measureInWindow` rather than `measure`: window coordinates on native
           and viewport coordinates on web, which is the space the overlay draws
           in. `measure` returns parent-relative values and would need the whole
           ancestor chain to be useful. */
        node.measureInWindow((x, y, width, height) => {
          // A zero box means "laid out but not yet sized", which happens for a
          // frame after a screen mounts. Null tells the caller to retry rather
          // than to draw a hole at the origin.
          if (!width || !height) return resolve(null);
          resolve({ x, y, width, height });
        });
      }),
    [],
  );

  const measureUnion = useCallback(
    async (ids: readonly string[]) => {
      const rects = (await Promise.all(ids.map(measure))).filter(
        (r): r is AnchorRect => r !== null,
      );
      if (rects.length === 0) return null;

      const left = Math.min(...rects.map((r) => r.x));
      const top = Math.min(...rects.map((r) => r.y));
      const right = Math.max(...rects.map((r) => r.x + r.width));
      const bottom = Math.max(...rects.map((r) => r.y + r.height));
      return { x: left, y: top, width: right - left, height: bottom - top };
    },
    [measure],
  );

  const value = useMemo(
    () => ({ register, measure, measureUnion, lifted, setLifted }),
    [register, measure, measureUnion, lifted],
  );

  return <TourAnchorsContext.Provider value={value}>{children}</TourAnchorsContext.Provider>;
}

/** For the overlay. Throws if used outside the provider, which would be a bug. */
export function useTourAnchors(): TourAnchorsValue {
  const value = useContext(TourAnchorsContext);
  if (!value) throw new Error('useTourAnchors must be used inside <TourAnchorsProvider>');
  return value;
}

/**
 * For a component that owns a target. Returns a ref callback to spread onto the
 * element it already renders — no wrapper, no layout change.
 *
 * Put `collapsable={false}` on the same element. Android flattens Views with no
 * background or handlers out of the native hierarchy, and a flattened View has
 * nothing to measure.
 *
 * Outside the provider this is inert, so no component that owns a target
 * acquires a dependency on the tour being mounted.
 */
export function useTourAnchor(id: string): (node: View | null) => void {
  const register = useContext(TourAnchorsContext)?.register;

  return useCallback(
    (node: View | null) => {
      register?.(id, node);
    },
    [id, register],
  );
}
