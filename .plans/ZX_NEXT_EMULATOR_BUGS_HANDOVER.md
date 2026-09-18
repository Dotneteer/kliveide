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
| B9 | Copper MOVE write one tick early; `$62` acted on at once | FIXED 2026-09-18 (both; C04 golden re-approved) | `test/zxnext-hw/copper/copper-control.test.ts` COP-011 |
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
  WASM before, all passed on TS). Not covered: HiRes mode, and the ULA+ ports themselves (B12).
- **Residual fixed 2026-09-18 (catalogue §4.10):** the TS ULANext-`$FF` *border* never tested the fallback
  against `$14` (transparent was hard-wired to false); visible only when `$4A` equals `$14` with a layer
  below the ULA. The border now compares like every other ULA pixel; the `it.fails` in
  `ulanext-ulaplus.test.ts` is a plain test. `test/zxnext-hw/ula/ulanext.test.ts` adds every format
  (valid and invalid), FLASH / BRIGHT, the second palette and transparency - all passed on both cores.

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
- **Still open (sampled registers):** the `$68` half-pixel scroll still switches at the write pixel in
  WASM, not at the next 8-pixel cell as in TS. (Port `$FF`, `$26`/`$27` and `$FE` now latch per cell:
  B40, B45. The LoRes enable `$15` bit 7 acts per pixel in the VHDL - `lores_en_0` every 14 MHz clock -
  so WASM was right there and TS was not: B47.) Note `$68` bit 7 is
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

### B9 – Copper MOVE latency was one tick short; mode changes acted at once – FIXED 2026-09-18

- **Found observable** by catalogue COP-011 (`test/zxnext-hw/copper/copper-control.test.ts`): a copper
  `MOVE $62,$00` followed by another MOVE. The VHDL writes a MOVE's NextReg two ticks after its fetch
  (copper.vhd `copper_dout` for one tick → zxnext.vhd latches `copper_req` on its rising edge → the
  NextReg process writes on the next tick), so the copper has already fetched the next MOVE, still in mode
  01, when `$62` becomes 00 - and that MOVE's write goes out too (`copper_req` follows `copper_dout`,
  whatever the mode). Both cores wrote on the tick after the fetch and stopped before the next MOVE. The
  earlier reasoning ("no program can observe it") missed that the copper can observe itself.
- **Fix, both cores** (`CopperDevice.executeTick`, `zxnextCopperExecuteTick`): a transcription of both
  processes per tick - the zxnext side (write the request latched last tick, latch a new one on dout's
  rising edge) and copper.vhd (mode changes acted on at the next tick through `last_state_s`, restart,
  WAIT, MOVE), with the NextReg write applied after the copper has seen the old register values. `$62`
  now only stores the mode; the machines keep ticking the copper while its pipeline still holds a write
  (`isActive` / `zxnextCopperIsActive`). The tick-level unit tests (`test/zxnext/CopperDevice.test.ts`,
  `test/wasm/zxNext/wasm-next-copper.test.ts`) were updated to the VHDL timeline.
- **Visible effect:** a copper palette write lands a quarter of a pixel later; only C04's restart row
  moved (row 48 black from buffer x 76, not 74: the write lands on tick 0 of `hc_ula` 2). Re-derived in
  its `expect.md`, reviewed blind (pass, both cores), golden re-approved for ts, wasm and browser. Every
  other golden stayed byte-identical. COP-005/006 (exact pixel positions) still want a real-hardware
  capture: the video pipeline after the palette is not modelled tick for tick.

### B63 – TS `$61` read the last written value, not the copper write address – FIXED 2026-09-18

COP-002 / COP-003. zxnext.vhd ~6030 reads `nr_copper_addr(7 downto 0)`, which `$60`/`$63` writes move on;
the TS `$61` register had no read function, so it returned whatever was last written to it. WASM was
right. `NextRegDevice` now reads `CopperDevice.nextReg61Value`.

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

### B20 – WASM 60 Hz kept the 311-line frame – FIXED 2026-09-18

- The WASM core ran 311-line frames at 60 Hz (only the interrupt moved); zxula_timing.vhd has 264
  lines with the display from line 40 for 48K, 128K and +3. `zxnextTimingSelect` now picks the 60 Hz
  geometry (48K 60 Hz too, which used the 128K line length), and `ZXNEXT_STANDARD_SCREEN_Y` is
  `displayYStart - firstVc` (48 at 50 Hz, 24 at 60 Hz, as the TS core frames it). At 60 Hz the 320x256
  layers start at row -8: the unsigned row wraps and `zxnextRenderRowOff` skips it.
- Left: at 60 Hz the WASM core draws border on buffer rows 248-287 (past the frame); the TS core
  leaves them. Tests: VT-001, VT-002, VT-010.

### B21 – `Plus3_60Hz.intStartTact` was a hex/decimal slip – FIXED 2026-09-18

- `intStartTact: 0x138` (312) for c_int_h 126 + 8 = HC 134: the 128K and +3 60 Hz interrupt was 88
  tacts late on both cores (the WASM core copied the value). Test: VT-006.

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

### B22 – `ADD rr,A` and `LDWS` carry flag – FIXED 2026-09-18

Found by catalogue §4.3 (`test/zxnext-hw/cpu/z80n-instructions.test.ts`, 104 tests on both cores):
- **`ADD HL/DE/BC,A` (ED 31-33) left the flags alone (both cores).** t80n.vhd ~762-785 writes
  `F(Flag_C) <= reg_temp_t(16)`; the 16-bit sum only reaches bits 15-0 of that variable, which is
  zeroed at T-state 3 - so carry is cleared. Other flags stay.
- **`LDWS` (ED A5) preserved carry (both cores).** t80n_mcode.vhd ~2140: its flags come from the INC D
  ALU operation, which - unlike `INC r` (~757, `PreserveC <= '1'`) - does not set PreserveC, and
  t80n.vhd ~1227-1233 writes C unless PreserveC_r. So C is the carry out of D + 1 (set only for
  D = `$FF`). Published docs describe LDWS as "flags as INC D", i.e. C preserved; the VHDL differs.
- **Fixed:** `src/emu/z80/Z80NCpu.ts` (`addHLA/addDEA/addBCA`, `ldws`) and `src/emu/z80/wasm/z80.c`
  (shared by all WASM cores; the Z80N opcodes run only with `z80nMode`; all four cores rebuilt).
- **Corrected tests:** `test/z80/next-ops.test.ts` (ADD HL/DE/BC,A expected F unchanged; three LDWS
  tests expected C preserved).
- Everything else in §4.3 already matched the VHDL: SWAPNIB, MIRROR A, TEST n, the barrel shifts
  (B bits 4-0), MUL, ADD rr,nn, PUSH nn, OUTINB, NEXTREG from paged RAM, PIXELDN/PIXELAD/SETAE,
  JP (C), LDIX/LDIRX/LDDX/LDDRX, LDPIRX, the unassigned ED opcodes (incl. ED 26, the removed
  MIRROR DE) and interrupts between LDIRX iterations.

### B23 – The INT pulse was counted in 7 MHz ticks, not CPU cycles – FIXED 2026-09-18

Found by catalogue §4.4 (`test/zxnext-hw/speed/cpu-speed.test.ts`, SPD-003):
- zxnext.vhd ~1968-2000: `pulse_int_n` is held for `pulse_count_end` CPU cycles - 32 for 48K and +3,
  36 for 128K and Pentagon - and `pulse_count` runs on `i_CLK_CPU`, so the pulse is 32 CPU T-states at
  *every* speed. Both cores held it for 32 HC ticks (`intEndTact = intStartTact + 32`), i.e. 16 T at
  3.5 MHz and 128 T at 28 MHz. The line interrupt shares the pulse (`lineIntActive` used the same span).
- **Symptoms:** at 3.5 MHz the pulse could fall inside one long instruction and be lost - a loop of
  23-T `EX (SP),IX` took 31 of 50 frame interrupts; at 28 MHz an 88-T IM 2 handler that re-enables
  interrupts was entered again in the same pulse (88 interrupts in 50 frames).
