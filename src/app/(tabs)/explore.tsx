/**
 * Explore — the J4 Discover flow entry (PRD §10, §11 F5). Flow owner: Marcus.
 *
 * Two surfaces behind one chip row: collectors ranked by item overlap, and
 * communities. §11 F5 is explicit that the *reason* ships with the score —
 * "always display the human-readable reason; the explanation is what makes a
 * recommendation feel earned". A percentage on its own is a broken feature,
 * so `reason` is rendered on every card here, not behind a tap.
 */

import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import {
  ASSISTANT_CLEARANCE,
  Avatar,
  CollectorCard,
  CommunityCard,
  EmptyState,
  FilterChips,
  LoadingState,
  SectionHeader,
  useHoverLift,
  PinnedHeader,
} from '@/components';
import { FEATURES } from '@/config/features';
import { VIEWER_UNVERIFIED_REASON } from '@/domain/matching';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { matchService, socialService } from '@/services';
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
function MatchBadge({ percent }: { percent: number }) {
  const tone =
    percent >= 65 ? colors.success : percent >= 40 ? colors.warning : colors.textTertiary;
  return (
    <View style={[styles.matchBadge, { borderColor: tone }]}>
      <Text style={[styles.matchValue, { color: tone }]}>{percent}%</Text>
      <Text style={styles.matchLabel}>match</Text>
    </View>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const titleAnchor = useTourAnchor('explore-title');
  const chipsAnchor = useTourAnchor('explore-chips');
  const { viewerId } = useApp();

  const scrollRef = useTopOnFocus();

  const [tab, setTab] = useState<Tab>('Collectors');
  const [collectors, setCollectors] = useState<CollectorRecommendation[]>([]);
  const [communities, setCommunities] = useState<CommunityRecommendation[]>([]);
  const [mine, setMine] = useState<Community[]>([]);
  const [joined, setJoined] = useState<ReadonlySet<string>>(new Set());
  const [matchState, setMatchState] = useState<ViewerMatchState>('ready');
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const [people, groups, all, state] = await Promise.all([
      matchService.getRecommendedCollectors(viewerId, 12),
      matchService.getRecommendedCommunities(viewerId),
      matchService.getCommunities(),
      matchService.getViewerMatchState(viewerId),
    ]);
    setCollectors(people);
    setMatchState(state);
    setCommunities(groups);
    // Recommendations exclude communities the viewer is already in, so without
    // this list a community would vanish the moment it was joined and its
    // detail page would be unreachable from Discover.
    setMine(all.filter((community) => socialService.isMember(viewerId, community.id)));
    setJoined(
      new Set(
        groups
          .filter((g) => socialService.isMember(viewerId, g.community.id))
          .map((g) => g.community.id),
      ),
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
      <PinnedHeader>
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
          {collectors.map((entry) => (
            <Pressable
              key={entry.user.id}
              onPress={() =>
                router.push({ pathname: '/collector/[id]', params: { id: entry.user.id } })
              }
              style={styles.row}
            >
              <Avatar
                name={entry.user.displayName}
                avatarId={entry.user.avatar}
                verified={entry.user.isAccountVerified}
                size={44}
              />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {entry.user.displayName}
                </Text>
                {/* §11 F5 — the reason is the feature, not decoration. */}
                <Text style={styles.reason}>{entry.reason}</Text>
                <Text style={styles.muted}>@{entry.user.handle}</Text>
              </View>

              {/* A sibling of the avatar and body rather than a line inside the
                  body, so the row's `alignItems: center` centres it against the
                  whole card instead of pinning it to the first line of text. */}
              <MatchBadge percent={entry.percent} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {!busy && tab === 'Communities' && mine.length > 0 ? (
        <View style={styles.list}>
          <SectionHeader title="Your Communities" />
          {/* Two across, like the collection grid — communities and collections
              are both browsable tiles and should not be two tiers of content. */}
          <View style={styles.communityGrid}>
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
          </View>
        </View>
      ) : null}

      {!busy && tab === 'Communities' ? (
        <View style={styles.list}>
          <SectionHeader title="Communities for You" />
          <View style={styles.communityGrid}>
          {communities.map(({ community, reason }) => {
            const isMember = joined.has(community.id);
            return (
              <View key={community.id} style={styles.communityCell}>
                <CommunityCard
                  community={community}
                  /* Live count — a session join has to move the number it sits
                     next to. */
                  memberCount={socialService.memberCountFor(community)}
                  reason={
                    FEATURES.communityPosting ? reason : `${reason} · view only`
                  }
                  width="100%"
                  onPress={() =>
                    router.push({ pathname: '/community/[id]', params: { id: community.id } })
                  }
                  action={
                    <Pressable
                      onPress={() => void toggleJoin(community.id)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isMember ? `Leave ${community.name}` : `Join ${community.name}`
                      }
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
          })}
          </View>
          {communities.length === 0 ? (
            <Text style={styles.muted}>
              You&apos;re in every community we&apos;d suggest. Import more items and new ones
              surface here.
            </Text>
          ) : null}
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
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary, flexShrink: 1 },
  matchBadge: {
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: colors.surfaceSunken,
  },
  matchValue: { ...typography.cardTitle, fontSize: 16, lineHeight: 20 },
  matchLabel: { ...typography.meta, fontSize: 10, lineHeight: 13, color: colors.textTertiary },
  reason: { ...typography.meta, color: colors.textSecondary },
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
