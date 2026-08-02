# Playwright Electron E2E Plan

## Goal

Introduce Playwright-based end-to-end tests that launch the real Klive Electron
application, exercise UI behavior, assert visible outcomes, and always close the
application. Tests must run with an explicitly supplied settings file so they never
read or overwrite a developer's normal `~/Klive/klive.settings` file.

The first vertical slice verifies that the About dialog displays the expected
application version.

## Current Findings

- The project has Vitest unit/component tests but no Playwright dependency, test
  project, or E2E command.
- The Electron entry point is `src/main/index.ts`; development builds load
  `out/main/index.js` and the renderer dev server through `electron-vite dev`.
- App settings are loaded before `app.whenReady()` in
  `src/main/settings-utils.ts`. `getSettingsFilePath()` is private and always
  resolves to `path.join(app.getPath("home"), "Klive", "klive.settings")`.
- `--showide` reliably requests the IDE window, while an empty settings file would
  otherwise show the first-start screen after initialization.
- The Help > About handler in `src/main/app-menu.ts` uses Electron's native
  `dialog.showMessageBox()` and formats the version with `app.getVersion()`.
  Native message boxes are outside the renderer DOM, so Playwright cannot make a
  portable assertion against their text.
- The renderer already has a managed dialog pattern documented in
  `.docs/dialog-pattern.md`; use it for a testable About dialog rather than adding
  a test-only native-dialog inspection mechanism.

## Target Design

### E2E test boundary

- Use the official `@playwright/test` runner and its Electron launcher, not a
  browser-only Playwright configuration.
- Launch the built Electron main bundle with `electron.launch()`, passing a unique
  per-test environment and launch arguments such as `--showide`.
- Run one E2E worker initially. Test launches set `KLIVE_E2E=1` to bypass Klive's
  production single-instance guard, while production/manual launches keep that
  guard. Its main process still owns shared app state, so parallel workers need
  isolated `userData`/settings behavior before they can be enabled safely.
- Treat an E2E case as responsible for both UI assertion and clean application
  shutdown. The shared fixture must also close the application in `finally` when a
  test fails.

### Isolated settings contract

Add a deliberately named environment override, for example
`KLIVE_SETTINGS_FILE`, interpreted by `getSettingsFilePath()`:

1. If it is unset, preserve the current default path exactly.
2. If it is set, require an absolute path and use it as the entire settings-file
   path.
3. Create only that file's parent directory (`mkdirSync(..., { recursive: true })`)
   before saving settings.
4. Keep the override process-local; do not persist its value into application
   settings or expose it in production UI.

The E2E fixture creates its own temporary directory and writes a minimal,
deterministic settings JSON before launch. It should set `startScreenDisplayed` to
`true`, specify small non-maximized window states, and avoid project/media paths.
The fixture passes the generated absolute file path in `KLIVE_SETTINGS_FILE` and
removes only its own temporary directory after the Electron process has exited.

### Testable About dialog

Replace the native About message box with a renderer-managed dialog that is opened
from the existing Help > About menu action through the established renderer IPC /
dialog path. Its content should include:

- a stable dialog name/role (`dialog`, accessible name `About Klive IDE`);
- a version line whose value is supplied by the main process from
  `app.getVersion()`;
- the existing Electron and OS details where appropriate;
- accessible Close and Visit website controls with the current behavior retained.

This is a production UX change made for cross-platform accessibility and E2E
observability, not a test-only backdoor. Use stable semantic selectors (role,
accessible name, and an explicit `data-testid` only for the version value if no
semantic selector can identify it). Do not assert styling, window coordinates, or
the Electron version.

## Proposed File Layout

- `playwright.config.ts` — dedicated E2E configuration, retry/trace/screenshot
  policy, serial workers, and an `e2e` test directory.
- `test/e2e/fixtures/kliveApp.ts` — typed Playwright fixture that prepares settings,
  launches Electron, waits for the requested renderer, and closes/cleans up.
- `test/e2e/fixtures/settings.ts` — minimal settings factory and temporary-path
  helpers; no production settings are referenced.
- `test/e2e/about.spec.ts` — first end-to-end smoke test.
- `src/main/settings-utils.ts` — explicit settings-file override support.
- `src/main/app-menu.ts` plus the smallest appropriate main-to-renderer message and
  renderer dialog files — renderer-managed About flow.

Names may be adjusted to match the established dialog registry, but new code should
follow `.docs/dialog-pattern.md` and use direct component imports.

## Small, Testable Implementation Steps

### Step 1: Establish the runner without changing app behavior

Status: completed.

- Add `@playwright/test` and Playwright's Electron-compatible runtime dependency.
- Add `test:unit` for Vitest-only execution, `test:e2e` for the Playwright project,
  and make `npm test` run `test:unit` followed by `test:e2e`.
- Add `playwright.config.ts` with `testDir: "test/e2e"`, one worker, a practical
  per-test timeout, retries only in CI, and failure diagnostics (`trace` and
  screenshot retained on failure).
- Add the browser/runtime installation instructions and CI cache note to the README
  or contributor testing documentation.

Verification:

- `npx playwright test --list` discovers the E2E project without starting Klive.
- Existing `npm test` behavior is unchanged.
- `npm run build:check` passes.

### Step 2: Add the settings-file override with unit coverage

Status: completed.

- Extract/export a narrow settings-path resolver if needed so it can be tested
  without importing Electron startup code.
