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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ImageSourcePropType, LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { avatarArtFor } from '@/config/avatarRegistry';
import { resolveItemArt } from './item-art';

import { useReduceMotion } from '@/hooks/useReduceMotion';

import { artFor } from '@/config/artRegistry';
import { rarityLabelFor } from '@/domain/rarity';
import { GAME_SHORT_LABELS } from '@/types';
import type { GameTitle, RarityTier } from '@/types';
import * as haptics from '@/lib/haptics';
import {
  accentGradient,
  colors,
  gameAccents,
  interaction,
  letterSpacing,
  motion,
  radius,
  rarityColors,
  rarityGlyphs,
  rarityTreatments,
  scrim,
  spacing,
  typography, accentLink } from '@/theme/theme';

function ResolvedItemImage({
  source,
  fit,
  alt,
}: {
  source: ImageSourcePropType;
  fit: 'cover' | 'contain';
  alt?: string;
}) {
  return (
    <Image
      source={source}
      style={styles.artFill}
      resizeMode={fit}
      accessible={alt !== undefined}
      accessibilityLabel={alt}
      accessibilityIgnoresInvertColors
    />
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
 * The fallback stays so future catalogue entries do not become broken images
 * before their artwork lands.
 */
export function ItemArt({
  seed,
  tier,
  renderUrl,
  fit,
  useOriginalArt = false,
  style,
}: {
  seed: string;
  tier: RarityTier;
  /** `Item.renderUrl`. Omit for non-item art such as collection covers. */
  renderUrl?: string;
  /** Override the registry fit for decorative placements such as mosaics. */
  fit?: 'cover' | 'contain';
  /**
   * Draw the ORIGINAL artwork rather than the baked display rendition.
   *
   * `scripts/bake-display-art.ts` fills each rendition to a fixed frame by
   * compositing the art over a blurred, darkened copy of itself. On a card that
   * is the right trade — a gun keeps both ends and the bars read as a soft
   * vignette. On a large decorative panel it does not: the blur is big enough
   * to read as blur, and the subject sits in a letterboxed window inside a
   * frame that was supposed to be full-bleed.
   *
   * Callers that own their own crop (the Home hero, which offsets each panel by
   * hand) want the raw art and `fit="cover"` instead, so the panel fills with
   * picture rather than with a blurred approximation of it.
   */
  useOriginalArt?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFrame((current) =>
      Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1
        ? current
        : { width, height },
    );
  }, []);
  const art = artFor(seed);
  if (art !== null) {
    const resolvedFit = fit ?? art.fit;
    const useDisplaySource = art.displaySource !== undefined;
    /* Select by the rendered box, not by the window. A 180px phone card only
       needs the 600px texture, while a full-width hero on that same 3x phone
       needs the 1200px one. This also handles tablets, split windows and large
       desktop monitors without hard-coding another viewport breakpoint. */
    const density = PixelRatio.get();
    const aspectRatio = frame.height > 0 ? frame.width / frame.height : 3 / 2;
    const useSquareRendition = aspectRatio < 1.34;
    const fullSource = useSquareRendition
      ? art.displaySource?.squareWide
      : art.displaySource?.wide;
    const compactSource = useSquareRendition
      ? art.displaySource?.squareCompact
      : art.displaySource?.compact;
    const compactWidth = useSquareRendition ? 400 : 600;
    const compactIsSharpEnough =
      frame.width > 0 &&
      frame.height > 0 &&
      frame.width * density <= compactWidth &&
      frame.height * density <= 400;
    const displaySource =
      !useDisplaySource || useOriginalArt
        ? null
        : frame.width === 0
        ? viewportWidth < 600
          ? compactSource
          : fullSource
        : compactIsSharpEnough
        ? compactSource
        : fullSource;
    // The image sits inside the same container the colour block uses, so the
    // caller's ViewStyle (size, radius) still applies and `overflow: hidden`
    // does the clipping. Styling the Image directly does not typecheck —
    // callers pass ViewStyle, and ImageStyle has no `overflow: 'scroll'`.
    //
    // Card UI uses baked display renditions so the image fills its boundary
    // without letterbox bars. 3D/depth paths do not use ItemArt and keep the
    // original PNG through artRegistry directly.
    return (
      <View
        onLayout={onLayout}
        style={[styles.art, { backgroundColor: colors.surfaceSunken }, style]}
      >
        <ResolvedItemImage
          source={displaySource ?? art.source}
          fit={displaySource ? 'cover' : resolvedFit}
          alt={art.alt}
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

/**
 * The game chip on a cover. Carries its title's accent, not a neutral scrim.
 *
 * The same three colours the Gaming updates cards use (`gameAccents`, applied
 * in news.tsx) — CODM ember, Valorant red, MLBB blue. A collection card and a
 * news card both answer "which game is this?" and were answering it in two
 * different visual languages: one coloured, one grey.
 *
 * The accent lands on the BORDER and the TEXT, over the existing dark scrim —
 * not as a fill. A solid block of pure colour in the corner of a picture fights
 * the artwork, and tinting the background instead would mean replacing the
 * scrim that makes the chip legible on a busy crop in the first place.
 *
 * `secondary` rather than `base` for the label: the lighter end of each pair,
 * which is what keeps 10px type readable on a dark chip. Valorant red at `base`
 * is the one that fails that test.
 */
export function GameBadge({ title }: { title: GameTitle }) {
  return <TagBadge label={GAME_SHORT_LABELS[title]} accent={gameAccents[title]} />;
}

/**
 * The same chip, for a label that is not one of the three games — a community's
 * leading tag, which may be 'CODM' but may equally be 'cross-game'.
 *
 * Split out rather than widening `GameBadge`'s prop to a string: `GameBadge`
 * taking a `GameTitle` is what guarantees a game chip can never be given a
 * colour that does not belong to that game. This takes the accent explicitly,
 * so the caller owns the mapping and the two cannot be confused.
 */
export function TagBadge({
  label,
  accent,
}: {
  label: string;
  accent: { base: string; secondary: string };
}) {
  return (
    <View style={[styles.gameBadge, { borderColor: accent.base }]}>
      <Text style={[styles.gameBadgeText, { color: accent.secondary }]}>{label}</Text>
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

/**
 * A springy hover "pop" for controls that own their own space — filter chips,
 * pill CTAs, anything with a gap around it.
 *
 * ── Why this scales where `useHoverLift` refuses to ───────────────────────
 * `interaction.hoverLift` exists because a scale hover was tried on CARDS and
 * had to be pulled: a card in a wrapped grid grew past its own layout box, so
 * it overlapped its neighbours and pushed its border outside whatever contained
 * it. That reasoning is about grids, not about scaling as such. A chip in a
 * spaced row or a button with margin has room to breathe, and on those a lift
 * alone is so subtle that the control reads as inert — which is the report this
 * hook answers.
 *
 * So: `useHoverLift` for anything tiled, this for anything standalone. Do not
 * reach for this one inside a grid.
 *
 * ── Spring, not timing ───────────────────────────────────────────────────
 * The overshoot is the whole effect. A linear tween to the same scale reads as
 * a resize; the settle is what makes it read as a press-ready control.
 *
 * Returns a style for an `Animated.View` WRAPPING the pressable rather than for
 * the pressable itself, so the caller keeps `Pressable`'s function-style API
 * (`({ pressed }) => …`) intact. Hover still fires on the inner element, and
 * since the wrapper only grows, the pointer stays inside it throughout.
 */
export function useHoverPop({ scale = 1.06, lift = -2 }: { scale?: number; lift?: number } = {}) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  const settle = useCallback(
    (to: number) => {
      if (reduceMotion) {
        progress.setValue(0);
        return;
      }
      Animated.spring(progress, {
        toValue: to,
        friction: motion.spring.friction,
        tension: motion.spring.tension,
        /* Web has no native driver for transforms in RN Web; everywhere else
           this keeps the spring off the JS thread. */
        useNativeDriver: Platform.OS !== 'web',
      }).start();
    },
    [progress, reduceMotion],
  );

  return {
    hoverProps: {
      onHoverIn: () => settle(1),
      onHoverOut: () => settle(0),
    },
    popStyle: {
      transform: [
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, scale] }) },
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, lift] }) },
      ],
    },
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
      {options.map((option) => (
        <Chip
          key={option}
          label={option}
          active={option === value}
          accent={accentFor?.(option)}
          onPress={() => onChange(option)}
        />
      ))}
    </View>
  );
}

