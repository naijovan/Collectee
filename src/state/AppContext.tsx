/**
 * App-wide state — PRD §13.1 (React Context + hooks; Redux is not worth the
 * setup for four days) and §13.4 (the onboarding gate).
 *
 * This provider owns exactly four things:
 *   1. Who the viewer is, and whether they have signed in this session.
 *   2. The viewer's inventory, because the onboarding gate keys off it.
 *   3. Notification unread state for the Home header.
 *   4. How far through the first run they are (§16 Q8, reversed 6 Aug).
 *
 * Flow-specific state belongs in the flow, not here. If you are tempted to add
 * a field for your own flow, that is a sign it should be local — this file is a
 * merge-conflict magnet and it is shared.
 *
 * The first run earns its place by the same test the onboarding gate passes:
 * it is read by the root layout and by two screens in different trees, and
 * every one of them must agree. Two of them disagreeing is a demo that shows
 * the quiz twice.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';

import { FEATURES, SKIP_FIRST_RUN } from '@/config/features';
import type { CollectorIntensity } from '@/domain/onboarding';
import { VIEWER_ID } from '@/fixtures/users';
import { inventoryService, newsService, socialService } from '@/services';
import type { OwnedItemView } from '@/services';
import type { User } from '@/types';

/**
 * Where the viewer is in the first run — ONE derived value, not three booleans
 * for each caller to recombine.
 *
 * The onboarding gate is the precedent: §13.4 says implement it "from a single
 * `hasImported` flag in context. Do not re-derive it." Same reasoning, and a
 * stronger case, because this one has an order. A screen that checked
 * `!quizDone` without also checking `signedIn` would render the quiz over the
 * sign-in screen.
 *
 * 'done' covers both the returning user and every flag being off, so the
 * ordinary path through the app never asks which of those it is.
 */
export type FirstRunStage = 'sign-in' | 'quiz' | 'tour' | 'done';

/**
 * How the viewer arrived.
 *
 * `guest` is the "Continue as guest" path: a real, browsable session that owns
 * nothing. It is NOT a lesser sign-in — Home, Explore, news and every other
 * collector's public work are all fully visible, because a guest who sees a
 * wall learns nothing about the product. What a guest does not have is data of
 * their own.
 */
export type ViewerMode = 'member' | 'guest';

/** What the first onboarding step asks for. Session-only, like every write here. */
export interface AccountDetails {
  displayName: string;
  handle: string;
  /** A string, not a number: the picker offers "65" as "65 or older". */
  age: string;
  email: string;
  bio: string;
}

interface AppState {
  /** The signed-in user. Never null — the demo opens logged-in (§16 Q8). */
  viewer: User | null;
  viewerId: string;
  /**
   * Read this rather than comparing `viewerId` to a constant. Whether a screen
   * should offer "create an account" is a question about the SESSION, and
   * spelling it as an id comparison puts the same rule in twenty places.
   */
  mode: ViewerMode;

  inventory: OwnedItemView[];
  /** Item ids the viewer owns. Cheap membership checks for every flow. */
  ownedItemIds: ReadonlySet<string>;

  /**
   * §13.4 ONBOARDING GATE — Collections and Profile tabs render greyed and
   * non-interactive until the first import completes. This forces the
   * activation event and prevents an empty-profile first impression.
   *
   * Implement the gate in TabBar from THIS single flag. Do not re-derive it.
   */
  hasImported: boolean;

  unreadNotifications: number;

  loading: boolean;

  /**
   * FIRST RUN — the single source of truth, same rule as `hasImported`. Read
   * this; do not rebuild it from the fields below.
   */
  firstRunStage: FirstRunStage;

  /**
   * Self-reported collector intensity from quiz step 3. Null when the quiz was
   * skipped or never ran, which every reader must handle — a skipped quiz is
   * the common case, not an edge case.
   */
  intensity: CollectorIntensity | null;

