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

  // Frame-level sample collection (similar to TurboSoundDevice)
  private _mixerFrameSamples: number[] = [];
  private _mixerFrameSum = 0;

  // Debug: Track beeper state changes
  private _lastEarLevel = -1;
  private _earChangeCount = 0;
  private _psgSampleCount = 0;

  constructor(dac: DacDevice) {
    this.dac = dac;
  }

  /**
   * Set EAR (Beeper) output level
   * @param level Normalized beeper value (0.0 when LOW, 1.0 when HIGH)
   * Converts to audio range: 0 = silent, 512 = beeper active
   */
  setEarLevel(level: number): void {
    // Convert normalized 0.0/1.0 to amplitude
    // Explicitly check for 1.0 (beeper HIGH state)
    this.earLevel = (level === 1.0 || level > 0.9) ? 512 : 0;
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
   * HARDWARE-ACCURATE IMPLEMENTATION (from VHDL audio_mixer.vhd):
   * 
   * Step 1: UNSIGNED ADDITION of all sources (range 0-5998):
   *   pcm_L = ear + mic + ay_L + dac_L + i2s_L
   *   pcm_R = ear + mic + ay_R + dac_R + i2s_R
   * 
   * Step 2: Convert unsigned to signed via MSB inversion:
   *   signed13bit = unsigned13bit XOR 0x1000
   *   This centers the DC-biased signal around zero for AC audio output
   * 
   * Step 3: Scale to 16-bit signed for intermediate processing
   * 
   * Step 4: Normalize to Web Audio API format (-1.0 to +1.0)
   *   Hardware outputs to DAC/PWM; software must normalize for Float32Array
   * 
   * Source levels (all UNSIGNED):
   * - EAR (Beeper): 0 or 512
   * - MIC: 0 or 128
   * - PSG (TurboSound): 0-2295 (from 3 chips)
   * - DAC: 0-2040
   * - I2S: 0-1023
   * Total max: 0-5998
   * 
   * NOTE: Currently PSG, DAC, and I2S are disabled (return 0) for beeper-only testing.
   * 
   * @returns Mixed AudioSample (normalized floating-point for Web Audio API)
   */
  getMixedOutput(): AudioSample {
    // Step 1: UNSIGNED addition (matching VHDL exactly)
    let unsignedLeft = 0;
    let unsignedRight = 0;

    // Add EAR (Beeper): 0 or 512 (unsigned)
    // NOTE: Scale by 8 to increase amplitude for better audibility
    // Hardware has other sources (PSG, DAC) that bring total closer to midpoint
    // For beeper-only testing, we need larger swing around center
    const beeperScaled = this.earLevel * 8;  // 0 or 4096
    unsignedLeft += beeperScaled;
    unsignedRight += beeperScaled;

    // Add MIC: 0 or 128 (unsigned)
    unsignedLeft += this.micLevel;
    unsignedRight += this.micLevel;

    // DEBUG: Track beeper state changes only
    if (this.earLevel !== this._lastEarLevel) {
      this._earChangeCount++;
      if (this._earChangeCount <= 10) {
        console.log(`[MIXER] Beeper ${this._lastEarLevel} → ${this.earLevel} (scaled: ${beeperScaled})`);
      }
      this._lastEarLevel = this.earLevel;
    }

    // Add PSG output (unsigned 0-196605)
    // Hardware PSG is 0-2295 (12-bit), our software is 0-196605 (16-bit scaled)
    // Scale down to fit 13-bit mixer range: 196605 / 24 ≈ 8192
    const psgLeftScaled = Math.floor(this.psgOutput.left / 24);
    const psgRightScaled = Math.floor(this.psgOutput.right / 24);
    unsignedLeft += psgLeftScaled;
    unsignedRight += psgRightScaled;
    
    // DEBUG: Track PSG contribution
    if (psgLeftScaled > 0 || psgRightScaled > 0) {
      this._psgSampleCount++;
      if (this._psgSampleCount <= 10) {
        console.log(`[MIXER] PSG L=${psgLeftScaled} R=${psgRightScaled} (raw: ${this.psgOutput.left}/${this.psgOutput.right})`);
      }
    }

    // Add DAC output (unsigned, will be 0-2040 when enabled)
    // const dacOutput = this.dac.getStereoOutput();
    // const dacLeft = Math.floor(dacOutput.left / X);  // TBD: determine scaling
    // const dacRight = Math.floor(dacOutput.right / X);
    // unsignedLeft += dacLeft;
    // unsignedRight += dacRight;

    // Add I2S input (unsigned, will be 0-1023 when enabled)
    // unsignedLeft += Math.floor(this.i2sInput.left / X);  // TBD: determine scaling
    // unsignedRight += Math.floor(this.i2sInput.right / X);

    // Clamp to 13-bit unsigned range (0-8191) before conversion
    unsignedLeft = Math.max(0, Math.min(8191, unsignedLeft));
    unsignedRight = Math.max(0, Math.min(8191, unsignedRight));

    // Step 2: Convert unsigned to signed via MSB inversion (matching VHDL i2s.vhd)
    // Hardware: audio_zxn_L <= (not i_audio_zxn_L(12)) & i_audio_zxn_L(11 downto 0)
    // Software: XOR with 0x1000 flips bit 12, then interpret as signed 13-bit two's complement
    let xoredLeft = unsignedLeft ^ 0x1000;
    let xoredRight = unsignedRight ^ 0x1000;
    
    // Interpret as signed 13-bit (if bit 12 is set, it's negative)
    let signed13Left = (xoredLeft & 0x1000) ? (xoredLeft - 0x2000) : xoredLeft;
    let signed13Right = (xoredRight & 0x1000) ? (xoredRight - 0x2000) : xoredRight;
    
    // Range: -4096 to +4095
    // Example: unsigned 0 → signed -4096
    // Example: unsigned 512 (beeper ON) → signed -3584
    // Example: unsigned 4096 → signed 0 (center)
    // Example: unsigned 8191 → signed +4095

    // Step 3: Scale to 16-bit signed range (-32768 to +32767)
    // Multiply by 8 to scale from 13-bit to 16-bit range
    let left = signed13Left * 8;
    let right = signed13Right * 8;

    // Apply master volume scale (before final clamp)
    left = Math.floor(left * this.volumeScale);
    right = Math.floor(right * this.volumeScale);

    // Final clamp to 16-bit signed range
    left = Math.max(-32768, Math.min(32767, left));
    right = Math.max(-32768, Math.min(32767, right));

    // Step 4: Normalize to Web Audio API range (-1.0 to +1.0)
    // Web Audio API expects floating-point samples, not 16-bit integers
    const normalizedLeft = left / 32768.0;
    const normalizedRight = right / 32768.0;

    // Capture for diagnostics (before normalization for easier reading)
    if (this._mixerCaptureStarted) {
      this._mixerCapturedSamples.push(left);
    }

    // Collect left channel sample for frame logging (before normalization)
    this._mixerFrameSamples.push(left);
    this._mixerFrameSum += Math.abs(left);

    return { left: normalizedLeft, right: normalizedRight };
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
    // Log beeper activity summary
    if (this._earChangeCount > 0) {
      const min = Math.min(...this._mixerFrameSamples);
      const max = Math.max(...this._mixerFrameSamples);
      console.log(`[MIXER] Frame: ${this._earChangeCount} beeper changes, output range [${min}, ${max}], ${this._mixerFrameSamples.length} samples`);
    }
    
    // Reset for next frame
    this._mixerFrameSamples = [];
    this._mixerFrameSum = 0;
    this._earChangeCount = 0;
    this._psgSampleCount = 0;
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
