# ZX Spectrum Next: How the Sound Is Made — article series plan

A series of *Under the hood* articles that explain, in the style of the finished screen series
(`docs/content/en/under-the-hood/emulator-internals/next-display/`, plan
`.plans/NEXT_SCREEN_ARTICLES_PLAN.md`), how the ZX Spectrum Next produces its sound: every audio
device, how each one makes its signal, how they are mixed into one stereo stream, and how that stream
leaves the machine.

**Read `.ai/hardware-articles-guide.md` before writing any article of this series.** It holds the
structure, the explaining and figure rules, and the corrections the project author made while
reviewing the screen series; this plan does not repeat them, it only adds what is specific to sound.
Fold any new lesson from this series' reviews into that file.

Status: **the background page (§3) is written; the eight series articles are planned.** Open questions
are in §13.

---

## 0. Ground rules

### 0.1 What this series is, and what it is not

Everything in §0.1 of the screen plan holds here unchanged; in short:

- **The hardware's view**: how the FPGA makes each sound and why it is built that way. The book
  chapters `16-beeper.mdx`, `17-ay.mdx`, `18-dac.mdx` are the programmer's view and are placeholders;
  the book is not linked (decision D6), so articles link the Guides where an IDE view exists, or say
  nothing.
- **The VHDL is where every fact is checked**: `_input/next-fpga/src/audio/` (`ym2149.vhd`,
  `turbosound.vhd`, `soundrive.vhd`, `audio_mixer.vhd`, `dac.vhd`, `pwm.vhd`, `i2s.vhd` and `i2s/`),
  the audio section of `src/zxnext.vhd` (~6320–6490, port decoding ~2385–2734, NextReg writes
  ~5140–5170 and ~5540, reads ~5846–5961 and ~6138), the output stage in
  `src/zxnext_top_issue2.vhd` / `_issue4.vhd` (~1390–1490 the jack and speaker DACs, ~1660–1690 HDMI
  audio, ~620–680 the tape input conditioning), `nextreg.txt` and `ports.txt` (~215–250, the AY
  section).
- **The articles never name the VHDL or its files, signals, comments or line numbers** — anywhere,
  including figures, alt texts and "Where to read the code". Klive's own C files are named in "How
  Klive does it" only.
- **Builds on what exists, does not repeat it**: the background page `computer-sound.mdx` (§3, written
  first: samples, DACs, filters, one-bit sound), `crt-display.mdx` and `spectrum-display.mdx` (port
  `$FE`, contention, the floating bus), `next-core.mdx`, and the screen series (`next-display/timing`
  for the clocks and the frame, `next-display/raster-effects` for the line interrupt and the Copper).

### 0.2 Style

As the screen series (guide: Structure, Explaining, Wording rules). Additions for sound:

- **Name the unit every time a level appears.** The mixer adds numbers of different origins (a beeper
  level of 512, the three AYs up to 2295 per side, a DAC step of 4); a number without its unit
  and its full scale means nothing to the reader. Give full scales (`0–8191`) next to levels.
- **Frequencies and periods are both given**, with the arithmetic shown once per article
  (1.75 MHz ÷ 16 ÷ tone period = frequency).
- **Keep the three time bases apart** (the guide's "space and time" rule, applied to sound): the
  28 MHz master clock, the 1.75 MHz PSG clock, and the output sample rate (48 kHz for HDMI, the host's
  rate in Klive). Never put two of them in one sentence as if one explained the other.
- Registers: "the Peripheral 3 Setting register, NextReg `$08`" on first mention in a Part, then
  "NextReg `$08`"; ports "port `$FFFD`". Official names from `nextreg.txt`.

### 0.3 Figures

8–12 figures per article; the conventions of the screen series apply (inline SVG, 700-wide viewBox,
`currentColor`, the fixed highlight set, `aria-label` describing the whole figure).

**One colour per source across the whole series:**

| Source | Colour |
|---|---|
| Beeper, EAR, MIC, tape | blue `#3b82f6` |
| AY/YM PSGs (TurboSound) | orange `#e8912d` (chips 0/1/2 told apart by solid / dashed / dotted lines, channels A/B/C by label) |
| 8-bit DACs (Soundrive, Covox, Specdrum) | green `#30a46c` |
| Raspberry Pi I2S audio | purple `#a855f7` |
| Mixer sums, clipping, "this is what you hear" marks | red `#e5484d` |
| Clocks, counters, neutral structure | grey (`currentColor`) |

Figure kinds that recur in this series:

- **Waveforms drawn to scale** (time across, level up), with the time and level axes labelled in
  units. These are the "machine pictures" of this series: **generated from samples the emulated
  machine produced** (see §0.4), never drawn by hand.
- **Signal-flow diagrams** (source → register → counter → table → mixer → output).
- **Bit-field strips** for registers and port addresses.
- **Level bars** drawn to scale on the mixer's 0–8191 range (how much of the range each source can
  take).
