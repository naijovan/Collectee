import { Platform } from 'react-native';

import type { GameTitle } from '@/types';

/**
 * Design tokens — PRD §13.2.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  NO RAW HEX ANYWHERE ELSE IN THE CODEBASE. Import from here.        │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Extracted from the Figma brief: dark near-black background, elevated card
 * surface, a single blue accent (buttons, active tab, links, "See all"), five
 * rarity colours per §12.2, white primary / muted grey secondary text,
 * 12–16px card radius, pill-shaped filter chips.
 *
 * Jovan owns this file. Changes go via PR announced in chat (§13.3).
 *
 * NOTE: UI is deliberately deferred — the team agreed to settle the data and
 * feature layer first. These tokens exist so that when screens land they have a
 * single source to pull from, and nobody hardcodes a colour in the meantime.
 */

/**
 * The dark palette — §13.2, and still the canonical one. The Figma is dark and
 * the demo opens dark; light is an alternative, not a replacement.
 */
export const DARK_PALETTE = {
  // Surfaces
  background: '#0B0D10',
  surface: '#141821',
  surfaceElevated: '#1C212C',
  surfaceSunken: '#080A0D',
  border: '#252B38',

  // Single blue accent — buttons, active tab, links, "See all"
  accent: '#2F6BFF',
  accentPressed: '#2454CC',
  accentMuted: '#1B2E5C',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#9AA4B5',
  textTertiary: '#6B7484',
  textOnAccent: '#FFFFFF',

  // Status
  success: '#31C48D',
  warning: '#F5A524',
  danger: '#F04438',
} as const;

/**
 * The light palette.
 *
 * Not an inversion. `accent` darkens slightly so it still passes contrast on a
 * white surface, and `accentMuted` becomes a pale tint rather than a navy —
 * inverting it would produce a near-black fill behind accent-coloured text.
 * Rarity colours are deliberately NOT re-themed: they are identity (§12.2),
 * and a mythic that changes hue between themes stops being recognisable.
 */
export const LIGHT_PALETTE: Record<keyof typeof DARK_PALETTE, string> = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#ECEEF2',
  border: '#D9DDE5',

  accent: '#1D4FD8',
  accentPressed: '#1740B0',
  accentMuted: '#E3EAFD',

  textPrimary: '#0B0D10',
  textSecondary: '#525C6B',
  textTertiary: '#7A8494',
  textOnAccent: '#FFFFFF',

  success: '#0F9D63',
  warning: '#B26A02',
  danger: '#C4321F',
};

