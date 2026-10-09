# Z80 Unit Tests Plan: DeZog-Compatible Tests, a Headless Runner and a Test Panel

Status: **implemented** (2026-10-08), Phases 0–4. D1–D20 are the decisions; the author accepted the
suggested answers to all §8 questions. §9 records the findings, the departures and what is left.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G5.5**: Z80 unit tests that are
  **DeZog-compatible** (decision D3), so DeZog unit-test projects run in Klive unchanged. This works
  with both the Klive assembler and sjasmplus. A runner sets up the machine headlessly, calls each
  test, checks the results and reports pass/fail in a Test panel with click-to-source. A failing
  test can be debugged.
- The runner is built **Electron-free** (D6). [UNIT_TESTS_CLI_PLAN.md](UNIT_TESTS_CLI_PLAN.md)
  (G5.6) can then run it from a command line without the IDE.

Builds on:
- [LOGPOINTS_PLAN.md](LOGPOINTS_PLAN.md) and
  [ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md](ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md) (G1.4/G1.5).
  DeZog's assertion macros signal failure through `ASSERTION` comments, and Klive already turns
  those into conditional breakpoints evaluated in C, with value-reporting stop messages
  (`describeCommentStop`). That plan explicitly left the `UNITTEST_*` conventions to this one.
- The test harnesses (`test/harness/sp48/`, `test/harness/zxnext/`). They prove that every WASM
  machine runs in plain Node with `readArtifact`, and that "call a routine and stop on return" and
  "continue to a breakpoint" are a few lines over `executeMachineFrame`.
- [CODE_COVERAGE_AND_HEAT_MAP_PLAN.md](CODE_COVERAGE_AND_HEAT_MAP_PLAN.md) (optional): "Run tests
  with coverage" (D17).

Provenance (roadmap decision D3): only DeZog's **conventions** are adopted: label names, macro
names and their documented meaning, and the shape of a test program. They are described in Klive's
own words. No DeZog code is copied, and that includes its `unit_tests.inc`. The macro include that
Klive ships for its own assembler (D4) is written from scratch from the documented behaviour.
sjasmplus users keep the include they already have in their DeZog project (D5).

Not in scope:
- A test framework beyond DeZog's. There are no fixtures, parametrised tests or mocks; §1.2 keeps
  hooks for some.
- Tests in Klive BASIC. That is a natural follow-up with the same runner. The BASIC compiler would
  need its own `UT_` convention, which DeZog does not define (Q8).
- Running tests on real hardware (G6.4).

---

## 1. What is being added, and why

DeZog is the only Spectrum tool with unit tests, and its users cite them often. Here is its model,
from its documentation (UnitTests.md):

- **A test case** is a subroutine whose label (its last dotted segment) starts with `UT_`. It ends
  with the `TC_END` macro instead of `RET`. Suites follow the label hierarchy (sjasmplus modules and
  dotted names).
