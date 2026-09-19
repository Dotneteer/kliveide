# Cambridge Z88 test harness

Tests of the Z88 emulator on the **real machine**, driven only through what the hardware exposes:
memory, the Blink's ports, CPU registers, keys, the LCD picture and the beeper. The session talks to
the machine through the backend-neutral API (`IZ88Machine`, `IZ88IdeMachine`), never a device
object, so **the same test runs on every backend**.

The harness exists for the TypeScript-to-WASM migration
(`.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`). `Z88_HARNESS_BACKENDS` lists the backends the
tests run on: only `"typescript"` until the WASM core can run code, then both.
`createZ88Machine({ backend: "wasm" })` already creates a `Z88WasmV2Machine` (the WASM machine
tests use it), and `z88WasmArtifactBytes()` builds the core once per test worker.

```ts
import { describe, expect, it } from "vitest";
import { createZ88Session, Z88_HARNESS_BACKENDS } from "../harness/z88";

describe.each(Z88_HARNESS_BACKENDS)("keyboard (%s)", (backend) => {
  it("reads a key through $B2", async () => {
    const s = await createZ88Session({ backend });
    s.keyDown("A");
    expect(s.in(0xdfb2)).toBe(0xf7); // line 5 (A13 low), bit 3
  });
});
```

## Commands

```bash
npm test -- --project node test/harness/z88    # the harness's own tests
npm test -- --project node test/z88            # the Z88 tests (core suites and session tests)
```

## Creating a session

`createZ88Session(options)` builds the machine the way `MachineService` does (file provider, audio
sample rate, setup and hard reset) and attaches a `DebugSupport` (step-into needs one).

| Option | Default | Meaning |
|---|---|---|
| `backend` | `"typescript"` | The emulation backend |
| `model` | first registered | A model id: `OZ50`, `OZ47`, `OZ40`, `OZ40FI`, `OZ30`, ... |
| `config` | the model's | A configuration override, e.g. `{ ...model.config, screenSize: "640x480" }` |
| `rom` | `"blank"` | `"blank"`: no setup, slot 0 holds a blank 512K ROM card - nothing runs until you load code. `"model"`: load the model's ROM and cards and hard reset, as the app does. |
| `audioSampleRate` | none | Without it the beeper produces no samples |

## Session API

Methods returning `this` chain.

| Area | Method | Notes |
|---|---|---|
| Load | `loadCode(source, { entry?, sp? })` | Assembles Klive Z80 source. Maps internal RAM banks $20-$23 over the whole 64K first (`mapFlatRam`), so any address works, including an IM 1 handler at $0038. DI, SP $BFF0. PC = `.ent` / `entry` / **the first segment** - pass `entry` when the first segment is not the program. |
| | `mapFlatRam()` | COM.RAMS and SR0-SR3 through their ports (`Z88_FLAT_RAM_LAYOUT`) |
| | `symbol(name)` | A label of the last program |
| Run | `runFrames(n)` | Whole 5 ms frames (16384 tacts) |
| | `runUntil(pred, what, { maxFrames })` | Frame granularity; fails with PC on timeout |
| | `runTo(addrOrLabel)` | Stops before that instruction |
| | `step(n)` | `n` instructions; a snoozed CPU's 16-tact pause counts as one |
| | `hardReset()` `reset()` | |
| Memory | `peek` `peekWord` `peekBytes` `poke(addr, byte \| bytes)` `pokeWord` | Through the current paging, like the CPU - a flash card sees them as bus cycles |
| | `physPeek(abs)` | The 4 MB physical memory; slot N starts at N * $100000, internal RAM at $080000 |
| I/O | `in(port)` `out(port, v)` | Full 16-bit port address: the KBD row select and the LCD registers' high byte come from B |
| CPU | `registers()` `setRegisters({...})` `tacts` `frames` | |
| State | `snoozed` `sleeping` `blinkState()` | `blinkState()` is what the Blink panel shows |
| Keys | `keyDown(...keys)` `keyUp(...keys)` | `Z88KeyCode` names: `"A"`, `"N1"`, `"Enter"`, `"ShiftL"`, `"Menu"`, ... |
| Commands | `flapOpen()` `flapClose()` `await command(name)` | `battery_low`, `press_shifts`, `flap_open`, `flap_close` |
| LCD | `lcdWidth` `lcdHeight` `pixel(x, y)` `screen()` | ABGR words; compare with `Z88_LCD.ON/OFF/GREY/SCREEN_OFF`. The LCD renders every 8th frame. |
| Audio | `startAudio()` `audio()` | Samples of every completed frame (DC-filtered: level changes show as jumps) |
| Escape hatch | `s.machine` | Avoid in tests; add a method instead |

## Rules

1. **Say where an expectation comes from.** The Blink and card documentation where it exists;
   otherwise the TypeScript oracle, and then say so in a comment - the WASM core must reproduce the
   oracle, quirks included, until a documented fix changes both.
2. **Drive and observe through the hardware interface**: code, ports, keys, memory, pixels, audio.
3. **Only backend-neutral calls.** If a test needs something the session cannot do, add a session
   method that uses the machine API, not a device object.

## Adding a backend

Add the backend to `Z88HarnessBackend`, create its machine in `createZ88Machine`
(`core/machines.ts`), and add it to `Z88_HARNESS_BACKENDS`. Every session test then runs on it.
