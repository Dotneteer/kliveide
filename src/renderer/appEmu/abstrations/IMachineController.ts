import { IOutputBuffer } from "@/renderer/appIde/ToolArea/abstractions";
import { CodeToInject } from "@/renderer/appIde/abstractions/code-related";
import { FrameStats } from "@/renderer/abstractions/FrameStats";
import { IDebugSupport } from "@/renderer/abstractions/IDebugSupport";
import { IZ80Machine } from "@/renderer/abstractions/IZ80Machine";
import { ILiteEvent } from "@/emu/utils/lite-event";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@/common/messaging/MessengerBase";
import { AppState } from "@/common/state/AppState";
import { Store } from "@/common/state/redux-light";

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

  /// <summary>
  /// Get or set the current state of the machine controller.
  /// </summary>
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
  frameCompleted: ILiteEvent<boolean>;

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

  /// <summary>
  /// Stop the running or paused machine.
  /// </summary>
  stop(): Promise<void>;

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
   * Runs the specified code in the virtual machine
   * @param codeToInject Code to inject into the amchine
   * @param debug Run in debug mode?
   */
  runCode (codeToInject: CodeToInject, debug?: boolean): Promise<void>;
}
