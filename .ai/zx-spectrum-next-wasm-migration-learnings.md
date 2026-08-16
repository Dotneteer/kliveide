# ZX Spectrum Next WASM Migration Learnings

Created: 2026-08-16

This log is for durable lessons discovered while migrating the ZX Spectrum Next
TypeScript implementation to WASM. Keep it short, concrete, and tied to exact
files/tests where possible.

## How To Update

After each migration slice:

- add the date;
- name the step from `.plans/ZX_SPECTRUM_NEXT_WASM_MIGRATION_PLAN.md`;
- record the symptom, root cause, fix, and tests added;
- mention any public adapter API that had to be overridden to avoid stale
  TypeScript-owned state.

Use this shape:

```md
## 2026-08-16 - Step N - Short Title

- Symptom:
- Root cause:
- Fix:
- Tests:
- Follow-up:
```

## Initial Notes From Prior WASM Migrations

- Full-machine WASM is required for performance. A CPU-only WASM bridge with
  TypeScript devices crosses the JS/WASM boundary too often.
- TypeScript machines should be used as oracles during migration. Static table
  parity is useful, but public adapter API parity is what protects the IDE.
- Keep original TypeScript tests. Add WASM sibling tests and preserve semantics.
- Literal copied CPU tests should remain byte-for-byte identical. Adapt through
  wrappers and runner configuration.
- Loader tests must validate exports and typed view bounds. Broken loader errors
  should include the artifact name.
- Normal frames should not sync full CPU registers. Pull registers for setup,
  reset, pause/debug, and explicit inspection.
- Public adapter methods must read WASM-owned state. Inherited TypeScript
  memory, port, paging, or screen methods can silently report stale state.
- Screen dimensions should come from timing configuration, not backing-buffer
  capacity.
- Frame loops must preserve instruction overshoot across frame boundaries.
- Storage/media persistence needs explicit flush or response handling at
  lifecycle boundaries, not only on frame completion.

## ZX Spectrum Next-Specific Starting Hypotheses

- The earliest useful milestone is CPU + memory/MMU + NextRegs + ULA port +
  keyboard + standard ULA rendering + DivMMC + SD-card SPI. Layer 2, sprites,
  tilemap, Copper, DMA, CTC, full audio, UART, I2C, mouse, joystick, Multiface,
  expansion bus, and floppy can follow after the start menu/storage milestone.
- `ZxNextMachine` currently exposes many device instances directly. The WASM
  adapter must either provide coherent WASM-backed facades or override public
  methods that the IDE uses.
- IDE inspection is a core parity requirement, not a late cleanup. Register
  views, memory panes, disassembly, ULA information, NextReg panels, palette
  views, and debugger bus-event state must read WASM-owned state through the
  same public APIs as the TypeScript machine.
- Memory sizing must be future-proofed for the ZX Spectrum Next KS3 4 MB
  edition. The WASM ABI should not permanently bake in the current TypeScript
  2 MB sentinel offset.
- SD-card sector reads/writes should remain app-owned in TypeScript/main
  process, while the SPI command state machine can be WASM-owned.
- Next composed video should be migrated in layers: standard ULA first, then
  palette/ULA+/Timex, then Layer 2/LoRes, then tilemap, then sprites, then full
  composition.

## Entries

## 2026-08-16 - Step 7 - Shared Next WASM Test Helper

- Symptom: New ZX Next WASM tests would otherwise duplicate artifact builds,
  deterministic ROM setup, loader options, and raw export calls.
- Root cause: The Spectrum helper existed under `test/wasm/zxSpectrum`, but ZX
  Next needs its own ROM resource names, adapter class, and NextReg/port helpers.
- Fix: Added `test/wasm/zxNext/wasm-next-test-helpers.ts` with cached artifact
  builds, deterministic ROM sets, WASM/oracle machine factories, code
  initialization, single-instruction execution, CPU/register helpers, and
  memory/port/NextReg assertions.
- Tests: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts`
  passed.
- Follow-up: Extend the helper rather than re-creating raw export setup in each
  later device slice.

## 2026-08-16 - Step 8 - Z80N CPU Baseline

- Symptom: The Step 6 artifact could reset and upload ROM bytes but could not
  execute ZX Next code.
- Root cause: The production Next C module did not yet include the shared Z80
  core or provide machine memory/port/TBBlue callbacks.
- Fix: Included `src/emu/z80/wasm/z80.c`, enabled Z80N mode on reset, wired
  memory callbacks to the current 64K flat view, wired port callbacks to an
  initial latch, mirrored TBBlue `NEXTREG` events into the NextReg byte array,
  exported CPU register/tact accessors, and made `zxnextExecuteInstruction()`
  advance through prefix cycles until a whole instruction completes.
- Tests: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-cpu.test.ts`
  passed with 9 tests; `npx vitest run --config test/wasm/vitest.z80.config.ts test/wasm/z80/next-ops.test.ts`
  passed with 95 tests.
- Follow-up: The TypeScript CPU oracle does not expose the same Z80N ED-op
  subset, so Step 8 compares base Z80 execution against TypeScript and asserts
  Next-only ED opcodes against the reused C core plus machine-level effects.
  Later parity work should keep recording whether TypeScript has an equivalent
  oracle for each migrated behavior.
- Size: The production Next artifact is now 117,934 bytes; the size ceiling was
  raised to 360,000 bytes for the Z80N baseline.

## 2026-08-16 - Step 4 - ZX Next WASM Build Scaffold

- Symptom: ZX Spectrum Next had no standalone production WASM artifact pipeline.
- Root cause: The prior Spectrum machines each had dedicated build scripts and
  package resource entries, but Next was still TypeScript-only.
- Fix: Added the Next build script, type declaration, size checker, package
  scripts, package resource copy, and a minimal C module exporting only
  production scaffold symbols.
- Tests: `npm test -- --project jsdom test/zxnext/zxnext-wasm-build.test.ts`,
  `npm run build:zxnext-wasm`, and `npm run check:zxnext-wasm-size` passed.
  The initial skeleton artifact was 2,169 bytes against the 80,000 byte ceiling.
- Follow-up: Raise the size ceiling only with measured artifact sizes when CPU
  and device slices are added.

## 2026-08-16 - Step 5 - ZX Next WASM Loader

- Symptom: The adapter needed a loader contract before any machine internals
  could safely move into WASM.
- Root cause: Without typed-view validation, later IDE-facing methods could
  silently read an invalid or stale memory/pixel/storage buffer.
- Fix: Added `ZxNextWasmV2Loader.ts` with required export validation and typed
  views for flat memory, 4 MB SRAM capacity, ROM bytes, keyboard rows, NextRegs,
  pixel buffer, audio samples, SD command/response buffers, and diagnostics.
- Tests: `npm test -- --project jsdom test/zxnext/zxnext-wasm-v2-loader.test.ts`
  and `npm run build:zxnext-wasm` passed.
- Follow-up: Keep loader errors artifact-specific as new buffers and exports are
  added.

## 2026-08-16 - Step 6 - ZX Next WASM Adapter Skeleton

- Symptom: Explicit `"wasm"` selection was only testable as a placeholder and
  could not set up/reset a WASM runtime.
- Root cause: `ZxNextWasmV2Machine` did not exist yet, and the factory still
  returned `ZxNextMachine` for both implementation values.
- Fix: Added `ZxNextWasmV2Machine`, wired explicit `"wasm"` factory selection to
  it, loaded the runtime in `setup()`, uploaded the four Next ROM resources,
  replayed ROM bytes on reset/hard reset, and exposed skeleton diagnostics.
- Tests: `npm test -- --project jsdom test/zxnext/ZxNextMachineFactory.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`
  and `npm run build:check` passed.
- Follow-up: Later slices must override inherited public APIs as soon as their
  backing state becomes WASM-owned; for now the skeleton deliberately keeps
  frame execution in the TypeScript base.

