/**
 * Seeded inventories.
 *
 * Two things this data has to get right, both from the PRD:
 *
 * 1. §9.3 — "seeded data ships with a realistic mix of both levels". A demo
 *    where everything is verified makes the trust model invisible; one where
 *    nothing is verified makes it look broken. Roughly a third verified here.
 * 2. §11 F5 — overlaps are deliberately shaped so match scores land in a
 *    believable band. Rei and Arya overlap heavily with the viewer on
 *    high-signal (low-popularity) items, which is what drives a ~90% match.
 *    Nadia barely overlaps, which is what makes the ranking legible.
 *
 * **Verified placement is load-bearing (team decision, 3 Aug).** Matching counts
 * VERIFIED items only, so an account with no verified items cannot be matched in
 * either direction — it is absent from Discover rather than ranked low. Every
 * `trust: 'verified'` below is therefore a deliberate choice about who is
 * reachable, not decoration, and each is `source: 'linked-account'`: a scanned
 * item can never be verified (§11 F1 step 6), and `validate-fixtures.ts` fails
 * the build if one is.
 */

import type { IsoDateString, OwnedItem, OwnershipSource, TrustLevel } from '@/types';

interface OwnSpec {
  itemId: string;
  trust?: TrustLevel;
  source?: OwnershipSource;
  confidence?: number | null;
  acquiredAt?: IsoDateString;
  quantity?: number;
}

/**
 * Build an OwnedItem. Defaults to an unverified scan import, which is what the
 * overwhelming majority of real records will be (§9.2 — Verified requires a
 * connected game account, and that is partnership-gated).
 */
function own(userId: string, spec: OwnSpec): OwnedItem {
  const source = spec.source ?? 'scan';
  return {
    id: `own-${userId.replace('user-', '')}-${spec.itemId}`,
    userId,
    itemId: spec.itemId,
    trustLevel: spec.trust ?? 'unverified',
    source,
    confidence: spec.confidence ?? (source === 'scan' ? 0.94 : null),
    quantity: spec.quantity ?? 1,
    acquiredAt: spec.acquiredAt ?? '2026-05-14T09:20:00.000Z',
  };
}

function ownAll(userId: string, specs: OwnSpec[]): OwnedItem[] {
  return specs.map((spec) => own(userId, spec));
}

