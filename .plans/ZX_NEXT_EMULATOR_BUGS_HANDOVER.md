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
npm test -- --project node test/harness/zxnext test/zxnext-hw test/wasm test/zxnext test/z80 test/emu   # ~11,100 tests
npx vitest run --config build/vitest.config.ts --project jsdom   # ~1,080 tests (npm test -- --project jsdom finds none)
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

## Status (2026-09-17, second session)

| ID | Bug | Status | Test |
|---|---|---|---|
| B1 | Assembler ignored `.ent` in NEX output | FIXED | `test/z80-assembler/savenex.test.ts` |
| B2 | WASM flash chip select used `$14` bit 7 / written `$02` | FIXED (WASM) | `test/zxnext-hw/sd/spi-flash-select.test.ts` |
| B3 | `$4A` reset `$00`; WASM soft reset kept all NextRegs | FIXED (both) | `test/zxnext-hw/nextreg/fallback-colour-reset.test.ts`, `soft-reset.test.ts` |
| B4 | Copper stored byte (`$60` even, `$63` odd) | FIXED (both) | `test/zxnext-hw/copper/copper-upload.test.ts` |
| B5 | WASM reset cleared copper list RAM | FIXED (WASM) | same |
| B6 | TS blend sources, `$68` bit 7 in blends, sprite over border | FIXED (TS) | `test/zxnext-hw/layers/blend-and-border.test.ts` |
| B7 | WASM ULANext / ULA+ palette indexing | FIXED (WASM) | `test/zxnext-hw/ula/ulanext-ulaplus.test.ts` |
| B8 | WASM raster ignored screen memory writes | MEMORY FIXED; sampled registers open | `test/zxnext-hw/ula/midframe-memory-write.test.ts` |
| B9 | Copper MOVE write one tick early | VERIFIED, deferred (needs a hardware capture) | - |
| B10 | Dead tilemap setters with a 5-bit mask | FIXED (deleted) | `test/zxnext-hw/nextreg/tilemap-base-address.test.ts` |
| B11 | Panel re-rendered the screen every frame | FIXED (23-38% of frame time) | all visual goldens unchanged |
| B12 | WASM ULA+ ports; TS 9th bit and palette select | FIXED (both) | `test/zxnext-hw/ula/ulaplus-ports.test.ts` |

Every test was written first and seen failing for the predicted reason on the predicted core. All
fixes were verified together: 11,072 node tests + 1,079 jsdom tests, both visual tiers with every golden
approved and matching (see *Housekeeping*), `npm run build:check` clean. New tests use the harness in
`test/harness/zxnext/` (`README.md`) and live in `test/zxnext-hw/`. **Nothing is committed yet.**

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

### B2 – WASM SD card "config mode" is read from NextReg `$14` bit 7 – FIXED 2026-09-17

- **Fixed:** the WASM core now keeps `nr_03_config_mode` (set by `111` in `$03`'s low bits, cleared by
  any other non-zero value, off after every reset like the TS core) and `nr_02_reset_type` (`100` at
  power-on, shifted on each soft reset) in `zxnext-nextreg.c`; `zxnextSdSpiCsWrite` accepts `$7F` only
  when either allows it. **Second part found while fixing:** WASM also took the reset-type bit from the
  last value *written* to `$02`, so after power-on it refused `$7F` that hardware accepts, and a `$02`
  write could enable it. Test: `test/zxnext-hw/sd/spi-flash-select.test.ts` (WASM only - port `$E7` is
  write-only and no core emulates the flash chip, so it reads the core's chip-select latch export; both
  tests failed before the fix). The history below is kept for reference.

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

### B3 – `$4A` fallback colour resets to `$00` in both cores – FIXED 2026-09-17

- **Fixed:** both cores reset `$4A` to `$E3`. **Found while fixing:** the WASM *soft* reset did not reset
  any NextReg value (`$14`, `$42`, `$4A`, the MMU `$50-$57` kept whatever was written); new
  `zxnextNextRegSoftReset` restores the values the VHDL `reset` branches assign, mirroring TS
  `NextRegDevice.reset/commonReset`. Tests: `test/zxnext-hw/nextreg/fallback-colour-reset.test.ts`
  (register and a magenta screen with the ULA disabled; failed on both cores before) and
  `soft-reset.test.ts` (22 registers against the VHDL values; failed on WASM before). Two existing
  tests asserted the bug and were corrected: `test/zxnext/NextRegDevice.test.ts` (`$4A` = `$00`) and
  `test/wasm/zxNext/wasm-next-screen-ula.test.ts` (clipped pixels black instead of the fallback
  colour). No visual golden changed: the cases set `$4A` themselves.

