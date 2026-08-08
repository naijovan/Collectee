/**
 * Sign in - the front door (§16 Q8, answered the other way on 6 Aug).
 *
 * Nothing here authenticates. The first-run state still owns the redirect, so
 * every visible entry path below only simulates a short handoff and then calls
 * `signIn()`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHoverPop } from '@/components/primitives';
import * as haptics from '@/lib/haptics';
import { useApp } from '@/state/AppContext';
import {
  accentGradient,
  colors,
  fonts,
  interaction,
  radius,
  rarityColors,
  scrim,
  spacing,
  typography,
} from '@/theme/theme';

const COLLECTEE_MARK = require('../../assets/collectee/brand/collectee-mark.png');
const LOGIN_HERO = require('../../assets/collectee/brand/login-hero.png');

const FAKE_AUTH_MS = 900;

type Method = 'sign-in' | 'guest';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const { signIn, continueAsGuest } = useApp();
  /* Same spring the chips and pill CTAs use, so the front door behaves like
     the rest of the app rather than being the one inert screen. */
  const guestPop = useHoverPop();
  const [pending, setPending] = useState<Method | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const availableWidth = Math.max(0, viewportWidth - spacing.lg * 2);
  const columnWidth = Math.min(availableWidth, 520);
  const safeHeight = Math.max(0, viewportHeight - insets.top - insets.bottom);
  const isCompact = safeHeight < 780;
  const isVeryShort = safeHeight < 700;
  const columnGap = isCompact ? spacing.md : spacing.lg;
  const actionGap = isCompact ? spacing.xs : spacing.sm;
  const buttonHeight = isCompact ? 54 : 58;
  const maxHeroReveal = Math.max(160, safeHeight - (isVeryShort ? 360 : isCompact ? 400 : 460));
  const heroRevealHeight = Math.min(
    isCompact ? 310 : 390,
    Math.max(160, Math.min(viewportHeight * 0.42, columnWidth * 0.78, maxHeroReveal)),
  );

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
        /* The two buttons used to call the same thing, which made "Continue as
           guest" a differently-worded sign-in: it landed on the demo account's
           inventory, collections and showrooms. `continueAsGuest` switches the
           id every service is queried with, so a guest owns nothing — and it
           also skips the quiz and the tour, which both ask someone to invest in
           an account they have just declined to make. */
        if (method === 'guest') continueAsGuest();
        else signIn();
      }, FAKE_AUTH_MS);
    },
    [pending, signIn, continueAsGuest],
  );

  return (
    <View style={styles.screen}>
      <Image
        accessibilityIgnoresInvertColors
        contentFit="cover"
        contentPosition={{ left: '50%', top: '20%' }}
        source={LOGIN_HERO}
        style={styles.backgroundImage}
      />
      <LinearGradient
        colors={[scrim.heavy, scrim.light, scrim.heavy]}
        locations={[0, 0.48, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
        style={styles.fullScreenOverlay}
      />
      <LinearGradient
        colors={[scrim.clear, colors.background]}
        pointerEvents="none"
        style={styles.bottomFade}
      />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + (isCompact ? spacing.sm : spacing.lg),
            paddingBottom: insets.bottom + (isCompact ? spacing.xs : spacing.md),
          },
        ]}
      >
        <View style={[styles.column, { gap: columnGap, width: columnWidth }]}>
          <View style={styles.brandBlock}>
            <Image
              accessibilityIgnoresInvertColors
              contentFit="contain"
              source={COLLECTEE_MARK}
              style={[styles.brandMark, isCompact && styles.brandMarkCompact]}
            />
            <Text style={[styles.wordmark, isCompact && styles.wordmarkCompact]}>
              Collectee
            </Text>
            <Text style={[styles.tagline, isCompact && styles.taglineCompact]}>
              Discover, showcase and collect{'\n'}your favourite in-game items.
            </Text>
          </View>

          <View style={[styles.heroReveal, { height: heroRevealHeight }]} />

          <View style={[styles.actions, { gap: actionGap }]}>
            <SignInButton
              height={buttonHeight}
              label="Sign in"
              pending={pending === 'sign-in'}
              disabled={pending !== null && pending !== 'sign-in'}
              onPress={() => proceed('sign-in')}
            />
            <Animated.View style={pending === null ? guestPop.popStyle : null}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue as guest"
              accessibilityState={{
                busy: pending === 'guest',
                disabled: pending !== null && pending !== 'guest',
              }}
              disabled={pending !== null && pending !== 'guest'}
              onPress={() => proceed('guest')}
              {...(pending === null ? guestPop.hoverProps : {})}
              style={({ pressed }) => [
                styles.guestButton,
                pressed && styles.textButtonPressed,
                pending !== null && pending !== 'guest' && styles.dimmed,
              ]}
            >
              {pending === 'guest' ? (
                <ActivityIndicator color={rarityColors.rare} />
              ) : (
                <Text style={styles.guestLabel}>Continue as guest</Text>
              )}
            </Pressable>
            </Animated.View>
          </View>

          <Text style={styles.terms}>
            By continuing, you agree to our{' '}
            <Text style={styles.termsLink}>Terms & Privacy Policy</Text>.
          </Text>
        </View>
      </View>
    </View>
  );
}

