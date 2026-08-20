# LensFinder Phase 1: Sprint Plan (8 Weeks)

**Goal:** Ship a working astrophotography lens recommendation tool with community validation to r/astrophotography and Discord by end of Week 8.

**Tech Stack:** React + Node.js + PostgreSQL + Prisma + Claude API

---

## Week 1: Design Sprint (1 Week - Not a Standard Sprint)

**Duration:** Mon-Fri (5 days)  
**Goal:** Finalize all designs, data schemas, and recommendation logic before code touches production.

### Tasks


**Thursday: Recommendation Algorithm Spec**
- [ ] Write pseudocode for weighted scoring (Budget × 0.35 + AstroFit × 0.30 + Experience × 0.20 + Credibility × 0.15)
- [ ] Define scoring edge cases:
  - Lens over budget: how much penalty?
  - Beginner buying expensive lens: warning or block?
  - Unknown credibility (new lens): default score?
- [ ] Create test cases (5-10 user scenarios → expected ranking)
- [ ] Deliverable: Algorithm spec doc + test cases

### Week 1 Deliverables
✅ UI/UX mockups (responsive)  
✅ Prisma schema refactored & ready to migrate  
✅ Recommendation algorithm spec + test cases  
✅ Lens database (35-40 lenses + Reddit consensus started)

---

## Sprint 1: Backend Foundations (Weeks 2-3)

**Duration:** 2 weeks  
**Goal:** Database ready + API skeleton + recommendation engine working (no frontend yet).

### Week 2: Setup & Database

**Monday-Tuesday: Project Setup**
- [✅ ] Migrate Prisma schema to PostgreSQL
  - [✅ ] Run `prisma migrate` with new schema
  - [✅ ] Seed database with ~40 lens records (from Week 1 curated list)
  - [✅ ] Seed 5-10 test Review records (Reddit quotes + links)
- [ ] Set up Next.js backend structure:
  - [ ] Routes folder (questionnaire, recommendations, lenses)
  - [ ] Services folder (recommendation engine, lens query)
  - [ ] Utils folder (scoring logic, constants)
- [ ] Configure Claude API integration (basic setup, test connection)
- [ ] Deliverable: Database seeded, backend skeleton ready

**Wednesday-Thursday: Recommendation Engine (Core Logic)**
- [ ] Build scoring service:
  - [ ] Budget match calculator (0-35 points)
  - [ ] Astro type fit scorer (0-30 points)
  - [ ] Experience appropriateness scorer (0-20 points)
  - [ ] Community credibility scorer (0-15 points)
- [ ] Build lens ranking algorithm:
  - [ ] Filter lenses by mount + budget
  - [ ] Calculate scores for each lens
  - [ ] Sort by score, return top 5
- [ ] Write unit tests for scoring (5-10 test cases per scorer)
- [ ] Deliverable: Recommendation engine working, unit tests passing

**Friday: API Routes (Questionnaire)**
- [ ] POST `/api/questionnaire`
  - Input: { mount, astroType, budget, experienceLevel }
  - Output: { searchSessionId, recommendations: [...] }
- [ ] GET `/api/recommendations/:searchSessionId`
  - Returns: List of lenses ranked by score with explanations
- [ ] Error handling + validation
- [ ] Deliverable: Questionnaire API tested, returns ranked lenses

### Week 3: AI Explanations & Testing

**Monday-Tuesday: Claude API Integration**
- [ ] Build explanation generator using Claude:
  - [ ] Prompt: "Explain why [lens] is good for [astro type] with [budget]"
  - [ ] Returns: aiExplain field (1-2 sentences, conversational)
  - [ ] Cache common prompts to avoid API calls
- [ ] Integrate into `/api/recommendations` response
- [ ] Add error handling (Claude timeout, rate limit)
- [ ] Deliverable: Each recommendation includes Claude-generated explanation

**Wednesday-Thursday: Data Validation & Edge Cases**
- [ ] Test all questionnaire combinations (4 × 5 × 4 × 3 = 240 combinations)
  - Does each combo return 3-5 lenses?
  - Are lenses relevant to astro type?
  - Is scoring reasonable?
- [ ] Edge cases:
  - Beginner + $300 budget: should see Rokinon 14mm (best value)
  - Experienced + $1000+ budget: should see premium options
  - Deep Sky focus: should prioritize wider lenses, lower coma
  - Planetary focus: should prioritize longer focal length
- [ ] Create test dataset (10 realistic user personas)
- [ ] Deliverable: All edge cases validated, test report

**Friday: Documentation & Review**
- [ ] API documentation (Postman collection or OpenAPI spec)
- [ ] Database schema diagram
- [ ] Recommendation algorithm flowchart
- [ ] Setup GitHub branch protection + PR review process
- [ ] Deliverable: Complete backend documentation

