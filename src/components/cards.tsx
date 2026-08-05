/**
 * Card components — PRD §13.3.
 *
 * `ItemCard` · `CollectionCard` · `CollectorCard` · `ArticleCard`. The other ten
 * shared components live in `./primitives`.
 *
 * Jovan owns every component in src/components/. Changes go via PR announced in
 * chat — this is where merge conflicts will otherwise happen.
 *
 * No new dependencies (§13.1), so icons stay unicode glyphs and item imagery
 * flows through the existing `ItemArt` seam.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { FEATURES } from '@/config/features';
import { rarityLabelFor } from '@/domain/rarity';
import { GAME_SHORT_LABELS } from '@/types';
import type { Article, Collection, Item, TrustLevel, User } from '@/types';
import {
  colors,
  fonts,
  interaction,
  radius,
  rarityTreatments,
  scrim,
  spacing,
  typography,
} from '@/theme/theme';

import { CollectionCoverMosaic } from './CollectionCoverMosaic';
import { Avatar, GameBadge, ItemArt, RarityBadge } from './primitives';

/** Fixtures use absolute dates so nothing drifts at demo time (§12.3). */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/**
 * §9.3 — the badge slot the PRD says `ItemCard` needs, or the trust claim comes
 * out of the pitch. Behind `FEATURES.trustUi` so the decision stays reversible.
 *
 * This is item trust, NOT the account-level blue tick on `Avatar`. Two different
 * concepts; the PRD is explicit that conflating them is a mistake.
 */
function TrustBadge({ level }: { level: TrustLevel }) {
  if (!FEATURES.trustUi) return null;
  const verified = level === 'verified';
  return (
    <View style={[styles.trust, verified ? styles.trustVerified : styles.trustUnverified]}>
      <Text style={[styles.trustText, { color: verified ? colors.success : colors.textTertiary }]}>
        {verified ? '✓ Verified' : 'Unverified'}
      </Text>
    </View>
  );
}

