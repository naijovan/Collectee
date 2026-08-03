/**
 * J3 — Collection Room (PRD §10, §11 F4). Flow owner: Jovan. THE DIFFERENTIATOR.
 *
 * Collection → Style → Generate → Adjust → Publish, driven by `ROOM_STEPS` from
 * `domain/collections.ts` so the bar matches the code (§11 F3 fixes the same
 * numbering bug in both flows — the Figma labels two screens Step 3 here).
 *
 * Acceptance criteria this screen is built against (§11 F4):
 *   - generation completes under 20s with a progress state
 *   - EVERY AI placement is manually overridable — the Figma has two adjust
 *     steps and both are kept (`FEATURES.roomTwoAdjustSteps`, §14 rung 2)
 *   - the room exports/shares from the live room screen
 *
 * Themes are original styles, never named franchises (§11 F4) — that constraint
 * lives in the fixture data, and nothing here should let a user type a theme.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  EmptyState,
  LoadingState,
  PrimaryButton,
  RoomScene,
  SecondaryButton,
  StepperHeader,
} from '@/components';
import { FEATURES } from '@/config/features';
import { ROOM_STEPS, VISIBILITY_DESCRIPTIONS, VISIBILITY_LABELS } from '@/domain/collections';
import {
  catalogueService,
  collectionService,
  inventoryService,
  roomService,
} from '@/services';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Collection, Item, OwnedItem, Room, RoomTheme, Slot, Visibility } from '@/types';

const VISIBILITIES: readonly Visibility[] = ['public', 'unlisted', 'private'];

export default function CreateRoomScreen() {
  const router = useRouter();
  const { collectionId: preselected } = useLocalSearchParams<{ collectionId?: string }>();
  const { viewerId } = useApp();
  const { width } = useWindowDimensions();
  const sceneWidth = Math.min(width, 520) - spacing.lg * 2;

  const [step, setStep] = useState(preselected ? 1 : 0);
  /** Every step opens at the top — the flow is one route, so nothing remounts. */
  const scrollRef = useTopOnFocus(step);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState<string | null>(preselected ?? null);
  const [themes, setThemes] = useState<RoomTheme[]>([]);
  const [themeId, setThemeId] = useState<string | null>(null);

  const [progress, setProgress] = useState(0);
  const [room, setRoom] = useState<Room | null>(null);
  const [itemsByOwnedId, setItemsByOwnedId] = useState<ReadonlyMap<string, Item>>(new Map());
  const [overflow, setOverflow] = useState<string[]>([]);

  /** §14 rung 2: two adjust passes when the flag is on, one when it is off. */
  const [pass, setPass] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [mine, library] = await Promise.all([
        collectionService.getCollectionsByUser(viewerId, true),
        roomService.getThemes(),
      ]);
      if (cancelled) return;
      setCollections(mine);
      setThemes(library);
      setBusy(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [viewerId]);

  const generate = useCallback(async () => {
    if (!collectionId || !themeId) return;
    setStep(2);
    setProgress(0);

    const collection = await collectionService.getCollection(collectionId);
    const owned = await inventoryService.getOwnedItems(viewerId);
    const inCollection: OwnedItem[] = owned.filter((entry) =>
      collection?.itemIds.includes(entry.itemId),
    );

    const created = await roomService.createRoom({
      collectionId,
      themeId,
      ownedItems: inCollection,
      onProgress: setProgress,
    });

    // Placements reference ownedItemId; the scene needs catalogue entries.
    const catalogue = await catalogueService.getItems(inCollection.map((o) => o.itemId));
    const byItemId = new Map(catalogue.map((item) => [item.id, item]));
    setItemsByOwnedId(
      new Map(
        inCollection
          .map((entry) => [entry.id, byItemId.get(entry.itemId)] as const)
          .filter((pair): pair is readonly [string, Item] => pair[1] !== undefined),
      ),
    );

    setOverflow(roomService.overflow(created, inCollection.map((o) => o.id)));
    setRoom(created);
    setStep(3);
  }, [collectionId, themeId, viewerId]);

  /**
   * Manual override, one tap at a time: select a placed item, then tap where it
   * should go. Occupied target swaps, empty target moves. §11 F4 requires every
   * AI placement to be overridable — this is that, without a drag dependency.
   */
  async function onSlotPress(slot: Slot) {
    if (!room) return;

    if (pass === 1 || !FEATURES.roomTwoAdjustSteps) {
      const focused = room.settings.focusedSlotId === slot.id ? null : slot.id;
      setRoom(await roomService.focusSlot(room.id, focused));
      return;
    }

    const placement = roomService.placementFor(room, slot.id);

    if (!selectedSlotId) {
      if (placement) setSelectedSlotId(slot.id);
      return;
    }
    if (selectedSlotId === slot.id) {
      setSelectedSlotId(null);
      return;
    }

    const held = roomService.placementFor(room, selectedSlotId);
    if (!held) {
      setSelectedSlotId(null);
      return;
    }

    const updated = placement
      ? await roomService.swapSlots(room.id, selectedSlotId, slot.id)
      : await roomService.moveItem(room.id, held.ownedItemId, slot.id);

    setRoom(updated);
    setSelectedSlotId(null);
  }

  async function rotateFocused() {
    if (!room) return;
    const target = room.settings.focusedSlotId ?? selectedSlotId;
    if (!target) return;
    setRoom(await roomService.rotateItem(room.id, target, 15));
  }

  async function publish() {
    if (!room) return;
    const published = await roomService.publish(room.id, visibility);
    if (published) router.replace({ pathname: '/room/[id]', params: { id: published.id } });
  }

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}>
      <StepperHeader
        steps={ROOM_STEPS}
        current={step}
        onBack={step === 0 ? () => router.back() : () => setStep(Math.max(0, step - 1))}
      />

      {busy ? <LoadingState height={160} /> : null}

      {/* 0 — Collection */}
      {!busy && step === 0 ? (
        <View style={styles.block}>
          {collections.length === 0 ? (
            <EmptyState
              title="No collections yet"
              body="A room is built from a collection. Create one first."
              actionLabel="Create a collection"
              onAction={() => router.replace('/collection/new')}
            />
          ) : (
            collections.map((collection) => (
              <Pressable
                key={collection.id}
                onPress={() => setCollectionId(collection.id)}
                style={[styles.option, collectionId === collection.id && styles.optionActive]}
              >
                <Text style={styles.rowTitle}>{collection.name}</Text>
                <Text style={styles.muted}>
                  {collection.itemIds.length} {collection.itemIds.length === 1 ? 'item' : 'items'}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      {/* 1 — Style */}
      {!busy && step === 1 ? (
        <View style={styles.block}>
          <Text style={styles.muted}>
            Original styles only — a named franchise would generate derivative third-party IP
            (§11 F4).
          </Text>
          {themes.map((theme) => (
            <Pressable
              key={theme.id}
              onPress={() => setThemeId(theme.id)}
              style={[styles.option, themeId === theme.id && styles.optionActive]}
            >
              <View style={styles.themeRow}>
                <View style={styles.swatches}>
                  {theme.palette.map((tone) => (
                    <View key={tone} style={[styles.swatch, { backgroundColor: tone }]} />
                  ))}
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{theme.name}</Text>
                  <Text style={styles.muted}>{theme.description}</Text>
                  <Text style={styles.footnote}>{theme.slots.length} placement slots</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* 2 — Generate */}
      {step === 2 ? (
        <View style={styles.block}>
          <Text style={styles.stage}>Generating your room…</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.footnote}>
            Template-conditioned: the theme supplies fixed slot geometry, generation only produces
            the backdrop. Backdrops are cached per theme and palette, so a repeat is instant.
          </Text>
        </View>
      ) : null}

      {/* 3 — Adjust */}
      {step === 3 && room ? (
        <View style={styles.block}>
          <RoomScene
            room={room}
            theme={themes.find((t) => t.id === room.themeId)}
            itemsByOwnedId={itemsByOwnedId}
            selectedSlotId={selectedSlotId}
            onSlotPress={(slot) => void onSlotPress(slot)}
            showEmptySlots={pass === 0 || !FEATURES.roomTwoAdjustSteps}
            cameraEnabled={pass === 1 || !FEATURES.roomTwoAdjustSteps}
            width={sceneWidth}
          />

          {FEATURES.roomTwoAdjustSteps && pass === 0 ? (
            <>
              <Text style={styles.rowTitle}>Placement</Text>
              <Text style={styles.muted}>
                Items were placed rarest-into-most-prominent. Tap an item, then tap where it should
                go — an occupied slot swaps.
              </Text>
              <PrimaryButton label="Next: focus and rotation" onPress={() => setPass(1)} />
            </>
          ) : (
            <>
              <Text style={styles.rowTitle}>Focus and rotation</Text>
              <Text style={styles.muted}>
                Tap an item to make it the focal point — the camera transitions to it. Long-press
                the focal item to flip the card.
              </Text>
              <SecondaryButton label="Rotate focal item 15°" onPress={() => void rotateFocused()} />
              {FEATURES.roomTwoAdjustSteps ? (
                <SecondaryButton label="Back to placement" onPress={() => setPass(0)} />
              ) : null}
              <PrimaryButton label="Continue to publish" onPress={() => setStep(4)} />
            </>
          )}

          {overflow.length > 0 ? (
            <Text style={styles.warn}>
              {overflow.length} items did not fit this theme&apos;s slots and are not shown.
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* 4 — Publish */}
      {step === 4 && room ? (
        <View style={styles.block}>
          {VISIBILITIES.map((option) => (
            <Pressable
              key={option}
              onPress={() => setVisibility(option)}
              style={[styles.option, visibility === option && styles.optionActive]}
            >
              <Text style={styles.rowTitle}>{VISIBILITY_LABELS[option]}</Text>
              <Text style={styles.muted}>{VISIBILITY_DESCRIPTIONS[option]}</Text>
            </Pressable>
          ))}
          <PrimaryButton label="Publish room" onPress={() => void publish()} />
        </View>
      ) : null}

      {/* Advance control for the steps that have no CTA of their own. */}
      {step === 0 || step === 1 ? (
        <PrimaryButton
          label={step === 0 ? 'Choose a style' : 'Generate room'}
          disabled={step === 0 ? !collectionId : !themeId}
          onPress={() => (step === 0 ? setStep(1) : void generate())}
        />
      ) : null}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  block: { gap: spacing.md },

  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },
  rowBody: { flex: 1, gap: 2 },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },
  warn: { ...typography.meta, color: colors.warning },

  option: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  optionActive: { borderColor: colors.accent },

  themeRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  swatches: { width: 44, height: 44, borderRadius: radius.sm, overflow: 'hidden' },
  swatch: { flex: 1 },

  stage: { ...typography.sectionHeader, color: colors.textPrimary },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surface },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
});
