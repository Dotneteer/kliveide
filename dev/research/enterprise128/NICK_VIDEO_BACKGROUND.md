# Enterprise 64/128 — NICK background: hardware, FPGA core, measurements, test software

Researched on 2026-10-30 to extend [NICK_VIDEO.md](NICK_VIDEO.md). That file stays as it is; this one
adds evidence for its ten open questions (OQ1–OQ10) and covers what it did not: the board-level clock
and video circuit, an FPGA re-implementation, community notes and test software.

Same rules as the rest of the pack. Every fact is cited inline. Anything the researcher concluded rather
than read is marked *inference*. GPL sources (ep128emu, Xemu, the Kyp069 FPGA core) were read for facts
only and are described here in our own words; no code was copied. MAME is BSD-3; CLK is MIT.

How the sources were read: GitHub through `gh api` and raw URLs. The original design documents (§2)
were later added to `docs/hardware/` and read from page images. Two schematic images on the Wayback
Machine (`EP64-3-rajzolt.jpg` and the NICK sheet thumbnail `3006-0000-22_Sheet-1.jpg`) could only be
seen by saving them to the session scratchpad for a moment. Both copies were deleted straight away and
nothing was added to the pack.

---

## 1. Summary

### What this adds

- **The original design documents** (IS's 1983 internal timing and chip descriptions, both editions of
  "Programming the NICK chip", the EXOS 2.0/2.1 video driver specs; now in `docs/hardware/`) are
  summarised in §2. They settle the clock ratio (14 237 536 Hz), the LPB re-read on every line, the
  HSYNC/burst/blank slots and the in-slot split (NICK reads in clocks 0–4 and 5–9, Z80 in 10–15). They
  show that NICK makes the Z80 clock and stretches it in half-T steps, and that pixels appear one slot
  after their fetch. They say VINT interrupts at the **start** of the block. They also expose a conflict
  over which RM bit is ALTIND1 (§2.9).
- **The board schematic shows how NICK is clocked.** NICK's 14 MHz is not a crystal. It comes from an
  LC oscillator tuned by a varicap and phase-locked, through an XOR phase detector, to the 4.4336 MHz
  PAL crystal oscillator in the LM1889 (§3.1). This explains the guide's word "phaselocked"; the design
  documents then give the ratio (§2.2).
- **The original gate-level NICK schematic exists.** These are AMI's plans for the "ELITE" chip
  (drawing 3006-0000-22, revisions A–E, 1983–84), now in `docs/hardware/` (§2.12, §3.5, §9). It is the
  one source that could settle the remaining logic questions, but it has to be traced net by net.
- **The colour DAC is a resistor network** (470/220/100 Ω for R and G, 220/82 Ω for B) behind a
  74LS244, plus an LM1886 matrix DAC for the PAL encoder. MAME's resistor model matches it; the guide's
  linear formula is an approximation (§3.3).
- **The Kyp069 FPGA core** gives a second slot-level model (§4). It fetches two bytes per slot at fixed
  sub-cycles, reads the LPB only on a block's first line (like CLK), and latches VINT on the rising edge
  one line late. It has no CPU contention at all, so it cannot help with OQ5.
- **The Hungarian EXOS book's hardware appendix** (local `docs/Exos.htm`) records several
  near-measurements in its author's words (§5). M1-only waits are EXOS's default. NICK port reads go
  through a 74LS245 onto a bus with no pull-ups. Video-RAM access syncs to 889 846 Hz. The author
  thinks VINT latches at the start of the line after the VINT block, but asks for a real-machine check.

### Status of NICK_VIDEO.md's open questions

| OQ | Question | New status | Evidence | Recommended default for Klive |
|---|---|---|---|---|
| 1 | Exact NICK clock | **Settled: 14 237 536 Hz** (912 clocks = 284 subcarrier cycles). | Design docs (§2.2): NICK divides the 4.433 MHz subcarrier by 568 (÷4, ÷71, ÷2) into 7805 Hz, which is phase-compared with H/2; DPC11 p. 7 names the result, 14.2375 MHz and a 64.05 µs line, and notes a colour penalty for the 14.188 MHz alternative. The board's NICK pins `PAL` and `H2 REF` are the 4.433 MHz input and the 7805 Hz output. Board (§3.1): LC VCO plus XOR detector. Agrees with ep128emu, CLK, RGBtoHDMI and the EXOS book. **Reverses §3.1's earlier inference** that leaned to 16/5. | **14 237 536 Hz**, asynchronous to the 8 MHz Z80 clock; one constant. |
| 2 | VINT edge (start or end of the block) | **NICK side settled (start); DAVE's edge still to check.** | ET1/1 (both editions, p. 7): VINT takes `/VIRQ` low for the whole modeline and, with DAVE, interrupts "at the beginning of the modeline". DPC11 p. 6: `/VIRQ` falls at slot 0. MB is re-read each line, so `/VIRQ` falls in slot 0 of the block's first line and rises in slot 0 of the line after (§2.6). That is CLK's and the guide's model. **ep128emu and Xemu (end of block) contradict the documents** unless DAVE's INT1 latches the rising edge of the pin. **The FPGA (second line) is contradicted** either way. The EXOS book's "line after" is a deduction. | Keep the switch. Default to **ep128emu (end of block)** only until DAVE's INT1 edge is read in `docs/hardware/DAVE_ISSUE*.pdf` / `The_Dave_Chip.pdf`. If DAVE latches the falling edge, change to **start of block**. |
| 3 | LPB fetched every line or once per block | **Settled: every line.** | DPC12 p. 10: the 16 LPB strobes come from the line-start pulse on every line, and the pointer advances only after a block's last line. DPC11 p. 7: the first 16 half-slots of every line load the 16 registers. ET1/1 Nov 84 p. 8: COL0–7 are loaded "at the start of each scanline". **CLK and the FPGA core are wrong; ep128emu is right.** | ep128emu (**every line**). |
| 4 | Port 83h bits 6/7 | **Narrowed: a counter model that matches ep128emu.** | Bit 7 = "/(load line parameter base)", bit 6 = "/(clock in line parameter base)" (DPC11 p. 8; ET1/1 p. 2). The Jan 84 demo's comments: bit 7 low forces the LP counter's LOAD; bit 6 low forces its clock; the 0→1 of bit 6 clocks in the base (§2.7). This gives ep128emu's visible behaviour. It **contradicts the FPGA** (bit 6 stops the line counter), **Xemu** (bit 7 resets counters) and **CLK** (bit 7 edge). Open: whether a forced clock mid-block restarts the line counter. | ep128emu's flag model. |
| 5 | CPU contention window | **NICK's side settled; the CPU-side arithmetic still open.** | Each 16-clock slot is NICK read 1 (clocks 0–4), NICK read 2 (5–9), then the Z80 window (10–15, 419 ns) for a VRAM access **or a NICK register write** (DPC12 pp. 2, 8–9; DPC11 pp. 6–7). NICK makes the Z80 clock from 8 MHz and stretches it by stopping the toggle, so in **half-T steps** (DPC11 p. 7). The stretch unit's own document (DPC08/09) is missing, and A3PER-1 has no contention detail. Confirms the FPGA's sub-cycles and the CLK wiki's order; contradicts CLK's code comment. | ep128emu's arithmetic; window = clocks 10–15. |
| 6 | Mode 6 and undefined combinations | **Still open for mode 6; ALT combinations narrowed.** | Every edition says "unused"; DPC12 p. 12 decodes it to an `/UNUSED` line, and the Jan 84 demo reserves it as "TPIXEL" (§2.10). DPC12 p. 14: unused palette-bus bits are 0 and the ALT offsets are OR-ed in, as in ep128emu's `render_Generic`. The gate plans were not traced for mode 6. | ep128emu's `render_Generic`. |
| 7 | HSYNC / burst slot positions | **Settled.** | `/HSYNC` slots 0–3; `/BURST` slots 6–9, inhibited in VSYNC mode; `/BLNK` from slot 56 through slot 9, with the output forced to colour 0 (not border) while blanked; H/2 toggles on each HSYNC (DPC12 pp. 4, 11–12, 15; DPC11 p. 7). Agrees with CLK; the FPGA is one slot late. | CLK's layout; blanking = black. |
| 8 | Display in slot 7 and in slots 54–56 | **Settled for the output, narrowed for LD1.** | Slots 56 and 0–9 are blanked on the output whatever the margins (DPC12 p. 12, p. 15), so slot 7 never shows anything. Display fetches happen in slots 8–53; refresh takes 54–56. LD1 still counts in slots 0–7 and 54–56 when the margins include them, but the data buffers are not reloaded there (§2.5). With the one-slot pipeline, slot 54 shows slot 53's fetch and slot 55 repeats the stale buffers (§2.5) — close to ep128emu's floating-bus repeat. | Render slots 56 and 0–9 as blank. Keep ep128emu's LD1 advance in the control slots. Model slot 55 as a repeat of the last fetched bytes. |
| 9 | BFh value EXOS sets | **Narrowed to M1-only waits** (unchanged; the NICK documents do not cover it). | EXOS book, BFh section: bit 2 = 1 (wait only on M1) is "the default mode" (*alapértelmezett mód*). geco on pouët: "its default setting is waiting at M1", and writing 0Ch removes it. DAVE reset gives 00h (all accesses). | After EXOS boots: **BFh bits 3:2 = 01**. Confirm the exact byte by tracing the ROM in the emulator. |
| 10 | External colour inputs (EC0–EC3, /EXTC) | **Settled: inert without hardware.** | Schematic: EC0–EC3 and /EXTC go to expansion-bus pins A24, B24, A25, B25 and A26, each pulled up with 680 Ω (R59–R63). Nothing drives them on a bare machine. ep128emu ignores FIXBIAS bits 5–6 (ep128emu state page). The design documents add only that /EXTC is synchronised and that external colour forces 16-colour handling over 256-colour mode (§2.8). | Ignore them. Store FIXBIAS bits 5–7 for the debugger only. |

---

## 2. Findings from the original design documents

Added on 2026-10-30, after the original design documents were obtained. They are now in
`docs/hardware/` (§9). All of them are image-only scans and were read page by page. The facts below are
written in our own words. Page numbers are the PDF page (p. N), not the printed page number, unless
"printed" is said.

### 2.1 The documents and what each one is worth

