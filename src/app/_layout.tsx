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
 *   J3 Showroom        → /room/new        → /room/[id]
 *   J4 Discover collectors    → /collector/[id]
 *   J5 News & gaming updates  → /news            → /article/[id]
 *
 * `/create` is the §13.5 action sheet (Scan inventory / Create collection /
 * Create room), presented as a modal because it appears in every flow.
 *
 * The first run (§16 Q8, reversed 6 Aug) sits in front of all of it — see
 * `FirstRunGate` at the bottom of this file. It is a redirect rather than a
 * separate navigator because the app underneath is unchanged: once the run is
 * done, this layout is exactly what it was.
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
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppProvider, useApp } from '@/state/AppContext';
import { AssistantDockProvider } from '@/state/AssistantDock';
import { ThemeModeProvider, useThemeMode } from '@/theme/ThemeMode';
import { AssistantButton, TourOverlay } from '@/components';
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
    <ThemeModeProvider>
      <AppProvider>
        <AssistantDockProvider>
        <ThemedChrome />
        <FirstRunGate />
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
        {/* The first run draws its own full-bleed compositions — a native
            header over the sign-in screen would put a back chevron on the
            app's front door, pointing at nothing. */}
        <Stack.Screen name="sign-in" options={{ title: 'Sign in', headerShown: false }} />
        {/* The quiz draws its own StepperHeader, the same call the three build
            flows make — a native header on top is two back buttons. */}
        <Stack.Screen
          name="onboarding/quiz"
          options={{ title: 'Preferences', headerShown: false }}
        />
        <Stack.Screen
          name="create"
          options={{ presentation: 'modal', title: 'Create', headerShown: false }}
        />
        {/* The three build flows each draw their own nav row + stepper. A native
            header on top of that is two back buttons and two titles stacked —
            the flow chrome wins because it carries the step state. */}
        <Stack.Screen name="import" options={{ title: 'Import inventory', headerShown: false }} />
        <Stack.Screen name="news" options={{ title: 'Gaming updates' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="following" options={{ title: 'Following' }} />
        <Stack.Screen name="link-account" options={{ title: 'Connect account' }} />
        {/* Header matches the "Reports" link that leads here — a viewer should
            not have to learn that "queue" and "reports" are the same place. */}
        <Stack.Screen name="moderation" options={{ title: 'Reports' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="connections" options={{ title: 'Connections' }} />
        <Stack.Screen name="inventory" options={{ title: 'Inventory' }} />
        <Stack.Screen name="diagnostics" options={{ title: 'Foundation checks' }} />

        {/* Dynamic routes need an explicit title or the header prints "room/[id]". */}
        <Stack.Screen
          name="collection/new"
          options={{ title: 'New collection', headerShown: false }}
        />
        <Stack.Screen name="collection/[id]" options={{ title: 'Collection' }} />
        <Stack.Screen name="room/intro" options={{ title: 'Create Showroom' }} />
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
        {/* One instance for the whole app: the launcher and the panel it
            opens, fixed to the viewport rather than duplicated into each
            header. It hides itself on the immersive showroom, which owns its
            full viewport. */}
        <AssistantButton />
        {/* Last in the tree so it draws over the assistant launcher too — the
            fifth stop is about that button, and a tour card underneath the
            thing it is describing is worse than no card. */}
        <FirstRunTour />
        </AssistantDockProvider>
      </AppProvider>
    </ThemeModeProvider>
  );
}

/**
 * Keeps the route in step with `firstRunStage` — the §16 Q8 flow, in one place.
 *
 * ── Why a redirect and not a second navigator ─────────────────────────────
 * The app underneath is unchanged by the first run. Wrapping it in a
 * conditional navigator would mean the whole `Stack` above remounts the moment
 * someone signs in, which throws away any state the tabs had and costs a
 * visible flash. A redirect leaves the tree alone.
 *
 * ── Why here and not in each screen ───────────────────────────────────────
 * The same rule as the onboarding gate (§13.4): one place decides, screens do
 * not re-derive it. A sign-in screen that navigated on its own would have to
 * know whether the quiz flag is on, and the quiz would have to know about the
 * tour — three screens each holding a copy of the order, which is three places
 * to get it wrong.
 *
 * It renders nothing. It is a subscription to `firstRunStage` that happens to
 * live in the tree, and it sits inside `AppProvider` because that is where the
 * stage does.
 */
function FirstRunGate() {
  const { firstRunStage } = useApp();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    /* `replace`, never `push`: no stage of the first run may be reachable by a
       back gesture from inside the app, and finishing one must not leave it on
       the stack to swipe back to. */
    if (firstRunStage === 'sign-in') {
      if (pathname !== '/sign-in') router.replace('/sign-in');
      return;
    }

    if (firstRunStage === 'quiz') {
      if (pathname !== '/onboarding/quiz') router.replace('/onboarding/quiz');
      return;
    }

    /* 'tour' does not redirect. The tour draws over whatever is underneath —
       that is the entire idea — so it has no route to send anyone to, and
       sending them somewhere would defeat it. It renders itself from the same
       stage value. */
    if (firstRunStage === 'done' && FIRST_RUN_ROUTES.has(pathname)) {
      router.replace('/');
    }
  }, [firstRunStage, pathname, router]);

  return null;
}

/**
 * Routes nobody may be left sitting on once the run is over — a reset mid-quiz
 * and a re-sign-in would otherwise land back on the quiz with the stage saying
 * 'done'.
 */
const FIRST_RUN_ROUTES: ReadonlySet<string> = new Set(['/sign-in', '/onboarding/quiz']);

/**
 * Mounts the walkthrough when the stage says so, and nowhere else.
 *
 * The 'tour' stage has no route of its own — the whole point is that it draws
 * over the real app — so unlike the other two stages it is rendered rather than
 * redirected to. `completeTour` is the only way out, and every dismissal in the
 * overlay calls it, so it cannot reappear for the rest of the session.
 */
function FirstRunTour() {
  const { firstRunStage, completeTour } = useApp();
  if (firstRunStage !== 'tour') return null;
  return <TourOverlay onDone={completeTour} />;
}

/**
 * The status bar is the one piece of chrome the CSS variables cannot reach — it
 * is drawn by the OS, not the DOM — so it follows the mode explicitly.
 */
function ThemedChrome() {
  const { mode } = useThemeMode();
  return <StatusBar style={mode === 'light' ? 'dark' : 'light'} />;
}
