import { setMachineTypeAction } from "../../shared/state/machine-type-reducer";
import { StateAwareObject } from "../../shared/state/StateAwareObject";
import { ILiteEvent, LiteEvent } from "../../shared/utils/LiteEvent";
import { delay } from "../common/utils";
import { ZxSpectrum128Core } from "./spectrum/ZxSpectrum128Core";
import { ZxSpectrum48Core } from "./spectrum/ZxSpectrum48Core";
import { VirtualMachineCoreBase } from "./VirtualMachineCoreBase";
import {
  DebugStepMode,
  EmulationMode,
  ExecuteCycleOptions,
  ExecutionCompletionReason,
  MachineCreationOptions,
  MachineState,
} from "./vm-core-types";
import { emuStore } from "../emulator/emuStore";
import { IVmController } from "./IVmController";
import { EmulatedKeyStroke } from "./keyboard";
import {
  emuSetDebugModeAction,
  emuSetDiagDataAction,
  emuSetExecutionStateAction,
  emuSetFrameIdAction,
} from "../../shared/state/emulator-panel-reducer";
import { FrameDiagData } from "../../shared/state/AppState";
import { CambridgeZ88Core } from "./cz88/CambridgeZ88Core";
import { KliveConfiguration } from "../../main/klive-configuration";

/**
 * This class is responsible for controlling the singleton virtual machine
 */
class VmEngineService implements IVmController {
  private _vmEngine: VirtualMachineCoreBase | undefined;
  private _appConfig: KliveConfiguration | undefined;;
  private _error: string | null = null;
  private _stateAware: StateAwareObject<string>;
  private _vmEngineChanged = new LiteEvent<VirtualMachineCoreBase>();
  private _vmScreenRefreshed = new LiteEvent<void>();

  // --- The current execution state of the machine
  private _vmState: VmState = VmState.None;

  // --- Indicates if the machine has started from stopped state
  private _isFirstStart: boolean = false;

  // --- Indicates that this is the first pause of the machine
  private _isFirstPause: boolean = false;

  // --- Signs that the machine runs in debug mode
  private _isDebugging: boolean = false;

  // --- Signs that the exacution cycle has been cancelled
  private _cancelled: boolean = false;

  // --- Raise when the execution state of the machine has been changed
  private _executionStateChanged = new LiteEvent<VmStateChangedArgs>();

  // --- Raise when the UI message changed
  private _uiMessageChanged = new LiteEvent<string | null>();

  // --- Represents the task of the machine's execution cycle
  private _completionTask: Promise<void> | null = null;

  // --- Keyboard emulation
  private _keyStrokeQueue: EmulatedKeyStroke[] = [];

  // --- FrameID information
  private _startCount = 0;

  // --- Message to display on the UI
  private _uiMessage: string | null = null;

  // --- Time monitoring
  private _sumFrameTime = 0.0;
  private _lastFrameTime = 0.0;
  private _avgFrameTime = 0.0;
  private _sumEngineTime = 0.0;
  private _lastEngineTime = 0.0;
  private _avgEngineTime = 0.0;
  private _renderedFrames = 0;

  constructor() {
    this._stateAware = new StateAwareObject<string>(emuStore, "machineType");
    this._stateAware.stateChanged.on(() => {
      const state = this._stateAware.state;
    });
  }

  /**
   * Gets the current engine
   */
  getEngine(): VirtualMachineCoreBase {
    if (this._vmEngine) {
      return this._vmEngine;
    }
    throw new Error("The is now virtual machine engine set");
  }

  /**
   * Sets the engine to the specified one
   * @param controller The virtual machine controller instance
   * @param id Machine engine
   * @param options Options to create and configure the machine
   */
  async setEngine(id: string, options: MachineCreationOptions): Promise<void> {
    const engineEntry = engineRegistry[id];
    if (!engineEntry) {
      // TODO: issue error message
      return;
    }

    // --- Create the machine engine
    const engine = new (engineEntry as any)(options) as VirtualMachineCoreBase;
    engine.attachToController(this);
    await engine.setupMachine();
    this._vmEngine = engine;

    // --- Modify the app state
    emuStore.dispatch(setMachineTypeAction(id));
    emuStore.dispatch(
      emuSetDiagDataAction(this.getFrameDiagData(engine.getMachineState()))
    );

    // --- Allow a little delay for all processes to get synched
    await delay(20);
    this._vmEngineChanged.fire(this._vmEngine);
    return;
  }

  /**
   * Gets the app's configuration
   */
  getAppConfiguration(): KliveConfiguration | undefined {
    return this._appConfig;
  }

  /**
   * Sets the app's configuration
   * @param config Application configuration data
   */
  setAppConfiguration(config?: KliveConfiguration): void {
    this._appConfig = config;
  }