- **Fixed:** `TimingConfig.intEndTact` is replaced by `intPulseCycles` (32/36);
  `NextComposedScreenDevice.intPulseLength` = `cycles * 2 >> effectiveSpeed` HC ticks. WASM:
  `zxnextTimingIntPulseCycles` set by `zxnextTimingSelect`, `zxnextTimingIntPulseLength()` used by
  `zxnextUlaGetPulseIntActive` and `zxnextVideoLineIntActive`.
- **Corrected tests:** `test/zxnext/NextComposedScreenDevice.test.ts` and `NextInterrupts.test.ts`
  expected the 32-tick pulse. All 20 visual goldens are unchanged.

### B24 – WASM `$07` write ignored the expansion bus – FIXED 2026-09-18

- zxnext.vhd ~5762-5766: while `$80` bit 7 is set, `cpu_speed` takes `expbus_speed` (always "00"). The
  WASM `$07` write copied the programmed speed straight into `cpuEffectiveSpeed`, so `$07` read `$33`
  and the CPU ran at 28 MHz with the bus on. It now calls `zxnextExpansionRequestSpeedUpdate()`. TS was
  right. Test: SPD-005.

### B25 – WASM F5/F6/F8 hotkeys did nothing – FIXED 2026-09-18

- `ZxNextWasmV2Machine.executeCustomCommand` passed `cycleCpuSpeed`, `enableExpansionBus` and
  `disableExpansionBus` to the base class, which changes the TypeScript devices the WASM core never
  reads - so the app's CPU-speed and expansion-bus menu items had no effect on the production core.
  Now they write `$07` / `$80` bit 7 through the WASM NextReg path, gated by `$06` bit 7 (~6290-6293).
  Harness: new `pressHotkey("F5" | "F6" | "F8")`. Tests: SPD-006, harness self-test.
- **Not checked:** `toggle5060Hz` (F3) and `toggleScandoubler` take the same base-class path on WASM;
  F3 belongs with B20.

### B26 – No memory contention in either core – OPEN (found 2026-09-18)

- zxnext.vhd ~4461-4473: at 3.5 MHz, with `$08` bit 6 = 0 and a non-Pentagon timing, accesses to
  pages $00-$0F are contended by the ULA - 48K timing: bank 5; 128K: odd banks; +3: banks 4-7. It
  depends on the page being accessed, not on the address. Neither core stretches memory accesses
  (`ZxNextMachine.getContentionValue` is a TODO; only port I/O has the structural delay pattern).
- Test: `test/zxnext-hw/memory/contention.test.ts` (MEM-023) - the six contended cases are
  `it.fails`; the uncontended ones (other banks, `$08` bit 6, Pentagon, 7 MHz) pass. Implementing it
  needs the ULA contention pattern per timing (zxula.vhd `o_cpu_wait_n`) and a decision on cost.

### B27 – Layer 2 memory paging hit the wrong RAM – FIXED 2026-09-18

Found by catalogue §4.5 (`test/zxnext-hw/memory/layer2-paging.test.ts`, MEM-017 - MEM-021):
- **Both cores added the RAM base twice.** zxnext.vhd ~2926: `layer2_A21_A13 = ("0001" + page(7:5)) &
  page(4:0)` is already the SRAM page (RAM page + 32); both cores used `OFFS_NEXT_RAM +
  layer2_A21_A13 x 8K`, so a `$123B`-paged access to Layer 2 page p went to RAM page p + 32 (bank 8
  -> page 48). Programs that draw Layer 2 through `$123B` wrote to the wrong memory; drawing through
  the MMU was right, which is why the visual cases never saw it.
- **Segments 01 and 10 were mapped at $4000 / $8000 (both).** ~3001-3020: segments 00/01/10 all
  map $0000-$3FFF (the segment picks which third of Layer 2 is shown there); only 11 maps $0000-$BFFF.
- **TS only:** the lookup-table builder walked 8K chunks *and* both halves, so segment 00 also claimed
  $4000-$5FFF (writes to bank 5 vanished); a later, smaller segment left the previous one's entries
  mapped; `$12`/`$13` writes did not rebuild the table.
- **Fixed:** `MemoryDevice.updateLayer2Mapping`, `zxnextMemoryResolveLayer2Offset`, NextReg `$12`/`$13`.
  Corrected test: `test/wasm/zxNext/wasm-next-screen-ula.test.ts` (`layer2MappedOffset` had the same
  double offset).

### B28 – The paging ports did not follow the FPGA's MMU reload – FIXED 2026-09-18

Found by catalogue §4.5 (`memory/paging-ports.test.ts`, `memory/alt-rom.test.ts`). zxnext.vhd
~4599-4664: `$7FFD`/`$DFFD`/`$1FFD`/`$EFF7`/`$8E`/`$8F` never map memory directly - an accepted write
*reloads the MMU registers*, and the mapping comes from those. Both cores kept a separate paging state
beside the MMU instead:
- **+3 special mode left `$50-$57` alone (both);** the FPGA loads all eight. A `$8E` write did not put
  the ROM back in MMU0/1 (both); WASM `$7FFD` did not either.
- **`$8F` Pentagon 512/1024 paging was missing (both)** - `$7FFD` bits 7-6 (and bit 5 in 1024 mode,
  which also has no lock); `$8F` mode 01 (Profi) is disabled in the VHDL and pages as standard. A `$8F`
  write reloads the MMU too. **WASM had no `$EFF7` at all** (bit 3 = RAM bank 0 at $0000, bit 2
  turns Pentagon 1024 off); the WASM Multiface now reads it back.
- **The `$8C` lock bits only worked with the Alt ROM enabled (both);** ~2944 applies them always, and
  the ROM choice depends on the machine type (48K type: ROM 0; 128K/Pentagon: `$7FFD` bit 4 only).
- **Fixed:** both cores now store the VHDL registers (`port_7ffd_reg`, `port_dffd_reg`,
  `port_1ffd_reg`, `port_eff7_reg`, `nr_8c_altrom`) and run the VHDL reload (`reloadMmuFromPorts` /
  `zxnextMemoryReloadMmu`) and ROM selection (`updateRomSelection` / `zxnextMemoryUpdateRomSelection`);
  the old fields (`allRamMode`, `pagingEnabled`, `useShadowScreen`, ...) are derived getters. `$69`
  bit 6 writes `$7FFD` bit 3 as in the VHDL. The machine type change refreshes the ROM mapping.
- **Corrected test:** `test/zxnext/MemoryDevice.test.ts` expected the lock bits to be ignored without
  the Alt ROM.
- **Not covered:** config mode's `$04` ROM/RAM bank in $0000-$3FFF (~3001) is still not mapped.

### B29 – Port enables and decoding diverged from the VHDL – FIXED 2026-09-18

Found by catalogue §4.6 (`test/zxnext-hw/ports/*.test.ts`, 92 tests):
- **`$85` powered on as `$0F` (both).** zxnext.vhd ~1223 declares the reset type (bit 7) `'1'`, so it
  reads `$8F` and a soft reset re-enables every port. Both cores had chosen 0 on purpose.
- **WASM ignored most enable bits:** zxnDMA `$6B` (bit 5), Z80 DMA `$0B` (25), Kempston `$1F`/`$37`
  (6, 7), I2C (10), UART (12), the mouse ports (13) and every DAC port (17-23).
- **WASM DAC decode:** matched `port & $FE`, so even (ULA) ports `$1E`, `$DE`, ... drove the DACs too,
  and `$FB` wrote channels A and D although with Soundrive mode 2 enabled (the default) it is channel
  D only. Rewritten from the ~2378-2395 equations (`zxnextDacWritePort`).
- **`$FF` returned the Timex register without `$08` bit 2 (both);** ~2769 needs it, else the floating
  bus (B30).
- **`$7FFD` always needed A14 = 1 (both);** ~2549 decodes A14 only in +3 timing.
- **`$BFFD` read the AY register in every timing (both);** ~2747: +3 timing only. **WASM `$BFF5`**
  returned a 4-bit register number; the PSG register number is 5 bits and registers 16-31 take no
  writes and read `$FF` in YM mode (ym2149.vhd ~173-222).
