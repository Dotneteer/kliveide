# ZX Spectrum Next Audio Architecture - Hardware Specification

**Document Status:** Hardware-Accurate Specification  
**Source:** VHDL source code from ZX Spectrum Next FPGA implementation  
**Last Updated:** February 8, 2026

## Overview

This document describes the **exact hardware behavior** of the ZX Spectrum Next audio subsystem as implemented in VHDL. All information has been extracted from the official FPGA source code to ensure 100% compliance.

**CRITICAL FINDING:** The hardware uses **UNSIGNED values exclusively** throughout the entire audio pipeline. There is NO signed audio representation in the PSG chip, TurboSound device, or audio mixer hardware. All mixing is performed using simple unsigned integer addition.

## Hardware Audio Components

### 1. PSG Chip (YM2149/AY-3-8910)

**Hardware Implementation:** `_input/next-fpga/src/audio/ym2149.vhd`

#### Output Format
- **Per-channel output:** 8-bit unsigned integer (0-255)
- **Channels:** A, B, C (independent outputs)
- **Data type:** `std_logic_vector(7 downto 0)` (VHDL unsigned)

```vhdl
O_AUDIO_A : out std_logic_vector(7 downto 0);
O_AUDIO_B : out std_logic_vector(7 downto 0);
O_AUDIO_C : out std_logic_vector(7 downto 0);
```

#### Volume Tables
- **YM mode:** Uses `volTableYm` with 5-bit volume index (0-31)
- **AY mode:** Uses `volTableAy` with 4-bit volume index (0-15)
- Both tables output 8-bit unsigned values representing amplitude

#### Channel Mixing (Within Single Chip)
Each PSG channel can be:
- **Tone enabled:** Square wave output based on tone frequency
- **Noise enabled:** Pseudo-random output based on noise generator
- **Envelope enabled:** Amplitude modulated by envelope generator
- **Disabled:** Output is 0

**Output value per clock:**
```vhdl
O_AUDIO_A <= std_logic_vector(volTableYm(to_integer(unsigned(A))));
```
Where `A` is the volume control value (0-31 for 5-bit, 0-15 for 4-bit).

**Key Points:**
- Output represents instantaneous amplitude at hardware clock rate
- When tone bit is HIGH: output = volume level (0-255)
- When tone bit is LOW: output = 0
- This creates a square wave oscillating between 0 and volume level
- **This is a DC-biased square wave, NOT an AC signal**

---

### 2. TurboSound Device (3× PSG Chips)

**Hardware Implementation:** `_input/next-fpga/src/audio/turbosound.vhd`

The TurboSound device combines three independent YM2149 chips with stereo panning.

#### Stereo Mixing Logic (Per Chip)

**Inputs:**
- Three 8-bit unsigned channels (A, B, C) from each PSG chip

**Process (for PSG chip 0, others identical):**

1. **Left channel mux:**
   ```vhdl
   psg0_L_mux <= psg0_C when stereo_mode_i = '1' or mono_mode_i(0) = '1' else psg0_B;
   ```
   - **ACB mode (stereo_mode=1):** Use channel C for left
   - **ABC mode (stereo_mode=0):** Use channel B for left
   - **Mono mode:** Use both B and C

2. **Left channel sum (9-bit):**
   ```vhdl
   psg0_L_sum <= ('0' & psg0_L_mux) + ('0' & psg0_A);
   ```
   - Adds channel A (always goes to both left and right)
   - Result: 0-510 (9-bit unsigned)

3. **Right channel mux:**
   ```vhdl
   psg0_R_mux <= psg0_L_sum when mono_mode_i(0) = '1' else ('0' & psg0_C);
   ```
   - **Mono:** Uses left sum for right channel too
   - **Stereo:** Uses channel C (or B based on mode)

4. **Right channel sum (10-bit):**
   ```vhdl
   psg0_R_sum <= ('0' & psg0_R_mux) + ("00" & psg0_B);
   ```
   - Adds channel B to the mix
   - Result: 0-765 (10-bit unsigned)

5. **Final left channel (10-bit):**
   ```vhdl
   psg0_L_fin <= psg0_R_sum when mono_mode_i(0) = '1' else ('0' & psg0_L_sum);
   ```
   - **Mono:** Uses right sum
   - **Stereo:** Uses left sum extended to 10-bit
   - Result: 0-765 (10-bit unsigned)

