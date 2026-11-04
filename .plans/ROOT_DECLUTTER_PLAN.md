# Decluttering the Workspace Root

Status: **proposed 2026-11-04; R1 confirmed; `vendor/` added as step 6, `scripts/` as steps 10-11.** Nothing moved yet. R2-R4 are proposals until
step 1 starts.

## 1. Why

The GitHub page of the repo lists every root entry before the README. Today that is **31 tracked
entries** (16 folders, 15 files), so a visitor has to scroll past a screenful of names to reach the
first line of the README. The goal is to bring the root down to the entries that tools, GitHub or
convention genuinely need there: **31 -> 19**, with every move a small, separately reviewable step.

Locally the root also holds 9 ignored output folders (`.boriel-ide-check`, `.hallmark`,
`.rom-annotations`, `.spectrum-kit`, `.visual-tests`, `.z88dk-ide-check`, `artifacts`, `i18n-work`,
`out`). GitHub never shows them, but they clutter the editor's file tree; step 12 deals with them.

## 2. Inventory

| Entry | Files | Verdict | Why |
|---|---|---|---|
| `.claude/` | 1 | **stays** | Claude Code reads it from the root |
| `.github/` | 8 | **stays** | GitHub reads workflows and Dependabot from the root |
| `.vscode/` | 6 | **stays** | VS Code reads it from the workspace root |
| `.editorconfig` | - | **stays** | editors search for it up from each file; one at the root covers all |
| `.gitattributes`, `.gitignore` | - | **stay** | Git reads them from the root |
| `README.md`, `LICENSE` | - | **stay** | GitHub renders the README and detects the licence only at the root |
| `CHANGELOG.md` | - | **stays** | the conventional place readers look; `release.cjs`, `changes-lib.cjs` and the docs changelog page read it |
| `THIRD_PARTY_NOTICES.md` | - | **stays** | licence notice; convention puts it next to `LICENSE` (the MIT notices for Clock Signal etc. point at it) |
| `AGENTS.md` | - | **stays** | Codex, Copilot and other agents discover it only at the root |
| `package.json`, `package-lock.json` | - | **stay** | npm |
| `tsconfig.json` | - | **stays** | the solution file editors find from `src/`; `test/harness/*/tsconfig.json` extend it |
| `src/`, `test/`, `docs/`, `build/` | many | **stay** | core project folders; moving them rewrites hundreds of paths for no visible gain |
| `CLAUDE.md` | - | **moves** | Claude Code also reads `.claude/CLAUDE.md` |
| `eslint.config.cjs` | - | **moves** | only `lint:renderer` uses it; `--config` can point anywhere |
| `.prettierrc.yaml` | - | **moves** | Prettier reads a `"prettier"` key in `package.json` |
| `.prettierignore` | - | **goes** | its entries are already covered by `.gitignore`, which Prettier 3 honours, or are not formatted anyway |
| `public/` | 5 | **moves** | only the installer icons; only `package.json` (`build.*.icon`) reads them |
| `.ai/` | 90 | **moves** | developer knowledge |
| `.docs/` | 14 | **moves** | developer knowledge |
| `.plans/` | 12 | **moves (last)** | developer knowledge; holds this plan |
| `.changes/` | 47 | **moves** | release mechanism, read by scripts and one workflow |
| `_input/` | 4671 | **moves** | research packs |
| `_experiments/` | 47 | **moves** | test projects used by doc scripts |
| `vendor/` | 76 | **moves** | third-party kits, test suites and the VHDL reference; read by the app, the packaging, scripts and tests (step 6) |
| `scripts/` | 184 | **moves** | developer tooling, never shipped; 65 scripts find the repo root from their own folder, so a preparation step comes first (steps 10-11) |

