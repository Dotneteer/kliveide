import { SysVar } from "@abstractions/SysVar";
import { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { IFloppyControllerDevice } from "@emu/abstractions/IFloppyControllerDevice";
import { SpectrumBeeperDevice } from "@emu/machines/BeeperDevice";
import { CommonScreenDevice } from "@emu/machines/CommonScreenDevice";
import { ZxSpectrumBase } from "@emu/machines/ZxSpectrumBase";
import { FloppyControllerDevice } from "@emu/machines/disk/FloppyControllerDevice";
import { IFloppyControllerDeviceTest } from "@emu/machines/disk/IFloppyContorllerDeviceTest";
import { TapeDevice } from "@emu/machines/tape/TapeDevice";

export class TestUpd765Machine extends ZxSpectrumBase {
  readonly machineId = "test-upd765";

  /**
   * Represents the floppy controller device
   */
  floppyDevice: IFloppyControllerDevice;

  constructor(hasDriveB = false) {
    super();
    this.baseClockFrequency = 3_546_900;
    this.clockMultiplier = 1;
    this.delayedAddressBus = true;
    this.floppyDevice = new FloppyControllerDevice(this, hasDriveB);
    this.screenDevice = new CommonScreenDevice(
      this,
      CommonScreenDevice.ZxSpectrumP3EScreenConfiguration
    );
    this.beeperDevice = new SpectrumBeeperDevice(this);
    this.tapeDevice = new TapeDevice(this);
    this.reset();
  }

  reset(): void {
    super.reset();
    this.screenDevice.reset();
    this.beeperDevice.reset();
    this.tapeDevice.reset();
    this.floppyDevice.reset();
    (this.floppyDevice as unknown as IFloppyControllerDeviceTest).disableRandomSeek = true;
    this.machineFrameRunner.reset();
  }

  getCurrentPartitions(): number[] {
    return [];
  }

  getRomFlags(): boolean[] {
    return [];
  }
  
  /**
   * Executes the machine loop using the current execution context.
   * @returns The value indicates the termination reason of the loop
   */
  executeMachineFrame(): FrameTerminationMode {
    return this.machineFrameRunner.executeMachineFrame();
  }

  emulateFrameCompletion(numFrames: number): void {
    for (let i = 0; i < numFrames; i++) {
      this.executeMachineFrame();
    }
  }

  onInitNewFrame(_: boolean): void {
    this.floppyDevice?.onFrameCompleted();
  }

  // --- We do not neet to use these methods in this test
  readScreenMemory(offset: number): number {
    throw new Error("Method not implemented.");
  }

  get64KFlatMemory(): Uint8Array {
    throw new Error("Method not implemented.");
  }

  getMemoryPartition(index: number): Uint8Array {
    throw new Error("Method not implemented.");
  }

  getAudioSamples(): number[] {
    throw new Error("Method not implemented.");
  }

  get sysVars(): SysVar[] {
    throw new Error("Method not implemented.");
  }

  async getCodeInjectionFlow(model: string): Promise<CodeInjectionFlow> {
    throw new Error("Method not implemented.");
  }

  setup(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  getCurrentPartitionLabels(): string[] {
    throw new Error("Method not implemented.");
  }

  parsePartitionLabel(_label: string): number | undefined {
    throw new Error("Method not implemented.");
  }
  getPartitionLabels(): Record<number, string> {
    throw new Error("Method not implemented.");
  }
}