| Short name | File (`docs/hardware/`) | Date, author | What it is | Weight |
|---|---|---|---|---|
| **DPC12** | `NICK-Internal-timing-of-VDC-Elite.pdf` (19 pp.) | 2 Aug 1983, Nick Toop, Intelligent Software (IS), "Project DPC", distributed to AMI | The internal timing of the chip, signal by signal, with timing diagrams. Refers to internal parts by number (Q1–Q131). | The best source for line timing. But it is **14 months older than Rev. E** (24 Oct 1984), it describes an **NTSC-timed prototype** (14.318 MHz, 63.7 µs lines, p. 2, p. 8), and its prose has visible slips (see §2.9). |
| **DPC11** | `NICK-Old-VDC-ELITE-description.pdf` (12 pp.) | undated, IS; a hand note on p. 1 says it is old information "but may be of use" | The external description: pinout, external timing, clocks, PAL options, registers, bus use per mode | Same era as DPC12 (it is the "DPC11.DOC" that DPC12 p. 8 refers to). |
| **ET1/1 Jan 84** | `ET1-1_84-01-17_The_Nick_Chip.pdf` (22 pp.) | 17 Jan 1984, IS | "Programming the NICK chip": registers and LPB, plus a CP/M demo program (pp. 13–22) | Programmer's view of Rev. B. The demo's LPT is a complete, working 312-line frame. |
| **ET1/1 Nov 84** | `ET1-1_84-11-29_The_Nick_Chip.pdf` (10 pp.) | 29 Nov 1984, IS | The same text, revised, without the demo | **Contemporary with the shipped Rev. E.** Where editions differ, this one wins. |
| **Video 2.0** | `ET11-10_EXOS_20_Video_Driver_Specification.pdf` (19 pp.) | 27 Nov 1984, IS | EXOS 2.0 video driver | Software only; §2.11 |
| **Video 2.1** | `ET11-11_EXOS_21_Video_Driver_Specification.pdf` (19 pp.) | 16 Jan 1985, IS | EXOS 2.1 video driver | Software only; §2.11 |
| **VSYNC App. 2** | `Appendix2_EXOS_21_VSYNC_Improvement.pdf` (1 p.) | 20 Feb 1985 | A BASIC patch to EXOS's LPT | §2.11 |
| **A3PER-1** | `A3PER-1_Enterprise_64-128_Bus_Timing.pdf` (1 sheet) | 4 Apr 1985, IS drawing | Generic Z80 bus waveforms (Φ, A0–A13, A14–A21, D, /M1, /RFSH, /MREQ, /RD, /WR, /IORQ, /WAIT, /INT, /NMI) with numbered timing references to a table that is not included | **No NICK or contention detail.** Not useful for OQ5. |
| **TechDesc** | `Enterprise-TechDesc.pdf` (5 pp.) | c. 1985, Enterprise Computers | Marketing spec sheet | Mode list only; interlace modes need an "interlace driver" from the demo tape (p. 2). |
| **ELITE plans** | `3006-0000-22_Sheet-1/2.pdf` | AMI, Rev. E | Gate-level chip schematic | §2.12 |

The Programmer's Guide in `docs/` (David Bouman's transcription) follows ET1/1 closely but not
exactly; the differences are in §2.9.

### 2.2 Clocks and the PAL lock (settles OQ1)

- **NICK has two unrelated clock inputs.** `14M` sets all video timing; `8M` (8 MHz, or 12 MHz in some
  machines) is used only to make the Z80 clock (DPC12 p. 8; DPC11 p. 7). The two run asynchronously
  (DPC11 p. 1, p. 7).
- **NICK generates the Z80 clock itself.** Its outputs `PHI` and `/PHI` are the Z80 clock and its
  inverse. `8M` toggles a flip-flop that makes PHI, and the clock is stretched by **inhibiting the toggle**
  (DPC11 p. 4 printed 5, p. 7). *Inference:* a stretch therefore lasts a whole number of 8 MHz periods,
  i.e. **half a Z80 T-state** at 4 MHz — exactly the granularity ep128emu and the EXOS book use (§5.1).
  NICK also receives `/M1`, `/MREQ`, `/IORQ`, `/RFSH`, `/WR`, `/VRAM` (a video-RAM access is requested)
  and `/VIO` (an I/O write to 80h–8Fh) for this (DPC11 pp. 3–4).
- **The line is 912 `14M` clocks**: 57 "memory cycles" (our *slots*; the documents also say "columns")
  of 16 clocks (DPC11 p. 6, p. 7; DPC12 p. 10).
- **14M is "not exactly 14 MHz"** and was expected to lie between 14.1 and 14.4 MHz (DPC12 p. 2; DPC11
  p. 7). For NTSC it is 4 × the subcarrier, 14.318 MHz, giving a 63.7 µs line (DPC11 p. 7).
- **The PAL options are written out in DPC11 p. 7:**
  1. NICK divides the 4.433 MHz subcarrier **by 568** into a 7805 Hz square wave; that and **H/2** (half
     the line rate) phase-lock the master clock to **14.2375 MHz**, line 64.05 µs.
  2. A 0.89 MHz output "kicks" a PAL crystal at a fifth of its frequency, giving 14.188 MHz and a
     64.2 µs line, with a stated colour-registration penalty on PAL-D sets.

  DPC12 p. 12 proposes option 1 as a change ("IS THIS POSSIBLE?"): drop the 0.89 MHz and 3.58 MHz
  outputs, add a 4.433 MHz input and a 7805 Hz output, and divide by 4, by 71 and by 2. DPC11's pinout
  (pp. 2–3) already has pins `4.433M` (in) and `7805Hz` (out). The shipped board's NICK pins `PAL` (52)
  and `H2 REF` (51) are these two pins.
- **So the shipped clock is option 1**: 912 NICK clocks = 284 subcarrier cycles, 14M = 4 433 618.75 ×
  912 / 284 = **14 237 536 Hz**. This is candidate 1, the value ep128emu, CLK, RGBtoHDMI and the EXOS
  book use. *Inference:* the board's XOR (U32) compares `H2 REF` (subcarrier ÷ 568) with **H/2**, not
  with the raw subcarrier as §3.1 assumed from the redrawn schematic; that reading of sheet 3 should be
  re-checked. The ratio 284 cannot be wrong unless the shipped chip differs from both documents, and
  the pin names say it does not.

### 2.3 Inside a slot: NICK's two reads and the Z80's window (narrows OQ5)

Within each 16-clock slot a "twisted ring" (Johnson counter) of 8 stages driven by 14M makes 16 phases
T0–T7 and their complements, each a 0.89 MHz square wave (DPC12 p. 8). From them:

| 14M clocks of the slot | Signal | Use (DPC12 p. 2, p. 8; DPC11 p. 6, p. 7) |
|---|---|---|
| 0–4 (5 clocks, 349 ns) | `/UL1` (DPC11 calls it `/VDC1`) | NICK's first read: buffer #1, or an even LPB byte (SC, LM, LD1L, LD2L, COL0/2/4/6), or a refresh address |
| 5–9 (5 clocks, 349 ns) | `/UL2` (`/VDC2`) | NICK's second read: buffer #2, or an odd LPB byte (MB, RM, LD1H, LD2H, COL1/3/5/7), or a refresh address |
| 10–15 (6 clocks, 419 ns) | `/Z80` | A Z80 video-RAM read or write, **or a write to a NICK register** |

- External timing (DPC11 p. 6, printed): NICK's address is stable from about clock 0 and 5; it takes the
  data in at about clocks 4 and 9 ("data read at the end of the slot", DPC11 p. 7). A third RAS/CAS cycle
  runs in clocks 10–15 only when the Z80 uses the window; `/ACCESS` (which turns on the board's bus
  buffers) is low for it and `/VW` is the write strobe (DPC12 p. 9).
- At the end of the Z80 window an internal `/RESTART` pulse releases the stretched Z80 clock (DPC12
  p. 9 diagram). The clock-stretch unit itself is described in IS documents DPC08/DPC09, which we do not
  have (DPC12 p. 8).
- "The Z80 clock is also stretched when it writes to registers in the VDC" (DPC12 p. 9). The registers
  are written **over the video bus**: NICK reads the register address from UA0/UA1 and the data from
  UD0–UD7 during `/Z80` time (DPC12 p. 4, p. 5, p. 15). Decoding uses only A0/A1, with `/VIO` covering
  80h–8Fh (DPC12 p. 15) — the mirrors in NICK_VIDEO.md §9.
- *Inference:* **a port write lands in clocks 10–15 of a slot**, so a mid-line BORDER/FIXBIAS/palette
  change takes effect on a slot boundary as ep128emu assumes, at the end of the slot in which the Z80's
  window falls.
- **This confirms the FPGA's sub-cycles 4 and 9 and the CLK wiki's 5 + 5 + 6 order (reads first),** and
  contradicts CLK's code comment that gives the Z80 the first six cycles.
- DPC11 p. 7 estimates the Z80 is slowed by "about 60%" when accessing video RAM (*inference:* a rough
  1983 estimate, not a measurement).
- Still not in these documents: when inside a Z80 machine cycle NICK samples `/MREQ`/`/IORQ`, and
  how many half-T steps a given phase costs. That logic is in the missing DPC08/09 and in the ELITE
  plans. Keep ep128emu's arithmetic.

### 2.4 The line: slot map, sync, blanking, refresh (settles OQ7, most of OQ8)

DPC12 p. 11 ("A scanline") and p. 12, DPC11 p. 6 and p. 7. Column numbers are the slot counter C5–C0,
a ripple counter clocked from `/ULA`; at count 56 a `/CRST` pulse lasting one whole slot resets it, so
**slot 56 is the `/CRST` slot** (DPC12 p. 2, p. 10).

| Slot(s) | What happens |
|---|---|
| 0 | LPB bytes 0, 1 (SC, MB). `/HSYNC` low. `/VIRQ` follows the newly read MB (§2.6). |
| 1 | LM, RM. `/HSYNC` low. |
| 2 | LD1L, LD1H. `/HSYNC` low. |
| 3 | LD2L, LD2H. `/HSYNC` low (4 slots = 4.47 µs on NTSC). |
| 4, 5 | COL0–3. Gap after sync. |
| 6–7 | COL4–7. `/BURST` low (4 slots from slot 6 = 2 slots after sync ends; inhibited in VSYNC mode). |
| 8, 9 | First display-fetch slots. `/BURST` still low. |
| 10 | `/BLNK` ends (at the first slot ≥ 8 with C1 = 1): the **first slot that can show border or picture**. |
| 10–53 | Display fetches inside the margins (fetches in 8–53, DPC12 p. 11 diagram). |
| 54, 55, 56 | DRAM refresh, two refresh addresses per slot = 6 per line (`/RFSH'`). `/BLNK` starts again with `/CRST` in slot 56. |

- The LPB addresses are output in slots 0–7 (the `/PARMS` window from C3–C5) and the 16 latch strobes
  `/SC`…`/COL7` are made by shifting `/CRST` through two shift registers clocked by `/UL1` and `/UL2`.
  **Nothing in this chain depends on whether the line is the first of a block** (DPC12 p. 10).
