/**
 * Full inventory — everything the viewer owns, filterable.
 *
 * Profile carries a four-item preview; this is the "view all" behind it. The
 * split exists because Profile is an identity page — collections, showrooms,
 * a taste of what you own — and 40+ item cards inline turn it into a list
 * screen that nobody scrolls past.
 *
 * ── Filters ───────────────────────────────────────────────────────────────
 * Three dimensions, because they answer three different questions:
 *   rarity   "what are my best items"
 *   game     "what do I own in this title"
 *   trust    "what can go in a showroom" (§9.4) — the one that gates a feature
 *
 * They compose: MLBB + Verified + Collector is a legitimate query and the one
 * a user runs when a showroom is short of items. Combining them means the
 * filter state is three independent values rather than one enum, which is also
 * why this is not the tab's single-select `FilterChips` row.
 *
 * Grouping stays by rarity even when a rarity filter is on: it keeps the tier
 * headers and counts stable, so turning a filter on narrows the page rather
 * than reorganising it.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ASSISTANT_CLEARANCE, ItemCard, SectionHeader } from '@/components';
import { groupByRarity, rarityLabelFor, RARITY_RANK } from '@/domain/rarity';
import { useApp } from '@/state/AppContext';
import { colors, radius, rarityColors, spacing, typography } from '@/theme/theme';
import { GAME_SHORT_LABELS } from '@/types';
import type { GameTitle, RarityTier } from '@/types';

const RARITY_OPTIONS: readonly RarityTier[] = [
  'mythic',
  'legendary',
  'epic',
  'rare',
  'common',
];
const GAME_OPTIONS: readonly GameTitle[] = ['codm', 'valorant', 'mlbb'];
const TRUST_OPTIONS = ['Verified', 'Unverified'] as const;
type TrustOption = (typeof TRUST_OPTIONS)[number];

export default function InventoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { inventory } = useApp();

  const [open, setOpen] = useState(false);
  const [rarity, setRarity] = useState<RarityTier | null>(null);
  const [game, setGame] = useState<GameTitle | null>(null);
  const [trust, setTrust] = useState<TrustOption | null>(null);

  const activeCount = [rarity, game, trust].filter(Boolean).length;

  const filtered = useMemo(
    () =>
      inventory.filter((entry) => {
        if (rarity && entry.item.rarityTier !== rarity) return false;
        if (game && entry.item.title !== game) return false;
        if (trust === 'Verified' && entry.owned.trustLevel !== 'verified') return false;
        if (trust === 'Unverified' && entry.owned.trustLevel === 'verified') return false;
        return true;
      }),
    [inventory, rarity, game, trust],
  );

  /**
   * Grouped on the joined rows, not on catalogue items.
   *
   * `groupByRarity` takes anything with a `rarityTier`, so passing the whole
   * `{ owned, item }` view keeps the trust level attached — mapping to `item`
   * first threw away the half the card needs to show verified or unverified.
   */
  const groups = useMemo(
    () =>
      groupByRarity(
        filtered.map((entry) => ({ ...entry, rarityTier: entry.item.rarityTier })),
      ).sort((a, b) => RARITY_RANK[b.tier] - RARITY_RANK[a.tier]),
    [filtered],
  );

  const verifiedCount = filtered.filter(
    (entry) => entry.owned.trustLevel === 'verified',
  ).length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + ASSISTANT_CLEARANCE }]}
    >
      {/* The toggle sits beside the title rather than as a full-width bar under
          it. The page is the inventory; the controls should take a corner, not
          a row. A dot marks active filters so the state is legible closed. */}
      <View style={styles.titleRow}>
        <View style={styles.rowBody}>
          <Text style={styles.title}>Your inventory</Text>
          <Text style={styles.muted}>
            {filtered.length} of {inventory.length} items · {verifiedCount} verified
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? 'Hide filters' : 'Show filters'}
          hitSlop={10}
          onPress={() => setOpen((prev) => !prev)}
          style={({ pressed }) => [
            styles.filterIcon,
            (open || activeCount > 0) && styles.filterIconActive,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.filterGlyph}>⚙</Text>
          {activeCount > 0 ? <View style={styles.filterDot} /> : null}
        </Pressable>
      </View>

      {open ? (
        <View style={styles.filterPanel}>
          <FilterRow
            label="Rarity"
            options={RARITY_OPTIONS}
            value={rarity}
            onChange={setRarity}
            render={(tier) => rarityLabelFor(tier, 'codm')}
            tint={(tier) => rarityColors[tier]}
          />
          <FilterRow
            label="Game"
            options={GAME_OPTIONS}
            value={game}
            onChange={setGame}
            render={(title) => GAME_SHORT_LABELS[title]}
          />
          <FilterRow
            label="Trust"
            options={TRUST_OPTIONS}
            value={trust}
            onChange={setTrust}
            render={(option) => option}
          />
          {activeCount > 0 ? (
            <Pressable
              onPress={() => {
                setRarity(null);
                setGame(null);
                setTrust(null);
              }}
              hitSlop={8}
            >
              <Text style={styles.clear}>Clear all filters</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.muted}>Nothing matches those filters.</Text>
          <Pressable
            onPress={() => {
              setRarity(null);
              setGame(null);
              setTrust(null);
            }}
            hitSlop={8}
          >
            <Text style={styles.clear}>Clear all filters</Text>
          </Pressable>
        </View>
      ) : (
        groups.map((group) => (
          <View key={group.tier}>
            <View style={styles.tierHeader}>
              <View style={[styles.tierDot, { backgroundColor: rarityColors[group.tier] }]} />
              <Text style={styles.tierName}>
                {rarityLabelFor(group.tier, group.items[0]!.item.title)}
              </Text>
              <Text style={styles.muted}>{group.items.length}</Text>
            </View>
            <View style={styles.grid}>
              {group.items.map((entry) => (
                <ItemCard
                  key={entry.item.id}
                  item={entry.item}
                  /* This is the screen where trust is the point — the filters
                     above sort on it and §9.4 makes it decide what can enter a
                     Showroom. Every card says which it is. */
                  trustLevel={entry.owned.trustLevel}
                  width={width < 600 ? '47%' : '30%'}
                />
              ))}
            </View>
          </View>
        ))
      )}

      <SectionHeader title="Showrooms" />
      <Text style={styles.muted}>
        Only verified items can be placed in a showroom (§9.4). Unverified ones stay in 2D
        collections — filter by Trust above to see which is which.
      </Text>
      <Pressable style={styles.link} onPress={() => router.push('/link-account')}>
        <Text style={styles.linkText}>Connect a game account to verify more ›</Text>
      </Pressable>
    </ScrollView>
  );
}

