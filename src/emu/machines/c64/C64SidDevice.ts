import { IGenericDevice } from "@emuabstr/IGenericDevice";
import { IC64Machine } from "./IC64Machine";

/**
 * This class represents the SID (Sound Interface Device) of the Commodore 64 (C64) machine.
 * It handles the sound generation and control for the C64.
 * The SID has 29 registers ($D400-$D41C) that control various aspects of sound generation.
 */
export class C64SidDevice implements IGenericDevice<IC64Machine> {
  // Voice 1 registers
  /**
   * Voice 1 frequency control - low byte (Register $D400)
   * Together with the high byte ($D401), this creates a 16-bit value that controls
   * the frequency of oscillator 1. Higher values produce higher frequencies.
   * Range: 0-255 (combined with high byte: 0-65535)
   */
  private _voice1FreqLo: number = 0;
  
  /**
   * Voice 1 frequency control - high byte (Register $D401)
   * Together with the low byte ($D400), this creates a 16-bit value that controls
   * the frequency of oscillator 1. Higher values produce higher frequencies.
   * Range: 0-255 (combined with low byte: 0-65535)
   */
  private _voice1FreqHi: number = 0;
  
  /**
   * Voice 1 pulse waveform width - low byte (Register $D402)
   * Together with the high nybble of $D403, this creates a 12-bit value that controls
   * the pulse width (duty cycle) when pulse waveform is selected.
   * Range: 0-255 (combined with high nybble: 0-4095)
   */
  private _voice1PwLo: number = 0;
  
  /**
   * Voice 1 pulse waveform width - high nybble (Register $D403)
   * Bits 0-3: High 4 bits of the 12-bit pulse width value
   * Bits 4-7: Unused
   * Together with $D402, controls pulse width for voice 1.
   */
  private _voice1PwHi: number = 0;
  
  /**
   * Voice 1 control register (Register $D404)
   * Bit 0: Gate (1=start attack/decay/sustain, 0=start release)
   * Bit 1: Sync (1=synchronize oscillator with oscillator 3)
   * Bit 2: Ring modulation (1=use oscillator 3 output for modulation)
   * Bit 3: Test (1=disable oscillator, reset noise generator)
   * Bit 4: Triangle waveform enable (1=enabled)
   * Bit 5: Sawtooth waveform enable (1=enabled)
   * Bit 6: Pulse waveform enable (1=enabled)
   * Bit 7: Noise waveform enable (1=enabled)
   */
  private _voice1Control: number = 0;
  
  /**
   * Voice 1 attack/decay register (Register $D405)
   * Bits 0-3: Decay rate (0=fastest, 15=slowest)
   * Bits 4-7: Attack rate (0=fastest, 15=slowest)
   */
  private _voice1AttackDecay: number = 0;
  
  /**
   * Voice 1 sustain/release register (Register $D406)
   * Bits 0-3: Release rate (0=fastest, 15=slowest)
   * Bits 4-7: Sustain level (0=quietest, 15=loudest)
   */
  private _voice1SustainRelease: number = 0;
  
  // Voice 2 registers
  /**
   * Voice 2 frequency control - low byte (Register $D407)
   * Together with the high byte ($D408), this creates a 16-bit value that controls
   * the frequency of oscillator 2. Higher values produce higher frequencies.
   * Range: 0-255 (combined with high byte: 0-65535)
   */
  private _voice2FreqLo: number = 0;
  
  /**
   * Voice 2 frequency control - high byte (Register $D408)
   * Together with the low byte ($D407), this creates a 16-bit value that controls
   * the frequency of oscillator 2. Higher values produce higher frequencies.
   * Range: 0-255 (combined with low byte: 0-65535)
   */
  private _voice2FreqHi: number = 0;
  
  /**
   * Voice 2 pulse waveform width - low byte (Register $D409)
   * Together with the high nybble of $D40A, this creates a 12-bit value that controls
   * the pulse width (duty cycle) when pulse waveform is selected.
   * Range: 0-255 (combined with high nybble: 0-4095)
   */
  private _voice2PwLo: number = 0;
  
  /**
   * Voice 2 pulse waveform width - high nybble (Register $D40A)
   * Bits 0-3: High 4 bits of the 12-bit pulse width value
   * Bits 4-7: Unused
   * Together with $D409, controls pulse width for voice 2.
   */
  private _voice2PwHi: number = 0;
  
