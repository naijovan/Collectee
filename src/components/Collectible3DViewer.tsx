import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import { MathUtils } from 'three';
import type { Group } from 'three';

import { colors, radius, rarityColors, spacing, typography } from '@/theme/theme';
import { GAME_SHORT_LABELS } from '@/types';
import type { Item } from '@/types';

import { modelFor } from '@/config/modelRegistry';

import { ArtworkRelief3D, itemTexture } from './ArtworkRelief3D';
import { CollectibleGLTF } from './CollectibleGLTF';

interface ViewerControls {
  yaw: number;
  pitch: number;
  zoom: number;
  targetYaw: number;
  targetPitch: number;
  targetZoom: number;
  velocityYaw: number;
  dragging: boolean;
  autoRotate: boolean;
}

type ModelKind = 'rifle' | 'blade' | 'hero';

const INITIAL_CONTROLS: ViewerControls = {
  yaw: -0.45,
  pitch: 0.08,
  zoom: 1,
  targetYaw: -0.45,
  targetPitch: 0.08,
  targetZoom: 1,
  velocityYaw: 0,
  dragging: false,
  autoRotate: true,
};

export function Collectible3DViewer({
  item,
  onClose,
}: {
  item: Item | null;
  onClose: () => void;
}) {
  const controls = useRef<ViewerControls>({ ...INITIAL_CONTROLS });
  const gestureStart = useRef({ yaw: 0, pitch: 0, zoom: 1, pinchDistance: 0 });
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    controls.current = { ...INITIAL_CONTROLS };
    setAutoRotate(true);
  }, [item?.id]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const state = controls.current;
          state.dragging = true;
          state.velocityYaw = 0;
          if (state.autoRotate) {
            state.autoRotate = false;
            setAutoRotate(false);
          }
          gestureStart.current = {
            yaw: state.targetYaw,
            pitch: state.targetPitch,
            zoom: state.targetZoom,
            pinchDistance: distanceBetweenTouches(event.nativeEvent.touches),
          };
        },
        onPanResponderMove: (event, gesture) => {
          const state = controls.current;
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            const distance = distanceBetweenTouches(touches);
            const start = gestureStart.current.pinchDistance || distance;
            state.targetZoom = clamp(gestureStart.current.zoom * (distance / start), 0.72, 1.75);
            return;
          }

          state.targetYaw = gestureStart.current.yaw + gesture.dx * 0.0025;
          state.targetPitch = clamp(gestureStart.current.pitch + gesture.dy * 0.008, -0.52, 0.52);
          state.velocityYaw = gesture.vx * 2.4;
        },
        onPanResponderRelease: (_event, gesture) => {
          controls.current.dragging = false;
          controls.current.velocityYaw = gesture.vx * 2.4;
        },
        onPanResponderTerminate: () => {
          controls.current.dragging = false;
        },
      }),
    [],
  );

  function resetView() {
    const keepAutoRotate = controls.current.autoRotate;
    controls.current = { ...INITIAL_CONTROLS, autoRotate: keepAutoRotate };
  }

  function toggleAutoRotate() {
    const next = !controls.current.autoRotate;
    controls.current.autoRotate = next;
    controls.current.velocityYaw = 0;
    setAutoRotate(next);
  }

  return (
    <Modal
      visible={item !== null}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.overline}>INTERACTIVE 3D CONCEPT</Text>
            <Text style={styles.title} numberOfLines={1}>
              {item?.name ?? 'Collectible'}
            </Text>
            <Text style={styles.meta}>
              {item ? GAME_SHORT_LABELS[item.title] : ''} ·{' '}
              {item ? item.rarityLabel : ''}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Close 3D viewer"
            hitSlop={12}
            onPress={onClose}
            style={styles.iconButton}
          >
            <Text style={styles.closeIcon}>×</Text>
          </Pressable>
        </View>

        <View style={styles.stage}>
          {item ? (
            <Canvas
              camera={{ position: [0, 1.2, 9.5], fov: 38, near: 0.1, far: 100 }}
              style={StyleSheet.absoluteFill}
            >
              <color attach="background" args={[colors.surfaceSunken]} />
              <fog attach="fog" args={[colors.surfaceSunken, 10, 18]} />
              <ambientLight intensity={1.2} />
              <hemisphereLight
                args={[colors.textPrimary, colors.surfaceSunken, 2.2]}
              />
              <directionalLight position={[4, 6, 5]} intensity={4.5} color={colors.textPrimary} />
              <pointLight
                position={[-4, 1, 3]}
                intensity={8}
                distance={12}
                color={rarityColors[item.rarityTier]}
              />
              <pointLight position={[3, -2, 2]} intensity={5} distance={10} color={colors.accent} />
              <Suspense fallback={<CollectibleRig item={item} controls={controls} />}>
                <CollectibleRig item={item} controls={controls} preferArtwork />
              </Suspense>
              <DisplayPedestal accent={rarityColors[item.rarityTier]} />
            </Canvas>
          ) : null}

          <View
            accessibilityLabel="Rotate and zoom 3D collectible"
            accessibilityRole="adjustable"
            style={StyleSheet.absoluteFill}
            {...pan.panHandlers}
          />

          <View style={styles.controls}>
            <Pressable
              accessibilityLabel="Reset 3D view"
              hitSlop={8}
              onPress={resetView}
              style={styles.iconButton}
            >
              <Text style={styles.controlIcon}>↺</Text>
            </Pressable>
            <Pressable
              accessibilityLabel={autoRotate ? 'Pause automatic rotation' : 'Resume automatic rotation'}
              hitSlop={8}
              onPress={toggleAutoRotate}
              style={[styles.iconButton, autoRotate && styles.iconButtonActive]}
            >
              <Text style={styles.controlIcon}>{autoRotate ? 'Ⅱ' : '▶'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <View>
            <Text style={styles.footerLabel}>MODEL TYPE</Text>
            <Text style={styles.footerValue}>
              {!item
                ? '—'
                : modelFor(item.id)
                  ? 'Generated 3D model'
                  : itemTexture(item)
                    ? '3D artwork relief'
                    : labelForKind(kindFor(item))}
            </Text>
          </View>
          <View style={styles.footerDivider} />
          <View>
            <Text style={styles.footerLabel}>CONTROL</Text>
            <Text style={styles.footerValue}>Touch reactive</Text>
          </View>
          <View style={styles.footerDivider} />
          <View>
            <Text style={styles.footerLabel}>MATERIAL</Text>
            <Text style={styles.footerValue}>PBR concept</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CollectibleRig({
  item,
  controls,
  preferArtwork = false,
}: {
  item: Item;
  controls: MutableRefObject<ViewerControls>;
  preferArtwork?: boolean;
}) {
  const group = useRef<Group>(null);
  const kind = kindFor(item);
  const accent = rarityColors[item.rarityTier];
  const mesh = preferArtwork ? modelFor(item.id) : null;
  const art = preferArtwork && mesh === null ? itemTexture(item) : null;
  const { size } = useThree();
  const portrait = size.width / size.height < 0.8;
  const baseScale = mesh
    ? portrait
      ? 0.85
      : 1
    : art
    ? portrait
      ? 0.66
      : 0.9
    : portrait
    ? kind === 'rifle'
      ? 0.65
      : kind === 'blade'
        ? 0.78
        : 0.82
    : 1;

  useFrame(({ clock }, delta) => {
    const model = group.current;
    if (!model) return;

    const control = controls.current;
    if (!control.dragging) {
      if (control.autoRotate) {
        // A relief is a plane — swing it past ~0.34rad and the illusion dies, so
        // it sways. Real geometry and the procedural meshes have backs, so they
        // get the continuous turntable this screen is actually for.
        control.targetYaw = art
          ? Math.sin(clock.elapsedTime * 0.55) * 0.34
          : control.targetYaw + delta * 0.36;
      }
      control.targetYaw += control.velocityYaw * delta;
      control.velocityYaw *= Math.pow(0.08, delta);
    }

    control.yaw = MathUtils.damp(control.yaw, control.targetYaw, 10, delta);
    control.pitch = MathUtils.damp(control.pitch, control.targetPitch, 10, delta);
    control.zoom = MathUtils.damp(control.zoom, control.targetZoom, 9, delta);

    model.rotation.y = control.yaw;
    model.rotation.x = control.pitch;
    model.scale.setScalar(control.zoom * baseScale);
  });

  return (
    <group
      ref={group}
      position={[0, art ? 0.45 : kind === 'hero' ? 0.25 : 0.65, 0]}
    >
      {mesh ? (
        <CollectibleGLTF module={mesh} accent={accent} size={4.6} />
      ) : art ? (
        <ArtworkRelief3D
          source={art}
          accent={accent}
          width={5.55}
          height={3.7}
          depth={0.28}
        />
      ) : (
        <CollectibleModel3D item={item} />
      )}
    </group>
  );
}

export function CollectibleModel3D({ item }: { item: Item }) {
  const kind = kindFor(item);
  const accent = rarityColors[item.rarityTier];

  if (kind === 'hero') return <HeroStatue accent={accent} seed={item.id} />;
  if (kind === 'blade') return <RingBlade accent={accent} />;
  return <SciFiRifle accent={accent} seed={item.id} />;
}

function SciFiRifle({ accent, seed }: { accent: string; seed: string }) {
  const variation = (hash(seed) % 4) * 0.08;
  const metal = colors.textTertiary;

  return (
    <group rotation={[0.05, 0, -0.05]} scale={0.9}>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[2.9, 0.62 + variation, 0.7]} />
        <meshStandardMaterial color={metal} metalness={0.92} roughness={0.2} />
      </mesh>
      <mesh position={[0.25, 0.45, 0]}>
        <boxGeometry args={[2.2, 0.16, 0.52]} />
        <meshStandardMaterial color={colors.textSecondary} metalness={0.82} roughness={0.28} />
      </mesh>
      <mesh position={[-1.85, 0.05, 0]}>
        <boxGeometry args={[1.05, 0.42, 0.56]} />
        <meshStandardMaterial color={metal} metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[-2.42, -0.02, 0]} rotation={[0, 0, 0.1]}>
        <boxGeometry args={[0.48, 0.8, 0.5]} />
        <meshStandardMaterial color={colors.surfaceElevated} metalness={0.65} roughness={0.38} />
      </mesh>
      <mesh position={[-0.65, -0.62, 0]} rotation={[0, 0, -0.24]}>
        <boxGeometry args={[0.42, 1.05, 0.5]} />
        <meshStandardMaterial color={colors.surfaceElevated} metalness={0.7} roughness={0.36} />
      </mesh>
      <mesh position={[0.35, -0.62, 0]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[0.58, 0.96, 0.5]} />
        <meshStandardMaterial color={metal} metalness={0.85} roughness={0.22} />
      </mesh>
      <mesh position={[2.15, 0.12, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 1.75, 20]} />
        <meshStandardMaterial color={colors.textSecondary} metalness={0.95} roughness={0.12} />
      </mesh>
      <mesh position={[3.05, 0.12, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.22, 0.08, 10, 28]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={2.4}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      <mesh position={[-0.05, 0.12, 0.38]}>
        <boxGeometry args={[1.55, 0.13, 0.08]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.2} />
      </mesh>
      <mesh position={[-0.05, 0.12, -0.38]}>
        <boxGeometry args={[1.55, 0.13, 0.08]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.2} />
      </mesh>
      <mesh position={[-0.15, 0.66, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.18, 0.18, 0.75, 18]} />
        <meshStandardMaterial color={colors.textTertiary} metalness={0.9} roughness={0.18} />
      </mesh>
      <mesh position={[-0.15, 0.66, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.82, 18]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.8} />
      </mesh>
    </group>
  );
}

