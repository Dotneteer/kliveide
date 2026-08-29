# Klive beeper sample generation improvement plan

Created: 2026-08-29

## Goal

Improve Klive's beeper sample generation where zx-go is stronger, while keeping
the audio traits where Klive is already better or more appropriate for its
browser/Electron runtime.

This plan is intentionally limited to beeper sample generation. It does not
change PSG, DAC, tape playback sound, I2S, or general audio rendering except
where the beeper output must pass through existing shared paths.

Expected result after executing this plan:

- all Klive unit tests pass;
- new focused beeper tests pass;
- manual listening tests confirm cleaner beeper tone, centered classic output,
  no obvious clicks, and no regressions in Next beeper behaviour.

## Traits to keep from Klive

Keep these because they are better suited to Klive than zx-go's current fixed
audio approach:

- The browser `AudioContext.sampleRate` is captured and passed into classic
  WASM machines. This avoids unnecessary browser resampling.
- The TypeScript and classic WASM paths can use arbitrary sample rates, not only
  44.1 kHz.
- Klive already uses time-weighted beeper averaging, which is much better than
  point-sampling the EAR bit.
- Klive keeps EAR and MIC separate internally where the ZX Next mixer needs that
  distinction.
- Klive's renderer/worklet buffering is already independent from the emulator
  implementation and should stay unchanged unless a beeper fix exposes a bug
  there.

## Problems to fix

Fix these because zx-go's approach is cleaner or more faithful:

- Klive averages from one sample pull to the next, so the integration window may
  end at the CPU tact where the emulator noticed the sample was due, not at the
  ideal audio sample boundary.
- Classic Spectrum beeper output currently exposes EAR on the left channel and
  MIC on the right channel. Classic beeper output should be mono after the
  EAR/MIC level mix, duplicated to both channels.
- The DC blocker coefficient `0.995` is too aggressive for beeper audio. It
  removes DC, but can thin low-frequency beeper content.
- ZX Next WASM beeper/mixer output is hardwired to 48 kHz instead of using the
  actual requested output sample rate.

## Step 1: Add characterization tests for current behaviour

Purpose: lock down the useful current behaviour before changing algorithms.

Tasks:

- Add focused tests around `SpectrumBeeperDevice` proving that transitions are
  time-weighted, not point-sampled.
- Add tests proving that the configured sample rate changes sample count/timing.
- Add tests proving that the ZX Next path keeps EAR and MIC separately visible
  before the mixer combines them.
- Add tests documenting the current classic stereo problem as a pending or
  expected-failing case, depending on the project's normal test style.

Success criteria:

- Tests clearly distinguish time-weighted averaging from instantaneous sampling.
- The expected-failing classic stereo test shows why the later mono fix is
  needed.
- Existing test suite behaviour is otherwise unchanged.

## Step 2: Introduce exact-window integration in the shared beeper model

Purpose: preserve Klive's accumulator style while removing sample-boundary
jitter.

Preferred implementation:

- Keep recording EAR/MIC transitions at `$FE` write time.
- Change sample generation so every sample integrates the exact ideal window:
  `[audioSampleStartTact, audioSampleEndTact)`.
- If CPU execution has advanced beyond the ideal sample boundary, only consume
  transition durations up to that boundary.
- Carry any later state/time forward into the next sample.

Alternative implementation:

- Store frame-relative transition lists and render the completed frame zx-go
  style.

Recommendation:

- Use incremental exact-window integration first. It fits Klive's existing
  `setNextAudioSample()` flow and should touch fewer call sites.

Files likely involved:

- `/Users/dotneteer/source/kliveide/src/emu/machines/AudioDeviceBase.ts`
- `/Users/dotneteer/source/kliveide/src/emu/machines/BeeperDevice.ts`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-beeper.c`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxNext/wasm/zxnext/zxnext-beeper.c`

Success criteria:

- A transition exactly halfway through a sample window produces a half-level
  raw beeper value.
- Transitions just before and just after a sample boundary affect the correct
  neighboring samples.
- Multiple toggles inside one sample window produce the correct duty-cycle
  average.
- The implementation still supports arbitrary sample rates.

## Step 3: Fix classic Spectrum beeper stereo shape

Purpose: make 48K/128K/+3 beeper output match the classic mono audio path.

Tasks:

- For classic Spectrum TypeScript output, calculate a single mixed beeper level
  from EAR/MIC:
  `00 -> 0.00`, `01 -> 0.33`, `10 -> 0.66`, `11 -> 1.00`.
- Apply the DC blocker to that mono mixed signal.
- Duplicate the filtered mono sample into both left and right channels.
- Apply the same change to the classic WASM shared beeper path.
- Do not remove separate EAR/MIC support where ZX Next needs it.

Files likely involved:

