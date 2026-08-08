/**
 * AI Inventory Scanner — PRD §11 F1. Flow owner: Bernard (J1).
 *
 * ⚠️ §12.1 SAYS THIS IS MOCKED. IT IS NO LONGER MOCKED, and the PRD has not
 * caught up. Behind `FEATURES.liveScan`, an uploaded screenshot goes to the
 * same `/api/assistant` proxy the summariser uses and a vision model reads it.
 * Say THAT plainly on stage — the old line ("your file is read off the device
 * but nothing looks at its pixels") is now false for image uploads.
 *
 * The phase-2 swap the original comment described is what happened, and it was
 * one function: `scan()`. Every count, every routing decision and the Needs
 * Review branch already lived in `domain/scan.ts` computed from the response,
 * so all of it carried over untouched. The thresholds are still never sent to
 * the model — it reports a confidence, `routeDetections` decides an outcome —
 * which is what makes the live path obey the same acceptance criteria as the
 * fixture rather than merely resembling it.
 *
 * THE FIXTURE IS STILL HERE AND IS STILL THE FALLBACK. Flag off, no proxy URL,
 * video input, a non-web platform, a timeout, a refusal, a malformed body: all
 * of them serve a fixture. There is no failure mode in which this screen breaks
 * because the network did.
 *
 * WHICH fixture depends on whether a file was actually uploaded. A real upload
 * falls back to the single-item sample for the title; only the no-upload
 * walkthrough gets the full inventory grid. They are not interchangeable —
 * reporting 24 items for a screenshot of one is not a degraded reading, it is a
 * reading of a different picture, and it is why this split exists. Every
 * fallback also carries `sourceDetail` naming the failure, because a fallback
 * nobody can diagnose is the same bug wearing a hat.
 */

import { SAMPLE_SCANS_BY_TITLE, SCAN_RESULTS_BY_TITLE } from '@/fixtures/scan-results';
import {
  countScan,
  isScanFullyResolved,
  resolvedItemIds,
  routeDetections,
} from '@/domain/scan';
import { FEATURES } from '@/config/features';
import { GAME_LABELS, RARITY_TIERS } from '@/types';
import type {
  GameTitle,
  RarityTier,
  ScanCounts,
  ScanDetection,
  ScanInput,
  ScanResolution,
  ScanResult,
} from '@/types';
import { lookFor } from '@/config/itemLooks';

import { catalogueService } from './catalogueService';
import { mediaService } from './mediaService';
import { delayWithProgress } from './latency';

/**
 * Which path a scan took. `prepared` is the fixture — the flag is off, there is
 * no proxy URL, the source is a video, or the live call failed.
 */
export type ScanMode = 'live' | 'prepared';

/** The same deployed proxy as the summariser, the digest and the assistant. */
const AI_PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL ?? '';

/**
 * A scan is allowed to take much longer than a chat answer.
 *
 * The §11 F1 acceptance criterion is 60 seconds end to end for 100+ items, and
 * a vision pass over a full grid genuinely takes tens of seconds. Cutting this
 * to the assistant's 8s would abandon calls that were about to succeed. It is
 * still bounded, because a spinner that never resolves is worse on stage than
 * a fallback that does.
 */
const TIMEOUT_MS = 45_000;

/** Where the model reported an item id we do not actually stock. */
type LiveDetection = {
  name: string;
  rarityTier: string | null;
  itemId: string | null;
  confidence: number;
  candidateItemIds: string[];
};

/**
 * §11 F1 progress stages, in pipeline order. Drives the loading copy and the
 * Scan screen's checklist.
 *
 * Wording and order are the Figma Scan frame's. §11 F1 numbers confidence
 * routing (4) before deduplication (5); the frame lists them the other way
 * round. Nothing observable turns on it — routing happens in
 * `domain/scan.routeDetections` regardless of which label is ticked when — so
 * the frame wins rather than the demo disagreeing with the design in front of
 * the panel.
 */
