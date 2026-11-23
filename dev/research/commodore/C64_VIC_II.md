# Commodore 64 / C128 VIC-II (656x / 856x): cycle-exact reference

Research notes for a cycle-accurate VIC-II in Klive's planned C/WebAssembly Commodore cores (C64 all
models, C128's VIC side). This file is facts, not a plan. It covers the chip family and per-model
timing (§1), the bus and the per-cycle memory access sequence (§2), the text/bitmap display, the border
and the pixel pipeline (§3), sprites (§4), interrupts and the light pen (§5), the tricks software
depends on (§6), colours (§7), the VIC's view of memory (§8), the registers (§9), test programs (§10),
existing implementations and their licences (§11), and what this means for the core (§12). §13 lists
disagreements between sources, §14 the open questions, §15 what is worth fetching later.

Conventions:

- **Bauer §x** = Christian Bauer, *The MOS 6567/6569 video controller (VIC-II) and its application in
  the Commodore 64*, 28 Aug 1996, present in this repository as `dev/research/vic-ii.txt` (no licence
  statement in the text). Section numbers are the article's own. It is the primary source for the
  internal model (VC/RC/VMLI, border flip-flops, sprite MC/MCBASE). Bauer says the model is the
  *minimal circuit that explains the observations*, not a schematic (Bauer §1).
- **VICE** = VICE `x64sc`'s cycle-exact VIC-II (`vice/src/viciisc/`), read through the GitHub mirror
  <https://github.com/VICE-Team/svn-mirror> (branch `main`, pushed 2026-11-22) on 2026-11-23. VICE is
  **GPL-2.0-or-later**: it was read for facts only, everything below is re-expressed in my own words
  and my own table layout, and no code or table was copied. File and function/table names are given
  for lookup. The old VICE engine (`vice/src/vicii/`, used by `x128`) is cited as "VICE-old".
- Cycle numbers are **1-based within a line, Bauer/VICE numbering** (cycle 1 = the cycle in which the
  raster IRQ of a normal line fires). "phi1" = first half of a cycle (VIC owns the bus), "phi2" = second
  half (CPU owns it unless AEC is held low). X = the 9-bit sprite X coordinate. Line = RASTER value.
- *Inference* marks my own conclusions; where sources disagree, both versions are kept and the
  disagreement is listed in §13.
- Nothing was downloaded into the repository. Source files read through `gh api` were viewed in the
  session scratchpad only.

---

## §1 The chip family and per-model timing

### §1.1 Variants

| Part | Process | Video | Used in | Notes (source) |
|---|---|---|---|---|
| 6566 | NMOS | NTSC | MAX Machine | Static-RAM variant, non-multiplexed address lines; uses `$D016` bit 5 (RES) to stop the chip (Bauer §2.3, §3.2; Wikipedia [W1]) |
| 6567R56A | NMOS | NTSC-M | Early NTSC C64 (1982 to early 1983) | 64 cycles × 262 lines; ceramic package; no separate luma/chroma (Bauer §3.4; [W1]) |
| 6567R8 (also R7 reported) | NMOS | NTSC-M | Later NTSC C64 | 65 cycles × 263 lines (Bauer §3.4). VICE model `MOS6567R8` |
| 6569R1 | NMOS | PAL-B | Earliest PAL C64 | "Usually gold-plated" [W1]; only 4 luma levels above black (Pepto [P1]); old light-pen IRQ behaviour (VICE, §5.3) |
| 6569R3, R4, R5 | NMOS | PAL-B | PAL C64 "breadbin" | 8 luma levels above black [P1]. VICE models only `MOS6569R3` for this group; no behavioural difference between R3/R4/R5 is documented in the sources read (OQ3) |
| 6572 | NMOS | PAL-N | Drean C64 (Argentina, Uruguay, Paraguay) | 65 cycles × 312 lines (VICE `chip_model_mos6572`; acme `vic.a` [A1]) |
| 6573 | NMOS | PAL-M | Brazil | No primary timing source found (OQ1); see §1.2 for the *inference* |
| 8562 | HMOS-II | NTSC | C64C / C64E boards | Timing of 6567R8; single +5 V rail [W1]; grey-dot bug (§3.7.3) |
| 8565 (R2 most common) | HMOS-II | PAL-B | C64C / C64E boards | Timing of 6569; grey-dot bug; different pipeline details (§3.7) |
| 8564 | HMOS | NTSC | C128 / C128D | "VIC-IIe": 48 pins, extra registers `$D02F`/`$D030`, generates the Z80 clock [W1] |
| 8566 | HMOS | PAL-B | C128 / C128D | PAL VIC-IIe |
| 8569 | HMOS | PAL-N | C128 (South America) | PAL-N VIC-IIe ([W1]; C64-Wiki "MOS Technology 8569") |

[W1] = <https://en.wikipedia.org/wiki/MOS_Technology_VIC-II> (read 2026-11-23).

### §1.2 Clocks

All models: the VIC divides its dot clock by 8 to make the system clock phi0, so **exactly 8 pixels
per CPU cycle** on every model (Bauer §2.3, pins φIN/φ0). The dot clock is derived from a crystal at
4× the colour subcarrier.

| Model group | Crystal (4×fsc) | Dot clock = | CPU clock (phi0) | Exact form |
|---|---|---|---|---|
| PAL-B (6569, 8565, 8566) | 17.734475 MHz | 7.881 988 889 MHz | **985 248.611 Hz** | crystal × 4/9 ; CPU = crystal / 18 |
| NTSC (6567R8, R56A, 8562, 8564) | 14.318 181 8 MHz (315/22 MHz) | 8.181 818 182 MHz | **1 022 727.273 Hz** | crystal × 4/7 ; CPU = crystal / 14 = 225/220 MHz |
| PAL-N (6572, 8569) | 14.328 225 MHz (4 × 3.58205625) | 8.187 557 MHz | **1 023 444.6 Hz** | CPU = crystal / 14 (*inference* from the subcarrier; VICE uses 1 023 440) |
| PAL-M (6573) | 14.302 446 MHz (4 × 3.575611) | 8.172 826 MHz | 1 021 603 Hz | *inference only* (OQ1) |

VICE's constants (`vice/src/c64/c64.h`): PAL 985 248, NTSC 1 022 730, old NTSC 1 022 730, PAL-N
1 023 440 cycles/s. Crystal values for PAL/NTSC: C64 service documentation and the dustlayer
"Tick tock" article [D1]; the PAL-N subcarrier 3.582056 MHz from Wikipedia "Crystal oscillator
frequencies". The PAL ratio (crystal/18) and NTSC ratio (crystal/14) are the well-known divider chains;
the arithmetic in the table is mine.

### §1.3 Frame geometry per model

| Model | Cycles/line | Lines/frame | Cycles/frame | Line time | Frame rate (from exact clock) | RASTER range |
|---|---|---|---|---|---|---|
| 6569 / 8565 / 8566 (PAL-B) | 63 | 312 | 19 656 | 63.943 µs | 50.1246 Hz | 0–311 |
| 6567R8 / 8562 / 8564 (NTSC) | 65 | 263 | 17 095 | 63.556 µs | 59.8261 Hz | 0–262 |
| 6567R56A (old NTSC) | 64 | 262 | 16 768 | 62.578 µs | 60.9928 Hz | 0–261 |
| 6572 / 8569 (PAL-N) | 65 | 312 | 20 280 | 63.511 µs | 50.4657 Hz | 0–311 |
| 6573 (PAL-M) | 65 (*inf.*) | 263 (*inf.*) | 17 095 | 63.63 µs | 59.76 Hz (*inf.*) | — |

Sources: Bauer §3.4 (PAL, both NTSC); VICE `vicii-chip-model.c` model structs (`cycles_per_line`,
`num_raster_lines`) for all four implemented models incl. 6572; MiSTer `video_vicII_656x.vhd` generics
(`mode6569`, `mode6567old`, `mode6567R8`, `mode6572`) agree. The video is **progressive** (no
interlace, no half line) on every model: each frame is a whole number of lines (Bauer §3.4 table;
*inference* from the line counts 262/263/312 with no field alternation in any source).

**Visible area and blanking** (Bauer §3.4, re-tabulated):

| Model | Visible lines | Vblank lines | Visible pixels/line | X at line start (raster IRQ) | First visible X | Last visible X |
|---|---|---|---|---|---|---|
| 6569 | 284 | 300 → 15 | 403 | $194 (404) | $1E0 | $17C |
| 6567R8 | 235 | 13 → 40 | 418 | $19C (412) | $1E9 | $18C |
| 6567R56A | 234 | 13 → 40 | 411 | $19C (412) | $1E8 | $184 |

