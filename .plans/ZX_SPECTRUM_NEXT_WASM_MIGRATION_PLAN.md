# ZX Spectrum Next WASM Migration Plan

Created: 2026-08-16

Status: In progress

## Goal

Migrate the current ZX Spectrum Next TypeScript implementation to a C/WASM
backend without changing observable emulator semantics.

The TypeScript implementation is the oracle. The WASM implementation may be
introduced only through small parity-tested slices that prove the same behavior
through the same public machine, debugger, memory, disassembly, register,
screen, input, storage, and IDE inspection surfaces.

## Non-Negotiable Rules

- Read the 48K, 128K, and +2/+3 WASM integration code before every slice that
  touches loading, factory selection, frame execution, tests, or packaging.
- Transfer behavior from the existing TypeScript Next code, not from a
  reconstructed design or a simplified model.
- Do not make WASM the default or add a backend-specific product model until
  the adapter passes the relevant oracle tests. An explicitly selected,
  clearly labeled integration scaffold may exist early so the IDE/emulator
  contract can be exercised.
- Do not add real CPU/device full-frame execution to WASM until instruction
  stepping, tact accounting, memory mapping, I/O, interrupts, debugger
  breakpoints, and IDE inspection parity are already proven. An early scaffold
  frame loop may update frame counters, status bar data, debug stop state, and
  an empty screen, but it must report itself as incomplete.
- Do not mark a step done without focused TypeScript-vs-WASM oracle tests or a
  documented reason the step is documentation-only.
- Keep app-owned policy in TypeScript: resource loading, project files, SD/disk
  backing files, renderer state, menus, and debugger policy.
- Keep normal migrated-machine patterns where they already apply, but do not
  force the 48K/128K architecture onto Next before proving the more complex Next
  semantics slice by slice.
- Any temporary delegation must be explicit in tests and removed before rollout.
- For every step, read the listed TypeScript source files first. Those files are
  the behavioral contract. Listed 48K/128K/+2/+3 WASM files are pattern
  references only; they must not override Next TypeScript semantics.
- Touch only the target files named in that step. If a different target becomes
  necessary, update this plan before implementation and add a deviation
  guardrail for that new target.

## Required Reading

Read these before new implementation work:

- `AGENTS.md`
- `.ai/wasm-v2-machine-migration-guide.md`
- `.plans/ZX_SPECTRUM_128_WASM_MIGRATION_PLAN.md`
- `.plans/ZX_SPECTRUM_PLUS3_WASM_MIGRATION_PLAN.md`
- `.plans/ZX_SPECTRUM_WASM_TEST_MIGRATION_PLAN.md`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48MachineFactory.ts`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48Implementation.ts`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum48/wasm/`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128MachineFactory.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128Implementation.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum128/wasm/`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachineFactory.ts`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eImplementation.ts`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine.ts`
- `src/emu/machines/zxSpectrumP3e/wasm/`
- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/machines/zxNext/Z80NMachineBase.ts`
- `src/emu/machines/zxNext/MemoryDevice.ts`
- `src/emu/machines/zxNext/NextRegDevice.ts`
- `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`
- `test/zxnext/TestNextMachine.ts`
- `test/wasm/z80/README.md`
- `test/wasm/zxSpectrum/README.md`
- `test/wasm/zxSpectrum/wasm-test-helpers.ts`

## Update Rules

- Keep every step at `Not started` until work begins.
- When a step starts, change its status to `In progress`.
- When a step finishes, add the completion date and exact validation commands.
- Record any deviation under that step before continuing.
- Add durable lessons only after the lesson is proven by code or tests.

## Migration Steps

### Step 1 - Pattern Audit

Status: Done on 2026-08-16.

Compare the working 48K, 128K, and +2/+3 WASM integrations against the current
Next TypeScript integration. This step creates the migration map; it does not
create WASM code.

TypeScript source files:

- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/machines/zxNext/Z80NMachineBase.ts`
- `src/emu/machines/zxNext/ZxNextMachineFactory.ts`
- `src/emu/machines/zxNext/MemoryDevice.ts`
- `src/emu/machines/zxNext/NextRegDevice.ts`
- `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`
- `src/emu/machines/zxNext/UlaDevice.ts`
- `src/emu/machines/zxNext/NextKeyboardDevice.ts`
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`

Pattern source files:

