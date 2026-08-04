/**
 * Turns a render plus its baked depth map into a real, closed 3D mesh.
 *
 * ── What this is ──────────────────────────────────────────────────────────
 * A depth map gives the shape of the visible surface. A silhouette gives its
 * outline. Together that is enough to build an actual object:
 *
 *   front surface   displaced by the measured depth — the real shape
 *   back surface    the same silhouette, mirrored at reduced depth
 *   rim             stitched between them around the outline
 *
 * The result is watertight and spins a full 360°, because it has a back. That
 * is the whole difference from `ArtworkRelief3D`, which displaces one open
 * plane and falls apart the moment it turns.
 *
 * ── What it is not ────────────────────────────────────────────────────────
 * The back is inferred, not observed. A single image cannot know what is behind
 * the object, so it gets a flattened mirror of the front. That reads well on a
 * weapon — broadly slab-shaped — and less well on a figure. Same limitation any
 * single-image 3D tool has; it is honest about it rather than hiding it.
 *
 * These are ORIGINAL models built from our own concept art. Not publisher
 * assets — §11 F4, §15.
 *
 * ── Why geometry only, no embedded texture ────────────────────────────────
 * The mesh ships with UVs but no baked-in image. `CollectibleGLTF` applies the
 * colour render from `artRegistry` at runtime, so the texture exists once in
 * the bundle instead of once per model, and re-generated art appears on the
 * mesh without re-baking it. It also sidesteps GLTFExporter needing a canvas to
 * encode textures, which Node does not have.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────
 *   npm run bake:mesh                    # every item with a depth map
 *   npm run bake:mesh -- codm-dlq33-lightbringer val-prime-karambit
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import sharp from 'sharp';

// GLTFExporter reaches for browser globals. Only these two, and only to turn a
// Blob into bytes — the rest of the exporter is pure maths.
(globalThis as unknown as { FileReader: unknown }).FileReader = class {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buf) => {
      this.result = buf;
      this.onloadend?.();
    });
  }
};

const DEPTH_DIR = 'assets/collectee/depth';
const OUT_DIR = 'assets/collectee/models';

/**
 * Sampling grid. 160 gives a silhouette clean enough that a barrel reads as a
 * barrel; past ~200 the file grows faster than the shape improves, and the
 * budget in models/README.md is 2MB.
 */
const GRID = 160;

/**
 * Depth of the object as a fraction of its longest side.
 *
 * Deliberately small. The first pass used 0.34 and it was a mistake: a depth
 * map is a relative, 8-bit, single-view estimate, so pushing it that far turns
 * a rifle into a loaf and amplifies the map's own quantisation into visible
 * terraced steps. The goal is a render with real thickness that catches light
 * and parallax — not a reconstruction, which one image cannot support.
 */
const FRONT_DEPTH = 0.055;

/** The back is shallower — an inferred surface should not claim equal weight. */
const BACK_DEPTH = 0.022;

/**
 * Smoothing passes over the sampled depth before it becomes geometry.
 *
 * The map is 8-bit, so adjacent depths differ by discrete steps; across a
 * 160-vertex grid those land as terraces. Averaging with neighbours turns the
 * staircase into a ramp, which is what a surface should look like.
 */
const SMOOTH_PASSES = 3;

/**
 * Below this the pixel is background, not object. The renders sit on near-black
 * so a low luminance cut separates them cleanly; the depth map's own falloff
 * does the rest.
 */
const MASK_CUTOFF = 26;

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  mkdirSync(OUT_DIR, { recursive: true });

  const depths = existsSync(DEPTH_DIR)
    ? readdirSync(DEPTH_DIR).filter((f) => f.endsWith('.png'))
    : [];
  const targets = only.length > 0 ? depths.filter((f) => only.includes(f.slice(0, -4))) : depths;

  if (targets.length === 0) {
    console.error('Nothing to bake. Run `npm run bake:depth` first.');
    process.exit(1);
  }

  const THREE = await import('three');
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

  console.log(`Baking ${targets.length} mesh${targets.length === 1 ? '' : 'es'}…`);
  let done = 0;

  for (const file of targets) {
    const id = basename(file, '.png');
    const colour = findColour(id);
    if (!colour) {
      console.log(`  skip ${id} — no source render`);
      continue;
    }

    const geometry = await buildGeometry(THREE, join(DEPTH_DIR, file), colour);
    if (!geometry) {
      console.log(`  skip ${id} — silhouette too small to mesh`);
      continue;
    }

    const scene = new THREE.Scene();
    scene.add(
      new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ metalness: 0.25, roughness: 0.55 }),
      ),
    );

    const glb = await new Promise<ArrayBuffer>((resolve, reject) => {
      new GLTFExporter().parse(
        scene,
        (result) => resolve(result as ArrayBuffer),
        reject,
        { binary: true },
      );
    });

    const out = join(OUT_DIR, `${id}.glb`);
    writeFileSync(out, Buffer.from(glb));
    done += 1;
    const kb = (Buffer.from(glb).length / 1024).toFixed(0);
    console.log(`  ${String(done).padStart(3)}/${targets.length}  ${id}.glb  ${kb} KB`);
  }

  console.log(`\nDone. ${done} meshes in ${OUT_DIR}/`);
  console.log('Add them to src/config/modelRegistry.ts to light them up.');
}

