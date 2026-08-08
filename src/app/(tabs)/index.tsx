/**
 * Home — PRD §13.4, built top to bottom from the spec:
 *
 *   1. Header — greeting + display name, bell with unread dot, avatar
 *   2. Filter chips — All / Collections / Collectors / Rooms
 *   3. Hero banner — artwork, sparkle eyebrow, headline, Explore button
 *   4. Gaming updates rail          (behind FEATURES.news — §14 rung 1)
 *   5. Explore collectibles — 2×2 grid
 *   6. Collectors you may like — match cards
 *   7. Tab bar (lives in the layout)
 *
 * Inventory is NOT here. It lives on Profile, which is the surface about the
 * viewer — Home is about what is happening, and a rail of your own items said
 * nothing new every time you opened it.
 *
 * Canonical variant is the one WITH the gaming updates rail. If J5 is cut, flip
 * `FEATURES.news` and the rail disappears cleanly rather than leaving a hole.
 *
 * Every read goes through `@/services`. Nothing here imports a fixture.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import {
  ASSISTANT_CLEARANCE,
  ArticleCard,
  Avatar,
  CollectionCard,
  CollectorCard,
  EmptyState,
  FadeInView,
  FilterChips,
  ItemArt,
  ItemCard,
  LoadingState,
  PrimaryButton,
  SectionHeader,
  useHoverLift,
  PinnedHeader,
} from '@/components';
import { useScrolledPast } from '@/components/PinnedHeader';
import { ART_PLACEMENTS, backdropFor, hasArt } from '@/config/artRegistry';
import { FEATURES } from '@/config/features';
import { headlineItem } from '@/domain/collections';
import { pickThumbnailIds } from '@/domain/news';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useDragScroll } from '@/hooks/useDragScroll';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import {
  catalogueService,
  collectionService,
  matchService,
  newsService,
  roomService,
  socialService,
} from '@/services';
import type { CollectorRecommendation } from '@/services';
import { useApp } from '@/state/AppContext';
import { useAssistantDock } from '@/state/AssistantDock';
import { colors, fonts, gameAccents, interaction, radius, rarityColors, scrim, spacing, typography } from '@/theme/theme';
import { GAME_LABELS, GAME_TITLES } from '@/types';
import type { Article, Collection, Item, Room, User } from '@/types';

const FILTERS = ['All', 'Collections', 'Collectors', 'Rooms'] as const;
type Filter = (typeof FILTERS)[number];

interface ExploreEntry {
  collection: Collection;
  owner: User | null;
  headline: Item | null;
}

interface RoomEntry {
  room: Room;
  themeName: string;
  collectionName: string;
  /** Whose room it is. A showroom is a person's, and the rail says so. */
  owner: User | null;
}

/**
 * Wraps a control in the shared hover lift. Home has several one-off
 * pressables — header icons, room rows — that are not shared components, and
 * this keeps them consistent with the cards rather than each rolling its own.
 */
