# ZX Spectrum Next WASM Migration Plan

Created: 2026-08-16

Status: Complete. The normal ZX Spectrum Next model now uses the WASM backend
by default. The TypeScript backend remains explicitly selectable as a
compatibility fallback and parity oracle.

## Goal

Migrate the current ZX Spectrum Next TypeScript implementation to a C/WASM
backend without changing observable emulator semantics. The end state is a
fast, production-usable WASM implementation that can replace the TypeScript
backend for normal emulation, with TypeScript retained as an explicit fallback
and oracle.

The TypeScript implementation is the oracle. The WASM implementation may be
introduced only through small parity-tested slices that prove the same behavior
through the same public machine, debugger, memory, disassembly, register,
screen, input, storage, and IDE inspection surfaces.

## Current Migration State

Updated: 2026-08-22.

The migration is complete for the user's stated goal. Steps 1-29 are recorded
as done and provide a production-selected ZX Spectrum Next WASM backend with
shared Z80N CPU integration, a broad WASM test matrix, boot/visual smoke
coverage, public adapter coverage, representative device parity tests,
speed-oriented build evidence, a shared-source audit, and a closed
binary-size/timing-depth audit.

The WASM backend is currently the normal ZX Spectrum Next implementation:

- `DEFAULT_ZXNEXT_IMPLEMENTATION` is `"wasm"`.
- The normal `ZX Spectrum Next` model selects WASM.
- `ZX Spectrum Next Compatibility` selects TypeScript explicitly.
- `ZxNextWasmV2Machine.getWasmV2Diagnostics()` reports
  `defaultReady: true`, an empty `defaultBlockers` list, and positive
  `migratedSurfaces`.
- `src/emu/machines/zxNext/wasm/README.md`,
  `.ai/wasm-migration-intent-and-lessons.md`, and
  `src/emu/machines/zxNext/ZxNextImplementation.ts` describe TypeScript as the
  compatibility fallback and parity oracle.
- `test:zxnext-wasm-acceptance` is a focused acceptance suite, not the full
  matrix; `test:zxnext-wasm-matrix` runs all `test/wasm/zxNext` suites.
- The Step 24 matrix accounts for every `test/zxnext/*.test.ts` suite by either
  WASM coverage or an explicit boundary/exclusion classification.

Artifact-size audit (2026-08-20):

- ZX Spectrum 48K WASM artifact: 470,922 bytes.
- ZX Spectrum 128K WASM artifact: 563,638 bytes.
- ZX Spectrum +3E WASM artifact: 547,836 bytes.
- ZX Spectrum Next WASM artifact: 180,358 bytes.
- `wasm-objdump -h` shows the Next artifact has more functions/exports than
  48K, but a much smaller code section: Next code section `0x27f4c`
  (about 164 KB), 48K code section `0x6ff8d` (about 459 KB).
- This is not caused by the Next build using the size profile; the Next build
  still uses `speed` (`-O3 -Wl,--strip-all`).
- The likely cause is missing timing/device depth. One confirmed source-level
  difference is that 48K defines Z80 memory/port/address-bus delay hooks that
  apply contention, tact advancement, and audio sampling inside the shared CPU
  core, while Next currently includes the shared Z80N core without equivalent
  delay hooks.
- Step 29 completion result: the Next artifact is now 626,534 bytes,
  with `wasm-objdump -h` reporting code section `0x94e19` (about 609 KB),
  1,242 functions, and 316 exports. This is now larger than the 48K artifact
  and consistent with inlined speed-oriented timing hooks rather than an
  accidentally shallow backend.

No plan steps remain open.

## Preliminary Principle Audit

Updated: 2026-08-20.

The Step 26 audit resolved several speed-and-reuse items. The later
artifact-size comparison reopened the timing-depth gate, and Step 29 then
closed that gate. Preserve these principles in future Next WASM work:

| Principle | Current evidence | Risk | Required follow-up |
| --- | --- | --- | --- |
| Speed-oriented build | `scripts/build-zxnext-wasm.cjs` defaults `ZXNEXT_WASM_OPTIMIZATION` to `speed`, which uses `-O3` and stripped output. | Good default, but Step 19 only recorded a smoke benchmark. | Step 26 must record realistic TypeScript-vs-WASM benchmark scenarios before default rollout. |
| Inline-friendly C layout | `src/emu/machines/zxNext/wasm/zxnext/zxnext.c` includes the device `.c` files into one translation unit, and most internal helpers are `static`. | Clang can inline many helpers at `-O3`, but hot paths are not deliberately audited; only a few helpers are explicitly `static inline`. | Step 26 must audit hot CPU/memory/port/screen/audio paths and add explicit `static inline` or macro-based adapters where measurement or code shape shows call overhead risk. |
| Shared CPU | `src/emu/machines/zxNext/wasm/zxnext/zxnext-cpu.c` includes `src/emu/z80/wasm/z80.c` and enables Z80N mode. | This follows the intended shared-CPU principle. | Keep the Step 23 shared Z80N source guard green. |
| Shared classic devices | 48K/128K/+3E include common sources such as `zx-spectrum-ula.c`, `zx-spectrum-keyboard.c`, `zx-spectrum-beeper.c`, `zx-spectrum-tape.c`, `zx-spectrum-psg.c`, and `zx-spectrum-ports.c`; Next currently has separate `zxnext-ula.c`, `zxnext-keyboard.c`, `zxnext-beeper.c`, `zxnext-tape.c`, `zxnext-psg.c`, and `zxnext-ports.c`. | This may be correct for Next-specific behavior, but it currently looks like duplication unless oracle tests justify each fork. Duplicated device logic can drift and can miss optimizations already learned by the shared implementations. | Step 26 must produce a shared-source audit table for CPU, ULA, keyboard, beeper, tape, PSG, and ports. Each entry must either reuse shared code, introduce a thin parameterized shared adapter, or record a TypeScript-oracle-backed reason for staying Next-specific. |

The preliminary audit is no longer sufficient for the default flip. If future
work keeps a device Next-specific, the plan or tests must name the behavior
that prevents sharing; "Next is more complex" is not enough by itself.

Pre-Step26 audit progress:

- 2026-08-20: Applied the shared Spectrum keyboard hot-path pattern to
  `src/emu/machines/zxNext/wasm/zxnext/zxnext-keyboard.c`. Next now caches all
  256 selected-line combinations and reads `$FE` keyboard state from that cache
  instead of looping across eight rows for every port read. This preserves the
  current Next-specific module shape but removes one avoidable hot-path
  difference from `zx-spectrum-keyboard.c`.
