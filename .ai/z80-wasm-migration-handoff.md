# Z80 WASM Migration Handoff

Read `../AGENTS.md` and `.plans/ZX_SPECTRUM_48_WASM_INITIAL_PLAN.md` before
changing this work. This note records the state after completing the DD/FD and
DDCB/FDCB indexed migration rows I0–I6 on 2026-08-02.

## Current completion state

- The original TypeScript Z80 remains the production implementation.
- The C/WASM CPU prototype is test-only and is not connected to the Spectrum
  48K frame runner.
- Z0–Z5, all unprefixed standard pages S00–SF0, CB pages C0–C3, ED pages
  E0–E2, and indexed DD/FD + DDCB/FDCB pages I0–I6 are complete.
- The next planned family is the next uncompleted row after I6 in
  `.plans/ZX_SPECTRUM_48_WASM_INITIAL_PLAN.md`.
- Z80N migrations have not started.

The source-of-truth plan is the initial plan above. Keep it updated as steps
are completed; it is intentionally a living initial plan.

## Architecture that must be preserved

- `src/emu/machines/MachineController.ts` stays TypeScript. Its synchronous
  `machine.executeMachineFrame()` call is the eventual backend switch point.
- The future WASM implementation owns the hot CPU/frame kernel. TypeScript
  retains controller lifecycle, debugger policy, UI, file access, and host
  integration.
- CPU C code lives in `src/emu/z80/wasm/z80_cpu.c`; ABI wrappers and test-bus
  storage live in `z80_abi.c`. Do not move instruction code or opcode tables
  back into the ABI file.
- The CPU uses one central `executeCpuCycle` routine plus prefix-specific
  256-entry function-pointer tables. Opcode functions return `void`; only the
  central dispatcher converts illegal-table lookup into an execution result.
- Follow the names and readable structure of `src/emu/z80/Z80Cpu.ts` wherever
  C has an equivalent. Use original camelCase instruction/helper names, opcode
  and mnemonic comments, named temporaries, and multi-line bodies. Do not use
  opaque names such as `op_08` or compress an operation into one line.
- C register pairs use the internal `Z80Register16` union. Do not expose C
  struct layout as a production ABI; use explicit ABI accessors or later a
  packed, versioned state block.

## Test strategy and current harness

For a migrated page, copy the matching original test page to
`test/z80/<page>.wasm.test.ts`, changing only the import of `RunMode` and
`Z80TestMachine` to `./wasm-test-z80`. The test cases themselves must remain
literal copies.

`test/z80/wasm-test-z80.ts` is the test-only WASM facade. It currently exposes
the API required by S00–SF0, including register and alternate-register
setters, interrupt flip-flops, RAM, I/O input sequences, I/O logs, run modes,
and assertion helpers. The I/O event record in WASM memory is little-endian:
`uint16_t address`, `uint8_t value`, `uint8_t operation` (`1` is output).

The current C test bus is deterministic and in linear memory:

- 64K `test_memory`.
- Preloaded `io_input` bytes.
- fixed-capacity memory, I/O, and TBBlue log arrays.

It is intentionally test-only. Normal production frame execution must later
use batch/state/event buffers and must not cross the TypeScript/WASM boundary
once per instruction, tact, memory access, or port access.

## Important files

- `.plans/ZX_SPECTRUM_48_WASM_INITIAL_PLAN.md` — full architecture and staged plan.
- `src/emu/z80/Z80Cpu.ts` — semantic/naming/timing reference.
- `src/emu/z80/wasm/z80_cpu.c` — current C CPU implementation.
- `src/emu/z80/wasm/z80_abi.c` / `.h` — stable export wrappers and test bus.
- `src/emu/z80/wasm/z80_state.h` — CPU state, flags, and ABI field constants.
- `src/emu/z80/wasm/z80_test_bus.h` — shared test-bus declarations.
- `scripts/build-sp48-wasm.cjs` — compiles `z80_abi.c` and `z80_cpu.c` as
  separate translation units and exports the current test ABI.
- `test/z80/z80-wasm-abi.test.ts` — ABI/build and CPU-shell tests.
- `test/z80/z80-wasm-primitives.test.ts` — C primitive tests.
- `test/z80/wasm-test-z80.ts` — test facade.

## Verification baseline

At the S00–SF0 handoff, the following passed:

```sh
npm run test
npm run build:check
```

The full suite result was 19,031 passed and 14 skipped. Expected-error output
from unrelated React provider tests may be printed during the suite, but Vitest
must still finish with zero failed tests.

After completing E0–E2 and I0–I3, the focused gates added/passed are:

