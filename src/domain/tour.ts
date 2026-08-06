/**
 * The walkthrough's script — PRD §10's flow map, as five stops.
 *
 * Data, not a component, for the same reason `SUGGESTED_QUESTIONS` is: the
 * copy is the feature here, and it should be reviewable in one place by
 * someone who is not reading JSX. Pure, no I/O, per the `src/domain` contract.
 *
 * ── Why cards and not a spotlight over the real UI ────────────────────────
 * A spotlight needs a measured rect for each target, which means `TabBar` and
 * `AssistantButton` — components §13.3 puts under one owner — each reporting
 * their layout to a registry. That is four shared files edited during polish
 * week, and rect bugs surface on the screen size you first meet at rehearsal.
 * These cards name the surface and navigate to it, which delivers the same
 * "here is what this app does" in a fraction of the risk. The spotlight is the
 * phase-2 version and worth saying so on the 23rd.
 */

import type { Href } from 'expo-router';

export interface TourStop {
  /** Short title — the surface being named. */
  title: string;
  /** One or two sentences. What it does, and why someone would care. */
  body: string;
  /**
   * Where "Take me there" goes. `null` for a stop whose subject is chrome
   * rather than a screen — the tab bar is on every route already, and the
   * assistant is a panel opened by its own launcher, not a destination.
   */
  href: Href | null;
  /** Label for the navigating action. Absent when `href` is null. */
  action?: string;
}

export const TOUR_STOPS: readonly TourStop[] = [
  {
    title: 'Your five tabs',
    body:
      'Home, Explore, Collections and Profile, with the + in the middle. Collections and Profile stay greyed out until you import your first items — that is deliberate, not a bug.',
    href: null,
  },
  {
    title: 'The + button',
    body:
      'Scan a screenshot of your in-game inventory and we match what we find against the catalogue. Anything we are unsure about goes to a review step rather than into your account.',
    href: '/import',
    action: 'Try importing',
  },
  {
    title: 'Discover',
    body:
      'Find collectors whose inventories overlap yours. Every match shows the reason it scored — a percentage on its own is not much of an argument.',
    href: '/explore',
    action: 'Open Discover',
  },
  {
    title: 'Gaming updates',
    body:
      'One tab per game, each opening with a digest of what changed. The feed ranks on what you own and what you follow, so a patch note about your weapon comes first.',
    href: '/news',
    action: 'Open updates',
  },
  {
    title: 'Ask the assistant',
    body:
      'The bubble in the corner answers questions about your own collection. Try "Who is my top match, and why?" — it will tell you which items you have in common.',
    href: null,
  },
] as const;
