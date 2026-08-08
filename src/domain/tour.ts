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

import type { GuidePose } from '@/config/tourGuideArt';

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
  /**
   * Present this target by LIFTING it above the overlay instead of cutting a
   * hole around it.
   *
   * For a target that floats over the app — the assistant launcher is the only
   * one — a cutout also reveals whatever it is sitting on, so the two read as
   * overlapping. Dimming everything and raising the target above the scrim
   * presents it cleanly. The target must register the same anchor id.
   */
  lift?: boolean;
  title: string;
  body: string;
  /** Hidden entirely when this is false — §14 can cut the surface a stop names. */
  enabled?: boolean;
  /**
   * Colly's line for this stop, and the pose she says it in — tour v2 only.
   *
   * ADDITIVE. `title`/`body` above are untouched and remain what the card tour
   * renders, so `FEATURES.tourGuideColly` off is byte-identical to today. The
   * two are not the same copy rewritten: the card explains, the guide talks.
   *
   * House rule still applies to the playful voice — she may not claim anything
   * the app does not do. "Anything it is unsure about goes to a review step" is
   * a promise the Import flow keeps; "I'll verify your items" is not one
   * anybody can keep (§9.3 is partnership-gated).
   *
   * One or two short lines. She is beside the thing she is describing, so the
   * screen is doing most of the explaining.
   */
  guide?: {
    pose: GuidePose;
    line: string;
    /**
     * Let her stand beside this target even though it is pinned to the bottom.
     *
     * The midline rule assumes a bottom target is wide — the tab bar spans the
     * screen, so "beside" is also "on top of". The launcher is 56pt in a
     * corner with the whole row free, so the assumption does not hold and the
     * rule would cost the finale its composition.
     */
    standBeside?: boolean;
  };
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
      guide: { pose: 'pointing', line: 'Everything lives down here — Home, Discover, Import, Collections and Profile. Collections and Profile stay greyed until your first import. That is on purpose!' },
    },
    {
      id: 'import',
      route: '/',
      targetIds: ['tab-import'],
      title: 'Start with a screenshot',
      body:
        'Import scans a screenshot of your in-game inventory and matches what it finds against the catalogue. Anything it is unsure about goes to a review step rather than straight into your account.',
      guide: { pose: 'pointing', line: 'Start here! Snap your in-game inventory and I will match it against the catalogue. Anything I am unsure about goes to a review step, never straight in.' },
    },
    {
      id: 'discover',
      route: '/explore',
      targetIds: ['explore-title', 'explore-chips'],
      title: 'Find people with your taste',
      body:
        'Collectors whose inventories overlap yours, and the communities around them. Every match shows the reason it scored — a percentage on its own is not much of an argument.',
      guide: { pose: 'pointing', line: 'This is where you find people with your taste. Every match shows why it scored — a percentage on its own is not much of an argument.' },
    },
    {
      id: 'news',
      route: '/news',
      targetIds: ['news-digest'],
      fallbackTargetIds: ['news-tabs'],
      title: 'What changed while you were away',
      body:
        'One tab per game, each opening with a digest. The feed below ranks on what you own and what you follow, so a patch note about your weapon comes before one about someone else’s.',
      guide: { pose: 'pointing', line: 'One tab per game, each opening with a digest. The feed ranks on what you own, so a patch note about your weapon comes first.' },
      enabled: features.news,
    },
    {
      id: 'assistant',
      route: '/',
      targetIds: ['assistant-button'],
      shape: 'pill',
      /* It floats over Home, so a cutout would frame it together with whatever
         card is underneath. Lifted instead. */
      lift: true,
      title: 'Ask about your own collection',
      body:
        'Try "Who is my top match, and why?" — it answers from your actual inventory and tells you which items you have in common.',
      guide: {
        pose: 'happy',
        /* Small, cornered target — she stands next to it rather than being
           pushed to the upper half. See `standBeside`. */
        standBeside: true,
        line:
          'And that\u2019s me! Anytime you need me, I\u2019m right here at the bottom right — ' +
          'ask me anything about your collection.',
      },
    },
  ];

  return stops.filter((stop) => stop.enabled !== false);
}
