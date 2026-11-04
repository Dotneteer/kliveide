# The website and documentation: rules and decisions

The Klive website (`docs/`: landing page plus Nextra documentation) was rebuilt in October 2026 by
the "Website and Documentation Modernization" plan, all eight phases (structure, illustration
tooling, Get Started, landing page, i18n, translations, book and Under the Hood, gap writing). The
plan was closed on 2026-11-04 (git history: `.plans/DOCS_SITE_MODERNIZATION_PLAN.md`). The build
and the commands are in `AGENTS.md`, "Documentation Site"; the screenshot pipeline is
`dev/ai/doc-screenshots-guide.md`; the page standard and screenshot policy for the guides are in "The Guides" below;
the translation workflow is `docs/i18n/TRANSLATING.md`. This note keeps the rules that the code and
the checks cite by number.

## Rules (R1-R7)

- **R1 One language list.** The site's languages are the `enabled` rows of
  `src/common/i18n/languages.ts`. The docs package cannot import that file (it pulls in the generated
  catalogs), so a script exports `docs/i18n/languages.json` and `doc:check` fails when they disagree.
  A language is published once it has `content/<lang>/`.
- **R2 Same translation discipline as the app.** No hand-written translations in a feature change.
  Docs translations go through `doc:i18n:todo` / `doc:i18n:merge`, with the app's `glossary.json` and
  never-translate list (product, machine, hardware, register and instruction names, commands,
  shortcuts). The English source hash of every translated page is recorded, so an outdated
  translation is detected and the page shows an "out of date" notice.
- **R3 Text never lives inside pixels.** Screenshot annotations (numbered markers, captions, arrows)
  are HTML over the image (`<Shot>`, `docs/page-components/Shot.tsx`), so they translate with the
  page and survive re-captures.
- **R4 Screenshots match the page's language.** The harness seeds the UI language just as it seeds the
  theme (`--lang`), so a Spanish page shows the Spanish IDE. Dark theme only (decision D4).
- **R5 Tutorial code is tested.** Every program a Get Started page asks the reader to type lives as a
  fixture (`dev/scripts/doc-shots/fixtures/get-started/`), is built by a test
  (`test/docs/get-started-fixtures.test.ts`), and is the file the screenshot recipe opens. A tutorial
  whose code stops assembling fails CI, not a reader.
- **R6 Claim only what is released.** Landing-page features carry a `since` version
  (`docs/landing/features.ts`) and appear only when the latest release tag (read at build time by
  `dev/scripts/build-doc-site-info.cjs`) has them. Re-check the claims against the "Deliberately not
  claimed" list of `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` every release.
- **R7 Old URLs keep working.** A static export cannot send 301s, so every moved page leaves a
  generated redirect stub (`docs/redirects.json`, `dev/scripts/build-doc-redirects.cjs`, which refuses
  targets that are not pages and stubs that would replace a real page). The route golden lists the
  stubs, so a forgotten one fails `doc:check`.

## Decisions

