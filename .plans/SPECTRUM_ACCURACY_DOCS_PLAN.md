# ZX Spectrum Accuracy Documentation Plan

Status: **implemented** (2026-10-23), Phases 1-3; see "As built" at the end. Not committed yet.
The author accepted every recommendation of §7 (answers recorded there).

Follows `.plans/SPECTRUM_ULA_ACCURACY_PLAN.md` (implemented, commit `5c5eb9cfc`). That plan made the
48K and 128K pass the community's timing test programs; this one **shows it** on the documentation
site: a short page that names each test program, says what it checks and what Klive's result is,
with a screenshot of Klive running it (and, where one exists, the real machine's photo beside it).

It is also the ZX Spectrum half of the roadmap's G10.1 "Published Z80 test results"
(`.plans/CLOSING_THE_GAPS_PLAN.md`) and of W10 "Proof points" in
`.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md`.

---

## 1. Goals

1. A reader can see, in a few minutes, **which tests Klive's 48K and 128K pass**, who wrote them,
   what each checks, and where its expected results come from (the real machines).
2. Every claim has **evidence on the page**: a screenshot of Klive's own output, generated, not
   hand-captured.
3. The page **cannot drift**: the screenshots are produced by the same runs the slow test tier
   makes, and a test fails when a published picture no longer matches what Klive produces.
4. **Honest limits**: what is not passed or not checked yet (§4.4) is on the page too.

Not goals: a page per test program, results for machines the kit does not cover (+2A/+3 beyond a
mention, Next, ZX81), and translations (§6).

## 2. Where it goes

A new page, **`docs/content/en/under-the-hood/emulator-internals/spectrum-accuracy.mdx`**, titled
"ZX Spectrum: how Klive's accuracy is tested", next to "ZX Spectrum: how the screen is drawn"
(`spectrum-display.mdx`), which already explains the mechanisms the tests check and links here.

- `_meta.ts` of `emulator-internals` gets the entry after `spectrum-display`.
- `spectrum-display.mdx`'s paragraph that names the test programs (Part 6, "Drawing late, but at
  the right moment") links to the new page; the new page links back for the mechanisms.
- The machine types reference (`reference/machine-types.mdx`, 48K and 128K sections) gets a
  one-line link.
- A new route: `.plans/docs-routes.golden.txt` is re-baselined (`node scripts/check-docs-routes.cjs
  --update`) in the same change; no redirect is needed (nothing moves).

The landing page gets a short "Tested against real hardware" item linking to the page (§7 Q1,
Phase 3).

## 3. Page outline

Target length: about 150 lines of MDX, one screen per section on a laptop.

1. **Intro** (3-4 sentences): the community wrote test programs that run on a real Spectrum and
   compare what they measure with real machines; Klive runs them on its own cores in its slow test
   tier; the expectations come from real hardware, never from Klive's own output.
2. **Results at a glance**: one table, one row per program.

   | Program | Author, year | What it checks | Klive (48K / 128K) |
   |---|---|---|---|
   | ZX Spectrum Timing Tests 48K | R. and T. Butler, 2010 | 35 instruction groups, uncontended and contended memory, against a real 48K | 100% pass |
   | ZX Spectrum Timing Tests 128K | R. and T. Butler, 2015 | the same suite on a real (late-timing) 128K | all but one test, with late timing |
   | HALT2INT v3 | M. Woodmass, 2022 | when a HALT meets the interrupt; early or late ULA | matches the author's photos of real early and late 48Ks |
   | Float48K, Float128K | M. Woodmass, 2008 | the floating bus, T-state by T-state | the documented pattern |
   | FloatSpy v0.33 | RAMSOFT, 2002 | the floating bus, ULA type | 48K detected; passes (author's runs) |
   | Border Time, Screen Time | J. Bobrowski, 2011 | when a border change and a screen write take effect | where the WoS FAQ puts them |
   | Timing Test v0.3 | P. Rak, 2013 | the duration of code at every T-state | the FAQ's contention pattern |
   | Snow tests (Snow, Snow48 ×11, SnowTests, Snow Hold) | various, 2014-2025 | the snow effect | snow shows (by-eye comparison open) |

3. **One section per test family** (Timing Tests; HALT2INT; floating bus; Border/Screen Time and
   Timing Test; snow), each: two or three sentences on what the program does and how to read its
   screen, then the screenshot(s), with a caption saying what the picture proves. HALT2INT shows
   Klive's early and late runs **beside the author's photos of the real machines** (if §7 Q2 allows).
4. **Early and late machines**: one paragraph and the HALT2INT pair; link to the Late ULA Timing
   setting.
5. **What the tests found**: the bugs the kit exposed and that were fixed (prefixed instructions'
   contention, HALT's fetch address, the 128K's contention table and 35 T-state interrupt), in the
   reader's words - this is what makes the page more than a scoreboard.
6. **Not yet proven** (§4.4).
7. **Run them yourself**: the kit is in the repository (`vendor/spectrum-tests/`), `npm run
   test:slow` runs it and writes every picture to `.spectrum-kit/`; and every program is a `.tap`
   that loads in Klive like any other.

## 4. Screenshots

### 4.1 What they are

**The emulator's picture only**, as the core renders it (border included, 352 × 288), not the IDE
window: that is what each claim is about, it carries no UI that could date, and it needs no
running app. The kit already produces exactly this (`savePicture` in `test/spectrum-kit/kit.ts`,
via `screenImageOf`, the same bytes the emulator panel and `klive run --screenshot` show).

The doc-shots harness (`scripts/doc-shots/`, `.ai/doc-screenshots-guide.md`) is **not** needed. One
optional exception (§7 Q3): a single screenshot of the IDE with the Settings › Emulator page
showing **Snow Effect** and **Late ULA Timing**, made with a doc-shots recipe.

### 4.2 The set

About 12 pictures, each a few kilobytes (PNG of a 15-colour image), well inside the 1.5 MB page
budget (`scripts/check-docs-weight.cjs`):

| Picture | Run |
|---|---|
| `timing-tests-48k.png` | the last page: "All Tests Complete 100% Pass" |
| `timing-tests-48k-contended.png` | one contended test passing (a page with "Pass" after "Expecting" no longer shows) |
| `timing-tests-128k-late.png` | the last test pages with late timing |
| `halt2int-48k-early.png`, `halt2int-48k-late.png` | beside `Real 48k (early).png` / `(late).png` |
| `halt2int-128k-late.png` | the 128K's "Late / Late" |
| `float48k.png` | the T-state table from 14,330 |
| `border-time-14336.png` | the border changing exactly at the paper's left edge |
| `screen-time-14335.png` | $4000's cell read |
| `timing-test-0.png` | the contended-NOP table |
| `snow48.png`, `snow48-nosnow.png` | the same picture with and without snow |

They are published **pre-scaled 2×** with nearest-neighbour (704 × 576), so the site's image
pipeline cannot blur the pixels whatever it does; a 15-colour PNG of that size stays a few
kilobytes.

### 4.3 Making and publishing them

- The kit's `savePicture` writes to `.spectrum-kit/` as now. A new flag,
  **`KIT_PUBLISH=1`**, makes the runs listed in §4.2 also write their picture to
  `docs/public/images/spectrum-accuracy/` (the doc-shots convention: generated, then reviewed
  with `git diff`).
- **No golden is recorded from Klive's own output first** (the ULA plan's ground rule): a picture
  is published only from a run whose assertion passed - the kit test asserts the program's own
  PASS/FAIL or its match with a real-machine photo before it writes the published copy.
- **Drift check**, in the same kit tests rather than a second run of every program: each test keeps
  its pictures in memory as it takes them and, only after its assertions pass, either writes them
  (`KIT_PUBLISH=1`) or compares their pixels with the committed PNGs (decoding the PNG, so a zlib
  version cannot fail it). A core change that alters a published result fails the slow tier; the
  fix is to re-publish and re-read the page. A picture taken mid-run (Border Time at 14,336) is kept
  until the end of the test, so nothing is published from a run that later fails.

### 4.4 The real-machine photos (Q2: shown)

HALT2INT's `Real 48k (early).png` (675 × 573, 464 KB) and `Real 48k (late).png` (1357 × 961,
1.6 MB) are too heavy as they are: the late one alone exceeds the page budget. They are converted
once with `sharp` (resolved from `docs/node_modules`, as the doc-shots harness does) to `.webp` at
the width the page shows (about 700 px), cropped to the screen area, target under 100 KB each, and
committed as `docs/public/images/spectrum-accuracy/real-48k-early.webp` / `-late.webp`. Their
captions credit Mark Woodmass and link the ZXE wiki's HALT2INT page; the page says they are his
photos of his own machines, shipped under GPLv2 with the program (`vendor/spectrum-tests/halt2int/
COPYING`). A small script, `scripts/build-doc-accuracy-photos.cjs`, does the conversion so it can be
repeated; it is run by hand, like `build-doc-fonts.cjs`.

