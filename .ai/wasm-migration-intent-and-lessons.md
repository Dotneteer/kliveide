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

If a behavior is hard to reproduce with tests, still audit the exact TypeScript
and WASM contracts. Games often reveal mid-frame timing bugs that ordinary unit
tests miss.

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

When extending a plan, include explicit steps for moving from TypeScript to
WASM as the actual selected implementation:

- implement the missing devices
- wire public APIs to WASM state
- compare against TypeScript oracles
- preserve IDE/debugger/disassembler surfaces
- add artifact and shared-source contract tests
- only then change defaults or recommend using WASM for normal operation

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
