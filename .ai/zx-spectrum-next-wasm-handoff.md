# ZX Spectrum Next WASM Migration Handoff

Updated: 2026-08-16

## Current Status

- Steps 1-8 are done.
- Steps 9-13 are partial baselines whose gaps were audited in Step 13A.
- Step 13A is done: known Step 9-13 gaps are either fixed or explicitly
  deferred in `.plans/ZX_SPECTRUM_NEXT_WASM_MIGRATION_PLAN.md`.
- Step 14 is done: the WASM adapter now has minimal normal frame execution for
  the early CPU/memory/ports/keyboard/standard-ULA subset.
- The next planned step is Step 15: early boot smoke without storage.

## Important Files

- Plan: `.plans/ZX_SPECTRUM_NEXT_WASM_MIGRATION_PLAN.md`
- Learnings: `.ai/zx-spectrum-next-wasm-migration-learnings.md`
- Handoff: `.ai/zx-spectrum-next-wasm-handoff.md`
- Adapter: `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`
- Loader: `src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`
- Build script: `scripts/build-zxnext-wasm.cjs`
- C composition: `src/emu/machines/zxNext/wasm/zxnext/zxnext.c`
- C slices:
  - `zxnext-memory.c`
  - `zxnext-nextreg.c`
  - `zxnext-ports.c`
  - `zxnext-keyboard.c`
  - `zxnext-ula.c`
  - `zxnext-screen.c`
- Current focused tests:
  - `test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts`
  - `test/wasm/zxNext/wasm-next-memory-mmu.test.ts`
  - `test/wasm/zxNext/wasm-next-nextreg-ports.test.ts`
  - `test/wasm/zxNext/wasm-next-keyboard-ula.test.ts`
  - `test/wasm/zxNext/wasm-next-screen-ula.test.ts`

## Step 14 Summary

- Added `zxnextExecuteFrame()` to the C backend.
- Added frame diagnostics:
  - frame call count;
  - instructions executed in last frame;
  - residual frame tacts in the 28 MHz adapter domain;
  - current frame tact in the screen timing domain;
  - CPU tacts per frame.
- `ZxNextWasmV2Machine.executeMachineFrame()` now:
  - syncs changed keyboard and extended-key state;
  - calls WASM once for normal frames;
  - imports frame counters and bus diagnostics only;
  - avoids full CPU register sync during normal frame execution;
  - uses C-owned single-instruction execution for debug StepInto.
- Standard ULA instant rendering runs in WASM at frame end.

## Known Deferred Work

- Step 15 should add boot diagnostics for unsupported ports instead of silently
  accepting generic `0xff` behavior.
- DivMMC automap and memory overlays remain Step 16.
- SD-card SPI state and sector frame-command bridge remain Step 17.
- Early storage boot milestone remains Step 18.
- CPU speed/contention timing remains Step 19. Step 14 currently uses the
  3.5 MHz CPU-tact baseline derived from standard ULA timing.
- Interrupt/NMI behavior remains Step 20.
- Palette, ULA+, Timex, Layer 2, LoRes, tilemap, sprites, and full composition
  remain Steps 21-25.
- Audio generation remains Step 26.
- Full IDE inspection completion remains Step 34.

## Last Validation Commands

- `npm run build:zxnext-wasm`
- `npm test -- --project jsdom test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts`
- `npm test -- --project jsdom test/zxnext/zxnext-wasm-build.test.ts test/zxnext/zxnext-wasm-v2-loader.test.ts test/zxnext/ZxNextWasmV2Machine.test.ts test/wasm/zxNext/wasm-next-test-helpers.test.ts test/wasm/zxNext/wasm-next-cpu.test.ts test/wasm/zxNext/wasm-next-memory-mmu.test.ts test/wasm/zxNext/wasm-next-nextreg-ports.test.ts test/wasm/zxNext/wasm-next-keyboard-ula.test.ts test/wasm/zxNext/wasm-next-screen-ula.test.ts test/wasm/zxNext/wasm-next-machine-lifecycle.test.ts`
- `npm run build:check`
- `npm run check:zxnext-wasm-size`
- `git diff --check`

## Recommended Next Session Start

1. Read `AGENTS.md`.
2. Read the plan Step 15 and the Step 13A/14 completion notes.
3. Read this handoff and the latest entries in
   `.ai/zx-spectrum-next-wasm-migration-learnings.md`.
4. Run the focused Step 14 lifecycle test before changing Step 15.
5. Implement Step 15 as a diagnostic boot smoke only. Do not add DivMMC or SD
   behavior in Step 15; those belong to Steps 16 and 17.
