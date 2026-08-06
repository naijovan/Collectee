/**
 * Canned scanner results — PRD §11 F1 + §12.1.
 *
 * The vision pipeline is SPECIFIED, NOT BUILT. These fixtures are served behind
 * timed loading states for a fixed set of prepared inventory recordings.
 *
 * Two rules these fixtures must obey, both from the PRD:
 *
 * 1. "Confidence values in the fixtures must be internally consistent with the
 *    routing thresholds." Every `outcome` below is what `routeByConfidence`
 *    plus cross-frame dedup actually produces. `assertScanConsistent` is run by
 *    scripts/validate-fixtures.ts, so a hand-edit that breaks this fails the
 *    build rather than reaching the stage.
 *
 * 2. "The Needs Review branch must be demonstrated, not skipped — it is the
 *    screen that proves the system knows what it doesn't know, and it is more
 *    convincing than a clean 100% result."
 *
 * The CODM scan below reconciles as:
 *   detected 24 = matched 18 + needs review 4 + duplicates 2
 *   plus 3 discarded, surfaced separately as "3 items we couldn't read".
 */

import type { GameTitle, ScanResult } from '@/types';

/** The hero demo scan — Call of Duty: Mobile (Garena SEA). */
const CODM_SCAN = {
  id: 'scan-codm-demo',
  title: 'codm',
  durationMs: 6500,
  detections: [
    // ── Auto-accepted (≥ 0.90) ─────────────────────────────────────────
    { id: 'det-01', itemId: 'codm-dlq33-lightbringer', confidence: 0.98, outcome: 'matched', ocrText: 'DL Q33 — LIGHTBRINGER', candidateItemIds: [], frameIndex: 2 },
    { id: 'det-02', itemId: 'codm-fennec-ascended', confidence: 0.97, outcome: 'matched', ocrText: 'FENNEC — ASCENDED', candidateItemIds: [], frameIndex: 2 },
    { id: 'det-03', itemId: 'codm-ak117-cordite-storm', confidence: 0.95, outcome: 'matched', ocrText: 'AK117 — CORDITE STORM', candidateItemIds: [], frameIndex: 3 },
    { id: 'det-04', itemId: 'codm-drh-cerberus', confidence: 0.96, outcome: 'matched', ocrText: 'DR-H — CERBERUS', candidateItemIds: [], frameIndex: 3 },
    { id: 'det-05', itemId: 'codm-qq9-diavolo', confidence: 0.94, outcome: 'matched', ocrText: 'QQ9 — DIAVOLO', candidateItemIds: [], frameIndex: 4 },
    { id: 'det-06', itemId: 'codm-ghost-nightfall', confidence: 0.93, outcome: 'matched', ocrText: 'GHOST — NIGHTFALL', candidateItemIds: [], frameIndex: 4 },
    { id: 'det-07', itemId: 'codm-kilo141-glacier', confidence: 0.97, outcome: 'matched', ocrText: 'KILO 141 — GLACIER', candidateItemIds: [], frameIndex: 5 },
    { id: 'det-08', itemId: 'codm-m4-arctic-hunter', confidence: 0.92, outcome: 'matched', ocrText: 'M4 — ARCTIC HUNTER', candidateItemIds: [], frameIndex: 5 },
    { id: 'det-09', itemId: 'codm-alias-frostbite', confidence: 0.91, outcome: 'matched', ocrText: 'ALIAS — FROSTBITE', candidateItemIds: [], frameIndex: 6 },
    { id: 'det-10', itemId: 'codm-rus79u-molten', confidence: 0.93, outcome: 'matched', ocrText: 'RUS-79U — MOLTEN CORE', candidateItemIds: [], frameIndex: 6 },
    { id: 'det-11', itemId: 'codm-hbra3-tidal', confidence: 0.98, outcome: 'matched', ocrText: 'HBRa3 — TIDAL WAVE', candidateItemIds: [], frameIndex: 7 },
    { id: 'det-12', itemId: 'codm-pdw57-abyss', confidence: 0.95, outcome: 'matched', ocrText: 'PDW-57 — ABYSSAL', candidateItemIds: [], frameIndex: 7 },
    { id: 'det-13', itemId: 'codm-mac10-riptide', confidence: 0.94, outcome: 'matched', ocrText: 'MAC-10 — RIPTIDE', candidateItemIds: [], frameIndex: 8 },
    { id: 'det-14', itemId: 'codm-price-monsoon', confidence: 0.9, outcome: 'matched', ocrText: 'PRICE — MONSOON', candidateItemIds: [], frameIndex: 8 },
    { id: 'det-15', itemId: 'codm-charm-chronoseal', confidence: 0.96, outcome: 'matched', ocrText: 'CHRONOSEAL', candidateItemIds: [], frameIndex: 9 },
    { id: 'det-16', itemId: 'codm-camo-urban-splinter', confidence: 0.99, outcome: 'matched', ocrText: 'URBAN SPLINTER', candidateItemIds: [], frameIndex: 9 },
    { id: 'det-17', itemId: 'codm-camo-desert-strata', confidence: 0.98, outcome: 'matched', ocrText: 'DESERT STRATA', candidateItemIds: [], frameIndex: 10 },
    { id: 'det-18', itemId: 'codm-asm10-sandstorm', confidence: 0.97, outcome: 'matched', ocrText: 'ASM10 — SANDSTORM', candidateItemIds: [], frameIndex: 10 },

    // ── Needs Review (0.60–0.90) — the screen that proves the system ────
    //    knows what it doesn't know. Do not skip this in the demo.
    { id: 'det-19', itemId: 'codm-locus-ironclad', confidence: 0.83, outcome: 'needs_review', ocrText: 'LOCUS — IRONCL…', candidateItemIds: ['codm-locus-ironclad', 'codm-rus79u-molten'], frameIndex: 11 },
    { id: 'det-20', itemId: 'codm-mansk-blackout', confidence: 0.71, outcome: 'needs_review', ocrText: 'MACE — BL▚CKOUT', candidateItemIds: ['codm-mansk-blackout', 'codm-locus-ironclad'], frameIndex: 11 },
    { id: 'det-21', itemId: 'codm-charm-sweetheart-prism', confidence: 0.66, outcome: 'needs_review', ocrText: null, candidateItemIds: ['codm-charm-sweetheart-prism', 'codm-charm-dog-tag'], frameIndex: 12 },
    { id: 'det-22', itemId: 'codm-soap-recruit', confidence: 0.78, outcome: 'needs_review', ocrText: 'SOAP — REC…', candidateItemIds: ['codm-soap-recruit', 'codm-price-monsoon'], frameIndex: 12 },

    // ── Duplicates across frames (§11 F1 step 5) ───────────────────────
    { id: 'det-23', itemId: 'codm-dlq33-lightbringer', confidence: 0.92, outcome: 'duplicate', ocrText: 'DL Q33 — LIGHTBRINGER', candidateItemIds: [], frameIndex: 14 },
    { id: 'det-24', itemId: 'codm-camo-urban-splinter', confidence: 0.88, outcome: 'duplicate', ocrText: 'URBAN SPLINTER', candidateItemIds: [], frameIndex: 15 },

    // ── Discarded (< 0.60) — "3 items we couldn't read" ────────────────
    { id: 'det-25', itemId: null, confidence: 0.41, outcome: 'discarded', ocrText: null, candidateItemIds: [], frameIndex: 16 },
    { id: 'det-26', itemId: null, confidence: 0.33, outcome: 'discarded', ocrText: '▚▚▚', candidateItemIds: [], frameIndex: 16 },
    { id: 'det-27', itemId: 'codm-camo-olive-standard', confidence: 0.52, outcome: 'discarded', ocrText: 'OL… ST…', candidateItemIds: [], frameIndex: 17 },
  ],
} as const satisfies ScanResult;

