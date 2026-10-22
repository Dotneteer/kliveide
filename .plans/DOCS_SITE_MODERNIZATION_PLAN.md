# Klive Website and Documentation Modernization Plan

Status: **accepted** (2026-10-18; decisions recorded in §8). Supersedes the "later phases" of
[LANDING_PAGE_PROTOTYPE_PLAN.md](LANDING_PAGE_PROTOTYPE_PLAN.md) and turns §5 of
[LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) into a build plan.

## 0. Goals and ground rules

**Goals (from the project author):**

1. A landing page that sells what is *unique* about Klive, not a generic "retro IDE" page.
2. The landing page in every UI language Klive supports, with a language selector in the header.
3. A documentation structure built around **getting started**: the emulator, the IDE, the first
   program, running and debugging it.
4. The book (*Inside the ZX Spectrum Next*) and the emulator-internals articles stay. The book is
   reachable by its URLs but not linked from the site (§2.4).
5. The Getting Started section translated into every supported language (the rest stays English
   for now, but the structure must allow translating more later).
6. Illustrations generated with the Playwright harness (`scripts/doc-shots/`), not hand-captured.

**Ground rules (accepted):**

- **R1 — One language list.** The site's languages are exactly the `enabled` rows of
  `src/common/i18n/languages.ts` (today: en, es, pt-BR, pt-PT, de, hu). The docs package cannot
  import that file (it pulls in the generated catalogs), so a script exports
  `docs/i18n/languages.json` and `doc:check` fails if the two disagree.
- **R2 — Same translation discipline as the app.** No hand-written translations in a feature
  change. Docs translations go through a `doc:i18n:todo` / `doc:i18n:merge` workflow that mirrors
  the app's, uses the same `glossary.json` and never-translate list (product, machine, hardware,
  register and instruction names, commands, shortcuts), and records the English source hash of
  every translated page so an outdated translation is detected.
- **R3 — Text never lives inside pixels.** Screenshot annotations (numbered markers, captions,
  arrows) are HTML over the image, so they translate with the page and survive re-captures.
- **R4 — Screenshots match the page's language.** The IDE UI is already translated, so a Spanish
  Getting Started page shows the Spanish IDE. The harness seeds the UI language just as it seeds
  the theme.
- **R5 — Tutorial code is tested.** Every program a Getting Started page asks the reader to type
  lives as a fixture, is built by a test, and is the same file the screenshot recipe opens.
  A tutorial whose code no longer assembles fails CI, not a reader.
- **R6 — Claim only what is released.** Landing-page claims follow the latest release tag (v0.63.0
  today), re-checked against the competitive analysis' "Deliberately not claimed" list each release.
- **R7 — Old URLs keep working.** A static export cannot send 301s, so every moved page leaves a
  generated redirect stub (`<meta http-equiv="refresh">` + `<link rel="canonical">`). The
  route golden lists the stubs, so a forgotten one fails `doc:check`.
- Existing constraints in `AGENTS.md` still bind: `--webpack`, the Shiki language list, the
  `patch-package` fix, `CNAME`, `NEXT_PUBLIC_BASE_PATH`.

---

## 1. What is wrong today (survey)

| Area | Finding |
|---|---|
| Landing page | Prototype only: four text cards; says "Mac and Windows" (Linux ships); says the Next is "on the way" (it is the flagship machine); no media other than one old screenshot; no download per OS. |
| Navigation | One flat sidebar of 11 top-level entries mixing tutorials, references, how-tos and internals. "Working with the IDE" has 38 pages in one list (editor, Copper inspector, unit tests CLI and BASIC listing side by side). |
| Getting started | Six pages that describe the *emulator* (keyboard, tapes, saving) and then project creation. There is no "write, run, debug your first program" path, no BASIC path and no Next path. |
| Stale facts | `introduction.mdx` "Mac and Windows"; `project-templates.mdx` is `_TBD_`; `docsRepositoryBase` points to `dotneteer/klive`; metadata says "KliveIDE"; "Edit this page" is turned off. |
| Gaps | No Klive BASIC language/user guide in `content/` (only `working-with-ide/zxb.mdx` on ZXBASIC integration); no page on choosing the UI language; no CLI/automation landing; no "what's new". |
| Book | Hidden from the sidebar (`display: "hidden"`); reachable only by URL. |
| Internals | Two ZX81 articles; a natural home for more (WASM cores, debug loop, Next core vs. VHDL). |
| Images | 128 files, 17 MB, mostly hand-captured, inconsistent theme/size; recipes already exist for 20 pages. |

