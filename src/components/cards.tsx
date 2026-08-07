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

import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { artFor } from '@/config/artRegistry';
import { communityArtFor } from '@/config/communityArt';
import { FEATURES } from '@/config/features';
import { newsThumbFor } from '@/config/newsThumbs';
import { rarityLabelFor } from '@/domain/rarity';
import { GAME_LABELS, GAME_SHORT_LABELS } from '@/types';
import type { Article, Collection, Community, Item, TrustLevel, User } from '@/types';
import {
  colors,
  fonts,
  gameAccents,
  interaction,
  radius,
  rarityColors,
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
/** Stable per-string index, mirroring the one in `primitives`. */
function communityHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Placeholder tints for communities. Accent and the neutral end of the rarity
 * scale — never a high tier, because a mythic-red community block would imply a
 * rarity a community does not have.
 */
const COMMUNITY_TINTS = [colors.accent, rarityColors.rare, rarityColors.epic, rarityColors.common];

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
  /**
   * Hover is a real affordance here, not decoration: the card lost its CTA, so
   * without one there is nothing telling a pointer user the tile is clickable.
   * Touch devices never fire these, which is correct — they get the press
   * state instead.
   */
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={`${collection.name}, ${collection.itemIds.length} items`}
      style={({ pressed }) => [
        styles.collectionCard,
        width ? { width } : null,
        hovered && styles.collectionCardHovered,
        pressed && styles.pressed,
      ]}
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
        {/* Attribution sits on the cover, opposite the game badge, so the body
            below belongs entirely to the collection itself. */}
        {owner ? (
          <View style={styles.ownerOverlay}>
            <Avatar
              name={owner.displayName}
              avatarId={owner.avatar}
              verified={owner.isAccountVerified}
              size={18}
            />
            <Text style={styles.ownerOverlayName} numberOfLines={1}>
              {owner.displayName}
            </Text>
          </View>
        ) : null}
        {hovered ? (
          <View style={styles.hoverVeil} pointerEvents="none">
            <View style={styles.hoverPill}>
              <Text style={styles.hoverText}>View collection →</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.collectionBody}>
        {/* Title first. The collection is what the card is about; the creator is
            attribution, and attribution reads better under the thing it
            attributes than above it. */}
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
/**
 * Community art — the bundled header image, or the deterministic tinted block
 * `ItemArt` falls back to.
 *
 * Communities have no rarity, so the tint comes from the id rather than a tier:
 * a community is not on the value ladder and borrowing a rarity colour for one
 * would say something untrue about it (§12.2). The geometry is `ItemArt`'s, so
 * a card with art and a card without read as the same component.
 */
export function CommunityArt({
  communityId,
  name,
  style,
}: {
  communityId: string;
  name: string;
  style?: StyleProp<ViewStyle>;
}) {
  const art = communityArtFor(communityId);
  if (art !== null) {
    return (
      <View style={[styles.communityArt, style]}>
        <Image
          source={art}
          style={styles.communityArtFill}
          resizeMode="cover"
          accessible
          accessibilityLabel={`${name} community artwork`}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  const tint = COMMUNITY_TINTS[communityHash(communityId) % COMMUNITY_TINTS.length]!;
  const angle = communityHash(name) % 3;
  return (
    <View style={[styles.communityArt, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: 0.16 }]} />
      <View
        style={[
          styles.communityStripe,
          { backgroundColor: tint, opacity: 0.5, transform: [{ rotate: `${-28 + angle * 14}deg` }] },
        ]}
      />
      <View style={[styles.communityGlow, { backgroundColor: tint, opacity: 0.22 }]} />
    </View>
  );
}

/**
 * A community, as a card: image on top, name and member count below.
 *
 * The same shape as `CollectionCard`, deliberately. Communities and collections
 * are both browsable tiles on Explore, and until now one was a picture and the
 * other a 44px circle beside two lines of text — which read as two tiers of
 * content rather than two kinds of it.
 *
 * `action` is a slot rather than a baked-in Join button: Explore's recommended
 * list needs one, the "your communities" list does not, and the detail screen
 * has its own.
 */
export function CommunityCard({
  community,
  memberCount,
  reason,
  width,
  onPress,
  action,
}: {
  community: Community;
  /** Passed in, never read off the fixture — membership is a session overlay. */
  memberCount: number;
  /** Why it was recommended (§11 F5 — a score without its reason is broken). */
  reason?: string;
  width?: DimensionValue;
  onPress?: () => void;
  action?: React.ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  /**
   * The card and its action are SIBLINGS, not parent and child.
   *
   * react-native-web renders `accessibilityRole="button"` as a real `<button>`
   * element, so an action nested inside a tappable card is a `<button>` inside
   * a `<button>` — invalid HTML, and React says so in an error overlay. It also
   * behaves badly on its own terms: a tap on the inner control bubbles to the
   * outer one, so joining a community would also navigate into it.
   *
   * Dropping the role on either would silence the warning and cost the thing
   * the role buys — keyboard focus, Enter/Space, and a screen reader announcing
   * two controls. So the action is lifted out and positioned over the card
   * instead. Two siblings, two roles, no bubbling to stop.
   */
  return (
    <View style={[styles.communityWrap, width ? { width } : null]}>
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      accessibilityRole="button"
      accessibilityLabel={`${community.name}, ${memberCount.toLocaleString()} members`}
      style={({ pressed }) => [
        styles.collectionCard,
        hovered && styles.collectionCardHovered,
        pressed && styles.pressed,
      ]}
    >
      <View>
        <CommunityArt communityId={community.id} name={community.name} />
        <LinearGradient
          colors={[scrim.medium, scrim.clear]}
          style={styles.coverScrim}
          pointerEvents="none"
        />
        {community.tags[0] ? (
          <View style={styles.badgeOverlay}>
            <View style={styles.communityTag}>
              <Text style={styles.communityTagText}>{community.tags[0]}</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.collectionBody}>
        <Text style={styles.collectionName} numberOfLines={2}>
          {community.name}
        </Text>
        <Text style={styles.ownerName}>{memberCount.toLocaleString()} members</Text>
        {reason ? (
          <Text style={styles.communityReason} numberOfLines={2}>
            {reason}
          </Text>
        ) : null}
      </View>
    </Pressable>
    {/* Over the image, opposite the tag. Outside the Pressable above, so it is
        a sibling in the DOM as well as in the layout. */}
    {action ? (
      <View style={styles.communityAction} pointerEvents="box-none">
        {action}
      </View>
    ) : null}
    </View>
  );
}

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
      <Avatar
        name={user.displayName}
        avatarId={user.avatar}
        verified={user.isAccountVerified}
        size={44}
      />
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
/**
 * The thumbnail on a media-variant `ArticleCard`.
 *
 * Resolves the article's FIRST related item through the real art registry —
 * `config/artRegistry`, not `components/item-art`, whose `ITEM_ART` map is empty
 * and has no entries to give. All 12 related-item ids across the seeded
 * articles resolve, so this is a real render rather than a block in practice.
 *
 * ── Why not `ItemArt` ─────────────────────────────────────────────────────
 * `ItemArt` requires a `RarityTier` to draw its fallback. An article has no
 * rarity, and inventing one to satisfy the signature would put a rarity
 * decision outside `domain/rarity.ts`. Going to `artFor` directly keeps the
 * rule intact and skips a fallback this component does not want anyway.
 *
 * Without a related item — one seeded article has none — it draws the game's
 * accent, which is the same block the banner uses and reads as intentional.
 */
/**
 * The item render behind an article's thumbnail, or null.
 *
 * Shared by the card and the thumb so the two cannot disagree: the card needs
 * to know whether art exists BEFORE it picks a layout — the micro variant drops
 * to text-only when there is none — and the thumb needs the same answer to draw
 * it. Both do one map lookup rather than one deciding and the other guessing.
 *
 * Falls back to the article's own first id so a lone card still renders
 * sensibly, but callers rendering a LIST pass an id from
 * `domain/news.pickThumbnailIds`, which is what stops two rows sharing a
 * picture. See that function for why the list, not the card, decides.
 */
function articleItemArt(article: Article, itemId?: string | null) {
  const chosen = itemId ?? article.relatedItemIds[0] ?? null;
  return chosen ? artFor(chosen) : null;
}

function ArticleThumb({
  article,
  itemId,
  variant,
}: {
  article: Article;
  itemId?: string | null;
  variant: ThumbVariant;
}) {
  const art = articleItemArt(article, itemId);
  const title = article.relatedGames[0];
  const accent = title ? gameAccents[title] : null;
  const box = variant === 'micro' ? styles.articleThumbMicro : styles.articleThumb;

  if (art) {
    return (
      <View style={box}>
        <Image
          source={art.source}
          /* Objects ship on empty backgrounds and are inset so they are not
             cropped; portraits fill. Same split `ItemArt` makes, for the same
             reason — one rule for both either letterboxes every face or slices
             the ends off every blade. */
          style={art.fit === 'contain' ? styles.articleThumbInset : styles.articleThumbFill}
          resizeMode={art.fit}
          accessible
          accessibilityLabel={art.alt}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  /* Micro has NO fallback by design — no generic image, no accent block. At
     56px any placeholder is a smudge that reads as noise rather than as art, so
     a card with no item render simply keeps the text layout. `ArticleCard`
     already checked this via `articleItemArt` and will not render the row at
     all; this guard is here so the component is honest on its own. */
  if (variant === 'micro') return null;

  /* No related item — the cross-game spend piece is the seeded example. The
     generic per-game image is the honest picture for a story about no single
     item, and it is a designed slot rather than the raw colour block, which
     read as unfinished next to a row of real renders.
     First tag wins for a multi-game article: arbitrary between equals, but
     deterministic, and the chips beside it show the full set. */
  if (title) {
    const generic = newsThumbFor(title);
    if (generic) {
      return (
        <View style={styles.articleThumb}>
          <Image
            source={generic}
            style={styles.articleThumbFill}
            resizeMode="cover"
            accessible
            accessibilityLabel={`${GAME_LABELS[title]} news`}
            accessibilityIgnoresInvertColors
          />
        </View>
      );
    }
  }

  /* Still the last resort, and still reachable: the generic art is a seam that
     ships empty until the art lands. */
  if (accent) {
    return (
      <LinearGradient
        colors={[accent.base, accent.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.articleThumb}
      />
    );
  }

  return <View style={[styles.articleThumb, styles.articleThumbEmpty]} />;
}

/**
 * How an article card carries its picture.
 *
 * A single variant rather than two booleans: `media` plus a `micro` flag would
 * have a meaningless both-set state, and the two differ in more than size —
 * their fallback behaviour is deliberately opposite.
 *
 *   'media'  88px, News list. Always renders something: item art, else the
 *            generic per-game image, else the accent block.
 *   'micro'  56px, Home rail. Item art ONLY — no generic, no block. A card
 *            without a render keeps the plain text layout, because at that size
 *            a placeholder is noise rather than art.
 *
 * Undefined is text-only, which is what every caller had before thumbnails
 * existed.
 */
export type ThumbVariant = 'media' | 'micro';

export function ArticleCard({
  article,
  reason,
  width,
  accentTags,
  accentEdge,
  thumb,
  thumbItemId,
  onPress,
}: {
  article: Article;
  /** FYP only — why this surfaced. Discover has no reason and shows none. */
  reason?: string | null;
  width?: DimensionValue;
  /**
   * Colour each game tag with that game's own accent instead of the blue.
   *
   * Opt-in, and off by default, so Home's news rail renders exactly as it did
   * before this prop existed. News turns it on because its tabs are already
   * game-themed and a blue tag inside an ember-themed tab reads as a different
   * control.
   *
   * Per TAG, not per screen: an article tagged both CODM and VALORANT shows one
   * ember chip and one red one, which says more than tinting both with whatever
   * tab you happen to be standing on.
   */
  accentTags?: boolean;
  /**
   * Slim left edge in the game's accent, matching the digest card on News.
   *
   * Opt-in. Takes the FIRST tag's game for a cross-game article, the same rule
   * the thumbnail and the banner use. An edge rather than a full outline for
   * the reason the digest gives: a whole card ringed in ember competes with
   * everything around it, and the job is to tie the card to a game, not shout.
   */
  accentEdge?: boolean;
  /**
   * Thumbnail treatment — see `ThumbVariant`. Omitted, the card is text-only,
   * which is what it was before thumbnails existed.
   *
   * Thumbnail-left rather than top because both callers are dense lists: the
   * top-image treatment is the pattern for the GRID cards (`CollectionCard`,
   * `CommunityCard`), and a top image would roughly halve what fits on screen.
   */
  thumb?: ThumbVariant;
  /**
   * Which related item supplies the thumbnail, when the caller has worked it
   * out across the whole list — see `domain/news.pickThumbnailIds`. Omitted,
   * the card falls back to the article's own first related item, which is
   * correct for a lone card and wrong for a list.
   *
   * Ignored unless `thumb` is set.
   */
  thumbItemId?: string | null;
  onPress?: () => void;
}) {
  /* Resolved before the layout is chosen, because for `micro` it DECIDES the
     layout: no item render means no thumbnail and no row, just the text card.
     `media` always shows a thumbnail, so for it this only picks the picture. */
  const hasItemArt = articleItemArt(article, thumbItemId) !== null;
  const showThumb = thumb === 'media' || (thumb === 'micro' && hasItemArt);

  const edgeGame = accentEdge ? article.relatedGames[0] : undefined;
  const edge = edgeGame ? gameAccents[edgeGame] : null;

  /* Only the media variant trades the second summary line for density. Micro
     keeps the full text stack deliberately: the rail's card height is set by
     that stack, and shortening it here would resize every card on Home. */
  const tight = thumb === 'media';

  const body = (
    <>
      <View style={styles.articleTagRow}>
        {article.relatedGames.map((title) => {
          const accent = accentTags ? gameAccents[title] : null;
          return (
            <View
              key={title}
              style={[styles.articleTag, accent ? { backgroundColor: accent.soft } : null]}
            >
              <Text style={[styles.articleTagText, accent ? { color: accent.base } : null]}>
                {GAME_SHORT_LABELS[title]}
              </Text>
            </View>
          );
        })}
        <Text style={styles.itemMeta}>{timeAgo(article.publishedAt)}</Text>
      </View>

      <Text style={styles.articleTitle} numberOfLines={2}>
        {article.title}
      </Text>
      {/* One line beside a media thumbnail, two everywhere else. */}
      <Text style={styles.articleBlurb} numberOfLines={tight ? 1 : 2}>
        {article.summary}
      </Text>

      {reason ? (
        <Text style={styles.articleReason} numberOfLines={tight ? 1 : undefined}>
          ◆ {reason}
        </Text>
      ) : null}
      <Text style={styles.articleSource} numberOfLines={1}>
        {article.sourceTitle}
      </Text>
    </>
  );

  if (showThumb && thumb) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.articleCard,
          styles.articleCardMedia,
          width ? { width } : null,
          edge ? { borderLeftColor: edge.base, borderLeftWidth: 3 } : null,
          pressed && styles.pressed,
        ]}
      >
        <ArticleThumb article={article} itemId={thumbItemId} variant={thumb} />
        {/* `minWidth: 0` is what lets numberOfLines actually truncate: without
            it a flex child sizes to its content and the title pushes the card
            wider instead of ellipsing. */}
        <View style={styles.articleBody}>{body}</View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.articleCard,
        width ? { width } : null,
        edge ? { borderLeftColor: edge.base, borderLeftWidth: 3 } : null,
        pressed && styles.pressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: interaction.pressedOpacity, transform: [{ scale: interaction.pressedScale }] },

  collectionCardHovered: {
    borderColor: colors.accent,
    transform: [{ translateY: -2 }],
  },
  /** Sits over the cover only, so the title and counts stay readable. */
  hoverVeil: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: scrim.hover,
  },
  hoverPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  hoverText: { ...typography.meta, color: colors.textOnAccent, fontWeight: '600' },

  /* Radius + overflow so an epic/legendary border clips the art corners rather
     than drawing a square frame around a rounded image. */
  itemCard: { borderRadius: radius.card, overflow: 'hidden' },
  rarityOverlay: { position: 'absolute', top: spacing.xs, right: spacing.xs },

  itemBody: {
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  // Two lines' worth of height whether the name needs one or two, so a row of
  // cards is one height. Without it the grid stair-steps by name length.
  itemName: { ...typography.cardTitle, color: colors.textPrimary, minHeight: 40 },
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
  // Taller than the 104 it was: three panels across a half-width card make each
  // one narrow, and at 104 they were wider than they were tall — weapons read
  // as slivers. 148 gives each panel a near-square crop.
  collectionArt: { height: 148, borderRadius: 0 },
  communityArt: {
    height: 148,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityArtFill: { width: '100%', height: '100%' },
  communityStripe: { position: 'absolute', width: '150%', height: 26 },
  communityGlow: { position: 'absolute', width: 90, height: 90, borderRadius: 45 },
  communityTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: scrim.heavy,
  },
  communityTagText: { ...typography.meta, color: colors.textPrimary },
  communityReason: { ...typography.meta, color: colors.textTertiary },
  /* `relative` so the absolutely-positioned action anchors to the card and not
     to whatever scroll container happens to be above it. */
  communityWrap: { position: 'relative' },
  communityAction: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  badgeOverlay: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  ownerOverlay: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: 2,
    paddingRight: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: scrim.medium,
  },
  ownerOverlayName: { ...typography.meta, color: colors.textPrimary, maxWidth: 96 },
  /** Only the top third — a full-height scrim would grey out the artwork. */
  coverScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: '38%' },
  collectionBody: { padding: spacing.md, gap: spacing.xs },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ownerName: { ...typography.meta, color: colors.textSecondary, flexShrink: 1 },
  // Bigger and heavier than cardTitle: on a browse grid the collection name is
  // the thing being chosen between, so it should win the card outright rather
  // than tie with the counts underneath it.
  collectionName: {
    ...typography.sectionHeader,
    fontSize: 21,
    lineHeight: 27,
    fontFamily: fonts.display,
    color: colors.textPrimary,
  },
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
  /* Row instead of column, and a wider gap — `articleCard`'s `xs` is the gap
     between stacked text lines, which would be far too tight beside an 88px
     thumbnail. */
  articleCardMedia: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  /* minWidth 0 lets the text truncate rather than stretch the card. A flex
     child defaults to min-content width, which ignores numberOfLines. */
  articleBody: { flex: 1, minWidth: 0, gap: spacing.xs },
  articleThumb: {
    width: 88,
    height: 88,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
  },
  /* 56 rather than 88: the rail card is 248 wide and its height is set by the
     text stack (~118px), so a thumb shorter than the stack cannot change the
     card's height — which is what keeps Home's layout below the rail fixed. */
  articleThumbMicro: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
  },
  articleThumbFill: { width: '100%', height: '100%' },
  /* Objects sit on empty space; a little inset reads as a display case rather
     than a cropped photo. */
  articleThumbInset: { width: '100%', height: '100%', padding: spacing.xs },
  articleThumbEmpty: { borderWidth: 1, borderColor: colors.border },
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
