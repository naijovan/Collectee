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
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarPicker, PrimaryButton, StepperHeader } from '@/components';
import { FEATURES } from '@/config/features';
import { INTENSITY_OPTIONS, deriveTasteChips } from '@/domain/onboarding';
import type { CollectorIntensity, TasteChip } from '@/domain/onboarding';
import * as haptics from '@/lib/haptics';
import { catalogueService, newsService, socialService } from '@/services';
import { AGE_OPTIONS, MAX_AGE_OPTION, ageLabel } from '@/domain/account';
import { useApp } from '@/state/AppContext';
import type { AccountDetails } from '@/state/AppContext';
import { GAME_LABELS, GAME_SHORT_LABELS, GAME_TITLES } from '@/types';
import type { GameTitle } from '@/types';
import { colors, fonts, interaction, radius, spacing, typography } from '@/theme/theme';

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
  const { viewerId, completeQuiz, chooseAvatar, setAccountDetails } = useApp();

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
        ? (['Your details', 'Games you play', 'What you collect', 'How you collect'] as const)
        : (['Your details', 'Games you play', 'How you collect'] as const),
    [],
  );

  const [step, setStep] = useState(0);
  const [games, setGames] = useState<GameTitle[]>([]);
  const [chips, setChips] = useState<TasteChip[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [intensity, setIntensity] = useState<CollectorIntensity | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  /**
   * Whether the typed handle belongs to someone already.
   *
   * `VIEWER_ID` is excluded: a member is overlaying the demo account, so its
   * own seeded handle is not a collision — without that exception the very
   * first suggestion a user is likely to try would be reported as taken by
   * themselves.
   */
  const handleTaken = useMemo(
    () => socialService.isHandleTaken(handle, viewerId),
    [handle, viewerId],
  );
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');

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
      details: AccountDetails;
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

      /* Name and handle overlay the seeded user; age and email stay in context.
         Blank fields clear rather than write empties, so a half-filled form
         leaves the seeded values alone. */
      await setAccountDetails(keep.details);

      haptics.success();
      completeQuiz(keep.intensity);
    },
    [chips, chooseAvatar, setAccountDetails, completeQuiz, viewerId],
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
      case 'Your details':
        return {
          /* Name and handle only. Age and email are asked for because a real
             sign-up asks, but neither drives anything in the app, and blocking
             the front door on an email nobody sends to would be theatre. */
          answered:
            displayName.trim().length > 0 &&
            handle.trim().length > 0 &&
            handleTaken === false &&
            age.length > 0 &&
            avatarId !== null,
          requirement:
            handleTaken === true
              ? `@${socialService.normaliseHandle(handle)} is taken — try another.`
              : 'A name, a handle, an age and a face are needed to continue.',
        };
      case 'Games you play':
        return {
          answered: games.length > 0,
          requirement: 'Pick at least one game to continue.',
        };
      /* Optional by design — see above. */
      default:
        return { answered: true, requirement: '' };
    }
  }, [steps, step, games, avatarId, displayName, handle, handleTaken, age]);

  const advance = useCallback(
    (keep: {
      games: GameTitle[];
      picked: string[];
      intensity: CollectorIntensity | null;
      avatarId: string | null;
      details: AccountDetails;
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

  const answers = { games, picked, intensity, avatarId, details: { displayName, handle, age, email, bio } };
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
        {label === 'Your details' ? (
          <DetailsStep
            displayName={displayName}
            onDisplayName={setDisplayName}
            handle={handle}
            onHandle={setHandle}
            age={age}
            onAge={setAge}
            email={email}
            onEmail={setEmail}
            avatarId={avatarId}
            onAvatar={setAvatarId}
            handleTaken={handleTaken}
            bio={bio}
            onBio={setBio}
          />
        ) : null}

        {label === 'Games you play' ? (
          <GamesStep selected={games} onToggle={setGames} />
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

/**
 * Sign-up's first question: who is this account.
 *
 * ── Why it is step one ───────────────────────────────────────────────────
 * Everything after it is preference — which games, which face, what you
 * collect. This is identity, and it is what the rest of the app then shows: the
 * Home greeting, the profile header, the name on a comment. Asking for it last
 * would mean the first thing a new user sees after signing up is somebody
 * else's name.
 *
 * ── What is stored, and where ────────────────────────────────────────────
 * Name and handle overlay the seeded user, so they reach every screen through
 * `viewer` with no screen knowing sign-up exists. Age and email are kept in
 * `AppContext` instead of on `User` — that type is the team's merge contract
 * (§12.3), and widening it for two fields only this screen writes would be a
 * schema change for a session detail.
 *
 * Nothing here leaves the device. There is no backend in this build (§12.1),
 * so "your details" means a few strings in memory that a reload clears.
 */
function DetailsStep({
  displayName,
  onDisplayName,
  handle,
  onHandle,
  age,
  onAge,
  email,
  onEmail,
  avatarId,
  onAvatar,
  handleTaken,
  bio,
  onBio,
}: {
  displayName: string;
  onDisplayName: (next: string) => void;
  handle: string;
  onHandle: (next: string) => void;
  age: string;
  onAge: (next: string) => void;
  email: string;
  onEmail: (next: string) => void;
  avatarId: string | null;
  onAvatar: (next: string) => void;
  handleTaken: boolean;
  bio: string;
  onBio: (next: string) => void;
}) {
  return (
    <View style={styles.step}>
      <Text style={styles.question}>Tell us who you are</Text>
      <Text style={styles.hint}>
        This is what other collectors see. Nothing here leaves your device.
      </Text>

      {/*
        The face sits with the name because they are one answer — "who am I
        here" — and it used to be a page of its own that asked nothing else.

        Its roster was previously ordered by the games answer, which is why it
        came after that step. It cannot be any more, since this is now step one.
        No real loss: the picker is horizontal and all fifteen scroll past, so
        the ordering only ever changed which four you saw first.
      */}
      <AvatarPicker value={avatarId} onChange={onAvatar} horizontal size={72} />

      <View style={styles.fields}>
        <Field
          label="Display name"
          value={displayName}
          onChange={onDisplayName}
          placeholder="Jane Tan"
          autoCapitalize="words"
          maxLength={24}
        />
        {/* Prefixed rather than validated with a message: showing the "@" the
            app will print means the shape of the answer is obvious before it
            is typed, and `setIdentity` strips anything that would not survive
            being rendered after it. */}
        <Field
          label="Handle"
          value={handle}
          onChange={onHandle}
          placeholder="janetan"
          prefix="@"
          autoCapitalize="none"
          maxLength={20}
          /* Reported on the field rather than only under the button: the
             conflict is with THIS input, and making someone look elsewhere to
             find out which of four fields is wrong is the slow way to say it. */
          error={handleTaken ? 'That handle is taken. Try another.' : undefined}
        />
        {/*
          A picker, not a free-text box, because the answer is constrained: the
          app is 18+, so an under-18 entry has only one outcome and typing it
          only to be refused is a worse way to learn that than never being
          offered it. The list starts at the minimum for the same reason.
        */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Age</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ageRow}
          >
            {AGE_OPTIONS.map((option) => {
              const active = age === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => onAge(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={option === MAX_AGE_OPTION ? `${option} or older` : option}
                  style={[styles.agePill, active && styles.agePillActive]}
                >
                  <Text style={[styles.ageText, active && styles.ageTextActive]}>
                    {ageLabel(option)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <Field
          label="Email"
          value={email}
          onChange={onEmail}
          placeholder="Optional"
          keyboardType="email-address"
          autoCapitalize="none"
          maxLength={64}
        />
        {/* Optional, and last: it is the one field with nothing to check and
            the one most people will leave alone. Multiline because a bio that
            scrolls sideways in a single line is unreadable while writing it. */}
        <Field
          label="Bio"
          value={bio}
          onChange={onBio}
          placeholder="Optional — what you collect, in a line"
          maxLength={140}
          multiline
        />
      </View>
    </View>
  );
}

/** One labelled input. A component so the four cannot drift apart. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  autoCapitalize = 'sentences',
  keyboardType = 'default',
  maxLength,
  error,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  prefix?: string;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  keyboardType?: 'default' | 'email-address' | 'number-pad';
  maxLength?: number;
  error?: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldBox, error ? styles.fieldBoxError : null]}>
        {prefix ? <Text style={styles.fieldPrefix}>{prefix}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          keyboardType={keyboardType}
          maxLength={maxLength}
          multiline={multiline}
          style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
          accessibilityLabel={label}
        />
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
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
        Skins and heroes our news actually covers — following one moves it up your feed.{' '}
        <Text style={styles.optional}>(Optional)</Text>
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
      <Text style={styles.hint}>
        Goes on your profile. Nothing is gated on it.{' '}
        <Text style={styles.optional}>(Optional)</Text>
      </Text>

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
  /**
   * Marks the two steps `answered` lets through empty.
   *
   * Inline in the hint rather than a badge beside the question: it qualifies
   * the ask, and a user who has read the question has already read past the
   * point a corner badge would have helped. Weighted, not coloured — it is a
   * note about the question, not a warning about the answer.
   */
  optional: { fontFamily: fonts.bodySemiBold, color: colors.textSecondary },
  /* Centred under the button it explains, in the muted tone the rest of the
     first run uses for guidance rather than for errors — the step is not
     wrong, it is simply not finished. */
  fields: { gap: spacing.md, alignSelf: 'stretch' },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.meta, color: colors.textSecondary },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    /* Tall enough to hit on a phone without the browser zooming the field. */
    minHeight: 46,
  },
  fieldPrefix: { ...typography.body, color: colors.textTertiary },
  /* `flex: 1` so the input, not the box, owns the remaining width — otherwise
     the caret sits at the prefix and the text runs under it. */
  fieldInput: { ...typography.body, color: colors.textPrimary, flex: 1, paddingVertical: spacing.sm },
  fieldInputMultiline: { minHeight: 72, textAlignVertical: 'top', paddingTop: spacing.sm },
  fieldBoxError: { borderColor: colors.danger },
  fieldError: { ...typography.meta, color: colors.danger },
  ageRow: { gap: spacing.xs, paddingVertical: 2 },
  agePill: {
    minWidth: 46,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  agePillActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  ageText: { ...typography.body, color: colors.textSecondary },
  ageTextActive: { color: colors.textPrimary },
  requirement: {
    ...typography.meta,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
