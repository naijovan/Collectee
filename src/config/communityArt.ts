/**
 * Community header art — the image at the top of a community card.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  THIS IS THE SEAM FOR COMMUNITY ART. Adding an image is adding a    │
 * │  file and one line in `COMMUNITY_ART`. No component changes.        │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ── Layout on disk ────────────────────────────────────────────────────────
 *   assets/collectee/communities/<communityId>.png   1200x800 (3:2), `cover`
 *
 * **The filename IS the id**, matching `config/artRegistry` and
 * `config/avatarRegistry`. Note that the fixtures' `Community.avatarUrl` is a
 * legacy path shaped like `communities/blueprint-vault.png` — it predates this
 * seam, nothing has ever read it, and it is deliberately not the key here. The
 * id is.
 *
 * ── One image, two crops ──────────────────────────────────────────────────
 * The same file backs the card thumbnail and the detail-screen header. 3:2 is
 * the shape the wider of the two wants, and the card crops to it with `cover`.
 * Two files per community would double the art order for one aspect ratio.
 *
 * ── The fallback stays ────────────────────────────────────────────────────
 * All seeded communities have art now. `CommunityArt` keeps its deterministic tinted block
 * for the same reason the avatar one does: a new community can be seeded and
 * browsed before anyone draws its banner, and the card's layout is identical
 * either way.
 *
 * ── Art policy (PRD §15 IP row) ───────────────────────────────────────────
 * ORIGINAL prototype art. No publisher logos, no invented game marks, no text
 * baked into the image — the card draws the name itself, and a baked-in title
 * would be wrong the moment a community is renamed.
 */

import type { ImageSourcePropType } from 'react-native';

/**
 * Community id → bundled header image.
 *
 * Seeded banners land at 1200x800. To add another:
 *   1. Drop `assets/collectee/communities/<communityId>.png` (1200x800).
 *   2. Add one line here, keyed by that exact COMMUNITY ID — see below.
 *   3. Nothing else changes — the card and the detail header both pick it up.
 */
export const COMMUNITY_ART: Record<string, ImageSourcePropType> = {
  'comm-blueprint-vault': require('../../assets/collectee/communities/comm-blueprint-vault.png'),
  'comm-knife-collectors': require('../../assets/collectee/communities/comm-knife-collectors.png'),
  'comm-land-of-dawn': require('../../assets/collectee/communities/comm-land-of-dawn.png'),
  'comm-mythic-drop': require('../../assets/collectee/communities/comm-mythic-drop.png'),
  'comm-hero-skins': require('../../assets/collectee/communities/comm-hero-skins.png'),
  'comm-vandal-club': require('../../assets/collectee/communities/comm-vandal-club.png'),
  'comm-epic-nights': require('../../assets/collectee/communities/comm-epic-nights.png'),
  'comm-shelf-tours': require('../../assets/collectee/communities/comm-shelf-tours.png'),
  /* KEY AND FILENAME DIFFER, deliberately. The community is called "One Shelf"
     and its art is named for that, but its id has been `comm-cross-game` since
     the fixture was written. The key must be the id — this is the one line in
     either registry that cannot be derived from the filename, so changing it to
     match would silently un-wire the card. */
  'comm-cross-game': require('../../assets/collectee/communities/comm-one-shelf.png'),
};

/** The bundled image for a community, or null while it is still a block. */
export function communityArtFor(communityId: string): ImageSourcePropType | null {
  return COMMUNITY_ART[communityId] ?? null;
}

/** How many communities have art. Surfaced in /diagnostics. */
export function communityArtCoverage(ids: readonly string[]): {
  covered: number;
  total: number;
} {
  return {
    covered: ids.filter((id) => communityArtFor(id) !== null).length,
    total: ids.length,
  };
}
