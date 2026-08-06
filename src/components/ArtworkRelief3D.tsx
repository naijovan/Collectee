import { useEffect } from 'react';
import { useLoader } from '@react-three/fiber/native';
import {
  LinearFilter,
  SRGBColorSpace,
  TextureLoader,
} from 'three';

import { artFor, depthFor } from '@/config/artRegistry';
import { DARK_PALETTE } from '@/theme/theme';
import type { Item } from '@/types';

import { resolveItemArt } from './item-art';

/**
 * The bundled texture for an item, or null when it has no render.
 *
 * Same precedence as `ItemArt` (primitives.tsx): the id-keyed `artRegistry`
 * first, then the `renderUrl`-keyed map. Both 3D surfaces go through here so
 * the room and the inspector cannot disagree about what an item looks like.
 *
 * The registry pack is also the better source for relief specifically — its
 * objects sit on empty backgrounds, so the displacement map raises the item
 * rather than embossing a whole background scene along with it.
 */
export function itemTexture(item: Item): number | null {
  const entry = artFor(item.id);
  if (entry !== null) return entry.source as number;
  return resolveItemArt(item.renderUrl);
}

/**
 * The baked depth map for an item, or null.
 *
 * Only the id-keyed registry has these — the `renderUrl` fallback path predates
 * the bake, so art arriving that way displaces by luminance as before rather
 * than not rendering at all.
 */
export function itemDepth(item: Item): number | null {
  return (depthFor(item.id) as number | null) ?? null;
}

export function ArtworkRelief3D({
  source,
  depthSource,
  accent,
  width = 3,
  height = 2,
  depth = 0.16,
}: {
  source: number;
  /**
   * Baked depth map. Without one the colour image is used, which makes
   * brightness into height — kept only so art on the legacy `renderUrl` path
   * still renders.
   */
  depthSource?: number | null;
  accent: string;
  width?: number;
  height?: number;
  depth?: number;
}) {
  // R3F Native resolves Metro module IDs through expo-asset at runtime.
  const texture = useLoader(TextureLoader, source as unknown as string);
  const depthTexture = useLoader(
    TextureLoader,
    (depthSource ?? source) as unknown as string,
  );
  const hasRealDepth = depthSource != null;

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  useEffect(() => {
    // Linear, NOT sRGB — this is height data, not colour. Decoding it as sRGB
    // would apply a gamma curve to the displacement and flatten the mid-range.
    depthTexture.minFilter = LinearFilter;
    depthTexture.magFilter = LinearFilter;
    depthTexture.needsUpdate = true;
  }, [depthTexture]);

  const rail = 0.045;

  return (
    <group>
      <mesh position={[0, 0, -depth * 0.55]}>
        <boxGeometry args={[width + rail * 3, height + rail * 3, depth]} />
        <meshStandardMaterial
          color={DARK_PALETTE.surfaceElevated}
          metalness={0.88}
          roughness={0.22}
        />
      </mesh>

      <mesh position={[0, 0, depth * 0.06]}>
        {/* Denser with a real depth map: displacement can only move existing
            vertices, so silhouette fidelity is capped by subdivision. 144x96 is
            ~14k verts — cheap next to a loaded mesh, and it is what lets an
            edge read as an edge rather than a staircase. */}
        <planeGeometry args={[width, height, hasRealDepth ? 144 : 72, hasRealDepth ? 96 : 48]} />
        <meshStandardMaterial
          map={texture}
          bumpMap={depthTexture}
          bumpScale={depth * (hasRealDepth ? 0.34 : 0.16)}
          displacementMap={depthTexture}
          // Real depth earns a much bigger push: it is the object's actual
          // shape, so the barrel comes forward instead of every bright pixel.
          // Bias recentres it so the plane sits mid-relief rather than in front.
          displacementBias={-depth * (hasRealDepth ? 1.15 : 0.08)}
          displacementScale={depth * (hasRealDepth ? 2.3 : 0.52)}
          emissive={DARK_PALETTE.textPrimary}
          emissiveMap={texture}
          emissiveIntensity={0.12}
          metalness={0.12}
          roughness={0.55}
        />
      </mesh>

      <mesh position={[0, 0, -depth - 0.006]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial
          map={texture}
        />
      </mesh>

      {[
        { position: [0, height / 2 + rail, depth * 0.02], size: [width + rail * 2, rail, rail] },
        { position: [0, -height / 2 - rail, depth * 0.02], size: [width + rail * 2, rail, rail] },
        { position: [-width / 2 - rail, 0, depth * 0.02], size: [rail, height + rail * 2, rail] },
        { position: [width / 2 + rail, 0, depth * 0.02], size: [rail, height + rail * 2, rail] },
      ].map((edge, index) => (
        <mesh
          key={index}
          position={edge.position as [number, number, number]}
        >
          <boxGeometry args={edge.size as [number, number, number]} />
          <meshStandardMaterial
            color={accent}
            emissive={accent}
            emissiveIntensity={2.2}
            metalness={0.8}
            roughness={0.18}
          />
        </mesh>
      ))}
    </group>
  );
}
