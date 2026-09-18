# ZX Spectrum Next test harness

Tests of the ZX Spectrum Next emulator on the **real machine**: a whole `ZxNextMachine` (TypeScript
core) or `ZxNextWasmV2Machine` (production WASM core), running Z80N code, driven and observed only
through what the hardware exposes: ports, NextRegs, memory, CPU registers, the displayed picture and
the mixed audio. No mocks, no device objects in isolation, no stand-in for "a frame".

Use it for any Next component: Copper, sprites, Layer 2, tilemap, palette, TurboSound, DAC, CTC,
DMA, interrupts, MMU. It is the replacement for unit tests that poke device objects directly,
simulate clocks by hand or fake the machine around a device.

It has two front ends on one engine:

| Front end | Use it when | Lives in |
|---|---|---|
| **Scripted tests** (`createSession`) | You assert on registers, ports, memory, timing, audio or a few pixels. Most component tests. | `test/zxnext-hw/<component>/*.test.ts` (vitest) |
| **Declarative screen cases** (`case.json`) | The result is a picture judged by probes, motion tracking, core parity, golden hashes and AI review, optionally through a real NextZXOS `.nexload` in Chrome. | `test/visual/<suite>/<case>/` |

## Folder layout

```
test/harness/zxnext/
  index.ts          public API - import from here
  script/session.ts NextTestSession: the scripting layer
  core/             machine creation, frame capture, assembler -> NEX, direct NEX loader,
                    beam geometry, colour notations, PNG helpers
  cases/            the declarative case runner: case.json, probes, motion, golden, review, browser tier
  browser/ server/  browser tier: the WASM core in Chrome, NextZXOS boot + .nexload from a cloned SD card
  cli/              npm run test:visual / visual:serve entry points (Vite SSR host)
  self-tests/       the harness's own tests; every method and every oracle is tested on both cores
```

## Commands

```bash
npm test -- --project node test/zxnext-hw               # scripted hardware tests
npm test -- --project node test/harness/zxnext          # the harness's own tests
npm run test:visual                                     # screen cases, both cores, headless
npm run test:visual -- C02 --core wasm --verbose        # one case / prefix, one core
npm run test:visual -- --tier browser                   # screen cases through real .nexload in Chrome
npx tsc -p test/harness/zxnext/tsconfig.json            # type-check harness + tests (ignore src/ backlog)
```

The WASM core runs from `src/emu/machines/zxNext/wasm/dist/zx-spectrum-next.wasm`. After changing the C
sources run `npm run build:zxnext-wasm`; the case runner refuses a stale artifact.

## Scripted tests

```ts
import { describe, expect, it } from "vitest";
import { ALL_CORES, createSession } from "../../harness/zxnext";

describe.each(ALL_CORES)("sprites: collision flag - %s core", (core) => {
  it("is set when two opaque sprites overlap, and reading $303B clears it", async () => {
    const s = await createSession(core);
    await s.loadCode(`
        .org $8000
        nextreg $15,$01
        ; ... upload a pattern through port $5B, attributes through $57 ...
        nextreg $7F,$A5          ; ready
        jr $
    `);
    s.runUntilReady().runFrames(2);
    expect(s.in(0x303b) & 0x01).toBe(1);
    expect(s.in(0x303b) & 0x01).toBe(0);
  });
});
```

The full, working version is `test/zxnext-hw/sprites/sprite-collision.test.ts`.

### Session API

`createSession(core, { audioSampleRate? })` creates the machine and hard-resets it like the app does.
Every method runs on both cores; methods returning `this` chain.