- Implement `KLIVE_SETTINGS_FILE` as described in the isolated settings contract.
- Add `npm run e2e:app`, which launches the development app with an automatically
  generated isolated settings file. It also accepts
  `--settings-file /absolute/path/klive.settings` to launch with a case-specific
  file supplied by a developer or test harness.
- Add a reusable E2E settings-file factory that writes per-case settings and exposes
  the corresponding Electron launch environment. The future Playwright fixture
  passes this environment directly to `electron.launch({ env })`.
- Add node-environment tests for default-path preservation, valid absolute override,
  rejection or explicit error for a relative override, and parent-directory creation
  when saving.
- Do not overload `HOME`, `userData`, or the normal settings file in tests.

Verification:

- Focused settings tests pass.
- `npm run e2e:app` starts Klive without accessing the normal settings file; a
  provided `--settings-file` is used verbatim.
- A manual development launch without the override still reads the ordinary Klive
  settings location.
- `npm run build:check` passes.

### Step 3: Implement and test the renderer About dialog flow

Status: completed.

- Add the typed main-to-renderer request/dialog ID required to open About in the
  focused renderer window.
- Move the current About content generation into a small pure helper or typed payload
  builder, using `app.getVersion()` as the source of truth.
- Add the renderer dialog according to the existing dialog-provider pattern and
  register it in the relevant dialog host/registry.
- Change Help > About to request that dialog instead of invoking
  `dialog.showMessageBox`; preserve Close and Visit website semantics.
- Add focused renderer/unit tests for the displayed version, accessible dialog name,
  Close action, and menu-handler payload generation where the project conventions
  allow it.

Verification:

- Focused dialog/registry tests pass.
- `npm run lint:renderer` passes because renderer React code changed.
- `npm run build:check` passes.
- Manual smoke check: Help > About opens on both the EMU and IDE focused windows.

### Step 4: Build the reusable Klive Playwright fixture

Status: completed.

- In `beforeEach`/fixture setup, create a unique temporary directory, write minimal
  settings, and launch the Electron main bundle with `KLIVE_SETTINGS_FILE` and
  `--showide`.
- Wait for the IDE page by its query discriminator or a stable app-root readiness
  locator; do not depend on fixed sleeps.
- Provide helpers to obtain the IDE/EMU page and to trigger a main-menu item. The
  latter may use `electronApp.evaluate()` to locate the `help_about` menu item and
  invoke its production click handler, because OS application menus are not DOM
  elements. The assertion must remain renderer-visible.
- In teardown, call `electronApp.close()` and verify no app process is left; cleanup
  only the fixture-created directory. Ensure teardown still runs after assertion or
  startup failures.

Verification:

- A temporary diagnostic spec can launch, observe renderer readiness, close Klive,
  and leave the normal Klive settings file untouched.
- Running that spec twice proves settings and state do not leak between runs.

### Step 5: Add the About-version prototype E2E test

Status: completed.

- In `test/e2e/about.spec.ts`, launch Klive through the shared fixture.
- Open About through the fixture's main-to-renderer dialog helper. Native application
  menus are not renderer DOM elements, and Electron's programmatic `MenuItem.click()`
  does not reliably await this asynchronous menu action under automation.
- Assert that the accessible About dialog is visible and that its version element
  equals the expected version sourced from `package.json` (or a shared build-version
  helper if packaging requires it). The assertion should use `0.58.0` only through
  that source, never as a duplicated literal.
- Close the dialog through its accessible Close button and assert it disappears.
- Let fixture teardown close the IDE/application and remove the test settings.

Verification:

- `npm run e2e -- test/e2e/about.spec.ts` passes twice consecutively.
- The failure artifact includes a screenshot/trace when the expected version is
  intentionally changed.

### Step 6: Make the workflow maintainable and CI-ready

Status: completed.

- Add a CI job that installs dependencies plus the required Playwright browser/runtime
  dependencies, builds the Electron main/renderer bundles, then runs `npm run e2e`.
- Upload the Playwright report, trace, and screenshots when the job fails.
- Document local prerequisites, the E2E command, debugging (`--headed`, inspector,
  trace viewer), and the settings isolation guarantee.
- Keep the initial suite serial; add parallel execution only after each worker also
  receives an isolated Electron profile and any single-instance behavior is handled.

Verification:

- CI runs the About smoke test on the supported primary OS.
- A failed test exposes enough artifacts to reproduce the issue locally.

## Acceptance Criteria

- `npm run e2e -- test/e2e/about.spec.ts` launches the real Klive Electron app,
  opens About through its production main-to-renderer dialog route, asserts the renderer-visible
  current version, closes the dialog, and shuts down the app.
- E2E runs use a generated absolute `KLIVE_SETTINGS_FILE` and never modify the
  developer's default settings file.
- The suite is repeatable: two consecutive runs do not reuse window state, welcome
  state, projects, or settings from the prior run.
- Existing Vitest commands remain separate and green; touched renderer code is linted
  and the project type-check passes.
- Test failures retain actionable Playwright diagnostics and teardown does not leave
  Klive running.

## Deferred Work

- Broader smoke coverage (new project, machine startup, file operations) and
  regression-spec conventions should reuse the fixture after the first slice lands.
- Packaged-app E2E coverage can be added later; the initial suite targets the built
  development Electron bundle for fast feedback.
- Cross-platform native menu clicking is intentionally deferred. The initial test
  exercises the production main-to-renderer dialog route, while the assertion is
  made against the cross-platform renderer dialog.
