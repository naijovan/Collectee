/**
 * Connect a game account — the mocked OAuth screen from PRD §9.3.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  THIS IS THE ONLY PATH TO A VERIFIED ITEM.                          │
 * │  A scan never produces one (§11 F1 step 6): a screenshot proves     │
 * │  nothing about who owns the item it depicts, which is the argument  │
 * │  §9.1 settled when SHA-256 hashing was dropped.                     │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ⚠️ It is mocked, and the screen says so on screen rather than in a comment.
 * §9.3: real linking is PARTNERSHIP-gated, not engineering-gated — none of the
 * three launch titles exposes a public cosmetic-inventory API, so Verified needs
 * a publisher agreement rather than a sprint. Do not imply otherwise here or on
 * stage.
 *
 * Why it exists in J4's scope: since the 3 Aug decision, matching counts
 * verified items only, so without a way to verify, Discover cannot move and the
 * import → verify → Discover chain has no middle step.
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { LoadingState, PrimaryButton, SecondaryButton } from '@/components';
import { FEATURES } from '@/config/features';
import { inventoryService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { GAME_LABELS, GAME_TITLES } from '@/types';
import type { GameTitle, LinkStatus } from '@/types';

interface TitleRow {
  title: GameTitle;
  status: LinkStatus;
  handle: string | null;
  owned: number;
  verified: number;
}

/** §14 rung 5: with the third title cut, MLBB is "coming soon" and not linkable. */
const LINKABLE_TITLES = GAME_TITLES.filter((t) => FEATURES.thirdTitle || t !== 'mlbb');

export default function LinkAccountScreen() {
  const router = useRouter();
  const { viewerId, refreshInventory } = useApp();

  const [rows, setRows] = useState<TitleRow[]>([]);
  const [selected, setSelected] = useState<GameTitle | null>(null);
  const [progress, setProgress] = useState(0);
  const [linking, setLinking] = useState(false);
  const [result, setResult] = useState<{ title: GameTitle; verified: number } | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(() => {
    const accounts = inventoryService.getGameAccounts(viewerId);
    setRows(
      LINKABLE_TITLES.map((title) => {
        const owned = inventoryService.itemsForTitle(viewerId, title);
        return {
          title,
          status: inventoryService.getLinkStatus(viewerId, title),
          handle: accounts.find((a) => a.title === title)?.externalHandle ?? null,
          owned: owned.length,
          verified: owned.filter((o) => o.trustLevel === 'verified').length,
        };
      }),
    );
    setBusy(false);
  }, [viewerId]);

  useFocusEffect(useCallback(() => load(), [load]));

  async function link(title: GameTitle) {
    setLinking(true);
    setProgress(0);
    const outcome = await inventoryService.linkAccount(viewerId, title, setProgress);
    // Every screen reading the viewer's inventory has to see the new trust
    // levels, not just this one.
    await refreshInventory();
    setResult({ title, verified: outcome.verified.length });
    setLinking(false);
    load();
  }

  async function unlink(title: GameTitle) {
    await inventoryService.unlinkAccount(viewerId, title);
    await refreshInventory();
    setResult(null);
    load();
  }

  if (busy) {
    return (
      <View style={[styles.screen, styles.content]}>
        <LoadingState height={200} />
      </View>
    );
  }

  const pending = rows.find((row) => row.title === selected);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.body}>
        Linking reads your in-game inventory and confirms what you actually own. Confirmed items
        become <Text style={styles.strong}>verified</Text>, and only verified items count towards
        collector and community matching.
      </Text>

      {rows.map((row) => {
        const isSelected = selected === row.title;
        const linked = row.status === 'linked';
        return (
          <Pressable
            key={row.title}
            onPress={() => setSelected(isSelected ? null : row.title)}
            style={[styles.row, isSelected && styles.rowActive]}
          >
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{GAME_LABELS[row.title]}</Text>
              <Text style={styles.muted}>
                {row.verified} of {row.owned} items verified
              </Text>
              <Text style={styles.footnote}>
                {linked ? `Connected as ${row.handle ?? '—'}` : 'Not connected'}
              </Text>
            </View>
            <View style={[styles.pill, linked && styles.pillLinked]}>
              <Text style={[styles.pillText, linked && styles.pillTextLinked]}>
                {linked ? 'Linked' : 'Unlinked'}
              </Text>
            </View>
          </Pressable>
        );
      })}

      {linking ? (
        <View style={styles.block}>
          <Text style={styles.stage}>Reading your inventory…</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
        </View>
      ) : null}

      {pending && !linking ? (
        <View style={styles.block}>
          {/*
            Re-sync is not a euphemism for "link again": a linked account only
            confirmed what existed when it was last read, so items scanned since
            are still unverified. That is the viewer's seeded CODM state.
          */}
          <PrimaryButton
            label={
              pending.status === 'linked'
                ? `Re-sync ${pending.verified === pending.owned ? 'account' : `${pending.owned - pending.verified} unverified items`}`
                : `Connect ${GAME_LABELS[pending.title]}`
            }
            disabled={pending.owned === 0}
            onPress={() => void link(pending.title)}
          />
          {pending.status === 'linked' ? (
            <SecondaryButton
              label="Disconnect (rehearsal reset)"
              onPress={() => void unlink(pending.title)}
            />
          ) : null}
        </View>
      ) : null}

      {result ? (
        <View style={styles.resultCard}>
          <Text style={styles.rowTitle}>
            {result.verified} {result.verified === 1 ? 'item' : 'items'} verified
          </Text>
          <Text style={styles.muted}>
            {result.verified > 0
              ? 'Your matches have been recalculated — verified items are the only ones that count.'
              : 'Everything on this account was already verified, so no scores changed.'}
          </Text>
          <PrimaryButton label="See who you match with" onPress={() => router.navigate('/explore')} />
        </View>
      ) : null}

      <View style={styles.honesty}>
        <Text style={styles.footnote}>
          This OAuth flow is mocked (§12.1). No publisher API is called and no credentials are
          collected. None of the three launch titles exposes a public cosmetic-inventory API, so a
          real Verified tier is partnership-gated — a publisher agreement, not a sprint (§9.3). Say
          that plainly if asked.
        </Text>
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, gap: spacing.md },
  block: { gap: spacing.md },

  body: { ...typography.body, color: colors.textSecondary },
  strong: { color: colors.textPrimary },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowActive: { borderColor: colors.accent },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },

  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillLinked: { borderColor: colors.success },
  pillText: { ...typography.meta, fontSize: 10, color: colors.textTertiary },
  pillTextLinked: { color: colors.success },

  stage: { ...typography.sectionHeader, color: colors.textPrimary },
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.surface },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.accent },

  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.success,
    padding: spacing.lg,
    gap: spacing.sm,
  },

  honesty: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.sm,
  },
});
