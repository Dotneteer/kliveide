# Enterprise 64/128 — DAVE, memory map, interrupts, sound and I/O

Research notes for a cycle-accurate Enterprise 64/128 emulator in Klive IDE. This file covers the
DAVE chip (paging, wait states, interrupts, sound, I/O strobes), the memory map, and the I/O
port map. NICK video is covered only where it affects DAVE: the VINT interrupt and VRAM wait states.

Conventions:
- Ports are hex. "Segment" is a 16 KB block of the 4 MB physical space (00h–FFh). "Page" is one
  of the four 16 KB Z80 windows (page 0 = 0000h–3FFFh … page 3 = C000h–FFFFh).
- **Primary spec** means the original Intelligent Software DAVE document ("DPC Sound Chip,
  DPC/Dave/1 Issue 5", 1984), transcribed by David Bouman: <http://ep.lgb.hu/doc/Dave.html>.
  Its Hungarian translation, with extra hardware notes by later researchers, is in the Hungarian
  EXOS book: <https://ep128.hu/Ep_Konyv/Exos.htm>. These are called **EXOS book / HW
  appendix** below. The appendix sections "Néhány kiegészítés a DAVE dokumentációjához", the
  B5h/B6h/B7h/BFh port notes and the wait-state notes read like IstvanV's measurements (he wrote
  ep128emu), but the page does not sign them. That attribution is *inference*.
- *Inference* marks my own conclusions. Where sources disagree, both versions are given.
- Emulator references give the file and function. Everything is paraphrased; no code is copied.

---

## 1. Clocks and CPU timing

| Item | Value | Source |
|---|---|---|
| Master oscillator | 8 MHz (a separate 4.433619 MHz crystal is for PAL video) | MAME `ep64.cpp` header notes: <https://github.com/mamedev/mame/blob/master/src/mame/enterprise/ep64.cpp> |
| Z80A clock | 4 MHz = 8 MHz / 2 | MAME `ep64.cpp` machine config; Wikipedia <https://en.wikipedia.org/wiki/Enterprise_(computer)> |
| DAVE input clock | 8 MHz (BFh bit 1 = 0) or 12 MHz (bit 1 = 1) | Primary spec R31 |
| DAVE sound and timer base ("250 kHz") | 8 MHz / 32 = 250 kHz, which is Z80 clock / 16. With BFh bit 1 = 1 the divide is /48 (Z80 clock / 24), so all DAVE frequencies drop by 1.5× (166.67 kHz) | EXOS book HW appendix (BFh section); ep128emu `dave.hpp` (`clockDiv` 2 or 3 applied to a 500 kHz call rate) <https://github.com/istvan-v/ep128emu/blob/master/src/dave.hpp> |
| DAVE 1 MHz output | "1MHz system clock" pin | Primary spec |
| NICK slot rate | 889 846 Hz (14.2375 MHz / 16), about 4.495 Z80 cycles per slot at 4 MHz | ep128emu `ep128vm.cpp` defaults <https://github.com/istvan-v/ep128emu/blob/master/src/ep128vm.cpp>; EXOS book HW appendix |

How ep128emu schedules this (`Ep128VM::run`, `ep128vm.cpp`): time is advanced in NICK slots. For each
slot it runs the DAVE cycles due (DAVE nominal 500 kHz, each `Dave::runOneCycle()` call divides by
`clockDiv` = 2 or 3 into the 250 kHz `runOneCycle_()`), executes Z80 instructions while the CPU
cycle budget is non-negative, and then runs one NICK slot. The budgets are 32.32 fixed-point.
`runDevices()` catches the devices up mid-instruction when an I/O access happens.

CLK (Clock Signal) clocks its DAVE at machine clock / 8 = 500 kHz, with the same /2 or /3 divider
(`Machines/Enterprise/Enterprise.cpp`, `Dave.cpp`): <https://github.com/TomHarte/CLK/tree/master/Machines/Enterprise>.

### 1.1 Wait states (port BFh bits 2–3)

The primary spec says the generator can give no waits, waits on opcode fetch only, or waits on
all memory accesses. It never waits on video RAM: the spec says this "would conflict with Z80 clock stretch".

| BFh b3:b2 | Behaviour (non-video memory) |
|---|---|
| 00 | Wait on every memory access (except video RAM). This is the state after DAVE reset, because reset clears all registers. |
| 01 | Wait on M1 (opcode fetch) only. The EXOS book calls this the "default" mode, *inference*: the mode EXOS sets during boot. |
| 10 / 11 | No waits |

Details from the EXOS book HW appendix (BFh section):
- One wait is **1 Z80 cycle** at 4 MHz and 2 cycles on turbo machines (6 or 7.119 MHz). BFh bit 1
  does **not** change the length of the wait.
- An M1 read counts: the first opcode byte; after a DDh/EDh/FDh prefix, the next byte too; after
  CBh, the next byte only if no DDh/FDh came before the CBh. So the `DD CB d op` displacement and
  opcode bytes are not M1. This matches the Z80's own M1 and R-refresh behaviour.
- I/O cycles get no DAVE wait. Only NICK ports 80h–8Fh are synchronised (see 1.2).

ep128emu (`ep128vm.cpp`, `setMemoryWaitTiming` / `setMemoryWaitMode`):
- `waitCycleCnt` is 1 (2 if the CPU clock is above 5 MHz).
- Mode 0: opcode fetch costs 4 + w, other memory accesses 3 + w.
- Mode 1: opcode fetch costs 4 + w, other accesses 3.
- Modes 2 and 3: 4 and 3.
- The VM constructor sets mode 1. `Dave::reset()` writes 0 to every register, BFh included, and
  the BFh write handler calls `setMemoryWaitMode((value >> 2) & 3)`. So after a DAVE reset the
  mode is 0, until EXOS writes BFh.

CLK disagrees (`Enterprise.cpp`): it treats BFh bit 1 as making the DAVE delay 2 cycles instead of
1. Both other sources say bit 1 is the input-clock select and does not affect wait length.

### 1.2 Video RAM (segments FCh–FFh) and NICK port contention

Every Z80 access to segments FCh–FFh, and every I/O access to ports 80h–8Fh, is synchronised to the
889 846 Hz NICK slot by NICK stretching the Z80 clock. This happens whatever BFh says.

EXOS book HW appendix, an approximation for 4 MHz:
1. Take the Z80 cycles between two video accesses and add 1.5.
2. Round the result up to a multiple of 4.5.
3. The wait is the difference, in 0.5-cycle steps.

The access points inside the machine cycle are:

| Cycle type | Length | Point of access |
|---|---|---|
| M1 fetch | 4 T | 2.0 T |
| Memory read/write | 3 T | 2.5 T |
| I/O | 4 T | 3.5 T |

