/**
 * Article view with the AI summary toggle (§11 F6).
 *
 * Two constraints, both non-negotiable:
 *
 * 1. **Collectee never reproduces THE PUBLISHER'S article body.** This is a
 *    legal requirement and, per §11 F6, "the difference between a partner and a
 *    scraper".
 *
 *    This note used to end "there is deliberately no full-text view here — do
 *    not add one", and the screen now renders one, so the distinction has to be
 *    stated precisely rather than left as a blanket ban.
 *
 *    What is rendered is `Article.body`: COLLECTEE'S OWN write-up of a real
 *    happening, written for the seed, of which `summary` was always the first
 *    sentence. It is the same authorship as everything else in the fixture. The
 *    rule that must not be broken is about whose words they are, not about how
 *    many of them there are — and the source card below still sends the reader
 *    to the publisher for the original.
 *
 *    So: never paste a publisher's text into `body`. If a future phase ingests
 *    real feeds, `body` takes the feed's own excerpt or stays empty.
 *
 * 2. **Do not imply a model ran when it did not.** `newsService.summarise()` is
 *    the single place §12.1 proposed a real call (~2 hours, decide by 5 Aug).
 *    Until `FEATURES.liveSummarisation` is on, the label below says the summary
 *    is prepared. That honesty is the whole point of the flag.
 */

import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ASSISTANT_CLEARANCE, ItemArt, LoadingState, PrimaryButton, SecondaryButton } from '@/components';
import { timeAgo } from '@/components';
import { FEATURES } from '@/config/features';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { catalogueService, newsService } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, radius, spacing, typography } from '@/theme/theme';
import { GAME_LABELS } from '@/types';
import type { SummaryResult } from '@/services';
import type { Article, ArticleBlock, Item } from '@/types';

/**
 * The write-up, rendered identically on the detail screen and in the full read.
 *
 * One component rather than two, deliberately: the two views would drift
 * otherwise, and the whole point of the full read is that it is the SAME
 * article given the whole screen. Nothing here knows which one it is in.
 */
