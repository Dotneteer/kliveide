# Copper Visual Test Harness Plan

Created: 2026-09-17 · Revised: 2026-09-17 (Tier 2 redesigned: web server + Chrome instead of Electron)

Status: Implemented. Tier 1: 17 cases, both cores, ~45 s. Tier 2 (browser): the same 17 cases through a
real NextZXOS `.nexload` in the installed Chrome, ~45 s. Usage: `.ai/visual-tests-guide.md`.

**Moved 2026-09-17:** the harness is now the general ZX Spectrum Next test harness in
`test/harness/zxnext/` (see its `README.md`): `scripts/visual-tests/lib/` became `core/` (machines,
frames, assembler, loader, beam, colours, images) and `cases/` (case runner, oracles, browser tier);
`run`/`serve` are in `cli/`; the self-tests in `self-tests/`. Paths below that say `lib/` are historical.

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
(`test/harness/zxnext/core/beam.ts`, calibrated by C00).

## Test catalogue (implemented, both tiers)

| ID | What | TS | WASM (Tier 1 and browser) |
|---|---|---|---|
| T00 | pipeline sanity, no copper | pass | pass |
| C00 | calibration: WAIT(96) edge vs ULA row 96 | pass | pass |
| C01 | uploaded, never started | pass | pass |
| C02 | 8 palette bands | pass | pass |
| C03 | WAIT H staircase | pass | pass |
| C04 | palette writes reach the border | pass | pass |
| C05 | C02 via `$63` | pass | pass |
| C06 | NOP / HALT | pass | pass |
| C07 | `$64` line offset | pass | pass |
| C08 | mode 01 runs once | pass | pass |
| C09 | per-line `$26` scroll | pass | pass |
| C10 | per-line `$14` transparency | pass | pass |
| C11 | per-line `$68` ULA disable | pass | pass |
| D01 | bar moving 1 line/frame | pass | pass |
| D02 | colour cycle | pass | pass |
| D03 | mid-frame list rewrite lags a frame | pass | pass |
| D04 | copper + line interrupt | pass | pass |
| L01 | Layer 2 transparency: RGB vs `$14`, not index; `$4B` ignored | pass | pass |
| P01 | `$15` orders, Layer 2 priority bit, blend modes 6/7 per band | pass | pass |
| P02 | tilemap over/under ULA, transparent ULA, stencil | pass | pass |
| D05 | D01 over 3000 frames (`--long`) | pass | pass |

A known failure (XFAIL) never fails the run; the moment it starts passing it is XPASS and does.

## Implementation steps

### Tier 1 – done

1. `lib/compile-nex.ts` – assembler + `NexFileWriter`, re-parsed by the NEX viewer's parser.
2. `lib/load-nex-direct.ts` – banks, MMU, SP/PC through public port/memory APIs (both cores).
3. `lib/capture.ts` – pixel buffer → PNG, row summaries. `lib/machines.ts` runs a frame **the way
   `EmulatorPanel` does** (`executeMachineFrame` then `renderInstantScreen`).
4. `run.ts`/`run.cjs` – case discovery, outputs in `.visual-tests/<run>/`.
5. `lib/probes.ts`, parity, `identical`, known failures, golden hashes; mutation tests in
   `test/harness/zxnext/self-tests/harness.test.ts` prove every oracle fails on a planted defect.
6. `lib/review.ts` / `lib/golden.ts` – `review.md` (describe → compare → decide), `verdict.json`,
   `--approve`.
7–9. Cases above; `lib/motion.ts` (linear/sequence/constant/follows), contact sheets.

### Tier 2 – browser – done

Each step ended with a check that passed before the next (results in *Result* lines).

**B1. Server + page, direct load.** `test/harness/zxnext/cli/serve.cjs` starts a Vite dev server in
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
  raster regression tests in `test/harness/zxnext/self-tests/harness.test.ts` (mutation-tested: disabling the catch-up
  fails all three). Not raced: mid-frame writes to screen memory.
