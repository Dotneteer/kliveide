# ZX Spectrum Next WASM Backend

The ZX Spectrum Next WASM backend is the production backend for the normal
model. The earlier binary-size inversion has been explained by missing shared
Z80N timing hooks, and the timing-depth audit is closed. The production artifact
name is `zx-spectrum-next.wasm`, built from this folder and loaded by
`ZxNextWasmV2Loader.ts`.

## Layout

- `zxnext/`: the freestanding C implementation.
- `dist/`: generated production WASM artifact.
- `ZxNextWasmV2Loader.ts`, `frameTraceLayout.ts`: the loader and the frame-trace ring layout.

## How The Machine Is Put Together

`ZxNextWasmV2Machine` stands on its own; it does not derive from the TypeScript `ZxNextMachine`.

```
Z80Cpu -> Z80MachineBase -> ZxNextWasmHost -> ZxNextWasmV2Machine   (this backend)
Z80Cpu -> Z80NCpu -> Z80NMachineBase -> ZxNextMachine               (TypeScript compatibility)
```

- `ZxNextWasmHost` is the host-side plumbing that does not depend on how the hardware is emulated:
  frame units for the pacing, the key-stroke queue, code injection, partition names, sysvars.
- What both machines share lives in neutral modules next to them - `nextMachineInfo.ts` (partition
  naming, disassembly sections, the NextZXOS code-injection flow, step-over lengths),
  `nextMemoryLayout.ts`, `nextRegDescriptors.ts`, `nextCoreVersion.ts`, `nextRtc.ts`,
  `nextKeyCodes.ts`, `nextColorTables.ts`, `z80nInstructionLengths.ts` - and in the IDE contract
  `IZxNextIdeMachine`, which both implement and `MainToEmuProcessor` talks to.
- `test/wasm/zxNext/wasm-next-separation.test.ts` fails if a TypeScript Next class, device or port
  handler becomes reachable from this machine or its loader again, even through a type import.

The runtime switch has two supported values:

- `zxnextImplementation: "typescript"` selects the TypeScript machine and
  remains available as a compatibility fallback and parity oracle.
- `zxnextImplementation: "wasm"` selects the production WASM backend.

Diagnostics from `ZxNextWasmV2Machine.getWasmV2Diagnostics()` report the runtime's sizes,
frame and tact counters, and the last stop reason. (The rollout fields - migrated surfaces,
default readiness, blockers - were removed with the TypeScript core's parity tests, 2026-09-19.)

## Maintenance Policy

New ZX Spectrum Next emulator behavior should be implemented in WASM first, or
in TypeScript and WASM together when the TypeScript oracle needs to grow.
TypeScript-only emulator changes are reserved for behavior that is explicitly
host-owned rather than machine-owned.

The TypeScript backend remains a supported compatibility fallback and parity
oracle. Keep it selectable through `zxnextImplementation: "typescript"` and
the `ZX Spectrum Next Compatibility` model until a separate deprecation plan
removes it.

Use TypeScript oracle tests for behavior parity and WASM matrix tests for the
production backend. When a Next device stays separate from the shared Spectrum
WASM devices, keep the reason documented in the migration plan or in an oracle
test.

Boundaries that remain host-owned after the default flip include IDE/UI policy,
Electron resource lookup, host file and media persistence, and test harness
setup. Those boundaries may call into WASM, but they are not reasons to move
machine-owned behavior back to TypeScript.

Build with `npm run build:zxnext-wasm`. The compiler defaults to `clang`; set
`ZXNEXT_WASM_CC` to select another C compiler. The build script uses the
portable `wasm32` target and `wasm-ld`, so it does not require Emscripten.
