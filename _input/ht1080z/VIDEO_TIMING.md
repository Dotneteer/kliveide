# HT-1080Z: how a frame is drawn, against the CPU clock

Research note, 2026-10-22. It combines:
- [GENIE]: the EACA Genie technical manual §1.4, printed pp. 8–15 (`docs/EACA_Genie_manual_1982.pdf`, PDF pp. 10–17). This is the theory of operation, with timing figures 1.5–1.10.
- [E1]: the HT-1080Z/64 video board ("E panel") schematic, sheet 1 (`docs/ht1080z64_schematic_ht_panel_e_64k_kapcsolas1.pdf`, Y04-6000-00-1E), traced from 600-dpi renders.
- [F]: the CPU board ("F panel") schematic (`docs/ht1080z64_schematic_ht_panel_f_64k_kapcsolas.pdf`).

Anything concluded rather than read is marked *inference*.

## 1. The one fact everything follows from

**One CPU T-state is exactly one character cell (6 dots) of the raster.** The Z80 clock and the
video character clock are both the master crystal ÷ 6:
- **Genie:** the CPU uses the video chain's own ÷6 counter, Z36 [GENIE §1.1.1, Fig. 1.5].
- **/64:** two separate ÷6 counters run from the same crystal: IC31 74LS92 on the E panel for video, and IC38 74LS92 on the F panel for the Z80 Φ ([E1], [F]; see HARDWARE.md §2). Their phase is fixed but unknown, and differs by at most 5 dots. That doesn't matter at character resolution.

There are **no wait states and no interrupts**, and the CPU cannot read any video status. Software
cannot synchronise to the beam, so the raster runs freely under the program.

## 2. The counter chain

| Stage | Genie | /64 E panel | Divides | Gives |
|---|---|---|---|---|
| Dot clock | crystal | Q1 + IC26 | — | 10.644 MHz (Genie), 10.6645 MHz (/64) |
| Dot → character | Z36 ÷6 | IC31 74LS92 | 6 | character clock = CPU clock; dot position 0–5 inside the cell |
| Horizontal address A0 | Z36 ÷2 | IC31 | 2 | A0 |
| Horizontal A1–A2 | Z35 ÷4 | IC30 74LS93 | 4 | A1, A2 |
| Horizontal A3–A5 + H | Z34 ÷14 | IC29 74LS93, reset by IC18 at Q3·Q2·Q1 = **14** | 14 | A3–A5. Q3 (Z34-11) is the horizontal-blank / H-sync source |
| Scan line in row | Z33 ÷12 | IC28 74LS93, reset by IC18 at Q3·Q2 = **12** | 12 | L0–L3 (chargen row, graphics band) |
| Row A6 | Z35 ÷2 | IC30, other half (*inference*: same split as the Genie's Z35) | 2 | A6 |
| Row A7–A9 + V | Z32 ÷13 / ÷11 | IC27 74LS93, reset by IC18 at Q3·Q2·Q0 = **13** ("625" jumper) or Q3·Q1·Q0 = **11** ("525") | 13 / 11 | A7–A9. Q3 (Z32-11) is the vertical-blank / V-sync source |

The /64 board copies the Genie chain chip for chip (one 74LS92 and four 74LS93s), and its reset
decodes for ÷14, ÷12 and ÷13/÷11 are visible on [E1]. The Genie's address-pin table [GENIE
§1.4.2.1, p.11] gives the bit mapping: A0 = Z36-8; A1, A2 = Z35-9, -8; A3–A5 = Z34-12, -9, -8; A6–A9
= Z32-14, -12, -9, -8.

## 3. One line: 112 T-states

The horizontal counter runs **0–111** (2 × 4 × 14). A0–A5 form the column. Z34's Q3 is low for
counts 0–63 and high for 64–111, so [GENIE Fig. 1.8(b)] shows the address running
**0…63, then 0…47 during blanking**.