## 2026-08-16 - Step 2 - Contract Inventory

- Symptom: The ZX Spectrum Next TypeScript machine exposes many device
  instances directly, so a WASM adapter can appear to run correctly while IDE
  panels still read stale inherited TypeScript state.
- Root cause: The existing public surface mixes deterministic machine state,
  app-owned media/file policy, and renderer inspection contracts.
- Fix: Added a Step 2 contract table to the migration plan that separates
  WASM-owned state from TypeScript-owned surfaces and names adapter override
  requirements for CPU, memory, ports, screen, storage, audio, DMA/Copper/CTC,
  peripherals, lifecycle, and IDE inspection.
- Tests: Documentation-only step; validate with `git diff --check`.
- Follow-up: Each migrated device step should add at least one public
  machine-API parity test, not only raw WASM export tests.

## 2026-08-16 - Step 3 - ZX Next Implementation Switch

- Symptom: `MI_ZXNEXT` was wired directly to `new ZxNextMachine(...)`, leaving
  no centralized switch for TypeScript/WASM rollout or oracle comparison.
- Root cause: The prior Spectrum migrations had factory/implementation switch
  files, but ZX Next had not yet adopted that entry-point pattern.
- Fix: Added `MC_ZXNEXT_IMPLEMENTATION`,
  `ZxNextImplementation.ts`, `ZxNextMachineFactory.ts`, and routed the renderer
  registry through `createZxNextMachine(...)`.
- Tests: Added `test/zxnext/ZxNextMachineFactory.test.ts`; focused run
  `npm test -- --project jsdom test/zxnext/ZxNextMachineFactory.test.ts`
  passed with 7 tests.
- Follow-up: Replace the explicit `"wasm"` placeholder branch with
  `ZxNextWasmV2Machine` in Step 6, while keeping `DEFAULT_ZXNEXT_IMPLEMENTATION`
  on `"typescript"` until the early boot/storage/ULA milestone passes.
- Note: Existing TypeScript-side ZX Next tests live under lowercase
  `test/zxnext`. The plan now uses that casing for migrated TypeScript test
  references; future WASM references can keep `test/wasm/zxNext`, matching the
  existing camel-cased `test/wasm/zxSpectrum` convention.

## 2026-08-16 - Step 8 - Existing Z80N WASM Core

- Symptom: Step 8 originally left open whether Z80N opcode support needed to be
  implemented for the ZX Spectrum Next WASM migration.
- Root cause: The existing Spectrum WASM migrations use the shared
  `src/emu/z80/wasm/z80.c` core, and that core had already grown Z80N mode for
  the standalone copied WASM Z80 tests.
- Finding: `z80.c` exposes `z80SetZ80NMode()` and implements the Next ED-opcode
  subset covered by `test/wasm/z80/next-ops.test.ts`, including `NEXTREG`
  callbacks recorded as TBBlue bus events in the standalone harness.
- Tests: `npx vitest run --config test/wasm/vitest.z80.config.ts test/wasm/z80/next-ops.test.ts`
  passed on 2026-08-16 with 95 tests.
- Follow-up: The ZX Next migration should reuse the existing C core, enable
  Z80N mode, and focus Step 8 on wiring `NEXTREG`/TBBlue, memory, port,
  interrupt, NMI, RETN, tact, and bus-event hooks into the full-machine ZX Next
  WASM backend.

## 2026-08-16 - Step 9 - KS3 4 MB Memory Preparation

- Symptom: Step 9 originally described moving the current 2 MB memory map into
  C, which could accidentally freeze the WASM ABI around today's TypeScript
  allocation.
- Root cause: `src/emu/machines/zxNext/MemoryDevice.ts` currently allocates a
  2 MB backing buffer plus an 8 KB sentinel page and uses
  `OFFS_ERR_PAGE = 2048 * 1024`.
- Finding: The ZX Spectrum Next KS3 edition is expected to use 4 MB of RAM, so
  the WASM memory layout must support a larger configured active memory size.
- Tests: Future Step 9 tests should include 512 KB, 1 MB, 1.5 MB, 2 MB, and
  4 MB KS3 configurations, including highest valid SRAM page and sentinel-page
  behavior.
- Follow-up: If the TypeScript oracle does not yet support 4 MB, record the
  intended contract in tests and keep the WASM loader/adapter ABI capable of
  representing it without redesign.

## 2026-08-16 - Step 9 - Core Memory/MMU Baseline

- Symptom: The Step 8 WASM CPU used a flat 64K byte array as canonical memory,
  so CPU execution and IDE inspection could not yet represent Next ROM/RAM
  paging, write-protected ROM, configurable active RAM size, or sentinel pages.
- Root cause: The scaffold intentionally exposed typed views before moving the
  actual Next memory layout into C/WASM.
- Fix: Added a C-owned physical memory layout with 4 MB SRAM capacity, current
  active-memory sizing for 512 KB/1 MB/1.5 MB/2 MB, future 4 MB KS3 sizing, a
  sentinel page located after the configured active memory region, default MMU
  registers, per-slot read/write offsets, mapped `zxnextReadMemory` and
  `zxnextWriteMemory`, and public physical/MMU/partition inspection exports.
- Fix: Updated `ZxNextWasmV2Machine` so IDE-facing memory APIs read WASM-owned
  state after setup: `doReadMemory`, `doWriteMemory`, `get64KFlatMemory`,
  `getMemoryPartition`, `getCurrentPartitions`, `getPartition`, and
  `readScreenMemory`.
- Fix: Added optional WASM memory sizing from model config `MC_MEM_SIZE`, so a
  future KS3 model can pass `4096` without requiring a loader/ABI redesign.
- Test strategy: Compared WASM against `MemoryDevice` for current TypeScript
  sizes and reset layout, and added WASM-only assertions for the 4 MB KS3
  contract because the current TypeScript `MemoryDevice` rejects 4096 KB.
- Detail: WASM `i32` return value `0xffffffff` is observed as `-1` in
  JavaScript tests; normalize or assert that signed value for invalid write
  offsets.
- Detail: Do not rebuild the whole 64K flat projection for every ROM upload
  byte. Upload and physical-write paths should refresh only the affected mapped
  flat byte; full projection rebuilds are appropriate for reset/configuration
  changes.
- Tests: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-memory-mmu.test.ts`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts`,
  `npm run build:check`, and `npm run check:zxnext-wasm-size` passed.
- Size: The production Next artifact is now 217,244 bytes against the 360,000
  byte ceiling.
- Follow-up: Step 10 should replace the temporary direct `zxnextSetMmuReg`
  baseline with full Next port/NextReg paging semantics, selected ROM/bank
  tracking, all-RAM mode, special config, DivMMC/Multiface overlays, and
  TypeScript oracle parity for port-driven mapping changes.

## 2026-08-16 - Step 10 - 128K/+3/Next MMU Ports

- Symptom: After Step 9, WASM memory could expose a reset MMU layout but port
  writes and MMU NextRegs did not yet affect the mapped memory state used by
  CPU execution or IDE inspection.
- Root cause: The C core had no equivalents for `MemoryDevice.port7ffdValue`,
  `portDffdValue`, `port1ffdValue`, `portEff7Value`, or
  `setNextRegMmuValue()`.
- Fix: Added WASM-side handling for `0x7ffd`, `0xdffd`, `0x1ffd`, and
  `0xeff7` with the same masks used by `NextIoPortManager`, plus paging-lock,
  shadow-screen, selected ROM/bank, all-RAM, special-config, and EFF7 state.
- Fix: Implemented MMU NextReg side effects for `0x50..0x57`, including direct
  `zxnextWriteNextReg()` calls and CPU-driven Z80N `NEXTREG` instructions.
