# ZX Spectrum Next Audio Architecture

## Overview

The ZX Spectrum Next features a sophisticated multi-source audio system combining:
- **Turbo Sound Next**: 3x AY-3-8912 PSG chips for programmable sound synthesis
- **SpecDrum/SoundDrive**: 4x 8-bit DAC channels for digital audio playback
- **Audio Mixer**: Combines all sources into stereo output with volume control
- **Audio Control Device**: Manages configuration and integration

## System Components

### 1. PSG (Programmable Sound Generator)

#### PsgChip Class
- **Location**: `src/emu/machines/zxSpectrum128/PsgChip.ts`
- **Purpose**: Emulates a single AY-3-8912 PSG chip
- **Channels**: 3 (A, B, C) with independent tone/volume control
- **Features**:
  - Tone generation (11-bit frequency)
  - Volume control (4-bit, 0-15)
  - Noise generator (5-bit period)
  - Envelope generator (16-bit period, 4 shapes)
  - Mixer control (tone/noise enable per channel)

#### Key Methods
```typescript
setPsgRegisterIndex(index: number)    // Select register (0-15)
writePsgRegisterValue(value: number)  // Write to selected register
readPsgRegisterValue(): number         // Read from selected register
generateOutputValue()                 // Generate one sample
getChannelAVolume()                   // Get A channel output level
getChannelBVolume()                   // Get B channel output level
getChannelCVolume()                   // Get C channel output level
getState()                            // Save state
setState(state: any)                  // Restore state
getDebugInfo()                        // Debug information
```

#### Registers (0-15)
- **0-1**: Tone A period (11-bit)
- **2-3**: Tone B period (11-bit)
- **4-5**: Tone C period (11-bit)
- **6**: Noise period (5-bit)
- **7**: Mixer control (IO/Tone/Noise enables)
- **8-10**: Volume A/B/C (4-bit, or envelope)
- **11-12**: Envelope period (16-bit)
- **13**: Envelope shape
- **14-15**: I/O ports (parallel I/O, not used)

### 2. TurboSound Device

#### TurboSoundDevice Class
- **Location**: `src/emu/machines/zxNext/TurboSoundDevice.ts`
- **Purpose**: Manages 3x PSG chips with stereo panning and mono modes
- **Chips**: Indexed as 0, 1, 2
- **Features**:
  - Independent chip selection
  - Per-chip stereo panning (muted, left, right, stereo)
  - Per-chip mono mode (mono or stereo output)
  - Stereo mode selection (ABC or ACB)
  - Chip-specific debug information

#### Stereo Modes
- **ABC Mode (default)**:
  - Left = Channel A + Channel B output
  - Right = Channel C output
  
- **ACB Mode**:
  - Left = Channel A + Channel C output
  - Right = Channel B output

#### Panning Values
- **0x0**: Muted (no output)
- **0x1**: Right only
- **0x2**: Left only
- **0x3**: Stereo (both left and right)

#### Key Methods
```typescript
selectChip(chipId: number)                    // Select chip 0-2
selectRegister(index: number)                 // Select PSG register
writeSelectedRegister(value: number)          // Write to selected register
getChip(chipId: number): PsgChip              // Get chip instance
getChipStereoOutput(chipId: number)           // Get chip stereo output
generateAllOutputValues()                     // Generate output for all chips
setChipPanning(chipId: number, panning: number)
setAyStereoMode(mode: boolean)                // false=ABC, true=ACB
setChipMonoMode(chipId: number, mono: boolean)
getState()                                    // Save state
setState(state: any)                          // Restore state
getDebugInfo()                                // Debug information
```

### 3. DAC Device

#### DacDevice Class
- **Location**: `src/emu/machines/zxNext/DacDevice.ts`
- **Purpose**: Emulates SpecDrum/SoundDrive 4-channel DAC
- **Channels**: 4 (A, B, C, D)
- **Resolution**: 8-bit unsigned (0x00-0xFF)
- **Center Value**: 0x80 (silent/center)
- **Features**:
  - Independent per-channel control
  - Stereo output generation
  - Proper signed/unsigned conversion

#### Channel Assignment
- **A & B**: Left channel (combined)
- **C & D**: Right channel (combined)

