# Enterprise 64/128 — DAVE sound generator and the audio output path

Background for planning an accurate DAVE sound emulation in Klive. This file extends §5 (sound),
§1 (clocks), §4.4 (tone-generator interrupt) and §7.2–7.3 (tape audio) of
[DAVE_MEMORY_IO.md](DAVE_MEMORY_IO.md). It does not repeat what that file already says; read §5 there
first. Collected on 2026-10-30.

Conventions are the same as in DAVE_MEMORY_IO.md:
- Ports are hex. One **tick** is one step of DAVE's 250 kHz base clock (16 Z80 T-states at 4 MHz,
  24 when BFh bit 1 = 1).
- **Primary spec** is "DPC Sound Chip, DPC/Dave/1 Issue 5" (Intelligent Software, 1984). The pack has two
  transcriptions, `docs/Technical_Documentation_DPC_Sound_Chip.html` (ep128.hu) and
  `docs/Dave_spec_lgb.html` (ep.lgb.hu). **They have the same text.** After the markup is stripped,
  the only differences are whitespace, soft hyphens and the layout of the transcriber's address.
  The **scans of the originals** (Issue 4, Issue 5, the 1984-02-24 "The Dave Chip") are now in
  `docs/hardware/` and are compared in §2.
- **Original documents** are cited by short names, with the page of the scan: "Issue 4", "Issue 5",
  "Dave Chip 84" (`The_Dave_Chip.pdf`), "AMI pinout" (`DAVE-Chip-Pinout-and-plastic-package-dimensions.pdf`),
  "ET12/7" and "ET12/9" (the EXOS 2.0 and 2.1 sound driver specifications), "Code Book"
  (`Enterprise-Code-Book_Parts-and-Suppliers.pdf`), "DAVE plan sheet 1/2" (`3007-000-22_Sheet-1/2.pdf`).
  Readings of the hand-drawn gate-level plans are marked *reading*: the scans are faint, and a
  bubble or a wire can be misread.
- **EXOS book** is `docs/Exos.htm`, the Hungarian EXOS 2.1 book with its hardware appendix
  (<https://ep128.hu/Ep_Konyv/Exos.htm>).
- *Inference* marks my own conclusions. Where sources disagree, both are kept.
- GPL sources (ep128emu, Furnace, Xemu, the FPGA cores) were read only for facts. Nothing is copied:
  the behaviour is described in my own words. MAME (BSD-3) and CLK (MIT) are described the same way.
- No downloaded file was saved by this research. The schematics were first viewed online; the official
  documents were later added to `docs/hardware/` by the project author and read there (§2).
- The original documents are proprietary (Intelligent Software, Enterprise Computers, AMI). Their facts
  are restated here in my own words; nothing is transcribed.

---

## 1. Summary

What this file adds:
- **Findings from the original design documents** (§2): the three DAVE specification issues compared,
  the AMI pin list (the audio pins are open-drain), the EXOS 2.0/2.1 sound driver specifications, the
  parts list, and targeted readings of DAVE's gate-level plans (the slot multiplexer, the tone and noise
  channel logic, the polynomial counters).
- **The analogue output path, read from the original Enterprise 64 schematic.** Each side has a
  resistor-pack DAC into an LM324 inverting stage, with a first-order low-pass at about 22.6 kHz. The
  outputs are AC-coupled. The tape output and the monitor output are separated by resistors. The speaker
  is an LM386 into 16 Ω, switched by NICK's VC1 pin (§4).
- **The authorship of the EXOS book's DAVE appendix is now settled.** It is IstvanV's forum post of
  2010-05-19 (§6.1), not an anonymous appendix.
- **IstvanV's later clarifications on the forum**: what sync does, the D/A ×4 level and the time-slice estimate (§6).
- **Two FPGA cores**: the Kyp069 core and the MiSTer-devel core, which turned out to be the same audio file (§5).
- **Where Furnace's "62.5 kHz" comes from** (§3.3), the exact tick order in ep128emu (§3.1), and a
  check that every implementation produces the same LFSR sequences (§3.4).
- Sample-playback techniques that make timing matter (§6.3), emulator output design (§7), and test
  material (§8).

### Status of the sound-related questions