- **Where:** TS `src/emu/machines/zxNext/NextRegDevice.ts:3234` (`directSetRegValue(0x4a, 0x00)`), WASM
  `zxnext-nextreg.c:36` (`zxnextNextRegs[0x4a] = 0x00`).
- **Hardware:** `nr_4a_fallback_rgb <= X"E3"` (zxnext.vhd:4992; the `X"00"` line above it is commented out).
- **Effect:** after reset, wherever no layer is opaque (transparent ULA via `$14`, `$68` bit 7, blend-mode
  gaps, stencil gaps) the screen shows black instead of magenta `#FF00FF`. Firmware/NextZXOS may set
  `$4A` itself, so the visible impact under `.nexload` may be small; direct loads and machine resets show it.
- **Careful:** unit tests may assert `$00`; check `test/zxnext/NextRegDevice.test.ts` and the WASM
  NextReg tests. The existing visual cases set `$4A` explicitly, so they are unaffected.

### B4 – Copper `$60` does not latch the stored byte – FIXED 2026-09-17 (both cores)

- **Fixed:** `$60` at an even address stores the byte; `$63` stores it **only** at an even address
  (zxnext.vhd ~5411). **Second part found while fixing:** both cores also overwrote the stored byte on a
  `$63` write at an odd address, so an odd `$63` write not preceded by an even one committed the wrong
  MSB. Test: `test/zxnext-hw/copper/copper-upload.test.ts` - Z80 code uploads the list, the copper runs
  it, and NextReg `$14` shows whether the instruction arrived intact (both parts failed on both cores
  before).

- **Where:** TS `CopperDevice.ts:70` (`set nextReg60Value`), WASM `zxnext-copper.c:60` (`case 0x60u`).
- **Hardware:** zxnext.vhd ~5395–5398: a `$60` write at an **even** copper address also sets
  `nr_copper_data_stored`, which a following `$63` write at the odd address commits as the MSB
  (`copper_msb_dat <= ... nr_copper_data_stored`, ~3957).
- **Effect:** a program that writes the MSB with `$60` and the LSB with `$63` gets a wrong instruction
  (the MSB is whatever `$63` last stored). Pure `$60` or pure `$63` uploads (cases C02, C05) are unaffected.
- **Test:** a copper unit test (both cores) writing `$61=0; $60=hi; $63=lo` and checking copper RAM, plus
  optionally a visual variant of C05.

### B5 – WASM reset clears copper list RAM – FIXED 2026-09-17

- **Fixed:** `zxnextCopperReset` keeps the list RAM; the new `zxnextCopperHardReset` (power-on, from
  `clearMachineBuffers`) clears it. Test: `copper-upload.test.ts` "a reset keeps the copper list"
  (failed on WASM before; TS already passed).

- **Where:** `zxnext-copper.c:54` (`zxnextCopperMemory[i] = 0u` in `zxnextCopperReset`).
- **Hardware:** copper list RAM (`dpram2`) is not cleared by reset; only pointer, mode, write address,
  stored byte and `$64` are (copper.vhd 60–65, zxnext.vhd ~4998–5002). The TS core does not clear it.
- **Effect:** a soft reset in WASM loses a copper list the TS core (and hardware) keeps – a TS/WASM
  divergence visible to anything that restarts the copper after reset without re-uploading.

### B6 – TypeScript blend modes: gaps against the VHDL – FIXED 2026-09-17