- **`$DF` as Kempston 1 (~2622):** TS ignored the Specdrum enable; WASM did not have the alias.
- Corrected tests: `test/zxnext/PortEnableGating.test.ts`, `NextRegDevice.test.ts` (`$85`, `$08` bit 2),
  `NextIoPortManager.test.ts` (`$1FFD` now also in the `$7FFD` decode), `test/wasm/zxNext/wasm-next-psg-audio.test.ts`.

### B30 – No floating bus in either core – FIXED 2026-09-18

- zxula.vhd ~306-340, 573: in the display each character pair puts pixel, attribute, pixel, attribute
  on the bus for ULA hc 9-10, 11-12, 13-14, 15-0 and `$FF` for hc 1-8. `$FF` shows it in 48K/128K
  timing (~4493). In +3 timing `$0FFD` (enable bit 4, `$FF` while `$7FFD` is locked, ~4497) shows
  those bytes with bit 0 set and otherwise `p3_floating_bus_dat`, the last byte the CPU read or wrote
  in a contended page (~4478-4488: banks 4-7 in +3 timing).
- Neither core had any of it: `$FF` read 0, `$0FFD` `$FF`.
- **Fixed:** `NextComposedScreenDevice.floatingBusAt` / `zxnextUlaFloatingBus`; the CPU's memory reads,
  code fetches and writes latch the +3 value (`ZxNextMachine.readMemory/fetchCodeByte/writeMemory`
  overrides, `zxnextCpuLatchP3FloatingBus`). Scrolling and the Timex modes are not applied to the
  floating-bus address.

### B31 – Kempston mouse buttons were active-high – FIXED 2026-09-18

- zxnext.vhd ~3557: `$FADF` bits 2-0 are `not` middle, left, right - 0 while pressed, `$0F` with nothing
  pressed and the wheel at 0. Both cores returned the pressed state. `test/zxnext/KempstonMouse.test.ts`
  now flips the button bits back where it tests bit positions, and checks the raw value.

### B32 – WASM TurboSound could never be enabled – FIXED 2026-09-18

- NextReg `$08` bit 1 (`nr_08_psg_turbosound_en`, ~5159) did not reach the WASM PSG: only a test export
  called `zxnextPsgSetTurbosoundEnabled`, so software on the production core could never select AY#1
  or AY#2. Now set with the other `$08` audio bits.

### B33 – TS PSG registers 16-31 are inverted against the VHDL – FIXED 2026-09-18

- ym2149.vhd ~188, ~222: a register number with bit 4 set takes no write; it reads `$FF` in YM mode and
  register n & 15 in AY mode. `zxSpectrum128/PsgChip.ts` did the opposite (YM mode aliased 16-31 to 0-15,
  AY mode read 0) - and `TurboSoundDevice.setPsgRegisterIndex` dropped bit 4 on the way in. The note
  that the chip is shared with the 128K machine was stale: only the Next's TurboSound used it (128K runs
  its own C core). Fixed with B73; test AY-001 (`test/zxnext-hw/audio/ay-psg.test.ts`).

### B34 – The ULA interrupt was 2 tacts late in every timing – FIXED 2026-09-18

Found by catalogue §4.7 (`test/zxnext-hw/video/video-timing.test.ts`, VT-006). The test reads, from a
fixed frame start, `$C8` bit 0 (the ULA interrupt latch) and `$1F` (the line counter) with the same
IN after a delay swept one tact at a time - no interrupt is taken, so there is no acceptance jitter.
- Both cores map a VHDL hc to HC = hc + 8 (displayXStart = c_min_hactive + 8, the line counter and
  copper line change at displayXStart - 12), but placed the interrupt at c_int_h + **12**: 4 HC, 2
  tacts, late against the line counter in every timing. Now c_int_h + 8 (`TimingConfig`,
  `zxnextTimingSelect`). The Pentagon interrupt (c_int_v 319, c_int_h 439) is then the last HC of the
  frame, so the pulse test wraps across the frame end (`renderTact`, `zxnextUlaGetPulseIntActive`).

### B35 – TS reset left the raster counters mid-frame – FIXED 2026-09-18

- `ZxNextMachine.reset()` restarts the frame (`tacts`, `frameTacts` = 0) but left `currentFrameTact`
  and `lastRenderedFrameTact` at their old values, so nothing was rendered - and no interrupt captured
  - until the new frame reached the tact where the old one had stopped. A soft/hard reset in mid-frame
  (`$02`, F1/F4, the harness) lost the next frame interrupt. Test: "a soft reset in mid-frame keeps the
  next frame interrupt" (fails with the old code).
- Left: after a reset the TS core keeps the previous frame's raster config (`onNewFrame` picks it) until
  the next frame starts; a reset from Pentagon or 60 Hz shows one frame in the old geometry.

### B36 – TS never rendered the last tacts of a frame – FIXED 2026-09-18

- `onTactIncremented` returned as soon as `frameCompleted` was set, so the tacts between the last
  instruction boundary and the frame end were not rendered and their pulses not captured. With the
  Pentagon interrupt on the frame's last tact (B34) it was seen ~10 tacts late and 25 tacts long. The
  completing frame now renders to its end (`renderFrameTactsTo`). Corrected test:
  `test/wasm/zxNext/wasm-next-frame-runner.test.ts` no longer compares `lastRenderedFrameTact`, TS
  bookkeeping the WASM core does not keep.

### B37 – `$05`, `$11`, `$22` readbacks – FIXED 2026-09-18

- `$05` (~5843) reads the *effective* 50/60 Hz and scandoubler bits, latched at the frame start
  (~6644); both cores returned the written value at once. Pentagon timing holds the 50/60 Hz bit at 0
  (~5781); both cores let it through.
- `$11` (~5186) is written only in config mode, `111` storing `000`; both cores always stored it.
- `$22` bit 7 (~5938) is the INT pulse (`not pulse_int_n`); both cores returned a stored bit. It now
  reads the pulse of an enabled ULA or line interrupt (VT-007 measures 32 / 36 tacts on it).
- Corrected tests: `test/zxnext/NextRegDevice.test.ts` ($11 needs config mode), `InterruptDevice.test.ts`
  ($22 bit 7).

### B38 – The half-pixel scroll moved the ULA picture right – FIXED 2026-09-18

Found by catalogue §4.8 (`test/zxnext-hw/ula/scroll.test.ts`, ULA-012).
- zxula.vhd ~198, ~397: `$68` bit 2 is the low bit of the 4-bit shift amount (`px(2:0) & px(8)`, in
  14 MHz half pixels), so the shift register loads one more half pixel to the *left*: the second half
  of paper x shows the first half of screen x + 1. Both cores output the previous pixel's colour in the
  first half instead (a right shift), deliberately ("shift ULA output right by one 14 MHz dot").
- TS: the standard-mode shift register now keeps both bytes (16 bits), and the second half of a pixel
  is the next pixel, with the next pixel's attribute (`ulaStandardPixelRgb333`). WASM:
  `zxnextUlaRenderStandardScreen` draws screen x + 1 in the second half. The field-level test D6 in
  `test/zxnext/UlaRendering.test.ts` (it encoded the old "previous pixel") is replaced by ULA-012.
- The Timex HiRes / HiColor renderers ignored it too: fixed as B42.

### B39 – TS `$27` scroll values of 192-255 read outside the display file – FIXED 2026-09-18

Found by catalogue §4.8 (ULA-011). zxula.vhd ~196-208 folds `vc + scroll_y` back into 0-191 for every
8-bit scroll value (it amounts to mod 192). The TS core subtracted 192 once, so a scroll of 200 on the
bottom rows indexed past its 192-entry line table and showed bytes from `$4000 + column`. Now `% 192` in
the standard, HiRes and HiColor renderers. The WASM core already used `% 192`.

### B40 – The border colour changed at any T-state instead of at the 8-pixel border latch – FIXED 2026-09-18

