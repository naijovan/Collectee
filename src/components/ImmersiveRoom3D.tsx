import { Suspense, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import { Image } from 'expo-image';
import { MathUtils } from 'three';
import type { Group } from 'three';

import { colors, radius, rarityColors, spacing } from '@/theme/theme';
import type { Item, Room, RoomTheme, Slot } from '@/types';

import { backdropFor } from '@/config/artRegistry';
import { modelFor } from '@/config/modelRegistry';

import { ArtworkRelief3D, itemTexture } from './ArtworkRelief3D';
import { CollectibleGLTF } from './CollectibleGLTF';
import { RoomAtmosphere } from './RoomAtmosphere';
import { CollectibleModel3D } from './Collectible3DViewer';
import { resolveBackdrop } from './backdrops';

interface GalleryControls {
  yaw: number;
  pitch: number;
  targetYaw: number;
  targetPitch: number;
  velocityYaw: number;
  dragging: boolean;
}

interface GalleryPlacement {
  item: Item;
  slot: Slot;
}

const INITIAL_CONTROLS: GalleryControls = {
  yaw: 0,
  pitch: 0,
  targetYaw: 0,
  targetPitch: 0,
  velocityYaw: 0,
  dragging: false,
};

/**
 * The world-space box the fractional slot map is projected into, in three.js
 * units. Chosen so the full 0..1 slot range sits inside the camera frustum at
 * the immersive fov without the outer wall slots clipping.
 */
const ROOM = { width: 10.5, height: 6.2, depthStep: 1.35 };

/**
 * Slot → world position. §12.3 defines slots as fractions of the backdrop:
 * `x`/`y` are the top-left corner, `w`/`h` the size, `depth` the parallax layer
 * (0 back, 2 front). This is the whole reason those coordinates are fractional
 * — the same map has to work at any backdrop resolution, and now in 3D too.
 *
 * `y` is flipped because slot space runs top-down like a screen while three.js
 * runs bottom-up, and the centre of the slot is used rather than its corner so
 * an item sits in its box rather than hanging off the top-left of it.
 */
function slotToWorld(slot: Slot): [number, number, number] {
  const cx = slot.x + slot.w / 2;
  const cy = slot.y + slot.h / 2;
  return [
    (cx - 0.5) * ROOM.width,
    (0.5 - cy) * ROOM.height,
    (slot.depth - 1) * ROOM.depthStep,
  ];
}

/** Slot → display size, so a hero pedestal reads bigger than a wall panel. */
function slotToSize(slot: Slot): { width: number; height: number } {
  // 0.82, not 1: slot boxes tile the backdrop with no gutter, so a display at
  // full slot size touches its neighbour. This is the gutter.
  const INSET = 0.82;
  return { width: slot.w * ROOM.width * INSET, height: slot.h * ROOM.height * INSET };
}

export function ImmersiveRoom3D({
  room,
  theme,
  itemsByOwnedId,
  onSlotPress,
  onInspect3D,
  width,
  height: heightProp,
  immersive = false,
}: {
  room: Room;
  theme?: RoomTheme | null;
  itemsByOwnedId: ReadonlyMap<string, Item>;
  onSlotPress?: (slot: Slot) => void;
  onInspect3D?: (item: Item) => void;
  width: number;
  /** Explicit height. Defaults to the 0.68 card ratio used inline on a page. */
  height?: number;
  /** Full-screen mode: no card chrome, wider field of view, richer atmosphere. */
  immersive?: boolean;
}) {
  const controls = useRef<GalleryControls>({ ...INITIAL_CONTROLS });
  const gestureStart = useRef({ yaw: 0, pitch: 0 });
  // Inline on a page this is a card at a fixed ratio. Full-screen it takes the
  // height it is given, and the camera has to widen or the gallery crops.
  const height = heightProp ?? width * 0.68;
  const aspect = width / Math.max(height, 1);
  const fov = immersive ? (aspect < 1 ? 62 : 50) : 42;
  const cameraZ = immersive ? (aspect < 1 ? 10.5 : 8.2) : 8.6;
  // Same precedence as RoomScene: the theme's 1920x1080 render, then the
  // path-keyed fallback, then a flat wash. The 3D scene sits over this.
  const backdrop = (theme ? backdropFor(theme.id) : null) ?? resolveBackdrop(room.backdropUrl);
  const placements = room.placements
    .map((placement) => {
      const item = itemsByOwnedId.get(placement.ownedItemId);
      const slot = room.slots.find((candidate) => candidate.id === placement.slotId);
      return item && slot ? { item, slot } : null;
    })
    .filter((entry): entry is GalleryPlacement => entry !== null)
    // Back layer first so nearer displays draw over further ones. No cap: the
    // room shows what the user arranged, and Weapon Vault has eleven slots.
    .sort((a, b) => a.slot.depth - b.slot.depth);

  const focusedEntry =
    placements.find((entry) => entry.slot.id === room.settings.focusedSlotId) ?? null;

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.hypot(gesture.dx, gesture.dy) > 4,
        onPanResponderGrant: () => {
          controls.current.dragging = true;
          controls.current.velocityYaw = 0;
          gestureStart.current = {
            yaw: controls.current.targetYaw,
            pitch: controls.current.targetPitch,
          };
        },
        onPanResponderMove: (_event, gesture) => {
          controls.current.targetYaw = clamp(
            gestureStart.current.yaw + gesture.dx * 0.0025,
            -0.24,
            0.24,
          );
          controls.current.targetPitch = clamp(
            gestureStart.current.pitch + gesture.dy * 0.0015,
            -0.08,
            0.08,
          );
          controls.current.velocityYaw = gesture.vx * 0.3;
        },
        onPanResponderRelease: (_event, gesture) => {
          controls.current.dragging = false;
          controls.current.velocityYaw = gesture.vx * 0.3;
        },
        onPanResponderTerminate: () => {
          controls.current.dragging = false;
        },
      }),
    [],
  );

  function resetView() {
    controls.current = { ...INITIAL_CONTROLS };
  }

  function select(entry: GalleryPlacement) {
    if (room.settings.focusedSlotId === entry.slot.id && onInspect3D) {
      onInspect3D(entry.item);
      return;
    }
    onSlotPress?.(entry.slot);
  }

  return (
    <View
      accessibilityLabel="Interactive 3D collection room"
      style={[styles.viewport, immersive && styles.viewportImmersive, { width, height }]}
      {...pan.panHandlers}
    >
      {backdrop ? (
        <Image
          source={backdrop}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.backdropFallback]} />
      )}
      <View pointerEvents="none" style={styles.backdropShade} />

      <Canvas
        camera={{ position: [0, 0.55, cameraZ], fov, near: 0.1, far: 80 }}
        gl={{ alpha: true }}
        style={StyleSheet.absoluteFill}
      >
        <ambientLight intensity={1.45} />
        <hemisphereLight args={[colors.textPrimary, colors.surfaceSunken, 2]} />
        <directionalLight position={[0, 6, 5]} intensity={4.8} />
        <pointLight
          position={[-5, 2, 3]}
          intensity={7}
          distance={13}
          color={theme?.palette[1] ?? colors.accent}
        />
        <pointLight
          position={[5, 1, 4]}
          intensity={7}
          distance={13}
          color={theme?.palette[2] ?? colors.warning}
        />
        <RoomAtmosphere
          palette={theme?.palette ?? []}
          intensity={immersive ? 1 : 0.55}
          focused={room.settings.focusedSlotId !== null}
        />
        <Gallery
          controls={controls}
          focusedSlotId={room.settings.focusedSlotId}
          focusTarget={focusedEntry ? slotToWorld(focusedEntry.slot) : null}
          placements={placements}
          spread={aspect < 1 ? 0.62 : 1}
          onSelect={select}
        />
      </Canvas>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View style={styles.badge}>
          <View style={styles.liveDot} />
          <Text style={styles.badgeText}>3D ROOM</Text>
        </View>
        <Pressable
          accessibilityLabel="Reset room view"
          hitSlop={10}
          onPress={resetView}
          style={styles.resetButton}
        >
          <Text style={styles.resetIcon}>↺</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Gallery({
  controls,
  focusedSlotId,
  focusTarget,
  placements,
  spread,
  onSelect,
}: {
  controls: MutableRefObject<GalleryControls>;
  focusedSlotId: string | null;
  /** World position of the focal slot, or null when the camera is pulled back. */
  focusTarget: readonly [number, number, number] | null;
  placements: GalleryPlacement[];
  /**
   * Uniform fit scale. The slot map spans the full backdrop, which overflows a
   * portrait frustum, so the whole gallery shrinks to fit.
   *
   * It has to be uniform. Squeezing x while leaving each display at its slot
   * size closes the gaps between them but not the displays themselves, and they
   * overlap — which is exactly what happened when this scaled positions only.
   */
  spread: number;
  onSelect: (entry: GalleryPlacement) => void;
}) {
  const room = useRef<Group>(null);

  useFrame((_state, delta) => {
    const group = room.current;
    if (!group) return;
    const control = controls.current;

    if (!control.dragging) {
      control.targetYaw = clamp(
        control.targetYaw + control.velocityYaw * delta,
        -0.24,
        0.24,
      );
      control.velocityYaw *= Math.pow(0.08, delta);
    }

    control.yaw = MathUtils.damp(control.yaw, control.targetYaw, 9, delta);
    control.pitch = MathUtils.damp(control.pitch, control.targetPitch, 9, delta);
    group.rotation.y = control.yaw;
    group.rotation.x = control.pitch;

    // Look-at focus (§11 F4): "tapping a different item transitions the camera,
    // zooming and re-centring on it. This transition is the immersion."
    // The room moves rather than the camera — same result on screen, and it
    // keeps the backdrop image, which is a DOM layer behind the canvas, still.
    const [tx, ty] = focusTarget ?? [0, 0];
    const zoom = (focusTarget ? 1.32 : 1) * spread;
    group.position.x = MathUtils.damp(group.position.x, -tx * zoom, 6, delta);
    group.position.y = MathUtils.damp(group.position.y, 0.1 - ty * zoom, 6, delta);
    const scale = MathUtils.damp(group.scale.x, zoom, 6, delta);
    group.scale.setScalar(scale);
  });

  return (
    <group ref={room} position={[0, 0.1, 0]}>
      {placements.map((entry, index) => {
        return (
          <GalleryCollectible
            key={entry.slot.id}
            entry={entry}
            focused={focusedSlotId === entry.slot.id}
            index={index}
            position={slotToWorld(entry.slot)}
            size={slotToSize(entry.slot)}
            onSelect={onSelect}
          />
        );
      })}
    </group>
  );
}

