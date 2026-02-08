import type { PsgChipState } from "@emu/abstractions/PsgChipState";

/**
 * PSG Chip (AY-3-8912) - Programmable Sound Generator
 *
 * This class implements a complete AY-3-8912 PSG chip, used in:
 * - ZX Spectrum 128K (single PSG)
 * - ZX Spectrum Next (via TurboSound - 3x PSG chips)
 *
 * ## Features
 * - 3 programmable tone channels (A, B, C)
 * - Programmable noise generator
 * - Envelope generator with 16 shapes
 * - 16 16-bit registers for full control
 * - Per-channel volume control (0-15 or envelope-driven)
 * - Master volume via 16-level volume table
 *
 * ## Registers (0-15)
 * - 0-1: Channel A tone frequency (12-bit)
 * - 2-3: Channel B tone frequency (12-bit)
 * - 4-5: Channel C tone frequency (12-bit)
 * - 6: Noise frequency (5-bit)
 * - 7: Enable flags (noise/tone per channel)
 * - 8-10: Channel A-C volume control
 * - 11-12: Envelope frequency (16-bit)
 * - 13: Envelope shape/style
 * - 14-15: I/O port control (not used in ZX Spectrum)
 *
 * ## Output
 * - Per-channel tone output (high/low square wave)
 * - Combined through OR logic with noise
 * - Multiplied by per-channel volume
 * - Output range: -32768 to +32767 (16-bit signed AC signal)
 *   - Silent/disabled: 0
 *   - Active tone HIGH: +amplitude
 *   - Active tone LOW: -amplitude
 *
 * ## Usage
 * 1. Set register index via setRegisterIndex(reg)
 * 2. Write value via setRegisterValue(value)
 * 3. Call clock() to advance sound generation
 * 4. Read channel output via getChannelA/B/C()
 *
 * ## Multi-Chip Systems
 * When used in TurboSound (3 chips), each chip has:
 * - Independent tone/noise generators
 * - Selectable stereo panning (muted, left, right, stereo)
 * - Optional mono mode (all channels mixed to mono)
 * - Global stereo mode selection (ABC vs ACB)
 *
 * See AUDIO_ARCHITECTURE.md for complete system details.
 * See PORT_MAPPINGS.md for PSG port I/O details.
 */
export class PsgChip {
  // --- Chip ID (for multi-chip systems like Turbo Sound Next)
  // --- 0 = chip 0 (default)
  // --- 1 = chip 1
  // --- 2 = chip 2
  readonly chipId: number;

  // --- The last register index set
  private _psgRegisterIndex = 0;

  // --- The last values of the PSG registers set
  private readonly _regValues = new Uint8Array(16);

  // --- Stores the envelopes volume forms
  private readonly _psgEnvelopes = new Uint8Array(0x800);

  // --- Table of volume levels
  private readonly _psgVolumeTable: number[] = [
    0x0000, 0x0201, 0x033c, 0x04d7, 0x0783, 0x0ca6, 0x133e, 0x2393, 0x2868,
    0x45d4, 0x606a, 0x76ea, 0x97bc, 0xb8a6, 0xdc52, 0xffff
  ];

  // --- Channel A
  private _toneA: number; // 12-bit
  private _toneAEnabled: boolean;
  private _noiseAEnabled: boolean;
  private _volA: number; // 8-bit
  private _envA: boolean;
  private _cntA: number; // 12-bit
  private _bitA: boolean;

  // --- Channel B
  private _toneB: number; // 12-bit
  private _toneBEnabled: boolean;
  private _noiseBEnabled: boolean;
  private _volB: number; // 8-bit
  private _envB: boolean;
  private _cntB: number; // 12-bit
  private _bitB: boolean;

  // --- Channel C
  private _toneC: number; // 12-bit
  private _toneCEnabled: boolean;
  private _noiseCEnabled: boolean;
  private _volC: number; // 8-bit
  private _envC: boolean;
  private _cntC: number; // 12-bit
  private _bitC: boolean;

  // --- Noise
  private _noiseSeed: number;
  private _noiseFreq: number;
  private _cntNoise: number;
  private _bitNoise: boolean;