/** Renders live in two folders; the id is the filename in whichever has it. */
function findColour(id: string): string | null {
  for (const dir of ['assets/collectee/items', 'assets/collectee/subjects']) {
    const path = join(dir, `${id}.png`);
    if (existsSync(path)) return path;
  }
  return null;
}

/**
 * The mesh itself.
 *
 * Grid vertices inside the silhouette get a front and a back position. A quad
 * is emitted only where all four of its corners are inside, which is what makes
 * the outline follow the object instead of the image bounds. Every quad edge
 * that borders the outside is a rim edge, and gets stitched front-to-back.
 */
async function buildGeometry(
  THREE: typeof import('three'),
  depthPath: string,
  colourPath: string,
) {
  const depth = await sharp(depthPath)
    .greyscale()
    .resize(GRID, GRID, { fit: 'fill' })
    .raw()
    .toBuffer();

  // Silhouette comes from the colour render, not the depth map: depth models
  // hallucinate a soft gradient over the background, while the render has the
  // object on near-black and cuts cleanly.
  const mask = await sharp(colourPath)
    .flatten({ background: '#000000' })
    .greyscale()
    .resize(GRID, GRID, { fit: 'fill' })
    .blur(1)
    .raw()
    .toBuffer();

  // A raw luminance cut tears busy art apart: shadowed armour and dark hair sit
  // below the threshold and get punched out of the middle of the subject, so the
  // silhouette shatters into islands. Two passes fix that — close the gaps, then
  // fill anything the background cannot reach.
  const solid = closeAndFill(mask);
  const inside = (x: number, y: number) => solid[y * GRID + x] === 1;

  // Smooth in float space, not in the 8-bit buffer, or every pass re-quantises
  // and the terracing survives. Only interior samples are averaged; pulling in
  // background depth would bevel the silhouette inward.
  const field = new Float32Array(GRID * GRID);
  for (let i = 0; i < field.length; i += 1) field[i] = depth[i]! / 255;

  for (let pass = 0; pass < SMOOTH_PASSES; pass += 1) {
    const next = Float32Array.from(field);
    for (let y = 1; y < GRID - 1; y += 1) {
      for (let x = 1; x < GRID - 1; x += 1) {
        if (!inside(x, y)) continue;
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!inside(x + dx, y + dy)) continue;
            sum += field[(y + dy) * GRID + (x + dx)]!;
            n += 1;
          }
        }
        if (n > 0) next[y * GRID + x] = sum / n;
      }
    }
    field.set(next);
  }

  const at = (x: number, y: number) => field[y * GRID + x]!;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Grid index → vertex index, per surface. -1 means "outside the silhouette".
  const frontIndex = new Int32Array(GRID * GRID).fill(-1);
  const backIndex = new Int32Array(GRID * GRID).fill(-1);

  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      if (!inside(x, y)) continue;

      // Centred on the origin, spanning 1 unit. CollectibleGLTF rescales to the
      // slot anyway, so this only has to be consistent.
      const px = x / (GRID - 1) - 0.5;
      const py = 0.5 - y / (GRID - 1);
      const d = at(x, y);
      const u = x / (GRID - 1);
      const v = 1 - y / (GRID - 1);

      frontIndex[y * GRID + x] = positions.length / 3;
      positions.push(px, py, d * FRONT_DEPTH);
      uvs.push(u, v);

      backIndex[y * GRID + x] = positions.length / 3;
      positions.push(px, py, -d * BACK_DEPTH);
      uvs.push(u, v);
    }
  }

  if (positions.length < 12) return null;

  const front = (x: number, y: number) => frontIndex[y * GRID + x]!;
  const back = (x: number, y: number) => backIndex[y * GRID + x]!;

  for (let y = 0; y < GRID - 1; y += 1) {
    for (let x = 0; x < GRID - 1; x += 1) {
      const corners = [
        [x, y],
        [x + 1, y],
        [x + 1, y + 1],
        [x, y + 1],
      ] as const;
      if (!corners.every(([cx, cy]) => inside(cx, cy))) continue;

      const [a, b, c, d] = corners.map(([cx, cy]) => front(cx, cy)) as [
        number,
        number,
        number,
        number,
      ];
      indices.push(a, c, b, a, d, c);

      // Back winds the other way so its normals face away from the viewer.
      const [e, f, g, h] = corners.map(([cx, cy]) => back(cx, cy)) as [
        number,
        number,
        number,
        number,
      ];
      indices.push(e, f, g, e, g, h);
    }
  }

  // Rim. A horizontal step from inside to outside means a vertical silhouette
  // edge, and vice versa — each becomes a quad joining front to back.
  for (let y = 0; y < GRID - 1; y += 1) {
    for (let x = 0; x < GRID - 1; x += 1) {
      const here = inside(x, y);
      if (here !== inside(x + 1, y) && inside(x, y + 1) === here) {
        const edgeX = here ? x : x + 1;
        stitch(indices, front(edgeX, y), front(edgeX, y + 1), back(edgeX, y), back(edgeX, y + 1), here);
      }
      if (here !== inside(x, y + 1) && inside(x + 1, y) === here) {
        const edgeY = here ? y : y + 1;
        stitch(indices, front(x, edgeY), front(x + 1, edgeY), back(x, edgeY), back(x + 1, edgeY), !here);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  // Smooth normals across the displaced surface, so it lights as a form rather
  // than as a field of facets.
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Turns a noisy luminance threshold into one solid silhouette.
 *
 *   1. dilate then erode — closes gaps and interior speckle without growing the
 *      outline, which a plain dilate would
 *   2. flood the background inward from the border; every cell it cannot reach
 *      is interior, however dark it happens to be
 *
 * Step 2 is what saves dark-on-dark subjects: a shadowed chest is unreachable
 * from outside, so it stays part of the body instead of becoming a hole.
 */
function closeAndFill(mask: Buffer): Uint8Array<ArrayBuffer> {
  const raw = new Uint8Array(GRID * GRID);
  for (let i = 0; i < raw.length; i += 1) raw[i] = mask[i]! > MASK_CUTOFF ? 1 : 0;

  const morph = (src: Uint8Array<ArrayBuffer>, want: 0 | 1): Uint8Array<ArrayBuffer> => {
    const out = new Uint8Array(src.length);
    out.set(src);
    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        let hit = false;
        for (let dy = -1; dy <= 1 && !hit; dy += 1) {
          for (let dx = -1; dx <= 1 && !hit; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
            if (src[ny * GRID + nx] === want) hit = true;
          }
        }
        if (hit) out[y * GRID + x] = want;
      }
    }
    return out;
  };

  let work: Uint8Array<ArrayBuffer> = raw;
  for (let i = 0; i < 2; i += 1) work = morph(work, 1); // dilate
  for (let i = 0; i < 2; i += 1) work = morph(work, 0); // erode back

  // Flood the outside. Anything unvisited and not already solid is a hole.
  const outside = new Uint8Array(GRID * GRID);
  const queue: number[] = [];
  for (let x = 0; x < GRID; x += 1) {
    queue.push(x, (GRID - 1) * GRID + x);
  }
  for (let y = 0; y < GRID; y += 1) {
    queue.push(y * GRID, y * GRID + GRID - 1);
  }

  while (queue.length > 0) {
    const index = queue.pop()!;
    if (outside[index] === 1 || work[index] === 1) continue;
    outside[index] = 1;
    const x = index % GRID;
    const y = (index - x) / GRID;
    if (x > 0) queue.push(index - 1);
    if (x < GRID - 1) queue.push(index + 1);
    if (y > 0) queue.push(index - GRID);
    if (y < GRID - 1) queue.push(index + GRID);
  }

  const filled = new Uint8Array(GRID * GRID);
  for (let i = 0; i < filled.length; i += 1) filled[i] = outside[i] === 1 ? 0 : 1;
  return filled;
}

/** One rim quad, wound so its normal points out of the silhouette. */
function stitch(
  indices: number[],
  f0: number,
  f1: number,
  b0: number,
  b1: number,
  flip: boolean,
) {
  if (f0 < 0 || f1 < 0 || b0 < 0 || b1 < 0) return;
  if (flip) indices.push(f0, b1, b0, f0, f1, b1);
  else indices.push(f0, b0, b1, f0, b1, f1);
}

main().catch((error) => {
  console.error('\nBake failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