  /**
   * Voice 2 control register (Register $D40B)
   * Bit 0: Gate (1=start attack/decay/sustain, 0=start release)
   * Bit 1: Sync (1=synchronize oscillator with oscillator 1)
   * Bit 2: Ring modulation (1=use oscillator 1 output for modulation)
   * Bit 3: Test (1=disable oscillator, reset noise generator)
   * Bit 4: Triangle waveform enable (1=enabled)
   * Bit 5: Sawtooth waveform enable (1=enabled)
   * Bit 6: Pulse waveform enable (1=enabled)
   * Bit 7: Noise waveform enable (1=enabled)
   */
  private _voice2Control: number = 0;
  
  /**
   * Voice 2 attack/decay register (Register $D40C)
   * Bits 0-3: Decay rate (0=fastest, 15=slowest)
   * Bits 4-7: Attack rate (0=fastest, 15=slowest)
   */
  private _voice2AttackDecay: number = 0;
  
  /**
   * Voice 2 sustain/release register (Register $D40D)
   * Bits 0-3: Release rate (0=fastest, 15=slowest)
   * Bits 4-7: Sustain level (0=quietest, 15=loudest)
   */
  private _voice2SustainRelease: number = 0;
  
  // Voice 3 registers
  /**
   * Voice 3 frequency control - low byte (Register $D40E)
   * Together with the high byte ($D40F), this creates a 16-bit value that controls
   * the frequency of oscillator 3. Higher values produce higher frequencies.
   * Range: 0-255 (combined with high byte: 0-65535)
   */
  private _voice3FreqLo: number = 0;
  
  /**
   * Voice 3 frequency control - high byte (Register $D40F)
   * Together with the low byte ($D40E), this creates a 16-bit value that controls
   * the frequency of oscillator 3. Higher values produce higher frequencies.
   * Range: 0-255 (combined with low byte: 0-65535)
   */
  private _voice3FreqHi: number = 0;
  
  /**
   * Voice 3 pulse waveform width - low byte (Register $D410)
   * Together with the high nybble of $D411, this creates a 12-bit value that controls
   * the pulse width (duty cycle) when pulse waveform is selected.
   * Range: 0-255 (combined with high nybble: 0-4095)
   */
  private _voice3PwLo: number = 0;
  
  /**
   * Voice 3 pulse waveform width - high nybble (Register $D411)
   * Bits 0-3: High 4 bits of the 12-bit pulse width value
   * Bits 4-7: Unused
   * Together with $D410, controls pulse width for voice 3.
   */
  private _voice3PwHi: number = 0;
  
  /**
   * Voice 3 control register (Register $D412)
   * Bit 0: Gate (1=start attack/decay/sustain, 0=start release)
   * Bit 1: Sync (1=synchronize oscillator with oscillator 2)
   * Bit 2: Ring modulation (1=use oscillator 2 output for modulation)
   * Bit 3: Test (1=disable oscillator, reset noise generator)
   * Bit 4: Triangle waveform enable (1=enabled)
   * Bit 5: Sawtooth waveform enable (1=enabled)
   * Bit 6: Pulse waveform enable (1=enabled)
   * Bit 7: Noise waveform enable (1=enabled)
   */
  private _voice3Control: number = 0;
  
  /**
   * Voice 3 attack/decay register (Register $D413)
   * Bits 0-3: Decay rate (0=fastest, 15=slowest)
   * Bits 4-7: Attack rate (0=fastest, 15=slowest)
   */
  private _voice3AttackDecay: number = 0;
  
  /**
   * Voice 3 sustain/release register (Register $D414)
   * Bits 0-3: Release rate (0=fastest, 15=slowest)
   * Bits 4-7: Sustain level (0=quietest, 15=loudest)
   */
  private _voice3SustainRelease: number = 0;
  
  // Filter and volume registers
  /**
   * Filter cutoff frequency - low byte (Register $D415)
   * Bits 0-2: Low 3 bits of the 11-bit cutoff frequency
   * Bits 3-7: Unused
   * Together with $D416, controls the filter cutoff frequency.
   */
  private _filterCutoffLo: number = 0;
  
  /**
   * Filter cutoff frequency - high byte (Register $D416)
   * Bits 0-7: High 8 bits of the 11-bit cutoff frequency
   * Together with $D415, controls the filter cutoff frequency.
   */
  private _filterCutoffHi: number = 0;
  
  /**
   * Filter resonance control and voice input control (Register $D417)
   * Bits 0-3: Filter resonance (0=minimum, 15=maximum)
   * Bit 4: Filter external input (1=enabled)
   * Bit 5: Filter voice 3 output (1=enabled)
   * Bit 6: Filter voice 2 output (1=enabled)
   * Bit 7: Filter voice 1 output (1=enabled)
   */
  private _filterResonanceVoice: number = 0;
  
