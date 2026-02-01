import { AudioSample } from "@emu/abstractions/IAudioDevice";
import { DacDevice } from "./DacDevice";

/**
 * Audio Mixer Device for ZX Spectrum Next
 * Combines multiple audio sources into a single stereo output:
 * - Beeper (EAR) - 0 or 512 level
 * - Microphone (MIC) - 0 or 128 level
 * - TurboSound PSG chips - stereo output
 * - DAC channels - stereo output
 * - External I2S input (future) - up to 1023 level
 * 
 * Output range: 0-5998 per channel (13-bit)
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

    // Add PSG output (12-bit range: 0-65535)
    // Scale to mix with other sources: divide by 8 to bring into similar range
    left += Math.floor(this.psgOutput.left / 8);
    right += Math.floor(this.psgOutput.right / 8);

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

    return { left, right };
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
}