  // --- Envelope data
  private _envFreq: number;
  private _envStyle: number; // 8-bit
  private _cntEnv: number;
  private _posEnv: number;

  /**
   * Sum of orphan samples (total across all channels)
   */
  orphanSum = 0;

  /**
   * Sum of orphan samples for channel A
   */
  orphanSumA = 0;

  /**
   * Sum of orphan samples for channel B
   */
  orphanSumB = 0;

  /**
   * Sum of orphan samples for channel C
   */
  orphanSumC = 0;

  /**
   * Number of orphan samples
   */
  orphanSamples = 0;

  /**
   * Current output value for channel A (latest generated value)
   */
  currentOutputA = 0;

  /**
   * Current output value for channel B (latest generated value)
   */
  currentOutputB = 0;

  /**
   * Current output value for channel C (latest generated value)
   */
  currentOutputC = 0;

  /**
   * Reset the device when creating it
   */
  constructor (chipId: number = 0) {
    this.chipId = chipId & 0x03; // Limit to 0-3
    this.reset();
  }

  /**
   * Resets the device to its initial state
   */
  reset (): void {
    this.initSoundRegisters();
    this.initEnvelopData();
  }

  /**
   * Set the initial values of all sound registers and their internal representation
   */
  private initSoundRegisters (): void {
    // --- Set all previous register values to zero
    for (let i = 0; i < this._regValues.length; i++) {
      this._regValues[i] = 0;
    }
    
    // --- Initialize mixer register to 0xFF (all channels disabled) to match hardware
    this._regValues[7] = 0xff;

    // --- Channel A setup
    this._toneA = 0;
    this._toneAEnabled = false;
    this._noiseAEnabled = false;
    this._volA = 0;
    this._envA = false;
    this._cntA = 0;
    this._bitA = false;

    // --- Channel B setup
    this._toneB = 0;
    this._toneBEnabled = false;
    this._noiseBEnabled = false;
    this._volB = 0;
    this._envB = false;
    this._cntB = 0;
    this._bitB = false;

    // --- Channel C setup
    this._toneC = 0;
    this._toneCEnabled = false;
    this._noiseCEnabled = false;
    this._volC = 0;
    this._envC = false;
    this._cntC = 0;
    this._bitC = false;

    // --- Noise channel setup
    this._noiseSeed = 0;
    this._noiseFreq = 0;
    this._cntNoise = 0;
    this._bitNoise = false;

    // --- Other registers
    this._envFreq = 0;
    this._envStyle = 0;
    this._cntEnv = 0;
    this._posEnv = 0;

    this.orphanSamples = 0;
    this.orphanSum = 0;
    this.orphanSumA = 0;
    this.orphanSumB = 0;
    this.orphanSumC = 0;
  }

  /**
   * Initialize the PSG envelope tables
   */
  private initEnvelopData (): void {
    // Reset the sample pointer
    let samplePtr = 0;

    // --- Iterate through envelopes
    for (let env = 0; env < 16; env++) {
      // --- Reset hold
      let hold = false;

      // --- Set dir according to env
      let dir = (env & 0x04) !== 0 ? 1 : -1;

      // --- Set vol according to env
      let vol = (env & 0x04) !== 0 ? -1 : 0x20;

      // --- Iterate through envelope positions
      for (let pos = 0; pos < 128; pos++) {
        if (!hold) {
          vol += dir;
          if (vol < 0 || vol >= 32) {
            // -- Continue flag is set?
            if ((env & 0x08) !== 0) {
              // --- Yes, continue.
              // --- If alternate is set, reverse the direction
              if ((env & 0x02) !== 0) {
                dir = -dir;
              }

              // --- Set start volume according to direction
              vol = dir > 0 ? 0 : 31;

              // --- Hold is set?
              if ((env & 0x01) !== 0) {
                // --- Hold, and set up next volume
                hold = true;
                vol = dir > 0 ? 31 : 0;
              }
            } else {
              // --- Mute and hold this value
              vol = 0;
              hold = true;
            }
          }
        }

        // --- Store the envelop sample and move to the next position
        this._psgEnvelopes[samplePtr++] = vol & 0xff;
      }
    }
  }