  /**
   * Volume and filter mode control (Register $D418)
   * Bits 0-3: Master volume (0=minimum, 15=maximum)
   * Bit 4: Low-pass filter enable (1=enabled)
   * Bit 5: Band-pass filter enable (1=enabled)
   * Bit 6: High-pass filter enable (1=enabled)
   * Bit 7: Voice 3 disable (1=disabled, won't go to audio output)
   */
  private _volumeFilterMode: number = 0;
  
  // Special registers
  /**
   * Paddle X value (Register $D419)
   * Read-only register containing the value of paddle X (0-255)
   */
  private _paddleX: number = 0;
  
  /**
   * Paddle Y value (Register $D41A)
   * Read-only register containing the value of paddle Y (0-255)
   */
  private _paddleY: number = 0;
  
  /**
   * Voice 3 oscillator output (Register $D41B)
   * Read-only register containing the current output of oscillator 3
   */
  private _voice3OscillatorOutput: number = 0;
  
  /**
   * Voice 3 envelope output (Register $D41C)
   * Read-only register containing the current output of envelope generator 3
   */
  private _voice3EnvelopeOutput: number = 0;
  
  registers: Uint8Array;

  constructor(public readonly machine: IC64Machine) {
    this.registers = new Uint8Array(0x20);
  }

  /**
   * This method initializes the SID device.
   * It sets up the necessary registers and prepares the device for sound generation.
   */
  reset(): void {
    // Reset all SID registers to their default values (typically 0)
    this._voice1FreqLo = 0;
    this._voice1FreqHi = 0;
    this._voice1PwLo = 0;
    this._voice1PwHi = 0;
    this._voice1Control = 0;
    this._voice1AttackDecay = 0;
    this._voice1SustainRelease = 0;
    
    this._voice2FreqLo = 0;
    this._voice2FreqHi = 0;
    this._voice2PwLo = 0;
    this._voice2PwHi = 0;
    this._voice2Control = 0;
    this._voice2AttackDecay = 0;
    this._voice2SustainRelease = 0;
    
    this._voice3FreqLo = 0;
    this._voice3FreqHi = 0;
    this._voice3PwLo = 0;
    this._voice3PwHi = 0;
    this._voice3Control = 0;
    this._voice3AttackDecay = 0;
    this._voice3SustainRelease = 0;
    
    this._filterCutoffLo = 0;
    this._filterCutoffHi = 0;
    this._filterResonanceVoice = 0;
    this._volumeFilterMode = 0;
    
    this._paddleX = 0;
    this._paddleY = 0;
    this._voice3OscillatorOutput = 0;
    this._voice3EnvelopeOutput = 0;
  }

  /**
   * This method performs a hard reset of the SID device.
   * It resets the device to its initial state, including any persistent state.
   */
  hardReset = (): void => {
    // Perform a full reset, including any persistent state
    this.reset();
    // Additional hard reset logic can go here
  };

  /**
   * This method disposes of the resources held by the SID device.
   * It cleans up any resources or references to prevent memory leaks.
   */
  dispose(): void {
    // Clean up resources, detach from machine, etc.
    // Example: this.machine = null as any;
  }
  
    /**
   * Gets the flat memory value of the VIC-II registers
   */
  getFlatMemory(): Uint8Array {
    const flatMemory = new Uint8Array(0x400);
    for (let i = 0; i < 0x20; i++) {
      flatMemory.set(this.registers, i * 0x20);
    }
    return flatMemory;
  }


  // Voice 1 accessor methods
  
  /**
   * Gets the frequency of voice 1 as a 16-bit value
   */
  get voice1Frequency(): number {
    return (this._voice1FreqHi << 8) | this._voice1FreqLo;
  }
  
  /**
   * Sets the frequency of voice 1 as a 16-bit value
   */
  set voice1Frequency(value: number) {
    this._voice1FreqLo = value & 0xFF;
    this._voice1FreqHi = (value >> 8) & 0xFF;
  }
  
  /**
   * Gets the pulse width of voice 1 as a 12-bit value
   */
  get voice1PulseWidth(): number {
    return ((this._voice1PwHi & 0x0F) << 8) | this._voice1PwLo;
  }
  
