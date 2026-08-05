/**
 * Collections tab — the viewer's own collections (J2 lands here when published).
 *
 * Behind the §13.4 onboarding gate: `TabBar` keeps this unreachable until the
 * first import completes. The empty state below is the second line of defence,
 * not the gate itself — do not re-derive `hasImported` here.
 *
 * Set-completion progress comes from `domain/collections.ts` via the service
 * layer; it is the one piece of F2 (§11, [ROADMAP]) that costs nothing because
 * it needs no model call.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  CollectionCard,
  EmptyState,
  FadeInView,
  FilterChips,
  LoadingState,
  PrimaryButton,
  SectionHeader,
} from '@/components';
import { headlineItem, VISIBILITY_LABELS } from '@/domain/collections';
import type { SetProgress } from '@/domain/collections';
import { suggestRoom } from '@/domain/roomSuggestion';
import type { RoomSuggestion } from '@/domain/roomSuggestion';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { catalogueService, collectionService, inventoryService, roomService } from '@/services';
import type { RoomStatus } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Collection, Item } from '@/types';

/** §14 rung: "Has room" is the filter that makes J3 discoverable from J2. */
const FILTERS = ['All', 'Public', 'Private', 'Has room'] as const;
type Filter = (typeof FILTERS)[number];

interface Entry {
  collection: Collection;
  headline: Item | null;
  /** The room this collection would get if the user asked for one. */
  suggestion: RoomSuggestion | null;
}

