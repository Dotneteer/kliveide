# Klive BASIC is switched off: how to turn it back on

Since 2026-11-04 Boriel BASIC (the bundled zxbc 2.x, a beta) builds every BASIC program
(`.zxbas`/`.bas`). The project author decided it, before the Boriel readiness gate passed
(`dev/ai/boriel/technical-debt.md`). Klive BASIC is **switched off, not deleted**: the compiler
(`src/main/kbasic/`), its runtime, stdlib, tests and corpus stay in the codebase and keep passing, and
`ZxBasicDispatcher` still holds both compilers. The switch is commented out at every
`KLIVE-BASIC-OFF:` marker. **The whole change is one commit, `fe2da21b53`** ("Switch Klive BASIC
off"): `git show fe2da21b53` is the complete list of what to restore, and the plan that described it
is in git history (`dev/plans/KLIVE_BASIC_SWITCH_OFF_PLAN.md` before the plan was closed).

Turn it back on only when the developer asks. Klive BASIC's provenance rule still applies
(`AGENTS.md`, "Klive BASIC").

## What was decided

- The switch is commented out so it can be found and restored: `grep -rn "KLIVE-BASIC-OFF" src scripts test`.
- User-facing texts and docs name Boriel BASIC (a beta) only.
- The Klive BASIC doc pages left the site (`docs/authoring/klive-basic/`) and their URLs redirect to the
  Boriel BASIC guide.
- The ZX Spectrum Next BASIC template became a plain program (no CODEBANK).
- It shipped as one `breaking` changeset.

## Turning it back on

1. **The compiler choice.** `src/main/zxb-integration/zxb-config.ts`, `compilerChoiceOf`: restore the
   two commented lines (`boriel` or `zxbc` selects Boriel, anything else Klive BASIC) and drop
   `return "boriel"`. The main-process dispatcher and the renderer both ask this function, so builds,
   background checks and breakpoint-line questions follow it. `zxbasic.compiler` is then read again,
   and the default is `klive`: decide with the author whether it stays so.
2. **Settings.** `src/common/settings/settings-pages.ts` (around line 1220): uncomment the
   `basicCompiler` select row (Settings › Integrations); its texts are in the catalogue already.
3. **The setup dialog.** `BorielSetupViewModel.ts`: `useBoriel.visible` back to
   `installation?.kind === "working"`; un-comment the checkbox in the view; reword the texts that were
   changed to say Boriel is what builds BASIC (they offered Boriel "instead of Klive BASIC").
4. **Tests.** Restore what the markers say in `test/settings/settings-pages.test.ts`,
   `test/dialogs/boriel/BorielSetupController.test.ts` and `test/kbasic/compiler.test.ts` (the
   dispatcher test "hands every request to Boriel BASIC" goes back to testing the switch), and the
   switch checks kept commented out in `dev/scripts/boriel-ide-check.cjs` (`ui` part). Klive BASIC's own
   tests call `KBasicCompiler` directly and never changed.
5. **UI texts.** The English texts that named Klive BASIC as the compiler you build with (error stops,
   Just My Code, "no source-level debug information") were reworded; `git show fe2da21b53 --
   src/common/i18n` shows which. The other languages come through `npm run i18n:todo` /
   `i18n:merge`, never by hand.
6. **Templates** (`src/public/project-templates/*/zx-basic/`). Their headers name Boriel BASIC (beta).
   The Next template lost CODEBANK; its old version is the test fixture
   `test/kbasic/codegen/fixtures/next-codebank-template.zxbas`. Decide per template which compiler it
   targets, because a template that builds under both is easier to keep.
7. **Docs** (`docs/`).
   - Move the pages back from `docs/authoring/klive-basic/` (`guide.mdx` →
     `content/en/guides/languages/klive-basic.mdx`, `reference/` → `content/en/reference/klive-basic/`),
     remove their ten entries from `docs/redirects.json`, restore the `_meta.ts` entries, and move the
     links back (translations and `docs/landing/features.ts` included).
   - Rewrite the get-started pages, guides, the reference index and the landing texts
     (`feature.basicDebug.*`, "At a glance") that were changed to name Boriel BASIC. The translations
     go through `npm run doc:i18n:todo` / `doc:i18n:merge` (`docs/i18n/TRANSLATING.md`).
   - Regenerate the screenshots that show BASIC with the `dev/scripts/doc-shots/recipes/` recipes.
8. **Records.** `AGENTS.md` ("Klive BASIC", "Boriel BASIC": remove "switched off"),
   `dev/ai/boriel/README.md` and `integration.md` (decision B1: the setting works again), `dev/ai/README.md`,
   and `dev/plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` §2 (the editor row says Klive BASIC's symbol
   intelligence is off with it). Add a changeset.

## Verify

Focused tests, `npm test`, `npm run build:check`, `npm run lint:renderer`,
`npx electron-vite build --config build/electron.vite.config.ts`,
`npm run doc:build && npm run doc:check`, and `node dev/scripts/boriel-ide-check.cjs` plus
`node dev/scripts/kbasic-ide-check.cjs` in the running app.

## What is not affected while it is off

The Klive BASIC compiler and its tests (`test/kbasic/`, the corpus, the sp48 and zxnext harness
programs), the shared Z80 back end, and the source-level debugger: the debugger is language-neutral.
