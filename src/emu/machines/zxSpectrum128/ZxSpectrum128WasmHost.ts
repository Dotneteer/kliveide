import type { SysVar } from "@abstractions/SysVar";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { ISpectrumPsgDevice } from "@emu/machines/zxSpectrum/ISpectrumPsgDevice";
import type { MachineConfigSet, MachineModel } from "@common/machines/info-types";

import { TapeMode } from "@emu/abstractions/TapeMode";
import { SpectrumBeeperDevice } from "../BeeperDevice";
import { CommonScreenDevice } from "../CommonScreenDevice";
import { KeyboardDevice } from "../zxSpectrum/SpectrumKeyboardDevice";
import { AUDIO_SAMPLE_RATE, REWIND_REQUESTED, TAPE_MODE, TAPE_SAVER } from "../machine-props";
import { TapeDevice, TapeSaver } from "../tape/TapeDevice";
import {
  SP128_MAIN_WAITING_LOOP,
  SP128_RETURN_TO_EDITOR,
  SP48_MAIN_ENTRY,
  SP_KEY_WAIT,
  ZxSpectrumBase
} from "../ZxSpectrumBase";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { zxSpectrum48SysVars } from "../zxSpectrum48/ZxSpectrum48SysVars";
import { zxSpectrum128SysVars } from "./ZxSpectrum128SysVars";
import { WasmFloatingBusDevice, WasmSpectrumPsgDevice } from "../zxSpectrum/WasmSpectrumSupport";

export abstract class ZxSpectrum128WasmHost extends ZxSpectrumBase {
  readonly machineId = "sp128";
  selectedRom = 0;
  selectedBank = 0;
  pagingEnabled = true;
  useShadowScreen = false;
  psgDevice: ISpectrumPsgDevice;

  constructor(_modelInfo?: MachineModel, config?: MachineConfigSet) {
    super(config ?? {});
    this.baseClockFrequency = 3_546_900;
    this.clockMultiplier = 1;
    this.delayedAddressBus = true;
    this.keyboardDevice = new KeyboardDevice(this);
    this.screenDevice = new CommonScreenDevice(this, CommonScreenDevice.ZxSpectrum128ScreenConfiguration);
    this.beeperDevice = new SpectrumBeeperDevice(this);
    this.psgDevice = new WasmSpectrumPsgDevice(
      this,
      (name, ...args) => this.readPsgExport(name, ...args),
      index => this.writePsgIndex(index),
      value => this.writePsgValue(value)
    );
    this.floatingBusDevice = new WasmFloatingBusDevice(this, () => this.doReadPort(0x00ff));
    this.tapeDevice = new TapeDevice(this);
    this.reset();
  }

