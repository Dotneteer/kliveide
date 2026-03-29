# PSG (AY/YM) Implementation Comparison: MAME vs Klive

## Executive Summary

The Klive PSG implementation has **several critical behavioral differences** from MAME's hardware-verified AY-3-8910/YM2149 emulation. The most impactful issues are the **mixer logic** (AND vs OR for combined tone+noise), **disabled-channel behavior** (MAME outputs HIGH; Klive outputs silence), the **noise LFSR algorithm**, and the **volume curve**. These affect audible accuracy for games that use noise effects, volume modulation tricks, or mixed tone+noise channels.

---

## Detailed Comparison

### 1. Mixer Logic — Combined Tone + Noise (CRITICAL)

**MAME** (hardware-verified):
```
vol_enabled = (tone_output | tone_disable) & (noise_output | noise_disable)
```
- Both enabled → **AND** of tone and noise (both must be HIGH for output)
- Tone only → tone_output
- Noise only → noise_output
- Both disabled → **always 1** (volume modulation possible)

**Klive** (`PsgChip.ts` `generateOutputValue()`):
```typescript
if (toneAEnabled && bitA) volA = amplitude;
else if (noiseAEnabled && bitNoise) volA = amplitude;
```
- Both enabled → **OR** of tone and noise (either HIGH gives output)
- Both disabled → **0** (silence)

**Impact**: AND vs OR changes the character of combined tone+noise effects significantly. AND produces a "gated" sound; OR produces a fuller sound. Many games use register 7 with both tone+noise to create metallic/drum effects that rely on AND behavior.

The "both disabled = always on" behavior is used by some music players for pure volume-register modulation (digi-drumming).

### 2. Noise Generator LFSR Algorithm (CRITICAL)

**MAME** (verified on real AY-3-8910 and YM2149 chips):
```cpp
// 17-bit shift register, bit0 XOR bit3 feedback
m_rng = (m_rng >> 1) | ((BIT(m_rng, 0) ^ BIT(m_rng, 3)) << 16);
```
- Initial value: `m_rng = 1`
- Produces a maximal-length 17-bit LFSR sequence (131071 values)
- Verified from die photographs by Dr. Stack van Hay

**Klive** (`PsgChip.ts`):
```typescript
this._noiseSeed = (this._noiseSeed * 2 + 1) ^
  (((this._noiseSeed >>> 16) ^ (this._noiseSeed >>> 13)) & 0x01);
```
- Initial value: `this._noiseSeed = 0`
- Different algorithm, different sequence
- Seed of 0 is problematic (LFSR may produce wrong initial sequence)

**Impact**: Different noise character. The MAME LFSR is hardware-verified. The noise sequence affects all noise-based sound effects (drums, explosions, wind, etc.).

### 3. Noise Prescaler (÷2 Division) (HIGH)

**MAME**:
```cpp
if ((++m_count_noise) >= noise_period()) {
    m_count_noise = 0;
    m_prescale_noise ^= 1;  // Toggle prescaler
    if (!m_prescale_noise)   // Only tick LFSR every OTHER time
        noise_rng_tick();
}
```
The noise counter has a ÷2 prescaler, so the LFSR only advances once every two periods.

**Klive**:
```typescript
if (this._cntNoise >= this._noiseFreq) {
    this._cntNoise = 0;
    // LFSR ticked immediately, no prescaler
    this._noiseSeed = ...;
}
```
No prescaler — LFSR ticks every period.

**Impact**: Klive noise runs at **2× the frequency** of real hardware. All noise effects will sound higher-pitched.

### 4. Tone Period = 0 Behavior (MEDIUM)

**MAME**:
```cpp
const int period = std::max<int>(1, tone->period);
```
Period 0 is treated as period 1 — produces the highest possible frequency.

**Klive**:
```typescript
if (this._toneA) {  // Period 0 → condition is false → no output
    this._cntA++;
    ...
}
```
Period 0 means the counter never ticks — no tone output for that channel.

**Impact**: Programs that set period 0 expecting maximum frequency will get silence in Klive.

### 5. Volume Table / DAC Curve (HIGH)