- Adapter choice: `ZxNextWasmV2Machine.doWritePort()` currently calls the
  TypeScript port manager first, then the WASM port handler. This intentionally
  preserves not-yet-migrated TypeScript-owned side effects such as floppy motor
  handling while making memory mapping WASM-owned for Step 10.
- Parity lesson: TypeScript maps MMU values `224..255` through the
  system-region priority decode path on any 8K slot. It is not limited to the
  two ROM slots. A failing Step 10 test exposed this when `NextReg 0x57 = 0xff`
  expected partition `0xff`, not `127`.
- Test strategy: Keep the TypeScript oracle in the same test process and
  compare current partitions, selected ROM/RAM, MMU bytes, bank labels, and
  read/write offsets after each port or NextReg mutation.
- Tests: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-memory-mmu.test.ts`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/zxnext/MemoryDevice.test.ts`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`,
  `npm run build:check`, and `npm run check:zxnext-wasm-size` passed.
- Size: The production Next artifact is now 218,617 bytes against the 360,000
  byte ceiling.
- Follow-up: Step 11 should move NextReg index/data port behavior
  (`0x243b`/`0x253b`) and port-enable gates into WASM; Step 10 only wires the
  direct MMU register side effects and keeps the broader NextReg device
  TypeScript-owned.

## 2026-08-16 - Step 11 - NextReg Core And Port Gates

- Symptom: Step 10 could mutate MMU registers directly, but public NextReg
  index/data ports and the IDE-facing `nextRegDevice` state still came from the
  TypeScript device.
- Root cause: `NextRegDevice` owns both descriptor metadata and a large amount
  of register side-effect policy; moving everything at once would pull many
  unrelated devices into the current slice.
- Fix: Added a scoped WASM NextReg core with index/data ports `0x243b` and
  `0x253b`, boot-relevant reset defaults, config-mode tracking, last-write
  tracking, internal port enables `0x82..0x85`, expansion-bus port enables
  `0x86..0x89`, and IO propagate storage.
- Fix: Updated WASM memory-port writes so `0x7ffd`, `0xdffd`, `0x1ffd`, and
  `0xeff7` honor the migrated enable gates and expansion-bus AND masking.
- Adapter pattern: Keep descriptor metadata on the existing TypeScript
  `nextRegDevice`, but patch the instance methods after WASM setup so value
  reads, direct reads/writes, register-index state, last-write state, reset
  helpers, and `isPortGroupEnabled()` observe WASM-owned state.
- Parity lesson: `NR 0x85` bit 7 is reset-mode state, not an ordinary port
  enable, but TypeScript `isPortGroupEnabled(3, 7)` falls through to `true`.
  WASM should preserve that public behavior for parity.
- Parity lesson: Full machine setup can leave some read functions with values
  different from a direct `NextRegDevice.hardReset()` call. The Step 11
  hard-reset default test explicitly calls `nextRegDevice.hardReset()` on both
  machines before comparing reset defaults.
- Tests: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-nextreg-ports.test.ts`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/zxnext/NextRegDevice.test.ts test/zxnext/PortEnableGating.test.ts`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`,
  `npm run build:check`, and `npm run check:zxnext-wasm-size` passed.
- Size: The production Next artifact is now 223,577 bytes against the 360,000
  byte ceiling.
- Follow-up: Later device slices should move the individual NextReg
  side-effect owners, such as ULA, audio, sprites, palette, expansion-bus
  ROMCS, DivMMC, and interrupts, out of the bridge gradually. The bridge keeps
  the IDE panel coherent while that migration happens.

## 2026-08-16 - Architecture Correction - Split ZX Next C Slices

- Symptom: After Steps 9-11, `zxnext.c` had grown into a monolithic file with
  memory/MMU, port decode, and NextReg logic.
- Root cause: The early slices optimized for behavior and parity, but did not
  follow the migration plan's `Proposed Files` section closely enough.
- Fix: Split the Step 9-11 logic before starting Step 12:
  - `zxnext.h` holds shared constants and cross-slice declarations.
  - `zxnext-memory.c` holds physical memory, MMU, sentinel, memory sizing, and
    partition inspection.
  - `zxnext-ports.c` holds Next memory-port and NextReg port decode.
  - `zxnext-nextreg.c` holds NextReg storage, reset defaults, index/data
    helpers, config mode, and port-enable gates.
  - `zxnext.c` is back to composition/glue: shared state, Z80 integration,
    reset/frame entry points, ROM upload, CPU exports, and diagnostics.
- Style: This follows the existing Spectrum WASM pattern where the primary
  machine C file includes device `.c` slices. That keeps shared static state
  simple while still giving each device area a clear file boundary.
- Tests: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/zxnext/MemoryDevice.test.ts test/zxnext/NextRegDevice.test.ts test/zxnext/PortEnableGating.test.ts`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`,
  `npm run build:check`, `npm run check:zxnext-wasm-size`, and
  `git diff --check` passed.
- Size: The production Next artifact is 223,575 bytes after the split, still
  against the 360,000 byte ceiling.

## 2026-08-16 - Step 12 - ULA Port And Keyboard Matrix

- Fix: Added separate `zxnext-keyboard.c` and `zxnext-ula.c` slices rather than
  growing `zxnext.c`. `zxnext-ports.c` only routes low-bit-zero ports into the
  ULA slice.
- Parity lesson: The shared Spectrum keyboard stores pressed keys as 1 bits in
  each row, while ULA port reads return active-low values. WASM should sync the
  pressed-bit row bytes and invert them only at the ULA read boundary.
- Adapter pattern: Keep key queues and hotkey policy TypeScript-owned, but sync
  only changed matrix rows to WASM before public `doReadPort()` calls that hit
  ULA-owned ports.
- Parity lesson: The Next ULA bit 6 behavior is issue-mode sensitive. EAR
  contributes in both modes; MIC contributes only when NextReg `0x08` enables
  issue 2 keyboard behavior.
- Test lesson: Once ULA port decoding is present, even ports are not safe dummy
  ports for generic CPU port-callback tests. Use a non-owned odd port when the
  test is about the callback mechanism rather than ULA hardware behavior.
- Tests: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-keyboard-ula.test.ts`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`,
  `npm test -- --project jsdom test/zxnext/NextRegDevice.test.ts test/zxnext/PortEnableGating.test.ts`,
  `npm run build:check`, `npm run check:zxnext-wasm-size`, and
  `git diff --check` passed.
- Size: The production Next artifact is now 224,808 bytes against the 360,000
  byte ceiling.

## 2026-08-16 - Step 13 - Standard ULA Screen Timing And Rendering

- Fix: Added `zxnext-screen.c` for screen timing, selected screen-bank reads,
  and standard ULA instant rendering. Keep later Layer 2, sprites, tilemap, and
  palette-device behavior in their own planned slices.
- Correction: The first Step 13 pass painted basic standard ULA pixels through a
  row loop, but missed the ULA standard rendering tact table. The corrected
  implementation now builds per-tact ULA flags, HC, VC, and bitmap-offset tables
  for both timing modes, and `zxnextRenderInstantScreen()` iterates those tables.
- Rendering lesson: ZX Spectrum Next standard ULA rendering uses the 720x288
  renderer buffer. The 256 logical ULA pixels are doubled horizontally into the
  512-pixel display area, starting at x=96. In 50 Hz mode the display starts at
  y=48; in 60 Hz mode it starts at y=24.
- Parity lesson: Standard ULA paper colors use palette indices 16-31, not the
  same 0-15 range as ink. Border colors use the standard paper path
  `16 + borderColor` while ULANext/ULA+ palette paths remain later work.
- Memory lesson: `readScreenMemory()` must read from selected screen bank 5 or
  shadow bank 7, independent of the currently mapped 64K window. In WASM this
  belongs in the screen slice and should use physical SRAM offsets.
