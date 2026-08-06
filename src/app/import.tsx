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
import { CONFIDENCE_AUTO_ACCEPT, CONFIDENCE_REVIEW_FLOOR, isMatchIncluded } from '@/domain/scan';
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
import { colors, radius, spacing, typography } from '@/theme/theme';
import { GAME_LABELS } from '@/types';
import type { GameTitle, Item, ScanDetection, ScanResolution, ScanResult } from '@/types';

/** The Figma's four labels. §11 F3's stepper arrays are J2's and J3's. */
const IMPORT_STEPS = ['Upload', 'Scan', 'Review', 'Complete'] as const;

/**
 * `landing` sits on step 0 alongside `upload`: picking a title is part of
 * choosing what to upload, not a numbered step of its own. The Figma draws it
 * as a separate screen under the same highlighted "Upload" circle.
 */
type Stage = 'landing' | 'upload' | 'scanning' | 'review' | 'needs-review' | 'complete';

const STAGE_STEP: Record<Stage, number> = {
  landing: 0,
  upload: 0,
  scanning: 1,
  review: 2,
  'needs-review': 2,
  complete: 3,
};

/** Each frame's own header, rather than one title for the whole flow. */
const STAGE_TITLE: Record<Stage, string> = {
  landing: 'Import inventory',
  upload: 'Upload',
  scanning: 'Scanning inventory',
  review: 'Review items',
  'needs-review': 'Confirm a match',
  complete: 'Import complete',
};

/** Review sections. `All` shows every section stacked, matching the Figma tabs. */
const REVIEW_FILTERS = ['All', 'Matched', 'Needs review', 'Duplicates'] as const;
type ReviewFilter = (typeof REVIEW_FILTERS)[number];

/** How many of each section the `All` tab previews before "See all". */
const PREVIEW_MATCHED = 3;
const PREVIEW_NEEDS_REVIEW = 2;

