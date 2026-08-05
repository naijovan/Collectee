/**
 * Home — PRD §13.4, built top to bottom from the spec:
 *
 *   1. Header — greeting + display name, bell with unread dot, avatar
 *   2. Filter chips — All / Collections / Collectors / Rooms
 *   3. Hero banner — sparkle eyebrow, headline, Explore button, game logos
 *   4. Gaming updates rail          (behind FEATURES.news — §14 rung 1)
 *   5. Explore collectibles — 2×2 grid
 *   6. Your Inventory — compact item rail, See all → Profile
 *   7. Collectors you may like — match cards
 *   8. Tab bar (lives in the layout)
 *
 * Canonical variant is the one WITH the gaming updates rail. If J5 is cut, flip
 * `FEATURES.news` and the rail disappears cleanly rather than leaving a hole.
 *
 * Every read goes through `@/services`. Nothing here imports a fixture.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
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
} from '@/components';
import { ART_PLACEMENTS, backdropFor } from '@/config/artRegistry';
import { FEATURES } from '@/config/features';
import { headlineItem } from '@/domain/collections';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
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
import { colors, radius, spacing, typography } from '@/theme/theme';
import { GAME_SHORT_LABELS, GAME_TITLES } from '@/types';
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
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { viewer, viewerId, inventory, unreadNotifications, loading } = useApp();

  /** Tab screens stay mounted, so returning here has to be sent back to the top. */
  const scrollRef = useTopOnFocus();

  const [filter, setFilter] = useState<Filter>('All');
  const [articles, setArticles] = useState<Article[]>([]);
  const [explore, setExplore] = useState<ExploreEntry[]>([]);
  const [collectors, setCollectors] = useState<CollectorRecommendation[]>([]);
  const [rooms, setRooms] = useState<RoomEntry[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const [news, collections, users, recommended, publishedRooms] = await Promise.all([
      FEATURES.news ? newsService.getDiscover(6) : Promise.resolve([]),
      collectionService.getPublicCollections(),
      socialService.getUsers(),
      matchService.getRecommendedCollectors(viewerId, 6),
      roomService.getPublishedRooms(),
    ]);

    const usersById = new Map(users.map((user) => [user.id, user]));

    const entries = await Promise.all(
      collections.map(async (collection) => ({
        collection,
        owner: usersById.get(collection.userId) ?? null,
        headline: headlineItem(await catalogueService.getItems(collection.itemIds)),
      })),
    );

    const roomEntries = await Promise.all(
      publishedRooms.map(async (room) => {
        const [theme, collection] = await Promise.all([
          roomService.getTheme(room.themeId),
          collectionService.getCollection(room.collectionId),
        ]);
        return {
          room,
          themeName: theme?.name ?? 'Room',
          collectionName: collection?.name ?? 'Collection',
        };
      }),
    );

    setArticles(news);
    setExplore(entries);
    setCollectors(recommended);
    setRooms(roomEntries);
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
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
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
      {/* 1 — Header */}
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.name}>{viewer?.displayName ?? '—'}</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/news')} hitSlop={8} style={styles.bell}>
            <Text style={styles.bellGlyph}>◔</Text>
            {unreadNotifications > 0 ? <View style={styles.unreadDot} /> : null}
          </Pressable>
          <Pressable onPress={() => router.navigate('/profile')} hitSlop={8}>
            <Avatar
              name={viewer?.displayName ?? '?'}
              verified={viewer?.isAccountVerified}
              size={38}
            />
          </Pressable>
        </View>
      </View>

      {/* 2 — Filter chips */}
      <FilterChips options={FILTERS} value={filter} onChange={setFilter} />

      {/* 3 — Hero banner */}
      <View style={styles.hero}>
        <View style={styles.heroArt}>
          {/*
            The tiles used to be seeded 'hero-a/b/c', which matched no item, so
            the first thing on Home was three colour blocks. They now point at
            the four ids the art pack assigns to this banner.
          */}
          {/*
            Four equal panels, not an overlapping fan. Overlapping shifted each
            tile under the one before it, so the part left showing was the right
            edge of the crop — sky and motion blur — while the face sat hidden
            underneath. Equal panels are also close to the art's 3:2, so the
            cover-crop barely trims.
          */}
          {ART_PLACEMENTS['home.heroMosaic'].map((itemId) => (
            <ItemArt
              key={itemId}
              seed={itemId}
              tier={inventory.find((entry) => entry.item.id === itemId)?.item.rarityTier ?? 'mythic'}
              style={styles.heroTile}
            />
          ))}
        </View>
        <Text style={styles.eyebrow}>✦ Collections made for you</Text>
        <Text style={styles.heroHeadline}>
          Your skins are worth more than a menu no one ever sees.
        </Text>
        <View style={styles.heroCta}>
          <PrimaryButton label="Explore" onPress={() => router.navigate('/explore')} />
        </View>
        <View style={styles.logoRow}>
          {GAME_TITLES.map((title) => (
            <View key={title} style={styles.logo}>
              <Text style={styles.logoText}>{GAME_SHORT_LABELS[title]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 4 — Gaming updates (§14 rung 1: flip FEATURES.news and this disappears) */}
      {FEATURES.news && filter === 'All' ? (
        <View>
          <SectionHeader title="Gaming updates" onSeeAll={() => router.push('/news')} />
          {busy ? (
            <LoadingState height={132} />
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={articles}
              keyExtractor={(article) => article.id}
              contentContainerStyle={styles.rail}
              renderItem={({ item }) => (
                <ArticleCard
                  article={item}
                  width={248}
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
            title="Explore collectibles"
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
                <FadeInView key={entry.collection.id} index={index} style={styles.gridCell}>
                  <CollectionCard
                    collection={entry.collection}
                    owner={entry.owner}
                    headline={entry.headline}
                    onPress={() => openCollection(entry.collection.id)}
                  />
                </FadeInView>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {/* 6 — Recently added */}
      {filter === 'All' ? (
        <View>
          {/* "See all" goes to Profile, not Collections: this rail is the
              viewer's own inventory, and Profile is where the full inventory
              lives. Collections is curated groupings, which is a different
              question from "everything I own". */}
          <SectionHeader title="Your Inventory" onSeeAll={() => router.navigate('/profile')} />
          {inventory.length === 0 ? (
            <EmptyState
              title="No items yet"
              body="Import a screenshot or recording of your inventory and your items appear here."
              actionLabel="Import inventory"
              onAction={() => router.push('/import')}
            />
          ) : (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={inventory.slice(0, 8)}
              keyExtractor={(entry) => entry.owned.id}
              contentContainerStyle={styles.rail}
              renderItem={({ item }) => (
                <ItemCard item={item.item} trustLevel={item.owned.trustLevel} width={124} />
              )}
            />
          )}
        </View>
      ) : null}

      {/* 7 — Collectors you may like */}
      {show('Collectors') ? (
        <View>
          <SectionHeader title="Collectors you may like" onSeeAll={() => router.navigate('/explore')} />
          {busy ? (
            <LoadingState height={150} />
          ) : (
            <FlatList
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
          <SectionHeader title="Published rooms" />
          {busy ? (
            <LoadingState height={150} />
          ) : (
            <View style={styles.roomList}>
              {rooms.map((entry) => (
                <Pressable
                  key={entry.room.id}
                  onPress={() =>
                    router.push({ pathname: '/room/[id]', params: { id: entry.room.id } })
                  }
                  style={styles.roomRow}
                >
                  {/* A theme id is not an item id, so `ItemArt` only ever gave
                      these rows a colour block. Rooms have their own backdrop. */}
                  <RoomThumb themeId={entry.room.themeId} />
                  <View style={styles.roomMeta}>
                    <Text style={styles.roomName}>{entry.collectionName}</Text>
                    <Text style={styles.muted}>
                      {entry.themeName} · {entry.room.placements.length} items placed
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {loading ? <LoadingState height={40} /> : null}
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
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
function RoomThumb({ themeId }: { themeId: string }) {
  const backdrop = backdropFor(themeId);
  if (!backdrop) return <ItemArt seed={themeId} tier="mythic" style={styles.roomThumb} />;
  return (
    <View style={[styles.roomThumb, styles.roomThumbClip]}>
      <Image
        source={backdrop}
        style={styles.roomThumbImage}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.xl },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { gap: 2 },
  greeting: { ...typography.body, color: colors.textSecondary },
  name: { ...typography.screenTitle, color: colors.textPrimary },
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
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroArt: { flexDirection: 'row', gap: 2, marginBottom: spacing.sm },
  heroTile: { flex: 1, height: 72 },
  eyebrow: { ...typography.meta, color: colors.accent, letterSpacing: 0.5 },
  heroHeadline: { ...typography.sectionHeader, color: colors.textPrimary, fontSize: 20 },
  heroCta: { alignSelf: 'flex-start', marginTop: spacing.sm },
  logoRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  logo: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  logoText: { ...typography.meta, fontSize: 10, color: colors.textTertiary },

  rail: { gap: spacing.md, paddingRight: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  /** Was the card's own `width="48%"`; moved out when FadeInView wrapped it. */
  gridCell: { width: '48%' },

  roomList: { gap: spacing.sm },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  roomThumb: { width: 64, height: 46 },
  roomThumbClip: { overflow: 'hidden', borderRadius: radius.sm, backgroundColor: colors.surfaceSunken },
  roomThumbImage: { width: '100%', height: '100%' },
  roomMeta: { flex: 1, gap: 2 },
  roomName: { ...typography.cardTitle, color: colors.textPrimary },
  muted: { ...typography.meta, color: colors.textSecondary },
  chevron: { fontSize: 22, color: colors.textTertiary },
});
