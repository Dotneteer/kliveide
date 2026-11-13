# ZX Spectrum Next: the KS3, core 3.03.03 and System/Next 26.11a

A self-contained briefing for an AI assistant (or a person) working on ZX Spectrum Next software,
emulation or documentation. Written 2026-11-13 from the sources named in each section. Every fact is
marked by how it is known:

- **[VHDL]**: read in the public FPGA source of core **3.02.04** (gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA,
  branch `30204`, commit `dc8d7641`, `cores/zxnext/src/`). Line numbers are approximate (`~`).
- **[DOC]**: stated by the official System/Next distribution (gitlab.com/thesmog358/tbblue, commit
  `3a892b03`, 2026-11-08 = the **26.11a** release) or its release page, specnext.com/latestdistro.
- **[INFERRED]**: concluded from the above, not stated anywhere. Treat as a working assumption.
- **[MEASURED-EMU]**: measured in the Klive IDE emulator, which models the VHDL; not a real board.
- **[ROM]**: read in the NextZXOS ROM bytes of the distribution (see that section).
- **[MEASURED-HW]**: timings the distribution's documents report as measured on a real board.

**Core 3.03's VHDL is not published** (as of 2026-11-12 the FPGA repository's newest branch is `30205`).
Everything about core 3.03 comes from documents, not source.

## Boards and versions

| Board | Kickstarter | `g_board_issue` (NextReg `$0F` bits 3-0) | SRAM chip | SRAM |
|---|---|---|---|---|
| Issue 2 | KS1 | 0 | AS7C34096 | 1 MB, or 2 MB with the expansion |
| Issue 3 | - | 1 | - | - |
| Issue 4 | KS2 | 2 | IS61WV102416FBLL (1M x 16) | 2 MB |
| Issue 5 | KS3 | 3 | IS61WV204816BLL-10BLI (2M x 16, 10 ns) | **4 MB** |

- [VHDL] `zxnext_top_issue5.vhd` ~39: `g_board_issue := X"3"`; NextReg `$0F` returns it (`zxnext.vhd` ~6455).
  The chip names are the comments on `ram_addr_o` in each `zxnext_top_issue*.vhd` (~73).
- [DOC] `nextreg.txt` (3.02.04): `$0F` value `0011` = "ZXN Issue 5, XC7A35T-2CSG324".
- **Detect a KS3 by reading NextReg `$0F` and comparing bits 3-0 with 3.**

