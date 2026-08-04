/**
 * J3 — build a Collection Room (PRD §10, §11 F4). Flow owner: Jovan.
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

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Avatar,
  EmptyState,
  ItemCard,
  LoadingState,
  PrimaryButton,
  RoomScene,
  SecondaryButton,
  SectionHeader,
  StepperHeader,
} from '@/components';
import { FEATURES } from '@/config/features';
import { ROOM_STEPS, VISIBILITY_DESCRIPTIONS, VISIBILITY_LABELS } from '@/domain/collections';
import {
  ROOM_STAGES,
  catalogueService,
  collectionService,
  inventoryService,
  matchService,
  roomService,
} from '@/services';
import type { CollectorRecommendation } from '@/services';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { useApp } from '@/state/AppContext';
import { colors, lightingPresets, radius, spacing, typography } from '@/theme/theme';
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
  const { collectionId: param } = useLocalSearchParams<{ collectionId?: string }>();
  const { viewerId } = useApp();
  const { width } = useWindowDimensions();
  const sceneWidth = Math.min(width, 520) - spacing.lg * 2;

  const [step, setStep] = useState(param ? 1 : 0);
  /** Every step opens at the top — the flow is one route, so nothing remounts. */
  const scrollRef = useTopOnFocus(step);
  const [collectionId, setCollectionId] = useState<string | null>(param ?? null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [owned, setOwned] = useState<OwnedItem[]>([]);
  const [itemsByOwnedId, setItemsByOwnedId] = useState<ReadonlyMap<string, Item>>(new Map());

  const [themes, setThemes] = useState<RoomTheme[]>([]);
  const [recommended, setRecommended] = useState<{ theme: RoomTheme; reason: string } | null>(null);
  const [themeId, setThemeId] = useState<string | null>(null);

  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [overflow, setOverflow] = useState<string[]>([]);

  const [editTab, setEditTab] = useState<EditTab>('Items');
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [heldOwnedItemId, setHeldOwnedItemId] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState<Item | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [allowComments, setAllowComments] = useState(true);
  const [showOnProfile, setShowOnProfile] = useState(true);
  const [shareToFeed, setShareToFeed] = useState(true);

  const [published, setPublished] = useState<Room | null>(null);
  const [invites, setInvites] = useState<CollectorRecommendation[]>([]);
  const [busy, setBusy] = useState(true);

  // ── Load ────────────────────────────────────────────────────────────
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

  // Everything downstream keys off the chosen collection, so this is one effect.
  useEffect(() => {
    if (!collectionId) return;
    let cancelled = false;

    async function load() {
      const found = await collectionService.getCollection(collectionId!);
      const all = await inventoryService.getOwnedItems(viewerId);
      const inCollection = all.filter((entry) => found?.itemIds.includes(entry.itemId));
      const catalogue = await catalogueService.getItems(inCollection.map((o) => o.itemId));
      const byItemId = new Map(catalogue.map((item) => [item.id, item]));
      const pick = await roomService.recommendTheme(inCollection);

      if (cancelled) return;
      setCollection(found);
      setOwned(inCollection);
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
    if (!collectionId || !themeId) return;
    setStep(1);
    setReady(false);
    setProgress(0);

    const created = await roomService.createRoom({
      collectionId,
      collectionName: collection?.name,
      themeId,
      ownedItems: owned,
      onProgress: setProgress,
    });

    setOverflow(roomService.overflow(created, owned.map((o) => o.id)));
    setRoom(created);
    setTitle(created.title);
    setDescription(created.description);
    setReady(true);
  }, [collectionId, collection?.name, themeId, owned]);

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
    setPublished(live);
    // Frame 11 — the room does not dead-end at publish; it hands off to J4.
    setInvites(await matchService.getRecommendedCollectors(viewerId, 3));
  }

  // ── Published (outside the numbered bar) ────────────────────────────
  if (published) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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
  if (!collectionId) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Which collection?</Text>
        <Text style={styles.body}>A room is built from one collection.</Text>
        {busy ? <LoadingState height={160} /> : null}
        {!busy && collections.length === 0 ? (
          <EmptyState
            title="No collections yet"
            body="Create a collection first — a room is a way of showing one."
            actionLabel="Create a collection"
            onAction={() => router.replace('/collection/new')}
          />
        ) : null}
        {collections.map((entry) => (
          <Pressable
            key={entry.id}
            style={styles.option}
            onPress={() => setCollectionId(entry.id)}
          >
            <Text style={styles.rowTitle}>{entry.name}</Text>
            <Text style={styles.muted}>
              {entry.itemIds.length} {entry.itemIds.length === 1 ? 'item' : 'items'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}>
      <StepperHeader
        steps={ROOM_STEPS}
        current={step}
        onBack={step === 0 ? () => router.back() : () => setStep(step - 1)}
      />

      {/* ── 0 Style ─────────────────────────────────────────────────── */}
      {step === 0 ? (
        <View style={styles.block}>
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
            return (
              <Pressable
                key={theme.id}
                onPress={() => setThemeId(theme.id)}
                style={[styles.option, selected && styles.optionActive]}
              >
                {isBest ? <Text style={styles.bestMatch}>✦ Best match</Text> : null}
                <View style={styles.themeRow}>
                  <View style={styles.swatches}>
                    {theme.palette.map((tone) => (
                      <View key={tone} style={[styles.swatch, { backgroundColor: tone }]} />
                    ))}
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{theme.name}</Text>
                    <Text style={styles.muted}>
                      {isBest && recommended ? recommended.reason : theme.description}
                    </Text>
                    <Text style={styles.footnote}>{theme.slots.length} placement slots</Text>
                  </View>
                  {selected ? <Text style={styles.tick}>✓</Text> : null}
                </View>
              </Pressable>
            );
          })}

          <PrimaryButton
            label="Generate my room"
            disabled={!themeId || owned.length === 0}
            onPress={() => void generate()}
          />
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
          {!ready ? (
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
            width={sceneWidth}
          />
          <Text style={styles.footnote}>Drag to explore · tap an item to inspect it</Text>

          {inspecting ? (
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },
  block: { gap: spacing.md },

  title: { ...typography.screenTitle, color: colors.textPrimary },
  sectionLabel: { ...typography.cardTitle, color: colors.textPrimary, marginTop: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },
  rowBody: { flex: 1, gap: 2 },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },
  warn: { ...typography.meta, color: colors.warning },
  link: { ...typography.meta, color: colors.accent },
  signalDetail: { ...typography.meta, color: colors.textSecondary },
  recommendLine: { ...typography.meta, color: colors.accent },
  bestMatch: { ...typography.meta, color: colors.accent, marginBottom: spacing.xs },
  tick: { color: colors.accent, fontSize: 18 },

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
