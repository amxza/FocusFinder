# Database Schema

Source of truth: [`prisma/schema.prisma`](../prisma/schema.prisma). Regenerate this diagram by hand if the schema changes -- it's not auto-synced.

```mermaid
erDiagram
    Customer ||--o{ SearchSession : submits
    SearchSession ||--o{ Recommendation : produces
    Recommendation ||--o{ LensRecommendation : "wraps (1 per rec today)"
    Lens ||--o{ LensRecommendation : "recommended via"
    Lens ||--o{ Review : "backed by"
    Lens ||--o{ LensComparison : "compared as primary"
    Lens ||--o{ LensComparison : "compared as secondary"

    Customer {
        string id PK
        string email UK
        string username UK
        string password
        datetime createdAt
        datetime updatedAt
    }

    SearchSession {
        string id PK
        string customerId FK
        astroType preferredType "nullable"
        Mount preferredMount "nullable"
        float maxBudget
        ExperienceLevel experienceLevel "nullable"
        datetime createdAt
    }

    Recommendation {
        string id PK
        string searchId FK
        int rank "1 = top pick, max 5 per session"
        string aiExplain "Claude-generated, never empty"
        datetime createdAt
    }

    LensRecommendation {
        string id PK
        string recommendationId FK
        string lensId FK
    }

    Lens {
        string id PK
        string name
        string brand
        string lensMount "NIKONF / NIKONZ / CANONEF / SONYE"
        string focalLength
        float maxAperture
        float price
        string imageUrl "nullable"
        int comaRating "1-5"
        int cornerSharpness "1-5"
        string manualFocusQuality
        string_array idealUseCase "human labels, e.g. Deep Sky"
        string_array redditConsensusUrl
        float averageReviewScore
        string_array commonMistakes
        string comparisonNotes
        datetime createdAt
        datetime updatedAt
    }

    Review {
        string id PK
        string lensId FK
        Sources source "nullable"
        string sourceUrl
        string quote
        string authorReputation "nullable"
        int rating "1-5"
        astroType useCaseMatch "nullable"
        datetime createdAt
    }

    LensComparison {
        string id PK
        string primaryLensId FK
        string secondaryLensId FK
        string comparison
    }

    Session {
        string id PK
        string sid UK
        string data
        datetime expiresAt
    }
```

## Notes for readers

- **`Session` is unrelated to `SearchSession`.** `Session` looks like scaffolding for a future auth/cookie-session mechanism (`sid` + opaque `data` blob) -- nothing in the current codebase reads or writes it yet.
- **`Lens.lensMount` and `Lens.idealUseCase` are plain strings, not foreign keys into the enums.** `lensMount` is validated at seed time against the `Mount` enum's values (`prisma/seed.ts`); `idealUseCase` stores human-readable labels ("Deep Sky") rather than raw enum values ("DEEPSKY") because that's what `lib/utils/scoring.ts` compares against (`ASTRO_TYPE_LABELS` in `lib/utils/constants.ts` is the mapping). Both are worth turning into real relations/enums if the schema gets revisited.
- **One `Lens` row per supported mount.** A physical lens sold in multiple mounts (e.g. the Samyang/Rokinon 14mm f/2.8, available in Nikon F / Canon EF / Sony E) is seeded as 3 separate `Lens` rows, one per mount, rather than one row with a mount array -- `lensMount` is a single string per row.
- **`LensRecommendation` is a join table with headroom it doesn't use yet.** Today each `Recommendation` always wraps exactly one `LensRecommendation`/`Lens`; the `@@unique([recommendationId, lensId])` constraint would also support a future many-lenses-per-recommendation case (e.g. bundling a body + lens kit) without a schema change.
- **Deleting a `Lens` is blocked (`RESTRICT`) while any `LensRecommendation` still references it**, but deleting a `Recommendation` cascades to its `LensRecommendation` rows. Re-seeding must clear `Recommendation`/`SearchSession` before `Lens` -- see the ordering comment in `prisma/seed.ts`.
