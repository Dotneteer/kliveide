# Cambridge Z88 WASM Core

The Cambridge Z88 WASM implementation is the full-machine C core under this folder. It builds to
`dist/cambridge-z88.wasm` and is loaded by `Z88WasmV2Loader.ts`. The migration is planned and
tracked in `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`.

**Status (Step 12).** The whole machine is emulated: the memory map and every card type - RAM, ROM, UV
EPROM, Intel and AMD flash with their command states (Steps 4 and 10) - the CPU and the frame loop,
one boundary call per normal frame (Step 5), the Blink (Step 6), the keyboard and sleep detection
(Step 7), the LCD (Step 8) and the beeper (Step 9), with the IDE surfaces of the TypeScript machine
(Step 11). It boots every OZ ROM, types, draws, sounds, programs cards and debugs exactly like the
TypeScript machine (`test/wasm/z88/wasm-z88-parity.test.ts`, `wasm-z88-ide-parity.test.ts`,
`wasm-z88-debug-step.test.ts`), and runs frames 9-22 times faster (below). The machine menu lists it
under "Cambridge Z88 (WASM preview)"; the TypeScript `Z88Machine` stays the default until Step 14.

## Layout

- `z88/z88.c`: the translation unit: machine state, the Z88 parts, the shared Z80 core
  (`src/emu/z80/wasm/z80.c`) wired through the `Z80_*` hook macros, and the exports.
- `z88/z88-memory.c`: the memory map - physical memory, cards, paging, the empty-slot random values.
- `z88/z88-blink.c`: the Blink - segment registers, COM, interrupts, RTC, LCD registers, ports.
- `z88/z88-cards.c`: UV EPROM programming and the Intel and AMD flash chips' command states.
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

## The CPU's bus record

The CPU panel and the debugger's memory and I/O breakpoints read what `Z80Cpu` records about each
instruction's bus cycles, so the core records the same, always (not only in the debugger), in
`z88-memory.c`: the addresses of the opcode fetches and data reads and writes (not the operand bytes,
which `fetchCodeByte` reads unrecorded) in two 8-entry lists whose counts - not contents - restart at
each unprefixed M1, the last values read and written, and the last ports. The M1 is found through the
shared core's `Z80_BEFORE_OPCODE_FETCH` hook, which sits where `Z80Cpu.beforeOpcodeFetch` runs.
`opStartAddress` (the Breakpoints panel shows the bytes of the instruction that hit a memory or I/O
breakpoint) and `sigINT` come from the core too.

## The debugger

A debug run executes one instruction per boundary call when the stop policy has to look at every
instruction (step-into, memory and I/O breakpoints). Otherwise - running to breakpoints, to an
execution point, a step-over waiting for its return address, a step-out - the policy can stop only at
an address whose `DebugSupport.breakpointFlags` has `EXEC_BP` or `PART_BP`, or at one extra address.
The adapter copies the flags into the core at the start of the run (128 KB, about 1 us) and
`z88ExecuteUntilStop` runs on to the next such address; the adapter then applies the whole policy
there, so a candidate that is not a stop (a disabled breakpoint, another partition) only costs one
boundary call. Without it, running under the debugger was slower than the TypeScript machine.

## Performance

`npm run benchmark:z88-wasm` drives both backends through the test harness - the public machine API
the app uses - and reports ms per 5 ms frame. On an Apple M4 Pro (Node 22.14, 2026-09-19):

| Scenario | TypeScript | WASM | WASM faster by |
|---|---|---|---|
| OZ 5.0 idle (snoozing) | 0.069 | 0.008 | 9.0x |
| OZ 5.0 at the keyboard | 0.327 | 0.032 | 10.3x |
| CPU-heavy loop | 0.958 | 0.044 | 22.0x |
| 800x480 LCD, changing screen | 0.918 | 0.055 | 16.6x |
| Beeper toggling, 44.1 kHz | 0.606 | 0.036 | 17.0x |
| AMD flash programming | 0.906 | 0.042 | 21.8x |
| Running under the debugger | 0.184-0.835 | 0.054 | 3.4x-15.3x |
| One debugger step-into | 0.0004 | 0.011 | slower |

The TypeScript debugger figure depends on what the JIT saw before (alone, or after the other
scenarios). A single step hands the whole register set and bus record over (about 100 boundary calls,
11 us) - once per key press. `test/wasm/z88/wasm-z88-benchmark.perf.test.ts` (`npm run test:perf`)
checks that every frame-running scenario stays faster on WASM.

The artifact is 151,854 bytes against a ceiling of 200,000 (`check-z88-wasm-size.cjs` says why the Z88
is smaller than the 48K).

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
- A flash sector erase clears the 64K at the slot base plus `(bank & $3C) * 16K`, whatever the card's
  size, so on a card smaller than its slot a mirrored bank erases memory past the card. The AMD
  command cycle's address is not checked (only the two unlock cycles'), and a write while an AMD chip
  executes a command is ignored unless it is the reset ($F0).

Fixed in TypeScript instead of copied (Step 11): `Z80Cpu`'s CALL and RST passed the whole 16-bit PC
as the low byte they push, so the CPU panel showed a 16-bit "last write value" and a card saw a
16-bit data byte (`test/z80/call-push-bytes.test.ts`).

**Audio samples are doubles**, not the int16 the Spectrum cores use: the sampler runs the TypeScript
`AudioDeviceBase` arithmetic (the sample schedule in tacts and the DC high-pass filter) in `double`,
so the samples are bit-for-bit the oracle's and the parity test compares them exactly. The host
computes the filter's alpha (`exp` is not available to the core) and passes it with the rate.

**The tact hook is `noinline`** (`Z88_CPU_NOINLINE`), as `sp48CpuTactPlusN` is: it runs the sampler,
and inlined into every opcode it would more than triple the code (710 KB against 198 KB).

The reset button uses the shared core's `z80SoftReset` (BC, DE, HL, their alternates, IX and IY keep
their values, as on a real Z80 and on `Z80Cpu.reset`); power-on uses `z80Reset`.
