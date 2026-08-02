/**
 * AI Inventory Scanner types — PRD §11 F1.
 *
 * The pipeline described in F1 is SPECIFIED, NOT BUILT (§12.1). The demo serves
 * canned results from fixtures behind timed loading states. These types describe
 * the contract that the real pipeline would satisfy, so swapping the mock for a
 * live vision call later is a service-layer change and nothing else.
 */

import type { Confidence, GameTitle } from './common';

/** §11 F1 step 4 — confidence routing. */
export type ScanOutcome = 'matched' | 'needs_review' | 'discarded' | 'duplicate';

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
}

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
}

/** Derived tallies. Never stored — always computed from `detections`. */
export interface ScanCounts {
  detected: number;
  matched: number;
  needsReview: number;
  duplicates: number;
  discarded: number;
  /** What the CTA prints. Updates live as the user resolves Needs Review items. */
  confirmed: number;
}

/** A user decision on a Needs Review detection. */
export interface ScanResolution {
  detectionId: string;
  /** The item the user confirmed, or null if they rejected the detection. */
  itemId: string | null;
}
