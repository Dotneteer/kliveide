# Site polish with Hallmark: removing what still reads as machine-made

Goal: make the landing page and the documentation read as written and designed by a person, using
[Hallmark](https://github.com/Nutlope/hallmark) (MIT, v2) as an **auditor and a source of rules**,
not as a generator. The look settled in `DOCS_SITE_REDESIGN_PLAN.md` (Overpass, the data-sheet
landing page, the Spectrum rule, the viewer) stays; this plan finishes the job it started.

Hallmark is three things: tiered rules (`references/gates.md`: **Floor** never ships, **Reflex** is
waivable on the record, **Finish** never blocks), a render linter (`scripts/sloplint.mjs`, eight
widths in Chrome), and two verbs (`/hallmark audit <path>` reports, `/hallmark redesign <path>`
rebuilds). Rule numbers below (for example *63*) are Hallmark's.

**Status (branch `dotneteer/hallmark-2`): steps 0 to 7 done; the plan is complete. Its closing
commit carries the plan's changeset.** Commits: `a5398a68db` (steps 0-1), `ee9fef85e4`
(step 2), `0a9650a018` (step 3, with the emulator window's reverse-debugging fix and its own `fix`
changeset), `6c87e90d5b` and `ba60dc2cf8` (step 4), `8e030b4e3d` (step 5), `354b1b020f` (links to
old addresses, found on the way), and step 6's.

## Decisions

| | Decision |
|---|---|
| H1 | **Audit first, never a fresh build.** Hallmark is never asked to deal a theme or build a page for this site. Only `audit`, `sloplint` and, for the landing page, `redesign` in *polish* mode (the tells only, layout kept). |
| H2 | **Pinned and local.** Hallmark is installed at one pinned commit, for this project only, and is **not committed**: `.hallmark/` and any installed skill copy are git-ignored. The commit hash is recorded in this plan when step 0 runs. |
| H3 | **A `docs/design.md` locks the system.** Hallmark treats a root `design.md` as a locked design system that overrides its themes; ours names the tokens in `docs/app/tokens.css`, Overpass / Overpass Mono, the Spectrum rule and the R1–R5 rules of the redesign plan. |
| H4 | **The rules we adopt live in our own files**, in our own words: `.ai/ui-theming-intent-and-lessons.md` (the website section) and our own check script. Nothing depends on Hallmark being installed later, and no Hallmark code is copied into the repo. |
| H5 | **No Hallmark stamp in shipped CSS** (its rule 20). The stamp and the run log stay in the ignored `.hallmark/`. |
| H6 | **The Library is out of scope.** The imported manuals (`content/en/library/`) keep their original wording, "powerful" and all. The book is out of scope for wording too (it is unlinked, decision D6). |
| H7 | **Translations follow the usual workflow.** Every changed landing text is a changed key in `docs/i18n/landing/en.json` with its translator context; other languages through `npm run doc:i18n:todo` / `doc:i18n:merge`, never by hand. |
| H8 | **Decided by the author before step 2**, where Hallmark's rules clashed with the site's own choices: (a) the feature labels (an eyebrow, rule 54) **go**; the Spectrum square moves onto the feature heading. (b) Rule 58's "about 80 words per screen" is **waived** for the data sheet and its At a glance hero, but the feature texts are trimmed. (c) Em and en dashes (rule 19) are **out of the landing texts**; the docs prose check reports them (not the book or the Library). (d) The header stays **sticky but solid**, no blur or transparency (rule 42). The waivers and their reasons are in `docs/design.md`. |
| H9 | **Decided: the signature is reverse debugging** (step 3), the one thing a visitor should remember, shown on the first screen as a short loop recorded by Klive itself. The accuracy story stays a feature row: Fuse is the accepted accuracy reference, and the page claims no "most accurate". |

## Steps

### 0. Install and baseline (no site changes)

1. Install Hallmark at a pinned commit into the project only (`npx skills add nutlope/hallmark`
   without `-g`, or a clone run with `node <clone>/skills/hallmark/scripts/sloplint.mjs`); add
   `puppeteer-core` outside the repo's dependencies. Git-ignore `.hallmark/` and the skill copy (H2).
2. Write `docs/design.md` (H3).
3. `npm run doc:build && npm run doc:serve`, then run `sloplint --render --url` against: the landing
   page (English and German, the longest texts), one guide, one reference page, one under-the-hood
   article, and the Library index. Run `/hallmark audit` on the landing page.
4. Save the reports under `.hallmark/` and summarise them here, as a findings table (rule, tier, page,
   what, proposed action). **This table replaces the findings guessed in step 2 below** wherever
   they differ.

#### As built (step 0)

- Hallmark is cloned at **`4f6a46c6dc325d40ab268c93e25c7b96676ebccd`** (2026-10-29, v2.0.0) into
  `.hallmark/hallmark/`, with `puppeteer-core` 24.43.1 in `.hallmark/deps/` (pointed at by
  `HALLMARK_PUPPETEER`) and the system Chrome. Nothing is installed as a skill yet. `.gitignore`
  covers `.hallmark/` and `.claude/skills/hallmark/`.
- `docs/design.md` is written; its Waivers section lists the four H8 items as pending.
- The run, from `.hallmark/run/`, against `npm run doc:build` + `node scripts/serve-docs.cjs --port 4000`:
  `node .hallmark/hallmark/skills/hallmark/scripts/sloplint.mjs --url <page> --genre modern-minimal`.
  Pages: `/` (English landing), `/de/`, `/en/guides/debugging/advanced-debugging/`,
  `/en/reference/commands/`, `/en/under-the-hood/emulator-internals/crt-display/`, `/en/library/`.
  Reports are in `.hallmark/run/*.txt`, screenshots in `.hallmark/run/.hallmark/shots/`.
- `/hallmark audit` (the judged review) is **not run yet**: the skill is not installed in a Claude
  Code session. The findings below are sloplint's mechanical ones only.

**Totals.** Landing: 4 FAIL, 4 REFLEX, 1 WARN in English, the same in German. Docs pages: 6 to 13
FAIL and 309 to 495 REFLEX each, but over 95% of the REFLEX are one rule (49b, sidebar links that
wrap at 320 px) counted once per link.

**Sloplint is a landing-page linter.** On the docs pages its page-composition rules (58 words per
screen, 44c/79 hero height, 59/77 section count and mass, 39b marketing button height, F25 the
sidebar hidden on a phone) treat a documentation page as a marketing page. They are noise there and
are dismissed as a class, not one by one. On the landing page they are real questions.

| Rule | Tier | Page | Finding | Action |
|---|---|---|---|---|
| 34 | Floor | landing, en + de | **Scrolls sideways at 320 px**: the header's `.lp-tools` (language menu, theme toggle, GitHub icon) ends at 343 px in German, 330 px in English | Fix in step 1: the tools row must fit 320 px in every language (hide the GitHub icon or shorten the language button below a width; measure every language, as the header rule in `.ai/ui-theming-intent-and-lessons.md` says) |
| 34 | Floor | landing | The skip link sits 999 px off screen at rest (`a.lp-skip`) | Dismiss after checking: an off-screen skip link is the standard pattern and the page clips it; or move it to the visually-hidden clip pattern so the check passes |
| 40 | Floor | all docs | The search field's edge is 1.12:1 against the navbar | Fix in step 5: a `--site-line-strong` border on Nextra's search input |
| 40 | Floor | reference, under the hood | A table-of-contents link at 4.33:1 (below 4.5:1) | Fix in step 5: the TOC link colour from the tokens |
| 62 | Floor | guide, library | 42% / 93% of the page's text "hidden after load" | Check in step 5; most likely the collapsed sidebar folders and the phone menu, which are navigation, not hidden content |
| 49a | Floor | all docs | Sidebar folder buttons ("Analysis and Reverse Engineering", "ZX Spectrum Next: how the screen works") wrap at 320 px; long TOC entries wrap at 1280 px | Dismiss for the TOC (headings are sentences). Sidebar: decide in step 5, a shorter `_meta.ts` title or accept two lines |
| 49b | Reflex | all docs | Sidebar links wrap at 320 px (300 to 490 per page) | Dismiss: the phone menu's links are page titles; two lines is right |
| 25 | Reflex | all docs | Running prose about 89 to 111 characters a line at 1440 px | **Real, step 5**: cap the article measure at about 75ch |
| F26 | Finish | under the hood, landing | Headings ending on a one-word stub | Step 5: `text-wrap: balance` on headings |
| F19 | Finish | all docs | Four font weights in use (400, 500, 600, 700) | Look in step 5: 500 is likely Nextra's own; drop it if so |
| 58 | Floor | landing | The hero carries three text blocks before its actions (headline, lede, At a glance) | H8 (b) |
| 58 | Floor | landing | 128 words on one screen, at the feature rows | H8 (b) |
| 44c | Reflex | landing | The hero ends at 556 px of a 900 px screen | Step 3, with the signature |
| 59 | Reflex | landing | Section gaps 66 to 114 px, uneven | Step 2: one section gap, from a token |
| 77 | Reflex | landing | Thin sections: the write/build/run/debug table and the closing call to action | Step 2, item 5 (the ending); the loop table with H8 (b) |
| 78 | Reflex | landing | Section headings 24 px under a 52 px headline | Waive in `docs/design.md` (a data sheet's headings are small on purpose), or raise them in step 2: decide with H8 |

Not found by sloplint, still to do by reading: every item of step 2 (middle dots, the rebuttal
lines, the stock phrases, the headline, the ending). The copy and punctuation rules (19, 63) are
static checks on source files, and these runs passed URLs only ("0 file(s)"); pointed at
`docs/landing/` they would still miss the text, which lives in `docs/i18n/landing/en.json`.

### 1. Floor fixes (whatever step 0 finds)

Contrast, focus rings, reduced motion, horizontal scroll from 320 to 1920 px, controls that wrap,
broken images. These are bugs, not taste: fix them in the site's tokens and stylesheets
(`docs/app/tokens.css`, `docs/app/[lang]/(docs)/custom.css`, `docs/landing/landing.css`) without a
colour literal. Already known: the viewer's `100vh` (`landing.css`) should be `100dvh`.

#### As built (step 1)

The landing page's Floor findings are fixed; the docs pages' Floor findings (40, 49a, 62) stay
with step 5, as the step 0 table assigns them.

- **Rule 34, the page scrolled sideways at 320 px. Two causes, not one.** The header's tools row was
  10 px too wide in English and up to 65 px in Portuguese (it overflowed up to 385 px there). Below
  420 px the language button now keeps only its globe (`.lp-lang-name`; the accessible name stays
  "Language"). The second cause showed only once the first was fixed: German's headline word
  "Entwicklungsstudio" is wider than a 320 px line by itself. Landing headings now have
  `overflow-wrap: break-word` and `min-width: 0` (Hallmark rule 50) and, under 640 px only,
  `hyphens: auto` in the page's language.
- **Rule 34, the skip link** waits above the page (`transform`) instead of 999 px to its left.
- **The viewer** is sized with `100%` and `dvh` instead of `100vw` and `vh`.
- **Measured** in the built site for all six languages at every width from 300 to 1000 px in 10 px
  steps (a Puppeteer script): every language fits from 320 px up. At 300 and 310 px every language
  is still 6 to 16 px too wide (the brand and the three tools); that is below Hallmark's 320 px floor
  and below any phone in use, so it is left.
- `sloplint` on `/` and `/de/` after the fix: both rule 34 findings gone; what is left is 58, 44c,
  59, 77 and 78, all waiting on H8 and steps 2 and 3. `npm run doc:check` passes.
- **New finding, for step 2:** below 900 px the header's links are hidden and nothing replaces them
  (the `nav.menu` text exists, but no menu button uses it). A phone visitor reaches the docs only
  through the hero's Get started button and the footer.
- Recorded in `.ai/ui-theming-intent-and-lessons.md` (the website section): the tools row must fit
  320 px, nothing hidden may widen the page, and landing headings may break inside a word.

### 2. Landing page polish (`docs/landing/`, `docs/i18n/landing/en.json`)

Known before the audit, from reading the code:

1. **Middle-dot lists (63).** `macOS · Windows · Linux`, `sjasmplus · Boriel BASIC · z88dk · PASTA/80`
   in the At a glance table, and the machine rows (`48K · 128K · +2A/+3 · +2E/+3E`,
   `Pentagon · Scorpion · Timex`, `ZX80 · ZX81`, `64K · 64K+`) in `LandingPage.tsx`. Set them as
   line breaks or lists inside the cells.
2. **The rebuttal cadence (19).** "One app. Zero glue." and "Open a .nex. Understand it." become
   plain statements of what Klive does.
3. **Stock lines (19).** "What makes Klive different", "Ready to write your first program?", a
   "Read more" on every feature, and the "Get started" secondary button. Each becomes a specific
   verb or noun: what the link opens ("Start the tutorial", "How reverse debugging works").
4. **The headline (19, 44b).** "The complete ZX Spectrum and Next development studio": eight
   words, and "complete" is a claim. At most seven words that say what Klive does. Keep the `{next}`
   placeholder only if the new headline still needs it.
5. **The ending (8, 85).** The closing CTA bar before the footer is the template ending. End on the
   page's own job instead: the download, with the platforms, or the tutorial as the last section's
   own content.
6. The H8 items, as the author decided them.

Every changed text keeps or replaces its key with context (H7); removed keys are deleted. Then
`/hallmark redesign docs/landing` with the word *polish* in the prompt (its mode for the tells
only) is optional, as a second opinion only; its output is read, not merged, and `sloplint --kept`
must pass on anything taken from it.

#### As built (step 2)

- **Texts** (`docs/i18n/landing/en.json`, each with its translator context updated):
  - headline "Develop for the ZX Spectrum and {next}" (6 words; was "The complete ZX Spectrum and
    {next} development studio");
  - "Get started" button: "Start the tutorial"; "What makes Klive different": "What Klive does";
  - "One app. Zero glue.": "Editor, emulator and debugger together"; "Open a .nex. Understand it.":
    "Take apart any .nex file";
  - the five shown feature texts cut from 31 to 41 words to 25 to 31, keeping every fact (what was
    cut is in the bullet points or the linked page);
  - `machines.spectrum` and `machines.clones` use commas instead of middle dots, and so do the
    hard-coded rows in `LandingPage.tsx` (Runs on, Works with, ZX80/ZX81, TVC).
  - The English landing texts had no em or en dashes; `docs/i18n/TRANSLATING.md` now tells
    translators not to use them (German and Hungarian have four each, fixed when re-translated).
- **Removed keys**: `feature.more` and the eight `feature.*.tag`, from `en.json`, every translation
  and every `docs/i18n/sources/*.json` (deleting obsolete keys, not translating).
- **Feature rows**: no label; the heading carries the Spectrum square and is the link to the
  feature's docs page, so "Read more" is gone.
- **The ending**: "Ready to write your first program?" became "Install Klive": the Download button
  again (it picks the visitor's OS) with Start the tutorial, so the page ends on its job (rule 85).
- **Header**: solid `--site-bg`, no `backdrop-filter`. **Phone menu** (the step 1 finding): below
  900 px a `<details>` menu (`.lp-menu`, the existing `nav.menu` text) holds the five links and
  GitHub and takes the GitHub icon's place, so the row is no wider; it works without script.
- **One section gap**, `--lp-section-gap` (3rem), for the hero's foot, the carousel, the sections
  and the ending.
- **Waivers beyond H8**, recorded in `docs/design.md` for the author to confirm: rule 59 (120 px
  between sections; the sheet divides with 2px rules) and rule 78 (52 px section headings; the
  sheet's are table labels at 1.5rem).
- **Checked**: every language fits every width from 320 px; the phone menu opens and lists its six
  links in German at 375 px with no sideways scroll; the scrolled header is sticky, solid and
  unblurred. `sloplint` on `/` and `/de/`: the F26 stub is gone; left are 58 and 59/78 (waived),
  44c and 77 (step 3), and 49b for feature headings that wrap on a phone, dismissed (headings are
  sentences). `npm run doc:check` passes; each translation now has 15 outdated landing texts
  (14 from this step), for `npm run doc:i18n:todo`.

### 3. The signature (H9)

Once the author picks it:

- **Show the real thing (47c, 84).** Capture it with Klive itself: a short recording through the
  IDE's own video recording, or new stills through `scripts/doc-shots/` (a `landing-*` recipe), never
  a mock. Video autoplays muted with a poster and a pause control (18, 28a), and the
  reduced-motion fallback is the poster.
- **Real numbers only (46a).** Any figure on the page (timing tests passed, machines emulated) is
  traceable to a test or the changelog, and comes from `site-info` or `features.ts` rather than being
  typed into the copy, so it cannot drift.
- It moves to the first screen beside the headline; the carousel keeps the remaining pictures.
- The feature it represents keeps its `since` gate in `features.ts`.

#### As built (step 3)

- **The author chose reverse debugging** (H9), and confirmed the rule 59 waiver and the rule 78
  waiver with section headings raised to 2rem.
- **The video**: `docs/public/images/landing/reverse-debugging.mp4` (1440 x 820, 9.4 s, silent,
  about 170 KB) and its WebP poster (about 52 KB), made by `scripts/doc-shots/recipes/landing-reverse.cjs`
  with Klive's own IDE + Emulator recording. A 48K program paints the attributes one row at a time
  and stops at its end; Reverse Continue with a breakpoint at the top of the row loop walks back a
  row at a time (the editor's line, the CPU panel's "History · step", the status bar's "−659 ms"
  and the emulator's picture and PC all in the past), and Return to Present puts it all back, which
  is where the loop starts again. It is the carousel's first item, starting at y 556 of the first
  screen at 1280 x 800; no new figure is claimed, so no number needed sourcing.
- **The carousel** (`HeroCarousel.tsx`) plays a video slide muted, once, then moves on (not after
  five seconds); the pause button pauses it; under reduced motion and without script it stays on its
  poster. Checked in Chrome: plays past five seconds, advances at its end, rewinds when left, holds
  its poster with reduced motion. New caption key `slide.reverse`, translated through
  `doc:i18n:todo`/`merge` with the other step's texts.
- **A Klive bug found and fixed on the way**: the emulator window kept showing the present while
  the machine was in the past. A move into the past replays frames with their side effects
  suppressed and leaves the machine paused, so neither the frame event nor the state change that
  redraw the picture fired; the picture, the pause label's PC and the status bar's PC all stayed at
  the present, against what the reverse-debugging guide says. `EmulatorPanel.tsx` now redraws and
  relabels on every history move (`reverseDebug.behindSeconds`, `historyPosition`), and
  `EmuStatusBar.tsx` re-renders on them. Two tests (`test/controls/EmulatorPanelRefactor.test.tsx`,
  `test/controls/EmuStatusBar.test.tsx`) fail without the fix. This is user-visible: its commit
  carries its own `fix` changeset.
- **Layout**: section headings 2rem; the last feature row has no bottom padding of its own, which
  removed the 138 px gap before the ending (gaps now 66 to 110 px).
- **sloplint** on `/` and `/de/`: 44c answered and 77 waived in `docs/design.md`; 58, 59 and 78 are
  the confirmed waivers; nothing else is left on the landing page. `npm run doc:check` passes (the
  asset golden records the two new files).

### 4. Documentation wording check (our own script, H4)

1. `scripts/check-docs-prose.cjs` → `npm run doc:check:prose`. It reports, per file and line, in
   `docs/content/en/{get-started,guides,reference,under-the-hood}/` (not `library/`, not the book, H6):
   - buzzwords (seamless, robust, powerful, unlock, leverage, effortless, …),
   - filler (simply, just, easily, "Let's", "Note that", "Whether you", "dive into"),
   - template punctuation: middle-dot meta strings, arrows glued to link text.
   The list is ours, written for documentation, informed by Hallmark's rule 19.
2. **Report only at first.** Fix the pages in batches by navbar area, a reviewed batch per commit.
   Many "just"s are legitimate ("just after the interrupt"); the script reports, a person decides.
3. When the count reaches zero (or every remaining hit is allowed inline with a comment the script
   recognises), add it to `doc:check` so new pages stay clean.
4. Em dashes: decided by H8 (c). If they go, it is a separate batch, since there are many.

#### As built (step 4, first batch)

- **The check**: `scripts/check-docs-prose.cjs`, `npm run doc:check:prose` (`--summary`, `--area`,
  `--rule`, and `--strict` for when it joins `doc:check`). Six rules: `buzzword`, `filler`, `just`,
  `dash`, `dots`, `arrow-link`. It reads prose only: fenced code, inline code (even when it wraps),
  link targets, URLs, JSX attributes other than `alt`/`caption`/`title`, imports and front matter
  other than the description are blanked first, keeping line and column numbers. A line that should
  stay carries `{/* prose-ok: <why> */}` on itself or the line above. The generated
  `reference/whats-new.mdx` is skipped.
- **False positives found on real pages and exempted**, each pinned by `test/docs/docs-prose.test.ts`
  (10 tests): an en dash with no space beside it is a range (`1–3`, `` `$0000`–`$3FFF` ``); a dash
  alone in a table cell means "none"; "Just My Code" is a setting; "not just", "has just drawn",
  "just after", "just left of" are exact; "note that" and "whether you" count only at the start of
  a sentence ("a note that", "depends on whether you"); a fence's indentation no longer swallows the
  blank line before it (which let a code comment's dash through).
- **Baseline**: 429 findings on 79 pages (get-started 6, guides 206, reference 90, under-the-hood
  127; dash 285, filler 105, just 30, buzzword 8, dots 1).
- **Batch 1, Reference: 90 to 0**, on 14 pages. Dashes became commas, colons or brackets; the
  Copper and DMA pages' 18 headings (`## WR6 — Control Commands`) became `## WR6: Control Commands`
  (no link pointed at them; the one link into the DMA page, `#runtime-patching-pattern`, is to a
  heading without a dash). "Powerful" macros became "macros with arguments"; "Let's assume" became
  "Say"; "easily" went. `doc:check` passes (no broken links or anchors).
- **Next batches**: Under the Hood (127), then Guides (206), then Get Started (6) last, because any
  change there sends its five translations back through `doc:i18n:todo`/`merge` as whole pages.

#### As built (step 4, second batch: Under the Hood, dashes)

- **The author's voice for these articles wins over the check.** `.ai/hardware-articles-guide.md`
  asks for a playful voice for engineers, speaking to "you", with "let's" for a worked example and a
  few conversational openers. "Let's" is now its own rule, `lets`, which does not apply in
  Under the Hood (`notIn`); it is still reported in Guides and Get Started (a test pins both).
  Findings are now listed in reading order.
- **Dashes: 17 to 0.** The two contributor pages (`get-source`, `wasm-toolchain`) take colons and
  commas; in the ZX81 display article, "Part 4: The trick — the CPU executes the screen" became
  "Part 4: The trick: the CPU executes the screen", and its one link (on the same page) points at the
  new anchor, checked in the built HTML. The DACs figure's dash means "none" in a table drawn in
  SVG, so it stays, marked `prose-ok`.
- **"simply", "just", "easily": the author chose "trim the tic, keep the voice".** 84 findings,
  almost all "simply" (about 50), "just" and "easily", most carrying meaning in the voice above ("The
  Next simply shrugs", "Did your ship just fly into a rock?", "the buffer just shown", "parts measure
  easily"). The 27 "simply"s that only padded a statement went ("is simply the bitmap address" became
  "is the bitmap address"); the rest stay. "simply" and "easily" are now the `softener` rule, and
  it and `just` do not apply in Under the Hood (`notIn`), as `lets` does not; `filler` ("note
  that", "in order to") still does. The Next overview's figure legend of CPU speeds ("· 7 · 14 · 28")
  is marked `prose-ok`.
- **Under the Hood: 127 to 0.** `doc:check` passes. Left: Guides 206, Get Started 6.

#### As built (step 4, done: Guides, Get Started, and the check in `doc:check`)

- **Guides: 206 to 0**, on 36 pages (195 dashes, the rest "simply", "just", one "let's" and one
  "seamlessly"), split by folder among three agents and checked together. No heading changed, so
  no anchor moved. Bullets like "**Apply** — saves" became "**Apply**: saves"; asides became brackets
  or commas. Four lines keep a dash on purpose, each marked `prose-ok` at the end of the line, since a
  comment line would break a table: three quote the app's own UI text ("Ready – waiting for machine
  to run", "*No machine — default ramp*", "Locals — {frame}"), and one is a snapshot table's "not
  stored" mark. A JSX comment inside a table cell renders nothing (checked in the built HTML: the
  markers appear only in the embedded page source, never in the visible page).
- **Get Started: 6 to 0** on two pages (`install`, `load-from-tape`). Their five translations were
  not re-translated whole: each language's page had only the matching sentences changed (the dash
  pairs to brackets, the dash to a colon, "a powerful technique" dropped; Hungarian also lost a second
  dash pair in the same sentence), then went through `doc:i18n:merge`, which checked the structure and
  recorded the new English source. Every language is complete again, nothing out of date.
- **`doc:check` now runs `doc:check:prose -- --strict --summary`**, which fails on any finding (checked
  both ways: exit 1 with a dash added to a page, 0 clean). From here a new page meets the rules or
  says why not with `prose-ok`.
- **Totals: 429 findings on 79 pages to 0.** Kept on purpose: 7 `prose-ok` markers, about 25
  "simply"s and Under the Hood's "let's", "just" and "easily" (the author's voice).

### 5. Documentation chrome

Run the step-0 sloplint findings for the doc pages through the site's own CSS: the Nextra sidebar,
tables, `<Shot>`, code blocks, callouts. Typical targets: small letter-spaced headings, focus rings
on the sidebar and the copy button, horizontal scroll from wide tables and code at 320 px.

#### As built (step 5)

Each step 0 finding for the doc pages was measured in the built site (Puppeteer, both colour
schemes) before anything changed; three were real, the rest were Nextra's chrome or a marketing-page
rule misread on a doc page.

- **Fixed: the search field's edge (rule 40).** Nextra draws the field with a 5% tint only: 1.12:1
  against the navbar in light, 1.31:1 in dark, where a field needs 3:1. `.nextra-search input` now has
  an inset 1px edge of half the text colour over the page (`color-mix` of `--site-fg` and `--site-bg`):
  3.28:1 light, 4.49:1 dark. An inset shadow keeps the field's size; Nextra's focus ring replaces it.
- **Fixed: the line length (rule 25).** Prose ran to about 115 characters at 1440 px. Running text
  (`p`, lists, `dl`, blockquotes, not inside tables, figures or cards) stops at 62ch: at most 86
  characters on the CRT article (70ch was tried first and still gave 99: Overpass sets about 1.4
  characters per `ch`). Figures, screenshots, code and tables keep the full column, as the theming
  notes ask for figures. Checked by eye on an article, a Get Started page with a screenshot and its
  steps, and a reference page with tables. The command reference stays at about 88, the threshold,
  where code spans widen its lines.
- **Fixed: headings that end on one word (F26)**: `text-wrap: balance` on article headings.
- **Dismissed, measured: the accent links (rule 40, "4.33:1").** The link colour is 5.27:1 by the WCAG
  formula in light and 7.87:1 in dark; the linter samples the anti-aliased pixels of thin glyphs. The
  accent is the app's own token and is not changed.
- **Dismissed, measured: "hidden text" (rule 62).** Every hidden word (2,523 on the guide and the
  Library page alike) is in the sidebar's collapsed folders; no article text is hidden.
- **Left: Nextra's chrome.** The sidebar's folder titles wrap on a phone (49a/49b: they are page
  titles; two lines is right), the 500 weight (F19) is Nextra's active navbar tab and its ⌘K hint, and
  the search field's `transition-all` is Nextra's own.
- **Found on the way and fixed: a broken operator table.** In the Z80 expressions reference, the
  `` `|` `` of Bitwise OR ended its table cell, so the row showed a stray backtick in two columns; it is
  `` `\|` `` now and renders as code.
- After: sloplint on the four doc pages from step 0 shows no search-field, measure (except the
  command reference's 88) or heading finding; `npm run doc:check` passes. Recorded in
  `.ai/ui-theming-intent-and-lessons.md`.

### 6. Records

- `.ai/ui-theming-intent-and-lessons.md`, website section: the rules adopted here and every waiver
  from H8, as durable rules (standing instruction).
- `AGENTS.md`, Documentation Site: one line pointing at `docs/design.md` and `doc:check:prose`.
- This plan: the as-built note and the pinned Hallmark commit.

#### As built (step 6)

Most records were written with the step that made them; this step checked them against what
shipped and filled the gaps.

- `.ai/ui-theming-intent-and-lessons.md`, website section: already current. It holds the rejected
  tells (the earlier kit and Hallmark's), the data sheet with one section gap and 2rem headings, the
  feature heading as link, the ending on the download, the solid header and its phone menu, the
  320px tools row, nothing hidden widening the page, headings that may hyphenate on a phone, the
  reverse-debugging video slide, the 62ch docs measure and the search field's edge.
- `docs/design.md`: gained the header's phone menu and a "Docs pages" section (the measure, the
  search edge, the wording check, links never to an old address). Its waivers (58, 59, 78, 77) and
  answers (44c) are the author's decisions or recorded as mine for review.
- `AGENTS.md`, Documentation Site: the wording check and `docs/design.md` (step 4), and that a moved
  page's links move with it, enforced by `doc:check:links` (found on the way).
- `.ai/doc-screenshots-guide.md`: the `landing-reverse` recipe and what it taught.
- `DOCS_SITE_REDESIGN_PLAN.md`: R3 and R4 say which of their parts this plan superseded.
- This plan: the pinned Hallmark commit (`4f6a46c`, step 0), an as-built note per step, and the
  status above.

### 7. Verify

- `npm run doc:build && npm run doc:check` (routes, links, images, highlighting, weight, i18n).
- `sloplint --render` on the same pages as step 0: no Floor finding, every Reflex finding fixed or
  waived in `docs/design.md`. Compare against the step-0 reports.
- Look at the landing page in light and dark, desktop and phone, English and German.

Changeset: the site is not the app, so this is probably `internal`; confirm with the author before
the commit. Intermediate commits (steps 0–5) carry none, per the plan rule.

#### As built (step 7)

- **Docs:** `npm run doc:build && npm run doc:check` pass: 880 routes and 1,264 assets match the
  goldens, no broken links and none to an old address, highlighting rendered, the heaviest page
  1.31 MB of 1.5, the wording check at 0, every translation complete.
- **sloplint** on the six step-0 pages: every page has fewer findings than at step 0 (landing 4 to 2
  failures in each language; the doc pages one fewer each, the search field's). Hallmark calls the
  remaining failures Floor, but each is decided, not open:
  - landing, rule 58 (words per screen, three text blocks in the hero): the author's data-sheet
    waiver (H8 b); its Reflex findings 44c, 59, 77 and 78 are answered or waived in `docs/design.md`;
  - doc pages, rules 49a (sidebar and table-of-contents entries on two lines), 58 (a landing-page
    composition rule), 40 (the accent link, 5.27:1 by the WCAG formula, sampled lower) and 62 (the
    sidebar's collapsed folders): measured and dismissed in steps 0 and 5; their Reflex findings
    (49b sidebar links, 77, 44c, 39b, 79, 59) are the same composition rules.
- **By eye:** the landing page full length in light and dark, at 1440 and 375 px, in English and
  German (eight captures): no sideways scroll in any, the hero, the video slide, the comma lists, the
  feature headings with their squares and the "Install Klive" ending as built.
- **App code** (step 3's emulator fix): `npm run build:check` (no new type errors) and
  `npm run lint:renderer` pass. `npm test`: 26,595 passed, 1 failed: `runner-machines.test.ts` timed
  out at 30 s while the docs build and sloplint shared the machine, and passed alone (8 of 8 in
  12.6 s). `npm run test:slow`: 29 files, 2,152 passed, 3 skipped, recorded on the current sources.
