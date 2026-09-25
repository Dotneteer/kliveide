# Cambridge Z88 WASM Core

The Cambridge Z88 WASM implementation is the full-machine C core under this folder. It builds to
`dist/cambridge-z88.wasm` and is loaded by `Z88WasmV2Loader.ts`, and it is the only Z88 emulation.
The migration was `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`; the TypeScript machine it replaced
was removed by `.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md` (the last commit that has it is
tagged `z88-typescript-last`).

**Status.** The whole machine is emulated: the memory map and every card type - RAM, ROM, UV EPROM,
Intel and AMD flash with their command states - the CPU and the frame loop, one boundary call per
normal frame, the Blink, the keyboard and sleep detection, the LCD and the beeper, with the IDE
surfaces (registers, bus record, Blink panel, debugger). It became the default on 2026-09-19 after
booting every OZ ROM, typing, drawing, sounding, programming cards and debugging exactly like the
TypeScript machine in lockstep, frame for frame and instruction for instruction, at 9-22 times its
speed. On 2026-09-25 the TypeScript machine was removed: what it did at every checkpoint of those
comparisons is recorded in `test/wasm/z88/goldens/`, and `wasm-z88-parity.test.ts`,
`wasm-z88-ide-parity.test.ts`, `wasm-z88-debug-step.test.ts` and `wasm-z88-machine.test.ts` hold the
core to it (`test/z88/README.md`). The model ids of the comparison period (`<id>-ts`, `<id>-wasm`)
open as `<id>`.

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
boundary call. Without it, running under the debugger was slower than the TypeScript machine was.

## Performance

`npm run benchmark:z88-wasm` drives the machine through the test harness - the public machine API
the app uses - and reports ms per 5 ms frame. On an Apple M4 Pro (Node 22.14), with the TypeScript
machine's figures from 2026-09-19, before it was removed:

| Scenario | WASM (2026-09-25) | TypeScript (2026-09-19) |
|---|---|---|
| OZ 5.0 idle (snoozing) | 0.008 | 0.069 |
| OZ 5.0 at the keyboard | 0.038 | 0.327 |
| CPU-heavy loop | 0.045 | 0.958 |
| 800x480 LCD, changing screen | 0.053 | 0.918 |
| Beeper toggling, 44.1 kHz | 0.037 | 0.606 |
| AMD flash programming | 0.041 | 0.906 |
| Running under the debugger | 0.053 | 0.184-0.835 |
| 200 debugger step-intos | 1.393 | 0.08 |

A single step hands the whole register set and bus record over (about 100 boundary calls, 7 us) -
once per key press. `test/wasm/z88/wasm-z88-benchmark.perf.test.ts` (`npm run test:perf`) keeps every
scenario within an absolute budget: 0.5 ms per frame (about ten times the figures above, and below
what the TypeScript machine took for the heavier scenarios), 10 ms per 200 steps.

The artifact is 151,854 bytes against a ceiling of 200,000 (`check-z88-wasm-size.cjs` says why the Z88
is smaller than the 48K).

## Behaviour the core keeps from the TypeScript machine

The core was ported from the TypeScript machine, itself a port of OZvm, and was held to it in
lockstep; the goldens now pin the same behaviour. Where it departs from the Blink documentation or
the real hardware, that is said below. Change any of it only with the documentation (or a real
machine) on your side, and expect the goldens to fail: that is their job.

- A row of LORES cells leaves the last 4 pixels of a 640-pixel row unpainted (a 640-pixel row is
  106 cells of 6 pixels, 636 pixels).
- A snoozing `$B2` keyboard read answers `$FF` at once; the hardware holds the read until a key goes
  down. The snooze itself (the CPU stopped until the key interrupt) is modelled.
- The Blink's reset re-pages SR0-SR3 with the COM value from before the reset, and can leave the
  interrupt line active until STA or INT is written.
