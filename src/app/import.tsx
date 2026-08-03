/**
 * J1 — Import inventory (PRD §10, §11 F1). Flow owner: Bernard.
 *
 * Upload → Scan → Review → Needs Review → Completion, as one route with a stage
 * machine, because every stage reads the same `ScanResult` and splitting it
 * across four routes means threading it through params.
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
 * fixtures behind timed loading states. Say so plainly on stage.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  EmptyState,
  FilterChips,
  ItemArt,
  ItemCard,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  StepperHeader,
} from '@/components';
import { FEATURES } from '@/config/features';
import type { CollectionSuggestion } from '@/domain/collections';
import { groupByRarity, rarityLabelFor } from '@/domain/rarity';
import { CONFIDENCE_AUTO_ACCEPT, CONFIDENCE_REVIEW_FLOOR, isMatchIncluded } from '@/domain/scan';
import { catalogueService, collectionService, inventoryService, scanService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { GAME_LABELS } from '@/types';
import type { GameTitle, Item, ScanDetection, ScanResolution, ScanResult } from '@/types';

/** Local to J1. The canonical stepper arrays in §11 F3 are for J2 and J3. */
const IMPORT_STEPS = ['Upload', 'Scan', 'Review', 'Done'] as const;

/**
 * `landing` sits on step 0 alongside `upload`: picking a title is part of
 * choosing what to upload, not a numbered step of its own. The Figma draws it
 * as a separate screen but the same "1 of 4 — Upload" bar.
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

/** Review sections. `All` shows every section stacked, matching the Figma tabs. */
const REVIEW_FILTERS = ['All', 'Matched', 'Needs review', 'Duplicates'] as const;
type ReviewFilter = (typeof REVIEW_FILTERS)[number];

