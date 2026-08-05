/**
 * Root layout.
 *
 * The `(tabs)` group is the app (§13.4: Home · Explore · + · Collections ·
 * Profile). Everything else is a stack screen pushed over it, which maps
 * directly to the flow map in §10 — each journey is a route group, not a
 * modal-within-a-tab:
 *
 *   J1 Import inventory       → /import
 *   J2 Create & publish       → /collection/new  → /collection/[id]
 *   J3 Collection Room        → /room/new        → /room/[id]
 *   J4 Discover collectors    → /collector/[id]
 *   J5 News & gaming updates  → /news            → /article/[id]
 *
 * `/create` is the §13.5 action sheet (Scan inventory / Create collection /
 * Create room), presented as a modal because it appears in every flow.
 */

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppProvider } from '@/state/AppContext';
import { colors, fonts } from '@/theme/theme';

/* Hold the native splash until the fonts resolve, so the first frame is already
   in Space Grotesk. Without this the app renders a system-font frame and then
   reflows every title — the exact "unfinished" tell we are trying to remove.
   The fonts are bundled assets, not a network fetch, so this is a few frames. */
SplashScreen.preventAutoHideAsync().catch(() => {
  /* Already hidden, or unsupported on web. Not a failure worth surfacing. */
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  /* Hide on error too. A missing font should degrade to the system face, not
     leave the user staring at a splash screen forever. */
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <AppProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontFamily: fonts.display, fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="create"
          options={{ presentation: 'modal', title: 'Create', headerShown: false }}
        />
        {/* The three build flows each draw their own nav row + stepper. A native
            header on top of that is two back buttons and two titles stacked —
            the flow chrome wins because it carries the step state. */}
        <Stack.Screen name="import" options={{ title: 'Import inventory', headerShown: false }} />
        <Stack.Screen name="news" options={{ title: 'Gaming updates' }} />
        <Stack.Screen name="link-account" options={{ title: 'Connect account' }} />
        {/* Header matches the "Reports" link that leads here — a viewer should
            not have to learn that "queue" and "reports" are the same place. */}
        <Stack.Screen name="moderation" options={{ title: 'Reports' }} />
        <Stack.Screen name="diagnostics" options={{ title: 'Foundation checks' }} />

        {/* Dynamic routes need an explicit title or the header prints "room/[id]". */}
        <Stack.Screen
          name="collection/new"
          options={{ title: 'New collection', headerShown: false }}
        />
        <Stack.Screen name="collection/[id]" options={{ title: 'Collection' }} />
        <Stack.Screen name="room/intro" options={{ title: 'Create Collection Room' }} />
        <Stack.Screen name="room/new" options={{ title: 'New room', headerShown: false }} />
        <Stack.Screen name="room/[id]" options={{ title: 'Room' }} />
        {/* The immersive room draws its own overlay controls edge to edge, so a
            stack header would sit on top of the scene. */}
        <Stack.Screen
          name="room/immersive/[id]"
          options={{ title: 'Room', headerShown: false }}
        />
        <Stack.Screen name="collector/[id]" options={{ title: 'Collector' }} />
        <Stack.Screen name="community/[id]" options={{ title: 'Community' }} />
        <Stack.Screen name="thread/[id]" options={{ title: 'Thread' }} />
        <Stack.Screen name="article/[id]" options={{ title: 'Article' }} />
      </Stack>
    </AppProvider>
  );
}
