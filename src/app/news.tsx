/**
 * J5 — News & gaming updates (PRD §10, §11 F6). Flow owner: Marcus.
 *
 * ⚠️ FIRST DESCOPE CANDIDATE (§14 rung 1). If this is cut, flip `FEATURES.news`
 * — the Home rail disappears cleanly and this route simply stops being linked.
 * Do not delete the code to descope.
 *
 * Two feeds, per §11 F6:
 *   - Discover — general news, newest first, no personalisation
 *   - FYP — ranked by followed games, followed topics AND owned items. A player
 *     who owns a skin for a character being reworked should see that patch note
 *     first, and the card says so.
 *
 * `now` is injected into the FYP ranking so the order cannot silently change
 * between rehearsal and the live run.
 */

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ArticleCard, EmptyState, FilterChips, LoadingState } from '@/components';
import { DEMO_NOW, FEATURES } from '@/config/features';
import type { RankedArticle } from '@/domain/news';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { newsService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, spacing, typography } from '@/theme/theme';
import type { Article } from '@/types';

const FEEDS = ['For you', 'Discover', 'Saved'] as const;
type Feed = (typeof FEEDS)[number];

export default function NewsScreen() {
  const router = useRouter();
  const { viewerId, unreadNotifications } = useApp();

  const [feed, setFeed] = useState<Feed>('For you');
  /** Switching feed replaces the whole list, so it reads as a new page. */
  const scrollRef = useTopOnFocus(feed);
  const [fyp, setFyp] = useState<RankedArticle[]>([]);
  const [discover, setDiscover] = useState<Article[]>([]);
  const [saved, setSaved] = useState<Article[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const [personalised, general, bookmarks] = await Promise.all([
      // DEMO_NOW, not Date.now(): the ranking takes a clock as an argument so it
      // stays deterministic, and reading the real one throws that away.
      newsService.getFyp(viewerId, DEMO_NOW),
      newsService.getDiscover(),
      newsService.getSaved(viewerId),
    ]);
    setFyp(personalised);
    setDiscover(general);
    setSaved(bookmarks);
    setBusy(false);
  }, [viewerId]);

  useEffect(() => {
    void load();
  }, [load]);

  const open = (id: string) => router.push({ pathname: '/article/[id]', params: { id } });

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}>
      {/*
        §11 F6 groups notifications and following management with the feeds, and
        this is the only route to either.

        TODO(Jovan): §13.4 puts the bell on Home and it currently opens /news.
        One-line href change in src/app/(tabs)/index.tsx — the unread dot it
        already renders is counting notifications nobody could open until now.
      */}
      <View style={styles.utilityRow}>
        <Pressable onPress={() => router.push('/notifications')} hitSlop={8}>
          <Text style={styles.utilityLink}>
            Notifications{unreadNotifications > 0 ? ` (${unreadNotifications})` : ''}
          </Text>
        </Pressable>
      </View>

      <FilterChips options={FEEDS} value={feed} onChange={setFeed} />

      {busy ? <LoadingState height={200} /> : null}

      {!busy && feed === 'For you' ? (
        <View style={styles.list}>
          <Text style={styles.footnote}>
            Ranked by the games you follow, the topics you follow, and the items you actually own.
          </Text>
          {fyp.map((entry) => (
            <ArticleCard
              key={entry.article.id}
              article={entry.article}
              reason={entry.reason}
              onPress={() => open(entry.article.id)}
            />
          ))}
        </View>
      ) : null}

      {!busy && feed === 'Discover' ? (
        <View style={styles.list}>
          {discover.map((article) => (
            <ArticleCard key={article.id} article={article} onPress={() => open(article.id)} />
          ))}
        </View>
      ) : null}

      {!busy && feed === 'Saved' ? (
        <View style={styles.list}>
          {saved.length === 0 ? (
            <EmptyState title="Nothing saved" body="Save an article and it lands here." />
          ) : (
            saved.map((article) => (
              <ArticleCard key={article.id} article={article} onPress={() => open(article.id)} />
            ))
          )}
        </View>
      ) : null}

      <Text style={styles.footnote}>
        Sources are official publisher channels and permitted RSS only. Summaries link out —
        Collectee never reproduces an article body (§11 F6).
        {FEATURES.liveSummarisation ? '' : ' Summaries are seeded for this build.'}
      </Text>

      <View style={{ height: spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  list: { gap: spacing.md },
  footnote: { ...typography.meta, color: colors.textTertiary },
  utilityRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg },
  utilityLink: { ...typography.meta, color: colors.accent },
});