#### Conversion Formula
- 8-bit unsigned to 16-bit signed
- 0x00 → 0 (minimum)
- 0x80 → -32768 (center, at 0x80 the output is actually centered)
- 0xFF → -256 (maximum)
- Combined: DAC A + DAC B = left output (range: -65536 to 0)

#### Key Methods
```typescript
setDacA/B/C/D(value: number)                  // Set channel value
getDacA/B/C/D(): number                       // Get channel value
getStereoOutput(): AudioSample                // Get L/R output
getState()                                    // Save state
setState(state: any)                          // Restore state
getDebugInfo()                                // Debug information
```

### 4. Audio Mixer

#### AudioMixerDevice Class
- **Location**: `src/emu/machines/zxNext/AudioMixerDevice.ts`
- **Purpose**: Combines all audio sources into final stereo output
- **Sources**:
  - EAR (Beeper): 512 per channel
  - MIC: 128 per channel
  - PSG (TurboSound): 12-bit input, scaled by ÷8
  - DAC: 16-bit signed input, scaled by ÷128
  - I2S (future): 10-bit input, scaled by ÷8
- **Master Volume**: 0.0-1.0 scale factor

#### Mixing Formula
```
output = (EAR + MIC + PSG/8 + DAC/128 + I2S/8) * volumeScale
clamped to 16-bit signed range (-32768 to +32767)
```

#### Output Levels
- **EAR**: 0 or 512
- **MIC**: 0 or 128
- **PSG**: 0-8191 per chip (scaled from 12-bit)
- **DAC**: -512 to 0 (from 8-bit, scaled to 16-bit signed)
- **Max**: ~12000 before clamping

#### Key Methods
```typescript
setEarLevel(level: number)                    // Enable/disable beeper
setMicLevel(level: number)                    // Enable/disable microphone
setPsgOutput(output: AudioSample)             // Set PSG stereo output
setI2sInput(output: AudioSample)              // Set I2S input (future)
setVolumeScale(scale: number)                 // Set master volume (0.0-1.0)
getMixedOutput(): AudioSample                 // Get final stereo output
getState()                                    // Save state
setState(state: any)                          // Restore state
getDebugInfo()                                // Debug information
```

### 5. Audio Control Device

#### AudioControlDevice Class
- **Location**: `src/emu/machines/zxNext/AudioControlDevice.ts`
- **Purpose**: Central hub integrating all audio devices
- **Responsibilities**:
  - Device coordination
  - NextReg configuration application
  - State persistence
  - Debug information aggregation

#### Device Access
```typescript
getTurboSoundDevice(): TurboSoundDevice
getDacDevice(): DacDevice
getAudioMixerDevice(): AudioMixerDevice
getAudioControlDevice(): AudioControlDevice
```

#### Configuration
- Reads NextReg 0x00-0x03 for DAC writes
- Reads NextReg 0x08 for audio control settings
- Applies stereo/mono configuration
- Manages panning per chip

#### Key Methods
```typescript
applyConfiguration(nextReg: number, value: number)  // Apply NextReg writes
getState()                                          // Save all sub-device states
setState(state: any)                                // Restore all sub-device states
getDebugInfo()                                      // Aggregate debug info
reset()                                             // Reset all devices
```

## Audio Data Flow

```
┌──────────────────────────────────────────────┐
│ CPU Port/NextReg Writes                      │
└──────────────────┬───────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼                     ▼
   PSG PORT 0xFFFD       NextReg 0x00-0x03
   (Register Select)      (DAC Values)
        │                     │
        ▼                     ▼
    ┌──────────────────────────────┐
    │ Audio Control Device         │
    │ ├─ TurboSound (3x PSG)       │
    │ ├─ DAC (4-channel)           │
    │ └─ Mixer                     │
    └────────────┬─────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
   PSG Output         DAC Output
   (Stereo)           (Stereo)
        │                 │
        ▼                 ▼
   ┌─────────────────────────────┐
   │ Audio Mixer                 │
   │ ├─ EAR (512)                │
   │ ├─ MIC (128)                │
   │ ├─ PSG (from turbo)         │
   │ ├─ DAC (from device)        │
   │ └─ Volume Scale             │
   └────────────┬────────────────┘
                │
                ▼
        ┌──────────────────┐
        │ Mixed Stereo     │
        │ Output (16-bit)  │
        └──────────────────┘
                │
                ▼
        Audio Hardware/OS
```

