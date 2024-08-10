import { IOutputBuffer } from "@appIde/ToolArea/abstractions";
import { CodeToInject } from "@abstractions/CodeToInject";
import { FrameStats } from "@renderer/abstractions/FrameStats";
import { IDebugSupport } from "@renderer/abstractions/IDebugSupport";
import { IZ80Machine } from "@renderer/abstractions/IZ80Machine";
import { ILiteEvent } from "@emu/utils/lite-event";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { SavedFileInfo } from "@emu/abstractions/ITapeDevice";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";

/**
 * This class implements a machine controller that can operate an emulated machine invoking its execution loop.
 */
export interface IMachineController {
  /**
   * Tha application state store
   */
  readonly store: Store<AppState>;

  /**
   * The messenger to send messages to the main process
   */
  readonly messenger: MessengerBase;

  /**
   * The machine controlled by this object
   */
  readonly machine: IZ80Machine;

  /**
   * Disposes resources held by this class
   */
  dispose(): void;

  /**
   * The output buffer to write messages to
   */
  output?: IOutputBuffer;

  /**
   * Gets or sets the object providing debug support
   */
  debugSupport?: IDebugSupport;

  /**
   * Get or set the current state of the machine controller.
   */
  readonly state: MachineControllerState;

  /**
   * Represents the frame statistics of the last running frame
   */
  frameStats: FrameStats;

  /**
   * Indicates if the machine runs in debug mode
   */
  isDebugging: boolean;

  /**
   * This event fires when the state of the controller changes.
   */
  stateChanged: ILiteEvent<{
    oldState: MachineControllerState;
    newState: MachineControllerState;
  }>;

  /**
   * This event fires whenever an execution loop has been completed. The event parameter flag indicates if the
   * frame has been completed entirely (normal termination mode)
   */
  frameCompleted: ILiteEvent<FrameCompletedArgs>;

  /**
   * Start the machine in normal mode.
   */
  start(): Promise<void>;

  /**
   * Start the machine in debug mode.
   */
  startDebug(): Promise<void>;

  /**
   * Pause the running machine.
   */
  pause(): Promise<void>;

  /**
   * Stop the running or paused machine.
   */
  stop(): Promise<void>;

  /**
   * Reset the CPU of the machine.
   */
  cpuReset(): Promise<void>;

  /**
   * Stop and then start the machine again.
   */
  restart(): Promise<void>;

  /**
   * Starts the machine in step-into mode.
   */
  stepInto(): Promise<void>;

  /**
   * Starts the machine in step-over mode.
   */
  stepOver(): Promise<void>;

  /**
   * Starts the machine in step-out mode.
   */
  stepOut(): Promise<void>;

  /**
   * Executes a custom command
   * @param command Custom command string
   */
  customCommand(command: string): Promise<void>;

  /**
   * Runs the specified code in the virtual machine
   * @param codeToInject Code to inject into the amchine
   * @param debug Run in debug mode?
   */
  runCode(codeToInject: CodeToInject, debug?: boolean): Promise<void>;

  /**
   * Resolves the source code breakpoints used when running the machine
   * @param bps
   */
  resolveBreakpoints(bps: ResolvedBreakpoint[]): void;

  /**
   * Scrolls down breakpoints
   * @param def Breakpoint address
   * @param lineNo Line number to shift down
   */
  scrollBreakpoints(def: BreakpointInfo, shift: number): void;

  /**
   * Normalizes source code breakpoint. Removes the ones that overflow the
   * file and also deletes duplicates.
   * @param lineCount
   * @returns
   */
  normalizeBreakpoints(resource: string, lineCount: number): void;
}

export type FrameCompletedArgs = {
  fullFrame: boolean;
  savedFileInfo?: SavedFileInfo;
  diskAChanges?: SectorChanges;
  diskBChanges?: SectorChanges;
};
