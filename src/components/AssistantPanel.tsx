/**
 * The assistant, as a panel over whatever the user is already looking at.
 *
 * Jovan owns every component in src/components/. Changes go via PR announced in
 * chat — this is where merge conflicts will otherwise happen.
 *
 * ── Why a panel and not a screen ──────────────────────────────────────────
 * The questions this answers are about the screen underneath it. "Why is Arya
 * my top match?" is asked while looking at Arya's card, and a full screen push
 * replaces the thing being asked about with the answer. So the panel overlays,
 * anchored to the launcher it came from, and the app stays visible behind it.
 *
 * ── The honesty rules, which are load-bearing ─────────────────────────────
 * Every answer is labelled with the path that produced it, and the header says
 * whether a model is connected at all. §12.1 permits exactly one real model
 * call in this build; a "powered by AI" flourish over a deterministic answerer
 * would be the claim that section exists to prevent.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import medium from 'expo-symbols/androidWeights/medium';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SUGGESTED_QUESTIONS } from '@/domain/assistant';
import type { AssistantContext } from '@/domain/assistant';
import { assistantService } from '@/services';
import { assistantMascot } from '@/config/assistantArt';
import { useAssistantDock } from '@/state/AssistantDock';
import { useApp } from '@/state/AppContext';
import { colors, interaction, radius, scrim, spacing, typography } from '@/theme/theme';

import { ASSISTANT_NAME, PANEL_CLEARANCE } from './assistantDock';

/**
 * Below this many calls left, the panel says so.
 *
 * It used to print the count permanently, which turns a quota into a
 * scoreboard — on the first question of a demo, "9 left this minute" reads as
 * a warning about something nobody was worried about.
 */
const RATE_WARN_AT = 3;

