# Audio Mixer And Visualizer Plan

Status: **proposal** (2026-11-14). Mockups: `dev/plans/audio-mixer/mockups.html` (open in a browser;
the signals are synthetic).

## 1. Goal

A per-machine **audio mixer** that lists every sound source the emulated machine has (the beeper
included), lets the user **mute, solo and set the level** of each one, and **shows each source's
amplitude and spectrum** live.

It exists only for machines that make sound. A machine without an audio output (ZX80, ZX81, and the
experimental C64, whose SID produces no samples yet) gets no mixer: the panel, the menu command and
the toolbar entry are not offered, the same way a missing feature is hidden elsewhere
(`machine-registry.ts` `features`).

## 2. Sound sources per machine (as built today)

| Machine | Sources (channels in the mixer) | Where they are mixed now |
|---|---|---|
| ZX Spectrum 48 | Beeper (EAR), MIC, Tape (EAR in while loading) | `zxSpectrum/wasm/common/zx-spectrum-beeper.c` |
| ZX Spectrum 128 / +2 / +3 / +3e, Scorpion | Beeper, MIC, Tape, AY A, AY B, AY C | `zx-spectrum-beeper.c` + `zx-spectrum-psg.c` (`SP48_AUDIO_BEFORE_SAMPLE`) |
| Timex | Beeper, Tape, AY A/B/C (SCLD) | `timex.c` + shared PSG |
| ZX Spectrum Next | Beeper (EAR), MIC, Tape, TurboSound AY1 A/B/C, AY2 A/B/C, AY3 A/B/C, DAC A/B/C/D, Pi I2S (L/R) | `zxnext-audio-mixer.c` (beeper, `zxnext-psg.c`, `zxnext-dac.c`, `zxnext-pi-i2s.c`) |
| Cambridge Z88 | Speaker (3200 Hz oscillator / SBIT) | `z88-beeper.c` |
| HT-1080Z | Beeper (port FF), AY A/B/C (mono on the board) | `ht1080z-audio.c` |
| Videoton TVC | Sound generator (square / DAC amplitude) | `tvc-audio.c` |
| Enterprise 64/128 | DAVE Tone 0, Tone 1, Tone 2, Noise (each with L/R amplitude; D/A mode shows as "DAC L/R") | `ep-audio.c` |

The list is **declared by the machine**, never by the UI: each machine reports an
`AudioChannelInfo[]` (id, label key, group such as "TurboSound AY2", stereo/mono, default colour
role). The Next's list follows its profile (Pi I2S only where the model has it).

## 3. Architecture

### 3.1 Taps in the cores (D1)

The cores already compute each source's level before summing it. Each audio-producing core gains:

