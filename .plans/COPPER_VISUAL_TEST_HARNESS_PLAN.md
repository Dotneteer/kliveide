# Copper Visual Test Harness Plan

Created: 2026-09-17 · Revised: 2026-09-17 (Tier 2 redesigned: web server + Chrome instead of Electron)

Status: Implemented. Tier 1: 17 cases, both cores, ~45 s. Tier 2 (browser): the same 17 cases through a
real NextZXOS `.nexload` in the installed Chrome, ~45 s. Usage: `.ai/visual-tests-guide.md`.

## Goal

Prove that the ZX Spectrum Next **Copper** works *as seen on screen*. A test is a small Z80N program
(Klive assembler, `.savenex`) compiled to `.nex`, run for a known number of frames, captured as PNG,
and judged by **three oracles**:

1. **Probes** – exact pixel assertions whose expected values come from the FPGA source
   (`_input/next-fpga`) and hardware docs, never from emulator output.
2. **Parity** – between cores (TypeScript vs WASM) and between tiers (direct load vs real `.nexload`).
3. **AI review** – Claude reads the PNGs / contact sheets with a written `expect.md`, describes first,
   compares second, and writes `verdict.json`. Approved frames become golden hashes.

Static screens first (identical for hundreds of frames), then dynamic ones (changing every frame).

## Architecture

```
 test/visual/copper/<case>/            program.asm · case.json · expect.md · golden.json
 test/visual/copper/_include/          copper-macros.z80asm · copper-routines.z80asm

 Tier 1 (headless, Node)               npm run test:visual -- [cases]
   Vite SSR → both cores in-process, test-only direct NEX loader, exact frames.

 Tier 2 (browser)                      npm run test:visual -- --tier browser [cases]
   ┌──────────── web server (Node) ────────────┐        ┌────────── Chrome page ──────────┐
   │ the "main process" part:                  │  HTTP  │ the "emulator" part:            │
   │ • Z80 assembler → .nex                    │◄──────►│ • ZxNextWasmV2Machine (WASM)    │
   │ • SD card image: per-session clone,       │        │ • frame loop, deterministic     │
   │   sector read/write, info                 │        │ • NextZXOS boot + .nexload flow │
   │ • .nex copied onto the card (FAT32)       │        │   interpreted in *frames*       │
   │ • ROM/WASM/static files, Vite for the page│        │ • pixel buffer → canvas + POST  │
   │ • oracles, PNGs, review.md                │        │   (audio samples: future)       │
   └───────────────────────────────────────────┘        └─────────────────────────────────┘
                     ▲ Playwright drives the page in the installed Chrome (channel "chrome")
```

No IDE renderer: it only orchestrates, and the page does that itself. No Electron.

### Why this shape

- `ZxNextWasmV2Machine` already runs in a renderer; its `.wasm` comes through an injectable
  `readArtifact`, its ROMs through the `FILE_PROVIDER` machine property.
- SD access happens through **frame commands** (`sd-read`/`sd-write`) answered via
  `createMainApi(messenger)`. The page passes an HTTP messenger; the server hosts the same FAT32/CIM
  code main uses (`src/main/fat32/*`, Electron-free).
- The app's launch flow (`ZxNextMachine.getCodeInjectionFlow`: boot, menu, `.nexload <path>`) is data.
  `MachineController` paces it in wall-clock milliseconds; the page interprets the same steps in
  **frames** (50 fps), which makes the real `.nexload` path deterministic.
- The developer's `~/Klive/ks2.cim` is never written: every session works on a clone.

## Hardware facts used (verified against the VHDL)

- WAIT fires when `cvc == line` and `hc_ula >= H*8+12` (copper.vhd); `hc_ula = paper x + 12`
  (zxula_timing.vhd), so the change is at **paper x = 8H**.
- `cvc` is loaded with `$64` at the first paper line and wraps after 310 (+3/128K timing): copper line
  L is paper row `L − $64`. MOVE writes `$00–$7F`; register 0 is a NOP; `$FFFF` never matches.
- `$62` modes: 00 stop, 01 reset-and-run, 10 run, 11 reset-and-run + restart at cvc 0 each frame.
  `$63`: even address latches, odd address commits MSB-first.
- Palette lookups are per pixel; PAPER n and BORDER n use entry 16+n; `$41` expands `v & (v1|v0)`.
- `$68` bit 7 makes the whole ULA (border included) transparent → `$4A` fallback; `$4A` resets to `$E3`.
- `$26` scroll is sampled every 8 pixels; `$1E/$1F` read cvc.
- The display file is **not linear**: `$4000 | third<<11 | scanline<<8 | charrow<<5 | column`.

