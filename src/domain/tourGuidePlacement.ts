/**
 * Where the tour guide stands, as pure geometry.
 *
 * In `domain/` rather than beside the component because it is exactly what
 * this layer is for: no React, no I/O, deterministic in and out. That also
 * makes it runnable from Node, which is how the five-stop placement frames
 * were rendered for review before anyone opened the app.
 *
 * The component consumes the boxes; it does not compute them.
 */

import type { LayoutRectangle } from 'react-native';

import { spacing } from '@/theme/theme';

/** Never smaller than this, whatever the viewport. Below it she is a sticker. */
export const MIN_HEIGHT = 240;
/**
 * Share of viewport height she aims for.
 *
 * The solver reduces from here when a region cannot hold her; it never grows
 * past it, and never goes under MIN_HEIGHT.
 */
export const TARGET_FRACTION = 0.44;
/** Floor on the share, so a very short window still gives her presence. */
export const MIN_FRACTION = 0.38;

/** Figure aspect: the poses are authored 768x1024. */
const FIGURE_ASPECT = 768 / 1024;

/** Reserved for the bubble when solving. Over-reserving costs a slightly
 *  smaller Colly; under-reserving lets the bubble hang off-screen. */
const BUBBLE_H = 200;
/** Bubble's preferred width, and the narrowest it may be squeezed to. */
const BUBBLE_W = 380;
const BUBBLE_MIN_W = 260;

/** Breathing room between Colly, the bubble, and the target's lit region. */
const GAP = spacing.md;
/** Matches TourOverlay's HOLE_PAD — the lit region is the rect plus this. */
const HOLE_PAD = 8;

/**
 * Which rung of the ladder produced a placement. Surfaced so a bad frame can
 * be read off a value instead of guessed at.
 *
 *   beside      full size, in a clear region next to the target
 *   shrunk      same region, reduced toward the 240 floor to fit
 *   relocated   no side had room; placed above or below instead
 *   bubbleOnly  no region holds her at the floor without covering the target,
 *               so the figure is dropped and only the bubble is placed
 *   solo        no target on this stop; centre-lower
 */
export type GuideFit = 'beside' | 'shrunk' | 'relocated' | 'bubbleOnly' | 'solo';

export interface GuidePlacement {
  /** Absolute box for the figure, or null on the bubbleOnly rung. */
  figure: { x: number; y: number; width: number; height: number } | null;
  /** Absolute box for the speech bubble. Height is content-driven. */
  bubble: { x: number; y: number; width: number };
  /**
   * Mirror the pose so the extended arm aims AT the target.
   *
   * The art points to the VIEWER'S RIGHT unflipped — verified against the
   * delivered PNG — so she is flipped only when she stands to the target's
   * right.
   */
  flipped: boolean;
  fit: GuideFit;
}

interface Box { x: number; y: number; w: number; h: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
const overlaps = (a: Box, b: Box) =>
  !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);

/**
 * Where the guide stands for a given stop.
 *
 * ── The rule this exists to enforce ───────────────────────────────────────
 * Neither Colly nor her bubble may cover the target's lit region. The first
 * version could not honour that: it aligned her to a SCREEN EDGE and gave the
 * bubble the full content width, so on a stop whose target sat centre or low
 * the bubble lay straight across it — the digest card and the tab bar both
 * vanished behind the thing describing them.
 *
 * This solves for real clear area. The target is inflated by its lit padding
 * plus a gap to give a blocked rect; the four bands around it are candidate
 * regions; each is asked how tall a figure it can hold, and the roomiest wins.
 *
 * ── Two arrangements per region ───────────────────────────────────────────
 * The bubble can sit UNDER her or BESIDE her, and the solver tries both. That
 * matters: the band below the news digest is wide and short, which fits
 * nothing stacked but comfortably fits her next to her bubble. Without the
 * side-by-side option that stop fell all the way to bubbleOnly and dropped
 * the character entirely.
 *
 * ── She hugs the target, not the region ───────────────────────────────────
 * Inside the winning region she is placed against the edge NEAREST the target
 * and level with it, so she stands beside the thing rather than in the far
 * corner of a large empty band. A raised arm means nothing from three hundred
 * pixels away.
 *
 * Pure, so the overlay, the figure and the bubble lay out against one answer
 * rather than three subtly different ones — and so the placement frames can be
 * rendered from Node before anyone opens the app.
 */
