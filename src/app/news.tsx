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

import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ASSISTANT_CLEARANCE, ArticleCard, EmptyState, FilterChips, LoadingState, NewsBanner } from '@/components';
import { DEMO_NOW, FEATURES } from '@/config/features';
import { pickThumbnailIds } from '@/domain/news';
import type { RankedArticle } from '@/domain/news';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { newsService } from '@/services';
import type { DigestResult } from '@/services';
import { useApp } from '@/state/AppContext';
import { useTourAnchor } from '@/state/TourAnchors';
import { colors, gameAccents, radius, spacing, typography } from '@/theme/theme';
import type { GameAccent } from '@/theme/theme';
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
 * The accent for a tab, or null for Saved.
 *
 * Saved is not a game and deliberately keeps `colors.accent` — it is the one
 * tab in the row that is a place rather than a title, and giving it a fourth
 * invented hue would say it is a fourth game.
 */
function accentForTab(tabName: string): GameAccent | null {
  const title = TITLE_BY_TAB.get(tabName);
  return title ? gameAccents[title] : null;
}

/**
 * "What's happening in <game>" (§11 F6).
 *
 * The label is driven by the actual call result, never by the feature flag: a
 * flag that is on but timed out must still say "prepared", or the one honest
 * claim this build makes about AI stops being true (§12.1).
 */
/**
 * The digest card. One version, shown once.
 *
 * There is deliberately no transition here. An earlier build rendered the
 * prepared bullets immediately and cross-faded to the model's when they
 * arrived; it read as a glitch, because a block of text quietly rewriting
 * itself is indistinguishable from a bug no matter how gently it is faded. The
 * prefetch removed the reason to do it — by the time anyone reaches this
 * screen the live bullets are usually already resolved, so the card can simply
 * render the answer.
 *
 * `minHeight` matches the shimmer that stands in while a cold digest resolves,
 * so the slot is the same size before and after. That also keeps the first-run
 * spotlight honest: it measures this box, and the box does not change.
 *
 * The label reads off what is on screen. Live bullets say so; the prepared
 * fallback says so too, and says that no model call ran (§12.1).
 */
