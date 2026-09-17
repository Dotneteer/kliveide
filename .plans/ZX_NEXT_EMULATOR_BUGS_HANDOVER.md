# ZX Spectrum Next Emulator – Bug Handover

Created: 2026-09-17, at the end of a session that built the visual test harness and fixed nine emulator
bugs with it. This file is written for a **new AI session** picking up the remaining work.

## Read first

1. `AGENTS.md`, then `.ai/visual-tests-guide.md` – how to run and write visual (pixel) tests.
2. `.plans/COPPER_VISUAL_TEST_HARNESS_PLAN.md` – design, hardware facts, and the *Findings* section with
   the full story of every fixed bug (F1–F9).
3. The FPGA source is the reference: `_input/next-fpga/src` (`zxnext.vhd`, `video/zxula_timing.vhd`,
   `video/zxula.vhd`, `video/tilemap.vhd`, `video/layer2.vhd`, `copper.vhd`, `peripherals.vhd`).

The two emulator cores must behave the same: **TypeScript** (`src/emu/machines/zxNext/`, the reference
and parity oracle) and **WASM** (`src/emu/machines/zxNext/wasm/zxnext/*.c`, unity build via `zxnext.c`,
the production default). Rebuild WASM after any C change: `npm run build:zxnext-wasm` (the visual runner
refuses a stale artifact).

## How to verify any fix

```bash
npm run build:zxnext-wasm                                   # after C changes
npm run test:visual                                         # headless tier, both cores (~50 s)
npm run test:visual -- --tier browser                       # WASM in the installed Chrome, real .nexload
npm test -- --project node test/harness/zxnext test/zxnext-hw test/wasm test/zxnext test/z80   # ~10,900 tests
npm run build:check                                         # must say "No new type errors"
```

Working rules that paid off in the previous session:

- **Expectations come from the VHDL, never from emulator output.** Cite the signal in `expect.md`.
- **Write the failing test first** (a visual case under `test/visual/copper/` or a unit test), watch it
  fail for the predicted reason, then fix.
- **Mutation-test the guard:** revert the fix, confirm the test fails with the original symptom,
  restore. Twice a regression test "caught" a revert for the wrong reason (e.g. it captured a frame before
  the program was ready).
- When a fix makes a known failure pass, the run reports **XPASS** – remove that `knownFailures` entry.
- Test programs must not assume reset values (NextZXOS changes `$43`, `$07`, `$15`), must write every
  palette entry they use (FPGA palette RAM has no reset contents).

## State of the working tree

At handover the last commit is `43625eae9 wip: Prepare to test Copper`. The fixes for F1–F9 below and
their tests are **uncommitted** (modified: `PaletteDevice.ts`, `ZxNextMachine.ts`,
`NextComposedScreenDevice.ts`, `zxnext-copper.c`, `zxnext-cpu.c`, `zxnext-nextreg.c`, `zxnext-ula.c`,
several `test/zxnext/*.test.ts`, `test/wasm/zxNext/wasm-next-full-matrix.test.ts`,
`test/harness/zxnext/self-tests/harness.test.ts`, case files; new: cases `L01`, `P01`, `P02`). Everything passed at
handover: 20/20 visual cases in both tiers, 318 test files / 10,921 tests, no new type errors.

---

## Open bugs

Ordered by likely impact. "Verified" means the discrepancy was confirmed by reading both the emulator
code and the VHDL; the *visible* effect has not been demonstrated by a test unless stated.

### B1 – Assembler ignores `.ent` for NEX output under `.model Next` – FIXED 2026-09-17

- **Fixed:** `applyNextDefaults()` now only enables Next auto mode; `applyNextAutoModeFinalDefaults()`
  runs after assembly and fills the entry address (`.savenex entryaddr` > `.ent` > `$8000`) and the border
  (7 unless `.savenex border` gave a value). Regression tests in `test/z80-assembler/savenex.test.ts` and
  `nex-file-writer.test.ts` (the `.ent` ones fail on the old code). An explicit `.savenex border 0` was
  in fact not overridden before either - `.model` is processed at parse time, before the pragmas - but it
  no longer depends on that ordering. The history below is kept for reference.
