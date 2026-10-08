# ZX Spectrum 48K test harness

Scripts one real ZX Spectrum 48K — the WASM core the app runs, with the real 48K ROM
(`src/public/roms/sp48.rom`) — from a vitest test. Built for Klive BASIC's execution tests
(`.plans/ZXBASIC_COMPILER_PLAN.md` §13.2), which need a machine whose ROM and system variables are
in the state BASIC leaves them in. Its sibling for the Next is `../zxnext/` (read that README for
the conventions this one follows).

```ts
import { describe, expect, it } from "vitest";
import { createSp48Session } from "../harness/sp48";

it("prints through the ROM", async () => {
  const s = await createSp48Session();
  s.bootToBasic();
  await s.loadCode(`
        .org $8000
    Main:
        ld a,2
        call $1601        ; CHAN-OPEN: stream 2, the upper screen
        ld a,"A"
        rst $10           ; PRINT-A
        ret
  `);
  s.call("Main");
  expect(s.screenLine(0)).toBe("A");
});
```

## API

| Group | Method | What it does |
| --- | --- | --- |
| Create | `createSp48Session()` | Builds the 48K WASM core once per test process (`scripts/build-sp48-wasm.cjs`), creates the machine with the real ROM, sets it up. |
| Boot | `bootToBasic({ maxFrames })` | Runs from reset to the BASIC main entry `$12AC` (`SP48_MAIN_ENTRY`): system variables initialised, IY = `$5C3A`, IM 1 interrupts running. About 90 frames. |
| Load | `loadCode(source, { entry? })` → `Sp48Program` | Assembles Klive Z80 source in memory (`.model Spectrum48` added if missing) and writes it to RAM. Leaves PC and SP alone. `program.symbol(name)`, `program.entry`, `program.output` (the assembler output, with source map and list items). No `#include`, no banks. |
| | `loadOutput(output, { entry? })` → `Sp48Program` | Writes an assembler output that is already built (for example by `compileProgram` from several units) into RAM. `program.symbol` resolves dotted module names such as `core.Alloc`. |
| Run | `runFrames(n)`, `runTo(addressOrLabel)`, `step(n)` | Whole frames; run until PC reaches an address (stops before executing it); single instructions. |
| Call | `call(addressOrLabel, { returnTo? })` | Pushes a return address (default: the current PC, `$12AC` after boot), jumps, runs until the routine returns there — the way `USR` calls machine code. |
| Debug | `attachDebugSupport()` → `DebugSupport` | Attaches the emulator's own breakpoint store, so tests add address breakpoints or resolve source breakpoints as the IDE does. |
| | `callToBreakpoint(where)`, `continueToBreakpoint()` | Run in debug mode (`StopAtBreakpoint`) until a breakpoint stops the machine; return the PC. Throw if the routine returns first. `onFrame` runs after every frame (where the controller drains the logpoint queue). |
| | `sourceStep(index, kind)` → `SourceStep` | A source-level step (`into`, `over`, `out`, `overLine`, `runToFrame`, `intoTarget`) of a compiled program with source-level debug info, exactly as the IDE runs it; `undefined` if the program returns to `returnTo` first. |
| Keys | `keyDown(...keys)`, `keyUp(...keys)` | Hold / release keys by `SpectrumKeyCode` name (`"A"`, `"N1"`, `"Enter"`, `"Space"`, `"CShift"`, `"SShift"`); the matrix is read from the next frame. |
| | `typeKeys(chords, { hold, gap })` | Types as a user does: each chord (keys pressed together) held `hold` frames (3), then released `gap` frames (3), short of the ROM's auto-repeat. The ROM or a program must be reading the keyboard. |
| | `typeFlowKeys(flow, { hold, gap })` | Types a code-injection flow's `QueueKey` steps (for example `sp48TapeLoadFlow()`), so a test checks the keys the IDE queues. |
| Tape | `insertTape(blocks, { fastLoad })` | Puts `TapeDataBlock`s in the deck (`MEDIA_TAPE`), fast load on by default; the ROM's LOAD reads them. |
| Memory | `peek`, `peekWord`, `poke`, `pokeWord` | Through the machine's memory API. |
| Snapshot | `loadSnapshot(name, bytes)` | Parses a `.sna`/`.z80`/`.szx` file (its extension picks the format) and loads it with `loadSnapshotState`, as the emulator does; returns the frame tact. |
| | `captureSnapshot()` | Reads the machine's state as a snapshot model with `captureSnapshotState`, without changing it. |
| | `saveSnapshot(format)` | Captures and writes a `.sna`/`.z80`/`.szx` file, as the emulator saves one; returns `{ bytes, losses }` and throws when the format refuses the state. |
| RZX | `startRzxRecording(options?)` → `RzxRecorder`, `stopRzxRecording()` → `Uint8Array` | Records an RZX file from the current state as the emulator does (a `.szx` snapshot, then every IN and every frame's fetch count); stopping returns the finalised file. |
| | `playRzx(bytes, options?)` → `RzxPlayer`, `runRzx({ onFrame, maxFrames })` → `RzxStop`, `rzxStatus` | Loads a recording's snapshot and plays it on the machine's own frame loop until it ends or desyncs (`.plans/RZX_PLAN.md`). Shared with `../sp128/` through `../spectrumRzx.ts`; `runFrames` throws when a session stops under it. |
| Screen | `screenChar(row, col)`, `screenLine(row)` | Text in a cell/row, recognised against the ROM character set (INVERSE-insensitive); `?` for unrecognised cells. |
| History | `recordHistory(on)`, `clearHistory()`, `historyInfo()`, `history(count?)`, `historyFrom(sequence, count)` | The execution-history recorder (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md`) through the machine's `IExecutionHistorySource`, shared with every harness (`../historySupport.ts`): on/off, clear, the ring's header, the newest records decoded oldest first (each the state *before* its instruction or event), a read by sequence with its "gone" flag. `step(n)` here runs CPU *cycles*: a prefixed instruction takes several, but is one record. |

## Notes

- Runs through the machine's public API (`executeMachineFrame`, `executionContext`,
  `doReadMemory`/`doWriteMemory`), like the Next harness; nothing is mocked.
- A routine that never returns ends in a timeout error naming the PC.
- Self-tests: `self-tests/session.test.ts`.
