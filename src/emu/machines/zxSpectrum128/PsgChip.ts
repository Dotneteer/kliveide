import type { PsgChipState } from "@emu/abstractions/PsgChipState";

type ChipType = "AY" | "YM";

type ToneState = {
  period: number;
  volume: number;
  count: number;
  dutyCycle: number;
  output: number;
};

type EnvelopeState = {
  period: number;
  count: number;
  step: number;
  volume: number;
  hold: number;
  alternate: number;
  attack: number;
  holding: number;
};

type AyYmParam = {
  rUp: number;
  rDown: number;
  resistors: readonly number[];
};

const AY_AFINE = 0x00;
const AY_ACOARSE = 0x01;
const AY_BFINE = 0x02;
const AY_BCOARSE = 0x03;
const AY_CFINE = 0x04;
const AY_CCOARSE = 0x05;
const AY_NOISEPER = 0x06;
const AY_ENABLE = 0x07;
const AY_AVOL = 0x08;
const AY_BVOL = 0x09;
const AY_CVOL = 0x0a;
const AY_EAFINE = 0x0b;
const AY_EACOARSE = 0x0c;
const AY_EASHAPE = 0x0d;

const AY_READ_MASKS: readonly number[] = [
  0xff, 0x0f, 0xff, 0x0f, 0xff, 0x0f, 0x1f, 0xff,
  0x1f, 0x1f, 0x1f, 0xff, 0xff, 0x0f, 0xff, 0xff
];

const AY_DIAGNOSTIC_VOLUME_TABLE: readonly number[] = [
  0, 771, 1028, 1542, 2570, 3855, 5397, 8738,
  10280, 16705, 23387, 29298, 37008, 46517, 55255, 65535
];

const YM_DIAGNOSTIC_VOLUME_TABLE: readonly number[] = [
  0, 257, 257, 514, 514, 771, 771, 1028,
  1542, 1799, 2313, 2570, 3084, 3598, 4369, 4883,
  5911, 6939, 8224, 9509, 11308, 13621, 15934, 18247,
  21588, 26214, 30583, 34952, 41377, 49344, 57568, 65535
];

const AY_PARAM: AyYmParam = {
  rUp: 800000,
  rDown: 8000000,
  resistors: [
    15950, 15350, 15090, 14760, 14275, 13620, 12890, 11370,
    10600, 8590, 7190, 5985, 4820, 3945, 3017, 2345
  ]
};

const YM_PARAM: AyYmParam = {
  rUp: 630,
  rDown: 801,
  resistors: [
    73770, 37586, 27458, 21451, 15864, 12371, 8922, 6796,
    4763, 3521, 2403, 1737, 1123, 762, 438, 251
  ]
};

const YM_ENV_PARAM: AyYmParam = {
  rUp: 630,
  rDown: 801,
  resistors: [
    103350, 73770, 52657, 37586, 32125, 27458, 24269, 21451,
    18447, 15864, 14009, 12371, 10506, 8922, 7787, 6796,
    5689, 4763, 4095, 3521, 2909, 2403, 2043, 1737,
    1397, 1123, 925, 762, 578, 438, 332, 251
  ]
};

function buildSingleTable(param: AyYmParam, zeroIsOff: boolean): number[] {
  const temp: number[] = [];
  let min = 10.0;
  let max = 0.0;

  for (let i = 0; i < param.resistors.length; i++) {
    let rt = 1.0 / param.rDown + 1.0 / 1000.0;
    let rw = 1.0 / param.resistors[i];
    rt += 1.0 / param.resistors[i];

    if (!(zeroIsOff && i === 0)) {
      rw += 1.0 / param.rUp;
      rt += 1.0 / param.rUp;
    }

    temp[i] = rw / rt;
    min = Math.min(min, temp[i]);
    max = Math.max(max, temp[i]);
  }

  return temp.map(value => (((value - min) / (max - min)) - 0.25) * 0.5);
}

function resetTone(): ToneState {
  return { period: 0, volume: 0, count: 0, dutyCycle: 0, output: 0 };
}

function resetEnvelope(): EnvelopeState {
  return {
    period: 0,
    count: 0,
    step: 0,
    volume: 0,
    hold: 0,
    alternate: 0,
    attack: 0,
    holding: 0
  };
}

