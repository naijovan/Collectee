/**
 * Builds the launcher, favicon and splash art from the Collectee mark.
 *
 *   npm run bake:app-icon
 *
 * The app shipped with the stock Expo template graphics — a white chevron on a
 * blue gradient — everywhere an icon appears: browser tab, splash, Android
 * launcher. This replaces them with `brand/collectee-mark.png`.
 *
 * ── Why each output differs ───────────────────────────────────────────────
 * The mark is a transparent PNG with a glow around it, and the four surfaces
 * want different things from it:
 *
 *   icon.png      Composited onto the app's own near-black. iOS and several
 *                 Android launchers composite a transparent icon onto WHITE,
 *                 and a neon-blue mark on white loses the glow that is most of
 *                 its character.
 *   favicon.png   Same treatment, small. A browser tab can be light or dark
 *                 chrome, so leaving it transparent means one of the two looks
 *                 washed out. A dark tile reads correctly on both.
 *   splash-icon   Transparent, because `app.json` already paints the splash
 *                 `#0B0D10` behind it — compositing here would draw a slightly
 *                 different black square on top of the same black.
 *   android fg    Transparent AND inset. Android masks an adaptive icon to
 *                 whatever shape the launcher uses, and only the middle ~66% is
 *                 guaranteed to survive; a mark drawn to the edges gets its
 *                 corners cut off.
 *
 * Sizes match the files being replaced, so nothing downstream has to change.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import sharp from 'sharp';

const SOURCE = 'assets/collectee/brand/collectee-mark.png';
const OUT_DIR = 'assets/images';

/** The app's background, and the same value `app.json` gives the splash. */
const BACKDROP = { r: 0x0b, g: 0x0d, b: 0x10, alpha: 1 };

/**
 * How much of the canvas the mark occupies.
 *
 * The artwork already carries its own padding, so a full-bleed resize would
 * leave it looking small inside its own margin AND clipped on Android. These
 * are the fractions that make each surface read right.
 */
const INSET = {
  /** Launcher icons get a little breathing room inside the rounded mask. */
  icon: 0.82,
  /** Small enough that a 48px tab still resolves the card stack. */
  favicon: 0.92,
  splash: 1,
  /** Android's safe zone is the centre 66%; 0.62 keeps the glow inside it. */
  androidForeground: 0.62,
};

interface Target {
  file: string;
  width: number;
  height: number;
  inset: number;
  onBackdrop: boolean;
}

const TARGETS: Target[] = [
  { file: 'icon.png', width: 1024, height: 1024, inset: INSET.icon, onBackdrop: true },
  { file: 'favicon.png', width: 48, height: 48, inset: INSET.favicon, onBackdrop: true },
  { file: 'splash-icon.png', width: 512, height: 512, inset: INSET.splash, onBackdrop: false },
  {
    file: 'android-icon-foreground.png',
    width: 512,
    height: 512,
    inset: INSET.androidForeground,
    onBackdrop: false,
  },
];

/**
 * The mark with its own transparent margin removed.
 *
 * The master PNG is drawn with generous padding around the card stack. Resizing
 * it straight into a canvas therefore applies that padding TWICE — once from
 * the artwork, once from the inset below — and the glyph ends up occupying
 * about half the icon, which reads as timid next to other launcher icons.
 *
 * Trimming first makes the inset fractions mean what they say: the number is
 * the share of the canvas the ARTWORK fills, not the share its bounding box
 * fills. Computed once; every target reuses it.
 */
async function trimmedMark(): Promise<Buffer> {
  return sharp(SOURCE).trim({ threshold: 1 }).png().toBuffer();
}

let trimmed: Buffer | null = null;

async function build(target: Target): Promise<void> {
  const inner = Math.round(Math.min(target.width, target.height) * target.inset);
  trimmed ??= await trimmedMark();

  const mark = await sharp(trimmed)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const canvas = sharp({
    create: {
      width: target.width,
      height: target.height,
      channels: 4,
      background: target.onBackdrop ? BACKDROP : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  await canvas
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toFile(resolve(OUT_DIR, target.file));

  console.log(
    `  ${target.file.padEnd(30)} ${target.width}x${target.height}` +
      `  mark ${inner}px  ${target.onBackdrop ? 'on #0B0D10' : 'transparent'}`,
  );
}

async function main(): Promise<void> {
  readFileSync(SOURCE); // Fail loudly if the mark is missing.
  console.log(`Baking app icons from ${SOURCE}`);
  for (const target of TARGETS) await build(target);

  /**
   * The Android monochrome layer is a SILHOUETTE — themed icons render it as a
   * flat single-colour shape, so the mark's gradient and glow would collapse
   * into an indistinct blob. Left as the Expo default rather than shipping
   * something worse than the placeholder; a proper one is a drawn asset, not a
   * resize.
   */
  console.log('  android-icon-monochrome.png    unchanged — needs a drawn silhouette, not a resize');
  writeFileSync(
    resolve(OUT_DIR, 'README-icons.txt'),
    'Generated by scripts/bake-app-icon.ts from assets/collectee/brand/collectee-mark.png.\n' +
      'Do not hand-edit — re-run `npm run bake:app-icon`.\n',
  );
}

void main();
