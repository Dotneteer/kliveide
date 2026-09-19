# ZX Spectrum Next Hardware Test Catalogue – Plan

Created: 2026-09-17. Status: **catalogue only – nothing below is implemented** unless the
*Existing coverage* column of §3 says so.

## 1. Purpose

A complete list of hardware-level tests that tell us whether the ZX Spectrum Next emulator (both the
TypeScript core and the production WASM core) behaves like the FPGA. Every entry has an ID, a name and
a description concrete enough to write the test from without further design work.

All tests use the harness in `test/harness/zxnext/` (read its `README.md` first):

- **Scripted tests** – `createSession(core)`, `describe.each(ALL_CORES)`, in
  `test/zxnext-hw/<area>/<id-lower>-<slug>.test.ts`.
- **Screen cases** – `test/visual/<suite>/<ID>-<slug>/` with `program.asm`, `case.json`, `expect.md`
  (read `.ai/visual-tests-guide.md` first).

The reference for every expectation is the VHDL in `_input/next-fpga/src` (file names are given per
area). **Never derive an expectation from emulator output.** Where a description says "per `x.vhd`",
the exact value has to be read from that file when the test is written.

## 2. Conventions used in the catalogue

### 2.1 IDs

`<AREA>-<NNN>`, e.g. `L2-012`. Areas are listed in §3. Numbers are stable: a dropped test keeps its
number (mark it *withdrawn*), new tests are appended. Screen cases use the ID as their folder prefix
(`test/visual/layer2/L2-012-scroll-wrap/`); the existing copper suite keeps its short IDs (`C00`…`P02`),
which are referenced in the *Existing coverage* column rather than renamed.

### 2.2 Front end (column **FE**)

| Code | Meaning |
|---|---|
| **S** | Scripted test: registers, ports, NextRegs, memory, timing (`runFrames`, `runTo`, `step`). |
| **P** | Scripted test that checks a few pixels (`pixel`, `rowRuns`, `expectProbe`). |
| **V** | Declarative screen case (probes, parity, golden, AI review). Add `browser` tier when noted. |
| **A** | Scripted audio test (`createSession(core, { audioSampleRate })`, `startAudio`, `audio`). |

### 2.3 Harness capabilities not written yet (column **Needs**)

The README lists these as candidates. A test tagged with one is blocked until the session method
exists (add it per README "Adding a method", with a self-test on both cores).