function SignInButton({
  height,
  label,
  pending,
  disabled,
  onPress,
}: {
  height: number;
  label: string;
  pending: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const pop = useHoverPop();
  /* No pop while it is working or unavailable: a control that leans toward the
     pointer and then refuses the click is worse than one that never moved. */
  const still = disabled || pending;
  return (
    <Animated.View style={still ? null : pop.popStyle}>
    <Pressable
      {...(still ? {} : pop.hoverProps)}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: pending, disabled: disabled || pending }}
      disabled={disabled || pending}
      onPress={onPress}
      style={({ pressed }) => [
        styles.signInButton,
        { height },
        pressed && styles.buttonPressed,
        disabled && styles.dimmed,
      ]}
    >
      <LinearGradient
        colors={[accentGradient.from, rarityColors.rare]}
        start={accentGradient.start}
        end={accentGradient.end}
        style={styles.signInFill}
      >
        {pending ? (
          <ActivityIndicator color={colors.textPrimary} />
        ) : (
          <Text style={styles.signInLabel}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    width: '100%',
    height: '124%',
  },
  fullScreenOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  column: {
    maxWidth: 520,
    alignItems: 'center',
    gap: spacing.lg,
  },
  brandBlock: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandMark: {
    width: 112,
    height: 92,
  },
  brandMarkCompact: {
    width: 92,
    height: 74,
  },
  wordmark: {
    marginTop: -spacing.md,
    fontFamily: fonts.display,
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: 0,
    color: colors.textPrimary,
    textAlign: 'center',
    textShadowColor: scrim.heavy,
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 16,
  },
  wordmarkCompact: {
    fontSize: 54,
    lineHeight: 60,
  },
  tagline: {
    ...typography.body,
    maxWidth: 360,
    color: colors.textPrimary,
    fontSize: 18,
    lineHeight: 26,
    opacity: 0.88,
    textAlign: 'center',
    textShadowColor: scrim.heavy,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  taglineCompact: {
    fontSize: 16,
    lineHeight: 23,
  },
  heroReveal: {
    width: '100%',
    marginTop: -spacing.sm,
  },
  actions: {
    width: '100%',
    gap: spacing.md,
  },
  signInButton: {
    width: '100%',
    height: 58,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  signInFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInLabel: {
    ...typography.cardTitle,
    color: colors.surfaceSunken,
    fontSize: 18,
    lineHeight: 24,
  },
  guestButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestLabel: {
    ...typography.cardTitle,
    color: rarityColors.rare,
    fontSize: 16,
    lineHeight: 22,
  },
  buttonPressed: {
    opacity: interaction.pressedOpacity,
    transform: [{ scale: interaction.pressedScale }],
  },
  textButtonPressed: {
    opacity: interaction.pressedOpacity,
  },
  dimmed: {
    opacity: interaction.disabledOpacity,
  },
  terms: {
    ...typography.meta,
    maxWidth: 340,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  termsLink: {
    color: rarityColors.rare,
  },
});