/** The viewer. Broad across all three titles — the cross-game thesis, visible. */
const JOVAN = ownAll('user-jovan', [
  // CODM — the hero title, and the strongest part of the viewer's collection.
  { itemId: 'codm-dlq33-lightbringer', trust: 'verified', source: 'linked-account', acquiredAt: '2026-01-18T13:05:00.000Z' },
  { itemId: 'codm-fennec-ascended', trust: 'verified', source: 'linked-account', acquiredAt: '2026-02-02T10:41:00.000Z' },
  { itemId: 'codm-drh-cerberus', trust: 'verified', source: 'linked-account', acquiredAt: '2026-02-19T18:02:00.000Z' },
  { itemId: 'codm-qq9-diavolo', confidence: 0.96, acquiredAt: '2026-03-04T08:15:00.000Z' },
  { itemId: 'codm-ghost-nightfall', confidence: 0.91, acquiredAt: '2026-03-04T08:15:00.000Z' },
  { itemId: 'codm-kilo141-glacier', confidence: 0.93, acquiredAt: '2026-03-04T08:15:00.000Z' },
  { itemId: 'codm-hbra3-tidal', confidence: 0.97, acquiredAt: '2026-03-04T08:15:00.000Z' },
  { itemId: 'codm-mac10-riptide', confidence: 0.88, acquiredAt: '2026-03-04T08:15:00.000Z' },
  { itemId: 'codm-camo-urban-splinter', confidence: 0.99, acquiredAt: '2026-03-04T08:15:00.000Z' },
  { itemId: 'codm-charm-golden-skull', confidence: 0.95, acquiredAt: '2026-03-04T08:15:00.000Z' },
  // Valorant
  { itemId: 'val-elderflame-vandal', trust: 'verified', source: 'linked-account', acquiredAt: '2026-01-09T20:33:00.000Z' },
  { itemId: 'val-prime-vandal', trust: 'verified', source: 'linked-account', acquiredAt: '2026-01-09T20:33:00.000Z' },
  { itemId: 'val-prime-karambit', trust: 'verified', source: 'linked-account', acquiredAt: '2026-01-09T20:33:00.000Z' },
  { itemId: 'val-reaver-vandal', confidence: 0.98, acquiredAt: '2026-04-21T11:47:00.000Z' },
  { itemId: 'val-oni-phantom', confidence: 0.92, acquiredAt: '2026-04-21T11:47:00.000Z' },
  { itemId: 'val-origin-vandal', confidence: 0.9, acquiredAt: '2026-04-21T11:47:00.000Z' },
  // MLBB
  // One verified MLBB item, deliberately just one: it keeps MLBB in the viewer's
  // verified title set — so the MLBB community stays recommendable under
  // verified-only matching — while the viewer's three other MLBB items stay
  // unverified, which is what the live account-link step has left to move.
  { itemId: 'mlbb-gusion-cyber-faust', trust: 'verified', source: 'linked-account', acquiredAt: '2026-06-11T15:28:00.000Z' },
  { itemId: 'mlbb-gusion-cyber-ops', confidence: 0.93, acquiredAt: '2026-06-11T15:28:00.000Z' },
  { itemId: 'mlbb-hayabusa-shadow-vanguard', confidence: 0.91, acquiredAt: '2026-06-11T15:28:00.000Z' },
  { itemId: 'mlbb-layla-malefic-gunner', source: 'manual', acquiredAt: '2026-06-11T15:28:00.000Z' },

  // Art-pack cosmetics — the items that have real renders. The viewer owns all
  // of them so every screen in the demo path shows art rather than the colour
  // block. Trust is still a mix (§9.3): a demo where everything is verified
  // makes the trust model invisible.
  { itemId: 'mlbb-manifold-rift', trust: 'verified', source: 'linked-account', acquiredAt: '2026-07-02T09:10:00.000Z' },
  { itemId: 'mlbb-void-empress', trust: 'verified', source: 'linked-account', acquiredAt: '2026-07-02T09:10:00.000Z' },
  { itemId: 'mlbb-emberfall-warlord', confidence: 0.97, acquiredAt: '2026-07-14T19:05:00.000Z' },
  { itemId: 'mlbb-frost-sentinel', confidence: 0.95, acquiredAt: '2026-07-14T19:05:00.000Z' },
  { itemId: 'mlbb-radiant-huntress', confidence: 0.93, acquiredAt: '2026-07-14T19:05:00.000Z' },
  { itemId: 'mlbb-lightborn-defender', trust: 'verified', source: 'linked-account', acquiredAt: '2026-07-02T09:10:00.000Z' },
  { itemId: 'mlbb-cyber-breacher', trust: 'verified', source: 'linked-account', acquiredAt: '2026-07-14T19:05:00.000Z' },
  { itemId: 'mlbb-shadow-protocol', confidence: 0.94, acquiredAt: '2026-07-14T19:05:00.000Z' },
  { itemId: 'mlbb-slipstream-pilot', confidence: 0.92, acquiredAt: '2026-07-14T19:05:00.000Z' },
  { itemId: 'mlbb-solar-paladin', confidence: 0.9, acquiredAt: '2026-07-14T19:05:00.000Z' },
  { itemId: 'mlbb-voidstorm-spirit', confidence: 0.95, acquiredAt: '2026-07-14T19:05:00.000Z' },
  { itemId: 'mlbb-arcane-revenant', confidence: 0.91, acquiredAt: '2026-07-14T19:05:00.000Z' },
  { itemId: 'mlbb-neon-ronin', trust: 'verified', source: 'linked-account', acquiredAt: '2026-07-14T19:05:00.000Z' },
  { itemId: 'mlbb-valentine-sweetheart', source: 'manual', acquiredAt: '2026-07-20T11:32:00.000Z' },
  { itemId: 'mlbb-zodiac-aquarius', confidence: 0.93, acquiredAt: '2026-07-14T19:05:00.000Z' },
  { itemId: 'mlbb-neon-encore', confidence: 0.9, acquiredAt: '2026-07-14T19:05:00.000Z' },
  { itemId: 'val-voidglass-blade', trust: 'verified', source: 'linked-account', acquiredAt: '2026-07-05T16:44:00.000Z' },
  { itemId: 'val-riftblade-katana', confidence: 0.94, acquiredAt: '2026-07-18T14:20:00.000Z' },
  { itemId: 'codm-charm-chronoseal', trust: 'verified', source: 'linked-account', acquiredAt: '2026-07-05T16:44:00.000Z' },
  { itemId: 'codm-charm-sweetheart-prism', confidence: 0.92, acquiredAt: '2026-07-18T14:20:00.000Z' },
]);