export default function ImportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { viewer, viewerId, refreshInventory } = useApp();

  const [stage, setStage] = useState<Stage>('landing');
  const scrollRef = useTopOnFocus(stage);

  const [title, setTitle] = useState<GameTitle>('codm');
  const [kind, setKind] = useState<'image' | 'video'>(FEATURES.scanVideoInput ? 'video' : 'image');
  const [upload, setUpload] = useState<PickedImage | null>(null);
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

  /**
   * Incremented by "Cancel scan". The scan is a timer, not a request, so it
   * cannot be aborted — but a stale run must not be allowed to push a result
   * onto a screen the user has already left.
   */
  const runId = useRef(0);

  const detections = result?.detections ?? [];

  // Recomputed on every resolution — this is what makes the CTA count live.
  const counts = useMemo(
    () => scanService.counts(detections, resolutions),
    [detections, resolutions],
  );
  const fullyResolved = scanService.canImport(detections, resolutions);

  const pending = detections.filter(
    (d) => d.outcome === 'needs_review' && !resolutions.some((r) => r.detectionId === d.id),
  );

  /**
   * Matched detections paired with their catalogue item, carrying `rarityTier`
   * at the top level so `groupByRarity` can take them directly — §11 F1 step 6
   * asks for the Review screen to group by rarity, and that helper already
   * exists for exactly this.
   */
  const matchedEntries = useMemo(
    () =>
      detections
        .filter((d) => d.outcome === 'matched' && d.itemId !== null)
        .map((d) => {
          const item = items.get(d.itemId!);
          return item ? { detection: d, item, rarityTier: item.rarityTier } : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    [detections, items],
  );

  const matchedGroups = useMemo(() => groupByRarity(matchedEntries), [matchedEntries]);

  const duplicateEntries = useMemo(
    () =>
      detections
        .filter((d) => d.outcome === 'duplicate' && d.itemId !== null)
        .map((d) => ({ detection: d, item: items.get(d.itemId!) }))
        .filter((entry): entry is { detection: ScanDetection; item: Item } => entry.item !== undefined),
    [detections, items],
  );

  /** Pick the screenshot to scan. The file is real even though the read is not. */
  async function chooseUpload() {
    const picked = await mediaService.pickImage();
    switch (picked.status) {
      case 'picked':
        setUpload(picked.image);
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

    const scan = await scanService.scan(
      { kind, uri: upload?.uri ?? `demo://${title}-inventory`, title },
      (fraction) => {
        // A cancelled run keeps ticking; it just stops being allowed to speak.
        if (runId.current === run) setProgress(fraction);
      },
    );
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
    // One of exactly three success haptics in the app — the three rungs of the
    // never-cut chain (§14). Firing it anywhere else dilutes what it means.
    haptics.success();
    setStage('complete');

    // The bridge into J2. Suggestions are computed from what the user now owns,
    // so this reflects the import that just happened, not a canned list.
    setSuggesting(true);
    const owned = await inventoryService.getOwnedItems(viewerId);
    setNextUp(await collectionService.suggest(owned));
    setSuggesting(false);
  }

  function goBack() {
    if (stage === 'needs-review') return setStage('review');
    if (stage === 'upload') return setStage('landing');
    if (stage === 'scanning') return cancelScan();
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
                  game rather than as something in your inventory. */}
              <View style={styles.gameArt}>
                {/*
                  Explicit 100%/100%, not absoluteFill. absoluteFill only sets
                  the four edges; a renderer that sizes an image from its
                  intrinsic pixels then draws a 1200px cover at full size and
                  lets the parent clip it, so the tile showed the top-left
                  corner instead of the whole cover.

                  `contain` so nothing is ever cut. The covers are square and so
                  is the tile, so today it fills edge to edge regardless — but a
                  future cover that is not square still arrives whole.
                */}
                <Image
                  source={GAME_COVERS[option]}
                  style={styles.gameArtImage}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{GAME_LABELS[option]}</Text>
                <Text style={styles.supported}>✓ Scanner supported</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
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

          {/* An image source takes a real file; video stays the prepared recording. */}
          {kind === 'image' && upload ? (
            <Pressable style={styles.dropFilled} onPress={() => void chooseUpload()}>
              <Image
                source={{ uri: upload.uri }}
                style={styles.dropPreview}
                resizeMode="cover"
                accessible
                accessibilityLabel={`Selected screenshot: ${upload.name}`}
              />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {upload.name}
                </Text>
                <Text style={styles.muted}>
                  {formatBytes(upload.bytes)} · grid segmented into tiles
                </Text>
              </View>
              <Text style={styles.change}>Change</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.dropZone}
              onPress={kind === 'image' ? () => void chooseUpload() : undefined}
            >
              <Text style={styles.dropGlyph}>⇪</Text>
              <Text style={styles.body}>
                {kind === 'video' ? 'inventory-scroll.mp4' : 'Choose a screenshot'}
              </Text>
              <Text style={styles.muted}>
                {kind === 'video'
                  ? 'Sampled at ~2 fps with a frame-difference filter'
                  : 'PNG or JPG, up to 8 MB · grid segmented into tiles'}
              </Text>
            </Pressable>
          )}

          {uploadNote ? <Text style={styles.warn}>{uploadNote}</Text> : null}

          <PrimaryButton label="Start scan" onPress={() => void runScan()} />
          <Text style={styles.footnote}>
            The vision pipeline is specified, not built — your file is read off the device, but the
            results below are the prepared set for this title (§12.1).
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
                <Text style={styles.muted}>Review the results before importing.</Text>
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

            {counts.discarded > 0 ? (
              <Text style={styles.warn}>
                {counts.discarded} items we couldn&apos;t read — below the {CONFIDENCE_REVIEW_FLOOR}{' '}
                floor, so not in the total
              </Text>
            ) : null}
          </View>

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
          <Text style={styles.footnote}>
            ≥ {CONFIDENCE_AUTO_ACCEPT} auto-accepted · {CONFIDENCE_REVIEW_FLOOR}–
            {CONFIDENCE_AUTO_ACCEPT} needs review · below {CONFIDENCE_REVIEW_FLOOR} discarded
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

      {stage === 'complete' ? (
        <View style={styles.block}>
          <Text style={styles.done}>✓</Text>
          <Text style={styles.title}>{importedCount} items added</Text>
          {/* Completion totals equal detected — the Figma's 44-vs-42 bug, fixed. */}
          <Text style={styles.muted}>
            {counts.detected} detected · {counts.confirmed} confirmed · {counts.duplicates}{' '}
            duplicates skipped · {counts.discarded} unreadable
          </Text>
          {/*
            Confirmed minus added is items already in the inventory. Print it:
            an unexplained gap between two totals on the same screen is the exact
            class of bug §11 F1 sends us here to fix.
          */}
          {counts.confirmed - importedCount > 0 ? (
            <Text style={styles.muted}>
              {counts.confirmed - importedCount} of the {counts.confirmed} confirmed were already in
              your inventory
            </Text>
          ) : null}
          <Text style={styles.footnote}>
            All items landed as unverified. Verified ownership needs a linked game account, which is
            partnership-gated (§9.3).
          </Text>

          {/* The import → collection link in the never-cut chain (§14). */}
          <Text style={styles.label}>Start organising your items</Text>
          <Text style={styles.footnote}>Based on the items you just imported.</Text>
          {suggesting ? (
            <LoadingState height={72} />
          ) : (
            nextUp.map((suggestion) => (
              <Pressable
                key={suggestion.name}
                style={styles.suggestion}
                onPress={() =>
                  router.replace({
                    pathname: '/collection/new',
                    params: {
                      name: suggestion.name,
                      itemIds: suggestion.itemIds.join(','),
                    },
                  })
                }
              >
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{suggestion.name}</Text>
                  <Text style={styles.muted}>{suggestion.reason}</Text>
                  <Text style={styles.footnote}>{suggestion.itemIds.length} items</Text>
                </View>
                <Text style={styles.create}>Create</Text>
              </Pressable>
            ))
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
  onToggle,
}: {
  item: Item;
  included: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.tile}>
      <View style={!included && styles.tileRemoved}>
        <ItemCard item={item} width="100%" artHeight={84} trustLevel="unverified" onPress={onToggle} />
      </View>
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
  screen: { flex: 1, backgroundColor: colors.background },
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
  seeAll: { ...typography.meta, color: colors.accent },
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
  dropGlyph: { fontSize: 32, color: colors.accent },
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

  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  gameCardActive: { borderColor: colors.accent },
  gameArt: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
  },
  gameArtImage: { width: '100%', height: '100%' },
  supported: { ...typography.meta, color: colors.accent },
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
  change: { ...typography.meta, color: colors.accent },

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
