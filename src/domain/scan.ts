/**
 * Scanner routing and count reconciliation — PRD §11 F1.
 *
 * Every count in the Import flow is DERIVED here from `detections`. Nothing
 * hand-writes a total. This exists because the Figma shipped a reconciliation
 * bug (42 detected = 34 + 5 + 3, a CTA reading "Import 39 confirmed items"
 * before the 5 were resolved, and a completion screen totalling 44) and the
 * acceptance criteria require it to be fixed in design AND fixtures.
 */

import type {
  Confidence,
  ScanCounts,
  ScanDetection,
  ScanOutcome,
  ScanResolution,
  ScanResult,
} from '@/types';

/** §11 F1 step 4 — confidence routing thresholds. */
export const CONFIDENCE_AUTO_ACCEPT = 0.9;
export const CONFIDENCE_REVIEW_FLOOR = 0.6;

/**
 * Route a raw detection by confidence alone.
 * Deduplication is a separate, later step (§11 F1 step 5) — it can only
 * downgrade a result to `duplicate`, never change this classification.
 */
export function routeByConfidence(confidence: Confidence): Exclude<ScanOutcome, 'duplicate'> {
  if (confidence >= CONFIDENCE_AUTO_ACCEPT) return 'matched';
  if (confidence >= CONFIDENCE_REVIEW_FLOOR) return 'needs_review';
  return 'discarded';
}

/**
 * Apply routing + cross-frame dedup to raw detections, in pipeline order.
 * The first occurrence of an item id wins; later frames become `duplicate`.
 *
 * Fixtures store `outcome` for readability, but this function is what the
 * service actually runs, so a fixture whose confidence and outcome disagree is
 * corrected rather than trusted. The live path relies on the same thing: the
 * model is asked for a confidence, never for an outcome, so a model that
 * invented `"outcome": "matched"` could not put it on screen.
 *
 * Order matters and is the pipeline's:
 *   1. below the floor        → discarded, whatever else is true of it
 *   2. no item, but a reading → unmatched  (read fine, not in the catalogue)
 *   3. no item, no reading    → discarded  (nothing was read at all)
 *   4. item seen already      → duplicate
 *   5. otherwise              → matched / needs_review by confidence
 *
 * Step 1 sits above step 2 on purpose: a low-confidence reading is not
 * evidence that an item exists and we don't stock it, it is evidence that we
 * misread a tile. Only confident readings earn `unmatched`.
 */
export function routeDetections(detections: ScanDetection[]): ScanDetection[] {
  const seen = new Set<string>();
  return detections.map((detection) => {
    const routed = routeByConfidence(detection.confidence);
    if (routed === 'discarded') {
      return { ...detection, outcome: 'discarded' as const };
    }
    if (detection.itemId === null) {
      return {
        ...detection,
        outcome: detection.reading ? ('unmatched' as const) : ('discarded' as const),
      };
    }
    if (seen.has(detection.itemId)) {
      return { ...detection, outcome: 'duplicate' as const };
    }
    seen.add(detection.itemId);
    return { ...detection, outcome: routed };
  });
}

/**
 * Derive every count the Import flow displays.
 *
 * Invariant (PRD acceptance criteria):
 *   detected === matched + needsReview + duplicates
 * `discarded` is deliberately outside `detected` — those are surfaced
 * separately as "N items we couldn't read". `unmatched` is outside it for the
 * same reason and surfaced on its own line: they were read, so they are not
 * unreadable, but they cannot be imported, so counting them as detected would
 * put a number on screen that the Import CTA can never reach.
 *
 * `confirmed` is what the CTA prints. It starts at `matched`, grows as the user
 * resolves Needs Review items, and shrinks as they remove auto-accepted ones,
 * so the button never claims a total the user has not agreed to.
 *
 * `matched` deliberately does NOT shrink when the user removes an auto-accepted
 * item. It is a fact about what the scanner found, and `detected` is built from
 * it — a headline reading "24 items detected" must not drop to 23 because the
 * user unticked one. Removal moves the number in `confirmed` only.
 */