- Timing lesson: Step 13 should expose 50/60 Hz frame tact counts and INT pulse
  windows from `TimingConfig.ts`, but CPU-driven frame execution and render
  scheduling stay in Step 14.
- Test lesson: Screen tests should probe the timing/rendering table directly,
  not only final pixels. Final pixels can be correct while the renderer misses
  the architectural table that later frame, floating-bus, contention, and debug
  features need.
- Adapter pattern: Override `getPixelBuffer()`, `getPixelBufferBytes()`,
  `screenWidthInPixels`, `screenHeightInPixels`, `renderInstantScreen()`, and
  `getBufferStartOffset()` together. This is the IDE-visible renderer contract.
- Tests: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-screen-ula.test.ts`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`,
  `npm test -- --project jsdom test/zxnext/NextComposedScreenDevice.test.ts test/zxnext/UlaRendering.test.ts test/zxnext/NextRegDevice.test.ts`,
  `npm run build:check`, `npm run check:zxnext-wasm-size`, and
  `git diff --check` passed.
- Size: The production Next artifact is now 228,096 bytes against the 360,000
  byte ceiling.

## 2026-08-16 - Plan Audit - Steps 9-13 Guardrail Failure

- Symptom: Steps 9-13 were recorded as completed even though several TypeScript
  source contracts were only partially migrated or not explicitly deferred.
- Root cause: I treated focused WASM tests and useful baselines as completion
  proof, instead of auditing every source TypeScript behavior, every public
  adapter API, and every IDE-visible surface implied by the step descriptions.
- Specific miss: The first Step 13 pass painted basic ULA pixels but omitted
  the ULA standard rendering tact table. That was corrected, but it exposed why
  final-pixel tests alone are not enough for architecture parity.
- Specific miss: `ZxNextWasmV2Machine.getBufferStartOffset()` currently returns
  the WASM pixel-buffer pointer, while the renderer contract expects a pixel
  buffer start index. The TypeScript ZX Next implementation returns `0`; this
  must be fixed and tested in Step 13A before Step 14.
- Fix to process: The plan now marks Steps 9-13 as partial baselines, adds
  blocking Step 13A, and requires a source-contract checklist before Step 14.
- New rule: A step can be marked done only after the plan names audited source
  files, destination files, migrated behaviors, raw WASM tests, public
  `ZxNextWasmV2Machine` API parity tests, and every intentionally deferred
  behavior with its later owning step.
- Follow-up: Future remaining steps now include explicit source TypeScript
  files, destination files, and step-local guardrails. Keep those sections
  updated before implementation if ownership boundaries change.

## 2026-08-16 - Step 13A - Steps 9-13 Parity Correction

- Symptom: Several Step 9-13 contracts were either missing public adapter tests
  or missing implementation despite the baseline being useful.
- Fix: `ZxNextWasmV2Machine.getBufferStartOffset()` now returns renderer start
  index `0`; the raw pixel-buffer pointer remains only a WASM typed-view detail.
- Fix: `NextReg 0x69` bit 6 now aliases WASM `useShadowScreen`, so both
  `readScreenMemory()` and standard ULA rendering select bank 7 through the
  same public NextReg path as TypeScript.
- Fix: ULA analog EAR behavior now records bit-4 rise/fall tacts and applies
  the TypeScript capacitor-style decay rule on `0xfe` reads.
- Fix: Extended keyboard read-only NextRegs `0xB0..0xB2` now sync from
  `NextKeyboardDevice` into WASM before public NextReg reads and index/data
  port reads.
- Test lesson: Any renderer-facing adapter contract should be asserted through
  `ZxNextWasmV2Machine`, not by comparing to raw WASM pointer exports.
- Test lesson: Step 9 KS3 readiness needs public adapter assertions, not just
  raw memory-size exports; the highest 4 MB page and invalid partition are now
  covered through `getMemoryPartition()`.
- Follow-up: Step 14 can start only because the remaining Step 9-13 omissions
  are explicitly assigned to later device steps in the plan. Do not hide those
  deferred items in frame execution.

## 2026-08-16 - Step 14 - Minimal WASM Frame Execution

- Symptom: Before Step 14, the WASM backend could execute single instructions
  and render an instant screen, but normal frame execution still belonged to
  the inherited TypeScript frame runner.
- Fix: Added `zxnextExecuteFrame()` and frame diagnostics to the C backend, and
  overrode `ZxNextWasmV2Machine.executeMachineFrame()` so normal WASM frames do
  not call the TypeScript `MachineFrameRunner`.
- Adapter pattern: Normal frame execution syncs changed keyboard/extended-key
  input before the frame, calls WASM once, then imports only frame counters and
  bus diagnostics. Full CPU register import still happens on explicit
  `getCpuState()` or debug StepInto.
- Timing lesson: The current C frame loop uses a 3.5 MHz CPU-tact baseline
  derived from the active standard ULA screen timing. CPU speed, contention, and
  exact multi-speed frame timing must stay in Step 19 rather than being hidden
  in Step 14.
- Rendering lesson: Step 14 renders the standard ULA screen at frame end from
  WASM. This is enough for the early frame path, but per-tact Stage-1
  prefetch/floating-bus parity remains deferred as recorded in Step 13A.
- Test lesson: Prove no normal-frame full-register sync by checking that raw
  WASM PC advances after a frame while the public adapter PC updates only after
  `getCpuState()`.
- Tests: `npm test -- --project jsdom test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts` and the broader 10-file Next WASM suite passed.
- Follow-up: Step 15 should use the new frame diagnostics to count
  unimplemented boot-time ports and prove ROM execution can reach a visible,
  non-crashing early boot state without storage.

## 2026-08-16 - Step 15 - Early Boot Smoke Without Storage

- Symptom: The minimal WASM frame runner could execute frames, but missing
  boot-time devices were still silent `0xff` fallbacks, making it hard to know
  which later migration slice blocked progress.
- Root cause: `zxnext-ports.c` had a generic fallback path with no diagnostic
  counters or owner-step classification.
- Fix: Added unsupported-port read/write counters, first-hit address/value/type
  diagnostics, owner-step classification, diagnostic-buffer entries, and public
  adapter diagnostics through `getWasmV2Diagnostics()`.
- Parity lesson: Port `0x123b` must return the TypeScript Layer 2 inert read
  value `0x00`, not the generic open-bus `0xff`, even while actual Layer 2
  behavior remains deferred to Step 22.
- Tests: `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts`,
  the broader 11-file Next WASM suite, `npm run build:check`,
  `npm run check:zxnext-wasm-size`, and `git diff --check` passed. The
  production artifact is 228,082 bytes against the 360,000 byte ceiling.
- Follow-up: Step 16 should use these diagnostics while adding DivMMC automap
  memory effects; Step 18 can extend the same boot-smoke file for the
  storage-backed milestone.

## 2026-08-16 - Step 16 - DivMMC Automap And Memory Side Effects

- Symptom: After Step 15, port `0xe3` was still reported as an unsupported
  boot-time port and the WASM memory path could not page DivMMC ROM/RAM into
  the lower 16K.
- Root cause: DivMMC state lived only in the TypeScript `DivMmcDevice` and
  `MemoryDevice` complex slot readers/writers; the C memory map only understood
  normal MMU pages.
- Fix: Added `zxnext-divmmc.c` for DivMMC enable state, `0xe3`, CONMEM,
  MAPRAM, bank selection, RST automap masks, delayed automap requests, and RETN
  clearing. `zxnext-memory.c` now consumes DivMMC overlays for reads, writes,
  and the flat 64K typed view.
- Adapter pattern: Once a port becomes WASM-owned, remove it from unsupported
  diagnostics and expose state through public `ZxNextWasmV2Machine`
  diagnostics; Step 16 added DivMMC diagnostics instead of relying only on raw
  exports.
