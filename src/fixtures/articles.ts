/**
 * News fixtures — PRD §11 F6.
 *
 * ⚠️ SOURCING RULE, not a preference: official publisher channels and permitted
 * RSS only. Summaries link out; Collectee NEVER reproduces article bodies.
 * This is both a legal requirement and the difference between a partner and a
 * scraper. Every entry therefore carries a real outbound `url` and a short
 * original summary — never pasted copy.
 *
 * `relatedItemIds` is what makes FYP more than a game filter: a player who owns
 * a skin for a weapon being reworked should see that patch note first.
 *
 * §12.1 [OPTIONAL] — the one real model call under consideration for the build
 * is summarising these. If it ships, `summary` is generated at runtime; if not,
 * these seeded strings stand and the pitch says so plainly.
 */

import type { Article } from '@/types';

export const ARTICLES = [
  {
    id: 'art-codm-s6-patch',
    source: 'callofduty.com',
    sourceTitle: 'Call of Duty: Mobile',
    title: 'Season 6 patch notes: weapon balance and blueprint rebalancing',
    url: 'https://www.callofduty.com/mobile/blog',
    imageUrl: 'news/codm-s6.png',
    summary:
      'Sniper handling adjusted across the board. The DL Q33 keeps its ADS speed but loses ' +
      'flinch resistance, which changes how Lightbringer owners will want to run it.',
    tags: ['patch notes', 'balance', 'CODM'],
    relatedGames: ['codm'],
    relatedItemIds: ['codm-dlq33-lightbringer'],
    publishedAt: '2026-07-31T08:00:00.000Z',
  },
  {
    id: 'art-val-episode-drop',
    source: 'playvalorant.com',
    sourceTitle: 'VALORANT',
    title: 'New Ultra edition bundle revealed ahead of act launch',
    url: 'https://playvalorant.com/news/',
    imageUrl: 'news/val-bundle.png',
    summary:
      'Riot has teased a new Ultra-tier bundle with variant levels and a finisher. ' +
      'Pricing sits in line with Elderflame and Singularity.',
    tags: ['bundle', 'Ultra', 'Valorant'],
    relatedGames: ['valorant'],
    relatedItemIds: ['val-elderflame-vandal', 'val-singularity-phantom'],
    publishedAt: '2026-07-30T14:30:00.000Z',
  },
  {
    id: 'art-mlbb-collector-return',
    source: 'mobilelegends.com',
    sourceTitle: 'Mobile Legends: Bang Bang',
    title: 'Collector skin rotation returns for the anniversary event',
    url: 'https://m.mobilelegends.com/en/news',
    imageUrl: 'news/mlbb-collector.png',
    summary:
      'Three previously vaulted Collector skins re-enter the rotation for a limited window. ' +
      'Owners of the original release keep their acquisition date on the profile.',
    tags: ['event', 'Collector', 'MLBB'],
    relatedGames: ['mlbb'],
    relatedItemIds: ['mlbb-gusion-cyber-faust', 'mlbb-ling-serpent-lord'],
    publishedAt: '2026-07-29T09:15:00.000Z',
  },
  {
    id: 'art-codm-garena-sea-event',
    source: 'garena.sg',
    sourceTitle: 'Garena Singapore',
    title: 'Garena announces SEA regional showdown qualifiers',
    url: 'https://www.garena.sg/news',
    imageUrl: 'news/garena-showdown.png',
    summary:
      'Open qualifiers run across six SEA territories. Entrants receive an event charm ' +
      'that will not return to the store afterwards.',
    tags: ['esports', 'SEA', 'CODM'],
    relatedGames: ['codm'],
    relatedItemIds: ['codm-charm-golden-skull'],
    publishedAt: '2026-07-28T11:00:00.000Z',
  },
  {
    id: 'art-val-knife-economy',
    source: 'playvalorant.com',
    sourceTitle: 'VALORANT',
    title: 'Melee skins are quietly becoming the status signal',
    url: 'https://playvalorant.com/news/',
    imageUrl: 'news/val-melee.png',
    summary:
      'Melee slots draw more attention than any rifle skin because they are visible in the ' +
      'buy menu every round. Prime and Reaver knives remain the most recognised.',
    tags: ['analysis', 'melee', 'Valorant'],
    relatedGames: ['valorant'],
    relatedItemIds: ['val-prime-karambit', 'val-reaver-knife'],
    publishedAt: '2026-07-27T16:45:00.000Z',
  },
  {
    id: 'art-mlbb-gusion-rework',
    source: 'mobilelegends.com',
    sourceTitle: 'Mobile Legends: Bang Bang',
    title: 'Gusion receives skill rework in the advanced server',
    url: 'https://m.mobilelegends.com/en/news',
    imageUrl: 'news/mlbb-gusion.png',
    summary:
      'Dagger recall timing changes. Skin owners should expect updated animations across ' +
      'all Gusion cosmetics once the patch reaches the original server.',
    tags: ['rework', 'advanced server', 'MLBB'],
    relatedGames: ['mlbb'],
    relatedItemIds: ['mlbb-gusion-cyber-faust', 'mlbb-gusion-cyber-ops'],
    publishedAt: '2026-07-26T07:20:00.000Z',
  },
  {
    id: 'art-cross-game-cosmetics',
    source: 'garena.sg',
    sourceTitle: 'Garena Singapore',
    title: 'Cosmetic spend keeps climbing across SEA mobile titles',
    url: 'https://www.garena.sg/news',
    imageUrl: 'news/sea-cosmetics.png',
    summary:
      'Regional data shows cosmetics remain the dominant monetisation model, with mobile ' +
      'titles outpacing PC on total spend for the third year running.',
    tags: ['industry', 'SEA'],
    relatedGames: ['codm', 'mlbb'],
    relatedItemIds: [],
    publishedAt: '2026-07-24T10:10:00.000Z',
  },
  {
    id: 'art-val-act-meta',
    source: 'playvalorant.com',
    sourceTitle: 'VALORANT',
    title: 'Act meta report: rifle pick rates shift after the recoil pass',
    url: 'https://playvalorant.com/news/',
    imageUrl: 'news/val-meta.png',
    summary:
      'Vandal pick rate up four points following the spray adjustment. Phantom remains ' +
      'dominant on defence-sided maps.',
    tags: ['meta', 'balance', 'Valorant'],
    relatedGames: ['valorant'],
    relatedItemIds: ['val-prime-vandal', 'val-reaver-vandal', 'val-oni-phantom'],
    publishedAt: '2026-07-22T13:00:00.000Z',
  },
] as const satisfies readonly Article[];

export const ARTICLES_BY_ID: ReadonlyMap<string, Article> = new Map(
  ARTICLES.map((a) => [a.id, a]),
);
