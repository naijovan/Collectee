/**
 * Real 3D geometry, keyed by catalogue `Item.id` — the third and best tier of
 * the collectible rendering chain.
 *
 * ── The chain, best to worst ──────────────────────────────────────────────
 *   1. `modelFor(id)`   → a real .glb mesh. Spins 360° because it has a back.
 *   2. `itemTexture(item)` → the artwork as a displacement relief. Reads as
 *      depth head-on, but it is a plane: turn it and you see an edge.
 *   3. `CollectibleModel3D` → procedural geometry from primitives. Spins
 *      properly, but it is a generic rifle/blade/statue, not this skin.
 *
 * Every tier degrades to the next, so a half-finished model pass renders as a
 * mix rather than a wall of holes. Nothing else has to know which tier ran.
 *
 * ── Layout on disk ────────────────────────────────────────────────────────
 *   assets/collectee/models/<itemId>.glb
 *
 * **The filename IS the id**, same rule as `artRegistry`. That is what keeps
 * this map generatable and lets `audit-art` treat coverage as a set comparison.
 *
 * ── Why the map is written out ────────────────────────────────────────────
 * Metro resolves `require()` at BUILD time, so `require(someVariable)` does not
 * work and every path must appear as a literal exactly once. A line pointing at
 * a file that is not on disk is a build error, not a runtime fallback — which is
 * why this map is empty until models land rather than listing hopefuls.
 *
 * `.glb` is only bundled because `metro.config.js` adds it to `assetExts`.
 *
 * ── Provenance, and the line that must not move (§11 F4, §15) ─────────────
 * These are ORIGINAL models generated from our own concept art. They are not
 * publisher game assets, we do not have those, and §11 F4 says plainly not to
 * promise them. If anyone asks at the demo, that is the answer: generated from
 * art we made, which is also why an item can look close to its render without
 * ever having touched a publisher pipeline.
 */

/** Catalogue item id → bundled .glb. Empty until the first model lands. */
export const ITEM_MODELS: Record<string, number> = {
  'codm-dlq33-lightbringer': require('../../assets/collectee/models/codm-dlq33-lightbringer.glb'),
  'codm-fennec-ascended': require('../../assets/collectee/models/codm-fennec-ascended.glb'),
  // Character art is deliberately NOT registered. The `subjects/` renders are
  // head-and-shoulders crops on busy backgrounds, so a baked mesh is a floating
  // bust — worse than the procedural full-body statue it would replace. Register
  // one only when a full-body render on a plain background exists to bake from.
  'val-elderflame-vandal': require('../../assets/collectee/models/val-elderflame-vandal.glb'),
  'val-prime-karambit': require('../../assets/collectee/models/val-prime-karambit.glb'),
};

/** The bundled mesh for an item, or null when it has none yet. */
export function modelFor(itemId: string): number | null {
  return ITEM_MODELS[itemId] ?? null;
}

/** Whether an item has real geometry. Lets a surface prefer it over a relief. */
export function hasModel(itemId: string): boolean {
  return modelFor(itemId) !== null;
}

/** How many items ship real geometry. Used by scripts/audit-art.ts. */
export function modelCoverage(): number {
  return Object.keys(ITEM_MODELS).length;
}

/** Every id with a mesh — the audit compares this against the catalogue. */
export function modelIds(): string[] {
  return Object.keys(ITEM_MODELS);
}
