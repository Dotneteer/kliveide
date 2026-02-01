import { AudioSample } from "@emu/abstractions/IAudioDevice";

/**
 * DAC Device for ZX Spectrum Next
 * Implements 4x 8-bit DAC channels for digital audio playback (SpecDrum/SoundDrive)
 * 
 * Channels:
 * - DAC A: Left channel
 * - DAC B: Left channel
 * - DAC C: Right channel
 * - DAC D: Right channel
 * 
 * Values: 8-bit unsigned (0x00-0xFF), centered at 0x80
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
}
