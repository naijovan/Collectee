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
 *   roomService        → Jovan   (J3)
 *   matchService       → Marcus  (J4)
 *   newsService        → Marcus  (J5)
 *   catalogue / inventory / social → shared; change via PR announced in chat
 */

export { catalogueService, type CatalogueService } from './catalogueService';
export { collectionService, type CollectionService, type CreateCollectionInput } from './collectionService';
export { inventoryService, type InventoryService, type OwnedItemView } from './inventoryService';
export { matchService, type MatchService, type CollectorRecommendation, type CommunityRecommendation } from './matchService';
export { newsService, type NewsService } from './newsService';
export { roomService, type RoomService, ROOM_STAGES, type RoomStage } from './roomService';
export { scanService, type ScanService, type ScanStage, SCAN_STAGES } from './scanService';
export { socialService, type SocialService } from './socialService';
export { delay, delayWithProgress, LATENCY_FETCH, LATENCY_GENERATE, LATENCY_INSTANT } from './latency';
