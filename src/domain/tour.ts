/**
 * The walkthrough's script — PRD §10's flow map as a route through the app.
 *
 * Data, not a component, for the same reason `SUGGESTED_QUESTIONS` is: the copy
 * is the feature, and it should be reviewable in one place by someone who is
 * not reading JSX. Pure, no I/O, per the `src/domain` contract.
 *
 * ── The route ─────────────────────────────────────────────────────────────
 *   Home (tab bar) → Home (Import) → Discover → Gaming updates → Home
 *                                                                 (assistant)
 *
 * Two stops on Home before moving, so the first transition is a spotlight
 * sliding rather than a screen change — the viewer learns what the overlay
 * does before it starts driving. Then out and back, ending where it began, so
 * the tour returns the user to the app's ground state instead of abandoning
 * them three screens deep in somewhere they never chose to go.
 *
 * `/news` is the only stop that pushes a stack route. The overlay pops it on
 * the way to the last stop rather than stacking Home on top of it.
 */

import type { Href } from 'expo-router';

export interface TourStop {
  /** Stable key. Also what the overlay logs when a target cannot be measured. */
  id: string;
  /** The route this stop lives on. The overlay navigates here before showing. */
  route: Href;
  /**
   * Anchors to spotlight, unioned into one rect. More than one when the target
   * is visually a group — a union avoids a wrapper View in someone's layout
   * purely so the tour has something to hold on to.
   */
  targetIds: readonly string[];
  /**
   * Used when `targetIds` cannot be measured. The digest is the case this
   * exists for: it resolves asynchronously and can take the full model timeout,
   * so the tab row above it is the thing that is reliably on screen.
   */
  fallbackTargetIds?: readonly string[];
  /** Corner treatment for the cutout. `pill` for round targets. */
  shape?: 'rect' | 'pill';
  title: string;
  body: string;
  /** Hidden entirely when this is false — §14 can cut the surface a stop names. */
  enabled?: boolean;
}

export function buildTourStops(features: { news: boolean }): TourStop[] {
  const stops: TourStop[] = [
    {
      id: 'tabs',
      route: '/',
      targetIds: ['tabbar'],
      title: 'Everything lives down here',
      body:
        'Home, Discover, Import, Collections and Profile. Collections and Profile stay greyed out until you import your first items — that is deliberate, not a bug.',
    },
    {
      id: 'import',
      route: '/',
      targetIds: ['tab-import'],
      title: 'Start with a screenshot',
      body:
        'Import scans a screenshot of your in-game inventory and matches what it finds against the catalogue. Anything it is unsure about goes to a review step rather than straight into your account.',
    },
    {
      id: 'discover',
      route: '/explore',
      targetIds: ['explore-title', 'explore-chips'],
      title: 'Find people with your taste',
      body:
        'Collectors whose inventories overlap yours, and the communities around them. Every match shows the reason it scored — a percentage on its own is not much of an argument.',
    },
    {
      id: 'news',
      route: '/news',
      targetIds: ['news-digest'],
      fallbackTargetIds: ['news-tabs'],
      title: 'What changed while you were away',
      body:
        'One tab per game, each opening with a digest. The feed below ranks on what you own and what you follow, so a patch note about your weapon comes before one about someone else’s.',
      enabled: features.news,
    },
    {
      id: 'assistant',
      route: '/',
      targetIds: ['assistant-button'],
      shape: 'pill',
      title: 'Ask about your own collection',
      body:
        'Try "Who is my top match, and why?" — it answers from your actual inventory and tells you which items you have in common.',
    },
  ];

  return stops.filter((stop) => stop.enabled !== false);
}
