import * as path from "path";
import * as fs from "fs";
import { ZxSpectrumBase } from "../../native/api/ZxSpectrumBase";
import {
  ExecutionState,
  ExecutionStateChangedArgs,
} from "../../shared/spectrum/execution-state";
import { ILiteEvent, LiteEvent } from "../../shared/utils/LiteEvent";
import {
  ExecuteCycleOptions,
  ExecutionCompletionReason,
  SpectrumMachineState,
  EmulationMode,
  DebugStepMode,
  SpectrumMachineStateBase,
} from "../../native/api/machine-state";
import { SpectrumKeyCode } from "../../native/api/SpectrumKeyCode";
import { EmulatedKeyStroke } from "./spectrum-keys";
import { MemoryHelper } from "../../native/api/memory-helpers";
import { AudioRenderer } from "./AudioRenderer";
import {
  rendererProcessStore,
  createRendererProcessStateAware,
} from "../rendererProcessStore";
import {
  emulatorSetExecStateAction,
  emulatorSetTapeContenstAction,
  emulatorSetFrameIdAction,
  emulatorSetMemoryContentsAction,
  engineInitializedAction,
  emulatorSetDebugAction,
  emulatorSetMemWriteMapAction,
  emulatorLoadTapeAction,
} from "../../shared/state/redux-emulator-state";
import { BinaryReader } from "../../shared/utils/BinaryReader";
import { TzxReader } from "../../shared/tape/tzx-file";
import { TapReader } from "../../shared/tape/tap-file";
import { RegisterData } from "../../shared/spectrum/api-data";
import { vmSetRegistersAction } from "../../shared/state/redux-vminfo-state";
import {
  MEMWRITE_MAP,
  BEEPER_SAMPLE_BUFFER,
  PSG_SAMPLE_BUFFER,
  PSG_ENVELOP_TABLE,
} from "../../native/api/memory-map";

/**
 * This class represents the engine of the ZX Spectrum,
 * which runs within the main process.
 */
export class SpectrumEngine {
  private _vmState: ExecutionState = ExecutionState.None;
  private _isFirstStart: boolean = false;
  private _isFirstPause: boolean = false;
  private _isDebugging: boolean = false;
  private _executionCycleError: Error | undefined;
  private _cancelled: boolean = false;
  private _justRestoredState: boolean = false;

  private _executionStateChanged = new LiteEvent<ExecutionStateChangedArgs>();
  private _screenRefreshed = new LiteEvent<void>();
  private _vmStoppedWithError = new LiteEvent<void>();

  private _completionTask: Promise<void> | null = null;

  // --- The last loaded machine state
  private _loadedState: SpectrumMachineState;

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

  // --- State changes
  private _stateAware = createRendererProcessStateAware("breakpoints");
  private _oldBrpoints: number[] = [];

  /**
   * Initializes the engine with the specified ZX Spectrum instance
   * @param spectrum Spectrum VM to use
   */
  constructor(public spectrum: ZxSpectrumBase) {
    this._loadedState = spectrum.getMachineState();
    const memContents = this.spectrum.getMemoryContents();
    rendererProcessStore.dispatch(
      emulatorSetMemoryContentsAction(memContents)()
    );
    rendererProcessStore.dispatch(engineInitializedAction());
    this._stateAware.stateChanged.on((state) => {
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
        this.spectrum.api.eraseBreakpoints();
        for (const brpoint of Array.from(brpoints)) {
          this.spectrum.api.setBreakpoint(brpoint);
        }
      }
      this._oldBrpoints = brpoints;
    });
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
    this._executionStateChanged.fire(
      new ExecutionStateChangedArgs(oldState, newState, this._isDebugging)
    );
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
   * Exception that has been raised during the execution
   */
  get executionCycleError(): Error | undefined {
    return this._executionCycleError;
  }

  /**
   * Has the execution been cancelled?
   */
  get cancelled(): boolean {
    return this._cancelled;
  }