- `src/emu/machines/zxSpectrum48/ZxSpectrum48MachineFactory.ts`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48Implementation.ts`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum48/wasm/Sp48WasmV2Loader.ts`
- `src/emu/machines/zxSpectrum48/wasm/sp48/sp48.c`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum128/wasm/Sp128WasmV2Loader.ts`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128.c`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine.ts`
- `src/emu/machines/zxSpectrumP3e/wasm/SpP3eWasmV2Loader.ts`
- `src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e.c`
- `test/wasm/zxSpectrum/wasm-test-helpers.ts`

Target files:

- `.plans/ZX_SPECTRUM_NEXT_WASM_MIGRATION_PLAN.md`
- `.ai/zx-spectrum-next-wasm-parity-audit.md`

Deviation guardrail:

- The audit must contain a table with `TypeScript source`, `existing WASM
  pattern`, `Next-specific semantic risk`, and `required oracle test`.
- Any entry that says "reuse existing Spectrum behavior" must name the Next
  TypeScript source line or test proving that the reuse is semantically valid.
- Validation: `git diff --check`.

Completion notes:

- Added `.ai/zx-spectrum-next-wasm-parity-audit.md` with the required
  TypeScript/WASM pattern audit table.
- Recorded Next-specific risks for factory selection, setup/resource loading,
  lifecycle, memory mapping, NextRegs, I/O ports, ULA, keyboard, screen/frame
  timing, CPU/debug, storage, and audio.
- No WASM code was added in this documentation-only step.
- Validation: `git diff --check`.

### Step 2 - IDE Integration Scaffold

Status: Done

Create an explicitly selectable but incomplete WASM integration scaffold. This
step exists to prove the IDE/emulator contract first: register view, memory
view, disassembly reads, ULA panel data, screen buffer plumbing, machine
selection, setup/reset, and app-side APIs must all work even though the hardware
implementation is still mostly empty.

The scaffold must show an empty screen and deterministic diagnostic state. It
must not pretend that CPU, memory map, ULA rendering, storage, audio, or boot
semantics are migrated.

TypeScript source files:

- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/machines/zxNext/Z80NMachineBase.ts`
- `src/emu/machines/zxNext/ZxNextMachineFactory.ts`
- `src/emu/machines/zxNext/MemoryDevice.ts`
- `src/emu/machines/zxNext/NextRegDevice.ts`
- `src/emu/machines/zxNext/UlaDevice.ts`
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`
- `src/common/machines/constants.ts`
- `src/common/machines/machine-renderer-registry.ts`
- `src/common/messaging/EmuApi.ts`
- `src/renderer/abstractions/IAnyMachine.ts`
- `src/renderer/abstractions/IZxNextMachine.ts`
- `src/renderer/appEmu/MachineService.ts`
- `src/renderer/appEmu/MainToEmuProcessor.ts`
- `src/renderer/appIde/SiteBarPanels/UlaPanel.tsx`
- `src/renderer/appIde/disassemblers/z80-disassembler/zx-spectrum-next-disassembler.ts`

Pattern source files:

- `scripts/build-sp48-wasm.cjs`
- `scripts/build-sp48-wasm.d.cts`
- `scripts/check-sp48-wasm-size.cjs`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48Implementation.ts`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48MachineFactory.ts`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum48/wasm/Sp48WasmV2Loader.ts`
- `src/emu/machines/zxSpectrum48/wasm/sp48/sp48.c`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine.ts`
- `test/wasm/zxSpectrum/wasm-test-control-surface.test.ts`
- `test/wasm/zxSpectrum/wasm-machine-lifecycle.test.ts`

Target files:

- `scripts/build-zxnext-wasm.cjs`
- `scripts/build-zxnext-wasm.d.cts`
- `scripts/check-zxnext-wasm-size.cjs`
- `src/common/machines/constants.ts`
- `src/emu/machines/zxNext/ZxNextImplementation.ts`
- `src/emu/machines/zxNext/ZxNextMachineFactory.ts`
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`
- `src/emu/machines/zxNext/wasm/README.md`
- `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`
- `src/emu/machines/zxNext/wasm/dist/.gitignore`
- `package.json`
- `test/zxnext/ZxNextMachineFactory.test.ts`
- `test/wasm/zxNext/wasm-next-build.test.ts`
- `test/wasm/zxNext/wasm-next-loader.test.ts`
- `test/wasm/zxNext/wasm-next-ide-scaffold.test.ts`

Deviation guardrail:

- The factory default must remain TypeScript. WASM may be selected only through
  explicit config used by tests or a clearly marked development setting.
- Tests must assert that scaffold diagnostics report `implementationIncomplete`
  and list every scaffolded surface: registers, memory, disassembly, ULA,
  screen, frame, and debug.
- Register, memory, disassembly, ULA, and screen API tests must prove the IDE
  receives coherent deterministic values from the WASM scaffold and never stale
  inherited TypeScript device state.
- Loader tests must assert typed-view sizes against constants derived from Next
  TypeScript source files, not copied Spectrum sizes.
- Validation: `npm test -- --project jsdom test/zxnext/ZxNextMachineFactory.test.ts test/wasm/zxNext/wasm-next-build.test.ts test/wasm/zxNext/wasm-next-loader.test.ts test/wasm/zxNext/wasm-next-ide-scaffold.test.ts`,
  `npm run build:zxnext-wasm`, `npm run check:zxnext-wasm-size`,
  `npm run build:check`, and `git diff --check`.

Completion notes:

- Added explicit `zxnextImplementation` selection while keeping TypeScript as
  the default backend.
- Added the incomplete ZX Spectrum Next WASM v2 scaffold, loader, build script,
  size gate, package resource entry, and README.
- Added focused tests for factory selection, build exports/artifact validity,
  loader view sizing, and deterministic IDE-facing scaffold surfaces.
- Diagnostics report `implementationIncomplete: true` and list registers,
  memory, disassembly, ULA, screen, frame, and debug as scaffolded surfaces.
- Validation passed with the commands listed above.

### Step 3 - Scaffold Frame, Status Bar, And Debug Tools

Status: Done

Make the incomplete WASM machine usable in the IDE run/debug loop. Machine
frames must execute as scaffold frames, update frame counters and status bar
statistics, render an empty screen buffer, and allow debug commands to start,
pause, resume, step, and stop without crashing.

This is not real CPU/device execution. It is an integration contract milestone
whose stop reasons and diagnostics must say `scaffold`.

TypeScript source files:

- `src/emu/machines/Z80MachineBase.ts`
- `src/emu/machines/zxNext/Z80NMachineBase.ts`
- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/abstractions/IAnyCpu.ts`
- `src/emu/abstractions/DebugStepMode.ts`
- `src/emu/abstractions/FrameTerminationMode.ts`
- `src/renderer/abstractions/IAnyMachine.ts`
- `src/renderer/abstractions/IMachineController.ts`
- `src/renderer/abstractions/FrameStats.ts`
- `src/renderer/appEmu/MainToEmuProcessor.ts`
- `src/renderer/appEmu/StatusBar/EmuStatusBar.tsx`
- `src/renderer/features/emulator/EmulatorPanel.tsx`
- `src/renderer/features/emulator/useEmulatorScreen.ts`
- `src/renderer/appIde/IdeCommands.ts`

Pattern source files:

- `src/emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine.ts`
- `test/wasm/zxSpectrum/wasm-machine-lifecycle.test.ts`
- `test/wasm/zxSpectrum/wasm-debug-step.test.ts`
- `test/wasm/zxSpectrum/wasm-test-control-surface.test.ts`
- `test/controls/useEmulatorScreen.test.tsx`

Target files:

- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-frame.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-frame.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-debug.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-debug.h`
- `test/wasm/zxNext/wasm-next-frame-scaffold.test.ts`
- `test/wasm/zxNext/wasm-next-debug-tools-scaffold.test.ts`
- `test/wasm/zxNext/wasm-next-status-bar-scaffold.test.ts`

Deviation guardrail:

- Tests must assert frame count, frame tact, frame-completed event behavior,
  `FrameStats`, empty screen buffer dimensions, and status bar data updates.
- Debug tests must assert start debug, pause, resume, step into, step over,
  step out, stop, register read, memory read, disassembly read, and breakpoint
  list plumbing work without claiming breakpoint semantic parity.