Found by catalogue §4.8 (`test/zxnext-hw/ula/border-timing.test.ts`, ULA-007).
- zxula.vhd ~427-441: the border reaches the picture through `attr_reg`, which takes the port `$FE`
  colour only at the shift-register loads (`sload`, every 8 pixels, on the paper cells' grid); only
  Pentagon timing reloads it every clock. A mid-line `OUT ($FE)` therefore moves the edge in 8-pixel
  (4 T-state) steps - the well-known border resolution of the original machines. Both cores changed it
  at the T-state (2-pixel steps).
- TS: `renderTact` latches the port value into `borderColorLatched` at HC = 0 mod 8 (every HC on the
  Pentagon raster); the border RGB cache follows the latched value, so palette writes still act per
  pixel. WASM: the raster keeps separate *shown* values for the border and the `$26`/`$27` scroll; a
  write catches the raster up to the beam and schedules a pending latch at the next 8-pixel point
  (`zxnextUlaScheduleLatch`, `zxnextRasterBorderTact`, `zxnextRasterUlaScrollTact`), and
  `zxnextRasterRenderTo` applies each latch at its own pixel. Readback keeps the written values.
- A first version of the WASM fix (and the scroll handling before it) caught the raster up to the latch
  point instead, drawing up to 7 HC past the beam with the state of the write: a copper palette MOVE in
  that window showed at the latch point, not at once. Guarded by "a Copper palette write between a border
  OUT and its latch point shows at once" (`border-timing`) and "... between a $26 write and its cell
  latch ..." (`scroll`); both fail with the draw-ahead and pass on TS, which draws pixel by pixel.
- Field-level tests that set the device's `borderColor` and read `borderRgbCache` at once
  (`UlaRendering.test.ts` D1/D3, `PaletteDevice.test.ts` "Border colour follows palette writes") were
  removed: ULA-001, ULA-016 and `ulanext-ulaplus.test.ts` cover that behaviour on the real machine.
- Not a bug, noted while measuring Pentagon: after `hardReset` from a Pentagon frame the two cores can
  start the next frame at a different phase (the B35 residual), so tact-exact tests take a fresh
  session per measurement.

### B41 – Timex mode 1 showed the mode 0 picture – FIXED 2026-09-18

Found by catalogue §4.9 (`test/zxnext-hw/ula/timex-modes.test.ts`, TMX-002). zxula.vhd ~230-250: screen
mode bit 0 is address bit 13 of *both* fetches, so mode 1 takes pixels from `$6000` and attributes from
`$7800`. The TS core kept a `ulaStandardScreenAt0x4000` flag that nothing read; the WASM core had no
mode 1 at all - both drew `$4000`/`$5800`. (The catalogue also said "attributes still from `$5800`";
corrected.) The fetch addresses now follow the VHDL for every mode in both cores: TS
`ulaAttributeAddress` / the mode bit in the pixel address, WASM `zxnextUlaBitmapAddress` /
`zxnextUlaAttributeAddress` with the mode. The TS HiColor renderer was deleted - modes 0-3 are one
pipeline in the VHDL, and the standard renderer now serves them all - and so was the WASM one.
- Same cause, found by reading the code (the tests TMX-013 were written with the fix): mode 3 drew
  HiColor from `$4000` (VHDL: pixels *and* attributes from the same `$6000` byte), and HiRes modes 4,
  5, 7 drew mode 6 (VHDL: second byte from `$5800` / `$7800` / `$6000`). Three legacy tests in
  `test/wasm/zxNext/wasm-next-screen-ula.test.ts` used mode 3 to mean HiColor; they now use mode 2.
- The screen mode is forced to 0 while the 128K shadow screen is displayed (zxula.vhd ~191); both cores
  now do so explicitly (it held before only because neither drew mode 1).

### B42 – The half-pixel scroll was ignored in Timex HiRes and HiColor – FIXED 2026-09-18

The B38 residual. TMX-010: zxula.vhd ~397 shifts by `scroll_x(2:0) & fine` in every mode - in HiRes,
where each bit is one 14 MHz pixel, one hires pixel. TS: HiColor now uses the standard renderer (B41),
HiRes adds the fine bit to its shift. WASM: `zxnextUlaRenderHiResScreen` adds it to the source x.

### B43 – TS HiRes colours were fixed when port `$FF` was written – FIXED 2026-09-18

TMX-005. The TS core looked the HiRes ink / paper palette entries up once, in the `$FF` setter, so a
palette write after the mode was set never showed. The VHDL looks up per pixel; since B46 the HiRes
colours come from the attribute decode per pixel (`ulaHiResPixelRgb333`).

### B44 – Port `$FF` bit 6, `$22` bit 2 and `$C4` bit 0 were not one register – FIXED 2026-09-18

TMX-006 / TMX-007. zxnext.vhd ~3607-3632: they are all `port_ff_reg(6)`, the ULA interrupt disable.
- WASM: a port `$FF` write stored bit 6 but did not disable the ULA interrupt, and `in $FF` did not
  see `$22` / `$C4` writes. The port write now sets `ulaInterruptDisabled`, and the readback takes bit 6
  from it.
- TS: `in $FF` took bit 6 (and bit 7) from a copy in the port manager that `$22` / `$C4` never updated,
  and that copy survived a reset (~3610 clears the register on every reset). Bit 6 now comes from the
  interrupt device, bit 7 lives in the screen device next to bits 5-0 and is reset with them.

### B45 – WASM Timex mode changes showed at the beam, not at the next 8-pixel cell – FIXED 2026-09-18

TMX-009. zxula.vhd ~193-210 samples the screen mode with the scroll, once per 8-pixel cell. A mid-line
`OUT ($FF)` moved the edge in 4-pixel steps in WASM (TS was right). Port `$FF` bits 5-0 are now a fourth
pending ULA latch (`ZXNEXT_ULA_LATCH_TIMEX`, with border and scroll - see B40), applied at the next cell;
`$69` writes schedule it too. The Radastan LoRes display file still reads the port value directly
(zxnext.vhd samples it per pixel clock).

### B46 – Timex HiRes ignored ULA+ and ULANext – FIXED 2026-09-18

Found by catalogue §4.11 (`test/zxnext-hw/ula/ulaplus.test.ts`, ULP-008) and ULN-009 (`ulanext.test.ts`).
zxula.vhd ~431: in HiRes attr_reg is the Timex attribute `"01" & not n & n` (n = port `$FF` bits 5-3),
in the paper and the border, and it goes through the same ULANext / ULA+ / standard decode as any
attribute; ULA+ gets index bit 3 from `screen_mode(2)`. So ULA+ HiRes is ink `$D8 + n`, paper and border
`$D8 + 7 - n`; ULANext HiRes is ink `attr AND format`, paper per format, border `$80 + 7 - n` (fallback
for `$FF`). Both cores always used standard BRIGHT ink `8 + n` / paper `24 + 7 - n`; TS's ULANext branch
decoded a stale attribute byte. TS: `ulaHiResPixelRgb333` / `ulaHiResBorderRgb333`; WASM: the HiRes
renderer and border use `zxnextUlaAttrPaletteIndex` / `zxnextUlaBorderPaletteIndexOf` with
`zxnextUlaHiResAttr`. A field-level test of the old cached HiRes colours
(`test/zxnext/UlaRendering.test.ts`) was removed; TMX-005 covers it on the real machine.

### B47 – TS switched LoRes off late and showed a stale ULA line – FIXED 2026-09-18

Found by catalogue §4.12 (`test/zxnext-hw/ula/lores.test.ts`, LOR-009). zxnext.vhd ~6763, ~6879,
~6926: `lores.vhd` runs beside the ULA and `$15` bit 7 replaces the ULA pixel per pixel. The TS core
picked *one* renderer per pixel from a copy of the enable re-sampled only inside the display area, and
did not run the ULA renderer while LoRes was on. LoRes switched off at line 250 therefore stayed on until
the first sample of the next frame's paper, and the ULA started row 0 with a stale shift register (the
test saw row 0 wrong). Now the ULA renderer always runs and the LoRes renderer overwrites its pixel while
`loResEnabled` is set; LoRes leaves the border pixel to the ULA (it has none - relevant for the HiRes
border). The mock `test/zxnext/LoResFixes.test.ts` was replaced by `lores.test.ts`, which checks whole
pictures against a transcription of `lores.vhd` on both cores (every LoRes / Radastan case passed on
both first time; only LOR-009 failed, on TS).

