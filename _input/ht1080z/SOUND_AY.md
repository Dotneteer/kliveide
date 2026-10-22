# HT-1080Z: the AY-3-8910 sound and I/O panel

Research note, 2026-10-22. Sources:
- [HANG]: the sound panel schematic, "HT School Computer Hang panel (HT-1080Z, HT-2080Z)", drawing Y04-1000-00-1E (`docs/ht1080z64_schematic_ht_hang.pdf`), traced from a 600-dpi render.
- [F]: the CPU board (F panel) schematic.
- [E2]: the video board (E panel) schematic, sheet 2.
- [HT-USER]: the HT user manual, Appendix D, pp. 26–31 (`docs/ht1080z_hasznalati_utmutato_user_manual_hu.pdf`).
- [RT2]: Dr. Bagány Mihály, "A HT-1080Z iskolaszámítógép összekapcsolása a külvilággal 2.", *Rádiótechnika* 1984/8, pp. 8–9 (`docs/radiotechnika_1984_08_ht1080z_kulvilag_2_hu.pdf`).
- Emulator sources: MAME `src/mame/trs/trs80.cpp` (master, read 2026-10-22), MiST `ht1080z.vhd` (`ba57e3ca`), MiSTer `rtl/trs80.vhd` (`bec5f720`).

*Inference* marks conclusions.

## 1. What is on the panel

- **IC1, General Instrument AY-3-8910** (40-pin; the schematic names no YM2149) [HANG]. Glue
  logic: IC2 74LS00, IC3 74LS30, IC4 74LS04, IC5 74LS02.
- **Chip-select pins:** A8 (pin 25) is tied to +5 V and /A9 (pin 24) to GND, so the chip is always
  selected. **BC2** (pin 28) is tied to +5 V [HANG].
- The panel sits on the internal bus connector ("BCS/…": D0–D7, A0–A7, /IN, /OUT, a reset line,
  power). It also has a separate **internal connector ("Belső csatl.")**: pin 1 brings the clock
  "from the CPU board", and pin 6 takes the audio to the video board [HANG]. The BCS numbering is
  *not* the 50-pin expansion edge's numbering (for example, D0 is BCS/17 but edge pin 15).

## 2. Port decode, traced gate by gate [HANG]

| Gate | Inputs | Output |
|---|---|---|
| IC2 (NAND, pins 4/5 → 6) | /OUT (BCS/31), /IN (BCS/30) | **IOSTB** = high during any IN or OUT |
| IC2 (NAND, pins 9+10 → 8) | /IN on both inputs | **IN** = high during an IN |
| IC3 (74LS30, 8-input NAND → pin 8) | IOSTB, /A7, /A6, /A5 (through IC4), A4, A3, A2, A1 | **/SEL** = low when A7–A1 = 0001111 and an I/O strobe is active |
| IC5 (NOR, pins 2/3 → 1) | IN, /SEL | **BDIR** (pin 27) = high on an **OUT** to 1Eh/1Fh |
| IC5 (NOR, pins 5/6 → 4) | /SEL, /A0 (through IC4) | **BC1** (pin 29) = high when 1Eh/1Fh is selected **and A0 = 1** |

With BC2 = 1 the AY bus modes give:

| CPU cycle | BDIR | BC1 | AY function |
|---|---|---|---|
| `OUT (1Fh)` | 1 | 1 | **latch register address** |
| `OUT (1Eh)` | 1 | 0 | **write data** to the latched register |
| `IN (1Fh)` | 0 | 1 | **read data** from the latched register |
| `IN (1Eh)` | 0 | 0 | inactive: nothing drives the data bus |

- **Register reads are at port 1Fh (31), not 1Eh.** Two sources confirm this independently: the
  schematic above, and the working program in [RT2] (program 4 reads the I/O ports with
  `OUT 31,14 … D=INP(31)`). The article's prose says `INP (30)`; the listing and the circuit
  both say 31, so treat the prose as a misprint.
