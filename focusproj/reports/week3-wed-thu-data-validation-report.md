# Week 3, Wed-Thu: Data Validation & Edge Cases — Test Report

**Date:** 2026-08-31 (adjust if run again later)
**Scope:** Recommendation engine (`rankLenses`) validated directly against the live, seeded database — no Claude calls involved (explanation generation was already validated separately in Week 3 Mon-Tue).
**Catalog size at time of testing:** 28 catalog entries → 35 seeded `Lens` rows (multi-mount lenses get one row per supported mount: NIKONF 7, CANONEF 11, SONYE 17). This is below the Phase 1 goal of 40 lenses — noted throughout where it affects results.

Reproducible via:
```bash
npm run validate:combinations   # scripts/validate-combinations.ts -> reports/combination-sweep.json
npm run validate:edge-cases     # scripts/validate-edge-cases.ts   -> reports/edge-cases-and-personas.json
```

---

## 1. Combination Sweep

The plan's 4 × 5 × 4 × 3 = 240 combinations assumed 4 mount options and 5 astro-type options; the schema only has 3 real mounts and 4 real astro types, so the 4th mount / 5th astro-type slot is "unspecified" (the questionnaire form's "Other"/"Unsure"). Experience level similarly has 2 real values (BEGINNER/INTERMEDIATE — no EXPERIENCED) + unspecified = 3. Net: still 240 combinations, same intent.

| Check | Result |
|---|---|
| Combinations run | 240 / 240 |
| Combos returning 0 lenses | **0** |
| Combos returning 1-2 lenses | 15 (6.25%) |
| Combos returning 3-5 lenses | 225 (93.75%) |
| Combos returning >5 lenses | 0 (correctly capped) |
| Mount filter violated (wrong mount returned) | 0 |
| Budget allowance violated (>10% over budget returned) | 0 |
| Score bounds violated (outside each scorer's max) | 0 |
| Astro-type mismatches where a matching lens *was* available | 0 |

**All 15 under-3-result combos are the same corner:** `mount=NIKONF, budget=under $300` (all 5 astro-type values × all 3 experience values). Nikon F only has 7 lenses total, and only 2 of those clear the under-$300 budget filter. This is a direct consequence of the 28-lens catalog (vs. the 40-lens goal) and Nikon F being the smallest-represented mount — not an algorithm bug. It should self-resolve as the catalog grows toward 40.

**Everything else passed clean:** no zero-result combos, no filter violations, no out-of-bounds scores, and whenever a lens tagged for the requested astro type existed in a combo's candidate pool, it always ranked #1.

---

## 2. Named Edge Cases (from the sprint plan)

### Edge case 1 — Beginner + $300 budget
**Plan expectation:** best-value pick surfaces (named a Rokinon 14mm).
**Actual top pick:** Samyang/Rokinon 12mm f/2 ($200), *not* the 14mm f/2.8 ($279).

This is explainable, not broken: both are tagged Milky Way (equal astro-fit), but the 12mm's budget score (11.7/35) beats the 14mm's (2.4/35) because it's proportionally much further under the $300 ceiling. The 14mm actually scores *better* on the beginner-friendliness dimension (15/20 vs 12/20 — the 12mm's f/2 aperture trips the "difficult focus ring" penalty at ≤f/2), but budget carries the highest weight (0.35) and dominates. Whether "cheapest of two similar primes" or "the specific lens the plan named" counts as the more correct answer is a product call, not a code bug — flagging it as a finding rather than "fixing" it unilaterally.

### Edge case 2 — "Experienced" + $1000+ budget
**Plan expectation:** premium options surface.
**Actual top pick:** the same $200 Samyang/Rokinon 12mm f/2 — again beating out the catalog's $750–$999 lenses.

**This is the most significant finding in this report.** `scoreBudgetMatch`'s formula is:
```
rawScore = (1 - price / maxBudget) * 100   // when price <= maxBudget
```
This rewards being *far under* the budget ceiling, not *using* the budget well — so it structurally favors the cheapest lens in the catalog almost regardless of how high the user's budget is. A $200 lens against a $1500 ceiling scores 30.3/35 on budget; a $999 lens against that same ceiling only scores 11.7/35. Nothing in the other three scorers (astro-fit, experience, credibility) is strong enough to overcome that gap when several lenses share the same astro tag. Net effect: a user who explicitly signals "I have money to spend" currently gets steered toward the cheapest gear in the catalog instead of premium options — the opposite of the plan's stated intent.

*Recommendation (not applied — this is a scoring-formula design decision, flagging for your call):* score how close the price is to a "sweet spot" within the user's budget band (e.g. reward proximity to 60-90% of budget) rather than monotonically rewarding "further under budget," or at minimum stop penalizing lenses for spending closer to what the user said they're willing to spend.

### Edge case 3 — Deep Sky focus
**Plan expectation:** wider lenses / lower coma prioritized.
**Actual result:** the one Deep-Sky-tagged lens in the catalog (Samyang/Rokinon 135mm f/2.0 ED UMC, coma rating 5/5) correctly ranks #1, ahead of the Canon EF 200mm f/2.8L (also Deep-Sky-tagged, coma 4) and well ahead of untagged Milky-Way lenses.

