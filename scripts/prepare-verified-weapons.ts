import { mkdirSync } from 'node:fs';

import sharp from 'sharp';

import {
  VERIFIED_WEAPONS,
  VERIFIED_WEAPON_INPUT_DIR,
  verifiedWeaponInput,
} from './verified-weapon-manifest';

const OUTPUT_SIZE = 1254;

async function main() {
  const requested = new Set(
    process.argv.slice(2).filter((argument) => !argument.startsWith('--')),
  );
  const targets =
    requested.size === 0
      ? VERIFIED_WEAPONS
      : VERIFIED_WEAPONS.filter((spec) => requested.has(spec.id));

  mkdirSync(VERIFIED_WEAPON_INPUT_DIR, { recursive: true });

  for (const spec of targets) {
    const prepared =
      spec.sourceKind === 'transparent'
        ? await normalizeTransparent(spec.source)
        : await removeDarkBackground(spec.source, spec.alphaMask);
    await sharp(prepared).png({ compressionLevel: 9 }).toFile(verifiedWeaponInput(spec.id));
    console.log(`Prepared ${verifiedWeaponInput(spec.id)}`);
  }
}

async function normalizeTransparent(source: string): Promise<Buffer> {
  return sharp(source)
    .ensureAlpha()
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: 'contain',
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function removeDarkBackground(
  source: string,
  alphaMask?: string,
): Promise<Buffer> {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: 'contain',
      kernel: sharp.kernel.lanczos3,
      background: { r: 0, g: 0, b: 0, alpha: 1 },
    })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mask = alphaMask
    ? await sharp(alphaMask)
        .greyscale()
        .resize(info.width, info.height, {
          fit: 'fill',
          kernel: sharp.kernel.lanczos3,
        })
        .raw()
        .toBuffer()
    : null;

  for (let index = 0; index < data.length; index += 4) {
    const red = data[index]!;
    const green = data[index + 1]!;
    const blue = data[index + 2]!;
    const originalAlpha = data[index + 3]!;
    const value = Math.max(red, green, blue);
    const chroma = value - Math.min(red, green, blue);

    // The source renders use a near-black studio background. Value removes the
    // backdrop; chroma retains dark purple/red metal and restrained aura detail.
    const valueMatte = smoothstep(12, 62, value);
    const colorRetention = 0.62 + smoothstep(4, 42, chroma) * 0.38;
    const inferredMatte = Math.min(1, valueMatte * colorRetention);
    const matte =
      mask == null
        ? inferredMatte
        : Math.min(inferredMatte, smoothstep(24, 92, mask[index / 4]!));
    data[index + 3] = Math.round(originalAlpha * matte);
  }

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

function smoothstep(low: number, high: number, value: number): number {
  const position = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return position * position * (3 - 2 * position);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