- **A channel tap buffer**: per host audio sample, the level of each source *after* its own volume
  stage, *before* its mixer gain (a pre-fader tap: a muted channel's meter still moves) and before
  the mix and the DC filter. Int16 per channel, laid out
  `[sample][channel]`, capacity = the existing `*_AUDIO_SAMPLE_CAPACITY`. Written only while taps
  are enabled (`<core>AudioSetTapsEnabled(1)`), so a closed mixer costs one branch per sample.
- **A per-channel gain** (`<core>AudioSetChannelGain(ch, milli)`), applied in a parallel *heard*
  mix: the core's own mix stays exactly as it was, and the heard mix applies the gains into its own
  buffer, which is what the host plays. Mute is gain 0. Default gain 1000 for every channel.

Mute and gain change **only the output mix**. They never feed back into machine state: the TVC's
sound interrupt, the Z88's SBIT, the AY's registers and envelopes, DAVE's ring modulation and the
Next's `beep_spkr_excl` keep running exactly as before. A debug-loop replay with a different mute
mask must stop at the same places (`test/wasm/debug-loop-equivalence.test.ts` stays green).

**The gains and the taps switch change only volatile statics** (D4). Reverse debugging compares
replayed memory with its keyframes and calls a difference a diverged replay (`ReplayDesyncError`);
a user may change a gain between recording and a Step Back. So the gains, the taps, the heard mix
and everything downstream of a gain (its DC filter, the PSG's gained sums) are volatile, and every
other static the mixer adds is a function of the machine alone. A test per core family proves it:
a run with gains and taps changed mid-run leaves every non-volatile byte equal to a plain run's.

### 3.2 Host side

- `IAnyMachine.audioMixer?: IAudioChannelMixer` (`src/emu/abstractions/IAudioChannelMixer.ts`),
  undefined on a machine without sound: `getAudioChannels()`, `setAudioChannelGain(id, gain)`,
  `setAudioTapsEnabled(on)`, `getAudioChannelTaps()`. The machine knows only gains; solo is resolved
  into gains by the UI.
- The emulator process forwards a **reduced frame** to the IDE window when someone is watching:
  per channel peak, RMS and a 512-point magnitude spectrum (or the raw taps for the selected
  channel's scope). Analysis runs in the emulator renderer (one radix-2 FFT per channel per frame:
  16 channels x 1024 points x 50 Hz is well under 1 ms), so the IPC payload is small and fixed.
- Mixer settings are stored per machine type in the app settings (`audio.mixer.<machineId>`) so a
  muted AY stays muted across restarts; a "Reset" restores unity.

### 3.3 Recording (D2)

Recordings (`recordingManager.submitAudioSamples`) take the **mixed** output, so they follow the
mixer by default. A toggle in the mixer, "Record unmuted", lets a recording keep every channel. An
RZX-to-video render ignores the mixer (it renders the machine, not the user's listening setup).

### 3.4 UI placement

Three options, mocked up side by side (§5). Whatever is chosen:

- Values use the state-panel colours (`--color-state-value`); each channel's meter and spectrum use
  a **per-group hue** from tokens (beeper, AY, DAC, DAVE...), so nine TurboSound channels read as
  three families of three.
- Labels go through `t()` (`src/common/i18n/locales/en/`), with translator context.
- Row heights from `theming/tokens/rowSizes.ts`; column widths in `ch`.

## 4. Phases

1. **(Done, 2026-11-14, branch `feature/audio-mixer`.) Channel model + taps in the shared Spectrum code** (beeper, tape, PSG): 48K, 128K, +3e, Timex,
   Scorpion. Harness tests: a muted AY channel is silent in the mix and the machine's state hash is
   unchanged; solo of the beeper gives the beeper's samples bit-exactly.
2. **(Done, 2026-11-14.) Next mixer**: TurboSound x3, DAC A-D, Pi I2S, beeper/MIC/tape, through
   `zxnext-audio-mixer.c`; tests in `test/zxnext-hw/audio/`, every profile.
3. **(Done, 2026-11-14.) Z88, HT-1080Z, TVC, Enterprise** taps and gains; tests for each machine.
4. **Host API + analysis** (FFT, peak/RMS, IPC frame), unit-tested with synthetic tones (a 1 kHz
   square must peak at the 1 kHz bin with odd harmonics).
5. **UI**: the mixer document (B) and the emulator popover (C), plus settings persistence and the "no sound" hiding rule.
6. **Docs**: a Guides page with generated screenshots (`guides-*` doc-shot recipe), the changeset,
   and `dev/ai/ui-theming-intent-and-lessons.md` updated with the meter/spectrum colour rules.

## 5. Mockup options

- **A — Sidebar "Sound" panel (compact).** One row per channel: mute/solo, a horizontal level
  meter, a small spectrum strip. Fits the IDE's dense sidebar; the spectrum is small.
- **B — Mixer document (console).** Vertical channel strips with fader, meter, mute/solo, and a mini
  spectrum each; a large analyzer below for the selected channel (spectrum, oscilloscope or
  spectrogram). The richest view; takes a document tab.
- **C — Emulator popover from the sound split button.** Quick mute/solo and meters where the user
  already sets the volume; an "Open analyzer" link to B. Good for players, no spectra.

A and C can coexist with B (C for quick muting, B for analysis).

## 6. Decisions to take

- D1 (proposed): taps and masks in the cores, not a re-synthesis in TypeScript.
- D2 (proposed): recordings follow the mixer, with an opt-out.
- D4 (decided 2026-11-14): the gains and the taps switch change only volatile statics; the host
  plays a heard mix computed beside the core's own (§3.1).
- D3 (decided 2026-11-14): placement is **B + C** - the mixer document for analysis and the
  emulator popover for quick muting; option A is not built.
- Solo: a channel's S button makes it audible on its own; while any channel is soloed, only soloed
  channels play, whatever their mute state. Clearing every solo restores the mute states as they were.
- Q2 (answered in the build): the tape is its own channel on the Spectrum family; on the Next it shares the MIC line's channel, which the hardware XORs it into.
- Q3: should AY channels in ABC/ACB stereo show their pan position in the mixer, and be pannable?

## 7. As built

### Phase 1 (Spectrum family)

- **Core module** `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-audio-channels.c`: six fixed
  slots (beeper, MIC, tape, AY A-C), gains in milli (0-4000, 1000 = unity), the taps
  (`int16 [sample][6]`, written only while on). Included by the sp48 (and Timex), sp128 and spp3e
  cores before the PSG and the beeper. Exports `<core>AudioSetChannelGain`, `AudioGetChannelGain`,
  `AudioSetTapsEnabled`, `AudioTapsPtr`, `GetAudioChannelCount` (`dev/scripts/zx-audio-channel-exports.cjs`).
- **The heard mix** (`zxAudioHeardSamples`, with its own DC filter): the core's own mix, filter and
  buffer run exactly as before; `<core>AudioSamplesPtr` now points at the heard buffer. At unity the
  heard mix takes the core's own filter input, so the output is bit-identical; otherwise the beeper
  takes its gained form and the AY its gained sum (`sp128PsgHeard*`). Nothing reads the core's own
  sample buffer any more, so the compiler drops it, and the 48K's frame-boundary scratch list
  (`sp48AudioSamples`) is empty. Checked against master's cores: 50 frames of beeper + AY
  tone/noise/envelope on the 48K, 128K and +3E at 44.1 and 48 kHz, both Timex models and a real
  tape load hash the same.
- **The first cut broke D4** (gains applied inside the core's own mix, so its DC filter state - in
  every keyframe - followed the gains); it was reworked into the heard mix before it was committed.
- **The beeper's gained form** splits the four-level EAR/MIC table into an EAR part (0.66), a MIC
  part (0.33) and both at once (2/3 EAR gain + 1/3 MIC gain, so 1.0 at unity), weighted by the time
  each state held within the sample.
- **The tape is its own channel (Q2 decided this way).** While a tape loads, the EAR line carries the
  tape (`effectiveAudioEarBit`), so the EAR part of the level goes to the tape channel's gain and tap,
  and the beeper's tap is zero.
- **The HT-1080Z is untouched**: the AY's taps are behind `SP128_PSG_CHANNEL_TAPS`, which only the
  Spectrum cores define (phase 3 adds the HT-1080Z).
- **Volatile statics**: the gains, the unity flag, the taps switch and buffer, the heard buffer and
  its DC filter (`dev/scripts/zx-audio-channel-exports.cjs`), and on the cores with an AY its heard
  sums. The AY's per-channel tap statics are accumulated always, so they follow the machine alone and
  are not listed (the compiler splits those three-element arrays into one global per element anyway).
- **Saved states**: the new statics change each core's layout fingerprint, so state files saved by
  older builds do not load in these cores (as with any core change that adds statics).
- **Tap scale**: a tap is converted as the frame's samples are (/ 32768), so it reads as the
  channel's share of the output; each core scales its output its own way (the 128K by 24576).
- **Host**: `SpectrumAudioMixer` (`src/emu/machines/zxSpectrum/spectrumAudioChannels.ts`) on the 48K,
  128K (and Scorpion), +3E and Timex machines; the Timex lists the AY only on the 2068s. Channel and
  group names are `emu.audioMixer.*` keys.
- **Tests**: `test/wasm/zxSpectrum/wasm-audio-channels.test.ts` (channel lists, unity unchanged with
  gains touched and taps on, all-muted silence, machine state independent of gains, pre-fader taps,
  gain clamping, AY channel A's gain, the Timex models, tape routing).

### Phase 2 (ZX Spectrum Next)

- **Core module** `zxnext-audio-channels.c`: 17 slots - EAR, the MIC line, TurboSound AY1-AY3 A-C,
  DAC A-D, Pi I2S left/right - with the same exports as the Spectrum cores (`zxnextAudioSetChannelGain`
  ...). Every profile has every source, so the list does not follow the model.
- **The tape shares the MIC channel** ("MIC / Tape"): the Next XORs the tape input and the Pi's EAR
  bit into the MIC line (`beep_mic_final`, zxnext-beeper.c), so they cannot be told apart in the sound.
- **The heard mix** (`zxnextMixerHeardLeft/Right`) is the core's own mix - jack with its 12-bit wrap,
  speaker (diverted beeper included), HDMI (point-sampled) - with each source's gain: the beeper after
  its DC filter, the DACs and the Pi about their rests, TurboSound per channel through the same
  routing (ABC/ACB, mono, panning, TurboSound on or the selected chip). At unity it copies the core's
  own words. The sample getters return it. A muted source plays exactly as a silent one (tests: a
  muted AY channel equals one at volume 0, a muted DAC one at $80).
- **TurboSound's per-channel levels** (`zxnextPsgChannel*`) are accumulated always (machine-only);
  its gained sums (`zxnextPsgHeard*`) are volatile.
- **Taps** are in the jack's units x 12.8, the scale of the jack's output words.
- **Checked against master's cores**: 40 frames of beeper + all three AYs (tones, noise, envelope) +
  three DAC channels, on all four profiles, all three outputs, beeper diverted and not, hash the same.
- **Harness**: the Next session has `audioMixer` and `memoryDifferences(other)` (README, self-tests).
- **Tests**: `test/zxnext-hw/audio/audio-mixer.test.ts`, every profile.
- **Shared host class**: `src/emu/machines/wasmAudioChannelMixer.ts` drives any core with the mixer
  exports from a channel table (`zxSpectrum/spectrumAudioChannels.ts`, `zxNext/nextAudioChannels.ts`).

### Phase 3 (Z88, HT-1080Z, TVC, Enterprise)

- **Common module** `src/emu/machines/common/wasm/audio-channels.c` (Z88, HT-1080Z, TVC, Enterprise): gains in
  milli, the unity flag, the taps (int16, 32768 per 1.0 of the core's output), and
  the functions each core's five export wrappers call. Its statics are `__attribute__((used))`: without
  it the compiler reshaped them per core (a one-channel gain table became a scalar, a flag the
  Enterprise never reads vanished) and their names left the linker map the volatile list needs.
- **Z88 (Speaker) and TVC (Sound)**: one source and a linear DC filter, so the gain goes after the
  filter and before the clamp; the filter stays the machine's. Taps: the level before the filter.
- **HT-1080Z (Beeper, AY A-C)**: the common module too (slot 0 the beeper, 1-3 the AY), so it still
  shares only the AY with the Spectrum (the CPU contract's rule, `HT1080Z_PLAN.md` §5): the shared AY
  takes its per-channel gain from `SP128_PSG_CHANNEL_GAIN(channel)`, which each includer maps onto its
  own gains. A heard DC filter of its own on the beeper and the AY's heard sum. Muted after the boot, the output decays from the silent AY's offset through that filter
  with no step.
- **Enterprise (Tone 0-2, Noise)**: every stage after DAVE's channels is linear, so a heard chain runs
  the same sum (with each channel's gain), low-pass, average and DC filter in volatile scalars, and
  is always what the host plays (bit for bit the core's own at unity from a reset, and no step when
  the gains return to unity). A channel's contribution is its amplitude while its output is 1, or in
  D/A mode channel 0's amplitude x 4; its tap is the mean of its two sides, accumulated always.
- **Checked against master's cores**: 40 frames of each machine's scene, and the Enterprise in D/A
  mode and with ring modulation, high-pass and the variable noise, hash the same.
- **Host**: `src/emu/machines/audioChannelTables.ts` (the four tables, `createFixedAudioMixer`).
- **Tests**: `test/wasm/audio-mixer-cores.test.ts`.