### Sprint 1 Deliverables
✅ PostgreSQL database with 40+ lenses + reviews  
✅ Recommendation engine (weighted scoring, returns top 5)  
✅ Questionnaire API fully functional  
✅ Claude API integration for explanations  
✅ Backend unit tests + edge case validation  
✅ API documentation

---

## Sprint 2: Frontend & Lens Database (Weeks 4-5)

**Duration:** 2 weeks  
**Goal:** React frontend fully functional + complete lens database with Reddit backing.

### Week 4: Frontend Build

**Monday-Tuesday: Questionnaire Form**
- [ ] Build React questionnaire component:
  - [ ] Mount dropdown (Nikon F, Canon EF/RF, Sony E, Other)
  - [ ] Astro Type dropdown (Milky Way, Deep Sky, Planetary, Lunar, Unsure)
  - [ ] Budget radio buttons ($300, $300-600, $600-1000, $1000+)
  - [ ] Experience Level dropdown (Beginner, Some, Experienced)
  - [ ] Form validation + error messages
  - [ ] Submit button → calls `/api/questionnaire`
- [ ] State management (Redux or Context API)
- [ ] Loading state (spinner while waiting for API)
- [ ] Deliverable: Questionnaire form fully interactive

**Wednesday-Thursday: Recommendation Cards**
- [ ] Build recommendation card component:
  - [ ] Header: Lens name + price + budget status
  - [ ] Why section: Explainability (Claude-generated explanation)
  - [ ] Reddit Consensus box: Quote + link to Reddit posts
  - [ ] Cost vs. Performance table: Comparisons to alternatives
  - [ ] Beginner Warning badge: Common mistakes
  - [ ] Save/Compare buttons
- [ ] Build rankings view (list of 3-5 recommendation cards)
- [ ] Build comparison modal (side-by-side lens comparison)
- [ ] Styling (match mockups from Week 1)
- [ ] Deliverable: All recommendation card variants working

**Friday: Integration & Testing**
- [ ] Connect questionnaire → API → recommendation cards (end-to-end flow)
- [ ] Mobile responsive testing (mobile-first)
- [ ] Error handling UI (what if API fails?)
- [ ] User feedback loop (did recommendation help? Save for later)
- [ ] Deliverable: Full frontend flow working, responsive on mobile/desktop

### Week 5: Lens Database Completion & Polish

**Monday-Tuesday: Complete Lens Database**
- [ ] Finish curating all 40 lenses:
  - [ ] Nikon F: 25-30 lenses with full specs (price, aperture, coma, sharpness, use cases)
  - [ ] Canon EF/RF: 8-10 lenses with full specs
  - [ ] For each lens: 2-3 Reddit posts recommending it (links + quotes)
- [ ] Seed database with complete lens data
- [ ] Verify each lens has:
  - [ ] Specs (price, aperture, focal length, mount)
  - [ ] Astro ratings (coma 1-5, corner sharpness 1-5)
  - [ ] Ideal use cases (array of astro types)
  - [ ] Common mistakes (array of warnings)
  - [ ] Reddit consensus (3+ Review records with quotes + links)
- [ ] Deliverable: Production-ready lens database (40 lenses, fully backed)

**Wednesday-Thursday: Polish & Performance**
- [ ] Optimize recommendation algorithm (should return results in <500ms)
- [ ] Optimize API calls (cache Claude responses where possible)
- [ ] Optimize images (lazy load lens images if added)
- [ ] Accessibility audit (WCAG compliance, screen reader testing)
- [ ] Browser compatibility (Chrome, Firefox, Safari, mobile)
- [ ] Deliverable: App fast, accessible, cross-browser compatible

**Friday: User Testing (Internal)**
- [ ] Have 3-5 people use the app (friends, family, classmates)
- [ ] Test questionnaire clarity (do they understand questions?)
- [ ] Test recommendation trust (do they believe the suggestions?)
- [ ] Test Reddit credibility (does seeing Reddit quotes help?)
- [ ] Collect feedback on:
  - [ ] Confusing UI elements
  - [ ] Missing information
  - [ ] Whether they'd share it with Reddit community
- [ ] Iterate on feedback
- [ ] Deliverable: User testing notes + design refinements

### Sprint 2 Deliverables
✅ React questionnaire form (fully interactive)  
✅ Recommendation card component (all variants)  
✅ End-to-end flow (questionnaire → rankings → comparison)  
✅ Mobile responsive design  
✅ Complete lens database (40 lenses, Reddit-backed)  
✅ Performance optimized (<500ms response time)  
✅ User testing feedback incorporated

---

## Sprint 3: Community Validation & Refinement (Weeks 6-7)

**Duration:** 2 weeks  
**Goal:** Launch to r/astrophotography & Discord, collect real user feedback, refine based on responses.

### Week 6: Deployment & Soft Launch