function Hoverable({
  children,
  style,
  onPress,
  accessibilityLabel,
  hitSlop,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
  accessibilityLabel?: string;
  hitSlop?: number;
}) {
  const hover = useHoverLift();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      {...hover.hoverProps}
      style={({ pressed }) => [style, hover.hoverStyle, pressed && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  );
}

/**
 * Horizontal crop offset per hero panel, as a fraction of the panel width.
 *
 * The art is drawn at 128% width inside a narrower window, so the margin
 * chooses WHICH 78% of each piece you see. One shared value centred every crop,
 * which is only right when every subject is centred in its own art — and these
 * four are not: two are framed left of centre and two right, so a single offset
 * pushed half of them off their own faces.
 *
 * More negative moves the art LEFT in its window (revealing more of the right
 * side of the picture); less negative moves it right.
 *
 * Keyed by item id, not index, so reordering `home.heroMosaic` moves each
 * crop with its artwork instead of silently reassigning them.
 */
const HERO_PANEL_OFFSETS: Record<string, `${number}%`> = {
  /* Centred already — the whole subject is in frame. */
  'mlbb-zodiac-aquarius': '-14%',
  /* Subject sits left in its art; nudged right so she is not cropped at the
     shoulder, then eased back a little once the crop had the whole picture. */
  'mlbb-slipstream-pilot': '-8%',
  /* Both are framed right of centre and were running off the panel. -24% went
     a touch too far the other way once the blurred bars came off the source
     and the crop started using the whole picture. */
  'mlbb-emberfall-warlord': '-12%',
  'mlbb-shadow-protocol': '-12%',
};

/**
 * Reorder a ranked list so its LEADING entries repeat each other as little as
 * possible, without dropping anything.
 *
 * Both Home grids show four cards, and four cards sharing an owner, a game or a
 * piece of cover art waste most of their space saying one thing. The underlying
 * rankings are sound — likes for showrooms, verification share for collectibles
 * — they simply have no notion of variety.
 *
 * ── "As much as possible", literally ──────────────────────────────────────
 * A hard filter is the obvious approach and it is wrong here: there are only
 * three games, so a fourth card CANNOT introduce a fourth game, and a rule
 * demanding one would either drop a card or never terminate.
 *
 * So each candidate is scored by how many of its keys are already used, and the
 * best-scoring one wins, earliest in rank order breaking ties. A clean
 * candidate always wins; when none exists the list degrades to one repeat, then
 * two, rather than failing. That is what makes "different where it can be" a
 * rule rather than a wish.
 *
 * Nothing is discarded — "See all" still reveals everything, in this order.
 */
function diversify<T>(items: readonly T[], keys: readonly ((item: T) => string | null)[]): T[] {
  const remaining = [...items];
  const ordered: T[] = [];
  const used = keys.map(() => new Set<string>());

  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let i = 0; i < remaining.length; i++) {
      let score = 0;
      for (let k = 0; k < keys.length; k++) {
        const value = keys[k]!(remaining[i]!);
        /* A null key is "no opinion": it cannot clash, so it never penalises a
           candidate that is otherwise a clean pick. */
        if (value !== null && used[k]!.has(value)) score++;
      }
      if (score < bestScore) {
        bestScore = score;
        bestIndex = i;
        if (score === 0) break; // Cannot do better; keep the earliest.
      }
    }

    const [chosen] = remaining.splice(bestIndex, 1);
    for (let k = 0; k < keys.length; k++) {
      const value = keys[k]!(chosen!);
      if (value !== null) used[k]!.add(value);
    }
    ordered.push(chosen!);
  }

  return ordered;
}

/**
 * Trending Showrooms: rank by likes — the section is called "Trending" and was
 * rendering the fixture array in file order — then spread owners and backdrops.
 */
function rankTrendingRooms(entries: readonly RoomEntry[]): RoomEntry[] {
  const byPopularity = [...entries].sort((a, b) => b.room.likeCount - a.room.likeCount);
  return diversify(byPopularity, [
    /* Falling back to the room id stops two ownerless rooms colliding. */
    (entry) => entry.owner?.id ?? entry.room.id,
    (entry) => entry.room.themeId,
  ]);
}

/**
 * Explore Collectibles: keep the service's verification-share ranking, then
 * spread owner, game and cover art.
 *
 * The game key is the headline item's title because that is precisely what the
 * card prints in its corner badge — keying on anything else would let two cards
 * show the same badge while the code believed they differed.
 *
 * The cover key is the first item WITH ART, which is the panel
 * `CollectionCoverMosaic` draws leftmost. Several seeded collections share a
 * popular skin, and when it leads two mosaics the covers read as the same
 * picture even though the collections are unrelated.
 */
function rankExploreCollections(entries: readonly ExploreEntry[]): ExploreEntry[] {
  return diversify(entries, [
    (entry) => entry.owner?.id ?? entry.collection.id,
    (entry) => entry.headline?.title ?? null,
    (entry) => entry.collection.itemIds.find(hasArt) ?? null,
  ]);
}

/** Showrooms on the Home grid before "See all" — matches the collectibles grid. */
const HOME_ROOM_PREVIEW = 4;

/** For any panel not listed above — the old shared value, i.e. centred. */
const HERO_PANEL_OFFSET_DEFAULT: `${number}%` = '-14%';