| T in line (= H count) | What happens |
|---|---|
| 0–63 | VRAM column 0–63 is **read** (address phase) |
| 1–64 | The byte read at count *n* is latched into the data latch (Z26 / IC21) and the control latch (Z3 / IC3) at the rising edge of the strobe, one character later [GENIE Fig. 1.8(a)] |
| **2–65** | The shift register (Z24/Z4, IC19/IC4 74LS166) outputs the 6 dots of column *n* at count *n* + 2. **This is the visible window.** |
| 64–111 | Address counts 0–47 again, but horizontal blanking (Z34-11 high, through Z11) stops the shift registers loading [GENIE p.13]: "DISPLAY BLANKED" in Fig. 1.8(b) |
| ≈ 64 + VR1 delay | **H sync**: the rising edge of Z34-11 (count 64), delayed by the VR1/C17/4069 RC network (the picture-position trimmer), shaped into a ≈ **4 µs** pulse [GENIE §1.4.1, Fig. 1.6]. On the /64 this is the CD4069 + P1 network on sheet 2. |

Inside a character: Z36 counts dots 0–5. At count 5 the strobe goes low, which parallel-loads the
chargen or graphics bits into the 74LS166. When the strobe rises at dot 0, the next byte is
latched and the loaded dots shift out at the dot clock [GENIE §1.4.2.2, Fig. 1.8(a)]. The chargen
must settle within 450 ns, its access-time budget.

Timing:

| | Series I/II (10.644 MHz) | /64 (10.6645 MHz) |
|---|---|---|
| T-state = character | 563.7 ns | 562.6 ns |
| Line (112 T) | 63.13 µs (15.84 kHz) | 63.01 µs (15.87 kHz) |
| Visible part (64 T) | 36.08 µs | 36.01 µs |
| Blanked part (48 T) | 27.06 µs ("25 µs" in Fig. 1.6) | 27.01 µs |

## 4. One frame: 312 lines = 34,944 T-states

| Line in frame | Rows | What happens |
|---|---|---|
| 0–191 | text rows 0–15 (A6–A9), 12 scan lines each (L = 0–11) | Visible. Characters use chargen rows 0–8 (rows 9–11 come out blank from the Genie chargen; the HT chargen stores 12 rows per glyph). Graphics bands: L 0–3 use D0/D1, L 4–7 use D2/D3, L 8–11 use D4/D5 (Z27 / IC22 74LS153 selects by L3, L2) |
| 192–311 | row counts 16–25 (Z32 Q3 high) | **Vertical blanking**, 120 lines (≈ 7.6 ms; "7.7 ms" in Fig. 1.6). The counters keep running, but the shift registers are inhibited. |
| ≈ 192 + VR2 delay | — | **V sync**: the rising edge of Z32-11 (line 192), delayed by VR2/C16, shaped into a ≈ **100 µs** pulse (≈ 1.6 lines) [GENIE Fig. 1.6] |

So the frame is **112 × 312 = 34,944 T-states**: 50.77 Hz on Series I/II and 50.86 Hz on the /64.
The 60 Hz ("525") build is 112 × 264 = 29,568 T-states, with 72 blank lines.

The sync is **not interlaced**: every frame has the same 312 lines. The TV sees a 312-line,
progressive "PAL-ish" signal (*inference* from the counter structure; there is no half-line logic).

### Where the picture sits

The counters define a frame whose origin is the top-left visible character. The sync pulses are
then placed by analog delays (VR1/VR2, or P1/P2 on the /64), so **the border sizes are set
mechanically by trimmers, not digitally.** The adjustment procedure centres the picture [GENIE §3,
p.33]. An emulator should therefore pick its own border. A centred picture inside a nominal PAL
visible area has about 60 blank lines above and below, and about 24 character times (≈ 13.5 µs
of blanking) on each side, minus sync and porches (*inference*).

## 5. What a CPU access to video RAM does