**Monday-Tuesday: Deployment Setup**
- [ ] Choose hosting (Vercel for frontend, Railway/Heroku for backend)
- [ ] Set up CI/CD pipeline:
  - [ ] GitHub Actions: Run tests on every PR
  - [ ] Auto-deploy to staging on PR
  - [ ] Manual deploy to production
- [ ] Set up monitoring (error tracking, API logs)
- [ ] Configure CORS (allow requests from production domain)
- [ ] Set up analytics (track: questionnaire submissions, recommendations viewed, comparison clicks)
- [ ] Deliverable: App deployed to production, monitoring live

**Wednesday: Soft Launch (r/astrophotography)**
- [ ] Create Reddit post in r/astrophotography:
  - Title: "I built LensFinder: An AI tool to recommend astrophotography lenses based on your budget and goals. Free to use, made for beginners."
  - Include link to app
  - Mention: 40 curated lenses, all recommendations backed by Reddit consensus
  - Ask for feedback: "Does this match what you'd recommend?"
- [ ] Respond to every comment for 24 hours
- [ ] Track metrics: upvotes, comments, click-through rate
- [ ] Deliverable: Soft launch post + first 24 hours of feedback

**Thursday-Friday: Soft Launch (Discord)**
- [ ] Post in 3-5 astrophotography Discord servers (#gear, #equipment channels):
  - Same message as Reddit (adapted for Discord format)
  - Keep tone casual, not salesy
- [ ] Monitor feedback channels for 48 hours
- [ ] Collect feedback: Which recommendations were questioned? Which were praised?
- [ ] Deliverable: Discord feedback collected, themes identified

### Week 7: Refinement & Iteration

**Monday-Tuesday: Feedback Analysis & Prioritization**
- [ ] Aggregate feedback:
  - [ ] What went well? (e.g., "Loved that it shows Reddit posts")
  - [ ] What confused users? (e.g., "Didn't know what 'coma' means")
  - [ ] What's missing? (e.g., "I wanted to compare 3 lenses")
  - [ ] Credibility concerns? (e.g., "Why should I trust this over ChatGPT?")
- [ ] Track common questions/issues
- [ ] Prioritize fixes (impact × ease):
  - P0 (breaking): UI bugs, wrong recommendations
  - P1 (high): Missing explanations, confusing terms
  - P2 (nice to have): Comparison mode improvements
- [ ] Deliverable: Prioritized feedback backlog

**Wednesday-Thursday: High-Impact Fixes**
- [ ] Based on feedback, implement top 3-5 improvements:
  - [ ] Example: Add glossary (hover "coma" → tooltip explains it)
  - [ ] Example: Show why a lens was recommended (add more detail to "Why this lens")
  - [ ] Example: Add "Not sure" follow-up questionnaire
  - [ ] Example: Improve Reddit quote visibility (make quotes larger/bolder)
- [ ] Re-test after each fix
- [ ] Iterate with feedback loop (post fixes, wait 24 hours, collect more feedback)
- [ ] Deliverable: P0 & P1 issues resolved

**Friday: Metrics & Success Criteria**
- [ ] Measure Week 6-7 results:
  - [ ] Questionnaire submissions: ___ (target: 100+)
  - [ ] % who viewed recommendations: ___ (target: >80%)
  - [ ] % who clicked "Compare": ___ (target: >30%)
  - [ ] Average recommendation score credibility (1-5 stars): ___ (target: >4.0)
  - [ ] Repeat visitors: ___ (target: >10% return rate)
- [ ] Read qualitative feedback:
  - [ ] Would you recommend this to a friend? (target: >70% yes)
  - [ ] Did you trust the recommendations? (target: >80% yes)
- [ ] Deliverable: Week 6-7 metrics + qualitative summary

### Sprint 3 Deliverables
✅ Production deployment (frontend + backend live)  
✅ CI/CD pipeline (auto-test, auto-deploy)  
✅ Soft launch to r/astrophotography + Discord  
✅ Community feedback collected & analyzed  
✅ High-impact bugs fixed  
✅ Credibility validated (Reddit backing works)  
✅ Success metrics documented

---

## Sprint 4: Final Polish & Launch (Week 8)

**Duration:** 1 week  
**Goal:** Address remaining feedback, finalize messaging, launch as "public beta" with recruiting story ready.

### Monday-Tuesday: Final Bug Fixes & Polish

**Code Quality**
- [ ] Code review of all PRs from Sprint 3
- [ ] Fix any edge cases found in production
- [ ] Performance optimization (if response times >500ms, optimize)
- [ ] Security audit:
  - [ ] No API keys exposed in frontend
  - [ ] Rate limiting on Claude API calls
  - [ ] Validate all user input

**UX Polish**
- [ ] Review every user flow for friction:
  - [ ] Is the questionnaire quick enough?
  - [ ] Are recommendations clear?
  - [ ] Is the call-to-action obvious?
- [ ] Fix any mobile-specific issues
- [ ] Make sure error messages are helpful
- [ ] Deliverable: Production-ready code

### Wednesday-Thursday: Messaging & Documentation

**Recruiting Story**
- [ ] Write your 30-second elevator pitch:
  - "I built LensFinder, an AI-powered lens recommendation tool for astrophotography beginners. Users answer 4 questions about their camera and budget, get personalized recommendations backed by real Reddit consensus. Launched to r/astrophotography, achieved 100+ users in Week 6-7 with 4.2/5 avg trust rating."
- [ ] Document your metrics:
  - [ ] 100+ questionnaire submissions
  - [ ] 4.2/5 credibility rating
  - [ ] 70%+ return visitor rate
  - [ ] Built in React, Node.js, PostgreSQL, Claude API
- [ ] Create case study:
  - [ ] What problem you solved (lens recommendation confusion)
  - [ ] How you validated it (Reddit research)
  - [ ] What you built (explain system + examples)
  - [ ] What metrics you hit (100+ users, 4+ star rating)
  - [ ] What you'd do next (Phase 2: Canon/Sony, Landscape lenses)

**Changelog & README**
- [ ] Update GitHub README:
  - [ ] What is LensFinder?
  - [ ] Why build this?
  - [ ] How does the recommendation engine work?
  - [ ] Tech stack & architecture
  - [ ] How to set up locally (for future contributors)
  - [ ] Future roadmap (Phase 2, Phase 3)
- [ ] Write public changelog
- [ ] Deliverable: Recruiting story document + GitHub README

### Friday: Final Launch & Retrospective

**Public Launch**
- [ ] Create "Public Beta" post for r/astrophotography:
  - Title: "LensFinder is live: Get personalized astrophotography lens recommendations backed by Reddit consensus"
  - Highlight changes since soft launch
  - Show before/after user testimonials
  - Link to GitHub for transparency
- [ ] Send to 5-10 astrophotography Discord servers
- [ ] Monitor for 24 hours, respond to feedback
- [ ] Deliverable: Public launch complete, community feedback collected

**Sprint Retrospective**
- [ ] What went well?
  - [ ] Design process caught issues early?
  - [ ] 2-week sprints kept momentum?
  - [ ] Reddit validation was powerful?
- [ ] What could improve?
  - [ ] Did you underestimate any tasks?
  - [ ] Were there dependencies you missed?
  - [ ] What would you do differently for Phase 2?
- [ ] Document lessons learned
- [ ] Deliverable: Retrospective notes for Phase 2 planning

### Week 8 Deliverables
✅ Production code polished & bug-free  
✅ Recruiting story documented  
✅ GitHub README + tech documentation  
✅ Public launch to r/astrophotography & Discord  
✅ 100+ users, 4+ star credibility rating  
✅ Retrospective & Phase 2 roadmap

---

## Success Metrics (End of Week 8)

| Metric | Target | Actual |
|--------|--------|--------|
| Questionnaire submissions | 100+ | ___ |
| Average credibility rating | 4.0+ / 5.0 | ___ |
| Return visitor rate | 10%+ | ___ |
| "Would recommend" response | 70%+ | ___ |
| GitHub stars | 10+ | ___ |
| Recruiting story ready | Yes | ✓ |

---

## Phase 2 Roadmap (Weeks 9-12)

Once LensFinder for Astrophotography is validated:

- **Add Sony E mount** (30-40 more lenses)
- **Intermediate/Experienced tiers** (specialty lenses)
- **User wishlists** (save favs, compare later)
- **Launch Landscape Lenses** (same framework, different lens database)

---

## Notes for Execution

**Nights/Weekends Cadence**
- Week 1: 10-15 hours (design + research is time-intensive)
- Weeks 2-8: 12-15 hours per week (2-3 hours per day, 4-5 days per week)
- Total: ~100 hours for MVP

**Dependencies to Watch**
- Week 1: Lens database research (can't progress Week 2 without it)
- Week 3: Claude API integration (test early, API changes can break plans)
- Week 4-5: Frontend depends on backend (keep APIs stable)
- Week 6: Hosting setup (do this early, deployments take time)

**Risk Mitigation**
- If recommendation algorithm is too slow: optimize scoring logic or batch process
- If Claude API costs are high: cache responses, use fewer AI calls
- If community is skeptical: lean harder into Reddit consensus, show more real quotes
- If feedback is negative: have backup ideas for Phase 2

**Recruiting Use**
This sprint plan itself is a portfolio item. Show recruiters:
- You broke down an 8-week project into manageable 2-week sprints
- You prioritized design before code
- You validated with real users (Reddit) before scaling
- You measured success with metrics (100+ users, 4+ star rating)
- You documented everything for future phases

This is what separates junior from mid-level thinking.
