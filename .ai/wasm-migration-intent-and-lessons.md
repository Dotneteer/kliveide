# WASM Migration Intent And Lessons

Created: 2026-08-20

Use this note at the start of future AI sessions that migrate Spectrum models
from TypeScript to WASM, especially the ZX Spectrum Next model.

## Primary Intent

The goal is not to create a partial WASM helper beside the TypeScript emulator.
The goal is a fast, production-usable WASM implementation of each machine model
that can replace the TypeScript implementation for normal emulation.

When the migration plan is complete for a model, selecting the WASM
implementation should make the machine work like the original TypeScript
implementation, subject only to explicitly documented unsupported features.
Avoid vague claims such as "the scaffold is ready" when major devices are still
missing.

## Performance Intent

Use speed-oriented builds for every machine model. The desired default is the
fast profile, not size optimization.

Binary size is still useful as a diagnostic signal. The expected rough ordering
for classic Spectrum models is:

- 48K: smallest
- 128K: larger than 48K because it adds paging and PSG
- +3E: larger than 128K because it adds special paging and disk/FDC behavior
- Next: eventually the most complex model by far

If a more complex model produces a much smaller WASM binary than a simpler
model, treat that as suspicious. It may mean code is missing, a shared CPU is
not actually linked, hot helpers are not inline, or a device was stubbed.

Specific ZX Spectrum Next lesson: on 2026-08-20 the Next artifact was 180,358
bytes while the 48K artifact was 470,922 bytes. The Next build was still using
the speed profile, so the small size pointed to shallow timing/device code
rather than `-Oz`. `wasm-objdump -h` showed the Next code section was far
smaller than 48K despite more exports. Do not flip Next to default while this
kind of inversion is unexplained.

Follow-up on 2026-08-20: adding shared Z80N tact and memory/port delay hooks
moved the Next artifact above the 48K artifact; the current Step 29 build is
626,534 bytes, with a code section around 609 KB.
That resolved the size inversion and confirmed the missing depth was timing
integration, not the optimization profile. The Next CPU speed scale is latched
at instruction start; `NEXTREG $07` must not change timing for the instruction
that writes it.

Step 29 completion on 2026-08-22 closed the binary-size/timing-depth blocker,
but later ULA parity debugging proved the broader Next migration was
overstated. The Next WASM diagnostics must not report full default readiness
while ULA/screen parity is still incomplete. (The blockers were re-audited
against the VHDL and closed with dual-core tests on 2026-09-19 -
`.plans/ZX_SPECTRUM_NEXT_TYPESCRIPT_REMOVAL_PLAN.md` Step 0 - after which the
rollout constants and their diagnostics fields were removed in Step 10.)

Rollout completion on 2026-08-22: the normal ZX Spectrum Next factory default
is now WASM. TypeScript remains explicitly selectable as the compatibility
fallback and parity oracle.

ULA audit correction on 2026-08-22: the WASM backend still has open ULA/screen
blockers. The TypeScript renderer performs tact-by-tact composed rendering and
render-before-mutation ordering across standard ULA, Timex modes, LoRes,
ULANext, ULA+, Layer 2, tilemap, sprites, clipping, scrolling, transparency,
blending, active-line interrupts, and floating-bus updates. The WASM ULA path
currently covers only a subset: `$FE` keyboard/ULA behavior, basic standard
ULA instant rendering, flash, standard colours, ULA scroll/clip registers, and
the ULA INT pulse. (Superseded: the timed composed pipeline was ported and
the blockers closed on 2026-09-19.)

CTC timing lesson: mirror the TypeScript CTC model as lazy 28 MHz frame-clock
sync before CTC port access, not per-tact work in the CPU hot path. Port gating
comes from NextReg `$85` bit 3; `$84` is DAC/AY port decoding and should not be
used for CTC enable checks.

Audio scheduling lesson: sample thresholds in the 28 MHz frame-clock domain
overflow 32-bit arithmetic when multiplied by a 48 kHz sample rate. Use 64-bit
scaled threshold math for `frameTacts28 * sampleRate` comparisons.

