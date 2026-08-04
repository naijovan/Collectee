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
import type { Group, Mesh, MeshStandardMaterial } from 'three';
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
}) {
  const uri = useMemo(() => sourceUri(module), [module]);
  const gltf = useLoader(GLTFLoader, uri);
  const holder = useRef<Group>(null);
  const skin = useLoader(
    TextureLoader,
    (textureModule ?? module) as unknown as string,
  );

  // `scene` is shared across every instance of the same model, so it is cloned
  // before being scaled — otherwise two rooms showing the same item fight over
  // one transform and the second one to mount wins.
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);

  useLayoutEffect(() => {
    const group = holder.current;
    if (!group) return;

    const bounds = new Box3().setFromObject(scene);
    const span = bounds.getSize(new Vector3());
    const longest = Math.max(span.x, span.y, span.z);
    if (longest === 0) return;

    const scale = size / longest;
    scene.scale.setScalar(scale);

    // Recentre after scaling, not before — the box is measured in the mesh's
    // own units and the offset has to be applied in the scaled frame.
    const centre = bounds.getCenter(new Vector3()).multiplyScalar(scale);
    scene.position.set(-centre.x, -centre.y, -centre.z);

    scene.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (textureModule == null) return;
      // UVs are a straight projection of the source image, so the render lands
      // on the front exactly as drawn — and wraps onto the mirrored back, which
      // is what makes an inferred back read as the same object.
      const material = mesh.material as MeshStandardMaterial;
      skin.colorSpace = SRGBColorSpace;
      skin.minFilter = LinearFilter;
      skin.magFilter = LinearFilter;
      skin.anisotropy = 8;
      material.map = skin;
      material.needsUpdate = true;
    });
  }, [scene, size, skin, textureModule]);

  return (
    <group ref={holder}>
      <primitive object={scene} />
      {/* Floor bounce. Sits below the model so the silhouette keeps a rim even
          when the theme's key lights are pointing the other way. */}
      <pointLight
        position={[0, -size * 0.55, size * 0.3]}
        intensity={3.2}
        distance={size * 3}
        color={accent}
      />
    </group>
  );
}
