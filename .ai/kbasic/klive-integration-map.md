# Where Klive BASIC plugs into Klive

A map of the existing code Klive BASIC builds on, surveyed 2026-09-26 at HEAD `1c1365677`. Line
numbers drift; search for the names if a reference no longer matches. Update this file when the
integration changes.

## 1. Compiler plug-in contract

- `IKliveCompiler` — `src/common/abstractions/CompilerInfo.ts` (~864): `id`, `language`,
  `providesKliveOutput`, `compileFile(filename, options?)`, `lineCanHaveBreakpoint(line)`,
  optional `setAppState(state)` (the only way settings reach a compiler, also in the worker).
- Registry — `src/main/compiler-integration/compiler-registry.ts`: keyed by **language id**;
  `createCompilerRegistry()` hard-codes Z80Compiler (`kz80-asm`), ZxBasicCompiler (`zxbas`,
  external zxbc), SjasmPCompiler (`sjasmp`), Pasta80Compiler (`pasta80`). Klive BASIC replaces the
  `zxbas` entry with a dispatcher honouring `zxbasic.compiler` (plan D9).
- Output types (same file): `SimpleAssemblerOutput` → `InjectableOutput` (segments,
  `injectOptions`) → `DebuggableOutput` (`sourceFileList`, `sourceMap: Record<address, FileLine>`,
  `listFileItems`, optional `sourceLevelDebug`) and the full `CompilerOutput` (adds `symbols`,
  `modelType` 1=48 2=128 3=+3 4=Next, `entryAddress`, `nexConfig`, …). `FileLine` has optional
  `startColumn`/`endColumn`.
- **Existing, unused source-level debug model** (same file, ~620–805): `SourceLevelDebugInfo`
  (`files`, `statements` ascending by address, `callables`, `usesBanking`, `addressToStatement`
  pairs with −1 for glue, `partitionedAddressMap`), `StatementDebugInfo` (file, 1-based lines,
  0-based columns end-exclusive, start/end address, `partition`, `callTargets`, `kind`,
  `callableIndex`), `CallableDebugInfo` (name, kind, lines, entry, `exitAddresses`, partition,
  statement range, parent). Must stay JSON-serialisable. Type guard `hasSourceLevelDebug()` in
  `src/renderer/appIde/utils/compiler-utils.ts` — never called. The design that came with it:
  `git show 1d9f2856d:plan.md`.
- Where compiles run: **foreground** (build/inject/run/debug/export) in the Electron **main
  process** via `RendererToMainProcessor.compileFile`; **background** (as-you-type) in a
  `worker_threads` worker (`src/main/compiler-integration/compilerWorker.ts`, `runWorker.ts`) that
  builds its own registry and receives an `AppState` snapshot. Results cross IPC / MessagePort:
  structured-clone-safe only. A compiler that **throws** in the worker is reported as success —
  return errors instead.
- Background builds of non-`kz80-asm` languages only run when the editor setting
  `allowBackgroundCompile` is on (`MonacoEditor.tsx` ~1384).

## 2. Klive's assembler

- `src/main/compiler-common/common-assembler.ts` (`CommonAssembler`): entry points
  `compile(sourceText, options)` and `compileFile(filename, options)`. Internally `doCompile`
  parses into `preprocessedLines` (`executeParse`) and then calls `emitCode(lines)`, then fixups —
  so a programmatic entry that supplies parsed lines is a small change (plan §4.1).
- Yields to the event loop every 1000 lines (`ASSEMBLY_BATCH_SIZE`) because it can run on the main
  process.
- Features: full Z80 + Z80N (Z80N only under `.model Next`, else `Z0414`), `.module`/`.moduleend`
  with dotted resolution and `::` for root-qualified names, `.proc`, macros, structs, `#if`
  family, `.bank N[,offset]` (16K bank assembled at `$C000+offset`), `.savenex …`, NEX V1.2 writer
  (`src/main/z80-compiler/nex-file-writer.ts`; unbanked code must be ≥ `$8000`, goes to bank 2;
  banked segments placed at `startAddress % 16384`).
- Missing: numeric temporary labels, 8K-page placement at an arbitrary address (plan §4.2), `#line`
  (parsed, no-op).
- Source map: every code-emitting line sets `sourceMap[addr]` and pushes a `listFileItems` entry
  (`fileIndex`, `lineNumber`, `address`, `segmentIndex`, `codeLength`, `sourceText`). Pragma,
  label-only and comment lines get none.
- Tests: `test/z80-assembler/` (79 files); helpers in `test-helpers.ts` compile in memory with
  `new Z80Assembler().compile(source, options)`.

## 3. Build, inject, run, debug

- `src/renderer/appIde/commands/KliveCompilerCommands.ts`: `klive.compile`, `klive.inject`,
  `klive.run`, `klive.debug`, export (tap/tzx/hex/nex). `injectCode()` builds a `CodeToInject`
  (`src/common/abstractions/CodeToInject.ts`) and calls `emuApi.runCodeCommand(code, info,
  debug, …)`. For the Next it exports a NEX to the SD card (`_klive/<name>`) and the machine types
  `.nexload`.
- `MachineController.runCode` (`src/emu/machines/MachineController.ts`) executes the machine's
  `CodeInjectionFlow` (keep PC, reach an execution point, inject, set return, start).
- 48K: the injection flow reaches `SP48_MAIN_ENTRY = $12AC` (`src/emu/machines/ZxSpectrumBase.ts`).

## 4. Breakpoints

