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

import { ASSISTANT_CLEARANCE, EmptyState, LoadingState, SecondaryButton, SectionHeader } from '@/components';
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
        /* A grid of square-ish tiles rather than the full-width rows this used
           to draw. Two reasons it changed. A 1248pt-wide card holding one
           franchise name is mostly empty, and the screen read as a settings
           list when what it is showing is a collection of things you follow —
           the same content shape as the community grid on Explore and the rails
           on Home, so it now uses their pattern.

           `aspectRatio` rather than a fixed height: the tiles are flex-sized so
           two fit per row at any width, and a fixed height would go square at
           one width and wrong at every other. */
        <View style={styles.grid}>
          {followedTopics.map((topic) => (
            <View key={`${topic.kind}:${topic.value}`} style={styles.tile}>
              <View style={styles.tileTop}>
                <Text style={styles.tileKind}>{KIND_LABELS[topic.kind]}</Text>
              </View>
              {/* The name gets the room. Two lines because "Shadow Skyline" and
                  the like do not fit one at half width, and truncating the thing
                  the tile is FOR is the one thing this layout must not do. */}
              <Text style={styles.tileName} numberOfLines={2}>
                {topic.value}
              </Text>
              {/* Sibling of the text, never a wrapper around it: the tile is not
                  itself pressable, so there is no button inside a button here. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Unfollow ${topic.value}`}
                onPress={() => void toggleTopic(topic.kind, topic.value)}
                hitSlop={8}
                style={({ pressed }) => [styles.unfollowButton, pressed && { opacity: 0.6 }]}
              >
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

      {/* The floating assistant sits over this corner. Reserve its real height
          so the last row — including any rule above a footnote — is never
          resting underneath it. `spacing.xxl` was not enough: it is 32 against
          the launcher's 184. */}
      <View style={{ height: ASSISTANT_CLEARANCE }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, gap: spacing.md },

  body: { ...typography.body, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },

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

  /* Same two-up wrap as Explore's community grid, and the same gap, so the two
     screens' grids line up rather than each inventing a rhythm. */
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    /* `flexBasis: 45%` with wrap gives exactly two per row and lets them share
       the leftover evenly — no measured width, so it holds at any screen size
       and under the 720 cap on wide screens. */
    flexGrow: 1,
    flexBasis: '45%',
    /* Square-ish rather than square: 1 exactly left the Unfollow control
       floating in dead space under a one-word name. 1.15 is a tile, not a row. */
    aspectRatio: 1.15,
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  /* Its own row so the kind chip sits top-left and does not stretch. */
  tileTop: { flexDirection: 'row' },
  tileKind: {
    ...typography.meta,
    fontSize: 11,
    color: colors.textSecondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  /* Bigger than the old row title: on a tile the name is the content, not a
     label beside a value. */
  tileName: { ...typography.sectionHeader, fontSize: 17, color: colors.textPrimary },
  /* Pinned to the bottom of the tile by the parent's space-between. */
  unfollowButton: { alignSelf: 'flex-start', paddingVertical: 2 },
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
