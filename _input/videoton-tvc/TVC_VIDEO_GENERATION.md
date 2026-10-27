# How the Videoton TV Computer makes its picture

The TVC has no text mode. Its BASIC prints letters by drawing them into a bitmap, and its screen
memory stores every scan line as 64 consecutive bytes, so the address sum is simple. Yet the chip
that reads that memory is an MC6845-type CRT controller, a part designed for character terminals.
It knows nothing about bitmaps or colours. This article follows one byte of video memory from
the controller's address counters to the electron beam: how it gets fetched, shifted, coloured,
framed by the border, blanked and synchronised. It also covers why the result looks the way it
does.

**Why it matters.** An emulator that only gets the steady picture right still runs most software.
Raster effects (border stripes, mid-screen palette changes, split modes), the frame interrupt's
exact moment, and the cost of touching video memory all depend on the details below. Some of
those details aren't in the emulators, and a few contradict the manual's own diagrams.

**Audience.** You should know what a CRT raster is, what a Z80 T-state is, and roughly what a
6845 does. [TVC_HARDWARE_OVERVIEW.md](TVC_HARDWARE_OVERVIEW.md) is the short orientation to the
whole machine, and [TVC_CLOCK_STRETCH_FIGURES.md](TVC_CLOCK_STRETCH_FIGURES.md) gives the CPU-clock
stretch in full. This article links to both rather than repeating them.

## How this article is organised