The current release, **System/Next 26.11a**, ships **core 3.03.03** for issues 2, 4 and 5 [DOC: release page
"Core version: 3.03.03 (Issues 2,4,5)"; the distribution's README; its commit `cb4c0bd` "Core 3.03.03 - Fixes
audio glitches on some HDMI monitors"]. Its `CHANGELOG` headline still says "Core 3.03.00 (28MHz 0 WS -
zxnDDMA)": the features arrived in 3.03.00, and 3.03.03 is the version shipped. NextReg `$01` reads
`(major << 4) | minor` = `$33` and `$0E` the sub-minor = `$03` for 3.03.03.

## The physical memory map

[VHDL] The SRAM is one flat physical space; the ROMs live in it too:

| Physical | Contents |
|---|---|
| `$000000-$00FFFF` | NextZXOS ROMs 0-3 (64K) |
| `$010000-$013FFF` | DivMMC ROM |
| `$014000-$017FFF` | Multiface ROM and RAM |
| `$018000-$01BFFF` | Alternate ROM 0 |
| `$01C000-$01FFFF` | Alternate ROM 1 |
| `$020000-$03FFFF` | DivMMC RAM (16 x 8K) |
| `$040000-$1FFFFF` | Spectrum/Next RAM: 8K page n at `$040000 + n x $2000` (pages 0-223), 16K bank n at `$040000 + n x $4000` (banks 0-111) |
| `$200000-$3FFFFF` | **KS3 only: the extra 2 MB** |

Banks 5 and 7 (pages `$0A`/`$0B` and `$0E`) are **block RAM inside the FPGA** when reached through the
MMU: the ULA reads them there, and the SRAM at their physical addresses (`$054000`, `$05C000`) is a separate
store the MMU never touches [VHDL: `sram_pre_active <= not mem_active_bank5 and not mem_active_bank7`, ~3334].

## Reaching the KS3's upper 2 MB

### Not through the MMU, on any board

[VHDL] The MMU turns an 8-bit page number into SRAM address bits 21-13 like this (~3258):

```vhdl
mmu_A21_A13 <= ("0001" + ('0' & mem_active_page(7 downto 5))) & mem_active_page(4 downto 0);
```

That adds 32 pages (the `$040000` offset). For pages `$E0-$FF` the sum sets bit 8 of `mmu_A21_A13`, and bit 8
set means **no SRAM cycle** (~3331: only `mmu_A21_A13(8) = '0'` selects SRAM; slots 0-1 show ROM instead,
slots 2-7 read nothing useful and drop writes). So **NextRegs `$50-$57` reach pages 0-223 only, on every
board, the KS3 included.** Layer 2's paging uses the same formula (`layer2_A21_A13`, ~3265), with the same
limit. An 8-bit page number could not name more than 256 x 8K = 2 MB anyway.

### Config-mode NextReg `$04` (firmware territory)

[VHDL] ~6218-6246: NextReg `$04` ("Config Mapping") stores **7 bits on issues 2-4 and all 8 bits on issue 5**.
[DOC] `nextreg.txt` (3.02.04): "config mode only, bootrom disabled"; "bits 7:0 = 16K SRAM bank mapped to
0x0000-0x3FFF"; "Bit 7 ignored except on issue 5 pcb".

- `$04` takes a **16K SRAM bank of the whole physical space** (bank b = physical `b x $4000`), not a RAM bank
  number: `$04` = 4 maps the DivMMC ROM area at `$010000`, which is how the firmware loads it.
- On a KS3, **`$04` = `$80-$FF` maps physical `$200000-$3FFFFF`** into `$0000-$3FFF`, writable.
- It works only in **config mode** (NextReg `$03` machine type `111`), which is where the firmware runs, not
  ordinary programs.

### The zxnDDMA's physical addresses (core 3.03 on)

[DOC] The distribution's guide `docs/zxnDDMA/zxnddma.gde` ("Core 3.03.00, issues 2, 4 and 5"; sections 2.5
and 2.9) describes the DMA's new commands on **port `$6B` only**:

- `$D7 nn` / `$DB nn`: Port A / Port B address bits 23-16. `$DF mm`: mode flags, **bit 0 = physical**
  (bit 1 2D rectangles, bit 2 transparent, bit 3 fill, bit 4 Layer 2 X,Y with 3 more bytes, bit 5 hidden
  screen); each `$DF` sets every flag at once.
- The physical address is `{extended bits 5:0, start address 15:0}`, **22 bits**; bits 7-6 of the extended
  byte are dropped. Issue 5: `$000000-$3FFFFF`. Issue 4: `$000000-$1FFFFF`, **"bit 21 is dropped: higher
  addresses wrap"**. Issue 2: `$0FFFFF`, or `$1FFFFF` with the 2 MB expansion.
- **Physical mode bypasses the MMU and reads/writes SRAM only, never block RAM**: bank 5 and page `$0E` cannot
  be reached on screen this way (a physical write to `$054000` does not change the ULA screen). The guide says
  "banks 5 and 7", but [VHDL] only page `$0E`, the first half of bank 7, is block RAM (`mem_active_bank7` is
  page `$0E`); page `$0F` (`$05E000`) is ordinary SRAM, and a physical write there shows through the MMU.
- In physical mode an address carries from bit 15 into the extended byte at `$FFFF` (and borrows at `$0000`),
  so one transfer can cross a 64K boundary.
- Physical mode stays on until the next `$DF` or `$C3`; send `$DF $00` (or `$C3`) before an ordinary transfer.
- On port `$0B`, and on cores without the zxnDDMA, these command bytes are ignored **but their data bytes are
  taken as ordinary register writes**; the guide's `zxnddma_compare.asm` shows a safe detection sequence.

