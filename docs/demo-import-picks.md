# Which demo skins actually import

Measured 8 Aug 2026 by running the **real** scanner — same model, same prompt,
same catalogue payload as the deployed path — against every file in `demo/`.
Not a guess: `scripts/tmp/scan-demo.ts` reproduced the production request and
recorded what came back.

Numbers are the model's confidence in the match. `domain/scan.ts` routes on it:

| Confidence | Outcome | What you do on stage |
| --- | --- | --- |
| ≥ 0.90 | `matched` | Added for you. No interaction. |
| 0.60 – 0.89 | `needs_review` | Appears in Review with a **Confirm** button. One tap. |
| < 0.60 | `discarded` | Does **not** offer itself. Avoid on stage. |

**Most passing items land in the middle band, so expect to tap Confirm.** That
is the trust model working as designed (§9.2) rather than a defect — but do not
plan a beat around an item importing itself unless it is one of the two below.

---

## Safest picks, per game

Highest confidence first. Any of these will import.

**CODM**
1. `4 Rare · Charm — Dog Tag` — **0.92, adds itself**
2. `2 Legendary · Alias — Frostbite` — 0.89
3. `5 Common · Charm — Brass Shell` — 0.88
4. `3 Epic · Price — Monsoon` — 0.85

**Valorant**
1. `2 Legendary · Sovereign Ghost` — **0.90, adds itself**
2. `3 Epic · Nebula Sheriff` — 0.89
3. `1 Mythic · Ruination Sword` — 0.88
4. `1 Mythic · Singularity Knife` — 0.88

**MLBB**
1. `2 Legendary · Alucard — Obsidian Blade` — 0.82
2. `1 Mythic · Kagura — Feathery Wonderland` — 0.72

MLBB is thin because the sweep ran out of API credit partway through — see
"Untested" below. It is not that those items failed.

---

## Everything that passed (33 usable)

### CODM — 12
| Conf | File |
| --- | --- |
| 0.92 | 4 Rare · Charm — Dog Tag |
| 0.89 | 2 Legendary · Alias — Frostbite |
| 0.88 | 5 Common · Charm — Brass Shell |
| 0.85 | 3 Epic · Price — Monsoon |
| 0.83 | 3 Epic · RVR-8 — Wyrmfire |
| 0.83 | 5 Common · Soap — Recruit |
| 0.72 | 2 Legendary · M4 — Arctic Hunter |
| 0.72 | 3 Epic · Locus — Ironclad |
| 0.68 | 2 Legendary · RUS-79U — Molten Core |
| 0.68 | 3 Epic · PDW-57 — Abyssal |
| 0.68 | 4 Rare · ASM10 — Sandstorm |
| 0.60 | 5 Common · Camo — Olive Standard |

### Valorant — 18 usable
| Conf | File |
| --- | --- |
| 0.90 | 2 Legendary · Sovereign Ghost |
| 0.89 | 3 Epic · Nebula Sheriff |
| 0.88 | 1 Mythic · Ruination Sword |
| 0.88 | 1 Mythic · Singularity Knife |
| 0.87 | 1 Mythic · Elderflame Dagger |
| 0.87 | 1 Mythic · Singularity Phantom |
| 0.87 | 2 Legendary · Reaver Sheriff |
| 0.83 | 1 Mythic · Araxys Vandal |
| 0.83 | 2 Legendary · Prime Spectre |
| 0.82 | 1 Mythic · Spectrum Waveform |
| 0.82 | 2 Legendary · Reaver Knife |
| 0.82 | 4 Rare · Luxe Classic |
| 0.82 | 4 Rare · Prism Spectre |
| 0.72 | 1 Mythic · Elderflame Operator |
| 0.72 | 2 Legendary · Ion Operator |
| 0.68 | 2 Legendary · Champions 2022 Phantom |
| 0.62 | 1 Mythic · Spectrum Phantom |
| 0.62 | 4 Rare · Infantry Bulldog |

### MLBB — 3 usable
| Conf | File |
| --- | --- |
| 0.82 | 2 Legendary · Alucard — Obsidian Blade |
| 0.72 | 1 Mythic · Kagura — Feathery Wonderland |
| 0.62 | 1 Mythic · Ling — Serpent Lord |

---

## Right item, but below the floor — do not use

The scanner names these correctly and then discards them, because confidence
lands under 0.60. Nothing is wrong with the file; the routing floor is doing its
job (§11 F1). They simply will not offer themselves in Review.

- `3 Epic · Sarmad Guardian` — 0.55 (Valorant)
- `3 Epic · Origin Phantom` — 0.52 (Valorant)
- `2 Legendary · Selena — Virulent Nightmare` — 0.47 (MLBB)

## Matches the WRONG item — avoid

Each is a near-miss inside one visual family, which is the honest failure mode
for appearance matching.

| File | Gets matched to |
| --- | --- |
| 1 Mythic · AK117 — Cordite Storm | QQ9 — Diavolo (both red-black molten) |
| 3 Epic · Mace — Blackout | Ghost — Nightfall (both hooded operators) |
| 4 Rare · Camo — Desert Strata | Camo — Urban Splinter (both tan camos) |
| 2 Legendary · Glitchpop Vandal | Spectrum Phantom (both neon rifles) |
| 1 Mythic · Lancelot — Royal Matador | Eudora — Royal Sorcerer |

The Lancelot case is **not** a matcher bug. `mlbb-eudora-royal-sorcerer` ships
art that contradicts its own name — a golden-haired man in white and gold — and
that is a fair description of Lancelot too. Two catalogue entries wearing near
identical art cannot both be picked. Fixing the art fixes this one.

## Untested — avoid on stage

The sweep exhausted the API credit before reaching these, so there is **no
result** for them either way. They are not known failures.

Gord — Conqueror · Granger — Starfall Knight · Miya — Modena Butterfly ·
Chou — Dragon Boy · Fanny — Lightborn Skylark · Kagura — Cherry Witch ·
Lesley — Cyber Blossom · Tigreal — Lightborn Paladin · Akai — Panda Warrior ·
Zilong — Eastern Warrior · Balmond — Frostmoon Dominator · Eudora — Royal
Sorcerer · Nana — Cat Fairy

---

## Why this needed fixing at all

Before the `look` column landed (`config/itemLooks.ts`), the same 54 files
matched **9**. CODM 5/15, Valorant 4/21, MLBB **0/18**. The nine that worked
were Arctic Hunter, Molten Core, Sandstorm, Frostbite, Nebula Sheriff and their
kin — every one an item whose *name already describes its picture*.

The catalogue was sent as id, name, rarity and game, so a label-less upload was
matched against a list of **names**. Nothing about "Ironclad" predicts desert
tan. With a visual description per row it is appearance against appearance, and
of the 41 files that completed, 36 matched and none came back unmatched.

**This list is only valid while the proxy carries the `look` column.** If
`api/assistant.ts` is not redeployed, the client sends the column, the old
function drops it, and the numbers revert to the 9/54 above.
