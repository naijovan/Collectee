/**
 * Whether the assistant panel is open, and what has been said this session.
 *
 * ── Why this is context and not component state ───────────────────────────
 * Two things open the same panel: the floating launcher in the root layout and
 * the header button on Home (§13.4). They are in different trees, so the open
 * flag has to live above both.
 *
 * ── Why the transcript lives here too ─────────────────────────────────────
 * The panel unmounts when it closes. Holding turns inside it would mean every
 * close wiped the conversation, so asking a follow-up after glancing at a
 * screen would start over — which is precisely what someone does with a chat
 * panel overlaying an app.
 *
 * Session-only and in memory, like every other write in this build (§12.1 — no
 * backend). Reloading the app clears it, and that is the honest behaviour: an
 * assistant that appeared to remember yesterday would be claiming storage that
 * does not exist.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { ChatTurn } from '@/services';

export interface DockTurn extends ChatTurn {
  id: number;
  /** Which path answered. Never imply a model ran when none did (§12.1). */
  source?: 'local' | 'model';
}

interface AssistantDockValue {
  open: boolean;
  openPanel: () => void;
  closePanel: () => void;
  turns: DockTurn[];
  addTurn: (turn: Omit<DockTurn, 'id'>) => void;
  clearTurns: () => void;
}

const AssistantDockContext = createContext<AssistantDockValue | null>(null);

export function AssistantDockProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<DockTurn[]>([]);

  const openPanel = useCallback(() => setOpen(true), []);
  const closePanel = useCallback(() => setOpen(false), []);

  const addTurn = useCallback((turn: Omit<DockTurn, 'id'>) => {
    setTurns((prev) => [...prev, { ...turn, id: prev.length }]);
  }, []);

  const clearTurns = useCallback(() => setTurns([]), []);

  const value = useMemo(
    () => ({ open, openPanel, closePanel, turns, addTurn, clearTurns }),
    [open, openPanel, closePanel, turns, addTurn, clearTurns],
  );

  return <AssistantDockContext.Provider value={value}>{children}</AssistantDockContext.Provider>;
}

export function useAssistantDock(): AssistantDockValue {
  const value = useContext(AssistantDockContext);
  if (!value) throw new Error('useAssistantDock must be used inside AssistantDockProvider');
  return value;
}
