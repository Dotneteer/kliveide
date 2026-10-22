# HT-1080Z test harness

Scripts one real HT-1080Z - the WASM core the app runs (`src/emu/machines/ht1080z/wasm/`), with the
model's real ROMs (`src/public/roms/ht1080z-*.rom`) - from a vitest test, through the machine's
public API as the IDE drives it. Its siblings are `../zx81/`, `../sp48/` and `../zxnext/`.

```ts
import { createHtSession } from "../harness/ht1080z";

it("boots", async () => {
  const s = await createHtSession(); // Series II
  s.bootToPrompt();
  expect(s.screenText().filter((l) => l)).toEqual(["READY", ">_"]);
});
```

## API

| Group | Method | What it does |
| --- | --- | --- |
| Create | `createHtSession({ model? })` | Builds the core once per test process and powers the machine on: `ht1080z-s1`, `ht1080z-s2` (default) or `ht1080z-64` (`HT1080Z_ALL_MODELS`). |
| Boot | `bootToPrompt()`, `hasFirstPrompt()` | Runs to the power-on question (`READY ?` on Series I/II, `MEMORY SIZE?` on the /64), answers it with NEW LINE, and runs to the `>` prompt. |
| Run | `runFrames(n)`, `runUntil(pred)`, `runTo(address)`, `step(n)` | Whole 34,944-T frames; until a predicate holds; until PC reaches an address; single instructions. |
| Keys | `typeKeys(text)`, `extensionOn()`, `keyDown`/`keyUp`, `pressKey(...codes)`, `pressResetKey()` | Text through the machine's typer (`Ht1080zTyper.ts`), accents included; `SYSTEM` `/12288`, which the accents and lowercase need; raw `Ht1080zKeyCode` keys (`row * 8 + column`); a chord held 3 frames and released 3; the RESET key's NMI. |
| Debug | `attachDebugSupport()`, `debug(action)`, `breakpoint(address)` | The emulator's own breakpoint store; continue/step into/over/out as `MachineController` runs them. |
| Memory | `peek`, `peekWord`, `poke` | Through the memory map. |
| Screen | `screenText()`, `lastLines(n)`, `lineCodes(back)`, `screenCode(line, column)`, `screenPixels()` | The 16 lines of video RAM as text (codes 20h-7Fh as ASCII, others as `{xx}`); the last non-empty lines; one line's codes; one video-RAM byte; the picture. |

## Notes

- `wasm` gives the core's exports: `ht1080zGetPortFf`, `ht1080zGetRecorder2`,
  `ht1080zSetCassetteLatch` and the frame counters are read there.
- **Series I/II store letters at 00h-1Fh.** The BASIC's display driver (0471h) folds 40h-7Fh down
  to 00h-1Fh before it writes the screen, so `READY` is 12h 05h 01h 04h 19h in video RAM.
  `screenText()` reads 00h-1Fh as 40h-5Fh on those models; the /64's BASIC removes the fold, and its
  00h-1Fh are the Hungarian characters.
- Probes run machine code: `poke` it into RAM, set `machine.pc`, `runTo` its end. The ROM keeps its
  stack below the top of RAM, so 6000h is a safe place on every model (`test/ht1080z-hw/skeleton.test.ts`).
- Self-tests: `self-tests/session.test.ts`.
