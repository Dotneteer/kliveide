# ZX Spectrum Next Sound Implementation Plan

## Execution Flow
Each implementation step follows this process:
1. Implement the functionality
2. Create unit tests
3. Verify new tests pass
4. Verify all ZX Spectrum Next tests pass
5. Mark step complete
6. Request approval for next step

## Overview
The ZX Spectrum Next features Turbo Sound Next (3x AY-3-8912 PSG chips) and 4x 8-bit DAC channels for digital audio playback. This plan builds upon the existing AY-3-8912 PSG implementation.

## Architecture Components

### 1. Three AY-3-8912 PSG Chips (Turbo Sound Next)
- **AY Chip 0** (default, id=11)
- **AY Chip 1** (id=10)
- **AY Chip 2** (id=01)
- Each chip has 3 channels (A, B, C)
- Stereo output with configurable panning per chip
- Individual mono mode support per chip
- Selectable stereo modes: ABC or ACB
- Clock: Generated every 16 ULA tacts (PSG_CLOCK_STEP)

### 2. Four 8-bit DAC Channels (SpecDrum/SoundDrive)
- **DAC A** - Left channel
- **DAC B** - Left channel
- **DAC C** - Right channel
- **DAC D** - Right channel
- 8-bit unsigned values (0x00-0xFF, centered at 0x80)
- Direct CPU writes via I/O ports or NextRegs

### 3. Audio Mixer
- Combines all sound sources:
  - Beeper (EAR) - 512 level
  - MIC - 128 level
  - 3x AY chips (stereo) - up to 2295 per chip
  - 4x DAC channels - up to 2040 (scaled from 510)
  - External I2S input (future) - up to 1023
- Output range: 0-5998 per channel (13-bit)

## Implementation Steps

### Step 1: Extend PsgChip to Support Multiple Instances
- Modify `PsgChip.ts` to add chip ID property
- Update state to track which chip is selected
- Test: Verify single PSG still works correctly

**Status: ✅ COMPLETED**

**Implementation Summary:**
- Added `readonly chipId: number` property to PsgChip class
- Constructor now accepts optional `chipId` parameter (0-3), defaults to 0
- Chip ID is masked to 2 bits to support 0-3 range
- Each chip instance maintains independent state for all registers, tone counters, envelope state, and orphan samples

**Tests Created:** `test/audio/PsgChip.step1.test.ts` (15 tests)
- Chip ID initialization and masking tests
- Backward compatibility with default chip 0
- Independent state verification for multiple chips
- Multi-chip array pattern support

**Test Results:**
- ✓ All 15 new tests pass
- ✓ All 41 existing PsgDevice tests pass  
- ✓ All 123 audio tests pass
- ✓ Backward compatibility verified

### Step 2: Create TurboSoundDevice
- Create `src/emu/machines/zxNext/TurboSoundDevice.ts`
- Implement 3 PSG chip instances
- Add chip selection logic (port 0xFFFD bits 7,4-0)
- Add per-chip panning control (bits 6:5)
- Test: Verify chip selection and isolation

**Status: ✅ COMPLETED**

**Implementation Summary:**
- Created `TurboSoundDevice` class managing 3 PsgChip instances (chip IDs 0, 1, 2)
- Chip selection command format: bit 7 = 1, bits 4:2 = 111 (matches VHDL specification)
  - Bits 1:0 select chip: 11=0, 10=1, 01=2, 00=reserved
  - Bits 6:5 control panning: 00=muted, 01=right, 10=left, 11=stereo
- Panning stored per-chip and maintained across chip switches
- Direct chip access methods for testing and internal use
- Orphan sample tracking per chip
- Full register isolation between chips

**Tests Created:** `test/audio/TurboSoundDevice.step2.test.ts` (29 tests)
- Chip initialization and selection validation
- Panning control and persistence
- Register operations with isolation
- Direct chip access methods
- Output generation
- Orphan sample management
- Complex scenarios (rapid switching, mixed commands, panning persistence)

**Test Results:**
- ✓ All 29 new tests pass
- ✓ All 15 Step 1 tests still pass
- ✓ All 152 audio tests pass
- ✓ Full backward compatibility maintained

### Step 3: Implement PSG Stereo Mixing
- Add ABC/ACB stereo mode support
- Implement mono mode per chip
- Add channel mixing logic per chip:
  - Left = A + (B or C depending on mode)
  - Right = (B or C) + C
- Test: Verify stereo separation and mixing

**Status: ✅ COMPLETED**

**Implementation Summary:**
- Extended `PsgChip` with three new methods:
  - `getChannelAVolume()` - Returns current channel A output (0-65535)
  - `getChannelBVolume()` - Returns current channel B output (0-65535)
  - `getChannelCVolume()` - Returns current channel C output (0-65535)
  - Each method applies tone/noise enabling, volume scaling, and envelope modulation
- Extended `TurboSoundDevice` with stereo/mono mode support:
  - `_ayStereoMode` property (false=ABC, true=ACB)
  - `_chipMonoMode` array (per-chip mono enable)
  - `getAyStereoMode()`, `setAyStereoMode()` methods
  - `getChipMonoMode()`, `setChipMonoMode()` methods
  - `getChipStereoOutput()` method implementing complete mixing logic:
    - **Mono mode**: All channels sum to both left and right (clamped at 65535)
    - **ABC mode**: Left = A+B, Right = C
    - **ACB mode**: Left = A+C, Right = B
  - Reset() properly initializes all modes to defaults (ABC, stereo)

**Mixing Algorithm Details:**
- Per-channel volumes obtained via new PsgChip methods
- Each method calculates channel output considering:
  - Tone/noise enable flags
  - Current output bit state
  - Volume level (0-15)
  - Envelope mode and position (if enabled)
  - Uses existing volume table for 0-65535 conversion
