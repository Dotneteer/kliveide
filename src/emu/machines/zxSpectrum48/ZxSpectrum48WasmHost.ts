import type { SysVar } from "@abstractions/SysVar";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { TapeMode } from "@emu/abstractions/TapeMode";
import { SpectrumBeeperDevice } from "../BeeperDevice";
import { CommonScreenDevice } from "../CommonScreenDevice";
import { KeyboardDevice } from "../zxSpectrum/SpectrumKeyboardDevice";
import { AUDIO_SAMPLE_RATE, REWIND_REQUESTED, TAPE_MODE, TAPE_SAVER } from "../machine-props";
import { TapeDevice, TapeSaver } from "../tape/TapeDevice";
import { SP48_MAIN_ENTRY, ZxSpectrumBase } from "../ZxSpectrumBase";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { MC_MEM_SIZE, MC_SCREEN_FREQ } from "@common/machines/constants";
import { zxSpectrum48SysVars } from "./ZxSpectrum48SysVars";
import { WasmFloatingBusDevice } from "../zxSpectrum/WasmSpectrumSupport";

export abstract class ZxSpectrum48WasmHost extends ZxSpectrumBase {
  public readonly machineId = "sp48";
  protected readonly is16KModel: boolean;

  constructor(public readonly modelInfo?: MachineModel, config?: MachineConfigSet) {
    super(config ?? modelInfo?.config ?? {});
    this.is16KModel = modelInfo?.config?.[MC_MEM_SIZE] === 16;
    const isNtsc = modelInfo?.config?.[MC_SCREEN_FREQ] === "ntsc";
    this.baseClockFrequency = isNtsc ? 3_527_500 : 3_500_000;
    this.clockMultiplier = 1;
    this.delayedAddressBus = true;
    this.keyboardDevice = new KeyboardDevice(this);
    this.screenDevice = new CommonScreenDevice(
      this,
      isNtsc
        ? CommonScreenDevice.ZxSpectrum48NtscScreenConfiguration
        : CommonScreenDevice.ZxSpectrum48PalScreenConfiguration
    );
    this.beeperDevice = new SpectrumBeeperDevice(this);
    this.floatingBusDevice = new WasmFloatingBusDevice(this, () => this.doReadPort(0x00ff));
    this.tapeDevice = new TapeDevice(this);
    this.reset();
  }

  dispose(): void {
    this.keyboardDevice?.dispose();
    this.screenDevice?.dispose();
    this.beeperDevice?.dispose();
    this.floatingBusDevice?.dispose();
    this.tapeDevice?.dispose();
  }

  hardReset(): void {
    super.hardReset();
    this.reset();
  }

  reset(): void {
    super.reset();
    this.keyboardDevice.reset();
    this.screenDevice.reset();
    this.beeperDevice.reset();
    const audioRate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof audioRate === "number") {
      this.beeperDevice.setAudioSampleRate(audioRate);
    }
    this.floatingBusDevice.reset();
    this.tapeDevice.reset();
    this.setMachineProperty(TAPE_MODE, TapeMode.Passive);
    this.setMachineProperty(TAPE_SAVER, new TapeSaver(this.tapeDevice as TapeDevice));
    this.setMachineProperty(REWIND_REQUESTED);
    this.clockMultiplier = this.targetClockMultiplier;
    this.executionContext.lastTerminationReason = null;
    this.lastRenderedFrameTact = 0;
    this.emulatedKeyStrokes.length = 0;
  }

  getMemoryPartition(_index: number): Uint8Array {
    return new Uint8Array(0x4000);
  }

  getCurrentPartitions(): number[] {
    return [];
  }

  getSelectedRomPage(): number {
    return 0;
  }

  getSelectedRamBank(): number {
    return 0;
  }

  getCurrentPartitionLabels(): string[] {
    return [];
  }

  parsePartitionLabel(_label: string): number | undefined {
    return undefined;
  }

  getPartitionLabels(): Record<number, string> {
    return {};
  }

  getRomFlags(): boolean[] {
    return [true, true, false, false, false, false, false, false];
  }

  async getCodeInjectionFlow(model: string): Promise<CodeInjectionFlow> {
    if (model === "sp48") {
      return [
        {
          type: "ReachExecPoint",
          rom: 0,
          execPoint: SP48_MAIN_ENTRY,
          message: `Main execution cycle point reached (ROM0/$${toHexa4(SP48_MAIN_ENTRY)})`
        },
        { type: "Inject" },
        {
          type: "SetReturn",
          returnPoint: SP48_MAIN_ENTRY
        }
      ];
    }
    throw new Error(`Code for machine model '${model}' cannot run on this virtual machine.`);
  }

  get sysVars(): SysVar[] {
    return zxSpectrum48SysVars;
  }
}
