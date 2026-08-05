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
 * ── Persistence ───────────────────────────────────────────────────────────
 * `localStorage`, read synchronously before first paint, so a reload does not
 * flash dark before switching. In-memory would reset on every refresh, which
 * during a demo means the presenter's choice does not survive a page reload.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';

import { cssVarName, DARK_PALETTE, LIGHT_PALETTE, radius, spacing, typography } from './theme';

export type ThemeMode = 'dark' | 'light';

const STORAGE_KEY = 'collectee.theme';
const SUPPORTED = Platform.OS === 'web';

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

/** Reads the stored choice before first paint so a reload does not flash. */
function initialMode(): ThemeMode {
  if (!SUPPORTED) return 'dark';

  // `?theme=light` wins over the stored choice. Useful for a demo that must
  // open in a known state regardless of what the last person clicked, and it
  // is the only way to screenshot a mode without driving the button.
  const fromUrl = new URLSearchParams(globalThis.location?.search ?? '').get('theme');
  if (fromUrl === 'light' || fromUrl === 'dark') return fromUrl;

  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    // Private browsing throws on access. Dark is the documented default.
    return 'dark';
  }
}

function applyPalette(mode: ThemeMode) {
  if (!SUPPORTED) return;
  const root = globalThis.document?.documentElement;
  if (!root) return;

  const palette = mode === 'light' ? LIGHT_PALETTE : DARK_PALETTE;
  for (const [token, value] of Object.entries(palette)) {
    root.style.setProperty(cssVarName(token as keyof typeof DARK_PALETTE), value);
  }
  // The page behind the app root is not styled by React Native, so it stays the
  // old colour on overscroll unless it is set too.
  root.style.setProperty('background-color', palette.background);
  root.dataset.theme = mode;
}

export function ThemeModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  // Layout-time rather than after paint: the variables must exist before the
  // first frame or the app renders with unresolved var() and falls back to
  // transparent.
  useEffect(() => {
    applyPalette(mode);
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, mode);
    } catch {
      // Non-fatal — the mode still applies for this session.
    }
  }, [mode]);

  const toggle = useCallback(
    () => setMode((current) => (current === 'dark' ? 'light' : 'dark')),
    [],
  );

  const value = useMemo(
    () => ({ mode, toggle, supported: SUPPORTED }),
    [mode, toggle],
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
