import { ExecutionContext } from "./ExecutionContext";
import { IZ80Cpu } from "./IZ80Cpu";
import { ILiteEvent } from "../utils/lite-event";
import { SpectrumKeyCode } from "./SpectrumKeyCode";
import { FrameTerminationMode } from "./FrameTerminationMode";
import { CodeToInject } from "@/appIde/abstractions/code-related";

/**
 * This interface defines the behavior of a virtual machine that integrates the emulator from separate hardware
 * components, including the Z80 CPU, the memory, screen, keyboard, and many other devices.
 */
export interface IZ80Machine extends IZ80Cpu {
  /**
   * The unique identifier of the machine type
   */
  machineId: string;

  /**
   * This property stores the execution context where the emulated machine runs its execution loop.
   */
  executionContext: ExecutionContext;

  /**
   * Sets up the machine (async)
   */
  setup(): Promise<void>;

  /**
   * Dispose the resources held by the machine
   */
  dispose(): void;

  /**
   * Gets the value of the machine property with the specified key
   * @param key Machine property key
   * @returns Value of the property, if found; otherwise, undefined
   */
  getMachineProperty(key: string): any;

  /**
   * Sets the value of the specified machine property
   * @param key Machine property key
   * @param value Machine property value
   */
  setMachineProperty(key: string, value?: any): void;

  /**
   * This event fires when the state of a machine property changes.
   */
  machinePropertyChanged?: ILiteEvent<{ propertyName: string; newValue?: any }>;

  /**
   * Get the duration of a machine frame in milliseconds.
   */
  frameTimeInMs: number;

  /**
   * This property gets or sets the value of the target clock multiplier to set when the next machine frame starts.
   *
   * By default, the CPU works with its regular (base) clock frequency; however, you can use an integer clock
   * frequency multiplier to emulate a faster CPU.
   */
  targetClockMultiplier: number;

  /**
   * Executes the machine frame using the current execution context.
   * @returns The value indicates the termination reason of the loop.
   */
  executeMachineFrame(): FrameTerminationMode;

  /**
   * Cleans up machine resources on stop
   */
  onStop(): void;

  /**
   * Width of the screen in native machine screen pixels
   */
  get screenWidthInPixels(): number;

  /**
   * Height of the screen in native machine screen pixels
   */
  get screenHeightInPixels(): number;

  /**
   * Gets the buffer that stores the rendered pixels
   */
  getPixelBuffer(): Uint32Array;

  /**
   * Set the status of the specified ZX Spectrum key.
   * @param key Key code
   * @param isDown Indicates if the key is pressed down
   */
  setKeyStatus(key: SpectrumKeyCode, isDown: boolean): void;

  /**
   * Emulates queued keystrokes as if those were pressed by the user
   */
  emulateKeystroke(): void;

  /**
   * Adds an emulated keypress to the queue of the provider.
   * @param startFrame Frame count to start the emulation
   * @param frames Number of frames to hold the emulation
   * @param primary Primary key code
   * @param secondary Optional secondary key code
   *
   * The keyboard provider can play back emulated key strokes
   */
  queueKeystroke(
    startFrame: number,
    frames: number,
    primary: SpectrumKeyCode,
    secondary?: SpectrumKeyCode
  ): void;

  /**
   * Gets the length of the key emulation queue
   */
  getKeyQueueLength(): number;

  /**
   * Gets the main execution point information of the machine
   * @param model Machine model to use for code execution
   */
  getMainExecPoint(model: string): MainExecPointInfo;

  /**
   * Injects the specified code into the ZX Spectrum machine
   * @param codeToInject Code to inject into the machine
   */
  injectCodeToRun(codeToInject: CodeToInject): number;
}

/**
 * Describes the main execution cycle point of the machine
 */
export type MainExecPointInfo = {
  romIndex?: number;
  entryPoint: number;
}