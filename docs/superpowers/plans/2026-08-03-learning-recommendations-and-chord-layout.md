# Learning Recommendations And Chord Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate difficulty-based hymn recommendation list and make each left-hand chord card shrink to the width of its three text lines while staying centered under its source note.

**Architecture:** The score generation pipeline will add key signature, meter, and position-change count to each catalog entry so the browser can classify all hymns without fetching hundreds of score files. A pure recommendation module will assign base hymns to seven ordered stages, and a new route will render one selected stage at a time. PPT chord tracks will size each card from its longest rendered text line plus minimal horizontal padding, center it on the measured source-note anchor, and use collision lanes without unnecessary horizontal whitespace.

**Tech Stack:** React 18, TypeScript, React Router, Vitest, Testing Library, SVG, Vite

---

### Task 1: Generate recommendation metadata

**Files:**
- Modify: `scripts/score-pipeline/import-corpus.ts`
- Modify: `scripts/generate-score-assets.ts`
- Modify: `scripts/generate-hymn-catalog.mjs`
- Modify: `src/features/hymns/types.ts`
- Test: `scripts/score-pipeline/import-corpus.test.ts`
- Test: `src/features/hymns/catalog.test.ts`

- [ ] Add nullable `key_signature`, `meter`, and `position_change_count` fields to generated and runtime catalog types.
- [ ] Build each structured entry's profile from its `PianoScoreDocument` and `PianoArrangementDocument`; image-only and alternate entries receive `null`.
- [ ] Include the fields in both catalog generators.
- [ ] Assert that 709 structured entries have arrangement-derived counts, 666 have a known key, and image-only entries do not inherit base-version metrics.
- [ ] Run:

```bash
npm run generate:scores
npm run test:run -- scripts/score-pipeline/import-corpus.test.ts src/features/hymns/catalog.test.ts
```

Expected: generation succeeds and both test files pass.

### Task 2: Classify the learning curve

**Files:**
- Create: `src/features/hymns/recommendations.ts`
- Create: `src/features/hymns/recommendations.test.ts`

- [ ] Define seven exhaustive stages for known-key base hymns:

```text
1. C, 4/4, 0-2 moves
2. C, 4/4, 3-4 moves
3. C, non-4/4, 0-4 moves
4. C, 5+ moves
5. non-C, 0-2 moves
6. non-C, 3-4 moves
7. non-C, 5+ moves
```

- [ ] Sort within each stage by key complexity, move count, meter preference, and hymn number.
- [ ] Exclude alternate tunes, unknown-key entries, and image-only entries from recommendations without removing them from the original catalog.
- [ ] Test every boundary, deterministic sorting, and complete non-overlapping classification.
- [ ] Run:

```bash
npm run test:run -- src/features/hymns/recommendations.test.ts
```

Expected: all classification tests pass.

### Task 3: Add the recommendation route and navigation

**Files:**
- Create: `src/pages/HymnRecommendationsPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/app/AppShell.tsx`
- Modify: `src/components/HymnCard.tsx`
- Modify: `src/styles/components.css`
- Test: `src/App.test.tsx`

- [ ] Add `/recommendations` and a sidebar/mobile navigation item named `推荐`.
- [ ] Render a seven-step stage rail with stage count, criteria, and selected state.
- [ ] Reuse hymn actions while adding compact badges for key, meter, and move count.
- [ ] Keep `/hymns` unchanged as the numbered catalog.
- [ ] Verify keyboard roles, stage switching, and navigation in `App.test.tsx`.
- [ ] Run:

```bash
npm run test:run -- src/App.test.tsx
```

Expected: the original catalog and new recommendation flow both pass.

### Task 4: Fit each chord card to its content

**Files:**
- Modify: `src/features/score/PptScore.tsx`
- Test: `src/features/score/PptScore.test.tsx`
- Test: `src/features/score/PptScore.corpus.test.ts`

- [ ] Add `width` to each positioned chord.
- [ ] Keep existing collision-lane assignment based on source anchors.
- [ ] Estimate the rendered width of the chord name, fingering, and status lines and use the longest line plus 4px padding on each side.
- [ ] Keep each card centered on its measured source-note anchor except for minimal page-edge clipping protection.
- [ ] Use the computed width for card rectangles and centered text; keep collision lanes without adding horizontal whitespace.
- [ ] Assert content-dependent widths, card-center/source-anchor alignment, and collision-lane behavior.
- [ ] Run:

```bash
npm run test:run -- src/features/score/PptScore.test.tsx src/features/score/PptScore.corpus.test.ts
```

Expected: layout tests and all 1,319 render variants pass.

### Task 5: Full verification

**Files:**
- Regenerate: `public/materials/hymns/catalog.json`
- Regenerate: `src/data/hymns.generated.ts`

- [ ] Run:

```bash
npm run generate:scores
npm run test:run
npm run lint
npm run check
npm run build
npm run dev:restart
```

- [ ] Open `/#/recommendations` and verify the first two C-major stages.
- [ ] Open a score with four chords in one row and verify every card tightly wraps its text and remains aligned with its source note.
