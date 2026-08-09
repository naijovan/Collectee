EXTRA_ANIMATION
===========================================================================

The heavy and the specialised, kept out of the main pack so `animation/` stays
small enough to upload in one go.

    colly/        the assistant character — 4 shipped images plus derivatives
    3d_models/    19 .glb models — 6 full 3D characters, 13 relief weapons

135 MB in total, nearly all of it geometry.


===========================================================================
COLLY
===========================================================================

The in-app assistant. She has two jobs and therefore two shapes, and the rules
for them are opposites — do not copy one across to the other.


SOURCE FILES (colly/source/) — exactly what ships
---------------------------------------------------------------------------

colly-mascot-512.png            512x512, SOLID background
    The launcher bubble and the panel header. Circle-cropped at BOTH call
    sites with overflow:hidden, so nothing outside the inscribed circle
    survives. Head-and-shoulders, not a full body — it renders at 56pt and
    28pt, and a whole figure at 28pt is a smudge.

    It sits on the app's accent blue (#2F6BFF) with a #2454CC ring, so a
    mid-blue subject would disappear into that ring. See
    derived/colly-mascot-on-accent.png for how it actually looks in place.

colly-pose-talking.png          768x1024, TRANSPARENT
colly-pose-pointing.png         768x1024, TRANSPARENT
colly-pose-happy.png            768x1024, TRANSPARENT
    Full-figure tour poses. She stands large on screen, the app dims the
    world behind her, and she gestures at whatever is highlighted.

    Transparency is required, not preferred: these composite over a live app
    screen behind a scrim whose colour changes across the viewport, so any
    baked background would show as a floating rectangle. No matte halo, no
    baked shadow, no baked glow — the app adds what it needs.

    talking     default, seen most. Neutral presenting stance, one hand open
                mid-gesture. Must be comfortable to look at for seconds at a
                time.
    pointing    the workhorse — four of the five tour stops use it. Turned
                ~20 degrees toward her own left, arm fully clear of the torso
                silhouette so the gesture reads small against a dark scrim.
    happy       the final stop only. A celebration beat; the app adds a small
                scale pulse on top, so it reads as joyful while still
                standing — not a jump.


THREE CONSTRAINTS THAT WILL BITE AN ANIMATOR
---------------------------------------------------------------------------

1. SHE IS MIRROR-SAFE, AND THE APP RELIES ON IT.
   `pointing` is drawn once and flipped with scaleX:-1 when she stands to the
   right of what she is indicating. That is only valid because she carries no
   text, no asymmetric readable prop and no costume detail that reads wrong
   reversed. If you add anything asymmetric in post, the flip breaks.
   derived/colly-pose-pointing-mirrored.png is the flip as a file.

2. SCALE AND EYELINE MUST HOLD ACROSS ALL THREE POSES.
   They swap between stops with only a small settle. If her head changes size
   or height between poses the swap reads as a glitch rather than a gesture.
   The source frames are all 768x1024 with ~4% padding, so cross-fading them
   in their original frames is safe. If you use the trimmed versions, align
   them yourself — trimming removes exactly the padding that was keeping them
   registered:

       talking   440x1000
       pointing  592x956      (widest — the extended arm)
       happy     486x971

3. THE NAME IS COLLY. THE FILENAMES SAY MIYA.
   She was called Miya until 8 Aug. That was renamed because Miya is a
   shipped Mobile Legends hero and this app already uses a Moonton character
   by that name — keeping it would have been a §15 problem. The source
   filenames were deliberately left alone because they are wired paths in
   tourGuideArt.ts and validate-fixtures.ts, and renaming a bundled asset
   buys nothing but a chance to break a require().

   The copies in this folder ARE renamed to colly-*, because nothing here is
   wired to anything. Never show "Miya" to a viewer.


DERIVED (colly/derived/) — made here, not shipped
---------------------------------------------------------------------------
colly-pose-pointing-mirrored.png    the scaleX:-1 flip, as a file
colly-pose-*-trimmed.png            alpha-bounds crops, for positioning by
                                    silhouette rather than by frame
colly-mascot-on-accent.png          on #2F6BFF — how the launcher looks
colly-mascot-on-dark.png            on #0B0D10 — for a dark composition


ORIGINAL CHARACTER
---------------------------------------------------------------------------
Colly is original art and must not resemble any publisher's character (§15).
She is specifically NOT a Mobile Legends hero. If a shot needs her redrawn or
extended, that constraint carries over.


===========================================================================
3D MODELS
===========================================================================

See 3d_models/READ_ME_FIRST.txt — it leads with the distinction that matters.

The short version: the six characters are full volumetric meshes and will
survive anything. The thirteen weapons are RELIEF — displaced planes about a
tenth as deep as they are wide, measured. They read as solid up to roughly
25-30 degrees off axis, which is all the app ever shows, and flatten past
that. A weapon can hover, drift and dolly. It cannot spin.


===========================================================================
WHY THIS IS SEPARATE FROM animation/
===========================================================================
`animation/` is the upload pack — brief, brand, screens, flat assets, brand
guide — and stays around 60 MB so it moves in one go. This folder is the 135 MB
that would otherwise make that impossible. Take what a given shot needs.

Both are excluded from the Vercel deploy; nothing in src/ requires either.
