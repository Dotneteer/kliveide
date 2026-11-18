# SAM Coupé: sound, input and I/O (everything except the ASIC's video, memory and contention)

Research notes for a cycle-accurate SAM Coupé emulator in Klive IDE. This file covers the
Philips SAA1099, the beeper and tape lines on port FEh, the keyboard and joystick, the MGT mouse,
the tape system, MIDI, the printer ports and the expansion devices people actually used, and ends
with a port map. The ASIC's video, paging, interrupts and contention belong to the companion file;
they appear here only where an I/O device depends on them.

Conventions:
- Ports are hex unless written as decimal ("port 254"). A 16-bit port is `HHLL`: `LL` is A0–A7
  (what the ASIC decodes first), `HH` is A8–A15 (the B register in `IN A,(C)` / `OUT (C),A`).
- **TM** means the *SAM Coupé Technical Manual v3.0* (Bruce Gordon and Andy Wright, MGT; SAA1099
  supplement by Andy Graham). Text version: <https://sam.speccy.cz/systech/sam-coupe_tech-man_v3-0.txt>;
  PDF: <https://www.worldofsam.org/system/files/2018-05/sam-coupe_tech-man_v3-0.pdf>. Line references
  ("TM l.1037") are to the text version, which is an OCR of the PDF and has OCR errors
  ("GLUT" for CLUT, "31.25RHz").
- **SimCoupé** is <https://github.com/simonowen/simcoupe> (GPL, read for facts only).
  **SAASound** is <https://github.com/stripwax/SAASound> (BSD-3, see §0). **MAME** is
  <https://github.com/mamedev/mame>. Emulator facts give the file and function; nothing is copied.
- *Inference* marks my own conclusions. Where sources disagree, both versions are given.

---

## 0. Licences (checked 2026-11-18)

| Source | Licence | How checked |
|---|---|---|
| SimCoupé (`simonowen/simcoupe`) | GPL-2.0 (headers say "version 2 or later") | GitHub API `license.spdx_id` = GPL-2.0; `License.txt`; header of `Base/SAMIO.cpp` |
| SAASound (`stripwax/SAASound`, upstream; `simonowen/SAASound` is a fork) | **BSD-3-Clause** ("Copyright (c) 1998-2004 Dave Hooper; 2004-2025 Dave Hooper + Simon Owen") | `LICENCE` file at <https://github.com/stripwax/SAASound/blob/master/LICENCE>; GitHub API reports NOASSERTION because the text is not recognised |
| SAASound licence history | Proprietary terms → LGPLv2 (commit of 2018-08-13, "changes the LICENCE from my weird proprietary thing to LGPLv2") → BSD-3 (current file; last `LICENCE` commit 2025-10-16 "Update copyright notice"). A 2018 World of SAM post by Hooper says "GPLv2" and that a move to BSD was planned; SourceForge still lists LGPLv2 | `gh api repos/stripwax/SAASound/commits?path=LICENCE`; <https://www.worldofsam.org/node/1082>; <https://www.sourceforge.net/p/saasound/> |
| MAME `src/devices/sound/saa1099.cpp` | BSD-3-Clause (Juergen Buchmueller, Manuel Abadia) | file header line 1 |
| MAME `src/mame/samcoupe/samcoupe.cpp` | **GPL-2.0+** (Lee Hammerton, Dirk Best), *not* BSD | file header line 1 |
| MAME `src/devices/bus/samcoupe/**` (mouse, SAMBUS, Dallas, SPI, SID, SD-IDE, VoiceBox, Blue Alpha, Atom) | GPL-2.0+ (Dirk Best) | file headers |
| MiSTer SAM core (`MiSTer-devel/SAM-Coupe_MiSTer`), `rtl/saa1099.sv` | GPL-2.0 (Sorgelig 2016-2019, "based on SAA1099.v by Miguel Angel Rodriguez Jodar, based on SAASound") | GitHub API; file header |

*Inference*: SAASound and MAME's `saa1099.cpp` are the two permissively licensed SAA1099 models;
everything SAM-specific in MAME and all of SimCoupé is GPL and is facts-only reading.

---

## 1. Philips SAA1099 sound chip

### 1.1 Chip, clock and ports on the SAM

| Item | Value | Source |
|---|---|---|
| Chip | Philips SAA1099 (18-pin DIL): /WR (1), /CS (2), A0 (3), OUTR (4), OUTL (5), IREF (6), /DTACK (7), CLK (8), GND (9), D0–D7 (10–17), Vcc (18) | Wikipedia <https://en.wikipedia.org/wiki/Philips_SAA1099>; World of SAM "Sound Issues" <https://www.worldofsam.org/node/1885> |
| Clock on the SAM | 8 MHz. MAME: `SAA1099(config, "saa1099", 24_MHz_XTAL / 3)`; TM lists an 8 MHz `BMHZ` signal on the Euroconnector (pin 24A); World of SAM troubleshooting says "pin 8: 8MHz clock" | `samcoupe.cpp` machine config; TM l.461; node/1885 |
| Register-select port | **511 = 01FFh** (write only) | TM l.844 "SOUND ports (address port 511 dec) and (data port 255 dec)" |
| Data port | **255 = 00FFh** (write only). A read of FFh returns the ASIC's ATTRIBUTES register, not the SAA | TM l.844, l.1035 |
| 16-bit decode | Low byte FFh selects the SAA; **A8** drives the chip's A0: A8 = 1 → register select, A8 = 0 → data. A9–A15 are ignored. SimCoupé `SAADevice::Out` (`Sound.cpp`) tests `(port & 0x1FF) == 0x1FF` for the address write, anything else with low byte FFh is data; MAME maps `0x00FF` and `0x01FF`, both `mirror(0xFE00)` | `Base/Sound.cpp`, `Base/SAMIO.h` (`SAA_ADDR_PORT`, `SAA_MASK`); `samcoupe.cpp` `io_map` |
| Readback | None. The chip is write-only; SAASound's `ReadAddress` returns 0 outside debug builds | `SAAImpl.cpp` |
| Reset | The SAA has no reset pin. The SAM RESET button does **not** reset the sound chip registers (TM l.329–331). The SAM ROM clears all 32 registers in software at start-up (Velesoft) | TM; <http://velesoft.speccy.cz/saa1099-cz.htm> |
| Prototype history | SAM prototypes carried an AY-3-8912 on a different port; production machines have the SAA1099 | World of SAM search snippet (node/236 family); not checked further |

Register address writes take only the low 5 bits (SAASound `CSAADevice::_WriteAddress`: `nReg & 31`;
MAME `control_w`: low 5 bits).

I/O timing: SimCoupé applies the ASIC's I/O wait to every port whose low byte is ≥ F8h
(`IO::WaitStates` in `SAMIO.h`), which includes the SAA ports (FFh). Whether the SAA's /DTACK adds
any wait on the SAM is not documented anywhere I found (OQ3).

### 1.2 Register map

