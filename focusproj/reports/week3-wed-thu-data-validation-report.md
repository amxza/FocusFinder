# Week 3, Wed-Thu: Data Validation & Edge Cases — Test Report

**Last run:** 2026-11-05, after the quality-first scoring rework.
**Scope:** The recommendation engine (`rankLenses`), run against the seeded local database. Claude explanations aren't involved.
**Catalog:** 35 lenses, seeded as 50 `Lens` rows across 5 mounts (Nikon F, Nikon Z, Canon EF, Canon RF, Sony E). A lens sold in several mounts gets one row per mount. The Phase 1 goal is 40 lenses.

Reproduce with:
```bash
npx tsx prisma/seed.ts
npm run validate:combinations   # -> reports/combination-sweep.json
npm run validate:edge-cases     # -> reports/edge-cases-and-personas.json
```

## Summary

| Check | Result |
|---|---|
| Plan edge cases | 4 of 4 pass (Deep Sky with one caveat) |
| Combinations returning 3-5 lenses | 270 of 360 (75%) |
| Combinations returning no lenses | 15 (Nikon Z under $300) |
| Mount, budget and score-limit violations | 0 |
| Same lens repeated in a top 5 | 0 |

All remaining gaps come from the catalog, not the scoring: there aren't enough cheap lenses for some mounts, or long lenses for Planetary and Lunar.

## How scoring works now

Each lens is scored out of 100: **Field quality 50 + Experience 20 + Budget 15 + Credibility 15**. Full detail is in `docs/recommendation-algorithm.md`.

- **Field quality** scores what matters for the requested astro type. For example, Milky Way weighs aperture, coma, wide angle and sharpness, while Planetary weighs reach first. A lens tagged for the type always ranks above an untagged one.
- **Budget** is a light preference. Lenses more than 10% over budget are filtered out, and in-budget lenses differ by at most 4.5 points, so a great cheaper lens can beat a pricier one.
- **Ties** go to the cheaper lens.
- **`matchesAstroType: false`** is returned when a pick isn't tagged for the requested type, and the explanation says so instead of pitching it as a good fit.

### How scoring got here

| Version | What went wrong |
|---|---|
| Original (Budget 35 / Astro 30 / Experience 20 / Credibility 15, cheaper is better) | The cheapest lens won almost every search, even with a $1500+ budget. Coma and sharpness weren't scored. |
| Budget favors 60-90% of the budget | Premium lenses surfaced, but price became the main signal for quality. Among suitable lenses, budget moved scores by 10-19 points and astro fit by under 3. A coma-5 135mm lost to a coma-4 200mm for Deep Sky. |
| Current (Field quality 50 / Experience 20 / Budget 15 / Credibility 15) | Field quality decides the ranking. See the results below. |

## 1. Combination sweep

360 combinations: 6 mount options (5 mounts plus unspecified) × 5 astro types (4 types plus unspecified) × 4 budget tiers × 3 experience options (2 levels plus unspecified).

| Check | Result |
|---|---|
| 0 lenses | 15 |
| 1-2 lenses | 75 |
| 3-5 lenses | 270 |
| More than 5 | 0 |
| Wrong mount returned | 0 |
| More than 10% over budget | 0 |
| Score outside a factor's limit | 0 |
| A tagged lens was available but didn't rank #1 | 0 |

### Combinations with fewer than 3 lenses

Each row covers all 15 astro type and experience combinations for that mount and budget.

| Mount and budget | Lenses | Why |
|---|---|---|
| Nikon Z, under $300 | **0** | The cheapest Nikon Z lens is $389 |
| Nikon F, under $300 | 1 | Only the $279 Rokinon 14mm fits |
| Canon EF, under $300 | 1 | Only the $279 Rokinon 14mm fits |
| Canon RF, under $300 | 1 | Only the $299 RF 16mm fits |
| Canon RF, $300-600 | 1 | The next RF lens is $699 |
| Sony E, under $300 | 2 | The 12mm f/2 and the Rokinon 14mm |

The API returns an empty list for the Nikon Z case, so the Week 4 frontend needs an empty state.

### Top pick not tagged for the requested type

Out of 72 searches per astro type (3 of each are the empty Nikon Z searches):