| # | Question | New status | Evidence | Recommended default |
|---|---|---|---|---|
| A | Noise base clock: 31.25 kHz or 62.5 kHz (README table; DAVE §5.3) | **Settled at 31.25 kHz** poly steps, with no recording of real hardware | Primary spec R6 ("00 = 31.25 KHz"); the EXOS book says it equals a tone channel with code 3. ep128emu toggles a state every 4 ticks and steps the poly on its falling edge, so every 8 ticks. The Kyp069/MiSTer FPGA core takes a 31.25 kHz square from 32 MHz / 1024 and steps on its rising edge. Furnace runs ep128emu's DAVE core unchanged, so its "about 62.5 kHz" text most likely comes from that core's variable name `clk_62500` (*inference*). CLK, which steps every 4 ticks, is the only implementation at 62.5 kHz. **Original documents (§2.2):** Issue 4 p. 4, Issue 5 p. 4 and Dave Chip 84 p. 4 all give 31.25 kHz; on DAVE plan sheet 2 the noise clock multiplexer's fourth input is a line labelled "31K" (*reading*). | One poly step per 8 ticks (31.25 kHz) |
| B | Power-on LFSR state (DAVE OQ6) | **Narrowed further** | All implementations generate the same sequences, up to phase (checked, §3.4). ep128emu and the FPGA core start with all ones; CLK starts from a random value. The real state is unknown. The spec says "Reset clears all 22 internal registers", which counts the registers, not the poly counters. **DAVE plan sheet 2 (§2.6):** every polynomial-counter stage has its reset input on a common line labelled MRES (the chip's /MRES pin), and the feedback is not a plain two-tap XOR: an XNOR of the last stages is combined with a NOR of earlier stages (*reading*). So a master reset does clear the polys, and the feedback logic is built so that the cleared state is not a lock-up state. | All ones at power-on. The phase only shifts the noise, so it does not affect correctness. |
| C | Sync release: immediate reload or next tick? (DAVE OQ10a) | **Settled in substance** | IstvanV (2016-03-02): setting or clearing a sync bit always reloads the counter, and while set the square output (the sound, not the B4h bit) is 0. ep128emu reloads when sync is cleared; CLK, MAME and the FPGA core hold the counter at the code while sync is set. All of them give the same restart: the first reload comes n + 1 ticks after release. **DAVE plan sheet 2 (§2.6):** channel 0's SYNC0 line drives the reset inputs of its square/sample flip-flop and of the counter-load flip-flop, so sync holds the output at 0 and the counter at its preset (*reading*). Issue 5 p. 4 and Dave Chip 84 p. 4 say "hold at preset"; Issue 4 p. 4 says "hold at present", which reads like a typo. | Hold the counter at the code and the flip-flop at 0 while sync is set; count from the next tick. No tone-generator interrupt while held. |
| D | Ring modulation while sync is set (DAVE OQ10b) | **Narrowed: yes** | ep128emu and CLK both XNOR the held 0 with the partner channel. CLK's commit 264b8dfb28 (2021-07-07) cites SIDBasic. MAME has no ring modulator at all. | Apply ring modulation during sync. This gives a constant 1 that can be used as a level (§6.3). |
| E | Tone code 0 | **Narrowed: 125 kHz by design** | IstvanV (EXOS book appendix and forum post msg19278): code 0 "does not work reliably" on real hardware, and the noise case was never tested. ep128emu, CLK and the FPGA core all toggle every tick, giving 125 kHz. **Documents (§2.2):** all three issues give the tone range as 30 Hz to 125 kHz with f = 125 000/(n + 1), so **code 0 = 125 kHz is the design intent** and the emulators follow it. Whether silicon meets it is still unmeasured. | Emulate as a toggle on every tick. After the 22.6 kHz analogue low-pass this is about half level with an ultrasonic ripple. Settle it with a scope on real hardware. |
| F | D/A level: ×4 or ×1 | **Settled: ×4** | Primary spec: each of the 4 time slots outputs its channel's amplitude when that channel is high, and D/A mode "constantly" outputs channel 0's amplitude. IstvanV (forum, 2013-08-22): every slot outputs the A8h/ACh value, so it is about 4× as loud. ep128emu and Xemu use ×4; CLK, MAME and the FPGA core use ×1. **DAVE plan sheet 1 (§2.5):** A7h bit 4 (right D/A) enters the gate that combines the slot data with the "channel high" condition (*reading*), consistent with D/A forcing every slot on. Issue 4 p. 2, Issue 5 p. 2 and Dave Chip 84 p. 2 keep the "in its own time slot" wording. CLK, MAME and the FPGA core (×1) contradict all three issues. | Value × 4 on the 0–252 scale |
| G | Multiplex slot length and order | **Narrowed by the gate plan** | IstvanV: "probably at most 1 µs (1/250000/4)", unmeasured. The order is not documented anywhere. The 1.5 kΩ ‖ 4.7 nF feedback averages the slots (§4.2). **DAVE plan sheet 1 (§2.5):** a 2-bit counter clocked by a line labelled "500K" drives both the four amplitude-row selects and a 4-to-1 multiplexer whose inputs are T0, T1, T2, T3 in that order (*reading*). So the order is **ch0, ch1, ch2, noise**, and if "500K" is the 500 kHz clock each slot lasts **2 µs**, a full rotation 8 µs (two ticks), not IstvanV's 1 µs estimate. | Sum the four channels for each tick |
| H | Noise low-pass: ep128emu or CLK semantics | **Settled for ep128emu** | IstvanV's post (= EXOS book): the poly output is sampled only on ch2 falling edges, and the poly keeps running. CLK's version, which substitutes ch2's bit, contradicts it. **DAVE plan sheet 2 (§2.6):** the noise low-pass is a 2-to-1 multiplexer (A6h bit 5) between the poly bit and a flip-flop that samples it on the ch2 (T2) clock, which is the ep128emu semantics (*reading*). | ep128emu semantics |
| I | Speaker mute bit | **Confirmed: NICK 80h bit 7 (VC1)** | EXOS book NICK §13 ("b7 – Nick chip VC1 output. The internal speaker can be switched off here"); EP64 schematic sheet 3, where VC1 goes through gates to "SOUND CONTROL", and sheet 2, where "SOUND ON/OFF" goes to the LM386. The Hungarian video-driver chapter says "FIXBIAS bit 5 comes from MUTE_SND", which is probably a translation slip (*inference*). ET12/9 p. 7 (EXOS 2.1) adds MUTE_SND and says it affects only the internal speaker, not headphones or the monitor socket; ET12/7 (EXOS 2.0) has no such section (§2.4). | Bit 7 = 1 mutes only the speaker, not the hi-fi, headphone or tape outputs |
| J | DAC linearity | **Narrowed; values still unknown** | IstvanV (forum, 2010-08-12): on his machine the built-in resistor DAC "is already non-linear at 6 bits". The resistor-pack values (RP1/RP3) are not printed on the schematic. **Code Book p. 30:** part 14-27, a **custom 7-pin SIL resistor network** (Welwyn 747164, AB Microelectronics, KOA M-3842) "see tech. spec." — almost certainly the DAC packs (6 weighted resistors + common, *inference*), but the values are in a separate specification that is not in the book. **AMI pinout p. 1:** LH0–LH5 and RH0–RH5 are **open-drain** outputs, so each bit's accuracy also depends on the pin's on-resistance in series with its resistor, a plausible cause of the non-linearity IstvanV heard (*inference*, §2.3). | Linear. Settle it by measuring RP1/RP3, or by recording a 0–63 ramp in D/A mode. |
| K | What BFh bit 1 does to audio | **Settled** | Primary spec R31; EXOS book BFh; the ep128.hu turbo-card page: DAVE's input is the system clock (8 MHz on a stock machine). Bit 1 selects /48 instead of /32, so on a stock machine every DAVE frequency drops ×2/3. Turbo-card machines feed DAVE 12 MHz and set bit 1 (BFh = 06h) to get back to 250 kHz. All three issues agree on R31 bit 1 (Issue 4 p. 7, Issue 5 p. 7, Dave Chip 84 p. 7). The scans head R31 as **W**; the transcriptions' "R31 R" is a transcription error. | Ticks every 24 T-states when bit 1 = 1 |
| L | Reset values of A0h–AFh | **Narrowed** | Primary spec: reset clears all registers. ep128emu writes 0 to all of them. The FPGA core resets A7h to 07h (all channels in sync), with no source given. All three issues repeat "Reset clears all 22 internal registers" (Issue 4 p. 1, Issue 5 p. 1, Dave Chip 84 p. 1). Nothing supports the FPGA core's A7h = 07h. | All zero |
| M | Who wrote the EXOS book's DAVE appendix (DAVE "Conventions" *inference*) | **Settled** | It is IstvanV's forum post of 2010-05-19 13:57 (enterpriseforever.com/hardver/dave/msg19278), almost word for word | Treat it as IstvanV's: careful work, the basis of ep128emu |
| N | INT2 wiring (DAVE OQ8; not sound) | **Narrowed** | Zozosoft (DAVE thread, 2010-05-19 14:25): INT2 comes from the SERIAL/NET "STATUS IN" input **AMI pinout p. 1:** /INT1 and /INT2 are **Schmitt-trigger** inputs (active low). Their board wiring is not in the documents read; the EP64 schematic was not re-checked for it. | As MAME/Zozosoft say: the serial/net status input |

---

## 2. Findings from the original design documents

Read on 2026-10-30 from the scans in `docs/hardware/`. Page numbers are pages of the scan (the PDF
page), which for these documents are also the printed page numbers.

### 2.1 What was read

| Document | Date, origin | What it is | Used for |
|---|---|---|---|
| `DAVE_ISSUE4.pdf` (7 pp.) | "DPC/DAVE/1 Issue 4", Dave Woodfield, 2 Sept 1983, © Intelligent Software 1983 | The earliest DAVE spec in the pack | §2.2 |
| `The_Dave_Chip.pdf` (8 pp.) | "The Dave Chip" / "Programming the DAVE chip", 24 Feb 1984, © Intelligent Software 1984; dealer stamp of Adquipment BV; binder page numbers 113–121 written on it | The Issue 5 text in a different layout | §2.2 |
| `DAVE_ISSUE5.pdf` (7 pp.) | "DPC/DAVE/1 Issue 5", © 1984, undated | The original of the pack's transcriptions | §2.2 |
| `DAVE-Chip-Pinout-and-plastic-package-dimensions.pdf` (3 pp.) | Telex of 21 Nov 1983 from AMI Austria (Herbert Gruenbacher) to Peter Squirell: "final pin connections", 68-lead plastic package | Pin types | §2.3 |
| `Enterprise_Pinout_information.pdf` (2 pp.) | 22 Jan 1985, © Enterprise Computers | Connector pinouts | §2.3 |
| `Enterprise-TechDesc.pdf` (5 pp.) | Enterprise Computers sales technical description | Marketing-level summary | §2.3 |
| `ET12-7_EXOS_20_Sound_Driver_Specification.pdf` (8 pp.) | "ET12/7", 11 Sep 1984 (MRL), © Intelligent Software | EXOS 2.0 sound driver | §2.4 |
| `ET12-9_EXOS_21_Sound_Driver_Specification.pdf` (8 pp.) | "ET12/9", 16 Jan 1985 | EXOS 2.1 sound driver | §2.4 |
| `Enterprise-Code-Book_Parts-and-Suppliers.pdf` (52 pp.) | Enterprise Computers code book, pages dated 22/04/86 and 4/08/86 | Parts list | §2.3 |
| `A3PER-1_Enterprise_64-128_Bus_Timing.pdf` (1 sheet) | Drawing A3PER-1, 4 Apr 1985, Intelligent Software | Z80 bus waveforms | §2.7 |
| `3007-000-22_Sheet-1.pdf`, `…Sheet-2.pdf` | AMI hand-drawn gate-level plans | **DAVE (ESPRIT)**, identified from the content: sheet 1 carries the RH0–RH5 output pads and the amplitude register matrix, sheet 2 the polynomial counters and the tone and noise channels. The title block was not legible in the crops; `NICK-DAVE-Legend_to_Plans.txt` gives ESPRIT = DAVE. So `3006-0000-22` is NICK (ELITE) (*inference*, not opened) | §2.5, §2.6 |

The gate plans were read only for the questions in §1 and time-boxed. The interrupt edge logic and
the 12-bit counter's handling of code 0 were **not** traced.

### 2.2 The three DAVE specification issues compared

**What all three say alike** (Issue 4 pp. 1–7, Dave Chip 84 pp. 1–8, Issue 5 pp. 1–7): 22 registers, 17
write-only, and reset clears all 22; tone f = 125 000/(n + 1) from a 12-bit down counter, "30Hz to
125KHz"; every bit of A0h–A7h as the transcription has it; noise clock 00 = 31.25 kHz; poly lengths
17/15/11/9; the 7/17 swap; noise low-pass by ch2, high-pass by ch0, ring by ch1; TG interrupt
f = 250 000/(n + 1); 6-bit amplitudes "multiplexed onto an external 6 bit D/A"; "in its own time slot"
each channel outputs its amplitude if high, else zero; D/A mode "constantly" outputs the ch0
amplitude; interrupts latched and "negative edge triggered"; the three wait modes; no wait for video
RAM because it "would conflict with Z80 clock stretch"; a 1 ms reset synchronised to the falling edge
of M1.

**The pack's transcription is the Issue 5 text.** The only content difference found is the R31
heading: the transcription has "R31 R #BF", while all three scans head it **W** (Issue 4 p. 7, Dave Chip
84 p. 7, Issue 5 p. 7). Dave Chip 84 has the same wording as Issue 5, in a different layout.

**Differences, Issue 4 against the later two:**

| Topic | Issue 4 (2 Sept 1983) | Dave Chip 84 and Issue 5 |
|---|---|---|
| I/O strobes (function 6) | for "external 74LS374 tri-state octal latches" (p. 1) | "external octal latches and tri-state buffers" (p. 1) |
| The DAC | "external 6 bit D/A **ladder** network" (p. 2) | "D/A **resistor** network" (p. 2) |
| Noise filters, overview | "low pass and high pass filters" (p. 1) | "high pass and low pass" (p. 1). The register bits are the same, so this is wording only. |
| Sync (R7 b0) | "hold at present" (p. 4) | "hold at preset" (p. 4). *Inference*: Issue 4's word is a typo; the gate plan agrees with "preset" (§2.6). |
| B4h read layout | b0–b3 = the four latches (TG, 1 Hz, INT1, INT2); b4 = TG divider; b5 = 1 Hz divider; b6, b7 = INT1, INT2 pins (p. 6) | interleaved: b0 divider, b1 latch, b2 1 Hz divider, b3 latch, b4 INT1 pin, b5 latch, b6 INT2 pin, b7 latch (p. 6) |
| Select outputs | adds **XRAM**, low for pages F8h–FBh (p. 7), and lists "extension ram" among the selects (p. 2) | no XRAM. The AMI final pin list (§2.3) has no XRAM pin either, so it was dropped before silicon. |
| ROM/CART gating | not stated | ROM "gated externally with RD", CART "with RD,WR" (Dave Chip 84 p. 8, Issue 5 p. 7) |
| RSTO | no inverter note; "a 1MHz clock out is also provided" | RSTO needs an external 74ALS04 inverter (p. 2) |
| Typos | "50Hz8" (R7, p. 4); VRAM range "£20000–£3FFFF" (p. 7); R19 as "A14',A15' = 11" (p. 5) | corrected |

*Inference*: the silicon follows the later B4h layout, because EXOS passes the latch bits to its device
handlers as bits 1, 3, 5 and 7 (DAVE_MEMORY_IO.md §4.3), and every emulator reads B4h that way.

**What none of the three says**: the slot length or order, the DAC resistor values, the polynomial taps or
seeds, which edge of a tone channel clocks the filters and the noise, what code 0 really does, or how
sync interacts with the filters and the ring modulator.

### 2.3 Pins, connectors and parts

**AMI pin list** (AMI pinout pp. 1–2):
- **LH0–LH5 and RH0–RH5 are open-drain outputs** ("O/D"). So are /IRQ and **/WAIT**.
- /INT1, /INT2, /RSTI and /CAP are **Schmitt-trigger** inputs. /MRES and /TEST are plain inputs.
- DAVE has two clock inputs, **CLK** and **ZCK**. *Inference*: CLK is the 8/12 MHz input that R31 bit 1
  describes, and ZCK the Z80 clock, which DAVE needs to time its /WAIT.
- The final pin numbers swap /M1 and 1MHZ (to 65 and 21) and shift D6, D7, /WR, /IORQ and /RD by one,
  against a preliminary list. This does not matter for emulation.
- Package: 68-lead plastic mini-flat; p. 3 has the outline dimensions.

**What open-drain DAC pins mean** (*inference*, combining this with the EP64 schematic in §4.2):
- An active bit sinks current from the op-amp's summing node through its weighted resistor; an inactive
  bit floats. The non-inverting input sits on a DC bias (R7 with R18/R19), which is what lets current
  flow into a pin that can only pull down.
- Each bit's weight is then its resistor **plus the pin's on-resistance**. That error is largest
  relative to the smallest (most significant) resistor, so the top bits come out light. This is a
  plausible mechanism for IstvanV's "non-linear at 6 bits" (question J).
- Which logic level turns a pin on was not traced; for emulation it only sets the sign, which the AC
  coupling removes anyway.

**Connector and summary documents:**
- Monitor connector: A7 = left audio, B7 = right audio (Enterprise pinout p. 2), matching the EXOS book.
  **No audio level is given**; only RGB (0–4 V, linear) and the TTL syncs have levels.
- The TAPE OUT socket "doubles as" the stereo headphone output with 3.5 mm jacks, and the monitor socket
  carries stereo sound for hi-fi (TechDesc p. 3). The sound is described as 4 sources, "8 octave range"
  (TechDesc p. 2).

**Code Book** (pages dated 22/04/86):
- **14-27: "custom resistor network, 7 pin SIL, see tech. spec."**, from Welwyn (747164), AB
  Microelectronics or KOA (M-3842) (p. 30). *Inference*: this is the DAC pack, six weighted resistors with
  a common pin; no other custom network is listed. **Its values are in a separate specification that is
  not in the book**, so question J stays open.
- The other networks are generic: 14-08 a 14-pin DIL pack, 14-20 15 × 10 kΩ, 14-47 4.7 kΩ octal, 14-56
  390/330 Ω DIL (pp. 29–31).
- The only tight-tolerance resistors are 1K5 2 % (14-37) and 3K9 2 % (14-32), plus 3K0 and 1K0 1 %
  (14-50, 14-51) (pp. 30–31). *Inference*: the 1K5 2 % parts are the DAC feedback resistors R20/R21 of
  §4.2; the 2 % choice suggests the designers cared about left/right matching.
- Op-amps and comparators: LM324 (08-09) and LM339 (08-10), 7406 (08-11) (p. 19); the speaker amplifier
  is listed as **LM386N-4** (08-42, p. 21) and **LM386N-1** (08-77, p. 23). The -4 is the higher-voltage
  part. *Inference*: the two entries are two board revisions or alternates.

### 2.4 The EXOS sound driver specifications (ET12/7 and ET12/9)

Neither document describes the hardware beyond pointing at "the separate DAVE chip specification"
(ET12/9 p. 3). Facts that matter for an emulator, because EXOS software drives DAVE through them:

- The driver's interrupt routine runs **50 times a second, "once every TV frame"**; a 20 ms period is
  a tick (ET12/7 p. 1, ET12/9 p. 2). It **rewrites all 16 sound registers on every interrupt**, because
  the cassette driver borrows some of them for output and timing (ET12/7 p. 7, ET12/9 p. 7).
- Envelopes: 1–40 phases of (duration in ticks, pitch change in 1/512 semitone, left and right
  amplitude change −63…+63), spread linearly over the phase. Amplitude is clamped to 0–63; pitch wraps
  at 16 bits (ET12/7 pp. 2, 5; ET12/9 pp. 2, 5).
- **Register values written each tick** (ET12/7 p. 5, ET12/9 p. 5):
  - amplitude register = the top 6 bits of (current 6-bit envelope amplitude × the sound's 8-bit overall
    amplitude);
  - pitch: the top byte is a quarter-tone number 0–255; the counter value comes from a table with
    octave shifts, and the top 4 bits of the low byte interpolate linearly to the next entry
    (about 1/64 tone).
- The style byte: for the noise channel it is written to A6h for the whole sound; for a tone channel its
  top four bits become the channel's control bits (filter, distortion, ring) (ET12/7 p. 4, ET12/9 p. 3).
- The keyclick uses tone channel 0 for about 1/100 s; the bell ("ping") uses tone channel 2
  (ET12/7 pp. 7–8, ET12/9 p. 7).
- The SYNC count in a sound's flag byte is a **driver** feature that starts queued sounds together. It
  does **not** use A7h's hardware sync bits (ET12/7 p. 6, ET12/9 p. 6).

**EXOS 2.0 (ET12/7) against 2.1 (ET12/9):**

| Topic | ET12/7, EXOS 2.0 | ET12/9, EXOS 2.1 |
|---|---|---|
| Envelope 255 | "null" envelope only (p. 1) | a constant "beep": the sound's pitch and its amplitudes ÷ 4 (0–63) go straight to DAVE for the whole duration (p. 4) |
| Internal speaker | not mentioned | §6.1 `MUTE_SND`: non-zero silences only the internal speaker, not headphones or the monitor socket (p. 7) |
| ^G / bell | a "terminal bell" section: a second BEEP waits until the first ping ends (p. 8) | ^G does nothing if tone channel 2 is in use (p. 7) |
| Open with a channel already open | not stated | rejected with `.2NDCH` (p. 1) |
| Quick reference | none | EXOS variables BUF_SND, MUTE_SND, WAIT_SND (p. 8) |

Envelope timing, amplitude and pitch rules are the same in both.

*Inference* on "once every TV frame": DAVE_MEMORY_IO.md §4.4 says DAVE's 50 Hz timer is not locked to the
frame. Either the driver phrase is loose, or the sound tick runs from the video interrupt. Which interrupt
EXOS uses must be read from the ROM; it matters only for the phase of EXOS register writes against the
picture.

### 2.5 Gate-level plan, sheet 1: the output multiplexer

Bottom right of DAVE plan sheet 1 (*reading* throughout):
- A **2-bit counter** (two "UPC83" cells) is clocked by a line labelled **"500K"**. Four gates decode it
  into the row selects A0–A3 of the amplitude register matrix, which put one channel's 6-bit amplitude on
  an internal bus at a time.
- The same counter drives a **4-to-1 multiplexer whose inputs are T0, T1, T2 and T3**, the final outputs
  of tone channels 0–2 and the noise channel. Its output, through a gate, enables the bus bits onto the
  RH0–RH5 output pads. So a slot outputs the amplitude only while its channel is high, as the spec says.
- The slot order is therefore **ch0, ch1, ch2, noise** if the counter counts up.
- If "500K" is the 500 kHz clock (8 MHz / 16), each slot lasts **2 µs** and a full rotation **8 µs**, two
  250 kHz ticks. That would contradict IstvanV's "at most 1 µs" estimate. The label could also be a
  cross-reference, so this needs a scope to confirm.
- A line labelled "(B4(R7))", A7h bit 4 (the right D/A bit), enters the gate that combines the
  multiplexer's "channel high" with the slot data. That is how D/A mode forces every slot on. Whether it
  also forces row A0 in every slot was not traced, but the spec requires it.

For emulation nothing changes: the 22.6 kHz pole (§4.2) averages an 8 µs rotation as well as a 4 µs one,
so summing the four channels per tick stays right.

### 2.6 Gate-level plan, sheet 2: tone channels, noise, polynomial counters

**Tone channel 0** (lower left of sheet 2; channels 1 and 2 repeat it, *reading*):
- The channel output is a flip-flop clocked by the counter's reload. Its D input comes from a 4-to-1
  multiplexer (select = A1h bits 4–5): input 0 is the flip-flop's own inverted output, so a pure tone
  **toggles**; inputs 1–3 are the DIST1/DIST2/DIST3 lines from the 4-, 5- and 7-bit polys, so distortion
  **samples the poly at each reload**. This confirms the spec's "use the output frequency to sample" and
  the ep128emu model.
- **SYNC0 drives the reset inputs** of that output flip-flop, of the counter-load flip-flop and of a
  third flip-flop. So while sync is set, the output is 0 and the counter is held at its preset.
- That third flip-flop gives a line labelled "2T0": the reload pulse at twice the tone frequency,
  presumably the interrupt source, matching f = 250 000/(n + 1).
- **High-pass**: a flip-flop clocked by T1 (ch1) samples the channel's signal, and an XOR compares the
  live signal with that sample. A1h bit 6 drives the flip-flop's reset, so with the filter off the sample
  is 0 and the XOR passes the signal unchanged. So the output is "**changed since the last ch1 clock**",
  and it is forced to 0 at each ch1 clock.
  - For a pure tone this equals ep128emu's rule (forced to 0 on the partner's edge, then toggling).
  - With distortion it differs: ep128emu sets the state to the new poly bit, the gate XORs the new bit
    with the bit sampled at the partner's edge.
