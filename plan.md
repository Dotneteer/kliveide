# Audio Envelope Fix Plan - ZX Spectrum Next TurboSound Orphan Sample Averaging

## Problem Summary

Envelope effects (amplitude changes) are not audible in ZX Next emulation despite PSG chip envelope calculations being correct. The PLAY command `PLAY "UX5000W0CW0C"` should produce audible volume variations but produces flat output.

**Root Cause:** TurboSoundDevice accumulates PSG samples into `orphanSum`/`orphanSamples` but never averages/consumes them when generating audio output. This causes envelope dynamics to be lost.

## Architecture Comparison

### ZX Spectrum 128 (WORKING)

```typescript
// ZxSpectrum128PsgDevice.ts
calculateCurrentAudioValue() {
  // Advance PSG, accumulating samples
  while (tact >= nextClockTact) {
    psg.generateOutputValue();  // Accumulates into orphanSum/orphanSamples
    nextClockTact += PSG_CLOCK_STEP;
  }
}

getCurrentSampleValue(): AudioSample {
  // Average accumulated samples and reset
  value = orphanSamples > 0
    ? orphanSum / orphanSamples / 65535 / 3
    : 0.0;
  orphanSum = 0;
  orphanSamples = 0;
  return { left: value, right: value };
}
```

**Key:** Orphan samples are averaged over the audio sampling period, preserving amplitude variations.

### ZX Spectrum Next (BROKEN)

```typescript
// TurboSoundDevice.ts
calculateCurrentAudioValue(currentCpuTact) {
  // Advance all 3 PSG chips
  for (let i = 0; i < psgTactsToAdvance; i++) {
    generateAllOutputValues();  // Each chip accumulates into orphanSum/orphanSamples
  }
}

setNextAudioSample(machineTacts, clockMultiplier) {
  // PROBLEM: Reads instantaneous channel volumes
  for (let i = 0; i < 3; i++) {
    output = getChipStereoOutput(i);  // Calls getChannelXVolume() directly
    totalLeft += output.left;
    totalRight += output.right;
  }
  // orphanSum/orphanSamples are NEVER used or reset!
}
```

**Problem:** Direct channel reads miss amplitude variations accumulating in orphan samples.

## VHDL Hardware Analysis

### YM2149 Output Generation (ym2149.vhd:440-544)

- **Clock divider:** ENA signal gates updates (÷8 internal, ÷2 from clock = ÷16 total)
- **Volume calculation:** Combines tone, noise, and envelope on each clock
- **Output registers:** `O_AUDIO_A/B/C` updated synchronously on clock edge
- **Continuous output:** Hardware produces new samples on every enabled clock

**Key insight:** Hardware outputs are **continuous values** that change with envelope state. Software must sample these adequately to capture dynamics.

### TurboSound Mixing (turbosound.vhd:215-390)

```vhdl
-- Per-chip stereo mixing (ABC mode)
psg0_L_mux <= psg0_C when stereo_mode_i = '1' else psg0_B;
psg0_L_sum <= ('0' & psg0_L_mux) + ('0' & psg0_A);
psg0_R_sum <= ('0' & psg0_R_mux) + ("00" & psg0_B);

-- Final mixing with panning
pcm_ay_L_o <= ("00" & psg0_L_pan) + ("00" & psg1_L_pan) + ("00" & psg2_L_pan);
pcm_ay_R_o <= ("00" & psg0_R_pan) + ("00" & psg1_R_pan) + ("00" & psg2_R_pan);
```

**Key insight:** Hardware combines all chip outputs **after** per-chip mixing. Software must preserve each chip's averaged samples before combining.

## Investigation Steps

### 1. Verify Orphan Sample Accumulation ✅
**Status:** FULLY CONFIRMED
- ✅ PsgChip.generateOutputValue() accumulates into orphanSum/orphanSamples (line 596-597)
- ✅ TurboSoundDevice.generateAllOutputValues() calls chip.generateOutputValue() on all 3 chips (line 297-298)
- ✅ Called from calculateCurrentAudioValue() in loop (line 629)
- ✅ Values incremented on each PSG clock cycle
- ✅ Same logic as ZX Spectrum 128

### 2. Identify Missing Consumption ✅
**Status:** FULLY CONFIRMED - Orphans NEVER consumed in production code
- ✅ TurboSoundDevice.setNextAudioSample() directly calls getChipStereoOutput() (line 646-650)
- ✅ getChipStereoOutput() uses getChannelXVolume() for instantaneous state (line 312-314)
- ✅ orphanSum/orphanSamples only appear in 3 lines: getter (372), two clearers (383, 392)
- ✅ getChipOrphanSamples() and clearChipOrphanSamples() **only called in TEST files**, never in production
- ✅ Orphan samples accumulate but are NEVER averaged or reset during audio generation
- ⚠️ **Critical finding:** This is the smoking gun - orphans exist but go unused!