| Astro type | Top pick lacks the tag | Main cause |
|---|---|---|
| Milky Way | 0 | — |
| Deep Sky | 24 | Low budgets: the cheapest Deep Sky lens is the $449 Rokinon 135mm |
| Planetary | 51 | No long lenses for Nikon F or Canon EF, and none under $699 elsewhere |
| Lunar | 51 | Same lenses as Planetary |

These picks are flagged `matchesAstroType: false`, and the fallback ranking still prefers longer lenses, so a Canon EF planetary search gets the 200mm rather than a 14mm. Closing the gap needs more lenses in the catalog: long lenses for Nikon F and Canon EF, and cheaper long lenses in general.

The Rokinon 135mm f/2 is the top pick in 100 of 360 combinations. It's sold in 3 of the 5 mounts, rated 5 for coma and sharpness, and it's the best fallback for Lunar on a budget.

## 2. Plan edge cases

| Case | Plan expects | #1 pick | Result |
|---|---|---|---|
| Beginner + $300 | Rokinon 14mm (best value) | Rokinon 12mm f/2 ($200), with the 14mm at #2 | **Pass.** The 14mm surfaces, and the 12mm wins by 0.2 points as a faster lens. The 14mm is #1 on Nikon F. |
| Experienced + $1000+ | Premium options | Sigma 20mm f/1.4 Art ($899), tied with the Sigma 85mm f/1.4 Art ($1199) and Sony 24mm f/1.4 GM ($1298) | **Pass.** All five picks are $549-$1298 and rated 5 for coma and sharpness. There's no Experienced level in the schema, so this uses Intermediate. |
| Deep Sky | Wider lenses, lower coma | Rokinon 135mm f/2 (coma 5), then Canon 200mm f/2.8 (coma 4) | **Pass on coma.** "Wider" isn't scored, because deep-sky targets usually need reach rather than width. |
| Planetary | Longer focal length | Canon RF 600mm, then RF 800mm | **Pass.** Tagged long lenses rank first. Without any, the longest untagged lens wins (Canon EF: 200mm). |

## 3. Ten personas

Full output is in `reports/edge-cases-and-personas.json`.

| # | Persona | #1 pick | Notes |
|---|---|---|---|
| 1 | Beginner, Nikon F, $300, Milky Way | Rokinon 14mm f/2.8 ($279) | The only lens that fits |
| 2 | Intermediate, Sony E, $800, Milky Way | Viltrox 16mm f/1.8 ($549) | The 13mm f/1.4 and 16mm f/1.4 are within 1 point |
| 3 | Intermediate, Canon EF, $1500, Deep Sky | Rokinon 135mm f/2 ($449) | Beats the pricier 200mm on coma and sharpness |
| 4 | Beginner, no mount or type, $300 | Rokinon 12mm f/2 ($200) | 3 results, each a different lens |
| 5 | Beginner, Sony E, $500, Lunar | Rokinon 135mm f/2 ($449) | No Lunar lens under $699, so flagged as not dedicated |
| 6 | Intermediate, Canon EF, $1500, Planetary | Canon 200mm f/2.8 ($750) | Canon EF has no Planetary lens; the longest one wins |
| 7 | Budget only, $800 | Viltrox 16mm f/1.8 ($549) | Ranked on general optics |
| 8 | Intermediate, Nikon F, $280 | Rokinon 14mm f/2.8 ($279) | The only lens that fits |
| 9 | Beginner, Sony E, $800, Deep Sky | Rokinon 135mm f/2 ($449) | Only one Deep Sky lens in budget; the rest are flagged |
| 10 | Intermediate, Sony E, $2200, Milky Way | Sigma 20mm f/1.4 Art ($899) | Premium lenses fill the top 3; the Sony GM is #2 |

## Open items

- **Catalog gaps:** add lenses under $300 for Nikon Z and Canon RF, plus long lenses for Nikon F and Canon EF.
- **Rating accuracy:** coma and corner sharpness now shape the top picks, so the 1-5 ratings in `prisma/lenses.json` are worth reviewing before launch.
- **Experience levels:** the plan's form has Beginner / Some / Experienced, but the schema has only `BEGINNER` and `INTERMEDIATE`, and non-beginners always score the full 20 for experience.
- **Credibility:** 30 of 35 lenses hit the full 15 points, so it rarely changes the order.
