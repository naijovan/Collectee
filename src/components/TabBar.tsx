/**
 * TabBar — PRD §13.4 section 8 and the onboarding gate.
 *
 * Home · Explore · **Import** (raised blue action) · Collections · Profile
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  THE GATE LIVES HERE AND NOWHERE ELSE.                              │
 * │  "Collections and Profile tabs render greyed and non-interactive    │
 * │   until the first import completes. Implement it in TabBar from a   │
 * │   single `hasImported` flag in context." — §13.4                    │
 * │  Do not re-derive the gate in a screen.                             │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Import is not a tab. It opens the action sheet from §13.5 (Scan inventory /
 * Create collection / Create room) and appears in every flow.
 *
 * Icons use the native symbol libraries already provided by Expo: SF Symbols
 * on Apple platforms and Material Symbols on Android/web. This gives the bar
 * one optical system without adding another icon dependency.
 */

import type { SFSymbol } from 'expo-symbols';
import { SymbolView, type AndroidSymbol } from 'expo-symbols';
import medium from 'expo-symbols/androidWeights/medium';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FEATURES } from '@/config/features';
import * as haptics from '@/lib/haptics';
import { useApp } from '@/state/AppContext';
import { useTourAnchor } from '@/state/TourAnchors';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { accentGlow, colors, fonts, interaction, motion, radius, spacing, tabBarGlass, tabBarWash, typography } from '@/theme/theme';

import { AccentFill } from './primitives';

interface Tab {
  href: '/' | '/explore' | '/collections' | '/profile';
  label: string;
  icon: TabIcon;
  /** True for the two tabs behind the onboarding gate. */
  gated?: boolean;
}

interface PlatformSymbol {
  ios: SFSymbol;
  android: AndroidSymbol;
  web: AndroidSymbol;
}

interface TabIcon {
  active: PlatformSymbol;
  inactive: PlatformSymbol;
}

const TABS: readonly Tab[] = [
  {
    href: '/',
    label: 'Home',
    icon: {
      active: { ios: 'house.fill', android: 'home_filled', web: 'home_filled' },
      inactive: { ios: 'house', android: 'home', web: 'home' },
    },
  },
  {
    href: '/explore',
    label: 'Explore',
    icon: {
      active: { ios: 'safari.fill', android: 'explore', web: 'explore' },
      inactive: { ios: 'safari', android: 'explore', web: 'explore' },
    },
  },
  {
    href: '/collections',
    label: 'Collections',
    icon: {
      active: {
        ios: 'rectangle.stack.fill',
        android: 'collections_bookmark',
        web: 'collections_bookmark',
      },
      inactive: {
        ios: 'rectangle.stack',
        android: 'collections_bookmark',
        web: 'collections_bookmark',
      },
    },
    gated: true,
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: {
      active: {
        ios: 'person.crop.circle.fill',
        android: 'account_circle',
        web: 'account_circle',
      },
      inactive: {
        ios: 'person.crop.circle',
        android: 'account_circle',
        web: 'account_circle',
      },
    },
    gated: true,
  },
];