function ArticleBody({
  blocks,
  items,
}: {
  blocks: readonly ArticleBlock[];
  items: ReadonlyMap<string, Item>;
}) {
  return (
    <>
      {blocks.map((block, index) => {
        /* Index keys are safe here and only here: a fixture body is static, so
           the list never reorders, filters or grows. */
        if (block.kind === 'heading') {
          return (
            <Text key={index} style={styles.bodyHeading}>
              {block.text}
            </Text>
          );
        }
        if (block.kind === 'image') {
          const item = items.get(block.itemId);
          /* No item, no figure. The id is guarded by validate-fixtures, so this
             is the loading frame rather than a real absence — and a caption
             floating under nothing reads worse than a missing picture. */
          if (!item) return null;
          return (
            <View key={index} style={styles.figure}>
              <ItemArt
                seed={item.id}
                tier={item.rarityTier}
                renderUrl={item.renderUrl}
                style={styles.figureImage}
              />
              <Text style={styles.figureCaption}>{block.caption}</Text>
            </View>
          );
        }
        return (
          <Text key={index} style={styles.body}>
            {block.text}
          </Text>
        );
      })}
    </>
  );
}

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { viewerId } = useApp();

  const scrollRef = useTopOnFocus();

  const [article, setArticle] = useState<Article | null>(null);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [summarising, setSummarising] = useState(false);
  const [saved, setSaved] = useState(false);
  /* Items referenced by inline figures, resolved through the service like
     everything else — the screen never reaches into the catalogue fixture. */
  const [items, setItems] = useState<ReadonlyMap<string, Item>>(new Map());
  /* Whether the full read is open. Screen state, so the modal shares this
     component's article, summary and saved state rather than refetching. */
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    const [found, bookmarks, catalogue] = await Promise.all([
      newsService.getArticle(id),
      newsService.getSaved(viewerId),
      catalogueService.getCatalogueMap(),
    ]);
    setArticle(found);
    setItems(catalogue);
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

      {/* The standfirst. With a full write-up below it this is the lede; on a
          summary-only article it is still the whole thing. */}
      <Text style={[styles.body, article.body ? styles.lede : null]}>{article.summary}</Text>

      {/*
        A TASTE of the write-up, not all of it.

        The body used to render in full here. With a full read behind a button
        that would mean reading the article, then being offered a button to read
        the article — so this screen keeps the lede above and the first
        paragraph, and the button opens the rest. That is also the shape a
        reader expects from a news app.

        Articles with no body show the summary and the source card, exactly as
        they always did, and get no button.
      */}
      {article.body ? <ArticleBody blocks={article.body.slice(0, 1)} items={items} /> : null}

      {/* Only offered when there is a body to open — a button that leads to an
          empty screen is worse than no button. */}
      {article.body ? (
        <PrimaryButton label="Read full article" onPress={() => setReading(true)} />
      ) : null}

      <Pressable onPress={() => void summarise()} style={styles.summaryButton}>
        <Text style={styles.summaryButtonText}>
          {summary ? 'Hide AI summary' : 'Summarise with AI'}
        </Text>
      </Pressable>

      {summarising ? <LoadingState height={90} /> : null}

      {summary ? (
        <View style={styles.summaryCard}>
          {summary.bullets.map((line) => (
            <Text key={line} style={styles.bullet}>
              • {line}
            </Text>
          ))}
          {/*
            The label follows what actually happened on THIS call, not what the
            flag hoped for. With the flag on, a timeout or an unreachable
            endpoint falls back to the prepared summary — and says so, rather
            than claiming a model ran (§12.1: do not imply a model is running
            when it is not).
          */}
          <Text style={styles.footnote}>
            {summary.live
              ? 'Summarised by Claude.'
              : 'Prepared summary — no model call ran (§12.1).'}
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
        {/* Reworded when full write-ups landed. The old line said Collectee
            does not reproduce "the body", which stopped being precise the
            moment this screen rendered one of our own. What has not changed is
            the rule it was protecting. */}
        <Text style={styles.footnote}>
          The write-up above is Collectee&apos;s own. We link out rather than reproducing the
          publisher&apos;s article — official channels and permitted RSS only.
        </Text>
      </View>

      {/*
        ── THE IN-APP FULL READ ────────────────────────────────────────────
        A full-screen Modal inside this screen rather than its own route, and
        that is the load-bearing choice: Summarise and Save have to keep working
        from in here, and as a child of this component the modal reads the SAME
        `summary`, `summarising` and `saved` state. A separate route would have
        re-fetched the article, duplicated the summarise call and been able to
        drift out of sync with the toggle behind it — summarising in one place
        and not the other is exactly the bug that would ship.

        `animationType="fade"` and `presentationStyle="fullScreen"` match the 3D
        viewer, which is the app's only other full-screen modal.
      */}
      {article.body ? (
        <Modal
          visible={reading}
          animationType="fade"
          presentationStyle="fullScreen"
          onRequestClose={() => setReading(false)}
        >
          <View style={styles.readerScreen}>
            <View style={styles.readerBar}>
              <Pressable
                onPress={() => setReading(false)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close the article"
                style={styles.readerClose}
              >
                <Text style={styles.readerCloseText}>‹ Back</Text>
              </Pressable>
              {/* Save lives in the bar so it is reachable without scrolling to
                  the end of a long read. Same state as the button behind. */}
              <SecondaryButton
                label={saved ? 'Saved' : 'Save'}
                onPress={async () => setSaved(await newsService.toggleSaved(viewerId, article.id))}
              />
            </View>

            <ScrollView contentContainerStyle={styles.readerContent}>
              <Text style={styles.overline}>
                {article.sourceTitle} · {timeAgo(article.publishedAt)}
              </Text>
              <Text style={styles.title}>{article.title}</Text>
              <Text style={[styles.body, styles.lede]}>{article.summary}</Text>

              <ArticleBody blocks={article.body} items={items} />

              <Pressable onPress={() => void summarise()} style={styles.summaryButton}>
                <Text style={styles.summaryButtonText}>
                  {summary ? 'Hide AI summary' : 'Summarise with AI'}
                </Text>
              </Pressable>

              {summarising ? <LoadingState height={90} /> : null}

              {summary ? (
                <View style={styles.summaryCard}>
                  {summary.bullets.map((line) => (
                    <Text key={line} style={styles.bullet}>
                      • {line}
                    </Text>
                  ))}
                  <Text style={styles.footnote}>
                    {summary.live
                      ? 'Summarised by Claude.'
                      : 'Prepared summary — no model call ran (§12.1).'}
                  </Text>
                </View>
              ) : null}

              {/*
                The link-out and its honesty note travel WITH the full read.
                This is the view most likely to be mistaken for the publisher's
                own article, so it is the view that most needs to say whose
                words these are and where the original lives. Deliberately not
                dropped for being a repeat of the card behind.
              */}
              <View style={styles.sourceCard}>
                <Text style={styles.rowTitle}>Read the full article at the source</Text>
                <Text style={styles.muted}>{article.url}</Text>
                <Text style={styles.footnote}>
                  The write-up above is Collectee&apos;s own. We link out rather than reproducing
                  the publisher&apos;s article — official channels and permitted RSS only.
                </Text>
              </View>
            </ScrollView>
          </View>
        </Modal>
      ) : null}

      {/* The floating assistant sits over this corner. Reserve its real height
          so the last row — including any rule above a footnote — is never
          resting underneath it. `spacing.xxl` was not enough: it is 32 against
          the launcher's 184. */}
      <View style={{ height: ASSISTANT_CLEARANCE }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing.lg, gap: spacing.md },

  overline: { ...typography.meta, color: colors.accent },
  title: { ...typography.screenTitle, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  muted: { ...typography.meta, color: colors.textSecondary },
  footnote: { ...typography.meta, color: colors.textTertiary },
  rowTitle: { ...typography.cardTitle, color: colors.textPrimary },

  /* The standfirst, on articles that have a body under it: brighter and a step
     larger, so the first paragraph reads as the lede rather than as the first
     of many equal ones. */
  lede: { ...typography.cardTitle, fontSize: 16, lineHeight: 24, color: colors.textPrimary },
  bodyHeading: { ...typography.sectionHeader, color: colors.textPrimary, marginTop: spacing.sm },

  figure: { gap: spacing.xs },
  /* 3:2 to match the baked wide rendition, so an inline figure crops no more
     than the cards in the list do. */
  figureImage: {
    width: '100%',
    aspectRatio: 3 / 2,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSunken,
  },
  figureCaption: { ...typography.meta, color: colors.textTertiary },

  /* The reader is opaque, unlike the rest of the app's transparent screens: it
     sits over a Modal with nothing behind it to show through. */
  readerScreen: { flex: 1, backgroundColor: colors.background },
  readerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  readerClose: { paddingVertical: spacing.sm, paddingRight: spacing.md },
  readerCloseText: { ...typography.cardTitle, fontSize: 17, color: colors.accent },
  /* Capped and centred for the same reason the News column is: a 1280pt line of
     body text is unreadable, and this is the one screen that is nothing but
     body text. */
  readerContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },

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