export default function CollectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { viewer, viewerId, inventory } = useApp();

  const scrollRef = useTopOnFocus();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [rooms, setRooms] = useState<ReadonlyMap<string, RoomStatus>>(new Map());
  const [filter, setFilter] = useState<Filter>('All');
  const [progress, setProgress] = useState<SetProgress[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const mine = await collectionService.getCollectionsByUser(viewerId, true);
    const themes = await roomService.getThemes();
    const withArt = await Promise.all(
      mine.map(async (collection) => {
        const items = await catalogueService.getItems(collection.itemIds);
        return {
          collection,
          headline: headlineItem(items),
          // Scored from the collection's own contents — colour, rarity, title
          // mix and item form. Pure logic, so it costs nothing to do per card.
          suggestion: suggestRoom(items, themes),
        };
      }),
    );
    const owned = await inventoryService.getOwnedItems(viewerId);
    setEntries(withArt);
    // One pass for every card's room CTA, rather than a fetch per card.
    setRooms(await roomService.statusByCollection());
    setProgress(await collectionService.setProgressFor(owned));
    setBusy(false);
  }, [viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  // A collection published in J2 must appear the moment the flow pops back.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const { refreshing, onRefresh } = usePullToRefresh(load);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.textSecondary}
          colors={[colors.accent]}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Collections</Text>
        <Text style={styles.muted}>{inventory.length} items owned</Text>
      </View>

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      <PrimaryButton label="+  Create a collection" onPress={() => router.push('/collection/new')} />

      {busy ? (
        <LoadingState height={220} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No collections yet"
          body="A collection is the moment an inventory dump becomes an identity. Pick some items and name the set."
          actionLabel="Create a collection"
          onAction={() => router.push('/collection/new')}
        />
      ) : (
        <View style={styles.grid}>
          {entries
            .filter((entry) => matchesFilter(entry.collection, rooms.get(entry.collection.id), filter))
            .map((entry, index) => (
              <FadeInView key={entry.collection.id} index={index} style={styles.gridItem}>
                <CollectionCard
                  collection={entry.collection}
                  owner={viewer}
                  headline={entry.headline}
                  onPress={() =>
                    router.push({
                      pathname: '/collection/[id]',
                      params: { id: entry.collection.id },
                    })
                  }
                />
                <Text style={styles.visibility}>
                  {VISIBILITY_LABELS[entry.collection.visibility]}
                </Text>
                <RoomCta
                  status={rooms.get(entry.collection.id)}
                  collectionId={entry.collection.id}
                  suggestion={entry.suggestion}
                />
              </FadeInView>
            ))}
        </View>
      )}

      {/* "Sets in progress" lived here. Set completion is a real feature (§4, the
          Completionist persona) but it is not this screen's job — Collections is
          the grid, per the frame. It moves to the collection detail page rather
          than being deleted; `setProgressFor` is untouched. */}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function matchesFilter(
  collection: Collection,
  status: RoomStatus | undefined,
  filter: Filter,
): boolean {
  switch (filter) {
    case 'Public':
      return collection.visibility === 'public';
    case 'Private':
      return collection.visibility === 'private';
    case 'Has room':
      return status !== undefined;
    default:
      return true;
  }
}

/**
 * The per-card room CTA — three states, straight from the design frames:
 * a published room links to it, a draft says so, and no room at all invites
 * one. This is the only entry point to J3 that does not require opening the
 * collection first, so it carries a lot of the flow's discoverability.
 */
function RoomCta({
  status,
  collectionId,
  suggestion,
}: {
  status: RoomStatus | undefined;
  collectionId: string;
  /** The room this collection would get, from `domain/roomSuggestion`. */
  suggestion?: RoomSuggestion | null;
}) {
  const router = useRouter();

  // A published room opens full-screen. An unpublished one goes to the page,
  // where the build flow and its status live — there is nothing to walk into yet.
  if (status?.published) {
    return (
      <Pressable
        style={styles.roomCta}
        onPress={() =>
          router.push({ pathname: '/room/immersive/[id]', params: { id: status.room.id } })
        }
      >
        <Text style={styles.roomCtaText}>View room  →</Text>
      </Pressable>
    );
  }

  if (status) {
    return (
      <Pressable
        style={[styles.roomCta, styles.roomCtaMuted]}
        onPress={() => router.push({ pathname: '/room/[id]', params: { id: status.room.id } })}
      >
        <Text style={styles.roomCtaPending}>◷  Room in progress</Text>
      </Pressable>
    );
  }

  // No room yet — lead with what the app would build, not a bare CTA. The
  // suggestion is the feature (§11 F4); the button is how you accept it.
  return (
    <>
      {suggestion ? (
        <View style={styles.suggestRow}>
          <Text style={styles.suggestSpark}>✦</Text>
          <Text style={styles.suggestText} numberOfLines={2}>
            {suggestion.theme.name} · {suggestion.reason}
          </Text>
        </View>
      ) : null}
      <Pressable
        style={styles.roomCta}
        onPress={() => router.push({ pathname: '/room/intro', params: { collectionId } })}
      >
        {suggestion ? (
          // Two Text nodes, not one interpolated string: the theme name is the
          // part that varies in length (e.g. "Futuristic Weapon Vault"), so it
          // is the only part allowed to shrink and truncate. "room" stays whole
          // — truncating the composed string could just as easily eat the
          // suffix and leave the pill reading "Create Futuristic Weapon Vau…",
          // which looks broken rather than merely abbreviated.
          <>
            <Text style={styles.roomCtaName} numberOfLines={1} ellipsizeMode="tail">
              Create {suggestion.theme.name}
            </Text>
            <Text style={styles.roomCtaText}>room</Text>
          </>
        ) : (
          <Text style={styles.roomCtaText}>+  Create room</Text>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  muted: { ...typography.meta, color: colors.textSecondary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  gridItem: { width: '48%', gap: spacing.xs },
  visibility: { ...typography.meta, color: colors.textTertiary, paddingLeft: spacing.xs },
  // Per the frame: a full-width accent-outlined pill inside the card, label
  // centred with its glyph. Same shape whichever state it is in, so a row of
  // cards reads as one control repeated rather than three different buttons.
  roomCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    // Horizontal padding was missing, so long labels (a theme name like
    // "Futuristic Weapon Vault") touched or crossed the pill's rounded edge
    // instead of sitting inside it.
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    // Fixes the pill's height regardless of which branch renders — a truncated
    // single line must not make this CTA read as shorter than "View room →" or
    // "Room in progress" beside it in the grid.
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  /** In-progress is a status, not an action — muted so it reads as one. */
  roomCtaMuted: { borderColor: colors.border, backgroundColor: 'transparent' },
  roomCtaText: { ...typography.cardTitle, color: colors.accent },
  /**
   * The variable-length half of the suggested-room label ("Create {theme
   * name}"). `flexShrink: 1` lets it give up width to its fixed-width "room"
   * sibling instead of overflowing the row; `minWidth: 0` is required for that
   * shrink to actually take effect inside a flex row on both native and web —
   * without it a Text child defaults to its content width and never shrinks.
   */
  roomCtaName: { ...typography.cardTitle, color: colors.accent, flexShrink: 1, minWidth: 0 },
  roomCtaPending: { ...typography.cardTitle, color: colors.textSecondary },

  /** The suggested-room line above the CTA. */
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs },
  suggestSpark: { ...typography.meta, color: colors.accent },
  suggestText: { ...typography.meta, color: colors.textSecondary, flex: 1, minWidth: 0 },

  progressList: { gap: spacing.sm },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  progressText: { flex: 1, gap: 2 },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },
  track: { width: 72, height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.accent },
  percent: { ...typography.meta, color: colors.textSecondary, width: 34, textAlign: 'right' },
});
