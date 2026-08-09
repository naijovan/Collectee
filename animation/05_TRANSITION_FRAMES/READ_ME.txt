05_TRANSITION_FRAMES
===========================================================================

The two frames the animation has to line up with, so the cut into and out of
the live demo is invisible.

LIVE_DEMO_FIRST_FRAME.png
    The Home screen, exactly as it appears at 1440px once signed in. If the
    animation ends by assembling the app, it should resolve to THIS — same
    crop, same scale, same hero artwork — so the first frame of the live
    recording is indistinguishable from the last frame of the animation.

LIVE_DEMO_LAST_FRAME.png
    The showroom. If the animation picks up after the demo, this is where it
    starts from.

TWO THINGS THAT WILL BREAK THE MATCH
    1. Viewport. These are 1440px wide. Record the live demo at the same
       width or the layout reflows — the card grid goes from four across to
       two below 600px, and the tab bar labels change size.

    2. The greeting. Home reads "Good morning / afternoon / evening, <name>"
       and it is pinned to Singapore time. If the animation is cut against a
       morning capture and the demo is recorded in the evening, the words
       differ. Record both in the same session, or crop above the greeting.

If you need a different pair of frames, 02_APP_SCREENS/ has nine more screens
at the same width and they can be swapped in directly.
