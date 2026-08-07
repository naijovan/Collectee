/**
 * Send one image to the deployed scanner and print what came back.
 *
 *   npm run probe:scan -- "assets/collectee/sample input.png"
 *   npm run probe:scan -- ./shot.png mlbb
 *
 * WHY THIS EXISTS, and why it is a script rather than a screen:
 *
 * The Import flow falls back to the prepared fixture on any failure, by design
 * (§12.1 — a broken endpoint must never break the demo). That is correct
 * behaviour and it is also why "the scan gave me the same answer again" is
 * ambiguous from inside the app: a stale deploy, a wrong URL, a missing key
 * and a genuinely unreadable screenshot all look the same on screen.
 *
 * This talks to the same endpoint with no fallback and no UI, so the answer is
 * unambiguous. Run it after deploying and before blaming the app.
 *
 * It reads no key. The key lives in the deployed function's environment and
 * nowhere else (see `.env`), so this is safe to run anywhere the URL is known.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { ITEMS_BY_TITLE } from '../src/fixtures/catalogue';
import { GAME_LABELS, GAME_TITLES } from '../src/types';
import type { GameTitle } from '../src/types';

const PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL ?? '';

const MEDIA_TYPES: Record<string, 'image/png' | 'image/jpeg'> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

/**
 * Bail out with a message and an exit code.
 *
 * `process.exitCode` plus a return, never `process.exit()`: killing the
 * process while fetch's handles are still open trips a libuv assertion on
 * Windows, which buries the actual error under a native crash dump.
 */
function bail(code: number, ...lines: string[]): false {
  for (const line of lines) console.error(line);
  process.exitCode = code;
  return false;
}

async function main(): Promise<boolean> {
  const [file, rawTitle = 'codm'] = process.argv.slice(2);

  if (!file) {
    return bail(2, 'Usage: npm run probe:scan -- <image> [codm|valorant|mlbb]');
  }
  if (!GAME_TITLES.includes(rawTitle as GameTitle)) {
    return bail(2, `Unknown title "${rawTitle}". One of: ${GAME_TITLES.join(', ')}`);
  }
  if (PROXY_URL.length === 0) {
    return bail(2, 'EXPO_PUBLIC_AI_PROXY_URL is not set — check .env, then re-run.');
  }

  const title = rawTitle as GameTitle;
  const mediaType = MEDIA_TYPES[path.extname(file).toLowerCase()];
  if (!mediaType) {
    return bail(2, `${file} is not a PNG or JPG.`);
  }

  // No downscaling here — the point is to test the endpoint, and Node has no
  // canvas. A screenshot over ~4MB will be refused by the proxy, which is
  // itself a useful thing to learn from this script.
  const image = (await readFile(file)).toString('base64');
  const catalogue = ITEMS_BY_TITLE[title].map((item) => ({
    id: item.id,
    name: item.name,
    rarity: item.rarityLabel,
  }));

  console.log(`POST ${PROXY_URL}`);
  console.log(`  image     ${file} (${(image.length / 1_365_333).toFixed(1)} MB as base64)`);
  console.log(`  title     ${GAME_LABELS[title]} · ${catalogue.length} catalogue rows\n`);

  const startedAt = Date.now();
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'scan', game: GAME_LABELS[title], image, mediaType, catalogue }),
  });
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const body = await response.text();

  if (!response.ok) {
    return bail(
      1,
      `✗ ${response.status} after ${elapsed}s — ${body.trim()}`,
      ...(body.includes('empty_article')
        ? [
            '',
            '  "empty_article" means the DEPLOYED function has no scan mode and fell',
            '  through to the summariser. The local code is fine; the deploy is stale.',
            '  Fix: vercel --prod',
          ]
        : []),
    );
  }

  const payload = JSON.parse(body) as {
    detections?: { name: string; rarityTier: string | null; itemId: string | null; confidence: number }[];
    error?: string;
  };

  if (payload.error) {
    return bail(1, `✗ the model call failed: ${payload.error} (after ${elapsed}s)`);
  }
  if (!payload.detections) {
    return bail(1, `✗ no detections field in the reply: ${body.slice(0, 300)}`);
  }

  const known = new Set(catalogue.map((row) => row.id));
  let matched = 0;

  console.log(`✓ ${payload.detections.length} tiles read in ${elapsed}s\n`);
  for (const d of payload.detections) {
    // Same guard the service applies: an id we do not stock is not a match,
    // however confident the model was about it.
    const real = d.itemId !== null && known.has(d.itemId);
    if (real) matched += 1;
    const verdict = real ? `→ ${d.itemId}` : d.itemId === null ? '→ not in catalogue' : `→ UNKNOWN ID ${d.itemId}`;
    console.log(
      `  ${String(Math.round(d.confidence * 100)).padStart(3)}%  ` +
        `${(d.rarityTier ?? '—').padEnd(9)} ${d.name.padEnd(28)} ${verdict}`,
    );
  }

  console.log(`\n  ${matched} matched the catalogue, ${payload.detections.length - matched} did not.`);
  console.log('  If these names are the ones on YOUR image, the scanner is reading it.');
  return true;
}

main().catch((error) => {
  console.error('✗ probe failed:', error);
  process.exitCode = 1;
});