**Secondary finding:** `comaRating` and `cornerSharpness` are seeded on every lens but **are never read anywhere in `lib/utils/scoring.ts`**. The engine currently satisfies "prioritize... lower coma" purely through the coarse `idealUseCase` tag match, not any actual comparison of coma/sharpness values. Today that's invisible because only one Deep-Sky lens exists per mount — but the moment a second Deep-Sky lens is added with worse coma, nothing in the scoring model would rank the better-coma lens higher. Worth deciding whether coma/sharpness should factor into `scoreAstroFit` (or a new scorer) before the catalog grows.

### Edge case 4 — Planetary focus
**Plan expectation:** longer focal length prioritized.
**Actual result:** the catalog has **zero lenses tagged Planetary** (confirmed directly against the DB — only `Milky Way`, `Deep Sky`, and `Lunar` tags exist across all 35 rows). The engine degrades gracefully — it doesn't error or return nothing, it just falls back to budget/credibility-driven ranking among lenses with the lowest possible astro-fit score (20 × 0.3 = 6/30 for non-versatile lenses). The one partial silver lining: a lens tagged both `Lunar` and `Deep Sky` (Canon RF 800mm f/11, the catalog's longest lens) gets a "versatile" astro-fit bonus (21/30) and surfaces at #4 in the $1500-budget persona test — coincidentally the most planetary-appropriate lens in the catalog by focal length, despite not being tagged for it. This is a data gap, not an algorithm bug, but it means **Planetary queries can't be meaningfully validated until at least one lens is tagged Planetary.**

---

## 3. Ten Personas

Full output in `reports/edge-cases-and-personas.json`; highlights below.

| # | Persona | Top pick | Notes |
|---|---|---|---|
| 1 | Beginner, Nikon F, $300, Milky Way | Rokinon 12mm f/2 ($200) | Only 2 results available (see §1) |
| 2 | Intermediate, Sony E, $800, Milky Way | Rokinon 12mm f/2 ($200) | Reasonable top-5 spread |
| 3 | Intermediate, Canon EF, $1500, Deep Sky | Rokinon 135mm f/2 ($449) | Correct Deep-Sky prioritization |
| 4 | Beginner, no mount/astro given, $300 | Rokinon 12mm f/2 ($200) ×3 | See §4 — same lens shows 3x (one row per mount) |
| 5 | Beginner, Sony E, $500, Lunar | Rokinon 12mm f/2 ($200) | No Lunar-specific ranking signal beyond the tag |
| 6 | Intermediate, Canon EF, $1500, Planetary | Rokinon 12mm f/2 ($200) | Confirms the Edge case 4 gap under budget pressure |
| 7 | Only budget given ($800) | Rokinon 12mm f/2 ($200) ×3 | Same duplication as #4 |
| 8 | Intermediate, Nikon F, $280 | Rokinon 12mm f/2 ($200) | Smallest-inventory corner, only 2 results |
| 9 | Beginner, Sony E, $800, Deep Sky | Rokinon 135mm f/2 ($449) | Correct prioritization despite beginner penalty on budget lens |
| 10 | Intermediate, Sony E, $2200, Milky Way | Rokinon 12mm f/2 ($200) | Same "cheapest wins" pattern as Edge case 2 |

**7 of 10 personas top out on the same $200 Rokinon 12mm f/2.** That's the budget-formula bias from Edge case 2 showing up across nearly every scenario where multiple lenses share an astro tag — it's the dominant pattern in this whole test pass, not a one-off.

---

## 4. Additional finding: near-duplicate results on open (mount-unspecified) queries

Personas 4 and 7 (and Edge case 1) leave `mount` unspecified. Because multi-mount lenses were seeded as one row per supported mount, the same physical lens fills 3 of the top-5 slots (e.g. "Rokinon 12mm f/2" appears as the NIKONF, CANONEF, and SONYE rows back-to-back). There's also a near-duplicate catalog entry — "Samyang/Rokinon 12mm f/2" and "Samyang/Rokinon 12mm f/2.0 NCS CS" are separate rows with identical price/coma/focal-length specs, likely the same real product listed twice in the source data.

**Effect:** a user who hasn't told us their mount yet sees a "top 5" that's really only 2-3 distinct lenses. Worth deduplicating by lens name (or asking for mount before ranking) — this is purely a presentation/ranking-diversity issue, not a correctness bug (the mount filter itself is never violated).

---

## Summary — Findings by Priority

Using the plan's own P0/P1/P2 vocabulary (Week 7) for consistency:

- **P1 — Budget scoring favors "cheapest" over "premium," contradicting the "Experienced + $1000+ → premium options" requirement.** (Edge case 2, confirmed in 7/10 personas.) Needs a product decision on the intended budget-scoring shape.
- **P1 — `comaRating`/`cornerSharpness` are collected but never scored.** Invisible today (only 1 Deep-Sky lens exists) but will misrank as the catalog grows. (Edge case 3.)
- **P2 — Zero Planetary-tagged lenses; Planetary queries can't be validated yet.** Resolves as the catalog fills in toward 40 lenses. (Edge case 4, persona 6.)
- **P2 — Near-duplicate results when mount is unspecified**, from per-mount row expansion + a likely duplicate catalog entry. (§4, personas 4 & 7.)
- **Not a bug — catalog-size artifact:** 15/240 combos (all Nikon F + under $300) return 2 lenses instead of 3-5, purely because Nikon F + that budget only has 2 lenses in a 28-lens catalog. Self-resolves as the catalog grows.

**Confirmed working correctly:** mount hard-filtering, budget soft-filtering (10% over-budget allowance), score bounds on every scorer, top-N capping at 5, and astro-type tag matching whenever a tagged lens exists in the candidate pool.