/** Heavy overlap with the viewer on rare CODM + MLBB — the top recommendation. */
const REI = ownAll('user-rei', [
  { itemId: 'codm-dlq33-lightbringer', trust: 'verified', source: 'linked-account', acquiredAt: '2026-01-22T12:00:00.000Z' },
  { itemId: 'codm-fennec-ascended', trust: 'verified', source: 'linked-account', acquiredAt: '2026-02-06T12:00:00.000Z' },
  { itemId: 'codm-ak117-cordite-storm', trust: 'verified', source: 'linked-account', acquiredAt: '2026-02-27T12:00:00.000Z' },
  { itemId: 'codm-drh-cerberus', confidence: 0.95, acquiredAt: '2026-03-15T12:00:00.000Z' },
  { itemId: 'codm-qq9-diavolo', confidence: 0.94, acquiredAt: '2026-03-15T12:00:00.000Z' },
  { itemId: 'codm-kilo141-glacier', confidence: 0.92, acquiredAt: '2026-03-15T12:00:00.000Z' },
  { itemId: 'mlbb-gusion-cyber-faust', confidence: 0.96, acquiredAt: '2026-05-30T12:00:00.000Z' },
  { itemId: 'mlbb-ling-serpent-lord', confidence: 0.93, acquiredAt: '2026-05-30T12:00:00.000Z' },
  { itemId: 'mlbb-gusion-cyber-ops', confidence: 0.9, acquiredAt: '2026-05-30T12:00:00.000Z' },
  { itemId: 'codm-camo-urban-splinter', confidence: 0.99, acquiredAt: '2026-03-15T12:00:00.000Z' },
]);

/** CODM only — deep in one title. Strong CODM overlap, zero elsewhere. */
const SYAFIQ = ownAll('user-syafiq', [
  { itemId: 'codm-drh-cerberus', trust: 'verified', source: 'linked-account', acquiredAt: '2026-02-11T12:00:00.000Z' },
  { itemId: 'codm-qq9-diavolo', trust: 'verified', source: 'linked-account', acquiredAt: '2026-02-11T12:00:00.000Z' },
  { itemId: 'codm-ghost-nightfall', trust: 'verified', source: 'linked-account', acquiredAt: '2026-02-11T12:00:00.000Z' },
  { itemId: 'codm-m4-arctic-hunter', confidence: 0.93, acquiredAt: '2026-04-02T12:00:00.000Z' },
  { itemId: 'codm-alias-frostbite', confidence: 0.91, acquiredAt: '2026-04-02T12:00:00.000Z' },
  { itemId: 'codm-kilo141-glacier', confidence: 0.95, acquiredAt: '2026-04-02T12:00:00.000Z' },
  { itemId: 'codm-rus79u-molten', confidence: 0.89, acquiredAt: '2026-04-02T12:00:00.000Z' },
  { itemId: 'codm-pdw57-abyss', confidence: 0.94, acquiredAt: '2026-04-02T12:00:00.000Z' },
  { itemId: 'codm-camo-desert-strata', confidence: 0.98, acquiredAt: '2026-04-02T12:00:00.000Z' },
  { itemId: 'codm-asm10-sandstorm', confidence: 0.97, acquiredAt: '2026-04-02T12:00:00.000Z' },
]);

