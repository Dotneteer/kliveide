# Z80 WASM Migration Handoff

Read `../AGENTS.md` and `.plans/ZX_SPECTRUM_48_WASM_INITIAL_PLAN.md` before
changing Spectrum WASM work. This note records the post-CPU-phase state on
2026-08-02.

## Current state

- The C/WASM Z80 and Z80N CPU core is implemented and covered by the cloned
  WASM opcode-page tests, differential stress tests, `npm run build:check`, and
  the full unit suite.
- The CPU core is still test/integration infrastructure. It is not yet wired
  into the production Spectrum 48K frame runner.
- `ZxSpectrum48WasmMachine` remains the compatibility adapter selected by
  `sp48Implementation: "wasm"`; its `setup()` now loads and validates the WASM
  artifact, but full production frame execution still needs the Spectrum 48K
  WASM integration plan.
- Phase P0 in `.plans/ZX_SPECTRUM_48_WASM_INITIAL_PLAN.md` is complete:
  production/test export manifests, generated layout constants, async loader,
  setup validation, and artifact packaging/resource declarations are in place.
- Phase P1 is complete: WASM-owned 64K memory, adapter typed views, ROM/RAM
  write rules, 16K model memory protection, reset memory parity, snapshot
  import/export, and dirty-memory range reporting are in place.
- The C/WASM emulator implementation must remain static-allocation only. The
  Phase P1 audit found no `malloc`, `calloc`, `realloc`, `free`, or
  `aligned_alloc` calls under the Spectrum 48K WASM and Z80 WASM source trees.
- The source-of-truth forward plan is now
  `.plans/ZX_SPECTRUM_48_WASM_INITIAL_PLAN.md`. It intentionally removed the
  historical opcode-by-opcode checklist because it no longer helps future 48K
  integration work.

## ABI and implementation facts to preserve

- CPU implementation code lives in `src/emu/z80/wasm/z80_cpu.c`.
- ABI wrappers and test-bus storage live in `src/emu/z80/wasm/z80_abi.c`.
- Shared state and field definitions live in `src/emu/z80/wasm/z80_state.h`.
- `z80_abi.c` must remain an ABI wrapper layer; do not move instruction decode
  tables or opcode bodies back into it.
- The exported Z80 state contract uses the packed state block:
  `z80_state_block_ptr`, `z80_state_block_size`, `z80_state_export`, and
  `z80_state_import`.
- Removed transitional exports such as `z80_state_read_*`,
  `z80_state_write_*`, `z80_state_size`, `z80_register_layout_probe`, and
  primitive helper probes should stay removed unless a new manifest-approved
  production/test contract requires them.
- Z80N mode is controlled by the C state flag `z80n_mode`; 28 MHz frame-tact
  scaling uses `cpu_tact_scale`; NEXTREG writes are represented in the test-bus
  TBBlue log.

## Test harness facts

- `test/z80/wasm-test-z80.ts` is the test-only WASM façade used by cloned Z80
  opcode tests.
- The current test bus uses deterministic linear-memory buffers:
  64K test RAM, preloaded I/O input bytes, memory/I/O logs, and TBBlue logs.
- The production 48K backend must replace this test bus with a machine bus and
  compact state/event buffers. Normal running must not cross the JS/WASM
  boundary per instruction, per tact, per memory access, or per port access.
- `test/z80/z80-wasm-abi.test.ts` asserts the approved WASM export manifest.
- `test/zxSpectrum/sp48-wasm-abi-manifest.test.ts` asserts the Spectrum 48K
  production/test manifest and generated layout constants against the built
  WASM artifact.
- `test/zxSpectrum/sp48-wasm-loader.test.ts` covers loader success, missing
  artifacts, incompatible ABI/layout, and module-cache reuse.

## Last verified gates

```sh
npx vitest run --config build/vitest.config.ts --project node test/z80/z80-wasm-abi.test.ts test/z80/standard-ops-00.wasm.test.ts test/z80/next-ops.wasm.test.ts test/z80/z80n-wasm-differential.test.ts
npx vitest run --config build/vitest.config.ts --project node test/z80/*.wasm.test.ts test/z80/*wasm-differential.test.ts
npm run build:check
npm run test
git diff --check
```

The full suite at the end of A0 reported 557 passed files, 19,929 passed tests,
14 skipped files, and 119 skipped tests.

After Phase P0, the focused gates plus full suite passed:

```sh
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-build.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts test/z80/z80-wasm-abi.test.ts
npm run build:sp48-wasm
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
npm run test
```

The full suite after P0 reported 560 passed files, 19,940 passed tests, 14
skipped files, and 119 skipped tests.

After Phase P1, the focused gates plus full suite passed:

```sh
npm run build:sp48-wasm
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/sp48-wasm-memory.test.ts test/zxSpectrum/sp48-wasm-abi-manifest.test.ts test/zxSpectrum/sp48-wasm-loader.test.ts test/zxSpectrum/ZxSpectrum48WasmMachineSetup.test.ts test/z80/z80-wasm-abi.test.ts
npx vitest run --config build/vitest.config.ts --project node test/zxSpectrum/*.test.ts test/z80/z80-wasm-abi.test.ts
rg -n "\b(malloc|calloc|realloc|free|aligned_alloc)\s*\(" src/emu/machines/zxSpectrum48/wasm src/emu/z80/wasm
npm run build:check
npx electron-vite build --config build/electron.vite.config.ts
npm run test
```

The full suite after P1 reported 561 passed files, 19,946 passed tests, 14
skipped files, and 119 skipped tests.

## Next useful work

Start with Phase P2 in `.plans/ZX_SPECTRUM_48_WASM_INITIAL_PLAN.md`: CPU
integration inside the 48K machine.

Do not continue by adding more Z80 opcode-migration rows. That phase is done.
