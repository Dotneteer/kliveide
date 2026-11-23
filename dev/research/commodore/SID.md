# SID: MOS 6581 and MOS 8580 (C64, C128)

Research pack file for the Commodore plan. **Facts, not a plan.** Compiled 2026-11-23.

Conventions:

- Every fact carries its source inline. A statement marked *inference* was concluded by the
  author of this file, not read in a source.
- GPL sources (reSID, reSIDfp, VICE, Hoxs64, Denise, TinySID) were read **for facts only**. Their
  comments were paraphrased; no code, and no table in its original layout, was copied. Numeric
  constants that are measurements are quoted as numbers with the file and symbol they come from.
- "reSID" means Dag Lem's reSID 1.0 pre-release as maintained in VICE (mirror
  `github.com/libsidplayfp/resid`, files `wave.h`, `wave.cc`, `envelope.h`, `envelope.cc`,
  `filter.h`, `extfilt.h`, `sid.cc`, `pot.cc`). "reSIDfp" means Leandro Nini's fork as vendored in
  MAME (`github.com/mamedev/mame/tree/master/3rdparty/residfp`, files `WaveformGenerator.cpp`,
  `WaveformCalculator.cpp`, `EnvelopeGenerator.cpp`, `SID.cpp`, `Filter6581.h`, `Filter8580.h`,
  `Integrator6581.h`, `Integrator8580.h`), identical in origin to `github.com/libsidplayfp/libresidfp`.
- "PRG" means the *Commodore 64 Programmer's Reference Guide*, Appendix O (the 6581 data sheet),
  of which a text copy is already in this repository at `dev/research/c64prg.txt` (lines ~21780-22560).
- "SID-Article" means Imre Olajos / Hermit, *SID-Article v0.2*,
  `github.com/ImreOlajos/SID-Article` (licence **CC0-1.0**, verified via the GitHub API).
- "Yannes" means the 1996 e-mail interview of Bob Yannes by Andreas Varga,
  `https://landley.net/history/mirror/commodore/yannes.html`.

---

## §1 Registers, clock and the digital voice

### §1.1 Bus interface and register map

- 29 registers, A0-A4, at `$D400` on the C64; the chip is selected over `$D400-$D7FF`, so it
  mirrors every 32 bytes there (PRG pin description; mirror range from the standard C64 I/O
  decoding, *inference* to be confirmed in the C64 memory-map file of this pack). Registers
  `$00-$18` are write-only, `$19-$1C` are read-only, `$1D-$1F` do not exist (PRG register map).
- Data transfers happen only while phi2 is high; phi2 is also the master clock for oscillators and
  envelopes (PRG, "02 (Pin 6)"). Reset (/RES low for at least 10 phi2 cycles) clears all registers
  and silences the output (PRG, "RES (Pin 5)").
- Per voice *n* (base `7*(n-1)`):
  - `+0/+1` FREQ lo/hi, 16 bits. `Fout = Fn * Fclk / 2^24` (PRG, FREQ LO/HI).
  - `+2/+3` PW lo/hi, 12 bits (high nibble of `+3` unused). Duty = `PWn / 40.95` % (PRG).
    PRG says 0 and 4095 give a constant DC level; see §1.4 for the exact comparator.
  - `+4` CONTROL: bit7 NOISE, bit6 PULSE, bit5 SAW, bit4 TRIANGLE, bit3 TEST, bit2 RING MOD,
    bit1 SYNC, bit0 GATE (PRG register map).
  - `+5` ATTACK (high nibble) / DECAY (low nibble); `+6` SUSTAIN (high) / RELEASE (low).
- Filter and volume: `$15` FC lo (bits 0-2 only), `$16` FC hi (FC bits 3-10): an 11-bit cutoff.
  `$17` RES (bits 4-7), FILTEX (bit 3), FILT3..FILT1 (bits 2..0). `$18` 3OFF (bit 7), HP (6),
  BP (5), LP (4), VOL (bits 0-3) (PRG register map and FILTER section).
