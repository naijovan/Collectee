/**
 * J1 — Import inventory (PRD §10, §11 F1). Flow owner: Bernard.
 *
 * Upload → Scan → Review → Needs Review → Complete, as one route with a stage
 * machine, because every stage reads the same `ScanResult` and splitting it
 * across four routes means threading it through params.
 *
 * Built to the Figma "Import Inventory Flow" frames: numbered-circle stepper
 * (Upload · Scan · Review · Complete), the Scan screen's sweeping beam over a
 * stack of uploaded screenshots with a per-stage checklist, and a Review screen
 * whose summary card, filter chips, inline Confirm / Change and collapsed
 * duplicates row all come from frame 3 of that group.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  COUNTS ARE DERIVED, NEVER STORED.                                  │
 * │  Every number on this screen comes from `scanService.counts()`,     │
 * │  which delegates to `domain/scan.ts`. The Figma shipped a           │
 * │  reconciliation bug — 42 detected = 34 + 5 + 3, a CTA reading       │
 * │  "Import 39" before the 5 were resolved, and a completion screen    │
 * │  totalling 44. Do not hand-write a total here to fix a layout.      │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Two more rules from §11 F1 that this screen exists to honour:
 *   - The Needs Review branch is demonstrated, not skipped. It is the screen
 *     that proves the system knows what it doesn't know.
 *   - Imported items land `unverified`. The scanner never produces a verified
 *     item — that needs a linked game account and is partnership-gated (§9.3).
 *
 * The pipeline itself is specified, not built (§12.1): this serves canned
 * fixtures behind timed loading states. The uploaded file is real — it is
 * genuinely read off the device — but nothing looks at its pixels. Say both
 * halves of that plainly on stage.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import {
  Avatar,
  EmptyState,
  FadeInView,
  FilterChips,
  ItemArt,
  ItemCard,
  LoadingState,
  PrimaryButton,
  RarityBadge,
  SecondaryButton,
} from '@/components';
import { ART_PLACEMENTS, GAME_COVERS } from '@/config/artRegistry';
import { FEATURES } from '@/config/features';
import type { CollectionSuggestion } from '@/domain/collections';
import { groupByRarity, rarityLabelFor } from '@/domain/rarity';
import { foreignTitleMatches, isMatchIncluded, routeDetections } from '@/domain/scan';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import * as haptics from '@/lib/haptics';
import {
  catalogueService,
  collectionService,
  formatBytes,
  inventoryService,
  mediaService,
  scanService,
  SCAN_STAGES,
} from '@/services';
import type { PickedImage } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, gameAccents, radius, scrim, spacing, typography, accentLink } from '@/theme/theme';
import { GAME_LABELS } from '@/types';
import type { GameTitle, Item, ScanDetection, ScanResolution, ScanResult } from '@/types';

/**
 * The Figma's four labels, plus Verify. §11 F3's stepper arrays are J2's and J3's.
 *
 * Verify sits AFTER the items are written, not before, and that ordering is
 * forced rather than chosen: `linkAccount` promotes items the inventory already
 * holds (§9.3), so there has to be something to promote. The step is skippable
 * by design — verification needs a linked game account, and a user who has not
 * linked one still gets their import.
 */
const IMPORT_STEPS = ['Upload', 'Scan', 'Review', 'Verify', 'Complete'] as const;

/**
 * `landing` sits on step 0 alongside `upload`: picking a title is part of
 * choosing what to upload, not a numbered step of its own. The Figma draws it
 * as a separate screen under the same highlighted "Upload" circle.
 */
type Stage =
  | 'landing'
  | 'upload'
  | 'scanning'
  | 'review'
  | 'needs-review'
  | 'verify'
  | 'complete';

const STAGE_STEP: Record<Stage, number> = {
  landing: 0,
  upload: 0,
  scanning: 1,
  review: 2,
  'needs-review': 2,
  verify: 3,
  complete: 4,
};

/** Each frame's own header, rather than one title for the whole flow. */
const STAGE_TITLE: Record<Stage, string> = {
  landing: 'Import inventory',
  upload: 'Upload',
  scanning: 'Scanning inventory',
  review: 'Review items',
  'needs-review': 'Confirm a match',
  verify: 'Verify ownership',
  complete: 'Import complete',
};

/**
 * Review sections. `All` shows every section stacked, matching the Figma tabs.
 *
 * "Not in catalogue" is not in the Figma, because the mock could not produce
 * the outcome it shows — a fixture only ever names items that exist. A real
 * scan of a real inventory produces it constantly, and a scan that read
 * sixteen items and can import none of them has to say so somewhere.
 */
const REVIEW_FILTERS = ['All', 'Matched', 'Needs review', 'Duplicates', 'Not in catalogue'] as const;
type ReviewFilter = (typeof REVIEW_FILTERS)[number];

/** How many of each section the `All` tab previews before "See all". */
const PREVIEW_MATCHED = 3;
const PREVIEW_NEEDS_REVIEW = 2;
const PREVIEW_UNMATCHED = 3;