#### Panning Control

Each PSG chip has a 2-bit panning register:
- Bit 1: Enable left channel
- Bit 0: Enable right channel

```vhdl
psg0_L_pan <= psg0_L when psg0_pan(1) = '1' else (others => '0');
psg0_R_pan <= psg0_R when psg0_pan(0) = '1' else (others => '0');
```

**Panning modes:**
- `00` (0): Muted
- `01` (1): Right only
- `10` (2): Left only
- `11` (3): Stereo (both)

#### TurboSound Final Output (12-bit unsigned)

All three chips are combined:
```vhdl
pcm_ay_L_o <= ("00" & psg0_L_pan) + ("00" & psg1_L_pan) + ("00" & psg2_L_pan);
pcm_ay_R_o <= ("00" & psg0_R_pan) + ("00" & psg1_R_pan) + ("00" & psg2_R_pan);
```

**Output range:**
- Each chip contributes 0-765
- Total for 3 chips: 0-2295 (12-bit unsigned)
- **Type:** `std_logic_vector(11 downto 0)` - unsigned

**Key Points:**
- All operations are unsigned integer addition
- No signed conversion anywhere in the process
- Output is cumulative amplitude (DC-biased)
- Maximum value with all 3 chips at maximum volume: 2295

---

### 3. Beeper (EAR and MIC Bits)

**Hardware Implementation:** `_input/next-fpga/src/audio/audio_mixer.vhd`

#### EAR Bit (Beeper Output)

**Hardware constants:**
```vhdl
constant ear_volume : std_logic_vector(12 downto 0) := "0001000000000";  -- 512 decimal
```

**Logic:**
```vhdl
ear <= ear_volume when (ear_i = '1' and exc_i = '0') else (others => '0');
```

**Behavior:**
- When EAR bit = 1 (HIGH): Output = 512
- When EAR bit = 0 (LOW): Output = 0
- **`exc_i`** (speaker exclusive): When HIGH, disables beeper output
- Output is 13-bit unsigned: 0 or 512

#### MIC Bit

**Hardware constants:**
```vhdl
constant mic_volume : std_logic_vector(12 downto 0) := "0000010000000";  -- 128 decimal
```

**Logic:**
```vhdl
mic <= mic_volume when (mic_i = '1' and exc_i = '0') else (others => '0');
```

**Behavior:**
- When MIC bit = 1: Output = 128
- When MIC bit = 0: Output = 0
- Also respects `exc_i` flag
- Output is 13-bit unsigned: 0 or 128

**Key Points:**
- Beeper outputs are simple binary levels (0 or fixed value)
- No intermediate values, just on/off
- Both are unsigned DC levels
- MIC is 1/4 the amplitude of EAR (128 vs 512)

---

### 4. Audio Mixer Device

**Hardware Implementation:** `_input/next-fpga/src/audio/audio_mixer.vhd`

#### Input Signals

1. **Beeper (EAR):** 13-bit unsigned, value 0 or 512
2. **MIC:** 13-bit unsigned, value 0 or 128
3. **AY/PSG Left:** 12-bit unsigned, range 0-2295
4. **AY/PSG Right:** 12-bit unsigned, range 0-2295
5. **DAC Left:** 9-bit unsigned (0-510), scaled to 13-bit
6. **DAC Right:** 9-bit unsigned (0-510), scaled to 13-bit
7. **I2S Left:** 10-bit unsigned (0-1023), extended to 13-bit
8. **I2S Right:** 10-bit unsigned (0-1023), extended to 13-bit

#### Signal Scaling

**AY/PSG (already 12-bit):**
```vhdl
ay_L <= '0' & ay_L_i;   -- Zero-extend 12-bit to 13-bit
ay_R <= '0' & ay_R_i;   -- Range: 0 - 2295
```

**DAC (9-bit → 13-bit):**
```vhdl
dac_L <= "00" & dac_L_i & "00";   -- 0-510 => 0-2040
dac_R <= "00" & dac_R_i & "00";
```
- Left-shifts by 2 bits (multiply by 4)
- Input range 0-510 becomes 0-2040

