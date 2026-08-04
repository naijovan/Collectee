/**
 * Community detail — J4 (PRD §10, §11 F5). Flow owner: Marcus.
 *
 * The Discover flow ends at "Communities → Join" in §10, and until now Join was
 * the whole feature: Explore had a button and there was nowhere to land. This is
 * the view half.
 *
 * §14 rung 3 is the descope contract for this screen: **join/view only, no
 * posting**. Everything here is the join/view half, so cutting posting later is
 * flipping `FEATURES.communityPosting` rather than unpicking this file. The
 * posting surface itself is deliberately not stubbed in the UI — a "coming
 * soon" panel in a four-minute demo is worse than an honest absence.
 *
 * Membership state is read from the service, never from `Community.memberIds`:
 * that array is the seeded roster, and a user who joins during the session is
 * not in it (§12.1 — writes live in the service layer for the session).
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { Avatar, LoadingState, PrimaryButton, SecondaryButton, SectionHeader } from '@/components';
import { socialService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Community, CommunityNotificationPref, User } from '@/types';

/** §12.3 `CommunityMembership.notificationPref`. */
const NOTIFICATION_PREFS: readonly CommunityNotificationPref[] = ['all', 'highlights', 'none'];

const PREF_LABELS: Record<CommunityNotificationPref, string> = {
  all: 'All posts',
  highlights: 'Highlights',
  none: 'Nothing',
};

export default function CommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { viewerId } = useApp();

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [pref, setPref] = useState<CommunityNotificationPref>('all');
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const found = await socialService.getCommunity(id);
    if (!found) {
      setBusy(false);
      return;
    }
    const roster = await socialService.getCommunityMembers(found.id);

    setCommunity(found);
    setMembers(roster);
    setMemberCount(socialService.memberCountFor(found));
    setIsMember(socialService.isMember(viewerId, found.id));
    setPref(socialService.membershipPrefFor(viewerId, found.id));
    setBusy(false);
  }, [id, viewerId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function toggleJoin() {
    if (!community) return;
    const joined = await socialService.toggleMembership(viewerId, community.id);
    setIsMember(joined);
    // Re-read rather than adjusting local state: the count and the roster are
    // both derived from the live membership map, and deriving them twice is how
    // the two drift apart.
    setMembers(await socialService.getCommunityMembers(community.id));
    setMemberCount(socialService.memberCountFor(community));
  }

  async function choosePref(next: CommunityNotificationPref) {
    if (!community) return;
    setPref(await socialService.setMembershipPref(viewerId, community.id, next));
  }

  if (busy) {
    return (
      <View style={[styles.screen, styles.content]}>
        <LoadingState height={220} />
      </View>
    );
  }

  if (!community) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.title}>Community not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.identity}>
        <Avatar name={community.name} size={72} />
        <Text style={styles.title}>{community.name}</Text>
        <Text style={styles.body}>{community.description}</Text>
        <Text style={styles.muted}>{memberCount.toLocaleString()} members</Text>
      </View>

      <View style={styles.tagRow}>
        {community.tags.map((tag) => (
          <View key={tag} style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ))}
      </View>

      {isMember ? (
        <SecondaryButton label="Joined — leave community" onPress={() => void toggleJoin()} />
      ) : (
        <PrimaryButton label="Join community" onPress={() => void toggleJoin()} />
      )}

      {isMember ? (
        <View style={styles.prefBlock}>
          <Text style={styles.label}>Notify me about</Text>
          <View style={styles.prefRow}>
            {NOTIFICATION_PREFS.map((option) => {
              const active = option === pref;
              return (
                <Pressable
                  key={option}
                  onPress={() => void choosePref(option)}
                  style={[styles.pref, active && styles.prefActive]}
                >
                  <Text style={[styles.prefText, active && styles.prefTextActive]}>
                    {PREF_LABELS[option]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <SectionHeader title="Collectors here" />
      {members.length === 0 ? (
        <Text style={styles.muted}>No members yet.</Text>
      ) : (
        <View style={styles.list}>
          {members.map((member) => (
            <Pressable
              key={member.id}
              onPress={() =>
                router.push({ pathname: '/collector/[id]', params: { id: member.id } })
              }
              style={styles.row}
            >
              <Avatar name={member.displayName} verified={member.isAccountVerified} size={40} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {member.displayName}
                  {member.id === viewerId ? ' · you' : ''}
                </Text>
                <Text style={styles.muted}>@{member.handle}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/*
        Posting (§11 F5, behind FEATURES.communityPosting) is a separate unit of
        work. Nothing is rendered for it here on purpose — see §14 rung 3.
      */}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },

  identity: { alignItems: 'center', gap: spacing.xs },
  title: { ...typography.screenTitle, color: colors.textPrimary, marginTop: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  muted: { ...typography.meta, color: colors.textSecondary },
  label: { ...typography.cardTitle, color: colors.textPrimary },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  tag: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  tagText: { ...typography.meta, fontSize: 10, color: colors.accent, letterSpacing: 0.5 },

  prefBlock: { gap: spacing.sm },
  prefRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  pref: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  prefActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  prefText: { ...typography.meta, color: colors.textSecondary },
  prefTextActive: { color: colors.textOnAccent },

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
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },
  chevron: { fontSize: 22, color: colors.textTertiary },
});
