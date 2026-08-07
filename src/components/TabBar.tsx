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
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FEATURES } from '@/config/features';
import * as haptics from '@/lib/haptics';
import { useApp } from '@/state/AppContext';
import { useTourAnchor } from '@/state/TourAnchors';
import { colors, interaction, radius, spacing, typography } from '@/theme/theme';

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

function TabIcon({ icon, active, colour }: { icon: TabIcon; active: boolean; colour: string }) {
  return (
    <View style={[styles.iconIndicator, active && styles.iconIndicatorActive]}>
      <SymbolView
        name={active ? icon.active : icon.inactive}
        size={22}
        tintColor={colour}
        weight={{ ios: active ? 'semibold' : 'medium', android: medium }}
      />
    </View>
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

  const [left, right] = [TABS.slice(0, 2), TABS.slice(2)];

  function renderTab(tab: Tab) {
    // §13.4's gate, now behind FEATURES.onboardingGate (default off) — see the
    // flag for why. With it off nothing is ever locked, so the greyed styling
    // and the disabled state below simply never engage.
    const locked = FEATURES.onboardingGate && tab.gated === true && !hasImported;
    const active = pathname === tab.href;

    return (
      <Pressable
        key={tab.href}
        disabled={locked}
        onPress={() => {
          if (active) return;
          haptics.selection();
          router.navigate(tab.href);
        }}
        accessibilityRole="tab"
        accessibilityLabel={tab.label}
        /* The gate was previously visual only — greyed pixels tell a sighted
           user the tab is locked and tell a screen-reader user nothing. §13.4
           says non-interactive, and this is the half that was missing. */
        accessibilityState={{ selected: active, disabled: locked }}
        accessibilityHint={locked ? 'Import your inventory to unlock this tab' : undefined}
        style={({ pressed }) => [styles.tab, pressed && !active && styles.pressed]}
      >
        <TabIcon
          icon={tab.icon}
          active={active}
          colour={locked ? colors.border : active ? colors.accent : colors.textSecondary}
        />
        <Text style={[styles.label, active && styles.active, locked && styles.locked]}>
          {tab.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      ref={barAnchor}
      collapsable={false}
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}
      accessibilityRole="tablist"
    >
      {left.map(renderTab)}

      <Pressable
        ref={importAnchor}
        collapsable={false}
        onPress={() => {
          haptics.tap();
          router.push('/import');
        }}
        accessibilityRole="button"
        accessibilityLabel="Import inventory"
        style={styles.importTab}
      >
        {({ pressed }) => (
          <>
            <View style={[styles.importButton, pressed && styles.importButtonPressed]}>
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
            </View>
            <Text style={[styles.label, styles.active]}>Import</Text>
          </>
        )}
      </Pressable>

      {right.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 1,
  },
  iconIndicator: {
    width: 38,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  iconIndicatorActive: { backgroundColor: colors.accentMuted },
  label: {
    ...typography.meta,
    fontSize: 10,
    lineHeight: 14,
    color: colors.textTertiary,
  },
  active: { color: colors.accent },
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
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -13,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  importButtonPressed: {
    backgroundColor: colors.accentPressed,
    transform: [{ scale: 0.94 }],
  },

  pressed: { opacity: interaction.pressedOpacity },
});
