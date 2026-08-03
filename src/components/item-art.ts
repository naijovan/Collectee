/**
 * Bundled item art — the §16 open item ("item art is not in the repo").
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  THIS IS THE SEAM FOR ART. Adding artwork should never require      │
 * │  editing a component. Add files, add lines here, done.              │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * To wire art up:
 *   1. Drop files under `assets/item-art/<title>/<item-id>.png`, matching the
 *      `renderUrl` on each entry in `fixtures/items-*.ts`.
 *   2. Add a line to `ITEM_ART` below, keyed by that exact `renderUrl`.
 *   3. Nothing else changes. `ItemArt` renders the image and every card, room
 *      slot, tray and strip in the app picks it up at once.
 *
 * Until a key is present, `ItemArt` draws its deterministic rarity-tinted block,
 * so a half-finished art pass renders as a mix rather than a wall of broken
 * images. `require()` cannot take a runtime string in Metro, which is why this
 * is an explicit map.
 *
 * Two constraints worth keeping in mind when generating (§15, §11 F4):
 *   - Square or 4:3 reads best; cards, room slots and the tray all crop to fit.
 *   - No invented game logos or publisher branding in the art. Item renders are
 *     already publisher IP; inventing marks on top is a second problem.
 */

export const ITEM_ART: Record<string, number> = {
  // 'item-art/codm/codm-dlq33-lightbringer.png': require('@/assets/item-art/codm/codm-dlq33-lightbringer.png'),
};

/** The bundled asset for an item's `renderUrl`, or null if art has not landed. */
export function resolveItemArt(renderUrl: string): number | null {
  return ITEM_ART[renderUrl] ?? null;
}

/** How many catalogue entries currently have art. Surfaced in /diagnostics. */
export function itemArtCoverage(renderUrls: readonly string[]): {
  covered: number;
  total: number;
} {
  return {
    covered: renderUrls.filter((url) => resolveItemArt(url) !== null).length,
    total: renderUrls.length,
  };
}
