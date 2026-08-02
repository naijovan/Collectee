/**
 * Collections tab — the viewer's own collections (J2 lands here when published).
 *
 * Behind the §13.4 onboarding gate: `TabBar` keeps this unreachable until the
 * first import completes. The empty state below is the second line of defence,
 * not the gate itself — do not re-derive `hasImported` here.
 *
 * Set-completion progress comes from `domain/collections.ts` via the service
 * layer; it is the one piece of F2 (§11, [ROADMAP]) that costs nothing because
 * it needs no model call.
 */

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CollectionCard, EmptyState, LoadingState, PrimaryButton, SectionHeader } from '@/components';
import { headlineItem, VISIBILITY_LABELS } from '@/domain/collections';
import type { SetProgress } from '@/domain/collections';
import { catalogueService, collectionService, inventoryService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import type { Collection, Item } from '@/types';

interface Entry {
  collection: Collection;
  headline: Item | null;
}

export default function CollectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { viewer, viewerId, inventory } = useApp();

  const [entries, setEntries] = useState<Entry[]>([]);
  const [progress, setProgress] = useState<SetProgress[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const mine = await collectionService.getCollectionsByUser(viewerId, true);
    const withArt = await Promise.all(
      mine.map(async (collection) => ({
        collection,
        headline: headlineItem(await catalogueService.getItems(collection.itemIds)),
      })),
    );
    const owned = await inventoryService.getOwnedItems(viewerId);
    setEntries(withArt);
    setProgress(await collectionService.setProgressFor(owned));
    setBusy(false);
  }, [viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  // A collection published in J2 must appear the moment the flow pops back.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Collections</Text>
        <Text style={styles.muted}>{inventory.length} items owned</Text>
      </View>

      <PrimaryButton label="+  Create a collection" onPress={() => router.push('/collection/new')} />

      {busy ? (
        <LoadingState height={220} />
      ) : entries.length === 0 ? (
        <EmptyState
          title="No collections yet"
          body="A collection is the moment an inventory dump becomes an identity. Pick some items and name the set."
          actionLabel="Create a collection"
          onAction={() => router.push('/collection/new')}
        />
      ) : (
        <View style={styles.grid}>
          {entries.map((entry) => (
            <View key={entry.collection.id} style={styles.gridItem}>
              <CollectionCard
                collection={entry.collection}
                owner={viewer}
                headline={entry.headline}
                onPress={() =>
                  router.push({ pathname: '/collection/[id]', params: { id: entry.collection.id } })
                }
              />
              <Text style={styles.visibility}>
                {VISIBILITY_LABELS[entry.collection.visibility]}
              </Text>
            </View>
          ))}
        </View>
      )}

      {progress.length > 0 ? (
        <View>
          <SectionHeader title="Sets in progress" />
          <View style={styles.progressList}>
            {progress.slice(0, 4).map((entry) => (
              <View key={entry.setId} style={styles.progressRow}>
                <View style={styles.progressText}>
                  <Text style={styles.rowTitle}>{entry.setName}</Text>
                  <Text style={styles.muted}>
                    {entry.owned} of {entry.total} owned
                  </Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.round(entry.ratio * 100)}%` }]} />
                </View>
                <Text style={styles.percent}>{Math.round(entry.ratio * 100)}%</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  muted: { ...typography.meta, color: colors.textSecondary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, justifyContent: 'space-between' },
  gridItem: { width: '48%', gap: spacing.xs },
  visibility: { ...typography.meta, color: colors.textTertiary, paddingLeft: spacing.xs },

  progressList: { gap: spacing.sm },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  progressText: { flex: 1, gap: 2 },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },
  track: { width: 72, height: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken },
  fill: { height: 6, borderRadius: radius.pill, backgroundColor: colors.accent },
  percent: { ...typography.meta, color: colors.textSecondary, width: 34, textAlign: 'right' },
});