Result: the 13 entries marked *moves*/*goes* leave and one folder (`dev/`) arrives: **19** entries,
3 tool folders, 5 project folders (`dev/` included) and 11 files.

## 3. Target layout

```
.claude/  .github/  .vscode/
build/    dev/      docs/     src/      test/
.editorconfig  .gitattributes  .gitignore
AGENTS.md  CHANGELOG.md  LICENSE  README.md  THIRD_PARTY_NOTICES.md
package.json  package-lock.json  tsconfig.json
```

with

```
dev/
  ai/           <- .ai/
  patterns/     <- .docs/        (renamed: "docs" next to the docs site's docs/ is confusing)
  plans/        <- .plans/
  changes/      <- .changes/
  research/     <- _input/
  experiments/  <- _experiments/
  scripts/      <- scripts/
  vendor/       <- vendor/       (keeps its name: GitHub's language statistics treat `vendor/` folders as vendored code; confirm after step 6)
  README.md     one paragraph per subfolder: what it is, who reads it
build/
  icons/        <- public/images/
  eslint.config.cjs
```

## 4. Decisions

- **R1. The folder is `dev/`** (confirmed by the project author, 2026-11-04): visible, short, and
  says "for developers of Klive, not users". Rejected: `.dev/` (GitHub shows dot folders anyway),
  `meta/`, `contrib/`.
- **R2. `.docs/` becomes `dev/patterns/`.** Keeps "docs" meaning the public site only. Alternative:
  `dev/docs/`.
- **R3. Keep `CHANGELOG.md` and `THIRD_PARTY_NOTICES.md` at the root.** Moving them saves two rows
  but breaks a convention readers rely on. Revisit only if the root still feels long.
- **R4. No compatibility stubs or symlinks** at the old paths (the repo's own rule against wrapper
  files). History follows through `git log --follow`.

## 5. How every move step is done

**Each step ends with a commit once its checks pass** (the project author's instruction,
2026-11-04): one step, one commit, and no step starts on top of uncommitted work from the one before.
A step whose checks fail is fixed before it is committed, never committed half-done. Every step
follows the same recipe, so a step can be reviewed as
"one `git mv` plus a mechanical rewrite":

1. `git mv <old> <new>` - alone, so Git records renames at 100% similarity.
2. Rewrite references with a one-off script (kept in the scratchpad, not committed): replace the
   old path prefix with the new one in every tracked text file **except** the moved folder's own
   history-like content that must stay verbatim (`CHANGELOG.md`, `test/boriel/fixtures/`, zxbc
   output, binary files) **and the Klive BASIC corpus programs** (`test/kbasic/corpus/**/*.zxbas`):
   `test/z80-backend/snapshot/` pins their compiled output and diagnostics, and a longer path in a
   comment shifts every offset after it (found in step 8; re-recording is a reviewed change). Their
   comments keep the old paths. Match the prefix as a path (`.ai/` with the trailing slash, `` `.plans/ ``,
   `"_input/`), never the bare word.
3. Fix the functional references by hand and check them (they are listed per step below); the rest
   are comments and Markdown links, where the script is enough.
4. `git grep` for the old prefix: the only hits left must be in `CHANGELOG.md` (history) and this
   plan.
5. Run the checks the step names. All steps end with `npm run build:check` and `npm test`.
   Then commit: `Root declutter, step N: <what moved>`, the step's moves and rewrites only.
6. **No changeset** in steps 1-13: they complete only part of this plan (AGENTS.md rule). Step 14
   adds one `internal` changeset for the whole plan (no CHANGELOG entry, no version bump: nothing
   user-visible changes).

Paths in this plan are written as they are today. Once a step has moved a folder, read the paths
in later steps with the new prefix (after step 11, `scripts/x.cjs` is `dev/scripts/x.cjs`).

