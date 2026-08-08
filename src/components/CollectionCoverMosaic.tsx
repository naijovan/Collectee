/**
 * Collection cover, composed in code from the collection's own item renders.
 *
 * Jovan owns every component in src/components/. This file is new rather than an
 * edit to `cards.tsx`, so it cannot conflict with work in progress there.
 *
 * Why compose instead of shipping a cover image: the art pack's rule is one
 * subject per file, and a collection is by definition several items. Baking a
 * collage would freeze the membership into a bitmap — the cover would then lie
 * the moment someone adds an item, and no single collectible could ever be
 * focused or animated on its own. Panels stay separate `ItemArt` elements, so
 * each one is still the item it represents.
 *
 * Degrades on purpose: with fewer than two rendered members it falls back to a
 * single `ItemArt`, which is exactly what covers looked like before. 73 of the
 * 93 catalogue items still have no render, so most seeded collections take that
 * path today.
 *
 * ── Panels are slanted, matching the Home hero ────────────────────────────
 * The hero splits its artwork into skewed columns and it is the most striking
 * thing on the screen, so covers now use the same geometry. The fallback is
 * deliberately NOT slanted: one panel skewed is just a crooked picture, and
 * the effect only reads as intentional when there are seams to see.
 */

import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { hasArt } from '@/config/artRegistry';
import type { RarityTier } from '@/types';

import { ItemArt } from './primitives';

export function CollectionCoverMosaic({
  itemIds,
  tier,
  style,
  fallbackSeed,
  max = 3,
}: {
  /** The collection's members, in display order — first is the featured item. */
  itemIds: readonly string[];
  /** Drives the colour-block fallback for members with no render yet. */
  tier: RarityTier;
  style?: StyleProp<ViewStyle>;
  /**
   * Seed for the block when no member has a render. Pass the collection id to
   * keep the hue a collection has always had, rather than moving it to a
   * member's id and changing cards on screens nobody meant to touch.
   */
  fallbackSeed?: string;
  /**
   * Three panels. Every cover box in the app is short and wide, so a panel is
   * `boxWidth / max` across — at four, each column is narrower than a face and
   * the cover reads as abstract texture rather than as items. Three is the
   * most that still shows what a thing is, and it gives a better sense of the
   * collection's contents than two.
   */
  max?: number;
}) {
  const { width } = useWindowDimensions();
  // Two panels on phones keep each subject close to square. Three columns in a
  // half-width phone card turn horizontal guns into unrecognisable slivers.
  const panelLimit = width < 600 ? Math.min(max, 2) : max;
  const panels = itemIds.filter(hasArt).slice(0, panelLimit);

  // One render still beats a block, so only zero falls all the way through.
  if (panels.length < 2) {
    return <ItemArt seed={panels[0] ?? fallbackSeed ?? itemIds[0] ?? ''} tier={tier} style={style} />;
  }

  return (
    <View style={[styles.mosaic, style]}>
      {/*
        ── Slanted panels, the same construction as the Home hero ────────────
        The row is WIDER than the cover and absolutely positioned, so the
        triangles the skew leaves at the outer edges fall outside the box and
        get clipped. Without the bleed the first and last panels would show a
        wedge of background at top-left and bottom-right.
      */}
      <View style={styles.slantRow}>
        {panels.map((itemId, index) => (
          <View key={itemId} style={[styles.slantPanel, index > 0 && styles.slantPanelNext]}>
            {/* Counter-skewed by the same angle, so the artwork itself is not
                sheared — only the window it is seen through. The extra width
                and negative margin give the rotated image enough bleed to
                reach the panel's corners. */}
            <ItemArt seed={itemId} tier={tier} style={styles.slantArt} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * How far the panel row extends past the cover on each side.
 *
 * A skew of `SLANT_DEGREES` moves each edge horizontally by
 * `height * tan(angle) / 2` — about 8% of the height. 24px covers the 210px
 * covers the app uses with room to spare, and anything past the edge is
 * clipped, so being generous costs nothing.
 */
const SLANT_BLEED = 24;
const SLANT_DEGREES = '-9deg';
const SLANT_COUNTER = '9deg';

const styles = StyleSheet.create({
  mosaic: { overflow: 'hidden' },
  slantRow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -SLANT_BLEED,
    right: -SLANT_BLEED,
    flexDirection: 'row',
  },
  slantPanel: { flex: 1, overflow: 'hidden', transform: [{ skewX: SLANT_DEGREES }] },
  /* One pixel of overlap. Adjacent skewed panels tile exactly in theory, but
     fractional panel widths leave a hairline of background between them. */
  slantPanelNext: { marginLeft: -1 },
  slantArt: { width: '128%', height: '100%', marginLeft: '-14%', borderRadius: 0,
    transform: [{ skewX: SLANT_COUNTER }] },
});
