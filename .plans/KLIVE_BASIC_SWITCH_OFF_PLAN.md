# Switching Klive BASIC off in favour of Boriel BASIC (beta)

Status: **implemented** (2026-11-04). Decided by the project author. The debug-info check still warns on the Get Started program ("statements 2 and 3 overlap", a `ZXBC-D` warning): a beta issue for `BORIEL_BASIC_INTEGRATION_PLAN.md` §13.

## 0. Goal and decisions

BASIC programs (`.zxbas`/`.bas`) build only with **Boriel BASIC** (the bundled zxbc 2.x kit, a
**beta**). The switch between the two compilers is turned off by **commenting it out**, not deleting
it: the Klive BASIC compiler (`src/main/kbasic/`), its runtime, stdlib, tests and corpus stay in the
codebase and keep passing, so the switch can be turned back on by un-commenting.

| | Decision |
|---|---|
| S1 | The author makes Boriel BASIC the only compiler now. This **sets aside the readiness gate of `BORIEL_BASIC_INTEGRATION_PLAN.md` §11** on the author's decision; its open items (§13 there) stay open. |
| S2 | Every place that chooses the compiler is commented out, with a `// KLIVE-BASIC-OFF:` marker so they can all be found and restored. |
| S3 | The documentation names Boriel BASIC, not Klive BASIC, and says Boriel BASIC is in beta. |
| S4 | The Klive BASIC pages (the 9-page `reference/klive-basic/` and `guides/languages/klive-basic`) move off the site to `docs/authoring/klive-basic/`; their URLs redirect to the Boriel BASIC guide (`docs/redirects.json`). |
| S5 | The changed get-started pages are translated in this change through `doc:i18n:todo` / `doc:i18n:merge` (never by hand-editing `content/<lang>/`). The app's UI texts follow the app's own rule: English only here, the other languages come through `i18n:todo` / `i18n:merge` later. |
| S6 | The ZX Spectrum Next BASIC template becomes a plain program (no CODEBANK). |
| S7 | One `breaking` changeset. |

## 1. The app

1. **Compiler choice** (`src/main/zxb-integration/zxb-config.ts`): `compilerChoiceOf` always returns
   `"boriel"`; the setting-reading body is commented out. Both the main-process dispatcher and the
   renderer ask this function, so every build, background check and breakpoint-line question goes
   to Boriel. `ZxBasicDispatcher` keeps both compilers.
2. **Settings page**: the `basicCompiler` select row in `settings-pages.ts` is commented out; the
   Boriel BASIC install row stays.
3. **Setup dialog**: the "Use Boriel BASIC" checkbox is commented out of the view model and view;
   texts that offer Boriel "instead of Klive BASIC" are reworded (Boriel is what builds BASIC).
4. **Status bar**: it keeps naming the focused file's compiler, which is now always Boriel BASIC.
5. **UI texts** that name Klive BASIC as the compiler you build with (error stops, Just My Code, "no
   source-level debug information") are reworded in English. The Klive BASIC compiler's own message
   catalogue (`compiler-basic.json`) stays as it is.
6. **Templates** (`src/public/project-templates/*/zx-basic/`): headers name Boriel BASIC (beta); the
   Next template drops CODEBANK.
7. **Tests** that assert Klive BASIC as the default or the switch's behaviour are updated to the new
   behaviour; Klive BASIC's own tests (they call `KBasicCompiler` directly) stay unchanged.

## 2. The documentation (`docs/`)

1. Rewrite every English page that presents Klive BASIC as the compiler: get-started (first BASIC
   program, index, install, where next), the guides that mention it, the reference index and
   What's New. Boriel BASIC is named and marked as a beta, with a link to its own documentation.
2. `guides/languages/boriel-basic` becomes the one ZX BASIC guide (the beta note, installing the
   kit, the header options, what the debugger does with it).
3. Move the Klive BASIC pages to `docs/authoring/klive-basic/` and add their redirects; move every
   link to them (translations and `docs/landing/features.ts` included).
4. Landing page: the features and texts that sell Klive BASIC (`feature.basicDebug.*`, the
   "At a glance" values) name Boriel BASIC (beta).
5. Translations: `doc:i18n:todo` for es, pt-BR, pt-PT, de, hu; translate; `doc:i18n:merge`.
6. Screenshots: regenerate any `get-started`/guides shot that shows Klive BASIC with its
   `scripts/doc-shots/recipes/` recipe.

## 3. Records

- `AGENTS.md`: the Klive BASIC and Boriel BASIC sections say the switch is off and point here.
- `BORIEL_BASIC_INTEGRATION_PLAN.md`: §11 notes S1.
- `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` and `.ai/` notes that describe the BASIC story.

## 4. Verification

Focused tests, `npm test`, `npm run build:check`, `npm run lint:renderer`,
`npx electron-vite build --config build/electron.vite.config.ts`, `npm run doc:build && npm run doc:check`,
and `node scripts/boriel-ide-check.cjs` in the running app.

## 5. Turning Klive BASIC back on

Search for `KLIVE-BASIC-OFF:`, restore each commented block, move the pages back from
`docs/authoring/klive-basic/` and drop their redirects.