---

## 2. Target information architecture

Nextra 4 turns top-level `_meta` entries with `type: "page"` into **navbar tabs, each with its
own sidebar**. That gives the site four public areas instead of one long list, plus the unlinked
book:

```
Home (landing)   Get Started   Guides   Reference   Under the Hood        [lang ▾] [☾] [GitHub]
(Book: /en/book/… — available, not linked)
```

### 2.1 Get Started (translated) — a linear tutorial, ~90 minutes end to end

Each page: goal, time, prerequisites, numbered steps with annotated screenshots, "what you
learned", and a big "Next" card. Short, task-shaped titles.

| # | Page | Covers | Reuses |
|---|---|---|---|
| 1 | **Welcome to Klive** | What Klive is: the two windows (emulator, IDE), the machines, what you will build in this track. One annotated hero screenshot. | introduction.mdx |
| 2 | **Install Klive** | Tabs per OS (macOS pkg, Windows installer/portable, Linux AppImage), first-start dialog, the optional Boriel BASIC kit offer. | installation.mdx |
| 3 | **Meet the emulator** | Pick a machine (favourites, Select machine…), start/pause/reset, the keyboard, typing a first BASIC line (`10 PRINT "HELLO"`), the on-screen keyboard. | first-run, keyboard, machine-types |
| 4 | **Load a program from tape** | Open a `.tap`/`.tzx`, fast vs. real-time load, snapshots in one paragraph with links. | tapes.mdx |
| 5 | **Meet the IDE** | Show IDE, the layout (explorer, editor, tool panels, command prompt), changing the UI language and theme. | first-run, settings |
| 6 | **Your first assembly program** | New project (48K, Klive asm template), the code (a border-stripes / "hello" program), Build, Run, what Inject means. | creating-project, run-debug |
| 7 | **Debug your program** | Breakpoint in the margin, Debug, step over/into, CPU and Memory panels, a watch, Step Back once (reverse debugging as a teaser). | run-debug, breakpoints, watch |
| 8 | **Your first BASIC program** | New project with the ZX BASIC template using **Klive BASIC** (the default compiler), run, a breakpoint on a statement, step, the Variables panel. A closing note shows how to switch to Boriel BASIC 2.x. | zxb.mdx |
| 9 | **Your first ZX Spectrum Next program** | Next project, `.savenex`, run, a peek at the Sprite Inspector or NextReg breakpoint. | zx-next.mdx |
| 10 | **Save and share your work** | Export TAP (with BASIC loader) / NEX / `.p`, run it in another emulator or on real hardware. | exporting-code, save-programs |
| 11 | **Where to go next** | Path cards: Guides by goal (games, Next hardware, reverse engineering, testing) and the Reference (no Book link, D6). | — |

Optional side tracks after the core (English first, translated later): *ZX81 in five minutes*,
*Bring your sjasmplus project*, *Cambridge Z88*.

### 2.2 Guides (English) — task-oriented, grouped

The current `working-with-ide/` and `howto/` pages regrouped, mostly moved, a few merged:

