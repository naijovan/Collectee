/**
 * Room theme library — PRD §11 F4. Six themes for the demo.
 *
 * ⚠️ CRITICAL IP CONSTRAINT (§11 F4, §15): themes must be ORIGINAL STYLES, NOT
 * NAMED FRANCHISES. "Ancient Dojo" is fine. "Naruto dojo" generates derivative
 * work of third-party IP and is not acceptable in a product being shown to
 * publishers. Do not add a theme whose name or style prompt references a real
 * franchise, character or game.
 *
 * Each theme ships a FIXED slot map. Generation only ever produces the backdrop
 * image, never the geometry — that is what "template-conditioned" means, and it
 * is what makes placement predictable and generation cost bounded.
 *
 * Slot coordinates are fractional (0–1) so one map works at any resolution.
 * Depth: 0 = back, 1 = mid, 2 = front.
 */

import type { RoomTheme, Slot } from '@/types';

/**
 * Shared scaffold: a hero pedestal centre-front, two flanking cases, and a wall
 * register behind. Themes vary the backdrop and palette, not the geometry —
 * which is exactly the point of template-conditioned generation.
 */
function galleryScaffold(prefix: string): Slot[] {
  return [
    { id: `${prefix}-pedestal-hero`, kind: 'pedestal', x: 0.38, y: 0.44, w: 0.24, h: 0.34, depth: 2 },
    { id: `${prefix}-case-left`, kind: 'case', x: 0.08, y: 0.5, w: 0.18, h: 0.26, depth: 1 },
    { id: `${prefix}-case-right`, kind: 'case', x: 0.74, y: 0.5, w: 0.18, h: 0.26, depth: 1 },
    { id: `${prefix}-wall-1`, kind: 'wall', x: 0.12, y: 0.14, w: 0.16, h: 0.22, depth: 0 },
    { id: `${prefix}-wall-2`, kind: 'wall', x: 0.32, y: 0.1, w: 0.16, h: 0.22, depth: 0 },
    { id: `${prefix}-wall-3`, kind: 'wall', x: 0.52, y: 0.1, w: 0.16, h: 0.22, depth: 0 },
    { id: `${prefix}-wall-4`, kind: 'wall', x: 0.72, y: 0.14, w: 0.16, h: 0.22, depth: 0 },
  ];
}

export const ROOM_THEMES = [
  {
    id: 'theme-neon-vault',
    name: 'Neon Vault',
    description: 'A sealed vault lit by cold neon. Reads well with weapon blueprints.',
    stylePrompt:
      'a sealed concrete vault interior lit by cold cyan and magenta neon strips, ' +
      'wet reflective floor, volumetric haze, empty display pedestals, no text, no logos',
    backdropUrl: 'room-backdrops/neon-vault.png',
    slots: galleryScaffold('neon'),
    palette: ['#0A0E1A', '#12E4F0', '#F022A8'],
  },
  {
    id: 'theme-fantasy-armoury',
    name: 'Fantasy Armoury',
    description: 'Stone armoury with torchlight. Suits blades and heavy weapons.',
    stylePrompt:
      'a stone castle armoury interior, warm torchlight, iron sconces, ' +
      'empty weapon racks and stone pedestals, dust motes in the air, no text, no logos',
    backdropUrl: 'room-backdrops/fantasy-armoury.png',
    slots: galleryScaffold('armoury'),
    palette: ['#1A130C', '#E0A44C', '#8C5A2B'],
  },
  {
    id: 'theme-esports-locker',
    name: 'Esports Locker Room',
    description: 'Tournament locker room. The trophy-case read.',
    stylePrompt:
      'a modern esports team locker room, brushed metal lockers, cool LED strip lighting, ' +
      'empty glass trophy cases, polished floor, no text, no logos, no team branding',
    backdropUrl: 'room-backdrops/esports-locker.png',
    slots: galleryScaffold('locker'),
    palette: ['#101418', '#2F6BFF', '#C9D3E0'],
  },
  {
    id: 'theme-ancient-dojo',
    name: 'Ancient Dojo',
    description: 'Timber dojo at dusk. Quiet, and very good for single hero items.',
    stylePrompt:
      'an old timber martial arts dojo at dusk, paper screens, low warm lantern light, ' +
      'tatami floor, empty lacquered display stands, no text, no logos, no characters',
    backdropUrl: 'room-backdrops/ancient-dojo.png',
    slots: galleryScaffold('dojo'),
    palette: ['#171009', '#D98A3C', '#5E4326'],
  },
  {
    id: 'theme-cyber-shrine',
    name: 'Cyber Shrine',
    description: 'Shrine architecture under holographic light.',
    stylePrompt:
      'a stone shrine interior overgrown with fibre-optic filament, holographic light shafts, ' +
      'floating glass display plinths, teal and violet glow, no text, no logos',
    backdropUrl: 'room-backdrops/cyber-shrine.png',
    slots: galleryScaffold('shrine'),
    palette: ['#0B1418', '#3FE0C8', '#7A4DF0'],
  },
  {
    id: 'theme-collectors-study',
    name: "Collector's Study",
    description: 'Wood-panelled study with glass cabinets. The understated option.',
    stylePrompt:
      'a wood-panelled private study, green banker lamp light, brass fittings, ' +
      'empty glass display cabinets, leather and dark walnut, no text, no logos',
    backdropUrl: 'room-backdrops/collectors-study.png',
    slots: galleryScaffold('study'),
    palette: ['#14100C', '#C9A227', '#3B2E22'],
  },
] as const satisfies readonly RoomTheme[];

export const THEMES_BY_ID: ReadonlyMap<string, RoomTheme> = new Map(
  ROOM_THEMES.map((theme) => [theme.id, theme]),
);
