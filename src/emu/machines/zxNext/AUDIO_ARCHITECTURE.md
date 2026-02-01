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