So on NTSC, raster line 0 lies in the lower border, and the top border starts after line 40; on PAL,
line 0 is inside the vertical blank (Bauer §3.4 figure). VICE's "normal" visible window is PAL lines
16–287 and NTSC lines 28–274 counted with a +20 offset (`vicii-timing.h`), i.e. a display choice, not
hardware.

**Display window** (Bauer §3.4): RSEL=1 → lines 51–250 ($33–$FA, 25 rows), RSEL=0 → 55–246 ($37–$F6,
24 rows). CSEL=1 → X 24–343 ($18–$157, 40 columns), CSEL=0 → X 31–334 ($1F–$14E, 38 columns). The
matrix stays 40×25; only the border comparators move.

### §1.4 Behavioural differences between revisions

| Difference | Old NMOS (6567R56A, 6569R1) | NMOS 6567R8 / 6569R3+ / 6572 | HMOS 8562 / 8565 (and C128 parts, OQ5) |
|---|---|---|---|
| Luma levels | 5 incl. black (Pepto [P1]); VICE `new_luminances = 0` | 9 incl. black | 9 incl. black |
| Light-pen IRQ | Raised only by the re-trigger at frame start when LP is held low (VICE `lightpen_old_irq_mode = 1`, comment in `vicii-lightpen.c`) | Raised on every accepted trigger | Same as middle column |
| Colour-register write | No grey dot; the first pixel of the 8-pixel group still shows the old colour (VICE `draw_colors_6569`) | Same | **Grey dot**: first pixel shows colour $F (light grey) when it uses the register being written (VICE `draw_colors_8565`) |
| `$D011` ECM/BMM change in the pixel pipeline | Rising edge of a mode bit takes effect at pixel 4 of the group, falling edge at pixel 6 (VICE `vicii-draw-cycle.c`, `color_latency` branch) | Same | Whole new value at pixel 0 of the next group |
| Sprite multicolour flip-flop update | At pixel 7 (VICE `update_sprite_mc_bits_6569`) | Same | At pixel 6 (`update_sprite_mc_bits_8565`) |
| g-access address when `$D011` changes | Uses the current `$D011`, except a BMM→ROM switch mixes the old low byte and new high bits ("6569 fetch magic", VICE `vicii_fetch_graphics`) | Same | Uses the previous cycle's `$D011` (one-cycle delay) |
| Light-pen X offset (added to X/2) | +2 (VICE `x_extra_bits = 2`) | +2 | +1 |
| Cycle table | R56A has its own 64-cycle table | 6567R8 and 6572 share the 65-cycle table; 6569 its 63-cycle one | Same as their NMOS timing twins |
| Supply | +12 V and +5 V | +12 V and +5 V | +5 V only [W1] |

VICE's three model flags (`color_latency`, `lightpen_old_irq_mode`, `new_luminances`) in
`vicii-chip-model.c` are the complete list of revision differences VICE models; MAME additionally
distinguishes NMOS/HMOS per variant through a `process_traits` table in `mos6566.cpp`.

The early-chip "random pixels" bug that "some early games exploited" is mentioned by [W1] without a
source; nothing more specific was found (OQ4). Denise's bug tracker discusses an "old VIC-II chroma
effect on odd chars" (<https://bitbucket.org/piciji/denise/issues/1/>), which is an analogue-output
effect, not a logic one.

### §1.5 C128 VIC-IIe (8564/8566/8569)

- **`$D02F` (XSCAN)**: bits 0–2 drive output pins K0–K2, three extra keyboard column lines for the
  C128's extra 24 keys; bits 3–7 read 1 (VICE-old `d02f_store` ORs `$F8`; MAME `mos6566_device::write`
  the same). Readable and writable also in C64 mode (acme `vic.a` [A1]; [W1]).
- **`$D030`**: bit 0 = 2 MHz mode (system clock doubled for the 8502), bit 1 = "test" bit, bits 2–7 read
  1 (VICE-old ORs `$FC`, MAME the same). Neither VICE nor MAME implements the test bit (OQ6).
- In 2 MHz mode the VIC cannot fetch its data properly: [W1] says the picture shows "every second byte
  as a black hires bit pattern"; C128 BASIC's `FAST` blanks the screen through DEN (c128lib reference
  <https://c128lib.github.io/Reference/Vic>). MAME forces BA high while fast mode is on
  (`set_ba(1)` in `write`), i.e. the VIC's DMA no longer stalls the CPU. VICE-old sets `fastmode` and
  lets the C128 CPU run two cycles per VIC cycle. How refresh and BA behave at 2 MHz on real hardware
  was not found (OQ7).
- On the 8564/8566 the registers beyond `$D030` (`$D031`–`$D03F`) read `$FF` like on the C64 (VICE-old
  register masks).
- Timing (cycles/line, lines) equals the C64 twin: 8564 = 6567R8, 8566 = 6569 (acme `vic.a`).

---

## §2 Bus, phases and the per-cycle access sequence

### §2.1 Phases, BA and AEC

- The VIC and CPU share one bus: the VIC accesses in **phi1** of every cycle, the CPU in **phi2**. Both
  access the bus in *every* half cycle, even when the data is not needed (Bauer §2.4.3).
- When the VIC also needs phi2 (c-accesses in badlines, s-accesses of sprites) it pulls **BA** low
  **three cycles before** the first phi2 access; BA is wired to the 6510's RDY, which only halts the
  CPU on a read, and the 6510 never does more than three writes in a row (Bauer §2.3, §2.4.3).
- **AEC** normally follows phi2; from the fourth cycle after BA fell, AEC stays low in phi2 and the VIC
  drives the bus. If BA falls at an unusual time (forced badline), the first three c-accesses happen
  while AEC is still high: the VIC's D0–D7 drivers are tri-state and read `$FF`, and D8–D11 see the CPU
  data bus bits 0–3 through the analogue switch U16 (Bauer §3.14.3, §3.14.6). VICE models this as a
  3-cycle "prefetch" count after BA's falling edge: c-data = `$FF`, colour = low nibble of the byte at
  the CPU's PC (`vicii_fetch_matrix`); a sprite s-access during the prefetch window takes the CPU's
  phi2 bus value instead of memory (`sprite_dma_cycle_0/2`).
- *Inference*: the CPU stall is therefore "BA low and the CPU's next access is a read", resolved per
  cycle; a cycle-exact CPU core must expose whether each cycle is a read or a write.

### §2.2 Access types (Bauer §3.6.2)

| Code | Access | Phase | Width | Address |
|---|---|---|---|---|
| c | video matrix + colour RAM | phi2 (badline only) | 12 bits | VM13–VM10 · VC9–VC0 |
| g | character generator / bitmap | phi1 | 8 bits | depends on mode (§3.3) |
| p | sprite pointer | phi1 | 8 bits | VM13–VM10 · `1111111` · sprite number (last 8 bytes of the 1 KB matrix) |
| s | sprite data | phi2, phi1, phi2 (3 bytes) | 8 bits | pointer(8) · MC(6) |
| r | DRAM refresh | phi1 | 8 bits | `$3F00` + REF (REF 8-bit, reset to `$FF` in line 0, decremented per access; 5 per line) (Bauer §3.13; VICE `vicii_fetch_refresh`) |
| i | idle | phi1 | 8 bits | `$3FFF` (result discarded) |

In **idle state** the g-access reads `$3FFF`, or `$39FF` when ECM=1 (Bauer §3.7.1, §3.7.3.9).

### §2.3 Line sequence, PAL 6569/8565 (63 cycles)

My own layout of Bauer §3.6.3's diagrams, cross-checked against VICE's `cycle_tab_pal`. One row per
cycle range; "phi1/phi2" are the VIC's accesses.

| Cycle | phi1 | phi2 (only if sprite DMA / badline) | Notes |
|---|---|---|---|
| 1 | p3 | s3 | raster IRQ / RASTER increment in cycle 1 (line 0: cycle 2, §5.1) |
| 2 | s3 | s3 | |
| 3 | p4 | s4 | |
| 4 | s4 | s4 | |
| 5 | p5 | s5 | |
| 6 | s5 | s5 | |
| 7 | p6 | s6 | |
| 8 | s6 | s6 | |
| 9 | p7 | s7 | |
| 10 | s7 | s7 | |
| 11–15 | r ×5 | — | badline BA may fall from cycle 12 |
| 14 | (r) | — | VC ← VCBASE, VMLI ← 0, RC ← 0 if badline (§3.2) |
| 15 | (r) | c (1st) | MCBASE += 2 if Y-expansion FF set (Bauer); VICE checks sprite crunch here |
| 16–54 | g | c | 40 c-accesses in phi2 of cycles 15–54 |
| 16 | g | c | MCBASE += 1; DMA off if MCBASE = 63 (Bauer rule 8) |
| 55 | g (40th) | — | sprite DMA check #1, Y-expansion FF toggle (Bauer rules 2–3) |
| 56 | i | — | sprite DMA check #2 |
| 57 | i | — | |
| 58 | p0 | s0 | MC ← MCBASE, sprite display check; RC=7 → idle, VCBASE ← VC; RC++ (§3.2) |
| 59 | s0 | s0 | |
| 60 | p1 | s1 | |
| 61 | s1 | s1 | |
| 62 | p2 | s2 | |
| 63 | s2 | s2 | vertical border check (§3.5) |

