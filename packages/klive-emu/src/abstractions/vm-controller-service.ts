import { ILiteEvent } from "@shared/utils/LiteEvent";
import { VmStateChangedArgs } from "../renderer/machines/core/vm-engine-service";
import { KliveConfiguration } from "../main/main-state/klive-configuration";
import { VirtualMachineCoreBase } from "../renderer/machines/core/VirtualMachineCoreBase";
import {
  ExecuteCycleOptions,
  MachineCreationOptions,
  MachineState,
} from "../renderer/machines/core/vm-core-types";
import { FrameDiagData } from "@state/AppState";
import { CodeToInject } from "./code-runner-service";

/**
 * This class represents the states of the virtual machine as
 * managed by the SpectrumVmController
 */
export enum VmState {
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
 * Defines the services of a virtual machine controller.
 * The virtual machines can access this controller.
 */
export interface IVmEngineService {
  /**
   * Gets the current engine
   */
  getEngine(): VirtualMachineCoreBase;

  /**
   * Sets the engine to the specified one
   * @param controller The virtual machine controller instance
   * @param id Machine engine
   * @param options Options to create and configure the machine
   */
  setEngine(id: string, options: MachineCreationOptions): Promise<void>;

  /**
   * Gets the app's configuration
   */
  getAppConfiguration(): KliveConfiguration | undefined;

  /**
   * Sets the app's configuration
   * @param config Application configuration data
   */
  setAppConfiguration(config?: KliveConfiguration): void;

  /**
   * Indicates if the engine has already been created
   */
  get hasEngine(): boolean;

  /**
   * Gets the error message of the virtual machine engine
   */
  get vmEngineError(): string | null;

  /**
   * Indicates if the virtual machine engine has been changed
   */
  get vmEngineChanged(): ILiteEvent<VirtualMachineCoreBase>;

  /**
   * Indicates that the virtual machine screen has been refreshed
   */
  get screenRefreshed(): ILiteEvent<void>;

  /**
   * Indicates that the virtual machine has a new UI message
   */
  get uiMessageChanged(): ILiteEvent<string | null>;

  /**
   * Indicates that the virtual machine execution state has changed
   */
  get executionStateChanged(): ILiteEvent<VmStateChangedArgs>;

  /**
   * The current state of the virtual machine
   */
  executionState: VmState;

  /**
   * Sets the machine's current audio rate
   * @param rate
   */
  setAudioSampleRate(rate: number): void;

  /**
   * Gets the screen pixels data to display
   */
  getScreenData(): Uint32Array;

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
  ): void;

  /**
   * Resets the CPU of the machine
   */
  resetCpu(): void;

  /**
   * Starts the virtual machine and keeps it running
   * @param options Non-mandatory execution options
   */
  start(options?: ExecuteCycleOptions): Promise<void>;

  /**
   * Starts the virtual machine in debugging mode
   */
  startDebug(): Promise<void>;

  /**
   * Pauses the running machine.
   */
  pause(): Promise<void>;

  /**
   * Stops the virtual machine
   */
  stop(): Promise<void>;

  /**
   * Restarts the virtual machine
   */
  restart(): Promise<void>;

  /**
   * Starts the virtual machine in step-into mode
   */
  stepInto(): Promise<void>;

  /**
   * Starts the virtual machine in step-over mode
   */
  stepOver(): Promise<void>;

  /**
   * Starts the virtual machine in step-out mode
   */
  stepOut(): Promise<void>;

  /**
   * Cancels the execution cycle
   */
  cancelRun(): Promise<void>;

  /**
   * Injects and runs the specified code
   * @param codeToInject Code to inject into the virtual machine
   * @param debug Run in debug mode?
   */
  runCode(codeToInject: CodeToInject, debug: boolean): Promise<void>;

  /**
   * Executes the cycle of the Spectrum virtual machine
   * @param machine The virtual machine
   * @param options Execution options
   */
  executeCycle(options: ExecuteCycleOptions): Promise<void>;

  /**
   * Emulates the next keystroke waiting in the queue
   * @param frame Current screen frame
   */
  emulateKeyStroke(frame: number): void;

  /**
   * Gets the length of the keyboard queue
   */
  getKeyQueueLength(): number;

  /**
   * Signs that the screen has been refreshed
   */
  signScreenRefreshed(): void;

  /**
   * Waits while the execution cycle terminates
   */
  waitForCycleTermination(): Promise<boolean>;

  /**
   * Puts a keystroke into the queue of emulated keystrokes and delays it
   * @param primary Primary key
   * @param secodary Optional secondary key
   * @param ternaryKey Optional ternary key
   */
  delayKey(
    primaryKey: number,
    secondaryKey?: number,
    ternaryKey?: number
  ): Promise<void>;

  /**
   * Gets the current UI message
   */
  getUiMessage(): string | null;

  /**
   * Sets a UI message to display
   * @param message Message to display
   */
  setUiMessage(message: string | null): void;

  /**
   * Gets information about frame times
   */
  getFrameDiagData(state: MachineState): FrameDiagData;
}