Hook inlining lesson (Cambridge Z88): the shared core expands the tact hook
(`Z80_TACT_PLUS_N`) inside every opcode. Whatever the hook calls is inlined at
`-O3` into hundreds of sites, so a per-tact device (the audio sampler) grew the
Z88 artifact from 266 KB to 710 KB. Mark the machine's tact hook `noinline`, as
`sp48CpuTactPlusN` is; the whole artifact then shrank to 198 KB. A size jump after
adding per-tact work is this, not the device's own code.

## Single-Source Device Intent

Do not duplicate hardware devices per model when the behavior is common.
Prefer one shared C/WASM implementation included by model adapters.

Current intended shared sources include:

- `src/emu/z80/wasm/z80.c`
- `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-ula.c`
- `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-keyboard.c`
- `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-beeper.c`
- `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-tape.c`
- `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-psg.c`
- `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-ports.c` where the
  port behavior is genuinely common

Model C files should compose these shared devices and provide only the
model-specific memory map, paging, port decoding, timing hooks, and feature
differences.

Important example: 48K and 128K share classic `$FE` port behavior, including
the old bit 6 readback behavior. +3E must not use that shared `$FE` behavior,
because its passive `$FE` bit 6 readback is different: with no tape EAR signal,
bit 6 reads as 0 instead of depending on the previous `$FE` EAR write.

## Shared CPU Intent

Every Spectrum WASM model should use the same Z80/Z80N C source, not a local
CPU implementation copied into each machine. The model adapter configures the
shared core through macros and hooks.

The shared core must expose hooks for model-specific timing:

- memory read/write delay
- address-bus delay for delayed address bus instructions
- port read/write delay
- tact increments
- memory and port bus callbacks

For Next, the existing working Z80N support must be reused. Do not implement a
separate Next CPU unless there is a very explicit reason and an oracle test that
proves the shared core cannot satisfy it.

The same holds beyond the Spectrum family. The Cambridge Z88 migration
(`.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`) needed the Blink's CPU *snooze*,
which only the TypeScript `Z80Cpu` modelled. It went into `z80.c` as a generic
facility that mirrors `Z80Cpu` name for name (`z80SnoozeCpu`, `z80AwakeCpu`,
`z80IsCpuSnoozed`, `z80SnoozeCycle`): the core carries the flag, the machine's
frame loop decides what it means. A machine that never snoozes pays nothing, since
unexported functions are dropped at link time. Extend the core this way: mirror the
TypeScript member, test it with one test file that runs literally on both CPUs,
add it to `check-wasm-cpu-contract.cjs`, and rebuild and test every artifact.

**`z80Reset` is the power-on reset, not the reset button.** It matches `Z80Cpu.hardReset()`;
`Z80Cpu.reset()` keeps BC, DE, HL, their alternates, IX and IY, as a real Z80 does. A lockstep
parity test found the difference on the Z88 at the first `EXX` after a reset. The shared core now
has `z80SoftReset()` for the reset button, and the WASM corpus wrapper's `reset()` runs it (its
`hardReset()` runs `z80Reset`). A machine whose TypeScript oracle soft-resets must call
`z80SoftReset` from its reset export, or the reset button clobbers registers the oracle keeps.

**Read a WASM machine's CPU through `getCpuState()`, not its register fields.** An adapter mirrors
the core's registers lazily (after a normal frame only PC and the frame counters), so a test or
harness that reads `machine.interruptMode` directly sees stale values on WASM and current ones on
TypeScript. `getCpuState()` is the IDE's path and syncs first.

The literal copies in `test/wasm/z80/` must be re-copied whenever their
`test/z80/` source changes. A stale `next-ops.test.ts` copy once asserted the
pre-VHDL `ADD rr,A`/`LDWS` flags and failed six cases against a correct core.
Before blaming a core for a corpus failure, `cmp` the copy with its source.

## Correctness Before Confident Claims

The TypeScript implementation is the oracle until the WASM implementation has
matching parity tests and real behavior. Do not assume a WASM model works
because it builds, instantiates, or renders a frame.

For each migrated surface, compare TypeScript and WASM through public machine
APIs wherever possible:

- CPU registers and flags
- frame/tact counters and frame overshoot
- memory reads/writes and partition labels
- port reads/writes
- contention delays
- floating bus values
- screen dimensions and pixels
- audio samples
- tape behavior
- PSG/device register readback
- disk or storage state where applicable

