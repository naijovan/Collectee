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
  GameTitle,
  Item,
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
      case 'discarded': {
        discarded += 1;
        /**
         * A discarded detection contributes nothing UNLESS the user explicitly
         * confirmed it. The Review screen offers that only when the whole scan
         * was discarded — otherwise the screen is a dead end that says it read
         * something and gives no way to act on it.
         *
         * Counted here rather than only in `resolvedItemIds` because the CTA
         * reads `confirmed`, and a total that disagrees with what actually
         * imports is the §11 F1 reconciliation bug all over again.
         */
        const resolution = resolvedById.get(d.id);
        if (resolution && resolution.itemId !== null) resolvedConfirmed += 1;
        break;
      }
      case 'unmatched': {
        unmatched += 1;
        /* Confirmed cross-game reads count toward the CTA, the same way a
           resolved needs-review or a rescued discard does. Without this the
           button would promise fewer items than the import writes. */
        const resolution = resolvedById.get(d.id);
        if (resolution && resolution.itemId !== null) resolvedConfirmed += 1;
        break;
      }
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
    } else if (
      d.outcome === 'needs_review' ||
      d.outcome === 'discarded' ||
      d.outcome === 'unmatched'
    ) {
      /**
       * All three import ONLY on an explicit confirmation, so an unresolved
       * one still contributes nothing — the floor and the catalogue check are
       * both untouched.
       *
       * `unmatched` joins them because "not in the catalogue for the game you
       * picked" is not the same as "not in the catalogue". A Valorant knife
       * read during a CODM scan has no CODM match by construction — the
       * scanner is only ever given one title's items — but the item exists,
       * and a user who is shown it and says "yes, that one" should get it
       * rather than be told to start again.
       */
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

/* ────────────────────────────────────────────────────────────────────────────
   Wrong-game detection

   The scan is already hard-scoped to the chosen title: the live path is handed
   only that game's catalogue, and the prepared path is keyed by title. So a
   Valorant skin in a CODM scan CANNOT be mis-matched to a CODM item — it is
   structurally impossible, not a heuristic that might slip.

   What it does instead is land in "Not in catalogue", which is correct and
   completely unhelpful: the screen says we could not match it without saying
   the one thing the user needs to hear, which is that they picked the wrong
   game two screens ago.

   This closes that gap, and it does so with a local catalogue lookup rather
   than a model call. Every title's catalogue is already in memory, so an exact
   name match answers "these are Valorant items" deterministically, offline and
   instantly — a model would be slower, cost money, need network during a demo
   that §12.1 says has none, and give a WORSE answer, because this is a lookup
   against the real catalogue rather than a guess about one.
   ──────────────────────────────────────────────────────────────────────────── */

/** One title that the unread items appear to belong to instead. */
export interface ForeignTitleMatch {
  title: GameTitle;
  /**
   * The readings that matched an item in this title.
   *
   * `detectionId` travels with each one so the caller can write a resolution
   * against it — confirming a cross-game read imports the item directly rather
   * than sending the user back to re-scan the same picture.
   */
  matches: { detectionId: string; reading: string; itemId: string; itemName: string }[];
}

/**
 * Comparable form of a name: lowercase, punctuation to spaces, collapsed.
 * "Elderflame Vandal" and "elderflame  vandal!" have to be the same string.
 */
function normalise(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Tokens worth comparing. Short fragments are dropped because they carry no
 * signal and are what turn a strict match into a guess — "of", "the", and the
 * stray one- and two-character noise OCR produces at tile edges.
 */
function significantTokens(name: string): string[] {
  return normalise(name)
    .split(' ')
    .filter((token) => token.length >= 3);
}

/**
 * Which other titles the unmatched readings look like they came from.
 *
 * Deliberately strict, and the strictness is the point. Telling someone "these
 * are actually Valorant items, switch?" is a strong claim that moves them back
 * two steps and re-runs the scan; a false positive there is far more expensive
 * than staying quiet. So a reading counts only on an exact normalised name
 * match, or on sharing at least two significant tokens with a catalogue name.
 * One shared token would let every "… Vandal" match every other "… Vandal".
 *
 * `catalogue` is passed in rather than imported: this file is pure domain and
 * the caller already has the items (CLAUDE.md — no I/O in `src/domain`).
 *
 * Returns at most one entry per title, ordered by how many readings matched,
 * so the caller can name the strongest candidate without re-sorting.
 */
export function foreignTitleMatches(
  readings: readonly { detectionId: string; name: string }[],
  catalogue: readonly Item[],
  selected: GameTitle,
): ForeignTitleMatch[] {
  if (readings.length === 0) return [];

  const byTitle = new Map<GameTitle, ForeignTitleMatch['matches']>();

  for (const { detectionId, name: reading } of readings) {
    const readingNormal = normalise(reading);
    if (readingNormal.length === 0) continue;
    const readingTokens = new Set(significantTokens(reading));

    for (const item of catalogue) {
      if (item.title === selected) continue;

      const itemNormal = normalise(item.name);
      let hit = itemNormal === readingNormal;

      if (!hit) {
        let shared = 0;
        for (const token of significantTokens(item.name)) {
          if (readingTokens.has(token)) shared += 1;
        }
        hit = shared >= 2;
      }

      if (!hit) continue;

      const existing = byTitle.get(item.title);
      const match = { detectionId, reading, itemId: item.id, itemName: item.name };
      if (existing) {
        // One entry per DETECTION per title — keyed on the detection rather
        // than the text, so two tiles that happen to read the same still each
        // get a row to confirm.
        if (!existing.some((m) => m.detectionId === detectionId)) existing.push(match);
      } else {
        byTitle.set(item.title, [match]);
      }
      break;
    }
  }

  return [...byTitle.entries()]
    .map(([title, matches]) => ({ title, matches }))
    .sort((a, b) => b.matches.length - a.matches.length);
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
