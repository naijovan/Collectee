/**
 * RoomScene owns both Showroom renderers.
 *
 * Published and preview rooms use a procedural WebGL gallery so the space and
 * collectibles respond in three dimensions. Edit mode keeps the slot-based
 * 2.5D renderer below because its precise drag/drop coordinates are part of the
 * room data contract. Publisher models can replace the procedural collectibles
 * later without changing either interaction surface.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { PointerEvent as NativePointerEvent, ViewStyle } from 'react-native';

import { backdropFor } from '@/config/artRegistry';
import { FEATURES } from '@/config/features';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { cameraTargetFor, parallaxOffset } from '@/domain/room';
import { rarityLabelFor } from '@/domain/rarity';
import {
  colors,
  lightingPresets,
  radius,
  rarityColors,
  scrim,
  spacing,
  typography,
} from '@/theme/theme';

import { ItemArt } from './primitives';
import { GAME_SHORT_LABELS } from '@/types';
import type { Item, Room, RoomTheme, Slot } from '@/types';

import { resolveBackdrop } from './backdrops';
import { ImmersiveRoom3D } from './ImmersiveRoom3D';

/** How far a drag can shift the front layer, in px. Deliberately small. */
const MAX_TILT = 14;

export function RoomScene({
  room,
  theme,
  itemsByOwnedId,
  selectedSlotId,
  onSlotPress,
  onInspect3D,
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
  /** Opens the focused collectible in the full 3D inspection surface. */
  onInspect3D?: (item: Item) => void;
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
  const dragResponderActive = useRef(false);
  const dropTarget = useRef<string | null>(null);
  const pointerDragStart = useRef<{
    pageX: number;
    pageY: number;
    slotId: string;
  } | null>(null);
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [dropTargetSlotId, setDropTargetSlotId] = useState<string | null>(null);

  const updateDropTarget = useCallback((slotId: string | null) => {
    if (dropTarget.current === slotId) return;
    dropTarget.current = slotId;
    setDropTargetSlotId(slotId);
  }, []);

  const clearDrag = useCallback(() => {
    activeDrag.current = null;
    dragResponderActive.current = false;
    dropTarget.current = null;
    pointerDragStart.current = null;
    setDraggingSlotId(null);
    setDropTargetSlotId(null);
    drag.setValue({ x: 0, y: 0 });
  }, [drag]);

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
  const reduceMotion = useReduceMotion();
  /* Reduce Motion cuts it, which it did not before: this was the one repeating
     animation in the app with no such check, so a room kept breathing for a
     user who had asked the OS for stillness. Parking at 0 leaves the static
     wash the flag-off path already renders, so nothing goes dark. */
  const animateLighting =
    FEATURES.roomLightingControls && room.settings.animatedLighting && !reduceMotion;

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

  const onPointerMove = useCallback(
    (event: NativePointerEvent) => {
      const start = pointerDragStart.current;
      if (Platform.OS !== 'web' || !start || activeDrag.current !== start.slotId) return;

      dragResponderActive.current = true;
      const dx = event.nativeEvent.pageX - start.pageX;
      const dy = event.nativeEvent.pageY - start.pageY;
      drag.setValue({ x: dx, y: dy });

      const source = slotsRef.current.find((slot) => slot.id === start.slotId);
      if (!source) return;
      const { width: w, height: h } = sizeRef.current;
      const fx = source.x + source.w / 2 + dx / w;
      const fy = source.y + source.h / 2 + dy / h;
      const target = slotAtPoint(slotsRef.current, fx, fy);
      updateDropTarget(target && target.id !== start.slotId ? target.id : null);
    },
    [drag, updateDropTarget],
  );

  const onPointerUp = useCallback(() => {
    if (Platform.OS !== 'web') return;
    const from = pointerDragStart.current?.slotId;
    const to = dropTarget.current;
    if (from && to && from !== to) dropRef.current?.(from, to);
    clearDrag();
  }, [clearDrag]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (event, gesture) => {
          const touchCount = event.nativeEvent.touches?.length ?? 0;
          if (Platform.OS === 'web' && pointerDragStart.current) return false;
          return (
            touchCount === 2 ||
            activeDrag.current !== null ||
            (room.settings.parallaxEnabled && Math.hypot(gesture.dx, gesture.dy) > 4)
          );
        },

        onPanResponderGrant: () => {
          dragResponderActive.current = activeDrag.current !== null;
        },

        onPanResponderMove: (event, gesture) => {
          const touches = event.nativeEvent.touches ?? [];

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
            const { width: w, height: h } = sizeRef.current;
            const source = slotsRef.current.find(
              (slot) => slot.id === activeDrag.current,
            );
            if (!source) return;
            const fx = source.x + source.w / 2 + gesture.dx / w;
            const fy = source.y + source.h / 2 + gesture.dy / h;
            const target = slotAtPoint(slotsRef.current, fx, fy);
            const nextTarget =
              target && target.id !== activeDrag.current ? target.id : null;
            updateDropTarget(nextTarget);
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
            const to = dropTarget.current;
            if (to && to !== from) dropRef.current?.(from, to);
            clearDrag();
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
          clearDrag();
        },
      }),
    [room.settings.parallaxEnabled, tilt, drag, zoom, clearDrag, updateDropTarget],
  );

  const palette = theme?.palette ?? [];
  const backdrop = (theme ? backdropFor(theme.id) : null) ?? resolveBackdrop(room.backdropUrl);
  const lighting = lightingPresets[room.settings.lightingPreset];
  // Brighter setting = thinner darkening veil. Not a light model, a wash.
  const veilOpacity = FEATURES.roomLightingControls ? (1 - room.settings.brightness) * 0.55 : 0.2;

  if (cameraEnabled && !draggable && !showEmptySlots && onInspect3D) {
    return (
      <ImmersiveRoom3D
        room={room}
        theme={theme}
        itemsByOwnedId={itemsByOwnedId}
        onSlotPress={onSlotPress}
        onInspect3D={onInspect3D}
        width={width}
      />
    );
  }

  return (
    <View
      accessibilityLabel={draggable ? 'Showroom arrangement canvas' : 'Showroom preview'}
      style={[styles.viewport, { width, height }]}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={clearDrag}
      {...(draggable || room.settings.parallaxEnabled ? pan.panHandlers : {})}
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
                  onPress={() => {
                    if (activeDrag.current === slot.id && !dragResponderActive.current) {
                      clearDrag();
                    }
                    if (item && focused && onInspect3D) {
                      onInspect3D(item);
                      return;
                    }
                    onSlotPress?.(slot);
                  }}
                  onLongPress={() => focused && setFlipped((prev) => !prev)}
                  accessibilityLabel={
                    item ? `${item.name}, ${slot.kind} slot` : `Empty ${slot.kind} slot`
                  }
                  accessibilityHint={
                    draggable && item
                      ? 'Drag to move, or tap and then choose another display slot'
                      : undefined
                  }
                  accessibilityState={{ selected }}
                  // Claims the drag before the responder sees movement, so the
                  // gesture knows which card it is carrying. PressIn covers
                  // mouse, pen and touch; the previous TouchStart path did not.
                  onPressIn={() => {
                    if (!draggable || !placement) return;
                    activeDrag.current = slot.id;
                    setDraggingSlotId(slot.id);
                  }}
                  onPointerDown={(event) => {
                    if (Platform.OS !== 'web' || !draggable || !placement) return;
                    pointerDragStart.current = {
                      pageX: event.nativeEvent.pageX,
                      pageY: event.nativeEvent.pageY,
                      slotId: slot.id,
                    };
                  }}
                  onPressOut={() => {
                    // Responder grant and PressOut can happen in the same frame.
                    // Defer cleanup so a real drag gets to retain its claim.
                    setTimeout(() => {
                      if (
                        !dragResponderActive.current &&
                        activeDrag.current === slot.id
                      ) {
                        clearDrag();
                      }
                    }, 0);
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
                    draggingSlotId === slot.id && styles.cardDragging,
                    dropTargetSlotId === slot.id && styles.cardDropTarget,
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

function slotAtPoint(slots: readonly Slot[], x: number, y: number): Slot | null {
  return (
    [...slots]
      .sort((a, b) => b.depth - a.depth)
      .find(
        (slot) =>
          x >= slot.x && x <= slot.x + slot.w && y >= slot.y && y <= slot.y + slot.h,
      ) ?? null
  );
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
  cardDragging: { opacity: 0.82, borderColor: colors.accent, borderWidth: 3 },
  cardDropTarget: { borderColor: colors.accent, borderWidth: 3 },

  // `width` is not decoration: the card centres its children on the cross axis,
  // so without it the face collapses to the width of the name and the
  // absolutely-filled ItemArt renders into a sliver.
  face: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
    overflow: 'hidden',
  },
  /** Keeps the name legible over a bright render without hiding the art. */
  faceScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%', backgroundColor: scrim.medium },
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
    backgroundColor: scrim.light,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
});
