# Z80 WASM Migration Handoff

Read `../AGENTS.md` and `.plans/ZX_SPECTRUM_48_WASM_INITIAL_PLAN.md` before
changing this work. This note records the state at the completion of all
unprefixed Z80 instruction pages (S00–SF0), on 2026-08-02.

## Current completion state

- The original TypeScript Z80 remains the production implementation.
- The C/WASM CPU prototype is test-only and is not connected to the Spectrum
  48K frame runner.
- Z0–Z5, all unprefixed standard pages S00–SF0, and CB pages C0–C3 are complete.
- The next planned family is E0: ED opcodes `40–7F`.
- ED, IX/IY, DDCB/FDCB, and Z80N migrations have not started.

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

At this handoff, the following passed:

```sh
npm run test
npm run build:check
```

The full suite result was 19,031 passed and 14 skipped. Expected-error output
from unrelated React provider tests may be printed during the suite, but Vitest
must still finish with zero failed tests.

Use the relevant original TypeScript page and its WASM clone as focused gates
while implementing an opcode page, then run `npm run build:check`. Before
marking a step complete, run the full `npm run test` suite. Do not claim a
step is complete without reporting the test command and result.

## Collaboration protocol requested by the user

Unless the user explicitly authorizes several steps, implement exactly one
planned step, run its focused and full gates, update the plan, then describe
the next step and ask for approval. “Go on” means implement the next approved
step, not merely describe it. The user is especially sensitive to statements
that work is complete when tests have not actually been run.

## Next step: E0 (ED `40–7F`)

CB entries now use native table dispatch for rotate/shift, BIT, RES, and SET.
The literal clones are `bit-ops-00/10/20/30/bit/res/set.wasm.test.ts`.
`cb-wasm-differential.test.ts` compares all 256 CB opcodes over edge values
and seeded states, including full exposed state, RAM, and ordered memory/I/O
logs. For `BIT b,(HL)`, undocumented flag bits 3/5 intentionally come from
the WZ high byte, matching `Z80Cpu.bit8W`.

Start E0 with the plan's ED `40–7F` row. Retain CB prefix flow in
`executeCpuCycle`; individual ED operations must remain table entries.
