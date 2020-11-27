import { FrameBoundZ80Machine } from "./FrameBoundZ80Machine";
import {
  ExecutionState,
  ExecutionStateChangedArgs,
} from "../../shared/machines/execution-state";
import { ILiteEvent, LiteEvent } from "../../shared/utils/LiteEvent";
import {
  ExecuteCycleOptions,
  ExecutionCompletionReason,
  EmulationMode,
  DebugStepMode,
  Z80MachineStateBase,
} from "./machine-state";
import { EmulatedKeyStroke } from "./keyboard";
import { MemoryHelper } from "../../native/api/memory-helpers";
import { AudioRenderer } from "./AudioRenderer";
import {
  rendererProcessStore,
  createRendererProcessStateAware,
} from "../rendererProcessStore";
import {
  emulatorSetExecStateAction,
  emulatorSetFrameIdAction,
  emulatorSetMemoryContentsAction,
  engineInitializedAction,
  emulatorSetDebugAction,
  emulatorLoadTapeAction,
  emulatorSetLoadModeAction,
} from "../../shared/state/redux-emulator-state";
import { BinaryReader } from "../../shared/utils/BinaryReader";
import { TzxReader } from "../../shared/tape/tzx-file";
import { TapReader } from "../../shared/tape/tap-file";
import { CodeToInject, RegisterData } from "../../shared/machines/api-data";
import { vmSetRegistersAction } from "../../shared/state/redux-vminfo-state";
import {
  BEEPER_SAMPLE_BUFFER,
  PSG_SAMPLE_BUFFER,
  BANK_0_OFFS,
} from "../../native/api/memory-map";
import { VmKeyCode } from "../../native/api/api";
import { IVmEngineController } from "./IVmEngineController";

/**
 * This class represents the engine that controls and runs the
 * selected virtual machine in the renderer process.
 */
export class VmEngine implements IVmEngineController {
  // --- The current execution state of the machine
  private _vmState: ExecutionState = ExecutionState.None;

  // --- Indicates if the machine has started from stopped state
  private _isFirstStart: boolean = false;

  // --- Indicates that this is the first pause of the machine
  private _isFirstPause: boolean = false;

  // --- Signs that the machine runs in debug mode
  private _isDebugging: boolean = false;

  // --- Signs that the exacution cycle has been cancelled
  private _cancelled: boolean = false;

  // --- Raise when the execution state of the machine has been changed
  private _executionStateChanged = new LiteEvent<ExecutionStateChangedArgs>();

  // --- Raise when it's time to refresh the screen
  private _screenRefreshed = new LiteEvent<void>();

  // --- Represents the task of the machine's execution cycle
  private _completionTask: Promise<void> | null = null;

  // --- The last loaded machine state
  private _loadedState: Z80MachineStateBase;

  // --- Keyboard emulation
  private _keyStrokeQueue: EmulatedKeyStroke[] = [];

  // --- Beeper emulation
  private _beeperRenderer: AudioRenderer | null = null;

  // --- PSG emulation
  private _psgRenderer: AudioRenderer | null = null;

  // --- Tape emulation
  private _defaultTapeSet = new Uint8Array(0);

  // --- FrameID information
  private _startCount = 0;

  // --- Time monitoring
  private _sumFrameTime = 0.0;
  private _lastFrameTime = 0.0;
  private _avgFrameTime = 0.0;
  private _sumEngineTime = 0.0;
  private _lastEngineTime = 0.0;
  private _avgEngineTime = 0.0;
  private _renderedFrames = 0;

  // --- The last known list of breakpoints
  private _oldBrpoints: number[] = [];