### 3. Confirm Audio Sample Rate and Timing ✅
**Status:** FULLY VERIFIED
- ✅ **Audio sample rate:** 48,000 Hz (default from constructor, line 108)
  - Set from store at machine startup (MachineService.ts line 89-91)
  - If undefined in store, stays at 48kHz default
- ✅ **PSG clock divisor:** 16 (hardcoded, line 91: `_psgClockDivisor = 16`)
  - Accounts for ÷2 (1.75 MHz PSG clock from 3.5 MHz CPU)
  - Plus ÷8 internal PSG prescaler (from VHDL ym2149.vhd line 264-277)
  - Total: CPU ÷ 16
- ✅ **PSG update rate:** 3.5 MHz ÷ 16 = 218,750 Hz
- ✅ **Ratio:** 218,750 ÷ 48,000 = ~4.6 PSG updates per audio sample
- ✅ **Without averaging:** Only final PSG state seen, intermediate envelope states lost

### 4. Verify Call Chain ✅
**Status:** FULLY TRACED
- ✅ **Per-instruction flow** (ZxNextMachine.afterInstructionExecuted, line 1093):
  1. turboSound.calculateCurrentAudioValue(tacts) - advances PSG, accumulates orphans
  2. dac.calculateCurrentAudioValue() - updates DAC state
  3. mixer.calculateCurrentAudioValue() - updates mixer state
  
- ✅ **Per-tact flow** (ZxNextMachine.onTactIncremented, line 1113-1124):
  1. Render screen
  2. beeperDevice.setNextAudioSample() - generates beeper sample
  3. turboSound.setNextAudioSample(tacts, multiplier) - **should** generate PSG sample
  4. dac.setNextAudioSample() - generates DAC sample  
  5. mixer.setNextAudioSample() - combines all sources
  
- ✅ **Audio sample timing:** Controlled by `_audioNextSampleTact` vs `machineTacts`
  - Sample interval: baseClockFrequency / sampleRate (line 120)
  - At 3.5 MHz / 48 kHz = ~73 tacts per sample
  - PSG advances 16 tacts between each generateOutputValue()
  - Expected orphans: 73 ÷ 16 = 4-5 samples between audio samples

### 5. Overflow Risk Analysis ✅
**Status:** SAFE - No overflow risk
- ✅ Max PSG value: 65535 (16-bit)
- ✅ Expected orphans: 4-5 per audio sample
- ✅ Max accumulation: 65535 × 5 = 327,675
- ✅ JavaScript Number: 53-bit integer precision (9 quadrillion safe)
- ✅ **Conclusion:** No overflow risk in normal operation

### 6. Test Envelope Behavior
**Test case:** `PLAY "UX5000W0CW0C"`
- Expected: Sawtooth envelope (shape 0x0A = attack-hold-decay pattern)
- Current behavior: Flat/silent output
- With fix: Should hear ramp-up/ramp-down volume changes

---

## Investigation Summary

**Root cause definitively confirmed:**

1. **Orphan samples ARE being accumulated** (4-5 PSG updates between each audio sample)
2. **Orphan samples are NEVER consumed** - only test code touches them
3. **Direct channel reads bypass accumulated dynamics** - getChipStereoOutput() reads instantaneous state
4. **Result:** Envelope amplitude variations lost between audio samples

**The fix is clear:** Modify getChipStereoOutput() to average and consume orphan samples before mixing, exactly like ZX Spectrum 128 does.

## Solution Design

### Option A: Per-Chip Orphan Sample Averaging (RECOMMENDED)

**Approach:** Each chip averages its orphan samples independently before mixing.

```typescript
// TurboSoundDevice.ts
getChipStereoOutput(chipId): { left: number; right: number } {
  const chip = this._chips[chipId];
  
  // Average accumulated samples (like ZX Spectrum 128)
  let volA = 0, volB = 0, volC = 0;
  
  if (chip.orphanSamples > 0) {
    // Average the accumulated PSG outputs
    const avgVolume = chip.orphanSum / chip.orphanSamples;
    
    // Split averaged volume across channels based on their contributions
    // (This requires tracking per-channel orphan sums - see below)
    volA = chip.orphanSumA / chip.orphanSamples;
    volB = chip.orphanSumB / chip.orphanSamples;
    volC = chip.orphanSumC / chip.orphanSamples;
    
    // Reset orphan counters
    chip.orphanSum = 0;
    chip.orphanSumA = 0;
    chip.orphanSumB = 0;
    chip.orphanSumC = 0;
    chip.orphanSamples = 0;
  } else {
    // No samples accumulated, use current instantaneous values
    volA = chip.getChannelAVolume();
    volB = chip.getChannelBVolume();
    volC = chip.getChannelCVolume();
  }
  
  // Apply stereo mixing, mono mode, and panning as before
  // ...
}
```