- **MAME gets this wrong:** it maps reads at 1Eh (`map(0x1e,0x1e).rw(… data_r, data_w)`,
  `map(0x1f,0x1f).w(address_w)`). MiST and MiSTer never return AY data to the CPU at all (their
  `snddo` is unused). Software that reads R14/R15 (user-port inputs) or reads back registers
  only works with the 1Fh read.
- **Reading 1Eh** returns whatever the floating data bus gives. On these boards that is
  *probably* FFh (*inference*: unmapped Genie ports read high; not verified).
- The decode ignores A8–A15, so the port is selected by the low byte only. `OUT (C),r` with any
  B works.
- The decode does not use /M1 or /IORQ directly; it uses the CPU board's decoded /IN and /OUT.
  The base machine has no interrupts, so no INTA cycle can falsely select it.

## 3. The clock

- [HANG]: AY pin 22 (CLOCK) comes from "Belső csatl./1", annotated "CPU board". The signal
  name is not written on the drawing.
- The CPU board's clocks [F] are **CLOCK** (Cs2.1, the 10.6645 MHz crystal), **CLOCK/2**
  (Cs2.7, about 5.33 MHz, sent to the video board for VIDEO CUT) and **Φ** (IC38 74LS92 ÷6 →
  1.77742 MHz, also on edge pin 30, PHI).
- The AY-3-8910's specified maximum clock is 2 MHz (it has no ÷2 SEL pin; that is a YM2149
  feature). **Φ is the only clock on the CPU board within that limit.**
- *Inference, strong but not proven by a label:* the **AY clock = Φ = the CPU clock**: 1.77742 MHz
  on the /64, about 1.774 MHz on Series I/II. Both FPGA cores make the same choice (MiST:
  `ENA => cpuClkEn`; MiSTer: `CE => cpuClk`). MAME's 1.5 MHz is commented "guess of clock" and
  is contradicted by all of this.
- If it is Φ, the AY runs **in lockstep with the CPU: one AY input clock per T-state.** The
  internal prescaler is ÷8, so tone, noise and envelope counters step every **8 T-states**.
  - Tone frequency = Φ / (16 × TP): from 27.1 Hz (TP = 4095) to 111 kHz (TP = 1).
  - The user manual's example TP = 3768 (R3 = 14, R2 = 184) [HT-USER p.31] would be 29.5 Hz.
  - Envelope step rate = Φ / (256 × EP).
  - A 50 Hz frame (34,944 T) is exactly **4,368 prescaler ticks**.
- **Klive relevance:** the ZX Spectrum 128's AY clock is 1.7734 MHz, 0.2 % from the HT's.
  Klive's existing AY core needs only a different clock constant.
- **How to prove it on hardware:** measure pin 22 with a counter. Or play a known tone, for
  example TP = 100 on channel A, which should read 1,110.9 Hz at 1.7774 MHz and 937.5 Hz at
  MAME's 1.5 MHz.

## 4. Output and mixing

- **Channels A, B and C (pins 4, 3, 38) are wired together** onto one node, with a 1 kΩ load
  (R1) to ground [HANG]. The output is mono.
  - The AY's channel outputs are emitter/source followers, so shorting them gives a **non-linear
    sum**: the loudest channel dominates (*inference*, standard AY behaviour with tied outputs).
    A linear sum of the three DAC levels, scaled, is a reasonable first model.
  - Maximum output level is 1.5 Vpp [HT-USER p.26].
- The mono signal goes to:
  - **rear connector CS1 pins 9–10** (line out on the 20-pin user port) [HANG], [HT-USER p.22];
  - **internal connector pin 6 → video board LK.6 "Hang gen"** [HANG], [E2]. On the E panel it
    passes through C27 (10 µF) and R46 into the T11/T12 (BC237/2N2219) amplifier and the
    built-in loudspeaker H1. The **cassette-port beeper** (port FF D0/D1 through IC6 74LS175,
    R44/R45/C33/D13) feeds the same amplifier input [E2].
