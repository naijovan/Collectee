/**
 * Preferences quiz — three steps, straight after sign-in.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  EVERY ANSWER GOES SOMEWHERE REAL. Games and topics are written     │
 * │  through the §11 F6 session overlays, so the feed a judge sees      │
 * │  afterwards is the one they just asked for.                         │
 * │  SKIPPING WRITES NOTHING AT ALL — that is what makes "skip all =    │
 * │  the seeded defaults" exactly true rather than approximately true.  │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Session overlays only. Nothing here touches `User` or a fixture: the seeded
 * `followedGames` is on the merge contract (§12.3) and a quiz answer is not a
 * schema change (§12.1 — no backend).
 *
 * ── Why the writes happen at the end, not per tap ─────────────────────────
 * Every step is skippable and the last one can be reached without answering
 * the first, so a tap is not a commitment — it is a draft. Writing per tap
 * would mean backing out of step 1 left its answer applied, and "Skip all"
 * from step 3 would leave the first two steps' answers behind, which is the
 * one thing the skip is promising it will not do.
 *
 * ── Why step 2 disappears when news is off ────────────────────────────────
 * Followed topics only exist to rank the feed, and the feed is §14 rung 1. If
 * `FEATURES.news` is cut there is nothing for that answer to do, and a step
 * that collects an answer it will not use is worse than one less step.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarPicker, PrimaryButton, StepperHeader } from '@/components';
import { FEATURES } from '@/config/features';
import { INTENSITY_OPTIONS, deriveTasteChips } from '@/domain/onboarding';
import type { CollectorIntensity, TasteChip } from '@/domain/onboarding';
import * as haptics from '@/lib/haptics';
import { catalogueService, newsService } from '@/services';
import { useApp } from '@/state/AppContext';
import { GAME_LABELS, GAME_SHORT_LABELS, GAME_TITLES } from '@/types';
import type { GameTitle } from '@/types';
import { colors, interaction, radius, spacing, typography } from '@/theme/theme';

/**
 * The one-line pitch under each game card. Not from the catalogue — these are
 * editorial, and there is no field on the fixtures for "why you'd pick this".
 */
const GAME_BLURBS: Record<GameTitle, string> = {
  codm: 'Blueprints, operators and camos',
  valorant: 'Bundles, knives and finishers',
  mlbb: 'Hero skins and Collector drops',
};

