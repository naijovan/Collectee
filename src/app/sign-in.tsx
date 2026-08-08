/**
 * Sign in — the front door (§16 Q8, answered the other way on 6 Aug).
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  NOTHING HERE AUTHENTICATES. Any input proceeds; so does one tap on │
 * │  either OAuth button. There is no backend to authenticate against   │
 * │  (§12.1) and real account linking is partnership-gated (§9.3).      │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ── Why this screen carries no "demo" label ───────────────────────────────
 * Every other mocked surface in this build says so on itself — "Prepared
 * digest — no model call ran", "Saved in the app for this session". This one
 * does not, and that is a decision rather than an oversight. It is the first
 * thing anyone sees, it exists to make a first impression, and a front door
 * that disclaims itself is not a front door. The claim is still made honestly
 * everywhere it is actually read: /diagnostics states it in as many words, and
 * the pitch says it out loud. The one thing we do not do is imply a security
 * property — no "encrypted", no "secure", no padlock.
 *
 * ── Why it is allowed to flex ─────────────────────────────────────────────
 * House tokens throughout, but the composition goes further than the rest of
 * the app: a full-bleed wash off the rarity ladder, an oversized wordmark, and
 * a mark built from Views. §13.2 is a palette and a type scale, not a ban on
 * using them ambitiously, and the screen that sets the tone is the place to
 * spend the budget.
 *
 * The only validation is that the email looks like an email, purely so the
 * form behaves the way a real one would when someone fat-fingers it on stage.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafe } from '@/components';
import * as haptics from '@/lib/haptics';
import { useApp } from '@/state/AppContext';
import {
  brand,
  colors,
  fonts,
  interaction,
  letterSpacing,
  radius,
  rarityColors,
  scrim,
  spacing,
  typography,
} from '@/theme/theme';

/**
 * How long the fake sign-in takes.
 *
 * Long enough to read as work, short enough that nobody watching wonders if it
 * hung. The same reasoning as `LATENCY_*`, but it is not imported from there:
 * those constants describe the mocked *service* layer, and this is not a
 * service call — there is nothing on the other side of it, not even a fixture.
 */
const FAKE_AUTH_MS = 900;