- Read-only: `$19` POTX, `$1A` POTY, `$1B` OSC3 (upper 8 bits of voice 3's waveform output),
  `$1C` ENV3 (voice 3's envelope counter) (PRG MISCELLANEOUS).
- Sync and ring-mod sources are cyclic: voice 1 uses voice 3, voice 2 uses voice 1, voice 3 uses
  voice 2 (PRG, VOICE 2 and VOICE 3 sections).
- **Writes on the 8580 take effect one cycle later than on the 6581** (reSID `sid.cc`, comment on
  `write`; VICE testprog `SID/writedelay`, listing in §8.1). reSIDfp models the same pipeline.

### §1.2 Clocks

- PAL C64: 985 248 Hz; NTSC C64: reSID's `sid.cc` (`set_sampling_parameters` comment) uses
  1 022 730 Hz. The SID has no clock of its own; every rate in this file scales with phi2
  (PRG Table 2 note: "multiply the given rate by 1 MHz / phi2").
- The C128 feeds the SID the same ~1 MHz phi2 as the C64 in both 1 MHz and 2 MHz CPU modes
  (*inference*: the VIC-IIe-generated 1 MHz clock drives the I/O chips; how a 2 MHz CPU access to
  the SID is synchronised is OQ6).

### §1.3 Oscillator (phase accumulator)

- Each voice has its own 24-bit accumulator; FREQ is added every phi2 cycle (Yannes; reSID `wave.h`
  header comment). The oscillators are not time-multiplexed: each voice has its own adder, which is
  why there are only three voices (Yannes).
- TEST bit set: accumulator cleared and held at zero until TEST clears (PRG CONTROL/TEST; reSID
  `wave.cc`, `writeCONTROL_REG`).
- **Hard sync:** when the sync-source accumulator's MSB (bit 23) goes 0 -> 1, a voice with SYNC set
  has its accumulator reset to zero (Yannes; reSID `wave.h`, `synchronize`). Special case verified
  by sampling OSC3: if the sync source is itself being synced on the same cycle its MSB rises, the
  destination is *not* synced (reSID `wave.h`, comment in `synchronize`). The oscillators must be
  synced after all three have been clocked, because they run in parallel (same comment).
- Power-up state: reSID sets the accumulator to `0x555555` ("even bits high") and the envelope
  counter to `0xAA` ("odd bits high") (reSID `wave.cc` constructor, `envelope.cc` constructor).
  Reset (/RES) does not change the envelope counter (reSID and reSIDfp `EnvelopeGenerator::reset`).

### §1.4 Basic waveforms (12-bit outputs)

From reSID `wave.h` (waveform output comment block) and Yannes, re-expressed:

- **Sawtooth:** the upper 12 bits of the accumulator, unchanged.
- **Triangle:** the 11 bits below the MSB, inverted when the MSB is 1, shifted left by one; the
  output LSB is 0 (half the resolution of sawtooth at full amplitude). With RING MOD the MSB used
  for the inversion is replaced by a combination of the own MSB and the sync source's MSB, so the
  triangle folds at the other oscillator's rate (PRG RING MOD; reSID `wave.h`; reSIDfp
  `WaveformGenerator`). Ring modulation is only audible through the triangle (PRG).
  reSID phrases the substituted bit as "MSB EOR NOT source MSB" while other descriptions say plain
  XOR; see Disagreement X12.
- **Pulse:** the upper 12 accumulator bits are compared with PW; output is all ones when
  `acc[23:12] >= PW`, else all zeros (reSID `wave.cc`, `writePW_LO/HI` and `set_pulse_output`).
  Hence PW = 0 is constant high and PW = `$FFF` is high only at `acc[23:12] = $FFF` (*inference* from
  the comparator; PRG's "0 or 4095 gives DC" is approximately right). The compare result is
  delayed one cycle (reSID `wave.h`). **TEST holds pulse high** (`$FFF`) regardless of PW
  (reSID `wave.h`; PRG).
- **8580 timing difference:** the triangle/sawtooth output of the 8580 lags the 6581 by half a
  cycle, which shows as one cycle on OSC3 because OSC3 is latched in phi1 (reSID `wave.h`,
  `set_waveform_output`).

### §1.5 Noise (23-bit LFSR)

- A 23-bit shift register clocked when accumulator **bit 19** goes 0 -> 1 (Yannes; reSID `wave.h`).
  The shift is completed two cycles after the bit rises (reSID `wave.h`; reSIDfp
  `WaveformGenerator.cpp` describes the cycle sequence: rise, shift phase 1 where each bit's output
  is latched into the next, shift phase 2 where the latch becomes the new value).
- Feedback: new bit 0 = (bit 22 OR TEST) XOR bit 17 (reSID `wave.h`, `clock_shift_register`; the
  same taps appear in CLK `Components/SID/SID.cpp`, `NoiseGenerator::update`, and floooh `m6581.h`).
- Output: eight register bits drive DAC bits 11..4 - register bits 20, 18, 14, 11, 9, 5, 2, 0 in that
  order - and DAC bits 3..0 are grounded (reSID `wave.h`, noise diagram; CLK `SID.cpp`,
  `NoiseGenerator::output`). Yannes says "upper 12 bits"; see Disagreement X2.
- **TEST and the LFSR:** while TEST is high the register is held in shift phase 1 with its bits
  interconnected; with no driver the bits drift towards 1, so after a long TEST the register reads
  `0x7FFFFF`. When TEST falls, shift phase 2 completes, and because TEST was OR'ed into the
  feedback, bit 0 becomes NOT bit 17 (reSID `wave.cc`, `writeCONTROL_REG` comments). How long the
  drift takes differs between sources and chip models (Disagreement X8).
- **Writes into the noise register from combined waveforms ("noise writeback"):** when NOISE is
  selected together with another waveform, the combined DAC-input lines pull the corresponding
  shift-register bits low. A 0 written this way stays 0 (reSID `wave.h`, `write_shift_register`;
  reSIDfp `WaveformGenerator.cpp` "Normal cycles" / "Shift phase 1" comments; the
  `libsidplayfp/combined-waveforms` README, "Noise writeback"). reSIDfp refines this: in normal
  cycles the outputs pull bits down; during shift phase 1 the floating bits are driven by the
  combined output or drift high. reSID 1.0 additionally applies writeback when switching between
  certain waveform values ("this needs more investigation", `wave.cc`, `writeCONTROL_REG`).
- **Noise lock-up:** repeated writeback fills the register with zeros, after which noise stays
  silent until TEST or /RES (PRG CONTROL note; Yannes). Combined waveforms including noise "output
  zero after a few cycles" (reSID `wave.h`).
- Tests: VICE testprogs `SID/noisewriteback`, `SID/wb_testsuite`, `SID/wf12nsr`,
  `SID/noiselfsrinit`, `SID/noise-reset_*.asm` (§8.1). VICE bug #1885 discusses Dag Lem's faster
  LFSR reset method for these tests and notes that VIC-II badlines disturb the timing on a real C64
  (`https://sourceforge.net/p/vice-emu/bugs/1885`).

### §1.6 Waveform 0 and the floating DAC

- With no waveform selected the waveform-DAC input lines float; they keep the last value and decay
  towards zero over a long time (reSID `wave.h` "No waveform", `wave.cc` constants; reSIDfp
  `WaveformGenerator.cpp`, `waveBitfade`). Durations differ (Disagreement X7).
- The SounDemon digi technique exploits this: reset the accumulator with TEST, run triangle
  briefly to set the floating level, then select waveform 0 to hold it (SID-Article, "Digital
  samples on the SID"). A cycle-exact model of §1.6 is therefore audible in demos.
- On the 6581, when sawtooth is selected, a low output top bit can pull the accumulator MSB low
  (reSID `wave.h`, `set_waveform_output`; `combined-waveforms` README, "Saw"). Testprog
  `SID/osc_topbit`.

### §1.7 Volume, 3OFF, mixing order (digital view)

- Voice output = waveform DAC x envelope DAC (a multiplying DAC per voice), then routed either to
  the filter or directly to the mixer by FILTn; 3OFF disconnects voice 3 only from the direct path
  (PRG MODE/VOL; Yannes). The master volume is a 4-bit multiplying DAC (Yannes).
- 3OFF does not stop voice 3's oscillator or envelope; OSC3/ENV3 keep working (PRG OSC3).

---

## §2 Combined waveforms

### §2.1 What the chip actually does

- The data sheet calls combined waveforms a logical AND (PRG CONTROL note; Yannes). Measurements
  show that it is not: a 0 on one bit line also pulls neighbouring lines low (reSID `wave.h`,
  "Combined waveforms" comment, with a worked example).
- Mechanism, from re-vectorised die photographs (reSID `wave.h`; `combined-waveforms` README):
  - each waveform-select bit is a switch connecting that waveform's lines to the DAC inputs;
  - pulse drives one line that touches all 12 DAC inputs, so selecting pulse interconnects every bit;
  - triangle's lines are the accumulator shifted by one, its LSB grounded; selecting sawtooth
    disables triangle's XOR, so saw+triangle is "saw combined with saw shifted left by one", with
    all bits interconnected;
  - on the 8580 the upper eight selector transistors have double resistance (`combined-waveforms`
    README, "Saw+Triangle");
  - pulse+triangle has a strong pull-down on the LSB (same README).
- The pull-down is analog: strength depends on chip model, temperature, distance between bits and
  input states; repeated OSC3 samples of the same state can differ by one bit, and the output drifts
  slowly while the inputs are held (reSID `wave.h`; `combined-waveforms` README).

### §2.2 How emulators model them

1. **Logical AND** - floooh `chips/m6581.h` (`_m6581_trisaw` etc.), Clock Signal
   (`Components/SID/SID.cpp`, `Voice::output`, with a TODO saying AND "is not right"). Cheap, wrong
   for saw+tri, pulse+saw, pulse+tri and pulse+saw+tri, which many tunes use.
2. **Sampled tables** - reSID ships eight tables (`wave6581_{_ST,P_T,PS_,PST}.dat`,
   `wave8580_*.dat`): 4096 entries each, indexed by the upper 12 accumulator bits, recorded from OSC3
   with FREQ = `$1000` (so 8-bit resolution; the low 4 bits are lost) (reSID `wave.h`). Hoxs64 ships
   its own sampled tables (`hoxs64/sidWave_{PS,PST,PT,ST}.h`, GPL-3.0). Tables are per chip and
   capture one specimen.
3. **Parametric pull-down model** - reSIDfp `WaveformCalculator.cpp` computes each bit as the
   weighted average of its neighbours' states with a distance function (`1/(1+d*i)` or
   `1/(1+d*i^2)`), a pulse-strength term, a top-bit term and a threshold. Parameters were fitted by
   Monte-Carlo search against samples from real machines (6581 R2 and R3, 8580 R5, by Trurl, ltx128
   and reFX-Mike), with Dag Lem's sampling program; the file records the bit-error score for each
   fit and marks noise+pulse as "guessed" (`WaveformCalculator.cpp`, parameter comments). Fitting
   tools: `github.com/libsidplayfp/combined-waveforms` (GPL-2.0).
4. **Algorithmic approximation** - Hermit's jsSID/cSID/cRSID generate combined waveforms by formula
   "reverse engineered from SID-schematic"; the author reports the result is close to the VICE
   samples but needs oversampling at 44 kHz (search summary of jsSID README and Hermit's cSID notes,
   `github.com/og2t/jsSID`; not re-read in source, *treat as secondary*).

### §2.3 6581 versus 8580

- The two chips differ most in filters and in combined waveforms (SID-Article, "Revisions";
  Wikipedia MOS 6581, citation flagged there).
- reSIDfp's fit scores show the 8580 parameters fit noticeably worse than 6581 R2/R3 for pulse+tri
  and pulse+saw (`WaveformCalculator.cpp`, score comments) - the 8580 combined waveforms are louder
  and fuller than the 6581's, which are often near-silent for pulse+tri (*inference* from the scores
  and the README's resistance note; confirm by listening).
- The 6581 sawtooth top-bit pull-down on the accumulator (§1.6) has no 8580 counterpart in reSID.

---

## §3 Envelope generator (ADSR)

### §3.1 Structure

- 8-bit envelope counter, counted up in attack and down in decay/release; feeds the voice's
  multiplying DAC (Yannes; SID-Article "Envelope Generator").
- A **15-bit rate counter** acts as a programmable prescaler. The selected 4-bit A, D or R value
  picks one of 16 comparison values from a small on-chip table, so four rates fit in two bytes
  (Yannes; reSID `envelope.h` header). Hardware implements the counter as an LFSR, comparing
  against pre-computed LFSR states (SID-Article "ADSR delay-bug"; reSIDfp
  `EnvelopeGenerator.cpp`, `adsrtable`, citing kevtris' die analysis at `blog.kevtris.org/?p=13`).
  reSID models it as a binary counter that wraps at `0x8000` - observably identical (*inference*).
- **Periods** (cycles between envelope steps at exponent 1). The data sheet gives attack times
  for a full 0->255 sweep (PRG Table 2: 2, 8, 16, 24, 38, 56, 68, 80, 100, 250, 500, 800 ms,
  1, 3, 5, 8 s; decay/release 3x those). Dividing by 256 steps at 1 MHz gives roughly
  7.8, 31, 62, ... 31 250 cycles. ENV3 measurements with CIA timers show the real period is the
  rounded value **plus one**, because the counter needs one cycle to reset after the match
  (reSID `envelope.cc`, comment above `rate_counter_period`): effective periods
  **9, 32, 63, 95, 149, 220, 267, 313, 392, 977, 1954, 3126, 3907, 11720, 19532, 31251**
  (SID-Article table; consistent with reSID's comparison values plus one).
- **Exponential counter** (decay and release only): a second prescaler whose period depends on the
  current envelope value, giving a piece-wise approximation of an exponential: period 1 above the
  first break point, then 2, 4, 8, 16, 30, and back to 1 at zero. reSID loads the new period when
  the counter passes 93, 54, 26, 14, 6 and 0 (and 255 back to 1) (reSID `envelope.h` header and
  `envelope.cc`). Yannes describes the same idea as halving the clock at set counts. Break points
  as ranges differ slightly in SID-Article (Disagreement X4).
- Attack is linear (exponent ignored) and the first attack step resets the exponential counter
  (reSID `envelope.h`, verified with ENV3; CLK `SID.cpp` does the same with a TODO).
- **Sustain** compares both nibbles of the envelope counter against the 4-bit sustain value, i.e.
  levels `0x00, 0x11, ... 0xFF` (reSID `envelope.cc`, `sustain_level`, verified with ENV3; Yannes:
  comparator on the upper four bits). Decay stops at the sustain level; raising sustain during
  sustain does not make the envelope count up, lowering it does make it continue down (Yannes).
- Release ends at zero and the counter is then frozen ("hold zero") until the next gate-on
  (SID-Article; reSID `envelope.h`).
- Envelope DAC: 8-bit R-2R; on the 6581 the ladder ratio is about 2.2 and the termination is
  missing, the 8580's is about 2.0 and terminated, so 6581 envelope steps are non-linear (reSID
  `envelope.cc` constructor comment). Same imperfection on the 12-bit waveform DAC (reSID `wave.h`,
  DAC diagram).

### §3.2 The "ADSR bug" (delay bug)

- The rate counter is never reset by a gate change, and it only resets on a match. If the new
  phase's comparison value is lower than the counter's current state, the counter runs on until it
  wraps after 2^15 cycles (~32.8 ms at 1 MHz) and then counts the new period; the note starts late
  (reSID `envelope.h`, "Check for ADSR delay bug", verified with ENV3; SID-Article "ADSR delay-bug").
  It happens on any phase change to a faster rate (release -> attack, and sustain -> release too)
  (SID-Article).
- One-cycle pipeline effects (reSID `envelope.h`/`envelope.cc`, reSIDfp `EnvelopeGenerator.cpp`):
  - the decay register is briefly active during the first cycle of the attack phase; attack is
    correctly selected from the second cycle;
  - with an exponent period larger than 1, the decrement is delayed by one cycle, and the
    following attack step comes one cycle early - verified by timing 256 complete envelopes with
    A=D=R=1, S=0 (reSID `envelope.cc`, worked example).
- **TEST does not affect the envelope generator** (reSID `envelope.cc`), so it cannot reset the
  rate counter.

### §3.3 Envelope-counter wrap and release/attack quirks

- 0x00 -> 0xFF: gating on and immediately off at zero can flip the counter to `0xFF`, after which
  it counts down in release (reSID `envelope.h`, verified with ENV3).
- 0xFF -> 0x00: gating off and on again at `0xFF` can flip the counter to `0x00`; it is then frozen
  at zero until the gate goes off and on once more (same source). SID-Article ("Hard-Restart")
  reports the `0xFF` wrap on attack as the basis of the "Bottle" fast restart (Codebase64,
  Shrydar/lft).

### §3.4 What music depends on it

- **Hard restart**: players zero AD/SR and gate off for one or two frames before a note so the
  rate counter sits in the fast region and the release reaches zero, avoiding the delay bug
  (SID-Article "Hard-Restart").
- **"Sexy start"**: other players deliberately provoke the bug so the first frame of a note is
  silent and only the last milliseconds of the second frame sound, giving a percussive attack
  (SID-Article "To Delay-bug Or Not").
- Consequence (*inference*): an envelope model without the 15-bit wrap, the one-cycle pipelines and
  the never-reset rate counter changes the attack timing of most tracker-made music; this is not a
  "nice to have".

---

## §4 The analog part

### §4.1 6581 filter

- Two-integrator-loop (state-variable) biquad; HP, BP and LP outputs are summed by the mode bits,
  so LP+HP is a notch (PRG MODE/VOL; Yannes; reSID `filter.h`).
- The active stages are not real op-amps but self-biased NMOS inverters, linear only for small
  signals around their switching threshold (Yannes; reSID `filter.h`). Cutoff is set by NMOS FETs
  used as voltage-controlled resistors driven by an 11-bit DAC (the 12th bit was dropped as
  inaudible) (Yannes). The FET resistance depended on process, so cutoff varies by production lot
  (Yannes).
- reSID 1.0 / reSIDfp model this at circuit level: VCR currents from an EKV transistor model, the
  integrators solved by a single fix-point step per cycle, op-amp transfer functions measured on
  real chips with the capacitors removed (`daglem/reSID` README; reSIDfp `Integrator6581.h`
  comment). Resistor ratios R2 ~ 2R1, R6 ~ 6R1, R8 ~ 8R1, R24 ~ 24R1; with 470 pF and a measured
  minimum cutoff of ~220 Hz, Rmax ~ 1.5 MOhm (reSID `filter.h`, one particular chip).
- Data sheet: cutoff "linear", 30 Hz-12 kHz with 2200 pF; `FCmax = 2.6E-5 / C`; 12 dB/oct LP/HP,
  6 dB/oct BP; resonance 16 linear steps (PRG FILTER and CAP pin description). The real 6581 is
  strongly non-linear in FC, distorts with high input levels, and has a cutoff curve that varies
  from chip to chip (reSID `filter.h`; Yannes). Emulators therefore expose a per-chip curve or bias:
  reSID `sid.cc`, `adjust_filter_bias` ("DAC bias ... currently only effective for 6581"); SIDKick
  pico ships "19x measured 6581 filter curves" (its README).
- Known residual error: high resonance together with high levels makes the real op-amps misbehave,
  mainly in amplitude (reSID `filter.h`).
- **Revisions:** 6581 (R1/R2/R3/R4/R4AR) and 8580 (R5); the 6582 is an 8580 with another label
  (SID-Article "Revisions"). Common lore ties sound differences to revisions; SID-Article's
  footnote cites Lagerfeldt ("Mythbusting the 6581 revisions", `ultimatesid.dk`) as finding the
  differences come from the filter components rather than the revision (marked TODO there; not
  verified, Disagreement X10). reSIDfp carries separate fits for 6581 R2 and R3 (§2.2) and separate
  floating-DAC timings for R3 and R4 (§1.6).

### §4.2 8580 filter

- Redesigned to be more linear and temperature-stable, with real op-amps and a different resonance
  network (reSIDfp `Filter8580.h`, header comment; schematic analysis credited to ttlworks on
  forum.6502.org). Cutoff is set by a transistor whose gate voltage comes from an op-amp and depends
  on temperature (reSIDfp `Integrator8580.h`).
- Resonance: two small switched resistor networks for input and feedback selected by the four RES
  bits; reSIDfp lists relative resistances (`Filter8580.h`, "Resonance").
- C64 capacitor values: 470 pF (6581) and 22 nF (8580); some boards 330 pF; the data sheet's
  2200 pF was apparently never used in a C64 (`ist.uwaterloo.ca/~schepers/MJK/ascii/siddesc.txt`).
  6581 runs on 12 V, 8580 on 9 V; the two are not interchangeable without modification
  (SID-Article "Revisions").

### §4.3 DC offsets and `$D418` digis

- The waveform DAC's "zero" is not at mid-scale. On a measured 6581R4AR the waveform output value
  that equals silence was `0x380` (ideal would be `0x800`) and one voice spans about 1.5 V riding at
  about 5 V (reSIDfp `SID.cpp`, comment above `OFFSET_6581`). reSIDfp uses `0x9C0` for the 8580
  while stating there is no schematic evidence of an 8580 offset and that it "would make digis too
  loud"; measurements by zero-x on several 8580s found a range of zero levels (same comment).
- **Mechanism of the volume-register digi:** the 6581's voices and filter feed a DC level into the
  master-volume multiplying DAC; changing VOL then moves the output in 16 steps, so writing `$D418`
  at a sample rate plays 4-bit audio. Yannes: stop an oscillator, the volume DAC then holds a DC
  level, and real-time volume writes produce audio. A volume write also produces the well-known
  click on 6581 (*inference* from the same mechanism).
- On the 8580 that DC is (nearly) absent, so `$D418` digis are almost inaudible
  (`c64-wiki.com/wiki/SID`; Wikipedia MOS 6581). The "digi boost" fix is a resistor from EXT IN
  (pin 26) to ground, 330 kOhm (Knopp, `ist.uwaterloo.ca/~schepers/MJK/increase_digitalvolume.html`;
  USBSID-Pico manual) or 470 kOhm / 1 MOhm pot (c64-wiki); a smaller value makes normal music quieter
  (Knopp). Emulators implement digi boost by injecting a constant into EXT IN: reSID `sid.cc`,
  `input()` comment ("can be used to simulate the MOS8580 digi boost hardware hack").
- Better digi techniques (Mahoney's tables of mixed offsets giving 30-50 levels, PWM via TEST,
  SounDemon's floating-DAC method) are summarised in SID-Article ("Digital samples on the SID").
  All need the DC offsets, the filter-mode bits' offsets and §1.6 to be modelled.

### §4.4 EXT IN, output stage and the C64 board filter

- EXT IN: ~100 kOhm input, rides at about 6 V DC, max 3 Vp-p, unity gain on the direct path; the
  volume control affects it too (PRG "EXT IN"). Whether the C64/C128 board leaves EXT IN open,
  grounded or wired to a port pin was not checked here (OQ9).
- AUDIO OUT: open-source buffer, max 2 Vp-p at 6 V DC, needs a 1 kOhm source resistor
  (PRG "AUDIO OUT").
- C64 board output stage: a first-order low-pass at about 16 kHz followed by a first-order
  high-pass at about 16 Hz (assuming a 1 kOhm amplifier input), joined by a transistor stage (reSID
  `extfilt.h`, header comment with the circuit). reSID notes that modelling the transistor exactly
  would need a multi-MHz sample rate and is skipped.
- Mixer: direct-path voices, EXT IN and the selected filter outputs are summed, then the volume DAC
  (SID-Article "Mixing and Output"; reSID `filter.h` mixer diagram; reSIDfp `Filter8580.h` for the
  8580's resistor values).

---

## §5 Read-back registers and bus behaviour

### §5.1 POTX / POTY

- Each POT pin has an external capacitor to ground, charged through the paddle's potentiometer
  from +5 V; R*C = 4.7e-4 with 470 kOhm and 1000 pF recommended (PRG "POTX, POTY (Pins 24, 23)").
- Measurement cycle: the SID discharges the capacitor for 256 phi2 cycles, then releases the pin
  and runs an 8-bit counter for 256 cycles; the counter is latched into the register when the pin
  voltage crosses a threshold. A new value every **512 phi2 cycles** (~2 kHz) (PRG POTX: "updated
  every 512 phi2 cycles"; 1541 Ultimate documentation, `1541u-documentation.readthedocs.io/en/latest/hardware/joyport.html`;
  a 1351 designer's description quoted in the C65GS blog search result). Threshold about 2.25 V
  (1541U doc) or "nominally 2.5 V" (1351 description) - Disagreement X12b.
- If the pin never crosses the threshold (no paddle) the value is `$FF`; very low resistance gives
  0 (1541U doc and C65GS blog summary). The 6581's leakage makes the voltage rise fast over the
  first volt (1541U doc).
- On the C64 a 4066 analog switch selects which control port's POT lines reach the SID, driven by
  keyboard scan lines (CIA1 port A bits 6/7, *inference* from "one of the keyboard scan lines"), so
  the keyboard scan disturbs readings; the POT lines must be connected for more than 1.6 ms before a
  value is valid (Commodore *1351 Mouse Developer's Guide*,
  `retroisle.com/commodore/c64128/OriginalDocs/1351mousev11.php`).
- **1351 mouse, proportional mode:** the mouse puts its position modulo 64 in bits 1-6 of POTX/POTY
  every 512 microseconds (the guide's unit; equal to ~512 cycles), bit 0 is a "noise" bit used to
  detect real movement, bit 7 is don't-care; a still mouse can make POT oscillate between `$7F` and
  `$80`. Left button = fire, right button = joystick UP. Joystick mode is selected by holding the
  right button at power-up (1351 guide, same URL). *Inference:* the mouse watches the SID's
  discharge pulse and drives the line at a time proportional to its position, so an emulator can
  set the latched value directly each 512-cycle period rather than simulate the RC curve.
- reSID does not model POT (`pot.cc` returns `$FF`); reSIDfp takes paddle values from the host
  (`SID.cpp`, reads of `$19/$1A`). VICE testprogs `SID/paddles`, `SID/paddlescope`, plus the
  top-level `mouse/` and `joystick/` folders (§8.1).

### §5.2 OSC3 and ENV3

- OSC3 = upper 8 bits of voice 3's 12-bit waveform output, including combined waveforms, noise and
  ring/sync effects; ENV3 = voice 3's envelope counter. OSC3 runs regardless of gate; ENV3 needs a
  gated voice 3 to move (PRG OSC3/ENV3). Both are used for random numbers, LFOs and chip-model
  detection (SID-Article "Oscillator and Envelope of Channel 3").
- reSID reads the raw 12-bit waveform/envelope value, not the DAC-distorted one (reSID `wave.h`,
  `envelope.h`, "readOSC() uses waveform_output directly").
- ENV3 is sampled in the first clock phase (reSID `envelope.h`), OSC3 latched in phi1 (reSID `wave.h`,
  8580 comment).

### §5.3 Reading write-only registers ("data bus value fades")

- Reading a write-only (or non-existent) register returns the last value written to *any* SID
  register (or last read from a readable one, per reSIDfp), whose bits decay to zero over time.
  reSID: "all bits reach zero within approximately $2000-$4000 cycles", the fade is not orderly, and
  reSID simply holds the value for `0x4000` cycles (`sid.cc`, comment above `read`).
- reSIDfp: hold times taken from VICE and measured with testprog `SID/bitfade/delayfrq0.prg`:
  `0x01D00` cycles for the 6581, `0xA2000` for the 8580; reading a write-only register "makes the
  bus discharge faster", modelled by halving the remaining time (`SID.cpp`, `BUS_TTL_6581/8580` and
  `read`). This difference is one of the documented 6581/8580 software detection methods (CSDb
  topic 29025, cited there).
- Relevance: SID-detection routines in games and players read these; a wrong model mis-detects the
  chip model and picks the wrong tune or filter table (*inference*). Testprogs `SID/busvalue`,
  `SID/bitfade`, `SID/detect`, `SID/sidcheck`.

---

## §6 Accuracy levels and CPU cost

### §6.1 What existing engines offer

- **reSID** sampling methods (`sid.h`, `sid.cc`): *fast* (take the current output at each sample
  time; aliasing), *interpolate* (linear interpolation between cycles), *resample* (band-limited
  sinc FIR with a Kaiser window, ~124 taps, ≥ 96 dB stopband, interpolated from a table) and
  *resample fastmem* (one FIR table per phase, more memory). Delta clocking (`clock(delta_t)`)
  skips cycles between events, but loses the one-cycle pipelines: the reSID comments say the ADSR
  pipeline, the noise-shift pipeline, the pulse delay and noise writeback are "only modeled for
  single cycle clocking" (`envelope.h`, `wave.h`). Resampling requires
  `125 * clock / sample_rate < 16384`, i.e. sample rate ≥ ~8 kHz (`sid.cc`).
- **reSIDfp**: always single-cycle digital emulation; output via decimation or the sinc resampler
  (MAME `mos6581.cpp` header, minimum sample rate constant). Described by its author as "cycle exact
  ... while keeping good performance for realtime use" (`libresidfp` README).
- **floooh m6581.h / Clock Signal**: cycle-stepped digital part with AND combined waveforms and a
  simple linear filter (chips: tedplay-derived digital filter; CLK: a biquad with cutoff
  `30 + 5.8*FC` Hz and an invented resonance mapping, `SID.cpp`, `update_filter` comment). Very cheap.
- **cRSID**: cycle-based with oversampling, algorithmic combined waveforms, 6581 filter
  distortion approximation (Hermit's release notes, secondary).

### §6.2 Cost (realistic numbers)

- No published benchmark of reSID/reSIDfp throughput was found (web search, 2026-11-23). One
  anecdote: VICE's reSID used ~80 % of a Raspberry Pi 3 core (RetroPie forum), versus far less for
  FastSID. Cost must be measured (OQ1).
- *Inference (order of magnitude, to be measured):* the digital part per phi2 cycle is three
  24-bit adds, three table lookups, three envelope compares and a few branches - tens of
  nanoseconds at most natively. The circuit-level 6581 filter (two integrator fix-point steps
  with table lookups per cycle) roughly doubles to quadruples that. The sinc resampler costs per
  *output* sample (~124 MACs at 48 kHz). At 10x real time a C64 needs 10 M SID cycles/s; a
  cycle-exact digital part plus a cheaper analog path is comfortably affordable in WASM; a
  circuit-level 6581 filter at every cycle may take a significant fraction of a core.
- *Inference, architecture-relevant:* the **digital state** (accumulators, LFSR, envelope, bus value,
  POT latch) determines what the CPU reads (OSC3, ENV3, `$19-$1C`, bus fade) and must be exact
  in every mode, including fast-forward and in debugger stepping. The **analog path** (DACs, filter,
  external filter, resampling) only shapes audio and can run at reduced rate, be skipped when audio
  is muted (turbo, headless tests), or be swapped between quality levels without changing machine
  behaviour. Keeping the two separable is what makes ">10x real time" cheap.
- The audio path needs a band-limiting step from ~1 MHz to the host rate; plain decimation of a
  1 MHz pulse/saw stream aliases audibly (reSID's reason for its FIR; CLK uses a biquad low-pass
  before decimation, `SID.cpp` constructor).

---

## §7 Implementations and licences

Licences checked 2026-11-23 via the GitHub API (`gh api repos/<r> --jq .license.spdx_id`) and
file headers. "Port" = could be translated into Klive (MIT) code; "facts" = read for facts only.

| Implementation | Where | Licence (verified how) | Accuracy notes | Use for Klive |
|---|---|---|---|---|
| reSID 0.16 / 1.0 (Dag Lem) | VICE; mirror `libsidplayfp/resid`; `daglem/reSID` (2023, "intended to become the official source") | GPL-2.0-or-later (file headers) | High; sampled combined-waveform tables; circuit-level 6581 filter in 1.0 | Facts only |
| reSIDfp / libresidfp (Lankila, Nini) | `libsidplayfp/libresidfp`, `libsidplayfp/libsidplayfp` | GPL-2.0 (API) / GPL-2.0-or-later (headers) | Highest available in software; parametric combined waveforms; 6581 and 8580 circuit filters | Facts only |
| MAME `mos6581` | `mamedev/mame` `src/devices/sound/mos6581.cpp` + `3rdparty/residfp` | Device wrapper BSD-3-Clause (header, Curt Coder); **engine is reSIDfp, GPL-2.0-or-later** (`3rdparty/residfp/SID.cpp` header) | = reSIDfp | Facts only; not a permissive path |
| VICE FastSID | VICE | GPL-2.0-or-later (VICE) | Low-medium | Facts only |
| Hoxs64 (David Horrocks) | `davidhorrocks/hoxs64` | GPL-3.0 (API) | Own engine with own sampled combined tables (`sidWave_*.h`) | Facts only |
| Denise | `sourceforge.net/projects/deniseemu` (source on Bitbucket) | GPL-3.0 (SourceForge listing) | Cycle-accurate emulator; SID engine not checked | Facts only |
| TinySID (Hinrichs, Sinsch) | Rockbox `lib/rbcodec/codecs/sid.c` (older) | GPL-2.0-or-later (Rockbox header) | Low | Facts only |
| jsSID (Hermit) | `og2t/jsSID` | "WTF licence", author asks to keep credit (README); SourceForge page lists CC-BY (conflict) | Medium; algorithmic combined waveforms | Port possible, licence informal |
| cRSID / cSID (Hermit) | CSDb release 245383; Rockbox port | "WTF - do what you want, but mention me as original author" (C header per search; Rockbox README) | Medium-high; cycle-based, oversampled, 6581 filter distortion | Port possible, licence informal; provenance of its data unverified (OQ3) |
| floooh `chips/m6581.h` | `floooh/chips` | zlib (API and header); based on tedplay (c) 2012 Attila Grosz, Unlicense | Low (AND waveforms, simple filter, 15-bit rate LFSR modelled) | Port allowed |
| Clock Signal `Components/SID` (Tom Harte) | `TomHarte/CLK` (created 2025-11-07) | MIT (API, `LICENCE`) | Low: AND combined waveforms, biquad filter, no 6581/8580 split, POT from host | Port allowed; little to gain |
| perfect6581 (Nini) | `libsidplayfp/perfect6581` | MIT (API) | Transistor-level, **digital parts only**, far too slow for real time | Oracle for digital behaviour (OQ4) |
| SID schematics (Nini, Mueller) | `libsidplayfp/SID_schematics` | No licence file (API: none) | Transistor-level schematics | Facts only |
| combined-waveforms tools/data | `libsidplayfp/combined-waveforms` | GPL-2.0 (API) | Samples by Trurl, ltx128, reFX-Mike | Facts; data use is OQ5 |
| reDIP SID (Dag Lem) | `daglem/reDIP-SID` | CERN-OHL-S v2 (LICENSE) - strongly reciprocal | FPGA, refined reSID; `research/` holds the combined-waveform sampling program | Facts only |
| icesid | `bit-hack/icesid` | CERN-OHL-S v2 (LICENCE) | FPGA; contains a reDIP-SID folder | Facts only |
| MiSTer C64 SID (Alexey Melnikov) | `MiSTer-devel/C64_MiSTer` `rtl/sid/` | CERN-OHL-S v2 (file header: filter "based on filter from reDIP-SID") | FPGA | Facts only |
| C64-SID-on-a-FPGA (CornN64) | `CornN64/C64-SID-on-a-FPGA` | MIT (API) - but "based on source from" the Papilio C64SID playground, upstream licence unverified | Low-medium, digital filter | Doubtful provenance |
| SIDKick / SIDKick pico (frntc) | `frntc/SIDKick-pico` | NOASSERTION; README: CC BY-NC-ND 4.0 for hardware; firmware embeds extended reSID 0.16 (GPL) | High (reSID) | Facts only |
| SwinSID | `dmantione/swinsid` (reconstructed source of a closed firmware) | None | Medium; not fully compatible | Not usable |
| ARMSID, FPGASID, SwinSID Ultimate | commercial | Closed | - | Docs only |
| WebSid (Jürgen Wothke) | `bitbucket.org/wothke/websid` (GitHub mirror says "moved") | Not verified | Medium-high; digi-technique detection (used by SIDKick) | Unknown (OQ3) |

"Mikkel Holm" FPGA SID: no project under that name was found (search 2026-11-23).

**Conclusion of §7:** no high-accuracy SID model under an unambiguous permissive licence was found.
Every engine that models the delay bug, noise writeback and measured combined waveforms *and*
a circuit-level filter is GPL or CERN-OHL-S. The permissive options are low-accuracy (chips,
CLK), informal-licence (Hermit's WTF code), or a transistor-level digital oracle (perfect6581, MIT).
The facts needed for a clean-room high-accuracy model are, however, well documented in comments,
the CC0 SID-Article, the data sheet and Yannes' interview (§1-§5).

---

## §8 Test material

### §8.1 VICE testprogs (SID)

- Mirror `github.com/libsidplayfp/VICE-testprogs` (no repository licence; per-program authors;
  canonical repo on SourceForge in VICE's SVN). `SID/` contains: `bitfade`, `busvalue`,
  `csid-light-tests`, `detect`, `detectmirrors`, `env_test`, `envelope`, `exp_counter_reset`,
  `mapping`, `noise-reset_new.asm`, `noise-reset_old.asm`, `noiselfsrinit`, `noisewriteback`,
  `osc3-wave0`, `osc_topbit`, `oscinit`, `paddles`, `paddlescope`, `resid-test`, `ringmod`,
  `sidcheck`, `stereo`, `testwave00`, `waveforms`, `wb_testsuite`, `wf12nsr`, `writedelay`,
  `zerolevel` (GitHub API listing). Its `readme.txt` lists ringmod, sync, pulse width, envelope
  and detailed LFSR tests as TODO. Also `mouse/`, `joystick/`, `Plus4/`, `c128/` folders.
- Most of these read OSC3/ENV3/bus values and print pass/fail on screen; they test the digital
  state, which is what a deterministic core can assert (*inference*). Some ("zerolevel", "bitfade")
  only make sense against chip-specific measured values.
- Licence: none declared for the collection; treat as run-only, not to be committed (OQ7).

### §8.2 Real-chip samplings

- reSID's combined-waveform tables (Dag Lem, OSC3 samples, 8 bit) - part of reSID, GPL.
- Samplings for reSIDfp's fits: 6581 R2 (ltx128, Trurl), 6581 R3 (Trurl), 8580 R5 (reFX-Mike);
  tools by Antti Lankila and Leandro Nini; sampling program by Dag Lem in reDIP-SID `research/`
  (`combined-waveforms` README; reSIDfp `WaveformCalculator.cpp`). Distributed in GPL / CERN-OHL-S
  repositories; whether raw measurements can be reused is OQ5.
- Envelope timings: method in reSID `envelope.cc` (CIA timers counting from ENV3 = 1 to 129).
- Bus fade: `SID/bitfade/delayfrq0.prg` results quoted in reSIDfp `SID.cpp`.
- Filter curves: no public permissively licensed set found; SIDKick pico has 19 measured 6581
  curves in its firmware (licence as above).
- *Inference:* owning a few real C64s (6581 R3/R4, 8580 R5) and running Klive's own sampling
  programs would give Klive its own data, free of licence questions.

### §8.3 HVSC

- High Voltage SID Collection, `hvsc.c64.org`. Its `DOCUMENTS/HVSC.txt` describes it as a freeware
  collection, states that some copyrights are administered by High Technology Publishing Ltd and
  appear with explicit permission, and that all other rights are reserved
  (`hafnium.prg.dtu.dk/HVSC/C64Music/DOCUMENTS/HVSC.txt`, via search summary). No redistribution
  licence. Use for **manual listening tests only**; never commit tunes (OQ7).
- Known stress tunes (*secondary*): register dumps with heavy use of undocumented effects such as
  "Mr. Marvelous" are cited as exposing differences between engines (`jhohertz/jsSID` README).

### §8.4 No Tom Harte-style vectors

There is no published, per-cycle SID state test vector set comparable to Tom Harte's CPU tests
(search 2026-11-23). The nearest equivalents are the VICE testprogs (§8.1), perfect6581 as an
executable reference for digital state (§7), and comparing ENV3/OSC3 traces against reSIDfp run
as an external oracle (allowed for facts; OQ4).

---

## §9 Machines

- **C64:** one SID at `$D400`. Model by board (*secondary*, c64os hardware table and Wikipedia):
  original "breadbin" C64 and SX-64 use the 6581; C64C / C64-II (from ~1986) use the 8580; some
  early C64C boards still carried a 6581 (*inference*, to be checked in the C64-models file).
- **C128:** the same SID, also at `$D400`. Original C128 with 6581 or 8580, C128D with 6581,
  C128DCR with 8580 (c64os hardware table, via search). The C128's I/O map puts the MMU at
  `$D500` and the VDC at `$D600`, so SID mirrors are confined to `$D400-$D4FF` (*inference* from the
  C128 memory map; OQ6). 2 MHz mode and SID access: an FPGA developer reports that at 2 MHz SID and
  CIA accesses must be slowed to 1 MHz (`eriks5/C128_MiSTer` discussion, secondary) - OQ6.
- **C16 / Plus/4:** no SID; sound comes from the TED. The "SID card" add-on (Solder's design;
  modern open re-implementation ReSeed, `github.com/SukkoPera/ReSeed`) puts a SID at `$FD40`
  (also `$FE80`) on the expansion port; early cards used a 6581, final ones an 8580
  (`plus4world.powweb.com/hardware/Scalas_SIDcard`). Its clock and read support are reported
  inconsistently (Disagreement X15, OQ8). Pitch and envelope rates scale with whatever clock it
  receives (§1.2).
- **VIC-20:** no SID (VIC chip sound).
- **Multiple SIDs:** stereo/2SID/3SID expansions and PSID v3/v4 tunes place extra SIDs at other
  addresses (`$D420`, `$D500`, `$DE00`...); testprog `SID/stereo` exists. Not researched further
  here (OQ10).

---

## §10 Disagreements between sources

- **X1 Combined waveforms.** PRG and Yannes: a logical AND. reSID, reSIDfp, combined-waveforms
  README: AND plus analog pull-down of neighbouring bits (pulse interconnects all bits). The
  measurements win; AND is a first approximation.
- **X2 Noise output bits.** Yannes: the upper 12 LFSR bits feed the DAC. reSID `wave.h` and CLK:
  eight scattered register bits feed DAC bits 11..4, DAC bits 3..0 grounded.
- **X3 Rate periods.** reSID's table holds 8, 31, 62, ... (comparison values); SID-Article lists 9,
  32, 63, ... (periods). Consistent: reSID's own comment says the actual period is value + 1.
- **X4 Exponential break points.** reSID: period changes at 93, 54, 26, 14, 6, 0. SID-Article:
  ranges 255..95 (x1), 93..55 (x2), 54..27 (x4), 26..15 (x8), 14..7 (x16), 6..1 (x30), 0 (x1) - it
  leaves 94 unassigned and starts x4 at 54, so its boundaries look off by one against reSID. reSID
  also notes the period at a given value can differ depending on direction (`envelope.cc`).
- **X5 Rate-counter kind.** reSID `envelope.cc` calls it a "16 bit register"; reSID `envelope.h`
  and SID-Article call it 15-bit; reSIDfp/kevtris: a 15-bit LFSR. All wrap after 32 768 cycles.
- **X6 Bus-value fade.** reSID: bits gone in ~`$2000-$4000` cycles, modelled as a `0x4000` hold for
  both chips. reSIDfp: `0x1D00` (6581) and `0xA2000` (8580), halved on each read of a write-only
  register. Testprog measurements on 8580R5 boards gave ~`7A000` and ~`108000` (reSIDfp comment).
- **X7 Floating DAC (waveform 0) hold.** reSID: ~182 000 cycles (6581), ~4 400 000 (8580); "kept for
  at least `0x14000` cycles". reSIDfp: 54 000 (6581R3), 1 000 000 (6581R4), 800 000 (8580R5),
  followed by a bit-by-bit fade (1 400 / 50 000 cycles per bit). reSIDfp notes the times "vary
  wildly with temperature".
- **X8 LFSR fill time under TEST.** reSID: 35 000 cycles (6581), 2 519 864 (8580), comment says the
  bits reach one "within approximately `$8000` cycles". reSIDfp: per-revision values of the order of
  0.2 s (6581R3) and 2-3 s (6581R4, 8580R5), plus a per-bit fade.
- **X9 Filter capacitors.** PRG: 2200 pF recommended. C64 boards: 470 pF (6581), 22 nF (8580),
  some 330 pF (MJK siddesc).
- **X10 6581 revisions.** Lore and reSIDfp's per-revision data treat R2/R3/R4 as sounding
  different; SID-Article's footnote (citing Lagerfeldt) says the filter components, not the
  revision, cause it. Unresolved.
- **X11 POT period unit.** PRG and the 1351 designer: 512 phi2 cycles. 1351 Developer's Guide:
  512 microseconds. Same at ~1 MHz; on a Plus/4 SID card or NTSC/PAL they differ slightly.
- **X12 Ring-mod polarity.** reSID: substituted MSB = own MSB XOR NOT source MSB (under its
  inverted-triangle convention); CLK and other descriptions: own MSB XOR source MSB. *Inference:*
  the two differ by an inversion of the triangle, inaudible in isolation but visible on OSC3; check
  with testprog `SID/ringmod`.
- **X12b POT threshold.** ~2.25 V (1541 Ultimate doc) vs nominally 2.5 V (1351 designer).
- **X13 8580 DC offset.** reSIDfp uses an 8580 offset constant yet says no schematic evidence exists
  and it would make digis too loud; zero-x's measurements found a range of 8580 zero levels.
- **X14 Digi-boost resistor.** 330 kOhm (Knopp, USBSID-Pico) vs 470 kOhm or 1 MOhm pot (c64-wiki).
- **X15 Plus/4 SID card clock and reads.** One post: runs at half the system clock and does not
  support reads; another: only early prototypes needed a single-clock switch; Plus/4 World: runs on
  the Plus/4's ~885 kHz clock so C64 tunes play about a semitone low. Unresolved.
- **X16 jsSID licence.** README: WTF licence; SourceForge project page: Creative Commons Attribution.

---

## Open questions

- **OQ1** Measured cost: how many SID cycles per second does a cycle-exact digital model plus (a)
  a linear filter, (b) a circuit-level 6581 filter, compiled to WASM, achieve on the target
  desktops? Needed to decide the default quality and the fast-forward behaviour.
- **OQ2** Which 6581 filter curve / bias and which combined-waveform data become Klive's default,
  given no permissive data exists (§7, §8.2)? Own measurements, parameters fitted by Klive, or a
  simpler model?
- **OQ3** Is Hermit's cRSID/jsSID free of reSID-derived tables or code (it reports matching the VICE
  samples)? Is an informal "WTF" licence acceptable to the project author for porting? Same
  question for WebSid, whose licence was not found.
- **OQ4** Is running reSIDfp or perfect6581 as an external behavioural oracle (results only, never
  in CI; as plan D12 does for Boriel/Klive BASIC) acceptable for SID? perfect6581 is MIT, so it
  could even be vendored as a test tool.
- **OQ5** Can raw real-chip measurements published inside GPL / CERN-OHL-S repositories (OSC3 samples,
  fitted parameters, bus-fade times) be used as facts, or must Klive re-measure? Numeric constants
  in this file are cited as measured facts; the project author should confirm the stance.
- **OQ6** C128: exact SID mirror range, and how the 8502 in 2 MHz mode accesses the 1 MHz SID
  (stretch, slowdown, or "do not"). To be answered by the C128 file of this pack.
- **OQ7** VICE testprogs and HVSC have no redistribution licence: confirm they stay fetched/local
  (like the SD cards and Boriel kits) and are never committed.
- **OQ8** Plus/4 SID card: clock source and frequency, read support, address decoding.
- **OQ9** What is connected to EXT IN on the C64 and C128 boards (expansion/user port pin, open,
  grounded)? It decides the default "zero" input and how digi boost is offered.
- **OQ10** Whether Klive supports second/third SIDs (address options, PSID v3/v4 playback).
- **OQ11** Whether the analog path should be skippable (muted turbo, headless tests) while the
  digital state stays exact (§6.2), and how the audio mixer resamples (FIR in core vs in the
  mixer).
- **OQ12** Default chip model per C64/C128 model and revision, and whether the user can override it
  (most emulators offer 6581/8580 switches); depends on the machine-models file.

---

## Reference documents

Primary / near-primary:

1. MOS 6581 SID data sheet as Appendix O of the *Commodore 64 Programmer's Reference Guide*
   (local copy: `dev/research/c64prg.txt`). Original PDF: `https://www.cpcwiki.eu/imgs/9/9d/Mos_6581_sid.pdf`
   (HTTP 403 to automated fetch on 2026-11-23).
2. 6581/8580 pin description: `https://ist.uwaterloo.ca/~schepers/MJK/ascii/siddesc.txt`.
3. Bob Yannes interview (Andreas Varga, 1996): `https://landley.net/history/mirror/commodore/yannes.html`.
4. SID-Article v0.2 (Hermit / Imre Olajos), CC0: `https://github.com/ImreOlajos/SID-Article`.
5. reSID (Dag Lem): `https://github.com/daglem/reSID` (README: history, die shots, op-amp
   measurements) and the VICE copy `https://github.com/libsidplayfp/resid`.
6. reSIDfp / libresidfp: `https://github.com/libsidplayfp/libresidfp`; MAME copy
   `https://github.com/mamedev/mame/tree/master/3rdparty/residfp`.
7. SID internals wiki (Leandro Nini, Dieter Mueller): `https://sourceforge.net/p/sidplay-residfp/wiki/SID%20internals/`;
   forum thread "Understanding the SID": `http://forum.6502.org/viewtopic.php?f=8&t=4150`.
8. SID schematics: `https://github.com/libsidplayfp/SID_schematics`; perfect6581:
   `https://github.com/libsidplayfp/perfect6581` (MIT).
9. Combined-waveform tools and notes: `https://github.com/libsidplayfp/combined-waveforms`.
10. reDIP SID (research folder, sampling program): `https://github.com/daglem/reDIP-SID`.
11. kevtris, SID die notes (rate-counter LFSR): `http://blog.kevtris.org/?p=13` (certificate error
    on 2026-11-23; cited via reSIDfp `EnvelopeGenerator.cpp`).
12. Commodore 1351 Mouse Developer's Guide: `https://www.retroisle.com/commodore/c64128/OriginalDocs/1351mousev11.php`.
13. 1541 Ultimate joystick-port / POT documentation:
    `https://1541u-documentation.readthedocs.io/en/latest/hardware/joyport.html`.

Implementations (licence column in §7):

14. floooh chips `m6581.h`: `https://github.com/floooh/chips/blob/master/chips/m6581.h`.
15. Clock Signal SID: `https://github.com/TomHarte/CLK/tree/master/Components/SID`.
16. MAME `src/devices/sound/mos6581.cpp`.
17. Hoxs64: `https://github.com/davidhorrocks/hoxs64`.
18. Denise: `https://sourceforge.net/projects/deniseemu/`.
19. jsSID: `https://github.com/og2t/jsSID`; cRSID: `https://csdb.dk/release/?id=245383`.
20. MiSTer C64 SID: `https://github.com/MiSTer-devel/C64_MiSTer/tree/master/rtl/sid`;
    icesid `https://github.com/bit-hack/icesid`; CornN64 `https://github.com/CornN64/C64-SID-on-a-FPGA`;
    SIDKick pico `https://github.com/frntc/SIDKick-pico`; SwinSID `https://github.com/dmantione/swinsid`.

Tests and music:

21. VICE testprogs mirror: `https://github.com/libsidplayfp/VICE-testprogs` (`SID/`).
22. VICE bugs on SID behaviour: #1885 (LFSR reset in tests), #290 and #1128 (floating DAC fade),
    #1036 (8580 zero level), patch #99 (bus fade): `https://sourceforge.net/p/vice-emu/bugs/`.
23. HVSC: `https://hvsc.c64.org/` and `DOCUMENTS/HVSC.txt`.

Secondary:

24. C64-Wiki SID: `https://c64-wiki.com/wiki/SID`; Wikipedia MOS 6581.
25. Digi boost: `https://ist.uwaterloo.ca/~schepers/MJK/increase_digitalvolume.html`.
26. Plus/4 SID card: `https://plus4world.powweb.com/hardware/Scalas_SIDcard`; ReSeed
    `https://github.com/SukkoPera/ReSeed`.
27. c64os hardware table: `https://c64os.com/post/commodorehardwareinformation`.
