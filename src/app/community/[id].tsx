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
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import {
  Avatar,
  EmptyState,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
  timeAgo,
} from '@/components';
import { socialService, threadService } from '@/services';
import type { ThreadSummary } from '@/services';
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
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [postError, setPostError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const found = await socialService.getCommunity(id);
    if (!found) {
      setBusy(false);
      return;
    }
    const [roster, discussions] = await Promise.all([
      socialService.getCommunityMembers(found.id),
      threadService.getThreads(found.id),
    ]);

    setCommunity(found);
    setMembers(roster);
    setThreads(discussions);
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

  async function startThread() {
    if (!community) return;
    // Validate through the service so the message the user reads is the one the
    // domain actually produced — a second copy of the rules here would drift.
    const validation = threadService.validate({ title, body });
    if (!validation.valid) {
      setPostError(validation.errors.join(' '));
      return;
    }
    try {
      const created = await threadService.createThread({
        communityId: community.id,
        userId: viewerId,
        title,
        body,
      });
      setTitle('');
      setBody('');
      setComposing(false);
      setPostError(null);
      router.push({ pathname: '/thread/[id]', params: { id: created.id } });
    } catch (error) {
      setPostError((error as Error).message);
    }
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

  // Asked once, from the service, so the screen cannot disagree with the rule
  // it is enforcing (§14 rung 3).
  const postingGate = threadService.canPostIn(viewerId, community.id);

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

      {/*
        Threads — the social half of a community (§11 F5). Reading is never
        gated; posting is, and the gate's own sentence is what gets shown.
      */}
      <SectionHeader title="Discussions" />

      {postingGate.allowed ? (
        composing ? (
          <View style={styles.composer}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What do you want to talk about?"
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
            />
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Add some detail (optional)"
              placeholderTextColor={colors.textTertiary}
              multiline
              style={[styles.input, styles.inputMultiline]}
            />
            {postError ? <Text style={styles.error}>{postError}</Text> : null}
            <PrimaryButton label="Start thread" onPress={() => void startThread()} />
            <SecondaryButton
              label="Cancel"
              onPress={() => {
                setComposing(false);
                setPostError(null);
              }}
            />
          </View>
        ) : (
          <SecondaryButton label="+  Start a thread" onPress={() => setComposing(true)} />
        )
      ) : (
        <Text style={styles.footnote}>{postingGate.reason}</Text>
      )}

      {threads.length === 0 ? (
        <EmptyState
          title="No discussions yet"
          body={
            postingGate.allowed
              ? 'Start the first one — ask something, or show what you just pulled.'
              : 'Nobody has started a thread here yet.'
          }
        />
      ) : (
        <View style={styles.list}>
          {threads.map(({ thread, author, replyCount, lastActivityAt }) => (
            <Pressable
              key={thread.id}
              onPress={() => router.push({ pathname: '/thread/[id]', params: { id: thread.id } })}
              style={[styles.row, thread.pinned && styles.rowPinned]}
            >
              <View style={styles.rowBody}>
                {thread.pinned ? <Text style={styles.pinned}>PINNED</Text> : null}
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {thread.title}
                </Text>
                <Text style={styles.muted}>
                  {author?.displayName ?? 'Unknown'} · {replyCount}{' '}
                  {replyCount === 1 ? 'reply' : 'replies'} · {timeAgo(lastActivityAt)}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>
      )}

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
  rowPinned: { borderColor: colors.accent },
  pinned: { ...typography.meta, fontSize: 10, color: colors.accent, letterSpacing: 0.5 },
  footnote: { ...typography.meta, color: colors.textTertiary },
  error: { ...typography.meta, color: colors.danger },

  composer: { gap: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
});