- **Fixed:** the TS core no longer merges the tilemap into the ULA before composing, and no longer marks a
  `$68`-bit-7 ULA transparent before the mixer. `NextComposedScreenDevice.composeLayers` now takes the
  four layers separately and mixes them as zxnext.vhd stage 2 does - the same logic as the WASM
  `zxnextUlaCompose` (stencil/`ulatm` merge, `ula_mix_*` vs `ula_*`, the six orders with the Layer 2
  priority bit, the LUS/USL/ULS sprite-over-border exception, the `$68` blend-source cases 00/10/11/01,
  110 saturate / 111 minus 5). `composeSinglePixel` remains as a wrapper (no tilemap) for its unit tests.
  Test: `test/zxnext-hw/layers/blend-and-border.test.ts` - blend sources 00/10/11/01 with a tilemap,
  `$68` bit 7 as blend operand, sprite over the border in LUS/USL/ULS (7 of 8 failed on TS before, all
  passed on WASM). One unit test encoded the gap and was corrected:
  `test/zxnext/UlaRendering.test.ts` "D7 fix" expected blend mode `01` to blend; the VHDL `when others`
  case blends nothing and draws the ULA as a layer. All TS visual goldens unchanged.

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

### B7 – WASM has no ULANext / ULA+ palette indexing – FIXED 2026-09-17

- **Fixed:** `zxnextUlaAttrPaletteIndex` (standard and HiColor screens) and the new
  `zxnextUlaBorderPaletteIndex` follow zxula.vhd ~484-553: ULANext ink `attr & $42`, paper
  `$80 | attr >> bits` for formats `$01`-`$7F`, fallback colour for any other format; border `$80+n`
  (fallback for `$FF`); ULA+ (NextReg `$68` bit 3, now also read back) ink `$C0 | group<<4 | mode bit |
  ink`, paper `$C8 | group<<4 | paper`, border `$C8+n`; no FLASH in either. The fallback colour replaces
  the palette colour *before* the `$14` compare (zxnext.vhd ~6933/7046). Test:
  `test/zxnext-hw/ula/ulanext-ulaplus.test.ts` (formats `$07`, `$0F`, `$FF` and ULA+; all four failed on
  WASM before, all passed on TS). Not covered: HiRes mode, and the ULA+ ports themselves (B12). Minor
  TS difference left: its ULANext-`$FF` *border* never tests the fallback against `$14`; visible only
  when `$4A` equals `$14` with a layer below the ULA.

- **Where:** `zxnextUlaAttrPaletteIndex` (`zxnext-ula.c:165`) and the border lookup in
  `zxnextUlaRenderInstantScreen` always use the standard paper/ink indices (paper/border 16+n).
- **Hardware / TS:** ULANext uses the `$42` ink mask and paper/border from 128+n (format `$FF`: paper and
  border use the fallback); ULA+ uses indices from 192 (border 200+n) – check zxula.vhd ~500–553 for the
  exact paper/ink formulas before writing expectations. TS implements these
  (`updateBorderRgbCache`, attribute decode tables).
- **Effect:** any program using ULANext or ULA+ colours renders wrong colours in the production core.
- **Test:** a visual case per mode, expectations from zxula.vhd (~500–553).

### B8 – WASM raster: only some mid-frame state is raced – PARTLY FIXED 2026-09-17

- **Fixed (memory):** a write that changes a byte of bank 5 or 7 (ULA, HiColor/HiRes, LoRes, tilemap) or
  of the five 16K banks from the displayed Layer 2 bank now calls the raster catch-up
  (`zxnextRasterMemoryWrite`, from `zxnextMemoryWriteMapped`), up to the *start of the beam's current
  row*: at most one row render per scanline. The row being drawn shows the new contents from its first
  pixel (hardware fetches per cell) - at most one line of difference. Cost measured on a program
  rewriting attributes nonstop: 1.114 -> 1.137 ms/frame; unchanged for non-video writes. Test:
  `test/zxnext-hw/ula/midframe-memory-write.test.ts` (attributes written at copper line 96 by polling
  `$1F`; failed on WASM before - the whole column showed the later colour - passed on TS).
- **Still open (sampled registers):** `$68` half-pixel scroll, port `$FF` HiRes/HiColor and LoRes enable
  still switch at the write pixel in WASM, not at the next 8-pixel cell as in TS. Note `$68` bit 7 is
  per pixel in the VHDL, so a `$68` write cannot simply be delayed like `$26/$27`; it needs a per-bit
  split. The history below is kept for reference.

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

### B9 – Copper MOVE latency is one tick short – VERIFIED, NOT FIXED (2026-09-17)

- **Verified against the VHDL:** a MOVE fetched on tick T sets `copper_dout_s` (visible at T+1);
  zxnext.vhd latches `copper_req` on the rising edge of `copper_requester` (T+1), and the NextReg write
  happens with `nr_wr_en` on T+2. Both cores write on T+1. The next fetch is at T+2 in both, so only the
  write time differs: one 28 MHz tick = half a buffer pixel.