  /**
   * Initializes the engine with the specified virtual machine instance
   * @param z80Machine Z80-based virtual machine to use
   */
  constructor(public z80Machine: FrameBoundZ80Machine) {
    // --- Obtain the state of the machine, including memory contents
    this._loadedState = z80Machine.getMachineState();
    const memContents = this.z80Machine.getMemoryContents();
    // --- Notify the UI about the new state
    rendererProcessStore.dispatch(
      emulatorSetMemoryContentsAction(memContents)()
    );
    rendererProcessStore.dispatch(engineInitializedAction());

    // --- Watch for breakpoint changes
    const breakpointStateAware = createRendererProcessStateAware("breakpoints");
    breakpointStateAware.stateChanged.on((state) => {
      // --- Whenever breakpoints change, notify the WA engine
      const brpoints = state as number[];
      if (!brpoints) {
        return;
      }
      const oldBreaks = this._oldBrpoints;
      if (
        oldBreaks.length !== brpoints.length ||
        oldBreaks.some((item) => !brpoints.includes(item))
      ) {
        // --- Breakpoints changed, update them
        this.z80Machine.api.eraseBreakpoints();
        for (const brpoint of Array.from(brpoints)) {
          this.z80Machine.api.setBreakpoint(brpoint);
        }
      }
      this._oldBrpoints = brpoints;
    });
  }

  /**
   * Signs that the screen has been refreshed
   */
  signScreenRefreshed(): void {
    this._screenRefreshed.fire();
  }

  /**
   * Number of frame tacts
   */
  get tactsInFrame(): number {
    return this._loadedState.tactsInFrame;
  }

  /**
   * Width of the screen
   */
  get screenWidth(): number {
    return this._loadedState.screenWidth;
  }

  /**
   * Height of the screen
   */
  get screenHeight(): number {
    return this._loadedState.screenLines;
  }

  /**
   * The current state of the virtual machine
   */
  get executionState(): ExecutionState {
    return this._vmState;
  }
  set executionState(newState: ExecutionState) {
    const oldState = this._vmState;
    this._vmState = newState;

    // --- Notify the UI
    this._executionStateChanged.fire(
      new ExecutionStateChangedArgs(oldState, newState, this._isDebugging)
    );

    // --- State the new execution state
    rendererProcessStore.dispatch(emulatorSetExecStateAction(this._vmState)());
  }

  /**
   * Signs that this is the very first start of the
   * virtual machine
   */
  get isFirstStart(): boolean {
    return this._isFirstStart;
  }

  /**
   * Signs that this is the very first paused state
   * of the virtual machine
   */
  get isFirstPause(): boolean {
    return this._isFirstPause;
  }

  /**
   * Has the execution been cancelled?
   */
  get cancelled(): boolean {
    return this._cancelled;
  }

  /**
   * This event is raised whenever the state of the virtual machine changes
   */
  get executionStateChanged(): ILiteEvent<ExecutionStateChangedArgs> {
    return this._executionStateChanged.expose();
  }

  /**
   * This event is raised when the screen of the virtual machine has
   * been refreshed
   */
  get screenRefreshed(): ILiteEvent<void> {
    return this._screenRefreshed.expose();
  }

  /**
   * Gets the promise that represents completion
   */
  get completionTask(): Promise<void> | undefined {
    return this._completionTask;
  }

  /**
   * Gets the state of the ZX Spectrum machine
   */
  getMachineState(): Z80MachineStateBase {
    return this._loadedState;
  }

  /**
   * Sets the status of the specified ZX Spectrum key
   * @param key Code of the key
   * @param isDown Pressed/released status of the key
   */
  setKeyStatus(key: VmKeyCode, isDown: boolean): void {
    this.z80Machine.setKeyStatus(key, isDown);
  }

  /**
   * Sets the audio sample rate to use with sound devices
   * @param rate Audio sampe rate to use
   */
  setAudioSampleRate(rate: number): void {
    this.z80Machine.setAudioSampleRate(rate);
  }

  /**
   * Gets the screen pixels data to display
   */
  getScreenData(): Uint32Array {
    return this.z80Machine.getScreenData();
  }