Klive buffer (720×288): paper row r = buffer row 48+r, paper x = buffer x 96+2x
(`scripts/visual-tests/lib/beam.ts`, calibrated by C00).

## Test catalogue (implemented, Tier 1)

| ID | What | TS | WASM (Tier 1 and browser) |
|---|---|---|---|
| T00 | pipeline sanity, no copper | pass | pass |
| C00 | calibration: WAIT(96) edge vs ULA row 96 | pass | pass |
| C01 | uploaded, never started | pass | pass |
| C02 | 8 palette bands | pass | pass |
| C03 | WAIT H staircase | XFAIL F2 | XFAIL F2 |
| C04 | palette writes reach the border | XFAIL F3 | XFAIL F3 |
| C05 | C02 via `$63` | pass | pass |
| C06 | NOP / HALT | pass | pass |
| C07 | `$64` line offset | pass | pass |
| C08 | mode 01 runs once | pass | pass |
| C09 | per-line `$26` scroll | pass | pass |
| C10 | per-line `$14` transparency | pass | XFAIL F4 |
| C11 | per-line `$68` ULA disable | XFAIL F5 | XFAIL F5 |
| D01 | bar moving 1 line/frame | pass | XFAIL F6 |
| D02 | colour cycle | pass | XFAIL F6 |
| D03 | mid-frame list rewrite lags a frame | pass | XFAIL F6 |
| D04 | copper + line interrupt | XFAIL F7 | XFAIL F7 |
| D05 | D01 over 3000 frames (`--long`) | pass | XFAIL F6 |

A known failure (XFAIL) never fails the run; the moment it starts passing it is XPASS and does.

## Implementation steps

### Tier 1 – done

1. `lib/compile-nex.ts` – assembler + `NexFileWriter`, re-parsed by the NEX viewer's parser.
2. `lib/load-nex-direct.ts` – banks, MMU, SP/PC through public port/memory APIs (both cores).
3. `lib/capture.ts` – pixel buffer → PNG, row summaries. `lib/machines.ts` runs a frame **the way
   `EmulatorPanel` does** (`executeMachineFrame` then `renderInstantScreen`).
4. `run.ts`/`run.cjs` – case discovery, outputs in `.visual-tests/<run>/`.
5. `lib/probes.ts`, parity, `identical`, known failures, golden hashes; mutation tests in
   `test/visual/harness.test.ts` prove every oracle fails on a planted defect.
6. `lib/review.ts` / `lib/golden.ts` – `review.md` (describe → compare → decide), `verdict.json`,
   `--approve`.
7–9. Cases above; `lib/motion.ts` (linear/sequence/constant/follows), contact sheets.

### Tier 2 – browser – done

Each step ended with a check that passed before the next (results in *Result* lines).

**B1. Server + page, direct load.** `scripts/visual-tests/serve.cjs` starts a Vite dev server in
middleware mode (same aliases as Tier 1) plus `/api` routes. `browser/index.html` + `browser/page.ts`
create the WASM machine (artifact and ROMs fetched from the server), load a case's `.nex` with the
same direct loader, run frames, paint a canvas.
*Check:* open `http://localhost:<port>/?case=T00` in Chrome – red border, yellow paper; the page's
frame hash equals Tier 1's WASM hash for frame 50.
*Result:* `bc3a98d692bc8591` in both; 258 ms.

**B2. SD card over HTTP.** Server: `POST /api/session` clones `~/Klive/ks2.cim` into a temp folder
(copy-on-write); `/api/session/:id/main/<method>` implements `readSdCardSector`,
`writeSdCardSector`, `getSdCardInfo`, `hasNextAutoExec` with `CimHandler`/`Fat32Volume`. Page: an
`HttpMessenger` (a `MessengerBase`) so the machine's own `processFrameCommand` works unchanged.
*Check:* the page boots NextZXOS to ROM0 `$1202` and shows the boot menu; the real card image's
mtime is unchanged.
*Result:* boot menu idle after 111 frames, 320 sector reads, 1.1 s; mtime unchanged. Needed an ESM
shim for `lodash` (Vite SSR rejects named imports from CommonJS).

**B3. Real `.nexload`, in frames.** Server: `POST /api/session/:id/nex` compiles the case and copies
the `.nex` onto the session card (the `copyToSdCard` code path). Page: interprets
`getCodeInjectionFlow` steps – `ReachExecPoint` (termination point), `Wait`/`QueueKey.wait` as
`ms/20` frames, `WaitIdle` as N consecutive frames with PC in range, `WaitKeyQueue` until the queue
is empty – then runs until the ready marker ($A5 in `$7F`).
*Check:* T00 via `.nexload` reaches ready; frame hash equals the direct-load hash (or the difference is
recorded under Findings as loader state).
*Result:* `.nexload` typed at frame 312, ready at 324, T00 hash identical. C02 differed: NextZXOS leaves
`$43=$20` (palette writes go to the sprite palette), `$07=$33`, `$15=$01`. The test programs assumed
reset values - fixed in `ClearScreen`, after which every static case matches Tier 1.

