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
import type { CollectionSuggestion } from '@/domain/collections';
import type { RoomSuggestion } from '@/domain/roomSuggestion';
import { roomEligibility } from '@/domain/trust';
import type { RoomEligibility } from '@/domain/trust';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { catalogueService, collectionService, inventoryService, roomService, socialService } from '@/services';
import type { RoomStatus } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Collection, Item } from '@/types';

/** §14 rung: "Has room" is the filter that makes J3 discoverable from J2. */
const FILTERS = ['All', 'Public', 'Private', 'Has room'] as const;
type Filter = (typeof FILTERS)[number];

/**
 * A suggested grouping, with the room it would become.
 *
 * Two engines compose here and neither duplicates the other:
 *   `collectionService.suggest`  which of your items belong together, and why
 *   `suggestRoom`                which room style suits that group, and why
 *
 * The gate then decides whether it can be a room at all (§9.4) — a group of
 * unverified items is still a good grouping, it just becomes a 2D collection.
 * Saying that is more useful than filtering it out silently.
 */
interface SuggestedGroup {
  suggestion: CollectionSuggestion;
  themeName: string | null;
  themeReason: string | null;
  eligibility: RoomEligibility;
}

interface Entry {
  collection: Collection;
  headline: Item | null;
  /** The room this collection would get if the user asked for one. */
  suggestion: RoomSuggestion | null;
  /** §9.4 — whether its verified items can fill a room, and why not if they cannot. */
  eligibility: RoomEligibility;
}

