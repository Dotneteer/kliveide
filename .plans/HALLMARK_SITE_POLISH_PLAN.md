# Site polish with Hallmark: removing what still reads as machine-made

Goal: make the landing page and the documentation read as written and designed by a person, using
[Hallmark](https://github.com/Nutlope/hallmark) (MIT, v2) as an **auditor and a source of rules**,
not as a generator. The look settled in `DOCS_SITE_REDESIGN_PLAN.md` (Overpass, the data-sheet
landing page, the Spectrum rule, the viewer) stays; this plan finishes the job it started.

Hallmark is three things: tiered rules (`references/gates.md`: **Floor** never ships, **Reflex** is
waivable on the record, **Finish** never blocks), a render linter (`scripts/sloplint.mjs`, eight
widths in Chrome), and two verbs (`/hallmark audit <path>` reports, `/hallmark redesign <path>`
rebuilds). Rule numbers below (for example *63*) are Hallmark's.

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

### 5. Documentation chrome

Run the step-0 sloplint findings for the doc pages through the site's own CSS: the Nextra sidebar,
tables, `<Shot>`, code blocks, callouts. Typical targets: small letter-spaced headings, focus rings
on the sidebar and the copy button, horizontal scroll from wide tables and code at 320 px.

### 6. Records

- `.ai/ui-theming-intent-and-lessons.md`, website section: the rules adopted here and every waiver
  from H8, as durable rules (standing instruction).
- `AGENTS.md`, Documentation Site: one line pointing at `docs/design.md` and `doc:check:prose`.
- This plan: the as-built note and the pinned Hallmark commit.

### 7. Verify

- `npm run doc:build && npm run doc:check` (routes, links, images, highlighting, weight, i18n).
- `sloplint --render` on the same pages as step 0: no Floor finding, every Reflex finding fixed or
  waived in `docs/design.md`. Compare against the step-0 reports.
- Look at the landing page in light and dark, desktop and phone, English and German.

Changeset: the site is not the app, so this is probably `internal`; confirm with the author before
the commit. Intermediate commits (steps 0–5) carry none, per the plan rule.