  /**
   * Puts a keystroke into the queue of emulated keystrokes
   * @param startFrame Start frame when the key is pressed
   * @param frames End frame when the key is released
   * @param primary Primary key
   * @param secodary Optional secondary key
   */
  queueKeyStroke(
    startFrame: number,
    frames: number,
    primaryKey: VmKeyCode,
    secondaryKey?: VmKeyCode
  ): void {
    this._keyStrokeQueue.push({
      startFrame,
      endFrame: startFrame + frames,
      primaryKey,
      secondaryKey,
    });
  }

  /**
   * Starts the virtual machine and keeps it running
   */
  async start(): Promise<void> {
    await this.run(new ExecuteCycleOptions());
    await this.z80Machine.onStarted(false, this._isFirstStart);
  }

  /**
   * Starts the virtual machine in debugging mode
   */
  async startDebug(): Promise<void> {
    await this.run(
      new ExecuteCycleOptions(
        EmulationMode.Debugger,
        DebugStepMode.StopAtBreakpoint
      )
    );
    await this.z80Machine.onStarted(true, this._isFirstStart);
  }

  /**
   * Starts the virtual machine with the specified exeution options
   * @param options Execution options
   */
  async run(options: ExecuteCycleOptions): Promise<void> {
    if (this.executionState === ExecutionState.Running) {
      return;
    }

    this._startCount++;

    // --- Prepare the machine to run
    this._isFirstStart =
      this.executionState === ExecutionState.None ||
      this.executionState === ExecutionState.Stopped;

    // --- Prepare the current machine for first run
    if (this._isFirstStart) {
      this.z80Machine.turnOnMachine();

      // --- Get the current emulator state
      const state = rendererProcessStore.getState();

      // --- Allow th machine execute a custom action on first start
      await this.z80Machine.beforeFirstStart();

      // --- Set breakpoints
      this.z80Machine.api.eraseBreakpoints();
      for (const brpoint of Array.from(state.breakpoints)) {
        this.z80Machine.api.setBreakpoint(brpoint);
      }

      // --- Reset time information
      this._lastFrameTime = 0.0;
      this._avgFrameTime = 0.0;
      this._sumEngineTime = 0.0;
      this._lastEngineTime = 0.0;
      this._avgEngineTime = 0.0;
      this._sumFrameTime = 0.0;
      this._renderedFrames = 0;

      // --- Clear debug information
      this.z80Machine.api.resetStepOverStack();
    }

    // --- Initialize debug info before run
    this.z80Machine.api.markStepOverStack();

    // --- Sign the current debug mode
    this._isDebugging = options.debugStepMode !== DebugStepMode.None;
    rendererProcessStore.dispatch(emulatorSetDebugAction(this._isDebugging)());

    // --- Execute a single cycle
    this.executionState = ExecutionState.Running;
    this._cancelled = false;
    this._completionTask = this.executeCycle(this, options);
  }

  /**
   * Pauses the running machine.
   */
  async pause(): Promise<void> {
    if (
      this.executionState === ExecutionState.None ||
      this.executionState === ExecutionState.Stopped ||
      this.executionState === ExecutionState.Paused ||
      !this._completionTask
    ) {
      // --- Nothing to pause
      await this.z80Machine.onPaused(false);
      return;
    }

    // --- Prepare the machine to pause
    this.executionState = ExecutionState.Pausing;
    this._isFirstPause = this._isFirstStart;
    await this.cancelRun();
    this.executionState = ExecutionState.Paused;
    await this.z80Machine.onPaused(this._isFirstPause);
  }

  /**
   * Stops the virtual machine
   */
  async stop(): Promise<void> {
    // --- Stop only running machine
    switch (this._vmState) {
      case ExecutionState.None:
      case ExecutionState.Stopped:
        break;

      case ExecutionState.Paused:
        // --- The machine is paused, it can be quicky stopped
        this.executionState = ExecutionState.Stopping;
        this.executionState = ExecutionState.Stopped;
        break;

      default:
        // --- Initiate stop
        this.executionState = ExecutionState.Stopping;
        await this.cancelRun();
        this.executionState = ExecutionState.Stopped;
        break;
    }
    await this.z80Machine.onStopped();
  }