/** Valorant specialist. Overlaps the viewer on Elderflame + Prime. */
const MEI = ownAll('user-mei', [
  { itemId: 'val-elderflame-vandal', trust: 'verified', source: 'linked-account', acquiredAt: '2026-01-05T12:00:00.000Z' },
  { itemId: 'val-elderflame-operator', trust: 'verified', source: 'linked-account', acquiredAt: '2026-01-05T12:00:00.000Z' },
  { itemId: 'val-elderflame-dagger', trust: 'verified', source: 'linked-account', acquiredAt: '2026-01-05T12:00:00.000Z' },
  { itemId: 'val-singularity-knife', trust: 'verified', source: 'linked-account', acquiredAt: '2026-01-05T12:00:00.000Z' },
  { itemId: 'val-reaver-knife', confidence: 0.96, acquiredAt: '2026-03-28T12:00:00.000Z' },
  { itemId: 'val-prime-karambit', confidence: 0.94, acquiredAt: '2026-03-28T12:00:00.000Z' },
  { itemId: 'val-ruination-sword', confidence: 0.92, acquiredAt: '2026-03-28T12:00:00.000Z' },
  { itemId: 'val-spectrum-waveform', confidence: 0.9, acquiredAt: '2026-03-28T12:00:00.000Z' },
]);

/**
 * MLBB Collector-skin specialist.
 *
 * Two verified items so he is reachable under verified-only matching, and no
 * more: the flagged `mlbb-lancelot-royal-matador` stays UNVERIFIED on purpose.
 * §9.2 flags dispute an unverified ownership claim — a flag against an item read
 * from a linked account would be incoherent, and this is the fixture that
 * carries the whole §9.2 threshold story.
 */
const DANISH = ownAll('user-danish', [
  { itemId: 'mlbb-gusion-cyber-faust', trust: 'verified', source: 'linked-account', acquiredAt: '2026-02-20T12:00:00.000Z' },
  { itemId: 'mlbb-lancelot-royal-matador', confidence: 0.93, acquiredAt: '2026-02-20T12:00:00.000Z' },
  { itemId: 'mlbb-kagura-feathery-wonderland', confidence: 0.91, acquiredAt: '2026-02-20T12:00:00.000Z' },
  { itemId: 'mlbb-ling-serpent-lord', confidence: 0.9, acquiredAt: '2026-02-20T12:00:00.000Z' },
  { itemId: 'mlbb-miya-modena-butterfly', confidence: 0.97, acquiredAt: '2026-04-14T12:00:00.000Z' },
  { itemId: 'mlbb-alucard-obsidian-blade', confidence: 0.95, acquiredAt: '2026-04-14T12:00:00.000Z' },
  { itemId: 'mlbb-kagura-cherry-witch', trust: 'verified', source: 'linked-account', acquiredAt: '2026-04-14T12:00:00.000Z' },
  { itemId: 'mlbb-chou-dragon-boy', confidence: 0.92, acquiredAt: '2026-04-14T12:00:00.000Z' },
]);

/** The other cross-game collector — the closest analogue to the viewer. */
const ARYA = ownAll('user-arya', [
  { itemId: 'codm-fennec-ascended', trust: 'verified', source: 'linked-account', acquiredAt: '2026-02-08T12:00:00.000Z' },
  { itemId: 'codm-drh-cerberus', confidence: 0.94, acquiredAt: '2026-03-19T12:00:00.000Z' },
  { itemId: 'codm-hbra3-tidal', confidence: 0.95, acquiredAt: '2026-03-19T12:00:00.000Z' },
  { itemId: 'val-elderflame-vandal', trust: 'verified', source: 'linked-account', acquiredAt: '2026-01-15T12:00:00.000Z' },
  { itemId: 'val-prime-vandal', confidence: 0.93, acquiredAt: '2026-04-25T12:00:00.000Z' },
  { itemId: 'val-reaver-vandal', confidence: 0.92, acquiredAt: '2026-04-25T12:00:00.000Z' },
  { itemId: 'mlbb-gusion-cyber-ops', confidence: 0.91, acquiredAt: '2026-06-02T12:00:00.000Z' },
  { itemId: 'mlbb-hayabusa-shadow-vanguard', confidence: 0.9, acquiredAt: '2026-06-02T12:00:00.000Z' },
  { itemId: 'mlbb-lesley-cyber-blossom', confidence: 0.94, acquiredAt: '2026-06-02T12:00:00.000Z' },
]);