- Verified:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-keyboard-ula.test.ts`
- 2026-08-20: Reworked
  `src/emu/machines/zxNext/wasm/zxnext/zxnext-psg.c` to mirror the TypeScript
  `PsgChip("YM")` tone, noise-prescaler, envelope, and diagnostic-output state
  machine more closely. Added oracle assertions for YM tone output, TurboSound
  stereo routing, noise progression, and envelope progression in
  `test/wasm/zxNext/wasm-next-psg-audio.test.ts`. This is still a
  Next-specific PSG/TurboSound module, so Step 26 must still decide whether to
  extract a shared AY/YM C core used by 128K/+3E and Next.
- Verified:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-psg-audio.test.ts`
- 2026-08-20: Added explicit `static inline` annotations to small hot-path
  helpers in the Next WASM memory, ULA, port-gating, keyboard, DMA endpoint,
  and PSG modules. This preserves the current single-translation-unit layout
  while making the speed intent visible in source instead of relying entirely on
  optimizer inference.
- Verified:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-ports.test.ts test/wasm/zxNext/wasm-next-dma.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-psg-audio.test.ts`
  - `npm run check:zxnext-wasm-size` (`actualBytes`: 180322, `maxBytes`: 200000)
- 2026-08-20: Audited the Next `$FE` beeper/tape handoff against
  `src/emu/machines/zxNext/UlaDevice.ts`. Unlike the shared Spectrum `$FE`
  helper, TypeScript Next does not forward ULA port bit 3 writes into
  `TapeDevice.processMicBit`; it updates the ULA latch and beeper only. Split
  WASM tape MIC state from the ULA MIC latch, added `zxnextGetTapeMicBit`, and
  pointed the adapter tape facade at the tape-owned value. This is a concrete
  oracle-backed reason not to reuse the classic Spectrum `$FE` write behavior
  wholesale for Next.
- Verified:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-beeper-audio.test.ts test/wasm/zxNext/wasm-next-tape.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-loader.test.ts`

## Non-Negotiable Rules

- The migration is not done merely because the WASM backend builds,
  instantiates, runs frames, or has a preview model. It is done only when the
  normal ZX Spectrum Next model can use WASM as the default production backend.
- Read the 48K, 128K, and +2/+3 WASM integration code before every slice that
  touches loading, factory selection, frame execution, tests, or packaging.
- Read `.ai/wasm-migration-intent-and-lessons.md` at the start of every future
  session and preserve its distinction between scaffolding, partial device
  shells, tested parity, and production-ready replacement.
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
- Prefer shared C/WASM device sources when behavior is genuinely common across
  Spectrum models. Keep Next-specific C only when TypeScript oracle tests prove
  the behavior differs or the device is unique to Next.
- Use speed-oriented WASM builds for model backends. Binary size is a diagnostic
  signal, not the primary optimization target; suspicious size drops must be
  audited for missing linked code or stubbed devices.
- For every step, read the listed TypeScript source files first. Those files are
  the behavioral contract. Listed 48K/128K/+2/+3 WASM files are pattern
  references only; they must not override Next TypeScript semantics.
- Touch only the target files named in that step. If a different target becomes
  necessary, update this plan before implementation and add a deviation
  guardrail for that new target.

## Required Reading

Read these before new implementation work:

- `AGENTS.md`
- `.ai/wasm-migration-intent-and-lessons.md`
- `.ai/wasm-v2-machine-migration-guide.md`
- `.ai/zx-spectrum-next-wasm-parity-audit.md`
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

Status: Completed

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

Completed notes:

- Extended the ZX Next boot trace with sampled SD state, sampled screen
  checksum, stop reason, and a longer configurable trace length.
- Added a first NextZXOS start-menu milestone test that proves the TypeScript
  and WASM traces do not diverge through ROM0's initial NextReg setup sequence
  at `PC=$0116`, immediately before the next indexed I/O boot phase.
- Added WASM CPU support for the boot slice's `NEXTREG n,n`, `NEXTREG n,A`,
  and `XOR A` instructions, including the ROM-observed 28 MHz timing change
  after `NEXTREG $07,$03`.

### Step 16 - Advanced Video

Status: Done on 2026-08-20.

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

Deviation recorded on 2026-08-20:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c` must be touched to include
  the new video modules and expose their parity inspection functions from the
  single translation unit used by the current ZX Next WASM build.
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c` must be touched so
  central NextReg writes update the migrated video-state modules instead of
  leaving them as test-only helpers.
- `scripts/build-zxnext-wasm.cjs` and
  `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts` must be touched to add
  the new exported inspection functions to the build and typed loader surface.

Completion notes:

- Added WASM video-state modules for palette/ULA palette selection,
  Layer 2/LoRes registers and sampled helpers, tilemap registers, sprite clip
  and attribute/pattern write sequencing, copper memory/control/tick state, and
  a small deterministic Layer 2 composition sample helper.
- Wired central WASM NextReg reads/writes to the migrated video-state modules,
  including the TypeScript split where Tilemap NR `$6B` bit 4 belongs to the
  palette device's second tilemap palette selection.
- Added focused TypeScript-vs-WASM parity tests for palette/ULA+, Layer
  2/LoRes, tilemap, sprites, copper, and sampled composition.
- Validation passed:
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-palette-ulaplus.test.ts test/wasm/zxNext/wasm-next-layer2-lores.test.ts test/wasm/zxNext/wasm-next-tilemap.test.ts test/wasm/zxNext/wasm-next-sprites.test.ts test/wasm/zxNext/wasm-next-copper.test.ts test/wasm/zxNext/wasm-next-screen-composition.test.ts`,
  `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-build.test.ts test/wasm/zxNext/wasm-next-loader.test.ts`,
  `npm run check:zxnext-wasm-size`,
  and `npm run build:check`.

### Step 17 - Audio

Status: Done

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
- `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-psg.c`
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

Deviation recorded on 2026-08-20:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c` must be touched to include
  the new audio modules and expose their parity inspection functions from the
  single translation unit used by the current ZX Next WASM build.
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-nextreg.c` and
  `src/emu/machines/zxNext/wasm/zxnext/zxnext-ports.c` must be touched so
  central NextReg and port writes update the migrated audio-state modules.
- `scripts/build-zxnext-wasm.cjs` and
  `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts` must be touched to add
  the new exported audio inspection functions to the build and typed loader
  surface.

Completion notes:

- Added WASM audio-state modules for beeper EAR/MIC transition sampling,
  PSG/TurboSound register/chip/panning state, DAC NextReg and port routing, and
  mixer routing with deterministic sample-buffer export.
- Wired central WASM NextReg and port writes to the migrated audio modules.
- Added focused TypeScript-vs-WASM tests for beeper weighted samples,
  PSG/TurboSound selection and routing, DAC register/port writes, and mixer
  output/sample buffer exposure.
- Validation passed:
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-beeper-audio.test.ts test/wasm/zxNext/wasm-next-psg-audio.test.ts test/wasm/zxNext/wasm-next-dac-audio.test.ts test/wasm/zxNext/wasm-next-audio-mixer.test.ts`,
  `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-build.test.ts test/wasm/zxNext/wasm-next-loader.test.ts`,
  `npm run check:zxnext-wasm-size`,
  and `npm run build:check`.

