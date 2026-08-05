/**
 * The in-app assistant.
 *
 * Answers questions about the viewer's own account — items, verification,
 * collections, showrooms, followers — and about how the app works.
 *
 * ── It works with no key ──────────────────────────────────────────────────
 * Every question about the user's own state is arithmetic over data already in
 * memory, so `domain/assistant` answers those locally and instantly. A model
 * key only adds free-form phrasing. That ordering is what makes this safe to
 * demo on conference wifi (§12.1) rather than a live dependency on stage.
 *
 * The reply says which path answered it. Never imply a model ran when none did.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LoadingState } from '@/components';
import { SUGGESTED_QUESTIONS } from '@/domain/assistant';
import type { AssistantContext } from '@/domain/assistant';
import {
  assistantService,
  catalogueService,
  collectionService,
  inventoryService,
  roomService,
  socialService,
} from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';

interface Turn {
  id: number;
  role: 'you' | 'assistant';
  text: string;
  source?: 'local' | 'model';
}

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const { viewer, viewerId } = useApp();
  const scroller = useRef<ScrollView>(null);

  const [context, setContext] = useState<AssistantContext | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const nextId = useRef(0);

  const mode = useMemo(() => assistantService.mode(), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [owned, catalogue, collections, rooms, followers, following, themes] =
        await Promise.all([
          inventoryService.getOwnedItems(viewerId),
          catalogueService.getCatalogueMap(),
          collectionService.getCollectionsByUser(viewerId, true),
          roomService.getRoomsOnProfile([]),
          socialService.getFollowers(viewerId),
          socialService.getFollowing(viewerId),
          roomService.getThemes(),
        ]);
      if (cancelled) return;
      setContext(
        assistantService.buildContext({
          viewer,
          owned,
          catalogue,
          collections,
          showroomCount: rooms.length,
          followerCount: followers.length,
          followingCount: following.length,
          themes,
        }),
      );
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [viewer, viewerId]);

  const send = useCallback(
    async (question: string) => {
      if (!context || thinking) return;
      const text = question.trim();
      if (text === '') return;

      setDraft('');
      setTurns((prev) => [...prev, { id: nextId.current++, role: 'you', text }]);
      setThinking(true);

      const answer = await assistantService.ask(text, context);

      setTurns((prev) => [
        ...prev,
        { id: nextId.current++, role: 'assistant', text: answer.text, source: answer.source },
      ]);
      setThinking(false);
    },
    [context, thinking],
  );

  if (!context) {
    return (
      <View style={[styles.screen, styles.centre]}>
        <LoadingState height={160} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scroller}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
      >
        <View style={styles.intro}>
          <Text style={styles.title}>Ask about your collection</Text>
          <Text style={styles.muted}>
            I know your {context.itemCount} items, {context.collections.length} collections and
            how Collectee works.
          </Text>
          {/* Honest about what is running. A "powered by AI" badge over a
              deterministic answerer is the exact thing §12.1 warns against. */}
          <Text style={styles.mode}>
            {mode === 'mocked'
              ? '⚙ Offline · answers computed on-device'
              : `⚡ ${mode === 'proxy' ? 'Proxy' : 'Gemini'} connected · ${assistantService.remainingCalls()} calls left this minute`}
          </Text>
        </View>

        {turns.length === 0 ? (
          <View style={styles.starters}>
            {SUGGESTED_QUESTIONS.map((question) => (
              <Pressable
                key={question}
                style={styles.starter}
                onPress={() => void send(question)}
              >
                <Text style={styles.starterText}>{question}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {turns.map((turn) => (
          <View
            key={turn.id}
            style={[styles.bubble, turn.role === 'you' ? styles.you : styles.assistant]}
          >
            <Text style={turn.role === 'you' ? styles.youText : styles.assistantText}>
              {turn.text}
            </Text>
            {turn.role === 'assistant' && turn.source ? (
              <Text style={styles.source}>
                {turn.source === 'model' ? 'model' : 'on-device'}
              </Text>
            ) : null}
          </View>
        ))}

        {thinking ? <Text style={styles.muted}>Thinking…</Text> : null}
      </ScrollView>

      <View style={[styles.composer, { paddingBottom: insets.bottom + spacing.md }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask about your items, collections or showrooms"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          maxLength={assistantService.maxQuestionLength}
          onSubmitEditing={() => void send(draft)}
          returnKeyType="send"
        />
        <Pressable
          onPress={() => void send(draft)}
          disabled={thinking || draft.trim() === ''}
          style={({ pressed }) => [
            styles.send,
            (thinking || draft.trim() === '') && styles.sendDisabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centre: { alignItems: 'center', justifyContent: 'center' },

  thread: { flex: 1 },
  threadContent: { padding: spacing.lg, gap: spacing.md },

  intro: { gap: spacing.xs },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  muted: { ...typography.meta, color: colors.textSecondary },
  mode: { ...typography.meta, color: colors.textTertiary, marginTop: spacing.xs },

  starters: { gap: spacing.sm, marginTop: spacing.md },
  starter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  starterText: { ...typography.body, color: colors.textPrimary },

  bubble: { maxWidth: '86%', padding: spacing.md, borderRadius: radius.card },
  you: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  youText: { ...typography.body, color: colors.textOnAccent },
  assistant: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  assistantText: { ...typography.body, color: colors.textPrimary },
  source: { ...typography.meta, color: colors.textTertiary },

  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    ...typography.body,
  },
  send: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { ...typography.meta, color: colors.textOnAccent, fontWeight: '600' },
  pressed: { opacity: 0.8 },
});
