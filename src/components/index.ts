/**
 * The 14 shared components from PRD §13.3, in one import surface.
 *
 * `ItemCard` · `CollectionCard` · `CollectorCard` · `ArticleCard` ·
 * `RarityBadge` · `GameBadge` · `TagBadge` · `SectionHeader` · `FilterChips` ·
 * `StepperHeader` · `PrimaryButton` / `SecondaryButton` · `Avatar` ·
 * `EmptyState` · `LoadingState` · `TabBar`
 *
 * Plus `FadeInView`, the one entrance animation — see its comment for why the
 * stagger has to be shared rather than reimplemented per screen.
 *
 * Jovan owns all of these. Changes go via PR announced in chat — §13.3 names
 * this as the place merge conflicts will otherwise happen.
 */

export {
  ArticleCard,
  CollectionCard,
  CollectorCard,
  CommunityArt,
  CommunityCard,
  ItemCard,
  timeAgo,
} from './cards';
export { AppBackground, AppBackgroundFrame } from './AppBackground';
export { AvatarPicker } from './AvatarPicker';
export { CollectionCoverMosaic } from './CollectionCoverMosaic';
export {
  Avatar,
  EmptyState,
  FadeInView,
  FilterChips,
  GameBadge,
  TagBadge,
  ItemArt,
  LoadingState,
  AccentFill,
  PrimaryButton,
  RarityBadge,
  SecondaryButton,
  SectionHeader,
} from './primitives';
export { KeyboardSafe } from './KeyboardSafe';
export { StepperHeader } from './StepperHeader';
export { TabBar } from './TabBar';

/** J3-specific rather than one of the 14, but shared by the build flow and the live room. */
export { RoomScene } from './RoomScene';
export { Collectible3DViewer } from './Collectible3DViewer';
export { ArtworkRelief3D } from './ArtworkRelief3D';
export { ImmersiveRoom3D } from './ImmersiveRoom3D';

/**
 * Art seams. Adding artwork means adding files and a line to one of these maps
 * — never editing a component. See the header comment in each.
 */
export { BACKDROPS, backdropsReady, resolveBackdrop } from './backdrops';
export { ITEM_ART, itemArtCoverage, resolveItemArt } from './item-art';

/** News game-tab hero. Its art seam is `config/newsBanners`. */
export { NewsBanner, BANNER_ASPECT } from './NewsBanner';

/** First-run walkthrough. Draws over the app rather than changing any of it. */
export { TourOverlay } from './TourOverlay';

export { AssistantButton, ASSISTANT_CLEARANCE } from './AssistantButton';
export { AssistantPanel } from './AssistantPanel';
export { useHoverLift } from './primitives';

export { BrandMark } from './BrandMark';
export { PinnedHeader } from './PinnedHeader';
