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

interface AppState {
  /** The signed-in user. Never null — the demo opens logged-in (§16 Q8). */
  viewer: User | null;
  viewerId: string;

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

  /** Sign-in succeeded. Mocked: nothing authenticates, any input gets here. */
  signIn: () => void;
  /** Quiz finished or skipped. Intensity is null when skipped. */
  completeQuiz: (intensity: CollectorIntensity | null) => void;
  /** Tour finished, dismissed or declined — all three end it for the session. */
  completeTour: () => void;

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

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<User | null>(null);
  const [inventory, setInventory] = useState<OwnedItemView[]>([]);
  const [unreadNotifications, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gateOverride, setGateOverride] = useState(false);

  /**
   * The first run is skipped outright when auth is off or a developer asked for
   * it, rather than started and immediately completed. Same end state, but this
   * way the sign-in route never mounts and there is no frame where it could
   * flash before a redirect takes it away.
   */
  const firstRunEnabled = FEATURES.firstRunAuth && !SKIP_FIRST_RUN;
  const [signedIn, setSignedIn] = useState(!firstRunEnabled);
  const [quizDone, setQuizDone] = useState(false);
  const [tourDone, setTourDone] = useState(false);
  const [intensity, setIntensity] = useState<CollectorIntensity | null>(null);

  const refreshInventory = useCallback(async () => {
    const next = await inventoryService.getInventory(VIEWER_ID);
    setInventory(next);
    /* An import is the activation event the gate exists to force, so completing
       one has to open the gate — including after `resetOnboardingGate`, which
       is the only way anyone sees the closed state in the first place. Without
       this the override is a one-way latch and the demo dead-ends: reset the
       gate, run the import, and Collections stays grey with the new collection
       behind it. */
    setGateOverride(false);
  }, []);

  const markNotificationsRead = useCallback(async () => {
    await socialService.markAllRead(VIEWER_ID);
    setUnread(0);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
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
  }, []);

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
    if (!signedIn) return 'sign-in';
    if (FEATURES.firstRunQuiz && !quizDone) return 'quiz';
    if (FEATURES.firstRunTour && !tourDone) return 'tour';
    return 'done';
  }, [signedIn, quizDone, tourDone]);

  const signIn = useCallback(() => {
    setSignedIn(true);
    /* A first-time sign-in should meet the pre-import app, or the gate — the
       §13.4 activation mechanic — is invisible to anyone watching the flow it
       was designed for. This is also what makes the whole demo one unbroken
       run: sign in, answer the quiz, and the very next thing is the import the
       greyed-out tabs are asking for. */
    setGateOverride(true);
  }, []);

  const completeQuiz = useCallback((next: CollectorIntensity | null) => {
    setIntensity(next);
    setQuizDone(true);
  }, []);

  const completeTour = useCallback(() => setTourDone(true), []);

  const resetFirstRun = useCallback(() => {
    setSignedIn(false);
    setQuizDone(false);
    setTourDone(false);
    setIntensity(null);
    setGateOverride(false);
    /* The quiz's answers live in newsService's session overlays, not here, so
       resetting only this component's state would leave the previous run's
       followed games and topics in place — and the second rehearsal take would
       show the first take's answers already applied. */
    void newsService.resetSessionFollowing(VIEWER_ID);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      viewer,
      viewerId: VIEWER_ID,
      inventory,
      ownedItemIds,
      hasImported: !gateOverride && inventory.length > 0,
      unreadNotifications,
      loading,
      firstRunStage,
      intensity,
      signIn,
      completeQuiz,
      completeTour,
      refreshInventory,
      markNotificationsRead,
      resetOnboardingGate: () => setGateOverride(true),
      resetFirstRun,
    }),
    [
      viewer,
      inventory,
      ownedItemIds,
      gateOverride,
      unreadNotifications,
      loading,
      firstRunStage,
      intensity,
      signIn,
      completeQuiz,
      completeTour,
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