export default function HomeScreen() {
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();
  const isPhone = viewportWidth < 600;
  const { viewer, viewerId, inventory, unreadNotifications, loading } = useApp();
  const { openPanel } = useAssistantDock();

  /** Tab screens stay mounted, so returning here has to be sent back to the top. */
  const scrollRef = useTopOnFocus();
  /* Click-and-drag panning for the two horizontal rails. Web-only; a browser
     gives an overflow container wheel scrolling and no mouse drag. */
  const newsRail = useDragScroll<FlatList>();
  const collectorsRail = useDragScroll<FlatList>();
  /* Drives the header's frosted backdrop, which is transparent at the top
     of the page and fades in once it starts doing a job. */
  const { scrolled, scrollProps } = useScrolledPast();

  const [filter, setFilter] = useState<Filter>('All');
  const [articles, setArticles] = useState<Article[]>([]);
  /* Same list-wide assignment News uses, so the rail cannot show one item's
     render on two cards either. Cheap, and it keeps one rule for thumbnails
     across both surfaces. */
  const railThumbs = useMemo(() => pickThumbnailIds(articles), [articles]);
  const [explore, setExplore] = useState<ExploreEntry[]>([]);
  const [collectors, setCollectors] = useState<CollectorRecommendation[]>([]);
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [showAllRooms, setShowAllRooms] = useState(false);
  const [busy, setBusy] = useState(true);
  const visibleRooms = showAllRooms ? rooms : rooms.slice(0, HOME_ROOM_PREVIEW);

  const load = useCallback(async () => {
    const [news, collections, users, recommended, publishedRooms] = await Promise.all([
      FEATURES.news ? newsService.getDiscover(6) : Promise.resolve([]),
      collectionService.getPublicCollections(),
      socialService.getUsers(),
      /* 12, matching Explore. Six filled about half a desktop rail and then
         stopped dead, so a wide window showed a short row with empty track
         beside it — the list looked truncated rather than scrollable. There are
         13 other collectors seeded, so 12 fills the rail at any width and still
         leaves the scroll doing something. */
      matchService.getRecommendedCollectors(viewerId, 12),
      roomService.getPublishedRooms(),
    ]);

    const usersById = new Map(users.map((user) => [user.id, user]));

    /**
     * Home shows OTHER people's work.
     *
     * The viewer's own collections and rooms are already the whole of the
     * Collections tab and the Profile page. Repeating them here spent the two
     * biggest sections on Home telling someone what they already own, and
     * "Explore collectibles" listing your own collection is a contradiction in
     * the section's own name.
     *
     * Filtered here rather than in the service: `getPublicCollections` is a
     * public feed and is right to include everyone — Collections and Profile
     * both need the viewer's own entries from it.
     */
    const entries = await Promise.all(
      collections
        .filter((collection) => collection.userId !== viewerId)
        .map(async (collection) => ({
          collection,
          owner: usersById.get(collection.userId) ?? null,
          headline: headlineItem(await catalogueService.getItems(collection.itemIds)),
        })),
    );

    const roomEntries = (
      await Promise.all(
        publishedRooms.map(async (room) => {
          const [theme, collection] = await Promise.all([
            roomService.getTheme(room.themeId),
            collectionService.getCollection(room.collectionId),
          ]);
          return {
            room,
            themeName: theme?.name ?? 'Room',
            collectionName: collection?.name ?? 'Collection',
            owner: collection ? (usersById.get(collection.userId) ?? null) : null,
          };
        }),
      )
      /* A room's owner is its COLLECTION's owner, which is only known after the
         lookup above — so this filter cannot move up beside the collections
         one. */
    ).filter((entry) => entry.owner?.id !== viewerId);

    setArticles(news);
    setExplore(rankExploreCollections(entries));
    setCollectors(recommended);
    setRooms(rankTrendingRooms(roomEntries));
    setBusy(false);
  }, [viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Home is the screen every flow returns to, so it has to reflect what just
   * happened: a collection published in J2 and the collector matches that shift
   * after an import both land here. Mount-only loading left it stale until the
   * app was restarted. Same pattern as `(tabs)/collections.tsx`.
   */
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const openCollection = useCallback(
    (id: string) => router.push({ pathname: '/collection/[id]', params: { id } }),
    [router],
  );

  const { refreshing, onRefresh } = usePullToRefresh(load);

  const show = (section: Filter) => filter === 'All' || filter === section;

  return (
    <View style={styles.screen}>
      {/* Pinned. The greeting, the assistant, notifications and the avatar are
          the app's account controls — reaching them should not require
          scrolling back to the top of a long feed. A bottom rule demarcates it
          from the content moving underneath. */}
      <PinnedHeader scrolled={scrolled}>
      <View style={styles.header}>
          <View style={styles.headerText}>
            {/* One line, one size. Two stacked lines at different sizes made the
                greeting look like a label above a title; it is one sentence and
                reads as one. The name carries the weight so the eye lands on who
                this is, not on the time of day. */}
            <Text style={styles.greetingLine} numberOfLines={1}>
              <Text style={styles.greetingWord}>{greeting()}, </Text>
              <Text style={styles.greetingName}>{viewer?.displayName ?? '—'}</Text>
            </Text>
          </View>

          <View style={styles.headerActions}>
            {/* The assistant sits in the header rather than a tab: it answers
                questions ABOUT the app, so it belongs beside the account controls
                rather than competing with the five destinations. It opens the
                same panel the floating launcher does — one assistant, two ways
                in, and neither navigates away from what is being asked about. */}
            <Hoverable
              accessibilityLabel="Ask the assistant"
              onPress={openPanel}
              hitSlop={8}
              style={styles.bell}
            >
              <Text style={styles.bellGlyph}>✦</Text>
            </Hoverable>
            <Hoverable
              accessibilityLabel="Gaming updates"
              onPress={() => router.push('/news')}
              hitSlop={8}
              style={styles.bell}
            >
              <Text style={styles.bellGlyph}>◔</Text>
              {unreadNotifications > 0 ? <View style={styles.unreadDot} /> : null}
            </Hoverable>
            <Hoverable accessibilityLabel="Your profile" onPress={() => router.navigate('/profile')} hitSlop={8}>
              <Avatar
                name={viewer?.displayName ?? '?'}
                avatarId={viewer?.avatar}
                verified={viewer?.isAccountVerified}
                size={46}
              />
            </Hoverable>
          </View>
        </View>
      </PinnedHeader>

    <ScrollView
      ref={scrollRef}
      {...scrollProps}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.textSecondary}
          colors={[colors.accent]}
          progressBackgroundColor={colors.surface}
        />
      }
    >

      {/* 2 — Filter chips */}
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      {/*
        3 — Hero banner

        Copy left, artwork filling the right and running under it. The art stays
        as separate sheared panels so the banner reads like the reference while
        each crop still has enough bleed to reach its clipped boundary.

        ⚠️ No publisher logos. The reference for this layout carries a row of
        real game marks, and those are exactly the third-party assets §11 F4 and
        the art rules forbid — everything rendered here is our own baked art.
      */}
      <View style={[styles.hero, isPhone && styles.heroPhone]}>
        <View style={styles.heroArtLayer} pointerEvents="none">
          {ART_PLACEMENTS['home.heroMosaic'].map((itemId, index) => (
            <View
              key={itemId}
              style={[
                styles.heroPanel,
                {
                  marginLeft: index === 0 ? 0 : -12,
                  transform: [{ skewX: '-9deg' }],
                },
              ]}
            >
              <ItemArt
                seed={itemId}
                tier={
                  inventory.find((entry) => entry.item.id === itemId)?.item.rarityTier ?? 'mythic'
                }
                /* The raw artwork, cropped to fill. The baked display rendition
                   letterboxes onto a blurred copy of itself, which is right on
                   a card and wrong here — the hero is meant to be full-bleed
                   art, and the bars showed up as visible blur down each panel.
                   The per-panel offsets below choose which part survives. */
                useOriginalArt
                fit="cover"
                style={[
                  styles.heroPanelArt,
                  { marginLeft: HERO_PANEL_OFFSETS[itemId] ?? HERO_PANEL_OFFSET_DEFAULT },
                  { transform: [{ skewX: '9deg' }] },
                ]}
              />
            </View>
          ))}
        </View>

        {/*
          A real left-to-right fade, not a panel. The art runs edge to edge
          underneath and this dissolves it where the words are, so the left side
          reads as darkened artwork rather than a black box with pictures glued
          beside it. `expo-linear-gradient` is already a dependency (sign-in and
          the tour overlay both use it), so this costs nothing.

          Ends at `scrim.clear` — transparent BLACK, not 'transparent'. On
          Android a fade to `transparent` passes through grey and shows as a
          dirty band; theme.ts documents that trap and this is exactly it.
        */}
        <LinearGradient
          colors={[scrim.heavy, scrim.medium, scrim.clear]}
          locations={[0, 0.45, 0.85]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.heroFade}
          pointerEvents="none"
        />
        {/* A second, vertical pass along the bottom. The games row sits on the
            art's lower edge where the fade above has already run out. */}
        <LinearGradient
          colors={[scrim.clear, scrim.medium]}
          style={styles.heroFadeFoot}
          pointerEvents="none"
        />

        <View style={[styles.heroCopy, isPhone && styles.heroCopyPhone]}>
          <Text style={styles.eyebrow}>✦ Collections made for you</Text>
          <Text style={styles.heroHeadline}>Epic skins.{'\n'}Endless legends.</Text>
          <View style={[styles.heroRow, isPhone && styles.heroRowPhone]}>
            <PrimaryButton label="Explore" onPress={() => router.navigate('/explore')} />
            {/*
              The titles Collectee actually supports, as our own wordmarks.

              ⚠️ NOT publisher logos. The reference for this banner carries the
              real Mobile Legends, Overwatch, Dota and League marks; those are
              third-party trademarks and the same rule that keeps franchise
              names out of room themes (§11 F4) and publisher art out of the
              meshes applies here. Set in our type, they say which games are
              supported without borrowing anyone's brand — and they stay honest,
              because these three are the games the catalogue actually has.
            */}
            <View style={[styles.heroGames, isPhone && styles.heroGamesPhone]}>
              {GAME_TITLES.map((title, index) => (
                <View key={title} style={[styles.heroGameItem, isPhone && styles.heroGameItemPhone]}>
                  {/* A rule between titles, not just a gap. Three long game
                      names set in the same weight ran together as one string —
                      "MOBILE" reads as the end of VALORANT's name before the
                      eye finds the break. */}
                  {index > 0 ? <Text style={styles.heroGameRule}>|</Text> : null}
                  {/*
                    Each title in its OWN game's accent, so the row runs amber →
                    teal → violet and reads as a colour ramp across three words.

                    Not a literal gradient: React Native cannot fill text with
                    one, and the masking library that would is a dependency §13.1
                    sends through chat. This is better than a fake anyway — the
                    colours mean something. They are the same `gameAccents` the
                    news cards and the game badges use, so a reader who has
                    learned "amber = CODM" anywhere else in the app reads this
                    row without being told.

                    No per-game special case here: `mlbb.secondary` was gold and
                    collided with CODM's amber, and that was fixed in the token
                    rather than worked around at this one call site — the same
                    collision was showing on every game badge in the app.
                  */}
                  <Text
                    style={[
                      styles.heroGame,
                      isPhone && styles.heroGamePhone,
                      { color: gameAccents[title].secondary },
                    ]}
                  >
                    {GAME_LABELS[title]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* 4 — Gaming updates (§14 rung 1: flip FEATURES.news and this disappears) */}
      {FEATURES.news && filter === 'All' ? (
        <View>
          <SectionHeader
            title="Gaming Updates"
            prominent
            onSeeAll={() => router.push('/news')}
          />
          {busy ? (
            <LoadingState height={132} />
          ) : (
            /* Accents only — the rail's structure, width and card height are
               unchanged. `micro` draws a 56px item render when one exists and
               nothing at all when it does not, so a card without art keeps
               exactly the layout it had. The text stack sets the height in both
               cases, which is what stops section 5 below from moving. */
            <FlatList
              ref={newsRail}
              horizontal
              showsHorizontalScrollIndicator={false}
              data={articles}
              keyExtractor={(article) => article.id}
              contentContainerStyle={styles.rail}
              renderItem={({ item, index }) => (
                <ArticleCard
                  article={item}
                  width={280}
                  accentEdge
                  thumb="hero"
                  thumbItemId={railThumbs[index]}
                  onPress={() =>
                    router.push({ pathname: '/article/[id]', params: { id: item.id } })
                  }
                />
              )}
            />
          )}
        </View>
      ) : null}

      {/* 5 — Explore collectibles */}
      {show('Collections') ? (
        <View>
          <SectionHeader
            title="Explore Collectibles"
            prominent
            onSeeAll={() => router.navigate('/explore')}
          />
          {busy ? (
            <LoadingState height={220} />
          ) : (
            <View style={styles.grid}>
              {explore.slice(0, filter === 'All' ? 4 : explore.length).map((entry, index) => (
                /* The stagger is what turns "the data arrived" into "the grid
                   dealt itself". Width lives on the wrapper, not the card,
                   because the wrapper is what the flex row now measures. */
                <FadeInView
                  key={entry.collection.id}
                  index={index}
                  style={[styles.gridCell, viewportWidth < 600 && styles.gridCellPhone]}
                >
                  <CollectionCard
                    collection={entry.collection}
                    owner={entry.owner}
                    headline={entry.headline}
                    onPress={() => openCollection(entry.collection.id)}
                  />
                </FadeInView>
              ))}
              {/* Invisible second column on an odd count — see the same spacer
                  on the Collections tab. Keeps a lone final card the width of
                  the ones above rather than letting flexGrow stretch it. */}
              {viewportWidth >= 600 &&
              explore.slice(0, filter === 'All' ? 4 : explore.length).length % 2 === 1 ? (
                <View style={styles.gridCell} pointerEvents="none" />
              ) : null}
            </View>
          )}
        </View>
      ) : null}


      {/* 7 — Collectors you may like */}
      {show('Collectors') ? (
        <View>
          <SectionHeader
            title="Collectors You May Like"
            prominent
            onSeeAll={() => router.navigate('/explore')}
          />
          {busy ? (
            <LoadingState height={150} />
          ) : (
            <FlatList
              ref={collectorsRail}
              horizontal
              showsHorizontalScrollIndicator={false}
              data={collectors}
              keyExtractor={(entry) => entry.user.id}
              contentContainerStyle={styles.rail}
              renderItem={({ item }) => (
                <CollectorCard
                  user={item.user}
                  percent={item.percent}
                  reason={item.reason}
                  onPress={() =>
                    router.push({ pathname: '/collector/[id]', params: { id: item.user.id } })
                  }
                />
              )}
            />
          )}
        </View>
      ) : null}

      {/* Rooms — the chip the Figma implies but never fills */}
      {show('Rooms') ? (
        <View>
          {/*
            Capped at four, like the collectibles grid above it. The seeded
            roster went from three public rooms to ten, and an uncapped grid
            pushed everything below this section a screen and a half down.

            The action expands in place rather than navigating: there is no
            "all showrooms" screen to send anyone to, and a "See all" that
            routes somewhere without them would be worse than one that opens
            the rest here. It says "Show less" once expanded, so the control
            never claims to do something it has already done.
          */}
          <SectionHeader
            title="Trending Showrooms"
            prominent
            actionLabel={showAllRooms ? 'Show less' : 'See all'}
            onSeeAll={rooms.length > HOME_ROOM_PREVIEW ? () => setShowAllRooms((on) => !on) : undefined}
          />
          {busy ? (
            <LoadingState height={150} />
          ) : (
            /* Cards, not rows. These sit directly under "Explore collectibles",
               which is a grid of large covers, and a stack of thin rows beneath
               it read as a settings list rather than as more of the same thing.
               A showroom is something you look at, so the backdrop leads and the
               title sits under it — the same shape as a collection card. */
            <View style={styles.grid}>
              {visibleRooms.map((entry, index) => (
                <FadeInView
                  key={entry.room.id}
                  index={index}
                  style={[styles.gridCell, viewportWidth < 600 && styles.gridCellPhone]}
                >
                  {/* Same construction as CollectionCard: backdrop fills the
                      tile, meta overlaid on a gradient, owner pill top-right.
                      These two card types sit in adjacent sections and should
                      not be two different ideas of what a card is. */}
                  <Hoverable
                    onPress={() =>
                      router.push({ pathname: '/room/[id]', params: { id: entry.room.id } })
                    }
                    style={styles.roomCard}
                  >
                    {/* A theme id is not an item id, so `ItemArt` only ever gave
                        these a colour block. Rooms have their own backdrop. */}
                    <RoomThumb themeId={entry.room.themeId} style={styles.roomCardArt} />

                    <LinearGradient
                      colors={[scrim.clear, scrim.medium, scrim.heavy]}
                      locations={[0, 0.45, 1]}
                      style={styles.roomCardScrim}
                      pointerEvents="none"
                    />

                    {entry.owner ? (
                      <View style={styles.roomOwnerPill}>
                        <Avatar
                          name={entry.owner.displayName}
                          avatarId={entry.owner.avatar}
                          verified={entry.owner.isAccountVerified}
                          size={18}
                        />
                        <Text style={styles.roomOwnerName} numberOfLines={1}>
                          {entry.owner.displayName}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.roomCardMeta} pointerEvents="none">
                      {/* Title with the theme under it, exactly where the
                          collection card puts its visibility line — the theme
                          is a property of this room, so it belongs beneath the
                          name rather than in the numbers column opposite. */}
                      <View style={styles.roomCardLeft}>
                        <Text style={styles.roomCardName} numberOfLines={1}>
                          {entry.room.title}
                        </Text>
                        <Text style={styles.roomCardTheme} numberOfLines={1}>
                          {entry.themeName}
                        </Text>
                      </View>
                      {/* Likes and item count, mirroring the collection card so
                          the two read as the same object at a glance. */}
                      <View style={styles.roomCardCounts}>
                        <Text style={styles.roomCardLike}>
                          ♥ {entry.room.likeCount.toLocaleString()}
                        </Text>
                        <Text style={styles.roomCardItems}>
                          {entry.room.placements.length} items
                        </Text>
                      </View>
                    </View>
                  </Hoverable>
                </FadeInView>
              ))}
              {/* Counts the rooms actually rendered, not the whole list — a
                  spacer decided by the unsliced length is right only by luck. */}
              {viewportWidth >= 600 && visibleRooms.length % 2 === 1 ? (
                <View style={styles.gridCell} pointerEvents="none" />
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      {loading ? <LoadingState height={40} /> : null}
      {/* The floating assistant sits over this corner. Pad by the real
          number so the last row is never resting underneath it. */}
      <View style={{ height: ASSISTANT_CLEARANCE }} />
    </ScrollView>
    </View>
  );
}

/** §13.4 shows "Good evening" in the Figma; the greeting follows the clock. */
/**
 * A published room's thumbnail: its theme backdrop, cropped.
 *
 * `ItemArt` resolves by catalogue item id and a room has no item, so these rows
 * fell through to the colour block. Backdrops live in the same registry keyed by
 * theme id, and the palette wash stays as the fallback for a theme without art.
 */
function RoomThumb({ themeId, style }: { themeId: string; style?: StyleProp<ViewStyle> }) {
  const backdrop = backdropFor(themeId);
  /* `style` overrides the default square thumb so the same component can be a
     row avatar or a card-width cover. */
  if (!backdrop) return <ItemArt seed={themeId} tier="mythic" style={[styles.roomThumb, style]} />;
  return (
    <View style={[styles.roomThumb, styles.roomThumbClip, style]}>
      <Image
        source={backdrop}
        style={styles.roomThumbImage}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/**
 * Singapore time, not the device's.
 *
 * `new Date().getHours()` reads whatever timezone the machine is set to, which
 * is right only by luck. This is judged in Singapore, may well be demoed from a
 * laptop that never left another timezone, and is hosted on Vercel — so the
 * greeting could have said "Good evening" over morning coffee. Pinning it to
 * `Asia/Singapore` makes it correct wherever it runs.
 *
 * `hourCycle: 'h23'` rather than `hour12: false`: the latter renders midnight
 * as "24" in several locales, and 24 is not less than 12, so the small hours
 * would have greeted you with "Good evening".
 */
const SG_HOUR = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Singapore',
  hour: 'numeric',
  hourCycle: 'h23',
});

function greeting(): string {
  const hour = Number(SG_HOUR.format(new Date()));
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, gap: spacing.xl },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { gap: 2 },
  /**
   * One row, one type size — the split only ever came from the Figma stacking
   * them. Display face and a tight tracking, because this is the first thing
   * on a gaming social app and a plain body face reads like a settings screen.
   */
  /* Matches `screenTitle`, so Home's greeting is the same size as Explore's
     "Discover" and Collections' title rather than a smaller cousin. */
  greetingLine: { ...typography.screenTitle, color: colors.textPrimary },
  /** Muted so the name wins without needing a second, larger size. */
  greetingWord: { color: colors.textSecondary },
  greetingName: { color: colors.textPrimary },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  bell: { padding: spacing.xs },
  bellGlyph: { fontSize: 22, color: colors.textSecondary },
  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
  },

  hero: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    /* No padding: the art runs to the banner's edges and the copy is inset by
       `heroCopy` instead. `overflow: hidden` is load-bearing — it clips the
       sheared panels to the rounded corners. */
    overflow: 'hidden',
    height: 340,
  },
  /* A fixed height, because the art is absolutely positioned behind the copy
     and can no longer size the banner itself. Tall enough for a portrait crop
     to read as a portrait. */
  heroPhone: { height: 320 },

  /* Overscanned in every direction so the angled panels still fill the rounded
     banner after clipping, including wide monitors and narrow phone widths. */
  heroArtLayer: {
    position: 'absolute',
    top: -14,
    bottom: -14,
    left: -34,
    right: -34,
    flexDirection: 'row',
  },
  heroPanel: { flex: 1, overflow: 'hidden' },
  /* `marginLeft` is set per panel — see `HERO_PANEL_OFFSETS`. */
  heroPanelArt: { width: '128%', height: '100%', borderRadius: 0 },

  heroFade: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
  heroFadeFoot: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '42%' },

  /* Not inset from the right any more: the copy is left-aligned and short, and
     reserving 38% of the width for art the gradient now handles was pushing the
     headline into an unnecessarily narrow column. */
  heroCopy: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    /* Bottom-anchored, not centred.
       Centred, the block floated in the middle of the art with roughly equal
       air above and below, which read as unplaced — nothing tied it to the
       banner. Sitting on the lower edge gives it a baseline to stand on, and it
       is also where the fade is heaviest, so the type has its darkest ground. */
    justifyContent: 'flex-end',
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.xs,
  },
  heroCopyPhone: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    gap: 2,
  },
  /* Explore and the supported titles share the bottom line, the way the
     reference puts its logo row level with the button. */
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  heroRowPhone: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  heroGames: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  heroGamesPhone: { alignSelf: 'stretch', gap: spacing.sm },
  heroGameItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroGameItemPhone: { gap: spacing.xs },
  heroGameRule: { ...typography.meta, color: colors.textOnAccent, opacity: 0.4 },
  heroGame: {
    ...typography.meta,
    color: colors.textOnAccent,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  heroGamePhone: { fontSize: 11, lineHeight: 15, letterSpacing: 0.8 },
  /* Not `accent`. The accent blue is tuned to sit on `background`, and on this
     banner it lands over dark navy and violet artwork where it has almost no
     separation from what is behind it — the one line on the hero that was hard
     to read. `legendary` gold is the furthest token from every colour in these
     crops, and it reads as a flourish above the headline rather than as a
     second button. */
  eyebrow: { ...typography.meta, color: rarityColors.legendary, letterSpacing: 0.5 },
  /* Bigger than the old 20, and sitting on artwork now, so it has to hold its
     own against it. The line break is authored rather than left to wrapping —
     the two halves are a pair and should break in the same place at any width. */
  heroHeadline: {
    ...typography.sectionHeader,
    color: colors.textOnAccent,
    fontSize: 30,
    lineHeight: 36,
  },
  heroCta: { alignSelf: 'flex-start', marginTop: spacing.md },

  /* Horizontal FlatLists clip on their cross-axis. The shared hover rises 3px,
     so this inset keeps the highlighted top border inside the list viewport. */
  rail: {
    gap: spacing.md,
    paddingRight: spacing.lg,
    paddingVertical: Math.abs(interaction.hoverLift) + 1,
  },
  /**
   * One gap mechanism, not three — the same fix the Collections tab and Profile
   * needed. `gap: 12`, `width: 48%` (4% of slack) and
   * `justifyContent: 'space-between'` were all pushing the two columns apart at
   * once, which is what made the channel down the middle so wide.
   *
   * Used by BOTH "Explore Collectibles" and "Trending Showrooms", so this
   * closes both.
   */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    /* Centred, so the leftover after two fixed-width cards splits evenly
       instead of piling up as one wide margin on the right. */
  },
  /**
   * `flexGrow: 0` is load-bearing.
   *
   * With `flexGrow: 1` the cards absorbed the leftover space, which fills a
   * full row nicely and then stretches a LONE card in the final row to the full
   * width — five collections meant the fifth was twice the width of the four
   * above it. A fixed basis keeps every card the same size and leaves a little
   * slack at the right edge instead, which is the correct trade: an aligned
   * grid with a small margin beats a ragged one without.
   */
  gridCell: { flexGrow: 1, flexBasis: '46%', minWidth: 260 },
  gridCellPhone: { flexBasis: '100%', minWidth: 0 },


  /* The card form, matching CollectionCard: cover on top, meta beneath. */
  roomCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  /**
   * 210 to the pixel, matching `collectionArt` in components/cards.tsx — the
   * meta is overlaid on both now, so both spend their whole height on art.
   *
   * An explicit height rather than an aspect ratio: `roomThumb` hard-codes
   * `height: 46` for its row-avatar use, and overriding that with
   * `height: undefined` + `aspectRatio` does not reliably reset it in React
   * Native — the 46 survived and the covers came out as letterbox strips.
   */
  roomCardArt: { width: '100%', height: 210, borderRadius: 0 },
  roomCardScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
  roomCardMeta: {
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
  roomCardLeft: { flex: 1, gap: 2 },
  /* Same treatment as CollectionCard's title — these sit in adjacent sections
     and a showroom name should not be set differently from a collection name. */
  roomCardName: { ...typography.overlayTitle, color: colors.textOnAccent },
  roomCardCounts: { alignItems: 'flex-end', gap: 2 },
  /* Under the title, in the slot the collection card gives its visibility line.
     The theme is what you are walking into — "Fantasy Armoury" is a property of
     the room, not a number, so it does not belong in the counts column. */
  roomCardTheme: { ...typography.meta, color: colors.accent },
  roomCardLike: { ...typography.meta, color: colors.danger },
  roomCardItems: { ...typography.meta, color: colors.textOnAccent, opacity: 0.75 },
  /* Owner top-right, same pill as the collection card's. */
  roomOwnerPill: {
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
  roomOwnerName: { ...typography.meta, color: colors.textOnAccent, maxWidth: 96 },

  roomThumb: { width: 64, height: 46 },
  roomThumbClip: { overflow: 'hidden', borderRadius: radius.sm, backgroundColor: colors.surfaceSunken },
  roomThumbImage: { width: '100%', height: '100%' },
  muted: { ...typography.meta, color: colors.textSecondary },
});