**MAME AY-3-8910** (from Matthew Westcott's real-chip measurements):
```
Level  Voltage    Resistor (Ω)
 0     1.147V     15950
 1     1.162V     15350
 2     1.169V     15090
 3     1.178V     14760
 4     1.192V     14275
 5     1.213V     13620
 6     1.238V     12890
 7     1.299V     11370
 8     1.336V     10600
 9     1.457V      8590
10     1.573V      7190
11     1.707V      5985
12     1.882V      4820
13     2.060V      3945
14     2.320V      3017
15     2.580V      2345
```
Uses MOSFET-based resistor model for accurate voltage-to-amplitude conversion.

**MAME YM2149** (different resistor network):
```
Resistor values: { 73770, 37586, 27458, 21451, 15864, 12371, 8922, 6796,
                    4763,  3521,  2403,  1737,  1123,   762,  438,  251 }
```

**Klive** (single table for all chip types):
```typescript
[0x0000, 0x0201, 0x033c, 0x04d7, 0x0783, 0x0ca6, 0x133e, 0x2393,
 0x2868, 0x45d4, 0x606a, 0x76ea, 0x97bc, 0xb8a6, 0xdc52, 0xffff]
```
Linear-ish spacing in 16-bit range with no physical circuit modeling.

**Impact**: Different volume curves affect relative loudness between levels. The AY chip has a roughly exponential curve matching human hearing. The YM2149 has a different curve. Klive uses the same table for both chip types, where ideally 128K (AY) and Next (YM) should use different curves.

### 6. Envelope Resolution: AY (16-step) vs YM (32-step) (MEDIUM)

**MAME**:
| Chip | Steps | Step Mask | Period Multiplier |
|------|-------|-----------|-------------------|
| AY-3-8910 | 16 | 0x0F | 2 (compensates for fewer steps) |
| YM2149 | 32 | 0x1F | 1 |

The AY envelope has 16 steps with the period doubled to maintain the same total envelope duration as the 32-step YM.

**Klive**: Uses 32-step envelopes (0-31) for all chip types, then shifts right by 1 to map to 16 volume levels: `(tmpVol & 0x1f) >> 1`. No period multiplier.

**Impact**: On the 128K (AY chip), envelopes should have 16 coarser steps with doubled period, not 32 fine steps. This changes the "staircase" shape of envelope waveforms. On the Next (YM), the 32-step behavior is correct.

### 7. Envelope Shape Reset Behavior (LOW-MEDIUM)

**MAME** (`set_shape()`):
```cpp
void set_shape(u8 shape, u8 mask) {
    attack = (shape & 0x04) ? mask : 0x00;
    if ((shape & 0x08) == 0) {
        hold = 1;
        alternate = attack;  // Maps shapes 0-7 to equiv. shapes with Continue=1
    } else {
        hold = shape & 0x01;
        alternate = shape & 0x02;
    }
    step = mask;  // Start at max (counts DOWN)
    holding = 0;
    volume = (step ^ attack);
}
```
- Step counts DOWN from mask
- Volume = step XOR attack
- Shapes 0-7 are mapped to equivalent shapes 8-15 (Continue=1 equivalents)

**Klive** (`initEnvelopData()`):
Precomputes a lookup table of 128 positions per shape, with `vol` tracking (0-31 range). Position increments up from 0.

**Impact**: The core envelopes should produce the same shapes, but edge cases in cycling/holding may differ. MAME uses real-time computation; Klive uses a precomputed table.

### 8. Register Read Masking (LOW)

**MAME** (AY-3-8910):
```cpp
const u8 mask[0x10] = {
    0xff, 0x0f, 0xff, 0x0f, 0xff, 0x0f, 0x1f, 0xff,
    0x1f, 0x1f, 0x1f, 0xff, 0xff, 0x0f, 0xff, 0xff
};
return m_regs[r] & mask[r];
```
Unused bits in registers read back as 0 on AY-3-8910. YM2149 returns all bits.

**Klive**: Returns the full stored value without masking:
```typescript
readPsgRegisterValue(): number {
    return this._regValues[this._psgRegisterIndex & 0x0f];
}
```

**Impact**: Programs that read PSG registers and rely on unused bits being 0 may get incorrect results. Low impact in practice but affects hardware accuracy.

### 9. 3D Cross-Channel Mixing (LOW-MEDIUM)

**MAME**: Implements `mix_3D()` which models the resistor network interaction between all three channels when they share a common load resistor. When all three channels output simultaneously, the combined voltage is not simply the sum due to current sharing.

**Klive**: Uses simple addition: `vol += volA + volB + volC`. No cross-channel interaction modeling.

**Impact**: When multiple channels play at high volume, the combined output should be slightly less than the simple sum due to the resistor network. This produces a subtle "compression" effect that Klive doesn't model. Low audible impact for most content.

### 10. Stereo Channel Routing: MAME vs Klive (Next) (MEDIUM)

**MAME** ACB stereo routing for Next:
```cpp
m_ay[i]->add_route(0, "lspeaker", 0.50);  // Ch A → Left at 50%
m_ay[i]->add_route(1, "lspeaker", 0.25);  // Ch B → Left at 25%
m_ay[i]->add_route(1, "rspeaker", 0.25);  // Ch B → Right at 25%
m_ay[i]->add_route(2, "rspeaker", 0.50);  // Ch C → Right at 50%
```
Channel B (center) is routed at **half** the level of A and C to preserve stereo field.

**Klive** (ACB mode):
```typescript
// ACB mode: Left = A + C, Right = B + C  (equal weight)
left = volA + volC;
right = volB + volC;
```
All channels are mixed at equal weight — no center-channel attenuation.

Note: Klive's ACB mode routing also appears wrong. MAME routes ACB as A→left, C→both(center), B→right. Klive routes it as A+C→left, B+C→right. The "B" and "C" channels appear swapped in Klive's ACB mode compared to MAME.

**Impact**: Stereo imaging is wider in MAME due to the center channel being quieter. Klive's equal-weight mixing makes the stereo field feel narrower/more mono. The swapped channels in ACB mode are clearly wrong.

### 11. Zero-Is-Off (YM2149 DC Offset) (LOW)

**MAME**:
- AY-3-8910: `zero_is_off = 1` — Volume 0 truly disconnects the output
- YM2149: `zero_is_off = 0` — Volume 0 still produces a small DC offset (~2V)

**Klive**: Volume table[0] = `0x0000` — always silent at volume 0 for both chip types.

**Impact**: Very subtle. On the YM2149, volume 0 should produce a tiny residual output. Inaudible in most cases.

### 12. Tone Counter Carry-Over (LOW)

**MAME**:
```cpp
tone->count += 1;
while (tone->count >= period) {
    tone->count -= period;  // Carries over fractional remainder
    ...
}
```
Uses a `while` loop with subtraction — if the count overshoots by more than one period (shouldn't happen normally), it handles it properly.

**Klive**:
```typescript
this._cntA++;
if (this._cntA >= this._toneA) {
    this._cntA = 0;  // Hard reset, no carry-over
    ...
}
```
Hard resets counter to 0, discarding any remainder. This is fine since the counter only increments by 1, so it can overshoot by at most 0.

**Impact**: Negligible — in practice the overshoot is always 0 or 1.

---

## Implementation Plan

### Phase 1: Mixer Logic Fix (CRITICAL — Affects all PSG audio)

**Files**: `src/emu/machines/zxSpectrum128/PsgChip.ts`

Fix `generateOutputValue()` and `getChannelXVolume()` methods to use MAME's hardware-correct mixer formula:
```
vol_enabled = (tone_output | tone_disable) & (noise_output | noise_disable)
```

Changes:
1. When both tone and noise are **enabled** for a channel: output = amplitude only when BOTH tone_bit AND noise_bit are HIGH (AND logic, not OR)
2. When both tone and noise are **disabled**: output = amplitude (always on, volume-only modulation)
3. When only one is enabled: output follows that signal

This changes `generateOutputValue()` and the three `getChannelXVolume()` methods.

**Tests to update**: `test/audio/PsgDevice.test.ts`, `test/audio/PsgChip.step1.test.ts`, `test/audio/PsgCompatibility.step14.test.ts`

### Phase 2: Noise Generator Fix (CRITICAL — Affects all noise effects)

**Files**: `src/emu/machines/zxSpectrum128/PsgChip.ts`

Two sub-tasks:

**2a. Fix LFSR algorithm** to match the hardware-verified 17-bit shift register:
```typescript
// Correct: bit0 XOR bit3 feedback into bit16
this._noiseSeed = (this._noiseSeed >> 1) |
  (((this._noiseSeed & 1) ^ ((this._noiseSeed >> 3) & 1)) << 16);
this._bitNoise = (this._noiseSeed & 1) !== 0;
```

**2b. Add ÷2 prescaler** to noise counter:
```typescript
private _noisePrescale = false;

// In generateOutputValue():
if (this._cntNoise >= this._noiseFreq) {
    this._cntNoise = 0;
    this._noisePrescale = !this._noisePrescale;
    if (!this._noisePrescale) {
        // Tick LFSR only every other period
        this._noiseSeed = ...;
        this._bitNoise = ...;
    }
}
```

**2c. Fix initial seed** from 0 to 1.

**Tests to update**: `test/audio/PsgDevice.test.ts` (noise tests), `test/audio/PsgCompatibility.step14.test.ts`

### Phase 3: Volume Table / DAC Curve (HIGH — Affects overall sound character)

**Files**: `src/emu/machines/zxSpectrum128/PsgChip.ts`

Two sub-tasks:

**3a. Implement separate volume curves** for AY-3-8910 and YM2149:

The AY curve (from MAME's `ay8910_param` resistor model, normalized to 0-65535):
```typescript
// AY-3-8910 volume table (from real-chip measurements)
private static readonly AY_VOLUME_TABLE: number[] = [
    0, 836, 1212, 1773, 2619, 3875, 5765, 8589,
    10207, 17157, 24956, 32768, 43520, 55424, 65120, 65535
];

// YM2149 volume table (from ym2149_param resistor model)
private static readonly YM_VOLUME_TABLE: number[] = [
    0, 0, 1057, 1521, 2130, 2987, 4119, 5765,
    7783, 10207, 13311, 17157, 23420, 32768, 43520, 65535
];
```

**3b. Select curve based on chip type**: Add a `chipType` parameter (AY or YM) to PsgChip constructor enabling the proper table selection.

For 128K machines: use AY table.
For Next machines: use YM table.

**Tests to update**: All tests that check specific output amplitude values.

### Phase 4: Tone Period 0 Handling (MEDIUM)

**Files**: `src/emu/machines/zxSpectrum128/PsgChip.ts`

Change tone counter logic to treat period 0 as period 1:
```typescript
// Instead of: if (this._toneA) { this._cntA++; ... }
// Use: 
const periodA = this._toneA || 1;  // Period 0 → 1
this._cntA++;
if (this._cntA >= periodA) {
    this._cntA = 0;
    this._bitA = !this._bitA;
}
```

Apply to all three channels.

**Tests to update**: May need new tests for period-0 behavior.

### Phase 5: Envelope AY/YM Differentiation (MEDIUM)

**Files**: `src/emu/machines/zxSpectrum128/PsgChip.ts`

Two sub-tasks:

**5a. AY envelope: 16 steps with ×2 period multiplier**:
For AY chip type, envelope should have 16 steps (mask 0x0F) with the period doubled internally to maintain the same total duration.

**5b. YM envelope: 32 steps with ×1 period multiplier**:
For YM chip type, envelope has 32 steps (mask 0x1F) with normal period.

This requires modifying `initEnvelopData()` and the envelope advancement in `generateOutputValue()` to use chip-type-dependent step masks and period multipliers.

### Phase 6: Stereo Routing Fix (MEDIUM — Next only)

**Files**: `src/emu/machines/zxNext/TurboSoundDevice.ts`

Fix `getChipStereoOutput()` stereo routing to match MAME:

**ABC mode** (standard):
- Left = Channel A (100%) + Channel B (50%)
- Right = Channel B (50%) + Channel C (100%)

**ACB mode**:
- Left = Channel A (100%) + Channel C (50%)
- Right = Channel C (50%) + Channel B (100%)

The center channel (B in ABC, C in ACB) should be routed at half amplitude to each side, matching MAME's 0.50/0.25/0.25/0.50 routing.

**Tests to update**: `test/audio/TurboSoundDevice.step3.test.ts`, `test/audio/TurboSoundDevice.step4.test.ts`

### Phase 7: Register Read Masking (LOW)

**Files**: `src/emu/machines/zxSpectrum128/PsgChip.ts`

Add register read masks for AY-3-8910 chip type:
```typescript
private static readonly AY_READ_MASKS = [
    0xff, 0x0f, 0xff, 0x0f, 0xff, 0x0f, 0x1f, 0xff,
    0x1f, 0x1f, 0x1f, 0xff, 0xff, 0x0f, 0xff, 0xff
];

readPsgRegisterValue(): number {
    const raw = this._regValues[this._psgRegisterIndex & 0x0f];
    return this._chipType === 'AY' ? raw & PsgChip.AY_READ_MASKS[this._psgRegisterIndex] : raw;
}
```

### Phase 8: AudioMixer PSG AC Coupling Fix (MEDIUM)

**Files**: `src/emu/machines/zxNext/AudioMixerDevice.ts`

The current mixer has a "conditional AC coupling" that only applies DC bias removal when the PSG output is non-zero. This creates a DC offset jump when PSG transitions between active and silent. The AC coupling should be applied consistently regardless of signal level, or the PSG hardware's natural DC behavior should be modeled properly.

---

## Priority Summary

| Phase | Description | Priority | Impact |
|-------|-------------|----------|--------|
| 1 | Mixer logic (AND vs OR) | CRITICAL | All PSG audio |
| 2 | Noise LFSR + prescaler | CRITICAL | All noise effects |
| 3 | Volume table / DAC curve | HIGH | Overall sound character |
| 4 | Tone period 0 handling | MEDIUM | Edge case programs |
| 5 | Envelope AY/YM steps | MEDIUM | Envelope-heavy music |
| 6 | Stereo routing fix | MEDIUM | Next stereo field |
| 7 | Register read masking | LOW | Hardware accuracy |
| 8 | AudioMixer AC coupling | MEDIUM | PSG clarity |

## Notes

- Phases 1-2 should be done first as they fix fundamental sound generation bugs
- Phase 3 (volume curves) will change many test assertions but is important for authentic sound
- Phases 4-5 require the `chipType` parameter added in Phase 3
- Phase 6 only affects the ZX Next model
- All changes should maintain backward compatibility with existing save states
- Each phase should include running the full test suite (`npx vitest run --config build/vitest.config.ts`) to catch regressions
