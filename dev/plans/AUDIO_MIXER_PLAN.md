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
  stage and *before* the mix and the DC filter. Int16 per channel, laid out
  `[sample][channel]`, capacity = the existing `*_AUDIO_SAMPLE_CAPACITY`. Written only while taps
  are enabled (`<core>AudioSetTapsEnabled(1)`), so a closed mixer costs one branch per sample.
- **A mute mask and per-channel gain** (`<core>AudioSetChannelGain(ch, milli)`): applied in the mixer
  before summing. Mute is gain 0. Default gain 1000 for every channel.

Mute and gain change **only the output mix**. They never feed back into machine state: the TVC's
sound interrupt, the Z88's SBIT, the AY's registers and envelopes, DAVE's ring modulation and the
Next's `beep_spkr_excl` keep running exactly as before. A debug-loop replay with a different mute
mask must stop at the same places (`test/wasm/debug-loop-equivalence.test.ts` stays green).

The gain and mask are **volatile-safe**: they are host settings, not machine state, so they are not
saved in snapshots or checkpoints and are not part of the reverse-execution history.

### 3.2 Host side

- `IAnyMachine.getAudioChannels(): AudioChannelInfo[] | undefined` (undefined = no sound, no mixer).
- `setAudioChannelGain(id, gain)`, `setAudioTapsEnabled(on)`, `getAudioChannelTaps(): Int16Array`.
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

1. **Channel model + taps in the shared Spectrum code** (beeper, tape, PSG): 48K, 128K, +3e, Timex,
   Scorpion. Harness tests: a muted AY channel is silent in the mix and the machine's state hash is
   unchanged; solo of the beeper gives the beeper's samples bit-exactly.
2. **Next mixer**: TurboSound x3, DAC A-D, Pi I2S, beeper/MIC/tape, through
   `zxnext-audio-mixer.c`; tests in `test/zxnext-hw/audio/`, every profile.
3. **Z88, HT-1080Z, TVC, Enterprise** taps and masks; one harness test per machine.
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
- D3 (decided 2026-11-14): placement is **B + C** - the mixer document for analysis and the
  emulator popover for quick muting; option A is not built.
- Solo: a channel's S button makes it audible on its own; while any channel is soloed, only soloed
  channels play, whatever their mute state. Clearing every solo restores the mute states as they were.
- Q2: tape as a channel of its own, or part of the beeper (it shares the EAR line)?
- Q3: should AY channels in ABC/ACB stereo show their pan position in the mixer, and be pannable?
