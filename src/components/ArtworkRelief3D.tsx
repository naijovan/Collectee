import { useEffect } from 'react';
import { useLoader } from '@react-three/fiber/native';
import {
  LinearFilter,
  SRGBColorSpace,
  TextureLoader,
} from 'three';

import { artFor } from '@/config/artRegistry';
import { colors } from '@/theme/theme';
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

export function ArtworkRelief3D({
  source,
  accent,
  width = 3,
  height = 2,
  depth = 0.16,
}: {
  source: number;
  accent: string;
  width?: number;
  height?: number;
  depth?: number;
}) {
  // R3F Native resolves Metro module IDs through expo-asset at runtime.
  const texture = useLoader(TextureLoader, source as unknown as string);

  useEffect(() => {
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);

  const rail = 0.045;

  return (
    <group>
      <mesh position={[0, 0, -depth * 0.55]}>
        <boxGeometry args={[width + rail * 3, height + rail * 3, depth]} />
        <meshStandardMaterial
          color={colors.surfaceElevated}
          metalness={0.88}
          roughness={0.22}
        />
      </mesh>

      <mesh position={[0, 0, depth * 0.06]}>
        <planeGeometry args={[width, height, 72, 48]} />
        <meshStandardMaterial
          map={texture}
          bumpMap={texture}
          bumpScale={depth * 0.16}
          displacementMap={texture}
          displacementBias={-depth * 0.08}
          displacementScale={depth * 0.52}
          emissive={colors.textPrimary}
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