- When the CPU addresses 3C00–3FFF, VID goes low. The address multiplexers (Z30/Z39/Z38; IC24,
  IC32–IC34 74LS157 on the /64) switch the 2114s to the CPU bus, and **VID clears the
  data/control latches** (Z3, Z26 via Z40-6) [GENIE §1.4.2.1, p.11].
- The CPU is **never delayed**. Instead, every character whose latch strobe falls while VID is
  low is latched as zero, so it shows **blank (black)** for those 6 dots: the "black dash"
  (HARDWARE.md §5.6).
- *Inference:* how long VID is active comes from Z80 MREQ timing. MREQ is low from about the
  middle of T1 to the middle of T3 on a read or write, so about **2 T-states, which is 2 character
  cells (≈ 12 dots)**. The dash lands at the **beam column of the access + 1** (the latched
  slot is shown one character later), on the scan line being drawn. It only appears inside the
  visible window (T 2–65 of lines 0–191). A `LDIR` into video RAM therefore leaves a trail of
  dashes, and a program that polls VRAM causes flicker.
- **Content timing:** the display reads VRAM column *n* at line T = *n*. A CPU write lands at its
  own T-state. If it lands after the beam has read that cell on this scan line, the change
  appears from the next scan line of the same character row. That can split a character
  horizontally ("tearing" within one 12-line row). An emulator that renders per scan line from
  VRAM sampled at T = *n* reproduces this exactly.

## 6. VIDEO CUT (32 columns) and PAGE

[GENIE §1.4.4.1]: with the VIDEO CUT switch closed, multiplexers Z29/Z37 (IC24/IC32 on the /64,
selected by S3) swap the counter inputs, and the reference counter is clocked at **CLOCK/2**
(on the /64 that is LK7 "CK/2" from IC31). Each character becomes 12 dots wide and 32 characters
fill the same 64-slot window. PAGE drives A5 (left or right half of each row).

*Inference:* the line and frame totals do not change, because the monitor still needs
15.84 kHz / 50 Hz. Only the column address advances every 2 T-states. CPU timing is unaffected.

## 7. Emulation recipe (summary)

```
T-states per line   = 112        lines per frame = 312 (50 Hz) / 264 (60 Hz build)
frame T-states      = 34,944     CPU Hz = crystal / 6 (1,777,417 /64; 1,774,000 Series I/II)
for each line y in 0..311, each slot x in 0..111 (one per CPU T-state):
  visible if y < 192 and 2 <= x <= 65
  column = x - 2, row = y / 12, scan = y % 12
  byte   = VRAM[row*64 + column], sampled at slot x - 2 (the read phase)
  if a CPU VRAM access (MREQ+VID) covered the latch strobe for that slot: byte = 0 (black dash)
  dots   = D7 ? graphics(byte, scan) : chargen[byte & 0x7F][scan]   // HT chargen layout, HARDWARE §5.3
  VIDEO CUT: column = (x-2)/2 + (PAGE ? 32 : 0), each dot doubled
H sync ≈ slot 64 + delay (≈4 µs), V sync ≈ line 192 + delay (100 µs): position the borders by choice
no INT, no wait states, no software-visible beam status
```

## 8. What is still inferred or unverified

| Item | Status |
|---|---|
| /64 IC30 split (÷4 horizontal + ÷2 row, like the Genie's Z35) | Chip type and position match. The two halves' wiring was not traced unambiguously in the scan. |
| VID length = 2 T-states, dash position = access column + 1 | From Z80 MREQ timing and the Genie latch description; not measured. |
| /64 chargen rows 9–11 | The HT chargen has 12 rows per glyph (HARDWARE.md §5.3), so the /64 may draw descenders there, unlike the Genie's blank rows 9–11. Depends on the ROM content, not the timing. |
| Exact delays of the sync pulses after count 64 / line 192 | Analog, set by trimmers. Only the order of magnitude is known. |
| VIDEO CUT counter swap | Described in prose only [GENIE]. Not traced on [E1]. |