ep128emu (`ep128vm.cpp`, `videoMemoryWait`, `videoMemoryWait_M1`, `videoMemoryWait_IO`):
- First it charges a fixed base: 2 cycles for memory, 1.5 for M1, and for I/O the instruction's
  4-cycle cost minus 1 added back.
- It then works out the phase inside the current NICK slot. The phase uses the CPU-to-NICK cycle ratio
  plus a latency term in picoseconds (defaults 359 455, 355 589 for M1 and 362 928 for I/O).
- The added wait is quantised to half cycles.

CLK (`Enterprise.cpp`): each 16-cycle NICK window gives 10 cycles to VRAM fetch and 6 to the Z80.
It delays the Z80 so the access's last cycle falls inside the window.

- Reading NICK ports 80h–8Fh still waits like a write. It returns the last byte NICK fetched on the
  video bus, because the bus has no pull-ups. Source: EXOS book, NICK register section.
- With BFh bit 0 = 1 ("16K on-board RAM"), only segment FFh is decoded as video memory.
  Source: EXOS book HW appendix.

---

## 2. Memory

### 2.1 Address formation

- DAVE has four 8-bit page registers, B0h–B3h. Z80 A15:A14 select one of them, and its value
  drives physical A21–A14. Z80 A13–A0 pass through. Physical address = segment × 4000h + offset.
  Total 22 bits = 4 MB = 256 segments. Sources: primary spec R16–R19; MAME `dave.cpp`
  (`program_r`/`program_w`) <https://github.com/mamedev/mame/blob/master/src/mame/enterprise/dave.cpp>.
- The page register outputs can be tri-stated with BREQ. Source: primary spec.
- **B0h–B3h are read/write**: reading returns the value written. Sources: primary spec ("R/W"),
  ep128emu `Dave::readPort` cases 10h–13h, MAME and CLK.

### 2.2 DAVE select outputs (the built-in decoding)

From the primary spec, "Select Outputs":

| Output | Active for | Notes |
|---|---|---|
| ROM | Memory access to segments 00h–03h (physical 0–FFFFh) | Gated externally with RD |
| CART | Segments 04h–07h (10000h–1FFFFh) | Gated with RD and WR |
| VRAM | Segments FCh–FFh (3F0000h–3FFFFFh) if BFh b0 = 0; every access that is not ROM or CART if BFh b0 = 1 | Goes to NICK (MREQ, RD, WR) |
| VIO | I/O 80h–8Fh | Goes to NICK |

### 2.3 Segment map

