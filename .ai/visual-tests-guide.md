# Visual Tests (ZX Spectrum Next)

Pixel-level tests of what the emulator *shows*: a Z80N program (`.savenex`) runs for known frames, the
frames are saved as PNG and judged by probes, parity and an AI review. Built first for the Copper.
Design, hardware facts and the findings so far: `.plans/COPPER_VISUAL_TEST_HARNESS_PLAN.md`.
The cases run on the ZX Spectrum Next test harness (`test/harness/zxnext/`, see its `README.md`); for
tests that assert on registers, ports, memory or audio rather than whole pictures, use its scripted
sessions instead.

## Commands

```bash
npm run test:visual                         # Tier 1: all cases, TS + WASM cores in Node (~45 s)
npm run test:visual -- C02 D0 --verbose     # by id or prefix; --verbose prints known failures
npm run test:visual -- --core wasm          # one core (WASM is ~12x faster than TS)
npm run test:visual -- --long               # adds longCapture frames and longOnly cases
npm run test:visual -- --tier browser       # Tier 2: cases tagged "browser", in the installed Chrome
npm run test:visual -- --tier browser --headed
npm run visual:serve                        # interactive: open http://127.0.0.1:5177/ in Chrome
npm run test:visual -- --approve C02        # lock in hashes after a pass verdict (add --tier browser)
npm test -- --project node test/harness/zxnext  # the harness's own tests (mutation tests of every oracle,
                                            # and raster/$1F/WAIT-H/border/$68/$14/line-interrupt/Layer 2/compositing regressions)
```

Output goes to `.visual-tests/<timestamp>/` (gitignored; `.visual-tests/LATEST` names the newest):
`<case>/{ts,wasm,browser}/frame-NNNNN.png`, `rows-NNNNN.json` (run-length colour spans per row - read
these instead of counting pixels), contact sheets, `motion-*.json`, `result.json`, `review.md`.

## The two tiers

- **Tier 1 (headless)** - `test/harness/zxnext/cli/run.ts` under Vite SSR. Both cores in-process, a
  **test-only direct NEX loader** (`core/load-nex-direct.ts`), exact frame numbers from load.
- **Tier 2 (browser)** - `server/` plays the main process (assembler, SD card, files); `browser/page.ts`
  runs the production WASM core in Chrome. It boots NextZXOS from a **clone** of `~/Klive/ks2.cim`
  (the real image is never written; the run checks its mtime) and runs the app's own
  `getCodeInjectionFlow` (`.nexload`) **in frames, not milliseconds** (`browser/frame-runner.ts`), so it
  is deterministic. Frames are counted from the program's ready marker. Extra oracles: `headless`
  (static screen equals Tier 1 WASM) and `canvas`. ~3 s per case including the boot.

## Frames: capture exactly what the app shows

`runDisplayedFrame` / `FrameRunner.step` capture right after `executeMachineFrame()`, like
`EmulatorPanel`. Both cores draw the frame *during* execution: TS tact by tact, WASM with a beam-racing
raster (`zxnext-ula.c`: before a video NextReg/port write, or a screen *memory* write, render up to the
beam with the old state - memory writes to the start of the current row; finish at frame completion).
The panel no longer calls `renderInstantScreen()` after each frame (it only produced a copy of the
displayed picture for the pause overlay, at 23-38% of the frame time); `renderInstantScreen()` is an
end-of-frame render and is used only for the paused "instant screen" view.

## Writing a case

`test/visual/<suite>/<case>/`: `program.asm`, `case.json`, `expect.md` (required), `golden.json`
(written by `--approve`). Start from an existing case.

- Include `../_include/copper-macros.z80asm` right after `.model Next` (macros before use) and
  `../_include/copper-routines.z80asm` at the end (the existing cases keep their code at `$8000`; since
  `.ent` now sets the NEX entry point, a program may also put routines first and mark `Start: .ent $`).
