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

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ArticleCard, EmptyState, FilterChips, LoadingState } from '@/components';
import { DEMO_NOW, FEATURES } from '@/config/features';
import type { RankedArticle } from '@/domain/news';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTopOnFocus } from '@/hooks/useTopOnFocus';
import { newsService } from '@/services';
import type { DigestResult } from '@/services';
import { useApp } from '@/state/AppContext';
import { useTourAnchor } from '@/state/TourAnchors';
import { colors, motion, radius, spacing, typography } from '@/theme/theme';
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
/**
 * The digest, which upgrades in place.
 *
 * Shows the prepared bullets the moment they arrive and cross-fades to the
 * model's when those land. The label reads off what is CURRENTLY on screen, not
 * off what was requested — so it says "prepared" while prepared bullets are
 * showing and changes only when the text underneath it does. That is the whole
 * §12.1 rule: never imply a model ran when none has, and never imply one has
 * not when it did.
 *
 * ── Why the height only ever grows ────────────────────────────────────────
 * The live digest is SHORTER than the prepared one — measured, two bullets
 * against four — so upgrading shrinks the card. That is a layout jump under
 * text the reader is mid-sentence through, and the first-run spotlight is
 * measured against this exact box, so the cutout would be left too tall until
 * it re-measured. Locking the floor to the tallest render costs some empty
 * space and buys a card that never moves.
 */
function DigestCard({ title, digest }: { title: GameTitle; digest: DigestResult }) {
  const reduceMotion = useReduceMotion();
  const [shown, setShown] = useState<DigestResult>(digest);
  const [floor, setFloor] = useState<number>();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const unchanged =
      digest.live === shown.live &&
      digest.bullets.length === shown.bullets.length &&
      digest.bullets.every((bullet, i) => bullet === shown.bullets[i]);
    // Live failing returns the prepared bullets verbatim, so the common
    // no-network case swaps nothing and animates nothing.
    if (unchanged) return;

    /* Reduce Motion: swap outright. The fade carries no information the text
       does not — it is there to stop the change being startling, which is the
       definition of decoration in this codebase. */
    if (reduceMotion) {
      setShown(digest);
      return;
    }

    Animated.timing(opacity, {
      toValue: 0,
      duration: motion.fast,
      easing: Easing.out(Easing.quad),
      useNativeDriver: NATIVE_DRIVER,
    }).start(({ finished }) => {
      // Interrupted means a newer digest started its own transition.
      if (!finished) return;
      setShown(digest);
      Animated.timing(opacity, {
        toValue: 1,
        duration: motion.base,
        easing: Easing.out(Easing.quad),
        useNativeDriver: NATIVE_DRIVER,
      }).start();
    });
  }, [digest, shown, opacity, reduceMotion]);

  if (shown.bullets.length === 0) return null;

  return (
    <Animated.View
      style={[styles.digest, floor !== undefined && { minHeight: floor }, { opacity }]}
      onLayout={(event) => {
        const { height } = event.nativeEvent.layout;
        // Monotonic, so this settles after the first render rather than
        // oscillating: once the floor is applied the height stops changing.
        setFloor((current) => (current === undefined || height > current ? height : current));
      }}
    >
      <Text style={styles.digestTitle}>What&apos;s happening in {GAME_LABELS[title]}</Text>
      {shown.bullets.map((bullet) => (
        <View key={bullet} style={styles.bulletRow}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{bullet}</Text>
        </View>
      ))}
      <Text style={styles.footnote}>
        {shown.live
          ? 'Digest by Claude, from the articles below.'
          : 'Prepared digest — no model call ran (§12.1).'}
      </Text>
    </Animated.View>
  );
}

/**
 * Height of the digest's loading placeholder, matched to the resolved card so
 * the layout does not jump under the first-run walkthrough's spotlight.
 */
const DIGEST_PLACEHOLDER_HEIGHT = 172;

/* No native animated module on web — matches `primitives` and `import`. */
const NATIVE_DRIVER = Platform.OS !== 'web';

export default function NewsScreen() {
  const router = useRouter();
  /* First-run walkthrough targets. The digest is the one target in the app
     that is not reliably on screen when the tour arrives — it resolves
     asynchronously and can take the full model timeout — so the tab row is
     registered as its fallback. See `TourStop.fallbackTargetIds`. */
  const digestAnchor = useTourAnchor('news-digest');
  const tabsAnchor = useTourAnchor('news-tabs');
  const { viewerId, unreadNotifications } = useApp();

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
  const [digest, setDigest] = useState<{ title: GameTitle; result: DigestResult } | null>(null);
  const [saved, setSaved] = useState<Article[]>([]);
  const [busy, setBusy] = useState(true);

  const title = TITLE_BY_TAB.get(tab) ?? null;
  /* Null until this tab's own articles have landed — a stale tab's entries are
     never rendered under the wrong heading. */
  const entries = feed !== null && feed.title === title ? feed.entries : null;

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
    /* Two stages, not one. The prepared bullets land with the articles; the
       model's replace them when they arrive. Measured against the deployed
       proxy the live call takes 1.1-1.5s, and the slot used to hold a grey
       rectangle for every millisecond of it — which the first-run spotlight
       then pointed at. */
    setDigest(null);
    void newsService.getSeededDigest(title).then((result) =>
      /* Only fills an empty slot. If the live result somehow wins the race,
         the prepared one must not overwrite it on arrival. */
      setDigest((current) =>
        current !== null && current.title === title ? current : { title, result },
      ),
    );
    void newsService.getDigest(title).then((result) => setDigest({ title, result }));

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

      <View ref={tabsAnchor} collapsable={false}>
        <FilterChips options={TABS} value={tab} onChange={setTab} />
      </View>

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
          {entries.map((entry) => (
            <ArticleCard
              key={entry.article.id}
              article={entry.article}
              reason={entry.reason}
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
