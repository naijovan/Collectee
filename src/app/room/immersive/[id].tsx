/**
 * The full-screen Showroom — PRD §11 F4, the differentiator.
 *
 * A separate route rather than a mode on `room/[id]` deliberately. That screen
 * is the room's *page*: title, credit, likes, comments, share. This is the room
 * itself, edge to edge with nothing else in frame, and the two want opposite
 * layouts — one scrolls, one must not.
 *
 * It also keeps the merge surface small. `room/[id].tsx` is touched by three
 * flows; this file is touched by none of them.
 *
 * ── What is interactive here ──────────────────────────────────────────────
 *   drag           → look around the room (parallax on the whole gallery)
 *   tap an item    → camera focuses it, atmosphere tightens
 *   tap it again   → opens the inspector, where it spins freely
 *   tap the strip  → jumps straight to the inspector for that item
 *
 * The focus round-trip goes through `roomService` rather than local state, so
 * the focal item is the same whether you arrived here, from the room page, or
 * from the build flow — `settings.focusedSlotId` is room data, not view state.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Collectible3DViewer, ImmersiveRoom3D, ItemCard, LoadingState } from '@/components';
import { catalogueService, inventoryService, roomService } from '@/services';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Item, Room, RoomTheme } from '@/types';

const TOP_CONTROL_SIZE = 40;

export default function ImmersiveRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [room, setRoom] = useState<Room | null>(null);
  const [theme, setTheme] = useState<RoomTheme | null>(null);
  const [itemsByOwnedId, setItemsByOwnedId] = useState<ReadonlyMap<string, Item>>(new Map());
  const [inspecting, setInspecting] = useState<Item | null>(null);
  const [busy, setBusy] = useState(true);

  // Same resolution path as room/[id]: placements reference OwnedItem ids,
  // which may belong to any collector, so each is looked up individually
  // rather than assuming the room owner holds them all.
  const load = useCallback(async () => {
    const found = await roomService.getRoom(id);
    if (!found) {
      setBusy(false);
      return;
    }

    const [roomTheme, resolved] = await Promise.all([
      roomService.getTheme(found.themeId),
      Promise.all(
        found.placements.map(async (placement) => {
          const owned = await inventoryService.getOwnedItem(placement.ownedItemId);
          if (!owned) return null;
          const item = await catalogueService.getItem(owned.itemId);
          return item ? ([placement.ownedItemId, item] as const) : null;
        }),
      ),
    ]);

    setRoom(found);
    setTheme(roomTheme);
    setItemsByOwnedId(
      new Map(resolved.filter((pair): pair is readonly [string, Item] => pair !== null)),
    );
    setBusy(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => [...itemsByOwnedId.values()], [itemsByOwnedId]);

  // A shared room link opens this route cold, so there is nothing to pop. Fall
  // back to the room's own page rather than leaving the control dead — the
  // dev-time "GO_BACK was not handled by any navigator" is a real dead end.
  const leave = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({ pathname: '/room/[id]', params: { id } });
  }, [router, id]);

  const focus = useCallback(
    async (slotId: string | null) => {
      if (!room) return;
      setRoom(await roomService.focusSlot(room.id, slotId));
    },
    [room],
  );

  if (busy) {
    return (
      <View style={styles.missing}>
        <LoadingState height={220} />
      </View>
    );
  }

  if (!room) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>That room is not available.</Text>
        <Pressable onPress={leave} hitSlop={8}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const focusedPlacement = room.placements.find((p) => p.slotId === room.settings.focusedSlotId);
  const focusedItem = focusedPlacement ? itemsByOwnedId.get(focusedPlacement.ownedItemId) : null;
  const topBarInset = Math.max(insets.top, spacing.md) + spacing.sm;
  const sceneChromeTop = topBarInset + TOP_CONTROL_SIZE + spacing.md;

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      {/* The scene takes the whole viewport. Everything else floats over it. */}
      <ImmersiveRoom3D
        room={room}
        theme={theme}
        itemsByOwnedId={itemsByOwnedId}
        onSlotPress={(slot) =>
          void focus(room.settings.focusedSlotId === slot.id ? null : slot.id)
        }
        onInspect3D={setInspecting}
        width={width}
        height={height}
        immersive
        chromeTopInset={sceneChromeTop}
      />

      <Collectible3DViewer item={inspecting} onClose={() => setInspecting(null)} />

      {/* `box-none` so drags fall through to the scene; only the controls take
          touches. Without it the whole room becomes unlookable. */}
      <View style={[StyleSheet.absoluteFill, styles.passThrough]}>
        <View
          style={[
            styles.topBar,
            styles.passThrough,
            // Web reports no safe-area inset, which would pin the controls to
            // y=0 hard against the top edge. Floor it.
            { paddingTop: topBarInset },
          ]}
        >
          <Pressable
            accessibilityLabel="Leave the room"
            hitSlop={12}
            onPress={leave}
            style={styles.iconButton}
          >
            <Text style={styles.iconText}>‹</Text>
          </Pressable>

          <View style={[styles.titleBlock, styles.noTouch]}>
            <Text style={styles.title} numberOfLines={1}>
              {room.title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {theme?.name ?? 'Room'} · {items.length} items
            </Text>
          </View>

          <Pressable
            accessibilityLabel="Room details, comments and sharing"
            hitSlop={12}
            onPress={() => router.push({ pathname: '/room/[id]', params: { id: room.id } })}
            style={styles.iconButton}
          >
            <Text style={styles.iconTextSmall}>⋯</Text>
          </Pressable>
        </View>

        <View style={[styles.bottom, styles.passThrough]}>
          <Text style={[styles.hint, styles.noTouch]}>
            {focusedItem
              ? `${focusedItem.name} · tap again to inspect`
              : 'Drag to look around · tap an item to focus it'}
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.stripWrap}
            contentContainerStyle={[styles.strip, { paddingBottom: insets.bottom + spacing.md }]}
          >
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                width={92}
                artHeight={62}
                onPress={() => setInspecting(item)}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },

  /** Drags fall through to the scene; only the controls themselves take touches.
      Without this the whole room becomes unlookable. */
  passThrough: { pointerEvents: 'box-none' },
  noTouch: { pointerEvents: 'none' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { ...typography.cardTitle, color: colors.textPrimary },
  subtitle: { ...typography.meta, color: colors.textSecondary },

  iconButton: {
    width: TOP_CONTROL_SIZE,
    height: TOP_CONTROL_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  iconText: { color: colors.textPrimary, fontSize: 26, lineHeight: 28 },
  iconTextSmall: { color: colors.textPrimary, fontSize: 20, lineHeight: 22 },

  bottom: { marginTop: 'auto', gap: spacing.sm },
  hint: {
    ...typography.meta,
    color: colors.textSecondary,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  stripWrap: { backgroundColor: colors.surfaceSunken, opacity: 0.92 },
  strip: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },

  missing: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  missingText: { ...typography.body, color: colors.textSecondary },
  link: { ...typography.meta, color: colors.accent },
});