- **Refresh**: the 8-bit row address is a 7-bit counter (clocked by `/RFSH'`) plus `/UL1` as its LSB;
  the 256 rows take 2.7 ms (DPC12 p. 10).
- All of these are retimed by T7, "a bit earlier than shown" (DPC12 p. 12), and DPC11 p. 6 allows
  0–400 ns of skew on `/HSYNC`, `/BURST`, `/VSYNC` and `/VIRQ`.
- **HSYNC/BURST**: `/HSYNC` = slots 0–3; `/BURST` = slots 6–9 (DPC12 p. 12; DPC11 p. 7 says 2.23 µs
  after the *rising* edge of /HSYNC). This matches **CLK** (sync 0–3, blank 4–5, burst from 6). The FPGA's
  HSYNC 1–4 is one slot late, and its HBLANK 0–10 one slot long, against these documents.
- **H/2** toggles on each `/HSYNC` (DPC12 p. 12): it is the PAL line-alternation signal, and the PLL's
  half-line-rate comparison input (§2.2).
- **Blanking outputs colour 0, not the border.** While `/BLNK` is low the colour bus is forced to zero;
  the border register drives it only when `/BLNK` is high and the display is not active (DPC12 p. 15).
  In VSYNC mode `/BLNK` stays low all line (DPC12 p. 4, p. 12).
- *Inference for OQ8:* slots 56 and 0–9 are always blank on the output (no border, no picture),
  whatever the margins say; margin comparisons still happen there and still clock LD1 (§2.5). Slots 54
  and 55 are **not** blanked: they show border, or picture if the margins include them (§2.5). The
  guide's "practical" LM of 10 is the first unblanked slot, not only a TV-overscan limit. (Allow for the
  T7 retiming and the output register: the exact edge may sit a few 14M clocks later.)

### 2.5 Margins, LD1/LD2 and the pixel pipeline (settles N2)

- **Margins** (DPC12 p. 10): LM and RM are 6-bit and compared with the slot counter; the compare
  outputs are retimed by T7. Between them the chip's `/ACTIVE` is low — or, in VSYNC mode, `/VSYNC`.
  A right margin above 56 "is impossible", so `/VSYNC` can run on over several lines until a later LPB
  ends it; it can start or stop anywhere in a line, which is how interlace is made. This confirms the
  guide's VSYNC recipe and ep128emu's "RM ≥ 57 never matches".
- **One-slot pipeline, documented with diagrams** (DPC12 pp. 16–19; DPC11 p. 7): the bytes fetched in
  slot *n* are shifted out during slot *n* + 1. "Active on screen" (`/PICT`) is likewise one slot after
  `/ACTIVE`. With LM = 31, RM = 32 the fetch is in slot 31 and the 16 pixels appear in slot 32; border
  is shown on both sides. In PIXEL mode the second buffer's byte goes through an extra delayed bus (S′)
  so that PIXEL and character modes starting at the same margin line up on screen (DPC12 p. 6, p. 13).
  - **This confirms the FPGA core (§4.4) and contradicts ep128emu, CLK and MAME**, which put a slot's
    pixels in the slot that fetched them. For a static picture the difference is a uniform 16-pixel
    shift of picture *and* border edge; it matters for mid-line writes (a port write in slot *n* changes
    the border or palette 16 pixels earlier relative to the data than in ep128emu).
- **LD1 counting** (DPC12 p. 3, p. 13; ET1/1 Nov 84 p. 5, p. 10): LD1 is clocked from `/ULA` gated by
  `/ACTIVE` — twice per slot in PIXEL (an extra `/INCPIX` pulse), once in the other modes — and "only in
  the active part of the display". It is not gated by the LPB/refresh windows, so **when the margins
  include slots 0–7 or 54–56, LD1 still counts** although its address is not put on the bus there
  (DPC12 p. 13: LD1/LD2 may not drive the bus during `/PARMS` or refresh). This is ep128emu's quirk 4
  (NICK_VIDEO.md §11).
- *Inference:* the data buffers are loaded only at the end of `/VUL1`/`/VUL2`, which exist only outside
  the LPB and refresh windows (DPC12 p. 3, p. 13). In those slots the shifter therefore re-shows the
  buffers' previous contents (the last display bytes fetched), not the LPB or refresh byte on the bus.
  ep128emu shows "the last data byte from the bus" in slot 54; close, but not identical. With the
  one-slot pipeline, a line whose RM is above 54 shows slot 53's fetch in slot 54 and the buffers' stale
  bytes (slot 53's data again) in slot 55; slot 56 is blanked. At the left, slots 0–9 are blanked, so
  stale data there is never visible; only the LD1 advance is observable.
- **LD2 counting**: in ATTRIBUTE mode once per active slot; in character modes once per line, on
  `/CRST` (end of every line, including a block's last); not used in PIXEL/LPIXEL (DPC12 p. 3, p. 13).
  Loaded from the LPB at the start of each block (DPC12 p. 3). Same as ep128emu's "LD2++ then load if
  first line".
- **Character address generator** (DPC12 p. 13; ET1/1 Nov 84 pp. 5–6): CH256 = LD2[7:0] × 256 + code;
  CH128 = LD2[8:0] × 128 + code[6:0]; CH64 = LD2[9:0] × 64 + code[5:0]. Confirms NICK_VIDEO.md §4.4.
- **LPIXEL** puts the *same* LD1 address out in both halves of the slot and ignores buffer #2 (DPC12
  p. 13, p. 19; ET1/1 Nov 84 p. 6). **VSYNC mode** fetches "equivalent to the LPIXEL mode", the data
  unused (ET1/1 Nov 84 p. 6; DPC11 p. 10 printed 12) — so LD1 moves in VSYNC lines inside the margins,
  as ep128emu does.
- **Pixel clock** (DPC12 p. 9): PIXEL 2/4/16/256-colour = 14 / 7 / 3.5 / 1.75 MHz; LPIXEL, ATTRIBUTE
  (2-colour only) and character modes = 7 / 3.5 / 1.75 / 0.88 MHz. The divider is reset by `/CRST` at
  each line start, so it stays in phase with the buffer loads.

### 2.6 LPB fetch every line, VINT and VRES (settle OQ3; restate OQ2)

- **The LPB is read on every scanline.** DPC12 p. 10 (above), DPC11 p. 7 ("the 16 VDC slots after the
  beginning of /HSYNC" load 16 registers from the LPT), and ET1/1 Nov 84 p. 8, which says palette
  colours 0–7 are loaded from the LPT "at the start of each scanline". The LPT pointer advances only
  after the last line of a block (`/MLRST`, during `/CRST`, DPC12 p. 10), so every line of a block re-reads
  the same 16 bytes. **ep128emu is right; CLK and the FPGA core are wrong** (OQ3).
- What happens only on a block's first line: the scanline counter is loaded (it is clocked by the `/SC`
  strobe on every line and reloaded the line after its carry, DPC12 p. 10); LD2 is loaded; LD1 is loaded
  unless the line-by-line rule below says otherwise (DPC12 p. 3, p. 13).
- **VINT on the NICK side**: MB bit 7 drives the `/VIRQ` output pin directly (DPC12 p. 4, p. 12). It
  takes `/VIRQ` low "for the duration of the modeline", and "in conjunction with the DAVE chip this
  causes an interrupt to be generated at the beginning of the modeline" (ET1/1 Jan 84 p. 7 and Nov 84
  p. 7). DPC11's external timing diagram (p. 6) shows `/VIRQ` falling at the start of slot 0. Combining
  the two: `/VIRQ` falls in slot 0 of a VINT block's first line (when MB is strobed) and rises in slot 0
  of the first line after it.
  - **This is the "start of block" model (CLK, the guide)**, provided DAVE latches the *falling* edge of
    its INT1 pin. ep128emu and Xemu latch at the *end* of the block. They contradict the design documents
    unless DAVE's INT1 input is rising-edge sensitive on the pin — a DAVE fact these NICK documents do not
    give. The FPGA's "second line" model is contradicted either way.
  - *Inference:* ep128emu's author worked from real-machine tests (§5.1), so before switching, look up
    the INT1 edge in the DAVE documents (`docs/hardware/DAVE_ISSUE4/5.pdf`, `The_Dave_Chip.pdf`) and,
    if they are silent, run test 2 of §7.
- **VRES** (bit 4 of MB): the final documents say bit 4 = 0 means /VRES — LD1 **and LD2** are reloaded at
  the start of every line, so the line repeats (ET1/1 Jan 84 p. 9, Nov 84 p. 8). In August 1983 the bit
  had the opposite sense and was "mainly included as a test mode" (DPC12 p. 4, p. 12), and DPC12 still
  describes a fixed per-mode rule (LD1 reloaded each line in ATTRIBUTE and character modes, only per
  block in PIXEL/LPIXEL, p. 3, p. 13). The Jan 84 demo's equate still calls 10h "low vertical resolution"
  (p. 14) but its own LPT sets it for a 256-line full-resolution bitmap (p. 22). Use the final sense.
  - ET1/1's ATTRIBUTE description says LD1 "restarts from the same address for each scanline" (Nov 84
    p. 5). *Inference:* that describes VRES = 0 use; EXOS 2.0 allocates one attribute byte per bitmap
    byte for attribute pages (Video 2.0 p. 8: 9 × WIDTH × HEIGHT each), which needs LD1 to keep counting
    with VRES = 1. So ep128emu's rule (LD1 reloaded if first line or VRES = 0, in every mode) is the one
    consistent with both.
  - LD2 reloaded every line with VRES = 0 (final docs) differs from ep128emu, which reloads only LD1. It
    matters only in ATTRIBUTE mode with VRES = 0 (each line would then repeat the bitmap row too) and in
    character modes with VRES = 0 (LD2 would never step to the next font row — but every character mode
    is normally used with VRES = 0, which then cannot be right). *Inference:* the "and LD2" in the final
    text is loose wording carried over from DPC12; keep ep128emu's LD1-only rule and add the case to the
    test list.

### 2.7 Port 83h bits 6 and 7 (narrows OQ4)

- The register descriptions name the bits as signals: bit 7 = "/(load line parameter base)", bit 6 =
  "/(clock in line parameter base)", both normally 1 (DPC11 p. 8 printed 10; ET1/1 Jan 84 p. 2, Nov 84
  p. 2). DPC12 p. 3 calls them "special control output for the startup loading of the line parameter
  block counter"; p. 10 says the 12-bit LPB counter is loaded from the base when the RELOAD bit is set
  "or else if the user directly forces it" with these bits.
- The Jan 84 demo (p. 15) names the masks "Force *LOAD of LP counter low" (80h) and "Force *CLK of LP
  counter high" (40h) and performs the guide's sequence with the comments "ensure LP counter is loaded
  (clk=0, load=0)", "(clk=1)", "(load=1) then let it run".
