import type { PsgChipState } from "@emu/abstractions/PsgChipState";

/**
 * `volTableAy` / `volTableYm` of `_input/next-fpga/src/audio/ym2149.vhd`, scaled by 257 to the 16-bit
 * range TurboSound mixes in (255 * 257 = 65535).
 */
const VOL_TABLE_AY = [
  0x00, 0x03, 0x04, 0x06, 0x0a, 0x0f, 0x15, 0x22, 0x28, 0x41, 0x5b, 0x72, 0x90, 0xb5, 0xd7, 0xff
].map((v) => v * 257);
const VOL_TABLE_YM = [
  0x00, 0x01, 0x01, 0x02, 0x02, 0x03, 0x03, 0x04, 0x06, 0x07, 0x09, 0x0a, 0x0c, 0x0e, 0x11, 0x13,
  0x17, 0x1b, 0x20, 0x25, 0x2c, 0x35, 0x3e, 0x47, 0x54, 0x66, 0x77, 0x88, 0xa1, 0xc0, 0xe0, 0xff
].map((v) => v * 257);

/** ym2149.vhd read masks in AY mode (`reg(n)(7..k) and not ctrl_aymode`). */
const AY_READ_MASKS = [0xff, 0x0f, 0xff, 0x0f, 0xff, 0x0f, 0x1f, 0xff, 0x1f, 0x1f, 0x1f, 0xff, 0xff, 0x0f, 0xff, 0xff];

/**
 * One PSG of the ZX Spectrum Next, following `_input/next-fpga/src/audio/ym2149.vhd` (with
 * `I_SEL_L = '1'`, as turbosound.vhd instantiates it).
 *
 * `tick()` is one `ena_div` pulse: the 1.75 MHz PSG clock enable divided by 8, one every 128 master
 * (28 MHz) clocks. Tone, noise and envelope counters step on it; the noise LFSR on every other one.
 *
 * - Registers: 5-bit address; writes to 16-31 are dropped; reads of 16-31 give $FF in YM mode and
 *   register n & 15 in AY mode. In AY mode R1/R3/R5/R13 read 4 bits and R6/R8/R9/R10 5 bits. R14/R15
 *   read the pulled-up I/O port ($FF) while R7 bit 6/7 makes it an input, else the register.
 * - Tone: period = R(2n+1) bits 3-0 & R(2n); counter compared with period - 1 (0 for periods 0/1);
 *   the output toggles when the counter reaches it.
 * - Noise: period = R6 bits 4-0; 17-bit LFSR, new bit 16 = bit 0 xor bit 2 (xor 1 when all zero).
 * - Envelope: 16-bit period, 5-bit level, the shape logic of `p_envelope_shape`. An R13 write reloads
 *   the start level and steps once at once (`env_ena` is set by the restart).
 * - Output: channel = (tone-off or tone) and (noise-off or noise); the 5-bit level indexes volTableYm,
 *   or its bits 4-1 index volTableAy in AY mode.
 */
export class NextPsgChip {
  readonly chipId: number;

  private readonly _reg = new Uint8Array(16);
  private _addr = 0;
  /** `ctrl_aymode`: NextReg $06 bit 0 (1 = AY, 0 = YM). */
  private _ayMode = false;

  private readonly _toneCount = [0, 0, 0];
  private readonly _toneOp = [0, 0, 0];
  private _noiseDiv = 0;
  private _noiseCount = 0;
  private _poly17 = 0;
  private _envCount = 0;
  private _envVol = 0;
  private _envInc = 0;
  private _envHold = 0;
  private _envSteps = 0;

  currentOutputA = 0;
  currentOutputB = 0;
  currentOutputC = 0;

  constructor(chipId = 0) {
    this.chipId = chipId & 0x03;
    this.reset();
  }

  /** RESET_H: registers cleared (R7 = $FF), address 0, outputs silent; the counters run on. */
  reset(): void {
    this._reg.fill(0);
    this._reg[7] = 0xff;
    this._addr = 0;
    this.currentOutputA = 0;
    this.currentOutputB = 0;
    this.currentOutputC = 0;
  }

  /** Power-on: also the counters and generators. */
  hardReset(): void {
    this.reset();
    this._toneCount.fill(0);
    this._toneOp.fill(0);
    this._noiseDiv = 0;
    this._noiseCount = 0;
    this._poly17 = 0;
    this._envCount = 0;
    this._envVol = 0;
    this._envInc = 0;
    this._envHold = 0;
    this._envSteps = 0;
  }

  get ayMode(): boolean {
    return this._ayMode;
  }

  set ayMode(value: boolean) {
    this._ayMode = value;
  }

  get psgRegisterIndex(): number {
    return this._addr;
  }

  /** `busctrl_addr`: the 5-bit register address (turbosound.vhd checks bits 7-5 = 000). */
  setPsgRegisterIndex(index: number): void {
    this._addr = index & 0x1f;
  }