### B48 – `$123B` bit 3 switched the displayed Layer 2 bank – FIXED 2026-09-18

Found by catalogue §4.13 (`test/zxnext-hw/layer2/layer2.test.ts`, L2-004). zxnext.vhd ~2924 uses the
shadow bank `$13` for `$123B` *paging* only; the display takes `nr_12` directly (~4203). Both cores
displayed `$13` while bit 3 was set, so a program drawing into the shadow bank through `$123B` saw it on
screen at once - double buffering broke. TS: the three scanline bank selections use
`layer2ActiveRamBank`; WASM: the three renderers and the raster's "is this write visible" check use
`zxnextLayer2GetActiveRamBank()`. Paging (`MemoryDevice`, `zxnext-memory.c`) still uses the shadow bank.

### B49 – Layer 2 banks past the 2 MB SRAM showed data – FIXED 2026-09-18

L2-024. layer2.vhd: SRAM bank = `$12` + 16 + segment (16K units); when that reaches 128 (address bit 21)
the pixel is disabled. With `$12` = 110 the third segment is past the SRAM: TS showed bytes past its RAM
image, WASM wrapped the read modulo the memory size and showed black. Both now give no pixel
(`getLayer2PixelFromSRAM_Cached` returns -1 / `zxnextUlaReadLayer2Pixel` returns `ZXNEXT_L2_NO_PIXEL`).

### B50 – TS tilemap: fine X scroll and the 80-column last tile were wrong – FIXED 2026-09-18

