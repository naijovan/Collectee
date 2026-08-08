/**
 * Seeded per-game trends digests — PRD §11 F6.
 *
 * ⚠️ THESE ARE THE DEFAULT, NOT THE FALLBACK OF LAST RESORT.
 *
 * `FEATURES.liveSummarisation` is off and there is no deployed endpoint, so
 * every digest the demo shows today comes from this file. The live path
 * replaces these bullets when it runs and the card says so; when it does not
 * run — flag off, no URL, timeout, refusal, garbage — these stand and the card
 * says that instead. Neither state is empty and neither state is dishonest.
 *
 * Every bullet is written from what the seeded articles ACTUALLY SAY, and
 * `sourceArticleIds` is the claim that it is. `validate-fixtures` enforces that
 * those articles exist and are about this game; it cannot check that a bullet
 * is supported, so that part is on whoever edits this file. Do not add a bullet
 * about a patch, a price or a date that no seeded article mentions — the live
 * prompt is held to the same rule, and the two paths must not disagree about
 * what is true.
 */

import type { GameDigest } from '@/types';

export const GAME_DIGESTS = [
  {
    title: 'codm',
    bullets: [
      'Season 6 adjusts sniper handling — the DL Q33 keeps its ADS speed but loses flinch resistance.',
      'Lightbringer owners are the ones affected: the blueprint changes how the weapon wants to be run.',
      'SEA regional showdown qualifiers are open across six territories, with an event charm that will not return.',
      'Blueprint pulls now outsell the store outright, and the weapons carrying them hold value longest.',
    ],
    sourceArticleIds: [
      'art-codm-s6-patch',
      'art-codm-garena-sea-event',
      'art-codm-blueprint-spend',
    ],
  },
  {
    title: 'valorant',
    bullets: [
      'Vandal pick rate is up four points after the recoil pass; Phantom still leads on defence-sided maps.',
      'A new Ultra-tier bundle has been teased with variant levels and a finisher.',
      'Its pricing sits in line with Elderflame and Singularity.',
      'Melee skins are becoming the status signal — the buy menu shows them every round.',
    ],
    sourceArticleIds: [
      'art-val-act-meta',
      'art-val-episode-drop',
      'art-val-knife-economy',
    ],
  },
  {
    title: 'mlbb',
    bullets: [
      "Gusion's dagger recall timing is changing on the advanced server.",
      'Every Gusion cosmetic gets updated animations once the rework reaches the original server.',
      'Three vaulted Collector skins return for a limited anniversary window.',
      /* This replaced the acquisition-date detail rather than joining it: the
         digest is capped at four bullets, and with a third source article the
         cap had to give somewhere. The dropped line was the most minor of the
         four and the only one that did not correspond to a distinct article. */
      'Collector and Legend releases set the reference price the rest of the shop is judged against.',
    ],
    sourceArticleIds: [
      'art-mlbb-gusion-rework',
      'art-mlbb-collector-return',
      'art-mlbb-collector-spend',
    ],
  },
] as const satisfies readonly GameDigest[];

export const DIGESTS_BY_GAME: ReadonlyMap<string, GameDigest> = new Map(
  GAME_DIGESTS.map((d) => [d.title, d]),
);