function DigestCard({ title, digest }: { title: GameTitle; digest: DigestResult }) {
  if (digest.bullets.length === 0) return null;

  const accent = gameAccents[title];

  return (
    /* The accent lands on a left edge rather than the whole border: a full
       ember outline around a 172px card competes with the banner above it,
       and the point is to tie the card to the tab, not to shout. */
    <View style={[styles.digest, { borderLeftColor: accent.base }]}>
      <Text style={styles.digestTitle}>What&apos;s happening in {GAME_LABELS[title]}</Text>
      {digest.bullets.map((bullet) => (
        <View key={bullet} style={styles.bulletRow}>
          <Text style={[styles.bulletDot, { color: accent.base }]}>•</Text>
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


/**
 * Height of the digest's loading placeholder, matched to the resolved card so
 * the layout does not jump under the first-run walkthrough's spotlight.
 */
const DIGEST_PLACEHOLDER_HEIGHT = 172;

/** The cached digest for a game, in the shape the screen's state holds. */
function warmDigestFor(
  title: GameTitle | null,
): { title: GameTitle; result: DigestResult } | null {
  if (title === null) return null;
  const cached = newsService.cachedDigest(title);
  return cached ? { title, result: cached } : null;
}

export default function NewsScreen() {
  const router = useRouter();
  /* First-run walkthrough targets. The digest is the one target in the app
     that is not reliably on screen when the tour arrives — it resolves
     asynchronously and can take the full model timeout — so the tab row is
     registered as its fallback. See `TourStop.fallbackTargetIds`. */
  const digestAnchor = useTourAnchor('news-digest');
  const tabsAnchor = useTourAnchor('news-tabs');
  const { viewerId } = useApp();

  const [tab, setTab] = useState<string>(TABS[0]);
  /** Switching tab replaces the whole page, so it reads as a new one. */
  const scrollRef = useTopOnFocus(tab);
  /**
   * Tagged with its game, exactly like `digest` below and for the same reason:
   * a tab switch mid-flight would otherwise show CODM's articles under the MLBB
   * heading. Tagging also buys the progressive render — a refetch on the SAME
   * tab keeps the articles that are already on screen instead of blanking them
   * back to a placeholder.
   */
  const [feed, setFeed] = useState<{ title: GameTitle; entries: RankedArticle[] } | null>(null);
  /**
   * Tagged with the game it is for. The digest resolves on its own schedule —
   * up to the full 5s timeout on the live path — so a tab switch mid-flight
   * would otherwise land CODM's bullets under the MLBB heading.
   */
  const [digest, setDigest] = useState<{ title: GameTitle; result: DigestResult } | null>(() =>
    /* Lazy initial state, because `load` runs from a focus effect — after the
       first paint. Without this, a warm cache would still flash a shimmer for
       one frame on the way in, which is the whole thing the prefetch exists to
       prevent. */
    warmDigestFor(TITLE_BY_TAB.get(TABS[0]) ?? null),
  );
  const [saved, setSaved] = useState<Article[]>([]);
  const [busy, setBusy] = useState(true);

  const title = TITLE_BY_TAB.get(tab) ?? null;
  /* Null until this tab's own articles have landed — a stale tab's entries are
     never rendered under the wrong heading. */
  const entries = feed !== null && feed.title === title ? feed.entries : null;

  /* Thumbnails are assigned across the WHOLE list, not per card, so two rows
     never show the same art — MLBB's two articles both lead with Gusion's Cyber
     Faust and rendered identical portraits before this. Memoised on the list
     because the pick is greedy and order-dependent: recomputing it mid-render
     would be wasted work, not a different answer. */
  const feedThumbs = useMemo(
    () => pickThumbnailIds((entries ?? []).map((entry) => entry.article)),
    [entries],
  );
  const savedThumbs = useMemo(() => pickThumbnailIds(saved), [saved]);

  const load = useCallback(async () => {
    if (title === null) {
      setBusy(true);
      setSaved(await newsService.getSaved(viewerId));
      setBusy(false);
      return;
    }

    // The digest is not awaited alongside the feed: it is the one call on this
    // screen that really hits a model, so it can take the full 5s timeout, and
    // holding the articles hostage to it would make a working feed look broken.
    /* One version of the digest, never two. A prefetch means the cache is
       usually already warm by the time anyone gets here, and reading it
       synchronously puts the model's bullets on the first frame — awaiting a
       Promise that already has its answer would still cost a frame, and that
       frame would have to show something that is not the answer.
       Cold, the slot shimmers at the card's own height until the real one
       lands. It never shows prepared bullets and then replaces them. */
    const warm = newsService.cachedDigest(title);
    if (warm) {
      setDigest({ title, result: warm });
    } else {
      setDigest(null);
      void newsService.getDigest(title).then((result) => setDigest({ title, result }));
    }

    // Nothing sets `busy` here. The articles resolve at LATENCY_INSTANT and
    // render as soon as they land; the digest slot above them keeps its own
    // placeholder until it resolves. Two independent arrivals, which is what
    // makes the screen look alive on arrival rather than blank until the
    // slowest thing on it finishes.
    //
    // DEMO_NOW, not Date.now(): the ranking takes a clock as an argument so it
    // stays deterministic, and reading the real one throws that away.
    const entries = await newsService.getGameFeed(viewerId, title, DEMO_NOW);
    setFeed({ title, entries });
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
        The two text links that used to sit here are gone — Jovan's TODO, done.
        Notifications is the bell in Home's header, where §13.4 puts it and
        where the unread dot was already being drawn; followed topics is a row on
        Profile.

        Both moves were required rather than tidying. This screen was the ONLY
        route to either, so the links could not simply be deleted: /following
        had no other caller anywhere in the app, and removing this one would
        have left §11 F6's feed management in the build and unreachable.

        The page now opens on its tabs, which is the first thing a reader needs
        rather than two utility links above the content.
      */}
      <View ref={tabsAnchor} collapsable={false}>
        <FilterChips
          options={TABS}
          value={tab}
          onChange={setTab}
          accentFor={(option) => accentForTab(option)?.base}
        />
      </View>

      {/*
        Game identity, above the digest. Saved has no game and gets no banner.

        ── This banner is load-bearing for the first-run walkthrough ─────────
        The tour spotlights the digest BELOW this. Adding the banner moves that
        target down by exactly 128px (BANNER_HEIGHT 112 + spacing.lg), putting
        the digest at ~222px from the top of the scroll content and its bottom
        edge at ~394px.

        Two consequences, both checked before this landed:

        1. The digest still clears the fold on the shortest viewport we care
           about (iPhone SE, 667) with ~229px to spare, so the spotlight never
           lands on something scrolled out of view.

        2. At 667 the tour CARD flips from below the hole to above it —
           `TourOverlay` puts it on whichever side has more room, and below
           drops to 229px against 266px above. That is the overlay working as
           designed, not a regression, but it is why the banner cannot grow:
           past ~112px the card is forced above the hole on more devices, and
           past ~160px the digest itself starts crowding the fold.

        If this height ever changes, re-do that arithmetic. `BANNER_HEIGHT` is
        a fixed constant rather than an intrinsic image height precisely so the
        number stays knowable.
      */}
      {title !== null ? <NewsBanner title={title} /> : null}

      {/* Wrapped so both branches share one measurable box: the walkthrough
          can then land its spotlight on the digest while it is still loading
          and keep it there as the real card replaces the placeholder. */}
      {title !== null ? (
        <View ref={digestAnchor} collapsable={false}>
          {digest?.title === title ? (
            <DigestCard title={title} digest={digest.result} />
          ) : (
            /* Sized to the resolved card, not to a round number. The tour puts
               a spotlight on this slot, and the hole is measured from the box
               that is there when it arrives — a placeholder 60px shorter than
               what replaces it means the cutout clips the digest for as long as
               it takes the overlay to re-measure. Four bullets, a heading and a
               source line come to about this. */
            <LoadingState height={DIGEST_PLACEHOLDER_HEIGHT} />
          )}
        </View>
      ) : null}

      {/* A game tab: the placeholder stands in only until THIS tab's articles
          land, and never reappears for a refetch of a tab already on screen.
          Independent of the digest above, which keeps its own placeholder. */}
      {title !== null && entries === null ? <LoadingState height={200} /> : null}

      {title !== null && entries !== null ? (
        <View style={styles.list}>
          <Text style={styles.footnote}>
            Ranked by the topics you follow and the items you actually own.
          </Text>
          {entries.map((entry, index) => (
            <ArticleCard
              key={entry.article.id}
              article={entry.article}
              reason={entry.reason}
              thumb="feature"
              thumbItemId={feedThumbs[index]}
              onPress={() => open(entry.article.id)}
            />
          ))}
        </View>
      ) : null}

      {busy && title === null ? <LoadingState height={200} /> : null}

      {!busy && title === null ? (
        <View style={styles.list}>
          {saved.length === 0 ? (
            <EmptyState title="Nothing saved" body="Save an article and it lands here." />
          ) : (
            /* Saved keeps the blue tab but still tints its tags. The list mixes
               all three games, so the per-game chip is the only thing saying
               which one a saved article belongs to. */
            saved.map((article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                thumb="feature"
                thumbItemId={savedThumbs[index]}
                onPress={() => open(article.id)}
              />
            ))
          )}
        </View>
      ) : null}

      <Text style={styles.footnote}>
        Sources are official publisher channels and permitted RSS only. Summaries link out —
        Collectee never reproduces an article body (§11 F6).
        {FEATURES.liveSummarisation ? '' : ' Summaries and digests are seeded for this build.'}
      </Text>

      {/* The floating assistant sits over this corner. Pad by the real
          number so the last row is never resting underneath it. */}
      <View style={{ height: ASSISTANT_CLEARANCE }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  /**
   * A capped, centred column — the one place in the app that has one.
   *
   * The article cards are now full-width 3:2 images, which is right on a phone
   * (a 390pt screen gives a 358pt card and a 239pt image, so two cards fill the
   * screen). With no max-width shell anywhere in the app, the same rule on a
   * 1280pt browser gives a 1248pt card and an 832pt image — one card taller than
   * the viewport, with its own title below the fold.
   *
   * 720 is capped rather than the cards alone because the digest box and the
   * cards must stay the same width: they are the two things this page is made
   * of, and matching their edges is what makes it read as one column instead of
   * a box followed by a list. Capping the container narrows both together and
   * keeps that true at every width. At 1280 that is a 688pt card and a 459pt
   * image — a card and a bit per screen.
   *
   * 720 is already a house value; `room/new` uses it for the same reason.
   *
   * ⚠️ This shifts what the tour's stop 4 measures — `news-digest` is now
   * narrower and centred on wide screens. Re-measured after the change; see the
   * commit.
   */
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  list: { gap: spacing.md },
  footnote: { ...typography.meta, color: colors.textTertiary },

  digest: {
    /* Same height as the shimmer that stands in for it, so a cold load does not
       resize the slot when the real card arrives — and the first-run spotlight,
       which measures this box, never has to correct itself. */
    minHeight: DIGEST_PLACEHOLDER_HEIGHT,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    /* Colour is overridden per game by DigestCard; the WIDTH is declared here
       so it is part of the box on every render. The card is a flex child, so
       the edge eats 2px of content width rather than making the card wider —
       the outer box the tour measures is the same size with it or without. */
    borderLeftWidth: 3,
    padding: spacing.md,
    gap: spacing.sm,
  },
  digestTitle: { ...typography.cardTitle, color: colors.textPrimary },
  bulletRow: { flexDirection: 'row', gap: spacing.sm },
  bulletDot: { ...typography.body, color: colors.accent },
  bulletText: { ...typography.body, color: colors.textSecondary, flex: 1 },
});
