import type { SysVar } from "@abstractions/SysVar";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { ISpectrumPsgDevice } from "@emu/machines/zxSpectrum/ISpectrumPsgDevice";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";
import type { IFloppyControllerDevice } from "@emu/abstractions/IFloppyControllerDevice";

import { TapeMode } from "@emu/abstractions/TapeMode";
import { SpectrumBeeperDevice } from "../BeeperDevice";
import { CommonScreenDevice } from "../CommonScreenDevice";
import { KeyboardDevice } from "../zxSpectrum/SpectrumKeyboardDevice";
import {
  SP48_MAIN_ENTRY,
  SPP3_MAIN_WAITING_LOOP,
  SPP3_RETURN_TO_EDITOR,
  SP_KEY_WAIT,
  ZxSpectrumBase
} from "../ZxSpectrumBase";
import { AUDIO_SAMPLE_RATE, REWIND_REQUESTED, TAPE_MODE, TAPE_SAVER } from "../machine-props";
import { TapeDevice, TapeSaver } from "../tape/TapeDevice";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { MC_DISK_SUPPORT } from "@common/machines/constants";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { zxSpectrum128SysVars } from "../zxSpectrum128/ZxSpectrum128SysVars";
import { zxSpectrum48SysVars } from "../zxSpectrum48/ZxSpectrum48SysVars";
import { injectSpectrumCode, parseSpectrumPartitionLabel } from "../zxSpectrum128/ZxSpectrum128WasmHost";
import { WasmFloatingBusDevice, WasmSpectrumPsgDevice } from "../zxSpectrum/WasmSpectrumSupport";
import type { CodeToInject } from "@abstractions/CodeToInject";

export function mergeZxSpectrumP3eConfig(
  model?: MachineModel,
  config?: MachineConfigSet
): MachineConfigSet {
  return {
    ...(model?.config ?? {}),
    ...(config ?? {})
  };
}

class WasmP3eFloppyLogFacade implements IFloppyControllerDevice {
  constructor(public readonly machine: ZxSpectrumBase) {}
  reset(): void {}
  dispose(): void {}
  onFrameCompleted(): void {}
  readMainStatusRegister(): number { return 0xff; }
  readDataRegister(): number { return 0xff; }
  writeDataRegister(_value: number): void {}
  turnOnMotor(): void {}
  turnOffMotor(): void {}
  flushDiskChanges(): void {}
  getLogEntries(): string[] { return []; }
}

export abstract class ZxSpectrumP3eWasmHost extends ZxSpectrumBase {
  readonly machineId = "spp3e";
  selectedRom = 0;
  selectedBank = 0;
  lastContendedValue = 0xff;
  lastUlaReadValue = 0xff;
  pagingEnabled = true;
  useShadowScreen = false;
  inSpecialPagingMode = false;
  specialConfigMode = 0;
  diskMotorOn = false;
  psgDevice: ISpectrumPsgDevice;
  floppyDevice: IFloppyControllerDevice;
  protected readonly uploadedRomPages = new Map<number, Uint8Array>();

  constructor(model?: MachineModel, config?: MachineConfigSet) {
    super(mergeZxSpectrumP3eConfig(model, config));
    this.baseClockFrequency = 3_546_900;
    this.clockMultiplier = 1;
    this.delayedAddressBus = true;
    this.keyboardDevice = new KeyboardDevice(this);
    this.screenDevice = new CommonScreenDevice(this, CommonScreenDevice.ZxSpectrumP3EScreenConfiguration);
    this.beeperDevice = new SpectrumBeeperDevice(this);
    this.psgDevice = new WasmSpectrumPsgDevice(
      this,
      (name, ...args) => this.readPsgExport(name, ...args),
      index => this.writePsgIndex(index),
      value => this.writePsgValue(value)
    );
    this.floppyDevice = new WasmP3eFloppyLogFacade(this);
    this.floatingBusDevice = new WasmFloatingBusDevice(this, () => this.doReadPort(0x1235));
    this.tapeDevice = new TapeDevice(this);
    this.reset();
  }

  dispose(): void {
    this.keyboardDevice?.dispose();
    this.screenDevice?.dispose();
    this.beeperDevice?.dispose();
    this.psgDevice?.dispose();
    this.floppyDevice?.dispose();
    this.floatingBusDevice?.dispose();
    this.tapeDevice?.dispose();
  }

  hardReset(): void {
    super.hardReset();
    this.reset();
  }