- **Ring modulator**: a NAND of T2 (ch2) and A1h bit 7, then an XOR with the high-pass output. So it is an
  XOR with the partner's output, applied **continuously**, not only at the channel's own reload. This
  contradicts the FPGA core (§5.2) and agrees with ep128emu, CLK and IstvanV. The polarity (the NAND
  inverts when the ring is off) is presumably undone downstream; it was not traced.
- **The result is registered** by a further flip-flop (D235) whose output is T0. Every partner and the
  output multiplexer use these registered T lines. *Inference*: every cross-channel effect sees the
  partner's value from the previous clock, which supports the "everything samples the previous tick"
  model of §3.1 rather than ep128emu's sequential order. Which clock loads the T registers was not traced.

**Noise channel** (middle of sheet 2, *reading*):
- A 4-to-1 multiplexer selects the noise clock by A6h bits 0–1 from a line labelled "31K", T0, T1 and T2.
  The "31K" label is the 31.25 kHz clock (question A).
- **Low-pass**: a flip-flop clocked by T2 re-samples the noise bit; a 2-to-1 multiplexer (select = A6h
  bit 5) picks the direct bit or the re-sampled one. This is the ep128emu semantics (question H).
- **High-pass**: a flip-flop clocked by T0, reset by A6h bit 6, with an XOR, as in the tone channels.
- **Ring**: a NAND of A6h bit 7 and T1, then an XOR. The result is registered as T3.