- Parity lesson: MAPRAM is sticky unless NextReg `0x09` bit 3 allows reset;
  CONMEM and automap share the same lower-16K overlay rules, but RETN clears
  automap without clearing manual CONMEM.
- Tests: `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-divmmc.test.ts`,
  the existing TypeScript DivMMC suites, and the broader 12-file Next WASM
  suite passed. `npm run build:check`, `npm run check:zxnext-wasm-size`, and
  `git diff --check` also passed; the production artifact is 169,407 bytes
  against the 360,000 byte ceiling.
- Follow-up: Step 17 should move SPI SD-card protocol state into WASM while
  keeping sector persistence in TypeScript; NMI button/stackless-NMI/Multiface
  interactions remain with Step 20 and Step 30.

## 2026-08-16 - Step 17 - SD Card SPI State Machine

- Symptom: After DivMMC moved into WASM, SPI ports `0xe7`/`0xeb` still belonged
  to the TypeScript `SdCardDevice`, so the WASM boot path could not issue
  sector read/write requests through the normal frame-command contract.
- Root cause: The C backend had no SD command parser, per-card response state,
  mounted-card size, or journal bridge for app-owned storage persistence.
- Fix: Added `zxnext-sdcard.c` for chip-select decoding, command parsing,
  mounted-card state, CSD/CID/OCR responses, CMD17 read journals, CMD24 write
  journals, CRC16 payload responses, and success/failure write responses.
- Adapter pattern: `ZxNextWasmV2Machine` owns SPI ports directly when WASM is
  active, converts pending WASM journals to existing `sd-read`/`sd-write` frame
  commands, lazily uploads `getSdCardInfo`, and feeds IPC read/write responses
  back into WASM.
- Test lesson: SD tests need both byte-level oracle comparisons and public
  frame-command assertions; raw response bytes alone do not prove the IDE can
  persist sectors.
- Boundary lesson: Sector bytes and media policy stay in TypeScript/main
  process. SPI command state and response bytes stay in WASM. Do not add
  per-byte JS crossings after a journal is formed.
- Tests: `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-storage.test.ts`,
  `npm test -- --project jsdom test/zxnext/SdCardDevice.test.ts`, the broader
  13-file Next WASM suite, `npm run build:check`,
  `npm run check:zxnext-wasm-size`, and `git diff --check` passed. The
  production artifact is 175,276 bytes against the 360,000 byte ceiling.
- Follow-up: Step 18 should prove the storage-backed boot milestone with real
  sector data and visible standard ULA output. Exact SD read-delay timing and
  multi-block streaming remain deferred until the timing/storage robustness
  steps unless Step 18 shows the boot path requires them sooner.

## 2026-08-16 - Step 18 - Deterministic Storage-Backed Boot Smoke

- Symptom: Steps 14-17 proved frame execution, ULA rendering, DivMMC, and SD
  SPI separately, but no single boot-style flow proved that CPU-executed ROM
  code could request a sector, receive it through the adapter, and render data
  derived from that sector.
- Root cause: There was no checked-in SD-card image fixture for a real
  NextZXOS start-menu smoke, and the previous boot smoke did not exercise the
  SD frame-command path.
- Fix: Extended `wasm-next-boot-storage-ula.test.ts` with a deterministic ROM
  fixture that draws ULA pixels, selects SD card 0, issues CMD17 through real
  SPI ports, waits for the adapter-fed response, and writes the first returned
  sector byte into screen memory.
- Diagnostic pattern: Step 18 added `screenNonBlankPixelCount` as a WASM
  diagnostic export so milestone tests can report frames, SD command/read
  counts, unsupported-port counts, and rendered-pixel visibility from the same
  public adapter snapshot.
- Test lesson: CPU-driven storage tests should use `OUT (C),A`/`IN A,(C)` for
  `0xe7` and `0xeb`; immediate `OUT (n),A` changes the high byte of the port
  address because the Z80 uses `A:n`.
- Boundary lesson: Keep this milestone as an integration proof. If a real ROM
  boot later exposes missing devices, add those behaviors to their owning
  device steps instead of making Step 18 a dumping ground.
- Tests: `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-boot-storage-ula.test.ts`,
  the broader 13-file Next WASM suite, `npm run build:check`,
  `npm run check:zxnext-wasm-size`, and `git diff --check` passed. The
  production artifact is 175,368 bytes against the 360,000 byte ceiling.
- Follow-up: Step 18A should audit IDE-facing inspection APIs now that a
  deterministic early boot path exists. Real NextZXOS start-menu/manual smoke
  still needs a checked-in SD image fixture or equivalent deterministic storage
  provider.

## 2026-08-16 - Step 18A - Early IDE Inspection Baseline

- Symptom: Existing slice tests covered individual WASM exports and several
  public APIs, but no single test proved the IDE-facing inspection surface read
  coherent WASM-owned state after CPU, memory, ports, NextRegs, and ULA had
  moved.
- Fix: Added `wasm-next-ide-inspection.test.ts` to exercise public
  `getCpuState`, memory reads/writes, flat memory, partition helpers,
  disassembly-style byte reads, port bus diagnostics, NextReg ports, screen
  buffers, and normal mapped-memory code injection.
- Adapter fix: Public reads of known WASM diagnostic fallback ports now route
  through WASM. Layer 2 port `0x123b` must update last-I/O state and
  unsupported-port diagnostics instead of returning through stale TypeScript
  internals.
- Boundary lesson: Banked `injectCodeToRun` is still deferred because the
  inherited TypeScript implementation has a banked-segment `TODO`; do not
  claim banked injection parity until that source behavior exists or a
  WASM-specific implementation is added.