**Pros:**
- Matches ZX Spectrum 128 architecture
- Preserves per-channel dynamics for proper stereo mixing
- Clean separation of concerns (chip averages its own samples)

**Cons:**
- Requires modifying PsgChip to track per-channel orphan sums (not just total)

### Option B: Total Orphan Sample Averaging (SIMPLER)

**Approach:** Average total chip output, use instantaneous channel ratios for mixing.

```typescript
getChipStereoOutput(chipId): { left: number; right: number } {
  const chip = this._chips[chipId];
  
  // Get current instantaneous channel volumes
  const volA = chip.getChannelAVolume();
  const volB = chip.getChannelBVolume();
  const volC = chip.getChannelCVolume();
  const totalInstant = volA + volB + volC;
  
  // Average orphan samples for overall amplitude scaling
  let scale = 1.0;
  if (chip.orphanSamples > 0) {
    const avgOrphan = chip.orphanSum / chip.orphanSamples;
    // Scale instantaneous channels by averaged total
    if (totalInstant > 0) {
      scale = avgOrphan / totalInstant;
    }
    // Reset orphan counters
    chip.orphanSum = 0;
    chip.orphanSamples = 0;
  }
  
  // Apply scaling to preserve dynamics
  const scaledA = volA * scale;
  const scaledB = volB * scale;
  const scaledC = volC * scale;
  
  // Apply stereo mixing, mono mode, and panning as before
  // ...
}
```

**Pros:**
- No PsgChip modification needed
- Simpler implementation
- Still preserves amplitude dynamics

**Cons:**
- Less accurate if channels have very different dynamics simultaneously
- Ratio-based approximation instead of true per-channel averaging

## Recommended Implementation: Option A+

**Hybrid approach combining best of both:**

1. **Modify PsgChip** to track per-channel orphan sums:
   ```typescript
   // PsgChip.ts - Add new properties
   orphanSumA = 0;
   orphanSumB = 0;
   orphanSumC = 0;
   
   // In generateOutputValue(), track per-channel:
   orphanSumA += volA;
   orphanSumB += volB;  
   orphanSumC += volC;
   orphanSum += vol;  // Keep total for backward compatibility
   orphanSamples += 1;
   ```

2. **Modify TurboSoundDevice.getChipStereoOutput()** to use averaged channels:
   ```typescript
   getChipStereoOutput(chipId): { left: number; right: number } {
     const chip = this._chips[chipId];
     let volA, volB, volC;
     
     if (chip.orphanSamples > 0) {
       // Use averaged channel volumes
       volA = chip.orphanSumA / chip.orphanSamples;
       volB = chip.orphanSumB / chip.orphanSamples;
       volC = chip.orphanSumC / chip.orphanSamples;
       
       // Reset counters
       chip.orphanSum = 0;
       chip.orphanSumA = 0;
       chip.orphanSumB = 0;
       chip.orphanSumC = 0;
       chip.orphanSamples = 0;
     } else {
       // Fallback to instantaneous (shouldn't happen in normal operation)
       volA = chip.getChannelAVolume();
       volB = chip.getChannelBVolume();
       volC = chip.getChannelCVolume();
     }
     
     // Continue with existing stereo/mono/panning logic...
   }
   ```

3. **Testing checkpoints:**
   - [ ] Verify per-channel orphan sums accumulate correctly
   - [ ] Verify averaging produces non-zero values with envelope
   - [ ] Verify reset happens once per audio sample
   - [ ] Verify no orphan sample accumulation drift over time
   - [ ] Test envelope command produces audible amplitude changes
   - [ ] Compare with ZX Spectrum 128 envelope output

## Edge Cases to Handle

### 1. No Orphan Samples Available
- **Scenario:** Audio sample arrives before any PSG updates
- **Solution:** Fall back to instantaneous channel volumes
- **Code:** `if (orphanSamples > 0) { ... } else { getChannelXVolume() }`

### 2. Orphan Sample Overflow
- **Risk:** orphanSum could overflow with many small samples
- **Mitigation:** uint32 max = 4B, max PSG value = 65535, would need 65000+ samples
- **Audio sample rate:** 48 kHz = 1 sample per 73 CPU clocks (at 3.5 MHz)
- **PSG rate:** CPU ÷ 16 = 1 update per 16 CPU clocks
- **Max orphans between samples:** 73 ÷ 16 = ~4-5 samples
- **Max accumulation:** 65535 × 5 = 327,675 (well within uint32)
- **Conclusion:** No overflow risk in normal operation

