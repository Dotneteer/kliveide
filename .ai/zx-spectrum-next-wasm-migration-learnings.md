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
