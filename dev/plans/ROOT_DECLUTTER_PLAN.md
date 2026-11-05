# Decluttering the Workspace Root

Status: **done (2026-11-04).** The tracked root went from **31 entries to 19**. This file is the
as-built record; the step-by-step plan is in git history (`git log --follow` on this file).

## 1. Why

GitHub lists every root entry before the README. With 31 entries a visitor had to scroll a screen
to reach its first line. The root now holds only what tools, GitHub or convention need there.

## 2. The root now

```
.claude/  .github/  .vscode/
build/    dev/      docs/     src/      test/
.editorconfig  .gitattributes  .gitignore
AGENTS.md  CHANGELOG.md  LICENSE  README.md  THIRD_PARTY_NOTICES.md
package.json  package-lock.json  tsconfig.json
```

Why each stays: `.claude/`, `.github/`, `.vscode/`, the Git files, `README.md` and `LICENSE` are read
from the root by their tools or by GitHub; `AGENTS.md` is found there by other agents; npm needs
`package.json`; editors find `tsconfig.json` from `src/`, and `test/harness/*/tsconfig.json` extend
it; `CHANGELOG.md` and `THIRD_PARTY_NOTICES.md` are where readers look (R3). `build/` is
electron-builder's default resources folder and holds the vite, vitest, ESLint and tsconfig files.

## 3. What moved where

| Was | Is | Commit (step) |
|---|---|---|
| `CLAUDE.md` | `.claude/CLAUDE.md` (imports `../AGENTS.md`) | 1 |
| `.prettierrc.yaml` | the `"prettier"` key in `package.json` | 1 |
| `.prettierignore` | deleted (its entries were git-ignored, missing or the JSONC tsconfigs) | 1 |
| `eslint.config.cjs` | `build/eslint.config.cjs` (`--config`; `eslint.options` in `.vscode/settings.json`) | 1 |
| `public/images/` | `build/icons/` | 3 |
| `build/electron-builder.json5` | deleted: never part of a build | 3 |
| `_experiments/` | `dev/experiments/` | 4 |
| `.changes/` | `dev/changes/` | 5 |
| `vendor/` | `dev/vendor/` | 6 |
| `_input/` | `dev/research/` | 7 |
| `.docs/` | `dev/patterns/` | 8 |
| `.ai/` | `dev/ai/` | 9 |
| `scripts/` | `dev/scripts/` (step 10 first gave them one way to find the root) | 10, 11 |
| `.doc-shots/`, `.rom-annotations/`, `.visual-tests/`, `.spectrum-kit/`, `.boriel-ide-check/`, `.z88dk-ide-check/`, `i18n-work/` (local, ignored) | `.local/<name without the dot>/` | 12 |
| `.plans/` | `dev/plans/` | 13 |

Also on this branch, outside the numbered steps: `package.json`'s `build.files` became an allowlist
(`out/**/*`, `LICENSE`, `THIRD_PARTY_NOTICES.md`). It had been `**/*` minus exclusions, and the app
archive carried about 10,800 files it never used (`.ai/`, `.plans/`, `scripts/`, local scratch
folders, ...). That one is a user-visible `fix` with its own changeset.

## 4. Decisions

- **R1. The folder is `dev/`** (project author, 2026-11-04): visible, short, "for developers of
  Klive, not users". Rejected: `.dev/` (GitHub shows dot folders anyway), `meta/`, `contrib/`.
- **R2. `.docs/` became `dev/patterns/`**, so "docs" means the public site only.
- **R3. `CHANGELOG.md` and `THIRD_PARTY_NOTICES.md` stay at the root**: two rows are not worth
  breaking a convention readers rely on.
- **R4. No compatibility stubs or symlinks** at the old paths. History follows with
  `git log --follow`.