/**
 * Deliberately loose. It rejects "asdf" and accepts anything a real address
 * would be, which is the entire job — a stricter pattern would reject a valid
 * address on stage and there is no account to look up either way.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Method = 'google' | 'apple' | 'email';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signIn } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pending, setPending] = useState<Method | null>(null);

  /* The timeout has to be cancellable: the component unmounts the moment the
     redirect fires, and a setState landing after that is a warning in the
     console during the demo. */
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const proceed = useCallback(
    (method: Method) => {
      if (pending) return;
      haptics.tap();
      setPending(method);
      timer.current = setTimeout(() => {
        /* The redirect out of here is the root layout's, driven by
           `firstRunStage`. This screen does not navigate — it changes the state
           and lets the one guard decide where that lands, so the quiz-off and
           tour-off flag combinations do not each need handling here too. */
        signIn();
      }, FAKE_AUTH_MS);
    },
    [pending, signIn],
  );

  const submitEmail = useCallback(() => {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError('That does not look like an email address.');
      haptics.warn();
      return;
    }
    setEmailError(null);
    proceed('email');
  }, [email, proceed]);

  return (
    <View style={styles.screen}>
      {/* Two washes rather than one: a wide diagonal that lifts the top off the
          near-black, and a tighter bloom concentrating it behind the mark. One
          gradient doing both jobs is either a flat tint or a visible band.
          Both stay in the violet-to-blue half of the ladder — an amber or red
          bloom over the purple wash composites to brown, which is the failure
          mode of stacking translucent gradients from opposite sides of a
          colour wheel. The warm tokens get used on the mark instead, where
          they sit ON the wash rather than through it. */}
      <LinearGradient
        colors={[rarityColors.epic, colors.accent, scrim.clear]}
        locations={[0, 0.35, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 0.75 }}
        style={[styles.wash, styles.washBack]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[colors.accent, scrim.clear]}
        style={[styles.wash, styles.washBloom]}
        pointerEvents="none"
      />

      {/* No stack header on this route, so the offset must not assume one — it
          would lift the form a header's height too far. */}
      <KeyboardSafe hasHeader={false}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* An explicit measured column rather than a max-width on the scroll
              content container: `alignSelf` on a contentContainerStyle is not
              reliable across RN and RN Web, and the demo may well be recorded
              in a full-width browser window where getting this wrong means a
              form stretched to 1400px. */}
          <View style={styles.column}>
          <View style={styles.hero}>
            <CollecteeMark />
            <Text style={styles.wordmark}>Collectee</Text>
            <Text style={styles.tagline}>
              Every skin you own, finally worth showing off.
            </Text>
          </View>

          <View style={styles.actions}>
            <OAuthButton
              method="google"
              label="Continue with Google"
              pending={pending === 'google'}
              disabled={pending !== null && pending !== 'google'}
              onPress={() => proceed('google')}
            />
            <OAuthButton
              method="apple"
              label="Continue with Apple"
              pending={pending === 'apple'}
              disabled={pending !== null && pending !== 'apple'}
              onPress={() => proceed('apple')}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Field
              label="Email"
              value={email}
              onChange={(next) => {
                setEmail(next);
                if (emailError) setEmailError(null);
              }}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              invalid={emailError !== null}
              onSubmit={submitEmail}
            />
            {emailError ? <Text style={styles.error}>{emailError}</Text> : null}

            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
              onSubmit={submitEmail}
            />

            <Pressable
              onPress={submitEmail}
              disabled={pending !== null}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              accessibilityState={{ disabled: pending !== null }}
              style={({ pressed }) => [
                styles.submit,
                pressed && styles.submitPressed,
                pending !== null && pending !== 'email' && styles.dimmed,
              ]}
            >
              {pending === 'email' ? (
                <ActivityIndicator color={colors.textOnAccent} />
              ) : (
                <Text style={styles.submitLabel}>Sign in</Text>
              )}
            </Pressable>

            <Text style={styles.footnote}>
              New here? Signing in creates your account — we&apos;ll ask what you collect next.
            </Text>
          </View>
          </View>
        </ScrollView>
      </KeyboardSafe>
    </View>
  );
}

/**
 * The mark: three stacked facets in the rarity ladder's own colours, which is
 * the closest thing this product has to a logo argument — the app is about the
 * value ladder, so the mark is the ladder.
 *
 * Rotated squares rather than a path, for the same reason the tab icons are
 * Views: no icon dependency, and it inherits the theme.
 */
function CollecteeMark() {
  return (
    <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.facet, styles.facetBack, { borderColor: rarityColors.mythic }]} />
      <View style={[styles.facet, styles.facetMid, { borderColor: rarityColors.legendary }]} />
      <View style={[styles.facet, styles.facetFront, { backgroundColor: colors.accent }]} />
    </View>
  );
}

/**
 * Google's four-colour ring, approximated with per-side border colours on a
 * rotated circle, plus the crossbar. Not the exact glyph — the real one is a
 * path with a flat terminal — but at 18px it reads as Google instantly, which
 * is the whole requirement.
 */
function GoogleMark() {
  return (
    <View style={styles.oauthMark}>
      <View
        style={[
          styles.googleRing,
          {
            borderTopColor: brand.googleRed,
            borderRightColor: brand.googleBlue,
            borderBottomColor: brand.googleGreen,
            borderLeftColor: brand.googleYellow,
          },
        ]}
      />
      <View style={[styles.googleBar, { backgroundColor: brand.googleBlue }]} />
    </View>
  );
}

/**
 * The Apple mark, as a silhouette: a body from two overlapping rounded blobs,
 * a bite bitten out of the right edge by a background-coloured circle, and a
 * leaf. The `` character was the alternative and it is tofu anywhere that is
 * not an Apple platform — including the browser this demo may well be recorded
 * in, which is the kind of thing you discover during the take.
 */
function AppleMark() {
  return (
    <View style={styles.oauthMark}>
      <View style={[styles.appleBody, { backgroundColor: colors.textPrimary }]} />
      <View style={[styles.appleBite, { backgroundColor: colors.surfaceElevated }]} />
      <View style={[styles.appleLeaf, { backgroundColor: colors.textPrimary }]} />
    </View>
  );
}