- **F2 – Copper horizontal origin and tick rate. FIXED 2026-09-17 (both cores).** The copper was fed
  the raw `hc` (paper x 0 at 144) instead of `hc_ula` (paper x 0 at 12), its line advanced at raw HC 0
  instead of at the `hc_ula` wrap, and it ticked once per HC instead of four times (28 MHz). WAITs fired
  132 px early. Fix: `NextComposedScreenDevice.copperHcAt/copperLineAt` (TS) and
  `zxnextCopperHcAt/zxnextCopperLineAt` (WASM) give the ULA beam; both machines tick the copper 4× per
  HC; `$1E/$1F` follow the same beam (the line interrupt keeps its raw-HC timing - F7). The WASM raster
  delays a `$26/$27` catch-up to the next 8-pixel ULA cell, matching the TS scroll latch. C03 now passes
  in both cores; C09's row-96 expectation was corrected (the first cell after a mid-line scroll write
  keeps the old scroll, per the `px` latch in zxula.vhd). 12 unit tests that encoded the raw-HC beam were
  rewritten to the hardware semantics, plus new boundary tests. Guarded by the C03 regression test
  (mutation-tested). `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.5b's claim that the counters were
  the genuine ULA `hc` is superseded by this.
- **F3 – Border ignored palette writes. FIXED 2026-09-17 (both cores).** TS refreshed its border colour
  cache only on a `$43` palette switch; WASM drew the border from a fixed Spectrum colour table. Fix: TS
  `PaletteDevice.updateUlaPalette` (already called after every `$41`/`$43`/`$44` write, but empty) now
  refreshes the cache; WASM draws border n with ULA palette entry 16+n (the raster already catches up on
  palette writes, so mid-frame changes show). C04 passes in both cores; T00/C01/C08 goldens unchanged
  (the default palette equals the old table). Guarded by unit tests in `test/zxnext/PaletteDevice.test.ts`
  and the C04 regression test (both mutation-tested). WASM still has no ULANext/ULA+ border (or paper)
  indices; TS uses 128+n / 200+n there.
- **F4 – `$14` global transparency for the ULA. FIXED 2026-09-17.** WASM drew ULA pixels whatever their
  colour; the TS core never let a *border* pixel match. Hardware: `ula_mix_transparent <= ...
  ula_rgb_2(8 downto 1) = transparent_rgb_2`, and `ula_rgb_2` includes the border. Fix: WASM
  `zxnextUlaVisibleColor` - every ULA/HiRes/HiColor/LoRes pixel and the border show the fallback colour
  when their upper 8 bits equal `$14` (later layers still draw over them); TS's four border paths now
  compare against `$14`. C10 passes and is byte-identical in both cores. Guarded by border tests in
  `test/zxnext/UlaDisableFallback.test.ts` and the C10 regression test (mutation-tested). WASM still has
  no real per-pixel compositor: layer priorities (`$15`), blend modes and stencil mode are not modelled.
- **F5 – `$68` bit 7 (ULA disable). FIXED 2026-09-17 (both cores).** TS skipped the ULA renderer while the
  sampled bit was set: the last ULA colour stayed on screen, and since sampling happens inside that
  renderer the bit could never clear. WASM kept a border-only frame. Hardware
  (`ula_transparent <= ... or ula_en_2 = '0'`, `ula_en` latched per pixel) makes the whole ULA layer -
  LoRes and border included - transparent. Fix: TS always runs the ULA/LoRes path and marks its pixels
  transparent while the live bit is set; WASM fills the ULA layer with the fallback colour (later layers
  still draw over it). Also fixed in both cores: the `$4A` fallback 8→9-bit expansion OR-ed B1 into the
  low bit (blue 10 became 110; now `B1 | B0`). C11 passes and is byte-identical in both cores. Guarded
  by `test/zxnext/UlaDisableFallback.test.ts` and the C11 regression test (all mutation-tested). Not
  changed: TS still resets `$4A` to `$00` (hardware `$E3`); blend modes that use the ULA colour while
  `ula_en = 0` (`ula_mix_rgb`) are not modelled.
- **F6 – WASM `$1E/$1F` always read 0. FIXED 2026-09-17.** The registers were stored reset values.
  They are now computed on read in `zxnextNextRegGetDirect`: the copper line (`$64` offset included) of
  the tact before `currentFrameTact`, mirroring `NextComposedScreenDevice.activeVideoLine`. D01–D03 now
  pass in WASM with all frames byte-identical to the TS core, D05 over 3000 frames; guarded by the D02
  regression test (mutation-tested).
- **F7 – Line interrupt. FIXED 2026-09-17 (both cores).** In pulse (non-hardware-IM2) mode both cores
  raised INT only for the ULA frame pulse: the `$22` bit 2 disable was ignored, and line interrupts never
  reached the CPU (TS captured them into a status flag nothing read; WASM never generated them at all,
  not even as status for hardware IM2 mode). Hardware (peripherals.vhd `o_pulse_en`, zxnext.vhd
  `pulse_int_n`): any enabled source starts the INT pulse; zxula_timing.vhd fires the line interrupt at
  `hc_ula = 255` of copper line `L - 1` (`c_max_vc` for 0), `$64` offset included. Fix: a line pulse as
  long as the ULA pulse at that position (`NextComposedScreenDevice.lineInterruptStartTact`,
  `zxnextVideoLineIntActive`); pulse-mode INT = (ULA pulse and not disabled) or (line pulse and enabled)
  or DMA; WASM now also sets the ULA/line status flags on the rising edges, as TS does. D04 turns red from
  exactly buffer row 192 in both cores. Guarded by `test/zxnext/NextInterrupts.test.ts` and the D04
  regression test (mutation-tested).
- **F8 – Layer 2 transparency. FIXED 2026-09-17 (both cores).** Hardware compares Layer 2's
  palette-mapped *RGB* with `$14` (zxnext.vhd `layer2_transparent <= ... layer2_rgb_2(8 downto 1) =
  transparent_rgb_2`; layer2.vhd has no transparency logic). The TS core compared the *palette index* with
  `$14`; the WASM core compared the index with `$4B` (the sprite transparency index). Fix: all Layer 2
  renderers (256x192, 320x256, 640x256, fast paths) look the entry up first and test its upper 8 bits
  against `$14`. New case L01 reprograms the Layer 2 palette so index and RGB differ and sets `$4B` to a
  used index; it passes and is byte-identical in both cores; in the regression tests, where reverting
  either core reproduces the original symptoms. L01 writes every palette entry it uses: the FPGA palette
  RAM has no reset contents (firmware fills it), so a test must not rely on default entries.
- **F9 – WASM layer compositing. FIXED 2026-09-17.** The WASM renderers painted RGBA straight into the
  picture in a fixed order (ULA, tilemap, Layer 2, sprites): `$15` layer order, the Layer 2 priority bit,
  blend modes, stencil mode and tilemap-over/under-ULA were ignored, and below-ULA tile pixels were
  dropped even where the ULA was transparent. Fix: each layer renders into its own 16-bit buffer
  (9-bit RGB + opaque, Layer 2 priority, tilemap-below and border flags) and `zxnextUlaCompose` mixes
  every pixel as zxnext.vhd stage 2 does - `ulatm`/stencil merge (with `$68` bit 7 applied there, not to
  the blend operand), the `$68` blend-source cases, the six orders with the priority bit, modes 110/111
  (clamp / minus 5), and the LUS/USL/ULS border exception for sprites. Fast path when only the ULA can be
  opaque; 9-bit→RGBA through a table. Cost: ULA-only 0.77 ms/frame, all layers ~2.3-2.7 ms.
  New cases P01 (orders, priority bit, blend 6/7 switched per band by the copper) and P02 (tilemap over/
  under the ULA, transparent ULA, stencil) pass and are byte-identical in both cores.
  **TS fixes found by these cases:** (1) in blend modes a lone ULA pixel showed instead of the fallback
  (the ULA is only the `mix_rgb` operand) - `composeSinglePixel` now follows the VHDL order, and 6 unit
  tests that derived their expected pixel from the old behaviour now derive it via the SLU path;
  (2) `composeSinglePixel` re-expanded `$4A` with the old blue-bit bug - it uses the fixed cache;
  (3) the tilemap render caches were only computed on a tilemap scroll write, so after reset a tilemap
  never rendered (every row at NaN) - refreshed on reset, `$1B`, `$6C` and timing changes;
  (4) stencil mode ignored the border outside the tilemap's 320-pixel area. Not modelled in TS: the
  tilemap-specific `$68` blend-source cases (TS merges the tilemap into the ULA before composing) and the
  sprite-over-border exception. Guarded by P01/P02 regression tests (mutation-tested).
- **Assembler:** `.ent` was ignored in NEX output under `.model Next` (entry forced to `$8000`). FIXED
  2026-09-17 - see `.plans/ZX_NEXT_EMULATOR_BUGS_HANDOVER.md` B1. The test programs still keep their
  code at `$8000`, which remains valid.
- **Harness lessons:** the IM2 table must hold one repeated byte (vector at `I:$FF` straddles pairs);
  a hanging label before `.org` binds to the new origin (use `Label .equ $`).
