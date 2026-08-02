/**
 * AI Inventory Scanner — PRD §11 F1, mocked per §12.1. Flow owner: Bernard (J1).
 *
 * ⚠️ The pipeline is specified, not built. This serves canned results behind
 * timed loading states. When asked on stage, say that plainly — do not imply a
 * model is running when it is not.
 *
 * The phase-2 swap is `scan()`: replace the fixture lookup with an upload +
 * vision call. Every count, every routing decision and the Needs Review branch
 * already live in `domain/scan.ts` and are computed from the response, so they
 * carry over untouched.
 */

import { SCAN_RESULTS_BY_TITLE } from '@/fixtures/scan-results';
import {
  countScan,
  isScanFullyResolved,
  resolvedItemIds,
  routeDetections,
} from '@/domain/scan';
import type {
  GameTitle,
  ScanCounts,
  ScanDetection,
  ScanInput,
  ScanResolution,
  ScanResult,
} from '@/types';
import { delayWithProgress } from './latency';

/** §11 F1 progress stages, in pipeline order. Drives the loading copy. */
export const SCAN_STAGES = [
  'Reading your upload',
  'Finding items',
  'Matching against the catalogue',
  'Removing duplicates',
] as const;

export type ScanStage = (typeof SCAN_STAGES)[number];

export const scanService = {
  /**
   * Run a scan. `onProgress` receives 0–1 so the caller can drive both the bar
   * and the stage label.
   *
   * Acceptance criterion: a 30-second recording of 100+ items completes
   * end-to-end in under 60 seconds with visible progress states.
   */
  async scan(input: ScanInput, onProgress?: (fraction: number) => void): Promise<ScanResult> {
    const canned = SCAN_RESULTS_BY_TITLE[input.title];
    // Routing is re-derived rather than trusted, so a fixture edit that breaks
    // the thresholds cannot produce a wrong number on screen.
    const result: ScanResult = { ...canned, detections: routeDetections([...canned.detections]) };
    return delayWithProgress(result, canned.durationMs, onProgress);
  },

  /** The stage label for a progress fraction. */
  stageFor(fraction: number): ScanStage {
    const index = Math.min(SCAN_STAGES.length - 1, Math.floor(fraction * SCAN_STAGES.length));
    return SCAN_STAGES[index]!;
  },

  /**
   * Live counts for the Review screen. The CTA must call this on every
   * resolution — that is what makes "Import N confirmed items" update as the
   * user works, instead of claiming a total that includes unresolved items.
   */
  counts(detections: readonly ScanDetection[], resolutions: readonly ScanResolution[]): ScanCounts {
    return countScan([...detections], [...resolutions]);
  },

  canImport(
    detections: readonly ScanDetection[],
    resolutions: readonly ScanResolution[],
  ): boolean {
    return isScanFullyResolved([...detections], [...resolutions]);
  },

  /**
   * The item ids that will actually be imported. Items land as `unverified`
   * (§11 F1 step 6) — the scanner never produces a verified item.
   */
  itemIdsToImport(
    detections: readonly ScanDetection[],
    resolutions: readonly ScanResolution[],
  ): string[] {
    return resolvedItemIds([...detections], [...resolutions]);
  },

  /** Which prepared recordings exist. §16 Q4 — someone must actually record these. */
  availableTitles(): GameTitle[] {
    return Object.keys(SCAN_RESULTS_BY_TITLE) as GameTitle[];
  },
};

export type ScanService = typeof scanService;