Do the moves when few branches are open: every open branch that edits a moved file will need a
rebase (Git's rename detection usually carries the edit over).

Reference counts (tracked files that mention the path, outside `_input/` and the lock file):

| Path | code/config files | Markdown files |
|---|---|---|
| `.plans/` | ~1230 (almost all comments) | ~70 |
| `.ai/` | ~590 (almost all comments) | ~75 |
| `.docs/` | ~140 | ~20 |
| `vendor/` | ~120 (84 of them VHDL citations in `test/zxnext-hw` comments) | ~40 |
| `_input` | ~50 | ~30 |
| `.changes` | ~45 | ~6 |
| `_experiments` | ~10 | 1 |

## 6. Steps

Roughly from the least to the most referenced, so the recipe is proved on small moves first;
`vendor/` comes right after `.changes/` despite its count: it has the most functional references, so it
goes while the recipe is fresh and before the big comment-only rewrites.
`.plans/` is last because it holds this plan.

### Step 1. Tool configs out of the root (4 files -> 0)

- `CLAUDE.md` -> `.claude/CLAUDE.md`, its import becomes `@../AGENTS.md`. Check: a fresh Claude
  Code session in the repo still loads AGENTS.md (`/memory` lists it).
- `.prettierrc.yaml` -> a `"prettier"` key in `package.json` (`singleQuote: false`, `semi: true`,
  `printWidth: 100`, `trailingComma: "none"`).
- `.prettierignore` -> deleted. Its entries: `out`, `dist` (both in `.gitignore`), `pnpm-lock.yaml`
  (no such file), `LICENSE.md` (no such file), `tsconfig.json`, `tsconfig.*.json` (JSONC with
  comments). If keeping the tsconfig exclusion matters, add `--ignore-path` to a format script
  instead; no script runs Prettier today, so only the editor extension is affected.
- `eslint.config.cjs` -> `build/eslint.config.cjs`; `lint:renderer` gains
  `--config build/eslint.config.cjs`; `.vscode/settings.json` gains
  `"eslint.options": { "overrideConfigFile": "build/eslint.config.cjs" }` so the editor still lints.
  The `ignores` paths become relative to `build/` under ESLint 10's config-relative base path: check
  that `npm run lint:renderer` reports the same warning count before and after.
- Drop `"!.prettierrc.yaml"` (and the long-gone `"!.prettierrc"`) from `package.json` `build.files`.
- Checks: `npm run lint:renderer` (same count), format a file in VS Code, `npm run build:check`.

### Step 2. Create `dev/` and its README

- Add `dev/README.md`: what each subfolder holds and which audience reads it (AI assistants,
  contributors, release scripts). No moves yet; this is the landing point the later steps fill.
- **Add `"!dev"` to `package.json` `build.files` in this step, before anything moves in.** That list
  is `**/*` minus exclusions, so a folder it does not name is packaged: without the entry, step 7 would
  ship 4671 research files and step 11 the scripts inside the app. *Done (step 2).* **Found while checking (step 3):** they were not kept out. The app
  archive of the 2026-10-23 macOS build, and a fresh `--dir` build, carry `.ai/`, `.changes/`,
  `.claude/`, `.docs/`, `.plans/`, `_experiments/`, `scripts/`, `AGENTS.md`, `tsconfig.json` and,
  on a developer machine, the ignored scratch folders (`.visual-tests/`, `i18n-work/`, ...). `"!dev"`
  drops most of them as the moves land; what it leaves (`.claude/`, `AGENTS.md`, `tsconfig.json`,
  local scratch) was a follow-up of its own. *Done (2026-11-04, between steps 4 and 5):* `build.files`
  is now the allowlist `out/**/*`, `LICENSE`, `THIRD_PARTY_NOTICES.md` (electron-builder adds
  `package.json` and the production `node_modules` itself), so no later step needs to touch it: the
  `"!vendor"` and `"!dev"` exclusions are gone with the old list.
- Update the "Project Context" section of `AGENTS.md` to describe `dev/` with the paths it will hold,
  marking the not-yet-moved ones.

### Step 3. Installer icons: `public/` -> `build/icons/`

- `git mv public/images build/icons`.
- Functional: `package.json` `build.mac.icon`, `build.win.icon`, `build.linux.icon`
  (`public/images/...` -> `build/icons/...`). Do **not** touch `src/public/images` (the
  `extraResources` entry) or any `docs/public/images` path. Remove `"!public"` from `build.files`.
- `build/` is already electron-builder's default `directories.buildResources` (nothing overrides it),
  so files there are build inputs and never packed. Keep the explicit `icon` keys rather than
  renaming to electron-builder's implicit `build/icon.*` names: the explicit path is easier to find.
- Checks: `npx electron-builder --dir` on one platform builds and the app bundle carries the icon.
- Side finding to fix here: `build/electron-builder.json5` is stale (`.ai/boriel/integration.md` says
  so; its `buildResources` points at a missing `src/electron/resources`). Delete it, and update the
  comment in `src/main/recording/ffmpegAvailable.ts` that names it. *Done:* that comment credited the file with unpacking
  `@ffmpeg-installer`; it never took part in a build, and electron-builder unpacks the package on its
  own (present in `app.asar.unpacked` in both the 2026-10-23 build and the step 3 build).

### Step 4. `_experiments/` -> `dev/experiments/`

- Functional: `scripts/build-doc-assets.cjs` (`sourceDir`, `archive`),
  `scripts/doc-shots/recipes/landing.cjs` (`DEMO`), `scripts/changes-lib.cjs` (the paths that need
  no changeset; check `test/changesets/changes-lib.test.ts`), the reference in `src/renderer`.
- Check the `.klive` project files inside for absolute or `../` paths.
- Checks: `node scripts/build-doc-assets.cjs`, `npm test -- test/changesets`.

### Step 5. `.changes/` -> `dev/changes/`

- Functional: `scripts/changes.cjs` (`changesDir`), `scripts/release.cjs` (the pending check and
  `git add ... .changes`), `scripts/changes-lib.cjs` (the "is this a changeset" path test and the
  display text), `.github/workflows/changeset-check.yml`, `test/changesets/changes-lib.test.ts`.
- Docs: `.ai/changesets-guide.md`, `.ai/release-guide.md`, `AGENTS.md` ("Changesets And
  Releases"), the README inside the folder.
- Checks: `npm run change -- --type internal --text "probe"` writes into `dev/changes/` (then delete
  it), `npm test -- test/changesets`, a dry run of `release:prepare` if it has one, and the
  changeset-check workflow on the PR itself (it must pass with the moved folder and fail without a
  changeset).

### Step 6. `vendor/` -> `dev/vendor/`

Unlike the folders around it, `vendor/` is an input the app, the packaging and the tests read, and
most of what is in it locally is not tracked.

- Tracked: `boriel-basic/` (2 files: `kit.json`, README), `next-fpga/comments/` (11 files: Klive's
  VHDL comment patches), `spectrum-tests/` (63 files: third-party timing test kits). Ignored and
  fetched: `boriel-basic/kits/`, `boriel-basic/stage/`, `next-fpga/<version>/`. `git mv` moves only
  the tracked part.
- Functional:
  - App: `src/main/boriel-integration/boriel-kit.ts` (finds the kit in a development run),
    `src/common/zxnext/romSets.ts`.
  - Packaging: `build.extraResources` (`from: "vendor/boriel-basic/stage"` ->
    `dev/vendor/boriel-basic/stage`); `build.files` is an allowlist and needs nothing.
    `test/main/boriel-kit-script.test.ts` finds `package.json` at `VENDOR_FOLDER/../..`: one more
    `..` after the move.
  - Git: the `vendor/...` rules in `.gitignore` (kits, stage, `next-fpga/*/` with its
    `!next-fpga/comments/` exception) and `.gitattributes` (`spectrum-tests/** -text`, the patches'
    `eol=lf`). Check with `git check-ignore -v` and `git ls-files --eol` that both still apply.
  - Scripts: `boriel-kit.cjs`, `boriel-fixtures.cjs`, `next-fpga-fetch.cjs`, `next-fpga-path.cjs`,
    `next-fpga-comments.cjs`, `next-roms-check.cjs`, `build-doc-accuracy-photos.cjs`.
  - Tests: `test/spectrum-kit/kit.ts`, `test/main/boriel-install-service.test.ts`,
    `test/zxnext-hw/cpu/z80n-instructions.test.ts`, `test/vhdl/`, `test/wasm/`. The 84 other
    `test/zxnext-hw` hits are `vendor/next-fpga/<version>/src` citations in comments: the script
    rewrites them.
- Docs: `AGENTS.md` (Boriel BASIC, Next test harness, Next models), `.ai/boriel/` (`integration.md`,
  `updating.md`), `.ai/zxnext-models.md`, `vendor/boriel-basic/README.md`, `THIRD_PARTY_NOTICES.md`
  if it names the folder.
- Each developer moves their fetched trees once (`mv vendor/next-fpga/* dev/vendor/next-fpga/`,
  the same for `boriel-basic/kits` and `stage`) or fetches again; the commit message says so. Then
  delete the empty `vendor/`, or Git ignores it but the editor still shows it.
- Checks: `npm run next-fpga:fetch` lands in `dev/vendor/next-fpga/`, the comment patches apply,
  `npm run next-roms:check`, `npm run boriel:fixtures` finds the kit, the Boriel BASIC install in a
  running development build, `npx electron-builder --dir` with the compiler under `resources/`, and
  `npm test -- test/zxnext-hw test/vhdl test/spectrum-kit test/main/boriel-install-service.test.ts`.

### Step 7. `_input/` -> `dev/research/`

- 4671 files, so the `git mv` is large but mechanical; the rename keeps blame.
- Functional: `scripts/doc-shots/recipes/p-files.cjs` (`TAPES`), `scripts/doc-shots/recipes/zx81.cjs`,
  `test/cli/klive-run-e2e.test.ts`, `test/harness/zx81/session.ts`, the tests in `test/spectrum-hw`,
  `test/tvc-hw`, `test/z88dk`, `test/renderer`, the 14 files in `src/emu` (check which are paths and
  which are comments), `test/changesets/changes-lib.test.ts` (the no-changeset path list),
  `.gitattributes` if it names any.
- Docs: `AGENTS.md` (TVC and Enterprise research packs), `.ai/` notes.
- Checks: `npm run test:fast`, plus the slow-tier files that read research tapes
  (`npm test -- --project e2e-slow <those files>`).
- Worth deciding while here (separate from the move): `_input/` holds third-party PDFs and ROM
  disassemblies committed to a public repo. Whether all of them should be tracked is a question for
  the project author, not this plan.

### Step 8. `.docs/` -> `dev/patterns/`

- ~140 code files, nearly all comments (`see .docs/...`). Functional: any script or test that reads
  a `.docs` file (search `join(.*"\.docs"` and `".docs/`).
- Docs: `AGENTS.md` ("Project Context", the back end and debugger sections), `.ai/` notes.
- Checks: `npm run build:check`, `npm test`.

### Step 9. `.ai/` -> `dev/ai/`

- **Watch out (found during step 7):** the UI text `panels.rom.rule` names
  `.ai/rom-annotations/README.md`, in `src/common/i18n/locales/en/panels-media.json` and in every
  translated catalog and `.source.json`. Change the English entry only and let the translations come
  through `npm run i18n:todo` / `i18n:merge` (AGENTS.md: no hand-written translations); check what
  `npm run i18n:check` says about the stale ones before committing.

- ~590 code files, nearly all comments. Functional: the ROM annotation tools
  (`scripts/rom-annotations*.cjs`, `PROVENANCE.md`), `scripts/zxbasic-syntax-check.cjs`
  (`.ai/zxbasic-syntax/`), tests that read `.ai/kbasic/stdlib-api.json`, `npm run runtime:bundle`
  inputs, anything in `docs/authoring/`.
- Docs: `AGENTS.md` (every section), the `.github/workflows` comments.
- Checks: `node scripts/zxbasic-syntax-check.cjs`, `npm run runtime:bundle` produces no diff,
  `npm run test:fast`.

### Step 10. Prepare the scripts: one way to find the repo root (nothing moves)

65 of the 184 scripts find the repo root from their own folder (`join(__dirname, "..")`,
`resolve(__dirname, "../..")` for the nested ones, and variants). Moved one level deeper, each of them
would silently take `dev/` for the root and read or write in the wrong place. This step removes that
failure mode before anything moves.

- Add `scripts/repo-root.cjs`: walks up from its own folder to the first one holding the repo's
  `package.json` (name `klive-ide`, so `docs/package.json` never matches) and exports it.
- Switch every root computation to it. Find them with `git grep -n -E '__dirname' -- scripts` and
  review each hit: a `__dirname` that means "this script's own folder" (its templates, its
  recipes) stays.
- Before switching, record each script's resolved root (a throwaway run that requires each module's
  root expression); afterwards add `test/scripts/repo-root.test.ts`, which checks that the helper
  returns the folder holding `package.json`, and that no script under `scripts/` still contains
  `__dirname, ".."` (or the `../` forms) for the root.
- Checks: `npm test -- test/scripts`, then a smoke run of scripts that write files, each into a
  clean tree: `npm run change -- --show <a changeset>`, `npm run i18n:keys` (no diff),
  `npm run runtime:bundle` (no diff), `npm run doc:build` (it runs the doc asset scripts).

### Step 11. `scripts/` -> `dev/scripts/`

- `git mv scripts dev/scripts`; the helper from step 10 keeps every root right.
- Functional, all of which fail loudly when missed:
  - `package.json`: the 77 `node scripts/...` npm scripts (the `npm run` names stay the same).
  - `docs/package.json`: its one `../scripts/...` call becomes `../dev/scripts/...`.
  - `.github/workflows/`: 7 lines.
  - The 54 test files that import a script by relative path (`../../scripts/...`; mostly
    `test/wasm`, `test/zxSpectrum`, `test/harness`, `test/kbasic`): same depth, `dev/` inserted
    (`../../scripts/x` -> `../../dev/scripts/x`).
  - Scripts that call other scripts by path (`node scripts/...` inside `execSync`/`spawn` strings),
    and `.claude/launch.json` / `.vscode/tasks.json` / `.vscode/launch.json` if they name one.
  - The `scripts/cdp/` recipes named in `.ai/ui-theming-intent-and-lessons.md`.
- The rewrite matches `scripts/` only as a path start (start of a string, a backtick, `./`, `../`,
  a space after `node`), never the `"scripts"` key of a `package.json` or a word in prose.
- Docs: `AGENTS.md` (the import, screenshot, Boriel and ROM commands), every `.ai/` guide that gives
  a `node scripts/...` command, `docs/authoring/`.
- Checks: `npm run test:fast`, `npm run build:check`, `npm run lint:renderer`,
  `npm run doc:build && npm run doc:check`, `npm run i18n:check`, and the changeset-check and test
  workflows on the PR itself.

### Step 12. Local output folders into one ignored folder (optional, local only)

GitHub never shows these, but they fill the editor's tree. Move the tool-owned ones under one
ignored `.cache/` (or `.local/`):

| Folder | Written by |
|---|---|
| `.boriel-ide-check/` | `scripts/boriel-ide-check.cjs` |
| `.z88dk-ide-check/` | `scripts/z88dk-ide-check.cjs` |
| `.rom-annotations/` | `scripts/rom-annotations*.cjs` |
| `.spectrum-kit/` | `test/spectrum-kit/kit.ts` |
| `.visual-tests/` | `test/harness/zxnext/cli/run.ts` |
| `i18n-work/` | `scripts/i18n-todo.cjs`, `scripts/docs-i18n.cjs` |
| `.hallmark/` | nothing in the repo: find its owner (an external tool?) or delete it |

`out/` (electron-vite) and `artifacts/` (electron-builder's `directories.output`, also read by
`test/wasm/zxNext/wasm-next-*.test.ts`) stay: they are the build's conventional outputs. Update
`.gitignore`, the eslint `ignores`, and the guides that name these folders
(`.ai/doc-screenshots-guide.md`, `.ai/visual-tests-guide.md`, `src/common/i18n/locales/README.md`,
`docs/i18n/TRANSLATING.md`). Each developer moves or deletes their old local folders once.

### Step 13. `.plans/` -> `dev/plans/` (last)

- ~1230 code files, nearly all comments: the biggest rewrite, and it moves this plan with it.
- Functional: `build/e2e-tests.ts` and `build/electron.vite.config.ts` (comments only), any test that
  reads a plan file, `.github/workflows` (comments).
- Docs: `AGENTS.md` ("Feature Roadmap" names `.plans/CLOSING_THE_GAPS_PLAN.md` and
  `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md`), the cross-links between plans.
- Checks: `npm run build:check`, `npm test`.

### Step 14. Close the plan

- `git grep` for each old prefix (`.ai/`, `.docs/`, `.plans/`, `.changes`, `_input`,
  `_experiments`, `vendor/` and `scripts/` not preceded by `dev/`, `public/images/klive`): only `CHANGELOG.md` and this plan may still hit.
- `npm run test:all` (the slow tier too: plans about to complete run it), `npm run build:check`,
  `npm run lint:renderer`, `npx electron-vite build --config build/electron.vite.config.ts`,
  `npm run doc:build && npm run doc:check` (the docs site's authoring notes and links moved).
- Look at the repo's GitHub page: the README's first line should be on the first screen.
- One `internal` changeset describing the result; mark this plan done, then compact it to the
  as-built record (what moved where) per the repo's habit.
- Tell the people who keep memory or notes outside the repo (Claude Code memory, Copilot
  instructions in `.vscode/copilot/`) about the new paths.

## 7. Further options, not planned

If 19 still feels long, these are possible but each costs more than it saves:

- `build/` -> `dev/build/`: `build/` is electron-builder's default `directories.buildResources`, so
  that key would have to be set; every `--config build/...` in `package.json`, the tsconfig
  references, `test/harness/*/tsconfig.json` and every doc that names `build/e2e-tests.ts` move too.
  Saves one row.
- `CHANGELOG.md` / `THIRD_PARTY_NOTICES.md` into `dev/` or `docs/`: see R3.