- Tests: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-ide-inspection.test.ts`
  and `npm test -- --project jsdom test/wasm/zxNext/wasm-next-ide-inspection.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts`
  passed.
- Follow-up: Later device steps should add their IDE panel state to this style
  of public adapter baseline as soon as each device becomes WASM-owned.

## 2026-08-16 - Step 19 - CPU Speed And 28 MHz Read Wait State

- Symptom: The WASM backend stored NextReg `$07` as a raw byte, so reads did
  not report `(effective speed << 4) | programmed speed`, and CPU instruction
  timing ignored the TypeScript 28 MHz read wait-state rule.
- Fix: Added WASM CPU speed state for programmed/effective speed, clock
  multiplier, CPU tact scale, and a contention-delay diagnostic. NR `$07` now
  has TypeScript-compatible read/write semantics and soft reset preserves
  speed while hard reset clears it.
- Timing fix: `zxnextCpuReadMemory` now adds one T-state at effective speed 3
  except when the mapped 8K page is bank-7 page `0x0e`, matching
  `ZxNextMachine.delayMemoryRead`.
- Test lesson: Compare timing through public `getCpuState().tacts` after real
  CPU instructions. Direct raw timing helpers would miss opcode-fetch reads and
  would not prove the adapter imports visible CPU state.
- Boundary lesson: Expansion-bus forced 3.5 MHz speed is deferred until the
  expansion bus is WASM-owned. Full 128K-style port contention and NR `$08`
  contention-disable gates remain a later extension beyond the current
  memory-read wait-state parity.
- Tests: `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-contention-speed.test.ts`,
  `npm test -- --project jsdom test/zxnext/MemoryDevice.test.ts test/zxnext/NextRegDevice.test.ts`,
  the 15-file Next WASM suite, `npm run build:check`,
  `npm run check:zxnext-wasm-size` (208,562 bytes against 360,000), and
  `git diff --check` passed.

## 2026-08-16 - Step 20 - Interrupt NextRegs And HW IM2 Daisy State

- Symptom: The WASM backend still returned raw bytes for interrupt NextRegs and
  public interrupt checks could only observe TypeScript-owned
  `InterruptDevice` state.
- Root cause: Interrupt status, enables, DMA masks, and daisy `InService`
  state had not been represented as structured WASM state.
- Fix: Added `zxnext-interrupt.c` with NR `$02`, `$20`, `$22`, `$23`,
  `$c0`, `$c2`, `$c3`, `$c4`, `$c5`, `$c6`, `$c8`, `$c9`, `$ca`, `$cc`,
  `$cd`, and `$ce` semantics, pulse-capture helpers, status setters for
  migrated CTC/UART inputs, daisy peek/ack/reti helpers, and adapter
  diagnostics.
- Adapter lesson: `getInterruptVector()` must peek and
  `onInterruptAcknowledged()` must acknowledge. Combining them in WASM would
  clear the request too early compared with `ZxNextMachine`.
- Boundary lesson: Full NMI entry/hold/end, stackless RETN fixups, Multiface,
  DivMMC NMI, expansion-bus NMI, and live DMA/CTC generation remain with their
  owning device slices.
- Tests: `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-interrupts.test.ts`,
  TypeScript interrupt/daisy/palette/composed-screen oracle suites, the
  17-file Next WASM suite, `npm run build:check`, and
  `npm run check:zxnext-wasm-size` (218,684 bytes against 360,000) passed.

## 2026-08-16 - Step 21 - Palette, Timex, And ULA+ Port State

- Symptom: Standard ULA rendering used a hard-coded default palette, and the
  WASM backend treated Timex and ULA+ ports as unsupported diagnostics.
- Root cause: Palette arrays, NR `$40`/`$41`/`$43`/`$44` latches, and classic
  enhanced-video port state had not been migrated from `PaletteDevice` and
  `NextIoPortManager`.
- Fix: Added `zxnext-palette.c` with first/second palette arrays for ULA,
  Layer 2, sprites, and tilemap; ported NR `$28`, `$40`, `$41`, `$43`, `$44`;
  changed the ULA renderer to read WASM palette entries; and added Timex
  `$00ff` plus ULA+ `$bf3b`/`$ff3b` port state.
- Test lesson: A palette register readback test is not enough. Keep a public
  pixel-buffer assertion that changes a ULA palette entry and proves
  `renderInstantScreen()` uses the migrated palette array.
- Boundary lesson: Timex Hi-Res/Hi-Color and full ULA+ pixel-selection
  composition remain with later composed video steps; this slice owns their
  current port/palette state.
- Tests: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-palette-ulaplus.test.ts`,
  affected WASM adapter/screen tests, TypeScript palette/composed-screen
  oracle suites, the 17-file Next WASM suite, `npm run build:check`, and
  `npm run check:zxnext-wasm-size` (218,684 bytes against 360,000) passed.

## 2026-08-16 - Step 22 - Layer 2 And LoRes Rendering

- Symptom: `0x123b` and Layer 2/LoRes NextRegs were still fallback bytes, so
  WASM could not exercise Layer 2 RAM windows or composed Layer 2/LoRes pixels.
- Fix: Added `zxnext-layer2.c` for Layer 2/LoRes state, owned `0x123b`, Layer
  2 RAM window mapping after DivMMC precedence, Layer 2/LoRes NextRegs, and
  instant-renderer helpers for 256x192, 320x256, 640x256, standard LoRes, and
  Radastan LoRes fixed fixtures.
- Addressing lesson: Layer 2 CPU window mapping and direct Layer 2 rendering
  SRAM layout are different paths. Use the `0x123b` mapping only for CPU
  window tests; render fixtures should write the direct bank-8 Layer 2 SRAM
  layout used by `NextComposedScreenDevice`.
- Test lesson: Older fallback tests that used Step 22-owned ports/registers
  must be updated when ownership moves. `0x123b` no longer increments
  unsupported-port diagnostics, and NextReg `$13` now masks to a Layer 2 shadow
  RAM bank value.
- Boundary lesson: This slice implements the transparent Layer 2 overlay needed
  by fixed fixtures. The full priority matrix across sprites, tilemap, ULA,
  Layer 2, and clipping remains for later composed-video slices.
- Tests: `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-layer2-lores.test.ts`,
  affected WASM screen/palette/memory tests, the 15-file Next WASM suite,
  `npm run build:check`, `npm run check:zxnext-wasm-size` (223,985 bytes
  against 360,000), and `git diff --check` passed.

## 2026-08-16 - Step 23 - Tilemap Rendering

- Symptom: Tilemap registers and pixels were still TypeScript-owned, while the
  WASM instant renderer could only compose ULA/LoRes/Layer 2.
- Fix: Added `zxnext-tilemap.c` with tilemap control/default-attribute/base
  registers, scroll, clip, transparency, second-palette select, bank-7 VRAM
  base masking, graphics/text tile pixel decoding, and tilemap-versus-ULA
  priority handling in the instant compositor.
- Shared-register lesson: NR `$1c` is a multi-owner clip-control register.
  Device handlers should update their bit and allow dispatch to continue when
  other migrated devices may need the same write.
- Addressing lesson: Tilemap VRAM base addition is high-byte based, and bank 7
  masks the base offset to five bits while bank 5 keeps six bits. Keep a small
  exported address helper in WASM tests because this is easy to regress.
- Test lesson: The TypeScript tilemap render path depends on `onNewFrame()`
  and config sampling; public `renderInstantScreen()` is not a clean oracle for
  focused tilemap pixels. For migrated WASM tilemap fixtures, assert exact
  palette-derived pixels and keep TypeScript tilemap-focused suites green as
  supporting coverage.
- Boundary lesson: This slice covers selected 40x32/80x32 tilemap fixtures and
  ULA priority. Stencil blending and complete cross-layer ordering with sprites
  remain for later composed-video slices.
- Tests: `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-tilemap.test.ts`,
  adjacent WASM video/NextReg suites, the 16-file Next WASM suite,
  `npm test -- --project jsdom test/zxnext/TilemapDevice-compositing.test.ts test/zxnext/TilemapDevice-d1d2.test.ts`,
  `npm run build:check`, `npm run check:zxnext-wasm-size` (228,032 bytes
  against 360,000), and `git diff --check` passed.

## 2026-08-16 - Step 24 - Sprite Rendering

- Symptom: Sprite ports, NextRegs, pattern RAM, and pixels were still
  TypeScript-owned, so WASM screen composition could not draw or inspect sprite
  state without falling back to unsupported-port diagnostics.
- Fix: Added `zxnext-sprites.c` for sprite slot/status ports, mirror protocol,
  direct and sequential attributes, 8-bit/4-bit pattern transform variants,
  clip windows, dimensions, sprite palette lookup, priority, collision status,
  and representative non-relative sprite pixels in `zxnext-screen.c`.
- Adapter lesson: Owning a port in C is not enough. Add it to
  `isWasmV2OwnedPort()` as soon as reads become authoritative, otherwise
  `doReadPort()` can still return TypeScript state and hide the WASM latch.
- Shared-register lesson: NR `$15` is now shared by LoRes and sprites, and NR
  `$1c` is shared by clip owners. Device write handlers should update their
  bits and return unhandled when another migrated device also owns the
  register.
- Palette lesson: The current C palette table uses palette bank `2`/`6` for
  sprite first/second palettes; focused WASM fixtures should select NR `$43`
  value `0x20` for the first sprite palette until full palette-index parity is
  revisited.
- Boundary lesson: This slice intentionally covers deterministic non-relative
  sprite pixels. Relative sprite-chain resolution, line-buffer timing/overtime,
  and complete cross-layer priority matrix belong with Step 25 composition
  parity.
- Tests: `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-sprites.test.ts`,
  adjacent WASM video suites, the 17-file/98-test Next WASM suite,
  `npm run build:check`, `npm run check:zxnext-wasm-size` (233,754 bytes
  against 360,000), and `git diff --check` passed.

## 2026-08-16 - Step 25 - Full Screen Composition Parity

