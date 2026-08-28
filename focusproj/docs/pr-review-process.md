# Branch Protection & PR Review Process

Week 3 Friday deliverable. This wasn't applied automatically -- it needs changes to the actual GitHub repo settings (`amxza/FocusFinder`), so it's written up here for you to click through directly. Takes about 2 minutes.

## 1. Enable branch protection on `main`

GitHub -> your repo -> **Settings -> Branches -> Add branch protection rule** (or **Add rule**) -> branch name pattern: `main`.

Enable:

- [x] **Require a pull request before merging**
  - Required approvals: **0** for now (solo dev -- bump to 1 the day you add a collaborator)
- [ ] **Require status checks to pass before merging** -- skip this for now. There's no CI workflow yet (that's a Week 6 task per the sprint plan: "GitHub Actions: Run tests on every PR"). Come back and enable this once that workflow exists, and select the `test` job as required.
- [x] **Do not allow bypassing the above settings** -- so it applies to you too, not just collaborators
- [x] **Restrict deletions** -- prevents `main` from being deleted
- [x] **Block force pushes**

Leave everything else at its default. Save.

**Effect:** you can no longer `git push` directly to `main`; every change goes through a PR (opened from a branch, merged via the GitHub UI). This is also exactly what would have caught the accidental-reset incident from Week 3 Mon-Tue -- a protected `main` can't be force-reset by a stray `git push --force` or a careless re-clone-and-push, only by someone with admin bypass.

## 2. PR review checklist

For solo dev, "review" mostly means a deliberate second pass before merging, not waiting on someone else. Checklist to run through on every PR before merging (also captured in `.github/pull_request_template.md`):

- [ ] `npm test` passes locally (43+ vitest cases as of Week 3)
- [ ] `npm run lint` is clean
- [ ] If the change touches `lib/utils/scoring.ts` or `lib/services/recommendationEngine.ts`: re-run `npm run validate:combinations` and `npm run validate:edge-cases` against a seeded local DB, and skim the output for new violations
- [ ] If the change touches `prisma/schema.prisma`: a migration was generated (`prisma migrate dev`) and committed alongside it
- [ ] No secrets (API keys, DB passwords, tokens) in the diff -- `.env` should never appear in `git status` as a tracked change
- [ ] PR description says *what* changed and *why*, not just *what* (the diff already shows what)

## 3. Suggested branch naming

Not enforced by GitHub, just a convention worth keeping consistent from here on:

```
feat/<short-description>     # new functionality (e.g. feat/questionnaire-form)
fix/<short-description>      # bug fixes (e.g. fix/budget-scoring-favors-cheapest)
docs/<short-description>     # documentation only
chore/<short-description>    # tooling, deps, config
```

## Why this now, not earlier

Every backend change up through Week 3 landed as direct commits to `main` (visible in `git log`) -- including one incident where an uncommitted Claude-integration change got silently wiped by a repo reset, because it only ever existed in the working tree. Branch protection doesn't prevent that specific failure mode by itself (uncommitted work is still uncommitted work), but it does force every change through a PR going forward, which means nothing lands on `main` without at least existing as a reviewable, named commit first.