export const SCAN_STAGES = [
  'Reading item names',
  'Matching skins and collectibles',
  'Removing duplicates',
  'Calculating confidence scores',
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
    const attemptedLive = scanMode(input) === 'live';
    let failure: string | undefined;

    if (attemptedLive) {
      const live = await scanLive(input, onProgress);
      // One fallback for every failure, because the user's next move is
      // identical in every case and a half-broken Review screen is worse than
      // the prepared one — but the RESULT records both that we fell back and
      // WHY, so the screen can say so instead of quietly passing the prepared
      // set off as a reading of the user's upload.
      if (live.ok) return live.result;
      failure = live.reason;
    }

    // Which fallback depends on what the user actually handed us. A real
    // upload gets the single-item sample where one exists for the title; the
    // full-grid walkthrough is only correct when nobody uploaded anything, and
    // serving it for a one-item screenshot is what made the Review screen
    // claim 24 items for a picture of one.
    const canned = hasUpload(input)
      ? (SAMPLE_SCANS_BY_TITLE[input.title] ?? SCAN_RESULTS_BY_TITLE[input.title])
      : SCAN_RESULTS_BY_TITLE[input.title];

    // Routing is re-derived rather than trusted, so a fixture edit that breaks
    // the thresholds cannot produce a wrong number on screen.
    const result: ScanResult = {
      ...canned,
      detections: routeDetections([...canned.detections]),
      source: attemptedLive ? 'fallback' : 'prepared',
      ...(failure === undefined ? {} : { sourceDetail: failure }),
    };
    return delayWithProgress(result, canned.durationMs, onProgress);
  },

  /**
   * Which path a given input will take. The Upload screen prints this, because
   * "a real model read your screenshot" and "this is the prepared result" must
   * never be indistinguishable on screen (§12.1's honesty rule).
   */
  modeFor(input: ScanInput): ScanMode {
    return scanMode(input);
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

/**
 * Whether an input takes the live path.
 *
 * Video is excluded deliberately and permanently-ish: sampling a recording at
 * ~2fps with a frame-difference filter is client-side work nobody has built,
 * and sending one arbitrary frame would be worse than the prepared result. §14
 * rung 4 cuts video before it cuts anything here.
 */
function scanMode(input: ScanInput): ScanMode {
  const eligible =
    FEATURES.liveScan &&
    AI_PROXY_URL.length > 0 &&
    input.kind === 'image' &&
    hasUpload(input);
  return eligible ? 'live' : 'prepared';
}

/**
 * Whether a real file is behind this input.
 *
 * The Import screen substitutes a synthetic `demo://<title>-inventory` URI when
 * the user never picked anything, so this is the one test that separates "scan
 * my screenshot" from "show me the flow". A `data:` URI means bytes exist.
 */
function hasUpload(input: ScanInput): boolean {
  return input.uri.startsWith('data:');
}

/**
 * A live attempt: the reading, or the reason there isn't one.
 *
 * Deliberately not `ScanResult | null` — the caller has to put the failure on
 * screen, and a bare null cannot carry it.
 */
type LiveAttempt = { ok: true; result: ScanResult } | { ok: false; reason: string };

/**
 * Run the real scan. Null on ANY failure — see `scan()` for why that is one
 * branch rather than several.
 *
 * The progress bar is synthetic and says so here: a single POST has no
 * intermediate events to report, so this eases toward 95% on a timer and only
 * reaches 100% when the response lands. That is honest about the thing the
 * user actually cares about (it is still working) without inventing stage
 * transitions that did not happen.
 */
async function scanLive(
  input: ScanInput,
  onProgress?: (fraction: number) => void,
): Promise<LiveAttempt> {
  const stopProgress = startProgress(onProgress);

  /**
   * The reason travels two ways: to the console with its full detail for
   * whoever is debugging, and back to the caller as a short clause the Review
   * screen prints. Without the second, a silent fallback is untestable — the
   * screen looks identical whether the endpoint 404s, the deploy is stale, or
   * the image failed to encode. That is the difference between a five-minute
   * fix and an evening.
   */
  const fail = (reason: string, detail?: unknown): LiveAttempt => {
    console.warn(`[collectee-scan] falling back to the prepared set — ${reason}`, detail ?? '');
    return { ok: false, reason };
  };

  try {
    const [image, catalogue] = await Promise.all([
      mediaService.prepareForScan(input.uri),
      /**
       * EVERY title's catalogue, not just the selected one.
       *
       * The scanner used to see only the chosen game, which made a cross-game
       * upload unmatchable BY CONSTRUCTION — a CODM rifle scanned as Valorant
       * had nothing it could possibly return, so it came back as a description
       * with `itemId: null` and the screen said "not in the catalogue".
       *
       * Trying to recover that on the client by matching the reading text
       * against the other games' names does not work: a single render has no
       * printed label, so the model describes it ("Assault rifle, red and black
       * molten lava finish") and a description never matches a name.
       *
       * Giving it all 94 rows lets it answer the question that was actually
       * asked — which item is this — and the client compares the returned
       * item's game against the selected one. 94 is well inside the proxy's
       * 200-row cap.
       */
      catalogueService.getAllItems(),
    ]);
    if (image === null) return fail('the upload could not be prepared for sending');
    if (catalogue.length === 0) return fail('the catalogue is empty');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let payload: { detections?: unknown };
    try {
      const response = await fetch(AI_PROXY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          mode: 'scan',
          game: GAME_LABELS[input.title],
          image: image.data,
          mediaType: image.mediaType,
          // Names, rarity labels and a visual description. Still no popularity
          // scores or set ids — the model has no use for them.
          catalogue: catalogue.map((item) => ({
            id: item.id,
            name: item.name,
            rarity: item.rarityLabel,
            /* So the model can prefer the chosen title and still name the right
               item when the upload is from another one. */
            game: GAME_LABELS[item.title],
            /*
             * What the item LOOKS like — see `config/itemLooks`.
             *
             * Without this the model matches what it sees against a list of
             * names, which only works when the name happens to describe the
             * picture. Measured across the 54 seeded demo uploads, name-only
             * matching got 9 right: Arctic Hunter, Molten Core, Sandstorm and
             * their kin. Everything called Ironclad or Cherry Witch failed, and
             * MLBB — whose names are hero-plus-epithet almost throughout —
             * matched 0 of 18.
             *
             * Undefined for an item the bake has not seen, which the proxy
             * renders as an empty column rather than dropping the row.
             */
            look: lookFor(item.id) ?? undefined,
          })),
        }),
      });
      if (!response.ok) {
        // The proxy reports its own reason in the body, and it is usually the
        // whole answer — `empty_article` here means the deployed function
        // predates scan mode and fell through to the summariser, i.e. the
        // code is fine and the deploy is stale.
        const detail = await response.text().catch(() => '');
        return fail(`the scanner returned ${response.status}`, detail.slice(0, 200));
      }
      payload = (await response.json()) as { detections?: unknown };
    } finally {
      clearTimeout(timer);
    }

    if (!Array.isArray(payload.detections)) {
      return fail('the scanner returned no detections field', payload);
    }

    // A genuinely empty result is NOT a failure — it means the upload was not
    // an inventory screen. Returning it shows the user that honestly instead
    // of silently substituting a scan of something they never uploaded.
    const known = new Set(catalogue.map((item) => item.id));
    const detections = (payload.detections as LiveDetection[]).map((entry, index) =>
      toDetection(entry, index, known),
    );

    return {
      ok: true,
      result: {
        id: `scan-live-${input.title}-${Date.now()}`,
        title: input.title,
        durationMs: 0,
        detections: routeDetections(detections),
        source: 'live',
      },
    };
  } catch (error) {
    // Includes the abort, network failure and a malformed body.
    return fail('the scanner call threw', error);
  } finally {
    stopProgress();
    onProgress?.(1);
  }
}

