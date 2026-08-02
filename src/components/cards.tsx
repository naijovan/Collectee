/**
 * Card components — PRD §13.3.
 *
 * `ItemCard` · `CollectionCard` · `CollectorCard` · `ArticleCard`. The other ten
 * shared components live in `./primitives`.
 *
 * Jovan owns every component in src/components/. Changes go via PR announced in
 * chat — this is where merge conflicts will otherwise happen.
 *
 * No new dependencies (§13.1), so icons stay unicode glyphs and art stays the
 * deterministic colour block from `ItemArt`.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DimensionValue } from 'react-native';

import { FEATURES } from '@/config/features';
import { rarityLabelFor } from '@/domain/rarity';
import { GAME_SHORT_LABELS } from '@/types';
import type { Article, Collection, Item, TrustLevel, User } from '@/types';
import { colors, radius, spacing, typography } from '@/theme/theme';

import { Avatar, GameBadge, ItemArt } from './primitives';

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
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width }, pressed && styles.pressed]}>
      <ItemArt seed={item.id} tier={item.rarityTier} style={{ height: artHeight }} />
      <View style={styles.itemBody}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.itemMeta}>
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
        <ItemArt
          seed={collection.id}
          tier={headline?.rarityTier ?? 'epic'}
          style={styles.collectionArt}
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
  pressed: { opacity: 0.7 },

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
  matchPercent: { ...typography.meta, color: colors.accent, fontWeight: '700' },
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
