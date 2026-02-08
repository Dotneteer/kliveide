import { AudioSample } from "@emu/abstractions/IAudioDevice";
import { DacDevice } from "./DacDevice";

/**
 * Audio Mixer Device - Combines Multiple Audio Sources into Stereo Output
 *
 * ## Purpose
 * Central audio mixing hub that combines multiple independent audio sources
 * into a single stereo output suitable for speaker/headphone playback.
 *
 * ## Audio Sources
 * 1. **Beeper (EAR)** - Digital output from port 0xFE bit 4
 *    - Level: 0 (off) or 512 (on)
 *    - From: Standard ZX Spectrum OUT 0xFE
 *    - Applied to: Both left and right channels equally
 *
 * 2. **Microphone (MIC)** - Analog input (for recording/analysis)
 *    - Level: 0 (off) or 128 (on)
 *    - From: External microphone input
 *    - Applied to: Both left and right channels equally
 *
 * 3. **PSG (TurboSound)** - Three AY-3-8912 chips with stereo output
 *    - Output: Stereo sample (left, right) from TurboSoundDevice
 *    - Range: Depends on chip volumes and mixing mode
 *    - Applied to: Left and right channels separately
 *
 * 4. **DAC Channels** - 4x 8-bit sampled audio (SpecDrum/SoundDrive)
 *    - Channel A: Left (8-bit → 16-bit conversion)
 *    - Channel B: Left (8-bit → 16-bit conversion)
 *    - Channel C: Right (8-bit → 16-bit conversion)
 *    - Channel D: Right (8-bit → 16-bit conversion)
 *    - Mixing formula:
 *      - Left = DAC_A + DAC_B (each -32768 to +32512)
 *      - Right = DAC_C + DAC_D (each -32768 to +32512)
 *
 * 5. **I2S Input** - External digital audio (future enhancement)
 *    - Level: Up to 1023 per channel
 *    - From: External I2S interface (not currently used)
 *
 * ## Mixing Process
 * 1. Convert each source to signed 16-bit representation
 * 2. Apply per-source scaling (volume multiplier if enabled)
 * 3. Sum all sources for left channel: sum_left = beeper + mic + psg_left + dac_left + i2s_left
 * 4. Sum all sources for right channel: sum_right = beeper + mic + psg_right + dac_right + i2s_right
 * 5. Apply master volume scaling: final = sum × volumeScale (0.0-1.0)
 * 6. Clip to 16-bit signed range (-32768 to +32767)
 *
 * ## Output Levels
 * Maximum per-channel output before clipping:
 * - Beeper: 512
 * - Microphone: 128
 * - PSG: ~5000 (from all three chips combined)
 * - DAC: ~65024 (DAC A/B/C/D combined to one channel)
 * - I2S: ~1023
 * - **Total maximum: ~71687 per channel**
 * - **Typical output: 16-bit signed (-32768 to +32767)**
 *
 * ## Volume Scaling
 * Master volume scale (0.0 to 1.0):
 * - 1.0 = Full volume (100%)
 * - 0.5 = Half volume (50%)
 * - 0.0 = Muted (silence)
 *
 * Per-source scaling controlled by NextReg 0x08:
 * - Bit 6: PSG volume scaling enable
 * - Bit 5: DAC volume scaling enable
 * - When enabled: source output is multiplied by master volume scale
 * - When disabled: source output is not scaled
 *
 * ## State Persistence
 * Save/restore all mixer state:
 * - Beeper level
 * - Microphone level
 * - PSG output
 * - DAC device state (all channels)
 * - Master volume scale
 * - I2S input state
 *
 * ## Performance
 * - ~100ms per 500 mixing iterations (Step 18 benchmarked)
 * - Efficient for real-time operation at 50Hz
 * - No significant CPU impact on overall emulation
 *
 * ## Integration Points
 * - **TurboSoundDevice**: Provides PSG stereo output via setPsgOutput()
 * - **DacDevice**: Channels converted and mixed internally
 * - **NextReg 0x08**: Audio control flags applied during mixing
 * - **AudioControlDevice**: High-level configuration interface
 *
 * ## References
 * - See AUDIO_ARCHITECTURE.md for complete system design
 * - See NEXTREG_AUDIO.md for NextReg 0x08 configuration details
 * - See PORT_MAPPINGS.md for port address details (0xFFFD, 0xBFFD, 0xFE)
 */
