# HT-1080Z — Hardware Reference (research notes for a future Klive emulator)

Compiled 2026-10-21. Scope: the hardware only. ROM contents, BASIC, tape/disk file formats and
existing emulators are covered by separate notes and are mentioned here only briefly.

Conventions: every fact carries its source. **Inference** marks something concluded rather than
read. When sources disagree, both versions are kept (see §12).

Key short-names used for sources:

| Tag | Source |
|---|---|
| **[MAME]** | MAME `src/mame/trs/trs80.cpp`, `trs80_m.cpp`, `trs80_v.cpp` (master, fetched 2026-10-21) — https://github.com/mamedev/mame/tree/master/src/mame/trs |
| **[GENIE]** | *EACA Genie I/II Technical Manual*, 1982 (scan hosted by the HT site; downloaded: `docs/EACA_Genie_manual_1982.pdf`). The HT site states the first HT-1080Z is identical to the System-80 Mk I Blue Label, and that Hungarian schools used this manual for it. |
| **[HT-USER]** | *HT-1080Z iskolaszámítógép / HT-2080Z számítógép — Használati útmutató*, Híradástechnika Szövetkezet, print II/83 (`docs/ht1080z_hasznalati_utmutato_user_manual_hu.pdf`) |
| **[HT-64CHG]** | *HT-1080Z/64, HT-2080Z/64 — Változások a használati útmutatóhoz…* (`docs/ht1080z64_valtozasok_changes_hu.pdf`) |
| **[HT-EXP]** | *HT-1080Z számítógép bővítő egységek* (expansion units manual) (`docs/ht1080z_bovito_egysegek_expansion_units_hu.pdf`) |
| **[HT-SCH64]** | HT-1080Z/64 factory schematics, drawings Y04-4000/5000/6000 and the sound panel Y04-1000 (`docs/ht1080z64_schematic_*.pdf`) |
| **[HTSITE]** | ht.homeserver.hu — the Hungarian HT preservation site (Majzik István, Grósz Attila, Kollár Zoltán, Tóth Péter): `html/english.html`, `html/hardver1080valtozatok.html`, `html/hardverrom.html`, `html/hardverreszletek.html`, `html/hardverbovitesek.html` |
| **[RT84]** | Dr. Bagány Mihály, "A HT-1080Z iskolaszámítógép összekapcsolása a külvilággal", *Rádiótechnika* 1984/7–9 (`docs/radiotechnika_1984_0*_ht1080z_kulvilag_*_hu.pdf`) |
| **[S80]** | classic-computers.org.nz System 80 pages: https://www.classic-computers.org.nz/system-80/hardware_s80.htm, `hardware_mods.htm`, `other_guises_HT-1080Z.htm` |
| **[MISTER]** | HT1080Z/TRS-80 MiSTer core `rtl/trs80.vhd`, `rtl/videoctrl.vhd` — https://github.com/MiSTer-devel/HT1080Z_MiSTer (a port of József László's MiST HT1080Z core) |
| **[JOCO]** | József László's MiST HT1080Z core page, http://joco.homeserver.hu/fpga/mist_ht1080z_en.html |
| **[HUWIKI]** | https://hu.wikipedia.org/wiki/HT-1080Z |

---

## 1. Models and variants

### 1.1 Lineage

TRS-80 Model I (Tandy, 1977) → EACA "Video Genie" EG3003 / Genie I (Hong Kong), sold as the Dick
Smith System 80, PMC-80, TRZ-80… → **HT-1080Z**, a licensed Genie I built by Híradástechnika
Szövetkezet (Budapest), 1983–1986 [HTSITE english.html], [HUWIKI], [MAME trs80.cpp header].

- MAME's driver note: the ht1080z "is identical to the System 80, apart from the character rom";
  the ht1080z2 "has a modified extension rom and character generator" [MAME trs80.cpp, comment
  block "About the ht1080z"].
- MAME places all three HT machines as clones of `eg3003` and builds them on the `sys80p`
  configuration (50 Hz System-80) plus an AY-3-8910 [MAME trs80.cpp `trs80_state::ht1080z()`].
- HT site: the first version used original Hong Kong (EACA) boards, "supplemented with the
  AY-3-8910 sound generator and I/O expansion card"; the first HT-1080Z "agrees with the
  System-80 Mark I Blue Label" so its schematics can be used [HTSITE hardver1080valtozatok.html,
  hardverreszletek.html].
- 2,364 units were delivered to schools [HUWIKI]. Price 35,400 HUF in 1984 [HTSITE english.html].
- It was one of the first official Hungarian school computers, from the first school-computer
  tender [HUWIKI], [HTSITE english.html].

### 1.2 The variants

| Variant | Years | Distinguishing hardware (sources) | MAME set |
|---|---|---|---|
| **HT-1080Z (Series I, "első változat")** | from 1983 | Badge "HT-1080Z School-Computer". Genuine EACA boards + AY-3-8910 sound/I-O board with a blue rear connector. Built-in recorder (Video Genie type) with volume knob and level meter; keys RECORD, REW, FF, PLAY, STOP/EJECT, PAUSE. Rear: second-recorder DIN and monitor outputs; TV RF lead exits underneath. Boots to `READY ?` (Genie behaviour). BASIC and extension in mask ROMs. Extension (`SYSTEM` `/12288`) prints `NEW KEYBOARD ROUTINE ENABLE`; it adds lowercase, auto-repeat, flashing cursor, RENUMBER, monitor — no Hungarian accents [HTSITE hardver1080valtozatok.html, hardverrom.html]. 16K RAM [HTSITE english.html]. | `ht1080z` (1983) |
| **HT-1080Z Series II ("második változat")** | schools from 1984 | Fewer imported parts. Volume knob + meter replaced by one red LED, automatic level electronics. Improved recorder mechanism, big red RECORD key; key order REW, RECORD, STOP/EJECT, PLAY, FF. Boots to `READY ?`. BASIC still mask ROM (identical to Series I), extension now in EPROM, prints nothing. Accents: CLEAR+A/E/U/O (with SHIFT for lowercase) give Á É Ü Ö / á é ü ö; plain CLEAR moved to BREAK+CLEAR [HTSITE hardver1080valtozatok.html, hardverrom.html]. | `ht1080z2` (1984) |
| **HT-1080Z/64** | schools from 1985 | Badge "School-Computer HT 1080Z/64". **48 KB RAM** ("48 kByte operatív tároló") [HT-64CHG p.3], [HTSITE]. CPU board ("F panel") and video board ("E panel") redesigned by HT around domestically available parts [HTSITE hardverreszletek.html]; keyboard, sound panel and PSU unchanged. BASIC and extension both in EPROM. RF modulator moved inside near the back panel; video lead now exits underneath. Boots to `MEMORY SIZE?` then shows `BASIC 2.20`; extension prints `BASIC ROM EXTENSION 2.51`; full Hungarian set + math symbols via `'` prefix (see §5.5) [HTSITE], [HT-64CHG]. | `ht108064` (1985) |
| **HT-2080Z** (+ /64) | 1983–86 | Same specification, positioned as a business machine. ROM identical to HT-1080Z; some were built with Series I ROMs but the new recorder [HTSITE english.html, hardverrom.html]. | — |
| **HT-3080C** | prototype | Second-generation school-computer tender entry: 256×192 8-colour graphics, RGB, Centronics, function keys, Hungarian keys, ZX Spectrum BASIC program emulation. Prototype only [HTSITE english.html]. Not a TRS-80 derivative — out of scope. | — |

Note on "/64": the machine is named /64 but provides 48 KB of user RAM (see §3.2).

### 1.3 Differences from the TRS-80 Model I (summary)

| Item | TRS-80 Model I | HT-1080Z |
|---|---|---|
| Base design | Tandy | EACA Genie I / System-80 (Blue Label) |
| ROM | 12K Level II at 0000–2FFF | same 12K Level II (EACA 3001/3002/3003) + 1.5K extension at 3000–35FF [GENIE §1.2], [MAME ROM_START(ht1080z)] |
| Video standard | 60 Hz, 264 lines | 50 Hz, 312 lines (PAL-rate; RF on OIRT VHF ch.2) [GENIE §1.4.1], [HT-USER App. A] |
| CPU clock | 1.774 MHz (10.6445/6) | ≈1.77 MHz, from the same divide-by-6 scheme (§2) |
| 32/64 columns | software, port FF bit 3 | **hardware** "VIDEO CUT" switch + PAGE key; FF bit 3 has no display effect [GENIE §1.4.4.1], [MAME `screen_update_ht1080z`] |
| Lowercase | not without a mod | 8-bit video RAM, lowercase chargen; Hungarian accented glyphs (Series II, /64) |
| Printer | memory 37E8 | **I/O port FD** [GENIE "I/O port assignment"], [HT-EXP PR2] |
| Cassette select | 37E4 (expansion) | **I/O port FE bit 4**, internal recorder + external DIN [GENIE Table 1.1] |
| Built-in recorder | no | yes |
| Sound | none (cassette port only) | built-in speaker on the cassette-out bits **plus an AY-3-8910 at ports 1E/1F** |
| Expansion bus | 40-pin | 50-pin edge (Genie pinout) [HT-USER p.23] |
| Heartbeat interrupt | only with Expansion Interface | only with the EU7/FC expansion (§9) |

---

## 2. CPU and clocks