/**
 * One chip. Its own component purely so it can hold a hook — `useHoverPop` is
 * per-element state and cannot be called inside the map above.
 */
function Chip({
  label,
  active,
  accent,
  onPress,
}: {
  label: string;
  active: boolean;
  accent?: string;
  onPress: () => void;
}) {
  const pop = useHoverPop();
  return (
    <Animated.View style={pop.popStyle}>
      <Pressable
        {...pop.hoverProps}
        onPress={() => {
          /* Re-tapping the active chip is a no-op; firing a tick for it
             would teach the hand that nothing happened. */
          if (active) return;
          haptics.selection();
          onPress();
        }}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={label}
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
        {/* The active chip takes the same gradient as the buttons, EXCEPT
            when a per-option accent is supplied — News gives each game tab
            its own colour, and a violet ramp over an ember tab would undo
            the thing that override exists to do. */}
        {active && !accent ? <AccentFill /> : null}
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

/**
 * The accent gradient as a fill layer, for CTAs that are not `PrimaryButton`.
 *
 * Several screens build their own call-to-action — the tab bar's centre action,
 * the assistant bubble, "Enter the room", the Collections tab's add pill — and
 * each had `backgroundColor: colors.accent` written into its own stylesheet.
 * Rather than teach twenty stylesheets about a gradient, they drop this in as
 * an absolutely-positioned first child and keep their existing layout.
 *
 * ⚠️ The parent needs `overflow: 'hidden'` or the fill draws a square behind a
 * rounded control, and the CONTENT must come after this in the tree or the
 * gradient paints over it.
 *
 * Deliberately NOT applied to every accent-coloured surface. Checkboxes, filter
 * chips, stepper circles, the avatar's verification tick, the scan beam and the
 * tab indicator are all `colors.accent` too, and a gradient across 16px is
 * invisible at best and a rendering bug at worst. This is for things shaped
 * like buttons.
 */
export function AccentFill({ pressed = false }: { pressed?: boolean }) {
  return (
    <LinearGradient
      colors={
        pressed
          ? [accentGradient.to, accentGradient.from]
          : [accentGradient.from, accentGradient.to]
      }
      start={accentGradient.start}
      end={accentGradient.end}
      style={styles.accentFill}
      pointerEvents="none"
    />
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
  const pop = useHoverPop();
  return (
    /* The wrapper carries the pop; the Pressable keeps its function style. A
       disabled button gets no hover props, so it stays put — a control that
       animates to the pointer and then refuses the click is worse than one
       that never moved. */
    <Animated.View style={disabled ? null : pop.popStyle}>
    <Pressable
      {...(disabled ? {} : pop.hoverProps)}
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
        pressed && { transform: [{ scale: interaction.pressedScale }] },
        disabled && styles.buttonDisabled,
      ]}
    >
      {({ pressed }) => (
        <>
          {/*
            The fill is a gradient rather than a flat colour. `accent` is still
            the midpoint of the ramp, so this is the same blue with a light
            source on it, not a new colour — see `accentGradient` for why it is
            deliberately narrow.

            Skipped entirely when disabled: a lit surface on a control that
            cannot be pressed is the wrong signal, and the flat disabled style
            underneath already says so.
          */}
          {!disabled ? (
            <LinearGradient
              colors={
                pressed
                  ? [accentGradient.to, accentGradient.from]
                  : [accentGradient.from, accentGradient.to]
              }
              start={accentGradient.start}
              end={accentGradient.end}
              style={styles.buttonFill}
              pointerEvents="none"
            />
          ) : null}
          <Text style={styles.buttonPrimaryText}>{label}</Text>
        </>
      )}
    </Pressable>
    </Animated.View>
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
  const pop = useHoverPop();
  return (
    /* The wrapper carries the pop; the Pressable keeps its function style. A
       disabled button gets no hover props, so it stays put — a control that
       animates to the pointer and then refuses the click is worse than one
       that never moved. */
    <Animated.View style={disabled ? null : pop.popStyle}>
    <Pressable
      {...(disabled ? {} : pop.hoverProps)}
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
    </Animated.View>
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
    /* Colour comes from `gameAccents` at the call site. The scrim underneath
       stays so the chip still separates from a busy crop — `soft` is only 14%
       opaque and cannot carry the label on its own. */
    backgroundColor: scrim.medium,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  gameBadgeText: { ...typography.meta, fontSize: 10, letterSpacing: 0.5 },

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
  /* Text buttons take the gradient's violet end — see `accentLink`. */
  seeAll: { ...typography.meta, color: accentLink },

  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  /* `overflow: hidden` clips AccentFill to the pill. The flat accent stays
     underneath for the per-option-accent case, where no fill is drawn. */
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent, overflow: 'hidden' },
  chipText: { ...typography.meta, color: colors.textSecondary },
  chipTextActive: { color: colors.textOnAccent },

  button: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    /* Clips the gradient fill to the pill. Without it the ramp draws a square
       behind the rounded button. */
    overflow: 'hidden',
  },
  /* `accent` stays as the base colour underneath. The gradient covers it when
     enabled; when disabled the gradient is skipped and this is what shows, so
     a disabled CTA is still recognisably the primary button. */
  buttonPrimary: { backgroundColor: colors.accent },
  buttonFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  accentFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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