**I2S (10-bit → 13-bit):**
```vhdl
i2s_L <= "000" & pi_i2s_L_i;   -- 0-1023
i2s_R <= "000" & pi_i2s_R_i;
```
- Zero-extend to 13-bit
- Range remains 0-1023

#### Mixing Algorithm

**The mixer performs simple unsigned addition:**

```vhdl
process (clock_i)
begin
   if rising_edge(clock_i) then
      if reset_i = '1' then
         pcm_L <= (others => '0');
         pcm_R <= (others => '0');
      else
         pcm_L <= ear + mic + ay_L + dac_L + i2s_L;
         pcm_R <= ear + mic + ay_R + dac_R + i2s_R;
      end if;
   end if;
end process;
```

**Output:**
```vhdl
pcm_L_o <= pcm_L;
pcm_R_o <= pcm_R;
```

#### Output Range Calculation

**Maximum possible values (all sources at maximum):**
- EAR: 512
- MIC: 128
- AY: 2295
- DAC: 2040
- I2S: 1023
- **Total: 5998**

**Output format:**
- 13-bit unsigned: `std_logic_vector(12 downto 0)`
- Range: 0 - 5998
- Comments in VHDL confirm: `-- 0 - 5998`

**Key Points:**
- All mixing is pure unsigned integer addition
- No multiplication, no division, no signed conversion
- Each source contributes its unsigned value to the sum
- Output is cumulative DC level

---

## Unsigned to Signed Conversion (Final Output Stage)

**Hardware Implementation:** `_input/next-fpga/src/audio/i2s.vhd`

The hardware performs unsigned-to-signed conversion at the I2S output interface:

```vhdl
audio_zxn_L <= (not i_audio_zxn_L(12)) & i_audio_zxn_L(11 downto 0);
audio_zxn_R <= (not i_audio_zxn_R(12)) & i_audio_zxn_R(11 downto 0);
```

### Conversion Method: MSB Inversion

**How it works:**
1. Take unsigned 13-bit value (range 0-8191)
2. Invert bit 12 (MSB)
3. Keep all other bits unchanged
4. Result is signed 13-bit two's complement (range -4096 to +4095)

**Mathematical explanation:**
- Unsigned value U where 0 ≤ U ≤ 8191
- Signed value S = U XOR 0x1000 (flip bit 12)
- This maps:
  - Unsigned 0 → Signed -4096
  - Unsigned 4095 → Signed -1
  - Unsigned 4096 → Signed 0
  - Unsigned 8191 → Signed +4095

**Why this works:**
- In two's complement, bit 12 has weight -4096
- In unsigned, bit 12 has weight +4096  
- Inverting bit 12 changes its contribution by -8192
- This shifts the entire range: [0, 8191] → [-4096, +4095]
- The midpoint (4096) becomes zero (proper AC audio centering)

### Software Implementation

For 13-bit mixer output (0-8191):
```typescript
// Mixer output (unsigned 13-bit)
let unsignedOutput = ear + mic + psg + dac + i2s;  // Range: 0-8191

// Convert to signed 13-bit by inverting MSB
let signed13bit = unsignedOutput ^ 0x1000;  // XOR with 4096

// Interpret as signed (bit 12 = sign bit)
if (signed13bit & 0x1000) {
  // Negative value
  signed13bit = signed13bit - 0x2000;  // Subtract 8192 to get negative
}

// Scale to 16-bit for Web Audio API
let signed16bit = Math.floor(signed13bit * 32768 / 4096);
```

**Simplified version:**
```typescript
// Direct conversion with scaling
let unsigned13 = mixerOutput;  // 0-8191
let signed16 = ((unsigned13 ^ 0x1000) - 0x1000) * 8;  // Scale to ±32768
```

### Hardware Context

The I2S module converts:
- **Receive path:** Signed I2S input → Unsigned for mixer (inverts MSB on input)
- **Transmit path:** Unsigned mixer → Signed I2S output (inverts MSB on output)

This ensures:
1. Internal mixing operates on unsigned values (simple addition)
2. External digital audio uses signed format (standard I2S/PCM)
3. Conversion is lossless and reversible
4. DC bias is automatically centered for AC audio output

---

## Critical Implementation Requirements

