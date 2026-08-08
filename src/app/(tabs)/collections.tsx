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

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  CollectionCard,
  EmptyState,
  FadeInView,
  FilterChips,
  ItemArt,
  LoadingState,
  PrimaryButton,
  SectionHeader,
  ASSISTANT_CLEARANCE,
  PinnedHeader,
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
const FILTERS = ['All', 'Public', 'Private', 'Showrooms'] as const;
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
  /** Resolved members, so the card can show what is in the grouping. */
  items: Item[];
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
  const { width: viewportWidth } = useWindowDimensions();
  const { viewer, viewerId, inventory } = useApp();

  const scrollRef = useTopOnFocus();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [rooms, setRooms] = useState<ReadonlyMap<string, RoomStatus>>(new Map());
  const [filter, setFilter] = useState<Filter>('All');
  const [ideas, setIdeas] = useState<SuggestedGroup[]>([]);

  /**
   * Split by what accepting the suggestion actually produces.
   *
   * `eligible` is §9.4's verified-item gate, so this is the same fact the card
   * used to carry as a badge — surfaced as two headings instead, because the
   * question "what does this make?" is better answered once per group than
   * once per card.
   */
  const showroomIdeas = useMemo(
    () => ideas.filter((idea) => idea.eligibility.eligible && idea.themeName),
    [ideas],
  );
  const collectionIdeas = useMemo(
    () => ideas.filter((idea) => !(idea.eligibility.eligible && idea.themeName)),
    [ideas],
  );

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
            items,
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

  /** One card, used by both suggestion lists. */
  function renderIdea(idea: SuggestedGroup) {
    const canShowroom = idea.eligibility.eligible && idea.themeName;
    return (
      <View key={idea.suggestion.name} style={styles.ideaCard}>
          {/* Show the items, not just their count. A suggestion asks the
              user to trust a grouping they did not make, and the fastest
              way to earn that is to let them see what is in it. */}
          <View style={styles.ideaPreview}>
            {idea.items.slice(0, 2).map((item) => (
              <ItemArt
                key={item.id}
                seed={item.id}
                tier={item.rarityTier}
                renderUrl={item.renderUrl}
                style={styles.ideaThumb}
              />
            ))}
            {idea.suggestion.itemIds.length > 2 ? (
              <View style={[styles.ideaThumb, styles.ideaMore]}>
                <Text style={styles.ideaMoreText}>
                  +{idea.suggestion.itemIds.length - 2}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.ideaBody}>
            <Text style={styles.ideaName}>{idea.suggestion.name}</Text>
            <Text style={styles.muted}>
              {idea.suggestion.itemIds.length} items · {idea.suggestion.reason}
            </Text>
          </View>

          {/* The outcome is a badge, not a sentence: which of the two
              things this becomes is the single fact that decides whether
              the button is worth tapping. */}
          <View style={styles.ideaFooter}>
            <View style={[styles.ideaTag, canShowroom && styles.ideaTagLive]}>
              <Text style={[styles.ideaTagText, canShowroom && styles.ideaTagTextLive]}>
                {canShowroom ? `⌂ ${idea.themeName}` : '⚿ 2D collection'}
              </Text>
            </View>
            <Pressable
              onPress={() =>
                canShowroom
                  ? router.push({
                      pathname: '/room/new',
                      params: {
                        name: idea.suggestion.name,
                        itemIds: idea.suggestion.itemIds.join(','),
                      },
                    })
                  : router.push('/collection/new')
              }
              style={({ pressed }) => [
                styles.ideaButton,
                canShowroom && styles.ideaButtonPrimary,
                pressed && styles.pressedIdea,
              ]}
            >
              <Text
                style={[
                  styles.ideaButtonText,
                  canShowroom && styles.ideaButtonTextPrimary,
                ]}
              >
                {canShowroom ? 'Create showroom' : 'Create collection'}
              </Text>
            </Pressable>
          </View>

          {!canShowroom ? (
            <Text style={styles.ideaHint}>{idea.eligibility.reason}</Text>
          ) : null}
        </View>
      );
  }

  return (
    <View style={styles.screen}>
      {/* Pinned: the four tab screens keep their title and filters on screen
          while the list moves under them, so the user never loses the context
          for what they are scrolling through. */}
      <PinnedHeader>
        <View style={styles.header}>
          <View style={styles.rowBody}>
            <Text style={styles.title}>Collections</Text>
            <Text style={styles.muted}>{inventory.length} items owned</Text>
          </View>
        </View>
        <FilterChips options={FILTERS} value={filter} onChange={setFilter} />
      </PinnedHeader>

    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
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

      <SectionHeader
        title="Your Collections"
        prominent
        actionLabel="Add Collection"
        actionIcon="+"
        onSeeAll={() => router.push('/collection/new')}
      />

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
              <FadeInView
                key={entry.collection.id}
                index={index}
                style={[styles.gridItem, viewportWidth < 600 && styles.gridItemPhone]}
              >
                <CollectionCard
                  collection={entry.collection}
                  owner={viewer}
                  headline={entry.headline}
                  showVisibility
                  onPress={() =>
                    router.push({
                      pathname: '/collection/[id]',
                      params: { id: entry.collection.id },
                    })
                  }
                />
              </FadeInView>
            ))}
        </View>
      )}

      {/* "Sets in progress" lived here. Set completion is a real feature (§4, the
          Completionist persona) but it is not this screen's job — Collections is
          the grid, per the frame. It moves to the collection detail page rather
          than being deleted; `setProgressFor` is untouched. */}

      {/* ── Your Showrooms ───────────────────────────────────── */}
      <View>
        <SectionHeader
          title="Your Showrooms"
          prominent
          actionLabel="Add Showroom"
          actionIcon="+"
          onSeeAll={() => router.push('/room/new')}
        />
        {builtRooms.length === 0 ? (
          <Text style={styles.muted}>
            No Showrooms yet. A Showroom is the interactive version of a
            collection — accept a suggestion below, or build one from any collection with 3
            or more verified items.
          </Text>
        ) : (
          <View style={styles.grid}>
            {builtRooms.map((entry) => (
              <Pressable
                key={entry.collection.id}
                style={[styles.gridItem, viewportWidth < 600 && styles.gridItemPhone]}
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
                  showVisibility
                />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* ── Suggestions ─────────────────────────────────────────────── */}
      {ideas.length > 0 ? (
        <View style={styles.suggestionsSection}>
          <View style={styles.suggestionIntro}>
            <SectionHeader title="Suggestions" prominent />
            <Text style={styles.muted}>Groupings we found in your inventory.</Text>
          </View>

          {/* Split by outcome rather than mixed with a badge each. The two
              headings answer the question the badge was answering one card at a
              time — what does accepting this actually make? — and the showroom
              half goes first because it is the one gated on verification and so
              the one worth acting on while the items are fresh. */}
          {showroomIdeas.length > 0 ? (
            <View style={styles.ideaGroup}>
              <View style={styles.ideaGroupHeader}>
                <SectionHeader title="Ready for a Showroom" />
                <Text style={styles.muted}>
                  Enough verified items to build an interactive room in one step.
                </Text>
              </View>
              <View style={styles.ideaList}>
                {showroomIdeas.map((idea) => renderIdea(idea))}
              </View>
            </View>
          ) : null}

          {collectionIdeas.length > 0 ? (
            <View style={styles.ideaGroup}>
              <View style={styles.ideaGroupHeader}>
                <SectionHeader title="Ready for a collection" />
                <Text style={styles.muted}>
                  Good groupings, but short on verified items — these list in 2D until you
                  connect a game account.
                </Text>
              </View>
              <View style={styles.ideaList}>
                {collectionIdeas.map((idea) => renderIdea(idea))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={{ height: ASSISTANT_CLEARANCE }} />
    </ScrollView>
    </View>
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
    case 'Showrooms':
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
            <Text style={styles.roomCtaText}>Showroom</Text>
          </>
        ) : (
          <Text style={styles.roomCtaText}>+  Create Showroom</Text>
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

  /**
   * Column and row gaps are set separately.
   *
   * One `gap` gave both the same 12, but the vertical direction was not
   * spending 12 — each cell also carries the visibility label BELOW the card,
   * so the real distance between two rows of art was the label's line height
   * plus its own gap plus the row gap. Rows drifted noticeably further apart
   * than columns and the grid stopped reading as a grid.
   *
   * Columns keep 12; rows drop to 8 and the label tightens against its card, so
   * the label reads as part of the cell above it rather than as a floating line
   * between two rows.
   */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.sm,
    justifyContent: 'space-between',
  },
  gridItem: { width: '48%', gap: 2 },
  gridItemPhone: { width: '100%' },

  suggestionsSection: { gap: spacing.xl },
  suggestionIntro: { gap: spacing.sm },
  ideaGroup: { gap: spacing.md },
  ideaGroupHeader: { gap: spacing.xs },
  ideaList: { gap: spacing.md },
  ideaPreview: {
    flexDirection: 'row',
    gap: spacing.xs,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
  },
  // A real 3:2 frame keeps the complete item visible. The previous fixed 128px
  // height stretched these beyond 2:1 on desktop and cropped handles/barrels.
  ideaThumb: { flex: 1, aspectRatio: 3 / 2, borderRadius: radius.sm },
  ideaMore: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSunken },
  ideaMoreText: { ...typography.cardTitle, color: colors.textSecondary },
  ideaBody: { gap: spacing.xs },
  ideaName: { ...typography.cardTitle, color: colors.textPrimary },
  ideaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ideaTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
  },
  ideaTagLive: { backgroundColor: colors.accentMuted },
  ideaTagText: { ...typography.meta, color: colors.textTertiary },
  ideaTagTextLive: { color: colors.accent },
  /**
   * One filled accent button for both outcomes.
   *
   * The collection variant used to be a grey outline, which read as the
   * secondary of a pair — as though creating a collection were the consolation
   * for failing the verified check. It is not: a 2D collection is a first-class
   * thing, and the two are now separated by heading rather than by weight.
   */
  ideaButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  ideaButtonPrimary: {},
  ideaButtonText: { ...typography.meta, color: colors.textOnAccent, fontWeight: '600' },
  ideaButtonTextPrimary: {},
  pressedIdea: { opacity: 0.75 },
  ideaHint: { ...typography.meta, color: colors.textTertiary },
  ideaCard: {
    gap: spacing.md,
    padding: spacing.lg,
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
