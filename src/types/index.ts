/**
 * The merge contract (PRD §12.3). Import types from `@/types` only.
 *
 * If you need a shape that isn't here, add it here via a PR announced in chat —
 * do not define a local interface in a flow. Every flow reads the same
 * `OwnedItem` and `Collection`.
 */

export * from './common';
export * from './entities';
export * from './room';
export * from './scan';
