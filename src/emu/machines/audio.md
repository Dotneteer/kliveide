# Audio Generation Testing Status

## Current State
Core audio components have dedicated unit coverage:
- `AudioDeviceBase`
- `SpectrumBeeperDevice`

Classic ZX Spectrum PSG device integration now lives in the WASM machine
implementations. The ZX Spectrum Next's TurboSound uses `zxNext/NextPsgChip.ts`, a port of
`ym2149.vhd` (2026-09-18, bug B73), tested on both cores by `test/zxnext-hw/audio/ay-psg.test.ts`.
The MAME-shaped TypeScript `PsgChip` (and its unit tests) was retired once nothing used it.

## Test Gaps

### Critical Untested Functionality
1. **Sample Rate Calculation** (`setAudioSampleRate`)
   - `_audioSampleLength = baseClockFrequency / sampleRate`
   - Timing of `_audioNextSampleTact` increments

2. **Beeper Sample Generation**
   - EAR bit on/off produces correct 1.0/0.0 values
   - Frame-based sample accumulation
   - Clock-based sampling intervals

3. **PSG Sample Generation**
   - 16-tact PSG clock division
   - 3-channel tone generation (A, B, C)
   - Noise generator LFSR
   - Envelope generation (16 shapes)
   - Orphan sample accumulation/averaging
   - Volume table conversion

4. **Sample Mixing** (`getAudioSamples`)
   - Beeper + PSG summing
   - Array length handling

## Recommended Basic Tests

### AudioDeviceBase Tests
```typescript
- Sample rate → sample length conversion
- Frame boundary behavior (onNewFrame clears samples)
- Tact-based triggering (setNextAudioSample timing)
- Clock multiplier effects
```

### Beeper Tests  
```typescript
- EAR bit false → 0.0 sample
- EAR bit true → 1.0 sample
- Sample count per frame at various rates
- Correct sample timing relative to CPU tacts
```

### PSG Tests
```typescript
- Single tone channel frequency → sample pattern
- Noise generator output distribution
- Envelope shape generation
- Orphan sample averaging accuracy
- Volume table lookup correctness
- Mixed output (tone + noise) on channel
```

### Integration Tests
```typescript
- WASM-backed Spectrum audio sample generation
- Full frame generation at 44.1kHz
- Beeper + PSG simultaneous output
```

## Test Infrastructure Needs
- Mock machine with controllable `tacts`, `currentFrameTact`
- Helpers to advance tacts and collect samples
- Sample pattern validators (square wave, noise distribution)
- Timing validators (samples/frame accuracy)

## Current Tests Created

### AudioDeviceBase Tests ✓ (21 tests passing)
Location: `test/audio/AudioDeviceBase.test.ts`

**Coverage:**
- Sample Rate Setup: Rate storage, sample length calculations (11kHz-48kHz)
- Frame Boundary: Sample clearing, device reset
- Tact-Based Triggering: Sample generation thresholds, accumulation
- Clock Multiplier: 1x/2x multiplier effects on intervals
- Sample Values: Value retrieval, negative values, accumulation
- Integration: Full frame simulation, multi-rate testing

### SpectrumBeeperDevice Tests ✓ (29 tests passing)
Location: `test/audio/BeeperDevice.test.ts`

**Coverage:**
- EAR Bit Control: On/off states, toggles
- Sample Generation: 1.0 (on) / 0.0 (off) values, transitions
- Square Wave Pattern: Pattern accuracy, frequency consistency
- Frame Operation: Multi-frame handling, ~869 samples/frame at 44.1kHz
- Reset Behavior: Sample clearing, EAR bit state preservation
- Sample Rates: 11kHz, 22kHz, 44.1kHz, 48kHz compatibility
- Clock Multiplier: Timing effects
- Rapid Changes: Fast on/off transitions, silence, continuous tone
- Inheritance: AudioDeviceBase method chain
- Realistic Scenarios: Beep effects, audio modulation simulation

## Test Statistics
- **Total Tests**: See the current jsdom audio test run
- **Test Files**: 3
- **Coverage**: AudioDeviceBase + SpectrumBeeperDevice (Next PSG: `test/zxnext-hw/audio/ay-psg.test.ts`)

Run all audio tests: `npm test -- test/audio/`

## Next Steps
- Integration tests (machine mixing: Beeper + PSG)
- Edge cases and error conditions
- Performance benchmarks

## Notes
DMA-paced DAC playback is tested on both cores in `test/zxnext-hw/dma/dma.test.ts` (DMA-020).
