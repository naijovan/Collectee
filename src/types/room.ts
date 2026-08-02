/**
 * Collection Room types — PRD §11 F4 and §12.3.
 *
 * This is the flow Jovan owns. The shapes below are the ones §12.3 flags as
 * blocking, reproduced exactly as specified.
 *
 * Interaction model reminder (§11 F4): a 2.5D parallax scene, NOT a navigable
 * 3D environment and NOT a turntable of the real in-game model. Build to this
 * spec, not to the Figma frames.
 */

import type { IsoDateString, Visibility } from './common';

/**
 * A fixed placement location in a themed room.
 *
 * Coordinates are FRACTIONAL (0–1), not pixel, so one slot map works at any
 * backdrop resolution and on any device. Each theme ships a fixed slot map;
 * generation only ever produces the backdrop image, never the geometry.
 * This is what "template-conditioned" in §11 F4 means concretely.
 */
export interface Slot {
  id: string;
  kind: 'pedestal' | 'wall' | 'case';
  /** 0–1, fraction of backdrop width. */
  x: number;
  /** 0–1, fraction of backdrop height. */
  y: number;
  /** 0–1, fraction of backdrop width. */
  w: number;
  /** 0–1, fraction of backdrop height. */
  h: number;
  /** Parallax layer: 0 = back, 2 = front. */
  depth: 0 | 1 | 2;
}

export interface Placement {
  slotId: string;
  ownedItemId: string;
  /** Degrees. */
  rotation: number;
}

/**
 * A room theme. PRD §11 F4: themes must be ORIGINAL styles, never named
 * franchises — "Ancient Dojo" is fine, "Naruto dojo" generates derivative work
 * of third-party IP.
 */
export interface RoomTheme {
  id: string;
  name: string;
  description: string;
  /** Style prompt used for template-conditioned backdrop generation. */
  stylePrompt: string;
  /** Bundled backdrop for the demo — generation is mocked (§12.1). */
  backdropUrl: string;
  /** Fixed slot map. Generation never produces geometry. */
  slots: Slot[];
  /** Dominant palette, used to key the backdrop cache. */
  palette: string[];
}

/**
 * §11 F4 scope guard: the Figma customise panel adds a brightness slider and an
 * animated-lighting toggle. Those are [ROADMAP]. `parallaxEnabled` and
 * `focusedSlotId` are the demo controls.
 */
export interface RoomSettings {
  parallaxEnabled: boolean;
  /** The current focal item — tapping another item transitions the camera to it. */
  focusedSlotId: string | null;
  /** [ROADMAP] — not built for the demo. */
  brightness?: number;
  /** [ROADMAP] — not built for the demo. */
  animatedLighting?: boolean;
}

export interface Room {
  id: string;
  collectionId: string;
  themeId: string;
  backdropUrl: string;
  slots: Slot[];
  placements: Placement[];
  settings: RoomSettings;
  visibility: Visibility;
  publishedAt: IsoDateString | null;
  createdAt: IsoDateString;
}
