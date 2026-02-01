# ZX Spectrum Next Audio - NextReg Configuration

## Overview

The ZX Spectrum Next uses NextRegs (Extended Registers) to configure audio subsystem behavior. This document details all NextReg registers used for audio control and DAC playback.

## DAC Channel Registers (0x00-0x03)

### NextReg 0x00 - DAC Channel A (Left)

**Address**: NextReg 0x00

**Mode**: Write-only

**Purpose**: Set 8-bit unsigned digital audio sample for Channel A

**Format**: 8-bit value (0x00-0xFF)

**Encoding**:
- 0x00 = -128 (minimum amplitude, maximum negative)
- 0x80 = 0 (center, silent)
- 0xFF = +127 (maximum amplitude, maximum positive)

**Real-time**: Immediately updates output on next sample period

**Usage**:
```assembly
LD A, 0x60              ; Sample value
NEXTREG 0x00, A         ; Write to DAC A
```

**Mixing**: Channel A combines with Channel B for left stereo output:
- Left output = DAC A + DAC B

### NextReg 0x01 - DAC Channel B (Left)

**Address**: NextReg 0x01

**Mode**: Write-only

**Purpose**: Set 8-bit unsigned digital audio sample for Channel B

**Format**: 8-bit value (0x00-0xFF)

**Mixing**: Combines with Channel A:
- Left output = DAC A + DAC B

### NextReg 0x02 - DAC Channel C (Right)

**Address**: NextReg 0x02

**Mode**: Write-only

**Purpose**: Set 8-bit unsigned digital audio sample for Channel C

**Format**: 8-bit value (0x00-0xFF)

**Mixing**: Channel C combines with Channel D for right stereo output:
- Right output = DAC C + DAC D

### NextReg 0x03 - DAC Channel D (Right)

**Address**: NextReg 0x03

**Mode**: Write-only

**Purpose**: Set 8-bit unsigned digital audio sample for Channel D

**Format**: 8-bit value (0x00-0xFF)

**Mixing**: Combines with Channel C:
- Right output = DAC C + DAC D

## Master Audio Control Register

### NextReg 0x08 - Audio Control and Configuration

**Address**: NextReg 0x08

**Mode**: Read/Write

**Purpose**: Configure master audio settings, enable/disable sources, set routing

**Bit Layout**:
```
┌─────┬─────┬─────┬─────┬──────┬─────┬─────┬─────┐
│ Bit │ 7   │ 6   │ 5   │ 4    │ 3-2 │ 1   │ 0   │
├─────┼─────┼─────┼─────┼──────┼─────┼─────┼─────┤
│ Fn  │ AOE │ PSG │ DAC │ Mode │ Out │ Mono│ Ear │
└─────┴─────┴─────┴─────┴──────┴─────┴─────┴─────┘

AOE:  Audio Output Enable
PSG:  PSG Volume Scale
DAC:  DAC Volume Scale
Mode: Stereo Mode (ABC/ACB)
Out:  Output Routing
Mono: Mono Mode
Ear:  Beeper/EAR Enable
```

#### Bit 7 - Audio Output Enable (AOE)

**Values**:
- 0 = Audio output disabled (muted, silent)
- 1 = Audio output enabled (active)

**Default**: 1 (enabled)

**Effect**: When disabled, all audio outputs are muted regardless of source levels

**Usage**:
```assembly
; Enable audio output
NEXTREG 0x08, 0x81              ; Set bit 7, keep other bits

; Disable audio output
NEXTREG 0x08, 0x01              ; Clear bit 7
```

#### Bit 6 - PSG Volume Scale

**Values**:
- 0 = PSG output at native level
- 1 = PSG output with volume scaling applied

**Default**: 0 (native level)

**Effect**: When enabled, PSG output is scaled by master volume factor

**Usage**:
```assembly
; Enable PSG volume scaling
NEXTREG 0x08, 0xC1              ; Set bit 6
```

#### Bit 5 - DAC Volume Scale

