# ZX Spectrum Next: KS2 and KS3 differences

Collected 2026-11-09, primarily for NextRegs. Every statement is tagged with how far it was checked:

- **[VHDL]** read in the upstream core source
- **[doc]** stated by upstream `nextreg.txt`, `changelog.md` or the distribution's README
- **[bin]** read from the distribution's `TBBLUE.TBU` catalogue
- **[claim]** stated on the release page or a third-party site, not checked against anything else
- **[unknown]** no public source found

## 1. Summary

1. **The same core differs between the two boards in only three NextRegs**: `$0F`, `$04` bit 7 and the
   effect of `$81` bit 3. There are no new register numbers. [VHDL, core 3.02.05]
2. **The other register changes people associate with KS3 are core-version changes**, and they apply to
   KS2 too (`$0A` bits 5 and 2, `$A0` bit 1). Klive's `ks2-30204` model already has them.
3. **The latest distribution's core is not documented anywhere public.** System/Next 26.11a ships core
   **3.03.03** for issues 2, 4 and 5, but the public FPGA repository stops at **3.02.05** and its
   `nextreg.txt` has nothing for 3.03. The release page names a zero-wait-state 28 MHz mode and a
   "zxnDimensionalDMA" blitter. **Any NextRegs or ports they add are not known**, so section 3 cannot be
   assumed complete for 3.03.

## 2. Names and releases

KS2 is PCB **issue 4** (`$0F` = 2). KS3 is PCB **issue 5** (`$0F` = 3). The distribution's Git branches
named `KS2` and `KS3` are *releases*, not boards: the `KS3` branch also ships cores for KS2 boards.

| Distribution (`gitlab.com/thesmog358/tbblue`) | Date | NextZXOS | Firmware | Issue 4 (KS2) core | Issue 5 (KS3) core |
|---|---|---|---|---|---|
| Branch `KS2` (System/Next 23.06), `9a3c3c7` | 2023-06 | 2.08 | 1.44 | 3.02.00 | none |
| Branch `KS3`, `b7cc7d3` ("TBBLUE final for testing") | 2026-05-28 | 2.10 | 1.45 | 3.02.04 and 3.02.00 | 3.02.04 |
| `master` (System/Next 26.11a), `3a892b0` | 2026-11-08 | 2.10a | 1.46 | **3.03.03** | **3.03.03** |

Versions are from each branch's README [doc]. The core versions were confirmed in each `TBBLUE.TBU`
catalogue [bin]. The header is 0x200 bytes: the magic `TBUFILE\0`, the name, then 15-byte records holding
a tag byte, a type byte, a board or variant byte, the version (`$33 $03` = 3.03.03), a 32-bit offset and
length in 512-byte sectors, and a CRC. The offsets and lengths add up exactly to the file size. The
format was worked out from the bytes; there is no specification. The board bytes 02 and 03 match the
`$0F` values.

`master`'s catalogue:

| Board/variant byte | Core | Sectors | Note |
|---|---|---|---|
| `02` | 3.03.03 | `$10C0` | issue 4 |
| `03` | 3.03.03 | `$10C0` | issue 5, a separate bitstream of the same size |
| `00`, `10`, `20` | 3.03.03 | `$3C0` each | issue 2 builds (`00` and `20` share an image); which is HDMI or VGA was not established |
| `40`, `41` | 3.02.04 | `$38D` | shared image; purpose unconfirmed (commit `e368ec7` mentions a TestCard core for KS1-class machines) |

Upstream's public branches: `30204` (`dc8d764`, 2026-05-28) and `30205` (`15e206d`, 2026-09-25) are the
newest. There is no 3.03 branch.

## 3. NextReg differences between the boards

Compared on core 3.02.05, `cores/zxnext/src/`. Both top files set `g_version`, `g_sub_version`,
`g_video_inc = "11"` and `g_option = X"FFF2"` identically; only `g_board_issue` differs (`X"2"` and
`X"3"`, `zxnext_top_issue{4,5}.vhd` ~39). Every use of `g_board_issue` was reviewed: outside the top
files, which only pass it on, it appears only in `zxnext.vhd`.