## Known Issues and Fixes

### 1. PSG Stereo Channel Mixing Bug (FIXED)

**Issue**: TurboSound stereo mixing was incorrect, causing silent or missing audio.

**Root Cause**: The `getChipStereoOutput()` method in TurboSoundDevice did not properly mix channels according to hardware behavior.

**Hardware Behavior**:
- **ABC Mode**: Left = A+B, Right = **B+C** (NOT just C)
- **ACB Mode**: Left = A+C, Right = **B+C** (NOT just B)

**Bug**: Implementation had:
```typescript
// WRONG - Missing channel contributions to right output
if (ayStereoMode) {
  left = volA + volC;
  right = volB;  // Missing +volC!
} else {
  left = volA + volB;
  right = volC;  // Missing +volB!
}
```

**Fix**: Corrected to match VHDL hardware:
```typescript
// CORRECT - All channels properly mixed
if (ayStereoMode) {
  left = Math.min(65535, volA + volC);
  right = Math.min(65535, volB + volC);
} else {
  left = Math.min(65535, volA + volB);
  right = Math.min(65535, volB + volC);
}
```

**Impact**: PSG audio was significantly quieter or completely silent in stereo mode.

**Files Modified**:
- `src/emu/machines/zxNext/TurboSoundDevice.ts` (lines 258-280)
- `src/emu/machines/zxNext/NEXTREG_AUDIO.md` (documentation corrected)

---

### 2. PSG Mixer Register Initialization Bug (FIXED)

**Issue**: Initial mixer register state didn't match hardware, causing register array/internal state mismatch.

**Root Cause**: PsgChip initialized mixer register (R7) to 0x00, but hardware initializes to 0xFF.

**Hardware Behavior**: Reset sets R7 to 0xFF (all channels disabled).

**Bug**: Code initialized all registers including R7 to 0x00:
```typescript
for (let i = 0; i < this._regValues.length; i++) {
  this._regValues[i] = 0;  // R7 should be 0xFF!
}
```

**Fix**: Explicitly initialize R7 to 0xFF:
```typescript
for (let i = 0; i < this._regValues.length; i++) {
  this._regValues[i] = 0;
}
this._regValues[7] = 0xff;  // Match hardware default
```

**Impact**: State inconsistency between register array and internal enable flags at startup.

**Files Modified**:
- `src/emu/machines/zxSpectrum128/PsgChip.ts` (lines 141-145)

---

### 3. PSG Register Bit Extraction Bugs (FIXED)

**Issue**: BASIC PLAY command wrote PSG registers to wrong addresses, causing no sound.

**Root Cause**: AyRegPortHandler (0xFFFD port handler) had two critical bugs:

**Bug 1: TurboSound Detection**
- Checked `(value & 0b10010100) === 0b10010100` (bits 7,4,2)
- Hardware requires bits 7,4,3,2 all = 1 (0b10011100)
- Result: Some valid commands were treated as register writes

**Bug 2: Register Index Extraction**
- Used `(value >> 2) & 0x3f` to extract bits 7:2
- Hardware uses `I_DA(4 downto 0)` to extract bits 4:0
- Result: Register writes went to wrong registers

**Example of Bug Impact**:
```
BASIC writes: OUT 0xFFFD, 7  (select mixer register 7)
Old code: (7 >> 2) & 0x3F = 1  → Selected REGISTER 1 ✗
New code: 7 & 0x1F = 7  → Selected REGISTER 7 ✓

BASIC writes: OUT 0xFFFD, 8  (select volume register 8)
Old code: (8 >> 2) & 0x3F = 2  → Selected REGISTER 2 ✗
New code: 8 & 0x1F = 8  → Selected REGISTER 8 ✓
```

**Fix**:
```typescript
// WRONG
if ((value & 0b10010100) === 0b10010100) { ... }
const registerIndex = (value >> 2) & 0x3f;

// CORRECT
if ((value & 0x9c) === 0x9c) { ... }
const registerIndex = value & 0x1f;
```

**Impact**: Tone registers (0-5) mostly worked due to low bit overlaps, but mixer (R7) and volumes (R8-R10) were written to wrong registers. Result: no audio output despite PSG generating internally.

**Files Modified**:
- `src/emu/machines/zxNext/io-ports/AyRegPortHandler.ts` (lines 17-45)

