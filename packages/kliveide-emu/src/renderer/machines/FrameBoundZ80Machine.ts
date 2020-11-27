import { Z80MachineBase } from "./Z80MachineBase";
import { MachineApi, VmKeyCode } from "../../native/api/api";
import { MemoryHelper } from "../../native/api/memory-helpers";
import {
  ExecuteCycleOptions,
  ExecutionCompletionReason,
  Z80MachineStateBase,
} from "./machine-state";
import {
  PAGE_INDEX_16,
  STATE_TRANSFER_BUFF,
} from "../../native/api/memory-map";

/**
 * Represents a Z80 machine that uses execution frames (generally bound to screen rendering)
 */
export abstract class FrameBoundZ80Machine extends Z80MachineBase {
  /**
   * Creates a new instance of the frame-bound Z80 machine
   * @param api Machine API to access WA
   * @param type Machine type
   * @param roms Optional buffers with ROMs
   */
  constructor(public api: MachineApi, public type: number, roms?: Buffer[]) {
    super(api, type);
    api.turnOnMachine();
    this.initRoms(roms);
  }

  /**
   * Initializes the specified ROMs
   * @param roms Optional buffers with ROM contents
   */
  initRoms(roms?: Buffer[]): void {
    if (!roms) {
      return;
    }
    const mh = new MemoryHelper(this.api, this.getRomPageBaseAddress());
    for (let i = 0; i < roms.length; i++) {
      const rom = roms[i];
      for (let j = 0; j < rom.length; j++) {
        mh.writeByte(0x4000 * i + j, rom[j]);
      }
    }
  }

  /**
   * Gets the WA memory address of the first ROM page of the machine
   */
  abstract getRomPageBaseAddress(): number;

  /**
   * Gets the addressable Z80 memory contents from the machine
   */
  abstract getMemoryContents(): Uint8Array;

  /**
   * Retrieves the current state of the machine
   */
  abstract getMachineState(): Z80MachineStateBase;

  /**
   * Gets the screen data of the virtual machine
   */
  abstract getScreenData(): Uint32Array;

  /**
   * Sets the audio sample rate
   * @param rate Sample rate
   */
  abstract setAudioSampleRate(rate: number): void;

  /**
   * Prepares the engine for code injection
   * @param model Model to run in the virtual machine
   */
  abstract prepareForInjection(model: string): Promise<number>;

  /**
   * Sets the status of the specified key
   * @param key Key to set
   * @param isDown Status value
   */
  setKeyStatus(key: VmKeyCode, isDown: boolean): void {
    this.api.setKeyStatus(key, isDown);
  }

  /**
   * Gets the status of the specified key
   * @param key Key to get
   * @returns True, if key is pressed; otherwise, false
   */
  getKeyStatus(key: VmKeyCode): boolean {
    return this.api.getKeyStatus(key) !== 0;
  }

  /**
   * Executes the machine cycle
   * @param options Execution options
   */
  executeCycle(options: ExecuteCycleOptions): void {
    // --- Copy execution options
    const mh = new MemoryHelper(this.api, STATE_TRANSFER_BUFF);
    mh.writeByte(0, options.emulationMode);
    mh.writeByte(1, options.debugStepMode);
    mh.writeBool(2, options.fastTapeMode);
    mh.writeByte(3, options.terminationRom);
    mh.writeUint16(4, options.terminationPoint);
    mh.writeBool(6, options.fastVmMode);
    mh.writeBool(7, options.disableScreenRendering);
    mh.writeUint32(8, options.stepOverBreakpoint);
    this.api.setExecutionOptions();

    // --- Run the cycle and retrieve state
    this.api.executeMachineCycle();
  }

  /**
   * Reads a byte from the memory
   * @param addr Memory address
   */
  readMemory(addr: number): number {
    const mh = new MemoryHelper(this.api, PAGE_INDEX_16);
    const pageStart = mh.readUint32(((addr >> 14) & 0x03) * 6);
    const mem = new Uint8Array(this.api.memory.buffer, pageStart, 0x4000);
    return mem[addr & 0x3fff];
  }

  /**
   * Writes a byte into the memory
   * @param addr Memory address
   * @param value Value to write
   */
  writeMemory(addr: number, value: number): void {
    const mh = new MemoryHelper(this.api, PAGE_INDEX_16);
    const pageStart = mh.readUint32(((addr >> 14) & 0x03) * 6);
    const mem = new Uint8Array(this.api.memory.buffer, pageStart, 0x4000);
    mem[addr & 0x3fff] = value;
  }

  // ==========================================================================
  // Lifecycle methods

  /**
   * Override this method to define actions when the virtual machine is started
   * from stopped state
   */
  async beforeFirstStart(): Promise<void> {}

  /**
   * Override this method to define an action when the virtual machine has
   * started.
   * @param _debugging Is started in debug mode?
   * @param _isFirstStart Is the machine started from stopped state?
   */
  async onStarted(_debugging: boolean, _isFirstStart: boolean): Promise<void> {}

  /**
   * Override this action to define an action when the virtual machine
   * has paused.
   * @param _isFirstPause Is the machine paused the first time?
   */
  async onPaused(_isFirstPause: boolean): Promise<void> {}

  /**
   * Override this action to define an action when the virtual machine
   * has stopped.
   */
  async onStopped(): Promise<void> {}

  /**
   * Override this action to define an action before the step-into
   * operation is executed.
   */
  async beforeStepInto(): Promise<void> {}

  /**
   * Override this action to define an action before the step-over
   * operation is executed.
   */
  async beforeStepOver(): Promise<void> {}

  /**
   * Override this action to define an action before the step-out
   * operation is executed.
   */
  async beforeStepOut(): Promise<void> {}

  /**
   * Override this method in derived classes to define an action when
   * the machine's execution cycle has completed and waits for
   * evaluations (whether to continue the cycle of not)
   * @param _resultState Machine state on loop completion
   */
  async beforeEvalLoopCompletion(
    _resultState: Z80MachineStateBase
  ): Promise<void> {}

  /**
   * Override this method to define an action when the execution cycle has
   * completed after the loop evaluation.
   * @param _resultState Machine state on cycle completion
   */
  async onExecutionCycleCompleted(
    _resultState: Z80MachineStateBase
  ): Promise<void> {}

  /**
   * Override this method to define an action when an entire frame has been
   * completed within the machine execution cycle.
   * @param _resultState Machine state on frame completion
   */
  async onFrameCompleted(_resultState: Z80MachineStateBase): Promise<void> {}
}