- **Why not fixed:** no program can observe it through the hardware interface (the CPU cannot sample
  that finely), and the visible position of a MOVE's effect also depends on the palette/video pipeline
  delays, which neither core models tick for tick (the cases allow a 4-px margin for exactly that). Moving
  one term of that chain without a real-hardware capture could make the end-to-end position worse, and
  a sub-HC shift can change TS output at HC boundaries (goldens). Fix it together with a measured
  reference picture from real hardware.

- TS `CopperDevice.executeTick` outputs a MOVE on the tick after the fetch; hardware writes on the second
  tick after it (copper.vhd `copper_dout` → zxnext.vhd `copper_req` latch → NextReg write). With 4 ticks
  per pixel this is a quarter-pixel difference – invisible in the current cases (4-px probe margins), but it
  changes exactly where a long run of MOVEs lands. WASM mirrors TS. Low priority.

### B10 – Dead code with a wrong mask: `TilemapDevice.nextReg6eValue/6fValue` – FIXED 2026-09-17

- **Fixed:** the unused accessors and their four fields were deleted. The live `$6E/$6F` path is guarded
  by `test/zxnext-hw/nextreg/tilemap-base-address.test.ts` (6-bit offset, bank 7 flag, bit 6 reads 0;
  both cores; passed before and after).

- `src/emu/machines/zxNext/TilemapDevice.ts:138–155` masks the tilemap/tile-definition address MSB to 5
  bits (`& 0x01f`); hardware keeps 6 (zxnext.vhd ~5445–5446, tilemap.vhd:57 "5:0 are offsets into 16K").
- Nothing uses these setters – NextReg `$6E/$6F` (`NextRegDevice.ts ~1601–1631`) go to the screen
  device's correct 6-bit fields. Delete or fix so nobody wires them up later.

### B12 – WASM does not emulate the ULA+ ports `$BF3B`/`$FF3B` – FIXED 2026-09-17 (found 2026-09-17)

- **Hardware:** zxnext.vhd ~4500-4563: `$BF3B` sets the mode group (bits 7-6) and, in group `00`, the
  6-bit index; `$FF3B` in group `00` writes/reads ULA palette entry `$C0 + index` as GGGRRRBB (reordered
  to RRRGGGBB, 9th bit `B1 or B0`), in group `01` writes the ULA+ enable (also `$68` bit 3) and reads it
  back. The palette is chosen by the `$43` **write** select bit 6. Ports gated by NextReg `$85` bit 0.
- **Cores:** the TS core already decoded the ports (`io-ports/UlaPlusDataPortHandler.ts`; the first report
  said both cores lacked them - wrong, the port table was missed). WASM decoded neither. Fixed in WASM
  (`zxnextUlaPlusWrite*/Read*` in `zxnext-ula.c`, `zxnextPaletteWriteUlaPlus/ReadUlaPlus`, port dispatch;
  a `$FF3B` write races the beam). **Two TS deviations fixed with it:** the 9th colour bit was B0 instead
  of `B1 or B0`, and the palette followed the *display* select (`$43` bit 1) instead of the write select.
  Test: `test/zxnext-hw/ula/ulaplus-ports.test.ts` (enable/readback, palette write/readback in GRB order,
  a ULA+ screen coloured through the ports with a `BB = 10` border; all failed on WASM, the border failed on
  TS). Two unit tests in `test/zxnext/NextComposedScreenDevice.test.ts` encoded the TS deviations and were
  corrected.

### B13 – NextReg reset values diverge from the VHDL reset branches – FIXED 2026-09-17