  /**
   * Indicates if the engine has already been created
   */
  get hasEngine(): boolean {
    return !!this._vmEngine;
  }

  /**
   * Gets the error message of the virtual machine engine
   */
  get vmEngineError(): string | null {
    return this._error;
  }

  /**
   * Indicates if the virtual machine engine has been changed
   */
  get vmEngineChanged(): ILiteEvent<VirtualMachineCoreBase> {
    return this._vmEngineChanged;
  }

  /**
   * Indicates that the virtual machine screen has been refreshed
   */
  get screenRefreshed(): ILiteEvent<void> {
    return this._vmScreenRefreshed;
  }

  /**
   * Indicates that the virtual machine has a new UI message
   */
  get uiMessageChanged(): ILiteEvent<string | null> {
    return this._uiMessageChanged;
  }

  /**
   * Indicates that the virtual machine execution state has changed
   */
  get executionStateChanged(): ILiteEvent<VmStateChangedArgs> {
    return this._executionStateChanged;
  }

  /**
   * The current state of the virtual machine
   */
  get executionState(): VmState {
    return this._vmState;
  }
  set executionState(newState: VmState) {
    const oldState = this._vmState;
    this._vmState = newState;

    // --- Notify the UI
    this._executionStateChanged.fire(
      new VmStateChangedArgs(oldState, newState, this._isDebugging)
    );

    // --- State the new execution state
    emuStore.dispatch(emuSetExecutionStateAction(this._vmState));
  }

  /**
   * Sets the machine's current audio rate
   * @param rate
   */
  setAudioSampleRate(rate: number): void {
    this._vmEngine.setAudioSampleRate(rate);
  }

  /**
   * Gets the screen pixels data to display
   */
  getScreenData(): Uint32Array {
    return this._vmEngine.getScreenData();
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
    primaryKey: number,
    secondaryKey?: number,
    ternaryKey?: number
  ): void {
    this._keyStrokeQueue.push({
      startFrame,
      endFrame: startFrame + frames,
      primaryKey,
      secondaryKey,
      ternaryKey,
    });
  }

  /**
   * Resets the CPU of the machine
   */
  resetCpu(): void {
    this._vmEngine.api.resetCpu(true);
  }

  /**
   * Starts the virtual machine and keeps it running
   * @param options Non-mandatory execution options
   */
  async start(options?: ExecuteCycleOptions): Promise<void> {
    await this.internalStart(options ?? new ExecuteCycleOptions());
  }

  /**
   * Starts the virtual machine in debugging mode
   */
  async startDebug(): Promise<void> {
    await this.internalStart(
      new ExecuteCycleOptions(
        EmulationMode.Debugger,
        DebugStepMode.StopAtBreakpoint
      )
    );
  }

  /**
   * Starts the virtual machine and keeps it running
   */
  private async internalStart(options: ExecuteCycleOptions): Promise<void> {
    const isDebug = options.debugStepMode !== DebugStepMode.None;
    await this._vmEngine.beforeStarted(isDebug);

    // --- Prepare the machine to run
    this._isFirstStart =
      this.executionState === VmState.None ||
      this.executionState === VmState.Stopped;

    if (this._isFirstStart) {
      await this._vmEngine.setupMachine();
      await this._vmEngine.beforeFirstStart();

      // --- Warm up to avoid sound delays
      this._completionTask = this.executeCycle(
        new ExecuteCycleOptions(
          EmulationMode.UntilFrameEnds,
          DebugStepMode.None
        )
      );
      delay(200);
      await this.cancelRun();
    }

    await this.internalRun(options);
    await this._vmEngine.afterStarted(isDebug);
  }

  /**
   * Starts the virtual machine with the specified exeution options
   * @param options Execution options
   */
  private async internalRun(options: ExecuteCycleOptions): Promise<void> {
    if (this.executionState === VmState.Running) {
      return;
    }

    this._startCount++;

    // --- Prepare the machine to run
    this._isFirstStart =
      this.executionState === VmState.None ||
      this.executionState === VmState.Stopped;

    // --- Prepare the current machine for first run
    if (this._isFirstStart) {
      // --- Prepare the breakpoints
      // TODO: Implement this call
      //this._vmEngine.setupBreakpoints(this._breakpoints);

      // --- Reset time information
      this._lastFrameTime = 0.0;
      this._avgFrameTime = 0.0;
      this._sumEngineTime = 0.0;
      this._lastEngineTime = 0.0;
      this._avgEngineTime = 0.0;
      this._sumFrameTime = 0.0;
      this._renderedFrames = 0;

      // --- Clear debug information
      // TODO: Implement this call
      //this._vmEngine.api.resetStepOverStack();
    } else {
      // --- Update existing breakpoints
      // TODO: Implement this call
      //this._vmEngine.updateBreakpoints(this._breakpoints);
    }

    // --- Initialize debug info before run
    // TODO: Implement this call
    // this.z80Machine.api.markStepOverStack();

    // --- Sign the current debug mode
    this._isDebugging = options.debugStepMode !== DebugStepMode.None;
    emuStore.dispatch(emuSetDebugModeAction(this._isDebugging));

    // --- Execute a single cycle
    this.executionState = VmState.Running;
    this._cancelled = false;
    this._completionTask = this.executeCycle(options);
  }

