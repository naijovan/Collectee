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
  ItemCard,
  PrimaryButton,
  SecondaryButton,
  StepperHeader,
} from '@/components';
import { FEATURES } from '@/config/features';
import { CONFIDENCE_AUTO_ACCEPT, CONFIDENCE_REVIEW_FLOOR } from '@/domain/scan';
import { catalogueService, inventoryService, scanService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { GAME_LABELS } from '@/types';
import type { GameTitle, Item, ScanDetection, ScanResolution, ScanResult } from '@/types';

/** Local to J1. The canonical stepper arrays in §11 F3 are for J2 and J3. */
const IMPORT_STEPS = ['Upload', 'Scan', 'Review', 'Done'] as const;

type Stage = 'upload' | 'scanning' | 'review' | 'needs-review' | 'complete';

const STAGE_STEP: Record<Stage, number> = {
  upload: 0,
  scanning: 1,
  review: 2,
  'needs-review': 2,
  complete: 3,
};

export default function ImportScreen() {
  const router = useRouter();
  const { viewerId, refreshInventory } = useApp();

  const [stage, setStage] = useState<Stage>('upload');
  const [title, setTitle] = useState<GameTitle>('codm');
  const [kind, setKind] = useState<'image' | 'video'>(FEATURES.scanVideoInput ? 'video' : 'image');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [resolutions, setResolutions] = useState<ScanResolution[]>([]);
  const [items, setItems] = useState<ReadonlyMap<string, Item>>(new Map());
  const [importedCount, setImportedCount] = useState(0);

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
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <StepperHeader
        steps={IMPORT_STEPS}
        current={STAGE_STEP[stage]}
        onBack={stage === 'needs-review' ? () => setStage('review') : () => router.back()}
      />

      {stage === 'upload' ? (
        <View style={styles.block}>
          <Text style={styles.body}>
            Upload a screenshot or a screen recording of your in-game inventory. Items are read
            automatically — you never type a name.
          </Text>

          <Text style={styles.label}>Game</Text>
          <FilterChips
            options={scanService.availableTitles()}
            value={title}
            onChange={setTitle}
          />
          <Text style={styles.muted}>{GAME_LABELS[title]}</Text>

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

          <Text style={styles.label}>Matched</Text>
          <View style={styles.grid}>
            {detections
              .filter((d) => d.outcome === 'matched' && d.itemId)
              .map((d) => {
                const item = items.get(d.itemId!);
                return item ? (
                  <ItemCard key={d.id} item={item} width="30%" trustLevel="unverified" />
                ) : null;
              })}
          </View>

          {counts.duplicates > 0 ? (
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
  const candidates = [detection.itemId, ...detection.candidateItemIds]
    .filter((id): id is string => id !== null)
    .filter((id, index, all) => all.indexOf(id) === index)
    .map((id) => items.get(id))
    .filter((item): item is Item => item !== undefined);

  return (
    <View style={styles.reviewCard}>
      <Text style={styles.muted}>
        Confidence {Math.round(detection.confidence * 100)}% · frame {detection.frameIndex}
      </Text>
      {detection.ocrText ? <Text style={styles.ocr}>“{detection.ocrText}”</Text> : null}
      <Text style={styles.label}>Which item is this?</Text>

      {candidates.map((item) => (
        <Pressable key={item.id} style={styles.candidate} onPress={() => onConfirm(item.id)}>
          <ItemCard item={item} width={64} artHeight={48} />
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={styles.muted}>Tap to confirm</Text>
          </View>
        </Pressable>
      ))}

      <SecondaryButton label="None of these — discard" onPress={onReject} />
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