function RingBlade({ accent }: { accent: string }) {
  return (
    <group rotation={[0.16, 0.08, -0.38]} scale={1.18}>
      <mesh position={[-1.25, -0.25, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.54, 0.15, 16, 40]} />
        <meshStandardMaterial color={colors.textTertiary} metalness={0.95} roughness={0.16} />
      </mesh>
      <mesh position={[-0.5, 0, 0]}>
        <boxGeometry args={[1.25, 0.34, 0.34]} />
        <meshStandardMaterial color={colors.surfaceElevated} metalness={0.88} roughness={0.22} />
      </mesh>
      <mesh position={[0.95, 0.12, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.54, 2.8, 3]} />
        <meshStandardMaterial
          color={colors.textSecondary}
          emissive={accent}
          emissiveIntensity={0.65}
          metalness={0.92}
          roughness={0.14}
        />
      </mesh>
      <mesh position={[0.25, 0.15, 0.28]}>
        <boxGeometry args={[1.6, 0.08, 0.07]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.5} />
      </mesh>
      <mesh position={[-1.25, -0.25, 0]}>
        <sphereGeometry args={[0.2, 18, 18]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3} />
      </mesh>
    </group>
  );
}

function HeroStatue({ accent, seed }: { accent: string; seed: string }) {
  const shoulderWidth = 1.35 + (hash(seed) % 3) * 0.12;

  return (
    <group scale={0.92}>
      <mesh position={[0, 1.62, 0]}>
        <sphereGeometry args={[0.42, 24, 24]} />
        <meshStandardMaterial color={colors.textSecondary} metalness={0.72} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <capsuleGeometry args={[0.5, 1.3, 10, 20]} />
        <meshStandardMaterial color={colors.textTertiary} metalness={0.86} roughness={0.24} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * shoulderWidth * 0.52, 1.0, 0]} rotation={[0, 0, side * 0.3]}>
            <boxGeometry args={[0.66, 0.36, 0.72]} />
            <meshStandardMaterial color={accent} metalness={0.9} roughness={0.18} />
          </mesh>
          <mesh position={[side * 0.72, 0.15, 0]} rotation={[0, 0, side * 0.1]}>
            <capsuleGeometry args={[0.17, 1.15, 8, 14]} />
            <meshStandardMaterial color={colors.surfaceElevated} metalness={0.78} roughness={0.32} />
          </mesh>
          <mesh position={[side * 0.33, -0.95, 0]} rotation={[0, 0, side * 0.08]}>
            <capsuleGeometry args={[0.2, 1.35, 8, 14]} />
            <meshStandardMaterial color={colors.surfaceElevated} metalness={0.82} roughness={0.26} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.65, 0.5]}>
        <octahedronGeometry args={[0.28, 0]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={4} />
      </mesh>
      <mesh position={[0, 1.62, 0.38]}>
        <boxGeometry args={[0.44, 0.08, 0.08]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.2} />
      </mesh>
    </group>
  );
}