- **Setup.** The program includes DeZog's macro file and invokes `UNITTEST_INITIALIZE` once. That
  macro lays down:
  - a small private stack (50 words) with the labels `UNITTEST_STACK_BOTTOM` / `UNITTEST_STACK`;
  - a start point `UNITTEST_START` (interrupts off, then the user's own init code, ending in `RET`);
  - a wrapper `UNITTEST_TEST_WRAPPER` that disables interrupts, loads SP and calls the test through a
    patchable `CALL` at `UNITTEST_CALL_ADDR`;
  - a success loop `UNITTEST_TEST_READY_SUCCESS`, which `TC_END` jumps to.
- **Assertions** are macros, for example:
  - `TEST_MEMORY_BYTE addr, value`, `TEST_MEMORY_WORD`;
  - `TEST_STRING addr, string, term0`, `TEST_STRING_PTR`, `TEST_MEM_CMP addr1, addr2, count`;
  - `TEST_FLAG_Z`/`_NZ`, `TEST_FAIL`;
  - `TEST_UNCHANGED_<regs>` against the values loaded by `DEFAULT_REGS`; `USE_ALL_REGS` fills
    every register.

  Each ends in an instruction carrying an `ASSERTION <expr>` comment, and a failing assertion stops
  there. Memory checks load values into registers first, because DeZog's ASSERTION expressions read
  registers and labels only.
- **A test fails** when:
  - an assertion fails;
  - any other breakpoint is hit, such as an ASSERTION elsewhere or a WPMEM guard (the private
    stack's two ends are guarded against overflow and underflow);
  - it times out (`unitTestTimeout`, 1 s by default, not applied while debugging).
- **Running.** Load the program; run the init code from `UNITTEST_START`; patch the test's address
  into the `CALL`; run the wrapper. In debug mode the run stops at each test's first instruction
  unless `startAutomatically` is set.
- **Tooling.** Tests appear in VS Code's Test Explorer with Run and Debug per test or suite.

Klive already has most of the moving parts:
- ASSERTION/WPMEM/LOGPOINT annotations from both assemblers, evaluated in the cores;
- a debugger;
- a "Testing" activity in the IDE's activity bar that has **no panels yet**;
- harness code that runs machines headlessly.

Four things are missing:

1. **Discovery.** Find `UT_` labels and the `UNITTEST_*` labels in a compilation, with their suites.
2. **The runner.** Run each test on a fresh machine, deterministically and fast, and classify the
   outcome.
3. **Klive assembler compatibility.** The Klive assembler's macro syntax differs from sjasmplus's
   (`Name: .macro(a,b)`, `{{a}}`, invocations need parentheses; `#include` instead of `include`).
   So DeZog's sjasmplus include cannot be used unchanged with it (D4).
4. **UI.** A Test panel, Run/Debug actions, results with click-to-source, and failure messages with
   values.

### 1.1 Decisions

| # | Decision |
| --- | --- |
| D1 | **Label conventions are DeZog's, exactly.** A test is any code label whose last segment starts with `UT_` (case-sensitive on the original spelling, T3). Suites come from the label's module/dotted path: `Module1.UT_test2` gives suite `Module1`. A label at the root is in the project's root suite. A test is valid only if the compilation also defines `UNITTEST_TEST_WRAPPER`, `UNITTEST_CALL_ADDR`, `UNITTEST_TEST_READY_SUCCESS` and `UNITTEST_START`. If they are missing, the panel shows one actionable error ("include the unit-test macros and invoke `UNITTEST_INITIALIZE`") instead of listing tests that cannot run. `UNITTEST_STACK_BOTTOM`/`UNITTEST_STACK` are optional: without them, the stack guards (D9) are skipped with a note. |
| D2 | **The runner relies on labels, not on macro internals.** Klive never parses or rewrites the macros. It needs the labels of D1 and the ASSERTION annotations the assemblers already produce. Any include that lays down those labels with DeZog's documented meaning works: DeZog's own include, the Savannah variant, Klive's include (D4) or a user's port. |
| D3 | **Per-test procedure** (DeZog's documented order, executed by Klive's own code): (1) restore the **base state** (D7); (2) run the init code: push a sentinel return address, set PC to `UNITTEST_START`, run until PC equals the sentinel; (3) write the test's address into the two bytes at `UNITTEST_CALL_ADDR + 1`; (4) set PC to `UNITTEST_TEST_WRAPPER` and run until an outcome (D8). Step (2) runs before **every** test, as DeZog's docs say the init code does. Each test therefore sees the same state, whatever the previous test did. |
| D4 | **Klive ships an include for its own assembler, written from scratch: `unit_tests.kz80.asm`.** It defines the same labels (D1) and the same macro names and parameters (`UNITTEST_INITIALIZE`, `TC_END`, `TEST_MEMORY_BYTE`, `TEST_MEMORY_WORD`, `TEST_STRING`, `TEST_STRING_PTR`, `TEST_MEM_CMP`, `TEST_FLAG_Z`, `TEST_FLAG_NZ`, `TEST_FAIL`, `TEST_UNCHANGED_*`, `DEFAULT_REGS`, `USE_ALL_REGS`) in Klive syntax. Invocations therefore read `TEST_MEMORY_BYTE($8000, 5)`. It is added to a project by **Testing → Add unit-test support** (or the `test-init` command), which writes the file into the project and an `#include` line into the build root. It is not hidden inside the IDE, so users can read and adapt it, as DeZog intends with its own. |
| D5 | **sjasmplus projects run unchanged.** A DeZog project already has `include "unit_tests.inc"` and `SLDOPT COMMENT …, ASSERTION`. Klive reads its tests through the SLD (`L`/`F` lines for labels, `K` lines for ASSERTIONs). The existing LP002 warning ("ASSERTION in source but no SLD K line, add SLDOPT") already covers the one setup mistake. **Testing → Add unit-test support** on an sjasmplus build root writes Klive's own **sjasmplus-syntax** include (`unit_tests.inc`, written from scratch as in D4) only if the project has none, so a fresh project also needs no download from DeZog (Q2). |
| D6 | **The runner is a pure, Electron-free module: `src/main/unit-tests/`.** Its inputs are a compilation result (`AssemblerOutput`/sjasmplus output), the machine id and model, the ROM/firmware bytes and the options. Its output is a stream of `TestEvent`s. It creates the machine the harness way: the `*WasmV2Machine` class with `readArtifact`, `DebugSupport` and `connectConditionSupport`. It runs in a **`worker_threads` worker** started from the main process, the pattern of `compiler-integration/runWorker.ts`. Tests therefore never block the IDE, never touch the user's emulator, and G5.6 runs the same module from a CLI (§4.2). |
| D7 | **The base state is a booted machine image, taken once per run.** The runner resets the machine, optionally runs it to the model's ROM main loop (the same `ReachExecPoint` the injection flow uses, so programs that call ROM routines find initialised system variables), loads every segment of the program, including banked segments (T5), and captures the whole WASM image (`captureWasmImage`, G2.6). Each test then starts from `restoreWasmImage`, which takes milliseconds. The project setting `unitTests.boot` chooses between `"rom"` (default for Spectrum models) and `"none"` (reset only, for Next programs that page out the ROM). |
| D8 | **Outcomes, as JUnit later needs them.** **passed:** PC reaches `UNITTEST_TEST_READY_SUCCESS`. **failed:** an ASSERTION stops, either in an assertion macro or anywhere else in the program; the message is `describeCommentStop`'s text ("ASSERTION failed at file:line: A == 5 (A=$07)"). **error (stack):** a stack guard watchpoint fires (D9). **error (breakpoint):** a WPMEM watchpoint fires, or the CPU hits HALT with interrupts disabled ("test halted with DI: it can never continue"). **error (timeout):** the T-state budget runs out (D10). **error (setup):** the init code did not return. The runner also records each test's **T-states**, which DeZog cannot measure. |
| D9 | **Stack guards** are two 2-byte read/write watchpoints, at `UNITTEST_STACK_BOTTOM` (overflow) and at `UNITTEST_STACK` (underflow: a test that `RET`s instead of `TC_END`). These are the WPMEM-style range watchpoints G1.5 already supports, installed by the runner with the owner `{kind: "unitTest"}` so they never appear in the Breakpoints panel. An underflow message says "UT_x returned with RET; end a test with TC_END". |
| D10 | **The timeout is in emulated T-states, not wall time.** The default is **one emulated second** at the machine's clock: 3,500,000 T on the 48K; on the Next, the clock at its *current* speed, measured in 28 MHz ticks. It is configurable as `unitTests.timeout` in seconds, as DeZog's `unitTestTimeout` is. A result is then the same on a fast laptop and on a slow CI runner (Q4). While debugging there is no timeout, as in DeZog. |
| D11 | **Annotations are always on during tests**, as in DeZog: ASSERTION, WPMEM and LOGPOINT. The runner installs them from `debugAnnotations` with `annotationBreakpoints` regardless of the project's per-kind switches. LOGPOINT output goes into the test's log (`system-out` in JUnit), not into the Emulator pane. The user's **own IDE breakpoints are ignored in Run** and honoured in **Debug** (Q5). DeZog's wording "any breakpoint fails the test" refers to annotation breakpoints, which this covers. |
| D12 | **Debug a test runs in the emulator, not in the worker.** **Debug** on a test (or a suite) uses the user's emulator through `MachineController`. A new injection-flow step `RunUnitTest` performs D3 on the live machine: base state by the normal inject, init code run as a subroutine, call address patched. It then starts the debugger at `UNITTEST_TEST_WRAPPER`, with a one-shot breakpoint at the test's first instruction (DeZog's `startAutomatically: false` behaviour; the setting `unitTests.stopAtStart`, default on). Reaching `UNITTEST_TEST_READY_SUCCESS` stops with "UT_x passed". In a suite, **Continue** goes on to the next test. All of reverse debugging works inside a test. |
| D13 | **The Test panel lives in the existing Testing activity.** `ACTIVITY_TEST_ID` (`registry.ts` l.184) gets its first panel, **Unit Tests**: a tree of suites and tests with a status icon, T-states and a message line, a filter (`PanelFilter`), and a header with Run All, Run Failed, Debug and Stop. A badge shows the failure count. A click on a test goes to its label's definition. A click on a failure goes to the failing line. The context menu has Run, Debug, Copy result and Reveal in Disassembly. Rows are `DataRow`s in a `VirtualizedList` with `ch` widths and token colours (`--status-success`/`--status-error`). |
| D14 | **Discovery follows the build.** After every successful build of the build root (`compileCode`), the panel re-reads tests from the compilation. It never re-compiles in the background on its own, mirroring DeZog's "refresh on reassembly". The panel shows the build's time. If the build root's language cannot produce tests (Klive BASIC, zxbc, PASTA/80), the panel says so. |
| D15 | **Run builds first.** Run All, like the existing `run`/`debug` commands, compiles the build root, then hands the compilation to the worker. A build error aborts with the Build pane's messages, as `compileCode` does now. |
| D16 | **Commands.** `test-list`, `test-run [<pattern>] [-failed] [-coverage]`, `test-debug <test>` and `test-init`, with aliases `tl`, `tr`, `td`. Patterns match `Suite.UT_name` with `*`. Results print to a new **Tests** output pane: one line per test, a summary, and click-to-source links (`outputNavigateAction`). The same commands are available to KSX scripts through `executeCommand`. |
| D17 | **Run with coverage** (after the coverage plan). `-coverage` and a panel toggle switch coverage on in the worker's machine. The runner merges each test's flags (an OR) and counters (a sum) and hands the result to the IDE's coverage presentation, so the editor shows what the tests exercised. G5.6 exports it as LCOV. |
| D18 | **Machines.** Phase 1 covers the 48K/16K, 128K family and +2A/+3/+2E/+3E (Spectrum models from the project's machine). Phase 3 adds the Next (`.nex`-style banked segments, MMU) and the Timex, Z88 and ZX80/81 cores, where a test program makes sense. The runner refuses a machine without a WASM core (the C64) with a clear message. |
| D19 | **Project configuration lives in `klive.project`**, under a new `unitTests` section: `timeout` (s), `boot` (`rom`/`none`), `stopAtStart`, `machine` (defaults to the project's machine and model), `include` (glob patterns of tests to run by default). Every field is optional. A DeZog `launch.json` is **not** read: Klive has no launch configurations, and D1's labels carry everything the runner needs (Q6). |
| D20 | **Determinism.** The base state is fixed: no keys held, a fixed R register, no tape, no real-time input. Each test therefore gives identical results and T-states on every run and every OS. A test (§6) runs a suite twice and compares results byte for byte. That is what lets G5.6 publish T-states in JUnit `time`. |

### 1.2 Out of scope, and the hooks left for later

- **Klive BASIC tests.** The runner takes "a compilation with test entry points and success and
  failure labels". A BASIC convention (e.g. `SUB UT_…` plus an `ASSERT` statement compiled to an
  ASSERTION annotation) could reuse it unchanged.
- **Parameterised tests and per-suite setup.** DeZog has neither. A `UT_SETUP_<suite>` convention
  could come later.
- **Watch mode** (re-run on every build). D14 already refreshes discovery, and a "Run after build"
  toggle is a small follow-up.
- **Snapshot-based tests** (start from a `.szx`/`.kls`). D7's base state could come from a state
  file instead of a boot (`unitTests.baseState`).

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| Klive assembler | `src/main/z80-compiler/Z80Compiler.ts`, `z80-assembler.ts`, `src/main/compiler-common/common-assembler.ts` (`compileFile` l.308, annotations in `emitSingleLine` l.1349–1395, macro stack l.1271–1292), parser `common-asm-parser.ts` (macro grammar l.1064–1078, invocation l.1207–1243) |
| Symbols | `AssemblerOutput` (`assembler-in-out.ts` l.14–140): `symbols` (root, lower-cased unless `useCaseSensitiveSymbols`), `nestedModules` (`CompilerInfo.ts` l.458–499); `AssemblySymbolInfo` l.249–291 (`definitionFileIndex/Line`) |
| sjasmplus | `src/main/sjasmp-integration/SjasmPCompiler.ts` (`compileFile` l.80–238, `extractSldInfo` l.376, `sldSymbols` l.414–433, `sldAnnotations` l.439–458, LP002 l.183–202) |
| Annotations | `src/common/utils/source-annotations.ts` (`annotationsInComment` l.45, `annotationBreakpoints` l.207); `src/common/utils/breakpoints.ts` (`reinstallAnnotationBreakpoints` l.413) |
| Stop messages | `MachineController.describeCommentStop` (`src/emu/machines/MachineController.ts` l.2129–2162), `DebugSupport.describeDezogValues` l.1451 |
| Headless machines | `test/harness/sp48/session.ts` (`HarnessSp48Machine` l.51–62, `runTo` l.162–181, `call` l.186–193, `attachDebugSupport` l.214, `continueToBreakpoint` l.226–260); `test/harness/zxnext/core/machines.ts` l.77–87 (`readArtifact`, `FILE_PROVIDER`) |
| Loaders | `src/emu/machines/*/wasm/*WasmV2Loader.ts` (`fetch(new URL(...))` in production; `readArtifact` override for Node) |
| State images | `src/emu/machines/state/wasmStateImage.ts` (`captureWasmImage`, `restoreWasmImage`) |
| Injection flow | `MachineController.runCode` l.803–827, `executeInjectionFlow` l.866–1058 (`SetReturn` l.1007–1018); `ZxSpectrumBase.injectCodeToRun` l.505–535 (banked segments a TODO, T5); `ZxSpectrum48WasmHost.ts` l.108–124 |
| Worker pattern | `src/main/compiler-integration/runWorker.ts` l.34, `compilerWorker.ts` |
| Build | `src/renderer/appIde/utils/compile-code.ts` l.58–171; `KliveCompilerCommands.ts` l.1089–1238 |
| Activity and panels | `src/renderer/registry.ts` (`ACTIVITY_TEST_ID` l.184, `sideBarPanelRegistry` l.215–375, `outputPaneRegistry` l.393–412); `BreakpointsPanel.tsx` and `BreakpointsBadge.tsx` as patterns |
| Output | `IOutputBuffer` (`ToolArea/abstractions.ts` l.104–180), `outputNavigateAction` (`common/utils/output-utils.ts` l.18) |
| Project file | `src/main/projects.ts` (`builder.roots` l.478, type l.570) |
| Docs | `docs/content/working-with-ide/` (next to `breakpoints.mdx`, `run-debug.mdx`, `sjasmp.mdx`), `_meta.ts`; `docs/content/commands-reference.mdx` |

---

## 3. The traps

1. **T1: sjasmplus and ASSERTIONs inside macros.** DeZog's assertions sit in macro bodies. The
   runner depends on sjasmplus emitting an SLD `K` line *per macro expansion*, with the expansion's
   address and the invoking line. **Phase 0 verifies this with the installed sjasmplus** on a test
   program written for Klive (not DeZog's). If `K` lines carry the macro definition's line instead
   of the call site, the failure link points into the include. The fallback is the SLD `T` trace of
   the expansion, which maps the address back to the invocation line.
2. **T2: The Klive assembler and ASSERTIONs inside macros.** `emitSingleLine` creates one annotation
   per expansion (good), but its `fileIndex/line` is the macro body's. D8's message must show the
   **invocation** line. The macro-invocation stack (`common-assembler.ts` l.1271–1292) knows it, so
   the annotation gains an optional `invokedAt: {fileIndex, line}`. The same fix helps every
   ASSERTION in a macro, not only in tests.
3. **T3: Lower-cased symbols.** The Klive assembler lower-cases symbol names unless
   `useCaseSensitiveSymbols` is on. `UT_` matching and display names therefore use the source
   spelling, taken from `definitionFileIndex/Line`, and the case-insensitive key only for lookup.
   sjasmplus SLD names are lower-cased too (`sldSymbols`), so its spelling comes from the SLD
   `L` line's source position in the same way. Without a source position, the test is shown
   lower-cased with a warning.
4. **T4: Module-scoped labels are invisible today.** `integerSymbolsOf` reads root `symbols` only, and
   nothing flattens `nestedModules`. Discovery adds a `flattenSymbols(output)` walk (the harness's
   `getNestedModule` logic), which also makes module labels usable in conditions. The roadmap's
   "dotted, case-insensitive labels" in the DeZog dialect quietly needed this.
5. **T5: Banked segments are not injected.** `injectCodeToRun` ignores `segment.bank`. The runner
   writes segments itself through the partition-aware memory API (`setMemory` with a partition), and
   the Debug path (D12) gets the same fix. That fix is a correctness fix for `run`/`debug` of banked
   Klive asm programs too, and it lands first, as its own change.
6. **T6: `UNITTEST_CALL_ADDR + 1` in a banked or ROM area.** The runner writes the operand with the
   same partition-aware poke, at the partition where the label lives. A wrapper placed in ROM
   (impossible on real hardware, possible in a mistaken `ORG`) is refused with a message.
7. **T7: The test's own `DI`/`EI`.** DeZog runs tests with interrupts off, and a test that needs them
   executes `EI`. In the base state of D7, the frame interrupt is due at a fixed T-state. A test with
   `EI` therefore sees the same interrupt timing every run (D20), but **not** the same timing as the
   same test in the IDE emulator mid-session. That is intended, and documented.
8. **T8: Infinite success loop.** `UNITTEST_TEST_READY_SUCCESS` jumps to itself. The runner checks
   the PC before each instruction (an exec breakpoint at that address, in C), so it never spins. In
   Debug, the stop happens there too, with "passed" instead of a breakpoint message.
9. **T9: `TEST_STRING` and memory reads in conditions.** DeZog's ASSERTION dialect has no memory
   reads, so its macros copy into registers first. Klive's DeZog dialect *does* support `b@()`/`w@()`.
   Klive's own include (D4) may still not rely on that, because the same source must keep working in
   DeZog. A Phase 1 test assembles the Klive include and checks that it uses only register/label
   expressions.
10. **T10: Worker memory.** Each worker holds one machine: 12–40 MB of WASM memory plus the base image
    (the same size). Suites run sequentially in one worker. A pool of workers for parallel suites is
    possible later, but determinism (D20) and simplicity come first.
11. **T11: ROM availability in the worker.** The worker needs the same ROMs and firmware the
    emulator would load, including user-supplied ones (TR-DOS, the TC2048's). The main process
    resolves them with the existing machine-config resolution and passes the bytes in, so the worker
    never reads settings itself (G5.6 needs the same).

---

## 4. Design

### 4.1 Discovery (pure, `src/common/unit-tests/discovery.ts`)

```ts
export type UnitTestCase = {
  id: string;              // "Module1.UT_test2"
  label: string;           // original spelling (T3)
  suitePath: string[];     // ["Module1"]
  address: number; partition?: number;
  file?: string; line?: number;
};
export type UnitTestProgram = {
  tests: UnitTestCase[];
  labels: { start: number; wrapper: number; callAddr: number; success: number;
            stackBottom?: number; stackTop?: number };  // with partitions
  problems: string[];      // D1's actionable messages
};
export function discoverUnitTests(output: DebuggableOutput & { symbols, nestedModules? }): UnitTestProgram;
```

### 4.2 Runner (`src/main/unit-tests/`)

- `UnitTestRunner.ts` is pure TypeScript with no Electron imports:
  `run(program, compilation, machineSpec, options, onEvent, signal)`.
  - It creates the machine with `readArtifact` (D6); the artifact path comes from the caller.
  - It builds the base state (D7).
  - For each test, it applies D3, installs D9/D11 breakpoints and runs a **per-instruction debug
    loop** with `StopAtBreakpoint` and a T-state budget (D10).
  - It emits `{kind: "started"|"passed"|"failed"|"error"|"log"|"finished", test, tstates, message, location}`.
- `HeadlessMachineFactory.ts` maps a machine id/model to its `*WasmV2Machine` class, its WASM
  artifact and its ROM loading, mirroring the harness constructors. G5.6 shares it.
- `unitTestWorker.ts` / `runUnitTestWorker.ts` are the `worker_threads` wrapper.
- The main process wires it into `RendererToMainProcessor` (`runUnitTests`, `cancelUnitTests`), and
  events are forwarded to the IDE through `IdeApi` notifications.

### 4.3 IDE

- `UnitTestsPanel.tsx` is registered in `sideBarPanelRegistry` with `hostActivity: ACTIVITY_TEST_ID`.
  `UnitTestsBadge.tsx` shows the failure count.
- `unitTestsSlice` in the IDE store holds results by test id, the last run time, and the running
  test.
- `UnitTestCommands.ts` implements D16. The Tests output pane goes in `outputPaneRegistry`.
- **Debug** (D12): the `RunUnitTest` injection-flow step, used by `MachineController` when it is
  given a `CodeToInject` with `unitTest: { testAddress, labels }`.
- **Testing → Add unit-test support** writes `unit_tests.kz80.asm` or `unit_tests.inc` (D4/D5) from
  `src/main/unit-tests/includes/`.
- Docs: `docs/content/working-with-ide/unit-tests.mdx` (concepts, both assemblers, the macro
  reference in Klive's words, Debug, configuration, DeZog compatibility notes) and the commands in
  `commands-reference.mdx`.

---

## 5. Phases

| Phase | Work | Done when |
| --- | --- | --- |
| 0 | Spike: T1 with the installed sjasmplus and T2 in the Klive assembler; T5 banked injection fix as its own change | A recorded finding in §9 on `K` lines per expansion; Klive annotations carry `invokedAt`; a banked Klive asm program runs with `run` on the 128K |
| 1 | Discovery (T3/T4), Klive's two includes (D4/D5), the runner on the 48K in a `node` test | `test/unit-tests/discovery.test.ts` (Klive asm modules, sjasmplus SLD fixtures); `test/unit-tests/runner-sp48.test.ts` (e2e tier): pass, assertion fail with the value message, stack overflow, RET-instead-of-TC_END underflow, timeout, HALT with DI, LOGPOINT capture, determinism (D20), all with both assemblers |
| 2 | Worker, main/IDE wiring, Test panel, commands, Tests pane | `jsdom` panel tests (tree, statuses, click-to-source, badge); commands with a faked API; the panel exercised in the running IDE (`scripts/` CDP check, like `kbasic-ide-check.cjs`) |
| 3 | Debug a test (D12); 128K/+3 and Next machines; banked tests | e2e: Debug stops at the test's first instruction, Continue reaches "passed"; a failing assertion stops on its invocation line; Next test program with MMU-banked code passes in the runner |
| 4 | Run with coverage (D17), remaining machines, docs, roadmap and competitive analysis | Coverage merge test; docs page; §7 updates |

---

## 6. Tests

- **Pure:** discovery, suite trees, D1's problem messages, `flattenSymbols`.
- **Assembler:** `invokedAt` on annotations in macros; Klive's include assembles, and every
  assertion macro produces exactly one ASSERTION per invocation.
- **Runner (e2e tier, `build/e2e-tests.ts`):** the outcome matrix of Phase 1, on the 48K, 128K and
  Next, for Klive asm and sjasmplus (sjasmplus tests skip with a message when it is not installed,
  as the existing sjasmplus tests do).
- **Compatibility fixture:** a small project written for Klive in DeZog's conventions (`UT_` labels,
  modules, `TC_END`, every assertion macro, `UNITTEST_INITIALIZE` with init code) assembled with
  sjasmplus and a DeZog-style include. It must run unchanged. The include used in the test is
  Klive's sjasmplus include (D5), so no DeZog file enters the repository.
- **UI:** `jsdom` for the panel; the running-IDE script for click-to-source and Debug.

---

## 7. Effort and the standing rule

**L**, as the roadmap says: about five to six weeks. Discovery and the includes take a week, the
runner and its outcome matrix a week and a half, the worker and the IDE wiring and panel a week and
a half, and Debug a test plus the Next a week. Docs come on top.

When it lands:
- mark G5.5 done in [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md);
- update [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) §2 (the "Unit
  tests / code coverage / profiler" row: DeZog-compatible tests with both assemblers, T-state
  results, deterministic runs, debug a test with reverse debugging) and §4 (W3);
- the Test panel uses existing primitives; record any new visual rule in
  `.ai/ui-theming-intent-and-lessons.md`.

---

## 8. Questions (all answered, 2026-10-08: the suggested answers)

1. **Q1: Klive assembler compatibility level.** Suggested: Klive ships its own include with the same
   names in Klive syntax (D4). Tests written for the Klive assembler then differ from DeZog sources
   only in macro call syntax (`TEST_MEMORY_BYTE($8000, 5)`). The alternative is to teach the Klive
   assembler sjasmplus-style `MACRO name a,b` definitions and parenthesis-free invocations, so that
   DeZog's include and test sources assemble unchanged. That is a parser change with ambiguity
   risks (an invocation looks like an instruction with operands), and it deserves its own plan.
2. **Q2: Ship an sjasmplus include?** Suggested yes (D5), written from scratch, offered only when a
   project has none. The alternative is to point users at DeZog's download. That is simpler, but a
   fresh Klive project then depends on another tool's repository.
3. **Q3: Base state = boot to the ROM's main loop?** Suggested yes for Spectrum models (D7), with
   `boot: none` for programs that do not use the ROM. DeZog loads a `.sna`, which usually carries
   an initialised ROM state too.
4. **Q4: Timeout in emulated time?** Suggested yes (D10): deterministic, and fair on slow CI. The
   alternative, wall time like DeZog, would make a test pass locally and fail in CI.
5. **Q5: The user's IDE breakpoints during Run.** Suggested: ignored in Run and honoured in Debug
   (D11). DeZog fails a test on any breakpoint, but in practice that means its annotation
   breakpoints. Failing tests because a breakpoint is set while editing would surprise people.
6. **Q6: Read DeZog's `launch.json`?** Suggested no (D19): Klive has no launch configurations, and
   `unitTestTimeout` is the only setting that would carry over. If wanted, a one-time import into
   `klive.project` is a small follow-up.
7. **Q7: Worker vs. emu process for Run.** Suggested: a worker in the main process (D6), which
   leaves the user's emulator untouched and is what G5.6 needs. The alternative, running tests on
   the visible emulator as DeZog does, is simpler but slow (real-time pacing) and destroys the
   user's machine state.
8. **Q8: Klive BASIC tests.** Out of scope here (§1.2). Should a follow-up plan define a BASIC
   convention (`SUB UT_…`, an `ASSERT` statement)? DeZog has nothing to be compatible with, so it
   would be Klive's own.

---

## 9. Implementation record (2026-10-08)

### 9.1 Where it lives

| Part | Files |
| --- | --- |
| Discovery (§4.1, T3, T4) | `src/common/unit-tests/discovery.ts`, `src/common/utils/flatten-symbols.ts` (`integerSymbolsOfOutput` makes module labels usable in conditions and ASSERTIONs too) |
| Shared types and guards | `src/common/unit-tests/unitTestTypes.ts`, `unitTestGuards.ts` (the `unitTest`-owned stops, shared by the runner and Debug), `runnableCompilation.ts` (the plain-data compilation the worker gets) |
| Includes (D4, D5) | `src/main/unit-tests/includes/kliveInclude.ts`, `sjasmplusInclude.ts`; written by `addUnitTestSupport.ts` |
| Runner (D3, D6–D11, D20) | `src/main/unit-tests/UnitTestRunner.ts`, `HeadlessMachineFactory.ts`, `unitTestMachines.ts` (light facts the main process needs without loading cores) |
| Worker and main (D6, D15, D19) | `unitTestWorker.ts`, `runUnitTestWorker.ts`, `unitTestService.ts`, `wasmArtifacts.ts`, `unitTestProjectSettings.ts`; `MainApi.runUnitTests`/`cancelUnitTests`/`addUnitTestSupport` |
| IDE (D12–D17) | `UnitTestsPanel.tsx`, `UnitTestsBadge.tsx`, `TestingCommands.tsx` (the Testing activity's "…" menu), `commands/UnitTestCommands.ts`, `unit-tests/unitTestRun.ts`, `unitTestTree.ts`; the `unitTests` store slice; the Tests output pane |
| Debug a test (D12) | `MachineController.prepareUnitTestDebug`/`describeUnitTestStop`; `CodeToInject.unitTest`; `injectCode`'s `unitTestOf` |
| Shared stop text | `src/emu/machines/commentStopReport.ts` (what `describeCommentStop` printed, now shared with the runner) |

### 9.2 Phase 0 findings

- **T1 (sjasmplus `K` lines per macro expansion) is not verified on this machine:** no sjasmplus is
  installed. The SLD format puts the *use* site in a line's first two fields and the macro definition
  in the next two, and `sldAnnotations` reads the first two, so the expectation is that a `K` line
  names the invocation. `test/unit-tests/runner-sjasmplus.test.ts` checks exactly this (one ASSERTION
  per expansion, on the invocation line) and runs the compatibility fixture; it skips with a message
  without sjasmplus (`SJASMPLUS=<exe>` or the PATH). The same test is the first check of Klive's
  sjasmplus include, whose `TEST_REG`/`TEST_DREG` rely on sjasmplus substituting macro arguments
  inside a comment - unverified for the same reason.
- **T2 done.** `SourceAnnotation.invokedAt` is the *outermost* invocation (the line the user wrote);
  annotation breakpoints carry it as `annotationInvokedAt` (kept by `DebugSupport.addBreakpoint`), and
  both the debugger's stop text and the runner's message name it. Every ASSERTION/WPMEM in a macro
  benefits, not only tests.
- **T5:** the 128K and +2A/+3 injection already wrote banked segments (`injectSpectrumCode`); the
  48K has no banks. The **Next** host dropped them: it now writes them through the shared
  `writeCodeSegments` (a 16K bank is pages 2n and 2n+1). Run/Debug of a Next build goes through a
  `.nex` file, so this mattered for injection only.
- **The Klive include's global labels** use an existing assembler rule found during the spike: a
  `.`-prefixed label is defined in the global scope, even inside a macro or a module. It now records
  its written name (T3) and is documented in the macros page; module names record theirs too
  (`AssemblyModule.writtenName`), so suites are spelled as written in case-insensitive builds.
- **A comment of an include must not contain DeZog's keywords** outside its assertion lines: the
  first header comment said "an ASSERTION stops it" and became a bare, always-failing assertion at the
  program's first byte. A test now guards both includes.

### 9.3 Departures from the plan

- **RET instead of TC_END** is caught by an execution stop at `UNITTEST_CALL_ADDR + 3` (when that is
  not the success label), not by the underflow guard: the wrapper's `CALL` pushes its return address
  *inside* the private stack, so a plain RET never reads `UNITTEST_STACK`. The guard still catches a
  test that pops more than it pushed. Klive's includes put a loop, not the success label, after the
  `CALL`; with an include whose success label follows the `CALL` directly, RET passes, as in DeZog.
- **The init code runs on the private stack** (SP = `UNITTEST_STACK` when the label exists) and its
  return address is the wrapper itself, so "init returned" and "start the test" are one stop.
- **Events reach the IDE through store actions** (`UNIT_TEST_EVENT` and friends), not IdeApi
  notifications: every window sees them with no new messaging. LOGPOINT lines travel inside their
  result only, so a busy logpoint cannot flood the store; the merged coverage comes back in the run's
  response, not through the store.
- **Machines (D18):** the runner drives the 48K/16K, 128K (and Pentagon models), +2A/+3/+2E/+3E and
  the Next. The Timex and Scorpion need user-supplied ROMs passed as machine properties, and the Z88,
  ZX80 and ZX81 need their own frames and boot points; they are refused with a message naming the
  supported machines. The Next defaults to `boot: "none"`.
- **Debug a test** debugs one test; **Continue to the next test of a suite** is not implemented. It
  is refused on the Next, whose builds start through a `.nex` file. Debug installs the stops in the
  emulator with the `unitTest` owner (hidden from the Breakpoints panel and project saves) and clears
  them with the next program.
- **The panel's tree is flat**: suite header rows (with the worst member's glyph and a failure count)
  followed by their tests, no collapsing; the filter covers what collapsing would.
- **Run with coverage** needs advanced debugging on, like coverage itself, and merges only into an
  emulator running the same machine.
- `klive.project`'s `unitTests` section has no editor; it is read at every run and carried over
  unchanged when the IDE saves the project file. `machine`/`model` are its own fields (D19 named
  `machine` only).

### 9.4 Tests

- Unit tier: `test/unit-tests/discovery.test.ts`, `includes.test.ts` (every assertion macro yields
  one ASSERTION per invocation on its invocation line; register-only expressions, T9; the global
  labels), `unit-test-plumbing.test.ts` (store slice, JSON round trip of the worker's compilation,
  Add unit-test support, settings, core lookup, panel rows, test lookup), `writeCodeSegments.test.ts`,
  and `UnitTestsPanel.test.tsx` (jsdom: tree, statuses, click-to-source, toolbar, filter, badge).
- e2e tier (`build/e2e-tests.ts`): `runner-sp48.test.ts` (the whole outcome matrix, the invocation
  line, LOGPOINT capture, determinism, selection, `boot: none`, time limit, missing frame, init that
  never returns, coverage), `runner-machines.test.ts` (banked tests on the 128K and +3, MMU-banked
  tests across both 8K pages on the Next, the 128K's one-second budget), `runner-sjasmplus.test.ts`
  (skips without sjasmplus).
- Running IDE: `scripts/unit-tests-ide-check.cjs` - `test-init`, the panel after `test-run`, the
  Tests pane, click-to-source onto the invocation line, Debug stopping at the test's first
  instruction, Continue to "UT_pass passed", a failing assertion under the debugger naming its line,
  and Run with coverage reaching `coverage status`. All 16 checks pass.
- The production worker bundle (`out/main/unitTestWorker.js`) was also run in plain Node with a
  JSON round-tripped compilation.

### 9.5 Left for later

- Verify T1 and the sjasmplus include with an installed sjasmplus (run `runner-sjasmplus.test.ts`).
- Timex, Scorpion, Z88, ZX80/81 in the runner; Debug a test on the Next; Continue through a suite.
- G5.6 (UNIT_TESTS_CLI_PLAN.md): the runner and its events are Electron-free and ready for it.