  /**
   * Sets the pulse width of voice 1 as a 12-bit value
   */
  set voice1PulseWidth(value: number) {
    this._voice1PwLo = value & 0xFF;
    this._voice1PwHi = (value >> 8) & 0x0F;
  }
  
  /**
   * Gets the control register of voice 1
   */
  get voice1Control(): number {
    return this._voice1Control;
  }
  
  /**
   * Sets the control register of voice 1
   */
  set voice1Control(value: number) {
    this._voice1Control = value & 0xFF;
  }
  
  /**
   * Gets whether the gate bit is set for voice 1
   */
  get voice1GateEnabled(): boolean {
    return (this._voice1Control & 0x01) !== 0;
  }
  
  /**
   * Sets the gate bit for voice 1
   */
  set voice1GateEnabled(enabled: boolean) {
    if (enabled) {
      this._voice1Control |= 0x01;
    } else {
      this._voice1Control &= ~0x01;
    }
  }
  
  // Voice 2 accessor methods
  
  /**
   * Gets the frequency of voice 2 as a 16-bit value
   */
  get voice2Frequency(): number {
    return (this._voice2FreqHi << 8) | this._voice2FreqLo;
  }
  
  /**
   * Sets the frequency of voice 2 as a 16-bit value
   */
  set voice2Frequency(value: number) {
    this._voice2FreqLo = value & 0xFF;
    this._voice2FreqHi = (value >> 8) & 0xFF;
  }
  
  /**
   * Gets the pulse width of voice 2 as a 12-bit value
   */
  get voice2PulseWidth(): number {
    return ((this._voice2PwHi & 0x0F) << 8) | this._voice2PwLo;
  }
  
  /**
   * Sets the pulse width of voice 2 as a 12-bit value
   */
  set voice2PulseWidth(value: number) {
    this._voice2PwLo = value & 0xFF;
    this._voice2PwHi = (value >> 8) & 0x0F;
  }
  
  /**
   * Gets the control register of voice 2
   */
  get voice2Control(): number {
    return this._voice2Control;
  }
  
  /**
   * Sets the control register of voice 2
   */
  set voice2Control(value: number) {
    this._voice2Control = value & 0xFF;
  }
  
  // Voice 3 accessor methods
  
  /**
   * Gets the frequency of voice 3 as a 16-bit value
   */
  get voice3Frequency(): number {
    return (this._voice3FreqHi << 8) | this._voice3FreqLo;
  }
  
  /**
   * Sets the frequency of voice 3 as a 16-bit value
   */
  set voice3Frequency(value: number) {
    this._voice3FreqLo = value & 0xFF;
    this._voice3FreqHi = (value >> 8) & 0xFF;
  }
  
  /**
   * Gets the pulse width of voice 3 as a 12-bit value
   */
  get voice3PulseWidth(): number {
    return ((this._voice3PwHi & 0x0F) << 8) | this._voice3PwLo;
  }
  
  /**
   * Sets the pulse width of voice 3 as a 12-bit value
   */
  set voice3PulseWidth(value: number) {
    this._voice3PwLo = value & 0xFF;
    this._voice3PwHi = (value >> 8) & 0x0F;
  }
  
  /**
   * Gets the control register of voice 3
   */
  get voice3Control(): number {
    return this._voice3Control;
  }
  
  /**
   * Sets the control register of voice 3
   */
  set voice3Control(value: number) {
    this._voice3Control = value & 0xFF;
  }
  
  // Filter and volume accessor methods
  
  /**
   * Gets the filter cutoff frequency as an 11-bit value
   */
  get filterCutoff(): number {
    return ((this._filterCutoffHi & 0xFF) << 3) | (this._filterCutoffLo & 0x07);
  }
  
  /**
   * Sets the filter cutoff frequency as an 11-bit value
   */
  set filterCutoff(value: number) {
    this._filterCutoffLo = value & 0x07;
    this._filterCutoffHi = (value >> 3) & 0xFF;
  }
  
  /**
   * Gets the filter resonance value (0-15)
   */
  get filterResonance(): number {
    return this._filterResonanceVoice & 0x0F;
  }
  
  /**
   * Sets the filter resonance value (0-15)
   */
  set filterResonance(value: number) {
    this._filterResonanceVoice = (this._filterResonanceVoice & 0xF0) | (value & 0x0F);
  }
  
  /**
   * Gets the master volume (0-15)
   */
  get masterVolume(): number {
    return this._volumeFilterMode & 0x0F;
  }
  
  /**
   * Sets the master volume (0-15)
   */
  set masterVolume(value: number) {
    this._volumeFilterMode = (this._volumeFilterMode & 0xF0) | (value & 0x0F);
  }
  