- Z80 (MK3880/Z80A class). On the /64 CPU board it is IC5 [HT-SCH64 F panel].
- **Clock derivation (Genie):** "The CPU operates at 1.77 MHz, derived from a crystal oscillator of
  10.644 MHz and a divide-by-six counter, Z38" [GENIE §1.1.1]. The same 10.644 MHz master clock
  is the video dot clock [GENIE §1.4.1, Fig. 1.5]. So CPU clock = dot clock / 6 = one CPU T-state
  per character cell.
- **HT-1080Z/64, traced on the schematics (2026-10-22):**
  - **Oscillator:** on the E panel (video board), crystal Q1 is marked **"10,6645 MHz"**. It is a
    two-inverter Pierce oscillator: IC26 74LS04 pins 11→10 and 13→12, with R1 and R2 of 1 kΩ and
    C14 of 220 pF. IC26 pins 9→8 buffer the output [HT-SCH64 E panel sheet 1, drawing
    Y04-6000-00-1E].
  - **Video:** the buffered clock feeds the E panel's own dot-clock counter, IC31 74LS92 CP0 (pin 14).
  - **To the CPU board:** the same clock leaves through link **LK1 "CK"**. It arrives on the F panel
    (CPU board) as **Cs2.1 "CLOCK"**. It passes through IC37 74LS367 (pins 6→7) into **IC38 74LS92
    input B (pin 1)**. That input drives the chip's ÷6 section, whose output QD (pin 8) goes
    through IC37 (pins 2→3, with R19 330 Ω) to the **Z80 Φ (pin 6)** [HT-SCH64 F panel,
    drawing Y04-5000-00-1E].
  - So **CPU = crystal ÷ 6 = 10.6645 MHz / 6 = 1.77742 MHz**, and the video dot clock is the
    crystal itself. A **"CLOCK/2"** (Cs2.7, from E panel LK7 "CK/2") also reaches the F panel, but
    it does not drive the Z80.
  - The schematic shows no other division, so the only question left is whether the crystal's
    marking is accurate. "10,6645" is written clearly. It could still be a draughting slip for
    10.6445, the TRS-80/Genie crystal, but nothing supports that.
  - **Line-count jumper:** on the same E panel, counter IC27 (74LS93) is reset by IC18 (74LS11)
    from Q3·Q0 and a jumper. The jumper selects Q2 (**"625"**: reset at 13) or Q1 (**"525"**: reset
    at 11). *Inference:* this selects the 50 Hz or 60 Hz frame length. 13 : 11 is the same ratio
    as the Genie's 312 : 264 lines (26 : 22 rows of 12 lines), so the board can make both
    standards, and HT machines were set to 625.
  - **Resulting /64 timing,** assuming the Genie's 672-dot line (the E panel's horizontal counter
    has not been traced): line = 672 / 10.6645 MHz = 63.01 µs (15.870 kHz); frame = 312 lines =
    34,944 T-states = **50.86 Hz**. With 10.6445 MHz the figures would be 1.77408 MHz,
    15.840 kHz and 50.77 Hz. The 0.19 % difference is below anything software can see, except
    exact tape speed and AY pitch.
  - **Series I/II:** these use genuine EACA boards (§1.2), so the Genie manual's **10.644 MHz**
    applies [GENIE §1.1.1]. No Series I/II schematic has been found. The /64 E panel is HT's own
    redesign around domestic parts, so a different crystal there is plausible (*inference*).
- Stated values in the literature (all kept, see §12):
  - 1.77 MHz — [GENIE §1.1.1], [HUWIKI], [HTSITE english.html]
  - 1.774 MHz — Real-80 / Real-80 PRO emulators [HTSITE english.html]
  - 1.78 MHz — [GENIE §6.1 bus signal list, "PHI 1.78 MHz Clock"]
  - 1.79 MHz — HT user manual's expansion-connector table ("PHI 1.79 MHz CLOCK") [HT-USER p.23]; also [S80 hardware_s80.htm]
  - 1.65 MHz — [JOCO] (an outlier)
  - MAME: `sys80p` sets the CPU to `10.48_MHz_XTAL / 6` = **1.7467 MHz**, inherited by `ht1080z`
    [MAME trs80.cpp `sys80p()`]; the 60 Hz `sys80` and the TRS-80 use `10.6445_MHz_XTAL / 6` =
    1.7741 MHz [MAME `level1()`].
  - MiSTer: 42.578 MHz / 24 = 1.774 MHz [MISTER trs80.vhd, `clk1774_div`].
- **What the two HDL cores actually do (checked in the source on 2026-10-22):**

  | Core (commit) | Master clock | CPU clock | Pixel clock | Raster | Frame | AY clock |
  |---|---|---|---|---|---|---|
  | MiST `ht1080z` (HT-specific), `ba57e3ca`, 2025-03-07 | 27 MHz × 14 / 9 = **42.000 MHz** (`pll.vhd`: `clk0_multiply_by => 14`, `clk0_divide_by => 9`, `inclk0_input_frequency => 37037` ps) | 42 / 24 = **1.750 MHz**: `clk42div` counts 0–23 and `cpuClkEn` is '1' at 0 (plus 12 in turbo) (`ht1080z.vhd` ll. 167–172, 402) | 42 / 4 = 10.5 MHz (`videoctrl.vhd` `clkdiv`, `clk10_5_en`) | `hctr` 0–671 = 672 clocks; `vend` = 311 at 50 Hz, 262 at 60 Hz (`videoctrl.vhd` ll. 424, 493) | 10.5 MHz / (672 × 312) = 50.08 Hz | The YM2149 runs on `ENA => cpuClkEn`, so it gets **the CPU clock, 1.75 MHz**, with `I_SEL_L => '1'` (no extra ÷2) (`ht1080z.vhd` ll. 287, 299) |
  | MiSTer `TRS-80_MiSTer` (a Model I fork of the MiST core), `bec5f720`, 2025-12-10 | 50 MHz → **42.578 MHz** (`rtl/pll/pll_0002.v` `output_clock_frequency0`) | `clk1774_div` counts down from 23, giving 42.578 / 24 = **1.77408 MHz** (`rtl/trs80.vhd` ll. 740–775; turbo ÷12/÷8/÷2) | 42.578 / 4 = 10.6445 MHz | 672 clocks; `vend` = 263 (`rtl/videoctrl.vhd` ll. 468–469) | 60.2 Hz (NTSC Model I) | `ym2149` `CE => cpuClk`, so **the CPU clock** (`rtl/trs80.vhd` l. 1087) |

  What this settles, and what it does not:
  - **Both cores keep CPU = pixel clock / 6** (÷24 against a ÷4 pixel clock), which gives **112 CPU
    cycles per 672-dot line**. That confirms the Genie ratio in §5.7.
  - **Both run the AY at the CPU clock**, not at MAME's 1.5 MHz guess. This matches the reading of
    the /64 sound-board schematic in §6.2.
  - **Neither is a measurement of the HT crystal.** MiST's 42.000 MHz is simply the nearest
    convenient PLL output from MiST's 27 MHz board clock. Its 1.75 MHz is a by-product of that
    PLL choice, not a value taken from HT hardware (*inference*: the author's page quotes 1.65 MHz,
    which matches neither).
    MiSTer's 42.578 MHz is exactly 4 × 10.6445 MHz, the **Tandy TRS-80 (NTSC) crystal**, and it
    runs a 60 Hz, 263-line raster, so it models the Model I and not the PAL HT.
  - So the VHDL does not settle the crystal. The candidates remain 10.644/10.6445 MHz (Genie
    manual; the /64 schematic prints "10,6645"), which gives a CPU clock of 1.774 MHz and 50.77 Hz
    with 312 lines, and MAME's 10.48 MHz, which gives 1.7467 MHz and 49.98 Hz.
- **Wait states:** none on internal memory. `/WAIT` is only brought out to the bus (pin 37,
  PWAIT, pulled up 4.7k) [HT-SCH64 F panel], [HT-USER p.23]. Video RAM access does *not* stall
  the CPU — it disturbs the picture instead (§5.6).
- **DRAM refresh:** done by the Z80's RFSH cycle; on the Genie RAS = /MREQ, MUX and CAS are made
  from the master clock by flip-flops Z40/Z39 [GENIE §1.3.1–1.3.3]. The /64 board has the same
  74LS74 chain (IC39/IC40) [HT-SCH64 F panel]. No emulator impact.
- **Interrupts (INT):** the base machine has **no interrupt source**. `/INT` only comes from the
  bus pin 31 (PINT, pulled up 4.7k) [HT-SCH64 F panel], [HT-USER p.23]. [JOCO]: "the HT does not
  detect vertical retrace and does not use interrupts". The Level II ROM runs in IM 1 (RST 38h),
  and MAME declares "IRQ mode 1" [MAME trs80.cpp header]. A 40 Hz / 25 ms heartbeat exists only
  with the floppy controller card of the EU7 expansion unit (§9.2).
  - MAME nevertheless installs `set_periodic_int(rtc_interrupt, 40 Hz)` in `level2()`, which
    `sys80`/`ht1080z` inherit [MAME trs80.cpp `level2()`, trs80_m.cpp `rtc_interrupt`] — i.e.
    MAME always behaves as if the expansion interface were attached. *Inference:* a bare HT should
    have no INT; an emulator should make the 40 Hz tick part of the expansion option.