export default function CollectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { viewer, viewerId, inventory } = useApp();

  const scrollRef = useTopOnFocus();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [rooms, setRooms] = useState<ReadonlyMap<string, RoomStatus>>(new Map());
  const [filter, setFilter] = useState<Filter>('All');
  const [ideas, setIdeas] = useState<SuggestedGroup[]>([]);

  /** Collections that already have a published room — the rooms section. */
  const builtRooms = entries.filter((entry) => rooms.get(entry.collection.id)?.published);
  const [progress, setProgress] = useState<SetProgress[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const mine = await collectionService.getCollectionsByUser(viewerId, true);
    const themes = await roomService.getThemes();
    const owned = await inventoryService.getOwnedItems(viewerId);
    const withArt = await Promise.all(
      mine.map(async (collection) => {
        const items = await catalogueService.getItems(collection.itemIds);
        return {
          collection,
          headline: headlineItem(items),
          // Scored from the collection's own contents — colour, rarity, title
          // mix and item form. Pure logic, so it costs nothing to do per card.
          suggestion: suggestRoom(items, themes),
          // Gated on THIS collection's verified items, not the whole inventory,
          // or every card would claim eligibility on items it does not hold.
          eligibility: roomEligibility(
            owned.filter((entry) => collection.itemIds.includes(entry.itemId)),
            (id) => socialService.isUnderReview(id),
          ),
        };
      }),
    );
    setEntries(withArt);
    // One pass for every card's room CTA, rather than a fetch per card.
    setRooms(await roomService.statusByCollection());
    setProgress(await collectionService.setProgressFor(owned));

    // Groupings the user has NOT made yet. Anything already collected is
    // dropped — suggesting a set someone built last week is noise.
    const existing = new Set(mine.map((c) => c.itemIds.slice().sort().join('|')));
    const raw = await collectionService.suggest(owned);
    const composed = await Promise.all(
      raw
        .filter((idea) => !existing.has(idea.itemIds.slice().sort().join('|')))
        .map(async (idea) => {
          const items = await catalogueService.getItems(idea.itemIds);
          const room = suggestRoom(items, themes);
          return {
            suggestion: idea,
            themeName: room?.theme.name ?? null,
            themeReason: room?.reason ?? null,
            eligibility: roomEligibility(
              owned.filter((entry) => idea.itemIds.includes(entry.itemId)),
              (id) => socialService.isUnderReview(id),
            ),
          };
        }),
    );
    setIdeas(composed);
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
        <View style={styles.rowBody}>
          <Text style={styles.title}>Collections</Text>
          <Text style={styles.muted}>{inventory.length} items owned</Text>
        </View>
        {/* Create is a persistent affordance, not a banner — it should not push
            the content down every time the page loads. */}
        <Pressable
          accessibilityLabel="Create a collection"
          hitSlop={10}
          onPress={() => router.push('/collection/new')}
          style={styles.createButton}
        >
          <Text style={styles.createGlyph}>+</Text>
        </Pressable>
      </View>

      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      <SectionHeader title="Your Collections" />

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
                  eligibility={entry.eligibility}
                />
              </FadeInView>
            ))}
        </View>
      )}

      {/* "Sets in progress" lived here. Set completion is a real feature (§4, the
          Completionist persona) but it is not this screen's job — Collections is
          the grid, per the frame. It moves to the collection detail page rather
          than being deleted; `setProgressFor` is untouched. */}

      {/* ── Your Collection Rooms ───────────────────────────────────── */}
      <View>
        <SectionHeader title="Your Collection Rooms" />
        {builtRooms.length === 0 ? (
          <Text style={styles.muted}>
            No Collection Rooms yet. A Collection Room is the interactive version of a
            collection — accept a suggestion below, or build one from any collection with 3
            or more verified items.
          </Text>
        ) : (
          <View style={styles.grid}>
            {builtRooms.map((entry) => (
              <Pressable
                key={entry.collection.id}
                style={styles.gridItem}
                onPress={() =>
                  router.push({
                    pathname: '/room/immersive/[id]',
                    params: { id: rooms.get(entry.collection.id)!.room.id },
                  })
                }
              >
                <CollectionCard
                  collection={entry.collection}
                  owner={viewer}
                  headline={entry.headline}
                />
                <Text style={styles.visibility}>Interactive room ›</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* ── Suggestions ─────────────────────────────────────────────── */}
      {ideas.length > 0 ? (
        <View>
          <SectionHeader title="Suggestions" />
          <Text style={styles.muted}>
            Groupings we found in your inventory. Verified ones can become an interactive
            Collection Room in one step; the rest become a 2D collection.
          </Text>
          <View style={styles.ideaList}>
            {ideas.map((idea) => (
              <Pressable
                key={idea.suggestion.name}
                style={styles.ideaCard}
                onPress={() =>
                  idea.eligibility.eligible
                    ? // One step: the collection is created at generate time,
                      // so accepting a suggestion never asks the user to build
                      // a collection first and then decorate it.
                      router.push({
                        pathname: '/room/new',
                        params: {
                          name: idea.suggestion.name,
                          itemIds: idea.suggestion.itemIds.join(','),
                        },
                      })
                    : router.push('/collection/new')
                }
              >
                <View style={styles.ideaHead}>
                  <Text style={styles.ideaSpark}>✦</Text>
                  <Text style={styles.rowTitle}>{idea.suggestion.name}</Text>
                  <Text style={styles.muted}>{idea.suggestion.itemIds.length} items</Text>
                </View>
                <Text style={styles.muted}>{idea.suggestion.reason}</Text>

                {/* §9.4 decides which of the two things this can become, and
                    says so — a suggestion the user cannot act on is worse than
                    no suggestion. */}
                {idea.eligibility.eligible && idea.themeName ? (
                  <Text style={styles.ideaRoom}>
                    ⌂ Create as a {idea.themeName} Collection Room · {idea.themeReason}
                  </Text>
                ) : (
                  <Text style={styles.ideaBlocked}>⚿ 2D collection · {idea.eligibility.reason}</Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

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
  eligibility,
}: {
  status: RoomStatus | undefined;
  collectionId: string;
  /** The room this collection would get, from `domain/roomSuggestion`. */
  suggestion?: RoomSuggestion | null;
  /** §9.4 gate. Absent means "do not gate" — only the published branch skips it. */
  eligibility?: RoomEligibility;
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

  // §9.4 — rooms are verified-only. This must say WHY and what to do about it:
  // "an empty picker with no explanation is the worst version of this rule."
  if (eligibility && !eligibility.eligible) {
    return (
      <>
        <View style={styles.suggestRow}>
          <Text style={styles.lockGlyph}>⚿</Text>
          <Text style={styles.suggestText} numberOfLines={3}>
            {eligibility.reason}
          </Text>
        </View>
        <Pressable
          style={[styles.roomCta, styles.roomCtaMuted]}
          onPress={() => router.push('/link-account')}
        >
          <Text style={styles.roomCtaPending}>Connect a game account</Text>
        </Pressable>
      </>
    );
  }

  // No room yet — lead with what the app would build, not a bare CTA. The
  // suggestion is the feature (§11 F4); the button is how you accept it.
  return (
    <>
      {suggestion ? (
        <View style={styles.suggestRow}>
          <Text style={styles.suggestSpark}>✦</Text>
          <Text style={styles.suggestText} numberOfLines={3}>
            {suggestion.theme.name} · {suggestion.reason}
            {eligibility ? `\n${eligibility.reason}` : ''}
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
          // is the only part allowed to shrink and truncate. The suffix stays
          // whole — truncating the composed string could just as easily eat it
          // and leave the pill reading "Create Futuristic Weapon Vau…", which
          // looks broken rather than merely abbreviated.
          <>
            <Text style={styles.roomCtaName} numberOfLines={1} ellipsizeMode="tail">
              Create {suggestion.theme.name}
            </Text>
            <Text style={styles.roomCtaText}>Collection Room</Text>
          </>
        ) : (
          <Text style={styles.roomCtaText}>+  Create Collection Room</Text>
        )}
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, justifyContent: 'space-between' },
  createButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  createGlyph: { color: colors.textOnAccent, fontSize: 26, lineHeight: 28, fontWeight: '600' },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  muted: { ...typography.meta, color: colors.textSecondary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  gridItem: { width: '48%', gap: spacing.xs },
  visibility: { ...typography.meta, color: colors.textTertiary, paddingLeft: spacing.xs },

  ideaList: { gap: spacing.sm },
  ideaCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  ideaHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  ideaSpark: { ...typography.meta, color: colors.accent },
  ideaRoom: { ...typography.meta, color: colors.accent },
  ideaBlocked: { ...typography.meta, color: colors.textTertiary },
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
  lockGlyph: { ...typography.meta, color: colors.textTertiary },
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
