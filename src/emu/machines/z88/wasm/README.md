# Cambridge Z88 WASM Core

The Cambridge Z88 WASM implementation is the full-machine C core under this folder. It builds to
`dist/cambridge-z88.wasm` and is loaded by `Z88WasmV2Loader.ts`. The migration is planned and
tracked in `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`.

**Status (Step 6).** The core emulates the memory map and RAM/ROM cards (Step 4), the CPU and the
frame loop - one boundary call per normal frame, instruction by instruction for the debugger (Step
5) - and the Blink: ports, RTC, interrupts, flap, battery (Step 6). It boots every OZ ROM exactly
like the TypeScript machine (`test/wasm/z88/wasm-z88-parity.test.ts`). Not yet: the key interrupt
and sleep detection (Step 7), the LCD renderer (Step 8), the beeper (Step 9), EPROM/flash
programming (Step 10); `Z88WasmV2Machine` throws `Z88WasmNotMigratedError` for the surfaces that
need them, so the TypeScript `Z88Machine` stays the backend a user runs.

## Layout

- `z88/z88.c`: the translation unit: machine state, the Z88 parts, the shared Z80 core
  (`src/emu/z80/wasm/z80.c`) wired through the `Z80_*` hook macros, and the exports.
- `z88/z88-memory.c`: the memory map - physical memory, cards, paging, the empty-slot random values.
- `z88/z88-blink.c`: the Blink - segment registers, COM, interrupts, RTC, LCD registers, ports.
- `dist/`: the generated artifact (git-ignored).

The Z88 includes none of the ZX Spectrum device sources (`zxSpectrum/wasm/common/`): its Blink,
LCD, keyboard and beeper are Z88-specific. `check-wasm-cpu-contract.cjs` enforces both the shared
Z80 core and the absence of the Spectrum devices.

## Building

`npm run build:z88-wasm` (compiler: `clang`, or `Z88_WASM_CC`; profile: `Z88_WASM_OPTIMIZATION`
= `speed` (default), `size` or `lto`). `npm run check:z88-wasm-size` checks the size ceiling. The
build uses the portable `wasm32` target and `wasm-ld`, not Emscripten. Builds of the production
artifact are serialized with a lock file (`scripts/wasm-build-lock.cjs`), because test workers build
it in parallel.

## Behaviour pinned from the TypeScript oracle

Ported verbatim for parity, and fixed in both cores later (follow-ups of the migration plan):

- **F1:** the Blink's interrupt check tests `INT & STA`, whose bits do not line up everywhere
  (STA.TIME meets INT.GINT, STA.FLAPOPEN meets INT.KWAIT).
- A row of LORES cells leaves the last 4 pixels of a 640-pixel row unpainted.
- A snoozing `$B2` keyboard read answers `$FF` at once (the hardware holds the read).
- The Blink's reset re-pages SR0-SR3 with the COM value from before the reset, and can leave the
  interrupt line active until STA or INT is written.
- The IDE's flat 64K view reads each part from the start of its page's bank (for an odd SR0 the
  $2000-$3FFF part shows the bank's lower half).

The reset button uses the shared core's `z80SoftReset` (BC, DE, HL, their alternates, IX and IY keep
their values, as on a real Z80 and on `Z80Cpu.reset`); power-on uses `z80Reset`.
