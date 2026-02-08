# ZX Spectrum Next Audio Port Mappings

## Overview

ZX Spectrum Next audio is controlled through dedicated I/O ports and NextRegs. This document details all audio-related port and register access.

## PSG Port Access (0xFFFD)

### Port 0xFFFD - PSG Control & Panning

**Address**: `0xFFFD` (65533 decimal)

**Purpose**: Select PSG chip, register index, and configure panning

**Bit Layout**:
```
Bit 7-6: Panning bits for selected chip
         00 = Muted (no output)
         01 = Right channel only
         10 = Left channel only
         11 = Stereo (both channels)

Bit 5:   Reserved (previously chip selection bit 3)

Bit 4-2: Chip ID (AY-3-8912 instance selection)
         000 = Chip 0 (default, ID 11)
         001 = Chip 1 (ID 10)
         010 = Chip 2 (ID 01)
         Other values: undefined

Bit 1-0: PSG Register Select (combined with bit 4-2)
         Forms 11-bit address when combined with bits 4-2
         Selects one of 16 PSG registers (0-15)
```

**Example Writes**:
```
0xFFFD = 0b11111101 (0xFD)
- Bits 7-6 = 11 (Stereo)
- Bits 4-2 = 110 (Chip 0, Register select)
- Bits 1-0 = 01 (Low bits of register)
→ Select Chip 0, Register 0, Stereo panning

0xFFFD = 0xFE (0b11111110)
- Bits 7-6 = 11 (Stereo)
- Bits 4-2 = 111 (Chip 1, Register select)
- Bits 1-0 = 10 (Low bits of register)
→ Select Chip 1, Register 0, Stereo panning

0xFFFD = 0xFF (0b11111111)
- Bits 7-6 = 11 (Stereo)
- Bits 4-2 = 111 (Chip 2, Register select)
- Bits 1-0 = 11 (Low bits of register)
→ Select Chip 2, Register 1, Stereo panning
```

### Port 0xBFFD - PSG Register Value

**Address**: `0xBFFD` (49149 decimal)

**Purpose**: Write value to currently selected PSG register

**Data**: 8-bit value (0x00-0xFF)

**Operation**:
1. Write to 0xFFFD to select register
2. Write to 0xBFFD with value to set register
3. Read from 0xBFFD to read register value (for input ports)

**Example Sequence**:
```assembly
; Set PSG Channel A tone period to 0x0100
LD A, 0xFD              ; Chip 0, Register 0, Stereo
OUT (0xFFFD), A

LD A, 0x00              ; Low byte of tone period
OUT (0xBFFD), A

LD A, 0xFD              ; Chip 0, Register 1, Stereo (increment register)
OUT (0xFFFD), A

LD A, 0x01              ; High byte of tone period
OUT (0xBFFD), A
```

## NextReg Audio Registers

### NextReg 0x00 - DAC Channel A

**Address**: NextReg 0x00

**Purpose**: 8-bit DAC value for Left channel (SpecDrum/SoundDrive)

**Data**: 0x00-0xFF (8-bit unsigned)
- 0x00 = Minimum (silence, -maximum amplitude)
- 0x80 = Center (silence, zero level)
- 0xFF = Maximum (+maximum amplitude)

**Effect**: Immediately updates DAC Channel A output

### NextReg 0x01 - DAC Channel B

**Address**: NextReg 0x01

**Purpose**: 8-bit DAC value for Left channel (SpecDrum/SoundDrive)

**Data**: 0x00-0xFF (8-bit unsigned)

**Effect**: Immediately updates DAC Channel B output

**Note**: Channels A and B are combined for left stereo output

### NextReg 0x02 - DAC Channel C

**Address**: NextReg 0x02

**Purpose**: 8-bit DAC value for Right channel (SpecDrum/SoundDrive)

**Data**: 0x00-0xFF (8-bit unsigned)

**Effect**: Immediately updates DAC Channel C output

### NextReg 0x03 - DAC Channel D

**Address**: NextReg 0x03

**Purpose**: 8-bit DAC value for Right channel (SpecDrum/SoundDrive)

**Data**: 0x00-0xFF (8-bit unsigned)

**Effect**: Immediately updates DAC Channel D output

**Note**: Channels C and D are combined for right stereo output

### NextReg 0x08 - Audio Control Register

**Address**: NextReg 0x08

**Purpose**: Master audio control and configuration

**Bit Layout**:
```
Bit 7:   Audio Output Enable
         0 = Audio disabled (muted)
         1 = Audio enabled

Bit 6:   PSG Internal Volume Control
         0 = Use PSG output level
         1 = Apply internal volume scaling

Bit 5:   DAC Volume Control
         0 = Use DAC output level
         1 = Apply DAC volume scaling

Bit 4:   PSG Stereo Mode
         0 = ABC mode (A+B left, C right)
         1 = ACB mode (A+C left, B right)

Bit 3-2: Audio Output Route
         00 = Speaker (default)
         01 = Line out
         10 = Headphone
         11 = Reserved

Bit 1:   Mono Mode Enable (applies to all PSG chips)
         0 = Stereo (default)
         1 = Mono (both channels get mixed output)

Bit 0:   EAR/Beeper Enable
         0 = Beeper disabled
         1 = Beeper enabled
```