| Reg | Bits | Function |
|---|---|---|
| 00h–05h | 7–4 right, 3–0 left | Amplitude of channels 0–5 (0 = silent, 15 = max) |
| 08h–0Dh | 7–0 | Tone "frequency" (offset N, 0–255) of channels 0–5 |
| 10h | 2–0 ch0, 6–4 ch1 | Octave (0–7) |
| 11h | 2–0 ch2, 6–4 ch3 | Octave |
| 12h | 2–0 ch4, 6–4 ch5 | Octave |
| 14h | 5–0 | Frequency (tone) enable, bit n = channel n |
| 15h | 5–0 | Noise enable, bit n = channel n |
| 16h | 1–0 NG0, 5–4 NG1 | Noise clock source (§1.4) |
| 18h | | Envelope generator 0 (channels 0–2 group) |
| 19h | | Envelope generator 1 (channels 3–5 group) |
| 1Ch | bit 0 SE, bit 1 R | Sound enable (all outputs), Sync/Reset of all generators |

Registers 06h, 07h, 0Eh, 0Fh, 13h, 17h, 1Ah, 1Bh, 1Dh–1Fh are unused (SAASound ignores them; MAME
logs them). MAME's header: "Unspecified bits should be written as zero."

Sources: MAME `saa1099.cpp` header table; SAASound `CSAADevice::_WriteData` (`SAADevice.cpp`);
TM l.1150–1265; World of SAM SAA1099 page <https://www.worldofsam.org/node/236>.

Envelope register (18h/19h) bits:

| Bit | Meaning (TM, MAME, SAASound agree) |
|---|---|
| 0 | Right channel = inverse of left ("mirror"); 0 = same envelope both sides |
| 3–1 | Shape (0–7, table in §1.5) |
| 4 | Resolution: 0 = 4-bit (16 steps), 1 = 3-bit (8 steps) |
| 5 | Clock: 0 = internal (tone generator 1 for EG0, 4 for EG1), 1 = external (an *address* write of 18h/19h to port 511) |
| 6 | Unused |
| 7 | Envelope enable |