| Area | Method | Notes |
|---|---|---|
| Load | `loadCode(source, { entry?, sp? })` → `Program` | Assembles Klive Z80N source in memory. NEX MMU layout (ROM, bank 5, bank 2, bank 0), DI, SP `$BFF0`, PC = `.ent` / `entry` / first segment. `.model Next` added if missing. No `#include`, no `.bank`. |
| | `loadProgramFile(path)` | `.asm` with `.savenex` pragmas (includes work) or a `.nex`; direct NEX loader, no NextZXOS. |
| | `symbol(name)` | A label or `.equ` of the last `loadCode` program. |
| Run | `runFrames(n = 1)` | Whole frames exactly as the emulator panel runs them. Finishes a frame stopped midway first. |
| | `runUntil(pred, what, { maxFrames })` | Frame granularity; fails with PC and `what` on timeout. |
| | `runUntilReady({ maxFrames = 50 })` | Until the program writes `$A5` to NextReg `$7F`. |
| | `runTo(addrOrLabel, { maxFrames })` | Stops mid-frame *before* that instruction. |
| | `step(n = 1)` | Executes `n` instructions. |
| | `call(addrOrLabel, { returnTo?, maxFrames })` | Pushes a return address, jumps, runs until it returns. |
| | `hardReset()` `reset()` | Power-on reset / soft reset (memory kept). |
| Memory | `peek` `peekWord` `peekBytes` `poke(addr, byte \| bytes)` `pokeWord` | Through the current MMU paging, like the CPU. |
| I/O | `out(port, v)` `in(port)` | With every hardware side effect (reads that clear status bits clear them). |
| NextReg | `setNextReg(r, v)` `readNextReg(r)` | Through `$243B`/`$253B`, as Z80 code would. |
| | `nextRegValue(r)` | Stored value without port side effects - for assertions and wait conditions. |
| Keys | `await pressHotkey("F5" \| "F6" \| "F8" \| "F9" \| "F10")` | Function-key hotkeys: expansion bus on/off, CPU speed step (gated by NextReg `$06` bit 7, like the FPGA); the M1 (Multiface) and DRIVE (DivMMC) NMI buttons (gated by `$06` bits 3 / 4). |
| SD card | `attachSdCard(image \| backing)` `await runFramesAsync(n)` `await runUntilReadyAsync()` `sdImage` `sdCalls` | Card 0 in the slot: a flat `Uint8Array` (whole 512-byte sectors) or any `SdCardBacking` (e.g. a CIM clone). The machines read and write sectors through frame commands; the async runs answer them with the machine's own `processFrameCommand`, the sync runs throw on one. `sdImage` has the writes; `sdCalls` counts the host calls. |
| CPU | `registers()` `setRegisters({...})` `tacts` `frames` | `registers()` has 16-bit pairs (`bc`, not `b`). |
| Screen | `screen()` `pixel(x, y)` `rowRuns(y)` `expectProbe(probe)` `saveScreenPng(path)` | The last *displayed* 720x288 frame. Probe and colour notation as in `case.json` (`ula:N`, `next8:0xNN`, `rgb333:R,G,B`, `#RRGGBB`). |
| Audio | `startAudio()` `audio()` | Mixed left/right samples of each completed frame; needs `audioSampleRate`. |
| Parity | `onEachCore(script)` → `{ ts, wasm }` | Same script on both cores, for `expect(r.wasm).toEqual(r.ts)`. |
| Escape hatch | `s.machine`, `s.core` | Do not use in tests; add a method instead (below). |

Lower-level helpers (`createCore`, `captureFrame`, `compileNexFile`, `loadNexDirect`, beam and
colour conversions) are exported from `index.ts` too.

### Rules for a good hardware test

1. **Expectations come from the hardware, never from emulator output.** Cite the VHDL
   (`_input/next-fpga/src`) or the official docs in a comment next to the assertion.
2. **Both cores.** `describe.each(ALL_CORES)`. A core-specific test says why in a comment.
3. **Drive through the hardware interface.** Z80 code, `out`, `setNextReg`, `poke`. Setting state a
   program could not set hides bugs in the path that sets it.
4. **Observe through the hardware interface.** `in`, `peek`, registers, pixels, audio;
   `nextRegValue` for stored register values.
5. **Let frames run.** Timing-dependent devices (CTC, DMA, copper, line interrupts, audio) are
   exercised by `runFrames` / `runTo` / `step`, not by calling a device's clock method.
6. **Do not assume reset values the firmware changes** when a test may also run through NextZXOS
   (screen cases): see `test/visual/copper/_include/copper-routines.z80asm` `ClearScreen`.
7. **Write every palette entry you rely on**; FPGA palette RAM has no reset contents.

### Replacing a mock-based unit test

1. Read the old test for *what hardware behaviour* it checks; ignore how it reached into the device.
2. Find that behaviour in the VHDL. If the old expectation disagrees with it, the VHDL wins - and the
   old test was encoding an emulator bug.