  /**
   * Gets the current PSG state
   */
  getPsgData (): PsgChipState {
    return {
      psgRegisterIndex: this._psgRegisterIndex,
      regValues: this._regValues,
      toneA: this._toneA,
      toneAEnabled: this._toneAEnabled,
      noiseAEnabled: this._noiseAEnabled,
      volA: this._volA,
      envA: this._envA,
      cntA: this._cntA,
      bitA: this._bitA,
      toneB: this._toneB,
      toneBEnabled: this._toneBEnabled,
      noiseBEnabled: this._noiseBEnabled,
      volB: this._volB,
      envB: this._envB,
      cntB: this._cntB,
      bitB: this._bitB,
      toneC: this._toneC,
      toneCEnabled: this._toneCEnabled,
      noiseCEnabled: this._noiseCEnabled,
      volC: this._volC,
      envC: this._envC,
      cntC: this._cntC,
      bitC: this._bitC,
      noiseSeed: this._noiseSeed,
      noiseFreq: this._noiseFreq,
      cntNoise: this._cntNoise,
      bitNoise: this._bitNoise,
      envFreq: this._envFreq,
      envStyle: this._envStyle,
      cntEnv: this._cntEnv,
      posEnv: this._posEnv
    };
  }

  /**
   * Gets the state of the PSG chip for persistence
   */
  getState(): any {
    return {
      psgRegisterIndex: this._psgRegisterIndex,
      regValues: new Uint8Array(this._regValues),
      toneA: this._toneA,
      toneAEnabled: this._toneAEnabled,
      noiseAEnabled: this._noiseAEnabled,
      volA: this._volA,
      envA: this._envA,
      cntA: this._cntA,
      bitA: this._bitA,
      toneB: this._toneB,
      toneBEnabled: this._toneBEnabled,
      noiseBEnabled: this._noiseBEnabled,
      volB: this._volB,
      envB: this._envB,
      cntB: this._cntB,
      bitB: this._bitB,
      toneC: this._toneC,
      toneCEnabled: this._toneCEnabled,
      noiseCEnabled: this._noiseCEnabled,
      volC: this._volC,
      envC: this._envC,
      cntC: this._cntC,
      bitC: this._bitC,
      noiseSeed: this._noiseSeed,
      noiseFreq: this._noiseFreq,
      cntNoise: this._cntNoise,
      bitNoise: this._bitNoise,
      envFreq: this._envFreq,
      envStyle: this._envStyle,
      cntEnv: this._cntEnv,
      posEnv: this._posEnv
    };
  }

  /**
   * Sets the state of the PSG chip from persisted data
   */
  setState(state: any): void {
    if (!state) return;

    this._psgRegisterIndex = state.psgRegisterIndex ?? 0;
    if (state.regValues) {
      for (let i = 0; i < Math.min(state.regValues.length, this._regValues.length); i++) {
        this._regValues[i] = state.regValues[i];
      }
    }
    this._toneA = state.toneA ?? 0;
    this._toneAEnabled = state.toneAEnabled ?? false;
    this._noiseAEnabled = state.noiseAEnabled ?? false;
    this._volA = state.volA ?? 0;
    this._envA = state.envA ?? false;
    this._cntA = state.cntA ?? 0;
    this._bitA = state.bitA ?? false;
    this._toneB = state.toneB ?? 0;
    this._toneBEnabled = state.toneBEnabled ?? false;
    this._noiseBEnabled = state.noiseBEnabled ?? false;
    this._volB = state.volB ?? 0;
    this._envB = state.envB ?? false;
    this._cntB = state.cntB ?? 0;
    this._bitB = state.bitB ?? false;
    this._toneC = state.toneC ?? 0;
    this._toneCEnabled = state.toneCEnabled ?? false;
    this._noiseCEnabled = state.noiseCEnabled ?? false;
    this._volC = state.volC ?? 0;
    this._envC = state.envC ?? false;
    this._cntC = state.cntC ?? 0;
    this._bitC = state.bitC ?? false;
    this._noiseSeed = state.noiseSeed ?? 0;
    this._noiseFreq = state.noiseFreq ?? 0;
    this._cntNoise = state.cntNoise ?? 0;
    this._bitNoise = state.bitNoise ?? false;
    this._envFreq = state.envFreq ?? 0;
    this._envStyle = state.envStyle ?? 0;
    this._cntEnv = state.cntEnv ?? 0;
    this._posEnv = state.posEnv ?? 0;
    
    // --- Restore orphan sample state (transient, but may be used for serialization)
    if (state.orphanSum !== undefined) {
      this.orphanSum = state.orphanSum;
      this.orphanSumA = state.orphanSumA ?? 0;
      this.orphanSumB = state.orphanSumB ?? 0;
      this.orphanSumC = state.orphanSumC ?? 0;
      this.orphanSamples = state.orphanSamples ?? 0;
    }
  }

