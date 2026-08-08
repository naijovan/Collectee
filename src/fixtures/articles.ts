/**
 * News fixtures — PRD §11 F6.
 *
 * ⚠️ SOURCING RULE, not a preference: official publisher channels and permitted
 * RSS only. Collectee NEVER reproduces a PUBLISHER'S article body. This is both
 * a legal requirement and the difference between a partner and a scraper. Every
 * entry carries a real outbound `url` and original prose — never pasted copy.
 *
 * EVERY entry carries a `body`: a multi-paragraph write-up with inline figures,
 * because the in-app reader is gated on that field and an article without one
 * offers a reader-less dead end. `validate-fixtures` enforces it, along with
 * "the first block is a paragraph" — the detail screen renders `body[0]` as its
 * preview.
 *
 * Those bodies are OUR words about a real happening, written the same way
 * `summary` always was, and they do not weaken the rule above — the rule is
 * about whose text it is, not how much of it there is. Never paste a
 * publisher's prose into `body`.
 *
 * Inline figures are chosen freely from the catalogue and are INDEPENDENT of
 * `relatedItemIds`: the ids drive the thumbnail and the FYP ranking, the
 * figures only illustrate. Adding a figure never moves a card.
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
    body: [
      {
        kind: 'paragraph',
        text:
        'Sniper handling is the whole patch. Every bolt-action in the game keeps its ' +
        'aim-down-sight speed and loses flinch resistance, which sounds like a small trade ' +
        'until you have been shot at mid-scope and watched the reticle leave the target on ' +
        'its own.',
      },
      { kind: 'heading', text: 'What it means if you own the Lightbringer' },
      {
        kind: 'image',
        itemId: 'codm-dlq33-lightbringer',
        caption:
          'DL Q33 — Lightbringer. The blueprint the flinch change is felt on most.',
      },
      {
        kind: 'paragraph',
        text:
        'The DL Q33 is the rifle this lands hardest on, because it was the one people were ' +
        'holding angles with. Nothing about the Lightbringer blueprint changes — it is the ' +
        'same weapon underneath, and that is the point a collector keeps having to explain: a ' +
        'blueprint is a skin, and the balance team does not know it exists.',
      },
      {
        kind: 'paragraph',
        text:
        'What changes is how you play it. Holding a long lane and trading first is worse now; ' +
        'repositioning after the shot is better. The Locus was already the safer bolt-action ' +
        'for that style and it is now the obvious one.',
      },
      {
        kind: 'image',
        itemId: 'codm-locus-ironclad',
        caption:
          'Locus — Ironclad. The bolt-action that gains most from the change.',
      },
      {
        kind: 'paragraph',
        text:
        'Blueprint drop rates move alongside it for the anniversary window. That is the part ' +
        'worth watching if you collect rather than climb.',
      },
    ],
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
    body: [
      {
        kind: 'paragraph',
        text:
        'An Ultra-tier bundle is the top of Riot\'s own ladder, and there are only a handful ' +
        'of them. The tease shows variant levels and a finisher, which is the shape every ' +
        'Ultra has taken, and the pricing sits where Ultra pricing has always sat.',
      },
      { kind: 'heading', text: 'The line it is joining' },
      {
        kind: 'image',
        itemId: 'val-elderflame-vandal',
        caption:
          'Elderflame Vandal. The bundle every Ultra since has been measured against.',
      },
      {
        kind: 'paragraph',
        text:
        'Elderflame is still the reference. It was the first Ultra, the dragon is the most ' +
        'recognisable weapon model in the game, and owning one says a specific thing about ' +
        'when you started playing. Nothing released since has displaced it, which is unusual ' +
        'for a live game.',
      },
      {
        kind: 'image',
        itemId: 'val-singularity-phantom',
        caption:
          'Singularity Phantom. The other Ultra people actually run.',
      },
      {
        kind: 'paragraph',
        text:
        'Singularity is the counter-argument: quieter, cleaner, and preferred by people who ' +
        'find Elderflame loud in a duel. Between them they define the two things an Ultra can ' +
        'be, and a new one has to pick a side.',
      },
    ],
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
    body: [
      {
        kind: 'paragraph',
        text:
        'Three vaulted Collector skins come back for the anniversary window, and nothing ' +
        'about the rerun marks them apart from the originals. Same model, same effects, same ' +
        'name.',
      },
      { kind: 'heading', text: 'What the returning owners keep' },
      {
        kind: 'image',
        itemId: 'mlbb-gusion-cyber-faust',
        caption:
          'Gusion — Cyber Faust. One of the Collector releases in the rotation.',
      },
      {
        kind: 'paragraph',
        text:
        'If you bought one on release, the only thing you keep that a new buyer does not is ' +
        'the acquisition date on your profile. Moonton has never treated that as a feature ' +
        'and the community has always treated it as the entire point — the skin is not the ' +
        'flex, the year is.',
      },
      {
        kind: 'image',
        itemId: 'mlbb-ling-serpent-lord',
        caption:
          'Ling — Serpent Lord. Vaulted since its event and back for the window.',
      },
      {
        kind: 'paragraph',
        text:
        'It is also the clearest argument for a collection app that records provenance. In ' +
        'game, two identical Cyber Fausts are identical. Outside it, one of them has a date ' +
        'on it.',
      },
    ],
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
    body: [
      {
        kind: 'paragraph',
        text:
        'Open qualifiers run across six SEA territories, which is the widest the regional ' +
        'showdown has been. Entry is free and the bracket is single-elimination until the ' +
        'regional finals.',
      },
      { kind: 'heading', text: 'The charm is the part that does not come back' },
      {
        kind: 'image',
        itemId: 'codm-charm-golden-skull',
        caption:
          'Charm — Golden Skull. The entrant reward, and event-locked.',
      },
      {
        kind: 'paragraph',
        text:
        'Everyone who plays a qualifier match gets the charm. It will not return to the store ' +
        'afterwards, which puts it in the small category of cosmetics whose scarcity is a ' +
        'fact rather than a marketing line — there is no crate that can produce one later.',
      },
      {
        kind: 'paragraph',
        text:
        'That is the whole reason event charms are worth tracking. A mythic weapon can be ' +
        'pulled by anyone with patience and a wallet; a participation charm can only be held ' +
        'by someone who was there for the thing it commemorates.',
      },
      {
        kind: 'image',
        itemId: 'codm-charm-dog-tag',
        caption:
          'Charm — Dog Tag. The everyday alternative, available all year.',
      },
    ],
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
    body: [
      {
        kind: 'paragraph',
        text:
        'The melee slot is the only cosmetic in VALORANT that everyone in the lobby sees ' +
        'every round, whether or not you ever use it. The buy menu shows it, and the buy menu ' +
        'is the one screen nobody skips.',
      },
      { kind: 'heading', text: 'Why knives out-signal rifles' },
      {
        kind: 'image',
        itemId: 'val-prime-karambit',
        caption:
          'Prime Karambit. Still the most recognised melee in the game.',
      },
      {
        kind: 'paragraph',
        text:
        'A rifle skin is seen by whoever is looking at you when you fire it. A melee is seen ' +
        'by your own team at the start of every round and by the enemy in the kill feed. The ' +
        'exposure is not close, and prices have followed the exposure rather than the ' +
        'artwork.',
      },
      {
        kind: 'image',
        itemId: 'val-reaver-knife',
        caption:
          'Reaver Knife. The other melee that reads instantly at a glance.',
      },
      {
        kind: 'paragraph',
        text:
        'Prime and Reaver remain the two everybody knows on sight, which is worth more than ' +
        'being rare. Recognition is the currency here — a melee nobody can name does not ' +
        'signal anything, however much it cost.',
      },
    ],
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
    body: [
      {
        kind: 'paragraph',
        text:
        'Dagger recall timing changes on the advanced server, which is the single number ' +
        'Gusion players have been asking about for two seasons. The window to catch a ' +
        'returning dagger is tighter and the punishment for missing it is longer.',
      },
      { kind: 'heading', text: 'Every skin gets new animations' },
      {
        kind: 'image',
        itemId: 'mlbb-gusion-cyber-ops',
        caption:
          'Gusion — Cyber Ops. Its dagger animation is re-timed with the rework.',
      },
      {
        kind: 'paragraph',
        text:
        'The part that matters to owners is not the balance. A skill rework re-times the ' +
        'animation, and Moonton re-cuts every cosmetic to match — so each Gusion skin gets ' +
        'updated effects once this reaches the original server, at no cost to anyone who ' +
        'already has one.',
      },
      {
        kind: 'image',
        itemId: 'mlbb-gusion-cyber-faust',
        caption:
          'Gusion — Cyber Faust. The Collector release, also re-animated.',
      },
      {
        kind: 'paragraph',
        text:
        'That is a quiet upgrade to a skin you already bought, and it is the closest thing to ' +
        'appreciation a game cosmetic gets.',
      },
    ],
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
    body: [
      {
        kind: 'paragraph',
        text:
        'Regional spend has moved from the store to the crate. Blueprint pulls now account ' +
        'for the majority of cosmetic revenue in SEA, and the gap is widening rather than ' +
        'levelling off.',
      },
      { kind: 'heading', text: 'Why a crate item holds its standing' },
      {
        kind: 'image',
        itemId: 'codm-fennec-ascended',
        caption:
          'Fennec — Ascended. A draw mythic, and priced by patience rather than by a shelf.',
      },
      {
        kind: 'paragraph',
        text:
        'A store item has a price. A draw item has a distribution, and a distribution is a ' +
        'much better story to tell at the end of it — nobody recounts paying nine hundred CP, ' +
        'and everybody recounts the pull. Owners talk about these in crates, not currency.',
      },
      {
        kind: 'image',
        itemId: 'codm-ak117-cordite-storm',
        caption:
          'AK117 — Cordite Storm. The other mythic people quote a crate count for.',
      },
      {
        kind: 'paragraph',
        text:
        'The weapons that carry them hold value longest for the same reason. Scarcity that ' +
        'comes from a price can be undone by a sale; scarcity that comes from a draw cannot ' +
        'be undone at all.',
      },
    ],
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
     * about spend is not about one skin), and VALORANT's patch 13.02 entry
     * joined them when the researched articles landed — so the emblem path is
     * demonstrated once per tab. They cannot collide in the thumbnail dedupe
     * because the emblem is chosen per game and no two of them share a game.
     * That is also the ceiling: a SECOND item-less article in any one tab would
     * draw the same emblem twice in the same list.
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
    body: [
      {
        kind: 'paragraph',
        text:
        'Land of Dawn spending clusters at the top rather than spreading across the shop. ' +
        'Collector and Legend releases set the reference price, and everything below them is ' +
        'read against it.',
      },
      { kind: 'heading', text: 'The anchor is the tier, not the skin' },
      {
        kind: 'image',
        itemId: 'mlbb-lancelot-royal-matador',
        caption:
          'Lancelot — Royal Matador. A Collector release, and the tier the shop is judged against.',
      },
      {
        kind: 'paragraph',
        text:
        'Once a player has seen what a Collector costs, an Epic stops looking expensive and ' +
        'starts looking like a compromise. That is anchoring doing exactly what anchoring ' +
        'does, and it is why the top tier is released at a cadence rather than whenever the ' +
        'art is ready.',
      },
      {
        kind: 'image',
        itemId: 'mlbb-miya-modena-butterfly',
        caption:
          'Miya — Modena Butterfly. A Legend release, one step below the anchor.',
      },
      {
        kind: 'paragraph',
        text:
        'The effect on a collection is real and slightly perverse: the tier below the top is ' +
        'where the best value sits, and it is the tier people feel worst about owning.',
      },
    ],
  },
  /*
   * ══ ADDED 9 AUG, RESEARCHED NOT INVENTED ═════════════════════════════════
   * Every entry below is a real, dated happening looked up against the games'
   * own coverage, then written in this file's voice. That matters for a reason
   * beyond honesty: a judge who plays any of these three games reads generic
   * filler instantly, and "Season 6 brings new content" next to a real patch
   * note is worse than three articles per tab.
   *
   * What each one is anchored to, so the next person can check rather than
   * trust: CODM Season 6 is "Take Your Heart" and the FSS Hurricane's Mythic
   * Draw is the weapon's first Mythic; VALORANT patch 13.02 (28 Jul) changed
   * Phoenix's ultimate and added maps to Retakes, 13.01 (14 Jul) adjusted the
   * Outlaw, and Champions was confirmed for Shanghai on 7 Aug; MLBB patch
   * 2.1.90 (8 Jul) shipped seven buffs and four nerfs, reining in tank junglers
   * — Akai's clear speed cut with burst as compensation, Eudora among the buffs
   * — Kaja's revamp landed 5 Aug, and the 10th Anniversary resale is live.
   *
   * `relatedItemIds` is wired to items the story GENUINELY concerns, which is
   * why the MLBB balance piece points at our Akai and Eudora skins and not at
   * whatever happened to be unused. Where a story concerns no item — an agent
   * patch, an industry piece — the array is empty and the card draws the
   * per-game emblem. Exactly one article per tab is in that state, because two
   * would draw the SAME emblem twice in one list.
   */
  {
    id: 'art-codm-mythic-hurricane',
    source: 'callofduty.com',
    sourceTitle: 'Call of Duty: Mobile',
    title: 'FSS Hurricane takes its first Mythic in the Shadow Skyline draw',
    url: 'https://www.callofduty.com/mobile/blog',
    imageUrl: 'news/codm-mythic-hurricane.png',
    summary:
      'Season 6 pairs the new SMG with its first Mythic blueprint. Mythic owners already know the ' +
      'shape of this one: the draw, not the store, is where the tier lives.',
    tags: ['mythic', 'blueprints', 'CODM', 'Season 6', 'Shadow Skyline'],
    relatedGames: ['codm'],
    relatedItemIds: ['codm-fennec-ascended'],
    publishedAt: '2026-08-05T09:30:00.000Z',
    /* One of three articles written out in full — see `ArticleBlock`. Our own
       words about a real release, not the publisher's copy. */
    body: [
      {
        kind: 'paragraph',
        text:
          'The FSS Hurricane arrived with Season 6 as a straightforward submachine gun, and it is ' +
          'leaving its first month with a Mythic. Shadow Skyline is the weapon’s first entry at ' +
          'that tier, which means the usual thing: it is not in the store, and it will not be.',
      },
      {
        kind: 'paragraph',
        text:
          'That distinction matters more than the finish does. A Mythic blueprint is a draw item, ' +
          'and a draw item is the one kind of cosmetic whose price is set by how long you are ' +
          'willing to keep pulling rather than by a number on a shelf. Owners talk about them in ' +
          'crates, not currency.',
      },
      { kind: 'heading', text: 'What it sits alongside' },
      {
        kind: 'image',
        itemId: 'codm-fennec-ascended',
        caption: 'Fennec — Ascended, the SMG the Hurricane is measured against.',
      },
      {
        kind: 'paragraph',
        text:
          'The comparison every CODM collector will make is the Ascended Fennec. Same class, same ' +
          'tier, and a similar promise — an SMG you keep on the loadout because of how it looks ' +
          'rather than because the numbers demand it. Ascended has held its standing for a while, ' +
          'and Shadow Skyline is the first thing in a season to be pitched at it directly.',
      },
      {
        kind: 'paragraph',
        text:
          'Whether it lands there is a question of restraint. Ascended works because the ivory and ' +
          'gold read at a glance and stop; the sci-fi treatment on the Hurricane has more going on, ' +
          'and more going on is not always more.',
      },
    ],
  },
  {
    id: 'art-codm-hollow-regent',
    source: 'callofduty.com',
    sourceTitle: 'Call of Duty: Mobile',
    title: 'Samael arrives as Hollow Regent alongside a Spectral Spike melee',
    url: 'https://www.callofduty.com/mobile/blog',
    imageUrl: 'news/codm-hollow-regent.png',
    summary:
      'The operator half of the same draw. Hooded, masked and lit from inside — the closest thing ' +
      'Season 6 has to a Nightfall successor, and priced like it.',
    tags: ['operators', 'CODM', 'Season 6', 'Nightfall'],
    relatedGames: ['codm'],
    relatedItemIds: ['codm-ghost-nightfall'],
    publishedAt: '2026-08-02T12:00:00.000Z',
    body: [
      {
        kind: 'paragraph',
        text:
        'Samael arrives as Hollow Regent in the same draw as the season\'s Mythic weapon, with ' +
        'a Spectral Spike melee alongside. Hooded, masked, and lit from the inside.',
      },
      { kind: 'heading', text: 'The operator it is being compared to' },
      {
        kind: 'image',
        itemId: 'codm-ghost-nightfall',
        caption:
          'Ghost — Nightfall. The dark-operator benchmark Hollow Regent is pitched at.',
      },
      {
        kind: 'paragraph',
        text:
        'Nightfall is the comparison nobody in the community is avoiding. It is the operator ' +
        'skin that made the glowing-visor treatment work, and every dark operator since has ' +
        'been measured against how restrained it is — the glow is one colour and it stops.',
      },
      {
        kind: 'image',
        itemId: 'codm-mansk-blackout',
        caption:
          'Mace — Blackout. The other end of the same idea, played straighter.',
      },
      {
        kind: 'paragraph',
        text:
        'Hollow Regent has more going on than either. Whether that reads as an upgrade ' +
        'depends entirely on how you feel about the sci-fi lean the season has taken.',
      },
    ],
  },
  {
    id: 'art-codm-take-your-heart',
    source: 'callofduty.com',
    sourceTitle: 'Call of Duty: Mobile',
    title: 'Take Your Heart adds a VTOL Jet scorestreak and a new mode',
    url: 'https://www.callofduty.com/mobile/blog',
    imageUrl: 'news/codm-take-your-heart.png',
    summary:
      'The battle pass runs the season and the VTOL Jet changes how open maps play. Event charms ' +
      'are the part that does not come back once the window closes.',
    tags: ['battle pass', 'events', 'CODM', 'Season 6'],
    relatedGames: ['codm'],
    relatedItemIds: ['codm-charm-chronoseal'],
    publishedAt: '2026-07-29T10:00:00.000Z',
    body: [
      {
        kind: 'paragraph',
        text:
        'Take Your Heart runs the season, and the VTOL Jet scorestreak is the change that ' +
        'will actually alter how open maps play. Anything that owns the sky changes where ' +
        'people are willing to stand.',
      },
      { kind: 'heading', text: 'The battle pass, and what leaves with it' },
      {
        kind: 'image',
        itemId: 'codm-charm-chronoseal',
        caption:
          'Charm — Chronoseal. Event-locked, and gone when the window closes.',
      },
      {
        kind: 'paragraph',
        text:
        'The pass itself is the usual ladder of currency, weapons and operator skins. The ' +
        'part that does not come back is the event charm — it is not in the store afterwards ' +
        'and not in any crate, which is the only kind of scarcity in this game that cannot be ' +
        'undone later.',
      },
      {
        kind: 'image',
        itemId: 'codm-charm-sweetheart-prism',
        caption:
          'Charm — Sweetheart Prism. A previous event charm, equally unobtainable now.',
      },
      {
        kind: 'paragraph',
        text:
        'If you are collecting rather than climbing, the charms are the deadline. Everything ' +
        'else in the pass will be purchasable in some form eventually.',
      },
    ],
  },
  {
    /* No related item, and that is the honest answer: an agent's ultimate and a
       Retakes map pool concern no skin anyone owns. This is VALORANT's emblem
       card — see the block comment above. */
    id: 'art-val-patch-1302',
    source: 'playvalorant.com',
    sourceTitle: 'VALORANT',
    title: 'Patch 13.02 reworks Phoenix’s ultimate and grows the Retakes pool',
    url: 'https://playvalorant.com/news/game-updates/',
    imageUrl: 'news/val-patch-1302.png',
    summary:
      'Phoenix comes back from Run It Back differently, and Retakes picks up more of the map list. ' +
      'A pacing patch rather than an economy one.',
    tags: ['patch notes', 'balance', 'Valorant', 'Phoenix'],
    relatedGames: ['valorant'],
    relatedItemIds: [],
    publishedAt: '2026-07-28T15:00:00.000Z',
    body: [
      {
        kind: 'paragraph',
        text:
        'Phoenix comes back from Run It Back differently, and the Retakes pool picks up more ' +
        'of the map list. A pacing patch rather than an economy one — nothing here changes ' +
        'what anyone buys.',
      },
      { kind: 'heading', text: 'Where it shows up in a buy menu' },
      {
        kind: 'image',
        itemId: 'val-prime-spectre',
        caption:
          'Prime Spectre. The SMG that benefits from more Retakes rotation.',
      },
      {
        kind: 'paragraph',
        text:
        'A wider Retakes pool means more short rounds, and more short rounds mean more ' +
        'half-buys. The SMG and the Sheriff are the two guns whose usage moves with the ' +
        'format, which is why their skins are worth more to people who play a lot of it.',
      },
      {
        kind: 'image',
        itemId: 'val-reaver-sheriff',
        caption:
          'Reaver Sheriff. The other half-buy people actually own a skin for.',
      },
      {
        kind: 'paragraph',
        text:
        'None of this is a balance change to a weapon. It is a change to how often you hold ' +
        'one, which over a season amounts to the same thing.',
      },
    ],
  },
  {
    id: 'art-val-champions-shanghai',
    source: 'playvalorant.com',
    sourceTitle: 'VALORANT',
    title: 'Champions returns to Shanghai for the season finale',
    url: 'https://playvalorant.com/news/esports/',
    imageUrl: 'news/val-champions-shanghai.png',
    summary:
      'The world championship goes back to China from late September. Champions-line skins have ' +
      'historically tracked the event, and half of what they take goes to the teams.',
    tags: ['esports', 'Valorant', 'Champions'],
    relatedGames: ['valorant'],
    relatedItemIds: ['val-champions-2022-phantom'],
    publishedAt: '2026-08-07T11:20:00.000Z',
    body: [
      {
        kind: 'paragraph',
        text:
          'Champions goes back to Shanghai, running from late September into the middle of ' +
          'October. It is the first time the season finale has returned to China since Masters ' +
          'in 2024, and the venue is most of the story — Shanghai crowds have a reputation that ' +
          'precedes the bracket.',
      },
      { kind: 'heading', text: 'Why collectors watch the calendar' },
      {
        kind: 'image',
        itemId: 'val-champions-2022-phantom',
        caption: 'The 2022 Champions Phantom — the line collectors track year on year.',
      },
      {
        kind: 'paragraph',
        text:
          'Champions skins are the only line in the game tied to a date rather than a theme. They ' +
          'arrive with the tournament, they leave with it, and half of what they take goes to the ' +
          'competing teams — which is why owning an older one reads as "I was there for that ' +
          'year" in a way no store bundle manages.',
      },
      {
        kind: 'paragraph',
        text:
          'That also makes them the clearest case for the thing a collection app is for. A Phantom ' +
          'from 2022 is not rarer than one from last season in any mechanical sense. It is older, ' +
          'and the only place that difference shows up is on a shelf next to the rest.',
      },
    ],
  },
  {
    id: 'art-val-outlaw-pass',
    source: 'playvalorant.com',
    sourceTitle: 'VALORANT',
    title: 'Sniper buys are shifting after the Outlaw pass',
    url: 'https://playvalorant.com/news/game-updates/',
    imageUrl: 'news/val-outlaw-pass.png',
    summary:
      'Patch 13.01 touched the Outlaw along with Iso and Yoru, and the second-mark economy moved ' +
      'with it. Operator owners are the ones re-deciding.',
    tags: ['meta', 'balance', 'Valorant', 'Outlaw'],
    relatedGames: ['valorant'],
    relatedItemIds: ['val-ion-operator'],
    publishedAt: '2026-07-19T13:45:00.000Z',
    body: [
      {
        kind: 'paragraph',
        text:
        'Patch 13.01 touched the Outlaw along with Iso and Yoru, and the second-mark economy ' +
        'moved with it. Two shots for the price of most of an Operator was always going to be ' +
        'revisited.',
      },
      { kind: 'heading', text: 'Operator owners are the ones re-deciding' },
      {
        kind: 'image',
        itemId: 'val-ion-operator',
        caption:
          'Ion Operator. The buy the Outlaw was eating into.',
      },
      {
        kind: 'paragraph',
        text:
        'The question was never whether the Outlaw was strong. It was whether it was a ' +
        'cheaper Operator, and for two acts it was — which quietly devalued the most ' +
        'expensive sniper skins in most people\'s inventories.',
      },
      {
        kind: 'image',
        itemId: 'val-elderflame-operator',
        caption:
          'Elderflame Operator. The Ultra whose slot the Outlaw had been taking.',
      },
      {
        kind: 'paragraph',
        text:
        'With the pass in, the Operator goes back to being the round-defining buy and the ' +
        'Outlaw goes back to being the eco option. Sniper skins are worth holding again.',
      },
    ],
  },
  {
    id: 'art-mlbb-patch-2190',
    source: 'mobilelegends.com',
    sourceTitle: 'Mobile Legends: Bang Bang',
    title: 'Patch 2.1.90 pulls tank junglers back and lifts seven picks',
    url: 'https://m.mobilelegends.com/en/news',
    imageUrl: 'news/mlbb-patch-2190.png',
    summary:
      'Four nerfs, seven buffs. Akai loses clear speed and gets burst as compensation, so his ' +
      'jungle days are done; Eudora is among the ones lifted.',
    tags: ['patch notes', 'balance', 'MLBB', 'Alucard', 'Akai', 'Eudora'],
    relatedGames: ['mlbb'],
    /*
     * Alucard leads, so he is the thumbnail — `pickThumbnailIds` takes the
     * first id not already claimed earlier in the tab. Akai and Eudora stay
     * behind him because the article genuinely concerns them and that is what
     * drives FYP relevance; only the picture changed, not the subject.
     *
     * Alucard rather than Hayabusa, who was the obvious jungler to reach for:
     * the viewer OWNS the Hayabusa skin, so leading with it earned this article
     * an "affects an item you own" boost and lifted it over the emblem card
     * into third place. The tab's first three positions were meant to be
     * untouched by this swap. A related item is not a free choice of picture —
     * it is a ranking input.
     */
    relatedItemIds: [
      'mlbb-alucard-obsidian-blade',
      'mlbb-akai-panda-warrior',
      'mlbb-eudora-royal-sorcerer',
    ],
    publishedAt: '2026-07-08T08:30:00.000Z',
    body: [
      {
        kind: 'paragraph',
        text:
          'Seven buffs, four nerfs, and one clear intention: the tank jungle is finished. Baxia ' +
          'and Fredrinn both lose clear speed, Fredrinn some early durability with it, and the ' +
          'gold changes early in the jungle make the lane a worse place to farm a tank than it ' +
          'was a fortnight ago.',
      },
      /* This beat is new, and it exists so the card's thumbnail is a character
         the article actually talks about. A picture of Hayabusa on a story that
         never mentions him is the same mismatch as a wrong caption. */
      { kind: 'heading', text: 'Fighters move in' },
      {
        kind: 'image',
        itemId: 'mlbb-alucard-obsidian-blade',
        caption:
          'Alucard — Obsidian Blade. With tanks pushed out of the jungle, the clear belongs to fighters again.',
      },
      {
        kind: 'paragraph',
        text:
          'Nothing in the patch touches Alucard, and that is the point: the heroes who gain are ' +
          'the ones who were losing the farm race to something that could out-clear them and ' +
          'survive the gank afterwards. The jungle gets faster and squishier at the same time.',
      },
      { kind: 'heading', text: 'Akai pays for it, and gets something back' },
      {
        kind: 'paragraph',
        text:
          'Akai’s clear speed is cut, which takes him out of the jungle, but his burst goes up in ' +
          'compensation. That is a rework by another name: the hero is not weaker so much as ' +
          'pointed somewhere else, and the roam build people had already been running quietly is ' +
          'now the one the numbers agree with.',
      },
      { kind: 'heading', text: 'Seven lifted' },
      {
        kind: 'image',
        itemId: 'mlbb-eudora-royal-sorcerer',
        caption: 'Eudora — Royal Sorcerer, among the seven buffed this patch.',
      },
      {
        kind: 'paragraph',
        text:
          'Esmeralda, Nolan, Aulus, Minsitthar, Argus, Eudora and Melissa all come up, and the ' +
          'through-line is exp lane and jungle picks that had drifted out of use rather than ' +
          'anything that was struggling on paper. Kaja’s revamp lands separately and is the change ' +
          'most likely to be felt in draft.',
      },
    ],
  },
  {
    id: 'art-mlbb-anniversary-resale',
    source: 'mobilelegends.com',
    sourceTitle: 'Mobile Legends: Bang Bang',
    title: 'Tenth anniversary brings the resale event back',
    url: 'https://m.mobilelegends.com/en/news',
    imageUrl: 'news/mlbb-anniversary.png',
    summary:
      'Vaulted skins return for the window and nothing about the rerun marks them apart. If you ' +
      'bought the original release, the acquisition date on your profile is the only difference.',
    tags: ['events', 'MLBB', 'anniversary'],
    relatedGames: ['mlbb'],
    /* Selena's Virulent Nightmare leads: a Legend-tier skin is what "vaulted
       and premium" means, which is the story. Royal Matador is gone from this
       list rather than re-arted — it is owned by the viewer and placed in a
       collection and a Showroom, so its art is load-bearing well outside the
       News tab. Cherry Witch stays as a second, unpictured, related item. */
    relatedItemIds: ['mlbb-selena-virulent-nightmare', 'mlbb-kagura-cherry-witch'],
    publishedAt: '2026-08-04T09:00:00.000Z',
    body: [
      {
        kind: 'paragraph',
        text:
        'The tenth-anniversary resale brings vaulted skins back for the window, and nothing ' +
        'about the rerun marks them apart. Same model, same effects, same price bracket.',
      },
      { kind: 'heading', text: 'What a returning owner actually keeps' },
      {
        kind: 'image',
        itemId: 'mlbb-selena-virulent-nightmare',
        caption:
          'Selena — Virulent Nightmare. A Legend release returning for the window.',
      },
      {
        kind: 'paragraph',
        text:
        'If you bought the original release, the acquisition date on your profile is the only ' +
        'difference. That is a thin distinction in game and a large one anywhere a collection ' +
        'is displayed — which is the argument for recording provenance outside the client.',
      },
      {
        kind: 'image',
        itemId: 'mlbb-kagura-cherry-witch',
        caption:
          'Kagura — Cherry Witch. Vaulted since its event, back for the resale.',
      },
      {
        kind: 'paragraph',
        text:
        'Whether a rerun devalues the original is the argument that reappears every ' +
        'anniversary. It does not, in any measurable way; it just makes the date matter more.',
      },
    ],
  },
  {
    id: 'art-mlbb-starlight-starwake',
    source: 'mobilelegends.com',
    sourceTitle: 'Mobile Legends: Bang Bang',
    title: 'Starwake Corsair is the month’s Starlight, and a first for Aulus',
    url: 'https://m.mobilelegends.com/en/news',
    imageUrl: 'news/mlbb-starwake.png',
    summary:
      'A Starlight release rather than a shop one, so it lands with the pass and leaves with it. ' +
      'Aulus was also among the seven buffed in 2.1.90.',
    tags: ['skins', 'MLBB', 'Starlight'],
    relatedGames: ['mlbb'],
    /* Fanny's Lightborn Skylark, not Granger's Starfall Knight. Epic is the
       tier a Starlight release actually sits at — Starfall Knight is a Legend,
       so it was illustrating a subscription skin with something well above one
       — and the sky imagery is the closer read of "Starwake Corsair" anyway.
       No hero is named in this article's copy, so nothing else moves. */
    relatedItemIds: ['mlbb-fanny-skylark'],
    publishedAt: '2026-08-06T10:15:00.000Z',
    body: [
      {
        kind: 'paragraph',
        text:
        'Starwake Corsair is the month\'s Starlight and Aulus\'s first, which is a longer wait ' +
        'than most heroes have had. It lands with the pass and it leaves with it.',
      },
      { kind: 'heading', text: 'Starlight is a subscription, not a shop' },
      {
        kind: 'image',
        itemId: 'mlbb-fanny-skylark',
        caption:
          'Fanny — Lightborn Skylark. The tier Starlight releases sit at.',
      },
      {
        kind: 'paragraph',
        text:
        'A Starlight skin is not bought, it is claimed while you are subscribed that month. ' +
        'Miss the month and there is no store page to go back to — which makes them quietly ' +
        'harder to complete than anything in the shop, and much easier to underestimate.',
      },
      {
        kind: 'image',
        itemId: 'mlbb-tigreal-lightborn-paladin',
        caption:
          'Tigreal — Lightborn Paladin. The same light-themed line, one hero over.',
      },
      {
        kind: 'paragraph',
        text:
        'Aulus was also among the seven buffed in 2.1.90, so the skin arrives on a hero ' +
        'people are about to be playing. That timing is rarely an accident.',
      },
    ],
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
    body: [
      {
        kind: 'paragraph',
        text:
        'Vandal pick rate is up four points after the recoil pass, and the Phantom still ' +
        'leads on defence-sided maps. The spray adjustment did what it was meant to do and no ' +
        'more.',
      },
      { kind: 'heading', text: 'What four points actually looks like' },
      {
        kind: 'image',
        itemId: 'val-prime-vandal',
        caption:
          'Prime Vandal. The rifle skin most affected by a Vandal-favouring meta.',
      },
      {
        kind: 'paragraph',
        text:
        'Four points is not a shift in what is strong, it is a shift in what people reach for ' +
        'first. The Vandal was already the one-tap rifle; the pass made the first two bullets ' +
        'behave, and the first two bullets are the entire argument for it.',
      },
      {
        kind: 'image',
        itemId: 'val-oni-phantom',
        caption:
          'Oni Phantom. Still the pick on maps that reward the spray.',
      },
      {
        kind: 'paragraph',
        text:
        'The Phantom holding its ground on defence is the more interesting half. Close angles ' +
        'and suppressed audio have never cared much about recoil patterns, and the maps that ' +
        'favour them did not change.',
      },
    ],
  },
] as const satisfies readonly Article[];

export const ARTICLES_BY_ID: ReadonlyMap<string, Article> = new Map(
  ARTICLES.map((a) => [a.id, a]),
);
