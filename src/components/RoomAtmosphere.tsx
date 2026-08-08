/**
 * The atmosphere layer for a Showroom — the part that makes it read as
 * a space rather than items floating on a photograph.
 *
 * Everything here is procedural and asset-free, so it costs no bundle size and
 * works on every theme: the palette comes in, the mood comes out. Nothing in
 * here is interactive; it is pure ambience drawn behind and around the
 * collectibles.
 *
 * ── Performance, because this runs on a mid-tier Android phone (§11 F4) ────
 * No post-processing — bloom would mean another dependency and a second render
 * pass, and the emissive materials plus additive blending get most of the way
 * there for free. Particle counts stay in the low hundreds and every animated
 * value is written straight onto a ref inside `useFrame`, never through React
 * state, so none of this triggers a re-render.
 *
 * [ROADMAP] `FEATURES.roomLightingControls` already gates brightness and
 * animated lighting in RoomScene; when that becomes user-facing, `intensity`
 * here is the knob it should drive.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber/native';
import { AdditiveBlending, BackSide } from 'three';
import type { Group, Points } from 'three';

import { atmosphereFallback } from '@/theme/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';

/** Dust motes. Enough to catch the light, few enough to stay cheap. */
const MOTE_COUNT = 220;

/** The volume motes drift inside, in world units. Matches the gallery spread. */
const FIELD = { x: 14, y: 7, z: 8 };

export function RoomAtmosphere({
  palette,
  intensity = 1,
  focused = false,
}: {
  /** Theme palette — [base, primary, secondary]. Drives shaft and mote colour. */
  palette: readonly string[];
  /** Global dimmer. 0 kills the layer without unmounting it. */
  intensity?: number;
  /** Tightens and warms the room while an item is focused. */
  focused?: boolean;
}) {
  const primary = palette[1] ?? atmosphereFallback.primary;
  const secondary = palette[2] ?? atmosphereFallback.secondary;

  return (
    <group>
      <DustMotes colour={primary} intensity={intensity} />
      <LightShaft position={[-3.2, 4.2, -1]} colour={primary} intensity={intensity} />
      <LightShaft position={[3.2, 4.2, -1]} colour={secondary} intensity={intensity} />
      <LightShaft position={[0, 4.6, 0.4]} colour={primary} intensity={intensity * 1.15} />
      <FloorGlow colour={primary} intensity={intensity} focused={focused} />
      <Vignette colour={palette[0] ?? atmosphereFallback.base} />
    </group>
  );
}

/**
 * Slow-drifting motes. Positions are generated once and animated by moving the
 * whole cloud rather than per-particle — one transform instead of 220, and at
 * this scale the difference is invisible.
 */
function DustMotes({ colour, intensity }: { colour: string; intensity: number }) {
  const points = useRef<Points>(null);

  const positions = useMemo(() => {
    const array = new Float32Array(MOTE_COUNT * 3);
    // Deterministic scatter — no Math.random, so the same room looks the same
    // on every launch and a screenshot is reproducible.
    for (let i = 0; i < MOTE_COUNT; i += 1) {
      const a = i * 2.399963; // golden angle, gives an even non-gridded spread
      array[i * 3] = (Math.cos(a) * ((i % 37) / 37) - 0.5) * FIELD.x;
      array[i * 3 + 1] = ((i % 23) / 23 - 0.5) * FIELD.y;
      array[i * 3 + 2] = (Math.sin(a) * ((i % 29) / 29) - 0.5) * FIELD.z;
    }
    return array;
  }, []);

  const reduceMotion = useReduceMotion();

  useFrame(({ clock }) => {
    const cloud = points.current;
    if (!cloud) return;
    /* Reduce Motion keeps the motes and stops their travel: a field of dust is
       part of how the room is lit, and deleting it changes the composition,
       where freezing it does not. */
    if (reduceMotion) {
      cloud.position.y = 0;
      cloud.rotation.y = 0;
      return;
    }
    const t = clock.elapsedTime;
    // Rise and wrap. Motes climb slowly and reset at the top of the field.
    cloud.position.y = ((t * 0.08) % FIELD.y) - FIELD.y / 2;
    cloud.rotation.y = t * 0.012;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={colour}
        size={0.045}
        sizeAttenuation
        transparent
        opacity={0.5 * intensity}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/**
 * A shaft of light from an overhead fitting. A cone with additive blending and
 * no depth write — it brightens whatever is behind it instead of occluding it,
 * which is what sells it as light rather than a solid object.
 *
 * `BackSide` so the camera sees the inside of the cone; the outside face would
 * read as a hard edge.
 */
function LightShaft({
  position,
  colour,
  intensity,
}: {
  position: readonly [number, number, number];
  colour: string;
  intensity: number;
}) {
  const shaft = useRef<Group>(null);
  const reduceMotion = useReduceMotion();

  useFrame(({ clock }) => {
    if (!shaft.current) return;
    /* Reduce Motion parks it at the middle of its own range rather than at an
       end, so a still room is lit the way the composition was designed for.
       This is a `useFrame` loop, not an `Animated.loop`, which is why it was
       missed when the rest of the app was wired for Reduce Motion — the grep
       for one does not find the other. */
    if (reduceMotion) {
      shaft.current.scale.set(0.88, 1, 0.88);
      return;
    }
    // Barely-there breathing, so the room is never completely static.
    const pulse = 0.88 + Math.sin(clock.elapsedTime * 0.55 + position[0]) * 0.12;
    shaft.current.scale.set(pulse, 1, pulse);
  });

  return (
    <group ref={shaft} position={position as [number, number, number]}>
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[1.5, 7.5, 24, 1, true]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={0.07 * intensity}
          blending={AdditiveBlending}
          depthWrite={false}
          side={BackSide}
        />
      </mesh>
    </group>
  );
}

/** Pooled light on the floor, so items read as standing on something. */
function FloorGlow({
  colour,
  intensity,
  focused,
}: {
  colour: string;
  intensity: number;
  focused: boolean;
}) {
  const glow = useRef<Group>(null);

  useFrame((_state, delta) => {
    if (!glow.current) return;
    // Eases toward the focused size rather than snapping, so tapping an item
    // reads as the room responding rather than a state flip.
    const target = focused ? 1.16 : 1;
    const current = glow.current.scale.x;
    const next = current + (target - current) * Math.min(1, delta * 4);
    glow.current.scale.set(next, next, next);
  });

  return (
    <group ref={glow} position={[0, -1.45, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7.5, 48]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={0.09 * intensity}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * A large inward-facing sphere in the theme's base colour, darkening the edges
 * of frame. Cheap depth cue: it pushes the corners back and keeps attention on
 * the centre of the room without a post-processing pass.
 */
function Vignette({ colour }: { colour: string }) {
  return (
    <mesh>
      <sphereGeometry args={[26, 16, 16]} />
      <meshBasicMaterial color={colour} side={BackSide} transparent opacity={0.42} depthWrite={false} />
    </mesh>
  );
}