/**
 * MAME-shaped AY-3-8910/YM2149 PSG core.
 *
 * The class keeps Klive's historical public fields for callers such as
 * TurboSound, but the sound-generation path follows MAME's ay8910_device:
 * register write side effects, 17-bit noise LFSR, envelope state machine,
 * and per-channel resistor tables.
 */
export class PsgChip {
  readonly chipId: number;
  readonly chipType: ChipType;

  private readonly _regValues = new Uint8Array(16);
  private readonly _tone: ToneState[] = [resetTone(), resetTone(), resetTone()];
  private readonly _envelope: EnvelopeState = resetEnvelope();
  private readonly _volumeTable: readonly number[];
  private readonly _envTable: readonly number[];
  private readonly _diagnosticVolumeTable: readonly number[];
  private readonly _envStepMask: number;
  private readonly _envStepMultiplier: number;
  private readonly _coarseMask: number;
  private _psgRegisterIndex = 0;
  private _active = true;
  private _noiseCounter = 0;
  private _noisePrescale = 0;
  private _rng = 1;
  private _volEnabled = [0, 0, 0];
  private _envelopePosition = 0;

  orphanSum = 0;
  orphanSumA = 0;
  orphanSumB = 0;
  orphanSumC = 0;
  orphanAudioSum = 0;
  orphanAudioSumA = 0;
  orphanAudioSumB = 0;
  orphanAudioSumC = 0;
  orphanSamples = 0;

  currentOutputA = 0;
  currentOutputB = 0;
  currentOutputC = 0;
  currentAudioOutputA = 0;
  currentAudioOutputB = 0;
  currentAudioOutputC = 0;

  constructor(chipId: number = 0, chipType: ChipType = "AY") {
    this.chipId = chipId & 0x03;
    this.chipType = chipType;
    this._envStepMask = chipType === "AY" ? 0x0f : 0x1f;
    this._envStepMultiplier = chipType === "AY" ? 2 : 1;
    this._coarseMask = chipType === "AY" ? 0x0f : 0xff;
    this._volumeTable = chipType === "AY"
      ? buildSingleTable(AY_PARAM, true)
      : buildSingleTable(YM_PARAM, false);
    this._envTable = chipType === "AY"
      ? buildSingleTable(AY_PARAM, false)
      : buildSingleTable(YM_ENV_PARAM, false);
    this._diagnosticVolumeTable = chipType === "AY"
      ? AY_DIAGNOSTIC_VOLUME_TABLE
      : YM_DIAGNOSTIC_VOLUME_TABLE;
    this.reset();
  }

  reset(): void {
    this._psgRegisterIndex = 0;
    this._active = true;
    this._regValues.fill(0);
    this._regValues[AY_ENABLE] = 0xff;
    for (let i = 0; i < 3; i++) {
      this._tone[i] = resetTone();
      this._volEnabled[i] = 0;
    }
    Object.assign(this._envelope, resetEnvelope());
    this._noiseCounter = 0;
    this._noisePrescale = 0;
    this._rng = 1;
    this._envelopePosition = 0;
    this.clearOrphanSamples();
    this.currentOutputA = 0;
    this.currentOutputB = 0;
    this.currentOutputC = 0;
    this.currentAudioOutputA = 0;
    this.currentAudioOutputB = 0;
    this.currentAudioOutputC = 0;
  }

  getPsgData(): PsgChipState {
    return {
      psgRegisterIndex: this._psgRegisterIndex,
      regValues: this._regValues,
      toneA: this._tone[0].period,
      toneAEnabled: this.toneEnabled(0),
      noiseAEnabled: this.noiseEnabled(0),
      volA: this.toneVolume(this._tone[0]),
      envA: this.toneEnvelope(this._tone[0]) !== 0,
      cntA: this._tone[0].count,
      bitA: this._tone[0].output !== 0,
      toneB: this._tone[1].period,
      toneBEnabled: this.toneEnabled(1),
      noiseBEnabled: this.noiseEnabled(1),
      volB: this.toneVolume(this._tone[1]),
      envB: this.toneEnvelope(this._tone[1]) !== 0,
      cntB: this._tone[1].count,
      bitB: this._tone[1].output !== 0,
      toneC: this._tone[2].period,
      toneCEnabled: this.toneEnabled(2),
      noiseCEnabled: this.noiseEnabled(2),
      volC: this.toneVolume(this._tone[2]),
      envC: this.toneEnvelope(this._tone[2]) !== 0,
      cntC: this._tone[2].count,
      bitC: this._tone[2].output !== 0,
      noiseSeed: this._rng,
      noiseFreq: this.noisePeriod(),
      cntNoise: this._noiseCounter,
      noisePrescale: this._noisePrescale !== 0,
      bitNoise: this.noiseOutput() !== 0,
      envFreq: this._envelope.period,
      envStyle: this._regValues[AY_EASHAPE],
      cntEnv: this._envelope.count,
      posEnv: this._envelopePosition
    };
  }

