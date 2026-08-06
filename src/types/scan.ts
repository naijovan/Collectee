/**
 * AI Inventory Scanner types — PRD §11 F1.
 *
 * The pipeline described in F1 was SPECIFIED, NOT BUILT (§12.1) — the demo
 * served canned results from fixtures behind timed loading states. It is now
 * built as well: `FEATURES.liveScan` routes the uploaded image through the same
 * `/api/assistant` proxy the summariser uses, and the fixture is the fallback
 * for every failure. These types describe both paths, because they are the same
 * contract — that was the point of writing them this way.
 */

import type { Confidence, GameTitle, RarityTier } from './common';

/**
 * §11 F1 step 4 — confidence routing, plus one outcome the mock never produced.
 *
 * `unmatched` is a detection we READ but could not tie to a catalogue item.
 * The mock could not produce it because a fixture only ever names items that
 * exist; a real scan of a real inventory hits it constantly, because the
 * catalogue is ~60 seeded items per title and a player's inventory is not.
 *
 * It is deliberately NOT `discarded`. "We couldn't read this" and "we read
 * this fine and don't stock it" are different statements, and collapsing them
 * would put a confident, correct reading in a bucket labelled unreadable.
 */
export type ScanOutcome =
  | 'matched'
  | 'needs_review'
  | 'discarded'
  | 'duplicate'
  | 'unmatched';

/**
 * What the scanner actually read off a tile, before any catalogue lookup.
 *
 * Carried so an `unmatched` detection can still be shown to the user — the
 * name it read and the tier it inferred from the tile's border colour. Without
 * this the Review screen could only say "14 things we don't stock", which is
 * useless for deciding whether the scan worked.
 *
 * `rarityTier` is null when the border was absent or unreadable. It is inferred
 * from colour, never from the item name, and it is not authoritative — an
 * unmatched item never enters the inventory, so this only ever drives display.
 */
export interface ScanReading {
  name: string;
  rarityTier: RarityTier | null;
}

/** What the user handed us. Video is sampled at ~2fps with a frame-difference filter. */
export interface ScanInput {
  kind: 'image' | 'video';
  uri: string;
  title: GameTitle;
}

/** One tile the detector segmented out of an inventory grid. */
export interface ScanDetection {
  id: string;
  /** Best-guess catalogue item. Null when nothing cleared the floor. */
  itemId: string | null;
  /** Fused OCR + visual-embedding confidence, 0–1. */
  confidence: Confidence;
  /** Routing result — derived from `confidence`, never hand-written in fixtures. */
  outcome: ScanOutcome;
  /** Raw OCR text, kept so the Needs Review screen can show what we actually read. */
  ocrText: string | null;
  /** Alternative candidates offered on the Needs Review screen. */
  candidateItemIds: string[];
  /** Frame index the detection came from — used for cross-frame dedup. */
  frameIndex: number;
  /**
   * What was read off the tile. Present on live scans, absent on the fixtures.
   *
   * Required for `unmatched` to render as anything useful, and kept on matched
   * detections too so "we read X, we matched it to Y" is inspectable rather
   * than asserted.
   */
  reading?: ScanReading;
}

/**
 * Where a completed scan's numbers actually came from.
 *
 * `prepared` and `fallback` render the same data and are deliberately NOT the
 * same value: "no scanner is configured" is a settings fact, and "the scanner
 * was configured, we called it, and it failed" is an incident. Collapsing them
 * is what makes a broken endpoint indistinguishable from an absent one — the
 * exact trap `.env` warns about for the summariser, and one this flow cannot
 * afford, because a silent fallback here means the demo shows a scan of
 * something the user never uploaded.
 */
export type ScanSource = 'live' | 'prepared' | 'fallback';

/**
 * A completed scan.
 *
 * Counts MUST reconcile (§11 F1 acceptance criteria): the Figma showed
 * 42 detected = 34 matched + 5 needs review + 3 duplicates but a completion
 * screen totalling 44. `domain/scan.ts` derives every count from `detections`
 * so this class of bug cannot recur.
 */
export interface ScanResult {
  id: string;
  title: GameTitle;
  /** Milliseconds the mocked pipeline "took" — drives the timed loading states. */
  durationMs: number;
  detections: ScanDetection[];
  /**
   * Optional only because the fixtures are raw data and do not declare it.
   * `scanService.scan` sets it on every result it returns, both paths, so a
   * screen can treat it as present — and MUST show it, per §12.1.
   */
  source?: ScanSource;
  /**
   * Why `source` is `fallback` — one short human-readable clause, e.g.
   * "the scanner returned 400".
   *
   * Set on `fallback` only; absent on `live` and `prepared`, which have nothing
   * to explain. This exists because "couldn't reach the scanner" is the same
   * sentence whether the deploy is stale, the URL is wrong, the image failed to
   * encode, or the request timed out — four different fixes behind one message.
   * The reason was already being logged to the console; carrying it here is
   * what lets the person holding the phone read it too, which on a demo floor
   * is the difference between a known state and a mystery.
   */
  sourceDetail?: string;
}

/**
 * Derived tallies. Never stored — always computed from `detections`.
 *
 * `detected` remains `matched + needsReview + duplicates`. `discarded` and
 * `unmatched` both sit OUTSIDE it and are surfaced on their own lines, so the
 * §11 F1 invariant is untouched by the live path — a scan that reads 16 items
 * and stocks none of them reports 0 detected and 16 unmatched, which is the
 * honest pair of numbers.
 */
export interface ScanCounts {
  detected: number;
  matched: number;
  needsReview: number;
  duplicates: number;
  discarded: number;
  /** Read cleanly, not in the catalogue. Cannot be imported (§11 F1 step 6). */
  unmatched: number;
  /** What the CTA prints. Updates live as the user resolves Needs Review items. */
  confirmed: number;
}

/**
 * A user decision on a detection.
 *
 * Two cases, both required by §11 F1 acceptance criteria:
 *   - On a `needs_review` detection: the item the user confirmed, or null if
 *     they marked it unknown. "No ambiguous item enters a collection silently."
 *   - On a `matched` detection: null means the user removed an auto-accepted
 *     item. "Every auto-accepted item is reversible in Review."
 */
export interface ScanResolution {
  detectionId: string;
  /** The confirmed item, or null for rejected / removed. */
  itemId: string | null;
}
