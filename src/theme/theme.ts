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
 * The primary button's fill — blue into violet, across the diagonal.
 *
 * The first attempt was one shade either side of `accent`, which was too subtle
 * to read as a gradient at all: at button size a 10% luminance shift over 44px
 * just looks like a flat blue that failed to render. If a gradient is going to
 * be there, it has to be visible enough to be a decision.
 *
 * Blue → violet rather than blue → any other hue, because violet is already in
 * the palette as `rarityColors.epic`. This borrows a colour the app owns rather
 * than importing a new one, so the button still belongs to the same system.
 *
 * ⚠️ This does widen §13.2's "a single blue accent". The trade is deliberate
 * and Jovan's call: the primary button is the most repeated surface in the app
 * and the one the eye is meant to go to. `from` stays close to `accent`, so the
 * button still READS blue and only resolves into violet at its trailing corner.
 *
 * Diagonal, not vertical. A vertical ramp on a pill reads as a lighting bug —
 * a bevel that lost its highlight. Corner to corner reads as intentional.
 *
 * `pressed` inverts the direction rather than darkening a flat fill, which
 * reads as the surface tilting under the finger.
 */
export const accentGradient = {
  from: '#3B82F6',
  to: '#9333EA',
  /** Corner to corner. See above for why not vertical. */
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
} as const;

/**
 * The halo under a raised accent control — the assistant bubble and the tab
 * bar's import action.
 *
 * Both float over content rather than sitting in the layout, and a flat pill on
 * a dark backdrop has nothing separating it from what it covers. A coloured
 * shadow reads as the control being lit rather than as a drop shadow, which is
 * what makes it look raised instead of pasted on.
 *
 * Violet rather than the blue: it is the gradient's far end, so the glow looks
 * like it is coming FROM the button rather than being a second colour under it.
 *
 * Only for controls that float. A glow on an in-layout button is noise.
 */
/**
 * Text buttons — "See all", "Change", "Clear", the stepper's back link.
 *
 * These have no fill to put a gradient in, so they take the ramp's END colour
 * instead. React Native cannot gradient-fill text: the only routes are a
 * masking library (a new dependency, which §13.1 says goes through chat first)
 * or web-only `background-clip: text`, which would leave the label invisible on
 * iOS and Android. Jovan's call, 8 Aug: take the violet, skip the dependency.
 *
 * Violet rather than the blue `from` end, deliberately. A borderless label in
 * `accent` is indistinguishable from the old flat-blue button era; in violet it
 * is visibly part of the same family as the gradient CTAs without pretending to
 * be one of them.
 *
 * NOT for every accent-coloured word. Active step labels, the scan percentage
 * and the active tab are state indicators, not buttons, and they keep `accent`.
 */
/**
 * A colour sampled from `accentGradient` at `t` — 0 is the blue end, 1 the
 * violet end. Clamped, so callers can pass a raw fraction.
 *
 * This exists so a run of separate views can read as ONE gradient. A progress
 * rail is built from a view per segment, and giving each segment the same
 * two-stop gradient makes it restart at every joint — the sweep reads as
 * stripes. Sampling the ramp at each segment's own start and end fraction
 * instead makes the seams line up exactly, and the rail looks continuous.
 *
 * Lives here because it returns colours, and hex belongs to the theme
 * (CLAUDE.md). Callers pass positions, never channels.
 */