/**
 * One filter dimension. Tapping the active option clears it, so every row can
 * return to "no filter" without a separate All chip taking up space.
 */
function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
  render,
  tint,
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (next: T | null) => void;
  render: (option: T) => string;
  tint?: (option: T) => string;
}) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((option) => {
          const active = value === option;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(active ? null : option)}
              style={[styles.chip, active && styles.chipActive]}
            >
              {tint ? <View style={[styles.chipDot, { backgroundColor: tint(option) }]} /> : null}
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {render(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },

  title: { ...typography.screenTitle, color: colors.textPrimary },
  muted: { ...typography.meta, color: colors.textSecondary },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  rowBody: { flex: 1, minWidth: 0 },
  filterIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterIconActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  filterGlyph: { color: colors.textPrimary, fontSize: 17, lineHeight: 20 },
  /** Marks active filters while the panel is closed. */
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },

  filterPanel: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterRow: { gap: spacing.xs },
  filterLabel: { ...typography.meta, color: colors.textTertiary },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  chipDot: { width: 8, height: 8, borderRadius: radius.pill },
  chipText: { ...typography.meta, fontSize: 11, color: colors.textSecondary },
  chipTextActive: { color: colors.accent },
  clear: { ...typography.meta, color: colors.accent },

  empty: { gap: spacing.xs, paddingVertical: spacing.xl, alignItems: 'center' },

  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  tierDot: { width: 8, height: 8, borderRadius: radius.pill },
  tierName: { ...typography.cardTitle, color: colors.textPrimary, flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },

  link: { paddingVertical: spacing.sm },
  linkText: { ...typography.meta, color: colors.accent },
});