**B4. Driver + oracles.** `--tier browser` starts the server, launches the installed Chrome through
Playwright (`channel: "chrome"`, headless), opens `?case=<id>&mode=nexload`, waits for the page's
result, and runs the same probes / known failures (core `wasm`) on the returned frames. Extra
oracles: `headless` (static screens: page frame vs Tier 1 WASM frame) and `canvas` (coarse
screenshot of the canvas vs the pixel buffer). Writes `browser/review.md` per case.
*Check:* T00, C00, C02, D01 produce the same verdicts as Tier 1's WASM core.
*Result:* identical; then all 17 cases were tagged `browser` and pass with the same known failures.
The `canvas` oracle has its own mutation test (a negated canvas fails).

**B5. Frame sequences in the browser.** Frames are counted from the ready marker, so motion specs and
contact sheets work unchanged.
*Check:* D01 contact sheet from the browser tier; motion oracle results match Tier 1 WASM.
*Result:* same XFAILs as Tier 1 WASM (F6 stops the program's per-frame sync in WASM).

**B6. Interactive mode.** `npm run visual:serve` keeps the server up; the page lists cases (nexload or
direct), runs one, paints the boot and the captured frames, and logs the flow, the NextReg snapshot at
ready and the SD calls. Oracles stay in the CLI (`--tier browser`, `--headed` to watch).

**B7. Docs.** `.ai/visual-tests-guide.md` (indexed in `.ai/README.md`, pointed to from `AGENTS.md`).

**Future.** Audio: the page already owns the machine; `getAudioSamples()` per frame → server → WAV +
spectral probes.

## Findings

Emulator behaviour that disagrees with the hardware, found by the cases above. Each XFAIL cites one.

- **F1 – WASM rendered whole frames. FIXED 2026-09-17.** `zxnextUlaRenderInstantScreen` drew once per
  frame from end-of-frame state, so every mid-frame copper effect was invisible in the production core.
  Fix: a beam-racing raster in `zxnext-ula.c`. Every renderer honours a render target and a buffer-row
  window; before a write to a video NextReg (list in `zxnextRasterIsVideoNextReg`; the copper passes its
  own tact) or a video port (`$FE` border change, `$FF`, `$7FFD/$DFFD/$1FFD`, `$123B`, sprite ports), the
  rows between the last catch-up and the beam are rendered into a scratch buffer with the old state and
  the exact pixel span is copied; frame completion renders the rest. Tact → pixel follows the TS
  tact-to-bitmap table (VC 16, HC 96, 2 px per HC). Result: WASM frames are now byte-identical to the TS
  core in C00, C02, C03, C05, C06, C07, C09 and D04; 5548 existing ZX Next tests pass; worst case
  measured (a palette change on each of 192 lines) 1.05 ms/frame vs 0.64 ms without copper. Guarded by
  raster regression tests in `test/visual/harness.test.ts` (mutation-tested: disabling the catch-up
  fails all three). Not raced: mid-frame writes to screen memory.
- **F2 – TS copper horizontal origin.** The copper is ticked with the raw `hc` instead of `hc_ula`:
  WAITs fire 132 px early (edge at buffer x `16H−164` instead of `96+16H`). Also 1 copper tick per
  pixel instead of 4.
- **F3 – Border ignores palette writes.** TS refreshes the border cache only on a `$43` palette switch;
  WASM uses a fixed Spectrum colour table for the border.
- **F4 – WASM ignores `$14` for the ULA.**
- **F5 – `$68` bit 7.** TS: once set, never re-sampled (cannot be re-enabled). WASM: border-only frame
  instead of the fallback colour. Also TS resets `$4A` to `$00` (hardware `$E3`).
- **F6 – WASM `$1E/$1F` always read 0.** Programs that sync on the active line hang.
- **F7 – Line interrupt (D04).** The handler runs once per frame at copper line ~248 (the ULA frame
  interrupt, although `$22` bit 2 was set) and never on line 144; TS reads `$22` back without bit 2.
  Needs investigation.
- **Assembler:** `.ent` is ignored in NEX output under `.model Next` (entry forced to `$8000`) – the
  test programs keep their code at `$8000`; flagged as a separate task.
- **Harness lessons:** the IM2 table must hold one repeated byte (vector at `I:$FF` straddles pairs);
  a hanging label before `.org` binds to the new origin (use `Label .equ $`).
