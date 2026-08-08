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

export function AssistantPanel() {
  const insets = useSafeAreaInsets();
  const mascot = assistantMascot();
  const { viewerId } = useApp();
  const { closePanel, turns, addTurn } = useAssistantDock();
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
              <Text style={styles.title}>Ask {ASSISTANT_NAME} about your collection</Text>
              <Text style={styles.mode}>
                {mode === 'offline'
                  ? 'Answers computed on-device'
                  : `Claude connected · ${assistantService.remainingCalls()} left this minute`}
              </Text>
            </View>
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
              <View style={styles.starters}>
                {SUGGESTED_QUESTIONS.map((question) => (
                  <Pressable
                    key={question}
                    style={({ pressed }) => [styles.starter, pressed && styles.pressed]}
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
    width: 44,
    height: 44,
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
  title: { ...typography.cardTitle, color: colors.textPrimary },
  mode: { ...typography.meta, color: colors.textTertiary },
  close: { ...typography.cardTitle, color: colors.textSecondary },

  thread: { flexGrow: 0 },
  threadContent: { padding: spacing.md, gap: spacing.sm },

  starters: { gap: spacing.sm },
  starter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  starterText: { ...typography.body, color: colors.textPrimary },

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
