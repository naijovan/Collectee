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
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  CollectionCard,
  FilterChips,
  ItemArt,
  ItemCard,
  LoadingState,
  SecondaryButton,
  SectionHeader,
} from '@/components';
import { groupByRarity, rarityLabelFor, RARITY_RANK } from '@/domain/rarity';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { collectionService, inventoryService, roomService, socialService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, rarityColors, spacing, typography } from '@/theme/theme';
import type { Collection, Item, RarityTier, Room, User } from '@/types';

/**
 * Inventory filters. Trust sits alongside rarity rather than in its own control
 * because §9.4 made it a property users now act on — it decides whether an item
 * can enter a Collection Room, so "which of mine are verified" is a question
 * worth one tap.
 */
const INVENTORY_FILTERS = [
  'All',
  'Verified',
  'Unverified',
  'Mythic',
  'Legendary',
  'Epic',
] as const;
type InventoryFilter = (typeof INVENTORY_FILTERS)[number];

const FILTER_TIERS: Partial<Record<InventoryFilter, RarityTier>> = {
  Mythic: 'mythic',
  Legendary: 'legendary',
  Epic: 'epic',
};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { viewer, viewerId, inventory, resetOnboardingGate } = useApp();

  const scrollRef = useTopOnFocus();

  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>('All');

  /**
   * Grouped locally rather than via `getGroupedByRarity`, because the filter
   * needs `owned.trustLevel` and that service returns catalogue items only —
   * the trust half of the join is dropped on the way out.
   */
  const groups = useMemo(() => {
    const tier = FILTER_TIERS[inventoryFilter];
    const filtered = inventory.filter((entry) => {
      if (inventoryFilter === 'Verified') return entry.owned.trustLevel === 'verified';
      if (inventoryFilter === 'Unverified') return entry.owned.trustLevel !== 'verified';
      if (tier) return entry.item.rarityTier === tier;
      return true;
    });
    return groupByRarity(filtered.map((entry) => entry.item)).sort(
      (a, b) => RARITY_RANK[b.tier] - RARITY_RANK[a.tier],
    );
  }, [inventory, inventoryFilter]);

  const verifiedCount = useMemo(
    () => inventory.filter((entry) => entry.owned.trustLevel === 'verified').length,
    [inventory],
  );

  const [collections, setCollections] = useState<Collection[]>([]);
  const [publishedRooms, setPublishedRooms] = useState<Room[]>([]);
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

      if (cancelled) return;
      setCollections(mine);
      setPublishedRooms(rooms);
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
        <Avatar name={viewer?.displayName ?? '?'} verified={viewer?.isAccountVerified} size={72} />
        <Text style={styles.name}>{viewer?.displayName ?? '—'}</Text>
        <Text style={styles.muted}>@{viewer?.handle ?? '—'}</Text>
        <Text style={styles.bio}>{viewer?.bio ?? ''}</Text>
      </View>

      <View style={styles.stats}>
        <Stat label="Items" value={inventory.length} />
        <Stat label="Collections" value={collections.length} />
        <Stat label="Followers" value={followers.length} />
        <Stat label="Following" value={following.length} />
      </View>

      <View style={styles.actions}>
        <SecondaryButton label="Import more items" onPress={() => router.push('/import')} />
        <SecondaryButton label="Build a room" onPress={() => router.push('/room/new')} />
      </View>

      {/*
        Rooms on profile — the last screen of the §10 J3 flow map, and the point
        of the whole feature: a room is not a one-off artifact, it is part of an
        identity. Only published rooms with showOnProfile appear.
      */}
      {/* Always rendered, even empty. The three sections — Collections,
          Collection Rooms, Inventory — are the shape of a profile; hiding one
          when it happens to be empty makes the page look like it has a
          different structure per user. An empty state that says what a room is
          does more work than a gap. */}
      <View>
        <SectionHeader title="Collection Rooms" />
        {publishedRooms.length === 0 ? (
          <Pressable style={styles.roomEmpty} onPress={() => router.push('/room/new')}>
            <Text style={styles.devLabel}>No rooms yet</Text>
            <Text style={styles.muted}>
              Build an interactive room from a collection of verified items ›
            </Text>
          </Pressable>
        ) : null}
      </View>

      {publishedRooms.length > 0 ? (
        <View>
          <View style={styles.roomList}>
            {publishedRooms.map((room) => (
              <Pressable
                key={room.id}
                style={styles.roomRow}
                onPress={() => router.push({ pathname: '/room/[id]', params: { id: room.id } })}
              >
                <ItemArt seed={room.themeId} tier="mythic" style={styles.roomThumb} />
                <View style={styles.roomBody}>
                  <Text style={styles.devLabel}>{room.title}</Text>
                  <Text style={styles.muted}>
                    {room.placements.length} items · ♥ {room.likeCount.toLocaleString()} ·{' '}
                    {room.visitorCount.toLocaleString()} visitors
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View>
        <SectionHeader
          title="Collections"
          onSeeAll={() => router.navigate('/collections')}
        />
        {collections.length === 0 ? (
          <Text style={styles.muted}>No collections yet.</Text>
        ) : (
          <View style={styles.collectionGrid}>
            {collections.map((collection) => (
              <View key={collection.id} style={styles.collectionCell}>
                <CollectionCard
                  collection={collection}
                  width="100%"
                  onPress={() =>
                    router.push({ pathname: '/collection/[id]', params: { id: collection.id } })
                  }
                />
              </View>
            ))}
          </View>
        )}
      </View>

      <View>
        <SectionHeader title="Inventory" />
        <Text style={styles.muted}>
          {inventory.length} items · {verifiedCount} verified · {inventory.length - verifiedCount}{' '}
          unverified
        </Text>
        <FilterChips
          options={INVENTORY_FILTERS}
          value={inventoryFilter}
          onChange={setInventoryFilter}
        />
      </View>

      {busy ? (
        <LoadingState height={200} />
      ) : groups.length === 0 ? (
        <Text style={styles.muted}>Nothing matches that filter.</Text>
      ) : (
        groups.map((group) => (
          <View key={group.tier}>
            <View style={styles.tierHeader}>
              <View style={[styles.tierDot, { backgroundColor: rarityColors[group.tier] }]} />
              <Text style={styles.tierName}>
                {/* Printed label is native to the title of the first item (§12.2). */}
                {rarityLabelFor(group.tier, group.items[0]!.title)}
              </Text>
              <Text style={styles.muted}>{group.items.length}</Text>
            </View>
            <View style={styles.grid}>
              {group.items.map((item) => (
                <ItemCard key={item.id} item={item} width="30%" />
              ))}
            </View>
          </View>
        ))
      )}

      <View>
        <SectionHeader title="Developer" />
        <Pressable style={styles.devRow} onPress={() => router.push('/diagnostics')}>
          <Text style={styles.devLabel}>Foundation checks</Text>
          <Text style={styles.muted}>Every service, called the way a screen calls it ›</Text>
        </Pressable>
        <Pressable style={styles.devRow} onPress={resetOnboardingGate}>
          <Text style={styles.devLabel}>Reset onboarding gate</Text>
          <Text style={styles.muted}>
            Greys out Collections and Profile again so the §13.4 gate can be demoed
          </Text>
        </Pressable>
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },

  identity: { alignItems: 'center', gap: spacing.xs },
  name: { ...typography.screenTitle, color: colors.textPrimary, marginTop: spacing.sm },
  muted: { ...typography.meta, color: colors.textSecondary },
  bio: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xs },

  stats: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...typography.sectionHeader, color: colors.textPrimary },

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

  collectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  collectionCell: { width: '48%' },

  roomEmpty: {
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },

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
  roomBody: { flex: 1, gap: 2 },
  chevron: { fontSize: 22, color: colors.textTertiary },
});
