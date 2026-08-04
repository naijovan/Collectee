/**
 * RoomScene — the 2.5D parallax room from PRD §11 F4. Flow owner: Jovan (J3).
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  SCOPE GUARD (§11 F4). This is NOT navigable 3D and NOT a turntable │
 * │  of the in-game model — that needs publisher assets we do not have  │
 * │  and will not have. The Figma frames render richer than this spec.  │
 * │  Build to the spec, not to the frames.                              │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * What the spec asks for, and what this renders:
 *   - a themed backdrop with fixed placement slots, items composited in
 *   - look-at focus: tapping an item TRANSITIONS THE CAMERA to it — "this
 *     transition is the immersion, and it costs a fraction of a navigable 3D
 *     environment"
 *   - the focused card flips in place to show reverse-side metadata — reads as
 *     "spin" without a 3D model
 *   - parallax on drag, by depth layer
 *
 * Slot coordinates are fractional (§12.3), so the same slot map works at any
 * size. All geometry comes from the theme; generation only ever produces the
 * backdrop image. Everything here is pure presentation over `domain/room.ts` —
 * no camera or parallax maths is reinvented in this file.
 *
 * [ROADMAP] brightness and animated lighting (`FEATURES.roomLightingControls`).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle } from 'react-native';

import { backdropFor } from '@/config/artRegistry';
import { FEATURES } from '@/config/features';
import { cameraTargetFor, parallaxOffset } from '@/domain/room';
import { rarityLabelFor } from '@/domain/rarity';
import { colors, lightingPresets, radius, rarityColors, spacing, typography } from '@/theme/theme';

import { ItemArt } from './primitives';
import { GAME_SHORT_LABELS } from '@/types';
import type { Item, Room, RoomTheme, Slot } from '@/types';

import { resolveBackdrop } from './backdrops';

/** How far a drag can shift the front layer, in px. Deliberately small. */
const MAX_TILT = 14;