  /**
   * Set the PSG register index
   * @param index PSG register index (0-15)
   */
  setPsgRegisterIndex (index: number): void {
    this._psgRegisterIndex = index & 0x0f;
  }

  /**
   * Gets the current register index
   */
  get psgRegisterIndex (): number {
    return this._psgRegisterIndex;
  }

  /**
   * Reads the value of the register addressed by the register index last set
   */
  readPsgRegisterValue (): number {
    return this._regValues[this._psgRegisterIndex & 0x0f];
  }

  /**
   * Writes the value of the register addressed by the register index last set
   * @param v Parameter value
   */
  writePsgRegisterValue (v: number): void {
    // --- Normalize to a byte
    v = v & 0xff;

    // --- Write the native register values
    this._regValues[this._psgRegisterIndex] = v;

    switch (this._psgRegisterIndex) {
      case 0:
        // --- Tone A (lower 8 bits)
        this._toneA = (this._toneA & 0x0f00) | v;
        return;

      case 1:
        // --- Tone A (upper 4 bits)
        this._toneA = (this._toneA & 0x00ff) | ((v & 0x0f) << 8);
        return;

      case 2:
        // --- Tone B (lower 8 bits)
        this._toneB = (this._toneB & 0x0f00) | v;
        return;

      case 3:
        // --- Tone B (upper 4 bits)
        this._toneB = (this._toneB & 0x00ff) | ((v & 0x0f) << 8);
        return;

      case 4:
        // --- Tone C (lower 8 bits)
        this._toneC = (this._toneC & 0x0f00) | v;
        return;

      case 5:
        // --- Tone C (upper 4 bits)
        this._toneC = (this._toneC & 0x00ff) | ((v & 0x0f) << 8);
        return;

      case 6:
        // --- Noise frequency
        this._noiseFreq = v & 0x1f;
        return;

      case 7:
        // --- Mixer flags
        this._toneAEnabled = (v & 0x01) === 0;
        this._toneBEnabled = (v & 0x02) === 0;
        this._toneCEnabled = (v & 0x04) === 0;
        this._noiseAEnabled = (v & 0x08) === 0;
        this._noiseBEnabled = (v & 0x10) === 0;
        this._noiseCEnabled = (v & 0x20) === 0;
        return;

      case 8:
        // --- Volume A
        this._volA = v & 0x0f;
        this._envA = (v & 0x10) !== 0;
        return;

      case 9:
        // --- Volume B
        this._volB = v & 0x0f;
        this._envB = (v & 0x10) !== 0;
        return;

      case 10:
        // --- Volume C
        this._volC = v & 0x0f;
        this._envC = (v & 0x10) !== 0;
        return;

      case 11:
        // --- Envelope fequency (lower 8 bit)
        this._envFreq = (this._envFreq & 0xff00) | v;
        return;

      case 12:
        // --- Envelope frequency (upper 8 bits)
        this._envFreq = (this._envFreq & 0x00ff) | (v << 8);
        return;

      case 13:
        // --- Check envelope shape
        this._envStyle = v & 0x0f;
        this._cntEnv = 0;
        this._posEnv = 0;
        return;
    }
  }

