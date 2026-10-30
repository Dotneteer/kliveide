# Enterprise 64/128 test harness

Runs the real Enterprise WASM core (`src/emu/machines/enterprise/wasm/`) with the bundled ROMs, through
the same machine class the IDE uses (`EpWasmV2Machine`). The plan is `.plans/ENTERPRISE_PLAN.md`.

```ts
import { createEpSession } from "../harness/enterprise";

const s = await createEpSession(); // the 128; { model: "ep64" } from Phase 6
s.bootToBasic();
expect(s.screenText()).toContain("IS-BASIC");
```

`createEpSession` builds the core once per test process. Tests that run it belong to the e2e tier
(`build/e2e-tests.ts` lists `test/ep-hw/**`).

## What a session offers

- **Running:** `runFrames(n)`, `runUntil(predicate)`, `runTo(address)`, `step(n)` (instructions).
- **EXOS:** `bootToBasic()` (about 440 frames on the 128: the RAM test, the banner, a key, IS-BASIC),
  `isShowingBanner()`, `isAtBasicPrompt()`.
- **Keys:** `keyDown`, `keyUp`, `pressKey(code, { hold, gap })` with `EpKeyCode` codes (`row * 8 + column`).
- **Memory:** `peek`/`poke` (through the paging), `physical(address)` (the 4 MB space), `vram(address)`
  and `pokeVram` (NICK's 64K, without a CPU cycle).
- **NICK:** `nick()` (ports, LPT base and pointer, the current LPB, LD1/LD2, slot, line, display and sync),
  `lpbAt(address)`, `lpt()` (the table to its RELOAD block), and `screenText()`.
- **DAVE:** `dave()` (B4h, the enables and latches, BFh, the sound registers).
- **Debugger:** `attachDebugSupport()`.

`screenText()` reads the screen as NICK reads it: for every character-mode LPB with open margins, the
codes LD1 points at, one string per row. It needs no pixels, so it works from Phase 1 on.

`nick().line` counts lines from where vertical sync started (the machine's frame start), not from the
LPT's top.

## The bare machine (`test/ep-hw/bare.ts`)

`bareMachine(s, { lpt, bf, halt })` parks the CPU in segment F8h (page 0), switches every interrupt off,
sets BFh, and loads an LPT the test writes (`standardLpt()` is a 312-line frame with vertical sync on
LPT lines 260-262). `timeCode(s, code)` runs code from page 1 and returns its T-states (it ends with
`JR $`, because a HALT would leave the CPU halted for the next run).