  getState(): any {
    return {
      ...this.getPsgData(),
      regValues: new Uint8Array(this._regValues),
      orphanSum: this.orphanSum,
      orphanSumA: this.orphanSumA,
      orphanSumB: this.orphanSumB,
      orphanSumC: this.orphanSumC,
      orphanAudioSum: this.orphanAudioSum,
      orphanAudioSumA: this.orphanAudioSumA,
      orphanAudioSumB: this.orphanAudioSumB,
      orphanAudioSumC: this.orphanAudioSumC,
      orphanSamples: this.orphanSamples,
      chipType: this.chipType,
      envStep: this._envelope.step,
      envVolume: this._envelope.volume,
      envAttack: this._envelope.attack,
      envHold: this._envelope.hold,
      envAlternate: this._envelope.alternate,
      envHolding: this._envelope.holding
    };
  }

  setState(state: any): void {
    if (!state) return;
    this.reset();
    this._psgRegisterIndex = state.psgRegisterIndex ?? 0;
    if (state.regValues) {
      for (let i = 0; i < Math.min(16, state.regValues.length); i++) {
        this.writeRegister(i, state.regValues[i]);
      }
    }
    this._tone[0].count = state.cntA ?? this._tone[0].count;
    this._tone[0].output = state.bitA ? 1 : 0;
    this._tone[1].count = state.cntB ?? this._tone[1].count;
    this._tone[1].output = state.bitB ? 1 : 0;
    this._tone[2].count = state.cntC ?? this._tone[2].count;
    this._tone[2].output = state.bitC ? 1 : 0;
    this._rng = state.noiseSeed ?? this._rng;
    this._noiseCounter = state.cntNoise ?? this._noiseCounter;
    this._noisePrescale = state.noisePrescale ? 1 : 0;
    this._envelope.count = state.cntEnv ?? this._envelope.count;
    if (typeof state.posEnv === "number") {
      this._envelopePosition = state.posEnv;
    }
    if (state.chipType === this.chipType && typeof state.envStep === "number") {
      this._envelope.step = state.envStep;
      this._envelope.volume = state.envVolume ?? (this._envelope.step ^ this._envelope.attack);
      this._envelope.attack = state.envAttack ?? this._envelope.attack;
      this._envelope.hold = state.envHold ?? this._envelope.hold;
      this._envelope.alternate = state.envAlternate ?? this._envelope.alternate;
      this._envelope.holding = state.envHolding ?? this._envelope.holding;
    }
    this.orphanSum = state.orphanSum ?? 0;
    this.orphanSumA = state.orphanSumA ?? 0;
    this.orphanSumB = state.orphanSumB ?? 0;
    this.orphanSumC = state.orphanSumC ?? 0;
    this.orphanAudioSum = state.orphanAudioSum ?? 0;
    this.orphanAudioSumA = state.orphanAudioSumA ?? 0;
    this.orphanAudioSumB = state.orphanAudioSumB ?? 0;
    this.orphanAudioSumC = state.orphanAudioSumC ?? 0;
    this.orphanSamples = state.orphanSamples ?? 0;
  }

  setPsgRegisterIndex(index: number): void {
    this._psgRegisterIndex = index & 0x1f;
    this._active = this.chipType === "YM" || ((index >> 4) === 0);
  }

  get psgRegisterIndex(): number {
    return this._psgRegisterIndex;
  }

  readPsgRegisterValue(): number {
    if (!this._active && this.chipType === "YM") {
      return 0xff;
    }
    const index = this._psgRegisterIndex & 0x0f;
    const value = this._regValues[index];
    return this.chipType === "AY" ? value & AY_READ_MASKS[index] : value;
  }

  writePsgRegisterValue(value: number): void {
    if (!this._active) {
      return;
    }
    this.writeRegister(this._psgRegisterIndex & 0x0f, value & 0xff);
  }