function TabIcon({
  icon,
  active,
  colour,
  lift,
}: {
  icon: TabIcon;
  active: boolean;
  colour: string;
  /** Animated 0-1. Drives careerlingo's `.nav-item:hover svg { translateY(-2px) }`. */
  lift: Animated.Value;
}) {
  return (
    /* No pill behind the icon any more — the whole cell carries the selection,
       and a tinted box inside a tinted box read as two nested states. */
    <Animated.View
      style={[
        styles.iconIndicator,
        {
          transform: [
            { translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
          ],
        },
      ]}
    >
      <SymbolView
        name={active ? icon.active : icon.inactive}
        size={23}
        tintColor={colour}
        weight={{ ios: active ? 'semibold' : 'medium', android: medium }}
      />
    </Animated.View>
  );
}

/**
 * One destination in the bar, owning its own hover.
 *
 * Split out of `TabBar` because the hover value has to be per tab — a single
 * shared one would lift every icon whenever the pointer entered any cell.
 *
 * The motion is careerlingo's `.nav-item:hover`: a faint accent tint behind the
 * cell and the icon rising a couple of pixels. Both are pointer-only; touch
 * never fires them, which is correct — a finger gets the press state instead.
 */
function NavTab({
  tab,
  active,
  locked,
  onPress,
}: {
  tab: Tab;
  active: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const lift = useRef(new Animated.Value(0)).current;
  const [hovered, setHovered] = useState(false);

  const animate = useCallback(
    (to: number) => {
      if (reduceMotion) {
        lift.setValue(0);
        return;
      }
      Animated.timing(lift, {
        toValue: to,
        duration: motion.fast,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    },
    [lift, reduceMotion],
  );

  return (
    <Pressable
      disabled={locked}
      onPress={() => {
        /* Re-tapping the current tab is a no-op; navigating to where you already
           are would replay the transition for nothing. */
        if (active) return;
        onPress();
      }}
      onHoverIn={() => {
        setHovered(true);
        animate(1);
      }}
      onHoverOut={() => {
        setHovered(false);
        animate(0);
      }}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      /* The gate was previously visual only — greyed pixels tell a sighted user
         the tab is locked and tell a screen-reader user nothing. §13.4 says
         non-interactive, and this is the half that was missing. */
      accessibilityState={{ selected: active, disabled: locked }}
      accessibilityHint={locked ? 'Import your inventory to unlock this tab' : undefined}
      style={({ pressed }) => [
        styles.tab,
        /* Hover tint sits UNDER the selected tint, so hovering the active tab
           does not double it. */
        hovered && !active && !locked && styles.tabHovered,
        active && styles.tabActive,
        /* The reference's `.nav-item:active { transform: scale(0.97) }`. */
        pressed && { transform: [{ scale: 0.97 }] },
        pressed && !active && styles.pressed,
      ]}
    >
      <TabIcon
        icon={tab.icon}
        active={active}
        colour={locked ? colors.border : active ? colors.accent : colors.textSecondary}
        lift={lift}
      />
      {/*
        Every tab keeps its label.

        Hiding all but the selected one was tried and reverted: it buys width
        that is only ever scarce at ~390px, and the app is demoed in a desktop
        browser where all five have room. A destination you cannot name until
        you have already tapped it is a worse trade than a tight phone layout.
      */}
      <Text
        style={[styles.label, active && styles.active, locked && styles.locked]}
        numberOfLines={1}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

export function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { hasImported } = useApp();
  const insets = useSafeAreaInsets();
  /* Two targets for the first-run walkthrough. A ref each, no wrapper — the
     bar is a flex row and the tabs are `flex: 1`, so an extra View here would
     change the layout purely so the tour has something to hold. Inert when the
     tour is not mounted (see `TourAnchors`), so nothing in this component is
     now conditional on a §14-cuttable feature. */
  const barAnchor = useTourAnchor('tabbar');
  const importAnchor = useTourAnchor('tab-import');

  /** Hover response for the raised Import action. Pointer-only, like the tabs. */
  const reduceMotion = useReduceMotion();
  const importLift = useRef(new Animated.Value(0)).current;
  const importHover = useCallback(
    (to: number) => {
      if (reduceMotion) {
        importLift.setValue(0);
        return;
      }
      Animated.spring(importLift, {
        toValue: to,
        friction: motion.spring.friction,
        tension: motion.spring.tension,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    },
    [importLift, reduceMotion],
  );

  const [left, right] = [TABS.slice(0, 2), TABS.slice(2)];

  function renderTab(tab: Tab) {
    // §13.4's gate, now behind FEATURES.onboardingGate (default off) — see the
    // flag for why. With it off nothing is ever locked, so the greyed styling
    // and the disabled state below simply never engage.
    const locked = FEATURES.onboardingGate && tab.gated === true && !hasImported;
    return (
      <NavTab
        key={tab.href}
        tab={tab}
        active={pathname === tab.href}
        locked={locked}
        onPress={() => {
          haptics.selection();
          router.navigate(tab.href);
        }}
      />
    );
  }

  return (
    <View
      ref={barAnchor}
      collapsable={false}
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, spacing.sm) },
        /* Web only. `backdropFilter` is a CSS property react-native-web passes
           through but React Native's types do not know, because on native it is
           genuinely not a thing — hence the cast rather than a type widening. */
        Platform.OS === 'web'
          ? ({ backdropFilter: tabBarGlass.blur } as unknown as ViewStyle)
          : null,
      ]}
      accessibilityRole="tablist"
    >
      {/* A faint violet wash so the bar is not a flat slab. Not the button ramp
          — see `tabBarWash` for why the import action would vanish into it. */}
      <LinearGradient
        colors={[...tabBarWash]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.barWash}
        pointerEvents="none"
      />
      {left.map(renderTab)}

      <Pressable
        ref={importAnchor}
        collapsable={false}
        onPress={() => {
          haptics.tap();
          router.push('/import');
        }}
        onHoverIn={() => importHover(1)}
        onHoverOut={() => importHover(0)}
        accessibilityRole="button"
        accessibilityLabel="Import inventory"
        style={styles.importTab}
      >
        {({ pressed }) => (
          <>
            {/* Rises and grows on hover, where the tabs only rise. It is the
                primary action in the bar and already carries a gradient and a
                glow — a matching-but-larger response keeps that hierarchy in
                the motion as well as the paint. */}
            <Animated.View
              style={[
                styles.importButton,
                pressed && styles.importButtonPressed,
                {
                  transform: [
                    { translateY: importLift.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
                    { scale: importLift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
                  ],
                },
              ]}
            >
              {/* Same gradient as PrimaryButton. This sits on every screen, so
                  leaving it flat would make the one button the user sees most
                  the odd one out. */}
              <AccentFill pressed={pressed} />
              <SymbolView
                name={{
                  ios: 'tray.and.arrow.down.fill',
                  android: 'download',
                  web: 'download',
                }}
                size={23}
                tintColor={colors.textOnAccent}
                weight={{ ios: 'semibold', android: medium }}
              />
            </Animated.View>
            <Text style={[styles.label, styles.active]}>Import</Text>
          </>
        )}
      </Pressable>

      {right.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * A floating rounded card, not a slab welded to the bottom edge.
   *
   * Ported from careerlingo's `.main-nav.bottom-nav`, which is the reference
   * Jovan asked for: inset from the screen edges, heavily rounded, one hairline
   * border and a soft shadow. The inset is what does the work — a bar with air
   * around it reads as a control sitting ON the app, while an edge-to-edge one
   * reads as the chrome the app is mounted in.
   *
   * It stays IN the layout flow rather than `position: fixed` like the original.
   * The web version can afford fixed because the page pads for it; here the tab
   * screens size their scroll content against a bar that occupies space, and
   * lifting it out would hide the last row of every list behind it.
   *
   * 28 radius and 12 padding are careerlingo's numbers, kept as-is.
   */
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    /* Translucent, not solid — see `tabBarGlass`. The blur that makes it read
       as glass rather than as a see-through panel is applied separately below,
       because `backdropFilter` is web-only and not in RN's ViewStyle. */
    backgroundColor: tabBarGlass.background,
    marginHorizontal: 14,
    marginBottom: 10,
    borderRadius: 28,
    borderWidth: 1,
    /* Brighter than `border`. A glass edge catches light along its rim, and
       that highlight is most of what sells the material — the flat border
       colour made it look like a cut-out instead. */
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 12,
    /* The soft lift that separates the card from the content behind it. */
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  /**
   * A rounded cell per tab — careerlingo's `.nav-item`.
   *
   * Transparent until it is the active one, so the row reads as one control
   * with a selection inside it rather than five separate buttons.
   */
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 16,
    paddingVertical: 6,
  },
  /**
   * The selection. `accentMuted` is the app's own token for accent-at-low-alpha
   * and lands in the same place as the reference's `rgba(47,128,237,0.13)` —
   * borrowing the hex would have put a raw colour outside theme.ts.
   */
  tabActive: { backgroundColor: colors.accentMuted },
  /** careerlingo's `.nav-item:hover` — accent at roughly half the selected tint. */
  tabHovered: { backgroundColor: 'rgba(47,107,255,0.08)' },
  iconIndicator: {
    width: 38,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  label: {
    ...typography.meta,
    /* 11, not 12. At 390px each of the five cells is ~68px, and "Collections"
       sets to roughly 66 at 11pt and ~72 at 12 — the extra point is what pushed
       it into truncating. On a desktop window either fits; this is sized for
       the tightest case so the bar never has to hide anything. */
    fontSize: 11,
    lineHeight: 14,
    color: colors.textTertiary,
  },
  /* Weight as well as colour. The reference goes 600 -> 700 on selection, and
     colour alone is a weak signal at 11px. */
  active: { color: colors.accent, fontFamily: fonts.bodySemiBold },
  /** §13.4 — greyed AND non-interactive, not just greyed. */
  locked: { color: colors.border },

  importTab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 1,
  },
  importButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    /* Clips AccentFill to the circle. Without it the gradient draws a square. */
    overflow: 'hidden',
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
    /* Raised out of the bar, so it gets the same halo as the assistant bubble —
       both float over content and need something separating them from it. */
    ...accentGlow,
  },
  /** Behind the tabs, inside the bar. */
  /** Rounded to match the card, or it paints square corners over it. */
  barWash: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 28 },
  importButtonPressed: {
    /* No colour here any more — AccentFill inverts its ramp on press, which is
       the same signal without fighting the gradient drawn over this. */
    transform: [{ scale: 0.94 }],
  },

  pressed: { opacity: interaction.pressedOpacity },
});
