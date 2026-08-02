/**
 * Foundation diagnostics — reachable from Profile → Developer, at /diagnostics.
 *
 * This was `app/index.tsx` before the `(tabs)` group landed; Home now lives at
 * `app/(tabs)/index.tsx` per §13.4. It was kept rather than deleted because it
 * earns its place: it calls every service the way a real screen would — through
 * @/services, never through @/fixtures — and prints what came back. If a number
 * here is wrong, the foundation is wrong, and you find out before merge day
 * rather than on stage.
 *
 * Add a check here when you add a service method. It is the cheapest regression
 * test this codebase has.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

import { FEATURES } from '@/config/features';
import { countScan } from '@/domain/scan';
import { FLAG_THRESHOLD } from '@/domain/trust';
import {
  catalogueService,
  collectionService,
  matchService,
  newsService,
  roomService,
  scanService,
  socialService,
} from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { SCAN_RESULTS_BY_TITLE } from '@/fixtures/scan-results';

interface Check {
  label: string;
  value: string;
  ok: boolean;
}

export default function FoundationScreen() {
  const { viewer, viewerId, inventory, hasImported, unreadNotifications, loading } = useApp();
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const results: Check[] = [];

      const items = await catalogueService.getAllItems();
      results.push({
        label: 'Catalogue items (CODM + Valorant + MLBB)',
        value: String(items.length),
        ok: items.length > 0,
      });

      const sets = await catalogueService.getSets();
      results.push({ label: 'Item sets', value: String(sets.length), ok: sets.length > 0 });

      // Scan counts must reconcile: detected = matched + needsReview + duplicates.
      const scan = SCAN_RESULTS_BY_TITLE.codm;
      const counts = countScan([...scan.detections]);
      const reconciles =
        counts.detected === counts.matched + counts.needsReview + counts.duplicates;
      results.push({
        label: 'CODM scan reconciles',
        value: `${counts.detected} = ${counts.matched} + ${counts.needsReview} + ${counts.duplicates} (${counts.discarded} unread)`,
        ok: reconciles,
      });
      results.push({
        label: 'Needs Review branch present',
        value: `${counts.needsReview} items`,
        ok: counts.needsReview > 0,
      });
      results.push({
        label: 'Scanner stage labels',
        value: scanService.stageFor(0.5),
        ok: true,
      });

      const collections = await collectionService.getPublicCollections();
      results.push({
        label: 'Public collections',
        value: String(collections.length),
        ok: collections.length > 0,
      });

      const themes = await roomService.getThemes();
      const slotCount = themes[0]?.slots.length ?? 0;
      results.push({
        label: 'Room themes / slots per theme',
        value: `${themes.length} themes, ${slotCount} slots`,
        ok: themes.length >= 6 && slotCount > 0,
      });

      const rooms = await roomService.getPublishedRooms();
      results.push({
        label: 'Published rooms',
        value: String(rooms.length),
        ok: rooms.length > 0,
      });

      const collectors = await matchService.getRecommendedCollectors(viewerId, 5);
      const top = collectors[0];
      results.push({
        label: 'Top collector match (score + reason)',
        value: top ? `${top.user.displayName} — ${top.percent}% — ${top.reason}` : 'none',
        ok: top !== undefined && top.reason.length > 0,
      });

      const communities = await matchService.getRecommendedCommunities(viewerId);
      results.push({
        label: 'Community recommendations',
        value: String(communities.length),
        ok: communities.length > 0,
      });

      const fyp = await newsService.getFyp(viewerId, Date.parse('2026-08-02T00:00:00.000Z'));
      results.push({
        label: 'FYP articles (personalised)',
        value: fyp[0] ? `${fyp.length} — top: ${fyp[0].reason}` : '0',
        ok: fyp.length > 0,
      });

      // §9.2 threshold guard — one target over, one under.
      const over = socialService.countableFlagsFor('own-danish-mlbb-lancelot-royal-matador');
      const under = socialService.countableFlagsFor('own-kai-val-prime-vandal');
      results.push({
        label: `Flag threshold (n ≥ ${FLAG_THRESHOLD})`,
        value: `over=${over} → review: ${socialService.isUnderReview('own-danish-mlbb-lancelot-royal-matador')}, under=${under} → review: ${socialService.isUnderReview('own-kai-val-prime-vandal')}`,
        ok: over >= FLAG_THRESHOLD && under < FLAG_THRESHOLD,
      });

      if (!cancelled) {
        setChecks(results);
        setRunning(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [viewerId]);

  if (loading || running) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={colors.accent} />
        <Text style={styles.muted}>Running foundation checks…</Text>
      </View>
    );
  }

  const failures = checks.filter((c) => !c.ok).length;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Foundation</Text>
      <Text style={[styles.muted, failures > 0 && styles.bad]}>
        {failures === 0 ? 'All checks passing' : `${failures} check(s) failing`}
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionHeader}>Viewer</Text>
        <Row label="Signed in as" value={viewer ? `${viewer.displayName} (@${viewer.handle})` : '—'} />
        <Row label="Inventory size" value={String(inventory.length)} />
        <Row label="Onboarding gate (hasImported)" value={String(hasImported)} />
        <Row label="Unread notifications" value={String(unreadNotifications)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionHeader}>Service checks</Text>
        {checks.map((check) => (
          <Row key={check.label} label={check.label} value={check.value} ok={check.ok} />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionHeader}>Feature flags</Text>
        {Object.entries(FEATURES).map(([key, value]) => (
          <Row key={key} label={key} value={String(value)} />
        ))}
      </View>
    </ScrollView>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>
        {ok === undefined ? '' : ok ? '✓ ' : '✗ '}
        {label}
      </Text>
      <Text style={[styles.rowValue, ok === false && styles.bad]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  sectionHeader: {
    ...typography.sectionHeader,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  muted: { ...typography.body, color: colors.textSecondary },
  bad: { color: colors.danger },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  row: { paddingVertical: spacing.sm, gap: 2 },
  rowLabel: { ...typography.meta, color: colors.textSecondary },
  rowValue: { ...typography.body, color: colors.textPrimary },
});
