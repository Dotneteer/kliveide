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
| H8 | **Open, for the author to decide before step 2.** Where Hallmark's rules clash with the site's own choices: (a) the feature labels with their colour square, an eyebrow by rule 54, kept by the redesign's R3; (b) rule 58's "about 80 words per screen" against the data-sheet tables; (c) rule 19's ban on em and en dashes; (d) the sticky blurred header, the "AI nav" of rule 42. Each is either changed or recorded as a waiver with its reason in `docs/design.md`. |
| H9 | **Open: the signature (step 3).** The one thing a visitor should remember, shown on the first screen. Candidates: the accuracy story (Klive's screen beside photos of the real machine, timing tests passed) or reverse debugging (stepping back through a bug). |

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

### 1. Floor fixes (whatever step 0 finds)

Contrast, focus rings, reduced motion, horizontal scroll from 320 to 1920 px, controls that wrap,
broken images. These are bugs, not taste: fix them in the site's tokens and stylesheets
(`docs/app/tokens.css`, `docs/app/[lang]/(docs)/custom.css`, `docs/landing/landing.css`) without a
colour literal. Already known: the viewer's `100vh` (`landing.css`) should be `100dvh`.

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
