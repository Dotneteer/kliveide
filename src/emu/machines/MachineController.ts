import type {
  FrameCompletedArgs,
  IMachineController
} from "@renderer/abstractions/IMachineController";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import type {
  IOutputBuffer,
  OutputColor,
  OutputSpecification
} from "@renderer/appIde/ToolArea/abstractions";
import type { ExecutionContext } from "@emu/abstractions/ExecutionContext";
import type { FrameStats } from "@renderer/abstractions/FrameStats";
import type { IDebugSupport } from "@renderer/abstractions/IDebugSupport";
import type { AppState } from "@state/AppState";
import type { Store } from "@state/redux-light";
import type { SavedFileInfo } from "@emu/abstractions/ITapeDevice";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import type { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import type { MachineInfo } from "@common/machines/info-types";
import type { CopperHitEvent, NextRegWriteEvent } from "@common/messaging/EmuApi";
import {
  decodeCopperWord,
  formatCopperIndex,
  formatCopperInstruction
} from "@common/zxnext/copper/copperDecoder";
import type { IFloppyControllerDevice } from "@emu/abstractions/IFloppyControllerDevice";
import type { IRzxSession, RzxStop } from "@emu/machines/zxSpectrum/rzx/rzxSession";
import type { ReverseDebugState, RzxState } from "@state/AppState";

import { toHexa4 } from "@appIde/services/ide-commands";
import { NEXT_REG_DESCRIPTORS } from "@emu/machines/zxNext/nextRegDescriptors";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { LiteEvent } from "@emu/utils/lite-event";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import {
  setDebuggingAction,
  setRzxStateAction,
  incBreakpointHitsVersionAction,
  setMachineStateAction,
  setProjectDebuggingAction,
  setHistoryPositionAction,
  setReverseDebugStateAction
} from "@state/actions";
import { HistoryCursor } from "./history/HistoryCursor";
import type { HistoryRecord } from "@common/history/historyRecord";
import type { HistoryNavigationOp, HistoryNavigationOptions, HistoryNavigationResult } from "@common/history/historyNavigation";
import { evaluateHistoryCondition } from "@common/history/historyCondition";
import {
  DISK_A_CHANGES,
  DISK_A_WP,
  DISK_B_CHANGES,
  DISK_B_WP,
  FAST_LOAD,
  SAVED_TO_TAPE
} from "./machine-props";
import { MEDIA_DISK_A, MEDIA_DISK_B } from "@common/structs/project-const";
import { delay } from "@renderer/utils/timing";
import { machineRegistry } from "@common/machines/machine-registry";
import { mediaStore } from "./media/media-info";
import { PANE_ID_EMU } from "@common/integration/constants";
import { logLineOutput } from "./logOutput";
import { createIdeApi } from "@common/messaging/IdeApi";
import {
  isExecutionHistorySource,
  type IExecutionHistorySource
} from "@emu/abstractions/IExecutionHistorySource";
import {
  SETTING_EMU_FAST_LOAD,
  SETTING_EMU_REVERSE_DEBUG_MEMORY_MB,
  SETTING_EMU_REVERSE_DEBUGGING,
  SETTING_EMU_JUST_MY_CODE,
  SETTING_EMU_STEP_IN_INTERRUPTS,
  SETTING_EMU_STOP_ON_ERRORS
} from "@common/settings/setting-const";
import { getGlobalSetting } from "@renderer/core/RendererProvider";
import { MF_REVERSE_DEBUG } from "@common/machines/constants";
import {
  Timeline,
  type ForkAwareMachine,
  type ForkPreview,
  type ForkResult,
  type TimelineDebugSupport,
  type TimelineMachine
} from "./reverse/Timeline";
import { ReplayStateProvider } from "./reverse/ReplayStateProvider";
import { comparePositions, type TimelinePosition } from "./reverse/timelinePosition";
import { reverseDebugBudgetBytes } from "./reverse/KeyframeStore";
import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";
import type { SourceLevelDebugInfo } from "@abstractions/CompilerInfo";
import type { SourceActivationInfo, SourceStopInfo } from "@abstractions/SourceDebugInfo";
import {
  basicErrorReport,
  beginSourceStep,
  canStepOut,
  CurrentStatementTracker,
  innermostUserStatement,
  locateActivations,
  SourceDebugIndex,
  type MachineView,
  type SourceStepKind
} from "./SourceStepDecision";

/** How often to check whether an injection flow's keystrokes have landed. */
const KEYSTROKE_SUPPRESSION_POLL_MS = 50;

/**
 * How long breakpoint suppression may last at the outside.
 *
 * A backstop, not a timing assumption: the queue normally drains in a few frames and the poll ends
 * the window then. This only matters if a machine somehow never drains it, and it bounds how long
 * the user's breakpoints can stay ignored.
 */
const KEYSTROKE_SUPPRESSION_TIMEOUT_MS = 10_000;

class MachineOperationCanceledError extends Error {
  constructor() {
    super("Project startup canceled.");
  }
}

/**
 * Maps a write-protectable medium to the machine property that carries its write-protection flag.
 */
const DISK_WRITE_PROTECTION_PROPS: Record<string, string> = {
  [MEDIA_DISK_A]: DISK_A_WP,
  [MEDIA_DISK_B]: DISK_B_WP
};

/**
 * Attaches every stored medium the machine supports to that machine.
 *
 * Media outlive machines: the media store is the durable record, and a freshly created machine
 * starts with no media and no machine properties at all. This re-attaches both the contents and
 * the write-protection flag, so inserting a disk and then switching machine type does not quietly
 * drop the disk or remount it as writable.
 *
 * Write protection is applied BEFORE the contents on purpose: the consumers of the media property
 * (the floppy controller and the +3E WASM machine) read the write-protection flag at the moment
 * the contents are attached, so applying it afterwards would leave the drive writable.
 * @param machine The machine to attach the stored media to
 * @param mediaIds The media the machine supports
 */
export function attachStoredMedia(machine: IAnyMachine, mediaIds?: string[]): void {
  mediaIds?.forEach((mediaId) => {
    const mediaInfo = mediaStore.getMedia(mediaId);
    if (!mediaInfo) return;

    const wpPropName = DISK_WRITE_PROTECTION_PROPS[mediaId];
    if (wpPropName && mediaInfo.writeProtected !== undefined) {
      machine.setMachineProperty(wpPropName, mediaInfo.writeProtected);
    }

    if (mediaInfo.mediaContents) {
      machine.setMachineProperty(mediaId, mediaInfo.mediaContents);
    }
  });
}

/**
 * This class implements a machine controller that can operate an emulated machine invoking its execution loop.
 */
/** The ROM's error restart (RST 8): the code byte follows the RST instruction. */
const ROM_ERROR_RESTART = 0x0008;

export class MachineController implements IMachineController {
  private _cancelRequested: boolean;
  private _machineTask: Promise<void>;
  private _machineState: MachineControllerState;
  private _loggedEventNo = 0;
  private readonly _machineInfo: MachineInfo;
  private _operationRevision = 0;

  /**
   * Initializes the controller to manage the specified machine.
   * @param machine The machine to manage
   */
  constructor(
    public readonly store: Store<AppState>,
    public readonly messenger: MessengerBase,
    public readonly machine: IAnyMachine
  ) {
    this.context = machine.executionContext;
    if (this.context) this.context.isReplayingHistory = () => this.suppressingSideEffects;
    this.isDebugging = false;
    this.frameStats = {
      frameCount: 0,
      lastFrameTimeInMs: 0,
      lastCpuFrameTimeInMs: 0,
      avgFrameTimeInMs: 0,
      avgCpuFrameTimeInMs: 0
    };
    this.state = MachineControllerState.None;

    // --- Get machine information
    this._machineInfo = machineRegistry.find(
      (m) => m.machineId === machine.machineId
    ) as MachineInfo;
  }

  /**
   * Disposes resources held by this class
   */
  dispose(): void {
    this.endTimeline();
    this.stateChanged?.release();
    this.frameCompleted?.release();
    this.rzxStopped?.release();
  }

  /**
   * The output buffer to write messages to
   */
  output?: IOutputBuffer;

  /**
   * Gets or sets the object providing debug support
   */
  debugSupport?: IDebugSupport;

  /**
   * The execution context of the controlled machine
   */
  private context: ExecutionContext;

  /// <summary>
  /// Get or set the current state of the machine controller.
  /// </summary>
  get state(): MachineControllerState {
    return this._machineState;
  }
  set state(value: MachineControllerState) {
    if (this._machineState === value) return;

    const oldState = this._machineState;
    this._machineState = value;
    // --- Only a paused machine is looked at in the past (D1)
    if (value !== MachineControllerState.Paused) this._historyCursor?.clear();
    // --- A replay run toward the present that stops short leaves the machine in the past: the cursor
    // --- shows where (REVERSE_DEBUGGING_PLAN D11)
    else this.settleReplayRun();
    this.store.dispatch(setMachineStateAction(value, this.machine.pc), "emu");
    this.publishReverseState();
    this.stateChanged.fire({ oldState, newState: this._machineState });
  }

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
  stateChanged = new LiteEvent<{
    oldState: MachineControllerState;
    newState: MachineControllerState;
  }>();

  /**
   * This event fires whenever an execution loop has been completed. The event parameter flag indicates if the
   * frame has been completed entirely (normal termination mode)
   */
  frameCompleted = new LiteEvent<FrameCompletedArgs>();

  /**
   * Optional async hook called just before the inter-frame delay inside the
   * machine run loop. Assign this in EmulatorPanel to forward display data
   * to the recording backend while the CPU is idle.
   */
  beforeFrameDelay?: () => Promise<void>;

  // ==============================================================================================
  // RZX sessions (`.plans/RZX_PLAN.md` §4.4). The session lives on the machine
  // (`IRzxMachine.rzxSession`), whose frame loop drives it; the controller attaches it, reports
  // how it ends, ends it when the IDE changes the machine from outside the CPU (trap 4), pins the
  // clock multiplier (D14), and runs unthrottled while a recording is rendered to video (D18).

  /** Skip the frame delay: run as fast as the core allows (render to video only, D18) */
  unthrottled = false;

  /**
   * Awaited before each frame when it returns a promise. Render to video holds the first frame back
   * until the screen recorder has opened its file, so no frame is lost.
   */
  frameGate?: () => Promise<void> | undefined;

  /** Fires when an RZX session stops: it ended, desynced, overflowed or was interrupted */
  readonly rzxStopped = new LiteEvent<RzxStop>();

  /** `restoreState` keeps the RZX session through its stop (a rollback) */
  private keepRzxOnStop = false;

  /** What the RZX state says besides the session's own counters */
  private rzxInfo: Pick<RzxState, "file" | "mode"> = { mode: "idle" };

  /** The machine's RZX session (active or a stopped recording waiting to be saved) */
  get rzxSession(): IRzxSession | undefined {
    return (this.machine as { rzxSession?: IRzxSession }).rzxSession;
  }

  /**
   * Attaches an RZX session to the machine; the next run drives it
   * @param mode How the state names it ("rendering" for render to video)
   */
  attachRzxSession(session: IRzxSession, info: { mode: RzxState["mode"]; file?: string }): void {
    (this.machine as { rzxSession?: IRzxSession }).rzxSession = session;
    this.rzxInfo = { mode: info.mode, file: info.file };
    this.publishRzxState();
  }

  /** Detaches the machine's RZX session */
  detachRzxSession(stopMessage?: string): void {
    (this.machine as { rzxSession?: IRzxSession }).rzxSession = undefined;
    this.rzxInfo = { mode: "idle" };
    this.unthrottled = false;
    this.frameGate = undefined;
    this.store?.dispatch(setRzxStateAction(stopMessage ? { mode: "idle", frame: 0, stopMessage } : undefined), "emu");
  }

  /**
   * Ends an active RZX session because the IDE changes the machine from outside the CPU (trap 4).
   * A stopped playback is detached; a stopped recording stays attached, unsaved, until it is saved.
   * @param reason What the IDE did, for the message
   */
  async interruptRzx(reason: string): Promise<void> {
    const session = this.rzxSession;
    if (!session?.active) return;
    session.interrupt(reason);
    await this.reportRzxStop();
  }

  /** Publishes the session's progress to the store */
  publishRzxState(): void {
    const session = this.rzxSession;
    if (!session || !this.store) return;
    const unsaved = session.mode === "record" && !session.active;
    this.store.dispatch(
      setRzxStateAction({
        mode: session.active || unsaved ? this.rzxInfo.mode : "idle",
        frame: session.frame,
        frames: session.frames,
        file: this.rzxInfo.file,
        stopMessage: session.stop?.message,
        unsaved
      }),
      "emu"
    );
  }

  /**
   * Prints a stopped session's message, publishes it and fires `rzxStopped`
   * @returns true when there was a stop to report
   */
  private async reportRzxStop(): Promise<boolean> {
    const session = this.rzxSession;
    const stop = session?.takeStop();
    if (!session || !stop) return false;
    const color = stop.kind === "desync" || stop.kind === "overflow" ? "red" : stop.kind === "ended" ? "green" : "yellow";
    await this.sendOutput(stop.message, color);
    if (session.mode === "play") {
      this.detachRzxSession(stop.message);
    } else {
      this.publishRzxState();
    }
    this.rzxStopped.fire(stop);
    return true;
  }

  /**
   * Start the machine in normal mode.
   */
  async start(operationRevision?: number): Promise<void> {
    const activeOperationRevision = this.prepareMachineOperation(operationRevision);
    await this.sendOutput("Machine started", "green");
    this.assertMachineOperationIsCurrent(activeOperationRevision);
    this.isDebugging = false;
    await this.run(
      FrameTerminationMode.Normal,
      DebugStepMode.NoDebug,
      undefined,
      undefined,
      activeOperationRevision
    );
  }

  /**
   * Start the machine in debug mode.
   */
  async startDebug(operationRevision?: number): Promise<void> {
    const activeOperationRevision = this.prepareMachineOperation(operationRevision);
    this.isDebugging = true;
    this.machine?.awakeCpu();
    await this.sendOutput("Machine started in debug mode", "green");
    this.assertMachineOperationIsCurrent(activeOperationRevision);
    await this.run(
      FrameTerminationMode.DebugEvent,
      DebugStepMode.StopAtBreakpoint,
      undefined,
      undefined,
      activeOperationRevision
    );
  }

  /**
   * Pause the running machine.
   */
  async pause(operationRevision?: number): Promise<void> {
    this.prepareMachineOperation(operationRevision);
    if (this.state !== MachineControllerState.Running) {
      throw new Error("The machine is not running");
    }
    await this.finishExecutionLoop(MachineControllerState.Pausing, MachineControllerState.Paused);
    this.emitPendingMediaChanges();
    await this.sendOutput(
      `Machine paused (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
      "cyan"
    );
  }

  /**
   * Stop the running or paused machine.
   */
  async stop(operationRevision?: number): Promise<void> {
    this.prepareMachineOperation(operationRevision);
    // --- Every reset, restore, code injection and machine switch stops the machine first (trap 4)
    if (!this.keepRzxOnStop) await this.interruptRzx("the machine was stopped, reset or reloaded");
    // --- Stop the machine
    const beforeState = this.state;
    this.isDebugging = false;
    // --- A stop ends the debug session, and with it the reverse-debugging timeline (D2) - and what
    // --- the status bar said about one that ended early
    this.endTimeline();
    this._reverseDesync = undefined;
    this.publishReverseState();
    await this.finishExecutionLoop(MachineControllerState.Stopping, MachineControllerState.Stopped);
    if (
      beforeState !== MachineControllerState.Stopped &&
      beforeState !== MachineControllerState.None
    ) {
      this.emitPendingMediaChanges();
      await this.sendOutput(
        `Machine stopped (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
        "red"
      );
    }
    this.machine.onStop();

    // --- Reset frame statistics
    this.frameStats.frameCount = 0;
    this.frameStats.lastCpuFrameTimeInMs = 0.0;
    this.frameStats.avgFrameTimeInMs = 0.0;
    this.frameStats.lastFrameTimeInMs = 0.0;
    this.frameStats.avgFrameTimeInMs = 0.0;

    // --- Reset the imminent breakpoint. The controller's own store, not the context's: a run that
    // --- was not a debug run leaves the context without one (see `run`).
    if (this.debugSupport) {
      delete this.debugSupport.imminentBreakpoint;
      delete this.debugSupport.lastBreakpoint;
      delete this.debugSupport.lastStartupBreakpoint;
    }
  }

  /**
   * Reset the CPU of the machine.
   */
  async cpuReset(operationRevision?: number): Promise<void> {
    const activeOperationRevision = this.prepareMachineOperation(operationRevision);
    await this.stop(activeOperationRevision);
    this.assertMachineOperationIsCurrent(activeOperationRevision);
    await this.sendOutput("CPU reset", "cyan");
    this.assertMachineOperationIsCurrent(activeOperationRevision);
    this.machine.reset();
    await this.start(activeOperationRevision);
  }

  /**
   * Stop and then start the machine again.
   */
  async restart(operationRevision?: number): Promise<void> {
    const activeOperationRevision = this.prepareMachineOperation(operationRevision);
    await this.stop(activeOperationRevision);
    this.assertMachineOperationIsCurrent(activeOperationRevision);
    await this.sendOutput("Hard reset", "cyan");
    this.assertMachineOperationIsCurrent(activeOperationRevision);
    await this.machine.hardReset();
    this.assertMachineOperationIsCurrent(activeOperationRevision);
    await this.start(activeOperationRevision);
  }

  // ==============================================================================================
  // Source-level stepping (plan §10.2): active while the injected program has source-level debug
  // info and Source stepping is selected; Step Into/Over/Out then step statements, not instructions.

  private sourceIndex?: SourceDebugIndex;

  /** Source stepping (true) or Z80 instruction stepping (false) when source-level info is loaded. */
  sourceStepping = true;

  /** A boolean global setting, or its default when the store does not have it. */
  private flagSetting(key: string, fallback: boolean): boolean {
    const value = this.store ? getGlobalSetting(this.store, key) : undefined;
    return value === undefined || value === null ? fallback : !!value;
  }

  /** Statement entries inside interrupt handlers stop a source step (§10.2.7; a setting, off by default). */
  get stopInInterrupts(): boolean {
    return this.flagSetting(SETTING_EMU_STEP_IN_INTERRUPTS, false);
  }

  /** Debug runs stop at the program's runtime-error routines (§10.10; a setting, on by default). */
  get stopOnErrors(): boolean {
    return this.flagSetting(SETTING_EMU_STOP_ON_ERRORS, true);
  }

  /** Stepping runs through the standard library's statements (§10.12; a setting, on by default). */
  get justMyCode(): boolean {
    return this.flagSetting(SETTING_EMU_JUST_MY_CODE, true);
  }

  /** The injected program's source-level debug info; undefined for a program without it. */
  setSourceDebugInfo(info?: SourceLevelDebugInfo): void {
    if (this.debugSupport) this.debugSupport.sourceStep = undefined;
    this.buildSourceIndex(info);
    this.applyErrorStops();
  }

  private buildSourceIndex(info?: SourceLevelDebugInfo): void {
    const index = info?.extensions ? new SourceDebugIndex(info, this.justMyCode) : undefined;
    this.sourceIndex = index;
    if (this.debugSupport) this.debugSupport.statementTracker = index ? new CurrentStatementTracker(index) : undefined;
  }

  /** Just My Code changed since the index was built: rebuild it (a step in progress keeps its own). */
  private refreshSourceIndex(): void {
    if (this.sourceIndex && this.sourceIndex.justMyCode !== this.justMyCode) this.buildSourceIndex(this.sourceIndex.info);
  }

  /** Arms or disarms the runtime-error stop from the setting; every run does this, so a change applies at once. */
  private applyErrorStops(): void {
    this.refreshSourceIndex();
    const index = this.sourceIndex;
    const debugSupport = this.debugSupport;
    if (!debugSupport) return;
    const on = this.stopOnErrors && !!index;
    debugSupport.errorStopAddress = on ? index!.info.extensions?.errorEntry : undefined;
    // --- The ROM's own errors (RST 8), while a statement of the program is on the stack
    debugSupport.romErrorAddress = on ? ROM_ERROR_RESTART : undefined;
    debugSupport.romErrorGuard = on ? () => innermostUserStatement(index!, this.machineView()) >= 0 : undefined;
  }

  /** At an error stop: the ERR_NR code (A at the runtime's routine, the byte after the RST at the ROM's). */
  private errorCodeAt(pc: number): number | undefined {
    const debugSupport = this.debugSupport;
    if (!debugSupport) return undefined;
    if (pc === debugSupport.errorStopAddress) return ((this.machine as unknown as { af: number }).af >> 8) & 0xff;
    if (pc === debugSupport.romErrorAddress && debugSupport.romErrorGuard?.()) {
      const view = this.machineView();
      return this.machine.doReadMemory(view.readWord(view.sp)) & 0xff;
    }
    return undefined;
  }

  /**
   * The user statement running when PC is outside the user's statements: at an error stop the
   * statement tracker knows it best (the error routine is often reached by a `jp`); otherwise the
   * stack's innermost return address into a statement, then the tracker.
   */
  private userStatement(index: SourceDebugIndex, preferTracker: boolean): number {
    const tracked = this.debugSupport?.statementTracker?.current ?? -1;
    if (preferTracker && tracked >= 0) return tracked;
    const scanned = innermostUserStatement(index, this.machineView());
    return scanned >= 0 ? scanned : tracked;
  }

  /** Whether Step Into/Over/Out step statements now. */
  get usesSourceStepping(): boolean {
    return !!this.sourceIndex && this.sourceStepping;
  }

  private machineView(): MachineView {
    const m = this.machine;
    const cpu = m as unknown as { ix: number; getInterruptDepth?: () => number };
    const readByte = (a: number) => m.doReadMemory(a & 0xffff);
    return {
      pc: m.pc,
      sp: m.sp,
      ix: cpu.ix,
      readWord: (a: number) => readByte(a) | (readByte(a + 1) << 8),
      readByte,
      partitionOf: (a: number) => m.getPartition?.(a & 0xffff),
      interruptDepth: cpu.getInterruptDepth?.() ?? 0
    };
  }

  /**
   * A source-level step (`SourceStepDecision.ts`): into, over, out of statements and calls, over a
   * whole line, to a frame of the call stack, or into a chosen call of the statement.
   */
  async sourceStep(
    kind: SourceStepKind,
    options: { targetFrame?: number; targetCallable?: number } = {},
    operationRevision?: number
  ): Promise<void> {
    this.refreshSourceIndex();
    const index = this.sourceIndex;
    if (!index) return;
    const activeOperationRevision = this.prepareMachineOperation(operationRevision);
    this.isDebugging = true;
    this.machine?.awakeCpu();
    const step = beginSourceStep(index, this.machineView(), kind, {
      ...options,
      previous: this.debugSupport?.sourceStep,
      stopInInterrupts: this.stopInInterrupts
    });
    if ((kind === "out" || kind === "runToFrame") && !canStepOut(step.chain)) {
      await this.sendOutput("Step out: the main program has nothing to return to", "yellow");
      return;
    }
    if (this.debugSupport) this.debugSupport.sourceStep = step;
    await this.sendOutput(`Source step (${kind}) at PC $${this.machine.pc.toString(16).padStart(4, "0")}`, "cyan");
    this.assertMachineOperationIsCurrent(activeOperationRevision);
    await this.run(FrameTerminationMode.DebugEvent, DebugStepMode.SourceStep, undefined, undefined, activeOperationRevision);
  }

  /** Where the paused program stands at source level; undefined without source-level info. */
  getSourceStopInfo(): SourceStopInfo | undefined {
    const index = this.sourceIndex;
    if (!index) return undefined;
    const step = this.debugSupport?.sourceStep;
    const pc = this.machine.pc;
    if (step?.stoppedAt && step.stopPc === pc) {
      const from = step.stoppedAt === "returnPoint" ? step.chain[step.level - 1] : undefined;
      return {
        kind: step.stoppedAt,
        pc,
        statementIndex: step.stopStatement ?? index.statementAt(pc, index.partitionNow(this.machineView(), pc)),
        ...(from?.kind === "routine" ? { returnedFrom: from.callableIndex } : {}),
        ...(from?.kind === "gosub" ? { returnedFromGosub: true } : {}),
        returned: step.returned
      };
    }
    const code = this.errorCodeAt(pc);
    if (code !== undefined) {
      return {
        kind: "error",
        pc,
        statementIndex: -1,
        userStatementIndex: this.userStatement(index, true),
        error: { code, report: basicErrorReport(code) },
        returned: step?.returned ?? []
      };
    }
    const statementIndex = index.statementAt(pc, index.partitionNow(this.machineView(), pc));
    return {
      kind: "other",
      pc,
      statementIndex,
      ...(statementIndex < 0 ? { userStatementIndex: this.userStatement(index, false) } : {}),
      returned: step?.returned ?? []
    };
  }

  /** The symbolic call stack (§10.6), innermost first; undefined without source-level info. */
  getSourceCallStack(): SourceActivationInfo[] | undefined {
    return this.sourceIndex ? locateActivations(this.sourceIndex, this.machineView()) : undefined;
  }

  /**
   * Starts the machine in step-into mode.
   */
  async stepInto(operationRevision?: number): Promise<void> {
    if (this.usesSourceStepping) return this.sourceStep("into", {}, operationRevision);
    const activeOperationRevision = this.prepareMachineOperation(operationRevision);
    this.isDebugging = true;
    this.machine?.awakeCpu();
    await this.sendOutput(
      `Step-into (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
      "cyan"
    );
    this.assertMachineOperationIsCurrent(activeOperationRevision);
    await this.run(
      FrameTerminationMode.DebugEvent,
      DebugStepMode.StepInto,
      undefined,
      undefined,
      activeOperationRevision
    );
  }

  /**
   * Starts the machine in step-over mode.
   */
  async stepOver(operationRevision?: number): Promise<void> {
    if (this.usesSourceStepping) return this.sourceStep("over", {}, operationRevision);
    const activeOperationRevision = this.prepareMachineOperation(operationRevision);
    this.isDebugging = true;
    this.machine?.awakeCpu();
    await this.sendOutput(
      `Step-over (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
      "cyan"
    );
    this.assertMachineOperationIsCurrent(activeOperationRevision);
    await this.run(
      FrameTerminationMode.DebugEvent,
      DebugStepMode.StepOver,
      undefined,
      undefined,
      activeOperationRevision
    );
  }

  /**
   * Starts the machine in step-out mode.
   */
  async stepOut(operationRevision?: number): Promise<void> {
    if (this.usesSourceStepping) return this.sourceStep("out", {}, operationRevision);
    const activeOperationRevision = this.prepareMachineOperation(operationRevision);
    this.isDebugging = true;
    this.machine?.awakeCpu();
    await this.sendOutput(
      `Step-out (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
      "cyan"
    );
    this.assertMachineOperationIsCurrent(activeOperationRevision);
    this.machine.markStepOutAddress();
    await this.run(
      FrameTerminationMode.DebugEvent,
      DebugStepMode.StepOut,
      undefined,
      undefined,
      activeOperationRevision
    );
  }

  /**
   * Executes a custom command
   * @param command Custom command string
   */
  async customCommand(command: string): Promise<any> {
    // --- A machine command (the Z88's flap, battery and shift keys) is an input to the present: in
    // --- the past the muted journal would drop it (REVERSE_DEBUGGING_PLAN D12)
    this.clearHistoryCursor();
    return await this.machine.executeCustomCommand(command);
  }

  /**
   * Replaces the machine's state and leaves it Paused (see `IMachineController.restoreState`).
   *
   * The same seam as the checkpoint restore in `runCode`: stopping makes the next state change a
   * real one (Stopped -> Paused), so the IDE refreshes its panels and shows the execution point,
   * and it forgets the last breakpoint, so a breakpoint at the restored PC fires before that
   * instruction runs. Paused, not Stopped: `run()` resets a machine it starts from Stopped.
   */
  async restoreState(
    applyState: () => void,
    description: string,
    options: { attachMedia?: boolean; keepRzxSession?: boolean } = {}
  ): Promise<void> {
    const operationRevision = this.beginMachineOperation();
    // --- An RZX rollback restores a state of its own session, which must survive the stop
    this.keepRzxOnStop = !!options.keepRzxSession;
    try {
      await this.stop(operationRevision);
    } finally {
      this.keepRzxOnStop = false;
    }
    this.assertMachineOperationIsCurrent(operationRevision);

    applyState();
    // --- The restored state's past is not in the ring: that history belongs to another timeline (D7, D9)
    this.historySource()?.clearHistory();

    // --- `run()` attaches the stored media when it starts from a stop; this restore takes the
    // --- place of that start. A Klive state brings its own media inside the core's memory, which
    // --- an attach would overwrite (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` trap 12).
    if (options.attachMedia !== false) {
      attachStoredMedia(this.machine, this._machineInfo.mediaIds);
    }
    this.state = MachineControllerState.Paused;
    await this.sendOutput(
      `${description} (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
      "cyan"
    );
  }

  /**
   * Runs the specified code in the virtual machine
   * @param codeToInject Code to inject into the amchine
   * @param additionalInfo Additional information for code execution
   * @param debug Run in debug mode?
   * @param projectDebug Run in project debug mode?
   */
  async runCode(
    codeToInject: CodeToInject,
    additionalInfo: any,
    debug: boolean,
    projectDebug: boolean
  ): Promise<void> {
    const operationRevision = this.beginMachineOperation();

    // --- Stop the machine
    await this.stop(operationRevision);
    this.assertMachineOperationIsCurrent(operationRevision);

    // --- Adjust project debug mode
    if (projectDebug) {
      this.store.dispatch(setProjectDebuggingAction(true), "emu");
    }

    // --- Execute the code injection flow
    const injectionFlow = await this.machine.getCodeInjectionFlow(
      codeToInject.model ?? this.machine.machineId,
      additionalInfo
    );
    this.assertMachineOperationIsCurrent(operationRevision);
    await this.executeInjectionFlow(injectionFlow, codeToInject, debug, operationRevision);
  }

  /**
   * Resets the machine and starts the tape in its deck loading: `LOAD ""` on a 48K, the Tape Loader
   * on a 128K or +2/+3 (`tapeLoadFlows.ts`, `.plans/TAPE_VIEWER_PLAN.md` §4.6). Nothing is
   * injected - the ROM loads whatever the tape holds.
   * @param debug Arm the breakpoints once the keystrokes are typed
   */
  async runTapeLoad(debug: boolean): Promise<void> {
    const flow = this.machine.getTapeLoadFlow?.();
    if (!flow) {
      throw new Error("This machine cannot start loading a tape automatically.");
    }
    const operationRevision = this.beginMachineOperation();
    await this.stop(operationRevision);
    this.assertMachineOperationIsCurrent(operationRevision);
    await this.executeInjectionFlow(flow, undefined, debug, operationRevision);
  }

  /**
   * Resets the machine and boots the disk in drive A (the Pentagon's Beta 128: `trdosFlows.ts`,
   * `.plans/BETA128_TRDOS_PLAN.md` Phase 4).
   * @param debug Arm the breakpoints once the keystrokes are typed
   */
  async runDiskBoot(debug: boolean): Promise<void> {
    const flow = this.machine.getDiskBootFlow?.();
    if (!flow) {
      throw new Error("This machine cannot boot a disk automatically.");
    }
    const operationRevision = this.beginMachineOperation();
    await this.stop(operationRevision);
    this.assertMachineOperationIsCurrent(operationRevision);
    await this.executeInjectionFlow(flow, undefined, debug, operationRevision);
  }

  /**
   * Runs a code-injection flow's steps, then starts the machine - in debug mode if asked. Shared by
   * `runCode` and `runTapeLoad`; a flow with no `Inject` step needs no code.
   */
  private async executeInjectionFlow(
    injectionFlow: CodeInjectionFlow,
    codeToInject: CodeToInject | undefined,
    debug: boolean,
    operationRevision: number
  ): Promise<void> {
    const m = this.machine;
    await this.sendOutput("Initialize the machine", "blue");
    this.assertMachineOperationIsCurrent(operationRevision);
    this.isDebugging = debug;
    // --- Starting a program is a restart (C12), also when the boot is restored from a checkpoint
    // --- rather than run from Stopped, which is where `run` resets them
    this.debugSupport?.resetHitCounts();
    this.startLogSession();

    let entryPoint = 0;
    let keepPc = false;
    for (const step of injectionFlow) {
      this.assertMachineOperationIsCurrent(operationRevision);
      switch (step.type) {
        case "KeepPc":
          keepPc = true;
          break;

        case "ReachExecPoint":
          // --- Run while a particular entry point is reached
          if (this._machineState === MachineControllerState.Running) {
            await this.pause(operationRevision);
          }

          // --- Reaching this point means single-stepping the machine all the way there, which for a
          // --- cold boot dwarfs everything else the flow does. When the step opts into a checkpoint
          // --- and the machine still holds one, restore it and skip the journey entirely.
          if (step.checkpoint && m.tryRestoreCheckpoint?.(step.checkpoint)) {
            // --- The checkpoint leaves the history ring alone (T7): what it holds is another run's
            this.historySource()?.clearHistory();
            this.endTimeline();
            // --- `run()` attaches the stored media as part of starting from a stop; the restore
            // --- took the place of that start, so do it here instead.
            attachStoredMedia(m, this._machineInfo.mediaIds);
            this.state = MachineControllerState.Paused;
            await this.sendOutput(
              `Restored the cached machine state (ROM${step.rom}/$${toHexa4(step.execPoint)})`,
              "blue"
            );
            break;
          }

          await this.run(
            FrameTerminationMode.UntilExecutionPoint,
            DebugStepMode.NoDebug,
            step.rom,
            step.execPoint,
            operationRevision
          );
          await this._machineTask;
          this.assertMachineOperationIsCurrent(operationRevision);

          // --- Only capture once the machine actually arrived: a run cut short by a cancel or a
          // --- breakpoint would otherwise be cached as if it were the execution point.
          if (step.checkpoint && m.pc === step.execPoint) {
            m.captureCheckpoint?.(step.checkpoint);
          }
          break;

        case "Start":
          // --- Always start in normal (non-debug) mode during the injection flow.
          // --- Debug mode is activated after the full flow completes. Starting
          // --- in StopAtBreakpoint mode here would stop the machine at any user
          // --- breakpoint mid-flow, causing all queued keystrokes to share the
          // --- same startTact and expire before the machine can process them.
          await this.start(operationRevision);
          break;

        case "Wait":
          if ((step.duration ?? 100) > 0) {
            await delay(step.duration);
            this.assertMachineOperationIsCurrent(operationRevision);
          }
          break;

        case "WaitIdle": {
          // --- "Parked in the loop", not "passed through it once". See the step's doc comment.
          const samplesNeeded = step.samples ?? 12;
          const intervalMs = step.intervalMs ?? 20;
          const deadline = Date.now() + (step.timeoutMs ?? 10000);
          let consecutive = 0;
          while (consecutive < samplesNeeded) {
            if (Date.now() >= deadline) {
              await this.sendOutput(
                `Timed out waiting for the machine to settle in $${toHexa4(step.fromAddr)}-$${toHexa4(
                  step.toAddr
                )}.`,
                "yellow"
              );
              break;
            }
            await delay(intervalMs);
            this.assertMachineOperationIsCurrent(operationRevision);
            const pc = this.machine?.pc ?? -1;
            consecutive = pc >= step.fromAddr && pc <= step.toAddr ? consecutive + 1 : 0;
          }
          break;
        }

        case "WaitKeyQueue": {
          // --- Paced by the machine, not the host: poll until it has played back everything queued.
          const deadline = Date.now() + (step.timeoutMs ?? 5000);
          while ((this.machine?.getKeyQueueLength() ?? 0) > 0) {
            if (Date.now() >= deadline) {
              await this.sendOutput(
                "Timed out waiting for queued keystrokes to be played back.",
                "yellow"
              );
              break;
            }
            await delay(20);
            this.assertMachineOperationIsCurrent(operationRevision);
          }
          break;
        }

        case "QueueKey":
          m.queueKeystroke(0, 5, step.primary, step.secondary, step.ternary);
          if ((step.wait ?? 100) > 0) {
            await delay(step.wait);
            this.assertMachineOperationIsCurrent(operationRevision);
          }
          break;

        case "Inject":
          // --- Inject the code and set up the machine to run the code
          if (!codeToInject) break;
          entryPoint = this.machine.injectCodeToRun(codeToInject);
          await this.sendOutput(
            `Code injected and ready to start at $${toHexa4(entryPoint)}})`,
            "blue"
          );
          this.assertMachineOperationIsCurrent(operationRevision);
          break;

        case "SetReturn":
          if (codeToInject?.subroutine) {
            const spValue = m.sp;
            m.doWriteMemory(spValue - 1, step.returnPoint >> 8);
            m.doWriteMemory(spValue - 2, step.returnPoint & 0xff);
            m.sp = spValue - 2;
            await this.sendOutput(
              `Code will start as a subroutine to return to $${toHexa4(step.returnPoint)}`,
              "blue"
            );
            this.assertMachineOperationIsCurrent(operationRevision);
          }
          break;
      }
      if (step.message) {
        await this.sendOutput(step.message, "blue");
        this.assertMachineOperationIsCurrent(operationRevision);
      }
    }

    this.assertMachineOperationIsCurrent(operationRevision);

    // --- Set the continuation point
    if (!keepPc) {
      m.pc = entryPoint;
    }

    // --- Start the machine
    if (debug) {
      if (this.state === MachineControllerState.Running) {
        // --- The injection flow left the machine running (e.g. ZX Spectrum Next
        // --- after typing the .nexload command). Switch to debug mode in-place
        // --- so the ongoing execution is not interrupted while the machine
        // --- still processes in-flight keystrokes.
        this.isDebugging = true;
        this.context.debugStepMode = DebugStepMode.StopAtBreakpoint;
        this.context.frameTerminationMode = FrameTerminationMode.DebugEvent;
        this.context.terminationPartition = undefined;
        this.context.terminationPoint = undefined;
        this.context.debugSupport = this.debugSupport;
        this.suppressUserBreakpointsUntilKeystrokesLand(operationRevision);
        this.machine?.awakeCpu();
        this.store.dispatch(setDebuggingAction(true), "emu");
        this.applyHistoryRecording(true);
      } else {
        // --- No suppression here: this branch starts a machine that is stopped or paused, so
        // --- nothing is in flight, and a window opened before `startDebug` would be closed by the
        // --- first poll (the machine is not Running yet) rather than by the keystrokes landing.
        await this.startDebug(operationRevision);
      }
    } else {
      await this.start(operationRevision);
    }
  }

  /**
   * Resolves the source code breakpoints used when running the machine
   * @param bps
   */
  resolveBreakpoints(bps: ResolvedBreakpoint[]): void {
    if (!this.debugSupport) return;
    this.debugSupport.resetBreakpointResolution();
    for (const bp of bps) {
      this.debugSupport.resolveBreakpoint(bp.resource, bp.line, bp.address, bp.partition, bp.column);
    }
  }

  /**
   * Scrolls down breakpoints
   * @param def Breakpoint address
   * @param lineNo Line number to shift down
   */
  scrollBreakpoints(def: BreakpointInfo, shift: number): void {
    if (!this.debugSupport) return;
    this.debugSupport.scrollBreakpoints(def, shift);
  }

  /**
   * Normalizes source code breakpoint. Removes the ones that overflow the
   * file and also deletes duplicates.
   * @param lineCount
   * @returns
   */
  normalizeBreakpoints(resource: string, lineCount: number): void {
    if (!this.debugSupport) return;
    this.debugSupport.normalizeBreakpoints(resource, lineCount);
  }

  // ==============================================================================================
  // The history cursor (`.plans/LITE_STEP_BACK_PLAN.md`, G4.3): the paused machine looked at in its
  // recorded past. The machine itself never changes; `getCpuState()` answers from the cursor (D2).

  private _historyCursor?: HistoryCursor;

  /** The history cursor; created on first use */
  get historyCursor(): HistoryCursor {
    this._historyCursor ??= new HistoryCursor({
      historySource: () => this.historySource(),
      isPaused: () => this.state === MachineControllerState.Paused,
      // --- With a timeline the machine itself goes to the cursor (REVERSE_DEBUGGING_PLAN D10)
      replay: () => (this.timeline ? this.replayProvider : undefined),
      // --- The present's PC and SP: in the past the machine's are the past's
      livePc: () => (this.timeline ? this.replayProvider.presentPc : this.machine.pc),
      liveSp: () => (this.timeline ? this.replayProvider.presentSp : this.machine.sp),
      statementStop: () => {
        // --- Statement-level stepping back (D12) uses the same index as forward source stepping
        if (!this.usesSourceStepping) return undefined;
        this.refreshSourceIndex();
        const index = this.sourceIndex;
        return index ? (record, partition) => index.entryAt(record.regs.pc, partition) >= 0 : undefined;
      },
      breakpointHit: (record, partition, notes) => this.historicalBreakpointHit(record, partition, notes),
      publish: (position, sequence) => {
        this.store?.dispatch(
          setHistoryPositionAction(position, sequence, this._historyCursor?.memoryIsHistorical ?? false),
          "emu"
        );
        this.publishReverseState();
      }
    });
    return this._historyCursor;
  }

  /** Moves the history cursor (D4): never a machine command, the machine is not touched */
  navigateHistory(op: HistoryNavigationOp, options?: HistoryNavigationOptions): HistoryNavigationResult {
    // --- With a timeline, Reverse Continue checks every breakpoint on the real past machine (D15)
    if (op === "reverseContinue" && this.timeline && this.state === MachineControllerState.Paused) {
      return this.reverseContinueByReplay();
    }
    const result = this.historyCursor.navigate(op, options);
    this.publishReverseState();
    // --- The machine could not go there itself (before the timeline's start, a desync): say why
    const failed = this.timeline || this._replayProvider?.lastError ? this._replayProvider?.lastError : undefined;
    if (failed && result.moved && result.position > 0 && !this.historyCursor.memoryIsHistorical) {
      return { ...result, notes: [...(result.notes ?? []), `Memory and devices show the present here: ${failed}`] };
    }
    return result;
  }

  /** Returns to the present (D5): register and memory edits call it before they act */
  clearHistoryCursor(): void {
    this._historyCursor?.clear();
    this.leavePast();
  }

  /**
   * Back to the present when the machine stands in the past without a cursor - after a deep landing
   * (D17) - which `HistoryCursor.clear` cannot see
   */
  private leavePast(): void {
    if (this.timeline?.mode === "navigating" && this.state === MachineControllerState.Paused) {
      this.replayProvider.leave();
    }
  }

  /**
   * Reverse Continue by replay (`.plans/REVERSE_DEBUGGING_PLAN.md` D15): the keyframe interval that
   * ends where the machine stands is replayed with breakpoints in *collect* mode - every stop is noted
   * and the run goes on - and the last hit before that point wins; with none, the interval before it.
   * Every breakpoint kind works, because the machine is really there: conditions that read memory,
   * memory and I/O watchpoints, NextReg and Copper breakpoints. That is also what makes a memory-write
   * watchpoint a reverse watchpoint ("the last write to $8000").
   */
  private reverseContinueByReplay(): HistoryNavigationResult {
    const search = this.reverseContinueSearch();
    for (;;) {
      const step = search.next();
      if (step.done === true) return step.value;
    }
  }

  /** Set by `cancelReverseContinue`: the search stops after the interval it is in */
  private _reverseSearchCanceled = false;
  /** Keyframe intervals a running search has covered (the IDE's progress) */
  private _reverseSearchIntervals?: number;

  /**
   * Reverse Continue with progress and cancel (D15, §4.4): the search yields to the event loop after
   * every keyframe interval, publishes how many it covered, and stops - back where it started - when
   * `cancelReverseContinue` is called. Without a timeline, G4.3's walker answers at once.
   */
  async reverseContinue(): Promise<HistoryNavigationResult> {
    if (!this.timeline || this.state !== MachineControllerState.Paused) return this.navigateHistory("reverseContinue");
    this._reverseSearchCanceled = false;
    const search = this.reverseContinueSearch();
    try {
      for (;;) {
        const step = search.next();
        if (step.done === true) return step.value;
        this._reverseSearchIntervals = step.value;
        this.publishReverseState();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      this._reverseSearchIntervals = undefined;
      this._reverseSearchCanceled = false;
      this.publishReverseState();
    }
  }

  /** Stops a running Reverse Continue search; the machine goes back where the search started */
  cancelReverseContinue(): boolean {
    if (this._reverseSearchIntervals === undefined) return false;
    this._reverseSearchCanceled = true;
    return true;
  }

  /** The search behind Reverse Continue: yields the intervals covered after each one, returns the result */
  private *reverseContinueSearch(): Generator<number, HistoryNavigationResult> {
    const timeline = this.timeline!;
    const cursor = this.historyCursor;
    const startSequence = cursor.sequence;
    const startedInPast = timeline.mode === "navigating";
    const from = timeline.position;
    const here = (extra: Partial<HistoryNavigationResult>): HistoryNavigationResult => ({
      position: cursor.position,
      sequence: cursor.sequence,
      moved: false,
      ...extra
    });
    /** Back where the search started: the cursor's record, a deep landing, or the present */
    const backToStart = () => {
      if (startSequence !== undefined) cursor.moveToRecord(startSequence);
      else if (startedInPast) {
        timeline.landAt(from);
        this.replayProvider.anchorHere();
      } else timeline.returnToPresent();
    };
    let end = from;
    let hit: { position: TimelinePosition; label: string } | undefined;
    let intervals = 0;
    try {
      for (let keyframe = timeline.keyframeBefore(end); keyframe; keyframe = timeline.keyframeBefore(end)) {
        const hits = this.collectBreakpointHits(keyframe.seed.position, end);
        if (hits.length) {
          hit = hits[hits.length - 1];
          break;
        }
        end = keyframe.seed.position;
        yield ++intervals;
        if (this._reverseSearchCanceled) {
          backToStart();
          return here({ reason: "canceled" });
        }
      }
    } catch (err) {
      // --- A desync ends the timeline (D9): the machine stays where the replay stopped
      if (!this.timeline) return here({ notes: [`Reverse debugging stopped: ${(err as Error).message}`] });
      throw err;
    }
    if (!hit) {
      backToStart();
      return here({ reason: "noHit" });
    }
    // --- The machine stood just before the hit's next record: the cursor goes there
    if (timeline.viewHolds(hit.position.sequence)) {
      cursor.moveToRecord(hit.position.sequence + 1);
      return { position: cursor.position, sequence: cursor.sequence, moved: true, breakpoint: hit.label };
    }
    // --- Older than anything the ring holds: the machine goes there and the ring it regenerated becomes
    // --- the history views' (no cursor: the machine itself shows the point)
    cursor.clear(false);
    timeline.landAt(hit.position);
    this.replayProvider.anchorHere();
    this.store?.dispatch(setHistoryPositionAction(0, undefined, true), "emu");
    return {
      position: 0,
      moved: true,
      breakpoint: hit.label,
      notes: ["Found before the recorded history's window: the history shows the run up to this point"]
    };
  }

  /**
   * Replays from a position (a keyframe's) to `end` with breakpoints in collect mode: every stop
   * before `end` is noted with what stopped it, and the run continues (D15)
   */
  private collectBreakpointHits(from: TimelinePosition, end: TimelinePosition): { position: TimelinePosition; label: string }[] {
    const timeline = this.timeline!;
    timeline.replayTo(from);
    timeline.startReplayRun(end);
    const ctx = this.context;
    const saved = {
      debugStepMode: ctx.debugStepMode,
      frameTerminationMode: ctx.frameTerminationMode,
      debugSupport: ctx.debugSupport,
      historyStopArmed: ctx.historyStopArmed
    };
    ctx.debugStepMode = DebugStepMode.StopAtBreakpoint;
    ctx.frameTerminationMode = FrameTerminationMode.DebugEvent;
    ctx.debugSupport = this.debugSupport;
    ctx.historyStopArmed = true;
    const hits: { position: TimelinePosition; label: string }[] = [];
    try {
      for (let guard = 0; timeline.mode === "replaying"; guard++) {
        if (guard > 10_000_000) throw new Error("Reverse Continue did not finish an interval");
        const termination = this.machine.executeMachineFrame();
        if (timeline.port.targetReached) {
          const outcome = timeline.onReplayTarget();
          if (outcome === "desync") throw timeline.lastDesync ?? new Error("Replay diverged");
          if (outcome !== "continue") break;
          continue;
        }
        if (termination === FrameTerminationMode.DebugEvent) {
          const position = timeline.port.position;
          if (comparePositions(position, end) < 0) hits.push({ position, label: this.describeDebugStop() });
          // --- Memory, I/O and NextReg stops spend their one-shots as a real stop would
          this.debugSupport?.consumeFiredOneShots();
        }
      }
    } finally {
      ctx.debugStepMode = saved.debugStepMode;
      ctx.frameTerminationMode = saved.frameTerminationMode;
      ctx.debugSupport = saved.debugSupport;
      ctx.historyStopArmed = saved.historyStopArmed;
      if (timeline.mode === "replaying") timeline.pauseReplayRun();
    }
    return hits;
  }

  /** Reverse Continue (D11): whether an enabled execution breakpoint stops at a record */
  private historicalBreakpointHit(
    record: HistoryRecord,
    partition: number | undefined,
    notes: Set<string>
  ): { hit: boolean; label?: string } {
    const candidates = this.debugSupport?.historicalExecBreakpoints?.(record.regs.pc, partition) ?? [];
    for (const { bp, compiled, error } of candidates) {
      const label = bp.resource && bp.line !== undefined ? `${bp.resource}:${bp.line}` : `$${toHexa4(record.regs.pc)}`;
      // --- No condition, or one that does not compile (it stops every time, as live: C15)
      if (!compiled || error) return { hit: true, label };
      const result = evaluateHistoryCondition(compiled, record.regs);
      if ("value" in result) {
        if (result.value) return { hit: true, label };
        continue;
      }
      // --- Over-stopping is the safe failure (Q5): the user is told, once per breakpoint
      notes.add(
        `Breakpoint ${label}: condition not checked - ${(result as { reason: string }).reason}, which is not historical in lite mode`
      );
      return { hit: true, label };
    }
    return { hit: false };
  }

  /**
   * The machine as an execution-history recorder, when it is one
   * (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.4)
   */
  private historySource(): IExecutionHistorySource | undefined {
    return isExecutionHistorySource(this.machine) ? this.machine : undefined;
  }

  /**
   * Records history in debug sessions only (D8): Start with debugging and the steps, never a plain
   * Run, and not the `NoDebug` runs of a code-injection flow that boot the machine to its entry point.
   * @param debugRun Whether the run about to start is a debug run
   */
  private applyHistoryRecording(debugRun: boolean): void {
    const recording = this.isDebugging && debugRun;
    this.historySource()?.setHistoryEnabled(recording);
    // --- A timeline's positions are the recorder's: it lives exactly while the recorder records (D2, D3)
    if (recording) this.ensureTimeline();
    else this.endTimeline();
  }

  // ------------------------------------------------------------------------------------------------
  // Reverse debugging (`.plans/REVERSE_DEBUGGING_PLAN.md` D2, D13; `reverse/Timeline.ts`)

  private _timeline?: Timeline;

  /** The reverse-debugging timeline of the current debug session, if the machine keeps one */
  get timeline(): Timeline | undefined {
    return this._timeline && !this._timeline.isEnded ? this._timeline : undefined;
  }

  /**
   * Starts a timeline for a debug run (D2): on a machine with `MF_REVERSE_DEBUG`, unless the
   * `emuOptions.reverseDebugging` setting is off. A failure to start leaves debugging as it was.
   */
  private ensureTimeline(): void {
    if (this.timeline) return;
    if (!this._machineInfo?.features?.[MF_REVERSE_DEBUG]) return;
    if (this.store && getGlobalSetting(this.store, SETTING_EMU_REVERSE_DEBUGGING) === false) return;
    if (!isTimelineMachine(this.machine)) return;
    try {
      const settingMb = this.store ? (getGlobalSetting(this.store, SETTING_EMU_REVERSE_DEBUG_MEMORY_MB) as number) : 0;
      const deviceGb = (globalThis.navigator as { deviceMemory?: number } | undefined)?.deviceMemory;
      this._reverseDesync = undefined;
      this._timeline = Timeline.start(this.machine, {
        budgetBytes: reverseDebugBudgetBytes(settingMb, deviceGb ? deviceGb * 2 ** 30 : undefined),
        debugSupport: hasTimelineState(this.debugSupport) ? this.debugSupport : undefined,
        // --- The present's unpublished tape saves and disk writes go out before the machine moves
        // --- into the past, where a replay's own would be indistinguishable from them (D13)
        beforeLeavePresent: () => this.publishHostEffects()
      });
    } catch (err) {
      console.warn("Reverse debugging is off for this session:", err);
      this._timeline = undefined;
    }
    this.publishReverseState();
  }

  /**
   * Ends the timeline (D2): a stop, a reset, a restore, a code injection, a machine change, or the
   * recorder going off
   */
  endTimeline(): void {
    this.publishReverseState();
    this._timeline?.end();
    this._timeline = undefined;
    this.context.historyStopArmed = false;
    this._replayProvider?.forgetPresent();
    this.publishReverseState();
  }

  /** What `publishReverseState` dispatched last, to skip repeats */
  private _reverseStateJson?: string;
  /** Why the last timeline ended early, until a new one starts */
  private _reverseDesync?: string;

  /**
   * Tells the IDE where the timeline stands (§4.4): the mode, how far behind the present the machine
   * is and how far back the timeline reaches - in seconds of machine time - a deep landing, ignored
   * input, a search's progress, and why a timeline ended early. Dispatched only when it changed.
   */
  publishReverseState(): void {
    if (!this.store) return;
    const ended = this._timeline;
    if (ended?.isEnded && ended.lastDesync && this._reverseDesync !== ended.lastDesync.message) {
      // --- A desync ends the timeline wherever a replay found it - a step back, a replay run, a
      // --- keyframe's calibration replay: said once, in the output pane and on the status bar (D9)
      this._reverseDesync = ended.lastDesync.message;
      void this.sendOutput(`Reverse debugging stopped: ${ended.lastDesync.message}`, "red");
    }
    const timeline = this.timeline;
    let state: ReverseDebugState | undefined;
    if (timeline) {
      const m = this.machine;
      const secondsPerFrame =
        m.baseClockFrequency > 0 ? m.tactsInFrame / (m.frameTactMultiplier || 1) / m.baseClockFrequency : 0.02;
      const present = timeline.presentFrames;
      const start = timeline.startFrames;
      const round = (s: number) => Math.round(Math.max(0, s) * 1_000_000) / 1_000_000;
      const mode = timeline.mode;
      state = {
        active: true,
        mode,
        behindSeconds: mode === "live" ? undefined : round((present - timeline.machineFrames) * secondsPerFrame),
        rangeSeconds: start === undefined ? undefined : round((present - start) * secondsPerFrame),
        deepLanding: mode === "navigating" && this._historyCursor?.sequence === undefined ? true : undefined,
        inputsIgnored: timeline.inputsIgnored || undefined,
        searchedIntervals: this._reverseSearchIntervals
      };
    } else if (this._reverseDesync) {
      state = { active: false, mode: "live", desync: this._reverseDesync };
    }
    const json = JSON.stringify(state);
    if (json === this._reverseStateJson) return;
    this._reverseStateJson = json;
    this.store.dispatch(setReverseDebugStateAction(state), "emu");
  }

  /** While a replay runs, the host side effects of D13 are off */
  private get suppressingSideEffects(): boolean {
    return !!this._timeline?.isReplaying;
  }

  private _replayProvider?: ReplayStateProvider;

  /** Puts the machine at the history cursor by replay (D10) */
  get replayProvider(): ReplayStateProvider {
    this._replayProvider ??= new ReplayStateProvider(() => this.timeline, this.machine);
    return this._replayProvider;
  }

  /**
   * Take over here (D12): the point the machine stands at in the past becomes the present; the
   * recorded future - its inputs, keyframes and logged hits - goes, and live input resumes
   * @returns false when the machine is not in the past
   */
  async takeOverHere(): Promise<boolean> {
    const timeline = this.timeline;
    if (!timeline || timeline.mode !== "navigating" || this.state !== MachineControllerState.Paused) return false;
    this._historyCursor?.clear(false);
    const forked = timeline.fork();
    this.replayProvider.forgetPresent();
    this.store?.dispatch(setMachineStateAction(this.state, this.machine.pc), "emu");
    this.publishReverseState();
    await this.undoForkedHostEffects(forked);
    return true;
  }

  /** What a Take over here from where the machine stands would leave behind (the confirmation, T4) */
  forkPreview(): ForkPreview | undefined {
    return this.timeline?.forkPreview();
  }

  /**
   * After a fork (D13, D14): the SD sectors the discarded future wrote get their old bytes back, the
   * disks are written back from the restored in-core images, and host files the future's tape SAVEs
   * wrote - which Klive does not delete - are named
   */
  private async undoForkedHostEffects(forked: ForkResult): Promise<void> {
    const machine = this.machine as Partial<ForkAwareMachine>;
    if (forked.sdReverts.length && machine.revertSdWrites) {
      const result = await machine.revertSdWrites(forked.sdReverts, this.messenger);
      if (result.failed.length) {
        await this.sendOutput(
          `Take over here: ${result.failed.length} SD card sector write(s) of the discarded future could not be undone (sectors ${result.failed.map((e) => e.sector).join(", ")})`,
          "red"
        );
      }
    }
    if (machine.republishDisks?.()) this.emitPendingMediaChanges();
    if (forked.hostFiles.length) {
      await this.sendOutput(
        `Take over here: files saved to tape in the discarded future remain: ${forked.hostFiles.join(", ")}`,
        "yellow"
      );
    }
  }

  /**
   * Publishes what the machine has produced for the host and not handed over yet - a tape SAVE, disk
   * writes - outside the frame loop (a pause, a step, a move into the past)
   */
  private publishHostEffects(): void {
    const savedFileInfo = this.machine.getMachineProperty(SAVED_TO_TAPE) as SavedFileInfo;
    if (savedFileInfo) {
      this.machine.setMachineProperty(SAVED_TO_TAPE);
      this._timeline?.noteHostFile(savedFileInfo.name);
    }
    const diskChanges = this.collectPendingMediaChanges();
    if (savedFileInfo || diskChanges.diskAChanges || diskChanges.diskBChanges) {
      this.frameCompleted.fire({
        fullFrame: false,
        savedFileInfo,
        ...diskChanges,
        clockMultiplier: this.machine.clockMultiplier
      });
    }
  }

  /**
   * A replayed frame re-did tape SAVEs and disk writes the host already has - or, short of the
   * present, must never get: they are dropped, not published (D13)
   */
  private discardReplayedHostEffects(): void {
    this.machine.setMachineProperty(SAVED_TO_TAPE);
    this.collectPendingMediaChanges();
  }

  /**
   * A run from the past (D11): a debug run replays toward the present with breakpoints active and the
   * journal supplying the input; a plain Run first returns to the present
   */
  private beginRunFromPast(debugRun: boolean): void {
    const timeline = this.timeline;
    if (timeline?.mode !== "navigating") return;
    if (!debugRun) {
      this._historyCursor?.clear();
      return;
    }
    this._historyCursor?.clear(false);
    timeline.startReplayRun();
    this.context.historyStopArmed = true;
  }

  /**
   * A machine command leaves the history cursor (G4.3 D5). With the machine itself in the past, a run
   * continues from there or returns first (`beginRunFromPast`), and a stop ends the timeline: the
   * cursor stays for `run` to decide.
   */
  private clearCursorForCommand(): void {
    if (this.timeline?.mode === "navigating") return;
    this._historyCursor?.clear();
  }

  /** The machine paused: a replay run that stopped short of the present leaves the cursor where it is */
  private settleReplayRun(): void {
    const timeline = this._timeline;
    if (timeline?.mode !== "replaying") return;
    this.context.historyStopArmed = false;
    const at = timeline.pauseReplayRun();
    if (!at) return;
    if (timeline.viewHolds(at.sequence)) {
      this.historyCursor.attach(at.sequence + 1);
      return;
    }
    // --- Older than the present's ring (T22): no cursor, the machine itself shows the point, as after
    // --- a deep Reverse Continue landing (D17)
    this.replayProvider.anchorHere();
    this.store?.dispatch(setHistoryPositionAction(0, undefined, true), "emu");
  }

  /**
   * After every frame of a replay run: applies the journal entries the core reached and goes live at
   * the present (D11)
   * @returns `"entry"` when the frame ended at a journal entry (or the present) rather than at a
   * breakpoint or a step, `"desync"` when the replay diverged (the timeline has ended), `"none"`
   */
  private serviceReplayRun(): "none" | "entry" | "desync" {
    const timeline = this._timeline;
    if (timeline?.mode !== "replaying" || !timeline.port.targetReached) return "none";
    const outcome = timeline.onReplayTarget();
    if (outcome !== "continue") this.context.historyStopArmed = false;
    if (outcome === "present") this.replayProvider.forgetPresent();
    if (outcome !== "continue") this.publishReverseState();
    if (outcome === "desync") return "desync";
    return "entry";
  }

  /**
   * Run the machine loop until cancelled
   */
  private async run(
    terminationMode = FrameTerminationMode.Normal,
    debugStepMode = DebugStepMode.NoDebug,
    terminationPartition?: number,
    terminationPoint?: number,
    operationRevision?: number
  ): Promise<void> {
    this.assertMachineOperationIsCurrent(operationRevision);
    switch (this.state) {
      case MachineControllerState.Running:
        return;

      case MachineControllerState.None:
      case MachineControllerState.Stopped:
        // --- First start (after stop), reset the machine
        if (this.machine.softResetOnFirstStart) {
          this.machine.reset();
        } else {
          await this.machine.hardReset();
          this.assertMachineOperationIsCurrent(operationRevision);
        }

        // --- Check for supported media, attach media contents to the machine
        attachStoredMedia(this.machine, this._machineInfo.mediaIds);

        // --- A restart: breakpoint hit counters start over (C12). Resuming from a pause does not
        // --- come here, so it keeps them.
        this.debugSupport?.resetHitCounts();
        this.startLogSession();
        // --- ...and so does the execution history: a start from Stopped is a new timeline (D9)
        this.historySource()?.clearHistory();
        break;
    }

    // --- A run from the past (REVERSE_DEBUGGING_PLAN D11)
    this.beginRunFromPast(debugStepMode !== DebugStepMode.NoDebug);

    // --- Every run, a resume included: the previous stop's definitions no longer explain anything
    this.debugSupport?.clearFiredBreakpoints?.();

    // --- Initialize the context
    this.context.frameTerminationMode = terminationMode;
    this.context.debugStepMode = debugStepMode;
    this.context.terminationPartition = terminationPartition;
    this.context.terminationPoint = terminationPoint;
    this.context.canceled = false;
    /*
     * Breakpoints only in a debug run (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` C19).
     *
     * A `NoDebug` run reaches the per-instruction loops too - a code-injection flow's
     * `ReachExecPoint` boots the ROM through them - and those loops ask the breakpoint store at every
     * instruction whenever the context has one. A user breakpoint the boot passed (the IM 1 handler
     * at $38 runs every frame) then silently cut the boot short, and with hit counts it was worse:
     * the boot counted the hits, so `-hit 4` was spent before the program ever ran and never fired.
     */
    this.context.debugSupport =
      debugStepMode === DebugStepMode.NoDebug ? undefined : this.debugSupport;
    this.applyErrorStops();
    // --- A run that is not a source step ends what the last one reported
    if (debugStepMode !== DebugStepMode.SourceStep && this.debugSupport) this.debugSupport.sourceStep = undefined;

    // --- Set up the state
    this.machine.resetContentionDelaySincePause();
    this.machine.tactsAtLastStart = this.machine.tacts;

    // --- Obtain fastload settings - not while replaying from the past: the journal carries the
    // --- setting the recorded run had, and the push would only count as ignored input (D12)
    if (!this._timeline?.isReplaying) {
      const fastLoad = getGlobalSetting(this.store, SETTING_EMU_FAST_LOAD);
      this.machine.setMachineProperty(FAST_LOAD, fastLoad);
    }

    // --- Sign if we are in debug mode
    this.store.dispatch(setDebuggingAction(this.isDebugging), "emu");
    this.applyHistoryRecording(debugStepMode !== DebugStepMode.NoDebug);

    // --- Now, run!
    this.state = MachineControllerState.Running;
    this._machineTask = (async () => {
      this._cancelRequested = false;
      const nextFrameGap =
        (this.machine.tactsInFrame /
          this.machine.frameTactMultiplier /
          this.machine.baseClockFrequency) *
        1000 *
        this.machine.uiFrameFrequency;
      let nextFrameTime = performance.now() + nextFrameGap;
      do {
        // --- Use the latest clock multiplier
        // --- ... but 1 while an RZX session plays or records (D14)
        this.machine.targetClockMultiplier = this.rzxSession?.active
          ? 1
          : (this.store.getState()?.emulatorState?.clockMultiplier ?? 1);

        // --- Render to video holds frames back until the recorder is ready
        for (let gate = this.frameGate?.(); gate; gate = this.frameGate?.()) {
          await gate;
          if (this._cancelRequested) break;
        }
        if (this._cancelRequested) {
          this.context.canceled = true;
          return;
        }

        // --- Run the machine frame and measure execution time
        const frameStartTime = performance.now();
        const replayedFrame = this.suppressingSideEffects;
        let termination = this.machine.executeMachineFrame();
        const replayStop = this.serviceReplayRun();
        if (replayedFrame) this.discardReplayedHostEffects();
        if (replayStop === "desync") {
          // --- The replay diverged and ended the timeline: stop where it is (D9)
          termination = FrameTerminationMode.DebugEvent;
        } else if (replayStop === "entry" && termination === FrameTerminationMode.UntilExecutionPoint) {
          // --- A replay run reached its next journal entry: not a stop - unless this was a single step
          termination =
            debugStepMode === DebugStepMode.StepInto ? FrameTerminationMode.DebugEvent : FrameTerminationMode.Normal;
        }
        const cpuTime = performance.now() - frameStartTime;
        // --- Logpoint lines of this frame: one IPC call, sent before anything else this frame
        // --- reports (`.plans/LOGPOINTS_PLAN.md` L4, L8). Not awaited, to keep the frame rate;
        // --- awaited below before a stop message, so the lines come first.
        const logFlush = this.suppressingSideEffects ? Promise.resolve() : this.flushLogLines();
        const frameCompleted =
          termination === FrameTerminationMode.Normal && this.machine.frameJustCompleted;
        let savedFileInfo: SavedFileInfo;
        let diskAChanges: SectorChanges;
        let diskBChanges: SectorChanges;

        // --- Handle frame completion events (none of them while a replay runs, D13)
        if (frameCompleted && !this.suppressingSideEffects) {
          // --- Check for file to save
          savedFileInfo = this.machine.getMachineProperty(SAVED_TO_TAPE) as SavedFileInfo;
          if (savedFileInfo) {
            this.machine.setMachineProperty(SAVED_TO_TAPE);
            // --- A fork cannot unwrite it: the confirmation names it (T4)
            this._timeline?.noteHostFile(savedFileInfo.name);
          }

          // --- Check for disk changes
          const diskChanges = this.collectPendingMediaChanges();
          diskAChanges = diskChanges.diskAChanges;
          diskBChanges = diskChanges.diskBChanges;
        }

        // --- A keyframe, when one is due (D5)
        this._timeline?.afterFrame(frameCompleted);

        // --- Refresh the UI, if required so (not with a replay's frames: no audio, no screen, D13)
        if (!this.suppressingSideEffects) this.frameCompleted?.fire({
          fullFrame: frameCompleted,
          savedFileInfo,
          diskAChanges,
          diskBChanges,
          clockMultiplier: this.machine.clockMultiplier
        });

        // --- Calculate diagnostics
        const frameTime = performance.now() - frameStartTime;
        if (frameCompleted) {
          this.frameStats.frameCount++;
          // --- Handle emulated keystrokes
          this.machine.emulateKeystroke();
        }

        this.frameStats.lastCpuFrameTimeInMs = cpuTime;
        this.frameStats.avgCpuFrameTimeInMs =
          this.frameStats.frameCount === 0
            ? this.frameStats.lastCpuFrameTimeInMs
            : (this.frameStats.avgCpuFrameTimeInMs * (this.frameStats.frameCount - 1) +
                this.frameStats.lastCpuFrameTimeInMs) /
              this.frameStats.frameCount;
        this.frameStats.lastFrameTimeInMs = frameTime;
        this.frameStats.avgFrameTimeInMs =
          this.frameStats.frameCount == 0
            ? this.frameStats.lastFrameTimeInMs
            : (this.frameStats.avgFrameTimeInMs * (this.frameStats.frameCount - 1) +
                this.frameStats.lastFrameTimeInMs) /
              this.frameStats.frameCount;

        // --- RZX progress: twice a second
        if (frameCompleted && this.rzxSession?.active && this.frameStats.frameCount % 25 === 0) {
          this.publishRzxState();
        }

        // --- Live hit counts: at most every 10 frames while running (§4.5)
        if (frameCompleted && this.frameStats.frameCount % 10 === 0) {
          this.publishBreakpointHits();
        }

        // --- Handle termination
        if (this._cancelRequested) {
          // --- The machine is paused or stopped
          this.context.canceled = true;
          this.publishBreakpointHits();
          return;
        }

        if (termination !== FrameTerminationMode.Normal) {
          this.publishBreakpointHits();
          this.state = MachineControllerState.Paused;
          this._machineTask = undefined;
          this.context.canceled = true;

          // --- An RZX session that stopped (ended, desynced, ...) explains the pause itself
          if (termination === FrameTerminationMode.DebugEvent && (await this.reportRzxStop())) {
            await logFlush;
            return;
          }
          if (termination === FrameTerminationMode.DebugEvent) {
            // --- Memory, I/O and NextReg stops spend their one-shots here; an execution stop
            // --- already did in the decision, which makes this a no-op (O5)
            this.debugSupport?.consumeFiredOneShots();
            await logFlush;
            await this.sendOutput(this.describeDebugStop(), "cyan");
          }
          return;
        }

        // --- Execute the optional frame command
        const frameCommand = this.machine.getFrameCommand();
        if (frameCommand && this.suppressingSideEffects) {
          // --- A replay never asks the host: the journal answered at the command's position, and
          // --- an SD write must not reach the card again (D14)
          this.machine.setFrameCommand(null);
        } else if (frameCommand) {
          await this.machine.processFrameCommand(this.messenger);
          // --- FIX for ISSUE #2: Clear frame command AFTER processing is complete
          // --- This ensures the response is ready before the next frame iteration
          this.machine.setFrameCommand(null);
        }

        // --- Wait for the next frame in case of normal termination
        if (frameCompleted) {
          // --- Calculate the time to wait before the next machine frame starts
          if (this.machine.frames % this.machine.uiFrameFrequency === 0) {
            // --- Send recording data (and any other pre-delay work) before sleeping
            if (this.beforeFrameDelay) {
              await this.beforeFrameDelay();
            }
            if (this.unthrottled) {
              // --- Render to video (D18): no delay, but the event loop gets a turn now and then
              if (this.frameStats.frameCount % 50 === 0) await delay(0);
              nextFrameTime = performance.now() + nextFrameGap;
            } else {
              const curTime = performance.now();
              const toWait = Math.floor(nextFrameTime - curTime);
              await delay(toWait - 2);
              nextFrameTime += nextFrameGap;
            }
          }
        }
      } while (true);
    })();

    // --- Apply delay
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
   * Tell the IDE that breakpoint hit counters moved, if they did. Counting never dispatches by
   * itself - a hot loop would flood the store - so this is the throttle: called every 10 frames
   * while running and once when the run ends.
   */
  private publishBreakpointHits(): void {
    if (this.debugSupport?.takeHitsChanged()) {
      this.store.dispatch(incBreakpointHitsVersionAction(), "emu");
    }
  }

  /**
   * Finishes running the current execution loop of the machine
   * @param beforeState Controller state before finishing the operation
   * @param afterState Controller state after finishing the operation
   */
  private async finishExecutionLoop(
    beforeState: MachineControllerState,
    afterState: MachineControllerState
  ): Promise<void> {
    this.state = beforeState;
    this._cancelRequested = true;
    if (this._machineTask) {
      await this._machineTask;
      this._machineTask = undefined;
    }
    this.state = afterState;
  }

  /**
   * Starts a new externally visible machine operation and invalidates any older project startup
   * sequence that may still be waiting on ROM execution, queued keys, or startup delays.
   */
  private beginMachineOperation(): number {
    // --- Any machine command returns to the present first (`.plans/LITE_STEP_BACK_PLAN.md` D5) -
    // --- unless the machine itself is in the past: then `run` decides (REVERSE_DEBUGGING_PLAN D11)
    this.clearCursorForCommand();
    return ++this._operationRevision;
  }

  /**
   * Invalidates pending project startup continuations for user-issued machine control commands.
   */
  private prepareMachineOperation(operationRevision?: number): number {
    this.clearCursorForCommand();
    if (operationRevision === undefined) {
      return this.beginMachineOperation();
    }
    this.assertMachineOperationIsCurrent(operationRevision);
    return operationRevision;
  }

  /**
   * Throws when an async project startup continuation has been superseded by a newer command.
   */
  private assertMachineOperationIsCurrent(operationRevision?: number): void {
    if (operationRevision !== undefined && operationRevision !== this._operationRevision) {
      throw new MachineOperationCanceledError();
    }
  }

  /**
   * Ignore user breakpoints until the injection flow's queued keystrokes have landed.
   *
   * Debug mode is armed at the *end* of the flow, and for the Next it is armed while the machine is
   * still running with `.nexload` half-typed (see the `Start` step above, which starts in normal
   * mode for exactly this reason). A keystroke carries an absolute tact window: a user breakpoint
   * that pauses the machine in this window expires every stroke that has not been pressed yet, and
   * the user is left looking at a truncated command line and a program that never loaded. The flow's
   * own session-owned stop — the NEX entry-point breakpoint — still fires, because that is what
   * `suppressUserBreakpoints` lets through.
   *
   * Fire-and-forget, and self-limiting: the suppression is lifted as soon as *any* of these is true,
   * so there is no path on which it can outlive the flow and silently disarm the user's breakpoints.
   *
   * - the keystroke queue is empty — the hazard is over;
   * - the machine is no longer running — it paused (very likely *at* the entry stop) or stopped, and
   *   whatever the flow was waiting for will not arrive while it is not executing;
   * - a newer machine operation started — this flow was superseded or cancelled;
   * - the deadline passed — a machine that never drains its queue still gets its breakpoints back.
   *
   * See `.plans/NEX_DEBUGGING_PLAN.md` §9.5 and §10.3.
   */
  private suppressUserBreakpointsUntilKeystrokesLand(operationRevision?: number): void {
    const debugSupport = this.debugSupport;
    if (!debugSupport) return;

    debugSupport.suppressUserBreakpoints = true;
    // --- Exact at the moment of a hit: the poll below may lift the flag only after the program ran
    debugSupport.keystrokesPending = () => (this.machine?.getKeyQueueLength() ?? 0) > 0;
    const deadline = Date.now() + KEYSTROKE_SUPPRESSION_TIMEOUT_MS;

    const lift = async () => {
      try {
        while (true) {
          await delay(KEYSTROKE_SUPPRESSION_POLL_MS);
          if (operationRevision !== undefined && operationRevision !== this._operationRevision) {
            return;
          }
          if (this._machineState !== MachineControllerState.Running) return;
          if ((this.machine?.getKeyQueueLength() ?? 0) === 0) return;
          if (Date.now() >= deadline) return;
        }
      } finally {
        // --- Unconditional: every way out of that loop ends the window.
        debugSupport.suppressUserBreakpoints = false;
        debugSupport.keystrokesPending = undefined;
      }
    };
    void lift();
  }

  /**
   * Emits any pending media changes that would otherwise wait for the next full frame.
   */
  private emitPendingMediaChanges(): void {
    const diskChanges = this.collectPendingMediaChanges();
    if (diskChanges.diskAChanges || diskChanges.diskBChanges) {
      this.frameCompleted.fire({
        fullFrame: false,
        ...diskChanges,
        clockMultiplier: this.machine.clockMultiplier
      });
    }
  }

  /**
   * Collects pending media changes and clears the machine properties holding them.
   */
  private collectPendingMediaChanges(): Pick<
    FrameCompletedArgs,
    "diskAChanges" | "diskBChanges"
  > {
    const machineWithMediaFlush = this.machine as IAnyMachine & {
      flushDiskChanges?: () => void;
      floppyDevice?: Pick<IFloppyControllerDevice, "flushDiskChanges">;
    };
    if (machineWithMediaFlush.flushDiskChanges) {
      machineWithMediaFlush.flushDiskChanges();
    } else {
      machineWithMediaFlush.floppyDevice?.flushDiskChanges();
    }

    const diskAChanges = this.machine.getMachineProperty(DISK_A_CHANGES) as SectorChanges;
    if (diskAChanges) {
      this.machine.setMachineProperty(DISK_A_CHANGES);
    }

    const diskBChanges = this.machine.getMachineProperty(DISK_B_CHANGES) as SectorChanges;
    if (diskBChanges) {
      this.machine.setMachineProperty(DISK_B_CHANGES);
    }

    return { diskAChanges, diskBChanges };
  }

  /** Set when the Emulator pane has said where logpoint output goes, once per debug session. */
  private _logHintShown = false;

  /**
   * A machine start: logpoints log on the very first instruction again (L5), and the Emulator pane
   * gets its hint again with the first line.
   */
  private startLogSession(): void {
    if (this.debugSupport) {
      this.debugSupport.lastDecisionPc = undefined;
    }
    this._logHintShown = false;
  }

  /**
   * Send the queued logpoint lines to the Log pane in one `displayOutputBatch` call (L8): each line
   * as `[GROUP] message @ $8012`, then one line counting what the per-frame cap dropped (L9).
   */
  private flushLogLines(): Promise<void> {
    const debugSupport = this.debugSupport;
    if (!debugSupport?.hasPendingLog) return Promise.resolve();
    const { lines, dropped } = debugSupport.takeLogLines();
    const batch: OutputSpecification[] = [];
    if (!this._logHintShown) {
      this._logHintShown = true;
      batch.push({
        pane: PANE_ID_EMU,
        text: "Logpoint output is in the Log pane",
        foreground: "cyan",
        writeLine: true
      });
    }
    batch.push(...logLineOutput(lines, dropped));
    return createIdeApi(this.messenger)
      .displayOutputBatch(batch)
      .catch((err) => console.error("Sending logpoint output failed.", err));
  }

  /**
   * Send output to the IDE
   * @param text Text to send
   * @param foreground Text color to use
   */
  async sendOutput(text: string, foreground: OutputColor): Promise<void> {
    this._loggedEventNo++;
    const ideApi = createIdeApi(this.messenger);
    // --- One message, not two. The numbered prefix and the text are one line of output; sending
    // --- them as separate awaited requests doubled the round trips for every logged event.
    await ideApi.displayOutputBatch([
      {
        pane: PANE_ID_EMU,
        text: `[${this._loggedEventNo}] `,
        foreground: "magenta",
        writeLine: false
      },
      {
        pane: PANE_ID_EMU,
        text,
        foreground,
        writeLine: true
      }
    ]);
  }

  /**
   * What the output pane says when a debug event pauses the machine.
   *
   * A NextReg write breakpoint gets its own sentence rather than the generic one: "Breakpoint
   * reached at PC=$8005" says nothing about *which* register moved or what it moved to, and that
   * is the entire content of the stop. The register's documented name comes from the same table
   * the Next Registers panel reads.
   */
  /** Set once the Output pane has said how to switch assertions off (R8), once per session. */
  private _assertionHintShown = false;

  /**
   * The report of a stop an `ASSERTION` or `WPMEM` comment caused
   * (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` S11), or `undefined` for any other stop:
   *
   * - `ASSERTION failed at main.asm:42: A < 5  (A=$07)`
   * - `WPMEM write at $8002 (fill_colors+2) by PC $8123, main.asm:40`
   */
  private describeCommentStop(): string | undefined {
    const ds = this.debugSupport;
    if (!ds?.lastStopBreakpoints?.length) return undefined;
    const lines: string[] = [];
    ds.lastStopBreakpoints.forEach((bp, i) => {
      if (bp.owner?.kind !== "annotation" || !bp.annotationKind) return;
      const where = `${(bp.resource ?? "").split(/[\\/]/).pop()}:${bp.line}`;
      if (bp.annotationKind === "ASSERTION") {
        const text = bp.annotationText ?? "";
        const values = text ? ds.describeDezogValues(text) : "";
        lines.push(
          `ASSERTION failed at ${where}: ${text || "(always)"}${values ? `  (${values})` : ""}`
        );
        if (!this._assertionHintShown) {
          this._assertionHintShown = true;
          lines.push("  (as-en -d, or the ASSERTION comments switch in the Breakpoints panel, turns assertions off)");
        }
      } else {
        const access = ds.lastStopAccesses?.[i];
        const address = access?.address ?? bp.address ?? 0;
        const named = nearestSymbol(ds.conditionSymbolTable, address);
        // --- The decision runs before every instruction, so its last PC is the instruction that
        // --- made the access; `opStartAddress` is kept only by some cores (the Next, the Z88)
        const pc =
          ds.lastDecisionPc ??
          (this.machine as { opStartAddress?: number }).opStartAddress ??
          this.machine.pc;
        lines.push(
          `WPMEM ${bp.memoryRead ? "read" : "write"} at $${toHexa4(address)}` +
            `${named ? ` (${named})` : ""} by PC $${toHexa4(pc)}, ${where}`
        );
      }
    });
    return lines.length ? lines.join("\n") : undefined;
  }

  private describeDebugStop(): string {
    if (this.sourceIndex && this.errorCodeAt(this.machine.pc) !== undefined) {
      const stop = this.getSourceStopInfo();
      const s = stop?.userStatementIndex !== undefined ? this.sourceIndex.statements[stop.userStatementIndex] : undefined;
      const file = s ? this.sourceIndex.info.files[s.fileIndex]?.filename.split(/[\\/]/).pop() : undefined;
      return `Runtime error ${stop?.error?.report ?? ""}${s ? ` at ${file}:${s.startLine}` : ""} (continue to let the ROM report it)`;
    }
    // --- A stop a DeZog comment caused names the comment (S11)
    const commentStop = this.describeCommentStop();
    if (commentStop) return commentStop;
    const copperHit = (this.machine as { lastCopperHit?: CopperHitEvent }).lastCopperHit;
    if (copperHit) {
      return describeCopperStop(copperHit, this.machine.getPartitionLabels?.());
    }
    const write = (this.machine as { lastNextRegWrite?: NextRegWriteEvent }).lastNextRegWrite;
    if (!write) {
      return `Breakpoint reached at PC=$${toHexa4(this.machine.pc)}`;
    }

    const hex2 = (value: number) => `$${value.toString(16).toUpperCase().padStart(2, "0")}`;
    const name = NEXT_REG_DESCRIPTORS.find((d) => d.id === write.reg)?.description;
    const named = name ? `${hex2(write.reg)} (${name})` : hex2(write.reg);

    /*
     * Where the write came from, named as precisely as the origin allows.
     *
     * This half of the message is the point of it. A NextReg write breakpoint is most useful on
     * `$02`, where the write resets the machine - and once the user resumes, the address and the
     * paging are gone for good. The output pane is the only durable record of them, so it carries
     * both rather than leaving the user to read them off a machine that has moved on.
     */
    const site = `$${toHexa4(write.pc)}`;
    const paged =
      write.partition === undefined
        ? ""
        : ` in ${this.machine.getPartitionLabels?.()?.[write.partition] ?? write.partition}`;
    const from =
      write.origin === "copper"
        ? `by the copper, with the CPU at ${site}${paged}`
        : `written at ${site}${paged}`;

    return `NextReg breakpoint: ${named} ${hex2(write.oldValue)} -> ${hex2(write.newValue)}, ${from}`;
  }

}

/**
 * The stop message of a Copper breakpoint or a Copper step (`.plans/COPPER_DEBUGGING_PLAN.md` §4.7).
 * It names the **hit** - the instruction and the beam where it completed - because the Copper has
 * run on to the end of the Z80 instruction by the time the machine stops (T1):
 *
 *   Copper breakpoint: $00B WAIT 120, 31 satisfied at line 120, hc 262 (x 250); CPU at $8012 in R0
 *   Copper breakpoint: $00D MOVE $41, $FC (Palette Value (8 bit)) at line 120, hc 270; CPU at $8012
 */
export function describeCopperStop(
  hit: CopperHitEvent,
  partitionLabels?: Record<number, string>
): string {
  const instr = decodeCopperWord(hit.index, hit.word);
  const at = `line ${hit.line}, hc ${hit.hc}`;
  let what: string;
  switch (instr.kind) {
    case "wait":
      what = `${formatCopperInstruction(instr)} satisfied at ${at} (x ${hit.hc - 12})`;
      break;
    case "move":
      what = `${formatCopperInstruction(instr)}${instr.regName ? ` (${instr.regName})` : ""} at ${at}`;
      break;
    default:
      what = `${formatCopperInstruction(instr)} at ${at}`;
  }
  const paged =
    hit.partition === undefined ? "" : ` in ${partitionLabels?.[hit.partition] ?? hit.partition}`;
  return `Copper breakpoint: ${formatCopperIndex(hit.index)} ${what}; CPU at $${toHexa4(hit.pc)}${paged}`;
}

/**
 * `fill_colors+2`: the closest build symbol at or below an address, within 256 bytes, or
 * `undefined`. Symbols are keyed lower-case, so the name comes back lower-case.
 */
function nearestSymbol(symbols: Record<string, number> | undefined, address: number): string | undefined {
  let best: { name: string; value: number } | undefined;
  for (const [name, value] of Object.entries(symbols ?? {})) {
    if (name.includes(":") || value > address || address - value > 0xff) continue;
    if (!best || value > best.value || (value === best.value && name < best.name)) {
      best = { name, value };
    }
  }
  if (!best) return undefined;
  return address === best.value ? best.name : `${best.name}+${address - best.value}`;
}

/** Whether a machine can keep a reverse-debugging timeline (`reverse/Timeline.ts`) */
function isTimelineMachine(machine: unknown): machine is TimelineMachine {
  const m = machine as Partial<TimelineMachine> | undefined;
  return (
    typeof m?.captureHostState === "function" &&
    typeof m?.restoreHostState === "function" &&
    typeof m?.invalidateHostSync === "function" &&
    typeof m?.isAtFrameBoundary === "function" &&
    typeof m?.reverseFrameExport === "string" &&
    !!m?.reverseRuntime
  );
}

/** Whether a breakpoint store can keep its hit counters with keyframes (D16) */
function hasTimelineState(debugSupport: unknown): debugSupport is TimelineDebugSupport {
  const d = debugSupport as Partial<TimelineDebugSupport> | undefined;
  return typeof d?.captureTimelineState === "function" && typeof d?.restoreTimelineState === "function";
}
