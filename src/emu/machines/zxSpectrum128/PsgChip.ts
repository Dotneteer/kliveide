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

  // --- Chip type: AY = AY-3-8910 (Spectrum 128K), YM = YM2149 (ZX Next)
  readonly chipType: 'AY' | 'YM';

  // --- AY-3-8910 register read masks: unused bits read as 0 on real hardware.
  // --- YM2149 returns all bits unmasked.
  // --- Source: MAME ay8910.cpp mask[0x10] table.
  private static readonly AY_READ_MASKS: readonly number[] = [
    0xff, 0x0f, 0xff, 0x0f, 0xff, 0x0f, 0x1f, 0xff,
    0x1f, 0x1f, 0x1f, 0xff, 0xff, 0x0f, 0xff, 0xff
  ];

  // --- AY-3-8910 volume table (MAME ay8910.cpp resistor-network model, normalized to 0-65535)
  private static readonly AY_VOLUME_TABLE: readonly number[] = [
    0, 890, 1158, 1512, 2059, 2856, 3833, 6238,
    7696, 12607, 17452, 23178, 30968, 39233, 51935, 65535
  ];

  // --- YM2149 volume table (MAME ay8910.cpp resistor-network model, normalized to 0-65535)
  private static readonly YM_VOLUME_TABLE: readonly number[] = [
    0, 436, 762, 1099, 1638, 2217, 3221, 4329,
    6266, 8473, 12221, 16447, 23948, 32562, 47873, 65535
  ];

  // --- The last register index set
  private _psgRegisterIndex = 0;

  // --- The last values of the PSG registers set
  private readonly _regValues = new Uint8Array(16);

  // --- Stores the envelopes volume forms
  private readonly _psgEnvelopes = new Uint8Array(0x800);

  // --- Active volume table (selected at construction time based on chipType)
  private readonly _psgVolumeTable: readonly number[];

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
  private _noisePrescale: boolean;
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
   * @param chipId Chip identifier (0-3, used in TurboSound multi-chip systems)
   * @param chipType Chip variant: 'AY' = AY-3-8910 (Spectrum 128K), 'YM' = YM2149 (ZX Next)
   */
  constructor (chipId: number = 0, chipType: 'AY' | 'YM' = 'AY') {
    this.chipId = chipId & 0x03; // Limit to 0-3
    this.chipType = chipType;
    this._psgVolumeTable = chipType === 'YM'
      ? PsgChip.YM_VOLUME_TABLE
      : PsgChip.AY_VOLUME_TABLE;
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
    
    // --- Initialize mixer register to 0x00 (all channels enabled), matching MAME ay8910_reset_ym()
    this._regValues[7] = 0x00;

    // --- Channel A setup
    this._toneA = 0;
    this._toneAEnabled = true;
    this._noiseAEnabled = true;
    this._volA = 0;
    this._envA = false;
    this._cntA = 0;
    this._bitA = false;

    // --- Channel B setup
    this._toneB = 0;
    this._toneBEnabled = true;
    this._noiseBEnabled = true;
    this._volB = 0;
    this._envB = false;
    this._cntB = 0;
    this._bitB = false;

    // --- Channel C setup
    this._toneC = 0;
    this._toneCEnabled = true;
    this._noiseCEnabled = true;
    this._volC = 0;
    this._envC = false;
    this._cntC = 0;
    this._bitC = false;

    // --- Noise channel setup
    this._noiseSeed = 1;         // Hardware-correct initial seed (MAME-verified)
    this._noiseFreq = 0;
    this._cntNoise = 0;
    this._noisePrescale = false;  // Hardware ÷2 prescaler starts low
    this._bitNoise = (this._noiseSeed & 1) !== 0;  // Initial noise output = HIGH

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
   * Initialize the PSG envelope tables.
   *
   * AY-3-8910: 16 envelope steps (vol 0-15). Each step lasts ×2 the period register
   *   value, preserving the same total envelope duration as YM. Volume index: vol & 0x0f.
   * YM2149:    32 envelope steps (vol 0-31). Each step lasts ×1 the period register
   *   value. Volume index: (vol & 0x1f) >> 1 (maps 32 sub-steps to 16-entry table).
   */
  private initEnvelopData (): void {
    // Step boundary: 16 for AY (hardware-verified), 32 for YM
    const stepMax = this.chipType === 'AY' ? 16 : 32;
    const initVol = this.chipType === 'AY' ? stepMax : stepMax; // identical expression; kept for clarity

    let samplePtr = 0;

    for (let env = 0; env < 16; env++) {
      let hold = false;
      let dir = (env & 0x04) !== 0 ? 1 : -1;
      let vol = (env & 0x04) !== 0 ? -1 : stepMax;

      for (let pos = 0; pos < 128; pos++) {
        if (!hold) {
          vol += dir;
          if (vol < 0 || vol >= stepMax) {
            if ((env & 0x08) !== 0) {
              if ((env & 0x02) !== 0) {
                dir = -dir;
              }
              vol = dir > 0 ? 0 : stepMax - 1;
              if ((env & 0x01) !== 0) {
                hold = true;
                vol = dir > 0 ? stepMax - 1 : 0;
              }
            } else {
              vol = 0;
              hold = true;
            }
          }
        }
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
      noisePrescale: this._noisePrescale,
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
      noisePrescale: this._noisePrescale,
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
    this._noiseSeed = state.noiseSeed ?? 1;
    this._noiseFreq = state.noiseFreq ?? 0;
    this._cntNoise = state.cntNoise ?? 0;
    this._noisePrescale = state.noisePrescale ?? false;
    this._bitNoise = state.bitNoise ?? true;
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
    const raw = this._regValues[this._psgRegisterIndex & 0x0f];
    return this.chipType === 'AY'
      ? raw & PsgChip.AY_READ_MASKS[this._psgRegisterIndex]
      : raw;
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
    // Period 0 is treated as period 1 (highest frequency), matching MAME hardware behaviour.
    {
      const periodA = this._toneA || 1;
      this._cntA++;
      if (this._cntA >= periodA) {
        this._cntA = 0;
        this._bitA = !this._bitA;
      }
    }

    // --- Increment TONE B counter
    {
      const periodB = this._toneB || 1;
      this._cntB++;
      if (this._cntB >= periodB) {
        this._cntB = 0;
        this._bitB = !this._bitB;
      }
    }

    // --- Increment TONE C counter
    {
      const periodC = this._toneC || 1;
      this._cntC++;
      if (this._cntC >= periodC) {
        this._cntC = 0;
        this._bitC = !this._bitC;
      }
    }

    // --- Calculate noise sample using hardware-verified 17-bit LFSR with ÷2 prescaler.
    // The LFSR is verified on real AY-3-8910 and YM2149 chips (MAME ay8910.cpp):
    // bit0 XOR bit3 feeds back into bit16. The prescaler halves the effective noise rate.
    // Period=0 behaves as max-speed advance (same as period=1), matching MAME.
    {
      const noisePeriod = this._noiseFreq || 1;
      this._cntNoise++;
      if (this._cntNoise >= noisePeriod) {
        this._cntNoise = 0;
        this._noisePrescale = !this._noisePrescale;
        if (!this._noisePrescale) {
          // Tick LFSR only on every second period expiry
          const feedback = (this._noiseSeed & 1) ^ ((this._noiseSeed >> 3) & 1);
          this._noiseSeed = ((this._noiseSeed >> 1) | (feedback << 16)) & 0x1ffff;
          this._bitNoise = (this._noiseSeed & 1) !== 0;
        }
      }
    }

    // --- Calculate envelope position.
    // AY-3-8910: 16-step envelope with ×2 period multiplier (hardware-verified, MAME ay8910.cpp).
    // YM2149:    32-step envelope with ×1 period multiplier.
    // Both produce the same total envelope duration for a given frequency register value.
    const envPeriod = this.chipType === 'AY' ? this._envFreq * 2 : this._envFreq;
    // Period=0 advances envelope at max speed (MAME: "period 0 is half as period 1")
    {
      const effectiveEnvPeriod = envPeriod || 1;
      this._cntEnv++;
      if (this._cntEnv >= effectiveEnvPeriod) {
        this._cntEnv = 0;
        this._posEnv++;
        if (this._posEnv > 0x7f) {
          this._posEnv = 0x40;
        }
      }
    }

    // --- Calculate channel volumes using hardware-accurate MAME mixer logic.
    // Hardware formula: vol_enabled = (tone_output | tone_disable) & (noise_output | noise_disable)
    // A disabled channel input acts as bypass (always HIGH = 1), enabling DC-level output.
    // Both disabled + non-zero volume = constant DC amplitude (used for digi-drum volume modulation).
    let volA = 0;
    let volB = 0;
    let volC = 0;

    // AY: envelope table stores values 0-15, index directly with (vol & 0x0f).
    // YM: envelope table stores values 0-31, map to 16-entry table with (vol & 0x1f) >> 1.
    // Non-envelope path (_volX * 2 + 1) always maps 0-15 → valid range, so >>1 is used for both.
    const envOK = this.chipType === 'AY';

    // --- Channel A
    {
      const tmpVolA = this._envA
        ? this._psgEnvelopes[this._envStyle * 128 + this._posEnv]
        : this._volA * 2 + 1;
      const envIdxA = this._envA ? (envOK ? (tmpVolA & 0x0f) : ((tmpVolA & 0x1f) >> 1)) : ((tmpVolA & 0x1f) >> 1);
      const amplitudeA = this._psgVolumeTable[envIdxA];
      const toneBitA = this._toneAEnabled ? (this._bitA ? 1 : 0) : 1;
      const noiseBitA = this._noiseAEnabled ? (this._bitNoise ? 1 : 0) : 1;
      volA = (toneBitA & noiseBitA) ? amplitudeA : 0;
      vol += volA;
    }

    // --- Channel B
    {
      const tmpVolB = this._envB
        ? this._psgEnvelopes[this._envStyle * 128 + this._posEnv]
        : this._volB * 2 + 1;
      const envIdxB = this._envB ? (envOK ? (tmpVolB & 0x0f) : ((tmpVolB & 0x1f) >> 1)) : ((tmpVolB & 0x1f) >> 1);
      const amplitudeB = this._psgVolumeTable[envIdxB];
      const toneBitB = this._toneBEnabled ? (this._bitB ? 1 : 0) : 1;
      const noiseBitB = this._noiseBEnabled ? (this._bitNoise ? 1 : 0) : 1;
      volB = (toneBitB & noiseBitB) ? amplitudeB : 0;
      vol += volB;
    }

    // --- Channel C
    {
      const tmpVolC = this._envC
        ? this._psgEnvelopes[this._envStyle * 128 + this._posEnv]
        : this._volC * 2 + 1;
      const envIdxC = this._envC ? (envOK ? (tmpVolC & 0x0f) : ((tmpVolC & 0x1f) >> 1)) : ((tmpVolC & 0x1f) >> 1);
      const amplitudeC = this._psgVolumeTable[envIdxC];
      const toneBitC = this._toneCEnabled ? (this._bitC ? 1 : 0) : 1;
      const noiseBitC = this._noiseCEnabled ? (this._bitNoise ? 1 : 0) : 1;
      volC = (toneBitC & noiseBitC) ? amplitudeC : 0;
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
   * Gets the current output level for channel A (unsigned 0-65535).
   * Uses hardware-accurate MAME mixer logic consistent with generateOutputValue().
   */
  getChannelAVolume (): number {
    const tmpVol = this._envA
      ? this._psgEnvelopes[this._envStyle * 128 + this._posEnv]
      : this._volA * 2 + 1;
    const idx = this._envA
      ? (this.chipType === 'AY' ? (tmpVol & 0x0f) : ((tmpVol & 0x1f) >> 1))
      : ((tmpVol & 0x1f) >> 1);
    const amplitude = this._psgVolumeTable[idx];
    const toneBit = this._toneAEnabled ? (this._bitA ? 1 : 0) : 1;
    const noiseBit = this._noiseAEnabled ? (this._bitNoise ? 1 : 0) : 1;
    return (toneBit & noiseBit) ? amplitude : 0;
  }

  /**
   * Gets the current output level for channel B (unsigned 0-65535).
   * Uses hardware-accurate MAME mixer logic consistent with generateOutputValue().
   */
  getChannelBVolume (): number {
    const tmpVol = this._envB
      ? this._psgEnvelopes[this._envStyle * 128 + this._posEnv]
      : this._volB * 2 + 1;
    const idx = this._envB
      ? (this.chipType === 'AY' ? (tmpVol & 0x0f) : ((tmpVol & 0x1f) >> 1))
      : ((tmpVol & 0x1f) >> 1);
    const amplitude = this._psgVolumeTable[idx];
    const toneBit = this._toneBEnabled ? (this._bitB ? 1 : 0) : 1;
    const noiseBit = this._noiseBEnabled ? (this._bitNoise ? 1 : 0) : 1;
    return (toneBit & noiseBit) ? amplitude : 0;
  }

  /**
   * Gets the current output level for channel C (unsigned 0-65535).
   * Uses hardware-accurate MAME mixer logic consistent with generateOutputValue().
   */
  getChannelCVolume (): number {
    const tmpVol = this._envC
      ? this._psgEnvelopes[this._envStyle * 128 + this._posEnv]
      : this._volC * 2 + 1;
    const idx = this._envC
      ? (this.chipType === 'AY' ? (tmpVol & 0x0f) : ((tmpVol & 0x1f) >> 1))
      : ((tmpVol & 0x1f) >> 1);
    const amplitude = this._psgVolumeTable[idx];
    const toneBit = this._toneCEnabled ? (this._bitC ? 1 : 0) : 1;
    const noiseBit = this._noiseCEnabled ? (this._bitNoise ? 1 : 0) : 1;
    return (toneBit & noiseBit) ? amplitude : 0;
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
      chipType: this.chipType,
      envelope: {
        frequency: this._envFreq,
        style: this._envStyle,
        counter: this._cntEnv,
        position: this._posEnv
      }
    };
  }
}