export default function ImportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { viewer, viewerId, inventory, refreshInventory } = useApp();

  const [stage, setStage] = useState<Stage>('landing');
  const scrollRef = useTopOnFocus(stage);

  const [title, setTitle] = useState<GameTitle>('codm');
  /**
   * Always `image`, even when video input is available.
   *
   * Video defaulted here until it was watched in use: the first thing the
   * screen showed was a large upload box that ignores taps, because the video
   * path has no file to pick (§14 rung 4 — frame sampling is not built). People
   * tapped it, nothing happened, and they concluded upload was broken. The
   * source that accepts a file is the one worth landing on; video is still one
   * chip away.
   */
  const [kind, setKind] = useState<'image' | 'video'>('image');
  /** Every screenshot picked for this scan. One flow, many files. */
  const [uploads, setUploads] = useState<PickedImage[]>([]);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [resolutions, setResolutions] = useState<ScanResolution[]>([]);
  const [items, setItems] = useState<ReadonlyMap<string, Item>>(new Map());
  const [importedCount, setImportedCount] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('All');
  const [dupesOpen, setDupesOpen] = useState(false);
  /** Which detection "Change" opened. Null falls back to the first unresolved. */
  const [focusId, setFocusId] = useState<string | null>(null);
  const [nextUp, setNextUp] = useState<CollectionSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  /** Verify step. `linkResult` is null until an account link has actually run. */
  const [linking, setLinking] = useState(false);
  const [linkProgress, setLinkProgress] = useState(0);
  const [linkResult, setLinkResult] = useState<{ verified: number } | null>(null);
  /** Exactly what this import asked for — the scope Verify confirms. */
  const [importedItemIds, setImportedItemIds] = useState<readonly string[]>([]);

  /**
   * Incremented by "Cancel scan". The scan is a timer, not a request, so it
   * cannot be aborted — but a stale run must not be allowed to push a result
   * onto a screen the user has already left.
   */
  const runId = useRef(0);

  const detections = result?.detections ?? [];

  /**
   * Which path "Start scan" will take, asked of the service rather than
   * re-derived here — the flag, the endpoint and the video rule all live in
   * one place and this screen must not grow a second opinion about them.
   */
  /**
   * §14 rung 5: with the third title cut, MLBB has no account to connect, so
   * the Verify step must not offer a button that cannot do anything. Same
   * predicate as `link-account.tsx` — if that screen grows a real rule, this
   * follows it rather than keeping a second opinion.
   */
  const canLinkTitle = FEATURES.thirdTitle || title !== 'mlbb';

  const scanMode = scanService.modeFor({
    kind,
    uri: uploads[0]?.uri ?? `demo://${title}-inventory`,
    title,
  });

  // Recomputed on every resolution — this is what makes the CTA count live.
  const counts = useMemo(
    () => scanService.counts(detections, resolutions),
    [detections, resolutions],
  );
  const fullyResolved = scanService.canImport(detections, resolutions);

  /**
   * Confirmed items the inventory already held. `importFromScan` writes nothing
   * for these, so this is the entire gap between what the CTA promised and what
   * actually landed — and on a second run of the same screenshot it is the whole
   * import.
   */
  const alreadyOwned = counts.confirmed - importedCount;

  const pending = detections.filter(
    (d) => d.outcome === 'needs_review' && !resolutions.some((r) => r.detectionId === d.id),
  );

  /**
   * Matched detections paired with their catalogue item, carrying `rarityTier`
   * at the top level so `groupByRarity` can take them directly — §11 F1 step 6
   * asks for the Review screen to group by rarity, and that helper already
   * exists for exactly this.
   */
  const wrongGame = useMemo(() => {
    /**
     * Detections the scanner matched to an item from a DIFFERENT game.
     *
     * Exact, because it compares the resolved item's `title` — no text
     * matching. The previous approach ran the reading through
     * `foreignTitleMatches` against the other catalogues' names, and that
     * cannot work: a single render has no printed label, so the model returns
     * a description ("Assault rifle, red and black molten lava finish") and a
     * description never matches a name. The scanner now sees all three
     * catalogues and names the real item, which turns this into a field
     * comparison.
     */
    /**
     * Two ways a cross-game read reaches us, and both are honoured.
     *
     * 1. `itemId` names an item from another game. What the current prompt asks
     *    for, and the clean answer.
     *
     * 2. `itemId` is null but `candidateItemIds` contains one. What the model
     *    does when the prompt has not told it cross-game answers are allowed —
     *    it recognises the item, lists it as a candidate, and declines to
     *    commit. Reading the candidates recovers that.
     *
     * The second path is not only a deploy-lag workaround. A model that is
     * genuinely torn between two games will always express that as candidates
     * rather than a confident id, and refusing to look at them would throw away
     * the one place it said what it actually saw.
     */
    const resolveForeign = (d: ScanDetection): Item | undefined => {
      const direct = d.itemId ? items.get(d.itemId) : undefined;
      if (direct && direct.title !== title) return direct;
      if (direct) return undefined; // matched the chosen game — nothing to flag
      return d.candidateItemIds
        .map((id) => items.get(id))
        .find((candidate) => candidate !== undefined && candidate.title !== title);
    };

    const foreign = detections
      .filter((d) => d.outcome !== 'duplicate')
      .map((d) => ({ detection: d, item: resolveForeign(d) }))
      .filter(
        (entry): entry is { detection: ScanDetection; item: Item } => entry.item !== undefined,
      );
    if (foreign.length === 0) return null;

    return {
      /* One game per block. Uploading a mixed screenshot from two other titles
         at once is not a case worth a second panel for. */
      title: foreign[0]!.item.title,
      matches: foreign
        .filter((entry) => entry.item.title === foreign[0]!.item.title)
        .map((entry) => ({
          detectionId: entry.detection.id,
          reading: entry.detection.reading?.name ?? entry.item.name,
          itemId: entry.item.id,
          itemName: entry.item.name,
        })),
    };
  }, [detections, items, title]);

  /** Ids the wrong-game block owns, so the normal lists do not show them too. */
  const foreignDetectionIds = useMemo(
    () => new Set(wrongGame?.matches.map((m) => m.detectionId) ?? []),
    [wrongGame],
  );

  const matchedEntries = useMemo(
    () =>
      detections
        .filter((d) => d.outcome === 'matched' && d.itemId !== null && !foreignDetectionIds.has(d.id))
        .map((d) => {
          const item = items.get(d.itemId!);
          return item ? { detection: d, item, rarityTier: item.rarityTier } : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    [detections, items, foreignDetectionIds],
  );

  const matchedGroups = useMemo(() => groupByRarity(matchedEntries), [matchedEntries]);

  /**
   * Catalogue ids the viewer already owns.
   *
   * `importFromScan` silently skips these — it filters on `!existing.has(id)` —
   * so re-scanning a screenshot of things you already have writes nothing. That
   * was only discoverable on the Complete screen, AFTER pressing a button that
   * promised to import them.
   *
   * NOT the same as `outcome: 'duplicate'`, which means "this item appeared
   * twice in THIS scan" (cross-frame dedup) and says nothing about ownership.
   */
  const ownedItemIds = useMemo(
    () => new Set(inventory.map((entry) => entry.item.id)),
    [inventory],
  );

  /** Matched reads the viewer already holds. Counted for the note above the list. */
  const alreadyOwnedCount = useMemo(
    () => matchedEntries.filter((entry) => ownedItemIds.has(entry.item.id)).length,
    [matchedEntries, ownedItemIds],
  );

  /**
   * Read cleanly, no catalogue match. These carry `reading` rather than an
   * `Item`, because there is no item — that is the whole point of the bucket.
   */
  const unmatchedEntries = useMemo(
    () => detections.filter((d) => d.outcome === 'unmatched' && d.reading !== undefined),
    [detections],
  );

  const duplicateEntries = useMemo(
    () =>
      detections
        .filter((d) => d.outcome === 'duplicate' && d.itemId !== null)
        .map((d) => ({ detection: d, item: items.get(d.itemId!) }))
        .filter((entry): entry is { detection: ScanDetection; item: Item } => entry.item !== undefined),
    [detections, items],
  );

  /**
   * Every title's catalogue, for the wrong-game check below. Loaded once on
   * mount rather than per scan: it is the same static catalogue every time, and
   * fetching it while the Review screen is already on screen would make the
   * warning appear a beat after the list it is about.
   */
  const [fullCatalogue, setFullCatalogue] = useState<readonly Item[]>([]);
  useEffect(() => {
    let live = true;
    void catalogueService.getAllItems().then((all) => {
      if (live) setFullCatalogue(all);
    });
    return () => {
      live = false;
    };
  }, []);

  /**
   * "You read Valorant skins but picked CODM."
   *
   * The scan cannot mis-assign a game — it only ever sees the selected title's
   * catalogue — so a wrong-game upload surfaces as a pile of unreadable items
   * with no explanation. This finds the explanation locally (`domain/scan.ts`),
   * with no model call.
   */
  /** Catalogue by id, for the Complete step's suggestion previews. */
  const catalogueById = useMemo(
    () => new Map(fullCatalogue.map((item) => [item.id, item])),
    [fullCatalogue],
  );

  /**
   * Low-confidence reads, offered only when the scan produced NOTHING else.
   *
   * A detection below the floor is discarded, and that is the right default: it
   * keeps a guess out of someone's inventory, and the measured behaviour is
   * that the floor separates correct identifications from incorrect ones.
   *
   * But when EVERY detection was discarded, the screen becomes a dead end —
   * "0 items detected", a disabled CTA, and a footnote saying something was
   * read but withheld. The user can see we found something and has no way to
   * act on it, which reads as broken rather than as cautious. That is the
   * common outcome for a single-item photo, where one render carries less
   * evidence than a labelled tile.
   *
   * So they are surfaced here, clearly labelled as uncertain and confirmed one
   * at a time. The floor is untouched — nothing auto-accepts, nothing is
   * pre-selected, and the user is told the confidence. Rescuing these by
   * lowering the threshold instead would also let the wrong reads through.
   */
  const rescuable = useMemo(() => {
    const somethingElseSurvived =
      counts.matched > 0 || counts.needsReview > 0 || counts.unmatched > 0;
    if (somethingElseSurvived) return [];

    return detections
      .filter((d) => d.outcome === 'discarded' && d.itemId !== null && items.has(d.itemId))
      .map((d) => ({ detection: d, item: items.get(d.itemId!)! }));
  }, [detections, items, counts]);

  /**
   * Below-floor reads that matched NOTHING in the catalogue.
   *
   * Distinct from `rescuable`, and the distinction is the whole point. A
   * rescuable read has a candidate the user can confirm; these have none —
   * the scanner saw an item and could not find it among the ~60 seeded per
   * title (§16 Q1), which is a normal outcome for a real skin we simply do not
   * carry.
   *
   * They existed before and were silently counted as "couldn't read", which is
   * the wrong explanation: nothing failed to read, the catalogue just does not
   * have it. Surfacing them separately is what lets the screen say so.
   */
  const unrecognised = useMemo(() => {
    const somethingElseSurvived =
      counts.matched > 0 || counts.needsReview > 0 || counts.unmatched > 0;
    if (somethingElseSurvived) return [];
    return detections.filter(
      (d) => d.outcome === 'discarded' && d.itemId === null && d.reading !== undefined,
    );
  }, [detections, counts]);


  /** Pick the screenshot to scan. The file is real even though the read is not. */
  async function chooseUpload() {
    const picked = await mediaService.pickImage({ multiple: true });
    switch (picked.status) {
      case 'picked':
        /* Appended, not replaced. Picking again is how a user adds a second
           screenshot, and browsers only allow one dialog per gesture — so
           replacing would make a two-file import impossible to assemble in
           two goes. */
        setUploads((prev) => [...prev, picked.image]);
        setUploadNote(null);
        return;
      case 'picked-many':
        setUploads((prev) => [...prev, ...picked.images]);
        setUploadNote(null);
        return;
      case 'unsupported-type':
        setUploadNote(`${picked.name} isn't a PNG or JPG.`);
        return;
      case 'too-large':
        setUploadNote(`${picked.name} is ${formatBytes(picked.bytes)} — keep uploads under 8 MB.`);
        return;
      case 'unavailable':
        setUploadNote('File picking needs the web build — the prepared recording is used instead.');
        return;
      case 'cancelled':
        return;
    }
  }

  async function runScan() {
    const run = (runId.current += 1);
    setStage('scanning');
    setProgress(0);

    /**
     * One scan per uploaded image, merged.
     *
     * Sequential rather than parallel: each is a vision call on the largest
     * model in the app, and firing six at once on conference wifi is how a
     * demo times out. It also lets the progress bar mean something — each
     * image advances its share of the whole.
     *
     * Detections are concatenated and re-routed together at the end, which is
     * what makes cross-FILE deduplication work: `routeDetections` marks the
     * second sighting of an item id a `duplicate`, and it cannot tell — or
     * need to — whether the first came from another frame or another file.
     */
    const sources =
      uploads.length > 0 ? uploads.map((u) => u.uri) : [`demo://${title}-inventory`];

    const collected: ScanDetection[] = [];
    /**
     * The batch is only "live" if EVERY image was. One fallback taints it —
     * the Review header must not claim the whole set was read from the uploads
     * when part of it is a prepared fixture (§12.1's honesty rule).
     */
    let degraded: ScanResult['source'] | null = null;
    let sourceDetail: string | undefined;

    for (const [index, uri] of sources.entries()) {
      const part = await scanService.scan({ kind, uri, title }, (fraction) => {
        if (runId.current === run) setProgress((index + fraction) / sources.length);
      });
      if (runId.current !== run) return;
      collected.push(...part.detections);
      if (part.source !== 'live') {
        degraded = part.source;
        sourceDetail = part.sourceDetail ?? sourceDetail;
      }
    }

    const scan: ScanResult = {
      id: `scan-${title}-${sources.length}`,
      title,
      durationMs: 0,
      detections: routeDetections(collected),
      source: degraded ?? 'live',
      sourceDetail,
    };
    if (runId.current !== run) return;

    // Every item id the Review and Needs Review screens can possibly show.
    const ids = new Set<string>();
    for (const detection of scan.detections) {
      if (detection.itemId) ids.add(detection.itemId);
      for (const candidate of detection.candidateItemIds) ids.add(candidate);
    }
    const catalogue = await catalogueService.getItems([...ids]);
    if (runId.current !== run) return;

    setItems(new Map(catalogue.map((item) => [item.id, item])));
    setResult(scan);
    setStage('review');
  }

  function cancelScan() {
    runId.current += 1;
    setProgress(0);
    setStage('upload');
  }

  function resolve(detectionId: string, itemId: string | null) {
    setResolutions((prev) => [
      ...prev.filter((r) => r.detectionId !== detectionId),
      { detectionId, itemId },
    ]);
  }

  /**
   * "Every auto-accepted item is reversible in Review." — §11 F1 acceptance
   * criteria. Removing writes a null resolution; restoring drops the resolution
   * entirely rather than writing a second kind of record, so `domain/scan.ts`
   * stays the only place that decides what "included" means.
   */
  function toggleMatch(detectionId: string) {
    setResolutions((prev) =>
      isMatchIncluded(detectionId, prev)
        ? [...prev.filter((r) => r.detectionId !== detectionId), { detectionId, itemId: null }]
        : prev.filter((r) => r.detectionId !== detectionId),
    );
  }

  async function runImport() {
    const itemIds = scanService.itemIdsToImport(detections, resolutions);
    const confidence = new Map(
      detections.filter((d) => d.itemId).map((d) => [d.itemId!, d.confidence]),
    );
    // §11 F1 step 6 — items land `unverified`; the service enforces it.
    const imported = await inventoryService.importFromScan(viewerId, itemIds, confidence);
    await refreshInventory();
    setImportedCount(imported.length);
    /**
     * Kept so Verify can scope the account link to this import.
     *
     * `itemIds` rather than `imported`, deliberately: `importFromScan` writes
     * nothing for items the inventory already held, so re-scanning the same
     * screenshot returns an empty array. Those items are still exactly what the
     * user just asked to import and still the ones they expect Verify to
     * confirm — scoping to `imported` would make the button do nothing on a
     * second run, which is the case most likely to be hit while rehearsing.
     */
    setImportedItemIds(itemIds);
    // One of exactly three success haptics in the app — the three rungs of the
    // never-cut chain (§14). Firing it anywhere else dilutes what it means.
    haptics.success();
    /**
     * Verify, not complete. The items are written and unverified at this point,
     * which is precisely what makes the offer meaningful — `linkAccount`
     * promotes items that already exist, so this is the first moment the step
     * can do anything, and the last moment the user is still thinking about
     * these particular items.
     */
    setStage('verify');

    // The bridge into J2. Suggestions are computed from what the user now owns,
    // so this reflects the import that just happened, not a canned list.
    setSuggesting(true);
    const owned = await inventoryService.getOwnedItems(viewerId);
    setNextUp(await collectionService.suggest(owned, viewerId));
    setSuggesting(false);
  }

  /**
   * Link the game account the items were just imported from — the ONLY path to
   * a verified item (§9.3). Mocked, and the step says so on screen.
   *
   * Scoped to `importedItemIds`. Connecting an account here confirms THIS
   * import, not the whole account: someone who imports three skins expects
   * three to turn verified, and having the rest of their library flip at the
   * same time is both surprising and not undoable item by item. The full-account
   * sweep still lives on the link-account screen, where that is what was asked
   * for.
   */
  async function verifyNow() {
    setLinking(true);
    setLinkProgress(0);
    const outcome = await inventoryService.linkAccount(
      viewerId,
      title,
      setLinkProgress,
      importedItemIds,
    );
    // Every screen reading the viewer's inventory has to see the new trust
    // levels, not just this one.
    await refreshInventory();
    setLinkResult({ verified: outcome.verified.length });
    setLinking(false);
  }

  function goBack() {
    if (stage === 'needs-review') return setStage('review');
    if (stage === 'upload') return setStage('landing');
    if (stage === 'scanning') return cancelScan();
    /**
     * Verify has no "back". The import is already committed by the time it
     * renders, so Review is no longer a place that can be returned to — going
     * there would offer to re-decide items that are already in the inventory.
     * Back therefore means the same thing the skip button means: carry on
     * unverified. Sending it forward rather than out of the flow keeps the
     * import → collection bridge (§14) that Complete carries.
     */
    if (stage === 'verify') return setStage('complete');
    return router.back();
  }

  const focused = pending.find((d) => d.id === focusId) ?? pending[0];

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      /* The native header is off for this route (§13.4 — the nav row below
         carries the stage title, so a stack header duplicated it). That means
         this screen owns its own top inset. */
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      <View style={styles.navRow}>
        <Pressable onPress={goBack} hitSlop={8}>
          <Text style={styles.back}>←</Text>
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>
          {STAGE_TITLE[stage]}
        </Text>
        <Avatar
            name={viewer?.displayName ?? '?'}
            avatarId={viewer?.avatar}
            verified={viewer?.isAccountVerified}
            size={36}
          />
      </View>

      <FlowStepper steps={IMPORT_STEPS} current={STAGE_STEP[stage]} />

      {/* The whole stage body cross-fades on every stage change. `key={stage}`
          is what does it — remounting is how you get an entrance out of a
          conditional. The nav row and stepper stay put on purpose: they are the
          fixed frame the stages move inside, and animating them too would read
          as a page transition rather than a step.

          `gap` is restored here because this wrapper otherwise swallows the
          contentContainer's gap between the blocks below. */}
      <FadeInView key={stage} style={styles.stageBody}>
      {stage === 'landing' ? (
        <View style={styles.block}>
          <Text style={styles.title}>Which game are you importing from?</Text>
          <Text style={styles.body}>
            Picking a title lets Collectee use game-specific recognition to identify skins and items
            more accurately.
          </Text>

          {/* Titles come from the service — the catalogue decides, not this screen. */}
          <View style={styles.gameRow}>
          {scanService.availableTitles().map((option) => (
            <Pressable
              key={option}
              onPress={() => {
                setTitle(option);
                setStage('upload');
              }}
              style={[styles.gameCard, option === title && styles.gameCardActive]}
            >
              {/* The game's own cover, not an item render: this card is asking
                  which title you are importing FROM, so it has to read as the
                  game rather than as something in your inventory.

                  `contain` with an explicit 100% box. React Native Web can
                  otherwise paint an absolute image at its intrinsic pixels and
                  let the card clip the top-left corner, which hides the focal
                  art on these wide covers. The cards share the images' 16:10
                  ratio, so containing still fills the frame without bars. */}
              <Image
                source={GAME_COVERS[option]}
                style={styles.gameArtImage}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />

              {/* Same construction as the collection and showroom cards: a
                  clear-to-heavy fade with the meta sitting on it. */}
              <LinearGradient
                colors={[scrim.clear, scrim.medium, scrim.heavy]}
                locations={[0, 0.45, 1]}
                style={styles.gameCardScrim}
                pointerEvents="none"
              />

              <View style={styles.gameCardMeta} pointerEvents="none">
                {/*
                  The title carries the game's own accent, matching the hero's
                  row and every GameBadge in the app — so "amber = CODM" holds
                  here too.

                  "✓ Scanner supported" is gone. All three are supported, so it
                  was the same line on every card saying nothing that
                  distinguished them — and the screen is asking which game you
                  are importing from, not whether it works.
                */}
                <Text
                  style={[styles.gameCardName, { color: gameAccents[option].secondary }]}
                  numberOfLines={2}
                >
                  {GAME_LABELS[option]}
                </Text>
              </View>
            </Pressable>
          ))}
          </View>
        </View>
      ) : null}

      {stage === 'upload' ? (
        <View style={styles.block}>
          <Text style={styles.body}>
            Upload a screenshot or a screen recording of your in-game inventory. Items are read
            automatically — you never type a name.
          </Text>

          <View style={styles.selectedGame}>
            <Text style={styles.muted}>{GAME_LABELS[title]}</Text>
            <Pressable onPress={() => setStage('landing')} hitSlop={8}>
              <Text style={styles.change}>Change</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>Source</Text>
          {/* §14 rung 4: flip FEATURES.scanVideoInput and this becomes screenshots only. */}
          <FilterChips
            options={FEATURES.scanVideoInput ? (['video', 'image'] as const) : (['image'] as const)}
            value={kind}
            onChange={setKind}
          />

          {/* An image source takes real files; video stays the prepared recording. */}
          {kind === 'image' && uploads.length > 0 ? (
            <View style={styles.uploadList}>
              {uploads.map((file, index) => (
                <View key={`${file.name}-${index}`} style={styles.dropFilled}>
                  <Image
                    source={{ uri: file.uri }}
                    style={styles.dropPreview}
                    resizeMode="cover"
                    accessible
                    accessibilityLabel={`Selected screenshot: ${file.name}`}
                  />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={styles.muted}>{formatBytes(file.bytes)}</Text>
                  </View>
                  {/* Per-file remove. With one upload "Change" was enough;
                      with several, the only useful action on a row is dropping
                      that row. */}
                  <Pressable
                    onPress={() => setUploads((prev) => prev.filter((_, i) => i !== index))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${file.name}`}
                  >
                    <Text style={styles.change}>Remove</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.addMore} onPress={() => void chooseUpload()}>
                <Text style={styles.change}>＋ Add another screenshot</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={kind === 'video' ? styles.dropStatic : styles.dropZone}
              onPress={kind === 'image' ? () => void chooseUpload() : undefined}
              disabled={kind === 'video'}
            >
              <Text style={styles.dropGlyph}>{kind === 'video' ? '▶' : '⇪'}</Text>
              <Text style={styles.body}>
                {kind === 'video' ? 'inventory-scroll.mp4' : 'Choose screenshots'}
              </Text>
              <Text style={styles.muted}>
                {kind === 'video'
                  ? 'Prepared recording · no file needed — press Start scan'
                  : 'PNG or JPG, up to 8 MB each · pick as many as you like'}
              </Text>
            </Pressable>
          )}

          {uploadNote ? <Text style={styles.warn}>{uploadNote}</Text> : null}

          {/*
            An image scan needs an image. Without this gate the screen happily
            "scans" nothing — it substitutes a `demo://` URI, fails the live
            predicate on the way past, and lands on a Review screen full of
            items the user never uploaded. That is not a scan with no input, it
            is a scan of a different inventory, and it read as a bug to everyone
            who tried it. Video keeps its own path: there is no file to pick.
          */}
          <PrimaryButton
            label="Start scan"
            onPress={() => void runScan()}
            disabled={kind === 'image' && uploads.length === 0}
          />
          {/*
            §12.1's honesty rule, and the one piece of copy on this screen that
            must never drift from the code: the two paths look identical once
            the Review screen renders, so this is the only place the user is
            told which one they are about to take. It reads the same predicate
            the service does rather than a second guess at it.
          */}
          <Text style={styles.footnote}>
            {kind === 'image' && uploads.length === 0
              ? 'Choose at least one screenshot — there is nothing to scan yet.'
              : scanMode === 'live'
                ? `${uploads.length === 1 ? 'Your screenshot is' : `All ${uploads.length} screenshots are`} sent to a vision model, which reads the item names and rarity borders. If it cannot be reached, a prepared result is shown instead and says so.`
                : kind === 'video'
                  ? 'Screen recordings use the prepared set for this title — frame sampling is not built (§12.1, §14 rung 4).'
                  : 'No scanner endpoint is configured, so the results below are prepared rather than read from your upload (§12.1).'}
          </Text>
        </View>
      ) : null}

      {stage === 'scanning' ? (
        <View style={styles.block}>
          <ScanPreview />

          <Text style={styles.percent}>{Math.round(progress * 100)}%</Text>
          <Text style={styles.scanHead}>Identifying your items</Text>
          <Text style={styles.bodyCentre}>
            Collectee is analysing the item names and artwork in your uploads.
          </Text>

          {/*
            The checklist is derived from `progress`, not tracked alongside it:
            one number decides which row is ticked, which is spinning and which
            is still waiting, so the list cannot disagree with the percentage.
          */}
          <View style={styles.checklist}>
            {SCAN_STAGES.map((label, index) => {
              const reached = progress * SCAN_STAGES.length;
              const done = index < Math.floor(reached);
              const active = !done && index === Math.floor(reached);
              return (
                <View key={label} style={styles.checkRow}>
                  <View
                    style={[
                      styles.checkMark,
                      done && styles.checkMarkDone,
                      active && styles.checkMarkActive,
                    ]}
                  >
                    <Text style={[styles.checkGlyph, (done || active) && styles.checkGlyphOn]}>
                      {done ? '✓' : active ? '◌' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.checkLabel, (done || active) && styles.checkLabelOn]}>
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoGlyph}>ⓘ</Text>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>You can leave this screen.</Text>
              <Text style={styles.muted}>
                We&apos;ll notify you when the scan is complete. [ROADMAP] — this demo scans in the
                foreground, so cancelling and leaving are the same thing today.
              </Text>
            </View>
          </View>

          <SecondaryButton label="Cancel scan" onPress={cancelScan} />
        </View>
      ) : null}

      {stage === 'review' && result ? (
        <View style={styles.block}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryHead}>
              <View style={styles.sparkle}>
                <Text style={styles.sparkleGlyph}>✦</Text>
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.countHead}>{counts.detected} items detected</Text>
                {/*
                  WHERE THESE NUMBERS CAME FROM, on the screen that shows them.
                  Without this line a failed live scan is pixel-identical to a
                  successful one, so nobody can tell a broken endpoint from a
                  working demo — and the fallback quietly presents a canned
                  scan as a reading of the file the user just picked. §12.1
                  says label every mocked surface; this is that label.
                */}
                <Text style={result.source === 'fallback' ? styles.warn : styles.muted}>
                  {result.source === 'live'
                    ? 'Read from your upload just now.'
                    : result.source === 'fallback'
                      ? "Couldn't reach the scanner — this is a prepared result, not a reading of your upload."
                      : 'Prepared set for this title — no scanner endpoint is configured.'}
                </Text>
                {/*
                  The cause, not just the symptom. Every fallback looks the same
                  from here — stale deploy, wrong URL, timeout, an image that
                  would not encode — and they have four different fixes. This
                  was already going to the console; the person holding the phone
                  during a demo is not reading the console.
                */}
                {result.sourceDetail ? (
                  <Text style={styles.muted}>Reason: {result.sourceDetail}.</Text>
                ) : null}
              </View>
            </View>

            {/* The invariant, as three columns: detected = matched + review + dupes. */}
            <View style={styles.statRow}>
              <Stat
                glyph="✓"
                value={counts.matched}
                label="Matched"
                note="Ready to import"
                noteStyle={styles.noteGood}
              />
              <Stat
                glyph="?"
                value={counts.needsReview}
                label="Possible matches"
                note="Needs review"
                noteStyle={styles.noteWarn}
              />
              <Stat
                glyph="⧉"
                value={counts.duplicates}
                label="Duplicates"
                note="Will be skipped"
                noteStyle={styles.noteMuted}
              />
            </View>

            {/*
              Said BEFORE the button, not after. The Complete screen already
              explained this, which is one press too late — the CTA counts these
              items and then nothing happens to them.
            */}
            {alreadyOwnedCount > 0 ? (
              <Text style={styles.muted}>
                {alreadyOwnedCount} of these {alreadyOwnedCount === 1 ? 'is' : 'are'} already in
                your inventory and {alreadyOwnedCount === 1 ? 'will not be added' : 'will not be added'}{' '}
                again
              </Text>
            ) : null}
            {counts.discarded > 0 ? (
              <Text style={styles.warn}>
                {/*
                  No threshold, no decimal. "below the 0.6 floor" is an
                  implementation detail — it tells the user what our routing
                  constant is and nothing about their upload. The two outcomes
                  they can act on are "we weren't sure" and "it isn't in our
                  catalogue", and those are stated below rather than summed
                  into a number here.
                */}
                {counts.discarded} {counts.discarded === 1 ? 'item was' : 'items were'} too
                uncertain to add on their own — see below
              </Text>
            ) : null}
            {/*
              Deliberately a separate line from the one above, and deliberately
              worded as "we don't have" rather than "we couldn't read". These
              were read correctly; the catalogue is the thing that is missing
              (§16 Q1 — ~60 seeded items per title, not an exhaustive one).
              Collapsing the two would tell the user their screenshot was bad
              when in fact our data was.
            */}
            {counts.unmatched > 0 ? (
              <Text style={styles.warn}>
                {counts.unmatched} we read but don&apos;t have in the {GAME_LABELS[title]} catalogue
                yet — not in the total, and they can&apos;t be imported
              </Text>
            ) : null}
          </View>

          {/*
            ── Wrong game ──────────────────────────────────────────────────
            Placed directly under the counts, because it is the explanation for
            the "not in our catalogue" line immediately above it. Read in the
            other order it looks like two unrelated problems.

            Only rendered when the readings actually matched another title's
            catalogue (see `foreignTitleMatches` — exact name or two shared
            significant tokens). A vaguer rule would offer to throw away a good
            scan on a coincidence, which is worse than saying nothing.
          */}
          {wrongGame ? (
            <View style={styles.wrongGame}>
              <Text style={styles.wrongGameTitle}>
                {wrongGame.matches.length === 1 ? 'This looks like a' : 'These look like'}{' '}
                {GAME_LABELS[wrongGame.title]}{' '}
                {wrongGame.matches.length === 1 ? 'item' : 'items'}
              </Text>
              <Text style={styles.body}>
                You picked {GAME_LABELS[title]}, so nothing in that catalogue matched. The closest
                we found {wrongGame.matches.length === 1 ? 'is' : 'are'} in{' '}
                {GAME_LABELS[wrongGame.title]}. Check{' '}
                {wrongGame.matches.length === 1 ? 'it' : 'them'} and confirm if we got it right.
              </Text>

              {/*
                Confirm the item, do not re-run the scan.
                The item EXISTS in our catalogue — it is simply filed under a
                different game — so sending the user back to Upload to scan the
                same picture again was asking them to redo work to reach a
                result we already have. Confirming adds it directly;
                `resolvedItemIds` honours a resolution on an unmatched
                detection for exactly this.
              */}
              {wrongGame.matches.map((match) => {
                const confirmed = resolutions.some(
                  (r) => r.detectionId === match.detectionId && r.itemId !== null,
                );
                return (
                  <Pressable
                    key={match.detectionId}
                    style={[styles.pendingRow, confirmed && styles.rescueRowOn]}
                    onPress={() =>
                      confirmed
                        ? setResolutions((prev) =>
                            prev.filter((r) => r.detectionId !== match.detectionId),
                          )
                        : resolve(match.detectionId, match.itemId)
                    }
                  >
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {match.itemName}
                      </Text>
                      <Text style={styles.muted} numberOfLines={1}>
                        We read: {match.reading} · {GAME_LABELS[wrongGame.title]}
                      </Text>
                    </View>
                    {/* A labelled button, not a glyph. "＋" reads as "add
                        another", which is the opposite of what this does —
                        it accepts a suggestion the app is unsure about, and
                        that is a decision worth naming. */}
                    <View style={[styles.confirmChip, confirmed && styles.confirmChipOn]}>
                      <Text style={[styles.confirmChipText, confirmed && styles.confirmChipTextOn]}>
                        {confirmed ? '✓ Added' : 'Confirm'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}

              <Text style={styles.footnote}>
                Adding {wrongGame.matches.length === 1 ? 'it' : 'them'} here files{' '}
                {wrongGame.matches.length === 1 ? 'it' : 'them'} under{' '}
                {GAME_LABELS[wrongGame.title]} — your inventory holds every game at once, so there
                is no need to scan again.
              </Text>
            </View>
          ) : null}

          {/*
            ── Rescued low-confidence reads ────────────────────────────────
            Only when the scan produced nothing else. Above the filter chips
            because at this point it is the entire content of the screen —
            everything below it is empty, and burying the one actionable thing
            under five empty sections is how the dead end happened.
          */}
          {rescuable.length > 0 ? (
            <View style={styles.rescue}>
              <Text style={styles.rescueTitle}>
                We think we saw {rescuable.length === 1 ? 'this' : 'these'} — not sure enough to
                add {rescuable.length === 1 ? 'it' : 'them'} for you
              </Text>
              <Text style={styles.body}>
                A photo of one item gives us less to go on than a full inventory screenshot. Have a
                look and confirm it if we got it right.
              </Text>
              {rescuable.map(({ detection, item }) => {
                const confirmed = resolutions.some(
                  (r) => r.detectionId === detection.id && r.itemId !== null,
                );
                return (
                  <Pressable
                    key={detection.id}
                    style={[styles.pendingRow, confirmed && styles.rescueRowOn]}
                    onPress={() =>
                      confirmed
                        ? setResolutions((prev) =>
                            prev.filter((r) => r.detectionId !== detection.id),
                          )
                        : resolve(detection.id, item.id)
                    }
                  >
                    <ItemArt
                      seed={item.id}
                      tier={item.rarityTier}
                      renderUrl={item.renderUrl}
                      style={styles.dupeThumb}
                    />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <RarityBadge tier={item.rarityTier} title={item.title} />
                      {/*
                        What we saw, in words. The percentage used to be here —
                        it is a number out of a routing function, and a user
                        cannot act on "45%" any better than on "we're not sure".
                        What they CAN act on is what we read off their image,
                        so that is what the line carries.
                      */}
                      <Text style={styles.muted} numberOfLines={2}>
                        {detection.reading?.name
                          ? `We read: ${detection.reading.name}`
                          : 'Matched from the picture rather than a label'}
                      </Text>
                    </View>
                    <Text style={confirmed ? styles.create : styles.chevron}>
                      {confirmed ? '✓' : '+'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/*
            ── Read, but not in our catalogue ──────────────────────────────
            The case that produced "0 items detected" with no explanation: the
            scanner saw the item and found nothing to match it to, so it was
            counted as unreadable. Nothing failed to read — we simply do not
            carry that skin.

            Only shown when the scan produced nothing else, same as the rescue
            block above it, because on a normal multi-item scan this is a
            footnote rather than the story.
          */}
          {unrecognised.length > 0 ? (
            <View style={styles.unrecognised}>
              <Text style={styles.rescueTitle}>
                {unrecognised.length === 1 ? 'This one is' : 'These are'} not in our{' '}
                {GAME_LABELS[title]} catalogue
              </Text>
              {unrecognised.map((detection) => (
                <Text key={detection.id} style={styles.body} numberOfLines={2}>
                  We read: {detection.reading?.name ?? 'an item we could not name'}
                </Text>
              ))}
              <Text style={styles.footnote}>
                Collectee carries a seeded set of {GAME_LABELS[title]} items for this build, not
                every skin in the game — so a real skin can be read correctly and still have
                nothing to match. It cannot be added until the catalogue covers it.
              </Text>
            </View>
          ) : null}

          <FilterChips options={REVIEW_FILTERS} value={reviewFilter} onChange={setReviewFilter} />

          {/* ── Matched ─────────────────────────────────────────────────── */}
          {reviewFilter === 'All' ? (
            <View style={styles.block}>
              <SeeAllRow
                title="Matched items"
                count={counts.matched}
                onSeeAll={() => setReviewFilter('Matched')}
              />
              <View style={styles.grid}>
                {matchedEntries.slice(0, PREVIEW_MATCHED).map(({ detection, item }) => (
                  <MatchedTile
                    key={detection.id}
                    item={item}
                    included={isMatchIncluded(detection.id, resolutions)}
                    onToggle={() => toggleMatch(detection.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* §11 F1 step 6 — "Review screen groups detected items by rarity". */}
          {reviewFilter === 'Matched' ? (
            <View style={styles.block}>
              <Text style={styles.footnote}>
                Tap any item to leave it out — nothing here is final until you import.
              </Text>
              {matchedGroups.map((group) => (
                <View key={group.tier} style={styles.block}>
                  <Text style={styles.tierHead}>
                    {rarityLabelFor(group.tier, title)} · {group.items.length}
                  </Text>
                  <View style={styles.grid}>
                    {group.items.map(({ detection, item }) => (
                      <MatchedTile
                        key={detection.id}
                        item={item}
                        included={isMatchIncluded(detection.id, resolutions)}
                        owned={ownedItemIds.has(item.id)}
                        onToggle={() => toggleMatch(detection.id)}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {/* ── Needs review ────────────────────────────────────────────── */}
          {(reviewFilter === 'All' || reviewFilter === 'Needs review') && pending.length > 0 ? (
            <View style={styles.block}>
              {reviewFilter === 'All' ? (
                <SeeAllRow
                  title="Needs review"
                  count={pending.length}
                  onSeeAll={() => setReviewFilter('Needs review')}
                />
              ) : (
                <Text style={styles.footnote}>
                  We read these but aren&apos;t confident enough to add them silently.
                </Text>
              )}
              <View style={styles.grid}>
                {(reviewFilter === 'All' ? pending.slice(0, PREVIEW_NEEDS_REVIEW) : pending).map(
                  (detection) => (
                    <PossibleMatch
                      key={detection.id}
                      detection={detection}
                      item={detection.itemId === null ? undefined : items.get(detection.itemId)}
                      onConfirm={() => resolve(detection.id, detection.itemId)}
                      onChange={() => {
                        setFocusId(detection.id);
                        setStage('needs-review');
                      }}
                    />
                  ),
                )}
              </View>
            </View>
          ) : null}

          {reviewFilter === 'Needs review' && pending.length === 0 ? (
            <EmptyState
              title="Nothing left to review"
              body="Every uncertain detection has a decision."
            />
          ) : null}

          {/* ── Read, not in the catalogue ──────────────────────────────── */}
          {(reviewFilter === 'All' || reviewFilter === 'Not in catalogue') &&
          unmatchedEntries.length > 0 ? (
            <View style={styles.block}>
              {reviewFilter === 'All' ? (
                <SeeAllRow
                  title="Not in catalogue"
                  count={unmatchedEntries.length}
                  onSeeAll={() => setReviewFilter('Not in catalogue')}
                />
              ) : (
                <Text style={styles.footnote}>
                  We read these clearly, but they aren&apos;t in our{' '}
                  {GAME_LABELS[title]} catalogue, so there&apos;s nothing to import them as.
                </Text>
              )}
              {(reviewFilter === 'All' ? unmatchedEntries.slice(0, PREVIEW_UNMATCHED) : unmatchedEntries).map(
                (detection) => (
                  <UnmatchedRow key={detection.id} detection={detection} title={title} />
                ),
              )}
            </View>
          ) : null}

          {reviewFilter === 'Not in catalogue' && unmatchedEntries.length === 0 ? (
            <EmptyState
              title="Everything matched"
              body="Every item we read is in the catalogue."
            />
          ) : null}

          {/* ── Duplicates ──────────────────────────────────────────────── */}
          {reviewFilter === 'All' || reviewFilter === 'Duplicates' ? (
            duplicateEntries.length === 0 ? (
              reviewFilter === 'Duplicates' ? (
                <EmptyState title="No duplicates" body="Nothing repeated across frames." />
              ) : null
            ) : (
              <View style={styles.block}>
                <Pressable
                  style={styles.dupeRow}
                  onPress={() => setDupesOpen((prev) => !prev)}
                  hitSlop={4}
                >
                  <Text style={styles.dupeGlyph}>⧉</Text>
                  <Text style={styles.dupeText}>
                    {counts.duplicates} duplicate upload{counts.duplicates === 1 ? '' : 's'} will be
                    skipped
                  </Text>
                  <Text style={styles.chevron}>{dupesOpen ? '⌃' : '⌄'}</Text>
                </Pressable>

                {dupesOpen || reviewFilter === 'Duplicates'
                  ? duplicateEntries.map(({ detection, item }) => (
                      <View key={detection.id} style={styles.pendingRow}>
                        <ItemArt seed={item.id} tier={item.rarityTier} style={styles.dupeThumb} />
                        <View style={styles.rowBody}>
                          <Text style={styles.rowTitle} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.muted}>
                            Already counted from an earlier frame · frame {detection.frameIndex}
                          </Text>
                        </View>
                      </View>
                    ))
                  : null}
              </View>
            )
          ) : null}

          <PrimaryButton
            label={`⤓  Import ${counts.confirmed} confirmed items`}
            disabled={!fullyResolved || counts.confirmed === 0}
            onPress={() => void runImport()}
          />
          {!fullyResolved ? (
            <Text style={styles.footnote}>
              Resolve the {pending.length} possible match{pending.length === 1 ? '' : 'es'} first —
              the count above updates as you go.
            </Text>
          ) : null}
          {/*
            The routing rule in words, not thresholds.

            "≥ 0.9 auto-accepted · 0.6–0.9 needs review · below 0.6 discarded"
            described our constants rather than the user's items. The three
            outcomes are real and worth stating — it is why some items landed
            straight in and others are waiting — but they are stated as
            outcomes.
          */}
          <Text style={styles.footnote}>
            Clear matches are added for you. Anything we are less sure of waits here for you to
            confirm, and anything we cannot place is left out.
          </Text>
        </View>
      ) : null}

      {stage === 'needs-review' ? (
        <View style={styles.block}>
          {focused === undefined ? (
            <EmptyState
              title="Nothing left to review"
              body="Every uncertain detection has a decision."
              actionLabel="Back to review"
              onAction={() => setStage('review')}
            />
          ) : (
            <NeedsReviewCard
              detection={focused}
              items={items}
              onConfirm={(itemId) => {
                resolve(focused.id, itemId);
                setFocusId(null);
              }}
              onReject={() => {
                resolve(focused.id, null);
                setFocusId(null);
              }}
            />
          )}

          <Text style={styles.footnote}>
            {counts.needsReview - pending.length} of {counts.needsReview} resolved · CTA now reads{' '}
            {counts.confirmed}
          </Text>
          <SecondaryButton label="Back to review" onPress={() => setStage('review')} />
        </View>
      ) : null}

      {/* ── Verify ─────────────────────────────────────────────────────────
          Step 4 of 5. Everything here is an OFFER: the items are already in the
          inventory, and skipping is a supported outcome rather than a failure
          state. What it must not do is let someone skip without knowing what
          they gave up — hence the consequences below, which are the four real
          ones and not a generic "verify for the best experience".
       */}
      {stage === 'verify' ? (
        <View style={styles.block}>
          {linkResult ? (
            <>
              <Text style={styles.done}>✓</Text>
              <Text style={styles.title}>
                {linkResult.verified} {linkResult.verified === 1 ? 'item' : 'items'} verified
              </Text>
              <Text style={styles.body}>
                {linkResult.verified > 0
                  ? `Your ${GAME_LABELS[title]} account is connected. These items can go in a showroom, and they now count towards how other collectors match with you.`
                  : 'Everything on this account was already verified, so nothing changed.'}
              </Text>
              <PrimaryButton label="Continue" onPress={() => setStage('complete')} />
            </>
          ) : (
            <>
              <Text style={styles.title}>
                {importedCount > 0
                  ? `${importedCount} ${importedCount === 1 ? 'item is' : 'items are'} unverified`
                  : 'Verify your inventory'}
              </Text>
              <Text style={styles.body}>
                A scan proves what an item looks like, not who owns it — so everything imported
                lands unverified. Connecting your {GAME_LABELS[title]} account reads the inventory
                back and confirms which of these are actually yours.
              </Text>
              {/* Says what will and will not change. Without this the step reads
                  as an offer to verify the whole account, and the number that
                  comes back looks wrong. */}
              <Text style={styles.footnote}>
                This confirms the {importedItemIds.length}{' '}
                {importedItemIds.length === 1 ? 'item' : 'items'} from this import only. Anything
                else in your {GAME_LABELS[title]} inventory stays as it is — verify it from Profile
                when you want to.
              </Text>

              {/* The four consequences of skipping. Each one is enforced in code. */}
              <View style={styles.consequences}>
                <Text style={styles.consequenceHead}>If you skip this</Text>
                <Text style={styles.consequence}>
                  ✗ Unverified items cannot be placed in a 3D showroom (§9.4)
                </Text>
                <Text style={styles.consequence}>
                  ✗ They can only go in a normal 2D collection
                </Text>
                <Text style={styles.consequence}>
                  ✗ Other collectors see them badged as unverified
                </Text>
                <Text style={styles.consequence}>
                  ✗ Collections of unverified items rank below verified ones in other people&apos;s
                  feeds
                </Text>
                <Text style={styles.footnote}>
                  None of this is permanent — you can connect an account at any time from Profile,
                  and everything you own is promoted at once.
                </Text>
              </View>

              {linking ? (
                <View style={styles.block}>
                  <Text style={styles.muted}>Reading your {GAME_LABELS[title]} inventory…</Text>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.round(linkProgress * 100)}%` }]} />
                  </View>
                </View>
              ) : canLinkTitle ? (
                <PrimaryButton
                  label={`Connect ${GAME_LABELS[title]} account`}
                  onPress={() => void verifyNow()}
                />
              ) : (
                /* §14 rung 5 — MLBB is cut, so there is nothing to connect to.
                   Saying so is better than a button that cannot work. */
                <Text style={styles.warn}>
                  {GAME_LABELS[title]} account linking is not available yet, so these items stay
                  unverified for now.
                </Text>
              )}

              <SecondaryButton
                label={linking ? 'Verifying…' : 'Verify later'}
                onPress={() => setStage('complete')}
              />

              {/* §12.1's honesty rule. The same words as the link-account screen,
                  because it is the same mocked flow and a demo must not imply
                  two different levels of realness for one mechanism. */}
              <Text style={styles.footnote}>
                This OAuth flow is mocked (§12.1). No publisher API is called and no credentials are
                collected — none of the launch titles exposes a public cosmetic-inventory API, so a
                real Verified tier is partnership-gated (§9.3).
              </Text>
            </>
          )}
        </View>
      ) : null}

      {stage === 'complete' ? (
        <View style={styles.block}>
          <Text style={styles.done}>✓</Text>
          {/*
            The headline states the OUTCOME, not a number that happens to be
            zero. Re-running the same screenshot confirms items the inventory
            already holds, `importFromScan` writes none of them, and the old
            copy reported that as "0 items added" under a green tick — which
            read as a broken import to everyone who saw it, rather than as the
            correct answer to "import these again". Singular/plural is fixed
            here too: a one-item import used to say "1 items added".
          */}
          <Text style={styles.title}>
            {importedCount === 0 && alreadyOwned > 0
              ? 'Already in your inventory'
              : `${importedCount} ${importedCount === 1 ? 'item' : 'items'} added`}
          </Text>
          {/* Completion totals equal detected — the Figma's 44-vs-42 bug, fixed. */}
          <Text style={styles.muted}>
            {counts.detected} detected · {counts.confirmed} confirmed · {counts.duplicates}{' '}
            duplicates skipped · {counts.discarded} unreadable
          </Text>
          {/*
            Confirmed minus added is items already in the inventory. Print it:
            an unexplained gap between two totals on the same screen is the exact
            class of bug §11 F1 sends us here to fix. When that gap is the whole
            import it is the headline's explanation rather than a footnote, so it
            takes the body style and names the way back — the same rehearsal
            problem `unlinkAccount` solves for the verification beat.
          */}
          {alreadyOwned > 0 ? (
            <Text style={importedCount === 0 ? styles.body : styles.muted}>
              {importedCount === 0
                ? `All ${counts.confirmed} confirmed ${counts.confirmed === 1 ? 'item was' : 'items were'} already in your inventory, so nothing new was written. Scan a different screenshot, or clear this session's imports from Profile → Developer to run this one again.`
                : `${alreadyOwned} of the ${counts.confirmed} confirmed were already in your inventory`}
            </Text>
          ) : null}
          {/* Gated: with nothing written, "all items landed as unverified" is a
              claim about items that do not exist. */}
          {importedCount > 0 ? (
            <Text style={styles.footnote}>
              All items landed as unverified. Verified ownership needs a linked game account, which
              is partnership-gated (§9.3).
            </Text>
          ) : null}

          {/* The import → collection link in the never-cut chain (§14). */}
          <Text style={styles.label}>Start Organising Your Items</Text>
          <Text style={styles.footnote}>
            Based on what you just imported. Each one is a collection you could make right now —
            the art below is what it would look like.
          </Text>
          {suggesting ? (
            <LoadingState height={160} />
          ) : (
            <View style={styles.suggestionGrid}>
            {nextUp.map((suggestion) => (
              <SuggestionCard
                key={suggestion.name}
                suggestion={suggestion}
                catalogue={catalogueById}
                onPress={() =>
                  router.replace({
                    pathname: '/collection/new',
                    params: {
                      name: suggestion.name,
                      itemIds: suggestion.itemIds.join(','),
                    },
                  })
                }
              />
            ))}
            </View>
          )}

          <PrimaryButton
            label="Create a collection"
            onPress={() => router.replace('/collection/new')}
          />
          <SecondaryButton label="Back to home" onPress={() => router.replace('/')} />
        </View>
      ) : null}
      </FadeInView>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

/**
 * A collection you could make, drawn as the collection rather than described as
 * one.
 *
 * The old row was a name, a reason and a count — three lines of text asking
 * someone to imagine the result. But every item in the suggestion already has
 * art, and the whole premise of the app is that a collection is something you
 * look at. Showing the actual pieces turns "Elderflame Set · 4 items" into a
 * thing with a shape, and it is the same art the collection would really use,
 * not a mock-up of it.
 *
 * The first tile is deliberately larger. A suggestion has a headline item —
 * the rarest thing in it — and a flat strip of equal thumbnails hides that,
 * which makes every suggestion look interchangeable.
 */
function SuggestionCard({
  suggestion,
  catalogue,
  onPress,
}: {
  suggestion: CollectionSuggestion;
  catalogue: ReadonlyMap<string, Item>;
  onPress: () => void;
}) {
  const items = suggestion.itemIds
    .map((id) => catalogue.get(id))
    .filter((item): item is Item => item !== undefined);

  /**
   * Rarest first, so the tile that gets the space is the one worth showing.
   * `groupByRarity` already owns this ordering (§12.2) — sorting on
   * `rarityTier` here rather than a hand-written rarity list keeps the one
   * rule in `domain/rarity.ts`.
   */
  const ordered = groupByRarity(items).flatMap((group) => group.items);
  const hero = ordered[0];
  const rest = ordered.slice(1, 4);
  const overflow = ordered.length - 1 - rest.length;

  return (
    <Pressable style={styles.suggestionCard} onPress={onPress}>
      {hero ? (
        <View style={styles.suggestionArt}>
          <ItemArt
            seed={hero.id}
            tier={hero.rarityTier}
            renderUrl={hero.renderUrl}
            style={styles.suggestionHero}
          />
          <View style={styles.suggestionStrip}>
            {rest.map((item) => (
              <ItemArt
                key={item.id}
                seed={item.id}
                tier={item.rarityTier}
                renderUrl={item.renderUrl}
                style={styles.suggestionThumb}
              />
            ))}
            {overflow > 0 ? (
              <View style={[styles.suggestionThumb, styles.suggestionMore]}>
                <Text style={styles.suggestionMoreText}>+{overflow}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Overlaid, like every other collection card in the app: a clear-to-
          heavy fade over the art's lower band with the meta sitting on it. The
          body panel underneath made this the one card type that spent its
          height twice. */}
      <LinearGradient
        colors={[scrim.clear, scrim.medium, scrim.heavy]}
        locations={[0, 0.45, 1]}
        style={styles.suggestionScrim}
        pointerEvents="none"
      />
      <View style={styles.suggestionMeta} pointerEvents="none">
        <Text style={styles.suggestionName} numberOfLines={1}>
          {suggestion.name}
        </Text>
        {/*
          §11 F5's rule, applied outside Discover: a suggestion without its
          reason is a demand. The reason is what makes it answerable.
        */}
        <Text style={styles.suggestionReason} numberOfLines={2}>
          {suggestion.reason}
        </Text>
        <Text style={styles.suggestionCount}>
          {suggestion.itemIds.length} {suggestion.itemIds.length === 1 ? 'item' : 'items'} · Create →
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Numbered-circle bar with a label under each step, as drawn on every Import
 * frame. The shared `StepperHeader` renders "Step N of M" over plain segments
 * instead, and it belongs to Jovan (§13.3) and is used by J3 as well — so this
 * local one matches the Figma without changing a shared component under someone
 * else's name. J2 carries the same component for the same reason; when Jovan
 * takes the numbered style into `StepperHeader`, both callers collapse into it.
 */
function FlowStepper({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <View style={styles.stepperRow}>
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <View key={label} style={styles.stepCol}>
            <View style={styles.stepLine}>
              <View style={[styles.connector, index > 0 && done && styles.connectorOn]} />
              <View
                style={[styles.circle, active && styles.circleActive, done && styles.circleDone]}
              >
                <Text style={[styles.circleText, (active || done) && styles.circleTextOn]}>
                  {done ? '✓' : index + 1}
                </Text>
              </View>
              <View
                style={[
                  styles.connector,
                  index < steps.length - 1 && index < current && styles.connectorOn,
                ]}
              />
            </View>
            <Text style={[styles.stepLabel, active && styles.stepLabelActive]} numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * The Scan frame's hero: inventory screenshots floating in depth, with a thin
 * beam sweeping across them.
 *
 * Built as INDEPENDENT LAYERS rather than one graphic with a shadow on it —
 * radial glow, five panels at three depths, the beam, a per-panel scan
 * response, and drifting motes. That is what produces parallax and a beam that
 * the cards visibly react to; a single scaled-up graphic cannot fake either.
 *
 * Two constraints shape every choice below, and both are project rules rather
 * than preferences:
 *
 *   - STACKED TRANSLUCENT VIEWS, NOT GRADIENTS. `expo-linear-gradient` is now a
 *     dependency (announced in chat) and is used for flat scrims elsewhere, but
 *     this hero deliberately does not use it: every falloff here is *radial*
 *     and animated, and `LinearGradient` is neither. Concentric rounded blocks
 *     for the glow, four widths of accent for the beam. Read the beam bottom-up
 *     and it is a hot core with colour bleeding outwards, which is what a real
 *     tube does. Do not "simplify" this into a gradient — it loses the parallax.
 *   - NO RAW HEX (CLAUDE.md). Translucency is `backgroundColor: colors.accent`
 *     plus `opacity` on the view, never an rgba() literal.
 *
 * Plain `Animated`, not Reanimated. Reanimated is in package.json but nothing
 * in `src/` uses it, and this is not the screen to be first — every animated
 * property here is a transform or an opacity, which the native driver already
 * handles off the JS thread. `useNativeDriver` is off on web, where
 * react-native-web warns rather than using it.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * The stack, back to front. A table rather than magic numbers inside JSX, so
 * "add another panel at depth 2" is a row and not a rewrite.
 *
 * `x`/`y` are fractions of the stage width — everything scales off one measured
 * number, which is what keeps the composition intact from a small phone to a
 * tablet. `depth` drives both the parallax amplitude and the paint order.
 */
const SCAN_PANELS = [
  { depth: 2, x: -0.33, y: -0.20, scale: 0.56, opacity: 0.2, rotate: '-8deg', cards: 1 },
  { depth: 2, x: 0.33, y: -0.16, scale: 0.56, opacity: 0.2, rotate: '8deg', cards: 1 },
  { depth: 1, x: -0.19, y: 0.1, scale: 0.78, opacity: 0.5, rotate: '-4deg', cards: 2 },
  { depth: 1, x: 0.19, y: 0.13, scale: 0.78, opacity: 0.5, rotate: '4deg', cards: 2 },
  { depth: 0, x: 0, y: 0, scale: 1, opacity: 1, rotate: '0deg', cards: 3 },
] as const;

/** Portrait collectible card, w/h. Fixed so art is never vertically squashed. */
const CARD_ASPECT = 0.72;

/** One direction of the sweep. Slow enough to read as deliberate, not a spinner. */
const SWEEP_MS = 2100;
/** The mechanical beat at each end of the travel. */
const SWEEP_HOLD_MS = 160;

function ScanPreview() {
  const { width } = useWindowDimensions();
  const sweep = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  /* Was a local listener here; it moved to a hook once the skeletons and list
     entrances needed the same answer. Behaviour is unchanged. */
  const reduceMotion = useReduceMotion();

  // Every dimension derives from the stage width, so nothing is hard-coded to
  // one handset. 520 matches the cap the Room flow uses on wide screens.
  const geometry = useMemo(() => {
    const stageW = Math.min(width, 520) - spacing.lg * 2;
    const cardW = Math.round(stageW * 0.17);
    const cardH = Math.round(cardW / CARD_ASPECT);
    const pad = 6;
    const gap = 4;
    const panelH = cardH + pad * 2;
    return {
      stageW,
      stageH: panelH + 96,
      cardW,
      cardH,
      pad,
      gap,
      panelH,
      /** Travel stays inside the card stack — the beam never leaves the artwork. */
      travel: Math.round(panelH * 0.52),
      widthFor: (cards: number) => cards * cardW + (cards - 1) * gap + pad * 2,
    };
  }, [width]);

  useEffect(() => {
    // Reduced motion keeps the scene — glow, depth, beam — and stops only the
    // repeated travel. `0.5` parks the beam on the centre line, which is where
    // the composition is designed to rest.
    if (reduceMotion) {
      sweep.setValue(0.5);
      drift.setValue(0.5);
      return;
    }

    const native = Platform.OS !== 'web';
    const leg = (toValue: number) =>
      Animated.timing(sweep, {
        toValue,
        duration: SWEEP_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: native,
      });

    const beam = Animated.loop(
      Animated.sequence([leg(1), Animated.delay(SWEEP_HOLD_MS), leg(0), Animated.delay(SWEEP_HOLD_MS)]),
    );
    // Deliberately not a multiple of the sweep: when float and beam share a
    // period the whole scene pulses in lockstep and reads as one animation.
    const float = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 3400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: native,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 3400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: native,
        }),
      ]),
    );

    beam.start();
    float.start();
    return () => {
      beam.stop();
      float.stop();
    };
  }, [sweep, drift, reduceMotion]);

  const { travel } = geometry;
  const beamY = sweep.interpolate({ inputRange: [0, 1], outputRange: [-travel, travel] });
  // Brightest across the middle, where it is crossing the hero panel.
  const beamOpacity = sweep.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 1, 0.55] });

  const art = ART_PLACEMENTS['import.scanPreview'];
  let artCursor = 0;

  return (
    <View style={[styles.scanStage, { height: geometry.stageH }]}>
      {/*
        Radial glow, faked with three concentric blocks. Sits behind everything
        and is what stops the stack reading as artwork pasted onto a flat panel.
      */}
      <View pointerEvents="none" style={styles.glowWrap}>
        <View style={[styles.glowRing, { width: geometry.stageW * 0.95, height: geometry.stageH * 0.9 }]} />
        <View style={[styles.glowRing, styles.glowMid, { width: geometry.stageW * 0.66, height: geometry.stageH * 0.62 }]} />
        <View style={[styles.glowRing, styles.glowHot, { width: geometry.stageW * 0.4, height: geometry.stageH * 0.34 }]} />
      </View>

      <ScanMotes drift={drift} stageW={geometry.stageW} stageH={geometry.stageH} />

      {SCAN_PANELS.map((panel, index) => {
        const panelW = geometry.widthFor(panel.cards);
        const ids = art.slice(artCursor, artCursor + panel.cards);
        artCursor += panel.cards;
        const offsetY = panel.y * geometry.panelH;

        // Rear panels travel further than the hero on the same value — that
        // difference IS the parallax. Amplitude is tiny by design (§11 F4's
        // "controlled, not bouncy" applies here too).
        const floatY = drift.interpolate({
          inputRange: [0, 1],
          outputRange: [0, panel.depth === 0 ? -3 : panel.depth === 1 ? -5 : -7],
        });

        return (
          <Animated.View
            key={index}
            pointerEvents="none"
            style={[
              styles.panel,
              {
                width: panelW,
                height: geometry.panelH,
                opacity: panel.opacity,
                zIndex: 3 - panel.depth,
                transform: [
                  { translateX: panel.x * geometry.stageW },
                  { translateY: offsetY },
                  { translateY: floatY },
                  { rotate: panel.rotate },
                  { scale: panel.scale },
                ],
              },
            ]}
          >
            <View style={[styles.panelRow, { padding: geometry.pad, gap: geometry.gap }]}>
              {ids.map((id) => (
                <ItemArt
                  key={id}
                  seed={id}
                  tier="mythic"
                  style={{ width: geometry.cardW, height: geometry.cardH, borderRadius: radius.sm }}
                />
              ))}
            </View>

            {/*
              THE SCAN RESPONSE. A band riding the same value as the beam,
              clipped by the panel's own `overflow: hidden`, so the cards
              brighten exactly where the light crosses them and nowhere else.
              This is the masked-highlight effect without a mask: the panel is
              the mask.

              `- offsetY` cancels the panel's own vertical offset, because this
              band has to track the beam in STAGE space while living in PANEL
              space. Drop it and each panel's highlight drifts off the beam by
              its own offset.
            */}
            <Animated.View
              style={[
                styles.scanBand,
                {
                  transform: [
                    {
                      translateY: sweep.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-travel - offsetY, travel - offsetY],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.scanBandWash} />
              <View style={styles.scanBandEdge} />
            </Animated.View>
          </Animated.View>
        );
      })}

      {/*
        The beam, above every panel (they hold zIndex 1–3).

        Five widths of the same accent, none of them pill-shaped. The old
        version rounded every layer, which is what made it read as a loading
        capsule inside another capsule; a scanning beam is a straight line whose
        light spills, so only the 2px core gets any radius at all. The outer
        streak runs the full stage so the light continues past the cards.
      */}
      <Animated.View
        pointerEvents="none"
        style={[styles.beam, { opacity: beamOpacity, transform: [{ translateY: beamY }] }]}
      >
        <View style={[styles.beamBloom, { width: geometry.stageW }]} />
        <View style={[styles.beamHalo, { width: geometry.stageW * 0.82 }]} />
        <View style={[styles.beamStreak, { width: geometry.stageW }]} />
        <View style={[styles.beamGlow, { width: geometry.stageW * 0.7 }]} />
        <View style={[styles.beamCore, { width: geometry.stageW * 0.66 }]} />
      </Animated.View>
    </View>
  );
}

/**
 * Dust in the light. Eight views, one shared animated value, fixed positions —
 * cheap enough that it costs nothing and the scene stops feeling like a still.
 */
const MOTES = [
  { x: 0.12, y: 0.18, size: 3, rise: -14, opacity: 0.5 },
  { x: 0.26, y: 0.72, size: 2, rise: -9, opacity: 0.35 },
  { x: 0.44, y: 0.12, size: 2, rise: -18, opacity: 0.4 },
  { x: 0.58, y: 0.82, size: 3, rise: -11, opacity: 0.45 },
  { x: 0.71, y: 0.3, size: 2, rise: -16, opacity: 0.3 },
  { x: 0.84, y: 0.66, size: 3, rise: -8, opacity: 0.5 },
  { x: 0.92, y: 0.22, size: 2, rise: -13, opacity: 0.28 },
  { x: 0.05, y: 0.55, size: 2, rise: -10, opacity: 0.32 },
] as const;

function ScanMotes({
  drift,
  stageW,
  stageH,
}: {
  drift: Animated.Value;
  stageW: number;
  stageH: number;
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {MOTES.map((mote, index) => (
        <Animated.View
          key={index}
          style={[
            styles.mote,
            {
              left: mote.x * stageW,
              top: mote.y * stageH,
              width: mote.size,
              height: mote.size,
              opacity: mote.opacity,
              transform: [
                { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, mote.rise] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

/** One column of the Review summary card. */
function Stat({
  glyph,
  value,
  label,
  note,
  noteStyle,
}: {
  glyph: string;
  value: number;
  label: string;
  note: string;
  noteStyle: StyleProp<TextStyle>;
}) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statGlyph}>{glyph}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statNote, noteStyle]}>{note}</Text>
    </View>
  );
}

/** Section title + "See all (N)". `SectionHeader` prints no count and is shared. */
function SeeAllRow({
  title,
  count,
  onSeeAll,
}: {
  title: string;
  count: number;
  onSeeAll: () => void;
}) {
  return (
    <View style={styles.seeAllRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Pressable onPress={onSeeAll} hitSlop={8}>
        <Text style={styles.seeAll}>See all ({count})</Text>
      </Pressable>
    </View>
  );
}

/** A matched item, with the Figma's check badge and the §11 F1 reversal. */
function MatchedTile({
  item,
  included,
  owned,
  onToggle,
}: {
  item: Item;
  included: boolean;
  /** Already in the viewer's inventory — importing writes nothing for it. */
  owned?: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.tile}>
      <View style={!included && styles.tileRemoved}>
        <ItemCard item={item} width="100%" artHeight={84} trustLevel="unverified" onPress={onToggle} />
      </View>
      {/*
        Marked on the tile, not only in the count above. A user scanning a grid
        of twelve matches needs to know WHICH of them they already have — a
        number tells them how many to look for and not where.
      */}
      {owned ? (
        <View style={styles.ownedTag} pointerEvents="none">
          <Text style={styles.ownedTagText}>In your inventory</Text>
        </View>
      ) : null}
      <Pressable
        onPress={onToggle}
        hitSlop={6}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: included }}
        accessibilityLabel={`${included ? 'Exclude' : 'Include'} ${item.name}`}
        style={[styles.tick, !included && styles.tickOff]}
      >
        <Text style={styles.tickGlyph}>{included ? '✓' : '＋'}</Text>
      </Pressable>
    </View>
  );
}

/**
 * An uncertain detection, resolvable in place — the Figma's Confirm / Change
 * pair. Confirm accepts the top candidate; Change opens the full candidate list,
 * because picking a different item needs to show what the alternatives are.
 *
 * The percentage belongs to the top candidate only. That is the one the pipeline
 * scored, and it is printed here rather than hidden because a confidence-based
 * feature that hides its confidence is asking to be trusted blindly.
 */
function PossibleMatch({
  detection,
  item,
  onConfirm,
  onChange,
}: {
  detection: ScanDetection;
  item: Item | undefined;
  onConfirm: () => void;
  onChange: () => void;
}) {
  return (
    <View style={styles.possibleCard}>
      <View style={styles.possibleTop}>
        {item ? (
          <ItemArt seed={item.id} tier={item.rarityTier} style={styles.possibleThumb} />
        ) : (
          <View style={[styles.possibleThumb, styles.possibleThumbEmpty]}>
            <Text style={styles.muted}>?</Text>
          </View>
        )}
        <View style={styles.rowBody}>
          <Text style={styles.possibleTag}>Possible match</Text>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {item?.name ?? (detection.ocrText ? `“${detection.ocrText}”` : 'Unreadable label')}
          </Text>
          <Text style={styles.muted}>
            {item ? GAME_LABELS[item.title] : `Frame ${detection.frameIndex}`}
          </Text>
        </View>
      </View>

      {item ? <RarityBadge tier={item.rarityTier} title={item.title} /> : null}
      <Text style={styles.matchPercent}>{Math.round(detection.confidence * 100)}% match</Text>

      <View style={styles.possibleActions}>
        <Pressable
          onPress={onConfirm}
          disabled={item === undefined}
          style={[styles.miniButton, styles.miniPrimary, item === undefined && styles.miniDisabled]}
        >
          <Text style={styles.miniPrimaryText}>Confirm</Text>
        </Pressable>
        <Pressable onPress={onChange} style={[styles.miniButton, styles.miniSecondary]}>
          <Text style={styles.miniSecondaryText}>Change</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Something the scanner read but the catalogue does not stock.
 *
 * No `ItemCard` and no art, because there is no item — rendering a placeholder
 * card would imply we have an entry for it. What we do have is the name we
 * read and the tier we inferred from the tile's border, so both are shown: a
 * user checking whether the scan actually worked needs to see the name that
 * came off THEIR screenshot, not a count.
 *
 * No Confirm action either. §11 F1 step 6 imports catalogue items, and there is
 * nothing here to import — offering a button that cannot work would be worse
 * than offering none.
 */
function UnmatchedRow({ detection, title }: { detection: ScanDetection; title: GameTitle }) {
  const reading = detection.reading;
  if (reading === undefined) return null;

  return (
    <View style={styles.pendingRow}>
      <View style={[styles.dupeThumb, styles.possibleThumbEmpty]}>
        <Text style={styles.muted}>—</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {reading.name}
        </Text>
        <Text style={styles.muted}>
          {reading.rarityTier === null
            ? 'Not in catalogue'
            : `Looks ${rarityLabelFor(reading.rarityTier, title)} · not in catalogue`}
        </Text>
      </View>
    </View>
  );
}

/**
 * One uncertain detection in full. Shows the raw OCR text so the user can see
 * what we actually read — a correction is only possible if the evidence is
 * visible.
 *
 * The percentage is printed on the top suggestion ONLY, because that is the
 * only candidate the pipeline actually scored. The Figma shows a descending
 * percentage beside every alternative; those numbers do not exist in the data
 * model, and inventing four of them would be fabricating confidence on the one
 * screen whose whole job is honesty about confidence.
 */
function NeedsReviewCard({
  detection,
  items,
  onConfirm,
  onReject,
}: {
  detection: ScanDetection;
  items: ReadonlyMap<string, Item>;
  onConfirm: (itemId: string) => void;
  onReject: () => void;
}) {
  const suggested = detection.itemId === null ? undefined : items.get(detection.itemId);

  const alternatives = detection.candidateItemIds
    .filter((id) => id !== detection.itemId)
    .filter((id, index, all) => all.indexOf(id) === index)
    .map((id) => items.get(id))
    .filter((item): item is Item => item !== undefined);

  return (
    <View style={styles.reviewCard}>
      <Text style={styles.muted}>Frame {detection.frameIndex}</Text>
      {detection.ocrText ? <Text style={styles.ocr}>“{detection.ocrText}”</Text> : null}

      {suggested ? (
        <>
          <Text style={styles.label}>Collectee&apos;s suggestion</Text>
          <Pressable style={styles.suggested} onPress={() => onConfirm(suggested.id)}>
            <ItemCard item={suggested} width={64} artHeight={48} />
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{suggested.name}</Text>
              <Text style={styles.muted}>Tap to confirm</Text>
            </View>
            <Text style={styles.matchPercent}>{Math.round(detection.confidence * 100)}%</Text>
          </Pressable>
        </>
      ) : null}

      {alternatives.length > 0 ? (
        <>
          <Text style={styles.label}>Other possible matches</Text>
          {alternatives.map((item) => (
            <Pressable key={item.id} style={styles.candidate} onPress={() => onConfirm(item.id)}>
              <ItemCard item={item} width={64} artHeight={48} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.muted}>Tap to confirm instead</Text>
              </View>
            </Pressable>
          ))}
        </>
      ) : null}

      <SecondaryButton label="Mark as unknown" onPress={onReject} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, gap: spacing.md },
  stageBody: { gap: spacing.md },
  block: { gap: spacing.md },

  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  navTitle: { ...typography.sectionHeader, color: colors.textPrimary, flex: 1 },
  back: { fontSize: 22, color: colors.textPrimary },

  // Stepper
  stepperRow: { flexDirection: 'row', marginVertical: spacing.md },
  stepCol: { flex: 1, alignItems: 'center', gap: spacing.xs },
  stepLine: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  connector: { flex: 1, height: 2, backgroundColor: colors.border },
  connectorOn: { backgroundColor: colors.accent },
  circle: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  circleDone: { backgroundColor: colors.accentMuted, borderColor: colors.accent },
  circleText: { ...typography.meta, color: colors.textSecondary },
  circleTextOn: { color: colors.textOnAccent },
  stepLabel: { ...typography.meta, color: colors.textTertiary },
  stepLabelActive: { color: colors.accent },

  title: { ...typography.screenTitle, color: colors.textPrimary },
  label: { ...typography.sectionHeader, color: colors.textPrimary, marginTop: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary },
  bodyCentre: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },
  warn: { ...typography.meta, color: colors.warning },
  sectionTitle: { ...typography.cardTitle, color: colors.textPrimary },
  seeAll: { ...typography.meta, color: accentLink },
  seeAllRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  // Upload
  dropZone: {
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  /**
   * The video source: solid border, not dashed. Dashed is this app's "drop a
   * file here" affordance, and wearing it on a panel with no file dialog is
   * what made the video source read as a broken upload.
   */
  /**
   * The rescued-read block. Accent border rather than warning: this is an
   * invitation to decide, not a problem report — the scan worked, it just is
   * not sure, and the user is the one who can settle it.
   */
  rescue: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  rescueTitle: { ...typography.cardTitle, color: colors.textPrimary },
  /* Sits on the tile's art, top-left, clear of the rarity badge and the tick. */
  ownedTag: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: scrim.heavy,
  },
  ownedTagText: { ...typography.meta, fontSize: 10, color: colors.textOnAccent },
  /* Neutral, not warning: nothing went wrong here. The scan worked and the
     catalogue is simply smaller than the game. */
  unrecognised: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rescueRowOn: { borderColor: colors.accent },
  /** Reads as a decision rather than an increment. */
  confirmChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  confirmChipOn: { backgroundColor: colors.accentMuted, borderColor: colors.success },
  confirmChipText: { ...typography.meta, color: colors.accent },
  confirmChipTextOn: { color: colors.success },

  /* ── Complete: suggestion previews ──────────────────────────────────────
     A card, not a row. It is showing what the collection would look like, so
     it is shaped like the collection card it would become. */
  /** Two across on any reasonable width; one on a narrow phone. */
  suggestionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  suggestionCard: {
    /* Half the row minus the gap. A floor forces the wrap rather than letting
       three squeeze onto one line as slivers. */
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 240,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  suggestionArt: { flexDirection: 'row', gap: 2, height: 190 },
  suggestionScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  suggestionMeta: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.md, gap: 2 },
  suggestionReason: { ...typography.meta, color: colors.textOnAccent, opacity: 0.8 },
  suggestionCount: { ...typography.meta, color: accentLink },
  /** The rarest item, given roughly two-thirds of the width. */
  suggestionHero: { flex: 2, height: '100%' },
  suggestionStrip: { flex: 1, gap: 2 },
  suggestionThumb: { flex: 1, width: '100%' },
  suggestionMore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  suggestionMoreText: { ...typography.meta, color: colors.textSecondary },
  suggestionBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  suggestionName: { ...typography.overlayTitle, fontSize: 19, lineHeight: 24, color: colors.textOnAccent },
  suggestionCta: { alignItems: 'flex-end', gap: 2 },

  /**
   * The Verify step's "if you skip this" block.
   *
   * Bordered and set apart rather than a run of body text, because it is the
   * one thing on the screen a user skipping the step still has to have read.
   * Muted foreground, not red: these are consequences of a legitimate choice,
   * not errors — the same reasoning that took the cross off the unverified
   * badge in the inventory.
   */
  consequences: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  consequenceHead: { ...typography.cardTitle, color: colors.textPrimary },
  consequence: { ...typography.meta, color: colors.textSecondary },

  /** Link progress. Same two-part track as `link-account.tsx`. */
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.accent },

  /**
   * The wrong-game callout. Warning colours rather than error: nothing has
   * broken and nothing is lost — the user picked a different game than the one
   * they uploaded, which is a correction, not a failure.
   */
  wrongGame: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.surface,
  },
  wrongGameTitle: { ...typography.cardTitle, color: colors.warning },
  dropStatic: {
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  dropGlyph: { fontSize: 32, color: colors.accent },
  uploadList: { gap: spacing.sm },
  addMore: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  dropFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.card,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  dropPreview: { width: 64, height: 64, borderRadius: radius.sm },

  /**
   * A card, not a row.
   *
   * Three full-width rows with a 64px thumbnail spent the screen on empty
   * space and made the art incidental — this is the first choice in the import
   * flow, and the covers are the thing that says which game you are picking.
   * Same shape as the Gaming updates cards on Home.
   */
  gameCard: {
    /* One row, three cards. Stacked, the picker was three full-width bands
       that pushed the CTA below the fold; side by side the whole choice is
       visible at once, which is what a three-option picker should be. */
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 280,
    /* With `flexWrap`, `flex: 1` alone lets all three squeeze onto one line at
       any width. A floor forces the wrap instead of producing three slivers. */
    minWidth: 240,
    /* Match the generated card art. A fixed height made wide desktop cards crop
       like banners and narrow phone cards crop like portraits; the artwork is
       authored for this ratio, so the box should be too. */
    aspectRatio: 16 / 10,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
  },
  /* Two-pixel accent ring, not one — at card size a hairline is easy to miss,
     and this is a selection the whole flow depends on. */
  gameCardActive: { borderColor: colors.accent, borderWidth: 2 },
  /** Three across, wrapping on a narrow window rather than squeezing to slivers. */
  gameRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'stretch' },
  gameCardScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  /** On the art's lower band, where the scrim is heaviest. */
  gameCardMeta: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.md, gap: 2 },
  gameCardName: { ...typography.overlayTitle, color: colors.textOnAccent },
  /**
   * Absolutely filling the card, not a flow child.
   *
   * As a normal child with `height: '100%'` it consumed the column and pushed
   * the meta into its own band below — which is what put a black strip under
   * each cover instead of laying the title over it. Absolute takes it out of
   * the flow so the meta can sit on top. Width/height are explicit for web:
   * pinned edges alone can leave Image painting at intrinsic size and clipping.
   */
  gameArtImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  selectedGame: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  change: { ...typography.meta, color: accentLink },

  // Scan
  /**
   * Transparent and `overflow: visible` on purpose. The old stage was an opaque
   * sunken rectangle, which is what made the scene read as "a small graphic in a
   * big empty box" — and it clipped the glow that sells the depth. The panels
   * now sit directly on the screen background and the light spills past them.
   */
  scanStage: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    marginBottom: spacing.sm,
  },

  // Radial glow — three concentric blocks standing in for a gradient.
  glowWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    opacity: 0.05,
  },
  glowMid: { opacity: 0.07 },
  glowHot: { opacity: 0.1 },

  mote: { position: 'absolute', borderRadius: radius.pill, backgroundColor: colors.accent },

  /** One floating inventory screenshot. Clips its own scan band — see below. */
  panel: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    // Lifts each panel off the background and off the panels behind it.
    shadowColor: colors.background,
    shadowOpacity: 0.9,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  panelRow: { flexDirection: 'row', alignItems: 'center' },

  /** The beam's footprint on the cards. Clipped to the panel that owns it. */
  scanBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 26,
    marginTop: -13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBandWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.accent,
    opacity: 0.28,
  },
  scanBandEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.textPrimary,
    opacity: 0.5,
  },

  beam: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    // Above every panel (they carry zIndex 1–3).
    zIndex: 10,
  },
  /**
   * A 2px line. Square, not pill — the roundness is what made the old one read
   * as a progress capsule. Native needs shadow*, web reads boxShadow; both are
   * set so the bloom survives either renderer.
   */
  beamCore: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.textPrimary,
    shadowColor: colors.accent,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  beamGlow: { position: 'absolute', height: 6, backgroundColor: colors.accent, opacity: 0.8 },
  /** Hairline running the full stage, so the light continues past the cards. */
  beamStreak: { position: 'absolute', height: 1, backgroundColor: colors.accent, opacity: 0.55 },
  beamHalo: { position: 'absolute', height: 22, backgroundColor: colors.accent, opacity: 0.22 },
  /** Widest, faintest layer — the light spilling onto the screenshots. */
  beamBloom: { position: 'absolute', height: 56, backgroundColor: colors.accent, opacity: 0.08 },
  percent: { ...typography.screenTitle, fontSize: 40, color: colors.accent, textAlign: 'center' },
  scanHead: { ...typography.screenTitle, fontSize: 22, color: colors.textPrimary, textAlign: 'center' },

  checklist: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  checkMark: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMarkDone: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMarkActive: { borderColor: colors.accent },
  checkGlyph: { ...typography.meta, fontSize: 12, color: 'transparent' },
  checkGlyphOn: { color: colors.textOnAccent },
  checkLabel: { ...typography.body, color: colors.textTertiary },
  checkLabelOn: { color: colors.textPrimary },

  infoBox: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  infoGlyph: { fontSize: 16, color: colors.accent },

  // Review summary
  summaryCard: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.lg,
    gap: spacing.md,
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sparkle: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleGlyph: { color: colors.textOnAccent, fontSize: 16 },
  countHead: { ...typography.screenTitle, fontSize: 22, color: colors.textPrimary },

  statRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    gap: 2,
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    paddingLeft: spacing.sm,
  },
  statGlyph: { ...typography.meta, color: colors.textSecondary },
  statValue: { ...typography.screenTitle, fontSize: 20, color: colors.textPrimary },
  statLabel: { ...typography.meta, color: colors.textPrimary },
  statNote: { ...typography.meta, fontSize: 11 },
  noteGood: { color: colors.success },
  noteWarn: { color: colors.warning },
  noteMuted: { color: colors.textTertiary },

  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },
  chevron: { fontSize: 18, color: colors.textPrimary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tierHead: { ...typography.cardTitle, color: colors.textSecondary },
  tile: { width: '30%' },
  tileRemoved: { opacity: 0.32 },
  tick: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOff: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  tickGlyph: { ...typography.meta, color: colors.textOnAccent, fontSize: 12 },

  // Needs review, inline
  possibleCard: {
    width: '47%',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.md,
  },
  possibleTop: { flexDirection: 'row', gap: spacing.sm },
  possibleThumb: { width: 52, height: 52 },
  possibleThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  possibleTag: { ...typography.meta, fontSize: 11, color: colors.warning },
  possibleActions: { flexDirection: 'row', gap: spacing.sm },
  miniButton: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill },
  miniPrimary: { backgroundColor: colors.accent },
  miniSecondary: { borderWidth: 1, borderColor: colors.border },
  miniDisabled: { opacity: 0.4 },
  miniPrimaryText: { ...typography.meta, color: colors.textOnAccent },
  miniSecondaryText: { ...typography.meta, color: colors.textPrimary },
  matchPercent: { ...typography.cardTitle, color: colors.warning },

  // Duplicates
  dupeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  dupeGlyph: { fontSize: 16, color: colors.textSecondary },
  dupeText: { ...typography.body, color: colors.textSecondary, flex: 1 },
  dupeThumb: { width: 40, height: 40 },

  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },

  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  create: { ...typography.cardTitle, color: colors.accent },

  suggested: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.sm,
  },

  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  ocr: { ...typography.sectionHeader, color: colors.textPrimary, fontStyle: 'italic' },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.card,
    padding: spacing.sm,
  },

  done: { fontSize: 44, color: colors.success },
});