- Model: `BreakpointInfo` (`src/common/abstractions/BreakpointInfo.ts`): address (+ partition),
  bank-relative (`bank`+`bankOffset`), source (`resource`+`line` → `resolvedAddress`,
  `resolvedPartition`), label-anchored, NextReg write, memory read/write, I/O read/write, one-shot,
  owner/scope. Keys: `src/common/utils/breakpoints.ts` `buildBreakpointKey` (source key
  `[resource]:line`).
- Resolution after each compile: `refreshSourceCodeBreakpoints` (`breakpoints.ts` ~214) finds the
  file index by `filename.endsWith(resource)`, then the **first** `listFileItems` entry for the
  line, its segment, and the partition (`src/common/utils/source-breakpoint-partition.ts`; on the
  Next an 8K page), then `emuApi.resolveBreakpoints`.
- Emulator side: `DebugSupport` (`src/emu/machines/DebugSupport.ts`): `addBreakpoint`,
  `resolveBreakpoint(resource, line, address, partition?)`, `shouldStopAt(address,
  partitionResolver)` over a 64K flag array plus per-address partition lists. Tests construct it
  as `new DebugSupport(undefined, [])`.
- Persistence: `.kliveproject` `debugger.breakpoints`; NEX-owned ones in `.nex.dis` sidecars.

## 5. Stepping

- `DebugStepMode` (`src/emu/abstractions/DebugStepMode.ts`): NoDebug, StopAtBreakpoint, StepInto,
  StepOver, StepOut — instruction level.
- Shared decision `shouldStopAtDebugPoint` (`src/emu/machines/DebugStepDecision.ts`), called
  **after every instruction from TypeScript** by every Z80 machine's debug loop:
  `ZxSpectrum48WasmV2Machine` (~864), `ZxSpectrum128WasmV2Machine` (~918),
  `ZxSpectrumP3eWasmV2Machine` (~1231), `ZxNextWasmV2Machine` (~843), `Z88WasmV2Machine`,
  `MachineFrameRunner`. Any `debugStepMode` other than NoDebug, or a `frameTerminationMode` other
  than Normal, selects the per-instruction loop.
- Step out uses a shadow return stack kept by each WASM core (`z80.c`; pushed on CALL, RST and
  interrupt entry, popped on taken RET), exposed as e.g. `zxnextGetStepOutAddress`.
- `FrameTerminationMode.UntilExecutionPoint` + `executionContext.terminationPoint` runs until PC
  reaches an address — what test harnesses use to run a routine to its return.

## 6. Editor, highlighting, panels

- `src/renderer/features/editor/monaco/MonacoEditor.tsx`: execution point
  (`refreshCurrentBreakpoint` ~1150; matches `address === pc` only — **not partition-aware**;
  column range from `sourceMap[pc]` via `createCurrentBreakpointDecoration`), breakpoint glyphs
  (~932), gutter clicks (~1060, need `supportsBreakpoints`; with `instantSyntaxCheck` they ask the
  compiler's `lineCanHaveBreakpoint` over IPC), markers from background compiles only (~337; error
  columns ignored).
- Auto-navigation to the PC: `src/renderer/appIde/IdeEventsHandler.tsx` `refreshCodeLocation`
  (~177), from `sourceMap[pc]`.
- Watch panel: `src/renderer/appIde/SideBarPanels/WatchPanel.tsx` — assembler symbols only, flat
  64K, no types. Call stack: `CallStackPanel.tsx` → `Z80MachineBase.getCallStack()` = 16 raw words
  from SP.
- Execution controls: `ExecutionControls.tsx`; debug shortcuts: `monacoDebugShortcuts.ts`.

## 7. Languages, templates, harnesses

- Language providers: `src/renderer/appIde/project/*LanguageProvider.ts`, registered in
  `src/renderer/registry.ts` (`customLanguagesRegistry`, `fileTypeRegistry`). `zxbas`:
  `.zxbas`/`.bas`, `supportsBreakpoints: false`, `ASM` blocks embed `zxbasm`.
- Templates: `src/public/project-templates/<machine>/<template>/` with `build.ksx`
  (`buildCode` → `klive.compile`, …) and `__$klive.project` (build roots). ZX BASIC templates
  exist for sp48 and sp128; `zxnext` has only `default`.
- Settings keys of the external compiler: `src/main/zxb-integration/zxb-config.ts` (`zxbasic.*`).
- Test projects (`build/vitest.config.ts`): `node` (`test/**/*.test.ts`), `jsdom`
  (`*.test.tsx`), `perf`.
- **ZX Spectrum Next harness** (`test/harness/zxnext/`): `createSession()`, `loadCode(source)`
  assembles Klive Z80N source and maps pages `[$FF,$FF,10,11,4,5,0,1]`. **ROM in slots 0–1 is
  whatever hard reset selected, not the 48K BASIC ROM; no system variables; interrupts off**
  (`core/load-nex-direct.ts`). A real `.nexload` hands over with NextZXOS's 48K BASIC ROM paged
  in. Code that needs the ROM cannot run under `loadCode` as it is.
- **ZX Spectrum 48K harness** (`test/harness/sp48/`, added for Klive BASIC): real 48K ROM
  (`src/public/roms/sp48.rom`), boot to `$12AC`, assemble and load Klive source, call a routine
  and run it to its return, peek/poke, symbols, screen-text reading, breakpoint runs. See its
  README.
- 48K machine in tests: `test/wasm/zxSpectrum/wasm-test-helpers.ts` (`TestSp48WasmMachine`,
  `buildSp48WasmArtifact`); the WASM build uses clang 17 + wasm-ld (`scripts/build-sp48-wasm.cjs`).
