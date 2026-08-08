/**
 * The web HTML shell — the only markup that exists before React mounts.
 *
 * ── Why this file exists ──────────────────────────────────────────────────
 * Expo's default shell declares no page background, so `body` painted the
 * browser default — white. Everything the app draws is themed through
 * `var(--c-…)` custom properties, and those are not set until JS runs, so the
 * first frame was white with unresolved variables underneath it. On a machine
 * in light appearance that reads as a broken half-light app rather than as
 * "still loading", which is exactly the report this fixes.
 *
 * The values here are the DARK palette's `background`, written literally
 * because this file renders before any module has run. It is the one place in
 * the app allowed to repeat a token value, and it is commented as such so the
 * next person does not "fix" the duplication by importing something that
 * cannot be imported this early.
 *
 * `color-scheme: dark` is the other half: it tells the browser to render its
 * OWN chrome dark too — scrollbars, form controls, and the flash of background
 * during navigation — regardless of the OS appearance setting. Without it a
 * light-mode laptop still draws light scrollbars over a dark app.
 *
 * ── This does not run on native ───────────────────────────────────────────
 * Expo Router only uses it for the web build; iOS and Android take their
 * background from `app.json`'s `userInterfaceStyle`, already `dark`.
 */

import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Literal copies of `DARK_PALETTE.background`, by necessity — see the header.
 * If the palette's background ever changes, change it here too.
 */
const BACKGROUND = '#0B0D10';

const SHELL_CSS = `
  :root { color-scheme: dark; }
  html, body, #root { background-color: ${BACKGROUND}; }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        {/* Tells the browser chrome itself which scheme to draw. */}
        <meta name="color-scheme" content="dark" />
        {/* Expo's own reset — without it the body scrolls instead of the app. */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: SHELL_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
