import { SysVar } from "@abstractions/SysVar";
import { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { IFloppyControllerDevice } from "@emu/abstractions/IFloppyControllerDeviceNew";
import { OpCodePrefix } from "@emu/abstractions/OpCodePrefix";
import { SpectrumBeeperDevice } from "@emu/machines/BeeperDevice";
import { CommonScreenDevice } from "@emu/machines/CommonScreenDevice";
import { ZxSpectrumBase } from "@emu/machines/ZxSpectrumBase";
import { FloppyControllerDevice } from "@emu/machines/disk/FloppyControllerDeviceNew";
import { IFloppyControllerDeviceTest } from "@emu/machines/disk/IFloppyContorllerDeviceTest";
import { DISK_A_DATA, DISK_B_DATA } from "@emu/machines/machine-props";
import { TapeDevice } from "@emu/machines/tape/TapeDevice";

export class TestUpd765Machine extends ZxSpectrumBase {
  readonly machineId = "test-upd765";

  /**
   * Represents the floppy controller device
   */
  floppyDevice: IFloppyControllerDevice;

  constructor (hasDriveB = false) {
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

  reset (): void {
    super.reset();
    this.screenDevice.reset();
    this.beeperDevice.reset();
    this.tapeDevice.reset();
    this.floppyDevice.reset();
    this._frameCompleted = true;
    (this.floppyDevice as unknown as IFloppyControllerDeviceTest).disableRandomSeek = true;
  }

  /**
   * Executes the machine loop using the current execution context.
   * @returns The value indicates the termination reason of the loop
   */
  executeMachineFrame (): FrameTerminationMode {
    // --- Sign that the loop execution is in progress
    this.executionContext.lastTerminationReason = undefined;

    // --- Execute the machine loop until the frame is completed or the loop is interrupted because of any other
    // --- completion reason, like reaching a breakpoint, etc.
    do {
      // --- Test if the machine frame has just been completed.
      if (this._frameCompleted) {
        const currentFrameStart = this.tacts - this._frameOverflow;

        // --- Update the CPU's clock multiplier, if the machine's has changed.
        let clockMultiplierChanged = false;
        if (
          this.allowCpuClockChange() &&
          this.clockMultiplier !== this.targetClockMultiplier
        ) {
          // --- Use the current clock multiplier
          this.clockMultiplier = this.targetClockMultiplier;
          this.tactsInCurrentFrame = this.tactsInFrame * this.clockMultiplier;
          clockMultiplierChanged = true;
        }

        // --- Allow a machine to handle frame initialization
        this.onInitNewFrame(clockMultiplierChanged);
        this._frameCompleted = false;

        // --- Calculate the start tact of the next machine frame
        this._nextFrameStartTact =
          currentFrameStart + this.tactsInFrame * this.clockMultiplier;
      }

      // --- Execute the next CPU instruction entirely
      do {
        if (this.isCpuSnoozed()) {
          this.tacts += 16;
        } else {
          this.executeCpuCycle();
        }
      } while (this.prefix !== OpCodePrefix.None);

      // --- Execute the queued event
      if (this._queuedEvents) {
        const currentEvent = this._queuedEvents[0];
        if (currentEvent.eventTact < this.tacts) {
          // --- Time to execute the event
          currentEvent.eventFn(currentEvent.data);
          this._queuedEvents.shift();
          if (this._queuedEvents.length === 0) {
            this._queuedEvents = null;
          }
        }
      }

      // --- Allow the machine to do additional tasks after the completed CPU instruction
      this.afterInstructionExecuted();

      // --- Do the machine reached the termination point?
      if (this.testTerminationPoint()) {
        // --- The machine reached the termination point
        return (this.executionContext.lastTerminationReason =
          FrameTerminationMode.UntilExecutionPoint);
      }

      this._frameCompleted = this.tacts >= this._nextFrameStartTact;
    } while (!this._frameCompleted);

    // --- Calculate the overflow, we need this value in the next frame
    this._frameOverflow = Math.floor(this.tacts - this._nextFrameStartTact);

    // --- Done
    return (this.executionContext.lastTerminationReason =
      FrameTerminationMode.Normal);
  }

  emulateFrameCompletion (numFrames: number): void {
    for (let i = 0; i < numFrames; i++) {
      this.executeMachineFrame();
    }
  }

  onInitNewFrame (_: boolean): void {
    this.floppyDevice?.onFrameCompleted();
  }

  // --- We do not neet to use these methods in this test
  readScreenMemory (offset: number): number {
    throw new Error("Method not implemented.");
  }
  get64KFlatMemory (): Uint8Array {
    throw new Error("Method not implemented.");
  }
  get16KPartition (index: number): Uint8Array {
    throw new Error("Method not implemented.");
  }
  getAudioSamples (): number[] {
    throw new Error("Method not implemented.");
  }
  get sysVars (): SysVar[] {
    throw new Error("Method not implemented.");
  }
  getCodeInjectionFlow (model: string): CodeInjectionFlow {
    throw new Error("Method not implemented.");
  }
  setup (): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