- Call `ClearScreen` first. It resets the NextRegs NextZXOS leaves changed (`$43=$20` sends palette
  writes to the sprite palette, `$07=$33` is 28 MHz, `$15=$01` sprites on) - a program that assumes
  reset values passes Tier 1 and fails the real load.
- Write every palette entry the picture uses: FPGA palette RAM has no reset contents (firmware fills it),
  and the cores' power-on palettes differ in the low blue bit.
- A setup that takes longer than 10 frames needs `readyBy` in `case.json`.
- Signal ready with `SignalReady()` (`$A5` → NextReg `$7F`) once the picture is set up.
- The display file is **not linear**: pixel row y is at `$4000 | third<<11 | scanline<<8 | charrow<<5`
  (ROM PIXEL-ADD). `core/beam.ts` has `displayFileAddress`.
- Sync once per frame with `WaitCvc` on an invisible copper line (250) - no interrupts needed. For IM2,
  fill all 257 table bytes with one value (the vector at `I:$FF` straddles a pair).
- A label alone on a line binds to the next statement, even `.org` - use `Label .equ $` for end markers.
- Macro parameter names must not be register names (`h`, `l`, ...).
- Watch memory overlaps when laying out data in bank 5 (a 40x32 tilemap with attributes is 2560 bytes).
- Sprites: pattern bytes to port `$5B` after selecting with `$303B`; attributes to `$57` (5 bytes with attr 4).

`case.json` essentials: `capture` (frames), `expectIdenticalFrames` (static screen), `probes`
(`rect`, `bands`, `columns`, `pixel`, `colors`; colours as `#RRGGBB`, `ula:N`, `next8:0xNN`,
`rgb333:R,G,B`), `motion` (`firstRow`/`lastRow`/`colorAt` with `linear`/`sequence`/`constant`/`follows`),
`contactSheet`, `tiers` (`["headless","browser"]`), `knownFailures` (`{core?, oracle, name?, reason}`).

**Expectations come from hardware, never from emulator output.** Cite the VHDL in `expect.md`
(`_input/next-fpga/src`: `copper.vhd`, `video/zxula_timing.vhd`, `zxnext.vhd`). Geometry: copper line L
is buffer row `48 + L − $64`; WAIT H fires at buffer x `96 + 16H`; ULA pixels are 2 buffer pixels wide.
Horizontal edges get a 4-px probe margin (MOVE + palette pipeline delay).

## Known failures

Add one only after confirming the root cause in code, with the reason and a Findings reference. An
XFAIL never fails the run; an XPASS does - so an entry cannot outlive its bug, and an entry that passes
for the wrong reason (e.g. a comparison that is trivially true on a constant screen) is caught.

## AI review

`review.md` is the prompt: images, expectation, oracle results, rubric (describe first, then compare,
look beyond the probes) and the `verdict.json` format. A reviewer that did not write the expectation
is the better judge - delegate it. Approve only after a `pass` verdict; cores with a known failure are
never approved; `verdict.json` may carry per-core verdicts (`cores: { ts: "pass", wasm: "fail" }`) so a correct core can be approved while another shows a known bug. Proven: a 16x16 block planted into one PNG where no probe looks was caught by a blind review alone - reviewers must open every image, not just trust `rows-*.json`.

## Browser tier internals

- `cli/vite-host.cjs` is the single Vite instance: SSR for Node code, middleware for the page. Aliases
  mirror `build/electron.vite.config.ts`; `lodash` is aliased to `cli/lodash-shim.ts` because Vite's SSR
  runner rejects named imports from CommonJS lodash.
- `browser/http-messenger.ts` answers `createMainApi(messenger)` over `POST /api/session/:id/main/:method`,
  so `processFrameCommand` (SD sector I/O) and `getCodeInjectionFlow` run unchanged. Byte arrays travel
  as `{ __bytes: base64 }`. Only the SD methods in `server/sd-session.ts` `MAIN_METHODS` are exposed.
- The page snapshots key NextRegs at the ready point (`page-log.txt`) - the first place to look when
  the two tiers disagree.
- Playwright uses `channel: "chrome"`; no browser download is needed.
