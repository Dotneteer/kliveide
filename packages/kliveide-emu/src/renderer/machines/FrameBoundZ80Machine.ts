import { Z80MachineBase } from "./Z80MachineBase";
import { MachineApi } from "./wa-api";
import { MemoryHelper } from "./memory-helpers";
import {
  ExecuteCycleOptions,
  MachineState,
  Z80MachineStateBase,
} from "../../shared/machines/machine-state";
import { BLOCK_LOOKUP_TABLE, EXEC_OPTIONS_BUFFER } from "./memory-map";
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
  constructor(public api: MachineApi, public roms?: Uint8Array[]) {
    super(api);
  }

  /**
   * Prepares the machine to run
   */
  prepareMachine(): void {
    this.configureMachine();
    this.api.setupMachine();
    this.initRoms(this.roms);
  }

  /**
   * The currently set execution options
   */
  executionOptions: ExecuteCycleOptions | null;

  /**
   * Handles pressing or releasing a physical key on the keyboard
   * @param keycode Virtual keycode
   * @param isDown Is the key pressed down?
   */
  handlePhysicalKey(keycode: string, isDown: boolean): void {
    const keyMapping = this.getKeyMapping();
    const keySet = keyMapping[keycode];
    if (!keySet) {
      // --- No mapping for the specified physical key
      return;
    }

    if (typeof keySet === "string") {
      // --- Single key
      const resolved = this.resolveKeyCode(keySet);
      if (resolved !== null) {
        this.setKeyStatus(resolved, isDown);
      }
    } else {
      for (const key of keySet) {
        const resolved = this.resolveKeyCode(key);
        if (resolved !== null) {
          this.setKeyStatus(resolved, isDown);
        }
      }
    }
  }

  /**
   * Override this method to configure the virtual machine before turning it on
   */
  configureMachine(): void {
  }

  /**
   * Initializes the specified ROMs
   * @param roms Optional buffers with ROM contents
   */
  initRoms(roms?: Uint8Array[]): void {
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
   * Gets the specified memory partition
   */
  abstract getMemoryPartition(partition: number): Uint8Array;

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
  setKeyStatus(key: number, isDown: boolean): void {
    this.api.setKeyStatus(key, isDown);
  }

  /**
   * Gets the status of the specified key
   * @param key Key to get
   * @returns True, if key is pressed; otherwise, false
   */
  getKeyStatus(key: number): boolean {
    return this.api.getKeyStatus(key) !== 0;
  }

  /**
   * Executes the machine cycle
   * @param options Execution options
   */
  executeCycle(options: ExecuteCycleOptions): void {
    this.executionOptions = options;

    // --- Copy execution options
    const mh = new MemoryHelper(this.api, EXEC_OPTIONS_BUFFER);
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
    const mh = new MemoryHelper(this.api, BLOCK_LOOKUP_TABLE);
    const pageStart = mh.readUint32(((addr >> 13) & 0x07) * 16);
    const mem = new Uint8Array(this.api.memory.buffer, pageStart, 0x2000);
    return mem[addr & 0x1fff];
  }

  /**
   * Writes a byte into the memory
   * @param addr Memory address
   * @param value Value to write
   */
  writeMemory(addr: number, value: number): void {
    const mh = new MemoryHelper(this.api, BLOCK_LOOKUP_TABLE);
    const pageStart = mh.readUint32(((addr >> 13) & 0x07) * 16);
    const mem = new Uint8Array(this.api.memory.buffer, pageStart, 0x2000);
    mem[addr & 0x1fff] = value;
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