[VHDL] Why bit 21 wraps on a KS2: `o_RAM_A_ADDR_21 <= sram_addr(21)` exists only in the issue 5 generate
block; issues 2-4 tie it to `'0'` (`zxnext.vhd` ~1763-1777).

**Consequence:** a program written for the KS3's upper 2 MB that runs on a KS2 silently overwrites
`$000000-$1FFFFF` instead, starting with the ROM area and DivMMC RAM. Check NextReg `$0F` first.

[INFERRED] So the extra 2 MB is useful as DMA-reachable storage (graphics, samples, data copied into
MMU-visible RAM when needed); the CPU cannot execute or read it directly outside config mode.

### Other issue 5 differences [VHDL]

Everything else that reads `g_board_issue` in `zxnext.vhd` (3.02.04): the +3 FDC signals reach the
expansion bus only on issue 5 (`$81` bit 3, ~1818-1834); the core ID rule of `$10` and the expansion-bus
peripherals are the same as issue 4. The issue 5 top file adds an 8-bit-per-channel VGA DAC, a delayed
28 MHz clock and a VGA test pattern; none of that is visible to a program.

## The 28 MHz wait state

### Core 3.02.x: one wait on every read at 28 MHz [VHDL]

`zxnext.vhd` ~3466-3475:

```vhdl
if (sram_req_t = '1' or cpu_bank5_sched = '1') and cpu_rd_n = '0' and cpu_speed = "11" then
   sram_wait_n <= '0';
```

- At **28 MHz only** (`cpu_speed = "11"`; NextReg `$07` = 3), every CPU **read** (operand, data and opcode
  fetch alike) from **SRAM or from bank 5's block RAM** gets **one wait state**.
- **Writes** never wait (`cpu_rd_n = '1'`). Reads from **page `$0E`**, the first half of bank 7, do not wait (block RAM with no scheduling wait).
- There is **no board check**: the same on issues 2, 4 and 5.
- `z80_wait_n` collects it with the ULA, ULA+ and expansion-bus waits (~2127), and the DMA waits on
  `dma_wait_n <= z80_wait_n and spi_wait_n` (~2131), so **DMA reads wait too**.
- Contention is off above 3.5 MHz, so at 28 MHz this wait is the only extra delay.

[MEASURED-EMU] With code in page `$0E` and data elsewhere, at 28 MHz: `LD A,(nn)` takes 13 T-states with page `$0E`
data and **14** with SRAM or bank 5 data; `LD (nn),A` 13 everywhere; a `NOP` fetched from SRAM **5** instead
of 4; `LD A,(nn)` with opcode, operands and data all in SRAM **17** (four reads, four waits). A continuous
SRAM-to-SRAM DMA byte takes **7** CPU clocks at the default cycle lengths, instead of 6.

### Core 3.03: zero wait states at 28 MHz, on every board [DOC]

- Release page (specnext.com/latestdistro, System/Next 26.11a): "Core version: 3.03.03 (Issues 2,4,5)
  featuring **Zero Wait State 28MHz** and zxnDimensionalDMA (zxnDDMA aka Blitter)".
- The distribution's `CHANGELOG`: "Core 3.03.00 (28MHz 0 WS - zxnDDMA)".

So the change is **not KS3-only**: the KS1, KS2 and KS3 builds of 3.03 all have it.

**[MEASURED-HW] Hardware timings confirm it for CPU opcode fetches, CPU data reads and DMA reads.** The
zxnDDMA guide's example `zxnddma_compare.asm` draws 32 balls of 16 x 16 bytes five ways and times each in
video lines (64 us); its header gives the times "measured on an issue 5 (3.02.21, 28MHz)", where 3.02.21 is
the zxnDDMA development core that became 3.03. Run unchanged in the Klive emulator, a zero-wait model
reproduces every printed time and a one-wait model misses each by 1.1-3.3 ms:

| Way | Issue 5 | Zero-wait model | One-wait model |
|---|---|---|---|
| CPU, one `LDIR` per column | 7.2 ms | 7.2 | 8.3 |
| CPU, byte by byte (mostly data reads) | 15.6 ms | 15.6 | 18.9 |
| zxnDMA, one transfer per column | 8.2 ms | 8.2 | 9.7 |
| zxnDDMA, opaque / transparent | 2.1 / 2.1 ms | 2.1 / 2.1 | (no zxnDDMA) |