- **NMI:** the rear **RESET button** drives `/NMI` (Genie: "System reset is done by pulling LOW
  the input of NMI … the CPU will re-start execution at location 0066H without altering the
  programs stored in memory") [GENIE §1.1.2]. On the /64: S1 RESET → 74LS132 (IC14) → 74LS05
  (IC2) → Z80 pin 17 `/NMI`; bus NMI pin 48 is wired to the same node [HT-SCH64 F panel].
  HT manual: the reset key on the right of the back panel returns to READY "without changing the
  memory contents" [HT-USER §8 p.15]. MAME: the "Reset" input feeds the `nmigate` input merger →
  `INPUT_LINE_NMI` [MAME trs80.cpp INPUT_PORTS `RESET`, `level1()`].
  - MAME's TRS-80 also ORs the Z80 HALT output into NMI (Model I behaviour), but `sys80()` removes
    it: `m_maincpu->halt_cb().set_nop()` with "TODO: asserts HLTA on expansion bus instead"
    [MAME trs80.cpp `sys80()`]. So on the HT, HALT does **not** cause an NMI.
- **Power-on reset:** RC network (C2 100 µF + diode D1) on `/RESET` pin 26 [GENIE §1.1.2],
  [HT-SCH64 F panel]. Bus pin 46 `/RESET` also resets the CPU.
- **RST usage:** standard TRS-80 Level II (RST 08h–30h BASIC helpers, RST 38h interrupt vector →
  RAM hook at 4012h). Not HT-specific; covered in the ROM notes.

---

## 3. Memory map

### 3.1 Address decode (Genie/HT Series I–II) — [GENIE §1.1.4, Fig. 1.2]

| A15 A14 A13 A12 A11 A10 | Range | Device |
|---|---|---|
| 0 0 0 0 x x | 0000–0FFF | ROM 1 (Z10, "3001") |
| 0 0 0 1 x x | 1000–1FFF | ROM 2 (Z11, "3002") |
| 0 0 1 0 x x | 2000–2FFF | ROM 3 (Z12, "3003") |
| 0 0 1 1 0 x | 3000–37FF | EPROM Z13 (2716, 2K; 1.5K used: 3000–35FF) |
| 0 0 1 1 1 0 | 3800–3BFF | Keyboard |
| 0 0 1 1 1 1 | 3C00–3FFF | Video RAM (1K) |
| 0 1 x x x x | 4000–7FFF | 16K RAM (4116) |
| 1 x x x x x | 8000–FFFF | "For expansion" |

The HT user manual reproduces the same map: 0000–2FFF ROM BASIC, 3000–35FF EPROM (1.5K),
3800–3BFF reserved for keyboard, 3C00–3FFF video, 16K RAM to 7FFF, then "bővítésre" (for
expansion) to FFFF [HT-USER App. B p.24].

### 3.2 HT-1080Z/64 board

- ROMs: IC13 = 2716 (extension), IC10–IC12 = 2532 (3 × 4K BASIC) [HT-SCH64 F panel].
- RAM: eight MK4164 (64K × 1) DRAMs, IC27–IC34, multiplexed by 74LS157s; decode by 74LS156
  (IC22), 74LS139 (IC25), 74LS20/32 [HT-SCH64 F panel].
- User RAM is **4000–FFFF (48K)** [HT-64CHG p.3: "48 kByte operatív tároló"].
- *Inference:* the 4164 array is physically 64K, but no documented mechanism exposes the 16K that
  lies under ROM/I-O at 0000–3FFF; nothing in the manuals mentions paging. "/64" most likely names
  the chip size. Treat as an open question (§12).
- MAME's `ht108064` uses the same 48K `m1_mem` map as the others (RAM 4000–FFFF) and its own
  BASIC ROMs `3001_64.z10`/`3002_64.z11` [MAME trs80.cpp ROM_START(ht108064)].

### 3.3 MAME's map (all HT sets) — [MAME trs80.cpp `trs80_state::m1_mem`]

| Range | MAME handler |
|---|---|
| 0000–37FF | ROM (region 0x3800; 3000–37FF is the 2K extension image) |
| 37DE / 37DF | UART status/data (TRS-80 RS-232 at memory; the System 80 really uses ports F8/F9) |
| 37E0–37E3 | read: IRQ status latch (`irq_status_r`); write: drive select / motor (`motor_w`) |
| 37E4–37E7 | write: cassette unit select (`cassunit_w`) |
| 37E8–37EB | printer data/status (TRS-80 style; HT really uses port FD) |
| 37EC–37EF | FD1771 (`fdc_r`/`fdc_w`, data inverted with `^ 0xff`) |
| 3800–3BFF | keyboard (`keyboard_r`) |
| 3C00–3FFF | video RAM |
| 4000–FFFF | RAM (48K) |

Note that MAME overlays the 37E0–37FF expansion registers on top of the internal EPROM window
(3000–37FF). On the Genie these addresses are decoded by the expansion box (§9). *Inference:* with
no expansion attached, reads of 37E0–37FF return EPROM contents on real hardware; with the EU7/FC
attached the card must override the internal EPROM for 37E0–37EF (the bus has the
`DODBS/ADDBS`, `CCDBS/STADBS` disable lines for that) — not verified on a schematic.

### 3.4 Keyboard area 3800–3BFF

See §7 for the matrix. Only A0–A7 select rows, so 3900–3BFF mirror 3800–38FF (MAME: "3900-3bff
unused - kbd mirrored"; its `keyboard_r` uses only offset bits 0–7) [MAME trs80.cpp header,
trs80_m.cpp `keyboard_r`].

### 3.5 Unmapped reads

- Unused I/O ports read **FF** (MAME `map.unmap_value_high()` in `sys80_io`/`ht1080z_io`;
  MiSTer "all unassigned ports → x"ff"") [MAME trs80.cpp], [MISTER trs80.vhd CPU input mux].
- Unpopulated memory above 7FFF on a 16K machine: not documented. *Inference:* floating bus,
  typically FF (the BASIC "MEMORY SIZE" probe relies on writes not reading back).

---

## 4. I/O ports

Only A0–A7 are decoded (Z80 `IN/OUT (n)`); MAME `map.global_mask(0xff)`.

### 4.1 Port map

| Port | Dir | Function | Source |
|---|---|---|---|
| **1E** (30) | W | AY-3-8910 data write (to the latched register) | [HT-USER App. D p.30: `OUT 30,A`], [MAME `ht1080z_io`: `ay8910_device::data_w`] |
| **1E** (30) | R | AY-3-8910 data read | [MAME `data_r`]; *see §6.2* |
| **1F** (31) | W | AY-3-8910 register select (address latch) | [HT-USER App. D: `OUT 31,I`], [MAME `address_w`] |
| F8 | R/W | UART (System-80 RS-232; only with the RS-232 option) | [MAME `sys80_io`], [S80] |
| F9 | R/W | UART status / data | [MAME `sys80_io`, `sys80_f9_r`] |
| **FD** (253) | W | printer data (Centronics, strobed) | [GENIE I/O assignment], [HT-USER App. B], [HT-EXP PR2 "253 (FD) I/O cím"] |
| **FD** | R | printer status: D4 ERROR, D5 ACKNOWLEDGE, D6 PE (paper empty), D7 BUSY | [HT-EXP PR2 §1.3] |
| **FE** (254) | W | cassette select: **D4 = 1 → cassette 2 (external DIN), 0 → cassette 1 (internal)** | [GENIE Table 1.1, §1.5.2], [RT84 1984/7], [MAME `sys80_fe_w`] |
| **FF** (255) | W | cassette/sound output and relay (below) | [GENIE Table 1.1], [RT84 Table 1] |
| **FF** | R | D7 = cassette input latch | [GENIE Table 1.1, §1.5.4] |
| 60–7F | R/W | EU7 HRG graphics card (MC6845 + coordinate/command registers), only when fitted | [HT-EXP p.17] |

### 4.2 Port FF write bits

| Bit | Meaning | Source |
|---|---|---|
| D0, D1 | cassette output signal (3-level). With D2=0 they also drive the built-in speaker | [GENIE Table 1.1, §1.5.3, §1.5.5] |
| D2 | cassette relay: 1 = "Cassette ON" (motor relay of the selected recorder closed). Also gates the data paths and *mutes* the speaker | [GENIE Table 1.1, §1.5.2, §1.5.5] |
| D3 | TRS-80 32/64 mode bit. On the Genie/HT there is no software column switch (hardware VIDEO CUT instead). MAME stores it (`m_cpl`) but `screen_update_ht1080z` ignores it | [GENIE §1.4.4.1], [MAME trs80_m.cpp `port_ff_w`, trs80_v.cpp] |
| D4–D7 | unused | — |

Output level from D1:D0 — measured on the HT's external DIN by [RT84 1984/7, Table 1]:
`00` → 0.2 V, `01` → 0.4 V, `10` → 0 V, `11` → 0.2 V (relay closed when D2=1). The Genie forms
it from Q(D0) and Q̄(D1) of a 74LS175 through a summing network: 01 = high, 10 = low, 00/11 = middle
[GENIE §1.5.3, Fig. 1.12]. MAME maps it as `levels[4] = { 0.0, 1.0, -1.0, 0.0 }` [MAME
trs80_m.cpp `port_ff_w`]. Writing port FF also **clears the cassette-input latch** (§8.2).

On the HT-1080Z/64: port FE/FF decode is a 74LS30 (IC15) on A1–A7 all high, A0 selecting FE/FF;
the FF output latch is a 74LS175 (IC6, inputs D0, D2, D3), the FE latch a 74LS74 (IC35) on D4, and
the read path a 74LS367 (IC7) [HT-SCH64 E panel sheet 2].

### 4.3 Port FF read bits

| Bit | Meaning | Source |
|---|---|---|
| D7 | cassette input flip-flop (set by a pulse from tape, cleared by any OUT FF) | [GENIE §1.5.4], [MAME `port_ff_r`] |
| D6 | MAME returns NOT(`m_cpl`) (TRS-80 "modesel remembered" bit) | [MAME trs80_m.cpp `port_ff_r`] |
| D5–D0 | MAME returns 1s (`| 0x3f`) | [MAME `port_ff_r`] |

*Inference:* on the real Genie/HT only D7 is driven; whether D6–D0 float high is undocumented.
[RT84 1984/7] reads port FF from BASIC (`PRINT INP(255)`) to watch the DIN pin-4 input level.

---

## 5. Display

### 5.1 Format

- 64 × 16 characters; cell **6 × 12 dots**; 384 × 192 active dots [GENIE §1.4.1].
- 32 × 16 in VIDEO CUT mode (characters drawn double width) [GENIE §1.4.4.1], [HT-USER §3.2–3.3].
- Semigraphics 2 × 3 per cell → **128 × 48** [GENIE §1.4.4.2], [HTSITE english.html].
- Monochrome. Composite video out 2 Vpp, negative sync, 75 Ω; RF modulator VHF **OIRT channel 2**,
  200 mVpp/75 Ω [HT-USER App. A p.20]. The composite DIN: pin 1 +5 V, pin 4 video, pin 5 GND
  [HT-USER p.21]. On the /64, video is mixed by T1–T3, and the "RF MODULATOR LVM 1E" is fed from
  the same signal [HT-SCH64 E panel sheet 2].

### 5.2 Video RAM

- 1K × 8 at 3C00–3FFF, two 2114 static RAMs (Genie Z17/Z18; /64 IC13/IC14 MM2114) [GENIE §1.4.2],
  [HT-SCH64 E panel sheet 1]. **All 8 bits are stored** (unlike a stock Model I).
- Address bits: A0–A5 = column (0–63), A6–A9 = row (0–15) [GENIE §1.4.2.1]. Row-major, 64 bytes per
  row, independent of 32/64 mode.
- **D7 = 0 → character; D7 = 1 → semigraphic block** [GENIE §1.4.4].

### 5.3 Character mode

- Genie chargen: MM52116 FDW (or custom E3004), "upper case and lower case characters in a 5 × 9
  dot matrix"; scan lines 9–11 are blank because the chargen outputs 0 there [GENIE §1.4.2.2,
  §1.4.4.2]. Six data bits (D0–D5) plus the control latch go to the chargen [GENIE §1.4.2.2].