export function ItemCard({
  item,
  trustLevel,
  width = 132,
  artHeight = 100,
  onPress,
}: {
  item: Item;
  trustLevel?: TrustLevel;
  width?: DimensionValue;
  /** Art height. Fixed rather than derived, so a percentage width still works. */
  artHeight?: number;
  onPress?: () => void;
}) {
  /* Epic and up get the card itself tinted and lifted, not just the badge.
     `ItemCard` is the most repeated element in the app, so this is where the
     rarity ladder actually becomes legible — a wall of commons should look
     calm and a legendary should pull the eye out of the grid. */
  const treatment = rarityTreatments[item.rarityTier];
  const showcase = treatment.sheen;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${item.name}, ${rarityLabelFor(item.rarityTier, item.title)}`}
      style={({ pressed }) => [
        styles.itemCard,
        { width },
        showcase && {
          borderColor: treatment.base,
          borderWidth: treatment.borderWidth,
          shadowColor: treatment.base,
          shadowOpacity: 0.45,
          shadowRadius: treatment.elevation,
          shadowOffset: { width: 0, height: 2 },
          elevation: treatment.elevation,
        },
        pressed && styles.pressed,
      ]}
    >
      <View>
        <ItemArt
          seed={item.id}
          tier={item.rarityTier}
          renderUrl={item.renderUrl}
          style={{ height: artHeight }}
        />
        {/* Compact — the full native label ("Legendary", "Epic Skin", …) does
            not fit over 132px of art, and it is already printed below. */}
        <View style={styles.rarityOverlay} pointerEvents="none">
          <RarityBadge tier={item.rarityTier} title={item.title} compact />
        </View>
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={[styles.itemMeta, showcase && { color: treatment.base }]}>
          {GAME_SHORT_LABELS[item.title]} · {rarityLabelFor(item.rarityTier, item.title)}
        </Text>
        {trustLevel ? <TrustBadge level={trustLevel} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * §13.4 section 5 — game badge top-left, art, collector avatar + name + tick,
 * collection name, heart + like count.
 */
export function CollectionCard({
  collection,
  owner,
  headline,
  width,
  onPress,
}: {
  collection: Collection;
  owner?: User | null;
  /** The rarest item in the collection — drives the placeholder art tint. */
  headline?: Item | null;
  width?: DimensionValue;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.collectionCard, width ? { width } : null, pressed && styles.pressed]}
    >
      <View>
        {/* Composed from the members' own renders — never a baked collage. */}
        <CollectionCoverMosaic
          itemIds={collection.itemIds}
          tier={headline?.rarityTier ?? 'epic'}
          fallbackSeed={collection.id}
          style={styles.collectionArt}
        />
        {/* A real gradient, not the stacked-view fake used elsewhere: the game
            badge is white-on-translucent-black and was previously sitting on
            raw artwork, so on a bright cover it disappeared. Top-down scrim
            because the badge is top-left and the art's subject is usually
            centre — darkening the top costs nothing and guarantees contrast. */}
        <LinearGradient
          colors={[scrim.medium, scrim.clear]}
          style={styles.coverScrim}
          pointerEvents="none"
        />
        {headline ? (
          <View style={styles.badgeOverlay}>
            <GameBadge title={headline.title} />
          </View>
        ) : null}
      </View>

      <View style={styles.collectionBody}>
        {owner ? (
          <View style={styles.ownerRow}>
            <Avatar name={owner.displayName} verified={owner.isAccountVerified} size={20} />
            <Text style={styles.ownerName} numberOfLines={1}>
              {owner.displayName}
            </Text>
          </View>
        ) : null}

        <Text style={styles.collectionName} numberOfLines={1}>
          {collection.name}
        </Text>

        <View style={styles.likeRow}>
          <Text style={styles.like}>♥ {collection.likeCount.toLocaleString()}</Text>
          <Text style={styles.itemMeta}>{collection.itemIds.length} items</Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * §11 F5 — the reason is part of the feature, not a tooltip. A percentage
 * without its reason next to it is a broken card.
 */
export function CollectorCard({
  user,
  percent,
  reason,
  itemCount,
  width = 180,
  onPress,
}: {
  user: User;
  percent?: number;
  reason?: string;
  itemCount?: number;
  width?: number;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.collectorCard, { width }, pressed && styles.pressed]}
    >
      <Avatar name={user.displayName} verified={user.isAccountVerified} size={44} />
      <Text style={styles.collectorName} numberOfLines={1}>
        {user.displayName}
      </Text>
      {percent !== undefined ? <Text style={styles.matchPercent}>{percent}% match</Text> : null}
      {reason ? (
        <Text style={styles.collectorReason} numberOfLines={2}>
          {reason}
        </Text>
      ) : null}
      {itemCount !== undefined ? (
        <Text style={styles.itemMeta}>{itemCount} items</Text>
      ) : null}
    </Pressable>
  );
}

/** §13.4 section 4 — game tag, headline, blurb, timestamp. */
export function ArticleCard({
  article,
  reason,
  width,
  onPress,
}: {
  article: Article;
  /** FYP only — why this surfaced. Discover has no reason and shows none. */
  reason?: string | null;
  width?: DimensionValue;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.articleCard, width ? { width } : null, pressed && styles.pressed]}
    >
      <View style={styles.articleTagRow}>
        {article.relatedGames.map((title) => (
          <View key={title} style={styles.articleTag}>
            <Text style={styles.articleTagText}>{GAME_SHORT_LABELS[title]}</Text>
          </View>
        ))}
        <Text style={styles.itemMeta}>{timeAgo(article.publishedAt)}</Text>
      </View>

      <Text style={styles.articleTitle} numberOfLines={2}>
        {article.title}
      </Text>
      <Text style={styles.articleBlurb} numberOfLines={2}>
        {article.summary}
      </Text>

      {reason ? <Text style={styles.articleReason}>◆ {reason}</Text> : null}
      <Text style={styles.articleSource}>{article.sourceTitle}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: interaction.pressedOpacity, transform: [{ scale: interaction.pressedScale }] },

  /* Radius + overflow so an epic/legendary border clips the art corners rather
     than drawing a square frame around a rounded image. */
  itemCard: { borderRadius: radius.card, overflow: 'hidden' },
  rarityOverlay: { position: 'absolute', top: spacing.xs, right: spacing.xs },

  itemBody: { paddingTop: spacing.sm, gap: 2 },
  itemName: { ...typography.cardTitle, color: colors.textPrimary },
  itemMeta: { ...typography.meta, color: colors.textSecondary },

  trust: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  trustVerified: { borderColor: colors.success },
  trustUnverified: { borderColor: colors.border },
  trustText: { ...typography.meta, fontSize: 10 },

  collectionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  collectionArt: { height: 104, borderRadius: 0 },
  badgeOverlay: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  /** Only the top third — a full-height scrim would grey out the artwork. */
  coverScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: '38%' },
  collectionBody: { padding: spacing.md, gap: spacing.xs },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ownerName: { ...typography.meta, color: colors.textSecondary, flexShrink: 1 },
  collectionName: { ...typography.cardTitle, color: colors.textPrimary },
  likeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  like: { ...typography.meta, color: colors.danger },

  collectorCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
  collectorName: { ...typography.cardTitle, color: colors.textPrimary, marginTop: spacing.sm },
  /* Family-baked weight, not `fontWeight` — Android would synthesise a fake
     bold over the loaded Inter cut and it reads muddy at 12px. */
  matchPercent: {
    ...typography.meta,
    ...typography.numeric,
    color: colors.accent,
    fontFamily: fonts.bodySemiBold,
  },
  collectorReason: { ...typography.meta, color: colors.textSecondary },

  articleCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  articleTagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  articleTag: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  articleTagText: { ...typography.meta, fontSize: 10, color: colors.accent, letterSpacing: 0.5 },
  articleTitle: { ...typography.cardTitle, color: colors.textPrimary },
  articleBlurb: { ...typography.meta, color: colors.textSecondary },
  articleReason: { ...typography.meta, color: colors.accent },
  articleSource: { ...typography.meta, color: colors.textTertiary },
});