- Any scaffold frame completion must have a diagnostic stop reason of
  `scaffoldFrameComplete`. A CPU/device stop reason is forbidden here.
- Validation: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-frame-scaffold.test.ts test/wasm/zxNext/wasm-next-debug-tools-scaffold.test.ts test/wasm/zxNext/wasm-next-status-bar-scaffold.test.ts`,
  `npm run build:check`, and `git diff --check`.

Completion notes:

- Added dedicated C frame/debug scaffold files and wired the Next WASM scaffold
  to increment frame counters, tacts, frame-completed state, and debug-step
  counters deterministically.
- Routed adapter debug modes through scaffold debug steps and normal execution
  through scaffold frame completion.
- Added diagnostics for `lastScaffoldStopReason`, including
  `scaffoldFrameComplete` for full scaffold frames.
- Added focused tests for scaffold frames, controller debug command plumbing,
  memory/disassembly/breakpoint-list APIs, `FrameStats`, and status-bar-readable
  PC/frame data.
- Validation passed with the commands listed above.

### Step 4 - Oracle Harness After IDE Scaffold

Status: Done

Create a test helper that can run the TypeScript Next machine as the oracle and
the scaffolded WASM machine behind one comparison API. From this step forward,
new hardware behavior must be proven against TypeScript before the scaffold
diagnostic for that behavior may be removed.

TypeScript source files:

- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/machines/zxNext/Z80NMachineBase.ts`
- `src/emu/machines/Z80MachineBase.ts`
- `src/emu/abstractions/IAnyCpu.ts`
- `src/emu/abstractions/IZ80Cpu.ts`
- `src/emu/machines/zxNext/MemoryDevice.ts`
- `src/emu/machines/zxNext/NextRegDevice.ts`
- `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`
- `test/zxnext/TestNextMachine.ts`

Pattern source files:

- `test/wasm/zxSpectrum/wasm-test-helpers.ts`
- `test/wasm/zxSpectrum/wasm-test-helpers.test.ts`
- `test/wasm/zxSpectrum/wasm-debug-step.test.ts`
- `test/wasm/zxSpectrum/wasm-oracle-programs.test.ts`
- `test/wasm/z80/test-z80.ts`
- `test/wasm/z80/next-ops.test.ts`

Target files:

- `test/wasm/zxNext/wasm-next-test-helpers.ts`
- `test/wasm/zxNext/wasm-next-test-helpers.test.ts`
- `test/wasm/zxNext/wasm-next-oracle-types.ts`
- `test/wasm/zxNext/wasm-next-scaffold-diagnostics.test.ts`

Deviation guardrail:

- The helper must snapshot CPU registers, PC/SP, interrupt state, tacts,
  frame counters, mapped memory reads, port side effects, NextReg values,
  breakpoint stop reason, and debugger/disassembly reads from the TypeScript
  machine before any WASM assertion API is trusted.
- Tests must fail if a scaffold diagnostic is removed without a matching
  TypeScript-vs-WASM oracle assertion for that surface.
- Validation: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-scaffold-diagnostics.test.ts`,
  `npm run build:check`, and `git diff --check`.

Completion notes:

- Added shared Step 4 oracle snapshot types for CPU/registers, PC/SP,
  interrupt state, tacts/frame counters, mapped memory reads, port side
  effects, NextReg values, debug stop reasons, and disassembly reads.
- Added helper APIs that create a TypeScript Next oracle and explicit WASM
  scaffold machine, capture the TypeScript oracle snapshot first, then capture
  the WASM snapshot through the same comparison API.
- Added scaffold diagnostic guards so every current scaffold surface must keep
  TypeScript oracle coverage until a later parity assertion deliberately
  replaces that diagnostic.
- Validation passed with the commands listed above.

### Step 5 - CPU Single-Step Parity

Status: Done

Move only deterministic CPU single-step execution into WASM test scope. Compare
each step with the TypeScript Z80N oracle before any frame loop work.

TypeScript source files:

- `src/emu/machines/zxNext/Z80NMachineBase.ts`
- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/abstractions/IAnyCpu.ts`
- `src/emu/abstractions/IZ80Cpu.ts`
- `src/emu/abstractions/DebugStepMode.ts`
- `src/emu/abstractions/FrameTerminationMode.ts`

Pattern source files:

- `test/wasm/z80/Z80Cpu.ts`
- `test/wasm/z80/test-z80.ts`
- `test/wasm/z80/next-ops.test.ts`
- `test/wasm/zxSpectrum/wasm-debug-step.test.ts`
- `src/emu/machines/zxSpectrum48/wasm/sp48/sp48.c`

Target files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-cpu.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-cpu.h`
- `test/wasm/zxNext/wasm-next-cpu.test.ts`
- `test/wasm/zxNext/wasm-next-oracle-types.ts`

Deviation guardrail:

- Each opcode test must compare TypeScript and WASM PC, SP, registers, flags,
  WZ, prefixes, HALT, IM/IFF, tacts, memory side effects, and stop reason.
- A WASM instruction may not be accepted because it matches another Spectrum
  model unless it also matches `Z80NMachineBase`.
- Validation: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-cpu.test.ts`.

Completion notes:

- Added a dedicated ZX Next WASM CPU slice for deterministic single-step
  execution of the parity-covered base opcodes before frame-loop migration.
- Added TypeScript-vs-WASM single-step tests that drive both machines through
  debug stepping and compare PC/SP, registers/flags, WZ, prefix, HALT, IM/IFF,
  tacts/current frame tact, sampled memory side effects, and stop reasons.
- Extended oracle CPU snapshots with prefix coverage.
- Validation passed with the Step 5 command plus the prior scaffold oracle
  tests, `npm run build:check`, and `git diff --check`.

### Step 6 - Debug Breakpoint Parity

Status: Done

Prove that breakpoints pause at the same address in TypeScript and WASM test
execution. `$0001` is a required explicit case.

TypeScript source files:

- `src/emu/machines/Z80MachineBase.ts`
- `src/emu/machines/zxNext/Z80NMachineBase.ts`
- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/abstractions/DebugStepMode.ts`
- `src/emu/abstractions/FrameTerminationMode.ts`
- `src/emu/abstractions/ResolvedBreakpoint.ts`
- `src/common/utils/breakpoints.ts`

Pattern source files:

- `test/wasm/zxSpectrum/wasm-debug-step.test.ts`
- `test/debug/DebugSupport.test.ts`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`