| Tag | Session capability to add |
|---|---|
| `key` | Keyboard matrix input (`setKeyStatus`) including the Next extended keys. **Written 2026-09-19:** `keyDown`, `keyUp`; both cores now take the 16 extra keys (codes 40-55). |
| `joy` | Joystick / MD pad input on both joystick connectors. **Written 2026-09-19:** `joystick(side, ...buttons)` (the connector's 12-bit output). |
| `mouse` | Kempston mouse movement and buttons. **Written 2026-09-19:** `mouse({ dx, dy, wheel, buttons })` (one PS/2 packet). |
| `intack` | Observe the INT line and the vector placed on the bus at interrupt acknowledge. |
| `nmi` | Press the Multiface / DivMMC NMI buttons. **Written 2026-09-18:** `pressHotkey("F9" \| "F10")`. |
| `iolog` | Port and memory write log (both cores). |
| `sd` | SD card image attach and block access (the browser tier already has it). **Written 2026-09-18:** `attachSdCard(image \| backing)`, `runFramesAsync`, `runUntilReadyAsync`, `sdImage`, `sdCalls`. |
| `uart` | A peer on the UART lines (loopback or scripted ESP/Pi responder). **Written 2026-09-18:** `uartSend`, `uartBreak`, `uartSetCts`, `uartLoopback`, `uartReadyToReceive`, `uartOutput`; both cores now time the lines a frame at a time on the 28 MHz clock. |
| `rtc` | I2C RTC with a settable time. **Written 2026-09-18:** `setRtcTime`; both cores now emulate the DS1307. |
| `tape` | EAR input (tape signal injection). |
| `ckpt` | Checkpoints on both cores (`captureCheckpoint` is WASM-only today). |

### 2.4 Standing rules for every test (from the harness README)

1. Both cores, unless the description says why not.
2. Drive through the hardware interface (Z80 code, `out`, `setNextReg`, `poke`).
3. Observe through the hardware interface (`in`, `peek`, registers, pixels, audio; `nextRegValue` for
   stored values).
4. Write every palette entry the test relies on; do not assume reset values NextZXOS changes (`$07`,
   `$15`, `$43`, …) when the case also runs in the browser tier.
5. A core that fails for a known reason gets `it.fails` / `knownFailures` naming the bug (B-number in
   `.plans/ZX_NEXT_EMULATOR_BUGS_HANDOVER.md`) – never a loosened expectation.

### 2.5 Priority (column **Pri**)

- **1** – core correctness most software depends on; also everything that guards a known bug.
- **2** – documented features used by a meaningful part of Next software.
- **3** – rare features, board-level peripherals, or behaviour that is only partly emulated.

## 3. Areas

| Prefix | Area | VHDL reference | Existing coverage |
|---|---|---|---|
| `NR` | NextReg access, identity, reset values | `zxnext.vhd` | `test/zxnext-hw/nextreg/fallback-colour-reset.test.ts` |
| `RST` | Reset types, machine type, config mode | `zxnext.vhd` | – |
| `CPU` | Z80N extended instructions at machine level | `cpu/t80n*.vhd` | `test/z80` (CPU in isolation) |
| `SPD` | CPU speed / turbo | `zxnext.vhd` | – |
| `MEM` | MMU, 128K/+3/Pentagon paging, ROMs, Alt ROM | `zxnext.vhd` | `test/zxnext/MemoryDevice.test.ts` (mock) |
| `PORT` | Port decoding, internal port enables, floating bus | `zxnext.vhd` | `test/zxnext/PortEnableGating.test.ts` (mock) |
| `VT` | Video timing, line counters, 50/60 Hz, machine timings | `video/zxula_timing.vhd` | C00 |
| `ULA` | Standard ULA screen, border, flash, clip, scroll | `video/zxula.vhd` | T00, C04, C09, C11 |
| `TMX` | Timex modes: shadow screen, HiColor, HiRes | `video/zxula.vhd` | – |
| `ULN` | ULANext palette mode | `video/zxula.vhd` | `test/zxnext-hw/ula/ulanext-ulaplus.test.ts` (written 2026-09-17 for bug B7, before this catalogue) |
| `ULP` | ULA+ | `video/zxula.vhd` | `test/zxnext-hw/ula/ulanext-ulaplus.test.ts`, `ulaplus-ports.test.ts` (written 2026-09-17 for bugs B7 and B12, before this catalogue) |
| `LOR` | LoRes / Radastan | `video/lores.vhd` | `test/zxnext-hw/ula/lores.test.ts` (replaced the mock `test/zxnext/LoResFixes.test.ts`, 2026-09-18) |
| `L2` | Layer 2 (256×192, 320×256, 640×256) | `video/layer2.vhd` | L01, P01, `test/zxnext-hw/layer2/layer2.test.ts` (D1-D5 of the mock `test/zxnext/Layer2Fixes.test.ts` moved there) |
| `TM` | Tilemap | `video/tilemap.vhd` | P02, `test/zxnext-hw/tilemap/tilemap.test.ts` (replaced the field-level mocks `test/zxnext/TilemapDevice-compositing.test.ts` and D1 of `TilemapDevice-d1d2.test.ts`) |
| `SPR` | Sprites | `video/sprites.vhd` | `test/zxnext-hw/sprites/sprites.test.ts`, `sprite-collision.test.ts`, `attribute-mirror.test.ts` |
| `PAL` | Palettes and global transparency | `zxnext.vhd` | C02, C04, C05, `test/zxnext-hw/palette/palette-registers.test.ts`, `palette-display.test.ts` (replaced the mocks `test/zxnext/PaletteDevice.test.ts` and `PaletteDeviceFpgaFixes.test.ts`, 2026-09-18) |
| `CMP` | Layer compositing, priorities, blend modes, fallback | `zxnext.vhd` | P01, P02, C10 (bug B6), `test/zxnext-hw/layers/blend-and-border.test.ts`, `compositing.test.ts` (with `_mixer-model.ts`) |
| `COP` | Copper | `device/copper.vhd` | C00–C11, D01–D05, `copper-upload.test.ts` (bugs B4, B5), `copper-control.test.ts` (B9, B63) |
| `INT` | Interrupts: ULA, line, IM2 hardware mode, priorities | `device/im2_*.vhd` | D04, `test/zxnext-hw/interrupts/interrupts.test.ts` (replaced the mocks `test/zxnext/DaisyChain.test.ts` and `NextInterrupts.test.ts`, 2026-09-18) |
| `NMI` | NMI sources, stackless NMI | `zxnext.vhd` | `test/zxnext-hw/nmi/nmi.test.ts` (replaced the mock `test/zxnext/StacklessNmi.test.ts`, 2026-09-18) |
| `AY` | AY-3-8912 / TurboSound | `audio/turbosound.vhd`, `audio/ym2149.vhd` | `test/zxnext-hw/audio/ay-psg.test.ts`, `ay-stereo-mode.test.ts` (shared measurements in `audio/_audio-helpers.ts`) |
| `DAC` | Soundrive / Covox / Specdrum DACs | `audio/soundrive.vhd` | `test/zxnext-hw/audio/dac.test.ts`, `dac-enable.test.ts` |
| `BEEP` | Beeper, MIC, EAR, audio mixer | `audio/audio_mixer.vhd` | `test/zxnext-hw/audio/beeper-mixer.test.ts` |
| `CTC` | Z80 CTC (4 channels) | `device/ctc*.vhd` | `test/zxnext-hw/ctc/ctc.test.ts` (replaced the machine-level half of the mock `test/zxnext/CtcDevice.test.ts` and two of the three `test/wasm/zxNext/wasm-next-ctc.test.ts` tests, 2026-09-18; the per-clock `CtcChannel` tests stay) |
| `DMA` | ZXN DMA / Z80 DMA | `device/dma.vhd` | `test/zxnext-hw/dma/dma.test.ts` (replaced the 30 MAME-model mocks `test/zxnext/DmaDevice*.test.ts`, 2026-09-18; bug B82) |
| `DIV` | DivMMC paging and automap | `device/divmmc.vhd` | `test/zxnext-hw/divmmc/divmmc.test.ts` (2026-09-18, bug B83); the mocks `test/zxnext/DivMmcDevice-*.test.ts`, `DivMmmc.test.ts` still pass and stay (NMI/Multiface interplay) |
| `MF` | Multiface | `device/multiface.vhd` | `test/zxnext-hw/multiface/multiface.test.ts` (2026-09-18, bug B84); the mocks `test/zxnext/Multiface*.test.ts` still pass and stay |
| `SPI` | SPI master, SD card, flash | `serial/spi_master.vhd` | `test/zxnext-hw/sd/spi-flash-select.test.ts` (bug B2), `sd-card.test.ts`, `nextzxos-boot.test.ts` (2026-09-18, bug B86) |
| `UART` | UART 0 (ESP) / UART 1 (Pi) | `serial/uart*.vhd` | `test/zxnext-hw/uart/uart.test.ts` (2026-09-18, bug B87; replaced the mock `test/zxnext/UartDevice.test.ts` and the UART half of `test/wasm/zxNext/wasm-next-uart-i2c.test.ts`; its I2C half went with §4.30) |
| `I2C` | I2C bus, RTC | `zxnext.vhd`, Maxim DS1307 datasheet | `test/zxnext-hw/i2c/i2c-rtc.test.ts` (2026-09-18, bug B89; replaced the device mocks of `test/zxnext/I2cDevice.test.ts`, which keeps the pure BCD / counter-chain tests, and `test/wasm/zxNext/wasm-next-i2c.test.ts`) |
| `KEY` | Keyboard, extended keys | `input/membrane`, `input/keyboard` | `test/zxnext-hw/keyboard/keyboard.test.ts` (2026-09-19, bug B90) |
| `JOY` | Joysticks, MD pads, I/O mode | `input/md6_joystick_connector_x2.vhd`, `input/membrane/membrane_stick.vhd` | `test/zxnext-hw/joystick/joystick.test.ts` (2026-09-19, bug B91; replaced the mock `test/zxnext/KempstonJoystick.test.ts` and the joystick half of `test/wasm/zxNext/wasm-next-input.test.ts`) |
| `MOU` | Kempston mouse | `input/ps2_mouse.v` | `test/zxnext-hw/mouse/mouse.test.ts` (2026-09-19, bug B92; replaced the mock `test/zxnext/KempstonMouse.test.ts` and `test/wasm/zxNext/wasm-next-input.test.ts`) |
| `FDC` | +3 FDC I/O traps | `zxnext.vhd` | – |
| `BUS` | Expansion bus control | `zxnext.vhd` | `test/zxnext/ExpansionBus*.test.ts` (mock) |
| `GPIO` | Pi / ESP GPIO, XADC, misc board registers | `zxnext.vhd` | – |
| `PAR` | Long-running cross-core parity and soak | – | D05 |

---

## 4. Catalogue

### 4.1 `NR` – NextReg access, identity, reset values

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| NR-001 | Select/read round trip | S | 1 | | Write `$7F` via `$243B`/`$253B` with several values; `$243B` then `$253B` read returns each. Proves the register-select latch. | ✅ `nextreg/register-select` |
| NR-002 | `$243B` select persists | S | 1 | | Select `$7F`, write, perform unrelated `out`s to other ports, read `$253B` again: still `$7F`'s value. | ✅ `nextreg/register-select` |
| NR-003 | `$243B` read back | S | 2 | | After `out $243B,$15`, `in $243B` returns the selected register number (zxnext.vhd ~4583); a reset selects `$24` (~4575). | ✅ `nextreg/register-select` |
| NR-004 | Z80N `NEXTREG n,v` equals port path | S | 1 | | Same writes via `ED 91` and via ports produce identical `nextRegValue`; the `$243B` selection after `NEXTREG` matches the VHDL. | ✅ `nextreg/register-select` |
| NR-005 | `NEXTREG n,A` | S | 1 | | `ED 92` writes register `n` from A for several n/A pairs. | ✅ `nextreg/register-select` |
| NR-006 | Machine ID `$00` | S | 1 | | Reads the emulator's configured machine ID (`g_machine_id`); constant across resets. | ✅ `nextreg/identity` |
| NR-007 | Core version `$01`/`$0E` | S | 2 | | Major/minor in `$01`, sub-version in `$0E`, consistent with the version string the app reports. | ✅ `nextreg/identity` |
| NR-008 | Board issue `$0F` | S | 3 | | Upper nibble reads 0. | ✅ `nextreg/identity` |
| NR-009 | Unused register reads | S | 2 | | Reads of unassigned registers (e.g. `$0C`, `$0D`, `$1D`, `$21`, `$24`, `$25`, `$3A`–`$3F`, `$45`–`$49`, `$58`–`$5F`, `$65`–`$67`, `$72`–`$7E`, `$FE`) return the VHDL default (`others =>` branch). | ✅ `nextreg/read-mux` |
| NR-010 | Write-only bits read as 0 | S | 2 | | For each register whose read mux pads bits with `'0'` (e.g. `$0A` bit 5/1, `$22` bits 6–3, `$6E` bit 6), write `$FF` and assert padded bits are 0. | ✅ `nextreg/read-mux` |
| NR-011 | User register `$7F` | S | 1 | | Full 8-bit read/write; soft reset behaviour per VHDL. | ✅ `nextreg/read-mux`, `nextreg/soft-reset` (power-on / hard reset `$FF`, bug B88) |
| NR-012 | Hard-reset values table | S | 1 | | One parametrised test: after `hardReset()`, every register in the read mux equals its VHDL reset value (`$14=$E3`, `$4A=$E3`, `$4B=$E3`, `$4C=$0F`, `$50–$57`, `$15`, `$43`, `$68`, `$6B`, `$70`, …). Guards bug B3. | ✅ `nextreg/soft-reset`, `nextreg/fallback-colour-reset` |
| NR-013 | Soft-reset values table | S | 1 | | Same as NR-012 after `reset()`: registers reset on soft reset change, registers reset only on hard reset keep a value written before. | ✅ `nextreg/soft-reset`, `nextreg/fallback-colour-reset` |
| NR-014 | `$1C` clip index readback | S | 2 | | `$18`-`$1B` read the clip value at the current index (~5892); writes advance it; `$1C` shows each 2-bit index and a write with bit n set resets index n. | ✅ `nextreg/composite-readbacks` |
| NR-015 | `$34` sprite mirror index readback | S | 2 | | `$34` read returns the selected sprite number with bit 7 = 0. | ✅ `nextreg/composite-readbacks` |
| NR-016 | `$28` stored palette value | S | 2 | | After a `$44` first-byte write, `$28` returns that byte (`nr_stored_palette_value`). | ✅ `nextreg/composite-readbacks` |
| NR-017 | `$69` display control 1 readback | S | 2 | | Bit 7 mirrors `$123B` Layer 2 enable, bit 6 the `$7FFD` shadow flag, bits 5–0 port `$FF`; writing `$69` changes all three sources. | ✅ `nextreg/composite-readbacks` |
| NR-018 | `$8E` composite readback | S | 1 | | After various `$7FFD`/`$DFFD`/`$1FFD` writes, `$8E` returns the bit formula in the read mux. | ✅ `nextreg/composite-readbacks` |

### 4.2 `RST` – Reset types, machine type, config mode

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| RST-001 | `$02` soft reset | S | 1 | | Program writes `$02` bit 0; machine resets, PC = 0, RAM kept, soft-reset registers reset. | ✅ `reset/reset-register` |
| RST-002 | `$02` hard reset | S | 1 | | Bit 1 performs hard reset: all hard-reset registers restored; `$02` reset type bits reflect the last reset. | ✅ `reset/reset-register` |
| RST-003 | Reset type readback | S | 2 | | `$02` bits 1–0: `10` after a hard reset (the firmware's soft reset after a core load), `01` after every later soft reset (zxnext.vhd ~1691, nextreg.txt). | ✅ `reset/reset-register` |
| RST-004 | `$02` generate DivMMC NMI | S | 2 | | Bit 2 raises an NMI routed to DivMMC (PC lands at `$0066` with DivMMC paged if automap/NMI enabled). | ✅ `reset/reset-register` |
| RST-005 | `$02` generate Multiface NMI | S | 2 | | Bit 3 raises the Multiface NMI (with `$06` bit 3); the flag stays set until `$02` is written with bit 3 = 0 (zxnext.vhd ~3820). | ✅ `reset/reset-register` (incl. MF ROM/RAM paging and RETN) |
| RST-006 | `$02` I/O trap flag | S | 3 | | Bit 4 reflects `nr_02_iotrap` after an FDC trap (see FDC-003). | ✅ `reset/reset-register` |
| RST-007 | `$03` machine type in config mode | S | 1 | | With `$03` low bits = `111` (config mode) writes to machine type are accepted; outside config mode they are ignored as the VHDL describes. | ✅ `reset/machine-type` |
| RST-008 | `$03` timing selection | S | 1 | | Bits 6–4 select 48K / 128K / +3 / Pentagon timing; `$03` readback and the frame length (tacts per frame, lines per frame) follow (see VT-002). | ✅ `reset/machine-type` (readback, frame length and picture per timing) |
| RST-009 | `$03` user DT lock | S | 3 | | Bit 3 locks the display timing; later timing writes are ignored. | ✅ `reset/machine-type` |
| RST-010 | `$03` bit 7 palette sub-index readback | S | 2 | | Bit 7 reads `nr_palette_sub_idx` (1 between the two `$44` bytes). | ✅ `reset/machine-type` |
| RST-011 | `$0A` MF type only in config mode | S | 3 | | Bits 7–6 change only when config mode is set (read mux of `$0A`). | ✅ `reset/machine-type` |
| RST-012 | Config mode leaves via `$03` | S | 2 | | Writing a non-`111`, non-zero machine type clears config mode; zero leaves it unchanged. Guards bug B2 dependency. | ✅ `reset/machine-type` |
| RST-013 | Soft reset keeps RAM, clears paging | S | 1 | | After `reset()`, bank contents written before reset survive; MMU, `$7FFD`, `$1FFD`, `$DFFD` are at reset values. | ✅ `reset/soft-reset-memory` |
| RST-014 | Soft reset keeps copper RAM | S | 1 | | Upload a list, soft reset, set `$62` run: list executes without re-upload. Guards bug B5. | ✅ `copper/copper-upload` |

### 4.3 `CPU` – Z80N instructions at machine level

The instruction-level suites in `test/z80` test the CPU in isolation. These tests confirm the same
behaviour inside the whole machine on both cores (memory paging, contention off, port side effects).

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| CPU-001 | `SWAPNIB` | S | 2 | | `ED 23`: A=`$1F` → `$F1`; flags unchanged. | ✅ `cpu/z80n-instructions` |
| CPU-002 | `MIRROR A` | S | 2 | | `ED 24`: A=`$01` → `$80`, `$C3` → `$C3`. | ✅ `cpu/z80n-instructions` |
| CPU-003 | `TEST n` | S | 2 | | `ED 27 n`: flags as `AND n`, A unchanged. | ✅ `cpu/z80n-instructions` |
| CPU-004 | `BSLA/BSRA/BSRL/BSRF/BRLC DE,B` | S | 2 | | `ED 28`–`ED 2C` with several B shift counts (B bits 4–0; ≥16 shifts everything out; BSRF fills with 1s). | ✅ `cpu/z80n-instructions` |
| CPU-005 | `MUL DE` | S | 2 | | `ED 30`: D×E → DE for edge values (`$FF×$FF`). | ✅ `cpu/z80n-instructions` |
| CPU-006 | `ADD HL/DE/BC,A` | S | 2 | | `ED 31`–`ED 33`: A zero-extended; carry cleared, other flags kept (t80n.vhd ~762-785). | ✅ `cpu/z80n-instructions` (B22 fixed) |
| CPU-007 | `ADD HL/DE/BC,nn` | S | 2 | | `ED 34`–`ED 36` with wrap-around at `$FFFF`. | ✅ `cpu/z80n-instructions` |
| CPU-008 | `PUSH nn` | S | 2 | | `ED 8A hi lo` (big-endian operand): stack contains nn, SP −2. | ✅ `cpu/z80n-instructions` |
| CPU-009 | `OUTINB` | S | 2 | | `ED 90`: outputs (HL) to port BC, HL+1, B unchanged. Verify with a port that stores (e.g. `$7F` via `$253B` after selecting). | ✅ `cpu/z80n-instructions` |
| CPU-010 | `NEXTREG` inside paged ROM/RAM | S | 1 | | `ED 91`/`ED 92` executed from a MMU-paged bank at `$C000` behave identically. | ✅ `cpu/z80n-instructions` |
| CPU-011 | `PIXELDN` / `PIXELAD` / `SETAE` | S | 2 | | `ED 93`–`ED 95` produce the ULA display-file address/mask formula from the Z80N spec. | ✅ `cpu/z80n-instructions` |
| CPU-012 | `JP (C)` | S | 2 | | `ED 98`: PC = (address after the instruction & `$C000`) + (IN C) << 6. | ✅ `cpu/z80n-instructions` |
| CPU-013 | `LDIX/LDDX/LDIRX/LDDRX` | S | 2 | | `ED A4`/`AC`/`B4`/`BC`: bytes equal to A are skipped; HL up (A4/B4) or down (AC/BC), DE always up. | ✅ `cpu/z80n-instructions` |
| CPU-014 | `LDPIRX` | S | 2 | | `ED B7`: pattern copy from (HL + E&7) with A as transparent byte. | ✅ `cpu/z80n-instructions` |
| CPU-015 | `LDWS` | S | 3 | | `ED A5`: copy (HL)→(DE), L+1, D+1; flags from INC D but without PreserveC, so C = carry out of D+1. | ✅ `cpu/z80n-instructions` (B22 fixed) |
| CPU-016 | Undefined `ED` opcodes are NOPs | S | 3 | | A range of unassigned `ED xx` codes advance PC by 2 and change nothing. | ✅ `cpu/z80n-instructions` |
| CPU-017 | Z80N instructions under DI/EI boundaries | S | 3 | | An interrupt is taken between two iterations of a repeating Z80N copy (LDIRX re-executes from PC-2 like LDIR) and the copy completes after RETI. | ✅ `cpu/z80n-instructions` |

### 4.4 `SPD` – CPU speed

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| SPD-001 | `$07` write/readback | S | 1 | | Write 0–3; bits 1–0 read the requested speed, bits 5–4 the actual `cpu_speed`. | ✅ `speed/cpu-speed` (incl. soft reset) |
| SPD-002 | Tacts per frame by speed | S | 1 | | A program counts loop iterations between two frame interrupts at 3.5/7/14/28 MHz; ratios are ~1:2:4:8 (the frame length in real time does not change). | ✅ `speed/cpu-speed` (from bank 7 exactly 2x/4x/8x; from SRAM at 28 MHz one wait state per read) |
| SPD-003 | Frame rate independent of speed | S | 1 | | `frames` advances 50 per 50 `runFrames` at every speed; ULA interrupt still once per frame. | ✅ `speed/cpu-speed` (B23 fixed: the INT pulse is 32 CPU cycles at every speed) |
| SPD-004 | Speed change mid-frame | S | 2 | | Switching speed via `NEXTREG` mid-frame takes effect for the rest of the frame (iteration count between known lines). | ✅ `speed/cpu-speed` |
| SPD-005 | Expansion bus forces 3.5 MHz | S | 3 | | With `$80` bus enabled, actual speed bits read `00` regardless of `$07` (per VHDL `cpu_speed`). | ✅ `speed/cpu-speed` (B24 fixed, WASM) |
| SPD-006 | `$06` hotkey enable bit | S | 3 | | Bit 7 read/write only; no speed change from writing it. | ✅ `speed/cpu-speed` (incl. F5/F6/F8 gating; B25 fixed, WASM) |
| SPD-007 | Audio sample count unchanged at 28 MHz | A | 2 | | `audio()` returns the same number of samples per frame at every speed. | ✅ `speed/cpu-speed` |

### 4.5 `MEM` – Memory management

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| MEM-001 | MMU reset layout | S | 1 | | `$50`–`$57` after hard reset = `$FF,$FF,$0A,$0B,$04,$05,$00,$01`. | ✅ `nextreg/soft-reset`, `reset/soft-reset-memory` |
| MEM-002 | MMU slot write/read | S | 1 | | For each slot 2–7 page a distinct bank, poke a signature at the slot base, read it back through another slot mapping the same bank. | ✅ `memory/mmu` |
| MEM-003 | Bank aliasing 16K ↔ 8K | S | 1 | | 16K bank n via `$7FFD` equals 8K pages 2n/2n+1 via MMU. | ✅ `memory/paging-ports` |
| MEM-004 | ROM in slots 0/1 (`$FF`) | S | 1 | | With `$50/$51 = $FF` writes to `$0000–$3FFF` do not change memory. | ✅ `memory/mmu` |
| MEM-005 | RAM in slots 0/1 | S | 1 | | `$50 = $0A`: `$0000` is writable RAM of page 10; restore `$FF` returns ROM. | ✅ `memory/mmu` |
| MEM-006 | Highest page and out-of-range pages | S | 2 | | Writing a page number above the installed RAM (e.g. `$E0`) behaves per VHDL (reads `$FF`/writes ignored). Parametrise by configured RAM size. | ✅ `memory/mmu` (2 MB: $DF is the last RAM page; $E0-$FF = ROM in slots 0/1, no write in 2-7) |
| MEM-007 | `$7FFD` 128K paging | S | 1 | | Bits 2–0 select the bank at `$C000` (MMU6/7 updated); bit 4 selects ROM; `$50/$51` readback follow. | ✅ `memory/paging-ports` (B28 fixed) |
| MEM-008 | `$DFFD` extended bank bits | S | 1 | | `$DFFD` bits extend the `$7FFD` bank number beyond 7. | ✅ `memory/paging-ports` |
| MEM-009 | `$7FFD` lock (bit 5 / `$08` bit 7) | S | 2 | | After `$7FFD` bit 5, further `$7FFD` writes are ignored; `$08` bit 7 read = not locked; writing `$08` bit 7 unlocks. | ✅ `memory/port-7ffd-lock` |
| MEM-010 | `$1FFD` +3 special all-RAM modes | S | 1 | | Bit 0 = 1 with bits 2–1 = 00/01/10/11 give the four +3 all-RAM layouts (banks 0-1-2-3, 4-5-6-7, 4-5-6-3, 4-7-6-3). | ✅ `memory/paging-ports` (B28 fixed: the layouts load MMU0-7) |
| MEM-011 | `$1FFD` ROM select | S | 1 | | Bit 2 with `$7FFD` bit 4 select ROM 0–3 on +3 timing. | ✅ `memory/paging-ports` |
| MEM-012 | Pentagon 1024 paging | S | 3 | | With Pentagon timing / `$EFF7` settings, `$7FFD` bits 7–5 extend the bank (check VHDL gating). | ✅ `memory/paging-ports` (B28 fixed: it is `$8F`, not the timing) |
| MEM-013 | `$EFF7` RAM at `$0000` | S | 3 | | `$EFF7` bit 3 maps RAM page 0 into `$0000`. | ✅ `memory/paging-ports` (B28 fixed, WASM) |
| MEM-014 | `$8E` write sets 128K mapping | S | 2 | | Writing `$8E` with bit 3 = 1 changes bank/ROM atomically; bit 3 = 0 changes ROM only. | ✅ `memory/paging-ports` (B28 fixed) |
| MEM-015 | `$8F` mapping mode | S | 3 | | Mode 0 standard, other modes (Pentagon 512/1024) change `$7FFD` interpretation per VHDL. | ✅ `memory/paging-ports` (mode 01 Profi is disabled in the VHDL) |
| MEM-016 | Alt ROM `$8C` | S | 2 | | Bit 7 enables the alt ROM, bit 6 selects write-enable (ROM area writable), bits 5–4 lock ROM1/ROM0; readback matches, soft reset copies bits 3–0 to 7–4. | ✅ `memory/alt-rom` (B28 fixed: lock bits apply without the Alt ROM) |
| MEM-017 | Layer 2 write paging `$123B` | S | 1 | | `$123B` bit 0 maps Layer 2 bank(s) for writes into `$0000–$3FFF`; reads still hit ROM. | ✅ `memory/layer2-paging` (B27 fixed) |
| MEM-018 | Layer 2 read paging | S | 1 | | `$123B` bit 2 maps for reads; both bits map read/write. | ✅ `memory/layer2-paging` (B27 fixed) |
| MEM-019 | Layer 2 paging segment select | S | 1 | | `$123B` bits 7–6 select section 0/1/2 or all 48K (`11`), and bit 3 switches `$12` active vs `$13` shadow bank. | ✅ `memory/layer2-paging` (B27 fixed) |
| MEM-020 | Layer 2 paging offset `$123B` bit 4 | S | 2 | | Writing with bit 4 set stores the 3-bit bank offset in bits 2–0 (per VHDL); paging then uses bank + offset. | ✅ `memory/layer2-paging` (B27 fixed) |
| MEM-021 | Memory priority: DivMMC > Layer 2 > MMU | S | 1 | | With DivMMC `conmem` and Layer 2 write paging both active, `$0000` access goes to the higher-priority source per VHDL. | ✅ `memory/layer2-paging` (B27 fixed) |
| MEM-022 | ROM contents per ROM select | S | 2 | | Signature bytes of ROM 0–3 at known addresses differ as expected (48K, 128K editor, +3DOS, 48 BASIC). | ✅ `memory/alt-rom` |
| MEM-023 | Contention disable `$08` bit 6 | S | 3 | | On 48K/128K timing, a timing-sensitive loop reading the frame counter at 3.5 MHz differs with contention on vs off (only if the emulator models contention; otherwise document). | ❌ (B26) `memory/contention` - no memory contention in either core; the uncontended cases pass |
| MEM-024 | `$0000` write protection of ROM | S | 1 | | `LDIR` over `$0000–$3FFF` with ROM mapped leaves ROM unchanged; same block with RAM mapped is changed. | ✅ `memory/mmu` |
| MEM-025 | Bank 5/7 shadow screen | P | 1 | | Write distinct patterns into bank 5 and bank 7 display files; `$7FFD` bit 3 (and `$69` bit 6) switches which one is displayed. | ✅ `memory/shadow-screen` |
| MEM-026 | Config mode `$04` mapping | S | 2 | | In config mode ($03 low bits 111) `$0000-$3FFF` with the ROM paged shows SRAM 16K bank `$04` bits 6-0, writable (zxnext.vhd ~2994-3000); MMU RAM, DivMMC and Layer 2 go above it, the Alt ROM does not. Added 2026-09-18. | ✅ `memory/config-mode` (B85 fixed: `$04` was stored but never mapped) |

### 4.6 `PORT` – Port decoding and enables

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| PORT-001 | Internal port enable reset | S | 1 | | `$82`–`$85` read their hard-reset values from `zxnext.vhd` (all implemented ports enabled). | ✅ `ports/port-enables` (B29 fixed: `$85` powers on `$8F`) |
| PORT-002 | Disable each internal port | S | 1 | | Parametrised over `internal_port_enable(0..27)`: clearing the bit makes the port write ineffective and its read return the floating/`$FF` value. E.g. bit 14 disables `$57/$5B/$303B`; bit 15 `$123B`; bit 16 AY. | ✅ `ports/port-enables` (27 of 28 bits; bit 11 SPI needs `sd`; B29 fixed) |
| PORT-003 | `$85` reset type bit | S | 2 | | Bit 7 selects whether `$82`–`$85` reset on soft reset; verify both settings. | ✅ `ports/port-enables` |
| PORT-004 | Port `$FE` partial decode | S | 1 | | Any even port address reaches the ULA: `out $00FE`, `out $1234` (even) both change the border. | ✅ `ports/port-decode` |
| PORT-005 | `$FE` read unused bits | S | 1 | | Bits 7–5 per VHDL (bit 6 EAR, bit 5 read 1 / issue 2 behaviour via `$08` bit 0). | ✅ `ports/port-decode` |
| PORT-006 | Port `$FF` floating bus | S | 2 | | With `$08` bit 2 = 0, reading `$FF` during paper returns the attribute byte being drawn, in border `$FF`. Use `runTo` a known beam position. | ✅ `ports/floating-bus` (B30 fixed) |
| PORT-007 | Port `$FF` Timex readback | S | 2 | | `$08` bit 2 = 1: `in $FF` returns the Timex register instead of floating bus. | ✅ `ports/floating-bus` (B29 fixed) |
| PORT-008 | +3 floating bus `$0FFD` | S | 3 | | On +3 timing with enable bit 4, `in $0FFD` returns floating bus; otherwise `$FF`. | ✅ `ports/floating-bus` (B30 fixed) |
| PORT-009 | `$7FFD` decode per timing | S | 2 | | `$7FFD` pages in every timing (`port_7ffd_wr` does not use `port_7ffd_active`, which only drives contention, ~4476); A14 = 1 is decoded only in +3 timing, so `$0FFD` pages in 48K/128K timing. *(Corrected 2026-09-18: the first draft said 48K timing ignores `$7FFD`.)* | ✅ `ports/port-decode` (B29 fixed) |
| PORT-010 | `$1FFD` does not also hit `$7FFD` | S | 2 | | `out $1FFD` leaves `$7FFD` state unchanged. | ✅ `ports/port-decode` |
| PORT-011 | Unmapped port read | S | 2 | | Reading ports with no device (e.g. `$00FF` with Timex readback off during border) returns `$FF`. Note `$DFFD` is *not* unmapped for reads: it matches `$FFFD`'s decode and reads the AY (~2591); `$0xx1` with A15-12 = 0 is the +3 floating bus. | ✅ `ports/port-decode` |
| PORT-012 | AY info port `$BFF5` | S | 3 | | Reading `$BFF5` returns the AY/TurboSound id value per VHDL. | ✅ `ports/port-decode` (B29, B32 fixed) |
| PORT-013 | `$DF` shared by mouse/Specdrum | S | 3 | | Port `$DF` routes to Kempston joystick 1 only when Specdrum enabled and mouse disabled (`port_1f` equation). | ✅ `ports/port-decode` (B29 fixed) |

### 4.7 `VT` – Video timing

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| VT-001 | Tacts per frame 50 Hz | S | 1 | | For 48K, 128K, +3, Pentagon timing: `tacts` difference over one `runFrames(1)` equals lines × tacts/line from `zxula_timing.vhd` (at 3.5 MHz). | ✅ `video/video-timing` (all 7 timings; B20 fixed: WASM 60 Hz) |
| VT-002 | Lines per frame | S | 1 | | A program samples `$1E/$1F` in a tight loop across one frame: max line equals the timing's last line (e.g. 310 for 128K 50 Hz). | ✅ `video/video-timing` |
| VT-003 | 60 Hz frame | S | 1 | | `$05` bit 2 = 1: lines/frame and tacts/frame switch to the 60 Hz values; `$05` readback shows it. | ✅ `video/video-timing` (B37 fixed: readback is the effective bit) |
| VT-004 | `$1E/$1F` counter origin | S | 1 | | Line counter 0 aligns with the first paper line minus the VHDL offset (C00 established paper row = cvc − `$64` for copper). `$1F` read at the frame interrupt returns the documented line. | ✅ `video/video-timing` (with VT-006: `$1F` at the interrupt) |
| VT-005 | `$1E` bit 0 MSB | S | 2 | | Reading at a line above 255 returns `$1E` = 1. | ✅ `video/video-timing` (with VT-002) |
| VT-006 | Frame interrupt position | S | 1 | | `runTo` the IM1 handler: the line/tact at which the ULA interrupt fires matches the timing's interrupt position (48K vs 128K differ). | ✅ `video/video-timing` (to the tact, without taking an interrupt; B21, B34, B36 fixed) |
| VT-007 | Interrupt pulse length | S | 2 | | An `EI` issued a few tacts after the interrupt start still catches it; after the pulse length (32 tacts 48K / 36 128K) it does not. | ✅ `video/video-timing` (measured on `$22` bit 7; B37 fixed) |
| VT-008 | Pentagon timing | S | 3 | | 320 lines, 224 tacts/line, interrupt position per VHDL. | ✅ `video/video-timing` (B37 fixed: forces 50 Hz) |
| VT-009 | `$11` video timing register | S | 3 | | Readback of bits 2–0; write only in config mode (document effect or lack of it). | ✅ `video/video-timing` (B37 fixed) |
| VT-010 | Timing change keeps display stable | V | 3 | | Switch 50→60 Hz; screen buffer size and paper origin remain consistent in the captured frame. | ✅ `video/video-timing` (P: paper row 48 at 50 Hz, 24 at 60 Hz on both cores) |
| VT-011 | Scandoubler/scanlines bits | S | 3 | | `$05` bit 0 and `$09` bits 1–0 read back; no picture change required by the emulator. | ✅ `video/video-timing` |

### 4.8 `ULA` – Standard ULA

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| ULA-001 | Border colours 0–7 | P | 1 | | `out $FE,n` for n=0..7 with palette 16+n written; border pixels equal each colour. | ✅ `ula/ula-colours`, visual `C04` |
| ULA-002 | Paper/ink standard colours | V | 1 | | 8×8 grid of attribute cells covering ink 0–7 × paper 0–7 with a checker bitmap; probes per cell. | ✅ `ula/ula-colours` (P: probes per cell) |
| ULA-003 | Bright | V | 1 | | Same grid with BRIGHT; palette indices 8–15 / 24–31 used. | ✅ `ula/ula-colours` |
| ULA-004 | Flash period | V | 1 | | FLASH cells swap ink/paper every 16 frames; capture frames 0, 15, 16, 32 and compare. | ✅ `ula/flash-and-layout` (P: 72 frames, runs of 16) |
| ULA-005 | Display file address layout | P | 1 | | Poke single bytes at `$4000`, `$47FF`, `$57FF`, and an attribute at `$5AFF`; pixel positions match the `$4000 \| third<<11 \| …` layout. | ✅ `ula/flash-and-layout` |
| ULA-006 | Border mid-frame change (racing) | V | 1 | | Change `$FE` from a line-interrupt handler every N lines; horizontal stripes at the expected rows. | ✅ `ula/border-timing` (P: 8 stripes from an IM2 line-interrupt handler) |
| ULA-007 | Border mid-line change | V | 2 | | Change `$FE` at a known tact inside a border line; edge x within the 8-pixel ULA border resolution (VHDL border latch). | ✅ `ula/border-timing` (B40 fixed: 8-pixel latch; Pentagon per T-state; a Copper palette write before the latch point) |
| ULA-008 | Attribute change mid-frame | V | 1 | | From a line interrupt rewrite attribute memory; top/bottom halves of a cell row differ. Guards bug B8 (WASM screen-memory racing). | ✅ `ula/midframe-memory-write` |
| ULA-009 | Bitmap change mid-frame | V | 2 | | Same as ULA-008 for pixel memory. | ✅ `ula/midframe-memory-write` |
| ULA-010 | ULA scroll X `$26` | V | 1 | | Static scroll 0/1/8/255: picture shifts left with wrap at 256; border unaffected. | ✅ `ula/scroll` (incl. a Copper palette write before the scroll latch), visual `C09` (per line) |
| ULA-011 | ULA scroll Y `$27` | V | 1 | | Scroll 0/1/191: vertical shift with wrap at 192. | ✅ `ula/scroll` (B39 fixed: TS scroll 192-255) |
| ULA-012 | Half-pixel scroll `$68` bit 2 | V | 2 | | With `$68` bit 2 the ULA shifts one extra 720-res pixel horizontally. | ✅ `ula/scroll` (B38 fixed: shifts left) |
| ULA-013 | ULA clip `$1A` | V | 1 | | Clip window (x1,x2,y1,y2) written via 4 writes; outside the window ULA is transparent (fallback / lower layers shown). | ✅ `ula/clip` (with the y2 ≥ $C0 clamp) |
| ULA-014 | Clip index cycling | S | 2 | | Five `$1A` writes wrap the index; `$1C` bit 2 resets it. | ✅ `ula/clip` |
| ULA-015 | ULA disable `$68` bit 7 | V | 1 | | ULA and border transparent; fallback `$4A` visible. (C11 covers the per-line copper variant.) | ✅ `nextreg/fallback-colour-reset`, visual `C11` |
| ULA-016 | ULA palette index 16+n for paper/border | P | 1 | | Rewrite palette entries 16–23 only; paper and border change, ink (0–7) unchanged. | ✅ `ula/ula-colours` |
| ULA-017 | Second ULA palette `$43` bit 1 | P | 2 | | Write different colours to ULA palette 1 and 2; `$43` bit 1 switches the displayed colours. | ✅ `ula/ula-colours` |
| ULA-018 | ULA transparency via `$14` | V | 1 | | ULA ink colour equal to `$14` is transparent (RGB compare), Layer 2 underneath shows. | ✅ `ula/transparency-stencil` (over Layer 2, RGB compare), visual `C10`, `P02` |
| ULA-019 | Stencil mode `$68` bit 0 | V | 2 | | With tilemap enabled, output = ULA AND tilemap (P02 covers basics; add all four transparency combinations). | ✅ `ula/transparency-stencil` (all four combinations), visual `P02` |
| ULA-020 | Keyboard issue 2 bit | S | 3 | | `$08` bit 0 changes `$FE` bit 6 read with no EAR input per VHDL. | ✅ `ports/port-decode` (with PORT-005) |
| ULA-021 | 48K ROM boot picture | V | 3 | | Hard reset without NEX loader (or browser tier boot): copyright screen matches golden. | ✅ `ula/rom-boot-screen` (stock 48K ROM run from RAM; expected text from the ROM font) |

### 4.9 `TMX` – Timex modes

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| TMX-001 | Port `$FF` mode 0 | V | 1 | | `$FF`=0: standard screen from `$4000`. | ✅ `ula/timex-modes` |
| TMX-002 | Alternate screen mode 1 | V | 1 | | `$FF`=1: display file taken from `$6000`, attributes from `$7800` (zxula.vhd ~230-250: mode bit 0 is address bit 13 of both fetches); distinct patterns in all four areas. *(Corrected 2026-09-18: the first draft said attributes stay at `$5800`.)* | ✅ `ula/timex-modes` (B41 fixed: both cores showed mode 0) |
| TMX-003 | HiColor mode 2 | V | 1 | | `$FF`=2: pixels at `$4000`, 8×1 attributes at `$6000`; every scanline of a cell can have its own colours. | ✅ `ula/timex-modes` |
| TMX-004 | HiRes mode 6 | V | 1 | | `$FF`=6: 512×192 from `$4000`/`$6000` interleaved columns; single-pixel vertical lines at 720-res x. | ✅ `ula/timex-modes` |
| TMX-005 | HiRes colour bits 5–3 | V | 1 | | Mode 6 with ink value 0–7 in bits 5–3: ink/paper pair per the Timex table (ink n, paper 7−n); border takes paper per VHDL. | ✅ `ula/timex-modes` (B43 fixed: TS colours fixed at the port write) |
| TMX-006 | Port `$FF` bit 6 interrupt disable | S | 1 | | `$FF` bit 6 disables the ULA frame interrupt; `$22` bit 2 reads it. | ✅ `ula/timex-port` (B44 fixed) |
| TMX-007 | Port `$FF` bit 7 | S | 3 | | Bit 7 (Timex MMU dock/EXROM select) stored and read back through `in $FF` with `$08` bit 2 (`$69` returns bits 5–0 only); no paging effect on Next. *(Corrected 2026-09-18: the first draft said `$69`.)* | ✅ `ula/timex-port` (B44 fixed; also cleared by a soft reset) |
| TMX-008 | Mode switch mid-frame | V | 2 | | Switch `$FF` 0→2 from a line interrupt; top half standard, bottom HiColor. Guards bug B8 (mid-line sample in WASM). | ✅ `ula/timex-port` |
| TMX-009 | Mode switch mid-line | V | 3 | | Switch at a known tact; switch point aligned to the sampled 8-pixel boundary per VHDL. | ✅ `ula/timex-port` (B45 fixed: WASM switched at the beam) |
| TMX-010 | HiRes with scroll | V | 2 | | `$26` in HiRes: scroll granularity is one 512-res pixel per unit? Read `zxula.vhd` and assert. | ✅ `ula/timex-modes` (B42 fixed: half-pixel scroll in HiRes and HiColor) |
| TMX-011 | HiColor with ULANext | V | 3 | | HiColor attributes interpreted through the ULANext ink mask when `$43` bit 0 is set. | ✅ `ula/timex-modes` |
| TMX-012 | Timex modes on 48K vs 128K timing | S | 3 | | Port `$FF` write is accepted regardless of timing (check port enable 0). | ✅ `ula/timex-port` |
| TMX-013 | Undocumented modes and the shadow screen | V | 3 | | Per zxula.vhd ~191, ~230-250: mode 3 takes pixels and attributes from the same `$6000` byte; HiRes modes 4 / 5 / 7 take the second byte from `$5800` / `$7800` / `$6000`; the 128K shadow screen forces mode 0. *(Added 2026-09-18.)* | ✅ `ula/timex-modes` (B41 fixed) |

### 4.10 `ULN` – ULANext

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| ULN-001 | Enable `$43` bit 0 | S | 1 | | Readback; `$42` default `$07`. | ✅ `ula/ulanext` (reset values after hard and soft reset) |
| ULN-002 | Ink mask `$07` | V | 1 | | Attribute bits 2–0 ink index 0–7, bits 7–3 paper index 128+n; border 128+border. Guards bug B7. | ✅ `ula/ulanext-ulaplus` |
| ULN-003 | Ink masks `$01,$03,$0F,$1F,$3F,$7F` | V | 1 | | Parametrised: ink = attr & mask, paper = 128 + (attr >> bits). One case with a row per mask. | ✅ `ula/ulanext` (all seven formats) |
| ULN-004 | Full-ink mode `$FF` | V | 1 | | Mask `$FF`: ink = attribute, paper and border use the fallback `$4A`. | ✅ `ula/ulanext-ulaplus` (B7 residual fixed: TS border fallback vs `$14`) |
| ULN-005 | Invalid mask | V | 2 | | Any format other than `$01 $03 $07 $0F $1F $3F $7F $FF` (zxula.vhd ~500-529): ink = attr AND format, paper the fallback `$4A`, border still `$80 + n` (only `$FF` gives the border the fallback). | ✅ `ula/ulanext` (`$05`, `$00`, `$80`, `$FE`) |
| ULN-006 | No FLASH/BRIGHT in ULANext | V | 2 | | Attribute bits 7/6 are part of paper index; no flashing over 32 frames. | ✅ `ula/ulanext` |
| ULN-007 | ULANext + second palette | P | 2 | | `$43` bit 1 switches palettes also for 128+ entries. | ✅ `ula/ulanext` |
| ULN-008 | ULANext transparency | V | 2 | | Paper colour equal to `$14` is transparent. | ✅ `ula/ulanext` (ink, paper and border) |
| ULN-009 | ULANext in Timex HiRes | V | 3 | | The Timex attribute `"01" & not n & n` goes through the ULANext decode: ink `attr AND format`, paper per format, border `$80 + 7 − n`; format `$FF`: paper and border the fallback. *(Added 2026-09-18.)* | ✅ `ula/ulanext` (B46 fixed) |

### 4.11 `ULP` – ULA+

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| ULP-001 | Register/data ports | S | 1 | | `$BF3B` selects group/index, `$FF3B` writes/reads palette data; read back matches. | ✅ `ula/ulaplus-ports` |
| ULP-002 | Mode group enable | S | 1 | | Writing group 1 (`$40`) with data bit 0 = 1 enables ULA+; `$68` bit 3 reads the enable. | ✅ `ula/ulaplus-ports` |
| ULP-003 | Palette write updates Next palette | S | 2 | | ULA+ palette write lands in ULA palette index 192+n (verify via `$40`/`$41` read). | ✅ `ula/ulaplus-ports` |
| ULP-004 | ULA+ attribute decode | V | 1 | | Attribute bits 7–6 select 4 CLUTs; ink = 192 + clut×16 + ink, paper = 192 + clut×16 + 8 + paper. Border = paper of CLUT 0 (200+n). Guards bug B7. | ✅ `ula/ulanext-ulaplus` |
| ULP-005 | ULA+ disable restores standard | V | 2 | | Group 1 data 0 returns to standard colours without clearing the palette. | ✅ `ula/ulaplus` (entries kept; also cleared by a soft reset) |
| ULP-006 | ULA+ with HiColor | V | 3 | | ULA+ attributes applied per scanline in Timex HiColor mode. | ✅ `ula/ulaplus` |
| ULP-007 | Port enable bit 24 (`$85` bit 0) | S | 3 | | `$85` bit 0 = 0: `$BF3B`/`$FF3B` are not decoded (writes ignored, reads `$FF`); `$68` bit 3 still enables ULA+. | ✅ `ula/ulaplus` (`$85` bit 0; `$68` bit 3 unaffected) |
| ULP-008 | ULA+ in Timex HiRes | V | 3 | | zxula.vhd ~431, ~533-541: the Timex attribute `"01" & not n & n` goes through the ULA+ decode with index bit 3 forced by `screen_mode(2)`: ink `$D8 + n`, paper and border `$D8 + 7 − n`. *(Added 2026-09-18.)* | ✅ `ula/ulaplus` (B46 fixed: both cores ignored ULA+ in HiRes) |

### 4.12 `LOR` – LoRes / Radastan

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| LOR-001 | LoRes enable `$15` bit 7 | V | 1 | | 128×96 block mode, 2×2 pixels, memory `$4000` (top 48 rows) + `$6000` (bottom 48 rows); ULA replaced. | ✅ `ula/lores` (whole picture against a model of `lores.vhd`; bank 5 even with the shadow screen) |
| LOR-002 | LoRes palette | V | 1 | | Pixel value = ULA palette index (with `$6A` offset in bits 3–0 per VHDL). | ✅ `ula/lores` (offset; second palette; no ULANext) |
| LOR-003 | LoRes scroll `$32/$33` | V | 1 | | lores.vhd: x = display x + `$32` (8-bit wrap; one unit = half a LoRes pixel), y = display y + `$33` folded back once it reaches 192. *(Corrected 2026-09-18: the first draft said 2-pixel steps with wrap at 128/96.)* | ✅ `ula/lores` (12 scroll pairs) |
| LOR-004 | LoRes clip | V | 2 | | ULA clip window `$1A` applies to LoRes. | ✅ `ula/lores` |
| LOR-005 | LoRes transparency | V | 2 | | Colour equal to `$14` transparent. | ✅ `ula/lores` (also hidden by `$68` bit 7) |
| LOR-006 | Radastan mode `$6A` bit 5 | V | 2 | | 4-bit pixels, 128×96 from one `$4000` buffer; palette offset. | ✅ `ula/lores` (offsets, ULA+, ULA+ with ULANext) |
| LOR-007 | Radastan XOR `$6A` bit 4 | V | 3 | | Bit 4 XORs the Radastan display file select: dfile = port `$FF` bit 0 XOR `$6A` bit 4 (zxnext.vhd ~6742). *(Corrected 2026-09-18: the first draft said it changes the index.)* | ✅ `ula/lores` |
| LOR-008 | LoRes with Timex port `$FF` | V | 3 | | Plain LoRes ignores the Timex screen mode (it replaces the ULA pixel); Radastan takes its display file from port `$FF` bit 0 (LOR-007). | ✅ `ula/lores` (plain LoRes ignores modes 1, 2, 6) |
| LOR-009 | LoRes enable mid-frame | V | 3 | | Enable from a line interrupt; lower half LoRes. | ✅ `ula/lores` (B47 fixed: TS switched late) |

### 4.13 `L2` – Layer 2

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| L2-001 | Enable via `$123B` bit 1 | V | 1 | | Fill bank 8 (`$12` reset value, zxnext.vhd ~4921; the first draft said 9) with a pattern; enable shows 256×192 over ULA (default `$15` SLU). | ✅ `layer2/layer2` (whole picture against a model of `layer2.vhd`) |
| L2-002 | Enable via `$69` bit 7 | S | 1 | | Same enable through NextReg; `$123B` read reflects it. | ✅ `layer2/layer2` |
| L2-003 | `$12` active bank | V | 1 | | Change `$12` to another bank with a different pattern; picture follows. Readback. | ✅ `layer2/layer2` |
| L2-004 | `$13` shadow bank | S | 2 | | `$13` affects only `$123B` bit 3 paging, not the display. | ✅ `layer2/layer2` (B48 fixed: both cores displayed `$13`) |
| L2-005 | 256×192 pixel addressing | P | 1 | | Poke (x,y) pixels in the 3 × 16K banks; positions (0,0), (255,191), and 16K boundaries (y=64,128) land correctly. | ✅ `layer2/layer2` (every pixel, via the model) |
| L2-006 | 320×256 mode `$70` bits 5–4 = 01 | V | 1 | | Column-major layout (x·256 + y), 5 × 16K banks; full border area covered. | ✅ `layer2/layer2` (with the reset clip, rows 192-255 are clipped) |
| L2-007 | 640×256 4-bit mode `$70` = 10 | V | 1 | | Each byte = two 4-bit pixels (high nibble left); index + palette offset. | ✅ `layer2/layer2` |
| L2-008 | Palette offset `$70` bits 3–0 | V | 2 | | Offset added to the pixel's high nibble (mod 16) before the palette lookup, in all three modes (layer2.vhd). *(Corrected 2026-09-18: the first draft said added to the index mod 256.)* | ✅ `layer2/layer2` |
| L2-009 | Scroll X `$16` (256 mode) | V | 1 | | Wrap at 256. | ✅ `layer2/layer2` |
| L2-010 | Scroll Y `$17` (256 mode) | V | 1 | | Wrap at 192. | ✅ `layer2/layer2` (192-255 fold like the ULA) |
| L2-011 | Scroll X MSB `$71` (320/640 modes) | V | 1 | | 9-bit scroll, wrap at 320. | ✅ `layer2/layer2` |
| L2-012 | Scroll Y in 320/640 modes | V | 2 | | Wrap at 256. | ✅ `layer2/layer2` |
| L2-013 | Clip `$18` in 256 mode | V | 1 | | Clip window in pixel coordinates. | ✅ `layer2/layer2` |
| L2-014 | Clip in 320/640 modes | V | 2 | | x1 × 2 .. x2 × 2 + 1 in wide pixels (layer2.vhd `clip_x1_q <= x1 & 0`, `clip_x2_q <= x2 & 1`); y as written. The reset window (y2 = `$BF`) clips the wide modes' bottom 64 rows. | ✅ `layer2/layer2` |
| L2-015 | Transparency by RGB `$14` | V | 1 | | L01 covers; add the 9-bit compare detail: two indices mapped to colours differing only in blue LSB are both transparent (8-bit compare). | ✅ `layer2/layer2`, visual `L01` |
| L2-016 | Priority bit from palette | V | 1 | | Layer 2 palette entry with `$44` second byte bit 7 set draws above sprites/ULA in any `$15` order (P01 covers one band; add every order). | ✅ `layer2/layer2` (all six orders), visual `P01` |
| L2-017 | Second Layer 2 palette | P | 2 | | `$43` bit 2 selects the second Layer 2 palette. | ✅ `layer2/layer2` |
| L2-018 | Layer 2 in border area (256 mode) | V | 2 | | 256×192 stays inside paper; border shows ULA border/fallback. | ✅ `layer2/layer2` |
| L2-019 | Enable mid-frame | V | 3 | | Enable from a line interrupt; picture below that line. | ✅ `layer2/layer2` |
| L2-020 | Scroll change mid-frame | V | 2 | | Split-screen scroll from line interrupt (raster effect). Guards bug B8 class. | ✅ `layer2/layer2` |
| L2-021 | Layer 2 memory write mid-frame | V | 3 | | Write pixels below the beam mid-frame; visible in the same frame. Guards bug B8. | ✅ `layer2/layer2` |
| L2-022 | Resolution change via `$70` mid-frame | V | 3 | | Documents per-line sampling of the resolution. | ✅ `layer2/layer2` |
| L2-023 | Paging writes while displaying | S | 1 | | `$123B` bit 0 writes land in the displayed bank while ROM remains readable. | ✅ `layer2/layer2` |
| L2-024 | `$12` values beyond RAM | S | 3 | | `$12` is 7 bits; a Layer 2 SRAM bank `$12` + 16 + segment ≥ 128 (address bit 21, past the 2 MB) gives no pixel (layer2.vhd `layer2_addr_eff(21)`). | ✅ `layer2/layer2` (B49 fixed: both cores read past the SRAM) |

### 4.14 `TM` – Tilemap

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| TM-001 | Enable `$6B` bit 7, 40×32 | V | 1 | | 40×32 tiles of 8×8 covering 320×256; default tile definitions at `$6F` base, map at `$6E`. | ✅ `tilemap/tilemap` (whole picture against a model of `tilemap.vhd`) |
| TM-002 | 80×32 mode `$6B` bit 6 | V | 1 | | 80 columns of 8×8 tiles at 640 across: one tile pixel per buffer pixel (tilemap.vhd `hcount_effsub` in 80-column mode). | ✅ `tilemap/tilemap` (B50 fixed: TS last column) |
| TM-003 | Attribute byte present (2-byte map) | V | 1 | | Default: map entries are tile + attribute. | ✅ `tilemap/tilemap` |
| TM-004 | No attribute `$6B` bit 5 | V | 1 | | 1-byte map; attribute comes from `$6C`. | ✅ `tilemap/tilemap` |
| TM-005 | Attribute palette offset | V | 1 | | Attribute bits 7–4 are the index's high nibble (index = attr(7:4) & pixel nibble). | ✅ `tilemap/tilemap` |
| TM-006 | X mirror | V | 1 | | Attribute bit 3. Asymmetric tile shape. | ✅ `tilemap/tilemap` (random attributes + one tile in all 8 orientations) |
| TM-007 | Y mirror | V | 1 | | Attribute bit 2. | ✅ `tilemap/tilemap` |
| TM-008 | Rotate | V | 1 | | Attribute bit 1; combinations with mirrors (8 orientations in one case). | ✅ `tilemap/tilemap` |
| TM-009 | ULA-over-tilemap per tile | V | 1 | | Attribute bit 0 with `$6B` bit 0 = 0: tile below ULA (P02 covers basics). | ✅ `tilemap/tilemap`, visual `P02` |
| TM-010 | 512-tile mode `$6B` bit 1 | V | 2 | | Attribute bit 0 (or `$6C` bit 0 without attributes) becomes tile index bit 8, and every tile is below the ULA unless `$6B` bit 0 (tilemap.vhd `(attr(0) or mode_512) and not on_top`). | ✅ `tilemap/tilemap` (B52 fixed: both cores never put 512-mode tiles below the ULA) |
| TM-011 | Text mode `$6B` bit 3 | V | 2 | | 1-bit tiles (8 bytes per tile); attribute bits 7–1 are palette offset; pixel = 0/1 + offset. | ✅ `tilemap/tilemap` (with fine scroll in both widths) |
| TM-012 | Tilemap over ULA `$6B` bit 0 | V | 1 | | Bit 0 forces tilemap above ULA for all tiles. | ✅ `tilemap/tilemap` |
| TM-013 | Transparency index `$4C` | V | 1 | | Nibble value equal to `$4C` (4-bit compare, before offset) is transparent. | ✅ `tilemap/tilemap` (and `$14` does not apply to standard tiles) |
| TM-014 | Transparency in text mode | V | 2 | | Uses the `$14` RGB compare, not `$4C` (zxnext.vhd ~7055; tilemap.vhd does not compare text pixels with `$4C`). | ✅ `tilemap/tilemap` |
| TM-015 | Scroll X `$2F/$30` | V | 1 | | 10-bit scroll in the column mode's pixels (320 / 640 across), wrap at 320 / 640. For scroll + x ≥ 1280 in 40 columns tilemap.vhd subtracts only 1280 - not tested. | ✅ `tilemap/tilemap` (B50 fixed: TS fine scroll; B51: WASM 80-column units) |
| TM-016 | Scroll Y `$31` | V | 1 | | Wrap at 256. | ✅ `tilemap/tilemap` |
| TM-017 | Clip `$1B` | V | 1 | | Clip window x1 × 2 … x2 × 2 + 1, y1 … y2 in 320 × 256 coordinates, in both column modes; resets to the whole area (x2 = `$9F`). | ✅ `tilemap/tilemap` |
| TM-018 | Base address `$6E` | V | 1 | | Map relocated to other address `$4000–$FFFF` (bits 6–0 × 256 + `$C000`? read VHDL); bit 7 selects bank 7 vs bank 5 mapping. Guards bug B10 area. | ✅ `nextreg/tilemap-base-address` |
| TM-019 | Tile definitions `$6F` | V | 1 | | Definitions relocated; bit 7 same as `$6E`. | ✅ `nextreg/tilemap-base-address` |
| TM-020 | Tilemap palette select `$6B` bit 4 / `$43` | P | 2 | | First vs second tilemap palette. | ✅ `tilemap/tilemap` (`$6B` bit 4 selects; `$43` picks the palette written) |
| TM-021 | Default attribute `$6C` readback | S | 2 | | Readback and use when bit 5 set. | ✅ `tilemap/tilemap` |
| TM-022 | Tilemap in border area | V | 2 | | 320×256 extends into border; ULA border visible where tilemap transparent. | ✅ `tilemap/tilemap` |
| TM-023 | Scroll change mid-frame | V | 2 | | Line-interrupt split scroll. | ✅ `tilemap/tilemap` |
| TM-024 | Tile memory write mid-frame | V | 3 | | Visible in same frame below the beam. Guards bug B8. | ✅ `tilemap/tilemap` |
| TM-025 | Enable mid-frame | V | 3 | | Enable from a line interrupt. | ✅ `tilemap/tilemap` |

### 4.15 `SPR` – Sprites

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| SPR-001 | Pattern upload via `$5B` | P | 1 | | `$303B` selects pattern n, 256 bytes written through `$5B`; a sprite showing pattern n displays it pixel-exact. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-002 | Pattern index autoincrement | P | 1 | | Two consecutive patterns written without re-selecting; both correct. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) (all 16K through one `$303B` select) |
| SPR-003 | 4-byte attributes via `$57` | P | 1 | | X, Y, palette offset/mirror/rotate/X8, visible+pattern; sprite at expected position (0,0 = 32 pixels left/up of paper origin). | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-004 | 5-byte attributes | P | 1 | | Attr 3 bit 6 enables the 5th byte: Y8, scale, 4-bit, relative flags. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-005 | Attribute index autoincrement | S | 1 | | After 4 or 5 bytes the sprite index advances; next sprite written without `$303B`. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-006 | Attribute writes via `$35`–`$39` | P | 1 | | `$34` selects sprite; `$35`–`$39` write attributes 0–4 without advancing; `$75`–`$79` write and advance. | ✅ `sprites/attribute-mirror` |
| SPR-007 | `$34` in anchor mode | S | 2 | | `$34` bit 7 (pattern-index link) behaviour per VHDL. | ✅ `sprites/sprites` (with the tie; `$34` bit 7 = pattern half, B57 fixed in TS) |
| SPR-008 | X9/Y9 positions | P | 1 | | Sprites at X=0, 319, 320+ (bit 0 attr 2), Y=0, 255, 256+ (5th byte bit 0). | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) (incl. 9-bit X/Y wrap-around) |
| SPR-009 | Visibility bit | P | 1 | | Attr 3 bit 7 = 0 hides the sprite. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-010 | Sprites enable `$15` bit 0 | P | 1 | | Disabled: no sprite visible - but the engine still runs, so collisions still set `$303B` bit 0 (zxnext.vhd ~6880 gates only the pixel). *(Corrected 2026-09-18.)* | ✅ `sprites/sprites` (B54 fixed: the engine still runs) |
| SPR-011 | Sprites over border `$15` bit 1 | V | 1 | | Sprite at X=8 visible over border only when bit 1 set. | ✅ `sprites/sprites` |
| SPR-012 | Border clip `$15` bit 5 | V | 2 | | With over-border on, bit 5 clips to the `$19` window extended over the border per VHDL. | ✅ `sprites/sprites` |
| SPR-013 | Clip window `$19` | V | 1 | | Without over-border: the `$19` window + 32 (x and y) and y < 224 - the reset window is the paper; with over-border + `$15` bit 5: x1 × 2 … x2 × 2 + 1, y1 … y2; over-border alone ignores the window. | ✅ `sprites/sprites` (B55 fixed: TS `$19` refresh, both cores y < 224) |
| SPR-014 | Palette offset | V | 1 | | Attr 2 bits 7–4 add ×16 to the pattern index. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-015 | Mirror X / mirror Y / rotate | V | 1 | | All 8 orientations of an asymmetric pattern in one case. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-016 | Scale X/Y ×2 ×4 ×8 | V | 1 | | Attr 4 bits 4–1; 16×16 becomes 32/64/128 wide/high; clipping at screen edge. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-017 | Rotate with scale | V | 2 | | Scale applies after rotation (X scale stays horizontal). | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-018 | Transparency index `$4B` (8-bit) | V | 1 | | Pixel value equal to `$4B` is transparent (index compare, not RGB). | ✅ `sprites/sprites` (and a sprite colour equal to `$14` stays opaque) |
| SPR-019 | 4-bit patterns | V | 1 | | Attr 4 bit 5 = 1: pattern data nibbles, N6 bit selects 128-byte pattern offset; transparency compares low nibble of `$4B`. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-020 | Anchor + composite relative sprites | V | 1 | | Anchor followed by relative sprites (attr 4 bits 7–6 = 01): relative X/Y offsets, palette offset relative flag, visibility inheritance. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-021 | Unified relative sprites | V | 1 | | Anchor with type bit for unified: relatives inherit mirror/rotate/scale transforms around the anchor. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-022 | Relative pattern index | V | 2 | | Relative sprite with pattern-relative flag adds anchor pattern number. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-023 | Sprite priority order | V | 1 | | Overlapping sprites: higher-numbered drawn on top by default. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-024 | Zero-on-top `$15` bit 6 | V | 1 | | Bit 6 reverses: sprite 0 on top. | ✅ `sprites/sprites` |
| SPR-025 | Collision flag | S | 1 | | Exists (`sprite-collision.test.ts`). Extend: transparent pixels do not collide; clipped pixels *do* (the line buffer is written for the whole 320 pixels, the window applies on output). *(Corrected 2026-09-18: the first draft said clipped pixels do not.)* | ✅ `sprites/sprites` (B54: also with `$15` bit 0 clear) |
| SPR-026 | Max sprites per line flag | S | 1 | | A line whose sprite work does not fit sets `$303B` bit 1 and the rest of its sprites are not drawn: one 28 MHz clock per sprite qualified plus one per pixel, the whole line available from `whc` = 511, cut by `spr_cur_notime` (a drawable sprite qualified at `whc` 288–319 under the previous sprite's wrap mask) or by the next line reset. | ✅ `sprites/sprites` (B53 TS budget, B56 WASM flag fixed) |
| SPR-027 | Status read clears | S | 1 | | Both bits clear after reading `$303B`. | ✅ `sprites/sprite-collision` |
| SPR-028 | Sprite palette select `$43` bit 3 | P | 2 | | First/second sprite palette. | ✅ `sprites/sprites` |
| SPR-029 | Sprite tie `$09` bit 4 | S | 3 | | With tie set, `$34` and `$303B` pattern/attribute index linkage per VHDL. | ✅ `sprites/sprites` (B57 fixed: TS `$303B` did not update `$34`) |
| SPR-030 | 128 sprites | V | 2 | | All 128 sprites visible in a grid with correct patterns. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-031 | 64 patterns (8-bit) / 128 (4-bit) | V | 2 | | Full pattern memory. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-032 | Attribute change mid-frame | V | 2 | | Move sprite X from a line interrupt: sprite split at that line. | ✅ `sprites/sprites` |
| SPR-033 | Sprite over layers per `$15` order | V | 1 | | See CMP-001; sprite visible above/below ULA and Layer 2 per order. | ✅ `layer2/layer2` (L2-016: all six orders with sprite, Layer 2 and ULA) |
| SPR-034 | Negative/wrap coordinates | V | 2 | | Anchor at X=500 with relative −200 offset; wrap behaviour of 9-bit arithmetic per VHDL. | ✅ `sprites/sprites` (random 128-sprite scenes against a model of `sprites.vhd`) |
| SPR-035 | Relative sprite without anchor | V | 3 | | Relative sprite as sprite 0: behaviour per VHDL (invisible). | ✅ `sprites/sprites` |

### 4.16 `PAL` – Palettes and transparency

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| PAL-001 | `$40` index write/readback | S | 1 | | Readback of index; `$41` write increments it unless `$43` bit 7. | ✅ `palette/palette-registers` |
| PAL-002 | `$41` 8-bit colour | S | 1 | | `$41` write of RRRGGGBB sets blue bit 0 = `B1 or B0` (C02 covered visually); `$41` read returns bits 8–1. | ✅ `palette/palette-registers` (all 256 values), visual `C02` |
| PAL-003 | `$44` 9-bit two-byte write | S | 1 | | First byte only stored (`$28`, `$03` bit 7 = pending) - the entry is written by the second byte: stored byte & bit 0 (no B1/B0 OR), bits 7–6 the priority bits; index increments after the second byte. | ✅ `palette/palette-registers` (B58 fixed: the first byte wrote the entry) |
| PAL-004 | `$44` read | S | 1 | | `palette_dat(10:9) & "00000" & palette_dat(0)`: bits 7 *and 6* of the second byte read back (nextreg.txt calls 6 reserved), bits 5–1 read 0, for all eight palettes. | ✅ `palette/palette-registers` (B59 fixed: bit 6 was dropped) |
| PAL-005 | Sub-index reset by `$40` | S | 1 | | A `$40` (or `$43`) write between the two `$44` bytes restarts the pair; the abandoned first byte writes nothing. | ✅ `palette/palette-registers` (and `$43`; B58) |
| PAL-006 | Sub-index reset by `$41` | S | 2 | | A `$41` write resets the `$44` sub-index. | ✅ `palette/palette-registers` |
| PAL-007 | Autoincrement disable `$43` bit 7 | S | 1 | | Repeated writes change one entry. | ✅ `palette/palette-registers` |
| PAL-008 | Write select `$43` bits 6–4 | S | 1 | | ULA1/L2 1/Spr1/TM1/ULA2/L2 2/Spr2/TM2 each written independently; reading `$41` with each selection returns its own values. | ✅ `palette/palette-registers` |
| PAL-009 | Active palette `$43` bits 3–1 | P | 1 | | Display uses active palettes independent of the write selection. | ✅ `palette/palette-display` (all 16 combinations, four layers on one screen) |
| PAL-010 | Global transparency `$14` compare | V | 1 | | 8-bit RGB compare (upper 8 bits of 9-bit colour) for ULA, LoRes, Layer 2, tilemap text mode. | ✅ `palette/palette-display` (ULA, LoRes, tilemap text; B61 fixed: TS priority bits broke the compare), Layer 2 in `layer2/layer2` L2-015 |
| PAL-011 | Fallback `$4A` | V | 1 | | Visible where all layers transparent; reset value `$E3` (bug B3). | ✅ `nextreg/fallback-colour-reset` |
| PAL-012 | Palette entry index 255 wrap | S | 2 | | Autoincrement from 255 wraps to 0. | ✅ `palette/palette-registers` |
| PAL-013 | Palette RAM not cleared by reset | S | 2 | | Values written before soft reset remain after (FPGA palette RAM); the index, `$43`, the pending flag and `$28` reset. | ✅ `palette/palette-registers` (B60 fixed: both cores reloaded the palettes) |
| PAL-014 | Palette change mid-frame | V | 2 | | Line-interrupt palette change: colour bands (copper C02 covers the copper path). | ✅ `palette/palette-display` (CPU path), visual `C02` (copper) |
| PAL-015 | 9-bit colour output | P | 1 | | Pixel RGB of a 9-bit colour matches the Klive 3→8 bit expansion. | ✅ `palette/palette-display` (all 512 colours; B62 fixed: TS showed `$176` as `#B6BDDB`) |
| PAL-016 | Priority bits outside Layer 2 | P | 2 | | Bits 7–6 of the second `$44` byte on a ULA, LoRes, tilemap or sprite entry change neither its colour nor the `$14` compare (only `layer2_prgb` takes word bit 15). *(Added 2026-09-18.)* | ✅ `palette/palette-display` (with PAL-009 / PAL-010) |

### 4.17 `CMP` – Compositing

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| CMP-001 | Layer orders `$15` 000–101 | V | 1 | | Six bands with overlapping opaque S, L (Layer 2), U pixels; each band shows the top layer per SLU/LSU/SUL/LUS/USL/ULS. P01 covers part – complete it. | ✅ `layers/compositing` (every cell of a random 320×256 scene against a model of the zxnext.vhd mixer, all six orders × stencil / ULA / tilemap enable / on-top), visual `P01` |
| CMP-002 | Blend mode 110 | V | 1 | | ULA + Layer 2 colour add, clamped per `zxnext.vhd`; several colour pairs incl. overflow. | ✅ `layers/compositing` (all four `$68` blend sources × stencil / ULA / tilemap settings) |
| CMP-003 | Blend mode 111 | V | 1 | | ULA + Layer 2 per channel: sum ≤ 4 → 0, ≥ 12 → 7, else sum − 5; only when the operand is opaque - with a transparent operand the Layer 2 colour passes unchanged (`mix_rgb_transparent`). | ✅ `layers/compositing` (incl. a transparent operand: no −5) |
| CMP-004 | Blend source `$68` bits 6–5 | V | 1 | | 00 ULA, 01 none, 10 ULA/tilemap mix, 11 tilemap as blend operand; tilemap placement per VHDL `ula_blend_mode_2`. Guards bug B6.1 (TS). | ✅ `layers/blend-and-border`, `layers/compositing` |
| CMP-005 | Blend with ULA disabled | V | 1 | | `$68` bit 7 during a blend band: VHDL blends `ula_mix_rgb` ignoring `ula_en`. Guards bug B6.2 (TS). | ✅ `layers/blend-and-border`, `layers/compositing` |
| CMP-006 | Sprite over ULA border in LUS/USL/ULS | V | 1 | | Sprite over opaque border with transparent tilemap shows. Guards bug B6.3 (TS). | ✅ `layers/blend-and-border`, `layers/compositing` |
| CMP-007 | Layer 2 priority bit in all orders | V | 1 | | See L2-016. | ✅ `layers/compositing` (priority entries in every order), `layer2/layer2` L2-016 |
| CMP-008 | Tilemap/ULA merge | V | 1 | | Tilemap over/under ULA per attribute and `$6B` bit 0 in every `$15` order. | ✅ `layers/compositing` (attribute bit 0, `$6B` bit 0, tilemap off: below = not `$6B` bit 0), visual `P02` |
| CMP-009 | Stencil with sprites and Layer 2 | V | 2 | | Stencil output participates as the "U" layer. | ✅ `layers/compositing` |
| CMP-010 | Transparent everywhere → fallback | V | 1 | | All layers enabled but transparent: `$4A`. | ✅ `layers/compositing`, `nextreg/fallback-colour-reset` |
| CMP-011 | LoRes as U layer | V | 2 | | LoRes takes the ULA slot in priority orders. | ✅ `layers/compositing` |
| CMP-012 | Border region composition | V | 2 | | Border is part of U: Layer 2 320×256 above/below border per order. | ✅ `layers/compositing` (border cells with Layer 2 320×256, sprites and tilemap over the border) |
| CMP-013 | Blend-mode clamping table | P | 2 | | Parametrised pixel test over all 8×8 red channel combinations in both blend modes. | ✅ `layers/compositing` (explicit table: 64 red and 64 green sums per mode) |
| CMP-014 | Order change mid-frame | V | 2 | | `$15` change from a line interrupt (C10 does `$14` via copper). | ✅ `layers/compositing` (CPU at line 96), visual `C10` (copper `$14`) |

### 4.18 `COP` – Copper (gaps beyond C00–D05)

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| COP-001 | `$60` then `$63` mixed upload | S | 1 | | `$61=0; $60=hi; $63=lo`: copper RAM holds hi/lo. Guards bug B4. | ✅ `copper/copper-upload` |
| COP-002 | `$61/$62` address readback | S | 1 | | 11-bit write address readback, mode bits in `$62` bits 7–6. | ✅ `copper/copper-control` (B63 fixed: TS `$61` read the last written value) |
| COP-003 | Address wrap at 1024 | S | 2 | | The 11-bit byte address wraps from `$7FF` (instruction 1023) to 0. | ✅ `copper/copper-control` (B63) |
| COP-004 | List survives soft reset | S | 1 | | Same as RST-014. Guards bug B5. | ✅ `copper/copper-upload` |
| COP-005 | MOVE output latency | P | 3 | | A MOVE to `$41` right after a WAIT lands at the VHDL tick (2 ticks after fetch). Guards bug B9; use 1-pixel probe. | — (B9 is fixed - the write is two ticks after the fetch - but a *pixel* position still needs a real-hardware capture: the video pipeline delays are not modelled tick for tick; COP-011 guards the latency) |
| COP-006 | Long MOVE runs drift | V | 3 | | 60 consecutive MOVEs across a line: change x positions per VHDL tick timing. Bug B9. | — (as COP-005) |
| COP-007 | WAIT for line beyond frame | V | 2 | | WAIT for a line past `c_max_vc` (400, or the frame length) never matches; the list halts there for good (mode 11 restarts it). | ✅ `copper/copper-control` (all timings: `c_max_vc` matches, `c_max_vc` + 1 and 400 never) |
| COP-008 | WAIT H past the line | V | 2 | | WAIT compares `hc_ula` ≥ H × 8 + 12; H with H × 8 + 12 > `c_max_hc` never matches (55+ on 48K/Pentagon, 56+ on 128K/+3). | ✅ `copper/copper-control` (all timings: last H = (`c_max_hc` − 12) / 8, i.e. 54 or 55) |
| COP-009 | Mode 11 restart each frame | V | 1 | | Program counter reset at cvc 0 each frame (C08 covers mode 01). | ✅ `copper/copper-control` |
| COP-010 | Mode change while running | S | 2 | | Only a *change* of mode to 01 or 11 resets the PC (copper.vhd `last_state_s`); rewriting 01 or 11, and changes to 00 or 10, keep it. *(Corrected 2026-09-18: the first draft said a 01/11 rewrite resets.)* | ✅ `copper/copper-control` |
| COP-011 | MOVE to `$62` from copper | S | 3 | | `MOVE $62,$00` stops the copper after one more MOVE: the write lands two ticks after the fetch, when the next MOVE is already out (`copper_req`). Mode 10 continues from the instruction after that. | ✅ `copper/copper-control` (B9 fixed: both cores stopped before the MOVE after it) |
| COP-012 | Copper under 60 Hz timing | V | 2 | | C02 bands at the same paper rows under 60 Hz. | ✅ `copper/copper-control` (48K / 128K / +3 / Pentagon, 50 and 60 Hz), visual `C02` |
| COP-013 | Copper `$64` offset with 60 Hz | V | 3 | | C07 at 60 Hz. | ✅ `copper/copper-control` (`$64` = 32 under every timing), visual `C07` |
| COP-014 | Copper writes to `$07` / `$50` | S | 3 | | Copper can MOVE any register `$00`–`$7F` (e.g. MMU); program observes the change. | ✅ `copper/copper-control` |
| COP-015 | Copper and CPU writing NextRegs together | S | 3 | | The copper wins a clash but the CPU's request is held, not lost (~4749): 64 CPU palette writes at 28 MHz during a 1000-MOVE copper burst all land. | ✅ `copper/copper-control` |

### 4.19 `INT` – Interrupts

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| INT-001 | ULA frame interrupt IM1 | S | 1 | | EI + IM1 handler at `$0038` in RAM (MMU0 RAM) counts; 50 per 50 frames. | ✅ `interrupts/interrupts` |
| INT-002 | IM2 legacy mode | S | 1 | | `$C0` bit 0 = 0: IM2 with I register uses the bus value `$FF` → vector at (I·256 + `$FF`). | ✅ `interrupts/interrupts` |
| INT-003 | Hardware IM2 mode `$C0` bit 0 | S | 1 | | Vector = `$C0` bits 7–5 + source index × 2 (per `im2_control.vhd`); ULA interrupt jumps to the ULA vector. | ✅ `interrupts/interrupts` (B65 fixed: the chain interrupted a CPU in IM 1; the ULA fallback pulse was missing) |
| INT-004 | IM2 source priority | S | 1 | | Line int (0) > UART0 RX > UART1 RX > CTC0–7 > ULA > UART0 TX > UART1 TX (`im2_int_req` order). Two sources pending together: higher runs first. | ✅ `interrupts/interrupts` (B64 fixed: `$20` writes did nothing) |
| INT-005 | `$C0` readback of current IM | S | 2 | | Bits 2–1 reflect IM 0/1/2 set by the CPU. | ✅ `interrupts/interrupts` (B69 fixed: WASM read 0) |
| INT-006 | ULA interrupt disable | S | 1 | | `$22` bit 2 / port `$FF` bit 6 / `$C4` bit 0 disable the ULA interrupt; readbacks agree. | ✅ `ula/timex-port` TMX-006 |
| INT-007 | Line interrupt `$22/$23` | S | 1 | | Enable bit 1, 9-bit line; interrupt fires at that line (handler reads `$1E/$1F`). | ✅ `interrupts/interrupts`, visual `D04` |
| INT-008 | Line interrupt line 0 and 311 | S | 2 | | Line N fires on `cvc` N − 1, line 0 on `c_max_vc`; so `c_max_vc` + 1 (312 on 48K) fires like 0, and only larger values never fire (`int_line_num` in zxula_timing.vhd). | ✅ `interrupts/interrupts` (B68 fixed: lines past `c_max_vc` + 1 wrapped around) |
| INT-009 | Line interrupt timing within line | S | 2 | | Fires at the tact the VHDL defines (start of line vs paper start); check with `$1F` and tacts. | ✅ `interrupts/interrupts` (127.5 tacts = `hc_ula` 255 after the line before starts) |
| INT-010 | `$C4` enable 0 | S | 1 | | Bit 1 mirrors `$22` bit 1 line enable; bit 7 expansion bus enable. | ✅ `interrupts/interrupts` |
| INT-011 | `$C5` CTC enables | S | 1 | | `$C5` is each channel's control-word bit 7 (channels 0–3 only; bits 7–4 read 0); zero counts interrupt only when set, but latch `$C9` either way (polled mode). | ✅ `interrupts/interrupts` (B67 fixed: CTC status, `$C5`, zero counts interrupting on time) |
| INT-012 | `$C6` UART enables | S | 2 | | RX/TX interrupt enables for UART 0/1. | ◐ `interrupts/interrupts` (`$C6` readback; UART interrupt sources are not wired in either core - §4.29, needs `uart`) |
| INT-013 | Status `$C8`–`$CA` | S | 1 | | Status latches when a source fires (DI); write-1-to-clear - but in hardware IM2 mode a bit keeps reading 1 while its request is pending or in service, until the RETI (im2_peripheral `o_int_status`). | ✅ `interrupts/interrupts` (B66 fixed: status and pending request were one bit) |
| INT-014 | `$20` generate interrupt | S | 2 | | Writing `$20` bits triggers "unqualified" interrupts for line/ULA/CTC 0–3 (`im2_int_unq`). | ✅ `interrupts/interrupts` (B64) |
| INT-015 | `$20` readback | S | 2 | | Returns status bits of ULA, line, CTC 0–3. | ✅ `interrupts/interrupts` (B64) |
| INT-016 | RETI clears in-service | S | 1 | | In hardware IM2 mode, a lower-priority pending interrupt is delayed until RETI of the higher one (daisy chain). | ✅ `interrupts/interrupts` (nesting both ways; B70 fixed in WASM) |
| INT-017 | RETN vs RETI | S | 2 | | Only RETI (`ED 4D`) releases the daisy chain. | ✅ `interrupts/interrupts` |
| INT-018 | DMA interrupt enables `$CC`–`$CE` | S | 2 | | When set, the matching interrupt sources are held off while DMA is active (per VHDL `dma_int_en`). | ◐ `interrupts/interrupts` (readbacks; the DMA break-in itself belongs to §4.25) |
| INT-019 | Pulse mode interrupt length | S | 2 | | `$22` bit 7 reads the INT pulse active while inside it. | ✅ `video/video-timing` VT-007 |
| INT-020 | IM0 behaviour | S | 3 | | IM0 with `$FF` on the bus executes RST 38. | ✅ `interrupts/interrupts` |
| INT-021 | Interrupt + HALT wake timing | S | 2 | | HALT loop wakes on frame interrupt at the documented tact. | — (needs the interrupt position and the handler start in one time base; VT-006's probe measures only the former) |
| INT-022 | Vector on the bus at acknowledge | S | 2 | `intack` | Observe the data bus vector directly for each source. | — (needs `intack`; INT-003 checks the vectors through the handler each one reaches) |
| INT-023 | EI delay | S | 2 | | Interrupt not taken on the instruction after EI. | ✅ `interrupts/interrupts` (B70 fixed: WASM acknowledged on the instruction after EI and stuck) |

### 4.20 `NMI` – NMI sources

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| NMI-001 | Multiface NMI via `$02` | S | 1 | | See RST-005; PC = `$0066` with MF memory paged. | ✅ `reset/reset-register` (RST-005) |
| NMI-002 | DivMMC NMI via `$02` | S | 1 | | See RST-004; DivMMC automap at `$0066`. | ✅ `reset/reset-register` (RST-004) |
| NMI-003 | NMI button enables `$06` | S | 2 | `nmi` | Bits 3/4 gate the M1 and Drive buttons. | ✅ `nmi/nmi` (harness: `pressHotkey("F9" \| "F10")`; B72 fixed: a press or `$02` request with its enable clear fired once the enable was set) |
| NMI-004 | Stackless NMI `$C0` bit 3 | S | 1 | | NMI does not push; return address stored in `$C2/$C3`; RETN jumps to that address. | ✅ `nmi/nmi` (B71 fixed: `$C2/$C3` not stored for a normal NMI, clearing bit 3 did not cancel the stackless RETN, the Multiface NMI was never stackless) |
| NMI-005 | `$C2/$C3` writable | S | 2 | | Handler changes `$C2/$C3`; RETN returns to the new address. | ✅ `nmi/nmi` (also: soft reset clears them) |
| NMI-006 | NMI during interrupt handler | S | 3 | | Priority and nesting per VHDL. | ✅ `nmi/nmi` (NMI inside an IM 1 handler, IFF2 kept in EI code, no nesting while DivMMC holds; B72 fixed: TS set the `$02` flag during HOLD) |
| NMI-007 | Expansion bus NMI debounce `$81` bit 5 | S | 3 | | Readback; effect if bus modelled. | ◐ `nmi/nmi` (readback and reset behaviour; the bus `/NMI` input is not driveable from the harness) |

### 4.21 `AY` – AY / TurboSound

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| AY-001 | Register select/write/read | S | 1 | | `$FFFD` select, `$BFFD` write, `$FFFD` read for registers 0–15 with register masks (e.g. R1 4 bits, R8 5 bits). | ✅ `audio/ay-psg` (B33, B73 fixed: R16-31, AY-mode read masks, R14/R15 input reads; also `$BFF5`) |
| AY-002 | Tone channel A | A | 1 | | Period 0x0FE, volume 15, mixer tone A only: output frequency within tolerance of f = clock/(16·period). Count zero crossings. | ✅ `audio/ay-psg` (B73 fixed: the coarse register counted 8 bits in YM mode) |
| AY-003 | Tone channels B and C | A | 1 | | Same for B and C, each alone. | ✅ `audio/ay-psg` |
| AY-004 | Volume levels 0–15 | A | 1 | | Amplitude monotonic, level 0 silent; logarithmic table per `ym2149.vhd`. | ✅ `audio/ay-psg` (YM and AY tables as DC-level ratios; B73 fixed: no AY mode) |
| AY-005 | Noise generator | A | 2 | | Noise period 0/31, mixer noise only: non-periodic output, spectral centroid rises with lower period. | ✅ `audio/ay-psg` (irregular runs, rate vs period, 5-bit period, LFSR recurrence o[n+17] = o[n] xor o[n+2]; B73 fixed: 8-bit period, taps 0/3) |
| AY-006 | Mixer register 7 | A | 1 | | Every tone/noise enable combination produces silence/tone/noise/both per channel. | ✅ `audio/ay-psg` |
| AY-007 | Envelope shapes 0–15 | A | 1 | | Each shape (R13) with volume mode bit 4: amplitude sequence (decay/attack/hold/alternate) matches the shape table. | ✅ `audio/ay-psg` (all 16 shapes against a model of `p_envelope_shape`, YM and AY; B73 fixed: the start level was held a full step) |
| AY-008 | Envelope restart on R13 write | A | 2 | | Rewriting R13 with the same value restarts the envelope. | ✅ `audio/ay-psg` |
| AY-009 | TurboSound enable `$08` bit 1 | S | 1 | | With enable, `$FFFD` value `%1111 11xx` selects chip 0/1/2; without, only chip 0. | ✅ `audio/ay-psg` |
| AY-010 | Three chips independent | A | 1 | | Different tones on each chip; all present in the mix; register reads per chip. | ✅ `audio/ay-psg` |
| AY-011 | Per-chip L/R enable bits | A | 2 | | `$FFFD` chip-select write bits 6–5 mute left/right per chip. | ✅ `audio/ay-psg` |
| AY-012 | Stereo mode ABC vs ACB `$08` bit 5 | A | 1 | | Channel A left, C/B right as per mode; B centered (ABC) etc. | ✅ `audio/ay-stereo-mode` |
| AY-013 | Mono `$09` bits 7–5 | A | 2 | | Per-chip mono flag puts all channels on both sides. | ✅ `audio/ay-psg` |
| AY-014 | AY vs YM mode `$06` bits 1–0 | A | 2 | | PSG mode: YM volume table (32 steps) vs AY; mode 11 disables. | ✅ `audio/ay-psg` (AY/YM tables, mode 10 = YM, mode 11 reset hold; B73 fixed: `$06` was ignored) |
| AY-015 | AY port enable bit 16 | S | 2 | | Disabled: writes silent, reads `$FF`. | ✅ `audio/ay-psg` (writes do not land), `ports/port-enables` (reads `$FF`) |
| AY-016 | Register read when chip disabled | S | 3 | | Read of chip 1 registers with TurboSound off per VHDL. | ✅ `audio/ay-psg` (the selected chip stays selected and alone in the mix when TurboSound goes off) |
| AY-017 | Tone period 0 and 1 | A | 3 | | Period 0 behaves like 1 per `ym2149.vhd`. | ✅ `audio/ay-psg` (tone and noise period 0 = 1, sample for sample) |
| AY-018 | Audio sample continuity across frames | A | 2 | | Continuous sine-like tone has no discontinuity at frame boundaries. | ✅ `audio/ay-psg` (B74 fixed: TS dropped a PSG sample to silence at frame ends) |
| AY-019 | CPU speed independence | A | 2 | | Same tone frequency at 3.5 and 28 MHz. | ✅ `audio/ay-psg` |

### 4.22 `DAC` – Soundrive / Covox / Specdrum

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| DAC-001 | DAC enable `$08` bit 3 | A | 1 | | With disable, port writes produce no output. | ✅ `audio/dac-enable` |
| DAC-002 | Soundrive mode 1 ports `$1F,$0F,$4F,$5F` | A | 1 | | Each port drives channel A/B/C/D; A,B left and C,D right. Requires enable bit 17. | ✅ `audio/dac` (channel found through the `$2C`-`$2E` mirrors; low-byte decode; enable bits 17/19/20) |
| DAC-003 | Soundrive mode 2 ports `$F1,$F3,$F9,$FB` | A | 2 | | Enable bit 18. | ✅ `audio/dac` (B75 fixed: `$F1`/`$F9` writes also paged like `$7FFD`) |
| DAC-004 | Profi Covox `$3F`/`$5F` | A | 2 | | Stereo A+D pair; enable bit 19. | ✅ `audio/dac` (B75 fixed: TS wrote `$3F` to A and D) |
| DAC-005 | Covox `$0F`/`$4F` | A | 2 | | Stereo B+C; enable bit 20. | ✅ `audio/dac` |
| DAC-006 | Pentagon/ATM mono `$FB` | A | 2 | | Writes A and D together; enable bit 21 and not mode-2. | ✅ `audio/dac` |
| DAC-007 | GS Covox mono `$B3` | A | 2 | | Enable bit 22. | ✅ `audio/dac` |
| DAC-008 | Specdrum `$DF` | A | 1 | | Mono A+D; enable bit 23; interaction with mouse port. | ✅ `audio/dac` (also: `$DF` reads Kempston with the mouse ports off; DAC ports read `$FF`) |
| DAC-009 | DAC value → amplitude linearity | A | 1 | | Writing 0, `$80`, `$FF` gives proportional sample levels. | ✅ `audio/dac` |
| DAC-010 | 8-bit sample playback rate | A | 2 | | Z80 loop writing a ramp at a fixed rate: ramp visible in samples. | ✅ `audio/dac` (B76 fixed: TS played the end-of-frame DAC value for the whole frame) |
| DAC-011 | DAC via NextReg mirrors `$2C`–`$2E` | A | 3 | | soundrive.vhd ~48-95: `$2C` writes channel B (left), `$2E` channel C (right), `$2D` channels A and D (mono); reads return the I2S input, not the DAC value (zxnext.vhd read mux). Both halves are testable. | ✅ `audio/dac` (B75 fixed: TS mirrors wrote while disabled; reads gave 0 / the DACs instead of the I2S sample) |
| DAC-012 | DAC reset value | A | 2 | | After reset all DAC channels are `$80` (silence midpoint) per `soundrive.vhd`. | ✅ `audio/dac-enable`, `audio/dac` (soft reset) |
| DAC-013 | DMA-driven DAC playback | A | 2 | | See DMA-020. | ✅ `dma/dma` (DMA-020) |

### 4.23 `BEEP` – Beeper, MIC, EAR, mixer

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| BEEP-001 | Beeper square wave | A | 1 | | Toggle `$FE` bit 4 at a known rate; output frequency matches. | ✅ `audio/beeper-mixer` |
| BEEP-002 | MIC bit 3 contribution | A | 2 | | `$FE` bit 3 alone produces a smaller amplitude per `audio_mixer.vhd`. | ✅ `audio/beeper-mixer` |
| BEEP-003 | Internal speaker `$08` bit 4 / `$06` bit 6 | S | 3 | | Readbacks; beeper-only-to-speaker flag effect on the mix per VHDL. | ✅ `audio/beeper-mixer` (B78 fixed: WASM ignored the exclusion) |
| BEEP-004 | Mixer sums sources | A | 1 | | Beeper + AY + DAC together: sample equals the mixer formula (no clipping below full scale). | ✅ `audio/beeper-mixer` (weights as ratios, additivity below the clamp; B77 fixed: EAR 5.1x / DAC 0.75x an AY channel. Output gain = author's choice, see B77) |
| BEEP-005 | EAR input reflected in `$FE` bit 6 | S | 2 | `tape` | Injected EAR level visible. | — (needs `tape`) |
| BEEP-006 | EAR input to audio | A | 3 | `tape` | Tape input audible per mixer. | — (needs `tape`) |
| BEEP-007 | Silence baseline | A | 1 | | After reset with no activity, samples are a constant level (DC) on both channels. | ✅ `audio/beeper-mixer` |
| BEEP-008 | Sample rate option | A | 2 | | 44100 vs 48000 `audioSampleRate`: samples per frame ≈ rate/50. | ✅ `audio/beeper-mixer` (B79 fixed: WASM dropped 0.45 sample a frame) |

### 4.24 `CTC` – Z80 CTC

Ports `$183B`–`$1F3B` = channels 0–7 (0–3 implemented as timers).

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| CTC-001 | Control word + time constant | S | 1 | | Write control with bit 2 (TC follows) then TC; reading the channel returns the down-counter. | ✅ `ctc/ctc` (hard reset reads 0; D2 = 0 stays in reset; the byte after D2 is the constant even with D0 = 1; one port per channel) |
| CTC-002 | Timer mode prescaler 16 | S | 1 | | Counter decrements every 16 CPU clock ticks (28 MHz-derived clock per `ctc.vhd`); measure with `step`/`runFrames`. | ✅ `ctc/ctc` (exactly 100 counts in 200 T-states, 101 in 202) |
| CTC-003 | Prescaler 256 | S | 1 | | Bit 5. | ✅ `ctc/ctc` (exactly 50 counts in 1600 T-states, 51 in 1632) |
| CTC-004 | Counter reload at zero | S | 1 | | Counter reloads TC; TC 0 = 256. | ✅ `ctc/ctc` (reload modulo TC over 23 counts; TC 0 a modulo-256 counter over 300) |
| CTC-005 | Software reset bit 1 | S | 1 | | Stops counting until a new TC. | ✅ `ctc/ctc` (D2 = 1: holds the old constant until a new one; D2 = 0: back to the reset state) |
| CTC-006 | Interrupt on ZC/TO | S | 1 | | Bit 7 + `$C5` enable + hardware IM2: handler at CTC vector runs once per period. | ✅ `ctc/ctc` (each channel once a period on `$A6`-`$AC`; `$C5` reads control-word D7; a D7 = 0 word stops them; pulse mode through `$FF`) |
| CTC-007 | Vector write (bit 0 = 0) | S | 2 | | CTC vector write ignored in Next hardware IM2 mode (vector from `$C0`) per VHDL. | ✅ `ctc/ctc` (hardware IM2 vector stays `$A6`, pulse mode `$FF`; the count is not disturbed) |
| CTC-008 | Channel chaining | S | 2 | | ZC/TO of channel n clocks channel n+1 in counter mode (bit 6). | ✅ `ctc/ctc` (0->1->2->3, 3->0, and 2->3->0->1 across the wrap; B81 fixed: the wrap chain never counted) |
| CTC-009 | Timer trigger bit 3 | S | 3 | | Trigger mode waits for clock edge per `ctc_chan.vhd`. | ✅ `ctc/ctc` (waits for the upstream ZC/TO, or a D4 change; B81 fixed: the upstream ZC/TO never started it) |
| CTC-010 | Channels 4–7 | S | 3 | | Read/write behaviour of unimplemented channels per VHDL. | ✅ `ctc/ctc` (read `$00`; writes reach no channel and set no status) |
| CTC-011 | Status `$C9` bits | S | 1 | | Pending CTC interrupt status; clear by writing 1. | ✅ `ctc/ctc` (bits per channel, write-1 clears) |
| CTC-012 | CTC port enable bit 27 | S | 2 | | Disabled: writes ignored. | ✅ `ctc/ctc` (writes ignored; a running channel keeps running), `ports/port-enables` |
| CTC-013 | Frame-accurate period over many frames | S | 2 | | ZC/TO count over 50 frames matches the computed rate within ±1. | ✅ `ctc/ctc` (two rates over 50 frames within 1) |
| CTC-014 | CTC speed with CPU turbo | S | 2 | | Period in real time independent of `$07`. | ✅ `ctc/ctc` (same count over 50 frames at 3.5 and 28 MHz) |

### 4.25 `DMA` – DMA

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| DMA-001 | Port `$6B` ZXN mode vs `$0B` Z80 mode | S | 1 | | Same command sequence on each port; Z80-DMA mode differences (length +1) per `dma.vhd`. | ✅ `dma/dma` (4 vs 5 bytes; the mode is the port of the last access - a `$0B` load counts from `$FFFF`; B82 fixed) |
| DMA-002 | WR0 source/dest addresses and length | S | 1 | | Program base register groups; read back via read mask. | ✅ `dma/dma` (status, counter, port A, port B from reset; B->A; Z80 load `$FFFF`; B82 fixed: mask reset 0, status format) |
| DMA-003 | Mem→mem transfer | S | 1 | | Copy 256 bytes; destination matches, source unchanged. | ✅ `dma/dma` (256 bytes; counter = 256, addresses past the block; B82 fixed: counter one past) |
| DMA-004 | Mem→mem overlapping, decrement | S | 2 | | Decrement addresses on both sides. | ✅ `dma/dma` (decrement both, overlapping move up, reversed copy) |
| DMA-005 | Fixed address (source or dest) | S | 1 | | Fill memory from a fixed source byte. | ✅ `dma/dma` (fixed source fill, fixed destination keeps the last byte) |
| DMA-006 | Mem→I/O | S | 1 | | Transfer to a port (e.g. `$FE` border or DAC); last value observed. | ✅ `dma/dma` (to the AY data port) |
| DMA-007 | I/O→mem | S | 2 | | Read a port repeatedly into memory. | ✅ `dma/dma` (from the AY register port) |
| DMA-008 | Burst vs continuous mode | S | 1 | | WR4 mode bits; CPU resumes between bytes in burst mode. | ✅ `dma/dma` (burst frees the bus while the prescaler waits; continuous, byte and unprescaled burst keep it; B82 fixed: byte mode released it) |
| DMA-009 | ZXN prescaler WR2 | S | 1 | | Byte rate = 875000 / prescaler Hz; measure bytes per frame. | ✅ `dma/dma` (4P + 2 T-states a byte at 3.5 MHz continuous, same rate in burst, 32P at 28 MHz; B82 fixed: 8x too fast at 3.5 MHz, ignored in continuous mode) |
| DMA-010 | Enable / disable commands `$87`/`$83` | S | 1 | | Stop mid-transfer; counter keeps position; enable resumes. | ✅ `dma/dma` |
| DMA-011 | Load `$CF` | S | 1 | | Loads base into current addresses/counter. | ✅ `dma/dma` |
| DMA-012 | Continue `$D3` | S | 2 | | Continues without reloading addresses. | ✅ `dma/dma` (also: a Z80 continue moves length + 1) |
| DMA-013 | Auto restart WR5 | S | 1 | | Transfer restarts at end of block (looped playback). | ✅ `dma/dma` (end of block stays reached; B82 fixed) |
| DMA-014 | Status byte | S | 1 | | Read status: end-of-block and ready bits per `dma.vhd`. | ✅ `dma/dma` (`$3A` idle, `$3B` mid-transfer, `$1A` done, `$8B`, `$CF`; B82 fixed) |
| DMA-015 | Read mask `$BB` + read sequence | S | 1 | | Reads cycle through selected registers; `$A7` initialises. | ✅ `dma/dma` (masks, `$A7`, empty mask, `$BF` then the mask; B82 fixed) |
| DMA-016 | Reset `$C3` | S | 1 | | Clears state per VHDL. | ✅ `dma/dma` (stops; clears prescaler and auto restart; keeps addresses, length, read mask) |
| DMA-017 | CPU halted during continuous transfer | S | 1 | | `tacts`/PC progression: CPU does not advance while DMA owns the bus. | ✅ `dma/dma` (6 T-states a byte at 3.5 MHz, 4 with 2-cycle timing; B82 fixed: 1 T-state) |
| DMA-018 | Interrupts during DMA | S | 2 | | With `$CC`–`$CE`, selected interrupts can/cannot fire while DMA is active. | ✅ `dma/dma` (without `$CC` the ULA interrupt waits; with it, it breaks in; B82 fixed: no break-in across a frame end) |
| DMA-019 | Transfer to Layer 2 memory | P | 2 | | DMA fill of a paged Layer 2 bank; pixels visible. | ✅ `dma/dma` |
| DMA-020 | DAC sample playback | A | 1 | | Burst mem→`$DF` at prescaler for 8 kHz: audio shows the sample ramp at the right rate. | ✅ `dma/dma` (Specdrum ramp at 4P + a few T-states a step; B82 fixed: 8x too fast) |
| DMA-021 | Length 0 semantics | S | 2 | | dma.vhd: the transfer goes on while counter < length after each byte, so length 0 moves one byte on both ports; length 1 moves one byte on `$6B`, two on `$0B`. | ✅ `dma/dma` (B82 fixed: length 0 moved nothing) |
| DMA-022 | Port enable bits 5 and 25 | S | 2 | | Disable each DMA port separately. | ✅ `dma/dma`, `ports/port-enables` |
| DMA-023 | WR3 / WR6 undocumented bytes | S | 3 | | Ignored bytes don't break the sequence. | ✅ `dma/dma` (WR3 mask/match, WR1 second timing byte, interrupt commands; WR0 search bits; WR4 interrupt control; WR4 D4 alone = deaf until reset; B82 fixed) |

### 4.26 `DIV` – DivMMC

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| DIV-001 | Port `$E3` conmem bit 7 | S | 1 | | DivMMC ROM at `$0000`, RAM page (bits 3–0) at `$2000`. | ✅ `divmmc/divmmc` (ROM contents loaded through config mode, read-only; RAM page at `$2000`; `$E3` reads bits 7-6, 3-0) |
| DIV-002 | RAM page select | S | 1 | | 16 pages distinct at `$2000`. | ✅ `divmmc/divmmc` |
| DIV-003 | Mapram bit 6 | S | 1 | | RAM page 3 read-only at `$0000`; the bit is sticky (a write ORs it in) until a `$09` write with bit 3 or a reset (zxnext.vhd ~4155-4165: any `reset`, soft included). | ✅ `divmmc/divmmc` (B83 fixed: `$09` bit 3 only let a later `$E3` write clear it) |
| DIV-004 | `$2000` write protect with mapram | S | 1 | | Page 3 not writable at `$2000` when mapram set and conmem clear. | ✅ `divmmc/divmmc` (with conmem and through automap) |
| DIV-005 | Automap enable `$0A` bit 4 | S | 1 | | Automap only when enabled. | ✅ `divmmc/divmmc` (clearing bit 4 unmaps at once) |
| DIV-006 | Automap entry points (instant) | S | 1 | | Fetch at `$0000`, `$0008`, `$0038`, `$0066`, `$04C6`, `$0562` pages in DivMMC per `$B8`/`$B9`/`$BA` defaults (instant vs delayed). | ✅ `divmmc/divmmc` (`$0000`, `$0008`, `$0038`, `$04C6`, `$0562` delayed; the ROM supplies only the opcode, DivMMC the operands; RST `$10`-`$30` off) |
| DIV-007 | Automap `$3Dxx` instant | S | 1 | | Fetch at `$3D00–$3DFF` pages instantly (ROM 3 only per VHDL). | ✅ `divmmc/divmmc` (instant with ROM 3, none with ROM 0) |
| DIV-008 | Automap off at `$1FF8–$1FFF` | S | 1 | | Fetch there unmaps (delayed). | ✅ `divmmc/divmmc` (the `$1FF8` opcode from DivMMC, its operands from ROM; `$BB` bit 6 off keeps it mapped; B83 fixed: WASM took the operands from DivMMC) |
| DIV-009 | Entry point registers `$B8`–`$BB` | S | 2 | | Change valid/timing bits; entry points enable/disable accordingly. | ✅ `divmmc/divmmc` (`$B8`-`$BA` per RST: enable, instant, always/ROM 3; `$BB` bits 5-2) |
| DIV-010 | RETN unmaps | S | 2 | | RETN clears automap per VHDL. | ✅ `divmmc/divmmc` (unmaps before the next fetch, conmem stays; RETI and ED 55 do not unmap; B83 fixed: TS unmapped one fetch late, WASM unmapped on RETI) |
| DIV-011 | Automap ROM condition | S | 2 | | Entry points only active when the matching ROM is paged (`$BB` bits). | ✅ `divmmc/divmmc` (ROM 0; RAM paged at `$0000` stops ROM-3 entries, not 'always' ones; B83 fixed) |
| DIV-012 | DivMMC port enable bit 8 | S | 2 | | Disabled: `$E3` has no effect. | ✅ `divmmc/divmmc` (no paging, writes ignored, state kept; B83 fixed: TS still paged in with conmem) |
| DIV-013 | Soft reset clears `$E3` | S | 1 | | zxnext.vhd ~4157: `port_e3_reg` is cleared by `reset` - soft and hard alike, mapram included; automap goes too. | ✅ `divmmc/divmmc` |
| DIV-014 | DivMMC NMI | S | 2 | | See NMI-002. | ✅ (NMI-002, `reset/reset-register`) |

### 4.27 `MF` – Multiface

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| MF-001 | MF type ports by `$0A` bits 7–6 | S | 2 | | MF+3 (`$3F`/`$BF`), MF128 (`$BF`/`$3F`), MF1 (`$9F`/`$1F`) enable/disable ports. | ✅ `multiface/multiface` (all four types; foreign ports do nothing) |
| MF-002 | Page in via NMI | S | 1 | | NMI (via `$02`) pages MF ROM at `$0000`, RAM at `$2000`. | ✅ `reset/reset-register` (RST-005) |
| MF-003 | Page out by port read | S | 1 | | Reading the disable port pages out. | ✅ `multiface/multiface` (disable read; RAM writable, ROM not; RETI does not page out; MF+3 disable read ends the NMI, MF128 not; B84 fixed) |
| MF-004 | MF+3 port reads return `$7FFD`/`$1FFD` | S | 2 | | While paged, reading `$1F3F`/`$7F3F` return last paging values per `multiface.vhd`. | ✅ `multiface/multiface` (MF+3 by A15-A12, MF128 `$7FFD` bit 3, MF48 no answer; B84 fixed: `$DFFD` bit 6) |
| MF-005 | MF invisibility | S | 2 | | Enable-port read when invisible returns floating/`$FF`. | ✅ `multiface/multiface` (invisible after reset; MF48 never; MF+3 enable-port write, MF128 disable-port write) |
| MF-006 | Port enable bit 9 | S | 3 | | Disabled ports. | ✅ `multiface/multiface` (B84 fixed: WASM kept its state) |
| MF-007 | DivMMC and MF coexistence | S | 3 | | Priority when both paged per VHDL. | ✅ `multiface/multiface` (MF above DivMMC; no MF NMI with conmem; no DivMMC NMI while MF paged in) |

### 4.28 `SPI` – SPI, SD card, flash

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| SPI-001 | `$E7` chip select values | S | 1 | | Low bits `10` SD0 / `01` SD1 first, then exact `$FB` Pi 0, `$F7` Pi 1, `$7F` flash (config mode or reset type bit 2); else `$FF`. Exists (`spi-flash-select.test.ts`); extend to all values. Bug B2. | ✅ `sd/spi-flash-select` (the WASM latch), `sd/sd-card` (both cores, through which card answers) |
| SPI-002 | `$EB` byte exchange | S | 1 | | Write/read round trip with no card returns `$FF`. | ✅ `sd/sd-card` (deselected bus; port enable bit 11 off) |
| SPI-003 | SD card init sequence | S | 1 | `sd` | CMD0/CMD8/ACMD41 responses. | ✅ `sd/sd-card` (CMD0 $01, CMD8 R7, ACMD41, CMD58 OCR; idle $FF bytes are not commands; B86 fixed) |
| SPI-004 | Read block CMD17 | S | 1 | `sd` | Returns the image bytes of a sector. | ✅ `sd/sd-card` (R1, token, the image's sector, CRC16) |
| SPI-005 | Write block CMD24 | S | 1 | `sd` | Image sector updated. | ✅ `sd/sd-card` (data response $05, busy, image updated, read back) |
| SPI-006 | Multi-block read/write | S | 2 | `sd` | CMD18/CMD25 with stop token. | ◐ `sd/sd-card` - CMD18 + CMD12 (B86 fixed: the first block lost CMD18's R1); CMD25 is not modelled by either core |
| SPI-007 | Card 1 vs card 0 | S | 3 | `sd` | Deselect returns `$FF`. | ✅ `sd/sd-card` (empty slot 1 and a deselected card read $FF; B86 fixed) |
| SPI-008 | Flash read ID | S | 3 | | Flash chip select in config mode returns flash ID per emulator model. | ✅ `sd/sd-card` (documented: no flash model, a JEDEC ID read gives $FF) |
| SPI-009 | NextZXOS boot from SD | V | 1 | `sd` | Browser tier: boots to the NextZXOS menu; golden picture. | ✅ `sd/nextzxos-boot` - headless, both cores, from a clone of `~/Klive/ks2.cim` (skipped without it): menu up, both cores identical including the RTC date line (same `setRtcTime`); the browser tier boots it too |

### 4.29 `UART` – UART

Ports: `$133B` TX, `$143B` RX, `$153B` select, `$163B` frame.

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| UART-001 | Select `$153B` | S | 1 | | Bit 6 selects UART 0/1; readback. | ✅ `uart/uart` (readback `"00000"`/`"01000"` & MSB; bit 4 routes the MSB to the UART the same write selects - B87; the other registers follow the select; a soft reset selects UART 0 and keeps the MSBs) |
| UART-002 | Baud prescaler via `$143B` writes | S | 1 | | Lower 14 bits in two writes (bit 7 selects part), upper via `$153B` bit 4; readbacks per `uart.vhd`. | ✅ `uart/uart` - observed through the transmit time (only the MSB reads back): one bit = prescaler 28 MHz clocks, default 243, each half of the LSB and the MSB, per UART, kept by a soft reset (B87) |
| UART-003 | TX status bits | S | 1 | `uart` | `$133B` read: TX empty, TX full, RX avail, RX near full, error flags. | ✅ `uart/uart` (TX empty/full with 64 queued behind the byte sending, the 66th write dropped; framing/parity error, the error flag stored with the next byte, cleared by the status read) |
| UART-004 | Transmit byte timing | S | 2 | `uart` | TX empty clears then sets after 10 bits at the baud rate. | ✅ `uart/uart` (to the T-state: start + 5-8 data + parity + 1-2 stop bits for 7 frame formats, two bytes back to back, the data bits the peer gets; the baud rate does not follow the CPU speed) |
| UART-005 | Receive and FIFO | S | 1 | `uart` | Bytes from peer appear in RX; FIFO depth 512 (UART0) per VHDL; overflow flag. | ✅ `uart/uart` (order, 0 when empty, 7-bit frames, available half a bit before the frame ends, near full at 384, 512 + one held, the next overflows, the error flag after an overflow, loopback, UART 1's own lines) |
| UART-006 | Frame register `$163B` | S | 2 | | Bits/parity/stop bits; reset bit 7 clears FIFOs. | ✅ `uart/uart` (all 8 bits read back; bit 7 holds FIFOs and state machines in reset while set - TX empty reads 0 meanwhile, writes and received bytes are lost, a byte being sent is cut off; kept by a soft reset - B87) |
| UART-007 | RX interrupt | S | 2 | `uart` | `$C6` enable; RX avail vs near-full selection per `im2_int_req` formula. | ✅ `uart/uart` (vector index 1 / 2, one interrupt per rising level, near-full-only at 384, polled `$CA` bits 1-0 / 5-4 - B87) |
| UART-008 | TX empty interrupt | S | 3 | `uart` | | ✅ `uart/uart` (vector index 12 / 13; the request is the TX FIFO emptying, one byte time before TX empty; every reset latches `$CA` bits 6 and 2 - B87) |
| UART-009 | Break / hardware flow control | S | 3 | `uart` | `$163B` bits per VHDL. | ✅ `uart/uart` (TX break: busy, nothing sent; RX break: framing error, then bit 7 while the line is low; CTS holds the transmitter; RTR stops the peer at 510 bytes, no overflow) |
| UART-010 | Port enable bit 12 | S | 3 | | | ✅ `ports/port-enables` (status read), `uart/uart` (all four ports read `$FF`, writes ignored) |

### 4.30 `I2C` – I2C / RTC

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| I2C-001 | SCL/SDA ports `$103B/$113B` | S | 2 | | Written level reads back (open-drain with pull-up when no device). | ✅ `i2c/i2c-rtc` (`$FE` \| the line, bit 0 only, a soft reset releases both) |
| I2C-002 | Start/stop and address ACK | S | 2 | `rtc` | Bit-banged address `$D0` gets ACK from DS1307. | ✅ `i2c/i2c-rtc` (`$D0` and `$D1` ACKed, bus released after STOP; WASM had no DS1307 - B89) |
| I2C-003 | RTC time read | S | 2 | `rtc` | Registers 0–6 BCD match the set time. | ✅ `i2c/i2c-rtc` (set time in BCD, whole seconds, 7 rollovers incl. leap years and the century, 12-hour AM/PM, the time copied at START; B89), `sd/nextzxos-boot` (both menus show the same date) |
| I2C-004 | RTC write | S | 3 | `rtc` | Written time reads back. | ✅ `i2c/i2c-rtc` (time, control, 56 RAM bytes; pointer wraps `$3F` → `$00` and persists; a seconds write restarts the second; CH stops the clock; RAM and time survive soft and hard resets - B89) |
| I2C-005 | Unknown address NACK | S | 3 | | | ✅ `i2c/i2c-rtc` (six other addresses NACKed, their data does not reach the DS1307) |
| I2C-006 | Port enable bit 10 | S | 3 | | | ✅ `ports/port-enables` (read), `i2c/i2c-rtc` (both ports read `$FF`, writes ignored) |

### 4.31 `KEY` – Keyboard

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| KEY-001 | Matrix half-rows | S | 1 | `key` | Each of the 40 keys pressed alone clears exactly one bit in the right `$xxFE` read. | ✅ `keyboard/keyboard` (bits 7 and 5 read 1) |
| KEY-002 | Multiple keys / ghosting | S | 2 | `key` | Three keys forming a rectangle behave per membrane model (no ghosting on Next). | ✅ `keyboard/keyboard` (one row, several rows, a rectangle shows no fourth key - the membrane logic holds every row's state; electrical ghosting is not in the VHDL and not modelled) |
| KEY-003 | Partial address decoding | S | 2 | `key` | Reading with multiple low address bits in the high byte ANDs the rows. | ✅ `keyboard/keyboard` (rows AND; no row selected reads `$1F`; any even port is `$FE`) |
| KEY-004 | Extended keys `$B0/$B1` | S | 1 | `key` | Next extended keys (`;`, `"`, `,`, `.`, arrows, EDIT, BREAK, …) set bits in `$B0/$B1`. | ✅ `keyboard/keyboard` (all 16: their `$B0`/`$B1` bit and their two matrix keys per membrane.vhd - B90) |
| KEY-005 | Extended keys cancel `$68` bit 4 | S | 2 | `key` | Bit 4 set: extended keys no longer produce matrix combinations (e.g. arrow = CAPS+5). | ✅ `keyboard/keyboard` (no matrix entries, `$B0`/`$B1` still set, real matrix keys unaffected, bit 4 reads back and clears on reset - B90) |
| KEY-006 | Keyboard ROM scan | S | 1 | `key` | Browser/48K ROM tier: pressing keys types into BASIC (screen case). | ✅ `keyboard/keyboard` - headless NextZXOS from a clone of `~/Klive/ks2.cim` (skipped without it), both cores: DOWN/ENTER in the menu, `POKE 40000,42` (the extra `,` key) and `BORDER 2` typed into NextBASIC |
| KEY-007 | Keyjoy mapping `$05` modes | S | 3 | `key`,`joy` | Joystick mapped to keys (mode 101?) per VHDL. | ✅ `joystick/joystick` (mode `111` through the joymap programmed with `$28`/`$29`/`$2B`, extra keys included; Kempston buttons 5-11 and MD buttons 8-11 through the same entries; kept by a soft reset, restored by a core load - B91) |
| KEY-008 | PS/2 mode `$06` bit 2 | S | 3 | | Readback only. | ✅ `keyboard/keyboard` (written only in config mode, kept by a soft reset - B90) |

### 4.32 `JOY` – Joysticks

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| JOY-001 | Kempston 1 `$1F` | S | 1 | `joy` | Directions + fire bits for `$05` mode Kempston 1. | ✅ `joystick/joystick` (R L D U B C in bits 0-5, A/START not shown, both connectors OR) |
| JOY-002 | Kempston 2 `$37` | S | 1 | `joy` | Joystick 2 in Kempston 2 mode. | ✅ `joystick/joystick` (either connector) |
| JOY-003 | Sinclair 1/2 | S | 2 | `joy` | Mapped onto keyboard rows (`$EFFE`/`$F7FE`). | ✅ `joystick/joystick` - per keyjoy_64_6.coe mode `011` presses 7 6 8 9 0 and mode `000` 2 1 3 4 5 (R L D U fire); zxnext.vhd's comment block names them the other way round (B91) |
| JOY-004 | Cursor mode | S | 2 | `joy` | Mapped to 5/6/7/8/0. | ✅ `joystick/joystick` (R 8, L 5, D 6, U 7, fire 0, no CAPS SHIFT; combines with the keyboard - B91) |
| JOY-005 | MD pad 3/6 button | S | 2 | `joy` | Extra buttons in `$1F` bits 7–5 and `$B2`. | ✅ `joystick/joystick` (START/A in bits 7-6 of `$1F`/`$37`; X Z Y MODE of both pads in `$B2` - B91) |
| JOY-006 | `$05` mode encoding | S | 1 | | 3-bit mode per joystick split across bits (7–6 + 3 / 5–4 + 1); readback. | ✅ `joystick/joystick` (readback and the port the split selects; WASM ignored `$05` - B91) |
| JOY-007 | Joystick I/O mode `$0B` | S | 3 | | Readback; pin output mode per VHDL. | ✅ `joystick/joystick` (readback mask `$B1`, reset `$01`; I/O mode passes the six raw pins, stops the key joystick - B91). Not observable from the CPU: the pin 7 output (`$0B` bits 5-4 and 0), the UART on the joystick pins |
| JOY-008 | No joystick connected | S | 1 | | Kempston reads 0 with no input. | ✅ `joystick/joystick` (0 in a Kempston mode; `$FF` when no mode uses the port - B91) |

### 4.33 `MOU` – Kempston mouse

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| MOU-001 | X `$FBDF` / Y `$FFDF` counters | S | 1 | `mouse` | Movement changes 8-bit counters with wrap. | ✅ `mouse/mouse` (wrap, reads do not change them, A15-12 not decoded; a Next reset keeps them, only power-on clears them - B92) |
| MOU-002 | Buttons `$FADF` | S | 1 | `mouse` | Left/right/middle bits and wheel nibble. | ✅ `mouse/mouse` (0 = pressed, bit 3 = 1, held across packets; wheel's 4-bit delta wraps) |
| MOU-003 | Button reverse `$0A` bit 3 | S | 2 | `mouse` | Swaps left/right. | ✅ `mouse/mouse` (applied as each packet arrives, not to the latched buttons - B92) |
| MOU-004 | DPI `$0A` bits 1–0 | S | 3 | `mouse` | Movement scaling. | ✅ `mouse/mouse` (00 doubles, 01, 10 / 11 shift the packet's byte with its bit 7 as the sign; X and Y - B92) |
| MOU-005 | Port enable bit 13 | S | 2 | | Disabled: ports read `$FF`, `$DF` goes to Specdrum/joystick. | ✅ `mouse/mouse` (`$FF` with no `$DF` reader; the mouse still counts; with the Specdrum port on, every `$xxDF` is the Kempston 1 alias - B92), `ports/port-enables` |

### 4.34 `FDC` – +3 FDC I/O traps

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| FDC-001 | `$D8` enable | S | 3 | | Readback. | ◐ `nextreg/read-mux` |
| FDC-002 | Ports `$2FFD/$3FFD` decoded only when enabled | S | 3 | | | — |
| FDC-003 | Trap generates NMI | S | 3 | | Access to `$2FFD/$3FFD` with trap enabled sets `$DA` cause, `$D9` write value, `$02` bit 4, and NMI. | ✅ `reset/reset-register` (RST-006) |
| FDC-004 | +3 FDC emulation status | S | 3 | | If the emulator models a µPD765 (`SpectrumP3FdcStatusPortHandler`), status port reads idle `$80`. | — |

### 4.35 `BUS` – Expansion bus

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| BUS-001 | `$80` enable and reset copy | S | 3 | | Bits 3–0 copy into 7–4 on soft reset. | — |
| BUS-002 | `$81` bits | S | 3 | | ULA override bit 6, readback of ROMCS. | — |
| BUS-003 | Bus port enables `$86`–`$89` | S | 3 | | Readback and effect when bus enabled (AND with internal enables). | — |
| BUS-004 | `$8A` propagate | S | 3 | | Readback bits 5–0. | — |
| BUS-005 | Bus disabled has no effect | S | 2 | | With `$80` bit 7 = 0, `$86`–`$89` do not gate internal ports. | — |

### 4.36 `GPIO` – Board registers

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| GPIO-001 | Pi GPIO output enables `$90`–`$93` | S | 3 | | `$90` bits 1–0 read 0. | — |
| GPIO-002 | GPIO inputs `$98`–`$9B` | S | 3 | | Read idle value with nothing attached. | — |
| GPIO-003 | Pi peripheral enable `$A0` | S | 3 | | Readback mask `00xxx00x`. | — |
| GPIO-004 | Pi I2S `$A2` | S | 3 | | Readback with bits 5 = 0, 1 = 1. | — |
| GPIO-005 | ESP GPIO `$A8/$A9` | S | 3 | | Readback formats. | — |
| GPIO-006 | XADC `$F8`–`$FA` / XDEV `$F0` | S | 3 | | Readback behaviour the emulator chooses, documented. | — |
| GPIO-007 | `$10` core ID / buttons | S | 3 | | Bit 7 = 0; button bits idle. | — |

### 4.37 `PAR` – Cross-core parity and soak

| ID | Name | FE | Pri | Needs | Description | Status |
|---|---|---|---|---|---|---|
| PAR-001 | NextReg state parity after random writes | S | 1 | | Seeded random writes to all writable registers via `onEachCore`; every readback equal. | — |
| PAR-002 | Screen parity for random layer setups | V | 2 | | Seeded random combinations of `$15`, `$68`, `$6B`, `$70`, scrolls and clips with fixed content; TS and WASM frames equal. | — |
| PAR-003 | Audio parity | A | 2 | | AY + DAC + beeper program; sample arrays equal on both cores (or within 1 LSB). | — |
| PAR-004 | Long-run timing parity | S | 2 | | 3000 frames: `tacts`, `frames`, registers equal. | ◐ visual `D05` (`--long`) |
| PAR-005 | Demo-style raster program | V | 2 | | Combination of line interrupts, copper, sprites and Layer 2 scroll; both tiers. | — |
| PAR-006 | Checkpoint restore parity | S | 3 | `ckpt` | Save/restore mid-frame continues identically. | — |
| PAR-007 | Real-software smoke tests | V | 2 | `sd` | Browser tier `.nexload` of a set of freely distributable Next programs; golden frames at fixed frame numbers. | — |

---

## 5. Implementation order

1. **Harness gaps first where cheap:** `key`, `joy`, `mouse`, `intack`, `iolog` (README candidates).
   Each gets a self-test on both cores.
2. **Known bugs as failing tests** (write, watch fail, fix or `it.fails`): NR-012 (B3), COP-001 (B4),
   RST-014/COP-004 (B5), CMP-004/005/006 (B6), ULN-002/ULP-004 (B7), ULA-008/TMX-008/L2-021 (B8),
   COP-005 (B9), SPI-001 (B2).
3. **Priority 1 across areas**, one area per PR, ordered: `NR`/`RST` → `MEM`/`PORT` → `INT` → `VT` →
   `ULA` → `PAL` → `L2` → `TM` → `SPR` → `CMP` → `AY`/`DAC`/`BEEP` → `CTC` → `DMA` → `DIV`/`MF` →
   `SPI` → `KEY`/`JOY`/`MOU`.
4. **Retire mock tests** in `test/zxnext/` as each area gains coverage (README "Replacing a mock-based
   unit test"). Keep pure-function tests (`palette-codec`, key code mapping).
5. Priority 2, then 3.

Per area, record status in this file: add a column **Status** (`todo` / `pass` / `xfail:Bn` / `withdrawn`)
when the first test of that area lands.

## 6. Open questions to resolve while implementing

- Entries marked "per `x.vhd`" / "read before asserting" have not had their exact values extracted yet.
- Whether the emulator intends to model memory contention (MEM-023), the µPD765 (FDC-004), flash
  (SPI-008), and board GPIO (GPIO-*). If not, those tests document the chosen behaviour instead.
- Audio tolerance policy - **settled 2026-09-18** in `test/zxnext-hw/audio/_audio-helpers.ts`: frequency
  within 1 %, levels as ratios against a full-scale level measured in the same session (so the mixer's
  scaling, a BEEP-area question, drops out) within 0.01 of the VHDL table ratio.

## 7. Implementation status

Every catalogue row carries a **Status** cell. Test files are named relative to `test/zxnext-hw/`
(`nextreg/read-mux` = `test/zxnext-hw/nextreg/read-mux.test.ts`); "visual `C04`" is a screen case in
`test/visual/copper/`.

| Mark | Meaning |
|---|---|
| ✅ | Implemented, passes on both cores (or on the core named). |
| ◐ | Partly covered: an existing test checks part of the description; the rest is still to write. |
| ❌ (Bn) | The test exists and is a known failure (`it.fails` / `knownFailures`) on the named core, for the bug `Bn` in `.plans/ZX_NEXT_EMULATOR_BUGS_HANDOVER.md`. |
| — | Not started. |

When a test lands, update its row in the same change. Open known failures right now: B26
(no memory contention, MEM-023).
