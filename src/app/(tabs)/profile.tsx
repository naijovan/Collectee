/**
 * Profile — the viewer's own public identity (§11 F5).
 *
 * Behind the §13.4 onboarding gate, for the reason the PRD gives: it "prevents
 * an empty-profile first impression". The gate is enforced in `TabBar`.
 *
 * Items are grouped by `rarityTier` and printed with `rarityLabel` (§12.2).
 * Nothing here sorts on a rarity string.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  AvatarPicker,
  CollectionCard,
  EmptyState,
  useHoverLift,
  ItemArt,
  ItemCard,
  LoadingState,
  SectionHeader,
  ASSISTANT_CLEARANCE,
} from '@/components';
import { headlineItem } from '@/domain/collections';
import { intensityOption } from '@/domain/onboarding';
import { useDragScroll } from '@/hooks/useDragScroll';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { catalogueService, collectionService, inventoryService, roomService, socialService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, fonts, radius, spacing, typography } from '@/theme/theme';
import type { Collection, Item, RarityTier, Room, User } from '@/types';

/** A published showroom with the collection it was built from. */
interface RoomEntry {
  room: Room;
  collection: Collection;
  headline: Item | null;
}

/**
 * How many items the Profile rail previews before deferring to /inventory.
 *
 * Named rather than inline because the footer's "+N" is derived from it — two
 * hand-written numbers here is exactly how a rail ends up promising more than
 * it shows.
 */
const PREVIEW_ITEMS = 20;