Target files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-debug.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-debug.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`
- `test/wasm/zxNext/wasm-next-debug-step.test.ts`

Deviation guardrail:

- The `$0001` breakpoint test must run the same loaded bytes and breakpoint
  definitions on TypeScript and WASM and assert the same PC, stop reason,
  executed instruction count, tacts, register view, and disassembly read.
- A frame/instruction safety guard may exist only as a failing diagnostic
  assertion, never as successful breakpoint behavior.
- Validation: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-debug-step.test.ts`.

Completion notes:

- Added a real ZX Next WASM debug loop that supports execution breakpoint
  stops, StepInto, StepOver, access-breakpoint checks, and completed-frame
  stepping without using a one-instruction scaffold stop as breakpoint behavior.
- Added parity tests for execution breakpoints, including the required `$0001`
  case, comparing TypeScript and WASM PC, stop reason, executed instruction
  count, tacts/current frame tact, register view, and disassembly preview.
- Updated the debug-tools scaffold test to install an explicit breakpoint and
  follow the new WASM debug-loop semantics.
- Validation passed with the Step 6 command plus related CPU/debug scaffold
  tests, `npm run build:check`, and `git diff --check`.

### Step 7 - Memory Map And Partition Parity

Status: Done

Migrate and test Next memory mapping before boot attempts.

TypeScript source files:

- `src/emu/machines/zxNext/MemoryDevice.ts`
- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/machines/zxNext/DivMmcDevice.ts`
- `src/emu/machines/zxNext/MultifaceDevice.ts`
- `src/emu/machines/zxNext/NextRegDevice.ts`
- `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`
- `test/zxnext/MemoryDevice.test.ts`
- `test/zxnext/MultifaceMemory.test.ts`

Pattern source files:

- `src/emu/machines/zxSpectrum48/wasm/sp48/sp48-memory.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128.c`
- `src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e.c`
- `test/wasm/zxSpectrum/wasm-memory-paging.test.ts`
- `test/wasm/zxSpectrum/wasm-partition-labels.test.ts`

Target files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-memory.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-memory.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`
- `test/wasm/zxNext/wasm-next-memory-mmu.test.ts`
- `test/wasm/zxNext/wasm-next-partition-labels.test.ts`

Deviation guardrail:

- Tests must clone the TypeScript memory-map matrix and compare every public
  read/write path used by debugger memory and disassembly views.
- Partition labels must be compared as strings against TypeScript results for
  ROM, SRAM, DivMMC, Multiface, alternate ROM, Layer 2, all-RAM, and sentinel
  mappings.
- Validation: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-partition-labels.test.ts`.

Completion notes:

- Added a dedicated ZX Next WASM memory mapping slice with MMU register reset,
  mapped read/write paths, ROM immutability, RAM remapping, alternate ROM
  labels, and all-RAM mode handling.
- Updated the WASM facade so flat-memory snapshots, memory partitions, current
  partitions, selected ROM/RAM state, partition labels, and breakpoint partition
  resolution are derived from the mapped WASM state instead of hardcoded reset
  data.
- Added TypeScript-vs-WASM parity tests for reset mapping, MMU NextReg remaps,
  system-region fallback, all-RAM writes, partition labels, and public debugger
  memory/disassembly read paths.
- Validation passed with the Step 7 command plus related CPU/debug/scaffold
  tests, `npm run build:check`, and `git diff --check`.

### Step 8 - NextReg And Port Core Parity

Status: Completed

Migrate NextReg core and port decoding with oracle tests for each port-side
effect. No real CPU/device frame execution until the port matrix is stable.

TypeScript source files:

- `src/emu/machines/zxNext/NextRegDevice.ts`
- `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts`
- `src/emu/machines/zxNext/io-ports/AyRegPortHandler.ts`
- `src/emu/machines/zxNext/io-ports/AyDatPortHandler.ts`
- `src/emu/machines/zxNext/io-ports/DacPortHandler.ts`
- `src/emu/machines/zxNext/io-ports/CtcPortHandler.ts`
- `src/emu/machines/zxNext/io-ports/KempstonHandler.ts`
- `test/zxnext/NextRegDevice.test.ts`
- `test/zxnext/NextIoPortManager.test.ts`
- `test/zxnext/PortEnableGating.test.ts`

Pattern source files:

- `test/wasm/zxSpectrum/wasm-ports-keyboard.test.ts`
- `test/wasm/zxSpectrum/wasm-screen-floating-bus.test.ts`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128.c`
- `src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e.c`

Target files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.h`
- `test/wasm/zxNext/wasm-next-nextreg.test.ts`
- `test/wasm/zxNext/wasm-next-ports.test.ts`

Deviation guardrail:

- Each migrated port test must run the same write/read sequence against
  TypeScript and WASM and compare return value, changed NextRegs, changed
  device state, memory side effects, and last bus event diagnostics.
- Open/floating bus behavior must be asserted separately; defaulting to `0xff`
  is not acceptable without matching TypeScript.

Completed in this step:

- Added WASM NextReg and port-core modules for reset defaults, NextReg
  select/data ports, ULA `$fe`, Timex/floating `$ff`, and gated memory paging
  ports `$7ffd`, `$dffd`, and `$1ffd`.
- Added WASM memory page-map inspector exports so facade partition labels and
  selected ROM/RAM state come from live mapping state rather than inferred MMU
  register bytes.
- Added oracle tests for reset defaults, NextReg side effects, memory-affecting
  NextRegs, paging ports, NR `$82` port gating, ULA read/write state, and
  Timex/floating read behavior.
- Validation passed with the Step 8 command, related CPU/debug/memory/scaffold
  tests, `npm run build:check`, and `git diff --check`.

### Step 9 - Interrupt, NMI, And RETN Parity

Status: Completed

Migrate interrupt and NMI semantics used by debug execution and boot code.

TypeScript source files:

- `src/emu/machines/zxNext/InterruptDevice.ts`
- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/machines/zxNext/NextRegDevice.ts`
- `src/emu/machines/zxNext/CtcDevice.ts`
- `src/emu/machines/zxNext/DmaDevice.ts`
- `src/emu/machines/zxNext/DivMmcDevice.ts`
- `src/emu/machines/zxNext/MultifaceDevice.ts`
- `src/emu/machines/zxNext/ExpansionBusDevice.ts`
- `test/zxnext/InterruptDevice.test.ts`
- `test/zxnext/NextInterrupts.test.ts`
- `test/zxnext/DaisyChain.test.ts`
- `test/zxnext/NmiStateMachine.test.ts`
- `test/zxnext/NmiSoftware.test.ts`
- `test/zxnext/StacklessNmi.test.ts`

