# Cambridge Z88 WASM Core

The Cambridge Z88 WASM implementation is the full-machine C core under this folder. It builds to
`dist/cambridge-z88.wasm` and is loaded by `Z88WasmV2Loader.ts`. The migration is planned and
tracked in `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`.

**Status (Step 9).** The core emulates the memory map and RAM/ROM cards (Step 4), the CPU and the
frame loop - one boundary call per normal frame, instruction by instruction for the debugger (Step
5) - the Blink: ports, RTC, interrupts, flap, battery (Step 6), the keyboard and sleep detection
(Step 7), the LCD (Step 8) and the beeper (Step 9). It boots every OZ ROM, draws the same pictures
and makes the same sounds as the TypeScript machine (`test/wasm/z88/wasm-z88-parity.test.ts`). The
machine menu lists it under "Cambridge Z88 (WASM preview)"; the TypeScript `Z88Machine` stays the
default. Not yet: EPROM and flash programming (Step 10) - those cards read like ROM, and writes to
them are ignored.

## Layout

- `z88/z88.c`: the translation unit: machine state, the Z88 parts, the shared Z80 core
  (`src/emu/z80/wasm/z80.c`) wired through the `Z80_*` hook macros, and the exports.
- `z88/z88-memory.c`: the memory map - physical memory, cards, paging, the empty-slot random values.
- `z88/z88-blink.c`: the Blink - segment registers, COM, interrupts, RTC, LCD registers, ports.
- `z88/z88-keyboard.c`: the key matrix's changes, the key interrupt and wake-up, sleep detection.
- `z88/z88-screen.c`: the LCD renderer (every 8th frame, at the frame start).
- `z88/z88-beeper.c`: the oscillator bit and the audio sampler with its DC filter.
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

- Without an audio sample rate the TypeScript beeper emits a sample at every clock step; the core
  emits none. The app always sets a rate before the machine's first reset.

**Audio samples are doubles**, not the int16 the Spectrum cores use: the sampler runs the TypeScript
`AudioDeviceBase` arithmetic (the sample schedule in tacts and the DC high-pass filter) in `double`,
so the samples are bit-for-bit the oracle's and the parity test compares them exactly. The host
computes the filter's alpha (`exp` is not available to the core) and passes it with the rate.

**The tact hook is `noinline`** (`Z88_CPU_NOINLINE`), as `sp48CpuTactPlusN` is: it runs the sampler,
and inlined into every opcode it would more than triple the code (710 KB against 198 KB).

The reset button uses the shared core's `z80SoftReset` (BC, DE, HL, their alternates, IX and IY keep
their values, as on a real Z80 and on `Z80Cpu.reset`); power-on uses `z80Reset`.