**Values**:
- 0 = DAC output at native level
- 1 = DAC output with volume scaling applied

**Default**: 0 (native level)

**Effect**: When enabled, DAC output is scaled by master volume factor

**Usage**:
```assembly
; Enable DAC volume scaling
NEXTREG 0x08, 0xA1              ; Set bit 5
```

#### Bit 4 - Stereo Mode Selection

**Values**:
- 0 = ABC mode (default)
  - Left = Channel A + Channel B (PSG)
  - Right = Channel C (PSG)
  
- 1 = ACB mode
  - Left = Channel A + Channel C (PSG)
  - Right = Channel B (PSG)

**Default**: 0 (ABC mode)

**Applies to**: All three PSG chips simultaneously

**Usage**:
```assembly
; Switch to ACB mode
LD A, (NEXTREG_ADDR)            ; Read current value
SET 4, A                        ; Set bit 4
OUT (NEXTREG_DATA), A           ; Write back

; Or directly set specific bits
NEXTREG 0x08, 0x91              ; ABC mode (bit 4 = 0)
NEXTREG 0x08, 0xB1              ; ACB mode (bit 4 = 1)
```

#### Bits 3-2 - Audio Output Routing

**Values**:
- 00 = Speaker (default internal speaker)
- 01 = Line out (external line output)
- 10 = Headphone (headphone jack output)
- 11 = Reserved

**Default**: 00 (speaker)

**Effect**: Routes mixed audio to specified output device

**Note**: Actual hardware routing depends on physical connections

**Usage**:
```assembly
; Route to speaker (default)
NEXTREG 0x08, 0x81

; Route to line output
NEXTREG 0x08, 0x85

; Route to headphone
NEXTREG 0x08, 0x89
```

#### Bit 1 - Mono Mode

**Values**:
- 0 = Stereo mode (default)
- 1 = Mono mode

**Default**: 0 (stereo)

**Effect when enabled**:
- Left and right outputs are combined
- All audio sources output to both channels with equal level
- Creates mono playback from stereo sources

**Applies to**: PSG channels only (beeper and DAC always stereo)

**Usage**:
```assembly
; Enable mono mode
NEXTREG 0x08, 0x83              ; Set bit 1

; Disable mono mode (stereo)
NEXTREG 0x08, 0x81              ; Clear bit 1
```

#### Bit 0 - Beeper/EAR Enable

**Values**:
- 0 = Beeper disabled (silent)
- 1 = Beeper enabled (active)

**Default**: 1 (enabled)

**Effect**: Controls whether beeper output (from standard ZX Spectrum OUT 0xFE) is mixed into audio

**Usage**:
```assembly
; Disable beeper (quiet)
NEXTREG 0x08, 0x80

; Enable beeper (normal)
NEXTREG 0x08, 0x81
```

## Common Configuration Examples

### Basic Audio Setup

```assembly
; Initialize audio for PSG + Beeper output
; Enable audio, ABC stereo mode, beeper on, speaker output
NEXTREG 0x08, 0x81
; Bits: 10000001
;       ^ Audio enabled
;        ^ PSG no scaling
;         ^ DAC no scaling
;          ^ ABC mode
;            ^^ Speaker
;              ^ Stereo
;               ^ Beeper enabled
```

### SpecDrum Playback Setup

```assembly
; Enable audio for SpecDrum playback
; Audio on, DAC with volume scaling, speaker output
NEXTREG 0x08, 0xA1
; Bits: 10100001
;       ^ Audio enabled
;        ^ PSG no scaling
;         ^ DAC scaling enabled
;          ^ ABC mode
;            ^^ Speaker
;              ^ Stereo
;               ^ Beeper enabled
```

### Headphone Output

```assembly
; Route to headphone with PSG + beeper
NEXTREG 0x08, 0x89
; Bits: 10001001
;       ^ Audio enabled
;        ^ PSG no scaling
;         ^ DAC no scaling
;          ^ ABC mode
;            ^^ Headphone
;              ^ Stereo
;               ^ Beeper enabled
```

### Mono Mode Playback