const VALORANT_SCAN = {
  id: 'scan-valorant-demo',
  title: 'valorant',
  durationMs: 5200,
  detections: [
    { id: 'vdet-01', itemId: 'val-elderflame-vandal', confidence: 0.98, outcome: 'matched', ocrText: 'Elderflame Vandal', candidateItemIds: [], frameIndex: 1 },
    { id: 'vdet-02', itemId: 'val-elderflame-operator', confidence: 0.96, outcome: 'matched', ocrText: 'Elderflame Operator', candidateItemIds: [], frameIndex: 1 },
    { id: 'vdet-03', itemId: 'val-prime-vandal', confidence: 0.97, outcome: 'matched', ocrText: 'Prime Vandal', candidateItemIds: [], frameIndex: 2 },
    { id: 'vdet-04', itemId: 'val-voidglass-blade', confidence: 0.95, outcome: 'matched', ocrText: 'Voidglass Blade', candidateItemIds: [], frameIndex: 2 },
    { id: 'vdet-05', itemId: 'val-reaver-vandal', confidence: 0.94, outcome: 'matched', ocrText: 'Reaver Vandal', candidateItemIds: [], frameIndex: 3 },
    { id: 'vdet-06', itemId: 'val-oni-phantom', confidence: 0.93, outcome: 'matched', ocrText: 'Oni Phantom', candidateItemIds: [], frameIndex: 3 },
    { id: 'vdet-07', itemId: 'val-origin-vandal', confidence: 0.91, outcome: 'matched', ocrText: 'Origin Vandal', candidateItemIds: [], frameIndex: 4 },
    { id: 'vdet-08', itemId: 'val-riftblade-katana', confidence: 0.87, outcome: 'needs_review', ocrText: 'Riftbl… Katana', candidateItemIds: ['val-riftblade-katana', 'val-glitchpop-vandal'], frameIndex: 4 },
    { id: 'vdet-09', itemId: 'val-champions-2022-phantom', confidence: 0.74, outcome: 'needs_review', ocrText: 'Champions 20…', candidateItemIds: ['val-champions-2022-phantom', 'val-spectrum-phantom'], frameIndex: 5 },
    { id: 'vdet-10', itemId: 'val-prime-vandal', confidence: 0.9, outcome: 'duplicate', ocrText: 'Prime Vandal', candidateItemIds: [], frameIndex: 6 },
    { id: 'vdet-11', itemId: null, confidence: 0.38, outcome: 'discarded', ocrText: null, candidateItemIds: [], frameIndex: 7 },
  ],
} as const satisfies ScanResult;

