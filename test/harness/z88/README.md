# Cambridge Z88 test harness

Tests of the Z88 emulator on the **real machine**, driven only through what the hardware exposes:
memory, the Blink's ports, CPU registers, keys, the LCD picture and the beeper. The session talks to
the machine through its API (`IZ88Machine`, `IZ88IdeMachine`), never the core's exports.

The machine is the WASM core (`Z88WasmV2Machine`). `z88WasmArtifactBytes()` rebuilds the artifact
from the C sources when it is missing or older than any of them (or the build script), and otherwise
uses the one on disk. The harness was built for the TypeScript-to-WASM migration
(`.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`) and ran every test on both machines until the
TypeScript one was removed (`.plans/CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`).

```ts
import { describe, expect, it } from "vitest";
import { createZ88Session } from "../harness/z88";

describe("keyboard", () => {
  it("reads a key through $B2", async () => {
    const s = await createZ88Session();
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
| `model` | first registered | A model id: `OZ50`, `OZ47`, `OZ40`, `OZ40FI`, `OZ30`, ... |
| `config` | the model's | A configuration override, e.g. `{ ...model.config, screenSize: "640x480" }` |
| `rom` | `"blank"` | `"blank"`: no setup, slot 0 holds a blank 512K ROM card - nothing runs until you load code. `"model"`: load the model's ROM and cards and hard reset, as the app does. |
| `audioSampleRate` | none | Set it for any audio test. Without it the beeper emits no samples (the app always sets a rate). |

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
| CPU | `registers()` `setRegisters({...})` `tacts` `frames` | `registers()` reads `getCpuState()`, the IDE's path (the machine syncs its lazily mirrored CPU first) |
| Debugger | `breakpoint(addrOrLabel)` `watch(addrOrLabel \| port, "memoryRead" \| "memoryWrite" \| "ioRead" \| "ioWrite")` `debug("continue" \| "stepInto" \| "stepOver" \| "stepOut")` | As the IDE runs it (`MachineController.run`): a step wakes a snoozing CPU first, a step-out marks its target first. Returns the PC it stopped at. |
| State | `snoozed` `sleeping` `blinkState()` | `blinkState()` is what the Blink panel shows |
| Keys | `keyDown(...keys)` `keyUp(...keys)` | `Z88KeyCode` names: `"A"`, `"N1"`, `"Enter"`, `"ShiftL"`, `"Menu"`, ... |
| Commands | `flapOpen()` `flapClose()` `await command(name)` | `battery_low`, `press_shifts`, `flap_open`, `flap_close` |
| Cards | `await plugCard(slot, { cardType, size, file? } \| undefined)` | Hot-plugs slot 1-3 as the card dialogs do (`CardIds` types, size in KB); a re-configured flash card comes back erased |
| LCD | `lcdWidth` `lcdHeight` `pixel(x, y)` `screen()` | ABGR words; compare with `Z88_LCD.ON/OFF/GREY/SCREEN_OFF`. The LCD renders every 8th frame. |
| Audio | `startAudio()` `audio()` | Samples of every completed frame (DC-filtered: level changes show as jumps) |
| Escape hatch | `s.machine` | Avoid in tests; add a method instead |

## Rules

1. **Say where an expectation comes from.** The Blink and card documentation where it exists;
   otherwise the TypeScript machine the core was ported from, and then say so in a comment - its
   values at every checkpoint of the former lockstep suites are the goldens in
   `test/wasm/z88/goldens/` (`test/z88/README.md`).
2. **Drive and observe through the hardware interface**: code, ports, keys, memory, pixels, audio.
3. **Only machine-API calls.** If a test needs something the session cannot do, add a session
   method that uses the machine API, not the core's exports.