/**
 * One reported tile → one `ScanDetection`.
 *
 * The important line is the `known.has` check. A model that returns an item id
 * which is not in the catalogue — misremembered, adapted, or hallucinated
 * wholesale — must not be able to put an item into someone's inventory that
 * they never owned. An unrecognised id is dropped to null and the detection
 * becomes `unmatched`, carrying the name that was actually read.
 */
function toDetection(entry: LiveDetection, index: number, known: ReadonlySet<string>): ScanDetection {
  const name = typeof entry.name === 'string' ? entry.name.trim() : '';
  const itemId = typeof entry.itemId === 'string' && known.has(entry.itemId) ? entry.itemId : null;

  return {
    id: `live-${index}`,
    itemId,
    confidence: typeof entry.confidence === 'number' ? entry.confidence : 0,
    // Overwritten by `routeDetections`; the model is never asked for it.
    outcome: 'discarded',
    ocrText: name.length > 0 ? name : null,
    candidateItemIds: Array.isArray(entry.candidateItemIds)
      ? entry.candidateItemIds.filter((id) => known.has(id) && id !== itemId)
      : [],
    // Single screenshot, so every detection is frame 1. Kept rather than made
    // optional because cross-frame dedup still runs and still reads it.
    frameIndex: 1,
    // Absent when nothing was read — that detection is unreadable, not
    // unmatched, and `routeDetections` needs to be able to tell them apart.
    reading: name.length > 0 ? { name, rarityTier: toTier(entry.rarityTier) } : undefined,
  };
}

function toTier(value: unknown): RarityTier | null {
  return typeof value === 'string' && (RARITY_TIERS as readonly string[]).includes(value)
    ? (value as RarityTier)
    : null;
}

/**
 * Synthetic progress for a request with no progress events.
 *
 * Approaches 0.95 and never reaches it, so the bar always has somewhere to go
 * and never sits at 100% while the user waits. Returns its own canceller.
 */
function startProgress(onProgress?: (fraction: number) => void): () => void {
  if (!onProgress) return () => {};

  const startedAt = Date.now();
  const interval = setInterval(() => {
    const elapsed = (Date.now() - startedAt) / TIMEOUT_MS;
    onProgress(0.95 * (1 - Math.exp(-3 * elapsed)));
  }, 200);

  return () => clearInterval(interval);
}
