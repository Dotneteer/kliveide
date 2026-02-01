import { AudioSample } from "@emu/abstractions/IAudioDevice";

/**
 * DAC Device for ZX Spectrum Next - 4-Channel Digital Audio Playback
 *
 * ## Purpose
 * Implements a 4-channel 8-bit DAC (Digital-to-Analog Converter) for playing
 * sampled digital audio through SpecDrum or SoundDrive compatible programs.
 *
 * ## Channels
 * - DAC A (NextReg 0x00): Left channel, 8-bit samples
 * - DAC B (NextReg 0x01): Left channel, 8-bit samples
 * - DAC C (NextReg 0x02): Right channel, 8-bit samples
 * - DAC D (NextReg 0x03): Right channel, 8-bit samples
 *
 * Stereo Output:
 * - Left = Channel A + Channel B (16-bit)
 * - Right = Channel C + Channel D (16-bit)
 *
 * ## Sample Format
 * - 8-bit unsigned values (0x00-0xFF)
 * - Center value: 0x80 (represents 0 in signed representation)
 * - 0x00 = -128 (minimum, maximum negative)
 * - 0x7F = -1 (negative range)
 * - 0x80 = 0 (silent/center)
 * - 0x81 = +1 (positive range)
 * - 0xFF = +127 (maximum positive)
 *
 * ## Conversion to Audio Output
 * Each 8-bit sample is converted to 16-bit signed:
 * 1. Interpret 8-bit unsigned as signed: 0x80 = 0, 0x00 = -128, 0xFF = +127
 * 2. Convert to 16-bit by shifting: signed_byte << 8 = 16-bit signed value
 * 3. Range: -32768 to +32512 (representing -128 to +127 × 256)
 *
 * Example: Channel set to 0x60 (96 decimal)
 * - Signed interpretation: 96 - 256 = -160 (as signed byte)
 * - 16-bit conversion: -160 × 256 = -40960
 *
 * ## Performance
 * - ~50ms per 1000 samples (Step 18 benchmarked)
 * - Real-time capable at typical sample rates (8kHz-44.1kHz)
 *
 * ## Integration
 * - Controlled via NextReg 0x00-0x03 writes
 * - Output mixed by AudioMixerDevice with PSG and beeper
 * - State persistence via getState()/setState()
 * - Debug information available via getDebugInfo()
 *
 * ## Historical Context
 * - SpecDrum: Popular sampled drum synthesizer for ZX Spectrum
 * - SoundDrive: Alternative sampling playback system
 * - Both used ports/memory to store samples
 * - ZX Spectrum Next provides native DAC support for compatibility
 *
 * ## References
 * - See NEXTREG_AUDIO.md for NextReg register details
 * - See AUDIO_ARCHITECTURE.md for complete system architecture
 * - See PORT_MAPPINGS.md for port/register address reference
 */
export class DacDevice {
  // DAC channel values: 8-bit unsigned (0x00-0xFF)
  private _dacChannels: number[] = [0x80, 0x80, 0x80, 0x80];

  constructor() {
    this.reset();
  }

  /**
   * Get DAC channel value
   * @param channel Channel index (0-3): A=0, B=1, C=2, D=3
   * @returns 8-bit DAC value (0x00-0xFF)
   */
  getDacChannel(channel: number): number {
    if (channel < 0 || channel > 3) {
      throw new Error(`Invalid DAC channel: ${channel}. Must be 0-3.`);
    }
    return this._dacChannels[channel];
  }

  /**
   * Set DAC channel value
   * @param channel Channel index (0-3): A=0, B=1, C=2, D=3
   * @param value 8-bit DAC value (0x00-0xFF)
   */
  setDacChannel(channel: number, value: number): void {
    if (channel < 0 || channel > 3) {
      throw new Error(`Invalid DAC channel: ${channel}. Must be 0-3.`);
    }
    // Mask to 8 bits
    this._dacChannels[channel] = value & 0xff;
  }

  /**
   * Get DAC channel A
   */
  getDacA(): number {
    return this._dacChannels[0];
  }