function GalleryCollectible({
  entry,
  focused,
  index,
  position,
  size,
  onSelect,
}: {
  entry: GalleryPlacement;
  focused: boolean;
  index: number;
  position: readonly [number, number, number];
  /** Display size in world units, derived from the slot's fractional w/h. */
  size: { width: number; height: number };
  onSelect: (entry: GalleryPlacement) => void;
}) {
  const holder = useRef<Group>(null);
  const accent = rarityColors[entry.item.rarityTier];
  const mesh = modelFor(entry.item.id);
  const art = itemTexture(entry.item);
  const kind = modelKind(entry.item);
  // "Featured" is now a property of the slot, not of array order — a pedestal
  // is bigger than a wall panel because the theme says so.
  const featured = entry.slot.kind === 'pedestal';
  const artWidth = size.width;
  const artHeight = size.height;
  const fallbackScale = (kind === 'rifle' ? 0.32 : kind === 'blade' ? 0.46 : 0.5) * (size.width / 1.72);

  useFrame(({ clock }) => {
    if (!holder.current) return;
    // Real geometry turns all the way round because it has a back. A relief is
    // a plane, so it only ever sways — past about 0.1rad you see its edge.
    holder.current.rotation.y = mesh
      ? clock.elapsedTime * (focused ? 0.35 : 0.22) + index
      : Math.sin(clock.elapsedTime * 0.72 + index) * (focused ? 0.1 : 0.045);
    holder.current.position.y = Math.sin(clock.elapsedTime * 1.25 + index) * 0.05;
  });

  return (
    <group position={position}>
      <DisplayPlinth accent={accent} focused={focused} compact={!featured} />
      <group ref={holder} position={[0, 0, 0]}>
        {/* Tier order per config/modelRegistry.ts: real mesh, then relief, then
            procedural. Suspense catches the async tiers and shows the synchronous
            procedural one meanwhile, so a slot is never empty. */}
        <Suspense
          fallback={
            <group scale={fallbackScale}>
              <CollectibleModel3D item={entry.item} />
            </group>
          }
        >
          {mesh ? (
            <CollectibleGLTF module={mesh} accent={accent} size={Math.max(size.width, size.height) * 0.92} />
          ) : art ? (
            <ArtworkRelief3D
              source={art}
              accent={accent}
              width={artWidth}
              height={artHeight}
              depth={featured ? 0.18 : 0.12}
            />
          ) : (
            <group scale={fallbackScale}>
              <CollectibleModel3D item={entry.item} />
            </group>
          )}
        </Suspense>
      </group>
      <mesh
        position={[0, 0, 0.1]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(entry);
        }}
      >
        <boxGeometry args={[artWidth + 0.18, artHeight + 0.18, 0.75]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function DisplayPlinth({
  accent,
  focused,
  compact,
}: {
  accent: string;
  focused: boolean;
  compact: boolean;
}) {
  const radius = compact ? 0.48 : 0.72;

  return (
    <group position={[0, compact ? -0.55 : -0.85, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, focused ? 0.055 : 0.03, 8, 32]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={focused ? 4.5 : 2.2}
        />
      </mesh>
    </group>
  );
}

function modelKind(item: Item): 'rifle' | 'blade' | 'hero' {
  const name = item.name.toLowerCase();
  if (name.includes('karambit') || name.includes('blade') || name.includes('knife')) {
    return 'blade';
  }
  return item.title === 'mlbb' ? 'hero' : 'rifle';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  /** Full-screen: the card border and radius would frame it as a widget. */
  viewportImmersive: { borderRadius: 0, borderWidth: 0 },
  backdropFallback: { backgroundColor: colors.surfaceSunken },
  backdropShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.surfaceSunken,
    opacity: 0.08,
  },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
  },
  badgeText: { color: colors.textPrimary, fontSize: 11, fontWeight: '700' },
  resetButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  resetIcon: { color: colors.textPrimary, fontSize: 18, lineHeight: 21 },
});
