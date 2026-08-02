/**
 * Root layout. Deliberately minimal — UI is deferred until the data and feature
 * layer is settled (team decision, 2 Aug).
 *
 * When the tab bar lands (§13.4), it goes in a `(tabs)` group here:
 *   Home · Explore · + (raised blue circle) · Collections · Profile
 * with the onboarding gate reading `hasImported` from AppProvider — Collections
 * and Profile stay greyed and non-interactive until the first import completes.
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppProvider } from '@/state/AppContext';
import { colors } from '@/theme/theme';

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Collectee — Foundation' }} />
      </Stack>
    </AppProvider>
  );
}
