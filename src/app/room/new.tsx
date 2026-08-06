/**
 * J3 — build a Showroom (PRD §10, §11 F4). Flow owner: Jovan.
 * THE DIFFERENTIATOR.
 *
 * Style → Generate → Edit → Preview → Publish, driven by `ROOM_STEPS` so the
 * bar cannot drift from the content (§11 F3 — the Figma labelled two screens
 * "Step 3" in both flows, and this is where that stops).
 *
 * The collection is chosen BEFORE this screen, from the Collections tab or the
 * collection page via /room/intro — which is why it is not a numbered step. If
 * you land here without one (from the + sheet), you get a picker first, still
 * outside the bar.
 *
 * §11 F4 acceptance criteria this screen answers:
 *   - generation completes under 20s with a visible progress state
 *   - EVERY AI placement is manually overridable — both adjust surfaces are
 *     kept (Edit for placement, the Lighting/Background tabs for look), which
 *     is §14 rung 2's `FEATURES.roomTwoAdjustSteps`
 *   - themes are original styles, never named franchises — enforced in the
 *     fixture, and there is deliberately no free-text style input here
 *
 * Everything is mocked (§12.1): no model call, no network. The progress bar is
 * timed, not measured. Say so on stage.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  Collectible3DViewer,
  EmptyState,
  ItemCard,
  LoadingState,
  PrimaryButton,
  RoomScene,
  SecondaryButton,
  SectionHeader,
  StepperHeader,
  resolveBackdrop,
  FilterChips,
  CollectionCard,
} from '@/components';
import { backdropFor } from '@/config/artRegistry';
import { FEATURES } from '@/config/features';
import { ROOM_STEPS, VISIBILITY_DESCRIPTIONS, VISIBILITY_LABELS } from '@/domain/collections';
import { MIN_ROOM_ITEMS, roomEligibility } from '@/domain/trust';
import type { RoomEligibility } from '@/domain/trust';
import {
  ROOM_STAGES,
  catalogueService,
  collectionService,
  inventoryService,
  matchService,
  roomService,
  socialService,
} from '@/services';
import type { CollectorRecommendation } from '@/services';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { useApp } from '@/state/AppContext';
import * as haptics from '@/lib/haptics';
import { colors, interaction, lightingPresets, radius, spacing, typography } from '@/theme/theme';
import { GAME_SHORT_LABELS } from '@/types';
import type {
  Collection,
  DisplayStyle,
  Item,
  LightingPreset,
  OwnedItem,
  Room,
  RoomTheme,
  Slot,
  Visibility,
} from '@/types';

const VISIBILITIES: readonly Visibility[] = ['public', 'unlisted', 'private'];
const EDIT_TABS = ['Items', 'Layout', 'Lighting', 'Background'] as const;
type EditTab = (typeof EDIT_TABS)[number];
const DISPLAY_STYLES: readonly DisplayStyle[] = ['card', 'framed', 'hologram'];

export default function CreateRoomScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  /**
   * Two ways in, one destination.
   *
   *   collectionId   an existing collection is being given a room
   *   name + itemIds a suggestion is being accepted, and the collection does
   *                  not exist yet — it is created at generate time by
   *                  `roomService.createCollectionRoom`
   *
   * The second path is what makes a Showroom feel like one object: the
   * user picks a suggestion and a style, and never sees a separate "now make a
   * collection" step.
   */
  const {
    collectionId: param,
    name: suggestedName,
    itemIds: suggestedItemIds,
  } = useLocalSearchParams<{ collectionId?: string; name?: string; itemIds?: string }>();

  /**
   * Draft item ids — from the URL when a suggestion was accepted, or from the
   * inventory picker below. State rather than a derived constant so both
   * sources feed the same downstream path: a Showroom does not care whether its
   * items arrived via a collection, a suggestion or a hand-picked list.
   */
  const [draftItemIds, setDraftItemIds] = useState<string[]>(
    suggestedItemIds ? suggestedItemIds.split(',').filter(Boolean) : [],
  );
  const [draftName, setDraftName] = useState(suggestedName ?? '');
  const isDraft = !param && draftItemIds.length > 0;

  /** Which source the picker is showing. Only used before a source is chosen. */
  const [source, setSource] = useState<'collection' | 'inventory'>('collection');
  /** Verified-only, because §9.4 gates the room and there is no point offering
      an item the flow would drop at generate time. */
  const [pickable, setPickable] = useState<{ owned: OwnedItem; item: Item }[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [unverifiedCount, setUnverifiedCount] = useState(0);
  const { viewerId } = useApp();
  const { width } = useWindowDimensions();
  const sceneWidth = Math.min(width, 520) - spacing.lg * 2;

  const [step, setStep] = useState(param || draftItemIds.length > 0 ? 1 : 0);
  /** Every step opens at the top — the flow is one route, so nothing remounts. */
  const scrollRef = useTopOnFocus(step);
  const [collectionId, setCollectionId] = useState<string | null>(param ?? null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [owned, setOwned] = useState<OwnedItem[]>([]);
  const [gate, setGate] = useState<RoomEligibility | null>(null);
  const [itemsByOwnedId, setItemsByOwnedId] = useState<ReadonlyMap<string, Item>>(new Map());

  const [themes, setThemes] = useState<RoomTheme[]>([]);
  const [recommended, setRecommended] = useState<{ theme: RoomTheme; reason: string } | null>(null);
  const [themeId, setThemeId] = useState<string | null>(null);
  const [previewThemeId, setPreviewThemeId] = useState<string | null>(null);

  const [progress, setProgress] = useState(0);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [overflow, setOverflow] = useState<string[]>([]);

  const [editTab, setEditTab] = useState<EditTab>('Items');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [heldOwnedItemId, setHeldOwnedItemId] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<Item | null>(null);
  const [threeDItem, setThreeDItem] = useState<Item | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [allowComments, setAllowComments] = useState(true);
  const [showOnProfile, setShowOnProfile] = useState(true);
  const [shareToFeed, setShareToFeed] = useState(true);

  const [published, setPublished] = useState<Room | null>(null);
  const [invites, setInvites] = useState<CollectorRecommendation[]>([]);
  const [busy, setBusy] = useState(true);
  const previewTheme = themes.find((theme) => theme.id === previewThemeId) ?? null;

  // ── Load ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [mine, library, owned, catalogue] = await Promise.all([
        collectionService.getCollectionsByUser(viewerId, true),
        roomService.getThemes(),
        inventoryService.getOwnedItems(viewerId),
        catalogueService.getCatalogueMap(),
      ]);
      if (cancelled) return;
      setCollections(mine);

      // The inventory source offers verified items only (§9.4). `unverified` is
      // kept as a count so the screen can nudge toward verification rather than
      // silently omitting most of what the user owns.
      const verified = owned.filter((entry) => entry.trustLevel === 'verified');
      setPickable(
        verified
          .map((entry) => ({ owned: entry, item: catalogue.get(entry.itemId) }))
          .filter((pair): pair is { owned: OwnedItem; item: Item } => pair.item !== undefined),
      );
      setUnverifiedCount(owned.length - verified.length);
      setThemes(library);
      setBusy(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [viewerId]);

  /**
   * Draft path — a suggestion, not yet a collection. Same downstream shape as
   * the collection path so nothing after this has to know which way it arrived.
   */
  useEffect(() => {
    if (!isDraft) return;
    let cancelled = false;

    async function load() {
      const all = await inventoryService.getOwnedItems(viewerId);
      const inDraft = all.filter((entry) => draftItemIds.includes(entry.itemId));
      const gateResult = roomEligibility(inDraft, (id) => socialService.isUnderReview(id));
      const draftPlaceable = new Set(gateResult.eligibleOwnedItemIds);
      const eligibleDraft = inDraft.filter((entry) => draftPlaceable.has(entry.id));
      const catalogue = await catalogueService.getItems(eligibleDraft.map((o) => o.itemId));
      const byItemId = new Map(catalogue.map((item) => [item.id, item]));
      const pick = await roomService.recommendTheme(eligibleDraft);

      if (cancelled) return;
      setOwned(eligibleDraft);
      setGate(gateResult);
      setItemsByOwnedId(
        new Map(
          eligibleDraft
            .map((entry) => [entry.id, byItemId.get(entry.itemId)] as const)
            .filter((pair): pair is readonly [string, Item] => pair[1] !== undefined),
        ),
      );
      setRecommended(pick);
      setThemeId((current) => current ?? pick.theme.id);
      setTitle(suggestedName ?? 'My Showroom');
      setBusy(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraft, viewerId, suggestedItemIds, suggestedName]);

  // Everything downstream keys off the chosen collection, so this is one effect.
  useEffect(() => {
    if (!collectionId) return;
    let cancelled = false;

    async function load() {
      const found = await collectionService.getCollection(collectionId!);
      const all = await inventoryService.getOwnedItems(viewerId);
      const everythingInCollection = all.filter((entry) =>
        found?.itemIds.includes(entry.itemId),
      );

      // §9.4 — rooms are verified-only, and the filter belongs HERE rather than
      // at the point of placement. Everything downstream (recommendation,
      // auto-place, the tray, the overflow count) reads `owned`, so gating once
      // at the source means no later surface can leak an unverified item in.
      const gate = roomEligibility(everythingInCollection, (id) =>
        socialService.isUnderReview(id),
      );
      const placeable = new Set(gate.eligibleOwnedItemIds);
      const inCollection = everythingInCollection.filter((entry) => placeable.has(entry.id));
      const catalogue = await catalogueService.getItems(inCollection.map((o) => o.itemId));
      const byItemId = new Map(catalogue.map((item) => [item.id, item]));
      const pick = await roomService.recommendTheme(inCollection);

      if (cancelled) return;
      setCollection(found);
      setOwned(inCollection);
      setGate(gate);
      setItemsByOwnedId(
        new Map(
          inCollection
            .map((entry) => [entry.id, byItemId.get(entry.itemId)] as const)
            .filter((pair): pair is readonly [string, Item] => pair[1] !== undefined),
        ),
      );
      setRecommended(pick);
      setThemeId((current) => current ?? pick.theme.id);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [collectionId, viewerId]);

  // ── Generate ────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!themeId) return;
    if (!collectionId && !isDraft) return;
    setStep(1);
    setReady(false);
    setProgress(0);
    setGenerateError(null);
    generating.current = true;

    // Anything thrown in here used to reject silently, and the screen sat on
    // "Designing your…" forever with no way back — the worst failure mode a
    // progress screen has, because it is indistinguishable from slow.
    try {
      // One call writes both records on the draft path, so the user never sees
      // a "now create a collection" step. §9.4 is enforced inside it.
      const created = collectionId
        ? await roomService.createRoom({
            collectionId,
            collectionName: collection?.name,
            themeId,
            ownedItems: owned,
            onProgress: setProgress,
          })
        : (
            await roomService.createCollectionRoom({
              userId: viewerId,
              name: suggestedName ?? 'My Showroom',
              itemIds: draftItemIds,
              themeId,
              ownedItems: owned,
              onProgress: setProgress,
            })
          ).room;

      setOverflow(roomService.overflow(created, owned.map((o) => o.id)));
      setRoom(created);
      setTitle(created.title);
      setDescription(created.description);
      setReady(true);
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : 'Generation failed. Try again.',
      );
      // Released so Try again can re-arm the effect.
      generating.current = false;
    }
  }, [collectionId, collection?.name, themeId, owned]);

  /**
   * Start generation on arrival.
   *
   * `step` initialises to 1 when the screen is entered with a collection or a
   * draft — the style has already been chosen upstream, so the flow opens on
   * Generate. But `generate()` only ever ran from the step-0 button, so those
   * entries landed on the progress bar with nothing running and sat at 0%
   * forever. That is the "stuck at Designing your…" report, and it affected
   * every entry from room/intro, collection/new and the suggestion cards —
   * i.e. every path except manually picking a collection on this screen.
   *
   * Guarded on `room` and `generating` so this fires exactly once and a
   * re-render mid-generation cannot restart it.
   */
  const generating = useRef(false);
  useEffect(() => {
    if (step !== 1 || room !== null || generating.current) return;
    if (!themeId || owned.length === 0) return;
    if (gate !== null && !gate.eligible) return;
    generating.current = true;
    void generate();
  }, [step, room, themeId, owned.length, gate, generate]);

  // ── Edit ────────────────────────────────────────────────────────────
  /**
   * One tap-place model across both surfaces: hold an item (from the tray or by
   * tapping a placed one), then tap where it goes. An occupied target swaps.
   *
   * The frames call for drag-and-drop; that is the next pass. Tap-place covers
   * the same acceptance criterion — every AI placement is overridable — and it
   * is the accessible fallback a drag surface needs anyway.
   */
  async function onSlotPress(slot: Slot) {
    if (!room) return;

    if (step === 3) {
      // Preview: tapping inspects rather than edits.
      const placement = roomService.placementFor(room, slot.id);
      const item = placement ? itemsByOwnedId.get(placement.ownedItemId) : null;
      setInspecting(item ?? null);
      setRoom(await roomService.focusSlot(room.id, slot.id));
      return;
    }

    if (editTab === 'Layout') {
      setRoom(await roomService.focusSlot(room.id, room.settings.focusedSlotId === slot.id ? null : slot.id));
      setSelectedSlotId(slot.id);
      return;
    }

    const placement = roomService.placementFor(room, slot.id);

    if (heldOwnedItemId) {
      const updated = placement
        ? await roomService.swapSlots(room.id, selectedSlotId ?? slot.id, slot.id)
        : await roomService.moveItem(room.id, heldOwnedItemId, slot.id);
      setRoom(updated ?? room);
      setHeldOwnedItemId(null);
      setSelectedSlotId(slot.id);
      return;
    }

    if (placement) {
      setHeldOwnedItemId(placement.ownedItemId);
      setSelectedSlotId(slot.id);
    }
  }

  /**
   * Drag ended over another slot. Occupied target swaps, empty target moves —
   * the same rule as tap-to-place, so the two input methods cannot disagree.
   */
  async function onDropItem(fromSlotId: string, toSlotId: string) {
    if (!room) return;
    const held = roomService.placementFor(room, fromSlotId);
    if (!held) return;
    const target = roomService.placementFor(room, toSlotId);
    const updated = target
      ? await roomService.swapSlots(room.id, fromSlotId, toSlotId)
      : await roomService.moveItem(room.id, held.ownedItemId, toSlotId);
    setRoom(updated ?? room);
    setSelectedSlotId(toSlotId);
    setHeldOwnedItemId(null);
  }

  async function applySettings(patch: Parameters<typeof roomService.updateSettings>[1]) {
    if (!room) return;
    setRoom(await roomService.updateSettings(room.id, patch));
  }

  async function publish() {
    if (!room) return;
    await roomService.updateDetails(room.id, {
      title: title.trim() || room.title,
      description: description.trim(),
      allowComments,
      showOnProfile,
    });
    const live = await roomService.publish(room.id, visibility);
    if (!live) return;
    haptics.success();
    setPublished(live);
    // Frame 11 — the room does not dead-end at publish; it hands off to J4.
    setInvites(await matchService.getRecommendedCollectors(viewerId, 3));
  }

  /* The native header is off for this route — it sat on top of StepperHeader's
     own back chevron. Every branch here owns its top inset instead. */
  const topPad = [styles.content, { paddingTop: insets.top + spacing.md }];

  // ── Published (outside the numbered bar) ────────────────────────────
  if (published) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={topPad}>
        <Collectible3DViewer item={threeDItem} onClose={() => setThreeDItem(null)} />

        <Text style={styles.done}>✓</Text>
        <Text style={styles.title}>Your room is live</Text>
        <Text style={styles.body}>
          {published.title} has been added to your profile and linked to the {collection?.name}{' '}
          collection.
        </Text>

        <RoomScene
          room={published}
          theme={themes.find((t) => t.id === published.themeId)}
          itemsByOwnedId={itemsByOwnedId}
          onInspect3D={setThreeDItem}
          width={sceneWidth}
        />

        <View style={styles.statRow}>
          <Stat value={String(published.placements.length)} label="items" />
          <Stat value={VISIBILITY_LABELS[published.visibility]} label="visibility" />
          <Stat value={published.allowComments ? 'On' : 'Off'} label="comments" />
        </View>

        <PrimaryButton
          label="Explore your room"
          onPress={() => router.replace({ pathname: '/room/[id]', params: { id: published.id } })}
        />
        <SecondaryButton label="Share room" onPress={() => router.replace('/')} />

        {invites.length > 0 ? (
          <View>
            <SectionHeader title="Invite collectors with similar taste" />
            <View style={styles.inviteRow}>
              {invites.map((entry) => (
                <Pressable
                  key={entry.user.id}
                  style={styles.invite}
                  onPress={() =>
                    router.push({ pathname: '/collector/[id]', params: { id: entry.user.id } })
                  }
                >
                  <Avatar name={entry.user.displayName} verified={entry.user.isAccountVerified} size={40} />
                  <Text style={styles.inviteName} numberOfLines={1}>
                    {entry.user.displayName}
                  </Text>
                  <Text style={styles.match}>{entry.percent}% match</Text>
                  {/* §11 F5 — the reason travels with the number, everywhere. */}
                  <Text style={styles.signalDetail} numberOfLines={2}>
                    {entry.reason}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    );
  }

  // ── Collection picker (outside the numbered bar) ────────────────────
  // A draft skips this entirely: it already knows its items, and its collection
  // does not exist yet by design.
  if (!collectionId && !isDraft) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={topPad}>
        {/* This branch sits outside StepperHeader, so it needs its own way out —
            without the native header there is otherwise nothing to press. */}
        <Pressable
          onPress={() => router.back()}
          hitSlop={interaction.hitSlop}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.pickerBack}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Build a Showroom</Text>
        <Text style={styles.body}>
          Start from a collection you have already made, or pick items straight from your
          inventory — a Showroom does not require a collection first.
        </Text>

        <FilterChips
          options={['From a collection', 'From my inventory'] as const}
          value={source === 'collection' ? 'From a collection' : 'From my inventory'}
          onChange={(next: string) =>
            setSource(next === 'From a collection' ? 'collection' : 'inventory')
          }
        />

        {busy ? <LoadingState height={160} /> : null}

        {!busy && source === 'collection' ? (
          collections.length === 0 ? (
            <EmptyState
              title="No collections yet"
              body="Pick items from your inventory instead, or create a collection first."
              actionLabel="Pick from inventory"
              onAction={() => setSource('inventory')}
            />
          ) : (
            <View style={styles.pickGrid}>
              {collections.map((entry) => (
                <View key={entry.id} style={styles.pickCell}>
                  {/* The same card the Collections tab uses. Choosing between
                      collections by name alone means recalling what is in each;
                      the covers make it a glance. */}
                  <CollectionCard
                    collection={entry}
                    width="100%"
                    onPress={() => setCollectionId(entry.id)}
                  />
                </View>
              ))}
            </View>
          )
        ) : null}

        {!busy && source === 'inventory' ? (
          pickable.length === 0 ? (
            <EmptyState
              title="No verified items yet"
              body="Showrooms take verified items only (§9.4). Connect a game account to verify what you own."
              actionLabel="Connect a game account"
              onAction={() => router.push('/link-account')}
            />
          ) : (
            <>
              <Text style={styles.muted}>
                {picked.length} of {pickable.length} verified items selected · {MIN_ROOM_ITEMS}{' '}
                minimum
              </Text>

              {/* The nudge only appears when there is something to nudge about.
                  Telling someone with nothing unverified to go verify things is
                  noise, and it is the reason this is a count rather than a
                  permanent banner. */}
              {unverifiedCount > 0 ? (
                <Pressable
                  onPress={() => router.push('/link-account')}
                  style={({ pressed }) => [styles.verifyNudge, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.verifyNudgeTitle}>
                    ⚿ {unverifiedCount} more items you own are unverified
                  </Text>
                  <Text style={styles.verifyNudgeBody}>
                    Unverified items cannot be placed in a Showroom — they stay in 2D
                    collections. Connect a game account to verify them and unlock all{' '}
                    {pickable.length + unverifiedCount} for display. →
                  </Text>
                </Pressable>
              ) : null}
              <View style={styles.pickGrid}>
                {pickable.map(({ item }) => {
                  const on = picked.includes(item.id);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() =>
                        setPicked((prev) =>
                          prev.includes(item.id)
                            ? prev.filter((id) => id !== item.id)
                            : [...prev, item.id],
                        )
                      }
                      style={[styles.pickCell, on && styles.pickCellOn]}
                    >
                      <ItemCard item={item} width="100%" />
                      {on ? (
                        <View style={styles.pickTick}>
                          <Text style={styles.pickTickText}>✓</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              <PrimaryButton
                label={
                  picked.length < MIN_ROOM_ITEMS
                    ? `Select ${MIN_ROOM_ITEMS - picked.length} more`
                    : `Build a Showroom from ${picked.length} items`
                }
                disabled={picked.length < MIN_ROOM_ITEMS}
                onPress={() => {
                  setDraftItemIds(picked);
                  setDraftName('My Showroom');
                  setStep(1);
                }}
              />
            </>
          )
        ) : null}
      </ScrollView>
    );
  }

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={topPad}>
      <StepperHeader
        steps={ROOM_STEPS}
        current={step}
        onBack={step === 0 ? () => router.back() : () => setStep(step - 1)}
      />

      <Collectible3DViewer item={threeDItem} onClose={() => setThreeDItem(null)} />

      <Modal
        visible={previewTheme !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setPreviewThemeId(null)}
      >
        <View style={styles.previewBackdrop}>
          {previewTheme ? (
            <View style={styles.previewCard}>
              <View style={styles.previewImageWrap}>
                {themeBackdrop(previewTheme) ? (
                  <Image
                    source={themeBackdrop(previewTheme)!}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                ) : null}
                <Pressable
                  accessibilityLabel="Close room design preview"
                  hitSlop={12}
                  onPress={() => setPreviewThemeId(null)}
                  style={styles.previewClose}
                >
                  <Text style={styles.previewCloseText}>×</Text>
                </Pressable>
              </View>
              <View style={styles.previewDetails}>
                <View style={styles.previewTitleRow}>
                  <View style={styles.rowBody}>
                    <Text style={styles.previewTitle}>{previewTheme.name}</Text>
                    <Text style={styles.body}>{previewTheme.description}</Text>
                  </View>
                  <View style={styles.paletteRow}>
                    {previewTheme.palette.map((tone) => (
                      <View key={tone} style={[styles.paletteSwatch, { backgroundColor: tone }]} />
                    ))}
                  </View>
                </View>
                <PrimaryButton
                  label={themeId === previewTheme.id ? 'Selected design' : 'Use this design'}
                  onPress={() => {
                    setThemeId(previewTheme.id);
                    setPreviewThemeId(null);
                  }}
                />
                <SecondaryButton label="Keep browsing" onPress={() => setPreviewThemeId(null)} />
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      {/* ── 0 Style ─────────────────────────────────────────────────── */}
      {step === 0 ? (
        <View style={styles.block}>
          <View style={styles.styleHeading}>
            <View style={styles.rowBody}>
              <Text style={styles.title}>Choose your room style</Text>
              <Text style={styles.body}>Select the design that best fits your collection.</Text>
            </View>
            <Text style={styles.designCount}>{themes.length} designs</Text>
          </View>

          {recommended ? (
            <Text style={styles.recommendLine}>
              ✦ Recommended from the colours and items in {collection?.name}
            </Text>
          ) : (
            <LoadingState height={40} />
          )}

          {themes.map((theme) => {
            const isBest = recommended?.theme.id === theme.id;
            const selected = themeId === theme.id;
            const backdrop = themeBackdrop(theme);
            return (
              <Pressable
                key={theme.id}
                onPress={() => setThemeId(theme.id)}
                style={[
                  styles.themeOption,
                  (selected || isBest) && styles.themeOptionFeatured,
                  selected && styles.themeOptionActive,
                ]}
              >
                {backdrop ? (
                  <Image source={backdrop} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : null}
                <View style={styles.themeScrim} />
                <View style={styles.themeLowerScrim} />
                <View style={styles.themeContent}>
                  <View style={styles.themeTopRow}>
                    {isBest ? <Text style={styles.bestMatch}>✦ Best match</Text> : <View />}
                    <Pressable
                      accessibilityLabel={`Preview ${theme.name} full screen`}
                      hitSlop={8}
                      onPress={(event) => {
                        event.stopPropagation();
                        setPreviewThemeId(theme.id);
                      }}
                      style={styles.previewAction}
                    >
                      <Text style={styles.previewActionIcon}>⛶</Text>
                    </Pressable>
                  </View>
                  <View style={styles.themeRow}>
                    <View style={styles.swatches}>
                      {theme.palette.map((tone) => (
                        <View key={tone} style={[styles.swatch, { backgroundColor: tone }]} />
                      ))}
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{theme.name}</Text>
                      <Text style={styles.themeMuted}>
                        {isBest && recommended ? recommended.reason : theme.description}
                      </Text>
                      <Text style={styles.themeFootnote}>{theme.slots.length} placement slots</Text>
                    </View>
                    {selected ? (
                      <View style={styles.selectedMark}>
                        <Text style={styles.tick}>✓</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </Pressable>
            );
          })}

          {themes.find((theme) => theme.id === themeId) ? (
            <View style={styles.selectedSummary}>
              <Text style={styles.muted}>Selected design</Text>
              <Text style={styles.rowTitle}>
                {themes.find((theme) => theme.id === themeId)?.name}
              </Text>
            </View>
          ) : null}

          <PrimaryButton
            label="Generate my room"
            disabled={!themeId || owned.length === 0 || (gate !== null && !gate.eligible)}
            onPress={() => void generate()}
          />
          {gate && !gate.eligible ? (
            <View style={styles.gateCard}>
              <Text style={styles.gateTitle}>⚿  Rooms are verified-only</Text>
              <Text style={styles.body}>{gate.reason}</Text>
              <Text style={styles.footnote}>
                Unverified items stay fully usable — they just live in the 2D collection
                instead of the room.
              </Text>
              <SecondaryButton
                label="Connect a game account"
                onPress={() => router.push('/link-account')}
              />
            </View>
          ) : gate && gate.blockedOwnedItemIds.length > 0 ? (
            <Text style={styles.footnote}>
              ⚿ {gate.verifiedCount} verified items will be placed ·{' '}
              {gate.blockedOwnedItemIds.length} unverified stay in the 2D collection
            </Text>
          ) : null}

          {owned.length === 0 ? (
            <Text style={styles.warn}>
              You do not own any items in this collection, so there is nothing to place.
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* ── 1 Generate ──────────────────────────────────────────────── */}
      {step === 1 ? (
        <View style={styles.block}>
          {generateError ? (
            <View style={styles.gateCard}>
              <Text style={styles.gateTitle}>Generation failed</Text>
              <Text style={styles.body}>{generateError}</Text>
              <PrimaryButton label="Try again" onPress={() => void generate()} />
              <SecondaryButton label="Back to styles" onPress={() => setStep(0)} />
            </View>
          ) : !ready ? (
            <>
              <Text style={styles.stage}>
                Designing your {themes.find((t) => t.id === themeId)?.name}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <Text style={styles.muted}>{Math.round(progress * 100)}%</Text>

              {/* The four named stages from the frames, each with its state. */}
              {ROOM_STAGES.map((stageEntry, index) => {
                const current = roomService.stageIndexFor(progress);
                const state = index < current ? 'done' : index === current ? 'active' : 'pending';
                return (
                  <View key={stageEntry.label} style={styles.stageRow}>
                    <Text
                      style={[
                        styles.stageMark,
                        state === 'done' && styles.stageDone,
                        state === 'active' && styles.stageActive,
                      ]}
                    >
                      {state === 'done' ? '✓' : state === 'active' ? '◌' : '○'}
                    </Text>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{stageEntry.label}</Text>
                      <Text style={styles.muted}>{stageEntry.detail}</Text>
                    </View>
                  </View>
                );
              })}

              <Text style={styles.footnote}>
                Arranging by colour, rarity and collection theme. Timed, not measured — the pipeline
                is specified, not built (§12.1).
              </Text>
            </>
          ) : room ? (
            <>
              <Text style={styles.title}>Your room is ready</Text>
              <RoomScene
                room={room}
                theme={themes.find((t) => t.id === room.themeId)}
                itemsByOwnedId={itemsByOwnedId}
                onInspect3D={setThreeDItem}
                width={sceneWidth}
              />
              <Text style={styles.recommendLine}>
                ✦ Featured your rarest items and grouped similar colours together.
              </Text>

              <View style={styles.statRow}>
                <Stat value={String(room.placements.length)} label="items displayed" />
                <Stat value={String(Math.min(3, room.placements.length))} label="featured" />
                <Stat
                  value={String(new Set([...itemsByOwnedId.values()].map((i) => i.title)).size)}
                  label="games"
                />
              </View>

              {overflow.length > 0 ? (
                <Text style={styles.warn}>
                  {overflow.length} items did not fit this style&apos;s slots. Swap them in from the
                  Items tab, or pick a style with more slots.
                </Text>
              ) : null}

              <PrimaryButton label="Customise room" onPress={() => setStep(2)} />
              <SecondaryButton label="Use this layout" onPress={() => setStep(3)} />
            </>
          ) : null}
        </View>
      ) : null}

      {/* ── 2 Edit ──────────────────────────────────────────────────── */}
      {step === 2 && room ? (
        <View style={styles.block}>
          <RoomScene
            room={room}
            theme={themes.find((t) => t.id === room.themeId)}
            itemsByOwnedId={itemsByOwnedId}
            selectedSlotId={selectedSlotId}
            onSlotPress={(slot) => void onSlotPress(slot)}
            onInspect3D={setThreeDItem}
            onDropItem={(from, to) => void onDropItem(from, to)}
            draggable={editTab === 'Items'}
            showEmptySlots
            cameraEnabled={editTab === 'Layout'}
            width={sceneWidth}
          />

          <View style={styles.toolRow}>
            <ToolButton
              label="↺ Undo"
              disabled={!roomService.canUndo(room.id)}
              onPress={async () => setRoom((await roomService.undo(room.id)) ?? room)}
            />
            <ToolButton
              label="↻ Redo"
              disabled={!roomService.canRedo(room.id)}
              onPress={async () => setRoom((await roomService.redo(room.id)) ?? room)}
            />
            <ToolButton
              label="✦ Auto-arrange"
              onPress={async () => setRoom((await roomService.autoArrange(room.id, owned)) ?? room)}
            />
          </View>

          <View style={styles.tabRow}>
            {EDIT_TABS.map((tab) => (
              <Pressable key={tab} onPress={() => setEditTab(tab)} style={styles.tab}>
                <Text style={[styles.tabText, editTab === tab && styles.tabTextActive]}>{tab}</Text>
                {editTab === tab ? <View style={styles.tabUnderline} /> : null}
              </Pressable>
            ))}
          </View>

          {editTab === 'Items' ? (
            <View style={styles.block}>
              <Text style={styles.muted}>
                {heldOwnedItemId
                  ? 'Now tap a slot to place it. Tapping an occupied slot swaps.'
                  : 'Tap an item to pick it up, then tap a display slot.'}
              </Text>
              <View style={styles.tray}>
                {owned.map((entry) => {
                  const item = itemsByOwnedId.get(entry.id);
                  if (!item) return null;
                  const held = heldOwnedItemId === entry.id;
                  const placed = room.placements.some((p) => p.ownedItemId === entry.id);
                  return (
                    <Pressable
                      key={entry.id}
                      onPress={() => setHeldOwnedItemId(held ? null : entry.id)}
                      style={[styles.trayItem, held && styles.trayItemHeld]}
                    >
                      <ItemCard item={item} width={84} artHeight={56} />
                      <Text style={styles.footnote}>{placed ? 'In room' : 'Not placed'}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/collection/[id]', params: { id: room.collectionId } })
                }
              >
                <Text style={styles.link}>Add or remove collection items ›</Text>
              </Pressable>
            </View>
          ) : null}

          {editTab === 'Layout' ? (
            <View style={styles.block}>
              <Text style={styles.muted}>
                Tap an item to make it the focal point — the camera transitions to it.
              </Text>
              <SecondaryButton
                label="Rotate focal item 15°"
                onPress={async () => {
                  const target = room.settings.focusedSlotId ?? selectedSlotId;
                  if (!target) return;
                  setRoom((await roomService.rotateItem(room.id, target, 15)) ?? room);
                }}
              />
              <View style={styles.chipWrap}>
                {DISPLAY_STYLES.map((style) => (
                  <Pressable
                    key={style}
                    onPress={() => void applySettings({ displayStyle: style })}
                    style={[styles.chip, room.settings.displayStyle === style && styles.chipActive]}
                  >
                    <Text style={styles.chipText}>{style}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {editTab === 'Lighting' ? (
            <View style={styles.block}>
              {!FEATURES.roomLightingControls ? (
                <Text style={styles.warn}>
                  Lighting is off for this build (§14 rung 2). Flip FEATURES.roomLightingControls to
                  bring it back.
                </Text>
              ) : (
                <>
                  <View style={styles.chipWrap}>
                    {(Object.keys(lightingPresets) as LightingPreset[]).map((preset) => (
                      <Pressable
                        key={preset}
                        onPress={() => void applySettings({ lightingPreset: preset })}
                        style={[
                          styles.chip,
                          room.settings.lightingPreset === preset && styles.chipActive,
                        ]}
                      >
                        <View
                          style={[styles.dot, { backgroundColor: lightingPresets[preset].tint }]}
                        />
                        <Text style={styles.chipText}>{lightingPresets[preset].label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Stepped rather than a drag slider — the visual pass replaces this. */}
                  <View style={styles.sliderRow}>
                    <SecondaryButton
                      label="− Dimmer"
                      onPress={() =>
                        void applySettings({
                          brightness: Math.max(0.1, room.settings.brightness - 0.1),
                        })
                      }
                    />
                    <Text style={styles.rowTitle}>
                      {Math.round(room.settings.brightness * 100)}%
                    </Text>
                    <SecondaryButton
                      label="Brighter +"
                      onPress={() =>
                        void applySettings({
                          brightness: Math.min(1, room.settings.brightness + 0.1),
                        })
                      }
                    />
                  </View>

                  <Pressable
                    style={styles.toggleRow}
                    onPress={() =>
                      void applySettings({ animatedLighting: !room.settings.animatedLighting })
                    }
                  >
                    <Text style={styles.rowTitle}>Animated lighting</Text>
                    <View style={[styles.switch, room.settings.animatedLighting && styles.switchOn]}>
                      <View
                        style={[styles.knob, room.settings.animatedLighting && styles.knobOn]}
                      />
                    </View>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}

          {editTab === 'Background' ? (
            <View style={styles.block}>
              <Text style={styles.warn}>
                Changing style rebuilds the room: geometry comes from the style, so placements are
                re-arranged from scratch.
              </Text>
              {themes.map((theme) => (
                <Pressable
                  key={theme.id}
                  onPress={() => {
                    setThemeId(theme.id);
                    void generate();
                  }}
                  style={[styles.option, room.themeId === theme.id && styles.optionActive]}
                >
                  <Text style={styles.rowTitle}>{theme.name}</Text>
                  <Text style={styles.muted}>{theme.description}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <PrimaryButton label="Save and preview" onPress={() => setStep(3)} />
        </View>
      ) : null}

      {/* ── 3 Preview ───────────────────────────────────────────────── */}
      {step === 3 && room ? (
        <View style={styles.block}>
          <Text style={styles.title}>{title || room.title}</Text>
          <Text style={styles.muted}>
            Created from {collection?.name} · {room.placements.length} items
          </Text>

          <RoomScene
            room={room}
            theme={themes.find((t) => t.id === room.themeId)}
            itemsByOwnedId={itemsByOwnedId}
            onSlotPress={(slot) => void onSlotPress(slot)}
            onInspect3D={setThreeDItem}
            width={sceneWidth}
          />
          <Text style={styles.footnote}>Drag to explore · tap an item to inspect it</Text>

          {inspecting ? (
            <View style={styles.block}>
              <View style={styles.inspect}>
                <ItemCard item={inspecting} width={72} artHeight={52} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{inspecting.name}</Text>
                  <Text style={styles.muted}>
                    {GAME_SHORT_LABELS[inspecting.title]} · {inspecting.rarityLabel}
                  </Text>
                </View>
                <Pressable onPress={() => setInspecting(null)} hitSlop={8}>
                  <Text style={styles.close}>✕</Text>
                </Pressable>
              </View>
              <SecondaryButton label="View in 3D" onPress={() => setThreeDItem(inspecting)} />
            </View>
          ) : null}

          <PrimaryButton label="Continue to publish" onPress={() => setStep(4)} />
          <SecondaryButton label="Edit room" onPress={() => setStep(2)} />
        </View>
      ) : null}

      {/* ── 4 Publish ───────────────────────────────────────────────── */}
      {step === 4 && room ? (
        <View style={styles.block}>
          <Text style={styles.sectionLabel}>Room cover</Text>
          <RoomScene
            room={room}
            theme={themes.find((t) => t.id === room.themeId)}
            itemsByOwnedId={itemsByOwnedId}
            cameraEnabled={false}
            width={sceneWidth}
          />
          <Text style={styles.footnote}>
            The cover is a still of the room. Choosing a different frame lands with the export work.
          </Text>

          <Text style={styles.sectionLabel}>Room title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={room.title}
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
          />

          <Text style={styles.sectionLabel}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={`An immersive display of my ${collection?.name ?? 'collection'}.`}
            placeholderTextColor={colors.textTertiary}
            multiline
            style={[styles.input, styles.inputMultiline]}
          />

          <View style={styles.metaRow}>
            <Text style={styles.muted}>Room style</Text>
            <Text style={styles.rowTitle}>
              {themes.find((t) => t.id === room.themeId)?.name ?? '—'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.muted}>Source collection</Text>
            <Text style={styles.rowTitle}>{collection?.name ?? '—'}</Text>
          </View>

          <Text style={styles.sectionLabel}>Visibility</Text>
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

          <Toggle label="Allow comments" value={allowComments} onChange={setAllowComments} />
          <Toggle label="Show on profile" value={showOnProfile} onChange={setShowOnProfile} />
          <Toggle label="Share to Home feed" value={shareToFeed} onChange={setShareToFeed} />

          <PrimaryButton label="Publish room" onPress={() => void publish()} />
        </View>
      ) : null}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function ToolButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.tool, disabled && styles.toolDisabled]}
    >
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable style={styles.toggleRow} onPress={() => onChange(!value)}>
      <Text style={styles.rowTitle}>{label}</Text>
      <View style={[styles.switch, value && styles.switchOn]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

/**
 * A theme's backdrop, on the same precedence every other surface uses: the
 * id-keyed registry render first, then the path-keyed fallback. The picker
 * shows these six side by side, so a theme that resolved differently here than
 * in the room itself would advertise art the room does not render.
 */
function themeBackdrop(theme: RoomTheme) {
  return backdropFor(theme.id) ?? resolveBackdrop(theme.backdropUrl);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  block: { gap: spacing.md },

  title: { ...typography.screenTitle, color: colors.textPrimary },
  pickerBack: { ...typography.body, color: colors.accent },
  sectionLabel: { ...typography.cardTitle, color: colors.textPrimary, marginTop: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },
  warn: { ...typography.meta, color: colors.warning },
  link: { ...typography.meta, color: colors.accent },
  signalDetail: { ...typography.meta, color: colors.textSecondary },
  recommendLine: { ...typography.meta, color: colors.accent },
  bestMatch: { ...typography.meta, color: colors.textOnAccent },
  tick: { color: colors.textOnAccent, fontSize: 16, lineHeight: 18 },

  verifyNudge: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  verifyNudgeTitle: { ...typography.cardTitle, color: colors.accent },
  verifyNudgeBody: { ...typography.meta, color: colors.textSecondary },

  pickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  pickCell: { width: '48%' },
  pickCellOn: { opacity: 0.95 },
  pickTick: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  pickTickText: { color: colors.textOnAccent, fontSize: 15, fontWeight: '700' },

  option: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  optionActive: { borderColor: colors.accent },

  themeOption: {
    minHeight: 190,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  themeOptionFeatured: { minHeight: 238 },
  themeOptionActive: { borderColor: colors.accent, borderWidth: 2 },
  themeScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.surfaceSunken,
    opacity: 0.2,
  },
  themeLowerScrim: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: '70%',
    backgroundColor: colors.surfaceSunken,
    opacity: 0.74,
  },
  themeContent: { gap: spacing.sm },
  themeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  swatches: {
    width: 12,
    height: 48,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  swatch: { flex: 1 },
  themeMuted: { ...typography.meta, color: colors.textPrimary },
  themeFootnote: { ...typography.meta, color: colors.textSecondary },
  selectedMark: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  previewAction: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewActionIcon: { color: colors.textPrimary, fontSize: 18, lineHeight: 20 },
  styleHeading: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  designCount: {
    ...typography.meta,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  gateCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  gateTitle: { ...typography.cardTitle, color: colors.textPrimary },

  selectedSummary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 2,
  },
  previewBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  previewCard: {
    width: '100%',
    maxWidth: 720,
    overflow: 'hidden',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  previewImageWrap: {
    width: '100%',
    aspectRatio: 1.45,
    backgroundColor: colors.surfaceSunken,
  },
  previewClose: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewCloseText: { color: colors.textPrimary, fontSize: 26, lineHeight: 28 },
  previewDetails: { padding: spacing.lg, gap: spacing.md },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  previewTitle: { ...typography.screenTitle, color: colors.textPrimary },
  paletteRow: { flexDirection: 'row', gap: spacing.xs, paddingTop: spacing.xs },
  paletteSwatch: {
    width: 14,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },

  stage: { ...typography.sectionHeader, color: colors.textPrimary },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surface },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.accent },
  stageRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  stageMark: { ...typography.cardTitle, color: colors.textTertiary, width: 18 },
  stageDone: { color: colors.success },
  stageActive: { color: colors.accent },

  statRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...typography.sectionHeader, color: colors.textPrimary },

  toolRow: { flexDirection: 'row', gap: spacing.sm },
  tool: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toolDisabled: { opacity: 0.35 },
  toolText: { ...typography.meta, color: colors.textPrimary },

  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.sm },
  tabText: { ...typography.meta, color: colors.textSecondary },
  tabTextActive: { color: colors.accent },
  tabUnderline: { height: 2, width: '60%', backgroundColor: colors.accent },

  tray: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  trayItem: { borderRadius: radius.card, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  trayItemHeld: { borderColor: colors.accent },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.accent },
  chipText: { ...typography.meta, color: colors.textPrimary },
  dot: { width: 10, height: 10, borderRadius: radius.pill },

  sliderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  switch: { width: 44, height: 26, borderRadius: radius.pill, backgroundColor: colors.border, padding: 3 },
  switchOn: { backgroundColor: colors.accent },
  knob: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: colors.textPrimary },
  knobOn: { alignSelf: 'flex-end' },

  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
  inputMultiline: { minHeight: 76, textAlignVertical: 'top' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  inspect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  close: { fontSize: 18, color: colors.textSecondary },

  inviteRow: { flexDirection: 'row', gap: spacing.md },
  invite: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
  },
  inviteName: { ...typography.cardTitle, color: colors.textPrimary, marginTop: spacing.xs },
  match: { ...typography.meta, color: colors.accent },

  done: { fontSize: 44, color: colors.success },
});