Pattern source files:

- `test/wasm/z80/interrupts.test.ts`
- `test/wasm/zxSpectrum/wasm-debug-step.test.ts`
- `src/emu/machines/zxSpectrum48/wasm/sp48/sp48.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128.c`

Target files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-interrupts.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-interrupts.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nmi.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nmi.h`
- `test/wasm/zxNext/wasm-next-interrupts.test.ts`
- `test/wasm/zxNext/wasm-next-nmi.test.ts`

Deviation guardrail:

- Tests must compare interrupt request, acknowledge, vector, in-service state,
  RETN/RETI side effects, NMI cause, and PC/SP stack effects against the
  TypeScript machine.
- Boot smoke tests remain forbidden until these assertions pass.

Completed in this step:

- Added WASM interrupt and NMI modules for signal state, NextReg-backed
  interrupt controls, hardware IM2 vector selection, daisy in-service state,
  NMI cause tracking, stackless NMI return address handling, and RETN/RETI
  cleanup.
- Added CPU pre-fetch INT/NMI acceptance and ED RETN/RETI handling to the
  ZX Next WASM stepper.
- Added oracle tests covering IM1 INT stack effects, hardware IM2 vector and
  RETI in-service cleanup, normal NMI stack effects, and stackless NMI RETN
  return restoration.
- Validation passed with the Step 9 command, related ZX Next WASM regression
  tests, scaffold guard tests, `npm run build:check`, full `npm run test`, and
  `git diff --check`.

### Step 10 - Replace Scaffold Public Adapter Semantics

Status: Completed

Replace the Step 2 scaffold values with real WASM-owned public adapter
semantics after CPU, debug, memory, ports, and interrupt parity are proven. The
adapter must override every public surface whose state is WASM-owned; it must
not expose stale inherited TypeScript device state.

TypeScript source files:

- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/machines/zxNext/Z80NMachineBase.ts`
- `src/emu/machines/zxNext/ZxNextMachineFactory.ts`
- `src/common/machines/machine-renderer-registry.ts`
- `src/common/machines/machine-registry.ts`
- `src/renderer/appIde/disassemblers/z80-disassembler/zx-spectrum-next-disassembler.ts`

Pattern source files:

- `src/emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128WasmV2Machine.ts`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine.ts`
- `test/wasm/zxSpectrum/wasm-machine-lifecycle.test.ts`
- `test/wasm/zxSpectrum/wasm-test-control-surface.test.ts`

Target files:

- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`
- `test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts`
- `test/wasm/zxNext/wasm-next-public-adapter.test.ts`

Deviation guardrail:

- Adapter tests must verify that registers view, memory view, disassembly view,
  breakpoint/debug controls, NextReg inspection, screen buffer dimensions,
  reset, and hard reset all read real WASM-owned state after migration.
- Tests must fail if any Step 2 scaffold diagnostic remains for a surface that
  this step claims to have migrated.
- The factory must still default to TypeScript and must not expose a product
  picker model for WASM in this step.

Completed notes:

- `ZxNextWasmV2Machine` now limits scaffold diagnostics to the remaining frame
  runner surface and routes public adapter memory, screen, port, NextReg,
  register, reset, and debug semantics through WASM-owned state.
- Added ZX Next WASM lifecycle and public adapter tests covering reset/hard
  reset, register/memory/disassembly reads, breakpoint/debug controls, NextReg
  inspection, screen dimensions, diagnostics, and factory defaults.

### Step 11 - Replace Scaffold Frame Runner

Status: Completed

Replace the Step 3 scaffold frame loop with real CPU/device frame execution only
after debug, memory, port, and interrupt parity are already green. The frame
runner must mirror the TypeScript execution semantics for frame tact targets and
pause conditions.

TypeScript source files:

- `src/emu/machines/Z80MachineBase.ts`
- `src/emu/machines/zxNext/Z80NMachineBase.ts`
- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/abstractions/FrameTerminationMode.ts`
- `src/emu/abstractions/DebugStepMode.ts`
- `src/emu/abstractions/IAnyCpu.ts`

Pattern source files:

- `src/emu/machines/zxSpectrum48/ZxSpectrum48WasmV2Machine.ts`
- `src/emu/machines/zxSpectrum48/wasm/sp48/sp48.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128.c`
- `test/wasm/zxSpectrum/wasm-machine-lifecycle.test.ts`
- `test/wasm/zxSpectrum/wasm-contention.test.ts`

Target files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-frame.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-frame.h`
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`
- `test/wasm/zxNext/wasm-next-frame-runner.test.ts`

Deviation guardrail:

- Tests must assert frame tacts, completed frame count, termination mode,
  breakpoint stop, debug stop, frame command stop, and last rendered tact
  against TypeScript.
- Tests must fail if a successfully completed real frame reports the Step 3
  `scaffoldFrameComplete` stop reason.
- No arbitrary instruction-count guard may be used as normal frame completion.
  A guard may exist only as a failing diagnostic path.

Completed notes:

- Replaced the ZX Next WASM Step 3 frame scaffold with a CPU-driven C frame
  loop that runs until the rendering-frame tact target completes.
- The TypeScript adapter now treats queued frame commands as instruction-loop
  pause conditions before entering the full-frame WASM path.
- Added `wasm-next-frame-runner.test.ts` coverage for full-frame tact/frame
  parity, termination mode, execution-point stop, breakpoint stop, debug stop,
  frame-command stop, last rendered tact, and rejection of the old
  `scaffoldFrameComplete` stop reason.

### Step 12 - Early Boot Smoke Without Storage

Status: Completed

Boot only far enough to validate reset vectors, ROM contents, paging, and
debugger visibility. Do not treat visual output as proof of correctness.

TypeScript source files:

- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/machines/zxNext/ZxNextSysVars.ts`
- `src/emu/machines/zxNext/MemoryDevice.ts`
- `src/emu/machines/zxNext/rominfo.txt`
- `src/emu/machines/zxNext/bootsequence.txt`
- `src/public/roms/enNextZX.rom`
- `src/public/roms/enNxtmmc.rom`
- `src/public/roms/enNextMf.rom`
- `src/public/roms/enAltZX.rom`