- **Fixed (TS):** `NextRegDevice.commonReset` now also restores `$64`, `$68`, `$6A`, `$6E=$2C`, `$6F=$0C`,
  `$90`-`$93`, `$A0`, `$A2`, `$A8`, `$D9`; `reset()` clears `$08` bit 6, re-enables `$82`-`$85` when
  `$85` bit 7 = 1, and no longer rewrites `$05`. `$64` got a readback from the copper. `$07` resets in
  `CpuSpeedDevice.reset`, `$C4` bit 7 in `InterruptDevice.reset`, the `$8C` nibble copy moved to
  `MemoryDevice.reset` (the NextReg device resets last and read an already-cleared value), `$8F` is kept
  by `MemoryDevice.reset` and cleared by `hardReset`. `$08` bit 7 now reads `not locked` from
  `MemoryDevice.pagingEnabled` and a write of 1 unlocks `$7FFD` (the old `unlockPort7ffd` flag did
  nothing). Registers with no reset branch (`$05`, `$06`, `$08`, `$09`, `$0A`, `$8F`) are captured at the
  start of `ZxNextMachine.reset` and replayed through their write handlers at the end
  (`captureResetSurvivors` / `restoreResetSurvivors`), because the device resets clear their fields.
- **Fixed (WASM):** `zxnext-nextreg.c` has one `zxnextNextRegApplyResetBranch` run by both resets (adds
  `$07`, `$0B`, `$69`, `$90`-`$93`, `$A0`, `$A2`, `$A8`, `$B8`-`$BB` into the DivMMC module, `$C6`,
  `$CC`-`$CE`, `$D8`, `$D9`); the soft reset keeps `$06` (captured in `zxnextReset` before the DivMMC
  reset clears its NMI-button bits), replays `$05/$06/$08/$09/$0A`, resets `$82`-`$85` per `$85` bit 7
  and copies the `$8C` nibble. `$C4` bit 7 resets in `zxnextInterruptsReset`, `$6E/$6F` in
  `zxnextTilemapReset`; `$08` bit 7 and `$A2` got read-mux readbacks, and a `$08` bit 7 write unlocks.
- **Hard reset** still applies the "fast boot" firmware values (`$05=$41`, `$06=$80`, `$08=$1A`,
  `$85=$0F`, ...). Those are a modelling choice, not VHDL reset values; nothing here verified them.
  Note `$85` bit 7 = 0 means a soft reset does *not* re-enable disabled ports until software sets it.
- **Tests:** `test/zxnext-hw/nextreg/soft-reset.test.ts` (296 per-register tests, both cores, no known
  failures left), `test/zxnext-hw/nextreg/tilemap-base-address.test.ts` (a tilemap enabled without
  `$6E/$6F` uses `$6C00`/`$4C00`; fails on the old defaults), `test/zxnext-hw/memory/port-7ffd-lock.test.ts`.
  `test/zxnext/NextRegDevice.test.ts` encoded the old values (`$08=$1A`, `$64=$FF`, `$6E/$6F=$00`,
  `$90`-`$92`/`$A0=$FF`, `$C4=$01`, `$D9=$FF`, the `unlockPort7ffd` field) and was corrected.
- **Verified:** node suites (harness, zxnext-hw, wasm, zxnext, z80: 11,325 tests), `test:visual` both
  cores and the browser tier (NextZXOS boot, WASM) 20/20 with unchanged goldens.

### B14 – WASM NextReg `$08` audio bits mapped to the wrong bits – FIXED 2026-09-17

- **Was:** `zxnextNextRegSetDirect` read the AY stereo mode from `$08` bit 4 (the internal-speaker bit)
  and reset the DACs when bit 5 was clear; the DAC enable (bit 3) gated nothing at all, so
  `zxnextDacWritePort` accepted writes with the DACs switched off.
- **Hardware:** zxnext.vhd ~5155-5157 (bit 5 = AY stereo ABC/ACB, bit 4 = internal speaker, bit 3 = DAC
  enable) and ~6382 (`reset_i => reset or not nr_08_dac_en`); soundrive.vhd ~70-78 holds all four
  channels at the silent centre `$80` and ignores writes while in reset.
- **Fixed:** bit 5 drives `zxnextPsgSetAyStereoMode`, bit 3 the new `zxnextDacSetEnabled`
  (`zxnext-dac.c`), which resets the channels when cleared and makes `zxnextDacWritePort` /
  `zxnextDacSetNextReg` ignore writes while disabled. Applied on every `$08` write and on a hard reset.
- **Tests:** `test/zxnext-hw/audio/ay-stereo-mode.test.ts` (AY-012) and
  `test/zxnext-hw/audio/dac-enable.test.ts` (DAC-001), both cores. Mutation-checked: restoring either
  wrong bit fails them.

### B15 – Both mixers leaked an inverted copy of one side into the other – FIXED 2026-09-17 (found 2026-09-17)