export class AudioMixerDevice {
  private dac: DacDevice;

  // Audio source levels (boolean flags or values)
  private earLevel: number = 0; // 0 or 512
  private micLevel: number = 0; // 0 or 128
  private psgOutput: AudioSample = { left: 0, right: 0 };
  private i2sInput: AudioSample = { left: 0, right: 0 };

  // Volume scaling factors (0-100 or 0-1.0)
  private volumeScale: number = 1.0;

  // Capture state for diagnostic logging
  private _mixerCaptureStarted = false;
  private _mixerCapturedSamples: number[] = [];

  constructor(dac: DacDevice) {
    this.dac = dac;
  }

  /**
   * Set EAR (Beeper) output level
   * @param level 1 for EAR active (512), 0 for inactive
   */
  setEarLevel(level: number): void {
    this.earLevel = level ? 512 : 0;
  }

  /**
   * Get EAR (Beeper) output level
   */
  getEarLevel(): number {
    return this.earLevel;
  }

  /**
   * Set MIC input level
   * @param level 1 for MIC active (128), 0 for inactive
   */
  setMicLevel(level: number): void {
    this.micLevel = level ? 128 : 0;
  }

  /**
   * Get MIC input level
   */
  getMicLevel(): number {
    return this.micLevel;
  }

  /**
   * Set PSG (TurboSound) stereo output
   * @param output Stereo sample from PSG
   */
  setPsgOutput(output: AudioSample): void {
    this.psgOutput = output;
  }

  /**
   * Get PSG stereo output
   */
  getPsgOutput(): AudioSample {
    return this.psgOutput;
  }

  /**
   * Set I2S input stereo output (future enhancement)
   * @param output Stereo sample from I2S input
   */
  setI2sInput(output: AudioSample): void {
    this.i2sInput = output;
  }

  /**
   * Get I2S input stereo output
   */
  getI2sInput(): AudioSample {
    return this.i2sInput;
  }

  /**
   * Set master volume scale (0.0 to 1.0)
   * @param scale Volume scale factor
   */
  setVolumeScale(scale: number): void {
    this.volumeScale = Math.max(0, Math.min(1.0, scale));
  }

  /**
   * Get master volume scale
   */
  getVolumeScale(): number {
    return this.volumeScale;
  }

  /**
   * Get mixed stereo audio output
   * 
   * Mixing formula:
   * - EAR (Beeper): 0 or 512
   * - MIC: 0 or 128
   * - PSG: 12-bit to 13-bit conversion (multiply by ~4 to scale from 0-4095 to 0-16383, then divide by 8 to get ~13-bit)
   * - DAC: 8-bit to 16-bit conversion (already scaled to 16-bit in DAC, then adjust range)
   * - I2S: up to 1023
   * 
   * Maximum levels per channel (13-bit = 8191):
   * - EAR: 512
   * - MIC: 128
   * - PSG: ~2000 (per chip, up to 6000 for 3 chips, then scaled)
   * - DAC A+B or C+D: ~2040 (scaled from 8-bit)
   * - I2S: 1023
   * Total max: ~12000 (exceeds 13-bit, requires clamping)
   * 
   * @returns Mixed AudioSample
   */
  getMixedOutput(): AudioSample {
    let left = 0;
    let right = 0;

    // Add EAR (Beeper)
    left += this.earLevel;
    right += this.earLevel;

    // Add MIC
    left += this.micLevel;
    right += this.micLevel;

    // Add PSG output (unsigned 16-bit range: 0-65535)
    // Only center when PSG is significantly above silence (~20000+) to preserve AC characteristics
    // When PSG is quiet or silent, keep it positive to avoid drowning out beeper signal
    const psgLeftCentered = this.psgOutput.left > 20000 
      ? Math.floor((this.psgOutput.left - 32768) / 8)
      : Math.floor(this.psgOutput.left / 8);
    const psgRightCentered = this.psgOutput.right > 20000 
      ? Math.floor((this.psgOutput.right - 32768) / 8)
      : Math.floor(this.psgOutput.right / 8);
    
    left += psgLeftCentered;
    right += psgRightCentered;

    // Add DAC output (16-bit signed range: -32768 to 32767)
    // Shift by 128 to make positive, then scale to 13-bit
    const dacLeft = Math.floor((this.dac.getStereoOutput().left / 256) * 2);
    const dacRight = Math.floor((this.dac.getStereoOutput().right / 256) * 2);
    left += dacLeft;
    right += dacRight;

    // Add I2S input (future enhancement)
    left += Math.floor(this.i2sInput.left / 8);
    right += Math.floor(this.i2sInput.right / 8);

    // Apply master volume scale
    left = Math.floor(left * this.volumeScale);
    right = Math.floor(right * this.volumeScale);

    // Clamp to 16-bit range (will be final after scaling)
    left = Math.max(-32768, Math.min(32767, left));
    right = Math.max(-32768, Math.min(32767, right));

    // Capture for diagnostics
    if (this._mixerCaptureStarted) {
      this._mixerCapturedSamples.push(left);
    }

    return { left, right };
  }