| Reg | KS2 (issue 4) | KS3 (issue 5) | Evidence |
|---|---|---|---|
| `$0F` Board ID (R) | reads `$02` | reads `$03` | `zxnext.vhd` ~6509, `nextreg.txt` |
| `$04` Config Mapping (W, config mode) | bit 7 ignored: bank = `'0' & bits 6:0` | all eight bits used: bit 7 drives SRAM A21 | `zxnext.vhd` ~6272-6298 |
| `$81` bit 3, +3 FDC signals | stored and read back; **no pin effect** | stored and read back; **enables the FDC signals on the expansion bus** | `zxnext.vhd` ~1818-1837 |

Table values for `$0F` per `nextreg.txt`:

| `$0F` | Board | FPGA | Flash | Core slot |
|---|---|---|---|---|
| `0010` | Issue 4 | XC7A15T-1CSG324 | 256 Mbit MX25L25645G, 32-bit SPI | 64K x 34 |
| `0011` | Issue 5 | XC7A35T-2CSG324 | 256 Mbit MX25L25645G, 32-bit SPI | 64K x 34 |

Notes:

- **`$04` bit 7 does not extend the MMU.** A21 is reachable only through this register in config
  mode, in the bottom 16K, when that slot's MMU page is `$E0` or higher (`zxnext.vhd` ~3353-3366). MMU translation
  (~3354, ~3376), Layer 2 (~3417) and SRAM ports B and C (`'0' &` in the top file) all force A21 to 0.
  **The MMU-visible space on KS3 is the same 2 MB as on KS2**; the extra 2 MB is reached as described
  in "Addressing the extra 2 MB" below.
- **`$81` bit 3** with bit 3 of port `$1FFD`: the motor line comes from port `$1FFD` bit 3 and is latched
  on all boards, but only issue 5 connects it, plus DRD and DWR, to pins.

### Addressing the extra 2 MB

Worked out from `zxnext.vhd` at 3.02.05 [VHDL]. **Not run on a real KS3**, and 3.03.x may differ.

The extra 2 MB has no MMU page numbers. It is reached as 16K banks through `$04`, mapped at
`$0000-$3FFF`. The `$04` value is the physical SRAM bank (A21..A14), and the CPU's A13 selects the 8K half.

| `$04` value | Physical SRAM | Note |
|---|---|---|
| 0-127 | `$000000-$1FFFFF` | the normal 2 MB, including the ROM area |
| 128-255 | `$200000-$3FFFFF` | the extra 2 MB, issue 5 only |

The mapping applies per 8K half of `$0000-$3FFF` when all of these hold (~3345-3366, ~3400-3423):

- the slot's MMU page (MMU0 or MMU1) is `$E0` or higher; `$FF`, the ROM default, qualifies
- config mode is on
- the Multiface is not paged in
- DivMMC is not paged in, and Layer 2 is not mapped over that area; both take priority

A running program can enter config mode, although `nextreg.txt` does not describe this. Inside the `$03`
write (~5708-5712), bits 2:0 = `111` set config mode with no check on the current state, and any value
other than `000` or `111` clears it. `001`-`100` also set the machine type while in config mode, so
`101` or `110` is the way out that leaves the machine type unchanged.

```z80
    ; run this from $4000 or above
    di
    nextreg $50,$ff
    nextreg $51,$ff
    nextreg $03,%00000111   ; enter config mode
    nextreg $04,128         ; $200000-$203FFF appears at $0000-$3FFF
    ; ... read or write it here ...
    nextreg $03,%00000101   ; leave config mode, machine type unchanged
    ; restore MMU0 and MMU1
    ei
```

Hazards:

- Check that `$0F` reads 3 first. On issue 4, bit 7 is dropped (~6280), so bank 128 is really bank 0 and
  a write lands in the ROM area.
- Keep interrupts off: the normal ROM at `$0038` is not there while the bank is mapped.
- The NMI logic is held idle during config mode (~2411, ~2465).
- Any write to `$03` clears `bootrom_en` (~5683), which is harmless after boot. A reset while config mode
  is on sets it again (~5670), so keep the window short.
- The bank cannot hold Layer 2 screens or be paged in as normal memory. It only works as storage to copy
  to and from.