- *Inference — a model that fits every document:* the LPB pointer is a loadable synchronous counter.
  Bit 7 = 0 holds its LOAD input active, so any clock edge loads the base instead of adding 16. Bit 6 = 0
  forces its clock line to one level, blocking the normal end-of-block clock; the 0→1 write of bit 6 then
  supplies one clock edge itself. The recipe (00 → 01 → 11 in bits 7,6) therefore loads the base at the
  second write, at once, mid-line; from the next line the LPB is fetched from the base.
  - **ep128emu's flag model gives the same visible result** (bit 6 rising arms an action at the end of
    the line: reload if bit 7 = 0, else advance by 16). It also predicts that a lone 0→1 of bit 6 with
    bit 7 = 1 skips to the next LPB — the counter model predicts the same. Keep ep128emu.
  - It contradicts the FPGA (bit 6 = 0 stops the whole horizontal counter) and Xemu (bit 7 resets slot
    and line counters), and CLK's rising-edge-of-bit-7 model.
  - With bit 7 held at 0 and bit 6 at 1, every block end reloads the base, so one LPB repeats — the FPGA's
    "bit 7 = 0 holds the LPT at the base" is then right for that state.
  - Still open: whether a forced clock mid-block also restarts the line counter and LD1/LD2 as a new
    block would (ep128emu: yes, the next line is a first line).

### 2.8 Colour output, palette, external colour, VC1

- **Colour pins**: R = PC0, PC3, PC6; G = PC1, PC4, PC7; B = PC2, PC5, most significant first; clocked
  out of a final 14 MHz register (DPC12 p. 7, p. 15). The Jan 84 demo's equates RED = 49h, GREEN = 92h,
  BLUE = 24h agree (p. 14).
- **256-colour formula** in all editions is linear (bit weights 4/7, 2/7, 1/7 and 2/3, 1/3) and "also
  occurs" for palette colours (ET1/1 Nov 84 p. 8; DPC11 p. 11 printed 13). The board's resistor DAC
  (§3.3) is what makes the real levels non-linear; the documents give the intended, not the measured,
  levels.
- **Palette 0–7** from the LPB each line; **8–15** = FIXBIAS bits 4–0 in the top five bits plus the
  index's low three bits (ET1/1 Nov 84 p. 8; DPC12 p. 15). In 256-colour mode the data byte bypasses the
  palette straight to the output (DPC12 p. 6, p. 15).
- **Undefined palette-bus bits are 0, and the ALT offsets are OR-ed onto them** (DPC12 p. 14): in 2-colour
  modes P1–P3 are 0 unless an ALT option sets one; MSBALT/ALTIND1 share a gate that sets P1 (+2),
  LSBALT/ALTIND0 one that sets P2 (+4). *Inference:* in 4- and 16-colour modes those same OR gates still
  act, as ep128emu's `render_Generic` assumes. ALT bits do not reach ATTRIBUTE mode, which drives the
  palette bus from the attribute nibbles only (DPC12 p. 14).
- **External colour** (EC0–EC3, /EXTC, priority 00–11): as in the guide (ET1/1 Nov 84 p. 2; DPC12 p. 15).
  If external colour wins while the internal mode is 256-colour, the chip forces 16-colour handling
  (DPC12 p. 6, p. 15). /EXTC is synchronised by a flip-flop on the ELITE plan (§2.12). Inert on a bare
  machine (OQ10, unchanged).
- **VC1 (FIXBIAS bit 7)**: the chip documents call it a general-purpose output "used for colour kill"
  (DPC12 p. 3; DPC11 p. 4) or "used to kill external colour" (ET1/1 both editions, p. 2). On the board it
  drives "sound control" (§3.2) and EXOS uses it to silence the speaker (§2.11). The pin was repurposed;
  bit 7 is the speaker mute.

### 2.9 Where the editions and the Programmer's Guide differ

| Item | DPC11/DPC12 (1983) | ET1/1 Jan 84 | ET1/1 Nov 84 (≈ Rev. E) | Programmer's Guide | Emulators |
|---|---|---|---|---|---|
| RM bits 7/6 | DPC11 p. 12 printed 14: **bit 7 = ALTIND1** (code bit 7 → colours 2/3), **bit 6 = ALTIND0** (code bit 6 → 4–7) | Same as DPC11 (p. 11); but the demo's equates (p. 14) say 80h "0→4" and 40h "0→2", the reverse | **bit 7 = ALTIND1, bit 6 = ALTIND0** (p. 9) | **b6 = ALTIND1, b7 = ALTIND0** | ep128emu follows the guide (NICK_VIDEO.md §3.2). CLK notes the ALT pairs "appear to have opposite effects". |
| LM bits 7/6 | MSBALT +2, LSBALT +4 in DPC11 and DPC12's gate text; DPC12's first paragraph (p. 14) has them the other way round | MSBALT (bit 7) +2, LSBALT (bit 6) +4 | Same | Same | All agree |
| 16-colour bit order | (d7,d5,d3,d1) / (d6,d4,d2,d0) (DPC11 p. 11 printed 13) | Same (p. 8) | **(d7,d3,d5,d1) / (d6,d2,d4,d0)** (p. 7) | b1,b5,b3,b7 = index bits 3..0, i.e. Nov 84 read least significant first | All emulators follow the guide |
| VRES sense | bit 4 = 1 is low resolution (DPC12 p. 12) | bit 4 = 0 is /VRES (p. 9), though the demo's comment keeps the old name | bit 4 = 0 is /VRES (p. 8) | bit 4 = 1 full resolution | All agree with Nov 84 |
| VM = 110 | Decoded to an "/UNUSED" line (DPC12 p. 12) | "unused at present"; the demo names it **TPIXEL, "future expansion"** (p. 14) | "unused at present" (p. 8) | "unused" | ep128emu: generic char mode with glyph FFFFh |
| LD2 in PIXEL/LPIXEL | "hoped" to set vertical pixel resolution later (DPC11 p. 12 printed 14) | Same | "not used" | "not used" | — |
| FIXBIAS bit 7 | colour kill | kill external colour | kill external colour | **disables the speaker** | ep128emu ignores it |

- **ALTIND is a real conflict.** The documents nearest to the shipped chip and the gate description in
  DPC12 put the "code bit 7 → +2" function on RM bit 7 (symmetrical with LM bit 7 = MSBALT → +2); the
  guide and ep128emu put it on RM bit 6. *Inference:* ep128emu's choice was presumably checked against
  EXOS's text screen (which relies on ALTIND1, Video 2.0 p. 6), so it is the safer default, but the
  question is new (§8, N8). An emulator mistake here swaps text colours 2/3 and 4–7 in IS-BASIC.
- **16-colour order**: the Jan 84 order is an earlier revision or an error; Nov 84 agrees with the guide
  and every emulator.

### 2.10 Video modes and mode 6 (OQ6)

- Only seven decoded modes plus an unused eighth: DPC12 p. 12 lists the decoder outputs /VSYN, /PIXEL,
  /CH256, /CH128, /CH64, /UNUSED, /LPIXEL (/ATTR is missing from that list by a slip; p. 4 has it). The
  Jan 84 demo reserves 0Ch as "TPIXEL" for future expansion. No document says what the chip outputs for
  VM = 6.
- *Inference:* because the 1983 design gives VM = 6 its own decoder output that nothing documented
  uses, the shipped chip most likely treats it as "no mode": which fetch path and colour path it gets
  depends on how the mode lines feed the LD1/LD2 enables, i.e. on the gate plans. OQ6 stays open.

### 2.11 EXOS's video setup in the driver specs (feeds §6)

- **LPT layout** (Video 2.0 p. 2; Video 2.1 p. 2, same text): one table at a fixed place in the driver's
  RAM; **28 LPBs of 9 scanlines** for the picture (LPB 0 = the status line, LPBs 1–27 = the 27 text-row
  windows that any page can be mapped into), "and various other ones" for frame sync and borders. All
  start blank (border). `LP_POINTER` points to the table. Pages are mapped in whole 9-line rows
  (`@@DISP`, p. 4); a closed page's rows are blanked "by bringing the margins in" (p. 4).
- **The VSYNC improvement** (VSYNC App. 2): a patch for EXOS 2.0 and 2.1 that "lengthens the period of
  vertical blanking". It writes, relative to `LP_POINTER` (read from segment FFh, 3FF4h/3FF5h, i.e.
  BFF4h): byte 480 ← 254, 496 ← 252, 499 ← 28, 512 ← 240, 528 ← 235. Read as LPBs:

  | LPB | Patched byte | New value | Meaning |
  |---|---|---|---|
  | 30 | SC | 254 | 2 lines |
  | 31 | SC | 252 | 4 lines |
  | 31 | RM | 28 | right margin 28, no ALTIND |
  | 32 | SC | 240 | 16 lines |
  | 33 | SC | 235 | 21 lines |

  *Inference:* the EXOS table has at least 34 LPBs: 0–27 for the 252-line picture, then six or more
  for the bottom border, the VSYNC block(s) and the top border. LPB 31 is most likely the VSYNC block
  whose right margin ends the sync pulse mid-line (RM 28 is about half a line). The exact stock values
  are still not documented; dump them (§6.2).
- **ST_FLAG** is checked on every interrupt; the driver sets the status LPB's margins accordingly
  (Video 2.0 p. 17).
- **BORDER and FIXBIAS are rewritten on every video interrupt.**
  - EXOS 2.0 (p. 18): BORD_VID → port 81h; BIAS_VID's top 5 bits → FIXBIAS bits 0–4; "the top bit" set
    from MUTE_SND, "used to silence the internal speaker".
  - EXOS 2.1 (pp. 17–18): adds the variable **SPRITE**, whose bottom two bits go to "the top two bits"
    of FIXBIAS (external-colour priority), and says **bit 5** comes from MUTE_SND (0 = speaker on,
    FFh = off). A hand note says SPRITE does not exist in 2.0.
  - The 2.1 text contradicts every chip document (priority = bits 6–5, VC1 = bit 7) and the 2.0 text.
    The EXOS book's "bit 5" (§5.1) evidently copies the 2.1 spec. *Inference:* the hardware says bit 7
    mutes; whether EXOS 2.1's code writes MUTE_SND to bit 7 or bit 5 needs a ROM trace (N5).
- **Text pages** (Video 2.0 pp. 6–7): hardware text uses the top bit of the code for palette 2/3
  (ALTIND1); software text (84 columns, PIXEL) uses bit 0 and bit 7 of each bitmap byte to choose
  colour pairs 0/1, 2/3, 4/5, 6/7 (LSBALT/MSBALT).