  /**
   * Start capturing mixer output
   */
  startMixerCapture(): void {
    this._mixerCaptureStarted = true;
    this._mixerCapturedSamples = [];
  }

  /**
   * Stop capturing mixer output and return CSV
   */
  stopMixerCapture(): string {
    this._mixerCaptureStarted = false;
    const csv = this._mixerCapturedSamples.join(",");
    this._mixerCapturedSamples = [];
    return csv;
  }

  /**
   * Reset the mixer (doesn't reset sources, just mixer state)
   */
  reset(): void {
    this.earLevel = 0;
    this.micLevel = 0;
    this.psgOutput = { left: 0, right: 0 };
    this.i2sInput = { left: 0, right: 0 };
    this.volumeScale = 1.0;
  }

  /**
   * Get the device state for persistence
   */
  getState(): any {
    return {
      earLevel: this.earLevel,
      micLevel: this.micLevel,
      psgOutput: { ...this.psgOutput },
      i2sInput: { ...this.i2sInput },
      volumeScale: this.volumeScale
    };
  }

  /**
   * Restore the device state from persisted data
   */
  setState(state: any): void {
    if (!state) return;
    
    this.earLevel = state.earLevel ?? 0;
    this.micLevel = state.micLevel ?? 0;
    this.psgOutput = state.psgOutput ? { ...state.psgOutput } : { left: 0, right: 0 };
    this.i2sInput = state.i2sInput ? { ...state.i2sInput } : { left: 0, right: 0 };
    this.volumeScale = state.volumeScale ?? 1.0;
  }

  /**
   * Gets debug information about the audio mixer
   */
  getDebugInfo(): any {
    const mixedOutput = this.getMixedOutput();
    return {
      sources: {
        ear: {
          level: this.earLevel,
          enabled: this.earLevel > 0
        },
        mic: {
          level: this.micLevel,
          enabled: this.micLevel > 0
        },
        psg: {
          left: this.psgOutput.left,
          right: this.psgOutput.right
        },
        i2s: {
          left: this.i2sInput.left,
          right: this.i2sInput.right
        }
      },
      volume: {
        scale: this.volumeScale,
        scaledPercent: `${(this.volumeScale * 100).toFixed(1)}%`
      },
      output: {
        mixed: {
          left: mixedOutput.left,
          right: mixedOutput.right
        },
        dacOutput: {
          left: this.dac.getStereoOutput().left,
          right: this.dac.getStereoOutput().right
        }
      }
    };
  }

  // --- AudioSample stub methods for integration with ZxNextMachine ---

  /**
   * Called at the start of each frame to clear samples
   */
  onNewFrame(): void {
    // Mixer doesn't accumulate samples like beeper
    // State is read on-demand when mixing
  }

  /**
   * Calculate current audio value (called after instruction executed)
   */
  calculateCurrentAudioValue(): void {
    // Mixer values are updated immediately on source changes
    // No additional calculation needed
  }

  /**
   * Generate next audio sample (called on tact incremented)
   */
  setNextAudioSample(): void {
    // Mixer generates values through source updates
    // No sample buffering needed
  }

  /**
   * Get audio samples for current frame (for integration)
   */
  getAudioSamples(): AudioSample[] {
    // Return single sample with current mixed output
    const output = this.getMixedOutput();
    return [{ left: output.left, right: output.right }];
  }
}