function DisplayPedestal({ accent }: { accent: string }) {
  return (
    <group position={[0, -2.05, 0]}>
      <mesh>
        <cylinderGeometry args={[1.55, 1.78, 0.42, 64]} />
        <meshStandardMaterial color={colors.surfaceElevated} metalness={0.88} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0.23, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.42, 0.06, 10, 64]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={3.2} />
      </mesh>
      <mesh position={[0, -0.25, 0]}>
        <cylinderGeometry args={[2.05, 2.05, 0.08, 64]} />
        <meshStandardMaterial color={colors.surfaceSunken} metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}

function kindFor(item: Item | null): ModelKind {
  if (!item) return 'rifle';
  const name = item.name.toLowerCase();
  if (name.includes('karambit') || name.includes('blade') || name.includes('knife')) return 'blade';
  if (item.title === 'mlbb') return 'hero';
  return 'rifle';
}

function labelForKind(kind: ModelKind): string {
  switch (kind) {
    case 'blade':
      return 'Melee collectible';
    case 'hero':
      return 'Hero statue';
    default:
      return 'Weapon collectible';
  }
}

function distanceBetweenTouches(
  touches: readonly { pageX: number; pageY: number }[],
): number {
  const [a, b] = touches;
  if (!a || !b) return 0;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

function hash(value: string): number {
  let output = 0;
  for (let index = 0; index < value.length; index += 1) {
    output = (output * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(output);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceSunken },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surfaceSunken,
  },
  titleBlock: { flex: 1, minWidth: 0, gap: 2 },
  overline: { ...typography.meta, color: colors.accent },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  meta: { ...typography.meta, color: colors.textSecondary },
  stage: { flex: 1, minHeight: 420, backgroundColor: colors.surfaceSunken },
  controls: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    gap: spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  iconButtonActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  closeIcon: { color: colors.textPrimary, fontSize: 26, lineHeight: 28 },
  controlIcon: { color: colors.textPrimary, fontSize: 19, lineHeight: 22 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerLabel: { ...typography.meta, color: colors.textTertiary },
  footerValue: { ...typography.meta, color: colors.textPrimary, marginTop: 2 },
  footerDivider: { width: 1, height: 32, backgroundColor: colors.border },
});
