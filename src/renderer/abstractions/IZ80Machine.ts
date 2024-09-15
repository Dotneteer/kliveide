import type { KeyMapping } from "@abstractions/KeyMapping";
import type { ILiteEvent } from "@abstractions/ILiteEvent";

import type { ExecutionContext } from "@emu/abstractions/ExecutionContext";
import type { IZ80Cpu } from "@emu/abstractions/IZ80Cpu";
import type { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type { IMachineEventHandler } from "./IMachineEventHandler";
import type { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";
import type { MachineConfigSet } from "@common/machines/info-types";
import { CallStackInfo } from "@emu/abstractions/CallStack";

/**
 * This interface defines the behavior of a virtual machine that integrates the emulator from separate hardware
 * components, including the Z80 CPU, the memory, screen, keyboard, and many other devices.
 */
export interface IZ80Machine extends IZ80Cpu, IMachineEventHandler {
  /**
   * The unique identifier of the machine type
   */
  machineId: string;

  /**
   * Apply a soft reset on the first start?
   */
  readonly softResetOnFirstStart?: boolean;

  /**
   * The machine configuration
   */
  readonly config: MachineConfigSet;

  /**
   * The dynamic machine configuration (can be set after the machine is created)
   */
  dynamicConfig?: MachineConfigSet;

  /**
   * This property stores the execution context where the emulated machine runs its execution loop.
   */
  executionContext: ExecutionContext;

  /**
   * Sets up the machine (async)
   */
  setup(): Promise<void>;

  /**
   * Configures the machine after setting it up
   */
  configure(): Promise<void>;

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
   * The number of consequtive frames after which the UI should be refreshed
   */
  readonly uiFrameFrequency: number;

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

  /*
   * Gets the offset of the pixel buffer in the memory
   */
  getBufferStartOffset(): number;

  /**
   * Gets the key code set used for the machine
   */
  getKeyCodeSet(): KeyCodeSet;

  /**
   * Gets the default key mapping for the machine
   */
  getDefaultKeyMapping(): KeyMapping;

  /**
   * Set the status of the specified ZX Spectrum key.
   * @param key Key code
   * @param isDown Indicates if the key is pressed down
   */
  setKeyStatus(key: number, isDown: boolean): void;

  /**
   * Emulates queued keystrokes as if those were pressed by the user
   */
  emulateKeystroke(): void;

  /**
   * Adds an emulated keypress to the queue of the provider.
   * @param frameOffset Number of frames to start the keypress emulation
   * @param frames Number of frames to hold the emulation
   * @param primary Primary key code
   * @param secondary Optional secondary key code
   *
   * The keyboard provider can play back emulated key strokes
   */
  queueKeystroke(
    frameOffset: number,
    frames: number,
    primary: number,
    secondary?: number,
    ternary?: number
  ): void;

  /**
   * Gets the length of the key emulation queue
   */
  getKeyQueueLength(): number;

  /**
   * Gets the main execution point information of the machine
   * @param model Machine model to use for code execution
   */
  getCodeInjectionFlow(model: string): CodeInjectionFlow;

  /**
   * Injects the specified code into the ZX Spectrum machine
   * @param codeToInject Code to inject into the machine
   */
  injectCodeToRun(codeToInject: CodeToInject): number;

  /**
   * Gets the partition in which the specified address is paged in
   * @param address Address to get the partition for
   */
  getPartition(address: number): number | undefined;

  /**
   * Parses a partition label to get the partition number
   * @param label Label to parse
   */
  parsePartitionLabel(label: string): number | undefined;

  /**
   * Gets the label of the specified partition
   * @param partition Partition index
   */
  getPartitionLabels(): Record<number, string>;

  /**
   * Gets the current call stack information
   */
  getCallStack(frames?: number): CallStackInfo;

  /**
   * Executes the specified custom command
   * @param command Command to execute
   */
  executeCustomCommand(command: string): Promise<void>;

  /**
   * Get the 64K of addressable memory of the computer
   * @returns Bytes of the flat memory
   */
  get64KFlatMemory(): Uint8Array;

  /**
   * Get the specified 16K partition (page or bank) of the computer
   * @param index Partition index
   * @returns Bytes of the partition
   */
  get16KPartition(index: number): Uint8Array;

  /**
   * Gets the current partition values for all 16K/8K partitions
   */
  getCurrentPartitions(): number[];

  /**
   * Gets the current partition labels for all 16K/8K partitions
   */
  getCurrentPartitionLabels(): string[];

  /**
   * Indicates if the machine's operating system is initialized
   */
  get isOsInitialized(): boolean;
}