```assembly
; Mono output (both channels combined)
NEXTREG 0x08, 0x83
; Bits: 10000011
;       ^ Audio enabled
;        ^ PSG no scaling
;         ^ DAC no scaling
;          ^ ABC mode
;            ^^ Speaker
;              ^ Mono enabled
;               ^ Beeper enabled
```

### ACB Stereo Mode

```assembly
; Switch to ACB stereo mode (A+C left, B right)
NEXTREG 0x08, 0xB1
; Bits: 10110001
;       ^ Audio enabled
;        ^ PSG no scaling
;         ^ DAC no scaling
;          ^ ACB mode (bit 4 = 1)
;            ^^ Speaker
;              ^ Stereo
;               ^ Beeper enabled
```

### Complete Mute

```assembly
; Disable all audio output
NEXTREG 0x08, 0x00
```

## Register State Queries

Reading NextReg 0x08 returns current audio configuration:

```assembly
; Read current audio control state
NEXTREG 0x08               ; Read into accumulator
                           ; Now A contains current state
BIT 0, A                   ; Test if beeper enabled
BIT 4, A                   ; Test if ACB mode
; etc.
```

## DAC Sample Streaming Pattern

```assembly
; Stream audio samples to DAC (all 4 channels)
LD IX, SAMPLES             ; Point to sample buffer
LD B, SAMPLE_COUNT         ; Number of samples

SAMPLE_LOOP:
  LD A, (IX+0)             ; Get sample for DAC A
  NEXTREG 0x00, A
  LD A, (IX+1)             ; Get sample for DAC B
  NEXTREG 0x01, A
  LD A, (IX+2)             ; Get sample for DAC C
  NEXTREG 0x02, A
  LD A, (IX+3)             ; Get sample for DAC D
  NEXTREG 0x03, A
  
  INC IX                   ; Move to next sample
  DJNZ SAMPLE_LOOP
```

## Volume and Level Control

### Master Volume via Scaling

The AudioMixerDevice applies a master volume scale (0.0-1.0) that affects:
- PSG output when bit 6 is set
- DAC output when bit 5 is set

**Scale Examples**:
- 1.0 = 100% (full volume)
- 0.75 = 75% (three-quarter volume)
- 0.5 = 50% (half volume)
- 0.25 = 25% (quarter volume)
- 0.0 = 0% (muted)

### Per-Channel DAC Control

Each DAC channel (0x00-0x03) can be individually controlled by writing sample values:
- Range: 0x00-0xFF
- Center: 0x80
- Linearity: Linear across full range

### Per-Chip PSG Control

PSG volume is controlled via registers 8-10 of each chip:
- Register 8: Channel A volume (4-bit)
- Register 9: Channel B volume (4-bit)
- Register 10: Channel C volume (4-bit)
- Values: 0-15 (0 = muted, 15 = maximum)

## Timing Considerations

- **DAC Updates**: Immediate, take effect on next sample period
- **NextReg Writes**: Applied synchronously with audio generation
- **Port Writes (PSG)**: Processed per Z80 instruction cycle
- **Sample Rate**: 16kHz assumed (50Hz ZX Next frame = 320 samples)

## Error Handling

### Invalid Values

Writing invalid values to NextReg 0x08 will:
- Lower bits beyond defined range are ignored
- Configuration bits are masked to valid range
- Output routing bits default to speaker if reserved value written

### DAC Clipping

DAC values outside 0x00-0xFF are not masked:
- Emulator handles wrapping automatically
- Hardware would require masking in assembly

## State Persistence

NextReg 0x08 and DAC channel values are saved/restored via:
- `audioControlDevice.getState()`: Save complete audio state
- `audioControlDevice.setState(state)`: Restore audio state

## Related Documentation

- See [PORT_MAPPINGS.md](PORT_MAPPINGS.md) for PSG I/O port details
- See [AUDIO_ARCHITECTURE.md](AUDIO_ARCHITECTURE.md) for complete system design
- See sound-plan.md for implementation progress and testing results