### 4.5 Not yet proven (stated on the page)

From the ULA plan's "Open" list, in the reader's words:

- Timing Tests 128K, test 15 uncontended (IM 0/1/2): not passed, not explained.
- The +2A/+3's contention is not checked against a real machine (no result in the kit).
- The picture-only tests (ULA 48/128/128E, IR Contention, Snow R, Snow128N, Snow Contention) still
  need a comparison with the real-machine videos on the ZXE wiki.

## 5. Phases

- **Phase 1 - Publishing and drift check.** In `test/spectrum-kit/kit.ts`: a picture set that
  takes pictures during a test and, after its assertions, publishes or compares them (§4.3), the 2×
  scaling and a PNG decoder for the pictures Klive's own encoder writes. The §4.2 runs: add the
  contended-test page capture to `timing-tests-48k.test.ts` and the Snow48 pair to
  `visual.test.ts` (as its own small test, so the other snow programs stay unpublished). The photos
  (§4.4). Done when the pictures are generated, reviewed and committed, the slow tier passes, and
  it fails when one pixel of a published PNG is changed.
- **Phase 2 - The page.** `spectrum-accuracy.mdx` per §3, `_meta.ts`, the links from
  `spectrum-display.mdx` and `machine-types.mdx`, the routes golden re-baselined. Check the images'
  scaling in `npm run doc:serve`. Done when `npm run doc:build && npm run doc:check` pass (links,
  routes, weight).