- **Was:** `AudioMixerDevice.getMixedOutput` and `zxnext-audio-mixer.c` AC-coupled the PSG by
  subtracting `max(left, right) / 2` from **both** sides. A channel that plays on one side only (A in
  either mode, C in ABC, B in ACB) therefore appeared on the other side in antiphase at the same
  amplitude, so NextReg `$08` bit 5 changed nothing observable in the mixed output and no stereo test
  could see it. A comment called the leak a fix for an "only left channel" bug.
- **Hardware:** audio_mixer.vhd ~99 sums each side on its own: `pcm_L <= ear + mic + ay_L + dac_L +
  i2s_L`. Channel A is left only in both arrangements (turbosound.vhd ~184-201).
- **Fixed:** each side now loses half of its own level (`x - floor(x / 2)`), which keeps silence at 0
  and leaves a mono signal exactly as before, in both cores.
- **Care:** two unit tests encoded the leak and were corrected -
  `test/audio/AudioMixerDevice.step8.test.ts` ("stereo separation": each side keeps its own level, the
  louder side stays twice the quieter one) and `test/audio/PsgRegisterMasking.step78.test.ts` (a silent
  side stays silent instead of carrying a phase-inverted copy).
- **Verified:** whole suite (22,545 tests), `test:visual` 20/20, no new type errors.

### B16 – NextReg access diverged from the FPGA read mux and select latch – FIXED 2026-09-18

Found by the catalogue §4.1 tests (`test/zxnext-hw/nextreg/register-select.test.ts`, `identity.test.ts`,
`read-mux.test.ts`, `composite-readbacks.test.ts`), all fixed in the same change:

- **`NEXTREG` changed the `$243B` selection (both cores).** zxnext.vhd ~4719-4725: the Z80N instruction
  requests the write with its own operand; `nr_register` changes only on a `$243B` write. Fixed with
  `NextRegDevice.writeRegister` (TS `tbblueOut`) and a direct `zxnextNextRegSetDirect` call in the WASM
  CPU plus a new `zxnextWriteNextRegister` export (WASM machine `tbblueOut`).
- **A reset did not select `$24` (both).** ~4575 ("protection against legacy programs"). Note the WASM
  `zxnextPortsReset` also cleared the index after the NextReg reset.
- **Registers the read mux does not list read back their last write (both); some listed registers
  leaked bits the mux hard-wires.** ~6232 `when others => (others => '0')`. Both cores now pass a `$253B`
  read through one table: `src/emu/machines/zxNext/nextRegReadMux.ts` and
  `zxnextNextRegReadZeroMask/OneMask` in `zxnext-nextreg.c` (keep them in sync; `read-mux.test.ts`
  checks both). Only the port read path is masked: `directGetRegValue` (the IDE panel, the harness's
  `nextRegValue`) still shows stored values.
- **WASM identity registers `$00`/`$01`/`$0E`/`$0F` were writable.** Now ignored.
- **WASM `$28` read 0** (now `nr_stored_palette_value`), **`$69` read back the last `$69` write** (now
  live: Layer 2 enable, `$7FFD` shadow bit, port `$FF` bits 5-0), and a `$69` write clobbered port `$FF`
  bits 7-6. **TS `$69` bits 5-0 read 0** (`timexPortValue` had a setter and no getter) and port `$FF`
  did not read back a `$69` write.
- **WASM `$7FFD` ignored bit 3:** the 128K shadow screen (bank 7) was never displayed. Test:
  `test/zxnext-hw/memory/shadow-screen.test.ts` (MEM-025, pixel, mutation-checked).
- **WASM sprite attribute mirrors were off by one:** `$34` wrote attribute 0 of the port-`$303B` sprite
  instead of selecting a sprite, `$35`-`$38` wrote attributes 1-4, `$39` was ignored. Now a separate
  `mirror_sprite_q` as in sprites.vhd ~596-616, tied to the upload index by `$09` bit 4. **TS:** a `$34`
  write reused the mirror index a previous `$35`-`$39` write left, so it wrote an attribute (MAME
  behaviour; the VHDL defaults the index to `"111"` every cycle, ~4806). Test:
  `test/zxnext-hw/sprites/attribute-mirror.test.ts` (SPR-006, pixel).
