import type {
  FrameCompletedArgs,
  IMachineController
} from "@renderer/abstractions/IMachineController";
import type { CodeToInject } from "@abstractions/CodeToInject";
import type { IOutputBuffer, OutputColor } from "@renderer/appIde/ToolArea/abstractions";
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
import type { IFloppyControllerDevice } from "@emu/abstractions/IFloppyControllerDevice";

import { toHexa4 } from "@appIde/services/ide-commands";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { LiteEvent } from "@emu/utils/lite-event";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import {
  setDebuggingAction,
  setMachineStateAction,
  setProjectDebuggingAction
} from "@state/actions";
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
import { createIdeApi } from "@common/messaging/IdeApi";
import { SETTING_EMU_FAST_LOAD } from "@common/settings/setting-const";
import { getGlobalSetting } from "@renderer/core/RendererProvider";
import { IAnyMachine } from "@renderer/abstractions/IAnyMachine";

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
    this.stateChanged?.release();
    this.frameCompleted?.release();
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
    this.store.dispatch(setMachineStateAction(value, this.machine.pc), "emu");
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
    // --- Stop the machine
    const beforeState = this.state;
    this.isDebugging = false;
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

    // --- Reset the imminent breakpoint
    if (this.context.debugSupport) {
      delete this.context.debugSupport.imminentBreakpoint;
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

  /**
   * Starts the machine in step-into mode.
   */
  async stepInto(operationRevision?: number): Promise<void> {
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
    return await this.machine.executeCustomCommand(command);
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
    const m = this.machine;
    const injectionFlow = await this.machine.getCodeInjectionFlow(
      codeToInject.model ?? m.machineId,
      additionalInfo
    );
    this.assertMachineOperationIsCurrent(operationRevision);
    await this.sendOutput("Initialize the machine", "blue");
    this.assertMachineOperationIsCurrent(operationRevision);
    this.isDebugging = debug;

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
          await this.run(
            FrameTerminationMode.UntilExecutionPoint,
            DebugStepMode.NoDebug,
            step.rom,
            step.execPoint,
            operationRevision
          );
          await this._machineTask;
          this.assertMachineOperationIsCurrent(operationRevision);
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

        case "QueueKey":
          m.queueKeystroke(0, 5, step.primary, step.secondary, step.ternary);
          if ((step.wait ?? 100) > 0) {
            await delay(step.wait);
            this.assertMachineOperationIsCurrent(operationRevision);
          }
          break;

        case "Inject":
          // --- Inject the code and set up the machine to run the code
          entryPoint = this.machine.injectCodeToRun(codeToInject);
          await this.sendOutput(
            `Code injected and ready to start at $${toHexa4(entryPoint)}})`,
            "blue"
          );
          this.assertMachineOperationIsCurrent(operationRevision);
          break;

        case "SetReturn":
          if (codeToInject.subroutine) {
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
        this.machine?.awakeCpu();
        this.store.dispatch(setDebuggingAction(true), "emu");
      } else {
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
      this.debugSupport.resolveBreakpoint(bp.resource, bp.line, bp.address);
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
        break;
    }

    // --- Initialize the context
    this.context.frameTerminationMode = terminationMode;
    this.context.debugStepMode = debugStepMode;
    this.context.terminationPartition = terminationPartition;
    this.context.terminationPoint = terminationPoint;
    this.context.canceled = false;
    this.context.debugSupport = this.debugSupport;

    // --- Set up the state
    this.machine.contentionDelaySincePause = 0;
    this.machine.tactsAtLastStart = this.machine.tacts;

    // --- Obtain fastload settings
    const fastLoad = getGlobalSetting(this.store, SETTING_EMU_FAST_LOAD);
    this.machine.setMachineProperty(FAST_LOAD, fastLoad);

    // --- Sign if we are in debug mode
    this.store.dispatch(setDebuggingAction(this.isDebugging), "emu");

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
        this.machine.targetClockMultiplier =
          this.store.getState()?.emulatorState?.clockMultiplier ?? 1;

        // --- Run the machine frame and measure execution time
        const frameStartTime = performance.now();
        const termination = this.machine.executeMachineFrame();
        const cpuTime = performance.now() - frameStartTime;
        const frameCompleted =
          termination === FrameTerminationMode.Normal && this.machine.frameJustCompleted;
        let savedFileInfo: SavedFileInfo;
        let diskAChanges: SectorChanges;
        let diskBChanges: SectorChanges;

        // --- Handle frame completion events
        if (frameCompleted) {
          // --- Check for file to save
          savedFileInfo = this.machine.getMachineProperty(SAVED_TO_TAPE) as SavedFileInfo;
          if (savedFileInfo) {
            this.machine.setMachineProperty(SAVED_TO_TAPE);
          }

          // --- Check for disk changes
          const diskChanges = this.collectPendingMediaChanges();
          diskAChanges = diskChanges.diskAChanges;
          diskBChanges = diskChanges.diskBChanges;
        }

        // --- Refresh the UI, if required so
        this.frameCompleted?.fire({
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

        // --- Handle termination
        if (this._cancelRequested) {
          // --- The machine is paused or stopped
          this.context.canceled = true;
          return;
        }

        if (termination !== FrameTerminationMode.Normal) {
          this.state = MachineControllerState.Paused;
          this._machineTask = undefined;
          this.context.canceled = true;

          if (termination === FrameTerminationMode.DebugEvent) {
            await this.sendOutput(
              `Breakpoint reached at PC=${this.machine.pc.toString(16).padStart(4, "0")}`,
              "cyan"
            );
          }
          return;
        }

        // --- Execute the optional frame command
        const frameCommand = this.machine.getFrameCommand();
        if (frameCommand) {
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
            const curTime = performance.now();
            const toWait = Math.floor(nextFrameTime - curTime);
            await delay(toWait - 2);
            nextFrameTime += nextFrameGap;
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
    return ++this._operationRevision;
  }

  /**
   * Invalidates pending project startup continuations for user-issued machine control commands.
   */
  private prepareMachineOperation(operationRevision?: number): number {
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

  /**
   * Send output to the IDE
   * @param text Text to send
   * @param foreground Text color to use
   */
  async sendOutput(text: string, foreground: OutputColor): Promise<void> {
    this._loggedEventNo++;
    const ideApi = createIdeApi(this.messenger);
    await ideApi.displayOutput({
      pane: PANE_ID_EMU,
      text: `[${this._loggedEventNo}] `,
      foreground: "magenta",
      writeLine: false
    });
    await ideApi.displayOutput({
      pane: PANE_ID_EMU,
      text,
      foreground,
      writeLine: true
    });
  }
}