Found by catalogue §4.14 (`test/zxnext-hw/tilemap/tilemap.test.ts`, TM-002 / TM-015), which checks every
tilemap pixel against a transcription of tilemap.vhd. The TS renderers fetched whole tiles at the
display's 8-pixel cells, so an X scroll that is not a multiple of 8 showed the wrong tile pixels, and the
last 80-column tile was wrong even unscrolled. The four TS renderers (40 / 80 columns, each with a "fast
path", ~750 lines) and their fetch-flag tables are replaced by one per-pixel `renderTilemapPixel` /
`tilemapPixelAt` that follows the VHDL (tilemap x = (x + scroll) mod 320 / 640; map entry; mirror / rotate;
text mode; `$4C` / `$14`; clip). The hardware samples the configuration once per character; the new code
takes the registers per pixel (mid-character register changes differ by under 8 pixels).

### B51 – WASM tilemap: 80-column scroll in the wrong unit, 80-column text lost a pixel – FIXED 2026-09-18

TM-011 / TM-015. In 80 columns tilemap.vhd adds the scroll to the 640-wide x, one unit per 640-res pixel;
WASM added it to the 320-wide clock, moving two pixels per unit. The 80-column text renderer also dropped
the last pixel of every row. The four WASM tilemap renderers are replaced by one per-pixel
`zxnextUlaRenderTilemapScreen`, the same rules as the TS core.

### B52 – 512-tile mode never put tiles below the ULA – FIXED 2026-09-18

TM-010 / TM-012. tilemap.vhd: below = (attr(0) or mode_512) and not on_top - in 512-tile mode every tile is
below the ULA unless `$6B` bit 0. Both cores did the opposite (attr bit 0 became tile bit 8 and nothing
was below); a legacy mock test encoded that and was removed. Also, found by reading the old code (its test
was written with the rewrite): without attributes, 512-tile mode takes tile bit 8 from `$6C` bit 0, which
both cores ignored.

### B53 – TS sprites got a quarter of the line time and dropped sprites – FIXED 2026-09-18

Found by catalogue §4.15 (`test/zxnext-hw/sprites/sprites.test.ts`), which compares whole sprite
pictures with a transcription of sprites.vhd. The TS engine built the next line only in the horizontal
blanking (136 cells x 4 = 544 clocks at 28 MHz) and cut the line when the next sprite's width did not
fit: busy lines lost sprites. sprites.vhd starts the next line at `whc` = 511 and has the whole line
(~1,800 clocks); it gives up only when a drawable sprite qualifies while `whc` is in 288-319 under the
previous sprite's `spr_cur_x_wrap` mask (`spr_cur_notime`), or when the next line reset comes first. The
TS line is now built at once with a clock count and those two rules (`renderSpritesPixel`).

### B54 – Sprite collisions stopped while `$15` bit 0 hid the sprites – FIXED 2026-09-18

SPR-010 / SPR-025. sprites.vhd has no enable: zxnext.vhd ~6880 gates only its pixel into the mixer. Both
cores skipped the engine, so collisions (and time-outs) were never flagged with sprites hidden. TS runs the
engine always and hides the output; WASM's collision pass runs whatever `$15` says. Two legacy tests that
encoded the old behaviour were removed ("is not raised while sprites are disabled", and a TS
"too many sprites per line" pair that assumed the blanking-only budget).

### B55 – Sprite clip window: TS ignored `$19` writes, both ignored y < 224 – FIXED 2026-09-18

SPR-013. Without over-border sprites.vhd shows the `$19` window + 32 *and* only vcounter < 224. TS
recomputed its window only on a `$15` write, so a `$19` change did nothing until then; neither core had
the y < 224 limit (a `$19` y2 above 191 let sprites into the bottom border).

### B56 – WASM never set `$303B` bit 1 ("too many sprites on a line") – FIXED 2026-09-18

SPR-026. The whole-frame WASM sprite renderer had no line time at all. It now computes, per line, where
the engine runs out of time by the same rules as TS (`zxnextUlaComputeSpriteLineCuts`), stops drawing
sprites past the cut and sets the flag.

### B57 – TS sprite tie (`$09` bit 4): `$303B` did not update `$34`; `$34` bit 7 was dropped – FIXED 2026-09-18

SPR-007 / SPR-029. sprites.vhd `mirror_sprite_q` is 8 bits: with the tie a `$34` write sets the sprite
*and* the pattern index (`q(5:0) & q(7) & "0000000"`: bit 7 picks the 128-byte half), and a `$303B` write
updates it. TS kept 7 bits, reset the half, and only followed `$57` auto-increments. `$34` still reads
bits 6-0. Legacy field-level tests in `SpriteDevice.test.ts` / `SpriteDevice-d4d6d7.test.ts` now expect the
8-bit register.

### B58 – The first `$44` byte wrote the palette entry – FIXED 2026-09-18

PAL-003 / PAL-005 (`test/zxnext-hw/palette/palette-registers.test.ts`). zxnext.vhd ~4896: the palette RAM
is written by a `$41` write or by the *second* `$44` byte (`nr_44_we and nr_palette_sub_idx = '1'`, the
sub-index before it toggles); the first byte only goes to `nr_stored_palette_value` (`$28`). Both cores
wrote `byte << 1` into the entry on the first byte and patched bit 0 on the second, so the picture changed
between the two writes and a pair abandoned by a `$40`/`$41`/`$43` write left a half-written colour
behind. Both now store the first byte only and write `stored << 1 | bit 0` on the second.

### B59 – `$44` read and write dropped bit 6 of the second byte – FIXED 2026-09-18

PAL-004. The RAM word is `priority(1:0) & "00000" & colour(8:0)` with priority = the second byte's bits 7-6
(~4898), and the `$44` read is `palette_dat(10:9) & "00000" & palette_dat(0)` (~5994). Neither core stored
bit 6, and both read muxes (`nextRegReadMux.ts`, `zxnext-nextreg.c`) hard-wired bits 6-1 to zero (mask
`$7E` instead of `$3E`). nextreg.txt calls bit 6 reserved; the VHDL reads it back, and nothing displays it.
The cores keep it as entry bit `0x400` next to the Layer 2 priority bit `0x200`.

### B60 – A soft reset reloaded the default palettes – FIXED 2026-09-18

PAL-013. The palette RAMs are `dpram2` instances with no reset; `reset` (~4977-4989) clears only the index,
the sub-index, `$43` and `$28`. Both cores reinitialised all eight palettes on a soft reset. Klive's default
palettes (a stand-in for what the firmware writes after power-on) now load on a hard reset only
(`PaletteDevice.hardReset`, `zxnextPaletteHardReset`), pinned by "Klive's hard reset reloads its default
palettes" in the same file.

### B61 – TS: priority bits made ULA and LoRes colours miss `$14` – FIXED 2026-09-18

PAL-010 / PAL-016 (`palette-display.test.ts`). ULA, LoRes, tilemap and sprite colours are RAM word bits
8-0 (~6933, ~6997); only Layer 2 takes the priority bit. TS returned the whole entry from
`getUlaRgb333` / `getSpriteRgb333` / `getTilemapRgb333`, so a ULA or LoRes entry written through `$44`
with bit 7 set compared `0x200 | colour` with `$14` and never went transparent. The getters mask to 9 bits
(`getLayer2Rgb333` keeps `0x200`). WASM masked already.

### B62 – TS showed colour `$176` as `#B6BDDB` – FIXED 2026-09-18

PAL-015 (all 512 colours through Layer 2). A typo in `zxNextBgra` (`0xffdbbdb6` for `0xffdbdbb6`), the
table that paints the TS screen. The other 511 entries and `zxNextRgb333Codes` match `v<<5 | v<<2 | v>>1`.

### B64 – `$20` writes did nothing – FIXED 2026-09-18

INT-004 / INT-014 / INT-015 (`test/zxnext-hw/interrupts/interrupts.test.ts`). zxnext.vhd ~1902: each set bit
of a `$20` write is an unqualified request (`im2_int_unq`) - line (7), ULA (6), CTC 3-0 - that ignores the
enables: it latches the status and interrupts (a pending request in hardware IM2 mode, a pulse in pulse
mode). TS had an empty write function; WASM stored the byte. Both route it through the new request path.

### B65 – Hardware IM2 mode ignored the CPU's IM; no ULA fallback pulse – FIXED 2026-09-18

INT-003. im2_device asserts INT only while the CPU is in IM 2 (`i_im2_mode`), and only the ULA (the
EXCEPTION generic) pulses instead when it is not. Both cores let the chain interrupt a CPU in IM 0/1 (a
line interrupt ran RST $38) and gave the ULA no pulse. Both also acknowledged the chain on an IM 0/1
acceptance; now only a CPU in IM 2 moves a device to S_ACK.

### B66 – Interrupt status and pending request were one bit – FIXED 2026-09-18

INT-013. im2_peripheral keeps the status latch (`int_status`: every request edge, enabled or not) apart
from the pending request (`im2_int_req`: enabled requests in hardware IM2 mode, cleared only by the RETI
that ends the service). `$C8`-`$CA` read status OR pending; a write clears the status only, in either mode
(nextreg.txt: "in hw im2 mode the status will continue to read as set until the interrupt pending
condition is cleared"). Both cores used the status as the request, cleared it at the acknowledge, read
the in-service flags in hardware IM2 mode and ignored status writes there. Now: `pending[]` next to the
latches, the acknowledge leaves both, RETI clears pending, pulse mode resets the chain (`im2_reset_n`),
and the DMA break-in follows im2_device `o_dma_int` (a device out of S_0), not the status. Legacy
field-level tests of the old model (`test/zxnext/DaisyChain.test.ts`, `NextInterrupts.test.ts`) were
retired; `InterruptDevice.test.ts` / `CtcDevice.test.ts` / `wasm-next-interrupts.test.ts` updated.

### B67 – CTC interrupts: status, `$C5`, and timing – FIXED 2026-09-18

INT-011. A zero count latches `$C9` whether or not the channel's interrupt is enabled (polled mode) -
both cores latched it only when enabled. `$C5` is the channels' own control-word bit 7 (ctc_chan.vhd
`i_int_en_wr`), four channels, bits 7-4 reading 0: TS kept a separate 8-bit copy the CTC never looked at,
WASM did not wire `$C5` at all. And both cores advanced the CTC only on a CTC port access and at the
frame end, so a program that did not touch the CTC ports got at most one CTC interrupt a frame; the CTC
is now brought up to date before INT is sampled (`CtcDevice.sync`, `zxnextCtcSync`).

### B68 – Line interrupt values past the frame wrapped around – FIXED 2026-09-18

INT-008. zxula_timing.vhd compares `int_line_num` = line − 1 (line 0: `c_max_vc`) with `cvc`, so line
`c_max_vc` + 1 fires like line 0 and larger values never fire. Both cores took the line modulo the frame
(313 fired on line 0, 400 on line 87).

### B69 – WASM `$C0` bits 2-1 always read 0 – FIXED 2026-09-18

INT-005. The read used a `cpuInterruptMode` copy nothing updated; it now reads the Z80 core's mode.

### B70 – WASM acknowledged the IM2 chain on the instruction after EI – FIXED 2026-09-18

INT-016 / INT-023. The CPU wrapper acknowledged (device to in-service) whenever INT and IFF1 were set, but
the Z80 core does not take an interrupt on the instruction after EI (`eiBacklog`), with a prefix pending, or
behind an NMI. The device then sat in service without its handler ever running and blocked every device
below it. The wrapper now acknowledges exactly when the core will take the interrupt.

### B71 – Stackless NMI and `$C2`/`$C3` did not follow the VHDL – FIXED 2026-09-18

NMI-004 / NMI-005 (`test/zxnext-hw/nmi/nmi.test.ts`). zxnext.vhd ~2008-2041 with t80n_mcode.vhd ~828-848:
the acknowledge's push always lands in `$C2`/`$C3` (nextreg.txt: "always stored"), and `$C0` bit 3 only
keeps its write cycles off the memory bus. Both cores (1) stored `$C2`/`$C3` only for a stackless NMI;
(2) kept the pending stackless RETN when the handler cleared `$C0` bit 3 (`z80_stackless_retn_en` is
cleared with it, so that RETN pops the stack); (3) never made a Multiface NMI stackless - a workaround
from the original NMI work (`nmi-issue.md`, #1173) for a crash diagnosed alongside other MF bugs. The
VHDL has no source exception, and the MF ROM saves SP at `$0066` (`ld ($3FB1),sp`) and restores it to the
NMI-time value right before its only RETN (`$0592`), so it returns correctly through `$C2`/`$C3`.
(4) The stackless acknowledge took 4 T-states instead of the push's 11. TS now runs the push timing
without the writes; WASM runs the normal acknowledge with MREQ suppressed (`zxnextCpuMreqSuppressed`).
Not verified end to end: returning from the Multiface menu under NextZXOS (the harness cannot drive the
menu - without NextZXOS it does not exit in either mode). Check F9 -> return in the app once.
`test/zxnext/StacklessNmi.test.ts` (mock, asserted (1)) was retired.

### B72 – NMI buttons and `$02` requests waited for their `$06` enable – FIXED 2026-09-18

NMI-003 / NMI-006. zxnext.vhd ~2046-2047, ~2063-2066, ~6294: the M1/DRIVE buttons, `$02` bits 3/2 and the
I/O trap are one-cycle pulses, asserted only while `$06` bit 3/4 is set and latched only while no NMI
source is active. Both cores queued them as pending until the enable was set (a press with the button
disabled fired later), and a request that lost the arbitration stayed queued. TS also set the `$02`
flag during HOLD (`nmi_accept_cause` = 0); WASM already gated it. Both now gate at the request and drop
unlatched pulses after the arbitration.

### B73 – The Next PSGs followed MAME's AY-3-8910, not ym2149.vhd – FIXED 2026-09-18

§4.21 (`test/zxnext-hw/audio/ay-psg.test.ts`, AY-001 - AY-019). Both cores ran a MAME-shaped PSG. Against
ym2149.vhd / turbosound.vhd / zxnext.vhd ~6325: (1) the coarse tone registers counted all 8 bits in YM
mode (the tone period is 12 bits in both modes); (2) the noise period took all 8 bits of R6 (5 bits);
(3) the noise LFSR tapped bits 0 and 3 (VHDL: 0 and 2, seeded 0 with a zero detector); (4) an R13 write
held the envelope's start level for a full step - in the VHDL the restart sets `env_ena`, so the first
step follows at once; (5) `$06` bit 0 (AY mode: 16-entry `volTableAy`, the AY read masks) was ignored,
chips were always YM; (6) `$06` = 11 did not hold the PSGs in reset; (7) R14/R15 read the register while
R7 made the port an input (the pulled-up port reads `$FF`); plus B33. Rewritten as a port of the VHDL:
TS `zxNext/NextPsgChip.ts` (TurboSound no longer uses `zxSpectrum128/PsgChip.ts`), WASM `zxnext-psg.c`.
Legacy mock tests that asserted the MAME behaviour were updated (noise seed, R16-31 writes) or lost
their orphan-sample bookkeeping cases.

### B74 – TS: PSG and beeper sample clocks drifted a sample apart – FIXED 2026-09-18

AY-018 / AY-019, SPD-007. `ZxNextMachine.getAudioSamples` mixes the beeper's samples (a clock that runs on
across frames: 972 or 973 a frame at 48 kHz) with TurboSound's (restarted every frame: always 972) and
filled a missing PSG sample with 0 - a one-sample drop to silence every other frame, which also doubled
the measured pitch error. The PSG now closes its sample whenever the beeper emits one
(`TurboSoundDevice.emitAudioSample`), and its tone clock carries across the frame wrap. WASM mixes every
source on one per-frame clock and was not affected.

### B75 – DAC ports and NextReg mirrors did not follow the decode – FIXED 2026-09-18

§4.22 (`test/zxnext-hw/audio/dac.test.ts`). zxnext.vhd ~2614-2620, ~2664-2681, ~4830, ~5952-5961: (1) TS
wrote Profi Covox `$3F` to channels A and D (it is A only; `$5F` is D); (2) TS let the `$2C`-`$2E` mirrors
write the DACs while `$08` bit 3 held them in reset; (3) reads of `$2C`/`$2D`/`$2E` return the Pi I2S
sample (`$80`, `$00`, `$80` with I2S off) - TS read 0, WASM the DAC channels; (4) both cores let a `$xxF1`
/ `$xxF9` write page memory like `$7FFD`/`$DFFD`/`$1FFD` (or hit `$3FFD`) while Soundrive 2 owns those
ports (`port_fd_conflict_wr`). Legacy mocks `DacPortEnableGating.step21` (Profi A+D) and
`NextRegDevice.test.ts` (`$2C`/`$2E` read 0) were updated.

### B76 – TS: a DAC played its end-of-frame value for the whole frame – FIXED 2026-09-18

DAC-010. `ZxNextMachine.getAudioSamples` mixed the DAC device's current value into every sample of the
frame, so Specdrum/Covox sample playback (many writes a frame) came out as one step per frame. The DAC
now records its output whenever the beeper emits a sample (`DacDevice.recordSample`) and the mixer takes
the recorded value (`AudioMixerDevice.setDacOutput`). The record is dropped on reset: the first frame
after a reset starts without `onNewFrame`. WASM reads the DAC at each sample and was not affected.

### B77 – The mixer did not weigh its sources as audio_mixer.vhd does – FIXED 2026-09-18

BEEP-004. audio_mixer.vhd sums EAR 512, MIC 128, the AY (a full YM channel 255) and the DACs (4 per
step). Both cores weighted EAR 12x and the AY by psg/48, so the beeper was 5.1x a full AY channel (VHDL
2.0x, and it clipped on its own) and a full DAC channel 0.75x (VHDL 4.0x). Now the VHDL units times one
gain, `MIXER_GAIN` = 29.44 (TS `AudioMixerDevice`, WASM `ZXNEXT_MIXER_GAIN`). **The gain is the
project author's choice (2026-09-18): a full AY channel keeps its earlier level (7507)** - so the beeper
is ~7 dB quieter than before, the DACs ~15 dB louder, and sums above ~1110 units (several loud sources
at once) clamp. The legacy mixer mocks (`AudioMixerDevice.step8`, `AudioMixing.step17`,
`BeeperFpga.step22`) now state their expectations in VHDL units.

### B78 – WASM ignored `$06` bit 6 (beeper to the internal speaker only) – FIXED 2026-09-18

BEEP-003. zxnext.vhd ~6450: with `$06` bit 6 and `$08` bit 4 set (`beep_spkr_excl`), EAR and MIC leave the
mix. TS did this in `getAudioSamples`; WASM mixed the beeper regardless.

### B79 – WASM dropped 0.45 of a sample every frame – FIXED 2026-09-18

BEEP-008. The WASM mixer restarted its sample clock at every frame start, so a frame gave 972 samples at
48 kHz instead of 972.45 on average (an effective 47 978 Hz). The schedule now carries across the frame
wrap (`zxnextAudioMixerOnFrameWrap`), as the TS beeper clock does.
- **Regression found and fixed the same day:** the IDE's per-instruction loop
  (`ZxNextWasmV2Machine.executeWasmV2DebugLoop`, which carries the whole NextZXOS boot of a NEX launch)
  never calls `zxnextBeginAudioMixerFrame`, so the 2048-sample buffer fills and stays full. With the
  schedule carried back at every wrap, each T-state then re-ran the beeper/PSG refresh for a sample it
  could not store (~300 ms a frame): a NEX launched from the NEX viewer never finished booting, while a
  normal start (`zxnextExecuteFrame`) was fine. A full buffer now drops the sample and keeps the schedule
  moving. Guard: `test/wasm/zxNext/wasm-next-audio-debug-loop.test.ts`. The debug loop still produces no
  audio (as before) - it would need `BeginFrame` at its frame starts.

### B80 – WASM: sprite-port writes made frames 3x too slow (ScrollNutter at "half speed") – FIXED 2026-09-18

Reported from the app: ScrollNutter.nex moved about half as fast as on the hardware. The emulation was
right (IM2 handler and raster-synced main loop once a frame, 28 MHz, on both cores) but too slow: 29 ms
per frame on the WASM core, over the 20 ms real time allows (the same at the pre-4.20 commit, so not a
new regression). Profile: 69 % in `zxnextUlaProcessSprites`. The beam-racing raster re-renders what the
beam has drawn at every picture-changing port write - each byte ScrollNutter's DMA sends to the sprite
ports - and each such partial render recomputed the sprite line-timing table for all 256 lines x 128
sprites (`zxnextUlaComputeSpriteLineCuts`). The table is per line, so a partial render now computes only
the rows it draws; the once-a-frame collision pass still computes all of them. ScrollNutter: 29.4 ->
9.6 ms a frame. Guard: `test/wasm/zxNext/wasm-next-raster-sprite-cost.test.ts` (fails at 9.6x with the old
code). Still open: the TS core runs ScrollNutter at ~25 ms a frame (not the default core); and each
catch-up still re-renders every layer for the touched rows, so a program writing the sprite ports tens
of thousands of times a frame stays expensive by design.

### B81 – CTC trigger inputs: the chain ignored the ring order and waiting timers never started – FIXED 2026-09-18

CTC-008 / CTC-009. zxnext.vhd ~4064 wires the trigger inputs as a ring (`ctc_zc_to(2 downto 0) &
ctc_zc_to(3)`: channel 0 is clocked by channel 3). Both cores' batch update (`CtcDevice.advanceToSysClock`,
`zxnextCtcAdvanceToSysClock`) advanced counter-mode channels in index order, so a counter read its
upstream's ZC/TO count before that channel had been advanced: a chain crossing the wrap (timer 2 ->
counter 3 -> counter 0) left channel 0 at 0 for good. And the batch only advanced RUNNING channels, so a
timer with D3 (ctc_chan.vhd S_WAIT: wait for a trigger edge) was never started by its upstream ZC/TO -
only a D4 change on a control-word write started it. Now the trigger-driven channels (running counters,
waiting D3 timers) are walked round the ring from a channel that runs on its own, and a waiting timer
starts at its upstream's first ZC/TO in the window (exact when the upstream is a timer, at the window
end when it is a counter - a window is at most one instruction).