export function accentRampAt(t: number): string {
  const clamped = Math.min(1, Math.max(0, t));
  const from = accentGradient.from;
  const to = accentGradient.to;
  const channel = (offset: number) => {
    const a = parseInt(from.slice(offset, offset + 2), 16);
    const b = parseInt(to.slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * clamped)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(1)}${channel(3)}${channel(5)}`;
}

/**
 * The light end of the accent blue, for a number printed over artwork.
 *
 * `accentGradient.from` is too dark to sit on a scrim at 12px — it is a fill
 * colour, meant to have white on top of it, not to be read as text. This is the
 * same hue lifted until it holds against a photograph.
 *
 * Used for counts that are neither likes (red) nor a match score (the tiered
 * `matchTone`): a community's membership, where plain white made the only
 * number on the card indistinguishable from the sentence above it.
 */
export const accentSoft = '#93C5FD';

export const accentLink = '#A855F7';

/**
 * The tab bar's wash — a violet tint over `surface`, not the button ramp.
 *
 * Deliberately NOT `accentGradient`. A full blue→violet ramp across the bar
 * puts the import action's own gradient on top of the same two colours, and the
 * button stops reading as raised — it dissolves into its own background, which
 * is the opposite of what the glow is for.
 *
 * So: violet at very low alpha, left to right. Enough to stop the bar being a
 * flat slab, faint enough that the button still separates from it.
 */
export const tabBarWash = ['rgba(147,51,234,0.10)', 'rgba(147,51,234,0.02)'] as const;

/**
 * Frosted glass for the floating tab bar — careerlingo's `--glass-strong` plus
 * its `backdrop-filter: blur(14px)`.
 *
 * `surface` at 72% rather than solid, so whatever the bar sits over tints it
 * instead of being hidden by it. On its own that is just a see-through panel;
 * the blur is what turns it into glass, because it stops the shapes behind from
 * reading as shapes and leaves only their colour.
 *
 * ── Why the blur is web-only ──────────────────────────────────────────────
 * `backdropFilter` is a CSS property react-native-web passes through, and web
 * is the demo target. iOS and Android need `expo-blur` or a `GlassView`, and
 * neither is worth a native code path for a surface nobody will demo on a
 * phone — they get the translucency without the frost, which still reads as a
 * light panel rather than a slab.
 *
 * Cast at the call site: `backdropFilter` is not in React Native's ViewStyle,
 * because on native it is genuinely not a thing.
 */
/**
 * Frosted glass for the sticky top bar — careerlingo's `--glass` plus its
 * `backdrop-filter: blur(18px) saturate(1.2)`.
 *
 * More opaque than `tabBarGlass` (78% vs 72%) and blurred harder. Text sits
 * DIRECTLY on this one, so it has to stay legible over whatever scrolls
 * underneath; the tab bar only carries icons and 11px labels with their own
 * contrast.
 */
export const headerGlass = {
  /** `surface` at 78%. Same reason as tabBarGlass for the literal living here. */
  background: 'rgba(20,24,33,0.78)',
  blur: 'blur(18px) saturate(120%)',
} as const;

export const tabBarGlass = {
  /** `surface` at 72%. The literal is here rather than in a component so the
   *  no-raw-hex rule holds; `colors.surface` is a CSS var on web and cannot be
   *  given an alpha channel arithmetically. */
  background: 'rgba(20,24,33,0.72)',
  blur: 'blur(14px) saturate(140%)',
} as const;

export const accentGlow = {
  shadowColor: '#9333EA',
  shadowOpacity: 0.55,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 10,
} as const;

/**
 * Who can see this — one colour per visibility, so the three are told apart at
 * a glance instead of being three identical grey words across a grid of cards.
 *
 * Here rather than in `domain/collections.ts` beside `VISIBILITY_LABELS`, for
 * the same reason `rarityColors` is here: colour decisions live in this file,
 * and `src/domain` is pure logic that should not grow a dependency on the theme.
 *
 * Semantic, and the ladder runs the way exposure does — open, link-only, shut.
 * Private is the QUIETEST of the three rather than the loudest: a private
 * collection is a normal thing to have, and red would read as an error on a
 * state the user deliberately chose.
 */
/**
 * The colour a match percentage is printed in.
 *
 * One function so Explore and Home cannot drift: they showed the same score in
 * different colours, which reads as two different scales rather than one number
 * in two places.
 *
 * 65 / 40 are calibrated against the real spread, not picked from habit. The
 * seeded scores run 89 down to 20, so an 80/60 split — the obvious guess —
 * would have coloured nothing green and put most of the roster in the bottom
 * tier. These thresholds put the near-twins in green, the genuine overlaps in
 * amber, and the "you both own one common skin" tail in grey.
 *
 * Grey rather than red at the bottom: a low match is not a failure, it is a
 * collector with different taste.
 */
export function matchTone(percent: number): string {
  if (percent >= 65) return '#22C55E';
  if (percent >= 40) return '#F5A524';
  return '#6B7484';
}

export const visibilityColors = {
  public: '#22C55E',
  unlisted: '#F5A524',
  private: '#8B94A6',
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
    /**
     * Light violet, not the gold it used to be.
     *
     * `secondary` is the on-dark label colour — game badges, the hero's title
     * row, anywhere the accent has to carry 10-12px type. MLBB's was #FFC53D
     * and CODM's is #FFB347: two ambers ~10 points apart, indistinguishable at
     * that size. Every surface showing both games therefore rendered two of the
     * three in what looked like the same colour.
     *
     * Violet-300 keeps MLBB's identity (its `base` is violet, and that is what
     * its badge border and its news edge already use) while staying legible on
     * a dark chip. The three secondaries are now amber / teal / violet — three
     * hues, not two-and-a-bit.
     */
    secondary: '#C4B5FD',
    soft: 'rgba(139,92,246,0.16)',
  },
  /* `satisfies Record<GameTitle, …>` rather than a bare object: adding a fourth
     title to `GameTitle` must fail HERE, at compile time, rather than render a
     tab with `undefined` accents at runtime. The import is type-only, so it is
     erased in the build and adds no dependency from the token file to the
     domain. */
} as const satisfies Record<GameTitle, { base: string; secondary: string; soft: string }>;

/**
 * The accent for things that belong to no single game — a cross-game community,
 * a room mixing three titles.
 *
 * Deliberately outside `gameAccents`: that map is keyed by `GameTitle` and
 * adding a fourth key would break every exhaustive lookup over it. This is a
 * sibling constant of the same shape, so a badge can take either.
 *
 * Magenta because it has to survive next to all three at once. CODM's amber,
 * Valorant's teal and MLBB's light violet already occupy warm, cool and violet;
 * a pink reads as distinct from every one of them on a dark card, where a
 * fourth blue or a fourth orange would not.
 */
export const crossGameAccent = {
  base: '#EC4899',
  secondary: '#F9A8D4',
  soft: 'rgba(236,72,153,0.14)',
} as const;

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
  /**
   * Top of the field.
   *
   * Was 0.94, which was a void. Composited over the app's own tones at that
   * alpha, every one of them lands between 1.00 and 1.13 contrast against the
   * scrim itself — surfaces, accent, item art and even white text all
   * mathematically invisible. The screen behind was not muted, it was gone, so
   * a stop with a small cutout read as a character floating in black.
   *
   * 0.72 keeps it clearly de-emphasised while letting the screen survive:
   * accent 1.35, item art 1.68, white text 2.41. Enough that a judge can still
   * tell it is Home behind her.
   *
   * The spotlight does not need the extra darkness. The cutout passes 100% of
   * the screen and the field passes ~28%, so the target is still ~3.5x brighter
   * than its surroundings, and the ring and glow mark it on top of that.
   */
  top: 'rgba(9,10,26,0.72)',
  /** Bottom, where the guide stands. Slightly lifted so she is not in a pit. */
  bottom: 'rgba(5,6,15,0.64)',
  /** Edge darkening, drawn over the gradient. Eased with the field. */
  vignette: 'rgba(3,4,10,0.48)',
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

/**
 * App background — a restrained collectible-card texture behind screen content.
 * It gives the flat canvas a little object memory without turning into art the
 * user has to read around.
 *
 * These are rgba values because the component builds the background out of
 * layered washes and translucent card silhouettes. They live here under the
 * same rule as `scrim`: translucency is still a colour decision, so it belongs
 * in the token file and nowhere else.
 */
export const appBackground = {
  dark: {
    base: DARK_PALETTE.background,
    clear: 'rgba(47,107,255,0)',
    topGlow: 'rgba(47,107,255,0.065)',
    sideGlow: 'rgba(18,228,240,0.035)',
    lowerGlow: 'rgba(245,165,36,0.018)',
    cardFill: 'rgba(255,255,255,0.026)',
    cardFillCool: 'rgba(47,107,255,0.032)',
    cardFillWarm: 'rgba(245,165,36,0.022)',
    cardBorder: 'rgba(255,255,255,0.055)',
    cardLine: 'rgba(255,255,255,0.05)',
    cardLineAccent: 'rgba(56,189,248,0.07)',
    cardSheen: 'rgba(255,255,255,0.055)',
    cardShade: 'rgba(0,0,0,0.22)',
  },
  light: {
    base: LIGHT_PALETTE.background,
    clear: 'rgba(29,79,216,0)',
    topGlow: 'rgba(29,79,216,0.034)',
    sideGlow: 'rgba(15,157,99,0.018)',
    lowerGlow: 'rgba(178,106,2,0.018)',
    cardFill: 'rgba(255,255,255,0.5)',
    cardFillCool: 'rgba(29,79,216,0.035)',
    cardFillWarm: 'rgba(178,106,2,0.026)',
    cardBorder: 'rgba(11,13,16,0.075)',
    cardLine: 'rgba(11,13,16,0.045)',
    cardLineAccent: 'rgba(29,79,216,0.055)',
    cardSheen: 'rgba(255,255,255,0.72)',
    cardShade: 'rgba(11,13,16,0.035)',
  },
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
  /**
   * Page titles, sized against careerlingo's `.brand-wordmark`.
   *
   * Theirs is `clamp(2.5rem, 4.4vw, 4rem)` — 40 to 64px — with `line-height:
   * 1.22` and `letter-spacing: -0.01em`. Those are hero numbers: it is a
   * wordmark sitting in a page header, not a sticky nav title, and 40px pinned
   * to the top of a phone would eat a fifth of the viewport before any content
   * appeared.
   *
   * 34 takes their proportions without their absolute size. Line height is
   * their 1.22 exactly (34 x 1.22 = 41), and the tracking is their -0.01em
   * converted at this size (-0.34, rounded to -0.4). It reads as the same
   * typographic decision one step down the scale.
   */
  screenTitle: { fontSize: 34, lineHeight: 41, fontFamily: fonts.display, letterSpacing: -0.4 },
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
  /**
   * The name of a collection or a showroom, set over its own artwork.
   *
   * Bigger and tighter than `sectionHeader`, and carrying a shadow. All three
   * do the same job: these titles sit ON a picture, and plain white type at 21
   * disappeared into every light crop and read as a caption rather than as the
   * name of the thing. A grid of them looked like a list of files.
   *
   * The shadow is the load-bearing part. A scrim alone cannot save a light
   * label over a bright render — the mosaics with pale sky in them were exactly
   * that case — and a soft dark halo tight to the glyphs fixes it without
   * darkening the art further.
   *
   * `-0.4` tracking rather than `sectionHeader`'s `-0.2`: at 23 the display
   * face opens up, and the tighter set is what keeps a long collection name on
   * one line.
   */
  overlayTitle: {
    fontSize: 23,
    lineHeight: 28,
    fontFamily: fonts.display,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  /**
   * `overlayTitle` for cards too small to carry it at full size — an item tile
   * is a third the width of a collection cover, and 23px there wraps a two-word
   * skin name onto three lines.
   *
   * Same display face, tracking and shadow, so a grid of items and a grid of
   * collections still read as the same family; only the size steps down.
   *
   * The weight is baked into `fonts.display` (SpaceGrotesk 700) — do NOT add a
   * `fontWeight` on top. Android synthesises a second bold over an already-bold
   * cut and the result smears at this size.
   */
  overlayTitleSmall: {
    fontSize: 20,
    lineHeight: 25,
    fontFamily: fonts.display,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
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
  /**
   * HALF a cycle of any ambient, repeating animation — a glow breathing, a
   * skeleton shimmering. Use it for both legs of the loop, so one full breath
   * is 2×.
   *
   * There is one number for this because the app read as flashy while every
   * individual loop was defensible on its own: the tour glow ran a 1.8s cycle
   * and the loading skeleton a 1.5s one, so on a screen with both, the two beat
   * against each other and the faster one took the eye. A shared rate is what
   * makes several simultaneous loops read as one calm surface rather than as
   * competing for attention.
   *
   * 1300 sits between those two and the room scene's 5.2s wash, which was the
   * one loop nobody complained about. The wash keeps its own slower rate — it is
   * scene lighting behind content, not a highlight on top of it — so this is the
   * rate for loops in the FOREGROUND. Anything under about a second reads as a
   * blink rather than a breath, which is what both offenders were doing.
   *
   * This is for AMBIENT loops only. Progress that must feel like work (the
   * scanner's sweep, room generation) is deliberately faster and does not use
   * this — see the note in `app/import.tsx`.
   */
  breath: 1300,
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
  appBackground,
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