/**
 * Set completionist — mid overlap.
 *
 * Verified on the Karambit and the Spectre, NOT on `val-prime-vandal`: that
 * OwnedItem is the sub-threshold flag fixture (2 eligible reporters plus 1
 * ineligible), and it has to stay an unverified claim for that case to mean
 * anything.
 */
const KAI = ownAll('user-kai', [
  { itemId: 'val-prime-vandal', confidence: 0.95, acquiredAt: '2026-05-01T12:00:00.000Z' },
  { itemId: 'val-prime-spectre', trust: 'verified', source: 'linked-account', acquiredAt: '2026-05-01T12:00:00.000Z' },
  { itemId: 'val-prime-karambit', trust: 'verified', source: 'linked-account', acquiredAt: '2026-05-01T12:00:00.000Z' },
  { itemId: 'val-origin-vandal', confidence: 0.94, acquiredAt: '2026-05-01T12:00:00.000Z' },
  { itemId: 'val-origin-phantom', confidence: 0.91, acquiredAt: '2026-05-01T12:00:00.000Z' },
  { itemId: 'codm-mac10-riptide', confidence: 0.9, acquiredAt: '2026-06-18T12:00:00.000Z' },
  { itemId: 'codm-pdw57-abyss', confidence: 0.93, acquiredAt: '2026-06-18T12:00:00.000Z' },
]);

/**
 * Light collection — the News Reader persona (§4). Low match by design.
 *
 * ⚠️ NADIA MUST KEEP ZERO VERIFIED ITEMS. She is not just a low match — she is
 * the only ineligible flagger in the fixtures, and §9.2's threshold guard is
 * demonstrated *through* her: `own-kai-val-prime-vandal` carries three flags,
 * one of them hers, and stays below the threshold precisely because an account
 * with no verified items of its own does not count. Verifying anything here
 * silently pushes that item into the review queue and destroys the fixture that
 * proves an unguarded flag button would be a weapon.
 *
 * Under verified-only matching this also makes her the honest zero-state: a real
 * collector who scores 0% because she has verified nothing yet, not because
 * anything is broken.
 */
const NADIA = ownAll('user-nadia', [
  { itemId: 'mlbb-layla-malefic-gunner', source: 'manual', acquiredAt: '2026-07-02T12:00:00.000Z' },
  { itemId: 'mlbb-nana-cat-fairy', source: 'manual', acquiredAt: '2026-07-02T12:00:00.000Z' },
  { itemId: 'val-luxe-classic', confidence: 0.96, acquiredAt: '2026-07-09T12:00:00.000Z' },
  { itemId: 'val-prism-spectre', confidence: 0.94, acquiredAt: '2026-07-09T12:00:00.000Z' },
]);

export const OWNED_ITEMS: readonly OwnedItem[] = [
  ...JOVAN,
  ...REI,
  ...SYAFIQ,
  ...MEI,
  ...DANISH,
  ...ARYA,
  ...KAI,
  ...NADIA,
];

export const OWNED_BY_USER: ReadonlyMap<string, readonly OwnedItem[]> = OWNED_ITEMS.reduce(
  (map, owned) => {
    const existing = map.get(owned.userId);
    if (existing) existing.push(owned);
    else map.set(owned.userId, [owned]);
    return map;
  },
  new Map<string, OwnedItem[]>(),
);