  generateOutputValue(): void {
    for (let channel = 0; channel < 3; channel++) {
      const tone = this._tone[channel];
      const period = Math.max(1, tone.period);
      tone.count += this.chipType === "YM" ? 1 : 1;
      while (tone.count >= period) {
        tone.dutyCycle = (tone.dutyCycle - 1) & 0x1f;
        tone.output = tone.dutyCycle & 0x01;
        tone.count -= period;
      }
    }

    this._noiseCounter++;
    if (this._noiseCounter >= this.noisePeriod()) {
      this._noiseCounter = 0;
      this._noisePrescale ^= 1;
      if (this._noisePrescale === 0) {
        this.noiseRngTick();
      }
    }

    for (let channel = 0; channel < 3; channel++) {
      const tone = this._tone[channel];
      this._volEnabled[channel] =
        (tone.output | this.toneDisabled(channel)) &
        (this.noiseOutput() | this.noiseDisabled(channel));
    }

    if (this._envelope.holding === 0) {
      const period = Math.max(1, this._envelope.period * this._envStepMultiplier);
      this._envelope.count++;
      if (this._envelope.count >= period) {
        this._envelope.count = 0;
        this._envelopePosition++;
        this._envelope.step--;
        if (this._envelope.step < 0) {
          if (this._envelope.hold) {
            if (this._envelope.alternate) {
              this._envelope.attack ^= this._envStepMask;
            }
            this._envelope.holding = 1;
            this._envelope.step = 0;
          } else {
            if (this._envelope.alternate && (this._envelope.step & (this._envStepMask + 1))) {
              this._envelope.attack ^= this._envStepMask;
            }
            this._envelope.step &= this._envStepMask;
          }
        }
      }
    }
    this._envelope.volume = this._envelope.step ^ this._envelope.attack;

    this.updateOutputs();
    this.orphanSamples++;
    this.orphanSumA += this.currentOutputA;
    this.orphanSumB += this.currentOutputB;
    this.orphanSumC += this.currentOutputC;
    this.orphanSum += this.currentOutputA + this.currentOutputB + this.currentOutputC;
    this.orphanAudioSumA += this.currentAudioOutputA;
    this.orphanAudioSumB += this.currentAudioOutputB;
    this.orphanAudioSumC += this.currentAudioOutputC;
    this.orphanAudioSum += this.currentAudioOutputA + this.currentAudioOutputB + this.currentAudioOutputC;
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
    return {
      chipId: this.chipId,
      registerIndex: this._psgRegisterIndex,
      registers: Array.from(this._regValues),
      channels: {
        a: {
          tone: state.toneA,
          toneEnabled: state.toneAEnabled,
          volume: state.volA,
          envelope: state.envA,
          noiseEnabled: state.noiseAEnabled,
          counter: state.cntA,
          bit: state.bitA,
          output: this.currentOutputA
        },
        b: {
          tone: state.toneB,
          toneEnabled: state.toneBEnabled,
          volume: state.volB,
          envelope: state.envB,
          noiseEnabled: state.noiseBEnabled,
          counter: state.cntB,
          bit: state.bitB,
          output: this.currentOutputB
        },
        c: {
          tone: state.toneC,
          toneEnabled: state.toneCEnabled,
          volume: state.volC,
          envelope: state.envC,
          noiseEnabled: state.noiseCEnabled,
          counter: state.cntC,
          bit: state.bitC,
          output: this.currentOutputC
        }
      },
      noise: {
        frequency: state.noiseFreq,
        seed: state.noiseSeed,
        counter: state.cntNoise,
        bit: state.bitNoise
      },
      chipType: this.chipType,
      envelope: {
        frequency: state.envFreq,
        style: state.envStyle,
        counter: state.cntEnv,
        position: state.posEnv
      }
    };
  }

  clearOrphanSamples(): void {
    this.orphanSum = 0;
    this.orphanSumA = 0;
    this.orphanSumB = 0;
    this.orphanSumC = 0;
    this.orphanAudioSum = 0;
    this.orphanAudioSumA = 0;
    this.orphanAudioSumB = 0;
    this.orphanAudioSumC = 0;
    this.orphanSamples = 0;
  }