So the measurements above become 13, 13, 4 and 13 T-states on 3.03, and a DMA byte 6 clocks.
[INFERRED] Not covered: reads from bank 5 and page `$0E` (the program runs from and draws to SRAM), and
issues 2 and 4 (the release page states them).

[INFERRED] A hint, nothing more: the KS3's SRAM is a 10 ns part. Faster SRAM would explain removing the wait
there, but the release page states it for issues 2 and 4 as well.

**For software:** code tuned for 3.02's 28 MHz timing runs faster on 3.03; a delay loop calibrated at 28 MHz on
3.02 is shorter on 3.03. Read NextRegs `$01`/`$0E` if exact timing matters.

## The zxnDDMA in more detail (core 3.03 on, every board) [DOC]

From `docs/zxnDDMA/zxnddma.gde` (Part 2, "Reference"). The guide calls it "the zxnDMA with the extra commands
of DMA+"; every 3.03 build has it (issue 2: Spartan-6 SLX16; issue 4: Artix A7-15T; issue 5: Artix A7-35T).
Its VHDL is named as `cores/zxnext/src/device/new_dma.vhd`, not published yet. Everything the old zxnDMA did
still works the same way.

| Command (port `$6B`) | Follow bytes | Meaning |
|---|---|---|
| `$D7` | 1 | Port A address bits 23-16 |
| `$DB` | 1 | Port B address bits 23-16 |
| `$DF` | 1, or 4 with bit 4 | Mode flags (below) |
| `$E3` | 2 (lo, hi) | Row length: bytes in each row |
| `$E7` | 2 | Number of rows |
| `$EB` | 2 | Port A stride: start of one row to the start of the next |
| `$EF` | 2 | Port B stride |
| `$F3` | 1 | Transparent colour |
| `$F7` | 1 | Fill value |
| `$FB` | - | Commented out in `new_dma.vhd`; ignored (an earlier version copied the hidden Layer 2 screen to the shown one) |

`$DF` flags: bit 0 physical (22-bit SRAM addresses, no MMU); bit 1 2D; bit 2 transparent (a source byte equal to
the `$F3` colour is not written, both addresses still move on); bit 3 fill (no read at all, every byte gets the
`$F7` value; "twice as fast as a fixed source address"); bit 4 Layer 2 X,Y (`X_lo X_hi Y` follow; needs bit 0);
bit 5 hidden screen (with bit 4, the bank in NextReg `$13` instead of `$12`); bits 7-6 write 0. **Each `$DF`
sets every flag**, so send the whole set.

- **Rectangles:** in 2D mode the block length (WR0) is not used; the DMA moves row length x number of rows
  bytes. A stride is added to the row's 24-bit start, so physical-mode rows can cross 64K. A row length or
  number of rows of 0 still moves one byte.
- **Layer 2 X,Y** writes the Port B start address (WR4) and the `$DB` byte from NextReg `$12`/`$13` (the bank)
  and NextReg `$70` bits 5-4 (the mode), with base = `$40000 + bank x $4000`: mode `00` (256x192) base + Y x
  256 + X (X_hi read and ignored); modes `01` (320x256), `10` (640x256, X a byte column 0-319) and `11` base +
  X x 256 + Y, with a 9-bit X (bit 0 of X_hi). Port B's stride becomes 256 and stays so until `$EF` or `$C3`.
  Send this `$DF` **after** WR4, or use a WR4 without address bytes (`$A1`, `$C1`): a WR4 with a Port B address
  overwrites the worked-out one.
- **`$C3` (reset) clears all of it:** the flags, `$D7`/`$DB`, row length, rows, strides, the transparent colour
  and the fill value (and as before: timings back to 3 cycles, prescaler 0, auto restart off). It does not
  change the start addresses, direction, port types, address modes, transfer mode, block length or read mask.
