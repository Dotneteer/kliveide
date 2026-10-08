# ZX81 / ZX80 test harness

Scripts one real ZX81 or ZX80 - the WASM core the app runs (`src/emu/machines/zx8081/wasm/`), with
the real ROM (`src/public/roms/zx81.rom`, `zx80.rom`) - from a vitest test, through the machine's
public API as the IDE drives it. Its siblings are `../sp48/` and `../zxnext/`.

```ts
import { createZx81Session } from "../harness/zx81";

it("prints", async () => {
  const s = await createZx81Session();
  s.bootToBasic();
  s.typeKeys('P"HELLO"\n', { settle: 20 }); // K mode: P is PRINT; SHIFT+P the quote
  expect(s.screenText()[0]).toBe("HELLO");
});
```

## API

| Group | Method | What it does |
| --- | --- | --- |
| Create | `createZx81Session({ machineId?, model? })` | Builds the core once per test process and sets the machine up: `zx81` (default) or `zx80`, a model id from `zx8081MachineInfo.ts` (`zx81-16k` default). |
| Boot | `bootToBasic()`, `hasKCursor()` | Runs until the display file shows the K cursor (both machines). |
| Run | `runFrames(n)`, `runUntil(pred)`, `runTo(address)`, `step(n)` | Whole 20 ms frames; until a predicate holds; until PC reaches an address; single instructions (through the core). |
| Keys | `typeKeys(text)`, `typeChords(...chords)`, `keyDown`/`keyUp` | Text through the machine's typer (`Zx8081Typer.ts`); raw `Zx8081KeyCode` chords. Keys are held 4 frames and released 6: **the ROM ignores a key that follows the last one by fewer than 4 key-free frames.** |
| Files | `Zx81TestSession.readProgram(path)`, `insertProgram(file)`, `loadProgram(file, { fastLoad, autoRun })` | A program from `_input/zx81-tapes/` (or an absolute path); in the deck; loaded as the tape-load flow does - typed `LOAD ""` (`LOAD` on a ZX80), until the ROM finishes, with the machine's auto-RUN or without. |
| Debug | `attachDebugSupport()`, `debug(action)`, `breakpoint(address)`, `watch(address, access)` | The emulator's own breakpoint store; continue/step into/over/out as `MachineController` runs them. |
| Memory | `peek`, `peekWord`, `poke` | Through the memory map. |
| Screen | `screenText()`, `screenPixels()`, `isInk(x, y)`, `pixelArt(x, y, w, h)` | The display file as text (inverse in brackets; the character set follows the ROM); the published picture. |
| History | `recordHistory(on)`, `clearHistory()`, `historyInfo()`, `history(count?)`, `historyFrom(sequence, count)` | The execution-history recorder (`.plans/EXECUTION_HISTORY_ALL_CORES_PLAN.md`) through the machine's `IExecutionHistorySource`, shared with every harness (`../historySupport.ts`): on/off, clear, the ring's header, the newest records decoded oldest first (each the state *before* its instruction or event), a read by sequence with its "gone" flag. Display NOPs come as one forced-NOP record per run. |

## Notes

- `wasm` gives the core's exports: the ULA state (`zx8081GetHcounter`, `zx8081GetTvFrames`,
  `zx8081GetLastFrameLines`) and the tape counters are read there.
- A program saved in FAST mode loads in FAST mode (its CDFLAG is in the file), where a running
  program has no picture.
- Self-tests: `self-tests/session.test.ts`.