/** The CSS custom-property name for a token, e.g. `--c-surface`. */
export function cssVarName(token: keyof typeof DARK_PALETTE): string {
  return `--c-${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/**
 * The exported palette every screen imports.
 *
 * ── Why web gets `var(--c-…)` instead of a hex ────────────────────────────
 * `StyleSheet.create` runs at module load and copies colour values in. There
 * are ~770 colour references across 30 files, so a runtime toggle that changed
 * these objects would not reach a single already-created style.
 *
 * CSS custom properties move the indirection into the browser: the style says
 * `var(--c-surface)`, and swapping one attribute on <html> re-themes every
 * style in the app without a re-render and without touching those 30 files —
 * 13 of which belong to other people mid-flow.
 *
 * Native has no such mechanism, so it takes the dark palette directly. That is
 * a deliberate scope line, not an oversight: the toggle is a web affordance,
 * the Figma is dark (§13.2), and rewriting every screen for runtime theming
 * four days from submission is the wrong trade.
 */
export const colors = (
  Platform.OS === 'web'
    ? (Object.fromEntries(
        Object.keys(DARK_PALETTE).map((token) => [
          token,
          `var(${cssVarName(token as keyof typeof DARK_PALETTE)})`,
        ]),
      ) as Record<keyof typeof DARK_PALETTE, string>)
    : DARK_PALETTE
) as Record<keyof typeof DARK_PALETTE, string>;

/**
 * §12.2 — five tiers, five colour tokens. One `<RarityBadge tier label />`.
 *
 * `rare` is deliberately shifted green-ward from the Figma's #3B82F6: at that
 * value it sat two points from `accent`, and a rare badge read as a tappable
 * element. It still reads blue against `epic`.
 */
export const rarityColors = {
  common: '#8B94A6',
  rare: '#38BDF8',
  epic: '#A855F7',
  legendary: '#F59E0B',
  mythic: '#EF4444',
} as const;

/**
 * Rarity as a value ladder, not five hues (§12.2).
 *
 * A tier is not just a colour — it is how loud the item is allowed to be.
 * Common gets a hairline and no glow; mythic gets a heavy border, a visible
 * glow and a sheen. This is the whole reason a legendary drop feels like a
 * drop. `glow` is an alpha of `base`, so it stays inside the no-raw-hex rule
 * by living here.
 */
export const rarityTreatments = {
  common: { base: rarityColors.common, glow: 'rgba(139,148,166,0)', borderWidth: 1, sheen: false, elevation: 0 },
  rare: { base: rarityColors.rare, glow: 'rgba(56,189,248,0.28)', borderWidth: 1, sheen: false, elevation: 2 },
  epic: { base: rarityColors.epic, glow: 'rgba(168,85,247,0.38)', borderWidth: 1.5, sheen: true, elevation: 4 },
  legendary: { base: rarityColors.legendary, glow: 'rgba(245,165,36,0.45)', borderWidth: 2, sheen: true, elevation: 6 },
  mythic: { base: rarityColors.mythic, glow: 'rgba(240,68,56,0.5)', borderWidth: 2, sheen: true, elevation: 8 },
} as const;

/** Tier marks — the badge glyph escalates with value. */
export const rarityGlyphs = {
  common: '◦',
  rare: '◆',
  epic: '✦',
  legendary: '✧',
  mythic: '✵',
} as const;

/**
 * Per-game identity accents — the News tabs (§11 F6).
 *
 * ── Why these are not the blue accent ─────────────────────────────────────
 * `colors.accent` means "interactive" everywhere in the app. A game tab needs
 * to mean "this is CODM", which is a different job: three tabs sharing one blue
 * are three tabs with no identity, which is the complaint these answer.
 *
 * ── Why these are not rarity colours ──────────────────────────────────────
 * Reusing `rarityColors` was the obvious move and it is wrong. §12.2 makes a
 * rarity hue *identity* — a mythic is red everywhere, in every theme — so
 * spending red on VALORANT would give the same pixel two meanings. Each base
 * below is therefore deliberately offset from its nearest rarity neighbour:
 *
 *   codm     #FF7A29  vs legendary #F59E0B — pushed red, off the amber
 *   valorant #FF4655  vs mythic    #EF4444 — pushed pink; the closest pair
 *   mlbb     #8B5CF6  vs epic      #A855F7 — pushed indigo
 *
 * VALORANT and mythic remain close. The News screen renders no rarity badge, so
 * they never appear together there; if a rarity badge is ever added to a news
 * surface, revisit this rather than assuming it still reads.
 *
 * ── These do not re-theme in light mode ───────────────────────────────────
 * Same call as `rarityColors`, and for the same reason: identity colours that
 * change hue between themes stop being identity. They are fixed hex rather than
 * `var(--c-…)`, so on the light palette they keep their value. That is a real
 * contrast trade on small text and it is accepted knowingly — the demo opens
 * dark (§13.2) and light is a web affordance.
 *
 * `soft` is an alpha of `base`, which is what keeps it inside the no-raw-hex
 * rule by living here — the same licence `scrim` and `rarityTreatments.glow`
 * take.
 */
export const gameAccents = {
  /** Ember — warm muzzle-flash orange, the CODM key art register. */
  codm: {
    base: '#FF7A29',
    secondary: '#FFB347',
    soft: 'rgba(255,122,41,0.14)',
  },
  /** Signature red against the teal that reads as its complement. */
  valorant: {
    base: '#FF4655',
    secondary: '#22D3C5',
    soft: 'rgba(255,70,85,0.14)',
  },
  /** Land of Dawn violet, with the gold its splash art keeps returning to. */
  mlbb: {
    base: '#8B5CF6',
    secondary: '#FFC53D',
    soft: 'rgba(139,92,246,0.16)',
  },
  /* `satisfies Record<GameTitle, …>` rather than a bare object: adding a fourth
     title to `GameTitle` must fail HERE, at compile time, rather than render a
     tab with `undefined` accents at runtime. The import is type-only, so it is
     erased in the build and adds no dependency from the token file to the
     domain. */
} as const satisfies Record<GameTitle, { base: string; secondary: string; soft: string }>;

export type GameAccent = (typeof gameAccents)[keyof typeof gameAccents];

/**
 * Room lighting presets — J3 Customise step.
 *
 * These are scene washes, not a light model: a tint composited over the
 * backdrop at an opacity driven by `RoomSettings.brightness`. They live here
 * because this file is the only place raw hex is allowed.
 */
export const lightingPresets = {
  'cool-blue': { label: 'Cool blue', tint: '#2F6BFF' },
  'purple-glow': { label: 'Purple glow', tint: '#A855F7' },
  'warm-gold': { label: 'Warm gold', tint: '#F5A524' },
  'dark-cinematic': { label: 'Dark cinematic', tint: '#0B0D10' },
} as const;

/**
 * Scrims — translucent black, for putting text or a badge over artwork.
 *
 * These are the only sanctioned `rgba()` literals in the app. They live here
 * for the same reason the hexes do: a scrim is a colour decision, and the four
 * separate `rgba(0,0,0,0.x)` literals previously scattered through components
 * had drifted to four different alphas for the same job.
 *
 * `clear` is transparent *black*, not `'transparent'` — on Android a gradient
 * to `transparent` fades through grey, which shows as a dirty band.
 */
export const scrim = {
  clear: 'rgba(0,0,0,0)',
  light: 'rgba(0,0,0,0.35)',
  medium: 'rgba(0,0,0,0.55)',
  heavy: 'rgba(0,0,0,0.75)',
  /** Pointer hover over a card cover — light enough to read the art through. */
  hover: 'rgba(0,0,0,0.45)',
} as const;

/**
 * The guided tour's de-emphasis — PRD §13.4's walkthrough, v2.
 *
 * ── Why this is not a blur ────────────────────────────────────────────────
 * Real backdrop blur was evaluated and rejected. The spotlight cuts its hole
 * with FOUR rectangles rather than a mask (see `TourOverlay`), and a
 * `backdrop-filter` on four panels samples differently at each boundary, so the
 * hole gets visible seams along its edges. Native has no blur module at all
 * without a new dependency (§13.1). A cheap fake blur was explicitly off the
 * table, so the dim earns its keep by being composed instead.
 *
 * ── What it is ────────────────────────────────────────────────────────────
 * A deep indigo gradient, darkest at the top and lifting slightly toward the
 * bottom where the guide stands, plus a vignette that darkens the edges. The
 * gradient is drawn once in screen space and clipped per panel, so the four
 * pieces line up into one field rather than four tiles.
 *
 * Indigo rather than neutral grey: grey over a dark app reads as "disabled",
 * and this moment is theatrical, not broken. It is close enough to
 * `background` to feel like the same product and far enough to read as a
 * deliberate state change.
 *
 * These are `rgba` rather than hex because they composite over live content —
 * same licence `scrim` takes, and the same reason they live in this file.
 */
export const tourScrim = {
  /** Top of the field — deepest. */
  top: 'rgba(9,10,26,0.94)',
  /** Bottom, where the guide stands. Slightly lifted so she is not in a pit. */
  bottom: 'rgba(5,6,15,0.88)',
  /** Edge darkening, drawn over the gradient. */
  vignette: 'rgba(3,4,10,0.55)',
  /** Centre of the vignette — transparent, so the middle stays readable. */
  vignetteClear: 'rgba(3,4,10,0)',
} as const;

/**
 * Fallback palette for `RoomAtmosphere` when a theme supplies fewer than three
 * colours — [base, primary, secondary], matching the `RoomTheme.palette` shape.
 *
 * These were three raw hex literals inlined in the component, which is the one
 * thing this file exists to prevent. They live here rather than in the room
 * fixture because they are a *rendering* fallback, not a theme: no designer
 * picked them for a room, they are what the shaft and mote shaders fall back to
 * so the scene never renders black-on-black.
 */
export const atmosphereFallback = {
  base: '#0A0E1A',
  primary: '#12E4F0',
  secondary: '#F022A8',
} as const;

/**
 * Third-party brand colours, for the mocked OAuth buttons on the sign-in
 * screen — the only place in the app that renders someone else's mark.
 *
 * These are NOT theme colours and must never be used as ones. They do not
 * re-theme in light mode and they are not on the value ladder; Google's blue is
 * Google's blue on any background. They live here for the same reason every
 * other literal does — this file is where raw hex is allowed — and nowhere else
 * imports them.
 *
 * The marks are drawn from Views rather than shipped as images or an icon font,
 * the same call `TabBar` makes and for the same reason: §13.1 says nobody adds
 * a dependency without saying so, and that includes an icon set.
 */
export const brand = {
  googleBlue: '#4285F4',
  googleRed: '#EA4335',
  googleYellow: '#FBBC05',
  googleGreen: '#34A853',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** ~12–16px card radius; chips are pill-shaped. */
export const radius = {
  sm: 8,
  card: 14,
  lg: 20,
  pill: 999,
} as const;

/**
 * Font families. Loaded once in `src/app/_layout.tsx`; nothing renders until
 * they resolve, so there is no swap flash.
 *
 * Space Grotesk on titles is what stops the app reading as a settings screen —
 * it is technical rather than novelty, so it survives next to the 3D room.
 * Inter carries everything else because it is legible at the 10–12px meta
 * sizes this app leans on heavily.
 *
 * `fontWeight` is intentionally NOT set alongside these: on Android a weight
 * plus a named family gives you a synthesised bold, not the real cut. The
 * weight is baked into the family name instead.
 */
export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  displayMedium: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

/** Type scale from §13.2: screen title, section header, card title, meta. */
export const typography = {
  screenTitle: { fontSize: 28, lineHeight: 34, fontFamily: fonts.display, letterSpacing: -0.5 },
  sectionHeader: { fontSize: 18, lineHeight: 24, fontFamily: fonts.display, letterSpacing: -0.2 },
  cardTitle: { fontSize: 15, lineHeight: 20, fontFamily: fonts.bodySemiBold },
  body: { fontSize: 14, lineHeight: 20, fontFamily: fonts.body },
  meta: { fontSize: 12, lineHeight: 16, fontFamily: fonts.bodyMedium },
  /**
   * Tabular figures. Every live counter in J1 review and J2's `n/50` reflows
   * as digits change width — this pins them. Spread it over another entry:
   * `{ ...typography.meta, ...typography.numeric }`.
   */
  numeric: { fontVariant: ['tabular-nums'] as 'tabular-nums'[] },
} as const;

/** Was hardcoded as `0.5` in five files. Uppercase eyebrow text wants it. */
export const letterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 0.5,
  wider: 1.2,
} as const;

/**
 * Motion (§13.2 addendum). Durations were magic numbers inside `import.tsx`.
 *
 * Every one of these must degrade to an instant render under Reduce Motion —
 * see `useReduceMotion` in `src/hooks/useReduceMotion.ts`.
 */
export const motion = {
  fast: 140,
  base: 220,
  slow: 380,
  /** Per-item delay for staggered list entrances. Above ~40ms it reads as lag. */
  stagger: 30,
  /** One spring, used everywhere, so nothing bounces differently to anything else. */
  spring: { friction: 9, tension: 90 },
} as const;

/** Press feedback. Was a mix of `opacity: 0.7` here and `accentPressed` there. */
export const interaction = {
  pressedOpacity: 0.7,
  pressedScale: 0.97,
  disabledOpacity: 0.4,
  hitSlop: 8,
  /**
   * Pointer hover — web only; touch never fires it.
   *
   * No scale. Scaling grew a card past its own layout box, so it overlapped its
   * neighbours and pushed its border outside whatever contained it. A lift and
   * a border highlight read as "this is clickable" without changing the element's
   * footprint, which is the property that made scale unusable in a grid.
   */
  hoverLift: -3,
  hoverMs: 140,
} as const;

export const theme = {
  colors,
  rarityColors,
  rarityTreatments,
  rarityGlyphs,
  gameAccents,
  spacing,
  radius,
  fonts,
  typography,
  letterSpacing,
  motion,
  interaction,
} as const;

export type Theme = typeof theme;
