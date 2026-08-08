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

/** The size she should not go below on a viewport with room for her. */
export const MIN_HEIGHT = 240;

/**
 * The size below which she genuinely stops reading as a character.
 *
 * MIN_HEIGHT is a preference; this is the actual floor. On a 427pt-tall window
 * — a laptop with DevTools docked — the 240 preference could not be met on
 * three of five stops and she was dropped entirely, so the guided tour lost its
 * guide on exactly the screens where a presenter is most likely to be looking.
 * Small-but-present beats absent.
 */
const HARD_FLOOR = 150;
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
export interface GuideOptions {
  /**
   * Stand beside this target even though it is bottom-anchored.
   *
   * The midline rule exists because a target pinned to the bottom is usually
   * WIDE — the tab bar spans the screen, so anywhere beside it is also on top
   * of it. The assistant launcher is the exception: it is 56pt in a corner,
   * with the whole rest of the row free, so she can stand next to it and
   * gesture across without covering anything. Forcing her to the upper half
   * there loses the finale's whole point, which is her standing where the
   * launcher lives.
   */
  standBeside?: boolean;
  /**
   * Force the bubble onto a given flank, beside her at her vertical centre,
   * instead of letting the solver choose.
   *
   * The solver's default — away from the pointing arm — is right most of the
   * time, but "most of the time" is not good enough for a stop being judged
   * frame by frame. Two stops need an explicit answer: Import wants it on her
   * right so it stops sitting over the Gaming Updates row, and Discover wants
   * it on her left to keep the Verify and Reports buttons in the top-right
   * corner clear.
   *
   * Still checked against the target and the safe area — this chooses between
   * legal positions, it cannot force an illegal one.
   */
  bubbleSide?: 'left' | 'right';
  /**
   * Align the bubble's TOP with hers instead of its centre with hers.
   *
   * Used where the pair has to sit tight under something — on Discover the
   * highlighted band is at the very top of the screen, so centring the bubble
   * on her dropped it a hundred points lower than it needed to be for no
   * reason.
   */
  bubbleAlign?: 'top' | 'centre';
  /**
   * Hard ceiling on how far down anything in the guided layer may reach, as a
   * fraction of the safe area.
   *
   * Belt and braces rather than a new behaviour: a bottom-anchored stop is
   * already capped at the midline, which is stricter. This exists so the
   * guarantee is stated on the stop rather than inferred from whether the
   * solver happened to classify the target as bottom-anchored.
   */
  maxBottomFraction?: number;
  /**
   * Sit in the band DIRECTLY above the target, hugging it.
   *
   * The bottom-anchored rule keeps her off a low target by capping everything
   * at the midline — safe, but it parks her at the top of the screen, a long
   * way from what she is introducing. `hugAbove` keeps the same guarantee (she
   * is above the target, never on it) while dropping the cap, so the band runs
   * right down to the target's edge and she stands on top of it.
   *
   * The bubble's bounds follow the same band, so it cannot slip below her onto
   * the bar. Pair this with `bubbleSide` — beside her is the only arrangement
   * that fits when she is already flush against the target.
   */
  hugAbove?: boolean;
}