  /**
   * Indicates if machine state has just been restored.
   */
  get justRestoredState(): boolean {
    return this._justRestoredState;
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
   * This event is raised when the engine stops because of an exception
   */
  get stoppedWithError(): ILiteEvent<void> {
    return this._vmStoppedWithError.expose();
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
  getMachineState(): SpectrumMachineState {
    return this._loadedState;
  }

  /**
   * Sets the status of the specified ZX Spectrum key
   * @param key Code of the key
   * @param isDown Pressed/released status of the key
   */
  setKeyStatus(key: SpectrumKeyCode, isDown: boolean): void {
    this.spectrum.setKeyStatus(key, isDown);
  }

  /**
   * Sets the audio sample rate to use with sound devices
   * @param rate Audio sampe rate to use
   */
  setAudioSampleRate(rate: number): void {
    this.spectrum.setAudioSampleRate(rate);
  }

  /**
   * Gets the screen pixels data to display
   */
  getScreenData(): Uint32Array {
    return this.spectrum.getScreenData();
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
    primaryKey: SpectrumKeyCode,
    secondaryKey?: SpectrumKeyCode
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
      this.spectrum.turnOnMachine();

      // --- Get the current emulator state
      const state = rendererProcessStore.getState();
      const emuState = state.emulatorPanelState;

      // --- Set tape contents
      if (!emuState.tapeContents || emuState.tapeContents.length === 0) {
        let contents = new Uint8Array(0);
        try {
          contents = fs.readFileSync(
            path.join(__dirname, "./tapes/Pac-Man.tzx")
          );
        } catch (err) {}
        rendererProcessStore.dispatch(
          emulatorSetTapeContenstAction(contents)()
        );
        this._defaultTapeSet = contents;
      } else {
        this._defaultTapeSet = emuState.tapeContents;
      }

      const binaryReader = new BinaryReader(this._defaultTapeSet);
      this.initTape(binaryReader);

      // --- Set fast LOAD mode
      this.spectrum.api.setFastLoad(emuState.fastLoad);

      // --- Set breakpoints
      this.spectrum.api.eraseBreakpoints();
      for (const brpoint of Array.from(state.breakpoints)) {
        this.spectrum.api.setBreakpoint(brpoint);
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
      this.spectrum.api.resetStepOverStack();
    }

    // --- Initialize debug info before run
    this.spectrum.api.markStepOverStack();

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
      this.executionState === ExecutionState.Paused
    ) {
      // --- Nothing to pause
      return;
    }

    if (!this._completionTask) {
      // --- No completion to wait for
      return;
    }

    // --- Prepare the machine to pause
    this.executionState = ExecutionState.Pausing;
    this._isFirstPause = this._isFirstStart;
    await this.cancelRun();
    this.executionState = ExecutionState.Paused;
  }

  /**
   * Stops the virtual machine
   */
  async stop(): Promise<void> {
    // --- Stop only running machine
    switch (this._vmState) {
      case ExecutionState.None:
      case ExecutionState.Stopped:
        return;

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
  }

  /**
   * Restarts the virtual machine
   */
  async restart(): Promise<void> {
    await this.stop();
    this.start();
  }

  /**
   * Starts the virtual machine in step-into mode
   */
  async stepInto(): Promise<void> {
    await this.run(
      new ExecuteCycleOptions(EmulationMode.Debugger, DebugStepMode.StepInto)
    );
  }

  /**
   * Starts the virtual machine in step-over mode
   */
  async stepOver(): Promise<void> {
    // --- Calculate the location of the step-over breakpoint
    const memContents = this.spectrum.getMemoryContents();
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
    if (this._beeperRenderer) {
      this._beeperRenderer.closeAudio();
      this._beeperRenderer = null;
    }
    if (this._psgRenderer) {
      this._psgRenderer.closeAudio();
      this._psgRenderer = null;
    }
  }

  /**
   * Executes the cycle of the Spectrum virtual machine
   * @param machine The virtual machine
   * @param options Execution options
   */
  async executeCycle(
    machine: SpectrumEngine,
    options: ExecuteCycleOptions
  ): Promise<void> {
    const state = machine.spectrum.getMachineState();
    // --- Store the start time of the frame
    //const clockFreq = state.baseClockFrequency * state.clockMultiplier;
    const nextFrameGap = (state.tactsInFrame / state.baseClockFrequency) * 1000;
    let nextFrameTime = performance.now() + nextFrameGap;

    // --- Execute the cycle until completed
    while (true) {
      // --- Prepare the execution cycle
      const frameStartTime = performance.now();
      this.spectrum.api.eraseMemoryWriteMap();

      // --- Now run the cycle
      machine.spectrum.executeCycle(options);

      // --- Engine time information
      this._renderedFrames++;
      this._lastEngineTime = performance.now() - frameStartTime;
      this._sumEngineTime += this._lastEngineTime;
      this._avgEngineTime = this._sumEngineTime / this._renderedFrames;

      const resultState = (this._loadedState = machine.spectrum.getMachineState());

      // --- Check for user cancellation
      if (this._cancelled) return;

      const reason = resultState.executionCompletionReason;

      // --- Set data frequently queried
      rendererProcessStore.dispatch(
        emulatorSetFrameIdAction(this._startCount, resultState.frameCount)()
      );
      rendererProcessStore.dispatch(
        vmSetRegistersAction(this.getRegisterData(resultState))()
      );
      const memContents = this.spectrum.getMemoryContents();
      rendererProcessStore.dispatch(
        emulatorSetMemoryContentsAction(memContents)()
      );
      let mh = new MemoryHelper(this.spectrum.api, MEMWRITE_MAP);
      const memWriteMap = new Uint8Array(mh.readBytes(0, 0x2000));
      rendererProcessStore.dispatch(
        emulatorSetMemWriteMapAction(memWriteMap)()
      );

      // --- Branch according the completion reason
      if (reason !== ExecutionCompletionReason.UlaFrameCompleted) {
        // --- No more frame to execute
        if (
          reason === ExecutionCompletionReason.BreakpointReached ||
          reason === ExecutionCompletionReason.TerminationPointReached
        ) {
          machine.executionState = ExecutionState.Paused;
        }

        // --- Stop audio
        if (this._beeperRenderer) {
          this._beeperRenderer.closeAudio();
          this._beeperRenderer = null;
        }
        if (this._psgRenderer) {
          this._psgRenderer.closeAudio();
          this._psgRenderer = null;
        }
        return;
      }

      // --- Handle key strokes
      this.emulateKeyStroke(resultState.frameCount);

      // --- At this point we have not completed the execution yet
      // --- Initiate the refresh of the screen
      machine.spectrum.api.colorize();
      machine._screenRefreshed.fire();

      // --- Obtain beeper samples
      const emuState = rendererProcessStore.getState().emulatorPanelState;
      if (!this._beeperRenderer) {
        this._beeperRenderer = new AudioRenderer(resultState.audioSampleLength);
      }
      mh = new MemoryHelper(this.spectrum.api, BEEPER_SAMPLE_BUFFER);
      const beeperSamples = emuState.muted
        ? new Array(resultState.audioSampleCount).fill(0)
        : mh.readBytes(0, resultState.audioSampleCount).map((b) => b * 31);
      this._beeperRenderer.storeSamples(beeperSamples);

      // --- Obtain psg samples
      if (!this._psgRenderer) {
        this._psgRenderer = new AudioRenderer(resultState.audioSampleLength);
      }
      mh = new MemoryHelper(this.spectrum.api, PSG_SAMPLE_BUFFER);
      const psgSamples = emuState.muted
        ? new Array(resultState.audioSampleCount).fill(0)
        : mh.readBytes(0, resultState.audioSampleCount).map(b => b/3);
      this._psgRenderer.storeSamples(psgSamples);

      // --- Check if a tape should be loaded
      if (
        resultState.tapeMode === 0 &&
        !emuState.tapeLoaded &&
        emuState.tapeContents &&
        emuState.tapeContents.length > 0
      ) {
        // --- The tape is in passive mode, and we have a new one we can load, so let's load it
        this._defaultTapeSet = emuState.tapeContents;
        const binaryReader = new BinaryReader(this._defaultTapeSet);
        this.initTape(binaryReader);
        rendererProcessStore.dispatch(emulatorLoadTapeAction());
      }

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
    return this.spectrum.api.getCursorMode();
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
  getRegisterData(s: SpectrumMachineStateBase): RegisterData {
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

  /**
   * Initializes the tape from the specified binary reader
   * @param reader Reader to use
   */
  initTape(reader: BinaryReader): boolean {
    const tzxReader = new TzxReader(reader);
    if (tzxReader.readContents()) {
      const blocks = tzxReader.sendTapeFileToEngine(this.spectrum.api);
      this.spectrum.api.initTape(blocks);
      return true;
    }

    reader.seek(0);
    const tapReader = new TapReader(reader);
    if (tapReader.readContents()) {
      const blocks = tapReader.sendTapeFileToEngine(this.spectrum.api);
      this.spectrum.api.initTape(blocks);
      console.log(`${blocks} blocks sent to engine.`)
      return true;
    }
    return false;
  }

  /**
   * Colorize the currently rendered screen
   */
  colorize(): void {
    this.spectrum.api.colorize();
  }
}
