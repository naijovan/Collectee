/**
 * Which room a collection wants — PRD §11 F4, and §11 F5's rule about reasons.
 *
 * Pure logic, no I/O, per the architecture note in CLAUDE.md.
 *
 * ── Why this replaces the old recommender ─────────────────────────────────
 * `roomService.recommendTheme` scored one signal — cross-game or not — and so
 * could only ever return two of the six themes. Four themes were unreachable,
 * and the reason string was the same sentence every time.
 *
 * This scores every theme on four independent signals and returns them ranked,
 * so the suggestion is defensible rather than decorative:
 *
 *   colour     the collection's actual dominant colours against the theme
 *              palette, from `itemPalette` — baked from the renders themselves
 *   rarity     how much of the collection is high-tier
 *   title      one game or several, and which
 *   form       weapons, blades or characters, from the catalogue
 *
 * ── The reason is not decoration (§11 F5) ─────────────────────────────────
 * "Match results always carry a human-readable `reason`. A percentage without
 * its reason is a broken feature, not a styling choice." The same standard
 * applies here: every suggestion names the signal that actually drove it, and
 * the reason is built from the winning signals rather than written in advance.
 *
 * ── Honest-pitch note (§12.1) ─────────────────────────────────────────────
 * There is no model call here. This is deterministic scoring over data the app
 * already has, presented as a suggestion. If asked on stage, say that — the
 * item colours ARE derived from the artwork by a real offline pass, but the
 * ranking itself is arithmetic.
 */

import { colourFor } from '@/config/itemPalette';
import type { Item, RoomTheme } from '@/types';

export interface RoomSuggestion {
  theme: RoomTheme;
  /** 0–1. Comparable across themes for the same collection, not across collections. */
  score: number;
  /** Human-readable, always populated. Never render a score without it. */
  reason: string;
  /** The signals that contributed, strongest first. Drives the detail view. */
  signals: string[];
}

/**
 * What each theme is for, as data rather than branches.
 *
 * `hues` are the hue angles the theme sits comfortably beside, in degrees.
 * Everything else is a weight in 0–1. Tuning the library means editing this
 * table, not rewriting the scorer.
 */
const PROFILES: Record<
  string,
  {
    hues: number[];
    rarity: 'high' | 'any' | 'collector';
    titles: 'cross' | 'single' | 'any';
    forms: Array<'weapon' | 'blade' | 'character'>;
  }
> = {
  'theme-weapon-vault': { hues: [190, 320], rarity: 'high', titles: 'cross', forms: ['weapon'] },
  'theme-anime-dojo': { hues: [350, 200], rarity: 'any', titles: 'single', forms: ['character'] },
  'theme-fantasy-armoury': { hues: [30, 45], rarity: 'any', titles: 'any', forms: ['blade'] },
  'theme-esports-locker': { hues: [215, 210], rarity: 'any', titles: 'cross', forms: ['weapon'] },
  'theme-cyber-shrine': { hues: [170, 265], rarity: 'high', titles: 'any', forms: ['character', 'blade'] },
  'theme-collectors-study': { hues: [45, 25], rarity: 'collector', titles: 'single', forms: ['weapon', 'blade'] },
};

/** Every theme, ranked. Highest first; ties broken by theme order for stability. */
export function suggestRooms(
  items: readonly Item[],
  themes: readonly RoomTheme[],
): RoomSuggestion[] {
  if (items.length === 0 || themes.length === 0) return [];

  const profile = describe(items);

  return themes
    .map((theme) => score(theme, profile))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry);
}

/** The single best room for a collection, or null when there is nothing to go on. */
export function suggestRoom(
  items: readonly Item[],
  themes: readonly RoomTheme[],
): RoomSuggestion | null {
  return suggestRooms(items, themes)[0] ?? null;
}

interface CollectionProfile {
  hue: number | null;
  /** 0–1 share of mythic or legendary. */
  highRarity: number;
  /** 0–1 share of the single most common tier being `mythic`. */
  collector: number;
  titles: Set<string>;
  forms: { weapon: number; blade: number; character: number };
  topForm: 'weapon' | 'blade' | 'character';
  count: number;
}

