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

import type { GameTitle, Item, ItemSet } from '@/types';

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
  {
    value: 'casual',
    label: 'Casual',
    blurb: 'I pick up what I like and log off.',
    profileFlavour: 'Collects what catches their eye',
  },
  {
    value: 'enthusiast',
    label: 'Enthusiast',
    blurb: 'I know when the banner drops.',
    profileFlavour: 'Knows when the banner drops',
  },
  {
    value: 'completionist',
    label: 'Completionist',
    blurb: 'A set with a gap in it is not a set.',
    profileFlavour: 'Will not leave a set unfinished',
  },
  {
    value: 'whale',
    label: 'Whale',
    blurb: 'It was going to sell out. I had no choice.',
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
  /** Matches `TopicKind`. Kept to the two kinds the catalogue can actually justify. */
  kind: 'franchise' | 'character';
  /** The topic value, cased for display. Matching is case-insensitive. */
  value: string;
  /** Which game it came from — the chips group by this so the step is scannable. */
  title: GameTitle;
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
 * ── Why the article-tag filter is the important line here ─────────────────
 * The catalogue offers thirteen set names and dozens of hero names. Most are
 * mentioned in no article, and `rankFyp` matches topics against `tags` only —
 * so a chip for one of those is a control that appears to work and does not.
 * Intersecting with the tags means every chip shown is one that will visibly
 * reorder the feed, and it degrades honestly: as the news fixtures grow, more
 * chips appear on their own.
 *
 * This is why `deriveTasteChips` takes the articles as an argument instead of
 * reading them. It is the `rankFyp(articles, viewer, now)` shape — the caller
 * supplies the world, the domain decides — and it means the step can be tested
 * against a fixture list without a service.
 */
export function deriveTasteChips(
  sets: readonly ItemSet[],
  items: readonly Item[],
  articles: readonly { tags: readonly string[] }[],
): TasteChip[] {
  const tagged = new Set(
    articles.flatMap((article) => article.tags.map((tag) => tag.toLowerCase())),
  );

  const chips = new Map<string, TasteChip>();
  const offer = (chip: TasteChip) => {
    const key = chip.value.toLowerCase();
    if (!tagged.has(key) || chips.has(key)) return;
    chips.set(key, chip);
  };

  // Franchises are set names, which is exactly what a set is — the named
  // release a group of items belongs to.
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

  return [...chips.values()];
}