  readPsgRegisterValue(): number {
    if (this._addr & 0x10 && !this._ayMode) return 0xff;
    const index = this._addr & 0x0f;
    if (index === 14) return this._reg[7] & 0x40 ? this._reg[14] : 0xff;
    if (index === 15) return this._reg[7] & 0x80 ? this._reg[15] : 0xff;
    return this._ayMode ? this._reg[index] & AY_READ_MASKS[index] : this._reg[index];
  }

  writePsgRegisterValue(value: number): void {
    if (this._addr & 0x10) return;
    const index = this._addr & 0x0f;
    this._reg[index] = value & 0xff;
    if (index === 13) this.restartEnvelope();
  }

  /** The value of register `index` (0-15) as stored. */
  getRegister(index: number): number {
    return this._reg[index & 0x0f];
  }

  /** One `ena_div` pulse. */
  tick(): void {
    // --- Tone generators
    for (let ch = 0; ch < 3; ch++) {
      const freq = ((this._reg[2 * ch + 1] & 0x0f) << 8) | this._reg[2 * ch];
      const comp = freq >> 1 ? freq - 1 : 0;
      if (this._toneCount[ch] >= comp) {
        this._toneCount[ch] = 0;
        this._toneOp[ch] ^= 1;
      } else {
        this._toneCount[ch]++;
      }
    }

    // --- Noise: `ena_div_noise` on every other `ena_div` (noise_div toggles on each)
    const noiseTick = this._noiseDiv === 1;
    this._noiseDiv ^= 1;
    if (noiseTick) {
      const period = this._reg[6] & 0x1f;
      const comp = period >> 1 ? period - 1 : 0;
      if (this._noiseCount >= comp) {
        this._noiseCount = 0;
        const p = this._poly17;
        const feedback = (p & 1) ^ ((p >> 2) & 1) ^ (p === 0 ? 1 : 0);
        this._poly17 = (p >>> 1) | (feedback << 16);
      } else {
        this._noiseCount++;
      }
    }

    // --- Envelope: a step each time the counter reaches period - 1
    const envFreq = (this._reg[12] << 8) | this._reg[11];
    const envComp = envFreq >> 1 ? envFreq - 1 : 0;
    if (this._envCount >= envComp) {
      this._envCount = 0;
      this.stepEnvelope();
    } else {
      this._envCount++;
    }

    this.updateOutputs();
  }

  private restartEnvelope(): void {
    // --- env_reset: load the start state; env_ena = '1' makes the first step follow at once
    this._envCount = 0;
    if (this._reg[13] & 0x04) {
      this._envVol = 0;
      this._envInc = 1;
    } else {
      this._envVol = 31;
      this._envInc = 0;
    }
    this._envHold = 0;
    this._envSteps = 0;
    this.stepEnvelope();
    this.updateOutputs();
  }

  /** ym2149.vhd `p_envelope_shape` for one `env_ena` event. */
  private stepEnvelope(): void {
    const shape = this._reg[13];
    const vol = this._envVol;
    const isZero = vol >> 1 === 0;
    const isOnes = vol >> 1 === 15;
    const isBot = isZero && (vol & 1) === 0;
    const isBotP1 = isZero && (vol & 1) === 1;
    const isTopM1 = isOnes && (vol & 1) === 0;
    const isTop = isOnes && (vol & 1) === 1;
    let hold = this._envHold;
    let inc = this._envInc;
    if (!this._envHold) this._envVol = this._envInc ? (vol + 1) & 31 : (vol + 31) & 31;
    if (!(shape & 0x08)) {
      if (!inc ? isBotP1 : isTop) hold = 1;
    } else if (shape & 0x01) {
      if (!inc) {
        if (shape & 0x02 ? isBot : isBotP1) hold = 1;
      } else if (shape & 0x02 ? isTop : isTopM1) hold = 1;
    } else if (shape & 0x02) {
      if (!inc) {
        if (isBotP1) hold = 1;
        if (isBot) {
          hold = 0;
          inc = 1;
        }
      } else {
        if (isTopM1) hold = 1;
        if (isTop) {
          hold = 0;
          inc = 0;
        }
      }
    }
    this._envHold = hold;
    this._envInc = inc;
    this._envSteps++;
  }

  private channelLevel(ch: number): number {
    const r7 = this._reg[7];
    const noise = this._poly17 & 1;
    const mixed = ((r7 >> ch) & 1 | this._toneOp[ch]) & ((r7 >> (ch + 3)) & 1 | noise);
    if (!mixed) return 0;
    const vol = this._reg[8 + ch];
    if (vol & 0x10) return this._envVol;
    return vol & 0x0f ? ((vol & 0x0f) << 1) | 1 : 0;
  }