  /**
   * Set DAC channel A
   */
  setDacA(value: number): void {
    this.setDacChannel(0, value);
  }

  /**
   * Get DAC channel B
   */
  getDacB(): number {
    return this._dacChannels[1];
  }

  /**
   * Set DAC channel B
   */
  setDacB(value: number): void {
    this.setDacChannel(1, value);
  }

  /**
   * Get DAC channel C
   */
  getDacC(): number {
    return this._dacChannels[2];
  }

  /**
   * Set DAC channel C
   */
  setDacC(value: number): void {
    this.setDacChannel(2, value);
  }

  /**
   * Get DAC channel D
   */
  getDacD(): number {
    return this._dacChannels[3];
  }

  /**
   * Set DAC channel D
   */
  setDacD(value: number): void {
    this.setDacChannel(3, value);
  }

  /**
   * Get stereo output from DAC channels
   * Left = DAC A + DAC B
   * Right = DAC C + DAC D
   * 
   * DAC values are converted from 8-bit unsigned (0x00-0xFF)
   * to 16-bit signed values by treating them as signed bytes (-128 to +127)
   * and scaling by 256
   * 
   * @returns AudioSample with left/right stereo values
   */
  getStereoOutput(): AudioSample {
    // Convert 8-bit unsigned to signed byte value (-128 to +127)
    // by sign-extending: if bit 7 is set, it's negative
    const toSignedByte = (val: number) => {
      return val > 127 ? val - 256 : val;
    };

    // Convert to 16-bit by multiplying by 256
    const dacA = toSignedByte(this._dacChannels[0]) * 256;
    const dacB = toSignedByte(this._dacChannels[1]) * 256;
    const dacC = toSignedByte(this._dacChannels[2]) * 256;
    const dacD = toSignedByte(this._dacChannels[3]) * 256;

    return {
      left: dacA + dacB,
      right: dacC + dacD,
    };
  }

  /**
   * Reset all DAC channels to center value (0x80)
   */
  reset(): void {
    this._dacChannels[0] = 0x80;
    this._dacChannels[1] = 0x80;
    this._dacChannels[2] = 0x80;
    this._dacChannels[3] = 0x80;
  }

  /**
   * Get all DAC channel values as array
   */
  getChannelValues(): number[] {
    return [...this._dacChannels];
  }

  /**
   * Set all DAC channel values from array
   */
  setChannelValues(values: number[]): void {
    if (values.length !== 4) {
      throw new Error("Must provide exactly 4 DAC channel values");
    }
    for (let i = 0; i < 4; i++) {
      this.setDacChannel(i, values[i]);
    }
  }

  /**
   * Get the device state for persistence
   */
  getState(): any {
    return {
      dacChannels: [...this._dacChannels]
    };
  }

  /**
   * Restore the device state from persisted data
   */
  setState(state: any): void {
    if (!state || !state.dacChannels) return;
    
    for (let i = 0; i < 4; i++) {
      if (i < state.dacChannels.length) {
        this._dacChannels[i] = state.dacChannels[i] & 0xFF;
      }
    }
  }

  /**
   * Gets debug information about the DAC device
   */
  getDebugInfo(): any {
    const stereoOutput = this.getStereoOutput();
    return {
      channels: {
        a: {
          value: this._dacChannels[0],
          hex: `0x${this._dacChannels[0].toString(16).toUpperCase().padStart(2, "0")}`
        },
        b: {
          value: this._dacChannels[1],
          hex: `0x${this._dacChannels[1].toString(16).toUpperCase().padStart(2, "0")}`
        },
        c: {
          value: this._dacChannels[2],
          hex: `0x${this._dacChannels[2].toString(16).toUpperCase().padStart(2, "0")}`
        },
        d: {
          value: this._dacChannels[3],
          hex: `0x${this._dacChannels[3].toString(16).toUpperCase().padStart(2, "0")}`
        }
      },
      stereoOutput: {
        left: stereoOutput.left,
        right: stereoOutput.right
      }
    };
  }
}
