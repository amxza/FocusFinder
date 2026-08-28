# Recommendation Algorithm

How a questionnaire submission turns into 5 ranked, explained lens picks. Source: `lib/services/recommendationEngine.ts`, `lib/services/lensQuery.ts`, `lib/utils/scoring.ts`, `lib/services/explanationGenerator.ts`.

## End-to-end flow

```mermaid
flowchart TD
    A["POST /api/questionnaire<br/>{ customerId, mount?, astroType?, budget, experienceLevel? }"] --> B{Valid?}
    B -- "no" --> B1["400 + list of every<br/>field that failed"]
    B -- "yes" --> C["findCandidateLenses()<br/>WHERE lensMount = mount (if given)<br/>AND price &le; budget &times; 1.1"]
    C --> D["scoreLens() per candidate<br/>(see scoring detail below)"]
    D --> E["sort desc by total score,<br/>slice(0, 5)"]
    E --> F["generateExplanation() per pick,<br/>in parallel (Promise.all)"]
    F --> G["persist SearchSession +<br/>one Recommendation per pick"]
    G --> H["201: { searchSessionId, recommendations }"]

    I["GET /api/recommendations/:id"] --> J{"Session exists?"}
    J -- "no" --> J1[404]
    J -- "yes" --> K["read persisted rank + aiExplain + lens"]
    K --> L["200: { searchSessionId, recommendations }"]

    G -.->|"searchSessionId can be\nre-fetched later"| I
```

## Scoring detail (per candidate lens)

Weighted model from the Week 1 algorithm spec, unchanged since then: **Budget 35% + Astro fit 30% + Experience 20% + Credibility 15%**. Each sub-scorer computes a 0-100 raw value, which is then weighted and clamped to its slice of the 100-point total.

```mermaid
flowchart LR
    subgraph Budget["scoreBudgetMatch -- 0-35 pts"]
        direction TB
        B1{"price &le; budget?"}
        B1 -- yes --> B2["70 + (1 - price/budget) &times; 30<br/><i>compressed 70-100 band --<br/>affordability is a mild tiebreaker,<br/>not the dominant factor</i>"]
        B1 -- no --> B3["(budget/price) &times; 50<br/><i>half credit, scaled down</i>"]
    end

    subgraph Astro["scoreAstroFit -- 0-30 pts"]
        direction TB
        A0{"astroType given?"}
        A0 -- no --> A4["100 (no penalty)"]
        A0 -- yes --> A1{"tag matches<br/>requested type?"}
        A1 -- yes --> A2["70 + avg(comaRating,<br/>cornerSharpness) &times; 6<br/><i>76-100, so quality still<br/>differentiates same-tag lenses</i>"]
        A1 -- no --> A3{"multiple tags<br/>(versatile)?"}
        A3 -- yes --> A3a["70"]
        A3 -- no --> A3b["20"]
    end

    subgraph Exp["scoreExperience -- 0-20 pts"]
        direction TB
        E0{"experienceLevel<br/>= BEGINNER?"}
        E0 -- no --> E4["100 (flat --<br/>no differentiation)"]
        E0 -- yes --> E1["100 minus penalties:<br/>-20 imprecise focus-by-wire<br/>-15 aperture &le; f/2<br/>-25 has documented common mistakes"]
    end

    subgraph Cred["scoreCredibility -- 0-15 pts"]
        direction TB
        C1["avgReviewScore &times; 20<br/>+ reviewCount &times; 10<br/>+ distinctSources &times; 5<br/><i>capped at 100</i>"]
    end
```

`total = budget + astroFit + experience + credibility`, each already clamped to its max (35/30/20/15) before summing, so `total` never exceeds 100.

## Why this shape

- **The candidate filter is a hard mount match, soft budget match.** `findCandidateLenses` excludes wrong-mount lenses entirely, but admits lenses up to 10% over budget -- the over-budget half-credit penalty in `scoreBudgetMatch` is what keeps those from usually winning, not the filter itself.
- **Astro fit degrades gracefully with no signal.** No `astroType` given -> every lens scores a full 30, so the ranking falls back to budget + experience + credibility. Also what happens today when a requested astro type has zero matching lenses in the catalog (e.g. Planetary, as of the Week 3 Wed-Thu validation pass) -- nothing crashes, it just can't meaningfully differentiate.
- **Explanation generation never blocks or fails the request.** `generateExplanation` catches Claude timeouts/rate-limits/API errors internally and falls back to a deterministic sentence, so a Claude hiccup for one lens can't take down the other four or the whole `POST /api/questionnaire` call. Explanations are also cached in-memory per `(lensId, astroType, budgetTier, experienceLevel)` bucket to cut down on repeat API calls for common combinations.
- **The two numbers above (70-100 budget band, coma-blended astro fit) were a deliberate rework**, not the original Week 2 formula -- see `reports/week3-wed-thu-data-validation-report.md` for the edge cases that motivated it (the original budget formula spanned the full 0-100 range and let "cheapest lens" dominate regardless of how large the user's budget was).