  /**
   * Read a SID register value
   * @param regIndex Register index (0-28, corresponding to $D400-$D41C)
   * @returns The value of the register
   */
  readRegister(regIndex: number): number {
    regIndex &= 0x1F; // Limit to 32 registers (0-31), with mirroring
    
    switch (regIndex) {
      // Voice 1 registers
      case 0x00: return this._voice1FreqLo;
      case 0x01: return this._voice1FreqHi;
      case 0x02: return this._voice1PwLo;
      case 0x03: return this._voice1PwHi;
      case 0x04: return this._voice1Control;
      case 0x05: return this._voice1AttackDecay;
      case 0x06: return this._voice1SustainRelease;
      
      // Voice 2 registers
      case 0x07: return this._voice2FreqLo;
      case 0x08: return this._voice2FreqHi;
      case 0x09: return this._voice2PwLo;
      case 0x0A: return this._voice2PwHi;
      case 0x0B: return this._voice2Control;
      case 0x0C: return this._voice2AttackDecay;
      case 0x0D: return this._voice2SustainRelease;
      
      // Voice 3 registers
      case 0x0E: return this._voice3FreqLo;
      case 0x0F: return this._voice3FreqHi;
      case 0x10: return this._voice3PwLo;
      case 0x11: return this._voice3PwHi;
      case 0x12: return this._voice3Control;
      case 0x13: return this._voice3AttackDecay;
      case 0x14: return this._voice3SustainRelease;
      
      // Filter and volume registers
      case 0x15: return this._filterCutoffLo;
      case 0x16: return this._filterCutoffHi;
      case 0x17: return this._filterResonanceVoice;
      case 0x18: return this._volumeFilterMode;
      
      // Special read-only registers
      case 0x19: return this._paddleX;
      case 0x1A: return this._paddleY;
      case 0x1B: return this._voice3OscillatorOutput;
      case 0x1C: return this._voice3EnvelopeOutput;
      
      // Unused registers return 0
      default: return 0;
    }
  }
  
  /**
   * Write to a SID register
   * @param regIndex Register index (0-28, corresponding to $D400-$D41C)
   * @param value The value to write
   */
  writeRegister(regIndex: number, value: number): void {
    regIndex &= 0x1F; // Limit to 32 registers (0-31), with mirroring
    value &= 0xFF;    // Ensure it's a byte value
    
    switch (regIndex) {
      // Voice 1 registers
      case 0x00: this._voice1FreqLo = value; break;
      case 0x01: this._voice1FreqHi = value; break;
      case 0x02: this._voice1PwLo = value; break;
      case 0x03: this._voice1PwHi = value & 0x0F; break; // Only lower 4 bits
      case 0x04: this._voice1Control = value; break;
      case 0x05: this._voice1AttackDecay = value; break;
      case 0x06: this._voice1SustainRelease = value; break;
      
      // Voice 2 registers
      case 0x07: this._voice2FreqLo = value; break;
      case 0x08: this._voice2FreqHi = value; break;
      case 0x09: this._voice2PwLo = value; break;
      case 0x0A: this._voice2PwHi = value & 0x0F; break; // Only lower 4 bits
      case 0x0B: this._voice2Control = value; break;
      case 0x0C: this._voice2AttackDecay = value; break;
      case 0x0D: this._voice2SustainRelease = value; break;
      
      // Voice 3 registers
      case 0x0E: this._voice3FreqLo = value; break;
      case 0x0F: this._voice3FreqHi = value; break;
      case 0x10: this._voice3PwLo = value; break;
      case 0x11: this._voice3PwHi = value & 0x0F; break; // Only lower 4 bits
      case 0x12: this._voice3Control = value; break;
      case 0x13: this._voice3AttackDecay = value; break;
      case 0x14: this._voice3SustainRelease = value; break;
      
      // Filter and volume registers
      case 0x15: this._filterCutoffLo = value & 0x07; break; // Only lower 3 bits
      case 0x16: this._filterCutoffHi = value; break;
      case 0x17: this._filterResonanceVoice = value; break;
      case 0x18: this._volumeFilterMode = value; break;
      
      // Special read-only registers
      case 0x19: // Paddle X - read only
      case 0x1A: // Paddle Y - read only
      case 0x1B: // Voice 3 oscillator - read only
      case 0x1C: // Voice 3 envelope - read only
      default:
        break; // Ignore writes to read-only or unused registers
    }
  }
}