/**
 * A live Collection Room — the end of J3 and the thing the demo is built around.
 *
 * "Items are placed as cards, statues or wall art inside a themed space rather
 *  than a grid." The scene itself is `RoomScene`; this screen supplies the room,
 *  the focus controls and the share action.
 *
 * §11 F4 acceptance criteria met here:
 *   - smooth focus transitions (the camera spring lives in RoomScene)
 *   - one-tap export of a room still for sharing off-platform — mocked for the
 *     demo like everything else in §12.1, and labelled as such rather than
 *     pretending a file was written
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar, LoadingState, PrimaryButton, RoomScene, SectionHeader } from '@/components';
import { rarityLabelFor } from '@/domain/rarity';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import {
  catalogueService,
  collectionService,
  inventoryService,
  roomService,
  socialService,
} from '@/services';
import { colors, radius, rarityColors, spacing, typography } from '@/theme/theme';
import { VISIBILITY_LABELS } from '@/domain/collections';
import type { Collection, Item, Room, RoomTheme, User } from '@/types';

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const sceneWidth = Math.min(width, 520) - spacing.lg * 2;

  const scrollRef = useTopOnFocus();

  const [room, setRoom] = useState<Room | null>(null);
  const [theme, setTheme] = useState<RoomTheme | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [itemsByOwnedId, setItemsByOwnedId] = useState<ReadonlyMap<string, Item>>(new Map());
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const found = await roomService.getRoom(id);
    if (!found) {
      setBusy(false);
      return;
    }

    const [roomTheme, linkedCollection] = await Promise.all([
      roomService.getTheme(found.themeId),
      collectionService.getCollection(found.collectionId),
    ]);

    // Placements reference OwnedItem ids, which may belong to any collector.
    const resolved = await Promise.all(
      found.placements.map(async (placement) => {
        const owned = await inventoryService.getOwnedItem(placement.ownedItemId);
        if (!owned) return null;
        const item = await catalogueService.getItem(owned.itemId);
        return item ? ([placement.ownedItemId, item] as const) : null;
      }),
    );

    setRoom(found);
    setTheme(roomTheme);
    setCollection(linkedCollection);
    setOwner(linkedCollection ? await socialService.getUser(linkedCollection.userId) : null);
    setItemsByOwnedId(new Map(resolved.filter((pair): pair is readonly [string, Item] => pair !== null)));
    setBusy(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function focus(slotId: string | null) {
    if (!room) return;
    setRoom(await roomService.focusSlot(room.id, slotId));
  }

  if (busy) {
    return (
      <View style={[styles.screen, styles.content]}>
        <LoadingState height={220} />
      </View>
    );
  }

  if (!room) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.title}>Room not found</Text>
      </View>
    );
  }

  const focusedPlacement = room.placements.find((p) => p.slotId === room.settings.focusedSlotId);
  const focusedItem = focusedPlacement ? itemsByOwnedId.get(focusedPlacement.ownedItemId) : null;

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}>
      <RoomScene
        room={room}
        theme={theme}
        itemsByOwnedId={itemsByOwnedId}
        onSlotPress={(slot) =>
          void focus(room.settings.focusedSlotId === slot.id ? null : slot.id)
        }
        width={sceneWidth}
      />

      <View style={styles.headRow}>
        <View style={styles.rowBody}>
          <Text style={styles.title}>{collection?.name ?? 'Room'}</Text>
          <Text style={styles.muted}>
            {theme?.name ?? 'Theme'} · {room.placements.length} items ·{' '}
            {VISIBILITY_LABELS[room.visibility]}
          </Text>
        </View>
        {owner ? (
          <Pressable
            onPress={() => router.push({ pathname: '/collector/[id]', params: { id: owner.id } })}
          >
            <Avatar name={owner.displayName} verified={owner.isAccountVerified} size={40} />
          </Pressable>
        ) : null}
      </View>

      {focusedItem ? (
        <View style={[styles.focusCard, { borderColor: rarityColors[focusedItem.rarityTier] }]}>
          <Text style={styles.overline}>In focus</Text>
          <Text style={styles.rowTitle}>{focusedItem.name}</Text>
          <Text style={styles.muted}>
            {rarityLabelFor(focusedItem.rarityTier, focusedItem.title)} ·{' '}
            {Math.round(focusedItem.popularityScore * 100)}% of players own it
          </Text>
          <Pressable onPress={() => void focus(null)} hitSlop={8}>
            <Text style={styles.link}>Pull the camera back</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.muted}>
          Tap any item to transition the camera to it. Drag to shift the parallax layers.
        </Text>
      )}

      <PrimaryButton
        label={shared ? 'Still ready to share' : 'Export room still'}
        onPress={() => setShared(true)}
      />
      {shared ? (
        <Text style={styles.footnote}>
          Export is mocked for the demo like every other AI-adjacent call (§12.1) — no file is
          written. Say so if asked.
        </Text>
      ) : null}

      <SectionHeader title="In this room" />
      <View style={styles.list}>
        {room.placements.map((placement) => {
          const item = itemsByOwnedId.get(placement.ownedItemId);
          if (!item) return null;
          const isFocused = placement.slotId === room.settings.focusedSlotId;
          return (
            <Pressable
              key={placement.slotId}
              onPress={() => void focus(isFocused ? null : placement.slotId)}
              style={[styles.row, isFocused && styles.rowActive]}
            >
              <View style={[styles.dot, { backgroundColor: rarityColors[item.rarityTier] }]} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.muted}>
                  {rarityLabelFor(item.rarityTier, item.title)} · slot {placement.slotId.split('-').pop()}
                </Text>
              </View>
              {placement.rotation !== 0 ? (
                <Text style={styles.footnote}>{placement.rotation}°</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },

  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  overline: { ...typography.meta, color: colors.accent, letterSpacing: 0.5 },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },
  rowBody: { flex: 1, gap: 2 },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },
  link: { ...typography.meta, color: colors.accent, marginTop: spacing.xs },

  focusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 2,
    padding: spacing.lg,
    gap: 2,
  },

  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowActive: { borderColor: colors.accent },
  dot: { width: 10, height: 10, borderRadius: radius.pill },
});