### 3. Sample Rate Changes
- **Scenario:** User changes audio sample rate setting
- **Solution:** Call `setAudioSampleRate()` which resets timing
- **Verify:** Orphan samples properly reset on rate change

### 4. State Save/Restore
- **Current:** TurboSoundDevice.setState() restores chip states
- **Required:** Ensure orphanSumA/B/C included in state serialization
- **Add to PsgChip.getState():** Include new orphan sum fields

## Files to Modify

### 1. PsgChip.ts
- **Location:** `src/emu/machines/zxSpectrum128/PsgChip.ts`
- **Changes:**
  - Add `orphanSumA`, `orphanSumB`, `orphanSumC` properties
  - Modify `generateOutputValue()` to accumulate per-channel sums
  - Modify `reset()` to reset new orphan sum fields
  - Modify `getState()` to include new fields
  - Modify `setState()` to restore new fields

**Estimated lines:** ~20 additions, ~5 modifications

### 2. TurboSoundDevice.ts
- **Location:** `src/emu/machines/zxNext/TurboSoundDevice.ts`
- **Changes:**
  - Modify `getChipStereoOutput()` to use orphan sample averaging
  - Remove orphan clearing methods (getChipOrphanSamples, clearChipOrphanSamples, clearAllOrphanSamples) if no longer needed
  - Update comments/documentation

**Estimated lines:** ~30 modifications, ~10 additions

### 3. Documentation Updates
- **AUDIO_ARCHITECTURE.md:** Document orphan sample averaging behavior
- **Plan:** Update with resolution summary

**Estimated lines:** ~50 additions

## Testing Strategy

### Unit Tests
1. **PsgChip per-channel accumulation:**
   - Generate multiple samples, verify orphanSumA/B/C incremented
   - Verify orphanSum = orphanSumA + orphanSumB + orphanSumC

2. **TurboSoundDevice averaging:**
   - Mock PsgChip with known orphan values
   - Verify averaged output matches expected calculation
   - Verify orphan counters reset after averaging

### Integration Tests
1. **Envelope playback:**
   - Run `PLAY "UX5000W0CW0C"` command
   - Capture audio samples
   - Verify non-zero amplitude variations
   - Compare waveform shape to expected envelope pattern

2. **Multi-chip mixing:**
   - Play envelope on chip 0, tone on chip 1
   - Verify both chips' dynamics preserved in final output
   - Check stereo separation maintained

3. **Comparison test:**
   - Same PLAY command on ZX Spectrum 128 vs Next
   - Compare audio waveforms for similarity
   - Expect envelope dynamics to match

## Success Criteria

- [ ] Envelope amplitude changes audible in ZX Next emulation
- [ ] `PLAY "UX5000W0CW0C"` produces clear volume ramp-up/down pattern
- [ ] Audio output matches or closely approximates ZX Spectrum 128 behavior
- [ ] No audio artifacts, clicks, or discontinuities introduced
- [ ] All three PSG chips maintain independent envelope dynamics
- [ ] Stereo mixing preserves per-channel volume variations
- [ ] Unit tests pass for orphan sample accumulation and averaging
- [ ] Integration tests confirm envelope playback matches expected patterns

## Timeline Estimate

- Investigation completion: ✅ **VERIFIED COMPLETE**
  - All 5 investigation steps fully confirmed with source references
  - Call chains traced, timing verified, root cause identified
- PsgChip modifications: 1-2 hours
- TurboSoundDevice modifications: 2-3 hours  
- Testing and validation: 2-3 hours
- Documentation: 1 hour
- **Total implementation: 6-9 hours**

## Risk Assessment

**Low Risk:**
- Well-understood problem with clear precedent (ZX 128 implementation)
- Changes localized to audio subsystem
- Existing orphan tracking infrastructure in place
- Straightforward averaging calculation

**Mitigation:**
- Incremental implementation (PsgChip first, then TurboSound)
- Comprehensive testing at each step
- Keep fallback to instantaneous reads if no orphan samples
- Can compare directly to working ZX 128 implementation

## Next Steps

1. **Implement PsgChip per-channel orphan tracking** (highest priority)
2. **Modify TurboSoundDevice to use averaged samples**
3. **Test with envelope PLAY command**
4. **Verify stereo mixing preserves dynamics**
5. **Update documentation**
6. **Create comprehensive test suite**

---

**Plan Created:** February 7, 2026  
**Status:** Ready for implementation  
**Priority:** High (audio quality issue affecting user experience)