- **Counter/timeline strips** (a counter's value over clock ticks, the edge that toggles the output).
- **Spectra** only where the frequency content is the point (aliasing in Part "From the machine to your
  speakers"); computed from the captured samples, labelled in Hz.

### 0.4 Machine "pictures" are sounds: waveforms and listening examples

- The harness already captures the mixed audio (`test/harness/zxnext/README.md`: `createSession({
  audioSampleRate })`, `startAudio()`, `audio()`). Each article's waveforms come from **a checked
  scene test**, `test/zxnext-hw/audio/next-audio-scene.test.ts`, which drives the device through ports
  and NextRegs as a program would, **asserts the facts the article states** (a period in samples, a
  level, a channel landing on the left), and only then, with `NEXT_AUDIO_SHOTS=docs/public/images`,
  writes the figure data. Same pattern as `next-display-scene.test.ts`.
- **Waveform figures are SVG generated from the captured samples** by a small generator (scratchpad
  or `scripts/`), so they stay to scale and theme in both colour schemes. Edit the generator, not the
  generated MDX.
- **Listening examples** (open question Q3): short WAV/Opus clips written by the same test, played
  with an `<audio controls>` element next to the waveform. A reader who *hears* the 16 envelope shapes
  or ABC vs ACB understands them at once. Clips are short (≤ 3 s) and listened to before publishing.
- **The harness captures Klive's mixer output**, which differs from the hardware's mixer (§0.6): a
  waveform that shows a hardware fact (the unipolar sum, the DAC's `$80` rest level) is drawn from the
  device's own output (a session method reading a device's level, added per the harness README, "Adding
  a method"), not from the DC-filtered mix. The caption says which one is shown.

### 0.5 Placement and mechanics

- Pages under `docs/content/en/under-the-hood/emulator-internals/next-audio/` with their own
  `_meta.ts`, linked from the parent `_meta.ts` as "ZX Spectrum Next: how the sound is made", next to
  "ZX Spectrum Next: how the screen is drawn".
- New pages: no `docs/redirects.json` entries; update `.plans/docs-routes.golden.txt` and
  `.plans/docs-assets.golden.txt` with each page.
- Absolute links; `under-the-hood/` is not translated.
- `<audio>` clips (if Q3 is yes) go to `docs/public/audio/en/under-the-hood/next-audio/` and must be
  allowed by `doc:check`'s asset audit; add the extension to the asset golden and check the link audit
  resolves them.
- Each article: `npm run doc:build && npm run doc:check`, then every figure in the browser in both
  colour schemes, then every clip played.
- One article per change; core fixes found while writing are their own commit with a `fix`
  changeset, before the article's commit (`internal` changeset).

### 0.6 Known differences between Klive and the hardware (to settle per article)

Found while surveying for this plan; each article decides "fix the core" or "state the difference":

- **The mixer.** The hardware adds *unsigned* levels (EAR 512, MIC 128, each AY side 0–2295, each DAC
  side 0–2040, I2S 0–1023) into a 13-bit sum of at most 5998 of 8191, and the output stage removes the
  DC. Klive DC-filters the beeper, centres the DACs on `$80`, keeps the AY unipolar and scales by a
  fixed gain to 16 bits (`zxnext-audio-mixer.c`). Same proportions, different zero; the article on the
  mixer explains both.
- **Raspberry Pi I2S audio: the Next's receiving half is emulated, the Pi is not**
  (`.plans/PI_I2S_AUDIO_PLAN.md`, commit `70fc95d97`). A *sample source* (a WAV file or a tone, the
  IDE's `pi-audio` command) stands in for the Pi and is fed into the core frame by frame;
  `zxnext-pi-i2s.c` latches the words at the hardware's moments, turns them into 10-bit offset binary,
  and feeds NextReg `$A2`'s selection and muting, the NextReg `$2C`–`$2E` reads with the `$2D` latch,
  the mixer, and the EAR hysteresis into port `$FE` bit 6 and the beeper's MIC line. **Not emulated**,
  and stated in article 6: the Pi itself (NextPi's software, its UART commands), the Next → Pi direction
  (the Next's own mix sent to the Pi), and the deliberate simplifications of that plan's §2.1 (no garbage
  first word after enabling, latch timing within about one SCK period). Klive's mixer adds the Pi's word
  as `v − 512` per side (centred, like the DACs).
- **Audio chip mode `10` ("ZXN-8950")**: the register list names it, but only bit 0 of the mode reaches
  the PSGs, so `10` behaves as YM. Verify Klive does the same, and that the article states it without
  promising a chip that does not exist.
- **The output stages** (delta-sigma DACs and their RC filters, the internal speaker's mono mix with its
  offset, HDMI audio at 48 kHz) are not emulated; Klive hands its own sample stream to the host. Stated
  the way the screen series stated "Klive emulates none of the output stage".
- **The tape input conditioning** (the debounce that rejects pulses under ~1.14 µs, the stuck-at-one
  relaxation after ~1000 µs): check whether Klive's tape path models either.
- **Side finding**: the book placeholder `17-ay.mdx` says the AY chip is selected through NextReg `$06`
  and the stereo mode is NextReg `$08` bits 4–3. Both are wrong (selection is a port `$FFFD` write with
  bit 7 set; stereo is NextReg `$08` bit 5 and NextReg `$09` bits 7–5). Correct the placeholder in the
  change that writes article 4, since the book is not linked from the articles.

---

## 1. The series at a glance

| # | Slug | Title | Core question it answers |
|---|---|---|---|
| 1 | `overview` | The big picture | What makes sound on the Next, and how do six sources become one stereo signal? |
| 2 | `beeper` | The beeper, EAR and MIC | How does one bit make music, and how does the tape share it? |
| 3 | `psg` | One AY chip | How do counters, a noise register and an envelope make three voices? |
| 4 | `turbosound` | TurboSound Next | How are three AY chips addressed through two ports, panned and mixed? |
| 5 | `dacs` | The 8-bit DACs | How do four DAC channels emulate six peripherals, and how are samples fed to them? |
| 6 | `pi-audio` | Audio from the Raspberry Pi | How does an I2S link carry sound both ways, and into the tape input? |
| 7 | `mixer` | The mixer and the outputs | How are the sources summed, and how does the sum reach the jack, the speaker and HDMI? |
| 8 | `klive-audio` | From the machine to your speakers | How does an emulator turn a 28 MHz machine into 48,000 samples a second? |

Reading order is the table order. 1 is a prerequisite for all; 2–6 can be read in any order after 1;
7 needs 2–6 (it adds up their levels); 8 needs 7. Readers new to digital sound read the background page
"How a computer makes sound" (§3) first; it sits outside the series, beside `crt-display.mdx`.

Writing order: the background page → 1 → 7 (the mixer early, so the device articles can point at a
finished description of where their output goes and its units) → 2 → 3 → 4 → 5 → 6 → 8.

---

## 2. Article 1 — The big picture

**Hook:** A 48K Spectrum had one bit of sound and a two-inch speaker. Play a modern Next game and
you hear nine-voice chip music in stereo, sampled drums and speech on top — and the same machine still
loads a tape by listening to it. Where does each of those sounds come from?

**Why it matters (first paragraph after the hook):** what sound does in a program — music, effects,
speech, and on a Spectrum, loading and saving — and why a computer with several independent sound
sources frees the CPU.

**Audience (the paragraph after that):** as the screen overview does with the CRT article, it says
what to read first and links it: [How a Computer Makes Sound](/en/under-the-hood/emulator-internals/computer-sound/)
explains samples, the DAC, the filter that makes the result analogue, and one-bit sound, and this series
does not explain them again; [ZX Spectrum: How the Screen Is Drawn](/en/under-the-hood/emulator-internals/spectrum-display/)
for port `$FE`, and [The ZX Spectrum Next Core and the FPGA](/en/under-the-hood/emulator-internals/next-core/).
Until the background page exists, the overview names it in plain text and gets the link when it is
published.

Topics:
- **From one bit to six sources.** The 48K: port `$FE` bit 4 drives a speaker. The 128K added the AY.
  The Next keeps both and adds two more AYs, four 8-bit DACs and an audio link to its Raspberry Pi.
- **The cast**, one paragraph and one waveform thumbnail each, pointing to its article: the beeper (EAR),
  the MIC bit and the tape input, the three PSGs (TurboSound Next), the four DACs, Pi I2S audio.
- **Two kinds of source**: *generators* that make a waveform from a few settings by themselves (the
  PSGs) and *level writers* where the CPU (or DMA) sets the output level every sample (beeper, DACs).
  This framing carries the series: it decides how much CPU time a sound costs.
- **One mixer, two sides**: every source has a left and a right contribution; the mixer adds them.
  First look at the level bar (who gets how much of the range); details in article 7.
- **Three outputs** (and the tape): the audio jack, the internal speaker, HDMI — plus MIC to the tape
  output and the Pi.
- **Clocks**: the 28 MHz master clock, the 1.75 MHz PSG clock (the 128K's AY clock, kept for
  compatibility), and why the CPU's 3.5–28 MHz speed changes beeper and DAC timing but not the PSGs.
- **Switches old software never touches**: NextRegs `$06`, `$08`, `$09` and the port-enable registers
  `$82`–`$85` — a map of which bits belong to which article.
- **The series map**, one line per article.
- How Klive does it (short): one C file per device (`zxnext-beeper.c`, `zxnext-psg.c`,
  `zxnext-dac.c`, `zxnext-audio-mixer.c`, `zxnext-tape.c`), sampled into one stream per frame.

Figures (≈ 9):
1. The 48K's path (port `$FE` → speaker) beside the Next's six sources feeding one mixer.
2. **Hero figure**: signal flow of the whole audio system — sources, their registers, the mixer, the
   outputs (jack, speaker, HDMI, MIC, Pi), each source in its series colour.
3. Generator vs level writer: a PSG tone (CPU writes once) vs a DAC sample stream (CPU writes every
   sample), with CPU writes marked on a time axis.
4. Five waveform thumbnails, one per source, captured from the machine.
5. The mixer's 0–8191 range as a bar, each source's maximum share drawn to scale.
6. Clock tree: 28 MHz → 1.75 MHz PSG → tone/noise/envelope; CPU speed beside it.
7. The control registers as bit strips, each bit coloured by the source it controls.
8. The output stage: mixed 13-bit stereo → jack DACs, → speaker (mono), → HDMI.
9. Map of the series (figure 2 with article numbers on each block).

Verify: every source's range at the mixer; NextReg `$06`/`$08`/`$09` bits and reset values; the PSG
clock enable's rate in the top-level clock divider.

---

## 3. The background page — How a computer makes sound

**Not part of the series.** A standalone, machine-neutral page beside `crt-display.mdx`, at
`docs/content/en/under-the-hood/emulator-internals/computer-sound.mdx`, listed in the parent `_meta.ts`
right after "How a television draws a picture" as "How a computer makes sound". It is to the audio
series what the CRT article is to the screen series: the background every audio article can link to
instead of explaining it again. The overview (article 1) refers to it in its audience paragraph, and
later articles link it where a term from it first appears (sample, sample rate, DAC, filter, one-bit
sound).

**Brief and easy to understand** — a decision of the project author. Far shorter than the CRT article:
about 1,500–2,500 words and 5–6 figures, no formulas beyond one division, no Next registers, no
machine-specific numbers except as passing examples ("the Spectrum's beeper", "a CD's 44,100 samples a
second"). Plain words throughout; every term defined in the sentence that introduces it. Its one
question: **how does a list of numbers inside a computer become a sound you can hear?**

**Hook:** A loudspeaker can do only one thing: push its cone out and pull it back in. Everything you
have ever heard from a computer — a beep, a chord, a voice — is a list of positions for that cone. How
can a list of numbers sound like a voice?

Parts:
- **Sound is air pushed back and forth.** Pressure over time is a waveform; how far the cone moves is
  loudness, how often it moves is pitch. A speaker turns a voltage into a cone position, so making sound
  means making a voltage that changes the right way.
- **A sample is one number for one moment.** The computer cannot output a smooth curve, only a value
  now, then another a moment later. Sample rate (how often) and resolution (how many different values)
  — with the CD as the everyday example.
- **From a number to a voltage: the DAC.** A digital-to-analogue converter turns each number into a
  voltage and holds it until the next one, so its output is a staircase.
- **From a staircase to a smooth wave: the filter.** The steps are much faster than anything in the
  wanted sound; a low-pass filter (in the simplest case a resistor and a capacitor) and the speaker's own
  sluggishness smooth them away. This is the heart of the page: the step that makes the result
  *analogue*.
- **Fast enough, or it sounds wrong.** A sample rate must be more than twice the highest pitch, or a
  high note comes out as a wrong, lower one (aliasing) — one picture, no theory.
- **Sound from a single bit.** Only "on" and "off": a square wave at the right speed is a note (the
  Spectrum's beeper), and switching very fast with more or less time "on" averages to any level in
  between once filtered (pulse width, and the delta-sigma converters modern chips use). This connects
  back to the filter part: the same smoothing makes it work.
- **Several sounds at once are added together**: mixing is adding the numbers (or voltages); too large a
  sum is clipped; a level that never goes below zero carries a constant offset that a capacitor removes
  before the speaker.
- **Back to the computer**: the whole chain in one line — numbers → DAC → filter → amplifier → speaker →
  air — and where a sound chip fits (it makes the numbers itself instead of the CPU). Links to the audio
  series.

Figures (≈ 6):
1. The chain: numbers → DAC → filter → amplifier → speaker → air, with a small waveform at each step.
2. A sound wave and its samples: sample points on a smooth curve, at two sample rates.
3. The DAC's staircase and the filtered smooth wave, overlaid.
4. Aliasing: a fast wave sampled too slowly, and the slower wave the samples describe.
5. One-bit sound: a pulse train with changing on-time and the level it averages to after the filter.
6. Mixing: two waves added, and the sum clipped at the top of the range.

No machine captures: the figures are generated from computed waveforms (a small generator in the
scratchpad), so they stay exact and to scale. If listening clips are adopted (Q3), this page gets the
most useful ones: a note at two sample rates, an aliased note, a square vs a smoothed wave.

Verify: nothing machine-specific; every number recomputed by script (the alias frequency in the
example, the CD rate arithmetic). Mechanics as for the series (§0.5), but the page lives directly in
`emulator-internals/` and needs its own routes/assets golden entries.


**As built.** `computer-sound.mdx`, about 2,000 words of prose and six figures, all computed by
`docs/authoring/next-audio/computer-sound-figures.cjs`, which rewrites the SVG between the page's
`{/* fig:<name> */}` markers and prints the numbers the text quotes (edit the script, not the SVG).
Examples it settled: a 1,000 Hz wave at 16,000 and 5,000 samples a second; a 4-bit DAC staircase at
16,000 samples a second through two RC stages at 3,000 Hz (the smooth wave lags the staircase by about
0.1 ms); a 7,000 Hz tone at 8,000 samples a second heard as 1,000 Hz (the telephone example, limit
4,000 Hz); pulse widths of 25/50/75 % filtered to about those levels; 1,000 Hz + 3,000 Hz summed to
1.15 of the range and clipped. No listening clips (Q3 still open). The page is the background, so it
has no "How Klive does it"; the overview (article 1) links it in its audience paragraph.
---

## 4. Article 2 — The beeper, EAR and MIC

**Hook:** Manic Miner plays a two-voice tune from a single bit. The same bit tells the tape recorder
what to save, and the same port reads back what the tape plays. How do music and data share one wire?

Builds on `spectrum-display.mdx` (port `$FE`, contention) — re-explains only the sound side.

Topics:
- **Port `$FE` writes**: bit 4 (EAR, the beeper), bit 3 (MIC, the tape output), bits 2–0 the border
  (link). Why two bits: the 48K's EAR and MIC drove the same circuit at different strengths.
- **Levels at the mixer**: EAR 512 and MIC 128 while high, 0 while low (the 4:1 ratio of the original
  resistors); both on both sides.
- **The tape output**: MIC goes to the MIC jack, combined with the tape input and the Pi (an XOR,
  explain what that means for monitoring).
- **Port `$FE` reads**: bit 6 is the tape input — EAR in, XOR the Pi's EAR (article 6), OR the EAR
  output bit, OR the MIC bit when the issue-2 keyboard is set (NextReg `$08` bit 0) — the famous
  issue 2/issue 3 difference and why some old games depend on it.
- **The tape input's conditioning**: rejecting pulses shorter than about 1.14 µs, and relaxing a stuck
  "1" to "0" after about 1000 µs (why: real recorders, the 48K's and ZX81's expectations).
- **The internal speaker**: NextReg `$08` bit 4 enables it; NextReg `$06` bit 6 sends the beeper
  *only* to the speaker (EAR and MIC then leave the mix). What that is for (keyboard clicks, alerts
  without disturbing music).
- **Making music with one bit**: timing loops, pulse-width tricks for two or more voices, and why CPU
  speed (3.5/7/14/28 MHz) and contention change the pitch — with numbers.
- How Klive does it: `zxnext-beeper.c`, `zxnext-tape.c`, the DC filter on the beeper in the mixer.

Figures (≈ 9):
1. Port `$FE` write and read bit strips.
2. EAR and MIC levels on the mixer's scale (to scale on 0–8191).
3. A beeper square wave captured from the machine, with its period computed from the loop's T-states.
4. The same loop at 3.5 / 7 / 14 / 28 MHz: four waveforms, four pitches.
5. Two-voice beeper: two pulse trains interleaved, and the result.
6. The tape-input logic: EAR in, Pi EAR, EAR out, MIC × issue 2 → bit 6.
7. Debounce and relax-to-zero on a noisy tape signal (before/after).
8. The speaker-exclusive switch: two flow diagrams, NextReg `$06` bit 6 off and on.
9. MIC output path to the jack (and the XOR with the input).

Verify: port `$FE` read formula; EAR/MIC volumes; issue-2 keyboard; the debounce length and the relax
time in the top-level files; Klive's tape path against both.

---

## 5. Article 3 — One AY chip

**Hook:** Sixteen registers. Write three numbers and the chip plays a chord forever, with no further
help from the CPU. The 128K's whole soundtrack was made from three counters, a random-number generator
and a staircase.

Topics:
- **The AY-3-8910 / YM2149 family** and why the Next's chip can be either (NextReg `$06` bits 1–0: YM,
  AY; `10` behaves as YM; `11` holds every chip in reset).
- **The clock**: 1.75 MHz, divided once more inside the chip; the tone frequency formula, worked with a
  real note (A4 = 440 Hz → period).
- **Tone generators**: a 12-bit period counter per channel, toggling a square wave; period 0 and 1.
- **The noise generator**: a 5-bit period and a 17-bit shift register; what "noise period" changes in
  the sound.
- **The mixer register (R7)**: tone and noise enable per channel, active low; tone AND noise; the I/O
  direction bits.
- **Amplitude**: 4-bit fixed level or "use the envelope" (bit 4).
- **The envelope**: 16-bit period, the four shape bits (CONT, ATT, ALT, HOLD), the 16 shapes that
  reduce to 8 distinct ones; 32 steps in YM mode, 16 in AY mode; restart on writing R13.
- **The volume tables**: logarithmic DAC levels, YM 32-step vs AY 16-step tables, plotted.
- **AY vs YM mode differences visible to software**: register read-back masks (unused bits read 0 in AY
  mode), envelope resolution.
- **Ports**: `$FFFD` select, `$BFFD` data, reading back; port `$BFF5` (chip ID and register number,
  previewing article 4).
- **I/O ports A/B (R14/R15)**: present, but unconnected on the Next — what reading them returns.
- **Effects from the envelope**: buzzer bass (envelope as a waveform), vibrato/tremolo by rewriting
  registers each frame.
- How Klive does it: `zxnext-psg.c`, a port of the chip, stepped by the PSG clock; `ay-psg.test.ts`.

Figures (≈ 12):
1. Block diagram of one chip: three tone counters, noise LFSR, R7 mixer, amplitude/envelope, volume
   DAC, three outputs.
2. Register map (R0–R15) as a table-figure with bit widths.
3. Clock chain: 28 MHz → 1.75 MHz → ÷ 8 → tone counter → ÷ 2 square wave, with a worked note.
4. A tone counter timeline: count, wrap, toggle.
5. The 17-bit noise shift register and its feedback taps, with a captured noise waveform.
6. R7 as a bit strip and the AND of tone and noise per channel.
7. **The 16 envelope shapes** as a 4 × 4 grid of small waveforms, generated from the machine.
8. Envelope shape bits → behaviour (CONT/ATT/ALT/HOLD) worked on two shapes.
9. Volume tables: YM 32 steps vs AY 16 steps, plotted on one axis.
10. Buzzer bass: a short envelope period used as a waveform.
11. AY vs YM read-back masks per register (bit strip).
12. Three channels of one chord captured from the machine, aligned on one time axis.

Verify: the clock division inside the chip (`I_SEL_L`), counter widths and wrap behaviour, LFSR length
and taps, envelope step counts and shape table, both volume tables, read masks, reset values, R14/R15
inputs, `$BFF5` format. Every period/frequency recomputed by script.

---

## 6. Article 4 — TurboSound Next

**Hook:** Two ports, three chips. A 128K tune that knows nothing about the Next plays on chip 0 as it
always did — while a Next tracker plays nine channels, each chip panned to its own place in the stereo
field.

Topics:
- **Selecting a chip through the register-select port**: a write to port `$FFFD` with bit 7 set and
  bits 4–2 = `111` selects a chip (bits 1–0) and sets its panning (bits 6–5) instead of selecting a
  register; why this cannot collide with old software (register numbers stay below 16).
- **The enable**: NextReg `$08` bit 1; with TurboSound off only the selected chip sounds, and the
  selection is frozen. What old software sees.
- **Panning per chip**: bits 6–5 of the selection write (left, right, both, muted — verify the
  encoding).
- **Stereo modes**: ABC vs ACB for all chips (NextReg `$08` bit 5); mono per chip (NextReg `$09`
  bits 7–5) — what each does to A, B, C, with the arithmetic (A + B/2 … verify the exact sums).
- **Reading back**: port `$FFFD` returns the selected chip's register; port `$BFF5` returns chip ID
  and register number.
- **Levels**: each chip's sides and the 0–2295 range per side; how three chips share the mixer.
- **Holding in reset** (mode `11`) and what it resets (the selection and pans too).
- **Practical uses**: chip 0 for music, chip 1 for effects so a tune is never interrupted; nine-channel
  trackers; ACB for headphones.
- How Klive does it: the selection in `zxnext-psg.c`/`zxnext-ports.c`, `turbosound-mix.test.ts`,
  `ay-stereo-mode.test.ts`.

Figures (≈ 9):
1. Three chips behind two ports: the selection logic as a flow.
2. Port `$FFFD` write as a bit strip: register select vs chip select + pan.
3. A write sequence (select chip 1, register 8, data) on a timeline, with which chip receives each.
4. TurboSound off vs on: one chip sounding vs three.
5. ABC vs ACB: where each channel lands, left and right bars.
6. Mono mode: the three channels summed to both sides.
7. Per-chip panning: three chips placed left / centre / right.
8. Level budget: three chips' sides on the mixer scale, to scale.
9. Captured nine-channel chord, left and right waveforms.

Verify: the selection write's exact bit pattern and pan encoding; the stereo/mono sum formulas and
their widths; what "frozen when disabled" means at the register level; reset scope of mode `11`; read
paths.

---

## 7. Article 5 — The 8-bit DACs

**Hook:** Sampled drums, speech, even a whole song from a file — the Next plays them through four
8-bit DACs, and answers on the ports of six different Spectrum and Pentagon sound cards so their old
software just works.

Topics:
- **What a DAC channel is**: an 8-bit level the CPU writes; it holds until the next write. Rest level
  `$80` (after reset, and when the DACs are disabled).
- **Four channels, two sides**: left = A + B, right = C + D, each side 0–510, ×4 at the mixer.
- **Enabling**: NextReg `$08` bit 3; disabled DACs are held at `$80`.
- **Six peripherals on four channels** — the port families and the channels each writes:
  Soundrive mode 1 (`$1F`,`$0F`,`$4F`,`$5F`), Soundrive mode 2 (`$F1`,`$F3`,`$F9`,`$FB`), Covox stereo
  (`$0F`,`$4F`), Profi Covox (`$3F`,`$5F`), Pentagon/ATM mono (`$FB`), GS Covox mono (`$B3`),
  Specdrum mono (`$DF`); mono ports write two channels at once.
- **Turning families on and off**: the Internal Port Decoding Enables registers, NextRegs `$82`–`$85`
  (bits 17–23), and the clashes they resolve: `$DF` with the Kempston alias and the mouse, `$FB` with
  Soundrive mode 2, `$1F` with Kempston joystick.
- **The NextReg mirrors**: NextRegs `$2C` (B, left), `$2D` (A and D), `$2E` (C, right) write the DACs
  from the Copper or code that has no free port; read side belongs to article 6.
- **Feeding samples on time**: a CPU loop (and why its rate depends on CPU speed and contention), the
  CTC interrupt, the DMA with its prescaler writing one byte per tick to a fixed port, and the Copper
  through the mirrors — each with the sample rate it can reach and its CPU cost.
- **Practical uses**: drum kits mixed with AY music, speech, Covox-era MOD players.
- How Klive does it: `zxnext-dac.c` (decode table, mirrors), `dac-decode.test.ts`, `dac-enable.test.ts`.

Figures (≈ 11):
1. A DAC channel: write, hold, next write — a staircase from captured samples.
2. Four channels into two sides (A+B, C+D) with ranges.
3. **Port map**: every DAC port, which family, which channels, as one table-figure.
4. Mono port writing two channels at once.
5. NextRegs `$82`–`$85` bits 17–23 as a bit strip, coloured by family.
6. Port clashes: `$DF`, `$FB`, `$1F` — who answers under which enables.
7. The mirrors `$2C`–`$2E` and the channels they reach.
8. Four ways to feed samples on a time axis: CPU loop (jitter), CTC interrupt, DMA + prescaler,
   Copper; samples marked.
9. DMA prescaler: one byte per N 28 MHz ticks → sample rate, worked numbers.
10. A captured sample (a drum hit) played through Specdrum.
11. Level budget: the DACs' share of the mixer range, to scale.

Verify: every port decode condition and its enable bit; the `$FB`/`$F1`/`$F9` conflict rule; the
channel each mirror reaches and reset values; the DMA prescaler's time base and formula; CTC rates.

---

## 8. Article 6 — Audio from the Raspberry Pi

**Hook:** Inside the Next sits a Raspberry Pi Zero. It can play MP3s, speak, emulate other sound chips
— and its sound arrives as a stream of samples on four wires, mixed with everything else, or even fed
into the tape input so the Next can load from it.

Klive emulates the Next's receiving half of the link (§0.6): a sample source stands in for the Pi.
The article's callout says so — the Pi's *sound* is real samples, the Pi's *software* is not emulated —
and so does "How Klive does it". The Next → Pi direction is described as hardware only.

Machine pictures, from the scene test through the harness's Pi I2S methods (`piI2sConnect`,
`piI2sReceiver`, `piI2sStatus`; `test/harness/zxnext/README.md`), first asserting what the text says:
- a tone streamed in stereo, then with NextReg `$A2` set to mono from the left and from the right, and
  one side muted — the mixer's left and right side each time;
- the two latch moments per sample period (left word at mid-period, right word at its end) on one time
  axis, from a slow stream with distinct left/right values;
- the EAR bit following a slow wave through the hysteresis band (the receiver's latched words and its
  EAR bit, read as device state, under the wave);
- a tape tone streamed with EAR routing on, read back from port `$FE` bit 6.

`test/zxnext-hw/audio/pi-i2s.test.ts` (I2S-001–012) already pins these facts; the scene test reuses its
setups rather than restating them.

Topics:
- **I2S in one paragraph**: bit clock, word select (left/right), serial data; who drives the clock.
- **The link**: NextReg `$A2` — enable (off / mono from right / mono from left / stereo), direction of
  the data pins (the "hats" vs "pi" setting), mute per side, the reserved bits that must be written as
  shown.
- **Both ways**: the Next sends its mixed audio to the Pi, and receives the Pi's 10-bit samples.
- **Into the mixer**: the Pi's 0–1023 per side; the rest level when off or muted.
- **Into the tape input**: NextReg `$A2` bit 0 routes the Pi to port `$FE` bit 6 through a threshold
  with hysteresis (top two bits all ones → 1, all zeros → 0) — why hysteresis.
- **Reading samples**: NextRegs `$2C`/`$2E` return the top 8 bits of the current sample and latch the
  low 2 bits for NextReg `$2D` — a two-read protocol, and why reads and DAC writes share these numbers.
- **The sample word**: the receiver keeps the top 13 bits of each word whatever its slot width, and the
  Next uses the top 10 with the sign bit inverted (signed → offset binary): 0 → `$200`, full negative →
  `$000`, full positive → `$3FF`; why a 16-, 24- or 32-bit Pi stream all work.
- **When a sample arrives**: word select framing — the left word is latched at the edge in the middle of
  a sample period, the right word at its end; enabling from off starts at the rest value, disabling
  resets the receiver.
- **Into the speaker as one bit**: with EAR routing on, the Pi's EAR bit is XORed into the MIC line, so
  the stream is heard as a one-bit signal (link to article 2).
- **Practical uses**: loading TAPs streamed by the Pi, MP3 playback, sampling the Next's output.
- How Klive does it: the sample source in place of the Pi (`src/emu/machines/zxNext/piI2s/`:
  `PiI2sSource.ts`, `wavDecoder.ts`); the receiver in `zxnext-pi-i2s.c` with lazy sync to the 28 MHz
  clock; samples delivered per frame, counted from the frame's start so the fast path and the debug loop
  deliver the same; reverse debugging replays the journaled samples instead of asking the source again;
  the `pi-audio` command (link `/en/reference/commands/`, and the Guides page once it exists).

Figures (≈ 10):
1. The Pi on the Next: signal flow both ways.
2. I2S timing: SCK, WS, SD for one left/right pair.
3. NextReg `$A2` bit strip.
4. Mono/stereo choices: which Pi side feeds which mixer side.
5. Pi level on the mixer scale.
6. The EAR threshold with hysteresis on a slow, noisy waveform.
7. The `$2C`/`$2D`/`$2E` read protocol: two reads, latched low bits.
8. Pin direction setting: data in/out on the two pins.
9. Signed sample → 10-bit offset binary, as a bit strip (16-bit slot, top 10 bits kept, sign inverted).
10. Machine captures: stereo / mono-left / mono-right / muted, left and right sides (see above).

Verify: the enable encoding, pin direction, mute and EAR routing; sample width and rest level; the
threshold rule; the read/latch protocol; clocking (master/slave; the slave bit is disabled).

---

## 9. Article 7 — The mixer and the outputs

**Hook:** Every source adds its number to one sum, many million times a second. Nothing is ever
subtracted, so silence is not zero — and the sum still has to come out of a 3.5 mm jack, a tiny
speaker and an HDMI cable at the same time.

If a reader reads only one article after the overview, this one.

Topics:
- **The sum**: per side, EAR + MIC + AY + DAC + I2S, unsigned, in one 13-bit range (0–8191, at most
  5998 used): a table of every source with its maximum and its share, and why the headroom.
- **Why unsigned**: each source idles at a positive level; the DC is removed after the DAC (by the
  output capacitors), not in the sum. What that means for clicks when a source switches on.
- **The jack**: a delta-sigma DAC per side taking 12 bits, plus an RC low-pass outside the FPGA — how a
  one-bit pin makes 4096 levels.
- **The internal speaker**: one delta-sigma DAC for the mono sum (L + R with an offset), or only EAR and
  MIC when the beeper is exclusive (NextReg `$06` bit 6); enabled by NextReg `$08` bit 4.
- **HDMI audio**: 48 kHz, the 13-bit sum placed in 16 bits; silenced by NextReg `$09` bit 2; why it is
  sampled while the jack is not.
- **Clipping and loudness**: what a full-scale source does; why nine AY channels at full volume still fit.
- **Klive's mixer, side by side**: same proportions, signed and DC-filtered, scaled to 16 bits — what a
  listener hears differently (nothing, in normal use) and what a waveform shows differently.
- How Klive does it: `zxnext-audio-mixer.c` (the sum, the gain, the DC filter on the beeper),
  `beeper-mixer.test.ts`.

Figures (≈ 10):
1. The mixer: five inputs per side, their widths and shifts, into the sum.
2. **Level budget**: 0–8191 bar per side with each source's maximum stacked, to scale.
3. Unsigned sum with DC, and the same after the output capacitor (captured data).
4. Delta-sigma DAC: 12-bit input, pulse train, RC filter, analogue output.
5. The jack, speaker and HDMI paths from the one sum.
6. Speaker mono mix: L + R with offset vs the beeper-only path.
7. HDMI: 48 kHz sampling of the sum, the 16-bit word.
8. A click: a DAC switched on from 0 to its `$80` rest, before and after DC removal.
9. Hardware sum vs Klive's mix for the same scene, one above the other.
10. The control bits for the outputs (NextRegs `$06`, `$08`, `$09`) as strips.

Verify: every input width and shift; the maximum sum; the jack DAC's input bits and the RC values;
the speaker mix (sum, offset, the exclusive case); the HDMI sample rate and word placement in both
board issues.

---

## 10. Article 8 — From the machine to your speakers

**Hook:** The Next's sound changes on any of 28 million clock ticks a second; a sound card wants
48,000 numbers a second, delivered in time, while the emulator runs in bursts of whole frames — or
stops at a breakpoint. How does an emulator make that sound smooth?

Mostly Klive's own design (the "How Klive does it" article of the series), with a short Part on the
hardware it imitates.

Topics:
- **Sampling the machine**: one sample every 28 MHz ÷ rate ticks, the fractional carry across frames
  (why dropping it lost 0.45 sample per frame at 48 kHz).
- **Aliasing**: why sampling a square wave whose edges fall between samples rattles, and what Klive does
  about it (point sampling vs averaging — verify what the PSG and beeper paths do).
- **The DC filter** on the beeper, its cut-off and why.
- **Frames to a stream**: samples collected per frame, handed to the renderer, played by an
  `AudioWorklet` (`Sampling.worklet.js`, `AudioRenderer.ts`); buffering, the latency it adds, and what
  happens when the emulator runs slower or faster than real time.
- **Pausing, breakpoints, step, reverse debugging and replays**: what is played (silence), and why
  audio cannot be part of a replay's determinism.
- **Machine speed and turbo**: what the emulator does with sound when it runs at more than 100 %.
- **Testing sound**: how the harness captures audio and what the tests assert (levels, periods,
  sides) — one Part, since this is the article about Klive itself.
- **Series wrap-up**: one page that ties the whole audio system together.

Figures (≈ 9):
1. Time bases: 28 MHz ticks, the PSG clock, 48 kHz sample points, frame boundaries.
2. The fractional sample carry across a frame boundary.
3. Aliasing: a square wave sampled with edges between samples; spectrum before/after.
4. DC filter response on a beeper wave (captured).
5. The pipeline: core → per-frame buffer → renderer → worklet → host audio.
6. Buffering and latency: producer and consumer on one timeline, underrun case.
7. What plays when the machine stops at a breakpoint.
8. Running faster than real time.
9. Series map, final form.

Verify: everything against Klive's code (`zxnext-audio-mixer.c`, `AudioDeviceBase`, the renderer and
worklet); timing claims measured, not assumed.

---

## 11. Facts the survey already established

Recorded here so the articles start from checked numbers (each still re-checked when written):

- PSG clock: 1.75 MHz (an enable from the 28 MHz clock), divided further inside the chip.
- Audio chip mode, NextReg `$06` bits 1–0: `00` YM, `01` AY, `10` named "ZXN-8950" but only bit 0 is
  used (behaves as YM), `11` holds every chip in reset (and their selection and pans).
- NextReg `$06` bit 6: beeper only to the internal speaker. NextReg `$08`: bit 5 ACB, bit 4 internal
  speaker (hard reset 1), bit 3 DACs, bit 1 TurboSound, bit 0 issue-2 keyboard. NextReg `$09`: bits 7–5
  mono per chip, bit 2 silences HDMI audio.
- TurboSound chip select: port `$FFFD` write with bit 7 = 1 and bits 4–2 = `111`; bits 1–0 choose the
  chip (`11` chip 0, `10` chip 1, `01` chip 2), bits 6–5 its pan. A register select needs bits 7–5 = 0.
- Port `$BFF5` (inside `$BFFD`'s decoding, A3 = 0): chip ID and the 5-bit register number.
- DACs: four 8-bit channels, rest `$80`; left = A + B, right = C + D (9 bits per side); disabled = held
  at rest; NextRegs `$2C` (B), `$2D` (A and D), `$2E` (C) write them, reads return Pi I2S data.
- Port-enable bits 16–23 of NextRegs `$82`–`$85`: AY, Soundrive 1, Soundrive 2, Profi Covox, Covox,
  Pentagon/ATM `$FB` (only with Soundrive 2 off), GS Covox `$B3`, Specdrum `$DF` (+ Kempston alias).
- Mixer units per side: EAR 512, MIC 128, AY 0–2295, DAC 0–2040 (9 bits × 4), I2S 0–1023; sum at most
  5998 of 8191; with the beeper exclusive, EAR and MIC leave the mix.
- Outputs: jack = delta-sigma DAC per side on 12 bits + external RC; speaker = one delta-sigma DAC on
  the mono sum (or EAR/MIC only when exclusive); HDMI audio at 48 kHz.
- Tape input: debounced (pulses under ~1.14 µs rejected), stuck "1" relaxed after ~1000 µs; port `$FE`
  bit 6 = EAR in XOR Pi EAR, OR EAR out, OR (MIC out AND issue-2).
- Pi I2S: NextReg `$A2`; 10-bit samples; rest level when off/muted/routed to EAR; EAR by hysteresis on
  the top two bits.
- Klive: has beeper, tape, PSG, TurboSound, DACs, mixer, and the Next's Pi I2S receiver fed by a sample
  source (no Pi, no Next → Pi direction); mixer signed and DC-filtered (§0.6).
- Pi I2S word: top 13 bits of the slot kept, top 10 used with the sign bit inverted
  (`((s >> 6) & $3FF) ^ $200` for a signed 16-bit `s`); left latched mid-period, right at its end; a
  side whose enable is clear takes the other side's sample; EAR routing uses the raw latches, not the
  muted selection; with EAR routing on, the mixer gets the rest level.

---

## 12. Fact-checking checklist (per article, before it is published)

- Every NextReg/port bit traced to `nextreg.txt`/`ports.txt` **and** the VHDL that uses it.
- No reference to the VHDL or the FPGA source files (search for `vhd`, `VHDL`, `_input`,
  `next-fpga`, `snake_case`).
- Every number (clock rates, divisions, ranges, levels, sample rates) recomputed by script, with the
  file and line in the working notes (`docs/authoring/`).
- Every waveform is drawn from a capture by the scene test, which first asserts what the text says; the
  caption says whether it shows a device's output or Klive's mix.
- Where Klive differs, the core is fixed (own commit, `fix` changeset) or the article says so.
- Every clip listened to; every figure checked in light and dark mode.
- `npm run doc:build && npm run doc:check` green.

## 13. Open questions for the author

- **Q1** — Subfolder `next-audio/` (proposed), mirroring `next-display/`?
- **Q2** — Eight articles as listed, or merge TurboSound into the AY article? *(Pi audio stays its own
  article now that Klive emulates the receiving half and it has machine captures.)* *(Settled: the sound background is a standalone
  page beside `crt-display.mdx`, §3, and the overview links it.)*
- **Q3** — Listening examples: embed short generated clips (`<audio controls>`) next to the waveforms?
  It needs a new asset kind in `doc:check`, but sound is hard to understand from pictures alone.
- **Q4** — Klive's mixer differs from the hardware's (signed, DC-filtered vs unsigned): keep Klive's
  (it sounds the same) and describe the difference, or change the core to sum like the hardware and
  filter once at the end?
- **Q5** — Is Article 8 (Klive's audio pipeline) in scope for this series, or a separate
  `emulator-internals` page, since it is about the emulator rather than the Next?
