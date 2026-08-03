/**
 * The few Node APIs the scripts in this folder use.
 *
 * `@types/node` would pull a whole platform's typings into an app that never
 * runs on Node, for two functions in one script — and adding a dependency is a
 * conversation, not a quiet commit (§13.1). Declaring exactly what is used keeps
 * `npm run typecheck` green over `scripts/` without that.
 */

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function writeFileSync(path: string, data: string, encoding: 'utf8'): void;
}