  /**
   * Restarts the virtual machine
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  /**
   * Starts the virtual machine in step-into mode
   */
  async stepInto(): Promise<void> {
    await this.z80Machine.beforeStepInto();
    await this.run(
      new ExecuteCycleOptions(EmulationMode.Debugger, DebugStepMode.StepInto)
    );
  }

  /**
   * Starts the virtual machine in step-over mode
   */
  async stepOver(): Promise<void> {
    await this.z80Machine.beforeStepOver();

    // --- Calculate the location of the step-over breakpoint
    const memContents = this.z80Machine.getMemoryContents();
    const pc = this.getMachineState().pc;
    const opCode = memContents[pc];
    let length = 0;
    if (opCode === 0xcd) {
      // --- CALL
      length = 3;
    } else if ((opCode & 0xc7) === 0xc4) {
      // --- CALL with conditions
      length = 3;
    } else if ((opCode & 0xc7) === 0xc7) {
      // --- RST instruction
      length = 1;
    } else if (opCode === 0x76) {
      // --- HALT
      length = 1;
    } else if (opCode === 0xed) {
      // --- Block I/O and transfer
      const extOpCode = memContents[pc + 1];
      length = (extOpCode & 0xb4) === 0xb0 ? 2 : 0;
    }

    // --- Calculate start options
    let options: ExecuteCycleOptions;

    if (length > 0) {
      // --- Use step-over mode
      options = new ExecuteCycleOptions(
        EmulationMode.Debugger,
        DebugStepMode.StepOver
      );
      options.stepOverBreakpoint = pc + length;
    } else {
      // --- Use step-into mode
      options = new ExecuteCycleOptions(
        EmulationMode.Debugger,
        DebugStepMode.StepInto
      );
    }
    await this.run(options);
  }

  /**
   * Starts the virtual machine in step-out mode
   */
  async stepOut(): Promise<void> {
    await this.z80Machine.beforeStepOut();
    await this.run(
      new ExecuteCycleOptions(EmulationMode.Debugger, DebugStepMode.StepOut)
    );
  }

  /**
   * Cancels the execution cycle
   */
  async cancelRun(): Promise<void> {
    this._cancelled = true;
    await this._completionTask;
    this._completionTask = null;
  }

  /**
   * Executes the cycle of the Spectrum virtual machine
   * @param machine The virtual machine
   * @param options Execution options
   */
  async executeCycle(
    machine: VmEngine,
    options: ExecuteCycleOptions
  ): Promise<void> {
    const state = machine.z80Machine.getMachineState();
    // --- Store the start time of the frame
    //const clockFreq = state.baseClockFrequency * state.clockMultiplier;
    const nextFrameGap = (state.tactsInFrame / state.baseClockFrequency) * 1000;
    let nextFrameTime = performance.now() + nextFrameGap;

    // --- Execute the cycle until completed
    while (true) {
      // --- Prepare the execution cycle
      const frameStartTime = performance.now();

      // --- Now run the cycle
      machine.z80Machine.executeCycle(options);

      // --- Engine time information
      this._renderedFrames++;
      this._lastEngineTime = performance.now() - frameStartTime;
      this._sumEngineTime += this._lastEngineTime;
      this._avgEngineTime = this._sumEngineTime / this._renderedFrames;

      const resultState = (this._loadedState = machine.z80Machine.getMachineState());

      // --- Check for user cancellation
      if (this._cancelled) return;

      // --- Set data frequently queried
      rendererProcessStore.dispatch(
        emulatorSetFrameIdAction(this._startCount, resultState.frameCount)()
      );
      rendererProcessStore.dispatch(
        vmSetRegistersAction(this.getRegisterData(resultState))()
      );
      const memContents = this.z80Machine.getMemoryContents();
      rendererProcessStore.dispatch(
        emulatorSetMemoryContentsAction(memContents)()
      );

      // --- Get data
      await this.z80Machine.beforeEvalLoopCompletion(resultState);

      // --- Branch according the completion reason
      const reason = resultState.executionCompletionReason;
      if (reason !== ExecutionCompletionReason.UlaFrameCompleted) {
        // --- No more frame to execute
        if (
          reason === ExecutionCompletionReason.BreakpointReached ||
          reason === ExecutionCompletionReason.TerminationPointReached
        ) {
          machine.executionState = ExecutionState.Paused;
        }

        // --- Stop audio
        await this.z80Machine.onExecutionCycleCompleted(resultState);
        return;
      }

      // --- Handle key strokes
      this.emulateKeyStroke(resultState.frameCount);

      // --- Let the machine complete the frame
      await machine.z80Machine.onFrameCompleted(resultState);

      // --- Frame time information
      const curTime = performance.now();
      this._lastFrameTime = performance.now() - frameStartTime;
      this._sumFrameTime += this._lastFrameTime;
      this._avgFrameTime = this._sumFrameTime / this._renderedFrames;

      // --- Wait for the next screen frame
      const toWait = Math.floor(nextFrameTime - curTime);
      await delay(toWait - 2);
      nextFrameTime += nextFrameGap;
    }
  }

