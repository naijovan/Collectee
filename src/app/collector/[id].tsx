/**
 * J4 — a collector's public profile and the collection-match screen (§11 F5).
 * Flow owner: Marcus.
 *
 * The match score is item-overlap based, not a black box: similarity over
 * co-owned items weighted by inverse item popularity, so owning the same
 * battle-pass skin counts for little and owning the same limited exclusive
 * counts for a lot. `domain/matching.ts` holds that maths.
 *
 * The reason ships with the number, always. §11 F5: "the explanation is what
 * makes a recommendation feel earned". The shared items below are that
 * explanation made concrete — the receipts behind the percentage.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Avatar,
  CollectionCard,
  ItemCard,
  LoadingState,
  PrimaryButton,
  SecondaryButton,
  SectionHeader,
} from '@/components';
import { headlineItem } from '@/domain/collections';
import { compareByDerivedTrust } from '@/domain/trust';
import type { DerivedTrust } from '@/domain/trust';
import {
  catalogueService,
  collectionService,
  inventoryService,
  matchService,
  socialService,
} from '@/services';
import type { CollectorRecommendation } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { GAME_LABELS } from '@/types';
import type { Collection, Item, User } from '@/types';

export default function CollectorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { viewerId } = useApp();

  const [user, setUser] = useState<User | null>(null);
  const [match, setMatch] = useState<CollectorRecommendation | null>(null);
  const [collections, setCollections] = useState<
    { collection: Collection; headline: Item | null; trust: DerivedTrust }[]
  >([]);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const [found, pairwise, theirs, theirItems] = await Promise.all([
      socialService.getUser(id),
      matchService.getMatch(viewerId, id),
      collectionService.getCollectionsByUser(id),
      inventoryService.getOwnedItems(id),
    ]);

    // Collection.itemIds are catalogue ids; trust lives on the OWNER's claim to
    // each one (§9.2), so it has to be resolved through their inventory.
    const ownedByItemId = new Map(theirItems.map((owned) => [owned.itemId, owned]));

    const withArt = await Promise.all(
      theirs.map(async (collection) => ({
        collection,
        headline: headlineItem(await catalogueService.getItems(collection.itemIds)),
        trust: socialService.derivedTrustFor(
          collection.itemIds
            .map((itemId) => ownedByItemId.get(itemId))
            .filter((owned): owned is NonNullable<typeof owned> => owned !== undefined),
        ),
      })),
    );

    // §9.2 — a disputed claim loses discovery ranking. Demoted rather than
    // hidden: the flag is against one item, not the whole collection.
    withArt.sort((a, b) => compareByDerivedTrust(a.trust, b.trust));

    setUser(found);
    setMatch(pairwise);
    setCollections(withArt);
    setFollowing(socialService.isFollowing(viewerId, id));
    setBusy(false);
  }, [id, viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    setFollowing(await socialService.toggleFollow(viewerId, id));
  }

  if (busy) {
    return (
      <View style={[styles.screen, styles.content]}>
        <LoadingState height={220} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.title}>Collector not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.identity}>
        <Avatar name={user.displayName} verified={user.isAccountVerified} size={72} />
        <Text style={styles.title}>{user.displayName}</Text>
        <Text style={styles.muted}>@{user.handle}</Text>
        <Text style={styles.body}>{user.bio}</Text>
        <Text style={styles.footnote}>
          Follows {user.followedGames.map((title) => GAME_LABELS[title]).join(' · ')}
        </Text>
      </View>

      {viewerId === user.id ? (
        <SecondaryButton label="This is you" />
      ) : following ? (
        <SecondaryButton label="Following" onPress={() => void toggleFollow()} />
      ) : (
        <PrimaryButton label="Follow" onPress={() => void toggleFollow()} />
      )}

      {/* The collection-match screen from the J4 flow map, inlined. */}
      {match ? (
        <View style={styles.matchCard}>
          <Text style={styles.matchPercent}>{match.percent}% match</Text>
          <Text style={styles.rowTitle}>{match.reason}</Text>
          {match.sharedItems.length > 0 ? (
            <>
              <Text style={styles.muted}>
                {match.sharedItems.length} verified items you both own — weighted by how rare they
                are, not how many they are
              </Text>
              <View style={styles.grid}>
                {match.sharedItems.slice(0, 6).map((item) => (
                  <ItemCard key={item.id} item={item} width={92} artHeight={64} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      <SectionHeader title="Collections" />
      {collections.length === 0 ? (
        <Text style={styles.muted}>Nothing published yet.</Text>
      ) : (
        <View style={styles.cardGrid}>
          {collections.map((entry) => (
            <View key={entry.collection.id} style={styles.collectionCell}>
              <CollectionCard
                collection={entry.collection}
                owner={user}
                headline={entry.headline}
                width="100%"
                onPress={() =>
                  router.push({ pathname: '/collection/[id]', params: { id: entry.collection.id } })
                }
              />
              {/*
                Derived, never stored (§12.3). Stating the count rather than
                stamping the collection "verified" — most-of-it-verified is not
                verified, and §9.2 exists to stop exactly that overstatement.
              */}
              {entry.trust.underReview ? (
                <Text style={styles.underReview}>Contains an item under review</Text>
              ) : (
                <Text style={styles.footnote}>
                  {entry.trust.verifiedCount} of {entry.trust.totalCount} items verified
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },

  identity: { alignItems: 'center', gap: spacing.xs },
  title: { ...typography.screenTitle, color: colors.textPrimary, marginTop: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary, textAlign: 'center' },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },

  matchCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.accent,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  matchPercent: { ...typography.screenTitle, color: colors.accent },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  collectionCell: { width: '48%', gap: spacing.xs },
  underReview: { ...typography.meta, color: colors.warning, paddingLeft: spacing.xs },
});