- Symptom: The WASM instant renderer still used a fixed overlay order
  (tilemap, then Layer 2, then sprites), ignoring NR `$15` layer-priority
  modes and Layer 2 palette priority bits.
- Fix: Added packed layer-pixel metadata for valid/priority/RGB333, ported the
  `composeSinglePixel` priority switch for modes `SLU`, `LSU`, `SUL`, `LUS`,
  `USL`, `ULS`, and blend modes 6/7, and exposed `layerPriority` plus
  `fallbackColor` diagnostics.
- Pixel-metadata lesson: Do not use `0` as the transparency sentinel once
  composition leaves BGRA space. Opaque black is a valid RGB333 value, so use a
  separate valid bit in packed layer outputs.
- Fixture lesson: NR `$70` low nibble is Layer 2 palette offset, not a 256-mode
  selector. Leaving it at `0x01` silently shifts palette index `$42` to `$52`.
- Shared-state lesson: Keep old BGRA helpers as wrappers around packed pixel
  helpers. That preserves earlier focused tests while allowing the final
  compositor to see priority metadata.
- Boundary lesson: This step ports instant-renderer composition parity. It does
  not yet make sprite rendering cycle/overtime accurate, expand sprites into
  the full border area, or implement every NR `$68` stencil/ULA-control edge.
- Tests: `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-screen-composition.test.ts`,
  adjacent WASM video suites, the 18-file/101-test Next WASM suite,
  `npm test -- --project jsdom test/zxnext/NextComposedScreenDevice.test.ts test/zxnext/Layer2Fixes.test.ts test/zxnext/UlaRendering.test.ts`,
  `npm run build:check`, `npm run check:zxnext-wasm-size` (234,532 bytes
  against 360,000), and `git diff --check` passed.

## 2026-08-16 - Step 26 - Beeper, TurboSound, PSG, DAC, And Mixer

- Symptom: The Next WASM runtime exposed an audio sample buffer but never
  produced samples, so `ZxNextWasmV2Machine.getAudioSamples()` still inherited
  the TypeScript mixer path.
- Fix: Added `zxnext-audio.c`, `zxnext-dac.c`, and `zxnext-psg.c`. WASM now
  owns representative frame audio generation, DAC NextRegs and port aliases,
  audio-control flags, AY register/data/info ports, TurboSound chip selection
  and panning, PSG current-state stereo levels, and int16 sample export.
- Adapter lesson: Follow the existing 48K/+3E WASM pattern: keep a reusable
  `AudioSample[]` cache in the machine adapter, read `zxnextGetAudioSampleCount`,
  and normalize `int16_t` words with `/ 32768`.
- Port-enable lesson: DAC and AY gates live in internal port-enable group index
  `2`, which is NextReg `$84`; NextReg `$85` is group index `3` and still masks
  to `$8f`. Disabled-but-known ports should be handled as no-ops, not reported
  as unsupported.
- Mixer lesson: Mirror the TypeScript mixer in integer C: EAR and MIC are
  AC-coupled signed levels scaled by `12`, DAC output is centered at `(0x80 +
  0x80) << 2`, PSG output is divided by `24` and centered from the stereo peak,
  then the sum is multiplied by `5.5` and clipped to int16.
- Boundary lesson: This step covers deterministic current-state PSG/TurboSound
  routing and representative sample output. Cycle-accurate YM waveform,
  envelope/noise progression, PSG tact accumulation, and exact per-frame sample
  timing should be handled as a later refinement, ideally by lifting more of the
  mature 128K/+3E PSG core.
- Tests: `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-audio.test.ts`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-audio.test.ts test/audio`,
  the 19-file/108-test Next WASM suite, `npm run build:check`,
  `npm run check:zxnext-wasm-size` (239,952 bytes against 360,000), and
  `git diff --check` passed.

## 2026-08-16 - Step 27 - DMA

- Symptom: `$6B`/`$0B` DMA ports were still reported as unsupported by the
  WASM runtime, and no C-owned DMA could move bytes through the WASM MMU or port
  manager.
- Fix: Added `zxnext-dma.c` with representative MAME-style base-byte dispatch,
  follow-byte queues, raw WR register storage, ZXN/legacy mode selection,
  status/read-mask sequencing, bus request/acknowledge state, memory and simple
  port transfers, auto-restart, and DMA diagnostics.
- Port lesson: `$6B` ZXN DMA is gated by internal port-enable group `0`, bit
  `5`; `$0B` legacy Z80 DMA is gated by group `3`, bit `1`. Hook these in
  `zxnext-ports.c` before the unsupported fallback, but keep the match to low
  byte only because the TypeScript port manager uses an 8-bit port mask here.
- Memory lesson: DMA can use `zxnextReadMemory()` and `zxnextWriteMemory()` for
  migrated tests. That automatically respects the current C MMU, Layer 2 mapped
  windows, and DivMMC write interception without TypeScript callbacks.
- State-machine lesson: Expose both `zxnextStepDma()` and `zxnextRunDma()`.
  The first keeps bus arbitration visible for tests, while the second gives a
  deterministic block-transfer helper without forcing the incomplete timing
  model into every CPU frame.
- Boundary lesson: This slice covers representative block transfers and status
  behavior. Cycle-accurate specnext DMA timing, search/match edge cases,
  interrupt-line arbitration, DMA break-in from interrupt sources, and full
  audio-paced DMA should be refined against the larger `DmaDevice*.test.ts`
  suite later.
- Tests: `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-dma.test.ts`,
  the 20-file/115-test Next WASM suite, `npm run build:check`,
  `npm run check:zxnext-wasm-size` (246,186 bytes against 360,000), and
  `git diff --check` passed.

## 2026-08-16 - Step 28 - Copper

- Symptom: Copper program memory and raster execution still lived in
  TypeScript, so WASM rendering could not apply raster-positioned NextReg
  writes during its own screen pass.
- Fix: Added `zxnext-copper.c` with C-owned 2 KB Copper memory, NextReg
  `$60..$64` behavior, delayed MOVE output, WAIT stalling, mode-3 adjusted-line
  restart, render-loop ticking, and Copper diagnostics/exports.
- Register-routing lesson: Copper MOVE output must call `writeNextRegInternal()`
  rather than mutating device fields directly. That keeps writes to registers
  like `$14` flowing through the same palette/video side-effect path as CPU and
  port writes.
- Timing-table lesson: The WASM screen renderer already has per-tact HC/VC
  tables, so Copper can tick at the top of the instant-render loop before
  pixel composition samples register-dependent state.
- Fixture lesson: A zero-filled Copper program is not a stable idle program;
  it is a stream of NOPs that wraps back to slot 0. For frame-level tests,
  place a WAIT with `hc6=63` after the focused MOVE so execution stalls for the
  rest of a 456-HC frame.
- Boundary lesson: This slice covers deterministic NextReg loading and
  instant-render raster effects. Exact contention/cycle coupling with CPU
  execution and deeper oracle parity against the full `CopperDevice.test.ts`
  suite remain later refinements.
- Tests: `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-copper.test.ts`,
  the 21-file/123-test Next WASM suite, `npm run build:check`,
  `npm run check:zxnext-wasm-size` (247,821 bytes against 360,000), and
  `git diff --check` passed.

## 2026-08-16 - Step 29 - CTC

- Symptom: CTC ports `0x183b..0x1f3b` were still marked Step 29 unsupported,
  and the WASM runtime had no lazy-synced timer/counter state feeding CTC
  interrupt status.
- Fix: Added `zxnext-ctc.c` with channel control words, time-constant staging,
  prescalers, counters, ZC/TO pulses, single-clock stepping, batched
  `advanceToSysClock()`, IM2-vector write detection, port gating, and interrupt
  status integration.
- Lazy-sync lesson: Port reads/writes need an explicit `ctcLastSyncClock`.
  After the two write-cycle clocks used to emulate the FPGA `iowr` edge, the
  sync clock can be ahead of the current frame clock; guard `advanceToSysClock`
  with `current <= last` rather than unsigned subtraction.
- Clock-domain lesson: The current WASM frame counter is CPU-tact based, while
  TypeScript CTC sync uses the 28 MHz system-clock domain. For now, port sync
  uses `frameTacts * 8`, and tests also exercise explicit system-clock
  advancement.
- Port lesson: CTC matching is `(port & 0xf8ff) == 0x183b`, with channel in
  address bits `A10..A8`; the older unsupported-owner matcher was too narrow
  for channels `1..7`.
- Boundary lesson: The TypeScript device implements channels `0..3` and treats
  channels `4..7` as hardwired zero on ports. The WASM state arrays are sized
  for eight interrupt bits, but the migrated port behavior intentionally
  preserves the current TypeScript-visible four-channel CTC.
- Tests: `npm run build:zxnext-wasm`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-ctc.test.ts`,
  the 22-file/129-test Next WASM suite, `npm run build:check`,
  `npm run check:zxnext-wasm-size` (253,796 bytes against 360,000), and
  `git diff --check` passed.

