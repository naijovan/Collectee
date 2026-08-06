/**
 * Builds hybrid weapon meshes without an image-to-3D service.
 *
 * The clean transparent render remains the exact front/back skin. A shallow
 * gold edge closes the silhouette so the showroom can light and rotate it
 * without inventing chunky geometry that contradicts the artwork.
 *
 * Usage:
 *   npm run bake:weapons -- codm-fennec-ascended
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import sharp from 'sharp';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

(globalThis as unknown as { FileReader: unknown }).FileReader = class {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;

  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};

const INPUT_DIR = 'assets/collectee/trellis-inputs/crown-jewels-weapons';
const OUTPUT_DIR = 'assets/collectee/models/weapons';
const GRID = 256;
const EDGE_DEPTH = 0.006;
const MAX_SKIN_DEPTH = 0.066;

const BUILDERS: Record<string, () => Promise<THREE.Scene>> = {
  'codm-fennec-ascended': () =>
    buildFennec(join(INPUT_DIR, 'codm-fennec-ascended.png')),
};

async function main() {
  const requested = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));
  const targets = requested.length > 0 ? requested : Object.keys(BUILDERS);
  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const id of targets) {
    const build = BUILDERS[id];
    if (!build) {
      console.error(`No procedural weapon builder for ${id}`);
      process.exitCode = 1;
      continue;
    }

    const scene = await build();
    const glb = await exportScene(scene);
    const output = join(OUTPUT_DIR, `${id}.glb`);
    writeFileSync(output, Buffer.from(glb));
    console.log(`Wrote ${output} (${Math.round(glb.byteLength / 1024)} KB)`);
  }
}

async function buildFennec(input: string): Promise<THREE.Scene> {
  const scene = new THREE.Scene();
  const weapon = new THREE.Group();
  weapon.name = 'Fennec Ascended hybrid';
  scene.add(weapon);

  const projectedArt = new THREE.MeshStandardMaterial({
    name: 'projected-art',
    color: '#FFFFFF',
    metalness: 0.18,
    roughness: 0.34,
  });
  const edgeGold = new THREE.MeshStandardMaterial({
    name: 'gold-edge',
    color: '#C6943D',
    emissive: '#7A4E12',
    emissiveIntensity: 0.16,
    metalness: 0.72,
    roughness: 0.24,
    side: THREE.DoubleSide,
  });

  const silhouette = await buildSilhouette(input);
  const skin = new THREE.Mesh(silhouette.surface, projectedArt);
  skin.name = 'projected-skin';
  skin.castShadow = true;
  skin.receiveShadow = true;
  weapon.add(skin);
  const edge = new THREE.Mesh(silhouette.edge, edgeGold);
  edge.name = 'silhouette-edge';
  edge.castShadow = true;
  edge.receiveShadow = true;
  weapon.add(edge);

  weapon.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  });

  return scene;
}

async function buildSilhouette(
  input: string,
): Promise<{ surface: THREE.BufferGeometry; edge: THREE.BufferGeometry }> {
  const { data } = await sharp(input)
    .ensureAlpha()
    .resize(GRID, GRID, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const inside = (x: number, y: number) => data[(y * GRID + x) * 4 + 3]! >= 96;
  const distances = distanceToEdge(inside);
  const depthAt = (x: number, y: number) => {
    const distance = distances[y * GRID + x]!;
    const blend = Math.min(distance / 18, 1);
    return EDGE_DEPTH + (MAX_SKIN_DEPTH - EDGE_DEPTH) * Math.sin((blend * Math.PI) / 2);
  };
  const positions: number[] = [];
  const uvs: number[] = [];
  const surfaceIndices: number[] = [];
  const edgePositions: number[] = [];
  const frontIndex = new Int32Array(GRID * GRID).fill(-1);
  const backIndex = new Int32Array(GRID * GRID).fill(-1);

  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      if (!inside(x, y)) continue;
      const px = x / (GRID - 1) - 0.5;
      const py = 0.5 - y / (GRID - 1);
      const u = x / (GRID - 1);
      const v = 1 - y / (GRID - 1);
      const depth = depthAt(x, y);

      frontIndex[y * GRID + x] = positions.length / 3;
      positions.push(px, py, depth);
      uvs.push(u, v);

      backIndex[y * GRID + x] = positions.length / 3;
      positions.push(px, py, -depth);
      uvs.push(u, v);
    }
  }

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

      const [a, b, c, d] = corners.map(([cx, cy]) => front(cx, cy));
      surfaceIndices.push(a!, c!, b!, a!, d!, c!);
      const [e, f, g, h] = corners.map(([cx, cy]) => back(cx, cy));
      surfaceIndices.push(e!, f!, g!, e!, g!, h!);
    }
  }

  const toX = (x: number) => x / (GRID - 1) - 0.5;
  const toY = (y: number) => 0.5 - y / (GRID - 1);
  const addEdgeQuad = (x1: number, y1: number, x2: number, y2: number) => {
    const a = [toX(x1), toY(y1), EDGE_DEPTH] as const;
    const b = [toX(x2), toY(y2), EDGE_DEPTH] as const;
    const c = [toX(x2), toY(y2), -EDGE_DEPTH] as const;
    const d = [toX(x1), toY(y1), -EDGE_DEPTH] as const;
    edgePositions.push(...a, ...c, ...b, ...a, ...d, ...c);
  };

  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      if (!inside(x, y)) continue;
      if (y === 0 || !inside(x, y - 1)) addEdgeQuad(x - 0.5, y - 0.5, x + 0.5, y - 0.5);
      if (x === GRID - 1 || !inside(x + 1, y)) {
        addEdgeQuad(x + 0.5, y - 0.5, x + 0.5, y + 0.5);
      }
      if (y === GRID - 1 || !inside(x, y + 1)) {
        addEdgeQuad(x + 0.5, y + 0.5, x - 0.5, y + 0.5);
      }
      if (x === 0 || !inside(x - 1, y)) addEdgeQuad(x - 0.5, y + 0.5, x - 0.5, y - 0.5);
    }
  }

  const surface = new THREE.BufferGeometry();
  surface.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  surface.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  surface.setIndex(surfaceIndices);
  surface.computeVertexNormals();

  const edge = new THREE.BufferGeometry();
  edge.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
  edge.computeVertexNormals();
  return { surface, edge };
}

function distanceToEdge(inside: (x: number, y: number) => boolean) {
  const distances = new Float32Array(GRID * GRID);
  const diagonal = Math.SQRT2;
  distances.fill(GRID * 2);

  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      const index = y * GRID + x;
      if (!inside(x, y)) {
        distances[index] = 0;
        continue;
      }
      if (x > 0) distances[index] = Math.min(distances[index]!, distances[index - 1]! + 1);
      if (y > 0) distances[index] = Math.min(distances[index]!, distances[index - GRID]! + 1);
      if (x > 0 && y > 0) {
        distances[index] = Math.min(distances[index]!, distances[index - GRID - 1]! + diagonal);
      }
      if (x < GRID - 1 && y > 0) {
        distances[index] = Math.min(distances[index]!, distances[index - GRID + 1]! + diagonal);
      }
    }
  }

  for (let y = GRID - 1; y >= 0; y -= 1) {
    for (let x = GRID - 1; x >= 0; x -= 1) {
      const index = y * GRID + x;
      if (!inside(x, y)) continue;
      if (x < GRID - 1) {
        distances[index] = Math.min(distances[index]!, distances[index + 1]! + 1);
      }
      if (y < GRID - 1) {
        distances[index] = Math.min(distances[index]!, distances[index + GRID]! + 1);
      }
      if (x < GRID - 1 && y < GRID - 1) {
        distances[index] = Math.min(distances[index]!, distances[index + GRID + 1]! + diagonal);
      }
      if (x > 0 && y < GRID - 1) {
        distances[index] = Math.min(distances[index]!, distances[index + GRID - 1]! + diagonal);
      }
    }
  }

  return distances;
}

function exportScene(scene: THREE.Scene): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      scene,
      (result) => resolve(result as ArrayBuffer),
      reject,
      { binary: true, onlyVisible: true },
    );
  });
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