  /**
   * Choose an avatar for this session.
   *
   * Writes the overlay in `socialService` and re-reads the viewer, so the new
   * face appears on every surface at once rather than only where the choice was
   * made. Session-only — `User` is the merge contract and a picked face is not
   * a schema change (§12.1, §12.3).
   */
  chooseAvatar: (avatarId: string) => Promise<void>;

  /**
   * Set the name this account shows, chosen at sign-up.
   *
   * A signed-in user inherits the demo account's inventory, collections and
   * showrooms — that is what makes first run worth looking at — but being told
   * they are Jovan undoes it. Same session lifetime as the face.
   */
  chooseDisplayName: (displayName: string) => Promise<void>;

  /**
   * Everything sign-up asks for, in one call.
   *
   * Name and handle overlay the seeded user, so they reach every screen that
   * already reads `viewer` — the Home greeting, the profile header, comment
   * authorship — without any of those screens learning about sign-up.
   *
   * Age and email do NOT go on `User`. That type is the team's merge contract
   * (§12.3) and widening it for two fields only this screen writes and only
   * Profile reads would be a schema change for a session detail. They live
   * here instead, with the same session lifetime as the rest.
   */
  setAccountDetails: (details: AccountDetails) => Promise<void>;
  /** What sign-up collected. Null until it runs, and for guests always. */
  accountDetails: AccountDetails | null;

  /** Sign-in succeeded. Mocked: nothing authenticates, any input gets here. */
  signIn: () => void;
  /**
   * "Continue as guest" — into the app with no account.
   *
   * A separate entry point rather than a flag on `signIn`, because the two do
   * genuinely different things: this one also switches which id every service
   * call is made against, and conflating them is how the guest path ends up
   * quietly reading the demo account's data.
   */
  continueAsGuest: () => void;
  /**
   * A guest deciding to make an account.
   *
   * Not `router.push('/sign-in')` — that route is a door someone has already
   * walked through, and pushing it puts the front of the app on top of the
   * screen they were reading. This changes `firstRunStage` instead and lets
   * `FirstRunRouter` do the navigating, which is the same path the real
   * sign-in takes.
   *
   * It also REOPENS the quiz and the tour. `continueAsGuest` closed both,
   * because they ask someone to invest in an account they had just declined;
   * now that they are making one, the questions apply again — and landing
   * straight on a personalised feed they never answered for is the worse end.
   */
  createAccount: () => void;
  /** Quiz finished or skipped. Intensity is null when skipped. */
  completeQuiz: (intensity: CollectorIntensity | null) => void;
  /** Tour finished, dismissed or declined — all three end it for the session. */
  completeTour: () => void;
  /**
   * Show the walkthrough again, from Settings.
   *
   * The tour never auto-repeats, so this is the only way back to it — which is
   * the whole reason help has an entry for it. Deliberately does not touch
   * sign-in or the quiz: someone asking to see the tour again is not asking to
   * be signed out.
   */
  replayTour: () => void;

  /** Call after a scan import so every screen sees the new items. */
  refreshInventory: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  /** Escape hatch for demoing the pre-import state without restarting the app. */
  resetOnboardingGate: () => void;
  /**
   * Back to the front door: signed out, quiz unanswered, tour unseen, and the
   * quiz's followed-games/topics overlays cleared.
   *
   * Required for rehearsal — the first run is the one flow you cannot practise
   * twice without it, because there is no persistence to clear by other means
   * (§12.1) and the alternative is reloading the app between takes.
   */
  resetFirstRun: () => void;
}

/**
 * First-run persistence.
 *
 * `localStorage` on web and nothing on native — Expo Go has no synchronous
 * storage, and an async read here would mean a frame where the app does not yet
 * know whether to show the sign-in screen, which is exactly the flash the
 * lazy-initialised state above exists to avoid. Native keeps the previous
 * per-launch behaviour.
 */
const FIRST_RUN_PREFIX = 'collectee.firstRun.';

