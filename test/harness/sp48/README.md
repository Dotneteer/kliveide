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
| Create | `createSp48Session()` | Builds the 48K WASM core if needed (`scripts/build-sp48-wasm.cjs`), creates the machine with the real ROM, sets it up. |
| Boot | `bootToBasic({ maxFrames })` | Runs from reset to the BASIC main entry `$12AC` (`SP48_MAIN_ENTRY`): system variables initialised, IY = `$5C3A`, IM 1 interrupts running. About 90 frames. |
| Load | `loadCode(source, { entry? })` → `Sp48Program` | Assembles Klive Z80 source in memory (`.model Spectrum48` added if missing) and writes it to RAM. Leaves PC and SP alone. `program.symbol(name)`, `program.entry`, `program.output` (the assembler output, with source map and list items). No `#include`, no banks. |
| Run | `runFrames(n)`, `runTo(addressOrLabel)`, `step(n)` | Whole frames; run until PC reaches an address (stops before executing it); single instructions. |
| Call | `call(addressOrLabel, { returnTo? })` | Pushes a return address (default: the current PC, `$12AC` after boot), jumps, runs until the routine returns there — the way `USR` calls machine code. |
| Debug | `attachDebugSupport()` → `DebugSupport` | Attaches the emulator's own breakpoint store, so tests add address breakpoints or resolve source breakpoints as the IDE does. |
| | `callToBreakpoint(where)`, `continueToBreakpoint()` | Run in debug mode (`StopAtBreakpoint`) until a breakpoint stops the machine; return the PC. Throw if the routine returns first. |
| Memory | `peek`, `peekWord`, `poke`, `pokeWord` | Through the machine's memory API. |
| Screen | `screenChar(row, col)`, `screenLine(row)` | Text in a cell/row, recognised against the ROM character set (INVERSE-insensitive); `?` for unrecognised cells. |

## Notes

- Runs through the machine's public API (`executeMachineFrame`, `executionContext`,
  `doReadMemory`/`doWriteMemory`), like the Next harness; nothing is mocked.
- A routine that never returns ends in a timeout error naming the PC.
- Self-tests: `self-tests/session.test.ts`.
