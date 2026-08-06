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
 *   assets/collectee/models/characters/<itemId>.glb
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
  'codm-fennec-ascended': require('../../assets/collectee/models/weapons/codm-fennec-ascended.glb'),
  'mlbb-gusion-cyber-faust': require('../../assets/collectee/models/characters/mlbb-gusion-cyber-faust.glb'),
  'val-elderflame-vandal': require('../../assets/collectee/models/val-elderflame-vandal.glb'),
  'val-prime-karambit': require('../../assets/collectee/models/val-prime-karambit.glb'),
};

/**
 * Hybrid procedural models use a clean transparent reconstruction input rather
 * than the dramatic inventory-card art. Only the GLB material named
 * `projected-art` receives this texture; its structural PBR materials remain.
 */
const ITEM_MODEL_TEXTURES: Record<string, number> = {
  'codm-fennec-ascended': require('../../assets/collectee/trellis-inputs/crown-jewels-weapons/codm-fennec-ascended.png'),
};

/**
 * Generated PBR models own their complete material. Legacy depth-baked models
 * only contain geometry/UVs and still need the 2D item render projected onto
 * them by `CollectibleGLTF`.
 */
const EMBEDDED_MATERIAL_MODELS = new Set<string>(['mlbb-gusion-cyber-faust']);

/** The bundled mesh for an item, or null when it has none yet. */
export function modelFor(itemId: string): number | null {
  return ITEM_MODELS[itemId] ?? null;
}

/** Whether the model should retain the textures and PBR maps inside its GLB. */
export function modelUsesEmbeddedMaterials(itemId: string): boolean {
  return EMBEDDED_MATERIAL_MODELS.has(itemId);
}

/** Optional clean texture prepared specifically for a hybrid model. */
export function modelTextureFor(itemId: string): number | null {
  return ITEM_MODEL_TEXTURES[itemId] ?? null;
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
