import { existsSync, readFileSync, statSync } from 'node:fs';

import { Box3, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import {
  VERIFIED_WEAPONS,
  verifiedWeaponInput,
} from './verified-weapon-manifest';

const MODEL_DIR = 'assets/collectee/models/weapons';
const MAX_MODEL_BYTES = 3.5 * 1024 * 1024;

async function main() {
  const loader = new GLTFLoader();

  for (const spec of VERIFIED_WEAPONS) {
    const modelPath = `${MODEL_DIR}/${spec.id}.glb`;
    const texturePath = verifiedWeaponInput(spec.id);
    assert(existsSync(modelPath), `${spec.id}: model is missing`);
    assert(existsSync(texturePath), `${spec.id}: reconstruction texture is missing`);

    const bytes = statSync(modelPath).size;
    assert(bytes <= MAX_MODEL_BYTES, `${spec.id}: ${bytes} bytes exceeds model budget`);

    const gltf = await parse(loader, readFileSync(modelPath));
    let meshes = 0;
    const materialNames = new Set<string>();
    gltf.scene.traverse((child) => {
      if (!(child as Mesh).isMesh) return;
      meshes += 1;
      const mesh = child as Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) materialNames.add(material.name);
    });

    const bounds = new Box3().setFromObject(gltf.scene);
    const size = bounds.getSize(new Vector3());
    assert(meshes >= 2, `${spec.id}: expected skin and edge meshes`);
    assert(
      materialNames.has('projected-art'),
      `${spec.id}: projected-art material is missing`,
    );
    assert(materialNames.has('gold-edge'), `${spec.id}: edge material is missing`);
    assert(
      [size.x, size.y, size.z].every(Number.isFinite) &&
        Math.max(size.x, size.y, size.z) > 0,
      `${spec.id}: model bounds are invalid`,
    );

    console.log(
      `${spec.id.padEnd(31)} ${(bytes / 1024).toFixed(0).padStart(4)} KB  ` +
        `${meshes} meshes  ${size.x.toFixed(3)} × ${size.y.toFixed(3)} × ${size.z.toFixed(3)}`,
    );
  }

  console.log(`Verified weapon models OK — ${VERIFIED_WEAPONS.length} checked.`);
}

function parse(loader: GLTFLoader, source: Buffer) {
  const data = source.buffer.slice(
    source.byteOffset,
    source.byteOffset + source.byteLength,
  ) as ArrayBuffer;
  return new Promise<Awaited<ReturnType<GLTFLoader['parseAsync']>>>((resolve, reject) => {
    loader.parse(data, '', resolve, reject);
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