  /**
   * Generates the current PSG output value
   */
  generateOutputValue (): void {
    let vol = 0;

    // --- Increment TONE A counter
    if (this._toneA) {
      this._cntA++;
      if (this._cntA >= this._toneA) {
        // --- Reset counter and reverse output bit
        this._cntA = 0;
        this._bitA = !this._bitA;
      }
    }

    // --- Increment TONE B counter
    if (this._toneB) {
      this._cntB++;
      if (this._cntB >= this._toneB) {
        // --- Reset counter and reverse output bit
        this._cntB = 0;
        this._bitB = !this._bitB;
      }
    }

    // --- Increment TONE C counter
    if (this._toneC) {
      this._cntC++;
      if (this._cntC >= this._toneC) {
        // --- Reset counter and reverse output bit
        this._cntC = 0;
        this._bitC = !this._bitC;
      }
    }

    // --- Calculate noise sample
    if (this._noiseFreq) {
      this._cntNoise++;
      if (this._cntNoise >= this._noiseFreq) {
        // --- It is time to generate the next noise sample
        this._cntNoise = 0;
        this._noiseSeed =
          (this._noiseSeed * 2 + 1) ^
          (((this._noiseSeed >>> 16) ^ (this._noiseSeed >>> 13)) & 0x01);
        this._bitNoise = ((this._noiseSeed >>> 16) & 0x01) != 0;
      }
    }

    // --- Calculate envelope position
    if (this._envFreq) {
      this._cntEnv++;
      if (this._cntEnv >= this._envFreq) {
        // --- Move to the new position
        this._cntEnv = 0;
        this._posEnv++;
        if (this._posEnv > 0x7f) {
          this._posEnv = 0x40;
        }
      }
    }

    // --- Calculate channel volumes
    let volA = 0;
    let volB = 0;
    let volC = 0;

    // --- Channel A volume value (UNSIGNED output - matching VHDL hardware)
    let tmpVol = 0;
    
    if (this._toneAEnabled || this._noiseAEnabled) {
      if (this._envA) {
        tmpVol = this._psgEnvelopes[this._envStyle * 128 + this._posEnv];
      } else {
        tmpVol = this._volA * 2 + 1;
      }

      // --- Convert to amplitude (0-65535 range for 16-bit software)
      const amplitude = this._psgVolumeTable[(tmpVol & 0x1f) >> 1];
      
      // Hardware behavior: bit HIGH = amplitude, bit LOW = 0 (unsigned DC-biased square wave)
      if (this._toneAEnabled && this._bitA) {
        volA = amplitude;
      } else if (this._noiseAEnabled && this._bitNoise) {
        volA = amplitude;
      }
      // else volA remains 0
      
      vol += volA;  // Total volume uses unsigned addition
    }

    // --- Channel B volume value (UNSIGNED output)
    
    if (this._toneBEnabled || this._noiseBEnabled) {
      if (this._envB) {
        tmpVol = this._psgEnvelopes[this._envStyle * 128 + this._posEnv];
      } else {
        tmpVol = this._volB * 2 + 1;
      }

      // --- Convert to amplitude (0-65535 range)
      const amplitude = this._psgVolumeTable[(tmpVol & 0x1f) >> 1];
      
      // Hardware behavior: bit HIGH = amplitude, bit LOW = 0
      if (this._toneBEnabled && this._bitB) {
        volB = amplitude;
      } else if (this._noiseBEnabled && this._bitNoise) {
        volB = amplitude;
      }
      
      vol += volB;
    }

    // --- Channel C volume value (UNSIGNED output)
    
    if (this._toneCEnabled || this._noiseCEnabled) {
      if (this._envC) {
        tmpVol = this._psgEnvelopes[this._envStyle * 128 + this._posEnv];
      } else {
        tmpVol = this._volC * 2 + 1;
      }

      // --- Convert to amplitude (0-65535 range)
      const amplitude = this._psgVolumeTable[(tmpVol & 0x1f) >> 1];
      
      // Hardware behavior: bit HIGH = amplitude, bit LOW = 0
      if (this._toneCEnabled && this._bitC) {
        volC = amplitude;
      } else if (this._noiseCEnabled && this._bitNoise) {
        volC = amplitude;
      }
      
      vol += volC;
    }

    // --- Store current output values (UNSIGNED - matching hardware)
    this.currentOutputA = volA;
    this.currentOutputB = volB;
    this.currentOutputC = volC;

    // --- Store for orphan sample tracking
    this.orphanSumA += volA;
    this.orphanSumB += volB;
    this.orphanSumC += volC;
    this.orphanSum += vol;
    this.orphanSamples += 1;
  }