## 2026-08-16 - Step 30 - Multiface And Expansion Bus

- Symptom: Multiface ports/memory and expansion-bus ROMCS/NMI state were still
  TypeScript-owned, so WASM memory reads could not model slot-0 overlays that
  preempt normal ROM, DivMMC, or external bus data.
- Fix: Added `zxnext-multiface.c` and `zxnext-expansion.c`, wired them into the
  memory, NextReg, interrupt, port, CPU-speed, loader/export, and adapter
  diagnostic paths, and added focused WASM coverage for migrated
  Multiface/expansion cases.
- Memory-priority lesson: Slot-0 reads must check Multiface first, then DivMMC,
  then expansion ROMCS replacement/external-bus data, then Layer 2/normal MMU.
  Multiface page 0 is read-only ROM; page 1 is writable RAM stored in the
  Multiface ROM buffer range.
- Port-overlap lesson: Multiface low-byte ports overlap with other devices,
  especially `$1f`. The C port router should only intercept the currently
  selected Multiface enable/disable low byte; otherwise DAC and later joystick
  ports lose their existing behavior.
- NMI lesson: Software MF/DivMMC NMI requests from NR `$02` feed the C NMI
  cause machine, and accepted causes drive `z80SetSigNmi()` at opcode-fetch
  boundaries. Expansion-bus NMI is consumed only when enabled and memory cycles
  are not disabled; Multiface keeps priority over expansion bus.
- Expansion-bus lesson: NR `$80` enabling also forces the current effective CPU
  speed to 3.5 MHz while preserving the programmed speed, so speed diagnostics
  need both fields.
- Tests: `node scripts/build-zxnext-wasm.cjs`,
  `npm test -- --project jsdom test/wasm/zxNext/wasm-next-multiface-expansion.test.ts`,
  the 23-file/135-test Next WASM suite, `npm run build:check`,
  `npm run check:zxnext-wasm-size` (257,884 bytes against 360,000), and
  `git diff --check` passed.

## 2026-08-16 - Step 31 - Joystick And Mouse

- Symptom: Kempston joystick/mouse decode still lived in the TypeScript
  `KempstonHandler`, while WASM-owned port dispatch had already reached the
  overlapping Multiface and DAC ports.
- Fix: Added `zxnext-input.c`, WASM exports for changed joystick/mouse state,
  `$05` joystick mode sync, `$0A` mouse swap/DPI sync, `$0B` joystick I/O mode
  sync, and adapter-side changed-state sync before input port reads, frames, and
  input NextReg reads.
- Port-priority lesson: Mouse ports use `(port & 0x0fff)` and must be decoded
  before Multiface low-byte ports. Joystick `$1f` and `$df/$37` must be decoded
  after the currently selected Multiface enable/disable ports so Step 30 keeps
  ownership of active Multiface transitions without stealing joystick reads.
- Sync lesson: Joystick and mouse physical state remain app-owned, but WASM owns
  port decode and mode/gate selection. The adapter should push state only when
  the cached values change, following the keyboard-row pattern.
- NextReg lesson: Direct app-owned mouse changes can affect NR `$0A` reads, so
  the NextReg bridge must sync input state before reading `$0A/$0B`.
- Tests: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-input.test.ts`,
  the 24-file/141-test Next WASM suite, `npm run build:check`,
  `node scripts/build-zxnext-wasm.cjs`, `npm run check:zxnext-wasm-size`
  (260,689 bytes against 360,000), and `git diff --check` passed.

## 2026-08-16 - Step 32 - UART And I2C

- Symptom: UART and I2C/RTC ports were still TypeScript-owned, so WASM port
  routing returned unsupported fallback values for `$103b/$113b` and
  `$133b/$143b/$153b/$163b`.
- Fix: Added `zxnext-uart.c` and `zxnext-i2c.c`, wired them into WASM port
  dispatch, exports, diagnostics, frame completion, and NR `$83` gate checks,
  and added focused peripheral coverage.
- UART lesson: The selected UART matters for every port operation. Select-port
  writes update prescaler MSB on the old selected channel before switching, and
  frame bit 7 clears only the selected channel while storing bits 6:0.
- I2C lesson: The bit-bang state machine depends on SCL falling edges to drive
  ACK/read-data bits and SCL rising edges to sample master bits. Tests should
  use the same START/STOP/writeBit/readBit shape as the TypeScript suite rather
  than direct state pokes.
- RTC policy lesson: Host time remains TypeScript-owned. WASM receives a bounded
  64-byte CMOS snapshot during setup/reset and then owns subsequent DS1307 I2C
  transitions and frame-based clock advancement.
- Port lesson: I2C ports belong before Layer 2 in the Next port table; UART
  ports belong after Layer 2 and before CTC. Both are exact 16-bit port matches
  and return `0xff` when their NR `$83` gate is closed.
- Tests: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-peripherals.test.ts`,
  the 25-file/147-test Next WASM suite, `npm run build:check`,
  `node scripts/build-zxnext-wasm.cjs`, `npm run check:zxnext-wasm-size`
  (267,221 bytes against 360,000), and `git diff --check` passed.

## 2026-08-16 - Step 33 - +3 Floppy/FDC Hook

- Ownership decision: Keep Next +3 FDC TypeScript-owned for now. The current
  `FloppyControllerDevice` already owns disk parsing, command execution, motor
  timing, media state, and `DISK_*_CHANGES` persistence, and the migration plan
  did not identify FDC as a hot path worth uploading into WASM in this step.
- Adapter lesson: `$2ffd/$3ffd` should be explicit TypeScript-owned ports in
  `ZxNextWasmV2Machine`. Reads already fell through to the TypeScript port
  manager because these ports are not WASM-owned; writes also need to stop at
  `super.doWritePort()` so WASM unsupported-port diagnostics do not record FDC
  command bytes.
- Split-port lesson: `$1ffd` remains mixed ownership. WASM owns the paging bits
  and public memory latch diagnostics; TypeScript owns bit 3 motor side effects.
  Tests should assert that split instead of expecting the motor bit in
  `zxnextGetPort1ffdValue()`.
- Frame-loop lesson: With the WASM frame loop overriding the base TypeScript
  frame lifecycle, TypeScript-owned floppy state still needs an explicit
  `floppyDevice.onFrameCompleted()` after `zxnextExecuteFrame()` so motor speed
  and disk-change publication keep advancing.
- Tests: `npm test -- --project jsdom test/wasm/zxNext/wasm-next-floppy.test.ts`,
  the 26-file/152-test Next WASM suite, `npm run build:check`,
  `node scripts/build-zxnext-wasm.cjs`, `npm run check:zxnext-wasm-size`
  (267,221 bytes against 360,000), and `git diff --check` passed.
