import type { PsgChipState } from "@emu/abstractions/PsgChipState";

/**
 * Represents a PSG chip
 */
export class PsgChip {
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
   * Sum of orphan samples
   */
  orphanSum = 0;

  /**
   * Number of orphan samples
   */
  orphanSamples = 0;

  /**
   * Reset the device when creating it
   */
  constructor () {
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
   * Set the PSG register index
   * @param index PSG register index (0-15)
   */
  setPsgRegisterIndex (index: number): void {
    this._psgRegisterIndex = index & 0x0f;
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

  started = false;
  samplesCount = 0;
  samplesList: { vol: number; count: number }[] = [];

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

    // --- Add Channel A volume value
    let tmpVol = 0;
    if (
      (this._bitA && this._toneAEnabled) ||
      (this._bitNoise && this._noiseAEnabled)
    ) {
      if (this._envA) {
        tmpVol = this._psgEnvelopes[this._envStyle * 128 + this._posEnv];
      } else {
        tmpVol = this._volA * 2 + 1;
      }

      // --- At this point tmpVol is 0-31, let's convert it to 0-65535
      vol += this._psgVolumeTable[(tmpVol & 0x1f) >> 1];
    }

    // --- Add Channel B volume value
    if (
      (this._bitB && this._toneBEnabled) ||
      (this._bitNoise && this._noiseBEnabled)
    ) {
      if (this._envB) {
        tmpVol = this._psgEnvelopes[this._envStyle * 128 + this._posEnv];
      } else {
        tmpVol = this._volB * 2 + 1;
      }

      // --- At this point tmpVol is 0-31, let's convert it to 0-65535
      vol += this._psgVolumeTable[(tmpVol & 0x1f) >> 1];
    }

    // --- Add Channel C volume value
    if (
      (this._bitC && this._toneCEnabled) ||
      (this._bitNoise && this._noiseCEnabled)
    ) {
      if (this._envC) {
        tmpVol = this._psgEnvelopes[this._envStyle * 128 + this._posEnv];
      } else {
        tmpVol = this._volC * 2 + 1;
      }

      // --- At this point tmpVol is 0-31, let's convert it to 0-65535
      vol += this._psgVolumeTable[(tmpVol & 0x1f) >> 1];
    }

    this.orphanSum += vol;
    this.orphanSamples += 1;

    // --- Diagnostics
    if (!this.started && vol > 0) {
      this.started = true;
    }

    if (this.started && this.samplesCount < 20000) {
      if (this.samplesCount) {
        const lastSample = this.samplesList[this.samplesList.length - 1];
        if (lastSample.vol === vol) {
          lastSample.count++;
        } else {
          this.samplesList.push({ vol, count: 0 });
        }
      } else {
        this.samplesList.push({ vol, count: 0 });
      }
      this.samplesCount++;
      // if (this.samplesCount === 20000) {
      //   console.log(this.samplesList);
      // }
    }
  }
}

