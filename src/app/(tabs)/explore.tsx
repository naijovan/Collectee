/**
 * Explore — the J4 Discover flow entry (PRD §10, §11 F5). Flow owner: Marcus.
 *
 * Two surfaces behind one chip row: collectors ranked by item overlap, and
 * communities. §11 F5 is explicit that the *reason* ships with the score —
 * "always display the human-readable reason; the explanation is what makes a
 * recommendation feel earned". A percentage on its own is a broken feature,
 * so `reason` is rendered on every card here, not behind a tap.
 */

import { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import {
  ASSISTANT_CLEARANCE,
  CollectorCard,
  CommunityCard,
  EmptyState,
  FilterChips,
  LoadingState,
  SectionHeader,
  useHoverLift,
  PinnedHeader,
} from '@/components';
import { useScrolledPast } from '@/components/PinnedHeader';
import { FEATURES } from '@/config/features';
import { VIEWER_UNVERIFIED_REASON, rankCommunities } from '@/domain/matching';
import type { RankedCommunity } from '@/domain/matching';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { matchService, newsService, socialService } from '@/services';
import type {
  CollectorRecommendation,
  CommunityRecommendation,
  ViewerMatchState,
} from '@/services';
import { useApp } from '@/state/AppContext';
import { useTourAnchor } from '@/state/TourAnchors';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Community } from '@/types';

const TABS = ['Collectors', 'Communities'] as const;
type Tab = (typeof TABS)[number];

/**
 * A header control: circular glyph plus its label, lifting on hover like every
 * other clickable surface. Local to this screen because these two are the only
 * header actions in the app that are not "create something".
 */
function HeaderAction({
  glyph,
  label,
  onPress,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
}) {
  const hover = useHoverLift();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      {...hover.hoverProps}
      style={({ pressed }) => [
        styles.headerAction,
        hover.hoverStyle,
        hover.hoverBorder,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={styles.headerActionDisc}>
        <Text style={styles.headerActionGlyph}>{glyph}</Text>
      </View>
      <Text style={styles.headerLink}>{label}</Text>
    </Pressable>
  );
}

/**
 * The match score.
 *
 * Tiered rather than one flat colour: a percentage is a judgement, and 70%
 * and 20% mean different things to act on. Green for a strong match, amber
 * for a middling one, grey below — the ladder people already read on health
 * bars and compatibility scores, so nothing has to be explained.
 *
 * ⚠️ Thresholds are calibrated to the real distribution, not to round numbers.
 * Matching uses an overlap coefficient over co-owned items weighted by inverse
 * popularity (§11 F5), and the seeded spread runs 70 down to 20 — so an 80/60
 * ladder painted one row amber and four identical grey, which is worse than no
 * tiering at all. 65/40 separates the list the way a reader would.
 *
 * Deliberately not `accent`. Blue is this app's "tappable" colour, and a
 * number wearing it looked like a button that did nothing.
 */
/**
 * Narrowest a collector card may get before the grid drops a column.
 *
 * 200 is set by the content, not by taste: the card centres an 84px avatar over
 * a display name, and below this the longer handles in the seeded roster start
 * ellipsing on the first row rather than the last.
 */
const COLLECTOR_MIN_WIDTH = 200;

/** Matches `communityCell`'s `minWidth`. */
const COMMUNITY_MIN_WIDTH = 220;

/**
 * Invisible cells to finish a wrapped grid's last row.
 *
 * `flexGrow` on the cells is what pulls the cards out to a flush right edge —
 * without it the grid leaves a ragged gap down the right of the page. The cost
 * is that a short final row stretches to fill the width, so a lone card ends up
 * twice the size of the ones above it. Padding the row with empty cells keeps
 * every card the same width and left-aligned.
 *
 * The column count is MEASURED rather than derived from the window: these grids
 * sit inside the page's padding, so window width over-counts columns on a wide
 * monitor and would pad the wrong number of cells.
 */
function useGridFillers(count: number, minWidth: number) {
  const [columns, setColumns] = useState(1);

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const next = Math.max(1, Math.floor(event.nativeEvent.layout.width / minWidth));
      setColumns((current) => (current === next ? current : next));
    },
    [minWidth],
  );

  /* None at one column, where there is no slack to absorb. */
  const fillers = useMemo(() => {
    const remainder = count % columns;
    const missing = remainder === 0 || columns === 1 ? 0 : columns - remainder;
    return Array.from({ length: missing }, (_, index) => `filler-${index}`);
  }, [count, columns]);

  return { onLayout, fillers };
}

