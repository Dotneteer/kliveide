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
/**
 * Output gain on the audio_mixer.vhd sum (see getMixedOutput): a full YM channel (255) comes out at
 * 7507, its level before the mixer followed the VHDL proportions.
 */
export const MIXER_GAIN = 29.44;

export class AudioMixerDevice {
  private dac: DacDevice;

  // Audio source levels (boolean flags or values)
  private earLevel: number = 0; // 0 or 512
  private micLevel: number = 0; // 0 or 128
  private psgOutput: AudioSample = { left: 0, right: 0 };
  private dacOutputOverride: AudioSample | undefined;
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
   * @param level DC-filtered beeper sample (-1.0 to +1.0). The BeeperDevice
   *   already applies a DC high-pass filter, so this is an AC-coupled signal.
   * Converts to internal amplitude range: -512 to +512.
   */
  setEarLevel(level: number): void {
    // Convert normalized AC signal to internal amplitude scale
    this.earLevel = Math.round(level * 512);
  }

  /**
   * Get EAR (Beeper) output level
   */
  getEarLevel(): number {
    return this.earLevel;
  }

  /**
   * Set MIC input level.
   * @param level DC-filtered MIC sample in [-1.0, +1.0] (from BeeperDevice right channel).
   * Converts to internal amplitude: Math.round(level * 128).
   * Backward-compatible: setMicLevel(0) → 0, setMicLevel(1) → 128.
   */
  setMicLevel(level: number): void {
    this.micLevel = Math.round(level * 128);
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
   * The DAC sides (0-510) to mix instead of the DAC device's current output - the level recorded at
   * the time of the sample being mixed. `undefined` returns to the current output.
   */
  setDacOutput(output: AudioSample | undefined): void {
    this.dacOutputOverride = output;
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
   * Mixes the current sources into one output sample (normalized to -1.0..+1.0 for Web Audio), in the
   * proportions of audio_mixer.vhd: `pcm = ear + mic + ay + dac + i2s` per side.
   */
  getMixedOutput(): AudioSample {
    // --- audio_mixer.vhd: pcm = ear + mic + ay + dac + i2s, each side on its own, in these units:
    // --- EAR 512 and MIC 128 while high, a full YM channel 255 (the PSG output is that table x 257),
    // --- one DAC channel 4 per step. The beeper arrives DC-filtered (-1..+1) and the DACs are taken
    // --- about their $80 centre, so silence stays 0; the AY stays unipolar, as before.
    // --- MIXER_GAIN maps the sum to the 16-bit range: chosen (2026-09-18) so that a full AY channel
    // --- keeps the level it had before the mixer followed the VHDL proportions. Stacked sources above
    // --- ~1110 units clamp.
    const dacOutput = this.dacOutputOverride ?? this.dac.getStereoOutput();
    const side = (psg: number, dac: number) =>
      this.earLevel + this.micLevel + psg / 257 + (dac - 256) * 4;
    const mixedLeft = side(this.psgOutput.left, dacOutput.left);
    const mixedRight = side(this.psgOutput.right, dacOutput.right);

    let left = Math.trunc(mixedLeft * MIXER_GAIN);
    let right = Math.trunc(mixedRight * MIXER_GAIN);

    // Apply master volume scale (before final clamp)
    left = Math.floor(left * this.volumeScale);
    right = Math.floor(right * this.volumeScale);

    // Final clamp to 16-bit signed range
    left = Math.max(-32768, Math.min(32767, left));
    right = Math.max(-32768, Math.min(32767, right));

    // Normalize to Web Audio API range (-1.0 to +1.0)
    const normalizedLeft = left / 32768.0;
    const normalizedRight = right / 32768.0;

    // Capture for diagnostics (before normalization for easier reading)
    if (this._mixerCaptureStarted) {
      this._mixerCapturedSamples.push(left);
    }

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
    // Nothing to reset for mixer (stateless per-sample processing)
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