  private writeRegister(index: number, value: number): void {
    const registerIndex = index & 0x0f;
    this._regValues[registerIndex] = value & 0xff;

    switch (registerIndex) {
      case AY_AFINE:
      case AY_ACOARSE:
        this.setTonePeriod(0);
        break;
      case AY_BFINE:
      case AY_BCOARSE:
        this.setTonePeriod(1);
        break;
      case AY_CFINE:
      case AY_CCOARSE:
        this.setTonePeriod(2);
        break;
      case AY_AVOL:
        this._tone[0].volume = value & 0xff;
        break;
      case AY_BVOL:
        this._tone[1].volume = value & 0xff;
        break;
      case AY_CVOL:
        this._tone[2].volume = value & 0xff;
        break;
      case AY_EAFINE:
      case AY_EACOARSE:
        this._envelope.period = this._regValues[AY_EAFINE] | (this._regValues[AY_EACOARSE] << 8);
        break;
      case AY_EASHAPE:
        this.setEnvelopeShape(value & 0x0f);
        break;
    }
  }

  private setTonePeriod(channel: number): void {
    const fine = this._regValues[channel * 2];
    const coarse = this._regValues[channel * 2 + 1] & this._coarseMask;
    this._tone[channel].period = fine | (coarse << 8);
  }

  private setEnvelopeShape(shape: number): void {
    this._envelope.attack = (shape & 0x04) ? this._envStepMask : 0;
    if ((shape & 0x08) === 0) {
      this._envelope.hold = 1;
      this._envelope.alternate = this._envelope.attack;
    } else {
      this._envelope.hold = shape & 0x01;
      this._envelope.alternate = shape & 0x02;
    }
    this._envelope.step = this._envStepMask;
    this._envelope.holding = 0;
    this._envelope.volume = this._envelope.step ^ this._envelope.attack;
    this._envelopePosition = 0;
  }

  private noiseRngTick(): void {
    const feedback = (this._rng & 0x01) ^ ((this._rng >> 3) & 0x01);
    this._rng = ((this._rng >>> 1) | (feedback << 16)) & 0x1ffff;
  }

  private toneDisabled(channel: number): number {
    return (this._regValues[AY_ENABLE] >> channel) & 0x01;
  }

  private noiseDisabled(channel: number): number {
    return (this._regValues[AY_ENABLE] >> (channel + 3)) & 0x01;
  }

  private toneEnabled(channel: number): boolean {
    return this.toneDisabled(channel) === 0;
  }

  private noiseEnabled(channel: number): boolean {
    return this.noiseDisabled(channel) === 0;
  }

  private toneVolume(tone: ToneState): number {
    return tone.volume & 0x0f;
  }

  private toneEnvelope(tone: ToneState): number {
    return (tone.volume >> 4) & 0x01;
  }

  private noisePeriod(): number {
    const period = this._regValues[AY_NOISEPER] & (this.chipType === "AY" ? 0x1f : 0xff);
    return period === 0 ? 1 : period;
  }

  private noiseOutput(): number {
    return this._rng & 0x01;
  }

  private updateOutputs(): void {
    const diagnosticOutputs = [0, 0, 0];
    const audioOutputs = [0, 0, 0];

    for (let channel = 0; channel < 3; channel++) {
      const tone = this._tone[channel];
      let volumeIndex: number;
      let diagnosticIndex: number;
      if (this.toneEnvelope(tone) !== 0) {
        volumeIndex = this._volEnabled[channel] ? this._envelope.volume : 0;
        diagnosticIndex = volumeIndex;
        audioOutputs[channel] = this._envTable[volumeIndex & this._envStepMask];
      } else {
        volumeIndex = this._volEnabled[channel] ? this.toneVolume(tone) : 0;
        diagnosticIndex =
          this.chipType === "YM" && volumeIndex !== 0
            ? volumeIndex * 2 + 1
            : volumeIndex;
        audioOutputs[channel] = this._volumeTable[volumeIndex & (this._volumeTable.length - 1)];
      }
      diagnosticOutputs[channel] =
        this._diagnosticVolumeTable[diagnosticIndex & (this._diagnosticVolumeTable.length - 1)];
    }

    this.currentOutputA = diagnosticOutputs[0];
    this.currentOutputB = diagnosticOutputs[1];
    this.currentOutputC = diagnosticOutputs[2];
    this.currentAudioOutputA = audioOutputs[0];
    this.currentAudioOutputB = audioOutputs[1];
    this.currentAudioOutputC = audioOutputs[2];
  }
}