- **Tests corrected** (they encoded the old behaviour): `test/zxnext/NextRegDevice.test.ts` (`$04`,
  `$29`, `$2B` read 0; `$90`/`$A0` masks), `test/zxnext/SpriteDevice-d4d6d7.test.ts` (MAME `$34`),
  `test/wasm/zxNext/` ide-scaffold, public-adapter, frame-diff-runner and the oracle helper (they used
  `tbblueOut` as "select and write").
- **Open question, not a bug:** Klive reports core 3.02.00 (`CORE_VERSION_*`), the VHDL in
  `_input/next-fpga` is 3.02.01 (`g_sub_version = $01`).

### B17 – WASM had no software NMI sources and no Multiface device – FIXED 2026-09-18

- **Tests:** `test/zxnext-hw/reset/reset-register.test.ts` RST-004 (`$02` bit 2 DivMMC NMI), RST-005
  (`$02` bit 3 Multiface NMI, plus: the MF ROM is at `$0000` after the `$0066` fetch, MF RAM at `$2000`,
  RETN pages it out - mutation-checked), RST-006 (`$D8` +3 FDC I/O trap). Both cores.
- **Fixed (WASM):** new `zxnext-multiface.c` (multiface.vhd: `nmi_active`, `mf_enable`, `invisible`,
  the type-dependent enable/disable ports `$1F`/`$3F`/`$9F`/`$BF`, the `mf_port_dat` paging snapshot,
  RETN), a `$0000`-`$3FFF` overlay in `zxnext-memory.c` (Multiface over DivMMC over Layer 2), and the
  NMI state machine in `zxnext-nmi.c` (IDLE/FETCH/HOLD/END, Multiface-first arbitration gated by `$06`
  bits 3/4, stepped at opcode fetches; the MF NMI is never stackless), mirroring `ZxNextMachine`. `$02`
  reads the MF/DivMMC/I-O-trap flags; `$D8` traps `$2FFD`/`$3FFD` in `zxnext-ports.c` (`$DA` cause, `$D9`
  value, `$DA` now read-only). The F9/F10 menu commands reach the core through
  `zxnextPressMultifaceNmiButton` / `zxnextPressDivMmcNmiButton` (before, on WASM they set TypeScript
  flags nothing read, so both buttons did nothing).
- **Not modelled:** `$EFF7` bits 3-2 in the MF+3 port snapshot (WASM has no `$EFF7` state; reads 0).
- **Seen, not investigated:** the TS `+3 FDC` control port throws on a `$3FFD` read when the trap is off
  and no disk is active (`readSpectrumP3FdcControlPort`).

### B18 – Only the +3 raster was implemented; `$03` display timing did not change the frame – FIXED 2026-09-18

- **Tests:** `test/zxnext-hw/reset/machine-type.test.ts` RST-008: frame length per timing (48K
  69888, 128K/+3 70908, Pentagon 71680 T-states, measured over ten frames) and paper/border in place in
  every timing. Both cores.
- **Fixed (TS):** `screen/TimingConfig.ts` adds `Zx48_50Hz`/`Zx48_60Hz`, `Zx128_50Hz`/`Zx128_60Hz`,
  `Pentagon_50Hz` and `selectTimingConfig(displayTiming, is60Hz)`. The mapping from zxula_timing.vhd is
  the one the +3 configs already used (displayXStart = `c_min_hactive` + 8, interrupt HC = `c_int_h` +
  12). `NextComposedScreenDevice` builds one table set per config on first use (`getTimingTables`), the
  generators index by `config.totalHC`, and `onNewFrame` picks the config from `$03` and `$05`.