Compare audio exactly when you can. The Z88 core runs the TypeScript
`AudioDeviceBase` arithmetic (tact schedule, DC filter) in `double` and hands
the doubles over in a `Float64Array`, so its parity test compares samples with
`toBe` rather than a tolerance. Anything the core cannot compute (`exp` for the
filter's alpha) is computed by the host and passed in.

A parity test that passes the first time proves nothing until it has failed:
change one colour constant and one filter constant, rebuild, and watch the
pixel and sample comparisons fail, then restore. The Z88 LCD and beeper parity
tests were checked this way.

If a behavior is hard to reproduce with tests, still audit the exact TypeScript
and WASM contracts. Games often reveal mid-frame timing bugs that ordinary unit
tests miss.

## Before And After The Default Flip

Before a model defaults to WASM, TypeScript remains the default oracle and new
machine-owned behavior should be implemented in TypeScript and WASM together
when the oracle must grow. Do not switch the default merely because the WASM
backend boots, renders a frame, or passes surface-level tests.

Once a model actually defaults to WASM, treat WASM as the primary
implementation for new machine-owned behavior. Implement new emulator features
in WASM first, or in TypeScript and WASM together when the TypeScript oracle
needs to be extended.

Keep the old TypeScript backend available as an explicit fallback and parity
oracle until a separate deprecation plan removes it. Do not delete the fallback
just because WASM becomes the default. For the ZX Spectrum Next that plan is
`.plans/ZX_SPECTRUM_NEXT_TYPESCRIPT_REMOVAL_PLAN.md`: separation and parity first,
removal only after its gate.

**A WASM machine must not subclass the TypeScript machine it replaces.** The Next
WASM machine did (`ZxNextWasmV2Machine extends ZxNextMachine`), which meant every
WASM machine built and reset the whole TypeScript device set, and quiet paths kept
running TypeScript emulation on the production backend: the keyboard mirror, code
injection through TypeScript contention, frame pacing from the TypeScript screen
device, IDE panels reading TypeScript device fields WASM never updated (stale
palettes, a wrong ULA panel, a status bar stuck at 3.5 MHz, `$0000` in the
Breakpoints panel). Give the WASM machine its own host base on the shared
`Z80MachineBase` (as `ZxSpectrum48WasmHost` and `ZxNextWasmHost` do), share only
neutral metadata modules and logic both cores need (`next*.ts`,
`nextMachineInfo.ts`), and let the IDE talk to an interface both implement
(`IZxNextIdeMachine`) instead of casting to either class. Guard it with a test that
walks the import graph, type imports included
(`test/wasm/zxNext/wasm-next-separation.test.ts`): the leaks it found were type-only
chains through the Spectrum device interfaces and a renderer helper module.

**Parity checks the IDE too, not only the hardware.** A dual-core IDE-state test
(`s.ideState()`; now IDE-001, WASM-only against the program's writes) found five
panel differences - on *both* cores - that no hardware test could see. When the two cores disagree, the VHDL decides which one
is wrong; in this migration the TypeScript "oracle" was the wrong side several
times (a one-pixel-early half-pixel-scroll switch, dead tilemap fields behind the
Palettes panel, a ULA panel that threw).

Host-owned boundaries, such as UI policy, file/media persistence, Electron
resource lookup, and test harness setup, can remain in TypeScript. Device,
timing, memory, port, CPU, screen, audio, tape, and storage behavior should not
move back to TypeScript merely because it is easier to patch there.

## Timing Lessons

Memory delay, address-bus delay, contention, I/O delay, and screen rendering are
not optional details. They are part of the emulator contract.

Important details learned from 128K/+3E:

- TypeScript renders the ULA continuously as tacts advance.
- WASM often uses lazy rendering for speed.
- Lazy rendering is correct only if WASM renders up to the current tact before
  changing any ULA-visible state.
- Render before visible screen RAM writes.
- Render before direct writes to the currently visible screen bank.
- Render before switching normal/shadow screen source.
- Render before changing other state that immediately changes what the ULA
  would read or display.

Without these render-before-mutation rules, a game can show visible mid-frame
screen errors even when simple full-frame tests pass.

## Model Differences Matter

Do not over-share behavior just because machines are related. Share only after
checking the TypeScript oracle.

Examples:

- 48K and 128K share classic `$FE` behavior.
- +3E differs on passive `$FE` bit 6 readback.
- 128K and +3E share PSG implementation.
- memory paging and special paging are model-specific.
- floating bus behavior can be model-specific even with shared ULA timing.

For Next, assume many devices are Next-specific until proven otherwise:

- NextRegs
- MMU and memory overlays
- DivMMC and Multiface
- Layer 2, tilemap, sprites, LoRes, ULA Next, ULA+
- DMA, copper, CTC, UART, I2C
- TurboSound, DAC, audio mixer
- SD card/SPI
- joystick, mouse, expansion bus, interrupts

## Planning Lessons

Plans must distinguish clearly between:

- scaffolding
- linked but incomplete device shells
- parity with TypeScript
- production-ready replacement

Avoid long migrations that produce many files but leave the user uncertain
about whether the emulator should actually work. Each step should say what
surface is now expected to be usable and what is still missing.

Comparison menu entries (the Z88's `-wasm` twins, `createModelTwins`) go in only
when every surface the app's emulator loop touches each frame works: the frame,
the picture, the key setter and the audio samples. A twin registered earlier
creates a machine whose loop throws. Once twins exist, every test that iterates
a machine's models must pick the originals (`menuGroup === undefined`), or it
silently runs each case twice and counts the twins as models.

When extending a plan, include explicit steps for moving from TypeScript to
WASM as the actual selected implementation:

- implement the missing devices
- wire public APIs to WASM state
- compare against TypeScript oracles
- preserve IDE/debugger/disassembler surfaces
- add artifact and shared-source contract tests
- only then change defaults or recommend using WASM for normal operation

## Debugger Behaviour Is Part Of The Port, And It Was Silently Dropped

Two step-over bugs, both found only when a user single-stepped the ZX Spectrum Next ROM. Neither
had a test, and neither showed up in any parity check, because parity work compared *emulation*
output and these are *debugger* behaviours.

- **Step-out was broken on every WASM machine, and the fix belonged in the core.**

  `DebugStepMode.StepOut` means the RET that returns *to this routine's caller*. The mechanism is
  `stepOutAddress`, peeked from a shadow stack of return addresses that `Z80Cpu` pushes on every
  CALL and RST. **None of that code runs on a WASM machine** — the CPU executes in the core — so the
  stack stayed empty, `markStepOutAddress()` always produced -1, and `stepOutAddress === pc` could
  never be true.

  What each machine had instead was accidental: the 48K mirrored `retExecuted` out of its core and
  so stopped on the first RET at any depth (coarse, but it terminated); the 128 and the Next never
  mirrored it at all, and the +3E's core did not even export it — on those three, **step-out could
  not terminate on its own**. The Next is worse than it looks: `zxnext-cpu.c` *clears*
  `retExecuted` after each instruction, so exporting the flag would never have worked there.

  Fixed properly: the shadow stack now lives in `z80.c` (`pushToStepOutStack`,
  `z80GetStepOutAddress`), a line-for-line port of the TypeScript model, exported by all four cores
  as `<prefix>GetStepOutAddress` and read by a `markStepOutAddress()` override on each WASM machine.
  With an exact target available, `retExecuted` was retired everywhere — it stops at nested returns,
  so keeping it would have undone the precision.

  Three things this taught, beyond the fix:

  - **Interrupts must push the shadow stack too.** An interrupt stacks a return address and its
    handler ends in RET/RETI/RETN, so a stack that ignores it drifts. Observed: an interrupt
    arriving mid-step made the 48K step out to `$15FE` instead of the interrupted `$15DE`. Both
    cores now push in their shared interrupt-entry helper (`pushPcForInterrupt` / `pushPC`).
  - **A new required WASM export breaks the loader stubs.** `validateSp48WasmV2Exports` and its
    siblings check every name, and the loader tests build fake modules from a hand-written export
    list. Adding an export means adding it in four places — the core `.c`, the loader's type and
    name list, the build script's allow-list — and then in the test stubs.
  - **`Z80Cpu.reset()` emptied `stepOutStack` without clearing `stepOutStackCount`**, so
    `markStepOutAddress` read past the end and returned `undefined` instead of -1. Found by writing
    the unit test for the shared model. Note the array is deliberately still reset to `[]`: 91
    assertions across `test/z80/` read `stepOutStack.length`, so the pre-allocation the constructor
    describes does not survive a reset, and changing that is its own job.

- **The `imminentJustCreated` guard was lost in the port.** `MachineFrameRunner.shouldStop` stops a
  step-over when one instruction has executed *and* the imminent breakpoint was only just created —
  i.e. the step landed on a call rather than starting on one. All four WASM v2 machines
  (48K, 128, +3E, Next) reimplemented `shouldStop` without it, so a step-over that landed on a
  CALL/RST/HALT/block-op silently executed that instruction too. On the Next this made whole
  `NEXTREG` instructions vanish from the stepping sequence.
- **`Z80NMachineBase.extendedInstructionLenghts` had `ED 92` (`NEXTREG n,A`) as 4 bytes; it is 3.**
  Step-over plants its temporary breakpoint at `PC + length`, so the breakpoint sat in the middle of
  the *next* instruction, was never reached, and the machine ran free to the next real breakpoint.
  To the user this looked like step-over teleporting to an unrelated address.

Three things to carry forward:

1. **When a WASM machine reimplements a method that already exists in the interpreted path, diff the
   two.** All four copies of `shouldStopAtWasmV2Breakpoint` were wrong in the same way, which is
   what four-way duplication of a subtle condition buys. **All five copies — the four WASM machines and
   `MachineFrameRunner` itself — have since been collapsed into
   `src/emu/machines/DebugStepDecision.ts`**, a plain function that can be unit-tested at all.
   `test/emu/debug-step-decision.test.ts` covers every branch, and
   `debug-step-decision-equivalence.test.ts` runs the shared function against a verbatim copy of the
   pre-fold `MachineFrameRunner` body over ~2,900 input combinations, comparing the answer *and* the
   state each leaves behind — because that path was the correct one and folding it in had to be
   provably behaviour-preserving rather than merely plausible.

   Diffing the copies before extracting was worth doing on its own: three WASM copies were
   byte-identical, the +3E differed, and `MachineFrameRunner` differed again — which is how both the
   `retExecuted` gap below and the step-into ordering difference came to light.

   **Two things stayed with their callers**, because folding them in would have changed behaviour
   rather than de-duplicating it: `StepInto` (the interpreted path answers it *before* the
   breakpoint check, the WASM machines *after*, and that is observable in `lastBreakpoint`), and
   `retExecuted`.
2. **Instruction lengths must be derived, not hand-maintained.** The disassembler already knows
   them, because it consumes operand bytes. `test/emu/z80n-step-over-lengths.test.ts` now checks
   every entry of the table against it; that test would have caught `ED 92` the day it was written.
3. **Drive the debugger, not just the emulation, when verifying a machine.** Both bugs are
   reproducible in about a minute with `scripts/doc-shots/harness.cjs`: breakpoint, `em-debug`, a
   handful of `em-sto`, and read PC off the disassembly view after each. Emulation parity says
   nothing about whether stepping works.

## Recommended First Reading For Next Migration

Before touching ZX Spectrum Next WASM work, read:

- `AGENTS.md`
- `.ai/wasm-migration-intent-and-lessons.md`
- `.ai/wasm-v2-machine-migration-guide.md`
- `.ai/zx-spectrum-next-wasm-parity-audit.md`
- `.plans/ZX_SPECTRUM_NEXT_WASM_MIGRATION_PLAN.md`
- `src/emu/machines/zxNext/ZxNextMachine.ts`
- `src/emu/machines/zxNext/MemoryDevice.ts`
- `src/emu/machines/zxNext/NextRegDevice.ts`
- `src/emu/machines/zxNext/NextIoPortManager.ts`
- `src/emu/z80/wasm/z80.c`
- the existing 48K, 128K, and +3E WASM adapters and tests

## Non-Negotiable Handoff Message

The user wants a fast, shared-source, production-capable WASM emulator, not a
collection of isolated stubs. Preserve shared hardware implementations whenever
behavior is common, but do not flatten real model differences. Treat TypeScript
as the oracle, verify timing and screen-ordering carefully, and be explicit
about what is complete versus still missing.
