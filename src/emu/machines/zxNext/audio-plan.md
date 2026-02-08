# PSG Audio Architecture Change: Signed Output

## Analysis: VHDL PSG Audio Range

The VHDL source code uses **unsigned values throughout**:

- **TurboSound output**: 12-bit unsigned (0-4095) per chip
- **Audio mixer output**: 13-bit unsigned (0-8191)
- DC removal handled by external hardware (DAC/audio codec)

**However**, for software emulation, using unsigned creates the averaging problem:
- When averaging unsigned samples (65535, 0, 65535, 0...), we get ~32768 (constant)
- The envelope modulation becomes invisible
- Non-linear distortion occurs when creating average values

---

## Proposed Change: Signed PSG Output

Convert PSG from **unsigned (0-65535)** to **signed (-32768 to +32767)** representation:

### Core Concept:
- **Silent channel**: Output = 0 (zero amplitude)
- **Active tone ON state**: Output = +envelope_value (positive)
- **Active tone OFF state**: Output = -envelope_value (negative)
- **Result**: Tone oscillates around 0, averaging preserves envelope

---

## Implementation Plan

### **1. PsgChip.ts** (src/emu/machines/zxSpectrum128/)

**A. Change volume table generation** (lines 215-261, `initEnvelopData()`):
- Keep existing 0-65535 absolute values
- These represent **amplitude**, not signed output

**B. Modify `generateOutputValue()`** (lines 533-656):
- **Current**: `volA/B/C = 0` (silent) or `volumeTable[...]` (active)
- **New**: Calculate signed output:
  ```typescript
  // When tone/noise is active and bit is HIGH
  volA = +this._psgVolumeTable[...];  // Positive
  
  // When tone/noise is active and bit is LOW  
  volA = -this._psgVolumeTable[...];  // Negative
  
  // When channel disabled or envelope at 0
  volA = 0;  // Silent
  ```
- Apply to channels A, B, C independently
- Change `orphanSumA/B/C` accumulation to handle signed values
- Update `currentOutputA/B/C` to hold signed values

**C. Update channel volume getters** (lines 681-741):
- `getChannelAVolume()`, `getChannelBVolume()`, `getChannelCVolume()`
- Return signed values (-32768 to +32767)
- Adjust logic for tone bit state

**D. Update state serialization** (lines 785-820, `getState()`):
- No changes needed (internal state remains same)

**E. Update comments**:
- Line 33: Change "Output range: 0-65535" → "Output range: -32768 to +32767"
- Lines 609, 625, 641: Update volume conversion comments
- Lines 681, 701, 721: Update getter return value comments

---

### **2. TurboSoundDevice.ts** (src/emu/machines/zxNext/)

**A. Update `getChipStereoOutput()`** (lines 306-371):
- **Current**: Clamps with `Math.min(65535, ...)`
- **New**: Allow signed values, clamp to ±65535:
  ```typescript
  left = Math.max(-65535, Math.min(65535, volA + volB));
  right = Math.max(-65535, Math.min(65535, volB + volC));
  ```
- Handles positive AND negative channel contributions

**B. Update `setNextAudioSample()`** (lines 611-635):
- `totalLeft` and `totalRight` can now be negative
- No clamping needed (handled in getChipStereoOutput)

**C. Update comments**:
- Line 304: Change "0-65535" → "-65535 to +65535"

---

### **3. AudioMixerDevice.ts** (src/emu/machines/zxNext/)

**A. Remove threshold-based centering** (lines 225-230):
- **Delete** the `psgLeftCentered > 20000` conditional logic
- PSG is already signed, no centering needed:
  ```typescript
  // OLD (remove):
  const psgLeftCentered = this.psgOutput.left > 20000 
    ? Math.floor((this.psgOutput.left - 32768) / 8)
    : Math.floor(this.psgOutput.left / 8);
  
  // NEW (simple division):
  const psgLeftScaled = Math.floor(this.psgOutput.left / 8);
  const psgRightScaled = Math.floor(this.psgOutput.right / 8);
  
  left += psgLeftScaled;
  right += psgRightScaled;
  ```

**B. Update comments**:
- Lines 223-224: Remove "DC offset" centering comments
- Update to explain direct signed addition

---

### **4. ZX Spectrum 128 Integration**

**Spectrum128Machine.ts** (src/emu/machines/zxSpectrum128/):
- **No changes needed** - uses same PsgChip
- Verify beeper still mixes correctly (should work since PSG now centered at 0)

---

### **5. Constraints**

⚠️ **BeeperDevice** (`src/emu/machines/common/SpectrumBeeperDevice.ts`):
- **NOT TO BE MODIFIED** - Beeper implementation must remain unchanged
- Beeper outputs remain as-is (512 or 0 unsigned)
- PSG centering change must be compatible with existing beeper signal

---

### **6. Testing & Verification**

**Manual testing by user**:
- Build and run the application
- Test with PLAY command: `PLAY "UX5000W0CW0C"`
- Verify envelope effect is now audible
- Check beeper still functions correctly
- Verify no audio distortion or artifacts

**Expected log output**:
```
// Before (unsigned with DC offset):
65535,0,65535,0,65535,0...

// After (signed, oscillating):
32768,-32768,32768,-32768,...

// With envelope decay:
32768,-32768, 30000,-30000, 27000,-27000,...
```

---

### **7. Benefits**

✅ **Correct averaging**: Oscillating signed values average to show envelope  
✅ **No DC offset**: Centered at 0, no threshold hacks needed  
✅ **Simpler mixer**: Remove centering logic  
✅ **Matches audio theory**: AC signals oscillate around 0  
✅ **Preserves hardware accuracy**: Amplitude values unchanged, only representation

---

**Estimated changes**: ~15 locations across 4 files, primarily PsgChip and AudioMixer.

---

## Files to Modify

1. `src/emu/machines/zxSpectrum128/PsgChip.ts` - Core PSG chip implementation
2. `src/emu/machines/zxNext/TurboSoundDevice.ts` - Multi-chip PSG manager
3. `src/emu/machines/zxNext/AudioMixerDevice.ts` - Audio mixer
4. `src/emu/machines/zxSpectrum128/Spectrum128Machine.ts` - Verification only
