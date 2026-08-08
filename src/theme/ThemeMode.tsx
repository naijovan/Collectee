/**
 * Light / dark mode — the runtime half of the two palettes in `theme.ts`.
 *
 * ── How it works ──────────────────────────────────────────────────────────
 * `colors` exports `var(--c-…)` on web, so every `StyleSheet.create` in the app
 * already points at a CSS custom property. This module writes those properties
 * onto <html> and swaps their values when the mode changes. Nothing re-renders,
 * because nothing needs to — the browser resolves the variables.
 *
 * That is the whole reason this approach was chosen: ~770 colour references
 * across 30 files, 13 of them owned by other people mid-flow. A `useTheme()`
 * refactor would have touched all of them four days from submission.
 *
 * ── Native ────────────────────────────────────────────────────────────────
 * No custom properties, so native takes the dark palette and the toggle hides
 * itself. Stated plainly rather than shipped as a button that does nothing.
 *
 * ── LOCKED TO DARK FOR THE DEMO (8 Aug) ───────────────────────────────────
 * The app is dark-first and only dark-first. The item art, the room backdrops,
 * every scrim, the news banners, the tour's indigo field and Colly's own poses
 * are all authored against a near-black background, and the identity colours —
 * the five rarity hues and the three game accents — are fixed hex that do not
 * re-theme by design (§12.2). Light mode therefore covered the token surfaces
 * and nothing else, which is why it read as half-themed rather than light.
 *
 * A judge on a light-mode laptop seeing that two days from submission is not a
 * risk worth a toggle nobody asked for, so `mode` is now a constant.
 *
 * ── Why the machinery stays ───────────────────────────────────────────────
 * `applyPalette` is NOT dead code — on web every `StyleSheet.create` in the app
 * points at `var(--c-…)`, and something has to write those properties onto
 * <html> or the whole app renders with unresolved variables. It just always
 * writes the dark palette now.
 *
 * ── The stored value is actively cleared ──────────────────────────────────
 * This is what actually caused the report. Nothing here ever read the system
 * colour scheme; the Settings screen had an Appearance toggle, someone used it,
 * and `localStorage` kept serving 'light' on every reload afterwards. Removing
 * the read is not enough — the key is deleted on boot, so re-enabling the
 * feature later cannot resurrect a months-old choice.
 */

import { createContext, useContext, useEffect, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { cssVarName, DARK_PALETTE, LIGHT_PALETTE, radius, spacing, typography } from './theme';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'collectee.theme';

/**
 * Whether the app can be switched at all. Locked off — see the header.
 *
 * `supported: false` is the same signal native already used, so the Settings
 * row and the floating toggle both hide themselves without either file
 * changing: they already handled a platform that cannot switch.
 */
const SUPPORTED = false;

/** Web still needs the custom properties written, switchable or not. */
const CAN_WRITE_VARS = Platform.OS === 'web';

interface ThemeModeValue {
  mode: ThemeMode;
  toggle: () => void;
  /** False on native, where CSS custom properties do not exist. */
  supported: boolean;
}

const ThemeModeContext = createContext<ThemeModeValue>({
  mode: 'dark',
  toggle: () => {},
  supported: false,
});

export const useThemeMode = (): ThemeModeValue => useContext(ThemeModeContext);

/**
 * Forget any previously stored choice.
 *
 * A browser that switched to light before the lock landed still holds
 * 'light' under this key. Nothing reads it now, but leaving it there means a
 * future re-enable silently reinstates a choice made weeks earlier by someone
 * who is not in the room.
 */
function clearStoredMode() {
  if (!CAN_WRITE_VARS) return;
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing throws on access. Nothing reads the key anyway.
  }
}

function applyPalette(mode: ThemeMode) {
  if (!CAN_WRITE_VARS) return;
  const root = globalThis.document?.documentElement;
  if (!root) return;

  /* The ternary stays rather than hardcoding DARK_PALETTE: re-enabling the
     switch should be a change to `mode`, not a hunt for places that assumed
     it. LIGHT_PALETTE is therefore still exercised by the type system and
     still correct if anyone turns this back on. */
  const palette = mode === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
  for (const [token, value] of Object.entries(palette)) {
    root.style.setProperty(cssVarName(token as keyof typeof DARK_PALETTE), value);
  }
  // The page behind the app root is not styled by React Native, so it stays the
  // old colour on overscroll unless it is set too.
  root.style.setProperty('background-color', palette.background);
  root.dataset.theme = mode;
}

/**
 * Write the variables at MODULE LOAD, before React renders anything.
 *
 * They used to be written in an effect, which runs after the first paint — so
 * frame one had unresolved `var(--c-…)`. An invalid custom property does not
 * fall back to a sensible colour, it drops the declaration, which means every
 * themed surface painted transparent over the browser's white body. That is a
 * white, half-styled first frame on every load, and on a slow start it is what
 * a judge sees.
 *
 * This module is imported by the root layout, so the assignment lands before
 * the tree mounts. The effect below stays as a belt-and-braces re-apply.
 */
applyPalette('dark');

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  /* Not state. There is nothing to change it to. */
  const mode: ThemeMode = 'dark';

  // The variables must exist before the first frame, or the app renders with
  // unresolved var() and every themed colour falls back to transparent.
  useEffect(() => {
    applyPalette(mode);
    clearStoredMode();
  }, [mode]);

  const value = useMemo(
    () => ({ mode, toggle: () => {}, supported: SUPPORTED }),
    [mode],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

/**
 * The toggle. Fixed to the viewport rather than placed in a header, because
 * every screen has a different header and the control is meant to be reachable
 * from all of them.
 *
 * Top-right, vertically aligned with where screen titles sit. Bottom-left was
 * the first attempt and it floated over section content — a control that
 * obscures the page it is themed for.
 */
export function ThemeToggle() {
  const { mode, toggle, supported } = useThemeMode();
  if (!supported) return null;

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: mode === 'light' }}
      accessibilityLabel={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onPress={toggle}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.glyph}>{mode === 'dark' ? '☀' : '☾'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'var(--c-border)',
    backgroundColor: 'var(--c-surface)',
    zIndex: 50,
  },
  pressed: { opacity: 0.7 },
  glyph: { ...typography.cardTitle, color: 'var(--c-text-primary)' },
});
