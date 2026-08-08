/**
 * The account rules shared by sign-up and Settings.
 *
 * Both screens ask for an age, and both must offer exactly the same choices —
 * a picker starting at 18 in one place and a free-text box in the other is how
 * a 17 gets into an account that the front door refuses.
 *
 * Pure, per the `src/domain` contract: no I/O, no React, just the rule.
 */

/** The app is 18+. The list starts here rather than validating after the fact. */
export const MIN_AGE = 18;

/**
 * The top entry is a bucket, not a birthday.
 *
 * Nothing in the product does arithmetic on age, so a precise number past a
 * point is data collected for its own sake — it is rendered as "65+".
 */
export const MAX_AGE_OPTION = '65';

export const AGE_OPTIONS: readonly string[] = Array.from(
  { length: Number(MAX_AGE_OPTION) - MIN_AGE + 1 },
  (_, index) => String(MIN_AGE + index),
);

/** How an age reads on screen. Only the top option differs from its value. */
export function ageLabel(option: string): string {
  return option === MAX_AGE_OPTION ? `${option}+` : option;
}
