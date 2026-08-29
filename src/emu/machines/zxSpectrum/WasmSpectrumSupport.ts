import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { IFloatingBusDevice } from "@emu/abstractions/IFloatingBusDevice";
import type { PsgChipState } from "@emu/abstractions/PsgChipState";
import type { ISpectrumPsgDevice } from "./ISpectrumPsgDevice";
import type { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";

type PsgRead = (name: string, ...args: number[]) => number | undefined;

const EMPTY_AUDIO: AudioSample[] = [];

export class WasmFloatingBusDevice implements IFloatingBusDevice {
  constructor(
    public readonly machine: IZxSpectrumMachine,
    private readonly readBus: () => number
  ) {}

  reset(): void {}

  dispose(): void {}

  readFloatingBus(): number {
    return this.readBus() & 0xff;
  }
}

export class WasmSpectrumPsgDevice implements ISpectrumPsgDevice {
  private sampleRate = 0;

  constructor(
    public readonly machine: IZxSpectrumMachine,
    private readonly read: PsgRead,
    private readonly writeIndex?: (index: number) => void,
    private readonly writeValue?: (value: number) => void
  ) {}

  reset(): void {}

  dispose(): void {}

  getAudioSampleRate(): number {
    return this.sampleRate;
  }

  setAudioSampleRate(sampleRate: number): void {
    this.sampleRate = sampleRate;
  }

  getAudioSamples(): AudioSample[] {
    return EMPTY_AUDIO;
  }

  onNewFrame(): void {}

  setNextAudioSample(): void {}

  calculateCurrentAudioValue(): void {}

  setPsgRegisterIndex(index: number): void {
    this.writeIndex?.(index & 0x0f);
  }

  readPsgRegisterValue(): number {
    const selected = this.getExportValue("GetPsgRegisterIndex") & 0x0f;
    return this.getExportValue("ReadPsgRegisterValue", selected);
  }

  writePsgRegisterValue(value: number): void {
    this.writeValue?.(value & 0xff);
  }

  getPsgState(): PsgChipState {
    const regValues = new Uint8Array(16);
    for (let i = 0; i < regValues.length; i++) {
      regValues[i] = this.getExportValue("GetPsgRegisterValue", i) & 0xff;
    }

    const toneA = this.getExportValue("GetPsgToneA");
    const toneB = this.getExportValue("GetPsgToneB");
    const toneC = this.getExportValue("GetPsgToneC");
    const mixer = regValues[7] ?? 0xff;
    const output = this.getExportValue("GetPsgCurrentOutput");

    return {
      psgRegisterIndex: this.getExportValue("GetPsgRegisterIndex") & 0x0f,
      regValues,
      toneA,
      toneAEnabled: (mixer & 0x01) === 0,
      noiseAEnabled: (mixer & 0x08) === 0,
      volA: this.getExportValue("GetPsgVolumeA") & 0x0f,
      envA: (regValues[8] & 0x10) !== 0,
      cntA: 0,
      bitA: output !== 0,
      toneB,
      toneBEnabled: (mixer & 0x02) === 0,
      noiseBEnabled: (mixer & 0x10) === 0,
      volB: this.getExportValue("GetPsgVolumeB") & 0x0f,
      envB: (regValues[9] & 0x10) !== 0,
      cntB: 0,
      bitB: output !== 0,
      toneC,
      toneCEnabled: (mixer & 0x04) === 0,
      noiseCEnabled: (mixer & 0x20) === 0,
      volC: this.getExportValue("GetPsgVolumeC") & 0x0f,
      envC: (regValues[10] & 0x10) !== 0,
      cntC: 0,
      bitC: output !== 0,
      noiseSeed: 0,
      noiseFreq: regValues[6] & 0x1f,
      cntNoise: 0,
      noisePrescale: false,
      bitNoise: output !== 0,
      envFreq: regValues[11] | (regValues[12] << 8),
      envStyle: regValues[13] & 0x0f,
      cntEnv: 0,
      posEnv: 0
    };
  }

  private getExportValue(name: string, ...args: number[]): number {
    return this.read(name, ...args) ?? 0;
  }
}
