/**
 * J5 — News & gaming updates (PRD §10, §11 F6). Flow owner: Marcus.
 *
 * ⚠️ FIRST DESCOPE CANDIDATE (§14 rung 1). If this is cut, flip `FEATURES.news`
 * — the Home rail disappears cleanly and this route simply stops being linked.
 * Do not delete the code to descope.
 *
 * ONE TAB PER GAME, plus Saved. Each game opens with a digest of what is
 * happening in it, then that game's articles ranked by the same relevance the
 * FYP uses — owned items first, then followed topics, then recency (§11 F6).
 *
 * Why not the two chips §11 F6 names:
 *   - The FYP's ranking is not gone, it is partitioned. Every signal still
 *     applies inside each tab, and ownership reasons still print (§11 F5).
 *   - Discover — everything, newest first — is still on Home's news rail, which
 *     is where an unpersonalised list belongs. `newsService.getDiscover` and
 *     `getFyp` both still have callers; nothing here deleted a feed.
 *   - Five or six chips would have been a worse version of the clutter this
 *     replaces. Three games as peers is also the clearer read of the cross-game
 *     premise in a four-minute demo.
 *
 * `now` is injected into the ranking so the order cannot silently change
 * between rehearsal and the live run.
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ArticleCard, EmptyState, FilterChips, LoadingState } from '@/components';
import { DEMO_NOW, FEATURES } from '@/config/features';
import type { RankedArticle } from '@/domain/news';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { newsService } from '@/services';
import type { DigestResult } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { GAME_LABELS, GAME_SHORT_LABELS, GAME_TITLES } from '@/types';
import type { Article, GameTitle } from '@/types';

const SAVED_TAB = 'Saved';

/** Short labels, not raw titles — 'CODM', never 'codm' (§12.2's rule, applied). */
const TABS: readonly string[] = [
  ...GAME_TITLES.map((title) => GAME_SHORT_LABELS[title]),
  SAVED_TAB,
];

const TITLE_BY_TAB = new Map<string, GameTitle>(
  GAME_TITLES.map((title) => [GAME_SHORT_LABELS[title], title]),
);

/**
 * "What's happening in <game>" (§11 F6).
 *
 * The label is driven by the actual call result, never by the feature flag: a
 * flag that is on but timed out must still say "prepared", or the one honest
 * claim this build makes about AI stops being true (§12.1).
 */
function DigestCard({ title, digest }: { title: GameTitle; digest: DigestResult }) {
  if (digest.bullets.length === 0) return null;

  return (
    <View style={styles.digest}>
      <Text style={styles.digestTitle}>What&apos;s happening in {GAME_LABELS[title]}</Text>
      {digest.bullets.map((bullet) => (
        <View key={bullet} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{bullet}</Text>
        </View>
      ))}
      <Text style={styles.footnote}>
        {digest.live
          ? 'Digest by Claude, from the articles below.'
          : 'Prepared digest — no model call ran (§12.1).'}
      </Text>
    </View>
  );
}

export default function NewsScreen() {
  const router = useRouter();
  const { viewerId, unreadNotifications } = useApp();

  const [tab, setTab] = useState<string>(TABS[0]);
  /** Switching tab replaces the whole page, so it reads as a new one. */
  const scrollRef = useTopOnFocus(tab);
  const [feed, setFeed] = useState<RankedArticle[]>([]);
  /**
   * Tagged with the game it is for. The digest resolves on its own schedule —
   * up to the full 5s timeout on the live path — so a tab switch mid-flight
   * would otherwise land CODM's bullets under the MLBB heading.
   */
  const [digest, setDigest] = useState<{ title: GameTitle; result: DigestResult } | null>(null);
  const [saved, setSaved] = useState<Article[]>([]);
  const [busy, setBusy] = useState(true);

  const title = TITLE_BY_TAB.get(tab) ?? null;

  const load = useCallback(async () => {
    setBusy(true);

    if (title === null) {
      setSaved(await newsService.getSaved(viewerId));
      setBusy(false);
      return;
    }

    // The digest is not awaited alongside the feed: it can take the full 5s
    // timeout when the live path is on, and holding the articles hostage to it
    // would make a working feed look broken.
    setDigest(null);
    void newsService.getDigest(title).then((result) => setDigest({ title, result }));

    // DEMO_NOW, not Date.now(): the ranking takes a clock as an argument so it
    // stays deterministic, and reading the real one throws that away.
    setFeed(await newsService.getGameFeed(viewerId, title, DEMO_NOW));
    setBusy(false);
  }, [viewerId, title]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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
        <Pressable onPress={() => router.push('/following')} hitSlop={8}>
          <Text style={styles.utilityLink}>Following</Text>
        </Pressable>
      </View>

      <FilterChips options={TABS} value={tab} onChange={setTab} />

      {title !== null ? (
        digest?.title === title ? (
          <DigestCard title={title} digest={digest.result} />
        ) : (
          <LoadingState height={120} />
        )
      ) : null}

      {busy ? <LoadingState height={200} /> : null}

      {!busy && title !== null ? (
        <View style={styles.list}>
          <Text style={styles.footnote}>
            Ranked by the topics you follow and the items you actually own.
          </Text>
          {feed.map((entry) => (
            <ArticleCard
              key={entry.article.id}
              article={entry.article}
              reason={entry.reason}
              onPress={() => open(entry.article.id)}
            />
          ))}
        </View>
      ) : null}

      {!busy && title === null ? (
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
        {FEATURES.liveSummarisation ? '' : ' Summaries and digests are seeded for this build.'}
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

  digest: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  digestTitle: { ...typography.cardTitle, color: colors.textPrimary },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
  bulletDot: { ...typography.body, color: colors.accent },
  bulletText: { ...typography.body, color: colors.textSecondary, flex: 1 },
});