- The IDE's flat 64K view reads each part from the start of its page's bank (for an odd SR0 the
  $2000-$3FFF part shows the bank's lower half).
- Without an audio sample rate the core emits no samples (the TypeScript beeper emitted one at every
  clock step). The app always sets a rate before the machine's first reset.
- A flash sector erase clears the 64K at the slot base plus `(bank & $3C) * 16K`, whatever the card's
  size, so on a card smaller than its slot a mirrored bank erases memory past the card. The AMD
  command cycle's address is not checked (only the two unlock cycles'), and a write while an AMD chip
  executes a command is ignored unless it is the reset ($F0).

Fixed in both machines during the comparison period (Step 15 of the migration): the Blink raises /INT
only for an STA source whose INT enable is set - STA.TIME by INT.TIME (bit 1), not by GINT, and never
STA.FLAPOPEN (F1), as the Blink documentation lays the bits out (OZvm had tested `INT & STA`, and
running OZ with the ROM showed it did not depend on that); the card dialog's 256K UV EPROM is
constructible (F2); the Z88 disassembles its whole 64K (F3); code injection is refused instead of
"running" at address 0 (F4).

Fixed in TypeScript instead of copied (Step 11): `Z80Cpu`'s CALL and RST passed the whole 16-bit PC
as the low byte they push, so the CPU panel showed a 16-bit "last write value" and a card saw a
16-bit data byte (`test/z80/call-push-bytes.test.ts`).

**Audio samples are doubles**, not the int16 the Spectrum cores use: the sampler runs the TypeScript
`AudioDeviceBase` arithmetic (the sample schedule in tacts and the DC high-pass filter) in `double`,
so the samples were bit-for-bit the TypeScript machine's and the goldens hash them exactly. The host
computes the filter's alpha (`exp` is not available to the core) and passes it with the rate.

**The RTC was changed from the TypeScript machine's behaviour (issue #1374)**, which OZ 4.7 and 5.0
cannot time out with:
- **TSTA latches** every event until TACK, whatever TMK enables. A minute sets SEC and MIN.
- **STA.TIME drops** only once no *enabled* event is pending.
- **COM.RESTIM keeps TMK.** Only the power-on reset sets TMK.

The Z88 goldens were re-recorded for this, the one settled change to them. The ROM traces, the
Developers' Notes passages and the review of the diff are in
`.plans/CAMBRIDGE_Z88_ISSUE_1374_PLAN.md` (Step 4), and `test/z88/z88-timeout-coma.test.ts` holds
the behaviour.

**The Z80 is a CMOS part** (`#define Z80_CMOS 1` before `z80.c` is included). The shared core
emulates the NMOS glitch that clears the P/V copy of IFF2 when an interrupt is accepted right after
LD A,I / LD A,R; the CMOS Z80 fixed it, and OZ 4.7 cannot survive it. Its "save interrupt state and
DI" routine ($003B) read the glitch as "interrupts were off", and the key-wait routine returned
without EI, so the keyboard went dead after a key press with Keyclick on (issue #1374,
`test/z88/z88-oz47-keyclick.test.ts`). The Spectrum-family cores keep the NMOS behaviour.

**The sample schedule survives the tact counter wrapping.** `cpu.tacts` is 32 bits and wraps after
2^32 tacts, about 22 minutes at 1x. The next sample point is kept in [0, 2^32) and reached by its
signed distance from `cpu.tacts`. The TypeScript device counted tacts in a JS number, never wrapped,
and so never needed this: a port that kept its plain `tacts < next` comparison went silent for good
after 22 minutes (issue #1374). `z88SetAudioSampleRate` also schedules from the current tact, not
from 0. Any other code that compares absolute tacts has the same trap.

**The tact hook is `noinline`** (`Z88_CPU_NOINLINE`), as `sp48CpuTactPlusN` is: it runs the sampler,
and inlined into every opcode it would more than triple the code (710 KB against 198 KB).

The reset button uses the shared core's `z80SoftReset` (BC, DE, HL, their alternates, IX and IY keep
their values, as on a real Z80 and on `Z80Cpu.reset`); power-on uses `z80Reset`.