The g-accesses are in phi1 of cycles 16–55 (VICE `FetchG`). The p-accesses happen **every line**,
whether or not the sprite is enabled; the s-accesses only when that sprite's DMA is on (Bauer §3.8.1).
Sprites 0–2 are fetched at the end of the line *before* the one where they show (Bauer §3.8.1).

### §2.4 Line sequence, NTSC 6567R8/8562 and PAL-N 6572 (65 cycles)

Same structure with two extra idle cycles at the end of the display part (Bauer §3.6.3 6567R8 diagram;
VICE `cycle_tab_ntsc`, shared by 6567R8, 8562 and 6572):

- Cycles 1–9: tail of sprite 3 and sprites 4–7 (p4 at 2, p5 at 4, p6 at 6, p7 at 8; the s-bytes follow
  as on PAL); cycle 10: idle; cycles 11–15: refresh; c in phi2 15–54; g in phi1 16–55.
- Cycles 56, 57, 58: idle. **p0 at 59**, p1 at 61, p2 at 63, **p3 at 65**, with s-bytes as on PAL.
- VICE places the sprite DMA checks at phi1 of 56 and 57 (PAL: 55, 56), the sprite display check at
  59 (PAL: 58); the VC update (14) and RC update (58) stay at the same cycle numbers. Bauer warns that
  his sprite cycle numbers "are only valid for the 6569" (Bauer §3.8.1).

### §2.5 Line sequence, 6567R56A (64 cycles)

VICE `cycle_tab_ntsc_old` and Bauer's 6567R56A diagram: like the 65-cycle line but **one idle cycle
fewer before the sprites**: g in 16–55, idle 56–58, p0 at 59, p1 at 61, p2 at 63 (s-bytes through 64),
p3 at **cycle 1**, p4 at 3 … p7 at 9, s7 ending in cycle 10, refresh 11–15. *Inference from the VICE
table*: R56A's sprite 3–7 slots sit at the same cycle numbers as PAL's, while the 65-cycle chips shift
them one cycle earlier (p3 in cycle 65 of the previous line).

### §2.6 Badlines (Bauer §3.5)

- **Badline condition**, evaluated at the start of any cycle: `$30 ≤ RASTER ≤ $F7` **and**
  `RASTER & 7 == YSCROLL` **and** DEN was 1 during *any* cycle of raster line `$30` in this frame.
- It is evaluated continuously: YSCROLL writes can create or remove it several times within one line
  (FLD, FLI, linecrunch, DMA delay, §6).
- Consequences: display state is entered (§3.1); RC is reset if the condition holds in cycle 14; BA is
  pulled low if it holds in cycles 12–54; the c-accesses run in phi2 of 15–54.
- VICE latches "badlines allowed" when DEN is seen set in line `$30` (`vicii_cycle_start_of_line` plus a
  per-cycle check during line `$30`) and clears it after the last DMA line `$F7`.

### §2.7 Cycles the CPU loses

Re-expressed from Bauer §3.6.3 and VICE's `BaFetch`/`BaSpr` columns (*my arithmetic*):

- **Badline only**: BA low cycles 12–54 (43 cycles). The CPU may still complete writes in cycles 12–14;
  it loses **40 to 43** cycles depending on its instruction stream (Bauer §3.5: "40–43").
- **Each sprite n with DMA on**: BA low for 5 cycles: 3 warning cycles + the 2 cycles whose phi2 carries
  s-bytes. PAL windows (cycle where BA falls → last BA cycle): s0 55→59, s1 57→61, s2 59→63, s3 61→2,
  s4 63→4, s5 2→6, s6 4→8, s7 6→10 (cycle numbers wrap at 63; sprite 3–7 windows end in the next
  line). 65-cycle chips: s0 56→60, s1 58→62, s2 60→64, s3 62→1 (p3 is in cycle 65), s4 64→3 … s7 5→9;
  R56A: s0 56→60, s3 62→2 (p3 in cycle 1), s7 6→10. Rule: BA falls 3 cycles before the sprite's p-access
  cycle and stays low through the cycle after it.
- **Overlaps**: adjacent enabled sprites share BA; two consecutive sprites cost 7 cycles, each further
  consecutive sprite +2. A single disabled sprite between two enabled ones does not give the CPU back
  any cycle (the 2-cycle gap is shorter than the 3-cycle warning); a gap of two disabled sprites frees
  one cycle (*inference from the BA windows*; the VICE testprog `VICII/spritesteal` measures this).
- Minimum loss per sprite is 2 cycles (when the CPU happens to write during the warning cycles), maximum
  5 when isolated (Bauer §2.4.3).
- Worst case PAL line (badline + 8 sprites): the CPU gets only a handful of cycles; exact count
  depends on the instruction mix (*inference*).

### §2.8 X coordinate of each cycle