export function RoomScene({
  room,
  theme,
  itemsByOwnedId,
  selectedSlotId,
  onSlotPress,
  onDropItem,
  draggable = false,
  showEmptySlots = false,
  cameraEnabled = true,
  width,
}: {
  room: Room;
  /** Supplies the palette. Backdrop art is not in the repo yet (§16 Q6). */
  theme?: RoomTheme | null;
  itemsByOwnedId: ReadonlyMap<string, Item>;
  selectedSlotId?: string | null;
  onSlotPress?: (slot: Slot) => void;
  /** Drag ended over another slot. Empty target moves, occupied target swaps. */
  onDropItem?: (fromSlotId: string, toSlotId: string) => void;
  /** Edit mode — placed items can be dragged between slots. */
  draggable?: boolean;
  /** Edit mode — empty slots render as labelled drop targets. */
  showEmptySlots?: boolean;
  /** Off while arranging, so the whole scene stays visible. */
  cameraEnabled?: boolean;
  width: number;
}) {
  const height = width * 0.68;

  const [flipped, setFlipped] = useState(false);
  const tilt = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  /**
   * Drag state. One card at a time, so this is a single shared translate rather
   * than one Animated value per slot. `activeDrag` is a ref because the pan
   * responder is created once and must not be rebuilt mid-gesture.
   */
  const drag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const activeDrag = useRef<string | null>(null);
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);

  /** Pinch-zoom (§11 F4). Tracked as a manual scale on top of the camera. */
  const [zoom, setZoom] = useState(1);
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const camera = useRef({
    x: new Animated.Value(0),
    y: new Animated.Value(0),
    scale: new Animated.Value(1),
  }).current;

  const focusedSlot = useMemo(
    () => room.slots.find((slot) => slot.id === room.settings.focusedSlotId) ?? null,
    [room.slots, room.settings.focusedSlotId],
  );

  // The look-at transition. Translate happens inside the scaled wrapper, so the
  // focused slot's centre lands on the viewport centre at any zoom.
  useEffect(() => {
    if (!cameraEnabled || !focusedSlot) {
      Animated.parallel([
        Animated.spring(camera.x, { toValue: 0, useNativeDriver: true, friction: 9 }),
        Animated.spring(camera.y, { toValue: 0, useNativeDriver: true, friction: 9 }),
        Animated.spring(camera.scale, { toValue: 1, useNativeDriver: true, friction: 9 }),
      ]).start();
      return;
    }

    const target = cameraTargetFor(focusedSlot);
    Animated.parallel([
      Animated.spring(camera.x, {
        toValue: width * (0.5 - target.x),
        useNativeDriver: true,
        friction: 9,
      }),
      Animated.spring(camera.y, {
        toValue: height * (0.5 - target.y),
        useNativeDriver: true,
        friction: 9,
      }),
      Animated.spring(camera.scale, { toValue: target.scale, useNativeDriver: true, friction: 9 }),
    ]).start();
  }, [cameraEnabled, focusedSlot, camera, width, height]);

  // A new focal item always lands face-up.
  useEffect(() => setFlipped(false), [room.settings.focusedSlotId]);

  /**
   * Animated lighting — a slow breathing wash over the scene.
   *
   * §11 F4 has this as [ROADMAP]; the team took it into demo scope on 3 Aug, so
   * it stays behind `FEATURES.roomLightingControls` and reverts to a static
   * wash when the flag is off. That is §14 rung 2 working as designed.
   */
  const pulse = useRef(new Animated.Value(0)).current;
  const animateLighting = FEATURES.roomLightingControls && room.settings.animatedLighting;

  useEffect(() => {
    if (!animateLighting) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animateLighting, pulse]);

  /**
   * One responder, three jobs — because they are mutually exclusive gestures on
   * the same surface and racing separate responders for them is worse:
   *
   *   two fingers        → pinch-zoom (§11 F4)
   *   one finger on card → drag it to another slot (edit mode only)
   *   one finger on room → parallax
   *
   * Built once. `activeDrag` and `slotsRef` are refs so a re-render mid-gesture
   * cannot swap the responder out from under a drag in progress.
   */
  const slotsRef = useRef(room.slots);
  slotsRef.current = room.slots;
  const dropRef = useRef(onDropItem);
  dropRef.current = onDropItem;
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (event, gesture) =>
          event.nativeEvent.touches.length === 2 ||
          activeDrag.current !== null ||
          (room.settings.parallaxEnabled && Math.hypot(gesture.dx, gesture.dy) > 4),

        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches;

          if (touches.length === 2) {
            const [a, b] = touches;
            const distance = Math.hypot(a!.pageX - b!.pageX, a!.pageY - b!.pageY);
            if (!pinchStart.current) {
              pinchStart.current = { distance, zoom };
              return;
            }
            const ratio = distance / (pinchStart.current.distance || 1);
            setZoom(clamp(pinchStart.current.zoom * ratio, 1, 2.5));
            return;
          }

          if (activeDrag.current) {
            drag.setValue({ x: gesture.dx, y: gesture.dy });
            return;
          }

          tilt.setValue({
            x: clamp(gesture.dx / 12, -MAX_TILT, MAX_TILT),
            y: clamp(gesture.dy / 12, -MAX_TILT, MAX_TILT),
          });
        },

        onPanResponderRelease: (event, gesture) => {
          pinchStart.current = null;
          const from = activeDrag.current;

          if (from) {
            // Where the finger let go, as a fraction of the scene. Camera is
            // identity while editing, so screen space maps straight to it.
            const { width: w, height: h } = sizeRef.current;
            const fx = event.nativeEvent.locationX / w;
            const fy = event.nativeEvent.locationY / h;
            const target = slotsRef.current.find(
              (slot) =>
                fx >= slot.x && fx <= slot.x + slot.w && fy >= slot.y && fy <= slot.y + slot.h,
            );
            if (target && target.id !== from) dropRef.current?.(from, target.id);

            activeDrag.current = null;
            setDraggingSlotId(null);
            drag.setValue({ x: 0, y: 0 });
            return;
          }

          Animated.spring(tilt, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            friction: 6,
          }).start();
          void gesture;
        },

        onPanResponderTerminate: () => {
          pinchStart.current = null;
          activeDrag.current = null;
          setDraggingSlotId(null);
          drag.setValue({ x: 0, y: 0 });
        },
      }),
    [room.settings.parallaxEnabled, tilt, drag, zoom],
  );

  const palette = theme?.palette ?? [];
  const backdrop = (theme ? backdropFor(theme.id) : null) ?? resolveBackdrop(room.backdropUrl);
  const lighting = lightingPresets[room.settings.lightingPreset];
  // Brighter setting = thinner darkening veil. Not a light model, a wash.
  const veilOpacity = FEATURES.roomLightingControls ? (1 - room.settings.brightness) * 0.55 : 0.2;

  return (
    <View
      style={[styles.viewport, { width, height }]}
      {...(room.settings.parallaxEnabled ? pan.panHandlers : {})}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ scale: Animated.multiply(camera.scale, zoom) }] },
        ]}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateX: camera.x }, { translateY: camera.y }] },
          ]}
        >
          {/*
            The backdrop. The theme art pack has landed, so this is normally the
            real 1920x1080 render for the theme; `resolveBackdrop` is the second
            seam for themes whose art ships as a bundled asset instead. The
            palette wash below stays as the fallback for any theme with neither,
            which is what every theme used to get.

            `cover` at 50% 50% per the pack manifest. Item slots stay a separate
            overlay drawn after this — the backdrop is always empty scenery, so
            placements composite on top rather than being baked in.
          */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSunken }]} />
          {backdrop ? (
            <Image
              source={backdrop}
              // Explicit size, not absoluteFill — see ItemArt's artFill. Edges
              // alone let a renderer draw the 1920px backdrop at full size.
              style={styles.backdrop}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <>
              {palette.map((tone, index) => (
                <View
                  key={tone}
                  style={[
                    styles.wash,
                    {
                      backgroundColor: tone,
                      opacity: index === 0 ? 0.9 : 0.28,
                      top: `${index * 26}%`,
                    },
                  ]}
                />
              ))}
              <View style={styles.floor} />
            </>
          )}

          {/* Lighting wash — preset tint over a brightness-driven veil. */}
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: colors.surfaceSunken, opacity: veilOpacity },
            ]}
          />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: lighting.tint,
                opacity: animateLighting
                  ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.3] })
                  : 0.18,
              },
            ]}
          />

          {room.slots.map((slot) => {
            const placement = room.placements.find((p) => p.slotId === slot.id);
            const item = placement ? itemsByOwnedId.get(placement.ownedItemId) : undefined;
            if (!placement && !showEmptySlots) return null;

            const focused = cameraEnabled && room.settings.focusedSlotId === slot.id;
            const selected = selectedSlotId === slot.id;
            const offset = parallaxOffset(slot.depth, 1, 1);

            return (
              <Animated.View
                key={slot.id}
                style={[
                  styles.slot,
                  {
                    left: slot.x * width,
                    top: slot.y * height,
                    width: slot.w * width,
                    height: slot.h * height,
                    // A card being dragged rides above every layer.
                    zIndex: draggingSlotId === slot.id ? 99 : slot.depth + 1,
                    transform: [
                      {
                        translateX:
                          draggingSlotId === slot.id
                            ? drag.x
                            : Animated.multiply(tilt.x, offset.dx),
                      },
                      {
                        translateY:
                          draggingSlotId === slot.id
                            ? drag.y
                            : Animated.multiply(tilt.y, offset.dy),
                      },
                    ],
                  },
                ]}
              >
                <Pressable
                  onPress={() => onSlotPress?.(slot)}
                  onLongPress={() => focused && setFlipped((prev) => !prev)}
                  // Claims the drag before the responder sees movement, so the
                  // gesture knows which card it is carrying.
                  onTouchStart={() => {
                    if (!draggable || !placement) return;
                    activeDrag.current = slot.id;
                    setDraggingSlotId(slot.id);
                  }}
                  // A plain tap ends here and the responder never engages, so
                  // the claim has to be released or the next gesture inherits
                  // it. When the responder DOES take over, this fires as a
                  // cancel instead and the release handler does the cleanup.
                  onTouchEnd={() => {
                    if (activeDrag.current !== slot.id) return;
                    activeDrag.current = null;
                    setDraggingSlotId(null);
                    drag.setValue({ x: 0, y: 0 });
                  }}
                  style={[
                    styles.card,
                    slot.kind === 'wall' && styles.cardWall,
                    // §11 F4: "cards, statues or wall art". The display style is
                    // a room-level choice; the slot kind still shapes the frame.
                    room.settings.displayStyle === 'framed' && styles.cardFramed,
                    room.settings.displayStyle === 'hologram' && styles.cardHologram,
                    item ? { borderColor: rarityColors[item.rarityTier] } : styles.cardEmpty,
                    focused && styles.cardFocused,
                    selected && styles.cardSelected,
                    {
                      transform: [
                        { rotate: `${placement?.rotation ?? 0}deg` },
                        { rotateY: focused && flipped ? '180deg' : '0deg' },
                      ],
                    },
                  ]}
                >
                  {item ? (
                    focused && flipped ? (
                      // Reverse side — the "spin" from §11 F4, no 3D model needed.
                      <View style={styles.reverse}>
                        <Text style={styles.reverseLabel}>
                          {rarityLabelFor(item.rarityTier, item.title)}
                        </Text>
                        <Text style={styles.reverseMeta}>{GAME_SHORT_LABELS[item.title]}</Text>
                        <Text style={styles.reverseMeta}>
                          Owned by {Math.round(item.popularityScore * 100)}% of players
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.face}>
                        {/* ItemArt owns both art seams and the colour-block
                            fallback; the rarity glow and name sit over it so
                            both stay readable whichever it renders. */}
                        <ItemArt
                          seed={item.id}
                          tier={item.rarityTier}
                          renderUrl={item.renderUrl}
                          style={StyleSheet.absoluteFill as ViewStyle}
                        />
                        <View
                          style={[styles.faceGlow, { backgroundColor: rarityColors[item.rarityTier] }]}
                        />
                        <View style={styles.faceScrim} />
                        <Text style={styles.faceName} numberOfLines={2}>
                          {item.name}
                        </Text>
                      </View>
                    )
                  ) : (
                    <Text style={styles.emptyLabel}>{slot.kind}</Text>
                  )}
                </Pressable>
              </Animated.View>
            );
          })}
        </Animated.View>
      </Animated.View>

      {cameraEnabled && focusedSlot ? (
        <View style={styles.hint}>
          <Text style={styles.hintText}>Long-press the focal item to flip it</Text>
        </View>
      ) : null}
    </View>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    borderRadius: radius.card,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backdrop: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  wash: { position: 'absolute', left: 0, right: 0, height: '40%' },
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '22%',
    backgroundColor: colors.surfaceSunken,
    opacity: 0.55,
  },

  slot: { position: 'absolute' },
  card: {
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
    overflow: 'hidden',
  },
  cardWall: { borderRadius: 2 },
  cardFramed: { borderRadius: 2, borderWidth: 3, backgroundColor: colors.surfaceElevated },
  cardHologram: { backgroundColor: 'transparent', borderRadius: radius.card },
  cardEmpty: { borderStyle: 'dashed', borderColor: colors.border, backgroundColor: 'transparent' },
  cardFocused: { borderWidth: 3 },
  cardSelected: { borderColor: colors.accent, borderWidth: 3 },

  face: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2, overflow: 'hidden' },
  /** Keeps the name legible over a bright render without hiding the art. */
  faceScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%', backgroundColor: 'rgba(0,0,0,0.55)' },
  faceGlow: {
    position: 'absolute',
    width: '80%',
    height: '60%',
    borderRadius: radius.pill,
    opacity: 0.25,
  },
  faceName: { ...typography.meta, fontSize: 9, color: colors.textPrimary, textAlign: 'center' },

  reverse: { alignItems: 'center', gap: 2, transform: [{ scaleX: -1 }] },
  reverseLabel: { ...typography.meta, fontSize: 9, color: colors.textPrimary },
  reverseMeta: { ...typography.meta, fontSize: 8, color: colors.textSecondary, textAlign: 'center' },

  emptyLabel: { ...typography.meta, fontSize: 9, color: colors.textTertiary },

  hint: {
    position: 'absolute',
    bottom: spacing.sm,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  hintText: {
    ...typography.meta,
    fontSize: 10,
    color: colors.textSecondary,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
});
