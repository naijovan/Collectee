/**
 * J3 entry — "Turn this collection into a room".
 *
 * Not in the PRD's flow map; it comes from the design frames, and it earns its
 * place. §11 F4 sells rooms as the differentiator, and this is the one screen
 * that says *what the AI is actually working from* before a progress bar hides
 * it. Every tile below is derived from the real collection, not copywriting —
 * if the collection is single-title and mostly Rare, the tiles say so.
 *
 * It sits outside the numbered stepper. The five numbered steps start at Style.
 */

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ItemArt, LoadingState, PrimaryButton, SecondaryButton } from '@/components';
import { headlineItem } from '@/domain/collections';
import { rarityLabelFor } from '@/domain/rarity';
import { catalogueService, collectionService } from '@/services';
import { colors, radius, rarityColors, spacing, typography } from '@/theme/theme';
import { GAME_SHORT_LABELS } from '@/types';
import type { Collection, Item, RarityTier } from '@/types';

interface Signal {
  label: string;
  detail: string;
  glyph: string;
}

export default function RoomIntroScreen() {
  const { collectionId } = useLocalSearchParams<{ collectionId: string }>();
  const router = useRouter();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const found = await collectionService.getCollection(collectionId);
      const contents = found ? await catalogueService.getItemsSorted(found.itemIds) : [];
      if (cancelled) return;
      setCollection(found);
      setItems(contents);
      setBusy(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [collectionId]);

  if (busy) {
    return (
      <View style={[styles.screen, styles.content]}>
        <LoadingState height={220} />
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.title}>Collection not found</Text>
      </View>
    );
  }

  const headline = headlineItem(items);
  const signals = describeSignals(collection, items, headline);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.summary}>
        <ItemArt
          seed={collection.id}
          tier={headline?.rarityTier ?? 'epic'}
          style={styles.summaryArt}
        />
        <View style={styles.summaryBody}>
          <Text style={styles.summaryName}>{collection.name}</Text>
          <Text style={styles.muted}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Text>
          <Text style={styles.tags}>{collection.themeTags.join('  ·  ')}</Text>
        </View>
      </View>

      <Text style={styles.title}>Turn this collection into a room</Text>
      <Text style={styles.body}>
        Collectee will use the items and theme of {collection.name} to build a display space around
        them.
      </Text>

      <Text style={styles.sectionLabel}>What the AI will use</Text>
      <View style={styles.signalGrid}>
        {signals.map((signal) => (
          <View key={signal.label} style={styles.signal}>
            <Text style={styles.signalGlyph}>{signal.glyph}</Text>
            <Text style={styles.signalLabel}>{signal.label}</Text>
            <Text style={styles.signalDetail}>{signal.detail}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Room preview</Text>
      <View style={styles.preview}>
        <Text style={styles.previewGlyph}>▤</Text>
        <Text style={styles.previewTitle}>Your room preview will appear here</Text>
        <Text style={styles.signalDetail}>
          A display space built around {collection.name}, in a style you pick next.
        </Text>
      </View>

      <PrimaryButton
        label="Choose room style"
        onPress={() =>
          router.replace({ pathname: '/room/new', params: { collectionId: collection.id } })
        }
      />
      <SecondaryButton label="Cancel" onPress={() => router.back()} />

      <Text style={styles.footnote}>
        Generation is template-conditioned: the style you pick supplies fixed placement geometry and
        only the backdrop is generated. Nothing here calls a model during the demo (§12.1).
      </Text>
      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

/**
 * The four tiles, derived from the collection itself.
 *
 * Deterministic, like every other "AI" surface in this build (§12.1). The point
 * is that a player recognises their own collection in the description — a tile
 * reading "Legendary and Mythic items" when they own neither is worse than no
 * tile at all.
 */
function describeSignals(
  collection: Collection,
  items: readonly Item[],
  headline: Item | null,
): Signal[] {
  const titles = [...new Set(items.map((item) => item.title))];
  const tiers = [...new Set(items.map((item) => item.rarityTier))] as RarityTier[];
  const top = tiers
    .sort((a, b) => Object.keys(rarityColors).indexOf(b) - Object.keys(rarityColors).indexOf(a))
    .slice(0, 2);

  return [
    {
      glyph: '❖',
      label: 'Collection artwork',
      detail: headline ? `Led by ${headline.name}` : 'Key visuals from your items',
    },
    {
      glyph: '◑',
      label: 'Item colours',
      detail: top.length
        ? `${top.map((tier) => rarityLabelFor(tier, headline?.title ?? 'codm')).join(' and ')} tones`
        : 'Palette drawn from your items',
    },
    {
      glyph: '✦',
      label: 'Rarity',
      detail: `${items.filter((i) => i.rarityTier === 'mythic' || i.rarityTier === 'legendary').length} high-rarity of ${items.length}`,
    },
    {
      glyph: '◈',
      label: 'Games represented',
      detail: titles.length
        ? titles.map((title) => GAME_SHORT_LABELS[title]).join(', ')
        : 'No items yet',
    },
  ];
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },

  summary: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  summaryArt: { width: 84, height: 68 },
  summaryBody: { flex: 1, gap: 2, justifyContent: 'center' },
  summaryName: { ...typography.sectionHeader, color: colors.textPrimary },
  tags: { ...typography.meta, color: colors.accent },

  title: { ...typography.screenTitle, color: colors.textPrimary, marginTop: spacing.sm },
  body: { ...typography.body, color: colors.textSecondary },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },
  sectionLabel: { ...typography.sectionHeader, color: colors.textPrimary, marginTop: spacing.md },

  signalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  signal: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  signalGlyph: { fontSize: 20, color: colors.accent },
  signalLabel: { ...typography.cardTitle, color: colors.textPrimary },
  signalDetail: { ...typography.meta, color: colors.textSecondary },

  preview: {
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accentMuted,
    borderRadius: radius.card,
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },
  previewGlyph: { fontSize: 34, color: colors.accent },
  previewTitle: { ...typography.cardTitle, color: colors.textPrimary },
});