export function AssistantPanel() {
  const insets = useSafeAreaInsets();
  const mascot = assistantMascot();
  const { viewerId } = useApp();
  const { closePanel, turns, addTurn, clearTurns } = useAssistantDock();
  const scroller = useRef<ScrollView>(null);

  const [context, setContext] = useState<AssistantContext | null>(null);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);

  const mode = assistantService.mode();

  useEffect(() => {
    let cancelled = false;
    void assistantService.snapshot(viewerId).then((snapshot) => {
      if (!cancelled) setContext(snapshot);
    });
    return () => {
      cancelled = true;
    };
    // Re-read on every open: an item imported or an account linked since the
    // last question has to be in the answer, or the assistant contradicts the
    // screen behind it.
  }, [viewerId]);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (text === '' || thinking || !context) return;

      setDraft('');
      addTurn({ role: 'user', text });
      setThinking(true);

      // Only the plain turns go to the model — ids and source labels are ours.
      const history = turns.map(({ role, text: body }) => ({ role, text: body }));
      const answer = await assistantService.ask(text, context, history);

      addTurn({ role: 'assistant', text: answer.text, source: answer.source });
      setThinking(false);
    },
    [context, thinking, turns, addTurn],
  );

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Tap-outside to close. Behind the panel in the stack, so a tap inside
          the panel never reaches it. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={closePanel} accessibilityLabel="Close the assistant" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.anchor, { paddingBottom: PANEL_CLEARANCE + insets.bottom }]}
        pointerEvents="box-none"
      >
        <View style={styles.panel}>
          <View style={styles.header}>
            {/* The same face as the launcher, so opening the panel feels like
                the bubble expanded rather than a different thing appearing.
                Null until the art lands — the row simply has no avatar then. */}
            {mascot ? (
              <Image
                source={mascot}
                style={styles.headerMascot}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : null}
            <View style={styles.headerText}>
              <Text style={styles.title}>{ASSISTANT_NAME}</Text>
              <Text style={styles.tagline}>Your Collectee SideKick</Text>
            </View>
            {/*
              Start over. Disabled on an empty thread rather than hidden — a
              control that appears and disappears as you talk is harder to find
              than one that is always in the same place and simply inert.

              It clears the turns and leaves the panel open: the point is a
              fresh thread, not a closed one, and the empty state's suggestion
              chips come back with it.
            */}
            <Pressable
              onPress={clearTurns}
              disabled={turns.length === 0}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Start a new chat"
              accessibilityState={{ disabled: turns.length === 0 }}
              style={({ pressed }) => [
                styles.headerAction,
                turns.length === 0 && styles.headerActionOff,
                pressed && { opacity: 0.6 },
              ]}
            >
              <SymbolView
                name={{
                  ios: 'square.and.pencil',
                  android: 'edit_square',
                  web: 'edit_square',
                }}
                size={18}
                tintColor={turns.length === 0 ? colors.textTertiary : colors.accent}
                weight={{ ios: 'semibold', android: medium }}
              />
            </Pressable>
            <Pressable onPress={closePanel} hitSlop={10} accessibilityLabel="Close">
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            ref={scroller}
            style={styles.thread}
            contentContainerStyle={styles.threadContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
          >
            {turns.length === 0 ? (
              <>
                {/* Her opening line is a real chat bubble, styled exactly like
                    a model reply, so the panel opens mid-conversation rather
                    than on a menu. It is not a turn in `turns` — it is not
                    part of the transcript and must not be sent to the model
                    as history. */}
                <View style={[styles.bubble, styles.assistant]}>
                  <Text style={styles.assistantText}>
                    Hi, I&apos;m {ASSISTANT_NAME}! Ask me anything about your collection, your
                    matches, or what&apos;s happening in your games.
                  </Text>
                </View>

                {/* Chips, not stacked boxes. Four full-width rows read as the
                    primary interface; a wrapped row of small chips reads as
                    what they are — shortcuts you may ignore. Siblings of the
                    composer, never nested inside anything pressable. */}
                <View style={styles.chips}>
                  {SUGGESTED_QUESTIONS.map((question) => (
                    <Pressable
                      key={question}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                      onPress={() => void send(question)}
                    >
                      <Text style={styles.chipText} numberOfLines={1}>
                        {question}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {turns.map((turn) => (
              <View
                key={turn.id}
                style={[styles.bubble, turn.role === 'user' ? styles.you : styles.assistant]}
              >
                <Text style={turn.role === 'user' ? styles.youText : styles.assistantText}>
                  {turn.text}
                </Text>
                {turn.role === 'assistant' && turn.source ? (
                  <Text style={styles.source}>
                    {turn.source === 'model' ? 'Claude' : 'on-device'}
                  </Text>
                ) : null}
              </View>
            ))}

            {thinking ? (
              <View style={styles.thinking}>
                <ActivityIndicator size="small" color={colors.textTertiary} />
                <Text style={styles.mode}>Thinking…</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* The source line lives down here now rather than in the header,
              where it competed with her name for the first thing you read.
              Shown when answers are computed on-device — an honesty claim
              (§12.1) that must always be visible — and when the rate limit is
              actually close, not as a permanent counter. */}
          {mode === 'offline' || assistantService.remainingCalls() <= RATE_WARN_AT ? (
            <Text style={styles.mode}>
              {mode === 'offline'
                ? 'Answers computed on-device'
                : `Claude connected · ${assistantService.remainingCalls()} left this minute`}
            </Text>
          ) : null}

          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={context ? 'Ask a question' : 'Reading your collection…'}
              placeholderTextColor={colors.textTertiary}
              style={styles.input}
              editable={context !== null}
              maxLength={assistantService.maxQuestionLength}
              onSubmitEditing={() => void send(draft)}
              returnKeyType="send"
            />
            <Pressable
              onPress={() => void send(draft)}
              disabled={thinking || draft.trim() === '' || !context}
              style={({ pressed }) => [
                styles.send,
                (thinking || draft.trim() === '' || !context) && styles.sendDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.sendText}>Send</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Under the launcher (60), over everything else.
    zIndex: 50,
    backgroundColor: scrim.light,
  },
  anchor: { flex: 1, justifyContent: 'flex-end', alignItems: 'flex-end', padding: spacing.lg },

  panel: {
    width: '100%',
    maxWidth: 380,
    // Tall enough to hold a conversation, short enough that the screen it is
    // answering about is still visible behind it.
    maxHeight: 420,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  /**
   * 44, not 28.
   *
   * At 28 she was a dot — the point of putting her here is that the panel
   * reads as the same character the launcher bubble opened, and an
   * unidentifiable circle does not do that. 44 sits just above the two-line
   * title block (~38pt: a 20pt title over a 16pt mode line), so she anchors
   * the row without towering over it.
   *
   * No `marginRight` — the header row already has `gap`, and carrying both
   * double-spaced her away from the title.
   *
   * The ring matches the launcher bubble's, so the face in the header and the
   * face in the corner read as one thing rather than two portraits.
   */
  headerMascot: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentPressed,
    backgroundColor: colors.surfaceSunken,
  },
  header: {
    flexDirection: 'row',
    /* flex-start keeps the close button pinned top-right, unchanged. The text
       block centres itself against the face separately. */
    alignItems: 'flex-start',
    gap: spacing.sm,
    /* lg, not md: at 44 the face filled the old 12pt padding and the row read
       as cramped. */
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  /* Centred against the 44pt face rather than top-aligned to it, so the
     two-line block sits balanced beside her instead of riding high. */
  headerText: { flex: 1, gap: 2, alignSelf: 'center' },
  /* Her name, not a sentence. The panel is a conversation with someone, and
     the first thing you read should be who. */
  title: { ...typography.sectionHeader, fontSize: 18, color: colors.textPrimary },
  tagline: { ...typography.meta, color: colors.textSecondary },
  mode: {
    ...typography.meta,
    color: colors.textTertiary,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerAction: { padding: 4, borderRadius: radius.sm },
  headerActionOff: { opacity: 0.5 },
  close: { ...typography.cardTitle, color: colors.textSecondary },

  thread: { flexGrow: 0 },
  threadContent: { padding: spacing.md, gap: spacing.sm },

  /* Wrapped row of pills. `maxWidth` keeps a long question from taking a
     whole line to itself and turning the row back into a stack. */
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    maxWidth: '100%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipText: { ...typography.meta, color: colors.textSecondary },

  bubble: { maxWidth: '90%', padding: spacing.md, borderRadius: radius.card },
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

  thinking: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },

  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    ...typography.body,
  },
  send: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  sendDisabled: { opacity: 0.4 },
  sendText: { ...typography.meta, color: colors.textOnAccent, fontWeight: '600' },
  pressed: { opacity: interaction.pressedOpacity },
});