function firstRunRead(key: string): boolean | null {
  if (Platform.OS !== 'web') return null;
  try {
    const raw = globalThis.localStorage?.getItem(FIRST_RUN_PREFIX + key);
    return raw === null || raw === undefined ? null : raw === 'true';
  } catch {
    // Private browsing throws on access. Falling through to the default is
    // correct: the first run simply runs again.
    return null;
  }
}

function firstRunWrite(key: string, value: boolean) {
  if (Platform.OS !== 'web') return;
  try {
    globalThis.localStorage?.setItem(FIRST_RUN_PREFIX + key, String(value));
  } catch {
    // Non-fatal — the flag still holds for this session.
  }
}

function firstRunClear() {
  if (Platform.OS !== 'web') return;
  try {
    for (const key of ['signedIn', 'guest', 'quizDone', 'tourDone']) {
      globalThis.localStorage?.removeItem(FIRST_RUN_PREFIX + key);
    }
  } catch {
    // Non-fatal.
  }
}

/**
 * The guest's id, and the reason it is not in `fixtures/users`.
 *
 * A seeded user would show up everywhere seeded users show up — the Explore
 * roster, collector matching, comment authors — so the app would recommend the
 * guest to themselves. `validate-fixtures` would also demand a distinct roster
 * face for an account that should have none.
 *
 * Being an id nothing is keyed to is exactly what makes this work. Every
 * service already filters by `userId`, so a guest gets an empty inventory,
 * empty collections and empty showrooms out of the existing queries, with no
 * screen needing to know why. That is twenty screens' worth of special-casing
 * that does not have to exist.
 */
export const GUEST_ID = 'user-guest';

/**
 * Built here rather than fetched: `socialService.getUser` reads the fixtures
 * and would return null for an id that is deliberately absent from them.
 *
 * No avatar id, on purpose — `Avatar` falls back to initials, which is the
 * right look for an account that has not been made yet.
 */