export function placeGuide(
  screen: { width: number; height: number },
  insets: { top: number; bottom: number },
  hole: LayoutRectangle | null,
): GuidePlacement {
  const M = spacing.lg;
  const safe: Box = {
    x: M,
    y: insets.top + M,
    w: screen.width - M * 2,
    h: screen.height - insets.top - insets.bottom - M * 2,
  };

  const ideal = Math.max(safe.h * TARGET_FRACTION, safe.h * MIN_FRACTION, MIN_HEIGHT);

  // ── No target: centre-lower, the classic solo composition ───────────────
  if (!hole) {
    const h = clamp(ideal, MIN_HEIGHT, Math.max(MIN_HEIGHT, safe.h - GAP - BUBBLE_H));
    const w = h * FIGURE_ASPECT;
    const bw = Math.min(BUBBLE_W, safe.w);
    const top = safe.y + Math.max(0, safe.h - (h + GAP + BUBBLE_H));
    return {
      figure: { x: safe.x + (safe.w - w) / 2, y: top, width: w, height: h },
      bubble: { x: safe.x + (safe.w - bw) / 2, y: top + h + GAP, width: bw },
      flipped: false,
      fit: 'solo',
    };
  }

  // ── Blocked: the lit region plus a gap. Nothing may enter this. ─────────
  const blocked: Box = {
    x: hole.x - HOLE_PAD - GAP,
    y: hole.y - HOLE_PAD - GAP,
    w: hole.width + (HOLE_PAD + GAP) * 2,
    h: hole.height + (HOLE_PAD + GAP) * 2,
  };
  const holeCx = hole.x + hole.width / 2;
  const holeCy = hole.y + hole.height / 2;

  type Name = 'left' | 'right' | 'above' | 'below';
  const regions: { name: Name; box: Box }[] = [
    { name: 'left', box: { x: safe.x, y: safe.y, w: blocked.x - safe.x, h: safe.h } },
    {
      name: 'right',
      box: {
        x: blocked.x + blocked.w,
        y: safe.y,
        w: safe.x + safe.w - (blocked.x + blocked.w),
        h: safe.h,
      },
    },
    { name: 'above', box: { x: safe.x, y: safe.y, w: safe.w, h: blocked.y - safe.y } },
    {
      name: 'below',
      box: {
        x: safe.x,
        y: blocked.y + blocked.h,
        w: safe.w,
        h: safe.y + safe.h - (blocked.y + blocked.h),
      },
    },
  ];

  /** Tallest figure a region can hold, and how the bubble has to sit. */
  const solve = (r: Box) => {
    if (r.w <= 0 || r.h <= 0) return { height: 0, side: 'under' as const };
    const stacked = Math.min(ideal, r.h - GAP - BUBBLE_H, r.w / FIGURE_ASPECT);
    const beside = Math.min(
      ideal,
      r.h,
      Math.max(0, r.w - GAP - BUBBLE_MIN_W) / FIGURE_ASPECT,
    );
    return stacked >= beside
      ? { height: stacked, side: 'under' as const }
      : { height: beside, side: 'beside' as const };
  };

  const scored = regions
    .map((r) => ({ ...r, ...solve(r.box) }))
    .filter((r) => r.height >= MIN_HEIGHT)
    /* Sides first at equal height: standing next to something and pointing
       sideways reads better than hovering over it and pointing sideways. */
    .sort((a, b) => b.height - a.height || (a.name === 'left' || a.name === 'right' ? -1 : 1));

  const best = scored[0];

  // ── Last rung: nothing holds her at the floor. Drop the figure. ─────────
  if (!best) {
    const band = regions.slice().sort((a, b) => b.box.h * b.box.w - a.box.h * a.box.w)[0]!;
    const bw = clamp(BUBBLE_W, BUBBLE_MIN_W, Math.max(BUBBLE_MIN_W, band.box.w));
    return {
      figure: null,
      bubble: {
        /* Clamped into the BAND, not merely the safe area — clamping to the
           screen let it drift back over the target. */
        x: clamp(holeCx - bw / 2, band.box.x, band.box.x + band.box.w - bw),
        y: clamp(band.box.y + (band.box.h - BUBBLE_H) / 2, band.box.y, band.box.y + Math.max(0, band.box.h - BUBBLE_H)),
        width: bw,
      },
      flipped: holeCx < screen.width / 2,
      fit: 'bubbleOnly',
    };
  }

  const h = best.height;
  const w = h * FIGURE_ASPECT;
  const r = best.box;
  const bw = clamp(BUBBLE_W, BUBBLE_MIN_W, Math.max(BUBBLE_MIN_W, best.side === 'beside' ? r.w - w - GAP : r.w));

  /* Hug the edge nearest the target and sit level with it, then clamp the
     FIGURE alone into its region — the bubble is placed afterwards around
     wherever she ended up, so a tight band pushes the bubble rather than
     shoving her away from the thing she is pointing at. */
  let fx = best.name === 'left' ? r.x + r.w - w : best.name === 'right' ? r.x : holeCx - w / 2;
  let fy = best.name === 'above' ? r.y + r.h - h : best.name === 'below' ? r.y : holeCy - h / 2;
  fx = clamp(fx, r.x, r.x + r.w - w);
  fy = clamp(fy, r.y, r.y + r.h - h);

  /* Bubble: under her when there is room, beside her when the band is short,
     above her when she is already at the floor. Whichever it lands on, it is
     clamped into the region and checked against the target. */
  let bx: number;
  let by: number;
  if (best.side === 'beside') {
    const toRight = fx + w + GAP + bw <= r.x + r.w;
    bx = toRight ? fx + w + GAP : fx - GAP - bw;
    by = clamp(fy + h / 2 - BUBBLE_H / 2, r.y, r.y + Math.max(0, r.h - BUBBLE_H));
  } else if (fy + h + GAP + BUBBLE_H <= r.y + r.h) {
    bx = fx + w / 2 - bw / 2;
    by = fy + h + GAP;
  } else {
    bx = fx + w / 2 - bw / 2;
    by = fy - GAP - BUBBLE_H;
  }
  bx = clamp(bx, r.x, r.x + r.w - bw);
  by = clamp(by, r.y, r.y + Math.max(0, r.h - BUBBLE_H));

  /* Belt and braces. The region maths should make this unreachable, but the
     rule is "never covers the target", not "should not". */
  const bubbleBox: Box = { x: bx, y: by, w: bw, h: BUBBLE_H };
  if (overlaps(bubbleBox, blocked)) {
    by = blocked.y + blocked.h + GAP <= safe.y + safe.h - BUBBLE_H
      ? blocked.y + blocked.h + GAP
      : blocked.y - GAP - BUBBLE_H;
    by = clamp(by, safe.y, safe.y + safe.h - BUBBLE_H);
  }

  return {
    figure: { x: fx, y: fy, width: w, height: h },
    bubble: { x: bx, y: by, width: bw },
    flipped: fx + w / 2 > holeCx,
    fit:
      best.name === 'above' || best.name === 'below'
        ? 'relocated'
        : h < ideal - 1
          ? 'shrunk'
          : 'beside',
  };
}
