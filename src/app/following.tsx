/**
 * Following management — PRD §11 F6. Flow owner: Marcus (J5).
 *
 * "Following management, notifications, saved articles." Saved shipped with the
 * foundation, notifications shipped alongside this, and this is the third: what
 * the FYP is built from, made editable.
 *
 * Every toggle here changes the next FYP read (`newsService.getFyp` reads the
 * same overlays), so the screen is not a preferences panel that quietly does
 * nothing — which is what it would be if the feed kept reading the seed.
 *
 * ⚠️ One behaviour worth knowing before demoing this: unfollowing a game you
 * OWN ITEMS IN demotes its articles rather than hiding them, because ownership
 * is a separate and stronger signal in `domain/news` (§11 F6 ranks owned items
 * above followed games on purpose). Articles disappear entirely only for a game
 * you own nothing in. The copy below says so rather than letting it look broken.
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { EmptyState, LoadingState, SecondaryButton, SectionHeader } from '@/components';
import { newsService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { GAME_LABELS, GAME_TITLES } from '@/types';
import type { FollowedTopic, GameTitle, TopicKind } from '@/types';

/** §12.3 `FollowedTopic.kind`. Games are managed separately, above. */
const TOPIC_KINDS: readonly Exclude<TopicKind, 'game'>[] = ['franchise', 'character'];

const KIND_LABELS: Record<TopicKind, string> = {
  game: 'Game',
  franchise: 'Franchise',
  character: 'Character',
};

export default function FollowingScreen() {
  const { viewerId } = useApp();

  const [topics, setTopics] = useState<FollowedTopic[]>([]);
  const [games, setGames] = useState<GameTitle[]>([]);
  const [draft, setDraft] = useState('');
  const [draftKind, setDraftKind] = useState<Exclude<TopicKind, 'game'>>('franchise');
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setTopics(await newsService.getFollowedTopics(viewerId));
    setGames(newsService.followedGamesFor(viewerId));
    setBusy(false);
  }, [viewerId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function toggleGame(title: GameTitle) {
    await newsService.toggleFollowedGame(viewerId, title);
    await load();
  }

  async function toggleTopic(kind: TopicKind, value: string) {
    await newsService.toggleFollowedTopic(viewerId, kind, value);
    await load();
  }

  async function addTopic() {
    const value = draft.trim();
    if (value.length === 0) return;
    await newsService.toggleFollowedTopic(viewerId, draftKind, value);
    setDraft('');
    await load();
  }

  if (busy) {
    return (
      <View style={[styles.screen, styles.content]}>
        <LoadingState height={220} />
      </View>
    );
  }

  const followedTopics = topics.filter((t) => t.kind !== 'game');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.body}>
        Your For You feed is built from these, plus the items you actually own.
      </Text>

      <SectionHeader title="Games" />
      <View style={styles.chipRow}>
        {GAME_TITLES.map((title) => {
          const active = games.includes(title);
          return (
            <Pressable
              key={title}
              onPress={() => void toggleGame(title)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {GAME_LABELS[title]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.footnote}>
        Unfollowing a game you own items in lowers its articles rather than hiding them — what you
        own is a stronger signal than what you follow.
      </Text>

      <SectionHeader title="Franchises and Characters" />
      {followedTopics.length === 0 ? (
        <EmptyState
          title="Not following anything yet"
          body="Follow a franchise or a character and its news moves up your feed."
        />
      ) : (
        <View style={styles.list}>
          {followedTopics.map((topic) => (
            <View key={`${topic.kind}:${topic.value}`} style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{topic.value}</Text>
                <Text style={styles.muted}>{KIND_LABELS[topic.kind]}</Text>
              </View>
              <Pressable onPress={() => void toggleTopic(topic.kind, topic.value)} hitSlop={8}>
                <Text style={styles.unfollow}>Unfollow</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={styles.composer}>
        <View style={styles.chipRow}>
          {TOPIC_KINDS.map((kind) => (
            <Pressable
              key={kind}
              onPress={() => setDraftKind(kind)}
              style={[styles.chip, draftKind === kind && styles.chipActive]}
            >
              <Text style={[styles.chipText, draftKind === kind && styles.chipTextActive]}>
                {KIND_LABELS[kind]}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={draftKind === 'franchise' ? 'e.g. Elderflame' : 'e.g. Gusion'}
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          onSubmitEditing={() => void addTopic()}
        />
        <SecondaryButton label={`Follow ${KIND_LABELS[draftKind].toLowerCase()}`} onPress={() => void addTopic()} />
      </View>

      <Text style={styles.footnote}>
        Changes apply to the next feed load. Nothing is sent anywhere — following is stored for this
        session only in this build (§12.1).
      </Text>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, gap: spacing.md },

  body: { ...typography.body, color: colors.textSecondary },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...typography.meta, color: colors.textSecondary },
  chipTextActive: { color: colors.textOnAccent },

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
  unfollow: { ...typography.meta, color: colors.textTertiary },

  composer: { gap: spacing.sm, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.md,
    color: colors.textPrimary,
    ...typography.body,
  },
});
