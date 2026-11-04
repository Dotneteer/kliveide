# zx-go vs Klive beeper audio sample generation

Created: 2026-08-29

## Scope

This note compares only the one-bit beeper path, using zx-go as the reference
implementation and Klive as the target to evaluate. PSG, DAC, tape playback
sound, and full Next audio mixing are mentioned only where they affect the
beeper path.

Primary source landmarks:

- `/Users/dotneteer/source/zx_go/pkg/audio/audio.go`
- `/Users/dotneteer/source/zx_go/pkg/audio/dcblock.go`
- `/Users/dotneteer/source/zx_go/pkg/ula/ula.go`
- `/Users/dotneteer/source/kliveide/src/emu/machines/BeeperDevice.ts`
- `/Users/dotneteer/source/kliveide/src/emu/machines/AudioDeviceBase.ts`
- `/Users/dotneteer/source/kliveide/src/emu/machines/ZxSpectrumBase.ts`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-beeper.c`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-ports.c`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxNext/wasm/zxnext/zxnext-beeper.c`
- `/Users/dotneteer/source/kliveide/src/emu/machines/zxNext/wasm/zxnext/zxnext-audio-mixer.c`
- `/Users/dotneteer/source/kliveide/src/renderer/features/emulator/AudioRenderer.ts`
- `/Users/dotneteer/source/kliveide/src/renderer/features/emulator/Sampling.worklet.js`

## Short verdict

Klive is not doing the worst possible thing. Its current beeper algorithm is
already time-weighted, so it is much better than simple point sampling of the
EAR bit at audio sample instants.

However, zx-go's beeper reconstruction is still the cleaner audio-quality
algorithm. zx-go records all speaker transitions during the frame, then rebuilds
each output sample as the exact average level over that sample's T-state window.
That gives stable edge timing, less sample-boundary jitter, and better handling
when the beeper toggles faster than the audio rate.

Klive's current approach averages transitions since the previous sample pull.
That is close in normal cases, but the sample window ends at the CPU tact where
the emulator happened to notice that a sample is due, not necessarily at the
ideal audio sample boundary. This can smear or jitter edges by a few tacts. It
is a small error for ordinary BEEP output, but it matters more for high-frequency
1-bit music, samples, turbo modes, and any path that advances time in larger
chunks.

The biggest quality issues I found in Klive are:

- Classic Spectrum beeper audio is represented as EAR on the left channel and
  MIC on the right channel. For a classic Spectrum output, the beeper should be a
  mono mixed signal sent to both channels. The current shape can make beeper-only
  sound left-sided.
- Klive's DC blocker uses `alpha = 0.995`, which is a relatively high high-pass
  corner, about 35-40 Hz at common browser sample rates. zx-go uses a much gentler
  coefficient, `0.9998` at 44.1 kHz, about 1.4 Hz. Klive's filter removes DC, but
  it can audibly thin or droop low beeper content more than necessary.
- ZX Next WASM audio generation is hardwired to 48 kHz in the mixer, while the
  classic WASM path can follow the browser `AudioContext.sampleRate`.

## zx-go technique

zx-go treats the beeper as an event-timed one-bit signal.

When the program writes to port `$FE`, `ULA.WritePort` extracts bit 4. If that
speaker bit changes, zx-go records an `audioEvent` containing:

- the new speaker state;
- the T-state offset from the current audio frame start.

It does not emit an audio sample immediately. It only records the edge.

At the end of the emulated frame, `flushAudioFrame()` calls `mixAudioFrame()`.
For beeper-only audio, the important step is `generateBeeperFrame()`, which
delegates to `generateSquareWaveFrame()`.

`generateSquareWaveFrame()` creates a fixed number of samples per frame:

- sample rate: 44100 Hz;
- samples per frame: `44100 / 50 = 882`;
- each sample covers an exact slice of the emulated frame:
  `sampleStart = i * frameTstates / 882`,
  `sampleEnd = (i + 1) * frameTstates / 882`.

For every sample window, it walks all speaker events inside that window and
counts how many T-states the signal was high. The output is the low-to-high
weighted average for that window.

This is a box filter over the 1-bit waveform. It does not snap an edge to the
nearest output sample. If a speaker edge occurs halfway through a sample window,
the output sample is half-low and half-high.

After reconstruction, zx-go widens the mono beeper samples to stereo and applies
a per-channel DC blocker. The beeper raw level is symmetric around zero
(`-16000` and `+16000`), and the DC blocker removes the long-term steady rail
without severely affecting low audio frequencies.

## Klive TypeScript technique

Klive's TypeScript beeper device is incremental rather than frame-reconstructed.

`ZxSpectrumBase.writePort0xFE()` updates the border, stores bit 3, and calls
`beeperDevice.setOutputLevel(ear, mic)`.

`SpectrumBeeperDevice.setOutputLevel()` records the duration since the previous
EAR/MIC change into accumulators:

- accumulated EAR-high tacts;
- accumulated MIC-high tacts;
- total accumulated tacts.

`AudioDeviceBase.setNextAudioSample()` is called from the machine tact hook.
When the machine tact has passed the next scheduled sample tact, it asks
`getCurrentSampleValue()` for a sample. `SpectrumBeeperDevice` then returns the
time-weighted average since the last sample period was reset.

So Klive does integrate transitions, but it integrates between sample pulls,
not between fixed ideal audio sample boundaries.

Example:

- Ideal sample window should be `[0, 79.36)` tacts.
- CPU execution advances from tact 76 to tact 80.
- Klive notices the sample is due at tact 80 and averages `[0, 80)`.
- zx-go reconstructs `[0, 79.36)` exactly at frame synthesis time.

That difference is usually tiny, but it is real edge-timing jitter. zx-go turns
sub-sample timing into amplitude in the correct sample. Klive turns it into
amplitude over a slightly variable sample span.

Klive also high-pass filters each generated sample inline with:

`y[n] = x[n] - x[n-1] + 0.995 * y[n-1]`

The filter is useful, but `0.995` is aggressive for this purpose.

## Klive classic WASM technique

The classic WASM path in `zx-spectrum-beeper.c` mirrors the TypeScript approach:

- `$FE` writes call `recordAudioTransition(sp48Tacts)` when EAR or MIC changes.
- `setNextAudioSample()` checks whether the current tact passed the next sample
  tact.
- If transitions accumulated, it returns averaged EAR/MIC levels for the elapsed
  interval.
- It applies the same `0.995` high-pass filter.
- It writes signed 16-bit samples into an interleaved frame buffer.

The good part is that the sample rate is configurable through
`sp48SetAudioSampleRate()` / `sp128SetAudioSampleRate()`, and Klive passes the
browser `AudioContext.sampleRate` into the machine. This is better for browser
playback than generating a fixed 44.1 kHz stream and relying on the browser to
resample it.

The weaker part is the same as in the TypeScript path: the averaging interval is
bounded by the moment `setNextAudioSample()` is called, not by exact sample
window start/end tacts.

Another classic-path issue: the raw sample stores EAR as left and MIC as right.
For a Spectrum 48/128/+3 beeper output, that is not a natural final stereo
image. The hardware audio is effectively mono after the EAR/MIC resistor mix.
For beeper-only output, both channels should normally receive the same mixed
signal.

## Klive ZX Next WASM technique

The Next WASM beeper uses integer accumulators in `zxnext-beeper.c`:

- current EAR and MIC bits;
- current tact;
- last change tact;
- accumulated EAR/MIC high durations;
- accumulated total tacts;
- cached left/right milli-samples.

The mixer in `zxnext-audio-mixer.c` asks the beeper for the current averaged
sample, scales EAR and MIC, and emits mixer samples as `frameTacts28` crosses
48 kHz sample positions.

This is directionally similar to the TypeScript beeper. It is also time-weighted
and therefore much better than point sampling. For Next output, Klive correctly
routes EAR and MIC through the mixer and sends the result to both channels.

The caveat is that the mixer sample rate is hardcoded to 48000 Hz. If the actual
browser output device runs at 44100 Hz or another rate, the renderer/worklet
will consume samples at the device rate while the emulator produced a 48 kHz
frame. That can cause slow drift, buffering pressure, dropped samples, or
implicit resampling artifacts.

## Audio quality comparison

For beeper waveform reconstruction:

- zx-go is better.
- Klive is already decent.
- The expected audible gap is small for simple tones, larger for high-frequency
  beeper engines and 1-bit sample playback.

Why zx-go is better:

- It stores all relevant beeper edges and reconstructs exact output sample
  windows.
- It produces a fixed complete audio frame from a complete transition trace.
- It converts sub-sample edge placement into the correct average amplitude
  inside that sample.
- It widens beeper-only audio to a centered stereo signal.
- Its DC blocker has a very low cutoff, so it removes DC without shaving much
  low-frequency beeper content.

Where Klive is better or more flexible:

- Classic WASM can follow the real browser `AudioContext.sampleRate`.
- The TypeScript/Next design already keeps EAR and MIC separate internally,
  which is useful for modelling the Next mixer.
- The accumulator model is cheaper and simpler than keeping per-frame transition
  arrays everywhere.

Overall quality verdict:

Klive's beeper algorithm is good enough to avoid the obvious artifacts of point
sampling, but zx-go's algorithm is better as a reference for clean beeper audio.
I would call Klive's current output slightly worse in reconstruction quality and
classic stereo correctness, while potentially better in host sample-rate
matching on the classic WASM path.

## Recommended Klive changes

1. Use exact sample-window integration for the beeper.

   There are two reasonable ways to do this:

   - Frame reconstruction, zx-go style: record frame-relative EAR/MIC
     transitions during `$FE` writes, then generate the entire audio frame from
     that transition list at frame end.
   - Incremental boundary integration: keep the current accumulator model, but
     when a sample is due, integrate only up to the ideal `audioNextSampleTact`.
     Any time between that boundary and the current CPU tact must remain carried
     forward into the next sample.

   The first option is conceptually simpler and easier to test against zx-go.
   The second option may fit Klive's current per-tact architecture with less
   disruption.

2. Fix classic Spectrum beeper channel output.

   For 48K/128K/+3 classic output, generate one mono beeper level and write it
   to both left and right channels. If Klive wants to preserve the EAR/MIC
   resistor model, integrate the combined level:

   - `00 -> 0.00`
   - `01 -> 0.33`
   - `10 -> 0.66`
   - `11 -> 1.00`

   Then high-pass filter that mono signal and duplicate it to stereo. Keep the
   separate EAR/MIC model for the Next mixer if it is needed there.

3. Relax the DC blocker.

   Replace the fixed `0.995` coefficient with a sample-rate-derived coefficient
   for a low cutoff, roughly 1-2 Hz:

   `R = exp(-2 * pi * cutoffHz / sampleRate)`

   At 44.1 kHz, zx-go's `0.9998` corresponds to roughly 1.4 Hz. This preserves
   low beeper fundamentals and slow square-wave plateaus better than `0.995`.

4. Make ZX Next WASM audio sample rate configurable.

   Classic WASM already receives the browser sample rate. The Next WASM mixer
   should do the same instead of using a fixed `ZXNEXT_AUDIO_SAMPLE_RATE 48000`.
   Otherwise the generated frame length can mismatch the actual Web Audio
   consumption rate.

5. Add focused tests that catch the quality-relevant behavior.

   Suggested tests:

   - A transition exactly halfway through a sample window produces a half-level
     sample.
   - A transition just before and just after a sample boundary lands in the
     correct neighboring sample.
   - Multiple toggles inside one sample window produce the correct duty-cycle
     average.
   - Classic beeper-only output is identical on left and right channels.
   - DC blocker coefficient preserves a low square wave without severe droop.

## Practical implementation direction for Klive

For the least risky improvement, I would start with the TypeScript
`SpectrumBeeperDevice` and classic WASM `zx-spectrum-beeper.c`:

- keep recording transitions at `$FE` write time;
- change sample generation so each sample integrates an exact `[sampleStart,
  sampleEnd)` tact range;
- emit mono mixed samples for classic models;
- reduce the high-pass cutoff.

Once that is stable, apply the same exact-window idea to the ZX Next WASM mixer.
For the Next, preserve separate EAR and MIC source levels up to the mixer, but
make the beeper's averaged values correspond to exact sample windows rather than
"time since the last mixer pull."
