/**
 * Art coverage audit — which catalogue items still render as colour blocks.
 *
 * `ItemArt` falls back to a deterministic colour block when `config/artRegistry`
 * has no entry for an item id, so a missing render is invisible to typecheck and
 * to `validate:fixtures`. This script is the only thing that can see the gap.
 *
 * Run from the repo root:
 *   npm run audit:art             → summary + per-surface breakdown
 *   npm run audit:art -- --brief  → also writes assets/collectee/MISSING-ART.md
 *
 * The registry is read as TEXT, not imported: it `require()`s PNGs, which only
 * Metro can resolve. Keys are extracted by regex, which is why the regex is
 * anchored to the two-space indent the file is formatted with.
 */

import { readFileSync, writeFileSync } from 'node:fs';

import { ALL_ITEMS } from '../src/fixtures/catalogue';
import { COLLECTIONS, ROOMS } from '../src/fixtures/collections';
import { OWNED_ITEMS } from '../src/fixtures/owned-items';
import { SCAN_RESULTS } from '../src/fixtures/scan-results';
import { VIEWER_ID } from '../src/fixtures/users';
import { ARTICLES } from '../src/fixtures/articles';
import { ROOM_THEMES } from '../src/fixtures/room-themes';
import { GAME_LABELS } from '../src/types';
import type { Item } from '../src/types';

/** Paths are relative to the repo root, like the other entries in `scripts`. */
const REGISTRY = 'src/config/artRegistry.ts';
const BRIEF = 'assets/collectee/MISSING-ART.md';

