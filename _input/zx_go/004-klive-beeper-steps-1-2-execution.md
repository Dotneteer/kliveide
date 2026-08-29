# Klive Beeper Plan Execution: Steps 1 and 2

Date: 2026-08-29

## Scope

This note records the execution of steps 1 and 2 from `003-klive-beeper-sample-generation-improvement-plan.md`.

Implemented now:

- Step 1: add characterization tests for the current useful beeper behavior and the desired exact sample-window behavior.
- Step 2: replace late-poll beeper averaging with exact sample-window integration.

Not implemented yet:

- Classic Spectrum mono beeper mixing.
- Gentler DC handling / high-pass behavior changes.
- ZX Next beeper sample-rate configurability.
- Broader manual audio listening tests.
- Non-beeper audio generator work.

## Step 1: Characterization Tests

Added focused tests around the timing behavior that matters for beeper quality:

- The audio scheduler now asks devices for the ideal sample boundary when the emulator notices a sample late.
- A beeper transition inside a sample contributes only to the part of the sample window where that output level was active.
- A transition exactly at a sample boundary belongs to the following sample, avoiding double counting or boundary smear.
- Multiple toggles within one sample are averaged by exact duty cycle.
- Existing MAME/FPGA compatibility tests still cover current amplitude and normalization behavior.

These tests protect the core improvement without changing the broader beeper personality yet.

## Step 2: Exact Sample-Window Integration

The TypeScript beeper now stores timestamped EAR/MIC transitions and integrates over the exact interval `[previousSampleBoundary, currentSampleBoundary)`.

Before this change, Klive's beeper could average over too much time when the CPU/device loop observed a sample after the ideal boundary. That created a subtle timing smear: a transition that happened after the sample boundary could influence the earlier sample.

After this change:

- `AudioDeviceBase` schedules the first sample at the first real sample boundary instead of frame tact 0.
- `AudioDeviceBase` passes the ideal sample-end tact to `getCurrentSampleValue`.
- `BeeperDevice` integrates queued transitions only up to that sample-end tact.
- Transitions exactly at the sample boundary are kept for the next sample.
- The previous EAR/MIC amplitude split and FPGA-style output shape are preserved for now, so this step improves timing accuracy without changing the larger sound model.

The same exact-window approach was mirrored into the WASM beeper paths:

- ZX Spectrum 48K common beeper code.
- ZX Spectrum 128K common beeper integration.
- ZX Spectrum +3E common beeper integration.
- ZX Next beeper and audio mixer scheduling.

For ZX Next WASM, the mixer now also starts at the first real sample boundary rather than emitting a frame-zero sample. The corresponding unit-test expectation was updated.

## Verification

Focused TypeScript audio tests:

```text
npm test -- --project jsdom test/audio/AudioDeviceBase.test.ts test/audio/BeeperDevice.test.ts test/audio/BeeperMameCompat.test.ts test/audio/BeeperFpga.step22.test.ts
```

Result: 4 test files passed, 116 tests passed.

Focused WASM audio tests:

```text
npm test -- --project jsdom test/wasm/zxSpectrum/wasm-beeper-audio.test.ts test/wasm/zxNext/wasm-next-beeper-audio.test.ts test/wasm/zxNext/wasm-next-audio-mixer.test.ts
```

Result: 3 test files passed, 16 tests passed.

Combined focused beeper/audio suite:

```text
npm test -- --project jsdom test/audio/AudioDeviceBase.test.ts test/audio/BeeperDevice.test.ts test/audio/BeeperMameCompat.test.ts test/audio/BeeperFpga.step22.test.ts test/wasm/zxSpectrum/wasm-beeper-audio.test.ts test/wasm/zxNext/wasm-next-beeper-audio.test.ts test/wasm/zxNext/wasm-next-audio-mixer.test.ts
```

Result: 7 test files passed, 132 tests passed.

TypeScript build check:

```text
npm run build:check
```

Result: passed.

## Current Assessment

Steps 1 and 2 keep Klive's current advantages where they already exist:

- per-channel EAR/MIC preservation,
- floating-point sample values,
- existing beeper amplitude calibration,
- existing FPGA-style and MAME compatibility coverage.

They fix the main weakness identified against zx-go for beeper timing:

- Klive now integrates beeper output over the intended audio sample window instead of over the time elapsed until the emulator happens to pull the sample.

The remaining audio-quality differences intentionally remain for later plan steps.