  private updateOutputs(): void {
    const out = (ch: number) => {
      const level = this.channelLevel(ch);
      return this._ayMode ? VOL_TABLE_AY[level >> 1] : VOL_TABLE_YM[level];
    };
    this.currentOutputA = out(0);
    this.currentOutputB = out(1);
    this.currentOutputC = out(2);
  }

  // ------------------------------------------------------------------------------------------------
  // Diagnostics and persistence

  getPsgData(): PsgChipState {
    const r = this._reg;
    const period = (ch: number) => ((r[2 * ch + 1] & 0x0f) << 8) | r[2 * ch];
    const toneOn = (ch: number) => ((r[7] >> ch) & 1) === 0;
    const noiseOn = (ch: number) => ((r[7] >> (ch + 3)) & 1) === 0;
    return {
      psgRegisterIndex: this._addr,
      regValues: this._reg,
      toneA: period(0),
      toneAEnabled: toneOn(0),
      noiseAEnabled: noiseOn(0),
      volA: r[8] & 0x0f,
      envA: (r[8] & 0x10) !== 0,
      cntA: this._toneCount[0],
      bitA: this._toneOp[0] !== 0,
      toneB: period(1),
      toneBEnabled: toneOn(1),
      noiseBEnabled: noiseOn(1),
      volB: r[9] & 0x0f,
      envB: (r[9] & 0x10) !== 0,
      cntB: this._toneCount[1],
      bitB: this._toneOp[1] !== 0,
      toneC: period(2),
      toneCEnabled: toneOn(2),
      noiseCEnabled: noiseOn(2),
      volC: r[10] & 0x0f,
      envC: (r[10] & 0x10) !== 0,
      cntC: this._toneCount[2],
      bitC: this._toneOp[2] !== 0,
      noiseSeed: this._poly17,
      noiseFreq: r[6] & 0x1f,
      cntNoise: this._noiseCount,
      noisePrescale: this._noiseDiv !== 0,
      bitNoise: (this._poly17 & 1) !== 0,
      envFreq: (r[12] << 8) | r[11],
      envStyle: r[13],
      cntEnv: this._envCount,
      posEnv: this._envSteps
    };
  }

  getState(): any {
    return {
      ...this.getPsgData(),
      regValues: new Uint8Array(this._reg),
      ayMode: this._ayMode,
      toneCount: [...this._toneCount],
      toneOp: [...this._toneOp],
      noiseDiv: this._noiseDiv,
      envVol: this._envVol,
      envInc: this._envInc,
      envHold: this._envHold
    };
  }

  setState(state: any): void {
    if (!state) return;
    this.hardReset();
    if (state.regValues) for (let i = 0; i < Math.min(16, state.regValues.length); i++) this._reg[i] = state.regValues[i];
    this._addr = (state.psgRegisterIndex ?? 0) & 0x1f;
    this._ayMode = !!state.ayMode;
    if (Array.isArray(state.toneCount)) state.toneCount.forEach((v: number, i: number) => (this._toneCount[i] = v));
    if (Array.isArray(state.toneOp)) state.toneOp.forEach((v: number, i: number) => (this._toneOp[i] = v));
    this._noiseDiv = state.noiseDiv ?? 0;
    this._noiseCount = state.cntNoise ?? 0;
    this._poly17 = state.noiseSeed ?? 0;
    this._envCount = state.cntEnv ?? 0;
    this._envSteps = state.posEnv ?? 0;
    this._envVol = state.envVol ?? 0;
    this._envInc = state.envInc ?? 0;
    this._envHold = state.envHold ?? 0;
    this.updateOutputs();
  }

  /** One `ena_div` pulse (the name TurboSound's callers have used). */
  generateOutputValue(): void {
    this.tick();
  }

  getChannelAVolume(): number {
    return this.currentOutputA;
  }

  getChannelBVolume(): number {
    return this.currentOutputB;
  }

  getChannelCVolume(): number {
    return this.currentOutputC;
  }

  getDebugInfo(): any {
    const state = this.getPsgData();
    const channel = (ch: "A" | "B" | "C", output: number) => ({
      tone: state[`tone${ch}`],
      toneEnabled: state[`tone${ch}Enabled`],
      volume: state[`vol${ch}`],
      envelope: state[`env${ch}`],
      noiseEnabled: state[`noise${ch}Enabled`],
      counter: state[`cnt${ch}`],
      bit: state[`bit${ch}`],
      output
    });
    return {
      chipId: this.chipId,
      ayMode: this._ayMode,
      registerIndex: this._addr,
      registers: Array.from(this._reg),
      channels: {
        a: channel("A", this.currentOutputA),
        b: channel("B", this.currentOutputB),
        c: channel("C", this.currentOutputC)
      },
      noise: { frequency: state.noiseFreq, seed: state.noiseSeed, counter: state.cntNoise, bit: state.bitNoise },
      envelope: { frequency: state.envFreq, style: state.envStyle, counter: state.cntEnv, position: state.posEnv, level: this._envVol }
    };
  }
}