- **Fixed (WASM):** the geometry macros are runtime values (`zxnextTiming*` in `zxnext.c`), chosen by
  `zxnextTimingSelect` at every frame end (after the finished frame's picture) and on hard reset.
- **Framing choice:** every timing keeps the paper at buffer (96, 48). The VHDL HDMI window would show
  the Pentagon paper 8 pixels right and 8 rows lower.
- **Cost:** WASM 2.01 vs 1.96 ms/frame against the last commit on a busy loop (that covers B16-B19 too:
  the NMI state machine per instruction, the Multiface overlay per memory access, variable geometry).

### B20 – WASM 60 Hz keeps the 311-line frame – OPEN (found 2026-09-18)

- The WASM core has always run 311-line frames at 60 Hz (only the interrupt position changes); the TS
  core runs 264 lines (Plus3_60Hz, Zx48_60Hz). `zxnextTimingSelect` keeps that behaviour: the WASM
  raster draws layers at fixed buffer rows, and the TS 60 Hz frame puts the paper at row 24, not 48.
  Needs the WASM layer drawing to take a per-timing paper row. Catalogue VT-003.

### B21 – `Plus3_60Hz.intStartTact` looks like a hex/decimal slip – OPEN, not verified (found 2026-09-18)

- `screen/TimingConfig.ts`: `intStartTact: 0x138` with the comment "vc(0) * totalHC(456) + hc(138) =
  138" - `0x138` is 312. The WASM core copied the value. The new 128K 60 Hz config derives from it
  (+2), so both stay consistent until someone checks the 60 Hz interrupt position against the VHDL
  (`c_int_v` = 0, `c_int_h` = 126 for +3) with a test (catalogue VT-006).

### B19 – NextReg `$02`/`$03`/`$0A` behaviour – FIXED 2026-09-18

Found by catalogue §4.2 (`test/zxnext-hw/reset/*.test.ts`):
- **`$02` bits 0/1 did not reset (both cores).** Now a soft/hard reset after the current instruction:
  TS `ZxNextMachine.requestResetFromNextReg` + `afterInstructionExecuted`; WASM stops the frame
  (`zxnextResetRequest`), the wrapper takes it with `zxnextTakeResetRequest` and runs its own
  `reset()`/`hardReset()` (so a hard reset reloads the ROM images), in the fast loop, the debug loop and
  single steps.
- **WASM `$02` read the stored byte;** now bit 7 (bus reset) and the last reset type (`10` after a hard
  reset, `01` after a soft one). TS already did.
- **TS had no `$D8` I/O trap:** `$2FFD`/`$3FFD` always went to the FDC. Now `trapFdcPortAccess` raises
  the Multiface NMI, records `$DA`/`$D9`, and `$02` bit 4 = 0 clears the cause.
- **WASM `$03` was a stored byte:** now timing (bit 7, lock, 000->001, 101-111->011), the user lock
  toggle, the machine type in config mode only, and bit 7 = palette sub-index. **WASM `$0A`** bits 7-6
  now change only in config mode.
- **TS lost the `$03` timing, lock and type on every soft reset** (`NextComposedScreenDevice.reset`
  zeroed them, the machine forced type 3); the VHDL has no reset branch for them. The hard reset now sets
  the post-firmware values (+3 timing and type, unlocked), so `$03` reads `$33` after it, not `$03`.
- Corrected tests: `test/zxnext/NextRegDevice.test.ts` (`$03 = $33`; `$04` returns the last value read).

### B11 – `EmulatorPanel` renders an instant screen after every frame – FIXED 2026-09-17

- **Fixed:** `machineFrameCompleted` keeps a copy of the displayed pixel buffer instead of calling
  `renderInstantScreen()`: every core draws while it executes (48K/128/+3E WASM render up to the current
  tact, TS devices per tact, the Next WASM raster; C64/Z88 `renderInstantScreen` only returns the buffer),
  so the render was needed only for the copy it returned. Measured on the ZX Next (T00 ULA only / P01
  all layers): WASM 1.086 -> 0.835 and 3.280 -> 2.404 ms/frame, TS 14.2 -> 8.8 and 21.5 -> 13.4 ms/frame.
  The harness's "run a frame like the app" paths (`runDisplayedFrame`, session, browser `FrameRunner`)
  dropped the call too, and every approved golden (both cores) stayed byte-identical - proof the
  render had no visible effect. The paused "instant screen" view still renders on demand.

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

- **Golden hashes: all approved (2026-09-17).** Every case was reviewed by a separate agent in both tiers
  (describe first, then compare) and approved for `ts`, `wasm` and `browser` (D05: `ts`, `wasm`; it is
  not a browser case). Two reviews came back *unsure* on row 48 of C04 and C11: the pictures were right
  (mode 11 restarts the list at `hc_ula` 0, paper x −12, copper.vhd "restart at frame start") and the
  `expect.md` texts were imprecise; they were corrected and re-reviewed. `--approve` skips `longOnly`
  cases unless `--long` is also given.
- The emulator changes above are not covered by `CHANGELOG.md` yet.
