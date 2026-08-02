/**
 * Artificial latency for the mocked service layer — PRD §12.1.
 *
 * "Write every service behind an async interface that returns a Promise, even
 *  though the data is local. `await scanService.scan(files)` with an artificial
 *  delay is one line away from a real fetch later; a synchronous import of a
 *  JSON file is a rewrite. This is the single cheapest thing you can do now to
 *  make phase 2 possible."
 *
 * The delay is not decoration either — a service that resolves instantly hides
 * every missing loading state until the day you add a real network call.
 */

/** Typical local-read feel. */
export const LATENCY_INSTANT = 120;
/** A list fetch. */
export const LATENCY_FETCH = 320;
/** Something that would hit a model in phase 2. */
export const LATENCY_GENERATE = 1800;

export function delay<T>(value: T, ms: number = LATENCY_FETCH): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * Drive a progress bar over a mocked long-running job.
 * Resolves with `value` after `totalMs`, calling `onProgress` with 0–1 along
 * the way — this is what the scanner and room generator use for their timed
 * loading states.
 */
export function delayWithProgress<T>(
  value: T,
  totalMs: number,
  onProgress?: (fraction: number) => void,
  steps = 20,
): Promise<T> {
  if (!onProgress) return delay(value, totalMs);
  return new Promise((resolve) => {
    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      onProgress(Math.min(1, step / steps));
      if (step >= steps) {
        clearInterval(interval);
        resolve(value);
      }
    }, Math.max(16, totalMs / steps));
  });
}
