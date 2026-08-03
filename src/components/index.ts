/**
 * The 14 shared components from PRD §13.3, in one import surface.
 *
 * `ItemCard` · `CollectionCard` · `CollectorCard` · `ArticleCard` ·
 * `RarityBadge` · `GameBadge` · `SectionHeader` · `FilterChips` ·
 * `StepperHeader` · `PrimaryButton` / `SecondaryButton` · `Avatar` ·
 * `EmptyState` · `LoadingState` · `TabBar`
 *
 * Jovan owns all of these. Changes go via PR announced in chat — §13.3 names
 * this as the place merge conflicts will otherwise happen.
 */

export { ArticleCard, CollectionCard, CollectorCard, ItemCard, timeAgo } from './cards';
export {
  Avatar,
  EmptyState,
  FilterChips,
  GameBadge,
  ItemArt,
  LoadingState,
  PrimaryButton,
  RarityBadge,
  SecondaryButton,
  SectionHeader,
} from './primitives';
export { StepperHeader } from './StepperHeader';
export { TabBar } from './TabBar';

/** J3-specific rather than one of the 14, but shared by the build flow and the live room. */
export { RoomScene } from './RoomScene';

/**
 * Art seams. Adding artwork means adding files and a line to one of these maps
 * — never editing a component. See the header comment in each.
 */
export { BACKDROPS, backdropsReady, resolveBackdrop } from './backdrops';
export { ITEM_ART, itemArtCoverage, resolveItemArt } from './item-art';
