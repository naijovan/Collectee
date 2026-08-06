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
 * ── Why `COMMUNITY_ART` is empty right now ────────────────────────────────
 * Metro resolves `require()` at BUILD time and a line pointing at a missing
 * file is a build error, so the map cannot be pre-filled ahead of the art.
 * Until an id is present, `CommunityArt` draws the same deterministic tinted
 * block `ItemArt` falls back to, so every card is image-led today and the
 * layout does not change when the art lands.
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
 * EMPTY UNTIL THE ART LANDS. To wire one up:
 *   1. Drop `assets/collectee/communities/<communityId>.png` (1200x800).
 *   2. Add one line here, keyed by that exact id.
 *   3. Nothing else changes — the card and the detail header both pick it up.
 *
 * Example, once the file exists:
 *   'comm-blueprint-vault': require('../../assets/collectee/communities/comm-blueprint-vault.png'),
 */
export const COMMUNITY_ART: Record<string, ImageSourcePropType> = {};

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