export default function QuizScreen() {
  const insets = useSafeAreaInsets();
  const { viewerId, completeQuiz, chooseAvatar } = useApp();

  /* Step 2 only exists when the feed it feeds exists. Building the list here
     rather than branching at render keeps the stepper honest — it says "2 of 2"
     when there are two, instead of skipping a numbered step in front of the
     user. */
  /**
   * The avatar step sits second, immediately after games, because its roster is
   * ordered by the answer to step 1 — asking for a face before knowing which
   * titles someone plays would throw that ordering away.
   */
  const steps = useMemo(
    () =>
      FEATURES.news
        ? ([
            'Games you play',
            'Pick a face',
            'What you collect',
            'How you collect',
          ] as const)
        : (['Games you play', 'Pick a face', 'How you collect'] as const),
    [],
  );

  const [step, setStep] = useState(0);
  const [games, setGames] = useState<GameTitle[]>([]);
  const [chips, setChips] = useState<TasteChip[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [intensity, setIntensity] = useState<CollectorIntensity | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);

  useEffect(() => {
    if (!FEATURES.news) return;
    let cancelled = false;

    async function load() {
      const [sets, items, articles] = await Promise.all([
        catalogueService.getSets(),
        catalogueService.getAllItems(),
        newsService.getDiscover(100),
      ]);
      if (cancelled) return;
      setChips(deriveTasteChips(sets, items, articles));
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * The only place answers become state. Called by "Done", by every "Skip this
   * step" on the last step, and by "Skip all" — so there is exactly one path
   * out of the quiz and exactly one thing that can write.
   *
   * `keep` is what survives: "Skip all" passes nothing and therefore writes
   * nothing, which is the whole contract.
   */
  const finish = useCallback(
    async (keep: {
      games: GameTitle[];
      picked: string[];
      intensity: CollectorIntensity | null;
      avatarId: string | null;
    }) => {
      /* An empty games answer is "no preference", not "unfollow everything".
         Someone who skips step 1 keeps the seeded three; writing an empty set
         would silently empty their feed and read as a bug. */
      if (keep.games.length > 0) {
        await newsService.setFollowedGames(viewerId, keep.games);
      }

      /* `followTopic`, not `toggleFollowedTopic`. The viewer is seeded already
         following Elderflame and Gusion, both of which are derived chips — a
         toggle would unfollow the very thing the user just picked. */
      for (const value of keep.picked) {
        const chip = chips.find((c) => c.value === value);
        if (chip) await newsService.followTopic(viewerId, chip.kind, chip.value);
      }

      /* Null means the step was skipped, which must leave the seeded face
         alone rather than write a default over it. */
      if (keep.avatarId !== null) await chooseAvatar(keep.avatarId);

      haptics.success();
      completeQuiz(keep.intensity);
    },
    [chips, chooseAvatar, completeQuiz, viewerId],
  );

  const isLast = step === steps.length - 1;

  /**
   * Whether this step has been answered, and what to say when it has not.
   *
   * Two of the four are genuinely optional and are labelled so on screen: the
   * taste chips ("Anything you collect in particular?") and the intensity
   * ("What kind of collector are you?"). Both feed flavour — a ranked feed and
   * a profile pill — and neither gates anything, so demanding an answer would
   * be asking for input the app does not need.
   *
   * Games and the avatar are different. The avatar roster is ORDERED by the
   * games answer, and the face is what every card, comment and room credit
   * shows for this account. Letting either through empty produced a session
   * with no titles followed and a placeholder for a face, which then looked
   * like the app had failed rather than like a question had been ducked.
   *
   * The skip controls are gone for the same reason: with two steps required,
   * "Skip all" was a button whose whole purpose was to bypass them.
   */
  const { answered, requirement } = useMemo(() => {
    switch (steps[step]) {
      case 'Games you play':
        return {
          answered: games.length > 0,
          requirement: 'Pick at least one game to continue.',
        };
      case 'Pick a face':
        return { answered: avatarId !== null, requirement: 'Choose a face to continue.' };
      /* Optional by design — see above. */
      default:
        return { answered: true, requirement: '' };
    }
  }, [steps, step, games, avatarId]);

  const advance = useCallback(
    (keep: {
      games: GameTitle[];
      picked: string[];
      intensity: CollectorIntensity | null;
      avatarId: string | null;
    }) => {
      if (isLast) {
        void finish(keep);
        return;
      }
      haptics.tap();
      setStep((current) => current + 1);
    },
    [finish, isLast],
  );

  const answers = { games, picked, intensity, avatarId };
  const label = steps[step];

  return (
    <View style={styles.screen}>
      <View style={{ height: insets.top }} />
      <StepperHeader
        steps={steps}
        current={step}
        onBack={step > 0 ? () => setStep((c) => c - 1) : undefined}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {label === 'Games you play' ? (
          <GamesStep selected={games} onToggle={setGames} />
        ) : null}

        {label === 'Pick a face' ? (
          <AvatarStep value={avatarId} onPick={setAvatarId} games={games} />
        ) : null}

        {label === 'What you collect' ? (
          <TasteStep chips={chips} picked={picked} onToggle={setPicked} />
        ) : null}

        {label === 'How you collect' ? (
          <IntensityStep value={intensity} onPick={setIntensity} />
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.footerColumn}>
        <PrimaryButton
          label={isLast ? 'Done' : 'Continue'}
          disabled={!answered}
          onPress={() => advance(answers)}
        />
        {/* Says WHY the button is dead. A disabled control with no explanation
            is the same dead end as no control at all. */}
        {answered ? null : <Text style={styles.requirement}>{requirement}</Text>}
        </View>
      </View>
    </View>
  );
}

function GamesStep({
  selected,
  onToggle,
}: {
  selected: GameTitle[];
  onToggle: (next: GameTitle[]) => void;
}) {
  /* §14 rung 5: when the third title is cut it is shown as "coming soon"
     elsewhere, so it must not be a pickable answer here either. */
  const titles = GAME_TITLES.filter((t) => t !== 'mlbb' || FEATURES.thirdTitle);

  return (
    <View style={styles.step}>
      <Text style={styles.question}>Which of these do you play?</Text>
      <Text style={styles.hint}>Pick as many as you like. We&apos;ll follow their news for you.</Text>

      <View style={styles.cards}>
        {titles.map((title) => {
          const active = selected.includes(title);
          return (
            <Pressable
              key={title}
              onPress={() => {
                haptics.selection();
                onToggle(
                  active ? selected.filter((t) => t !== title) : [...selected, title],
                );
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={GAME_LABELS[title]}
              style={({ pressed }) => [
                styles.gameCard,
                active && styles.gameCardActive,
                pressed && !active && styles.pressed,
              ]}
            >
              <View style={styles.gameCardText}>
                <Text style={styles.gameShort}>{GAME_SHORT_LABELS[title]}</Text>
                <Text style={styles.gameName}>{GAME_LABELS[title]}</Text>
                <Text style={styles.hint}>{GAME_BLURBS[title]}</Text>
              </View>
              <View style={[styles.tick, active && styles.tickActive]}>
                {active ? <Text style={styles.tickMark}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AvatarStep({
  value,
  onPick,
  games,
}: {
  value: string | null;
  onPick: (next: string) => void;
  games: GameTitle[];
}) {
  return (
    <View style={styles.step}>
      <Text style={styles.question}>Pick a face</Text>
      <Text style={styles.hint}>
        {games.length > 0
          ? 'Your games first — but all fifteen are here, scroll for the rest.'
          : 'Fifteen to choose from. You can change it any time from your profile.'}
      </Text>

      {/* Horizontal: a full grid of fifteen pushes the Continue button off a
          phone screen, and this step is optional — it must not be the one that
          makes the quiz feel long. */}
      <AvatarPicker
        value={value}
        onChange={onPick}
        preferredGames={games}
        horizontal
        size={72}
      />
    </View>
  );
}

function TasteStep({
  chips,
  picked,
  onToggle,
}: {
  chips: TasteChip[];
  picked: string[];
  onToggle: (next: string[]) => void;
}) {
  return (
    <View style={styles.step}>
      <Text style={styles.question}>Anything you collect in particular?</Text>
      <Text style={styles.hint}>
        Skins and heroes our news actually covers — following one moves it up your feed.
      </Text>

      {/* The list is derived at runtime, so an empty result is possible rather
          than impossible, and saying so beats an unexplained blank step. */}
      {chips.length === 0 ? (
        <Text style={styles.hint}>Nothing to suggest yet — you can follow topics from any article.</Text>
      ) : (
        <View style={styles.chipWrap}>
          {chips.map((chip) => {
            const active = picked.includes(chip.value);
            return (
              <Pressable
                key={`${chip.kind}:${chip.value}`}
                onPress={() => {
                  haptics.selection();
                  onToggle(
                    active ? picked.filter((v) => v !== chip.value) : [...picked, chip.value],
                  );
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: active }}
                accessibilityLabel={`${chip.value}, ${chip.kind} in ${GAME_LABELS[chip.title]}`}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  pressed && !active && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {chip.value}
                </Text>
                <Text style={[styles.chipMeta, active && styles.chipTextActive]}>
                  {GAME_SHORT_LABELS[chip.title]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function IntensityStep({
  value,
  onPick,
}: {
  value: CollectorIntensity | null;
  onPick: (next: CollectorIntensity) => void;
}) {
  return (
    <View style={styles.step}>
      <Text style={styles.question}>What kind of collector are you?</Text>
      <Text style={styles.hint}>Goes on your profile. Nothing is gated on it.</Text>

      <View style={styles.cards}>
        {INTENSITY_OPTIONS.map((option) => {
          const active = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                haptics.selection();
                onPick(option.value);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${option.label}. ${option.blurb}`}
              style={({ pressed }) => [
                styles.gameCard,
                active && styles.gameCardActive,
                pressed && !active && styles.pressed,
              ]}
            >
              <View style={styles.gameCardText}>
                <Text style={styles.gameName}>{option.label}</Text>
                <Text style={styles.hint}>{option.blurb}</Text>
              </View>
              <View style={[styles.tick, active && styles.tickActive]}>
                {active ? <Text style={styles.tickMark}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    flexGrow: 1,
  },
  step: { width: '100%', maxWidth: 460, gap: spacing.md },

  question: { ...typography.screenTitle, color: colors.textPrimary },
  hint: { ...typography.body, color: colors.textSecondary },

  cards: { gap: spacing.md, marginTop: spacing.sm },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  gameCardActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  gameCardText: { flex: 1, gap: 2 },
  gameShort: {
    ...typography.meta,
    color: colors.textTertiary,
    letterSpacing: 1.2,
  },
  gameName: { ...typography.sectionHeader, color: colors.textPrimary },

  tick: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  tickMark: { ...typography.meta, color: colors.textOnAccent },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  chipText: { ...typography.cardTitle, color: colors.textPrimary },
  chipMeta: { ...typography.meta, color: colors.textTertiary },
  chipTextActive: { color: colors.textPrimary },

  pressed: { opacity: interaction.pressedOpacity },

  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  /* Matches the step column above it, so the CTA lines up with the content
     rather than stretching across a desktop browser window. */
  footerColumn: { width: '100%', maxWidth: 460, gap: spacing.md },
  /* Centred under the button it explains, in the muted tone the rest of the
     first run uses for guidance rather than for errors — the step is not
     wrong, it is simply not finished. */
  requirement: {
    ...typography.meta,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
