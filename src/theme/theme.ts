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

export const colors = {
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

/** §12.2 — five tiers, five colour tokens. One `<RarityBadge tier label />`. */
export const rarityColors = {
  common: '#8B94A6',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
  mythic: '#EF4444',
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

/** Type scale from §13.2: screen title, section header, card title, meta. */
export const typography = {
  screenTitle: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  sectionHeader: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  cardTitle: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  body: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  meta: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
} as const;

export const theme = { colors, rarityColors, spacing, radius, typography } as const;

export type Theme = typeof theme;