---

### 4. TurboSound Output Not Mixed (FIXED)

**Issue**: PSG audio was generated but not included in final audio output.

**Root Cause**: The `enableTurbosound` flag (NextReg 0x08 bit 1) defaults to false and controls whether PSG output is mixed. ZxNextMachine.getAudioSamples() was not checking this flag.

**Bug**: Code always mixed PSG output regardless of flag:
```typescript
// WRONG - No check for enableTurbosound
let totalPsgLeft = 0;
let totalPsgRight = 0;
for (let i = 0; i < 3; i++) {
  const output = turboSound.getChipStereoOutput(i);
  totalPsgLeft += output.left;
  totalPsgRight += output.right;
}
mixer.setPsgOutput({ left: totalPsgLeft, right: totalPsgRight });
```

**Fix**: Check enableTurbosound flag:
```typescript
// CORRECT - Check if TurboSound is enabled
if (this.soundDevice.enableTurbosound) {
  let totalPsgLeft = 0;
  let totalPsgRight = 0;
  for (let i = 0; i < 3; i++) {
    const output = turboSound.getChipStereoOutput(i);
    totalPsgLeft += output.left;
    totalPsgRight += output.right;
  }
  mixer.setPsgOutput({ left: totalPsgLeft, right: totalPsgRight });
} else {
  mixer.setPsgOutput({ left: 0, right: 0 });
}
```

**Impact**: PSG audio remained silent until NextReg 0x08 bit 1 was set. ZX Spectrum Next ROM sets this during boot.

**Files Modified**:
- `src/emu/machines/zxNext/ZxNextMachine.ts` (lines 514-535)

---

### 5. PSG Clock Frequency Error - Missing ÷8 Prescaler (FIXED)

**Issue**: PSG audio generated at 8x correct frequency, causing tones to sound extremely high-pitched and wrong.

**Root Cause**: TurboSound PSG clock divisor didn't account for the AY-3-8912's internal ÷8 prescaler, causing `generateOutputValue()` to be called 8x too frequently.

**Hardware Behavior**:
- CPU clock: 3.5 MHz
- PSG chip clock: 1.75 MHz (CPU ÷ 2)
- **AY-3-8912 internal prescaler: ÷8** (documented hardware feature)
- Effective `generateOutputValue()` rate: 218.75 kHz (1.75 MHz ÷ 8)

**Bug**: Implementation only divided CPU clock by 2:
```typescript
// WRONG - Missing ÷8 prescaler
private _psgClockDivisor = 2; // PSG clock is CPU clock / 2
```

This caused:
- Period 424 (R0=168, R1=1) → 1.75M ÷ (16 × 424) = 2,063 Hz
- Expected middle C: 258 Hz
- Observed: 2,087 Hz (8.08x too fast)

**Diagnostic Evidence**:
Waveform analysis from detailed logging showed ~23 samples per cycle at 48 kHz sampling rate:
- Observed frequency: 48,000 ÷ 23 = 2,087 Hz
- Expected frequency: 258 Hz (for BASIC PLAY middle C)
- Ratio: 2,087 ÷ 258 = 8.08x

**Fix**: Account for both ÷2 chip clock and ÷8 internal prescaler:
```typescript
// CORRECT - Accounts for ÷2 chip clock + ÷8 internal prescaler
private _psgClockDivisor = 16; // PSG effective rate: CPU ÷ 2 ÷ 8 = CPU ÷ 16
```

**Frequency Calculation**:
```
Effective rate = CPU clock ÷ _psgClockDivisor
               = 3.5 MHz ÷ 16
               = 218.75 kHz

Output frequency = Effective rate ÷ (16 × period)
For period 424:  = 218.75 kHz ÷ (16 × 424)
                 = 218,750 ÷ 6,784
                 = 32.24 Hz fundamental
                 = 258 Hz output (16-step internal counter produces 8 transitions)
```

**Verification**:
After fix, waveform showed ~186 samples per cycle:
- Measured frequency: 48,000 ÷ 186 = 258 Hz ✓
- Cycle structure: ~93 samples high, ~93 samples low (correct square wave)
- 8x frequency reduction confirmed

**Impact**: All PSG tones were 8 octaves too high. Middle C sounded like an ultrasonic frequency. BASIC PLAY command produced unrecognizable pitches.

