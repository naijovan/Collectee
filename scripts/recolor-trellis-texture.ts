/**
 * Rebalances a TRELLIS character base-color atlas without moving UV islands.
 *
 * TRELLIS can preserve geometry while collapsing cyan, black, and magenta
 * concept art into a nearly uniform blue material. A generative image edit is
 * unsafe here because even a small shape change would move details away from
 * their UVs. This script only changes pixel hue/value:
 *
 *   warm pixels              preserved as skin
 *   bright cyan/blue pixels  mapped to cyan highlights
 *   purple pixels            mapped to magenta highlights
 *   remaining blue pixels    darkened into black/navy armour
 *
 * Usage:
 *   npx tsx scripts/recolor-trellis-texture.ts input.webp output.webp [size]
 */

import sharp from 'sharp';

const [input, output, sizeArgument] = process.argv.slice(2);

if (!input || !output) {
  console.error(
    'Usage: npx tsx scripts/recolor-trellis-texture.ts input.webp output.webp [size]',
  );
  process.exit(1);
}

const textureSize = sizeArgument ? Number.parseInt(sizeArgument, 10) : null;
if (textureSize !== null && (!Number.isFinite(textureSize) || textureSize < 64)) {
  console.error(`Invalid texture size: ${sizeArgument}`);
  process.exit(1);
}

void main();

async function main() {
  const source = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  const pixels = Buffer.from(source.data);
  const channels = source.info.channels;

  for (let offset = 0; offset < pixels.length; offset += channels) {
    const red = pixels[offset]! / 255;
    const green = pixels[offset + 1]! / 255;
    const blue = pixels[offset + 2]! / 255;
    const hsv = rgbToHsv(red, green, blue);

    // Skin in the atlas is warm red/orange with much less blue than magenta
    // armour accents. Keep it untouched so faces and hands do not become neon.
    const isSkin =
      (hsv.hue < 45 || hsv.hue > 345) &&
      red > 0.24 &&
      red > green * 0.94 &&
      red > blue * 1.16;

    if (isSkin || hsv.saturation < 0.16 || hsv.value < 0.08) continue;
    if (hsv.hue < 180 || hsv.hue > 345) continue;

    let targetHue: number;
    let targetSaturation: number;
    let targetValue: number;

    if (hsv.hue >= 238) {
      // Existing violet islands already describe intended accent placement.
      targetHue = 306;
      targetSaturation = Math.max(0.76, hsv.saturation);
      targetValue = clamp(hsv.value * 1.16, 0.24, 0.96);
    } else if ((hsv.hue < 214 && hsv.value > 0.3) || hsv.value > 0.76) {
      // Preserve bright edge information, but move it toward electric cyan.
      targetHue = 194;
      targetSaturation = Math.max(0.72, hsv.saturation);
      targetValue = clamp(hsv.value * 1.04, 0.24, 0.9);
    } else {
      // The broad blue field becomes glossy navy-black armour. Keep enough
      // midtone value for the silhouette and plate detail to survive against
      // the showroom's near-black background.
      targetHue = 224;
      targetSaturation = clamp(hsv.saturation * 0.55, 0.28, 0.58);
      targetValue = clamp(0.04 + hsv.value * 0.48, 0.055, 0.36);
    }

    const mapped = hsvToRgb(targetHue, targetSaturation, targetValue);
    pixels[offset] = Math.round(mapped.red * 255);
    pixels[offset + 1] = Math.round(mapped.green * 255);
    pixels[offset + 2] = Math.round(mapped.blue * 255);
  }

  const rendered = sharp(pixels, {
    raw: {
      width: source.info.width,
      height: source.info.height,
      channels,
    },
  });

  if (textureSize !== null) {
    rendered.resize(textureSize, textureSize, { fit: 'fill', kernel: sharp.kernel.lanczos3 });
  }

  await rendered.webp({ quality: 92, effort: 6 }).toFile(output);

  console.log(`Wrote ${output}`);
}

function rgbToHsv(red: number, green: number, blue: number) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;

  let hue = 0;
  if (delta !== 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;

  return {
    hue,
    saturation: maximum === 0 ? 0 : delta / maximum,
    value: maximum,
  };
}

function hsvToRgb(hue: number, saturation: number, value: number) {
  const chroma = value * saturation;
  const section = hue / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const match = value - chroma;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (section < 1) [red, green, blue] = [chroma, x, 0];
  else if (section < 2) [red, green, blue] = [x, chroma, 0];
  else if (section < 3) [red, green, blue] = [0, chroma, x];
  else if (section < 4) [red, green, blue] = [0, x, chroma];
  else if (section < 5) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  return {
    red: red + match,
    green: green + match,
    blue: blue + match,
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