  /**
   * Emulates the next keystroke waiting in the queue
   * @param frame Current screen frame
   */
  emulateKeyStroke(frame: number): void {
    if (this._keyStrokeQueue.length === 0) return;
    const nextKey = this._keyStrokeQueue[0];
    if (nextKey.startFrame > frame) return;

    // --- Handle the active key in the queue
    if (nextKey.endFrame <= frame) {
      // --- Release the key
      this.setKeyStatus(nextKey.primaryKey, false);
      if (nextKey.secondaryKey !== undefined) {
        this.setKeyStatus(nextKey.secondaryKey, false);
      }
      this._keyStrokeQueue.shift();
      return;
    }

    // --- Press the key
    this.setKeyStatus(nextKey.primaryKey, true);
    if (nextKey.secondaryKey !== undefined) {
      this.setKeyStatus(nextKey.secondaryKey, true);
    }
  }

  /**
   * Gets the cursor mode of ZX Spectrum
   */
  getCursorMode(): number {
    return this.z80Machine.api.getCursorMode();
  }

  /**
   * Gets the length of the keyboard queue
   */
  getKeyQueueLength(): number {
    return this._keyStrokeQueue.length;
  }

  /**
   * Gets the current Z80 register values
   */
  getRegisterData(s: Z80MachineStateBase): RegisterData {
    return {
      af: s.af,
      bc: s.bc,
      de: s.de,
      hl: s.hl,
      af_: s._af_,
      bc_: s._bc_,
      de_: s._de_,
      hl_: s._hl_,
      pc: s.pc,
      sp: s.sp,
      ix: s.ix,
      iy: s.iy,
      i: s.i,
      r: s.r,
      wz: s.wz,
    };
  }

  /**
   * Gets information about frame times
   */
  getFrameTimes(): {
    lastEngineTime: number;
    avgEngineTime: number;
    lastFrameTime: number;
    avgFrameTime: number;
    renderedFrames: number;
  } {
    return {
      lastEngineTime: this._lastEngineTime,
      avgEngineTime: this._avgEngineTime,
      lastFrameTime: this._lastFrameTime,
      avgFrameTime: this._avgFrameTime,
      renderedFrames: this._renderedFrames,
    };
  }

  // ==========================================================================
  // Memory commands

  /**
   * Gets the specified ROM page
   * @param page Page index
   */
  getRomPage(page: number): Uint8Array {
    const state = this.z80Machine.getMachineState();
    if (!state.memoryPagingEnabled || page < 0 || page > state.numberOfRoms) {
      return new Uint8Array(0);
    }
    const mh = new MemoryHelper(
      this.z80Machine.api,
      this.z80Machine.getRomPageBaseAddress()
    );
    return new Uint8Array(mh.readBytes(page * 0x4000, 0x4000));
  }