  /**
   * Pauses the running machine.
   */
  async pause(): Promise<void> {
    if (
      this.executionState === VmState.None ||
      this.executionState === VmState.Stopped ||
      this.executionState === VmState.Paused ||
      !this._completionTask
    ) {
      // --- Nothing to pause
      await this._vmEngine.onPaused(false);
      return;
    }

    // --- Prepare the machine to pause
    this.executionState = VmState.Pausing;
    this._isFirstPause = this._isFirstStart;
    await this.cancelRun();
    this.executionState = VmState.Paused;
    await this._vmEngine.onPaused(this._isFirstPause);
  }

  /**
   * Stops the virtual machine
   */
  async stop(): Promise<void> {
    // --- Stop only running machine
    switch (this._vmState) {
      case VmState.None:
      case VmState.Stopped:
        break;

      case VmState.Paused:
        // --- The machine is paused, it can be quicky stopped
        this.executionState = VmState.Stopping;
        this.executionState = VmState.Stopped;
        break;

      default:
        // --- Initiate stop
        this.executionState = VmState.Stopping;
        await this.cancelRun();
        this.executionState = VmState.Stopped;
        break;
    }
    await this._vmEngine.onStopped();
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
    await this._vmEngine.beforeStepInto();
    await this.start(
      new ExecuteCycleOptions(EmulationMode.Debugger, DebugStepMode.StepInto)
    );
  }

  /**
   * Starts the virtual machine in step-over mode
   */
  async stepOver(): Promise<void> {
    await this._vmEngine.beforeStepOver();

    // --- Calculate the location of the step-over breakpoint
    let nextAddress = this._vmEngine.getNextInstructionAddress();
    let options: ExecuteCycleOptions;
    if (nextAddress >= 0) {
      // --- Use step-over mode
      options = new ExecuteCycleOptions(
        EmulationMode.Debugger,
        DebugStepMode.StepOver
      );
      options.stepOverBreakpoint = nextAddress;
    } else {
      // --- Use step-into mode
      options = new ExecuteCycleOptions(
        EmulationMode.Debugger,
        DebugStepMode.StepInto
      );
    }
    await this.start(options);
  }