| Group | Pages (from today's content) |
|---|---|
| **The emulator** | machines & models, keyboard & joysticks, tapes, disks (DSK, TR-DOS), snapshots, RZX, machine state, custom ROMs, screen recording, always on top, ZX80/ZX81, Z88 |
| **Projects and building** | projects, project templates (write the `_TBD_` page), the build system & `build.ksx`, background compilation, exporting code, file extensions |
| **Languages and toolchains** | Klive Z80 assembler (overview → Reference), Klive BASIC (new user guide), Boriel BASIC, sjasmplus, PASTA/80, z88dk |
| **Editing** | editor, navigation, syntax colours, keyboard shortcuts |
| **Debugging** | run & debug, breakpoints (conditions, logpoints, hit counts), watch, memory, disassembly, CPU, ULA, call stack, system variables, BASIC listing, beam position, measuring T-states, execution history, reverse debugging, debug recordings |
| **ZX Spectrum Next tools** | NextRegs & memory mapping, Copper, sprite / tilemap / Layer 2 inspectors, layers, SD card and NextZXOS, sprite & palette editors |
| **Analysis and reverse engineering** | code coverage & heat map, profiler, code/data detection, graphics finder, SkoolKit, exporting source, NEX reverse engineering |
| **Testing and automation** | unit tests, tests on the command line / CI, automation API & `klive` CLI, Klive Script |
| **Customizing Klive** | settings, UI language, IDE startup, diagnostics, advanced debugging switch |

### 2.3 Reference (English)

Klive Z80 Assembler (today's `z80-assembly/`), Klive BASIC language (new; written only from Klive's
own spec in `.ai/zxbasic-syntax/` — the provenance rule applies), Klive Script, interactive
commands, `klive` command line, machine types, keyboard shortcuts, file formats.

### 2.4 Book (English) — *Inside the ZX Spectrum Next* — available, not linked

Decision: the book has **no public links** but stays **available** at its URLs (today's behaviour,
`display: "hidden"`). Concretely: no navbar tab, no sidebar entry, no landing-page teaser, no link
from other pages, and it is left out of the sitemap and Pagefind (`data-pagefind-ignore` on its
layout) so search does not surface it. It keeps its own sidebar when opened directly (a hidden
`type: "page"` entry), and its pages stay in the route golden and the link audit. URLs move with
the English prefix (`/book/…` → `/en/book/…`) and get redirect stubs like every other page.
Making it public later is a one-line `_meta` change plus a landing teaser.

### 2.5 Under the Hood (English)

Emulator internals plus contribution: the two ZX81 articles, and new articles adapted from the
engineering READMEs (how the WASM cores share one Z80, the in-core debug loop, how the Next core
follows the FPGA's VHDL, how reverse debugging replays a machine). "Contribute" (source, WASM
toolchain, improving the docs, translating Klive) moves here.

---

## 3. Landing page redesign

**Structure** (one long page, every block translatable):

1. **Header** — logo, *Get Started*, *Docs*, GitHub, **language selector** (native names
   from R1), light/dark toggle. Sticky, collapses to a menu on phones.
2. **Hero** — headline/subhead from the analysis (*The complete ZX Spectrum and Next development
   studio* / *Write, assemble, compile, run and debug Z80 code and ZX BASIC in one app, on Mac,
   Windows and Linux*). Primary button **Download for <detected OS>** (+ "other platforms"), secondary
   **Get started**. Version badge from the latest release. Media: a short looped, muted clip of
   edit → Run → breakpoint → step, with a poster screenshot as fallback.
3. **The loop** — four steps, *Write → Build → Run → Debug*, each with a small screenshot.
4. **Machines strip** — tiles for 48K, 128K, +2A/+3, Next, Pentagon, Timex, Scorpion, ZX80/ZX81, Z88
   (generated screenshots of each machine's boot screen).
5. **Five feature sections** (alternating text/media), chosen per the analysis' rules — unique and
   visible — and updated for what has shipped since it was written (re-verify per R6):
   - *One app. Zero glue.* (all-in-one, templates, bundled toolchains)
   - *Step through your BASIC, line by line.* (BASIC source-level debugging, Klive BASIC and Boriel)
   - *Go back in time.* (reverse debugging of the whole machine, debug recordings) — new candidate
   - *Speaks Next natively.* (NextReg/Copper/sprite breakpoints, live inspectors, layer probe)
   - *Test it like modern code.* (unit tests, coverage, profiler, `klive test` in CI) — new candidate
   - Reserve: *Open a .nex. Understand it.* / *Disassembly that explains itself.*
6. **Supporting strip** — small cards (Next core built from the VHDL, video recording, automation
   API, UI in six languages, free and open source).
7. **Footer** — licence, GitHub, changelog, translate-Klive link, language selector again.

**Implementation notes:**

- Stays a separate root layout in `app/(landing)/` (no Nextra), but gains a `[lang]` segment and
  per-language dictionaries `docs/i18n/landing/<lang>.json` (English is the source with translator
  context, like `src/common/i18n/locales/en/`).
- Design tokens: a small CSS-variable token set shared by landing and docs (`docs/app/tokens.css`)
  taking Klive's accent and neutral palette from the app's L1/L2 tokens, so the site looks like
  the app. Light theme derived, as in the app. Record the rules in
  `.ai/ui-theming-intent-and-lessons.md` (standing instruction).
- Download button: build-time fetch of the latest GitHub release (asset names are documented in
  installation.mdx) with a client-side OS/arch detection; falls back to the releases page.
- Media: images via `next/image`-free `<img>` with `width/height`, AVIF/WebP generated by `sharp`
  at build, lazy below the fold. Video as short WebM/MP4 loops recorded with Klive's own recorder.
- Accessibility & SEO: real headings, alt text from the dictionary, `hreflang` alternates for
  every language, Open Graph image per language, `data-pagefind-ignore` kept.

---

### 3.1 Visual design (decision D8 — the mix of A, B and C)

Mockups: [`.plans/mockups/site-directions.html`](mockups/site-directions.html) (also published as a
private artifact). The current design's problems: the landing page uses a generic blue
(`#2563eb`) and the system font, not Klive's palette or its rainbow-stripe logo; its layout is a
centred template; the landing page and the stock Nextra docs share no tokens, so moving between
them feels like changing sites; one old screenshot carries the whole page.

| Direction | Idea | Strength | Risk |
|---|---|---|---|
| **A · Studio** | The app's own tokens: cool dark neutrals from `theming/tokens/palette.ts`, the Sinclair Blue accent, Schibsted Grotesk / IBM Plex Sans / JetBrains Mono; the logo's four stripes once, in the hero corner. | One product feel across the site, docs and dark screenshots; the light theme is derived as in the app; lowest effort. | Quieter than B. |
| **B · Spectrum Heritage** | Black ground, the Spectrum's bright colours in solid blocks, large stripes across the hero, a BASIC listing in a blue border, pixel-style labels. | Most memorable and shareable. | Reads as a games/retro site; hard to keep calm in long docs. |
| **C · Field Manual** | Light datasheet look: fine grid, condensed uppercase Archivo, monospaced labels, numbered callouts drawn into figures, Spectrum Magenta accent. | Best fit for annotated `<Shot>` figures and the book. | Needs its own dark variant; weaker first impression. |

**Decision (D8):** build A as the design system, use B's stripe band and solid-colour feature
blocks as the landing page's single loud moment, and C's numbered callouts and figure labels for
docs screenshots. Whichever is chosen, the tokens live in `docs/app/tokens.css`, generated from
or checked against the app's L1/L2 tokens so the two cannot drift, and the decision is recorded in
`.ai/ui-theming-intent-and-lessons.md`.

## 4. Internationalization architecture

### 4.1 URL scheme (decision D1 — recommended option A)

| Option | URLs | Verdict |
|---|---|---|
| **A. Nextra native i18n, every language prefixed** | `/en/get-started/…`, `/de/get-started/…`; `/` = English landing | Nextra's locale-aware page map, sidebar and `LocaleSwitch`; Pagefind separates languages by `<html lang>`. English URLs move once — redirect stubs (R7) cover them. **Recommended.** |
| B. English unprefixed, translations prefixed | `/get-started/…`, `/de/get-started/…` | Keeps English URLs, but fights Nextra (custom page maps, hand-made switcher). |
| C. Translate only the landing page, docs English-only | — | Does not meet goal 5. |

Static export has no middleware, so option A uses Nextra 4's
`unstable_shouldAddLocaleToLinks` (present in the installed 4.6.1; its schema describes it as the
way to do i18n "when you don't want to use Nextra's `middleware`"). `/` never auto-redirects
(bad for static hosting and search); instead a dismissable banner offers the visitor's
`navigator.language` match.

### 4.2 Untranslated sections

In a non-English locale the navbar keeps all tabs. *Get Started* is translated; *Guides*,
*Reference* and *Under the Hood* link to the English pages with an "English" badge in the
sidebar (via `_meta` `href` entries generated per locale), so nothing 404s and the reader knows
what to expect. A translated page whose English source changed shows an "This translation may be
out of date — read the English page" callout (from the stored source hash, R2).

### 4.3 Content layout

```
docs/content/
  en/  get-started/ guides/ reference/ book/ under-the-hood/   ← source
  es/  get-started/                                            ← translations only
  de/  get-started/  …
docs/i18n/
  languages.json            ← exported from src/common/i18n/languages.ts (R1)
  landing/<lang>.json       ← landing dictionaries
  ui/<lang>.json            ← site chrome: "Search…", "On this page", "Next", badges
  sources/<lang>.json       ← English source hash per translated page/key (R2)
```

### 4.4 Translation workflow (mirrors the app's)

- `npm run doc:i18n:todo -- <lang>` — lists missing/outdated landing keys and Get Started pages,
  with the glossary and per-page context, into `i18n-work/docs-<lang>.todo.json`.
- Translation by a model or a person following a new `docs/i18n/TRANSLATING.md` (MDX-specific rules:
  never translate code fences, component props that are ids, image paths, command names; keep
  headings' anchors stable through explicit `{#id}` ids so cross-language links don't break).
- `npm run doc:i18n:merge -- <lang> <file>` — validates (MDX parses, same headings/ids, same code
  fences byte-for-byte, same components) and writes the pages and source hashes.
- `npm run doc:i18n:check` — part of `doc:check`: coverage table, outdated list, missing hreflang.

---

## 5. Illustrations pipeline

Builds on `scripts/doc-shots/` (read `.ai/doc-screenshots-guide.md`).

1. **Locale parameter.** `run.cjs <recipe> --lang <id|all>` seeds the UI language in the throwaway
   settings file and writes to `docs/public/images/<lang>/<page>/…` (English stays the fallback:
   an image missing for a language falls back to `en` at build, with a `doc:check` warning).
2. **Consistent look.** One seeded preset for all doc shots, landing page included: **dark theme
   only** (decided), fixed accent, window 1280×820 at 2x, fixed fonts — already
   supported by the harness.
3. **`<Shot>` component** replacing `<ClickableImage>` for new pages: picks the locale's image,
   renders zoomable, and takes `markers` (`[{n:1, x:"34%", y:"12%"}]`) drawn as HTML badges; the
   numbered list under the image is ordinary translated MDX (R3). Coordinates can be emitted by the
   recipe itself from element bounding boxes, so markers follow the layout.
4. **Fixture projects** in `scripts/doc-shots/fixtures/get-started/` (the tutorial programs, R5),
   used by recipes, by a test that builds them, and offered as downloadable zips from the pages.
   The existing fixture-project guard stays.
5. **Recipes per Get Started page** (11) and for the landing page (hero, loop, machines strip,
   feature media). Short clips: the recorder recipe produces WebM loops for the hero/features.
6. **Freshness.** `npm run doc:shots -- --check` re-captures into `.doc-shots/` and reports images
   whose pixel diff exceeds a threshold — run before a release, not in CI (needs a display).
7. **Weight budget.** Images converted to WebP/AVIF at publish; a `doc:check` rule fails a page whose
   images exceed a budget (e.g. 1.5 MB per page).

---

## 6. Phases

Each phase ends with `npm run doc:build && npm run doc:check` green and goldens updated in the same
change.

### Phase 0 — Spikes and housekeeping (small, de-risks everything)

> **As built (2026-10-18).** The D1 spike passed in a scratch copy of the docs app: `content/en` +
> `content/de`, `i18n` in `next.config.mjs` with `unstable_shouldAddLocaleToLinks`, a root layout
> at `app/[lang]/layout.tsx` (with `generateStaticParams` and `dynamicParams = false`), Nextra's
> `<Layout>` in a nested `app/[lang]/(docs)/layout.tsx` calling `getPageMap(\`/${lang}\`)`, the
> catch-all using `generateStaticParamsFor("mdxPath", "lang")` and `importPage(path, lang)`, and a
> separate `app/(root)` group for `/`. The export under `/preview/x` produced per-locale links,
> `_meta` `href`s into English pages, `<html lang="de">`, and Pagefind indexed two languages.
> Nextra's own `LocaleSwitch` only swaps the locale segment, so it would 404 on a page that has no
> translation; the site gets its own switcher that knows which pages exist per locale (Phase 5).
> Redirect stubs: `scripts/build-doc-redirects.cjs` reads `docs/redirects.json` and runs in docs'
> `postbuild` before Pagefind; it refuses targets that are not pages and stubs that would replace a
> real page. Release check: v0.63.0 lacks reverse debugging, unit tests/coverage/profiler and the
> Next inspectors, so landing-page features carry a `since` version and are shown only when the
> latest release tag (read at build time) has them — this is how D2 and R6 coexist.

- Spike D1: a throwaway branch with `content/en` + `content/de`, two pages,
  `unstable_shouldAddLocaleToLinks`, `LocaleSwitch`, static export under a base path, Pagefind
  per language. Also prove `(landing)/[lang]/page.tsx` and the docs catch-all coexist.
  **Exit:** works, or fall back to option B with a recorded reason.
- Spike: redirect stubs generated from a `docs/redirects.json` map, included in the route golden.
- Fix stale facts (§1 table), enable "Edit this page" with the right repository base.
- Refresh the claim list against v0.63.0 (R6) in the competitive analysis.

### Phase 1 — New structure, English only
- Move pages into `get-started/ guides/ reference/ book/ under-the-hood/` under `content/en/`,
  regroup `_meta` files, navbar tabs, keep the Book hidden (§2.4), write the redirect map for every
  moved URL.
- Rewrite `scripts`/links audit expectations; update `.plans/docs-routes.golden.txt`.

### Phase 2 — Illustration tooling
- `--lang` in the harness, the `<Shot>` component, fixture projects and the build test (R5),
  image optimisation step, weight budget check.

### Phase 3 — Get Started rewrite (English)

> **As built (2026-10-18).** Ten pages plus the welcome page (the plan's "Meet the IDE" and "Install"
> survived as planned; *Load a program from tape* keeps the existing English tape-viewer images).
> One localized recipe, `scripts/doc-shots/recipes/get-started.cjs`, drives the whole path and
> writes 24 WebP shots per language with marker sidecars. Lessons that shaped it: aria-labels are
> translated, so the toolbar and build-bar buttons got a `data-icon` attribute (`IconButton`,
> `TabButton`); on macOS the application menu has submenus only while Klive has the OS focus, which
> a scripted run cannot count on, so the recipe uses commands (`settings language`, `close`/`open`,
> `run-build-function exportCode`) and in-window buttons instead of the menu; a persisted View zoom
> broke Playwright's element crops, so the harness pins zoom to 1; the Next needs its SD card image
> seeded into the throwaway home. The pages target master, not v0.63.0: the localized UI, the beam
> overlay and the unified Settings are unreleased, as much of the existing documentation already is.
- Write the 11 pages of §2.1 with recipes and annotated shots. Reviewed by the author for tone
  (and against `docs/authoring/book-writing-guidelines.md` where it applies).

### Phase 4 — Landing page (English)

> **As built (2026-10-18).** `docs/landing/` (server component plus three small client parts:
> Download, theme switch, language menu), text in `docs/i18n/landing/en.json`, tokens in
> `docs/app/tokens.css` guarded by `test/docs/site-tokens.test.ts`, fonts through `next/font` (self-hosted with `next/font/local` since v0.64.0: the files are in `docs/fonts/`, refreshed by `scripts/build-doc-fonts.cjs`, because `next/font/google` failed a release build on a Google response it could not parse).
> `scripts/build-doc-site-info.cjs` reads the latest tag and the release's asset names (GitHub
> API, falling back to the naming pattern) for the per-OS Download button and the `since` gating;
> with v0.63.0 the page shows five features and holds back reverse debugging and testing. The
> landing footer's changelog link goes to the generated *What's new* page.
- Implement §3 with tokens, download detection, media from recipes and the recorder.
- Visual check in the browser at desktop and phone widths, light and dark.

### Phase 5 — i18n infrastructure

> **As built (2026-10-18).** `scripts/docs-i18n.cjs` (`languages`, `todo`, `merge`, `pack`,
> `check`); `check` runs in `doc:check`. A language is published once it has `content/<lang>/`,
> so enabling a language in the app adds nothing to the site until it is translated. The docs
> navbar switcher knows each language's routes; the out-of-date notice compares merge-time hashes.
> `uiLabels` gives translators the app's own wording for every bold UI label; it prefers
> menu/toolbar keys and keeps ellipses, after the first round showed text-only matching picked
> table columns ("Start" as a tape-header field). Custom heading ids (`[#id]`) are part of the
> structure check, because a translated heading otherwise breaks in-page anchors.
- `languages.json` export + check, `[lang]` routing for landing and docs, language selector,
  locale-aware chrome strings, hreflang, banner, untranslated-section badges, the
  `doc:i18n:todo/merge/check` scripts and `TRANSLATING.md`.

### Phase 6 — Translations

> **As built (2026-10-18).** All five languages (es, pt-BR, pt-PT, de, hu) translated through the
> workflow by one model agent per language, then re-translated where the English changed after
> their review notes (wrong separators, a heading anchor, step numbers in code comments, a wrong
> alt text). Native-speaker review is still open for every language; the Hungarian voice is first
> person plural, per the glossary's style entry. Screenshots: `get-started.cjs --lang all`.
- Landing dictionaries and Get Started pages into es, pt-BR, pt-PT, de, hu through the workflow,
  localized screenshots via `--lang all`. Native-speaker review is the author's call per language.

### Phase 7 — Book and Under the Hood polish

> **As built (2026-10-18).** The book home lists every chapter with a Written / In progress /
> Outline status (chapters 1-8, the front matter and appendices A-C are written), and
> `scripts/build-doc-search-scope.cjs` keeps the book out of Pagefind. The one link into the book
> (an example on the contribution page) is gone. Under the Hood gained four articles written from
> the engineering READMEs and plans (the WASM cores, the debugger loop, the Next core and the
> VHDL, reverse debugging); Contribute gained *Translate Klive* and a rewritten *Improve the
> documentation*.
- Book home with chapter status (still unlinked, §2.4), Under the Hood articles adapted from the READMEs, Contribute
  pages including "Translate Klive" (linking `src/common/i18n/locales/README.md`).

### Phase 8 — Writing the gaps (English)

> **As built (2026-10-18).** A nine-page Klive BASIC reference under `reference/klive-basic/`,
> written only from `.ai/zxbasic-syntax/`, `.ai/kbasic/` and Klive's own stdlib (every example
> program was compiled with Klive BASIC; the failing blocks are grammar notation). Where the
> sources disagree (`#elif`, bare `@array`, `CHR` without parentheses, `right()` on a short
> string, `printat64` out of range) the page follows the compiler or leaves the point out; the
> spec should be reconciled. Also: the project templates page, *The display language*, *The klive
> command line*, and *What's new*, generated from CHANGELOG.md on every build
> (`scripts/build-doc-changelog.cjs`, not committed).
- Klive BASIC user guide and language reference (from `.ai/zxbasic-syntax/` and `.ai/kbasic/`
  only), project templates page, UI language page, CLI landing, "What's new" from `CHANGELOG.md`.

