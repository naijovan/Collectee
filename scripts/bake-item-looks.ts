/**
 * Writes one short VISUAL description per catalogue item, for the scanner to
 * match against.
 *
 *   npm run bake:item-looks
 *
 * ── The problem this solves ───────────────────────────────────────────────
 * `scanService` sends the catalogue as id, name, rarity and game. That is
 * enough for an inventory SCREENSHOT, where each tile carries a printed label
 * and the match is text against text. It is not enough for a single-item
 * upload, which is the common case (§11 F1, "kind B"): there is no label, so
 * the model must match what it SEES against a list of NAMES.
 *
 * Measured across the 54 seeded demo uploads, that matched 9. The nine were
 * Arctic Hunter, Molten Core, Sandstorm, Frostbite, Nebula Sheriff and their
 * kin — every one an item whose name happens to describe its own picture.
 * Everything called Ironclad, Blackout, Cordite Storm or Cherry Witch failed,
 * because nothing about those words predicts a colourway. MLBB, whose names are
 * almost all hero-plus-epithet, matched 0 of 18.
 *
 * With a `look` column the match becomes appearance against appearance, which
 * is the comparison the model can actually make.
 *
 * ── Why this is a bake and not a runtime call ─────────────────────────────
 * §12.1 allows no model call in the demo beyond the scan itself, and CLAUDE.md
 * is explicit that art, depth, mesh and palette bakes are build steps. This is
 * the same shape: it runs here, writes a plain TypeScript map, and the app
 * imports a constant. Nothing calls a model to render a card.
 *
 * ── Why the describer is not told the item's name ─────────────────────────
 * Deliberate. Given the name, the model writes a description of the NAME —
 * "Ironclad" becomes "armoured plating" — and the resulting text matches the
 * word we already had rather than the picture we actually ship. Blind
 * description keeps the column independent of the name, which is the entire
 * reason it is worth having.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';

const REGISTRY_PATH = 'src/config/artRegistry.ts';
const OUTPUT = 'src/config/itemLooks.ts';

/**
 * Sonnet rather than Opus. Describing one clean render is a far easier job than
 * reading a 4x4 grid of stylised labels, and this runs 94 times.
 */
const MODEL = 'claude-sonnet-5';

/** Plenty for a render; the describer does not need print resolution. */
const MAX_EDGE = 768;

const CONCURRENCY = 6;

const SYSTEM = `You describe video game cosmetic items by appearance only.

Reply with ONE phrase, under 15 words, in this shape:
  <object type>, <colours> <finish and distinguishing motifs>

Examples of the register:
  "Assault rifle, purple and gold ornate finish with glowing violet marbling"
  "Bolt-action sniper rifle, desert tan weathered camo with matte scope"
  "Female mage character, deep blue armour with crystal headdress and star motifs"
  "Weapon charm, small brass shell casing on a beaded chain"

Rules:
- Describe ONLY what is visible: the object, its colours, its finish, its motifs.
- Never guess or state a product, skin, weapon or franchise NAME.
- No rarity, no game, no commentary, no quotes, no trailing full stop.`;

interface Entry {
  id: string;
  source: string;
}

function readRegistry(): Entry[] {
  const registry = readFileSync(REGISTRY_PATH, 'utf8');
  const pattern = /^\s*'([^']+)':\s*(?:portrait|object|scene)\(\s*require\('([^']+)'\)/gm;
  const entries: Entry[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(registry)) !== null) {
    entries.push({ id: match[1]!, source: match[2]! });
  }
  if (entries.length === 0) throw new Error('No item artwork found in artRegistry.ts');
  return entries;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function describe(entry: Entry): Promise<string> {
  const path = resolve(dirname(REGISTRY_PATH), entry.source);
  const buffer = await sharp(path)
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 100,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: buffer.toString('base64') },
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/^["']|["'.]+$/g, '')
    .trim();

  if (text.length === 0) throw new Error(`empty description for ${entry.id}`);
  return text;
}

function writeOutput(looks: Map<string, string>): void {
  const lines = [...looks]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, look]) => `  '${id}': ${JSON.stringify(look)},`);

  const source = `/**
 * Generated by scripts/bake-item-looks.ts. Do not hand-edit — re-run the bake.
 *
 * One short VISUAL description per catalogue item, sent with the scan so a
 * label-less upload can be matched on appearance rather than on name. See the
 * script's header for why the scanner needs this and what it measured without
 * it.
 *
 * Descriptions are of OUR OWN prototype art, which is what the app ships and
 * therefore what a demo upload actually shows.
 */

export const ITEM_LOOKS: Record<string, string> = {
${lines.join('\n')}
};

/** The visual description for an item, or null when the bake has not seen it. */
export function lookFor(itemId: string): string | null {
  return ITEM_LOOKS[itemId] ?? null;
}
`;
  writeFileSync(OUTPUT, source);
}

async function main(): Promise<void> {
  const entries = readRegistry();
  console.log(`Describing ${entries.length} items with ${MODEL}`);

  const looks = new Map<string, string>();
  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const described = await Promise.all(
      batch.map(async (entry) => {
        try {
          return [entry.id, await describe(entry)] as const;
        } catch (error) {
          console.error(`  FAILED ${entry.id}: ${String(error).slice(0, 120)}`);
          return null;
        }
      }),
    );
    for (const row of described) {
      if (row === null) continue;
      looks.set(row[0], row[1]);
      console.log(`  ${row[0].padEnd(34)} ${row[1]}`);
    }
  }

  writeOutput(looks);
  console.log(`\nWrote ${looks.size} descriptions to ${OUTPUT}`);
  if (looks.size < entries.length) {
    console.log(`${entries.length - looks.size} failed — re-run to fill the gaps.`);
  }
}

void main();