function OAuthButton({
  method,
  label,
  pending,
  disabled,
  onPress,
}: {
  method: 'google' | 'apple';
  label: string;
  pending: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || pending}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || pending, busy: pending }}
      style={({ pressed }) => [
        styles.oauth,
        pressed && styles.oauthPressed,
        disabled && styles.dimmed,
      ]}
    >
      {pending ? (
        <ActivityIndicator color={colors.textPrimary} />
      ) : (
        <>
          {method === 'google' ? <GoogleMark /> : <AppleMark />}
          <Text style={styles.oauthLabel}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoComplete,
  invalid,
  onSubmit,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address';
  autoComplete?: 'email' | 'password';
  invalid?: boolean;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={onSubmit}
        returnKeyType="go"
        style={[styles.input, invalid && styles.inputInvalid]}
      />
    </View>
  );
}

const MARK_SIZE = 76;
const FACET = 34;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },

  wash: { position: 'absolute', left: 0, right: 0 },
  /* Low opacity because these sit under text. The colours are picked for hue,
     not for presence — at full strength the wordmark stops being readable and
     the screen reads as a splash rather than a form. */
  washBack: { top: 0, height: '68%', opacity: 0.22 },
  washBloom: { top: 0, height: '34%', opacity: 0.14 },

  content: {
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    /* Centres the column vertically when the viewport is taller than the form,
       which is every desktop browser. `flexGrow` rather than `flex` so it still
       scrolls when the keyboard is up on a short phone. */
    flexGrow: 1,
    justifyContent: 'center',
  },
  column: { width: '100%', maxWidth: 460, gap: spacing.xxl },

  hero: { alignItems: 'center', gap: spacing.md },

  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  facet: {
    position: 'absolute',
    width: FACET,
    height: FACET,
    borderWidth: 2,
    borderRadius: 6,
    transform: [{ rotate: '45deg' }],
  },
  facetBack: { opacity: 0.45, transform: [{ rotate: '45deg' }, { translateY: -13 }] },
  facetMid: { opacity: 0.7, transform: [{ rotate: '45deg' }, { translateY: -6 }] },
  facetFront: { borderWidth: 0 },

  wordmark: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 50,
    color: colors.textPrimary,
    letterSpacing: letterSpacing.tight,
  },
  tagline: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
  },

  actions: { gap: spacing.md },

  oauth: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  oauthPressed: {
    backgroundColor: colors.surface,
    transform: [{ scale: interaction.pressedScale }],
  },
  oauthLabel: { ...typography.cardTitle, fontSize: 15, color: colors.textPrimary },
  oauthMark: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },

  googleRing: {
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    borderWidth: 3,
    transform: [{ rotate: '45deg' }],
  },
  /* The crossbar of the G — sits on the right, half the width of the mark. */
  googleBar: { position: 'absolute', right: 0, width: 8, height: 3, borderRadius: 1 },

  appleBody: { width: 15, height: 16, borderRadius: 7 },
  appleBite: { position: 'absolute', right: -3, width: 7, height: 12, borderRadius: 4 },
  appleLeaf: {
    position: 'absolute',
    top: -1,
    right: 4,
    width: 6,
    height: 4,
    borderRadius: 3,
    transform: [{ rotate: '-35deg' }],
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerLabel: { ...typography.meta, color: colors.textTertiary },

  field: { gap: spacing.xs },
  fieldLabel: { ...typography.meta, color: colors.textSecondary },
  input: {
    height: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    ...typography.body,
    /* RN web draws a focus ring in the UA's accent, which is not ours. */
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as const } : null),
  },
  inputInvalid: { borderColor: colors.danger },
  error: { ...typography.meta, color: colors.danger },

  submit: {
    height: 52,
    marginTop: spacing.xs,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  submitPressed: {
    backgroundColor: colors.accentPressed,
    transform: [{ scale: interaction.pressedScale }],
  },
  submitLabel: { ...typography.cardTitle, fontSize: 16, color: colors.textOnAccent },

  dimmed: { opacity: interaction.disabledOpacity },

  footnote: {
    ...typography.meta,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