  /**
   * Starts the virtual machine in step-out mode
   */
  async stepOut(): Promise<void> {
    await this._vmEngine.beforeStepOut();
    await this.start(
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
  async executeCycle(options: ExecuteCycleOptions): Promise<void> {
    const engine = this._vmEngine;
    const state = engine.getMachineState();

    // --- Store the start time of the frame
    const nextFrameGap =
      (state.tactsInFrame / state.baseClockFrequency) *
      1000 *
      engine.engineLoops;
    let nextFrameTime = performance.now() + nextFrameGap;
    let toWait = 0;

    // --- Execute the cycle until completed
    while (true) {
      // --- Prepare the execution cycle
      const frameStartTime = performance.now();

      // --- Now run the cycle
      for (let i = 0; i < engine.engineLoops; i++) {
        engine.executeFrame(options);
        const resultState = engine.getMachineState();
        engine.onEngineCycleCompletion(resultState);
        if (
          resultState.executionCompletionReason !==
          ExecutionCompletionReason.FrameCompleted
        ) {
          break;
        }
      }

      // --- Engine time information
      this._renderedFrames++;
      this._lastEngineTime = performance.now() - frameStartTime;
      this._sumEngineTime += this._lastEngineTime;
      this._avgEngineTime = this._sumEngineTime / this._renderedFrames;

      const resultState = engine.getMachineState();

      // --- Save the internal state
      // TODO: Check if we need this
      // rendererProcessStore.dispatch(
      //   emulatorSetInternalStateAction(resultState)()
      // );

      // --- Check for user cancellation
      if (this._cancelled) {
        return;
      }

      // --- Set data frequently queried
      emuStore.dispatch(
        emuSetFrameIdAction(this._startCount, resultState.frameCount)
      );

      // TODO: Check if we need this
      // rendererProcessStore.dispatch(
      //   vmSetRegistersAction(this.getRegisterData(resultState))()
      // );

      // --- Get data
      await engine.beforeEvalLoopCompletion(resultState);

      // --- Branch according the completion reason
      const reason = resultState.executionCompletionReason;
      if (reason !== ExecutionCompletionReason.FrameCompleted) {
        // --- No more frame to execute
        if (
          reason === ExecutionCompletionReason.BreakpointReached ||
          reason === ExecutionCompletionReason.TerminationPointReached
        ) {
          this.executionState = VmState.Paused;
          engine.onPaused(this._isFirstPause);
        }

        // --- Complete the cycle
        await engine.onExecutionCycleCompleted(resultState);
        return;
      }

      // --- Handle key strokes
      this.emulateKeyStroke(resultState.frameCount);

      // --- Frame time information
      const curTime = performance.now();
      this._lastFrameTime = curTime - frameStartTime;
      this._sumFrameTime += this._lastFrameTime;
      this._avgFrameTime = this._sumFrameTime / this._renderedFrames;
      toWait = Math.floor(nextFrameTime - curTime);
      emuStore.dispatch(
        emuSetDiagDataAction(this.getFrameDiagData(resultState))
      );

      // --- Let the machine complete the frame
      await engine.onFrameCompleted(resultState, toWait);

      // --- Wait for the next screen frame
      if (this._appConfig?.diagnostics?.longFrameInfo && toWait < 2) {
        console.log(`Frame gap is too low: ${toWait}`);
      }
      await delay(toWait - 2);
      nextFrameTime += nextFrameGap;

      // --- Use the current clock multiplier
      const emuState = emuStore.getState().emulatorPanel;
      engine.setClockMultiplier(emuState.clockMultiplier ?? 1);
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
      this._vmEngine.setKeyStatus(nextKey.primaryKey, false);
      if (nextKey.secondaryKey !== undefined) {
        this._vmEngine.setKeyStatus(nextKey.secondaryKey, false);
      }
      this._keyStrokeQueue.shift();
      return;
    }

    // --- Press the key
    this._vmEngine.setKeyStatus(nextKey.primaryKey, true);
    if (nextKey.secondaryKey !== undefined) {
      this._vmEngine.setKeyStatus(nextKey.secondaryKey, true);
    }
  }

  /**
   * Gets the length of the keyboard queue
   */
  getKeyQueueLength(): number {
    return this._keyStrokeQueue.length;
  }

  /**
   * Signs that the screen has been refreshed
   */
  signScreenRefreshed(): void {
    this._vmScreenRefreshed.fire();
  }

  /**
   * Waits while the execution cycle terminates
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
   * @param ternaryKey Optional ternary key
   */
  async delayKey(
    primaryKey: number,
    secondaryKey?: number,
    ternaryKey?: number
  ): Promise<void> {
    this.queueKeyStroke(
      this._vmEngine.getMachineState().frameCount,
      3,
      primaryKey,
      secondaryKey,
      ternaryKey
    );
    await delay(250);
  }

  /**
   * Gets the current UI message
   */
  getUiMessage(): string | null {
    return this._uiMessage;
  }

  /**
   * Sets a UI message to display
   * @param message Message to display
   */
  setUiMessage(message: string | null): void {
    if (this._uiMessage !== message) {
      this._uiMessage = message;
      this._uiMessageChanged.fire(message);
    }
  }

  /**
   * Gets information about frame times
   */
  getFrameDiagData(state: MachineState): FrameDiagData {
    return {
      lastEngineTime: this._lastEngineTime,
      avgEngineTime: this._avgEngineTime,
      lastFrameTime: this._lastFrameTime,
      avgFrameTime: this._avgFrameTime,
      renderedFrames: this._renderedFrames,
      pcInfo: this._vmEngine.getProgramCounterInfo(state),
    };
  }
}

/**
 * This class represents the states of the virtual machine as
 * managed by the SpectrumVmController
 */
enum VmState {
  /**
   * The virtual machine has just been created, but has not run yet
   */
  None = 0,

  /**
   * The virtual machine is successfully started
   */
  Running = 1,

  /**
   * The virtual machine is being paused
   */
  Pausing = 2,

  /**
   * The virtual machine has been paused
   */
  Paused = 3,

  /**
   * The virtual machine is being stopped
   */
  Stopping = 4,

  /**
   * The virtual machine has been stopped
   */
  Stopped = 5,
}

/**
 * This class represents the arguments of the event that signs that
 * the state of the virtual machine changes
 */
export class VmStateChangedArgs {
  /**
   * Initializes the event arguments
   * @param oldState Old virtual machine state
   * @param newState New virtual machione state
   */
  constructor(
    public oldState: VmState,
    public newState: VmState,
    public isDebug: boolean
  ) {}
}

/**
 * The IVmEngineStore instance to use
 */
export const vmEngineService = new VmEngineService();

/**
 * Registry of virtual machine engines
 */
const engineRegistry: Record<string, any> = {
  sp48: ZxSpectrum48Core,
  sp128: ZxSpectrum128Core,
  cz88: CambridgeZ88Core,
};