export default function ProfileScreen() {
  const router = useRouter();
  const { width: viewportWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const {
    viewer,
    viewerId,
    inventory,
    intensity,
    mode,
    chooseAvatar,
    createAccount,
    refreshInventory,
    resetFirstRun,
  } = useApp();

  /** What the last reset removed, so the row reports rather than silently acting. */
  const [clearedNote, setClearedNote] = useState<string | null>(null);

  async function resetImports() {
    const removed = await inventoryService.clearImported(viewerId);
    await refreshInventory();
    setClearedNote(
      removed === 0
        ? 'Nothing to remove — the inventory is already the seeded 40'
        : `Removed ${removed} imported ${removed === 1 ? 'item' : 'items'} · back to the seeded 40`,
    );
  }

  const scrollRef = useTopOnFocus();
  /* Click-and-drag panning for the inventory rail. Web-only; native pans on
     touch already. */
  const inventoryRail = useDragScroll<FlatList>();
  const [pickerOpen, setPickerOpen] = useState(false);


  const verifiedCount = useMemo(
    () => inventory.filter((entry) => entry.owned.trustLevel === 'verified').length,
    [inventory],
  );

  const [collections, setCollections] = useState<Collection[]>([]);
  const [publishedRooms, setPublishedRooms] = useState<Room[]>([]);
  /** Showrooms with their backing collection, for the shared card. */
  const [roomEntries, setRoomEntries] = useState<RoomEntry[]>([]);
  /**
   * Collections WITHOUT a published showroom.
   *
   * Profile shows both sections, so a collection that has a room was appearing
   * in each — the same duplicate the Collections tab had. Both pages now make
   * the same split, or the two disagree about what the viewer owns.
   */
  const plainCollections = useMemo(() => {
    const withRooms = new Set(roomEntries.map((entry) => entry.collection.id));
    return collections.filter((collection) => !withRooms.has(collection.id));
  }, [collections, roomEntries]);
  const [following, setFollowing] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [mine, out, back] = await Promise.all([
        collectionService.getCollectionsByUser(viewerId),
        socialService.getFollowing(viewerId),
        socialService.getFollowers(viewerId),
      ]);
      const rooms = await roomService.getRoomsOnProfile(mine.map((c) => c.id));

      /* Each room paired with the collection it was built from and that
         collection's rarest item, because Profile now renders showrooms with
         the same `CollectionCard` the Collections tab uses and the card needs
         both. Resolved here rather than per card so the grid does not fire a
         fetch per tile. */
      const byId = new Map(mine.map((c) => [c.id, c]));
      const paired = await Promise.all(
        rooms.map(async (room) => {
          const collection = byId.get(room.collectionId) ?? null;
          return {
            room,
            collection,
            headline: collection
              ? headlineItem(await catalogueService.getItems(collection.itemIds))
              : null,
          };
        }),
      );

      if (cancelled) return;
      setCollections(mine);
      setPublishedRooms(rooms);
      setRoomEntries(paired.filter((e) => e.collection !== null) as RoomEntry[]);
      setFollowing(out);
      setFollowers(back);
      setBusy(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [viewerId, inventory.length]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      <View style={styles.identity}>
        <Avatar
          name={viewer?.displayName ?? '?'}
          avatarId={viewer?.avatar}
          verified={viewer?.isAccountVerified}
          size={112}
        />
        <Text style={styles.name}>{viewer?.displayName ?? '—'}</Text>
        <Text style={styles.muted}>@{viewer?.handle ?? '—'}</Text>
        {/* Quiz step 3, and the only place it surfaces. It is self-reported
            flavour — nothing is gated on it — but if it appeared nowhere the
            quiz would be asking a question with no answer, which is exactly
            the kind of dead control the rest of the first run avoids. Absent
            when the quiz was skipped, which is the common case. */}
        {/* Under the face it changes, so the effect of a tap is in view. */}
        <Pressable
          onPress={() => setPickerOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: pickerOpen }}
          style={({ pressed }) => [styles.changeAvatar, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.changeAvatarText}>
            {pickerOpen ? 'Done' : 'Change avatar'}
          </Text>
        </Pressable>
        {intensity ? (
          <View style={styles.intensityPill}>
            <Text style={styles.intensityText}>{intensityOption(intensity).profileFlavour}</Text>
          </View>
        ) : null}
      </View>

      {/*
        A guest's profile is not an empty profile — it is the absence of one.
        Everything below this point (inventory, collections, showrooms, the
        stats row, the avatar picker) describes an account that does not exist,
        so it is replaced wholesale rather than rendered empty. Showing "0
        items · 0 collections" would read as a broken account rather than as no
        account.
      */}
      {mode === 'guest' ? (
        <EmptyState
          title="You're browsing as a guest"
          body="Nothing here is saved. Create an account to import your skins, keep an inventory, group it into collections and build a showroom others can visit."
          actionLabel="Create an account"
          onAction={createAccount}
        />
      ) : null}

      {mode === 'guest' ? null : pickerOpen ? (
        <View style={styles.pickerCard}>
          <SectionHeader title="Choose Your Avatar" />
          {/* Ordered by the games this account follows — the same rule the
              first-run step uses, so the grid does not reshuffle between the
              two places it appears. */}
          <AvatarPicker
            value={viewer?.avatar ?? null}
            onChange={(id) => void chooseAvatar(id)}
            preferredGames={viewer?.followedGames ?? []}
          />
          <Text style={styles.muted}>
            Saved in the app for this session. There is no backend in the demo build (§12.1), so
            a reload restores the seeded avatar.
          </Text>
        </View>
      ) : null}

      {/*
        Everything from here down describes an ACCOUNT: the settings entry,
        the stats row, the inventory rail, collections, showrooms and the
        developer tools. A guest has none of those, so the whole block is
        replaced by the pitch above rather than rendered with zeroes in it —
        "0 items · 0 collections" reads as a broken account, not as no
        account at all.
      */}
      {mode === 'guest' ? null : (
        <>
        {/* Top-right of the identity block: settings changes who you are, so it
            belongs on the screen that shows it rather than floating app-wide. */}
        <Pressable
          accessibilityLabel="Settings"
          hitSlop={10}
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.settings, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.settingsGlyph}>⚙</Text>
        </Pressable>

        <View style={styles.stats}>
          <Stat
            label="Items"
            value={inventory.length}
            hint={`${verifiedCount} verified · ${inventory.length - verifiedCount} unverified`}
            onPress={() => router.push('/inventory')}
          />
          <Stat
            label="Collections"
            value={collections.length}
            hint={`${collections.reduce((n, c) => n + c.itemIds.length, 0)} items grouped`}
            onPress={() => router.navigate('/collections')}
          />
          <Stat
            label="Followers"
            value={followers.length}
            hint="Collectors following you"
            onPress={() => router.push({ pathname: '/connections', params: { tab: 'followers' } })}
          />
          <Stat
            label="Following"
            value={following.length}
            hint="Collectors you follow"
            onPress={() => router.push({ pathname: '/connections', params: { tab: 'following' } })}
          />
        </View>


        {/*
          Rooms on profile — the last screen of the §10 J3 flow map, and the point
          of the whole feature: a room is not a one-off artifact, it is part of an
          identity. Only published rooms with showOnProfile appear.
        */}
        {/* Always rendered, even empty. The three sections — Collections,
            Showrooms, Inventory — are the shape of a profile; hiding one
            when it happens to be empty makes the page look like it has a
            different structure per user. An empty state that says what a room is
            does more work than a gap. */}
        <View>
          <SectionHeader title="Your Showrooms" prominent />
          {publishedRooms.length === 0 ? (
            <Pressable style={styles.roomEmpty} onPress={() => router.push('/room/new')}>
              <Text style={styles.devLabel}>No rooms yet</Text>
              <Text style={styles.muted}>
                Build an interactive room from a collection of verified items ›
              </Text>
            </Pressable>
          ) : null}
        </View>

        {roomEntries.length > 0 ? (
          <View>
            {/* The same grid of `CollectionCard`s the Collections tab uses for
                its own Showrooms section. Profile had thin rows with a square
                theme thumbnail, so the identical set of rooms looked like two
                different features depending on which tab you reached them from.
                A showroom is something you look at; the card shows it. */}
            <View style={styles.collectionGrid}>
              {roomEntries.map((entry) => (
                /* Inert wrapper; the card carries the handler. A Pressable around
                   `CollectionCard` renders a <button> inside a <button> on web and
                   the click never lands — see the same fix on the Collections tab. */
                <View key={entry.room.id} style={styles.collectionCell}>
                  <CollectionCard
                    collection={entry.collection}
                    owner={viewer}
                    headline={entry.headline}
                    showVisibility
                    onPress={() =>
                      router.push({ pathname: '/room/[id]', params: { id: entry.room.id } })
                    }
                  />
                </View>
              ))}
              {viewportWidth >= 600 && roomEntries.length % 2 === 1 ? (
                <View style={styles.collectionCell} pointerEvents="none" />
              ) : null}
            </View>
          </View>
        ) : null}

        <View>
          <SectionHeader
            title="Your Collections"
            prominent
            onSeeAll={() => router.navigate('/collections')}
          />
          {plainCollections.length === 0 ? (
            <Text style={styles.muted}>No collections yet.</Text>
          ) : (
            <View style={styles.collectionGrid}>
              {plainCollections.map((collection) => (
                <View
                  key={collection.id}
                  style={[styles.collectionCell, viewportWidth < 600 && styles.collectionCellPhone]}
                >
                  <CollectionCard
                    collection={collection}
                    owner={viewer}
                    width="100%"
                    showVisibility
                    onPress={() =>
                      router.push({ pathname: '/collection/[id]', params: { id: collection.id } })
                    }
                  />
                </View>
              ))}
              {viewportWidth >= 600 && plainCollections.length % 2 === 1 ? (
                <View style={styles.collectionCell} pointerEvents="none" />
              ) : null}
            </View>
          )}
        </View>

        {/* A preview, not the list. Profile is an identity page — collections,
            showrooms, a taste of what you own. Forty item cards inline turn it
            into a list screen nobody scrolls past, so the full grid and its
            filters live on /inventory. */}
        <View>
          <SectionHeader
            title="Your Inventory"
            prominent
            actionLabel="View full inventory"
            onSeeAll={() => router.push('/inventory')}
          />
          <Text style={styles.muted}>
            {inventory.length} items · {verifiedCount} verified · {inventory.length - verifiedCount}{' '}
            unverified
          </Text>
          {/* A rail rather than a wrapping grid: a grid has to pick a row count
              and then either truncate hard or grow the page, while a rail shows
              more in the same height and its overflow is obvious because the last
              card is half-cut. The full grid, with filters, stays behind "View
              full inventory".

              The cap is PREVIEW_ITEMS, not the whole inventory. A rail you can
              scroll for forty cards is the list screen this preview exists to
              avoid, and it competes with the button that leads to the real one —
              but eight ran out almost immediately on a wide window, which made
              the rail look like the whole inventory rather than a slice of it.
              Twenty is long enough to keep scrolling on any width and still
              short enough to end. */}
          <FlatList
            ref={inventoryRail}
            horizontal
            showsHorizontalScrollIndicator={false}
            data={inventory.slice(0, PREVIEW_ITEMS)}
            keyExtractor={(entry) => entry.owned.id}
            contentContainerStyle={styles.previewRail}
            renderItem={({ item: entry }: { item: (typeof inventory)[number] }) => (
              <ItemCard
                item={entry.item}
                trustLevel={entry.owned.trustLevel}
                /* 168 wide and 200 tall, overlaid.
                   At 132 the names wrapped to two cramped lines and the game and
                   trust badge fought for one row underneath — "Gusion — Cyber
                   Faust · MLBB · Verified" in 132px is four pieces of
                   information in a space that fits two. Bigger, and with the
                   words on the art, it matches the collection and showroom cards
                   it scrolls beside. */
                width={176}
                /* SQUARE, matching the rendition `ItemArt` picks for a box this
                   shape. A 176x200 portrait box cropped the sides a second time
                   on art that had already been cropped square at bake time —
                   characters are authored 3:2, so they were losing ~44% of their
                   width in total and arriving as a face with no shoulders.
                   Square costs a little height and shows the whole subject. */
                artHeight={176}
                overlay
                onPress={() => router.push('/inventory')}
              />
            )}
            /* The tail card, so the rail ends by pointing at the full grid rather
               than just stopping. Only when there is genuinely more to see. */
            ListFooterComponent={
              inventory.length > PREVIEW_ITEMS ? (
                <Pressable style={styles.railMore} onPress={() => router.push('/inventory')}>
                  <Text style={styles.railMoreCount}>+{inventory.length - PREVIEW_ITEMS}</Text>
                  <Text style={styles.railMoreLabel}>See all</Text>
                </Pressable>
              ) : null
            }
          />
        </View>

        {busy ? <LoadingState height={120} /> : null}

        <View>
          <SectionHeader title="Developer" prominent />
          {/*
            Two rows, both rehearsal affordances.

            "Foundation checks", "Reset onboarding gate" and "Reset the whole
            first run" were three routes to internal state that nobody demoing
            this needs — and two of them only signposted /diagnostics, which is
            still there and still reachable by URL.

            What a rehearsal actually needs is: put the inventory back, and see
            the first run again.
          */}
          <Pressable style={styles.devRow} onPress={() => void resetImports()}>
            <Text style={styles.devLabel}>Reset imported items</Text>
            <Text style={styles.muted}>
              {clearedNote ??
                'Removes everything imported this session and leaves the 40 seeded items'}
            </Text>
          </Pressable>
          <Pressable style={styles.devRow} onPress={resetFirstRun}>
            <Text style={styles.devLabel}>Show the login page</Text>
            <Text style={styles.muted}>
              Signs you out and replays sign-in, the quiz and the tour from the start
            </Text>
          </Pressable>
        </View>
        </>
      )}

      <View style={{ height: ASSISTANT_CLEARANCE }} />
    </ScrollView>
  );
}