### B82 – The DMA was a MAME Z80 DMA, not the Next's dma.vhd – FIXED 2026-09-18

DMA-001 - DMA-023. Both cores ported MAME's z80dma (with specnext overrides); the FPGA's DMA is its own
design ("loosely based on the Z80C10 - there are differences"). Rewritten from `device/dma.vhd` in
`DmaDevice.ts` and a line-by-line `zxnext-dma.c`, behind the same machine API. What was wrong:
- **Clock.** The DMA is clocked by the CPU clock (`clk_i => i_CLK_CPU`), so a byte takes 6 CPU clocks
  (the timing bytes: 2/3/4 per cycle, which were ignored), not 6 clocks of 28 MHz: at 3.5 MHz a
  256-byte copy stopped the CPU for 256 T-states instead of 1536. The prescaler was 8x too fast at
  3.5 MHz (`P x 4 x (1 << speed)` 28 MHz clocks instead of 32P at every speed). Continuous mode ignored
  the prescaler; byte mode released the bus (the VHDL has no byte mode - it is continuous).
- **Counter and length.** Counts up from 0 (zxnDMA) or $FFFF (Z80 DMA, set by the port of the last
  access - at LOAD, CONTINUE and auto restart only) while counter < length: length 0 moves one byte in
  both modes (it moved none), and the counter reads back = bytes moved (MAME left it one past). $87 no
  longer resets the counter; $D3 resets it by mode.