### Identical on both boards (often thought to differ)

| Reg | Behaviour on issues 4 and 5 | Evidence |
|---|---|---|
| `$10` Core Boot | same core-id rule: bit 4 must be 0 and the low nibble must not be `1111` | `zxnext.vhd` ~6254-6268 |
| `$F0`, `$F8`-`$FA` XDEV, XADC | present on both; the text changed from "Issue 4 only" to "Issues 4 and 5" | `zxnext.vhd` ~8144, `nextreg.txt` |
| `$11` video timing | same (`g_video_inc = "11"`) | top files |
| Palette registers (`$40`, `$41`, `$44`) | same 9-bit colour; see the VGA row in section 5 | top files |

## 4. NextReg changes by core version (both boards)

These come from the core version. A KS2 running the same core has them.

| Reg | Change | Since | Evidence |
|---|---|---|---|
| `$0A` bit 5 | swap SD0 and SD1 (hard reset 0, config mode only, affects later port `$E7` writes) | 3.02.03 | `changelog.md`, `zxnext.vhd` ~3629-3631 |
| `$0A` bit 2 | write-enable lock for bit 5, added in 3.02.04 because older firmware changed the swap by accident (commit `6395c28`) | 3.02.04 | `nextreg.txt` |
| `$81` bit 3 | new; effect by board in section 3 | 3.02.03 | `changelog.md` |
| `$A0` bit 1 | Pi SPI slave enable; hard reset only, overrides bit 0 (master) | 3.02.04 | `nextreg.txt` |
| `$04` text | bit 7 documented, "ignored except on issue 5" | 3.02.03 or 3.02.04 | `nextreg.txt` |
| `$01`, `$0E` | report the core version | every core | top files |

- 3.02.04 to 3.02.05: `nextreg.txt` changed in indentation only. The only code change is that the
  anti-brick build leaves out the DMA, DivMMC and Multiface (`g_machine_id = X"FA"`). [VHDL]
- The full 3.02.01 to 3.02.04 classification, including CTC, sprites and EAR, is in
  `dev/ai/zxnext-cores/30201-to-30204.md`. Klive already implements that delta.

### Core 3.03.x: what is and is not known

| Item | Status |
|---|---|
| Core 3.03.03 for issues 2, 4 and 5 | [bin], [doc] |
| 3.03.03 fixes audio glitches on some HDMI monitors | [doc] commit `cb4c0bd` message |
| Zero-wait-state 28 MHz mode | [claim] specnext.com release page |
| zxnDimensionalDMA ("zxnDDMA", blitter) | [claim] specnext.com release page |
| NextReg numbers or bits, DMA programming model, port changes, timing | **[unknown]** |
| Whether 3.03 adds any board-specific behaviour on issue 5 | **[unknown]** |

Bitstreams cannot practically be read for this. The answer needs one of: upstream publishing the
`30303`-era sources and `nextreg.txt`, or probing a real machine (section 7).

## 5. Other hardware differences

From `zxnext_top_issue4.vhd` against `zxnext_top_issue5.vhd` and the pin files [VHDL]. The top-file diff
was read in full.

| Area | KS2 (issue 4) | KS3 (issue 5) | Visible to software? |
|---|---|---|---|
| FPGA | XC7A15T-1 | XC7A35T-2 (faster speed grade) | `$0F` only |
| SRAM | IS61WV102416, 1M x 16 = 2 MB | IS61WV204816, 2M x 16 = 4 MB | config mode only, via `$04` bit 7 |
| VGA/RGB output | 3 bits per channel straight to pins | 8-bit-per-channel path: ADV7125 DAC, double data rate over 4 pins per colour, with a 74ALVC574 latching the low nibble | No: see below |
| Expansion bus | no +3 FDC lines | new `P3_MTR_n`, `P3_DRD_n`, `P3_DWR_n` | via `$81` bit 3 and port `$1FFD` |
| Clocks | - | extra 28 MHz output delayed 3 ns (`CLK_28_PH`, to meet ADV7125 hold time) | No |
| VGA test pattern | no | XYZ on an MD pad, on either joystick port (`g_test_pattern = 1`) | Display only |
| Pins | - | moved: PS/2, SRAM address lines, RGB | No |