Disagreement: the World of SAM SAA1099 page, as fetched, gives bit 3 = resolution and bit 4 = clock.
TM (l.1259–1263), MAME, SAASound and Furnace's docs
(<https://tildearrow.org/furnace/doc/latest/7-systems/saa1099.html>) all say bit 4 = resolution,
bit 5 = clock. *Inference*: the World of SAM text (or my fetch of it) is off by one; follow the
majority, but check the datasheet (OQ1).

### 1.3 Tone generators

Frequency formula (SAASound `CSAAFreq::_SetClockRate`, comment and table; MAME `saa1099.h`
`freq()` = `(511 − N) << (8 − octave)` master-clock units per half cycle):

    f = (clock / 512) × 2^octave / (511 − N)   =  15625 × 2^octave / (511 − N)  Hz at 8 MHz

Checks against TM's chromatic table (TM l.1186–1203, "Actual frequency" column): N = 33, octave 3 →
125000 / 478 = 261.506 Hz (TM: 261.506); range octave 0, N = 0 → 30.6 Hz ("31 Hz") to octave 7,
N = 255 → 7812.5 Hz ("7.81 kHz"). (The arithmetic is mine; it matches the TM column exactly.)

The output is a square wave; the generator toggles its level every half period. Each toggle is the
event that clocks the attached devices: generator 0 → noise 0 (source 3), generator 3 → noise 1,
generator 1 → envelope 0 (internal clock), generator 4 → envelope 1 (SAASound `SAADevice.cpp`
constructor wiring; MAME `sound_stream_update`, `ch == 1` / `ch == 4`; TM l.1253, l.1261).

**Buffered octave/frequency updates** (SAASound `CSAAFreq::SetFreqOffset`, `SetFreqOctave`,
`UpdateOctaveOffsetData`; the comment cites Philips): new octave and offset are latched and only
take effect at the end of the current half cycle. If the octave is written *before* the offset, at
the next half-cycle boundary only the octave is applied and the offset waits one more half cycle;
offset-then-octave applies both together. While the sync bit is set, writes take effect at once.
MAME does not model this buffering (writes are immediate). Real-chip status: SAASound says
"Philips even documented as much"; not tested by me.

### 1.4 Noise generators

| Source (16h field) | Clock | Notes |
|---|---|---|
| 0 | clock / 256 = 31.25 kHz | TM: "0 = 31.25 kHz" |
| 1 | clock / 512 = 15.625 kHz | TM: "15.6 kHz" |
| 2 | clock / 1024 = 7.8125 kHz | TM: "7.8 kHz"; World of SAM page says 7.6 kHz (*inference*: typo) |
| 3 | Each half-cycle toggle of tone generator 0 (NG0) or 3 (NG1) | TM: "controlled by the frequency of Generator 0 / Generator 3" |

Rates: SAASound `CSAANoise::_SetClockRate` (clock >> 8) and `SetSource` (>> source); MAME
`256 << param`. In source 3 the LFSR shifts once per half cycle of the tone generator, i.e. at
2 × f_tone (SAASound `Trigger` from each toggle; MAME uses the channel's half-period counter).
MAME notes as a todo that the rate should double again while the sync bit is set; SAASound's comment
says that with sync set the noise is clocked on every master clock ("8 MHz noise"), untested.

LFSR, three versions:

| Source | Polynomial / form | Seed | Output |
|---|---|---|---|
| SAASound `CSAANoise::ChangeLevel` | 18-bit Galois, x^18 + x^11 + x^1: if bit 0 set, shift right and XOR 0x20400, else shift right. Period 2^18 − 1. Comment credits Jepael (Vogons thread 51695): "Verified to match recorded noise from my SAA1099P" | `0xFFFFFFFF` for both generators (`CSAADevice` constructor) | bit 0 |
| MAME `sound_stream_update` | Same polynomial written as a Fibonacci shift-left: new bit 0 = 1 when bits 17 and 10 are equal (XNOR), shift left | not set in the code; comment "initial state is probably all 1s" | bit 0 |
| MiSTer `saa1099.sv` `saa1099_noise` | 17-bit register, feedback from bits 0 and 2 (and a reduction term) | 0 | bit 0 |

In the 2018 World of SAM thread Dave Hooper says SAASound took the "official" LFSR from DOSBox and
that "the initial seeds are unknown" (<https://www.worldofsam.org/node/1082>). The Vogons thread
(<https://www.vogons.org/viewtopic.php?f=9&t=51695>) returned HTTP 403 to WebFetch.

### 1.5 Envelope generators

Shapes (bits 3–1). TM refers to "Fig 3 in the Philips data sheet". MAME and SAASound agree on the
shapes; Furnace names them the same way.

| Code | Shape | Phases × 16 steps | Loops |
|---|---|---|---|
| 0 | Zero amplitude | 1 | no |
| 1 | Maximum amplitude (15; 14 in 3-bit mode) | 1 | yes |
| 2 | Single decay 15→0, then 0 | 1 | no |
| 3 | Repetitive decay (sawtooth down) | 1 | yes |
| 4 | Single triangle 0→15→0, then 0 | 2 | no |
| 5 | Repetitive triangle | 2 | yes |
| 6 | Single attack 0→15, then **0** | 1 | no |
| 7 | Repetitive attack (sawtooth up) | 1 | yes |

- Step clock: internal = each half-cycle toggle of tone 1 / tone 4 (so a 16-step phase lasts 8 tone
  periods); external = each write of 18h/19h to the *address* port (SAASound
  `CSAADevice::_WriteAddress` → `ExternalClock`; MAME `control_w`). The data write is not the clock.
- 3-bit mode: steps by 2 and uses only even levels (SAASound tables: 14,14,12,12,…). MAME masks
  bit 0 of the envelope value. Both give the same levels.
- Invert right: right = 15 − left (4-bit) or 14 − left (3-bit) in SAASound; MAME gives
  `(15 − left) & 0xE` in 3-bit mode, the same values.
- Non-looping shapes end at 0 ("sustain level is always zero", SAASound `SetLevels`).
- TM: "16 levels of resolution … for repetition up to 977 Hz and 8 levels for repetition rates above
  977 Hz" (TM l.1259). *Inference*: that is advice on choosing bit 4, not an automatic switch.

**Which channels the envelope affects — disagreement:**
- SAASound (`SAADevice.cpp`: only `m_Amp2` and `m_Amp5` get an envelope), MiSTer (`amp2` has
  `.envreg(env)`, `amp0/1` have `envreg(0)`) and Furnace ("envelope output on channel 3 or 6",
  1-based): **channel 2 and channel 5 only**.
- MAME `envelope_w`: writes the envelope level into all three channels of the group
  (`m_channels[ch*3+0..2]`) and multiplies every channel by it.
- *Inference*: 2 and 5 only is right; SAASound has been compared with recordings of real chips and
  MAME's file has no such claim. Confirm against the datasheet (OQ2).

**Write timing quirks (SAASound only, from its test cases `envext_34b`, `envext_34c`, `EnvExt_imm`,
which the comments say match observations):**
- A new envelope control byte is acted on at once only if the envelope has ended or has not started
  (position "(3)"); otherwise it is buffered and applied at the end of the current shape (position
  "(4)" for looping shapes, "(3)" for single ones). The enable bit and the resolution bit act
  immediately.
- Switching 4-bit → 3-bit clears the step LSB; 3-bit → 4-bit sets it.
- Disabling and re-enabling resets the phase.
- MAME instead resets the step to 0 on every data write and applies everything immediately.

### 1.6 Mixer, amplitude and output

Per channel (SAASound `CSAAAmp::Tick`, `TickAndOutputStereo`; MAME `sound_stream_update` agree on
the table):

| Tone enable | Noise enable | Output level |
|---|---|---|
| 0 | 0 | 0 |
| 1 | 0 | tone (full when tone high) |
| 0 | 1 | noise (full when noise high) |
| 1 | 1 | tone high & noise low → full; tone high & noise high → **half**; tone low → 0 |

Amplitude and envelope:
- Without envelope: output = amplitude (0–15) × level, per side (SAASound: `level × 16 × amp`,
  0–480 per channel).
- With envelope (SAASound `EffectiveAmplitude`): only amplitude bits 3–1 are used (`amp >> 1`), and
  the result is a lookup that models the chip's pulse-density modulation: the effective level is the
  low-pass of the AND of the amplitude PDM and envelope PDM patterns, not amp × env. SAASound's
  comment says enveloped output reaches only about 88 % (424/480) of full scale.
- Also SAASound: with the envelope active, the channel output is `env × (2 − level)`, i.e. the
  envelope is gated by the *inverse* of the tone/noise level. MAME multiplies by the level in the
  normal sense. *Inference*: on a real chip the classic "envelope with tone disabled" use (tone and
  noise enable both 0) gives a pure envelope waveform in both models; they differ only when a tone is
  mixed into an enveloped channel (OQ2).
- MAME: amplitude is linear (`n × 32767 / 16`) and the envelope multiplies it (`amp × env / 16`),
  all 4 bits of amplitude used.
- Vogons (search snippet, not fetched): "the SAA1099 uses pulse width modulation to achieve
  amplitude and envelope levels … chop the output at a minimum rate of 62.5 kHz". 62.5 kHz =
  8 MHz / 128.
- Sample playback through the SAA (writing amplitude or envelope registers fast) is effectively
  3-bit on real hardware: Hooper measured 8 levels, and SAASound has an "accurate 3-bit" and a
  "nicer 4-bit" mode selectable in SimCoupé (<https://www.worldofsam.org/node/1082>).

Global register 1Ch:
- Bit 0 (SE) = 0 mutes every output (SAASound `Mute`; MAME produces no output). Tone generators
  keep running.
- Bit 1 (R, sync/reset): while set, all tone generators stop with their counters cleared and the
  frequency latches loaded (SAASound `CSAAFreq::Sync` sets the level to 1, "needed to make the Fred59
  SPACE DEMO audio work"; MAME sets the level to 0), noise counters are cleared, and the amps output
  0 (SAASound "TODO check this"). Releasing it restarts all generators in phase. SAASound's 2004 fix
  for this behaviour came from a Fred 59 demo that used sync for digital audio.
- SAASound `Clear()` (its own power-on model): write 1Ch = 02h, all other registers 0, 1Ch = 00h,
  address 0.

Analogue output: two current outputs (OUTL pin 5, OUTR pin 4) referenced by IREF (pin 6, "should
read about 2.5 V", node/1885). SAASound applies a 5 Hz DC-blocking high-pass (`scale_for_output`,
optional) and a gain of 11.35. No measured SAM output levels or filter values found (OQ4).

### 1.7 Real-chip tests and accuracy notes

- azesmbog's SAA test program (2018) and Dan Dooré's recordings from two real SAMs (YouTube
  `e_68MGy04Yc`, `gEvO21XCqMM`) are in <https://www.worldofsam.org/node/1082>. Fixes that came out
  of it: sync resets the noise counter; SAASound 3.4 fixed a regression.
- SAASound's README: the 2018 revival followed "reverse-engineering efforts of original hardware by
  the DosBox team, in conjunction with some crowd-sourced test cases". Test material lives in
  `tests/` (`SimCoupe`, `dsk` folders) in the SAASound repository.
- Hooper (same thread): emulating at 44.1 kHz instead of 8 MHz makes very fast register changes
  sound "dirty"; DOSBox runs at 8 MHz and filters down, "the right way".
- Chris Pile reported that SimCoupé 1.1 alpha changed the engine pitch in SAM Defender after enemy
  shots, which real hardware does not (unresolved in the thread).

---

## 2. Beeper and tape output (port FEh write)

BORDER register, write to any port with low byte FEh (TM l.906–916; SimCoupé `SAMIO.h`; MAME
`border_w`):

| Bit | Name | Function |
|---|---|---|
| 0–2 | BCD1, BCD2, BCD4 | Border colour CLUT index bits 0–2 |
| 3 | MIC | Cassette output. TM: "normally set high" |
| 4 | BEEP | Beeper output. TM: "normally set low" |
| 5 | BCD8 | Border colour CLUT index bit 3 |
| 6 | THROM | MIDI through: copies MIDI IN to MIDI OUT |
| 7 | SOFF | Screen off in modes 3/4 (video file) |

How the audio mixes:
- The BEEP signal comes out of the ASIC (pin 12) and goes through R41 and C19 to the OUTL, OUTR and
  MONX points, where the SAA outputs (through R42/R43) also arrive (node/1885). *Inference*: the
  beeper is summed equally into both stereo channels and the mono (RF) feed; values unknown (OQ4).
  ROM sound commands BEEP, POW, ZOOM, ZAP, BOOM use this ASIC path, SOUND uses the SAA.
- The SAM has a single 3.5 mm cassette jack that is bidirectional (TM l.333): output to the
  recorder's MIC, input from EAR; "It makes no difference to the Coupe if EAR and MIC are connected
  together". The Euroconnector's `EARMIC` (23C) is "the logic level side of the cassette port
  circuitry" (TM l.535).
- Whether MIC is audible in the speaker/TV path, or reads back on the EAR bit, is not documented
  (OQ5). SimCoupé sends only BEEP to its DAC (`BeeperDevice::Out`, level 30h of 8-bit) and never
  MIC; it echoes the playing tape's EAR level into the audio (`Tape::NextEdge`, A0h/80h). MAME
  drives the cassette output from bit 3 (`1 → −1.0`, inverted) and a speaker from bit 4, mixing
  speaker 0.5, SAA 0.5 and the cassette 0.05 into one mono speaker.
- Reset clears the BORDER register (TM l.329).

---

## 3. Keyboard and joysticks

### 3.1 Scanning

TM l.800–830: a 72-key membrane addressed "as a 9 × 8 matrix". The 9 scan lines are A8–A15 plus the
ASIC line RDMSEL; the 8 return lines are K1–K5 on KEYBOARD (port FEh bits 0–4) and K6–K8 on STATUS
(port F9h bits 5–7). A key reads as **0** when pressed and its row's address line is low (both
emulators: `IP_ACTIVE_LOW` / `key_matrix` bits cleared). Several rows can be selected at once; the
results AND together (SimCoupé `IO::In`, MAME `keyboard_r`/`status_r`).

The ninth row (RDMSEL) is selected when **A8–A15 are all high** (port FFFEh) — TM l.310 "with
address lines A8 to A15 set high (RDMSEL)". Both emulators treat high byte FFh as "row 8 only".
Row 8 has only the five FEh bits; STATUS bits 5–7 read 1 for it (SimCoupé). The mouse shares this
read (§4).

A disagreement in passing: one tutorial (mc-fred part 11, <https://sam.speccy.cz/coding/mc-fred/mc-fred_pt11.txt>,
search snippet) is summarised as "a set bit means the key is pressed". TM, MAME and SimCoupé are
active-low; *inference*: the tutorial inverts the value first.

### 3.2 Key map

Agreement between MAME `INPUT_PORTS_START(samcoupe)` (`kbd_0`–`kbd_8`) and SimCoupé `eSamKey`
(`Keyboard.h`, index = row × 8 + bit).

| Row | A-line low | Read ports (FE / F9) | b0 | b1 | b2 | b3 | b4 | b5 (F9) | b6 (F9) | b7 (F9) |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | A8 | FEFE / FEF9 | SHIFT | Z | X | C | V | F1 | F2 | F3 |
| 1 | A9 | FDFE / FDF9 | A | S | D | F | G | F4 | F5 | F6 |
| 2 | A10 | FBFE / FBF9 | Q | W | E | R | T | F7 | F8 | F9 |
| 3 | A11 | F7FE / F7F9 | 1 | 2 | 3 | 4 | 5 | ESC | TAB | CAPS |
| 4 | A12 | EFFE / EFF9 | 0 | 9 | 8 | 7 | 6 | − | + | DELETE |
| 5 | A13 | DFFE / DFF9 | P | O | I | U | Y | = | " | F0 |
| 6 | A14 | BFFE / BFF9 | RETURN | L | K | J | H | ; | : | EDIT |
| 7 | A15 | 7FFE / 7FF9 | SPACE | SYMBOL | M | N | B | , | . | INV |
| 8 | RDMSEL (all high) | FFFE | CNTRL | UP | DOWN | LEFT | RIGHT | – | – | – |

That is 69 keys in the matrix; TM's spec says 72 keys including 10 function keys (TM l.242) and the
keyboard-map chapter says "the 69 keys and 4 shift states give 276" codes (TM l.2658).
*Inference*: the 3 extra physical keys are duplicates wired in parallel or keys outside the matrix
(BREAK drives the NMI, TM l.517; RESET is a separate button); not confirmed (OQ7).

Spectrum subset: rows 0–7, bits 0–4 are exactly the ZX Spectrum matrix (CAPS SHIFT = SAM SHIFT at
row 0 bit 0, SYMBOL SHIFT at row 7 bit 1), with the same A8–A15 row lines, so Spectrum-style
`IN A,(FE)` scanning works unchanged. The SAM keys live in bits 5–7 (port F9h) and row 8.

Character legends differ from the Spectrum (SAM keycaps: `-`/`/`, `+`/`*`, `=`/`_`, `"`/`©`,
`;`, `:`, `,`, `.`, `INV` with `\`); SimCoupé `Keyboard.cpp` has two host-mapping tables (SAM
layout and Spectrum layout) built from these.

The ROM's key-code map (KTAB at 58E0h, TM memory map) is RAM-resident and user-alterable
(TM l.2658).

### 3.3 Joysticks

- TM l.296–306: 9-pin D, Atari-standard except pin 5 = 0 V, pin 7 = +5 V, pin 8 = STROBE1,
  pin 9 = STROBE2. "Read by the Keyboard port (254 dec) and overlays numeric keys 1 to 5 for second
  joystick and 6 to 0 for the first joystick."
- World of SAM "Keyboard and Joystick port" (<https://www.worldofsam.org/node/365>): the two
  "ground" pins are driven by address lines: **A12 for joystick 1, A11 for joystick 2**, so one port
  takes two sticks through a splitter. Interference between two sticks is a known problem (diagonals
  on both register as opposing directions); fixes are diodes or tristate buffers gated by STROBE1/2.
  Edwin Blink made a Triple Joystick Interface.
- So joystick 1 is a Sinclair Interface 2 "port 1" stick on row 4 and joystick 2 a "port 2" stick
  on row 3. MAME (`joy_0`, `joy_1`, behind `SAM_ENABLE_JOYSTICK`):

| Stick | Row (line) | b0 | b1 | b2 | b3 | b4 |
|---|---|---|---|---|---|---|
| 1 | 4 (A12) | FIRE (key 0) | UP (9) | DOWN (8) | RIGHT (7) | LEFT (6) |
| 2 | 3 (A11) | LEFT (1) | RIGHT (2) | DOWN (3) | UP (4) | FIRE (5) |

- SimCoupé also offers a Kempston joystick at port 1Fh (`KEMPSTON_PORT`, `IO::In`), an add-on, not
  part of the SAM.

---

## 4. Mouse (MGT SAM mouse interface)

Hardware (TM l.308–323): proprietary 8-pin DIN: DOWN, UP, CTRL, LEFT, RIGHT, MSE INT, RDMSEL, +5 V.
Read through KEYBOARD port FEh with A8–A15 high (FFFEh), the same select as keyboard row 8. TM's
bit names for that read: bit 0 "Mouse Control", 1 "Up", 2 "Down/Button 2", 3 "Left/Button 1",
4 "Right/Button 3". The mouse "interrupts the CPU to request a read" (STATUS bit 1, Euroconnector
`MSEINTL` 22A), and "the software driver is integral to the ROM and overlays the cursor control
keys".

Protocol as emulated (SimCoupé `Mouse.cpp`/`Mouse.h` `MouseDevice::In`; MAME
`bus/samcoupe/mouse/mouse.cpp` `sam_mouse_device::read`). Each read of FFFEh returns the next
nibble in bits 0–3 (ANDed with keyboard row 8):

| Read # | Nibble |
|---|---|
| 1 | Strobe/ID, 0Fh (FFh) |
| 2 | Dummy, 0Fh |
| 3 | Buttons, active low |
| 4–6 | Y movement, bits 11–8, 7–4, 3–0 |
| 7–9 | X movement, bits 11–8, 7–4, 3–0 |

- Movement is a 12-bit two's-complement delta since the last complete read; the values are latched
  when read #3 is about to be returned.
- After read #9 the index wraps to read #2 (the dummy), not #1 ("stay strobed"), in both emulators.
- If no read happens for a while the index resets to read #1: **SimCoupé 38 µs**
  (`MOUSE_RESET_TIME`), **MAME 50 µs** (`reset->adjust(attotime::from_usec(50))`). Disagreement, OQ8.
- SimCoupé returns `F0h | nibble`, so bit 4 of FFFEh reflects keyboard RIGHT, not the mouse; MAME
  returns the raw nibble ANDed with 1Fh.
- Button bits: MAME `buttons` port: bit 0 = button 1 (left), bit 1 = button 3, bit 2 = button 2.
  SimCoupé: bit (n−1) = button n, inverted. TM's direct-read names (bit 3 = button 1, bit 2 =
  button 2, bit 4 = button 3) describe the line wiring, not the nibble. OQ8.
- Sign/direction: MAME reverses X (`PORT_REVERSE`) and sends "old − new" for both axes; SimCoupé
  sends its accumulated delta clamped to ±127. *Inference*: positive X is left and positive Y is up
  in SAM terms; check with the ROM driver (OQ8).
- The mouse interrupt: SimCoupé `SAMIO.h` marks `STATUS_INT_MOUSE` "Part of original SAM design, but
  never used". The ROM polls the mouse from the frame interrupt (hook MSDML referenced in
  `Mouse.cpp`); system variable at 5AFCh lets a program bypass the ROM's mouse scan (TM l.2015).
- Detection: software reads the strobe nibble sequence; a missing mouse returns keyboard row 8 only.
  The "unofficial technical manual" lists a section "Reading the SAM Mouse without the driver /
  Detecting the presence of the Mouse interface", but the published text stops before it
  (<https://sam.speccy.cz/systech/unofficial_tech-man_v1-0.txt>).

---

## 5. Tape

### 5.1 Hardware

- EAR input: KEYBOARD port FEh **bit 6** (TM l.1044 "EAR serial input from EAR of cassette
  recorder"). SimCoupé `KEYBOARD_EAR_MASK = 0x40`; MAME `keyboard_r` bit 6 from the cassette input.
  SimCoupé's idle value has EAR = 1 (`IoState::keyboard = KEYBOARD_EAR_MASK`).
- MIC output: BORDER bit 3 (§2). One bidirectional jack.
- Other FEh read bits: bit 5 SPEN (light-pen strobe / serial input), bit 7 SOFF. TM l.1046 says bit 7
  is "status bit show if external memory is set". SimCoupé returns the BORDER register's SOFF bit;
  MAME returns 1 always. Disagreement (OQ6).

### 5.2 SAM ROM tape format

TM "TAPE SYSTEM" (l.2420–2440) and "FILE HEADER FORMAT" (l.2430–2537):
- Five file types: BASIC (16), numeric array (17), string array (18), CODE (19), SCREENS$ (20);
  type 5 is a Spectrum 48K snapshot (DOS). Data blocks use the Spectrum format but may hold up to
  512 KB. SCREENS$ files carry the palette (40 bytes) and the line-interrupt table (1–509 bytes).
- The SAM header is different from the Spectrum's "and will not be recognised by a Spectrum".
  JSAVE/JLOAD (TM l.1916–1932) use the first byte saved as the flag: **FFh = data block, 01h = SAM
  header, 00h = Spectrum header**. JLOAD with A = 01h accepts SAM or Spectrum headers; Spectrum CODE
  headers are converted to the SAM form.
- SAM header buffer (80 bytes, HDR at 4B00h, HDL at 4B50h): 0 type; 1–10 name; 11–14 name extension
  (non-tape devices); 15 flags (bit 0 = don't print name, bit 1 = protected); 16–26 type-specific
  (array name, screen MODE, BASIC lengths 16–24); 27–30 reserved; 31 start page (bits 4–0); 32–33
  start offset (8000h–BFFFh); 34 length in 16K pages; 35–36 length MOD 16K + 8000h; 37 execute page
  or FFh (BASIC: 00h = auto-run line follows); 38–39 execute offset or line number; 40–79 comment
  (DOS keeps 8 bytes).
- On tape a SAM header block is therefore **82 bytes** (flag 01h + 80 + checksum). SimCoupé
  `Tape::GetBlockDetails` recognises SAM headers by length 52h (or 53h, allowing TZX trailing bits)
  and flag 01h, Spectrum headers by length 19 and flag 00h.
- Speeds: `DEVICE T` saves at Spectrum speed, `DEVICE tN` at speed N: "Speed 112 is Spectrum speed,
  35 is much faster … LOAD automatically adjusts" (TM l.2728). SLNUM (5A07h) holds the save speed
  (TM l.1923, l.2959). TPROMPTS (5A33h) suppresses prompts.
- ROM edge routine JEDGE2 (TM l.1944–1958): counts in units of **47 T-states**, waits for two EAR
  transitions, toggles BORDER bits 2–0 on each edge (the loading stripes), D′ ≈ 46h at standard speed
  (anti-bounce pause), times out after 256 units, and checks ESC. "In version 1.0 ROMs this jump
  table entry incorrectly has bit 15 of the address set."

TZX specification v1.20 (<https://worldofspectrum.net/TZXformat.html>):
- Hardware ID for block 33h: computer `00`, ID **`09` = SAM Coupé**.
- SAM, CPC, Jupiter ACE and Enterprise "share the same tape encoding" as the Spectrum.
- SAM ROM timings with speed variable W (standard 112): pilot = 58 + 19W, pilot length 6000,
  sync1 = 58 + 9W, sync2 = 113 + 9W, bit 0 = 10 + 8W, bit 1 = 42 + 15W; "at W = 112 the standard
  Spectrum data block can be used". All TZX timings are in 3.5 MHz T-states; "SAM Coupé uses a 6MHz
  clock", so they must be scaled. *Inference*: at W = 112 that gives pilot 2186, bit 0 906, bit 1
  1722, close to the Spectrum's 2168 / 855 / 1710 but sync1 = 1066 is far from 667, so either the
  formulas are in another unit or sync differs; check against the ROM (OQ9).

### 5.3 Image formats and emulator handling

- SimCoupé loads TAP, TZX, CSW (and libspectrum also identifies WAV) through libspectrum
  (`Tape::IsRecognised`, `Base/Tape.cpp`); the author: TZX, TAP and CSW "between them can represent
  the content of any SAM tape" (<https://simonowen.com/blog/2007/01/11/simcoupe-tape-support>).
  SAM speed `tN` saves become TZX turbo blocks (10h/11h); SimCoupé's ROM load trap accepts both.
- Timing scale: libspectrum gives edges in 3.5 MHz T-states; SimCoupé multiplies by 6 / 3.5
  (`Tape::NextEdge`, with remainder carry).
- Spectrum tapes: custom Spectrum loaders mostly fail because SAM RAM is fully contended and the CPU
  speed differs; most SAM loaders call the edge routine in uncontended ROM (same blog post).
- MAME uses its TZX cassette formats (`tzx_cassette_formats`).
- Transfer tools of the period: SAMtape 1–4M (LERM, Spectrum → SAM), the Messenger (§6.6).

---

## 6. Other I/O

### 6.1 MIDI (port FDh) and network

| Item | Fact | Source |
|---|---|---|
| MIDI OUT | Write a byte to port 253 (FDh); hardware sends it at 31.25 kbaud (1 start + 8 data + 1 stop = 320 µs) | TM l.904; SimCoupé `MIDI_TRANSMIT_TIME` |
| Transmit status | LPEN (F8h read) bit 1 **TXFMST** high while a byte is being sent | TM l.282, l.1089 |
| MIDI OUT interrupt | STATUS bit 4 goes **low** when the transmission has completed | TM l.1061 |
| TM self-contradiction | TM l.905: "Bit 4 of the STATUS register (249 dec) is set high when this register is full" vs l.1061 "when low, indicates the MIDI out register has just completed" | TM |
| MIDI IN | Opto-isolated serial-to-parallel converter; interrupt (STATUS bit 2 low) when a byte is assembled; "must be read by the CPU before the next interrupt (typically 320 µs)" | TM l.267, l.1048 |
| Raw lines | VMPR (FCh) bit 7 write = TXMIDI drives MIDI OUT directly; read = RXMIDI, the MIDI IN line | TM l.856–858 |
| MIDI through | BORDER bit 6 THROM | TM l.916 |
| Network | "This connector is also used by the network" (MIDI IN/OUT pins carry SAMnet); `DEVICE N5` = network station 5; JSAVE/JLOAD use the network when SLDEV = "N" | TM l.267, l.282, l.2728 |
| SimCoupé timing | Write ignored while TXFMST is set; MIDI-OUT interrupt scheduled at write time + ~320 µs aligned to 32 T; interrupt active 16 µs (`MIDI_INT_ACTIVE_TIME`); TXFMST active window 32 µs constant (`MIDI_TXFMST_ACTIVE_TIME`) | `SAMIO.h`, `IO::Out` `MIDI_PORT` |
| SimCoupé reads | VMPR read always has bit 7 = 1 (idle line) | `IO::In` `VMPR_PORT` |
| MAME | MIDI not implemented (reads return FFh and log) | `samcoupe.cpp` `midi_r`, `midi_w` |
| ROM hooks | MIPV (called on MIDI-in interrupt, A = byte read) and MOPV (MIDI-out interrupt) at 5AEEh area | TM l.2104–2106 |

### 6.2 Printer and the Comms Interface (ports E8h–EFh)

- The SAM has no built-in printer port. The Euroconnector's `PRINTL` (25C) "is the decoded address
  for either of the two possible printer addresses" — TM l.539 says "(246 and 248)". MAME decodes
  PRINT for E8h–EFh (`print_w((offset & 0xf8) == 0xe8)`) and leaves the ports to expansion devices.
  *Inference*: "246 and 248" is an OCR or editing error for 232 and 234 (E8h/EAh); the TM's own
  ROM printer routine reads the port from a system variable (TM l.1965).
- MGT Comms Interface (World of SAM forum snippet; manual PDF
  <https://www.worldofsam.org/system/files/2018-09/SAM%20Coup%C3%A9%20Comms%20Interface%20Manual.pdf>):
  parallel port 1 at **232/233** (E8h data, E9h strobe/status), parallel port 2 at **234/235**
  (EAh/EBh), serial at **236–239** (ECh–EFh, an IM26C91 UART per the unofficial technical manual's
  contents). Printing: write the byte to 232, write 01h to 233, wait 1 µs, write 00h. The serial port
  "has a hardware bug … transmission errors after 100-200 characters" (Format Vol. 5 No. 8).
- SimCoupé (`Parallel.cpp` `PrintBuffer`): even port = data latch; odd port write bit 0 = STROBE
  (byte taken on the rising edge); odd port read = status with bit 0 = BUSY (1 when offline). Two
  ports at E8h/E9h and EAh/EBh, each optionally a printer file, a mono DAC or a stereo DAC (the
  community's "SAMdac"/EDdac sample-playback devices hang on the printer port).
- MAME `SAM_SPI` ("S.P.I. SAM Parallel Interface", `spi.cpp`): offset 0 data, offset 1 write bit 0 =
  strobe / read `FEh | busy`, offset 2 direction (0 out, 1 in).
- Conflict: ECh–EFh (Comms serial) overlaps EFh used by the SAMBUS clock (§6.4). *Inference*: the
  two were not meant to be fitted together, or the SAMBUS gates its clock with A12–A15 (OQ10).

### 6.3 Light pen (ports F8h / 1F8h read)

LPEN (F8h with A8 = 0) is the horizontal position, HPEN (1F8h, A8 = 1) the line; with no pen they
track the raster. LPEN bit 0 = border CLUT bit 0, bit 1 = TXFMST. The SPEN input is on the
light-pen/audio DIN (pin 4) and on FEh bit 5. Details: video file. (TM l.1082–1090; SimCoupé
`LPEN_PORT`, `HPEN_PORT`, `PEN_PORT_MASK = 0x1FF`; MAME `pen_r`.)

### 6.4 SAMBUS and clocks

- SAMBUS: MGT's 4-slot expansion interface with a real-time clock (manual:
  <https://www.worldofsam.org/system/files/2018-05/SAM%20Coup%C3%A9%20SamBus%20Manual.pdf>).
  MAME `sambus.cpp`: an **MSM6242** RTC at port **xxEFh**, register number = **A12–A15**
  (`offset >> 12`), gated by PRINT and A0–A2 = 7. SimCoupé `Clock.cpp` notes that the SAMBUS clock
  keeps 4 bits per digit and that invalid values written can be read back (the QDOS clock check
  relies on it). SimCoupé maps it to EFh with port < FE00h.
- Dallas clock (DS12887-type, a later add-on): MAME `dallas.cpp`: write FEEFh = address, FFEFh =
  data (mask FE07h, A8 selects); read FFEFh = data. SimCoupé maps it to EFh with port ≥ FE00h.
- The unofficial technical manual promises "Programming the real-time clock controller / Detecting
  the presence of the clock chip / Bugs in the SAM Bus hardware"; not in the published text.

### 6.5 Mass storage and sound add-ons

| Device | Ports (low byte unless 16-bit) | Notes and sources |
|---|---|---|
| Internal floppy 1 / 2 (VL1772) | E0h–E7h / F0h–F7h (mask F8h) | TM l.639–651; covered elsewhere |
| ATOM hard-disk interface (Edwin Blink) | Replaces drive 2: F5h control, F6h/F7h data high/low | MAME `drive/atom.cpp`; SimCoupé `Atom.cpp` |
| Atom Lite (CF) | Drive-port slots (left half in drive 1's ports, card in drive 2's); data ports, register latch, `case 0x1d` address | SimCoupé `AtomLite.cpp` |
| SD-IDE (S D Software, Nev Young) | BDh data, BFh register select | MAME `sdide.cpp`; SimCoupé `SDIDE.cpp` |
| SID interface (Quazar) | Write xxD4h, SID register = A8–A12 | SimCoupé `SID.cpp` (`port >> 8`, `& 0x1f`); MAME `sid.cpp` |
| Quazar Surround | D0h | Only the constant `QUAZAR_PORT` in SimCoupé `SAMIO.h`; no handler found. Quazar still lists the "Quazar Surround Soundcard" and a "Sampler Module" (<https://samcoupe.com/hardware.htm>) |
| SAMVox (4-channel 8-bit DAC) | 7Ch–7Fh, A0–A1 = channel | SimCoupé `SAMVox.cpp` ("reverse-engineered using Modules Tracker by ZKSOFT") |
| Paula (dual 4-bit DAC) | 7Ch–7Dh (A0 selects), also a 60h port | SimCoupé `Paula.cpp`, `PAULA_60_PORT` |
| Blue Alpha Sampler (8255 PPI + ADC/DAC) | 7C7Fh–7F7Fh, PPI register = A8–A9 | SimCoupé `BlueAlpha.cpp`; MAME `blue_sampler.cpp` |
| Blue Alpha VoiceBox (SP0256-AL2) | FF7Fh (read: LRQ in a status byte) | SimCoupé `VoiceBox.cpp`; MAME `voicebox.cpp` (ROM `sp0256a-al2.bin`) |
| External memory (1 MB "onemeg"/MegaRAM) | LEPR 80h, HEPR 81h | SimCoupé `SAMIO.h`; MAME `onemeg.cpp`; memory file |
| Kempston joystick | 1Fh | SimCoupé only |
| Trinity (Quazar: Ethernet, 128 KB EEPROM, MMC/SD, microcontroller hub, 1 KB boot code from EEPROM, B-DOS on SD up to 64 GB; v1.2 2023) | **Unknown** | <https://samcoupe.com/hardtrin.htm>; "programming manual covers hardware access" — not online that I found (OQ11) |
| RC2014 bus interface (Quazar, 2019/2021) | Unknown | <https://worldofsam.org/node/2015> |

SimCoupé notes that the Blue Alpha, SAMVox and Paula ports overlap and only one can be selected
(`IO::Out` default branch, option `dac7c`).

How commonly used (*inference* from how many emulators and community pages bother with them): mouse,
MIDI-as-network, the printer/Comms interface, SAMdac-style printer-port DACs and the ATOM/Atom
Lite/SD-IDE hard disks matter for real software; SID, Quazar Surround, VoiceBox and Trinity serve
small sets of titles or utilities.

### 6.6 The Messenger

A Spectrum-side interface (Sam Computers Ltd / MGT era, 1990–91) that freezes a Spectrum
(48K to +3) PLUS D-style and sends a snapshot to the SAM. It plugs into the Spectrum's edge connector
and connects to the SAM's MIDI OUT socket; "MIDI for Sam → Spectrum data and Network for Spectrum →
Sam" (World of SAM, <https://old.worldofsam.org/node/229>, summarised from search results). Nothing
to emulate on the SAM side beyond MIDI/network bit I/O.

---

## 7. Port map

Decode notes: the ASIC owns low bytes E0h–FFh (TM l.843 "Addresses 224 (E0H) to 255 (FFH) are
allocated to the Coupe itself"; E0h–EFh are decoded only into DISK1/DISK2/PRINT strobes for
external hardware). In SimCoupé ports with low byte ≥ F8h get the ASIC I/O wait; ports below do not.
Reading an unhandled port returns the current ASIC attribute byte during the screen area, FFh
otherwise (SimCoupé `IO::In` tail; floating bus, video file).

| Port (16-bit pattern) | R/W | Function | Decode / notes |
|---|---|---|---|
| xxE0–xxE7 | R/W | Floppy drive 1 (or Atom Lite) | low byte, mask F8h |
| xxE8 / xxE9 | R/W | Parallel 1 data / strobe-status | via PRINT; Comms Interface, SimCoupé |
| xxEA / xxEB | R/W | Parallel 2 data / strobe-status | as above |
| xxEC–xxEF | R/W | Comms Interface serial (UART) | Comms manual (forum summary) |
| rxEF (r = A12–A15) | R/W | SAMBUS MSM6242 RTC register r | MAME `sambus.cpp`; SimCoupé port < FE00h |
| FEEF / FFEF | W / R/W | Dallas RTC address / data | MAME `dallas.cpp`; SimCoupé ≥ FE00h |
| xxF0–xxF7 | R/W | Floppy drive 2 / ATOM | mask F8h |
| xxF8, A8 = 0 | R | LPEN (X, TXFMST bit 1, border bit 0) | `PEN_PORT_MASK` 1FFh |
| xxF8, A8 = 1 | R | HPEN (line) | |
| cxF8 (c = A8–A11) | W | CLUT entry c | video file |
| hhF9 | R | STATUS: bits 0–4 interrupts (active low: line, mouse, MIDI in, frame, MIDI out), bits 5–7 keys K6–K8 of rows selected by A8–A15 | TM l.1049–1066 |
| xxF9 | W | LINE interrupt | video file |
| xxFA / xxFB | R/W | LMPR / HMPR | memory file |
| xxFC | R/W | VMPR (bit 7: W = TXMIDI, R = RXMIDI) | |
| xxFD | R/W | MIDI IN / MIDI OUT | |
| hhFE, hh ≠ FF | R | KEYBOARD: bits 0–4 K1–K5 of rows selected, 5 SPEN, 6 EAR, 7 SOFF | |
| FFFE | R | Row 8 (CNTRL, cursors) AND mouse nibble; bits 5–7 as above | RDMSEL |
| xxFE | W | BORDER: 0–2, 5 colour; 3 MIC; 4 BEEP; 6 THROM; 7 SOFF | |
| xxFF | R | ATTRIBUTES (video) | |
| A8 = 0, xxFF (e.g. 00FF) | W | SAA1099 data | mirror FE00h |
| A8 = 1, xxFF (e.g. 01FF) | W | SAA1099 register select | mirror FE00h |
| xx1F | R | Kempston joystick (add-on) | SimCoupé |
| xx60 | W | Paula alternative port | SimCoupé |
| 7C7F–7F7F | R/W | Blue Alpha Sampler PPI (A8–A9) | |
| FF7F | R/W | Blue Alpha VoiceBox | |
| xx7C–xx7F | W | SAMVox / Paula (overlapping) | |
| xx80 / xx81 | W | LEPR / HEPR external memory | |
| xxBD / xxBF | R/W | SD-IDE data / register | |
| xxD0 | ? | Quazar Surround | unverified |
| rrD4 (r = A8–A12) | W | SID register r | |

---

## Reference documents

Primary:
- SAM Coupé Technical Manual v3.0 — PDF <https://www.worldofsam.org/system/files/2018-05/sam-coupe_tech-man_v3-0.pdf>;
  text <https://sam.speccy.cz/systech/sam-coupe_tech-man_v3-0.txt>. The PDF's Appendix A (Philips
  SAA1099 data sheet and application notes) and Appendix C (keyboard diagrams and map) are not in
  the text version: fetch the PDF.
- Unofficial technical manual v1.0 (contents only partly written) —
  <https://sam.speccy.cz/systech/unofficial_tech-man_v1-0.txt>,
  PDF <https://www.worldofsam.org/sites/default/files/dl-29/unofficial_tech-man_v1-0.pdf>.
- Philips SAA1099 data sheets (two versions, zipped) and docs, Velesoft:
  <http://velesoft.speccy.cz/samcoupe/saa1099/saa-1099_data_sheet.zip>,
  `.../saa-1099_data_sheet2.zip`, `.../saa1099-doc2-en.zip`, `.../saa1099-doc3-en.zip`,
  `.../saa1099-doc5-en.png`, `.../saa-1099_pinouts.txt` (index page <http://velesoft.speccy.cz/saa1099-cz.htm>).
  Also <https://datasheetspdf.com/datasheet/SAA1099.html> (cited by Wikipedia).
- SAM schematic: <https://velesoft.speccy.cz/samcoupe/sam-schematic/samcoupe-orginal-schematic-mid-color.png>;
  keyboard matrix image <http://velesoft.speccy.cz/samcoupe/keyboard/samcoupe_keyboard_table.png>.
- Comms Interface manual <https://www.worldofsam.org/system/files/2018-09/SAM%20Coup%C3%A9%20Comms%20Interface%20Manual.pdf>;
  SAMBUS manual <https://www.worldofsam.org/system/files/2018-05/SAM%20Coup%C3%A9%20SamBus%20Manual.pdf>;
  SPI manual <https://www.worldofsam.org/system/files/2022-03/SAM%20Coup%C3%A9%20SPI%20Interface%20Manual.pdf>.
- TZX format v1.20 <https://worldofspectrum.net/TZXformat.html>.

Emulators (file → what to read):
- SAASound <https://github.com/stripwax/SAASound> (BSD-3): `src/SAADevice.cpp` (wiring, register
  writes), `SAAFreq.cpp`, `SAANoise.cpp`, `SAAEnv.cpp`, `SAAAmp.cpp`, `SAAImpl.cpp`, `defns.h`, `tests/`.
- MAME (BSD-3 file) `src/devices/sound/saa1099.cpp`, `saa1099.h`.
- MAME (GPL-2.0+) `src/mame/samcoupe/samcoupe.cpp`; `src/devices/bus/samcoupe/{mouse,expansion,drive}/`.
- SimCoupé (GPL-2.0) `Base/SAMIO.h`, `SAMIO.cpp` (`IO::In`, `IO::Out`, `out_border`), `Sound.cpp`,
  `Keyboard.h/.cpp`, `Mouse.h/.cpp`, `Tape.cpp`, `Parallel.cpp`, `Clock.cpp`, `SID.cpp`, `SAMVox.cpp`,
  `Paula.cpp`, `BlueAlpha.cpp`, `VoiceBox.cpp`, `Atom.cpp`, `AtomLite.cpp`, `SDIDE.cpp`.
- MiSTer SAM core (GPL-2.0) <https://github.com/MiSTer-devel/SAM-Coupe_MiSTer> `rtl/saa1099.sv`,
  `rtl/mouse.v`, `rtl/keyboard.sv`; MiST <https://github.com/sorgelig/SAMCoupe_MIST>.
- Unreal Speccy SAA: <https://github.com/tslabs/zx-evo/blob/master/pentevo/unreal/Unreal/saa1099.cpp>.

Community:
- World of SAM: SAA1099 <https://www.worldofsam.org/node/236>; accuracy thread
  <https://www.worldofsam.org/node/1082>; sound faults <https://www.worldofsam.org/node/1885>;
  keyboard/joystick <https://www.worldofsam.org/node/365>; Comms Interface <https://worldofsam.org/node/634>;
  Messenger <https://old.worldofsam.org/node/229>.
- Vogons SAA1099 thread (noise LFSR, PDM; 403 to WebFetch): <https://www.vogons.org/viewtopic.php?f=9&t=51695>,
  <https://www.vogons.org/viewtopic.php?p=714720>.
- SimCoupé tape blog <https://simonowen.com/blog/2007/01/11/simcoupe-tape-support>.
- Quazar hardware <https://samcoupe.com/hardware.htm>, Trinity <https://samcoupe.com/hardtrin.htm>.
- Furnace SAA1099 notes <https://tildearrow.org/furnace/doc/latest/7-systems/saa1099.html>.

---

## Open questions

- **OQ1** Envelope register bit layout: World of SAM's page (as fetched) says bit 3 = resolution,
  bit 4 = clock; TM, MAME and SAASound say bits 4 and 5. Read the datasheet's register table.
- **OQ2** Envelope scope and gating: channels 2/5 only (SAASound, MiSTer, Furnace) or all three of a
  group (MAME)? Does an enveloped channel use amplitude bits 3–1 only, and is the envelope gated by
  the inverted tone level as SAASound models? Datasheet plus a real-chip recording.
- **OQ3** Does the SAA's /DTACK stretch Z80 I/O writes on the SAM, or is the ASIC's ≥ F8h I/O wait
  the only delay? Minimum spacing between SAA writes?
- **OQ4** Analogue mix: resistor values (R41, R42, R43, C19), beeper level relative to SAA full
  scale, mono MONX feed, DC offset, filtering. Needs the schematic or a measurement.
- **OQ5** Is MIC (BORDER bit 3) audible on the outputs, and does it read back on EAR (bit 6) through
  the bidirectional jack, like a Spectrum issue 2/3 board? Idle EAR level with nothing connected?
- **OQ6** KEYBOARD bit 7: SOFF echo (SimCoupé), always 1 (MAME) or "external memory status" (TM)?
- **OQ7** Physical keys outside the matrix (72 vs 69), and keyboard-map codes (TM Appendix C).
- **OQ8** Mouse: reset timeout 38 µs (SimCoupé) vs 50 µs (MAME); button bit order; axis signs;
  whether bit 4 carries data; how the ROM detects the mouse; whether the mouse interrupt line was
  ever driven.
- **OQ9** SAM ROM tape timings: check the TZX formulas (pilot 58 + 19W etc.) against the ROM's
  JSAVE timing loops at W = 112 and their units (3.5 MHz vs 6 MHz T-states); pilot lengths for SAM
  headers vs data; what the 47-T JEDGE2 unit implies for speed detection.
- **OQ10** Port EFh: Comms serial (ECh–EFh) vs SAMBUS clock (rxEFh) vs Dallas (FEEFh/FFEFh) — how
  the real hardware avoids the clash; and the TM's "printer addresses 246 and 248".
- **OQ11** Trinity's I/O ports and register model (programming manual not found online); Quazar
  Surround's ports and design (SimCoupé has only a constant D0h).
- **OQ12** SAA power-on state (registers are not reset by RESET; random at power-up?) and the exact
  sequence the ROM uses to clear them; noise LFSR seed on a real chip (SAASound uses all ones; MAME
  unspecified; MiSTer 0).
- **OQ13** Noise LFSR: SAASound/MAME 18-bit x^18 + x^11 + x vs MiSTer's 17-bit form; output tap; rate
  in source 3 while sync is set.
- **OQ14** MIDI timing: TXFMST and the MIDI-OUT interrupt timing relative to the write (SimCoupé's
  32-T alignment), write-while-busy behaviour, and the TM's contradictory STATUS bit 4 description.
