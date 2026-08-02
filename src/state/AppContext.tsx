/**
 * App-wide state — PRD §13.1 (React Context + hooks; Redux is not worth the
 * setup for four days) and §13.4 (the onboarding gate).
 *
 * This provider owns exactly three things:
 *   1. Who the viewer is (§16 Q8 — logged-in, auth skipped).
 *   2. The viewer's inventory, because the onboarding gate keys off it.
 *   3. Notification unread state for the Home header.
 *
 * Flow-specific state belongs in the flow, not here. If you are tempted to add
 * a field for your own flow, that is a sign it should be local — this file is a
 * merge-conflict magnet and it is shared.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { VIEWER_ID } from '@/fixtures/users';
import { inventoryService, socialService } from '@/services';
import type { OwnedItemView } from '@/services';
import type { User } from '@/types';

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

  /** Call after a scan import so every screen sees the new items. */
  refreshInventory: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  /** Escape hatch for demoing the pre-import state without restarting the app. */
  resetOnboardingGate: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [viewer, setViewer] = useState<User | null>(null);
  const [inventory, setInventory] = useState<OwnedItemView[]>([]);
  const [unreadNotifications, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [gateOverride, setGateOverride] = useState(false);

  const refreshInventory = useCallback(async () => {
    const next = await inventoryService.getInventory(VIEWER_ID);
    setInventory(next);
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

  const value = useMemo<AppState>(
    () => ({
      viewer,
      viewerId: VIEWER_ID,
      inventory,
      ownedItemIds,
      hasImported: !gateOverride && inventory.length > 0,
      unreadNotifications,
      loading,
      refreshInventory,
      markNotificationsRead,
      resetOnboardingGate: () => setGateOverride(true),
    }),
    [
      viewer,
      inventory,
      ownedItemIds,
      gateOverride,
      unreadNotifications,
      loading,
      refreshInventory,
      markNotificationsRead,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <AppProvider>');
  return context;
}
