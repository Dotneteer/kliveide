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

## 2026-08-16 - Step 4 - ZX Next WASM Build Scaffold

- Symptom: ZX Spectrum Next had no standalone production WASM artifact pipeline.
- Root cause: The prior Spectrum machines each had dedicated build scripts and
  package resource entries, but Next was still TypeScript-only.
- Fix: Added the Next build script, type declaration, size checker, package
  scripts, package resource copy, and a minimal C module exporting only
  production scaffold symbols.
- Tests: `npm test -- --project jsdom test/zxnext/zxnext-wasm-build.test.ts`,
  `npm run build:zxnext-wasm`, and `npm run check:zxnext-wasm-size` passed.
  The current artifact is 2,169 bytes against the 80,000 byte ceiling.
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