**Default**: 0x01 (Audio enabled, beeper on, stereo ABC mode)

**Example**:
```
0x08 = 0b10110001 (0xB1)
- Bit 7 = 1 (Audio enabled)
- Bit 6 = 0 (PSG no volume scaling)
- Bit 5 = 1 (DAC volume scaling enabled)
- Bit 4 = 1 (ACB stereo mode)
- Bit 3-2 = 00 (Speaker output)
- Bit 1 = 0 (Stereo mode)
- Bit 0 = 1 (Beeper enabled)
→ Enable audio, ACB mode, speaker output, with DAC scaling
```

## Standard Read/Write Sequences

### PSG Register Write

```assembly
; Write 0x42 to PSG Register 8 (Channel A Volume), Chip 0
; Port 0xFFFD = 0xFD (select chip 0, register 0)
; Port 0xBFFD = write values

LD A, 0xFD              ; Chip 0, Register 0
OUT (0xFFFD), A
LD A, 0x01              ; Move to Register 8 by writing increments
OUT (0xBFFD), A         ; Actually: write tone LSB first
                        ; Then update 0xFFFD for register 8

; Better approach: directly select register 8
LD A, 0x0D              ; 0xFD with bits adjusted for register 8
OUT (0xFFFD), A
LD A, 0x42              ; Volume value
OUT (0xBFFD), A
```

### DAC Sample Write

```assembly
; Write sample to all 4 DAC channels
LD A, 0x60              ; Sample byte
NEXTREG 0x00, A         ; Write to DAC A
LD A, 0x70
NEXTREG 0x01, A         ; Write to DAC B
LD A, 0x50
NEXTREG 0x02, A         ; Write to DAC C
LD A, 0x80
NEXTREG 0x03, A         ; Write to DAC D
```

### Master Volume Control

```assembly
; Set master volume via NextReg 0x08
NEXTREG 0x08, 0xB1      ; Enable audio, beeper, speaker, DAC scaling
```

## Port Address Summary

| Port | Name | Direction | Purpose |
|------|------|-----------|---------|
| 0xFFFD | PSG Select | Out | Select PSG chip/register/panning |
| 0xBFFD | PSG Data | In/Out | Read/Write PSG register |
| NextReg 0x00 | DAC A | Out | Digital audio channel A (left) |
| NextReg 0x01 | DAC B | Out | Digital audio channel B (left) |
| NextReg 0x02 | DAC C | Out | Digital audio channel C (right) |
| NextReg 0x03 | DAC D | Out | Digital audio channel D (right) |
| NextReg 0x08 | Audio Control | Out | Master audio configuration |

## Common Access Patterns

### SpecDrum Playback

```assembly
; Play 8-bit sample on DAC Channel A
LOOP:
  LD A, (IX)              ; Get sample byte from memory
  NEXTREG 0x00, A         ; Write to DAC A
  INC IX
  JP NZ, LOOP
```

### PSG Melody

```assembly
; Play tone on PSG chip 0, channel A
LD A, 0xFD              ; Select chip 0, register 0
OUT (0xFFFD), A

LD A, 0x10              ; Tone period low byte (frequency = 12MHz / (32 * period))
OUT (0xBFFD), A

; Update register for high byte
LD A, 0xFE              ; Select chip 0, register 1
OUT (0xFFFD), A

LD A, 0x00              ; Tone period high byte
OUT (0xBFFD), A

; Enable channel on mixer (register 7)
LD A, 0xFB              ; Select chip 0, register 7
OUT (0xFFFD), A

LD A, 0x3E              ; Mixer: enable tone on A, disable noise
OUT (0xBFFD), A

; Set volume (register 8)
LD A, 0xFC              ; Select chip 0, register 8
OUT (0xFFFD), A

LD A, 0x0F              ; Volume = 15 (maximum)
OUT (0xBFFD), A
```

### Chip Selection & Panning

```assembly
; Select chip 1, stereo panning
LD A, 0xFE              ; 0b11111110
OUT (0xFFFD), A

; Select chip 2, left panning
LD A, 0xFB              ; 0b11111011
OUT (0xFFFD), A

; Select chip 0, right panning
LD A, 0xFD              ; 0b11111101
OUT (0xFFFD), A
```

## Error Conditions

### Invalid Register Access

Attempting to access registers 14-15 will read/write I/O ports (not implemented in emulator).

### Port Timing

PSG port access should follow the standard Z80 timing. The emulator handles all timing automatically.

### NextReg Access

NextReg writes are immediate and affect output on the next sample generation cycle.

## References

- AY-3-8912 PSG: Register definitions at 0xFFFD/0xBFFD
- SpecDrum: Standard 4-channel DAC access via NextRegs
- ZX Spectrum Next Hardware Reference: Port and NextReg documentation