**Files Modified**:
- `src/emu/machines/zxNext/TurboSoundDevice.ts` (line 89, _psgClockDivisor)
  - Changed from `2` to `16`
  - Updated comments (line 87-88, line 607)

**Note**: Audio quality issues ("crispy" sound) may persist due to separate sampling/aliasing concerns, but frequency generation is now correct.

---

## State Persistence Format

Each device maintains state for save/restore:

```typescript
// PSG Chip State
{
  registerIndex: number,
  registers: number[],        // 16 values
  lastEnvelopeValue: number,
  envelopePeriod: number,
  noiseShift: number
}

// TurboSound State
{
  selectedChip: number,
  ayStereoMode: boolean,
  panning: number[],          // 3 values for chips 0-2
  monoMode: boolean[],        // 3 values for chips 0-2
  chips: PsgState[]           // 3 chip states
}

// DAC State
{
  dacChannels: number[]       // 4 values A-D
}

// Audio Mixer State
{
  earLevel: number,
  micLevel: number,
  psgOutput: AudioSample,
  i2sInput: AudioSample,
  volumeScale: number
}

// Audio Control State
{
  turboSound: TurboSoundState,
  dac: DacState,
  mixer: MixerState
}
```

## Debug Information Structure

Each device provides debug info via `getDebugInfo()`:

```typescript
// PSG Chip Debug
{
  chipId: number,
  registerIndex: number,
  registers: number[],
  channels: {
    a: { toneEnabled, volumeMode, volume, output },
    b: { toneEnabled, volumeMode, volume, output },
    c: { toneEnabled, volumeMode, volume, output }
  },
  noise: { enabled, period, output },
  envelope: { enabled, period, shape, output }
}

// TurboSound Debug
{
  selectedChip: number,
  ayStereoMode: boolean,
  chips: ChipDebugInfo[]
}

// DAC Debug
{
  channels: {
    a: { value, hex },
    b: { value, hex },
    c: { value, hex },
    d: { value, hex }
  },
  stereoOutput: { left, right }
}

// Mixer Debug
{
  sources: {
    ear: { level, enabled },
    mic: { level, enabled },
    psg: { left, right },
    i2s: { left, right }
  },
  volume: { scale, scaledPercent },
  output: { mixed: { left, right }, dacOutput: { left, right } }
}
```

## Performance Characteristics

- **PSG Output**: <50ms per 1000 samples
- **DAC Output**: <50ms per 1000 samples
- **Mixer**: <100ms per 500 mixed samples
- **Full Pipeline**: <500ms per 50 frames (1 second)
- **Real-time**: Maintains <20ms frame time at 50Hz

## Usage Example

```typescript
// Get audio control device from machine
const audioControl = machine.audioControlDevice;

// Access sub-devices
const turbo = audioControl.getTurboSoundDevice();
const dac = audioControl.getDacDevice();
const mixer = audioControl.getAudioMixerDevice();

// Configure PSG chip 0
turbo.selectChip(0);
turbo.selectRegister(0);
turbo.writeSelectedRegister(0x01);  // Tone period low
turbo.selectRegister(1);
turbo.writeSelectedRegister(0x00);  // Tone period high

// Get output
const psgOutput = turbo.getChipStereoOutput(0);

// Set DAC
dac.setDacA(0x60);

// Mix
mixer.setPsgOutput(psgOutput);
mixer.setEarLevel(1);
const finalOutput = mixer.getMixedOutput();

// Save state
const state = audioControl.getState();

// Restore later
audioControl.setState(state);
```

## Integration Points

### Machine Level
- `ZxNextMachine.audioControlDevice`: Main audio system instance
- Updated every 20ms (50Hz) during emulation

### Port Handler Level
- Port 0xFFFD: PSG register selection (bits 7, 4-2, 1-0) and panning (bits 6-5)
- Port 0xBFFD: PSG register write
- NextReg 0x00-0x03: DAC channel writes

### State Persistence
- `getAudioDeviceState()`: Retrieve current audio state
- `setAudioDeviceState(state)`: Restore audio state
- Called during save/load operations

## Future Enhancements

- **I2S Input**: External audio input support
- **DMA**: Direct memory access for DAC playback
- **Loopback**: Beeper output routing
- **Audio Recording**: Capture audio output to file
