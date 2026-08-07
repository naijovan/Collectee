/**
 * Renders a collectible's real .glb geometry — tier 1 of the chain documented
 * in `config/modelRegistry.ts`.
 *
 * Two jobs beyond loading:
 *
 *   - **Normalise.** Generated meshes arrive at whatever scale and offset the
 *     tool exported. The room places items on pedestals of a fixed size, so a
 *     model that came out 40 units long would spear through the wall. This
 *     measures the bounding box and rescales so the longest axis is `size`,
 *     then recentres on the origin. Means a model can be swapped for a better
 *     one without touching a single placement.
 *
 *   - **Light the rarity.** The room's key lights are theme-coloured, so a
 *     bare mesh reads flat against a themed backdrop. A rarity-tinted emissive
 *     floor bounce sits under it, matching what `DisplayPlinth` does for the
 *     relief path.
 *
 * `useLoader` suspends, so every call site must already sit inside a
 * `<Suspense>` with a cheaper fallback — the relief or the procedural mesh.
 * That is the degrade path, and it is why this component never renders a
 * placeholder of its own.
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useLoader } from '@react-three/fiber/native';
import { Asset } from 'expo-asset';
import { Box3, LinearFilter, SRGBColorSpace, TextureLoader, Vector3 } from 'three';
import type { Group, Mesh, MeshStandardMaterial, Object3D, Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Metro hands `require('…​.glb')` back as a numeric module id, which GLTFLoader
 * cannot open. `expo-asset` maps it to something fetchable — a bundled file URI
 * on device, a served URL on web.
 *
 * `localUri` is only populated after a download on native; on web it is null and
 * `uri` is already correct, so the fallback order matters.
 */
function sourceUri(module: number): string {
  const asset = Asset.fromModule(module);
  return asset.localUri ?? asset.uri;
}

export function CollectibleGLTF({
  module,
  texture: textureModule,
  accent,
  size = 2.4,
  bottomY,
}: {
  /** The value from `modelFor(item.id)` — a Metro module id. */
  module: number;
  /**
   * Colour render to skin the mesh with. Baked meshes ship geometry and UVs but
   * no embedded image, so the texture lives once in the bundle instead of once
   * per model, and re-generated art appears without re-baking the mesh.
   */
  texture?: number | null;
  /** Rarity colour, used for the floor bounce. */
  accent: string;
  /** Longest axis after normalisation, in world units. */
  size?: number;
  /** Optional room-local surface to seat the model on. Omitted in the viewer. */
  bottomY?: number;
}) {
  const uri = useMemo(() => sourceUri(module), [module]);
  const gltf = useLoader(GLTFLoader, uri);

  // `scene` is shared across every instance of the same model, so it is cloned
  // before being scaled — otherwise two rooms showing the same item fight over
  // one transform and the second one to mount wins. Materials must be cloned as
  // well: Object3D.clone() keeps them shared, and projecting art onto one legacy
  // model would otherwise mutate every other instance of that GLB.
  const scene = useMemo(() => cloneScene(gltf.scene), [gltf]);

  return textureModule == null ? (
    <PreparedCollectible
      scene={scene}
      skin={null}
      accent={accent}
      size={size}
      bottomY={bottomY}
    />
  ) : (
    <ProjectedCollectible
      scene={scene}
      textureModule={textureModule}
      accent={accent}
      size={size}
      bottomY={bottomY}
    />
  );
}

function ProjectedCollectible({
  scene,
  textureModule,
  accent,
  size,
  bottomY,
}: {
  scene: Object3D;
  textureModule: number;
  accent: string;
  size: number;
  bottomY?: number;
}) {
  const skin = useLoader(TextureLoader, textureModule as unknown as string);
  return (
    <PreparedCollectible
      scene={scene}
      skin={skin}
      accent={accent}
      size={size}
      bottomY={bottomY}
    />
  );
}

function PreparedCollectible({
  scene,
  skin,
  accent,
  size,
  bottomY,
}: {
  scene: Object3D;
  skin: Texture | null;
  accent: string;
  size: number;
  bottomY?: number;
}) {
  const holder = useRef<Group>(null);
  // Capture source-space metrics once, before the scene is normalised. Reusing
  // these prevents a responsive resize from measuring an already-scaled scene
  // and applying the scale a second time.
  const metrics = useMemo(() => {
    const bounds = new Box3().setFromObject(scene);
    const span = bounds.getSize(new Vector3());
    return {
      centre: bounds.getCenter(new Vector3()),
      longest: Math.max(span.x, span.y, span.z),
      minY: bounds.min.y,
    };
  }, [scene]);

  useLayoutEffect(() => {
    const group = holder.current;
    if (!group) return;

    if (metrics.longest === 0) return;

    const scale = size / metrics.longest;
    scene.scale.setScalar(scale);

    // Recentre after scaling, not before — the box is measured in the mesh's
    // own units and the offset has to be applied in the scaled frame.
    const centre = metrics.centre.clone().multiplyScalar(scale);
    const alignedY = bottomY === undefined ? -centre.y : bottomY - metrics.minY * scale;
    scene.position.set(-centre.x, alignedY, -centre.z);

    let hasProjectedMaterial = false;
    scene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      if (materialsFor(mesh).some((material) => material.name === 'projected-art')) {
        hasProjectedMaterial = true;
      }
    });

    scene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (skin == null) return;
      // UVs are a straight projection of the source image, so the render lands
      // on the front exactly as drawn — and wraps onto the mirrored back, which
      // is what makes an inferred back read as the same object.
      skin.colorSpace = SRGBColorSpace;
      skin.minFilter = LinearFilter;
      skin.magFilter = LinearFilter;
      skin.anisotropy = 8;
      const materials = materialsFor(mesh);
      const projected = materials.filter((material) => material.name === 'projected-art');
      // Legacy baked meshes have one unnamed geometry material. Hybrid models
      // explicitly name the skin layer so structural gold/ivory materials keep
      // their PBR response instead of receiving the complete 2D render.
      for (const material of hasProjectedMaterial ? projected : materials) {
        material.map = skin;
        // The projected art doubles as a restrained micro-relief map. Bright
        // engraved trim catches the showroom lights while the shallow baked
        // silhouette supplies the actual thickness.
        if (material.name === 'projected-art') {
          material.bumpMap = skin;
          material.bumpScale = 0.018;
        }
        material.needsUpdate = true;
      }
    });
  }, [scene, size, skin, bottomY, metrics]);

  return (
    <group ref={holder}>
      <primitive object={scene} />
      {/* Floor bounce. Sits below the model so the silhouette keeps a rim even
          when the theme's key lights are pointing the other way. */}
      <pointLight
        position={[0, bottomY ?? -size * 0.55, size * 0.3]}
        intensity={3.2}
        distance={size * 3}
        color={accent}
      />
    </group>
  );
}

function cloneScene(source: Object3D): Object3D {
  const clone = source.clone(true);
  clone.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => material.clone())
      : mesh.material.clone();
  });
  return clone;
}

function materialsFor(mesh: Mesh): MeshStandardMaterial[] {
  return (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MeshStandardMaterial[];
}