Pattern source files:

- `test/wasm/zxSpectrum/wasm-oracle-programs.test.ts`
- `test/wasm/zxSpectrum/wasm-machine-lifecycle.test.ts`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine.ts`

Target files:

- `test/wasm/zxNext/wasm-next-early-boot.test.ts`
- `test/wasm/zxNext/wasm-next-boot-trace.ts`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-diagnostics.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-diagnostics.h`

Deviation guardrail:

- The boot trace must compare TypeScript and WASM PC, SP, tacts, active MMU
  pages, ROM byte reads, NextRegs, interrupt state, and stop reason at sampled
  instruction boundaries.
- A reset loop is a failing parity result, not a performance issue.

Completed notes:

- Added WASM physical-memory diagnostics for ROM byte and checksum validation.
- Added explicit ZX Next WASM ROM upload support and an early boot trace helper
  that samples reset plus the first two ROM instruction boundaries.
- Added `wasm-next-early-boot.test.ts` to compare TypeScript and WASM PC, SP,
  tacts, MMU pages, ROM byte reads, NextRegs, interrupt state, and debug stop
  reasons before storage is involved, with reset-loop detection as a parity
  failure.

### Step 13 - ULA, Keyboard, Tape, And Standard Screen

Status: Completed

Migrate keyboard matrix, tape EAR/MIC interaction, ULA port behavior, border,
floating bus, and standard ULA rendering.

TypeScript source files:

- `src/emu/machines/zxNext/UlaDevice.ts`
- `src/emu/machines/zxNext/NextKeyboardDevice.ts`
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`
- `src/emu/machines/zxNext/screen/TimingConfig.ts`
- `src/emu/machines/tape/TapeDevice.ts`
- `src/emu/abstractions/ITapeDevice.ts`
- `src/emu/abstractions/TapeMode.ts`
- `src/emu/abstractions/IGenericKeyboardDevice.ts`
- `test/zxnext/ula-rendering.test.ts`
- `test/zxnext/UlaRendering.test.ts`

Pattern source files:

- `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-ula.c`
- `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-keyboard.c`
- `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-tape.c`
- `test/wasm/zxSpectrum/wasm-ports-keyboard.test.ts`
- `test/wasm/zxSpectrum/wasm-screen-floating-bus.test.ts`
- `test/wasm/zxSpectrum/wasm-tape.test.ts`

Target files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ula.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ula.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-keyboard.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-keyboard.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-tape.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-tape.h`
- `test/wasm/zxNext/wasm-next-keyboard-ula.test.ts`
- `test/wasm/zxNext/wasm-next-tape.test.ts`
- `test/wasm/zxNext/wasm-next-screen-ula.test.ts`

Deviation guardrail:

- Tests must compare TypeScript and WASM keyboard row values, issue 2/3
  behavior, ULA port reads/writes, EAR/MIC/tape mode, border color, floating bus
  value, flash state, pixel buffer bytes, and sampled scanline timing.
- Spectrum common WASM ULA/keyboard/tape code may be reused only where these
  comparisons prove Next behavior is identical.

Completed notes:

- Split ZX Next WASM keyboard, tape, and ULA/screen behavior into owned C
  modules and routed port `$FE`, keyboard rows, tape MIC/EAR state, blank ULA
  rendering, flash state, and scanline timing diagnostics through them.
- Added adapter tape-device plumbing and WASM exports for tape state, ULA flash
  state, and sampled scanline/column timing.
- Added `wasm-next-keyboard-ula.test.ts`, `wasm-next-tape.test.ts`, and
  `wasm-next-screen-ula.test.ts` parity coverage for keyboard rows, issue 2/3
  behavior, ULA reads/writes, EAR/MIC/tape mode, border color, floating bus,
  flash state, pixel buffer bytes, and sampled scanline timing.

### Step 14 - DivMMC And SD SPI

Status: Completed

Migrate DivMMC automap and SD SPI state while keeping backing media and file I/O
in TypeScript.

TypeScript source files:

- `src/emu/machines/zxNext/DivMmcDevice.ts`
- `src/emu/machines/zxNext/storage/DivMmcDevice.ts`
- `src/emu/machines/zxNext/storage/IDivMmcDevice.ts`
- `src/emu/machines/zxNext/SdCardDevice.ts`
- `src/emu/machines/zxNext/MemoryDevice.ts`
- `src/emu/machines/zxNext/mmc.txt`
- `test/zxnext/DivMmmc.test.ts`
- `test/zxnext/DivMmcDevice-fpga.test.ts`
- `test/zxnext/DivMmcDevice-regression.test.ts`
- `test/zxnext/SdCardDevice.test.ts`

Pattern source files:

- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eWasmV2Machine.ts`
- `src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e.c`
- `test/wasm/zxSpectrum/wasm-p3e-disk.test.ts`

Target files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-divmmc.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-divmmc.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-sd.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-sd.h`
- `test/wasm/zxNext/wasm-next-divmmc.test.ts`
- `test/wasm/zxNext/wasm-next-sd-spi.test.ts`
- `test/wasm/zxNext/wasm-next-storage-commands.test.ts`

Deviation guardrail:

- Tests must compare automap entry/exit, CONMEM, MAPRAM, bank selection,
  memory-map side effects, SPI command state, frame command handoff, and
  response readiness against TypeScript.
- SD image file I/O remains TypeScript-owned; WASM may expose command buffers
  but must not own host files.

Completed notes:

- Added WASM DivMMC control/automap state with port `0xE3`, NextReg `0x09`,
  `0x0A`, `0x83`, and `0xB8`-`0xBB` decoding, before/after opcode-fetch
  entry points, NMI hold state, and lower-16K memory-map overrides.
- Added WASM SD SPI state for card select, command parsing, immediate SD
  responses, read/write host command buffers, response readiness, and card 0/1
  handoff metadata.
