/**
 * Is ANTHROPIC_API_KEY valid? — a throwaway diagnostic, not part of any build.
 *
 * Reads the key from the environment and NEVER prints it. Everything below
 * reports shape (prefix, length, stray whitespace) and what Anthropic says back,
 * because those are the things that distinguish "wrong key" from "no credit"
 * from "pasted with a newline" — and none of them require seeing the secret.
 *
 * Run:  npx tsx --env-file=.env scripts/probe-key.ts
 *
 * The key belongs in `.env`, which is gitignored and has never been committed.
 * It must never go in a tracked file: GitHub scans public pushes for Anthropic
 * keys and the vendor auto-revokes on a hit, so a committed key is a dead key
 * plus a rewrite of history.
 */

const raw = process.env.ANTHROPIC_API_KEY;

if (raw === undefined || raw.length === 0) {
  console.log('ANTHROPIC_API_KEY is not set.');
  console.log('Add it to .env as:  ANTHROPIC_API_KEY=sk-ant-api03-...');
  process.exit(1);
}

const trimmed = raw.trim();

console.log('── shape ──');
console.log(`  length            ${raw.length}`);
console.log(`  starts with       ${raw.slice(0, 11)}…`);
console.log(`  ends with         …${raw.slice(-4)}`);
console.log(`  stray whitespace  ${raw !== trimmed ? 'YES — this alone breaks it' : 'no'}`);
console.log(
  `  looks Anthropic   ${trimmed.startsWith('sk-ant-') ? 'yes' : 'NO — this is not an Anthropic key'}`,
);

if (!trimmed.startsWith('sk-ant-')) {
  console.log('\nAnthropic keys start "sk-ant-". A Google AI Studio / Gemini key will not work here.');
}

async function main() {
  console.log('\n── live call ──');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': trimmed,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 16,
      messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
    }),
  });

  const body = (await res.json()) as {
    content?: { text?: string }[];
    error?: { type?: string; message?: string };
  };

  console.log(`  HTTP ${res.status}`);

  if (res.ok) {
    console.log(`  reply: ${body.content?.[0]?.text ?? '(empty)'}`);
    console.log('\n✅ The key works. If Vercel still fails, its stored copy differs from this one.');
    return;
  }

  console.log(`  type:    ${body.error?.type ?? '(none)'}`);
  console.log(`  message: ${body.error?.message ?? '(none)'}`);

  const type = body.error?.type ?? '';
  const message = body.error?.message ?? '';
  console.log(
    '\n❌ ' +
      (type === 'authentication_error'
        ? 'Wrong or revoked key. Get a fresh one.'
        : /credit|balance/i.test(message)
          ? 'Key is valid but the workspace has no credit. Top up, or use a key that does.'
          : type === 'not_found_error'
            ? 'The key is valid but cannot reach this model.'
            : 'See the message above.'),
  );
}

void main();
