/**
 * Bakes a depth map for every item render — a build step, never a runtime one.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 * `ArtworkRelief3D` displaces a plane to give a flat render some thickness.
 * It was displacing by the COLOUR image, which means brightness became height:
 * a gold highlight bulges out, a dark barrel sinks in. That is not depth, it is
 * an accident of the lighting in the render, and it is why the collectibles
 * read as bumpy photographs rather than objects.
 *
 * A real monocular-depth model gives the actual shape — barrel forward, stock
 * back, background falling away — from the same single image. Same cheap
 * plane-and-displacement technique, dramatically better result, and it holds up
 * much further off-axis before the illusion breaks.
 *
 * ── Why it is a build step (§12.1) ────────────────────────────────────────
 * The demo runs on conference wifi in four minutes with no network. So the
 * model runs HERE, once, on the machine of whoever regenerates art, and commits
 * PNGs. The app ships images and never loads an ML runtime — `@huggingface/
 * transformers` is a devDependency and is not in the bundle.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────
 *   npm run bake:depth           # only items missing a depth map
 *   npm run bake:depth -- --all  # redo everything
 *
 * First run downloads ~50MB of model into node_modules/.cache and is slow;
 * every run after is local and takes a second or two per image.
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

import { pipeline, RawImage } from '@huggingface/transformers';
import sharp from 'sharp';

/**
 * Depth Anything V2 Small. Chosen over Large because this runs on a laptop and
 * the output is consumed as a low-frequency displacement on a 72x48 plane —
 * the extra fidelity of a bigger model would be sampled away.
 */
const MODEL = 'onnx-community/depth-anything-v2-small';

/** Art the relief can display, and therefore art that needs depth. */
const SOURCE_DIRS = ['assets/collectee/items', 'assets/collectee/subjects'];
const OUT_DIR = 'assets/collectee/depth';

/**
 * Displacement is sampled from one channel, so the map ships greyscale — a
 * third of the bytes for identical output. 512 is plenty: the plane subdivides
 * to 72x48, so anything finer is interpolated away.
 */
const OUT_SIZE = 512;

async function main() {
  const all = process.argv.includes('--all');
  mkdirSync(OUT_DIR, { recursive: true });

  const sources = SOURCE_DIRS.flatMap((dir) =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith('.png'))
          .map((f) => join(dir, f))
      : [],
  );

  const pending = sources.filter(
    (src) => all || !existsSync(join(OUT_DIR, basename(src))),
  );

  if (pending.length === 0) {
    console.log(`Depth maps up to date — ${sources.length} items, nothing to bake.`);
    return;
  }

  console.log(`Baking ${pending.length} of ${sources.length} depth maps…`);
  console.log('Loading model (first run downloads ~50MB)…');
  const estimate = await pipeline('depth-estimation', MODEL);

  let done = 0;
  for (const src of pending) {
    const name = basename(src);

    // The model wants RGB. Renders sit on dark backgrounds and some carry an
    // alpha channel, so flatten to black first — that keeps the background
    // reading as "far" rather than as a hole the model has to guess at.
    const rgb = await sharp(src).flatten({ background: '#000000' }).png().toBuffer();
    const image = await RawImage.fromBlob(new Blob([new Uint8Array(rgb)]));

    const { depth } = await estimate(image);

    await sharp(Buffer.from(depth.data), {
      raw: { width: depth.width, height: depth.height, channels: 1 },
    })
      .resize(OUT_SIZE, OUT_SIZE, { fit: 'fill' })
      // A little blur before it becomes a displacement map. Depth models produce
      // hard steps at object edges, which on a subdivided plane tear into
      // spikes; smoothing trades edge precision for a surface that holds.
      .blur(1.2)
      .greyscale()
      .png({ compressionLevel: 9 })
      .toFile(join(OUT_DIR, name));

    done += 1;
    console.log(`  ${String(done).padStart(3)}/${pending.length}  ${name}`);
  }

  console.log(`\nDone. ${done} depth maps in ${OUT_DIR}/`);
  console.log('Add them to config/artRegistry.ts DEPTH_MAPS to light them up.');
}

main().catch((error) => {
  console.error('\nBake failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