- **Status and reads.** Status is "00" & end_of_block_n & "1101" & at_least_one ($3A idle, $1A done,
  $3B mid-transfer; it read $30/$19). The read mask resets to $7F (it was 0: every read gave the
  status); $BF makes only the next read the status; auto restart leaves end-of-block reached.
- **Write sequencer.** WR0 search bits are ignored (every WR0 transfers; search mode wrote nothing);
  WR4's interrupt control byte is not consumed after a port B address, and WR4 with only D4 leaves the
  sequencer deaf until reset; WR1's second timing byte is swallowed.
- **Interrupt break-in** (`im2_dma_delay`) is read as a level from the interrupt controller, and a DMA
  that holds the bus across a frame end now lets the frame loop start the next frame before it goes on
  (`ZxNextMachine.isCpuSnoozed`, `zxnextCpuRunDma` returning 1): otherwise the new frame's interrupts were
  not raised until the whole transfer ended, so `$CC`-`$CE` break-ins never happened in long transfers.
The 30 MAME-model mock files `test/zxnext/DmaDevice*.test.ts` and `wasm-next-dma-parity.test.ts` were
retired; `wasm-next-dma.test.ts` now checks the two cores' sequencers byte for byte. Still not modelled:
the 14 MHz `dma_rw_extend` quirk, the RETI-decode extension of `im2_dma_delay` (sub-instruction effects),
and the NMI term of `im2_dma_delay` (`nmi_activated and $CC bit 7`: the bit is stored, nothing reads it).

### B83 – DivMMC: mapram clear, ROM-3 entry points, RETN, port enable, delayed unmap – FIXED 2026-09-18

DIV-003, DIV-006, DIV-008, DIV-010 - DIV-012.
- **`$09` bit 3** clears mapram at once (zxnext.vhd ~4164); both cores only let a later `$E3` write with
  bit 6 = 0 clear it. A write ORs mapram in, as before.
- **ROM-3-only entry points** (`$B9` bit = 0, `$04C6`/`$0562`/`$04D7`/`$056A`, `$3Dxx`) need the ROM itself
  paged in at the fetch address (`sram_divmmc_automap_rom3_en` needs `sram_pre_override(0)`): with MMU0/1
  mapping RAM, both cores still mapped on ROM selection alone. "Always" entry points still work there.
- **RETN**: only `ED 45` (im2_control `o_retn_seen` = S_ED45_T4) unmaps. WASM also unmapped on RETI and
  the RETN aliases; TS unmapped at the next opcode fetch (`afterOpcodeFetch` saw the flag), so a RETN
  into `$0000`-`$3FFF` fetched its first opcode from DivMMC. TS now unmaps in `onRetnExecuted`.
- **Port enable** (`$83` bit 0, divmmc.vhd `i_en`) gates the paging: TS kept conmem paged in.
- **Delayed map/unmap timing**: automap_held follows hold once MREQ goes high after the M1 fetch, so a
  delayed entry point's operands and the `$1FF8` instruction's operands come from the new mapping. WASM
  applied it after the whole instruction; `z80.c` now has a `Z80_AFTER_OPCODE_FETCH()` hook (a no-op for
  the Spectrum cores) where the Next calls `zxnextDivMmcAfterM1`, as TS does in `afterOpcodeFetch`.
Not changed: the catalogue said mapram survives a soft reset; the VHDL clears all of `$E3` on any reset,
which both cores already did.

### B84 – Multiface: RETI paged out, `$DFFD` bit 6, port-enable reset, NMI END state – FIXED 2026-09-18

MF-003, MF-004, MF-006.
- **RETI** (and the RETN aliases) paged the Multiface out and ended its NMI in both cores; `cpu_retn_seen`
  is `z80_retn_seen_28` = im2_control S_ED45_T4, exactly ED 45 (the same rule as B83 for DivMMC).
- **`$DFFD` read-back** on MF+3 (`$DF3F`) is '0' & dffd(6) & '0' & dffd(4-0); both cores stored only bits
  4-0. `MemoryDevice.portDffdReadback` / `zxnextMemoryGetPortDffdReadback` now keep bit 6.
- **Port enable** `$83` bit 1 holds the device in reset (`reset <= reset_i or not enable_i`); WASM only
  gated its outputs, so re-enabling brought the old paging back.
- **NMI state machine**: S_NMI_END lasts one CPU clock, but both cores stepped the machine once per opcode
  fetch, so END lasted a whole instruction and a cause raised by it (a `$02` write right after the MF+3
  handler's disable-port read) was dropped. HOLD now passes through END to IDLE in one step
  (`stepNmiStateMachine`, `zxnextNmiBeforeOpcodeFetch`); `test/zxnext/NmiStateMachine.test.ts` updated.

### B85 – Config mode: NextReg `$04` was stored but never mapped – FIXED 2026-09-18

MEM-026. zxnext.vhd ~2994-3000: in config mode, `$0000-$3FFF` with the ROM paged (MMU0/1 = $FF) shows
SRAM 16K bank `nr_04_romram_bank & A13`, writable, with no Alt ROM; the Multiface, MMU RAM, DivMMC and
Layer 2 go above it. This is how the firmware loads the ROMs, the DivMMC ROM and the Multiface ROM. Both
cores ignored it (`MemoryDevice.configRomRamBank` was written, nothing read it). Now `setRamSlotByMmu` /
`zxnextMemorySetRamPageByMmu` map it, and `$03` (entering or leaving config mode) and `$04` remap.

### B86 – SD card model: CMD0 before the size, idle $FF bytes, empty slots, CMD18's R1 – FIXED 2026-09-18

SPI-003, SPI-006, SPI-007 (the card follows the SD Physical Layer spec, SPI mode; both cores).
- **CMD0 answered $00 ("no card") until the first sector read**: the card size is fetched from the host
  lazily at the first frame command, and "size 0" meant "no card". The app always has a card; card 0
  now counts as present until the host reports no sectors.
- **A $FF written between commands started a command** and swallowed the next one; a command byte is
  `01xxxxxx`, anything else is ignored while idle.
- **An empty slot answered**: card 1 (never given an image by the app) returned R1 $00; an absent card
  never drives MISO, so the bus reads $FF and writes go nowhere.
- **CMD18 lost its R1**: the host's first sector reply replaced the queued R1, so a driver took the $FE
  token for R1 and read every block one byte late. The first block now carries R1 and a gap byte.
Harness: `attachSdCard` / `runFramesAsync` / `runUntilReadyAsync` (README "Session API") serve an image
from memory - or a CIM clone - through the machines' own `processFrameCommand`. Not modelled: CMD25
(multi-block write) in either core; the flash chip on $E7 = $7F.

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
