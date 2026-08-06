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
