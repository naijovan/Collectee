/**
 * Article view with the AI summary toggle (§11 F6).
 *
 * Two constraints, both non-negotiable:
 *
 * 1. **Collectee never reproduces an article body.** The summary links out.
 *    This is a legal requirement and, per §11 F6, "the difference between a
 *    partner and a scraper". There is deliberately no full-text view here — do
 *    not add one.
 *
 * 2. **Do not imply a model ran when it did not.** `newsService.summarise()` is
 *    the single place §12.1 proposed a real call (~2 hours, decide by 5 Aug).
 *    Until `FEATURES.liveSummarisation` is on, the label below says the summary
 *    is prepared. That honesty is the whole point of the flag.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { LoadingState, SecondaryButton } from '@/components';
import { timeAgo } from '@/components';
import { FEATURES } from '@/config/features';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { newsService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { GAME_LABELS } from '@/types';
import type { Article } from '@/types';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { viewerId } = useApp();

  const scrollRef = useTopOnFocus();

  const [article, setArticle] = useState<Article | null>(null);
  const [summary, setSummary] = useState<string[] | null>(null);
  const [summarising, setSummarising] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const [found, bookmarks] = await Promise.all([
      newsService.getArticle(id),
      newsService.getSaved(viewerId),
    ]);
    setArticle(found);
    setSaved(bookmarks.some((entry) => entry.id === id));
    setBusy(false);
  }, [id, viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function summarise() {
    if (summary) {
      setSummary(null);
      return;
    }
    setSummarising(true);
    setSummary(await newsService.summarise(id));
    setSummarising(false);
  }

  if (busy) {
    return (
      <View style={[styles.screen, styles.content]}>
        <LoadingState height={200} />
      </View>
    );
  }

  if (!article) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.title}>Article not found</Text>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.overline}>
        {article.sourceTitle} · {timeAgo(article.publishedAt)}
      </Text>
      <Text style={styles.title}>{article.title}</Text>

      <View style={styles.tagRow}>
        {article.relatedGames.map((title) => (
          <View key={title} style={styles.tag}>
            <Text style={styles.tagText}>{GAME_LABELS[title]}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.body}>{article.summary}</Text>

      <Pressable onPress={() => void summarise()} style={styles.summaryButton}>
        <Text style={styles.summaryButtonText}>
          {summary ? 'Hide AI summary' : 'Summarise with AI'}
        </Text>
      </Pressable>

      {summarising ? <LoadingState height={90} /> : null}

      {summary ? (
        <View style={styles.summaryCard}>
          {summary.map((line) => (
            <Text key={line} style={styles.bullet}>
              • {line}
            </Text>
          ))}
          <Text style={styles.footnote}>
            {FEATURES.liveSummarisation
              ? 'Generated live by a text model.'
              : 'Prepared summary — no model call runs in this build (§12.1).'}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <SecondaryButton
          label={saved ? 'Saved' : 'Save'}
          onPress={async () => setSaved(await newsService.toggleSaved(viewerId, article.id))}
        />
      </View>

      <View style={styles.sourceCard}>
        <Text style={styles.rowTitle}>Read the full article at the source</Text>
        <Text style={styles.muted}>{article.url}</Text>
        <Text style={styles.footnote}>
          Collectee links out rather than reproducing the body — official channels and permitted RSS
          only.
        </Text>
      </View>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.md },

  overline: { ...typography.meta, color: colors.accent },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    backgroundColor: colors.accentMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  tagText: { ...typography.meta, fontSize: 10, color: colors.accent },

  summaryButton: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  summaryButtonText: { ...typography.cardTitle, color: colors.accent },

  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bullet: { ...typography.body, color: colors.textPrimary },

  actions: { flexDirection: 'row', gap: spacing.md },

  sourceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
});