function describe(items: readonly Item[]): CollectionProfile {
  const titles = new Set<string>();
  const forms = { weapon: 0, blade: 0, character: 0 };
  let high = 0;
  let mythic = 0;

  // Hue is averaged on the unit circle, not arithmetically — the mean of 350°
  // and 10° is 0°, not 180°, and a red collection must not read as cyan.
  let sinSum = 0;
  let cosSum = 0;
  let hueWeight = 0;

  for (const item of items) {
    titles.add(item.title);
    if (item.rarityTier === 'mythic' || item.rarityTier === 'legendary') high += 1;
    if (item.rarityTier === 'mythic') mythic += 1;
    forms[formOf(item)] += 1;

    const rgb = colourFor(item.id);
    if (!rgb) continue;
    const { hue, saturation } = toHsv(rgb);
    // Greys have a meaningless hue; weight them out rather than letting a
    // gunmetal render drag the average somewhere arbitrary.
    const w = saturation;
    sinSum += Math.sin((hue * Math.PI) / 180) * w;
    cosSum += Math.cos((hue * Math.PI) / 180) * w;
    hueWeight += w;
  }

  const topForm = (Object.entries(forms).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    'weapon') as CollectionProfile['topForm'];

  return {
    hue:
      hueWeight > 0.4
        ? (((Math.atan2(sinSum, cosSum) * 180) / Math.PI) + 360) % 360
        : null,
    highRarity: high / items.length,
    collector: mythic / items.length,
    titles,
    forms,
    topForm,
    count: items.length,
  };
}

function score(theme: RoomTheme, profile: CollectionProfile): RoomSuggestion {
  const spec = PROFILES[theme.id];
  const parts: Array<{ weight: number; text: string }> = [];

  // ── colour ──────────────────────────────────────────────────────────────
  let colour = 0.5;
  if (spec && profile.hue !== null) {
    const nearest = Math.min(...spec.hues.map((h) => hueGap(h, profile.hue!)));
    colour = 1 - Math.min(nearest, 180) / 180;
    if (colour > 0.72) {
      parts.push({ weight: colour, text: `its ${hueName(profile.hue)} palette` });
    }
  }

  // ── rarity ──────────────────────────────────────────────────────────────
  let rarity = 0.5;
  if (spec?.rarity === 'high') {
    rarity = profile.highRarity;
    if (rarity > 0.5) {
      parts.push({
        weight: rarity,
        text: `${Math.round(rarity * 100)}% high-rarity items`,
      });
    }
  } else if (spec?.rarity === 'collector') {
    rarity = profile.collector;
    if (rarity > 0.35) {
      parts.push({ weight: rarity, text: 'a collector-tier core' });
    }
  }

  // ── title mix ───────────────────────────────────────────────────────────
  const cross = profile.titles.size > 1;
  let title = 0.5;
  if (spec?.titles === 'cross') {
    title = cross ? 0.9 : 0.25;
    if (cross) parts.push({ weight: 0.9, text: `${profile.titles.size} titles side by side` });
  } else if (spec?.titles === 'single') {
    title = cross ? 0.3 : 0.9;
    if (!cross) {
      parts.push({ weight: 0.9, text: `a single-title ${[...profile.titles][0]} set` });
    }
  }

  // ── form ────────────────────────────────────────────────────────────────
  let form = 0.4;
  if (spec?.forms.includes(profile.topForm)) {
    form = 0.9;
    parts.push({ weight: 0.85, text: `mostly ${formLabel(profile.topForm)}` });
  }

  const total = colour * 0.3 + rarity * 0.25 + title * 0.2 + form * 0.25;

  const top = parts.sort((a, b) => b.weight - a.weight).slice(0, 2).map((p) => p.text);
  const reason =
    top.length > 0
      ? `Matches ${top.join(' and ')}`
      : `A neutral fit for ${profile.count} items across ${profile.titles.size} title${profile.titles.size === 1 ? '' : 's'}`;

  return { theme, score: Math.min(1, total), reason, signals: top };
}

/** Rough shape of an item, from the catalogue rather than from the art. */
function formOf(item: Item): 'weapon' | 'blade' | 'character' {
  const name = item.name.toLowerCase();
  if (/karambit|knife|blade|dagger|sword|katana|butterfly/.test(name)) return 'blade';
  // MLBB cosmetics are hero skins; CODM operators read the same way.
  if (item.title === 'mlbb' || /—\s*(ghost|price|soap|alias|mace)/.test(name)) return 'character';
  return 'weapon';
}

function formLabel(form: 'weapon' | 'blade' | 'character'): string {
  return form === 'blade' ? 'blades' : form === 'character' ? 'character skins' : 'weapons';
}

/** Shortest distance between two hue angles, in degrees. */
function hueGap(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

function hueName(hue: number): string {
  if (hue < 20 || hue >= 340) return 'red';
  if (hue < 45) return 'amber';
  if (hue < 70) return 'gold';
  if (hue < 160) return 'green';
  if (hue < 200) return 'teal';
  if (hue < 250) return 'blue';
  if (hue < 290) return 'violet';
  return 'magenta';
}

function toHsv(rgb: readonly [number, number, number]): { hue: number; saturation: number } {
  const [r, g, b] = rgb.map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const span = max - min;
  if (span === 0) return { hue: 0, saturation: 0 };

  let hue: number;
  if (max === r) hue = 60 * (((g - b) / span) % 6);
  else if (max === g) hue = 60 * ((b - r) / span + 2);
  else hue = 60 * ((r - g) / span + 4);

  return { hue: (hue + 360) % 360, saturation: max === 0 ? 0 : span / max };
}