```sh
npx vitest run --config build/vitest.config.ts --project node test/z80/ext-op-a0.wasm.test.ts test/z80/ext-op-b0.wasm.test.ts
npx vitest run --config build/vitest.config.ts --project node test/z80/ix-ops-00.wasm.test.ts test/z80/iy-ops-00.wasm.test.ts test/z80/ix-ops-10.wasm.test.ts test/z80/iy-ops-10.wasm.test.ts test/z80/ix-ops-20.wasm.test.ts test/z80/iy-ops-20.wasm.test.ts test/z80/ix-ops-30.wasm.test.ts test/z80/iy-ops-30.wasm.test.ts
npx vitest run --config build/vitest.config.ts --project node test/z80/ix-ops-40.wasm.test.ts test/z80/iy-ops-40.wasm.test.ts test/z80/ix-ops-50.wasm.test.ts test/z80/iy-ops-50.wasm.test.ts test/z80/ix-ops-60.wasm.test.ts test/z80/iy-ops-60.wasm.test.ts test/z80/ix-ops-70.wasm.test.ts test/z80/iy-ops-70.wasm.test.ts test/z80/ix-ops-80.wasm.test.ts test/z80/iy-ops-80.wasm.test.ts test/z80/ix-ops-90.wasm.test.ts test/z80/iy-ops-90.wasm.test.ts test/z80/ix-ops-a0.wasm.test.ts test/z80/iy-ops-a0.wasm.test.ts test/z80/ix-ops-b0.wasm.test.ts test/z80/iy-ops-b0.wasm.test.ts
npx vitest run --config build/vitest.config.ts --project node test/z80/ed-indexed-wasm-differential.test.ts
```

After completing I4–I6, the focused gates added/passed are:

```sh
npx vitest run --config build/vitest.config.ts --project node test/z80/ix-ops-c0.wasm.test.ts test/z80/iy-ops-c0.wasm.test.ts test/z80/ix-ops-d0.wasm.test.ts test/z80/iy-ops-d0.wasm.test.ts test/z80/ix-ops-e0.wasm.test.ts test/z80/iy-ops-e0.wasm.test.ts test/z80/ix-ops-f0.wasm.test.ts test/z80/iy-ops-f0.wasm.test.ts
npx vitest run --config build/vitest.config.ts --project node test/z80/ix-bit-ops-00.wasm.test.ts test/z80/iy-bit-ops-00.wasm.test.ts test/z80/ix-bit-ops-10.wasm.test.ts test/z80/iy-bit-ops-10.wasm.test.ts test/z80/ix-bit-ops-20.wasm.test.ts test/z80/iy-bit-ops-20.wasm.test.ts test/z80/ix-bit-ops-30.wasm.test.ts test/z80/iy-bit-ops-30.wasm.test.ts test/z80/ix-bit-ops-bit.wasm.test.ts test/z80/iy-bit-ops.bit.wasm.test.ts
npx vitest run --config build/vitest.config.ts --project node test/z80/ix-ops-c0.test.ts test/z80/iy-ops-c0.test.ts test/z80/ix-ops-d0.test.ts test/z80/iy-ops-d0.test.ts test/z80/ix-ops-e0.test.ts test/z80/iy-ops-e0.test.ts test/z80/ix-ops-f0.test.ts test/z80/iy-ops-f0.test.ts test/z80/ix-bit-ops-00.test.ts test/z80/iy-bit-ops-00.test.ts test/z80/ix-bit-ops-10.test.ts test/z80/iy-bit-ops-10.test.ts test/z80/ix-bit-ops-20.test.ts test/z80/iy-bit-ops-20.test.ts test/z80/ix-bit-ops-30.test.ts test/z80/iy-bit-ops-30.test.ts test/z80/ix-bit-ops-bit.test.ts test/z80/iy-bit-ops.bit.test.ts
npx vitest run --config build/vitest.config.ts --project node test/z80/ed-indexed-wasm-differential.test.ts
```

Use the relevant original TypeScript page and its WASM clone as focused gates
while implementing an opcode page, then run `npm run build:check`. Before
marking a step complete, run the full `npm run test` suite. Do not claim a
step is complete without reporting the test command and result.

## Collaboration protocol requested by the user

The user explicitly authorized completing E1, E2, I0–I3, and then I4–I6 in
multi-step passes and asked not to return until the required quality gates
pass. Continue to report only tested completion; do not claim a step is done
before its focused and full gates have actually run.

## Next step

All planned IX/IY rows I0–I6 are complete. Continue with the next uncompleted
row in `.plans/ZX_SPECTRUM_48_WASM_INITIAL_PLAN.md`. Retain the current DD/FD
prefix flow: repeated DD/FD prefixes stay pending without the final indexed
`+1` tact, executable DD/FD opcodes receive that final tact in
`executeCpuCycle`, and DDCB/FDCB treats the byte after CB as displacement
before fetching the actual indexed-bit opcode.
