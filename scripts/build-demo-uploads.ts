/**
 * Collect every importable catalogue render into `demo/`, named so you can
 * find one at a glance while demoing.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * The scanner matches an upload against the SEEDED catalogue, which is ~60
 * items per title rather than the whole game (§16 Q1). A real skin we do not
 * carry is read correctly and then has nothing to match — correct behaviour
 * that looks like a failure if it happens on stage. This folder is the set of
 * uploads that cannot do that.
 *
 * ── Why it is copied rather than pointed at ──────────────────────────────
 * `assets/collectee/items/` is named by catalogue id — `codm-dlq33-
 * lightbringer-v2.png` — which is unreadable in a file picker under pressure.
 * The copies are named "Mythic · DL Q33 — Lightbringer.png" and grouped by
 * game, so picking the right file is a glance rather than a lookup.
 *
 * ── Why `demo/` is gitignored ────────────────────────────────────────────
 * It is 51MB of files that already exist in the repo one directory over.
 * Committing a second copy would double them in every clone to save one
 * command. Run this after cloning instead:
 *
 *   npm run build:demo
 */

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'demo';

/** Catalogue fixtures, in the order they should appear in the index. */
const SOURCES = [
  { file: 'src/fixtures/items-codm.ts', game: 'Call of Duty Mobile', dir: 'codm' },
  { file: 'src/fixtures/items-valorant.ts', game: 'Valorant', dir: 'valorant' },
  { file: 'src/fixtures/items-mlbb.ts', game: 'Mobile Legends', dir: 'mlbb' },
] as const;

/** Rarest first, so the impressive ones are at the top of the folder. */
const RARITY_ORDER = ['mythic', 'legendary', 'epic', 'rare', 'common'];

interface Entry {
  id: string;
  name: string;
  tier: string;
  art: string | null;
}

const registry = readFileSync('src/config/artRegistry.ts', 'utf8');

/**
 * What the demo account already owns.
 *
 * `importFromScan` skips items already in the inventory, so uploading one of
 * these reads correctly, matches correctly, and then adds nothing — the Review
 * screen now says so, but a demo folder whose files half do nothing is a folder
 * you cannot trust under pressure.
 *
 * Parsed from the seeded ownership block rather than hardcoded, so it follows
 * the fixture. If Jovan's inventory changes, so does this set on the next run.
 */
function ownedByViewer(): Set<string> {
  const source = readFileSync('src/fixtures/owned-items.ts', 'utf8');
  const start = source.indexOf("const JOVAN = ownAll('user-jovan'");
  if (start === -1) {
    throw new Error(
      "Could not find the JOVAN ownership block in owned-items.ts. If the viewer's " +
        'fixture was renamed, update this parser — a silent empty set here would put ' +
        'un-importable files back in the demo folder.',
    );
  }
  const end = source.indexOf('\n]);', start);
  const block = source.slice(start, end);
  return new Set([...block.matchAll(/itemId: '([a-z0-9-]+)'/g)].map((m) => m[1]!));
}

const owned = ownedByViewer();

/** The bundled render for an id, or null when the item has no art yet. */
function artFor(id: string): string | null {
  const match = registry.match(
    new RegExp(`'${id}':[\\s\\S]{0,160}?require\\('\\.\\./\\.\\./(assets/[^']+)'\\)`),
  );
  return match ? match[1]! : null;
}

function parse(file: string): Entry[] {
  const source = readFileSync(file, 'utf8');
  const rows = [
    ...source.matchAll(
      /id: '([a-z0-9-]+)',\s*title: '[^']*',\s*name: '([^']*)',\s*rarityTier: '([a-z]+)'/g,
    ),
  ];
  return rows.map(([, id, name, tier]) => ({
    id: id!,
    name: name!,
    tier: tier!,
    art: artFor(id!),
  }));
}

/**
 * Safe on every filesystem, readable, and sorted by VALUE in a file picker.
 *
 * The leading digit is load-bearing. Finder sorts alphabetically, so a bare
 * rarity prefix listed Common before Mythic — exactly backwards for a folder
 * whose job is "find something impressive quickly". The number forces the
 * ladder to hold.
 *
 * Em dashes survive; slashes and colons do not.
 */
function fileNameFor(entry: Entry): string {
  const rank = RARITY_ORDER.indexOf(entry.tier) + 1;
  const tier = entry.tier[0]!.toUpperCase() + entry.tier.slice(1);
  return `${rank} ${tier} · ${entry.name}`.replace(/[/\\:]/g, '-');
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const index: string[] = [
  '# Demo uploads',
  '',
  'Every item the scanner can actually match. Drag one of these into the Import',
  "screen and it will be recognised, because these ARE the renders it compares",
  'against.',
  '',
  'Anything else — a real screenshot from your own account, a skin off the web —',
  'may read correctly and still find nothing to match, because the catalogue is',
  'seeded for this build rather than exhaustive (§16 Q1). That is expected, and',
  'the Review screen explains it.',
  '',
  '**Generated by `npm run build:demo`. Not committed — regenerate after cloning.**',
  '',
];

let copied = 0;
let missing = 0;
let alreadyOwned = 0;
const ownedNotes: string[] = [];

for (const source of SOURCES) {
  const entries = parse(source.file).sort(
    (a, b) => RARITY_ORDER.indexOf(a.tier) - RARITY_ORDER.indexOf(b.tier),
  );
  const dir = join(OUT, source.dir);
  mkdirSync(dir, { recursive: true });

  index.push(`## ${source.game}`, '');

  for (const entry of entries) {
    if (owned.has(entry.id)) {
      alreadyOwned += 1;
      ownedNotes.push(`- ${entry.name} (${source.game})`);
      continue;
    }
    if (entry.art === null || !existsSync(entry.art)) {
      missing += 1;
      index.push(`- ~~${entry.name}~~ — no render yet, cannot be demoed`);
      continue;
    }
    const ext = entry.art.slice(entry.art.lastIndexOf('.'));
    copyFileSync(entry.art, join(dir, `${fileNameFor(entry)}${ext}`));
    copied += 1;
    index.push(`- **${entry.name}** — ${entry.tier}`);
  }
  index.push('');
}

if (ownedNotes.length > 0) {
  index.push(
    '## Deliberately NOT here',
    '',
    'The demo account already owns these. They would be read and matched',
    'correctly and then import nothing, because `importFromScan` skips items',
    'already in the inventory. The Review screen labels them "In your',
    'inventory" — useful to show once on purpose, useless to hit by accident.',
    '',
    ...ownedNotes,
    '',
  );
}

writeFileSync(join(OUT, 'README.md'), index.join('\n'));

console.log(`demo/ built — ${copied} uploads across ${SOURCES.length} games`);
console.log(`${alreadyOwned} skipped: already in the demo account's inventory`);
if (missing > 0) console.log(`${missing} catalogue items have no render and were skipped`);
for (const source of SOURCES) console.log(`  demo/${source.dir}/`);
console.log('  demo/README.md');