export function countScan(
  detections: ScanDetection[],
  resolutions: ScanResolution[] = [],
): ScanCounts {
  const routed = routeDetections(detections);
  const resolvedById = new Map(resolutions.map((r) => [r.detectionId, r]));

  let matched = 0;
  let matchedRemoved = 0;
  let needsReview = 0;
  let duplicates = 0;
  let discarded = 0;
  let unmatched = 0;
  let resolvedConfirmed = 0;

  for (const d of routed) {
    switch (d.outcome) {
      case 'matched': {
        matched += 1;
        // A resolution on a matched detection can only be a removal (§11 F1).
        const resolution = resolvedById.get(d.id);
        if (resolution && resolution.itemId === null) matchedRemoved += 1;
        break;
      }
      case 'needs_review': {
        needsReview += 1;
        const resolution = resolvedById.get(d.id);
        if (resolution && resolution.itemId !== null) resolvedConfirmed += 1;
        break;
      }
      case 'duplicate':
        duplicates += 1;
        break;
      case 'discarded':
        discarded += 1;
        break;
      case 'unmatched':
        unmatched += 1;
        break;
    }
  }

  return {
    detected: matched + needsReview + duplicates,
    matched,
    needsReview,
    duplicates,
    discarded,
    unmatched,
    confirmed: matched - matchedRemoved + resolvedConfirmed,
  };
}

/** True when every Needs Review detection has a decision. Gates the Import CTA. */
export function isScanFullyResolved(
  detections: ScanDetection[],
  resolutions: ScanResolution[],
): boolean {
  const routed = routeDetections(detections);
  const decided = new Set(resolutions.map((r) => r.detectionId));
  return routed.filter((d) => d.outcome === 'needs_review').every((d) => decided.has(d.id));
}

/**
 * The item ids that will actually be imported: auto-accepted matches the user
 * did not remove, plus user-confirmed Needs Review items. Duplicates and
 * discards never enter.
 *
 * "No ambiguous item enters a collection silently." — §11 F1 acceptance criteria
 * "Every auto-accepted item is reversible in Review." — same list, which is why
 * a removal resolution has to be honoured here and not just in the count.
 */
export function resolvedItemIds(
  detections: ScanDetection[],
  resolutions: ScanResolution[] = [],
): string[] {
  const routed = routeDetections(detections);
  const resolvedById = new Map(resolutions.map((r) => [r.detectionId, r]));
  const ids: string[] = [];

  for (const d of routed) {
    if (d.outcome === 'matched' && d.itemId !== null) {
      if (isRemoved(resolvedById, d.id)) continue;
      ids.push(d.itemId);
    } else if (d.outcome === 'needs_review') {
      const resolution = resolvedById.get(d.id);
      if (resolution?.itemId != null) ids.push(resolution.itemId);
    }
  }
  return Array.from(new Set(ids));
}

/** True when the user explicitly removed an auto-accepted detection. */
function isRemoved(
  resolvedById: ReadonlyMap<string, ScanResolution>,
  detectionId: string,
): boolean {
  const resolution = resolvedById.get(detectionId);
  return resolution !== undefined && resolution.itemId === null;
}

/**
 * Whether an auto-accepted detection is currently included in the import.
 * The Review screen drives its tick state from this rather than tracking a
 * parallel set, so the checkbox and the CTA count can never disagree.
 */
export function isMatchIncluded(
  detectionId: string,
  resolutions: readonly ScanResolution[],
): boolean {
  const resolution = resolutions.find((r) => r.detectionId === detectionId);
  return resolution === undefined || resolution.itemId !== null;
}

/**
 * Dev-time guard. Throws if a fixture's stored outcomes disagree with what the
 * routing thresholds produce, so an inconsistent fixture fails loudly at build
 * time instead of shipping a wrong number to the stage.
 */
export function assertScanConsistent(result: ScanResult): void {
  const routed = routeDetections(result.detections);
  const mismatches = routed.filter((d, i) => d.outcome !== result.detections[i]!.outcome);
  if (mismatches.length > 0) {
    const detail = mismatches
      .map((d, i) => `${d.id}: stored=${result.detections[i]!.outcome} derived=${d.outcome}`)
      .join(', ');
    throw new Error(`Scan fixture "${result.id}" has inconsistent outcomes — ${detail}`);
  }
  const counts = countScan(result.detections);
  if (counts.detected !== counts.matched + counts.needsReview + counts.duplicates) {
    throw new Error(`Scan fixture "${result.id}" fails the detected-count invariant`);
  }
}
