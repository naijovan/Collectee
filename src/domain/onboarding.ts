/**
 * First-run preferences — the quiz's vocabulary, with no I/O.
 *
 * The quiz asks three questions and every answer has somewhere real to go:
 * games and topics are §11 F6 session overlays (`newsService`), and intensity
 * lands here because it has no existing home. Intensity is the one answer that
 * does not change ranking — it is profile flavour, and this file is deliberate
 * about saying so rather than implying the quiz tuned something it did not.
 *
 * Pure data and pure functions, per the `src/domain` contract. The screen that
 * renders these lives in `src/app/onboarding`, and the chips for step 2 are
 * derived from the catalogue at runtime — see `deriveTasteChips`.
 */

import type { GameTitle, Item, ItemSet, TopicKind } from '@/types';

/**
 * How hard someone collects. Four options because three feels like a
 * personality test and five is a form.
 *
 * These are self-reported and unverified, which is the whole point: it is a
 * conversation opener on a profile, not a segment. Nothing gates on it.
 */
export type CollectorIntensity = 'casual' | 'enthusiast' | 'completionist' | 'whale';

export const COLLECTOR_INTENSITIES: readonly CollectorIntensity[] = [
  'casual',
  'enthusiast',
  'completionist',
  'whale',
] as const;

export interface IntensityOption {
  value: CollectorIntensity;
  label: string;
  /** The playful line under the label — this is what makes the step readable. */
  blurb: string;
  /** How it reads back on a profile. First person, because that is where it goes. */
  profileFlavour: string;
}

/**
 * Written to be funny about the collector, never about the spend. "Whale" is
 * the community's own word and lands as a wink when the collector picks it for
 * themselves; it would land differently as a label the app applied to them, so
 * it only ever appears as a choice and as their own profile line.
 */
export const INTENSITY_OPTIONS: readonly IntensityOption[] = [
  /*
   * `blurb` is Ray's copy, verbatim — these four strings were specified exactly
   * and are not to be paraphrased.
   *
   * `profileFlavour` is deliberately NOT the blurb. The blurb is the collector
   * speaking in first person while choosing ("I collect what I like"), and the
   * flavour is how the choice reads back on a profile another person is looking
   * at, in third person. Copying the blurb into it would put "I collect what I
   * like" under someone else's handle.
   */
  {
    value: 'casual',
    label: 'Casual',
    blurb: 'I collect what I like.',
    profileFlavour: 'Collects what catches their eye',
  },
  {
    value: 'enthusiast',
    label: 'Enthusiast',
    blurb: 'I keep up with every drop.',
    profileFlavour: 'Knows when the banner drops',
  },
  {
    value: 'completionist',
    label: 'Completionist',
    blurb: "If there's a gap, I'm filling it.",
    profileFlavour: 'Will not leave a set unfinished',
  },
  {
    value: 'whale',
    label: 'Whale',
    blurb: 'Limited edition? Say less.',
    profileFlavour: 'Has never let a bundle sell out',
  },
] as const;

const OPTIONS_BY_VALUE = new Map(INTENSITY_OPTIONS.map((option) => [option.value, option]));

export function intensityOption(value: CollectorIntensity): IntensityOption {
  const option = OPTIONS_BY_VALUE.get(value);
  // Unreachable while `CollectorIntensity` and the table agree, and the table
  // is `as const` so the compiler enforces that. The throw is here so a future
  // fifth tier added to the union fails loudly instead of rendering blank.
  if (!option) throw new Error(`No intensity option for "${value}"`);
  return option;
}

// ── Step 2: what you collect ────────────────────────────────────────────────

/** A chip in quiz step 2, ready to become a `FollowedTopic`. */
export interface TasteChip {
  /**
   * Matches `TopicKind`. All three members are used now.
   *
   * `game` joined when the step became an interest picker: Ray asked for games
   * mixed in with skins and heroes, and a game is the one kind that is
   * guaranteed to change the feed — `rankFyp` matches games through
   * `followedGames`, which does not depend on any article being tagged.
   */
  kind: TopicKind;
  /** The topic value, cased for display. Matching is case-insensitive. */
  value: string;
  /** Which game it came from — shown on the chip so the step is scannable. */
  title: GameTitle;
  /**
   * True when some article is currently tagged with this value, so following it
   * reorders the feed on the next load rather than only future ones.
   *
   * Used for ordering, NOT for filtering — see the note on `deriveTasteChips`
   * for why that changed.
   */
  live: boolean;
}