Phases 2 and 3 can overlap; 4 can run in parallel with 3 once Phase 2's tooling exists; 5 needs
Phase 1; 6 needs 3, 4 and 5.

---

## 7. Ideas worth considering

- **Try it in the browser** — *out of scope; gets its own plan (decided).* The Spectrum cores are WASM and already run in Chrome for the visual
  tests. A 48K running a small demo — or the reader's first program — embedded on the landing page
  or in Get Started page 3 would be unmatched by any competitor's site. Needs: a minimal
  browser host, keyboard mapping, and a check of ROM redistribution terms (Amstrad's permission
  covers the Sinclair ROMs for emulators; confirm the exact wording before shipping).
- **"Run this" buttons on code samples** that download the fixture project zip; later, a
  `klive://` link that opens it in the installed IDE (would need a protocol handler in the app).
- **Interactive annotated screenshot tour** of the IDE on the Get Started "Meet the IDE" page:
  hover a marker to highlight a region (falls out of `<Shot>` markers).
- **Comparison page** ("Coming from DeZog / CSpect / ZEsarUX?") — migration guides rather than
  feature tables, since the analysis decided not to name competitors on the landing page.
- **Generated Open Graph images** per page and language (title on a Klive-branded card) at build.
- **Changelog / release notes page** and an RSS feed of releases.
- **Book as PDF/EPUB** from the same MDX, attached to GitHub releases (once the book goes public).
- **Docs search per language** with a "include English results" toggle.
- **Video chapters**: 1–2 minute clips per Get Started page, recorded with Klive itself.

---

## 8. Decisions (2026-10-18)

| # | Decision |
|---|---|
| D1 | URL scheme: **option A** — Nextra native i18n, every language prefixed, English under `/en/`, `/` the English landing page, redirect stubs for every old URL. Phase 0's spike confirms it works with static export; fall back to B only with a recorded reason. |
| D2 | Landing features: the five in §3 (*One app. Zero glue.*, *Step through your BASIC*, *Go back in time*, *Speaks Next natively*, *Test it like modern code*), each re-verified against the latest release (R6). |
| D3 | Tutorial programs as proposed: border stripes / a moving character (asm), a small game loop (BASIC), a sprite on the Next. |
| D4 | Screenshots: **dark theme only**. |
| D5 | Get Started's BASIC page uses **Klive BASIC**; Boriel BASIC 2.x is a closing note. |
| D6 | Book: **no public links, but available** at its URLs (§2.4). |
| D7 | Try in the browser: **a separate plan**, not part of this one. |
| D8 | Visual design: **the mix** — A (Studio) tokens and type everywhere; B's hero stripe band and solid Spectrum-colour feature blocks on the landing page only; C's figure labels and numbered markers on docs screenshots (§3.1, "Recommended mix" tab in the mockups). |
