/**
 * Profile — the viewer's own public identity (§11 F5).
 *
 * Behind the §13.4 onboarding gate, for the reason the PRD gives: it "prevents
 * an empty-profile first impression". The gate is enforced in `TabBar`.
 *
 * Items are grouped by `rarityTier` and printed with `rarityLabel` (§12.2).
 * Nothing here sorts on a rarity string.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, ItemCard, LoadingState, SecondaryButton, SectionHeader } from '@/components';
import { rarityLabelFor } from '@/domain/rarity';
import { collectionService, inventoryService, socialService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, rarityColors, spacing, typography } from '@/theme/theme';
import type { Collection, Item, RarityTier, User } from '@/types';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { viewer, viewerId, inventory, resetOnboardingGate } = useApp();

  const [groups, setGroups] = useState<{ tier: RarityTier; items: Item[] }[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [following, setFollowing] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [grouped, mine, out, back] = await Promise.all([
        inventoryService.getGroupedByRarity(viewerId),
        collectionService.getCollectionsByUser(viewerId),
        socialService.getFollowing(viewerId),
        socialService.getFollowers(viewerId),
      ]);
      if (cancelled) return;
      setGroups(grouped);
      setCollections(mine);
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

      {busy ? (
        <LoadingState height={200} />
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
});
