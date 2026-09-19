# Audio System Test Suite

Audio coverage for shared audio primitives, the Spectrum beeper, the ZX Spectrum Next's
TurboSound/DAC/mixer devices, and Z88 beeper integration. Classic Spectrum 128K/+3E PSG
behavior is covered by the WASM Spectrum tests. The Next's PSG itself (`zxNext/NextPsgChip.ts`,
a port of `ym2149.vhd`) is tested against the hardware on both cores by
`test/zxnext-hw/audio/ay-psg.test.ts`; the MAME-shaped `PsgChip` and its unit tests were retired.

## Test Statistics

| Component | Tests | Status | Coverage |
|-----------|-------|--------|----------|
| AudioDeviceBase | 21 | ✅ Passing | Sample rate math, tact-based timing, clock multipliers |
| SpectrumBeeperDevice | 29 | ✅ Passing | EAR bit control, square waves, frame handling |
| Z88 Audio Integration | 2 | ✅ Passing | Z88 beeper sample generation |

## File Descriptions

### AudioDeviceBase.test.ts (21 tests)
Tests the abstract base class that implements core audio timing logic.

**Key Tests:**
- Sample rate calculation (11kHz → 48kHz): Validates `sampleLength = baseClockFrequency / sampleRate`
- Tact-based generation: Ensures samples generated at correct intervals
- Clock multiplier support: Tests 1x, 2x, 4x multipliers
- Frame boundary behavior: Samples reset at frame start
- Multiple sample generation: Accumulation across tacts

**Dependencies:**
- `AudioDeviceBase` class
- `IAnyMachine` interface
- Mock machine with controllable tacts

### BeeperDevice.test.ts (29 tests)
Tests the simple EAR bit-based beeper device.

**Key Tests:**
- EAR bit control: 1.0 when on, 0.0 when off
- Square wave generation: Rapid on/off transitions
- Frame operation: ~869 samples per frame at 44.1kHz
- Reset behavior: Clear samples and state
- Multi-rate support: Tests all standard sample rates
- Inheritance chain: AudioDeviceBase integration
- Realistic scenarios: Game beeps, modulation patterns

**Dependencies:**
- `SpectrumBeeperDevice` implementation
- `AudioDeviceBase` timing logic

### AudioIntegration.test.ts (2 tests)
Tests Z88 beeper integration.

**Key Test Categories:**

1. **Z88 Beeper Samples**
   - Audio sample shape
   - Sample generation across EAR bit changes

## Core Audio Architecture

### Sample Rate Math
```
sampleLength = baseClockFrequency / sampleRate
baseClockFrequency = 3,546,900 Hz

Examples:
- 11.025 kHz: sampleLength = 322 tacts
- 22.050 kHz: sampleLength = 161 tacts
- 44.100 kHz: sampleLength = 80.5 tacts (~869 samples/frame)
- 48.000 kHz: sampleLength = 73.89 tacts (~948 samples/frame)
```

### Beeper Device
```
Output: 1.0 (on) or 0.0 (off) based on EAR bit
Timing: Sample generated every sampleLength tacts
Frame: ~69,888 tacts → ~869 samples at 44.1kHz
```

### Machine Audio Mixing
```typescript
getAudioSamples(): number[] {
  const beeperSamples = this.beeperDevice.getAudioSamples();
  const psgSamples = this.psgDevice.getAudioSamples();
  const samplesCount = Math.min(beeperSamples.length, psgSamples.length);
  return beeperSamples.map((b, i) => b + psgSamples[i]);
}
```

## Running Tests

### Run All Audio Tests
```bash
npm test -- test/audio/
```

### Run Specific Test File
```bash
npm test -- test/audio/AudioDeviceBase.test.ts
npm test -- test/audio/BeeperDevice.test.ts
npm test -- test/audio/AudioIntegration.test.ts
```

### Run with Coverage
```bash
npm test -- test/audio/ --coverage
```

### Watch Mode
```bash
npm test -- test/audio/ --watch
```

## Test Coverage Summary

✅ **Core Timing**: AudioDeviceBase ensures sample generation at correct intervals
✅ **Beeper Implementation**: EAR bit correctly produces 1.0/0.0 based on state
✅ **PSG Implementation**: see `test/zxnext-hw/audio/ay-psg.test.ts` (both Next cores)
✅ **Frame Handling**: Correct sample counts (~869/frame at 44.1kHz)
✅ **Clock Multipliers**: 1x, 2x, 4x supported across all devices
✅ **Multi-rate Support**: 11kHz, 22kHz, 44.1kHz, 48kHz validated
✅ **Integration**: Beeper + PSG mixing at machine level
✅ **Edge Cases**: Reset, extreme rates, all channels simultaneous
✅ **Realistic Scenarios**: Game audio, modulation, rapid changes

## Refactoring Safety

These 108 tests provide a comprehensive safety net for audio generation refactoring:

1. **Timing Logic**: Validate changes to sample generation intervals
2. **Device Output**: Ensure beeper and PSG produce expected values
3. **Frame Handling**: Protect frame boundary behavior
4. **Mixing Logic**: Verify beeper + PSG combination remains correct
5. **Real-world Scenarios**: Test actual game audio patterns

All tests pass consistently (212ms total execution time) and follow vitest best practices.

## Key Methods Tested

- `setAudioSampleRate(rate)`: Sample timing calculation
- `setNextAudioSample()`: Sample generation trigger logic
- `getCurrentSampleValue()`: Device-specific sample values
- `calculateCurrentAudioValue()`: PSG output calculation
- `onNewFrame()`: Frame boundary reset/prep
- `getAudioSamples()`: Sample array retrieval
- `setEarBit(state)`: Beeper on/off control
- `setPsgRegisterIndex(idx)` / `writePsgRegisterValue(val)`: PSG configuration
- `reset()`: Device state reset

## Integration with Existing Codebase

**Source Files Tested:**
- `src/emu/machines/AudioDeviceBase.ts`: Abstract base class
- `src/emu/machines/BeeperDevice.ts`: Beeper implementation
- `src/emu/machines/zxNext/TurboSoundDevice.ts` / `NextPsgChip.ts`: the Next PSGs (TurboSound tests)
- `src/emu/machines/z88/Z88BeeperDevice.ts`: Z88 beeper implementation

**Test Infrastructure:**
- MockMachine class: Simulates machine tact timing
- TestAudioDevice: Extends AudioDeviceBase for testing
- Vitest framework: Modern test runner with TypeScript support

## Future Test Enhancements

Potential areas for additional testing:
- WebAudio worklet integration (if exposable for testing)
- Ring buffer behavior (if needed for audio refactoring)
- Audio latency/timing accuracy measurements
- Performance benchmarks under heavy audio load
- Extended frame sequences (multi-minute recording)