export default function ImportScreen() {
  const router = useRouter();
  const { viewerId, refreshInventory } = useApp();

  const [stage, setStage] = useState<Stage>('landing');
  const [title, setTitle] = useState<GameTitle>('codm');
  const [kind, setKind] = useState<'image' | 'video'>(FEATURES.scanVideoInput ? 'video' : 'image');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [resolutions, setResolutions] = useState<ScanResolution[]>([]);
  const [items, setItems] = useState<ReadonlyMap<string, Item>>(new Map());
  const [importedCount, setImportedCount] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('All');
  const [nextUp, setNextUp] = useState<CollectionSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);

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

  async function runScan() {
    setStage('scanning');
    setProgress(0);

    const scan = await scanService.scan({ kind, uri: `demo://${title}-inventory`, title }, setProgress);

    // Every item id the Review and Needs Review screens can possibly show.
    const ids = new Set<string>();
    for (const detection of scan.detections) {
      if (detection.itemId) ids.add(detection.itemId);
      for (const candidate of detection.candidateItemIds) ids.add(candidate);
    }
    const catalogue = await catalogueService.getItems([...ids]);

    setItems(new Map(catalogue.map((item) => [item.id, item])));
    setResult(scan);
    setStage('review');
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
    setStage('complete');

    // The bridge into J2. Suggestions are computed from what the user now owns,
    // so this reflects the import that just happened, not a canned list.
    setSuggesting(true);
    const owned = await inventoryService.getOwnedItems(viewerId);
    setNextUp(await collectionService.suggest(owned));
    setSuggesting(false);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StepperHeader
        steps={IMPORT_STEPS}
        current={STAGE_STEP[stage]}
        onBack={
          stage === 'needs-review'
            ? () => setStage('review')
            : stage === 'upload'
              ? () => setStage('landing')
              : () => router.back()
        }
      />

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
              <ItemArt seed={option} tier="legendary" style={styles.gameArt} />
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

          <View style={styles.dropZone}>
            <Text style={styles.dropGlyph}>⇪</Text>
            <Text style={styles.body}>
              {kind === 'video' ? 'inventory-scroll.mp4' : 'inventory-01.png'}
            </Text>
            <Text style={styles.muted}>
              {kind === 'video'
                ? 'Sampled at ~2 fps with a frame-difference filter'
                : 'Single frame, grid segmented into tiles'}
            </Text>
          </View>

          <PrimaryButton label="Start scan" onPress={() => void runScan()} />
          <Text style={styles.footnote}>
            The vision pipeline is specified, not built — this demo serves prepared results behind
            real loading states (§12.1).
          </Text>
        </View>
      ) : null}

      {stage === 'scanning' ? (
        <View style={styles.block}>
          <Text style={styles.stage}>{scanService.stageFor(progress)}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.muted}>{Math.round(progress * 100)}%</Text>

          <View style={styles.thresholds}>
            <Text style={styles.footnote}>
              ≥ {CONFIDENCE_AUTO_ACCEPT} auto-accepted · {CONFIDENCE_REVIEW_FLOOR}–
              {CONFIDENCE_AUTO_ACCEPT} needs review · below {CONFIDENCE_REVIEW_FLOOR} discarded
            </Text>
          </View>
        </View>
      ) : null}

      {stage === 'review' && result ? (
        <View style={styles.block}>
          <View style={styles.countCard}>
            <Text style={styles.countHead}>{counts.detected} items detected</Text>
            {/* The invariant, printed: detected = matched + needs review + duplicates. */}
            <Text style={styles.muted}>
              {counts.matched} matched + {counts.needsReview} needs review + {counts.duplicates}{' '}
              duplicates
            </Text>
            {counts.discarded > 0 ? (
              <Text style={styles.warn}>
                {counts.discarded} items we couldn&apos;t read — not included in the total
              </Text>
            ) : null}
          </View>

          {pending.length > 0 ? (
            <Pressable style={styles.reviewBanner} onPress={() => setStage('needs-review')}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{pending.length} items need your eyes</Text>
                <Text style={styles.muted}>
                  We read these but aren&apos;t confident enough to add them silently
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ) : (
            <View style={styles.resolvedBanner}>
              <Text style={styles.rowTitle}>All items resolved</Text>
              <Text style={styles.muted}>Nothing ambiguous will enter your collection</Text>
            </View>
          )}

          <FilterChips options={REVIEW_FILTERS} value={reviewFilter} onChange={setReviewFilter} />

          {/* §11 F1 step 6 — "Review screen groups detected items by rarity". */}
          {reviewFilter === 'All' || reviewFilter === 'Matched' ? (
            <View style={styles.block}>
              <Text style={styles.label}>Matched</Text>
              <Text style={styles.footnote}>
                Tap any item to leave it out — nothing here is final until you import.
              </Text>
              {matchedGroups.map((group) => (
                <View key={group.tier} style={styles.block}>
                  <Text style={styles.tierHead}>
                    {rarityLabelFor(group.tier, title)} · {group.items.length}
                  </Text>
                  <View style={styles.grid}>
                    {group.items.map(({ detection, item }) => {
                      const included = isMatchIncluded(detection.id, resolutions);
                      return (
                        <View key={detection.id} style={styles.tile}>
                          <View style={!included && styles.tileRemoved}>
                            <ItemCard
                              item={item}
                              width="100%"
                              trustLevel="unverified"
                              onPress={() => toggleMatch(detection.id)}
                            />
                          </View>
                          <Pressable
                            onPress={() => toggleMatch(detection.id)}
                            hitSlop={6}
                            style={[styles.tick, !included && styles.tickOff]}
                          >
                            <Text style={styles.tickGlyph}>{included ? '✓' : '＋'}</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          {reviewFilter === 'Needs review' ? (
            <View style={styles.block}>
              {pending.length === 0 ? (
                <EmptyState
                  title="Nothing left to review"
                  body="Every uncertain detection has a decision."
                />
              ) : (
                pending.map((d) => (
                  <Pressable key={d.id} style={styles.pendingRow} onPress={() => setStage('needs-review')}>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>
                        {d.ocrText ? `“${d.ocrText}”` : 'Unreadable label'}
                      </Text>
                      <Text style={styles.muted}>
                        {Math.round(d.confidence * 100)}% confidence · frame {d.frameIndex}
                      </Text>
                    </View>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                ))
              )}
            </View>
          ) : null}

          {reviewFilter === 'Duplicates' ? (
            <View style={styles.block}>
              {duplicateEntries.length === 0 ? (
                <EmptyState title="No duplicates" body="Nothing repeated across frames." />
              ) : (
                duplicateEntries.map(({ detection, item }) => (
                  <View key={detection.id} style={styles.pendingRow}>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{item.name}</Text>
                      <Text style={styles.muted}>
                        Already counted from an earlier frame · frame {detection.frameIndex}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {counts.duplicates > 0 && reviewFilter === 'All' ? (
            <Text style={styles.footnote}>
              {counts.duplicates} duplicates were removed across frames by item id.
            </Text>
          ) : null}

          <PrimaryButton
            label={`Import ${counts.confirmed} confirmed items`}
            disabled={!fullyResolved || counts.confirmed === 0}
            onPress={() => void runImport()}
          />
          {!fullyResolved ? (
            <Text style={styles.footnote}>
              Resolve the {pending.length} pending items first — the count above updates as you go.
            </Text>
          ) : null}
        </View>
      ) : null}

      {stage === 'needs-review' ? (
        <View style={styles.block}>
          {pending.length === 0 ? (
            <EmptyState
              title="Nothing left to review"
              body="Every uncertain detection has a decision."
              actionLabel="Back to review"
              onAction={() => setStage('review')}
            />
          ) : (
            <NeedsReviewCard
              detection={pending[0]!}
              items={items}
              onConfirm={(itemId) => resolve(pending[0]!.id, itemId)}
              onReject={() => resolve(pending[0]!.id, null)}
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

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

/**
 * One uncertain detection. Shows the raw OCR text so the user can see what we
 * actually read — a correction is only possible if the evidence is visible.
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
  content: { padding: spacing.lg },
  block: { gap: spacing.md },

  title: { ...typography.screenTitle, color: colors.textPrimary },
  label: { ...typography.sectionHeader, color: colors.textPrimary, marginTop: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },
  warn: { ...typography.meta, color: colors.warning },

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
  gameArt: { width: 64, height: 64 },
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

  stage: { ...typography.sectionHeader, color: colors.textPrimary },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surface },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
  thresholds: { marginTop: spacing.lg },

  countCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  countHead: { ...typography.screenTitle, fontSize: 24, color: colors.textPrimary },

  reviewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.accentMuted,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  resolvedBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.success,
    padding: spacing.md,
    gap: 2,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },
  chevron: { fontSize: 22, color: colors.textPrimary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },

  tierHead: { ...typography.cardTitle, color: colors.textSecondary },
  tile: { width: '30%' },
  tileRemoved: { opacity: 0.32 },
  tick: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickOff: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border },
  tickGlyph: { ...typography.meta, color: colors.textOnAccent, fontSize: 12 },

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
  matchPercent: { ...typography.cardTitle, color: colors.accent },

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
