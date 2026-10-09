# Unit Tests from the Command Line and CI Plan

Status: **implemented** (2026-10-09): Phases 1–4 are done; §9 records what was built, the
departures and the findings. D1–D14 are the decisions; the author accepted the suggested answers to
all §8 questions, which the decisions already assume.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G5.6**: run the G5.5 tests without the UI
  (`klive test project/`), with exit codes and JUnit output.
- The **skeleton of a Klive command line**: one executable with verbs. `test` is the first verb.
  G6.1 (automation: build, run, read memory) adds further verbs to it later.

Builds on:
- [Z80_UNIT_TESTS_PLAN.md](Z80_UNIT_TESTS_PLAN.md) (G5.5). Its runner is designed Electron-free
  (its D6): it takes a compilation, a machine spec and ROM bytes, and it emits events. Discovery is
  pure. This plan only adds the process around it.
- [CODE_COVERAGE_AND_HEAT_MAP_PLAN.md](CODE_COVERAGE_AND_HEAT_MAP_PLAN.md) (optional): LCOV output
  for `--coverage`.

**A correction to the roadmap's dependency.** G5.6 is listed as "after G5.5 and G6.1". G6.1's hard
part, "a transport and a security model" to drive a *running* IDE, is not needed to run tests in
CI. CI has no running IDE, and starting one (a window, a GPU, a display server) is exactly what a
CI job should not do. This plan therefore runs **headlessly in a Node process** and depends on G5.5
only. G6.1 remains its own item: driving a live IDE from outside. It can reuse this CLI's argument
parsing and output conventions (D2, D3) (Q1).

Not in scope:
- Driving a running IDE (G6.1).
- `run` or `export` verbs. (`build` is in scope: D2, Q3.)
- A separate npm package of Klive. The CLI ships inside the installed app (D1). An npm distribution
  is §1.2.

---

## 1. What is being added, and why

DeZog's tests run only inside VS Code. There is no supported way to run them in CI. So "Z80 unit
tests in a GitHub Actions job" would be a first for Spectrum tools, and it needs only a thin layer
over G5.5:

1. **An entry point** that runs without opening a window, on macOS, Windows and Linux (including a
   Linux CI runner without a display).
2. **Project loading without the IDE.** Read `klive.project` (build root, machine, `unitTests`),
   resolve ROMs and tool paths (sjasmplus) from the project and from the command line, never from
   the user's IDE settings unless asked.
3. **A compile step without the renderer.** The Klive assembler is pure TypeScript in the main
   process. sjasmplus is spawned by `CliRunner`, and needs only its path.
4. **Reporters.** A human-readable console report, JUnit XML for CI dashboards, an exit code, and
   LCOV coverage.

### 1.1 Decisions