- **`$CF` (load)** also copies the `$D7`/`$DB` bytes to the working addresses.
- **Block length** on `$6B`: N moves N bytes; on `$0B` (Z80 DMA mode) N + 1; `$0000` moves 1 byte on both.
- **Hardware IM2 can hold the DMA back:** with hardware IM2 on (NextReg `$C0` bit 0) and an interrupt source
  chosen in NextRegs `$CC-$CE`, the DMA waits while that interrupt is pending; under `DI` it is never taken, so
  a transfer started then never runs ("seen on an issue 5, 2026-10-21").
- **WR4 bit 4 with bits 3-2 = 00** (`$91`, `$B1`, `$D1`) hangs the register decoder until the next reset.
- **A short reload for many copies of one shape** (checked on an issue 5): `$1D lo hi` (WR0, Port A address
  only), then `$DF flags xlo xhi y` for a Layer 2 destination or `$AD lo hi` otherwise, then `$CF $87`; add
  `$D7 hi` when the source moves to another 64K.
- **Detecting the zxnDDMA safely** (`zxnddma_compare.asm`): send the zxnDDMA bytes straight after `$C3`, keep
  every data byte below `$80`, follow with eight `$83`, then copy one byte whose two possible destinations
  (the 16-bit one a plain DMA uses, the physical one the zxnDDMA uses) are both harmless, and see which changed.
- The guide's own measurement, issue 5 at 28 MHz, 16x16 sprites: CPU `LDIR` 7.2 ms, plain zxnDMA per column
  8.2 ms, zxnDDMA 2.1 ms opaque or transparent.

## Core 3.03.03 and the 26.11a release: the other changes [DOC]

From the release page (specnext.com/latestdistro, "System/Next 26.11a") unless marked:

- **Core 3.03.03** for issues 2, 4 and 5: zero wait states at 28 MHz, the zxnDDMA, and it "fixes dropped audio
  frames on HDMI" (the distribution's commit `cb4c0bd`: "Fixes audio glitches on some HDMI monitors").
- **From core 3.03.00 the KS1 (issue 2) cores are split in two, an HDMI part and a VGA part** (the README lists
  "3.03.03, 3.03.03 vga, 3.03.03 hdmi" for issue 2). A KS1 must update its core before the distribution, or the
  firmware looks for a test card core that is not there and the machine only appears bricked.
- **Firmware 1.46** (`TBBLUE.FW`), NextZXOS 2.10a, a `.ZED` dot command, a new boot INFO screen (card readers and
  partitions, ESP, RTC, Pi0, core and NextZXOS versions), 60 Hz per personality (the Microdigital TK models
  start in 60 Hz), more personalities (Arabic, French and Spanish +2, Swedish, +2A/+3 v4 and +2B/+3B v4.1,
  Microdigital TK90X and TK95), a new Sinclair QL core for issues 2, 4 and 5, and AlpineNext for the Pi0
  accelerators.
- A configuration change sets the monitor to "Test Card Mode" (`timing=8` in `config.ini`) after the update.

### KS3-specific items

- **The KS3 has two SD card readers, an internal one and an external one.** Its update needs a new
  `install.bas` and `updater.bas` (downloaded separately) on a fresh card **without** a `TBBLUE.FW` on it;
  `install.bas` installs an updater that "allows updates for both your internal and external card". A KS3
  with its internal card removed updates like a KS2.
- **The factory board test has a KS3 build:** `extras/nextest/NEXTEST-KS3.nex` beside `NEXTEST.NEX`
  (26 MB each), with `NEXTEST-V2.0A-USER-GUIDE.txt`.

## NextZXOS 2.10a: what changed in the ROMs [ROM]

**[ROM]** = read in the ROM bytes of the 26.11a distribution (`machines/next/`, commit `3a892b03`), compared
with the earlier NextZXOS 2.10 (`KS3` branch, commit `b7cc7d34`). Both call themselves 2.10 in some places,
but **every one of the five ROM files differs**; all changes are in place (no file grew or shrank).