3. Write a small Z80N program (or `out`/`setNextReg` calls) that sets the scenario up the way
   software would, and observe the result through ports, memory, pixels or audio.
4. Run it on both cores. A difference between them, or with the VHDL, is a finding: fix the core or
   mark it with `it.fails` and a comment naming the cause - never loosen the expectation.
5. Delete the old test once the new one covers it. Keep pure-function unit tests (codecs, tables)
   that never needed a machine.

`test/zxnext-hw/sprites/sprite-collision.test.ts` shows the result for
`test/zxnext/sprite-collision-scenarios.ts`, which needed an engine abstraction with a
`completeFrame` stand-in per core.

## Adding a method

When a test needs something the session cannot do, add it to `script/session.ts` - do not reach into
`s.machine` from the test.

1. **Find the public machine API** both cores implement (`ZxNextMachine` members that
   `ZxNextWasmV2Machine` overrides: memory, ports, CPU registers, `executeMachineFrame`,
   `executionContext`, `getAudioSamples`, `setKeyStatus`, ...). If the cores differ, branch on
   `this.machine instanceof ZxNextWasmV2Machine` inside the method, as `readNextRegDirect` in
   `core/machines.ts` does. If only one core can provide it, say so in the doc comment and throw on
   the other.
2. **Keep the rules** in the header of `session.ts`: both cores; hardware-level input; no hidden state
   setting; every wait has a frame limit and its error names the PC and what it waited for.
3. **Name it after the hardware action** (`out`, `runTo`, `startAudio`), add a JSDoc comment with
   anything surprising, return `this` for actions.
4. **Test it on both cores** in `self-tests/session.test.ts`, including one assertion that would fail
   if the method silently did nothing.
5. **Export** new types from `index.ts` and **add a row** to the Session API table above.

Candidates not written yet: keyboard (`setKeyStatus`), joystick/mouse input, observing the INT line
and interrupt acknowledge, a port/memory write log for both cores, checkpoints
(`captureCheckpoint` exists on the WASM core only).

## Declarative screen cases

`test/visual/<suite>/<case>/`: `program.asm`, `case.json`, `expect.md`, `golden.json`. The runner
compiles the program, runs it on both cores, captures PNGs of chosen frames and judges them by
probes, motion specs, core parity, golden hashes and an AI review prompt; `--tier browser` repeats
that through NextZXOS in Chrome. How to write one, the geometry, and the pitfalls:
`.ai/visual-tests-guide.md`. Design history and emulator findings:
`.plans/COPPER_VISUAL_TEST_HARNESS_PLAN.md`.

## Pitfalls

- **Park the CPU before running frames.** A session with no `loadCode` runs the Next ROM, which
  rewrites NextRegs (the port enables, `$08`, ...) and the border within a frame or two. Load at least
  `.org $8000 / jr $` before `runFrames` when the test sets hardware state from outside.
- **The TS core's first displayed frame after a hard reset is black.** Run one frame before comparing
  pixels across cores or against a reference session.

## Measuring to the tact

Taking an interrupt adds acceptance jitter (the instruction in progress, HALT's 4-tact steps). To
place a raster event exactly, do not take one: from a fixed start (a frame boundary reached by
`runFrames` with the CPU parked), run an exact-length delay and read a latch or counter with one IN,
and binary-search the delay at which the value changes. Two events read by the same IN instruction
subtract the CPU's own timing out. `test/zxnext-hw/_timing-helpers.ts` has the exact-length `delay`;
`test/zxnext-hw/video/video-timing.test.ts` (`probe`, `threshold`) finds the ULA interrupt through the
`$C8` latch and the line change through `$1F` this way, and `ula/border-timing.test.ts` sweeps a border
`OUT` one T-state at a time. Take a fresh session per measurement when the timing is not +3: after a
`hardReset` from another raster the cores can start the next frame at different phases.

## Direct load

`loadCode` and `loadProgramFile` put the program into memory the way the NEX format promises the
entry state, but without NextZXOS: ROM selection, the NextRegs the OS changes, the interrupt mode and
system variables stay at hard-reset values. A test that depends on any of that belongs in a screen
case with `"tiers": ["headless", "browser"]`.