/**
 * A profile stat. Every one is a destination — the number is a summary of a
 * list that exists elsewhere, so a user who reads it and wants the detail
 * should not have to hunt for the way in.
 *
 * `hint` shows on hover: the breakdown behind the number, which is the question
 * the number provokes and the reason someone taps it.
 */
function Stat({
  label,
  value,
  hint,
  onPress,
}: {
  label: string;
  value: number;
  hint: string;
  onPress: () => void;
}) {
  const hover = useHoverLift();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label}. ${hint}`}
      onPress={onPress}
      {...hover.hoverProps}
      style={({ pressed }) => [styles.stat, hover.hoverStyle, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hover.hovered ? <Text style={styles.statHint}>{hint}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, gap: spacing.lg },

  identity: { alignItems: 'center', gap: spacing.xs },
  name: { ...typography.screenTitle, color: colors.textPrimary, marginTop: spacing.sm },
  muted: { ...typography.meta, color: colors.textSecondary },
  bio: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },
  changeAvatar: { marginTop: spacing.sm, paddingVertical: spacing.xs },
  changeAvatarText: { ...typography.meta, color: colors.accent },
  pickerCard: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  intensityPill: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  intensityText: { ...typography.meta, color: colors.textSecondary },

  /**
   * Four separate tiles rather than one bar with invisible columns.
   *
   * Each of these is its own destination, and a single container made them
   * read as one read-only summary — nothing suggested four different taps.
   * Gaps between them also let the hover lift land on the tile the pointer is
   * actually over, which inside a shared box looked like the whole bar moving.
   */
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  /* Display face and tabular figures: these are numbers read at a glance and
     compared against each other, so they should not reflow as digits change
     width. */
  statValue: {
    ...typography.sectionHeader,
    ...typography.numeric,
    fontSize: 24,
    lineHeight: 30,
    fontFamily: fonts.display,
    color: colors.textPrimary,
  },
  /** Smaller and quieter than the number it labels. */
  statLabel: { ...typography.meta, fontSize: 11, color: colors.textSecondary },

  actions: { flexDirection: 'row', gap: spacing.md },

  tierHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  tierDot: { width: 10, height: 10, borderRadius: radius.pill },
  tierName: { ...typography.sectionHeader, color: colors.textPrimary, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },

  devRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 2,
    marginBottom: spacing.sm,
  },
  devLabel: { ...typography.cardTitle, color: colors.textPrimary },

  settings: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.lg,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  settingsGlyph: { color: colors.textPrimary, fontSize: 18, lineHeight: 22 },

  statHint: { ...typography.meta, color: colors.accent, textAlign: 'center', marginTop: 2 },

  previewRail: { gap: spacing.md, paddingRight: spacing.lg, paddingTop: spacing.sm },

  /** The rail's tail card. Same width as an ItemCard so the rhythm holds. */
  railMore: {
    width: 176,
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  railMoreCount: { ...typography.cardTitle, color: colors.accent },
  railMoreLabel: { ...typography.meta, color: colors.textSecondary },

  /* Same fix as the Collections tab: `width: 48%`, `gap` and `space-between`
     were three separate things pushing the cards apart. Gap alone now, with
     `flexGrow` absorbing the remainder so two fill the row. */
  collectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  collectionCell: { flexGrow: 1, flexBasis: '46%', minWidth: 260 },
  collectionCellPhone: { flexBasis: '100%', minWidth: 0 },

  roomEmpty: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },

});
