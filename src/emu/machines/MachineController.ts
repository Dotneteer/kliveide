import { FrameCompletedArgs, IMachineController } from "@renderer/abstractions/IMachineController";
import { CodeToInject } from "@abstractions/CodeToInject";
import { toHexa4 } from "@appIde/services/ide-commands";
import { IOutputBuffer, OutputColor } from "@renderer/appIde/ToolArea/abstractions";
import { DebugStepMode } from "@emu/abstractions/DebugStepMode";
import { ExecutionContext } from "@emu/abstractions/ExecutionContext";
import { FrameStats } from "@renderer/abstractions/FrameStats";
import { FrameTerminationMode } from "@emu/abstractions/FrameTerminationMode";
import { IDebugSupport } from "@renderer/abstractions/IDebugSupport";
import { IZ80Machine } from "@renderer/abstractions/IZ80Machine";
import { LiteEvent } from "@emu/utils/lite-event";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { MessengerBase } from "@messaging/MessengerBase";
import { setDebuggingAction, setMachineStateAction } from "@state/actions";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { SavedFileInfo } from "@emu/abstractions/ITapeDevice";
import { DISK_A_CHANGES, DISK_B_CHANGES, FAST_LOAD, SAVED_TO_TAPE } from "./machine-props";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { delay } from "@renderer/utils/timing";
import { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import { MachineInfo } from "@common/machines/info-types";
import { machineRegistry } from "@common/machines/machine-registry";
import { mediaStore } from "./media/media-info";
import { PANE_ID_EMU } from "@common/integration/constants";

/**
 * This class implements a machine controller that can operate an emulated machine invoking its execution loop.
 */
export class MachineController implements IMachineController {
  private _cancelRequested: boolean;
  private _machineTask: Promise<void>;
  private _machineState: MachineControllerState;
  private _loggedEventNo = 0;
  private readonly _machineInfo: MachineInfo;

  /**
   * Initializes the controller to manage the specified machine.
   * @param machine The machine to manage
   */
  constructor(
    public readonly store: Store<AppState>,
    public readonly messenger: MessengerBase,
    public readonly machine: IZ80Machine
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
    this.store.dispatch(setMachineStateAction(value), "emu");
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
   * Start the machine in normal mode.
   */
  async start(): Promise<void> {
    await this.sendOutput("Machine started", "green");
    this.isDebugging = false;
    this.run();
  }

  /**
   * Start the machine in debug mode.
   */
  async startDebug(): Promise<void> {
    this.isDebugging = true;
    this.machine?.awakeCpu();
    await this.sendOutput("Machine started in debug mode", "green");
    this.run(FrameTerminationMode.DebugEvent, DebugStepMode.StopAtBreakpoint);
  }

  /**
   * Pause the running machine.
   */
  async pause(): Promise<void> {
    if (this.state !== MachineControllerState.Running) {
      throw new Error("The machine is not running");
    }
    await this.finishExecutionLoop(MachineControllerState.Pausing, MachineControllerState.Paused);
    await this.sendOutput(
      `Machine paused (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
      "cyan"
    );
  }

  /**
   * Stop the running or paused machine.
   */
  async stop(): Promise<void> {
    // --- Stop the machine
    const beforeState = this.state;
    this.isDebugging = false;
    await this.finishExecutionLoop(MachineControllerState.Stopping, MachineControllerState.Stopped);
    if (
      beforeState !== MachineControllerState.Stopped &&
      beforeState !== MachineControllerState.None
    ) {
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
  async cpuReset(): Promise<void> {
    await this.stop();
    await this.sendOutput("CPU reset", "cyan");
    this.machine.reset();
    await this.start();
  }

  /**
   * Stop and then start the machine again.
   */
  async restart(): Promise<void> {
    await this.stop();
    await this.sendOutput("Hard reset", "cyan");
    await this.machine.hardReset();
    await this.start();
  }

  /**
   * Starts the machine in step-into mode.
   */
  async stepInto(): Promise<void> {
    this.isDebugging = true;
    this.machine?.awakeCpu();
    await this.sendOutput(
      `Step-into (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
      "cyan"
    );
    this.run(FrameTerminationMode.DebugEvent, DebugStepMode.StepInto);
  }

  /**
   * Starts the machine in step-over mode.
   */
  async stepOver(): Promise<void> {
    this.isDebugging = true;
    this.machine?.awakeCpu();
    await this.sendOutput(
      `Step-over (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
      "cyan"
    );
    this.run(FrameTerminationMode.DebugEvent, DebugStepMode.StepOver);
  }

  /**
   * Starts the machine in step-out mode.
   */
  async stepOut(): Promise<void> {
    this.isDebugging = true;
    this.machine?.awakeCpu();
    await this.sendOutput(
      `Step-out (PC: $${this.machine.pc.toString(16).padStart(4, "0")})`,
      "cyan"
    );
    this.run(FrameTerminationMode.DebugEvent, DebugStepMode.StepOut);
  }

  /**
   * Executes a custom command
   * @param command Custom command string
   */
  async customCommand(command: string): Promise<void> {
    await this.machine.executeCustomCommand(command);
  }

  /**
   * Runs the specified code in the virtual machine
   * @param codeToInject Code to inject into the amchine
   * @param debug Run in debug mode?
   */
  async runCode(codeToInject: CodeToInject, debug?: boolean): Promise<void> {
    // --- Stop the machine
    await this.stop();

    // --- Execute the code injection flow
    const m = this.machine;
    const injectionFlow = this.machine.getCodeInjectionFlow(codeToInject.model ?? m.machineId);
    await this.sendOutput("Initialize the machine", "blue");
    this.isDebugging = debug;

    let entryPoint = 0;
    for (const step of injectionFlow) {
      switch (step.type) {
        case "ReachExecPoint":
          // --- Run while a particular entry point is reached
          if (this._machineState === MachineControllerState.Running) {
            await this.pause();
          }
          await this.run(
            FrameTerminationMode.UntilExecutionPoint,
            debug ? DebugStepMode.StopAtBreakpoint : DebugStepMode.NoDebug,
            step.rom,
            step.execPoint
          );
          await this._machineTask;
          break;

        case "Start":
          await this.start();
          break;

        case "QueueKey":
          m.queueKeystroke(0, 5, step.primary, step.secondary, step.ternary);
          if ((step.wait ?? 100) > 0) {
            await delay(step.wait);
          }
          break;

        case "Inject":
          // --- Inject the code and set up the machine to run the code
          entryPoint = this.machine.injectCodeToRun(codeToInject);
          await this.sendOutput(
            `Code injected and ready to start at $${toHexa4(entryPoint)}})`,
            "blue"
          );
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
          }
          break;
      }
      if (step.message) {
        await this.sendOutput(step.message, "blue");
      }
    }

    // --- Set the continuation point
    m.pc = entryPoint;

    // --- Start the machine
    if (debug) {
      await this.startDebug();
    } else {
      await this.start();
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
    terminationPoint?: number
  ): Promise<void> {
    switch (this.state) {
      case MachineControllerState.Running:
        throw new Error("The machine is already running");

      case MachineControllerState.None:
      case MachineControllerState.Stopped:
        // --- First start (after stop), reset the machine
        if (this.machine.softResetOnFirstStart) {
          console.log("Soft reset on first start");
          this.machine.reset();
        } else {
          console.log("Hard reset on first start");
          await this.machine.hardReset();
        }

        // --- Check for supported media, attach media contents to the machine
        this._machineInfo.mediaIds?.forEach((mediaId) => {
          const mediaInfo = mediaStore.getMedia(mediaId);
          if (mediaInfo?.mediaContents) {
            this.machine.setMachineProperty(mediaId, mediaInfo.mediaContents);
          }
        });
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
    this.machine.setMachineProperty(FAST_LOAD, this.store.getState()?.emulatorState.fastLoad);

    // --- Sign if we are in debug mode
    this.store.dispatch(setDebuggingAction(this.isDebugging), "emu");

    // --- Now, run!
    this.state = MachineControllerState.Running;
    this._machineTask = (async () => {
      this._cancelRequested = false;
      const nextFrameGap =
        (this.machine.tactsInFrame / this.machine.baseClockFrequency) *
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
        const frameCompleted = termination === FrameTerminationMode.Normal;
        let savedFileInfo: SavedFileInfo;
        let diskAChanges: SectorChanges;
        let diskBChanges: SectorChanges;
        if (frameCompleted) {
          // --- Check for file to save
          savedFileInfo = this.machine.getMachineProperty(SAVED_TO_TAPE) as SavedFileInfo;
          if (savedFileInfo) {
            this.machine.setMachineProperty(SAVED_TO_TAPE);
          }

          // --- Check for disk A changes
          diskAChanges = this.machine.getMachineProperty(DISK_A_CHANGES) as SectorChanges;
          if (diskAChanges) {
            this.machine.setMachineProperty(DISK_A_CHANGES);
          }

          // --- Check for disk B changes
          diskBChanges = this.machine.getMachineProperty(DISK_B_CHANGES) as SectorChanges;
          if (diskBChanges) {
            this.machine.setMachineProperty(DISK_B_CHANGES);
          }
        }
        this.frameCompleted?.fire({
          fullFrame: frameCompleted,
          savedFileInfo,
          diskAChanges,
          diskBChanges
        });
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

        // --- Calculate the time to wait before the next machine frame starts
        if (this.machine.frames % this.machine.uiFrameFrequency === 0) {
          const curTime = performance.now();
          const toWait = Math.floor(nextFrameTime - curTime);
          await delay(toWait - 2);
          nextFrameTime += nextFrameGap;
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
   * Send output to the IDE
   * @param text Text to send
   * @param color Text color to use
   */
  async sendOutput(text: string, color: OutputColor): Promise<void> {
    this._loggedEventNo++;
    await this.messenger.sendMessage({
      type: "IdeDisplayOutput",
      pane: PANE_ID_EMU,
      text: `[${this._loggedEventNo}] `,
      color: "magenta",
      writeLine: false
    });
    await this.messenger.sendMessage({
      type: "IdeDisplayOutput",
      pane: PANE_ID_EMU,
      text,
      color,
      writeLine: true
    });
  }
}
