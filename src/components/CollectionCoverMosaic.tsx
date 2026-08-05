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
 */

import { StyleSheet, View } from 'react-native';
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
  const panels = itemIds.filter(hasArt).slice(0, max);

  // One render still beats a block, so only zero falls all the way through.
  if (panels.length < 2) {
    return <ItemArt seed={panels[0] ?? fallbackSeed ?? itemIds[0] ?? ''} tier={tier} style={style} />;
  }

  return (
    <View style={[styles.mosaic, style]}>
      {panels.map((itemId) => (
        <ItemArt key={itemId} seed={itemId} tier={tier} style={styles.panel} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  /** The seam is a 1px gap, not a border, so it takes no theme colour. */
  mosaic: { flexDirection: 'row', overflow: 'hidden', gap: 1 },
  panel: { flex: 1, height: '100%', borderRadius: 0 },
});