const MLBB_SCAN = {
  id: 'scan-mlbb-demo',
  title: 'mlbb',
  durationMs: 5800,
  detections: [
    // Pointed at the art-pack cosmetics on purpose: Review is the first screen
    // with a grid on it, and a grid of colour blocks is the weakest possible
    // first impression. These are the MLBB items that have real renders.
    { id: 'mdet-01', itemId: 'mlbb-lightborn-defender', confidence: 0.97, outcome: 'matched', ocrText: 'Lightborn Defender', candidateItemIds: [], frameIndex: 1 },
    { id: 'mdet-02', itemId: 'mlbb-void-empress', confidence: 0.94, outcome: 'matched', ocrText: 'Void Empress', candidateItemIds: [], frameIndex: 1 },
    { id: 'mdet-03', itemId: 'mlbb-cyber-breacher', confidence: 0.93, outcome: 'matched', ocrText: 'Cyber Breacher', candidateItemIds: [], frameIndex: 2 },
    { id: 'mdet-04', itemId: 'mlbb-emberfall-warlord', confidence: 0.95, outcome: 'matched', ocrText: 'Emberfall', candidateItemIds: [], frameIndex: 2 },
    { id: 'mdet-05', itemId: 'mlbb-neon-ronin', confidence: 0.92, outcome: 'matched', ocrText: 'Neon Ronin', candidateItemIds: [], frameIndex: 3 },
    { id: 'mdet-06', itemId: 'mlbb-zodiac-aquarius', confidence: 0.96, outcome: 'matched', ocrText: 'Zodiac Aquarius', candidateItemIds: [], frameIndex: 3 },
    { id: 'mdet-07', itemId: 'mlbb-frost-sentinel', confidence: 0.81, outcome: 'needs_review', ocrText: 'Winter V▚ult', candidateItemIds: ['mlbb-frost-sentinel', 'mlbb-radiant-huntress'], frameIndex: 4 },
    { id: 'mdet-08', itemId: 'mlbb-manifold-rift', confidence: 0.68, outcome: 'needs_review', ocrText: 'M▚nifold R…', candidateItemIds: ['mlbb-manifold-rift', 'mlbb-voidstorm-spirit'], frameIndex: 4 },
    { id: 'mdet-09', itemId: 'mlbb-lightborn-defender', confidence: 0.91, outcome: 'duplicate', ocrText: 'Lightborn Defender', candidateItemIds: [], frameIndex: 5 },
    { id: 'mdet-10', itemId: null, confidence: 0.44, outcome: 'discarded', ocrText: null, candidateItemIds: [], frameIndex: 6 },
    { id: 'mdet-11', itemId: null, confidence: 0.29, outcome: 'discarded', ocrText: null, candidateItemIds: [], frameIndex: 6 },
  ],
} as const satisfies ScanResult;

