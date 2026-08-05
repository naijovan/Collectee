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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  CollectorCard,
  EmptyState,
  FilterChips,
  LoadingState,
  SectionHeader,
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
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Community } from '@/types';

const TABS = ['Collectors', 'Communities'] as const;
type Tab = (typeof TABS)[number];

export default function ExploreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      <View style={styles.headerRow}>
        <Text style={styles.title}>Discover</Text>
        {/*
          Utility entries for the two surfaces that otherwise have no route in:
          the review queue, and account linking — whose only other entry is an
          empty state a viewer with verified items never sees.
        */}
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/link-account')} hitSlop={8}>
            <Text style={styles.headerLink}>Verify</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/moderation')} hitSlop={8}>
            <Text style={styles.headerLink}>Reports</Text>
          </Pressable>
        </View>
      </View>
      <FilterChips options={TABS} value={tab} onChange={setTab} />

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
          <SectionHeader title="Collectors you may like" />
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
              <Avatar name={entry.user.displayName} verified={entry.user.isAccountVerified} size={44} />
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {entry.user.displayName}
                  </Text>
                  <Text style={styles.percent}>{entry.percent}%</Text>
                </View>
                {/* §11 F5 — the reason is the feature, not decoration. */}
                <Text style={styles.reason}>{entry.reason}</Text>
                <Text style={styles.muted}>@{entry.user.handle}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!busy && tab === 'Communities' && mine.length > 0 ? (
        <View style={styles.list}>
          <SectionHeader title="Your communities" />
          {mine.map((community) => (
            <Pressable
              key={community.id}
              onPress={() =>
                router.push({ pathname: '/community/[id]', params: { id: community.id } })
              }
              style={styles.row}
            >
              <Avatar name={community.name} size={44} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {community.name}
                </Text>
                <Text style={styles.muted}>
                  {socialService.memberCountFor(community).toLocaleString()} members
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!busy && tab === 'Communities' ? (
        <View style={styles.list}>
          <SectionHeader title="Communities for you" />
          {communities.map(({ community, reason }) => {
            const isMember = joined.has(community.id);
            return (
              <Pressable
                key={community.id}
                onPress={() =>
                  router.push({ pathname: '/community/[id]', params: { id: community.id } })
                }
                style={styles.row}
              >
                <Avatar name={community.name} size={44} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {community.name}
                  </Text>
                  <Text style={styles.reason}>{reason}</Text>
                  <Text style={styles.muted}>
                    {/* Live count — a session join has to move the number it sits next to. */}
                    {socialService.memberCountFor(community).toLocaleString()} members
                    {FEATURES.communityPosting ? '' : ' · view only'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void toggleJoin(community.id)}
                  style={[styles.join, isMember && styles.joinActive]}
                >
                  <Text style={[styles.joinText, isMember && styles.joinTextActive]}>
                    {isMember ? 'Joined' : 'Join'}
                  </Text>
                </Pressable>
              </Pressable>
            );
          })}
          {communities.length === 0 ? (
            <Text style={styles.muted}>
              You&apos;re in every community we&apos;d suggest. Import more items and new ones
              surface here.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', gap: spacing.lg },
  headerLink: { ...typography.meta, color: colors.accent },
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
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary, flexShrink: 1 },
  percent: { ...typography.cardTitle, color: colors.accent },
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
