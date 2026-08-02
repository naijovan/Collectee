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
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar, ItemArt, ItemCard, LoadingState, PrimaryButton, SectionHeader } from '@/components';
import { timeAgo } from '@/components';
import { FEATURES } from '@/config/features';
import { VISIBILITY_LABELS } from '@/domain/collections';
import {
  FLAG_REASON_DESCRIPTIONS,
  FLAG_REASON_LABELS,
  FLAG_THRESHOLD,
  OWNERSHIP_FLAG_REASONS,
} from '@/domain/trust';
import { catalogueService, collectionService, socialService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Collection, Comment, FlagReason, Item, User } from '@/types';

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { viewerId } = useApp();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [owner, setOwner] = useState<User | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [authors, setAuthors] = useState<ReadonlyMap<string, User>>(new Map());
  const [draft, setDraft] = useState('');
  const [flagTarget, setFlagTarget] = useState<Item | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const found = await collectionService.getCollection(id);
    if (!found) {
      setBusy(false);
      return;
    }
    const [ownerUser, collectionItems, thread, users] = await Promise.all([
      socialService.getUser(found.userId),
      catalogueService.getItemsSorted(found.itemIds),
      socialService.getComments('collection', found.id, viewerId),
      socialService.getUsers(),
    ]);
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

  async function raiseFlag(item: Item, reason: FlagReason) {
    await socialService.raiseFlag({
      targetType: 'item',
      targetId: item.id,
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ItemArt
        seed={collection.id}
        tier={items[0]?.rarityTier ?? 'epic'}
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

      <PrimaryButton
        label="Build a room from this"
        onPress={() =>
          router.push({ pathname: '/room/new', params: { collectionId: collection.id } })
        }
      />

      <SectionHeader title="Items" />
      <View style={styles.grid}>
        {items.map((item) => (
          <View key={item.id} style={styles.itemWrap}>
            <ItemCard item={item} width="100%" artHeight={82} trustLevel="unverified" />
            {FEATURES.trustUi ? (
              <Pressable
                onPress={() => setFlagTarget(item)}
                hitSlop={8}
                style={styles.kebab}
                accessibilityLabel={`More options for ${item.name}`}
              >
                <Text style={styles.kebabText}>⋮</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      {/* §9.2 — the confirmation state. A flag is a claim, not a takedown. */}
      {flagTarget ? (
        <View style={styles.flagPanel}>
          <Text style={styles.rowTitle}>Flag “{flagTarget.name}”</Text>
          <Text style={styles.muted}>
            Flags do not remove anything. At {FLAG_THRESHOLD} distinct flags from collectors with
            verified items of their own, this item loses discovery ranking and enters a review queue.
          </Text>
          {OWNERSHIP_FLAG_REASONS.map((reason) => (
            <Pressable
              key={reason}
              style={styles.flagReason}
              onPress={() => void raiseFlag(flagTarget, reason)}
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

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },

  cover: { height: 168 },
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