- `/Users/dotneteer/source/kliveide/src/emu/machines/BeeperDevice.ts`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-beeper.c`
- classic WASM loader tests under `/Users/dotneteer/source/kliveide/test/wasm/zxSpectrum`
- TypeScript audio tests under `/Users/dotneteer/source/kliveide/test/audio`

Success criteria:

- Classic beeper-only samples are identical on left and right.
- MIC still contributes at the correct lower level.
- Existing callers expecting `outputLevel` continue to work.
- ZX Next mixer tests still confirm separate EAR/MIC treatment before mixing.

## Step 4: Replace fixed DC coefficient with sample-rate-derived filtering

Purpose: keep DC removal while preserving low beeper frequencies better.

Tasks:

- Replace hardcoded `0.995` in TypeScript with a coefficient derived from the
  current audio sample rate.
- Use a low cutoff, initially 1.4 Hz to match zx-go's effective behaviour at
  44.1 kHz.
- Use the same formula in classic WASM and Next WASM beeper paths:
  `R = exp(-2 * pi * cutoffHz / sampleRate)`.
- Keep filter state per channel where the signal is stereo, and one mono filter
  where the classic beeper has become mono.

Files likely involved:

- `/Users/dotneteer/source/kliveide/src/emu/machines/AudioDeviceBase.ts`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-beeper.c`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxNext/wasm/zxnext/zxnext-audio-mixer.c`

Success criteria:

- Held DC still decays to silence.
- A low-frequency square wave keeps stable plateaus without obvious droop.
- No startup click is introduced.
- No clipping is introduced by the filter step response.

## Step 5: Make ZX Next WASM beeper/mixer sample rate configurable

Purpose: keep Klive's browser-native sample-rate advantage for the Next path.

Tasks:

- Replace `ZXNEXT_AUDIO_SAMPLE_RATE 48000u` with runtime state.
- Add a `zxnextSetAudioSampleRate(rate)` export, mirroring the classic WASM
  exports.
- Sync Klive's `AUDIO_SAMPLE_RATE` machine property into the Next WASM runtime.
- Recompute mixer timing when the sample rate changes.
- Keep default 48 kHz only as a fallback before the host provides a rate.

Files likely involved:

- `/Users/dotneteer/source/kliveide/src/emu/machines/zxNext/wasm/zxnext/zxnext-audio-mixer.c`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxNext/wasm/zxnext/zxnext.c`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxNext/wasm/ZxNextWasmV2Loader.ts`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxNext/ZxNextWasmV2Machine.ts`
- `/Users/dotneteer/source/kliveide/test/wasm/zxNext`

Success criteria:

- Next WASM sample count follows configured sample rate.
- Existing 48 kHz tests still pass when configured to 48 kHz.
- Non-48 kHz tests do not drift or under/over-produce samples for one frame.

## Step 6: Align TypeScript, classic WASM, and Next WASM beeper tests

Purpose: ensure the three Klive backends behave consistently where they should,
and intentionally differ only where machine hardware differs.

Tasks:

- Add shared test cases for exact-window beeper integration.
- Run those cases against:
  - `SpectrumBeeperDevice`;
  - 48K WASM;
  - 128K WASM;
  - +3E WASM;
  - Next WASM beeper/mixer, adjusted for its separate EAR/MIC mixer model.
- Check sample counts at common rates: 44100, 48000, and the real browser sample
  rate when available in integration tests.

Success criteria:

- Classic TypeScript and classic WASM agree on mono mixed samples.
- Next TypeScript/oracle and Next WASM agree on EAR/MIC source samples and final
  mixed output.
- The tests catch sample-boundary off-by-one errors.

## Step 7: Run focused automated verification

Purpose: catch beeper regressions quickly before running the full suite.

Suggested commands:

- `npm test -- --project jsdom test/audio/BeeperDevice.test.ts`
- `npm test -- --project jsdom test/audio/BeeperMameCompat.test.ts`
- `npm test -- --project jsdom test/audio/BeeperFpga.step22.test.ts`
- `npm test -- --project jsdom test/wasm/zxSpectrum/wasm-beeper-audio.test.ts`
- `npm test -- --project jsdom test/wasm/zxNext/wasm-next-beeper-audio.test.ts`
- `npm test -- --project jsdom test/wasm/zxNext/wasm-next-audio-mixer.test.ts`

Success criteria:

- All focused beeper and beeper-adjacent tests pass.
- No unrelated snapshots or fixture outputs change unexpectedly.

## Step 8: Run full project verification

Purpose: make sure the beeper changes did not break the wider emulator.

Suggested commands:

- `npm test`
- `npm run build:check`
- `npm run lint:renderer` only if renderer React code was touched.
- `npx electron-vite build --config build/electron.vite.config.ts` if imports,
  WASM loader surfaces, or moved files changed.

Success criteria:

- All unit tests pass.
- Type checking passes.
- Renderer lint passes if relevant.
- Vite build/import analysis passes if relevant.

## Step 9: Manual listening and behaviour checks

Purpose: confirm that technically correct samples also sound right.

Manual tests:

- 48K BASIC `BEEP` at low, mid, and high pitches.
- A known beeper-engine game or demo with continuous 1-bit music.
- A program that toggles `$FE` rapidly for sample-like output.
- Tape loading with MIC/EAR activity, only to confirm no obvious beeper-path
  regression; deeper tape sound work is out of scope.
- ZX Next beeper through headphone/PCM output, including the internal-speaker
  exclusion control if available in the UI.

What to listen for:

- classic beeper appears centered, not left-only;
- less fuzzy edge jitter on pure square tones;
- no new startup click or frame-boundary click;
- low tones do not fade or wobble unnaturally;
- no periodic dropouts caused by sample-rate mismatch;
- Next EAR/MIC balance still feels consistent with the existing mixer model.

Success criteria:

- Manual tests confirm the expected improvements.
- Any subjective difference from zx-go is explainable by host sample rate,
  hardware model differences, or mixer scaling rather than by sample-generation
  defects.

## Step 10: Record final implementation notes

Purpose: leave a durable audit trail after the plan is executed.

Tasks:

- Add a follow-up note under `/Users/dotneteer/source/kliveide/_input/zx_go`
  summarizing:
  - files changed;
  - algorithm chosen;
  - tests run;
  - manual tests performed;
  - remaining known differences from zx-go.

Success criteria:

- The beeper implementation can be understood later without rereading the whole
  diff.
- Future PSG/DAC/tape audio work can build on the documented sample timing
  model.