- **Symptom:** a NEX built from source whose entry label is not at `$8000` starts at `$8000` anyway.
  Reproduced while writing test programs: `output.entryAddress` was `$8046`, the NEX header PC `$8000`.
- **Cause:** `applyNextDefaults()` in `src/main/compiler-common/common-assembler.ts:861` pre-sets
  `nexConfig.entryAddr = 0x8000` when `.model Next` is processed; `NexFileWriter.fromAssemblerOutput`
  (`src/main/z80-compiler/nex-file-writer.ts:358`) prefers `config.entryAddr` over `output.entryAddress`,
  so `.ent` never wins.
- **Fix direction:** precedence `.savenex entryaddr` > `.ent` > `$8000` default – apply the default in
  the writer only when neither is set. Also check the similar `borderColor === 0 → 7` default does not
  override an explicit `.savenex border 0`.
- **Test:** `test/z80-assembler/savenex.test.ts` / `nex-file-writer.test.ts` – a program with a helper
  routine before `Start: .ent $` must produce header PC = `Start`. After the fix, the visual test
  programs could put `#include "../_include/copper-routines.z80asm"` anywhere.

### B2 – WASM SD card "config mode" is read from NextReg `$14` bit 7 (verified code discrepancy)

- **Where:** `src/emu/machines/zxNext/wasm/zxnext/zxnext-sd.c:158`:
  `configMode = (zxnextNextRegs[0x14] & 0x80u) != 0`.
- **Why it is wrong:** `$14` is the global transparency colour (reset `$E3`, so bit 7 is set by default).
  Hardware config mode is `nr_03_config_mode` (zxnext.vhd ~5124–5128: set when `$03` low bits are `111`,
  cleared for other non-zero values). The TypeScript core uses `nextRegDevice.configMode`
  (`SdCardDevice.ts:175`), derived from `$03`.
- **Likely effect:** the SPI chip-select value `$7F` (FPGA flash) is accepted whenever `$14` has bit 7 set
  – i.e. by default – instead of only in config mode (or with reset type bit 2). Also any program that
  sets a transparency colour below `$80` changes SD/flash chip-select behaviour.
- **Fix direction:** mirror the TS `configMode` state from `$03` writes in the WASM NextReg handler and use
  it here. **Test:** a WASM-vs-TS unit test writing `$E7 = $7F` with `$14 = $E3` and `$03` not in config
  mode; the SD/flash selection must match the TS core.

### B3 – `$4A` fallback colour resets to `$00` in both cores (verified)

- **Where:** TS `src/emu/machines/zxNext/NextRegDevice.ts:3234` (`directSetRegValue(0x4a, 0x00)`), WASM
  `zxnext-nextreg.c:36` (`zxnextNextRegs[0x4a] = 0x00`).
- **Hardware:** `nr_4a_fallback_rgb <= X"E3"` (zxnext.vhd:4992; the `X"00"` line above it is commented out).
- **Effect:** after reset, wherever no layer is opaque (transparent ULA via `$14`, `$68` bit 7, blend-mode
  gaps, stencil gaps) the screen shows black instead of magenta `#FF00FF`. Firmware/NextZXOS may set
  `$4A` itself, so the visible impact under `.nexload` may be small; direct loads and machine resets show it.
- **Careful:** unit tests may assert `$00`; check `test/zxnext/NextRegDevice.test.ts` and the WASM
  NextReg tests. The existing visual cases set `$4A` explicitly, so they are unaffected.

### B4 – Copper `$60` does not latch the stored byte (verified, both cores)

- **Where:** TS `CopperDevice.ts:70` (`set nextReg60Value`), WASM `zxnext-copper.c:60` (`case 0x60u`).
- **Hardware:** zxnext.vhd ~5395–5398: a `$60` write at an **even** copper address also sets
  `nr_copper_data_stored`, which a following `$63` write at the odd address commits as the MSB
  (`copper_msb_dat <= ... nr_copper_data_stored`, ~3957).