- So **the AY and the port-FF beeper mix in one speaker.** The beeper is muted while the cassette
  relay bit (FF D2) is on (HARDWARE.md §6.1); the AY is not. MAME mixes the AY into its "mono"
  route at 0.25.

## 5. I/O ports A and B: the "user port"

- IOA0–IOA7 (pins 21–14) go to rear connector **CS1 pins 1–8**, and IOB0–IOB7 (pins 13–6) to
  **pins 11–18**. Pins 9–10 carry the sound output and 19–20 are GND [HANG], [HT-USER p.22],
  [RT2 Fig. 4].
- The connector is a 20-pin HONDA MFC-20 PM [RT2].
- Direction comes from R7 bits 6 (port A) and 7 (port B), with 0 = input [HT-USER p.27]. [RT2]
  tabulates R7 values: 0–63 both in, 64–127 A out, 128–191 B out, 192–255 both out.
- [RT2]: after reset **all bits of both ports read high (about 4.5 V), whether input or output.**
  This matches the AY's internal pull-ups and register reset.
- Reading: `OUT 31,14` (or 15), then `INP(31)` (§2). Writing: `OUT 31,14 : OUT 30,value` with
  the port set as an output.
- Emulation: unconnected inputs read **FFh**, as MiSTer does (`IOA_in => (others => '1')`). A
  user-port device (the school UNICOMP-02 measuring unit, lamp demos) would be an optional
  peripheral.

## 6. Reset

- AY pin 23 (/RESET) comes from **BCS/48** on the internal bus connector [HANG]. The earlier note
  in HARDWARE.md §6.2 read this as the bus /RESET.
- The BCS numbering is not the edge numbering, and on the edge pin 48 is /NMI, which the RESET
  key drives. So **whether the rear RESET key (NMI) also resets the AY is unverified.**
- *Inference:* most likely BCS/48 is the power-on /RESET. The AY then silences only at power-on;
  pressing RESET (NMI) leaves it playing until software rewrites R7/R8–R10. The ROM's NMI
  handler does not touch ports 1Eh/1Fh, as far as the ROM notes show.

## 7. Registers and software

- The register map is the standard AY one [HT-USER pp.26–30]: R0–R5 tone periods (12-bit),
  R6 noise period (5-bit), R7 mixer and I/O direction, R8–R10 amplitude (bit 4 = envelope),
  R11–R12 envelope period, R13 envelope shape, R14–R15 I/O ports. The manual's envelope figures
  (shapes 0–15) match the GI datasheet.
- **There is no BASIC keyword.** Programs use `OUT 31,reg : OUT 30,val`; the manual's examples
  are the sea noise and a locomotive [HT-USER pp.30–31]. A "demonstration cassette" had a
  sound-programming tool [HT-USER p.31].
- An `OUT` lasts 11 T-states including the I/O wait state, and BDIR/BC1 are held for /OUT's
  width (about 2.5 T = 1.4 µs). That is well inside the AY's bus timing. **No wait states are
  added.**

## 8. Emulation recipe

```
AY clock      = CPU clock (crystal / 6)      -> step the AY prescaler once per T-state, tick every 8
OUT 1Fh       = latch register (low 4 bits)  OUT 1Eh = write latched register
IN  1Fh       = read latched register        IN  1Eh = open bus (FFh)
port A/B in   = FFh when nothing attached
output        = mono (A+B+C), mixed with the port-FF beeper into one speaker
reset         = power-on only (RESET key = NMI does not reset the AY; unverified)
```

## 9. Open points

| Item | Status |
|---|---|
| AY clock = Φ | By elimination (datasheet limit) plus both FPGA cores; the signal on internal connector pin 1 is not labelled. Measure, or record a known tone. |
| Series I/II sound board | The Series I "blue-connector" AY board may differ. [HANG] is the drawing used for the HT-1080Z/HT-2080Z (dated 1985). |
| BCS/48 | Power-on /RESET or NMI: the internal connector pinout is not documented. |
| Reading 1Eh | Open bus value not verified. |
| Exact analog mix of tied outputs | Not characterised. A linear sum is the starting model. |