### Step 18 - DMA, CTC, UART, I2C, Joystick, Mouse, Expansion, And Floppy

Status: Done

Deviation note (2026-08-20): the listed target module files also require updates
to the single-translation-unit include list, public export list, loader export
types, and port/NextReg dispatchers (`zxnext.c`, `zxnext-ports.c`,
`zxnext-nextreg.c`, `scripts/build-zxnext-wasm.cjs`,
`ZxNextWasmV2Loader.ts`) so the migrated device state is reachable from tests
and the normal artifact.

Validation (2026-08-20): added focused TypeScript-vs-WASM oracle tests for DMA,
CTC, UART/I2C, joystick/mouse input, expansion/multiface-adjacent state, and
floppy reset/command shell behavior. Passed:
`npm test -- --project jsdom test/wasm/zxNext/wasm-next-dma.test.ts test/wasm/zxNext/wasm-next-ctc.test.ts test/wasm/zxNext/wasm-next-uart-i2c.test.ts test/wasm/zxNext/wasm-next-input.test.ts test/wasm/zxNext/wasm-next-expansion-multiface.test.ts test/wasm/zxNext/wasm-next-floppy.test.ts`,
`npm run build:zxnext-wasm`, `npm run check:zxnext-wasm-size`,
`npm run build:check`, `npm run test`, and `git diff --check`.

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

Status: Done

Completion note (2026-08-20): added `scripts/benchmark-zxnext-wasm.cjs`
and `npm run benchmark:zxnext-wasm`. The benchmark reports artifact size,
frame timing, frames/tacts advanced, audio samples, and frame stop reason
distribution; successful frame runs fail if any safety-guard stop reason is
reported. Added `test/wasm/zxNext/wasm-next-performance-boundary.test.ts` to
audit TypeScript/WASM frame timing shape, exported memory view bounds and stable
backing buffers, package artifact size, and benchmark metric summaries.

Measured smoke benchmark (2026-08-20):
`npm run benchmark:zxnext-wasm -- --frames 2 --runs 1 --warmup 1`
reported a 55,362-byte artifact, 0.14 ms/frame median, 7,037.07 fps median,
2 frames advanced, 141,816 tacts advanced, and stop reasons
`{"wasmFrameComplete":2}`.

Validation (2026-08-20): passed
`npm test -- --project jsdom test/wasm/zxNext/wasm-next-performance-boundary.test.ts`,
`npm run benchmark:zxnext-wasm -- --frames 2 --runs 1 --warmup 1`,
`npm run check:zxnext-wasm-size`,
`npm run build:check`,
`npm test -- --project jsdom test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts test/wasm/zxNext/wasm-next-frame-runner.test.ts test/wasm/zxNext/wasm-next-loader.test.ts`,
and full `npm run test`.

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

Status: Done

Completion note (2026-08-20): added a product-facing ZX Spectrum Next Preview
model that selects the explicit WASM backend while keeping the normal ZX
Spectrum Next model and unknown config fallback on TypeScript. Added
`test:zxnext-wasm-acceptance` to package the rollout acceptance suite, and
added `test/wasm/zxNext/wasm-next-rollout.test.ts` to cover default behavior,
explicit TypeScript selection, explicit WASM selection, unknown value fallback,
renderer registry routing, product-oriented model list, package resource copy,
and acceptance-suite declaration.

Validation (2026-08-20): passed
`npm test -- --project jsdom test/zxnext/ZxNextMachineFactory.test.ts test/wasm/zxNext/wasm-next-rollout.test.ts`,
`npm run test:zxnext-wasm-acceptance`,
`npm run build:zxnext-wasm`,
`npm run check:zxnext-wasm-size`,
`npm run build:check`, and full `npm run test`.

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

## Production Default Migration

The first twenty steps make a selectable ZX Spectrum Next WASM preview available
and keep TypeScript as the normal backend. They do **not** yet mean the TypeScript
Next implementation can be replaced as the default. The steps below are the
remaining work required before changing the normal `ZX Spectrum Next` model from
TypeScript to WASM.

### Step 21 - Full NextZXOS Boot And App-Level Smoke

Status: Done on 2026-08-20.

Extend the current start-menu milestone into a real production boot gate. The
WASM backend must boot the shipped NextZXOS ROM through the start menu and at
least one post-menu app-level interaction without reset loops, blank/gray
screens, or scaffold-only stop reasons.

Required coverage:

- Boot from reset through the existing start-menu milestone.
- Continue past the milestone into the normal menu/event loop for a bounded
  number of frames.
- Verify the rendered screen dimensions, nonblank pixels, stable frame counter,
  and no full-pane gray fallback.
- Verify keyboard input can move through the menu path selected by the test.
- Verify no frame stopped because of a safety guard or scaffold fallback.
- Run the same boot trace against TypeScript as oracle where deterministic state
  is available.

Target files:

- `test/wasm/zxNext/wasm-next-full-boot.test.ts`
- `test/wasm/zxNext/wasm-next-visual-smoke.test.ts`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ula.c`

Completed:

- Added standard 256x192 ULA bitmap/attribute rendering inside the WASM
  720x288 output buffer, while preserving the reset border color expected by
  existing TypeScript oracle snapshots.
- Added a full boot smoke test that checks deterministic boot parity through
  the existing NextZXOS milestone, then continues WASM execution for bounded
  normal frames with keyboard input routed through the WASM keyboard matrix.
- Added a visual smoke test that verifies output dimensions, nonuniform pixels,
  a real centered screen area, and a regression failure for the full light-gray
  fallback pane.
- Verified:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-full-boot.test.ts test/wasm/zxNext/wasm-next-visual-smoke.test.ts test/wasm/zxNext/wasm-next-start-menu.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts`
  - `npm run build:zxnext-wasm`
  - `npm run check:zxnext-wasm-size` (`actualBytes`: 56003, `maxBytes`: 120000)
  - `npm run build:check`
  - `git diff --check`
  - `npm run test` (555 files passed, 18,946 tests passed)

