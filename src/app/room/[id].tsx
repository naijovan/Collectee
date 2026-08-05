/**
 * A live Collection Room — the last screen of J3 and the thing that gets shared.
 *
 * This is the payoff for the whole thesis: "your skins live in a menu no one
 * else ever sees. Collectee is the room you put them in." So it is a public
 * object with an audience — visitors, likes, comments — and a route back to the
 * collection it was built from.
 *
 * §11 F4 acceptance criteria answered here:
 *   - smooth look-at focus transitions (the camera spring lives in RoomScene)
 *   - one-tap export of a room still for sharing off-platform
 *
 * ⚠️ Export is still mocked. §14 puts *share* on the never-cut chain, so this
 * needs `react-native-view-shot` + `expo-sharing` to actually produce a file —
 * a dependency call that §13.1 says goes through chat first. Until then the
 * button says plainly that nothing was written. Do not soften that copy into
 * implying a file exists.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Avatar,
  KeyboardSafe,
  Collectible3DViewer,
  ItemCard,
  LoadingState,
  PrimaryButton,
  RoomScene,
  SectionHeader,
  timeAgo,
} from '@/components';
import { VISIBILITY_LABELS } from '@/domain/collections';
import { rarityLabelFor } from '@/domain/rarity';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import {
  catalogueService,
  collectionService,
  inventoryService,
  roomService,
  socialService,
} from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, rarityColors, spacing, typography } from '@/theme/theme';
import type { Collection, Comment, Item, Room, RoomTheme, User } from '@/types';

export default function RoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { viewerId } = useApp();
  const sceneWidth = Math.min(width, 520) - spacing.lg * 2;

  const scrollRef = useTopOnFocus();

  const [room, setRoom] = useState<Room | null>(null);
  const [theme, setTheme] = useState<RoomTheme | null>(null);
  const [collection, setCollection] = useState<Collection | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [itemsByOwnedId, setItemsByOwnedId] = useState<ReadonlyMap<string, Item>>(new Map());
  const [comments, setComments] = useState<Comment[]>([]);
  const [authors, setAuthors] = useState<ReadonlyMap<string, User>>(new Map());
  const [draft, setDraft] = useState('');
  const [liked, setLiked] = useState(false);
  const [shared, setShared] = useState(false);
  const [inspecting3D, setInspecting3D] = useState<Item | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const found = await roomService.getRoom(id);
    if (!found) {
      setBusy(false);
      return;
    }

    const [roomTheme, linked, thread, users] = await Promise.all([
      roomService.getTheme(found.themeId),
      collectionService.getCollection(found.collectionId),
      socialService.getComments('room', found.id, viewerId),
      socialService.getUsers(),
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
    setCollection(linked);
    setOwner(linked ? (users.find((u) => u.id === linked.userId) ?? null) : null);
    setComments(thread);
    setAuthors(new Map(users.map((user) => [user.id, user])));
    setItemsByOwnedId(
      new Map(resolved.filter((pair): pair is readonly [string, Item] => pair !== null)),
    );
    setBusy(false);
  }, [id, viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function focus(slotId: string | null) {
    if (!room) return;
    setRoom(await roomService.focusSlot(room.id, slotId));
  }

  async function postComment() {
    if (!room || draft.trim().length === 0) return;
    await socialService.addComment({
      targetType: 'room',
      targetId: room.id,
      userId: viewerId,
      body: draft.trim(),
    });
    setDraft('');
    setComments(await socialService.getComments('room', room.id, viewerId));
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
  const items = [...itemsByOwnedId.values()];

  return (
    /* The comment composer sits at the bottom of this scroll view — without
       this the iOS keyboard covers the field the user just tapped. */
    <KeyboardSafe>
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}>
      <Collectible3DViewer item={inspecting3D} onClose={() => setInspecting3D(null)} />


      <Text style={styles.title}>{room.title}</Text>
      <Text style={styles.muted}>{theme?.name ?? 'Room'}</Text>

      <View style={styles.creditRow}>
        {owner ? (
          <Pressable
            style={styles.credit}
            onPress={() => router.push({ pathname: '/collector/[id]', params: { id: owner.id } })}
          >
            <Avatar name={owner.displayName} verified={owner.isAccountVerified} size={34} />
            <Text style={styles.rowTitle}>{owner.displayName}</Text>
          </Pressable>
        ) : null}
        <View style={styles.credit}>
          <Text style={styles.muted}>Source</Text>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {collection?.name ?? '—'}
          </Text>
        </View>
        <View style={styles.credit}>
          <Text style={styles.muted}>Visitors</Text>
          <Text style={styles.rowTitle}>{room.visitorCount.toLocaleString()}</Text>
        </View>
      </View>

      <RoomScene
        room={room}
        theme={theme}
        itemsByOwnedId={itemsByOwnedId}
        onSlotPress={(slot) =>
          void focus(room.settings.focusedSlotId === slot.id ? null : slot.id)
        }
        onInspect3D={setInspecting3D}
        width={sceneWidth}
      />

      {/* The scene above is a preview at page width. This is the room itself. */}
      <Pressable
        style={styles.enterCta}
        onPress={() =>
          router.push({ pathname: '/room/immersive/[id]', params: { id: room.id } })
        }
      >
        <Text style={styles.enterCtaText}>⛶  Enter the room</Text>
      </Pressable>

      {collection ? (
        <Pressable
          style={styles.sourceCta}
          onPress={() =>
            router.push({ pathname: '/collection/[id]', params: { id: collection.id } })
          }
        >
          <Text style={styles.sourceCtaText}>✦ View {collection.name} collection →</Text>
        </Pressable>
      ) : null}

      {room.description ? <Text style={styles.body}>{room.description}</Text> : null}

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
          <Pressable
            onPress={() => setInspecting3D(focusedItem)}
            style={styles.inspect3DButton}
          >
            <Text style={styles.inspect3DText}>View in 3D</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.muted}>
          Tap any item to transition the camera to it. Drag to shift the parallax layers.
        </Text>
      )}

      {/* Item strip — the frames cap it and show a +N overflow chip. */}
      <View style={styles.strip}>
        {items.slice(0, 5).map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            width={72}
            artHeight={52}
            onPress={() => setInspecting3D(item)}
          />
        ))}
        {items.length > 5 ? (
          <View style={styles.overflowChip}>
            <Text style={styles.rowTitle}>+{items.length - 5}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statRow}>
        <Pressable style={styles.stat} onPress={() => setLiked((prev) => !prev)}>
          {/* Optimistic only — there is no like endpoint until phase 2. */}
          <Text style={[styles.statValue, liked && styles.liked]}>
            ♥ {(room.likeCount + (liked ? 1 : 0)).toLocaleString()}
          </Text>
          <Text style={styles.muted}>likes</Text>
        </Pressable>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{comments.length}</Text>
          <Text style={styles.muted}>comments</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{VISIBILITY_LABELS[room.visibility]}</Text>
          <Text style={styles.muted}>visibility</Text>
        </View>
      </View>

      <PrimaryButton
        label={shared ? 'Still ready to share' : 'Export room still'}
        onPress={() => setShared(true)}
      />
      {shared ? (
        <Text style={styles.footnote}>
          Export is mocked like every other AI-adjacent call in this build (§12.1) — no file was
          written. Say so if asked.
        </Text>
      ) : null}

      {room.allowComments ? (
        <View style={styles.block}>
          <SectionHeader title={`Comments (${comments.length})`} />
          {comments.map((comment) => {
            const author = authors.get(comment.userId);
            return (
              <View key={comment.id} style={styles.comment}>
                <Avatar name={author?.displayName ?? '?'} verified={author?.isAccountVerified} size={30} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>
                    {author?.displayName ?? 'Unknown'}{' '}
                    <Text style={styles.muted}>· {timeAgo(comment.createdAt)}</Text>
                  </Text>
                  <Text style={styles.body}>{comment.body}</Text>
                </View>
                <Text style={styles.muted}>♥ {comment.likeCount}</Text>
              </View>
            );
          })}

          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
            <Pressable onPress={() => void postComment()} style={styles.send}>
              <Text style={styles.sendText}>Post</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={styles.footnote}>Comments are off for this room.</Text>
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
    </KeyboardSafe>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    width: '100%',
    maxWidth: 552,
    alignSelf: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  block: { gap: spacing.md },

  title: { ...typography.screenTitle, color: colors.textPrimary },
  overline: { ...typography.meta, color: colors.accent, letterSpacing: 0.5 },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },
  rowBody: { flex: 1, gap: 2 },
  body: { ...typography.body, color: colors.textSecondary },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },
  link: { ...typography.meta, color: colors.accent, marginTop: spacing.xs },
  enterCta: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  enterCtaText: { ...typography.cardTitle, color: colors.accent },
  inspect3DButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  inspect3DText: { ...typography.meta, color: colors.accent },

  creditRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  credit: { flex: 1, gap: 2 },

  sourceCta: {
    alignSelf: 'center',
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: -spacing.xl - spacing.xs,
  },
  sourceCtaText: { ...typography.meta, color: colors.textOnAccent },

  focusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 2,
    padding: spacing.lg,
    gap: 2,
  },

  strip: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', alignItems: 'center' },
  overflowChip: {
    width: 72,
    height: 52,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  liked: { color: colors.danger },

  comment: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  composer: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
  send: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  sendText: { ...typography.cardTitle, color: colors.textOnAccent },
});
