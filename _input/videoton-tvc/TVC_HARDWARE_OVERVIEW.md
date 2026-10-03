# Videoton TV Computer (TVC) — hardware overview

A short orientation to the TVC's main hardware blocks and how they work with the Z80A, with the
emphasis on timing between the CPU, the video circuit and the sound generator.

**Where this comes from.** Three sources in this folder, cited inline:

- **[HW]** `tvchardver.pdf` — the 1988 Hungarian hardware manual (Benedek–Monok). Page numbers are
  the book's printed numbers (PDF page = book page + 1). Chapter 2.2.4 (pp. 47–55) covers timing.
- **[MAME]** `mame/src/mame/videoton/tvc.cpp` and `tvc_a.cpp` (sound).
- **[rtvc]** `rtvc/info/tvc.md` (rtvc's hardware reference) and `rtvc/src/emulator/sound.rs`.

Statements marked *inference* are my reading of the sources, not something a source says outright.

---

## 1. Block diagram

```text
                 25 MHz crystal
                       │  ÷2 ÷2 ÷2 (fixed-phase flip-flop chain, HW p.48–49)
          ┌────────────┼──────────────┬──────────────────────┐
       12.5 MHz     6.25 MHz       3.125 MHz (3M125)      1.5625 MHz (DEB)
       pixel shift  pixel shift    pixel shift (16-col)   CPU/CRTC VRAM slot select
       (2-colour)   (4-colour)     sound divider clock    = CRTC character clock
                    clock-stretch  ── CPU clock source ──┐
                    logic                                │ (stretchable)
                                                         ▼
 ┌───────────┐  address/data bus   ┌──────────────────────────────────────┐
 │  Z80A     │◄───────────────────►│ Memory mapper (port 02h, 64K+: 0Fh)  │
 │ 3.125 MHz │                     │  SYS ROM · CART ROM · U0–U3 RAM ·    │
 └─────┬─────┘                     │  EXT (card window + EXTH ROM) · VRAM │
       │ INT                       └───────────────┬──────────────────────┘
       │                                           │ time-multiplexed
       │                                ┌──────────▼──────────┐
       │                                │ Video RAM (16 KiB,  │
       │                                │ 64K+: 4 × 16 KiB)   │
       │                                └──────────▲──────────┘
       │                                           │ MA/RA → VRAM address
       │                                ┌──────────┴──────────┐   shift register
       │      CURSOR output ────────────┤  MC6845 CRTC        ├──► palette/IGRB ─► RGB/PAL
       │            │                   └─────────────────────┘    border latch
       │      ┌─────▼─────┐
       ├──────┤ shared IT │◄── sound divider (port 05h bit 5 enables)
       │      │ flip-flop │    cleared by OUT (07h),  status = IN (59h) bit 4
       │      └───────────┘
       ├── expansion slots 0–3: I/O 10h–4Fh, IRQ bits 0–3 of IN (59h), NMI line
       └── keyboard (03h/58h), cassette (50h–57h, 59h bit 5, 05h bits 6–7), printer (01h)
```

## 2. The main blocks

| Block | What it is | How the CPU talks to it |
|---|---|---|
| **CPU** | Z80A at 3.125 MHz (320 ns T-state), but its clock is **stretched** on video RAM access (§4). | — |
| **Memory mapper** | Four 16 KiB windows. Port `02h` picks SYS ROM / CART ROM / RAM U0–U3 / VRAM / EXT per window. On the 64K+, port `0Fh` picks which of four VRAM banks appears in pages 1 and 2 **and, separately, which bank is displayed** — so software can draw into one bank while another is shown. [rtvc §Memory map; MAME `bank_w`, `vram_bank_w`] | Memory reads/writes |
| **Video RAM** | Dynamic RAM shared by CPU and CRTC by **time-multiplexing** (§3). | Mapped into page 2 (or page 1 on the 64K+) |
| **MC6845 CRTC** | Used only as a counter/address generator and timing source. TVC logic turns its MA/RA outputs into a VRAM address, serializes the byte, and colours it. Its CURSOR output is **the normal 50 Hz interrupt**, not VSYNC. | Ports `70h`/`71h` (mirrored to `7Fh`) |
| **Pixel path** | One byte per character clock, shifted out at 12.5 / 6.25 / 3.125 MHz for 2-, 4- and 16-colour modes (8, 4, 2 pixels per byte). Palette registers `60h–63h` serve the 2/4-colour modes; 16-colour mode carries IGRB directly in the byte. Border colour at port `00h`. [HW p.51; MAME `crtc_update_row`] | Ports `06h` (mode), `60h–63h`, `00h` |
| **Sound** | A 12-bit programmable divider clocked by 3.125 MHz, then a ÷16 counter, then a 4-bit resistor DAC (amplitude). The same counter can raise the shared interrupt. [HW pp.100–102] | Ports `04h`, `05h`, `06h`; `IN (5Bh)` restarts it |
| **Interrupts** | CRTC cursor and sound share **one latched flip-flop** → Z80 INT. Expansion cards have their own INT lines (and NMI). | `IN (59h)` status, `OUT (07h)` acknowledge |
| **Keyboard, cassette, printer** | Plain I/O: keyboard matrix row select/read; cassette output is a flip-flop toggled by any access to `50h–57h`, input is a status bit; all FSK coding is in ROM software. | `03h`, `58h`, `50h`, `59h`, `01h` |
| **Expansion bus** | Four slots, each with a 16-port I/O window and an ID; one card at a time maps 8 KiB at `C000h`. The HBF floppy card (WD1793) is the usual occupant of slot 0. | `10h–4Fh`, `5Ah`, port `03h` bits 6–7 |

## 3. CPU ↔ video: one RAM, two users

The CPU and the CRTC share the video RAM by **time slicing**, driven by a free-running signal,
**DEB**, at 1.5625 MHz [HW pp.50–52]:

```text
 DEB      ┌───── 320 ns ─────┐                  ┌───── 320 ns ─────┐
          │   CPU slot       │   CRTC slot      │   CPU slot       │   CRTC slot
          ┘                  └───── 320 ns ─────┘                  └──── ...
          |<-------------- 640 ns = 1 CRTC character clock = 2 CPU T-states -------------->|
```

- DEB is NVMUX (a 3.125 MHz signal) halved, and the CRTC clock NCCLK is DEB's inverse — so **one
  CRTC character clock = one CPU slot + one CRTC slot = exactly 2 CPU T-states**.
- In every CRTC slot the display logic fetches one byte and loads it into the shift register
  (NLOAD). The CPU uses its slot only if it is actually addressing VRAM (signals STB/STA).
- *Inference:* because DEB runs all the time, the CRTC slot exists in the border and blanking too,
  so a VRAM access costs the CPU the same whatever the beam position. That differs from the
  ZX Spectrum, where contention applies only during the active display.

### The clock stretch

A Z80 instruction takes a variable number of T-states, so its memory cycle can't be locked to DEB in
advance. Instead, when the CPU addresses VRAM, a circuit **stops the CPU clock** until the memory
cycle lines up with the next CPU slot [HW pp.53–55, figures 18–22]:

- The stretch is counted in **half T-states (160 ns, one 6.25 MHz period)**, and is **1 to 4 units**,
  depending on which of four possible phases T1 started in relative to DEB. Figure 20 of the manual
  gives every case (transcribed in [TVC_CLOCK_STRETCH_FIGURES.md](TVC_CLOCK_STRETCH_FIGURES.md)):

  | T1 phase after CPU-slot start (160 ns units) | 0 | 1 | 2 | 3 |
  |---|---:|---:|---:|---:|
  | Read/write stretch (half-T) | 2 | 1 | 4 | 3 |
  | Opcode fetch (M1) stretch (half-T) | 3 | 2 | 1 | 4 |
- For a **memory read/write**, the clock is held **high in T3** until T3's falling edge follows a
  1→0 transition of DEB. For an **opcode fetch (M1)** from VRAM, it is held **low in T2** until T3's
  rising edge follows that transition. An M1 needs half a clock less. Code can run from VRAM.
- Consequence: the **CPU clock is not the fixed 3M125 signal**. The CPU drifts in half-T-state
  steps relative to the CRTC and the sound divider, which both stay on the fixed clock tree.
  An exact emulator needs a 6.25 MHz (half-T-state) time base, and it must track the CPU's phase
  against DEB from one VRAM access to the next.

### The WAIT circuit (HBA / HBA-1 boards)

Separately, a WAIT circuit can insert **one wait state per opcode fetch**. It does so only when the
fetch is from a slow source: a cartridge (FAST line), an expansion card (NSLOWEXP), or, depending on
board jumpers TB1/TB9, the system ROM. It can request only a single WAIT per M1 [HW pp.95–96].

## 4. Video timing as the firmware programs it

The CRTC registers are software-set; these are the ROM's values [rtvc §Normal firmware CRTC programming]:

| Quantity | Value | In CPU T-states |
|---|---|---|
| Character clock | 1.5625 MHz (640 ns) | 2 |
| Scan line | R0 = 99 → 100 chars = 64 µs | **200** |
| Active area | R1 = 64 bytes × R6 = 60 rows × 4 rasters (R9 = 3) = 64 × 240 bytes → 512 × 240 px | 128 T per line active |
| Frame | (R4 + 1) × 4 + R5 = 78 × 4 + 2 = **314 lines** | **62,800** → 49.76 Hz |
| VRAM address | `RA0–1 → A6–7`, `MA0–5 → A0–5`, `MA6–11 → A8–13`: four rasters of a character row sit in one 256-byte block | — |

The frame really is 62,800 T. rtvc's "62,500-cycle nominal frame" (exactly 50 Hz) is only
its host scheduling quantum, as rtvc itself notes.

**The frame interrupt comes from the CRTC cursor.** The ROM puts the cursor at `R14/R15 = 0EFFh`
(the last byte of the picture) on raster 3 (`R10 = R11 = 3`), so CURSOR pulses on the **last active
scan line**, once per frame. That sets the shared interrupt flip-flop; it stays set (the Z80 INT
line is held) until software writes anything to port `07h`. [MAME `int_ff_set`/`flipflop_w`;
rtvc §Interrupt system] Because the position is in registers, software can move it, and does:
VT-DOS leaves the cursor at `0AFFh`, which fires the interrupt at character row 43 instead. Raster
effects should therefore be timed from the interrupt itself, not from an assumed frame start.

## 5. Sound and its timer interrupt

```text
3.125 MHz ─► 12-bit loadable counter ─► ÷2 (QA: TX/RX clock) ─► ÷8 (QB–QD) ─┬─► AND (05h bit 4) ─► 4-bit DAC ─► audio
             (counts 4096 − n clocks)                                        └─► AND (05h bit 5) ─► shared IT flip-flop
             n = port 05h[3:0] : port 04h                                        amplitude = port 06h bits 2–5
```

- **Pitch:** `f = 3,125,000 / 16 / (4096 − n) = 195,312.5 / (4096 − n) Hz`, so about 47.7 Hz to
  97.7 kHz. Both emulators treat `n = FFFh` as "oscillator stopped". [MAME `tvc_a.cpp`; rtvc §Sound]
  The manual gives a ÷2…÷4096 range for the programmable counter [HW p.101].
- **The clock is the fixed 3M125.** Sound pitch and interrupt timing don't change when the CPU
  is stretched on VRAM access.
- **Two output modes:** with port `05h` bit 4 set, the square wave gates the 4-bit amplitude. With
  it clear, the amplitude goes straight to the DAC, so software can play stepped waveforms
  (sampled sound). The DAC is a resistor ladder giving 16 near-equal levels [HW p.102]; the output
  is AC-coupled.
- **As a timer:** with port `05h` bit 5 set, the counter raises the **same** interrupt as the
  CRTC cursor. `IN (5Bh)` (INSTART) reloads the divider and clears the ÷16 counter, which gives a
  precisely phased timer. The cassette routines use it for about 20 ms timing. The ISR can't tell the
  two sources apart from hardware status; it has to know which one it enabled.

## 6. What the two emulators do and don't model

| Behaviour | MAME | rtvc |
|---|---|---|
| CPU clock stretch on VRAM access (§3) | **no** | **no** (no trace in source or docs) |
| One-WAIT-per-M1 for slow devices | no | no |
| CRTC advanced at 2 T-states per character clock, raster effects | no; row-at-a-time render, "mid-frame changes" in its TODO list | **yes** (interleaved mode) |
| Border colour | no (`border_color_w` is empty) | yes |
| Cursor interrupt from live CRTC registers | yes (MC6845 callback) | yes |
| Sound DAC mode (bit 4 clear) | no; only outputs while oscillator is enabled | yes |
| Sound interrupt phase after `IN (5Bh)` | first IRQ after one full period | IRQ on 4-bit counter wrap (16 divider carries) |

**Open questions to settle before implementing:**

1. **Stretch table: transcribed, not yet cross-checked.** Figures 20–22 are now in
   [TVC_CLOCK_STRETCH_FIGURES.md](TVC_CLOCK_STRETCH_FIGURES.md), with the rule they encode.
   ep128emu (not cloned here) says it synchronises VRAM access with the CRTC at cycle level, so it
   is a second reference to compare against. That file lists its own remaining unknowns: the
   64K+ board, DEB phase at reset, and whether the M1 refresh address can trigger a stretch.
2. **First sound interrupt after INSTART.** [HW p.102] says the IT request appears when QD goes high
   "on the eighth overflow", i.e. **8** divider periods after restart. Both emulators fire after
   **16**. Repeated interrupts are 16 periods apart either way; only the first one's phase differs.
3. **64K+ differences.** The 64K+ has a discrete oscillator and different reset logic [HW p.48], and
   the WAIT circuit is described only for the HBA/HBA-1 boards. Whether the 64K+ board keeps the same
   stretch and WAIT behaviour needs checking in the 64K+ schematics (`TVC_HBA2_rajzok.pdf`,
   `tvc64kplus_bw.pdf`).