export default function ExploreScreen() {
  const router = useRouter();
  const titleAnchor = useTourAnchor('explore-title');
  const chipsAnchor = useTourAnchor('explore-chips');
  const { viewerId } = useApp();

  const scrollRef = useTopOnFocus();
  /* Drives the header's frosted backdrop, which is transparent at the top
     of the page and fades in once it starts doing a job. */
  const { scrolled, scrollProps } = useScrolledPast();

  /**
   * Which tab to open on, addressable by route param — `/explore?tab=Communities`.
   *
   * Mirrors `/connections?tab=following`, the pattern already in the app. It
   * exists because Home needs to send someone straight to Communities, and
   * without it every caller lands on Collectors no matter what it meant.
   *
   * VALIDATED against `TABS` rather than cast. An unrecognised value falls back
   * to 'Collectors' — a typo'd or stale link must not render a tab that matches
   * nothing and shows an empty screen. Absent behaves exactly as before.
   *
   * Initial state only, deliberately: once the screen is open the chips own the
   * selection, so arriving by link and then tapping a chip behaves like any
   * other visit rather than snapping back to the param.
   */
  const { tab: requestedTab } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(() =>
    TABS.includes(requestedTab as Tab) ? (requestedTab as Tab) : 'Collectors',
  );
  const [collectors, setCollectors] = useState<CollectorRecommendation[]>([]);
  const [mine, setMine] = useState<Community[]>([]);
  /** Browse-all, grouped — see `rankCommunities`. Joined are excluded there. */
  const [ranked, setRanked] = useState<RankedCommunity[]>([]);
  const [joined, setJoined] = useState<ReadonlySet<string>>(new Set());
  const [matchState, setMatchState] = useState<ViewerMatchState>('ready');
  const [busy, setBusy] = useState(true);

  const collectorGrid = useGridFillers(collectors.length, COLLECTOR_MIN_WIDTH);
  const mineGrid = useGridFillers(mine.length, COMMUNITY_MIN_WIDTH);

  const forYou = useMemo(() => ranked.filter((r) => r.group === 'forYou'), [ranked]);
  const trendingGroup = useMemo(() => ranked.filter((r) => r.group === 'trending'), [ranked]);

  /**
   * One community card, used by both groups.
   *
   * Extracted so the two headings render identical cards — the previous single
   * list and a copy-paste of it would have drifted the moment either changed.
   * Same `CommunityCard`, same live member count, same join control as before.
   */
  function renderCommunity({ community, reason }: RankedCommunity) {
    const isMember = joined.has(community.id);
    return (
      <View key={community.id} style={styles.communityCell}>
        <CommunityCard
          community={community}
          /* Live count — a session join has to move the number beside it. */
          memberCount={socialService.memberCountFor(community)}
          reason={FEATURES.communityPosting ? reason : `${reason} · view only`}
          width="100%"
          onPress={() =>
            router.push({ pathname: '/community/[id]', params: { id: community.id } })
          }
          action={
            <Pressable
              onPress={() => void toggleJoin(community.id)}
              accessibilityRole="button"
              accessibilityLabel={isMember ? `Leave ${community.name}` : `Join ${community.name}`}
              style={[styles.join, isMember && styles.joinActive]}
            >
              <Text style={[styles.joinText, isMember && styles.joinTextActive]}>
                {isMember ? 'Joined' : 'Join'}
              </Text>
            </Pressable>
          }
        />
      </View>
    );
  }

  const load = useCallback(async () => {
    const [people, all, state] = await Promise.all([
      matchService.getRecommendedCollectors(viewerId, 12),
      matchService.getCommunities(),
      matchService.getViewerMatchState(viewerId),
    ]);
    setCollectors(people);
    setMatchState(state);
    /* The browse-all grouping. `rankCommunities` is the same pure function
       Home's rail uses, over the same inputs, so the two surfaces cannot
       disagree about what is "for you" or what order things come in. */
    setRanked(
      rankCommunities(all, {
        followedGames: newsService.followedGamesFor(viewerId),
        isMember: (id) => socialService.isMember(viewerId, id),
      }),
    );
    // Recommendations exclude communities the viewer is already in, so without
    // this list a community would vanish the moment it was joined and its
    // detail page would be unreachable from Discover.
    setMine(all.filter((community) => socialService.isMember(viewerId, community.id)));
    /* Over ALL communities, not just the recommender's output. The join
       control sits on browse-all cards and `rankCommunities` drops joined ones,
       so a set built from the recommender would go stale the moment someone
       joined from this screen. */
    setJoined(
      new Set(all.filter((c) => socialService.isMember(viewerId, c.id)).map((c) => c.id)),
    );
    setBusy(false);
  }, [viewerId]);

  /**
   * Refetch on focus, not only on mount.
   *
   * Match scores are computed from the viewer's owned items (§11 F5), so an
   * import changes every number on this screen. Discover is a tab and stays
   * mounted while the user runs the import flow — a mount-only effect would
   * leave the demo looking at pre-import recommendations for the rest of the
   * session. `busy` is deliberately not reset here, so a refocus updates in
   * place instead of flashing a skeleton over data that is already on screen.
   */
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function toggleJoin(communityId: string) {
    await socialService.toggleMembership(viewerId, communityId);
    // Reload rather than patching local state: membership drives the
    // recommendation filter, the joined list and the member counts, and
    // updating three derived things by hand is how they drift apart.
    await load();
  }

  const { refreshing, onRefresh } = usePullToRefresh(load);

  return (
    <View style={styles.screen}>
      {/* Same pinned header as Home and Collections — they are sibling tabs and
          a header that moves or changes between them reads as three apps. */}
      <PinnedHeader scrolled={scrolled}>
        <View ref={titleAnchor} collapsable={false} style={styles.headerRow}>
          <Text style={styles.title}>Discover</Text>
          {/*
            Utility entries for the two surfaces that otherwise have no route in:
            the review queue, and account linking — whose only other entry is an
            empty state a viewer with verified items never sees.
          */}
          <View style={styles.headerActions}>
            <HeaderAction glyph="✓" label="Verify" onPress={() => router.push('/link-account')} />
            <HeaderAction glyph="⚑" label="Reports" onPress={() => router.push('/moderation')} />
          </View>
        </View>
        {/* Anchored for the first-run walkthrough, which spotlights the heading
            and these chips together as one region. */}
        <View ref={chipsAnchor} collapsable={false}>
          <FilterChips options={TABS} value={tab} onChange={setTab} />
        </View>
      </PinnedHeader>

      <ScrollView
        ref={scrollRef}
      {...scrollProps}
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
      {busy ? <LoadingState height={200} /> : null}

      {/*
        Two different empty lists, two different explanations. A viewer who has
        verified nothing cannot be matched at all under the 3 Aug rule — saying
        "no matches" there would blame the data for a rule. The other empty case
        genuinely means nobody overlaps yet.
      */}
      {!busy && tab === 'Collectors' && matchState === 'unverified-only' ? (
        <EmptyState
          title="Nothing verified yet"
          body={VIEWER_UNVERIFIED_REASON}
          actionLabel="Connect a game account"
          onAction={() => router.push('/link-account')}
        />
      ) : null}

      {!busy && tab === 'Collectors' && matchState !== 'unverified-only' ? (
        <View style={styles.list}>
          <SectionHeader title="Collectors You May Like" />
          {collectors.length === 0 ? (
            <Text style={styles.muted}>
              No collectors share a verified item with you yet.
            </Text>
          ) : null}
          {/* The same CollectorCard Home shows, in a grid rather than a rail.
              These were full-width rows, which made a person read as a line
              item in a table — and made the identical data look like two
              different features on two screens. */}
          <View style={styles.collectorGrid} onLayout={collectorGrid.onLayout}>
            {collectors.map((entry) => (
              <View key={entry.user.id} style={styles.collectorCell}>
                <CollectorCard
                  user={entry.user}
                  percent={entry.percent}
                  /* §11 F5 — the reason is the feature, not decoration. */
                  reason={entry.reason}
                  width="100%"
                  onPress={() =>
                    router.push({ pathname: '/collector/[id]', params: { id: entry.user.id } })
                  }
                />
              </View>
            ))}
            {/* Invisible cells finishing the last row. `flexGrow` is what pulls
                the cards out to a flush right edge, but it also stretches a
                short final row across the full width — so the leftovers get
                filled with nothing rather than with slack. */}
            {collectorGrid.fillers.map((key) => (
              <View key={key} style={styles.collectorCell} pointerEvents="none" />
            ))}
          </View>
        </View>
      ) : null}

      {!busy && tab === 'Communities' && mine.length > 0 ? (
        <View style={styles.list}>
          <SectionHeader title="Your Communities" />
          {/* Two across, like the collection grid — communities and collections
              are both browsable tiles and should not be two tiers of content. */}
          <View style={styles.communityGrid} onLayout={mineGrid.onLayout}>
            {mine.map((community) => (
              <View key={community.id} style={styles.communityCell}>
                <CommunityCard
                  community={community}
                  memberCount={socialService.memberCountFor(community)}
                  width="100%"
                  onPress={() =>
                    router.push({ pathname: '/community/[id]', params: { id: community.id } })
                  }
                />
              </View>
            ))}
            {mineGrid.fillers.map((key) => (
              <View key={key} style={styles.communityCell} pointerEvents="none" />
            ))}
          </View>
        </View>
      ) : null}

      {/*
        Browse-all, in two headed groups.

        This replaced a single "Communities for You" list. The cards, the join
        control and the grid are unchanged — only the grouping and the order are
        new, and both come from `rankCommunities`, the same pure function Home's
        rail calls with the same inputs. Two surfaces, one ordering.

        "For you" is a followed-game match on the community's tags; "Trending" is
        everything else, by member count. A group with no members renders no
        heading, so a viewer who follows every game gets no empty "Trending"
        label and one who follows none gets no empty "For you".

        Joined communities are absent by construction — `rankCommunities` filters
        them out and they are already listed above under "Your Communities", so
        nothing appears twice on this screen.
      */}
      {!busy && tab === 'Communities' && forYou.length > 0 ? (
        <View style={styles.list}>
          <SectionHeader title="For you" />
          <View style={styles.communityGrid}>{forYou.map(renderCommunity)}</View>
        </View>
      ) : null}

      {!busy && tab === 'Communities' && trendingGroup.length > 0 ? (
        <View style={styles.list}>
          <SectionHeader title="Trending" />
          <View style={styles.communityGrid}>{trendingGroup.map(renderCommunity)}</View>
        </View>
      ) : null}

      {!busy && tab === 'Communities' && ranked.length === 0 ? (
        <View style={styles.list}>
          <Text style={styles.muted}>
            You&apos;re in every community we&apos;d suggest. Import more items and new ones
            surface here.
          </Text>
        </View>
      ) : null}

      {/* The floating assistant sits over this corner. Pad by the real
          number so the last row is never resting underneath it. */}
      <View style={{ height: ASSISTANT_CLEARANCE }} />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, gap: spacing.lg },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', gap: spacing.lg },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: 3,
    paddingRight: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerActionDisc: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  headerActionGlyph: { color: colors.textOnAccent, fontSize: 12, lineHeight: 14, fontWeight: '700' },

  headerLink: { ...typography.meta, color: colors.accent },
  list: { gap: spacing.sm },
  /* Two across, matching the collection grid — communities are browsable tiles
     of the same weight, not a denser list beneath them. */
  communityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  communityCell: { width: '48%', flexGrow: 1, minWidth: 220 },
  /* Four across on a desktop, two on a phone — `COLLECTOR_MIN_WIDTH` decides,
     and the same constant drives the filler count so the two never disagree. */
  collectorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  collectorCell: { flexGrow: 1, flexBasis: '23%', minWidth: COLLECTOR_MIN_WIDTH },
  muted: { ...typography.meta, color: colors.textTertiary },
  chevron: { fontSize: 22, color: colors.textTertiary },
  join: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  joinActive: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  joinText: { ...typography.meta, color: colors.textOnAccent },
  joinTextActive: { color: colors.textSecondary },
});