- HT chargen: its own **2K** ROM (`ht1080z.z25`, `ht1080z2.z25`, `ht108064.z25`, 0x800 bytes each)
  [MAME ROM_START]. The /64 board uses a **TMS2716** (IC20) [HT-SCH64 E panel].
- MAME's HT decode [MAME trs80_v.cpp `screen_update_ht1080z`; trs80.cpp `ht1080z_charlayout`]:
  - 128 characters × 16 bytes; byte index = `(code << 4) | scanline` with scanline 0–11 used;
  - **bits 7..3** of each byte are the 5 visible dots (left = bit 7); the 6th dot is forced blank;
  - for `ht1080z`/`ht1080z2` (`init_trs80l2` sets `m_7bit`): codes 00–1F are displayed as 40–5F;
    for `ht108064` (`empty_init`, `m_7bit` false) codes 00–1F use their own glyphs (the Hungarian
    set, §5.5).
  - Contrast: the TRS-80/System-80 chargen is 8 bytes per char, bits 5..0, with descender
    shifting done in code (MAME `screen_update_sys80`). The HT chargen stores full 12-line glyphs,
    so descenders are in the ROM.
- *Inference:* in hardware the 7-bit code (D0–D6) addresses the chargen with the 4-bit scan-line
  counter (L3–L0); on Series I/II a code 00–1F aliasing onto 40–5F matches the TRS-80 "no bit 6"
  convention that MAME models; on the /64 codes 00–1F are real glyphs.

### 5.4 Semigraphic mode

For D7 = 1, the six bits D0–D5 form a 2-wide × 3-high block [GENIE §1.4.4.2, Fig. 1-10]:

| Scan lines | Left half (3 dots) | Right half (3 dots) |
|---|---|---|
| 0–3 | D0 | D1 |
| 4–7 | D2 | D3 |
| 8–11 | D4 | D5 |

D6 is ignored ("1x011001" in Fig. 1-10). MAME: `gfxbit = (ra & 0x0c) >> 1`, three dots of
`BIT(chr,gfxbit)` then three of `BIT(chr,gfxbit+1)` [MAME trs80_v.cpp].

### 5.5 Hungarian characters

- **Series I:** no accented letters [HTSITE].
- **Series II:** the chargen replaces ASCII symbols with accented letters (chargen code → glyph):
  64 `@`→É, 92 `\`→Ö, 93 `]`→Á, 94 `^`→Ü, 96 `` ` ``→é, 124 `|`→ö, 125 `}`→á, 126 `~`→ü. Typed
  with CLEAR + A/E/U/O (SHIFT for lowercase) [HTSITE hardver1080valtozatok.html, hardverrom.html].
- **HT-1080Z/64:** codes 0–31 hold the extended set, reached by typing `'` (SHIFT-@) then a key;
  stored in BASIC text as two bytes (`'` + key) and converted by the print routine. `PRINT
  CHR$(21)` hides the apostrophe on input, `CHR$(20)` restores [HTSITE], [HT-64CHG pp.3–5].
  Codes: Á0 É1 Í2 Ó3 Ö4 Ő5 Ú6 Ü7 Ű8 ■9 ∫10 ∞11 √12 Σ13 Ψ14 Ω15, á16 é17 í18 ó19 ö20 ő21 ú22 ü23
  ű24 α25 β26 γ27 λ28 μ29 π30 ω31 [HTSITE hardver1080valtozatok.html], [HT-64CHG p.5].

### 5.6 CPU access and "snow"

- The video RAM is shared through address multiplexers; when the CPU addresses 3C00–3FFF
  (signal VID), "the display is blanked during the CPU's access to the video RAM because VID sets
  the data/control latch Z3 and Z26 to the CLEAR state" [GENIE §1.4.2.1]. So: **no wait states,
  but a short black dash** on the picture at the beam position during each CPU video access.
- MAME does not model it. MiSTer models it as a black line on contention
  [MISTER videoctrl.vhd "Black line on video contention"]. [JOCO]'s MiST core uses dual-port RAM
  with no contention.

### 5.7 Video timing — [GENIE §1.4.1, Fig. 1.5, Fig. 1.6, Fig. 1.8(b)]

Divider chain from the master clock `F` (10.644 MHz):

| Stage | Divide | Output |
|---|---|---|
| Z36 | ÷6 | character clock (= CPU clock), F/6 ≈ 1.774 MHz |
| Z36 | ÷2 | 887 kHz "address scanning frequency" |
| Z35 | ÷4 | — |
| Z34 | ÷14 | **horizontal: 15.84 kHz** |
| Z33 | ÷12 | 1.32 kHz, character-row clock (12 scan lines per row) |
| Z35 | ÷2 | — |
| Z32 | ÷11 or ÷13 | **vertical: 60 Hz (÷11) or 50 Hz (÷13)** |

Derived figures (arithmetic from the chain, F = 10.644 MHz):

| Quantity | Value |
|---|---|
| Dots per line | 6·2·4·14 = **672** (384 active = 64 × 6) |
| Character times per line | **112** — the H address runs 0–63 displayed, then 0–47 blanked [GENIE Fig. 1.8(b)] |
| CPU T-states per line | **112** (CPU clock = character clock) |
| Line period | 672 / 10.644 MHz ≈ **63.13 µs** (manual: "64 µs", H sync ≈ 4 µs) |
| Lines per frame, 50 Hz | 12·2·13 = **312** (192 active = 16 × 12) |
| Lines per frame, 60 Hz | 12·2·11 = **264** |
| Frame rate | 15.84 kHz / 312 ≈ **50.77 Hz** (60 Hz build: 60.0 Hz) |
| T-states per frame, 50 Hz | 112 × 312 = **34,944** |
| V sync | ≈100 µs pulse [GENIE Fig. 1.6] |
| Picture position | set by two 4069-inverter RC delays (VR1/VR2) on the H and V sync [GENIE §1.4.1] — i.e. analog; there is no fixed digital border |

