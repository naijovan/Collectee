/**
 * Showroom types — PRD §11 F4 and §12.3.
 *
 * This is the flow Jovan owns. The shapes below are the ones §12.3 flags as
 * blocking, reproduced exactly as specified.
 *
 * Interaction model reminder (§11 F4): a 2.5D parallax scene, NOT a navigable
 * 3D environment and NOT a turntable of the real in-game model. Build to this
 * spec, not to the Figma frames.
 */

import type { DisplayStyle, IsoDateString, LightingPreset, Visibility } from './common';

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
 * Room customise settings — the Edit and Customise steps of J3.
 *
 * §11 F4 marks the brightness slider and animated-lighting toggle [ROADMAP] and
 * tells us to build to the spec rather than the frames. **The team overrode
 * that on 3 Aug** and both ship for the demo, behind
 * `FEATURES.roomLightingControls` — so §14 can still cut them by flipping a
 * flag rather than reverting a screen the night before.
 */
export interface RoomSettings {
  parallaxEnabled: boolean;
  /** The current focal item — tapping another item transitions the camera to it. */
  focusedSlotId: string | null;
  lightingPreset: LightingPreset;
  /** 0–1. Drives the scene wash, not a real light model. */
  brightness: number;
  animatedLighting: boolean;
  displayStyle: DisplayStyle;
}

export interface Room {
  id: string;
  collectionId: string;
  themeId: string;
  /**
   * The room's own name, distinct from the collection's. In the frames the
   * "Neon Legends" collection becomes the "Neon Vault" room — the room is its
   * own published object, not a view of the collection.
   */
  title: string;
  description: string;
  /** Chosen at publish from a still of the room (§11 F4 export criterion). */
  coverUrl: string;
  backdropUrl: string;
  slots: Slot[];
  placements: Placement[];
  settings: RoomSettings;
  visibility: Visibility;
  allowComments: boolean;
  showOnProfile: boolean;
  /**
   * Social counts, mirroring `Collection.likeCount`.
   *
   * §15 keeps these plausible: likes and visitors in the thousands, never item
   * counts in the thousands. A room card reading "12.4K items" is the exact
   * tell a Garena panel spots.
   */
  likeCount: number;
  visitorCount: number;
  publishedAt: IsoDateString | null;
  createdAt: IsoDateString;
}