  dispose(): void {
    this.keyboardDevice?.dispose();
    this.screenDevice?.dispose();
    this.beeperDevice?.dispose();
    this.psgDevice?.dispose();
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
    this.keyboardDevice.reset();
    this.screenDevice.reset();
    this.beeperDevice.reset();
    this.psgDevice.reset();
    const audioRate = this.getMachineProperty(AUDIO_SAMPLE_RATE);
    if (typeof audioRate === "number") {
      this.beeperDevice.setAudioSampleRate(audioRate);
      this.psgDevice.setAudioSampleRate(audioRate);
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

  get isSpectrum48RomSelected(): boolean {
    return this.selectedRom === 1;
  }

  parsePartitionLabel(label: string): number | undefined {
    return parseSpectrumPartitionLabel(label, 2);
  }

  getPartitionLabels(): Record<number, string> {
    return {
      [-2]: "R1",
      [-1]: "R0",
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

  getRomFlags(): boolean[] {
    return [true, true, false, false, false, false, false, false];
  }

  async getCodeInjectionFlow(model: string): Promise<CodeInjectionFlow> {
    if (model === "sp48") {
      return [
        {
          type: "ReachExecPoint",
          rom: 0,
          execPoint: SP128_MAIN_WAITING_LOOP,
          message: `Main execution cycle point reached (ROM0/$${toHexa4(SP128_MAIN_WAITING_LOOP)})`
        },
        { type: "Start" },
        { type: "QueueKey", primary: SpectrumKeyCode.N6, secondary: SpectrumKeyCode.CShift, wait: SP_KEY_WAIT, message: "Arrow down" },
        { type: "QueueKey", primary: SpectrumKeyCode.N6, secondary: SpectrumKeyCode.CShift, wait: SP_KEY_WAIT, message: "Arrow down" },
        { type: "QueueKey", primary: SpectrumKeyCode.N6, secondary: SpectrumKeyCode.CShift, wait: SP_KEY_WAIT, message: "Arrow down" },
        { type: "QueueKey", primary: SpectrumKeyCode.Enter, wait: 0, message: "Enter" },
        {
          type: "ReachExecPoint",
          rom: 1,
          execPoint: SP48_MAIN_ENTRY,
          message: `Main execution cycle point reached (ROM1/$${toHexa4(SP48_MAIN_ENTRY)})`
        },
        { type: "Inject" },
        { type: "SetReturn", returnPoint: SP48_MAIN_ENTRY }
      ];
    }
    if (model === "sp128") {
      return [
        {
          type: "ReachExecPoint",
          rom: 0,
          execPoint: SP128_MAIN_WAITING_LOOP,
          message: `Main execution cycle point reached (ROM0/$${toHexa4(SP128_MAIN_WAITING_LOOP)})`
        },
        { type: "Start" },
        { type: "QueueKey", primary: SpectrumKeyCode.N6, secondary: SpectrumKeyCode.CShift, wait: SP_KEY_WAIT, message: "Arrow down" },
        { type: "QueueKey", primary: SpectrumKeyCode.Enter, wait: 0, message: "Enter" },
        {
          type: "ReachExecPoint",
          rom: 1,
          execPoint: SP128_RETURN_TO_EDITOR,
          message: `Main execution cycle point reached (ROM1/$${toHexa4(SP128_RETURN_TO_EDITOR)})`
        },
        { type: "Inject" },
        { type: "SetReturn", returnPoint: SP128_RETURN_TO_EDITOR }
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

  protected abstract readPsgExport(name: string, ...args: number[]): number | undefined;
  protected abstract writePsgIndex(index: number): void;
  protected abstract writePsgValue(value: number): void;
}

export function parseSpectrumPartitionLabel(label: string, romCount: number): number | undefined {
  if (!label) return undefined;
  let isRom = false;
  const normalized = label.trim().toUpperCase();
  if (normalized.startsWith("R")) {
    isRom = true;
  } else if (!normalized.startsWith("B")) {
    return undefined;
  }
  const index = normalized.substring(1);
  if (!index.match(/^\d+$/)) {
    return undefined;
  }
  const partition = isRom ? -parseInt(index, 10) - 1 : parseInt(index, 10);
  return partition >= -romCount && partition < 8 ? partition : undefined;
}

export function injectSpectrumCode(machine: ZxSpectrumBase, codeToInject: CodeToInject): void {
  if (!codeToInject.options.noCls) {
    for (let addr = 0x4000; addr < 0x5800; addr++) {
      machine.writeMemory(addr, 0);
    }
    for (let addr = 0x5800; addr < 0x5b00; addr++) {
      machine.writeMemory(addr, 0x38);
    }
  }
  for (const segment of codeToInject.segments) {
    if (segment.bank !== undefined) {
      const partition = machine.getMemoryPartition(segment.bank);
      const baseAddr = segment.bankOffset ?? 0;
      partition.set(segment.emittedCode, baseAddr);
    } else {
      const addr = segment.startAddress;
      for (let i = 0; i < segment.emittedCode.length; i++) {
        machine.writeMemory(addr + i, segment.emittedCode[i]);
      }
    }
  }
  if (codeToInject.options.cursorl || codeToInject.options.cursork) {
    machine.writeMemory(0x5c3b, machine.readMemory(0x5c3b) | 0x08);
  }
}