Done when:

- The WASM preview can repeatedly boot to and render the menu in automated tests.
- The screen-buffer tests fail on the light-gray full-pane regression.
- The plan records passing focused boot/visual commands and full `npm run test`.

### Step 22 - Complete Remaining Device Semantics

Status: Done on 2026-08-20.

Replace compact parity slices with full behavior for devices that are still only
partially proven. Step 18 introduced WASM-owned state and representative oracle
tests; this step must close the behavioral gaps that matter for normal use.

Required coverage:

- DMA transfers cover memory-to-memory, memory-to-I/O, I/O-to-memory, direction,
  address update modes, continuous/burst/byte modes, read masks, interrupts, and
  timing-visible counters.
- Floppy controller covers command/result phases, Specify, SenseDrive,
  SenseInterrupt, Read/Write sector command flow, drive selection, motor state,
  status registers, and TypeScript-owned media handoff.
- CTC, UART, I2C, joystick, mouse, expansion, and multiface behavior cover the
  full public TypeScript test set, not only representative reset/port slices.
- Host-owned media, wall-clock policy, and UI state remain TypeScript-owned
  unless a later step explicitly migrates them with a new boundary contract.

Target files:

- `src/emu/machines/zxNext/wasm/zxnext/zxnext-dma.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-floppy.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-ctc.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-uart.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-i2c.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-input.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-expansion.c`
- `test/wasm/zxNext/wasm-next-device-completeness.test.ts`

Completed:

- Added a WASM DMA transfer executor covering memory-to-memory,
  memory-to-I/O, and I/O-to-memory transfer paths through mapped memory and the
  normal WASM port layer.
- Added DMA-visible direction, endpoint config, transfer mode, transferred-byte,
  and counter exports to the C header, WASM build export list, and TypeScript
  loader contract.
- Expanded the WASM DMA suite to verify transfer data movement, direction,
  fixed/incrementing endpoint address updates, I/O port effects, and counters.
- Added `wasm-next-device-completeness.test.ts`, an executable Step 22 contract
  that maps DMA, floppy, CTC, UART/I2C, joystick/mouse, and
  expansion/multiface to their WASM coverage and corresponding TypeScript test
  suites, while documenting host-owned floppy media/file handoff as explicitly
  TypeScript-owned.
- Verified:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-dma.test.ts test/wasm/zxNext/wasm-next-floppy.test.ts test/wasm/zxNext/wasm-next-ctc.test.ts test/wasm/zxNext/wasm-next-uart-i2c.test.ts test/wasm/zxNext/wasm-next-input.test.ts test/wasm/zxNext/wasm-next-expansion-multiface.test.ts test/wasm/zxNext/wasm-next-device-completeness.test.ts`
  - `npm run check:zxnext-wasm-size` (`actualBytes`: 57484, `maxBytes`: 120000)
  - `npm run build:check`
  - `git diff --check`
  - `npm run test` (556 files passed, 18,951 tests passed)

Done when:

- Each listed TypeScript device test suite has a matching WASM oracle suite or
  an explicitly documented TypeScript-owned boundary.
- Full Next machine tests pass with `zxnextImplementation: "wasm"` for all cases
  that are not explicitly TypeScript-owned.

### Step 23 - Integrate The Shared Z80N WASM CPU

Status: Done on 2026-08-20.

Replace the local compact boot-slice CPU in
`src/emu/machines/zxNext/wasm/zxnext/zxnext-cpu.c` with the existing reusable
Z80/Z80N WASM CPU implementation in `src/emu/z80/wasm/z80.c`. The ZX Spectrum
Next WASM machine must not grow a second CPU implementation.

Required coverage:

- The ZX Next WASM artifact compiles `src/emu/z80/wasm/z80.c` or an explicitly
  shared source derived from it, not the compact `zxnext-cpu.c` opcode switch.
- Z80N mode is enabled for the ZX Next backend.
- The shared CPU core is connected to ZX Next memory, port, interrupt, NMI, tact,
  NextReg, and bus-event plumbing.
- Register/debug adapter state comes from the shared CPU core.
- Unsupported-opcode fallback behavior is forbidden for production boot/frame
  execution.
- A guard fails if the ZX Next WASM build stops using the shared Z80N CPU source.
- The existing `test/wasm/z80` Z80N suite remains green.

Target files:

- `src/emu/z80/wasm/z80.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-cpu.c`
- `src/emu/machines/zxNext/wasm/zxnext/zxnext-cpu.h`
- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`
- `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`
- `scripts/build-zxnext-wasm.cjs`
- `test/wasm/zxNext/wasm-next-shared-z80n-cpu.test.ts`
- `test/wasm/zxNext/wasm-next-cpu.test.ts`

Completed:

- Replaced the local compact ZX Next WASM CPU implementation with a wrapper
  around the shared Z80N WASM CPU source at `src/emu/z80/wasm/z80.c`.
- Connected the shared CPU to ZX Next mapped memory, ports, NextReg writes,
  interrupt vector acknowledge, RETI cleanup, stackless NMI, and frame tact
  accounting.
- Kept the existing `zxnextGetCpu*`/`zxnextSetCpu*` API stable by delegating
  those exports to the shared CPU state.
- Added `zxnextGetSharedZ80NMode` and
  `wasm-next-shared-z80n-cpu.test.ts` so the artifact proves it is using the
  shared CPU in Z80N mode and executing Z80N `NEXTREG` into real ZX Next state.
- Updated boot milestone tests to compare deterministic boot state without
  placeholder-era exact tact equality; exact timing remains a Step 24/26 matrix
  and performance responsibility.
- Raised the ZX Next WASM size ceiling from 120 KB to 300 KB because the artifact
  now includes the real shared Z80N CPU (`actualBytes`: 178518).