  /**
   * Gets the current output volume for channel A (-32768 to +32767)
   */
  getChannelAVolume (): number {
    let vol = 0;
    
    if (this._toneAEnabled || this._noiseAEnabled) {
      let tmpVol = 0;
      if (this._envA) {
        tmpVol = this._psgEnvelopes[this._envStyle * 128 + this._posEnv];
      } else {
        tmpVol = this._volA * 2 + 1;
      }
      const amplitude = this._psgVolumeTable[(tmpVol & 0x1f) >> 1];
      
      // Return signed value based on tone bit state
      if (this._toneAEnabled) {
        vol = this._bitA ? amplitude : -amplitude;
      } else if (this._noiseAEnabled) {
        vol = this._bitNoise ? amplitude : -amplitude;
      }
    }
    return vol;
  }

  /**
   * Gets the current output volume for channel B (-32768 to +32767)
   */
  getChannelBVolume (): number {
    let vol = 0;
    
    if (this._toneBEnabled || this._noiseBEnabled) {
      let tmpVol = 0;
      if (this._envB) {
        tmpVol = this._psgEnvelopes[this._envStyle * 128 + this._posEnv];
      } else {
        tmpVol = this._volB * 2 + 1;
      }
      const amplitude = this._psgVolumeTable[(tmpVol & 0x1f) >> 1];
      
      // Return signed value based on tone bit state
      if (this._toneBEnabled) {
        vol = this._bitB ? amplitude : -amplitude;
      } else if (this._noiseBEnabled) {
        vol = this._bitNoise ? amplitude : -amplitude;
      }
    }
    return vol;
  }

  /**
   * Gets the current output volume for channel C (-32768 to +32767)
   */
  getChannelCVolume (): number {
    let vol = 0;
    
    if (this._toneCEnabled || this._noiseCEnabled) {
      let tmpVol = 0;
      if (this._envC) {
        tmpVol = this._psgEnvelopes[this._envStyle * 128 + this._posEnv];
      } else {
        tmpVol = this._volC * 2 + 1;
      }
      const amplitude = this._psgVolumeTable[(tmpVol & 0x1f) >> 1];
      
      // Return signed value based on tone bit state
      if (this._toneCEnabled) {
        vol = this._bitC ? amplitude : -amplitude;
      } else if (this._noiseCEnabled) {
        vol = this._bitNoise ? amplitude : -amplitude;
      }
    }
    return vol;
  }

  /**
   * Gets debug information about the PSG chip for inspection
   */
  getDebugInfo(): any {
    return {
      chipId: this.chipId,
      registerIndex: this._psgRegisterIndex,
      registers: Array.from(this._regValues),
      channels: {
        a: {
          tone: this._toneA,
          toneEnabled: this._toneAEnabled,
          volume: this._volA,
          envelope: this._envA,
          noiseEnabled: this._noiseAEnabled,
          counter: this._cntA,
          bit: this._bitA,
          output: this.getChannelAVolume()
        },
        b: {
          tone: this._toneB,
          toneEnabled: this._toneBEnabled,
          volume: this._volB,
          envelope: this._envB,
          noiseEnabled: this._noiseBEnabled,
          counter: this._cntB,
          bit: this._bitB,
          output: this.getChannelBVolume()
        },
        c: {
          tone: this._toneC,
          toneEnabled: this._toneCEnabled,
          volume: this._volC,
          envelope: this._envC,
          noiseEnabled: this._noiseCEnabled,
          counter: this._cntC,
          bit: this._bitC,
          output: this.getChannelCVolume()
        }
      },
      noise: {
        frequency: this._noiseFreq,
        seed: this._noiseSeed,
        counter: this._cntNoise,
        bit: this._bitNoise
      },
      envelope: {
        frequency: this._envFreq,
        style: this._envStyle,
        counter: this._cntEnv,
        position: this._posEnv
      }
    };
  }
}

