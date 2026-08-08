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
 * ── TAGS ARE THE TOPIC-MATCHING SURFACE ───────────────────────────────────
 * `rankFyp` matches a followed topic against `tags` and nothing else — not the
 * title, not the summary. So a franchise or character the article is plainly
 * about has to be IN this array or following it does nothing.
 *
 * That was silently untrue until 6 Aug: the seeded topics include
 * `franchise: Elderflame` and `character: Gusion`, the Gusion rework article
 * is titled "Gusion receives skill rework", and neither matched, because
 * neither name was tagged. Every name added since is one the article already
 * named in its own summary or carried in `relatedItemIds` — the tags describe
 * the article, they are not keywords stuffed in to make a demo work.
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
    tags: ['patch notes', 'balance', 'CODM', 'Lightbringer'],
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
    tags: ['bundle', 'Ultra', 'Valorant', 'Elderflame', 'Singularity'],
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
    tags: ['event', 'Collector', 'MLBB', 'Gusion', 'Ling'],
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
    tags: ['analysis', 'melee', 'Valorant', 'Prime', 'Reaver'],
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
    tags: ['rework', 'advanced server', 'MLBB', 'Gusion'],
    relatedGames: ['mlbb'],
    relatedItemIds: ['mlbb-gusion-cyber-faust', 'mlbb-gusion-cyber-ops'],
    publishedAt: '2026-07-26T07:20:00.000Z',
  },
  /*
   * ── The two halves of what used to be one cross-game article ──────────────
   * `art-cross-game-cosmetics` was tagged ['codm', 'mlbb'] and appeared under
   * both tabs. Jovan's objection is correct and it is not cosmetic: one update
   * cannot come from two publishers, and the card rendered two differently
   * coloured game chips side by side, which reads as a tagging bug rather than
   * as an industry piece. There is now one article per publisher, each with its
   * own angle rather than the same paragraph twice.
   *
   * BOTH keep `relatedItemIds: []` — see the note on the second one.
   */
  {
    id: 'art-codm-blueprint-spend',
    source: 'garena.sg',
    sourceTitle: 'Garena Singapore',
    title: 'Blueprint pulls now outsell direct store purchases',
    url: 'https://www.garena.sg/news',
    imageUrl: 'news/sea-cosmetics.png',
    summary:
      'Regional spend has shifted from the store to the crate: blueprint pulls account for the ' +
      'majority of cosmetic revenue, and the weapons that carry them hold value longest.',
    tags: ['industry', 'SEA', 'CODM', 'blueprints'],
    relatedGames: ['codm'],
    relatedItemIds: [],
    publishedAt: '2026-07-24T10:10:00.000Z',
  },
  {
    /*
     * THIS IS THE ARTICLE THAT DEMOS THE GENERIC EMBLEM THUMBNAIL.
     *
     * `relatedItemIds: []` is deliberate and load-bearing: with no related item
     * there is no render to use, so `ArticleThumb` falls through to
     * `newsThumbFor(title)` and the designed per-game emblem is what appears.
     * It was the only article in the seed exercising that path, and the split
     * kept it — on the MLBB side because MLBB is the tab a judge opens for the
     * character art, so the one non-item picture is most visible there.
     *
     * The CODM half above is item-less too, for the same honest reason (a story
     * about spend is not about one skin), which means the emblem path is
     * demonstrated on two tabs rather than one. They cannot collide in the
     * thumbnail dedupe: the emblem is chosen per game, and these two are in
     * different games.
     *
     * If either ever gains a related item, check that at least one article
     * somewhere still has none — otherwise the emblem art ships unreachable.
     */
    id: 'art-mlbb-collector-spend',
    source: 'garena.sg',
    sourceTitle: 'Garena Singapore',
    title: 'Collector tier is now the price ceiling players anchor to',
    url: 'https://www.garena.sg/news',
    imageUrl: 'news/sea-cosmetics.png',
    summary:
      'Land of Dawn spending clusters at the top tier rather than spreading across it. Collector ' +
      'and Legend releases set the reference price, and everything below them is judged against it.',
    tags: ['industry', 'SEA', 'MLBB', 'Collector'],
    relatedGames: ['mlbb'],
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
    tags: ['meta', 'balance', 'Valorant', 'Prime', 'Reaver'],
    relatedGames: ['valorant'],
    relatedItemIds: ['val-prime-vandal', 'val-reaver-vandal', 'val-oni-phantom'],
    publishedAt: '2026-07-22T13:00:00.000Z',
  },
] as const satisfies readonly Article[];

export const ARTICLES_BY_ID: ReadonlyMap<string, Article> = new Map(
  ARTICLES.map((a) => [a.id, a]),
);
