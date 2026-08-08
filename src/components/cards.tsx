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
import { VISIBILITY_LABELS } from '@/domain/collections';
import { rarityLabelFor } from '@/domain/rarity';
import { GAME_LABELS, GAME_SHORT_LABELS } from '@/types';
import type { Article, Collection, Community, Item, TrustLevel, User } from '@/types';

import { useHoverLift } from './primitives';
import {
  colors,
  fonts,
  gameAccents,
  interaction,
  radius,
  rarityColors,
  rarityTreatments,
  scrim,
  visibilityColors,
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
  artHeight,
  overlay = false,
  onPress,
}: {
  item: Item;
  trustLevel?: TrustLevel;
  width?: DimensionValue;
  /** Fixed height for compact strips. Grids default to the artwork's 3:2 frame. */
  artHeight?: number;
  /**
   * Lay the name and meta ON the art instead of in a panel beneath it.
   *
   * Opt-in rather than the default, because the two shapes suit different
   * surfaces. A dense grid of forty items reads better with its labels on a
   * solid strip — the art is small there and type over a busy crop at that size
   * is work to read. A rail of large cards is the opposite case, and it sits
   * beside collection and showroom cards that are all overlaid, so a panelled
   * one is the odd shape out.
   */
  overlay?: boolean;
  onPress?: () => void;
}) {
  /* Epic and up get the card itself tinted and lifted, not just the badge.
     `ItemCard` is the most repeated element in the app, so this is where the
     rarity ladder actually becomes legible — a wall of commons should look
     calm and a legendary should pull the eye out of the grid. */
  const treatment = rarityTreatments[item.rarityTier];
  const showcase = treatment.sheen;
  const hover = useHoverLift();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${item.name}, ${rarityLabelFor(item.rarityTier, item.title)}`}
      {...(onPress ? hover.hoverProps : {})}
      style={({ pressed }) => [
        styles.itemCard,
        { width },
        onPress ? hover.hoverStyle : null,
        onPress ? hover.hoverBorder : null,
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
          /* `cover` on the overlay variant so the subject fills the tile.
             The registry's default is `contain`, which is right for a small
             grid thumbnail — nothing is ever cut — but on a 168x200 card it
             letterboxed the character portraits and left them floating to one
             side inside their own box. */
          fit={overlay ? 'cover' : undefined}
          style={artHeight === undefined ? styles.itemArt : { height: artHeight }}
        />
        {/* Compact — the full native label ("Legendary", "Epic Skin", …) does
            not fit over 132px of art, and it is already printed below.

            Hidden on the overlay variant: that one has room to print the full
            label at the bottom, and showing the glyph as well would put the
            same fact in two corners of a 168px card. */}
        {overlay ? null : (
          <View style={styles.rarityOverlay} pointerEvents="none">
            <RarityBadge tier={item.rarityTier} title={item.title} compact />
          </View>
        )}

        {/* Game badge top-left, same component and colours as the collection
            covers and the news cards. The overlay variant loses the meta row
            that used to print the game underneath, so without this the one
            thing telling you which title an item belongs to would be gone. */}
        {overlay ? (
          <View style={styles.badgeOverlay}>
            <GameBadge title={item.title} />
          </View>
        ) : null}

        {overlay ? (
          <>
            <LinearGradient
              colors={[scrim.clear, scrim.medium, scrim.heavy]}
              locations={[0, 0.45, 1]}
              style={styles.itemScrim}
              pointerEvents="none"
            />
            <View style={styles.itemOverlayBody} pointerEvents="none">
              <Text style={styles.itemOverlayName} numberOfLines={2}>
                {item.name}
              </Text>
              {/* Rarity in words rather than the game, which the badge above
                  now carries. Printing both would say the same two facts twice
                  on a 168px card. */}
              <View style={styles.itemMetaRow}>
                <Text
                  style={[styles.itemOverlayMeta, { color: rarityColors[item.rarityTier] }]}
                  numberOfLines={1}
                >
                  {rarityLabelFor(item.rarityTier, item.title)}
                </Text>
                {trustLevel ? <TrustBadge level={trustLevel} /> : null}
              </View>
            </View>
          </>
        ) : null}
      </View>
      {overlay ? null : (
      <View style={styles.itemBody}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>
        {/* Trust sits on the meta line rather than under it: it belongs to the
            same tier of information as game and rarity, and stacking it added a
            row that pushed every card taller for one word. */}
        <View style={styles.itemMetaRow}>
          <Text
            style={[styles.itemMeta, styles.itemMetaText, showcase && { color: treatment.base }]}
            numberOfLines={1}
          >
            {GAME_SHORT_LABELS[item.title]} · {rarityLabelFor(item.rarityTier, item.title)}
          </Text>
          {trustLevel ? <TrustBadge level={trustLevel} /> : null}
        </View>
      </View>
      )}
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
  showVisibility = false,
  onPress,
}: {
  collection: Collection;
  owner?: User | null;
  /** The rarest item in the collection — drives the placeholder art tint. */
  headline?: Item | null;
  width?: DimensionValue;
  /**
   * Print Public/Unlisted/Private under the title.
   *
   * Opt-in, because it is only ever news on YOUR OWN collections — every
   * collection on a public feed is public by definition, so the label there
   * would be a row of identical words. The Collections tab passes it; Home
   * does not.
   */
  showVisibility?: boolean;
  onPress?: () => void;
}) {
  /**
   * Hover is a real affordance here, not decoration: the card lost its CTA, so
   * without one there is nothing telling a pointer user the tile is clickable.
   * Touch devices never fire these, which is correct — they get the press
   * state instead.
   */
  const hover = useHoverLift();
  const hovered = hover.hovered;

  return (
    <Pressable
      onPress={onPress}
      {...hover.hoverProps}
      accessibilityRole="button"
      accessibilityLabel={`${collection.name}, ${collection.itemIds.length} items`}
      style={({ pressed }) => [
        styles.collectionCard,
        width ? { width } : null,
        hover.hoverStyle,
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
        {/* Attribution top-right, diagonally opposite the game badge. The two
            corner marks frame the art between them, and it keeps the bottom
            band for the collection's own name and counts. */}
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
        {/*
          ── Everything below sits ON the cover ─────────────────────────────
          The meta used to be a body panel underneath, which meant the card
          spent its height twice — once on art, once on a strip of surface — and
          the art had to stay short to keep the card compact. Overlaid, the
          cover gets the whole card and the card gets taller art at the same
          overall size.

          Nothing is cropped by this. The mosaic still cover-fits its own box;
          the only change is what is drawn over its lower band, and the fade
          below guarantees that band is dark enough to read on.
        */}
        <LinearGradient
          colors={[scrim.clear, scrim.medium, scrim.heavy]}
          locations={[0, 0.45, 1]}
          style={styles.metaScrim}
          pointerEvents="none"
        />

        <View style={styles.metaOverlay} pointerEvents="none">
          {/* Name left, counts right. The name is what you read; the numbers are
              what you glance at, and stacking them right-aligned keeps both out
              of each other's way on a narrow card. */}
          <View style={styles.metaLeft}>
            <Text style={styles.metaName} numberOfLines={1}>
              {collection.name}
            </Text>
            {/* Under the title, inside the card. It used to hang below the card
                as loose text, which made every row of the grid taller and read
                as a caption floating between two cards rather than a property
                of the one above it. */}
            {showVisibility ? (
              <Text style={[styles.metaVisibility, { color: visibilityColors[collection.visibility] }]}>
                {VISIBILITY_LABELS[collection.visibility]}
              </Text>
            ) : null}
          </View>
          <View style={styles.metaCounts}>
            <Text style={styles.metaLike}>♥ {collection.likeCount.toLocaleString()}</Text>
            <Text style={styles.metaItems}>{collection.itemIds.length} items</Text>
          </View>
        </View>

        {hovered ? (
          <View style={styles.hoverVeil} pointerEvents="none">
            <View style={styles.hoverPill}>
              <Text style={styles.hoverText}>View collection →</Text>
            </View>
          </View>
        ) : null}
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
  const hover = useHoverLift();
  return (
    <Pressable
      onPress={onPress}
      {...hover.hoverProps}
      style={({ pressed }) => [
        styles.collectorCard,
        { width },
        hover.hoverStyle,
        hover.hoverBorder,
        pressed && styles.pressed,
      ]}
    >
      {/* Portrait, name and score centred as one block: this is a card ABOUT a
          person, and a small avatar in the corner made it read as a list row
          that happened to be boxed. The reason stays left-aligned below —
          it is a sentence, and centred prose is harder to scan. */}
      <View style={styles.collectorHead}>
        <Avatar
          name={user.displayName}
          avatarId={user.avatar}
          verified={user.isAccountVerified}
          size={84}
        />
        <Text style={styles.collectorName} numberOfLines={1}>
          {user.displayName}
        </Text>
        {percent !== undefined ? (
          <Text style={styles.matchPercent}>{percent}% match</Text>
        ) : null}
      </View>
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
  const box =
    variant === 'hero'
      ? styles.articleThumbHero
      : variant === 'micro'
        ? styles.articleThumbMicro
        : styles.articleThumb;

  if (art) {
    /* Hero thumbnails can span a phone or a desktop card and therefore use the
       full rendition. The 88px and 56px thumbnails remain sharp at high pixel
       density with the compact rendition, regardless of viewport width. */
    const source = art.displaySource
      ? variant === 'hero'
        ? art.displaySource.wide
        : art.displaySource.squareCompact
      : art.source;
    const fit = art.displaySource ? 'cover' : art.fit;
    return (
      <View style={box}>
        <Image
          source={source}
          /* Generated display art carries crop-safe scenery around the sharp
             collectible. Legacy originals keep their inset, safe-fit rule. */
          style={fit === 'contain' ? styles.articleThumbInset : styles.articleThumbFill}
          resizeMode={fit}
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
/**
 * How an article card carries its picture.
 *
 *   micro   56px square beside the text — dense lists
 *   media   88px square beside the text — the news screen's rows
 *   hero    full-width 16:9 above the text
 *
 * `hero` follows the standard news-card hierarchy: the image earns attention,
 * the title gives the topic, the excerpt earns the click. A 56px square cannot
 * do the first job, which is why a rail of them read as a list of links rather
 * than as content.
 */
export type ThumbVariant = 'media' | 'micro' | 'hero';

export function ArticleCard({
  article,
  reason,
  width,
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
  const hover = useHoverLift();

  /* Resolved before the layout is chosen, because for `micro` it DECIDES the
     layout: no item render means no thumbnail and no row, just the text card.
     `media` always shows a thumbnail, so for it this only picks the picture. */
  const hasItemArt = articleItemArt(article, thumbItemId) !== null;
  // `hero` always shows its image: the layout is built around it, and falling
  // back to a text card mid-rail would break the row's shared height.
  const showThumb = thumb === 'media' || thumb === 'hero' || (thumb === 'micro' && hasItemArt);

  const edgeGame = accentEdge ? article.relatedGames[0] : undefined;
  const edge = edgeGame ? gameAccents[edgeGame] : null;

  /* Only the media variant trades the second summary line for density. Micro
     keeps the full text stack deliberately: the rail's card height is set by
     that stack, and shortening it here would resize every card on Home. */
  const tight = thumb === 'media';

  const body = (
    <>
      <View style={styles.articleTagRow}>
        {/*
          The SAME `GameBadge` the collection covers use.
          These two badges drifted into different treatments — the news tag was
          a soft-tinted fill with `base` text, the cover badge an outlined chip
          on a scrim — and the two sit one section apart on Home, so a reader
          sees both at once and they read as two different systems labelling the
          same three games. One component, one look, everywhere.
        */}
        {article.relatedGames.map((title) => (
          <GameBadge key={title} title={title} />
        ))}
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

  if (showThumb && thumb === 'hero') {
    return (
      <Pressable
        onPress={onPress}
        {...hover.hoverProps}
        style={({ pressed }) => [
          styles.articleCard,
          styles.articleCardHero,
          width ? { width } : null,
          hover.hoverStyle,
          edge ? null : hover.hoverBorder,
          pressed && styles.pressed,
        ]}
      >
        <ArticleThumb article={article} itemId={thumbItemId} variant="hero" />
        {/* Accent as a rule under the image rather than a left border: on a
            stacked card a left border runs the full height and reads as a
            quote block. */}
        {edge ? <View style={[styles.articleHeroRule, { backgroundColor: edge.base }]} /> : null}
        <View style={styles.articleHeroBody}>{body}</View>
      </Pressable>
    );
  }

  if (showThumb && thumb) {
    return (
      <Pressable
        onPress={onPress}
        {...hover.hoverProps}
        style={({ pressed }) => [
          styles.articleCard,
          styles.articleCardMedia,
          width ? { width } : null,
          edge ? { borderLeftColor: edge.base, borderLeftWidth: 3 } : null,
          hover.hoverStyle,
          /* No hoverBorder here: an accent edge is this card's own left border,
             and overriding borderColor would recolour it. */
          edge ? null : hover.hoverBorder,
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
      {...hover.hoverProps}
      style={({ pressed }) => [
        styles.articleCard,
        width ? { width } : null,
        edge ? { borderLeftColor: edge.base, borderLeftWidth: 3 } : null,
        hover.hoverStyle,
        edge ? null : hover.hoverBorder,
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
  itemArt: { width: '100%', aspectRatio: 3 / 2 },
  /* ── Overlay variant ─────────────────────────────────────────────────── */
  /* 52%, not 62%. The band sits on a square tile now rather than a tall one,
     so the same fraction covered noticeably more of the subject. */
  itemScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '52%' },
  itemOverlayBody: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.sm, gap: 2 },
  itemOverlayName: { ...typography.cardTitle, color: colors.textOnAccent },
  /* Tier-coloured, matching every other rarity treatment in the app (§12.2) —
     a legendary should not read the same weight as a common here either. */
  itemOverlayMeta: { ...typography.meta },
  rarityOverlay: { position: 'absolute', top: spacing.xs, right: spacing.xs },

  itemBody: {
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  // Two lines' worth of height whether the name needs one or two, so a row of
  // cards is one height. Without it the grid stair-steps by name length.
  itemName: { ...typography.cardTitle, color: colors.textPrimary, minHeight: 40 },
  itemMeta: { ...typography.meta, color: colors.textSecondary },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  /** Shrinks first, so a long game+rarity pair never pushes the badge out. */
  itemMetaText: { flexShrink: 1, minWidth: 0 },

  trust: {
    alignSelf: 'center',
    flexShrink: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  /* Border matches its text. Verified is green because it unlocks something;
     unverified is grey rather than red because most of a real inventory is
     unverified — red on the majority of cards reads as a wall of errors, and
     the nudge to connect an account belongs where the user is blocked, not on
     every tile they own. */
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
  /* 210, up from 148. The meta band moved on top of the cover, so the card no
     longer spends height on a body panel underneath — the art absorbs it and
     the card is about the same size overall. The band needs roughly 90 of this
     for three lines of type, which is why it is not simply 148 + a little. */
  collectionArt: { height: 210, borderRadius: 0 },
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
  /* `textOnAccent`, not `textPrimary`: the pill sits on artwork, so it needs
     the on-dark colour regardless of which theme the app is in. In light mode
     `textPrimary` is near-black and vanished into the scrim behind it. */
  ownerOverlayName: { ...typography.meta, color: colors.textOnAccent, maxWidth: 96 },
  /** Only the top third — a full-height scrim would grey out the artwork. */
  coverScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: '38%' },

  /* ── The overlaid meta band ────────────────────────────────────────────
     Bottom 62%, fading in rather than starting hard, so the artwork is only
     obscured where text actually sits. Reaching `heavy` at the very bottom is
     what lets a light cover carry white type — the pale mosaics were the ones
     that failed a lighter scrim. */
  metaScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  metaOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
    padding: spacing.md,
  },
  // Bigger and heavier than cardTitle: on a browse grid the collection name is
  // the thing being chosen between, so it should win the card outright.
  metaLeft: { flex: 1, gap: 2 },
  /* The shared overlay treatment — bigger, tighter, and shadowed so it lifts
     off the artwork instead of sinking into it. See `typography.overlayTitle`. */
  metaName: { ...typography.overlayTitle, color: colors.textOnAccent },
  metaVisibility: { ...typography.meta, color: colors.textOnAccent, opacity: 0.75 },
  /** Counts stack right-aligned, clear of a long collection name. */
  metaCounts: { alignItems: 'flex-end', gap: 2 },
  /* Red, on the scrim rather than on raw artwork — the gradient reaches `heavy`
     at the bottom edge, which is what makes `danger` legible here where it was
     not before. */
  metaLike: { ...typography.meta, color: colors.danger },
  metaItems: { ...typography.meta, color: colors.textOnAccent, opacity: 0.75 },

  /* Still used by CommunityCard, which keeps a body panel: it carries a reason
     line that would not survive being overlaid on artwork. Named for the
     collection card only because that is where they started. */
  collectionBody: { padding: spacing.md, gap: spacing.sm },
  collectionName: {
    ...typography.sectionHeader,
    fontSize: 21,
    lineHeight: 27,
    fontFamily: fonts.display,
    color: colors.textPrimary,
  },

  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ownerName: { ...typography.meta, color: colors.textSecondary, flexShrink: 1 },

  collectorCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  collectorHead: { alignSelf: 'stretch', alignItems: 'center', gap: spacing.xs },
  collectorName: { ...typography.cardTitle, color: colors.textPrimary },
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
    gap: spacing.sm,
  },
  /* Row instead of column, and a wider gap — `articleCard`'s `xs` is the gap
     between stacked text lines, which would be far too tight beside an 88px
     thumbnail. */
  articleCardHero: { flexDirection: 'column', gap: 0, padding: 0, overflow: 'hidden' },
  articleHeroRule: { height: 3, width: '100%' },
  articleHeroBody: { gap: spacing.xs, padding: spacing.md },

  articleCardMedia: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  /* minWidth 0 lets the text truncate rather than stretch the card. A flex
     child defaults to min-content width, which ignores numberOfLines. */
  articleBody: { flex: 1, minWidth: 0, gap: spacing.xs },
  /** 16:9 above the text. Fixed ratio so a rail of cards is one height. */
  articleThumbHero: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
  },

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
  articleTitle: { ...typography.cardTitle, color: colors.textPrimary },
  articleBlurb: { ...typography.meta, color: colors.textSecondary },
  articleReason: { ...typography.meta, color: colors.accent },
  articleSource: { ...typography.meta, color: colors.textTertiary },
});