const GUEST_VIEWER: User = {
  id: GUEST_ID,
  handle: 'guest',
  displayName: 'Guest',
  avatar: '',
  bio: '',
  followedGames: [],
  isAccountVerified: false,
};

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<User | null>(null);
  const [inventory, setInventory] = useState<OwnedItemView[]>([]);
  const [unreadNotifications, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gateOverride, setGateOverride] = useState(false);

  /**
   * Starts signed in when there is no sign-in step to take, rather than signing
   * in on mount — the sign-in route then never mounts at all and there is no
   * frame where it could flash before a redirect takes it away.
   */
  const [signedIn, setSignedIn] = useState(
    () => firstRunRead('signedIn') ?? !(FEATURES.firstRunAuth && !SKIP_FIRST_RUN),
  );
  /**
   * Persisted beside `signedIn` and cleared by the same `resetFirstRun`, so a
   * rehearsal of the guest path survives a refresh and is one tap from being
   * undone. `firstRunRead` stores booleans, so this is "did they choose guest"
   * rather than the mode string itself.
   */
  const [isGuest, setIsGuest] = useState(() => firstRunRead('guest') ?? false);
  const [quizDone, setQuizDone] = useState(() => firstRunRead('quizDone') ?? false);
  const [tourDone, setTourDone] = useState(() => firstRunRead('tourDone') ?? false);

  /**
   * Persisted so a reload does not put you back at the front door.
   *
   * The first run is a one-time flow by definition; making it survive a refresh
   * is the difference between developing on this app and signing in twenty
   * times a day. `resetFirstRun` clears the same keys, so the rehearsal escape
   * hatch still works — it just now has something real to clear.
   */
  useEffect(() => {
    firstRunWrite('signedIn', signedIn);
  }, [signedIn]);
  useEffect(() => {
    firstRunWrite('guest', isGuest);
  }, [isGuest]);
  useEffect(() => {
    firstRunWrite('quizDone', quizDone);
  }, [quizDone]);
  useEffect(() => {
    firstRunWrite('tourDone', tourDone);
  }, [tourDone]);
  const [intensity, setIntensity] = useState<CollectorIntensity | null>(null);
  const [accountDetails, setDetails] = useState<AccountDetails | null>(null);

  const mode: ViewerMode = isGuest ? 'guest' : 'member';
  /**
   * ONE id, derived once, used for every service call below and handed to every
   * screen. Deriving it here is what makes "a guest owns nothing" a property of
   * the session rather than a rule each screen has to remember.
   */
  const activeId = isGuest ? GUEST_ID : VIEWER_ID;

  const refreshInventory = useCallback(async () => {
    const next = await inventoryService.getInventory(activeId);
    setInventory(next);
    /* An import is the activation event the gate exists to force, so completing
       one has to open the gate — including after `resetOnboardingGate`, which
       is the only way anyone sees the closed state in the first place. Without
       this the override is a one-way latch and the demo dead-ends: reset the
       gate, run the import, and Collections stays grey with the new collection
       behind it. */
    setGateOverride(false);
  }, [activeId]);

  const chooseAvatar = useCallback(async (avatarId: string) => {
    /* A guest has no account to attach a face to. Silently ignoring beats
       writing an overlay for an id that is thrown away on sign-out. */
    if (isGuest) return;
    await socialService.setAvatar(VIEWER_ID, avatarId);
    /* Re-read rather than patching local state: the overlay is applied on the
       way out of the service, so this is the same path every other screen uses
       and cannot drift from it. */
    setViewer(await socialService.getUser(VIEWER_ID));
  }, [isGuest]);

  const chooseDisplayName = useCallback(
    async (displayName: string) => {
      /* Nothing to name — a guest's identity is thrown away on sign-out. */
      if (isGuest) return;
      await socialService.setDisplayName(VIEWER_ID, displayName);
      setViewer(await socialService.getUser(VIEWER_ID));
    },
    [isGuest],
  );

  const setAccountDetails = useCallback(
    async (details: AccountDetails) => {
      if (isGuest) return;
      setDetails(details);
      await socialService.setIdentity(VIEWER_ID, {
        displayName: details.displayName,
        handle: details.handle,
        bio: details.bio,
      });
      /* Re-read rather than patching: the overlay is applied on the way out of
         the service, so this is the same path every other screen uses. */
      setViewer(await socialService.getUser(VIEWER_ID));
    },
    [isGuest],
  );

  const markNotificationsRead = useCallback(async () => {
    if (isGuest) return;
    await socialService.markAllRead(VIEWER_ID);
    setUnread(0);
  }, [isGuest]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      /* Not a fetch: `GUEST_ID` is absent from the fixtures on purpose, so
         `getUser` would return null and the header would render a nameless
         account. Everything else a guest owns is genuinely empty. */
      if (isGuest) {
        setViewer(GUEST_VIEWER);
        setInventory([]);
        setUnread(0);
        setLoading(false);
        return;
      }

      const [user, items, unread] = await Promise.all([
        socialService.getUser(VIEWER_ID),
        inventoryService.getInventory(VIEWER_ID),
        socialService.getUnreadCount(VIEWER_ID),
      ]);
      if (cancelled) return;
      setViewer(user);
      setInventory(items);
      setUnread(unread);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [isGuest]);

  const ownedItemIds = useMemo(
    () => new Set(inventory.map((entry) => entry.item.id)),
    [inventory],
  );

  /**
   * Each stage is skipped by its own flag, so any combination is coherent: quiz
   * off sends sign-in straight to the tour, tour off ends the run at the quiz,
   * everything off never leaves 'done'. That is what "flags off = today's
   * behaviour" has to mean in practice — not just all three off, but any of
   * them, in any mix, on the morning of the 8th.
   */
  const firstRunStage = useMemo<FirstRunStage>(() => {
    /* The developer escape has to short-circuit the WHOLE run, not just the
       sign-in step. Gating only the initial `signedIn` would leave the quiz
       showing on every reload on a machine whose whole reason for setting this
       was not to see the first run — and the flag is named for what it does. */
    if (SKIP_FIRST_RUN) return 'done';

    if (!signedIn) return 'sign-in';
    if (FEATURES.firstRunQuiz && !quizDone) return 'quiz';
    if (FEATURES.firstRunTour && !tourDone) return 'tour';
    return 'done';
  }, [signedIn, quizDone, tourDone]);

  const signIn = useCallback(() => {
    setIsGuest(false);
    setSignedIn(true);
    /* A first-time sign-in should meet the pre-import app, or the gate — the
       §13.4 activation mechanic — is invisible to anyone watching the flow it
       was designed for. This is also what makes the whole demo one unbroken
       run: sign in, answer the quiz, and the very next thing is the import the
       greyed-out tabs are asking for. */
    setGateOverride(true);
  }, []);

  /**
   * Guests skip the rest of the first run.
   *
   * The quiz personalises a feed and the tour points at tabs a guest has no
   * data in, so both would be asking someone to invest in an account they have
   * just declined to make. Straight to the app is the honest route.
   */
  const continueAsGuest = useCallback(() => {
    setIsGuest(true);
    setSignedIn(true);
    setQuizDone(true);
    setTourDone(true);
    setGateOverride(true);
  }, []);

  const createAccount = useCallback(() => {
    setIsGuest(false);
    setSignedIn(true);
    setQuizDone(false);
    setTourDone(false);
    setGateOverride(true);
  }, []);

  const completeQuiz = useCallback((next: CollectorIntensity | null) => {
    setIntensity(next);
    setQuizDone(true);
  }, []);

  const completeTour = useCallback(() => setTourDone(true), []);

  /* Only reachable when the tour flag is on — with it off the stage skips
     straight past 'tour' and this would be a control that does nothing, so
     Settings hides its row rather than relying on this to no-op. */
  const replayTour = useCallback(() => setTourDone(false), []);

  const resetFirstRun = useCallback(() => {
    // Clear the persisted copy first: the state writes below would otherwise
    // race the effects and leave a stale `true` behind.
    firstRunClear();
    setSignedIn(false);
    setIsGuest(false);
    setQuizDone(false);
    setTourDone(false);
    setIntensity(null);
    setDetails(null);
    setGateOverride(false);
    /* The quiz's answers live in newsService's session overlays, not here, so
       resetting only this component's state would leave the previous run's
       followed games and topics in place — and the second rehearsal take would
       show the first take's answers already applied. */
    void newsService.resetSessionFollowing(VIEWER_ID);
    /* And the chosen face, for the same reason: the second rehearsal run must
       start from the seeded avatar, not the one the first run picked. */
    void socialService.resetSessionAvatars().then(async () => {
      setViewer(await socialService.getUser(VIEWER_ID));
    });
  }, []);

  const value = useMemo<AppState>(
    () => ({
      viewer,
      viewerId: activeId,
      mode,
      inventory,
      ownedItemIds,
      hasImported: !gateOverride && inventory.length > 0,
      unreadNotifications,
      loading,
      firstRunStage,
      intensity,
      chooseAvatar,
      chooseDisplayName,
      setAccountDetails,
      accountDetails,
      signIn,
      continueAsGuest,
      createAccount,
      completeQuiz,
      completeTour,
      replayTour,
      refreshInventory,
      markNotificationsRead,
      resetOnboardingGate: () => setGateOverride(true),
      resetFirstRun,
    }),
    [
      viewer,
      activeId,
      mode,
      inventory,
      ownedItemIds,
      gateOverride,
      unreadNotifications,
      loading,
      firstRunStage,
      intensity,
      chooseAvatar,
      chooseDisplayName,
      setAccountDetails,
      accountDetails,
      signIn,
      continueAsGuest,
      createAccount,
      completeQuiz,
      completeTour,
      replayTour,
      refreshInventory,
      markNotificationsRead,
      resetFirstRun,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}
