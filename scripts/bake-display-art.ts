/**
 * Builds card-safe 3:2 artwork without altering the collectible itself.
 *
 * Older object renders are square. Showing them with `contain` in a 3:2 card
 * exposes empty bars. This build step crops each source to fill its frame, so
 * every card is edge-to-edge artwork — no bars, and no blurred stand-in for
 * the part of the frame the art does not reach. See `buildFilledFrame` for the
 * trade that crop makes.
 *
 * Original PNGs remain the source for depth maps and 3D relief materials.
 *
 *   npm run bake:display-art
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import sharp from 'sharp';

const REGISTRY_PATH = 'src/config/artRegistry.ts';
const OUTPUT_DIR = 'assets/collectee/display';
const WIDE_SOURCE_DIR = 'assets/collectee/display-sources/wide';
const COMPACT_OUTPUT_DIR = 'assets/collectee/display/compact';
const SQUARE_OUTPUT_DIR = 'assets/collectee/display/square';
const SQUARE_COMPACT_OUTPUT_DIR = 'assets/collectee/display/square/compact';
const OUTPUT_REGISTRY = 'src/config/displayArtRegistry.ts';
const WIDE_WIDTH = 1200;
const WIDE_HEIGHT = 800;
const COMPACT_WIDTH = 600;
const COMPACT_HEIGHT = 400;
const SQUARE_WIDTH = 800;
const SQUARE_COMPACT_WIDTH = 400;

interface SourceEntry {
  id: string;
  source: string;
}

function readRegistry(): SourceEntry[] {
  const registry = readFileSync(REGISTRY_PATH, 'utf8');
  const pattern = /^\s*'([^']+)':\s*(?:portrait|object|scene)\(\s*require\('([^']+)'\)/gm;
  const entries: SourceEntry[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(registry)) !== null) {
    entries.push({ id: match[1]!, source: match[2]! });
  }

  if (entries.length === 0) throw new Error('No item artwork found in artRegistry.ts');
  return entries;
}

async function buildDisplayAsset(entry: SourceEntry): Promise<void> {
  const sourcePath = resolve(dirname(REGISTRY_PATH), entry.source);
  const wideSourceOverride = resolve(WIDE_SOURCE_DIR, `${entry.id}.png`);
  const wideSourcePath = existsSync(wideSourceOverride) ? wideSourceOverride : sourcePath;
  const outputPath = resolve(OUTPUT_DIR, `${entry.id}.jpg`);

  await buildFilledFrame(wideSourcePath, outputPath, WIDE_WIDTH, WIDE_HEIGHT);

  // 600 physical pixels covers a two-column phone card at 3x density without
  // asking mobile devices to decode the full desktop texture for every tile.
  await sharp(outputPath)
    .resize(COMPACT_WIDTH, COMPACT_HEIGHT, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(resolve(COMPACT_OUTPUT_DIR, `${entry.id}.jpg`));

  /* Square boxes are common in news, collection mosaics and compact pickers.
     Baking them from the original avoids cropping the ends of a gun or blade
     from the already-landscape card rendition. */
  const squareOutputPath = resolve(SQUARE_OUTPUT_DIR, `${entry.id}.jpg`);
  await buildFilledFrame(sourcePath, squareOutputPath, SQUARE_WIDTH, SQUARE_WIDTH);

  await sharp(squareOutputPath)
    .resize(SQUARE_COMPACT_WIDTH, SQUARE_COMPACT_WIDTH, {
      fit: 'fill',
      kernel: sharp.kernel.lanczos3,
    })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(resolve(SQUARE_COMPACT_OUTPUT_DIR, `${entry.id}.jpg`));
}

/**
 * Fill the frame with artwork, cropping whatever does not fit.
 *
 * ── What this used to do, and why it changed ──────────────────────────────
 * It composited a `contain`-fitted copy of the art over a blurred, darkened
 * `cover` copy of itself. That keeps every pixel of the subject — a long rifle
 * kept both ends — at the cost of the subject occupying only part of its own
 * card, with the remainder filled by an out-of-focus version of the same image.
 *
 * On a small tile that reads as a soft vignette. At the sizes the app actually
 * uses now — 210px collection covers, overlaid inventory tiles, hero panels —
 * the bars are large enough to read as exactly what they are: blur. Every card
 * in the app had a blurred band down one axis.
 *
 * So this crops instead. The frame is filled edge to edge with real artwork and
 * nothing is faked.
 *
 * ── The trade being made ──────────────────────────────────────────────────
 * Cropping is lossy in a way blurred bars are not. A 3:2 weapon render squeezed
 * into the 1:1 square rendition loses about a third of its length, and for a
 * long silhouette that can mean the muzzle or the stock. `attention` picks the
 * most salient region rather than the centre, which keeps the interesting end
 * far more often than a naive centre crop, but it cannot keep both.
 *
 * That is survivable because `ItemArt` only requests the square rendition when
 * the box it is drawing into is itself near-square (`aspectRatio < 1.34`), so a
 * wide card still gets the wide rendition and the wide rendition of a 3:2
 * source is not cropped at all.
 */
async function buildFilledFrame(
  sourcePath: string,
  outputPath: string,
  width: number,
  height: number,
): Promise<void> {
  await sharp(sourcePath)
    .resize(width, height, {
      fit: 'cover',
      position: sharp.strategy.attention,
      kernel: sharp.kernel.lanczos3,
    })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toFile(outputPath);
}

function writeRegistry(entries: SourceEntry[]): void {
  const lines = entries.map(
    ({ id }) =>
      `  '${id}': {\n` +
      `    wide: require('../../assets/collectee/display/${id}.jpg'),\n` +
      `    compact: require('../../assets/collectee/display/compact/${id}.jpg'),\n` +
      `    squareWide: require('../../assets/collectee/display/square/${id}.jpg'),\n` +
      `    squareCompact: require('../../assets/collectee/display/square/compact/${id}.jpg'),\n` +
      `  },`,
  );
  const source = `/**\n * Generated by scripts/bake-display-art.ts. Do not hand-edit.\n * Card-safe artwork only; 3D surfaces continue to use artRegistry's originals.\n */\n\nimport type { ImageSourcePropType } from 'react-native';\n\nexport interface DisplayArtSource {\n  wide: ImageSourcePropType;\n  compact: ImageSourcePropType;\n  squareWide: ImageSourcePropType;\n  squareCompact: ImageSourcePropType;\n}\n\nexport const DISPLAY_ART: Record<string, DisplayArtSource> = {\n${lines.join('\n')}\n};\n`;
  writeFileSync(OUTPUT_REGISTRY, source);
}

async function main(): Promise<void> {
  const entries = readRegistry();
  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(COMPACT_OUTPUT_DIR, { recursive: true });
  mkdirSync(SQUARE_OUTPUT_DIR, { recursive: true });
  mkdirSync(SQUARE_COMPACT_OUTPUT_DIR, { recursive: true });

  for (const entry of entries) {
    await buildDisplayAsset(entry);
    console.log(`Built ${entry.id}`);
  }

  writeRegistry(entries);
  console.log(`Wrote ${entries.length} display assets and ${OUTPUT_REGISTRY}`);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