| # | Decision |
| --- | --- |
| D1 | **The executable is Klive's own Electron binary in Node mode.** Klive installs one app. Its binary runs as plain Node when `ELECTRON_RUN_AS_NODE=1` is set (the build configures no Electron fuses, so this is allowed). The CLI is a bundled script, `resources/cli/klive-cli.js` (outside the asar, D11), plus thin launchers installed next to it: `klive` (POSIX shell) and `klive.cmd` (Windows). Each sets the variable and executes the app binary with the script. **No window, no GPU and no display are needed.** `main/index.ts`, its single-instance lock and the IDE never run (T1). |
| D2 | **Command shape.** `klive <verb> [options]`. Verbs in this plan: `test`, `build` (`klive build [<project-dir>] [--out <file>]`: compile the build root only, for CI jobs that only assemble; Q3) and `--version`/`help`. `klive test [<project-dir>] [--filter <pattern>]... [--junit <file>] [--coverage <file.lcov>] [--reporter pretty\|plain\|tap] [--timeout <s>] [--machine <id>[:<model>]] [--sjasmplus <path>] [--rom <partition>=<file>]... [--bail] [--list]`. `<project-dir>` defaults to the current directory. Options override `klive.project`'s `unitTests` section; that section overrides the defaults. |
| D3 | **Exit codes.** **0** all selected tests passed. **1** at least one test failed or errored. **2** the build failed. **3** a usage or configuration problem (no project, no build root, no tests found with `--filter`, a missing ROM or sjasmplus). **4** an internal error (a crash, an unreadable WASM artifact). No tests in the project is exit code **3**, so a misconfigured job does not pass silently. With `--list`, the CLI prints the discovered tests and exits **0**. |
| D4 | **Reporters.** `pretty` (default on a TTY) shows suites, ✔/✘, T-states and failure messages with `file:line`. `plain` (default when not a TTY) is the same without colour or Unicode. `tap` is TAP 13. **JUnit** is written in addition to the console reporter when `--junit` is given (D7). |
| D5 | **The compile step uses the IDE's compilers directly.** The CLI calls the compiler registry (`compiler-integration/compiler-registry.ts`) with a **minimal `AppState`** built from the project file and the CLI options: project folder, build root, sjasmplus path, and the compiler settings stored in `klive.project`. The Klive assembler needs nothing else. sjasmplus is spawned through the existing `CliRunner`. Errors print as `file:line:col: error: message` (the gcc format, which CI annotators and editors recognise). |
| D6 | **Machine and ROMs.** The machine comes from the project (`klive.project`'s machine id and model, or `unitTests.machine`), overridable with `--machine`. ROMs that Klive ships come from the app's resources. User-supplied ROMs (TR-DOS, TC2048, the Next's SD image when a test needs it) come from `--rom`, or from paths in `klive.project`. The CLI **never reads the IDE's global settings file** unless `--use-ide-settings` is given (Q4), so a CI job behaves the same everywhere. |
| D7 | **The JUnit mapping.** `testsuites` (name = project, totals) holds one `testsuite` per G5.5 suite path (`name` = dotted path, `tests`/`failures`/`errors`/`skipped`/`time`). Each test is a `testcase` with `classname` = suite path (GitLab shows it), `name` = the `UT_` label in its original spelling, `file` and `line` of the label, and `time` in seconds (T-states ÷ clock; T2). A failed assertion becomes `<failure message="ASSERTION failed: A == 5 (A=$07)" type="assertion">` with `file:line` and the stop description as text. A stack guard, timeout, HALT-with-DI or setup failure becomes `<error type="stack-overflow\|stack-underflow\|timeout\|halt\|setup">`. LOGPOINT output goes to the case's `<system-out>`. Each case gets the property `tstates` (T-states are the real measure; `time` exists for dashboards). |
| D8 | **Coverage.** `--coverage <file>` turns on coverage in the runner (G5.5 D17) and writes **LCOV** with the coverage plan's exporter (its D16). Codecov, Coveralls and GitLab's coverage visualisation read it directly. `--coverage-format kcov` writes Klive's own format instead, which can be loaded into the IDE (`coverage load`) to inspect a CI run locally. |
| D9 | **Filtering and selection.** `--filter` takes the IDE's patterns (`Suite.*`, `*.UT_parse*`; G5.5 D16) and may repeat. Without it, `unitTests.include` from the project applies, then "all". `--bail` stops at the first failure (exit **1**). |
| D10 | **One process, sequential, deterministic.** The CLI runs the G5.5 runner **in-process** (no worker: the CLI *is* the worker) on one machine instance, in suite order. Results and T-states are identical across runs and OSes (G5.5 D20). A test proves the JUnit file is byte-identical between two runs, apart from the `timestamp` attribute, which `--no-timestamp` omits. |
| D11 | **Packaging.** The CLI is a separate Vite/esbuild entry (`src/cli/index.ts`) bundled to `out/cli/klive-cli.js`. electron-builder's `extraResources` copies it, the WASM artifacts it needs and the shipped ROMs to `resources/cli/`, **outside the asar** (T3). The launchers are generated per platform. On macOS the app bundle's binary is `Klive.app/Contents/MacOS/Klive`. The launcher resolves it relative to itself, so the CLI works wherever the app was installed. |
| D12 | **Putting `klive` on the PATH.** On macOS, **Klive → Install Command Line Tool…** creates a symlink in `/usr/local/bin`, with the system's own admin prompt, as VS Code's "Install 'code' command" does. On Windows, the installer adds the CLI folder to the user PATH (an NSIS option, default on). On Linux, the `.deb`/`.rpm` installs a `/usr/bin/klive` symlink, and the AppImage documents `--appimage-extract` or calling the launcher directly. The docs give a **GitHub Actions example** and a GitLab CI example that download the Linux build, unpack it and run `klive test --junit results.xml --coverage coverage.lcov` (Q5). |
| D13 | **The CLI's code layout keeps G6.1 open.** `src/cli/` contains `index.ts` (verb dispatch, help), `args.ts` (a small parser; no new dependency unless one is already in the tree), `project.ts` (loading `klive.project` without Electron; shared with `src/main/projects.ts` by moving its pure parts to `src/common/`), `headless/` (re-exports of G5.5's `HeadlessMachineFactory`), `reporters/` (pretty, plain, tap, junit) and `verbs/test.ts`. G6.1 adds `verbs/build.ts`, `verbs/run.ts` and its own transport without changing these. |
| D14 | **The IDE can write JUnit too.** The Test panel's context menu gets **Export results as JUnit…**, which uses the same reporter on the panel's last results. Locally produced files then match CI's. |

### 1.2 Out of scope, and the hooks left for later

- **An npm package** (`npx @klive/cli test`). It would need WASM artifacts and ROMs published to npm,
  plus a Node-only build (no Electron). D13's layout allows it later: the CLI already never imports
  Electron.
- **A Docker image** with Klive's CLI and sjasmplus preinstalled for CI. This is a natural follow-up
  once D12's examples exist.
- **Parallel suites across processes.** D10 is sequential for determinism and simplicity.
- **G6.1's verbs and transport.**

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| The runner and discovery | G5.5: `src/main/unit-tests/UnitTestRunner.ts`, `HeadlessMachineFactory.ts`, `src/common/unit-tests/discovery.ts` |
| Compilers | `src/main/compiler-integration/compiler-registry.ts`; `src/main/z80-compiler/Z80Compiler.ts`; `src/main/sjasmp-integration/SjasmPCompiler.ts` (needs `AppState`: project folder, settings), `sjasmplus-resolver.ts` l.28–45, `sjasmp-config.ts`; `src/main/cli-integration/CliRunner.ts` |
| Worker precedent (Node, no renderer) | `src/main/compiler-integration/compilerWorker.ts` |
| Project file | `src/main/projects.ts` (`builder.roots` l.478, type l.570); `src/common/structs/project-const.ts` |
| App entry and argv | `src/main/index.ts` (`requestSingleInstanceLock` l.118, `--noide` l.277, `second-instance` l.614–619) |
| WASM loading in Node | `*WasmV2Loader.ts` (`readArtifact` override), harness constructors |
| Packaging | `build/electron-builder.json5` (`asar: true`, `asarUnpack`), `build/electron.vite.config.ts` (main inputs l.29) |
| Coverage export | Coverage plan `src/renderer/features/coverage/lcov.ts`, which moves to `src/common/profile/` so the CLI can import it (it is pure) |
| App menu | `src/main/menus/` (Klive app menu on macOS for D12) |

---

## 3. The traps

1. **T1: The single-instance lock.** If the CLI ran through `main/index.ts`, a second Klive process
   would quit while the IDE is open, and `second-instance` ignores argv. D1's Node mode never loads
   `main/index.ts`, so the CLI and an open IDE coexist. A test spawns the CLI while a fake lock
   holder runs.
2. **T2: Time in JUnit.** JUnit's `time` is seconds. Emulated seconds (T-states ÷ clock) are
   deterministic. Wall seconds are not, and they would make the file differ on every run. D7 uses
   emulated time; the docs say so, and the `tstates` property carries the exact figure. The suite's
   wall time goes to the console summary only.
3. **T3: Reading WASM and ROMs from the asar.** Electron's Node mode can read asar archives, but the
   loaders' `fetch(new URL(...))` path does not apply. The CLI uses `readArtifact` with real file
   paths. Keeping the artifacts in `resources/cli/` outside the asar avoids relying on asar patching
   of `fs` in Node mode entirely. The cost is a duplicate of about 15 MB of WASM in the package, which
   Q6 asks about.
4. **T4: sjasmplus discovery in CI.** The IDE finds sjasmplus through settings. CI has none. Order:
   `--sjasmplus`, then the `SJASMPLUS` environment variable, then `sjasmplus` on the PATH. Failing
   all of these gives exit code **3** with a one-line fix.
5. **T5: Node version.** The bundled Node is Electron 44's, not the CI runner's, so the CLI behaves
   identically whatever Node the runner has. That is a reason to prefer D1 over a plain `node`
   script.
6. **T6: Unicode and colour in CI logs.** The default reporter switches to `plain` when stdout is
   not a TTY or `NO_COLOR`/`CI` is set.
7. **T7: macOS Gatekeeper and quarantine.** A downloaded app's binary run from a script may be
   quarantined. The GitHub Actions example uses the Linux build. The macOS docs note
   `xattr -d com.apple.quarantine` only for manual installs. The CLI itself does nothing special.
8. **T8: Exit code of a crashed WASM.** An `unreachable` trap in a core must surface as exit
   code **4** with the failing test's name, not as a Node stack trace with exit code 1 that looks like
   a test failure. The runner wraps each test, and the reporter prints a crash as an `<error
   type="internal">`.

---

## 4. Design

```
src/cli/
  index.ts          # parse verb, dispatch, map errors to exit codes (D3)
  args.ts
  project.ts        # klive.project → { buildRoot, machine, unitTests, compilerSettings }
  appState.ts       # the minimal AppState for the compiler registry (D5)
  roms.ts           # shipped ROMs + --rom + project paths (D6)
  verbs/test.ts     # compile → discover → run → report
  reporters/{pretty,plain,tap,junit}.ts
```

`verbs/test.ts` works in five steps:
1. Load the project.
2. Compile the build root, mapping errors to exit code 2.
3. Run `discoverUnitTests`, mapping its problems to exit code 3.
4. Run `UnitTestRunner.run` in-process, streaming events to the console reporter and collecting
   them for JUnit.
5. Write JUnit and LCOV, then exit with D3's code.

---

## 5. Phases

| Phase | Work | Done when |
| --- | --- | --- |
| 1 | `src/cli/` with `test`, `build` and `--list`; the pretty, plain and JUnit reporters; the project loader; the minimal AppState; dev launch via `npx electron` with `ELECTRON_RUN_AS_NODE` | `node` tests: argument parsing, exit-code mapping, the JUnit golden (failure/error types, escaping, file/line), D10 byte-identity; an e2e test runs the CLI on a 48K fixture project (Klive asm) and checks exit codes 0, 1, 2 and 3 |
| 2 | Packaging (D11), launchers, `extraResources`; sjasmplus discovery (T4) | A packaged build on each OS in CI runs `klive test` on the fixture; an sjasmplus fixture runs where sjasmplus is installed |
| 3 | `--coverage` (LCOV, kcov), TAP reporter, D14 IDE export | The LCOV golden; the IDE's JUnit export equals the CLI's for the same project |
| 4 | PATH installation (D12), docs with GitHub Actions and GitLab examples, roadmap and competitive analysis | `docs/content/working-with-ide/unit-tests-cli.mdx` (or a section of `unit-tests.mdx`); the examples run in this repository's own CI against the fixture project; §7 updates |

---

## 6. Tests

- **Pure** (`test/cli/`): args, project loading (missing fields, overrides), every reporter (goldens,
  XML escaping of labels and messages, T2 time conversion), exit-code mapping.
- **E2e** (listed in `build/e2e-tests.ts`): spawns the CLI on fixture projects under
  `test/cli/fixtures/` (passing, failing, build error, no tests, timeout, crash via a deliberately
  broken artifact path for exit code 4).
- **Packaging smoke** (CI only): the packaged app's launcher runs `klive --version` and the fixture
  project on Linux, macOS and Windows runners.

---

## 7. Effort and the standing rule

**M**, as the roadmap says: about two weeks. Phase 1 takes a week, packaging and the PATH installers
most of the rest, and docs with CI examples a couple of days. The roadmap's G6.1 dependency is
removed (see the correction above).

When it lands:
- mark G5.6 done in [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md), and change G6.1's row to
  say that the CLI exists and that G6.1 adds verbs and a live-IDE transport to it;
- update [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) §2 (the "Unit
  tests / code coverage / profiler" row: tests in CI with JUnit and LCOV, which no other Spectrum
  tool has) and §4 (W3; also W6's "no external API", which this narrows but does not close).

No visual change except one menu item; no theming notes are needed.

---

## 8. Questions (all answered, 2026-10-08: the suggested answers)

1. **Q1: Decouple from G6.1?** Suggested yes (the correction above): G5.6 runs headlessly and ships
   the CLI skeleton, and G6.1 later adds verbs and a transport to a running IDE. The alternative
   keeps the roadmap's order and waits for G6.1's security model, which CI does not need.
2. **Q2: The executable's name.** `klive` (suggested) or `klive-cli`? `klive` is shorter. It could be
   confused with launching the IDE, so `klive` with no verb prints help, and `klive ide` (a later
   verb) could open the app.
3. **Q3: A `build` verb now?** It is nearly free, because D5 already compiles. Suggested: add
   `klive build [--out <file>]` in Phase 1 for CI jobs that only assemble, or leave it to G6.1 to
   keep this plan's scope strict.
4. **Q4: IDE settings in the CLI.** Suggested: never by default (D6), with `--use-ide-settings` for
   local use (sjasmplus path, user ROMs). The alternative, reading them by default, makes local runs
   convenient but CI and local behaviour differ.
5. **Q5: The CI story.** Suggested: document downloading the Linux release in GitHub Actions and
   GitLab (D12). A published action (`klive/setup-klive`) or a Docker image would be smoother.
   Should either be in scope?
6. **Q6: Duplicate WASM outside the asar.** Suggested: yes, about 15 MB extra (T3), for a CLI that
   does not rely on asar patching. The alternative is to rely on Electron's asar support in Node
   mode and save the space, verified in Phase 2.

---

## 9. Implementation notes (2026-10-09)

### What was built

- **The verbs** (`src/cli/`, on the skeleton G6.1's live half had started): `verbs/test.ts`
  (compile → discover → run in-process → report, D3's exit codes), `verbs/build.ts` (`--out` as a
  flat binary or Intel HEX), `project.ts` (`klive.project` without Electron, the build root's
  language), `compile.ts` (the minimal `AppState`, T4's sjasmplus search, gcc-format diagnostics),
  `headless.ts` (the machine, ROM overrides, finding the cores and ROMs), `coverage.ts` (LCOV and
  `.kcov`) and `reporters/` (pretty, plain, TAP). `run-cli.ts` dispatches `test` and `build`.
- **Shared code**: the JUnit writer is `src/common/unit-tests/junit.ts`, used by the CLI and the IDE
  (D14). `coverageModel.ts` (with `lcovFilesOf`) moved from `src/renderer/features/coverage/` to
  `src/common/profile/` so the CLI builds LCOV with the IDE's code. The runner's summary carries
  `clockHz`, the run's clock, for JUnit's `time` (T2).
- **The IDE**: `test-junit <file> [-notimestamp]` and the Test panel's **Export results as
  JUnit...**; **Klive IDE › Install Command Line Tool...** (`src/main/cli-install.ts`).
- **Packaging**: `build/cli/klive` and `klive.cmd`, copied to `resources/cli` by package.json's
  `extraResources`; `build/installer.nsh` (the user PATH entry, D12); smoke steps in
  `release-artifacts.yml` that run the packaged launcher on the fixture project on Windows, Linux x64
  and macOS arm64.
- **Docs**: `docs/content/working-with-ide/unit-tests-cli.mdx` with the GitHub Actions and GitLab
  examples; `test-junit` in the commands reference; the automation page's launcher note updated.
- **Tests**: `test/cli/test-verb.test.ts` (unit tier: the JUnit golden, escaping, error types,
  reporters, the project loader and option precedence, T4's order, the code writers, dispatch),
  `test/cli/klive-test-e2e.test.ts` (e2e tier: the fixture projects under `test/cli/fixtures/` on
  the real 48K core - exit codes 0–4, JUnit, D10's byte identity, `--bail`, TAP, LCOV and `.kcov`,
  `--rom`, `klive build`, and the IDE's export equal to the CLI's file),
  `test/unit-tests/unit-test-junit-export.test.ts`, `test/main/cli-install.test.ts` and a menu
  structure check.

### Departures from the decisions

- **The bundle is `out/main/cli.js`, inside the asar** (D11 named `out/cli/klive-cli.js` outside
  it). G6.1's live half had already made the CLI an extra input of the main build, which shares
  chunks with the main bundle, so the file cannot be copied out alone. Electron's Node mode reads the
  asar (verified with a packaged macOS build), and the launchers run the bundle from
  `resources/app.asar/out/main/` (or `app/` where the build has no asar, as on Windows).
- **No duplicate WASM (Q6):** the packaged app already ships every core in `resources/wasm/<core>/`
  and the ROMs in `resources/roms/`, outside the asar (package.json `extraResources`), so the CLI
  reads those (T3 holds without the 15 MB copy). `findWasmArtifact` now tries a resources folder
  first, which the IDE's own unit-test worker uses too.
- **`--rom <name>=<file>`**, not `<partition>=<file>`: a machine loads ROMs by file name
  (`roms/sp128-0.rom`), so `<name>` is the ROM it replaces. The project's `unitTests.roms` maps names
  to paths relative to the project folder.
- **Windows PATH**: always added, without an installer checkbox (D12's "option, default on"); the
  uninstaller removes it. The NSIS script compiles with makensis (ANSI; the cached macOS makensis
  crashes on any Unicode script, a host problem) but an installer was not run on Windows.
- **Linux**: the project builds only an AppImage, so there is no `.deb`/`.rpm` symlink; the docs give
  `--appimage-extract` and the launcher's path, as D12 allows for the AppImage.
- **T1's lock-holder test** was not written: the CLI never loads `main/index.ts`, so there is no lock
  to contend for; the packaged smoke steps run the launcher, which is the part that could regress.
- **A crashed core (T8)** is caught by the verb, not inside the runner: the running test becomes an
  `<error type="internal">` and the exit code is 4.
- **The repository's push CI** runs the CLI in-process (`npm run test:all`); the packaged launcher
  runs in the release workflow, which is where packages are built.

### Findings

- **`Pasta80Compiler` read `mainStore`** although it is handed the same state through
  `setAppState`. That pulled `electron` into every bundle that uses the compiler registry - the CLI's
  included, where Node mode has no `electron` module in a packaged app. It now reads `this.state`.
- **Piping the CLI into `head`** ended with an EPIPE stack trace; the entry point now leaves quietly
  when its reader closes the pipe.
- A compiler's `startColumn` is 0-based; the gcc format writes columns from 1.
