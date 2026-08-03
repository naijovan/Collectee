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

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { artFor } from '@/config/artRegistry';
import { rarityLabelFor } from '@/domain/rarity';
import { GAME_SHORT_LABELS } from '@/types';
import type { GameTitle, RarityTier } from '@/types';
import { colors, radius, rarityColors, spacing, typography } from '@/theme/theme';

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
 * `seed` is the catalogue `Item.id` at every item call site, which is what
 * `artRegistry` is keyed on. Other call sites pass a collection id, a theme id
 * or a game title; those simply miss the registry and get the colour block, so
 * no caller has to know whether art exists.
 *
 * The fallback stays. It is what lets the app run with a partly-populated art
 * pack instead of showing broken images, and 73 catalogue items will not all
 * have renders for a while.
 */
export function ItemArt({
  seed,
  tier,
  style,
}: {
  seed: string;
  tier: RarityTier;
  style?: StyleProp<ViewStyle>;
}) {
  const art = artFor(seed);
  if (art !== null) {
    // The image sits inside the same container the colour block uses, so the
    // caller's ViewStyle (size, radius) still applies and `overflow: hidden`
    // does the clipping. Styling the Image directly does not typecheck —
    // callers pass ViewStyle, and ImageStyle has no `overflow: 'scroll'`.
    //
    // Objects get inset rather than bleeding to the edge: they are rendered on
    // empty space, so a little breathing room reads as a display case instead
    // of a cropped photo.
    return (
      <View style={[styles.art, { backgroundColor: colors.surfaceSunken }, style]}>
        <Image
          source={art.source}
          style={art.fit === 'contain' ? styles.artInset : StyleSheet.absoluteFill}
          resizeMode={art.fit}
          accessibilityIgnoresInvertColors
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

/** §12.2 — one badge component, five colour tokens, native label printed. */
export function RarityBadge({ tier, title }: { tier: RarityTier; title: GameTitle }) {
  return (
    <View style={[styles.rarityBadge, { borderColor: rarityColors[tier] }]}>
      <Text style={[styles.rarityText, { color: rarityColors[tier] }]}>
        {rarityLabelFor(tier, title).toUpperCase()}
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

/** Initials avatar with the account-level blue tick (§9.3 — NOT item trust). */
export function Avatar({
  name,
  verified,
  size = 36,
}: {
  name: string;
  verified?: boolean;
  size?: number;
}) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const hue = hash(name) % 360;
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
        <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
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
export function SectionHeader({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Pill-shaped filter chips (§13.2). */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={[styles.chip, active && styles.chipActive]}
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
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        styles.buttonPrimary,
        pressed && { backgroundColor: colors.accentPressed },
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={styles.buttonPrimaryText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.button, styles.buttonSecondary]}>
      <Text style={styles.buttonSecondaryText}>{label}</Text>
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

/** Skeleton block. Used instead of a spinner so layout does not jump on load. */
export function LoadingState({ height = 120 }: { height?: number }) {
  return <View style={[styles.skeleton, { height }]} />;
}

const styles = StyleSheet.create({
  art: { overflow: 'hidden', borderRadius: radius.card },
  /** Small inset for `contain` renders; the PNGs already carry ~10% margin. */
  artInset: { position: 'absolute', top: '4%', left: '4%', right: '4%', bottom: '4%' },
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
  rarityText: { ...typography.meta, fontSize: 10, letterSpacing: 0.5 },

  gameBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  gameBadgeText: { ...typography.meta, fontSize: 10, color: colors.textPrimary, letterSpacing: 0.5 },

  avatar: { alignItems: 'center', justifyContent: 'center' },
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

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.sectionHeader, color: colors.textPrimary },
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
  buttonDisabled: { opacity: 0.4 },
  buttonPrimaryText: { ...typography.cardTitle, color: colors.textOnAccent },
  buttonSecondaryText: { ...typography.cardTitle, color: colors.textPrimary },

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