### For Software Emulation (TypeScript/JavaScript)

To achieve 100% hardware compliance, the software emulation must:

1. **PSG Chip Output (PsgChip.ts):**
   - Generate **unsigned 8-bit values** per channel (0-255)
   - When tone bit HIGH: output = volume level
   - When tone bit LOW: output = 0
   - Scale to 16-bit for software: multiply by 256 (range 0-65280)
   - Store instantaneous per-channel values for sampling
   - **DO NOT generate signed values or apply AC conversion**

2. **TurboSound Device (TurboSoundDevice.ts):**
   - Sample each PSG chip's channels at audio rate
   - Apply stereo mixing logic per hardware (ACB/ABC modes)
   - Apply panning (mute/left/right/stereo) per chip
   - Combine all 3 chips using unsigned addition
   - Output range: 0-65535 (scaled from hardware's 0-2295)
   - **All operations must be unsigned addition**

3. **Beeper Output (BeeperDevice.ts):**
   - When EAR bit = 1: output 512
   - When EAR bit = 0: output 0
   - When MIC bit = 1: output 128  
   - When MIC bit = 0: output 0
   - **Values are exact DC levels, not boolean conversions**

4. **Audio Mixer (AudioMixerDevice.ts):**
   - Accept unsigned inputs from all sources
   - Perform unsigned integer addition: `pcm_L = ear + mic + ay_L + dac_L + i2s_L`
   - Expected range: 0 - ~6000 (after scaling)
   - **No signed arithmetic during mixing**

5. **Final Audio Output Conversion:**
   - The unsigned mixer output (0-5998) must be converted to signed audio for software APIs
   - **This conversion happens AFTER mixing, not before**
   - **Hardware conversion method** (from `_input/next-fpga/src/audio/i2s.vhd`):
     ```vhdl
     audio_zxn_L <= (not i_audio_zxn_L(12)) & i_audio_zxn_L(11 downto 0);
     audio_zxn_R <= (not i_audio_zxn_R(12)) & i_audio_zxn_R(11 downto 0);
     ```
   - **Method:** Invert the MSB (most significant bit)
   - This converts unsigned to signed two's complement representation
   - For 13-bit: inverts bit 12, keeps bits 11-0 unchanged
   - Example: unsigned 0 (0b0_000000000000) → signed -4096 (0b1_000000000000)
   - Example: unsigned 4096 (0b1_000000000000) → signed 0 (0b0_000000000000)
   - Example: unsigned 8191 (0b1_111111111111) → signed 3937 (0b0_111111111111)
   - **Software equivalent:** `signedValue = unsignedValue ^ 0x1000` (XOR with 0x1000 for 13-bit)
   - Then scale to 16-bit range for Web Audio API (-32768 to +32767)

---

## Sample Rate and Timing

**From hardware specifications:**
- CPU clock: 3.5 MHz base (can be 7/14/28 MHz with multipliers)
- Frame rate: 50 Hz PAL (20ms per frame)
- Audio sample rate: 48 kHz (48000 samples per second)
- Samples per frame: 48000 / 50 = 960 samples

**PSG update rate:**
- PSG chips run at approximately 1.75 MHz (CPU clock / 2)
- Frame duration: 70,000 CPU tacts (at 3.5 MHz)
- Updates per audio sample: 70000 / 960 ≈ 72.9 PSG updates per sample

**Sampling strategy:**
- Hardware naturally outputs continuous values
- Software must sample PSG state at 48 kHz intervals
- Use **instantaneous sampling** (current output value at sample time)
- Do NOT average across updates (would destroy high-frequency content)

---

## Stereo Modes

### ABC Mode (stereo_mode_i = '0')
- **Left:** Channel A + Channel B
- **Right:** Channel A + Channel B + Channel C
- Channel A appears in both (center)
- Channel B goes to left
- Channel C goes to right

### ACB Mode (stereo_mode_i = '1')  
- **Left:** Channel A + Channel C
- **Right:** Channel A + Channel B + Channel C
- Channel A appears in both (center)
- Channel C goes to left
- Channel B goes to right

### Mono Mode (mono_mode_i bit set for chip)
- Forces both left and right to same mix
- All three channels combined equally

---

## Verification Checklist

To ensure 100% hardware compliance:

- [ ] PSG outputs unsigned 0-65535 range (scaled from 0-255)
- [ ] PSG tone bit HIGH produces positive value, LOW produces zero
- [ ] TurboSound combines 3 chips using unsigned addition
- [ ] Beeper EAR outputs exactly 0 or 512 (not normalized 0.0/1.0)
- [ ] Audio mixer uses unsigned addition for all sources
- [ ] No signed conversion before final mixer output
- [ ] Mixer output range approximately 0-6000
- [ ] Stereo mixing matches ABC/ACB logic
- [ ] Panning modes (muted/left/right/stereo) implemented correctly
- [ ] Instantaneous sampling used (not averaging)
- [ ] Sample rate is 48 kHz
- [ ] Signed conversion happens only at Web Audio API interface

---

## Implementation Notes

### Why Unsigned Throughout?

The hardware represents **instantaneous amplitude** of the audio signal. A square wave in hardware:
- High state: defined voltage level (represented as non-zero value)
- Low state: ground (represented as zero)

This is naturally a DC-biased signal. The AC coupling that removes DC bias happens:
1. In real hardware: through capacitors in the audio output circuit
2. In software: through final conversion to signed format for audio APIs

### Envelope Modulation

With unsigned representation, envelope modulation works correctly:
- Envelope changes the amplitude (volume level) over time
- Tone oscillator switches between 0 and current envelope level
- Example: Envelope at 200 → square wave oscillates 0, 200, 0, 200, ...
- Envelope decays to 100 → square wave oscillates 0, 100, 0, 100, ...
- **The envelope modulation is visible in the unsigned amplitude values**

### Why Previous Signed Implementation Failed

The previous implementation incorrectly assumed:
- PSG should output signed values (±amplitude)
- Mixing should handle positive and negative values
- This caused:
  - -512 artifacts from mixing signed PSG with unsigned beeper
  - Incorrect DC offset handling
  - Mismatched representations between components

**The hardware never uses signed values internally. Everything is unsigned cumulative amplitude.**

---

## Next Steps

1. Revert PSG chip to unsigned output (0-65535)
2. Update TurboSound device to unsigned arithmetic
3. Update Audio mixer to unsigned addition
4. Implement final signed conversion for Web Audio API
5. Test envelope effects with unsigned representation
6. Verify beeper outputs exact values (512/0, not scaled)
7. Validate mixer output range (should be ~0-6000)

---

## References

- VHDL Source: `_input/next-fpga/src/audio/ym2149.vhd` - PSG chip implementation
- VHDL Source: `_input/next-fpga/src/audio/turbosound.vhd` - TurboSound (3× PSG with stereo)
- VHDL Source: `_input/next-fpga/src/audio/audio_mixer.vhd` - Audio mixer combining all sources
- VHDL Source: `_input/next-fpga/src/audio/i2s.vhd` - I2S interface with unsigned/signed conversion
- VHDL Source: `_input/next-fpga/src/audio/dac.vhd` - Delta-sigma DAC implementation
- VHDL Source: `_input/next-fpga/src/zxnext_top_issue4.vhd` - Top-level integration
- VHDL Source: `_input/next-fpga/src/zxnext.vhd` - Main Next machine module

---

## Summary of Key Findings

### The Critical Discovery

**The hardware uses UNSIGNED arithmetic exclusively throughout the audio pipeline.**

Previous implementation incorrectly assumed signed audio representation in the PSG chip, leading to:
- Mixing incompatibilities (signed PSG + unsigned beeper = -512 artifacts)
- Wrong audio centering
- Incorrect envelope behavior

### Correct Hardware Behavior

1. **PSG chips** output unsigned 8-bit per channel (0-255)
2. **TurboSound** combines 3 PSG chips using unsigned addition → 12-bit output (0-2295)
3. **Beeper** outputs unsigned 13-bit: exactly 0 or 512 (EAR), 0 or 128 (MIC)
4. **Audio Mixer** adds all sources as unsigned 13-bit values → output 0-5998
5. **I2S Interface** converts unsigned to signed by inverting MSB
6. **Final audio** is signed 13-bit (-4096 to +4095) after MSB inversion

### Why This Matters for Envelope Effects

With unsigned representation:
- Envelope changes amplitude from (e.g.) 200 → 150 → 100 → 50 → 0
- Tone oscillator creates square wave: [0, 200, 0, 200] → [0, 150, 0, 150] → ...
- The **amplitude variation IS the envelope modulation**
- After conversion to signed AC: [200, -200] → [150, -150] → properly centered waveform
- Envelope decay is preserved through the entire pipeline

### Required Changes to Current Implementation

1. **Revert PsgChip.ts to unsigned output**
   - Remove signed ±amplitude logic
   - Return to: tone HIGH = volume, tone LOW = 0
   - Output range: 0-65535 (scaled from hardware's 0-255)

2. **Update TurboSoundDevice.ts**
   - Use unsigned arithmetic for all mixing
   - Remove any signed value handling
   - Output range: 0-65535 (scaled from hardware's 0-2295)

3. **Fix BeeperDevice.ts or AudioMixerDevice.ts**
   - Ensure EAR outputs exactly 512 (not normalized 0.0/1.0)
   - Ensure MIC outputs exactly 128
   - No boolean-to-number conversions

4. **Update AudioMixerDevice.ts**
   - Change mixing to unsigned addition
   - Apply proper scaling factors per source
   - Remove signed arithmetic until final conversion

5. **Add final unsigned-to-signed conversion**
   - After all mixing is complete
   - Use MSB inversion: `signedValue = (unsignedValue ^ 0x1000) - 0x1000`
   - Scale to 16-bit: multiply by 8
   - Feed to Web Audio API as signed 16-bit PCM

---

## Action Plan

### Phase 1: Revert to Unsigned (High Priority)
- [ ] Modify PsgChip.ts generateOutputValue() to output unsigned
- [ ] Update getChannelAVolume/B/C() to return unsigned values
- [ ] Remove signed amplitude logic (±amplitude based on bit state)
- [ ] Update documentation to reflect unsigned output

### Phase 2: Update TurboSound (High Priority)
- [ ] Change getChipStereoOutput() to unsigned arithmetic
- [ ] Verify stereo mixing uses unsigned addition
- [ ] Ensure panning logic uses unsigned values
- [ ] Test output range is 0-65535

### Phase 3: Fix Beeper (High Priority)  
- [ ] Review current setEarLevel() implementation
- [ ] Ensure input is 0 or 1 (binary)
- [ ] Ensure output is 0 or 512 (not scaled)
- [ ] Verify MIC outputs 0 or 128

### Phase 4: Restructure Audio Mixer (Critical)
- [ ] Change getMixedOutput() to unsigned addition
- [ ] Remove signed arithmetic
- [ ] Apply proper scaling:
  - PSG: divide by appropriate factor to fit range
  - Keep beeper at 512/0
  - Keep MIC at 128/0
  - Scale DAC as needed
- [ ] Verify output range approximately 0-6000

### Phase 5: Add Final Conversion (Critical)
- [ ] Implement unsigned-to-signed conversion after mixing
- [ ] Use MSB inversion method from hardware
- [ ] Scale to 16-bit range
- [ ] Test with known inputs

### Phase 6: Testing and Validation
- [ ] Test envelope effects (should now be audible)
- [ ] Test beeper BEEP command
- [ ] Test PLAY command with various envelope shapes
- [ ] Verify no -512 artifacts during silence
- [ ] Check audio quality and levels
- [ ] Compare with real hardware behavior

---

## Expected Results After Implementation

1. **Envelope effects will be audible** - amplitude modulation preserved through unsigned pipeline
2. **No -512 artifacts** - all sources use same unsigned representation  
3. **Proper audio centering** - MSB inversion provides correct AC conversion
4. **Hardware-accurate mixing** - matches VHDL implementation exactly
5. **Clean silence** - unsigned zero is stable, converts to signed zero correctly

---

## References

- VHDL Source: `_input/next-fpga/src/audio/ym2149.vhd`
- VHDL Source: `_input/next-fpga/src/audio/turbosound.vhd`  
- VHDL Source: `_input/next-fpga/src/audio/audio_mixer.vhd`
- VHDL Source: `_input/next-fpga/src/zxnext_top_issue4.vhd`
- VHDL Source: `_input/next-fpga/src/zxnext.vhd`