  reset(): void {
    super.reset();
    this.selectedRom = 0;
    this.selectedBank = 0;
    this.pagingEnabled = true;
    this.useShadowScreen = false;
    this.inSpecialPagingMode = false;
    this.specialConfigMode = 0;
    this.diskMotorOn = false;
    this.keyboardDevice.reset();
    this.screenDevice.reset();
    this.beeperDevice.reset();
    this.psgDevice.reset();
    const audioRate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof audioRate === "number") {
      this.beeperDevice.setAudioSampleRate(audioRate);
      this.psgDevice.setAudioSampleRate(audioRate);
    }
    this.floppyDevice.reset();
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

  get isSpectrum48RomSelected(): boolean {
    return this.selectedRom === 3;
  }

  parsePartitionLabel(label: string): number | undefined {
    return parseSpectrumPartitionLabel(label, 4);
  }

  getPartitionLabels(): Record<number, string> {
    return {
      [-1]: "R0",
      [-2]: "R1",
      [-3]: "R2",
      [-4]: "R3",
      0: "B0",
      1: "B1",
      2: "B2",
      3: "B3",
      4: "B4",
      5: "B5",
      6: "B6",
      7: "B7"
    };
  }

  getCurrentPartitionLabels(): string[] {
    const labels = this.getPartitionLabels();
    return this.getCurrentPartitions().map(partition => labels[partition] ?? "");
  }

  async getCodeInjectionFlow(model: string): Promise<CodeInjectionFlow> {
    if (model === "sp48") {
      return [
        { type: "ReachExecPoint", rom: 0, execPoint: SPP3_MAIN_WAITING_LOOP, message: `Main execution cycle point reached (ROM0/$${toHexa4(SPP3_MAIN_WAITING_LOOP)})` },
        { type: "Start" },
        { type: "QueueKey", primary: SpectrumKeyCode.N6, secondary: SpectrumKeyCode.CShift, wait: SP_KEY_WAIT, message: "Arrow down" },
        { type: "QueueKey", primary: SpectrumKeyCode.N6, secondary: SpectrumKeyCode.CShift, wait: SP_KEY_WAIT, message: "Arrow down" },
        { type: "QueueKey", primary: SpectrumKeyCode.N6, secondary: SpectrumKeyCode.CShift, wait: SP_KEY_WAIT, message: "Arrow down" },
        { type: "QueueKey", primary: SpectrumKeyCode.Enter, wait: 0, message: "Enter" },
        { type: "ReachExecPoint", rom: 3, execPoint: SP48_MAIN_ENTRY, message: `Main execution cycle point reached (ROM3/$${toHexa4(SP48_MAIN_ENTRY)})` },
        { type: "Inject" },
        { type: "SetReturn", returnPoint: SP48_MAIN_ENTRY }
      ];
    }
    if (model === "spp3e") {
      return [
        { type: "ReachExecPoint", rom: 0, execPoint: SPP3_MAIN_WAITING_LOOP, message: `Main execution cycle point reached (ROM0/$${toHexa4(SPP3_MAIN_WAITING_LOOP)})` },
        { type: "Start" },
        { type: "QueueKey", primary: SpectrumKeyCode.N6, secondary: SpectrumKeyCode.CShift, wait: SP_KEY_WAIT, message: "Arrow down" },
        { type: "QueueKey", primary: SpectrumKeyCode.Enter, wait: 0, message: "Enter" },
        { type: "ReachExecPoint", rom: 1, execPoint: SPP3_RETURN_TO_EDITOR, message: `Main execution cycle point reached (ROM1/$${toHexa4(SPP3_RETURN_TO_EDITOR)})` },
        { type: "Inject" },
        { type: "SetReturn", returnPoint: SPP3_RETURN_TO_EDITOR }
      ];
    }
    throw new Error(`Code for machine model '${model}' cannot run on this virtual machine.`);
  }

  injectCodeToRun(codeToInject: CodeToInject): number {
    injectSpectrumCode(this, codeToInject);
    return codeToInject.entryAddress ?? codeToInject.segments[0].startAddress;
  }

  get sysVars(): SysVar[] {
    return [...zxSpectrum128SysVars, ...zxSpectrum48SysVars];
  }

  uploadRomBytes(partition: number, data: Uint8Array): void {
    this.uploadedRomPages.set(partition, new Uint8Array(data));
  }

  protected replayUploadedRomPages(upload: (partition: number, data: Uint8Array) => void): void {
    for (const [partition, data] of this.uploadedRomPages) {
      upload(partition, data);
    }
  }

  protected getConfiguredDriveCount(): number {
    const diskSupport = this.config?.[MC_DISK_SUPPORT];
    return typeof diskSupport === "number" ? Math.max(0, Math.min(2, diskSupport)) : 0;
  }

  protected abstract readPsgExport(name: string, ...args: number[]): number | undefined;
  protected abstract writePsgIndex(index: number): void;
  protected abstract writePsgValue(value: number): void;
}