- **Phase 3 - Landing page and roadmap.** The landing item (Q1): an entry in `FEATURES`
  (`docs/landing/features.ts`) with id `accuracy`, `since` the release that ships the ULA work
  (the next one after 0.64.0: set it when the release is prepared, so it shows no earlier - R6), the
  HALT2INT early pair as its image (a combined 2-up `.webp`), and `more` pointing at the new page.
  Its texts go in `docs/i18n/landing/en.json` with translator context, as the others (`tag`,
  `title`, `short`, `text`, `point1`-`point3`): for example "Tested against real hardware" / "Timing
  checked against the community's test programs" / points naming Timing Tests 48K and 128K,
  HALT2INT, and the bugs they found. The landing page shows the first `SHOWN_FEATURES` (5) features
  whose `since` has shipped: decide its position in the list (recommended: after `timeTravel`), so
  one older feature drops off the page. **Translations**: the landing texts are translated
  (`docs/i18n/TRANSLATING.md`); the new keys go out through `npm run doc:i18n:todo` /
  `doc:i18n:merge` in the next translation round, never by hand. Check before Phase 3 whether
  `doc:i18n:check` fails on English-only keys (today every language has 110/110); if it does, the
  translation round is part of this phase. Then G10.1 in `CLOSING_THE_GAPS_PLAN.md` (✅ for the
  ZX Spectrum part, with the page) and W10 / the comparison table in
  `LANDING_PAGE_COMPETITIVE_ANALYSIS.md` (AGENTS.md's standing instruction). No Settings screenshot
  (Q4).
- **Changeset**: one `internal` changeset for the plan (docs, tests and the landing page; nothing
  in the app changes). Ask before committing if the author wants a release-notes line instead.

## 6. Translation

Only `get-started/` is translated (AGENTS.md, "Documentation Site"); the page is under
`under-the-hood/`, which links to English from every language, so the page, its captions and alt
text are English only. The landing item's texts are the exception: they are translated through the
website's workflow (Phase 3).

## 7. The author's answers (2026-10-23)

All recommendations accepted:

1. **Landing page**: yes - a short "Tested against real hardware" item linking to the new page
   (Phase 3).
2. **The real-machine photos**: shown beside Klive's runs, credited to Mark Woodmass, with a link to
   the ZXE wiki page (§4.4).
3. **Screenshots of the test programs' screens**: acceptable, each credited to its author.
4. **The Settings screenshot**: none; emulator pictures only.
5. **Scope**: the 48K and the 128K; the +2A/+3 is named under "Not yet proven".

## As built (2026-10-23)

- **Phase 1.** `test/spectrum-kit/pictures.ts`: `PublishedPictures` (`take` during a test, `settle`
  after its assertions), 2x nearest-neighbour scaling, a paletted PNG encoder (the 12 pictures are
  1.6-6.7 KB each) and a decoder for 8-bit RGB/RGBA/paletted PNGs with every row filter, so an
  optimiser run over the files cannot fail the check. `pictures.test.ts` (fast `e2e-cores` tier, no
  core) covers the round trip and that one changed pixel counts. `pageThrough` got an `onPage`
  callback; Timing Tests 48K publishes the page with test 23 contended (`LD A,(IX+n)` ...), Snow48
  (the first build) moved out of `visual.test.ts`'s list into a test of its own. Checked: the slow
  kit passes, and with one pixel of `float48k.png` changed it fails ("differs in 1 pixels").
  `scripts/build-doc-accuracy-photos.cjs` writes `real-48k-early.webp` (20 KB) and
  `real-48k-late.webp` (44 KB, cropped to the screen) and the landing pair (41 KB).
- **Phase 2.** The page as §3 outlines it; the timing suites' row says 37 tests (35 instruction
  groups and two I/O tests, as the program numbers them). Images are shown at 352 px (half the 2x
  file, so still pixel-exact), in pairs side by side. The routes and assets goldens were
  re-baselined; that also recorded `crt-display` and `spectrum-display`, which had been missing.
- **Phase 3.** `accuracy` after `timeTravel`, `since: "0.65.0"` (to confirm when the release is
  prepared); checked with `KLIVE_SITE_RELEASE_TAG=v0.65.0 npm run doc:build`,
  where it shows and `nex` drops off. `doc:i18n:check` does not fail on English-only keys (landing
  now 110/117 per language), so the seven new keys go out in the next translation round. G10.1, W10
  and the comparison table updated.
- **Changeset**: a `feature` with a release-notes line, at the author's choice (instead of §5's
  `internal`).

