# Beeper Emulation: MAME vs Klive — Differences and Improvement Plan

## 1. MAME Beeper Implementation Summary

MAME uses a **`speaker_sound_device`** (in `sound/spkrdev.h`) which is a dedicated MAME
core sound device operating on a continuous audio stream driven by the emulation framework.

### Key characteristics

| Aspect | MAME |
|--------|------|
| **Device type** | `speaker_sound_device` — MAME built-in speaker with discrete levels |
| **Output levels** | 4 discrete levels: `{0.0, 0.33, 0.66, 1.0}` |
| **Level selection** | Uses **both bit 3 (MIC) and bit 4 (EAR)** of port `0xFE` as a 2-bit value — `BIT(data, 3, 2)` extracts bits 3–4 into a 0–3 index |
| **Timing** | Each call to `level_w()` is time-stamped by MAME's internal sound stream infrastructure, providing **sample-accurate** transitions at the exact CPU cycle |
| **Audio routing** | Single mono channel routed to `"speakers"` at 50% gain; cassette audio mixed at 5% |
| **Sample generation** | MAME's `speaker_sound_device` internally computes the waveform by interpolating between level transitions at the stream's native sample rate (typically 48 kHz) |
| **DC removal** | Handled internally by MAME's speaker device (high-pass filter built in) |
| **ZX Next** | Speaker routed to right channel (`speakers, 0.50, 1`); 4× DAC 8-bit R2R (`dac_byte_interface`) for DAC channels; 3× YM2149 for TurboSound PSG; internal speaker enable/beep flags via NR 0x06/0x08 |

### Critical detail: MIC bit contribution to speaker output

In MAME's `spectrum_ula_w()`:

```cpp
m_speaker->level_w(BIT(data, 3, 2)); // Extracts bits 3 and 4 → levels 0..3
```

This means:
- Bit 3 = 0, Bit 4 = 0 → level 0 → amplitude **0.00**
- Bit 3 = 1, Bit 4 = 0 → level 1 → amplitude **0.33**
- Bit 3 = 0, Bit 4 = 1 → level 2 → amplitude **0.66**
- Bit 3 = 1, Bit 4 = 1 → level 3 → amplitude **1.00**

This accurately reflects the real Spectrum hardware where **both the EAR and MIC lines
feed into a simple resistor mixer** before driving the internal speaker.

---

## 2. Klive Beeper Implementation Summary

Klive uses `SpectrumBeeperDevice` extending `AudioDeviceBase`.

### Key characteristics

| Aspect | Klive |
|--------|-------|
| **Device type** | `SpectrumBeeperDevice` extending `AudioDeviceBase` |
| **Output levels** | Binary only: `0.0` or `1.0` (based on EAR bit only) |
| **Level selection** | Uses **only bit 4 (EAR)** — `(value & 0x10) !== 0` |
| **Timing** | Samples generated on each tact increment via `setNextAudioSample()`, which checks `machine.tacts > _audioNextSampleTact` to emit one sample per audio-rate interval |
| **Audio routing** | Stereo (same value in both L and R); sent to AudioWorklet via interleaved Float32Array |
| **Sample generation** | Snapshot-based: captures the _current_ EAR bit state at the sampling instant; no interpolation between transitions within a sample period |
| **DC removal** | None in beeper (48K/128K). ZX Next mixer does manual AC coupling by subtracting midpoint when source is active |
| **ZX Next** | `AudioMixerDevice` combines EAR (0/512), MIC (0/128), PSG, DAC, I2S; AC-coupled per-source; gain scaling 5.5×; normalized to ±1.0 |

---

## 3. Key Differences

### 3.1. MIC bit ignored for speaker output (**HIGH IMPACT**)

**MAME** combines bit 3 (MIC) and bit 4 (EAR) into a 4-level speaker signal.  
**Klive** only uses bit 4 (EAR), ignoring bit 3's contribution to the speaker.

On real hardware, the MIC output line (bit 3 of port 0xFE) feeds through a resistor into
the speaker circuit. Many games and loaders produce distinct audio through the combination
of both bits. Some tape loading routines produce audible clicks/tones only via the MIC bit.

**Impact**: Some programs will sound incorrect or silent when they manipulate the MIC bit
for audio effects.

### 3.2. Binary vs 4-level output (**MEDIUM IMPACT**)

**MAME** outputs 4 discrete amplitude levels (0.0, 0.33, 0.66, 1.0).  
**Klive** outputs only 2 levels (0.0 or 1.0).

The missing intermediate levels (0.33, 0.66) mean the tonal quality differs, particularly
for programs that exploit the MIC/EAR combination to create crude multi-level audio.

### 3.3. Transition timing precision (**LOW-MEDIUM IMPACT**)

**MAME**: `level_w()` timestamps each transition at the exact CPU cycle within the audio
stream. The speaker device then interpolates between transitions at the output sample rate.
This means a level change mid-sample is correctly rendered as a fractional contribution.

**Klive**: Takes a snapshot of the current EAR bit at regular intervals
(`_audioNextSampleTact`). If the EAR bit toggles multiple times between sample points,
only the final state is captured. At a typical 48 kHz sample rate vs ~3.5 MHz CPU clock,
each sample period spans ~73 T-states, so multiple transitions can be lost.

**Impact**: High-frequency beeper effects (multi-channel engines like Tim Follin's,
Tritone, etc.) may lose detail. Simple beeper tones (BEEP command) are unaffected.

### 3.4. DC offset handling (**LOW IMPACT for 48K, MEDIUM for Next**)