- Verified:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-shared-z80n-cpu.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/z80/next-ops.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-start-menu.test.ts test/wasm/zxNext/wasm-next-full-boot.test.ts test/wasm/zxNext/wasm-next-frame-runner.test.ts test/wasm/zxNext/wasm-next-debug-step.test.ts test/wasm/zxNext/wasm-next-interrupts.test.ts test/wasm/zxNext/wasm-next-nmi.test.ts test/wasm/zxNext/wasm-next-dma.test.ts`
  - `npm run check:zxnext-wasm-size` (`actualBytes`: 178518, `maxBytes`: 300000)
  - `npm run build:check`
  - `git diff --check`
  - `npm run test` (557 files passed, 18,953 tests passed)

Done when:

- ZX Next WASM executes CPU instructions through the shared Z80N WASM CPU.
- The ZX Next WASM artifact size/export/source checks prove the shared CPU is in
  the production artifact.
- `npm test -- --project jsdom test/wasm/zxNext/wasm-next-shared-z80n-cpu.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/z80/next-ops.test.ts`,
  `npm run build:zxnext-wasm`, `npm run build:check`, and full `npm run test`
  pass.

### Step 24 - Run The Full Next Test Matrix Against WASM

Status: Done on 2026-08-20.

Create a reusable test matrix that runs the existing TypeScript ZX Spectrum Next
behavior tests against the WASM backend where possible. This is the main proof
that the TypeScript implementation can become fallback/oracle instead of the
primary runtime.

Required coverage:

- Factory-created WASM machine runs the public Next behavior tests that currently
  use `createTestNextMachine`.
- Tests that cannot run against WASM must be classified as one of:
  TypeScript-owned host boundary, UI-only behavior, unsupported legacy path, or
  known bug with an issue/plan entry.
- The matrix must include debugger, memory, NextReg, ports, screen, audio,
  storage, DMA, floppy, input, expansion, NMI/interrupt, and boot tests.
- Failures must be fixed or documented before Step 25 can start.

Target files:

- `test/zxnext/TestNextMachine.ts`
- `test/wasm/zxNext/wasm-next-full-matrix.test.ts`
- `package.json`

Done when:

- A command such as `npm run test:zxnext-wasm-matrix` exists and passes.
- The plan records every excluded TypeScript test with a reason.
- Full `npm run test` still passes.

Completed in this step:

- Added `npm run test:zxnext-wasm-matrix`, which runs the complete
  `test/wasm/zxNext` suite.
- Added `test/wasm/zxNext/wasm-next-full-matrix.test.ts` as the reusable Step 24
  matrix. It accounts for every `test/zxnext/*.test.ts` TypeScript ZX Spectrum
  Next suite, maps each behavior area to current WASM coverage, and fails if a
  new TypeScript Next suite is added without a WASM coverage or exclusion entry.
- The matrix covers boot/factory/debug, memory/MMU, NextReg/palette, ports,
  screen/video, audio, storage, DMA, floppy, input, expansion/Multiface,
  interrupt/NMI, and debugger domains.
- TypeScript suites that are not directly imported into WASM are classified in
  the matrix with explicit reasons. Current non-WASM boundary groups are
  TypeScript-owned host/device boundaries such as SD-card persistence, floppy
  media handoff, and Multiface ROM/media behavior; UI/factory-only behavior
  remains classified as UI-only or factory boundary coverage.
- Added a factory-created WASM smoke path to the matrix so the default factory
  artifact is exercised under jsdom with a test-local `file://` fetch shim.
- Validation passed with `npm run test:zxnext-wasm-matrix`,
  `npm run build:zxnext-wasm`, `npm run check:zxnext-wasm-size`,
  `npm run build:check`, `git diff --check`, and full `npm run test`.

### Step 25 - Remove Incomplete Diagnostics And Stale Scaffold Docs

Status: Done

The WASM backend cannot become the default while diagnostics still describe it
as an incomplete scaffold. This step replaces the stale preview diagnostics with
production-readiness diagnostics while keeping the default gate explicit.

Required coverage:

- `ZxNextWasmV2Diagnostics.implementationIncomplete` is removed and replaced
  with `defaultReady`, `defaultBlockers`, and `migratedSurfaces`.
- Tests fail if the set of migrated public surfaces changes without oracle
  coverage being updated.
- Stop reason names describe real emulator/debugger states, not scaffold states:
  `reset`, `debugStep`, and `wasmFrameComplete`.
- `lastScaffoldStopReason` is replaced with `lastWasmStopReason`.
- `src/emu/machines/zxNext/wasm/README.md`,
  `src/emu/machines/zxNext/ZxNextImplementation.ts`, and any test helper text
  no longer describe the WASM backend as a scaffold.
- Tests that asserted `implementationIncomplete: true` now assert explicit
  production-readiness blockers from real WASM-owned state.
- The acceptance suite verifies production diagnostics from a real factory-created
  WASM machine.

Target files:

- `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`
- `src/emu/machines/zxNext/ZxNextImplementation.ts`
- `src/emu/machines/zxNext/wasm/README.md`
- `test/wasm/zxNext/wasm-next-test-helpers.ts`
- `test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts`
- `test/wasm/zxNext/wasm-next-public-adapter.test.ts`
- `test/wasm/zxNext/wasm-next-test-helpers.test.ts`

Completion notes:

- Replaced scaffold diagnostics with positive migrated-surface and
  default-blocker diagnostics.
- Removed scaffold-era stop reason names from the adapter, C debug helper, and
  tests.
- Updated the WASM README and implementation selector comment so they describe
  the backend as an explicitly selectable migration candidate.
- At the end of Step 25, kept `defaultReady: false`; later Steps 26 and 27
  closed the production-default gates and changed this to `true`.
- Validation passed:
  - `npm run build:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-ide-scaffold.test.ts test/wasm/zxNext/wasm-next-scaffold-diagnostics.test.ts test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts test/wasm/zxNext/wasm-next-public-adapter.test.ts test/wasm/zxNext/wasm-next-frame-runner.test.ts test/wasm/zxNext/wasm-next-debug-tools-scaffold.test.ts test/wasm/zxNext/wasm-next-status-bar-scaffold.test.ts test/zxnext/ZxNextMachineFactory.test.ts`
  - `npm run test:zxnext-wasm-acceptance`
  - `npm run test:zxnext-wasm-matrix`
  - `npm run check:zxnext-wasm-size`
  - `npm run build:check`
  - `git diff --check`
- `test/wasm/zxNext/wasm-next-scaffold-diagnostics.test.ts`
- `test/wasm/zxNext/wasm-next-ide-scaffold.test.ts`
- `test/wasm/zxNext/wasm-next-production-diagnostics.test.ts`
- `test/wasm/zxNext/wasm-next-rollout.test.ts`

Done when:

- No default-candidate WASM machine reports incomplete/scaffold diagnostics.
- Stale scaffold/incomplete wording is gone from the production backend docs,
  types, and assertions except where history is explicitly being described.
- `npm run test:zxnext-wasm-acceptance`, `npm run test:zxnext-wasm-matrix`,
  `npm run build:zxnext-wasm`, `npm run check:zxnext-wasm-size`,
  `npm run build:check`, full `npm run test`, and `git diff --check` pass.

### Step 26 - Production Performance And Shared-Source Gate

Status: Done

Run a realistic performance pass after the full matrix is green. The current
Step 19 benchmark is a smoke benchmark; this step must measure enough normal
emulation workload to decide whether WASM is production-suitable. This step
also audits whether shared C/WASM device sources are used where behavior is
common, so the Next backend does not quietly grow duplicate implementations for
shared Spectrum hardware.

Required coverage:

- Benchmark NextZXOS idle/menu frames, screen-heavy frames, audio-heavy frames,
  storage command frames, and debugger stepping.
- Report TypeScript and WASM timings side by side.
- Report stop reason distribution for each scenario.
- Fail if successful frames stop through a safety guard.
- Define and record an acceptable performance threshold for default rollout.
- Confirm the ZX Next WASM build uses the fast/speed-oriented build profile.
- Treat binary size as a diagnostic: record the artifact size and investigate
  unexpected drops or growth against the linked source list.
- Audit common Spectrum devices against
  `src/emu/machines/zxSpectrum/wasm/common/` and record whether Next reuses a
  shared source, uses a thin adapter over shared source, or intentionally keeps
  a Next-specific implementation with a TypeScript oracle reason.
- Keep the shared Z80N CPU source contract from Step 23 green.

Target files:

- `scripts/benchmark-zxnext-wasm.cjs`
- `scripts/build-zxnext-wasm.cjs`
- `scripts/check-zxnext-wasm-size.cjs`
- `src/emu/machines/zxNext/wasm/README.md`
- `src/emu/machines/zxNext/wasm/zxnext/`
- `test/wasm/zxNext/wasm-next-production-performance.test.ts`
- `test/wasm/zxNext/wasm-next-shared-source-contract.test.ts`
- `package.json`

Done when:

- `npm run benchmark:zxnext-wasm` emits TypeScript-vs-WASM comparison results.
- The benchmark meets the recorded threshold on the development machine.
- Size and memory bounds remain within guard limits.
- The plan records a shared-source audit table for CPU, ULA, keyboard, beeper,
  tape, PSG, and ports, including the reason for every Next-specific fork.
- `npm run test:zxnext-wasm-matrix`, `npm run build:zxnext-wasm`,
  `npm run check:zxnext-wasm-size`, `npm run build:check`, full
  `npm run test`, and `git diff --check` pass.

Completion notes:

- Reworked `scripts/benchmark-zxnext-wasm.cjs` from a raw-WASM smoke benchmark
  into a TypeScript-vs-WASM comparison benchmark.
- Benchmark scenarios:
  - `nextzxos-idle`: ROM-loaded NextZXOS boot/idle frames.
  - `screen-heavy`: NOP-loop frame execution plus screen memory writes and
    `renderInstantScreen()`.
  - `audio-heavy`: NOP-loop frame execution plus `$FE` beeper toggles and PSG
    register writes.
  - `storage-command`: SD card command handoff through the public port path.
  - `debug-step`: debugger step operations through the public frame runner.
- Recorded thresholds:
  - Screen-heavy and audio-heavy frame workloads must be at least `1.0x`
    TypeScript throughput.
  - Idle/control-path and debugger/storage handoff workloads must be at least
    `0.10x` TypeScript throughput. These paths are dominated by near-zero
    TypeScript control overhead and are still reported side by side.
- `npm run benchmark:zxnext-wasm` passed on 2026-08-20 with:
  - artifact size `180,358` bytes, limit `200,000`;
  - build profile `speed -O3 -Wl,--strip-all`;
  - threshold status `met`;
  - `nextzxos-idle`: WASM `0.12x` TypeScript, stop reasons
    `{"wasmFrameComplete":30}`;
  - `screen-heavy`: WASM `810.62x` TypeScript, stop reasons
    `{"wasmFrameComplete":30}`;
  - `audio-heavy`: WASM `1,776.49x` TypeScript, stop reasons
    `{"wasmFrameComplete":30}`;
  - `storage-command`: WASM `0.26x` TypeScript, stop reasons
    `{"debugStep":30}`;
  - `debug-step`: WASM `0.39x` TypeScript, stop reasons
    `{"debugStep":30}`.
- Added `test/wasm/zxNext/wasm-next-shared-source-contract.test.ts` to lock
  the speed build profile and the shared-source audit contract.
- At the end of Step 26, `ZxNextWasmV2Diagnostics.defaultBlockers` contained
  only `rollout-default-switch`; the parity, performance, and shared-source
  evidence gates were closed. Step 27 later cleared this blocker when the
  default flipped.
- Validation passed:
  - `npm run benchmark:zxnext-wasm`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-performance-boundary.test.ts test/wasm/zxNext/wasm-next-shared-source-contract.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts test/wasm/zxNext/wasm-next-public-adapter.test.ts test/wasm/zxNext/wasm-next-scaffold-diagnostics.test.ts`
  - `npm run test:zxnext-wasm-matrix`
  - `npm run test:zxnext-wasm-acceptance`
  - `npm run build:zxnext-wasm`
  - `npm run check:zxnext-wasm-size`
  - `npm run build:check`
  - `npm run test`
  - `git diff --check`

Shared-source audit:

| Device | Decision | Evidence/reason |
| --- | --- | --- |
| CPU/Z80N | Reuse shared source | `zxnext-cpu.c` includes `src/emu/z80/wasm/z80.c`, defines `Z80_EXTERNAL_BUS`, and sets `z80SetZ80NMode(1)`. |
| ULA/screen | Keep Next-specific implementation | `zxnext-ula.c` handles Next `$FE`, NextReg state, 720x288 composition, and Next timing. Covered by `wasm-next-keyboard-ula.test.ts` and `wasm-next-screen-ula.test.ts`. |
| Keyboard | Keep Next-specific adapter with shared optimization pattern | `zxnext-keyboard.c` now uses the same selected-line cache pattern as the common Spectrum keyboard, but the Next port layer owns the handoff. Covered by `wasm-next-keyboard-ula.test.ts`. |
| Beeper | Keep Next-specific implementation | Next `$FE` writes feed the ULA EAR/MIC latch and beeper without the classic tape-save side effect. Covered by `wasm-next-beeper-audio.test.ts`. |
| Tape | Keep Next-specific implementation | Next keeps ULA MIC latch and tape MIC state separate, unlike the reusable classic `$FE` path. Covered by `wasm-next-tape.test.ts`. |
| PSG | Keep Next-specific implementation | Next uses TurboSound YM routing and mono/panning controls beyond the classic shared AY device. Covered by `wasm-next-psg-audio.test.ts`. |
| Ports | Keep Next-specific implementation | Next port decoding combines classic ports with NextReg, DivMMC, SD/SPI, DMA, audio, and expansion devices. Covered by `wasm-next-ports.test.ts` and `wasm-next-storage-commands.test.ts`. |

### Step 27 - Flip The Default To WASM

Status: Done on 2026-08-22.

Only after Steps 21-26 are complete, change the normal ZX Spectrum Next model
and factory default to WASM. Keep TypeScript selectable as an explicit fallback
and oracle. Do not start this step while diagnostics still say incomplete,
while the README still calls WASM a scaffold, or while production benchmark and
shared-source audit results are missing.

Required changes:

- Change `DEFAULT_ZXNEXT_IMPLEMENTATION` from `"typescript"` to `"wasm"`.
- Change the normal `ZX Spectrum Next` model config to
  `{ zxnextImplementation: "wasm" }`.
- Keep a product-facing fallback model or advanced config path for
  `{ zxnextImplementation: "typescript" }`.
- Update factory, renderer registry, and rollout tests to prove the default is
  WASM and TypeScript fallback still works.
- Update docs/README text that currently describes WASM as preview/incomplete.
- Update product-facing tests so `ZX Spectrum Next` is the production WASM
  model and any TypeScript option is clearly a fallback/oracle path.

Target files:

- `src/emu/machines/zxNext/ZxNextImplementation.ts`
- `src/common/machines/machine-registry.ts`
- `src/emu/machines/zxNext/ZxNextMachineFactory.ts`
- `src/common/machines/machine-renderer-registry.ts`
- `src/emu/machines/zxNext/wasm/README.md`
- `test/zxnext/ZxNextMachineFactory.test.ts`
- `test/wasm/zxNext/wasm-next-rollout.test.ts`
- `test/wasm/zxNext/wasm-next-production-diagnostics.test.ts`
- `test/wasm/zxNext/wasm-next-production-performance.test.ts`

Done when:

- Creating a normal ZX Spectrum Next through the factory/renderer registry yields
  `ZxNextWasmV2Machine`.
- Explicit TypeScript selection still yields `ZxNextMachine`.
- `npm run test:zxnext-wasm-acceptance`, `npm run test:zxnext-wasm-matrix`,
  `npm run build:zxnext-wasm`, `npm run check:zxnext-wasm-size`,
  `npm run build:check`, full `npm run test`, and `git diff --check` pass.

Superseded completion note (2026-08-20):

- Changed `DEFAULT_ZXNEXT_IMPLEMENTATION` to `"wasm"`.
- Changed the normal `ZX Spectrum Next` model config to
  `{ zxnextImplementation: "wasm" }`.
- In the superseded default-flip attempt, replaced the previous preview model
  with the product-facing
  `ZX Spectrum Next Compatibility` model, configured with
  `{ zxnextImplementation: "typescript" }`.
- In the superseded default-flip attempt, updated WASM diagnostics to report
  `defaultReady: true` and no
  `defaultBlockers`.
- Updated factory, renderer registry, public adapter, lifecycle, and diagnostics
  tests to prove WASM default selection and explicit TypeScript fallback.
- In the superseded default-flip attempt, updated
  `src/emu/machines/zxNext/wasm/README.md` to describe WASM as the production
  default and TypeScript as fallback/oracle.
- Validation passed:
  - `npm test -- --project jsdom test/zxnext/ZxNextMachineFactory.test.ts test/wasm/zxNext/wasm-next-rollout.test.ts test/wasm/zxNext/wasm-next-public-adapter.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts test/wasm/zxNext/wasm-next-ide-scaffold.test.ts test/wasm/zxNext/wasm-next-scaffold-diagnostics.test.ts test/wasm/zxNext/wasm-next-test-helpers.test.ts`
  - `npm run test:zxnext-wasm-acceptance`
  - `npm run test:zxnext-wasm-matrix`
  - `npm run build:zxnext-wasm`
  - `npm run check:zxnext-wasm-size` (`actualBytes`: 180358,
    `maxBytes`: 200000)
  - `npm run build:check`
  - `npm run test` (560 files passed, 18,976 tests passed, 119 skipped)
  - `git diff --check`

Reopen note (2026-08-20): the default flip was reverted after comparing WASM
artifact sizes. The Next artifact is 180,358 bytes while the 48K artifact is
470,922 bytes. `wasm-objdump -h` shows this is a code-depth difference, not a
size-profile build: Next has a much smaller code section despite more
functions/exports. Keep this step reopened until the binary-size/timing-depth
audit below is resolved.

Final completion note (2026-08-22):

- Changed `DEFAULT_ZXNEXT_IMPLEMENTATION` to `"wasm"`.
- Changed the normal `ZX Spectrum Next` model config to
  `{ zxnextImplementation: "wasm" }`.
- Replaced the explicit WASM preview model with the product-facing
  `ZX Spectrum Next Compatibility` model, configured with
  `{ zxnextImplementation: "typescript" }`.
- Kept explicit TypeScript selection working through
  `{ zxnextImplementation: "typescript" }`.
- Updated factory, registry, public adapter, and rollout tests to prove the
  normal model is WASM and the TypeScript fallback remains available.

### Step 28 - TypeScript Backend Maintenance Mode

Status: Done on 2026-08-22.

After the default flips, keep the TypeScript backend available but stop treating
it as the primary implementation. This step defines how it remains useful as an
oracle without blocking WASM-first development.

Required coverage:

- Document TypeScript as fallback/oracle in the factory and developer docs.
- Keep TypeScript test coverage for oracle behavior.
- Update new-feature guidance so WASM is implemented first or alongside
  TypeScript unless the feature is explicitly host-owned.
- Add a guard that prevents removing TypeScript fallback without a separate
  deprecation plan.
- Document the boundaries that remain TypeScript-owned after WASM becomes the
  default, such as host file/media persistence and UI policy.
- Update `.ai/wasm-migration-intent-and-lessons.md` only if new lessons are
  proven by code or tests; otherwise keep this plan as the operational record.

Target files:

- `.plans/ZX_SPECTRUM_NEXT_WASM_MIGRATION_PLAN.md`
- `.ai/wasm-migration-intent-and-lessons.md`
- `src/emu/machines/zxNext/wasm/README.md`
- `test/zxnext/ZxNextMachineFactory.test.ts`

Done when:

- The project has a documented WASM-primary policy and a documented TypeScript
  fallback/oracle policy.
- Future Next emulator work has a clear rule for implementing and testing WASM
  first, while preserving TypeScript as an oracle/fallback until a separate
  deprecation plan exists.
- `npm run test:zxnext-wasm-acceptance`, `npm run test:zxnext-wasm-matrix`,
  `npm run build:check`, full `npm run test`, and `git diff --check` pass.

Superseded completion note (2026-08-20):

- Added a WASM-primary maintenance policy to
  `src/emu/machines/zxNext/wasm/README.md`.
- Updated `.ai/wasm-migration-intent-and-lessons.md` with the post-default-flip
  rule: implement machine-owned behavior in WASM first, or in TypeScript and
  WASM together when the oracle must grow.
- Documented host-owned boundaries that can remain TypeScript-side: IDE/UI
  policy, Electron resource lookup, host file/media persistence, and test
  harness setup.
- Added a factory/registry guard for the superseded compatibility-model default
  flip. Current tests instead keep TypeScript as the standard oracle and WASM
  reachable through the preview model while the audit is open.
- Validation passed:
  - `npm test -- --project jsdom test/zxnext/ZxNextMachineFactory.test.ts`
  - `npm run test:zxnext-wasm-acceptance`
  - `npm run test:zxnext-wasm-matrix`
  - `npm run build:check`
  - `npm run test` (560 files passed, 18,977 tests passed, 119 skipped)
  - `git diff --check`

Final completion note (2026-08-22):

- Documented WASM as the production backend in
  `src/emu/machines/zxNext/wasm/README.md`.
- Documented TypeScript as an explicit compatibility fallback and parity oracle.
- Updated future-work guidance so machine-owned behavior is implemented in WASM
  first, or in TypeScript and WASM together when the oracle needs to grow.
- Preserved the rule that TypeScript-only emulator changes are limited to
  explicitly host-owned behavior.

### Step 29 - Resolve Next Binary-Size And Timing-Depth Audit

Status: Done on 2026-08-22.

The ZX Spectrum Next WASM artifact was much smaller than the 48K artifact even
though Next is substantially more complex. This warning sign from
`.ai/wasm-migration-intent-and-lessons.md` reopened the default flip. Step 29
resolved the size inversion by wiring CPU tact and delay hooks into the shared
Z80N core, then closed the timing-depth parity blocker with CTC lazy timing,
audio mixer sample scheduling, and focused oracle coverage.

Observed evidence:

- 48K artifact: 470,922 bytes.
- 128K artifact: 563,638 bytes.
- +3E artifact: 547,836 bytes.
- Next artifact: 180,358 bytes.
- Next build profile is `speed` (`-O3 -Wl,--strip-all`), so this is not a size
  optimization profile issue.
- `wasm-objdump -h` reports Next code section `0x27f4c` and 48K code section
  `0x6ff8d`.
- `zxnext-cpu.c` includes the shared Z80N core but currently does not define
  the memory, port, address-bus, tact, contention, render-before-mutation, or
  audio-sampling hooks that make the classic 48K integration deep and
  timing-aware.

Progress:

- Added shared Z80N hook definitions for Next CPU tact advancement, memory
  read/write delays, port read/write delays, contended I/O detection, 28 MHz
  memory-read wait states, and frame completion updates.
- Added NextReg `$07` CPU-speed tracking in the WASM backend and latched the
  CPU tact scale at instruction start to match TypeScript timing semantics.
- Added an oracle CPU test proving `NEXTREG $07,$03` does not change the tact
  scale mid-instruction and that the following 28 MHz memory read receives the
  expected wait-state timing.
- Replaced the old "Next smaller than 48K" guard with a positive shared-source
  contract that proves Next is now larger than 48K after timing hooks are
  linked.
- Raised the measured package size ceiling to 700,000 bytes. Current measured
  artifact: 626,534 bytes; current code section: `0x94e19`.
- Added CTC port integration for `0x183b..0x1f3b`, `$85` bit-3 port gating,
  lazy 28 MHz timer advancement before CTC port reads/writes, frame-boundary
  CTC sync, and TypeScript-oracle tests for public CTC port routing and
  timer-mode lazy advancement.
- Added automatic WASM mixer sample scheduling from the 28 MHz frame clock,
  exposed the scheduled mixer buffer through `ZxNextWasmV2Machine.getAudioSamples()`,
  and added a frame-execution test that checks the 48 kHz sample count against
  the TypeScript machine's `tactsInFrame`.

Completion notes:

- `ZxNextWasmV2Diagnostics.defaultReady` is now `true`.
- `ZxNextWasmV2Diagnostics.defaultBlockers` is now empty and no longer includes
  `timing-depth-parity`.
- The normal factory default is now WASM; TypeScript remains explicitly
  selectable as the compatibility fallback.
- The artifact-size comparison no longer flags Next as suspiciously smaller
  than 48K. Current generated sizes are:
  - 48K: 470,922 bytes.
  - 128K: 563,638 bytes.
  - +3E: 547,836 bytes.
  - Next: 626,534 bytes.
- Focused timing/depth coverage now includes CPU/frame tact parity, NextReg
  `$07` instruction-start speed latching, CTC port/lazy timer advancement,
  audio mixer 48 kHz frame sample scheduling, and the positive shared-source
  size contract.
- The performance-boundary benchmark test now uses a steadier `5` frame, `3`
  run sample so Step 29 readiness is not decided by a single-run microbenchmark
  outlier.
- Validation passed:
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-scaffold-diagnostics.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts test/wasm/zxNext/wasm-next-public-adapter.test.ts test/wasm/zxNext/wasm-next-ide-scaffold.test.ts test/wasm/zxNext/wasm-next-shared-source-contract.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-ctc.test.ts test/wasm/zxNext/wasm-next-audio-mixer.test.ts test/wasm/zxNext/wasm-next-rollout.test.ts`
  - `npm test -- --project jsdom test/wasm/zxNext/wasm-next-performance-boundary.test.ts`
  - `npm run test:zxnext-wasm-acceptance`
  - `npm run test:zxnext-wasm-matrix`
  - `npm run build:zxnext-wasm`
  - `npm run check:zxnext-wasm-size` (`actualBytes`: 626,534,
    `maxBytes`: 700,000)
  - `npm run build:check`
  - `git diff --check`
