import { Z80MachineBase } from "./Z80MachineBase";
import { MachineApi, VmKeyCode } from "./wa-api";
import { MemoryHelper } from "./memory-helpers";
import {
  DebugStepMode,
  EmulationMode,
  ExecuteCycleOptions,
  ExecutionCompletionReason,
  FrameBoundZ80MachineState,
  MachineState,
  Z80MachineStateBase,
} from "../../shared/machines/machine-state";
import { PAGE_INDEX_16, STATE_TRANSFER_BUFF } from "./memory-map";
import { CodeToInject } from "../../shared/machines/api-data";
import { DiagViewFrame } from "../../shared/machines/diag-info";

/**
 * Represents a Z80 machine that uses execution frames (generally bound to screen rendering)
 */
export abstract class FrameBoundZ80Machine extends Z80MachineBase {
  /**
   * Creates a new instance of the frame-bound Z80 machine
   * @param api Machine API to access WA
   * @param roms Optional buffers with ROMs
   */
  constructor(public api: MachineApi, roms?: Buffer[]) {
    super(api);
    api.turnOnMachine();
    this.initRoms(roms);
  }

  /**
   * The currently set execution options
   */
  executionOptions: ExecuteCycleOptions | null;

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
   * Override this property to apply multiple engine loops before
   * Refreshing the UI
   */
  readonly engineLoops: number = 1;

  /**
   * Gets the WA memory address of the first ROM page of the machine
   */
  abstract getRomPageBaseAddress(): number;

  /**
   * Gets the addressable Z80 memory contents from the machine
   */
  abstract getMemoryContents(): Uint8Array;

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
   * Override this method to add extra diagnostics frame data
   * the machine wants to share
   * @param _frame Diagnostics frame to extend
   * @param _state Machine state to use when extending
   */
  addDiagnosticsFrameData(_frame: DiagViewFrame, _state: MachineState): void {}

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
   * Retrieves the current state of the machine
   */
  getMachineState(): MachineState {
    const s = super.getMachineState() as FrameBoundZ80MachineState;

    const mh = new MemoryHelper(this.api, STATE_TRANSFER_BUFF);

    // --- Get execution engine state
    s.lastRenderedFrameTact = mh.readUint32(80);
    s.frameCount = mh.readUint32(84);
    s.frameCompleted = mh.readBool(88);
    s.contentionAccummulated = mh.readUint32(89);
    s.lastExecutionContentionValue = mh.readUint32(93);
    s.emulationMode = mh.readByte(97) as EmulationMode;
    s.debugStepMode = mh.readByte(98) as DebugStepMode;
    s.disableScreenRendering = mh.readBool(99);
    s.executionCompletionReason = mh.readByte(100) as ExecutionCompletionReason;
    s.stepOverBreakPoint = mh.readUint16(101);

    return s as MachineState;
  }

  /**
   * Executes the machine cycle
   * @param options Execution options
   */
  executeCycle(options: ExecuteCycleOptions): void {
    this.executionOptions = options;

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
    this.api.executeMachineLoop();
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
   * Override this method to define an action before the virtual machine has
   * started.
   * @param _debugging Is started in debug mode?
   */
  async beforeStarted(_debugging: boolean): Promise<void> {}

  /**
   * Override this method to define an action after the virtual machine has
   * started.
   * @param _debugging Is started in debug mode?
   * @param _isFirstStart Is the machine started from stopped state?
   */
  async afterStarted(_debugging: boolean): Promise<void> {}

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
   * the machine's execution cycle has completed.
   * @param _resultState Machine state on loop completion
   */
  async onEngineCycleCompletion(
    _resultState: Z80MachineStateBase
  ): Promise<void> {}

  /**
   * Override this method in derived classes to define an action when
   * the UI loop waits for loop state evaluations (whether to continue the
   * cycle of not).
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
   * @param _toWait Number of milliseconds to wait for the next frame
   */
  async onFrameCompleted(
    _resultState: Z80MachineStateBase,
    _toWait: number
  ): Promise<void> {}

  /**
   * Override this method to define an action to run before the injected
   * code is started
   * @param _codeToInject The injected code
   * @param _debug Start in debug mode?
   */
  async beforeRunInjected(
    _codeToInject: CodeToInject,
    _debug?: boolean
  ): Promise<void> {}
}
