/**
 * Explore — the J4 Discover flow entry (PRD §10, §11 F5). Flow owner: Marcus.
 *
 * Two surfaces behind one chip row: collectors ranked by item overlap, and
 * communities. §11 F5 is explicit that the *reason* ships with the score —
 * "always display the human-readable reason; the explanation is what makes a
 * recommendation feel earned". A percentage on its own is a broken feature,
 * so `reason` is rendered on every card here, not behind a tap.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, CollectorCard, FilterChips, LoadingState, SectionHeader } from '@/components';
import { FEATURES } from '@/config/features';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { matchService, socialService } from '@/services';
import type { CollectorRecommendation, CommunityRecommendation } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';

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
  const [joined, setJoined] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [people, groups] = await Promise.all([
        matchService.getRecommendedCollectors(viewerId, 12),
        matchService.getRecommendedCommunities(viewerId),
      ]);
      if (cancelled) return;
      setCollectors(people);
      setCommunities(groups);
      setJoined(
        new Set(groups.filter((g) => socialService.isMember(viewerId, g.community.id)).map((g) => g.community.id)),
      );
      setBusy(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [viewerId]);

  async function toggleJoin(communityId: string) {
    const isMember = await socialService.toggleMembership(viewerId, communityId);
    setJoined((prev) => {
      const next = new Set(prev);
      if (isMember) next.add(communityId);
      else next.delete(communityId);
      return next;
    });
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      <Text style={styles.title}>Discover</Text>
      <FilterChips options={TABS} value={tab} onChange={setTab} />

      {busy ? <LoadingState height={200} /> : null}

      {!busy && tab === 'Collectors' ? (
        <View style={styles.list}>
          <SectionHeader title="Collectors you may like" />
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

      {!busy && tab === 'Communities' ? (
        <View style={styles.list}>
          <SectionHeader title="Communities for you" />
          {communities.map(({ community, reason }) => {
            const isMember = joined.has(community.id);
            return (
              <View key={community.id} style={styles.row}>
                <Avatar name={community.name} size={44} />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {community.name}
                  </Text>
                  <Text style={styles.reason}>{reason}</Text>
                  <Text style={styles.muted}>
                    {community.memberCount.toLocaleString()} members
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
              </View>
            );
          })}
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
