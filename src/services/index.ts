/**
 * The service layer — PRD §12.1.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  SCREENS IMPORT FROM HERE. SCREENS NEVER IMPORT FROM @/fixtures.    │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Every method returns a Promise even though the data is local, so replacing a
 * fixture with a real fetch in phase 2 is a change inside one service file and
 * nothing else. A synchronous fixture import inside a screen is a rewrite.
 *
 * Ownership, so two people don't edit one file (§14):
 *   scanService        → Bernard (J1)
 *   collectionService  → Bernard (J2)
 *   mediaService       → Bernard (file picking, used by J1 upload and J2 cover)
 *   roomService        → Jovan   (J3)
 *   matchService       → Marcus  (J4)
 *   newsService        → Marcus  (J5)
 *   catalogue / inventory / social → shared; change via PR announced in chat
 */

export { catalogueService, type CatalogueService } from './catalogueService';
export { collectionService, type CollectionService, type CreateCollectionInput } from './collectionService';
export { inventoryService, type InventoryService, type OwnedItemView } from './inventoryService';
export {
  matchService,
  type MatchService,
  type CollectorRecommendation,
  type CommunityRecommendation,
  type ViewerMatchState,
} from './matchService';
export {
  mediaService,
  type MediaService,
  type PickedImage,
  type PickImageResult,
  formatBytes,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
} from './mediaService';
export {
  newsService,
  type DigestResult,
  type NewsService,
  type SummaryResult,
} from './newsService';
export {
  roomService,
  type RoomService,
  type RoomStatus,
  ROOM_STAGES,
  type RoomStage,
} from './roomService';
export { scanService, type ScanService, type ScanStage, SCAN_STAGES } from './scanService';
export {
  socialService,
  type SocialService,
  type ReviewQueueEntry,
  type ReviewPreview,
} from './socialService';
export {
  threadService,
  type ThreadService,
  type ThreadSummary,
  type ThreadView,
} from './threadService';
export { delay, delayWithProgress, LATENCY_FETCH, LATENCY_GENERATE, LATENCY_INSTANT } from './latency';

export { assistantService } from './assistantService';
export type { AssistantMode } from './assistantService';