| Segments | Contents | Sources |
|---|---|---|
| 00h–01h | Internal 32 KB EXOS ROM (EXOS 2.0 or 2.1, with the built-in word processor) | EXOS book §2.2.1; MAME `ep64.cpp` maps a 32 KB `u1` ROM at physical 0 |
| 02h–03h | Covered by the ROM select. On a stock machine, *inference*: either mirrors of 00h–01h or open bus, unverified. Later 64 KB EXOS versions (2.3 and up) use 00h–03h. | Primary spec select table; CLK ROM catalogue lists EXOS 2.3 as 64 KB (<https://git.applefritter.com/6502/CLK/commit/c7ff2cece42972ca4a32ecf97d693f1d1330f1e0>) |
| 04h–07h | Cartridge slot, up to 64 KB. IS-BASIC (16 KB) is at 04h. | EXOS book §2.2.1; MAME maps the cart at 010000h; ep128emu snapshot docs (EXOS at 0–1, BASIC at 4): <https://ep128emu.sourceforge.net/html/snapshot_header.html> |
| 10h, 20h, 30h … (multiples of 16) | Where EXOS looks for expansion ROMs. EXDOS is conventionally at 20h. | EXOS book §3.1; MAME `bus/ep64/exdos.cpp` maps EXDOS at 080000h = segment 20h |
| F8h–FBh | Second 64 KB of internal RAM (EP128 only). It is not video RAM. | EXOS book §2.2.1; Wikipedia; ChibiAkumas <https://www.chibiakumas.com/z80/enterprise128.php> |
| FCh–FFh | Internal 64 KB video RAM, the only RAM NICK can see. NICK addresses it as 0000h–FFFFh, so segment FCh = NICK 0000h, FDh = 4000h and so on, whatever the page registers hold. FFh is the EXOS system segment. | EXOS book §2.2.1 and §2.2.3; NICK spec <http://ep.lgb.hu/doc/Nick.html> |
| Everything else | Expansion RAM or ROM through the expansion bus (A16–A21 are on the connector) | MAME `bus/ep64/exp.h` pinout |

The ROM placement, as Wikipedia states it, disagrees: it puts a 64 KB cartridge at "pages 2-5".
The EXOS book, the primary-spec CART select (04h–07h) and MAME all put it at 04h–07h, so
Wikipedia is very likely wrong.

RAM sizes: 64K machine = FCh–FFh; 128K = F8h–FFh; 256K = F0h–FFh. RAM is always counted down from FFh
(ep128emu snapshot docs: <https://ep128emu.sourceforge.net/html/snapshot_memory.html>; CLK `Enterprise.cpp`).

ROM versions (sketchy, see Open questions):
- EP64: EXOS 2.0, 32 KB. MAME `ep64` ROM `9256ds-0038_enter05-23-a.u2`.
- EP128: EXOS 2.1, 32 KB. MAME `ep128` ROM `9256ds-0019_enter08-45-a.u2`.
- EXOS 2.3 (1987, 64 KB) and later community versions (2.4 and up) occupy 00h–03h.
- IS-BASIC 2.1 is a 16 KB cartridge at 04h.
- EXDOS 1.x is 16 KB on the EXDOS card; MAME carries a 32 KB `exdos13.rom`.

### 2.4 Unmapped and ROM behaviour

- Reads from unmapped segments return **FFh** in ep128emu: `memory.cpp`, where the read table points
  to a dummy block filled with FFh (<https://github.com/istvan-v/ep128emu/blob/master/src/memory.cpp>).
  CLK does the same. On real hardware this is the floating data bus, *inference*: usually FFh.
- Writes to ROM or unmapped segments are discarded.
- Video segments FCh–FFh are always present in ep128emu and cannot be ROM.

### 2.5 64K versus 128K

The only difference is the extra 64 KB at F8h–FBh, a plug-in board on EXP1/EXP2. Sources: MAME header
notes, and MAME's `dave_128k_mem` adds RAM at 3E0000h–3EFFFFh. The DAVE, NICK and ROM are otherwise
the same, though EP128 machines usually came with EXOS 2.1 and EP64 with 2.0. BFh b0 stays 0
("64K on-board") on both; 1 is for a 16K-RAM configuration that was never sold, *inference*.

---

## 3. Reset and power-up

- DAVE "Reset clears all 22 internal registers" (primary spec):
  - all four page registers become 00h, so the Z80 starts in EXOS ROM segment 0 at 0000h;
  - all interrupts are disabled;
  - BFh = 0: 8 MHz input, 64K on-board RAM, wait on all memory accesses;
  - sound is silent, since all volumes are 0;
  - B5h = 0: keyboard row 0, tape sound on, remotes off.
- DAVE also produces the Z80 reset (RSTO). Power-on uses an RC network on CAP. A low on RSTI
  (the reset button) gives a 1 ms pulse synchronised to the falling edge of M1, which protects
  DRAM contents. Source: primary spec.
- ep128emu `Dave::reset()` (`dave.cpp`): zeroes the counter phases, writes 0 to every register, then writes AAh to B4h.
  - AAh disables every interrupt and clears every latch.
  - On a cold reset it also clears the keyboard matrix.
  - Warm and cold reset both reset the Z80, DAVE, floppy and so on. Cold reset also randomises NICK and clears CMOS
    (`Ep128VM::reset`).
- **Warm and cold reset are an EXOS feature, not hardware.** Source: EXOS book §3.1–3.2.
  - Every reset button press restarts EXOS from ROM. If the user program set a warm-start address in
    `RST_ADDR` (system segment FFh, Z80 address BFF8h/BFF9h with FFh in page 2, physical 3FFFF8h), EXOS does a
    warm start: no RAM test or ROM scan, channels closed, devices reinitialised.
  - EXOS clears `RST_ADDR` before jumping, so **pressing RESET twice quickly always gives a cold start**.
  - ep128emu's cold reset clears 3FFFF8h/3FFFF9h for this reason.
- Cold start (EXOS book §3.1):
  1. ROM checksum test.
  2. RAM test of every segment except 00h–07h. The test destroys their contents.
  3. ROM scan at every segment that is a multiple of 16, plus all four cartridge segments. A ROM is
     recognised by the `EXOS_ROM` signature in its first 8 bytes.
  4. The flashing ENTERPRISE banner, until a key is pressed.

---

## 4. Interrupts

### 4.1 Sources

The primary spec lists four latched interrupts:
1. **1 Hz** (for clock applications).
2. **Selectable**: 1 kHz, 50 Hz, tone generator 0 or tone generator 1. The choice is A7h bits 6–5.
3. **INT1**: an external input, wired to NICK's VIRQ (the video interrupt).
4. **INT2**: an external input. MAME wires it to the serial or network RXD line. The EXOS book HW
   appendix marks it as possibly unused.

Each latch has its own enable and reset. Any set latch pulls the open-drain IRQ low, which is the Z80 /INT.

The Z80 runs in **IM 1**: EXOS keeps the interrupt entry at 0038h in the zero-page RAM segment (EXOS
book §2.2.2 and the zero-page table, "38h – Megszakítási vektor"). The ISR reads B4h to find the
source, calls the device handlers, then clears the latch in DAVE (EXOS book §7.5).

ep128emu sets the IM 2 vector base to FFh as a hack ("to get some programs using interrupt mode 2
working"), so the bus is effectively FFh during interrupt acknowledge. CLK also returns FFh
during acknowledge. NMI comes only from the expansion bus (`_NMI`, MAME `exp.h`); the stock machine
does not use it. The Spectrum emulator card uses it (ports 40h–44h).

### 4.2 Port B4h — write (R20 W)

| Bit | Primary spec meaning |
|---|---|
| 0 | 1 = enable 1 kHz / 50 Hz / tone-generator interrupt |
| 1 | 1 = reset its latch |
| 2 | 1 = enable 1 Hz interrupt |
| 3 | 1 = reset 1 Hz latch |
| 4 | 1 = enable INT1 (video) |
| 5 | 1 = reset INT1 latch |
| 6 | 1 = enable INT2 |
| 7 | 1 = reset INT2 latch |

Implementation precision from ep128emu (`Dave::writePort` case 14h):
- It works on `value XOR 55h`.
- Each enable flag takes the written enable bit.
- A latch (the "active" flag) is cleared if its reset bit is 1 **or** its enable bit is 0. Disabling a
  source clears its latch.
- If the last active latch clears, the CPU IRQ is released.
- EXOS's typical acknowledge writes back its enable mask with the reset bit of the serviced source set.
  The EXOS variable `IRQ_ENABLE_STATE` uses bits 0, 2, 4 and 6 for the enables (EXOS book §8, variable 0).

EXOS book HW appendix, the same behaviour in prose: the latch bits work only while the source is
enabled, otherwise they always read 0. A latch is cleared by writing 1 to it or by disabling the source.
"Until all 4 bits are cleared the Z80 keeps receiving interrupt requests", so /INT is level-triggered.

### 4.3 Port B4h — read (R20 R)

| Bit | Meaning |
|---|---|
| 0 | Divider of the 1 kHz / 50 Hz / TG source: a square wave at f_int / 2 that toggles on every source event |
| 1 | 1 = selectable-source latch set |
| 2 | 1 Hz divider: 0.5 Hz square wave |
| 3 | 1 = 1 Hz latch set |
| 4 | INT1 input pin level |
| 5 | 1 = INT1 latch set |
| 6 | INT2 input pin level |
| 7 | 1 = INT2 latch set |

Sources: primary spec; ep128emu `Dave::readPort` case 14h packs (state, active) pairs exactly like this.
EXOS passes the IRQ code to device handlers as bit 1 sound, bit 3 1 Hz, bit 5 video and bit 7 external
(EXOS book §7.5), which are the latch bits.

### 4.4 Edge rules (important for accuracy)

- **Timer sources (bits 0 and 2):** the latch is set on **every** toggle of the divider, rising and falling.
  - The 1 Hz divider toggles once a second, giving 1 interrupt/s.
  - "1 kHz" gives 1000 interrupts/s and "50 Hz" gives 50/s.
  - Tone-generator mode gives an interrupt on every reload of channel 0 or 1's counter:
    f = 250 000 / (n + 1), as the primary spec says. That is twice the channel's audio square-wave frequency.
  - Sources: primary spec ("Tone generator 0. f = 250,000/(n+1)"); EXOS book HW appendix; ep128emu
    `runOneCycle_`, which inverts `int_snd_state` on each underflow of the selected counter and calls
    `triggerIntSnd()`, which latches only if the latch is not already active.
- The tone-generator interrupt is driven by the raw counter reload. Distortion, filters, ring
  modulation and **sync** do not affect it. *Inference*: a channel held by its sync bit does not
  count, so it does not interrupt (ep128emu: `chnN_phase -= chnN_run`).
- The 50 Hz timer interrupt is exactly 5000 DAVE ticks = 80 000 Z80 cycles at 4 MHz, or 120 000 with
  BFh b1 = 1. It is **not** locked to the video frame. Source: EXOS book HW appendix.
- **External inputs (bits 4 and 6):** edge-triggered on the **falling** edge.
  Sources: primary spec ("negative edge triggered"); ep128emu `Dave::setInt1State` / `setInt2State`,
  which latch only on a 1→0 transition while enabled and not already active.
  - **MAME's `dave.cpp` `int1_w`/`int2_w` latch on the rising edge instead**, against the spec.
  - CLK latches NICK on a rising edge of its own (inverted) interrupt line.
- **VINT timing, a conflict.**
  - The NICK spec (<http://ep.lgb.hu/doc/Nick.html>, §11) says VIRQ goes low for the whole mode line whose LPB has
    VINT = 1, and the start of the low pulse causes the interrupt. Two consecutive VINT lines give only one
    interrupt.
  - The EXOS book HW appendix says B4h bit 4 reads as a copy of the current line's VINT bit, and the
    latch fires on its falling edge. So the interrupt comes at the **start of the first line after**
    the VINT line(s). The appendix is careful work, so this is probably measured, *inference*.
  - Follow the appendix and ep128emu; the NICK research should confirm which edge.
- The EXOS keyboard is scanned from the video interrupt (50 per second), so disabling VINT stops keyboard
  scanning (EXOS book §7.5 and keyboard §1).

---

## 5. Sound

### 5.1 Overview

Primary spec:
- Three tone generators, 30 Hz–125 kHz.
- One noise channel.
- Per channel, a 6-bit left and right amplitude. The four channels are time-multiplexed onto one
  external 6-bit resistor-ladder DAC per side, so each side reaches 0–252 (4 × 63).
- Either side can become a plain 6-bit D/A that outputs channel 0's amplitude register.
- The tape output is the left D/A (§7.3).

All counters run at the 250 kHz base (§1).

### 5.2 Tone channel registers A0h–A5h

| Port | Bits | Meaning |
|---|---|---|
| A0h / A2h / A4h | 7–0 | Channel 0 / 1 / 2 frequency code, low 8 bits |
| A1h / A3h / A5h | 3–0 | Frequency code, high 4 bits (12-bit code n) |
| | 5–4 | Distortion: 00 pure square; 01 sample the 4-bit poly; 10 sample the 5-bit poly; 11 sample the 7-bit poly (or the variable-length poly if A6h b4 = 1) |
| | 6 | 1 = high-pass filter, clocked by ch0←ch1, ch1←ch2, ch2←noise (ch3) |
| | 7 | 1 = ring modulator with ch0×ch2, ch1×noise, ch2×ch0 |

Source: primary spec R0–R5. The ChibiAkumas table labels these bits differently and is less precise; prefer the spec.

Channel mechanics (EXOS book HW appendix; ep128emu `runOneCycle_`):
- A 12-bit down-counter counts at 250 kHz. When it underflows, it reloads with n, so a period is
  n + 1 ticks. On each reload:
  - with no distortion, the flip-flop toggles. Output f = 125 000 / (n + 1) Hz;
  - with distortion, the flip-flop takes the current output bit of the selected free-running poly counter.
- A new code takes effect at the next reload. Writing does not reset the phase (ep128emu; MAME's
  note agrees).
- Code 0 does not work reliably on real hardware, so 125 kHz cannot be produced (EXOS book appendix).
- **Sync (A7h b0–b2):** while set, the counter is held at the programmed value and the flip-flop is
  forced to 0. When cleared, ep128emu reloads the phase from the code and restarts.
- **High-pass:** on each falling edge of the clocking channel's final output, the filtered channel's
  flip-flop is forced to 0. This can double the frequency.
- **Ring modulation:** the last stage. The output is XNOR with the other channel's final output.
- Every effect that reads another channel uses that channel's **final** output, after its ring modulator.
- ep128emu works through the channels in a fixed order inside one tick, using each partner's
  previous state for edge detection. Match the ordering if you want bit-identical output.
- CLK notes, citing SIDBasic, that ring modulation still applies while sync is set.

### 5.3 Noise channel register A6h

| Bits | Meaning |
|---|---|
| 1–0 | Noise clock: 00 = 31.25 kHz; 01 = tone ch0 output; 10 = ch1; 11 = ch2. The poly advances on **falling edges** of the selected clock. |
| 3–2 | Variable-length poly size: 00 = 17-bit, 01 = 15-bit, 10 = 11-bit, 11 = 9-bit |
| 4 | 1 = swap the 7-bit and variable-length polys. The tone channels' "7-bit" distortion then uses the variable-length poly at 250 kHz, and the noise channel uses the 7-bit poly at the noise clock. |
| 5 | 1 = low-pass, clocked by ch2: the noise output is re-sampled only on falling edges of ch2 |
| 6 | 1 = high-pass, clocked by ch0: the noise output is forced to 0 on ch0 falling edges |
| 7 | 1 = ring modulation (XNOR) with ch1 |

Sources: primary spec R6; EXOS book appendix; ep128emu `writePort` case 06h.

- Order of effects: low-pass, then high-pass, then ring modulator (EXOS book appendix; ep128emu).
- The 31.25 kHz clock is the same as clocking from a tone channel with code 3 (EXOS book).
- ep128emu builds it from a counter reloaded every 4 ticks (`clk_62500_frq` = 3) that toggles a state;
  the poly steps on that state's falling edges, giving 31.25 kHz.

The noise base clock is disputed:
- The primary spec, the EXOS book and ep128emu all say 31.25 kHz.
- Furnace's DAVE doc says about 62.5 kHz: <https://tildearrow.org/furnace/doc/latest/7-systems/dave.html>.
- CLK uses a "divide by four" counter, which reads as 62.5 kHz.
- Follow the primary spec.

The low-pass is also implemented differently:
- ep128emu holds the noise output and re-samples the noise poly output only on ch2 falling edges.
- CLK replaces the noise bit with ch2's current bit on a noise falling edge.
- The EXOS book wording matches ep128emu.

### 5.4 Polynomial counters (LFSRs)

There are four physical counters (EXOS book appendix; ep128emu `dave.hpp` / `DaveTables` and `calculate_polycnt`):

| Counter | Period | XOR taps (bit numbers) | Clock |
|---|---|---|---|
| 4-bit | 15 | 3 and 2 | Always 250 kHz; tone distortion only |
| 5-bit | 31 | 4 and 2 | Always 250 kHz; tone distortion only |
| 7-bit | 127 | 6 and 5 | 250 kHz for the tones (A6h b4 = 0), or the noise clock (b4 = 1) |
| Variable 9 / 11 / 15 / 17-bit | 511 / 2047 / 32767 / 131071 | 8&4 / 10&8 / 14&13 / 16&13 | Noise clock (b4 = 0), or 250 kHz for the tones (b4 = 1) |

Step rule (EXOS book): shift left by one, put taps XOR into bit 0, and output the new bit 0. The all-zero state
is forbidden, so the period is 2^N − 1.

ep128emu seeds every register with all ones. It precomputes each sequence into a table (stored reversed,
because the phase counts down) and indexes it with a phase counter. Its stored output is the higher
tap before the shift. That is the same sequence with a fixed phase offset. The EXOS book's worked
example: the 4-bit sequence repeats `100010011010111`. The real power-on seed is unknown, and the
book says it hardly matters.

When the variable length changes, ep128emu takes the phase modulo the new length.

Aliasing note (EXOS book): a tone code n with (n + 1) a multiple of the poly length gives silence,
because the same bit is sampled every time.

### 5.5 A7h — sync, D/A and interrupt select

| Bit | Meaning |
|---|---|
| 0 / 1 / 2 | Sync (hold) tone channel 0 / 1 / 2: 1 = hold at preset, output 0; 0 = run |
| 3 | 1 = left output becomes D/A: constantly outputs the A8h value. The EXOS book says the level equals four channels all "on" at A8h's volume, so A8h × 4 on the 0–252 scale. |
| 4 | 1 = right output becomes D/A, outputting the ACh value |
| 6–5 | Interrupt rate: 00 = 1 kHz, 01 = 50 Hz, 10 = tone gen 0, 11 = tone gen 1 |
| 7 | Undefined |

Sources: primary spec R7; ep128emu case 07h. ep128emu computes the D/A value as volume × 4. MAME
substitutes R8 for the left sum. CLK uses channel 0's raw amplitude.

### 5.6 Volume registers A8h–AFh

| Port | Meaning (bits 5–0; bits 7–6 undefined) |
|---|---|
| A8h | Ch0 left; also the left D/A value when A7h b3 = 1 |
| A9h | Ch1 left |
| AAh | Ch2 left |
| ABh | Noise left |
| ACh | Ch0 right; also the right D/A value when A7h b4 = 1 |
| ADh | Ch1 right |
| AEh | Ch2 right |
| AFh | Noise right |

- The output per side is the sum of the amplitudes of the channels whose output bit is 1.
- On hardware the four values are time-multiplexed through a 6-bit DAC. Summing is the normal
  approximation; CLK's author says he is unsure of the multiplexing detail.
- ep128emu also adds a constant 3Fh to both sides when tape feedback is on and the tape input is high
  (§7.2), and scales the result to 16-bit.
- A0h–AFh are **write-only** (primary spec). ep128emu and MAME return FFh when they are read.

### 5.7 Sample-rate advice

The DAVE state machine is stepped at 250 kHz (one step per 16 Z80 T-states at 4 MHz). ep128emu outputs
one sample per DAVE step and resamples later. *Inference*: a Klive implementation can step DAVE every 16
T-states (24 when BFh b1 = 1) from the Z80 T-state counter, then decimate to the host rate with a low-pass
filter, because the content reaches 125 kHz.

---

## 6. Keyboard and joysticks

### 6.1 Port B5h

B5h write (WR0, latched in 74LS273 U25). Sources: EXOS book HW appendix; LGB <http://ep.lgb.hu/doc/ports.html>; MAME `wr0_w`.

| Bit | Meaning |
|---|---|
| 3–0 | Keyboard row select. A 74LS145 BCD decoder drives KB0–KB9 low. Values A–F select no row. |
| 4 | Printer /STROBE (1 = strobe active; inverted on the way out) |
| 5 | 1 = **tape sound off**: tape input not mixed into the audio |
| 6 | 1 = REM1 motor relay on |
| 7 | 1 = REM2 motor relay on |

EXOS keeps a shadow copy of B5h in the system variable `PORTB5` at BFF3h (EXOS book §5.4), because
B5h cannot be read back.

B5h read (RD0, 74LS373 U27): the selected row, **active low**. A row of FFh means no key; rows 10–15 read FFh.

### 6.2 Key matrix

Row = B5h bits 3–0, bit = the bit in the B5h read; 0 = pressed. Agreed by ep128emu (`dave.hpp` comment
table), MAME (`ep64.cpp` INPUT_PORTS Y0–Y9), Xep128, the EXOS book HW appendix and ChibiAkumas.

| Row | b0 | b1 | b2 | b3 | b4 | b5 | b6 | b7 |
|---|---|---|---|---|---|---|---|---|
| 0 | N | \ | B | C | V | X | Z | L-SHIFT |
| 1 | H | LOCK | G | D | F | S | A | CTRL |
| 2 | U | Q | Y | R | T | E | W | TAB |
| 3 | 7 | 1 | 6 | 4 | 5 | 3 | 2 | ESC |
| 4 | F4 | F8 | F3 | F6 | F5 | F7 | F2 | F1 |
| 5 | 8 | — | 9 | - | 0 | ^ | ERASE | — |
| 6 | J | — | K | ; | L | : | ] | — |
| 7 | STOP | ↓ (joy down) | → (joy right) | ↑ (joy up) | HOLD | ← (joy left) | ENTER | ALT |
| 8 | M | DEL | , | / | . | R-SHIFT | SPACE | INS |
| 9 | I | — | O | @ | P | [ | — | — |

- The **built-in joystick is the cursor keys**: row 7, bits 1, 2, 3 and 5. Its "fire" is SPACE
  (EXOS book, keyboard §3.7).
- The EXOS book table labels row 7 bit 4 "PAUSE"; the key cap says HOLD.

### 6.3 Port B6h read — control port, printer, serial, tape

B6h read (RD1, 74LS373 U28). Sources: EXOS book HW appendix; MAME `rd1_r`; EXOS book tape §5 and serial §2.

| Bit | Meaning |
|---|---|
| 0 | CONTROL connectors "Keyboard J" input (external joystick common), active low, for the row selected by B5h |
| 1 | "Keyboard K" input. The EXOS book prints the order as "J, L, K"; MAME says KBJ/KBK/KBL for bits 0/1/2. |
| 2 | "Keyboard L" input |
| 3 | Printer READY / BUSY: 0 = printer ready |
| 4 | Serial/Net DATA IN (inverted relative to the line) |
| 5 | Serial/Net STATUS IN (inverted) |
| 6 | Tape input **level** comparator: 1 when there is no input. The book's wording is ambiguous: "0 = high level, 1 = low level". |
| 7 | Tape **data** input: 1 when there is no input |

External joysticks use the J column (bit 0). The row lines KB0–KB4 go to CONTROL 1 and KB5–KB9 to CONTROL 2
(EXOS book; Xep128 `input.c` <https://github.com/lgblgblgb/xep128/blob/master/input.c>; ep128emu `readPort` case 16h):

| B5h row | B6h bit 0 = 0 means |
|---|---|
| 0 | Joystick 1 FIRE |
| 1 | J1 UP |
| 2 | J1 DOWN |
| 3 | J1 LEFT |
| 4 | J1 RIGHT |
| 5 | Joystick 2 FIRE |
| 6 | J2 UP |
| 7 | J2 DOWN |
| 8 | J2 LEFT |
| 9 | J2 RIGHT |

The ChibiAkumas table disagrees: it puts joystick 2 on B6h bit 2. ep128emu, Xep128 and the EXOS book all
use bit 0 for both, and Xep128's comment says joystick 2 is always on the J column at bit 0.

- Extra fire buttons 2 and 3 are on rows 0 and 5, bits 1 and 2. ep128emu and Xep128 implement them.
  The EXOS book notes that the K and L inputs could scan 3×5 contacts per connector.
- The EnterMice mouse also uses B6h bits 0–3. The nibble stream is clocked by toggling B7h bit 1 (RTS).
  Sources: ep128emu `readPort` 16h and `mouseRTSWriteCallback`; Xep128 `input.c`. This is an optional add-on.
- CONTROL connector pinout (EXOS book): A1 = J (common), A2 = L, A4 = KB4/9 right, A5 = KB2/7 down,
  A6 = KB0/5 fire, B5 = KB3/8 left, B6 = KB1/6 up, B1 = 0 V, B4 = +5 V.
- ep128emu returns 0 in B6h bits 4–5, with no serial. MAME and the EXOS book define them as serial inputs.

### 6.4 Port B6h write — printer data

All 8 bits go to the Centronics data latch (74LS273 U24). Sources: EXOS book; MAME `cent_data_out`; LGB.

The EXOS printer section says the handler writes the data, waits for READY low, and pulses STROBE
(B5h b4) low for a few milliseconds. It calls the ready input "B5h bit 3", which contradicts the
hardware section (B6h bit 3). *Inference*: B6h bit 3 is right, because B5h reads are the keyboard.

---

## 7. Serial/network, tape

### 7.1 Port B7h

| Bit | Write (WR2, 74LS74 U30) |
|---|---|
| 0 | Serial/Net DATA OUT. 1 pulls the line low (open-collector inverter). |
| 1 | Serial/Net STATUS OUT (RTS). Also clocks the EnterMice nibbles. |
| 2–7 | Not stored |

B7h read (RD2) is not connected. Sources: EXOS book HW appendix and serial §2; MAME `wr2_w`.

- The serial port is bit-banged by EXOS, half duplex.
- NET mode ties DATA IN to DATA OUT and STATUS IN to STATUS OUT.
- The CRC is the same as the tape CRC.

### 7.2 Tape input and feedback

- Data bit = B6h b7; level-meter bit = B6h b6.
  - EXOS shows the level meter in the status line by flipping palette colours 2 and 3 of the status-line LPB.
  - Sources: EXOS book tape §4.3 and §5; ep128emu `Dave::readPort` builds bit 7 = NOT tape_input and bit 6 = NOT tape_level.
- B5h b5 = 0 (EXOS variable `TAPE_SND` = 0, the default) feeds the tape input into the hi-fi and
  speaker outputs, but not the headphone or tape output, to avoid feedback.
  - ep128emu: adds 3Fh to both outputs when feedback is on and the input is high.
- Remote relays: B5h b6 (REM1) and b7 (REM2).
  - In EXOS, unit 0 or 1 is REM1; any other unit is REM2.
  - The EXOS variables `REM1`/`REM2` read 0 for on and FFh for off.
  - ep128emu: the motor runs if either remote bit is set (`setRemote1State`/`setRemote2State`).

### 7.3 Tape output

The cassette output **is the left audio output**, the same as the headphone socket. EXOS writes the
waveform with DAVE's left D/A mode (A7h b3 = 1, levels written to A8h). Sources: EXOS book tape §5,
the paragraph after the port list; MAME `dave_lh_w` (output +1 if the left D/A is non-zero, else −1);
ChibiAkumas notes A7h bit 3 as "tape port / Speaker L".

`LV_TAPE` selects the peak-to-peak output level, from 20 mV (0 or 1) through 40 mV (2, the default) up to 700 mV (6 and above).

### 7.4 EXOS tape format (signal level)

Source: EXOS book Part V §6 (the official cassette handler spec). The cycle times are printed with
"ms" but are obviously µs.

- Bits go LSB first, with no start or stop bits.
- One full cycle per bit; the reader times **full** cycles, so it is insensitive to duty cycle.
- The 1 and 0 frequencies are in a 2 : 3 ratio.

| Element | Fast (default, about 2400 baud) | Slow (`SP_TAPE` ≠ 0, about 1000 baud) |
|---|---|---|
| Leader | 424 µs (2358 Hz) | 1000 µs (1000 Hz) |
| "1" bit | 344 µs (2907 Hz) | 800 µs (1250 Hz) |
| "0" bit | 504 µs (1984 Hz) | 1200 µs (833 Hz; the book prints 883) |
| Sync | 696 µs (1437 Hz) | 1600 µs (625 Hz) |

Chunk layout (book §6.2–6.5):
1. A leader lasting a few seconds; the reader works out the speed from it.
2. One sync cycle (it also fixes the signal polarity).
3. A dummy byte.
4. **6Ah**.
5. The chunk data.
6. A few leader cycles as a trailer.

Chunk data:
- First a block-count byte:
  - **FFh** = header chunk;
  - 0–16 = data chunk.
- Then each block: a byte-count byte (0 means 256), the data, and a 16-bit CRC.

File structure:
- A header chunk holds one variable-length block: a protection byte, then a length-prefixed name of
  0–28 characters.
- Each data chunk holds exactly 4 KB except the last, which can be 0–4 KB. The short chunk marks end of file.
- The motor stops between chunks.

CRC (book §6.5): a 16-bit register starts at 0 and covers the data bytes only. For each bit, LSB first:
1. XOR the bit into bit 15.
2. If bit 15 is now 1, XOR the register with 0810h.
3. Rotate left by 1.

The same CRC is used by the network driver.

ep128emu's tape writer (`tapeutil/tapeio.cpp`, <https://github.com/istvan-v/ep128emu/blob/master/tapeutil/tapeio.cpp>)
works at 24 kHz with rounded periods:
- leader 10 samples (2400 Hz), "1" 8 (3000 Hz), "0" 12 (2000 Hz), sync 16 (1500 Hz);
- the first chunk has 0.25 s of silence and 6000 leader cycles; later chunks 4800;
- then sync, 00h, 6Ah, the count byte, and the blocks;
- each chunk ends with 150 leader cycles and 0.25 s of silence.

In its header chunk the header CRC covers the protection byte, the name length and the name, and
"0 = protected, FFh = not protected" is written.
- This conflicts with the book, which says the `PROTECT` variable is non-zero for protected and that value is written.
- *Inference*: the byte on tape may be inverted relative to the variable. Check against a real tape image.

### 7.5 Tape image formats (for Klive loaders)

From ep128emu `src/tape.cpp` (<https://github.com/istvan-v/ep128emu/blob/master/src/tape.cpp>) and
<https://ep128emu.sourceforge.net/html/tape_format.html>:

- **ep128emu native**:
  - A 4096-byte header of big-endian 32-bit words:
    - magic 0275CD72h, 1C445126h;
    - bits per sample (1, 2, 4 or 8);
    - sample rate (10–120 kHz);
    - up to 1019 cue-point sample indices, FFFFFFFFh when unused;
    - the last word FFFFFFFFh.
  - Then the samples, packed MSB first.
  - Legacy files have no header: 1-bit samples at 24 kHz, MSB first.
- **EPTE "ENTERPRISE 128K TAPE FILE"** (the `.tap` of other EP tools):
  - the 32-byte magic string at offset 128;
  - a table of up to 128 little-endian 32-bit chunk offsets in the first 512 bytes, relative to byte 512;
  - the chunks are re-synthesised as signal, LSB first.
- WAV and other audio files are read through libsndfile.
- TZX and Spectrum TAP are also accepted, for the Spectrum emulator card.

---

## 8. Port BFh (R31, write-only)

| Bit | Meaning |
|---|---|
| 0 | On-board RAM: 0 = 64K, 1 = 16K. Always write 0; with 1, only segment FFh is video. |
| 1 | DAVE input clock: 0 = 8 MHz (DAVE base = Z80 clock / 16); 1 = 12 MHz (base = Z80 clock / 24). Used by 6 MHz turbo machines to keep sound pitch right, *inference*. |
| 3–2 | Wait mode, see §1.1 |
| 7–4 | Unused |

Sources: primary spec R31 (the spec's heading says "R" but the text says write-only); EXOS book HW appendix;
LGB ports page; ep128emu `writePort` case 1Fh. ChibiAkumas: writing 0Ch selects "fast mode", meaning no
waits; it is consistent with the table.

---

## 9. Full I/O port map

The Enterprise uses **8-bit port decoding** (A7–A0). LGB notes that full 16-bit decoding is impossible,
because DAVE remaps the top address lines. Every port therefore mirrors across all 256 values of the
high byte, *inference*: emulate with `port & 0xFF`, as ep128emu, MAME (`dave_io` global mask FFh) and CLK do.

### 9.1 Built in

| Port | R/W | Device | Notes |
|---|---|---|---|
| 80h | W | NICK FIXBIAS | Plus external-colour priority bits (b5, b6) |
| 81h | W | NICK BORDER | |
| 82h | W | NICK LPL | LPT address A4–A11 |
| 83h | W | NICK LPH | LPT address A12–A15; b6 = clock enable, b7 = reload (both active low) |
| 84h–8Fh | W | Mirrors of 80h–83h | Reads return video-bus noise and are NICK-synchronised |
| A0h–A5h | W | DAVE tone 0–2 frequency and control | §5.2 |
| A6h | W | DAVE noise control | §5.3 |
| A7h | W | DAVE sync, D/A and interrupt select | §5.5 |
| A8h–AFh | W | DAVE volumes | §5.6 |
| B0h–B3h | R/W | Page registers 0–3 | §2 |
| B4h | R/W | Interrupt control and status | §4 |
| B5h | R/W | WR0/RD0: keyboard row, printer strobe, tape sound, REM1/2 / keyboard read | §6.1 |
| B6h | R/W | WR1/RD1: printer data / control port, printer ready, serial in, tape in | §6.3, §6.4 |
| B7h | W | WR2: serial DATA OUT and STATUS OUT | §7.1 |
| B8h–BEh | — | Not defined by the spec | ep128emu ignores writes and returns FFh; MAME returns FFh. *Inference*: unused. |
| BFh | W | System configuration | §8 |

The DAVE strobes RD0/WR0, RD1/WR1 and RD2/WR2 are just address decodes for B5h, B6h and B7h; the board's
74LS273/373 latches implement the actual port bits (primary spec; LGB). Reads of write-only DAVE registers:
the spec says they are write-only. Emulators return FFh. Real hardware probably shows the floating bus,
*inference*.

### 9.2 Common expansion hardware

Sources: LGB ports page <http://ep.lgb.hu/doc/ports.html>; ep128emu `ep128vm.cpp` port registrations;
MAME `bus/ep64/exdos.cpp` <https://github.com/mamedev/mame/blob/master/src/devices/bus/ep64/exdos.cpp>.

| Port | Device |
|---|---|
| 00h–01h | Mészáros serial card |
| 08h–0Fh | SID card (ep128emu: 0Eh–0Fh, optional) |
| 10h–13h | EXDOS WD1770/1772: command/status, track, sector, data. Mirrored at 14h–17h. |
| 18h (mirrored to 1Fh) | EXDOS card control (write) / status (read), see below |
| 20h | Turbo EXDOS speed switch (non-standard) |
| 32h, 3Fh | Z180 configuration (Zozo's EXOS versions) |
| 40h–43h | Spectrum emulator card: NMI-captured address high, low, data, access type (b7: 1 = attribute write, 0 = I/O) |
| 44h | Spectrum emulator enable (write bit 7) |
| 50h–51h | Am9511 APU |
| 7Eh–7Fh | Zozosoft RTC/CMOS (register select / data) |
| E0h–EFh | Zozosoft IDE (ECh/EDh data low/high, EEh/EFh command/status) |
| F0h–F3h | External 4-channel 8-bit DAC |
| F6h–F7h | MIDI (ep128emu option) |
| FEh–FFh | Spectrum emulator |

EXDOS control port (18h). MAME `exdos.cpp` and ep128emu agree.

| Bit | Write | Read |
|---|---|---|
| 0–3 | Drive select 0–3 | b1 = WD INTRQ |
| 4 | Side select | — |
| 5 | /DDEN (density) | — |
| 6 | Disk-change reset | b6 = disk change (inverted) |
| 7 | In use | b7 = WD DRQ |

ep128emu also reports not-ready. The WD1770 runs from 8 MHz.

### 9.3 Expansion bus

The bus carries D0–D7, A0–A21, /RD, /WR, /MREQ, /IORQ, /M1, /RFSH, /INT, /NMI, /WAIT, /RESET, the 1M, 8M,
14M and phi clocks, EC0–EC3, /EXTC, /LOCATE, /EXP, HSYNC, VSYNC, and left and right sound in. Source: MAME
`bus/ep64/exp.h` pinout comment (<https://github.com/mamedev/mame/blob/master/src/devices/bus/ep64/exp.h>).
External sound inputs are mixed into DAVE's outputs. *Inference*: DAVE generates /WAIT internally; a card
can also pull /WAIT.

---

## 10. Implementation checklist for Klive (inference)

1. **Memory.** Keep a 256-entry segment table; resolve `(seg[addr >> 14] << 14) | (addr & 3FFFh)`.
   ROM is read-only; unmapped segments read FFh. Segments FCh–FFh are shared with NICK as a flat
   64 KB buffer.
2. **Wait states.** Charge the DAVE wait on M1 and/or memory cycles according to BFh, never on
   FCh–FFh. For FCh–FFh and ports 80h–8Fh, align the access point (M1 at T2.0, memory at T2.5,
   I/O at T3.5) to the NICK slot grid of 4.5 T-states. Model the grid with a fractional phase,
   because 4 MHz / 889 846 Hz is not exactly 4.5.
3. **DAVE tick.** Run one step every 16 T-states, or 24 with BFh b1. Each step:
   1. advance the 4-, 5-, 7-bit and variable polys (the swap decides which is free-running);
   2. advance the 62.5 kHz divider (31.25 kHz noise clock), and the 1 kHz → 50 Hz → 1 Hz chain
      (249, 19, 49 reloads);
   3. run the three tone counters (skip the ones held by sync);
   4. sound IRQ: toggle the state and latch it from the selected source;
   5. run the noise channel on the falling edges of its clock;
   6. apply the filters and ring modulators in ep128emu's order;
   7. mix.
4. **Interrupts.** /INT = OR of the four latches. Use IM 1 with FFh on the data bus during
   acknowledge. INT1 is fed by NICK on the falling edge of the VINT level (see the §4.4 conflict).
5. **Keyboard.** Store a 10-row matrix plus external joystick state, and compose B6h from J/K/L,
   printer, serial and tape bits.
6. **Tape.** Feed the comparator from a tape sample stream into B6h b7/b6. Record from the left D/A
   level when the motor is on. Support EPTE `.tap` and WAV.
7. **Reset.** Power-on clears DAVE (all registers 0, then B4h = AAh semantics). The reset button
   resets the Z80 and DAVE but keeps RAM, so EXOS's warm or cold logic works.

---

## Sources

- DAVE primary spec ("DPC Sound Chip, DPC/Dave/1 Issue 5", Intelligent Software 1984, transcribed by D. Bouman): <http://ep.lgb.hu/doc/Dave.html>. The site's TLS certificate has expired; it was read over plain HTTP.
- NICK spec, same transcription: <http://ep.lgb.hu/doc/Nick.html>
- LGB, "Enterprise-128 I/O ports": <http://ep.lgb.hu/doc/ports.html>
- Hungarian EXOS book with the hardware appendix (EXOS kernel spec, tape, keyboard, serial and printer handler specs, DAVE register notes, connector pinouts): <https://ep128.hu/Ep_Konyv/Exos.htm>
- ep128emu source (IstvanV), <https://github.com/istvan-v/ep128emu>:
  - `src/dave.cpp`: `Dave::runOneCycle_`, `writePort`, `readPort`, `reset`, `setInt1State`, `setInt2State`, `calculate_polycnt`
  - `src/dave.hpp`: constants, key matrix comment
  - `src/ep128vm.cpp`: `videoMemoryWait*`, `setMemoryWaitTiming`, port registrations, tape callback, `reset`
  - `src/memory.cpp`: unmapped reads, ROM flags
  - `src/tape.cpp`: tape file formats
  - `tapeutil/tapeio.cpp`: EXOS tape encoder and CRC
- ep128emu documentation: <https://ep128emu.sourceforge.net/html/snapshot_header.html>, <https://ep128emu.sourceforge.net/html/snapshot_memory.html>, <https://ep128emu.sourceforge.net/html/tape_format.html>
- MAME:
  - <https://github.com/mamedev/mame/blob/master/src/mame/enterprise/ep64.cpp> (`rd0_r`, `wr0_w`, `rd1_r`, `wr2_w`, INPUT_PORTS, memory maps)
  - <https://github.com/mamedev/mame/blob/master/src/mame/enterprise/dave.cpp> (`int1_w`, `int2_w`, `io_w`, segment mapping)
  - <https://github.com/mamedev/mame/blob/master/src/devices/bus/ep64/exdos.cpp>
  - <https://github.com/mamedev/mame/blob/master/src/devices/bus/ep64/exp.h>
- CLK (Clock Signal) Enterprise: <https://github.com/TomHarte/CLK/blob/master/Machines/Enterprise/Enterprise.cpp> and `Dave.cpp`; ROM catalogue commit <https://git.applefritter.com/6502/CLK/commit/c7ff2cece42972ca4a32ecf97d693f1d1330f1e0>
- Xep128 `input.c` (LGB): <https://github.com/lgblgblgb/xep128/blob/master/input.c>
- ChibiAkumas, Enterprise 128 hardware notes: <https://www.chibiakumas.com/z80/enterprise128.php>
- Furnace DAVE documentation: <https://tildearrow.org/furnace/doc/latest/7-systems/dave.html>
- Wikipedia, Enterprise (computer): <https://en.wikipedia.org/wiki/Enterprise_(computer)>

## Open questions

1. **VINT edge.** Is the video interrupt at the start of the VINT line (NICK spec) or at the start
   of the first line after it (EXOS book appendix and ep128emu)? Check against ep128emu's `nick.cpp`
   (how it calls `setInt1State`) and against software that relies on raster timing.
2. **Segments 02h–03h on a stock 32 KB-ROM machine.** Do they mirror 00h–01h or read the open bus?
   Software that probes for 64 KB EXOS may care.
3. **What EXOS 2.0 and 2.1 write to BFh at boot.** The EXOS book implies M1-only waits (04h) are the
   default. Confirm from the ROM, and record the exact power-on-to-BASIC timing.
4. **The exact wait position.** Is the 1-cycle DAVE wait inserted as a Z80 Tw state (after T2) or
   as clock stretching? It changes nothing for the totals, but matters for contended-style timing
   tests.
5. **Unmapped and write-only register reads.** The emulators return FFh for A0h–AFh, B7h and
   B8h–BEh. The real bus value is unverified.
6. **Poly seed.** What are the power-on LFSR states? The book says unknown, probably all ones.
7. **The protection byte polarity in the tape header** (book versus ep128emu `tapeio.cpp`).
8. **INT2 wiring.** MAME connects RS232 RXD; the EXOS book appendix says it is possibly unused. Check
   the schematic.
9. **ROM version inventory.** Which EXOS (2.0, 2.1, 2.2?) shipped in which EP64 and EP128 batches,
   with checksums. Collect them from the ep128emu ROM package or the MAME hash lists.
10. **A7h sync release.** Does clearing sync reload the counter immediately (ep128emu) or on the next tick?
    And is ring modulation active during sync (CLK says yes, citing SIDBasic)?