- Kept SD media/file I/O in TypeScript via `ZxNextWasmV2Machine` frame-command
  bridging and response injection into WASM-owned SPI state.
- Added oracle tests for DivMMC control and automap transitions, SD SPI command
  state, and storage command handoff/response readiness.

### Step 15 - NextZXOS Start Menu Milestone

Status: Not started

Attempt the first real NextZXOS start-menu milestone only after the preceding
oracle tests pass.

TypeScript source files:

- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/machines/zxNext/MemoryDevice.ts`
- `src/emu/machines/zxNext/NextRegDevice.ts`
- `src/emu/machines/zxNext/SdCardDevice.ts`
- `src/emu/machines/zxNext/DivMmcDevice.ts`
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`
- `src/emu/machines/zxNext/bootsequence.txt`

Pattern source files:

- `test/wasm/zxSpectrum/wasm-oracle-programs.test.ts`
- `test/wasm/zxSpectrum/wasm-machine-lifecycle.test.ts`
- `test/wasm/zxSpectrum/wasm-p3e-disk.test.ts`

Target files:

- `test/wasm/zxNext/wasm-next-start-menu.test.ts`
- `test/wasm/zxNext/wasm-next-boot-trace.ts`
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`

Deviation guardrail:

- The test must include a TypeScript boot trace and a WASM boot trace with
  sampled PC, tacts, MMU pages, NextRegs, memory reads, SD state, screen
  checksum, and stop reason.
- Reaching a visible menu is not enough; the trace must not diverge before the
  accepted milestone.

### Step 16 - Advanced Video

Status: Not started

Migrate palette, ULA+, Timex, Layer 2, LoRes, tilemap, sprites, copper, and full
composition in separate parity slices.

TypeScript source files:

- `src/emu/machines/zxNext/PaletteDevice.ts`
- `src/emu/machines/zxNext/TilemapDevice.ts`
- `src/emu/machines/zxNext/SpriteDevice.ts`
- `src/emu/machines/zxNext/CopperDevice.ts`
- `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts`
- `src/emu/machines/zxNext/palette.ts`
- `src/emu/machines/zxNext/screen/screen_rendering.md`
- `src/emu/machines/zxNext/screen/sprites.md`
- `test/zxnext/PaletteDevice.test.ts`
- `test/zxnext/PaletteDeviceFpgaFixes.test.ts`
- `test/zxnext/Layer2Fixes.test.ts`
- `test/zxnext/LoResFixes.test.ts`
- `test/zxnext/TilemapDevice-d1d2.test.ts`
- `test/zxnext/TilemapDevice-compositing.test.ts`
- `test/zxnext/SpriteDevice.test.ts`
- `test/zxnext/CopperDevice.test.ts`

Pattern source files:

- `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-ula.c`
- `test/wasm/zxSpectrum/wasm-screen-floating-bus.test.ts`

Target files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-palette.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-palette.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-layer2.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-layer2.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-tilemap.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-tilemap.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-sprites.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-sprites.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-copper.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-copper.h`
- `test/wasm/zxNext/wasm-next-palette-ulaplus.test.ts`
- `test/wasm/zxNext/wasm-next-layer2-lores.test.ts`
- `test/wasm/zxNext/wasm-next-tilemap.test.ts`
- `test/wasm/zxNext/wasm-next-sprites.test.ts`
- `test/wasm/zxNext/wasm-next-copper.test.ts`
- `test/wasm/zxNext/wasm-next-screen-composition.test.ts`

Deviation guardrail:

- Each video slice must compare TypeScript and WASM register state, palette
  entries, clip windows, scroll registers, layer enable bits, priority rules,
  per-layer pixel samples, and final composed pixel samples.
- The final composition test must use existing TypeScript regression cases as
  input data, not newly invented simplified scenes.

### Step 17 - Audio

Status: Not started

Migrate beeper, PSG/TurboSound, DAC, mixer routing, and sample buffer exposure.

TypeScript source files:

- `src/emu/machines/BeeperDevice.ts`
- `src/emu/machines/zxSpectrum/ISpectrumBeeperDevice.ts`
- `src/emu/machines/zxSpectrum128/PsgChip.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128PsgDevice.ts`
- `src/emu/machines/zxNext/NextSoundDevice.ts`
- `src/emu/machines/zxNext/TurboSoundDevice.ts`
- `src/emu/machines/zxNext/DacDevice.ts`
- `src/emu/machines/zxNext/DacNextRegDevice.ts`
- `src/emu/machines/zxNext/DacPortDevice.ts`
- `src/emu/machines/zxNext/AudioControlDevice.ts`
- `src/emu/machines/zxNext/AudioMixerDevice.ts`
- `src/emu/abstractions/IGenericBeeperDevice.ts`
- `src/emu/abstractions/IGenericPsgDevice.ts`
- `src/emu/abstractions/PsgChipState.ts`
- `test/audio/BeeperDevice.test.ts`
- `test/audio/PsgDevice.test.ts`
- `test/audio/PsgCompatibility.step14.test.ts`

Pattern source files:

- `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-beeper.c`
- `src/emu/machines/zxSpectrum128/wasm/sp128/sp128-psg.c`
- `test/wasm/zxSpectrum/wasm-beeper-audio.test.ts`
- `test/wasm/zxSpectrum/wasm-psg-audio.test.ts`