/**
 * The fallback for a scan of a REAL upload, as opposed to the walkthrough.
 *
 * The three scans above describe a full inventory grid, which is the honest
 * answer when nobody uploaded anything and the user asked to see the flow. It
 * is the WRONG answer when someone uploads a one-item screenshot and the
 * scanner is unreachable: reporting 24 items for a picture of one is not a
 * degraded reading, it is a different picture, and it is the specific bug that
 * sent this flow back for rework.
 *
 * So a failed live scan falls back to this instead — one item, the one in
 * `assets/collectee/sample input 1.png`. It is still not a reading of the
 * user's file and the Review screen still says so in a warning banner; it is
 * merely the shape a single-tile upload could plausibly have, so the numbers on
 * screen stay defensible while the banner explains itself.
 *
 * ⚠️ This is a fallback, not a fixture to demo from. If it is on screen, the
 * live path failed and `sourceDetail` says why. Fix that instead of admiring
 * this.
 */
const SAMPLE_SCAN = {
  id: 'scan-sample-upload',
  title: 'codm',
  durationMs: 2400,
  detections: [
    { id: 'sdet-01', itemId: 'codm-rvr8-wyrmfire', confidence: 0.94, outcome: 'matched', ocrText: 'RVR-8 — WYRMFIRE', candidateItemIds: [], frameIndex: 1 },
  ],
} as const satisfies ScanResult;

export const SCAN_RESULTS: readonly ScanResult[] = [CODM_SCAN, VALORANT_SCAN, MLBB_SCAN, SAMPLE_SCAN];

/** The full-grid walkthrough, served when nobody uploaded anything. */
export const SCAN_RESULTS_BY_TITLE = {
  codm: CODM_SCAN,
  valorant: VALORANT_SCAN,
  mlbb: MLBB_SCAN,
} as const;

/**
 * Single-item fallbacks, keyed by title. Partial ON PURPOSE.
 *
 * A title is in here only once someone has prepared a one-item screenshot and
 * the catalogue entry to go with it. Where a title is absent, `scanService`
 * falls back to the walkthrough above — which mis-states the item count, but at
 * least names items from the right game, and still labels itself a fallback.
 * Add a title here rather than widening the CODM entry to cover it.
 */
export const SAMPLE_SCANS_BY_TITLE: Partial<Record<GameTitle, ScanResult>> = {
  codm: SAMPLE_SCAN,
};
