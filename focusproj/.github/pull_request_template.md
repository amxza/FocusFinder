## What changed

<!-- One or two sentences: what does this PR do? -->

## Why

<!-- Why was this needed? Link an issue/sprint-plan item if relevant. -->

## Checklist

- [ ] `npm test` passes locally
- [ ] `npm run lint` is clean
- [ ] Touches `lib/utils/scoring.ts` or `recommendationEngine.ts`? Re-ran `npm run validate:combinations` / `validate:edge-cases` and checked for new violations
- [ ] Touches `prisma/schema.prisma`? Migration generated and committed
- [ ] No secrets in the diff (`.env`, API keys, tokens)