**MAME**: The speaker device internally handles DC removal.  
**Klive 48K/128K**: Raw 0.0/1.0 values are sent directly to the audio output. A sustained
HIGH EAR bit produces a DC offset rather than silence.  
**Klive Next mixer**: Manually applies AC coupling per-source (subtracts midpoint), but
only when the source is active — resulting in a different DC profile than hardware.

### 3.5. ZX Next internal speaker control (**LOW IMPACT — already partially done**)

**MAME**: Implements NR 0x06 bit 6 (`internal_speaker_beep`) and NR 0x08 bit 4
(`internal_speaker_en`) to gate the speaker output.  
**Klive**: Has audio control device but does not clearly gate beeper output through
the internal speaker enable register.

### 3.6. Cassette audio not mixed into speaker (**VERY LOW IMPACT**)

**MAME** mixes cassette playback at 5% volume into the speaker output.  
**Klive** handles tape audio separately and does not mix it into the beeper stream.

---

## 4. Improvement Plan

### Phase 1: Add MIC bit contribution to beeper output (HIGH PRIORITY)

**Goal**: Match MAME's 4-level speaker model.

**Changes**:

1. **`SpectrumBeeperDevice`**: Change from binary `earBit` to a 4-level model.
   - Add `setOutputLevel(earBit: boolean, micBit: boolean)` method or extend
     `setEarBit()` to accept microphone bit.
   - Map the 2-bit combination to 4 amplitude levels matching MAME:
     ```
     (mic=0, ear=0) → 0.00
     (mic=1, ear=0) → 0.33
     (mic=0, ear=1) → 0.66
     (mic=1, ear=1) → 1.00
     ```
   - Update `getCurrentSampleValue()` to return the selected level.

2. **`ZxSpectrumBase.writePort0xFE()`**: Pass both bit 3 and bit 4 to the beeper device.
   - Currently: `this.beeperDevice.setEarBit(bit4 !== 0)`
   - Change to: `this.beeperDevice.setOutputLevel(!!(value & 0x10), !!(value & 0x08))`

3. **`ZxNextMachine` (UlaDevice)**: Same change for the Next's ULA write handler.

4. **`AudioMixerDevice`**: Update EAR level to accept 4 discrete amplitudes rather than
   binary 0/512. Adjust AC coupling midpoint accordingly, or remap levels so 0.0=0,
   0.33=170, 0.66=341, 1.0=512.

5. **Tests**: Update `BeeperDevice.test.ts` to verify all 4 output levels.

**Estimated scope**: ~6 files, backward-compatible interface change.

### Phase 2: Improve sample timing accuracy (MEDIUM PRIORITY)

**Goal**: Capture level transitions within inter-sample periods for more accurate rendering
of high-frequency beeper effects.

**Changes**:

1. **`AudioDeviceBase`**: Instead of capturing a single snapshot per sample period,
   accumulate a weighted average of the beeper level based on how many T-states each
   level was active during the sample period.
   - Track `_lastLevelChangeTact` and `_currentLevel`.
   - In `setNextAudioSample()`, compute:
     ```
     sampleValue = (level1 * duration1 + level2 * duration2 + ...) / totalDuration
     ```
   - This matches MAME's approach of timestamped transitions interpolated to sample rate.

2. **`SpectrumBeeperDevice`**: Override to record level changes with timestamps:
   - When `setOutputLevel()` is called, push `{tact, level}` to a transition buffer.
   - In `getCurrentSampleValue()`, integrate over the transition buffer for the current
     sample window.

3. **Tests**: Add tests with rapid bit toggles within a single sample period to verify
   averaging produces intermediate values.

**Estimated scope**: Core change to `AudioDeviceBase` + `SpectrumBeeperDevice`, ~3 files.

### Phase 3: DC offset filtering (LOW PRIORITY)

**Goal**: Remove DC bias from the beeper output so a constant HIGH state doesn't produce
a DC offset.

**Changes**:

1. Add a simple high-pass (AC coupling) filter to `AudioDeviceBase` or the
   `AudioRenderer`:
   ```
   y[n] = α × (y[n-1] + x[n] - x[n-1])  where α ≈ 0.995
   ```
   This removes DC drift while preserving the audible square-wave signal.

2. For the ZX Next mixer: replace the ad-hoc per-source AC coupling with a unified
   high-pass filter applied after mixing.

**Estimated scope**: ~2 files, small filter kernel.

### Phase 4: ZX Next internal speaker gating (LOW PRIORITY)

**Goal**: Honor NR 0x06 bit 6 and NR 0x08 bit 4 (internal speaker enable controls).

**Changes**:

1. When `internal_speaker_en` is cleared, mute the beeper contribution in the mixer.
2. When `internal_speaker_beep` is set, the speaker outputs only a system beep
   (ignore beeper bit); when cleared, normal operation.
3. Verify with existing `AudioControlDevice` tests.

**Estimated scope**: ~2 files, conditional checks only.

---

## 5. Priority Summary

| Phase | Description | Impact | Effort |
|-------|-------------|--------|--------|
| 1 | MIC bit → 4-level speaker | **High** | Medium |
| 2 | Transition-accurate sampling | **Medium** | Medium |
| 3 | DC offset filter | **Low** | Small |
| 4 | Next speaker gating | **Low** | Small |

Phase 1 should be done first as it fixes a clear hardware inaccuracy visible in many
programs. Phase 2 significantly improves multi-channel beeper engines. Phases 3–4 are
polish items.
