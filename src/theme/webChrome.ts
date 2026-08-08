/**
 * Browser chrome the app cannot reach from React Native styles.
 *
 * `ScrollView` has `showsVerticalScrollIndicator`, but on web that maps to
 * hiding the bar outright, which loses the position cue entirely. What is
 * wanted is what macOS does natively when "Show scroll bars" is set to
 * "When scrolling": nothing at rest, a slim bar while moving, fading out after.
 * That is a CSS-only behaviour, so it goes in a stylesheet.
 *
 * Web only, and a no-op everywhere else — native platforms already do this.
 */

import { Platform } from 'react-native';

const STYLE_ID = 'collectee-web-chrome';

/**
 * Scrollbars are transparent at rest and tint in on hover or while scrolling.
 *
 * `overlay` first, then `auto`: overlay scrollbars float above content instead
 * of taking a gutter, which is the behaviour that stops the assistant bubble
 * fighting the bar for the same 15px. Browsers that dropped `overlay` fall
 * through to `auto` and still get the fade, just with the gutter reserved.
 *
 * The thumb keeps its size and only animates COLOUR. Animating width reflows
 * the page under the pointer, and a layout shift on scroll is worse than a
 * visible bar.
 *
 * Firefox gets `scrollbar-width`/`scrollbar-color`, which is all it exposes —
 * no fade there, but a thin unobtrusive bar rather than the default.
 */
const CSS = `
  html { scrollbar-gutter: auto; }

  *::-webkit-scrollbar { width: 10px; height: 10px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb {
    background-color: transparent;
    border-radius: 999px;
    border: 3px solid transparent;
    background-clip: content-box;
    transition: background-color 400ms ease;
  }
  /* The bar appears while the pointer is anywhere over the scroller, and while
     the user is actively scrolling — :hover on the scroller covers both cases
     for a mouse, and touch devices never show a bar at rest anyway. */
  *:hover::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.28); }
  *::-webkit-scrollbar-thumb:hover { background-color: rgba(255, 255, 255, 0.45); }
  *::-webkit-scrollbar-corner { background: transparent; }

  @supports (scrollbar-width: thin) {
    html, body, * { scrollbar-width: thin; scrollbar-color: transparent transparent; }
    *:hover { scrollbar-color: rgba(255, 255, 255, 0.28) transparent; }
  }

  /* Light mode needs a dark thumb — a white one is invisible on white. */
  :root[data-theme='light'] *:hover::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.24);
  }
  :root[data-theme='light'] *::-webkit-scrollbar-thumb:hover {
    background-color: rgba(0, 0, 0, 0.38);
  }
`;

/** Idempotent — safe to call on every mount; a second call replaces nothing. */
export function installWebChrome(): void {
  if (Platform.OS !== 'web') return;
  const doc = globalThis.document;
  if (!doc || doc.getElementById(STYLE_ID)) return;

  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}
