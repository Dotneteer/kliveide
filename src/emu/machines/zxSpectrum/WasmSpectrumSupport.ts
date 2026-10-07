import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { IFloatingBusDevice } from "@emu/abstractions/IFloatingBusDevice";
import type { PsgChipState } from "@emu/abstractions/PsgChipState";
import type { ISpectrumPsgDevice } from "./ISpectrumPsgDevice";
import type { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { beamAt, drawnUpTo, type BeamPosition, type BeamTiming } from "@common/utils/beamGeometry";

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

/**
 * The beam of a core built on `zx-spectrum-ula.c` (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` §4.3), from
 * its `GetBeamInfo(field)` export (fields in `ulaBeamInfo`), the displayed buffer's size and start
 * offset, and the buffer pixels per Spectrum pixel (2 on the Timex).
 *
 * A line's left border is drawn at the end of the line before it, from `firstVisibleBorderTact` on,
 * and buffer row 0 is the first visible line; the displayed picture starts `startOffset` pixels in.
 * Seen from the displayed buffer that is one linear raster (see `beamGeometry.ts`).
 */
export function spectrumWasmBeamPosition(
  beamInfo: (field: number) => number,
  bufferWidth: number,
  bufferHeight: number,
  startOffset: number,
  pixelScale = 1
): BeamPosition {
  const frameTact = beamInfo(0);
  const lineTime = beamInfo(1);
  const rasterLines = beamInfo(2);
  const firstVisibleLine = beamInfo(3);
  const firstDisplayLine = beamInfo(4);
  const leftBorderTacts = lineTime - beamInfo(5);
  const lastRendered = beamInfo(6);
  const lineStartTact = beamInfo(8);
  const startRows = Math.floor(startOffset / bufferWidth);
  const timing: BeamTiming = {
    unit: "T",
    tactsPerLine: lineTime,
    linesPerFrame: rasterLines,
    lineStartTact,
    firstVisibleTact: lineStartTact + (firstVisibleLine + startRows) * lineTime - leftBorderTacts,
    tactsPerBufferPixel: 1 / (2 * pixelScale),
    bufferWidth,
    bufferHeight,
    paperLeft: leftBorderTacts * 2 * pixelScale,
    paperTop: firstDisplayLine - firstVisibleLine - startRows,
    paperWidth: 256 * pixelScale,
    paperHeight: 192
  };
  // --- `lastRendered` is the first tact the ULA has not drawn yet
  return beamAt(timing, frameTact, drawnUpTo(timing, lastRendered));
}