### 2.12 The ELITE gate-level plans (time-boxed)

- **3006-0000-22 is NICK.** The pad cells on the rendered sheets are NICK's signals: VW, PHI, /IOREQ,
  VRAS, VCAS, /VMUX, ACESS [sic], TEST3, /VSYNC, /HSYNC, H/2, /BURST, UA0–UA15 and UD0–UD7 on sheet 1;
  /VIRQ, /EXTCOL, TEST1, TEST2, EC0–EC3 on sheet 2. The title block is not on the rendered pages (both
  renders show only part of the drawing; the sheet 1 PDF was already noted as possibly truncated).
- Pad numbers on the plan (e.g. /VIRQ 54, /EXTCOL 28, TEST1 58, TEST2 67) are not the package pin
  numbers used on the board schematic (/EXTC = pin 46 there, §3.2). Do not mix them up.
- `/VIRQ` is a plain output buffer (cell OBAA) on internal net 1229; /EXTCOL goes through a D flip-flop
  (DFFQ, cell 508) before use, i.e. it is synchronised.
- Not attempted within the time box: tracing net 1229 back to the MB latch, the 83h logic, the LPB-latch
  enables, the clock-stretch logic and the mode-6 decode. The cell schematic uses AMI cell names (DFFQ,
  LTCH, COUNS, NNOD) and numbered nets; tracing one question takes several crops per net. It remains the
  route to settle OQ2's NICK side exactly, OQ4's mid-block detail, OQ5 and OQ6.

---

## 3. Hardware facts

### 3.1 The NICK clock: a phase-locked LC oscillator, not a crystal

Sources: Enterprise 64 motherboard schematic, sheet 3 "Nick, Video, Monitor Connector" (the
hand-redrawn `EP64-3-rajzolt.jpg`), from http://enterprise.iko.hu/schematics.htm via
http://web.archive.org/web/20250813123410/http://enterprise.iko.hu/schematics.htm ; MAME `ep64.cpp`
PCB notes.

- **There are only two crystals on the main board:** 8 MHz (the Z80 and DAVE) and 4.433619 MHz (by the
  LM1889). MAME's PCB layout and parts list show no third oscillator. MAME notes "POT2 … Probably used to
  fine-tune the video clock" (https://github.com/mamedev/mame/blob/master/src/mame/enterprise/ep64.cpp,
  header comment).
