# ZX Spectrum Next WASM Backend

This is the ZX Spectrum Next emulator. There is no other one: the TypeScript Next machine and its
~25 devices were removed once this core reached parity with them
(`.plans/ZX_SPECTRUM_NEXT_TYPESCRIPT_REMOVAL_PLAN.md`; the last commit that still had both is tagged
`pre-zxnext-ts-removal-2026-09-19`). The production artifact is `zx-spectrum-next.wasm`, built from
this folder and loaded by `ZxNextWasmV2Loader.ts`.

## Layout

- `zxnext/`: the freestanding C implementation.
- `dist/`: generated production WASM artifact.
- `ZxNextWasmV2Loader.ts`, `frameTraceLayout.ts`: the loader and the frame-trace ring layout.

## How The Machine Is Put Together

```
Z80Cpu -> Z80MachineBase -> ZxNextWasmHost -> ZxNextWasmV2Machine
```

- `ZxNextWasmHost` is the host-side plumbing that does not depend on how the hardware is emulated:
  frame units for the pacing, the key-stroke queue, code injection, partition names, sysvars.
- Machine facts that are not emulation live in neutral modules next to it - `nextMachineInfo.ts`
  (partition naming, disassembly sections, the NextZXOS code-injection flow, step-over lengths),
  `nextMemoryLayout.ts`, `nextRegDescriptors.ts`, `nextCoreVersion.ts`, `nextRtc.ts`,
  `nextKeyCodes.ts`, `nextColorTables.ts`, `z80nInstructionLengths.ts`.
- The IDE reads machine state only through `IZxNextIdeMachine`, which `MainToEmuProcessor` talks to;
  host input (joysticks, the Kempston mouse) goes in through `IZxNextHostInputMachine`.

This shape is not incidental. `ZxNextWasmV2Machine` used to *extend* the TypeScript `ZxNextMachine`,
so every WASM machine constructed and reset all of its devices, and several paths - the keyboard,
code injection, frame pacing, four IDE panels - quietly kept running TypeScript emulation while the
core ran beside them. `test/wasm/zxNext/wasm-next-separation.test.ts` fails if an emulated device
class becomes reachable from this machine or its loader again, even through a type import, and if
any of the deleted files reappears. Read
`.ai/wasm-migration-intent-and-lessons.md` before starting the next machine's migration.

`ZxNextWasmV2Machine.getWasmV2Diagnostics()` reports the runtime's sizes, frame and tact counters,
and the last stop reason.

## Maintenance Policy

ZX Spectrum Next emulator behaviour is implemented in C, against the FPGA sources in
`_input/next-fpga/` — the VHDL is the reference, and a claim in a test is expected to cite it.
TypeScript changes are for behaviour that is host-owned rather than machine-owned: IDE and UI
policy, Electron resource lookup, host file and media persistence, test-harness setup. Those may
call into WASM; they are not a reason to move machine-owned behaviour back out of it.

Tests:

- `test/zxnext-hw/` - the hardware harness: the real core driven only through ports, NextRegs,
  memory, registers, the picture and audio. New device behaviour goes here. Read
  `test/harness/zxnext/README.md` first.
- `test/visual/` - pixel cases judged by probes, goldens and AI review (`npm run test:visual`).
- `test/wasm/zxNext/` - what the harness cannot reach: the loader and memory layout, the machine
  lifecycle, checkpoints, the debug loop, boot traces, IDE-facing state.

When a Next device stays separate from the shared Spectrum WASM devices, keep the reason documented
in `wasm-next-shared-source-contract.test.ts`.

Build with `npm run build:zxnext-wasm`. The compiler defaults to `clang`; set `ZXNEXT_WASM_CC` to
select another C compiler. The build script uses the portable `wasm32` target and `wasm-ld`, so it
does not require Emscripten.
