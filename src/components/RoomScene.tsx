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
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { cameraTargetFor, parallaxOffset } from '@/domain/room';
import { rarityLabelFor } from '@/domain/rarity';
import { colors, radius, rarityColors, spacing, typography } from '@/theme/theme';
import { GAME_SHORT_LABELS } from '@/types';
import type { Item, Room, RoomTheme, Slot } from '@/types';

/** How far a drag can shift the front layer, in px. Deliberately small. */
const MAX_TILT = 14;

export function RoomScene({
  room,
  theme,
  itemsByOwnedId,
  selectedSlotId,
  onSlotPress,
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
  /** Edit mode — empty slots render as labelled drop targets. */
  showEmptySlots?: boolean;
  /** Off while arranging, so the whole scene stays visible. */
  cameraEnabled?: boolean;
  width: number;
}) {
  const height = width * 0.68;

  const [flipped, setFlipped] = useState(false);
  const tilt = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
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

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          room.settings.parallaxEnabled && Math.hypot(gesture.dx, gesture.dy) > 4,
        onPanResponderMove: (_event, gesture) => {
          tilt.setValue({
            x: clamp(gesture.dx / 12, -MAX_TILT, MAX_TILT),
            y: clamp(gesture.dy / 12, -MAX_TILT, MAX_TILT),
          });
        },
        onPanResponderRelease: () => {
          Animated.spring(tilt, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            friction: 6,
          }).start();
        },
      }),
    [room.settings.parallaxEnabled, tilt],
  );

  const palette = theme?.palette ?? [];

  return (
    <View
      style={[styles.viewport, { width, height }]}
      {...(room.settings.parallaxEnabled ? pan.panHandlers : {})}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: camera.scale }] }]}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateX: camera.x }, { translateY: camera.y }] },
          ]}
        >
          {/*
            Backdrop stand-in. §16 Q6 is still open and the generated art is not
            in the repo — fixtures reference `room-backdrops/<theme>.png`. The
            theme palette is the cache key for the real backdrop (§11 F4), so
            painting it here keeps every theme visually distinct without
            inventing a colour. Swap for <Image source={...}> when art lands.
          */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceSunken }]} />
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
                    zIndex: slot.depth + 1,
                    transform: [
                      { translateX: Animated.multiply(tilt.x, offset.dx) },
                      { translateY: Animated.multiply(tilt.y, offset.dy) },
                    ],
                  },
                ]}
              >
                <Pressable
                  onPress={() => onSlotPress?.(slot)}
                  onLongPress={() => focused && setFlipped((prev) => !prev)}
                  style={[
                    styles.card,
                    slot.kind === 'wall' && styles.cardWall,
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
                        <View
                          style={[styles.faceGlow, { backgroundColor: rarityColors[item.rarityTier] }]}
                        />
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
  cardEmpty: { borderStyle: 'dashed', borderColor: colors.border, backgroundColor: 'transparent' },
  cardFocused: { borderWidth: 3 },
  cardSelected: { borderColor: colors.accent, borderWidth: 3 },

  face: { alignItems: 'center', justifyContent: 'center', gap: 2 },
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
