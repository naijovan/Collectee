/**
 * Bundled room backdrop art — PRD §16 Q6, resolved on 3 Aug.
 *
 * The decision: backdrops are **pre-generated offline and bundled**, not
 * generated live. That is consistent with §12.1 (no network during the demo)
 * and it means the second run is as fast as the first.
 *
 * If a theme art key is removed, `resolveBackdrop` returns null and
 * `RoomScene` falls back to the theme palette wash — so the flow never renders
 * broken.
 *
 * To wire the art up:
 *   1. Drop files in `assets/room-backdrops/`, named exactly as the
 *      `backdropUrl` in `fixtures/room-themes.ts` (e.g. `weapon-vault.png`).
 *   2. Add the matching line below.
 *   3. Nothing else changes — `RoomScene` picks them up automatically.
 *
 * `require()` cannot take a runtime string in Metro, which is why this is an
 * explicit map rather than a template literal.
 *
 * Generate them at **3:2 landscape**. The slot maps are fractional, so any
 * resolution works, but the geometry was laid out against 3:2 and a squarer
 * crop will push the foreground plinths off the bottom edge. Prompts are the
 * `stylePrompt` on each theme — they already end with "no text, no logos",
 * which matters: a backdrop with invented game branding on the wall is an IP
 * problem in a room we are showing to publishers (§15).
 */

export const BACKDROPS: Record<string, number> = {
};

/** The bundled asset for a fixture backdrop path, or null if art has not landed. */
export function resolveBackdrop(backdropUrl: string): number | null {
  return BACKDROPS[backdropUrl] ?? null;
}

/** True once all six themes have art — used by the diagnostics screen. */
export function backdropsReady(expected: readonly string[]): boolean {
  return expected.every((url) => resolveBackdrop(url) !== null);
}
