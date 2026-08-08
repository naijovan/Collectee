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
    /** Pin the bubble to one flank — see `GuideOptions.bubbleSide`. */
    bubbleSide?: 'left' | 'right';
    /** Line the bubble up with her head rather than her waist. */
    bubbleAlign?: 'top' | 'centre';
    /** Hard ceiling for everything in the guided layer, as a fraction. */
    maxBottomFraction?: number;
    /** Sit in the band directly above the target — see `GuideOptions.hugAbove`. */
    hugAbove?: boolean;
  };
}

export function buildTourStops(features: { news: boolean }): TourStop[] {
  const stops: TourStop[] = [
    {
      id: 'tabs',
      route: '/',
      targetIds: ['tabbar'],
      /*
       * Ray caught a real error here, not a style preference: this said
       * "Discover" and the tab has been called EXPLORE since the tab bar was
       * built. A walkthrough naming a destination that is not on screen is the
       * worst kind of copy bug, because the reader looks for it and concludes
       * they are lost.
       *
       * The "that is deliberate, not a bug" line is also gone. Ray's note is
       * that it reads like the app explaining itself, and he is right — a tour
       * pre-empting an accusation invites one. The greying still happens; it
       * just is not narrated.
       */
      title: 'Your collection starts here',
      body:
        'Explore, import items, build collections and manage your profile from the navigation bar below.',
      /* Hovering just over the bar rather than up at the top of the screen,
         with the bubble beside her so nothing sits on the bar. */
      guide: { pose: 'pointing', hugAbove: true, bubbleSide: 'left', line: 'Your collection starts here! Explore, import items, build collections and manage your profile from the bar below.' },
    },
    {
      id: 'import',
      route: '/',
      targetIds: ['tab-import'],
      title: 'Start with a screenshot',
      body:
        'Import scans a screenshot of your in-game inventory and matches what it finds against the catalogue. Anything it is unsure about goes to a review step rather than straight into your account.',
      /* Right of her, and hugging the tab bar rather than sitting up top.
         The old maxBottomFraction 0.6 ceiling is gone with it — the whole
         point of this arrangement is that she stands LOW, next to the tab she
         is introducing, so a ceiling at 60% would fight it. The no-overlap
         guarantee does not depend on that ceiling; `blocked` does that. */
      guide: { pose: 'pointing', hugAbove: true, bubbleSide: 'right', line: 'Start here! Snap your in-game inventory and I will match it against the catalogue. Anything I am unsure about goes to a review step, never straight in.' },
    },
    {
      id: 'discover',
      route: '/explore',
      targetIds: ['explore-title', 'explore-chips'],
      title: 'Find collectors like you',
      body:
        'Discover people with similar collections, games and interests.',
      /* Left of her, keeping the Verify and Reports buttons in the top-right
         corner clear on this stop.

         Colly keeps the "every match shows why" clause that Ray's shorter body
         drops. §11 F5 makes the reason load-bearing — a percentage without one
         is a broken feature — so the one line a judge actually hears should
         still say it. Ray's meaning is preserved; the voice adds to it. */
      guide: { pose: 'pointing', bubbleSide: 'left', bubbleAlign: 'top', line: 'Find collectors like you — people with similar collections, games and interests. Every match shows why it scored, too.' },
    },
    {
      id: 'news',
      route: '/news',
      targetIds: ['news-digest'],
      fallbackTargetIds: ['news-tabs'],
      title: 'Updates that matter to you',
      body:
        'See the latest news from your games, skins and favourites, ranked around what you follow and collect.',
      guide: { pose: 'pointing', line: 'Updates that matter to you — news from your games, skins and favourites, ranked around what you follow and collect.' },
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