// ── Which ids have a render ────────────────────────────────────────────────
const registrySource = readFileSync(REGISTRY, 'utf8');
const covered = new Set<string>(
  [...registrySource.matchAll(/^ {2}'([a-z0-9-]+)':\s*(?:portrait|object)\(/gm)].map((m) => m[1]!),
);
if (covered.size === 0) throw new Error('Parsed 0 registry keys — the regex no longer matches.');

// ── Which surfaces show each item ──────────────────────────────────────────
/** Ordered by how early a judge sees it. First hit wins as the item's priority. */
const SURFACES = ['Import scan', 'Collection cover', 'Room shelf', 'Owned', 'News', 'Catalogue only'] as const;
type Surface = (typeof SURFACES)[number];

const scanIds = new Set<string>();
for (const scan of SCAN_RESULTS) {
  for (const d of scan.detections) {
    if (d.itemId) scanIds.add(d.itemId);
    for (const c of d.candidateItemIds) scanIds.add(c);
  }
}

const collectionIds = new Set<string>(COLLECTIONS.flatMap((c) => c.itemIds));

const ownedById = new Map<string, { itemId: string }>(OWNED_ITEMS.map((o) => [o.id, o]));
const roomIds = new Set<string>(
  ROOMS.flatMap((r) => r.placements.map((p) => ownedById.get(p.ownedItemId)?.itemId ?? '')),
);

const viewerIds = new Set<string>(
  OWNED_ITEMS.filter((o) => o.userId === VIEWER_ID).map((o) => o.itemId),
);
const anyOwnedIds = new Set<string>(OWNED_ITEMS.map((o) => o.itemId));
const newsIds = new Set<string>(ARTICLES.flatMap((a) => a.relatedItemIds));

function surfaceFor(id: string): Surface {
  if (scanIds.has(id)) return 'Import scan';
  if (collectionIds.has(id)) return 'Collection cover';
  if (roomIds.has(id)) return 'Room shelf';
  if (viewerIds.has(id) || anyOwnedIds.has(id)) return 'Owned';
  if (newsIds.has(id)) return 'News';
  return 'Catalogue only';
}

// ── Shape class, which decides the crop the generator must produce ─────────
/**
 * The pack ships two shapes (see artRegistry): 3:2 character portraits that fill
 * their frame, and 1:1 objects on empty backgrounds that must never be cropped.
 * A gun rendered as a portrait gets its barrel sliced off, so the brief has to
 * carry the shape.
 */
type Shape = 'portrait' | 'object';

/** CODM operator skins, i.e. people. Everything else in that catalogue is a thing. */
const OPERATORS = ['Ghost', 'Alias', 'Price', 'Soap', 'Mace'];

function shapeFor(item: Item): Shape {
  if (item.title === 'mlbb') return 'portrait';
  if (item.title === 'codm' && OPERATORS.includes(item.name.split(' — ')[0]!)) return 'portrait';
  return 'object';
}

/**
 * What to actually draw, described WITHOUT the item's display name.
 *
 * The catalogue is seeded with real skin and hero names on purpose (§16 Q1 — a
 * Garena panel spots fake names instantly), which makes every name here a
 * trademark. Feeding "Elderflame Vandal" or "Gusion — Cyber Faust" to an image
 * model produces a knockoff of a shipped Riot or Moonton skin, and §15 lists
 * exactly that as the IP risk that sinks the demo. So the brief carries the
 * subject class and the palette, and the name stays behind as the filename.
 */

/** Last token for Valorant (`Prime Vandal`), lead token for CODM (`QQ9 — Diavolo`). */
const WEAPON_CLASS: Record<string, string> = {
  // Valorant
  Vandal: 'assault rifle',
  Phantom: 'suppressed assault rifle',
  Operator: 'bolt-action sniper rifle',
  Spectre: 'compact submachine gun',
  Guardian: 'semi-automatic marksman rifle',
  Bulldog: 'burst-fire carbine',
  Sheriff: 'heavy single-action pistol',
  Ghost: 'suppressed sidearm pistol',
  Classic: 'small sidearm pistol',
  Karambit: 'curved fixed-blade melee knife',
  Knife: 'combat melee knife',
  Dagger: 'ornate melee dagger',
  Sword: 'broad two-handed melee sword',
  Waveform: 'abstract energy melee weapon',
  // CODM
  'DL Q33': 'bolt-action sniper rifle',
  Locus: 'bolt-action sniper rifle',
  Fennec: 'compact submachine gun',
  QQ9: 'compact submachine gun',
  'MAC-10': 'compact submachine gun',
  'PDW-57': 'submachine gun',
  'RUS-79U': 'short submachine gun',
  AK117: 'assault rifle',
  ASM10: 'battle rifle',
  'DR-H': 'assault rifle',
  M4: 'assault rifle',
  HBRa3: 'assault rifle',
  'KILO 141': 'assault rifle',
};

/**
 * Motif keyword → palette and finish. Matched against the theme half of the
 * name, so one dictionary covers all three catalogues; unmatched items fall back
 * to their rarity colour, which is never wrong, only generic.
 */
const LOOKS: readonly (readonly [RegExp, string])[] = [
  [/glacier|arctic|frost|permafrost|glacial/i, 'icy blue and white, frozen crystal surfaces'],
  [/molten|ember|cordite|diavolo|inferno|flame|elderflame/i, 'red and orange, glowing molten seams'],
  [/tidal|abyss|riptide|monsoon|deep|wave/i, 'deep teal and sea green, wet iridescent sheen'],
  [/nightfall|blackout|shadow|obsidian|onyx/i, 'matte black and cold violet, minimal highlights'],
  [/neon|cyber|glitch|prism|spectrum|protocol|circuit/i, 'magenta and cyan neon on dark chrome'],
  [/gold|solar|royal|luxe|sovereign|lightbringer|ascended|radiant/i, 'gold and ivory, warm polished metal'],
  [/void|nebula|singular|cosmic|aeon|manifold|starfall|zodiac/i, 'violet and black, star-field depth'],
  [/serpent|virulent|toxic|venom/i, 'acid green and dark bronze'],
  [/cherry|blossom|valentine|sweetheart|rose|modena|butterfly/i, 'pink and rose gold, soft petals'],
  [/dojo|eastern|panda|matador|feathery|wonderland/i, 'lacquer red and cream, painted ornament'],
  [/sand|desert|urban|olive|recruit|infantry|ironclad|dog tag|brass/i, 'muted khaki and gunmetal, worn field finish'],
  [/skull|cerberus|revenant|ruination|araxys/i, 'bone white and rust, carved relief'],
  [/ion|origin|sarmad|conqueror|paladin|vanguard/i, 'steel blue and silver, hard-edged plating'],
];

const RARITY_LOOK: Record<string, string> = {
  common: 'plain grey, no effects',
  rare: 'cool blue accents',
  epic: 'violet accents with a light glow',
  legendary: 'amber and gold accents with a strong glow',
  mythic: 'crimson accents with heavy energy effects',
};

function lookFor(item: Item): string {
  const theme = item.name.includes(' — ') ? item.name.split(' — ')[1]! : item.name;
  return (
    LOOKS.find(([pattern]) => pattern.test(theme))?.[1] ?? RARITY_LOOK[item.rarityTier] ?? 'neutral'
  );
}

/** The subject class, named generically. */
function subjectFor(item: Item): string {
  if (item.title === 'mlbb') return 'stylised fantasy hero character';
  const lead = item.name.split(' — ')[0]!;
  if (item.title === 'codm' && OPERATORS.includes(lead)) return 'masked military operator';
  if (/^Charm/.test(item.name)) return 'small hanging trinket charm';
  if (/^Camo/.test(item.name)) return 'assault rifle in a patterned camouflage finish';
  const last = item.name.split(' ').at(-1)!;
  return WEAPON_CLASS[lead] ?? WEAPON_CLASS[last] ?? 'game weapon cosmetic';
}

function promptFor(item: Item): string {
  const look = lookFor(item);
  return shapeFor(item) === 'portrait'
    ? `Original concept art, head-and-shoulders portrait of a ${subjectFor(item)}, ` +
        `${look}, dramatic rim lighting, dark background, 3:2, no text, no logos`
    : `Original concept art, single ${subjectFor(item)} in three-quarter view, ${look}, ` +
        `centred on a plain dark background, studio product lighting, 1:1, no text, no logos`;
}

/** `item-art/codm/qq9-diavolo.png` → `codm-qq9-diavolo.png`, the pack convention. */
function fileFor(item: Item): string {
  return `${item.title}-${item.renderUrl.split('/').pop()!.replace(/\.png$/, '')}.png`;
}

// ── Report ─────────────────────────────────────────────────────────────────
const missing = ALL_ITEMS.filter((item) => !covered.has(item.id));
const bySurface = new Map<Surface, Item[]>(SURFACES.map((s) => [s, []]));
for (const item of missing) bySurface.get(surfaceFor(item.id))!.push(item);

const pct = (n: number) => `${Math.round((n / ALL_ITEMS.length) * 100)}%`;

console.log(
  `\nArt coverage: ${covered.size}/${ALL_ITEMS.length} items (${pct(covered.size)}) · ` +
    `${missing.length} still render as colour blocks\n`,
);

for (const surface of SURFACES) {
  const group = bySurface.get(surface)!;
  if (group.length === 0) continue;
  console.log(`── ${surface} · ${group.length} missing`);
  for (const item of group) {
    console.log(
      `   ${shapeFor(item) === 'portrait' ? 'P' : 'O'}  ${item.name.padEnd(30)} ` +
        `${GAME_LABELS[item.title].padEnd(24)} ${item.rarityLabel.padEnd(10)} ${fileFor(item)}`,
    );
  }
  console.log('');
}

// Non-item art, which the same generation pass should cover.
// Keyed on `theme.id`, not on the `backdropUrl` filename, because `backdropFor`
// is what `RoomScene` actually calls — and those two drifted apart once already.
// The art pack shipped `theme-neon-vault` / `theme-ancient-dojo` while the
// fixtures had been renamed to `theme-weapon-vault` / `theme-anime-dojo`, so two
// themes fell through to a bare palette wash. A filename substring test misses
// that, because `theme-weapon-vault.png` happens to contain `weapon-vault.png`.
const themesMissing = ROOM_THEMES.filter((t) => !registrySource.includes(`'${t.id}':`));
console.log(`── Room backdrops · ${themesMissing.length}/${ROOM_THEMES.length} missing`);
for (const theme of themesMissing) console.log(`   ${theme.name.padEnd(30)} ${theme.backdropUrl}`);
console.log('');

// ── Optional generation brief ──────────────────────────────────────────────
if (process.argv.includes('--brief')) {
  const lines: string[] = [
    '# Missing art — generation brief',
    '',
    'Generated by `npx tsx scripts/audit-art.ts --brief`. Do not hand-edit; re-run it.',
    '',
    `Coverage today: **${covered.size} of ${ALL_ITEMS.length}** catalogue items have a render.`,
    `The ${missing.length} below fall back to \`ItemArt\`'s colour block.`,
    '',
    '## How to deliver',
    '',
    '- **P** rows are 3:2 character portraits, 660x440, framed head-and-shoulders, subject filling the frame.',
    '- **O** rows are 1:1 objects, 620x620, whole object visible with margin, plain dark background.',
    '- Use the exact filename in the **File** column. The id mapping is keyed off it.',
    '- Portraits go in `assets/collectee/subjects/`, objects in `assets/collectee/items/`.',
    '',
    '## Do not prompt with the item name',
    '',
    'The catalogue is deliberately seeded with real skin and hero names, because a Garena or',
    'Moonton panel spots invented ones instantly (§16 Q1). That makes every name in the **Item**',
    'column a trademark. Prompting an image model with "Elderflame Vandal" or "Gusion — Cyber',
    'Faust" returns a knockoff of a shipped Riot or Moonton skin, which is the IP risk §15 says',
    'sinks the demo. The **Prompt** column therefore describes the subject class and palette and',
    'never the name. Paste the prompt, keep the filename, ignore the item name.',
    '',
  ];

  for (const surface of SURFACES) {
    const group = bySurface.get(surface)!;
    if (group.length === 0) continue;
    lines.push(`## ${surface} — ${group.length} items`, '');
    lines.push('| Shape | Item (do not prompt with this) | Game | Rarity | File | Prompt |');
    lines.push('| --- | --- | --- | --- | --- | --- |');
    for (const item of group) {
      lines.push(
        `| ${shapeFor(item) === 'portrait' ? 'P' : 'O'} | ${item.name} | ` +
          `${GAME_LABELS[item.title]} | ${item.rarityLabel} | \`${fileFor(item)}\` | ` +
          `${promptFor(item)} |`,
      );
    }
    lines.push('');
  }

  if (themesMissing.length > 0) {
    lines.push(`## Room backdrops — ${themesMissing.length} themes`, '');
    lines.push('16:9 backdrops, 1920x1080, no items in the scene — items are composited into the');
    lines.push('slot map at runtime. Original styles only, never a named franchise (§11 F4).', '');
    lines.push('| Theme | Filename | Prompt |');
    lines.push('| --- | --- | --- |');
    for (const theme of themesMissing) {
      lines.push(
        `| ${theme.name} | \`${theme.backdropUrl.split('/').pop()}\` | ${theme.stylePrompt} |`,
      );
    }
    lines.push('');
  }

  writeFileSync(BRIEF, lines.join('\n'), 'utf8');
  console.log(`Brief written to ${BRIEF}\n`);
}