| # | Decision |
| --- | --- |
| D1 | **URL scheme:** Nextra native i18n, every language prefixed, English under `/en/`, `/` the English landing page. Static export has no middleware, so it uses `unstable_shouldAddLocaleToLinks`; `/` never auto-redirects (a dismissable banner offers the visitor's `navigator.language` match). The site has its own language switcher, because Nextra's `LocaleSwitch` would 404 on a page that has no translation. |
| D2 | **Landing features** (each gated by R6): *One app. Zero glue.*, *Step through your BASIC*, *Go back in time*, *Speaks Next natively*, *Test it like modern code*. |
| D3 | **Tutorial programs:** border stripes or a moving character (assembly), a small game loop (BASIC), a sprite on the Next. |
| D4 | **Screenshots: dark theme only**, one seeded preset (fixed accent, window 1280×820 at 2x). |
| D5 | Get Started's BASIC page used Klive BASIC with Boriel as a closing note. Since 2026-11-04 it names Boriel BASIC only (`dev/ai/klive-basic-switch.md`). |
| D6 | **The book** (*Inside the ZX Spectrum Next*) is reachable at its URLs and linked nowhere; `dev/scripts/build-doc-search-scope.cjs` keeps it out of Pagefind. |
| D7 | "Try Klive in the browser" is not part of this work; it needs its own plan. |
| D8 | **Visual design:** the app's tokens and type everywhere, a hero stripe band and Spectrum-colour feature blocks on the landing page only, numbered figure markers on screenshots. The later redesign is in `docs/design.md`. |

## The Guides (`docs/content/en/guides/`)

The Guides were reviewed page by page and rewritten on 2026-10-24 by the "Guides Overhaul" plan
(closed 2026-11-04; git history: `.plans/GUIDES_OVERHAUL_PLAN.md`). Eleven groups follow the reader's
journey, as `guides/_meta.ts` lists them: Overview (a task index, "I want to..." → page), The Emulator,
Tapes, Disks and Snapshots, Other Machines, Projects and Building, Editing Code, Languages and
Toolchains, Debugging, ZX Spectrum Next, Analysis and Reverse Engineering, Testing and Automation,
Customizing Klive. **Every feature that ships gets a guide**, or a deliberate decision that the
Reference covers it; a moved page leaves a `docs/redirects.json` entry (R7).

**Page standard** (every new or rewritten page):

1. A front-matter `description` of one real sentence saying what the reader can do (it is shown in
   search and on the overview; never cut it at a colon).
2. A lead of two or three sentences: what it is for, when to use it.
3. An *Applies to* line when the feature is machine-specific.
4. Task sections first, numbered steps (Nextra `<Steps>`) for anything with an order. Name controls by
   their current English label (look it up in `src/common/i18n/locales/en/`) and give the menu path
   (`Machine › Disks › Insert Disk`), the command, and the shortcut on both platforms.
5. Reference details (tables, options, edge cases) after.
6. *Related*: two to five links, including the Reference page and the Under the Hood article when one
   exists. Do not restate "how it works" when Under the Hood covers it.
7. Links are absolute (`/en/guides/...`); `doc:check:links` resolves them.
8. No colour names for UI state ("the red dot"): colours follow the accent. Name the state ("an
   unresolved breakpoint").

**Screenshots** (generated, never hand-captured; `dev/ai/doc-screenshots-guide.md`): a shot earns its place
for orientation (the first view of a panel, dialog or editor), for state that is hard to describe (a
paused session, a heat map, a media strip with a cartridge), or for a result. Text, a table or a code
block is better, and survives restyles, for single icons and glyph tables, key close-ups, tooltips,
register values, command output, a menu a path already names, and settings pages beyond one overview.
Rules: one recipe per page or per group in `dev/scripts/doc-shots/recipes/guides-*.cjs` (helpers in
`dev/scripts/doc-shots/guides-helpers.cjs`, outside `recipes/` because `run.cjs` treats every file there as
a recipe), the seeded preset (dark, fixed accent, 1280×820 at 2x), element-scoped crops except where
the point is the whole window, WebP shown with `<Shot>` (R3), at
`docs/public/images/en/guides/<group>/<page>/<name>.webp`, typically one to four per page within
`doc:check:weight`'s 1.5 MB. A recipe that cannot reach a state is a bug report about the page or the
app. `doc:check:guide-images` fails on the pre-redesign images, and `.plans/docs-assets.golden.txt` is
updated with every published or deleted image. **Before a release, re-run the `guides-*` recipes into
`.local/doc-shots/` and review the diff.**

**Corrections the rewrite found, worth knowing when editing:** run-to-line by Ctrl/Cmd-click works only
in the Disassembly gutter (the editor has **Run to Cursor**); the assembly Call Stack is the top 16 raw
stack words; HT-1080Z supports debug recordings; sjasmplus owns only `.sjasm`; there is no
`pasta80.target` setting; editor settings are saved with the IDE, not per project; only the 48K ROM
row has **Reset**; `.shc/.shr/.slr/.vid` open a "not implemented" placeholder; the Klive Script
`Output` object replaced the non-existent `$log()`/`$progress()`.

**App issues the recipes surfaced** (recorded 2026-10-24, not fixed then; check before relying on
them): the NEX viewer flags Klive's own `expc -f nex` output and every zxbc/z88dk NEX for entry bank
`$00`; a file `expc` writes into an open project never reaches the tree; `display-dialog` refuses the
interactive prompt; the Breakpoint dialog's two checkboxes touch; the `.P` viewer reads "Runs from
Needs RUN".

## How the translated site behaves

- In a non-English locale the navbar keeps every tab. *Get Started* is translated; the other areas
  link to the English pages with an "English" badge, so nothing 404s.
- Chrome texts are in `docs/i18n/ui/`, the landing page's in `docs/i18n/landing/`, both with
  translator context like the app's catalogs; `uiLabels` gives translators the app's own wording
  for bold UI labels. Custom heading ids (`[#id]`) are part of the structure check, because a
  translated heading otherwise breaks in-page anchors.
- Pages are served with a trailing slash, hence absolute links (`AGENTS.md`).

## Open

- **Native-speaker review** of the translated Get Started pages and the landing dictionaries (es,
  pt-BR, pt-PT, de, hu) is the author's call per language. The translations were produced by model
  agents through the workflow and re-translated after their own review notes. The Hungarian voice is
  first person plural, per the glossary's style entry.

## Ideas not taken up

Try Klive in the browser (the cores are WASM and already run in Chrome for the visual tests; needs a
browser host, keyboard mapping and a check of the ROM redistribution wording); "Run this" buttons
that download the fixture project, later a `klive://` link; an interactive annotated tour of the IDE
from the `<Shot>` markers; a "Coming from DeZog / CSpect / ZEsarUX?" migration page; generated Open
Graph images per page and language; an RSS feed of releases; the book as PDF/EPUB on releases;
search per language with an "include English results" toggle; short video chapters per Get Started
page; a freshness check that re-captures screenshots and reports pixel drift
(`npm run doc:shots -- --check`).
