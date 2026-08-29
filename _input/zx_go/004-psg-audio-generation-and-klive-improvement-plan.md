# PSG audio generation comparison and Klive improvement plan

Created: 2026-08-29

## Scope

This note extends the beeper-focused comparison in:

- `_input/zx_go/002-beeper-audio-sample-generation.md`
- `_input/zx_go/003-klive-beeper-sample-generation-improvement-plan.md`

The new focus is PSG/AY/TurboSound generation and how PSG audio is combined
with beeper and other sources. The earlier beeper plan is useful background,
but parts of it are now stale: current Klive already uses exact-window beeper
integration, classic mono beeper output, sample-rate-derived beeper DC filtering,
and a configurable ZX Next WASM audio sample rate.

Primary source landmarks:

- `/Users/dotneteer/source/zx_go/pkg/ay/ay.go`
- `/Users/dotneteer/source/zx_go/pkg/ay/stereo.go`
- `/Users/dotneteer/source/zx_go/pkg/ay/engine.go`
- `/Users/dotneteer/source/zx_go/pkg/audio/audio.go`
- `/Users/dotneteer/source/zx_go/pkg/ula/ula.go`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxSpectrum128/PsgChip.ts`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-psg.c`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxNext/TurboSoundDevice.ts`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxNext/AudioMixerDevice.ts`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxNext/ZxNextMachine.ts`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxNext/wasm/zxnext/zxnext-psg.c`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxNext/wasm/zxnext/zxnext-audio-mixer.c`
- `/Users/dotneteer/source/kliveide/src/renderer/features/emulator/AudioRenderer.ts`
- `/Users/dotneteer/source/kliveide/src/renderer/features/emulator/Sampling.worklet.js`

## Short verdict

Do not blindly port zx-go's PSG pipeline into Klive.

zx-go has a stronger FPGA-oriented AY/YM core for Spectrum Next semantics:
it models the 5-bit YM/AY DAC index, FPGA panning, 17-bit noise with the FPGA
tap/self-start behavior, and envelope priming details. That makes it a good
reference for Next PSG correctness.

Klive has the better host-audio shape for an Electron/Web Audio app: it follows
the browser `AudioContext.sampleRate`, emits frame-sized sample batches, and
keeps all output in the renderer/worklet pipeline. Current Klive also already
fixed the major beeper issues described in the earlier notes.

The main Klive PSG improvement should be:

- keep Klive's browser-native sample-rate handling;
- keep classic Spectrum PSG MAME compatibility unless tests prove a regression;
- make PSG sample generation and mixing obey exact audio sample windows;
- make the TS and WASM Next PSG paths use the same source timing and mixer
  contract;
- add golden tests that separate classic AY behavior from ZX Next FPGA behavior.

## zx-go PSG model

zx-go's AY package models an AY-3-8912 with a fixed 1.7734 MHz AY clock and a
fixed 44.1 kHz host output rate. The PSG advances by a fractional number of
post-divider AY ticks per emitted audio sample.

Important traits:

- `ay.SampleRate` is fixed at 44100 Hz.
- `ay.AYClock` is fixed at 1773400 Hz.
- `MixIntoStereo()` advances the PSG once per host stereo sample and mixes into
  an existing interleaved stereo buffer.
- Classic machines use mono panning: `L = R = A + B + C`.
- Next uses ABC/ACB panning and per-chip mono, matching the FPGA panning law.
- The Next-facing channel DAC path uses 5-bit YM/AY indices and tables aligned
  with the FPGA core.
- The noise generator uses FPGA-style 17-bit `poly17` behavior with taps 0 and
  2 plus all-zero self-start.
- Envelope handling includes FPGA-style immediate priming after a shape write.

Where zx-go is weaker for Klive's purposes:

- Host sample rate is fixed to 44.1 kHz.
- PSG register writes mutate chip state immediately; the audio callback advances
  the chip separately. The PSG path is not reconstructed from a tact-stamped
  event list the way zx-go's beeper/tape/DAC frame audio is.
- The audio callback is the clock that pulls PSG forward. That is acceptable in
  zx-go's architecture, but Klive already has a frame-synchronous Web Audio
  handoff and should not trade it away.

## Klive PSG model

Klive has several PSG paths.

### Classic TypeScript `PsgChip`

`PsgChip.ts` is a MAME-shaped AY/YM core used by tests and the TypeScript ZX
Next implementation. It contains AY and YM resistor-derived audio tables,
diagnostic output tables, tone/noise/envelope state, and orphan accumulators.

Important traits:

- The core follows MAME-style register side effects, resistor tables, envelope
  stepping, and noise behavior.
- It exposes both diagnostic integer output and normalized audio output per
  channel.
- `generateOutputValue()` advances one PSG generator tick and increments orphan
  accumulation counters.

Risk areas:

- It is not a complete frame/sample scheduler by itself.
- For Next TS audio, `TurboSoundDevice` currently samples instantaneous
  `currentOutputA/B/C` values instead of consuming the orphan averages.
- Noise/envelope behavior intentionally differs from zx-go's FPGA-oriented
  implementation. That may be fine for classic AY compatibility, but should be
  explicitly tested for Next.

### Classic WASM `zx-spectrum-psg.c`

The classic 128K/+3 WASM PSG is tied more closely to CPU time than zx-go's audio
callback path.

Important traits:

- It advances the PSG to the current `sp128Tacts` before PSG register writes.
- It advances PSG ticks every 16 machine tacts.
- It accumulates routed mono PSG output over generated PSG ticks.
- Before each mixed audio sample, `sp128PsgPrepareAudioSample()` advances to
  the current CPU tact and averages the accumulated PSG output.
- The shared beeper code then adds that PSG level into both left and right
  classic output channels.

Risk area:

- Like the old beeper algorithm, the accumulation window is bounded by the CPU
  tact where the emulator notices a sample is due, not necessarily by the ideal
  audio sample boundary. This can introduce small timing jitter and duty-cycle
  error for high-frequency PSG content.

### ZX Next TypeScript `TurboSoundDevice` and `AudioMixerDevice`

The TypeScript Next path has a three-chip YM `TurboSoundDevice` plus an
`AudioMixerDevice`.

Important traits:

- The PSG sample rate is configurable and measured in the 28 MHz frame-tact
  domain.
- PSG clocking is decoupled from Z80 speed by using 28 MHz frame tacts.
- The panning law matches the same ABC/ACB/mono shape as zx-go.
- `ZxNextMachine.getAudioSamples()` combines per-frame beeper samples and
  TurboSound samples by array index, then runs each pair through the mixer.

Risk areas:

- PSG output is sampled instantaneously at the sample point, not averaged over
  the exact audio sample window.
- `calculateCurrentAudioValue()` skips elapsed spans greater than 800 28 MHz
  tacts. That is a plausible guard against frame wrap or runaway work, but it
  can lose PSG time during larger execution chunks or future turbo modes.
- `setNextAudioSample()` emits at most one sample per call. If the caller ever
  jumps over more than one audio boundary, PSG samples will under-produce.
- The mixer is frame-index aligned by convention rather than by a shared sample
  boundary object. The WASM path has a stronger single-mixer timeline.

### ZX Next WASM `zxnext-psg.c` and `zxnext-audio-mixer.c`

The Next WASM path is closer to the desired shape than the TS Next path.

Important traits:

- The mixer owns the output sample rate and currently supports runtime
  `zxnextSetAudioSampleRate`.
- The mixer emits all due samples in a `while` loop using 64-bit scaled
  threshold math.
- The beeper source is sampled with exact-window integration.
- PSG stereo panning matches the TS path.

Risk areas:

- PSG output is still instantaneous at each mixer sample endpoint; it is not
  averaged over the sample window.
- PSG advancement is driven after instruction execution, while the mixer can
  append samples during tact advancement. That ordering can let the mixer see
  a PSG state that is one update behind unless tests prove the current sequence
  is harmless.
- It shares the `elapsed > 800` skip behavior with the TS path.
- The Next PSG core is YM-table based, but its noise/envelope semantics are not
  obviously the same as zx-go's FPGA-faithful core.

## Recommended plan

### Step 1: Freeze current behavior with focused PSG tests

Add characterization tests before changing sound generation.

Cover:

- Classic 128K/+3 WASM sample count at 44100 and 48000 Hz.
- Classic mono PSG output duplicated left/right after beeper-path mixing.
- A simple PSG tone whose register write occurs just before an audio boundary.
- The same write just after an audio boundary.
- TS Next and WASM Next panning in mono, ABC, and ACB mode.
- Next TurboSound enabled vs disabled: disabled should output only the selected
  chip; enabled should sum all three chips.
- Renderer/worklet receives interleaved stereo sample pairs without channel
  rotation after odd or short buffers.

Success criteria:

- Tests distinguish current instantaneous PSG sampling from future windowed
  averaging.
- Tests pin the behavior that should not change: sample-rate configurability,
  classic mono output, and Next panning.

### Step 2: Define one audio sample boundary contract

Introduce a small internal convention used by beeper, PSG, DAC, and mixer code:

- sample windows are `[sampleStartTact, sampleEndTact)`;
- sources may be advanced only up to `sampleEndTact` when producing that sample;
- any source activity after `sampleEndTact` is carried into the next sample;
- all source samples mixed together for index `i` must describe the same tact
  window.

This is the PSG version of the beeper fix that Klive has already applied.

Prefer an incremental exact-window approach over a frame transition list for
PSG. PSG state evolves continuously at its own tick rate, so storing every PSG
level transition would be more expensive than advancing the chip to exact
boundaries and accumulating source levels.

### Step 3: Make classic WASM PSG exact-window

Change `sp128PsgPrepareAudioSample()` so it accepts or can read the ideal
audio sample end tact, rather than advancing to the current CPU tact.

Implementation direction:

- In `setNextAudioSample()`, call the PSG prep with `sp48AudioNextSampleTact`.
- Have PSG advancement accumulate output only up to that boundary.
- Leave later CPU time untouched until the next register write or sample window.
- Keep `sp128PsgAddressWrite()` and `sp128PsgDataWrite()` advancing PSG to the
  exact write tact before mutating registers.
- Preserve the existing MAME-shaped AY tables and 0.25 classic route gain.

Success criteria:

- Register writes just before/after sample boundaries affect the expected
  neighboring sample.
- High-frequency PSG tones maintain stable duty-cycle averages.
- Classic 128K/+3 audio still follows the browser-provided sample rate.

### Step 4: Make Next PSG window-averaged

Apply the same concept to `TurboSoundDevice` and `zxnext-psg.c`.

Implementation direction:

- Add per-chip or aggregate stereo PSG accumulators for left/right output and
  generated PSG tick count within the current audio window.
- When generating each PSG tick, accumulate the panned output that would reach
  the mixer.
- When a mixer sample is due, advance PSG only to the ideal sample end boundary
  and return the average panned left/right PSG levels for that window.
- Make `setNextAudioSample()` in TS use a `while` loop, mirroring the WASM
  mixer's ability to emit all due samples.
- Replace the `elapsed > 800` drop with chunked advancement or a frame-wrap
  check that does not silently discard valid elapsed PSG time.

Success criteria:

- TS Next and WASM Next produce matching sample counts and close PSG sample
  values for deterministic tone/envelope cases.
- A square wave faster than the audio rate becomes a stable averaged value
  instead of sample-point aliasing.
- TurboSound panning and selected-chip gating remain unchanged.

### Step 5: Decide classic vs Next PSG fidelity targets

Use different references for different machines:

- Classic 128K/+2/+3: keep MAME-compatible AY behavior unless existing ROMs,
  tests, or a chosen emulator reference show a reason to change it.
- ZX Next: prefer FPGA-faithful behavior. Use zx-go's AY/YM core and its golden
  tests as a reference for noise, envelope, DAC table, reset, and panning
  details.

Specific differences to test before changing:

- Noise LFSR taps and initial state.
- All-zero noise self-start behavior.
- Envelope shape-write priming.
- Period 0 and 1 behavior for tone, noise, and envelope.
- AY register masking/readback in AY vs YM mode.
- Reset behavior: register reset vs generator reset.

Recommendation:

- Do not merge the classic and Next PSG cores too aggressively.
- Share test vectors and small helper APIs first.
- Only share implementation once the fidelity targets are explicit.

### Step 6: Review Next mixer scaling after PSG averaging

After averaging, re-check the mixer math.

Questions to answer with tests and listening:

- Should PSG use `currentOutput*` diagnostic-scale values or
  `currentAudioOutput*` resistor-normalized values in the TS path?
- Does the peak-based midpoint AC coupling in `AudioMixerDevice` preserve the
  intended stereo image for hard-left or hard-right PSG content?
- Should WASM and TS mixer scaling be bit-for-bit aligned, or only perceptually
  aligned?
- Does PSG averaging reduce peak levels enough to require a small volume trim?

Recommendation:

- Keep the existing scale constants initially.
- Add tests around clipping, hard-panned channel audibility, and mixed beeper +
  PSG output before tuning subjective loudness.

### Step 7: Align diagnostics and debugger state

`WasmSpectrumPsgDevice` is currently a control/state adapter; it does not own
audio samples. That is fine, but debugger-visible state should improve alongside
audio fixes.

Tasks:

- Export enough WASM PSG state to populate channel counters, output bits, noise
  seed, noise counter, envelope counter, and envelope position.
- Keep diagnostic output separate from audio output in naming.
- Ensure TS and WASM state snapshots use the same field meanings.

Success criteria:

- Debug panels can explain what the PSG is doing without inferring all channel
  bits from one aggregate output value.
- Tests can assert internals for timing fixes without brittle private access.

### Step 8: Verification

Focused test commands:

- `npm test -- --project jsdom test/audio/PsgDevice.test.ts`
- `npm test -- --project jsdom test/audio/PsgVolumePeriod.step34.test.ts`
- `npm test -- --project jsdom test/audio/PsgMixerNoise.step21.test.ts`
- `npm test -- --project jsdom test/audio/PsgEnvStereo.step56.test.ts`
- `npm test -- --project jsdom test/audio/PsgCrossCheck.step912.test.ts`
- `npm test -- --project jsdom test/audio/TurboSoundDevice.step2.test.ts`
- `npm test -- --project jsdom test/audio/TurboSoundDevice.step3.test.ts`
- `npm test -- --project jsdom test/audio/TurboSoundDevice.step4.test.ts`
- `npm test -- --project jsdom test/audio/AudioMixerDevice.step8.test.ts`
- `npm test -- --project jsdom test/wasm/zxSpectrum/wasm-psg-audio.test.ts`
- `npm test -- --project jsdom test/wasm/zxNext/wasm-next-psg-audio.test.ts`
- `npm test -- --project jsdom test/wasm/zxNext/wasm-next-audio-mixer.test.ts`

Full verification after implementation:

- `npm test`
- `npm run build:check`
- `npm run lint:renderer` only if renderer React code changes
- `npx electron-vite build --config build/electron.vite.config.ts` if WASM
  exports/loaders/import surfaces change

Manual listening checks:

- 128K AY music at 44.1 kHz and 48 kHz output devices.
- ZX Next TurboSound music using more than one chip.
- Hard-panned channel tests in ABC and ACB modes.
- Mixed beeper + PSG playback.
- Rapid PSG register changes near frame/audio sample boundaries.

## Implementation order

1. Add characterization tests.
2. Make classic WASM PSG prep exact-window.
3. Add a PSG window-average API to the Next WASM mixer path.
4. Bring TS `TurboSoundDevice` onto the same sample-boundary contract.
5. Add Next FPGA-vs-MAME golden vectors and decide which differences to keep.
6. Tune mixer scaling only if averaging creates measurable or audible level
   regressions.
7. Expand WASM diagnostic exports for debugger parity.

## Non-goals

- Replacing the Web Audio worklet/ring buffer unless testing shows underruns.
- Changing the already-improved beeper algorithm.
- Reworking DAC, I2S, tape sound, or recording except where shared sample
  boundary tests expose a PSG mix bug.
- Collapsing classic AY and Next YM behavior into one fidelity target.

## Implementation notes

Implemented on 2026-08-29:

- Classic 128K/+3 WASM PSG prep now receives the ideal beeper/audio sample end
  tact and averages PSG output over that exact window instead of stopping at
  the current CPU tact.
- ZX Next `TurboSoundDevice` now tracks PSG output in the 28 MHz frame-tact
  domain with time-weighted left/right accumulators, emits every due sample in
  a `while` loop, and advances without the old `elapsed > 800` time drop.
- ZX Next AY register and data port handlers now advance TurboSound to the
  current frame tact before changing PSG selection, panning, or registers.
- ZX Next WASM PSG now provides a prepared sample-window average consumed by
  the WASM audio mixer, with matching diagnostic exports for tests.
- Added sample-window characterization tests for TS TurboSound and WASM Next
  PSG.

Verified:

- `npm test -- --project jsdom test/audio/TurboSoundDevice.sample-window.test.ts test/audio/TurboSoundDevice.step2.test.ts test/audio/TurboSoundDevice.step4.test.ts`
- `npm test -- --project jsdom test/wasm/zxNext/wasm-next-psg-audio.test.ts test/wasm/zxNext/wasm-next-audio-mixer.test.ts test/wasm/zxSpectrum/wasm-psg-audio.test.ts`
- `npm run build:check`
- `npx electron-vite build --config build/electron.vite.config.ts`

Still recommended for a later pass:

- Add FPGA-vs-MAME golden vectors for ZX Next noise taps, all-zero noise
  recovery, and envelope shape priming.
- Re-check subjective mixer loudness with real TurboSound content before tuning
  any scale constants.
- Expand debugger diagnostics to show per-channel counters and envelope/noise
  internals.