- **Effect:** a program that writes the MSB with `$60` and the LSB with `$63` gets a wrong instruction
  (the MSB is whatever `$63` last stored). Pure `$60` or pure `$63` uploads (cases C02, C05) are unaffected.
- **Test:** a copper unit test (both cores) writing `$61=0; $60=hi; $63=lo` and checking copper RAM, plus
  optionally a visual variant of C05.

### B5 – WASM reset clears copper list RAM (verified, low impact)

- **Where:** `zxnext-copper.c:54` (`zxnextCopperMemory[i] = 0u` in `zxnextCopperReset`).
- **Hardware:** copper list RAM (`dpram2`) is not cleared by reset; only pointer, mode, write address,
  stored byte and `$64` are (copper.vhd 60–65, zxnext.vhd ~4998–5002). The TS core does not clear it.
- **Effect:** a soft reset in WASM loses a copper list the TS core (and hardware) keeps – a TS/WASM
  divergence visible to anything that restarts the copper after reset without re-uploading.

### B6 – TypeScript blend modes: gaps against the VHDL (verified by reading; no test yet)

In `NextComposedScreenDevice.composeSinglePixel` (`~1287`) and the ULA/tilemap merge before it:

1. **`$68` blend-source cases for the tilemap** (zxnext.vhd `case ula_blend_mode_2`, ~7086–7124):
   the TS core merges the tilemap into the ULA before composing, so the `00`/`11`/`01` cases – tilemap
   above or below the blend, tilemap as the blend operand – are not modelled. The WASM core
   (`zxnextUlaCompose` in `zxnext-ula.c`) implements them.
2. **`$68` bit 7 in blend modes:** hardware blends `ula_mix_rgb`, which ignores `ula_en`; TS marks the
   ULA transparent (`if (this.ulaDisableOutput)` block, `~786`), so a disabled ULA stops contributing to
   the blend. WASM keeps them separate (`ulaT = ulaMixT || !ulaEn`, `zxnext-ula.c:1179`).
3. **Sprite over border in LUS/USL/ULS:** hardware lets a sprite show over an opaque ULA border pixel
   when the tilemap is transparent (`not (ula_border_2 = '1' and tm_transparent = '1' and
   sprite_transparent = '0')`); TS does not. WASM does.

- **Test:** extend `P01`/`P02` or add `P03` with a tilemap in blend modes, `$68` bit 7 during a blend band,
  and a sprite over the border (needs `$15` bit 1 "sprites over border") in LUS/USL/ULS. The TS core will
  fail these today; the WASM core should pass (verify – it has never been exercised).

### B7 – WASM has no ULANext / ULA+ palette indexing (verified)

- **Where:** `zxnextUlaAttrPaletteIndex` (`zxnext-ula.c:165`) and the border lookup in
  `zxnextUlaRenderInstantScreen` always use the standard paper/ink indices (paper/border 16+n).
- **Hardware / TS:** ULANext uses the `$42` ink mask and paper/border from 128+n (format `$FF`: paper and
  border use the fallback); ULA+ uses indices from 192 (border 200+n) – check zxula.vhd ~500–553 for the
  exact paper/ink formulas before writing expectations. TS implements these
  (`updateBorderRgbCache`, attribute decode tables).
- **Effect:** any program using ULANext or ULA+ colours renders wrong colours in the production core.
- **Test:** a visual case per mode, expectations from zxula.vhd (~500–553).

### B8 – WASM raster: only some mid-frame state is raced (known limitation)

The beam-racing raster (F1 fix) renders the frame lazily, catching up before writes that change the
picture (`zxnextRasterIsVideoNextReg`, `zxnext-ula.c:1519`, and the port list in `zxnext-ports.c`).

- **Screen memory writes are not raced:** a program that changes bitmap/attribute/Layer 2/tilemap memory
  mid-frame (e.g. a "racing the beam" effect, or a multicolour engine) sees the *later* memory for the
  whole not-yet-rendered part of the frame. TS renders tact by tact and shows the change at the right line.