  /**
   * Gets the specified BANK page
   * @param page Page index
   */
  getBankPage(page: number): Uint8Array {
    const state = this.z80Machine.getMachineState();
    if (!state.memoryPagingEnabled || page < 0 || page > state.ramBanks) {
      return new Uint8Array(0);
    }
    const mh = new MemoryHelper(this.z80Machine.api, BANK_0_OFFS);
    return new Uint8Array(mh.readBytes(page * 0x4000, 0x4000));
  }

  /**
   * Injects the specified code into the ZX Spectrum machine
   * @param codeToInject Code to inject into the machine
   */
  async injectCode(codeToInject: CodeToInject): Promise<string> {
    for (const segment of codeToInject.segments) {
      if (segment.bank !== undefined) {
        // TODO: Implement this
      } else {
        const addr = segment.startAddress;
        for (let i = 0; i < segment.emittedCode.length; i++) {
          this.z80Machine.writeMemory(addr + i, segment.emittedCode[i]);
        }
      }
    }

    // --- Prepare the run mode
    if (codeToInject.options.cursork) {
      // --- Set the keyboard in "L" mode
      this.z80Machine.writeMemory(
        0x5c3b,
        this.z80Machine.readMemory(0x5c3b) | 0x08
      );
    }
    return "";
  }

  /**
   * Injects the specified code into the ZX Spectrum machine and runs it
   * @param codeToInject Code to inject into the machine
   * @param debug Start in debug mode?
   */
  async runCode(codeToInject: CodeToInject, debug?: boolean): Promise<string> {
    // --- Stop the running machine
    await this.stop();

    // --- Start the machine and run it while it reaches the injection point
    let mainExec = await this.z80Machine.prepareForInjection(
      codeToInject.model
    );

    // --- Inject to code
    this.injectCode(codeToInject);

    // --- Set the continuation point
    const startPoint =
      codeToInject.entryAddress ?? codeToInject.segments[0].startAddress;
    this.z80Machine.api.setPC(startPoint);

    // --- Handle subroutine calls
    if (codeToInject.subroutine) {
      const spValue = this.z80Machine.getMachineState().sp;
      this.z80Machine.writeMemory(spValue - 1, mainExec >> 8);
      this.z80Machine.writeMemory(spValue - 2, mainExec & 0xff);
      this.z80Machine.api.setSP(spValue - 2);
    }

    // --- Clear the screen before run on ZX Spectrum 48
    if (!this.z80Machine.type || codeToInject.model === "48") {
      for (let i = 0x4000; i < 0x5800; i++) {
        this.z80Machine.writeMemory(i, 0x00);
      }
    }

    if (debug) {
      await this.startDebug();
    } else {
      await this.start();
    }

    return "";
  }

  /**
   * Waits for the current termination point
   */
  async waitForCycleTermination(): Promise<boolean> {
    await this._completionTask;
    this._completionTask = null;
    return true;
  }

  /**
   * Puts a keystroke into the queue of emulated keystrokes and delays it
   * @param primary Primary key
   * @param secodary Optional secondary key
   */
  async delayKey(
    primaryKey: VmKeyCode,
    secondaryKey?: VmKeyCode
  ): Promise<void> {
    this.queueKeyStroke(
      this.z80Machine.getMachineState().frameCount,
      3,
      primaryKey,
      secondaryKey
    );
    await new Promise((r) => setTimeout(r, 250));
  }
}

/**
 * Delay for the specified amount of milliseconds
 * @param milliseconds Amount of milliseconds to delay
 */
function delay(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (milliseconds < 0) {
      milliseconds = 0;
    }
    setTimeout(() => {
      resolve();
    }, milliseconds);
  });
}
