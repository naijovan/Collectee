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
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="create"
          options={{ presentation: 'modal', title: 'Create', headerShown: false }}
        />
        <Stack.Screen name="import" options={{ title: 'Import inventory' }} />
        <Stack.Screen name="news" options={{ title: 'Gaming updates' }} />
        <Stack.Screen name="link-account" options={{ title: 'Connect account' }} />
        {/* Header matches the "Reports" link that leads here — a viewer should
            not have to learn that "queue" and "reports" are the same place. */}
        <Stack.Screen name="moderation" options={{ title: 'Reports' }} />
        <Stack.Screen name="diagnostics" options={{ title: 'Foundation checks' }} />

        {/* Dynamic routes need an explicit title or the header prints "room/[id]". */}
        <Stack.Screen name="collection/new" options={{ title: 'New collection' }} />
        <Stack.Screen name="collection/[id]" options={{ title: 'Collection' }} />
        <Stack.Screen name="room/intro" options={{ title: 'Create Collection Room' }} />
        <Stack.Screen name="room/new" options={{ title: 'New room' }} />
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