- **ULA register sampling delay is modelled only for scroll:** `$26/$27` writes are delayed to the next
  8-pixel cell (`zxnextRasterUlaScrollTact`, `:1494`), matching the TS latch. The other values the TS
  core samples at the same time (`sampleNextRegistersForUlaMode`: `$68` half-pixel scroll, port `$FF`
  HiRes/HiColor mode, LoRes enable) switch immediately in WASM – a few pixels of difference at a mid-line
  change.
- **Fix direction:** memory writes to the screen banks could call the catch-up (hot path – measure);
  sampled registers could reuse `zxnextRasterUlaScrollTact`.
- **Test:** a visual case writing attribute memory from a line interrupt (D04-style) and a mid-line
  HiColor switch.

### B9 – Copper MOVE latency is one tick short (reported by a VHDL read-through; not re-verified)

- TS `CopperDevice.executeTick` outputs a MOVE on the tick after the fetch; hardware writes on the second
  tick after it (copper.vhd `copper_dout` → zxnext.vhd `copper_req` latch → NextReg write). With 4 ticks
  per pixel this is a quarter-pixel difference – invisible in the current cases (4-px probe margins), but it
  changes exactly where a long run of MOVEs lands. WASM mirrors TS. Low priority.

### B10 – Dead code with a wrong mask: `TilemapDevice.nextReg6eValue/6fValue` (verified dead)

- `src/emu/machines/zxNext/TilemapDevice.ts:138–155` masks the tilemap/tile-definition address MSB to 5
  bits (`& 0x01f`); hardware keeps 6 (zxnext.vhd ~5445–5446, tilemap.vhd:57 "5:0 are offsets into 16K").
- Nothing uses these setters – NextReg `$6E/$6F` (`NextRegDevice.ts ~1601–1631`) go to the screen
  device's correct 6-bit fields. Delete or fix so nobody wires them up later.

### B11 – `EmulatorPanel` renders an instant screen after every frame (performance, not correctness)

- `src/renderer/features/emulator/EmulatorPanel.tsx:234` calls `machine.renderInstantScreen()` on every
  full frame to keep a "saved pixel buffer" for the pause overlay. For the WASM core that is now a second
  full render per frame on top of the raster (not measured separately). Consider rendering it only when
  pausing.

---

## Fixed in the previous session (uncommitted) – for context

Details, VHDL references and tests for each are in the plan's *Findings*.

| ID | Bug | Cores |
|---|---|---|
| F1 | WASM drew each frame from end-of-frame state: no mid-frame copper effects | WASM – beam-racing raster |
| F2 | Copper WAIT used raw `hc` (132 px early), one tick per HC; `$1E/$1F` line changed at raw HC 0 | both |
| F3 | Palette writes did not reach the border | both |
| F4 | `$14` global transparency ignored for ULA (WASM) / border (TS) | both |
| F5 | `$68` bit 7 stuck (TS) / border-only frame (WASM); `$4A` 8→9-bit blue expansion | both |
| F6 | WASM `$1E/$1F` always read 0 | WASM |
| F7 | Line interrupt never reached the CPU; `$22` bit 2 ULA-interrupt disable ignored; WASM set no ULA/line status for HW IM2 | both |
| F8 | Layer 2 transparency compared index with `$14` (TS) / with `$4B` (WASM) instead of RGB with `$14` | both |
| F9 | WASM fixed-order layer painting (no `$15`, L2 priority, blend, stencil, tilemap-below); TS blend gap, TS tilemap caches not initialised after reset, TS stencil outside tilemap | WASM + TS |

## Housekeeping (not bugs)

- Golden hashes are approved only for T00, C01, C08 (both cores) and T00 (browser). All other cases now
  pass but were never AI-reviewed after the fixes: run both tiers, have a *separate* agent review every
  `review.md` (describe first, then compare), then `npm run test:visual -- --approve <ids>` (add
  `--tier browser` for browser results).
- The emulator changes above are not covered by `CHANGELOG.md` yet.