export function placeGuide(
  screen: { width: number; height: number },
  insets: { top: number; bottom: number },
  hole: LayoutRectangle | null,
  options: GuideOptions = {},
): GuidePlacement {
  const M = spacing.lg;
  const safe: Box = {
    x: M,
    y: insets.top + M,
    w: screen.width - M * 2,
    h: screen.height - insets.top - insets.bottom - M * 2,
  };

  const ideal = Math.max(safe.h * TARGET_FRACTION, safe.h * MIN_FRACTION, MIN_HEIGHT);

  /**
   * The smallest she may be on THIS viewport.
   *
   * Stays at MIN_HEIGHT wherever there is room for it, and only relaxes toward
   * HARD_FLOOR when the viewport itself is too short to hold her — never
   * because a region happens to be tight on a big screen.
   */
  const floor = Math.min(MIN_HEIGHT, Math.max(HARD_FLOOR, safe.h * 0.42));

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

  /**
   * Is the target bolted to the bottom of the screen?
   *
   * The tab bar, the Import tab inside it and the assistant launcher all are.
   * They share a failure the solver alone cannot prevent: Colly is drawn ON TOP
   * of the overlay, cutout included, so if she is placed anywhere across the
   * bottom she covers the lit region even when the maths says she is beside the
   * target. That is what buried the Import tab — the hole was cut correctly and
   * she stood over it.
   *
   * So this is a hard constraint, deliberately independent of the region
   * scoring: a bottom-anchored target confines her to the upper half, full
   * stop. An error in the measured rect can then still misplace her sideways,
   * but it can no longer park her on the thing she is presenting.
   */
  const midline = safe.y + safe.h / 2;
  const bottomAnchored =
    !options.standBeside && hole.y + hole.height > safe.y + safe.h * 0.72;

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

  /* Bottom-anchored: only the band above the target is eligible, and it is
     further capped at the midline so her feet never cross it. */
  const cappedTo = (box: Box, fraction: number): Box => ({
    ...box,
    h: Math.max(0, Math.min(box.h, safe.y + safe.h * fraction - box.y)),
  });

  const applyCeiling = (box: Box): Box =>
    options.maxBottomFraction === undefined ? box : cappedTo(box, options.maxBottomFraction);

  const cappedAbove = (box: Box): Box => ({
    ...box,
    h: Math.max(0, Math.min(box.h, midline - box.y)),
  });

  /* `hugAbove` wins over the midline cap: same band, uncapped, so its bottom
     edge is the target rather than the middle of the screen. `blocked` still
     defines where that band ends, so the no-overlap guarantee is untouched. */
  /**
   * In hug mode the band stops a further GAP short of the target.
   *
   * `blocked` is already the target plus its lit padding, but on the Import
   * stop the target sits INSIDE the tab bar, so hugging `blocked` alone left
   * her 7pt above the bar's own top edge — legal, and too tight to read as
   * deliberate. One more gap makes it a margin rather than a near miss.
   */
  const hugInset = (box: Box): Box => ({ ...box, h: Math.max(0, box.h - GAP) });

  const aboveOnly = regions.filter((r) => r.name === 'above');
  const eligible = (
    options.hugAbove
      ? aboveOnly.map((r) => ({ ...r, box: hugInset(r.box) }))
      : bottomAnchored
        ? aboveOnly.map((r) => ({ ...r, box: cappedAbove(r.box) }))
        : regions
  ).map((r) => ({ ...r, box: applyCeiling(r.box) }));

  /**
   * Where the BUBBLE is allowed to live.
   *
   * On a bottom-anchored stop it is held to the same capped band as the
   * figure. The constraint used to cover her only, so she moved up top and the
   * bubble stayed behind — squarely over the tab bar and the Import button it
   * was describing. Nothing in the guided layer may cover a target, and the
   * bubble carries the controls, so it is the worst thing to lose behind one.
   *
   * The midline is always above the floating tab bar (the bar sits within
   * ~96pt of the bottom), so capping there clears the bar's band as well
   * without this module needing to know the bar exists.
   */
  let bubbleBounds: Box = applyCeiling(
    options.hugAbove
      ? /* The same band she is in: from the top of the safe area down to the
           target's edge, less the hug margin. Keeps the bubble off the bar
           without pinning it to the midline. */
        hugInset({ ...safe, h: Math.max(0, blocked.y - safe.y) })
      : bottomAnchored
        ? cappedAbove(safe)
        : safe,
  );

  const rank = (list: typeof regions) =>
    list
      .map((r) => ({ ...r, ...solve(r.box) }))
      .filter((r) => r.height >= floor)
      /* Sides first at equal height: standing next to something and pointing
         sideways reads better than hovering over it and pointing sideways. */
      .sort((a, b) => b.height - a.height || (a.name === 'left' || a.name === 'right' ? -1 : 1));

  let best = rank(eligible)[0];

  /**
   * Rung before dropping her: give up the midline, keep the target.
   *
   * On a short viewport the capped band above a bottom-anchored target holds
   * nothing, and the old ladder went straight to bubbleOnly. Overlapping the
   * tab bar — chrome, not the subject of the stop — is a far smaller cost than
   * the guide vanishing. The target itself is still off limits: `blocked` is
   * what defines every region, relaxed or not.
   */
  let relaxed = false;
  if (!best && bottomAnchored) {
    best = rank(regions)[0];
    relaxed = best !== undefined;
  }

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

  /* Relaxed: the bubble follows her out of the capped band, or it would be
     solving against a region she is no longer in. */
  if (relaxed) bubbleBounds = applyCeiling(safe);

  const h = best.height;
  const w = h * FIGURE_ASPECT;
  const r = best.box;

  /* Hug the edge nearest the target and sit level with it, then clamp the
     FIGURE alone into its region — the bubble is placed afterwards around
     wherever she ended up, so a tight band pushes the bubble rather than
     shoving her away from the thing she is pointing at. */
  /**
   * Above and below used to centre her on the target, which put her centre of
   * mass exactly on its centre line — and the pose only points sideways, so the
   * arm aimed at nothing. She is offset to one side of the target's centre
   * instead, far enough to read as "beside", and the flip below then aims her
   * back across it. Pointing along a wide target beats pointing off-screen.
   */
  const sideOffset = GAP * 2;
  /* Of the two ways to stand beside the target's centre line, take the one
     that leaves the most room OUTSIDE her — that outer space is where the
     bubble goes, and a bubble on the inside would sit under her pointing arm,
     so she reads as gesturing at her own dialogue. */
  const outerIfRight = r.x + r.w - (holeCx + sideOffset + w);
  const outerIfLeft = holeCx - sideOffset - w - r.x;
  let fx =
    best.name === 'left'
      ? r.x + r.w - w
      : best.name === 'right'
        ? r.x
        : outerIfRight >= outerIfLeft
          ? holeCx + sideOffset
          : holeCx - sideOffset - w;
  let fy = best.name === 'above' ? r.y + r.h - h : best.name === 'below' ? r.y : holeCy - h / 2;
  fx = clamp(fx, r.x, r.x + r.w - w);
  fy = clamp(fy, r.y, r.y + r.h - h);

  /* Bubble: under her when there is room, beside her when the band is short,
     above her when she is already at the floor. Whichever it lands on, it is
     clamped into the region and checked against the target. */
  /**
   * The bubble is placed around wherever she ended up, and is allowed to leave
   * her region — it only has to stay inside the safe area and out of the
   * blocked rect. Confining it to the region was too strict: with the figure
   * capped at the midline on a bottom-anchored stop, no region holds both, and
   * the bubble has a perfectly good home just below her.
   */
  /* Sized to whatever the chosen side actually has, down to the minimum,
     rather than a fixed width that then fails to fit and forces the bubble
     back across her. */
  const roomRightOfFigure = bubbleBounds.x + bubbleBounds.w - (fx + w);
  const roomLeftOfFigure = fx - bubbleBounds.x;
  const outerRoom =
    options.bubbleSide === 'right'
      ? roomRightOfFigure
      : options.bubbleSide === 'left'
        ? roomLeftOfFigure
        : fx + w / 2 > holeCx
          ? roomRightOfFigure
          : roomLeftOfFigure;
  const bw = clamp(BUBBLE_W, BUBBLE_MIN_W, Math.max(BUBBLE_MIN_W, outerRoom - GAP));

  const inBounds = (bx0: number, by0: number) =>
    bx0 >= bubbleBounds.x && by0 >= bubbleBounds.y &&
    bx0 + bw <= bubbleBounds.x + bubbleBounds.w &&
    by0 + BUBBLE_H <= bubbleBounds.y + bubbleBounds.h;

  const centredX = clamp(
    fx + w / 2 - bw / 2,
    bubbleBounds.x,
    bubbleBounds.x + bubbleBounds.w - bw,
  );
  /* 'top' lines the bubble up with her head rather than her waist. */
  const besideY = options.bubbleAlign === 'top' ? fy : fy + h / 2 - BUBBLE_H / 2;
  const midY = clamp(
    besideY,
    bubbleBounds.y,
    bubbleBounds.y + Math.max(0, bubbleBounds.h - BUBBLE_H),
  );

  /* Away-side first: she points toward the target, so the bubble belongs on
     her other flank. `pointsLeft` mirrors the flip computed below. */
  const pointsLeft = fx + w / 2 > holeCx;
  const away: [number, number] = pointsLeft ? [fx + w + GAP, midY] : [fx - GAP - bw, midY];
  const toward: [number, number] = pointsLeft ? [fx - GAP - bw, midY] : [fx + w + GAP, midY];

  /* An explicit side wins, then the solver's own preference as fallback. */
  const forced: [number, number] | null =
    options.bubbleSide === 'right'
      ? [fx + w + GAP, midY]
      : options.bubbleSide === 'left'
        ? [fx - GAP - bw, midY]
        : null;

  const candidates: [number, number][] = [
    ...(forced ? [forced] : []),
    ...(best.side === 'beside'
      ? [away, [centredX, fy + h + GAP] as [number, number], [centredX, fy - GAP - BUBBLE_H] as [number, number], toward]
      : [[centredX, fy + h + GAP] as [number, number], [centredX, fy - GAP - BUBBLE_H] as [number, number], away, toward]),
  ];

  /* Fallback is inside the bounds too — clamping to the safe area is what let
     it drift back down over the bar. */
  let bx = centredX;
  let by = clamp(
    fy + h + GAP,
    bubbleBounds.y,
    bubbleBounds.y + Math.max(0, bubbleBounds.h - BUBBLE_H),
  );
  for (const [cx, cy] of candidates) {
    if (inBounds(cx, cy) && !overlaps({ x: cx, y: cy, w: bw, h: BUBBLE_H }, blocked)) {
      bx = cx;
      by = cy;
      break;
    }
  }

  /**
   * The arm follows the BUBBLE, not the target.
   *
   * It used to follow the target, which is defensible in isolation and wrong
   * in practice: the bubble is deliberately placed on her far flank so it does
   * not sit under the gesture, so target-following pointed her away from the
   * thing the viewer is actually reading. On Import and News she stood with
   * her bubble on the right and her arm thrown out to the left.
   *
   * She is beside the target in every arrangement anyway — the cutout, the
   * ring and the pulse are what identify it. The arm's job is to tie her to
   * her own words.
   *
   * When the bubble is centred on her (stacked above or below, no side to
   * speak of) there is nothing to point at, so it falls back to the target.
   */
  const figureCx = fx + w / 2;
  const bubbleCx = bx + bw / 2;
  const bubbleIsBeside = Math.abs(bubbleCx - figureCx) > w / 4;
  const flipped = bubbleIsBeside ? bubbleCx < figureCx : figureCx > holeCx;

  return {
    figure: { x: fx, y: fy, width: w, height: h },
    bubble: { x: bx, y: by, width: bw },
    flipped,
    fit:
      best.name === 'above' || best.name === 'below'
        ? 'relocated'
        : relaxed || h < ideal - 1
        ? 'shrunk'
        : 'beside',
  };
}