- Mixing combines volumes per stereo/mono mode
- Combined volumes clamped at 65535 maximum

**Tests Created:** `test/audio/TurboSoundDevice.step3.test.ts` (31 tests)
- Stereo mode control (ABC/ACB switching)
- Mono mode per-chip control and independence
- Stereo output in ABC mode (A+B=Left, C=Right)
- Stereo output in ACB mode (A+C=Left, B=Right)
- Mono output (all channels to both L/R)
- Mono override of stereo routing
- Multiple chips with different modes
- Output clamping at 65535
- Mode switching during operation
- Integration with existing chip selection/panning
- Orphan sample interaction
- Edge cases (rapid toggles, zero output, noise mixing)

**Test Results:**
- ✓ All 31 new tests pass
- ✓ All 29 Step 2 tests still pass
- ✓ All 15 Step 1 tests still pass
- ✓ All 183 audio tests pass (41 PsgDevice + 29 TurboSound + 21 AudioBase + 17 Integration + 15 Step1 + 29 Step2 + 31 Step3 + 29 Beeper)
- ✓ Full backward compatibility maintained

### Step 4: Implement PSG Pan Control
- Add per-chip left/right channel enable
- Implement output muting when channels disabled
- Test: Verify panning works per chip

### Step 5: Create DAC Device
- Create `src/emu/machines/zxNext/DacDevice.ts`
- Implement 4x 8-bit DAC channels
- Initialize to 0x80 (center value)
- Test: Basic DAC value storage

### Step 6: Implement DAC I/O Ports
- Add port handlers for all DAC ports:
  - 0x1F, 0xF1, 0x3F → DAC A
  - 0x0F, 0xF3 → DAC B
  - 0xDF, 0xFB → DAC A+D
  - 0xB3 → DAC B+C
  - 0x4F, 0xF9 → DAC C
  - 0x5F → DAC D
- Test: Verify port writes update correct DACs

### Step 7: Implement DAC NextReg Mirrors
- Add NextReg 0x2C support (mono - DAC A+D write)
- Add NextReg 0x2D support (left - DAC B write)
- Add NextReg 0x2E support (right - DAC C write)
- Test: Verify NextReg writes update correct DACs

### Step 8: Create Audio Mixer
- Create `src/emu/machines/zxNext/AudioMixerDevice.ts`
- Implement mixing formula:
  - EAR contribution: 0 or 512
  - MIC contribution: 0 or 128
  - Scale AY output (12-bit to 13-bit)
  - Scale DAC output (9-bit to 13-bit by <<2)
- Test: Verify all sources contribute correctly

### Step 9: Integrate NextReg Control Registers
- Update `NextRegDevice.ts`:
  - Reg 0x06 bits 1:0 - PSG mode (YM/AY/ZXN-8950/Reset)
  - Reg 0x08 bit 5 - AY stereo mode (ABC/ACB)
  - Reg 0x08 bit 3 - Enable 8-bit DACs
  - Reg 0x08 bit 1 - Enable TurboSound
  - Reg 0x09 bits 7:5 - Mono mode per AY chip
- Test: Verify configuration changes take effect

### Step 10: Integrate Port Handlers
- Update port handler in `ZxNextMachine.ts`:
  - Port 0xFFFD - AY register select & chip select
  - Port 0xBFFD - AY data read/write
  - Port 0xBFF5 - AY info read (chip id, register)
  - All DAC ports
- Test: Verify port reads/writes route correctly

### Step 11: Update Audio Sampling
- Modify audio device to call TurboSound and DAC devices
- Generate PSG samples every 16 ULA tacts
- Mix all sources through AudioMixer
- Maintain sample timing and orphan sample handling
- Test: Verify audio timing and sample generation

### Step 12: Add State Persistence
- Add TurboSound state to machine state
- Add DAC state to machine state
- Add mixer state to machine state
- Implement reset() for all devices
- Test: Verify save/load state works

### Step 13: Add Debug Support
- Add PSG chip state inspection
- Add DAC channel value inspection
- Add mixer level inspection
- Add audio enable/disable flags visibility
- Test: Verify debug info displays correctly

### Step 14: Testing - Single PSG Compatibility
- Test existing ZX Spectrum 128 programs
- Verify backward compatibility
- Test chip 0 default selection
- Test: Existing 128K software works unchanged

### Step 15: Testing - TurboSound
- Test multi-chip selection via port 0xFFFD
- Test stereo panning per chip
- Test ABC/ACB stereo modes
- Test mono mode per chip
- Test: TurboSound software works correctly

### Step 16: Testing - DAC Playback
- Test SpecDrum software
- Test SoundDrive software
- Test sample playback at various rates
- Test NextReg mirror writes
- Test: DAC playback is audible and correct

### Step 17: Testing - Audio Mixing
- Test combined beeper + PSG
- Test combined PSG + DAC
- Test all sources simultaneously
- Verify no clipping (max 5998)
- Test: All sources mix without distortion

### Step 18: Performance Optimization
- Profile audio generation performance
- Optimize PSG clock step calculations
- Optimize mixing operations
- Cache frequently accessed values
- Test: Audio maintains real-time performance

### Step 19: Documentation
- Document port mappings
- Document NextReg usage
- Document audio architecture
- Add code comments
- Update machine documentation

### Step 20: Final Integration Testing
- Test complete ZX Next programs using sound
- Test edge cases (rapid chip switching, etc.)
- Test reset behavior
- Verify all configuration modes
- Test: Complete audio subsystem works correctly