**VGA colours:** the board can output 8 bits per channel, but the core still expands its 9-bit colour by
repeating bits (`R2R1R0 R2R1R0 R2R1`, `zxnext_top_issue5.vhd`). So, as of 3.02.05, KS3 shows **no new
colours** and the palette registers are unchanged. Reports of "more colours" describe what the board
could do. [claim for those reports]

**SD cards:** the distribution's update steps describe internal and external cards on KS3. `$0A` bits 5
and 2 and boot from an external card (3.02.04) are core features present on KS2 as well, so they are not a
board difference at register level. The 2026-05-21 commit `bfc06d0` moved the KS2 SD lines to LVCMOS33 "as
on KS3".

**Ports:** there are no new port numbers between the boards. Upstream's `ports.txt` still describes port
`$1FFD` bit 3 (motor) as not implemented and does not mention the `$E7` swap, although the VHDL does both.

## 6. Sources that look useful but are not

| Source | Problem |
|---|---|
| `docs/extra-hw/io-port-system/registers.txt` in the distribution | last changed 2024-02-09 (identical in the `KS3` branch and `master`); no issue 5 entry |
| `wiki.specnext.dev/Board_ID_Register` | lists issues 2, 3 and 4 only |
| `docs/nextzxos-changelog.txt` | newest entry is v2.10; nothing on 3.03 |
| `docs/schematics/` in the distribution | KS1 and KS2 only, no KS3 schematic |

## 7. What this means for Klive

- Klive's cores and sets cover `ks2-30201` and `ks2-30204`. `NextBoard` already allows `"ks3"`.
- A KS3 model on 3.02.04 or 3.02.05 would be small at register level:
  - build with `ZXNEXT_BOARD_ISSUE` = 3 so that `$0F` reads 3
  - add `3: "ZXN Issue 5, XC7A35T-2CSG324, ..."` to the `$0F` value set: `nextRegDescriptors.ts` stops at
    2, and `nextRegSets/30204.ts` skipped the board notes
  - describe `$04` bit 7 and the board-specific effect of `$81` bit 3
  - give the model 4 MB of SRAM and honour `$04` bit 7, for programs that use the route in "Addressing
    the extra 2 MB"; whether Klive's `$03` handling accepts `111` from a running program was not checked
  - the FDC pins have no emulated peer, so nothing is needed for them
- **A model matching the current distribution needs 3.03**, and that is blocked on sources: the project's
  reference for a Next model is the VHDL of its core version, and 3.03's is not public.
- Once a KS3 is available, the "board identity" `.nex` planned in
  `dev/plans/ZX_NEXT_FIDELITY_PROOF_PLAN.md` (item 8) can settle the registers: record `$01`, `$0E`, `$0F`
  and sweep each NextReg for read-back and reset value under 3.03.03, then diff against the same sweep
  on 3.02.05. That finds new registers, but not what they do.

## 8. Sources

- FPGA: `https://gitlab.com/SpectrumNext/ZX_Spectrum_Next_FPGA`, `cores/zxnext/`: branch `30205` (`15e206d`),
  branch `30204` (`dc8d764`), 3.02.01 (`5ad7546d`). Files: `nextreg.txt`, `ports.txt`, `changelog.md`,
  `src/zxnext.vhd`, `src/zxnext_top_issue{4,5}.vhd`, `src/zxnext_pins_issue{4,5}.xdc`. Line numbers are 3.02.05.
- Distribution: `https://gitlab.com/thesmog358/tbblue`, branches `KS2`, `KS3`, `master` (`README.md`, `TBBLUE.TBU`).
- Release page: <https://www.specnext.com/latestdistro/> (System/Next 26.11a).
- Secondary: <https://ultimatemister.com/zx-next-2026-update/>, <https://retrocombs.com/zx-spectrum-next-quick-start>
  (lists KS3 RAM as 2 MB standard, which matches the CPU-visible space), <https://wiki.specnext.dev/Board_ID_Register>.
- In this repository: `dev/ai/zxnext-cores/30201-to-30204.md`, `dev/ai/zxnext-models.md`.
