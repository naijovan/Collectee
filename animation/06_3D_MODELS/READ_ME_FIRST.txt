06_3D_MODELS — READ THIS BEFORE YOU IMPORT ANYTHING
===========================================================================

Nineteen glTF binaries (.glb), in two folders that are NOT the same kind of
thing. Import a weapon expecting a character and you will be annoyed within
about ten seconds, so the difference is first.


THE TWO KINDS
---------------------------------------------------------------------------

characters/       SIX FULL 3D MESHES. Real volume, genuinely rotatable,
                  575k-785k vertices each with baked colour textures.
                  These are the hero assets. Generated image-to-3D, then
                  cleaned up.

weapons-relief/   THIRTEEN RELIEF MESHES. NOT full 3D. Each is a displaced
                  plane — the artwork projected onto geometry with a
                  silhouette edge, about 52-60k vertices, no texture image
                  (colour is in the material).

                  Measured depth-to-width:
                      DL Q33 Lightbringer   0.11
                      Prime Karambit        0.08

                  So they are roughly a tenth as deep as they are wide. Head
                  on and up to maybe 25-30 degrees they read convincingly as
                  solid objects — that is exactly what they were built for,
                  because the app only ever shows them at a slight angle.
                  Past that they visibly flatten out, and past 60 degrees they
                  disappear into an edge.

                  Every file is named "-relief" so this cannot be forgotten
                  halfway through a shot.


WHAT TO USE THEM FOR
---------------------------------------------------------------------------
Characters      anything. Orbit them, light them, put them on a pedestal,
                cut between them. They hold up.

Weapons         slow arcs within about +/-25 degrees, parallax drift, dolly
                moves toward or away, "card lifts off the surface and hovers"
                beats. Treat them as thick cards rather than as objects. A
                full 360 will expose them.

If a shot truly needs a weapon rotating all the way round, the honest options
are: keep it inside 25 degrees and cut, or use the flat artwork in
03_ANIMATION_ASSETS/skin-card-*.png as a 2D card and lean into it being a
card. Do not fake it with a mirrored relief — the seam shows.


SCALE — one file will surprise you
---------------------------------------------------------------------------
Most models arrive roughly unit-sized (about 1.0 on the longest axis).

mlbb-gusion-cyber-faust.glb is quantised at a very different scale — its
bounding box is around 38,000 x 65,000 x 25,000 units. It is the same mesh,
just not normalised. Scale it to taste on import rather than assuming the
file is broken.

Check the bounds on import for every model; do not assume a shared scale.


previews/
---------------------------------------------------------------------------
One flat image per model, same filename stem, so you can choose what to open
without loading 130 MB of geometry. These are the app's own renders of the
same items — for the weapons they are also literally the source the relief
was projected from.


PERFORMANCE
---------------------------------------------------------------------------
The characters are heavy: 575k-785k vertices, and 130 MB of geometry across
this folder. That is fine for offline rendering and painful for realtime.
If you need them in a browser or a realtime engine, decimate first — they
will survive aggressive reduction because the detail is mostly in the baked
texture, not the silhouette.


LICENCE — the constraint that applies to everything here
---------------------------------------------------------------------------
All original prototype work. No publisher assets, no ripped game models, no
real character likenesses. That is a hard project rule (§15), and it is why
these were generated from our own concept art rather than sourced. Nothing
from a real game may be substituted into a shot.


INVENTORY
---------------------------------------------------------------------------
characters/  (full 3D)
    codm-ghost-nightfall            CODM operator, hooded, purple visor
    mlbb-gusion-cyber-faust         MLBB hero — also the only character with
                                    a mesh that appears in a seeded showroom
    mlbb-lightborn-defender         MLBB, white and gold armour
    mlbb-neon-ronin                 MLBB, black and bronze, green flame
    mlbb-radiant-huntress           MLBB, largest file at 20 MB
    mlbb-slipstream-pilot           MLBB

weapons-relief/  (relief, ~0.1 depth ratio)
    codm-ak117-cordite-storm        codm-dlq33-lightbringer
    codm-drh-cerberus               codm-fennec-ascended
    codm-qq9-diavolo                val-elderflame-dagger
    val-elderflame-operator         val-elderflame-vandal
    val-prime-karambit              val-prime-spectre
    val-prime-vandal                val-singularity-knife
    val-voidglass-blade