- **The version word is `$A210`** (it was `$E210` in 2.10 and `$0208` in 2.08): ROM 0 at `$0006`, the DivMMC
  ROM's mark (`'D','V',$10,$A2` at `$0004`), the alternate ROM's version routine (returns DE = `$A210`), ROM 2's
  check of the loaded system files ("Version mismatch: a210 enNextZX.rom"), and the Multiface ROM's checks.
  **A program or tool that recognises NextZXOS by that word must accept `$A210`.**
- The texts say **2.10a**: the copyright line ends "Garry Lancaster 2.10a"; the Multiface menu shows "OS 2.10a".
- **`BEEP` and the editor click use the 48K ROM's tone routine again.** In 2.10, ROM 3's `BEEPER` (`$03B5`)
  paged in the alternate ROM at `$03C1` (`NEXTREG $8C,$80`) and the tone ran there (alternate ROM page 1,
  `$03C5-$0425`), which could drop the CPU to 3.5 MHz for the tone. In 2.10a `$03C1` is the 48K ROM's own
  `LD IX,$03D1` again, and that alternate ROM code is gone (zeros).
- **`PLAY` no longer changes the CPU speed.** In 2.10 it saved NextReg `$07` at `$5CA5` and could switch to
  3.5 MHz while playing (bit 3 of a setting read from DivMMC memory `$2993`), restoring the speed at the end
  and on every error. In 2.10a that code is gone (the routine moved up 25 bytes); each PLAY error now silences
  the AY chips, enables interrupts and calls ROM 1's `ERROR_128_A` itself.
- [INFERRED] So under 2.10a, `BEEP` and `PLAY` run at whatever CPU speed is set, and the 48K tone loop's pitch
  depends on that speed unless something else lowers it. Not checked on hardware.
- Unchanged: the key-wait loop (`$0C98-$0CBE`, `HALT` at `$0CB5` in ROM 0) and ROM 3's tape routines
  (`LD-BYTES` and `SA-BYTES` are the 48K ROM's, byte for byte).

## Open questions

- Whether reads from bank 5 and page `$0E` also lost the 28 MHz wait on 3.03 (CPU fetches, CPU data reads
  and DMA reads from SRAM did, as measured above).
- Whether 3.03 changed the MMU or NextReg `$04` limits; the zxnDDMA guide mentions neither, so 3.02.04's
  rules (pages 0-223, `$04` config mode only) are assumed to hold.
- What the DMA's byte counter reads back in 2D mode. ([MEASURED-HW] Settled: a transparent byte still takes
  its write cycle. The ball has 84 transparent bytes of 256; skipping their write cycles would have made the
  transparent way 4-5 video lines faster than the opaque one, and on the hardware both took 2.1 ms.)
- Which chip select is the KS3's internal SD reader: the issue 5 board wires `sd_cs0_n` and `sd_cs1_n` to FPGA
  pins N1 and K2, and which socket each reaches needs the KS3 schematic.
- Whether NextReg `$12`/`$13` (the Layer 2 bank the X,Y mode uses) gained a bit on the KS3.
- Whether 2.10a's `BEEP` and `PLAY` sound right at 28 MHz, now that they no longer manage the CPU speed.

## How Klive models this (only for work in the Klive repository)

Models `ks2-30303` and `ks3-30303` (`src/emu/machines/zxNext/nextProfiles.ts`); the plan and its decisions
are `dev/plans/ZXNEXT_3_03_PLAN.md`; the board delta is `dev/ai/zxnext-cores/ks2-to-ks3.md`. The C core
keeps the KS3's upper 2 MB after its 8K error page (offset = physical + `$2000`, `zxnextSramOffset`), the
zxnDDMA is in `zxnext-dma.c`, and the 28 MHz wait is guarded by `ZXNEXT_CORE_VERSION < 30300` in
`zxnext-cpu.c` and `zxnext-dma.c`. Everything that rests on documents is marked `VHDL-PENDING(3.03.03)`.
The IDE shows the upper 2 MB as partitions `U00`-`UFF` (256-511) on the KS3 model, and the KS3 model has a
second SD card (card 1, `MEDIA_SD_CARD_2`, an empty slot until an image is chosen); the follow-up plan is
`dev/plans/ZXNEXT_KS3_FOLLOWUP_PLAN.md`.