- **R5. Local tool output goes to `.local/`**, not `.cache/`: `.local/i18n-work/` holds translators'
  answers, which a "cache" name invites deleting. `.hallmark/` (an external tool's) and `out/`,
  `artifacts/` (the build's own outputs) stay where their tools put them.
- **R6. A developer-only folder goes in `dev/`**, never next to `src/` (now a rule in `AGENTS.md`).

## 5. What a move like this has to handle (lessons)

- **Rewrite references by resolving them, not by prefix.** A relative link (`../AGENTS.md`,
  `../../..` as a repo root) is right or wrong depending on the referencing file's depth. The
  moves were done by resolving each relative reference from the file's old location and
  recomputing it from the new one; in moved *code*, only Markdown links were recomputed, because
  a `"../x"` string there may be relative to the working directory, not the file.
- **A join segment rule misfires on object literals**: `{ dir: "scripts", ... }` became
  `{ dir: "dev", "scripts", ... }` (caught by review, step 11). Review every inserted segment.
- **Root-relative code that breaks silently**: scripts computed the root from `__dirname` and loaded
  TypeScript with `require("../test/...")`. Both now go through `dev/scripts/repo-root.cjs`
  (`REPO_ROOT`, which walks up to Klive's own `package.json`, never the docs site's), and
  `test/scripts/repo-root.test.ts` fails on either form.
- **Verbatim fixtures**: the Klive BASIC corpus programs (`test/kbasic/corpus/**/*.zxbas`) keep the old
  paths in their comments. `test/z80-backend/snapshot/` pins their diagnostics, and a longer path in
  a comment shifts every offset after it; re-recording is a reviewed change.
- **UI text**: `panels.rom.rule` and `commands.romAnn.imported` name `dev/ai/rom-annotations/...`.
  Only the English entries changed; the five translations show as outdated (20 -> 22 per
  language) until the next `i18n:todo` / `i18n:merge` round.
- **Generated files follow their generators**: the runtime bundles, the i18n files and the docs
  site's `_meta.ts` headers were regenerated or now match what the generator writes.
- **`git mv` of a whole folder renames it on disk**, so ignored downloads inside it (`dev/vendor/`'s
  kits and VHDL trees) came along locally. On another checkout they stay behind: see section 6.
- **Packaging**: `build.files` used to be `**/*` minus exclusions, so any new root folder was
  packed. It is an allowlist now, and `test/main/boriel-kit-script.test.ts` checks that it has no
  `**/*` and names nothing under `dev/`.

## 6. For another checkout of this branch

Git moves only tracked files. After pulling:

- move the ignored downloads `vendor/boriel-basic/{kits,stage}/` and `vendor/next-fpga/<version>/`,
  `vendor/next-fpga/.git-cache/` into `dev/vendor/...` and delete `vendor/`, or run
  `npm run next-fpga:fetch` and `npm run dev` (its `predev` fetches the Boriel kit) again;
- move the local output folders into `.local/` (drop the leading dot), or delete them;
- delete the empty `_input/`, `_experiments/`, `.ai/`, `.docs/`, `.plans/`, `.changes/`, `scripts/`
  and `public/` folders if anything ignored kept them alive (`.DS_Store` files do).

## 7. Checks run at the close

- `npm run test:all`: 1333 files passed, the slow tier included.
- `npm run build:check`, `npm run lint:renderer` (the 43 warnings that were there before),
  `npx electron-vite build`.
- `npm run doc:build && npm run doc:check`: routes, assets, links, highlighting, weight, prose,
  translations.
- The final tree packaged (`electron-builder --mac --arm64 --dir`, the compiler staged by the moved
  `prepackage` script): the archive holds only `out/`, `package.json`, `node_modules` and the
  licences; `resources/boriel` carries the kit. Its `klive run test/cli/fixtures/run48 --frames 10`
  picture is byte-identical to `expected-frame10.png` (the release workflow's check), and
  `klive test test/cli/fixtures/sp48` passes 4 of 4.
- The GUI was last driven on the allowlist build (before steps 5-13): both windows opened and the
  ZX Spectrum Next ran. On the final tree, a later instrumented launch would not answer on its
  debugging ports after an earlier forced kill of a test run (the main thread was idle in its event
  loop, so the app itself ran); a by-hand launch is the remaining GUI check.
- The jsdom test tier (171 files) could not start on the closing machine's Node 22.14: jsdom 30
  needs Node `^22.22.2 || ^24.15.0 || >=26` (its bundled undici, 22.19 or later), which
  `package.json`'s `engines` now states. On Node 22.23.4 (2026-11-05) `npm test` passed: 1475 files,
  the jsdom tier included.

## 8. Further options, not taken

- `build/` -> `dev/build/`: electron-builder's `directories.buildResources` would have to be set, and
  every `--config build/...`, the tsconfig references and `test/harness/*/tsconfig.json` move too.
  Saves one row.
- `CHANGELOG.md` / `THIRD_PARTY_NOTICES.md` into `dev/` or `docs/`: see R3.
