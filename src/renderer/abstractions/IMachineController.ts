import type { Timeline, TimelineSnapshot } from "@emu/machines/reverse/Timeline";
import type { TimelinePosition } from "@emu/machines/reverse/timelinePosition";
import type { ILiteEvent } from "@abstractions/ILiteEvent";
import type { IOutputBuffer, OutputColor } from "@appIde/ToolArea/abstractions";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { FrameStats } from "@renderer/abstractions/FrameStats";
import type { IDebugSupport } from "@renderer/abstractions/IDebugSupport";
import type { MachineControllerState } from "@abstractions/MachineControllerState";
import type { MessengerBase } from "@messaging/MessengerBase";
import type { AppState } from "@state/AppState";
import type { Store } from "@state/redux-light";
import type { SavedFileInfo } from "@emu/abstractions/ITapeDevice";
import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import type { SourceActivationInfo, SourceStopInfo } from "@abstractions/SourceDebugInfo";
import type { SourceStepKind } from "@emu/machines/SourceStepDecision";
import type { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import type { IRzxSession, RzxStop } from "@emu/machines/zxSpectrum/rzx/rzxSession";
import type { RzxState } from "@state/AppState";
import { IAnyMachine } from "./IAnyMachine";
import type { HistoryCursor } from "@emu/machines/history/HistoryCursor";
import type { ProfileStatus } from "@common/profile/profileTypes";
import type {
  HistoryNavigationOp,
  HistoryNavigationOptions,
  HistoryNavigationResult
} from "@common/history/historyNavigation";

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
  readonly machine: IAnyMachine;

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
   * Optional async hook called just before the inter-frame delay inside the
   * machine run loop. Use this to send display data to the main process while
   * the CPU is idle, rather than during the frame-completed event handler.
   */
  beforeFrameDelay?: () => Promise<void>;

  // --- RZX sessions (`.plans/RZX_PLAN.md` §4.4)

  /** Skip the frame delay (render to video, D18) */
  unthrottled: boolean;

  /** Awaited before each frame when it returns a promise (render to video waits for the recorder) */
  frameGate?: () => Promise<void> | undefined;

  /** Fires when an RZX session stops */
  readonly rzxStopped: ILiteEvent<RzxStop>;

  /** The machine's RZX session, active or a stopped recording not yet saved */
  readonly rzxSession?: IRzxSession;

  /** Attaches an RZX session to the machine */
  attachRzxSession(session: IRzxSession, info: { mode: RzxState["mode"]; file?: string }): void;

  /** Detaches the machine's RZX session */
  detachRzxSession(stopMessage?: string): void;

  /** Ends an active RZX session because the IDE changed the machine from outside the CPU (trap 4) */
  interruptRzx(reason: string): Promise<void>;

  /** Ends the reverse-debugging timeline (`.plans/REVERSE_DEBUGGING_PLAN.md` D2): code injection does */
  endTimeline?(): void;

  /** The reverse-debugging timeline of the current debug session, if the machine keeps one */
  readonly timeline?: Timeline;

  /**
   * Opens a saved timeline - a debug recording (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` §4.4): the
   * machine takes the present's state, the timeline is rebuilt around it, and the machine stands
   * paused in a debug session at `land` (the present when omitted)
   */
  openTimeline?(
    applyState: () => void,
    snapshot: TimelineSnapshot,
    options?: { land?: TimelinePosition; description?: string; expectedImage?: Uint8Array; recordingName?: string }
  ): Promise<void>;

  /** Publishes the RZX session's progress to the store */
  publishRzxState(): void;

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
   * Starts the machine in step-into mode (a statement step while source stepping is in use).
   */
  stepInto(): Promise<void>;

  /** Source stepping (true) or Z80 stepping (false) for a program with source-level debug info. */
  sourceStepping: boolean;

  /** Source steps stop inside interrupt handlers too (plan §10.2.7): the global setting. */
  readonly stopInInterrupts: boolean;

  /** The injected program's source-level debug info (plan §10.2); undefined for none. */
  setSourceDebugInfo(info?: SourceLevelDebugInfo): void;

  /** A source-level step (`SourceStepDecision.ts`). */
  sourceStep(kind: SourceStepKind, options?: { targetFrame?: number; targetCallable?: number }): Promise<void>;

  /** Where the paused program stands at source level. */
  getSourceStopInfo(): SourceStopInfo | undefined;

  /** The symbolic call stack, innermost first. */
  getSourceCallStack(): SourceActivationInfo[] | undefined;

  /**
   * The history cursor (`.plans/LITE_STEP_BACK_PLAN.md` D1): the paused machine looked at in its
   * recorded past. Optional so test doubles need not provide it.
   */
  readonly historyCursor?: HistoryCursor;

  /** Moves the history cursor (D4); the machine is not touched */
  navigateHistory?(op: HistoryNavigationOp, options?: HistoryNavigationOptions): HistoryNavigationResult;

  /** Take over here (`.plans/REVERSE_DEBUGGING_PLAN.md` D12); false when the machine is not in the past */
  takeOverHere?(): Promise<boolean>;

  /** What Take over here would leave behind (`.plans/REVERSE_DEBUGGING_PLAN.md` T4) */
  forkPreview?(): { sdWrites: number; hostFiles: string[] } | undefined;

  /** Reverse Continue with progress and cancel (D15) */
  reverseContinue?(): Promise<HistoryNavigationResult>;

  /** Stops a running Reverse Continue search */
  cancelReverseContinue?(): boolean;

  /** Returns to the present (D5) */
  clearHistoryCursor?(): void;

  /**
   * The access profile (`.plans/CODE_COVERAGE_AND_HEAT_MAP_PLAN.md` §4.2): its status, undefined
   * when the machine does not profile. Optional so test doubles need not provide them.
   */
  getProfileStatus?(): ProfileStatus | undefined;
  /** Turns profiling on or off for the session (D6); false when the machine does not profile */
  setProfiling?(enabled: boolean, counters?: boolean): boolean;
  /** Clears the profile */
  resetProfile?(): void;

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
   * @param additionalInfo Additional information for code execution
   * @param debug Run in debug mode?
   * @param projectDebug Run in project debug mode?
   */
  runCode(
    codeToInject: CodeToInject,
    additionalInfo: any,
    debug: boolean,
    projectDebug: boolean
  ): Promise<void>;

  /**
   * Resets the machine and starts the tape in its deck loading (`LOAD ""`, or the Tape Loader)
   * @param debug Arm the breakpoints once the keystrokes are typed
   */
  runTapeLoad(debug: boolean): Promise<void>;
  runDiskBoot(debug: boolean): Promise<void>;

  /**
   * Replaces the machine's state and leaves it Paused, so the next Start, Debug or step continues
   * from that state instead of resetting the machine (a start from Stopped resets it). The machine
   * is stopped first; `applyState` runs on the stopped machine.
   * @param applyState Writes the new state into the machine
   * @param description What was restored, for the emulator output
   * @param options `attachMedia: false` keeps the media the state put into the machine, instead of
   * attaching the stored media afterwards (Klive state files)
   */
  restoreState(
    applyState: () => void,
    description: string,
    options?: { attachMedia?: boolean; keepRzxSession?: boolean }
  ): Promise<void>;

  /** Writes a line to the emulator's output */
  sendOutput(text: string, foreground: OutputColor): Promise<void>;

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
  clockMultiplier?: number;
};