/**
 * The chips for "what do you collect?", derived from the catalogue and then
 * filtered down to the ones that do something.
 *
 * ── Why not rarity, which is what a first read of the brief suggests ──────
 * Rarity is a real taxonomy (§12.2) but not a followable one. `TopicKind` is
 * `game | franchise | character`, and adding a fourth member means editing
 * `types/common.ts` — the merge contract — and then teaching `rankFyp` a
 * matching rule it does not have. The chips would look identical and change
 * nothing. There is also no "type" or "category" field on `Item` at all, so
 * the other half of that taxonomy does not exist to derive from.
 *
 * ── The article-tag rule is now an ORDERING, not a filter ─────────────────
 * It used to be a hard gate: a chip appeared only if some article was already
 * tagged with its value, on the argument that `rankFyp` matches topics against
 * `tags` alone, so any other chip is a control that appears to work and does
 * not. That argument is still true and the code still honours it — but as a
 * filter it left NINE chips out of a possible fifty-two, and Ray's review is
 * that nine pills clustered mid-screen does not read as an interest picker.
 *
 * Both things can hold. Tagged values sort first, so the chips a user is most
 * likely to hit are the ones that visibly reorder the feed on the very next
 * load, and `live` records which those are. The rest express an interest that
 * ranks the next matching article rather than none — which is what following
 * something means anyway. Games are unconditionally live: they match through
 * `followedGames` and never needed a tag.
 *
 * The honesty rule that DOES still bind is the seed. `FOLLOWED_TOPICS` must
 * only contain tagged values, because a seeded topic that does nothing is a lie
 * the app tells before the user has touched it; a topic the user picked is
 * their choice about their own feed.
 *
 * This is why `deriveTasteChips` takes the articles as an argument instead of
 * reading them. It is the `rankFyp(articles, viewer, now)` shape — the caller
 * supplies the world, the domain decides — and it means the step can be tested
 * against a fixture list without a service.
 *
 * ── Order is shuffled, and deterministically ──────────────────────────────
 * Ray asked for mixed-up order rather than games-then-franchises-then-heroes,
 * which reads as three lists stacked. The shuffle is a hash of the chip's own
 * value, so it is stable: the same catalogue produces the same order on every
 * render, every reload and every machine. `Math.random` would reshuffle the
 * page under the user's finger on any re-render and would make this function
 * untestable, which is not a trade worth making for an effect nobody can tell
 * apart from a fixed arbitrary order.
 */

/** Cap on chips offered. Enough to fill the step; short enough to scan. */
const MAX_TASTE_CHIPS = 28;

/**
 * Stable pseudo-random weight in [0, 1) from a string — FNV-1a, then scaled.
 *
 * Only used to scatter the chips. Not security-relevant, and deliberately not
 * seeded by anything that changes between renders.
 */
function shuffleWeight(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return ((hash >>> 0) % 100_000) / 100_000;
}

export function deriveTasteChips(
  sets: readonly ItemSet[],
  items: readonly Item[],
  articles: readonly { tags: readonly string[] }[],
  gameLabels: Readonly<Record<GameTitle, string>>,
  titles: readonly GameTitle[],
): TasteChip[] {
  const tagged = new Set(
    articles.flatMap((article) => article.tags.map((tag) => tag.toLowerCase())),
  );

  const chips = new Map<string, TasteChip>();
  const offer = (chip: Omit<TasteChip, 'live'>) => {
    const key = chip.value.toLowerCase();
    if (chips.has(key)) return;
    /* Games are live whatever the articles say — `rankFyp` reads them from
       `followedGames`, not from tags. */
    chips.set(key, { ...chip, live: chip.kind === 'game' || tagged.has(key) });
  };

  // Games. Offered first so they win the dedupe against a set or hero that
  // happens to share a name, and because they are the one kind that cannot be a
  // dead topic.
  for (const title of titles) offer({ kind: 'game', value: gameLabels[title], title });

  // Franchises are set names, which is exactly what a set is — the named
  // release a group of items belongs to. This is also what "skins" means as a
  // followable thing: a skin line, not one individual skin. Following
  // "Elderflame" is a standing interest; following one Elderflame Vandal is a
  // single item, which is what the inventory is already for.
  for (const set of sets) offer({ kind: 'franchise', value: set.name, title: set.title });

  // Characters come from MLBB only. Its skins are reliably "Hero — Skin Name",
  // so the prefix is always a hero. CODM's are the same shape but the prefix is
  // a weapon as often as an operator ("DL Q33 — Lightbringer" against "Ghost —
  // Nightfall"), and there is no field that says which; guessing would put
  // "DL Q33" on a chip labelled as a character. Valorant does not use the form
  // at all. When a `character` field lands on `Item`, this reads it instead.
  for (const item of items) {
    if (item.title !== 'mlbb') continue;
    const [hero] = item.name.split('—');
    const value = hero?.trim();
    if (value) offer({ kind: 'character', value, title: 'mlbb' });
  }

  /* Live first so the chips most likely to be tapped are the ones that reorder
     the feed immediately, then scattered within each group so the page does not
     read as games, then franchises, then a block of heroes. */
  return [...chips.values()]
    .sort((a, b) => {
      if (a.live !== b.live) return a.live ? -1 : 1;
      return shuffleWeight(a.value) - shuffleWeight(b.value);
    })
    .slice(0, MAX_TASTE_CHIPS);
}
