/**
 * Shared primitives — PRD §13.3.
 *
 * Jovan owns every component in src/components/. Changes go via PR announced in
 * chat — this is where merge conflicts will otherwise happen.
 *
 * No new dependencies (§13.1: "nobody adds a dependency without saying so in
 * chat"), so icons are unicode glyphs and art is a deterministic colour block
 * rather than an icon font or an image library.
 */

import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';

import { avatarArtFor } from '@/config/avatarRegistry';
import { resolveItemArt } from './item-art';

import { useReduceMotion } from '@/hooks/useReduceMotion';

import { artFor } from '@/config/artRegistry';
import { rarityLabelFor } from '@/domain/rarity';
import { GAME_SHORT_LABELS } from '@/types';
import type { GameTitle, RarityTier } from '@/types';
import * as haptics from '@/lib/haptics';
import {
  colors,
  interaction,
  letterSpacing,
  motion,
  radius,
  rarityColors,
  rarityGlyphs,
  rarityTreatments,
  scrim,
  spacing,
  typography,
} from '@/theme/theme';

function ResolvedItemImage({
  source,
  fit,
  alt,
  tint,
}: {
  source: ImageSourcePropType;
  fit: 'cover' | 'contain';
  alt?: string;
  tint: string;
}) {
  return (
    <>
      {/* Build the missing canvas from the artwork itself. The sharp foreground
          remains untouched and fully contained; only this enlarged copy is
          allowed to crop, blur and tint into the otherwise empty edges. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: 0.28 }]} />
      <Image
        source={source}
        style={[styles.artFill, styles.artSurroundings]}
        resizeMode="cover"
        blurRadius={8}
        accessible={false}
        accessibilityIgnoresInvertColors
      />
      <View style={[StyleSheet.absoluteFill, styles.artSurroundingsShade]} />
      <Image
        source={source}
        style={styles.artFill}
        resizeMode={fit}
        accessible={alt !== undefined}
        accessibilityLabel={alt}
        accessibilityIgnoresInvertColors
      />
    </>
  );
}

/** Stable per-string hue so the same item always gets the same placeholder. */
function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Item art — the real render when the art pack has one, a deterministic colour
 * block when it does not.
 *
 * Two seams feed this, tried in order. `artRegistry` is keyed on the catalogue
 * `Item.id`, which is what `seed` is at every item call site. `item-art.ts` is
 * keyed on `Item.renderUrl` and covers art that ships as a bundled asset rather
 * than a registry entry. Other call sites pass a collection id, a theme id or a
 * game title; those miss both and get the colour block, so no caller has to
 * know whether art exists.
 *
 * The fallback stays. It is what lets the app run with a partly-populated art
 * pack instead of showing broken images, and 73 catalogue items will not all
 * have renders for a while.
 */
export function ItemArt({
  seed,
  tier,
  renderUrl,
  fit,
  style,
}: {
  seed: string;
  tier: RarityTier;
  /** `Item.renderUrl`. Omit for non-item art such as collection covers. */
  renderUrl?: string;
  /** Override the registry fit for decorative placements such as mosaics. */
  fit?: 'cover' | 'contain';
  style?: StyleProp<ViewStyle>;
}) {
  const art = artFor(seed);
  if (art !== null) {
    // The image sits inside the same container the colour block uses, so the
    // caller's ViewStyle (size, radius) still applies and `overflow: hidden`
    // does the clipping. Styling the Image directly does not typecheck —
    // callers pass ViewStyle, and ImageStyle has no `overflow: 'scroll'`.
    //
    // The registry owns the fit. The image always receives the full box so
    // `contain` can preserve the complete subject without an extra inset making
    // weapons needlessly small.
    return (
      <View style={[styles.art, { backgroundColor: colors.surfaceSunken }, style]}>
        <ResolvedItemImage
          source={art.source}
          fit={fit ?? art.fit}
          alt={art.alt}
          tint={rarityColors[tier]}
        />
      </View>
    );
  }

  const bundled = renderUrl ? resolveItemArt(renderUrl) : null;
  if (bundled !== null) {
    return (
      <View style={[styles.art, { backgroundColor: colors.surfaceSunken }, style]}>
        <ResolvedItemImage
          source={bundled}
          fit={fit ?? 'contain'}
          tint={rarityColors[tier]}
        />
      </View>
    );
  }

  const tint = rarityColors[tier];
  const angle = hash(seed) % 3;
  return (
    <View style={[styles.art, { backgroundColor: colors.surfaceSunken }, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: 0.16 }]} />
      <View
        style={[
          styles.artStripe,
          {
            backgroundColor: tint,
            opacity: 0.5,
            transform: [{ rotate: `${-28 + angle * 14}deg` }],
          },
        ]}
      />
      <View style={[styles.artGlow, { backgroundColor: tint, opacity: 0.22 }]} />
    </View>
  );
}

/**
 * §12.2 — one badge component, five colour tokens, native label printed.
 *
 * The badge is a value ladder, not a colour code: the border thickens, a glow
 * appears and the leading glyph escalates as the tier climbs, so a mythic reads
 * as rarer than a common at a glance rather than only "a different colour".
 * All of that comes from `rarityTreatments`, so a tier's loudness is a token
 * decision, not a per-call-site one.
 *
 * `compact` drops the label to just the glyph — for overlaying on card art,
 * where the full native label would not fit.
 */
export function RarityBadge({
  tier,
  title,
  compact = false,
}: {
  tier: RarityTier;
  title: GameTitle;
  compact?: boolean;
}) {
  const treatment = rarityTreatments[tier];
  return (
    <View
      style={[
        styles.rarityBadge,
        compact && styles.rarityBadgeCompact,
        {
          borderColor: treatment.base,
          borderWidth: treatment.borderWidth,
          backgroundColor: treatment.glow,
        },
      ]}
    >
      <Text style={[styles.rarityText, { color: treatment.base }]}>
        {compact
          ? rarityGlyphs[tier]
          : `${rarityGlyphs[tier]} ${rarityLabelFor(tier, title).toUpperCase()}`}
      </Text>
    </View>
  );
}

export function GameBadge({ title }: { title: GameTitle }) {
  return (
    <View style={styles.gameBadge}>
      <Text style={styles.gameBadgeText}>{GAME_SHORT_LABELS[title]}</Text>
    </View>
  );
}

/**
 * Avatar — a roster portrait when one has landed, initials over a deterministic
 * hue when it has not. Carries the account-level blue tick (§9.3 — NOT item
 * trust).
 *
 * ── Why `avatarId` is optional ────────────────────────────────────────────
 * Not every caller has one. A comment knows its author's name before it knows
 * whether that author is a seeded user, and the assistant renders a face for a
 * string. Those keep the initials treatment rather than being forced to invent
 * an id, so this stayed an additive prop across twenty-odd call sites instead
 * of a breaking one.
 *
 * ── Why the hue is seeded on the id when there is one ─────────────────────
 * It used to be seeded on the display name, which meant the colour was a
 * property of what someone was called. Two roster faces with similar names
 * could land on neighbouring hues, and renaming yourself in Settings changed
 * your face. Seeding on the avatar id makes the placeholder stable and distinct
 * per roster slot — which is what makes fifteen colour circles usable as a
 * picker today, before any art exists.
 */
export function Avatar({
  name,
  avatarId,
  verified,
  size = 36,
}: {
  name: string;
  /** Roster id from `config/avatarRegistry`. Omit for a name-only face. */
  avatarId?: string | null;
  verified?: boolean;
  size?: number;
}) {
  const art = avatarArtFor(avatarId);
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  // The id wins when present, so a face is a property of the avatar chosen and
  // not of the name attached to it.
  const hue = hash(avatarId ?? name) % 360;
  return (
    <View>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: `hsl(${hue}, 45%, 32%)`,
          },
        ]}
      >
        {art ? (
          <Image
            source={art}
            style={styles.avatarImage}
            resizeMode="cover"
            accessible
            accessibilityLabel={`${name}'s avatar`}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
        )}
      </View>
      {verified ? (
        <View style={[styles.tick, { width: size * 0.4, height: size * 0.4, borderRadius: size }]}>
          <Text style={[styles.tickText, { fontSize: size * 0.22 }]}>✓</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Section title + "See all" — the accent-coloured affordance from §13.2. */
/**
 * Pointer-hover lift for anything clickable.
 *
 * One hook rather than per-component state, so every interactive surface in the
 * app rises by the same amount over the same duration — inconsistent hover is
 * more noticeable than no hover.
 *
 * `transitionDuration` is a react-native-web style prop, which is why this is
 * smooth without an Animated value. Native never fires the hover callbacks, so
 * the style simply never applies there.
 */
export function useHoverLift() {
  const [hovered, setHovered] = useState(false);
  return {
    hoverProps: {
      onHoverIn: () => setHovered(true),
      onHoverOut: () => setHovered(false),
    },
    hoverStyle: {
      transitionDuration: `${interaction.hoverMs}ms`,
      // Translate only. The element keeps its exact width and height, so it
      // cannot overlap a neighbour or spill past a container's border — the
      // failure that made a scale-based hover unusable in a grid.
      ...(hovered ? { transform: [{ translateY: interaction.hoverLift }] } : null),
    } as ViewStyle,
    /**
     * Border emphasis, applied separately so a caller can skip it on an element
     * that has no border of its own. Kept out of `hoverStyle` because setting
     * borderColor on a borderless element does nothing visible but does change
     * layout in some RN Web versions.
     */
    hoverBorder: (hovered ? { borderColor: colors.accent } : null) as ViewStyle | null,
    hovered,
  };
}

export function SectionHeader({
  title,
  onSeeAll,
  actionLabel = 'See all',
  actionIcon,
  prominent = false,
}: {
  title: string;
  onSeeAll?: () => void;
  /**
   * Overrides the trailing action's text. "See all" is the common case, but a
   * section whose action creates something ("Add showroom") needs to say so —
   * a create action labelled "See all" is a lie about what the tap does.
   */
  actionLabel?: string;
  /**
   * Renders the action as a circular icon button with the label beside it.
   * Reserved for actions that CREATE something — the filled circle is what
   * separates "make a new one" from a navigation link at a glance.
   */
  actionIcon?: string;
  /** Larger display treatment for top-level sections on the main tab screens. */
  prominent?: boolean;
}) {
  const hover = useHoverLift();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, prominent && styles.sectionTitleProminent]}>
        {title}
      </Text>
      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          hitSlop={interaction.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel} — ${title}`}
          {...hover.hoverProps}
          style={({ pressed }) => [
            styles.sectionAction,
            hover.hoverStyle,
            pressed && styles.pressed,
          ]}
        >
          {actionIcon ? (
            <View style={styles.sectionActionCircle}>
              <Text style={styles.sectionActionGlyph}>{actionIcon}</Text>
            </View>
          ) : null}
          <Text style={styles.seeAll}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Pill-shaped filter chips (§13.2).
 *
 * `accentFor` is opt-in and defaults to undefined, which is the behaviour every
 * one of the seven call sites had before it existed: the active chip fills with
 * `colors.accent`. Return a colour from it and that option's active fill uses
 * the colour instead — News uses it to give each game tab its own identity
 * (`theme.gameAccents`), and returning undefined for an option leaves that one
 * on the blue. Nothing else in the app passes it, so nothing else changes.
 */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  accentFor,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  /** Per-option active colour. Undefined — for any option — keeps `colors.accent`. */
  accentFor?: (option: T) => string | undefined;
}) {
  return (
    <View style={styles.chipRow} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option === value;
        const accent = accentFor?.(option);
        return (
          <Pressable
            key={option}
            onPress={() => {
              /* Re-tapping the active chip is a no-op; firing a tick for it
                 would teach the hand that nothing happened. */
              if (active) return;
              haptics.selection();
              onChange(option);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              /* Overrides the fill only. The inactive chip keeps the neutral
                 surface on every tab, so the row reads as one control rather
                 than three differently-coloured ones. */
              active && accent ? { backgroundColor: accent, borderColor: accent } : null,
              pressed && !active && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      /* Not just visual: without this a screen reader reads a disabled CTA as
         a normal button, and the whole point of the import gate is that you
         can tell it is blocked. */
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        styles.buttonPrimary,
        pressed && { backgroundColor: colors.accentPressed, transform: [{ scale: interaction.pressedScale }] },
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={styles.buttonPrimaryText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.button,
        styles.buttonSecondary,
        disabled && styles.buttonDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonSecondaryText, disabled && styles.buttonSecondaryTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** §13.5 — empty and error variants are part of the base, not an afterthought. */
export function EmptyState({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {actionLabel ? (
        <View style={styles.emptyAction}>
          <PrimaryButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Skeleton block. Used instead of a spinner so layout does not jump on load.
 *
 * The pulse is not decoration: a motionless grey rectangle is exactly what a
 * *failed* load looks like, so a still skeleton was telling the user the app
 * had hung. Breathing opacity is the cheapest way to say "still working".
 *
 * Under Reduce Motion it parks at the bright end rather than the dim one — a
 * skeleton stuck at 40% opacity reads as disabled.
 */
export function LoadingState({ height = 120 }: { height?: number }) {
  const reduceMotion = useReduceMotion();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: motion.slow * 2,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: motion.slow * 2,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[
        styles.skeleton,
        { height, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) },
      ]}
    />
  );
}

/**
 * Entrance wrapper for grid and rail children: fade up, staggered by index.
 *
 * Why a wrapper and not a per-screen `Animated.View`: the stagger only reads as
 * intentional if every list in the app uses the same delay and the same
 * distance. Once two screens pick their own numbers it just looks like jank.
 *
 * `index` is capped so a 60-item grid does not spend two seconds arriving —
 * past the first screenful nobody is watching the entrance anyway.
 */
export function FadeInView({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReduceMotion();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: motion.base,
      delay: Math.min(index, 8) * motion.stagger,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [enter, index, reduceMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  art: { overflow: 'hidden', borderRadius: radius.card },
  /**
   * Width and height are explicit on both. Inset alone (`absoluteFill`, or
   * top/right/bottom/left) does not size an Image on web: react-native-web
   * writes the source's intrinsic pixel size onto the element, which wins over
   * the stretch and leaves a 660x440 render overflowing a 78x58 tile — you then
   * see its top-left corner at 8x zoom instead of the picture.
   */
  artFill: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  artSurroundings: {
    opacity: 0.88,
    transform: [{ scale: 1.06 }],
  },
  artSurroundingsShade: {
    backgroundColor: colors.surfaceSunken,
    opacity: 0.08,
  },
  artStripe: { position: 'absolute', width: '160%', height: 26, left: '-30%', top: '42%' },
  artGlow: {
    position: 'absolute',
    width: '55%',
    height: '55%',
    borderRadius: 999,
    left: '10%',
    top: '12%',
  },

  rarityBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  /* The one press treatment. Was previously three different ones across the
     component set, and half the pressables had none at all. */
  pressed: {
    opacity: interaction.pressedOpacity,
    transform: [{ scale: interaction.pressedScale }],
  },

  rarityBadgeCompact: { paddingHorizontal: spacing.xs, paddingVertical: 1 },
  rarityText: { ...typography.meta, fontSize: 10, letterSpacing: letterSpacing.wide },

  gameBadge: {
    alignSelf: 'flex-start',
    backgroundColor: scrim.medium,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  gameBadgeText: { ...typography.meta, fontSize: 10, color: colors.textPrimary, letterSpacing: 0.5 },

  avatar: {
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.textPrimary, fontWeight: '700' },
  tick: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  tickText: { color: colors.textOnAccent, fontWeight: '700' },

  /**
   * Shaped like the filter chips above it — same pill, same border, same
   * padding. A create action and a filter are both "small control in a row of
   * small controls"; giving them different shapes made the header look like two
   * unrelated toolbars.
   */
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sectionActionCircle: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  sectionActionGlyph: {
    color: colors.textOnAccent,
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '600',
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sectionTitle: { ...typography.sectionHeader, color: colors.textPrimary },
  sectionTitleProminent: { fontSize: 22, lineHeight: 28, letterSpacing: 0 },
  seeAll: { ...typography.meta, color: colors.accent },

  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...typography.meta, color: colors.textSecondary },
  chipTextActive: { color: colors.textOnAccent },

  button: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' },
  buttonDisabled: { opacity: interaction.disabledOpacity },
  buttonPrimaryText: { ...typography.cardTitle, color: colors.textOnAccent },
  buttonSecondaryText: { ...typography.cardTitle, color: colors.textPrimary },
  buttonSecondaryTextDisabled: { color: colors.textTertiary },

  empty: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  emptyTitle: { ...typography.cardTitle, color: colors.textPrimary },
  emptyBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  emptyAction: { marginTop: spacing.sm },

  skeleton: { backgroundColor: colors.surface, borderRadius: radius.card },
});