**Polynomial counters** (top band of sheet 2, *reading*):
- The 4-bit (cells 103–106), 5-bit (113–117), 7-bit (125–131) and the variable 17-bit counter (139 on)
  are chains of shift cells, each with its own clock driver.
- **Every cell's reset input is on a common line labelled MRES**, the /MRES pin. So a master reset
  clears the polys (question B).
- **The feedback is more than one XOR.** For the 4-bit counter, an XNOR of two late stages is combined
  through further gates with a NOR of the earlier stages; the 7-bit counter has the same pattern.
  - The NOR term detects a run of zeros. It is either a lock-up guard or a "de Bruijn" extension that
    adds the missing state, making the period 2ⁿ rather than 2ⁿ − 1 (16 rather than 15 for the 4-bit
    counter).
  - The faint scan did not allow deciding which. Every emulator and the FPGA core assume maximal
    2ⁿ − 1 sequences (§3.4), so this is a new open question (§9 item 9).
  - With a reset to zero and XNOR feedback, the all-zero state is not a lock-up state, which is consistent
    with the counters being reset at all.
- The 7-bit counter's clock and output are labelled CPN7/OPN7, the 17-bit one's CPN17/OPN17. A group of
  2-to-1 multiplexers between them, selected by A6h bit 4, swaps them between the tone side and the noise
  side, as the spec's swap bit says.

### 2.7 Bus timing and wait states

- A3PER-1 (1 sheet, 4 Apr 1985) draws standard Z80 waveforms for a memory cycle and an I/O cycle, with
  /WAIT, /INT and /NMI, and numbered parameters 1–43. It says all numbers are document references; the
  table of values is not in the scan. It does not show where DAVE inserts a wait.
- Together with the AMI pin list (/WAIT is an **open-drain output**, and DAVE has a ZCK clock input) and
  the spec's statement that a wait on video RAM "would conflict with Z80 clock stretch" (Issue 4 p. 2,
  Issue 5 p. 2), the mechanism is clear:
  - **DAVE's waits are ordinary Z80 wait states**: DAVE pulls /WAIT, and the Z80 inserts Tw cycles after
    T2.
  - **NICK's video-RAM synchronisation is a different mechanism**, stretching the Z80 clock.
  - *Inference* on the exact position: the Z80 samples /WAIT on the falling edge of T2, so a 1-cycle DAVE
    wait is one Tw between T2 and T3 (between T2 and T3 of the M1 cycle for an opcode fetch).

### 2.8 Corrections to DAVE_MEMORY_IO.md

These are non-sound findings. DAVE_MEMORY_IO.md was not edited; apply them when it is next revised.

| DAVE_MEMORY_IO.md | What the documents say |
|---|---|
| Open question 4 (wait position) | **Settled in substance**: DAVE drives /WAIT (open drain, AMI pinout p. 2), so its wait is a Z80 Tw state after T2, not clock stretching; only NICK stretches the clock (§2.7). |
| §8 note "the spec's heading says R" for BFh | The scans head R31 as **W** (Issue 4 p. 7, Dave Chip 84 p. 7, Issue 5 p. 7). The "R" is a transcription error. |
| Open question 8 (INT2 wiring) | Not settled. /INT1 and /INT2 are Schmitt-trigger inputs (AMI pinout p. 1); none of these documents says what drives INT2. Zozosoft's "serial/net STATUS IN" remains the best answer. |
| Open question 5 (reads of write-only registers) | Not settled. The specs only say "write-only". D0–D7 are bidirectional TTL pins (AMI pinout p. 1). *Inference*: DAVE does not drive the bus for those registers, so the read is the floating bus. |
| Open question 1 (VINT edge) | Unchanged: all issues say the external interrupts are "negative edge triggered" (p. 2). Which NICK line edge that is remains a NICK question. |
| Open question 6 (poly seed) | Narrowed: the polys are reset by the /MRES line (§2.6). |
| §4.3 (B4h read) | Confirmed for the final chip, but note that Issue 4 p. 6 had a different layout (§2.2). Software written against Issue 4 would misread B4h. |
| §2.2 (select outputs) | Issue 4 had an XRAM select for pages F8h–FBh, dropped before silicon (§2.2). The final chip gates ROM externally with RD only and CART with RD and WR (Issue 5 p. 7). |
| §1 (clocks) | DAVE has two clock inputs, CLK and ZCK (AMI pinout p. 2). *Inference*: ZCK is the Z80 clock, used for the wait generator. |
| §3 (reset) | RSTO needs an external 74ALS04 inverter to drive the system reset (Issue 5 p. 2), so the reset line is the inverse of the pin. |

---

## 3. Sound generator details beyond DAVE_MEMORY_IO.md §5

### 3.1 Tick order in ep128emu (the de facto reference)

`Dave::runOneCycle_()` in <https://github.com/istvan-v/ep128emu/blob/master/src/dave.cpp> runs once
per 250 kHz tick. `Dave::runOneCycle()` calls it every second or third call at 500 kHz (`clockDiv`,
`dave.hpp`). Inside a tick the order is:

1. **The polynomial counters step.**
   - The 4-bit and 5-bit counters always step. The 250 kHz counter of the 7-bit / variable-length
     pair also steps.
   - The noise-clocked counter of the pair steps **only if the selected noise clock fell between the
     previous tick and this one**. The comparison uses the clock source's value from the end of the
     previous tick: a tone channel's final output, or the 31.25 kHz square.
   - So the noise poly reacts **one tick late** to its clock.
   - When it steps:
     - the "raw" noise bit takes the poly output;
     - if the noise low-pass is off, the held noise bit takes it too.
2. **Every counter decrements:** the 31.25 kHz divider, the 1 kHz divider, and each tone channel whose
   sync is clear.
3. **Interrupt dividers.**
   - When the 1 kHz divider underflows, it clocks the 50 Hz and 1 Hz chain.
   - When the selected source (1 kHz, 50 Hz, ch0 or ch1) has gone negative, the B4h bit-0 state
     toggles and the latch is set.
4. **The 31.25 kHz square toggles** if its counter (reload 3) underflowed. So it toggles every 4 ticks.
5. **The channels are computed in the order noise, ch2, ch1, ch0.** Each saves its previous final
   output first.
   - **Noise.**
     - Low-pass: if ch2 fell, the held bit takes the raw poly bit.
     - High-pass: if ch0 fell, the held bit is forced to 0.
     - Ring modulation: the output is the held bit XNOR ch1.
     - ch2, ch0 and ch1 are still at their values from the previous tick here.
   - **ch2.**
     - On its counter's underflow it reloads, then either toggles or samples its poly.
     - High-pass: forced to 0 if the noise output fell **this tick**.
     - Ring modulation: XNOR with ch0, which still holds the previous tick's value.
   - **ch1.** High-pass from ch2 (this tick); ring modulation with the noise (this tick).
   - **ch0.** High-pass from ch1 (this tick); ring modulation with ch2 (this tick).
6. **The output is formed.** Each side is the sum of the amplitudes whose final output is 1. A side in
   D/A mode is ch0's amplitude × 4 instead. The tape feedback adds 63 to both sides. The result is
   multiplied by 128, so one generator spans 0–8064 and a side 0–40320 (`dave.hpp` comment).

CLK uses a different order (`Machines/Enterprise/Dave.cpp`, `Audio::apply_samples`):
- the polys step, then ch0, ch1, ch2, then the noise;
- edges are detected from a 2-bit history (`output & 3 == 2`);
- in the noise channel the order of the low-pass and the tick is different.

The FPGA core (§5) updates everything on one clock edge in parallel, but applies each channel's
filters only on that channel's own reload.

*Inference*: the real chip is synchronous logic, so its real order is probably "everything samples the
previous tick's values". No written source documents it. For bit-identical agreement with the reference
emulator, follow the ep128emu order above. The differences are a one-tick (4 µs) skew on edge-coupled
effects, which is inaudible but shows in waveform comparisons.

The DAVE gate plan now supports this: every channel's final output is registered (T0–T3) before a
partner or the output multiplexer uses it (§2.6, *reading*).

### 3.2 Tone channels

- The period is n + 1 ticks. Reload happens on underflow (0 → −1) in every implementation. In
  ep128emu's terms: `chnN_phase` decrements and reloads with the code when negative.
- A written code takes effect at the next reload. IstvanV (DAVE thread, 2016-03-02) confirms that
  ep128emu reloads only on underflow. The counters always run, since their state can be read through
  B4h.
