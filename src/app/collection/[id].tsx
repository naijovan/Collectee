/**
 * Public collection page — the end of J2 and the thing that gets shared.
 *
 * Also where the §9.3 trust UI lands. The PRD is blunt about this: the trust
 * model is the prepared answer to the hardest Q&A question, safer communities
 * is an explicit judging theme (§8.2), and none of it is in the Figma. It needs
 * "a badge slot on ItemCard, a Flag entry in the item ⋮ menu with a confirmation
 * state — or the claim comes out of the pitch."
 *
 * Both exist now, behind `FEATURES.trustUi` so the 4 Aug decision is a flag
 * flip either way. Flags never auto-remove: `n ≥ 3` distinct flags from
 * accounts with their own verified items drops discovery ranking and opens a
 * review queue (§9.2). The threshold guard matters — an unguarded flag button
 * in a competitive community becomes a weapon.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Avatar,
  KeyboardSafe,
  ItemArt,
  ItemCard,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from '@/components';
import { timeAgo } from '@/components';
import { FEATURES } from '@/config/features';
import { VISIBILITY_LABELS } from '@/domain/collections';
import {
  FLAG_REASON_DESCRIPTIONS,
  FLAG_REASON_LABELS,
  FLAG_THRESHOLD,
  OWNERSHIP_FLAG_REASONS,
  roomEligibility,
} from '@/domain/trust';
import type { RoomEligibility } from '@/domain/trust';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import {
  catalogueService,
  collectionService,
  inventoryService,
  roomService,
  socialService,
} from '@/services';
import type { RoomStatus } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Collection, Comment, FlagReason, Item, OwnedItem, User } from '@/types';

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { viewerId } = useApp();

  const scrollRef = useTopOnFocus();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [authors, setAuthors] = useState<ReadonlyMap<string, User>>(new Map());
  const [draft, setDraft] = useState('');
  const [flagTarget, setFlagTarget] = useState<{ item: Item; claim: OwnedItem } | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus | undefined>(undefined);
  const [busy, setBusy] = useState(true);

  /**
   * The OWNER's ownership claim for each catalogue item in this collection,
   * keyed by `Item.id`.
   *
   * Two things on this page are meaningless without it. A trust badge belongs to
   * a claim, not to a catalogue entry — the same Prime Vandal is verified for one
   * collector and unverified for another — and a flag disputes a claim, so it
   * needs the `OwnedItem.id` (see `FLAG_TARGET_ID_SPACE` in domain/trust.ts).
   * Read from the owner, never the viewer: this page is usually someone else's.
   */
  const [claims, setClaims] = useState<ReadonlyMap<string, OwnedItem>>(new Map());
  const [eligibility, setEligibility] = useState<RoomEligibility | null>(null);

  const load = useCallback(async () => {
    const found = await collectionService.getCollection(id);
    if (!found) {
      setBusy(false);
      return;
    }
    const [ownerUser, collectionItems, thread, users, ownerInventory] = await Promise.all([
      socialService.getUser(found.userId),
      catalogueService.getItemsSorted(found.itemIds),
      socialService.getComments('collection', found.id, viewerId),
      socialService.getUsers(),
      inventoryService.getOwnedItems(found.userId),
    ]);

    const inCollection = ownerInventory.filter((owned) => found.itemIds.includes(owned.itemId));
    setClaims(new Map(inCollection.map((owned) => [owned.itemId, owned])));
    // §9.4 — the room gate. Derived from the claims, never stored on the
    // collection, so linking an account or resolving a flag changes the answer
    // on the next load rather than leaving a stale boolean behind (§12.3).
    setEligibility(
      roomEligibility(inCollection, (ownedItemId) => socialService.isUnderReview(ownedItemId)),
    );

    setRoomStatus((await roomService.statusByCollection()).get(found.id));
    setCollection(found);
    setOwner(ownerUser);
    setItems(collectionItems);
    setComments(thread);
    setAuthors(new Map(users.map((user) => [user.id, user])));
    setBusy(false);
  }, [id, viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function postComment() {
    if (!collection || draft.trim().length === 0) return;
    await socialService.addComment({
      targetType: 'collection',
      targetId: collection.id,
      userId: viewerId,
      body: draft.trim(),
    });
    setDraft('');
    setComments(await socialService.getComments('collection', collection.id, viewerId));
  }

  /**
   * `targetId` is the owner's `OwnedItem.id`, NOT `Item.id`.
   *
   * A flag disputes one person's ownership claim; flagging the catalogue entry
   * would dispute the concept of the skin, which means nothing and never
   * resolves to a review-queue entry (`previewFor` in socialService looks the
   * target up with `getOwnedItem`).
   */
  async function raiseFlag(claim: OwnedItem, reason: FlagReason) {
    await socialService.raiseFlag({
      targetType: 'item',
      targetId: claim.id,
      reporterId: viewerId,
      reason,
    });
    setFlagTarget(null);
  }

  if (busy) {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <LoadingState height={180} />
        </View>
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.title}>Collection not found</Text>
      </View>
    );
  }

  const isOwner = collection.userId === viewerId;

  /**
   * Share is the last rung of the never-cut chain (§14), so it is the one
   * action on this page that gets a real implementation rather than a mock.
   *
   * The OS sheet is genuine — the *link* is the honest part: there is no
   * backend and no public host, so it shares a deep link into the app rather
   * than pretending a collectee.app URL resolves for anyone else. Swapping in a
   * real URL later is a one-line change in this function.
   */
  async function shareCollection() {
    if (!collection) return;
    try {
      await Share.share({
        title: collection.name,
        message: `${collection.name} — ${items.length} items on Collectee\ncollectee://collection/${collection.id}`,
      });
    } catch {
      /* The user dismissed the sheet, or the platform has no share target.
         Neither is an error worth interrupting them over. */
    }
  }
  /**
   * An already-published room is never re-gated. The items were eligible when it
   * was built, and pulling a live room's entrance because one item later picked
   * up a flag would be an auto-removal — which §9.2 says flags never do.
   */
  const roomBlocked = !roomStatus?.published && eligibility !== null && !eligibility.eligible;

  return (
    /* The comment composer sits at the bottom of this scroll view — without
       this the iOS keyboard covers the field the user just tapped. */
    <KeyboardSafe>
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}>
      <ItemArt
        seed={collection.id}
        tier={items[0]?.rarityTier ?? 'epic'}
        renderUrl={items[0]?.renderUrl}
        style={styles.cover}
      />

      <Text style={styles.title}>{collection.name}</Text>
      <Text style={styles.body}>{collection.description}</Text>

      {owner ? (
        <Pressable
          style={styles.ownerRow}
          onPress={() => router.push({ pathname: '/collector/[id]', params: { id: owner.id } })}
        >
          <Avatar name={owner.displayName} verified={owner.isAccountVerified} size={34} />
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>{owner.displayName}</Text>
            <Text style={styles.muted}>@{owner.handle}</Text>
          </View>
        </Pressable>
      ) : null}

      <View style={styles.metaRow}>
        <Text style={styles.like}>♥ {collection.likeCount.toLocaleString()}</Text>
        <Text style={styles.muted}>{items.length} items</Text>
        <Text style={styles.muted}>{VISIBILITY_LABELS[collection.visibility]}</Text>
      </View>

      {/*
        The 2×2 action grid from the design frames. Create Showroom is
        the primary action — J3 is the differentiator (§11 F4), and a collection
        page that treats it as a footnote buries the feature the pitch leads on.
      */}
      <View style={styles.actionGrid}>
        <View style={styles.actionCell}>
          <SecondaryButton label="✎ Edit collection" disabled />
        </View>
        <View style={styles.actionCell}>
          <PrimaryButton
            label={roomStatus?.published ? 'View room' : 'Create Showroom'}
            disabled={roomBlocked}
            onPress={() =>
              roomStatus?.published
                ? router.push({ pathname: '/room/[id]', params: { id: roomStatus.room.id } })
                : router.push({ pathname: '/room/intro', params: { collectionId: collection.id } })
            }
          />
        </View>
        <View style={styles.actionCell}>
          <SecondaryButton label="⇪ Share" onPress={() => void shareCollection()} />
        </View>
        <View style={styles.actionCell}>
          <SecondaryButton label="+ Add items" disabled />
        </View>
      </View>

      {/*
        §9.4 again — these two are disabled because the edit flow is not built,
        not because of anything about this collection. A greyed button with no
        reason is exactly the failure CLAUDE.md names, and "we ran out of days"
        is a legitimate reason to print.
      */}
      <Text style={styles.footnote}>
        Editing a published collection lands after the demo. Create a new collection to change what
        is in one.
      </Text>

      {/*
        §9.4 — a disabled button with no explanation is the failure CLAUDE.md
        calls out by name. Say which items are blocking the room and, for the
        owner, give them the one action that fixes it.
      */}
      {roomBlocked && eligibility ? (
        <View style={styles.gate}>
          <Text style={styles.gateTitle}>🔒 Rooms are a verified perk</Text>
          <Text style={styles.muted}>{eligibility.reason}</Text>
          <Text style={styles.footnote}>
            This collection stays public either way — verification only gates the interactive room
            (§9.4).
          </Text>
          {isOwner ? (
            <SecondaryButton
              label="Link a game account"
              onPress={() => router.push('/link-account')}
            />
          ) : null}
        </View>
      ) : null}

      {roomStatus && !roomStatus.published ? (
        <Pressable
          onPress={() => router.push({ pathname: '/room/[id]', params: { id: roomStatus.room.id } })}
        >
          <Text style={styles.pending}>◷ A room for this collection is in progress</Text>
        </Pressable>
      ) : null}

      <SectionHeader title="Items" />
      <View style={styles.grid}>
        {items.map((item) => {
          // The badge reports the OWNER's claim. It used to be hard-coded
          // `unverified`, which told every visitor a verified collection was
          // self-reported — the exact overstatement §9.2 exists to prevent, in
          // reverse.
          const claim = claims.get(item.id);
          return (
            <View key={item.id} style={styles.itemWrap}>
              <ItemCard
                item={item}
                width="100%"
                artHeight={82}
                trustLevel={claim?.trustLevel}
              />
              {FEATURES.trustUi && claim ? (
                <Pressable
                  onPress={() => setFlagTarget({ item, claim })}
                  hitSlop={8}
                  style={styles.kebab}
                  accessibilityLabel={`More options for ${item.name}`}
                >
                  <Text style={styles.kebabText}>⋮</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* §9.2 — the confirmation state. A flag is a claim, not a takedown. */}
      {flagTarget ? (
        <View style={styles.flagPanel}>
          <Text style={styles.rowTitle}>Flag “{flagTarget.item.name}”</Text>
          <Text style={styles.muted}>
            Flags do not remove anything. At {FLAG_THRESHOLD} distinct flags from collectors with
            verified items of their own, this item loses discovery ranking and enters a review queue.
          </Text>
          <Text style={styles.footnote}>
            You are disputing {owner?.displayName ?? 'this collector'}&apos;s claim on this item, not
            the item itself.
          </Text>
          {OWNERSHIP_FLAG_REASONS.map((reason) => (
            <Pressable
              key={reason}
              style={styles.flagReason}
              onPress={() => void raiseFlag(flagTarget.claim, reason)}
            >
              <Text style={styles.rowTitle}>{FLAG_REASON_LABELS[reason]}</Text>
              <Text style={styles.muted}>{FLAG_REASON_DESCRIPTIONS[reason]}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setFlagTarget(null)} style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      ) : null}

      {collection.allowComments ? (
        <View style={styles.commentBlock}>
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
        <Text style={styles.footnote}>Comments are off for this collection.</Text>
      )}

      {/* Destructive, so it sits last and behind a confirm. Only offered for
          collections made this session — the seeded ones are a frozen fixture
          the demo depends on, and a delete button that silently fails is worse
          than no button. */}
      {collectionService.isDeletable(collection.id) ? (
        <View style={styles.dangerZone}>
          {confirmDelete ? (
            <>
              <Text style={styles.dangerTitle}>Delete “{collection.name}”?</Text>
              <Text style={styles.muted}>
                The collection is removed. The {collection.itemIds.length} items in it stay in
                your inventory — a collection is a grouping, not the items themselves.
              </Text>
              <View style={styles.dangerRow}>
                <Pressable
                  onPress={async () => {
                    await collectionService.deleteCollection(collection.id);
                    router.replace('/collections');
                  }}
                  style={({ pressed }) => [styles.dangerConfirm, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.dangerConfirmText}>Delete for good</Text>
                </Pressable>
                <Pressable
                  onPress={() => setConfirmDelete(false)}
                  style={({ pressed }) => [styles.dangerCancel, pressed && { opacity: 0.8 }]}
                >
                  <Text style={styles.dangerCancelText}>Keep it</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <Pressable
              onPress={() => setConfirmDelete(true)}
              style={({ pressed }) => [styles.dangerButton, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.dangerButtonText}>Delete collection</Text>
            </Pressable>
          )}
        </View>
      ) : null}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
    </KeyboardSafe>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },

  cover: { height: 168 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  actionCell: { width: '47%' },
  pending: { ...typography.meta, color: colors.warning },

  // §9.4 room gate — an explanation, not a dead end.
  gate: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  gateTitle: { ...typography.cardTitle, color: colors.textPrimary },

  title: { ...typography.screenTitle, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },

  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  like: { ...typography.meta, color: colors.danger },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  itemWrap: { width: '30%' },
  kebab: { position: 'absolute', top: 2, right: 2, paddingHorizontal: spacing.xs },
  kebabText: { color: colors.textPrimary, fontSize: 16 },

  flagPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  flagReason: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 2,
  },
  cancel: { alignItems: 'center', paddingVertical: spacing.sm },
  cancelText: { ...typography.cardTitle, color: colors.textSecondary },

  dangerZone: {
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerTitle: { ...typography.cardTitle, color: colors.danger },
  dangerRow: { flexDirection: 'row', gap: spacing.sm },
  dangerButton: { alignItems: 'center', paddingVertical: spacing.md },
  dangerButtonText: { ...typography.cardTitle, color: colors.danger },
  dangerConfirm: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  dangerConfirmText: { ...typography.cardTitle, color: colors.textOnAccent },
  dangerCancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dangerCancelText: { ...typography.cardTitle, color: colors.textSecondary },

  commentBlock: { gap: spacing.md },
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