- The HT is a 50 Hz machine: the /64 video board has a jumper between the vertical counter
  outputs labelled **"625" / "525"** (IC27 74LS93 + IC18 74LS11) [HT-SCH64 E panel sheet 1] — the
  same 312/264-line choice, named after the TV standards. MAME builds every HT on `sys80p`:
  `set_raw(10.48_MHz_XTAL, 672, 0, 384, 312, 0, 192)` → 49.98 Hz [MAME trs80.cpp `sys80p()`].
  (A 10.48 MHz crystal is what a PAL Model I conversion uses to get an exact 50 Hz; see
  https://electrickery.nl/comp/trs80/remarks/TRS-80_Model-1_TFT-monitor_2018-04-06.html.)
- MiSTer's layout (its own choice, 264-line timing): `|42 hsync|84 porch|81 border|384 screen|81
  border|` = 672 [MISTER videoctrl.vhd comments].
- Where the 192 active lines sit within 312 is set by the analog delay. *Inference:* centre them
  (≈60 lines above, ≈60 below, minus sync/blanking).

### 5.8 VIDEO CUT and PAGE (32-column mode)

- Rear switch "VIDEO CUT" (S1 on Genie, S3 on the /64 E panel) halves the reference counter clock
  so each character is twice as wide; 32 columns are shown [GENIE §1.4.4.1], [HT-SCH64].
- The front **PAGE** key (latching) selects which half is shown: LOW = left (columns 0–31), HIGH =
  right (columns 32–63), by driving video-RAM A5 through multiplexer Z37 [GENIE §1.4.4.1].
  HT manual: PAGE "lapválasztó" (page select) [HT-USER §4.1].
- Neither is visible to software. MAME models them as config inputs "Video Cut" (toggle) and
  "Page" (bit 2 of CONFIG): 32 columns when cut, start column 32 when both are on [MAME
  trs80.cpp INPUT_PORTS(sys80), trs80_v.cpp `screen_update_ht1080z`].
- The software 32-column command `CHR$(23)` / SHIFT→ exists in the ROM; on System-80-type hardware
  it only inserts a space after each character, keeping the narrow font [S80 hardware_s80.htm],
  [MAME trs80_v.cpp comment], [HT-USER §4.1].

### 5.9 Sources for reverse engineering the video circuit (checked 2026-10-22)

There is **no video chip**. The picture comes from discrete TTL: counters, multiplexers, two 2114
RAMs, a character ROM and a shift register, with analog RC sync timing. What we have:

| Source | What it gives | Gaps |
|---|---|---|
| **/64 E panel, sheet 1** (`docs/ht1080z64_schematic_ht_panel_e_64k_kapcsolas1.pdf`, Y04-6000-00-1E) | The full gate-level video logic: the 10.6645 MHz oscillator; the dot/character counter IC31 (74LS92); the H/V counters IC27–IC30 (74LS93) with the 625/525 jumper; the CPU/video address multiplexers IC24, IC32–IC34 (74LS157) with A0–A9, WR, RD and VID from the F panel; VRAM IC13/IC14 (MM2114); the data latches IC3 (74LS175) and IC21 (74LS174); the semigraphics select IC22 (74LS153); the chargen IC20 (TMS2716); the shift registers IC4 and IC19 (74LS166); the VIDEO CUT switch S3 and the PAGE input | Not traced yet. A 300-dpi scan is legible enough to trace (rendered crops were read for §2) |
| **/64 E panel, sheet 2** (`…kapcsolas2.pdf`) | H and V sync from **CD4069 RC delay/monostable stages with trimmers P1/P2** (picture position, as on the Genie), IC17 MC14011 gating, and the video mixer T1–T3 into the composite output and the RF modulator. It also has the port FF latch (IC6 74LS175), the relays and the speaker amplifier. | The sync position and width are analog (RC values on the sheet), so the border has no exact digital value. Approximate it from the component values. |
| **Genie manual §1.4, printed pp. 8–15** (`docs/EACA_Genie_manual_1982.pdf`) | A prose description of the divider chain, VRAM addressing, video signal generation, the display modes, VIDEO CUT/PAGE and the CPU-access blanking, with timing figures 1.5, 1.6 and 1.8 (summarised in §5.1–5.8) | **This scan lacks the schematic and layout pages** (printed pp. 35–41 and 43–45): the PDF jumps from the "4. Schematic diagrams" index (p.34) to "5. Component layout" (p.42). So no Series I/II (EACA board) schematic is in hand. |
| **Dick Smith System 80 Technical Manual** (EACA, the same board as the Genie / Series I) | Issue 3 (1982-10) reportedly has full fold-out A3 schematics. The scans are referenced from the [Microbee Technology forum thread](https://microbeetechnology.com.au/forum/thread-222.html); Issue 2's text is on [device.report](https://device.report/m/a0a5d0a47e5ccf21823333770da9c06390731e6491ce27aa0d501096d0fcff5d). | **Not downloaded yet.** This is the best candidate for the Series I/II video schematic. |
| MiST `videoctrl.vhd` (BSD-3) | A working HDL re-implementation: 672 × 312 counters, the cell and semigraphics decode, VIDEO CUT/PAGE | Not derived from the schematic. Its timing constants are the author's (10.5 MHz; borders 81/81). |
| MAME `trs80_v.cpp` (BSD-3) | The character-ROM byte layout and the semigraphics decode for the HT | Frame-based, with no beam timing |

What tracing E panel sheet 1 would settle: the exact horizontal count (672?) and where blanking
and sync start within it; the pipeline delay from the VRAM read through the chargen to the shift
register (it decides where a CPU-access "dash" lands and how many dots wide it is); how VIDEO
CUT halves the clock; and the code 00–1F handling on the /64 chargen address lines.

---

## 6. Sound

### 6.1 Speaker on the cassette port (inherited from the Genie I / Blue Label)

- An audio driver (Q11/Q12 Darlington) and a built-in 8 Ω loudspeaker are connected to the port FF
  output latch: the sound is the D0/D1 waveform; it is **muted while D2 = 1** (cassette relay on)
  [GENIE §1.5.5, Fig. 1.14]. MAME: "Speaker for System-80 MK II – only sounds if relay is off"
  [MAME trs80_m.cpp `port_ff_w`].
- On the /64 the same path exists on the E panel (IC6 74LS175 → T11/T12 2N2219 → speaker H1) and
  the AY output enters the same amplifier at "LK.6 Hang.gen" [HT-SCH64 E panel sheet 2].

### 6.2 AY-3-8910 programmable sound generator (HT addition)

- **Chip:** General Instrument AY-3-8910 (IC1 on the sound panel "Hang panel", drawing
  Y04-1000-00-1E, "HT School Computer (HT-1080Z, HT-2080Z)") [HT-SCH64 ht_hang.pdf]. HT site and
  emulators also name the pin-compatible Yamaha YM2149 [HTSITE english.html].
- **Ports:** `OUT 31,I` selects register I; `OUT 30,A` writes A to it [HT-USER App. D p.30].
  MAME: 1E = data read/write, 1F = address write [MAME trs80.cpp `ht1080z_io`]. MiSTer:
  `BDIR = (A7..A1 = 0001111) and IOWR`, `BC1 = A0` [MISTER trs80.vhd, sound chip block].
- **Decode on the sound panel:** a 74LS30 8-input NAND (IC3) takes A7, A6, A5 inverted (74LS04),
  A4–A1 direct, and an IN/OUT strobe from a 74LS00 (IC2); two 74LS02 NOR gates (IC5) produce BDIR
  (pin 27) and BC1 (pin 29), with A0 inverted (IC4). BC2 (pin 28) and A8 (pin 25) are tied to +5 V,
  /A9 (pin 24) to GND [HT-SCH64 ht_hang.pdf]. So the chip answers at **1E/1F only** (A7–A1 =
  0001111), and the IN strobe is in the decode, i.e. register reads are possible.
  **Traced (SOUND_AY.md §2):** OUT 1F latches the address, OUT 1E writes data, and **IN 1F
  reads data**. IN 1E is inactive (open bus). The 1984 Rádiótechnika program `D=INP(31)`
  confirms the 1F read. MAME's read at 1E is wrong.
- **Clock:** AY pin 22 is driven from the CPU board via the internal connector pin 1 [HT-SCH64
  ht_hang.pdf]. *Inference:* the AY runs at the CPU clock, ≈1.77 MHz. MiSTer clocks it with the
  1.774 MHz CPU enable [MISTER trs80.vhd, `CE => cpuClk`]. MAME uses **1.5 MHz** and flags it
  "guess of clock" / "verify clock for AY-3-8910" [MAME trs80.cpp `ht1080z()`, To-Do list].
- **Reset:** AY pin 23 comes from BCS/48 on the *internal* bus connector [HT-SCH64 ht_hang.pdf].
  The BCS numbering differs from the edge numbering, where pin 48 is /NMI, so whether this is the
  power-on /RESET is unverified (SOUND_AY.md §6).
- **Full detail** (decode, clock argument, mixing with the beeper, user port, emulation recipe):
  [SOUND_AY.md](SOUND_AY.md).
- **Output:** channels A, B, C (pins 4, 3, 38) are tied together with a 1 kΩ load and summed into
  one mono signal → rear 20-pin connector pins 9–10 and the internal amplifier [HT-SCH64],
  [HT-USER p.22]. Max output 1.5 Vpp [HT-USER App. D p.26].
- **I/O ports A/B:** brought out on the 20-pin rear connector: pins 1–8 = port A bits 0–7, 11–18 =
  port B bits 0–7, 9–10 = sound out, 19–20 = GND [HT-USER App. A p.22]. Direction set by R7 bits
  6/7 (0 = input). MAME leaves them unconnected ("ports are some kind of expansion slot") [MAME
  trs80.cpp `ht1080z()`]; MiSTer ties the inputs high. Schools used this as a "user port" (e.g.
  the UNICOMP measuring unit: 8 bits out + 8 bits in + one control line) [HTSITE
  hardverbovitesek.html].
- **Registers** (the standard AY map, as documented in [HT-USER App. D pp.26–30]): R0/R1, R2/R3,
  R4/R5 = 12-bit tone period A/B/C (coarse registers use 4 bits); R6 = 5-bit noise period; R7 =
  mixer (bits 0–2 tone off A/B/C, 3–5 noise off A/B/C, 6/7 port A/B output enable); R8–R10 =
  amplitude (bit 4 = use envelope); R11/R12 = envelope period; R13 = envelope shape; R14/R15 =
  I/O ports.
- **BASIC support:** none — there is no SOUND keyword; the manual programs the chip with
  `OUT 31,I : OUT 30,A` from BASIC, e.g. a "sea" noise demo writing R0–R15 =
  0,0,0,0,0,0,31,199,16,16,16,255,60,14,0,0 [HT-USER App. D pp.30–31].

---

## 7. Keyboard

### 7.1 Physical layout (HT-1080Z) — [HT-USER §4 p.8]

```
                                                         [PAGE] [F1]
 [! 1][" 2][# 3][$ 4][% 5][& 6][' 7][( 8][) 9][ 0 ][* :][= -][BREAK][CLEAR]
 [ ↑ ][ Q ][ W ][ E ][ R ][ T ][ Y ][ U ][ I ][ O ][ P ][\ @][ ← ][ → ]
 [ ↓ ][ A ][ S ][ D ][ F ][ G ][ H ][ J ][ K ][ L ][+ ;][ NEW LINE ]
 [SHIFT][ Z ][ X ][ C ][ V ][ B ][ N ][ M ][< ,][> .][? /][SHIFT]
                 [            SPACE            ]
```

- Full-stroke QWERTY, "no extra Hungarian keys" [HTSITE english.html]. Accents come from key
  combinations (§5.5). On the /64 the digit keys carry reminder labels for the accents [HTSITE].
- PAGE and F1 are **latching switches outside the matrix**: PAGE drives the video page select,
  F1 forces the internal recorder motor on for manual winding [GENIE §1.6], [HT-USER §4.1].
- Key functions: NEW LINE = Enter; ← deletes the last character; ↑ prints `[` (exponent sign);
  ↓ goes to the next line; → tab 8; SHIFT→ = CHR$(23); SHIFT← = clear line [HT-USER §4.1].

### 7.2 Matrix — [GENIE §1.6.1, Fig. 1.15], [HT-SCH64 keyboard drawing Y04-4000-00-1IE]

Rows are selected by address lines A0–A7 (inverted to AK0–AK7 by open-collector 74LS05), columns
read on D0–D7 (DK0–DK7 through 74LS368 inverting buffers, pull-ups 4.7k). A key pressed in a
selected row reads as **1**. Several rows may be selected at once; the result is the OR
("wired-or") of the rows. Address = 3800h + row mask (3801, 3802, 3804, 3808, 3810, 3820, 3840,
3880).

| Row (addr) | D0 | D1 | D2 | D3 | D4 | D5 | D6 | D7 |
|---|---|---|---|---|---|---|---|---|
| 0 (3801) | @ | A | B | C | D | E | F | G |
| 1 (3802) | H | I | J | K | L | M | N | O |
| 2 (3804) | P | Q | R | S | T | U | V | W |
| 3 (3808) | X | Y | Z | — | — | — | — | — |
| 4 (3810) | 0 | 1 ! | 2 " | 3 # | 4 $ | 5 % | 6 & | 7 ' |
| 5 (3820) | 8 ( | 9 ) | : * | ; + | , < | - = | . > | / ? |
| 6 (3840) | NEW LINE | CLEAR | BREAK | ↑ | ↓ | ← | → | SPACE |
| 7 (3880) | SHIFT (both) | — | — | — | — | — | — | — |

- This is the TRS-80 Model I matrix; the HT keyboard drawing shows exactly these positions, with
  **both SHIFT keys on row 7 / D0** [HT-SCH64 keyboard]. MAME's matrix is the same [MAME
  trs80.cpp INPUT_PORTS(trs80)]; MAME's extra row-3 keys (D3–D7) belong to the System 80 Mk II and
  the Model I's unused positions — not present on the HT.
- Example from the manual: S pressed → reading 3804h gives 08h [GENIE §1.6.1].
- [S80 hardware_mods.htm]: on early System 80s, CLEAR (DK1/AK6) and → (DK6/AK6) were missing; the
  HT has both.

---

## 8. Cassette interface (hardware)

### 8.1 Recorders and connectors

- Internal recorder ("cassette 1") built in on all HT-1080Z versions; second/external recorder
  ("cassette 2") on a 5-pin DIN: 1 = remote, 2 = signal ground, 3 = remote, 4 = input to
  computer, 5 = output from computer [HT-USER p.21]. Levels: input 1 Vpp, output 0.3 Vpp; remote
  relay contact 0.5 A at 6 V DC [HT-USER App. A].
- Selection: port FE D4 (0 = internal, 1 = external), latched by Z40; relay REL1 (internal) or REL2
  (external) closes only when port FF D2 = 1 [GENIE §1.5.2]. [RT84] confirms `OUT 254,0` = recorder 1,
  `OUT 254,16` = recorder 2, and `OUT 255,N` with bit 2 controlling the relay.
- Series I has a level meter + gain knob; Series II/64 an auto-level circuit and a red LED
  [HTSITE]. Not emulator-visible.

### 8.2 Write and read circuits

- **Write:** D0/D1 latched in a 74LS175 (Z6) and summed into a 3-level signal; one bit cell is a
  2 ms window with a sync (clock) pulse, and a data pulse ≈1 ms later for a 1 bit; pulse width
  ≈120 µs [GENIE §1.5.3, Fig. 1.12]. This is the TRS-80 Level II 500-baud format.
- **Read:** an LM324 (Z9/Z1) high-pass filters, amplifies and full-wave rectifies the tape signal;
  a level detector produces negative pulses that **set an R-S latch (Z28)** whose output is
  read on **D7 of port FF**. The latch is **reset by the FF/OUT pulse** — i.e. any write to port
  FF [GENIE §1.5.4]. The ROM reads a 1, resets the latch, waits, and samples again ~1 ms after
  the sync pulse to see whether a data pulse arrived [GENIE §1.5.4].
- MAME emulates the latch: `cassette_data_callback` (11025 Hz) sets `m_cassette_data` on a
  high-to-low crossing of −0.2; `port_ff_r` returns it in bit 7; `port_ff_w` clears it
  [MAME trs80_m.cpp].
- The HT-1080Z/64's cassette amplifier is on its own drawing ("Magnó erősítő") and on the E panel
  sheet 2 (LM324 IC9, relays S1/S2 driven by T5–T8 from port latches) [HT-SCH64].
- Tape data format (500 baud, leader of 128 zero bits / 0x00 bytes then A5h sync) is covered in
  the format notes; see [GENIE §1.5.3].

---

## 9. Expansion

### 9.1 The 50-pin expansion edge — [HT-USER p.23] (identical to [GENIE §6.1])

| Pin | Signal | Pin | Signal |
|---|---|---|---|
| 1, 2 | GND | 26–29 | A10, A13, A11, A12 |
| 3–10 | A7, A6, A5, A4, A1, A3, A2, A0 | 30 | PHI (CPU clock, "1.79 MHz") |
| 11, 12 | D5, D2 | 31 | /PINT (interrupt in) |
| 13 | NC | 32, 33 | NC |
| 14–18 | D1, D0, D3, D7, D6 | 34 | /PHLDA (bus-ack) |
| 19 | VCC +5 V | 35 | /PHANTOM |
| 20 | D4 | 36 | /HALT |
| 21–24 | A15, A8, A14, A9 | 37 | /PWAIT |
| 25 | NC | 38 | /IORQ |
| 39 | /PHOLD (bus request) | 40, 41 | /WR, /RD |
| 42 | /CCDBS/STADBS (control/status bus disable) | 43 | /MREQ |
| 44 | /DODBS/ADDBS (data & address bus disable) | 45 | /M1 |
| 46 | /RESET | 47 | /RFSH |
| 48 | /NMI | 49, 50 | GND |

Not compatible with the TRS-80's 40-pin expansion edge; the HT site and [S80] describe it as
System-80 specific. The bus-disable lines let an external card take over the internal buffers.

### 9.2 HT-1080Z/EU7 expansion unit (from early 1986) — [HT-EXP], [HTSITE hardverbovitesek.html]

Seven Eurocard (100×160 mm) slots on DIN 41612 a+c 64-pin connectors, own PSU, connected to the HT
bus through a bus-interface card. Cards:

- **HT-1080Z/FC floppy controller** [HT-EXP pp.9–12]:
  - **WD FD1771 (PL-01)**, 5¼" single-sided single-density, up to **4 drives** daisy-chained on a
    25-pin D connector (HT-1080Z/FD unit, MOM 1800/900 or Tandon TM100 drive; ~100 KB/disk,
    125 kbit/s).
  - Addresses: **37E0–37E3** read: D6 = FDC IRQ, D7 = hardware-clock IRQ; write: D0–D3 drive
    select. **37EC** status (R)/command (W), **37ED** track, **37EE** sector, **37EF** data.
  - **Hardware clock: 4 MHz crystal timebase, IRQ every 25 ms (40 Hz).** This is the TRS-80
    Expansion Interface real-time-clock interrupt; MAME: `IRQ_M1_RTC 0x80`, `IRQ_M1_FDC 0x40`,
    reading 37E0 returns the flags and clears INT [MAME trs80_m.cpp `irq_status_r`].
  - Boot: with the FC present, power-on loads the DOS from drive 0 and shows `NEWDOS/80 READY`;
    hold BREAK while pressing RESET to get `MEMORY SIZE?` instead [HT-EXP p.8]. The HT site notes
    the TRS-80 ROM's disk-boot check, defeated by holding Break at power-on [HTSITE].
  - MAME inverts FDC data both ways (`^ 0xff`) and returns FF for the status read when the floppy
    config is off [MAME trs80_m.cpp `fdc_r`/`fdc_w`]; MAME's FDC clock is `4_MHz_XTAL / 4`
    [MAME `level2()`].
- **HT-1080Z/PR2 printer interface:** Centronics, 8-bit out, 4-bit status, I/O port **FD** (253)
  [HT-EXP p.13]. (The standalone **PR1** printer interface plugged directly on the bus and passed it
  through [HTSITE].)
- **HT-1080Z/HRG graphics ("HRG panel", *Nagyfelbontású grafika*, "high-resolution graphics"):**
  a card for the EU7 box that is **a second, independent video subsystem with its own monitor**.
  It does not change the HT's own picture. The sources are [HT-EXP printed pp. 16–18 (PDF pp. 17–19)],
  `docs/ht_EU7_HRG_card_registers_hu.pdf` (handwritten, its pages 3–4 only; [HRG-REG]) and
  `docs/ht_EU7_HRG_card_calibration_hu.pdf` (the factory calibration procedure, [HRG-CAL]).
  - **Resolution and format:** 512 × 512 dots, 4:3, with **two 1-bit graphics pages** M0 and M1, each 512 × 512.
    The text overlay is 16 rows × 64 characters with an **8 × 32-dot character cell**, so the text
    covers the same 512 × 512 grid [HT-EXP p.16].
    Pages and RAM: 2 × 512 × 512 bits = 64 KB. This matches the eight dynamic RAMs IC 40–47 that
    [HRG-CAL] tests, so they are probably 4164s (*inference*).
  - **Text:** the card has its own screen RAM (IC 13A, *ernyő RAM*) and its own character
    generator (IC 5A) [HRG-CAL 2.6]. Its character memory sits at **3C00–3FFF and is write-only**:
    "written together with the character memory in the machine" [HT-EXP p.16]. So it **shadows
    every write to the HT's video RAM** and shows the same text on its own monitor, over the
    graphics. Bit d6 of the command register turns the text on and off.
  - **Graphics memory is not memory-mapped.** It is reached only through ports [HT-EXP p.16–17]:

    | Port | Dir | Bits | Meaning |
    |---|---|---|---|
    | 60–61h | W | | MC6845 address (register select) |
    | 62–63h | R/W | | MC6845 data |
    | 64–67h | | | unused |
    | 68–6Bh | W | x7–x0 | X low |
    | 6C–6Fh | W | x8 | X high |
    | 70–73h | W | y7–y0 | Y low |
    | 74–77h | W | y9 y8 | Y high. Y = 0–511 is page M0, Y = 512–1023 is page M1, so y9 picks the page |
    | 78–7Bh | W | command | d7 M1/M0 (displayed page), d6 character enable, d5 inverse, d4–d3 unused, d2 R/W (0 = write, 1 = read), d1 clear (1 = fill the page chosen by d7 with Din), d0 Din (the pixel value to write) |
    | 78–7Bh | R | status | d7 RDY (0 = busy, 1 = ready), d0 DATA (the pixel at X;Y after a read command) |

    The **handwritten register sheet [HRG-REG p.3] puts command/status at 7C–7Fh** instead of
    78–7Bh. The printed table in [HT-EXP p.17] lists a "7C-7F" row but leaves it empty. *Open
    question:* is the decode partial (78–7F), or did the address move between the prototype and
    production?
  - **Command model:** set X and Y, then write a command. The card performs the pixel write, the
    pixel read or the page clear itself, and signals completion through RDY. A page clear
    obviously takes a long time. The CPU never addresses the bitmap directly.
  - **WAIT:** the card can hold the Z80 in WAIT. The signal comes from IC 54B/6 through IC 26A, and
    RD, RFSH or the card's DW signal releases it [HRG-CAL 2.2]. *Inference:* CPU accesses to the
    card (most likely the shadow writes to 3C00–3FFF or the port cycles) are synchronised with the
    card's display memory cycles, so **an emulated HRG adds wait states**. The sources do not say
    how many.
  - **Clock and timing — this is where the 10.5 MHz comes from:**
    - [HRG-CAL Fig. 1] shows the card's own oscillator output, `DOTCLK` (IC 34B pin 11), labelled
      "95,2 us (10,5 MHz)". The unit is a typo: 1 / 10.5 MHz = **95.2 ns**.
    - `DCLK`, `/RAS`, `/CAS` and `S/L` (the shift-register load) come from DOTCLK. In the figure
      DCLK is an 8-DOTCLK cycle, which matches an 8-dot character cell (*inference* from the drawing).
    - [HRG-CAL Fig. 2] gives HSYNC as about 5 µs every **64 µs** and VSYNC as about 1 ms every
      **20 ms**. The output VSYNC is a monostable pulse about 2.5 H long [HRG-CAL 2.3].
    - So a line is 10.5 MHz × 64 µs = **672 dots**, of which 512 are displayed.
    - The video output is "*összetett váltottsoros videojel*", **composite interlaced video**,
      1 Vpp into 75 Ω on a front-panel BNC [HT-EXP p.18]. *Inference:* the 512 visible lines
      therefore come from two interlaced 50 Hz fields of a 625-line frame, using the 6845's
      interlace mode. NEWDOS loads an initialisation program at reset that programs the 6845
      (IC 20A) [HRG-CAL 2.3]; those register values are not in the sources.
    - **This 10.5 MHz is the HRG card's clock, not the HT main board's.** The main board's video
      and CPU clocks come from its own 10.644 MHz crystal (§2). The card has a separate oscillator
      (IC 34B), checked separately during calibration [HRG-CAL 2.1]. It is *possibly* also where
      the MiST core's 10.5 MHz pixel clock came from, but nothing in that core says so, and 42 MHz
      ÷ 4 explains it equally well (§2).
  - **Bus and physical:** a 64-pin DIN 41612 a+c connector with the EU7 bus pinout, TTL levels,
    175 × 110 × 44 mm [HT-EXP p.18], [HRG-REG p.4]. Calibration needs the EU7, the FD1 floppy, two
    monitors and a DOS disk with init, DEMO and TEST programs. The TEST program's keys are:
    A grid on both pages, B horizontal lines only, M page swap, I inverse, T clear page, K text
    on/off, X exit [HRG-CAL 3.2].
  - **For an emulator:** this is a second display window plus a port device. It needs a 2 × 32 KB
    bitmap, the port and command logic above, a text overlay fed from the 3C00–3FFF shadow and the
    card's own character ROM (no dump located), and enough of a 6845 to honour the init program's
    geometry. Leave it to the end; no emulator found models it, apart from Real-80 PRO's
    "hires/colour boards" (EMU file).
- RAM expansion and other cards (user-built) [HT-EXP].

### 9.3 Other third-party expansions — [HTSITE hardverbovitesek.html]

- Real-Team GM **Commodore serial-bus interface** (1541 drives, MPS-801 printers) with a 2K paged
  EPROM, and **REALNET/MINET** sharing one CBM drive/printer between up to 6 machines (this is the
  "school network" in practice).
- **MICOLOR 01** colour graphics (256×256, 16 or 4 colours, 32K) — also emulated by Real-80 PRO.
- **UNICOMP-02** measuring unit (on the AY user port), **TechnoMIR** modular interface system,
  MTA ATOMKI "KONTASET" modular kit (paged RAM/ROM, graphics, floppy, LAN), Comptech tape signal
  regenerator ("jelfrissítő").
- RS-232: the System-80 UART at ports F8/F9 is in MAME's model, but no HT-made RS-232 card was
  found in the sources — *open question*.

---

## 10. Reset, boot and power-on state

- Power-on: RC reset on `/RESET`; PC = 0000h [GENIE §1.1.2]. The manual warns to wait 15 s
  between power-off and power-on, or the CPU may not initialise correctly [HT-USER §8].
- First prompt: Series I/II show **`READY ?`** (Genie/System-80 behaviour: the `?` asks whether to
  set memory size; press NEW LINE) [HTSITE hardver1080valtozatok.html], [HT-USER §2]; the /64 shows
  **`MEMORY SIZE?`** then `BASIC 2.20` [HTSITE]. With the FC card, the ROM boots the disk first
  (§9.2).
- RESET button → NMI → 0066h: the ROM restarts BASIC without clearing memory ("READY state without
  changing the memory content") [GENIE §1.1.2], [HT-USER §8].
- BREAK is an ordinary matrix key (row 6, D2) [GENIE Fig. 1.15].
- Video RAM and DRAM contents are random at power-on; the ROM clears the screen. *Inference.*
- AY is reset by `/RESET` (not by the NMI) [HT-SCH64 ht_hang.pdf].
- Extension ROM activation: `SYSTEM`, then `/12288` (= 3000h) [MAME trs80.cpp header],
  [HTSITE]; the System-80 extension's other entry points `/12294`, `/12299`, `/12710` (monitor) are
  listed in MAME's header for the System-80 ROM. Details belong to the ROM notes.

---

## 11. Components an emulator needs

1. **Z80** at ≈1.774 MHz (dot clock / 6), 112 T-states per scan line, 312 lines per frame
   (34,944 T-states, ≈50.8 Hz); IM 1; NMI from the RESET key; no internal INT source.
2. **Memory:** 12K BASIC ROM 0000–2FFF + 2K extension EPROM window 3000–37FF (variant-specific
   images), keyboard 3800–3BFF (mirrored, 8-row OR), 1K × 8 video RAM 3C00–3FFF, RAM 4000–7FFF
   (16K) or 4000–FFFF (48K, /64).
3. **Video generator:** 64×16 text, 6×12 cells, 5-dot glyphs from a 2K, 16-bytes-per-glyph HT
   chargen (bits 7..3), D7 semigraphics (2×3), variant rule for codes 00–1F, VIDEO CUT and PAGE
   switches as UI controls, optional "black dash" on CPU video access.
4. **Port FF/FE latches:** cassette out (3-level), relay/motor, cassette 1/2 select, cassette-in
   R-S latch cleared by OUT FF.
5. **Beeper:** cassette-out bits to the speaker, muted while the relay bit is set.
6. **AY-3-8910** at ports 1E (data) / 1F (address), clocked at the CPU clock (verify), mono mix;
   I/O ports A/B as a user port (default inputs = FF).
7. **Tape deck model(s):** internal + external, motor control, 500-baud pulse playback/record (CAS
   and WAV handled by the format work).
8. **Keyboard mapper:** TRS-80 matrix; Hungarian accent combos are pure software.
9. **Optional expansion (EU7):** 40 Hz RTC interrupt + 37E0 status latch, FD1771 at 37EC–37EF with
   up to 4 SS/SD drives and drive select at 37E0–37E3, Centronics printer at port FD; HRG card later.
10. **Variants:** Series I, Series II, /64 (different chargen, extension, BASIC, RAM size, first
    prompt).

---

## 12. Open questions / sources disagree

| Topic | Version A | Version B | Notes |
|---|---|---|---|
| CPU clock | 1.77 MHz [GENIE], [HUWIKI], [HTSITE] / 1.774 [Real-80], [MISTER] | 1.78 [GENIE §6.1], 1.79 [HT-USER p.23], [S80]; 1.65 [JOCO]; MAME 1.7467 (10.48/6); MiST HT core 1.750 (42 MHz PLL / 24) | All but MAME/JOCO agree with ≈10.64 MHz / 6. The HDL cores do not settle it: MiST's value follows from its 27 MHz board clock and MiSTer copies the NTSC Tandy crystal (§2). |
| Master crystal | 10.644 MHz [GENIE], which applies to Series I/II on EACA boards | **10.6645 MHz on the /64**: the E panel crystal, traced to the Z80 Φ through a 74LS92 ÷6 on the F panel (§2), so 1.77742 MHz. MAME uses 10.48 MHz for all 50 Hz EACA/HT sets. | The /64 value is now the schematic's, not a guess. It could only be wrong if the crystal marking itself is a draughting slip. MAME's 10.48 MHz (exactly 50 Hz) has no evidence behind it for the HT. |
| Frame rate | 50.77 Hz (10.644 MHz, 312 lines) — *inference from [GENIE]* | 49.98 Hz [MAME `sys80p`] | Depends on the crystal question. |
| AY clock | CPU clock ≈1.77 MHz (*inference* from [HT-SCH64] pin 22 wiring; [MISTER]) | 1.5 MHz "guess" [MAME] | Measure on hardware or derive from a known tone in the HT demo cassette. |
| AY read-back | MAME: read at 1E | — | Decode includes /IN, so reads exist; what reading 1F returns is unknown. |
| Interrupts | Bare HT: none ([JOCO]; schematics: /INT only from bus) | MAME always runs the 40 Hz RTC (inherited `level2()`) | Model the RTC as part of the EU7/FC option. |
| /64 memory | 48K user RAM [HT-64CHG], [HTSITE] | 8 × 4164 = 64K chips [HT-SCH64]; the name says "64" | No paging documented; the 16K under 0000–3FFF looks unused. Check the F-panel decode (74LS156/139) in detail. |
| Expansion vs internal EPROM at 37E0–37EF | MAME overlays the FDC/RTC registers there | Genie decode puts the internal EPROM over 3000–37FF | How the EU7 bus-interface card overrides the EPROM window is not documented. |
| Series I chargen | No accents [HTSITE] | MAME gives Series I its own `ht1080z.z25` (not the System 80's 2513) | Both 2K; the Series I image's content needs inspection (by the ROM team). |
| Port FF read D6–D0 | MAME: D6 = NOT(cpl), D5–D0 = 1 | Genie: only D7 is driven | Real value undocumented. |
| Port FF D3 | Ignored on HT (hardware VIDEO CUT) [GENIE], [MAME] | TRS-80 software 32-col mode | ROM's CHR$(23) produces spaced narrow characters [S80]. |
| HRG command/status port | 78–7Bh [HT-EXP p.16–17] | 7C–7Fh [HRG-REG p.3, handwritten] | The printed table also lists an empty "7C-7F" row; the decode may be partial. |
| HRG timing / wait states | 10.5 MHz dot clock, 64 µs lines, interlaced [HRG-CAL], [HT-EXP] | — | The 6845 values (set by a NEWDOS init program) and the number of wait states are unknown. |
| UART F8/F9 | MAME's System-80 model has it | No HT RS-232 card found | Probably irrelevant for the HT. |
| Production numbers | 2,364 school units [HUWIKI] | — | No total including HT-2080Z found. |
| First-prompt text on Series I/II | `READY ?` [HTSITE] | `MEMORY SIZE?` [HT-EXP p.8, after BREAK+RESET with the expansion] | Both may be true: the Genie ROM shows `READY?` at cold start without a disk. |

---

## Reference documents downloaded

All in `/Users/dotneteer/source/kliveide/_input/ht1080z/docs/` (downloaded by this research; other
files in that folder were added by the parallel ROM/format and emulator research).

| File | Source URL | Content |
|---|---|---|
| `EACA_Genie_manual_1982.pdf` | https://ht.homeserver.hu/doc/fejlesztoi/eaca_genie_1982.pdf | EACA Genie I/II technical manual (theory of operation, timing, cassette, keyboard, bus) — the main hardware reference |
| `ht1080z64_schematic_ht_panel_f_64k_kapcsolas.pdf` | https://ht.homeserver.hu/doc/fejlesztoi/64k/ht_panel_f_64k_kapcsolas.pdf | HT-1080Z/64 CPU board ("F panel") schematic |
| `ht1080z64_schematic_ht_panel_e_64k_kapcsolas1.pdf` | https://ht.homeserver.hu/doc/fejlesztoi/64k/ht_panel_e_64k_kapcsolas1.pdf | /64 video board ("E panel") sheet 1 — clock, counters, VRAM, chargen |
| `ht1080z64_schematic_ht_panel_e_64k_kapcsolas2.pdf` | https://ht.homeserver.hu/doc/fejlesztoi/64k/ht_panel_e_64k_kapcsolas2.pdf | /64 E panel sheet 2 — port FE/FF, cassette, sync, video mixer, RF, speaker amp |
| `ht1080z64_schematic_ht_panel_e_64k_elrendezes.pdf` | https://ht.homeserver.hu/doc/fejlesztoi/64k/ht_panel_e_64k_elrendezes.pdf | /64 E panel layout |
| `ht1080z64_schematic_ht_hang.pdf` | https://ht.homeserver.hu/doc/fejlesztoi/64k/ht_hang.pdf | Sound panel (AY-3-8910, port decode) |
| `ht1080z64_schematic_ht_billentyuzet.pdf` | https://ht.homeserver.hu/doc/fejlesztoi/64k/ht_billentyuzet.pdf | Keyboard matrix schematic |
| `ht1080z64_schematic_ht_magno.pdf` | https://ht.homeserver.hu/doc/fejlesztoi/64k/ht_magno.pdf | Cassette amplifier |
| `ht1080z64_schematic_ht_tapegyseg.pdf` | https://ht.homeserver.hu/doc/fejlesztoi/64k/ht_tapegyseg.pdf | Power supply |
| `ht_EU7_HRG_card_registers_hu.pdf` | https://ht.homeserver.hu/doc/fejlesztoi/hrg_regiszterek.pdf | HRG graphics card register description |
| `ht_EU7_HRG_card_calibration_hu.pdf` | https://ht.homeserver.hu/doc/fejlesztoi/hrg_bemeres.pdf | HRG card calibration instructions |
| `ht_technomir_measurement_modules_hu.pdf` | https://ht.homeserver.hu/html/pic/bovitesek/technomir_mm.pdf | TechnoMIR interface modules (Mikroszámítógép Magazin series) |

Documents used here that were already in the folder (fetched by the parallel research):
`ht1080z_hasznalati_utmutato_user_manual_hu.pdf` ([HT-USER]), `ht1080z64_valtozasok_changes_hu.pdf`
([HT-64CHG]), `ht1080z_bovito_egysegek_expansion_units_hu.pdf` ([HT-EXP]),
`radiotechnika_1984_0{7,8,9}_ht1080z_kulvilag_*_hu.pdf` ([RT84]),
`holdcomputers_A_HT_szamitogeprol_Vidovenyecz.pdf`.

Not downloaded but useful: System-80 schematics as JPGs on classic-computers.org.nz (CPU board
4.1, memory 4.3, video 4.5, cassette 4.6/4.8, keyboard+PSU 4.9 — links on
https://ht.homeserver.hu/html/hardverreszletek.html); the HT-1080Z/64 operating manual (8 MB) and
"HT-1080Z iskolaszámítógép fix tárolója" (ROM book, 22 MB) on
https://ht.homeserver.hu/html/dokumentaciokonyvek.html; the Tandy *TRS-80 Micro Computer
Technical Reference Handbook* (26-2103) — no free copy located.