- [Part 1: The signal chain at a glance](#part-1-the-signal-chain-at-a-glance): every block from
  the crystal to the TV socket, with one line on each.
- [Part 2: Clocks — one character, two T-states](#part-2-clocks--one-character-two-t-states).
- [Part 3: The CRT controller and the program it runs](#part-3-the-crt-controller-and-the-program-it-runs).
- [Part 4: From controller address to video RAM address](#part-4-from-controller-address-to-video-ram-address),
  including the free DRAM refresh and the 64K+ display banks.
- [Part 5: One RAM, two users](#part-5-one-ram-two-users): the time slots, the shared output latch,
  and why there is no "snow".
- [Part 6: From byte to pixels](#part-6-from-byte-to-pixels): the shift registers and the three
  colour modes. **If you read only one part, read this one.** It settles the bit-order conflict
  between the manual and the emulators.
- [Part 7: Colour](#part-7-colour): the palette, the border register, intensity, the PAL encoder.
- [Part 8: Paper, border and blanking](#part-8-paper-border-and-blanking).
- [Part 9: Sync](#part-9-sync).
- [Part 10: The frame interrupt](#part-10-the-frame-interrupt).
- [Part 11: What software can change mid-frame](#part-11-what-software-can-change-mid-frame).
- [Part 12: What the emulators model](#part-12-what-the-emulators-model).
- [Part 13: Open questions](#part-13-open-questions), then a [Summary](#summary).

> **Configuration.** All numbers are for the CRTC values the BASIC 1.2 ROM programs at reset
> (Part 3) and the standard clocks: 25 MHz crystal, 3.125 MHz CPU (320 ns T-state), 1.5625 MHz
> character clock (640 ns). Software can reprogram the CRTC. Where a number depends on that, the
> text says so.

### Sources and how they are cited

| Key | Source |
|---|---|
| [HW p.N] | `tvchardver.pdf`, the 1988 hardware manual (Benedek–Monok). **N is the page number printed on the page.** In this scan, the PDF page index is the printed number minus one: printed page 72 is PDF page 71. |
| [HW fig. N] | A figure from that manual's figure section at the back of the book (PDF pages 200–252). |
| [SCH-A sheet N] / [SCH-B sheet N] | `TVC_HBA_rajzok.pdf` (HBA / HBA-1 board, 32K and 64K) / `TVC_HBA2_rajzok.pdf` (HBA-2 board, 64K+). N is the sheet number in the title block. Chip positions are given as HBA (HBA-2), the manual's own convention [HW p.78]. |
| [ROM] | `rtvc/roms/TVC12_D4.64K.asm`, the annotated BASIC 1.2 system ROM listing. |
| [rtvc] | `rtvc/src/emulator/` (`vid.rs`, `tvc.rs`, `mmu.rs`), `rtvc/info/tvc.md`, `rtvc/coding/` and `rtvc/.agents/plans/` (MIT). |
| [MAME] | `mame/src/mame/videoton/tvc.cpp` (BSD-3-Clause). |
| [64K+] | `tvc64kplus_bw.pdf`, a Videoton leaflet on the 64K+. |

Statements marked *(interpretation)* are my reading of a source, not something it says
outright. Every number below that isn't printed in a source was recomputed with a small script.

---

## Part 1: The signal chain at a glance

```text
 25 MHz crystal (3rd overtone)
   │  ÷2 ÷2 / ÷4 flip-flop chain                                      [HW p.48-49, p.106]
   ├─ 12.5 MHz ── shift clock, 2-colour mode
   ├─ 6.25 MHz ── shift clock, 4-colour mode; CPU clock-stretch logic
   └─ 3.125 MHz ─ shift clock, 16-colour mode; CPU clock; ÷2 → DEB / CCLK (1.5625 MHz)
                                                        │
 ┌──────────────┐ MA0-11, RA0-1  ┌──────────────────┐   │ DEB high: CPU slot, low: CRTC slot
 │  6845 CRTC   ├───────────────►│ address mux      │◄──┘
 │  E14 (D11)   │                │ 4 × 74LS153      │◄── CPU A0-A13
 │              │                └────────┬─────────┘
 │ DE ──────────┼──► 74LS74 ── WSE ───┐   ▼ DA0-6 (DA0-7 on 64K+)
 │ HS ──────────┼──► 74LS123 ×2 ─┐    │ ┌──────────────┐  every CAS  ┌─────────────┐
 │ VS ──────────┼──► 74LS123 ────┤    │ │ video DRAM   ├────────────►│ 74LS374     │──► CPU data bus
 │ MA9 ─────────┼──► NOR latch   │    │ │ 8 × 4116     │             │ (CPU only)  │
 │ CURSOR ──────┼──► IT flip-flop│    │ │ (8 × 4164)   ├──┐          └─────────────┘
 └──────────────┘                │    │ └──────────────┘  │ LOAD at end of CRTC slot
                                 │    │                   ▼
                                 │    │ ┌────────────────────────────┐
                                 │    │ │ 2 × 74LS195 shift registers│◄── mode-selected shift clock
                                 │    │ └──────────┬─────────────────┘
                                 │    │            ▼ 4 bits: one pixel, or a palette index
                                 │    │ ┌─────────────────────┬───────────────────┐
                                 │    │ │ 74LS670 palette 4×4 │ 74LS244 (16-col.) │ (or expansion EC0-3)
                                 │    │ └──────────┬──────────┴─────────┬─────────┘
                                 │    │            ▼ I G R B colour bus ▼
                                 │    └────► 74LS298: paper colour or 74LS175 border register
                                 │                 ▼
                                 │          G R B, and G·I R·I B·I
                                 │                 ▼
                                 └──VRCL──► 74LS273 video register (cleared = blank)
                                                   ▼
                                   270 Ω / 360 Ω resistors → analogue RGB (DIN socket)
                                   TTL lines → PAL encoder (LM1886 + LM1889) → composite video
                                   composite video + sound → UHF modulator, channel 36
```

The CRTC does three jobs and nothing else: it counts, it puts out an address, and it marks
display, sync and cursor moments. Everything that makes the picture a TVC picture happens in
the TTL around it [HW p.165, p.109–115; SCH-A sheets 7–9].

---

## Part 2: Clocks — one character, two T-states

A **25 MHz** crystal runs on its third overtone [HW p.106]. Two J-K flip-flops halve it to
12.5 MHz and then 6.25 MHz. The 3.125 MHz signal is *not* made by halving 6.25 MHz again: two
D flip-flops divide 12.5 MHz by four, because the timing logic needs several phases of 3.125 MHz
at once. A gate realigns the 6.25 MHz stage if it starts in the wrong phase, and the dividers
start from a fixed state at power-on reset, so the phase relations are always the same [HW p.49].

The **video timer** halves a 3.125 MHz phase once more. A single toggling flip-flop, G5 (74LS107),
gives two outputs [HW p.51; SCH-A sheet 2]:

- **DEB**, which says whose turn it is at the video RAM: high for the CPU, low for the CRTC
  [HW p.50, p.53];
- **CCLK**, DEB's exact complement, which is the CRTC's clock input [HW p.50; SCH-A sheet 2].

So one CRTC character clock is **640 ns: a 320 ns CPU slot followed by a 320 ns CRTC slot**. That
is exactly two CPU T-states [HW p.47, p.53]. One scan line of 100 characters is 64 µs, or
**200 T-states**.

Two consequences recur below:

1. **The CRTC, the pixel clocks and the sound divider all run from the fixed clock tree.** Only
   the CPU clock is ever stretched (Part 5), so the beam never waits for the CPU.
2. **Everything is locked together.** Pixel clocks are 8×, 4× or 2× the character clock, so every
   video byte takes exactly one character time in every mode [HW p.68, p.71].

---

## Part 3: The CRT controller and the program it runs

### Which chip

The schematic labels position E14 (D11) simply "6845" [SCH-A sheet 7]. The manual never names a
maker, but its chapter on the chip uses Hitachi's signal names (DISPTMG, CUDISP) [HW p.177–178].
It also describes a vertical-sync width programmable in R3's upper four bits, and a start address
(R12–R13) that the CPU can read back [HW p.181–183, p.191–192]. Both of those are features of the
Hitachi HD6845S / UMC UM6845 ("type 0") parts, not of Motorola's MC6845. On the Motorola part the
vertical sync is always 16 lines, and only the cursor and light-pen registers can be read. *(interpretation)*

Part 9 shows why the difference hardly matters on the TVC: the board reshapes both syncs with
monostables that time their own pulses, and the frame-sync monostable responds only to VS's
leading edge, so the CRTC's VS width never reaches the TV.

### The two ports

Only address line A0 reaches the CRTC's register-select input. Port `70h` selects a register and
`71h` reads or writes it. Because only A0 and the port decode select it, the pair should repeat
through `7Fh`. rtvc mirrors it that way, while MAME decodes only `70h` and `71h` [rtvc `tvc.rs`;
MAME]. R12–R15 can be written and read, R16–R17 can only be read, and everything else can only
be written [HW p.179–193].

### What the ROM programs

At reset the ROM writes 16 bytes to the CRTC. The loop counts down, so it writes **R15 first and
R0 last** [ROM, `CRTC_RESET_VALUES` and the loop at `C24EH`]. The listing's comment says "R0
through R15", but the loop counts the other way.

| Register | Value | Meaning | Result |
|---|---:|---|---|
| R0 horizontal total | 99 | value + 1 characters per line | 100 characters = 64 µs = 200 T |
| R1 horizontal displayed | 64 | characters with display enable | 64 bytes of paper per line |
| R2 horizontal sync position | 75 | character at which HS starts | HS at 48.0 µs |
| R3 sync widths | `32h` | low nibble: HS width; high nibble: VS width (Hitachi) | HS 2 characters; VS 3 lines (16 on a Motorola part) |
| R4 vertical total | 77 | value + 1 character rows | 78 rows |
| R5 vertical adjust | 2 | extra scan lines | 78 × 4 + 2 = **314 lines** |
| R6 vertical displayed | 60 | rows with display enable | 60 × 4 = **240 paper lines** |
| R7 vertical sync position | 66 | row at which VS starts | VS at line 264 |
| R8 mode | 0 | no interlace, no skew | — |
| R9 maximum raster | 3 | value + 1 scan lines per row | 4-line "character" rows |
| R10, R11 cursor start/end | 3, 3 | cursor on raster 3 only, steady | a one-line cursor pulse |
| R12, R13 start address | 0 | first MA of the frame | picture starts at video byte 0 |
| R14, R15 cursor address | `0Eh`, `FFh` | MA `0EFFh` | the last byte of the picture (Part 10) |

That gives a frame of 314 × 200 = **62,800 T-states, 49.76 Hz**, and non-interlaced: every frame
draws the same lines [HW p.57]. The manual calls the four-line rows **fictive character rows**. The
editor's text rows are 10 lines high, but that is purely software. To the CRTC, the screen is
60 rows of 4 scan lines [HW p.70–71].

**Counting convention.** The manual describes R2 and R7 as "one less than the desired position"
[HW p.180–181, p.185], so it counts characters and rows from 1. In that count, R7 = 66 means the
67th row, and R2 = 75 the 76th character. This article counts from 0, as the 6845's counters do:
sync starts when the count equals R2 or R7, so VS starts on row 66 (line 264) and HS on
character 75 (48.0 µs). Both descriptions place sync at the same moment.

### How the counters run (generic 6845 behaviour)

- A **horizontal counter** counts characters 0…R0 and then wraps. **Display enable** (DE) is high
  for counts below R1, provided the row is below R6.
- A **raster counter** (RA) counts 0…R9 within a row, and a **row counter** counts 0…R4, followed
  by R5 adjust lines.
- The **memory address** MA is the row's start address plus the horizontal count. It keeps
  counting through the border and blanking: on a 100-character line it runs 36 past the last paper
  byte. At the end of each row the next row's start is the old one plus R1, and at the end of the
  frame MA restarts from R12–R13 [HW p.169–171].

Two consequences: the address bits keep changing outside the picture, and MA counts in
*characters*, not in scan lines. Part 4 shows how the wiring turns that into a linear bitmap,
and Part 8 shows how the board uses the still-running MA9 to end vertical blanking.

---

## Part 4: From controller address to video RAM address

### The wiring

The CRTC's MA counts characters, and its RA counts the scan line within a row. The board
combines them into a 14-bit video RAM address like this [HW p.110, fig. 29; SCH-A sheet 8]:

```text
 video RAM address bit:  13   12   11   10    9    8    7    6    5    4    3    2    1    0
 CRTC signal:            MA11 MA10 MA9  MA8  MA7  MA6  RA1  RA0  MA5  MA4  MA3  MA2  MA1  MA0
```

MA0–5 give the byte within a line, RA0–1 the line within the four-line row, and MA6–11 the row.
With R1 = 64, a row's start address is 64 × row, so its bits 6–11 are the row number, and:

```text
 address = 256 · row + 64 · RA + column  =  64 · (4 · row + RA) + column  =  64 · line + column
```

So **the bitmap is linear**: 64 bytes per scan line, top to bottom, which is what the manual
gives programmers [HW p.124]. The video RAM seen at `8000h` (page 2) has line *L*, byte *C* at
`8000h + 64·L + C`. The 16 KiB hold 256 lines, of which 240 are shown; the last 1 KiB is never
displayed with the standard settings [HW p.64, p.124].

*Worked example.* The last paper byte is line 239, column 63. The CRTC is then in row 59, raster 3,
with MA = 59 × 64 + 63 = `0EFFh`. The wiring gives RA = 3 → bits 6–7, MA0–5 = 63 → bits 0–5, and
MA6–11 = 59 → bits 8–13: `3BFFh` = 64 × 239 + 63. It's the same address as the cursor register,
which is no accident (Part 10).

**Only R1 = 64 keeps the bitmap linear.** With any other R1 the wiring stays the same, so row
starts no longer line up with bit 6 and the mapping changes. The same goes for a start address
that isn't a multiple of 64. Both emulators differ on exactly this point:

- **rtvc** applies the wiring bit by bit to every MA, so odd widths and start addresses come out
  as the hardware would show them.
- **MAME** computes `ma·4 + ra·0x40 + i` from each row's start MA, which matches the wiring only
  when the start is a multiple of 64.

MA12 and MA13 are not wired, so a start address above `0FFFh` aliases.

### Row and column: the DRAM side

The video RAM is eight 1-bit dynamic RAMs: 4116 (16K) on the 32K/64K boards, 4164 (64K) on the
64K+ [HW p.93, p.109]. A DRAM address goes in two halves, a row and then a column, so four
74LS153 multiplexers choose among four sources. DEB picks the CPU or the CRTC, and the
row/column signal VMUX picks the half [HW p.94, p.109; SCH-A sheet 8]:

| DRAM pin | CRTC row | CPU row | CRTC column | CPU column |
|---|---|---|---|---|
| DA0 | MA0 | A0 | RA1 | A7 |
| DA1–DA5 | MA1–MA5 | A1–A5 | MA6–MA10 | A8–A12 |
| DA6 | RA0 | A6 | MA11 | A13 |

**The DRAM row address is therefore MA0–5 plus RA0.** A 4116 is refreshed by touching each of its
128 row addresses within 2 ms. MA0–5 run through all 64 values on every scan line, because MA
keeps counting through the border. RA0 alternates from line to line, so **every two scan lines
(128 µs) the display has refreshed the whole chip**. That's why the manual says the CRTC's
reading is also the refresh [HW p.70], and why there is no refresh counter on the board. It is
also one reason the CRTC slot runs all the time, picture or not. *(interpretation: the 128-row
count is computed from the wiring)*

### The 64K+: four pictures in one RAM

The 64K+ has 64 KiB of video RAM, room for four complete pictures, and the leaflet advertises
switching between them quickly. Any picture not being shown can hold data or even code [64K+].
The extra address line, VDA7, comes from a six-bit latch (74LS174, C1) and an 8-to-1 multiplexer
(74LS151, B1) [HW p.94–95; SCH-B sheet 4]:

- the latch holds data bits 0–5 written to the **video paging register** at I/O `0Ch`, which
  repeats at `0Dh–0Fh` [HW p.94, p.125–126];
- in a CPU slot, bits 0–1 (for an access through page 1) or bits 2–3 (through page 2) supply
  VDA7's row and column halves, which are the CPU-side bank number;
- **in a CRTC slot, bits 4–5 always supply them**, so the bank being shown doesn't depend on which
  bank the CPU is using.

So a program can draw the next frame in one bank while another is on screen, then flip by
rewriting bits 4–5. The CRTC reads the new bank from its very next slot, even mid-line.
*(interpretation; the manual's table of the multiplexer labels the row/column halves the
opposite way from its own previous page, so which bit of each pair is the row bit is open.)*
MAME displays the bank from bits 4–5 (port `0Fh` only). rtvc pages the CPU side through
`0Ch–0Fh` but always displays bank 0 (`mmu.rs`, `get_vid_mem`).

**Refresh on the 64K+ (open).** In a CRTC slot the extra row bit is a constant from the latch, so
the display touches only 128 of the 4164's 256 row addresses. Whether the 4164s fitted need all
256 rows refreshed, and how the board gets them, isn't covered by the sources (Part 13).

---

## Part 5: One RAM, two users

### The time slots

Every 640 ns character is split in two. During the **CPU slot** (DEB high), the DRAM gets a cycle
only if the CPU is actually addressing video RAM. The **CRTC slot** (DEB low) always gets one,
gated by DEB alone [HW p.51–53]. Since nothing in that gating looks at display enable or
blanking, it runs during the border and the blanking too *(interpretation; and the refresh in
Part 4 requires it)*. The DRAM's 320 ns cycle time is exactly one slot [HW p.109].

### One output latch for both

The DRAM outputs go to two places [HW p.94, p.110; SCH-A sheet 8]:

- **two 74LS195 shift registers**, which load the byte at the end of the CRTC slot. There is no
  separate video latch;
- **a 74LS374 latch, clocked by every CAS strobe**, the CRTC's as well as the CPU's. Its outputs
  reach the CPU's data bus only during a CPU read of video RAM.

So the latch holds the CPU's byte only from the CPU-slot CAS until the next CRTC-slot CAS
overwrites it. If the CPU slot goes unused, the latch picks up meaningless data [HW p.53–54]. This
is the real reason the CPU clock has to be **stretched**. A Z80 instruction can start a memory
cycle at any of four phases relative to DEB, so the stretch circuit holds the CPU clock for one to
four half-T-states. It releases the clock only after the CPU slot's CAS, so that the Z80's own
sampling edge falls into that short window [HW p.53–55]. The full case table and the figures are
in [TVC_CLOCK_STRETCH_FIGURES.md](TVC_CLOCK_STRETCH_FIGURES.md). The stretch logic has no input
from display enable, sync or blanking [HW p.54–55], so **a video RAM access costs the same
wherever the beam is.** That differs from the ZX Spectrum, whose contention applies only while the
picture is being drawn.

### No snow, and when a write becomes visible

A CPU write pulse happens only inside the CPU slot [HW p.51–52], so the CPU and the CRTC never
drive the DRAM at the same moment. So the TVC should show no "snow" (random dots where the
display read lost to the CPU) *(interpretation)*, and the manual gives programmers no warning
about it [HW p.124]. Each byte the
CRTC fetches is wholly the old value or wholly the new one.

Within one character the CPU slot comes first and the CRTC slot second. The CRTC sets up its new
address at the start of the character, on the edge where DEB rises. A CPU write in the CPU slot
of character *n* is therefore already in the RAM when the CRTC fetches address MA(*n*) in the same
character. **The finest time resolution for racing the beam with memory writes is one character,
two T-states.** *(interpretation from the slot order; not stated in the manual)*

---

## Part 6: From byte to pixels

### The shift registers

The byte from the CRTC slot goes straight into **two cascaded 4-bit 74LS195 shift registers**
[HW p.110; SCH-A sheet 8]:

```text
            parallel load at the end of the CRTC slot
 VR7 VR6 VR5 VR4               VR3 VR2 VR1 VR0
  │   │   │   │                 │   │   │   │
 ┌▼───▼───▼───▼┐  serial in   ┌▼───▼───▼───▼┐
 │ D   C   B   A│◄─────────────│ D   C   B   A│      each shift: A→B→C→D
 │ C9  (QD2,QB2)│      QD1     │ C8  (QD1,QB1)│
 └──────────────┘              └──────────────┘
 Taps used by the colour logic: QD2, QB2 (upper register), QD1, QB1 (lower register)
```

Right after a load, QD2 = bit 7, QB2 = bit 5, QD1 = bit 3 and QB1 = bit 1. Each shift clock moves
every bit one place toward D, so the next lower bit appears on every tap, and the lower register's
QD feeds the upper one. The **shift clock** is picked by a 74S153 from the two mode bits of port
`06h` [HW p.111; SCH-A sheet 9]:

| Port `06h` bits 1–0 | Mode | Shift clock | Shifts per byte | Pixels per line |
|---|---|---|---:|---:|
| `00` | 2-colour | 12.5 MHz | 8 | 512 |
| `01` | 4-colour | 6.25 MHz | 4 | 256 |
| `10`, `11` | 16-colour | 3.125 MHz | 2 | 128 |

Mode `11` is not a fourth mode. The same select lines and the palette's output enable treat bit 1
alone as "16-colour" [HW p.112, p.114; SCH-A sheet 9].

### 2-colour: one bit, bit 7 first

The palette's read address is `(0, QD2)`. The upper address bit is forced to 0 by an AND gate
with mode bit 0 [SCH-A sheet 9; HW p.113]. Eight shifts put bits 7, 6, … 0 onto QD2 in turn, so
**the leftmost pixel is bit 7**, and a 0 shows palette colour 0 while a 1 shows palette colour 1.

### 4-colour: the two bits of a pixel are four apart

Now the palette's read address is `(QD1, QD2)`: the high bit from the lower register, the low bit
from the upper one. Four shifts give:

```text
 pixel (left → right)    0        1        2        3
 palette index        b3 b7    b2 b6    b1 b5    b0 b4      (high bit, low bit)
```

So **pixel n = 2·bit(3−n) + bit(7−n)**. Both emulators do exactly this.

### 16-colour: odd bits left, even bits right

The palette is switched off, and a 74LS244 puts four taps straight onto the colour bus. Its four
lines carry I, R, G and B in that order: that is how the 74LS298's outputs reach the final video
register, and it matches the palette's data inputs (BD6, BD2, BD4, BD0). The taps go to them as
I ← QD2, R ← QD1, G ← QB2 and B ← QB1 [SCH-A sheet 9]. Two shifts give:

```text
 left pixel:   I = b7   G = b5   R = b3   B = b1
 right pixel:  I = b6   G = b4   R = b2   B = b0
```

This is also what both emulators do [rtvc; MAME].

### Why the manual's diagrams look different

The manual prints the 16-colour byte as `I G R B I G R B` and the 4-colour byte as
`d1 d0 c1 c0 b1 b0 a1 a0` [HW p.63–64]. Those are **logical** pictures: each pixel's bits shown
together, with no claim about wiring. The schematic's taps and the cascade above produce the
interleaved order. Both emulators, which run the real ROM and games, chose the same order
*(interpretation: neither documents how it was established)*. Trust the schematic.

### Worked example: the byte `B4h`

`B4h` = `1011 0100`.

- **2-colour:** the pixels are 1, 0, 1, 1, 0, 1, 0, 0, which means palette colours 1, 0, 1, 1,
  0, 1, 0, 0.
- **4-colour:** pixel 0 = 2·b3 + b7 = 0 + 1 = **1**; pixel 1 = 2·b2 + b6 = 2 + 0 = **2**; pixel 2 =
  2·b1 + b5 = 0 + 1 = **1**; pixel 3 = 2·b0 + b4 = 0 + 1 = **1**.
- **16-colour:** left = I1 G1 R0 B0, bright green; right = I0 G1 R1 B0, dark yellow.

### The external colour input

A second half of the 74LS244 can drive the colour bus from four expansion-connector lines,
`EC0–EC3`. An active `EXTC` line turns off both the palette and the direct path [SCH-A sheet 9].
An expansion card can therefore supply its own pixel colours in place of the TVC's. The inverted
top shift-register output also leaves the board as `VIDLSB`. The manual's text doesn't describe
either line. *(interpretation)*

---

## Part 7: Colour

### Sixteen colours, IGRB

Every colour on the TVC is four bits: **I**ntensity, **G**reen, **R**ed, **B**lue. The manual lists
the 16 combinations as eight dark and eight bright colours. It even names I = 1 with G = R = B = 0
"(bright) black" [HW p.63]. As the next section shows, that colour *is* black.

### The palette: a register file the beam reads while the CPU writes

The four palette entries live in a **74LS670**, a 4 × 4-bit register file with separate read and
write addresses [HW p.104; SCH-A sheet 9]. The CPU writes entries 0–3 at ports `60h–63h`
[HW p.113]. The display reads one entry per pixel through the shift-register taps, and a write
never waits for the display. The ROM clears all four entries at boot (the `OUT (C),A` loop with
`BC = 0460h`) [ROM], which it has to: the 74LS670 has no reset input *(interpretation)*.

The two registers expect their bits at different positions in the byte written:

```text
 bit:                  7   6   5   4   3   2   1   0
 palette, 60h-63h      x   I   x   G   x   R   x   B      [HW p.113; SCH-A sheet 9]
 border, 00h           I   x   G   x   R   x   B   x      [HW p.111; SCH-A sheet 9]
```

A palette byte uses the even bits and a border byte the odd bits. The manual's own examples:
`82h` to port `00h` gives a bright blue border, and `51h` to a palette port gives bright cyan
[HW p.112, p.114]. *(interpretation: the 16-colour pixel uses the odd bits for its left pixel,
like the border, so a 16-colour byte with both pixels the same, such as `FFh` or `C3h`, also works
as a border value.)* The border register is a 74LS175 that NRESET clears, so the border is black
after reset [HW p.104].

### Intensity raises only the guns that are on

After the paper/border selector (Part 8), G, R and B go to the final **74LS273 video register**
twice: once as they are, and once ANDed with I [HW p.114; SCH-A sheet 9]. Each analogue gun output
is a 270 Ω resistor from the plain bit plus a 360 Ω resistor from the bit ANDed with I
[SCH-A sheet 9]. So:

- **"bright black" is black**, because I with no colour bit drives nothing;
- a bright colour is the same hue as its dark version, just brighter. On equal loads the dark
  level is roughly 57 % of the bright one. *(interpretation: a rough Thevenin estimate; the load
  is off this board)*
- emulators that use `7Fh` for dark and `FFh` for bright (both do) put the dark level at about
  50 %, a little below that estimate.

### PAL: six inputs out of nine

The PAL encoder sits on a separate small board (HBP) and is built around a National LM1886
video matrix and an LM1889 modulator [HW p.116–120]:

- The LM1886 has three inputs per gun. The TVC wires them as two levels per gun, using six of the
  nine inputs. The manual says this gives up colours such as **brown, orange and sky blue**, which
  the chip could otherwise make [HW p.116–117].
- A **4.4336 MHz** crystal oscillator is phase-locked to the line sync, which stops the
  subcarrier pattern from crawling across the picture [HW p.119–120].
- The colour burst comes from a 74123 pair triggered by HSYNC. The text puts its start about
  5.6 µs after the sync's leading edge and gives it about 2.26 µs [HW p.117]. Fig. 33 instead
  labels 5.6 µs as the sync's width and draws the burst after the sync's trailing edge
  [HW fig. 33]. It is made by briefly unbalancing the modulator, and its phase alternates
  135° / 225° line by line, as PAL requires [HW p.117–118].
- A **colour-killer button** on the back removes the subcarrier entirely, which gives a clean
  black-and-white picture [HW p.120].
- A TDA5660 modulator puts the composite video (AM) and the sound (FM) on **UHF channel 36**,
  with a 75 Ω output [HW p.75, p.121–122].
- A 5-pin DIN socket with a centre contact carries the composite PAL video, the sound, and a
  +12 V line that switches a TV to its AV input [HW p.74–75]. The analogue RGB, with composite
  sync, also goes to a 5-pin DIN socket at the back [HW p.70]. Whether it is the same socket
  isn't clear from the text.

The ROM reads port `59h` bit 6 when it sets a mode. When the bit is set, it installs the colour
default palette `00h, 50h, 44h, 41h` (black, bright green, bright red, bright blue). Otherwise it
installs a monochrome-friendly set, `00h, 55h, 50h, 44h` [ROM, `VID_MODE` and
`DEFAULT_PALETTE_TABLE`]. MAME always returns that bit as 1 and labels it "colour" [MAME].
*(interpretation: the bit is presumably a colour/monochrome switch; I didn't trace it on the
schematic)*

---

## Part 8: Paper, border and blanking

The manual describes every scan line as border, paper, border, then retrace. The border goes on
through the retrace, where it can't be seen [HW p.71–72]. Three circuits make that happen.

### Paper or border: DE, one character late

The CRTC's DE goes to the D input of a 74LS74 flip-flop (G15), **clocked by DEB**. Its output,
**WSE**, drives the word-select input of a **74LS298** multiplexer register. On each of its clocks
(12.5 MHz in 2-colour mode, 6.25 MHz in the other two), that register stores either the colour
bus (paper) or the 74LS175 border register (border)
[HW p.72–73, p.110–111; HW fig. 28; SCH-A sheets 7, 9].

The 6845 changes DE on the falling edge of its clock, which is DEB's rising edge, the same edge
that clocks G15. G15 therefore stores the *previous* character's DE, so **paper/border switching
lags the CRTC's DE by one character**. The pixel data lags by about the same amount: the byte for
character *n* is fetched in *n*'s CRTC slot, loaded at the end of it, and shifted out during
character *n* + 1. Delaying DE by one character keeps the border edge in line with the first and
last paper byte. *(interpretation: from the edge timing of the datasheets; the drawings don't
print the delay)*

### Horizontal blanking: a 14 µs monostable

One half of a **74LS123** (C10) triggers on the *rising* edge of HS. Its pulse, through a NOR
gate, becomes the active-low **VRCL**, which holds the final 74LS273 video register cleared, so
all four colour lines are 0 [HW p.72, p.115; HW fig. 28; SCH-A sheet 7]. With R23 = 6.8 kΩ and
C2 = 4.7 nF, the 74LS123's t ≈ 0.45·R·C gives **about 14.4 µs**. The real width depends on
component tolerance.

**The manual's text says 25.26 µs** [HW p.72]. Starting at HS (48 µs into the line), that would
run 9.3 µs into the next line and erase the first 14 or so paper bytes of every line. The manual
itself promises 512 pixels, all 64 bytes, on every line [HW p.65], so the schematic's value is
the one to trust *(interpretation)*. Perhaps the text was written against different components.

A line with the boot values, to scale at one column per character (640 ns):

```text
char    0                                                               64         75       84            98
                                                                                     77
        |                                                               |          | |      |             |
DE      ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾____________________________________
shown   BPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPbbbbbbbbbb.......................bb
HS      ___________________________________________________________________________‾‾_______________________
blank   ___________________________________________________________________________‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾__
sync    _____________________________________________________________________________‾‾‾‾‾‾‾‾_______________
```

- **DE** is the CRTC's display enable.
- **shown** is what reaches the video register, one character late: P is paper, b is border, and
  dots are blanked time. The B at character 0 is the border that the delayed DE still selects.
- **HS** is the CRTC's 2-character pulse.
- **blank** is the 14.4 µs monostable, which ends partway through character 97.
- **sync** is the 4.5 µs line sync, from HS's falling edge.

- The paper is shown from about 0.64 µs to 41.6 µs into the line.
- The right border is visible for 6.4 µs (10 characters), from the end of the paper to HS.
- Blanking runs from 48.0 µs to about 62.4 µs.
- Line sync runs from 49.3 µs to 53.8 µs: a 1.3 µs front porch, a 4.5 µs pulse and an 8.6 µs
  back porch.
- The left border is visible for about 2.3 µs (3.5 characters), from the end of blanking to the
  first paper byte.

Broadcast PAL has 12 µs of line blanking, a 1.5 µs front porch and a 4.7 µs sync, so the TVC is
close. How much of each border a viewer sees depends on the TV's horizontal position and
overscan. *(interpretation for the "shown" row; the rest is computed from the boot registers and
the component values)*

### Vertical blanking: set by VS, ended by MA9

Two NOR gates of C11 form an **R-S latch**. The vertical-sync monostable (B12) puts it into the
"blank" state, and the CRTC's address line **MA9** takes it out again. The latch output and the
horizontal-blank pulse are combined into VRCL [HW p.73, p.115; HW fig. 28; SCH-A sheet 7]. (Page
115 calls MA9 the "set" input and the monostable the "reset" input. Only the names differ: which
state blanks is shown on the schematic.) Step by step, with the boot values:

1. Lines 0–239 show paper. Lines 240–263 are bottom border: DE is low, the border register shows.
2. At line 264 the CRTC reaches row 66 (R7), and VS rises. The monostable starts the frame sync
   and sets the latch: from now on the picture is black.
3. MA keeps counting. Row 66 starts at MA `1080h`, row 67 at `10C0h`, and so on. MA9 (`200h`)
   stays 0 through rows 66–70, because their MA values all lie in `1080h`–`11E3h`.
4. In row 71 (line 284), MA = `11C0h` + horizontal count reaches `1200h` at character 64, just
   after where the paper would end. MA9 goes high and resets the latch.
5. From the rest of line 284 to line 313 the border colour shows: about 29 lines of top border.
   The frame then restarts at line 0.

So **vertical blanking lasts about 20 lines (264 to the middle of 284)**, a little under the 25
lines of broadcast PAL. The bottom border is 24 lines and the top border about 29 lines.

The manual says VS comes "during line 268" [HW p.73]. That follows its 1-based count (Part 3):
the 67th row covers lines 265–268 counted from 1, which is lines 264–267 counted from 0. So the
two agree. The arithmetic here counts from 0.

**The end of blanking depends on the start address.** MA9 is just an address bit, so moving R12–R13
moves the moment blanking ends. A script run of the counter gives, for start addresses `0000h`,
`0040h` and `0100h`, a release at lines 284, 280 and 268. At `0200h`, MA9 is already high when VS
arrives, so the latch is hardly set at all. The retrace lines then carry the border colour instead
of black, which a CRT would show as bright diagonal retrace lines. Software that scrolls by
rewriting the start address therefore also changes the vertical blanking. *(interpretation: the
latch logic and the counter behaviour are from the sources; the effect on a real TV hasn't been
observed)*

---

## Part 9: Sync

The CRTC's HS and VS never reach the TV directly. Three 74LS123 monostables reshape them
[HW p.115; HW fig. 28; SCH-A sheet 7]:

| Monostable | Triggered by | R, C | ≈ width | Output |
|---|---|---|---:|---|
| C10, half 1 | HS rising | 6.8 kΩ, 4.7 nF | 14.4 µs | horizontal blank (Part 8) |
| C10, half 2 | HS falling | 10 kΩ, 1 nF | 4.5 µs | line sync, HSYNC |
| B12, half 2 | VS rising | 30 kΩ, 10 nF | 135 µs ≈ 2.1 lines | frame sync, VSYNC; sets the blank latch |

A NOR gate (D12) combines the line and frame pulses into the active-low composite sync,
**NCSYNC**, for the PAL encoder and the RGB socket [HW p.74, p.115]. Because the frame is
non-interlaced, there are no equalising pulses and no serrations [HW p.57]. The TV simply gets
a 314-line, 49.76 Hz frame.

Since the line sync starts on HS's *falling* edge, **R3's low nibble sets the front porch**: the
gap between the start of blanking and the start of sync. **R2 sets where blanking and sync sit**
relative to the paper. The CRTC's own vertical-sync width (the high nibble of R3 on a Hitachi part,
fixed at 16 lines on a Motorola one) only has to be longer than nothing: the frame monostable
starts on VS's rising edge and times itself. That's why the HD6845-versus-MC6845 question hardly
affects the picture (Part 3). *(interpretation)*

On the HBA-2 (64K+) board the horizontal-blank resistor, R38, is printed **68k**, not 6.8k
[SCH-B sheet 7]. At 68 kΩ the pulse would be about 144 µs, longer than a line, and the
retriggerable 74LS123 would never end it. It is almost certainly a drafting error, but it would
take a look at a real board to be sure.

---

## Part 10: The frame interrupt

### The cursor as a timer

The TVC never shows the 6845's hardware cursor: the visible cursor is drawn into the bitmap by
software. The cursor output's only job is to request an interrupt [HW p.178]. The ROM places the
cursor at MA `0EFFh`, on raster 3 only, so the cursor pulse comes **once per frame, at the last
byte of the last paper line**. The manual describes it as a pulse one character (640 ns) wide,
appearing when the beam draws the last line of the last character of the last row [HW p.47]. A
6845 also gates its cursor output with display enable, so the cursor can only fire inside the
paper [HW p.178].

### The interrupt flip-flop

The cursor output (CRTC pin 19, labelled CD) and the sound generator's interrupt (SDINT) go
through a NOR gate to the clock input of the second half of the 74LS74 (G15). That flip-flop's
D input is tied high, and its clear input is the write strobe of port `07h` [SCH-A sheet 7]. Its
output, together with the expansion-card interrupts, drives the Z80's /INT. Port `59h` bit 4
shows the request (active low), and **any write to port `07h` clears it** [HW p.125; MAME; rtvc].
The ROM's handler does exactly that, and also rewrites the border colour on every interrupt
[ROM, `IRQ_CORE`].

Two details follow from the wiring *(interpretation)*:

- A 74LS74 clocks on a rising edge, and the NOR's output rises when its inputs *fall*. So the
  flip-flop is set at the **end** of the cursor pulse: character 64 of line 239, which is
  239 × 200 + 64 × 2 = **47,928 T-states after the frame starts**, if the frame starts at line 0,
  character 0.
- The cursor and the sound interrupt share one NOR gate. While one of them holds its input high,
  the other's pulse produces no clock edge, so one source can mask the other. The manual only
  says the two share a status bit and the program must know which one it enabled [HW p.47].

### It moves when the cursor moves

The interrupt is wherever R14–R15 and R10 put it. VT-DOS rewrites the CRTC from its own table and
leaves the cursor at `0AFFh`, so after a VT-DOS boot the interrupt fires at the end of line 175,
not line 239 [rtvc]. A raster effect timed from "the frame interrupt" must either set the cursor
registers itself or measure from the interrupt it gets.

---

## Part 11: What software can change mid-frame

Everything in the colour path is plain registers that the display reads continuously. Changes
take effect at the next pixel or character the hardware handles:

- **Border colour** (port `00h`): the 74LS298 picks up the 74LS175 on each of its clocks while
  WSE selects the border. So a border change shows almost at once, and stripes can be as
  fine as the CPU can write them, one `OUT` every few T-states. The rtvc probe program in
  `rtvc/coding/tvc-interrupt-raster-probe.asm` makes a white band this way.
- **Palette** (ports `60h–63h`): the 74LS670 is read and written independently. In 2- and 4-colour
  modes a palette write recolours every following pixel that uses that entry, mid-line included.
  It is the TVC's main tool for colour splits.
- **Mode** (port `06h` bits 0–1): the mode latch switches the shift clock and the palette/direct
  path at once. A change in the middle of a byte probably gives a few odd pixels before the next
  load realigns everything. *(interpretation)* Port `06h` also holds the sound amplitude and, in
  bit 7, the printer strobe, so the ROM keeps a copy at `0B13h` and changes only the mode bits
  [ROM, `VID_MODE`; HW p.114, p.126]. Mid-frame mode changes must do the same.
- **Start address** (R12–R13): on a 6845 it is loaded into MA only at the frame restart, so
  changing it mid-frame affects the next frame *(interpretation: generic 6845 behaviour; the
  manual doesn't say, and rtvc does the same)*. It also moves the end of vertical blanking
  (Part 8).
- **Geometry** (R0–R9): the counters obey new values at once, with the usual 6845 consequences.
  If R2 or R7 is set so that sync never comes, the monostables never fire and the TV loses lock.
  rtvc's video plan treats that as a case to support: a game ported with only R6 changed from 60
  to 48 shows 192 paper lines with border below [rtvc `.agents/plans/tvc-video-signal-pipeline.md`].
- **Display bank** (64K+, port `0Ch` bits 4–5): takes effect at the next CRTC slot.
- **Video RAM**: bytes written ahead of the beam show in this frame. The race is resolved per
  character (Part 5).

---

## Part 12: What the emulators model

| Hardware behaviour | rtvc | MAME |
|---|---|---|
| CRTC advanced 1 character per 2 T-states, mid-frame changes visible | yes (interleaved mode) | no: one row at a time from current state |
| Exact MA/RA wiring for any R1 and start address | yes | only for 64-byte rows starting at a multiple of 64 |
| Pixel order in 4- and 16-colour modes | as the schematic | as the schematic |
| Border colour | yes, bits 7/5/3/1 | no: the port write is ignored |
| Paper/border one character after DE | no: DE used undelayed | no border at all |
| Horizontal blank 14.4 µs from HS rise | no: blank = an 8-character shaped HSYNC | — |
| Vertical blank from VS to MA9 | yes | — |
| Sync shaped by monostables, TV that locks to it | yes, but sync starts on HS rising (no front porch); widths approximated (8 characters, 4 lines) | no |
| Cursor interrupt from live CRTC registers | yes, at the cursor match | yes (MC6845 cursor callback) |
| Interrupt set at the end of the cursor pulse; masking by the sound interrupt | no | no |
| CRTC slot always on; CPU stretch on every VRAM access | no stretch | no stretch |
| 6845 variant | mixed: fixed 16-line VS (Motorola), R12–R13 readable (type 0) | MC6845 |
| Intensity per gun, "bright black" = black | yes (`7Fh` / `FFh`) | yes (`7Fh` / `FFh`) |
| 64K+ display bank from bits 4–5 | no: always shows bank 0 (ports `0Ch–0Fh` page the CPU only) | yes, port `0Fh` only |

For an emulator these are the cheap wins: the one-character DE delay, the 14.4 µs blank and its
porch positions, and the end-of-pulse interrupt edge. Each is a constant or one flip-flop.

---

## Part 13: Open questions

1. **Which 6845 is fitted.** The manual's description matches a Hitachi/UMC type-0 part. The
   schematic just says "6845". Checking a real board's chip, or reading R12 back on real hardware,
   would settle it. Part 9 shows it matters little for the picture. It does matter for software
   that reads the CRTC.
2. **The 25.26 µs horizontal blank in the text** against the schematic's 14.4 µs. A scope on a real
   machine, or a careful look at whether the left paper bytes really show, would settle it. The
   second check already argues for the schematic.
3. **The colour burst's position**: the text and Fig. 33 disagree on whether 5.6 µs is the delay
   to the burst or the sync's width.
4. **The R38 = 68k** marking on the HBA-2 sheet.
5. **Refresh of the 64K+'s 4164s**: the display touches only 128 of their 256 row addresses
   (Part 4).
6. **The exact sub-character timing** of LOAD, the 74LS298 and 74LS273 clocks, and VRAS/VCAS/VMUX:
   sheet 2's 74S74 chain wasn't fully traced. That would turn "about one character late" into an
   exact pixel offset for the paper edge.
7. **The row/column pairing of the 64K+ bank bits** (the manual's table contradicts its text).
8. **Port `59h` bit 6**: confirm on the schematic that it is the colour switch the ROM uses to
   choose its default palette.
9. **Mid-byte mode changes**: what the shift registers do when the clock rate changes between
   loads.

---

## Summary

- The **6845 only counts.** One character is 640 ns: a CPU slot and a CRTC slot of video RAM, two
  T-states. The ROM sets 100 × 314 characters per frame, 64 × 240 bytes of paper, 62,800 T-states,
  49.76 Hz, non-interlaced.
- **The address wiring** (MA0–5, RA0–1, MA6–11) makes the bitmap linear at 64 bytes per line, but
  only while R1 = 64. The DRAM row address is MA0–5 + RA0, so the display refreshes the memory every
  two lines. That is one reason the CRTC slot never stops.
- **The CPU and the display share one output latch**, which is why the CPU clock is stretched on
  every video RAM access, wherever the beam is. In return there is no snow.
- **Two cascaded 74LS195s** shift each byte out at 12.5 / 6.25 / 3.125 MHz. Their taps make the
  4-colour pixel `2·bit(3−n) + bit(7−n)` and the 16-colour pixels odd-bits-left / even-bits-right.
  The manual's bit diagrams are logical pictures, not the wiring.
- **Colour is IGRB.** The palette is a 74LS670 the CPU writes while the beam reads (even bits of
  the byte). The border is a 74LS175 (odd bits). Intensity is ANDed per gun, so "bright black" is
  black. The PAL encoder uses six of the LM1886's nine inputs, so it can't make brown or orange.
- **Border, blanking and sync are TTL decisions.** DE, delayed one character by a flip-flop, picks
  border or paper. A 14.4 µs monostable from HS blanks each line. An R-S latch blanks the frame
  from VS until MA9 rises, so the start address changes the vertical blank. Monostables shape
  both syncs and a NOR gate combines them.
- **The frame interrupt is the cursor.** It is set at the end of the cursor pulse on the last paper
  byte, cleared by any write to `07h`, shared with the sound timer, and moved by anyone who moves
  R14–R15.