Target files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-beeper.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-beeper.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-psg.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-psg.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-dac.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-dac.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-audio-mixer.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-audio-mixer.h`
- `test/wasm/zxNext/wasm-next-beeper-audio.test.ts`
- `test/wasm/zxNext/wasm-next-psg-audio.test.ts`
- `test/wasm/zxNext/wasm-next-dac-audio.test.ts`
- `test/wasm/zxNext/wasm-next-audio-mixer.test.ts`

Deviation guardrail:

- Tests must compare TypeScript and WASM sample counts, sample values at fixed
  tacts, beeper EAR transitions, PSG register masking, envelope/noise behavior,
  TurboSound chip selection, DAC writes, mixer routing, and frame buffer export.
- Existing Spectrum WASM beeper/PSG patterns may be reused only after the Next
  audio devices produce identical oracle samples for the tested sequences.

### Step 18 - DMA, CTC, UART, I2C, Joystick, Mouse, Expansion, And Floppy

Status: Not started

Migrate remaining devices with sibling tests copied from the TypeScript Next
coverage and oracle assertions where public behavior spans multiple devices.

TypeScript source files:

- `src/emu/machines/zxNext/DmaDevice.ts`
- `src/emu/machines/zxNext/CtcDevice.ts`
- `src/emu/machines/zxNext/UartDevice.ts`
- `src/emu/machines/zxNext/I2cDevice.ts`
- `src/emu/machines/zxNext/JoystickDevice.ts`
- `src/emu/machines/zxNext/MouseDevice.ts`
- `src/emu/machines/zxNext/ExpansionBusDevice.ts`
- `src/emu/machines/zxNext/MultifaceDevice.ts`
- `src/emu/machines/disk/FloppyControllerDevice.ts`
- `src/emu/machines/zxNext/io-ports/Z80DmaPortHandler.ts`
- `src/emu/machines/zxNext/io-ports/ZxnDmaPortHandler.ts`
- `src/emu/machines/zxNext/io-ports/UartRxPortHandler.ts`
- `src/emu/machines/zxNext/io-ports/UartTxPortHandler.ts`
- `src/emu/machines/zxNext/io-ports/I2cSclPortHandler.ts`
- `src/emu/machines/zxNext/io-ports/I2cSdaPortHandler.ts`
- `test/zxnext/DmaDevice.test.ts`
- `test/zxnext/CtcDevice.test.ts`
- `test/zxnext/UartDevice.test.ts`
- `test/zxnext/I2cDevice.test.ts`
- `test/zxnext/KempstonJoystick.test.ts`
- `test/zxnext/KempstonMouse.test.ts`
- `test/zxnext/ExpansionBusDevice.test.ts`
- `test/zxnext/MultifaceDevice.test.ts`
- `test/zxnext/FloppyControllerDevice.test.ts`

Pattern source files:

- `src/emu/machines/zxSpectrumP3e/wasm/spp3e/spp3e.c`
- `test/wasm/zxSpectrum/wasm-p3e-disk.test.ts`
- `test/wasm/zxSpectrum/wasm-ports-keyboard.test.ts`

Target files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-dma.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-dma.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ctc.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ctc.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-uart.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-uart.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-i2c.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-i2c.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-input.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-input.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-expansion.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-expansion.h`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-floppy.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-floppy.h`
- `test/wasm/zxNext/wasm-next-dma.test.ts`
- `test/wasm/zxNext/wasm-next-ctc.test.ts`
- `test/wasm/zxNext/wasm-next-uart-i2c.test.ts`
- `test/wasm/zxNext/wasm-next-input.test.ts`
- `test/wasm/zxNext/wasm-next-expansion-multiface.test.ts`
- `test/wasm/zxNext/wasm-next-floppy.test.ts`

Deviation guardrail:

- Every migrated device must start from the existing TypeScript device tests and
  add a TypeScript-vs-WASM oracle assertion for port values, register state,
  memory side effects, interrupt requests, timing, and frame command handoff.
- Host-owned media, wall-clock policy, and UI state must remain TypeScript-owned.

### Step 19 - Performance And Boundary Audit

Status: Not started

Benchmark only after correctness milestones pass. Compare TypeScript and WASM
frame timings, exported memory bounds, typed view stability, package size, and
diagnostic stop reasons.

TypeScript source files:

- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/machines/zxNext/Z80NMachineBase.ts`
- `package.json`

Pattern source files:

- `scripts/benchmark-spectrum-wasm.cjs`
- `scripts/check-sp48-wasm-size.cjs`
- `scripts/check-sp128-wasm-size.cjs`
- `scripts/check-spp3e-wasm-size.cjs`
- `test/wasm/zxSpectrum/wasm-machine-lifecycle.test.ts`

Target files:

- `scripts/benchmark-zxnext-wasm.cjs`
- `scripts/check-zxnext-wasm-size.cjs`
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`
- `test/wasm/zxNext/wasm-next-performance-boundary.test.ts`
- `package.json`

Deviation guardrail:

- Benchmark output must include frame stop reason distribution. Any successful
  frame stopped by a safety guard fails the boundary audit.
- Size and typed-view checks must fail on out-of-bounds views, changed exported
  memory layout, or package artifact drift.

### Step 20 - Rollout

Status: Not started

Add product-facing implementation selection only after the full public adapter,
debugger, memory map, disassembly, registers, boot, screen, audio, storage, and
performance checks pass.

TypeScript source files:

- `src/emu/machines/zxNext/ZxNextMachineFactory.ts`
- `src/common/machines/constants.ts`
- `src/common/machines/machine-registry.ts`
- `src/common/machines/machine-renderer-registry.ts`
- `package.json`

Pattern source files:

- `src/emu/machines/zxSpectrum48/ZxSpectrum48Implementation.ts`
- `src/emu/machines/zxSpectrum48/ZxSpectrum48MachineFactory.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128Implementation.ts`
- `src/emu/machines/zxSpectrum128/ZxSpectrum128MachineFactory.ts`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eImplementation.ts`
- `src/emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachineFactory.ts`
- `test/wasm/zxSpectrum/wasm-machine-lifecycle.test.ts`

Target files:

- `src/common/machines/constants.ts`
- `src/emu/machines/zxNext/ZxNextImplementation.ts`
- `src/emu/machines/zxNext/ZxNextMachineFactory.ts`
- `src/common/machines/machine-renderer-registry.ts`
- `package.json`
- `test/zxnext/ZxNextMachineFactory.test.ts`
- `test/wasm/zxNext/wasm-next-rollout.test.ts`

Deviation guardrail:

- Rollout tests must prove default behavior, explicit TypeScript selection,
  explicit WASM selection, unknown value fallback, renderer registry routing,
  product-oriented model list, package resource copy, and full acceptance-suite
  execution.
- The default may change to WASM only after this plan records passing commands
  for Steps 1-19.

## Acceptance Criteria

- `$0001` breakpoint pauses in WASM exactly as in TypeScript.
- Register, memory, disassembly, and NextReg views show WASM-owned live state.
- NextZXOS boots through the start-menu milestone without reset loops.
- Frames stop because they reached the TypeScript-equivalent tact target or a
  debugger condition, not because a safety guard was hit.
- TypeScript remains available as oracle and fallback until rollout.
- Existing TypeScript Next tests still pass throughout migration.
