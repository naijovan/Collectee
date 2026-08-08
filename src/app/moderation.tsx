/**
 * Review queue — PRD §9.2, and the concrete answer to §8.2.
 *
 * "Safer and more inclusive communities" is an explicit judging theme, and until
 * now the whole trust model was services with no screen: flags were raised into
 * a queue nobody could open. This is that queue.
 *
 * Two rules it exists to make visible:
 *
 *   1. **Flags never auto-remove.** Crossing a threshold costs discovery
 *      ranking and opens a review — it does not delete anything. Every entry
 *      here is still live in the product while it waits.
 *   2. **The threshold guard.** Ownership disputes need three reports from
 *      accounts with verified items of their own, because an unguarded flag
 *      button in a competitive community becomes a weapon. Content reports need
 *      two from anyone, because requiring verified items to report harassment
 *      would gate safety behind a partnership (§9.3) that does not exist yet.
 *
 * Both kinds share this queue on purpose: one moderation surface, two rules,
 * each shown with the count that got it here.
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { EmptyState, LoadingState, SecondaryButton } from '@/components';
import { timeAgo } from '@/components';
import {
  CONTENT_REPORT_THRESHOLD,
  FLAG_REASON_LABELS,
  FLAG_THRESHOLD,
  isOwnershipReason,
} from '@/domain/trust';
import { socialService } from '@/services';
import type { ReviewQueueEntry } from '@/services';
import { colors, radius, spacing, typography } from '@/theme/theme';

export default function ModerationScreen() {
  const [queue, setQueue] = useState<ReviewQueueEntry[]>([]);
  const [busy, setBusy] = useState(true);
  const [resolved, setResolved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setQueue(await socialService.getReviewQueue());
    setBusy(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function resolve(targetId: string, status: 'upheld' | 'dismissed') {
    const count = await socialService.resolveReports(targetId, status);
    setResolved(`${count} report${count === 1 ? '' : 's'} ${status}`);
    await load();
  }

  if (busy) {
    return (
      <View style={[styles.screen, styles.content]}>
        <LoadingState height={220} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.body}>
        Reported content stays live while it waits here — a flag is a claim, not a takedown (§9.2).
        Ownership disputes need {FLAG_THRESHOLD} reports from collectors with verified items;
        harassment and spam need {CONTENT_REPORT_THRESHOLD} from anyone.
      </Text>

      {resolved ? <Text style={styles.resolved}>{resolved}</Text> : null}

      {queue.length === 0 ? (
        <EmptyState
          title="Nothing to review"
          body="No report has crossed its threshold. Flags below the threshold stay invisible here on purpose — that is the guard working."
        />
      ) : null}

      {queue.map((entry) => {
        const reasons = [...new Set(entry.flags.map((f) => f.reason))];
        const ownershipCase = reasons.some(isOwnershipReason);
        const counter = ownershipCase ? entry.state.ownership : entry.state.content;

        return (
          <View key={entry.targetId} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.kind}>{entry.targetType.toUpperCase()}</Text>
              {/*
                Once upheld, the live count is zero — resolving the reports is
                what closes them — so printing "0 of 3 reports" next to a
                suppressed target reads as though nothing was wrong.
              */}
              <Text style={styles.count}>
                {entry.state.upheld
                  ? 'Upheld · still suppressed'
                  : `${counter.countable} of ${counter.threshold} reports${ownershipCase ? ' · verified reporters only' : ''}`}
              </Text>
            </View>

            <Text style={styles.title}>{entry.preview.title}</Text>
            {entry.preview.body ? <Text style={styles.quote}>{entry.preview.body}</Text> : null}
            {entry.preview.authorName ? (
              <Text style={styles.muted}>Claimed by {entry.preview.authorName}</Text>
            ) : null}

            <View style={styles.reasonRow}>
              {reasons.map((reason) => (
                <View key={reason} style={styles.reasonChip}>
                  <Text style={styles.reasonText}>{FLAG_REASON_LABELS[reason]}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.footnote}>
              Oldest report {timeAgo(entry.flags[0]!.createdAt)} · {entry.flags.length} total
              {entry.state.upheld ? ' · upheld, still suppressed' : ''}
            </Text>

            {entry.state.upheld ? null : (
              <View style={styles.actions}>
                <View style={styles.action}>
                  <SecondaryButton
                    label="Uphold"
                    onPress={() => void resolve(entry.targetId, 'upheld')}
                  />
                </View>
                <View style={styles.action}>
                  <SecondaryButton
                    label="Dismiss"
                    onPress={() => void resolve(entry.targetId, 'dismissed')}
                  />
                </View>
              </View>
            )}
          </View>
        );
      })}

      <Text style={styles.footnote}>
        Upholding keeps the target out of discovery; dismissing returns it. Neither deletes
        anything — removal is a separate path with a human in it, and nothing in the demo does it.
      </Text>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, gap: spacing.md },

  body: { ...typography.body, color: colors.textSecondary },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },
  resolved: { ...typography.meta, color: colors.success },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.warning,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { ...typography.meta, fontSize: 10, color: colors.warning, letterSpacing: 0.5 },
  count: { ...typography.meta, color: colors.textSecondary },
  title: { ...typography.cardTitle, color: colors.textPrimary },
  quote: { ...typography.body, color: colors.textSecondary, fontStyle: 'italic' },

  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reasonChip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
  },
  reasonText: { ...typography.meta, fontSize: 10, color: colors.textSecondary },

  actions: { flexDirection: 'row', gap: spacing.md },
  action: { flex: 1 },
});
