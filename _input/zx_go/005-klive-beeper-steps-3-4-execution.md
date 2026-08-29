# Klive Beeper Plan Execution: Steps 3 and 4

Date: 2026-08-29

## Scope

This note records the execution of steps 3 and 4 from `003-klive-beeper-sample-generation-improvement-plan.md`.

Implemented now:

- Step 3: classic Spectrum beeper output is mono after EAR/MIC resistor mixing.
- Step 4: the DC blocker now uses a sample-rate-derived low cutoff instead of the fixed `0.995` coefficient.

Still not implemented:

- ZX Next WASM runtime-configurable audio sample rate.
- Shared cross-backend tests for more sample rates.
- Full project verification and manual listening tests.
- Non-beeper audio generation changes.

## Step 3: Classic Mono Beeper

Classic TypeScript beeper output now integrates the actual mixed EAR/MIC level per sample segment:

- `00 -> 0.00`
- `01 -> 0.33`
- `10 -> 0.66`
- `11 -> 1.00`

The mixed result is duplicated to both left and right channels before filtering. This fixes the old classic behavior where EAR appeared on the left channel and MIC appeared on the right channel.

ZX Next behavior remains intentionally different. When `SpectrumBeeperDevice` runs with `machineId === "zxnext"`, it still returns independent EAR and MIC duties so `ZxNextMachine` can feed those signals into the FPGA-style mixer separately.

The classic WASM shared beeper path was updated the same way:

- The transition integrator now accumulates the mixed beeper level over the exact sample window.
- One mono DC filter is applied to the beeper signal.
- The filtered mono beeper value is duplicated before any existing per-side extra audio contribution is added.

## Step 4: Sample-Rate-Derived DC Filter

The TypeScript audio base now computes the high-pass coefficient from the configured sample rate:

```text
R = exp(-2 * pi * 1.4 / sampleRate)
```

This replaces the previous fixed `0.995` coefficient. At normal Web Audio sample rates, the new coefficient is much closer to 1.0, so low beeper frequencies keep their plateaus much better while held DC still decays away over time.

The same cutoff was applied to the WASM paths:

- Classic Spectrum WASM beeper uses the configured sample rate.
- ZX Next WASM beeper source levels are high-pass filtered in the audio mixer refresh path.

Because the WASM builds are `-nostdlib`, the C implementation uses a local small-argument approximation for `exp(-x)` rather than linking libm. In the relevant audio sample-rate range, `x = 2*pi*1.4/sampleRate` is tiny, so the approximation tracks the intended formula closely.

## Test Updates

Added or updated tests to check:

- Classic TypeScript beeper output is mono.
- Classic WASM beeper sample pairs are equal.
- MIC contributes to the mono classic mix at the lower level.
- ZX Next TypeScript/WASM tests explicitly opt into `machineId === "zxnext"` for separate EAR/MIC behavior.
- The new DC blocker preserves short held plateaus much better than the old aggressive coefficient, while longer held DC still decays.

## Verification

Focused TypeScript audio tests:

```text
npm test -- --project jsdom test/audio/AudioDeviceBase.test.ts test/audio/BeeperDevice.test.ts test/audio/BeeperMameCompat.test.ts test/audio/BeeperFpga.step22.test.ts
```

Result: 4 test files passed, 117 tests passed.

Focused WASM audio tests:

```text
npm test -- --project jsdom test/wasm/zxSpectrum/wasm-beeper-audio.test.ts test/wasm/zxNext/wasm-next-beeper-audio.test.ts test/wasm/zxNext/wasm-next-audio-mixer.test.ts
```

Result: 3 test files passed, 16 tests passed.

Combined focused beeper/audio suite:

```text
npm test -- --project jsdom test/audio/AudioDeviceBase.test.ts test/audio/BeeperDevice.test.ts test/audio/BeeperMameCompat.test.ts test/audio/BeeperFpga.step22.test.ts test/wasm/zxSpectrum/wasm-beeper-audio.test.ts test/wasm/zxNext/wasm-next-beeper-audio.test.ts test/wasm/zxNext/wasm-next-audio-mixer.test.ts
```

Result: 7 test files passed, 133 tests passed.

TypeScript build check:

```text
npm run build:check
```

Result: passed.

Whitespace check:

```text
git diff --check
```

Result: passed.

## Follow-Up: PSG-Named DC Filter Tests

After the step 4 filter change, the PSG cross-check suite still contained three assertions hardcoded to the old `0.995` high-pass coefficient. The PSG core itself was not broken; the failing tests were in the shared `AudioDeviceBase` DC filter checks stored in `test/audio/PsgCrossCheck.step912.test.ts`.

Those assertions now compute the expected coefficient with the same 1.4 Hz cutoff formula:

```text
R = exp(-2 * pi * 1.4 / sampleRate)
```

The long-held DC decay assertion was also adjusted to run enough samples for the gentler cutoff to decay near zero.

Additional verification after this follow-up:

```text
npm test -- --project jsdom test/audio/PsgChip.step1.test.ts test/audio/PsgDevice.step3.test.ts test/audio/PsgVolumePeriod.step34.test.ts test/audio/PsgCrossCheck.step912.test.ts test/audio/PsgCompatibility.step14.test.ts test/audio/PsgRegisterMasking.step78.test.ts test/audio/TurboSoundDevice.step2.test.ts test/audio/TurboSoundDevice.step4.test.ts test/audio/TurboSoundTesting.step15.test.ts test/audio/AudioMixerDevice.step8.test.ts test/audio/AudioControlDevice.step9.test.ts test/audio/PortHandlers.step10.test.ts test/audio/DacPlayback.step16.test.ts
```

Result: 12 test files passed, 372 tests passed.

Combined beeper plus PSG/TurboSound verification:

```text
npm test -- --project jsdom test/audio/AudioDeviceBase.test.ts test/audio/BeeperDevice.test.ts test/audio/BeeperMameCompat.test.ts test/audio/BeeperFpga.step22.test.ts test/wasm/zxSpectrum/wasm-beeper-audio.test.ts test/wasm/zxNext/wasm-next-beeper-audio.test.ts test/wasm/zxNext/wasm-next-audio-mixer.test.ts test/audio/PsgChip.step1.test.ts test/audio/PsgDevice.step3.test.ts test/audio/PsgVolumePeriod.step34.test.ts test/audio/PsgCrossCheck.step912.test.ts test/audio/PsgCompatibility.step14.test.ts test/audio/PsgRegisterMasking.step78.test.ts test/audio/TurboSoundDevice.step2.test.ts test/audio/TurboSoundDevice.step4.test.ts test/audio/TurboSoundTesting.step15.test.ts test/audio/AudioMixerDevice.step8.test.ts test/audio/AudioControlDevice.step9.test.ts test/audio/PortHandlers.step10.test.ts test/audio/DacPlayback.step16.test.ts test/wasm/zxSpectrum/wasm-psg-audio.test.ts test/wasm/zxNext/wasm-next-psg-audio.test.ts
```

Result: 21 test files passed, 532 tests passed.

## Current Assessment

Steps 3 and 4 address the two main remaining beeper-quality problems after exact-window timing:

- classic machines now produce centered mono beeper audio instead of artificial channel separation;
- the DC blocker should preserve low-frequency beeper tone better, because it no longer decays plateaus as quickly as the old fixed coefficient.

The next major remaining item is step 5: making ZX Next WASM audio sample rate configurable instead of fixed at 48 kHz.