- **The schematic's 14 MHz circuit is an LC VCO.** Its parts:
  - transistor TR4 (2N3904) with an adjustable coil L2 and capacitors C28/C29 (47 pF) and C30 (330 pF);
  - an **MV2107 varicap (D7)** tuning the tank, fed through R73 (100 kΩ) and filtered by C27 (10 nF);
  - two 74LS04 inverters (U37) squaring the output.

  The squared signal is the "14M" line. It goes to NICK pin 53 (`14M`) and to the expansion bus pin B29
  ("14 MHz Clock (Nick)", agreeing with https://wiki.enterpriseforever.com/wiki/Expansion_Bus).
- **The varicap's control voltage comes from an XOR gate (U32, pins 4/5 → 6).** One input is NICK's
  `H2 REF` output (pin 51). The other is a squared copy of the LM1889's 4.4336 MHz crystal oscillator
  (X2, trimmed by C43), squared by TR5/TR6. The same squared subcarrier also seems to reach NICK's `PAL`
  pin (52).
  - *Inference:* this is a classic XOR phase detector plus loop filter plus VCO. NICK is **phase-locked to
    the PAL subcarrier**, which is what the preproduction wording quoted on the CLK wiki ("phaselocked")
    means. U32 is a 74LS86, which MAME's parts list includes.
  - *Inference from the redrawn sheet, not confirmed:* which of pins 51/52 is the output and which the
    input. **Answered by the design documents (§2.2):** `PAL` (52) is the 4.433 MHz input and `H2 REF`
    (51) is NICK's subcarrier ÷ 568 output (7805 Hz), meant to be compared with H/2. If sheet 3 really
    feeds the raw subcarrier into the XOR, re-check the drawing: the documents say the other XOR input
    is H/2 (pin 43).
- **What this means for OQ1** (*inference*, written before the design documents were read; §2.2 now
  settles OQ1 at 14 237 536 Hz and **overturns the "leans towards candidate 2" conclusion below**,
  which rested on the wrong assumption that the XOR compares at subcarrier frequency):
  - The clock is exactly a rational multiple of 4 433 618.75 Hz. It is not independent of the subcarrier,
    and it is asynchronous to the 8 MHz Z80 clock (two different crystals). The fractional-phase
    requirement in NICK_VIDEO.md §1.3 stands.
  - For an XOR detector to work, `H2 REF` must run at (or be compared at) the subcarrier frequency.
  - With candidate 2 (16/5 × fsc = 14 187 580 Hz), one 16-cycle slot is exactly 5 subcarrier cycles, a
    divider NICK can produce from its 16 internal phases. With candidate 1 (14 237 536 Hz), 228 NICK
    cycles equal 71 subcarrier cycles, which no small divider gives. The circuit therefore leans towards
    candidate 2.
  - Against that, every emulator, the RGBtoHDMI profile (§5.3) and the EXOS book's appendix use
    14 237 536 Hz (889 846 slots/s). The appendix has a measured feel but gives no method.
  - The two candidates differ by 0.35%: frames of 19.986 ms (50.04 Hz) against 20.056 ms (49.86 Hz).

### 3.2 NICK pins seen on the schematic

From sheet 3 (only the pins drawn there; NICK is a QFP72 per MAME's notes):

| Pin | Name | Direction / connection |
|---|---|---|
| 34–41 | PC0–PC7 | Colour byte out, through U33 (74LS244) to the RGB resistor DAC, and directly to the LM1886 R/G/B inputs |
| 31 | /BLANK | → LM1886 pin 9 |
| 42 | /BURST | → LM1886 pin 1 (burst gate) |
| 43 | H/2 | → LM1886 pin 2. *Inference:* the PAL line-alternation (half line rate) signal. |
| 44 | /HSYNC | → expansion bus A32, monitor A4 (through U31), CSYNC logic |
| 45 | /VSYNC | → expansion bus B30, monitor A5 (through U31), CSYNC logic |
| 46 | /EXTC | expansion bus A26, 680 Ω pull-up |
| 47–50 | EC0–EC3 | expansion bus A24, B24, A25, B25, each with a 680 Ω pull-up |
| 30 | VC1 | → U31 → "sound control" (FIXBIAS bit 7, speaker mute) |
| 51 | H2 REF | → PLL phase detector (U32) |
| 52 | PAL | subcarrier reference / PLL (see §3.1) |
| 53 | 14M | clock input from the VCO; also expansion bus B29 |

**Composite sync is made outside NICK.** U32's other XOR gates combine HSYNC and VSYNC into
`/CSYNC`, which goes to monitor pin B5 and, through R209 (1.5 kΩ), to the LM1886 SYNC pin 8.
*Inference:* an XOR of HSYNC and VSYNC is exactly "horizontal sync pulses inverted during vertical sync",
which the NICK guide describes (VSYNC-mode section). So the inversion is a by-product of the board's
CSYNC gate, and NICK's own HSYNC output keeps running during VSYNC.

### 3.3 Video output stage and colour levels

Schematic sheet 3; EXOS book connector appendix (`docs/Exos.htm`, "A monitor" section); MAME
`nick.cpp` `initialize_palette()`.

- **RGB monitor output.** PC0–PC7 go through a 74LS244 buffer and series resistors R64–R71 whose values
  are, in drawing order, 100, 100, 82, 220, 220, 220, 470 and 470 Ω. They are summed onto the R (B4),
  G (A1) and B (B3) pins.
  - *Inference:* mapped onto the colour byte (bit 0 = R MSB, 1 = G MSB, 2 = B MSB, 3 = R mid, 4 = G mid,
    5 = B LSB, 6 = R LSB, 7 = G LSB): R and G get 100/220/470 Ω for MSB/mid/LSB, and B gets 82/220 Ω for
    MSB/LSB. MAME uses the same values.
  - The EXOS book: "the green, blue and red signals are linear from 0 to 4 volts (not TTL signals)".
- **Relative levels** (*inference*: equal source voltage, outputs summed into a common load; the exact
  load is unknown):

  | Channel | Levels 0…7 or 0…3, normalised |
  |---|---|
  | R, G | 0, 0.128, 0.273, 0.400, 0.600, 0.728, 0.872, 1.000. The linear rule (n/7) gives 0, 0.143, 0.286, 0.429, 0.571, 0.714, 0.857, 1. |
  | B | 0, 0.27, 0.73, 1.00. The linear rule (n/3) gives 0, 0.33, 0.67, 1. |

  So the guide's linear formula is close for R and G, but **blue is noticeably non-linear on real
  hardware**.
- **Recommendation** (*inference*): offer MAME-style resistor weights as the default palette and the
  guide's linear one as an option. No measured RGB table of a real machine was found (see OQ-N3).
- **Mono composite (monitor A3).** R93–R95 (1.8 kΩ) and R96 (1 kΩ) mix the colour lines through TR7
  (2N3906) into a luminance-only signal.
- **PAL colour and RF.** The colour byte also drives **U34, an LM1886 "TV video matrix DAC"**, which
  takes R/G/B bit inputs plus /BLANK, /BURST, H/2 and SYNC. Its Y, B−Y and R−Y outputs feed **U35, an
  LM1889 PAL/NTSC modulator**, whose chroma oscillator is the 4.4336 MHz crystal. Composite video
  (TR8) goes on to the UM1233 RF modulator (U36).
  - A colour composite signal can be taken from TR8's base, using a spare monitor pin (B1)
    (https://wiki.enterpriseforever.com/wiki/Composite_color_video_out).
  - *Inference:* the composite path uses its own DAC, so composite colours differ from RGB colours. An
    emulator that offers a "TV" look must not reuse the RGB levels for it.
- **Monitor connector (EXOS book; MAME):**

  | Pin | Signal |
  |---|---|
  | A1 | G |
  | A2, B2 | 0 V |
  | A3 | mono composite |
  | A4 | /HSYNC |
  | A5 | /VSYNC |
  | A7 | left audio |
  | B3 | B |
  | B4 | R |
  | B5 | /CSYNC |
  | B6 | mode switch (Peritel) |
  | B7 | right audio |

  All syncs are TTL.

### 3.4 The NICK data bus

The EXOS book (`docs/Exos.htm`, §13 "Vezérlő regiszterek") explains the floating bus seen on port reads:

- NICK's ports are not built for reading, but a read goes through the same handshake as a write and
  waits the same way.
- NICK drives nothing, so the last byte NICK fetched stays on the video bus. There is no pull-up
  resistor there that would make an idle bus read FFh.
- The 74LS245 **U7** then passes that byte to the Z80.

This is the hardware basis for ep128emu's and CLK's "port read = last fetched byte".

### 3.5 The original chip plans (AMI)

The iko.hu schematic set (archived) includes, besides the four board sheets, AMI's design drawings of
both custom chips. The legend file `NICK-DAVE-Legend_to_Plans.txt` says:

| Chip | Code name | Drawing | Revisions |
|---|---|---|---|
| NICK | **ELITE** | 3006-0000-22, 2 sheets | original 29-09-1983; Rev. A 03-12-1983, B 03-01-1984, C 09-03-1984, D 30-05-1984, E 24-10-1984 (final) |
| DAVE | **ESPRIT** | 3007-000-22, 2 sheets | Rev. D final |

The low-resolution thumbnail of NICK sheet 1 shows a cell-level schematic with the AMI title block
"3006 – ELITE". It contains I/O pad cells around the edge, counter chains and register banks. It is far
too coarse to read at the archived JPEG resolution. The hi-res PDFs are now in `docs/hardware/`
(§9); what a time-boxed look at them found is in §2.12.

*Inference:* this is the most authoritative NICK source there is. The IS design documents (§2) have
since settled OQ1, OQ3 and OQ7 and most of OQ8 without it. Tracing the VINT output, the 83h logic, the
CPU clock-stretch logic and the mode-6 decode through it is what remains for OQ2 (NICK side, exact
timing), OQ4, OQ5 and OQ6.

---

## 4. FPGA re-implementation: Kyp069 / RetroWiki FPGA-Dev Team

Repository: https://github.com/Kyp069/ep (GPL-3.0-or-later per file headers). The NICK is `hdl/video.v`
(257 lines, © Kyp069 2023). Top level `hdl/ep.v`, DAVE interrupts `hdl/interrupts.v`, MiSTer PLL
`mister/rtl/pll56/pll56_0002.v`. Read only; described in our own words.

No other NICK FPGA core was found. Searches of GitHub: "enterprise 128", "ep128 fpga", "enterprise nick
dave". `andrastantos/unic` is a different project (a universal chip-replacement board). Also found,
`MeiKinosaki/Enterprise-128` (CC0, C++, created 2026-10-13): a new and unvalidated emulator, not a
reference.

### 4.1 Clocking

- The PLL makes 56.944444 MHz from 50 MHz. The pixel clock enable is a quarter of that, **14.236 MHz**,
  the closest it gets to 14 237 536 Hz; that is the target (`pll56_0002.v`, `ep.v` `ne14M`).
- The CPU runs from a separate 32 MHz domain (`clock32` / 8 for 4 MHz). So the core keeps NICK
  asynchronous to the Z80, as the hardware does.

### 4.2 Line structure

- One 10-bit counter counts 912 pixel clocks per line (0–911). The slot number is bits 9–4 and the
  sub-cycle bits 3–0.
- **Two VRAM fetches per slot, at sub-cycles 4 and 9.** The address for the first comes from LD1 in
  sub-cycles 0–4; the second uses the mode's second address in sub-cycles 5–9. Sub-cycles 10–15 have no
  NICK access.
- *Inference:* this matches the CLK wiki's "5 cycles first read, 5 cycles second read, 6 cycles Z80" in
  that order.
- There is **no vertical counter**: the frame is whatever the LPT says (NICK_VIDEO.md §1.3 agrees).

### 4.3 LPB fetch

- A `params` flag is set at the end of a line when the block ends (line count wrapped, or RELOAD), and
  cleared at the end of slot 7 (pixel clock 127).
- **The 16 LPB bytes are fetched in slots 0–7 only while `params` is set, so only on a block's first
  line.** On other lines, slots 0–7 are free for display fetches if the margins include them.
- The line count byte is loaded at the end of slot 7 and incremented each line; the block ends when it
  reaches FFh.
- LD1 is loaded at the end of slot 7 on the first line, or on every line when VRES = 0. LD2 is loaded on
  the first line, or on every line in ATTRIBUTE mode with VRES = 0. LD2 is incremented at the end of
  every line in the character modes.
- This agrees with CLK, not with ep128emu (OQ3). **The design documents contradict it:** NICK reads
  the LPB on every line (§2.6).

### 4.4 Pixel pipeline and margins

- Fetched bytes are latched. The shift register is loaded at sub-cycle 15 (sub-cycle 7 for the second
  PIXEL byte), so **a byte fetched in slot n is displayed in slot n + 1**. Border is shown when slot ≤ LM
  or slot > RM.
- *Inference:* a one-slot pipeline delay between fetch and display, which ep128emu does not model. It
  shifts the picture by 16 pixels relative to the border, and it affects where a mid-line BORDER or
  FIXBIAS write appears.
- LSBALT/MSBALT force the bits to 0 only in 2-colour mode. The +2/+4 palette offsets (from MSBALT/LSBALT,
  or ALTIND1/ALTIND0 in the character modes) apply in 2- and 4-colour modes. That is the same "OR the
  offset in" behaviour as ep128emu's generic renderer.
- 16-colour index bits are b1, b5, b3, b7 (agrees with the guide).
- The output pins send R = {bit0, bit3, bit6}, G = {bit1, bit4, bit7} and B = {bit2, bit5}, MSB first.
  This confirms the colour-byte layout in NICK_VIDEO.md §5.1.

### 4.5 Sync, blanking, VSYNC

- HSYNC is active in slots 1–4 and HBLANK in slots 0–10. VBLANK is any line in VSYNC mode.
- In a VSYNC line, VSYNC turns on at slot = LM and off at slot = RM, and is cleared on any non-VSYNC
  line. Same as the guide's recipe and ep128emu.

### 4.6 VINT

- The NICK's `irq` output is set at every line start from the **currently latched** LPB's VINT bit. That
  bit was fetched during the previous line, or several lines ago in a multi-line block.
- DAVE's latch (`interrupts.v`) samples `irq` at DAVE's 250 kHz tick and sets B4h bit 5 on its
  **rising** edge. B4h bit 4 reads the live level.
- *Inference:* the interrupt fires at the start of the **second** scanline of the VINT block (for a
  1-line block, the first line of the following block).
- The file's own comment says "bit5 changes to one if LPT pointer starts to read next LPB after LPB which
  contained VINT flag". The code and the comment disagree.
- The design documents put `/VIRQ` low from slot 0 of the block's first line to slot 0 of the line after
  it (§2.6), so the core's one-line lag contradicts them whichever DAVE edge is right.

### 4.7 Port 83h

- Bit 7 = 0: the LPT address is held at the base, and `params` is forced on.
- Bit 6 = 0: the horizontal counter is held at 0 (the whole NICK stops).
- *Inference:* a guess, not hardware-derived. ep128emu's model better fits the guide's recipe, and the
  design documents' "load"/"clock" naming of the two bits supports ep128emu (§2.7).

### 4.8 What the core does not model

- **No CPU contention.** The T80's `WAIT_n` is tied inactive, and video RAM is dual-ported in the FPGA.
- No floating data bus: ports 80h–8Fh are not readable; a read returns ordinary memory data.
- No VC1 speaker bit and no external colour.
- No DAVE memory wait states (BFh is not decoded).

It is therefore useful for slot structure and LPB fetch timing, and useless for OQ5.

---

## 5. Forum, documentation and measurement findings

### 5.1 The Hungarian EXOS book's hardware appendix (`docs/Exos.htm`)

The appendix reads like first-hand testing. EXISTING_EMULATORS.md attributes this kind of note to
István Varga (IstvanV), ep128emu's author.

- **VINT and B4h:**
  - B4h bit 4 "comes from NICK, and is a copy of the VINT bit read from the current LPB in the given
    line". The author adds that he thinks NICK re-reads it at the start of every line, but that it would
    be better to check this on a real machine.
  - "From this it follows that the video interrupt only happens at the start of the first line after the
    LPB that requested it, already without the VINT bit", and that two consecutive lines cannot both
    interrupt.
  - This is the "end of block" model, stated as a deduction.
- **Contention approximation:**
  - Video-RAM and NICK-port accesses are synchronised to 889 846 Hz.
  - Approximation: add 1.5 to the Z80 cycles since the previous video access, round up to a multiple of
    4.5, and take the difference in 0.5-cycle units.
  - Sample points: M1 read at 2.0 of 4 cycles, memory read/write at 2.5 of 3, I/O at 3.5 of 4.
  - DAVE wait states (BFh) have no effect on video RAM.
- **BFh:**
  - bit 2 = 1 means "wait only on M1 reads — this is the default mode";
  - bit 3 = 1 disables waits;
  - bit 0 = 1 decodes only segment FFh as video memory.
- **Port reads:** NICK ports wait like writes and return the last byte on the video bus through U7, a
  74LS245 (§3.4).
- **FIXBIAS and BORDER are rewritten by EXOS on every interrupt.**
  - BORDER comes from `BORD_VID`.
  - FIXBIAS is built from `BIAS_VID` (top 5 bits → bits 0–4), `MUTE_SND` (bit 5 in the book; *the guide
    says bit 7*) and the `SPRITE` variable (top 2 bits).
  - *Inference:* the book's "bit 5" for the speaker contradicts the port table in the same book (bit 7 =
    VC1). Treat it as a typo.

### 5.2 enterpriseforever.com and pouët

- No NICK timing-measurement thread could be found or fetched. The forum search pages are not indexed,
  and the threads that were reachable had no measurements.
  - "LPT (Line Parameter Table) questions", 2026-08:
    https://enterpriseforever.com/video-56/lpt-line-parameter-table-questions/
  - There, endi says EXOS TEXT80 is "a simple 2 colors bitmap mode with color tricks" (MSBALT/LSBALT),
    and BASIC's TEXT40 uses ALTIND.
- pouët "Enterprise DevCompo #1" (https://www.pouet.net/topic.php?which=10566), posts by geco:
  - the default BFh waits on M1, and writing 0Ch gives full speed;
  - the theoretical maximum height is 288 visible lines, and the maximum width 46 "characters" (slots);
  - EXOS keeps the LPT address at BFF4h/BFF5h;
  - ep128emu is "quite perfect, until this time one program made which runs only on real hardware".
    That program needs a Lua script in the emulator; it is not named.
- ep128emu's own state page (old, pre-2.0): DAVE was rebuilt from "extensive tests of a real Enterprise
  128". NICK "may not behave in the correct way if an unusual (e.g. interlaced display, excess number of
  lines etc.) line parameter table is encountered".
  https://ep128emu.sourceforge.net/html/ep128emu_state.html
- ep128emu release notes for 2.0.7: "more accurate Z80, video memory, and NICK I/O port timing … breaks
  demo compatibility", and "all possible video modes, including undocumented and 'invalid' ones, are now
  emulated". https://ep128emu.enterpriseforever.com/news/2-0-7/
- ep128emu commit history for `src/nick.cpp` and `src/ep128vm.cpp` (`gh api`). The NICK-relevant
  milestones:

  | Date | Commit | Message |
  |---|---|---|
  | 2007-04-16 | — | "Randomize NICK registers on start-up" |
  | 2007-10-30 | c968733151 | "Allow NICK display at slot 8 and 53" |
  | 2009-04-12 | 7f24a09401 | "Implemented all undocumented NICK video modes" |
  | 2009-06-17 | 94911a3e25 | "Fixed (hopefully) bits 6 and 7 of port 83h" |
  | 2009-07-23 | 8de441fb99 | "Minor adjustment to video memory timing" |
  | 2016-09-24 | 102654dd63 | "More accurate emulation of NICK floating data bus" |
  | 2016-09-24 | 43237ceeef | "Improved timing accuracy of NICK and DAVE port I/O (may break old demo files)" |
  | 2016-11-10 | 6937e47bde | "NICK emulation fixes and optimizations" (a refactor of the renderer) |

  None of the messages cites a measurement.

### 5.3 RGBtoHDMI's Enterprise profile (real-hardware capture)

`src/scripts/Profiles/6-12_BIT_RGB/Enterprise_+_Sam Coupe/Enterprise.txt` in
https://github.com/hoglet67/RGBtoHDMI (updated 2023-02-28). Field names are from `src/geometry.c`:

| Field | Value |
|---|---|
| sampling clock | **14 237 536 Hz** |
| line length | **912** |
| clock tolerance | 15 000 ppm |
| lines per frame | 312 |
| sync type | 4 |
| h_offset / v_offset | 104 / 32 |
| min capture size | 672 × 256 |
| max capture size | 720 × 270 |
| pixel aspect | 1:2 |

*Inference:*
- This profile is used on real machines, so a 912-cycle line sampled at the nominal clock does produce
  a stable picture.
- With 15 000 ppm of tolerance, though, it cannot tell 14.2375 MHz from 14.1876 MHz (0.35%). It does
  not settle OQ1.
- The 672–720 × 256–270 window is a good default for a cropped display (§6.3).

---

## 6. EXOS's standard LPT and video setup

### 6.1 What is documented

From `docs/Exos.htm`, video driver chapter and §7.2; pouët (geco); z88dk
`lib/target/enterprise/def/enterprise.def`:

- The video driver builds **one LPT at a fixed place in its absolute device RAM**.
  - It always has **28 LPBs of 9 scanlines each**: 1 status line + 27 text rows = 252 lines.
  - It also has "other parameters for producing the picture sync and the border", i.e. the VSYNC and
    blank blocks.
  - All 28 start "empty" (border-coloured).
- `LP_POINTER` (BFF4h/BFF5h, a Z80 address in segment FFh at page 2) points at the start of the LPT,
  whose first LPB is the status line. The tape driver uses it to change the status-line palette for its
  level meter.
- `ST_FLAG` hides or shows the status line. The video driver checks it on every interrupt and rewrites
  that LPB's margins.
- A page narrower than the screen is centred by its margins. Hardware text pages use CH128 with ALTIND1
  for colours 2/3. TEXT80 is PIXEL 2-colour with MSBALT/LSBALT colour tricks.
- `BORD_VID` → port 81h and `BIAS_VID`/`MUTE_SND`/`SPRITE` → port 80h are written **on every
  interrupt** (§5.1). Port 80h/81h writes therefore happen once a frame inside the EXOS interrupt, which
  matters for contention timing.

- **From the EXOS 2.0/2.1 video driver specifications** (`docs/hardware/ET11-10…`, `ET11-11…`; §2.11):
  the same 28 × 9-line picture LPBs "and various other ones" for sync and borders; pages map onto whole
  9-line rows; closed pages are blanked by pulling the margins in; ST_FLAG is applied every interrupt.
  EXOS 2.1 adds the variable SPRITE (external-colour priority) to the FIXBIAS value it writes.
- **From the "VSYNC improvement" note** (20 Feb 1985; §2.11): EXOS 2.0 and 2.1's sync was improved by
  patching LPBs 30–33: line counts 2, 4, 16 and 21 and RM = 28 in LPB 31. So the table has at least 34
  LPBs, with the sync and border blocks starting at LPB 28 (*inference*), and the stock values differ
  from these.
- **A complete, documented 312-line LPT from IS** (ET1/1 Jan 84 p. 22, the CP/M demo; not EXOS):

  | Lines | Mode | LM / RM | Purpose |
  |---|---|---|---|
  | 256 | PIXEL, 4-colour, VRES | 14 / 46 | picture (16 KB bitmap) |
  | 5 | LPIXEL | 63 / 0 | bottom border |
  | 10 | LPIXEL, black palette | 4 / 63 | start of vertical blanking |
  | 4 | VSYNC | 4 / 63 | sync starts at slot 4, runs on |
  | 1 | VSYNC | 63 / 4 | sync ends at slot 4 (4 whole lines of sync) |
  | 30 | LPIXEL, black palette | 4 / 63 | rest of vertical blanking |
  | 6 | LPIXEL, RELOAD | 63 / 0 | top border |

  Total 312 lines, no VINT. A useful second golden besides EXOS's own table.

### 6.2 What is not documented (gap)

None of the documents gives:
- EXOS's exact stock LPB sequence (top border lines, the VSYNC block, which LPB carries VINT, the
  bottom border);
- the margins EXOS uses (the guide's recipe suggests 10/52 or 8/54);
- the total of 312 lines as EXOS builds it.

The video driver specifications (now read, §2.11) describe the table only in words.
*Recommendation:* the plan should get this from the running emulator rather than from a document:
1. Boot EXOS with the user's ROM.
2. Read `LP_POINTER` at BFF4h.
3. Dump the LPBs up to RELOAD into a fixture, recording only the observed values; this is permitted
   under the oracle rule.
4. Use the dump as the golden for the "EXOS screen" test.

### 6.3 Visible area to present

| Source | Visible width | Visible height |
|---|---|---|
| NICK guide | 42 slots (LM 10 … RM 52) = 672 px practical | ≈ 256 usable of 287 non-sync lines |
| ep128emu | 48 slots (7–54) = 768 px | — |
| RGBtoHDMI | 672–720 px | 256–270 lines |
| geco | 46 slots | 288 lines (theoretical) |

*Recommendation (inference):* render the whole 912 × 312 (or 57 slots × 16) internally. Present a
cropped window of about 46–48 slots (736–768 px) × about 288 lines by default, with "TV safe"
(672 × 256) and "full" options. Display pixels are 2:1 (RGBtoHDMI v_aspect 2).

---

## 7. Test software for verification

The emulator should run these correctly. The demos are from https://ep128.hu/Ep_Demo/Demo_eng.htm (files
under `Prg/`), which lists about 250 demos.

| Program | Author, year | Exercises | Notes |
|---|---|---|---|
| **EXOS boot screen and IS-BASIC** | — | Standard LPT, VINT, status line, CH128 with ALTIND, BORDER/FIXBIAS per interrupt | Golden = the LPT dump of §6.2 |
| **Bad Apple!** | IstvanV, 2020 | Streaming video plus sound; VRAM bandwidth and contention | Written by ep128emu's author, so it surely runs in ep128emu |
| **FBScroll**, **Scroll** (tech demos) | IstvanV, 2013 | Smooth scrolling through LD1/margins; LPT rewriting | Same author |
| **Tunnel** | IstvanV, 2015 | Graphics / LPT effects | Same author |
| **Maze** | IstvanV, 2011 | Tech demo | Same author |
| **Nyan** | IstvanV, 2018 | — | Same author |
| **Interlace Demo 1/2/3**, **Zozolace**, **Christmas** | Zozosoft, 1993–2011 | 625-line LPTs, half-line VSYNC placement, field detection | The case ep128emu's state page lists as "unusual LPT" |
| **Farao Demo** | — | Interlace graphics | |
| **PJV Raster**, **PJV Intro 1/2** | Petyo, 2023–24 | Raster effects; mid-line or per-line palette, border and FIXBIAS writes; VINT timing | Recent, so likely developed on real hardware. Good for OQ2 and the pipeline delay (§4.4). |
| **Col 256 Demo** | Orksoft | 256-colour mode | |
| **IK+ Reloaded**, **Small Demo Part 7** | — | Mixed modes; named by geco as showcases | pouët thread |
| **The "runs only on real hardware" program** | unknown | Exact timing (needs a Lua script in ep128emu) | Ask on enterpriseforever.com. It is the best real-hardware discriminator known to exist. |

No published NICK conformance suite (in the style of a C64 VICE test suite) was found.

**Purpose-written tests that would settle the open questions.** These are Klive's own programs, run on
a real machine by a volunteer and recorded as results, under the oracle rule:

1. **OQ1 (clock):**
   - Count VINTs (one per 312-line frame) between DAVE 1 Hz interrupts over 100 s. The 1 Hz tick comes
     from the 8 MHz crystal.
   - Expect ≈ 5004 for 14 237 536 Hz and ≈ 4986 for 14 187 580 Hz. That is unambiguous and needs no
     instruments.
   - Alternative: a frequency counter on expansion pin B29 (14M).
2. **OQ2 (VINT edge):** a 3-line VINT block placed in a striped PIXEL area. The interrupt handler writes
   BORDER immediately. Compare the scanline where the colour changes with the block's first line, second
   line and the line after it.
3. **OQ3 (LPB re-read):** while a 100-line block is displayed, the CPU rewrites that block's palette
   bytes (8–15) and its mode byte in RAM in the middle of the block. With an every-line re-read the change
   appears on the next scanline; with a once-per-block read it waits for the next frame.
4. **OQ8 and §4.4:** a block with LM < 8 on its non-first lines, and LM = 7, 8 and RM = 54–57, with known
   data around LD1. It shows whether slots 0–7 or 54–56 display fetched data, floating-bus data or border,
   and whether pixels lag their fetch by one slot.
5. **OQ4:** the guide's forced-reload sequence, with each step separated by a delay and the screen
   observed after each.

---

## 8. New open questions

| ID | Question | What would settle it | Best default |
|---|---|---|---|
| N1 | ~~Which of NICK pins 51 (`H2 REF`) and 52 (`PAL`) is the PLL reference output, and what does NICK divide its clock by to make it?~~ | **Settled** (§2.2): pin 52 takes the 4.433 MHz subcarrier, pin 51 outputs subcarrier ÷ 568 (7805 Hz) for comparison with H/2. Remaining doubt: §3.1's reading of what the board's XOR compares. | — |
| N2 | ~~Is there a one-slot fetch-to-display pipeline delay (FPGA) or none (ep128emu)?~~ | **Settled: one slot** (DPC12 pp. 16–19, all modes; DPC11 p. 7). Dated Aug 1983, but the PIXEL/character alignment it serves is a basic design choice. Test 4 in §7 would confirm it on Rev. E. | **One-slot delay** (picture and border edge one slot after the margin compare) |
| N3 | Measured RGB output levels (the DAC's load and the 74LS244's high level) | A voltmeter on monitor pins B4/A1/B3 with a 75 Ω load, for each bit | Resistor-weighted levels of §3.3 |
| N4 | The exact LPT that EXOS 2.0/2.1 builds (VSYNC position, VINT position, margins) | Dump it from a running emulator with the user's ROM (§6.2) | — |
| N5 | Does FIXBIAS bit 5 really mute the speaker (EXOS book §7.2), or bit 7 (the guide, the EXOS book port table, and VC1 on the schematic)? | **Narrowed.** Hardware: every chip document puts VC1 on bit 7 and priority on bits 6–5 (§2.8); EXOS 2.0's spec mutes with "the top bit". The EXOS 2.1 spec says bit 5 for MUTE_SND and bits 7–6 for SPRITE, which is where the EXOS book's "bit 5" comes from (§2.11). Settle with a trace of EXOS 2.1's interrupt code. | **Bit 7** mutes (hardware). |
| N6 | How do composite colours differ from RGB colours (LM1886 matrix)? | The LM1886 datasheet's transfer tables | Only needed for a "TV" filter; low priority |
| N7 | Which program runs only on real hardware (geco, 2015)? | Ask on the forum | — |
| N8 | Which RM bit is ALTIND1 (character code bit 7 → colours 2/3)? ET1/1 (both editions) and DPC11 say **bit 7**; the Programmer's Guide and ep128emu say **bit 6** (§2.9). | Check the RM value EXOS's hardware-text page writes and how ep128emu shows it, or a 2-colour CH128 test with each bit on real hardware | ep128emu / the guide (bit 6), until checked |
| N9 | Does DAVE latch INT1 on the falling or the rising edge of NICK's `/VIRQ` pin? NICK's side is now known (§2.6); this decides OQ2. | The DAVE documents in `docs/hardware/` (DAVE_ISSUE4/5, The_Dave_Chip), the ESPRIT plans 3007-000-22, or test 2 in §7 | ep128emu (end of block) |
| N10 | With VRES = 0, are LD1 *and* LD2 reloaded every line (ET1/1 text), or only LD1 (ep128emu)? | Character modes with VRES = 0 need LD2 to keep counting, so the text is probably loose (§2.6). A CH128 block with VRES = 0 and VRES = 1 on real hardware | ep128emu (LD1 only) |
| N11 | When the Z80's request reaches NICK, and how many half-T steps each phase costs (the clock-stretch unit) | IS documents DPC08/DPC09 (not found), the ELITE plans' stretch logic, or ep128emu's tuned constants | ep128emu |

---

## 9. Documents worth adding to `docs/`

**Update:** the original design documents are now in the pack, in `docs/hardware/`, and are summarised
in §2: the ELITE plans (`3006-0000-22_Sheet-1.pdf`, `…Sheet-2.pdf`), the ESPRIT plans
(`3007-000-22_Sheet-1/2.pdf`), the legend (`NICK-DAVE-Legend_to_Plans.txt`), the board schematic
sheets (`EP64-1-0.jpg`, `EP64-1-RT.jpg`, `EP64-2-0.jpg`, `EP64-2-RT.jpg`, `EP64-3-rajzolt.jpg`,
`EP64-4--2.jpg`), IS's NICK documents (`NICK-Internal-timing-of-VDC-Elite.pdf`,
`NICK-Old-VDC-ELITE-description.pdf`, `ET1-1_84-01-17_The_Nick_Chip.pdf`,
`ET1-1_84-11-29_The_Nick_Chip.pdf`), the EXOS 2.0/2.1 video and sound driver specifications, the
VSYNC note, the bus-timing drawing `A3PER-1…`, `Enterprise-TechDesc.pdf`, the DAVE documents and
pinout sheets. Still missing: IS documents DPC08/DPC09 (the Z80 clock-stretch unit, cited by DPC12
p. 8) and DPCH/VDC/4 (cited by DPC11 p. 2).

The table below is the original list, kept for its URLs. The sizes are from the Wayback Machine's
HTTP headers on 2026-10-30.

| Title | URL | Size | Why |
|---|---|---|---|
| Enterprise 64 schematic, sheet 3: Nick, Video, Monitor Connector (redrawn) | http://web.archive.org/web/2025/http://enterprise.iko.hu/schematics/EP64-3-rajzolt.jpg (also `EP64-3~1.jpg`, 200/300/600 DPI TIFFs) | 536 KB JPEG | The NICK clock PLL, DAC resistors, LM1886/LM1889 and pin numbers (§3) |
| Enterprise 64 schematic, sheet 1: CPU, Nick, Dave, RAM, ROM, Clock, Power | …/schematics/EP64-1~0.jpg, `EP64-1-RT.jpg` | 845 KB / 735 KB | VRAM bus, the 74LS245 (U7), contention hardware, the 8 MHz clock |
| Sheets 2 and 4 (DAVE, connectors; keyboard, 128K RAM expansion) | …/schematics/EP64-2~0.jpg, `EP64-4-rajzolt&EP128INTERNALRAMEXPANSION-rajzolt.jpg` | ≈ 0.5–0.9 MB each | For the DAVE and storage notes |
| **AMI NICK ("ELITE") design plans, drawing 3006-0000-22, sheets 1–2** | …/schematics/3006-0000-22_Sheet-1.pdf, …/3006-0000-22_Sheet-2.pdf (JPEG previews `3006-0000-22_Sheet-1.jpg`, `…Sheet-2.jpg`) | Sheet 2 PDF 12.5 MB. Sheet 1 PDF archived at exactly 1 048 576 bytes, possibly truncated. Previews ≈ 450 KB. | **The authoritative NICK logic.** Settles most open questions. |
| AMI DAVE ("ESPRIT") plans, 3007-000-22 | …/schematics/3007-000-22_Sheet-1.pdf | 46.7 MB | For DAVE |
| Nick/Dave legend to plans | …/schematics/NICK-DAVE-Legend_to_Plans.txt | < 1 KB | The revision history (§3.5) |
| Schematic index page | http://web.archive.org/web/20250813123410/http://enterprise.iko.hu/schematics.htm | — | Lists everything above. The live site enterprise.iko.hu now returns 404. |
| LM1886 datasheet (National Semiconductor, "TV Video Matrix D to A") | https://www.alldatasheet.com/datasheet-pdf/pdf/86713/NSC/LM1886.html | ≈ 324 KB, 7 pages | The composite colour path (N6) |
| LM1889 datasheet (TV video modulator) | https://www.radioradar.net/datasheet_search/L/M/1/LM1889_NationalSemiconductor.pdf.html | small | The chroma oscillator that is NICK's PLL reference |

Licence note: the schematics and the AMI plans are scans of proprietary drawings hosted by fans. As with
the ROMs, check that they can be redistributed before copying them into the repository. Linking is safe.

---

## 10. Sources

- Local, in this pack, original design documents (`docs/hardware/`, §2): DPC12, DPC11, ET1/1 (17 Jan
  1984 and 29 Nov 1984), ET11/10 and ET11/11 (EXOS 2.0/2.1 video driver), the EXOS 2.1 VSYNC
  appendix, A3PER-1, the Enterprise technical description, and the ELITE plans 3006-0000-22.
- Local, in this pack:
  - `docs/Exos.htm`: the hardware appendix (B4h/VINT, BFh, contention approximation, NICK port reads,
    monitor connector), the video driver (LPT of 28 × 9 lines, `LP_POINTER`, `ST_FLAG`) and §7.2
    (BORD_VID / BIAS_VID per interrupt);
  - `docs/Technical_Documentation_Nick_Chip_Programmers_Guide.html`;
  - `NICK_VIDEO.md`, `DAVE_MEMORY_IO.md`, `EXISTING_EMULATORS.md`.
- Schematics:
  - index: http://web.archive.org/web/20250813123410/http://enterprise.iko.hu/schematics.htm ;
  - sheet 3 `schematics/EP64-3-rajzolt.jpg`; NICK plan preview `schematics/3006-0000-22_Sheet-1.jpg`;
  - legend `schematics/NICK-DAVE-Legend_to_Plans.txt` (all via the Wayback Machine).
- MAME, `src/mame/enterprise/ep64.cpp` header (PCB layout, parts list, connector pinouts):
  https://github.com/mamedev/mame/blob/master/src/mame/enterprise/ep64.cpp
- Kyp069 FPGA core, https://github.com/Kyp069/ep:
  - `hdl/video.v`, `hdl/ep.v`, `hdl/interrupts.v`, `hdl/memory.v`, `hdl/cpu.v`;
  - `mister/rtl/pll56/pll56_0002.v`.
- ep128emu:
  - `src/nick.cpp` (`Nick::runOneSlot`, re-checked) and `src/ep128vm.cpp`, raw from
    https://github.com/istvan-v/ep128emu ;
  - commit history via `gh api repos/istvan-v/ep128emu/commits?path=…`;
  - https://ep128emu.sourceforge.net/html/ep128emu_state.html ;
  - https://ep128emu.enterpriseforever.com/news/2-0-7/
- CLK wiki: https://github.com/TomHarte/CLK/wiki/The-Enterprise ("phaselocked" quote, the two clock
  candidates, the 5 + 5 + 6 slot split).
- RGBtoHDMI Enterprise profile:
  https://github.com/hoglet67/RGBtoHDMI/blob/master/src/scripts/Profiles/6-12_BIT_RGB/Enterprise_+_Sam%20Coupe/Enterprise.txt ;
  field order from `src/geometry.c`.
- Enterprise Wiki:
  - https://wiki.enterpriseforever.com/wiki/Composite_color_video_out ;
  - https://wiki.enterpriseforever.com/wiki/Sz%C3%ADnes_composite_videokimenet ;
  - https://wiki.enterpriseforever.com/wiki/Nick ;
  - https://wiki.enterpriseforever.com/wiki/Expansion_Bus
- Forums:
  - https://enterpriseforever.com/video-56/lpt-line-parameter-table-questions/ ;
  - https://www.pouet.net/topic.php?which=10566 (pages 1–2).
- Demo list: https://ep128.hu/Ep_Demo/Demo_eng.htm
- z88dk Enterprise definitions (`LP_POINTER` = BFF4h): `lib/target/enterprise/def/enterprise.def` in
  https://github.com/z88dk/z88dk