- **Code 0**: see question E. Every emulator toggles on every tick.
- **The 7-bit / variable-length swap (A6h bit 4)** changes **which counter** is clocked at 250 kHz:
  - ep128emu re-points any tone channel that has 7-bit distortion selected (`writePort` case 06h,
    `findPolycntForToneChannel`);
  - with bit 4 set, the tones sample the variable-length poly at 250 kHz, and the noise channel
    steps the 7-bit one on its noise clock (EXOS book, IstvanV's post).
- **Distortion aliasing.** If (n + 1) is a multiple of the poly length, the output is silent. If it
  shares a factor with it, the period shortens. The EXOS book's worked example: code 8 on the 4-bit
  poly repeats only 5 samples.
- **CLK deviation.** When the swap bit is set, CLK feeds the tones the *noise channel's* current poly
  bit, which steps at the noise rate. Its noise also keeps using the variable-length counter. So
  CLK's swap is not the documented behaviour. Do not port that part.

### 3.3 Noise channel

- **The clock** steps on falling edges of:
  - the 31.25 kHz square (code 00);
  - or ch0 / ch1 / ch2's **final** output, after its filter and ring modulator (EXOS book, ep128emu).
- The **31.25 kHz square is free-running** in ep128emu, from reset. It is not tied to any tone
  channel's phase.
- **The 62.5 kHz claim.**
  - Furnace's DAVE page says "about 62.5 kHz": <https://tildearrow.org/furnace/doc/latest/7-systems/dave.html>.
  - Furnace's emulation is ep128emu's `dave.cpp`, copied into
    `src/engine/platform/sound/dave/` (<https://github.com/tildearrow/furnace/tree/master/src/engine/platform/sound/dave>),
    with the ep128emu copyright header, driven at 8 MHz / 16 = 500 kHz
    (`src/engine/platform/dave.cpp`, `rate = chipClock/16`).
  - So Furnace *sounds* like 31.25 kHz while its documentation says 62.5 kHz.
  - The figure is most likely read from ep128emu's variable name `clk_62500_*` (*inference*). That
    counter does reload every 4 ticks, which is 62.5 kHz, but it is used as a toggling square with
    falling-edge stepping.
- **Effect order:** low-pass, then high-pass, then ring modulator.
  - The low-pass holds the bit and re-samples the running poly only on ch2 falling edges.
  - The high-pass forces the held bit to 0 on ch0 falling edges, until the next sample.
  - Source: IstvanV's post msg19278 = EXOS book appendix; ep128emu.

### 3.4 Polynomial counters: sequences, seeds, output bit

- **Taps and step rule**: as DAVE_MEMORY_IO.md §5.4 (shift left, the new bit 0 = XOR of the two tap
  bits, the output is the new bit 0). IstvanV's post gives the same taps; ep128emu's table comment
  names the polynomials.
- **Checked for this file** (*my own computation*, a short Python model of each rule):
  - **Every tap pair is maximal-length.** The periods are 15, 31, 127, 511, 2047, 32767 and 131071.
  - **The implementations agree up to phase.** These all produce the same bit sequence, differing only in phase:
    - the EXOS-book rule (Fibonacci, shift left, output the new bit 0);
    - ep128emu's reversed table read with a down-counting phase (its output is the top tap before the shift);
    - CLK's right-shifting Galois form with masks 0xC / 0x14 / 0x60 / 0x110 / 0x500 / 0x6000 / 0x12000
      (`Dave.hpp`, `Numeric/LFSR.hpp`, `LFSR::next`);
    - the FPGA core's shift-left registers (output bit 0).
  - The EXOS book's 4-bit sequence `100010011010111` is a rotation of the sequence they generate.
- **Seeds.**
  - ep128emu fills its tables from an all-ones register (`calculate_polycnt`), and sets every phase
    to 0 on reset (`Dave::reset`). So after a reset the noise restarts from the same point.
  - The FPGA core initialises every LFSR to all ones and never resets them.
  - CLK's `LFSR()` constructor picks a random non-zero state.
  - The real chip: the DAVE gate plan shows every poly cell reset by the /MRES line (§2.6, *reading*), so a master reset clears them. The feedback has an extra NOR term whose effect on the period is open (§9 item 9).
  - *Inference*: if DAVE's reset cleared its poly registers to zero they would lock up, so either
    reset sets them to a non-zero value or reset does not touch them.
- **Changing the variable length.** ep128emu takes its phase modulo the new length, which keeps the
  position within the new table. The FPGA core keeps one 17-bit shift register and only switches the
  feedback taps, so a length change carries the low bits over.
  *Inference*: the FPGA behaviour is closer to plausible hardware (one register, muxed feedback), but
  only a recording of a length switch could show the difference.

### 3.5 Sync (A7h bits 0–2)

| Source | While sync = 1 | On clearing | Ring modulator | TG interrupt |
|---|---|---|---|---|
| IstvanV (DAVE thread, reply #125, 2016-03-02) | counter reloaded; square output 0 | counter reloaded | — | the B4h bit is separate from the sound |
| ep128emu `writePort` 07h | `run = 0` stops the counter; flip-flop = 0 | phase = code, run = 1 | still applied | none (the phase is frozen) |
| CLK `update_channel` | count = reload each tick; output 0 | counts on the next tick | applied ("per SIDBasic") | `TimedInterruptSource`: value = reload, no flips |
| MAME `sync_tone_channel` | timer stopped; level 0 | timer restarted for n + 1 | no ring modulator | none |
| FPGA `audio.v` | count = period each tick | counts on | the output register is not updated (the channel only updates on its own zero) | `irq0`/`irq1` = counter zero, never while held (unless code 0) |
| DAVE gate plan, sheet 2 (§2.6, *reading*) | SYNC0 resets the output flip-flop (output 0) and the counter-load flip-flop (held at preset) | — | not separately gated; the ring XOR uses the registered partner output | the "2T0" reload-pulse flip-flop is reset too, so no interrupt while held |

- MAME's note: EXOS uses a held tone channel as the interrupt source to make a programmable
  timeout in its cassette routines (`dave.cpp`, `io_w` case A7h). So sync and the TG interrupt are on
  the tape-loading path, and the interrupt timing matters beyond audio.
- MAME also acts only when a sync bit **changes**. Rewriting A7h with the same sync bits leaves the
  running channels alone. ep128emu's code has the same effect: writing 0 to a running channel does nothing.

### 3.6 D/A mode

- Spec: in D/A mode the side "constantly" outputs channel 0's amplitude register (R8 or R12).
- IstvanV (DAVE thread, reply #77/#78 context, 2013-08-22, quoted by Zozosoft):
  - the D/A bits only gate the output;
  - every time slot outputs ch0's value, so the level is 4× the register;
  - one side can be D/A while the other plays tones;
  - the generators, filters and counters keep running.
- So the tone-generator interrupt still works in D/A mode, and does not affect the audio (IstvanV,
  2011-11-14, DAVE thread page 5). This is how sample players time themselves (§6.3).

---

## 4. Analogue output path

### 4.1 Where this comes from

- **The Enterprise 64 schematic diagram, drawing 03-06**, sheets 1–4, © 1984 Enterprise Computers,
  issue history to 1986. It is hosted on ep128.hu as JPEGs (2048 × 1448):
  <http://www.ep128.hu/Ep_Hardware/Pic/EP64-1.jpg> … `EP64-4.jpg`. Sheet 1 was linked from the DAVE
  thread by Ferro73 (2011-03-03).
  - Sheet 2 holds the audio, tape and I/O.
  - Sheet 3 holds NICK and the video, with the "SOUND CONTROL" line.
  - The scan is low-resolution: component values are readable, but some wiring is not. Read
    against it, and against the higher-resolution official PDFs listed in §10.
- **IstvanV** analysed the tape and monitor outputs (DAVE thread, page 7, 2015-03-03).
- **The EXOS book**: the sound driver §6.1, the tape driver §4.2/§4.6, the NICK §13 FIXBIAS, and the connector pinouts.

### 4.2 DAC and filter (EP64 schematic sheet 2, top left)

| Element | Value / part | Role |
|---|---|---|
| DAVE pins LH0–LH5, RH0–RH5 | six digital outputs per side | The time-multiplexed 6-bit level, one set per side (the pin names are printed on U3) |
| RP1 (left), RP3 (right) | resistor packs; values **not printed**. The Code Book lists a custom 7-pin SIL network, part 14-27, whose values are in a separate specification (§2.3) | Weighted resistors, the DAC. DAVE's LH/RH pins are open-drain (§2.3) |
| U22 (LM324) sections, pins 2/3→1 and 6/5→7 | inverting stages; the packs feed the inverting inputs | Summing (current-to-voltage) amplifier per side |
| C17 ‖ R20 (left), C18 ‖ R21 (right) | 4.7 nF ‖ 1.5 kΩ in the feedback | First-order low-pass: f = 1/(2π · 1.5 kΩ · 4.7 nF) ≈ **22.6 kHz** (*my calculation*) |
| R7 10 kΩ from +5 V, with R18/R19 1.5 kΩ and C13/C14 220 pF | at the non-inverting inputs | DC bias of the stages, about 0.65 V if it is a 10k/1k5 divider (*inference*; the wiring is unclear in the scan) |
| C19 / C20 10 µF | in series with the outputs | AC coupling: the jacks carry no DC offset |

What follows (*inference*, from the topology):
- The ~1 MHz slot multiplexing and the 250 kHz tick content are attenuated by the 22.6 kHz pole.
  So the analogue output is effectively the **average of the four slots**, and summing the channels
  is the right model. Only the overall scale differs (sum/4 against full scale).
- The pole is only first order, so content at 30–125 kHz is reduced but not removed. Ultrasonic
  tones (codes 0–3) are therefore not silent on a scope, though they are inaudible.
- IstvanV's remark about non-linearity (question J) is about RP1/RP3, and probably also the open-drain pins' on-resistance (§2.3). They would need measuring.

### 4.3 Outputs

| Output | Path (sheet 2) | Notes |
|---|---|---|
| Tape out (CAS1, "LH" plug) | C19 → **R34 330 Ω** (and R35 330 Ω) to the CAS1 jack | The EXOS book says the tape output is the same as the headphone socket. IstvanV (2015-03-03): the outputs are separated by resistors, so a mono plug shorting one side still leaves sound on the monitor. The 10 µF with 330 Ω makes a high-pass of about **48 Hz when loaded**, which may thin the bass. |
| Monitor/SCART audio (monitor connector A7 = left, B7 = right) | via R38 / R41 **1 kΩ**, in a 10 kΩ / 1 kΩ network (R36–R44) | The monitor connector pinout is in the EXOS book: A7 left audio, B7 right audio. Zozosoft: the tape output was also taken to SCART through a jack cable. |
| Internal speaker | **U38 LM386N** at +9 V, gain 20 (pins 1 and 8 open), C212 100 µF to a **16 Ω** speaker, Zobel R207 10 Ω + C213 47 nF; input R206 2.2 kΩ with C40 10 nF; "SOUND ON/OFF" through D11 1N4148 to pin 2 | MAME's ep64.cpp board notes list the LM386. The ON/OFF line comes from NICK VC1 (sheet 3: VC1 through U31/U32 gates to "SOUND CONTROL"). EXOS sets it from `MUTE_SND` (sound driver §6.1). It mutes only the speaker. |
| Tape input monitor | CAS2 → C16 10 µF, R27 330 Ω, R28 10 kΩ → U22 pins 12/13→14 (R25 15 kΩ) → U23 LM339 comparators (data and level, R31 1 MΩ hysteresis); also via R23 1 kΩ and U29 (7406 open collector) into the third U22 section (pins 9/10→8, R22 10 kΩ) → C21 → the mixing network | B5h bit 5 = 1 turns the tape sound off. EXOS book tape §4.6 says the input reaches the hi-fi and speaker but **not** the headphone/tape output. *Inference*: the 7406 shorts the monitor path under B5h bit 5. |
| Expansion connector audio in | A1 = RH, B1 = LH "AUDIO IN" | External cards can mix into the outputs (*inference*: through the same network) |

**The mono speaker mix.** The schematic shows a 10 kΩ network feeding the LM386, so the speaker
probably plays a passive mix of left and right (*inference*). The 10 nF at the LM386 input with
R206 2.2 kΩ and the source resistances add more treble roll-off. No source gives the speaker's
response. It matters only for a "speaker" listening mode, if Klive ever wants one.

**Tape output level.** EXOS writes the tape signal with the left D/A (A7h bit 3, levels in A8h). `LV_TAPE`
gives 20 mV to 700 mV peak-to-peak (EXOS book tape §4.2). The 700 mV top level is presumably close to
the full scale of 4 × 63 through the output network (*inference*).

### 4.4 What an emulator must model and what it can ignore (*inference*)

| Must model | Can approximate | Can ignore |
|---|---|---|
| The per-tick digital state and the per-side sum (×4 in D/A mode) | The 22.6 kHz pole, as a one-pole low-pass, or let the host resampler's anti-alias filter stand in for it | The time-slot order and length |
| DC removal (the outputs are AC-coupled, the digital sum is unipolar 0–252) | The 48 Hz loaded tape-out high-pass | LM386 and speaker colouration, unless a speaker mode is wanted |
| NICK 80h bit 7 speaker mute, as a no-op for the hi-fi output | The tape-input monitor mixing (B5h bit 5) | The expansion-bus audio input |
| The left D/A as the tape-out signal (§7.3 of DAVE_MEMORY_IO.md) | DAC non-linearity (a 64-entry table later, if it is ever measured) | — |

---

## 5. FPGA re-implementations

### 5.1 Which cores exist

| Core | Repository | Licence | Audio file |
|---|---|---|---|
| Kyp069 "Elan Enterprise FPGA implementation" (Kyp069 2023, Rampa069 2024) | <https://github.com/Kyp069/ep> (last push 2024-05-12) | GPL-3.0-or-later (file header) | `hdl/audio.v`, `hdl/dsg.v` (sigma-delta DAC) |
| MiSTer-devel Enterprise_MiSTer | <https://github.com/MiSTer-devel/Enterprise_MiSTer> (last push 2025-11-25) | GPL-3+ (same headers) | `rtl/audio.v`: **byte-identical to Kyp069's** (`diff` is empty) |
| albconde/Enterprise_Mister | <https://github.com/albconde/Enterprise_Mister> | — | `rtl/audio.v` (not compared) |
| RetroWiki FPGA DevTeam (kyp, yo_me, rampa) | binaries only: <https://github.com/noemiabril/Enterprise_MiSTer-Arrow_SoCKit>; forum <https://misterfpga.org/viewtopic.php?p=50333> | — | — |

So there is effectively **one** FPGA DAVE sound implementation. It was not written from a decap, and
nothing in it cites measurements.

### 5.2 What the core does (read for facts only)

- **Clocks.**
  - The DAVE tick is a clock enable once every 128 cycles of 32 MHz, which is 250 kHz.
  - The 31.25 kHz noise clock is bit 9 of a free-running counter on the 32 MHz clock (32 MHz / 1024).
  - The CPU speed setting (4, 8 or 16 MHz) does not touch the audio enable.
  - **BFh bit 1 is ignored.**
- **LFSRs.**
  - The 4, 5 and 7-bit LFSRs and the 17-bit one shift left at 250 kHz. The variable 9/11/15/17
    length is made by switching the feedback taps on one 17-bit register.
  - Separate copies of the 7-bit and 17-bit LFSRs are clocked by the noise clock.
  - All are seeded with all ones. The output is bit 0. The taps are the same as the EXOS book's.
- **Tone counters.** Each is a 12-bit counter that reloads when zero or when sync is set. The
  square flip-flop toggles on zero. Code 0 therefore toggles on every tick.
- **Channel update.**
  - A channel's output register changes **only on its own counter's zero**. Distortion is sampled
    then, the high-pass is tested against the partner's last edge then, and the ring XNOR is applied
    then.
  - So in this core the ring modulator and the high-pass are **not continuous**, unlike ep128emu,
    CLK and IstvanV's "XNOR gate" description.
  - Channel A's ring term uses its own previous output instead of its high-pass output. This looks
    like a bug (*inference*).
- **The 7-bit selection looks swapped.** With the swap bit **clear**, distortion code 11 selects the
  *noise-clocked* 7-bit copy. With it set, it selects the 250 kHz 17-bit register. This contradicts
  the spec, where the tones get the 250 kHz 7-bit counter when the bit is clear.
- **Noise.**
  - It steps on the rising edge of the selected clock, which is the tone counters' *zero pulse*,
    not the falling edge of their final output.
  - The low-pass, high-pass and ring stages are evaluated on that clock too.
- **Mix.**
  - Per side, the 6-bit amplitudes of the active channels are summed to 9 bits.
  - D/A mode outputs channel 0's amplitude ×1.
  - MiSTer sends `{sum, 7'b0}` as **unsigned** 16-bit audio: the same ×128 scaling as ep128emu.
- **Reset** sets A7h to 07h (all three channels in sync) and every other register to 0.
- **Tone-generator interrupts** are the ch0 and ch1 counter-zero pulses.

**Conclusion** (*inference*): the FPGA core is a useful cross-check for the clocks (250 kHz, the
31.25 kHz noise and the LFSR taps) and for the ×128 output scaling. On the edge and filter semantics
it is less faithful than ep128emu, so it is not an authority there. It does **not** support 62.5 kHz noise.

---

## 6. Forum findings and measurements

### 6.1 The source of the EXOS book appendix

The hardware appendix's "Néhány kiegészítés a DAVE dokumentációjához" (A0h–A7h, the polynomial
counters, B4h–B7h, BFh) is IstvanV's post of **2010-05-19 13:57:29** in the Hungarian DAVE thread:
<https://enterpriseforever.com/hardver/dave/msg19278/#msg19278>. The wiki's front page links it as
"Additions to the DAVE description". It is the description ep128emu implements. In the same thread,
Zozosoft thanked him, saying the polynomial, ring and filter behaviour had been unclear until then.

### 6.2 Facts from the DAVE thread (<https://enterpriseforever.com/hardver/dave/>, 15 pages)

| Date, author | Fact | Page |
|---|---|---|
| 2010-05-19 Zozosoft | INT2 comes from the SERIAL/NET "STATUS IN" input | 1 |
| 2010-05-20 IstvanV | Most effects can only be used by giving up another channel | 2 |
| 2010-05-21 IstvanV | SNDPLAY gets **7-bit** output by splitting each sample over two 6-bit channels (half each, rounded up and down). The DTM player already uses two channel pairs, so it cannot. Its original design was 5-bit (geco agrees). | 3 |
| 2010-08-12 IstvanV | Three channels mixed as 62.5 kHz squares give levels 0–189. Register writes that are not simultaneous degrade the quality. **The built-in resistor DAC is already non-linear at 6 bits on his machine.** | 3 |
| 2011-03-04/05 Ferro73, Lacika, Zozosoft | Turbo cards raise the pitch unless DAVE's clock or BFh is adjusted. Feeding DAVE a higher clock raises the pitch. | 4–5 |
| 2011-11-14 IstvanV | The sound-generator interrupt can use generator 0 or 1. That generator then runs at half the interrupt rate, usually inaudible. It also works in D/A mode without affecting the audio. | 5 |
| 2012-06-20 Zozosoft | B5h bit 5 = 1 turns the tape sound off. RD2 (B7h read) is unused. | 5 |
| 2013-08-22 IstvanV | The four generators are time-multiplexed. D/A mode drives ch0's value in every slot, about 4× louder. One side can be D/A while the other plays. Slot length "probably at most 1 µs", unmeasured: "an oscilloscope could easily find out". | 6 |
| 2015-03-03 IstvanV | The outputs are separated by resistors. 10 µF and 330 Ω give a high-pass of about 48 Hz when loaded. The op-amp type may add distortion, inaudible on square waves. | 7 |
| 2015-03-21 Zozosoft | Posted the official sheets 3007-000-22 (which turned out to be DAVE's gate-level plans, §2.1) and the DAVE pinout (credited to Werner Lindner; "comes directly from the Austrian chip manufacturer") | 7 |
| 2016-03-02 IstvanV | ep128emu reloads only on underflow. Setting or clearing sync always reloads, and the square output (not B4h) goes to 0. All counters always run, because B4h shows them. | 9 |
| 2016-03-02 Zozosoft | Ran lgb's `intfreq` test on a real 4 MHz machine: **the values match ep128emu.** With turbo only the last line changes (50/51 at 6 MHz, 7EC at 7.12 MHz). | 9 |

Pages 10–14 were not read; page 15 (2024) is about the NET interrupt. Pages 8 and 15 have no sound content.

### 6.3 Sample-playback techniques (why timing accuracy matters)

- **D/A mode PCM.** One write to A8h/ACh per sample, giving 64 levels ×4. This is the simplest. It is
  used by Furnace's DAVE driver (`src/engine/platform/dave.cpp`: DAC mode with `dacRate`/`dacPeriod`)
  and by the EXOS tape writer.
- **Volume-register PCM in normal mode.**
  - A channel's amplitude register becomes a DAC while its output is held at 1.
  - Splitting a sample over two or three channels raises the resolution: SNDPLAY's 7 bits; IstvanV's
    0–189 levels from three channels.
  - *Inference*: a channel held in sync outputs 0, and two held channels ring-modulated give
    XNOR(0, 0) = 1, a constant high. This may be why CLK's author found, through SIDBasic, that ring
    modulation must still apply during sync. Software synthesis players such as SIDBasic depend on it.
- **Interrupt-timed playback.** Players run at 8–15 kHz from the tone-generator interrupt (SIDBasic Int:
  "Dave registers 0–1 are used for interrupts", ep128.hu music page). They can also run as cycle-counted
  loops, like the MOD player, which is about 9.2 kHz at 4 MHz and scales with the CPU clock.
  - So the emulator must place each A8h–AFh write at its **exact T-state** in the 250 kHz grid, and
    must time the TG interrupt exactly (DAVE_MEMORY_IO.md §4.4).
  - Writes to several registers that are meant together land several ticks apart. IstvanV notes
    this degrades the sound, and the emulator should reproduce it rather than batch the writes per frame.
- **External DACs.** The ep.hu MOD player can output to an "external 4-channel 8-bit D/A".
  ep128emu emulates a 4-register external DAC at ports F0h–F3h (`ep128vm.cpp`,
  `externalDACIOWriteCallback`): (F0h + F1h) go to the left side and (F2h + F3h) to the right,
  each scaled ×45 and added to the DAVE output.
  *Inference*: this is the card the MOD player targets. ep128emu also has an optional reSID card.

---

## 7. Emulation design facts

### 7.1 What the existing emulators do

| Emulator | DAVE stepping | Output rate and resampling | Level scaling | DC / filters |
|---|---|---|---|---|
| ep128emu | 250 kHz state; 500 kHz call rate (`daveFrequency` 500000, settable 250 kHz–1.25 MHz in `setSoundClockFrequency`) | Converts 500 kHz to the host rate (default 48 kHz) with `AudioConverterHighQuality`, a windowed-sinc resampler with a 12 × 128 window table (`snd_conv.hpp`), or a low-quality interpolator | Each side 0–40320 = (sum + tape 63) × 128, unipolar | Two DC-block high-passes, 10 Hz each by default (`sound.dcBlockFilter1Freq`/`2Freq`, `emucfg.cpp`); an optional parametric EQ; volume 0.7071 |
| CLK | 250 kHz state, emitted at 500 kHz (input rate = 4 MHz / 8), divider 2 or 3 | `Outputs::Speaker::PullLowpass`, a low-pass resampler (`Enterprise.cpp`) | sum × (range / 252) | no explicit DC block in `Dave.cpp` |
| MAME | Timers at clock / 32; tones only, **no noise or polys** | Host rate | sum / (4 × 32768), routed at 0.25 | — |
| Xemu | Tones only ("missing noise channel, polynom counters" TODO) | 250 kHz / 6 ≈ 41.7 kHz by plain decimation, U8 output (`targets/ep128/dave.c`) | D/A ×4 | — |
| Furnace | ep128emu's core | 500 kHz to the host | ep128emu's | Furnace's own |
| FPGA (MiSTer) | 250 kHz | the MiSTer framework's `audio_out` | 9-bit sum << 7, unsigned | the framework's |

### 7.2 Recommendations for Klive (*inference*)

- **Step DAVE per tick from the Z80 T-state counter**: every 16 T-states, or 24 when BFh bit 1 = 1.
  Apply I/O writes at their T-state, catching DAVE up first, as ep128emu's `runDevices` does.
- **Produce host samples as the average of the tick outputs** over each sample interval. That is what
  Klive's Videoton TVC core already does for its sound: the average over the interval, unipolar, then a
  DC high-pass (`src/emu/machines/tvc/wasm/README.md`, "Sound").
  - A box average is weak against aliasing of 30–125 kHz content.
  - A cheap improvement that is also faithful: run a one-pole low-pass at about 22.6 kHz (the
    hardware's own pole, §4.2) at 250 kHz before averaging.
  - ep128emu-grade quality needs a band-limited resampler.
- **Scale.** Each side 0–252, plus 63 for tape feedback. Map 252 to just under full scale, or match
  ep128emu's 40320/65535 headroom. Then **remove DC** with a high-pass of about 10 Hz (ep128emu's
  default), standing in for the 10 µF output coupling.
- **Stereo.** The left and right sums are independent. There is no hardware stereo mixing apart from
  the speaker. A mono host mix is (L + R) / 2.
- **BFh bit 1 on a stock machine.** All DAVE sound and timer frequencies become ×2/3: a 166.67 kHz
  tick, and the 50 Hz interrupt becomes 33.3 Hz (120 000 T-states). The noise base becomes 20.83 kHz.
  Wait states are not affected (EXOS book BFh).
- **A Klive "turbo" setting**, if one is added, should follow the real cards. They raise the Z80 and
  DAVE input clock together, and software sets BFh = 06h at 6 MHz so that DAVE stays at 250 kHz
  (ep128.hu turbo page). So DAVE should be timed from DAVE's input clock, not from the Z80 T-states,
  once the two can differ.
- **Speaker mute** (NICK 80h bit 7) can be ignored for the main output. Record it in the state for a
  debug panel.
- **The B5h bit 5 tape monitor.** If a tape is playing and bit 5 = 0, add 63 × (input high) to both
  sides, as ep128emu does. Per the EXOS book this should not reach the tape-out signal. ep128emu's
  tape recorder samples the combined left output, so it does include it (`Ep128VM::tapeCallback`
  passes `soundOutputSignal & 0xFFFF`).

---

## 8. Test software and recordings

### 8.1 Programs that exercise DAVE

| Item | What it tests | Where |
|---|---|---|
| lgb's `intfreq.asm` | Tone-generator and timer interrupt rates and B4h dividers. **Verified against a real 4 MHz machine by Zozosoft (matches ep128emu)**, with turbo values recorded. | <https://github.com/lgblgblgb/xep128/blob/master/doc/intfreq.asm>; DAVE thread page 9 |
| EXOS cassette save/load | Left D/A tape output, tone-channel sync, TG-interrupt timeouts (MAME's `dave.cpp` comment) | the EXOS ROM |
| SIDBasic / SIDBasic Int | Ring modulation, sync, volume-register PCM, TG interrupts at 8–15 kHz | ep128.hu music page `Ep_Zene/SIDBasic.rar`; converter tools <https://github.com/istvan-v/sidbasic> (GPL) |
| SNDPLAY (Multiplay pack) | 7-bit PCM over two channels | <https://ep128.hu/Ep_Util/Multiplay.htm> |
| WAV player (1.2–32 kHz), SAMPLE 1.1, MOD player (9.2 kHz at 4 MHz; DAVE or external DAC) | D/A-mode PCM timing | <https://ep128.hu/Ep_Music_eng.htm> |
| Digitrax DTM player, ROCKDIGI and MBT player | Two-channel-pair digitised modules | same page |
| Music Box tracker | Said to use "all the capacities of the Dave chip": distortion, filters | same page; `Ep_Util/Music_Box.htm` |
| midiplay / mididisp (IstvanV) | Native DAVE synthesis at 50 Hz ticks. `midiconv` can export **raw DAVE register data**, a ready-made register-dump stimulus for comparing Klive with ep128emu. | <https://github.com/istvan-v/midiplay> (GPL) |
| IS-BASIC `SOUND` with STYLE values; the EXOS keyclick (ch0, about 1/100 s); `CTRL-G` ping (ch2) | Every distortion and filter bit through the EXOS sound driver. The driver rewrites all 16 sound registers on every 50 Hz interrupt (EXOS book, sound driver §7.1). | the ROM; the wiki's "Jó DAVE hangzások" lists STYLE 16 (4-bit distortion) pitches, some marked "test in the emulator!" |
| Games and demos the forum named for good native DAVE music | Wizard's Lair, Nodes of Yesod, Ork Megademo 2 (endi, 2010-05-21) | — |

**Klive-written tests** (*inference*). The harness pattern the pack already uses for other machines
works here: drive the ports and capture the per-tick output. Suggested cases:
- one per question in §1;
- code 0;
- sync with ring modulation;
- the low-pass and high-pass on the noise;
- the poly swap;
- a length change while running;
- D/A ×4;
- BFh bit 1.

They can be compared with ep128emu run as a behavioural oracle (the README's D12-style rule).

### 8.2 Recordings

- **No real-hardware recording made for emulator validation was found.** None has documented capture
  conditions, so none can settle noise rate, code 0 or DAC linearity.
- The wiki page "A SOUND paramétereinek hallható bemutatása" refers to an MP3,
  "zajcsatorna style 0.mp3": the noise channel at 31.25 kHz with the 17-bit poly. The link points to
  an upload form, so the file seems missing, and its source (hardware or emulator) is not stated:
  <https://wiki.enterpriseforever.com/wiki/A_SOUND_paramétereinek_hallható_bemutatása>.
- There are YouTube chiptunes (for example "Prise Metal", <https://www.youtube.com/watch?v=3L1ExLZkOgE>),
  but their capture source is unknown.

What would settle the open items:
- a scope or line-in capture of a real EP64/128, playing:
  - noise code 00 with the 17-bit poly, held for 10 s;
  - each tone with code 0;
  - a 0→63 ramp in D/A mode, one step per 100 ms (for DAC linearity);
  - the noise straight after power-on (for the seed).

---

## 9. New open questions

Status after reading the original documents (§2) is given in brackets.

1. **RP1/RP3 values and DAC linearity.** [Narrowed, not settled.] The Code Book lists the DAC pack as a
   custom 7-pin SIL network, part 14-27, "see tech. spec." (p. 30), but that specification is not in the
   pack. The pins are open-drain, so the pin on-resistance adds to each bit (§2.3). Measure a board, find
   the Welwyn 747164 / KOA M-3842 specification, or record a 0–63 ramp in D/A mode. Default: linear.
2. **Tone code 0 on real hardware** (question E). [Narrowed.] Every issue specifies 125 kHz as the top of
   the range, so toggling every tick is the design. IstvanV's "does not work reliably" is still
   unexplained, and the 12-bit counter's reload logic was not traced in the gate plan. Does it still drive
   the TG interrupt?
3. **The real edge timing inside a tick.** [Narrowed.] The gate plan registers every channel's final
   output (T0–T3) before partners use it (§2.6), so the hardware is "everything sees the previous clock's
   values", not ep128emu's sequential order. Still unknown: which clock loads the T registers (the 250 kHz
   tick or the 500 kHz one), and which edge of a T line clocks the filters. Default: ep128emu, because it
   is the validated reference; record the differences as known one-tick skews.
4. **The variable-length poly on a length change.** [Open.] Not traced in the gate plan. Default: ep128emu.
5. **Does reset touch the LFSRs and the 31.25 kHz divider phase?** [Narrowed.] The poly cells are reset
   by the /MRES line (§2.6). Still unknown: what drives /MRES on the board (power-on only, or the reset
   button too), the reset state (all zeros is the natural reading), and the divider phase. New default:
   polys cleared on reset; keep the period question (item 9) in mind, since a cleared XNOR register
   starts at a different phase from ep128emu's all-ones table.
6. **The speaker mix.** [Open.] Which of R36–R44 feed the LM386, and is the speaker L + R? The
   high-resolution board schematics are now in `docs/hardware/` (`EP64-2-0.jpg`, `EP64-2-RT.jpg`) but
   were not read for this.
7. **The analogue bias** (R7, R18/R19). [Explained, *inference*.] It is the reference that lets the
   open-drain DAC pins sink current (§2.3). Only relevant for a power-on pop. It can be ignored.
8. **The DAVE thread's pages 10–14 were not read.** [Open.] The Hungarian "SOUND" board was not searched
   either.
9. **The polynomial counters' period.** [New.] The gate plan shows an extra NOR term in the feedback of at
   least the 4-bit and 7-bit counters (§2.6). Is it a lock-up guard (period 2ⁿ − 1, as every emulator
   assumes) or a de Bruijn extension (period 2ⁿ)? Settle it with a closer reading of the full-resolution
   sheet 2, or by recording 4-bit distortion on a tone whose period is coprime to 15 and 16 and counting
   the repeat length. Default: 2ⁿ − 1.
10. **High-pass with distortion.** [New.] The gate plan's high-pass is "XOR with the value sampled at the
    partner's edge" (§2.6). For pure tones this matches ep128emu; with a distorted (poly-sampled) channel
    it gives a different waveform. Confirm the reading, then decide whether to follow the gates or
    ep128emu. Default: ep128emu until confirmed.
11. **Slot timing** (question G). [New detail.] Is the slot counter's "500K" the 500 kHz clock, making
    2 µs slots and an 8 µs rotation? Only a scope on LH0–LH5 can say; it does not change emulation.
12. **Which interrupt runs the EXOS sound tick?** [New.] The driver specifications say "once every TV
    frame" (§2.4); DAVE's 50 Hz timer is not frame-locked. Read it from the EXOS ROM.

---

## 10. Documents

**The original documents are now in `docs/hardware/`** (added by the project author) and were read for
§2. None of them was downloaded by this research.

| Document in `docs/hardware/` | Read? | What it gave |
|---|---|---|
| `DAVE_ISSUE4.pdf`, `DAVE_ISSUE5.pdf`, `The_Dave_Chip.pdf` | yes, all pages | §2.2: the issues compared; R31 is W; Issue 4's B4h layout and XRAM select |
| `DAVE-Chip-Pinout-and-plastic-package-dimensions.pdf` | yes | §2.3: open-drain LH/RH, /WAIT and /IRQ; Schmitt /INT1 and /INT2; CLK and ZCK |
| `Enterprise_Pinout_information.pdf`, `Enterprise-TechDesc.pdf` | yes | connector pins; **no audio levels** |
| `ET12-7_EXOS_20_Sound_Driver_Specification.pdf`, `ET12-9_EXOS_21_Sound_Driver_Specification.pdf` | yes, all pages | §2.4: driver timing, register formulas, 2.0 against 2.1 |
| `Enterprise-Code-Book_Parts-and-Suppliers.pdf` | IC and resistor pages (pp. 19–23, 29–31), headers of the rest | §2.3: the custom 7-pin SIL DAC network (values not given), 2 % parts, LM386 variants |
| `A3PER-1_Enterprise_64-128_Bus_Timing.pdf` | yes | §2.7: generic waveforms, no values table |
| `3007-000-22_Sheet-1.pdf`, `…Sheet-2.pdf` (DAVE gate plans) | targeted crops | §2.5–2.6 |
| `3006-0000-22_Sheet-1.pdf`, `…Sheet-2.pdf` (NICK gate plans, *inference*) | no | — |
| `EP64-1-0.jpg` … `EP64-4--2.jpg` (board schematics) | no (§4 was read from the online JPEGs earlier) | open question 6 |
| `NICK-DAVE-Legend_to_Plans.txt` | yes | ESPRIT = DAVE, ELITE = NICK, plan dates |

Still missing, and worth finding:
- **The technical specification of Code Book part 14-27** (the custom DAC resistor network; Welwyn
  747164, AB Microelectronics, KOA M-3842). It holds the DAC values (open question 1).
- The value table for drawing A3PER-1 (the parameters 1–43).

The archived copies on `enterprise.iko.hu` (index:
`http://web.archive.org/cdx/search/cdx?url=enterprise.iko.hu/technical/*`) are the source of most of
these files; the live URLs return 404.

---

## 11. Sources

Local (in this pack):
- `docs/hardware/`: the original documents listed in §10, cited in §2 by the short names of the
  Conventions
- `docs/Technical_Documentation_DPC_Sound_Chip.html` and `docs/Dave_spec_lgb.html`: primary spec Issue 5 (same text)
- `docs/Exos.htm`: the EXOS 2.1 book. Sound driver chapter (§2 interrupt tick, §5.3 register writes,
  §6.1 MUTE_SND, §7.1–7.2 register refresh and keyclick); tape driver §4.2 LV_TAPE and §4.6 TAPE_SND;
  video driver §7.2 FIXBIAS; NICK §13 port 80h; hardware appendix "Néhány kiegészítés a DAVE
  dokumentációjához" (= IstvanV's post); connector pinouts
- `clk/Machines/Enterprise/Dave.cpp`, `Dave.hpp`, `Enterprise.cpp`, `clk/Numeric/LFSR.hpp` (CLK, MIT)
- `src/emu/machines/tvc/wasm/README.md` (Klive's TVC sound sampling)

ep128emu (GPL-2.0+, read only): <https://github.com/istvan-v/ep128emu>
- `src/dave.cpp`: `calculate_polycnt`, `DaveTables::DaveTables`, `Dave::runOneCycle_`,
  `findPolycntForToneChannel`, `writePort` (06h, 07h, 15h, 1Fh), `readPort`, `reset`
- `src/dave.hpp`: `clk_62500_frq`, the output range comment, `runOneCycle`
- `src/ep128vm.cpp`: the DAVE scheduling loop, `tapeCallback`, `externalDACIOWriteCallback` (F0h–F3h),
  `sidCallback`, `setSoundClockFrequency`, `setCPUFrequency`
- `src/snd_conv.hpp`: `AudioConverter`, `DCBlockFilter`, `AudioConverterHighQuality`
- `src/emucfg.cpp`: the `sound.*` defaults

Other emulators:
- Furnace: <https://tildearrow.org/furnace/doc/latest/7-systems/dave.html>;
  <https://github.com/tildearrow/furnace/tree/master/src/engine/platform/sound/dave> (ep128emu's core);
  `src/engine/platform/dave.cpp` (chipClock 8 MHz, rate = clock/16, DAC playback)
- MAME (BSD-3): <https://github.com/mamedev/mame/blob/master/src/mame/enterprise/dave.cpp>
  (`start_tone_channel`, `sync_tone_channel`, `update_dac`, `sound_stream_update`, `io_w` A7h);
  <https://github.com/mamedev/mame/blob/master/src/mame/enterprise/ep64.cpp> (board notes listing the LM386, `dave_lh_w`, speaker routing)
- Xemu (GPL): <https://github.com/lgblgblgb/xemu/blob/master/targets/ep128/dave.c>
- CLK commit history of `Machines/Enterprise/Dave.cpp`, especially 264b8dfb28 "Dave: apply ring
  modulation even in sync mode" (2021-07-07): <https://github.com/TomHarte/CLK/commits/master/Machines/Enterprise/Dave.cpp>

FPGA:
- <https://github.com/Kyp069/ep>: `hdl/audio.v`, `hdl/ep.v` (clock enables), `hdl/dsg.v`
- <https://github.com/MiSTer-devel/Enterprise_MiSTer>: `rtl/audio.v` (identical), `Enterprise.sv` (AUDIO_L/R, unsigned)

Forum and wiki:
- DAVE thread (Hungarian), enterpriseforever.com:
  - IstvanV's DAVE notes, 2010-05-19: <https://enterpriseforever.com/hardver/dave/msg19278/#msg19278>
  - page 2: <https://enterpriseforever.com/hardver/dave/15/>
  - page 3: <https://enterpriseforever.com/hardver/dave/30/>
  - page 4: <https://enterpriseforever.com/hardver/dave/45/>
  - page 5: <https://enterpriseforever.com/hardver/dave/60/>
  - page 6: <https://enterpriseforever.com/hardver/dave/75/>
  - page 7: <https://enterpriseforever.com/hardver/dave/90/>
  - page 8: <https://enterpriseforever.com/hardver/dave/105/>
  - page 9: <https://enterpriseforever.com/hardver/dave/120/>
  - page 15: <https://enterpriseforever.com/hardver/dave/210/>
- Enterprise wiki: <https://wiki.enterpriseforever.com/> (front page), "Jó DAVE hangzások", "A SOUND paramétereinek hallható bemutatása"
- ep128.hu: <https://ep128.hu/Ep_Music_eng.htm> (players and trackers); <http://ep128.hu/Ep_Hardware/Ep_Turbok.htm> (turbo cards, DAVE clock); <http://www.ep128.hu/Ep_Hardware/Pic/EP64-1.jpg>–`EP64-4.jpg` (schematic)
- IstvanV's tools: <https://github.com/istvan-v/midiplay>, <https://github.com/istvan-v/sidbasic>
- MiSTer forum thread: <https://misterfpga.org/viewtopic.php?p=50333>
- Archived enterprise.iko.hu technical and schematic indexes (Wayback CDX, see §10)