The VIC has no readable X counter; positions were measured with the light pen and IRQ→LP wiring
(Bauer §3.6.1). Mapping (phi1 start of each cycle; VICE `cycle_tab_*` column `xpos`, agreeing with
Bauer's diagrams):

- **PAL**: cycle 1 starts at X `$194`; each cycle adds 8; cycle 13 covers `$1F4`; X wraps to 0 within
  cycle 13/14 (`$1F8`–`$1FF` never occur, X runs `$000`–`$1F7`, 504 values = 63 × 8); cycle 14 starts
  at `$004`, cycle 58 at `$164`, cycle 63 at `$18C`.
- **6567R8 / 8562 / 6572**: cycle 1 starts at `$19C`; cycle 13 at `$1FC`; cycle 14 at `$004`. 65 × 8 = 520
  positions but only 512 X values: VICE keeps X at `$184` for **two** consecutive cycles (62 and 63), so
  8 X values repeat; Bauer's 6567R8 diagram shows the same stall around `$184`.
- **6567R56A**: cycle 1 at `$19C`, 64 × 8 = 512 positions, every X value exactly once.
- Consequence (Bauer §3.4): sprites with X `$1F8`–`$1FF` are never displayed on PAL (floooh `m6569.h`
  makes the same note); on R8 the behaviour for the duplicated X values is OQ8.

---

## §3 The text/bitmap display

### §3.1 Idle and display state (Bauer §3.7.1)

- Display state: c- and g-accesses as configured. Idle state: only g-accesses, to `$3FFF`/`$39FF`,
  rendered in the current mode **with the c-data treated as 0** (Bauer §3.7.3.9).
- Idle → display: as soon as there is a badline condition (any cycle).
- Display → idle: in cycle 58, if RC = 7 and there is no badline condition.
- The VICE testprog `VICII/colorfetchbug/readme.txt` notes the display logic *recognises* a forced
  badline one cycle after the condition becomes true (written in cycle 15, active in 16, seen by the
  sequencer in 17). The VICE testprog `VICII/sequencer-bug` documents a case (Lft's "Shards of Fancy")
  where entering display state mid-line must not show garbage that a naive model shows.

### §3.2 VC, VCBASE, RC, VMLI (Bauer §3.7.2)

Registers: VC (10-bit counter loadable from VCBASE), VCBASE (10-bit register, loadable from VC, with
reset), RC (3-bit counter with reset), VMLI (6-bit index into the internal 40 × 12-bit line buffer).

1. VCBASE is reset to 0 somewhere outside lines `$30`–`$F7` (Bauer: "presumably line 0"; VICE: cycle 2
   of line 0 in `vicii_cycle_start_of_frame`, also clearing VC).
2. Cycle 14, phi1: VC ← VCBASE, VMLI ← 0; if badline, RC ← 0.
3. Badline in cycles 12–54: BA low; c-accesses in phi2 of 15–54 store into the line buffer at VMLI.
4. After each g-access in display state: VC++ and VMLI++.
5. Cycle 58, phi1: if RC = 7 → idle state and VCBASE ← VC. If in display state afterwards (always so
   with a badline condition), RC++.

The line buffer survives between lines: non-badline display lines re-read it (that is how a text row's
8 pixel lines reuse one c-access burst). VC wraps at 1024 (Bauer §3.14.4).

### §3.3 Graphics modes (Bauer §3.7.3)

Mode = ECM/BMM/MCM. c-data = 8-bit matrix byte D7–D0 + 4-bit colour nibble D11–D8.

| ECM BMM MCM | Mode | g-address | Pixel decode |
|---|---|---|---|
| 0 0 0 | Standard text | CB13–CB11 · D7–D0 · RC | 1 bit/pixel: 0 = `$D021`, 1 = colour nibble |
| 0 0 1 | Multicolour text | same | if nibble bit 3 = 0: as standard text with nibble bits 0–2; else 2 bits/pixel: 00 `$D021`, 01 `$D022`, 10 `$D023`, 11 nibble bits 0–2 |
| 0 1 0 | Standard bitmap | CB13 · VC9–VC0 · RC | 0 = matrix low nibble, 1 = matrix high nibble |
| 0 1 1 | Multicolour bitmap | same | 00 `$D021`, 01 matrix high nibble, 10 matrix low nibble, 11 colour nibble |
| 1 0 0 | ECM text | CB13–CB11 · 0 0 · D5–D0 · RC | 0 = `$D021`–`$D024` chosen by D7–D6, 1 = colour nibble |
| 1 0 1 | Invalid text | ECM address | multicolour text decode, output black |
| 1 1 0 | Invalid bitmap 1 | bitmap address with A9, A10 forced 0 | output black |
| 1 1 1 | Invalid bitmap 2 | same | output black |

- In the invalid modes the sequencer still produces foreground/background bits, so **collisions and
  sprite priority still work** (sprites with MxDP=1 are covered by black foreground pixels) (Bauer
  §3.8.2).
- Foreground/background classification depends **only on MCM**: MCM=0 → `1` foreground; MCM=1 → `10`
  and `11` foreground, `00`/`01` background, also in idle state (Bauer §3.8.2). Multicolour text cells
  with nibble bit 3 = 0 are single-colour, but VICE's `gbuf_mc_flop` handling shows the 2-pixel pairing
  is phase-locked to the scroll position.
- With ECM=1 the g-address has A9/A10 forced low (hence `$39FF` in idle state).

### §3.4 XSCROLL / YSCROLL

- YSCROLL (`$D011` bits 0–2) only decides which lines are badlines (§2.6); everything vertical follows.
- XSCROLL (`$D016` bits 0–2) delays the graphics sequencer's output by 0–7 pixels; the matrix and fetches
  do not move. To align with the window: YSCROLL 3/XSCROLL 0 for 25×40, both 7 for 24×38 (Bauer §3.4).
- *Inference from VICE's draw loop*: the sequencer loads its shift register when the pixel index within
  the 8-pixel group equals XSCROLL, so an XSCROLL write mid-line takes effect at the next load point
  and can drop or repeat pixels.

### §3.5 The border unit (Bauer §3.9)

Two flip-flops: **main border FF** (if set, border colour `$D020` overrides everything incl. sprites)
and **vertical border FF** (if set, the main FF cannot be reset, and the graphics sequencer output is
replaced by the background colour, so no sprite–background collisions occur there).

Comparators (exact-match, not ranges):

| Edge | CSEL/RSEL = 0 | CSEL/RSEL = 1 |
|---|---|---|
| Left (X) | 31 (`$1F`) | 24 (`$18`) |
| Right (X) | 335 (`$14F`) | 344 (`$158`) |
| Top (line) | 55 (`$37`) | 51 (`$33`) |
| Bottom (line) | 247 (`$F7`) | 251 (`$FB`) |

Rules: (1) X = right → set main FF. (2) In cycle 63, line = bottom → set vertical FF. (3) In cycle 63,
line = top and DEN=1 → reset vertical FF. (4) X = left and line = bottom → set vertical FF. (5) X = left,
line = top, DEN=1 → reset vertical FF. (6) X = left and vertical FF clear → reset main FF.

VICE checks these once per cycle: left at cycle 17 (CSEL=1) or 18 (CSEL=0), right at 56 (CSEL=0) or 57
(CSEL=1) on PAL (`check_hborder`), and the vertical comparisons in phi2 of every cycle with the
vertical FF copied at cycle 1; the sub-cycle pixel position is handled in the renderer. Bauer: the
border appears ~8 pixels later than the "Graph." projection in his diagrams (Bauer §3.6.3).

**Opening borders** (Bauer §3.14.1): top/bottom: with RSEL=1, wait until line 248–250, set RSEL=0 (the
comparator now wants 247, already passed), restore RSEL=1 after 251. Side: switch CSEL 1→0 exactly in
**cycle 56** (PAL); switching CSEL 0→1 in cycle 17 prevents the left border from opening. Opening the
side border inside the top/bottom border needs the vertical FF clear, which also decides whether the
opened area shows background colour or idle graphics.

### §3.6 DEN (Bauer §3.10)

DEN (`$D011` bit 4) gates badlines (must be 1 in some cycle of line `$30`) and the vertical FF reset
(rules 3, 5). DEN=0 → no badlines, whole screen border colour. Badlines already enabled stay enabled
if DEN is cleared later in the frame (*inference from the "any cycle of line `$30`" wording*; VICE
latches it that way).

### §3.7 Pixel pipeline and register-write visibility

The CPU writes a VIC register in phi2 of cycle N; the effect appears in pixels drawn later. Facts:

1. **Fetch-to-display delay**: graphics read in a g-access appear **12 pixels** later than their
   cycle's X (Bauer §3.6.1); the border unit acts ~8 pixels after the "Graph." position (Bauer §3.6.3).
2. **Colour registers** (`$D020`–`$D02E`): VICE applies the write at the start of the next 8-pixel group.
   On NMOS chips the group's first pixel was already resolved with the old value (one-pixel colour
   lookup latency), so the change shows from pixel 1; on HMOS 856x the first pixel shows **colour $F**
   if it is drawn from the register being written, the "grey dot" (VICE `draw_colors_6569/8565`;
   testprog `VICII/greydot`). Chameleon's FPGA core reportedly shows the new colour where the grey dot
   would be (<https://wiki.icomp.de/wiki/Chameleon_Core_Bugs>). A TED-side analogy (internal bus
   floating during the write) is discussed at <https://plus4world.powweb.com/ma.php?maid=1759>.
3. **`$D011` mode bits** (ECM/BMM): NMOS: a bit going 1 takes effect at pixel 4 of the group, a bit
   going 0 at pixel 6, so for two pixels both old and new bits combine (often an invalid mode → black);
   HMOS: the new value applies from pixel 0 of the next group (VICE `vmode11_pipe`).
4. **`$D016` MCM**: effective at pixel 4 of the group on all models (VICE `vmode16_pipe`), with the
   multicolour pair flip-flop reset when MCM rises.
5. **`$D018`/`$D011` for fetch addresses**: NMOS uses the current value for the g-access in phi1 of
   N+1; HMOS uses the value of one cycle earlier (VICE `reg11_delay`) (§1.4).
6. **Sprite priority/X-expansion** (`$D01B`, `$D01D`): latched at pixel 6 of the group (VICE
   `draw_sprites` section).
7. *Inference*: everything a CPU can change happens at most once per cycle, so a per-cycle VIC step
   that renders its 8 pixels with these fixed intra-group apply points is exact; no sub-cycle event
   queue is needed for C64 software.

---

## §4 Sprites (Bauer §3.8)

### §4.1 DMA and display (PAL cycle numbers; NTSC see §2.4)

Per sprite: 24-bit shift register, MC (6-bit counter), MCBASE (6-bit counter with reset), Y-expansion
flip-flop (Bauer §3.8.1, re-stated):

1. The expansion FF is held set while MxYE (`$D017`) = 0.
2. Cycle 55 phi1: if MxYE = 1, the expansion FF toggles.
3. Cycles 55 and 56 phi1: if MxE (`$D015`) = 1 and sprite Y = RASTER low 8 bits and DMA off → DMA on,
   MCBASE ← 0, and if MxYE = 1 the expansion FF is reset.
4. Cycle 58 phi1: MC ← MCBASE for every sprite; if DMA is on and Y matches RASTER low 8 → display on.
5. With DMA on: three s-accesses in the sprite's slots; bytes go to the shift register top, middle,
   bottom; MC++ after each.
6. Display on: shift starts when the X counter equals the sprite X; one bit per pixel, every other pixel
   with MxXE (`$D01D`); MxMC (`$D01C`) pairs bits.
7. Cycle 15 phi1: if expansion FF set, MCBASE += 2.
8. Cycle 16 phi1: if expansion FF set, MCBASE += 1; then if MCBASE = 63 → DMA and display off.

Consequences: Y register = desired first line − 1 (the DMA starts at the end of the line before), unless
the sprite's X is right of `$164` (cycle 58), where it shows in the same line (Bauer §3.8.1). Sprites
can be re-used vertically by moving Y after display (multiplexing); horizontally the shift register runs
empty after 24 (48) pixels, so at most 8 sprites per line.

VICE splits rule 7 into a crunch check at phi2 of 15 (`ChkSprCrunch`) and the MCBASE update at phi2 of
16 (`UpdateMcBase`); DMA checks at phi1 55/56 (PAL) and 56/57 (65-cycle), the expansion check at phi2 56,
the display check at phi1 58 (PAL) / 59 (65-cycle) (`cycle_tab_*` flags).

### §4.2 Sprite crunching and stretching

- **Stretching** (Bauer §3.14.7): toggling MxYE off and on after cycle 16 makes the VIC repeat a sprite
  line (×3 or more).
- **Crunching**: clearing MxYE in phi2 of cycle 15 while the expansion FF is reset makes MCBASE take a
  mixed value instead of the normal update. Linus Åkesson gives the resulting value as
  `((MC | MCBASE) & $15) | ((MC & MCBASE) & $2A)` (bit-wise mix of the two candidates)
  (<https://www.linusakesson.net/scene/lunatico/misc.php>). The sprite then ends only when MCBASE
  reaches 63 exactly, so some start bytes make it wrap and display again (VICE testprog
  `VICII/spritecrunch/readme.txt`, from the original "SCR" description, gives the step table per start
  byte). Bauer's simpler description (MCBASE += 1 only) is the special case of starting from 0.
- floooh `m6569.h` implements crunching in its `$D017` write handler (comment "sprite crunch: clearing an
  MxYE bit in cycle 15 …").

### §4.3 Priority and collisions (Bauer §3.8.2)

- Sprite–sprite priority fixed: sprite 0 highest. Sprite vs. graphics: MxDP (`$D01B`) = 0 → sprite in
  front of foreground; 1 → behind foreground, in front of background. Border covers everything.
- **Sprite–sprite** (`$D01E`): set when two or more sprite sequencers output a non-transparent pixel at
  the same time, **also outside the visible area and under the border**.
- **Sprite–background** (`$D01F`): set when a sprite pixel coincides with a foreground pixel of the
  graphics sequencer; not while the vertical border FF is set (sequencer output off).
- Both registers latch bits until read; reading clears them. An IRQ (§5) is raised only by the first
  collision after the register was zero.
- VICE detail: collision bits are accumulated pixel by pixel during drawing; a read schedules the clear
  for the following phi1 (`clear_collisions` in `vicii_cycle`), and the IRQ is raised only if the
  register was zero at the start of the cycle. VICE testprogs `spritecollisions`, `spritecollclear` test
  the exact latch point.

### §4.4 Other sprite behaviour

- p-accesses always happen, so changing a sprite pointer mid-display changes the remaining lines
  (Bauer §3.8.1).
- Disabling MxE mid-display does not stop an already running DMA (DMA ends only via rule 8)
  (*inference from rules 3/8*; VICE `spriteenable` test covers it).
- Multicolour sprite pixel pairing uses a per-sprite flip-flop updated at pixel 7 (NMOS) or 6 (HMOS)
  (§1.4).
- X wrap per model: §2.8.

---

## §5 Interrupts and the light pen

### §5.1 Raster interrupt

- RASTER compare value = `$D011` bit 7 : `$D012`. Writes set the compare line; reads return the current
  line (Bauer §3.2).
- The compare is made each cycle; the IRQ latch bit 0 is set when the comparison goes from *no match* to
  *match* (VICE `vicii_cycle`, "raster comparison goes from non-match to match"). So it fires in cycle 1
  of the matching line, and also immediately if software writes the current line's number (*VICE
  model*; widely relied on).
- **Line 0 quirk**: in line 0 the RASTER reset and the IRQ happen **one cycle later** (cycle 2) (Bauer
  §3.6.3; VICE `vicii_cycle_start_of_frame` at cycle 2; floooh: "cycle 1 of line 0 still reads as line
  311").
- Compare values beyond the last line (e.g. 312–511 PAL) never match.

### §5.2 IRQ registers

- `$D019` latch: bit 0 RST (raster), bit 1 MBC (sprite–background), bit 2 MMC (sprite–sprite), bit 3 LP;
  bits 4–6 read 1; **bit 7 = inverted IRQ output** (set when any enabled source is latched). Writing 1
  to a bit clears it; the VIC never clears it by itself (Bauer §3.12).
- `$D01A` enable: bits 0–3, bits 4–7 read 1. IRQ output = OR of (latch AND enable); level-triggered on
  the 6510, so the latch must be cleared before CLI/RTI.

### §5.3 Light pen

- A negative edge on LP latches X into `$D013` (upper 8 of 9 bits → 2-pixel resolution) and line into
  `$D014` (lower 8 bits) and sets latch bit 3 (Bauer §3.11).
- **Once per frame**: further edges are ignored until the next vertical blank (Bauer). VICE re-arms at
  cycle 2 of line 0 and, if LP is still low then, re-triggers with a fixed X (`$D1` on 63-cycle chips,
  `$D5` on 65-cycle; 64-cycle not settled, "TODO case 64" in `vicii-lightpen.c`). VICE ignores triggers
  in the last line except in its first cycle.
- LP shares the keyboard matrix line PB4 of CIA1, so software can trigger it by driving `$DC01` bit 4
  low (DDR `$DC03`), which is how the X position is read by software (Bauer §3.11). Also a joystick
  fire button on port 1 pulls it.
- Old chips (6567R56A, 6569R1) differ in when the LP IRQ is raised (§1.4).
- Latency: Bauer gives "trigger in cycle 20 → LPX = `$1E`" (reference = end of the trigger cycle);
  VICE delays a pin change by one cycle and adds a model-dependent offset (§1.4). Testprogs
  `lp-trigger`, `lpcoordinates`, `lplatency` exist to settle it (§13 D4).

---

## §6 Tricks software depends on

| Trick | Mechanism | Source |
|---|---|---|
| **Open borders** (hyperscreen) | Prevent comparator matches by switching RSEL (lines 248–250) / CSEL (cycle 56) | Bauer §3.14.1, §3.5 above |
| **FLD** | Hold back badline condition with YSCROLL; sequencer idles in between | Bauer §3.14.2 |
| **FLI** | Force a badline every line (write `$D011` from cycle 14 on) and switch `$D018` matrix; first 3 c-accesses read `$FF` + CPU nibble ("FLI bug", 3 characters = 24 pixels) | Bauer §3.14.3; testprog `flibug` |
| **Linecrunch** | Cancel the badline before cycle 14 in an already started badline: RC stays 7, VCBASE += 40 per line, VC wraps at 1024 | Bauer §3.14.4 |
| **Doubled text lines** | Badline condition in cycles 54–57 of RC=7 line: RC overflows to 0, line repeats | Bauer §3.14.5 |
| **VSP / DMA delay** | Force a badline in cycles 15–53 of an idle line: c-accesses start late, VC misaligned → horizontal scroll by whole characters; also via DEN in line `$30` with YSCROLL=0 | Bauer §3.14.6; testprogs `dmadelay`, `vsp-tester`, `vspbug` |
| **VSP crash** | The VIC switches its address from the idle `$3FFF` to an address ending in `$07` in the half cycle after the `$D011` write; RAS can latch a metastable row address and DRAM rows ending in binary 111 corrupt each other, hitting bytes at addresses ending in `$7`/`$F`; machine-, temperature- and power-on-phase-dependent | Linus Åkesson, "Safe VSP" (2013) <https://linusakesson.net/scene/safevsp/>; VICE simulates it optionally (`vicii-cycle.c`, "VSP bug", random weak pages), referencing VSP Lab <http://csdb.dk/release/?id=120810> |
| **Sprite stretching / crunching** | §4.2 | Bauer §3.14.7; Åkesson |
| **Sprite multiplexing** | Re-use sprites vertically by rewriting Y after display | Bauer §3.8.1 |
| **Idle byte `$3FFF`** | Graphics shown in idle state (upper/lower opened border, FLD gaps) come from `$3FFF` (`$39FF` with ECM) of the current bank | Bauer §3.7.1, §3.7.3.9 |
| **Floating bus / phi1 data** | Reading unconnected I/O (`$DE00`–`$DFFF`, and the upper nibble of colour RAM reads) returns the byte the VIC fetched in phi1 of that cycle on many machines; used to measure VIC timing in software, to run code from `$DE00`, and by some copy protections / sync loops ("not reproducible on all machines") | Bauer §4; VICE returns `vicii.last_read_phi1` (`vicii_cycle`) for such reads (`c64io.c`) |
| **Writing RAM at `$00`/`$01`** | The 6510 asserts R/W on writes to its port addresses; the RAM stores the byte the VIC read in the preceding phi1 | Bauer §4 |
| **Reading `$00`/`$01` RAM via sprites** | Bitmap at address 0 + 1-pixel sprite collision probing | Bauer §4 |
| **Raster-stable IRQ via light pen** | Trigger LP from CIA1 and read `$D013` to know the X position | Bauer §3.11 |
| **PAL colour mixing** | Alternate two equal-luma colours on adjacent lines; the PAL delay line blends them (§7.3) | *Common demo knowledge*; emulated by VICE's PAL renderer |

---

## §7 Colours and palettes

### §7.1 The 16 colours and luma levels

Index → name (Bauer §3.3): 0 black, 1 white, 2 red, 3 cyan, 4 purple, 5 green, 6 blue, 7 yellow,
8 orange, 9 brown, 10 light red, 11 dark grey, 12 medium grey, 13 light green, 14 light blue,
15 light grey.

Luma groups (Pepto's 2017 article [P1], on a 0–32 scale):

| Level | Later revisions (6569R3+, 6567R8, 856x) | First revision (6569R1, R56A per VICE) |
|---|---|---|
| 0 | black | black |
| 8 | blue, brown | red, blue, brown, dark grey (level 8) |
| 10 | red, dark grey | — |
| 12 | purple, orange | — |
| 15 | medium grey, light blue | — |
| 16 | green, light red | purple, green, orange, light red, medium grey, light blue |
| 20 | cyan, light grey | — |
| 24 | yellow, light green | cyan, yellow, light green, light grey |
| 32 | white | white |

Measured luma voltages on an 8565R2 (VICE testprog `VICII/luma-levels/readme.txt`): sync ~0.2 V,
black ~0.9 V, blue/brown ~1.3, red/dark grey ~1.4, purple/orange ~1.55, light blue/medium grey ~1.75,
green/light red ~1.85, cyan/light grey ~2.1, yellow/light green ~2.5, white ~3.3 V. The ordering matches
Pepto's 8-level table; the spacing differs from it (D6).

### §7.2 Chroma and the Pepto / colodore model

- Pepto (Philip Timmermann), "Calculating the color palette of the VIC II": first model 2001 ("pepto"),
  revised February 2017 as **colodore** (<https://www.pepto.de/projects/colorvic/>, tool at
  <https://www.colodore.com>). The 2017 model: hue = 11.25° + k × 22.5° (16 sectors) with k = purple 2,
  red/light red 4, orange 5, brown 6, yellow 7, green/light green 10, cyan 12, blue/light blue 15; greys
  have no chroma; one saturation for all colours; YUV → RGB with the standard PAL matrix; source gamma
  2.8 (PAL) to target 2.2 (sRGB); brightness/contrast/saturation defaults tuned to a 1084S monitor [P1].
- MAME ships a fixed RGB table in `mos6566.cpp` (`PALETTE_PAL`); VICE ships several `.vpl` palettes
  (pepto, colodore, community measurements) and can also compute colours from luma/angle tables
  (`vicii-color.c`). *Inference*: Klive should compute the palette from Pepto's luma/angle model per
  revision rather than ship a fixed RGB table, so the R1 luma set and the PAL blending (§7.3) fall out of
  the same code.

### §7.3 PAL delay-line blending

- A PAL decoder averages each line's chroma with the previous line's (64 µs delay line), cancelling
  phase errors; vertical colour detail is blended, which demos use for "mixed" colours (nesdev "PAL
  video" <https://nesdev.org/wiki/PAL_video>, general PAL background).
- VICE's PAL renderers (`vice/src/video/render2x2pal.c` and siblings) keep the previous line's
  chrominance and average it with the current line, with separate tables for odd lines and two
  user parameters "odd lines phase" and "odd lines offset" (modelling the phase error that produces
  Hanover bars) plus blur and scanline shade. *Inference*: a Klive implementation needs the VIC to
  emit colour **indices** per pixel and a separate composite/PAL stage that works on luma/chroma.
- NTSC has no delay line; VICE has separate NTSC renderers (`render*ntsc.c`).

---

## §8 Memory as the VIC sees it

- 14 address lines → 16 KB window. Bank = **inverted** CIA2 port A bits 0–1 (`$DD00`): `%11` → bank 0
  (`$0000`), `%10` → bank 1 (`$4000`), `%01` → bank 2 (`$8000`), `%00` → bank 3 (`$C000`) (Bauer §2.4.2).
- **Character ROM** appears at VIC addresses `$1000`–`$1FFF` in banks 0 and 2 (CPU view `$1000` and
  `$9000`), hiding the RAM there from the VIC; banks 1 and 3 see only RAM (Bauer §2.4.2). VICE
  `vicii_fetch` chooses ROM when `(addr & $7000) == $1000` in banks 0/2 (*my reading of
  `vicii-mem.c`/`vicii-fetch.c` "fetch from chargen" branch*).
- **Colour RAM**: 1 K × 4-bit static RAM addressed by VIC A0–A9, read on data lines D8–D11 during every
  c-access; therefore visible in every bank at every matrix address (Bauer §2.3, §2.4.2). When AEC is
  high, U16 connects D8–D11 to CPU D0–D3 (Bauer §3.14.6).
- **Ultimax mode** (cartridge GAME=0, EXROM=1): the VIC sees cartridge ROMH at `$3000`–`$3FFF` of each
  bank (VICE `vicii-fetch.c` "ROMH" branches). Relevant for cartridges; details belong to the C64 PLA
  research file.
- The CPU's view, PLA banking and I/O are not VIC topics (see the C64 memory research file).

---

## §9 Register summary (Bauer §3.2, notes re-stated)

| Address | Function |
|---|---|
| `$D000`–`$D00F` | Sprite X (low 8 bits) / Y pairs |
| `$D010` | Sprite X bit 8 |
| `$D011` | RST8, ECM, BMM, DEN, RSEL, YSCROLL |
| `$D012` | RASTER read / compare write |
| `$D013`/`$D014` | LPX / LPY |
| `$D015` | Sprite enable |
| `$D016` | bits 6–7 read 1; RES (bit 5, no function on 6567/6569; stops a 6566), MCM, CSEL, XSCROLL |
| `$D017` | Sprite Y expand |
| `$D018` | VM13–VM10, CB13–CB11; bit 0 reads 1 |
| `$D019`/`$D01A` | IRQ latch / enable (§5.2) |
| `$D01B`–`$D01D` | Priority, multicolour, X expand |
| `$D01E`/`$D01F` | Collisions (read clears, not writable) |
| `$D020`–`$D02E` | Border, background 0–3, sprite MC 0–1, sprite colours; upper 4 bits read 1 |
| `$D02F`–`$D03F` | Read `$FF`, writes ignored on C64 VICs; `$D02F`/`$D030` on VIC-IIe (§1.5) |

The 64 registers repeat every 64 bytes in `$D000`–`$D3FF` (Bauer §3.2). Unused bits read 1.

---

## §10 Test programs and documentation

| Item | What | Licence / status |
|---|---|---|
| **VICE testprogs**, `VICII/` | ~45 test folders: `D011Test`, `banking`, `border`, `colorfetchbug`, `colorram`, `colorsplit`, `dentest`, `dmadelay`, `fldscroll`, `flibug`, `frodotests`, `gfxfetch`, `greydot`, `lp-trigger`, `lpcoordinates`, `lplatency`, `luma-levels`, `movesplit`, `phi1timing`, `rasterirq`, `sb_sprite_fetch`, `screenpos`, `sequencer-bug`, `split-tests`, `sprite0move`, `spritebug`, `spritecollclear`, `spritecollisions`, `spritecrunch`, `spritedma`, `spriteenable`, `spritefetchbug`, `spritegap`, `spritemcbase`, `spritepriorities`, `spriterestart`, `spritesplit`, `spritesteal`, `spritetrash`, `spritevssprite`, `spritex`, `spritexpos`, `spritey`, `vicii_timing` (Peter Wendrich's combined mode/colour split test), `videomode`, `vsp-tester`, `vspbug`. Many have reference screenshots per chip model (`references/`). Driven by the `testbench/` scripts. | Separate SVN tree in the VICE SourceForge project; read via the mirror <https://github.com/libsidplayfp/VICE-testprogs> (pushed 2026-11-01). **No top-level licence file**; `readme.txt` gives none; tests are by many authors. Treat as "use as test inputs, do not redistribute in Klive" until each folder's authorship/licence is checked (OQ10). Running them as an external oracle is fine. |
| **Bauer's article** | Primary model (in repo `dev/research/vic-ii.txt`) | No licence statement; freely circulated since 1996 (cebix.net, zimmers). Cite, do not redistribute further |
| Marko Mäkelä, "The memory accesses of the MOS 6569 VIC-II and MOS 8566 VIC-IIe" ("PAL timing", 1994) | Software-measured per-cycle access tables via the `$DE00` phi1 trick; Bauer's diagrams are based on it (Bauer App. A [4]) | Text at <https://ist.uwaterloo.ca/~schepers/MJK/ascii/vic2-pal.txt>; no licence |
| Linus Åkesson, "VIC-II timing chart" | One-page PAL cycle chart <https://www.linusakesson.net/programming/vic-timing/victiming.pdf>; plus "Safe VSP", sprite crunch articles | Copyright the author; read only |
| dustlayer "VIC-II for beginners" series (2013) | Tutorial level; clocks, banks, screen modes <https://dustlayer.com> | Tutorial, not a timing source |
| codebase64.org VIC articles | Practical notes on stable rasters, FLI, sideborder, sprite multiplexing <https://codebase64.org/doku.php?id=base:vic> | Wiki, mixed authorship |
| **Wolfgang Lorenz test suite** (2.15) | Mostly 6510 and CIA tests; a few IRQ/NMI timing tests touch the VIC indirectly | Freeware, distributed inside VICE testprogs (`general/`); no explicit licence |
| C64 Programmer's Reference Guide App. N (6566/6567 data sheet) | Official register spec; Bauer notes its priority table is wrong (Bauer §3.8.2) | Commodore copyright |
| Original MOS 6567/6569 data sheet / preliminary spec | <https://www.cpcwiki.eu/imgs/e/ea/MOS-6567_6569-Video-Interface-Controller.pdf>, <https://www.cpcwiki.eu/imgs/1/1e/Mos_6567_vic_ii_preliminary.pdf> | Commodore/MOS copyright |

---

## §11 Existing implementations (licences verified 2026-11-23)

| Implementation | Where | Licence (how checked) | Models | Notes |
|---|---|---|---|---|
| **floooh chips `m6569.h`** | <https://github.com/floooh/chips/blob/master/chips/m6569.h> | **zlib** (API `Zlib`; header "zlib/libpng license, Copyright (c) 2018 Andre Weissflog") | 6569 PAL only (`M6569_HTOTAL 63`, `VTOTAL 312`) | Pin-level `m6569_tick` per cycle, header-only C, ~1 800 lines; badlines, VMLI line buffer, sprite crunch, collisions, light pen registers; no NTSC, no 856x differences, no grey dots. **Permissive** and C: the closest structural fit for a Klive C core |
| **floooh chips-test** (C64 system, tests) | <https://github.com/floooh/chips-test> | MIT (API) | — | Test harness around the chips |
| **Clock Signal (CLK)** | <https://github.com/TomHarte/CLK> | MIT (API) | **No C64 / no VIC-II**: `Machines/Commodore/` has `Vic-20`, `Plus4`, `1540`; `Components/` has `6560` (VIC-I), no 6569 | Relevant to the VIC-20/TED files, not here |
| **MAME `mos6566.cpp`** | `src/devices/video/mos6566.cpp` in <https://github.com/mamedev/mame> | **BSD-3-Clause** (file header; copyright Curt Coder). Repo API says `NOASSERTION` (mixed licences) | 6566, 6567, 6567R56A, 8562, 8564, 6569, 8565, 8566 device types (no 6572/6573) | Per-variant `raster_timing` and `process_traits` tables, VIC-IIe `$D02F/$D030`, fast mode. **Permissive**; accuracy below VICE (*inference*: not checked against the testprogs) |
| **VirtualC64** (Dirk Hoffmann) | <https://github.com/dirkwhoffmann/virtualc64>, `VCCore/Components/VICII/` | Core files **dual GPL-3.0-or-later OR MPL-2.0** (file header SPDX `GPL-3.0-or-later OR MPL-2.0`; repo `LICENSE`: app GPL-3+, core MPL-2.0, CPU "Peddle" MIT, reSID GPL-2+) | `PAL_6569_R1`, `PAL_6569_R3`, `PAL_8565`, `NTSC_6567_R56A`, `NTSC_6567`, `NTSC_8562` (`VICIITypes.h`) | Cycle-exact C++; MPL-2.0 is file-level copyleft: usable from an MIT project if the MPL files stay MPL and their source is offered. **Weak-copyleft option** |
| **VICE x64sc `viciisc`** | `vice/src/viciisc/` | GPL-2.0-or-later | 6569R1, 6569R3, 8565, 6567R56A, 6567R8, 8562, 6572 | The accuracy reference; passes most testprogs. **Facts only** |
| VICE-old `vicii` (x64, x128) | `vice/src/vicii/` | GPL-2.0-or-later | + VIC-IIe, DTV | C128 `$D02F/$D030` handling. Facts only |
| **Hoxs64** (David Horrocks) | <https://github.com/davidhorrocks/hoxs64> | GPL-3.0 (API) | PAL (6569/8565) | Windows, cycle-exact; facts only |
| **Denise** (PiCiJi) | <https://bitbucket.org/piciji/denise>, <https://sourceforge.net/projects/deniseemu/> | GPL-3.0 (SourceForge listing; separate 68k core MIT) | C64 models incl. old/new VIC | Cycle-exact; facts only |
| Frodo 4 (Christian Bauer) | <https://github.com/cebix/frodo4> | GPL-2.0 (API) | 6569 | Bauer's own single-cycle emulator "Frodo SC" was the test bed for his article (Bauer §1); facts only |
| zinc64 (Rust) | <https://github.com/digitalstreamio/zinc64> | GPL-3.0 (API) | — | Facts only |
| **MiSTer C64** (FPGA64 lineage) | <https://github.com/MiSTer-devel/C64_MiSTer>, `rtl/video_vicII_656x.vhd` | Top-level `c64.sv` is **GPL-2.0-or-later** (Sorgelig; "FPGA64 is Copyrighted 2005-2008 by Peter Wendrich"); the VIC-II VHDL header carries no licence text; API reports none | 6569, 6567 old, 6567R8, 6572 (generics) | Facts only; FPGA64's original terms are unclear (OQ11) |
| MiSTer C128 | <https://github.com/eriks5/C128_MiSTer> (MiSTer-devel fork) | No licence reported by API; inherits GPL from C64_MiSTer (*inference*) | VIC-IIe incl. `$D030` tricks (README) | Facts only |
| **VIC-II Kawari** (Randy Rossi) | <https://github.com/randyrossi/vicii-kawari> | GPL-3.0 (API) | Replacement FPGA chip emulating 6567R8/R56A and 6569R3/R1 | Hardware-validated in real C64s; facts only; docs in `doc/` |

**Permissive sources**: floooh `m6569.h` (zlib, PAL only) and MAME `mos6566.cpp` (BSD-3, all main
variants). **Weak copyleft**: VirtualC64's VICII (MPL-2.0 option). Everything with the best accuracy
record (VICE, Hoxs64, Denise, Kawari, MiSTer) is GPL.

---

## §12 Implications for the core (*inference* throughout)

1. **Time base**: the CPU cycle (phi0) is the natural VIC step on all C64 models; the dot clock is exactly
   8× it, so pixels need no separate clock. A step = phi1 (VIC fetch, border/raster/sprite checks,
   8 pixels) + phi2 (CPU access or VIC c/s-access). Model differences reduce to: cycle table (63/64/65),
   line count (262/263/312), first-line X, the three revision flags of §1.4, luma set.
2. **Half-cycle granularity is needed for the C128** in 2 MHz mode (the CPU also uses phi1) and for any
   cartridge/REU DMA that steals cycles; designing the step as two explicit halves now avoids a later
   refactor.
3. **Cycle tables as data**: one table per line length with per-cycle {phi1 fetch, phi2 fetch, BA mask
   contribution, X position, flags (VC update, RC update, sprite DMA/expansion/display/crunch/MCBASE
   checks, border L/R checks)} is what VICE, floooh and MAME all converge on. Klive's tables must be
   written from Bauer's diagrams and the facts in §2, not copied.
4. **CPU interface**: per cycle the CPU core must tell the VIC/bus whether the coming access is a read
   (for RDY/BA), and the VIC must expose BA one cycle ahead and the 3-cycle AEC delay; the "prefetch"
   c-data = `$FF` / colour = CPU-bus nibble rule needs the CPU's current phi2 bus value.
5. **Floating bus**: the VIC must publish the byte it read in phi1 each cycle for `$DE00`–`$DFFF`, the
   colour-RAM upper nibble and the `$00/$01` write quirk.
6. **Pixel output**: emit colour indices (0–15) per pixel at 8 per cycle into a line buffer covering the
   full X range (504/512/520 positions), then a separate palette/PAL stage (§7).
7. **Frame-level time ratios**: PAL CPU = 17.734475 MHz / 18 and NTSC = (315/22 MHz)/14 are exact
   rationals; the 1541 runs on its own 16 MHz/16 = 1 MHz clock, so the C64↔1541 ratio (e.g.
   985 248.6 : 1 000 000 on PAL) must be kept as a rational accumulator, not a float.
8. **Testing**: the VICE testprogs with per-model reference screenshots are the acceptance suite; run
   them through Klive's own harness without redistributing them (OQ10).

---

## §13 Disagreements between sources

- **D1 – Sprite check cycle numbers on NTSC.** Bauer gives the sprite rules with PAL cycle numbers only
  and says they are 6569-only; VICE's 65-cycle table moves the DMA checks to 56/57 and the display check
  to 59 while keeping VC (14) and RC (58) unchanged. No NTSC source by Bauer exists; MiSTer's VHDL is the
  second NTSC source to compare (not read in detail).
- **D2 – Where MCBASE is updated.** Bauer: cycle 15 phi1 (+2) and cycle 16 phi1 (+1, then the 63 check).
  VICE: crunch check in phi2 of 15, MCBASE update and 63 check in phi2 of 16. Åkesson's crunch formula
  (mixing MC and MCBASE bit-wise) is not in Bauer at all; Bauer's "crunch → MCBASE+1" description is a
  special case.
- **D3 – VCBASE reset moment.** Bauer: "presumably line 0, exact moment cannot be determined and is
  irrelevant". VICE: cycle 2 of line 0, together with VC, the refresh counter and the light-pen re-arm.
- **D4 – Light-pen X value.** Bauer: LP in cycle 20 → LPX `$1E`, measured at the end of the trigger cycle.
  VICE: one-cycle delay plus +1 (HMOS) or +2 (NMOS) to the halved X. These are not obviously the same;
  VICE's numbers were tuned against `lpcoordinates`/`lplatency` (*inference*).
- **D5 – Light-pen re-arm.** Bauer: "not released until the next vertical blanking interval" (PAL vblank
  starts at line 300). VICE: re-armed at line 0 cycle 2, with an immediate re-trigger (fixed X) if LP is
  still low; old chips raise the IRQ only then.
- **D6 – Luma levels.** Pepto's 2017 model uses 8 non-uniform levels (8, 10, 12, 15, 16, 20, 24, 32);
  the 8565R2 voltage measurement in VICE testprogs gives the same order but different spacing (e.g. the
  10/12/15/16 steps are 0.1/0.15/0.2/0.1 V). Different revisions and monitors are likely the reason.
- **D7 – Grey dot on other cores.** VICE shows colour $F on 856x; Chameleon's core shows the *new* colour
  there and its authors say some "new" VICs do not show grey dots either.
- **D8 – 6572 vs 8569 naming.** VICE/MiSTer call the PAL-N C64 chip 6572 ("Drean"); one source lists the
  6572 merely as "PAL-N", and the C128 PAL-N part is 8569. No timing disagreement.
- **D9 – FLI-bug colour.** Bauer: the first three c-accesses of a forced badline read colour = CPU data bus
  bits 0–3 (opcode after the `$D011` write); VICE takes the low nibble at the CPU's PC. The VICE
  `colorfetchbug` readme reports that in a linecrunch variant real C64s show the colour RAM colours, so
  the rule depends on the exact cycle (OQ9).
- **D10 – X wrap on 65-cycle chips.** Bauer's diagram and VICE agree that X stalls around `$184`; the exact
  sub-cycle placement of the stall (which 8 X values repeat) is only given by VICE's table (`$184` in
  cycles 62 and 63).

---

## §14 Open questions

- **OQ1** 6573 (PAL-M): cycles/line, lines/frame, crystal. *Inference*: 65 × 263 at ~1.0216 MHz
  (PAL-M = 525/60 with a 3.575611 MHz subcarrier). Needs a real-hardware or schematic source (Brazilian
  C64 boards); VICE and MiSTer do not model it.
- **OQ2** PAL-N exact CPU frequency: VICE uses 1 023 440 Hz; 14.328225 MHz / 14 = 1 023 444.6 Hz.
  Confirm the Drean crystal and divider from a schematic.
- **OQ3** Any behavioural difference between 6569R3, R4 and R5 (and 6567R7 vs R8)? None found.
- **OQ4** The "random pixels" bug of early revisions mentioned by Wikipedia: what it is, which chips.
- **OQ5** Do the C128's 8564/8566/8569 behave like 856x HMOS C64 chips (grey dots, pipeline) or like NMOS?
  VICE's x128 uses the old engine without those flags; MAME's `process_traits` may say (not read).
- **OQ6** Effect of the VIC-IIe `$D030` bit 1 "test" bit. No implementation emulates it.
- **OQ7** C128 2 MHz mode on real hardware: does the VIC still perform refresh and sprite/badline DMA,
  is the CPU slowed during refresh cycles, what exactly appears on screen? MAME forces BA high.
- **OQ8** Sprites positioned at the duplicated X values on 65-cycle chips (`$184`–`$18B`): shown once, twice,
  or truncated?
- **OQ9** Exact colour nibble read during the 3 AEC-high c-accesses (FLI bug) in all cases (D9).
- **OQ10** Licence/authorship of each VICE testprogs `VICII/` folder; whether Klive may vendor any of them
  (assume not).
- **OQ11** Original licence of Peter Wendrich's FPGA64 VIC-II (the MiSTer file carries no header).
- **OQ12** Exact pixel at which a `$D020`/`$D021` write appears relative to the writing cycle's X on each
  model (only VICE's model and the 12/8-pixel delays from Bauer are known); `VICII/colorsplit`,
  `vicii_timing` are the tests.
- **OQ13** Whether MAME's `mos6566.cpp` passes the key testprogs (would make it a usable permissive
  cross-check).
- **OQ14** Real-hardware chroma measurements per revision (angles/saturation) beyond Pepto's model.

---

## §15 Reference documents worth fetching later

1. Christian Bauer, VIC-II article — already in repo (`dev/research/vic-ii.txt`); original
   <https://cebix.net/VIC-Article.txt>.
2. Marko Mäkelä, "PAL timing" `vic2-pal.txt`, <https://ist.uwaterloo.ca/~schepers/MJK/ascii/vic2-pal.txt>,
   and the NTSC companion `6567desc.txt` in the same folder.
3. Linus Åkesson: VIC timing chart PDF; "Safe VSP"; sprite crunch / "Lunatico" notes (§10).
4. Pepto, "Calculating the color palette of the VIC II" (2017), <https://www.pepto.de/projects/colorvic/>.
5. VICE testprogs `VICII/` with reference screenshots (mirror <https://github.com/libsidplayfp/VICE-testprogs>),
   and the Chameleon test-result table <https://wiki.icomp.de/wiki/Chameleon_Test_Results> (which tests real
   chips pass/fail, per revision).
6. MOS 6567/6569 data sheet and preliminary spec PDFs (cpcwiki links in §10).
7. C128 Programmer's Reference Guide (VIC-IIe registers, FAST mode); C128 service manual (8564/8566 pins).
8. floooh `m6569.h` (zlib) for structure; MAME `mos6566.cpp` (BSD-3) for the multi-model tables;
   VirtualC64 `VCCore/Components/VICII/` (MPL-2.0) — the three implementations Klive could legally learn
   code structure from.
9. VIC-II Kawari docs (`doc/REGISTERS.md`, `doc/MODELS.md`) for hardware-validated replacement notes.
10. Stephen Edwards, VCF 2022 VIC talk slides <https://www.cs.columbia.edu/~sedwards/presentations/2022-vcf-vic.pdf>
    (die-level reverse engineering; check which VIC it covers).

[P1] Pepto, <https://www.pepto.de/projects/colorvic/> (v1, February 2017).
[A1] ACME assembler library `ACME_Lib/cbm/c64/vic.a` (register notes incl. VIC-IIe and per-model line
counts), e.g. <https://git.applefritter.com/6502/acme/raw/commit/07a7a00b1a01a09bb0506e5fb5c4aa23b55dfa52/ACME_Lib/cbm/c64/vic.a>.
[D1] dustlayer, "Hardware basics part 1: tick tock, know your clock",
<https://dustlayer.squarespace.com/c64-architecture/2013/5/7/hardware-basics-part-1-tick-tock-know-your-clock>.
